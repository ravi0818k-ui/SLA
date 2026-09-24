/**
 * The classic mind map: the root sits in the middle and its main branches
 * alternate right / left so the map grows in both directions.
 *
 * Each main branch is laid out as an independent tidy tree and then stacked
 * against its side, vertically centred on the root.
 */
import { tidyTree, subtreeExtent } from './TreeLayout.js';
import { visibleChildren } from './metrics.js';

export function mindMapLayout({ map, sizes, gapMain = 64, gapCross = 18, rootId = map.rootId }) {
    const rootSize = sizes.get(rootId) || { width: 120, height: 40 };
    const nodes = new Map();

    nodes.set(rootId, {
        id: rootId,
        x: 0,
        y: 0,
        width: rootSize.width,
        height: rootSize.height,
        side: 'root'
    });

    const children = visibleChildren(map, map.topic(rootId));
    const right = [];
    const left = [];
    children.forEach((child, index) => (index % 2 === 0 ? right : left).push(child));

    const rootCenterY = rootSize.height / 2;

    const placeSide = (list, dir) => {
        if (!list.length) return;
        const extents = list.map((child) => subtreeExtent(map, child.id, sizes, 'x', gapCross));
        const total = extents.reduce((a, b) => a + b + gapCross, 0) - gapCross;
        let cursor = rootCenterY - total / 2;
        const mainStart = dir > 0 ? rootSize.width + gapMain : -gapMain;
        list.forEach((child, index) => {
            const branch = tidyTree({
                map,
                rootId: child.id,
                sizes,
                axis: 'x',
                dir,
                gapMain,
                gapCross,
                origin: { x: mainStart, y: cursor }
            });
            branch.forEach((node, id) => nodes.set(id, node));
            cursor += extents[index] + gapCross;
        });
    };

    placeSide(right, 1);
    placeSide(left, -1);

    return { nodes, connector: 'curve' };
}
