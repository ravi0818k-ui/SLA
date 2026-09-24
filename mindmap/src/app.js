/**
 * The editor application: owns the document, the map, the viewport and the
 * history, and exposes one `run(command)` entry point that the toolbar, the
 * menus, the context menu and the keyboard all go through.
 *
 * The render pipeline is deliberately one-directional:
 *
 *   model change -> commit() -> layout -> canvas.render() -> panels.render()
 *
 * Nothing renders itself. That is what keeps the canvas, the outline, the
 * navigator and the properties panel showing the same thing (requirement 14).
 */
import { MindMap } from './core/MindMap.js';
import { createDocument, parseDocument, touchDocument } from './core/Document.js';
import { THEMES } from './core/Theme.js';
import { calculate, LAYOUTS, LAYOUT_LABELS } from './layout/LayoutEngine.js';
import { textBox, PAD_X, PAD_Y } from './layout/metrics.js';
import { SVGCanvas } from './canvas/SVGCanvas.js';
import { Viewport } from './canvas/Zoom.js';
import { Selection, navigateFrom } from './canvas/Selection.js';
import { initPan, initPinchZoom } from './canvas/Pan.js';
import { initDragDrop } from './canvas/DragDrop.js';
import { History } from './history/History.js';
import { undo as runUndo } from './history/Undo.js';
import { redo as runRedo } from './history/Redo.js';
import { createAutoSave } from './storage/AutoSave.js';
import { loadMap, deleteMap, listMaps, getPref, setPref } from './storage/IndexedDB.js';
import { recordOpen } from './storage/RecentFiles.js';
import { importFile, importString, ACCEPTED } from './import/index.js';
import { downloadExport, FORMATS, exportOutline } from './export/index.js';
import { loadTemplate, listTemplates } from './templates/index.js';
import { initToolbar } from './ui/Toolbar.js';
import { initSidebar } from './ui/Sidebar.js';
import { initPropertiesPanel } from './ui/PropertiesPanel.js';
import { initShortcuts, SHORTCUTS } from './ui/Shortcuts.js';
import { openContextMenu } from './ui/ContextMenu.js';
import { openDialog, promptDialog, confirmDialog, alertDialog, toast } from './ui/Dialogs.js';
import { el, qs, clear } from './util/dom.js';
import { safeImageSrc, asText } from './util/sanitize.js';
import { uid } from './util/id.js';
import { relativeTime } from './util/format.js';
import { fromOutline } from './import/JSON.js';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Breathing room between our measured text width and the textarea's own wrap. */
const EDITOR_SLACK = 8;

