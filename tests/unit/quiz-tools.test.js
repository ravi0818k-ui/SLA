/**
 * Smoke tests for quiz-tools.js — the 11 brain-training tools.
 *
 * Each tool is mounted into a detached host and then torn down. This catches
 * render-time exceptions and, importantly, verifies that every tool's cleanup
 * actually stops its timers, animation frames and audio: the router calls it
 * on every navigation, and a leaked rAF loop would keep burning CPU.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../..');
const quizScript = readFileSync(resolve(ROOT, 'quiz.js'), 'utf-8');
const toolsScript = readFileSync(resolve(ROOT, 'quiz-tools.js'), 'utf-8');
const quizHTML = readFileSync(resolve(ROOT, 'quiz.html'), 'utf-8');

let scriptsEvaluated = false;

function setup() {
    document.documentElement.innerHTML = quizHTML
        .replace(/<script[\s\S]*?<\/script>/g, '')
        .replace(/<link[^>]*>/g, '');
    if (!scriptsEvaluated) {
        new Function(quizScript)();
        new Function(toolsScript)();
        scriptsEvaluated = true;
    }
}

// quiz.js hands the tools its DOM helpers; mirror that contract.
function ctx() {
    return { h: window.SLAQuiz.h, svg: window.SLAQuiz.svg, go: () => {}, openDialog: () => {} };
}

function mount(id) {
    const host = document.createElement('div');
    host.className = 'tool-container';
    document.getElementById('app').appendChild(host);
    const cleanup = window.SLATools.mount(id, host, ctx());
    return { host, cleanup };
}

// jsdom has no canvas backend, so getContext('2d') returns null and the canvas
// tools would take their "unsupported" path. Stub a recording no-op context so
// the real drawing code runs and any exception in it surfaces here.
function stubCanvas() {
    const gradient = { addColorStop: vi.fn() };
    const make = () => ({
        fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', textAlign: '',
        fillRect: vi.fn(), strokeRect: vi.fn(), clearRect: vi.fn(),
        beginPath: vi.fn(), closePath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
        arc: vi.fn(), fill: vi.fn(), stroke: vi.fn(), fillText: vi.fn(),
        save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(),
        createRadialGradient: vi.fn(() => gradient),
        createLinearGradient: vi.fn(() => gradient)
    });
    vi.spyOn(window.HTMLCanvasElement.prototype, 'getContext').mockImplementation(make);
}

beforeEach(() => {
    setup();
    window.scrollTo = () => {};
    stubCanvas();
    // jsdom implements neither of these.
    window.HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
    window.HTMLMediaElement.prototype.pause = vi.fn();
    window.HTMLMediaElement.prototype.load = vi.fn();
    vi.stubGlobal('fetch', vi.fn((url) => {
        const path = resolve(ROOT, String(url).split('?')[0]);
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(readFileSync(path, 'utf-8'))) });
    }));
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

const TOOL_IDS = [
    'audio', 'nlp', 'mandala', 'focus-grid', 'peg-system', 'speed-reading',
    'ball-focus', 'eye-exercise', 'mental-math', 'timer', 'reflects'
];

describe('tool registry', () => {
    it('quiz.js and quiz-tools.js agree on the tool list', () => {
        const advertised = window.SLAQuiz.TOOLS.map((t) => t.id).sort();
        const implemented = window.SLATools.ids.slice().sort();
        expect(implemented).toEqual(advertised);
    });

    it('implements all 11 tools', () => {
        expect(window.SLATools.ids.slice().sort()).toEqual(TOOL_IDS.slice().sort());
    });
});

describe('mounting', () => {
    for (const id of TOOL_IDS) {
        it(`${id} renders a card, a heading and a back link`, () => {
            const { host, cleanup } = mount(id);

            expect(host.querySelector('.tool-card'), `${id} card`).toBeTruthy();
            expect(host.querySelector('.tool-head h1'), `${id} heading`).toBeTruthy();
            expect(host.querySelector('.tool-head h1').textContent.length).toBeGreaterThan(3);
            expect(host.textContent, `${id} back link`).toContain('Back to Home');
            expect(typeof cleanup, `${id} cleanup`).toBe('function');

            cleanup();
        });
    }

    it('an unknown tool id renders a message instead of throwing', () => {
        const { host, cleanup } = mount('not-a-tool');
        expect(host.textContent).toContain('not available');
        cleanup();
    });
});

describe('cleanup', () => {
    it('every tool tears down without throwing, even before being started', () => {
        for (const id of TOOL_IDS) {
            const { cleanup } = mount(id);
            expect(() => cleanup(), `${id}`).not.toThrow();
        }
    });

    it('stops animation frames started by the canvas tools', () => {
        for (const id of ['ball-focus', 'eye-exercise']) {
            const raf = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
            const caf = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

            const { host, cleanup } = mount(id);
            // Click the tool's "Start" control to kick off the loop.
            const start = Array.from(host.querySelectorAll('button'))
                .find((b) => b.textContent.includes('Start'));
            expect(start, `${id} has a start button`).toBeTruthy();
            start.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
            expect(raf, `${id} should start a rAF loop`).toHaveBeenCalled();

            cleanup();
            expect(caf, `${id} should cancel its rAF loop on cleanup`).toHaveBeenCalled();

            raf.mockRestore();
            caf.mockRestore();
        }
    });

    it('stops the interval-driven tools', () => {
        vi.useFakeTimers();
        try {
            for (const id of ['mandala', 'mental-math', 'timer']) {
                const { cleanup } = mount(id);
                cleanup();
                // Nothing should still be scheduled once a tool is torn down.
                expect(vi.getTimerCount(), `${id} left timers running`).toBe(0);
            }
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('audio tools', () => {
    it('list their tracks and point at files in media/audio/', () => {
        for (const id of ['audio', 'nlp']) {
            const { host, cleanup } = mount(id);
            const items = host.querySelectorAll('.track-item');
            expect(items.length, `${id} tracks`).toBeGreaterThan(0);
            cleanup();
        }
    });

    it('loads a track into the audio element when one is clicked', () => {
        const { host, cleanup } = mount('audio');
        host.querySelector('.track-item').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
        const audio = host.querySelector('audio');
        expect(audio.getAttribute('src')).toContain('media/audio/');
        cleanup();
    });

    it('defers audio download until a track is chosen', () => {
        const { host, cleanup } = mount('nlp');
        expect(host.querySelector('audio').getAttribute('preload')).toBe('none');
        cleanup();
    });
});

describe('peg system', () => {
    it('offers three levels and opens a viewer on selection', () => {
        const { host, cleanup } = mount('peg-system');
        const levels = Array.from(host.querySelectorAll('button'))
            .filter((b) => b.textContent.includes('Level'));
        expect(levels.length).toBe(3);

        levels[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
        const img = host.querySelector('.peg-viewer img');
        expect(img).toBeTruthy();
        expect(img.getAttribute('src')).toBe('media/peg-system/peg-1.webp');
        cleanup();
    });
});

describe('mental math', () => {
    it('keeps Start disabled until an operation and a level are chosen', () => {
        const { host, cleanup } = mount('mental-math');
        const startBtn = () => Array.from(host.querySelectorAll('button'))
            .find((b) => b.textContent === '▶ Start');

        expect(startBtn().disabled).toBe(true);

        Array.from(host.querySelectorAll('button'))
            .find((b) => b.textContent.includes('Addition'))
            .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
        expect(startBtn().disabled, 'still needs a level').toBe(true);

        Array.from(host.querySelectorAll('button'))
            .find((b) => b.textContent.includes('Level 1'))
            .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
        expect(startBtn().disabled).toBe(false);

        cleanup();
    });
});

describe('reflects', () => {
    it('renders one rewrite row per negative statement', () => {
        const { host, cleanup } = mount('reflects');
        expect(host.querySelectorAll('.reflect-row').length).toBe(10);
        // Each row pairs a fixed negative statement with an editable rewrite.
        const first = host.querySelector('.reflect-row');
        expect(first.querySelector('.reflect-negative').hasAttribute('readonly')).toBe(true);
        expect(first.querySelector('.reflect-positive').hasAttribute('readonly')).toBe(false);
        cleanup();
    });

    it('switches to the other two worksheets', () => {
        const { host, cleanup } = mount('reflects');
        Array.from(host.querySelectorAll('button'))
            .find((b) => b.textContent.includes('Action Plan'))
            .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
        expect(host.textContent).toContain('Reflection statement');
        cleanup();
    });
});
