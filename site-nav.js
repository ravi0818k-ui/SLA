/**
 * Shared hamburger menu for every page on the site.
 *
 * The markup lives statically in each page (so the links are real links with
 * no JS, and a crawler / quality rater sees About + Contact without needing to
 * run anything). This file wires up open/close behaviour and, with JS on,
 * swaps the static link lists for the full grouped SITE MAP below.
 *
 * Loaded with `defer` on index.html, about.html, quiz.html, thank-you.html and
 * generatenotes/index.html. It is deliberately independent of script.js and
 * quiz.js — neither of those loads on all of those pages.
 */
(function () {
    'use strict';

    /*
     * SITE MAP (2026-11-25): the one list of every public page, shown in the menu on every page.
     * With JS on, buildSiteMap() replaces the static "Pages" / "Free Tools" lists with this grouped
     * map (search box, "You're here" marker, copy-link buttons). Without JS the static lists stay.
     * Paths are relative to the site root; `also` = other URLs of the same page (old /ads-N/ copies,
     * source files) so the current page is still recognised there.
     * Add every new page here. tests/unit/site-nav.test.js fails if an ad-pages.json path is missing.
     * thank-you.html is left out on purpose: opening it fires the Google Ads conversion.
     */
    var SITE_MAP = [
        { group: 'Main', items: [
            { path: '', icon: '🏠', title: 'Home', sub: 'Board exam 2027 · 3-day LIVE workshop', also: ['index.html'] },
            { path: 'about.html', icon: 'ℹ️', title: 'About Us', sub: 'Who runs this site & how to reach us' }
        ] },
        { group: 'Workshop pages', note: 'one per audience', share: true, items: [
            { path: 'english-ads-1-students/', icon: '🎓', title: 'Students · English', sub: 'Classic English page', also: ['ads-1/', 'index-classic.html'] },
            { path: 'hinglish-ads-2-students/', icon: '🗣️', title: 'Students · Hinglish', sub: 'Audience picker: CBSE, JEE, UPSC…', also: ['ads-2/'] },
            { path: 'hindi-ads-3-students/', icon: '📖', title: 'Students · हिंदी', sub: 'Hindi (Devanagari) page', also: ['ads-3/', 'index-hi.html'] },
            { path: 'parents-ads-4-tuition-vs-exam/', icon: '👪', title: 'Parents · Class 3–5', sub: 'Tuition mein aata hai, exam mein kyun nahi?', also: ['ads-4/', 'index-parents.html'] },
            { path: 'board-ads-5-topper/', icon: '📝', title: 'Board exams · Class 9–12', sub: 'CBSE & State Board', also: ['ads-5/', 'index-board.html'] },
            { path: 'career-ads-6-professionals/', icon: '💼', title: 'Professionals', sub: 'Between jobs · learn any skill faster', also: ['ads-6/', 'index-pro.html'] },
            { path: 'simple-ads-7-everyone/', icon: '⚡', title: 'Quick sign-up · everyone', sub: 'Short one-page version', also: ['ads-7/', 'index-simple.html'] },
            { path: 'selfstudy-ads-8-board-2027/', icon: '🧩', title: 'Board exam 2027 · Class 10 & 12', sub: 'Tuition ke baad bhi atak jaate ho? + learner-type survey', also: ['ads-8/', 'index-board27.html'] },
            { path: 'selfstudy-ads-9-board-2027-english/', icon: '🔤', title: 'Board exam 2027 · English', sub: 'Still stuck after tuition? The same page in English', also: ['ads-9/', 'index-board27-en.html'] }
        ] },
        { group: 'Free tools', items: [
            { path: 'quiz.html', icon: '🧠', title: 'Quiz', sub: '20 free assessments & brain-training tools' },
            { path: 'speed-reading.html', icon: '📖', title: 'Speed Reading', sub: 'Free guide + reading-speed test' },
            { path: 'speed-reading.html#sr-test', icon: '⏱️', title: 'Reading Speed Test', sub: 'Find your words per minute in 2 minutes' },
            { path: 'mindmap/index.html', icon: '🧭', title: 'Mind Maps', sub: 'Build and export study mind maps', also: ['mindmap/'] },
            { path: 'generatenotes/index.html', icon: '📄', title: 'Notes Generator', sub: 'Markdown notes → printable PDF', also: ['generatenotes/'] },
            { path: 'resources.html', icon: '📚', title: 'Resources', sub: 'Free printable trackers & guides' }
        ] }
    ];
    var PUBLIC_ROOT = 'https://www.superlearneracademy.in/';

    // '' on root pages, '../' on pages one folder down: taken from this script's own src.
    function rootPrefix() {
        var s = document.querySelector('script[src*="site-nav.js"]');
        var src = s ? s.getAttribute('src') : '';
        return src.replace(/site-nav\.js.*$/, '');
    }

    function normUrl(u) {
        return String(u).split('#')[0].split('?')[0].replace(/index\.html$/, '');
    }

    function absUrl(rel) {
        var a = document.createElement('a');
        a.href = rel;
        return a.href;
    }

    function el(tag, cls, text) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text) e.textContent = text;
        return e;
    }

    function legacyCopy(text) {
        var t = document.createElement('textarea');
        t.value = text;
        t.setAttribute('readonly', '');
        t.style.position = 'fixed';
        t.style.opacity = '0';
        document.body.appendChild(t);
        t.select();
        try { document.execCommand('copy'); } catch (e) { /* nothing else to try */ }
        document.body.removeChild(t);
    }

    function copyText(text, done) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text); done(); });
        } else {
            legacyCopy(text);
            done();
        }
    }

    function buildSiteMap(panel) {
        if (panel.querySelector('.site-nav-map')) return 0;
        var prefix = rootPrefix();
        var here = normUrl(location.href);
        var map = el('div', 'site-nav-map');

        var search = el('div', 'site-nav-search');
        var input = el('input');
        input.type = 'search';
        input.placeholder = 'Search pages…';
        input.setAttribute('aria-label', 'Search pages');
        input.autocomplete = 'off';
        search.appendChild(input);
        map.appendChild(search);

        var total = 0;
        SITE_MAP.forEach(function (g, gi) {
            // Every group starts COLLAPSED (2026-11-26): a visitor sees only the group names, so the
            // other pages' links/URLs stay hidden until someone opens a group. Search opens matches.
            var section = el('div', 'site-nav-group is-collapsed');
            var listId = 'site-nav-group-' + gi;
            var h = el('button', 'site-nav-heading site-nav-group-toggle');
            h.type = 'button';
            h.setAttribute('aria-expanded', 'false');
            h.setAttribute('aria-controls', listId);
            h.appendChild(el('span', 'site-nav-group-name', g.group));
            if (g.note) h.appendChild(el('span', 'site-nav-heading-note', ' · ' + g.note));
            h.appendChild(el('span', 'site-nav-group-count', String(g.items.length)));
            h.addEventListener('click', function () {
                var open = section.classList.toggle('is-collapsed') === false;
                h.setAttribute('aria-expanded', open ? 'true' : 'false');
                if (!input.value.trim()) ul.hidden = !open;
            });
            section.appendChild(h);
            var ul = el('ul', 'site-nav-list site-nav-map-list');
            ul.id = listId;
            ul.hidden = true;
            g.items.forEach(function (it) {
                total++;
                var li = el('li');
                li.setAttribute('data-search', (it.title + ' ' + it.sub + ' ' + it.path + ' ' + g.group).toLowerCase());
                var a = el('a');
                a.href = (prefix + it.path) || './';
                var icon = el('span', 'site-nav-icon', it.icon);
                icon.setAttribute('aria-hidden', 'true');
                a.appendChild(icon);
                var text = el('span', 'site-nav-text', it.title);
                var urls = [it.path].concat(it.also || []);
                // a deep link into a page (path with #) is never "You're here": the page's own entry is
                var isHere = it.path.indexOf('#') < 0 && urls.some(function (p) { return normUrl(absUrl((prefix + p) || './')) === here; });
                if (isHere) {
                    li.className = 'is-current';
                    a.setAttribute('aria-current', 'page');
                    text.appendChild(el('span', 'site-nav-here', 'You’re here'));
                }
                text.appendChild(el('span', 'site-nav-sub', it.sub));
                if (g.share) text.appendChild(el('span', 'site-nav-path', '/' + it.path));
                a.appendChild(text);
                li.appendChild(a);

                if (g.share) li.appendChild(copyButton(PUBLIC_ROOT + it.path, it.title));
                ul.appendChild(li);
            });
            section.appendChild(ul);
            map.appendChild(section);
        });

        var empty = el('p', 'site-nav-empty', 'No page found.');
        empty.hidden = true;
        map.appendChild(empty);

        input.addEventListener('input', function () {
            var q = input.value.trim().toLowerCase();
            var shown = 0;
            Array.prototype.forEach.call(map.querySelectorAll('.site-nav-group'), function (sec) {
                var n = 0;
                Array.prototype.forEach.call(sec.querySelectorAll('li'), function (li) {
                    var ok = !q || li.getAttribute('data-search').indexOf(q) > -1;
                    li.hidden = !ok;
                    if (ok) n++;
                });
                sec.hidden = n === 0;
                // While searching, show the matches even in a collapsed group; when the box is
                // cleared, each group goes back to the open/closed state the visitor chose.
                sec.querySelector('.site-nav-map-list').hidden = q ? false : sec.classList.contains('is-collapsed');
                shown += n;
            });
            empty.hidden = shown > 0;
        });

        // Replace the static fallback lists ("Pages", "Free Tools") with the map; keep Contact.
        Array.prototype.slice.call(panel.children).forEach(function (child) {
            if (!child.classList.contains('site-nav-list')) return;
            var prev = child.previousElementSibling;
            if (prev && prev.classList.contains('site-nav-heading')) panel.removeChild(prev);
            panel.removeChild(child);
        });
        var contact = panel.querySelector('.site-nav-contact');
        var anchor = contact;
        if (contact && contact.previousElementSibling && contact.previousElementSibling.classList.contains('site-nav-heading')) anchor = contact.previousElementSibling;
        panel.insertBefore(map, anchor && anchor.parentNode === panel ? anchor : null);
        panel.classList.add('has-site-map');
        return total;
    }

    // A small "copy link" button (copy icon; turns into a green tick for 1.6 s once copied).
    function copyButton(url, title) {
        var btn = el('button', 'site-nav-copy');
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Copy link: ' + title);
        btn.title = 'Copy link';
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/></svg>' +
            '<svg class="site-nav-copy-ok" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        btn.addEventListener('click', function () {
            copyText(url, function () {
                btn.classList.add('is-copied');
                btn.setAttribute('aria-label', 'Link copied');
                setTimeout(function () {
                    btn.classList.remove('is-copied');
                    btn.setAttribute('aria-label', 'Copy link: ' + title);
                }, 1600);
            });
        });
        return btn;
    }

    // The Google review link in the menu (.site-nav-review, static HTML on every page) gets a copy
    // button, so the coach can paste the link into the webinar chat (2026-11-28).
    function addReviewCopy(panel) {
        var a = panel.querySelector('.site-nav-review a[href]');
        if (!a || a.parentNode.querySelector('.site-nav-copy')) return;
        a.parentNode.appendChild(copyButton(a.href, 'Google review'));
    }

    function initSiteNav() {
        var toggle = document.getElementById('site-nav-toggle');
        var panel = document.getElementById('site-nav-panel');
        var backdrop = document.getElementById('site-nav-backdrop');

        if (!toggle || !panel) return;

        buildSiteMap(panel);
        addReviewCopy(panel);

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

        // A page that hides the toggle for one of its own views (the quiz app
        // does this while a question is on screen) needs a way to close the
        // panel without simulating a click on a now-invisible button.
        window.SLASiteNav = { isOpen: isOpen, close: close, SITE_MAP: SITE_MAP };

        // Keep tabbing inside the panel while it is open.
        panel.addEventListener('keydown', function (e) {
            if (e.key !== 'Tab') return;
            var items = panel.querySelectorAll('a[href], button:not([disabled]), input');
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
