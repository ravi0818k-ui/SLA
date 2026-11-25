/**
 * Hamburger menu site map (site-nav.js, 2026-11-25): with JS on, the static "Pages" / "Free Tools"
 * lists are replaced by one grouped map of every public page (search, "You're here", copy-link).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const root = resolve(__dirname, '..', '..');
const read = (f) => readFileSync(resolve(root, f), 'utf-8');
const navJs = read('site-nav.js');
const adPages = JSON.parse(read('ad-pages.json')).pages;

function openPage(file, url) {
    window.history.replaceState(null, '', url);
    document.documentElement.innerHTML = read(file);
    new Function(navJs)();   // document is already parsed, so the IIFE runs initSiteNav() at once
    return document.getElementById('site-nav-panel');
}

const mapLinks = (panel) => Array.from(panel.querySelectorAll('.site-nav-map a')).map((a) => a.getAttribute('href'));

describe('site map in the hamburger menu', () => {
    beforeEach(() => { delete window.SLASiteNav; });

    it('lists every ad landing page from ad-pages.json (main path, not the /ads-N/ alias)', () => {
        const panel = openPage('about.html', '/about.html');
        const links = mapLinks(panel);
        for (const p of adPages) {
            expect(links).toContain(`${p.path}/`);
            for (const alias of p.aliases || []) expect(links).not.toContain(`${alias}/`);
        }
    });

    it('lists home, about and the free tools, and every link points at a real file', () => {
        const panel = openPage('about.html', '/about.html');
        const links = mapLinks(panel);
        for (const l of ['./', 'about.html', 'quiz.html', 'mindmap/index.html', 'generatenotes/index.html', 'resources.html']) {
            expect(links).toContain(l);
        }
        for (const l of links) {
            const file = l === './' ? 'index.html' : l.endsWith('/') ? `${l}index.html` : l;
            expect(existsSync(resolve(root, file)), file).toBe(true);
        }
    });

    it('never links the thank-you page (opening it fires the Google Ads conversion)', () => {
        const panel = openPage('about.html', '/about.html');
        expect(mapLinks(panel).some((l) => l.includes('thank-you'))).toBe(false);
    });

    it('replaces the static lists and keeps the contact block', () => {
        const panel = openPage('about.html', '/about.html');
        expect(panel.querySelectorAll(':scope > .site-nav-list').length).toBe(0);
        expect(panel.querySelector('.site-nav-map')).not.toBeNull();
        expect(panel.querySelector('.site-nav-contact')).not.toBeNull();
        expect(panel.querySelector('.site-nav-map').nextElementSibling.textContent).toMatch(/Contact/i);
    });

    it('marks the current page, also on the /ads-N/ copy and from a sub-folder', () => {
        let panel = openPage('about.html', '/about.html');
        expect(panel.querySelector('[aria-current="page"]').getAttribute('href')).toBe('about.html');

        panel = openPage('ads-5/index.html', '/ads-5/');
        const cur = panel.querySelector('[aria-current="page"]');
        expect(cur.getAttribute('href')).toBe('../board-ads-5-topper/');
        expect(cur.textContent).toMatch(/You.re here/);
        expect(mapLinks(panel)).toContain('../');   // Home from one folder down
    });

    it('search filters the list and shows a message when nothing matches', () => {
        const panel = openPage('about.html', '/about.html');
        const input = panel.querySelector('.site-nav-search input');
        input.value = 'parents';
        input.dispatchEvent(new Event('input'));
        const visible = Array.from(panel.querySelectorAll('.site-nav-map li')).filter((li) => !li.hidden);
        expect(visible.length).toBe(1);
        expect(visible[0].textContent).toMatch(/Parents/);

        input.value = 'zzzz';
        input.dispatchEvent(new Event('input'));
        expect(panel.querySelector('.site-nav-empty').hidden).toBe(false);
    });

    it('workshop pages have a copy-link button with the public URL', () => {
        const panel = openPage('about.html', '/about.html');
        const btns = panel.querySelectorAll('.site-nav-copy');
        expect(btns.length).toBe(adPages.length);
        expect(navJs).toContain("PUBLIC_ROOT = 'https://www.superlearneracademy.in/'");
    });

    it('every page with the menu loads the same new menu version', () => {
        for (const f of ['index.html', 'index-classic.html', 'index-hi.html', 'index-parents.html', 'index-board.html', 'index-pro.html',
            'about.html', 'quiz.html', 'resources.html', 'thank-you.html', 'mindmap/index.html', 'generatenotes/index.html']) {
            const html = read(f);
            expect(html, f).toMatch(/site-nav\.js\?v=1\.2\.0/);
            expect(html, f).toMatch(/site-nav\.css\?v=1\.1\.0/);
        }
    });
});
