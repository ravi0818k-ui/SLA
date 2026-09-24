/**
 * Tiny DOM/SVG builders. Everything in the app builds nodes through these so
 * that no user-supplied string is ever passed to innerHTML (requirement 18).
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

function applyProps(node, props) {
    for (const [key, value] of Object.entries(props || {})) {
        if (value === null || value === undefined || value === false) continue;
        if (key === 'dataset') Object.assign(node.dataset, value);
        else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
        else if (key === 'text') node.textContent = String(value);
        else if (key.startsWith('on') && typeof value === 'function') {
            node.addEventListener(key.slice(2).toLowerCase(), value);
        } else node.setAttribute(key, String(value));
    }
}

function appendChildren(node, children) {
    for (const child of children.flat(Infinity)) {
        if (child === null || child === undefined || child === false) continue;
        node.appendChild(typeof child === 'string' || typeof child === 'number'
            ? document.createTextNode(String(child))
            : child);
    }
}

/** el('button', { class: 'btn', onclick: fn }, 'Label') */
export function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    applyProps(node, props);
    appendChildren(node, children);
    return node;
}

/** svg('rect', { x: 0, y: 0 }) — same signature, SVG namespace. */
export function svgEl(tag, props = {}, ...children) {
    const node = document.createElementNS(SVG_NS, tag);
    applyProps(node, props);
    appendChildren(node, children);
    return node;
}

export function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
    return node;
}

export function qs(selector, root = document) {
    return root.querySelector(selector);
}

export function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
}

/** Trailing-edge debounce; the returned function exposes .cancel() and .flush(). */
export function debounce(fn, wait) {
    let timer = null;
    let lastArgs = null;
    const wrapped = (...args) => {
        lastArgs = args;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => { timer = null; fn(...lastArgs); }, wait);
    };
    wrapped.cancel = () => { if (timer) clearTimeout(timer); timer = null; };
    wrapped.flush = () => {
        if (timer) { clearTimeout(timer); timer = null; fn(...(lastArgs || [])); }
    };
    wrapped.pending = () => timer !== null;
    return wrapped;
}

/** Minimal event bus used between the model, the canvas and the UI panels. */
export function createEmitter() {
    const listeners = new Map();
    return {
        on(event, fn) {
            if (!listeners.has(event)) listeners.set(event, new Set());
            listeners.get(event).add(fn);
            return () => listeners.get(event).delete(fn);
        },
        off(event, fn) { listeners.get(event)?.delete(fn); },
        emit(event, payload) {
            listeners.get(event)?.forEach((fn) => fn(payload));
            listeners.get('*')?.forEach((fn) => fn({ event, payload }));
        }
    };
}
