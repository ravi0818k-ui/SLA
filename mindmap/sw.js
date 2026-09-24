/**
 * OpenMind service worker (requirement 16).
 *
 * Scope is /mindmap/ only — registration passes scope './', so nothing on the
 * rest of superlearneracademy.in is intercepted or cached by this worker.
 *
 * Strategy:
 *   - app shell (HTML, CSS, JS, templates, icons): cache-first, refreshed in
 *     the background, so a repeat visit paints without touching the network.
 *   - everything else same-origin: network-first, falling back to the cache
 *     when offline.
 *   - cross-origin (fonts, the on-demand jsPDF): never cached here; the
 *     browser's own HTTP cache handles those.
 *
 * Bump CACHE_VERSION whenever a shell file changes — there is no build step to
 * hash filenames for us.
 */

const CACHE_VERSION = 'openmind-v1.0.2';

const SHELL = [
    './',
    './index.html',
    './editor.html',
    './manifest.webmanifest',
    './css/base.css',
    './css/landing.css',
    './css/editor.css',
    './src/boot-editor.js',
    './src/landing.js',
    './src/app.js',
    './src/pwa.js',
    './src/core/MindMap.js',
    './src/core/Topic.js',
    './src/core/Relationship.js',
    './src/core/Theme.js',
    './src/core/Document.js',
    './src/canvas/SVGCanvas.js',
    './src/canvas/Zoom.js',
    './src/canvas/Pan.js',
    './src/canvas/Selection.js',
    './src/canvas/DragDrop.js',
    './src/layout/LayoutEngine.js',
    './src/layout/MindMapLayout.js',
    './src/layout/TreeLayout.js',
    './src/layout/OrganizationLayout.js',
    './src/layout/LogicLayout.js',
    './src/layout/metrics.js',
    './src/history/History.js',
    './src/history/Undo.js',
    './src/history/Redo.js',
    './src/storage/IndexedDB.js',
    './src/storage/AutoSave.js',
    './src/storage/RecentFiles.js',
    './src/import/index.js',
    './src/import/JSON.js',
    './src/import/Markdown.js',
    './src/import/Text.js',
    './src/export/index.js',
    './src/export/JSON.js',
    './src/export/Markdown.js',
    './src/export/SVG.js',
    './src/export/PNG.js',
    './src/export/PDF.js',
    './src/ui/Toolbar.js',
    './src/ui/Sidebar.js',
    './src/ui/PropertiesPanel.js',
    './src/ui/ContextMenu.js',
    './src/ui/Dialogs.js',
    './src/ui/Shortcuts.js',
    './src/templates/index.js',
    './src/util/dom.js',
    './src/util/id.js',
    './src/util/measure.js',
    './src/util/sanitize.js',
    './src/util/format.js',
    './templates/index.json',
    './templates/blank.json',
    './templates/study-notes.json',
    './templates/book-summary.json',
    './templates/brainstorming.json',
    './templates/project-plan.json',
    './templates/swot.json',
    './templates/goal-planning.json',
    './templates/meeting-notes.json',
    './templates/exam-revision.json',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_VERSION);
        // addAll fails the whole install if one file 404s, so add individually.
        await Promise.all(SHELL.map((url) => cache.add(url).catch(() => null)));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys
            .filter((key) => key.startsWith('openmind-') && key !== CACHE_VERSION)
            .map((key) => caches.delete(key)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;          // fonts, CDN scripts
    if (!url.pathname.includes('/mindmap/')) return;           // never the rest of the site

    // Navigations: serve the cached page immediately, refresh behind the scenes.
    if (request.mode === 'navigate') {
        event.respondWith(cacheFirst(request));
        return;
    }

    const isShell = /\.(js|css|json|png|svg|webmanifest)$/i.test(url.pathname);
    event.respondWith(isShell ? cacheFirst(request) : networkFirst(request));
});

async function cacheFirst(request) {
    const cache = await caches.open(CACHE_VERSION);
    const hit = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
    const network = fetch(request)
        .then((response) => {
            if (response && response.ok) cache.put(request, response.clone());
            return response;
        })
        .catch(() => null);
    return hit || (await network) || new Response('Offline', { status: 503, statusText: 'Offline' });
}

async function networkFirst(request) {
    const cache = await caches.open(CACHE_VERSION);
    try {
        const response = await fetch(request);
        if (response && response.ok) cache.put(request, response.clone());
        return response;
    } catch {
        const hit = await cache.match(request);
        return hit || new Response('Offline', { status: 503, statusText: 'Offline' });
    }
}
