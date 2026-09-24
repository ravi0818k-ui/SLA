/**
 * Organisation chart: the root at the top, every level a row below the last,
 * connected with square elbows.
 */
import { tidyTree } from './TreeLayout.js';

export function organizationLayout({ map, sizes, gapMain = 56, gapCross = 22, rootId = map.rootId }) {
    const nodes = tidyTree({
        map,
        rootId,
        sizes,
        axis: 'y',
        dir: 1,
        gapMain,
        gapCross,
        origin: { x: 0, y: 0 }
    });
    return { nodes, connector: 'orgElbow' };
}
