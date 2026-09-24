/**
 * The SVG renderer (requirement 5).
 *
 * Structure:
 *   <svg>
 *     <defs> arrow markers, drop shadow
 *     <g class="mm-viewport" transform="translate(x,y) scale(z)">
 *       <g boundaries> <g edges> <g relationships> <g nodes> <g overlay>
 *
 * Zoom and pan only rewrite the viewport transform. A model change re-renders
 * the layers; nodes are keyed by id and reused where possible so that a rename
 * or a selection change does not rebuild the whole tree.
 */
import { svgEl, clear } from '../util/dom.js';
import { dashArray } from '../core/Relationship.js';
import { PAD_X, PAD_Y, ICON_SIZE, ICON_GAP, IMAGE_GAP } from '../layout/metrics.js';

const NS = 'http://www.w3.org/2000/svg';

export class SVGCanvas {
    constructor({ svg, viewport }) {
        this.svg = svg;
        this.viewport = viewport;
        this.nodeEls = new Map();
        this.lastResult = null;

        this.defs = svgEl('defs');
        this.defs.appendChild(arrowMarker('mm-arrow', '#8a94a6'));
        this.root = svgEl('g', { class: 'mm-viewport' });
        this.layers = {
            boundaries: svgEl('g', { class: 'mm-layer mm-boundaries' }),
            edges: svgEl('g', { class: 'mm-layer mm-edges' }),
            relationships: svgEl('g', { class: 'mm-layer mm-relationships' }),
            nodes: svgEl('g', { class: 'mm-layer mm-nodes' }),
            overlay: svgEl('g', { class: 'mm-layer mm-overlay' })
        };
        for (const layer of Object.values(this.layers)) this.root.appendChild(layer);
        clear(svg);
        svg.appendChild(this.defs);
        svg.appendChild(this.root);

        this.viewport.onChange = () => this.updateTransform();
        this.updateTransform();
    }

    updateTransform() {
        const { x, y, scale } = this.viewport;
        this.root.setAttribute('transform', 'translate(' + x + ',' + y + ') scale(' + scale + ')');
    }

    size() {
        const rect = this.svg.getBoundingClientRect
            ? this.svg.getBoundingClientRect()
            : { width: 0, height: 0 };
        return { width: rect.width || this.svg.clientWidth || 0, height: rect.height || this.svg.clientHeight || 0 };
    }

    /** Client (mouse) coordinates -> map coordinates. */
    clientToMap(clientX, clientY) {
        const rect = this.svg.getBoundingClientRect();
        return this.viewport.toMap(clientX - rect.left, clientY - rect.top);
    }

    nodeEl(id) { return this.nodeEls.get(id) || null; }

    /**
     * @param {object} ctx { map, result, selectedIds:Set, primaryId, matches:Set,
     *                       editingId, relationshipSourceId }
     */
    render(ctx) {
        const { map, result } = ctx;
        this.lastResult = result;
        this.svg.style.setProperty('--mm-canvas', result.theme.canvas);

        this.renderBoundaries(ctx);
        this.renderEdges(ctx);
        this.renderRelationships(ctx);
        this.renderNodes(ctx);
    }

    // ---------------------------------------------------------------- edges

    renderEdges({ map, result }) {
        const layer = clear(this.layers.edges);
        const frag = document.createDocumentFragment();
        result.nodes.forEach((node, id) => {
            const topic = map.topic(id);
            if (!topic || !topic.parentId) return;
            const parentNode = result.nodes.get(topic.parentId);
            if (!parentNode) return;
            const style = result.metrics.get(id).style;
            const path = svgEl('path', {
                class: 'mm-edge',
                d: edgePath(parentNode, node, result.connector, style.branchCurve),
                fill: 'none',
                stroke: style.branchColor,
                'stroke-width': style.branchWidth,
                'stroke-linecap': 'round',
                'stroke-linejoin': 'round'
            });
            const dash = dashArray(style.branchStyle, style.branchWidth);
            if (dash) path.setAttribute('stroke-dasharray', dash);
            frag.appendChild(path);
        });
        layer.appendChild(frag);
    }

