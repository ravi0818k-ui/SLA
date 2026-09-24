/**
 * Mind map -> Markdown.
 *
 * The first three levels become headings and anything deeper becomes an
 * indented bullet list, which is the shape import/Markdown.js reads back — so
 * a map exported to Markdown and re-imported keeps its structure, its notes
 * (blockquotes) and its links.
 */
import { asText } from '../util/sanitize.js';

export const HEADING_DEPTH = 3;

export function exportMarkdown(map, doc, options = {}) {
    const headingDepth = options.headingDepth ?? HEADING_DEPTH;
    const lines = [];

    const emit = (topic, depth) => {
        const text = escapeInline(asText(topic.text, 4000).replace(/\n+/g, ' ').trim()) || '(untitled)';
        const icons = topic.icons.length ? topic.icons.join(' ') + ' ' : '';

        if (depth < headingDepth) {
            lines.push('');
            lines.push('#'.repeat(depth + 1) + ' ' + icons + text);
        } else {
            lines.push('  '.repeat(depth - headingDepth) + '- ' + icons + text);
        }

        if (topic.tags.length) {
            lines.push('  '.repeat(Math.max(0, depth - headingDepth + 1)) + '`' + topic.tags.join('` `') + '`');
        }
        if (topic.note) {
            lines.push('');
            for (const line of topic.note.split('\n')) lines.push('> ' + line);
            lines.push('');
        }
        for (const link of topic.links) {
            lines.push('[' + (link.label || link.url) + '](' + link.url + ')');
        }

        for (const child of map.childrenOf(topic.id)) emit(child, depth + 1);
    };

    emit(map.root, 0);

    if (map.relationships.length) {
        lines.push('');
        lines.push('---');
        lines.push('');
        lines.push('**Relationships**');
        lines.push('');
        for (const rel of map.relationships) {
            const from = map.topic(rel.fromId);
            const to = map.topic(rel.toId);
            if (!from || !to) continue;
            lines.push('- ' + from.text + ' → ' + to.text + (rel.label ? ' (' + rel.label + ')' : ''));
        }
    }

    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/**
 * Escape the characters Markdown would otherwise read as formatting, so a
 * topic literally called "*star*" survives an export/import round trip.
 * import/Markdown.js's cleanInline() is the matching un-escaper.
 */
function escapeInline(text) {
    return text
        .replace(/([\\`*_~[\]])/g, '\\$1')
        .replace(/^([#>-])/, '\\$1');
}

/** The plain-text outline used by the outline panel's "copy" action. */
export function exportOutlineText(map) {
    return map.walk(false)
        .map(({ topic, depth }) => '  '.repeat(depth) + (topic.text || '(untitled)'))
        .join('\n') + '\n';
}
