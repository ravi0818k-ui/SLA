/**
 * Security helpers (requirement 18). Everything that arrives from an imported
 * file, a pasted string or a user-typed URL passes through here before it is
 * allowed anywhere near the DOM or an <a href>.
 *
 * The app never assigns user content to innerHTML and never calls eval(); these
 * helpers exist so that data which *looks* like markup is stored as inert text.
 */

const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

/** Collapse anything non-string (objects, arrays, null) to a plain string. */
export function asText(value, max = 20000) {
    if (value === null || value === undefined) return '';
    let s = typeof value === 'string' ? value : String(value);
    // Strip control characters that would break SVG serialisation.
    s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
    return s.length > max ? s.slice(0, max) : s;
}

/**
 * Returns a safe absolute URL string, or '' when the input is not a link we are
 * willing to render. Blocks javascript:, vbscript:, data: and anything that
 * fails to parse.
 */
export function safeUrl(value) {
    const raw = asText(value, 2048).trim();
    if (!raw) return '';
    const base = typeof location !== 'undefined' ? location.href : 'https://localhost/';
    let url;
    try {
        url = new URL(raw, base);
    } catch {
        try { url = new URL('https://' + raw); } catch { return ''; }
    }
    return SAFE_PROTOCOLS.includes(url.protocol) ? url.href : '';
}

/**
 * Images may be remote (http/https) or an inline data: URI, but only for image
 * media types — a data:text/html payload would be a script vector.
 */
export function safeImageSrc(value) {
    const raw = asText(value, 8 * 1024 * 1024).trim();
    if (!raw) return '';
    if (/^data:image\/(png|jpeg|jpg|gif|webp|bmp);base64,[A-Za-z0-9+/=\s]+$/i.test(raw)) return raw;
    const url = safeUrl(raw);
    return /^https?:/i.test(url) ? url : '';
}

/** Clamp a number into a range, falling back when the value is not finite. */
export function clampNumber(value, min, max, fallback = min) {
    const n = typeof value === 'number' ? value : parseFloat(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

/** A CSS colour we are willing to write into a style attribute. */
export function safeColor(value, fallback = '') {
    const s = asText(value, 64).trim();
    if (!s) return fallback;
    if (/^#[0-9a-f]{3,8}$/i.test(s)) return s;
    if (/^rgba?\([\d.,%\s]+\)$/i.test(s)) return s;
    if (/^hsla?\([\d.,%\sdeg]+\)$/i.test(s)) return s;
    if (/^[a-z]{3,20}$/i.test(s)) return s.toLowerCase();
    return fallback;
}

/** One of a fixed set, or the fallback. Used for shapes, curves, layouts. */
export function oneOf(value, allowed, fallback) {
    return allowed.includes(value) ? value : fallback;
}
