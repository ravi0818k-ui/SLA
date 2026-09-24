/**
 * A Topic is a plain serialisable object — no class, no methods — so that the
 * whole document is structurally clonable and JSON round-trips without a
 * custom reviver. All tree behaviour lives in MindMap.js.
 *
 * Shape (requirement 3):
 *   { id, parentId, text, children, position, style, note, tags, links, icons, image }
 */
import { uid } from '../util/id.js';
import { asText, safeUrl, safeImageSrc, safeColor, clampNumber, oneOf } from '../util/sanitize.js';

export const SHAPES = ['rounded', 'rect', 'ellipse', 'diamond', 'underline', 'none'];
export const BRANCH_STYLES = ['solid', 'dashed', 'dotted'];
export const BRANCH_CURVES = ['curve', 'elbow', 'straight'];
/** Outline numbering a topic switches on for everything beneath it. */
export const NUMBERING_STYLES = ['', 'number', 'letter', 'roman'];

/** Bounds for a manually resized topic box. */
export const MIN_TOPIC_WIDTH = 54;
export const MAX_TOPIC_WIDTH = 900;

/** Style keys a topic may carry. Anything else is dropped on import. */
export function normalizeStyle(style) {
    const s = style && typeof style === 'object' ? style : {};
    const out = {};
    if (s.fontFamily) out.fontFamily = asText(s.fontFamily, 80);
    if (s.fontSize !== undefined) out.fontSize = clampNumber(s.fontSize, 8, 96, 14);
    if (s.bold) out.bold = true;
    if (s.italic) out.italic = true;
    if (s.underline) out.underline = true;
    if (s.color) out.color = safeColor(s.color);
    if (s.background) out.background = safeColor(s.background);
    if (s.border) out.border = safeColor(s.border);
    if (s.borderWidth !== undefined) out.borderWidth = clampNumber(s.borderWidth, 0, 12, 1);
    if (s.borderRadius !== undefined) out.borderRadius = clampNumber(s.borderRadius, 0, 60, 8);
    if (s.shape) out.shape = oneOf(s.shape, SHAPES, 'rounded');
    // A manual box width (dragged resize handle). Absent = size to the text.
    if (s.width) out.width = clampNumber(s.width, MIN_TOPIC_WIDTH, MAX_TOPIC_WIDTH, 0) || undefined;
    if (s.branchColor) out.branchColor = safeColor(s.branchColor);
    if (s.branchWidth !== undefined) out.branchWidth = clampNumber(s.branchWidth, 1, 12, 2);
    if (s.branchStyle) out.branchStyle = oneOf(s.branchStyle, BRANCH_STYLES, 'solid');
    if (s.branchCurve) out.branchCurve = oneOf(s.branchCurve, BRANCH_CURVES, 'curve');
    // Clean out keys whose value failed validation and came back as ''.
    for (const key of Object.keys(out)) if (out[key] === '' || out[key] === undefined) delete out[key];
    return out;
}

export function createTopic(props = {}) {
    return normalizeTopic({ id: props.id || uid('t'), ...props });
}

/**
 * Coerce an arbitrary object (from an imported file, say) into a valid topic.
 * Never throws — an unusable field becomes its default.
 */
export function normalizeTopic(raw) {
    const t = raw && typeof raw === 'object' ? raw : {};
    const position = t.position && typeof t.position === 'object' && t.position.x !== undefined
        ? { x: clampNumber(t.position.x, -1e6, 1e6, 0), y: clampNumber(t.position.y, -1e6, 1e6, 0) }
        : null;
    return {
        id: asText(t.id, 64) || uid('t'),
        parentId: t.parentId ? asText(t.parentId, 64) : null,
        text: asText(t.text, 4000),
        children: Array.isArray(t.children) ? t.children.map((c) => asText(c, 64)).filter(Boolean) : [],
        // position is the *manual* override; null means "let the layout decide".
        position,
        style: normalizeStyle(t.style),
        note: asText(t.note, 20000),
        tags: Array.isArray(t.tags) ? t.tags.map((x) => asText(x, 60)).filter(Boolean).slice(0, 30) : [],
        links: Array.isArray(t.links)
            ? t.links.map((l) => ({
                url: safeUrl(typeof l === 'string' ? l : l && l.url),
                label: asText(l && l.label, 120)
            })).filter((l) => l.url).slice(0, 20)
            : [],
        icons: Array.isArray(t.icons) ? t.icons.map((x) => asText(x, 8)).filter(Boolean).slice(0, 8) : [],
        image: t.image ? normalizeImage(t.image) : null,
        // Display-only: numbers the subtree beneath this topic. Never written
        // into `text`, so exports and round trips are unaffected.
        numbering: t.numbering ? oneOf(t.numbering, NUMBERING_STYLES, '') : '',
        collapsed: Boolean(t.collapsed)
    };
}

function normalizeImage(image) {
    const src = safeImageSrc(typeof image === 'string' ? image : image && image.src);
    if (!src) return null;
    return {
        src,
        width: clampNumber(image && image.width, 16, 1200, 160),
        height: clampNumber(image && image.height, 16, 1200, 120),
        alt: asText(image && image.alt, 200)
    };
}

/** Deep copy of a topic with a fresh id and no children (children are re-linked by the caller). */
export function cloneTopic(topic, overrides = {}) {
    return normalizeTopic({
        ...structuredCloneSafe(topic),
        id: overrides.id || uid('t'),
        children: [],
        ...overrides
    });
}

function structuredCloneSafe(value) {
    if (typeof structuredClone === 'function') {
        try { return structuredClone(value); } catch { /* fall through */ }
    }
    return JSON.parse(JSON.stringify(value));
}

export { structuredCloneSafe };
