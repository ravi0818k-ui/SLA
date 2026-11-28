/**
 * Super Learner Academy — Landing Page Script
 * Pure vanilla JS, no frameworks, no build tools.
 * All dynamic content sourced from data.json.
 */

// ========================
// CONTENT PROTECTION
// ========================

// Disable right-click context menu
document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    showProtectionAlert();
});

// Disable keyboard shortcuts for inspect/view-source
document.addEventListener('keydown', function (e) {
    // F12
    if (e.key === 'F12') {
        e.preventDefault();
        showProtectionAlert();
        return false;
    }
    // Ctrl+Shift+I (Inspect)
    if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
        e.preventDefault();
        showProtectionAlert();
        return false;
    }
    // Ctrl+Shift+J (Console)
    if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) {
        e.preventDefault();
        showProtectionAlert();
        return false;
    }
    // Ctrl+U (View Source)
    if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
        e.preventDefault();
        showProtectionAlert();
        return false;
    }
    // Ctrl+S (Save page)
    if (e.ctrlKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        return false;
    }
    // Ctrl+C (Copy) — optional, prevents text copying
    if (e.ctrlKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        showProtectionAlert();
        return false;
    }
});

// Show protection popup
function showProtectionAlert() {
    // Remove existing popup if any
    var existing = document.getElementById('protection-popup');
    if (existing) existing.remove();

    var popup = document.createElement('div');
    popup.id = 'protection-popup';
    popup.innerHTML = '<div class="protection-overlay"></div><div class="protection-modal"><div class="protection-icon"><i class="fas fa-shield-alt"></i></div><h3>Content Protected</h3><p>This content is protected. Copying or inspecting the source code is not permitted.</p><button onclick="this.parentElement.parentElement.remove()">OK, I Understand</button></div>';
    document.body.appendChild(popup);

    // Auto-dismiss after 4 seconds
    setTimeout(function () {
        if (popup.parentNode) popup.remove();
    }, 4000);
}

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

    /**
     * Replaces {{path.to.value}} placeholders in a string with values from data,
     * so copy in data.json (e.g. FAQ answers) can reuse the price/dates defined once.
     * Unknown paths are left as-is. When escape is true (HTML injection), the
     * substituted values are HTML-escaped; the surrounding template is not.
     */
    function fillTemplate(value, data, escape) {
        if (typeof value !== 'string') return value;
        return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, function (match, path) {
            var resolved = getNestedValue(data, path);
            if (resolved === undefined || typeof resolved === 'object') return match;
            resolved = String(resolved);
            return escape ? escapeHTML(resolved) : resolved;
        });
    }

    function escapeHTML(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // ========================
    // DATA LOADING
    // ========================

    /**
     * Path prefix to the site root. Ad landing pages live one folder deep (/ads-1/, /ads-2/ ...)
     * and carry <html data-root="../">, so their JSON fetches still reach the root files.
     */
    /**
     * Cache-friendly version number for data.json / quotes.json: it changes every 5 minutes instead of on
     * every visit. A brand-new number on every page view (Date.now()) made GitHub Pages skip its CDN cache
     * for every visitor (x-cache: MISS, found in the 2026-11-24 k6 load test). With 5-minute steps, most
     * visitors get the cached copy, the head script on index.html and script.js ask for the same URL (so the
     * browser reuses the first download), and a data.json edit still shows within about 10 minutes
     * (GitHub Pages caches files for up to 600 s anyway). The inline head script on index.html /
     * index-classic.html uses the same formula: keep them in step.
     */
    function cacheBucket() {
        return Math.floor(Date.now() / 300000);
    }

    function siteRoot() {
        var r = document.documentElement.getAttribute('data-root');
        return r && /^(\.\.\/)+$/.test(r) ? r : '';
    }

    /**
     * Fetches data.json, parses it, and injects content into the DOM.
     * Returns the parsed data object on success, or undefined on failure.
     */
    async function loadData() {
        try {
            var response = await fetch(siteRoot() + 'data.json?v=' + cacheBucket());
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }
            var data = await response.json();
            applyFreeSignup(data);
            injectContent(data);
            return data;
        } catch (error) {
            console.error('[SLA] Failed to load data.json:', error.message);
            document.documentElement.classList.remove('sla-wait');
            hideDynamicElements();
            return undefined;
        }
    }

    // ========================
    // FREE SIGNUP MODE (data.json -> freeSignup.enabled)
    // ========================

    /** True when data.json switches the site to free registration (no payment). */
    function isFreeSignup(data) {
        return !!(data && data.freeSignup && data.freeSignup.enabled === true);
    }

    /** Sets obj[a][b][c] for the path "a.b.c", creating missing objects on the way. */
    function setNestedValue(obj, path, value) {
        var keys = path.split('.');
        var last = keys.pop();
        var target = keys.reduce(function (current, key) {
            if (!current[key] || typeof current[key] !== 'object') current[key] = {};
            return current[key];
        }, obj);
        target[last] = value;
    }

    /**
     * Free signup mode. When data.json freeSignup.enabled is true:
     * - every registration button points at freeSignup.link instead of registration.link,
     * - each data.json path listed in freeSignup.copy is replaced by its free wording (buttons, promise lines, FAQ),
     * - <html> gets class "sla-free": the inline style in each page's <head> hides [data-paid] blocks
     *   (price, payment, refund) and shows the [data-free] blocks instead.
     * Either way it removes "sla-wait", which kept price text hidden until the mode was known,
     * so visitors never see the paid price flash before the free version.
     */
    function applyFreeSignup(data) {
        var root = document.documentElement;
        var free = isFreeSignup(data);
        if (free) {
            var fs = data.freeSignup;
            var copy = fs.copy || {};
            Object.keys(copy).forEach(function (path) {
                if (path.charAt(0) !== '_') setNestedValue(data, path, copy[path]);
            });
            if (fs.link) setNestedValue(data, 'registration.link', fs.link);
            root.classList.add('sla-free');
        } else {
            root.classList.remove('sla-free');
        }
        root.classList.remove('sla-wait');
        return free;
    }

    /** In free mode, count clicks on registration buttons as a GA4 "sign_up" event (mark it as a key event / import it to Google Ads). */
    function initFreeSignupTracking(data) {
        if (!isFreeSignup(data)) return;
        if (isLeadFormActive(data)) return; // the popup sends sign_up itself, after the form is filled
        document.addEventListener('click', function (e) {
            var a = e.target.closest && e.target.closest('a.cta-button, a[data-bind-href="registration.link"]');
            if (a && typeof window.gtag === 'function') window.gtag('event', 'sign_up', { method: 'free_signup' });
        });
    }

    // ========================
    // FREE REGISTRATION POPUP (data.json -> leadForm, 2026-11-28)
    // ========================

    /**
     * True when Book/Register buttons should open the registration popup (lead-form.js) instead of going straight
     * to the thank-you page: free mode + leadForm.enabled + an endpoint (the Google Sheet web app).
     * ?leadform=1 previews it without an endpoint (nothing is saved); ?leadform=0 turns it off for a test.
     */
    function isLeadFormActive(data, search) {
        if (!isFreeSignup(data)) return false;
        var lf = data.leadForm;
        if (!lf || lf.enabled !== true) return false;
        var q = String(search === undefined ? window.location.search : search);
        if (/[?&]leadform=0(&|$)/.test(q)) return false;
        return !!lf.endpoint || /[?&]leadform=1(&|$)/.test(q);
    }

    var LEAD_FORM_VERSION = '1.2.0';
    var leadFormLoading = null;

    /** Loads lead-form.css + lead-form.js once (only pages that need the popup download it). */
    function loadLeadForm() {
        if (window.SLALeadForm) return Promise.resolve(window.SLALeadForm);
        if (leadFormLoading) return leadFormLoading;
        leadFormLoading = new Promise(function (resolve, reject) {
            var root = siteRoot();
            var css = document.createElement('link');
            css.rel = 'stylesheet';
            css.href = root + 'lead-form.css?v=' + LEAD_FORM_VERSION;
            document.head.appendChild(css);
            var js = document.createElement('script');
            js.src = root + 'lead-form.js?v=' + LEAD_FORM_VERSION;
            js.async = true;
            js.onload = function () { if (window.SLALeadForm) resolve(window.SLALeadForm); else reject(new Error('lead form missing')); };
            js.onerror = function () { leadFormLoading = null; reject(new Error('lead form failed to load')); };
            document.head.appendChild(js);
        });
        return leadFormLoading;
    }

    /** Book buttons open the popup. If the popup can't load, the button works as before (straight to its link). */
    function initLeadForm(data) {
        if (!isLeadFormActive(data)) return false;
        document.addEventListener('click', function (e) {
            if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            var a = e.target.closest && e.target.closest('a.cta-button, a[data-bind-href="registration.link"]');
            if (!a || !a.href) return;
            e.preventDefault();
            var href = a.href;
            loadLeadForm().then(function (lf) { lf.open(href); }).catch(function () { window.location.href = href; });
        });
        var warm = function () { loadLeadForm().catch(function () { /* the click handler falls back */ }); };
        if ('requestIdleCallback' in window) window.requestIdleCallback(warm, { timeout: 3000 });
        else setTimeout(warm, 1500);
        return true;
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
                element.textContent = fillTemplate(value, data, false);
            }
        });

        // Inject HTML content (for copy that needs <strong> etc., e.g. FAQ answers)
        var htmlElements = document.querySelectorAll('[data-bind-html]');
        htmlElements.forEach(function (element) {
            var path = element.getAttribute('data-bind-html');
            var value = getNestedValue(data, path);
            if (value !== undefined) {
                element.innerHTML = fillTemplate(value, data, true);
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

        syncOfferPrice(data);

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

        // Weekly batch: when this Saturday's slot passes, roll to next week's.
        var weekly = countdownData && countdownData.countdown && countdownData.countdown.weekly;
        if (remaining === null && weekly && typeof weekly.day === 'number') {
            countdownEndDate = getNextWeeklyOccurrence(weekly.day, weekly.time);
            remaining = calculateTimeRemaining(countdownEndDate);
        }

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
    /**
     * Returns the next occurrence (strictly after `now`) of a weekly IST slot
     * as an ISO string with a +05:30 offset, e.g. "2026-11-21T19:00:00+05:30".
     * @param {number} day - 0 = Sunday ... 6 = Saturday (IST)
     * @param {string} time - "HH:MM" in IST
     * @param {number} [now] - epoch ms, defaults to Date.now()
     */
    function getNextWeeklyOccurrence(day, time, now) {
        var IST_OFFSET_MS = 330 * 60000;
        var parts = String(time || '00:00').split(':');
        var hh = parseInt(parts[0], 10) || 0;
        var mm = parseInt(parts[1], 10) || 0;
        var nowMs = typeof now === 'number' ? now : Date.now();

        // Shift into IST "wall clock" and read it with UTC getters.
        var ist = new Date(nowMs + IST_OFFSET_MS);
        var target = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), hh, mm, 0);
        target += ((day - ist.getUTCDay() + 7) % 7) * 86400000;
        if (target - IST_OFFSET_MS <= nowMs) target += 7 * 86400000;

        var t = new Date(target);
        function pad(n) { return String(n).padStart(2, '0'); }
        return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate()) +
            'T' + pad(t.getUTCHours()) + ':' + pad(t.getUTCMinutes()) + ':00+05:30';
    }

    /**
     * "Shanivaar, 28 Nov · 7:00 PM IST" (lang 'hi', Hinglish) or "Saturday, 28 Nov · 7:00 PM IST" (lang 'en')
     * from an ISO string with a +05:30 offset (as returned by getNextWeeklyOccurrence).
     * Reads the IST wall-clock parts straight from the string, so the visitor's timezone never shifts the date.
     */
    function formatNextBatch(startIso, lang) {
        var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(startIso || ''));
        if (!m) return '';
        var y = +m[1], mo = +m[2], d = +m[3], h = +m[4], mi = m[5];
        var DAYS = lang === 'en'
            ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
            : ['Ravivaar', 'Somvaar', 'Mangalvaar', 'Budhvaar', 'Guruvaar', 'Shukravaar', 'Shanivaar'];
        var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        var wd = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
        var h12 = h % 12 === 0 ? 12 : h % 12;
        return DAYS[wd] + ', ' + d + ' ' + MONTHS[mo - 1] + ' · ' + h12 + ':' + mi + ' ' + (h < 12 ? 'AM' : 'PM') + ' IST';
    }

    /**
     * Fills every [data-next-batch] element (value 'hi' or 'en') with the next weekly batch start
     * from data.countdown.weekly, and un-hides its [data-next-batch-wrap] container.
     * Static HTML keeps the wrapper hidden, so no wrong date shows without JS.
     * @returns {string|null} the ISO start used, or null when there is no weekly schedule
     */
    function initNextBatch(data, now) {
        var weekly = data && data.countdown && data.countdown.weekly;
        if (!weekly || typeof weekly.day !== 'number') return null;
        var iso = getNextWeeklyOccurrence(weekly.day, weekly.time, now);
        var els = document.querySelectorAll('[data-next-batch]');
        for (var i = 0; i < els.length; i++) {
            els[i].textContent = formatNextBatch(iso, els[i].getAttribute('data-next-batch'));
            var wrap = els[i].closest('[data-next-batch-wrap]');
            if (wrap) wrap.hidden = false;
        }
        return iso;
    }

    function initCountdown(data) {
        countdownData = data;

        var endDateFromData = null;

        try {
            var cd = data && data.countdown;
            if (cd && cd.weekly && typeof cd.weekly.day === 'number') {
                // Recurring weekly batch: always count down to the next slot.
                endDateFromData = getNextWeeklyOccurrence(cd.weekly.day, cd.weekly.time);
            } else {
                endDateFromData = cd && cd.endDate ? cd.endDate : null;
            }
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
            if (document.body && document.body.getAttribute('data-page') === 'thank-you') trackFBLead(data);
        }
    }

    /**
     * Meta (Facebook/Instagram) sign-up event on the thank-you page, so Meta ads can optimise for real sign-ups
     * (2026-11-27). Runs only when data.analytics.fbPixel is set. Once per browser tab, like the Google Ads conversion.
     * @returns {boolean} true when the event was sent
     */
    function trackFBLead(data) {
        if (typeof window.fbq !== 'function') return false;
        try { if (sessionStorage.getItem('sla_fb_lead_fired') === 'true') return false; } catch (e) { /* storage blocked: send */ }
        window.fbq('track', 'Lead', { content_name: 'Super Learner Academy 3-day workshop', value: isFreeSignup(data) ? 0 : Number((data.registration && data.registration.price) || 0), currency: 'INR' });
        try { sessionStorage.setItem('sla_fb_lead_fired', 'true'); } catch (e) { /* ignore */ }
        return true;
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

        trackPurchaseConversion(data);

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

        // TEMP: auto-redirect disabled for testing — user must click the WhatsApp
        // button themselves. To revert, delete the block below and restore:
        // if (whatsappLink && whatsappLink.trim() !== '') {
        //     startRedirectProgress(whatsappLink);
        // }
        var progressBlock = document.querySelector('.redirect-progress');
        var progressTrack = document.querySelector('.progress-bar-track');
        if (progressBlock) progressBlock.style.display = 'none';
        if (progressTrack) progressTrack.style.display = 'none';
    }

    /**
     * Keeps the structured-data offer price (Course JSON-LD) equal to data.json registration.price,
     * so the price only ever needs changing in data.json.
     */
    function syncOfferPrice(data) {
        var price = isFreeSignup(data) ? '0' : data && data.registration && data.registration.price;
        if (!price) return;
        document.querySelectorAll('script[type="application/ld+json"]').forEach(function (s) {
            try {
                var j = JSON.parse(s.textContent);
                if (j && j.offers && j.offers.price !== undefined && String(j.offers.price) !== String(price)) {
                    j.offers.price = String(price);
                    s.textContent = JSON.stringify(j, null, 2);
                }
            } catch (e) { /* leave malformed blocks alone */ }
        });
    }

    /**
     * Fires the Google Ads "Purchase" conversion event on the thank-you page.
     * Registration goes through SuperProfile, not Razorpay, so there's no
     * redirect query param or webhook to confirm payment — price is a static
     * value matching data.json's registration.price, and transaction_id is
     * the current timestamp (not a real payment reference) so each fire is
     * still distinguishable in Google Ads.
     * Guarded by sessionStorage so a refresh/reload of the thank-you page
     * doesn't double-fire the same conversion.
     */
    function trackPurchaseConversion(data) {
        if (typeof window.gtag !== 'function') return;

        var alreadyFired = false;
        try {
            alreadyFired = sessionStorage.getItem('sla_conversion_fired') === 'true';
        } catch (e) { /* private browsing / storage disabled — fall through and fire */ }
        if (alreadyFired) return;

        window.gtag('event', 'conversion', {
            'send_to': 'AW-18417193820/GmoECPGNmOocENymgM5E',
            'value': isFreeSignup(data) ? 0 : 21, // free signup mode: a sign-up, not a sale
            'currency': 'INR',
            'transaction_id': String(Date.now())
        });

        try {
            sessionStorage.setItem('sla_conversion_fired', 'true');
        } catch (e) { /* private browsing / storage disabled — nothing to persist */ }
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
            var response = await fetch(siteRoot() + 'quotes.json?v=' + cacheBucket());
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
    // HERO QUOTE ROTATOR
    // ========================

    /*
     * Rotates the Ramanujan quote under the hero photo. Separate from
     * initQuotesSlider (which drives #quotes-slider off quotes.json) on
     * purpose: this list is hero-specific, hardcoded so it costs no extra
     * request above the fold, and the first entry is already in the HTML so
     * the block renders identically with JS off.
     *
     * Every quote here is attributable to Ramanujan himself - the first from
     * his 1913 letter to G. H. Hardy, the third from Hardy's own account of
     * the 1729 taxicab exchange. Don't add unsourced "inspirational" lines.
     */
    var HERO_QUOTES = [
        {
            text: 'I have not trodden through a conventional university course, but I am striking out a new path for myself.',
            author: 'Srinivasa Ramanujan, letter to G. H. Hardy, 1913'
        },
        {
            text: 'An equation means nothing to me unless it expresses a thought of God.',
            author: 'Srinivasa Ramanujan'
        },
        {
            text: 'It is a very interesting number; it is the smallest number expressible as the sum of two cubes in two different ways.',
            author: 'Srinivasa Ramanujan, on 1729'
        }
    ];

    var heroQuoteIndex = 0;
    var heroQuoteIntervalId = null;

    /**
     * Returns the index that follows `index` in a list of `length` items,
     * wrapping back to 0 at the end.
     * @param {number} index - Current 0-based index
     * @param {number} length - Number of items in the list
     * @returns {number} The next index, or 0 if the list is empty
     */
    function getNextQuoteIndex(index, length) {
        if (!length || length <= 0) return 0;
        return (index + 1) % length;
    }

    function showHeroQuote(index) {
        var textEl = document.getElementById('hero-quote-text');
        var authorEl = document.getElementById('hero-quote-author');
        if (!textEl || !authorEl) return;

        var quote = HERO_QUOTES[index];
        if (!quote) return;

        textEl.textContent = '“' + quote.text + '”';
        authorEl.textContent = '— ' + quote.author;
    }

    function initHeroQuotes() {
        var wrapper = document.querySelector('.hero-quote');
        if (!wrapper || HERO_QUOTES.length < 2) return;

        // Respect the OS "reduce motion" setting: leave the static first
        // quote in place rather than cross-fading text above the fold.
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        heroQuoteIntervalId = setInterval(function () {
            wrapper.classList.add('is-fading');
            setTimeout(function () {
                heroQuoteIndex = getNextQuoteIndex(heroQuoteIndex, HERO_QUOTES.length);
                showHeroQuote(heroQuoteIndex);
                wrapper.classList.remove('is-fading');
            }, 500);
        }, 8000);
    }

    // ========================
    // GOOGLE SHEETS INTEGRATION (DISABLED — causes slow page load)
    // Uncomment loadGoogleSheetContent() call in DOMContentLoaded and the
    // GOOGLE_SHEET_API_URL below when ready to use.
    // ========================

    /*
    var GOOGLE_SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbxAqNv8lyeqji2f7kG8XNxAoUWg4zWVzfsN_go1KC8QwI0k20xAaGET2v9RpEjnXcu2Yw/exec';

    async function loadGoogleSheetContent(localData) {
        if (!GOOGLE_SHEET_API_URL || GOOGLE_SHEET_API_URL.trim() === '') {
            console.info('[SLA] Google Sheet API URL not set. Using data.json only.');
            return;
        }
        try {
            var response = await fetch(GOOGLE_SHEET_API_URL);
            if (!response.ok) throw new Error('HTTP ' + response.status);
            var result = await response.json();
            if (result.status !== 'success' || !result.content) throw new Error('Invalid response from Google Sheet API');
            applySheetContent(result.content, localData);
        } catch (error) {
            console.warn('[SLA] Could not load Google Sheet content:', error.message);
        }
    }

    function applySheetContent(content, localData) {
        if (content.pageTitle) { var heroH1 = document.querySelector('.hero-text h1'); if (heroH1) heroH1.innerHTML = content.pageTitle; }
        if (content.registration) {
            var reg = content.registration;
            if (reg.closeDate && localData && localData.countdown) localData.countdown.endDate = reg.closeDate;
            if (reg.buttonText) document.querySelectorAll('[data-bind="registration.buttonText"]').forEach(function (el) { el.textContent = reg.buttonText; });
            if (reg.price) document.querySelectorAll('[data-bind="registration.price"]').forEach(function (el) { el.textContent = reg.price; });
            if (reg.originalPrice) document.querySelectorAll('[data-bind="registration.originalPrice"]').forEach(function (el) { el.textContent = reg.originalPrice; });
            if (reg.currency) document.querySelectorAll('[data-bind="registration.currency"]').forEach(function (el) { el.textContent = reg.currency; });
            if (reg.paymentLink && reg.paymentLink !== '#') document.querySelectorAll('[data-bind-href="registration.link"]').forEach(function (el) { el.href = reg.paymentLink; });
        }
        if (content.curriculum) {
            var dayCards = document.querySelectorAll('.day-card');
            ['day1', 'day2', 'day3'].forEach(function (dayKey, index) {
                var dayData = content.curriculum[dayKey];
                if (!dayData || !dayCards[index]) return;
                var card = dayCards[index];
                if (dayData.title) { var titleEl = card.querySelector('.day-card-header h3'); if (titleEl) titleEl.textContent = dayData.title; }
                if (dayData.points && dayData.points.length > 0) {
                    var checklist = card.querySelector('.day-checklist');
                    if (checklist) { checklist.innerHTML = ''; dayData.points.forEach(function (point) { var li = document.createElement('li'); li.innerHTML = '<i class="fas fa-check"></i> ' + escapeHTML(point); checklist.appendChild(li); }); }
                }
            });
        }
    }

    function escapeHTML(str) { var div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
    */

    // ========================
    // VISITORS OUTSIDE INDIA (2026-11-25)
    // ========================
    // GitHub Pages has no server-side geo lookup, and an auto-redirect would also send Googlebot
    // (which crawls from the US) away from the Hinglish pages. So: no redirect. If the browser's
    // timezone is outside India, a slim, dismissible bar shows the LIVE class time in the visitor's
    // own time and, on Hinglish/Hindi pages, a link to the English page. Copy: data.json -> abroad.
    // Preview anywhere with ?abroad=1 (force on) or ?abroad=0 (force off).

    var ABROAD_DISMISS_KEY = 'sla_abroad_dismissed';

    /** True when a valid IANA timezone is given and it is not India's. Unknown timezone -> false. */
    function isOutsideIndia(tz) {
        if (!tz || typeof tz !== 'string') return false;
        return !/^Asia\/(Kolkata|Calcutta)$/.test(tz);
    }

    /**
     * The weekly IST session in the visitor's own time, e.g. "Sat 9:30 AM – 11:30 AM EST".
     * @param {string} startIso - next session start, ISO with +05:30 (from getNextWeeklyOccurrence)
     * @param {number} minutes - session length
     * @param {string} tz - the visitor's IANA timezone
     */
    function formatLocalSession(startIso, minutes, tz) {
        var start = new Date(startIso);
        var end = new Date(start.getTime() + (minutes || 120) * 60000);
        if (isNaN(start.getTime())) return '';
        try {
            var a = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(start);
            var b = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(end);
            return a + ' – ' + b.replace(/GMT\+0$/, 'GMT');
        } catch (e) {
            return '';
        }
    }

    function abroadStyles() {
        if (document.getElementById('sla-abroad-style')) return;
        var s = document.createElement('style');
        s.id = 'sla-abroad-style';
        s.textContent =
            '.sla-abroad{display:flex;align-items:center;gap:8px 14px;flex-wrap:wrap;justify-content:center;' +
            'padding:10px 16px;background:#FFF7DD;border-bottom:1.5px solid #F2D27A;color:#141A3A;' +
            'font:500 14px/1.45 Poppins,Inter,-apple-system,"Segoe UI",sans-serif;text-align:center}' +
            '.sla-abroad strong{font-weight:700}' +
            '.sla-abroad-en{display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:999px;background:#141A3A;color:#fff;' +
            'font-weight:600;text-decoration:none;white-space:nowrap}' +
            '.sla-abroad-en:hover,.sla-abroad-en:focus-visible{background:#3A5BFF;color:#fff}' +
            '.sla-abroad-x{flex:0 0 auto;width:32px;height:32px;border:0;border-radius:8px;' +
            'background:transparent;color:#141A3A;font-size:20px;line-height:1;cursor:pointer}' +
            '.sla-abroad-x:hover,.sla-abroad-x:focus-visible{background:rgba(20,26,58,.08)}';
        document.head.appendChild(s);
    }

    /**
     * Shows the "Outside India?" bar when it applies. Returns the bar element or null.
     * @param {object} data - data.json
     * @param {object} [opts] - { tz, now, search } for tests; defaults to the real browser values
     */
    function initAbroadBar(data, opts) {
        opts = opts || {};
        var cfg = data && data.abroad;
        if (!cfg || cfg.enabled === false || document.querySelector('.sla-abroad')) return null;

        var search = opts.search !== undefined ? opts.search : location.search;
        var force = /[?&]abroad=1\b/.test(search), off = /[?&]abroad=0\b/.test(search);
        var tz = opts.tz;
        if (tz === undefined) {
            try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { tz = ''; }
        }
        if (off || (!force && !isOutsideIndia(tz))) return null;
        if (!force) {
            try { if (localStorage.getItem(ABROAD_DISMISS_KEY) === '1') return null; } catch (e) { /* storage blocked: just show it */ }
        }

        var weekly = data.countdown && data.countdown.weekly;
        var local = '';
        if (weekly && typeof weekly.day === 'number') {
            var startIso = getNextWeeklyOccurrence(weekly.day, weekly.time, opts.now);
            local = formatLocalSession(startIso, cfg.durationMinutes, tz || 'UTC');
        }
        var ist = (data.workshop && data.workshop.sessionTime) || '7:00 PM – 9:00 PM IST';

        abroadStyles();
        var bar = document.createElement('div');
        bar.className = 'sla-abroad';
        bar.setAttribute('role', 'region');
        bar.setAttribute('aria-label', 'For visitors outside India');

        var p = document.createElement('span');
        var lead = document.createElement('strong');
        lead.textContent = '🌍 ' + (cfg.label || 'Outside India?') + ' ';
        p.appendChild(lead);
        p.appendChild(document.createTextNode(local
            ? (cfg.timePrefix || 'LIVE class:') + ' ' + local + ' ' + (cfg.yourTime || 'your time') + ' (' + ist + ')'
            : (cfg.timePrefix || 'LIVE class:') + ' ' + ist));
        bar.appendChild(p);

        var lang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
        // A page can name its own English twin (<body data-english-path="...">), else the default English page.
        var enPath = (document.body && document.body.getAttribute('data-english-path')) || cfg.englishPath;
        if (enPath && lang.indexOf('en') !== 0) {
            var a = document.createElement('a');
            a.className = 'sla-abroad-en';
            a.href = siteRoot() + enPath + (search || '');
            a.textContent = (cfg.englishText || 'Read this page in English') + ' →';
            a.addEventListener('click', function () {
                if (typeof window.gtag === 'function') window.gtag('event', 'abroad_english_click', { tz: tz || '' });
            });
            bar.appendChild(a);
        }

        var x = document.createElement('button');
        x.type = 'button';
        x.className = 'sla-abroad-x';
        x.setAttribute('aria-label', 'Close');
        x.innerHTML = '&times;';
        x.addEventListener('click', function () {
            try { localStorage.setItem(ABROAD_DISMISS_KEY, '1'); } catch (e) { /* ignore */ }
            if (bar.parentNode) bar.parentNode.removeChild(bar);
        });
        bar.appendChild(x);

        // Top of the page content: inside <main> on the Bright/simple pages (under the sticky header),
        // before the first section on the classic page (which has a fixed top bar and no <main>).
        var main = document.querySelector('main');
        if (main) main.insertBefore(bar, main.firstChild);
        else {
            var first = document.querySelector('body > section, section');
            if (first && first.parentNode) first.parentNode.insertBefore(bar, first);
            else document.body.insertBefore(bar, document.body.firstChild);
        }
        return bar;
    }

    // ========================
    // INITIALIZATION
    // ========================

    document.addEventListener('DOMContentLoaded', async function () {
        var isThankYouPage = document.body.getAttribute('data-page') === 'thank-you';
        var data = await loadData();
        // Shared with page-specific scripts (bright.js) so they don't fetch data.json again.
        window.SLA_DATA = data;
        try { document.dispatchEvent(new CustomEvent('sla:data', { detail: data || null })); } catch (e) { /* old browsers: no CustomEvent */ }

        if (data) {
            if (isThankYouPage) {
                playConfetti();
                initThankYouPage(data);
                initAnalytics(data);
            } else {
                // Google Sheet integration disabled for faster load.
                // To re-enable: uncomment the block above and add:
                // await loadGoogleSheetContent(data);

                initCountdown(data);
                initNextBatch(data);
                initFAQ();
                initStickyCTA();
                initScrollAnimations();
                initAnalytics(data);
                initFreeSignupTracking(data);
                initLeadForm(data);
                initCoachImageFallback();
                initQuotesSlider();
                initHeroQuotes();
                initAbroadBar(data);
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
        isOutsideIndia: isOutsideIndia,
        formatLocalSession: formatLocalSession,
        initAbroadBar: initAbroadBar,
        siteRoot: siteRoot,
        cacheBucket: cacheBucket,
        loadData: loadData,
        injectContent: injectContent,
        hideDynamicElements: hideDynamicElements,
        isFreeSignup: isFreeSignup,
        isLeadFormActive: isLeadFormActive,
        initLeadForm: initLeadForm,
        setNestedValue: setNestedValue,
        applyFreeSignup: applyFreeSignup,
        getNestedValue: getNestedValue,
        fillTemplate: fillTemplate,
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
        initHeroQuotes: initHeroQuotes,
        showHeroQuote: showHeroQuote,
        getNextQuoteIndex: getNextQuoteIndex,
        getStaggerDelay: getStaggerDelay,
        playConfetti: playConfetti,
        formatWorkshopDate: formatWorkshopDate,
        getNextWeeklyOccurrence: getNextWeeklyOccurrence,
        formatNextBatch: formatNextBatch,
        initNextBatch: initNextBatch,
        initThankYouPage: initThankYouPage,
        trackPurchaseConversion: trackPurchaseConversion,
        trackFBLead: trackFBLead
    };

})();
