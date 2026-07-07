/**
 * Property-based tests for FAQ accordion behavior.
 * Tests Properties 5 and 6 from the design document.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Sets up a FAQ DOM structure with the given number of items.
 * Mirrors the HTML structure used in index.html.
 */
function setupFAQDOM(numItems) {
    let html = '<div class="faq-accordion">';
    for (let i = 0; i < numItems; i++) {
        html += `
            <div class="faq-item">
                <div class="faq-question" role="button" aria-expanded="false" tabindex="0">
                    <span>Question ${i + 1}</span>
                    <i class="fas fa-chevron-down faq-chevron"></i>
                </div>
                <div class="faq-answer"><p>Answer ${i + 1}</p></div>
            </div>
        `;
    }
    html += '</div>';
    document.body.innerHTML = html;
}

// Load script.js to get the SLA namespace with pure functions
beforeEach(() => {
    delete window.SLA;
    const scriptPath = resolve(__dirname, '../../script.js');
    const scriptContent = readFileSync(scriptPath, 'utf-8');
    eval(scriptContent);
});

// Feature: sla-webinar-landing-page, Property 5: FAQ toggle behavior
describe('Property 5: FAQ toggle behavior', () => {
    /**
     * Validates: Requirements 6.2, 6.3
     *
     * For any FAQ item, clicking it when collapsed SHALL expand it,
     * and clicking it again when expanded SHALL collapse it.
     * The state alternates on each click — the operation is its own inverse.
     */

    it('clicking toggles state: collapsed→expanded, expanded→collapsed', () => {
        const numItems = 5;
        setupFAQDOM(numItems);
        window.SLA.initFAQ();

        fc.assert(
            fc.property(
                fc.nat({ max: numItems - 1 }),
                (index) => {
                    const questions = document.querySelectorAll('.faq-question');
                    const question = questions[index];
                    const parentItem = question.closest('.faq-item');

                    // Ensure collapsed state first by collapsing all
                    document.querySelectorAll('.faq-item.active').forEach(item => {
                        item.classList.remove('active');
                        item.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
                    });

                    // Verify starting state is collapsed
                    expect(parentItem.classList.contains('active')).toBe(false);
                    expect(question.getAttribute('aria-expanded')).toBe('false');

                    // Click 1: should expand
                    window.SLA.toggleFAQ(question);
                    expect(parentItem.classList.contains('active')).toBe(true);
                    expect(question.getAttribute('aria-expanded')).toBe('true');

                    // Click 2: should collapse (own inverse)
                    window.SLA.toggleFAQ(question);
                    expect(parentItem.classList.contains('active')).toBe(false);
                    expect(question.getAttribute('aria-expanded')).toBe('false');
                }
            ),
            { numRuns: 100 }
        );
    });
});

// Feature: sla-webinar-landing-page, Property 6: FAQ single-open invariant
describe('Property 6: FAQ single-open invariant', () => {
    /**
     * Validates: Requirements 6.4
     *
     * For any two distinct FAQ items A and B, if A is currently expanded
     * and the user expands B, then A SHALL be collapsed and only B SHALL
     * be expanded. At no point SHALL more than one FAQ answer be visible
     * simultaneously.
     */

    it('expanding B collapses A; at most 1 expanded at any time', () => {
        const numItems = 6;
        setupFAQDOM(numItems);
        window.SLA.initFAQ();

        fc.assert(
            fc.property(
                fc.nat({ max: numItems - 1 }),
                fc.nat({ max: numItems - 1 }),
                (indexA, indexB) => {
                    // Skip same item — property only applies to distinct pairs
                    fc.pre(indexA !== indexB);

                    const questions = document.querySelectorAll('.faq-question');
                    const questionA = questions[indexA];
                    const questionB = questions[indexB];
                    const parentA = questionA.closest('.faq-item');
                    const parentB = questionB.closest('.faq-item');

                    // Reset state: collapse all
                    document.querySelectorAll('.faq-item.active').forEach(item => {
                        item.classList.remove('active');
                        item.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
                    });

                    // Expand A
                    window.SLA.toggleFAQ(questionA);
                    expect(parentA.classList.contains('active')).toBe(true);
                    expect(questionA.getAttribute('aria-expanded')).toBe('true');

                    // Expand B — A should collapse
                    window.SLA.toggleFAQ(questionB);
                    expect(parentB.classList.contains('active')).toBe(true);
                    expect(questionB.getAttribute('aria-expanded')).toBe('true');
                    expect(parentA.classList.contains('active')).toBe(false);
                    expect(questionA.getAttribute('aria-expanded')).toBe('false');

                    // At most 1 expanded at any time
                    const activeItems = document.querySelectorAll('.faq-item.active');
                    expect(activeItems.length).toBeLessThanOrEqual(1);
                }
            ),
            { numRuns: 100 }
        );
    });
});
