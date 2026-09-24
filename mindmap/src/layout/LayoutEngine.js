/**
 * The one entry point the rest of the app uses (requirement 6):
 *
 *     layoutEngine.calculate(mindMap, { layout, theme })
 *
 * Returns positions for every *visible* topic, the bounding box of the whole
 * map, and per-node metrics the renderer reuses so text is measured once.
 * Collapsed branches contribute nothing, which is what makes collapse cheap.
 */
import { measureNode } from './metrics.js';
import { mindMapLayout } from './MindMapLayout.js';
import { organizationLayout } from './OrganizationLayout.js';
import { logicLayout } from './LogicLayout.js';
import { getTheme } from '../core/Theme.js';

export const LAYOUTS = ['mindmap', 'right', 'left', 'org', 'logic'];
export const DEFAULT_LAYOUT = 'mindmap';

export const LAYOUT_LABELS = {
    mindmap: 'Mind Map',
    right: 'Right Tree',
    left: 'Left Tree',
    org: 'Organisation Chart',
    logic: 'Logic Chart'
};

export const layoutEngine = { calculate, LAYOUTS, DEFAULT_LAYOUT };

export function calculate(map, options = {}) {
    const theme = typeof options.theme === 'string' ? getTheme(options.theme) : (options.theme || getTheme());
    const kind = LAYOUTS.includes(options.layout) ? options.layout : DEFAULT_LAYOUT;
    // Drill-down lays the map out from a topic other than the real root; the
    // model is untouched, only what we walk changes.
    const rootId = options.rootId && map.topic(options.rootId) ? options.rootId : map.rootId;

    // Measure every visible topic once; both the layout and the renderer use this.
    const metrics = new Map();
    const sizes = new Map();
    for (const { topic } of map.walk(true, rootId)) {
        const m = measureNode(map, topic, theme);
        metrics.set(topic.id, m);
        sizes.set(topic.id, { width: m.width, height: m.height });
    }

    let result;
    if (kind === 'org') result = organizationLayout({ map, sizes, rootId });
    else if (kind === 'right') result = logicLayout({ map, sizes, dir: 1, rootId });
    else if (kind === 'left') result = logicLayout({ map, sizes, dir: -1, rootId });
    else if (kind === 'logic') result = logicLayout({ map, sizes, dir: 1, gapCross: 10, connector: 'bracket', rootId });
    else result = mindMapLayout({ map, sizes, rootId });

    applyManualOffsets(map, result.nodes, rootId);

    return {
        layout: kind,
        rootId,
        connector: result.connector,
        nodes: result.nodes,
        metrics,
        theme,
        bounds: boundsOf(result.nodes)
    };
}

/**
 * `topic.position` is a manual *nudge*, not an absolute coordinate: the auto
 * layout still runs, and the offset is added afterwards to the topic and its
 * whole subtree, so a dragged branch keeps its internal shape and its edge to
 * the parent stays connected. Clearing the offset restores the tidy position.
 */
function applyManualOffsets(map, nodes, rootId = map.rootId) {
    for (const { topic } of map.walk(true, rootId)) {
        const offset = topic.position;
        if (!offset || (!offset.x && !offset.y)) continue;
        const affected = [topic.id, ...map.descendants(topic.id).map((t) => t.id)];
        for (const id of affected) {
            const node = nodes.get(id);
            if (!node) continue;
            node.x += offset.x;
            node.y += offset.y;
        }
    }
}

export function boundsOf(nodes) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    nodes.forEach((node) => {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + node.width);
        maxY = Math.max(maxY, node.y + node.height);
    });
    if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/** Centre of a node's edge facing its parent (where a branch line should land). */
export function anchorPoint(node, towards) {
    if (towards === 'right') return { x: node.x + node.width, y: node.y + node.height / 2 };
    if (towards === 'left') return { x: node.x, y: node.y + node.height / 2 };
    if (towards === 'down') return { x: node.x + node.width / 2, y: node.y + node.height };
    return { x: node.x + node.width / 2, y: node.y };
}
