/* bright.js: behaviour that only the Bright Mind landing page (index.html) needs.
   - Audience picker tabs (Class 6-10 / JEE / Law / UPSC / Parents), keyboard accessible.
   - Reveal-on-scroll for .rv elements (independent of data.json, so content never stays hidden).
   - Shows #reviews only when data.json bright.showTestimonials === true.
   Shared behaviour (data binding, FAQ, countdown, sticky CTA) stays in script.js. */
(function () {
    'use strict';

    function initPicker() {
        var tabs = Array.prototype.slice.call(document.querySelectorAll('.b-tab[role="tab"]'));
        if (!tabs.length) return;
        function select(tab, focus) {
            tabs.forEach(function (t) {
                var on = t === tab, panel = document.getElementById(t.getAttribute('aria-controls'));
                t.setAttribute('aria-selected', on ? 'true' : 'false');
                t.tabIndex = on ? 0 : -1;
                if (panel) panel.hidden = !on;
            });
            if (focus) tab.focus();
        }
        tabs.forEach(function (tab, i) {
            tab.addEventListener('click', function () {
                select(tab, false);
                try { if (window.gtag) window.gtag('event', 'audience_select', { audience: tab.id.replace('tab-', '') }); } catch (e) {}
            });
            tab.addEventListener('keydown', function (e) {
                var n = null;
                if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
                else if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
                else if (e.key === 'Home') n = tabs[0];
                else if (e.key === 'End') n = tabs[tabs.length - 1];
                if (n) { e.preventDefault(); select(n, true); }
            });
        });
        // Deep link: index.html#upsc opens the UPSC tab (handy for audience-specific ads)
        var want = (location.hash || '').replace('#', '');
        var start = tabs.filter(function (t) { return t.id === 'tab-' + want; })[0] || tabs[0];
        select(start, false);
        if (start !== tabs[0]) { var sec = document.getElementById('aapke-liye'); if (sec) sec.scrollIntoView(); }
    }

    function initReveal() {
        var els = document.querySelectorAll('.rv');
        if (!els.length) return;
        var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce || !('IntersectionObserver' in window)) { els.forEach(function (el) { el.classList.add('in'); }); return; }
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
        }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
        els.forEach(function (el, i) { el.style.transitionDelay = ((i % 3) * 90) + 'ms'; io.observe(el); });
    }

    function applyFlags(data) {
        var reviews = document.getElementById('reviews');
        if (reviews) reviews.hidden = !(data && data.bright && data.bright.showTestimonials === true);
    }

    function track() {
        // Count Register / WhatsApp clicks per page section in GA4 (no-op if gtag is missing).
        document.addEventListener('click', function (e) {
            var a = e.target.closest && e.target.closest('a');
            if (!a || !window.gtag) return;
            var sec = a.closest('section, header, footer, .sticky-cta');
            var where = sec ? (sec.id || sec.className.split(' ')[0]) : 'page';
            if (a.classList.contains('cta-button')) window.gtag('event', 'register_click', { section: where });
            else if ((a.href || '').indexOf('wa.me') > -1) window.gtag('event', 'whatsapp_click', { section: where });
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        initPicker();
        initReveal();
        track();
        if (window.SLA_DATA !== undefined) applyFlags(window.SLA_DATA);
    });
    document.addEventListener('sla:data', function (e) { applyFlags(e.detail); });

    window.SLABright = { initPicker: initPicker, applyFlags: applyFlags };
})();
