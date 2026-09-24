/**
 * Right / left tree ("logic chart"): every branch grows the same way from the
 * root, which reads like an outline and is the easiest layout to export to a
 * document. Geometry is the plain tidy tree; only the connector differs.
 */
import { tidyTree } from './TreeLayout.js';

export function logicLayout({ map, sizes, dir = 1, gapMain = 58, gapCross = 14, connector = 'elbow', rootId = map.rootId }) {
    const nodes = tidyTree({
        map,
        rootId,
        sizes,
        axis: 'x',
        dir,
        gapMain,
        gapCross,
        origin: { x: 0, y: 0 }
    });
    return { nodes, connector };
}
