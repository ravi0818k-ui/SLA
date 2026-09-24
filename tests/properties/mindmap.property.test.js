/**
 * Property-based tests for the mind-map engine (fast-check, >=100 runs each).
 *
 * The numbered properties are the ones listed in mindmap/docs/README.md under
 * "Invariants" — keep the numbering in the two places in step. (The numbered
 * properties in .kiro/specs/.../design.md belong to the landing page and are
 * unrelated to these.)
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { MindMap } from '../../mindmap/src/core/MindMap.js';
import { createDocument } from '../../mindmap/src/core/Document.js';
import { calculate, LAYOUTS } from '../../mindmap/src/layout/LayoutEngine.js';
import { exportMarkdown } from '../../mindmap/src/export/Markdown.js';
import { parseMarkdown } from '../../mindmap/src/import/Markdown.js';
import { History } from '../../mindmap/src/history/History.js';

const RUNS = { numRuns: 100 };

/** A nested outline: text plus up to 3 children, up to 3 levels deep. */
const outlineArb = fc.letrec((tie) => ({
    node: fc.record({
        text: fc.string({ minLength: 1, maxLength: 14 })
            .map((s) => s.replace(/[\s#>*_`[\]()-]/g, 'x').trim() || 'topic'),
        children: fc.oneof(
            { depthSize: 'small', withCrossShrink: true },
            fc.constant([]),
            fc.array(tie('node'), { maxLength: 3 })
        )
    })
})).node;

function buildMap(outline) {
    const map = MindMap.create(outline.text);
    const add = (node, parentId) => {
        for (const child of node.children || []) {
            const topic = map.addChild(parentId, child.text);
            add(child, topic.id);
        }
    };
    add(outline, map.rootId);
    return map;
}

function textTree(map, id = map.rootId) {
    return { text: map.topic(id).text, children: map.childrenOf(id).map((c) => textTree(map, c.id)) };
}

function everyTopicReachesRoot(map) {
    for (const topic of Object.values(map.topics)) {
        if (topic.id === map.rootId) continue;
        const seen = new Set([topic.id]);
        let cursor = map.parentOf(topic.id);
        while (cursor && cursor.id !== map.rootId) {
            if (seen.has(cursor.id)) return false;
            seen.add(cursor.id);
            cursor = map.parentOf(cursor.id);
        }
        if (!cursor) return false;
    }
    return true;
}

describe('Mind map properties', () => {
    // Property M1: no two nodes ever overlap, in any layout.
    it('M1: laid-out nodes never overlap', () => {
        fc.assert(fc.property(outlineArb, fc.constantFrom(...LAYOUTS), (outline, layout) => {
            const map = buildMap(outline);
            const nodes = Array.from(calculate(map, { layout }).nodes.values());
            for (let i = 0; i < nodes.length; i += 1) {
                for (let j = i + 1; j < nodes.length; j += 1) {
                    const a = nodes[i];
                    const b = nodes[j];
                    const hit = a.x < b.x + b.width && b.x < a.x + a.width
                        && a.y < b.y + b.height && b.y < a.y + a.height;
                    if (hit) return false;
                }
            }
            return true;
        }), RUNS);
    });

    // Property M2: the layout positions exactly the visible topics — no more,
    // no fewer — so a collapsed branch costs nothing to draw.
    it('M2: positions exist for exactly the visible topics', () => {
        fc.assert(fc.property(outlineArb, fc.nat(), (outline, seed) => {
            const map = buildMap(outline);
            const collapsible = map.walk(false)
                .map(({ topic }) => topic)
                .filter((topic) => topic.children.length && topic.id !== map.rootId);
            if (collapsible.length) {
                map.setCollapsed(collapsible[seed % collapsible.length].id, true);
            }
            const visible = map.walk(true).map(({ topic }) => topic.id);
            const nodes = calculate(map, { layout: 'mindmap' }).nodes;
            return nodes.size === visible.length && visible.every((id) => nodes.has(id));
        }), RUNS);
    });

    // Property M3: a child is always inside its parent's subtree, and every
    // topic can reach the root — i.e. the tree stays a tree.
    it('M3: the tree stays acyclic through arbitrary moves', () => {
        fc.assert(fc.property(outlineArb, fc.array(fc.tuple(fc.nat(), fc.nat()), { maxLength: 8 }), (outline, moves) => {
            const map = buildMap(outline);
            const ids = map.walk(false).map(({ topic }) => topic.id);
            for (const [from, to] of moves) {
                map.move(ids[from % ids.length], ids[to % ids.length]);
            }
            return everyTopicReachesRoot(map) && map.size === ids.length;
        }), RUNS);
    });

    // Property M4: deleting a topic removes exactly it and its descendants.
    it('M4: deleting removes exactly the subtree', () => {
        fc.assert(fc.property(outlineArb, fc.nat(), (outline, seed) => {
            const map = buildMap(outline);
            const candidates = map.walk(false)
                .map(({ topic }) => topic.id)
                .filter((id) => id !== map.rootId);
            if (!candidates.length) return true;
            const target = candidates[seed % candidates.length];
            const expected = 1 + map.descendants(target).length;
            const before = map.size;
            const removed = map.remove(target);
            return removed.length === expected && map.size === before - expected;
        }), RUNS);
    });

    // Property M5: Markdown export -> import preserves the text tree.
    it('M5: a Markdown round trip preserves the tree', () => {
        fc.assert(fc.property(outlineArb, (outline) => {
            const map = buildMap(outline);
            const doc = createDocument({ title: map.root.text, map });
            const back = parseMarkdown(exportMarkdown(map, doc));
            return JSON.stringify(textTree(back)) === JSON.stringify(textTree(map));
        }), RUNS);
    });

    // Property M6: undo after one committed change returns the exact prior state.
    it('M6: undo restores the previous state exactly', () => {
        fc.assert(fc.property(outlineArb, fc.string({ maxLength: 20 }), (outline, text) => {
            const map = buildMap(outline);
            const history = new History();
            history.reset(map.toState());
            const before = JSON.stringify(map.toState());

            map.addChild(map.rootId, text);
            history.push(map.toState(), { label: 'add' });

            const restored = history.undo();
            return JSON.stringify(restored) === before;
        }), RUNS);
    });

    // Property M7: search matches a topic iff the needle is in its text, note
    // or one of its tags (case-insensitively).
    it('M7: search agrees with a direct scan of text, notes and tags', () => {
        fc.assert(fc.property(outlineArb, fc.string({ minLength: 1, maxLength: 5 }), (outline, needle) => {
            const map = buildMap(outline);
            const hits = new Set(map.search(needle).map((r) => r.id));
            const lower = needle.trim().toLowerCase();
            if (!lower) return hits.size === 0;
            for (const { topic } of map.walk(false)) {
                const expected = topic.text.toLowerCase().includes(lower)
                    || topic.note.toLowerCase().includes(lower)
                    || topic.tags.some((tag) => tag.toLowerCase().includes(lower));
                if (expected !== hits.has(topic.id)) return false;
            }
            return true;
        }), RUNS);
    });

    // Property M8: serialising and re-reading a map changes nothing.
    it('M8: toState -> fromState is lossless for the visible tree', () => {
        fc.assert(fc.property(outlineArb, (outline) => {
            const map = buildMap(outline);
            const copy = MindMap.fromState(JSON.parse(JSON.stringify(map.toState())));
            return JSON.stringify(textTree(copy)) === JSON.stringify(textTree(map))
                && copy.size === map.size;
        }), RUNS);
    });
});
