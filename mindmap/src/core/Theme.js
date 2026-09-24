/**
 * Themes supply the *defaults* a topic inherits when it carries no style of
 * its own. Per-topic styles always win, so switching theme never discards a
 * deliberate choice the user made in the properties panel.
 *
 * `palette` is indexed by depth-1 (the root uses `root`), which is what gives a
 * mind map its "one colour per main branch" look: every topic in a branch
 * inherits the colour of the depth-1 ancestor it hangs from.
 */
import { asText } from '../util/sanitize.js';

export const THEMES = {
    'sla': {
        name: 'Super Learner',
        canvas: '#f6f8fc',
        root: { background: '#0B2A5B', color: '#ffffff', border: '#0B2A5B' },
        node: { background: '#ffffff', color: '#16223a', border: '#d9e1f0' },
        palette: ['#FF6B00', '#1E5EFF', '#34A853', '#8b5cf6', '#e11d74', '#0ea5e9'],
        fontFamily: 'Inter, sans-serif',
        fontSize: 14,
        branchWidth: 2,
        branchCurve: 'curve'
    },
    'classic': {
        name: 'Classic',
        canvas: '#ffffff',
        root: { background: '#334155', color: '#ffffff', border: '#334155' },
        node: { background: '#ffffff', color: '#1f2937', border: '#cbd5e1' },
        palette: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'],
        fontFamily: 'Inter, sans-serif',
        fontSize: 14,
        branchWidth: 2,
        branchCurve: 'curve'
    },
    'blueprint': {
        name: 'Blueprint',
        canvas: '#0b1b33',
        root: { background: '#1E5EFF', color: '#ffffff', border: '#5b8cff' },
        node: { background: '#12294a', color: '#e6efff', border: '#2a4c80' },
        palette: ['#61dafb', '#7dd3fc', '#a5b4fc', '#5eead4', '#fcd34d', '#f9a8d4'],
        fontFamily: 'Inter, sans-serif',
        fontSize: 14,
        branchWidth: 2,
        branchCurve: 'elbow'
    },
    'paper': {
        name: 'Paper',
        canvas: '#faf6ee',
        root: { background: '#7c4a20', color: '#fff9f0', border: '#7c4a20' },
        node: { background: '#fffdf8', color: '#3f3227', border: '#e3d6c2' },
        palette: ['#b45309', '#166534', '#1d4ed8', '#9d174d', '#4338ca', '#0f766e'],
        fontFamily: 'Inter, sans-serif',
        fontSize: 14,
        branchWidth: 2,
        branchCurve: 'curve'
    },
    'mono': {
        name: 'Mono',
        canvas: '#ffffff',
        root: { background: '#111827', color: '#ffffff', border: '#111827' },
        node: { background: '#ffffff', color: '#111827', border: '#9ca3af' },
        palette: ['#111827', '#374151', '#4b5563', '#6b7280', '#374151', '#111827'],
        fontFamily: 'Inter, sans-serif',
        fontSize: 14,
        branchWidth: 1.5,
        branchCurve: 'straight'
    }
};

export const DEFAULT_THEME = 'sla';

export function getTheme(id) {
    return THEMES[asText(id, 40)] || THEMES[DEFAULT_THEME];
}

export function themeList() {
    return Object.entries(THEMES).map(([id, theme]) => ({ id, name: theme.name }));
}

/** The branch colour for a topic — its own override, else its depth-1 ancestor's slot. */
export function branchColor(map, topicId, theme) {
    let current = map.topic(topicId);
    const chain = [];
    while (current) {
        if (current.style && current.style.branchColor) return current.style.branchColor;
        chain.push(current);
        current = map.parentOf(current.id);
    }
    // chain ends at the root; the element just before it is the depth-1 ancestor.
    const branchRoot = chain.length >= 2 ? chain[chain.length - 2] : chain[chain.length - 1];
    if (!branchRoot || branchRoot.id === map.rootId) return theme.palette[0];
    const index = map.root.children.indexOf(branchRoot.id);
    return theme.palette[(index < 0 ? 0 : index) % theme.palette.length];
}

/**
 * Resolve every visual property for one topic: theme defaults, then the branch
 * colour, then the topic's own style on top.
 */
export function resolveStyle(map, topic, theme) {
    const isRoot = topic.id === map.rootId;
    const depth = map.depthOf(topic.id);
    const accent = branchColor(map, topic.id, theme);
    const base = isRoot ? theme.root : theme.node;
    const style = topic.style || {};
    return {
        background: style.background || (isRoot ? base.background : depth === 1 ? accent : base.background),
        color: style.color || (isRoot || depth === 1 ? '#ffffff' : base.color),
        border: style.border || (depth === 1 ? accent : base.border),
        borderWidth: style.borderWidth ?? 1.5,
        borderRadius: style.borderRadius ?? (isRoot ? 14 : 10),
        shape: style.shape || 'rounded',
        fontFamily: style.fontFamily || theme.fontFamily,
        fontSize: style.fontSize ?? (isRoot ? theme.fontSize + 4 : depth === 1 ? theme.fontSize + 1 : theme.fontSize),
        bold: style.bold ?? (isRoot || depth === 1),
        italic: Boolean(style.italic),
        underline: Boolean(style.underline),
        branchColor: accent,
        branchWidth: style.branchWidth ?? Math.max(1, theme.branchWidth - Math.min(depth - 1, 1) * 0.5),
        branchStyle: style.branchStyle || 'solid',
        branchCurve: style.branchCurve || theme.branchCurve,
        // 0 means "no manual width" — size the box to its text.
        width: style.width || 0
    };
}
