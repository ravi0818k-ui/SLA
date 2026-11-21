/**
 * Design switch: data.json site.design chooses between the new Bright Mind page (index.html)
 * and the frozen backup of the old page (index-classic.html).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const root = resolve(__dirname, '..', '..');
const read = (f) => readFileSync(resolve(root, f), 'utf-8');
const data = JSON.parse(read('data.json'));

function loadPage(file) {
    document.documentElement.innerHTML = read(file);
}

describe('data.json design flag', () => {
    it('site.design is "bright" or "classic"', () => {
        expect(['bright', 'classic']).toContain(data.site.design);
    });
    it('Hinglish copy for the bright page exists', () => {
        for (const k of ['heroTitle', 'heroSub', 'buttonText', 'stickyText', 'whatsappText', 'whatsappChat']) {
            expect(typeof data.bright[k]).toBe('string');
            expect(data.bright[k].length).toBeGreaterThan(0);
        }
        expect(data.bright.showTestimonials).toBe(false);
    });
});

describe('both designs are wired to the flag', () => {
    it.each([['index.html', 'bright', 'index-classic.html'], ['index-classic.html', 'classic', 'index.html']])(
        '%s declares itself as %s and can redirect to %s',
        (file, me, other) => {
            const html = read(file);
            expect(html).toContain(`data-design="${me}"`);
            expect(html).toContain(`})('${me}');`);
            expect(html).toContain(other);
            expect(html).toContain('d.site && d.site.design');
        }
    );
    it('the classic backup keeps its own frozen stylesheet', () => {
        expect(read('index-classic.html')).toContain('style-classic.css');
        expect(existsSync(resolve(root, 'style-classic.css'))).toBe(true);
    });
});

describe('bright page (index.html)', () => {
    it('has register CTAs bound to registration.link', () => {
        loadPage('index.html');
        const ctas = document.querySelectorAll('a.cta-button[data-bind-href="registration.link"]');
        expect(ctas.length).toBeGreaterThanOrEqual(6);
        ctas.forEach((a) => expect(a.getAttribute('href')).toMatch(/^https:\/\//));
    });
    it('audience picker: every tab controls an existing panel', () => {
        loadPage('index.html');
        const tabs = document.querySelectorAll('[role="tab"]');
        expect(tabs.length).toBe(7);
        tabs.forEach((t) => {
            const panel = document.getElementById(t.getAttribute('aria-controls'));
            expect(panel).not.toBeNull();
            expect(panel.getAttribute('aria-labelledby')).toBe(t.id);
        });
    });
    it('all local images exist and every illustration has alt text', () => {
        loadPage('index.html');
        document.querySelectorAll('img').forEach((img) => {
            const src = decodeURI(img.getAttribute('src'));
            expect(existsSync(resolve(root, src))).toBe(true);
            if (src.includes('Images/story/')) expect(img.getAttribute('alt').length).toBeGreaterThan(10);
        });
    });
    it('reviews stay hidden (no fabricated testimonials) and FAQ markup matches script.js', () => {
        loadPage('index.html');
        expect(document.getElementById('reviews').hasAttribute('hidden')).toBe(true);
        expect(document.querySelectorAll('.faq-item .faq-question[role="button"]').length).toBeGreaterThanOrEqual(8);
        for (const id of ['countdown-days', 'countdown-hours', 'countdown-minutes', 'countdown-seconds', 'countdown-timer', 'countdown-expired', 'scroll-to-top']) {
            expect(document.getElementById(id)).not.toBeNull();
        }
    });
    it('bright.js reveals reviews only when the flag is true', () => {
        loadPage('index.html');
        new Function(read('bright.js'))();
        const reviews = document.getElementById('reviews');
        window.SLABright.applyFlags({ bright: { showTestimonials: false } });
        expect(reviews.hidden).toBe(true);
        window.SLABright.applyFlags({ bright: { showTestimonials: true } });
        expect(reviews.hidden).toBe(false);
    });
});
