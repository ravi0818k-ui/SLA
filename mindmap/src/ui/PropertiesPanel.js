/**
 * The right-hand properties panel (requirement 7).
 *
 * Every control writes through `editor.styleSelection(patch)`, which applies to
 * the whole selection, so styling five topics at once is the same code path as
 * styling one. Controls show the *resolved* value (theme default or explicit
 * override) and a "Reset" clears the override so the theme takes over again.
 */
import { el, clear } from '../util/dom.js';
import { SHAPES, BRANCH_STYLES, BRANCH_CURVES } from '../core/Topic.js';

const NUMBERING_LABELS = [['', 'None'], ['number', '1, 1.1, 1.2'], ['letter', 'A, A.1'], ['roman', 'I, I.1']];
import { resolveStyle, getTheme } from '../core/Theme.js';
import { promptDialog } from './Dialogs.js';

const FONTS = [
    ['Inter, sans-serif', 'Inter'],
    ['Montserrat, sans-serif', 'Montserrat'],
    ['Georgia, serif', 'Georgia'],
    ['"Courier New", monospace', 'Courier'],
    ['system-ui, sans-serif', 'System']
];

const SHAPE_LABELS = {
    rounded: 'Rounded', rect: 'Rectangle', ellipse: 'Ellipse',
    diamond: 'Diamond', underline: 'Underline', none: 'No box'
};

const ICON_CHOICES = ['⭐', '✅', '❗', '❓', '\u{1F525}', '\u{1F4A1}', '\u{1F4CC}', '\u{1F4DA}', '⏰', '\u{1F9E0}', '\u{1F44D}', '❌',
    // Revision progress: how well do you know this branch yet?
    '\u{1F311}', '\u{1F313}', '\u{1F315}'];

