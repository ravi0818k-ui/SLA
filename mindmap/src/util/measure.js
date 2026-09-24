/**
 * Text measurement for node sizing.
 *
 * The layout engine needs a width/height for every topic *before* anything is
 * rendered, so measuring live SVG <text> nodes (a reflow per node) is too slow
 * at the 1,000+ node target. A single offscreen canvas 2d context measures
 * synchronously and results are cached per font+string, which keeps a full
 * relayout of a large map inside one frame.
 */

const cache = new Map();
let ctx;

function context() {
    if (ctx !== undefined) return ctx;
    ctx = null;
    if (typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        if (canvas.getContext) ctx = canvas.getContext('2d');
    }
    return ctx;
}

/** Approximate width used when canvas is unavailable (jsdom, old browsers). */
function estimate(text, fontSize) {
    return text.length * fontSize * 0.56;
}

export function measureText(text, opts = {}) {
    const { fontSize = 14, fontFamily = 'Inter, sans-serif', bold = false, italic = false } = opts;
    const str = String(text ?? '');
    const key = (bold ? 'b' : '') + (italic ? 'i' : '') + fontSize + '|' + fontFamily + '|' + str;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const c = context();
    let width;
    if (c) {
        c.font = (italic ? 'italic ' : '') + (bold ? '700 ' : '400 ') + fontSize + 'px ' + fontFamily;
        width = c.measureText(str).width;
        if (!width && str) width = estimate(str, fontSize);
    } else {
        width = estimate(str, fontSize);
    }
    if (cache.size > 5000) cache.clear();
    cache.set(key, width);
    return width;
}

/**
 * Wrap `text` to at most `maxWidth` px, breaking on spaces and hard-breaking
 * words longer than a line on their own. Always returns at least one line.
 */
export function wrapText(text, maxWidth, font) {
    const source = String(text ?? '');
    if (!source) return [''];
    const lines = [];
    for (const paragraph of source.split('\n')) {
        const words = paragraph.split(/\s+/).filter(Boolean);
        if (!words.length) { lines.push(''); continue; }
        let line = '';
        for (const word of words) {
            const candidate = line ? line + ' ' + word : word;
            if (measureText(candidate, font) <= maxWidth) { line = candidate; continue; }
            if (line) { lines.push(line); line = ''; }
            if (measureText(word, font) <= maxWidth) { line = word; continue; }
            // Single word longer than a line — hard-break it.
            let chunk = '';
            for (const ch of word) {
                if (chunk && measureText(chunk + ch, font) > maxWidth) {
                    lines.push(chunk);
                    chunk = ch;
                } else chunk += ch;
            }
            line = chunk;
        }
        if (line) lines.push(line);
    }
    return lines.length ? lines : [''];
}

export function clearMeasureCache() { cache.clear(); }
