/** The Redo command — the mirror of Undo.js. */
export function redo(history, apply) {
    const state = history.redo();
    if (!state) return false;
    apply(state);
    return true;
}

export function canRedo(history) {
    return Boolean(history && history.canRedo);
}
