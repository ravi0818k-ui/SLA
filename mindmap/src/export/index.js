/**
 * Export dispatcher plus the browser download plumbing.
 */
import { exportDocument, exportOutline } from './JSON.js';
import { exportMarkdown } from './Markdown.js';
import { exportSVG } from './SVG.js';
import { exportPNG } from './PNG.js';
import { exportPDF } from './PDF.js';
import { fileNameFor } from '../core/Document.js';

export const FORMATS = [
    { id: 'openmind', label: 'OpenMind file (.openmind)', extension: '.openmind', hint: 'Lossless — re-open it here later' },
    { id: 'json', label: 'JSON outline (.json)', extension: '.json', hint: 'For other tools and scripts' },
    { id: 'markdown', label: 'Markdown (.md)', extension: '.md', hint: 'Headings and bullets' },
    { id: 'svg', label: 'SVG image (.svg)', extension: '.svg', hint: 'Sharp at any size' },
    { id: 'png', label: 'PNG image (.png)', extension: '.png', hint: 'Easy to share' },
    { id: 'pdf', label: 'PDF (.pdf)', extension: '.pdf', hint: 'Ready to print' }
];

export async function buildExport(format, map, doc, options = {}) {
    switch (format) {
        case 'openmind':
            return { blob: textBlob(exportDocument(map, doc), 'application/json'), extension: '.openmind' };
        case 'json':
            return { blob: textBlob(exportOutline(map), 'application/json'), extension: '.json' };
        case 'markdown':
            return { blob: textBlob(exportMarkdown(map, doc), 'text/markdown'), extension: '.md' };
        case 'svg':
            return { blob: textBlob(exportSVG(map, doc, options), 'image/svg+xml'), extension: '.svg' };
        case 'png':
            return { blob: await exportPNG(map, doc, options), extension: '.png' };
        case 'pdf':
            return { blob: await exportPDF(map, doc, options), extension: '.pdf' };
        default:
            throw new Error('Unknown export format: ' + format);
    }
}

export async function downloadExport(format, map, doc, options = {}) {
    const { blob, extension } = await buildExport(format, map, doc, options);
    downloadBlob(blob, fileNameFor(doc, extension));
    return true;
}

export function textBlob(text, type) {
    return new Blob([text], { type: type + ';charset=utf-8' });
}

export function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Safari needs the URL to outlive the click by a tick.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export { exportDocument, exportOutline, exportMarkdown, exportSVG, exportPNG, exportPDF };
