/**
 * Import dispatcher: picks a parser from the file extension, falling back to
 * sniffing the content. Always returns a full OpenMind document, so the caller
 * has one shape to deal with.
 *
 * Nothing here executes the file it reads (requirement 18) — the inputs are
 * text, and the only structured parse is JSON.parse.
 */
import { parseJSON } from './JSON.js';
import { parseMarkdown } from './Markdown.js';
import { parseText } from './Text.js';
import { createDocument } from '../core/Document.js';

export const MAX_IMPORT_BYTES = 12 * 1024 * 1024;

export const ACCEPTED = '.openmind,.json,.md,.markdown,.txt,.text,application/json,text/markdown,text/plain';

export function importString(content, { fileName = '', title = '' } = {}) {
    const name = String(fileName).toLowerCase();
    const trimmed = String(content).trim();

    if (name.endsWith('.json') || name.endsWith('.openmind') || /^[{[]/.test(trimmed)) {
        try {
            return parseJSON(content, { title });
        } catch (error) {
            // A .txt that merely starts with "{" should still import as text.
            if (name.endsWith('.json') || name.endsWith('.openmind')) throw error;
        }
    }
    if (name.endsWith('.md') || name.endsWith('.markdown') || /^#{1,6}\s/m.test(content)) {
        return { document: createDocument({ title: title || baseName(fileName), map: parseMarkdown(content, { title }) }) };
    }
    return { document: createDocument({ title: title || baseName(fileName), map: parseText(content, { title }) }) };
}

export async function importFile(file) {
    if (!file) throw new Error('No file selected.');
    if (file.size > MAX_IMPORT_BYTES) {
        throw new Error('That file is larger than ' + Math.round(MAX_IMPORT_BYTES / 1024 / 1024) + ' MB.');
    }
    const name = (file.name || '').toLowerCase();
    if (/\.(svg|html?|xml|js|exe|zip)$/i.test(name)) {
        throw new Error('Only .openmind, .json, .md and .txt files can be imported.');
    }
    const content = await file.text();
    const result = importString(content, { fileName: file.name });
    if (result.document && (!result.document.meta.title || result.document.meta.title === 'Untitled Mind Map')) {
        result.document.meta.title = baseName(file.name);
    }
    return result;
}

function baseName(fileName) {
    return String(fileName || '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Imported Map';
}

export { parseJSON, parseMarkdown, parseText };
