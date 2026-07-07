/**
 * Unit tests for Analytics Conditional Injection
 * Validates Requirements: 9.1, 9.2, 9.4, 9.5
 *
 * Tests that GTM and FB Pixel scripts are only injected
 * when their respective IDs are non-empty strings.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

beforeEach(() => {
    // Clean up globals set by script.js
    delete window.SLA;
    delete window.dataLayer;
    delete window.fbq;
    delete window._fbq;

    // Reset DOM
    document.head.innerHTML = '';
    document.body.innerHTML = '<script></script>';

    // Load and execute script.js to get window.SLA
    const scriptContent = readFileSync(resolve(__dirname, '../../script.js'), 'utf-8');
    eval(scriptContent);
});

describe('Analytics Conditional Injection', () => {
    describe('GTM Injection (Requirements 9.1, 9.4)', () => {
        it('injects GTM script when gtmId is a non-empty string', () => {
            window.SLA.initAnalytics({ analytics: { gtmId: 'GTM-TEST123', fbPixel: '' } });

            // GTM pushes to window.dataLayer
            expect(window.dataLayer).toBeDefined();
            expect(window.dataLayer.length).toBeGreaterThan(0);

            // GTM creates a script element with googletagmanager.com src
            const scripts = document.querySelectorAll('script[src*="googletagmanager.com"]');
            expect(scripts.length).toBe(1);
            expect(scripts[0].src).toContain('GTM-TEST123');
        });

        it('does NOT inject GTM script when gtmId is an empty string', () => {
            window.SLA.initAnalytics({ analytics: { gtmId: '', fbPixel: '' } });

            expect(window.dataLayer).toBeUndefined();

            const scripts = document.querySelectorAll('script[src*="googletagmanager.com"]');
            expect(scripts.length).toBe(0);
        });

        it('does NOT inject GTM script when gtmId is null', () => {
            window.SLA.initAnalytics({ analytics: { gtmId: null, fbPixel: '' } });

            expect(window.dataLayer).toBeUndefined();

            const scripts = document.querySelectorAll('script[src*="googletagmanager.com"]');
            expect(scripts.length).toBe(0);
        });

        it('does NOT inject GTM script when gtmId is undefined', () => {
            window.SLA.initAnalytics({ analytics: { fbPixel: '' } });

            expect(window.dataLayer).toBeUndefined();

            const scripts = document.querySelectorAll('script[src*="googletagmanager.com"]');
            expect(scripts.length).toBe(0);
        });
    });

    describe('FB Pixel Injection (Requirements 9.2, 9.5)', () => {
        it('injects FB Pixel script when fbPixel is a non-empty string', () => {
            window.SLA.initAnalytics({ analytics: { gtmId: '', fbPixel: '123456789' } });

            // FB Pixel initializes window.fbq
            expect(window.fbq).toBeDefined();
            expect(typeof window.fbq).toBe('function');

            // FB Pixel creates a script element with facebook.net src
            const scripts = document.querySelectorAll('script[src*="connect.facebook.net"]');
            expect(scripts.length).toBe(1);
        });

        it('does NOT inject FB Pixel script when fbPixel is an empty string', () => {
            window.SLA.initAnalytics({ analytics: { gtmId: '', fbPixel: '' } });

            expect(window.fbq).toBeUndefined();

            const scripts = document.querySelectorAll('script[src*="connect.facebook.net"]');
            expect(scripts.length).toBe(0);
        });

        it('does NOT inject FB Pixel script when fbPixel is null', () => {
            window.SLA.initAnalytics({ analytics: { gtmId: '', fbPixel: null } });

            expect(window.fbq).toBeUndefined();

            const scripts = document.querySelectorAll('script[src*="connect.facebook.net"]');
            expect(scripts.length).toBe(0);
        });

        it('does NOT inject FB Pixel script when fbPixel is undefined', () => {
            window.SLA.initAnalytics({ analytics: { gtmId: '' } });

            expect(window.fbq).toBeUndefined();

            const scripts = document.querySelectorAll('script[src*="connect.facebook.net"]');
            expect(scripts.length).toBe(0);
        });
    });
});
