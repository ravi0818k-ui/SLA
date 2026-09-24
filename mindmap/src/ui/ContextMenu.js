/**
 * Right-click menu for topics and for the empty canvas.
 *
 * Note this app deliberately does NOT install the site-wide content-protection
 * layer from script.js/quiz.js: blocking right-click, Ctrl+C and F12 in an
 * editor would break the app's own copy/paste and this menu.
 */
import { el } from '../util/dom.js';

let menuEl = null;
let closeHandler = null;

export function closeContextMenu() {
    if (menuEl) { menuEl.remove(); menuEl = null; }
    if (closeHandler) {
        document.removeEventListener('pointerdown', closeHandler, true);
        document.removeEventListener('keydown', closeHandler, true);
        window.removeEventListener('blur', closeHandler);
        closeHandler = null;
    }
}

/**
 * @param {number} x @param {number} y client coordinates
 * @param {Array} items [{ label, hint, icon, onSelect, disabled }] — null for a separator
 */
export function openContextMenu(x, y, items) {
    closeContextMenu();
    menuEl = el('div', { class: 'mm-context-menu', role: 'menu' });

    for (const item of items) {
        if (!item) { menuEl.appendChild(el('hr', { class: 'mm-context-sep' })); continue; }
        const button = el('button', {
            type: 'button',
            class: 'mm-context-item' + (item.danger ? ' is-danger' : ''),
            role: 'menuitem',
            disabled: item.disabled ? 'disabled' : null,
            onclick: () => { closeContextMenu(); item.onSelect(); }
        },
        el('span', { class: 'mm-context-icon', 'aria-hidden': 'true', text: item.icon || '' }),
        el('span', { class: 'mm-context-label', text: item.label }),
        item.hint ? el('kbd', { class: 'mm-context-hint', text: item.hint }) : null);
        menuEl.appendChild(button);
    }

    document.body.appendChild(menuEl);

    // Keep the menu inside the window.
    const rect = menuEl.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - rect.width - 8);
    const top = Math.min(y, window.innerHeight - rect.height - 8);
    menuEl.style.left = Math.max(8, left) + 'px';
    menuEl.style.top = Math.max(8, top) + 'px';

    closeHandler = (event) => {
        if (event.type === 'keydown' && event.key !== 'Escape') return;
        if (event.type === 'pointerdown' && menuEl && menuEl.contains(event.target)) return;
        closeContextMenu();
    };
    document.addEventListener('pointerdown', closeHandler, true);
    document.addEventListener('keydown', closeHandler, true);
    window.addEventListener('blur', closeHandler);

    menuEl.querySelector('button:not([disabled])')?.focus();
    return menuEl;
}

export function isContextMenuOpen() {
    return Boolean(menuEl);
}
