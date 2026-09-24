/**
 * The mind-map tree engine (requirement 3).
 *
 * MindMap owns a flat `topics` map (id -> topic) plus the root id. Child order
 * is the `children` array on each topic, so reordering never touches the map.
 * Every mutation returns enough information for the caller to select/focus the
 * right node; none of them render or persist anything — the app layer decides
 * when to push history and when to save.
 */
import { createTopic, normalizeTopic, cloneTopic, structuredCloneSafe } from './Topic.js';
import { uid } from '../util/id.js';
import { asText } from '../util/sanitize.js';
import { normalizeRelationship, normalizeBoundary } from './Relationship.js';

export class MindMap {
    constructor(state = {}) {
        this.rootId = state.rootId || null;
        this.topics = state.topics || {};
        this.relationships = state.relationships || [];
        this.boundaries = state.boundaries || [];
        if (!this.rootId) {
            const root = createTopic({ text: 'Central Topic' });
            this.rootId = root.id;
            this.topics[root.id] = root;
        }
    }

    /** A fresh single-topic map. */
    static create(title = 'Central Topic') {
        const root = createTopic({ text: title });
        return new MindMap({ rootId: root.id, topics: { [root.id]: root } });
    }

    /**
     * Rebuild from untrusted data: unknown parents are re-attached to the root,
     * children lists are rebuilt from parentId, and cycles are broken. This is
     * what makes a corrupt or hand-edited .openmind file safe to open.
     */
    static fromState(state) {
        const raw = state && typeof state === 'object' ? state : {};
        const topics = {};
        const source = raw.topics && typeof raw.topics === 'object' ? raw.topics : {};
        const entries = Array.isArray(source) ? source : Object.values(source);
        for (const item of entries) {
            const topic = normalizeTopic(item);
            if (topic.id) topics[topic.id] = topic;
        }
        let rootId = asText(raw.rootId, 64);
        if (!rootId || !topics[rootId]) {
            rootId = Object.keys(topics).find((id) => !topics[id].parentId) || '';
        }
        if (!rootId) return MindMap.create();

        // Trust parentId where it points at a real topic; where it does not,
        // fall back to whoever lists this topic as a child. `breakCycles()`
        // then rebuilds every children array from the repaired parentIds.
        const claimedBy = new Map();
        for (const topic of Object.values(topics)) {
            for (const childId of topic.children) {
                if (topics[childId] && !claimedBy.has(childId)) claimedBy.set(childId, topic.id);
            }
        }
        for (const topic of Object.values(topics)) {
            if (topic.id === rootId) { topic.parentId = null; continue; }
            if (!topic.parentId || !topics[topic.parentId] || topic.parentId === topic.id) {
                topic.parentId = claimedBy.get(topic.id) || rootId;
            }
        }

        const map = new MindMap({ rootId, topics });
        map.breakCycles();
        map.relationships = (Array.isArray(raw.relationships) ? raw.relationships : [])
            .map((r) => normalizeRelationship(r))
            .filter((r) => r && map.topics[r.fromId] && map.topics[r.toId] && r.fromId !== r.toId);
        map.boundaries = (Array.isArray(raw.boundaries) ? raw.boundaries : [])
            .map((b) => normalizeBoundary(b))
            .filter((b) => b && map.topics[b.topicId]);
        return map;
    }

