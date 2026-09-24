/**
 * Autosave (requirement 9): 700 ms after the user stops editing, the document
 * is written to IndexedDB. The 500–1000 ms window in the spec is wide enough
 * that a debounce feels instant while still collapsing a burst of keystrokes
 * into one write.
 *
 * The status callback drives the "Saving… / Saved ✓" indicator in the status
 * bar, and flush() is called on pagehide so closing the tab never loses the
 * last edit.
 */
import { debounce } from '../util/dom.js';
import { saveMap } from './IndexedDB.js';
import { touchDocument } from '../core/Document.js';

export const AUTOSAVE_DELAY = 700;

export function createAutoSave({ getDocument, getMap, onStatus, delay = AUTOSAVE_DELAY }) {
    let saving = false;
    let queued = false;

    const write = async () => {
        if (saving) { queued = true; return; }
        saving = true;
        if (onStatus) onStatus('saving');
        try {
            const doc = getDocument();
            touchDocument(doc, getMap ? getMap() : null);
            await saveMap(doc);
            if (onStatus) onStatus('saved', doc.meta.updatedAt);
        } catch (error) {
            if (onStatus) onStatus('error', error);
        } finally {
            saving = false;
            if (queued) { queued = false; write(); }
        }
    };

    const debounced = debounce(write, delay);

    return {
        /** Call after any change worth persisting. */
        schedule() {
            if (onStatus) onStatus('dirty');
            debounced();
        },
        /** Write immediately (Ctrl+S, page hide, before opening another map). */
        flush() {
            debounced.cancel();
            return write();
        },
        cancel() { debounced.cancel(); },
        get pending() { return debounced.pending(); }
    };
}
