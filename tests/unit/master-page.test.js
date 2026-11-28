/**
 * Master home page (2026-11-28): index-master.html -> the site root index.html (ad-pages.json "home").
 * For everyone (Class 4 to graduation, parents, working professionals, any board), NOT tied to the board exam.
 * The user asked for the tab title "Super Learner Academy-workshop".
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { JSDOM } from 'jsdom';

const root = resolve(__dirname, '..', '..');
const read = (f) => readFileSync(resolve(root, f), 'utf-8');
const FILE = 'index-master.html';
const html = read(FILE);
const doc = new JSDOM(html).window.document;
const data = JSON.parse(read('data.json'));
const visible = () => {
    const b = doc.body.cloneNode(true);
    b.querySelectorAll('script, style, noscript').forEach((e) => e.remove());
    return b.textContent.replace(/\s+/g, ' ');
};

describe('master home page', () => {
    it('is the source of the site root, with the requested tab title', () => {
        expect(JSON.parse(read('ad-pages.json')).home.source).toBe(FILE);
        expect(doc.title).toBe('Super Learner Academy-workshop');
        expect(read('index.html')).toContain('<title>Super Learner Academy-workshop</title>');
        expect(html).toMatch(/<link rel="canonical" href="https:\/\/www\.superlearneracademy\.in\/">/);
    });
    it('is not tied to the board exam anywhere a visitor or Google reads it', () => {
        const head = [doc.title, doc.querySelector('meta[name="description"]').content, doc.querySelector('meta[property="og:description"]').content].join(' ');
        expect(head + visible()).not.toMatch(/board exam|2027|class 10 & 12|class 10 and/i);
        expect(html).not.toMatch(/data-bind(?:-html|-href)?="board27/);
        expect(html).not.toMatch(/selfstudy-ads-8-board-2027/);
    });
    it('names every audience: Class 4 to graduation, CBSE / State Board, parents and working professionals', () => {
        const t = visible();
        for (const w of ['Class 4 to graduation', 'CBSE', 'State Board', 'Parents', 'Working professionals']) expect(t).toContain(w);
    });
    it('has the three "who can join" cards, each with a real photo file and a word sticker', () => {
        const cards = [...doc.querySelectorAll('#who-its-for .b-who-card')];
        expect(cards.map((c) => c.querySelector('h3').textContent.replace(/[^\w ]/g, '').trim())).toEqual(['Students', 'Parents', 'Working professionals']);
        for (const c of cards) {
            const img = c.querySelector('img');
            expect(existsSync(resolve(root, img.getAttribute('src'))), img.getAttribute('src')).toBe(true);
            expect(img.getAttribute('alt')).not.toMatch(/our student/i);
            expect(c.querySelector('.b-sticker').getAttribute('aria-hidden')).toBe('true');
        }
        expect(read('bright.css')).toMatch(/\.b-who-grid \{/);
    });
    it('binds only to data.json "master" (plus shared keys), and every key exists', () => {
        const keys = [...html.matchAll(/data-bind(?:-html|-href)?="master\.(\w+)"/g)].map((m) => m[1]);
        expect(keys.length).toBeGreaterThan(5);
        for (const k of new Set(keys)) expect(data.master[k], k).toBeDefined();
        for (const k of ['buttonText', 'stickyText', 'trustLine']) expect(data.freeSignup.copy['master.' + k]).toBeTruthy();
        expect(data.master.whatsappChat).not.toMatch(/board/i);
    });
    it('keeps the FAQ structured data equal to the visible FAQ (paid set)', () => {
        const ld = [...doc.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent)).find((j) => j['@type'] === 'FAQPage');
        const qs = [...doc.querySelectorAll('#faq .faq-item:not([data-free]) .faq-question span:first-child')].map((s) => s.textContent);
        expect(ld.mainEntity.map((q) => q.name)).toEqual(qs);
    });
    it('makes no marks, rank, job or subject promises in the new copy', () => {
        const t = visible();
        expect(t).not.toMatch(/guarantee(?!.*\?)|100%|topper|get a job|placement|\bmaths?\b|physics|chemistry|biology/i);
    });
    it('uses the all-audience sign-up popup (no board-only class choices)', () => {
        expect(html).not.toMatch(/data-lead-form=/);
        expect(data.leadForm.sets.all.whoOptions).toEqual(['Student', 'Parent', 'Professional']);
    });
});
