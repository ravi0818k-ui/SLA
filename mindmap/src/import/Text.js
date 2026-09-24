/**
 * Plain text -> mind map. Hierarchy comes from leading whitespace: a tab or
 * every two spaces is one level. The first line (at indent 0) becomes the root
 * when there is exactly one such line, otherwise a wrapper root is created.
 */
import { MindMap } from '../core/MindMap.js';
import { asText } from '../util/sanitize.js';

export function parseText(source, options = {}) {
    const raw = asText(source, 2 * 1024 * 1024).split(/\r?\n/);
    const rows = [];
    for (const line of raw) {
        if (!line.trim()) continue;
        const expanded = line.replace(/\t/g, '  ');
        const indent = expanded.length - expanded.replace(/^\s+/, '').length;
        rows.push({
            depth: Math.floor(indent / 2),
            // Tolerate outline files that still carry bullets or tree glyphs.
            text: expanded.trim().replace(/^(?:[-*+•├└─│\s]+)/, '').trim() || expanded.trim()
        });
    }
    if (!rows.length) return MindMap.create(asText(options.title, 200) || 'Imported Map');

    const topLevel = rows.filter((row) => row.depth === rows[0].depth);
    const map = MindMap.create(
        asText(options.title, 200) || (topLevel.length === 1 ? rows[0].text : 'Imported Map')
    );

    const stack = [map.rootId];
    const start = topLevel.length === 1 && !options.title ? 1 : 0;
    const baseDepth = rows[0].depth;

    for (let i = start; i < rows.length; i += 1) {
        const row = rows[i];
        const level = Math.max(1, row.depth - baseDepth + (start === 1 ? 0 : 1));
        const parentId = stack[Math.min(level - 1, stack.length - 1)] || map.rootId;
        const topic = map.addChild(parentId, row.text);
        stack.length = level;
        stack[level] = topic.id;
    }
    return map;
}