    renderRelationships({ map, result, selectedIds }) {
        const layer = clear(this.layers.relationships);
        for (const rel of map.relationships) {
            const from = result.nodes.get(rel.fromId);
            const to = result.nodes.get(rel.toId);
            if (!from || !to) continue; // one end is inside a collapsed branch
            const a = center(from);
            const b = center(to);
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            const normal = { x: -(b.y - a.y), y: b.x - a.x };
            const length = Math.hypot(normal.x, normal.y) || 1;
            const bow = Math.min(90, length * 0.22);
            const control = { x: mid.x + (normal.x / length) * bow, y: mid.y + (normal.y / length) * bow };
            const g = svgEl('g', {
                class: 'mm-relationship' + (selectedIds && selectedIds.has(rel.id) ? ' is-selected' : ''),
                dataset: { relId: rel.id }
            });
            g.appendChild(svgEl('path', {
                d: 'M' + a.x + ',' + a.y + ' Q' + control.x + ',' + control.y + ' ' + b.x + ',' + b.y,
                fill: 'none',
                stroke: rel.style.color,
                'stroke-width': 2,
                'stroke-dasharray': dashArray(rel.style.dash, 2) || null,
                'marker-end': 'url(#mm-arrow)'
            }));
            if (rel.label) {
                const labelPoint = {
                    x: 0.25 * a.x + 0.5 * control.x + 0.25 * b.x,
                    y: 0.25 * a.y + 0.5 * control.y + 0.25 * b.y
                };
                g.appendChild(svgEl('text', {
                    class: 'mm-relationship-label',
                    x: labelPoint.x,
                    y: labelPoint.y - 4,
                    'text-anchor': 'middle',
                    text: rel.label
                }));
            }
            layer.appendChild(g);
        }
    }

    renderBoundaries({ map, result }) {
        const layer = clear(this.layers.boundaries);
        for (const boundary of map.boundaries) {
            const ids = [boundary.topicId, ...map.descendants(boundary.topicId).map((t) => t.id)];
            const boxes = ids.map((id) => result.nodes.get(id)).filter(Boolean);
            if (!boxes.length) continue;
            const pad = 16;
            const minX = Math.min(...boxes.map((b) => b.x)) - pad;
            const minY = Math.min(...boxes.map((b) => b.y)) - pad - 8;
            const maxX = Math.max(...boxes.map((b) => b.x + b.width)) + pad;
            const maxY = Math.max(...boxes.map((b) => b.y + b.height)) + pad;
            const g = svgEl('g', { class: 'mm-boundary', dataset: { boundaryId: boundary.id } });
            g.appendChild(svgEl('rect', {
                x: minX, y: minY, width: maxX - minX, height: maxY - minY,
                rx: 16, ry: 16,
                fill: boundary.style.color, 'fill-opacity': 0.06,
                stroke: boundary.style.color, 'stroke-width': 1.5, 'stroke-dasharray': '6 5'
            }));
            if (boundary.label) {
                g.appendChild(svgEl('text', {
                    class: 'mm-boundary-label',
                    x: minX + 12, y: minY + 14,
                    fill: boundary.style.color,
                    text: boundary.label
                }));
            }
            layer.appendChild(g);
        }
    }

    // ---------------------------------------------------------------- nodes

