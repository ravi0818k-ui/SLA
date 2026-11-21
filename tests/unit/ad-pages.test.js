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
        expect(byPath['ads-3']).toBe('index-hi.html');
        expect(byPath['ads-4']).toBe('index-board.html');
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

const data = JSON.parse(read('data.json'));
const visibleText = (html) => html.split('<body')[1]
    .replace(/<script[\s\S]*?<\/script>|<!--[\s\S]*?-->|<svg[\s\S]*?<\/svg>/g, ' ')
    .replace(/<[^>]+>/g, '\n');
const boundKeys = (html, prefix) => [...html.matchAll(new RegExp(`data-bind(?:-html|-href)?="${prefix}\\.(\\w+)"`, 'g'))].map((m) => m[1]);

describe('/ads-3/ source: Hindi (Devanagari) page', () => {
    const html = read('index-hi.html');
    it('is Hindi, loads Kripa and the Devanagari overrides', () => {
        expect(html).toMatch(/<html lang="hi">/);
        expect(html).toMatch(/fonts\.googleapis\.com\/css2\?family=Kripa/);
        expect(html).toMatch(/href="bright-hi\.css\?v=/);
        expect(read('bright-hi.css')).toMatch(/--fh: 'Kripa'/);
    });
    it('binds to data.json "hindi" (never the Hinglish "bright" copy) and every key exists', () => {
        expect(html).not.toMatch(/data-bind(?:-html|-href)?="bright\./);
        const keys = boundKeys(html, 'hindi');
        expect(keys.length).toBeGreaterThan(10);
        for (const k of new Set(keys)) expect(typeof data.hindi[k]).toBe('string');
    });
    it('has no Hinglish (Roman Hindi) sentences left in the visible copy', () => {
        const left = visibleText(html).split('\n').filter((t) => /\b(hai|nahi|aur|karein|mein|kya|seekh\w*|padh\w*|yaad)\b/i.test(t));
        expect(left).toEqual([]);
    });
    it('FAQ JSON-LD matches the visible FAQ count', () => {
        expect((html.match(/"@type": "Question"/g) || []).length).toBe((html.match(/class="faq-item"/g) || []).length);
    });
});

describe('/ads-4/ source: board exam page', () => {
    const html = read('index-board.html');
    it('leads with the board-exam topper message and opens on the CBSE tab', () => {
        expect(data.board.heroTitle).toMatch(/topper/i);
        expect(data.board.heroTitle).toMatch(/learning potential/i);
        const first = html.match(/<button[^>]*role="tab"[^>]*>/);
        expect(first[0]).toMatch(/id="tab-cbse"/);
        expect(first[0]).toMatch(/aria-selected="true"/);
        for (const id of ['cbse', 'state', 'school', 'parents']) expect(html).toContain(`id="panel-${id}"`);
    });
    it('binds to data.json "board" and every key exists', () => {
        expect(html).not.toMatch(/data-bind(?:-html|-href)?="bright\./);
        for (const k of new Set(boundKeys(html, 'board'))) expect(typeof data.board[k]).toBe('string');
    });
    it('never promises a rank or marks (aspiration only)', () => {
        const text = visibleText(html) + JSON.stringify(data.board);
        expect(text).not.toMatch(/guarantee|pakka topper|\d+\s*%|100 ?percent|rank \d/i);
    });
    it('FAQ JSON-LD matches the visible FAQ count', () => {
        expect((html.match(/"@type": "Question"/g) || []).length).toBe((html.match(/class="faq-item"/g) || []).length);
    });
});

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
