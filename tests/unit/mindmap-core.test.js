/**
 * Mind map engine: topic operations, tree invariants and document handling.
 *
 * These modules are plain ES modules (the mindmap app has no build step but
 * does use native `import`), so unlike script.js they can be imported straight
 * into vitest rather than eval'd.
 */
import { describe, it, expect } from 'vitest';
import { MindMap } from '../../mindmap/src/core/MindMap.js';
import { createTopic, normalizeTopic } from '../../mindmap/src/core/Topic.js';
import { createDocument, parseDocument, FORMAT_VERSION } from '../../mindmap/src/core/Document.js';
import { safeUrl, safeImageSrc, safeColor } from '../../mindmap/src/util/sanitize.js';

function sampleMap() {
    const map = MindMap.create('Root');
    const a = map.addChild(map.rootId, 'A');
    const b = map.addChild(map.rootId, 'B');
    const a1 = map.addChild(a.id, 'A1');
    const a2 = map.addChild(a.id, 'A2');
    return { map, a, b, a1, a2 };
}

describe('MindMap topic operations', () => {
    it('creates a map with exactly one root', () => {
        const map = MindMap.create('Central');
        expect(map.size).toBe(1);
        expect(map.root.text).toBe('Central');
        expect(map.root.parentId).toBeNull();
    });

    it('adds children in order and links both directions', () => {
        const { map, a, b } = sampleMap();
        expect(map.root.children).toEqual([a.id, b.id]);
        expect(map.topic(a.id).parentId).toBe(map.rootId);
        expect(map.childrenOf(map.rootId).map((t) => t.text)).toEqual(['A', 'B']);
    });

    it('adds a sibling directly after the reference topic', () => {
        const { map, a, b } = sampleMap();
        const mid = map.addSibling(a.id, 'A-and-a-half');
        expect(map.root.children).toEqual([a.id, mid.id, b.id]);
    });

    it('treats Enter on the root as "add child" because the root has no siblings', () => {
        const map = MindMap.create('Root');
        const topic = map.addSibling(map.rootId, 'Child');
        expect(topic.parentId).toBe(map.rootId);
    });

    it('removes a topic together with its whole subtree', () => {
        const { map, a, a1, a2 } = sampleMap();
        const removed = map.remove(a.id);
        expect(removed).toHaveLength(3);
        expect(removed).toEqual(expect.arrayContaining([a.id, a1.id, a2.id]));
        expect(map.topic(a1.id)).toBeNull();
        expect(map.root.children).not.toContain(a.id);
    });

    it('never removes the root', () => {
        const { map } = sampleMap();
        expect(map.remove(map.rootId)).toEqual([]);
        expect(map.root).toBeTruthy();
    });

    it('duplicates a subtree with fresh ids beside the original', () => {
        const { map, a, a1 } = sampleMap();
        const copy = map.duplicate(a.id);
        expect(copy.id).not.toBe(a.id);
        expect(map.indexOf(copy.id)).toBe(map.indexOf(a.id) + 1);
        expect(map.childrenOf(copy.id)).toHaveLength(2);
        expect(map.childrenOf(copy.id)[0].id).not.toBe(a1.id);
        expect(map.childrenOf(copy.id)[0].text).toBe('A1');
    });

    it('refuses to move a topic into its own descendant', () => {
        const { map, a, a1 } = sampleMap();
        expect(map.move(a.id, a1.id)).toBe(false);
        expect(map.topic(a.id).parentId).toBe(map.rootId);
    });

    it('refuses to move a topic into itself, and never moves the root', () => {
        const { map, a } = sampleMap();
        expect(map.move(a.id, a.id)).toBe(false);
        expect(map.move(map.rootId, a.id)).toBe(false);
    });

    it('re-parents and keeps the index sane when moving within one parent', () => {
        const { map, a, b } = sampleMap();
        expect(map.move(b.id, map.rootId, 0)).toBe(true);
        expect(map.root.children).toEqual([b.id, a.id]);
    });

    it('reorders among siblings and refuses to run past the ends', () => {
        const { map, a, b } = sampleMap();
        expect(map.reorder(b.id, -1)).toBe(true);
        expect(map.root.children).toEqual([b.id, a.id]);
        expect(map.reorder(b.id, -1)).toBe(false);
    });

    it('collapses only topics that have children', () => {
        const { map, a, a1 } = sampleMap();
        expect(map.toggleCollapse(a.id)).toBe(true);
        expect(map.topic(a.id).collapsed).toBe(true);
        expect(map.toggleCollapse(a1.id)).toBe(false);
    });

    it('hides collapsed branches from the visible walk but keeps them in the model', () => {
        const { map, a } = sampleMap();
        map.setCollapsed(a.id, true);
        const visible = map.walk(true).map(({ topic }) => topic.text);
        expect(visible).toEqual(['Root', 'A', 'B']);
        expect(map.walk(false)).toHaveLength(5);
    });

    it('searches text, notes and tags', () => {
        const { map, a, b } = sampleMap();
        map.setNote(a.id, 'Remember the mitochondria');
        map.setTags(b.id, ['biology']);
        expect(map.search('mitochondria').map((r) => r.id)).toEqual([a.id]);
        expect(map.search('BIOLOGY')[0].fields).toContain('tag');
        expect(map.search('   ')).toEqual([]);
    });

    it('drops relationships and boundaries whose topic was deleted', () => {
        const { map, a, b } = sampleMap();
        map.addRelationship(a.id, b.id);
        map.addBoundary(a.id);
        map.remove(a.id);
        expect(map.relationships).toHaveLength(0);
        expect(map.boundaries).toHaveLength(0);
    });

    it('never creates a self-relationship or a duplicate', () => {
        const { map, a, b } = sampleMap();
        expect(map.addRelationship(a.id, a.id)).toBeNull();
        const first = map.addRelationship(a.id, b.id);
        expect(map.addRelationship(a.id, b.id)).toBe(first);
        expect(map.relationships).toHaveLength(1);
    });
});

