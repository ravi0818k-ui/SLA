/**
 * Shared hamburger menu for every page on the site.
 *
 * The markup lives statically in each page (so the links are real links with
 * no JS, and a crawler / quality rater sees About + Contact without needing to
 * run anything). This file only wires up open/close behaviour.
 *
 * Loaded with `defer` on index.html, about.html, quiz.html, thank-you.html and
 * generatenotes/index.html. It is deliberately independent of script.js and
 * quiz.js — neither of those loads on all of those pages.
 */
(function () {
    'use strict';

    function initSiteNav() {
        var toggle = document.getElementById('site-nav-toggle');
        var panel = document.getElementById('site-nav-panel');
        var backdrop = document.getElementById('site-nav-backdrop');

        if (!toggle || !panel) return;

        var lastFocused = null;

        function isOpen() {
            return toggle.getAttribute('aria-expanded') === 'true';
        }

        function open() {
            lastFocused = document.activeElement;
            toggle.setAttribute('aria-expanded', 'true');
            toggle.setAttribute('aria-label', 'Close menu');
            panel.hidden = false;
            if (backdrop) backdrop.hidden = false;
            document.body.style.overflow = 'hidden';
            var first = panel.querySelector('a, button');
            if (first) first.focus();
        }

        function close(returnFocus) {
            toggle.setAttribute('aria-expanded', 'false');
            toggle.setAttribute('aria-label', 'Open menu');
            panel.hidden = true;
            if (backdrop) backdrop.hidden = true;
            document.body.style.overflow = '';
            if (returnFocus) {
                (lastFocused && lastFocused.focus ? lastFocused : toggle).focus();
            }
        }

        toggle.addEventListener('click', function () {
            if (isOpen()) close(true); else open();
        });

        if (backdrop) {
            backdrop.addEventListener('click', function () { close(true); });
        }

        // Navigating away (including a same-page hash link) should close it.
        panel.addEventListener('click', function (e) {
            if (e.target.closest('a')) close(false);
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && isOpen()) close(true);
        });

        // Some pages hide the whole menu below a breakpoint (see site-nav.css).
        // If the viewport crosses that breakpoint while the panel is open —
        // rotating a tablet to portrait, for instance — the panel vanishes but
        // open() has already locked body scroll, which would trap the reader on
        // an unscrollable page. offsetParent is null once a CSS ancestor is
        // display:none, so use that to detect it and close properly.
        window.addEventListener('resize', function () {
            if (isOpen() && toggle.offsetParent === null) close(false);
        });

        // Keep tabbing inside the panel while it is open.
        panel.addEventListener('keydown', function (e) {
            if (e.key !== 'Tab') return;
            var items = panel.querySelectorAll('a[href], button:not([disabled])');
            if (!items.length) return;
            var first = items[0];
            var last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSiteNav);
    } else {
        initSiteNav();
    }
})();
