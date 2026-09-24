/**
 * Undo / redo.
 *
 * Snapshot-based rather than command-based: every committed change stores a
 * structural copy of the map state. It costs more memory than inverse commands
 * but it cannot drift out of sync with the model, which matters here because
 * layout, styling, import and outline editing all mutate the same tree.
 *
 * `coalesceKey` merges consecutive edits of the same kind on the same topic —
 * typing a title is one undo step, not one per keystroke.
 */
import { structuredCloneSafe } from '../core/Topic.js';

export const HISTORY_LIMIT = 120;

export class History {
    constructor(limit = HISTORY_LIMIT) {
        this.limit = limit;
        this.past = [];
        this.future = [];
        this.present = null;
        this.lastKey = null;
    }

    /** Seed the stack with the opening state; clears any existing history. */
    reset(state, label = 'open') {
        this.past = [];
        this.future = [];
        this.lastKey = null;
        this.present = { state: structuredCloneSafe(state), label };
    }

    /** Record a new state. Returns true when a step was actually pushed. */
    push(state, { label = 'edit', coalesceKey = null } = {}) {
        const snapshot = { state: structuredCloneSafe(state), label };
        if (!this.present) { this.present = snapshot; return true; }
        if (coalesceKey && coalesceKey === this.lastKey) {
            // Replace the current state instead of stacking another step.
            this.present = snapshot;
            this.future = [];
            return false;
        }
        this.past.push(this.present);
        if (this.past.length > this.limit) this.past.shift();
        this.present = snapshot;
        this.future = [];
        this.lastKey = coalesceKey;
        return true;
    }

    /** Stop the next edit from merging into the current one. */
    breakCoalescing() { this.lastKey = null; }

    get canUndo() { return this.past.length > 0; }
    get canRedo() { return this.future.length > 0; }

    undo() {
        if (!this.canUndo) return null;
        this.future.push(this.present);
        this.present = this.past.pop();
        this.lastKey = null;
        return structuredCloneSafe(this.present.state);
    }

    redo() {
        if (!this.canRedo) return null;
        this.past.push(this.present);
        this.present = this.future.pop();
        this.lastKey = null;
        return structuredCloneSafe(this.present.state);
    }

    /** Label of the step undo would take you back past — used for tooltips. */
    get undoLabel() { return this.canUndo ? this.present.label : null; }
    get redoLabel() { return this.canRedo ? this.future[this.future.length - 1].label : null; }
}