export function initPropertiesPanel(editor, host) {
    function render() {
        clear(host);
        const id = editor.selection.primaryId;
        const topic = id ? editor.map.topic(id) : null;

        if (!topic) {
            host.appendChild(el('p', { class: 'mm-panel-empty', text: 'Select a topic to style it.' }));
            host.appendChild(mapSection());
            return;
        }

        // The panel can render before the first layout exists, so fall back to
        // the document's theme rather than relying on lastResult.
        const theme = editor.lastResult ? editor.lastResult.theme : getTheme(editor.doc.view.theme);
        const style = resolveStyle(editor.map, topic, theme);
        const own = topic.style || {};
        const count = editor.selection.size;

        host.appendChild(el('p', { class: 'mm-panel-note', text: count > 1 ? count + ' topics selected' : topic.text || '(untitled)' }));

        // ------------------------------------------------------------ text
        host.appendChild(section('Text', [
            field('Font', select(FONTS, own.fontFamily || style.fontFamily, (value) => editor.styleSelection({ fontFamily: value }))),
            field('Size', number(style.fontSize, 8, 72, (value) => editor.styleSelection({ fontSize: value }))),
            field('Style', el('div', { class: 'mm-toggle-row' },
                toggle('B', style.bold, 'Bold', (on) => editor.styleSelection({ bold: on })),
                toggle('I', style.italic, 'Italic', (on) => editor.styleSelection({ italic: on })),
                toggle('U', style.underline, 'Underline', (on) => editor.styleSelection({ underline: on })))),
            field('Colour', color(style.color, own.color, (value) => editor.styleSelection({ color: value })))
        ]));

        // ------------------------------------------------------------ node
        host.appendChild(section('Node', [
            field('Shape', select(SHAPES.map((s) => [s, SHAPE_LABELS[s]]), style.shape, (value) => editor.styleSelection({ shape: value }))),
            field('Background', color(style.background, own.background, (value) => editor.styleSelection({ background: value }))),
            field('Border', color(style.border, own.border, (value) => editor.styleSelection({ border: value }))),
            field('Width', widthControl(editor, topic, own.width)),
            field('Border width', number(style.borderWidth, 0, 10, (value) => editor.styleSelection({ borderWidth: value }), 0.5)),
            field('Corner radius', number(style.borderRadius, 0, 40, (value) => editor.styleSelection({ borderRadius: value })))
        ]));

        // ---------------------------------------------------------- branch
        host.appendChild(section('Branch', [
            field('Colour', color(style.branchColor, own.branchColor, (value) => editor.styleSelection({ branchColor: value }))),
            field('Width', number(style.branchWidth, 1, 10, (value) => editor.styleSelection({ branchWidth: value }), 0.5)),
            field('Line', select(BRANCH_STYLES.map((s) => [s, cap(s)]), style.branchStyle, (value) => editor.styleSelection({ branchStyle: value }))),
            field('Curve', select(BRANCH_CURVES.map((s) => [s, cap(s)]), style.branchCurve, (value) => editor.styleSelection({ branchCurve: value })))
        ]));

        // --------------------------------------------------------- content
        const iconRow = el('div', { class: 'mm-icon-grid' });
        for (const icon of ICON_CHOICES) {
            iconRow.appendChild(el('button', {
                type: 'button',
                class: 'mm-icon-choice' + (topic.icons.includes(icon) ? ' is-on' : ''),
                title: 'Toggle icon',
                onclick: () => editor.toggleIcon(topic.id, icon)
            }, icon));
        }

        host.appendChild(section('Content', [
            el('div', { class: 'mm-panel-buttons' },
                el('button', { type: 'button', class: 'mm-btn mm-btn-sm', onclick: () => editor.run('edit-note') },
                    topic.note ? 'Edit note' : 'Add note'),
                el('button', { type: 'button', class: 'mm-btn mm-btn-sm', onclick: () => editor.run('add-link') }, 'Add link'),
                el('button', { type: 'button', class: 'mm-btn mm-btn-sm', onclick: () => editor.run('add-image') }, topic.image ? 'Replace image' : 'Add image'),
                el('button', { type: 'button', class: 'mm-btn mm-btn-sm', onclick: () => editor.run('add-tag') }, 'Add tag')),
            field('Icons', iconRow),
            topic.tags.length ? field('Tags', tagList(editor, topic)) : null,
            topic.links.length ? field('Links', linkList(editor, topic)) : null,
            topic.image ? field('Image', el('div', { class: 'mm-panel-buttons' },
                el('button', { type: 'button', class: 'mm-btn mm-btn-sm', onclick: () => editor.setImage(topic.id, null) }, 'Remove image'))) : null
        ]));

        // ----------------------------------------------------- connections
        host.appendChild(section('Outline', [
            field('Numbering', select(NUMBERING_LABELS, topic.numbering || '', (value) => editor.setNumbering(value))),
            el('p', { class: 'mm-panel-hint', text: 'Numbers everything under this topic. It is shown, never written into the text.' })
        ]));

        host.appendChild(section('Connections', [
            el('div', { class: 'mm-panel-buttons' },
                el('button', {
                    type: 'button', class: 'mm-btn mm-btn-sm',
                    onclick: () => editor.run('start-relationship')
                }, editor.relationshipSourceId ? 'Pick the second topic…' : 'Draw relationship'),
                el('button', { type: 'button', class: 'mm-btn mm-btn-sm', onclick: () => editor.run('toggle-boundary') },
                    editor.map.boundaries.some((b) => b.topicId === topic.id) ? 'Remove boundary' : 'Add boundary')),
            el('p', { class: 'mm-panel-hint', text: 'A boundary outlines this topic and everything under it.' })
        ]));

        host.appendChild(el('div', { class: 'mm-panel-buttons mm-panel-footer' },
            el('button', { type: 'button', class: 'mm-btn mm-btn-sm', onclick: () => editor.resetStyle() }, 'Reset style'),
            topic.position ? el('button', { type: 'button', class: 'mm-btn mm-btn-sm', onclick: () => editor.resetPosition() }, 'Reset position') : null));
    }

    function mapSection() {
        return section('Map', [
            field('Title', (() => {
                const input = el('input', { class: 'mm-input mm-input-sm', type: 'text', value: editor.doc.meta.title });
                input.addEventListener('change', () => editor.setTitle(input.value));
                return input;
            })()),
            el('p', { class: 'mm-panel-hint', text: editor.map.size + ' topics · saved on this device only.' })
        ]);
    }

    return { render };
}

// ------------------------------------------------------------------ pieces

function section(title, children) {
    return el('section', { class: 'mm-panel-section' },
        el('h3', { class: 'mm-panel-title', text: title }),
        ...children.filter(Boolean));
}

function field(label, control) {
    return el('label', { class: 'mm-panel-field' },
        el('span', { class: 'mm-panel-label', text: label }),
        control);
}