    /**
     * Repair the tree: every topic must reach the root through parentId, and
     * every children array is rebuilt from those parentIds. A topic that is
     * its own ancestor (only possible in hand-edited or corrupt data) is
     * re-parented to the root rather than dropped, so nothing is lost.
     */
    breakCycles() {
        // Remember the order the file gave us, so a repair keeps sibling order.
        const orderHint = new Map();
        for (const topic of Object.values(this.topics)) {
            topic.children.forEach((childId, index) => {
                if (this.topics[childId] && !orderHint.has(childId)) orderHint.set(childId, index);
            });
        }

        for (const topic of Object.values(this.topics)) {
            if (topic.id === this.rootId) { topic.parentId = null; continue; }
            if (!topic.parentId || !this.topics[topic.parentId] || topic.parentId === topic.id) {
                topic.parentId = this.rootId;
                continue;
            }
            // Walk up to the root; a repeat means this topic is inside a cycle.
            const seen = new Set([topic.id]);
            let cursor = this.topics[topic.parentId];
            while (cursor && cursor.id !== this.rootId) {
                if (seen.has(cursor.id)) { topic.parentId = this.rootId; break; }
                seen.add(cursor.id);
                cursor = cursor.parentId ? this.topics[cursor.parentId] : null;
            }
            if (!cursor) topic.parentId = this.rootId; // the chain fell off the tree
        }

        for (const topic of Object.values(this.topics)) topic.children = [];
        const rest = Object.values(this.topics).filter((topic) => topic.id !== this.rootId);
        rest.sort((a, b) => (orderHint.get(a.id) ?? 1e9) - (orderHint.get(b.id) ?? 1e9));
        for (const topic of rest) this.topics[topic.parentId].children.push(topic.id);
    }

    // ---------------------------------------------------------------- reads

    topic(id) { return this.topics[id] || null; }
    get root() { return this.topics[this.rootId]; }
    get size() { return Object.keys(this.topics).length; }

    childrenOf(id) {
        const topic = this.topics[id];
        if (!topic) return [];
        return topic.children.map((childId) => this.topics[childId]).filter(Boolean);
    }

    parentOf(id) {
        const topic = this.topics[id];
        return topic && topic.parentId ? this.topics[topic.parentId] || null : null;
    }

    siblingsOf(id) {
        const parent = this.parentOf(id);
        return parent ? this.childrenOf(parent.id) : [];
    }

    indexOf(id) {
        const parent = this.parentOf(id);
        return parent ? parent.children.indexOf(id) : -1;
    }

    depthOf(id) {
        let depth = 0;
        let current = this.topics[id];
        while (current && current.parentId) { depth += 1; current = this.topics[current.parentId]; }
        return depth;
    }

    /** All descendants of `id`, depth-first, excluding `id` itself. */
    descendants(id) {
        const out = [];
        const stack = [...(this.topics[id]?.children || [])];
        while (stack.length) {
            const current = stack.shift();
            const topic = this.topics[current];
            if (!topic) continue;
            out.push(topic);
            stack.unshift(...topic.children);
        }
        return out;
    }

    ancestors(id) {
        const out = [];
        let current = this.parentOf(id);
        while (current) { out.push(current); current = this.parentOf(current.id); }
        return out;
    }

    isAncestorOf(ancestorId, id) {
        return this.ancestors(id).some((t) => t.id === ancestorId);
    }

    /** Depth-first walk in visual order; `onlyVisible` stops at collapsed nodes. */
    walk(onlyVisible = false, startId = this.rootId) {
        const out = [];
        const visit = (id, depth) => {
            const topic = this.topics[id];
            if (!topic) return;
            out.push({ topic, depth });
            if (onlyVisible && topic.collapsed) return;
            for (const childId of topic.children) visit(childId, depth + 1);
        };
        visit(startId, 0);
        return out;
    }

    /** True when every ancestor is expanded, i.e. the topic is on screen. */
    isVisible(id) {
        return this.ancestors(id).every((t) => !t.collapsed);
    }

    // ------------------------------------------------------------- mutations

    addChild(parentId, text = '', options = {}) {
        const parent = this.topics[parentId];
        if (!parent) return null;
        const topic = createTopic({ text, parentId, ...options.topic });
        this.topics[topic.id] = topic;
        const index = Number.isInteger(options.index)
            ? Math.max(0, Math.min(options.index, parent.children.length))
            : parent.children.length;
        parent.children.splice(index, 0, topic.id);
        parent.collapsed = false;
        return topic;
    }

    addSibling(siblingId, text = '', options = {}) {
        const sibling = this.topics[siblingId];
        if (!sibling) return null;
        // The root has no siblings — Enter on the root adds a child instead.
        if (!sibling.parentId) return this.addChild(siblingId, text, options);
        const index = this.indexOf(siblingId);
        return this.addChild(sibling.parentId, text, { ...options, index: index + 1 });
    }

