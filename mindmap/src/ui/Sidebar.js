/**
 * The left sidebar: Outline, Search and Navigator.
 *
 * The outline and the canvas are two views of the *same* model (requirement
 * 14) — the outline reads from `editor.map` on every render and writes through
 * the same editor commands, so there is no second copy of the tree to keep in
 * sync.
 */
import { el, clear, qs, debounce } from '../util/dom.js';
import { confirmDialog, toast } from './Dialogs.js';

export function initSidebar(editor, root) {
    const outlineHost = qs('[data-outline]', root);
    const searchInput = qs('[data-search-input]', root);
    const searchResults = qs('[data-search-results]', root);
    const searchSummary = qs('[data-search-summary]', root);
    const navigatorHost = qs('[data-navigator]', root);
    const tabs = Array.from(root.querySelectorAll('[data-panel-tab]'));
    const panels = Array.from(root.querySelectorAll('[data-panel]'));

    let query = '';

    function showPanel(name) {
        editor.activePanel = name;
        for (const tab of tabs) {
            const active = tab.dataset.panelTab === name;
            tab.classList.toggle('is-active', active);
            tab.setAttribute('aria-selected', String(active));
        }
        for (const panel of panels) panel.hidden = panel.dataset.panel !== name;
        if (name === 'search') searchInput?.focus();
        render();
    }

    for (const tab of tabs) {
        tab.addEventListener('click', () => showPanel(tab.dataset.panelTab));
    }

    // ------------------------------------------------------------- outline

    function renderOutline() {
        if (!outlineHost) return;
        const list = el('ul', { class: 'mm-outline-list', role: 'tree' });
        const stack = [{ id: editor.map.rootId, host: list }];

        const build = (topicId, parentList, depth) => {
            const topic = editor.map.topic(topicId);
            if (!topic) return;
            const hasChildren = topic.children.length > 0;
            const item = el('li', { class: 'mm-outline-item', role: 'treeitem', dataset: { id: topic.id } });

            const row = el('div', {
                class: 'mm-outline-row' + (editor.selection.has(topic.id) ? ' is-selected' : ''),
                style: { paddingLeft: (depth * 14 + 6) + 'px' },
                onclick: () => editor.selectTopic(topic.id, { reveal: true }),
                ondblclick: () => editor.run('rename')
            });

            row.appendChild(el('button', {
                type: 'button',
                class: 'mm-outline-twisty' + (hasChildren ? '' : ' is-empty') + (topic.collapsed ? ' is-collapsed' : ''),
                'aria-label': topic.collapsed ? 'Expand' : 'Collapse',
                tabindex: '-1',
                onclick: (event) => { event.stopPropagation(); if (hasChildren) editor.toggleCollapse(topic.id); }
            }, hasChildren ? (topic.collapsed ? '▸' : '▾') : '·'));

            if (topic.icons.length) {
                row.appendChild(el('span', { class: 'mm-outline-icons', text: topic.icons.join('') }));
            }

            // Outline numbering mirrors the canvas, which computes it the same
            // way — it is display-only, never part of the topic text.
            const prefix = editor.map.numberPrefix(topic.id);
            if (prefix) row.appendChild(el('span', { class: 'mm-outline-number', text: prefix }));

            const label = el('span', {
                class: 'mm-outline-text',
                contenteditable: 'true',
                spellcheck: 'false',
                role: 'textbox',
                text: topic.text || ''
            });
            label.addEventListener('keydown', (event) => onOutlineKey(event, topic.id, label));
            label.addEventListener('blur', () => {
                const next = label.textContent.trim();
                if (next !== topic.text) editor.renameTopic(topic.id, next, { coalesce: false });
            });
            row.appendChild(label);

            if (topic.note) row.appendChild(el('span', { class: 'mm-outline-badge', title: 'Has a note', text: '✎' }));
            if (topic.links.length) row.appendChild(el('span', { class: 'mm-outline-badge', title: 'Has a link', text: '\u{1F517}' }));

            item.appendChild(row);

            if (hasChildren && !topic.collapsed) {
                const childList = el('ul', { class: 'mm-outline-children', role: 'group' });
                for (const child of editor.map.childrenOf(topic.id)) build(child.id, childList, depth + 1);
                item.appendChild(childList);
            }
            parentList.appendChild(item);
        };

        build(editor.map.rootId, list, 0);
        clear(outlineHost).appendChild(list);
        void stack;
    }

    /** Tab/Enter in the outline do the same thing they do on the canvas. */
    function onOutlineKey(event, id, label) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            label.blur();
            editor.selectTopic(id);
            editor.run('add-sibling');
        } else if (event.key === 'Tab') {
            event.preventDefault();
            label.blur();
            editor.selectTopic(id);
            editor.run('add-child');
        } else if (event.key === 'Escape') {
            event.preventDefault();
            label.textContent = editor.map.topic(id)?.text || '';
            label.blur();
        }
    }

    // -------------------------------------------------------------- search

    const runSearch = debounce(() => {
        query = searchInput ? searchInput.value : '';
        editor.setSearch(query);
        renderSearch();
    }, 140);

    if (searchInput) {
        searchInput.addEventListener('input', runSearch);
        searchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                searchInput.value = '';
                runSearch();
                runSearch.flush();
            }
        });
    }

    // ------------------------------------------------------------- replace

    const replaceInput = qs('[data-replace-input]', root);
    const replaceButton = qs('[data-replace-run]', root);
    if (replaceButton) {
        replaceButton.addEventListener('click', async () => {
            const find = searchInput ? searchInput.value.trim() : '';
            if (!find) { toast('Type what to find first.', 'warn'); return; }
            const count = editor.map.search(find).length;
            if (!count) { toast('Nothing matches “' + find + '”.', 'warn'); return; }
            const ok = await confirmDialog({
                title: 'Replace in topics',
                message: 'Replace “' + find + '” with “' + replaceInput.value + '” in every topic that contains it?',
                confirmLabel: 'Replace all',
                danger: false
            });
            if (!ok) return;
            const changed = editor.replaceAll(find, replaceInput.value);
            toast(changed ? changed + (changed === 1 ? ' topic updated.' : ' topics updated.') : 'No topic text matched.');
        });
    }

    function renderSearch() {
        if (!searchResults) return;
        const matches = editor.searchResults;
        clear(searchResults);
        if (searchSummary) {
            searchSummary.textContent = !query.trim()
                ? 'Search topic text, notes and tags.'
                : matches.length + (matches.length === 1 ? ' match' : ' matches');
        }
        for (const match of matches) {
            const row = el('button', {
                type: 'button',
                class: 'mm-search-hit',
                onclick: () => editor.selectTopic(match.id, { reveal: true })
            },
            el('span', { class: 'mm-search-hit-text', text: match.topic.text || '(untitled)' }),
            el('span', { class: 'mm-search-hit-where', text: match.fields.join(', ') }));
            searchResults.appendChild(row);
        }
    }

    // ----------------------------------------------------------- navigator

    function renderNavigator() {
        if (!navigatorHost || navigatorHost.closest('[data-panel]')?.hidden) return;
        const result = editor.lastResult;
        if (!result) return;
        const bounds = result.bounds;
        const width = 220;
        const height = 150;
        const scale = Math.min(width / (bounds.width || 1), height / (bounds.height || 1)) * 0.86;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
        svg.setAttribute('class', 'mm-navigator-svg');

        const offsetX = width / 2 - (bounds.minX + bounds.width / 2) * scale;
        const offsetY = height / 2 - (bounds.minY + bounds.height / 2) * scale;

        result.nodes.forEach((node, id) => {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', String(node.x * scale + offsetX));
            rect.setAttribute('y', String(node.y * scale + offsetY));
            rect.setAttribute('width', String(Math.max(2, node.width * scale)));
            rect.setAttribute('height', String(Math.max(1.5, node.height * scale)));
            rect.setAttribute('rx', '1.5');
            rect.setAttribute('class', 'mm-navigator-node' + (editor.selection.has(id) ? ' is-selected' : ''));
            svg.appendChild(rect);
        });

        // Viewport rectangle
        const size = editor.canvas.size();
        const topLeft = editor.viewport.toMap(0, 0);
        const view = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        view.setAttribute('x', String(topLeft.x * scale + offsetX));
        view.setAttribute('y', String(topLeft.y * scale + offsetY));
        view.setAttribute('width', String((size.width / editor.viewport.scale) * scale));
        view.setAttribute('height', String((size.height / editor.viewport.scale) * scale));
        view.setAttribute('class', 'mm-navigator-view');
        svg.appendChild(view);

        svg.addEventListener('click', (event) => {
            const box = svg.getBoundingClientRect();
            const x = ((event.clientX - box.left) / box.width) * width;
            const y = ((event.clientY - box.top) / box.height) * height;
            editor.viewport.centerOn({ x: (x - offsetX) / scale, y: (y - offsetY) / scale }, editor.canvas.size());
        });

        clear(navigatorHost).appendChild(svg);
    }

    function render() {
        renderOutline();
        renderSearch();
        renderNavigator();
    }

    return { render, showPanel, focusSearch: () => { showPanel('search'); searchInput?.focus(); searchInput?.select(); } };
}
