/**
 * The Undo command. Kept as its own module so the toolbar, the menu and the
 * keyboard map all call the same thing (requirement 2's history/ module list).
 */
export function undo(history, apply) {
    const state = history.undo();
    if (!state) return false;
    apply(state);
    return true;
}

export function canUndo(history) {
    return Boolean(history && history.canUndo);
}
