/**
 * Speed-reading free guide (speed-reading.html + speed-reading.js + speed-reading.css), 2026-11-28.
 * Honest numbers, working exercises, FAQ JSON-LD equal to the visible FAQ, in the menu and the sitemap.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const root = resolve(__dirname, '../..');
const read = (f) => readFileSync(resolve(root, f), 'utf-8');
const html = read('speed-reading.html');
const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
const doc = () => new DOMParser().parseFromString(html, 'text/html');

let S;
beforeAll(() => {
    document.body.innerHTML = '';
    new Function(read('speed-reading.js'))();
    S = window.SLASpeed;
});

describe('helpers', () => {
    it('counts words and turns time into words per minute', () => {
        expect(S.countWords('  one two\nthree  ')).toBe(3);
        expect(S.countWords('')).toBe(0);
        expect(S.wpm(300, 60000)).toBe(300);
        expect(S.wpm(250, 75000)).toBe(200);
        expect(S.wpm(0, 1000)).toBe(0);
        expect(S.wpm(100, 0)).toBe(0);
    });

    it('a 100-page book at the average speed takes about 1 h 45 min (the number the page prints)', () => {
        expect(S.AVG_WPM).toBe(238);
        expect(S.WORDS_PER_PAGE).toBe(250);
        const min = S.bookMinutes(100, 250, 238);
        expect(min).toBe(105);
        expect(S.formatDuration(min)).toBe('1 h 45 min');
        expect(html).toContain('≈ 1 h 45 min');
        expect(html).toContain('about 1 hour 45 minutes');
        expect(S.formatDuration(45)).toBe('45 min');
        expect(S.formatDuration(120)).toBe('2 h');
        expect(S.bookMinutes(100, 250, 0)).toBe(0);
    });

    it('pacer timing and effective speed', () => {
        expect(S.pacerDelay(240, 3)).toBe(750);
        expect(S.pacerDelay(0, 3)).toBe(0);
        expect(S.effectiveWpm(300, 2, 3)).toBe(200);
        expect(S.effectiveWpm(300, 5, 3)).toBe(300);
    });

    it('feedback: 2 of 3 is fine, 1 of 3 means slow down; never shames a slow reader', () => {
        expect(S.feedback(400, 1, 3)).toMatch(/Slow down/);
        expect(S.feedback(250, 2, 3)).not.toMatch(/Slow down/);
        expect(S.feedback(120, 3, 3)).not.toMatch(/slow reader|bad|poor/i);
    });
});

describe('exercises work in the page', () => {
    it('speed test: start, done, answers, result fills the calculator', () => {
        document.documentElement.innerHTML = html;
        S.init();
        const box = document.getElementById('sr-test');
        const passageWords = S.countWords(box.querySelector('.sr-passage').textContent);
        expect(passageWords).toBeGreaterThan(250);
        const realNow = Date.now; let t = 1_000_000; Date.now = () => t;
        try {
            box.querySelector('[data-sr="start"]').click();
            expect(box.querySelector('.sr-passage').classList.contains('sr-blur')).toBe(false);
            t += 60000;
            box.querySelector('[data-sr="done"]').click();
            expect(box.querySelector('.sr-quiz').hidden).toBe(false);
            expect(Number(box.querySelector('.sr-wpm').textContent)).toBe(passageWords);
            box.querySelector('input[name="q1"][value="b"]').checked = true;
            box.querySelector('input[name="q2"][value="c"]').checked = true;
            box.querySelector('input[name="q3"][value="a"]').checked = true;
            box.querySelector('.sr-quiz').dispatchEvent(new Event('submit', { cancelable: true }));
            expect(box.querySelector('.sr-r-score').textContent).toBe('3/3');
            expect(document.querySelector('#sr-calc [name="wpm"]').value).toBe(String(passageWords));
        } finally { Date.now = realNow; }
    });

    it('every question has exactly one right answer that exists', () => {
        for (const fs of doc().querySelectorAll('.sr-quiz fieldset')) {
            expect(fs.querySelectorAll(`input[value="${fs.getAttribute('data-answer')}"]`).length).toBe(1);
        }
    });

    it('pacer wraps the words and highlights 3 at a time', () => {
        document.documentElement.innerHTML = html;
        S.init();
        const box = document.getElementById('sr-pacer');
        expect(box.querySelectorAll('.sr-pacer-text span').length).toBeGreaterThan(150);
        box.querySelector('[data-sr="pacer-play"]').click();
        expect(box.querySelectorAll('.sr-pacer-text span.on').length).toBe(3);
        box.querySelector('[data-sr="pacer-reset"]').click();
    });
});

describe('honest copy', () => {
    const text = norm(doc().body.textContent);
    it('no miracle claims outside the myth column, no marks promise, workshop not sold as speed reading', () => {
        const d = doc();
        d.querySelectorAll('.b-vs-them, .faq-question, script').forEach((e) => e.remove());
        const rest = norm(d.body.textContent);
        expect(rest).not.toMatch(/photo-?read|10x|\b1,?000\+? words a minute\b(?! with full)|guarantee/i);
        expect(text).toMatch(/Does your workshop teach speed reading\?/);
        expect(norm(doc().querySelector('#workshop').textContent)).not.toMatch(/speed reading/i);
        expect(norm(doc().querySelector('#workshop').textContent)).toMatch(/Hinglish/);
    });

    it('cites its sources and credits the photos', () => {
        expect(text).toMatch(/Brysbaert/);
        expect(text).toMatch(/Rayner/);
        expect(text).toMatch(/Photos: Freepik/);
    });

    it('stock photos are never captioned as students', () => {
        for (const img of doc().querySelectorAll('img')) expect(img.getAttribute('alt') || '').not.toMatch(/student/i);
    });
});

describe('page wiring', () => {
    it('FAQ JSON-LD equals the visible FAQ', () => {
        const d = doc();
        const ld = [...d.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent)).find((j) => j['@type'] === 'FAQPage');
        const visible = [...d.querySelectorAll('.faq-item')].map((i) => ({ q: norm(i.querySelector('.faq-question span').textContent), a: norm(i.querySelector('.faq-answer').textContent) }));
        expect(ld.mainEntity.map((e) => e.name)).toEqual(visible.map((v) => v.q));
        expect(ld.mainEntity.map((e) => norm(e.acceptedAnswer.text))).toEqual(visible.map((v) => v.a));
    });

    it('every image and local script/style exists', () => {
        const d = doc();
        const refs = [...d.querySelectorAll('img[src], script[src], link[rel="stylesheet"][href], link[rel="preload"][href]')]
            .map((e) => e.getAttribute('src') || e.getAttribute('href')).filter((u) => !/^https?:/.test(u)).map((u) => u.split('?')[0]);
        for (const r of refs) expect(existsSync(resolve(root, r)), r).toBe(true);
        expect(existsSync(resolve(root, 'Images/photos/og-speed.jpg'))).toBe(true);
    });

    it('is in the menu (site-nav.js SITE_MAP + static list) and in sitemap.xml, with a canonical URL', () => {
        expect(read('site-nav.js')).toContain("path: 'speed-reading.html'");
        expect(html).toContain('<a href="speed-reading.html">');
        expect(read('sitemap.xml')).toContain('https://www.superlearneracademy.in/speed-reading.html');
        expect(doc().querySelector('link[rel="canonical"]').getAttribute('href')).toBe('https://www.superlearneracademy.in/speed-reading.html');
        expect(html).toMatch(/site-nav\.js\?v=1\.3\.3/);
    });
});
