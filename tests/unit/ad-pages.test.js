/**
 * Ad landing pages (/english-ads-1-students/ ... with the old /ads-N/ URLs kept as aliases): generated copies of a source page, listed in ad-pages.json.
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
    it('gives every page a meaningful path and keeps the old /ads-N/ URL as an alias', () => {
        const bySource = Object.fromEntries(cfg.pages.map((p) => [p.source, p]));
        const want = { 'index-classic.html': ['english-ads-1-students', 'ads-1'], 'index.html': ['hinglish-ads-2-students', 'ads-2'],
            'index-hi.html': ['hindi-ads-3-students', 'ads-3'], 'index-parents.html': ['parents-ads-4-tuition-vs-exam', 'ads-4'],
            'index-board.html': ['board-ads-5-topper', 'ads-5'], 'index-pro.html': ['career-ads-6-professionals', 'ads-6'],
            'index-simple.html': ['simple-ads-7-everyone', 'ads-7'] };
        for (const [src, [p, alias]] of Object.entries(want)) {
            expect(bySource[src].path).toBe(p);
            expect(bySource[src].aliases).toContain(alias);
        }
    });
    it('every alias folder is an identical, up-to-date copy whose canonical is the main path', () => {
        for (const page of cfg.pages) for (const alias of page.aliases || []) {
            const main = read(`${page.path}/index.html`);
            expect(read(`${alias}/index.html`)).toBe(main);
            expect(main).toContain(`<link rel="canonical" href="${cfg.baseUrl}/${page.path}/">`);
        }
    });
    it('paths are unique, URL-safe and sources exist', () => {
        const paths = cfg.pages.flatMap((p) => [p.path].concat(p.aliases || []));
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

describe('/ads-6/ source: professionals page (laid off, preparing for the next job)', () => {
    const html = read('index-pro.html');
    it('leads with the professional situation and the "master any subject faster" promise of method', () => {
        expect(data.pro.heroTitle).toMatch(/laid off/i);
        expect(data.pro.heroTitle).toMatch(/next job/i);
        expect(data.pro.heroTitle).toMatch(/master any subject faster/i);
        expect(html).toMatch(/<html lang="en">/);
        expect(html).toContain('id="watch-vs-interview"');
        expect((html.match(/class="b-vs-row"/g) || []).length).toBeGreaterThanOrEqual(8);
    });
    it('uses the professionals illustration set (Images/story/16-19)', () => {
        for (const f of ['16_laid-off-restart', '17_tutorial-overload', '18_interview-confident', '19_recall-system']) {
            expect(html).toContain(`Images/story/${f}.svg`);
            expect(existsSync(resolve(root, `Images/story/${f}.svg`))).toBe(true);
        }
        expect(existsSync(resolve(root, 'Images/story/og-pro.jpg'))).toBe(true);
    });
    it('binds to data.json "pro" and every key exists', () => {
        expect(html).not.toMatch(/data-bind(?:-html|-href)?="(?:bright|board|parents|hindi)\./);
        const keys = boundKeys(html, 'pro');
        expect(keys.length).toBeGreaterThan(10);
        for (const k of new Set(keys)) expect(typeof data.pro[k]).toBe('string');
    });
    it('is honest: no job, offer, salary or placement promise, and says the sessions are Hinglish', () => {
        const text = visibleText(html);
        expect(text).toMatch(/don't promise jobs, interview calls, offers or salaries/);
        expect(text).toMatch(/don't offer placement/);
        expect(text).toMatch(/Hinglish \(Hindi \+ English\)/);
        expect(text + JSON.stringify(data.pro)).not.toMatch(/guarantee|placement assistance|get hired in|\d+\s*%|100 ?percent|salary hike/i);
    });
    it('FAQ JSON-LD matches the visible FAQ count', () => {
        expect((html.match(/"@type": "Question"/g) || []).length).toBe((html.match(/class="faq-item"/g) || []).length);
    });
});

describe('/ads-7/ source: simple one-column page', () => {
    const html = read('index-simple.html');
    it('stays short and simple: one column, few sections, own light stylesheet', () => {
        expect((html.match(/<section/g) || []).length).toBeLessThanOrEqual(8);
        expect(html).toMatch(/href="simple\.css\?v=/);
        expect(html).not.toMatch(/bright\.css/);
    });
    it('uses the trust palette and shows one honest price (no crossed-out regular price)', () => {
        const css = read('simple.css');
        for (const c of ['--navy', '--green', '--blue']) expect(css).toContain(c);
        expect(html).not.toMatch(/originalPrice|<s>/);
    });
    it('binds to data.json "simple" and every key exists', () => {
        const keys = boundKeys(html, 'simple');
        expect(keys.length).toBeGreaterThan(4);
        for (const k of new Set(keys)) expect(typeof data.simple[k]).toBe('string');
    });
    it('never promises marks, ranks or jobs', () => {
        expect(visibleText(html) + JSON.stringify(data.simple)).not.toMatch(/guarantee|\d+\s*%|100 ?percent|10x/i);
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

describe('page speed basics on every ad page source', () => {
    for (const page of cfg.pages) {
        const html = read(page.source);
        it(`${page.source} loads gtag.js once (GA4 + Ads configs), fonts without blocking, script.js deferred`, () => {
            expect((html.match(/googletagmanager\.com\/gtag\/js/g) || []).length).toBe(1);
            expect(html).toContain("gtag('config', 'G-YM45CDB7GK')");
            expect(html).toContain("gtag('config', 'AW-18417193820')");
            expect(html).not.toMatch(/<link href="https:\/\/fonts\.googleapis\.com\/css2[^>]*rel="stylesheet">/);
            expect(html).toMatch(/fonts\.googleapis\.com\/css2[^"]*" media="print" onload="this\.media='all'"/);
            expect(html).toMatch(/<script src="script\.js\?v=[0-9.]+" defer><\/script>/);
        });
    }
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
