/**
 * Relationships (free arrows between any two topics) and boundaries (an
 * outline drawn around a topic and its subtree). Both are document-level
 * lists rather than topic fields, because they cross the tree.
 */
import { uid } from '../util/id.js';
import { asText, safeColor, oneOf } from '../util/sanitize.js';

export const DASH_STYLES = ['solid', 'dashed', 'dotted'];

export function normalizeRelationship(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const fromId = asText(r.fromId, 64);
    const toId = asText(r.toId, 64);
    if (!fromId || !toId || fromId === toId) return null;
    return {
        id: asText(r.id, 64) || uid('r'),
        fromId,
        toId,
        label: asText(r.label, 200),
        style: {
            color: safeColor(r.style && r.style.color, '#8a94a6') || '#8a94a6',
            dash: oneOf(r.style && r.style.dash, DASH_STYLES, 'dashed')
        }
    };
}

export function normalizeBoundary(raw) {
    const b = raw && typeof raw === 'object' ? raw : {};
    const topicId = asText(b.topicId, 64);
    if (!topicId) return null;
    return {
        id: asText(b.id, 64) || uid('b'),
        topicId,
        label: asText(b.label, 200),
        style: { color: safeColor(b.style && b.style.color, '#1E5EFF') || '#1E5EFF' }
    };
}

/** SVG dash-array for a dash style, or null for a solid line. */
export function dashArray(style, width = 2) {
    if (style === 'dashed') return (width * 3) + ' ' + (width * 2);
    if (style === 'dotted') return width + ' ' + (width * 2);
    return null;
}
