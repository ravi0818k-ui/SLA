/**
 * End-to-end-ish test of the editor shell in jsdom: boot the real Editor
 * against the real editor.html, then drive it through `run()` the way the
 * toolbar, menus and keyboard do.
 *
 * jsdom has no IndexedDB, so storage falls back to localStorage — which is
 * exactly the path a private window takes, so it is worth covering.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Editor } from '../../mindmap/src/app.js';

function loadEditorPage() {
    const html = readFileSync(resolve(__dirname, '../../mindmap/editor.html'), 'utf-8');
    document.documentElement.innerHTML = html
        .replace(/<!DOCTYPE html>/i, '')
        .replace(/<\/?html[^>]*>/gi, '');
    document.body.setAttribute('data-page', 'mindmap-editor');
}

async function boot() {
    loadEditorPage();
    const editor = new Editor(document);
    await editor.start();
    return editor;
}

function nodeIds(editor) {
    return Array.from(document.querySelectorAll('.mm-nodes .mm-node')).map((n) => n.dataset.id);
}

describe('Editor shell', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it('renders the root topic onto the SVG canvas', async () => {
        const editor = await boot();
        expect(document.querySelector('#mm-canvas .mm-viewport')).toBeTruthy();
        expect(nodeIds(editor)).toEqual([editor.map.rootId]);
        expect(document.querySelector('.mm-node-text').textContent).toContain('Central Topic');
    });

    it('adds a child topic and draws its branch', async () => {
        const editor = await boot();
        editor.run('add-child');
        expect(editor.map.size).toBe(2);
        expect(nodeIds(editor)).toHaveLength(2);
        expect(document.querySelectorAll('.mm-edges .mm-edge')).toHaveLength(1);
    });

    it('opens an inline editor on the new topic, and commits on Enter', async () => {
        const editor = await boot();
        editor.run('add-child');
        const input = document.querySelector('.mm-inline-editor');
        expect(input).toBeTruthy();

        input.value = 'Photosynthesis';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

        expect(editor.map.topic(editor.selection.primaryId).text).toBe('Photosynthesis');
        expect(document.querySelector('.mm-inline-editor')).toBeNull();
    });

    it('undoes and redoes a change', async () => {
        const editor = await boot();
        editor.run('add-child');
        editor.cancelEditing();
        expect(editor.map.size).toBe(2);

        editor.run('undo');
        expect(editor.map.size).toBe(1);
        editor.run('redo');
        expect(editor.map.size).toBe(2);
    });

    it('keeps the outline panel in step with the canvas', async () => {
        const editor = await boot();
        editor.run('add-child');
        editor.cancelEditing();
        editor.renameTopic(editor.selection.primaryId, 'Cell Biology', { coalesce: false });

        const outlineText = Array.from(document.querySelectorAll('.mm-outline-text')).map((n) => n.textContent);
        expect(outlineText).toContain('Cell Biology');
        expect(outlineText).toHaveLength(editor.map.size);
    });

    it('never deletes the root topic', async () => {
        const editor = await boot();
        editor.selectTopic(editor.map.rootId);
        await editor.deleteSelection();
        expect(editor.map.topic(editor.map.rootId)).toBeTruthy();
    });

    it('collapses a branch and hides its children from the canvas', async () => {
        const editor = await boot();
        const branch = editor.map.addChild(editor.map.rootId, 'Branch');
        editor.map.addChild(branch.id, 'Leaf');
        editor.render();
        expect(nodeIds(editor)).toHaveLength(3);

        editor.toggleCollapse(branch.id);
        expect(nodeIds(editor)).toHaveLength(2);
    });

    it('switches layout and theme through commands', async () => {
        const editor = await boot();
        editor.run('layout', 'org');
        expect(editor.doc.view.layout).toBe('org');
        expect(editor.lastResult.layout).toBe('org');

        editor.run('theme', 'blueprint');
        expect(editor.doc.view.theme).toBe('blueprint');
    });

    it('highlights search matches on the canvas', async () => {
        const editor = await boot();
        const child = editor.map.addChild(editor.map.rootId, 'Mitochondria');
        editor.render();
        editor.setSearch('mito');
        expect(editor.searchResults.map((r) => r.id)).toEqual([child.id]);
        expect(document.querySelector('.mm-node.is-match').dataset.id).toBe(child.id);
    });

    it('styles every selected topic at once', async () => {
        const editor = await boot();
        const a = editor.map.addChild(editor.map.rootId, 'A');
        const b = editor.map.addChild(editor.map.rootId, 'B');
        editor.render();
        editor.selection.setMany([a.id, b.id]);
        editor.styleSelection({ background: '#112233' });
        expect(editor.map.topic(a.id).style.background).toBe('#112233');
        expect(editor.map.topic(b.id).style.background).toBe('#112233');
    });

    it('re-parents on drop, and refuses a drop into its own subtree', async () => {
        const editor = await boot();
        const a = editor.map.addChild(editor.map.rootId, 'A');
        const b = editor.map.addChild(editor.map.rootId, 'B');
        const a1 = editor.map.addChild(a.id, 'A1');
        editor.render();

        editor.onDrop({ type: 'reparent', id: b.id, parentId: a.id });
        expect(editor.map.topic(b.id).parentId).toBe(a.id);

        editor.onDrop({ type: 'reparent', id: a.id, parentId: a1.id });
        expect(editor.map.topic(a.id).parentId).toBe(editor.map.rootId);
    });

    it('stores a manual nudge as an offset on the topic', async () => {
        const editor = await boot();
        const a = editor.map.addChild(editor.map.rootId, 'A');
        editor.render();
        editor.onDrop({ type: 'offset', id: a.id, delta: { x: 30, y: -10 } });
        expect(editor.map.topic(a.id).position).toEqual({ x: 30, y: -10 });

        editor.selection.set(a.id);
        editor.resetPosition();
        expect(editor.map.topic(a.id).position).toBeNull();
    });

    it('copies and pastes a subtree', async () => {
        const editor = await boot();
        const a = editor.map.addChild(editor.map.rootId, 'A');
        editor.map.addChild(a.id, 'A1');
        editor.render();

        editor.selection.set(a.id);
        editor.copySelection(false);
        editor.selection.set(editor.map.rootId);
        editor.pasteClipboard();

        expect(editor.map.size).toBe(5);
        expect(editor.map.childrenOf(editor.map.rootId)).toHaveLength(2);
    });


    it('puts a "+" quick-add button on the focused topic only, and it adds a child', async () => {
        const editor = await boot();
        const a = editor.map.addChild(editor.map.rootId, 'A');
        editor.render();
        editor.selection.set(a.id);

        const buttons = document.querySelectorAll('.mm-nodes .mm-quick-add');
        expect(buttons).toHaveLength(1);
        expect(buttons[0].dataset.quickAdd).toBe(a.id);

        editor.addChild(buttons[0].dataset.quickAdd);
        expect(editor.map.childrenOf(a.id)).toHaveLength(1);
    });

    it('resizes a topic box to a manual width and back to fitting the text', async () => {
        const editor = await boot();
        const a = editor.map.addChild(editor.map.rootId, 'A short one');
        editor.render();
        const auto = editor.lastResult.nodes.get(a.id).width;

        editor.setNodeWidth(a.id, 300);
        expect(editor.map.topic(a.id).style.width).toBe(300);
        expect(editor.lastResult.nodes.get(a.id).width).toBe(300);

        editor.setNodeWidth(a.id, null);
        expect(editor.map.topic(a.id).style.width).toBeUndefined();
        expect(editor.lastResult.nodes.get(a.id).width).toBe(auto);
    });

    it('grows the inline editor as the text grows', async () => {
        const editor = await boot();
        const a = editor.map.addChild(editor.map.rootId, 'A');
        editor.render();
        editor.startEditing(a.id);
        const input = document.querySelector('.mm-inline-editor');
        const narrow = parseFloat(input.style.width);

        input.value = 'A considerably longer topic than before';
        input.dispatchEvent(new Event('input'));
        expect(parseFloat(input.style.width)).toBeGreaterThan(narrow);
        editor.cancelEditing();
    });


    it('shows the map down to a chosen level', async () => {
        const editor = await boot();
        const a = editor.map.addChild(editor.map.rootId, 'A');
        editor.map.addChild(a.id, 'A1');
        editor.render();

        editor.run('level', 1);
        expect(nodeIds(editor)).toEqual([editor.map.rootId, a.id]);

        editor.run('level', 99);
        expect(nodeIds(editor)).toHaveLength(3);
    });

    it('drills into a branch and back out again', async () => {
        const editor = await boot();
        const a = editor.map.addChild(editor.map.rootId, 'A');
        editor.map.addChild(a.id, 'A1');
        editor.map.addChild(editor.map.rootId, 'B');
        editor.render();

        editor.selection.set(a.id);
        editor.run('drill-down');
        expect(editor.drillId).toBe(a.id);
        expect(nodeIds(editor).sort()).toEqual([a.id, editor.map.childrenOf(a.id)[0].id].sort());

        editor.run('escape');
        expect(editor.drillId).toBeNull();
        expect(nodeIds(editor)).toHaveLength(4);
    });

    it('focus dims everything outside the branch without hiding it', async () => {
        const editor = await boot();
        const a = editor.map.addChild(editor.map.rootId, 'A');
        const b = editor.map.addChild(editor.map.rootId, 'B');
        editor.render();

        editor.selection.set(a.id);
        editor.run('focus-branch');
        const nodeClass = (id) => document.querySelector('.mm-nodes [data-id="' + id + '"]').getAttribute('class');
        expect(nodeClass(b.id)).toContain('is-dimmed');
        expect(nodeClass(a.id)).not.toContain('is-dimmed');

        editor.run('escape');
        expect(nodeClass(b.id)).not.toContain('is-dimmed');
    });

    it('copies a style from one topic onto the rest of the selection', async () => {
        const editor = await boot();
        const a = editor.map.addChild(editor.map.rootId, 'A');
        const b = editor.map.addChild(editor.map.rootId, 'B');
        editor.render();

        editor.selection.set(a.id);
        editor.styleSelection({ background: '#ff0000', bold: true });
        editor.run('copy-style');
        editor.selection.set(b.id);
        editor.run('paste-style');

        expect(editor.map.topic(b.id).style.background).toBe('#ff0000');
        expect(editor.map.topic(b.id).style.bold).toBe(true);
    });

    it('deletes a topic but keeps its sub-topics', async () => {
        const editor = await boot();
        const a = editor.map.addChild(editor.map.rootId, 'A');
        const a1 = editor.map.addChild(a.id, 'A1');
        editor.render();

        editor.selection.set(a.id);
        editor.run('delete-only');
        expect(editor.map.topic(a.id)).toBeNull();
        expect(editor.map.topic(a1.id)).toBeTruthy();
        expect(editor.map.parentOf(a1.id).id).toBe(editor.map.rootId);
    });

    it('replaces text across the map and can be undone', async () => {
        const editor = await boot();
        editor.map.addChild(editor.map.rootId, 'water cycle');
        editor.map.addChild(editor.map.rootId, 'water table');
        editor.commit('setup');

        expect(editor.replaceAll('water', 'Water')).toBe(2);
        expect(editor.map.search('Water')).toHaveLength(2);
        editor.run('undo');
        expect(editor.map.search('water cycle')).toHaveLength(1);
    });

    it('draws outline numbers on the node without changing its text', async () => {
        const editor = await boot();
        const a = editor.map.addChild(editor.map.rootId, 'Causes');
        editor.map.setNumbering(editor.map.rootId, 'number');
        editor.render();

        const text = document.querySelector('.mm-nodes [data-id="' + a.id + '"] .mm-node-text').textContent;
        expect(text).toContain('1.');
        expect(text).toContain('Causes');
        expect(editor.map.topic(a.id).text).toBe('Causes');
    });

    it('updates the status bar as autosave runs', async () => {
        const editor = await boot();
        editor.toolbar.setStatus('saving');
        expect(document.querySelector('[data-save-status]').textContent).toContain('Saving');
        editor.toolbar.setStatus('saved', new Date().toISOString());
        expect(document.querySelector('[data-save-status]').textContent).toContain('Saved');
    });

    it('shows the topic count and zoom level', async () => {
        const editor = await boot();
        editor.run('add-child');
        editor.cancelEditing();
        expect(document.querySelector('[data-topic-count]').textContent).toBe('2 topics');
        expect(document.querySelector('[data-zoom-label]').textContent).toMatch(/\d+%/);
    });
});