export class Editor {
    constructor(root = document) {
        this.root = root;
        this.doc = createDocument({ title: 'Untitled Mind Map', rootText: 'Central Topic' });
        this.map = MindMap.fromState(this.doc.map);
        this.history = new History();
        this.selection = new Selection();
        this.viewport = new Viewport();
        this.lastResult = null;
        this.searchQuery = '';
        this.searchResults = [];
        this.matches = new Set();
        this.clipboard = null;
        this.editingId = null;
        this.relationshipSourceId = null;
        this.activePanel = 'outline';
        // Drill-down lays the map out from this topic; focus only dims the rest.
        this.drillId = null;
        this.focusBranchId = null;
        this.styleClipboard = null;

        this.canvasWrap = qs('#mm-canvas-wrap', root);
        this.svg = qs('#mm-canvas', root);
        this.canvas = new SVGCanvas({ svg: this.svg, viewport: this.viewport });

        this.toolbar = initToolbar(this, root);
        this.sidebar = initSidebar(this, qs('#mm-sidebar', root));
        this.properties = initPropertiesPanel(this, qs('#mm-properties-body', root));
        this.shortcuts = initShortcuts(this);

        this.autosave = createAutoSave({
            getDocument: () => this.snapshotDocument(),
            getMap: () => this.map,
            onStatus: (state, detail) => this.toolbar.setStatus(state, detail)
        });

        this.bindCanvas();
        this.selection.on('change', () => {
            this.properties.render();
            this.toolbar.update();
            this.renderCanvasOnly();
            this.sidebar.render();
        });

        this.viewport.onChange = () => {
            this.canvas.updateTransform();
            this.toolbar.update();
            this.positionInlineEditor();
        };

        window.addEventListener('resize', () => this.renderCanvasOnly());
        window.addEventListener('pagehide', () => this.autosave.flush());
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') this.autosave.flush();
        });
        document.addEventListener('paste', (event) => this.onPaste(event));
    }

    // ------------------------------------------------------------- lifecycle

    async start() {
        const params = new URLSearchParams(location.search);
        const id = params.get('id');
        const template = params.get('template');

        let opened = false;
        try {
            if (id) {
                const stored = await loadMap(id);
                if (stored) { this.setDocument(parseDocument(stored), { fresh: true }); opened = true; }
                else toast('That map could not be found — starting a new one.', 'warn');
            } else if (template) {
                this.setDocument(await loadTemplate(template), { fresh: true });
                opened = true;
            } else {
                // No map asked for: pick up where this device left off.
                const last = await getPref('lastOpenId', null);
                const stored = last ? await loadMap(last) : null;
                if (stored) { this.setDocument(parseDocument(stored), { fresh: true }); opened = true; }
            }
        } catch (error) {
            toast(error.message || 'That map could not be opened.', 'error');
        }

        // Nothing was loaded, so the blank document made in the constructor is
        // what we are editing — seed history with it or the first undo has
        // nothing to go back to.
        if (!opened) {
            this.history.reset(this.map.toState(), 'new');
            this.render();
        }
        await recordOpen(this.doc.meta.id);
        await setPref('lastOpenId', this.doc.meta.id);
        this.applyStoredPreferences();
        this.fit();
        this.selectTopic(this.map.rootId);
        this.autosave.schedule();
    }

    async applyStoredPreferences() {
        const dark = await getPref('darkMode', null);
        if (dark !== null) document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    }

    setDocument(doc, { fresh = false } = {}) {
        this.doc = doc;
        this.map = MindMap.fromState(doc.map);
        this.viewport.set(doc.view.pan.x, doc.view.pan.y, doc.view.zoom);
        this.selection.clear();
        this.editingId = null;
        this.setSearch('');
        if (fresh) this.history.reset(this.map.toState(), 'open');
        this.render();
        document.title = doc.meta.title + ' — OpenMind';
    }

    snapshotDocument() {
        this.doc.map = this.map.toState();
        this.doc.view.zoom = this.viewport.scale;
        this.doc.view.pan = { x: this.viewport.x, y: this.viewport.y };
        return touchDocument(this.doc, this.map);
    }

    // ----------------------------------------------------------- rendering

    render() {
        if (this.drillId && !this.map.topic(this.drillId)) this.drillId = null;
        if (this.focusBranchId && !this.map.topic(this.focusBranchId)) this.focusBranchId = null;
        this.lastResult = calculate(this.map, {
            layout: this.doc.view.layout,
            theme: this.doc.view.theme,
            rootId: this.drillId
        });
        this.canvas.render({
            map: this.map,
            result: this.lastResult,
            selectedIds: new Set(this.selection.toArray()),
            primaryId: this.selection.primaryId,
            matches: this.matches,
            editingId: this.editingId,
            dimmedIds: this.dimmedIds()
        });
        this.sidebar.render();
        this.properties.render();
        this.toolbar.update();
        this.positionInlineEditor();
    }

    /** Re-draw the canvas without rebuilding the panels (selection, hover). */
    renderCanvasOnly() {
        if (!this.lastResult) return this.render();
        this.canvas.render({
            map: this.map,
            result: this.lastResult,
            selectedIds: new Set(this.selection.toArray()),
            primaryId: this.selection.primaryId,
            matches: this.matches,
            editingId: this.editingId,
            dimmedIds: this.dimmedIds()
        });
        return undefined;
    }

    /** Apply a model change: push history, re-render, queue a save. */
    commit(label = 'edit', { coalesceKey = null, relayout = true } = {}) {
        this.history.push(this.map.toState(), { label, coalesceKey });
        if (relayout) this.render();
        else this.renderCanvasOnly();
        this.autosave.schedule();
    }

    applyState(state) {
        this.map = MindMap.fromState(state);
        this.selection.prune(this.map);
        this.setSearch(this.searchQuery);
        this.render();
        this.autosave.schedule();
    }

    // ------------------------------------------------------------- canvas IO

    bindCanvas() {
        initPan({
            svg: this.svg,
            viewport: this.viewport,
            isPanKeyDown: () => this.shortcuts.isSpaceDown(),
            shouldStart: (event) => !event.target.closest('.mm-node')
        });
        initPinchZoom({ svg: this.svg, viewport: this.viewport });

        initDragDrop({
            svg: this.svg,
            canvas: this.canvas,
            viewport: this.viewport,
            getMap: () => this.map,
            getResult: () => this.lastResult,
            isEditing: () => Boolean(this.editingId),
            onClick: (id, event) => this.onNodeClick(id, event),
            onDrop: (action) => this.onDrop(action)
        });

        this.bindResizeHandles();

        this.svg.addEventListener('click', (event) => {
            const quickAdd = event.target.closest('.mm-quick-add');
            if (quickAdd) {
                this.addChild(quickAdd.dataset.quickAdd);
                return;
            }
            const toggle = event.target.closest('.mm-toggle');
            if (toggle) {
                this.toggleCollapse(toggle.dataset.toggle);
                return;
            }
            if (!event.target.closest('.mm-node')) {
                this.selection.clear();
                this.relationshipSourceId = null;
            }
        });

        this.svg.addEventListener('dblclick', (event) => {
            const grip = event.target.closest('.mm-resize-handle');
            if (grip) {
                this.setNodeWidth(grip.dataset.resize, null);
                return;
            }
            if (event.target.closest('.mm-quick-add')) return;
            const node = event.target.closest('.mm-node');
            if (node) this.startEditing(node.dataset.id);
            else this.run('fit');
        });

        this.svg.addEventListener('contextmenu', (event) => {
            const node = event.target.closest('.mm-node');
            event.preventDefault();
            if (node) {
                this.selectTopic(node.dataset.id);
                this.openTopicMenu(event.clientX, event.clientY);
            } else {
                this.openCanvasMenu(event.clientX, event.clientY);
            }
        });
    }

    /**
     * Dragging the grip on a topic's right edge sets a manual box width, so a
     * long topic can be made narrow (more lines) or wide (fewer). The width is
     * stored as a sparse style key, which means "reset style" clears it and the
     * box goes back to sizing itself to the text.
     */
    bindResizeHandles() {
        let drag = null;

        this.svg.addEventListener('pointerdown', (event) => {
            const grip = event.target.closest?.('.mm-resize-handle');
            if (!grip || event.button !== 0) return;
            const id = grip.dataset.resize;
            const node = this.lastResult?.nodes.get(id);
            if (!node) return;
            event.preventDefault();
            event.stopPropagation();
            drag = { id, startX: event.clientX, startWidth: node.width, changed: false };
            this.svg.setPointerCapture?.(event.pointerId);
            this.svg.classList.add('is-resizing');
        }, true);

        this.svg.addEventListener('pointermove', (event) => {
            if (!drag) return;
            const delta = (event.clientX - drag.startX) / this.viewport.scale;
            const width = Math.round(drag.startWidth + delta);
            if (width === drag.lastWidth) return;
            drag.lastWidth = width;
            drag.changed = true;
            // Live preview only — nothing reaches history until pointerup.
            this.map.setStyle(drag.id, { width });
            this.render();
        });

        const finish = (event) => {
            if (!drag) return;
            const finished = drag;
            drag = null;
            if (this.svg.hasPointerCapture?.(event.pointerId)) this.svg.releasePointerCapture(event.pointerId);
            this.svg.classList.remove('is-resizing');
            if (finished.changed) this.commit('resize', { coalesceKey: 'width:' + finished.id });
        };
        this.svg.addEventListener('pointerup', finish);
        this.svg.addEventListener('pointercancel', finish);
    }

    /** @param {number|null} width null clears the manual width. */
    setNodeWidth(id, width) {
        if (!this.map.topic(id)) return;
        this.map.setStyle(id, { width: width === null ? '' : Math.round(width) });
        this.commit(width === null ? 'fit width' : 'resize', { coalesceKey: 'width:' + id });
    }

    onNodeClick(id, event) {
        if (this.relationshipSourceId && this.relationshipSourceId !== id) {
            this.map.addRelationship(this.relationshipSourceId, id);
            this.relationshipSourceId = null;
            this.commit('relationship');
            toast('Relationship added.');
            return;
        }
        if (event.ctrlKey || event.metaKey) this.selection.toggle(id);
        else if (event.shiftKey && this.selection.primaryId) this.selectRange(this.selection.primaryId, id);
        else this.selection.set(id);
    }

    selectRange(fromId, toId) {
        const parent = this.map.parentOf(toId);
        if (!parent || this.map.parentOf(fromId)?.id !== parent.id) {
            this.selection.add(toId);
            return;
        }
        const ids = parent.children;
        const a = ids.indexOf(fromId);
        const b = ids.indexOf(toId);
        this.selection.setMany(ids.slice(Math.min(a, b), Math.max(a, b) + 1), toId);
    }

    onDrop(action) {
        if (action.type === 'reparent') {
            if (this.map.move(action.id, action.parentId)) {
                this.map.setPosition(action.id, null);
                this.commit('move');
            } else {
                toast('A topic cannot be moved inside itself.', 'warn');
            }
            return;
        }
        const topic = this.map.topic(action.id);
        if (!topic) return;
        const current = topic.position || { x: 0, y: 0 };
        this.map.setPosition(action.id, {
            x: Math.round(current.x + action.delta.x),
            y: Math.round(current.y + action.delta.y)
        });
        this.commit('nudge');
    }

    // ------------------------------------------------------- inline editing

    startEditing(id, { initial = null } = {}) {
        const topic = this.map.topic(id);
        const node = this.lastResult?.nodes.get(id);
        if (!topic || !node) return;
        this.cancelEditing();
        this.editingId = id;
        this.selection.set(id);

        const metrics = this.lastResult.metrics.get(id);
        const editor = el('textarea', {
            class: 'mm-inline-editor',
            // The browser's own spell checker is the only one we need.
            spellcheck: 'true',
            rows: '1'
        });
        editor.value = initial !== null ? initial : topic.text;
        this.inlineEditor = editor;
        this.canvasWrap.appendChild(editor);

        const commitText = (keepGoing) => {
            if (this.editingId !== id) return;
            const value = editor.value;
            this.editingId = null;
            editor.remove();
            this.inlineEditor = null;
            if (value !== topic.text) {
                this.map.setText(id, value);
                this.commit('rename');
            } else {
                this.render();
            }
            if (keepGoing) this.run(keepGoing);
        };

        editor.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                this.cancelEditing();
            } else if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                commitText(null);
            } else if (event.key === 'Enter' && event.shiftKey) {
                // Shift+Enter inserts a line break inside the topic.
                event.stopPropagation();
            } else if (event.key === 'Tab') {
                event.preventDefault();
                commitText('add-child');
            }
            event.stopPropagation();
        });
        editor.addEventListener('blur', () => commitText(null));
        editor.addEventListener('input', () => this.positionInlineEditor());

        this.positionInlineEditor(metrics);
        editor.focus();
        if (initial === null) editor.select();
        else editor.setSelectionRange(editor.value.length, editor.value.length);
        this.renderCanvasOnly();
    }

    /**
     * Size and place the inline editor. The box is measured from what is in the
     * textarea *right now* (not from the last laid-out node), so it grows as
     * the user types and the text never wraps inside a box sized for the old
     * text. A few pixels of slack stop the browser wrapping one character
     * earlier than our own measurement did.
     */
    positionInlineEditor(metrics) {
        const editor = this.inlineEditor;
        if (!editor || !this.editingId) return;
        const node = this.lastResult?.nodes.get(this.editingId);
        if (!node) return;
        const m = metrics || this.lastResult.metrics.get(this.editingId);
        const box = textBox(editor.value, m.style, { iconsWidth: m.iconsWidth });
        const width = Math.max(node.width, box.width) + EDITOR_SLACK;
        const height = Math.max(node.height - (m.imageHeight ? m.imageHeight + 6 : 0), box.height);
        const scale = this.viewport.scale;
        // Left-growing branches keep their right edge pinned so the box does
        // not slide over its parent while typing.
        const anchorX = node.side === 'left' ? node.x + node.width - width : node.x;
        const point = this.viewport.toScreen(anchorX, node.y + (m.imageHeight ? m.imageHeight + 6 : 0));
        editor.style.left = point.x + 'px';
        editor.style.top = point.y + 'px';
        editor.style.width = width * scale + 'px';
        editor.style.height = height * scale + 'px';
        editor.style.fontSize = (m.style.fontSize * scale) + 'px';
        editor.style.fontFamily = m.style.fontFamily;
        editor.style.fontWeight = m.style.bold ? '700' : '400';
        editor.style.fontStyle = m.style.italic ? 'italic' : 'normal';
        editor.style.lineHeight = (m.lineHeight * scale) + 'px';
        editor.style.padding = (PAD_Y * scale) + 'px ' + (PAD_X * scale) + 'px';
        editor.style.textAlign = 'left';
    }

    cancelEditing() {
        if (this.inlineEditor) {
            const editor = this.inlineEditor;
            this.inlineEditor = null;
            this.editingId = null;
            editor.remove();
            this.renderCanvasOnly();
        }
    }

    // --------------------------------------------------------- selection ops

    selectTopic(id, { reveal = false } = {}) {
        if (!this.map.topic(id)) return;
        if (reveal) {
            for (const ancestor of this.map.ancestors(id)) {
                if (ancestor.collapsed) this.map.setCollapsed(ancestor.id, false);
            }
            this.render();
        }
        this.selection.set(id);
        if (reveal) this.revealTopic(id);
    }

    revealTopic(id) {
        const node = this.lastResult?.nodes.get(id);
        if (!node) return;
        const size = this.canvas.size();
        const topLeft = this.viewport.toScreen(node.x, node.y);
        const bottomRight = this.viewport.toScreen(node.x + node.width, node.y + node.height);
        const margin = 60;
        const outside = topLeft.x < margin || topLeft.y < margin
            || bottomRight.x > size.width - margin || bottomRight.y > size.height - margin;
        if (outside) {
            this.viewport.centerOn({ x: node.x + node.width / 2, y: node.y + node.height / 2 }, size);
        }
    }

    navigate(direction, extend = false) {
        const id = this.selection.primaryId || this.map.rootId;
        const next = navigateFrom(this.map, this.lastResult, id, direction);
        if (!next) return;
        if (extend) this.selection.add(next);
        else this.selection.set(next);
        this.revealTopic(next);
    }

    // ------------------------------------------------------------- commands

    run(command, arg) {
        const primary = this.selection.primaryId;
        const commands = {
            // --- file
            'new': () => this.newMap(),
            'open': () => this.openMapDialog(),
            'save': () => this.autosave.flush().then(() => toast('Saved to this device.')),
            'import': () => this.importDialog(),
            'export': () => this.exportDialog(),
            'download': () => this.download(arg),
            'print': () => window.print(),
            'duplicate-map': () => this.duplicateMap(),
            'delete-map': () => this.deleteCurrentMap(),

            // --- edit
            'add-child': () => this.addChild(primary),
            'add-sibling': () => this.addSibling(primary),
            'delete': () => this.deleteSelection(),
            'rename': () => primary && this.startEditing(primary),
            'duplicate': () => this.duplicateSelection(),
            'copy': () => this.copySelection(false),
            'cut': () => this.copySelection(true),
            'paste': () => this.pasteClipboard(),
            'undo': () => runUndo(this.history, (state) => this.applyState(state)),
            'redo': () => runRedo(this.history, (state) => this.applyState(state)),
            'select-siblings': () => this.selectSiblings(),
            'select-root': () => this.selectTopic(this.map.rootId, { reveal: true }),
            'select-level': () => this.selectSameLevel(),
            'select-children': () => this.selectChildren(),
            'select-first-sibling': () => this.selectEdgeSibling('first'),
            'select-last-sibling': () => this.selectEdgeSibling('last'),
            'move-up': () => this.reorder(-1),
            'move-down': () => this.reorder(1),
            'move-top': () => this.moveToEdge('top'),
            'move-bottom': () => this.moveToEdge('bottom'),
            'add-sibling-before': () => this.addSiblingBefore(primary),
            'insert-parent': () => this.insertParent(primary),
            'add-multiple': () => this.addMultiple(primary),
            'delete-only': () => this.deleteOnly(),
            'copy-style': () => this.copyStyle(),
            'paste-style': () => this.pasteStyle(),
            'numbering': () => this.setNumbering(arg || ''),

            // --- view
            'zoom-in': () => this.zoom(1),
            'zoom-out': () => this.zoom(-1),
            'zoom-reset': () => this.zoomReset(),
            'fit': () => this.fit(),
            'center': () => this.centerMap(),
            'layout': () => this.setLayout(arg),
            'theme': () => this.setTheme(arg),
            'toggle-dark': () => this.toggleDarkMode(),
            'toggle-sidebar': () => this.togglePane('sidebar'),
            'toggle-properties': () => this.togglePane('properties'),
            'panel': () => { this.openPane('sidebar'); this.sidebar.showPanel(arg); },
            'search': () => { this.openPane('sidebar'); this.sidebar.focusSearch(); },
            'collapse-all': () => this.setAllCollapsed(true),
            'expand-all': () => this.setAllCollapsed(false),
            'level': () => this.showLevel(arg),
            'focus-branch': () => this.toggleFocus(primary),
            'drill-down': () => this.drillDown(primary),
            'drill-up': () => this.drillUp(),
            'toggle-collapse': () => primary && this.toggleCollapse(primary),

            // --- insert
            'edit-note': () => this.editNote(primary),
            'add-link': () => this.addLink(primary, arg),
            'add-image': () => this.addImage(primary),
            'add-tag': () => this.addTag(primary),
            'start-relationship': () => this.startRelationship(primary),
            'toggle-boundary': () => this.toggleBoundary(primary),

            // --- help
            'help': () => this.helpDialog(),
            'escape': () => this.onEscape()
        };
        const handler = commands[command];
        if (handler) handler();
        else if (command) toast('Unknown action: ' + command, 'warn');
    }

    /** Ids to draw faded: everything outside the focused branch. */
    dimmedIds() {
        if (!this.focusBranchId || !this.map.topic(this.focusBranchId)) return null;
        const keep = new Set([
            this.focusBranchId,
            ...this.map.descendants(this.focusBranchId).map((t) => t.id),
            ...this.map.ancestors(this.focusBranchId).map((t) => t.id)
        ]);
        const dimmed = new Set();
        for (const { topic } of this.map.walk(true)) if (!keep.has(topic.id)) dimmed.add(topic.id);
        return dimmed;
    }

    /** F3: fade everything outside the selected branch, keeping it in context. */
    toggleFocus(id) {
        const target = id || this.selection.primaryId;
        if (!target) return;
        this.focusBranchId = this.focusBranchId === target ? null : target;
        this.renderCanvasOnly();
        this.toolbar.update();
    }

    /** F4: make the selected topic the temporary root; F4 again goes deeper. */
    drillDown(id) {
        const target = id || this.selection.primaryId;
        if (!target || !this.map.childrenOf(target).length) {
            toast('Pick a topic with sub-topics to drill into.', 'warn');
            return;
        }
        this.drillId = target;
        this.focusBranchId = null;
        this.render();
        this.fit();
    }

    /** Back up one level, or all the way out of drill-down. */
    drillUp(all = false) {
        if (!this.drillId) return;
        const parent = all ? null : this.map.parentOf(this.drillId);
        this.drillId = parent && parent.id !== this.map.rootId ? parent.id : null;
        this.render();
        this.fit();
    }

    /** Alt+1..9 / Alt+0: show the map down to a given depth and no further. */
    showLevel(level) {
        const depth = Number(level);
        const target = Number.isFinite(depth) ? Math.max(0, depth) : 0;
        const max = this.map.depth;
        if (this.map.collapseToLevel(target >= max ? Number.MAX_SAFE_INTEGER : target)) {
            this.commit('show level ' + target);
        }
        toast(target >= max ? 'All levels shown.' : 'Showing level ' + target + '.');
    }

    copyStyle() {
        const topic = this.selection.primaryId && this.map.topic(this.selection.primaryId);
        if (!topic) return;
        this.styleClipboard = { ...topic.style };
        toast('Style copied — select topics and press Ctrl+Shift+V.');
    }

    pasteStyle() {
        if (!this.styleClipboard) { toast('Copy a style first (Ctrl+Shift+C).', 'warn'); return; }
        const ids = this.selection.toArray();
        if (!ids.length) return;
        for (const id of ids) {
            const topic = this.map.topic(id);
            if (topic) topic.style = { ...this.styleClipboard };
        }
        this.commit('paste style');
    }

    /** Ctrl+M: one indented list in, a whole branch out. */
    async addMultiple(id) {
        const parentId = id || this.selection.primaryId || this.map.rootId;
        const text = await promptDialog({
            title: 'Add several topics',
            label: 'One topic per line. Indent with a tab or two spaces to nest.',
            value: '',
            multiline: true,
            placeholder: 'Causes\n    Treaty of Versailles\n    Great Depression\nMajor events'
        });
        if (text === null || !text.trim()) return;
        const created = [];
        // A stack of the last topic seen at each indent level.
        const stack = [{ indent: -1, id: parentId }];
        for (const rawLine of text.split(/\r?\n/)) {
            const line = rawLine.replace(/\t/g, '    ');
            const label = line.trim().replace(/^[-*•]\s*/, '');
            if (!label) continue;
            const indent = line.length - line.trimStart().length;
            while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
            const topic = this.map.addChild(stack[stack.length - 1].id, label.slice(0, 4000));
            if (!topic) continue;
            created.push(topic.id);
            stack.push({ indent, id: topic.id });
        }
        if (!created.length) return;
        this.commit('add topics');
        this.selection.setMany(created);
        this.revealTopic(created[0]);
        toast(created.length + ' topics added.');
    }

    setNumbering(value) {
        const ids = this.selection.toArray();
        if (!ids.length) return;
        for (const id of ids) this.map.setNumbering(id, value);
        this.commit('numbering');
    }

    /** Find & replace across topic text. Returns the number of topics changed. */
    replaceAll(find, replacement) {
        const needle = String(find || '');
        if (!needle) return 0;
        let changed = 0;
        for (const topic of Object.values(this.map.topics)) {
            if (!topic.text.includes(needle)) continue;
            this.map.setText(topic.id, topic.text.split(needle).join(String(replacement == null ? '' : replacement)));
            changed += 1;
        }
        if (changed) this.commit('replace');
        return changed;
    }

    insertParent(id) {
        const target = id || this.selection.primaryId;
        if (!target) return;
        const created = this.map.insertParent(target, '');
        if (!created) { toast('The central topic has no parent to insert above.', 'warn'); return; }
        this.commit('insert parent');
        this.selection.set(created.id);
        this.startEditing(created.id);
    }

    addSiblingBefore(id) {
        const target = id || this.selection.primaryId;
        if (!target) return;
        const topic = this.map.addSiblingBefore(target, '');
        if (!topic) return;
        this.commit('add topic');
        this.selection.set(topic.id);
        this.startEditing(topic.id);
    }

    /** Shift+Del: drop this topic but keep its children, one level up. */
    deleteOnly() {
        const ids = this.selection.toArray().filter((id) => id !== this.map.rootId);
        if (!ids.length) {
            if (this.selection.has(this.map.rootId)) toast('The central topic cannot be deleted.', 'warn');
            return;
        }
        const fallback = this.map.parentOf(ids[0])?.id || this.map.rootId;
        let removed = 0;
        for (const id of ids) if (this.map.removeOnly(id)) removed += 1;
        if (!removed) return;
        this.selection.set(this.map.topic(fallback) ? fallback : this.map.rootId);
        this.commit('delete topic only');
    }

    moveToEdge(edge) {
        const id = this.selection.primaryId;
        if (id && this.map.moveToEdge(id, edge)) this.commit('reorder');
    }

    selectSameLevel() {
        const id = this.selection.primaryId;
        if (!id) return;
        const depth = this.map.depthOf(id);
        const ids = this.map.walk(true)
            .filter(({ topic }) => this.map.depthOf(topic.id) === depth)
            .map(({ topic }) => topic.id);
        this.selection.setMany(ids, id);
    }

    selectChildren() {
        const ids = this.selection.toArray().flatMap((id) => this.map.childrenOf(id).map((t) => t.id));
        if (ids.length) this.selection.setMany(ids);
    }

    selectEdgeSibling(edge) {
        const id = this.selection.primaryId;
        const parent = id && this.map.parentOf(id);
        if (!parent || !parent.children.length) return;
        this.selection.set(edge === 'first' ? parent.children[0] : parent.children[parent.children.length - 1]);
    }

    onEscape() {
        if (this.editingId) { this.cancelEditing(); return; }
        if (this.focusBranchId) { this.focusBranchId = null; this.renderCanvasOnly(); return; }
        if (this.drillId) { this.drillUp(true); return; }
        if (this.relationshipSourceId) {
            this.relationshipSourceId = null;
            this.properties.render();
            return;
        }
        if (this.searchQuery) { this.setSearch(''); this.render(); return; }
        this.selection.clear();
    }

    addChild(id) {
        const parentId = id || this.selection.primaryId || this.map.rootId;
        const topic = this.map.addChild(parentId, '');
        if (!topic) return;
        this.commit('add topic');
        this.selection.set(topic.id);
        this.revealTopic(topic.id);
        this.startEditing(topic.id);
    }

    addSibling(id) {
        if (!id) return this.addChild(this.map.rootId);
        const topic = this.map.addSibling(id, '');
        if (!topic) return undefined;
        this.commit('add topic');
        this.selection.set(topic.id);
        this.revealTopic(topic.id);
        this.startEditing(topic.id);
        return undefined;
    }

    async deleteSelection() {
        const ids = this.selection.toArray().filter((id) => id !== this.map.rootId);
        if (!ids.length) {
            if (this.selection.has(this.map.rootId)) toast('The central topic cannot be deleted.', 'warn');
            return;
        }
        const withChildren = ids.filter((id) => this.map.topic(id)?.children.length);
        if (withChildren.length) {
            const ok = await confirmDialog({
                title: 'Delete topic',
                message: ids.length === 1
                    ? 'This topic has sub-topics. Delete it and everything under it?'
                    : 'Delete ' + ids.length + ' topics and everything under them?',
                confirmLabel: 'Delete'
            });
            if (!ok) return;
        }
        const fallback = this.map.parentOf(ids[0])?.id || this.map.rootId;
        for (const id of ids) this.map.remove(id);
        this.selection.set(this.map.topic(fallback) ? fallback : this.map.rootId);
        this.commit('delete');
    }

    duplicateSelection() {
        const ids = this.selection.toArray().filter((id) => id !== this.map.rootId);
        if (!ids.length) return;
        const created = ids.map((id) => this.map.duplicate(id)).filter(Boolean);
        if (!created.length) return;
        this.commit('duplicate');
        this.selection.setMany(created.map((t) => t.id));
    }

    copySelection(cut) {
        const ids = this.selection.toArray().filter((id) => !cut || id !== this.map.rootId);
        if (!ids.length) return;
        this.clipboard = ids.map((id) => this.map.exportSubtree(id)).filter(Boolean);
        const text = this.clipboard.map((node) => outlineToText(node, 0)).join('\n');
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(() => {});
        }
        if (cut) {
            const fallback = this.map.parentOf(ids[0])?.id || this.map.rootId;
            for (const id of ids) this.map.remove(id);
            this.selection.set(fallback);
            this.commit('cut');
        } else {
            toast(ids.length === 1 ? 'Topic copied.' : ids.length + ' topics copied.');
        }
    }

    pasteClipboard() {
        const parentId = this.selection.primaryId || this.map.rootId;
        if (!this.clipboard || !this.clipboard.length) {
            toast('Nothing to paste yet.', 'warn');
            return;
        }
        const created = this.clipboard
            .map((node) => this.map.copySubtreeInto(node, parentId, null))
            .filter(Boolean);
        if (!created.length) return;
        this.commit('paste');
        this.selection.setMany(created.map((t) => t.id));
    }

    /** Pasting text from outside the app imports it as a sub-tree. */
    onPaste(event) {
        if (this.editingId) return;
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
        if (this.clipboard && this.clipboard.length) return; // internal clipboard wins
        const text = event.clipboardData && event.clipboardData.getData('text/plain');
        if (!text || !text.trim()) return;
        event.preventDefault();
        const parentId = this.selection.primaryId || this.map.rootId;
        try {
            const imported = importString(text, { fileName: 'pasted.txt' });
            const outline = JSON.parse(exportOutline(MindMap.fromState(imported.document.map)));
            const created = this.map.copySubtreeInto(fromOutlineNode(outline), parentId, null);
            if (created) {
                this.commit('paste');
                this.selection.set(created.id);
            }
        } catch {
            const topic = this.map.addChild(parentId, text.trim().slice(0, 4000));
            if (topic) { this.commit('paste'); this.selection.set(topic.id); }
        }
    }

    selectSiblings() {
        const id = this.selection.primaryId;
        if (!id) { this.selection.setMany(this.map.walk(true).map(({ topic }) => topic.id)); return; }
        const parent = this.map.parentOf(id);
        if (!parent) { this.selection.setMany(this.map.walk(true).map(({ topic }) => topic.id)); return; }
        this.selection.setMany(parent.children, id);
    }

    reorder(delta) {
        const id = this.selection.primaryId;
        if (!id) return;
        if (this.map.reorder(id, delta)) this.commit('reorder');
    }

    toggleCollapse(id) {
        if (this.map.toggleCollapse(id)) this.commit('collapse', { coalesceKey: null });
    }

    setAllCollapsed(collapsed) {
        for (const { topic } of this.map.walk(false)) {
            if (topic.id !== this.map.rootId) this.map.setCollapsed(topic.id, collapsed);
        }
        this.commit(collapsed ? 'collapse all' : 'expand all');
    }

    renameTopic(id, text, { coalesce = true } = {}) {
        const topic = this.map.topic(id);
        if (!topic || topic.text === text) return;
        this.map.setText(id, text);
        this.commit('rename', { coalesceKey: coalesce ? 'rename:' + id : null });
    }

    // ------------------------------------------------------------- styling

    styleSelection(patch) {
        const ids = this.selection.toArray();
        if (!ids.length) return;
        for (const id of ids) this.map.setStyle(id, patch);
        this.commit('style', { coalesceKey: 'style:' + Object.keys(patch).join(',') });
    }

    resetStyle() {
        for (const id of this.selection.toArray()) {
            const topic = this.map.topic(id);
            if (topic) topic.style = {};
        }
        this.commit('reset style');
    }

    resetPosition() {
        for (const id of this.selection.toArray()) this.map.setPosition(id, null);
        this.commit('reset position');
    }

    toggleIcon(id, icon) {
        const topic = this.map.topic(id);
        if (!topic) return;
        const next = topic.icons.includes(icon)
            ? topic.icons.filter((existing) => existing !== icon)
            : [...topic.icons, icon];
        this.map.setIcons(id, next);
        this.commit('icons');
    }

    setTags(id, tags) {
        this.map.setTags(id, tags);
        this.commit('tags');
    }

    setLinks(id, links) {
        this.map.setLinks(id, links);
        this.commit('links');
    }

    setImage(id, image) {
        this.map.setImage(id, image);
        this.commit('image');
    }

    async editNote(id) {
        if (!id) return;
        const topic = this.map.topic(id);
        const value = await promptDialog({
            title: 'Note',
            label: 'Notes for "' + (topic.text || 'this topic') + '"',
            value: topic.note,
            multiline: true,
            confirmLabel: 'Save note'
        });
        if (value === null) return;
        this.map.setNote(id, value);
        this.commit('note');
    }

    async addLink(id, label) {
        if (!id) return;
        const url = await promptDialog({
            title: 'Add link',
            label: 'Web address (https://…)',
            placeholder: 'https://example.com',
            confirmLabel: 'Add link'
        });
        if (url === null) return;
        const topic = this.map.topic(id);
        const next = [...topic.links, { url, label: asText(label, 120) }];
        this.map.setLinks(id, next);
        if (this.map.topic(id).links.length === topic.links.length) {
            toast('That link could not be used — only http and https addresses are allowed.', 'warn');
            return;
        }
        this.commit('link');
    }

    async addTag(id) {
        if (!id) return;
        const tag = await promptDialog({ title: 'Add tag', label: 'Tag', confirmLabel: 'Add tag' });
        if (!tag) return;
        const topic = this.map.topic(id);
        this.map.setTags(id, [...topic.tags, tag]);
        this.commit('tag');
    }

    addImage(id) {
        if (!id) return;
        const input = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp' });
        input.addEventListener('change', async () => {
            const file = input.files && input.files[0];
            if (!file) return;
            if (file.size > MAX_IMAGE_BYTES) {
                toast('Please use an image under 2 MB — big images make the map slow to save.', 'warn');
                return;
            }
            try {
                const dataUrl = await readAsDataURL(file);
                const src = safeImageSrc(dataUrl);
                if (!src) throw new Error('unsupported');
                const size = await imageSize(src);
                const width = Math.min(200, size.width);
                this.map.setImage(id, {
                    src,
                    width,
                    height: Math.round(size.height * (width / size.width)),
                    alt: file.name
                });
                this.commit('image');
            } catch {
                toast('That image could not be added.', 'error');
            }
        });
        input.click();
    }

    startRelationship(id) {
        if (!id) return;
        this.relationshipSourceId = this.relationshipSourceId === id ? null : id;
        this.properties.render();
        if (this.relationshipSourceId) toast('Now click the topic to connect to.');
    }

    toggleBoundary(id) {
        if (!id) return;
        const existing = this.map.boundaries.find((b) => b.topicId === id);
        if (existing) this.map.removeBoundary(existing.id);
        else this.map.addBoundary(id);
        this.commit('boundary');
    }

    // ----------------------------------------------------------------- view

    zoom(direction) {
        const size = this.canvas.size();
        this.viewport.zoomStep(direction, size.width / 2, size.height / 2);
    }

    zoomReset() {
        const size = this.canvas.size();
        this.viewport.zoomAt(size.width / 2, size.height / 2, 1);
    }

    fit() {
        if (!this.lastResult) this.render();
        this.viewport.fit(this.lastResult.bounds, this.canvas.size());
    }

    centerMap() {
        const root = this.lastResult?.nodes.get(this.map.rootId);
        if (!root) return;
        this.viewport.centerOn({ x: root.x + root.width / 2, y: root.y + root.height / 2 }, this.canvas.size());
    }

    setLayout(layout) {
        if (!LAYOUTS.includes(layout)) return;
        this.doc.view.layout = layout;
        this.render();
        this.autosave.schedule();
        toast(LAYOUT_LABELS[layout] + ' layout');
    }

    setTheme(theme) {
        if (!THEMES[theme]) return;
        this.doc.view.theme = theme;
        this.render();
        this.autosave.schedule();
    }

    async toggleDarkMode() {
        const next = document.documentElement.dataset.theme !== 'dark';
        document.documentElement.dataset.theme = next ? 'dark' : 'light';
        await setPref('darkMode', next);
    }

    /**
     * Panes carry two classes in lockstep: `is-X-hidden` (read by the desktop
     * grid) and `is-X-open` (read by the overlay breakpoints), so one toggle
     * means the same thing at every width.
     */
    togglePane(which) {
        const shell = qs('.mm-shell', this.root);
        if (!shell) return;
        const hidden = shell.classList.toggle('is-' + which + '-hidden');
        shell.classList.toggle('is-' + which + '-open', hidden);
        this.renderCanvasOnly();
    }

    openPane(which) {
        const shell = qs('.mm-shell', this.root);
        if (!shell) return;
        shell.classList.remove('is-' + which + '-hidden');
        shell.classList.add('is-' + which + '-open');
    }

    setTitle(title) {
        const next = asText(title, 200).trim() || 'Untitled Mind Map';
        this.doc.meta.title = next;
        document.title = next + ' — OpenMind';
        this.toolbar.update();
        this.autosave.schedule();
    }

    setSearch(query) {
        this.searchQuery = query || '';
        this.searchResults = this.searchQuery.trim() ? this.map.search(this.searchQuery) : [];
        this.matches = new Set(this.searchResults.map((r) => r.id));
        this.renderCanvasOnly();
    }

    // ------------------------------------------------------------ documents

    async newMap() {
        await this.autosave.flush();
        const template = await this.templateDialog();
        if (template === null) return;
        const doc = await loadTemplate(template);
        this.setDocument(doc, { fresh: true });
        await setPref('lastOpenId', doc.meta.id);
        await recordOpen(doc.meta.id);
        this.fit();
        this.selectTopic(this.map.rootId);
        this.autosave.schedule();
    }

    async templateDialog() {
        const templates = await listTemplates();
        const list = el('div', { class: 'mm-template-grid' });
        let chosen = 'blank';
        for (const template of templates) {
            const card = el('button', {
                type: 'button',
                class: 'mm-template-card' + (template.id === chosen ? ' is-active' : ''),
                onclick: () => {
                    chosen = template.id;
                    list.querySelectorAll('.mm-template-card').forEach((n) => n.classList.remove('is-active'));
                    card.classList.add('is-active');
                }
            },
            el('span', { class: 'mm-template-icon', 'aria-hidden': 'true', text: template.icon || '⭕' }),
            el('span', { class: 'mm-template-name', text: template.name }),
            el('span', { class: 'mm-template-desc', text: template.description || '' }));
            list.appendChild(card);
        }
        const result = await openDialog({
            title: 'New mind map',
            body: list,
            size: 'wide',
            actions: [
                { label: 'Cancel', value: null },
                { label: 'Create', value: () => chosen, primary: true }
            ]
        });
        return result;
    }

    async openMapDialog() {
        await this.autosave.flush();
        const maps = await listMaps();
        if (!maps.length) {
            await alertDialog({ title: 'No saved maps', message: 'Nothing is saved on this device yet.' });
            return;
        }
        const list = el('div', { class: 'mm-open-list' });
        let chosen = null;
        for (const record of maps) {
            const row = el('button', {
                type: 'button',
                class: 'mm-open-row',
                onclick: () => {
                    chosen = record.id;
                    list.querySelectorAll('.mm-open-row').forEach((n) => n.classList.remove('is-active'));
                    row.classList.add('is-active');
                }
            },
            el('span', { class: 'mm-open-title', text: record.title }),
            el('span', { class: 'mm-open-meta', text: (record.topicCount || 0) + ' topics · ' + relativeTime(record.updatedAt) }));
            list.appendChild(row);
        }
        const id = await openDialog({
            title: 'Open a map',
            body: list,
            actions: [
                { label: 'Cancel', value: null },
                { label: 'Open', value: () => chosen || undefined, primary: true }
            ]
        });
        if (!id) return;
        const stored = await loadMap(id);
        if (!stored) { toast('That map could not be loaded.', 'error'); return; }
        this.setDocument(parseDocument(stored), { fresh: true });
        await recordOpen(id);
        await setPref('lastOpenId', id);
        this.fit();
        this.selectTopic(this.map.rootId);
    }

    async duplicateMap() {
        const copy = parseDocument(JSON.parse(JSON.stringify(this.snapshotDocument())));
        copy.meta.id = uid('map');
        copy.meta.title = this.doc.meta.title + ' (copy)';
        this.setDocument(copy, { fresh: true });
        await this.autosave.flush();
        await recordOpen(copy.meta.id);
        await setPref('lastOpenId', copy.meta.id);
        toast('Copy created.');
    }

    async deleteCurrentMap() {
        const ok = await confirmDialog({
            title: 'Delete this map',
            message: 'Delete "' + this.doc.meta.title + '" from this device? This cannot be undone.',
            confirmLabel: 'Delete map'
        });
        if (!ok) return;
        this.autosave.cancel();
        await deleteMap(this.doc.meta.id);
        const doc = createDocument({ title: 'Untitled Mind Map', rootText: 'Central Topic' });
        this.setDocument(doc, { fresh: true });
        await setPref('lastOpenId', doc.meta.id);
        this.fit();
        toast('Map deleted.');
    }

    importDialog() {
        const input = el('input', { type: 'file', accept: ACCEPTED });
        input.addEventListener('change', async () => {
            const file = input.files && input.files[0];
            if (!file) return;
            try {
                const { document: doc } = await importFile(file);
                await this.autosave.flush();
                this.setDocument(doc, { fresh: true });
                await recordOpen(doc.meta.id);
                await setPref('lastOpenId', doc.meta.id);
                this.fit();
                this.selectTopic(this.map.rootId);
                this.autosave.schedule();
                toast('Imported ' + this.map.size + ' topics.');
            } catch (error) {
                await alertDialog({ title: 'Could not import', message: error.message || 'That file could not be read.' });
            }
        });
        input.click();
    }

    async exportDialog() {
        const list = el('div', { class: 'mm-export-list' });
        let chosen = 'png';
        for (const format of FORMATS) {
            const row = el('button', {
                type: 'button',
                class: 'mm-export-row' + (format.id === chosen ? ' is-active' : ''),
                onclick: () => {
                    chosen = format.id;
                    list.querySelectorAll('.mm-export-row').forEach((n) => n.classList.remove('is-active'));
                    row.classList.add('is-active');
                }
            },
            el('span', { class: 'mm-export-label', text: format.label }),
            el('span', { class: 'mm-export-hint', text: format.hint }));
            list.appendChild(row);
        }
        const format = await openDialog({
            title: 'Export',
            body: list,
            actions: [
                { label: 'Cancel', value: null },
                { label: 'Download', value: () => chosen, primary: true }
            ]
        });
        if (format) this.download(format);
    }

    async download(format) {
        if (!format) return;
        const note = toast('Preparing your ' + format.toUpperCase() + '…', 'info', 10000);
        try {
            await downloadExport(format, this.map, this.snapshotDocument(), {
                result: format === 'svg' || format === 'png' || format === 'pdf' ? this.exportResult() : undefined
            });
            note.remove();
            toast('Downloaded.');
        } catch (error) {
            note.remove();
            await alertDialog({ title: 'Export failed', message: error.message || 'Something went wrong.' });
        }
    }

    /**
     * A clean layout for export: same settings, no selection state. While
     * drilled into a branch, that branch is what gets exported — the status
     * bar shows the drill state, so this matches what is on screen.
     */
    exportResult() {
        return calculate(this.map, {
            layout: this.doc.view.layout,
            theme: this.doc.view.theme,
            rootId: this.drillId
        });
    }

    // ------------------------------------------------------------ menus etc.

    openTopicMenu(x, y) {
        const id = this.selection.primaryId;
        const topic = this.map.topic(id);
        if (!topic) return;
        const isRoot = id === this.map.rootId;
        openContextMenu(x, y, [
            { label: 'Add child topic', icon: '➕', hint: 'Tab', onSelect: () => this.run('add-child') },
            { label: 'Add sibling topic', icon: '↳', hint: 'Enter', disabled: isRoot, onSelect: () => this.run('add-sibling') },
            { label: 'Add several topics…', icon: '☰', hint: 'Ctrl+M', onSelect: () => this.run('add-multiple') },
            { label: 'Insert parent topic', icon: '↑', hint: 'Shift+Ins', disabled: isRoot, onSelect: () => this.run('insert-parent') },
            null,
            { label: 'Rename', icon: '✏', hint: 'F2', onSelect: () => this.run('rename') },
            { label: topic.note ? 'Edit note' : 'Add note', icon: '\u{1F5D2}', onSelect: () => this.run('edit-note') },
            { label: 'Add link', icon: '\u{1F517}', onSelect: () => this.run('add-link') },
            { label: 'Add image', icon: '\u{1F5BC}', onSelect: () => this.run('add-image') },
            null,
            { label: 'Duplicate', icon: '⧉', hint: 'Ctrl+D', disabled: isRoot, onSelect: () => this.run('duplicate') },
            { label: 'Copy', icon: '⎘', hint: 'Ctrl+C', onSelect: () => this.run('copy') },
            { label: 'Paste', icon: '\u{1F4CB}', hint: 'Ctrl+V', onSelect: () => this.run('paste') },
            null,
            { label: topic.collapsed ? 'Expand branch' : 'Collapse branch', icon: '▾', disabled: !topic.children.length, onSelect: () => this.toggleCollapse(id) },
            { label: this.focusBranchId === id ? 'Stop focusing' : 'Focus on this branch', icon: '◎', hint: 'F3', onSelect: () => this.toggleFocus(id) },
            { label: 'Drill down into branch', icon: '⌗', hint: 'F4', disabled: !topic.children.length, onSelect: () => this.drillDown(id) },
            { label: 'Draw relationship', icon: '↗', onSelect: () => this.run('start-relationship') },
            { label: 'Toggle boundary', icon: '⬚', onSelect: () => this.run('toggle-boundary') },
            null,
            { label: 'Delete topic', icon: '\u{1F5D1}', hint: 'Del', danger: true, disabled: isRoot, onSelect: () => this.run('delete') },
            { label: 'Delete, keep sub-topics', icon: '✂', hint: 'Shift+Del', danger: true, disabled: isRoot, onSelect: () => this.run('delete-only') }
        ]);
    }

    openCanvasMenu(x, y) {
        openContextMenu(x, y, [
            { label: 'Add topic to centre', icon: '➕', onSelect: () => this.addChild(this.map.rootId) },
            { label: 'Paste', icon: '\u{1F4CB}', onSelect: () => this.run('paste') },
            null,
            { label: 'Fit to screen', icon: '⛶', onSelect: () => this.run('fit') },
            { label: 'Centre map', icon: '⌖', hint: 'Home', onSelect: () => this.run('center') },
            { label: 'Expand all', icon: '▾', hint: 'Alt+0', onSelect: () => this.run('expand-all') },
            { label: 'Collapse all', icon: '▸', onSelect: () => this.run('collapse-all') },
            { label: 'Show level 1', icon: '1⃣', hint: 'Alt+1', onSelect: () => this.run('level', 1) },
            { label: 'Show level 2', icon: '2⃣', hint: 'Alt+2', onSelect: () => this.run('level', 2) },
            null,
            { label: 'Export…', icon: '⬇', hint: 'Ctrl+E', onSelect: () => this.run('export') },
            { label: 'Keyboard shortcuts', icon: '⌨', onSelect: () => this.run('help') }
        ]);
    }

    helpDialog() {
        const list = el('dl', { class: 'mm-shortcut-list' });
        for (const [keys, action] of SHORTCUTS) {
            list.appendChild(el('dt', {}, el('kbd', { text: keys })));
            list.appendChild(el('dd', { text: action }));
        }
        return openDialog({
            title: 'Keyboard shortcuts',
            body: list,
            size: 'wide',
            actions: [{ label: 'Close', value: true, primary: true }]
        });
    }
}

// ------------------------------------------------------------------ helpers

function outlineToText(node, depth) {
    const lines = ['  '.repeat(depth) + (node.text || '')];
    for (const child of node.children || []) lines.push(outlineToText(child, depth + 1));
    return lines.join('\n');
}

/** { text, children } straight from exportOutline -> the shape copySubtreeInto wants. */
function fromOutlineNode(node) {
    return {
        text: node.text || '',
        note: node.note || '',
        icons: node.icons || [],
        tags: node.tags || [],
        links: node.links || [],
        style: {},
        children: (node.children || []).map(fromOutlineNode)
    };
}

function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('read-failed'));
        reader.readAsDataURL(file);
    });
}

function imageSize(src) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth || 160, height: image.naturalHeight || 120 });
        image.onerror = () => reject(new Error('bad-image'));
        image.src = src;
    });
}

export async function bootEditor() {
    const editor = new Editor(document);
    window.OpenMind = { editor, fromOutline, clear };
    await editor.start();
    return editor;
}
