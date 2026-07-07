/**
 * Unit tests for FAQ keyboard accessibility
 * Validates: Requirement 6.5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Sets up the FAQ DOM and initializes the FAQ component.
 */
function setupFAQDOM() {
    const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf-8');
    document.documentElement.innerHTML = html;

    // Load and execute script.js using eval so it registers window.SLA
    const scriptContent = readFileSync(resolve(__dirname, '../../script.js'), 'utf-8');

    // Mock fetch since script.js calls loadData on DOMContentLoaded
    global.fetch = () => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
            countdown: { endDate: '2099-12-31T23:59:59', timezone: 'Asia/Kolkata', expiredMessage: 'Closed!' },
            registration: { price: '455', originalPrice: '4999', currency: '₹', link: 'https://example.com', buttonText: 'Register' },
            workshop: { name: 'Test', coach: 'Test', days: 2, startDate: '2099-07-21T19:00:00' },
            whatsapp: { link: 'https://chat.whatsapp.com/test', buttonText: 'Join' },
            analytics: { gtmId: '', fbPixel: '' }
        })
    });

    // Execute the script in current context to register window.SLA
    const fn = new Function(scriptContent);
    fn();

    // Manually initialize FAQ (since DOMContentLoaded already fired in test env)
    window.SLA.initFAQ();
}

describe('FAQ Keyboard Accessibility (Requirement 6.5)', () => {
    beforeEach(() => {
        setupFAQDOM();
    });

    it('Enter key toggles FAQ item open', () => {
        const questions = document.querySelectorAll('.faq-question');
        expect(questions.length).toBeGreaterThan(0);

        const firstQuestion = questions[0];
        const firstItem = firstQuestion.closest('.faq-item');

        // Initially collapsed
        expect(firstItem.classList.contains('active')).toBe(false);

        // Dispatch Enter keydown
        const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            bubbles: true,
            cancelable: true
        });
        firstQuestion.dispatchEvent(enterEvent);

        // Should now be expanded
        expect(firstItem.classList.contains('active')).toBe(true);
        expect(firstQuestion.getAttribute('aria-expanded')).toBe('true');
    });

    it('Enter key toggles FAQ item closed when already open', () => {
        const questions = document.querySelectorAll('.faq-question');
        const firstQuestion = questions[0];
        const firstItem = firstQuestion.closest('.faq-item');

        // Open it first
        const enterOpen = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        firstQuestion.dispatchEvent(enterOpen);
        expect(firstItem.classList.contains('active')).toBe(true);

        // Press Enter again to close
        const enterClose = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        firstQuestion.dispatchEvent(enterClose);
        expect(firstItem.classList.contains('active')).toBe(false);
        expect(firstQuestion.getAttribute('aria-expanded')).toBe('false');
    });

    it('Space key toggles FAQ item open', () => {
        const questions = document.querySelectorAll('.faq-question');
        expect(questions.length).toBeGreaterThan(0);

        const secondQuestion = questions[1];
        const secondItem = secondQuestion.closest('.faq-item');

        // Initially collapsed
        expect(secondItem.classList.contains('active')).toBe(false);

        // Dispatch Space keydown
        const spaceEvent = new KeyboardEvent('keydown', {
            key: ' ',
            bubbles: true,
            cancelable: true
        });
        secondQuestion.dispatchEvent(spaceEvent);

        // Should now be expanded
        expect(secondItem.classList.contains('active')).toBe(true);
        expect(secondQuestion.getAttribute('aria-expanded')).toBe('true');
    });

    it('Space key toggles FAQ item closed when already open', () => {
        const questions = document.querySelectorAll('.faq-question');
        const secondQuestion = questions[1];
        const secondItem = secondQuestion.closest('.faq-item');

        // Open with space
        const spaceOpen = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
        secondQuestion.dispatchEvent(spaceOpen);
        expect(secondItem.classList.contains('active')).toBe(true);

        // Close with space
        const spaceClose = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
        secondQuestion.dispatchEvent(spaceClose);
        expect(secondItem.classList.contains('active')).toBe(false);
        expect(secondQuestion.getAttribute('aria-expanded')).toBe('false');
    });

    it('all FAQ items have role="button" attribute', () => {
        const questions = document.querySelectorAll('.faq-question');
        expect(questions.length).toBeGreaterThan(0);

        questions.forEach((question) => {
            expect(question.getAttribute('role')).toBe('button');
        });
    });

    it('all FAQ items have aria-expanded="false" initially', () => {
        const questions = document.querySelectorAll('.faq-question');
        expect(questions.length).toBeGreaterThan(0);

        questions.forEach((question) => {
            expect(question.getAttribute('aria-expanded')).toBe('false');
        });
    });

    it('all FAQ items have tabindex="0" attribute', () => {
        const questions = document.querySelectorAll('.faq-question');
        expect(questions.length).toBeGreaterThan(0);

        questions.forEach((question) => {
            expect(question.getAttribute('tabindex')).toBe('0');
        });
    });
});
