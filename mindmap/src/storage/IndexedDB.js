/**
 * Local persistence (requirement 9). Everything stays on the device — there is
 * no backend and no account in the MVP.
 *
 * Stores:
 *   maps      { id, title, updatedAt, topicCount, doc }   — full documents
 *   templates { id, ... }                                 — user-saved templates
 *   prefs     { key, value }                              — theme, layout, recents
 *
 * If IndexedDB is unavailable (private windows, very old browsers, or a
 * storage quota error) the same API falls back to localStorage so the editor
 * still works — it just holds fewer maps.
 */

const DB_NAME = 'openmind';
const DB_VERSION = 1;
export const STORES = { maps: 'maps', templates: 'templates', prefs: 'prefs' };

let dbPromise = null;
let useFallback = false;

function openDB() {
    if (useFallback) return Promise.reject(new Error('indexeddb-unavailable'));
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') { reject(new Error('indexeddb-unavailable')); return; }
        let request;
        try { request = indexedDB.open(DB_NAME, DB_VERSION); } catch (error) { reject(error); return; }
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORES.maps)) {
                const store = db.createObjectStore(STORES.maps, { keyPath: 'id' });
                store.createIndex('updatedAt', 'updatedAt');
            }
            if (!db.objectStoreNames.contains(STORES.templates)) {
                db.createObjectStore(STORES.templates, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORES.prefs)) {
                db.createObjectStore(STORES.prefs, { keyPath: 'key' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('indexeddb-failed'));
        request.onblocked = () => reject(new Error('indexeddb-blocked'));
    }).catch((error) => {
        useFallback = true;
        dbPromise = null;
        throw error;
    });
    return dbPromise;
}

function tx(storeName, mode, run) {
    return openDB().then((db) => new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        let result;
        try { result = run(store); } catch (error) { reject(error); return; }
        transaction.oncomplete = () => resolve(result && result.__request ? result.value : result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error('aborted'));
    }));
}

function req(request) {
    const box = { __request: true, value: undefined };
    request.onsuccess = () => { box.value = request.result; };
    return box;
}

// ------------------------------------------------------------- localStorage

const LS_PREFIX = 'openmind:';

const fallback = {
    get(store, key) {
        try {
            const raw = localStorage.getItem(LS_PREFIX + store + ':' + key);
            return Promise.resolve(raw ? JSON.parse(raw) : undefined);
        } catch { return Promise.resolve(undefined); }
    },
    put(store, key, value) {
        try { localStorage.setItem(LS_PREFIX + store + ':' + key, JSON.stringify(value)); } catch { /* quota */ }
        return Promise.resolve(value);
    },
    remove(store, key) {
        try { localStorage.removeItem(LS_PREFIX + store + ':' + key); } catch { /* ignore */ }
        return Promise.resolve();
    },
    all(store) {
        const out = [];
        try {
            for (let i = 0; i < localStorage.length; i += 1) {
                const key = localStorage.key(i);
                if (key && key.startsWith(LS_PREFIX + store + ':')) {
                    out.push(JSON.parse(localStorage.getItem(key)));
                }
            }
        } catch { /* ignore */ }
        return Promise.resolve(out.filter(Boolean));
    }
};

// -------------------------------------------------------------- public API

export async function saveMap(doc) {
    const record = {
        id: doc.meta.id,
        title: doc.meta.title,
        updatedAt: doc.meta.updatedAt,
        createdAt: doc.meta.createdAt,
        topicCount: doc.meta.topicCount,
        doc
    };
    try {
        await tx(STORES.maps, 'readwrite', (store) => store.put(record));
    } catch {
        await fallback.put(STORES.maps, record.id, record);
    }
    return record;
}

export async function loadMap(id) {
    try {
        const record = await tx(STORES.maps, 'readonly', (store) => req(store.get(id)));
        if (record) return record.doc;
    } catch { /* fall through */ }
    const record = await fallback.get(STORES.maps, id);
    return record ? record.doc : null;
}

export async function listMaps() {
    let records;
    try {
        records = await tx(STORES.maps, 'readonly', (store) => req(store.getAll()));
    } catch {
        records = await fallback.all(STORES.maps);
    }
    return (records || [])
        .map((r) => ({
            id: r.id,
            title: r.title,
            updatedAt: r.updatedAt,
            createdAt: r.createdAt,
            topicCount: r.topicCount
        }))
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function deleteMap(id) {
    try {
        await tx(STORES.maps, 'readwrite', (store) => store.delete(id));
    } catch { /* fall through */ }
    await fallback.remove(STORES.maps, id);
}

export async function getPref(key, fallbackValue = null) {
    try {
        const record = await tx(STORES.prefs, 'readonly', (store) => req(store.get(key)));
        if (record) return record.value;
    } catch { /* fall through */ }
    const record = await fallback.get(STORES.prefs, key);
    return record === undefined ? fallbackValue : (record && record.value !== undefined ? record.value : fallbackValue);
}

export async function setPref(key, value) {
    try {
        await tx(STORES.prefs, 'readwrite', (store) => store.put({ key, value }));
    } catch {
        await fallback.put(STORES.prefs, key, { key, value });
    }
    return value;
}

export async function saveTemplate(template) {
    try {
        await tx(STORES.templates, 'readwrite', (store) => store.put(template));
    } catch {
        await fallback.put(STORES.templates, template.id, template);
    }
    return template;
}

export async function listTemplates() {
    try {
        return (await tx(STORES.templates, 'readonly', (store) => req(store.getAll()))) || [];
    } catch {
        return fallback.all(STORES.templates);
    }
}

/** Approximate bytes used, when the browser exposes it (shown in the UI). */
export async function storageEstimate() {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
        try { return await navigator.storage.estimate(); } catch { return null; }
    }
    return null;
}
