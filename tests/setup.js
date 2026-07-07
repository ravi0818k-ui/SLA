/**
 * Test setup file for SLA Webinar Landing Page tests.
 * Configures jsdom environment and provides test utilities.
 */

import { beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Helper: Load HTML file content
export function loadHTML(filename) {
    const filePath = resolve(__dirname, '..', filename);
    return readFileSync(filePath, 'utf-8');
}

// Helper: Load and inject HTML into jsdom
export function setupDOM(filename) {
    const html = loadHTML(filename);
    document.documentElement.innerHTML = html;
}

// Helper: Load script.js and execute it
export function loadScript() {
    const scriptPath = resolve(__dirname, '..', 'script.js');
    const scriptContent = readFileSync(scriptPath, 'utf-8');
    const scriptEl = document.createElement('script');
    scriptEl.textContent = scriptContent;
    document.body.appendChild(scriptEl);
}

// Helper: Create mock data matching data.json schema
export function createMockData(overrides = {}) {
    return {
        countdown: {
            endDate: "2026-07-20T23:59:59",
            timezone: "Asia/Kolkata",
            expiredMessage: "Registration Closed!",
            ...overrides.countdown
        },
        registration: {
            price: "455",
            originalPrice: "4999",
            currency: "₹",
            link: "https://pages.razorpay.com/pl_XXXX/view",
            buttonText: "REGISTER NOW FOR ₹455/- ONLY",
            ...overrides.registration
        },
        workshop: {
            name: "Super Learner Academy - 2 Day Live Webinar",
            coach: "Abhishek Ranjan",
            days: 2,
            startDate: "2026-07-21T19:00:00",
            ...overrides.workshop
        },
        whatsapp: {
            link: "https://chat.whatsapp.com/XXXX",
            buttonText: "Join WhatsApp Group",
            ...overrides.whatsapp
        },
        analytics: {
            gtmId: "",
            fbPixel: "",
            ...overrides.analytics
        }
    };
}

// Reset DOM between tests
beforeEach(() => {
    document.documentElement.innerHTML = '<html><head></head><body></body></html>';
    localStorage.clear();
});

afterEach(() => {
    // Clean up any intervals/timeouts
    // Note: vitest/jsdom handles this via fake timers when needed
});
