/**
 * Property-based tests for scroll-related behavior.
 * Tests Properties 1 and 7 from the design document.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load script.js and evaluate it to populate window.SLA
beforeAll(() => {
    // Set up minimal DOM structure needed by script.js DOMContentLoaded
    document.body.innerHTML = '';

    const scriptPath = resolve(__dirname, '../../script.js');
    const scriptContent = readFileSync(scriptPath, 'utf-8');

    // Evaluate the script in the current jsdom context
    // The IIFE assigns window.SLA at the end regardless of DOMContentLoaded
    const scriptFn = new Function(scriptContent);
    scriptFn.call(window);
});

// Feature: sla-webinar-landing-page, Property 1: Sticky CTA visibility follows scroll threshold
describe('Property 1: Sticky CTA visibility follows scroll threshold', () => {
    /**
     * Validates: Requirements 2.2, 2.3, 4.4
     *
     * For any scroll position value (non-negative number), the Sticky CTA's
     * visibility state SHALL equal scrollY > 700. When scrollY > 700, visible
     * is true; when scrollY ≤ 700, visible is false.
     */
    it('visibility state equals scrollY > 700 for any non-negative scroll position', () => {
        fc.assert(
            fc.property(
                fc.nat({ max: 10000 }),
                (scrollY) => {
                    const visible = window.SLA.getStickyVisibility(scrollY);
                    return visible === (scrollY > 700);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('boundary: scrollY === 700 is NOT visible', () => {
        const visible = window.SLA.getStickyVisibility(700);
        expect(visible).toBe(false);
    });

    it('boundary: scrollY === 701 IS visible', () => {
        const visible = window.SLA.getStickyVisibility(701);
        expect(visible).toBe(true);
    });
});

// Feature: sla-webinar-landing-page, Property 7: Stagger delay formula
describe('Property 7: Stagger delay formula', () => {
    /**
     * Validates: Requirements 7.2
     *
     * For any set of N grid items, item at index i (0-based) SHALL receive
     * an animation delay of i * 100 milliseconds. The delay assignment is
     * deterministic and linear.
     */
    it('item at index i receives delay of i * 100 ms', () => {
        fc.assert(
            fc.property(
                fc.nat({ max: 49 }),
                (index) => {
                    const delay = window.SLA.getStaggerDelay(index);
                    return delay === index * 100;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('delay at index 0 is 0ms', () => {
        expect(window.SLA.getStaggerDelay(0)).toBe(0);
    });

    it('delay is always a non-negative integer', () => {
        fc.assert(
            fc.property(
                fc.nat({ max: 100 }),
                (index) => {
                    const delay = window.SLA.getStaggerDelay(index);
                    return delay >= 0 && Number.isInteger(delay);
                }
            ),
            { numRuns: 100 }
        );
    });
});
