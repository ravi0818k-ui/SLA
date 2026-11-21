/**
 * Ad landing pages (/ads-1/, /ads-2/ ...): generated copies of a source page, listed in ad-pages.json.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const root = resolve(__dirname, '..', '..');
const read = (f) => readFileSync(resolve(root, f), 'utf-8');
const { buildPage, prefixUrl } = require('../../scripts/build-ad-pages.js');
const cfg = JSON.parse(read('ad-pages.json'));

describe('ad-pages.json', () => {
    it('lists ads-1 (English classic) and ads-2 (Bright Mind)', () => {
        const byPath = Object.fromEntries(cfg.pages.map((p) => [p.path, p.source]));
        expect(byPath['ads-1']).toBe('index-classic.html');
        expect(byPath['ads-2']).toBe('index.html');
    });
    it('paths are unique, URL-safe and sources exist', () => {
        const paths = cfg.pages.map((p) => p.path);
        expect(new Set(paths).size).toBe(paths.length);
        for (const p of cfg.pages) {
            expect(p.path).toMatch(/^[a-z0-9-]+$/);
            expect(existsSync(resolve(root, p.source))).toBe(true);
        }
    });
});

describe('prefixUrl', () => {
    it('prefixes only relative asset URLs', () => {
        expect(prefixUrl('bright.css?v=1', '../')).toBe('../bright.css?v=1');
        expect(prefixUrl('Favicon SLA/favicon.ico', '../')).toBe('../Favicon SLA/favicon.ico');
        for (const u of ['#faq', 'https://x.in/a', '//cdn.x/a.js', '/abs.css', 'mailto:a@b.c', 'tel:+91', 'data:image/png;base64,x', '{{registration.link}}', '../x.css', ''])
            expect(prefixUrl(u, '../')).toBe(u);
    });
});

for (const page of cfg.pages) {
    describe(`/${page.path}/ (from ${page.source})`, () => {
        const file = `${page.path}/index.html`;
        const html = existsSync(resolve(root, file)) ? read(file) : '';
        const url = `${cfg.baseUrl}/${page.path}/`;

        it('exists and is up to date with its source (run npm run build:ads)', () => {
            expect(html.length).toBeGreaterThan(0);
            expect(html).toBe(buildPage(read(page.source), page, cfg));
        });
        it('keeps visitors on this ad page (no links back to the root landing page)', () => {
            expect(html).not.toMatch(/href=["'](?:\.\.\/)?(?:index|index-classic)\.html/);
        });
        it('has no design-switch redirect', () => {
            expect(html).not.toMatch(/location\.replace\(/);
        });
        it('points script.js at the site root and is noindex with a self canonical', () => {
            expect(html).toMatch(/<html data-root="\.\.\/"/);
            expect(html).toContain('<meta name="robots" content="noindex, follow">');
            expect(html).toContain(`<link rel="canonical" href="${url}">`);
        });
        it('every local src/href resolves to a file in the repo', () => {
            const missing = [];
            const re = /\s(?:src|href)=["']([^"']+)["']/g;
            let m;
            while ((m = re.exec(html))) {
                const u = m[1];
                if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\{\{)/i.test(u)) continue;
                const clean = decodeURI(u.split(/[?#]/)[0]);
                if (!clean) continue;
                if (!existsSync(resolve(root, page.path, clean))) missing.push(u);
            }
            expect(missing).toEqual([]);
        });
    });
}

describe('script.js siteRoot()', () => {
    it('reads data-root only when it is a ../ chain', () => {
        const fn = new Function(read('script.js'));
        fn();
        document.documentElement.setAttribute('data-root', '../');
        expect(window.SLA.siteRoot()).toBe('../');
        document.documentElement.setAttribute('data-root', 'https://evil.example/');
        expect(window.SLA.siteRoot()).toBe('');
        document.documentElement.removeAttribute('data-root');
        expect(window.SLA.siteRoot()).toBe('');
    });
});