describe('MindMap.fromState repairs bad data', () => {
    it('re-parents orphans to the root instead of losing them', () => {
        const map = MindMap.fromState({
            rootId: 'r',
            topics: {
                r: { id: 'r', text: 'Root', children: [] },
                x: { id: 'x', text: 'Orphan', parentId: 'does-not-exist', children: [] }
            }
        });
        expect(map.topic('x').parentId).toBe('r');
        expect(map.root.children).toContain('x');
    });

    it('breaks a parent/child cycle rather than hanging', () => {
        const map = MindMap.fromState({
            rootId: 'r',
            topics: {
                r: { id: 'r', text: 'Root', children: ['a'] },
                a: { id: 'a', text: 'A', parentId: 'b', children: ['b'] },
                b: { id: 'b', text: 'B', parentId: 'a', children: ['a'] }
            }
        });
        expect(map.size).toBe(3);
        expect(map.walk(false).length).toBe(3);
    });

    it('round-trips through toState without losing structure', () => {
        const { map } = sampleMap();
        const copy = MindMap.fromState(JSON.parse(JSON.stringify(map.toState())));
        expect(copy.size).toBe(map.size);
        expect(copy.walk(false).map(({ topic }) => topic.text))
            .toEqual(map.walk(false).map(({ topic }) => topic.text));
    });
});

describe('Topic normalisation', () => {
    it('gives every topic the documented shape', () => {
        const topic = createTopic({ text: 'Hi' });
        expect(topic).toMatchObject({
            text: 'Hi', children: [], tags: [], links: [], icons: [], image: null, collapsed: false
        });
        expect(typeof topic.id).toBe('string');
    });

    it('coerces junk fields to their defaults instead of throwing', () => {
        const topic = normalizeTopic({ id: 'x', text: { bad: true }, tags: 'nope', links: 42, style: 'no' });
        expect(topic.tags).toEqual([]);
        expect(topic.links).toEqual([]);
        expect(topic.style).toEqual({});
        expect(typeof topic.text).toBe('string');
    });

    it('drops links that are not http(s)/mailto', () => {
        const topic = normalizeTopic({
            id: 'x',
            links: [{ url: 'javascript:alert(1)' }, { url: 'https://example.com' }]
        });
        expect(topic.links).toHaveLength(1);
        expect(topic.links[0].url).toContain('example.com');
    });
});

describe('Document format', () => {
    it('stamps the current format version and a title', () => {
        const doc = createDocument({ title: 'Biology' });
        expect(doc.formatVersion).toBe(FORMAT_VERSION);
        expect(doc.meta.title).toBe('Biology');
        expect(doc.map.rootId).toBeTruthy();
    });

    it('parses its own output unchanged', () => {
        const doc = createDocument({ title: 'Biology' });
        const parsed = parseDocument(JSON.stringify(doc));
        expect(parsed.meta.id).toBe(doc.meta.id);
        expect(parsed.meta.title).toBe('Biology');
    });

    it('rejects a document written by a newer major version', () => {
        const doc = createDocument({ title: 'Future' });
        doc.formatVersion = '2.0';
        expect(() => parseDocument(doc)).toThrow(/newer version/i);
    });

    it('rejects text that is not JSON, and JSON that is not a map', () => {
        expect(() => parseDocument('not json')).toThrow(/valid JSON/i);
        expect(() => parseDocument('[1,2,3]')).toThrow(/mind map/i);
    });

    it('falls back to safe defaults for an out-of-range view', () => {
        const doc = createDocument({ title: 'X' });
        doc.view.zoom = 9999;
        doc.view.layout = 'spiral';
        const parsed = parseDocument(doc);
        expect(parsed.view.zoom).toBeLessThanOrEqual(5);
        expect(parsed.view.layout).toBe('mindmap');
    });
});