    renderNodes(ctx) {
        const { map, result, selectedIds, primaryId, matches, editingId, dimmedIds } = ctx;
        const layer = this.layers.nodes;
        const seen = new Set();
        const frag = document.createDocumentFragment();

        result.nodes.forEach((node, id) => {
            const topic = map.topic(id);
            if (!topic) return;
            seen.add(id);
            const metrics = result.metrics.get(id);
            const g = this.buildNode(map, topic, node, metrics, result);
            g.setAttribute('transform', 'translate(' + node.x + ',' + node.y + ')');
            let classes = 'mm-node';
            if (selectedIds && selectedIds.has(id)) classes += ' is-selected';
            if (primaryId === id) classes += ' is-primary';
            if (matches && matches.has(id)) classes += ' is-match';
            if (dimmedIds && dimmedIds.has(id)) classes += ' is-dimmed';
            if (editingId === id) classes += ' is-editing';
            if (id === map.rootId) classes += ' is-root';
            g.setAttribute('class', classes);
            // Handles belong to the one focused topic only, so a big selection
            // does not cover the map in buttons.
            if (primaryId === id && editingId !== id) {
                g.appendChild(quickAddButton(topic, node, result, metrics.style));
                g.appendChild(resizeHandle(topic, node));
            }
            frag.appendChild(g);
        });

        clear(layer);
        this.nodeEls.clear();
        layer.appendChild(frag);
        for (const child of layer.children) this.nodeEls.set(child.dataset.id, child);
        this.cullOffscreen(seen);
    }

    /** Placeholder for future virtualisation; kept so the call site is stable. */
    cullOffscreen() {}

    buildNode(map, topic, node, metrics, result) {
        const style = metrics.style;
        const g = svgEl('g', { dataset: { id: topic.id }, tabindex: '-1' });

        g.appendChild(shapeFor(style, node.width, node.height));

        let cursorY = PAD_Y;
        if (topic.image && metrics.imageHeight) {
            g.appendChild(svgEl('image', {
                href: topic.image.src,
                x: (node.width - metrics.imageWidth) / 2,
                y: cursorY,
                width: metrics.imageWidth,
                height: metrics.imageHeight,
                preserveAspectRatio: 'xMidYMid slice'
            }));
            cursorY += metrics.imageHeight + IMAGE_GAP;
        }

        if (topic.icons.length) {
            const iconGroup = svgEl('g', { class: 'mm-icons' });
            topic.icons.forEach((icon, index) => {
                iconGroup.appendChild(svgEl('text', {
                    x: PAD_X + index * (ICON_SIZE + ICON_GAP),
                    y: cursorY + metrics.lineHeight * 0.78,
                    'font-size': ICON_SIZE,
                    text: icon
                }));
            });
            g.appendChild(iconGroup);
        }

        const text = svgEl('text', {
            class: 'mm-node-text',
            x: PAD_X + metrics.iconsWidth,
            y: cursorY + metrics.lineHeight * 0.78,
            fill: style.color,
            'font-family': style.fontFamily,
            'font-size': style.fontSize,
            'font-weight': style.bold ? '700' : '400',
            'font-style': style.italic ? 'italic' : 'normal',
            'text-decoration': style.underline ? 'underline' : null,
            'dominant-baseline': 'auto'
        });
        metrics.lines.forEach((line, index) => {
            text.appendChild(svgEl('tspan', {
                x: PAD_X + metrics.iconsWidth,
                dy: index === 0 ? 0 : metrics.lineHeight,
                text: line
            }));
        });
        g.appendChild(text);

        // Note / link / tag markers sit just outside the top-right corner so
        // they never change the measured box.
        const badges = [];
        if (topic.note) badges.push({ glyph: '✎', title: 'Has a note' });
        if (topic.links.length) badges.push({ glyph: '\u{1F517}', title: 'Has a link' });
        if (topic.tags.length) badges.push({ glyph: '#', title: topic.tags.join(', ') });
        badges.forEach((badge, index) => {
            const bx = node.width - 6 - index * 15;
            const marker = svgEl('g', { class: 'mm-badge' });
            marker.appendChild(svgEl('circle', { cx: bx, cy: -2, r: 7.5 }));
            marker.appendChild(svgEl('text', { x: bx, y: 1.5, 'text-anchor': 'middle', 'font-size': 8, text: badge.glyph }));
            marker.appendChild(svgEl('title', { text: badge.title }));
            g.appendChild(marker);
        });

        if (topic.children.length) {
            g.appendChild(collapseToggle(topic, node, result, style));
        }

        return g;
    }
}

