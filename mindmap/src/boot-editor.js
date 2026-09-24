/**
 * Editor entry point. Kept separate from app.js so that app.js stays
 * importable by the tests without starting anything.
 */
import { bootEditor } from './app.js';
import { registerServiceWorker } from './pwa.js';

function start() {
    bootEditor().catch((error) => {
        // Never leave the user staring at an empty canvas with no explanation.
        const banner = document.createElement('div');
        banner.className = 'mm-fatal';
        banner.textContent = 'The editor could not start: ' + (error && error.message ? error.message : 'unknown error');
        document.body.appendChild(banner);
        throw error;
    });
    registerServiceWorker();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
