/**
 * Layout engine: positions, overlap, hierarchy and collapsed branches.
 */
import { describe, it, expect } from 'vitest';
import { MindMap } from '../../mindmap/src/core/MindMap.js';
import { calculate, LAYOUTS, boundsOf } from '../../mindmap/src/layout/LayoutEngine.js';
import { measureNode } from '../../mindmap/src/layout/metrics.js';
import { getTheme, resolveStyle, branchColor } from '../../mindmap/src/core/Theme.js';
import { edgePath } from '../../mindmap/src/canvas/SVGCanvas.js';

function buildMap(branches = 4, depth = 2) {
    const map = MindMap.create('Central Topic');
    const grow = (parentId, level) => {
        if (level > depth) return;
        for (let i = 0; i < branches; i += 1) {
            const child = map.addChild(parentId, 'Topic ' + level + '-' + i);
            grow(child.id, level + 1);
        }
    };
    grow(map.rootId, 1);
    return map;
}

function overlaps(a, b) {
    return a.x < b.x + b.width && b.x < a.x + a.width
        && a.y < b.y + b.height && b.y < a.y + a.height;
}

function overlappingPairs(nodes) {
    const list = Array.from(nodes.values());
    const pairs = [];
    for (let i = 0; i < list.length; i += 1) {
        for (let j = i + 1; j < list.length; j += 1) {
            if (overlaps(list[i], list[j])) pairs.push([list[i].id, list[j].id]);
        }
    }
    return pairs;
}

describe('LayoutEngine', () => {
    it('positions every visible topic exactly once', () => {
        const map = buildMap(3, 2);
        const result = calculate(map, { layout: 'mindmap' });
        expect(result.nodes.size).toBe(map.size);
        for (const { topic } of map.walk(true)) {
            expect(result.nodes.get(topic.id)).toBeTruthy();
        }
    });

    it.each(LAYOUTS)('never overlaps two nodes in the %s layout', (layout) => {
        const map = buildMap(4, 2);
        const result = calculate(map, { layout });
        expect(overlappingPairs(result.nodes)).toEqual([]);
    });

    it('gives a collapsed branch no positions at all', () => {
        const map = buildMap(3, 2);
        const branch = map.childrenOf(map.rootId)[0];
        const hiddenCount = map.descendants(branch.id).length;
        map.setCollapsed(branch.id, true);

        const result = calculate(map, { layout: 'mindmap' });
        expect(result.nodes.size).toBe(map.size - hiddenCount);
        expect(result.nodes.get(branch.id)).toBeTruthy();
        for (const descendant of map.descendants(branch.id)) {
            expect(result.nodes.get(descendant.id)).toBeUndefined();
        }
    });

    it('splits main branches to both sides in the mind-map layout', () => {
        const map = buildMap(4, 1);
        const result = calculate(map, { layout: 'mindmap' });
        const sides = map.root.children.map((id) => result.nodes.get(id).side);
        expect(sides).toContain('right');
        expect(sides).toContain('left');
    });

    it('keeps every child on one side in the right and left tree layouts', () => {
        const map = buildMap(4, 2);
        const right = calculate(map, { layout: 'right' });
        const left = calculate(map, { layout: 'left' });
        for (const { topic } of map.walk(true)) {
            if (!topic.parentId) continue;
            const child = right.nodes.get(topic.id);
            const parent = right.nodes.get(topic.parentId);
            expect(child.x).toBeGreaterThanOrEqual(parent.x + parent.width);

            const lChild = left.nodes.get(topic.id);
            const lParent = left.nodes.get(topic.parentId);
            expect(lChild.x + lChild.width).toBeLessThanOrEqual(lParent.x);
        }
    });

    it('puts each level of an organisation chart below the last', () => {
        const map = buildMap(3, 2);
        const result = calculate(map, { layout: 'org' });
        for (const { topic } of map.walk(true)) {
            if (!topic.parentId) continue;
            const child = result.nodes.get(topic.id);
            const parent = result.nodes.get(topic.parentId);
            expect(child.y).toBeGreaterThanOrEqual(parent.y + parent.height);
        }
    });

    it('applies a manual offset to the topic and its whole subtree', () => {
        const map = buildMap(2, 2);
        const branch = map.childrenOf(map.rootId)[0];
        const before = calculate(map, { layout: 'mindmap' });
        map.setPosition(branch.id, { x: 120, y: -40 });
        const after = calculate(map, { layout: 'mindmap' });

        for (const id of [branch.id, ...map.descendants(branch.id).map((t) => t.id)]) {
            expect(after.nodes.get(id).x).toBe(before.nodes.get(id).x + 120);
            expect(after.nodes.get(id).y).toBe(before.nodes.get(id).y - 40);
        }
        // The root did not move.
        expect(after.nodes.get(map.rootId).x).toBe(before.nodes.get(map.rootId).x);
    });

    it('reports a bounding box that contains every node', () => {
        const map = buildMap(3, 2);
        const result = calculate(map, { layout: 'mindmap' });
        const bounds = boundsOf(result.nodes);
        result.nodes.forEach((node) => {
            expect(node.x).toBeGreaterThanOrEqual(bounds.minX);
            expect(node.y).toBeGreaterThanOrEqual(bounds.minY);
            expect(node.x + node.width).toBeLessThanOrEqual(bounds.maxX);
            expect(node.y + node.height).toBeLessThanOrEqual(bounds.maxY);
        });
    });

    it('falls back to the default layout for an unknown name', () => {
        const map = buildMap(2, 1);
        expect(calculate(map, { layout: 'spiral' }).layout).toBe('mindmap');
    });

    it('grows a node to fit longer text', () => {
        const map = MindMap.create('Hi');
        const short = measureNode(map, map.root, getTheme());
        map.setText(map.rootId, 'A considerably longer central topic label');
        const long = measureNode(map, map.root, getTheme());
        expect(long.width).toBeGreaterThan(short.width);
    });

    it('wraps very long text instead of growing without limit', () => {
        const map = MindMap.create('word '.repeat(60));
        const metrics = measureNode(map, map.root, getTheme());
        expect(metrics.lines.length).toBeGreaterThan(1);
        expect(metrics.width).toBeLessThan(300);
    });
});

