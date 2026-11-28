/**
 * Favicon (2026-11-28): every page uses the Bright Mind cloud icons in Images/favicon/ (built by
 * Documents/Super_Learner_Academy/_build/favicons.py), never the old "Favicon SLA/" set.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';

const root = resolve(__dirname, '..', '..');
const pages = readdirSync(root, { recursive: true }).map(String)
    .filter((f) => f.endsWith('.html') && !/node_modules|(^|[\\/])\./.test(f));

describe('favicon', () => {
    it('the icon files exist, plus /favicon.ico at the site root', () => {
        for (const f of ['favicon.svg', 'favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png', 'favicon-48x48.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) {
            expect(existsSync(resolve(root, 'Images/favicon', f)), f).toBe(true);
        }
        expect(existsSync(resolve(root, 'favicon.ico'))).toBe(true);
    });

    it('every page links the new icons (resolving from its own folder) and none links the old set', () => {
        expect(pages.length).toBeGreaterThan(30);
        for (const f of pages) {
            const html = readFileSync(resolve(root, f), 'utf-8');
            if (!/<link[^>]*rel="(?:icon|apple-touch-icon)"/.test(html)) continue;
            expect(html, f).not.toContain('Favicon SLA/');
            const hrefs = [...html.matchAll(/<link[^>]*rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
            expect(hrefs.some((h) => h.endsWith('Images/favicon/favicon.svg')), f).toBe(true);
            for (const h of hrefs) expect(existsSync(resolve(root, dirname(f), h)), `${f}: ${h}`).toBe(true);
        }
    });
});
