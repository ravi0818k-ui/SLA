/**
 * Unit tests for countdown timer edge cases.
 * Tests Requirements: 3.3, 3.4, 3.5, 3.6
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Countdown Timer Edge Cases', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        delete window.SLA;
        localStorage.clear();

        // Set up countdown DOM structure
        document.body.innerHTML = `
            <div id="countdown-timer">
                <span id="countdown-days">00</span>
                <span id="countdown-hours">00</span>
                <span id="countdown-minutes">00</span>
                <span id="countdown-seconds">00</span>
            </div>
            <div id="countdown-expired" style="display:none;"></div>
        `;

        // Load script.js to get window.SLA
        const scriptPath = resolve(__dirname, '../../script.js');
        const scriptContent = readFileSync(scriptPath, 'utf-8');
        eval(scriptContent);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    /**
     * Requirement 3.6: IF the end date is already in the past when the Landing_Page loads,
     * THEN THE Countdown_Timer SHALL display the expired message immediately without showing
     * the numeric countdown.
     */
    describe('Expired date shows expired message immediately', () => {
        it('displays expired message when end date is in the past', () => {
            const pastDate = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
            const mockData = {
                countdown: {
                    endDate: pastDate,
                    timezone: 'Asia/Kolkata',
                    expiredMessage: 'Registration Closed!'
                }
            };

            window.SLA.initCountdown(mockData);

            const timerEl = document.getElementById('countdown-timer');
            const expiredEl = document.getElementById('countdown-expired');

            // Timer boxes should be hidden
            expect(timerEl.style.display).toBe('none');
            // Expired message should be visible
            expect(expiredEl.style.display).toBe('block');
            expect(expiredEl.textContent).toBe('Registration Closed!');
        });

        it('uses custom expired message from Data_Store', () => {
            const pastDate = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
            const mockData = {
                countdown: {
                    endDate: pastDate,
                    timezone: 'Asia/Kolkata',
                    expiredMessage: 'Workshop Has Started!'
                }
            };

            window.SLA.initCountdown(mockData);

            const expiredEl = document.getElementById('countdown-expired');
            expect(expiredEl.textContent).toBe('Workshop Has Started!');
        });
    });

    /**
     * Requirement 3.3: WHEN the countdown reaches zero, THE Countdown_Timer SHALL replace
     * the numeric countdown display with the expired message from the Data_Store.
     */
    describe('Timer reaching zero replaces display with expired message', () => {
        it('shows expired message when countdown reaches zero during session', () => {
            // Set end date 3 seconds from now
            const endDate = new Date(Date.now() + 3000).toISOString();
            const mockData = {
                countdown: {
                    endDate: endDate,
                    timezone: 'Asia/Kolkata',
                    expiredMessage: 'Registration Closed!'
                }
            };

            window.SLA.initCountdown(mockData);

            // Timer should be visible initially
            const timerEl = document.getElementById('countdown-timer');
            const expiredEl = document.getElementById('countdown-expired');
            expect(timerEl.style.display).not.toBe('none');
            expect(expiredEl.style.display).toBe('none');

            // Advance time past the end date
            vi.advanceTimersByTime(4000);

            // Now expired message should be shown
            expect(timerEl.style.display).toBe('none');
            expect(expiredEl.style.display).toBe('block');
            expect(expiredEl.textContent).toBe('Registration Closed!');
        });
    });

    /**
     * Requirement 3.4, 3.5: THE Countdown_Timer SHALL persist its reference end date
     * in localStorage so the deadline remains consistent across page refreshes.
     * IF the end date in the Data_Store differs from localStorage, use Data_Store and update localStorage.
     */
    describe('localStorage is synced on load', () => {
        it('writes Data_Store date to localStorage on first load', () => {
            const futureDate = new Date(Date.now() + 86400000).toISOString(); // 1 day
            const mockData = {
                countdown: {
                    endDate: futureDate,
                    timezone: 'Asia/Kolkata',
                    expiredMessage: 'Registration Closed!'
                }
            };

            expect(localStorage.getItem('sla_countdown_endDate')).toBeNull();

            window.SLA.initCountdown(mockData);

            expect(localStorage.getItem('sla_countdown_endDate')).toBe(futureDate);
        });

        it('updates localStorage when Data_Store differs from stored value', () => {
            const oldDate = '2026-06-15T23:59:59';
            const newDate = '2026-07-20T23:59:59';

            // Seed localStorage with old date
            localStorage.setItem('sla_countdown_endDate', oldDate);

            const mockData = {
                countdown: {
                    endDate: newDate,
                    timezone: 'Asia/Kolkata',
                    expiredMessage: 'Registration Closed!'
                }
            };

            window.SLA.initCountdown(mockData);

            // localStorage should be updated to the new Data_Store date
            expect(localStorage.getItem('sla_countdown_endDate')).toBe(newDate);
        });

        it('does not rewrite localStorage when Data_Store matches stored value', () => {
            const date = new Date(Date.now() + 86400000).toISOString();

            // Seed localStorage with same date as Data_Store
            localStorage.setItem('sla_countdown_endDate', date);
            const spy = vi.spyOn(Storage.prototype, 'setItem');

            const mockData = {
                countdown: {
                    endDate: date,
                    timezone: 'Asia/Kolkata',
                    expiredMessage: 'Registration Closed!'
                }
            };

            window.SLA.initCountdown(mockData);

            // setItem should not have been called since values match
            expect(spy).not.toHaveBeenCalled();
            spy.mockRestore();
        });
    });

    /**
     * Requirement 3.5 (edge case): IF localStorage is corrupted, the countdown SHALL
     * ignore it and use the Data_Store value.
     */
    describe('Corrupted localStorage is ignored, Data_Store value used', () => {
        it('uses Data_Store value when localStorage.getItem throws', () => {
            const futureDate = new Date(Date.now() + 86400000).toISOString();
            const mockData = {
                countdown: {
                    endDate: futureDate,
                    timezone: 'Asia/Kolkata',
                    expiredMessage: 'Registration Closed!'
                }
            };

            // Mock localStorage.getItem to throw (simulating corruption)
            const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
                throw new Error('SecurityError: localStorage is not available');
            });

            window.SLA.initCountdown(mockData);

            // The timer should still work — it uses Data_Store value
            const timerEl = document.getElementById('countdown-timer');
            expect(timerEl.style.display).not.toBe('none');

            getItemSpy.mockRestore();
        });

        it('uses Data_Store value when localStorage contains invalid data', () => {
            const futureDate = new Date(Date.now() + 86400000).toISOString();

            // Write garbage to localStorage
            localStorage.setItem('sla_countdown_endDate', 'corrupt-garbage-data');

            const mockData = {
                countdown: {
                    endDate: futureDate,
                    timezone: 'Asia/Kolkata',
                    expiredMessage: 'Registration Closed!'
                }
            };

            window.SLA.initCountdown(mockData);

            // Data_Store should take precedence and update localStorage
            expect(localStorage.getItem('sla_countdown_endDate')).toBe(futureDate);

            // Timer should display correctly (not expired)
            const timerEl = document.getElementById('countdown-timer');
            expect(timerEl.style.display).not.toBe('none');
        });
    });
});
