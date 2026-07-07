/**
 * Property-based tests for date formatting behavior.
 * Tests Property 8 from the design document.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

// Load script.js and evaluate it to populate window.SLA
beforeAll(() => {
    document.body.innerHTML = '';

    const scriptPath = resolve(__dirname, '../../script.js');
    const scriptContent = readFileSync(scriptPath, 'utf-8');

    // Evaluate the script in the current jsdom context
    const scriptFn = new Function(scriptContent);
    scriptFn.call(window);
});

// Feature: sla-webinar-landing-page, Property 8: Date formatting correctness
describe('Property 8: Date formatting correctness', () => {
    /**
     * Validates: Requirements 13.2
     *
     * For any valid ISO 8601 datetime string with timezone "Asia/Kolkata",
     * the formatted output SHALL contain the correct day number, full month name,
     * four-digit year, and 12-hour time with AM/PM and IST suffix.
     */
    it('formatted output contains correct day, month, year, and time with AM/PM and IST', () => {
        fc.assert(
            fc.property(
                fc.date({ min: new Date(2020, 0, 1), max: new Date(2030, 11, 31) }),
                (date) => {
                    const isoString = date.toISOString();
                    const result = window.SLA.formatWorkshopDate(isoString);

                    // Get what the date should be in IST (Asia/Kolkata)
                    const istDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
                    const day = istDate.getDate();
                    const month = months[istDate.getMonth()];
                    const year = istDate.getFullYear();

                    // Verify formatted output contains correct components
                    expect(result).toContain(String(day));
                    expect(result).toContain(month);
                    expect(result).toContain(String(year));
                    expect(result).toContain('IST');

                    // Check for AM or PM (case-insensitive since locale may vary)
                    const hasAmPm = /[AaPp][Mm]/.test(result);
                    expect(hasAmPm).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('known date formats correctly: 2026-07-21T19:00:00Z → 22 July 2026 IST', () => {
        // 2026-07-21T19:00:00Z in IST is 2026-07-22 00:30 (IST = UTC+5:30)
        const result = window.SLA.formatWorkshopDate('2026-07-21T19:00:00Z');
        expect(result).toContain('22');
        expect(result).toContain('July');
        expect(result).toContain('2026');
        expect(result).toContain('IST');
    });

    it('output always ends with IST suffix', () => {
        fc.assert(
            fc.property(
                fc.date({ min: new Date(2020, 0, 1), max: new Date(2030, 11, 31) }),
                (date) => {
                    // Guard against invalid dates
                    fc.pre(!isNaN(date.getTime()));
                    const isoString = date.toISOString();
                    const result = window.SLA.formatWorkshopDate(isoString);
                    return result.endsWith('IST');
                }
            ),
            { numRuns: 100 }
        );
    });
});
