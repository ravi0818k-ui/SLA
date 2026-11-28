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
    it('has the switch, an endpoint slot, a timeout and the 4 class questions', () => {
        expect(typeof lf.enabled).toBe('boolean');
        expect(typeof lf.endpoint).toBe('string');
        if (lf.endpoint) expect(lf.endpoint).toMatch(/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/);
        expect(lf.timeoutMs).toBeGreaterThanOrEqual(3000);
        for (const s of ['all', 'board', 'parents', 'pro']) {
            expect(['number', 'text', 'chips']).toContain(lf.sets[s].classInput);
            expect(typeof lf.sets[s].who).toBe('boolean');
        }
        // 4th-grader test (2026-11-28): school pages ask the class in ONE box, not choice buttons
        expect(lf.sets.board.classInput).toBe('number');
        expect(lf.sets.parents.classInput).toBe('number');
        expect(lf.sets.all.classInput).toBe('text');
        expect(lf.sets.pro.classes.length).toBeGreaterThan(1);
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
        expect(L.validate({ who: 'Parent', name: 'A', phone: '9876543210', klass: '10' }, set)).toEqual({});
        expect(L.validate({ who: 'Parent', name: 'A', phone: '9876543210', klass: '10', email: 'bad' }, set)).toEqual({ email: 'errEmail' });
        expect(L.validate({ name: 'A', phone: '9876543210', klass: 'Working' }, { who: false, classInput: 'chips' })).toEqual({});
        expect(L.validate({ who: 'Student', name: 'A', phone: '9876543210', klass: '15' }, { who: true, classInput: 'number' })).toEqual({ klass: 'errClassNum' });
    });
    it('trims a saved number (0, 91, +91, 0091 in front) to 10 digits while typing', () => {
        expect(L.cleanPhoneInput('09876543210')).toBe('9876543210');
        expect(L.cleanPhoneInput('919876543210')).toBe('9876543210');
        expect(L.cleanPhoneInput('+91 98765-43210')).toBe('9876543210');
        expect(L.cleanPhoneInput('00919876543210')).toBe('9876543210');
        expect(L.cleanPhoneInput('+91 98765')).toBe('9198765'); // still typing: nothing cut yet
        expect(L.cleanPhoneInput('91987654321')).toBe('91987654321'); // "+91" + 9 digits so far: wait for the last digit
        expect(L.cleanPhoneInput('9123456789')).toBe('9123456789'); // a real number that starts with 91 stays
        expect(L.cleanPhoneInput('98765432109')).toBe('9876543210'); // one digit too many
    });
    it('turns a typed class into what the sheet stores', () => {
        expect(L.normalizeClass('4', 'number')).toBe('Class 4');
        expect(L.normalizeClass('10th', 'number')).toBe('Class 10');
        expect(L.normalizeClass('class 12', 'text')).toBe('Class 12');
        expect(L.normalizeClass('13', 'number')).toBe('');
        expect(L.normalizeClass('College', 'number')).toBe('');
        expect(L.normalizeClass('College', 'text')).toBe('College');
        expect(L.normalizeClass('', 'text')).toBe('');
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
        const klass = w.document.querySelectorAll('.slaf input[name="klass"]');
        expect(klass.length).toBe(1); // one box to type in
        expect(klass[0].getAttribute('inputmode')).toBe('numeric');
        expect(klass[0].getAttribute('placeholder')).toBe('e.g. 10');
        expect(w.document.querySelectorAll('.slaf input[name="who"]').length).toBe(2);
        expect(w.document.querySelector('.slaf .slaf-seg-words strong').textContent).toBe("I'm a student");
        const phone = w.document.querySelector('#slaf-phone');
        phone.value = '+91 98765 43210';
        phone.dispatchEvent(new w.Event('input', { bubbles: true }));
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
