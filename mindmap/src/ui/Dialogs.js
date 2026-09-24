/**
 * Modal dialogs: prompt, confirm, import, export, notes, links, images.
 *
 * Built on the native <dialog> element, which gives focus trapping, Escape and
 * the top layer for free. Content is always built with the DOM helpers, never
 * with innerHTML.
 */
import { el, clear } from '../util/dom.js';

let host = null;

function ensureHost() {
    if (host && host.isConnected) return host;
    host = el('div', { class: 'mm-dialog-host' });
    document.body.appendChild(host);
    return host;
}

/**
 * @param {object} options { title, body: Node, actions: [{label, value, variant, primary}], size }
 * @returns {Promise<any>} the chosen action's `value`, or null when dismissed.
 */
export function openDialog(options = {}) {
    const { title = '', body = null, actions = [], size = '' , onOpen = null } = options;
    ensureHost();

    return new Promise((resolve) => {
        let settled = false;
        const finish = (value) => {
            if (settled) return;
            settled = true;
            dialog.close();
            dialog.remove();
            resolve(value);
        };

        const footer = el('footer', { class: 'mm-dialog-actions' });
        for (const action of actions) {
            footer.appendChild(el('button', {
                type: 'button',
                class: 'mm-btn' + (action.primary ? ' mm-btn-primary' : '') + (action.variant === 'danger' ? ' mm-btn-danger' : ''),
                onclick: () => {
                    const value = typeof action.value === 'function' ? action.value() : action.value;
                    if (value === undefined) return; // validation failed; stay open
                    finish(value);
                }
            }, action.label));
        }

        const dialog = el('dialog', { class: 'mm-dialog' + (size ? ' is-' + size : '') },
            el('header', { class: 'mm-dialog-head' },
                el('h2', { class: 'mm-dialog-title', text: title }),
                el('button', {
                    type: 'button', class: 'mm-dialog-close', 'aria-label': 'Close',
                    onclick: () => finish(null)
                }, '×')),
            el('div', { class: 'mm-dialog-body' }, body),
            actions.length ? footer : null);

        dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(null); });
        dialog.addEventListener('click', (event) => {
            if (event.target === dialog) finish(null); // click on the backdrop
        });

        host.appendChild(dialog);
        if (dialog.showModal) dialog.showModal();
        else dialog.setAttribute('open', 'open');
        if (onOpen) onOpen(dialog);
        const focusable = dialog.querySelector('input, textarea, select, button.mm-btn-primary, button');
        focusable?.focus();
    });
}

export function promptDialog({ title, label, value = '', placeholder = '', multiline = false, confirmLabel = 'Save' }) {
    const field = multiline
        ? el('textarea', { class: 'mm-input mm-textarea', rows: '7', placeholder })
        : el('input', { class: 'mm-input', type: 'text', placeholder });
    field.value = value;

    const body = el('div', { class: 'mm-field' },
        label ? el('label', { class: 'mm-label', text: label }) : null,
        field);

    if (!multiline) {
        field.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                field.closest('dialog')?.querySelector('.mm-btn-primary')?.click();
            }
        });
    }

    return openDialog({
        title,
        body,
        actions: [
            { label: 'Cancel', value: null },
            { label: confirmLabel, value: () => field.value, primary: true }
        ]
    });
}

export function confirmDialog({ title, message, confirmLabel = 'Delete', danger = true }) {
    return openDialog({
        title,
        body: el('p', { class: 'mm-dialog-text', text: message }),
        actions: [
            { label: 'Cancel', value: false },
            { label: confirmLabel, value: true, primary: true, variant: danger ? 'danger' : '' }
        ]
    }).then((value) => value === true);
}

export function alertDialog({ title, message }) {
    return openDialog({
        title,
        body: el('p', { class: 'mm-dialog-text', text: message }),
        actions: [{ label: 'OK', value: true, primary: true }]
    });
}

/** Non-blocking status message in the corner (saves, export errors, tips). */
let toastHost = null;
export function toast(message, kind = 'info', timeout = 3200) {
    if (!toastHost || !toastHost.isConnected) {
        toastHost = el('div', { class: 'mm-toasts', role: 'status', 'aria-live': 'polite' });
        document.body.appendChild(toastHost);
    }
    const node = el('div', { class: 'mm-toast is-' + kind, text: message });
    toastHost.appendChild(node);
    setTimeout(() => {
        node.classList.add('is-leaving');
        setTimeout(() => node.remove(), 250);
    }, timeout);
    return node;
}

export function clearToasts() {
    if (toastHost) clear(toastHost);
}
