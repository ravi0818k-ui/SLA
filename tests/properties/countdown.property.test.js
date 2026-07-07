/**
 * Property-based tests for countdown timer behavior.
 * Tests Properties 2 and 3 from the design document.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load script.js via eval to get the SLA namespace
beforeEach(() => {
    delete window.SLA;
    localStorage.clear();

    // Set up minimal DOM structure for countdown
    document.body.innerHTML = `
        <div id="countdown-timer">
            <span id="countdown-days">00</span>
            <span id="countdown-hours">00</span>
            <span id="countdown-minutes">00</span>
            <span id="countdown-seconds">00</span>
        </div>
        <div id="countdown-expired" style="display:none;"></div>
    `;

    const scriptPath = resolve(__dirname, '../../script.js');
    const scriptContent = readFileSync(scriptPath, 'utf-8');
    eval(scriptContent);
});

// Feature: sla-webinar-landing-page, Property 2: Countdown remaining time calculation
describe('Property 2: Countdown remaining time calculation', () => {
    /**
     * Validates: Requirements 3.1
     *
     * For any pair of timestamps (currentTime, endDate) where endDate > currentTime,
     * the countdown function SHALL return an object with days, hours, minutes, and seconds
     * such that: days * 86400 + hours * 3600 + minutes * 60 + seconds === Math.floor((endDate - currentTime) / 1000),
     * and hours ∈ [0,23], minutes ∈ [0,59], seconds ∈ [0,59].
     */
    it('components sum to total seconds difference for any future end date', () => {
        fc.assert(
            fc.property(
                // Generate an offset from 1 second to 2 years from NOW in ms
                fc.integer({ min: 1000, max: 2 * 365 * 24 * 60 * 60 * 1000 }),
                (offsetMs) => {
                    // Create an endDate that is offsetMs in the future from now
                    const now = Date.now();
                    const endDate = new Date(now + offsetMs);

                    const result = window.SLA.calculateTimeRemaining(endDate.toISOString());

                    // Should not be null since endDate > currentTime
                    expect(result).not.toBeNull();

                    // Components must be in valid ranges
                    expect(result.hours).toBeGreaterThanOrEqual(0);
                    expect(result.hours).toBeLessThanOrEqual(23);
                    expect(result.minutes).toBeGreaterThanOrEqual(0);
                    expect(result.minutes).toBeLessThanOrEqual(59);
                    expect(result.seconds).toBeGreaterThanOrEqual(0);
                    expect(result.seconds).toBeLessThanOrEqual(59);

                    // Components must sum to total seconds
                    // Allow ±1 second tolerance for timing between Date.now() calls
                    const totalSeconds = result.days * 86400 + result.hours * 3600 + result.minutes * 60 + result.seconds;
                    const expectedSeconds = Math.floor(offsetMs / 1000);
                    expect(Math.abs(totalSeconds - expectedSeconds)).toBeLessThanOrEqual(1);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('returns null when endDate is in the past', () => {
        const pastDate = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
        const result = window.SLA.calculateTimeRemaining(pastDate);
        expect(result).toBeNull();
    });

    it('returns null for invalid date string', () => {
        const result = window.SLA.calculateTimeRemaining('not-a-date');
        expect(result).toBeNull();
    });
});

// Feature: sla-webinar-landing-page, Property 3: Data_Store date takes precedence over localStorage
describe('Property 3: Data_Store date takes precedence over localStorage', () => {
    /**
     * Validates: Requirements 3.5
     *
     * For any pair of (dataStoreEndDate, localStorageEndDate) where the two values differ,
     * the countdown timer SHALL use dataStoreEndDate as the active deadline,
     * and localStorage SHALL be updated to dataStoreEndDate.
     */
    it('Data_Store end date takes precedence and localStorage is updated', () => {
        fc.assert(
            fc.property(
                // Generate two different timestamps in the future (2026-2030)
                fc.integer({ min: new Date(2026, 0, 1).getTime(), max: new Date(2030, 11, 31).getTime() }),
                fc.integer({ min: new Date(2026, 0, 1).getTime(), max: new Date(2030, 11, 31).getTime() }),
                (dataStoreMs, localStorageMs) => {
                    const dataStoreDateStr = new Date(dataStoreMs).toISOString();
                    const localStorageDateStr = new Date(localStorageMs).toISOString();

                    // Only test when dates differ (that's the property precondition)
                    fc.pre(dataStoreDateStr !== localStorageDateStr);

                    // Seed localStorage with a different date
                    localStorage.setItem('sla_countdown_endDate', localStorageDateStr);

                    // Create mock data with Data_Store end date
                    const mockData = {
                        countdown: {
                            endDate: dataStoreDateStr,
                            timezone: 'Asia/Kolkata',
                            expiredMessage: 'Registration Closed!'
                        }
                    };

                    // Initialize countdown with Data_Store data
                    window.SLA.initCountdown(mockData);

                    // Assert: localStorage should now be updated to the Data_Store date
                    const storedDate = localStorage.getItem('sla_countdown_endDate');
                    expect(storedDate).toBe(dataStoreDateStr);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('localStorage is set when it was previously empty', () => {
        const futureDate = new Date(Date.now() + 86400000).toISOString(); // 1 day from now
        const mockData = {
            countdown: {
                endDate: futureDate,
                timezone: 'Asia/Kolkata',
                expiredMessage: 'Registration Closed!'
            }
        };

        // localStorage is empty
        expect(localStorage.getItem('sla_countdown_endDate')).toBeNull();

        window.SLA.initCountdown(mockData);

        // Should be set to Data_Store date
        expect(localStorage.getItem('sla_countdown_endDate')).toBe(futureDate);
    });
});
