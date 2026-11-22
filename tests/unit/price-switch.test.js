/**
 * Changing registration.price in data.json alone must update every price a visitor sees on every ad page
 * (CTA buttons, stickers, the "full course, no upsell" promise) and the JSON-LD offer price.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { JSDOM } from 'jsdom';

const root = resolve(__dirname, '..', '..');
const read = (f) => readFileSync(resolve(root, f), 'utf-8');
const cfg = JSON.parse(read('ad-pages.json'));
const script = read('script.js');

describe('price comes only from data.json', () => {
    for (const page of cfg.pages) {
        it(`/${page.path}/ shows ₹99 everywhere when data.json says 99`, () => {
            const data = JSON.parse(read('data.json'));
            data.registration.price = '99';
            const dom = new JSDOM(read(`${page.path}/index.html`), { runScripts: 'outside-only' });
            dom.window.eval(script);
            dom.window.SLA.injectContent(data);
            const doc = dom.window.document;
            const text = doc.body.textContent;
            expect(text).not.toMatch(/₹\s?455/);
            expect(text).toMatch(/₹\s?99\b/);
            const promise = doc.querySelector('[data-bind^="promise."]');
            expect(promise.textContent).toMatch(/₹99/);
            for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
                const j = JSON.parse(s.textContent);
                if (j.offers) expect(j.offers.price).toBe('99');
            }
        });
    }
});
