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
    it('lists ads-1 (English classic), ads-2 (Bright Mind), ads-3 (Hindi), ads-4 (parents), ads-5 (board)', () => {
        const byPath = Object.fromEntries(cfg.pages.map((p) => [p.path, p.source]));
        expect(byPath['ads-1']).toBe('index-classic.html');
        expect(byPath['ads-2']).toBe('index.html');
        expect(byPath['ads-3']).toBe('index-hi.html');
        expect(byPath['ads-4']).toBe('index-parents.html');
        expect(byPath['ads-5']).toBe('index-board.html');
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

describe('/ads-5/ source: board exam page', () => {
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

describe('/ads-4/ source: parents page (Class 3-5, tuition vs exam)', () => {
    const html = read('index-parents.html');
    it('leads with the parent question: scores at tuition, not in the exam', () => {
        expect(data.parents.heroTitle).toMatch(/tuition/i);
        expect(data.parents.heroTitle).toMatch(/exam/i);
        expect(data.parents.heroEyebrow).toMatch(/Class 3/);
        expect(html).toContain('id="farq"');
        expect((html.match(/class="b-vs-row"/g) || []).length).toBeGreaterThanOrEqual(4);
    });
    it('uses the parents illustration set (Images/story/11-15)', () => {
        for (const f of ['11_report-card-worry', '12_tuition-vs-exam', '13_teach-back-at-home', '14_kid-exam-blank', '15_kid-exam-confident']) {
            expect(html).toContain(`Images/story/${f}.svg`);
            expect(existsSync(resolve(root, `Images/story/${f}.svg`))).toBe(true);
        }
    });
    it('binds to data.json "parents" and every key exists', () => {
        expect(html).not.toMatch(/data-bind(?:-html|-href)?="(?:bright|board)\./);
        expect(visibleText(html)).not.toMatch(/board|NCERT|CBSE/i);
        const keys = boundKeys(html, 'parents');
        expect(keys.length).toBeGreaterThan(10);
        for (const k of new Set(keys)) expect(typeof data.parents[k]).toBe('string');
    });
    it('is honest about age: says Class 3-5 attend with a parent and there is no separate kids batch', () => {
        const faq = visibleText(html);
        expect(faq).toMatch(/Class 3 ya 4/);
        expect(faq).toMatch(/parent bachche ke saath baith kar attend/i);
        expect(faq).toMatch(/alag batch nahi/);
    });
    it('never promises marks or numbers', () => {
        const text = visibleText(html) + JSON.stringify(data.parents);
        expect(text).not.toMatch(/guarantee|pakka|\d+\s*%|100 ?percent|rank \d|topper/i);
    });
    it('FAQ JSON-LD matches the visible FAQ count', () => {
        expect((html.match(/"@type": "Question"/g) || []).length).toBe((html.match(/class="faq-item"/g) || []).length);
    });
});

describe('USP on every ad page: one low price = the full course, no upsell', () => {
    for (const page of cfg.pages) {
        const html = read(page.source);
        it(`${page.source} shows the promise section and the no-upsell FAQ`, () => {
            expect(html).toMatch(/id="(?:vaada|our-promise)"/);
            expect(html).toMatch(/upsell|अपसेल/i);
            expect(html).toMatch(/promise\.(?:hinglish|hindi|english)Short/);
        });
        it(`${page.source} takes every visible price from data.json (change the price only there)`, () => {
            const body = html.split('<body')[1].replace(/<script[\s\S]*?<\/script>/g, '');
            // the only literal price allowed is fallback text inside an element bound to data.json
            const loose = body.replace(/<(\w+)[^>]*data-bind(?:-html)?="[^"]+"[^>]*>[^<]*<\/\1>/g, '').match(/₹\s?\d{2,}/g) || [];
            expect(loose).toEqual([]);
            expect(html).not.toMatch(/<title>[^<]*₹\d/);
        });
    }
    it('data.json has the promise copy and templated (not hard-coded) prices', () => {
        for (const k of ['hinglishShort', 'hindiShort', 'englishShort']) expect(data.promise[k]).toContain('{{registration.price}}');
        expect(data.registration.buttonText).toContain('{{registration.price}}');
        expect(JSON.stringify(data)).not.toMatch(/₹\s?\d/);
    });
    it('script.js keeps the JSON-LD offer price in sync with data.json', () => {
        expect(read('script.js')).toMatch(/function syncOfferPrice\(data\)/);
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
