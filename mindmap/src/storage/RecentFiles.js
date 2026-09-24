/**
 * The "Recent Maps" list on the landing page. Stored as an ordered list of ids
 * in prefs rather than sorting by updatedAt, so that *opening* a map moves it
 * to the top even when nothing was changed.
 */
import { getPref, setPref, listMaps } from './IndexedDB.js';

const KEY = 'recentFiles';
const LIMIT = 12;

export async function recordOpen(id) {
    if (!id) return [];
    const current = (await getPref(KEY, [])) || [];
    const next = [id, ...current.filter((existing) => existing !== id)].slice(0, LIMIT);
    await setPref(KEY, next);
    return next;
}

export async function forget(id) {
    const current = (await getPref(KEY, [])) || [];
    const next = current.filter((existing) => existing !== id);
    await setPref(KEY, next);
    return next;
}

/**
 * Recent maps with their metadata, most recent first. Ids that no longer have
 * a stored map (deleted elsewhere) are dropped rather than shown as dead rows.
 */
export async function recentMaps() {
    const [ids, maps] = await Promise.all([getPref(KEY, []), listMaps()]);
    const byId = new Map(maps.map((m) => [m.id, m]));
    const ordered = (ids || []).map((id) => byId.get(id)).filter(Boolean);
    const seen = new Set(ordered.map((m) => m.id));
    // Anything saved but never explicitly opened still belongs in the list.
    for (const map of maps) if (!seen.has(map.id)) ordered.push(map);
    return ordered.slice(0, LIMIT);
}
