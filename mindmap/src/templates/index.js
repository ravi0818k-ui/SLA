/**
 * Templates are plain JSON under /mindmap/templates (requirement 15) — adding
 * one means dropping a file next to the others and adding a row to
 * templates/index.json. No application code changes.
 *
 * A template file is { id, name, description, icon, view, root }, where `root`
 * is the nested { text, children } outline that import/JSON.js already reads.
 */
import { fromOutline } from '../import/JSON.js';
import { createDocument } from '../core/Document.js';

const BASE = new URL('../../templates/', import.meta.url);

let catalogue = null;

export async function listTemplates() {
    if (catalogue) return catalogue;
    try {
        const response = await fetch(new URL('index.json', BASE));
        if (!response.ok) throw new Error('missing');
        const data = await response.json();
        catalogue = Array.isArray(data.templates) ? data.templates : [];
    } catch {
        // Offline and not yet cached — the blank template always works.
        catalogue = [{ id: 'blank', name: 'Blank Mind Map', description: 'One central topic.', icon: '⭕' }];
    }
    return catalogue;
}

export async function loadTemplate(id) {
    const safeId = String(id || 'blank').replace(/[^a-z0-9-]/gi, '');
    let data;
    try {
        const response = await fetch(new URL(safeId + '.json', BASE));
        if (!response.ok) throw new Error('missing');
        data = await response.json();
    } catch {
        return createDocument({ title: 'Untitled Mind Map' });
    }
    const map = fromOutline(data.root || { text: data.name || 'Central Topic' });
    return createDocument({
        title: data.name === 'Blank Mind Map' ? 'Untitled Mind Map' : (data.name || 'Untitled Mind Map'),
        map,
        theme: data.view && data.view.theme,
        layout: data.view && data.view.layout
    });
}