    /** Enter-before: a sibling inserted above/before `siblingId`. */
    addSiblingBefore(siblingId, text = '', options = {}) {
        const sibling = this.topics[siblingId];
        if (!sibling) return null;
        if (!sibling.parentId) return this.addChild(siblingId, text, options);
        return this.addChild(sibling.parentId, text, { ...options, index: this.indexOf(siblingId) });
    }

    /**
     * Insert a new topic between `id` and its parent, pushing `id` (and its
     * subtree) down one level. The root has no parent, so it is refused.
     */
    insertParent(id, text = '') {
        const topic = this.topics[id];
        if (!topic || id === this.rootId || !topic.parentId) return null;
        const parentId = topic.parentId;
        const index = this.indexOf(id);
        const created = this.addChild(parentId, text, { index });
        if (!created) return null;
        this.move(id, created.id, 0);
        return created;
    }

    /**
     * Delete just this topic; its children take its place under its parent.
     * The counterpart to `remove`, which takes the whole subtree with it.
     */
    removeOnly(id) {
        const topic = this.topics[id];
        if (!topic || id === this.rootId) return false;
        const parentId = topic.parentId;
        const at = this.indexOf(id);
        const children = [...topic.children];
        children.forEach((childId, offset) => this.move(childId, parentId, at + offset));
        this.remove(id);
        return true;
    }

    /** Move a topic to the first (`'top'`) or last (`'bottom'`) place among its siblings. */
    moveToEdge(id, edge) {
        const parent = this.parentOf(id);
        if (!parent) return false;
        const from = parent.children.indexOf(id);
        if (from === -1) return false;
        const to = edge === 'top' ? 0 : parent.children.length - 1;
        if (from === to) return false;
        parent.children.splice(from, 1);
        parent.children.splice(to, 0, id);
        return true;
    }

    /**
     * Collapse everything deeper than `level` and expand everything above it —
     * "show me level 2, let me recall the rest". Level 0 shows the root alone.
     */
    collapseToLevel(level) {
        let changed = false;
        for (const topic of Object.values(this.topics)) {
            if (!topic.children.length) continue;
            const collapsed = this.depthOf(topic.id) >= level;
            if (topic.collapsed !== collapsed) { topic.collapsed = collapsed; changed = true; }
        }
        return changed;
    }

    /** Deepest level that has any topic on it (the root is level 0). */
    get depth() {
        return this.walk().reduce((max, { depth }) => Math.max(max, depth), 0);
    }

    /** @param {string} value one of NUMBERING_STYLES; '' turns numbering off. */
    setNumbering(id, value) {
        const topic = this.topics[id];
        if (!topic) return null;
        topic.numbering = normalizeTopic({ ...topic, numbering: value }).numbering;
        return topic;
    }

    /**
     * The display prefix for a topic, e.g. "2.3". Empty unless an ancestor has
     * numbering switched on. Numbering is display-only: it never touches
     * `topic.text`, so it cannot leak into an export round trip.
     */
    numberPrefix(id) {
        const topic = this.topics[id];
        if (!topic) return '';
        // Find the nearest ancestor that switched numbering on.
        const chain = [];
        let current = topic;
        let source = null;
        while (current && current.parentId) {
            const parent = this.topics[current.parentId];
            if (!parent) break;
            chain.unshift(parent.children.indexOf(current.id));
            if (parent.numbering) { source = parent; break; }
            current = parent;
        }
        if (!source || !chain.length) return '';
        return formatNumber(chain, source.numbering);
    }

    /** Remove a topic and its subtree. Returns the removed ids (root is never removed). */
    remove(id) {
        const topic = this.topics[id];
        if (!topic || id === this.rootId) return [];
        const removed = [topic, ...this.descendants(id)].map((t) => t.id);
        const parent = this.parentOf(id);
        if (parent) parent.children = parent.children.filter((c) => c !== id);
        for (const removedId of removed) delete this.topics[removedId];
        this.relationships = this.relationships.filter(
            (r) => !removed.includes(r.fromId) && !removed.includes(r.toId)
        );
        this.boundaries = this.boundaries.filter((b) => !removed.includes(b.topicId));
        return removed;
    }

