/**
 * Super Learner Academy — Landing Page Script
 * Pure vanilla JS, no frameworks, no build tools.
 * All dynamic content sourced from data.json.
 */

(function () {
    'use strict';

    // ========================
    // HELPER: Resolve nested object path
    // ========================

    /**
     * Traverses an object by a dot-separated path string.
     * e.g., getNestedValue(data, "registration.buttonText") → data.registration.buttonText
     */
    function getNestedValue(obj, path) {
        return path.split('.').reduce(function (current, key) {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    // ========================
    // DATA LOADING
    // ========================

    /**
     * Fetches data.json, parses it, and injects content into the DOM.
     * Returns the parsed data object on success, or undefined on failure.
     */
    async function loadData() {
        try {
            var response = await fetch('data.json?v=' + Date.now());
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }
            var data = await response.json();
            injectContent(data);
            return data;
        } catch (error) {
            console.error('[SLA] Failed to load data.json:', error.message);
            hideDynamicElements();
            return undefined;
        }
    }

    // ========================
    // DOM INJECTION
    // ========================

    /**
     * Injects dynamic content from data into DOM placeholders.
     * - Elements with [data-bind] get their textContent set.
     * - Elements with [data-bind-href] get their href set.
     * - CTA links with empty/invalid hrefs get click prevention.
     */
    function injectContent(data) {
        // Inject text content
        var textElements = document.querySelectorAll('[data-bind]');
        textElements.forEach(function (element) {
            var path = element.getAttribute('data-bind');
            var value = getNestedValue(data, path);
            if (value !== undefined) {
                element.textContent = value;
            }
        });

        // Inject href attributes
        var hrefElements = document.querySelectorAll('[data-bind-href]');
        hrefElements.forEach(function (element) {
            var path = element.getAttribute('data-bind-href');
            var value = getNestedValue(data, path);
            if (value !== undefined) {
                element.href = value;
            }
        });

        // CTA link handling (Requirement 4.5):
        // If href is empty or not a valid URL, prevent navigation on click
        handleInvalidCTALinks();
    }

    /**
     * Checks all CTA buttons with data-bind-href.
     * If the resolved href is empty or not a valid URL, prevents navigation.
     */
    function handleInvalidCTALinks() {
        var ctaLinks = document.querySelectorAll('[data-bind-href]');
        ctaLinks.forEach(function (element) {
            var href = element.href || '';
            if (!isValidURL(href)) {
                element.addEventListener('click', function (e) {
                    e.preventDefault();
                });
            }
        });
    }

    /**
     * Checks if a string is a valid URL.
     */
    function isValidURL(str) {
        if (!str || str === '#' || str.trim() === '') {
            return false;
        }
        try {
            var url = new URL(str);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (e) {
            return false;
        }
    }

    // ========================
    // FALLBACK: Hide dynamic-only elements
    // ========================

    /**
     * Hides all elements marked with [data-dynamic-only] attribute.
     * These are elements that only make sense with dynamic data loaded.
     */
    function hideDynamicElements() {
        var dynamicElements = document.querySelectorAll('[data-dynamic-only]');
        dynamicElements.forEach(function (element) {
            element.style.display = 'none';
        });
    }

    // ========================
    // COUNTDOWN TIMER
    // ========================

    var countdownIntervalId = null;
    var countdownEndDate = null;
    var countdownData = null;

    /**
     * Calculates time remaining between now and the end date.
     * Returns { days, hours, minutes, seconds } or null if expired.
     */
    function calculateTimeRemaining(endDate) {
        var now = new Date().getTime();
        var end = new Date(endDate).getTime();

        // Check for invalid date
        if (isNaN(end)) {
            return null;
        }

        var diff = end - now;

        if (diff <= 0) {
            return null;
        }

        return {
            days: Math.floor(diff / 86400000),
            hours: Math.floor((diff % 86400000) / 3600000),
            minutes: Math.floor((diff % 3600000) / 60000),
            seconds: Math.floor((diff % 60000) / 1000)
        };
    }

    /**
     * Updates the countdown display DOM elements.
     * Pads numbers with leading zeros (2 digits minimum).
     * Shows expired message if time has run out.
     */
    function updateCountdownDisplay() {
        var remaining = calculateTimeRemaining(countdownEndDate);

        if (remaining === null) {
            showExpiredMessage();
            return;
        }

        var daysEl = document.getElementById('countdown-days');
        var hoursEl = document.getElementById('countdown-hours');
        var minutesEl = document.getElementById('countdown-minutes');
        var secondsEl = document.getElementById('countdown-seconds');

        if (daysEl) daysEl.textContent = String(remaining.days).padStart(2, '0');
        if (hoursEl) hoursEl.textContent = String(remaining.hours).padStart(2, '0');
        if (minutesEl) minutesEl.textContent = String(remaining.minutes).padStart(2, '0');
        if (secondsEl) secondsEl.textContent = String(remaining.seconds).padStart(2, '0');
    }

    /**
     * Shows the expired message and hides the countdown timer boxes.
     * Clears the interval to stop further updates.
     */
    function showExpiredMessage() {
        if (countdownIntervalId !== null) {
            clearInterval(countdownIntervalId);
            countdownIntervalId = null;
        }

        var timerEl = document.getElementById('countdown-timer');
        var expiredEl = document.getElementById('countdown-expired');

        if (timerEl) {
            timerEl.style.display = 'none';
        }

        if (expiredEl) {
            expiredEl.style.display = 'block';
            if (countdownData && countdownData.countdown && countdownData.countdown.expiredMessage) {
                expiredEl.textContent = countdownData.countdown.expiredMessage;
            } else {
                expiredEl.textContent = 'Registration Closed!';
            }
        }
    }

    /**
     * Initializes the countdown timer.
     * - Reads endDate and timezone from data.countdown
     * - Syncs with localStorage (Data_Store takes precedence if different)
     * - Starts the 1-second interval to update the display
     * - Handles edge cases: past dates, invalid dates, corrupted localStorage
     */
    function initCountdown(data) {
        countdownData = data;

        var endDateFromData = null;

        try {
            endDateFromData = data && data.countdown && data.countdown.endDate ? data.countdown.endDate : null;
        } catch (e) {
            console.error('[SLA] Error reading countdown data:', e.message);
            showExpiredMessage();
            return;
        }

        if (!endDateFromData) {
            console.error('[SLA] No countdown end date provided in data.json');
            showExpiredMessage();
            return;
        }

        // Validate the date string
        var parsedDate = new Date(endDateFromData);
        if (isNaN(parsedDate.getTime())) {
            console.error('[SLA] Invalid countdown end date:', endDateFromData);
            showExpiredMessage();
            return;
        }

        // localStorage sync: Data_Store takes precedence if different
        var localStorageKey = 'sla_countdown_endDate';
        var storedEndDate = null;

        try {
            storedEndDate = localStorage.getItem(localStorageKey);
        } catch (e) {
            // Corrupted localStorage: ignore, use Data_Store value
            console.warn('[SLA] Could not read localStorage:', e.message);
        }

        if (storedEndDate !== endDateFromData) {
            // Data_Store differs from localStorage — prefer Data_Store and update localStorage
            try {
                localStorage.setItem(localStorageKey, endDateFromData);
            } catch (e) {
                console.warn('[SLA] Could not write to localStorage:', e.message);
            }
        }

        // Use the Data_Store end date as active end date
        countdownEndDate = endDateFromData;

        // Check if already expired before starting the interval
        var remaining = calculateTimeRemaining(countdownEndDate);
        if (remaining === null) {
            showExpiredMessage();
            return;
        }

        // Update display immediately
        updateCountdownDisplay();

        // Start the 1-second interval
        countdownIntervalId = setInterval(updateCountdownDisplay, 1000);
    }

    function initFAQ() {
        var questions = document.querySelectorAll('.faq-question');

        questions.forEach(function (question) {
            question.addEventListener('click', function () {
                toggleFAQ(question);
            });

            question.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleFAQ(question);
                }
            });
        });
    }

    /**
     * Toggles a FAQ item open/closed with single-open behavior.
     * If the item is already active, it collapses. Otherwise, collapses all others and expands this one.
     * @param {Element} question - The .faq-question element to toggle.
     */
    function toggleFAQ(question) {
        var parentItem = question.closest('.faq-item');
        if (!parentItem) return;

        var isActive = parentItem.classList.contains('active');

        if (isActive) {
            // Collapse the clicked item
            parentItem.classList.remove('active');
            question.setAttribute('aria-expanded', 'false');
        } else {
            // Collapse all currently active items
            var activeItems = document.querySelectorAll('.faq-item.active');
            activeItems.forEach(function (item) {
                item.classList.remove('active');
                var activeQuestion = item.querySelector('.faq-question');
                if (activeQuestion) {
                    activeQuestion.setAttribute('aria-expanded', 'false');
                }
            });

            // Expand the clicked item
            parentItem.classList.add('active');
            question.setAttribute('aria-expanded', 'true');
        }
    }

    function initStickyCTA() {
        var stickyCTA = document.querySelector('.sticky-cta');
        var scrollToTopBtn = document.getElementById('scroll-to-top');

        if (!stickyCTA && !scrollToTopBtn) return;

        var ticking = false;

        function onScroll() {
            if (!ticking) {
                window.requestAnimationFrame(function () {
                    var visible = getStickyVisibility(window.scrollY);
                    if (stickyCTA) {
                        if (visible) {
                            stickyCTA.classList.add('visible');
                        } else {
                            stickyCTA.classList.remove('visible');
                        }
                    }
                    if (scrollToTopBtn) {
                        if (visible) {
                            scrollToTopBtn.classList.add('visible');
                        } else {
                            scrollToTopBtn.classList.remove('visible');
                        }
                    }
                    ticking = false;
                });
                ticking = true;
            }
        }

        window.addEventListener('scroll', onScroll);

        // Scroll-to-top click handler
        if (scrollToTopBtn) {
            scrollToTopBtn.addEventListener('click', function () {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
    }

    /**
     * Pure function: determines sticky CTA / scroll-to-top visibility
     * based on a given scroll position.
     * @param {number} scrollY - the current scroll position
     * @returns {boolean} true if elements should be visible
     */
    function getStickyVisibility(scrollY) {
        return scrollY > 700;
    }

    function initScrollAnimations() {
        var revealElements = document.querySelectorAll('.scroll-reveal');

        // Reduced motion check: skip animations entirely
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            revealElements.forEach(function (el) {
                el.classList.add('visible');
            });
            return;
        }

        // IntersectionObserver setup with 20% threshold
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.2 });

        // Stagger grid items: apply incremental transition delays
        var gridSelectors = ['.challenges-grid', '.included-grid', '.testimonials-grid', '.curriculum-grid'];
        gridSelectors.forEach(function (selector) {
            var grid = document.querySelector(selector);
            if (grid) {
                var items = grid.querySelectorAll('.scroll-reveal');
                items.forEach(function (item, index) {
                    item.style.transitionDelay = (index * 100) + 'ms';
                });
            }
        });

        // Observe all scroll-reveal elements
        revealElements.forEach(function (el) {
            observer.observe(el);
        });
    }

    function initAnalytics(data) {
        if (data.analytics && data.analytics.gtmId) {
            injectGTM(data.analytics.gtmId);
        }
        if (data.analytics && data.analytics.fbPixel) {
            injectFBPixel(data.analytics.fbPixel);
        }
    }

    /**
     * Injects the standard Google Tag Manager snippet into <head>.
     * @param {string} gtmId - The GTM container ID (e.g., "GTM-XXXXXXX")
     */
    function injectGTM(gtmId) {
        (function (w, d, s, l, i) {
            w[l] = w[l] || []; w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
            var f = d.getElementsByTagName(s)[0],
                j = d.createElement(s), dl = l != 'dataLayer' ? '&l=' + l : '';
            j.async = true; j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
            f.parentNode.insertBefore(j, f);
        })(window, document, 'script', 'dataLayer', gtmId);
    }

    /**
     * Injects the standard Facebook Pixel snippet into <head>.
     * @param {string} pixelId - The FB Pixel ID
     */
    function injectFBPixel(pixelId) {
        !function (f, b, e, v, n, t, s) {
            if (f.fbq) return; n = f.fbq = function () {
                n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
            }; if (!f._fbq) f._fbq = n;
            n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
            t = b.createElement(e); t.async = !0; t.src = v;
            s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
        }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', pixelId);
        fbq('track', 'PageView');
    }

    // ========================
    // THANK-YOU PAGE: CONFETTI
    // ========================

    /**
     * Generates and animates confetti pieces inside #confetti-container.
     * Creates 100 random div elements with brand colors, animates them falling,
     * then cleans up after 5 seconds.
     */
    function playConfetti() {
        var container = document.getElementById('confetti-container');
        if (!container) return;

        var colors = ['#FF6B00', '#FFC107', '#34A853', '#1E5EFF', '#ff5e3a'];
        var pieces = [];

        for (var i = 0; i < 100; i++) {
            var piece = document.createElement('div');
            piece.className = 'confetti-piece';

            var size = Math.random() * 7 + 8; // 8–15px
            var left = Math.random() * 100; // 0–100%
            var color = colors[Math.floor(Math.random() * colors.length)];
            var delay = Math.random() * 2; // 0–2s
            var duration = Math.random() * 1.5 + 2.5; // 2.5–4s
            var borderRadius = Math.random() > 0.5 ? '50%' : '0';

            piece.style.position = 'absolute';
            piece.style.left = left + '%';
            piece.style.top = '-10px';
            piece.style.background = color;
            piece.style.width = size + 'px';
            piece.style.height = size + 'px';
            piece.style.borderRadius = borderRadius;
            piece.style.animationDelay = delay + 's';
            piece.style.animationDuration = duration + 's';

            container.appendChild(piece);
            pieces.push(piece);
        }

        // Cleanup after 5 seconds
        setTimeout(function () {
            pieces.forEach(function (piece) {
                if (piece.parentNode) {
                    piece.parentNode.removeChild(piece);
                }
            });
        }, 5000);
    }

    // ========================
    // THANK-YOU PAGE: DATE FORMATTING
    // ========================

    /**
     * Formats an ISO datetime string to a human-readable format in Asia/Kolkata timezone.
     * Example output: "21 July 2026, 7:00 PM IST"
     * @param {string} isoString - ISO 8601 datetime string
     * @returns {string} Formatted date string
     */
    function formatWorkshopDate(isoString) {
        var date = new Date(isoString);

        var formatted = new Intl.DateTimeFormat('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata'
        }).format(date);

        return formatted + ' IST';
    }

    // ========================
    // THANK-YOU PAGE: INITIALIZATION
    // ========================

    /**
     * Initializes Thank-You page specific functionality:
     * - Formats and injects workshop date
     * - Handles WhatsApp button visibility
     * - Starts auto-redirect progress bar
     * @param {Object} data - The parsed data.json object
     */
    function initThankYouPage(data) {
        var paidView = document.getElementById('thankyou-paid');
        var unpaidView = document.getElementById('thankyou-unpaid');

        // Always show paid view (no gate)
        if (paidView) paidView.style.display = '';
        if (unpaidView) unpaidView.style.display = 'none';

        // Format and inject workshop date
        if (data.workshop && data.workshop.startDate) {
            var formattedDate = formatWorkshopDate(data.workshop.startDate);
            var dateEl = document.getElementById('workshop-date');
            var detailDateEl = document.getElementById('workshop-detail-date');

            if (dateEl) dateEl.textContent = formattedDate;
            if (detailDateEl) detailDateEl.textContent = formattedDate;
        }

        // Handle WhatsApp button visibility and auto-redirect
        var whatsappBtn = document.getElementById('whatsapp-btn');
        var whatsappLink = data.whatsapp && data.whatsapp.link ? data.whatsapp.link : '';

        if (whatsappBtn) {
            if (!whatsappLink || whatsappLink.trim() === '') {
                whatsappBtn.style.display = 'none';
            } else {
                whatsappBtn.style.display = '';
                whatsappBtn.href = whatsappLink;
            }
        }

        // Start auto-redirect progress bar
        if (whatsappLink && whatsappLink.trim() !== '') {
            startRedirectProgress(whatsappLink);
        }
    }

    /**
     * Animates the progress bar and auto-redirects to WhatsApp after completion.
     * Uses window.location.href (same tab) to avoid popup blockers on iOS/mobile.
     * If redirect fails, highlights the manual button.
     * @param {string} url - The WhatsApp group URL to redirect to
     */
    function startRedirectProgress(url) {
        var progressFill = document.getElementById('progress-bar-fill');
        var percentText = document.getElementById('redirect-percent');
        if (!progressFill || !percentText) return;

        var progress = 0;
        var duration = 4000; // 4 seconds total
        var interval = 50; // update every 50ms
        var increment = 100 / (duration / interval);

        var timer = setInterval(function () {
            progress += increment;
            if (progress >= 100) {
                progress = 100;
                clearInterval(timer);

                progressFill.style.width = '100%';
                percentText.textContent = '100%';

                // Use location.href for same-tab redirect (works on iOS/mobile without popup block)
                window.location.href = url;
            }
            progressFill.style.width = Math.round(progress) + '%';
            percentText.textContent = Math.round(progress) + '%';
        }, interval);
    }

    function initCoachImageFallback() {
        var coachImages = document.querySelectorAll('.coach-img');

        coachImages.forEach(function (img) {
            // Attach JS-based onerror handler as backup for inline onerror
            img.addEventListener('error', function () {
                var fallbackEl = img.nextElementSibling;
                if (fallbackEl && fallbackEl.classList.contains('coach-fallback')) {
                    img.style.display = 'none';
                    fallbackEl.style.display = 'flex';
                }
            });

            // Handle images that already failed before JS ran (cached failures)
            if (img.complete && img.naturalWidth === 0) {
                var fallbackEl = img.nextElementSibling;
                if (fallbackEl && fallbackEl.classList.contains('coach-fallback')) {
                    img.style.display = 'none';
                    fallbackEl.style.display = 'flex';
                }
            }
        });
    }

    // ========================
    // QUOTES SLIDER
    // ========================

    var quotesData = [];
    var currentQuoteIndex = 0;
    var quotesIntervalId = null;

    /**
     * Loads quotes.json and initializes the auto-sliding quotes.
     */
    async function initQuotesSlider() {
        try {
            var response = await fetch('quotes.json?v=' + Date.now());
            if (!response.ok) return;
            quotesData = await response.json();
            if (quotesData.length === 0) return;

            // Shuffle quotes for variety
            quotesData = quotesData.sort(function () { return Math.random() - 0.5; });

            // Show first quote immediately
            showQuote(0);

            // Auto-slide every 5 seconds
            quotesIntervalId = setInterval(nextQuote, 5000);
        } catch (e) {
            // Silently fail — quotes are non-critical
            console.warn('[SLA] Could not load quotes.json');
        }
    }

    function showQuote(index) {
        var quoteTextEl = document.getElementById('quote-text');
        var quoteAuthorEl = document.getElementById('quote-author');
        if (!quoteTextEl || !quoteAuthorEl || quotesData.length === 0) return;

        var quote = quotesData[index];
        quoteTextEl.textContent = '"' + quote.text + '"';
        quoteAuthorEl.textContent = '— ' + quote.author;
    }

    function nextQuote() {
        var quoteTextEl = document.getElementById('quote-text');
        if (!quoteTextEl) return;

        // Fade out
        quoteTextEl.classList.add('fade-out');
        quoteTextEl.classList.remove('fade-in');

        setTimeout(function () {
            currentQuoteIndex = (currentQuoteIndex + 1) % quotesData.length;
            showQuote(currentQuoteIndex);

            // Fade in
            quoteTextEl.classList.remove('fade-out');
            quoteTextEl.classList.add('fade-in');
        }, 500);
    }

    // ========================
    // INITIALIZATION
    // ========================

    document.addEventListener('DOMContentLoaded', async function () {
        var isThankYouPage = document.body.getAttribute('data-page') === 'thank-you';
        var data = await loadData();

        if (data) {
            if (isThankYouPage) {
                playConfetti();
                initThankYouPage(data);
                initAnalytics(data);
            } else {
                initCountdown(data);
                initFAQ();
                initStickyCTA();
                initScrollAnimations();
                initAnalytics(data);
                initCoachImageFallback();
                initQuotesSlider();
            }
        }
    });

    // ========================
    // EXPOSE FOR TESTING
    // ========================

    /**
     * Pure function: returns the stagger delay for a grid item at the given index.
     * Formula: index * 100 (milliseconds).
     * @param {number} index - The 0-based index of the grid item
     * @returns {number} Delay in milliseconds
     */
    function getStaggerDelay(index) {
        return index * 100;
    }

    window.SLA = {
        loadData: loadData,
        injectContent: injectContent,
        hideDynamicElements: hideDynamicElements,
        getNestedValue: getNestedValue,
        isValidURL: isValidURL,
        handleInvalidCTALinks: handleInvalidCTALinks,
        initCountdown: initCountdown,
        calculateTimeRemaining: calculateTimeRemaining,
        initFAQ: initFAQ,
        toggleFAQ: toggleFAQ,
        initStickyCTA: initStickyCTA,
        getStickyVisibility: getStickyVisibility,
        initScrollAnimations: initScrollAnimations,
        initAnalytics: initAnalytics,
        injectGTM: injectGTM,
        injectFBPixel: injectFBPixel,
        initCoachImageFallback: initCoachImageFallback,
        getStaggerDelay: getStaggerDelay,
        playConfetti: playConfetti,
        formatWorkshopDate: formatWorkshopDate,
        initThankYouPage: initThankYouPage
    };

})();