describe('Theme resolution', () => {
    it('gives each main branch its own palette colour', () => {
        const map = buildMap(3, 1);
        const theme = getTheme('sla');
        const colours = map.root.children.map((id) => branchColor(map, id, theme));
        expect(new Set(colours).size).toBe(3);
    });

    it('inherits the branch colour down a branch', () => {
        const map = buildMap(2, 2);
        const theme = getTheme('sla');
        const branch = map.childrenOf(map.rootId)[0];
        const grandChild = map.descendants(branch.id)[0];
        expect(branchColor(map, grandChild.id, theme)).toBe(branchColor(map, branch.id, theme));
    });

    it('lets a topic override the theme', () => {
        const map = buildMap(1, 1);
        const theme = getTheme('sla');
        const child = map.childrenOf(map.rootId)[0];
        map.setStyle(child.id, { background: '#123456' });
        expect(resolveStyle(map, map.topic(child.id), theme).background).toBe('#123456');
    });
});

describe('Edge geometry', () => {
    const parent = { x: 0, y: 0, width: 100, height: 40, side: 'root' };
    const child = { x: 160, y: 60, width: 80, height: 30, side: 'right' };

    it('draws a curve that starts at the parent edge and ends at the child edge', () => {
        const d = edgePath(parent, child, 'curve');
        expect(d.startsWith('M100,20')).toBe(true);
        expect(d.endsWith('160,75')).toBe(true);
    });

    it('draws elbows with only straight segments', () => {
        const d = edgePath(parent, child, 'elbow');
        expect(d).toMatch(/^M[\d.,-]+ H[\d.-]+ V[\d.-]+ H[\d.-]+$/);
    });

    it('mirrors the anchors for a left-hand child', () => {
        const left = { x: -200, y: 60, width: 80, height: 30, side: 'left' };
        const d = edgePath(parent, left, 'curve');
        expect(d.startsWith('M0,20')).toBe(true);
        expect(d.endsWith('-120,75')).toBe(true);
    });
});
