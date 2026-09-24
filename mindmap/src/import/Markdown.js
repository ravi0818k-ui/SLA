/**
 * Markdown -> mind map (requirement 11).
 *
 *   # JavaScript          -> root
 *   ## Variables          -> child of the root
 *   ### Arrow Functions   -> child of the previous ##
 *   - bullets             -> children of the heading above them, nested by indent
 *   > quoted text         -> the note of the topic above it
 *   [label](https://…)    -> a link on the topic above it
 *
 * The parser is deliberately forgiving: a file that starts at ## instead of #,
 * or that mixes bullets and headings, still produces a sensible tree. Headings
 * and bullets keep separate stacks, which is what stops a stray indent from
 * re-parenting a whole section.
 */
import { MindMap } from '../core/MindMap.js';
import { asText, safeUrl } from '../util/sanitize.js';

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const LINK_ONLY = /^\[([^\]]*)\]\(([^)]+)\)$/;

export function parseMarkdown(source, options = {}) {
    const text = asText(source, 2 * 1024 * 1024);
    const lines = text.split(/\r?\n/);
    const topLevel = minHeadingLevel(lines);

    const title = asText(options.title, 200) || firstHeading(lines) || 'Imported Map';
    const map = MindMap.create(title);

    const headingStack = { 0: map.rootId };
    let headingParent = map.rootId;
    let bulletStack = [];
    let last = map.rootId;
    let rootUsed = false;
    let inFence = false;

    for (const rawLine of lines) {
        const line = rawLine.replace(/\t/g, '    ');
        if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
        if (inFence || !line.trim()) continue;

        const heading = line.match(HEADING);
        if (heading) {
            const level = heading[1].length;
            const label = cleanInline(heading[2]);
            bulletStack = [];

            if (!rootUsed && level === topLevel) {
                // The first top-level heading *is* the root topic.
                map.setText(map.rootId, label);
                rootUsed = true;
                headingParent = map.rootId;
                last = map.rootId;
                for (const key of Object.keys(headingStack)) if (key !== '0') delete headingStack[key];
                headingStack[level] = map.rootId;
                continue;
            }

            let parentId = map.rootId;
            for (let l = level - 1; l >= 0; l -= 1) {
                if (headingStack[l] && map.topic(headingStack[l])) { parentId = headingStack[l]; break; }
            }
            const topic = map.addChild(parentId, label);
            for (const key of Object.keys(headingStack)) {
                if (Number(key) >= level) delete headingStack[key];
            }
            headingStack[level] = topic.id;
            headingParent = topic.id;
            last = topic.id;
            continue;
        }

        const bullet = line.match(BULLET);
        if (bullet) {
            const indent = Math.min(Math.floor(bullet[1].length / 2), 12);
            const label = cleanInline(bullet[2]);
            let parentId = headingParent;
            for (let i = indent - 1; i >= 0; i -= 1) {
                if (bulletStack[i]) { parentId = bulletStack[i]; break; }
            }
            const topic = map.addChild(map.topic(parentId) ? parentId : map.rootId, label);
            bulletStack.length = indent;
            bulletStack[indent] = topic.id;
            last = topic.id;
            continue;
        }

        const quote = line.match(QUOTE);
        if (quote && last) {
            appendNote(map, last, quote[1]);
            continue;
        }

        const linkOnly = line.trim().match(LINK_ONLY);
        if (linkOnly && last) {
            const url = safeUrl(linkOnly[2]);
            if (url) map.setLinks(last, [...map.topic(last).links, { url, label: linkOnly[1] }]);
            continue;
        }

        // A plain paragraph becomes (part of) the note on the topic above it.
        if (last) appendNote(map, last, line.trim());
    }

    return map;
}

function appendNote(map, id, line) {
    const topic = map.topic(id);
    if (!topic) return;
    topic.note = topic.note ? topic.note + '\n' + line : line;
}

function firstHeading(lines) {
    for (const line of lines) {
        const match = line.match(HEADING);
        if (match) return cleanInline(match[2]);
    }
    return '';
}

function minHeadingLevel(lines) {
    let min = 7;
    for (const line of lines) {
        const match = line.match(HEADING);
        if (match) min = Math.min(min, match[1].length);
    }
    return min === 7 ? 1 : min;
}

/**
 * Strip the Markdown formatting characters so topic text is stored plain — but
 * honour backslash escapes first, so a topic that really is called "*star*"
 * comes back intact from our own exporter (export/Markdown.js's escapeInline()
 * is the matching escaper).
 */
function cleanInline(value) {
    const escaped = [];
    // Park each escaped character in a private-use placeholder so the
    // formatting strip below cannot touch it.
    let text = asText(value, 4000)
        .replace(/\\([\\`*_~[\]#>-])/g, (match, char) => {
            escaped.push(char);
            return '' + (escaped.length - 1) + '';
        });

    text = text
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/[*_`~]/g, '')
        .trim();

    return text.replace(/(\d+)/g, (match, index) => escaped[Number(index)]);
}