    setText(id, text) {
        const topic = this.topics[id];
        if (!topic) return null;
        topic.text = asText(text, 4000);
        return topic;
    }

    /** Copy a subtree in beside the original. Returns the new subtree root. */
    duplicate(id) {
        const topic = this.topics[id];
        if (!topic || id === this.rootId) return null;
        const copyRoot = this.copySubtreeInto(this.exportSubtree(id), topic.parentId, this.indexOf(id) + 1);
        return copyRoot;
    }

    /** Plain nested object for a subtree — the clipboard and duplicate format. */
    exportSubtree(id) {
        const topic = this.topics[id];
        if (!topic) return null;
        const node = structuredCloneSafe(topic);
        node.children = topic.children.map((childId) => this.exportSubtree(childId)).filter(Boolean);
        return node;
    }

    /** Insert a nested subtree (from exportSubtree) under `parentId` with fresh ids. */
    copySubtreeInto(node, parentId, index) {
        const parent = this.topics[parentId];
        if (!node || !parent) return null;
        const insert = (source, targetParentId, at) => {
            const copy = cloneTopic(source, { parentId: targetParentId });
            this.topics[copy.id] = copy;
            const target = this.topics[targetParentId];
            const position = Number.isInteger(at)
                ? Math.max(0, Math.min(at, target.children.length))
                : target.children.length;
            target.children.splice(position, 0, copy.id);
            for (const child of source.children || []) insert(child, copy.id, null);
            return copy;
        };
        return insert(node, parentId, index);
    }

    /**
     * Re-parent a topic. Refuses to move the root, to move a topic into itself
     * or into its own descendant (which would detach the subtree).
     */
    move(id, newParentId, index = null) {
        const topic = this.topics[id];
        const parent = this.topics[newParentId];
        if (!topic || !parent || id === this.rootId) return false;
        if (id === newParentId || this.isAncestorOf(id, newParentId)) return false;
        const oldParent = this.parentOf(id);
        const sameParent = oldParent && oldParent.id === newParentId;
        const oldIndex = oldParent ? oldParent.children.indexOf(id) : -1;
        if (oldParent) oldParent.children = oldParent.children.filter((c) => c !== id);
        let position = Number.isInteger(index) ? index : parent.children.length;
        if (sameParent && oldIndex !== -1 && position > oldIndex) position -= 1;
        position = Math.max(0, Math.min(position, parent.children.length));
        parent.children.splice(position, 0, id);
        topic.parentId = newParentId;
        parent.collapsed = false;
        return true;
    }

    /** Shift a topic up (-1) or down (+1) among its siblings. */
    reorder(id, delta) {
        const parent = this.parentOf(id);
        if (!parent) return false;
        const from = parent.children.indexOf(id);
        const to = from + delta;
        if (from === -1 || to < 0 || to >= parent.children.length) return false;
        parent.children.splice(from, 1);
        parent.children.splice(to, 0, id);
        return true;
    }

    setCollapsed(id, collapsed) {
        const topic = this.topics[id];
        if (!topic || !topic.children.length) return false;
        topic.collapsed = Boolean(collapsed);
        return true;
    }

    toggleCollapse(id) {
        const topic = this.topics[id];
        if (!topic || !topic.children.length) return false;
        topic.collapsed = !topic.collapsed;
        return true;
    }

    setStyle(id, patch) {
        const topic = this.topics[id];
        if (!topic) return null;
        topic.style = normalizeTopic({ ...topic, style: { ...topic.style, ...patch } }).style;
        // An explicit empty string clears an inherited property.
        for (const [key, value] of Object.entries(patch || {})) {
            if (value === '' || value === null) delete topic.style[key];
        }
        return topic;
    }

