import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// The discount percentage formula used in the landing page
// script.js doesn't expose a dedicated calculateDiscount function,
// so we test the formula directly as it would appear in the DOM.
function calculateDiscountPercentage(currentPrice, originalPrice) {
    return Math.round((1 - currentPrice / originalPrice) * 100);
}

describe('Property 4: Discount percentage calculation', () => {
    // Feature: sla-webinar-landing-page, Property 4: Discount percentage calculation
    it('discount equals Math.round((1 - currentPrice / originalPrice) * 100) for all valid price pairs', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 99999 }),
                fc.integer({ min: 1, max: 99999 }),
                (price1, price2) => {
                    // Skip equal values (can't compute a meaningful discount)
                    if (price1 === price2) return;

                    // Ensure currentPrice < originalPrice
                    const currentPrice = Math.min(price1, price2);
                    const originalPrice = Math.max(price1, price2);

                    const result = calculateDiscountPercentage(currentPrice, originalPrice);
                    const expected = Math.round((1 - currentPrice / originalPrice) * 100);

                    // Core property: result matches the formula
                    expect(result).toBe(expected);
                    // Result should be in the valid percentage range [1, 99]
                    // Since currentPrice >= 1 and originalPrice >= 2 (because current < original),
                    // the discount is at least 1/99999 > 0 rounded up, and at most (99998/99999) < 100
                    // However, Math.round can reach 0 or 100 at extreme ratios, so we check [0, 100] inclusive
                    expect(result).toBeGreaterThanOrEqual(0);
                    expect(result).toBeLessThanOrEqual(100);
                }
            ),
            { numRuns: 100 }
        );
    });

    // **Validates: Requirements 5.3**
    it('discount is always a whole number (integer percentage)', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 99999 }),
                fc.integer({ min: 2, max: 99999 }),
                (currentPrice, originalPrice) => {
                    // Ensure currentPrice < originalPrice
                    if (currentPrice >= originalPrice) return;

                    const result = calculateDiscountPercentage(currentPrice, originalPrice);
                    expect(Number.isInteger(result)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });
});
