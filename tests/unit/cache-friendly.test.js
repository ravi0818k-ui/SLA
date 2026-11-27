/**
 * data.json / quotes.json must be fetched with a 5-minute version number, never a new one per visit:
 * Date.now() made every visitor skip the GitHub Pages CDN cache (k6 load test, 2026-11-24).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { JSDOM } from 'jsdom';

const root = resolve(__dirname, '..', '..');
const read = (f) => readFileSync(resolve(root, f), 'utf-8');
const FILES = ['script.js', 'index-home-hinglish.html', 'index-classic.html', 'index-hi.html', 'index-parents.html', 'index-board.html', 'index-board27.html', 'index-board27-en.html', 'index-pro.html', 'index-simple.html'];

describe('JSON fetches are CDN-cache friendly', () => {
    it.each(FILES)('%s has no per-visit ?v=Date.now() cache-buster', (f) => {
        expect(read(f)).not.toMatch(/\.json\?v='\s*\+\s*Date\.now\(\)/);
    });
    it('head design switch and script.js use the same 5-minute bucket', () => {
        for (const f of ['index-home-hinglish.html', 'index-classic.html']) {
            expect(read(f)).toContain("fetch('data.json?v=' + Math.floor(Date.now() / 300000))");
        }
        const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only' });
        dom.window.eval(read('script.js'));
        expect(dom.window.SLA.cacheBucket()).toBe(Math.floor(Date.now() / 300000));
    });
});
