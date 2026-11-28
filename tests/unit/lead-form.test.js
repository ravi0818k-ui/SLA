/**
 * Free-registration popup (2026-11-28): lead-form.js + lead-form.css, switched on by script.js initLeadForm()
 * when free mode is on, data.json leadForm.enabled is true and leadForm.endpoint (the Google Sheet web app) is set.
 * The Apps Script that receives the rows is google-apps-script-leads.js.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { JSDOM } from 'jsdom';

const root = resolve(__dirname, '..', '..');
const read = (f) => readFileSync(resolve(root, f), 'utf-8');
const data = () => JSON.parse(read('data.json'));
const cfg = JSON.parse(read('ad-pages.json'));

function win() {
    const dom = new JSDOM('<!doctype html><html lang="en"><body></body></html>', { runScripts: 'outside-only', url: 'https://www.superlearneracademy.in/' });
    dom.window.eval(read('script.js'));
    dom.window.eval(read('lead-form.js'));
    return dom.window;
}

describe('data.json leadForm', () => {
    const lf = data().leadForm;
    it('has the switch, an endpoint slot, a timeout and the 4 class sets', () => {
        expect(typeof lf.enabled).toBe('boolean');
        expect(typeof lf.endpoint).toBe('string');
        if (lf.endpoint) expect(lf.endpoint).toMatch(/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/);
        expect(lf.timeoutMs).toBeGreaterThanOrEqual(3000);
        for (const s of ['all', 'board', 'parents', 'pro']) {
            expect(Array.isArray(lf.sets[s].classes) && lf.sets[s].classes.length).toBeTruthy();
            expect(typeof lf.sets[s].who).toBe('boolean');
        }
        expect(lf.sets.board.classes).toEqual(['Class 10', 'Class 12', 'Other']);
    });
    it('has the same wording keys in English, Hinglish and Hindi', () => {
        const keys = Object.keys(lf.copy.en).sort();
        for (const l of ['hinglish', 'hi']) expect(Object.keys(lf.copy[l]).sort()).toEqual(keys);
    });
    it('makes no fake-urgency, marks or subject claims', () => {
        const text = JSON.stringify(lf.copy);
        expect(text).not.toMatch(/limited seats|hurry|jaldi|जल्दी|only \d+ seats|marks|rank|topper|guarantee|math|science|physics|chemistry|biology/i);
    });
    it('every page that names a class set names one that exists', () => {
        const sets = Object.keys(data().leadForm.sets);
        const files = readdirSync(root).filter((f) => f.endsWith('.html')).concat(cfg.pages.map((p) => `${p.path}/index.html`));
        for (const f of files) {
            if (!existsSync(resolve(root, f))) continue;
            const m = read(f).match(/<html[^>]*data-lead-form="([^"]+)"/);
            if (m) expect(sets, f).toContain(m[1]);
        }
        expect(read('index-board27-en.html')).toMatch(/<html[^>]*data-lead-form="board"/);
        expect(read('index-pro.html')).toMatch(/<html[^>]*data-lead-form="pro"/);
        expect(read('index-parents.html')).toMatch(/<html[^>]*data-lead-form="parents"/);
    });
});

describe('script.js isLeadFormActive', () => {
    const w = win();
    const mk = (free, enabled, endpoint) => {
        const d = data();
        d.freeSignup.enabled = free;
        d.leadForm.enabled = enabled;
        d.leadForm.endpoint = endpoint;
        return d;
    };
    const URL_ = 'https://script.google.com/macros/s/ABC/exec';
    it('is on only in free mode with the switch on and an endpoint', () => {
        expect(w.SLA.isLeadFormActive(mk(true, true, URL_), '')).toBe(true);
        expect(w.SLA.isLeadFormActive(mk(true, true, ''), '')).toBe(false);
        expect(w.SLA.isLeadFormActive(mk(true, false, URL_), '')).toBe(false);
        expect(w.SLA.isLeadFormActive(mk(false, true, URL_), '')).toBe(false); // paid mode: buttons go to registration.link
    });
    it('?leadform=1 previews without an endpoint, ?leadform=0 turns it off', () => {
        expect(w.SLA.isLeadFormActive(mk(true, true, ''), '?leadform=1')).toBe(true);
        expect(w.SLA.isLeadFormActive(mk(true, true, URL_), '?utm_source=x&leadform=0')).toBe(false);
        expect(w.SLA.isLeadFormActive(mk(false, true, ''), '?leadform=1')).toBe(false);
    });
    it('loads the popup files only on demand (not in any page <head>)', () => {
        expect(read('script.js')).toMatch(/lead-form\.js\?v=/);
        for (const f of ['index-board27-en.html', 'index.html', 'index-simple.html']) expect(read(f)).not.toMatch(/lead-form\.js/);
    });
});

describe('lead-form.js helpers', () => {
    const L = win().SLALeadForm;
    it('normalises Indian mobile numbers', () => {
        expect(L.normalizePhone('9876543210')).toBe('9876543210');
        expect(L.normalizePhone('+91 98765-43210')).toBe('9876543210');
        expect(L.normalizePhone('09876543210')).toBe('9876543210');
        expect(L.normalizePhone('919876543210')).toBe('9876543210');
        expect(L.normalizePhone('12345')).toBe('');
        expect(L.normalizePhone('5876543210')).toBe(''); // Indian mobiles start with 6-9
    });
    it('validates required fields; email is optional', () => {
        const set = { who: true };
        expect(Object.keys(L.validate({}, set)).sort()).toEqual(['klass', 'name', 'phone', 'who']);
        expect(L.validate({ who: 'Parent', name: 'A', phone: '9876543210', klass: 'Class 10' }, set)).toEqual({});
        expect(L.validate({ who: 'Parent', name: 'A', phone: '9876543210', klass: 'Class 10', email: 'bad' }, set)).toEqual({ email: 'errEmail' });
        expect(L.validate({ name: 'A', phone: '9876543210', klass: 'Working' }, { who: false })).toEqual({});
    });
    it('picks the wording by page language', () => {
        expect(L.pickLang('hi')).toBe('hi');
        expect(L.pickLang('hi-Latn')).toBe('hinglish');
        expect(L.pickLang('en')).toBe('en');
        expect(L.pickLang('')).toBe('en');
    });
    it('keeps ad click ids for the visit', () => {
        expect(L.collectTracking('?utm_source=google&gclid=XYZ&x=1')).toEqual({ utm_source: 'google', gclid: 'XYZ' });
        expect(L.collectTracking('')).toEqual({ utm_source: 'google', gclid: 'XYZ' }); // later page view without the query
    });
    it('opens an accessible dialog with the page set and closes on Escape', () => {
        const w = win();
        w.document.documentElement.setAttribute('data-lead-form', 'board');
        w.SLA_DATA = data();
        w.SLALeadForm.open('https://www.superlearneracademy.in/thank-you.html');
        const dlg = w.document.querySelector('.slaf [role="dialog"]');
        expect(dlg.getAttribute('aria-modal')).toBe('true');
        expect(Array.from(w.document.querySelectorAll('.slaf input[name="klass"]')).map((i) => i.value)).toEqual(['Class 10', 'Class 12', 'Other']);
        expect(w.document.querySelectorAll('.slaf input[name="who"]').length).toBe(2);
        expect(w.document.querySelector('.slaf input[name="website"]').tabIndex).toBe(-1); // bot trap
        w.document.querySelector('.slaf').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(w.document.querySelector('.slaf').hasAttribute('hidden')).toBe(true);
    });
});

describe('google-apps-script-leads.js', () => {
    const gs = read('google-apps-script-leads.js');
    it('writes under a lock and blocks spreadsheet formulas from visitors', () => {
        expect(gs).toMatch(/function doPost\(e\)/);
        expect(gs).toMatch(/function setup\(\)/);
        expect(gs).toMatch(/LockService\.getScriptLock\(\)/);
        expect(gs).toMatch(/\^\[=\+\\-@\]/);
        for (const h of ['Who', 'Name', 'WhatsApp', 'Email', 'Class', 'Status', 'utm_campaign', 'gclid', 'fbclid']) expect(gs).toContain(`'${h}'`);
    });
    it('uses the same phone rule as the website', () => {
        const phone_ = new Function(gs.match(/function phone_\(v\) \{[\s\S]*?\n\}/)[0] + '; return phone_;')();
        const L = win().SLALeadForm;
        for (const v of ['9876543210', '+91 98765 43210', '09876543210', '12345', '5876543210']) expect(phone_(v)).toBe(L.normalizePhone(v));
    });
});