function select(options, value, onChange) {
    const node = el('select', { class: 'mm-input mm-input-sm' });
    for (const [optionValue, label] of options) {
        node.appendChild(el('option', { value: optionValue, selected: optionValue === value ? 'selected' : null }, label));
    }
    node.value = value;
    node.addEventListener('change', () => onChange(node.value));
    return node;
}

function number(value, min, max, onChange, step = 1) {
    const node = el('input', {
        class: 'mm-input mm-input-sm', type: 'number',
        min: String(min), max: String(max), step: String(step), value: String(round(value))
    });
    node.addEventListener('change', () => onChange(parseFloat(node.value)));
    return node;
}

function color(resolved, own, onChange) {
    const wrap = el('span', { class: 'mm-color-field' });
    const input = el('input', { class: 'mm-color', type: 'color', value: toHex(resolved) });
    input.addEventListener('input', () => onChange(input.value));
    wrap.appendChild(input);
    if (own) {
        wrap.appendChild(el('button', {
            type: 'button', class: 'mm-color-clear', title: 'Use the theme colour',
            onclick: () => onChange('')
        }, '↺'));
    }
    return wrap;
}

/**
 * Box width. Empty (or the ↺ button) means "size to the text", which is the
 * default; a number is the same manual width the drag handle on the node's
 * right edge writes.
 */
function widthControl(editor, topic, ownWidth) {
    const laidOut = editor.lastResult?.nodes.get(topic.id);
    const wrap = el('span', { class: 'mm-color-field' });
    const input = el('input', {
        class: 'mm-input mm-input-sm', type: 'number', min: '54', max: '900', step: '10',
        value: String(Math.round(ownWidth || laidOut?.width || 0) || ''),
        placeholder: 'Auto'
    });
    input.addEventListener('change', () => {
        const value = parseFloat(input.value);
        editor.setNodeWidth(topic.id, Number.isFinite(value) ? value : null);
    });
    wrap.appendChild(input);
    if (ownWidth) {
        wrap.appendChild(el('button', {
            type: 'button', class: 'mm-color-clear', title: 'Fit the box to its text',
            onclick: () => editor.setNodeWidth(topic.id, null)
        }, '↺'));
    }
    return wrap;
}

function toggle(label, on, title, onChange) {
    return el('button', {
        type: 'button',
        class: 'mm-toggle-btn' + (on ? ' is-on' : ''),
        title,
        'aria-pressed': String(Boolean(on)),
        onclick: () => onChange(!on)
    }, label);
}

function tagList(editor, topic) {
    const wrap = el('div', { class: 'mm-tag-list' });
    topic.tags.forEach((tag, index) => {
        wrap.appendChild(el('button', {
            type: 'button', class: 'mm-tag', title: 'Remove tag',
            onclick: () => editor.setTags(topic.id, topic.tags.filter((_, i) => i !== index))
        }, tag + ' ×'));
    });
    return wrap;
}

function linkList(editor, topic) {
    const wrap = el('div', { class: 'mm-link-list' });
    topic.links.forEach((link, index) => {
        wrap.appendChild(el('span', { class: 'mm-link-row' },
            el('a', { href: link.url, target: '_blank', rel: 'noopener noreferrer nofollow', text: link.label || link.url }),
            el('button', {
                type: 'button', class: 'mm-link-remove', title: 'Remove link',
                onclick: () => editor.setLinks(topic.id, topic.links.filter((_, i) => i !== index))
            }, '×')));
    });
    wrap.appendChild(el('button', {
        type: 'button', class: 'mm-btn mm-btn-sm',
        onclick: async () => {
            const label = await promptDialog({ title: 'Link label', label: 'Shown on the topic', value: '' });
            if (label === null) return;
            editor.run('add-link', label);
        }
    }, 'Add another'));
    return wrap;
}

function cap(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
function round(value) { return Math.round((Number(value) || 0) * 100) / 100; }

function toHex(value) {
    const s = String(value || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(s)) return s;
    if (/^#[0-9a-f]{3}$/i.test(s)) return '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
    // Named colours and rgb() need a round-trip through the DOM.
    if (typeof document !== 'undefined') {
        const probe = document.createElement('span');
        probe.style.color = s;
        if (probe.style.color) {
            const match = probe.style.color.match(/\d+/g);
            if (match && match.length >= 3) {
                return '#' + match.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
            }
        }
    }
    return '#000000';
}
