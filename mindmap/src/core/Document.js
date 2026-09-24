/**
 * The .openmind document (requirement 10).
 *
 * A document is one JSON object with three parts that mirror the folder layout
 * described in the spec:
 *   document.json  -> `map` (topics, relationships, boundaries) + view settings
 *   metadata.json  -> `meta` (id, title, timestamps, counts)
 *   assets/        -> `assets` (id -> data URI), referenced by topic.image.src
 *
 * Everything is versioned by `formatVersion`; `migrate()` is the single place a
 * future version bump gets handled, and an unknown *major* version is refused
 * rather than silently mis-read.
 */
import { MindMap } from './MindMap.js';
import { DEFAULT_THEME, THEMES } from './Theme.js';
import { LAYOUTS, DEFAULT_LAYOUT } from '../layout/LayoutEngine.js';
import { uid } from '../util/id.js';
import { asText, oneOf, clampNumber } from '../util/sanitize.js';

export const FORMAT_VERSION = '1.0';
export const FILE_EXTENSION = '.openmind';

export function createDocument(options = {}) {
    const title = asText(options.title, 200) || 'Untitled Mind Map';
    const map = options.map instanceof MindMap
        ? options.map
        : MindMap.create(asText(options.rootText, 200) || title);
    const now = new Date().toISOString();
    return {
        formatVersion: FORMAT_VERSION,
        meta: {
            id: options.id || uid('map'),
            title,
            description: asText(options.description, 500),
            createdAt: now,
            updatedAt: now,
            topicCount: map.size
        },
        view: {
            theme: oneOf(options.theme, Object.keys(THEMES), DEFAULT_THEME),
            layout: oneOf(options.layout, LAYOUTS, DEFAULT_LAYOUT),
            zoom: 1,
            pan: { x: 0, y: 0 }
        },
        map: map.toState(),
        assets: {}
    };
}

/**
 * Validate + normalise anything claiming to be an OpenMind document.
 * Throws with a readable message when the file cannot be used at all.
 */
export function parseDocument(raw) {
    let data = raw;
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { throw new Error('This file is not valid JSON.'); }
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('This file does not contain a mind map.');
    }
    data = migrate(data);

    const map = MindMap.fromState(data.map || data.mindMap || {});
    const meta = data.meta && typeof data.meta === 'object' ? data.meta : {};
    const view = data.view && typeof data.view === 'object' ? data.view : {};
    const now = new Date().toISOString();

    return {
        formatVersion: FORMAT_VERSION,
        meta: {
            id: asText(meta.id, 64) || uid('map'),
            title: asText(meta.title, 200) || 'Untitled Mind Map',
            description: asText(meta.description, 500),
            createdAt: isoOr(meta.createdAt, now),
            updatedAt: isoOr(meta.updatedAt, now),
            topicCount: map.size
        },
        view: {
            theme: oneOf(asText(view.theme, 40), Object.keys(THEMES), DEFAULT_THEME),
            layout: oneOf(asText(view.layout, 40), LAYOUTS, DEFAULT_LAYOUT),
            zoom: clampNumber(view.zoom, 0.1, 5, 1),
            pan: {
                x: clampNumber(view.pan && view.pan.x, -1e6, 1e6, 0),
                y: clampNumber(view.pan && view.pan.y, -1e6, 1e6, 0)
            }
        },
        map: map.toState(),
        assets: normalizeAssets(data.assets)
    };
}

function normalizeAssets(assets) {
    const out = {};
    if (!assets || typeof assets !== 'object') return out;
    for (const [key, value] of Object.entries(assets)) {
        const id = asText(key, 64);
        const src = typeof value === 'string' ? value : value && value.src;
        if (id && typeof src === 'string' && /^data:image\//i.test(src)) out[id] = src;
    }
    return out;
}

function isoOr(value, fallback) {
    const s = asText(value, 40);
    const d = s ? new Date(s) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toISOString() : fallback;
}

/**
 * Bring an older document up to FORMAT_VERSION. Documents written by a newer
 * *major* version are refused, because we cannot know what we would be dropping.
 */
export function migrate(data) {
    const version = asText(data.formatVersion, 20) || '1.0';
    const major = parseInt(version.split('.')[0], 10) || 1;
    const currentMajor = parseInt(FORMAT_VERSION.split('.')[0], 10);
    if (major > currentMajor) {
        throw new Error('This map was made with a newer version of OpenMind (format ' + version + ').');
    }
    // No breaking changes yet — future migrations chain here, oldest first.
    return { ...data, formatVersion: FORMAT_VERSION };
}

/** Stamp updatedAt/topicCount right before a save. */
export function touchDocument(doc, map) {
    doc.meta.updatedAt = new Date().toISOString();
    doc.meta.topicCount = map ? map.size : Object.keys(doc.map.topics || {}).length;
    return doc;
}

/** A short, filesystem-safe name derived from the map title. */
export function fileNameFor(doc, extension) {
    const base = asText(doc && doc.meta && doc.meta.title, 80)
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .toLowerCase() || 'mind-map';
    return base + extension;
}
