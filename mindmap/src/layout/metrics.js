/**
 * Node sizing. Kept separate from LayoutEngine so the individual layouts can
 * import it without a circular dependency.
 *
 * A node's box is derived from its wrapped text plus whatever decorations it
 * carries (icons, image). The renderer lays the contents out using exactly the
 * same constants, so what the layout reserves is what gets drawn.
 */
import { measureText, wrapText } from '../util/measure.js';
import { resolveStyle } from '../core/Theme.js';

export const MAX_TEXT_WIDTH = 220;
export const MIN_NODE_WIDTH = 54;
export const PAD_X = 14;
export const PAD_Y = 9;
export const ICON_SIZE = 16;
export const ICON_GAP = 3;
export const LINE_RATIO = 1.35;
export const IMAGE_GAP = 6;
export const BADGE_ROW = 0;

/**
 * Measure one topic. Returns the box size plus the wrapped lines and the
 * resolved style, so the renderer does not have to repeat the work.
 */
export function measureNode(map, topic, theme) {
    const style = resolveStyle(map, topic, theme);

    const iconsWidth = topic.icons.length
        ? topic.icons.length * (ICON_SIZE + ICON_GAP)
        : 0;

    const box = textBox(displayText(map, topic), style, { iconsWidth });

    let imageWidth = 0;
    let imageHeight = 0;
    if (topic.image) {
        imageWidth = Math.min(topic.image.width || 160, 260);
        imageHeight = Math.round((topic.image.height || 120) * (imageWidth / (topic.image.width || 160)));
    }

    // A manual width (a dragged resize handle) wins; otherwise the box is as
    // wide as its widest line.
    const width = style.width
        ? Math.max(MIN_NODE_WIDTH, Math.round(style.width))
        : Math.max(MIN_NODE_WIDTH, Math.round(Math.max(box.textWidth + iconsWidth, imageWidth) + PAD_X * 2));
    const height = box.height + (imageHeight ? imageHeight + IMAGE_GAP : 0);

    return {
        width,
        height,
        lines: box.lines,
        lineHeight: box.lineHeight,
        textWidth: box.textWidth,
        iconsWidth,
        imageWidth,
        imageHeight,
        style,
        font: box.font
    };
}

/**
 * What the node actually shows: the topic's text with its outline number in
 * front, when an ancestor switched numbering on. The number is never part of
 * `topic.text`, so it is computed here and nowhere else.
 */
export function displayText(map, topic) {
    const prefix = map.numberPrefix ? map.numberPrefix(topic.id) : '';
    if (!prefix) return topic.text;
    const label = prefix.includes('.') ? prefix : prefix + '.';
    return topic.text ? label + ' ' + topic.text : label;
}

/**
 * Wrap and measure a piece of topic text on its own. Shared by `measureNode`
 * and by the inline editor, so what the user types is laid out exactly the way
 * the finished node will be — the editor grows with the text instead of
 * wrapping inside a box sized for the old text.
 */
export function textBox(text, style, { iconsWidth = 0 } = {}) {
    const font = {
        fontSize: style.fontSize,
        fontFamily: style.fontFamily,
        bold: style.bold,
        italic: style.italic
    };
    const wrapWidth = style.width
        ? Math.max(24, style.width - PAD_X * 2 - iconsWidth)
        : MAX_TEXT_WIDTH;
    const lines = wrapText(text || ' ', wrapWidth, font);
    const textWidth = Math.max(...lines.map((line) => measureText(line, font)), 0);
    const lineHeight = Math.round(style.fontSize * LINE_RATIO);
    return {
        lines,
        lineHeight,
        font,
        textWidth,
        width: style.width
            ? Math.max(MIN_NODE_WIDTH, Math.round(style.width))
            : Math.max(MIN_NODE_WIDTH, Math.round(textWidth + iconsWidth + PAD_X * 2)),
        height: Math.round(PAD_Y * 2 + lines.length * lineHeight)
    };
}

/** Children that are actually on screen (an empty list for a collapsed topic). */
export function visibleChildren(map, topic) {
    if (!topic || topic.collapsed) return [];
    return map.childrenOf(topic.id);
}
