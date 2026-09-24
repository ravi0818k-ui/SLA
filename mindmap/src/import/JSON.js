/**
 * JSON / .openmind import.
 *
 * Three shapes are accepted, all validated before anything is trusted:
 *   1. a full OpenMind document  ({ formatVersion, meta, map, … })
 *   2. a bare map state          ({ rootId, topics })
 *   3. a nested outline          ({ text, children: [ … ] })
 *
 * The nested form is what most other tools export, so it is worth supporting —
 * it is also the shape our own clipboard uses.
 */
import { parseDocument, createDocument } from '../core/Document.js';
import { MindMap } from '../core/MindMap.js';
import { asText } from '../util/sanitize.js';

const MAX_NODES = 20000;

export function parseJSON(source, options = {}) {
    let data = source;
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { throw new Error('This file is not valid JSON.'); }
    }
    if (!data || typeof data !== 'object') throw new Error('This file does not contain a mind map.');

    if (data.formatVersion || (data.meta && data.map)) {
        return { document: parseDocument(data) };
    }
    if (data.rootId && data.topics) {
        const map = MindMap.fromState(data);
        return { document: createDocument({ title: options.title || 'Imported Map', map }) };
    }
    if (typeof data.text === 'string' || Array.isArray(data.children)) {
        const map = fromOutline(data);
        return { document: createDocument({ title: options.title || map.root.text, map }) };
    }
    throw new Error('This JSON file is not a mind map.');
}

/** { text, children: [...] } -> MindMap, with a hard node cap. */
export function fromOutline(node) {
    const map = MindMap.create(asText(node.text, 200) || 'Imported Map');
    let count = 1;
    const walk = (source, parentId) => {
        const children = Array.isArray(source.children) ? source.children : [];
        for (const child of children) {
            if (count >= MAX_NODES) return;
            if (!child || typeof child !== 'object') {
                if (typeof child === 'string') {
                    map.addChild(parentId, asText(child, 4000));
                    count += 1;
                }
                continue;
            }
            const topic = map.addChild(parentId, asText(child.text ?? child.title ?? child.name, 4000));
            count += 1;
            if (child.note) map.setNote(topic.id, child.note);
            if (Array.isArray(child.icons)) map.setIcons(topic.id, child.icons);
            if (Array.isArray(child.tags)) map.setTags(topic.id, child.tags);
            if (Array.isArray(child.links)) map.setLinks(topic.id, child.links);
            if (child.collapsed) topic.collapsed = true;
            walk(child, topic.id);
        }
    };
    walk(node, map.rootId);
    return map;
}
