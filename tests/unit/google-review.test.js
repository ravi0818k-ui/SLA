/**
 * Google review link (2026-11-28): every page with the hamburger menu shows "Review us on Google"
 * (.site-nav-review, site-nav.js adds a copy button), and every footer links it too.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

const root = resolve(__dirname, '..', '..');
const REVIEW = 'https://g.page/r/CaHWZVTPGzDFEAI/review';
const pages = readdirSync(root, { recursive: true }).map(String)
    .filter((f) => f.endsWith('.html') && !/node_modules|(^|[\/])\./.test(f) && !/Favicon SLA|Resources-pdf|QuizQuestions/.test(f));
const read = (f) => readFileSync(resolve(root, f), 'utf-8');

describe('Google review link', () => {
    it('data.json has the review URL', () => {
        const data = JSON.parse(read('data.json'));
        expect(data.contact.googleReview).toBe(REVIEW);
    });

    it('every menu has the review link, opening in a new tab', () => {
        const withMenu = pages.filter((f) => read(f).includes('id="site-nav-panel"'));
        expect(withMenu.length).toBeGreaterThan(30);
        for (const f of withMenu) {
            const m = read(f).match(/<p class="site-nav-review"><a href="([^"]+)" target="_blank" rel="noopener noreferrer">/);
            expect(m && m[1], f).toBe(REVIEW);
        }
    });

    it('every footer links the review page', () => {
        for (const f of pages) {
            const html = read(f);
            const foot = html.slice(html.lastIndexOf('<footer'));
            if (!/class="(?:sla-follow|b-foot-head)"/.test(html)) continue; // site footers only (not the mind-map editor's status bar)
            expect(foot, f).toContain(`href="${REVIEW}"`);
        }
    });

    it('site-nav.js gives the review link a copy button', () => {
        const js = read('site-nav.js');
        expect(js).toMatch(/\.site-nav-review a\[href\]/);
        expect(js).toMatch(/copyButton\(a\.href/);
    });
});
