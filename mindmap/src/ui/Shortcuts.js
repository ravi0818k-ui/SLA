/**
 * The keyboard map (requirement 4).
 *
 * Shortcuts are ignored while a text field or the inline editor has focus,
 * except for the ones that must always work (Escape, Ctrl+S, Ctrl+Z). Space is
 * tracked as a modifier rather than a command so Space+drag can pan.
 */
export function initShortcuts(editor, target = document) {
    let spaceDown = false;

    const isTextField = (node) => {
        if (!node) return false;
        const tag = node.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable;
    };

    const onKeyDown = (event) => {
        const mod = event.ctrlKey || event.metaKey;
        const inField = isTextField(document.activeElement);

        if (event.key === ' ' && !inField) {
            spaceDown = true;
            document.body.classList.add('is-space-pan');
            if (!mod) event.preventDefault();
            return;
        }

        // Always available
        if (mod && event.key.toLowerCase() === 's') {
            event.preventDefault();
            editor.run('save');
            return;
        }
        if (event.key === 'Escape') {
            editor.run('escape');
            return;
        }

        if (inField) return;

        if (event.altKey && /^[0-9]$/.test(event.key)) {
            // Alt+1..9 shows the map down to that level; Alt+0 shows everything.
            event.preventDefault();
            editor.run('level', event.key === '0' ? 99 : Number(event.key));
            return;
        }

        if (mod && event.shiftKey) {
            const key = event.key.toLowerCase();
            const map = {
                c: () => editor.run('copy-style'),
                v: () => editor.run('paste-style'),
                a: () => editor.run('select-level'),
                arrowup: () => editor.run('move-up'),
                arrowdown: () => editor.run('move-down'),
                home: () => editor.run('move-top'),
                end: () => editor.run('move-bottom')
            };
            const handler = map[key];
            if (handler) { event.preventDefault(); handler(); return; }
        }

        if (mod && event.altKey && event.key.toLowerCase() === 'a') {
            event.preventDefault();
            editor.run('select-children');
            return;
        }

        if (mod) {
            const key = event.key.toLowerCase();
            const map = {
                z: () => editor.run(event.shiftKey ? 'redo' : 'undo'),
                y: () => editor.run('redo'),
                c: () => editor.run('copy'),
                x: () => editor.run('cut'),
                v: () => editor.run('paste'),
                d: () => editor.run('duplicate'),
                f: () => editor.run('search'),
                a: () => editor.run('select-siblings'),
                '=': () => editor.run('zoom-in'),
                '+': () => editor.run('zoom-in'),
                '-': () => editor.run('zoom-out'),
                '0': () => editor.run('zoom-reset'),
                e: () => editor.run('export'),
                o: () => editor.run('open'),
                p: () => editor.run('print'),
                m: () => editor.run('add-multiple'),
                home: () => editor.run('select-root')
            };
            const handler = map[key];
            if (handler) {
                // Let the browser keep Ctrl+C / Ctrl+V when nothing is selected,
                // so copying text from a dialog still works.
                if ('cxv'.includes(key) && !editor.selection.primaryId && key !== 'v') return;
                event.preventDefault();
                handler();
            }
            return;
        }

        switch (event.key) {
            case 'Tab':
                event.preventDefault();
                editor.run('add-child');
                break;
            case 'Enter':
                event.preventDefault();
                editor.run(event.shiftKey ? 'add-sibling-before' : 'add-sibling');
                break;
            case 'Insert':
                event.preventDefault();
                editor.run(event.shiftKey ? 'insert-parent' : 'add-child');
                break;
            case 'Delete':
            case 'Backspace':
                event.preventDefault();
                // Shift keeps the children and pulls them up a level.
                editor.run(event.shiftKey ? 'delete-only' : 'delete');
                break;
            case 'F3':
                event.preventDefault();
                editor.run('focus-branch');
                break;
            case 'F4':
                event.preventDefault();
                editor.run(event.shiftKey ? 'drill-up' : 'drill-down');
                break;
            case 'F2':
                event.preventDefault();
                editor.run('rename');
                break;
            case 'Home':
                event.preventDefault();
                editor.run(event.altKey ? 'select-first-sibling' : 'center');
                break;
            case 'End':
                if (!event.altKey) break;
                event.preventDefault();
                editor.run('select-last-sibling');
                break;
            case 'ArrowUp':
            case 'ArrowDown':
            case 'ArrowLeft':
            case 'ArrowRight':
                event.preventDefault();
                editor.navigate(event.key.replace('Arrow', '').toLowerCase(), event.shiftKey);
                break;
            default:
                // A printable character starts editing the selected topic, the
                // way a spreadsheet cell does.
                if (event.key.length === 1 && !event.altKey && editor.selection.primaryId) {
                    editor.startEditing(editor.selection.primaryId, { initial: event.key });
                    event.preventDefault();
                }
        }
    };

    const onKeyUp = (event) => {
        if (event.key === ' ') {
            spaceDown = false;
            document.body.classList.remove('is-space-pan');
        }
    };

    const onBlur = () => {
        spaceDown = false;
        document.body.classList.remove('is-space-pan');
    };

    target.addEventListener('keydown', onKeyDown);
    target.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return {
        isSpaceDown: () => spaceDown,
        destroy() {
            target.removeEventListener('keydown', onKeyDown);
            target.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('blur', onBlur);
        }
    };
}

/** The list the Help dialog renders. */
export const SHORTCUTS = [
    ['Tab / Ins', 'Add child topic'],
    ['Enter', 'Add sibling topic'],
    ['Shift + Enter', 'Add sibling before'],
    ['Shift + Ins', 'Insert a parent topic'],
    ['Ctrl + M', 'Add several topics from a list'],
    ['Delete', 'Delete topic and its sub-topics'],
    ['Shift + Delete', 'Delete topic, keep its sub-topics'],
    ['F2 / double-click', 'Rename topic'],
    ['Arrow keys', 'Move between topics'],
    ['Ctrl + Z', 'Undo'],
    ['Ctrl + Y', 'Redo'],
    ['Ctrl + C / X / V', 'Copy / cut / paste'],
    ['Ctrl + D', 'Duplicate'],
    ['Ctrl + Shift + C / V', 'Copy / paste style'],
    ['Ctrl + Shift + ↑ / ↓', 'Move topic up / down'],
    ['Ctrl + Shift + Home / End', 'Move topic to first / last'],
    ['Ctrl + Shift + A', 'Select every topic on this level'],
    ['Ctrl + Alt + A', 'Select the sub-topics'],
    ['Ctrl + Home', 'Go to the central topic'],
    ['Alt + Home / End', 'First / last sibling'],
    ['Ctrl + S', 'Save now'],
    ['Ctrl + F', 'Find and replace'],
    ['Alt + 1…9', 'Show the map down to that level'],
    ['Alt + 0', 'Show every level'],
    ['F3', 'Focus on the selected branch'],
    ['F4 / Shift + F4', 'Drill into a branch / back up'],
    ['Ctrl + E', 'Export'],
    ['Ctrl + + / -', 'Zoom in / out'],
    ['Ctrl + 0', 'Zoom to 100%'],
    ['Home', 'Centre the map'],
    ['Space + drag', 'Pan the canvas'],
    ['Scroll / Ctrl + scroll', 'Pan / zoom']
];
