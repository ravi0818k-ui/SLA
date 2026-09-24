/**
 * Menu bar + toolbar wiring.
 *
 * The markup lives in editor.html (so the buttons exist before any script
 * runs, the same way site-nav does on the rest of the site); this module only
 * binds `data-command` to editor commands and keeps the enabled/label state in
 * sync. Adding a button therefore means adding one element with the right
 * data-command, not editing this file.
 */
import { qs, qsa } from '../util/dom.js';

export function initToolbar(editor, root = document) {
    const menuBar = qs('.mm-menubar', root);

    // ---- one delegated click handler for every [data-command] in the shell
    const onClick = (event) => {
        const trigger = event.target.closest('[data-command]');
        if (!trigger || trigger.disabled) return;
        event.preventDefault();
        closeMenus();
        editor.run(trigger.dataset.command, trigger.dataset.arg);
    };
    root.addEventListener('click', onClick);

    // ---- menu bar (File / Edit / View / …): click to open, hover to switch
    let openMenu = null;
    function closeMenus() {
        if (!openMenu) return;
        openMenu.classList.remove('is-open');
        openMenu.querySelector('.mm-menu-button')?.setAttribute('aria-expanded', 'false');
        openMenu = null;
    }
    function toggleMenu(menu) {
        const wasOpen = openMenu === menu;
        closeMenus();
        if (wasOpen) return;
        menu.classList.add('is-open');
        menu.querySelector('.mm-menu-button')?.setAttribute('aria-expanded', 'true');
        openMenu = menu;
    }

    if (menuBar) {
        menuBar.addEventListener('click', (event) => {
            const button = event.target.closest('.mm-menu-button');
            if (!button) return;
            event.preventDefault();
            toggleMenu(button.parentElement);
        });
        menuBar.addEventListener('pointerover', (event) => {
            if (!openMenu) return;
            const button = event.target.closest('.mm-menu-button');
            if (button && button.parentElement !== openMenu) toggleMenu(button.parentElement);
        });
        document.addEventListener('pointerdown', (event) => {
            if (openMenu && !openMenu.contains(event.target)) closeMenus();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeMenus();
        });
    }

    // ---- state sync
    const undoBtn = qs('[data-command="undo"]', root);
    const redoBtn = qs('[data-command="redo"]', root);
    const zoomLabel = qs('[data-zoom-label]', root);
    const statusLabel = qs('[data-save-status]', root);
    const titleInput = qs('[data-doc-title]', root);
    const countLabel = qs('[data-topic-count]', root);
    const drillButton = qs('[data-drill]', root);

    if (titleInput) {
        titleInput.addEventListener('change', () => editor.setTitle(titleInput.value));
        titleInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') { event.preventDefault(); titleInput.blur(); }
        });
    }

    function update() {
        if (undoBtn) undoBtn.disabled = !editor.history.canUndo;
        if (redoBtn) redoBtn.disabled = !editor.history.canRedo;
        if (zoomLabel) zoomLabel.textContent = Math.round(editor.viewport.scale * 100) + '%';
        if (titleInput && document.activeElement !== titleInput) titleInput.value = editor.doc.meta.title;
        if (countLabel) {
            const n = editor.map.size;
            countLabel.textContent = n + (n === 1 ? ' topic' : ' topics');
        }
        if (drillButton) {
            const topic = editor.drillId ? editor.map.topic(editor.drillId) : null;
            drillButton.hidden = !topic;
            if (topic) drillButton.textContent = '↑ ' + (topic.text || 'Untitled') + ' — back up';
        }
        for (const node of qsa('[data-active-when]', root)) {
            const [key, value] = node.dataset.activeWhen.split(':');
            const current = key === 'layout' ? editor.doc.view.layout
                : key === 'theme' ? editor.doc.view.theme
                    : key === 'panel' ? editor.activePanel
                        : '';
            node.classList.toggle('is-active', current === value);
            if (node.hasAttribute('aria-pressed')) node.setAttribute('aria-pressed', String(current === value));
        }
        for (const node of qsa('[data-needs-selection]', root)) {
            node.disabled = !editor.selection.primaryId;
        }
    }

    function setStatus(state, detail) {
        if (!statusLabel) return;
        const text = state === 'saving' ? 'Saving…'
            : state === 'saved' ? 'Saved ✓'
                : state === 'dirty' ? 'Unsaved changes'
                    : state === 'error' ? 'Could not save' : '';
        statusLabel.textContent = text;
        statusLabel.dataset.state = state;
        if (detail && state === 'saved') statusLabel.title = 'Last saved ' + new Date(detail).toLocaleTimeString();
    }

    return { update, setStatus, closeMenus, destroy: () => root.removeEventListener('click', onClick) };
}
