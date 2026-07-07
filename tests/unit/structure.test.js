/**
 * Unit tests for structural requirements of SLA Webinar Landing Page.
 * Validates DOM structure against requirements 4.1, 16.1, 13.5, 12.4, 14.4.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Helper to load HTML files
function loadHTML(filename) {
    const filePath = resolve(__dirname, '..', '..', filename);
    return readFileSync(filePath, 'utf-8');
}

describe('Landing Page Structural Requirements', () => {
    beforeEach(() => {
        const html = loadHTML('index.html');
        document.documentElement.innerHTML = html;
    });

    it('should have at least 4 CTA buttons with class .cta-button (Requirement 4.1)', () => {
        const ctaButtons = document.querySelectorAll('.cta-button');
        expect(ctaButtons.length).toBeGreaterThanOrEqual(4);
    });

    it('should have exactly 2 day-cards in the curriculum section (Requirement 16.1)', () => {
        const dayCards = document.querySelectorAll('.day-card');
        expect(dayCards.length).toBe(2);
    });

    it('should have coach image with correct alt text (Requirement 12.4)', () => {
        const coachImages = document.querySelectorAll('img.coach-img');
        const expectedAlt = 'Abhishek Ranjan - Super Learner Academy Coach';

        expect(coachImages.length).toBeGreaterThanOrEqual(1);

        coachImages.forEach((img) => {
            expect(img.getAttribute('alt')).toBe(expectedAlt);
        });
    });
});

describe('Thank-You Page Structural Requirements', () => {
    beforeEach(() => {
        const html = loadHTML('thank-you.html');
        document.documentElement.innerHTML = html;
    });

    it('should have exactly 3 next-steps cards (Requirement 13.5)', () => {
        const nextStepCards = document.querySelectorAll('.next-step-card');
        expect(nextStepCards.length).toBe(3);
    });

    it('should hide WhatsApp button when link is empty (Requirement 14.4)', () => {
        // The WhatsApp button has data-dynamic-only attribute indicating
        // it should be hidden when its data source is empty
        const whatsappBtn = document.getElementById('whatsapp-btn');
        expect(whatsappBtn).not.toBeNull();
        expect(whatsappBtn.hasAttribute('data-dynamic-only')).toBe(true);

        // Simulate initThankYouPage behavior with empty whatsapp link
        // Load script.js to get access to SLA namespace
        const scriptPath = resolve(__dirname, '..', '..', 'script.js');
        const scriptContent = readFileSync(scriptPath, 'utf-8');
        eval(scriptContent);

        // Call initThankYouPage with empty whatsapp link
        window.SLA.initThankYouPage({
            workshop: { startDate: '2026-07-21T19:00:00' },
            whatsapp: { link: '', buttonText: 'Join WhatsApp Group' }
        });

        expect(whatsappBtn.style.display).toBe('none');
    });
});
