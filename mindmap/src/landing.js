/**
 * Landing page behaviour (PAGE-01): recent maps, the template grid, importing
 * a file and the dark/light switch.
 *
 * The static markup in index.html is the real fallback — the template links
 * already work without this script, and this file only replaces them with the
 * live catalogue once it has loaded.
 */
import { recentMaps, forget, recordOpen } from './storage/RecentFiles.js';
import { deleteMap, saveMap, getPref, setPref } from './storage/IndexedDB.js';
import { listTemplates } from './templates/index.js';
import { importFile } from './import/index.js';
import { el, clear, qs } from './util/dom.js';
import { confirmDialog, alertDialog, toast } from './ui/Dialogs.js';
import { relativeTime } from './util/format.js';
import { registerServiceWorker } from './pwa.js';

async function renderRecent() {
    const host = qs('[data-recent]');
    if (!host) return;
    let maps = [];
    try { maps = await recentMaps(); } catch { maps = []; }

    clear(host);
    if (!maps.length) {
        host.appendChild(el('p', { class: 'om-empty' },
            'No maps yet. ',
            el('a', { href: 'editor.html' }, 'Create your first one'),
            ' — it saves itself as you type.'));
        return;
    }

    for (const record of maps) {
        const card = el('div', { class: 'om-recent-card' },
            el('a', { class: 'om-recent-open', href: 'editor.html?id=' + encodeURIComponent(record.id) },
                el('span', { class: 'om-recent-title', text: record.title || 'Untitled Mind Map' }),
                el('span', { class: 'om-recent-meta', text: (record.topicCount || 0) + (record.topicCount === 1 ? ' topic' : ' topics') + ' · ' + relativeTime(record.updatedAt) })),
            el('button', {
                type: 'button',
                class: 'om-recent-delete',
                'aria-label': 'Delete ' + (record.title || 'this map'),
                title: 'Delete this map',
                onclick: async () => {
                    const ok = await confirmDialog({
                        title: 'Delete map',
                        message: 'Delete "' + (record.title || 'Untitled Mind Map') + '" from this device? This cannot be undone.',
                        confirmLabel: 'Delete'
                    });
                    if (!ok) return;
                    await deleteMap(record.id);
                    await forget(record.id);
                    renderRecent();
                    toast('Map deleted.');
                }
            }, '×'));
        host.appendChild(card);
    }
}

async function renderTemplates() {
    const host = qs('[data-templates]');
    if (!host) return;
    let templates = [];
    try { templates = await listTemplates(); } catch { return; } // keep the static links
    if (!templates.length) return;

    clear(host);
    for (const template of templates) {
        host.appendChild(el('a', {
            class: 'om-template',
            href: 'editor.html?template=' + encodeURIComponent(template.id),
            title: template.description || ''
        },
        el('span', { class: 'om-template-icon', 'aria-hidden': 'true', text: template.icon || '⭕' }),
        el('span', { class: 'om-template-name', text: template.name }),
        el('span', { class: 'om-template-desc', text: template.description || '' })));
    }
}

function bindImport() {
    const button = qs('[data-import-file]');
    if (!button) return;
    button.addEventListener('click', () => {
        const input = el('input', { type: 'file', accept: '.openmind,.json,.md,.markdown,.txt' });
        input.addEventListener('change', async () => {
            const file = input.files && input.files[0];
            if (!file) return;
            try {
                const { document: doc } = await importFile(file);
                await saveMap(doc);
                await recordOpen(doc.meta.id);
                await setPref('lastOpenId', doc.meta.id);
                location.href = 'editor.html?id=' + encodeURIComponent(doc.meta.id);
            } catch (error) {
                await alertDialog({ title: 'Could not import', message: error.message || 'That file could not be read.' });
            }
        });
        input.click();
    });

    // Dropping a file anywhere on the page imports it too.
    const stop = (event) => { event.preventDefault(); };
    document.addEventListener('dragover', (event) => { stop(event); document.body.classList.add('is-dropping'); });
    document.addEventListener('dragleave', () => document.body.classList.remove('is-dropping'));
    document.addEventListener('drop', async (event) => {
        stop(event);
        document.body.classList.remove('is-dropping');
        const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
        if (!file) return;
        try {
            const { document: doc } = await importFile(file);
            await saveMap(doc);
            await recordOpen(doc.meta.id);
            location.href = 'editor.html?id=' + encodeURIComponent(doc.meta.id);
        } catch (error) {
            await alertDialog({ title: 'Could not import', message: error.message || 'That file could not be read.' });
        }
    });
}

function bindOpenExisting() {
    const button = qs('[data-open-existing]');
    if (!button) return;
    button.addEventListener('click', async () => {
        const maps = await recentMaps();
        if (!maps.length) {
            await alertDialog({ title: 'No saved maps', message: 'Nothing is saved on this device yet. Create a new map to get started.' });
            return;
        }
        location.href = 'editor.html?id=' + encodeURIComponent(maps[0].id);
    });
}

async function bindTheme() {
    const button = qs('[data-theme-toggle]');
    const stored = await getPref('darkMode', null);
    if (stored !== null) document.documentElement.dataset.theme = stored ? 'dark' : 'light';
    if (!button) return;
    button.addEventListener('click', async () => {
        const next = document.documentElement.dataset.theme !== 'dark';
        document.documentElement.dataset.theme = next ? 'dark' : 'light';
        await setPref('darkMode', next);
    });
}

function start() {
    renderRecent();
    renderTemplates();
    bindImport();
    bindOpenExisting();
    bindTheme();
    registerServiceWorker();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