describe('Sanitisers', () => {
    it('blocks script-bearing URLs', () => {
        expect(safeUrl('javascript:alert(1)')).toBe('');
        expect(safeUrl('data:text/html,<script>')).toBe('');
        expect(safeUrl('https://example.com/x')).toContain('https://example.com/x');
        expect(safeUrl('mailto:a@b.com')).toContain('mailto:');
    });

    it('allows only image data URIs for images', () => {
        expect(safeImageSrc('data:text/html;base64,AAAA')).toBe('');
        expect(safeImageSrc('data:image/png;base64,iVBORw0KGgo=')).toContain('data:image/png');
    });

    it('accepts only colour-shaped strings', () => {
        expect(safeColor('#ff0000')).toBe('#ff0000');
        expect(safeColor('url(javascript:1)')).toBe('');
        expect(safeColor('rebeccapurple')).toBe('rebeccapurple');
    });
});

describe('Batch A tree operations', () => {
    function sample() {
        const map = MindMap.create('Root');
        const a = map.addChild(map.rootId, 'A');
        const b = map.addChild(map.rootId, 'B');
        const a1 = map.addChild(a.id, 'A1');
        const a2 = map.addChild(a.id, 'A2');
        return { map, a, b, a1, a2 };
    }

    it('addSiblingBefore puts the new topic above its sibling', () => {
        const { map, b } = sample();
        const created = map.addSiblingBefore(b.id, 'between');
        expect(map.childrenOf(map.rootId).map((t) => t.text)).toEqual(['A', 'between', 'B']);
        expect(created.parentId).toBe(map.rootId);
    });

    it('insertParent pushes the topic and its subtree down a level', () => {
        const { map, a, a1 } = sample();
        const created = map.insertParent(a.id, 'Group');
        expect(map.parentOf(a.id).id).toBe(created.id);
        expect(map.parentOf(created.id).id).toBe(map.rootId);
        expect(map.parentOf(a1.id).id).toBe(a.id);
        expect(map.childrenOf(map.rootId).map((t) => t.text)).toEqual(['Group', 'B']);
    });

    it('insertParent refuses the root, which has no parent', () => {
        const { map } = sample();
        expect(map.insertParent(map.rootId, 'x')).toBeNull();
    });

    it('removeOnly keeps the children and pulls them up in place', () => {
        const { map, a, a1, a2 } = sample();
        expect(map.removeOnly(a.id)).toBe(true);
        expect(map.topic(a.id)).toBeNull();
        expect(map.childrenOf(map.rootId).map((t) => t.text)).toEqual(['A1', 'A2', 'B']);
        expect(map.parentOf(a1.id).id).toBe(map.rootId);
        expect(map.parentOf(a2.id).id).toBe(map.rootId);
    });

    it('removeOnly never removes the root', () => {
        const { map } = sample();
        expect(map.removeOnly(map.rootId)).toBe(false);
    });

    it('moveToEdge moves a topic to the first or last place', () => {
        const { map, a2 } = sample();
        map.moveToEdge(a2.id, 'top');
        expect(map.childrenOf(map.parentOf(a2.id).id).map((t) => t.text)).toEqual(['A2', 'A1']);
        map.moveToEdge(a2.id, 'bottom');
        expect(map.childrenOf(map.parentOf(a2.id).id).map((t) => t.text)).toEqual(['A1', 'A2']);
    });

    it('collapseToLevel collapses everything deeper than the level asked for', () => {
        const { map, a } = sample();
        map.collapseToLevel(1);
        expect(map.topic(map.rootId).collapsed).toBe(false);
        expect(map.topic(a.id).collapsed).toBe(true);
        expect(map.walk(true)).toHaveLength(3); // root + A + B

        map.collapseToLevel(0);
        expect(map.topic(map.rootId).collapsed).toBe(true);
        expect(map.walk(true)).toHaveLength(1);
    });

    it('depth reports the deepest level in the map', () => {
        const { map, a1 } = sample();
        expect(map.depth).toBe(2);
        map.addChild(a1.id, 'deep');
        expect(map.depth).toBe(3);
    });

    it('numbers a branch without touching the topic text', () => {
        const { map, a, b, a1, a2 } = sample();
        map.setNumbering(map.rootId, 'number');
        expect(map.numberPrefix(a.id)).toBe('1');
        expect(map.numberPrefix(b.id)).toBe('2');
        expect(map.numberPrefix(a1.id)).toBe('1.1');
        expect(map.numberPrefix(a2.id)).toBe('1.2');
        expect(map.topic(a1.id).text).toBe('A1');
        expect(map.numberPrefix(map.rootId)).toBe('');
    });

    it('supports letter and roman numbering, and survives a round trip', () => {
        const { map, b, a1 } = sample();
        map.setNumbering(map.rootId, 'letter');
        expect(map.numberPrefix(b.id)).toBe('B');
        expect(map.numberPrefix(a1.id)).toBe('A.1');

        map.setNumbering(map.rootId, 'roman');
        expect(map.numberPrefix(b.id)).toBe('II');

        const again = MindMap.fromState(map.toState());
        expect(again.topic(again.rootId).numbering).toBe('roman');
        expect(again.numberPrefix(b.id)).toBe('II');
    });

    it('rejects a numbering style it does not know', () => {
        const { map } = sample();
        map.setNumbering(map.rootId, 'javascript:alert(1)');
        expect(map.topic(map.rootId).numbering).toBe('');
    });
});
