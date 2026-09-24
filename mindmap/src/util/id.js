/**
 * Short, collision-resistant ids for topics / relationships / documents.
 * crypto.randomUUID() is used when available; the fallback keeps the same
 * shape so ids are interchangeable across browsers and test runs.
 */
export function uid(prefix = 't') {
    let rand;
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        rand = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    } else if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const buf = new Uint8Array(6);
        crypto.getRandomValues(buf);
        rand = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
    } else {
        rand = Math.random().toString(16).slice(2, 14).padEnd(12, '0');
    }
    return prefix + '_' + rand;
}
