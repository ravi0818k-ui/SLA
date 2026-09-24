/**
 * Selection state. Multi-select is supported (Ctrl/Cmd-click, Shift-click a
 * sibling range) but one topic is always the "primary" — the one keyboard
 * commands act on and the properties panel shows.
 */
import { createEmitter } from '../util/dom.js';

export class Selection {
    constructor() {
        this.ids = new Set();
        this.primaryId = null;
        this.emitter = createEmitter();
    }

    on(event, fn) { return this.emitter.on(event, fn); }

    get size() { return this.ids.size; }
    has(id) { return this.ids.has(id); }
    toArray() { return Array.from(this.ids); }

    set(id) {
        this.ids = new Set(id ? [id] : []);
        this.primaryId = id || null;
        this.changed();
    }

    setMany(ids, primaryId = null) {
        this.ids = new Set(ids.filter(Boolean));
        this.primaryId = primaryId && this.ids.has(primaryId) ? primaryId : (this.toArray()[0] || null);
        this.changed();
    }

    add(id) {
        if (!id) return;
        this.ids.add(id);
        this.primaryId = id;
        this.changed();
    }

    toggle(id) {
        if (!id) return;
        if (this.ids.has(id)) {
            this.ids.delete(id);
            if (this.primaryId === id) this.primaryId = this.toArray()[0] || null;
        } else {
            this.ids.add(id);
            this.primaryId = id;
        }
        this.changed();
    }

    clear() {
        if (!this.ids.size && !this.primaryId) return;
        this.ids.clear();
        this.primaryId = null;
        this.changed();
    }

    /** Drop ids that no longer exist (after a delete or an import). */
    prune(map) {
        let dirty = false;
        for (const id of this.toArray()) {
            if (!map.topic(id)) { this.ids.delete(id); dirty = true; }
        }
        if (this.primaryId && !map.topic(this.primaryId)) {
            this.primaryId = this.toArray()[0] || null;
            dirty = true;
        }
        if (dirty) this.changed();
    }

    changed() {
        this.emitter.emit('change', { ids: this.toArray(), primaryId: this.primaryId });
    }
}

/**
 * Arrow-key navigation. Returns the id to move to, or null.
 * Up/down walk siblings; left/right step out of / into a branch, mirrored for
 * topics that sit on the left-hand side of a mind-map layout.
 */
export function navigateFrom(map, layoutResult, id, direction) {
    const topic = map.topic(id);
    if (!topic) return null;
    const node = layoutResult.nodes.get(id);
    const onLeft = node && node.side === 'left';
    const vertical = layoutResult.layout === 'org';

    const intoChild = () => {
        if (topic.collapsed || !topic.children.length) return null;
        const children = map.childrenOf(id);
        return children[Math.floor((children.length - 1) / 2)]?.id || null;
    };
    const toParent = () => topic.parentId || null;
    const sibling = (delta) => {
        const parent = map.parentOf(id);
        if (!parent) return null;
        const index = parent.children.indexOf(id);
        return parent.children[index + delta] || null;
    };

    if (vertical) {
        if (direction === 'down') return intoChild();
        if (direction === 'up') return toParent();
        if (direction === 'left') return sibling(-1);
        if (direction === 'right') return sibling(1);
        return null;
    }

    if (direction === 'up') return sibling(-1);
    if (direction === 'down') return sibling(1);
    const outward = onLeft ? 'left' : 'right';
    if (direction === outward) return intoChild();
    return toParent();
}
