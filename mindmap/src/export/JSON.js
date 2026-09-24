/**
 * JSON / .openmind export.
 *
 * `exportDocument` writes the full versioned document — that is the .openmind
 * payload, and the only lossless format. `exportOutline` writes the small
 * nested { text, children } shape that other tools understand.
 */
import { touchDocument, FORMAT_VERSION } from '../core/Document.js';

export function exportDocument(map, doc) {
    const payload = {
        formatVersion: FORMAT_VERSION,
        meta: { ...doc.meta },
        view: { ...doc.view },
        map: map.toState(),
        assets: doc.assets || {}
    };
    touchDocument(payload, map);
    return JSON.stringify(payload, null, 2);
}

export function exportOutline(map) {
    const build = (topic) => {
        const node = { text: topic.text };
        if (topic.note) node.note = topic.note;
        if (topic.icons.length) node.icons = [...topic.icons];
        if (topic.tags.length) node.tags = [...topic.tags];
        if (topic.links.length) node.links = topic.links.map((l) => ({ ...l }));
        const children = map.childrenOf(topic.id);
        if (children.length) node.children = children.map(build);
        return node;
    };
    return JSON.stringify(build(map.root), null, 2);
}
