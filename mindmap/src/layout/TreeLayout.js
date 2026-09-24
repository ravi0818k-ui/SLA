/**
 * The tidy-tree algorithm every layout is built from.
 *
 * Two passes over the visible tree:
 *   1. `extent()` — how much room a whole subtree needs on the cross axis.
 *   2. `assign()` — walk down placing each node at the centre of its subtree's
 *      band, then hand each child a band of its own.
 *
 * Because a parent's band is the *sum* of its children's bands, siblings can
 * never overlap and a deep branch pushes its neighbours aside instead of
 * drawing on top of them (requirement 6: "avoid overlapping nodes").
 *
 * The axis is a parameter, so the same code produces a right tree, a left tree
 * and a top-down organisation chart.
 */
import { visibleChildren } from './metrics.js';

/**
 * @param {object} o
 *   map, rootId, sizes (id -> {width,height}),
 *   axis: 'x' (grow sideways) | 'y' (grow downwards)
 *   dir: 1 | -1
 *   gapMain, gapCross
 *   origin: {x, y} — where the root's near edge sits
 * @returns {Map<string, {x,y,width,height,side}>}
 */
export function tidyTree(o) {
    const { map, rootId, sizes, axis = 'x', dir = 1, gapMain = 58, gapCross = 16, origin = { x: 0, y: 0 } } = o;
    const horizontal = axis === 'x';
    const nodes = new Map();
    const extents = new Map();

    const mainOf = (size) => (horizontal ? size.width : size.height);
    const crossOf = (size) => (horizontal ? size.height : size.width);
    const sizeOf = (id) => sizes.get(id) || { width: 80, height: 32 };

    function extent(id) {
        if (extents.has(id)) return extents.get(id);
        const topic = map.topic(id);
        const own = crossOf(sizeOf(id));
        const children = visibleChildren(map, topic);
        let value = own;
        if (children.length) {
            let total = 0;
            for (const child of children) total += extent(child.id) + gapCross;
            total -= gapCross;
            value = Math.max(own, total);
        }
        extents.set(id, value);
        return value;
    }

    function assign(id, mainStart, crossStart) {
        const size = sizeOf(id);
        const band = extent(id);
        const cross = crossStart + (band - crossOf(size)) / 2;
        const main = dir > 0 ? mainStart : mainStart - mainOf(size);

        nodes.set(id, {
            id,
            x: horizontal ? main : cross,
            y: horizontal ? cross : main,
            width: size.width,
            height: size.height,
            side: horizontal ? (dir > 0 ? 'right' : 'left') : 'down'
        });

        const children = visibleChildren(map, map.topic(id));
        if (!children.length) return;

        let total = 0;
        for (const child of children) total += extent(child.id) + gapCross;
        total -= gapCross;

        let cursor = crossStart + (band - total) / 2;
        const childMain = dir > 0 ? mainStart + mainOf(size) + gapMain : mainStart - mainOf(size) - gapMain;
        for (const child of children) {
            assign(child.id, childMain, cursor);
            cursor += extent(child.id) + gapCross;
        }
    }

    const rootMainStart = horizontal ? origin.x : origin.y;
    const rootCrossStart = horizontal ? origin.y : origin.x;
    assign(rootId, rootMainStart, rootCrossStart);
    return nodes;
}

/** Total cross-axis room a subtree needs — used by MindMapLayout to balance sides. */
export function subtreeExtent(map, rootId, sizes, axis, gapCross) {
    const horizontal = axis === 'x';
    const crossOf = (id) => {
        const size = sizes.get(id) || { width: 80, height: 32 };
        return horizontal ? size.height : size.width;
    };
    const walk = (id) => {
        const children = visibleChildren(map, map.topic(id));
        if (!children.length) return crossOf(id);
        let total = 0;
        for (const child of children) total += walk(child.id) + gapCross;
        return Math.max(crossOf(id), total - gapCross);
    };
    return walk(rootId);
}
