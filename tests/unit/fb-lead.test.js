/**
 * Meta (Facebook/Instagram) "Lead" event on the thank-you page (2026-11-27): lets Meta ads optimise for real sign-ups.
 * Off until data.json analytics.fbPixel holds a pixel ID; fires once per tab.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const read = (f) => readFileSync(resolve(__dirname, '../..', f), 'utf-8');
const data = JSON.parse(read('data.json'));

describe('Meta Lead event', () => {
    beforeEach(() => {
        delete window.SLA; delete window.fbq; sessionStorage.clear();
        document.body.innerHTML = ''; document.body.setAttribute('data-page', 'thank-you');
        new Function(read('script.js'))();
    });

    it('is off while data.json has no pixel ID (today)', () => {
        expect(data.analytics.fbPixel).toBe('');
        window.fbq = vi.fn();
        window.SLA.initAnalytics(data);
        expect(window.fbq).not.toHaveBeenCalled();
    });

    it('sends one Lead with value 0 in free mode, and not again on reload in the same tab', () => {
        window.fbq = vi.fn();
        expect(window.SLA.trackFBLead(data)).toBe(true);
        expect(window.fbq).toHaveBeenCalledWith('track', 'Lead', expect.objectContaining({ value: data.freeSignup.enabled ? 0 : Number(data.registration.price), currency: 'INR' }));
        expect(window.SLA.trackFBLead(data)).toBe(false);
        expect(window.fbq).toHaveBeenCalledTimes(1);
    });

    it('does nothing when the pixel is not loaded', () => {
        expect(window.SLA.trackFBLead(data)).toBe(false);
    });
});