    setPosition(id, position) {
        const topic = this.topics[id];
        if (!topic) return null;
        topic.position = position ? { x: position.x, y: position.y } : null;
        return topic;
    }

    setNote(id, note) {
        const topic = this.topics[id];
        if (!topic) return null;
        topic.note = asText(note, 20000);
        return topic;
    }

    setImage(id, image) {
        const topic = this.topics[id];
        if (!topic) return null;
        topic.image = normalizeTopic({ ...topic, image }).image;
        return topic;
    }

    setIcons(id, icons) {
        const topic = this.topics[id];
        if (!topic) return null;
        topic.icons = normalizeTopic({ ...topic, icons }).icons;
        return topic;
    }

    setLinks(id, links) {
        const topic = this.topics[id];
        if (!topic) return null;
        topic.links = normalizeTopic({ ...topic, links }).links;
        return topic;
    }

    setTags(id, tags) {
        const topic = this.topics[id];
        if (!topic) return null;
        topic.tags = normalizeTopic({ ...topic, tags }).tags;
        return topic;
    }

    // --------------------------------------------------- relationships etc.

    addRelationship(fromId, toId, label = '') {
        if (!this.topics[fromId] || !this.topics[toId] || fromId === toId) return null;
        const exists = this.relationships.find((r) => r.fromId === fromId && r.toId === toId);
        if (exists) return exists;
        const rel = normalizeRelationship({ id: uid('r'), fromId, toId, label });
        this.relationships.push(rel);
        return rel;
    }

    removeRelationship(id) {
        const before = this.relationships.length;
        this.relationships = this.relationships.filter((r) => r.id !== id);
        return this.relationships.length !== before;
    }

    addBoundary(topicId, label = '') {
        if (!this.topics[topicId]) return null;
        const exists = this.boundaries.find((b) => b.topicId === topicId);
        if (exists) return exists;
        const boundary = normalizeBoundary({ id: uid('b'), topicId, label });
        this.boundaries.push(boundary);
        return boundary;
    }

    removeBoundary(id) {
        const before = this.boundaries.length;
        this.boundaries = this.boundaries.filter((b) => b.id !== id && b.topicId !== id);
        return this.boundaries.length !== before;
    }

    // ------------------------------------------------------------- searching

    /** Case-insensitive search over topic text, notes and tags (requirement 13). */
    search(query) {
        const needle = asText(query, 200).trim().toLowerCase();
        if (!needle) return [];
        const out = [];
        for (const { topic } of this.walk(false)) {
            const fields = [];
            if (topic.text.toLowerCase().includes(needle)) fields.push('text');
            if (topic.note && topic.note.toLowerCase().includes(needle)) fields.push('note');
            if (topic.tags.some((tag) => tag.toLowerCase().includes(needle))) fields.push('tag');
            if (fields.length) out.push({ id: topic.id, topic, fields });
        }
        return out;
    }

    toState() {
        return {
            rootId: this.rootId,
            topics: this.topics,
            relationships: this.relationships,
            boundaries: this.boundaries
        };
    }

    clone() {
        return MindMap.fromState(structuredCloneSafe(this.toState()));
    }
}

/**
 * Turn a chain of sibling indexes into "2.3" / "B.3" / "II.3". Only the first
 * level changes shape; deeper levels stay numeric, which is what every outline
 * numbering scheme does.
 */
function formatNumber(chain, style) {
    const head = chain[0] + 1;
    const first = style === 'letter'
        ? letters(head)
        : style === 'roman'
            ? roman(head)
            : String(head);
    return [first, ...chain.slice(1).map((index) => index + 1)].join('.');
}

function letters(n) {
    let out = '';
    let value = n;
    while (value > 0) {
        const remainder = (value - 1) % 26;
        out = String.fromCharCode(65 + remainder) + out;
        value = Math.floor((value - 1) / 26);
    }
    return out;
}

const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];

function roman(n) {
    let value = n;
    let out = '';
    for (const [amount, numeral] of ROMAN) {
        while (value >= amount) { out += numeral; value -= amount; }
    }
    return out;
}
