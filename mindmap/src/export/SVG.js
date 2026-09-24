/**
 * SVG export.
 *
 * Rather than scraping the live editor canvas (which carries selection rings,
 * drag ghosts and a viewport transform), the map is rendered again into a
 * detached <svg> at 1:1 with the same renderer. That keeps the export
 * pixel-identical to what is on screen and free of editor chrome.
 *
 * Presentation that lives in the stylesheet has to be inlined, because the
 * downloaded file cannot reach editor.css.
 */
import { SVGCanvas } from '../canvas/SVGCanvas.js';
import { Viewport } from '../canvas/Zoom.js';
import { calculate } from '../layout/LayoutEngine.js';

const EXPORT_CSS = [
    '.mm-node-text{dominant-baseline:auto;white-space:pre}',
    '.mm-badge circle{fill:#ffffff;stroke:#c9d2e3;stroke-width:1}',
    '.mm-badge text{fill:#5b6478}',
    '.mm-relationship-label{font-family:Inter,sans-serif;font-size:11px;fill:#6b7280}',
    '.mm-boundary-label{font-family:Inter,sans-serif;font-size:11px;font-weight:600}',
    '.mm-toggle-count{font-family:Inter,sans-serif}'
].join('');

export const PADDING = 32;

/**
 * @returns {{ svg: SVGElement, markup: string, width: number, height: number }}
 */
export function renderStandaloneSVG(map, doc, options = {}) {
    const result = options.result || calculate(map, { layout: doc.view.layout, theme: doc.view.theme });
    const bounds = result.bounds;
    const pad = options.padding ?? PADDING;
    const width = Math.max(1, Math.round(bounds.width + pad * 2));
    const height = Math.max(1, Math.round(bounds.height + pad * 2));

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', [
        Math.round(bounds.minX - pad),
        Math.round(bounds.minY - pad),
        width,
        height
    ].join(' '));

    const canvas = new SVGCanvas({ svg, viewport: new Viewport({ x: 0, y: 0, scale: 1 }) });
    canvas.render({
        map,
        result,
        selectedIds: new Set(),
        primaryId: null,
        matches: new Set(),
        editingId: null
    });

    // Background + inlined styles go first so they sit behind everything.
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = EXPORT_CSS;
    svg.insertBefore(style, svg.firstChild);

    if (options.background !== false) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', String(Math.round(bounds.minX - pad)));
        rect.setAttribute('y', String(Math.round(bounds.minY - pad)));
        rect.setAttribute('width', String(width));
        rect.setAttribute('height', String(height));
        rect.setAttribute('fill', options.background || result.theme.canvas);
        svg.insertBefore(rect, style.nextSibling);
    }

    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = doc.meta.title;
    svg.insertBefore(title, svg.firstChild);

    const markup = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg);
    return { svg, markup, width, height, bounds };
}

export function exportSVG(map, doc, options = {}) {
    return renderStandaloneSVG(map, doc, options).markup;
}
