/**
 * Visitors outside India (2026-11-25): no redirect; a dismissible bar shows the LIVE class in the
 * visitor's own time and, on Hinglish/Hindi pages, links to the English page. data.json -> abroad.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const root = resolve(__dirname, '..', '..');
const read = (f) => readFileSync(resolve(root, f), 'utf-8');
const scriptJs = read('script.js');
const data = JSON.parse(read('data.json'));
// Wednesday 25 Nov 2026, 12:00 UTC -> next session Saturday 28 Nov, 19:00 IST = 13:30 UTC
const NOW = Date.UTC(2026, 10, 25, 12, 0, 0);

function openPage(file) {
    document.documentElement.innerHTML = read(file);
    // innerHTML on <html> drops its own attributes: copy lang and data-root (set on generated ad pages)
    const html = read(file);
    for (const attr of ['lang', 'data-root']) {
        const m = new RegExp(`<html[^>]*\\s${attr}="([^"]*)"`).exec(html);
        if (m) document.documentElement.setAttribute(attr, m[1]);
        else document.documentElement.removeAttribute(attr);
    }
    new Function(scriptJs)();
    return window.SLA;
}

describe('abroad bar: pure helpers', () => {
    it('isOutsideIndia: India and unknown timezones never count as abroad', () => {
        const SLA = openPage('index.html');
        expect(SLA.isOutsideIndia('Asia/Kolkata')).toBe(false);
        expect(SLA.isOutsideIndia('Asia/Calcutta')).toBe(false);
        expect(SLA.isOutsideIndia('')).toBe(false);
        expect(SLA.isOutsideIndia(undefined)).toBe(false);
        expect(SLA.isOutsideIndia('America/New_York')).toBe(true);
        expect(SLA.isOutsideIndia('Asia/Dubai')).toBe(true);
    });

    it('formatLocalSession converts 7-9 PM IST into the visitor time zone', () => {
        const SLA = openPage('index.html');
        const start = '2026-11-28T19:00:00+05:30';
        expect(SLA.formatLocalSession(start, 120, 'America/New_York')).toMatch(/^Sat 8:30\sAM – 10:30\sAM EST$/);
        expect(SLA.formatLocalSession(start, 120, 'Asia/Dubai')).toMatch(/^Sat 5:30\sPM – 7:30\sPM GMT\+4$/);
        // the day can change: Sydney is already Sunday
        expect(SLA.formatLocalSession(start, 120, 'Australia/Sydney')).toMatch(/^Sun 12:30\sAM – 2:30\sAM GMT\+11$/);
    });
});

describe('abroad bar on the pages', () => {
    beforeEach(() => { try { localStorage.clear(); } catch (e) { /* jsdom */ } });

    it('data.json has the settings and points at the English page', () => {
        expect(data.abroad.enabled).toBe(true);
        expect(data.abroad.englishPath).toBe('english-ads-1-students/');
        expect(data.countdown.weekly).toEqual({ day: 6, time: '19:00' });
    });

    it('is not shown to visitors in India', () => {
        const SLA = openPage('index-board.html');
        expect(SLA.initAbroadBar(data, { tz: 'Asia/Kolkata', now: NOW, search: '' })).toBeNull();
        expect(document.querySelector('.sla-abroad')).toBeNull();
    });

    it('Hinglish page abroad: local time + link to the English page (keeps utm params), no redirect', () => {
        const SLA = openPage('index-board.html');
        const bar = SLA.initAbroadBar(data, { tz: 'America/New_York', now: NOW, search: '?utm_source=yt' });
        expect(bar).not.toBeNull();
        expect(bar.textContent).toMatch(/Outside India\?/);
        expect(bar.textContent).toMatch(/Sat 8:30\sAM – 10:30\sAM EST your time/);
        expect(bar.textContent).toMatch(/IST/);
        const link = bar.querySelector('a.sla-abroad-en');
        expect(link.getAttribute('href')).toBe('english-ads-1-students/?utm_source=yt');
        expect(bar.parentNode.tagName).toBe('MAIN');
    });

    it('English pages show the local time but no "read in English" link', () => {
        for (const f of ['index-pro.html', 'index-simple.html', 'index-classic.html']) {
            const SLA = openPage(f);
            const bar = SLA.initAbroadBar(data, { tz: 'Europe/London', now: NOW, search: '' });
            expect(bar, f).not.toBeNull();
            expect(bar.querySelector('a.sla-abroad-en'), f).toBeNull();
            expect(bar.textContent, f).toMatch(/Sat 1:30\sPM – 3:30\sPM GMT your time/);
        }
    });

    it('generated ad pages link one folder up', () => {
        const SLA = openPage('hindi-ads-3-students/index.html');
        const bar = SLA.initAbroadBar(data, { tz: 'America/Chicago', now: NOW, search: '' });
        expect(bar.querySelector('a.sla-abroad-en').getAttribute('href')).toBe('../english-ads-1-students/');
    });

    it('closing it hides it and remembers the choice; ?abroad=1 still previews, ?abroad=0 hides', () => {
        let SLA = openPage('index.html');
        const bar = SLA.initAbroadBar(data, { tz: 'America/New_York', now: NOW, search: '' });
        bar.querySelector('.sla-abroad-x').click();
        expect(document.querySelector('.sla-abroad')).toBeNull();

        SLA = openPage('index.html');
        expect(SLA.initAbroadBar(data, { tz: 'America/New_York', now: NOW, search: '' })).toBeNull();
        expect(SLA.initAbroadBar(data, { tz: 'Asia/Kolkata', now: NOW, search: '?abroad=1' })).not.toBeNull();

        SLA = openPage('index.html');
        localStorage.clear();
        expect(SLA.initAbroadBar(data, { tz: 'America/New_York', now: NOW, search: '?abroad=0' })).toBeNull();
    });

    it('can be switched off from data.json', () => {
        const SLA = openPage('index.html');
        expect(SLA.initAbroadBar({ ...data, abroad: { ...data.abroad, enabled: false } }, { tz: 'America/New_York', now: NOW, search: '' })).toBeNull();
    });
});
