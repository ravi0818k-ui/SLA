/**
 * Unit tests for data loading and error handling.
 * Validates: Requirements 1.1, 1.4, 1.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const scriptContent = readFileSync(resolve(__dirname, '../../script.js'), 'utf-8');

// Load the script fresh before each test
beforeEach(() => {
    // Reset window.SLA
    delete window.SLA;

    // Execute script.js using eval (jsdom doesn't execute script elements)
    const fn = new Function(scriptContent);
    fn();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('Data Loading - DOM Injection', () => {
    it('injects text content into [data-bind] elements', () => {
        document.body.innerHTML = '<span data-bind="registration.price">default</span>';

        window.SLA.injectContent({ registration: { price: '455' } });

        expect(document.querySelector('[data-bind="registration.price"]').textContent).toBe('455');
    });

    it('injects nested path values into [data-bind] elements', () => {
        document.body.innerHTML = `
            <span data-bind="workshop.name">Workshop</span>
            <span data-bind="registration.buttonText">Register</span>
        `;

        window.SLA.injectContent({
            workshop: { name: 'Super Learner Academy - 2 Day Live Webinar' },
            registration: { buttonText: 'REGISTER NOW FOR ₹455/- ONLY' }
        });

        expect(document.querySelector('[data-bind="workshop.name"]').textContent)
            .toBe('Super Learner Academy - 2 Day Live Webinar');
        expect(document.querySelector('[data-bind="registration.buttonText"]').textContent)
            .toBe('REGISTER NOW FOR ₹455/- ONLY');
    });

    it('injects href into [data-bind-href] elements', () => {
        document.body.innerHTML = '<a data-bind-href="registration.link" href="#">link</a>';

        window.SLA.injectContent({
            registration: { link: 'https://pages.razorpay.com/pl_XXXX/view' }
        });

        expect(document.querySelector('[data-bind-href]').href)
            .toBe('https://pages.razorpay.com/pl_XXXX/view');
    });

    it('injects multiple href values correctly', () => {
        document.body.innerHTML = `
            <a data-bind-href="registration.link" href="#">register</a>
            <a data-bind-href="whatsapp.link" href="#">whatsapp</a>
        `;

        window.SLA.injectContent({
            registration: { link: 'https://razorpay.com/pay' },
            whatsapp: { link: 'https://chat.whatsapp.com/group123' }
        });

        const links = document.querySelectorAll('[data-bind-href]');
        expect(links[0].href).toBe('https://razorpay.com/pay');
        expect(links[1].href).toBe('https://chat.whatsapp.com/group123');
    });
});

describe('Data Loading - Missing Fields Handling', () => {
    it('keeps static text when data field is missing', () => {
        document.body.innerHTML = '<span data-bind="registration.price">₹499</span>';

        // Inject data that doesn't contain the expected path
        window.SLA.injectContent({ workshop: { name: 'Test' } });

        expect(document.querySelector('[data-bind="registration.price"]').textContent).toBe('₹499');
    });

    it('keeps static text when nested path is partially defined', () => {
        document.body.innerHTML = '<span data-bind="registration.buttonText">Register Now</span>';

        // registration exists but buttonText is missing
        window.SLA.injectContent({ registration: { price: '455' } });

        expect(document.querySelector('[data-bind="registration.buttonText"]').textContent).toBe('Register Now');
    });

    it('keeps static href when data-bind-href path is undefined', () => {
        document.body.innerHTML = '<a data-bind-href="registration.link" href="https://fallback.com">link</a>';

        window.SLA.injectContent({ registration: {} });

        expect(document.querySelector('[data-bind-href]').href).toBe('https://fallback.com/');
    });

    it('handles completely empty data object gracefully', () => {
        document.body.innerHTML = `
            <span data-bind="registration.price">₹499</span>
            <a data-bind-href="registration.link" href="#">link</a>
        `;

        // Should not throw
        expect(() => window.SLA.injectContent({})).not.toThrow();

        expect(document.querySelector('[data-bind]').textContent).toBe('₹499');
    });
});

describe('Data Loading - Fetch Failure Fallback', () => {
    it('hides [data-dynamic-only] elements on network error', async () => {
        document.body.innerHTML = `
            <div data-dynamic-only>Dynamic Content</div>
            <div>Static Content</div>
        `;

        global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await window.SLA.loadData();

        expect(document.querySelector('[data-dynamic-only]').style.display).toBe('none');
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
    });

    it('logs error message with [SLA] prefix on fetch failure', async () => {
        document.body.innerHTML = '<div data-dynamic-only>Dynamic</div>';

        global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await window.SLA.loadData();

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[SLA]'),
            expect.any(String)
        );

        consoleSpy.mockRestore();
    });

    it('hides multiple [data-dynamic-only] elements on failure', async () => {
        document.body.innerHTML = `
            <div data-dynamic-only>One</div>
            <p data-dynamic-only>Two</p>
            <span data-dynamic-only>Three</span>
            <div>Static</div>
        `;

        global.fetch = vi.fn().mockRejectedValue(new Error('timeout'));
        vi.spyOn(console, 'error').mockImplementation(() => {});

        await window.SLA.loadData();

        const dynamicEls = document.querySelectorAll('[data-dynamic-only]');
        dynamicEls.forEach((el) => {
            expect(el.style.display).toBe('none');
        });
    });

    it('returns undefined on fetch failure', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await window.SLA.loadData();

        expect(result).toBeUndefined();
    });

    it('keeps static HTML content unchanged on fetch failure', async () => {
        document.body.innerHTML = `
            <h1>Super Learner Academy</h1>
            <span data-bind="registration.price">₹499</span>
            <div data-dynamic-only>Timer</div>
        `;

        global.fetch = vi.fn().mockRejectedValue(new Error('error'));
        vi.spyOn(console, 'error').mockImplementation(() => {});

        await window.SLA.loadData();

        // Static content remains
        expect(document.querySelector('h1').textContent).toBe('Super Learner Academy');
        // data-bind elements keep their fallback text (not injected)
        expect(document.querySelector('[data-bind]').textContent).toBe('₹499');
    });
});

describe('Data Loading - Malformed JSON Fallback', () => {
    it('triggers fallback when response is not valid JSON', async () => {
        document.body.innerHTML = '<div data-dynamic-only>Dynamic</div>';

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.reject(new SyntaxError('Unexpected token'))
        });
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await window.SLA.loadData();

        expect(document.querySelector('[data-dynamic-only]').style.display).toBe('none');
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[SLA]'),
            expect.any(String)
        );

        consoleSpy.mockRestore();
    });

    it('triggers fallback on HTTP error status', async () => {
        document.body.innerHTML = '<div data-dynamic-only>Dynamic</div>';

        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 404
        });
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await window.SLA.loadData();

        expect(document.querySelector('[data-dynamic-only]').style.display).toBe('none');
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[SLA]'),
            expect.stringContaining('404')
        );

        consoleSpy.mockRestore();
    });

    it('returns undefined on malformed JSON', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.reject(new SyntaxError('Unexpected token'))
        });
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await window.SLA.loadData();

        expect(result).toBeUndefined();
    });
});

describe('Data Loading - Successful Fetch', () => {
    it('returns parsed data object on success', async () => {
        const mockData = {
            registration: { price: '455', link: 'https://example.com' },
            countdown: { endDate: '2026-07-20T23:59:59' }
        };

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockData)
        });

        document.body.innerHTML = '<span data-bind="registration.price">default</span>';

        const result = await window.SLA.loadData();

        expect(result).toEqual(mockData);
    });

    it('injects content into DOM on successful fetch', async () => {
        const mockData = {
            registration: { price: '455', buttonText: 'Register Now' }
        };

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockData)
        });

        document.body.innerHTML = `
            <span data-bind="registration.price">default</span>
            <span data-bind="registration.buttonText">default</span>
        `;

        await window.SLA.loadData();

        expect(document.querySelector('[data-bind="registration.price"]').textContent).toBe('455');
        expect(document.querySelector('[data-bind="registration.buttonText"]').textContent).toBe('Register Now');
    });
});
