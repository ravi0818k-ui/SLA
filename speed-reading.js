/*
 * Speed-reading page (speed-reading.html), 2026-11-28.
 *   1. Book-time calculator: pages x words per page / words per minute.
 *   2. Exercise 1, reading-speed test: timed passage -> words per minute, then 3 questions -> "effective speed".
 *   3. Exercise 2, pacer: highlights 3-word chunks at a chosen speed; the reader's eyes follow it.
 *   4. Exercise 3, preview drill: a 2-minute timer.
 * Pure helpers live on window.SLASpeed so tests/unit/speed-reading.test.js can check them.
 * Honest numbers only: the default speed is the average adult silent-reading rate for non-fiction (Brysbaert 2019).
 */
(function () {
    'use strict';

    var AVG_WPM = 238;          // Brysbaert (2019), adults, silent reading, non-fiction
    var WORDS_PER_PAGE = 250;   // a typical paperback page

    function countWords(text) {
        var m = String(text || '').trim().match(/\S+/g);
        return m ? m.length : 0;
    }

    function wpm(words, ms) {
        if (!(words > 0) || !(ms > 0)) return 0;
        return Math.round(words / (ms / 60000));
    }

    function bookMinutes(pages, wordsPerPage, speed) {
        pages = Number(pages); wordsPerPage = Number(wordsPerPage); speed = Number(speed);
        if (!(pages > 0) || !(wordsPerPage > 0) || !(speed > 0)) return 0;
        return Math.round(pages * wordsPerPage / speed);
    }

    function formatDuration(min) {
        min = Math.max(0, Math.round(Number(min) || 0));
        var h = Math.floor(min / 60), m = min % 60;
        if (!h) return m + ' min';
        return m ? h + ' h ' + m + ' min' : h + ' h';
    }

    function pacerDelay(speed, chunk) {
        speed = Number(speed); chunk = Number(chunk) || 1;
        if (!(speed > 0)) return 0;
        return Math.round(60000 * chunk / speed);
    }

    function effectiveWpm(speed, correct, total) {
        if (!(total > 0)) return 0;
        return Math.round(speed * Math.max(0, Math.min(correct, total)) / total);
    }

    /* Feedback never shames a slow reader and never praises speed without understanding. */
    function feedback(speed, correct, total) {
        if (total && correct / total < 0.6) {
            return 'You read fast, but some of the meaning got lost. Slow down a little: speed only counts when the meaning comes with it.';
        }
        if (speed < 180) return 'Good understanding. Your next step is a pacer (Exercise 2) to cut down on going back over lines.';
        if (speed <= 320) return 'Good: that is around the normal range for careful reading. Previewing first (Exercise 3) is your easiest next win.';
        return 'Quick and accurate. Keep checking your understanding on harder books: textbooks deserve a slower gear.';
    }

    function track(name, params) {
        if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
    }

    /* ---------- 1. calculator ---------- */
    function initCalc() {
        var form = document.getElementById('sr-calc');
        if (!form) return;
        var pages = form.querySelector('[name="pages"]'), wpp = form.querySelector('[name="wpp"]'), sp = form.querySelector('[name="wpm"]');
        var out = document.getElementById('sr-calc-out'), daily = document.getElementById('sr-calc-daily');
        function update() {
            var min = bookMinutes(pages.value, wpp.value, sp.value);
            out.textContent = min ? 'about ' + formatDuration(min) : '–';
            daily.textContent = min ? Math.max(1, Math.ceil(min / 20)) + (Math.ceil(min / 20) === 1 ? ' day' : ' days') : '–';
        }
        form.addEventListener('input', update);
        form.addEventListener('submit', function (e) { e.preventDefault(); update(); });
        update();
        return { setSpeed: function (v) { sp.value = v; update(); } };
    }

    /* ---------- 2. speed test ---------- */
    function initTest(calc) {
        var box = document.getElementById('sr-test');
        if (!box) return;
        var passage = box.querySelector('.sr-passage'), start = box.querySelector('[data-sr="start"]'), done = box.querySelector('[data-sr="done"]');
        var quiz = box.querySelector('.sr-quiz'), result = box.querySelector('.sr-result'), clock = box.querySelector('.sr-clock');
        var words = countWords(passage.textContent), t0 = 0, timer = null, speed = 0;

        function tick() { var s = Math.floor((Date.now() - t0) / 1000); clock.textContent = Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

        start.addEventListener('click', function () {
            passage.classList.remove('sr-blur'); passage.setAttribute('aria-hidden', 'false');
            start.hidden = true; done.hidden = false; quiz.hidden = true; result.hidden = true;
            t0 = Date.now(); clearInterval(timer); timer = setInterval(tick, 250); tick();
            done.focus();
            track('speed_test_start');
        });
        done.addEventListener('click', function () {
            clearInterval(timer);
            speed = wpm(words, Date.now() - t0);
            passage.classList.add('sr-blur'); passage.setAttribute('aria-hidden', 'true');
            done.hidden = true; quiz.hidden = false;
            box.querySelector('.sr-wpm').textContent = speed;
            var first = quiz.querySelector('input'); if (first) first.focus();
        });
        quiz.addEventListener('submit', function (e) {
            e.preventDefault();
            var qs = quiz.querySelectorAll('fieldset'), correct = 0;
            for (var i = 0; i < qs.length; i++) {
                var picked = qs[i].querySelector('input:checked');
                var ok = picked && picked.value === qs[i].getAttribute('data-answer');
                if (ok) correct++;
                qs[i].classList.toggle('sr-right', !!ok); qs[i].classList.toggle('sr-wrong', !ok);
            }
            result.hidden = false;
            result.querySelector('.sr-r-wpm').textContent = speed;
            result.querySelector('.sr-r-score').textContent = correct + '/' + qs.length;
            result.querySelector('.sr-r-eff').textContent = effectiveWpm(speed, correct, qs.length);
            result.querySelector('.sr-r-tip').textContent = feedback(speed, correct, qs.length);
            if (calc && speed > 0) calc.setSpeed(Math.min(1000, Math.max(50, speed)));
            start.hidden = false; start.textContent = 'Take the test again';
            track('speed_test_done', { wpm: speed, score: correct });
        });
    }

    /* ---------- 3. pacer ---------- */
    function initPacer() {
        var box = document.getElementById('sr-pacer');
        if (!box) return;
        var text = box.querySelector('.sr-pacer-text'), range = box.querySelector('[name="pacer-wpm"]'), val = box.querySelector('.sr-pacer-val');
        var play = box.querySelector('[data-sr="pacer-play"]'), reset = box.querySelector('[data-sr="pacer-reset"]');
        var CHUNK = 3, i = 0, timer = null;
        var spans = [];
        // wrap every word once, keeping paragraphs
        Array.prototype.forEach.call(text.querySelectorAll('p'), function (p) {
            var ws = p.textContent.trim().split(/\s+/);
            p.textContent = '';
            ws.forEach(function (w, k) {
                var s = document.createElement('span'); s.textContent = w; p.appendChild(s); spans.push(s);
                if (k < ws.length - 1) p.appendChild(document.createTextNode(' '));
            });
        });
        function paint() {
            for (var k = 0; k < spans.length; k++) spans[k].className = k >= i && k < i + CHUNK ? 'on' : (k < i ? 'read' : '');
        }
        function step() {
            i += CHUNK;
            if (i >= spans.length) { stop(); i = spans.length; paint(); play.textContent = 'Start again'; return; }
            paint();
        }
        function stop() { clearInterval(timer); timer = null; play.textContent = 'Resume'; play.setAttribute('aria-pressed', 'false'); }
        function startP() {
            if (i >= spans.length) i = 0;
            clearInterval(timer); timer = setInterval(step, pacerDelay(range.value, CHUNK)); paint();
            play.textContent = 'Pause'; play.setAttribute('aria-pressed', 'true');
            track('pacer_start', { wpm: Number(range.value) });
        }
        range.addEventListener('input', function () {
            val.textContent = range.value;
            if (timer) { clearInterval(timer); timer = setInterval(step, pacerDelay(range.value, CHUNK)); }
        });
        play.addEventListener('click', function () { timer ? stop() : startP(); });
        reset.addEventListener('click', function () { clearInterval(timer); timer = null; i = 0; paint(); play.textContent = 'Start'; play.setAttribute('aria-pressed', 'false'); });
        val.textContent = range.value;
    }

    /* ---------- 4. preview timer ---------- */
    function initPreview() {
        var box = document.getElementById('sr-preview');
        if (!box) return;
        var btn = box.querySelector('[data-sr="preview-go"]'), clock = box.querySelector('.sr-preview-clock');
        var LEN = 120, timer = null, end = 0;
        function show(s) { clock.textContent = Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
        btn.addEventListener('click', function () {
            if (timer) { clearInterval(timer); timer = null; show(LEN); btn.textContent = 'Start 2 minutes'; box.classList.remove('sr-running', 'sr-over'); return; }
            end = Date.now() + LEN * 1000; box.classList.add('sr-running'); box.classList.remove('sr-over'); btn.textContent = 'Stop';
            timer = setInterval(function () {
                var left = Math.max(0, Math.ceil((end - Date.now()) / 1000)); show(left);
                if (!left) { clearInterval(timer); timer = null; box.classList.remove('sr-running'); box.classList.add('sr-over'); btn.textContent = 'Start 2 minutes'; clock.textContent = 'Close the book: write 3 things'; }
            }, 250);
            track('preview_drill_start');
        });
        show(LEN);
    }

    window.SLASpeed = {
        AVG_WPM: AVG_WPM, WORDS_PER_PAGE: WORDS_PER_PAGE,
        countWords: countWords, wpm: wpm, bookMinutes: bookMinutes, formatDuration: formatDuration,
        pacerDelay: pacerDelay, effectiveWpm: effectiveWpm, feedback: feedback,
        init: function () { var c = initCalc(); initTest(c); initPacer(); initPreview(); }
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.SLASpeed.init);
    else window.SLASpeed.init();
})();
