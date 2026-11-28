/**
 * Hamburger menu site map (site-nav.js, 2026-11-25): with JS on, the static "Pages" / "Free Tools"
 * lists are replaced by one grouped map of every public page (search, "You're here", copy-link).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
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
            const f = l.split('#')[0];
            const file = f === './' ? 'index.html' : f.endsWith('/') ? `${f}index.html` : f;
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
        const btns = panel.querySelectorAll('.site-nav-map .site-nav-copy');
        // plus one more on the Google review link (2026-11-28)
        expect(panel.querySelectorAll('.site-nav-review .site-nav-copy').length).toBe(1);
        expect(btns.length).toBe(adPages.length);
        expect(navJs).toContain("PUBLIC_ROOT = 'https://www.superlearneracademy.in/'");
    });

    it('every page with the menu loads the same new menu version', () => {
        for (const f of ['index.html', 'index-classic.html', 'index-hi.html', 'index-parents.html', 'index-board.html', 'index-board27.html', 'index-board27-en.html', 'index-pro.html',
            'about.html', 'quiz.html', 'resources.html', 'thank-you.html', 'mindmap/index.html', 'generatenotes/index.html',
            'privacy-policy.html', 'terms.html', 'refund-policy.html']) {
            const html = read(f);
            expect(html, f).toMatch(/site-nav\.js\?v=1.3.5/);
            expect(html, f).toMatch(/site-nav\.css\?v=1\.2\.2/);
        }
    });

    it('every group starts collapsed, so no page link or URL shows until a group is opened', () => {
        const panel = openPage('board-ads-5-topper/index.html', '/board-ads-5-topper/');
        const groups = panel.querySelectorAll('.site-nav-group');
        expect(groups.length).toBe(3);
        for (const g of groups) {
            expect(g.querySelector('.site-nav-group-toggle').getAttribute('aria-expanded')).toBe('false');
            expect(g.querySelector('.site-nav-map-list').hidden).toBe(true);
        }
        const toggle = groups[1].querySelector('.site-nav-group-toggle');
        toggle.click();
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(groups[1].querySelector('.site-nav-map-list').hidden).toBe(false);
        expect(groups[0].querySelector('.site-nav-map-list').hidden).toBe(true);
        toggle.click();
        expect(groups[1].querySelector('.site-nav-map-list').hidden).toBe(true);
    });

    it('search opens the groups with matches, and clearing it collapses them again', () => {
        const panel = openPage('about.html', '/about.html');
        const input = panel.querySelector('.site-nav-search input');
        input.value = 'quiz';
        input.dispatchEvent(new Event('input'));
        const lists = panel.querySelectorAll('.site-nav-map-list');
        expect(lists[2].hidden).toBe(false);
        input.value = '';
        input.dispatchEvent(new Event('input'));
        for (const l of lists) expect(l.hidden).toBe(true);
    });
});

describe('LinkedIn + Instagram + YouTube + Facebook links (2026-11-26; Facebook 2026-11-28)', () => {
    const LI = 'https://www.linkedin.com/company/super-learner-academy';
    const IG = 'https://www.instagram.com/superlearneracademy/';
    const YT = 'https://www.youtube.com/@superlearneracademy';
    const FB = 'https://www.facebook.com/superlearneracademy';
    const data = JSON.parse(read('data.json'));

    it('data.json holds both profile URLs', () => {
        expect(data.contact.linkedin).toBe(LI);
        expect(data.contact.instagram).toBe(IG);
        expect(data.contact.youtube).toBe(YT);
        expect(data.contact.facebook).toBe(FB);
    });

    it('every footer has both links, and the About page lists both in Contact us', () => {
        for (const f of ['index.html', 'index-classic.html', 'index-hi.html', 'index-parents.html', 'index-board.html', 'index-board27.html', 'index-board27-en.html', 'index-pro.html', 'index-simple.html',
            'about.html', 'quiz.html', 'resources.html', 'thank-you.html', 'generatenotes/index.html']) {
            document.documentElement.innerHTML = read(f);
            const all = document.querySelectorAll('footer'), foot = all[all.length - 1];   // the page footer (some cards use <footer> too)
            expect(foot, f).not.toBeNull();
            expect(foot.querySelector(`a[href="${LI}"]`), f + ' LinkedIn').not.toBeNull();
            expect(foot.querySelector(`a[href="${IG}"]`), f + ' Instagram').not.toBeNull();
            expect(foot.querySelector(`a[href="${YT}"]`), f + ' YouTube').not.toBeNull();
            expect(foot.querySelector(`a[href="${FB}"]`), f + ' Facebook').not.toBeNull();
            // labelled line: "Follow us: Instagram: … YouTube: … LinkedIn: … Facebook: …", in that order
            const follow = Array.from(foot.querySelectorAll('.sla-follow a'));
            expect(follow.map((a) => a.getAttribute('href')), f + ' follow line').toEqual([IG, YT, LI, FB]);
            expect(follow.map((a) => a.textContent.split(':')[0]), f).toEqual(['Instagram', 'YouTube', 'LinkedIn', 'Facebook']);
        }
        document.documentElement.innerHTML = read('about.html');
        const contact = document.getElementById('contact');
        expect(contact.querySelector(`a[href="${LI}"]`)).not.toBeNull();
        expect(contact.querySelector(`a[href="${IG}"]`)).not.toBeNull();
        expect(contact.querySelector(`a[href="${YT}"]`)).not.toBeNull();
        expect(contact.querySelector(`a[href="${FB}"]`)).not.toBeNull();
    });

    it('the menu contact block has LinkedIn on every page with the menu', () => {
        const panel = openPage('index.html', '/');
        expect(panel.querySelector(`.site-nav-contact a[href="${LI}"]`)).not.toBeNull();
        expect(panel.querySelector(`.site-nav-contact a[href="${YT}"]`)).not.toBeNull();
        expect(panel.querySelector(`.site-nav-contact a[href="${FB}"]`)).not.toBeNull();
    });

    it('every page with a LinkedIn link has Facebook too (menu, footer, schema sameAs)', () => {
        const pages = readdirSync(root, { recursive: true }).map(String).filter((f) => f.endsWith('.html') && !/node_modules|(^|[\\/])\./.test(f));
        expect(pages.length).toBeGreaterThan(30);
        for (const f of pages) {
            const html = read(f);
            expect(html.split(FB).length, f).toBe(html.split(LI).length);
            const same = html.match(/"sameAs": \[[^\]]*\]/);
            if (same) expect(same[0], f).toContain(FB);
        }
    });
});

describe('standard footer: policy links on every page (2026-11-26)', () => {
    const POLICIES = ['privacy-policy.html', 'terms.html', 'refund-policy.html'];
    const SOURCES = ['index.html', 'index-classic.html', 'index-hi.html', 'index-parents.html', 'index-board.html', 'index-board27.html', 'index-board27-en.html', 'index-pro.html', 'index-simple.html'];
    const OTHER = ['about.html', 'quiz.html', 'resources.html', 'thank-you.html', 'generatenotes/index.html', ...POLICIES];
    const lastFooter = () => { const all = document.querySelectorAll('footer'); return all[all.length - 1]; };

    it('the three policy pages exist, are indexable and are in the sitemap', () => {
        const sitemap = read('sitemap.xml');
        for (const f of POLICIES) {
            const html = read(f);
            expect(html).toMatch(new RegExp(`<link rel="canonical" href="https://www.superlearneracademy.in/${f}">`));
            expect(html).not.toMatch(/noindex/);
            expect(sitemap).toContain(`https://www.superlearneracademy.in/${f}`);
        }
    });

    it('every page footer links Privacy, Terms, Refund and Contact, plus the copyright and no-promises note', () => {
        for (const f of [...SOURCES, ...OTHER, ...adPages.map((p) => `${p.path}/index.html`)]) {
            document.documentElement.innerHTML = read(f);
            const foot = lastFooter();
            const hrefs = Array.from(foot.querySelectorAll('.sla-legal a')).map((a) => a.getAttribute('href').replace(/^\.\.\//, ''));
            expect(hrefs, f).toEqual([...POLICIES, 'about.html#contact']);
            expect(foot.textContent, f).toMatch(/© 2026 Super Learner Academy/);
            expect(foot.querySelector('.sla-foot-note'), f).not.toBeNull();
        }
    });

    it('on landing pages the Refund Policy link is paid-mode only (free mode shows no refund wording)', () => {
        for (const f of SOURCES) {
            document.documentElement.innerHTML = read(f);
            expect(lastFooter().querySelector('.sla-legal a[href$="refund-policy.html"]').hasAttribute('data-paid'), f).toBe(true);
        }
    });
});
