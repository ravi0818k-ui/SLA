/**
 * Free signup mode (data.json -> freeSignup.enabled). When it is on, every page must:
 * send every Register button to freeSignup.link, show no price / payment / refund wording,
 * show the free wording instead, and set the JSON-LD offer price to 0.
 * When it is off, the paid pages come back unchanged and the free wording is hidden.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { JSDOM } from 'jsdom';

const root = resolve(__dirname, '..', '..');
const read = (f) => readFileSync(resolve(root, f), 'utf-8');
const cfg = JSON.parse(read('ad-pages.json'));
const script = read('script.js');
const SOURCES = ['index.html', 'index-classic.html', 'index-hi.html', 'index-parents.html', 'index-board.html', 'index-board27.html', 'index-board27-en.html', 'index-pro.html', 'index-simple.html'];
const PAGES = SOURCES.concat(cfg.pages.map((p) => `${p.path}/index.html`));

function render(file, enabled) {
    const data = JSON.parse(read('data.json'));
    data.freeSignup.enabled = enabled;
    const dom = new JSDOM(read(file), { runScripts: 'outside-only' });
    dom.window.eval(script);
    dom.window.SLA.applyFreeSignup(data);
    dom.window.SLA.injectContent(data);
    return { doc: dom.window.document, data };
}

/** Visible text in a mode: drop the blocks the head <style> hides in that mode. */
function visibleText(doc, free) {
    const body = doc.body.cloneNode(true);
    body.querySelectorAll(free ? '[data-paid]' : '[data-free]').forEach((el) => el.remove());
    body.querySelectorAll('script, noscript, style').forEach((el) => el.remove());
    body.querySelectorAll('[style*="display: none"], [style*="display:none"]').forEach((el) => el.remove()); // hidden by script.js
    return body.textContent;
}

describe('data.json freeSignup switch', () => {
    const data = JSON.parse(read('data.json'));
    it('has the switch, a working link and free wording for every page language', () => {
        expect(typeof data.freeSignup.enabled).toBe('boolean');
        expect(data.freeSignup.link).toMatch(/^https:\/\//);
        for (const k of ['bright', 'hindi', 'board', 'parents', 'pro']) {
            expect(data.freeSignup.copy[`${k}.buttonText`]).toBeTruthy();
            expect(data.freeSignup.copy[`${k}.stickyText`]).toBeTruthy();
            expect(data.freeSignup.copy[`${k}.trustLine`]).toBeTruthy();
        }
        for (const k of ['simple.buttonText', 'registration.buttonText', 'promise.hinglishShort', 'promise.hindiShort', 'promise.englishShort']) {
            expect(data.freeSignup.copy[k]).toBeTruthy();
        }
        // every overridden path must exist in data.json (a typo would silently do nothing)
        const get = (p) => p.split('.').reduce((o, k) => (o ? o[k] : undefined), data);
        for (const p of Object.keys(data.freeSignup.copy)) expect(get(p), p).not.toBeUndefined();
        // the free copy never carries a price or promises results
        const all = Object.values(data.freeSignup.copy).join(' ');
        expect(all).not.toMatch(/₹|\{\{registration\.price|refund|guarantee|placement/i);
    });
});

describe.each(SOURCES)('%s has the free-mode head snippet', (file) => {
    it('hides [data-free]/[data-paid] by mode and waits for data.json before showing price text', () => {
        const head = read(file).split('</head>')[0];
        expect(head).toMatch(/html:not\(\.sla-free\) \[data-free\],html\.sla-free \[data-paid\]\{display:none!important\}/);
        expect(head).toMatch(/classList\.add\('sla-wait'\)/);
        expect(head).toMatch(/setTimeout\(function \(\) \{ h\.classList\.remove\('sla-wait'\); \}, 3000\)/);
    });
});

describe.each(PAGES)('%s in free mode', (file) => {
    it('sends every Register button to freeSignup.link and shows no price, payment or refund wording', () => {
        const { doc, data } = render(file, true);
        expect(doc.documentElement.classList.contains('sla-free')).toBe(true);
        expect(doc.documentElement.classList.contains('sla-wait')).toBe(false);
        const ctas = doc.querySelectorAll('[data-bind-href="registration.link"]');
        expect(ctas.length).toBeGreaterThan(0);
        ctas.forEach((a) => expect(a.href).toBe(data.freeSignup.link));
        const text = visibleText(doc, true);
        expect(text).not.toMatch(/₹/);
        expect(text).not.toMatch(/refund|UPI|one-time payment|ek baar ka payment|रिफ़ंड|भुगतान से/i);
        expect(text).toMatch(/free|मुफ़्त/i);
        for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
            const j = JSON.parse(s.textContent);
            if (j.offers) expect(j.offers.price).toBe('0');
        }
    });
});

describe.each(PAGES)('%s in paid mode', (file) => {
    it('keeps the paid price and link, and hides every free block', () => {
        const { doc, data } = render(file, false);
        expect(doc.documentElement.classList.contains('sla-free')).toBe(false);
        doc.querySelectorAll('[data-bind-href="registration.link"]').forEach((a) => expect(a.href).toBe(data.registration.link));
        const text = visibleText(doc, false);
        expect(text).toContain(data.registration.currency + data.registration.price);
        expect(text).not.toMatch(/first batches are free|pehle batches free|पहले बैच मुफ़्त/i);
    });
});

describe('thank-you page (where the free Register buttons land)', () => {
    function thankYou(enabled) {
        const data = JSON.parse(read('data.json'));
        data.freeSignup.enabled = enabled;
        const dom = new JSDOM(read('thank-you.html'), { runScripts: 'outside-only' });
        const calls = [];
        dom.window.gtag = (...args) => calls.push(args);
        dom.window.eval(script);
        dom.window.SLA.applyFreeSignup(data);
        dom.window.SLA.injectContent(data);
        dom.window.SLA.initThankYouPage(data);
        return { doc: dom.window.document, data, calls };
    }
    it('free signup link points at the thank-you page', () => {
        const data = JSON.parse(read('data.json'));
        expect(data.freeSignup.link).toBe('https://www.superlearneracademy.in/thank-you.html');
        expect(read('thank-you.html')).toMatch(/html\.sla-free \[data-paid\]\{display:none!important\}/);
    });
    it('free mode: says the seat is booked, sends people to the WhatsApp group, conversion value 0', () => {
        const { doc, data, calls } = thankYou(true);
        const text = visibleText(doc, true);
        expect(text).toMatch(/Free Seat Is Booked/);
        expect(text).toMatch(/Zoom link sirf WhatsApp group mein milega/);
        expect(text).not.toMatch(/redirect|incomplete|payment/i);
        expect(doc.getElementById('whatsapp-btn').href).toBe(data.whatsapp.link);
        const conv = calls.find((c) => c[0] === 'event' && c[1] === 'conversion');
        expect(conv[2].value).toBe(0);
    });
    it('paid mode: keeps the paid wording and the purchase value', () => {
        const { doc, calls } = thankYou(false);
        const text = visibleText(doc, false);
        expect(text).toMatch(/Thank You For Registering!/);
        expect(text).not.toMatch(/Free Seat Is Booked/);
        const conv = calls.find((c) => c[0] === 'event' && c[1] === 'conversion');
        expect(conv[2].value).toBeGreaterThan(0);
    });
});
