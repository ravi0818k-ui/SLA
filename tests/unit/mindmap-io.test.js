/**
 * Import / export, history, and autosave debouncing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MindMap } from '../../mindmap/src/core/MindMap.js';
import { createDocument } from '../../mindmap/src/core/Document.js';
import { parseMarkdown } from '../../mindmap/src/import/Markdown.js';
import { parseText } from '../../mindmap/src/import/Text.js';
import { parseJSON, fromOutline } from '../../mindmap/src/import/JSON.js';
import { importString } from '../../mindmap/src/import/index.js';
import { exportMarkdown } from '../../mindmap/src/export/Markdown.js';
import { exportDocument, exportOutline } from '../../mindmap/src/export/JSON.js';
import { History } from '../../mindmap/src/history/History.js';
import { undo } from '../../mindmap/src/history/Undo.js';
import { redo } from '../../mindmap/src/history/Redo.js';
import { createAutoSave } from '../../mindmap/src/storage/AutoSave.js';

const MARKDOWN = `# JavaScript

## Variables

## Functions

### Arrow Functions

### Normal Functions

## Promises
`;

function tree(map, id = map.rootId) {
    const topic = map.topic(id);
    return { text: topic.text, children: map.childrenOf(id).map((child) => tree(map, child.id)) };
}

describe('Markdown import', () => {
    it('turns the spec example into the documented tree', () => {
        const map = parseMarkdown(MARKDOWN);
        expect(tree(map)).toEqual({
            text: 'JavaScript',
            children: [
                { text: 'Variables', children: [] },
                {
                    text: 'Functions',
                    children: [
                        { text: 'Arrow Functions', children: [] },
                        { text: 'Normal Functions', children: [] }
                    ]
                },
                { text: 'Promises', children: [] }
            ]
        });
    });

    it('nests bullets under the heading above them, by indent', () => {
        const map = parseMarkdown('# Root\n\n## Section\n\n- One\n  - One A\n  - One B\n- Two\n');
        const section = map.childrenOf(map.rootId)[0];
        const bullets = map.childrenOf(section.id);
        expect(bullets.map((t) => t.text)).toEqual(['One', 'Two']);
        expect(map.childrenOf(bullets[0].id).map((t) => t.text)).toEqual(['One A', 'One B']);
    });

    it('reads blockquotes as notes and bare links as links', () => {
        const map = parseMarkdown('# Root\n\n## Topic\n\n> A note about it\n\n[Docs](https://example.com)\n');
        const topic = map.childrenOf(map.rootId)[0];
        expect(topic.note).toBe('A note about it');
        expect(topic.links[0].url).toContain('example.com');
    });

    it('copes with a file that starts at ## and skips levels', () => {
        const map = parseMarkdown('## A\n\n#### Deep\n\n## B\n');
        expect(map.root.text).toBe('A');
        expect(map.childrenOf(map.rootId).map((t) => t.text)).toEqual(['Deep', 'B']);
    });

    it('ignores fenced code blocks', () => {
        const map = parseMarkdown('# Root\n\n```\n# Not a heading\n- not a bullet\n```\n');
        expect(map.size).toBe(1);
    });

    it('strips emphasis and inline link syntax from topic text', () => {
        const map = parseMarkdown('# Root\n\n## **Bold** and [linked](https://x.com)\n');
        expect(map.childrenOf(map.rootId)[0].text).toBe('Bold and linked');
    });
});

describe('Plain text import', () => {
    it('reads indentation as hierarchy', () => {
        const map = parseText('Root\n  A\n    A1\n  B\n');
        expect(tree(map)).toEqual({
            text: 'Root',
            children: [
                { text: 'A', children: [{ text: 'A1', children: [] }] },
                { text: 'B', children: [] }
            ]
        });
    });

    it('wraps several top-level lines in a single root', () => {
        const map = parseText('One\nTwo\nThree\n');
        expect(map.childrenOf(map.rootId).map((t) => t.text)).toEqual(['One', 'Two', 'Three']);
    });

    it('tolerates tree-drawing characters and bullets', () => {
        const map = parseText('Root\n  - A\n    └─ A1\n');
        expect(map.childrenOf(map.rootId)[0].text).toBe('A');
    });
});

describe('JSON import', () => {
    it('reads a nested outline', () => {
        const map = fromOutline({ text: 'Root', children: [{ text: 'A', children: [{ text: 'A1' }] }] });
        expect(map.size).toBe(3);
        expect(map.childrenOf(map.childrenOf(map.rootId)[0].id)[0].text).toBe('A1');
    });

    it('reads a full document and a bare map state', () => {
        const doc = createDocument({ title: 'Doc' });
        expect(parseJSON(JSON.stringify(doc)).document.meta.title).toBe('Doc');
        expect(parseJSON(JSON.stringify(doc.map)).document.map.rootId).toBeTruthy();
    });

    it('refuses JSON that is not a mind map', () => {
        expect(() => parseJSON('{"unrelated":true}')).toThrow(/not a mind map/i);
    });
});

describe('Import dispatcher', () => {
    it('picks the parser from the extension', () => {
        expect(importString('# A\n\n## B\n', { fileName: 'notes.md' }).document.meta.title).toBeTruthy();
        expect(importString('A\n  B\n', { fileName: 'notes.txt' }).document).toBeTruthy();
    });

    it('falls back to text when a .txt file happens to start with a brace', () => {
        const result = importString('{not json\n  child\n', { fileName: 'notes.txt' });
        expect(result.document).toBeTruthy();
    });

    it('still throws for a broken .json file', () => {
        expect(() => importString('{oops', { fileName: 'map.json' })).toThrow();
    });
});

describe('Export', () => {
    it('writes headings then bullets, and reads its own output back', () => {
        const map = parseMarkdown(MARKDOWN);
        const doc = createDocument({ title: 'JavaScript', map });
        const markdown = exportMarkdown(map, doc);
        expect(markdown).toContain('# JavaScript');
        expect(markdown).toContain('## Functions');

        const reimported = parseMarkdown(markdown);
        expect(tree(reimported)).toEqual(tree(map));
    });

    it('keeps notes and links through a Markdown round trip', () => {
        const map = MindMap.create('Root');
        const child = map.addChild(map.rootId, 'Topic');
        map.setNote(child.id, 'Remember this');
        map.setLinks(child.id, [{ url: 'https://example.com', label: 'Docs' }]);
        const doc = createDocument({ title: 'Root', map });

        const back = parseMarkdown(exportMarkdown(map, doc));
        const topic = back.childrenOf(back.rootId)[0];
        expect(topic.note).toContain('Remember this');
        expect(topic.links[0].url).toContain('example.com');
    });

    it('writes a versioned .openmind document that parses back', () => {
        const map = parseMarkdown(MARKDOWN);
        const doc = createDocument({ title: 'JavaScript', map });
        const parsed = parseJSON(exportDocument(map, doc)).document;
        expect(parsed.formatVersion).toBe('1.0');
        expect(MindMap.fromState(parsed.map).size).toBe(map.size);
    });

    it('writes a nested outline that imports back identically', () => {
        const map = parseMarkdown(MARKDOWN);
        const back = fromOutline(JSON.parse(exportOutline(map)));
        expect(tree(back)).toEqual(tree(map));
    });
});

describe('History', () => {
    const stateWith = (text) => ({ rootId: 'r', topics: { r: { id: 'r', text, children: [] } } });

    it('undoes and redoes in order', () => {
        const history = new History();
        history.reset(stateWith('one'));
        history.push(stateWith('two'), { label: 'rename' });
        history.push(stateWith('three'), { label: 'rename' });

        expect(history.canUndo).toBe(true);
        expect(history.undo().topics.r.text).toBe('two');
        expect(history.undo().topics.r.text).toBe('one');
        expect(history.canUndo).toBe(false);
        expect(history.redo().topics.r.text).toBe('two');
        expect(history.redo().topics.r.text).toBe('three');
        expect(history.canRedo).toBe(false);
    });

    it('merges consecutive edits that share a coalesce key', () => {
        const history = new History();
        history.reset(stateWith(''));
        history.push(stateWith('a'), { coalesceKey: 'rename:r' });
        history.push(stateWith('ab'), { coalesceKey: 'rename:r' });
        history.push(stateWith('abc'), { coalesceKey: 'rename:r' });

        expect(history.undo().topics.r.text).toBe('');
        expect(history.canUndo).toBe(false);
    });

    it('drops the redo stack once a new edit lands', () => {
        const history = new History();
        history.reset(stateWith('one'));
        history.push(stateWith('two'));
        history.undo();
        history.push(stateWith('other'));
        expect(history.canRedo).toBe(false);
    });

    it('stores snapshots, not references', () => {
        const history = new History();
        const live = stateWith('one');
        history.reset(live);
        history.push(stateWith('two'));
        live.topics.r.text = 'mutated afterwards';
        expect(history.undo().topics.r.text).toBe('one');
    });

    it('never grows past its limit', () => {
        const history = new History(5);
        history.reset(stateWith('0'));
        for (let i = 1; i <= 50; i += 1) history.push(stateWith(String(i)));
        expect(history.past.length).toBeLessThanOrEqual(5);
    });

    it('drives the undo/redo commands', () => {
        const history = new History();
        history.reset(stateWith('one'));
        history.push(stateWith('two'));
        const applied = [];
        expect(undo(history, (state) => applied.push(state.topics.r.text))).toBe(true);
        expect(redo(history, (state) => applied.push(state.topics.r.text))).toBe(true);
        expect(applied).toEqual(['one', 'two']);
        expect(undo(new History(), () => {})).toBe(false);
    });
});

describe('AutoSave', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('collapses a burst of edits into one write after the debounce', async () => {
        const statuses = [];
        const doc = createDocument({ title: 'X' });
        const autosave = createAutoSave({
            getDocument: () => doc,
            getMap: () => MindMap.fromState(doc.map),
            onStatus: (state) => statuses.push(state),
            delay: 700
        });

        for (let i = 0; i < 10; i += 1) autosave.schedule();
        expect(statuses.filter((s) => s === 'saving')).toHaveLength(0);

        await vi.advanceTimersByTimeAsync(700);
        expect(statuses.filter((s) => s === 'saving')).toHaveLength(1);
        expect(statuses).toContain('dirty');
    });

    it('writes immediately when flushed', async () => {
        const statuses = [];
        const doc = createDocument({ title: 'X' });
        const autosave = createAutoSave({
            getDocument: () => doc,
            getMap: () => MindMap.fromState(doc.map),
            onStatus: (state) => statuses.push(state)
        });
        autosave.schedule();
        await autosave.flush();
        expect(statuses).toContain('saving');
    });
});