// ------------------------------------------------------------------ helpers

function center(node) {
    return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

function shapeFor(style, width, height) {
    const common = {
        class: 'mm-node-shape',
        fill: style.background,
        stroke: style.border,
        'stroke-width': style.borderWidth
    };
    if (style.shape === 'ellipse') {
        return svgEl('ellipse', { ...common, cx: width / 2, cy: height / 2, rx: width / 2, ry: height / 2 });
    }
    if (style.shape === 'diamond') {
        const d = 'M' + width / 2 + ',0 L' + width + ',' + height / 2 + ' L' + width / 2 + ',' + height + ' L0,' + height / 2 + ' Z';
        return svgEl('path', { ...common, d });
    }
    if (style.shape === 'underline') {
        const g = svgEl('g');
        g.appendChild(svgEl('rect', { x: 0, y: 0, width, height, fill: 'transparent', stroke: 'none' }));
        g.appendChild(svgEl('line', {
            class: 'mm-node-shape',
            x1: 0, y1: height, x2: width, y2: height,
            stroke: style.border, 'stroke-width': Math.max(2, style.borderWidth)
        }));
        return g;
    }
    if (style.shape === 'none') {
        return svgEl('rect', { class: 'mm-node-shape', x: 0, y: 0, width, height, fill: 'transparent', stroke: 'none' });
    }
    const radius = style.shape === 'rect' ? 0 : style.borderRadius;
    return svgEl('rect', { ...common, x: 0, y: 0, width, height, rx: radius, ry: radius });
}

function collapseToggle(topic, node, result, style) {
    const side = node.side === 'root'
        ? (result.layout === 'org' ? 'down' : 'right')
        : node.side;
    let cx;
    let cy;
    if (side === 'down') { cx = node.width / 2; cy = node.height + 11; }
    else if (side === 'left') { cx = -11; cy = node.height / 2; }
    else { cx = node.width + 11; cy = node.height / 2; }

    const g = svgEl('g', {
        class: 'mm-toggle' + (topic.collapsed ? ' is-collapsed' : ''),
        dataset: { toggle: topic.id }
    });
    g.appendChild(svgEl('circle', { cx, cy, r: 8, fill: '#ffffff', stroke: style.branchColor, 'stroke-width': 1.5 }));
    g.appendChild(svgEl('line', { x1: cx - 4, y1: cy, x2: cx + 4, y2: cy, stroke: style.branchColor, 'stroke-width': 1.6 }));
    if (topic.collapsed) {
        g.appendChild(svgEl('line', { x1: cx, y1: cy - 4, x2: cx, y2: cy + 4, stroke: style.branchColor, 'stroke-width': 1.6 }));
        g.appendChild(svgEl('text', {
            class: 'mm-toggle-count',
            x: cx, y: cy + 21, 'text-anchor': 'middle', 'font-size': 10,
            fill: style.branchColor,
            text: String(topic.children.length)
        }));
    }
    g.appendChild(svgEl('title', { text: topic.collapsed ? 'Expand' : 'Collapse' }));
    return g;
}

/**
 * The “+” affordance beside the focused topic: click it to add a child,
 * the same command the toolbar and Tab run. It sits on the side the branch
 * grows towards, clear of the collapse toggle when there is one.
 */
function quickAddButton(topic, node, result, style) {
    const side = node.side === 'root'
        ? (result.layout === 'org' ? 'down' : 'right')
        : node.side;
    const offset = topic.children.length ? 32 : 14;
    let cx;
    let cy;
    if (side === 'down') { cx = node.width / 2; cy = node.height + offset; }
    else if (side === 'left') { cx = -offset; cy = node.height / 2; }
    else { cx = node.width + offset; cy = node.height / 2; }

    const g = svgEl('g', { class: 'mm-quick-add', dataset: { quickAdd: topic.id } });
    g.appendChild(svgEl('circle', { class: 'mm-quick-add-hit', cx, cy, r: 13, fill: 'transparent' }));
    g.appendChild(svgEl('circle', { class: 'mm-quick-add-dot', cx, cy, r: 9, stroke: style.branchColor }));
    g.appendChild(svgEl('line', { x1: cx - 4.5, y1: cy, x2: cx + 4.5, y2: cy }));
    g.appendChild(svgEl('line', { x1: cx, y1: cy - 4.5, x2: cx, y2: cy + 4.5 }));
    g.appendChild(svgEl('title', { text: 'Add a sub-topic (Tab)' }));
    return g;
}

/** Drag the right edge to set a manual box width; double-click to clear it. */
function resizeHandle(topic, node) {
    const g = svgEl('g', { class: 'mm-resize-handle', dataset: { resize: topic.id } });
    g.appendChild(svgEl('rect', {
        class: 'mm-resize-hit',
        x: node.width - 7, y: node.height / 2 - 14, width: 14, height: 28,
        fill: 'transparent'
    }));
    g.appendChild(svgEl('rect', {
        class: 'mm-resize-grip',
        x: node.width - 2.5, y: node.height / 2 - 9, width: 5, height: 18, rx: 2.5, ry: 2.5
    }));
    g.appendChild(svgEl('title', { text: 'Drag to resize · double-click to fit the text' }));
    return g;
}

/**
 * Branch geometry. `connector` comes from the layout, `curve` from the topic's
 * own branch style when it sets one.
 */
export function edgePath(parentNode, childNode, connector, curve) {
    const vertical = childNode.side === 'down' || connector === 'orgElbow';
    const kind = curve && curve !== 'curve' ? curve : (connector === 'bracket' ? 'bracket' : curve || connector);

    if (vertical) {
        const p = { x: parentNode.x + parentNode.width / 2, y: parentNode.y + parentNode.height };
        const c = { x: childNode.x + childNode.width / 2, y: childNode.y };
        if (kind === 'straight') return 'M' + p.x + ',' + p.y + ' L' + c.x + ',' + c.y;
        const midY = p.y + (c.y - p.y) / 2;
        return 'M' + p.x + ',' + p.y + ' V' + midY + ' H' + c.x + ' V' + c.y;
    }

    const toRight = childNode.side !== 'left';
    const p = toRight
        ? { x: parentNode.x + parentNode.width, y: parentNode.y + parentNode.height / 2 }
        : { x: parentNode.x, y: parentNode.y + parentNode.height / 2 };
    const c = toRight
        ? { x: childNode.x, y: childNode.y + childNode.height / 2 }
        : { x: childNode.x + childNode.width, y: childNode.y + childNode.height / 2 };

    if (kind === 'straight') return 'M' + p.x + ',' + p.y + ' L' + c.x + ',' + c.y;
    if (kind === 'elbow') {
        const midX = p.x + (c.x - p.x) / 2;
        return 'M' + p.x + ',' + p.y + ' H' + midX + ' V' + c.y + ' H' + c.x;
    }
    if (kind === 'bracket') {
        const midX = p.x + (toRight ? 22 : -22);
        return 'M' + p.x + ',' + p.y + ' H' + midX + ' V' + c.y + ' H' + c.x;
    }
    const dx = (c.x - p.x) * 0.5;
    return 'M' + p.x + ',' + p.y +
        ' C' + (p.x + dx) + ',' + p.y + ' ' + (c.x - dx) + ',' + c.y + ' ' + c.x + ',' + c.y;
}

function arrowMarker(id, color) {
    const marker = document.createElementNS(NS, 'marker');
    marker.setAttribute('id', id);
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '6');
    marker.setAttribute('markerHeight', '6');
    marker.setAttribute('orient', 'auto-start-reverse');
    marker.appendChild(svgEl('path', { d: 'M0,1 L10,5 L0,9 z', fill: color }));
    return marker;
}
