/**
 * Small display-formatting helpers shared by the landing page and the editor.
 * Kept out of app.js so the landing page does not pull in the whole editor.
 */
export function relativeTime(iso) {
    const then = new Date(iso).getTime();
    if (!then) return 'recently';
    const seconds = Math.round((Date.now() - then) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.round(seconds / 60) + ' min ago';
    if (seconds < 86400) return Math.round(seconds / 3600) + ' h ago';
    if (seconds < 604800) return Math.round(seconds / 86400) + ' d ago';
    return new Date(iso).toLocaleDateString();
}
