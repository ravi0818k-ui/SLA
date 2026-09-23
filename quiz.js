/* ==========================================================================
   Super Learner Academy — Know Yourself Better
   Ported from the quiz-assessment-app React/Vite project to plain HTML + JS
   so it ships from this repo with no build step, matching index.html.

   Structure (mirrors script.js's conventions):
     1. Content protection
     2. Router + view host
     3. Session state
     4. Data loading (QuizQuestions/*.json)
     5. Scorers        - pure functions, all exposed on window.SLAQuiz
     6. Result widgets - hand-rolled SVG (replaces recharts)
     7. Views          - home / username / quiz / results / about
     8. Tools          - lazy-loaded from quiz-tools.js
     9. window.SLAQuiz test surface

   Answers are always stored as the selected option's INDEX. Every scorer
   works from (question, index), so nothing depends on matching option text
   back to a label the way the React version did.
   ========================================================================== */
(function () {
    'use strict';

    // =====================================================================
    // 1. CONTENT PROTECTION
    // Same intent as script.js (image/content protection for a paid funnel),
    // but text fields are exempt - this app has name inputs and a journaling
    // tool, and blocking copy/paste there would break real typing.
    // =====================================================================

    function isTextField(el) {
        if (!el) return false;
        var tag = el.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
    }

    function showProtectionAlert(message) {
        var existing = document.getElementById('protection-popup');
        if (existing) existing.remove();

        var popup = document.createElement('div');
        popup.id = 'protection-popup';
        popup.innerHTML =
            '<div class="protection-popup-inner">' +
            '<i class="fas fa-lock"></i>' +
            '<p>' + message + '</p>' +
            '</div>';
        document.body.appendChild(popup);
        setTimeout(function () {
            if (popup.parentNode) popup.parentNode.removeChild(popup);
        }, 1600);
    }

    document.addEventListener('contextmenu', function (e) {
        if (isTextField(e.target)) return;
        e.preventDefault();
        showProtectionAlert('This content is protected.');
    });

    document.addEventListener('keydown', function (e) {
        var key = (e.key || '').toLowerCase();

        if (e.key === 'F12') {
            e.preventDefault();
            showProtectionAlert('Developer tools are disabled.');
            return;
        }
        if (e.ctrlKey && e.shiftKey && (key === 'i' || key === 'j' || key === 'c')) {
            e.preventDefault();
            showProtectionAlert('Developer tools are disabled.');
            return;
        }
        if (e.ctrlKey && (key === 'u' || key === 's')) {
            e.preventDefault();
            showProtectionAlert('This content is protected.');
            return;
        }
        // Copy stays available inside text fields so typing/editing works.
        if (e.ctrlKey && key === 'c' && !isTextField(e.target)) {
            e.preventDefault();
            showProtectionAlert('Copying is disabled.');
        }
    });

    // =====================================================================
    // 2. SMALL DOM HELPERS
    // =====================================================================

    // Resolved at use time rather than cached, so the module never holds a
    // reference to a detached node.
    function appEl() { return document.getElementById('app'); }
    function dialogEl() { return document.getElementById('quiz-dialog'); }

    function h(tag, attrs, children) {
        var el = document.createElement(tag);
        if (attrs) {
            Object.keys(attrs).forEach(function (k) {
                var v = attrs[k];
                if (v === null || v === undefined || v === false) return;
                if (k === 'class') el.className = v;
                else if (k === 'text') el.textContent = v;
                else if (k === 'html') el.innerHTML = v;
                else if (k === 'style') el.setAttribute('style', v);
                else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
                else el.setAttribute(k, v);
            });
        }
        (children || []).forEach(function (c) {
            if (c === null || c === undefined || c === false) return;
            el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
        });
        return el;
    }

    function svg(tag, attrs, children) {
        var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        Object.keys(attrs || {}).forEach(function (k) {
            if (attrs[k] !== null && attrs[k] !== undefined) el.setAttribute(k, attrs[k]);
        });
        (children || []).forEach(function (c) { el.appendChild(c); });
        return el;
    }

    function render(node) {
        var app = appEl();
        if (!app) return;
        app.innerHTML = '';
        app.appendChild(node);
        if (typeof window.scrollTo === 'function') window.scrollTo(0, 0);
    }

    // =====================================================================
    // 3. SESSION STATE
    // React Router carried { userName, answers } in location.state. Here that
    // lives in sessionStorage so a refresh mid-quiz doesn't lose the run.
    // =====================================================================

    var STATE_KEY = 'sla_quiz_state';

    function readState() {
        try {
            return JSON.parse(sessionStorage.getItem(STATE_KEY)) || {};
        } catch (err) {
            return {};
        }
    }

    function writeState(patch) {
        var next = readState();
        Object.keys(patch).forEach(function (k) { next[k] = patch[k]; });
        try {
            sessionStorage.setItem(STATE_KEY, JSON.stringify(next));
        } catch (err) { /* private mode - the run just won't survive a refresh */ }
        return next;
    }

    function clearAnswers() {
        var s = readState();
        delete s.answers;
        delete s.quizId;
        try { sessionStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch (err) { /* ignore */ }
    }

    // =====================================================================
    // 4. DATA LOADING
    // index.json holds the home-page catalogue; each quiz's questions and
    // interpretation copy live in its own file, fetched only when started.
    // =====================================================================

    var catalogue = null;
    var quizCache = {};

    function loadCatalogue() {
        if (catalogue) return Promise.resolve(catalogue);
        return fetch('QuizQuestions/index.json')
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) { catalogue = data; return data; });
    }

    function loadQuiz(id) {
        if (quizCache[id]) return Promise.resolve(quizCache[id]);
        return fetch('QuizQuestions/' + id + '.json')
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) { quizCache[id] = data; return data; });
    }

    // Resolve a question's option list: either the quiz-wide shared Likert
    // scale, or the question's own options.
    function optionsFor(quiz, question) {
        if (quiz.sharedOptions) {
            return quiz.sharedOptions.map(function (t) { return { text: t }; });
        }
        return question.options || [];
    }

    // =====================================================================
    // 5. SCORERS  (pure - every one of these is unit-testable)
    // =====================================================================

    // Pick the first matching band. Bands use `min` (pct >= min),
    // `max` (pct <= max) or `iqMin`, and are listed in priority order.
    function bandFor(bands, pct, iq) {
        for (var i = 0; i < bands.length; i++) {
            var b = bands[i];
            if (b.iqMin !== undefined) { if (iq >= b.iqMin) return b; continue; }
            if (b.min !== undefined) { if (pct >= b.min) return b; continue; }
            if (b.max !== undefined) { if (pct <= b.max) return b; continue; }
            return b; // bare band = catch-all
        }
        return bands[bands.length - 1];
    }

    // Points for one answer. Shared-Likert quizzes score index+1 (with an
    // optional reverse flip); option-scored quizzes carry their own `score`.
    function pointsFor(quiz, question, index) {
        if (index === null || index === undefined || index < 0) return 0;
        if (quiz.sharedOptions) {
            var raw = index + 1;
            return question.reverse ? (quiz.sharedOptions.length + 1) - raw : raw;
        }
        var opt = (question.options || [])[index];
        return opt && typeof opt.score === 'number' ? opt.score : 0;
    }

    function maxPointsFor(quiz, question) {
        if (quiz.sharedOptions) return quiz.sharedOptions.length;
        if (quiz.perQuestionMax) return quiz.perQuestionMax;
        return (question.options || []).reduce(function (m, o) {
            return typeof o.score === 'number' ? Math.max(m, o.score) : m;
        }, 0);
    }

    // --- likert-total: one overall percentage -----------------------------
    function scoreTotal(quiz, answers) {
        var total = 0;
        var max = 0;
        quiz.questions.forEach(function (q, i) {
            total += pointsFor(quiz, q, answers[i]);
            max += maxPointsFor(quiz, q);
        });
        return { totalScore: total, maxScore: max, percentage: max ? (total / max) * 100 : 0 };
    }

    // --- domain scorers: overall percentage + per-domain breakdown --------
    function scoreDomains(quiz, answers) {
        var scores = {};
        var maxes = {};
        var order = [];

        quiz.questions.forEach(function (q, i) {
            var d = q.domain;
            if (!d) return;
            if (!(d in scores)) { scores[d] = 0; maxes[d] = 0; order.push(d); }
            scores[d] += pointsFor(quiz, q, answers[i]);
            maxes[d] += maxPointsFor(quiz, q);
        });

        var total = order.reduce(function (a, d) { return a + scores[d]; }, 0);
        var max = order.reduce(function (a, d) { return a + maxes[d]; }, 0);

        return {
            totalScore: total,
            maxScore: max,
            percentage: max ? (total / max) * 100 : 0,
            domains: order.map(function (d) {
                return {
                    name: d,
                    score: scores[d],
                    max: maxes[d],
                    percentage: maxes[d] ? (scores[d] / maxes[d]) * 100 : 0
                };
            })
        };
    }

    // --- dominant domain: which pattern(s) is this person actually in? -----
    //     Used by the `dominant-domain` widget. Kept pure and separate from
    //     the scorer because the arithmetic is still plain scoreDomains() -
    //     only the *reading* of the result is new: the highest domain picks
    //     which action plan to show.
    //
    //     opts.within  - a domain within this many percentage points of the
    //                    top one counts as co-dominant ("you can have more
    //                    than one type at the same time").
    //     opts.floor   - below this percentage nothing is dominant enough to
    //                    act on, so no plan is shown at all.
    //     opts.limit   - cap on how many plans to surface.
    function dominantDomains(domains, opts) {
        var o = opts || {};
        var within = typeof o.within === 'number' ? o.within : 0;
        var floor = typeof o.floor === 'number' ? o.floor : 0;
        var limit = typeof o.limit === 'number' ? o.limit : Infinity;
        if (!domains || !domains.length) return [];

        var sorted = domains.slice().sort(function (a, b) { return b.percentage - a.percentage; });
        var top = sorted[0].percentage;
        if (top <= floor) return [];

        return sorted.filter(function (d) {
            return d.percentage >= top - within && d.percentage > floor;
        }).slice(0, limit);
    }

    // --- tally-option: count how often each option's profile KEY was chosen.
    //     Spirit Animal / Mood Check options carry the key ('Bear', 'Calm')
    //     separately from their display text; that key indexes quiz.profiles.
    function tallyOptions(quiz, answers) {
        var counts = {};
        quiz.questions.forEach(function (q, i) {
            var opt = (q.options || [])[answers[i]];
            if (!opt) return;
            var key = opt.key || opt.text;
            counts[key] = (counts[key] || 0) + 1;
        });
        var sorted = Object.keys(counts)
            .map(function (k) { return { name: k, value: counts[k] }; })
            .sort(function (a, b) { return b.value - a.value; });
        var total = sorted.reduce(function (a, r) { return a + r.value; }, 0);
        sorted.forEach(function (r) { r.percentage = total ? (r.value / total) * 100 : 0; });
        return sorted;
    }

    // --- tally-word-list: Social Type. First list containing the chosen
    //     word wins, preserving categorizeSocialType()'s lookup order. -----
    function tallyWordLists(quiz, answers) {
        var cats = Object.keys(quiz.wordLists);
        var counts = {};
        cats.forEach(function (c) { counts[c] = 0; });

        quiz.questions.forEach(function (q, i) {
            var opt = (q.options || [])[answers[i]];
            if (!opt) return;
            for (var c = 0; c < cats.length; c++) {
                if (quiz.wordLists[cats[c]].indexOf(opt.text) !== -1) {
                    counts[cats[c]]++;
                    return;
                }
            }
        });

        var total = quiz.questions.length;
        return cats.map(function (c) {
            return { name: c, value: counts[c], percentage: total ? (counts[c] / total) * 100 : 0 };
        });
    }

    // --- tally-vark: keyword matching on the chosen option's text.
    //     Preserved verbatim from src/utils/categories.js so results match. -
    var VARK_KEYWORDS = {
        'Visual': ['Youtube', 'Ted Talks', 'illustrations', 'illustrative videos', 'Videos',
            'pictures', 'Picture', 'video', 'Watch', 'movie', 'Look at', 'Diagrams', 'charts', 'visual'],
        'Auditory': ['Podcasts', 'Audiobooks', 'audiobook', 'explains', 'Spell it out loud',
            'sounds right', 'Say the word', 'Listen', 'Discuss', 'spoken', 'Audio', 'Loud noises'],
        'Reading/Writing': ['Books', 'eBooks', 'Newspapers', 'Reading', 'Writing', 'Highlighting',
            'novel', 'Read', 'Write it down', 'reviews', 'Handouts', 'written', 'instructions'],
        'Kinesthetic': ['Social Gatherings', 'mindmap', 'Puzzles', 'Challenges', 'Trace the letters',
            'finger spelling', 'being with', 'Test-drive', 'Exercise', 'Practice', 'uncomfortable chair',
            'People walking', 'figure it out', 'Demonstrations', 'practical']
    };

    function categorizeVARK(text) {
        var order = ['Visual', 'Auditory', 'Reading/Writing', 'Kinesthetic'];
        for (var i = 0; i < order.length; i++) {
            var words = VARK_KEYWORDS[order[i]];
            for (var w = 0; w < words.length; w++) {
                if (text.indexOf(words[w]) !== -1) return order[i];
            }
        }
        return null;
    }

    function tallyVARK(quiz, answers) {
        var counts = {};
        quiz.categories.forEach(function (c) { counts[c] = 0; });
        quiz.questions.forEach(function (q, i) {
            var opt = (q.options || [])[answers[i]];
            if (!opt) return;
            var cat = categorizeVARK(opt.text);
            if (cat) counts[cat]++;
        });
        var total = quiz.questions.length;
        return quiz.categories.map(function (c) {
            return { name: c, value: counts[c], percentage: total ? (counts[c] / total) * 100 : 0 };
        });
    }

    // --- binary-index: option 0 = pole A, option 1 = pole B ---------------
    function tallyPoles(quiz, answers) {
        var counts = [0, 0];
        quiz.questions.forEach(function (q, i) {
            if (answers[i] === 0) counts[0]++;
            else if (answers[i] === 1) counts[1]++;
        });
        var total = quiz.questions.length;
        return quiz.poles.map(function (name, i) {
            return { name: name, value: counts[i], percentage: total ? (counts[i] / total) * 100 : 0 };
        });
    }

    function poleBand(quiz, data) {
        for (var i = 0; i < quiz.bands.length; i++) {
            var b = quiz.bands[i];
            if (b.poleAbove === undefined) return b;
            if (data[b.poleAbove].percentage > b.threshold) return b;
        }
        return quiz.bands[quiz.bands.length - 1];
    }

    // --- answer-key-categories: IQ -----------------------------------------
    function scoreAnswerKey(quiz, answers) {
        var correct = {};
        var totals = {};
        var order = [];

        quiz.questions.forEach(function (q, i) {
            var c = q.category;
            if (!(c in totals)) { correct[c] = 0; totals[c] = 0; order.push(c); }
            totals[c]++;
            var opt = (q.options || [])[answers[i]];
            if (opt && opt.correct) correct[c]++;
        });

        var totalCorrect = order.reduce(function (a, c) { return a + correct[c]; }, 0);
        var totalQuestions = quiz.questions.length;
        var percentage = totalQuestions ? (totalCorrect / totalQuestions) * 100 : 0;

        return {
            totalScore: totalCorrect,
            maxScore: totalQuestions,
            percentage: percentage,
            estimatedIQ: Math.round(quiz.iqScale.base + (percentage / 100) * quiz.iqScale.range),
            domains: order.map(function (c) {
                return {
                    name: (quiz.categoryLabels && quiz.categoryLabels[c]) || c,
                    value: correct[c],
                    score: correct[c],
                    max: totals[c],
                    percentage: totals[c] ? (correct[c] / totals[c]) * 100 : 0
                };
            })
        };
    }

    // --- study-plan: ported from generateStudyPlan() ------------------------
    function tagsFor(quiz, answers) {
        return quiz.questions.map(function (q, i) {
            var opt = (q.options || [])[answers[i]];
            return opt ? opt.tag : null;
        });
    }

    function generateStudyPlan(quiz, answers) {
        var t = tagsFor(quiz, answers);
        var subject = t[0], learningStyle = t[4], dailyTime = t[5],
            examDistance = t[6], forgetSpeed = t[3], practiceLevel = t[8];

        var revisionFrequency;
        if (forgetSpeed === 'fast_forget') revisionFrequency = 'You forget quickly — revise within the SAME DAY (evening review of morning study). Then again after 1 day, 3 days, 7 days, and 21 days.';
        else if (forgetSpeed === 'medium_forget') revisionFrequency = 'Revise after 1 day, then after 3 days, then weekly. The 1-3-7-21 spacing works well for your forgetting rate.';
        else if (forgetSpeed === 'slow_forget') revisionFrequency = 'You retain reasonably well. Revise after 3 days, then weekly, then monthly. Focus revision time on practice rather than re-reading.';
        else if (forgetSpeed === 'exam_forget') revisionFrequency = "You're losing knowledge over time because of insufficient long-term revision. Add a 15-min weekly review of ALL past topics, not just recent ones.";
        else revisionFrequency = 'Your retention is strong. Maintain it with monthly quick reviews and focus your energy on deeper application and harder problems.';

        var practiceAdvice;
        if (practiceLevel === 'no_practice') practiceAdvice = 'Critical gap: You MUST add active practice. Knowledge without application is like learning swimming from a book. Start with 20 min of practice daily.';
        else if (practiceLevel === 'give_up') practiceAdvice = 'When stuck, spend 5 more minutes trying before checking the answer. Then study the solution, close it, and redo it. Struggle is where learning happens.';
        else if (practiceLevel === 'partial_practice') practiceAdvice = 'Good foundation! Now push into harder problems. Spend 60% time on medium difficulty, 30% on hard, 10% on easy (for confidence).';
        else if (practiceLevel === 'careless') practiceAdvice = 'Your knowledge is there but execution needs refinement. Slow down, write neatly, double-check key steps. Keep an error log of careless mistakes.';
        else practiceAdvice = 'Excellent practice habits! Challenge yourself with competition-level or cross-topic problems to reach mastery.';

        var encodingAdvice;
        if (learningStyle === 'visual') encodingAdvice = 'Use diagrams, color-coding, mind maps, and videos heavily. Draw concepts from memory. Convert text into visual formats.';
        else if (learningStyle === 'auditory') encodingAdvice = 'Record yourself explaining concepts and listen back. Discuss with study partners. Use podcasts and verbal self-quizzing.';
        else if (learningStyle === 'writing') encodingAdvice = 'Write detailed notes in your own words. Summarize chapters into 1-page sheets. Rewrite key points from memory.';
        else if (learningStyle === 'kinesthetic') encodingAdvice = 'Practice physically: type code, solve on paper, do experiments, walk while revising. Your body needs to be involved.';
        else encodingAdvice = 'Create stories, analogies, and wild associations. Link new concepts to things you already know through creative connections.';

        var timeAdvice;
        if (dailyTime === 'time_low') timeAdvice = 'With limited time, use ONLY active recall and practice. Skip re-reading entirely. 25 min focused practice > 2 hours of passive reading.';
        else if (dailyTime === 'time_medium') timeAdvice = 'Split: 20 min learning new material + 20 min practice + 10 min revision of older topics. Every single day.';
        else if (dailyTime === 'time_good') timeAdvice = 'Split: 40 min new material + 40 min active practice + 20 min spaced revision. Include 5-min breaks every 25 min.';
        else timeAdvice = 'You have good time. Use Pomodoro (25 min work + 5 min break). Alternate: concept study → practice → revision → concept study.';

        var urgency = null;
        if (examDistance === 'exam_urgent') urgency = '⚡ Your exam is very close! Focus on high-yield topics, practice past papers, and revise your strongest material first.';
        else if (examDistance === 'exam_soon') urgency = '⏰ Exam approaching! Prioritize active practice and revision over learning new topics.';

        return {
            strategy: quiz.strategies[subject],
            revisionFrequency: revisionFrequency,
            practiceAdvice: practiceAdvice,
            encodingAdvice: encodingAdvice,
            timeAdvice: timeAdvice,
            urgency: urgency,
            struggle: t[1],
            examDistance: examDistance
        };
    }

    // --- one entry point the results view calls ---------------------------
    function scoreQuiz(quiz, answers) {
        switch (quiz.scorer) {
            case 'likert-total': {
                var r = scoreTotal(quiz, answers);
                r.band = bandFor(quiz.bands, r.percentage);
                if (quiz.levels && r.band.key) r.level = quiz.levels[r.band.key];
                return r;
            }
            case 'likert-domains':
            case 'score-domains': {
                var d = scoreDomains(quiz, answers);
                d.band = bandFor(quiz.bands, d.percentage);
                return d;
            }
            case 'scores-array-domains': {
                var e = scoreDomains(quiz, answers);
                e.band = bandFor(quiz.bands, e.percentage);
                return e;
            }
            case 'answer-key-categories': {
                var iq = scoreAnswerKey(quiz, answers);
                iq.band = bandFor(quiz.bands, iq.percentage, iq.estimatedIQ);
                return iq;
            }
            case 'tally-option': {
                var t = tallyOptions(quiz, answers);
                return { chart: t, top: t[0], secondary: t[1] || null };
            }
            case 'tally-word-list':
                return { chart: tallyWordLists(quiz, answers) };
            case 'tally-vark':
                return { chart: tallyVARK(quiz, answers) };
            case 'binary-index': {
                var p = tallyPoles(quiz, answers);
                return { chart: p, band: poleBand(quiz, p) };
            }
            case 'study-plan':
                return { plan: generateStudyPlan(quiz, answers) };
            default:
                throw new Error('unknown scorer: ' + quiz.scorer);
        }
    }

    // =====================================================================
    // 6. RESULT WIDGETS - hand-rolled SVG, replacing recharts
    // =====================================================================

    var CHART_COLORS = ['#1E5EFF', '#34A853', '#FF6B00', '#6A3DE8', '#FFC107', '#E53935'];

    // Donut chart. Built from stroke-dasharray arcs on concentric circles so
    // there are no path-arc edge cases at 0% or 100%.
    function donutChart(data, size) {
        size = size || 280;
        var r = size / 2 - 26;
        var c = 2 * Math.PI * r;
        var offset = 0;

        var arcs = data.map(function (d, i) {
            var len = (d.percentage / 100) * c;
            var el = svg('circle', {
                cx: size / 2, cy: size / 2, r: r,
                fill: 'none',
                stroke: CHART_COLORS[i % CHART_COLORS.length],
                'stroke-width': 38,
                'stroke-dasharray': len + ' ' + (c - len),
                'stroke-dashoffset': -offset,
                transform: 'rotate(-90 ' + (size / 2) + ' ' + (size / 2) + ')'
            });
            offset += len;
            return el;
        });

        var chart = svg('svg', {
            width: '100%', viewBox: '0 0 ' + size + ' ' + size,
            role: 'img', 'aria-label': data.map(function (d) {
                return d.name + ' ' + d.percentage.toFixed(0) + '%';
            }).join(', ')
        }, [svg('circle', {
            cx: size / 2, cy: size / 2, r: r, fill: 'none',
            stroke: '#eef1f6', 'stroke-width': 38
        })].concat(arcs));

        var legend = h('ul', { class: 'chart-legend' }, data.map(function (d, i) {
            return h('li', {}, [
                h('span', { class: 'chart-legend-dot', style: 'background:' + CHART_COLORS[i % CHART_COLORS.length] }),
                h('span', { class: 'chart-legend-name', text: d.name }),
                h('span', { class: 'chart-legend-value', text: d.percentage.toFixed(1) + '%' })
            ]);
        }));

        return h('div', { class: 'chart-container' }, [
            h('div', { class: 'chart-svg-wrap' }, [chart]), legend
        ]);
    }

    // Progress ring with a percentage in the middle.
    function scoreRing(percentage, color, caption, size) {
        size = size || 180;
        var r = size / 2 - 15;
        var c = 2 * Math.PI * r;
        var len = (percentage / 100) * c;

        return h('div', { class: 'score-ring', style: 'width:' + size + 'px;height:' + size + 'px' }, [
            svg('svg', { width: size, height: size, viewBox: '0 0 ' + size + ' ' + size }, [
                svg('circle', { cx: size / 2, cy: size / 2, r: r, fill: 'none', stroke: '#e0e0e0', 'stroke-width': 12 }),
                svg('circle', {
                    cx: size / 2, cy: size / 2, r: r, fill: 'none', stroke: color,
                    'stroke-width': 12, 'stroke-linecap': 'round',
                    'stroke-dasharray': len + ' ' + c,
                    transform: 'rotate(-90 ' + (size / 2) + ' ' + (size / 2) + ')'
                })
            ]),
            h('div', { class: 'score-ring-label' }, [
                h('div', { class: 'score-ring-pct', style: 'color:' + color, text: percentage.toFixed(0) + '%' }),
                caption ? h('div', { class: 'score-ring-caption', text: caption }) : null
            ])
        ]);
    }

    // Horizontal bars, one per domain, coloured by the domain's own token.
    function domainBars(domains, lookup, domainBands) {
        return h('div', { class: 'domain-list' }, domains.map(function (d) {
            var meta = (lookup && lookup[d.name]) || {};
            var color = meta.color || '#1E5EFF';
            var key = domainBands ? bandFor(domainBands, d.percentage).key : null;
            var note = key && meta[key] ? meta[key] : null;

            return h('div', { class: 'domain-row' }, [
                h('div', { class: 'domain-head' }, [
                    h('span', { class: 'domain-name' }, [
                        meta.emoji ? h('span', { class: 'domain-emoji', text: meta.emoji }) : null,
                        h('span', { text: meta.label || d.name })
                    ]),
                    h('span', { class: 'domain-pct', style: 'color:' + color, text: d.percentage.toFixed(0) + '%' })
                ]),
                h('div', { class: 'domain-track' }, [
                    h('div', {
                        class: 'domain-fill',
                        style: 'width:' + d.percentage + '%;background:' + color
                    })
                ]),
                note ? h('p', { class: 'domain-note', text: note }) : null,
                meta.reframe ? h('p', { class: 'domain-reframe' }, [
                    h('strong', { text: 'Reframe: ' }), document.createTextNode(meta.reframe)
                ]) : null,
                meta.fix ? h('p', { class: 'domain-reframe' }, [
                    h('strong', { text: 'Fix: ' }), document.createTextNode(meta.fix)
                ]) : null
            ]);
        }));
    }

    // =====================================================================
    // 7. CONFETTI - same DOM-based approach as script.js's playConfetti()
    // =====================================================================

    function playConfetti() {
        var container = document.getElementById('confetti-container');
        if (!container) return;

        var colors = ['#FF6B00', '#FFC107', '#34A853', '#1E5EFF', '#ff5e3a'];
        var pieces = [];

        for (var i = 0; i < 100; i++) {
            var piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.position = 'absolute';
            piece.style.left = (Math.random() * 100) + '%';
            piece.style.top = '-10px';
            piece.style.background = colors[Math.floor(Math.random() * colors.length)];
            var size = Math.random() * 7 + 8;
            piece.style.width = size + 'px';
            piece.style.height = size + 'px';
            piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
            piece.style.animationDelay = (Math.random() * 2) + 's';
            piece.style.animationDuration = (Math.random() * 1.5 + 2.5) + 's';
            container.appendChild(piece);
            pieces.push(piece);
        }

        setTimeout(function () {
            pieces.forEach(function (p) { if (p.parentNode) p.parentNode.removeChild(p); });
        }, 5000);
    }

    // =====================================================================
    // 8. RESULT DOWNLOAD - SVG -> canvas -> PNG, replacing html-to-image
    // =====================================================================

    function downloadResultCard(cardEl, fileName) {
        var width = 900;
        var scale = 2;
        // Clone so the off-screen copy can be laid out at a fixed width
        // without disturbing the live card.
        var clone = cardEl.cloneNode(true);
        clone.style.width = width + 'px';
        clone.style.margin = '0';
        clone.style.boxShadow = 'none';

        var holder = h('div', {
            style: 'position:fixed;left:-10000px;top:0;width:' + width + 'px;background:#ffffff;padding:24px;'
        }, [clone]);
        document.body.appendChild(holder);

        var height = holder.offsetHeight;
        var serialized = new XMLSerializer().serializeToString(
            buildForeignObject(holder, width, height)
        );

        var img = new Image();
        img.onload = function () {
            var canvas = document.createElement('canvas');
            canvas.width = width * scale;
            canvas.height = height * scale;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            document.body.removeChild(holder);

            canvas.toBlob(function (blob) {
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
            }, 'image/png');
        };
        img.onerror = function () {
            document.body.removeChild(holder);
            showProtectionAlert('Could not generate the image. Try a screenshot instead.');
        };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(serialized);
    }

    // Wrap live DOM in an SVG <foreignObject> so the browser rasterises it.
    // Styles must be inlined - the SVG image is loaded in an isolated context
    // that cannot reach quiz.css.
    function buildForeignObject(node, width, height) {
        inlineStyles(node);

        var wrapper = svg('svg', {
            xmlns: 'http://www.w3.org/2000/svg',
            width: width, height: height, viewBox: '0 0 ' + width + ' ' + height
        });
        var fo = svg('foreignObject', { x: 0, y: 0, width: width, height: height });
        var div = document.createElement('div');
        div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');

        // `node` is the measuring holder, parked off-screen with
        // `position:fixed; left:-10000px` so it can be laid out without being
        // seen - and inlineStyles() has just baked that into its style
        // attribute. Inside a foreignObject there is no page to be off-screen
        // *from*: the fixed box is simply laid out 10,000px to the left of the
        // SVG viewport, so every pixel of the rasterised PNG is the blank
        // white fill and nothing else. Pin the embedded copy back to the
        // origin. (Symptom when this regresses: the download works, the file
        // is the right size, and the image is entirely white.)
        var copy = node.cloneNode(true);
        copy.style.position = 'static';
        copy.style.left = 'auto';
        copy.style.top = 'auto';
        copy.style.right = 'auto';
        copy.style.bottom = 'auto';

        div.appendChild(copy);
        fo.appendChild(div);
        wrapper.appendChild(fo);
        return wrapper;
    }

    var INLINE_PROPS = ['color', 'background-color', 'background', 'font-family', 'font-size',
        'font-weight', 'line-height', 'text-align', 'padding', 'margin', 'border', 'border-radius',
        'display', 'width', 'height', 'box-sizing', 'flex-direction', 'align-items',
        'justify-content', 'gap', 'overflow', 'position', 'stroke', 'fill', 'stroke-width',
        // Offsets and transform travel with `position` or absolutely positioned
        // children land at their static position instead - .score-ring-label is
        // centred inside the ring with top/left 50% + a translate(-50%, -50%).
        'top', 'left', 'right', 'bottom', 'transform', 'transform-origin',
        'letter-spacing', 'white-space', 'flex-wrap', 'font-style'];

    function inlineStyles(root) {
        var all = [root].concat(Array.prototype.slice.call(root.querySelectorAll('*')));
        all.forEach(function (el) {
            var cs = window.getComputedStyle(el);
            // The rasteriser loads the SVG in an isolated context that has no
            // access to the page's webfonts, so text re-wraps at different
            // widths than it did on screen. Freezing a text box at the exact
            // width/height it happened to have then makes the extra line
            // overflow its own box - which is how the domain bars ended up
            // drawn through their own labels. So: boxes that carry text get
            // that measurement as a *minimum* and are allowed to grow, while
            // boxes with no text of their own (the ring, the bar track and
            // its fill) keep the exact size the design depends on.
            var pins = /\S/.test(el.textContent || '') ? SOFT_SIZE : HARD_SIZE;
            var out = [];
            INLINE_PROPS.forEach(function (p) {
                var v = cs.getPropertyValue(p);
                if (!v) return;
                out.push((pins[p] || p) + ':' + v);
            });
            el.setAttribute('style', out.join(';') + ';' + (el.getAttribute('style') || ''));

            // The element's own inline style is appended last, so an inline
            // width/height set by a widget (or by downloadResultCard sizing
            // the clone) would win over the min-* above and re-pin the box.
            // Drop it on text boxes only; text-free boxes keep theirs, which
            // is how .domain-fill carries its `width: <pct>%`.
            if (pins === SOFT_SIZE) {
                el.style.width = '';
                el.style.height = '';
            }
        });
    }

    var HARD_SIZE = {};
    var SOFT_SIZE = { width: 'min-width', height: 'min-height' };

    // =====================================================================
    // 9. SHARED DIALOG
    // =====================================================================

    var dialogConfirm = null;

    function openDialog(onConfirm) {
        var el = dialogEl();
        if (!el) return;
        dialogConfirm = onConfirm;
        el.hidden = false;
    }

    function closeDialog() {
        var el = dialogEl();
        if (el) el.hidden = true;
        dialogConfirm = null;
    }

    // Delegated from document so the handler survives if the shell markup is
    // ever re-rendered.
    document.addEventListener('click', function (e) {
        var el = dialogEl();
        if (!el || el.hidden || !el.contains(e.target)) return;
        if (e.target.hasAttribute('data-dialog-cancel')) closeDialog();
        if (e.target.hasAttribute('data-dialog-confirm')) {
            var fn = dialogConfirm;
            closeDialog();
            if (fn) fn();
        }
    });

    document.addEventListener('keydown', function (e) {
        var el = dialogEl();
        if (e.key === 'Escape' && el && !el.hidden) closeDialog();
    });

    // =====================================================================
    // 10. VIEWS
    // =====================================================================

    function go(hash) { window.location.hash = hash; }

    function errorView(message) {
        return h('div', { class: 'quiz-error' }, [
            h('h2', { text: 'Something went wrong' }),
            h('p', { text: message }),
            h('button', { class: 'nav-button', onclick: function () { go('#/'); } }, ['Back to Home'])
        ]);
    }

    // --- Home -------------------------------------------------------------
    function homeView(data) {
        var sections = data.sections.map(function (section) {
            return h('div', { class: 'quiz-section' }, [
                h('h3', { class: 'quiz-section-title', text: section.title }),
                h('div', { class: 'quiz-grid' }, section.quizzes.map(function (q) {
                    return h('button', {
                        class: 'quiz-button',
                        onclick: function () { go('#/username/' + q.id); }
                    }, [
                        h('span', { class: 'quiz-button-label', text: q.emoji + ' ' + q.label }),
                        h('span', { class: 'quiz-button-subtitle', text: q.subtitle })
                    ]);
                }))
            ]);
        });

        var toolButtons = TOOLS.map(function (t) {
            return h('button', {
                class: 'quiz-button about-button',
                onclick: function () { go('#/tools/' + t.id); }
            }, [
                h('span', { class: 'quiz-button-label', text: t.emoji + ' ' + t.label }),
                h('span', { class: 'quiz-button-subtitle', text: t.subtitle })
            ]);
        });

        toolButtons.push(h('button', {
            class: 'quiz-button about-button',
            onclick: function () { go('#/about'); }
        }, [
            h('span', { class: 'quiz-button-label', text: 'ℹ️ About These Quizzes' }),
            h('span', { class: 'quiz-button-subtitle', text: 'Learn more about each assessment' })
        ]));

        return h('div', { class: 'home-container' }, [
            h('div', { class: 'home-content' }, [
                h('div', { class: 'home-left' }, [
                    h('div', { class: 'profile-card' }, [
                        h('div', { class: 'profile-header', text: 'Super Learner Academy' }),
                        h('div', { class: 'profile-image' }, [
                            h('img', {
                                src: 'Images/Logo.png', alt: 'Super Learner Academy Logo',
                                width: 280, height: 280, fetchpriority: 'high'
                            })
                        ])
                    ]),
                    h('div', { class: 'social-icons' }, [
                        ['https://www.instagram.com/abhishek_ranjan_mnnit/', 'fa-instagram', 'Instagram'],
                        ['https://www.youtube.com/@RanjanNotes', 'fa-youtube', 'YouTube'],
                        ['https://www.facebook.com/Ranjan705', 'fa-facebook', 'Facebook']
                    ].map(function (s) {
                        return h('a', {
                            href: s[0], target: '_blank', rel: 'noopener noreferrer',
                            class: 'social-icon-link', 'aria-label': s[2]
                        }, [h('i', { class: 'fab ' + s[1] + ' social-icon' })]);
                    })),
                    h('a', { class: 'home-workshop-link', href: 'index.html' }, [
                        h('span', { text: '🎓 Join the 3-Day Live Workshop' }),
                        h('small', { text: 'Study smarter, score higher' })
                    ])
                ]),
                h('div', { class: 'home-right' }, [
                    h('h1', { class: 'quiz-title', text: 'Know Yourself Better' })
                ].concat(quotesCarousel(), sections, toolButtons))
            ])
        ]);
    }

    // --- Quotes carousel (reads the existing quotes.json at the repo root) -
    function quotesCarousel() {
        var card = h('div', { class: 'quote-card' }, [
            h('p', { class: 'quote-text', text: '"The beautiful thing about learning is that nobody can take it away from you."' }),
            h('span', { class: 'quote-author', text: '— B.B. King' })
        ]);
        var bar = h('div', { class: 'quote-progress-bar' });
        var wrap = h('div', { class: 'quotes-carousel' }, [
            card, h('div', { class: 'quote-progress' }, [bar])
        ]);

        fetch('quotes.json').then(function (r) { return r.json(); }).then(function (data) {
            var list = Array.isArray(data) ? data : (data.quotes || []);
            if (!list.length) return;
            var i = Math.floor(Math.random() * list.length);

            function show() {
                var q = list[i % list.length];
                card.firstChild.textContent = '"' + (q.text || q.quote) + '"';
                card.lastChild.textContent = '— ' + (q.author || 'Unknown');
                // restart the progress animation
                bar.style.animation = 'none';
                void bar.offsetWidth;
                bar.style.animation = '';
                i++;
            }

            show();
            var timer = setInterval(function () {
                if (!document.body.contains(wrap)) { clearInterval(timer); return; }
                show();
            }, 8000);
        }).catch(function () { /* keep the static fallback quote */ });

        return [wrap];
    }

    // --- Username gate ----------------------------------------------------
    function usernameView(meta) {
        var input = h('input', {
            type: 'text', id: 'name', placeholder: 'Enter your name',
            autocomplete: 'given-name', required: 'required'
        });

        var form = h('form', {
            class: 'username-form',
            onsubmit: function (e) {
                e.preventDefault();
                var name = input.value.trim();
                if (!name) return;
                writeState({ userName: name, quizId: meta.id, answers: [] });
                go('#/quiz/' + meta.id);
            }
        }, [
            h('div', { class: 'form-group' }, [
                h('label', { for: 'name', text: "What's your name?" }), input
            ]),
            h('button', { type: 'submit', class: 'submit-button', text: 'Start Quiz' })
        ]);

        setTimeout(function () { input.focus(); }, 50);

        return h('div', { class: 'username-container' }, [
            h('div', { class: 'username-card' }, [
                h('h2', { text: meta.title }),
                h('p', { class: 'username-meta', text: meta.questions + ' questions · about ' + Math.max(2, Math.round(meta.questions * 0.25)) + ' min' }),
                form,
                h('button', {
                    class: 'back-home-button', onclick: function () { go('#/'); }, text: '← Back to all assessments'
                })
            ])
        ]);
    }

    // --- Quiz runner ------------------------------------------------------
    function quizView(quiz) {
        var state = readState();
        var answers = (state.quizId === quiz.id && state.answers) || [];
        var current = 0;

        // Resume at the first unanswered question.
        while (current < quiz.questions.length &&
               answers[current] !== null && answers[current] !== undefined) {
            current++;
        }
        if (current >= quiz.questions.length) current = quiz.questions.length - 1;

        var host = h('div', { class: 'quiz-container' });
        var advanceTimer = null;

        function persist() {
            writeState({ quizId: quiz.id, answers: answers });
        }

        function draw() {
            var q = quiz.questions[current];
            var opts = optionsFor(quiz, q);
            var total = quiz.questions.length;
            var progress = ((current + 1) / total) * 100;

            var list = h('ul', { class: 'options-list' }, opts.map(function (o, idx) {
                var selected = answers[current] === idx;
                return h('li', {
                    class: 'option-item' + (selected ? ' is-selected' : ''),
                    role: 'radio',
                    tabindex: '0',
                    'aria-checked': selected ? 'true' : 'false',
                    onclick: function () { choose(idx); },
                    onkeydown: function (e) {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(idx); }
                    }
                }, [
                    h('span', { class: 'option-marker', text: String.fromCharCode(65 + idx) }),
                    h('span', { class: 'option-text', text: o.text })
                ]);
            }));

            var nextBtn = h('button', {
                class: 'nav-button',
                disabled: answers[current] === null || answers[current] === undefined,
                onclick: function () {
                    clearTimeout(advanceTimer);
                    if (current < total - 1) { current++; draw(); }
                    else { persist(); go('#/results/' + quiz.id); }
                },
                text: current === total - 1 ? 'Submit' : 'Next'
            });

            host.innerHTML = '';
            host.appendChild(h('div', { class: 'quiz-header' }, [
                h('div', { class: 'quiz-title-small', text: 'Question ' + (current + 1) + ' of ' + total }),
                h('div', { class: 'question-counter', text: (current + 1) + '/' + total }),
                h('div', { class: 'quiz-progress-track' }, [
                    h('div', {
                        class: 'quiz-progress-fill',
                        style: 'width:' + progress + '%',
                        role: 'progressbar',
                        'aria-valuenow': Math.round(progress),
                        'aria-valuemin': '0', 'aria-valuemax': '100'
                    })
                ])
            ]));
            host.appendChild(h('div', { class: 'quiz-body' }, [
                h('div', { class: 'question-section' }, [
                    h('h3', { class: 'question-text', text: q.text }),
                    h('div', { class: 'options-group', role: 'radiogroup', 'aria-label': q.text }, [list]),
                    h('div', { class: 'quiz-navigation' }, [
                        h('button', {
                            class: 'nav-button',
                            disabled: current === 0,
                            onclick: function () {
                                clearTimeout(advanceTimer);
                                if (current > 0) { current--; draw(); }
                            },
                            text: 'Back'
                        }),
                        nextBtn
                    ])
                ])
            ]));

            function choose(idx) {
                var answeredAt = current;
                answers[current] = idx;
                persist();
                draw();
                // Advance automatically so the quiz feels quick, but stop on
                // the last question so Submit stays a deliberate tap.
                if (current < total - 1) {
                    clearTimeout(advanceTimer);
                    advanceTimer = setTimeout(function () {
                        // Only advance if the user has not navigated away in
                        // the meantime (e.g. tapped Back straight after).
                        if (current !== answeredAt) return;
                        current++;
                        draw();
                    }, 180);
                }
            }
        }

        draw();
        return host;
    }

    // --- Results ----------------------------------------------------------
    function resultsView(quiz) {
        var state = readState();
        var answers = state.answers || [];
        var userName = state.userName || '';

        if (state.quizId !== quiz.id || !answers.length) {
            return errorView('No answers found for this assessment. Please take it again.');
        }

        var result = scoreQuiz(quiz, answers);
        var card = h('div', { class: 'result-card' });

        switch (quiz.widget) {
            case 'ring': renderRing(card, quiz, result, userName); break;
            case 'ring-domains': renderRingDomains(card, quiz, result, userName); break;
            case 'pie': renderPie(card, quiz, result, userName); break;
            case 'pie-band': renderPieBand(card, quiz, result, userName); break;
            case 'score-domains': renderScoreDomains(card, quiz, result, userName); break;
            case 'dominant-domain': renderDominantDomain(card, quiz, result, userName); break;
            case 'profile': renderProfile(card, quiz, result, userName); break;
            case 'plan': renderPlan(card, quiz, result, userName); break;
            default: card.appendChild(h('p', { text: 'Unsupported result type.' }));
        }

        var actions = h('div', { class: 'result-actions' }, [
            h('button', {
                class: 'download-button',
                onclick: function () {
                    var safe = (userName || 'my').replace(/\s+/g, '_').replace(/[^\w-]/g, '');
                    downloadResultCard(card, safe + '_' + quiz.id + '_results.png');
                },
                text: 'Download as Image'
            }),
            h('button', {
                class: 'download-button download-button-solid',
                onclick: function () {
                    openDialog(function () { clearAnswers(); go('#/'); });
                },
                text: 'Return to Home'
            })
        ]);

        setTimeout(playConfetti, 120);

        return h('div', { class: 'results-container' }, [
            h('h1', { class: 'results-title', text: quiz.resultsTitle }),
            h('div', { class: 'results-divider' }),
            card,
            actions
        ]);
    }

    function greeting(userName, suffix) {
        return userName ? userName + ', ' + suffix : suffix.charAt(0).toUpperCase() + suffix.slice(1);
    }

    function renderRing(card, quiz, r, userName) {
        var level = r.level || {};
        var color = level.color || r.band.color || '#1E5EFF';
        var label = level.label || r.band.label;
        var text = level.description || r.band.text;

        card.appendChild(scoreRing(r.percentage, color, quiz.resultsTitle.replace('Your ', '')));
        if (level.emoji) card.appendChild(h('div', { class: 'result-emoji', text: level.emoji }));
        card.appendChild(h('h2', { class: 'result-label', style: 'color:' + color, text: label }));
        if (userName) card.appendChild(h('p', { class: 'result-greeting', text: greeting(userName, 'here is where you stand right now.') }));
        if (text) card.appendChild(h('p', { class: 'result-text', text: text }));
        if (level.range) card.appendChild(h('p', { class: 'result-range', text: level.range }));

        if (level.tip) {
            card.appendChild(h('div', { class: 'result-tip' }, [
                h('h4', { text: '💡 Try this' }), h('p', { text: level.tip })
            ]));
        }
        if (level.steps && level.steps.length) {
            card.appendChild(h('div', { class: 'result-tip' }, [
                h('h4', { text: '✅ Your next steps' }),
                h('ul', {}, level.steps.map(function (s) { return h('li', { text: s }); }))
            ]));
        }
    }

    function renderRingDomains(card, quiz, r, userName) {
        var color = r.band.color || '#1E5EFF';
        card.appendChild(scoreRing(r.percentage, color, 'Overall'));
        card.appendChild(h('h2', { class: 'result-label', style: 'color:' + color, text: r.band.label }));
        if (userName) card.appendChild(h('p', { class: 'result-greeting', text: greeting(userName, 'here is your breakdown.') }));
        if (r.band.text) card.appendChild(h('p', { class: 'result-text', text: r.band.text }));
        card.appendChild(h('h3', { class: 'result-subhead', text: 'Domain Breakdown' }));
        card.appendChild(domainBars(r.domains, quiz.domains, quiz.domainBands));
    }

    function renderPie(card, quiz, r, userName) {
        card.appendChild(donutChart(r.chart));
        if (r.band) {
            card.appendChild(h('h2', { class: 'result-label', text: r.band.label }));
            if (userName) card.appendChild(h('p', { class: 'result-greeting', text: greeting(userName, 'here is what your answers show.') }));
            if (r.band.text) card.appendChild(h('p', { class: 'result-text', text: r.band.text }));
        } else if (userName) {
            card.appendChild(h('p', { class: 'result-greeting', text: greeting(userName, 'here is your profile.') }));
        }
    }

    function renderPieBand(card, quiz, r, userName) {
        var band = r.band;
        card.appendChild(scoreRing(r.percentage, band.color || '#1E5EFF', 'Overall'));
        card.appendChild(h('h2', { class: 'result-label', style: 'color:' + band.color, text: band.label }));
        if (userName) card.appendChild(h('p', { class: 'result-greeting', text: greeting(userName, 'here is your agility level.') }));
        if (band.text) card.appendChild(h('p', { class: 'result-text', text: band.text }));
    }

    // EQ and IQ: each area is scored independently, so the areas are shown as
    // bars. A pie would be misleading here - four independent 70% scores do
    // not divide a single whole between them.
    function renderScoreDomains(card, quiz, r, userName) {
        var band = r.band;
        var color = band.color || '#1E5EFF';

        if (r.estimatedIQ !== undefined) {
            card.appendChild(h('div', { class: 'result-bignum', style: 'color:' + color }, [
                h('span', { text: String(r.estimatedIQ) }),
                h('small', { text: 'estimated score · ' + r.totalScore + ' of ' + r.maxScore + ' correct' })
            ]));
        } else {
            card.appendChild(scoreRing(r.percentage, color, 'Overall'));
        }

        card.appendChild(h('h2', { class: 'result-label', style: 'color:' + color, text: band.label }));
        if (userName) card.appendChild(h('p', { class: 'result-greeting', text: greeting(userName, 'here is how you did.') }));
        if (band.text) card.appendChild(h('p', { class: 'result-text', text: band.text }));
        card.appendChild(h('h3', { class: 'result-subhead', text: 'Breakdown by Area' }));
        card.appendChild(domainBars(r.domains, quiz.domains, quiz.domainBands));
    }

    // Exhaustion check. Unlike the other domain widgets, the *highest* domain
    // is the answer here - it selects which action plan the student reads -
    // so the plan comes first and the four bars are the supporting detail.
    // Deliberately framed as a self-check, never a diagnosis: quiz.disclaimer
    // is rendered on the card itself, not just on the start screen.
    function renderDominantDomain(card, quiz, r, userName) {
        var band = r.band;
        var color = band.color || '#1E5EFF';
        var tops = dominantDomains(r.domains, {
            within: quiz.coDominantWithin,
            floor: quiz.dominantFloor,
            limit: quiz.maxDominant
        });

        card.appendChild(scoreRing(r.percentage, color, 'Overall load'));
        card.appendChild(h('h2', { class: 'result-label', style: 'color:' + color, text: band.label }));
        if (userName) card.appendChild(h('p', { class: 'result-greeting', text: greeting(userName, 'here is what your answers point to right now.') }));
        if (band.text) card.appendChild(h('p', { class: 'result-text', text: band.text }));

        if (tops.length) {
            card.appendChild(h('h3', {
                class: 'result-subhead',
                text: tops.length > 1 ? 'Your dominant patterns' : 'Your dominant pattern'
            }));
            tops.forEach(function (d) {
                var meta = (quiz.domains || {})[d.name] || {};
                var plan = (quiz.plans || {})[d.name];
                if (!plan) return;
                var pc = meta.color || color;

                card.appendChild(h('div', { class: 'plan-block', style: '--plan-color:' + pc }, [
                    h('div', { class: 'plan-head' }, [
                        meta.emoji ? h('span', { class: 'plan-emoji', text: meta.emoji }) : null,
                        h('span', { class: 'plan-title', text: meta.label || d.name }),
                        h('span', { class: 'plan-score', text: d.score + ' / ' + d.max })
                    ]),
                    h('p', { class: 'plan-lead', text: plan.lead }),
                    plan.sequence ? h('p', { class: 'plan-sequence', text: plan.sequence }) : null,
                    plan.do && plan.do.length ? h('ul', { class: 'plan-do' }, plan.do.map(function (t) {
                        return h('li', { text: t });
                    })) : null,
                    plan.avoid ? h('p', { class: 'plan-avoid' }, [
                        h('strong', { text: 'Don’t start with: ' }), document.createTextNode(plan.avoid)
                    ]) : null,
                    plan.rule ? h('p', { class: 'plan-rule', text: plan.rule }) : null
                ]));
            });
        } else {
            card.appendChild(h('p', { class: 'result-text', text: 'No single pattern is standing out, and nothing is scoring high enough to need managing first. Go straight to the work.' }));
        }

        if (band.smallest) {
            card.appendChild(h('div', { class: 'result-tip' }, [
                h('h4', { text: '⭐ ' + (quiz.reflection || 'The smallest useful thing right now') }),
                h('p', { text: band.smallest })
            ]));
        }

        card.appendChild(h('h3', { class: 'result-subhead', text: 'All four scores' }));
        card.appendChild(domainBars(r.domains, quiz.domains, quiz.domainBands));

        if (quiz.closing) {
            card.appendChild(h('div', { class: 'result-tip' }, [
                h('h4', { text: 'STOP → CHECK → CHOOSE → STUDY' }),
                h('ul', {}, (quiz.closing.steps || []).map(function (t) { return h('li', { text: t }); })),
                quiz.closing.line ? h('p', { class: 'plan-rule', text: quiz.closing.line }) : null
            ]));
        }

        if (quiz.disclaimer) {
            card.appendChild(h('p', { class: 'result-disclaimer', text: quiz.disclaimer }));
        }
    }

    function renderProfile(card, quiz, r, userName) {
        var profile = quiz.profiles[r.top.name] || {};
        var color = profile.color || '#1E5EFF';

        card.appendChild(h('div', { class: 'profile-hero', style: '--profile-color:' + color }, [
            h('div', { class: 'profile-hero-emoji', text: profile.emoji || '✨' })
        ]));
        card.appendChild(h('h2', {
            class: 'result-label', style: 'color:' + color,
            text: (userName ? userName + ', you are ' : 'You are ') + (profile.label || profile.name || r.top.name)
        }));
        if (profile.description) card.appendChild(h('p', { class: 'result-text', text: profile.description }));

        if (profile.traits && profile.traits.length) {
            card.appendChild(h('ul', { class: 'trait-list' }, profile.traits.map(function (t) {
                return h('li', { class: 'trait-chip', text: t });
            })));
        }
        if (profile.strengths) {
            card.appendChild(h('div', { class: 'result-tip' }, [
                h('h4', { text: '💪 Your strengths' }), h('p', { text: profile.strengths })
            ]));
        }
        if (profile.growthArea) {
            card.appendChild(h('div', { class: 'result-tip' }, [
                h('h4', { text: '🌱 Your growth area' }), h('p', { text: profile.growthArea })
            ]));
        }
        if (profile.forFacilitator) {
            card.appendChild(h('div', { class: 'result-tip' }, [
                h('h4', { text: '🎯 What this means for your learning' }),
                h('p', { text: profile.forFacilitator })
            ]));
        }

        // Secondary result, when the answers weren't unanimous
        if (r.secondary) {
            var sec = quiz.profiles[r.secondary.name] || {};
            card.appendChild(h('div', { class: 'result-secondary' }, [
                h('h4', { text: 'Your secondary type' }),
                h('p', {}, [
                    h('span', { class: 'domain-emoji', text: sec.emoji || '' }),
                    document.createTextNode(' ' + (sec.label || sec.name || r.secondary.name))
                ])
            ]));
        }

        card.appendChild(h('h3', { class: 'result-subhead', text: quiz.breakdownTitle || 'Your Breakdown' }));
        card.appendChild(donutChart(r.chart));
    }

    function renderPlan(card, quiz, r, userName) {
        var p = r.plan;
        var s = p.strategy || {};

        card.appendChild(h('div', { class: 'result-emoji', text: s.emoji || '🗺️' }));
        card.appendChild(h('h2', {
            class: 'result-label',
            text: (userName ? userName + "'s" : 'Your') + ' Personalized Strategy for ' + (s.title || 'Your Subject')
        }));
        card.appendChild(h('p', { class: 'result-greeting', text: "Based on your answers, here's exactly how you should study." }));

        if (p.urgency) {
            card.appendChild(h('div', { class: 'result-urgency', text: p.urgency }));
        }

        if (s.steps && s.steps.length) {
            card.appendChild(h('h3', { class: 'result-subhead', text: 'Your Step-by-Step Method' }));
            card.appendChild(h('ol', { class: 'plan-steps' }, s.steps.map(function (step) {
                return h('li', { text: step });
            })));
        }

        [
            ['🔁 Revision Schedule', p.revisionFrequency],
            ['✍️ How to Encode It', p.encodingAdvice],
            ['🎯 Practice Plan', p.practiceAdvice],
            ['⏱️ Daily Time Split', p.timeAdvice],
            ['🧠 Visualization', s.visualization],
            ['📝 Practice Style', s.practice],
            ['📅 Revision Approach', s.revision]
        ].forEach(function (row) {
            if (!row[1]) return;
            card.appendChild(h('div', { class: 'result-tip' }, [
                h('h4', { text: row[0] }), h('p', { text: row[1] })
            ]));
        });
    }

    // --- About ------------------------------------------------------------
    function aboutView(data) {
        var groups = data.sections.map(function (section) {
            return h('div', { class: 'about-group' }, [
                h('h3', { text: section.title }),
                h('ul', { class: 'about-list' }, section.quizzes.map(function (q) {
                    return h('li', {}, [
                        h('strong', { text: q.emoji + ' ' + q.title }),
                        h('span', { text: ' — ' + q.subtitle + ' (' + q.questions + ' questions)' })
                    ]);
                }))
            ]);
        });

        return h('div', { class: 'about-container' }, [
            h('div', { class: 'about-content' }, [
                h('h1', { text: 'About These Assessments' }),
                h('p', {
                    text: 'These are self-reflection tools, not diagnostic tests. They are designed to ' +
                        'show you how you currently study, focus, and think about yourself — so you know ' +
                        'which habits to change first. No score here is a verdict on your ability.'
                }),
                h('p', {
                    text: 'Nothing you enter is uploaded or stored on a server. Your name and answers stay ' +
                        'in your own browser for the length of the session and are cleared when you return home.'
                })
            ].concat(groups, [
                h('button', { class: 'back-home-button', onclick: function () { go('#/'); }, text: '← Back to all assessments' })
            ]))
        ]);
    }

    // =====================================================================
    // 11. TOOLS - the non-quiz interactive pages, lazy-loaded on first use
    // =====================================================================

    var TOOLS = [
        { id: 'speed-reading', emoji: '👁️', label: 'Speed Reading Practice', subtitle: 'Rapid Eye Movement training exercise' },
        { id: 'focus-grid', emoji: '🎯', label: 'Focus Grid', subtitle: 'Peripheral vision & focus training' },
        { id: 'peg-system', emoji: '🧠', label: 'Peg System', subtitle: 'Memory training with visual pegs' },
        { id: 'reflects', emoji: '🪞', label: 'Reflects', subtitle: 'Turn negative self-talk into positive affirmations' },
        { id: 'ball-focus', emoji: '🎱', label: 'Ball Focus Trainer', subtitle: 'Track bouncing balls to train your attention' },
        { id: 'audio', emoji: '🎧', label: 'Reset Your Brain', subtitle: 'Audio tracks to reset and recharge your mind' },
        { id: 'nlp', emoji: '🫧', label: 'NLP: Positive Affirmation', subtitle: 'Transform your self-image with guided exercises' },
        { id: 'mental-math', emoji: '🧮', label: 'Mental Math', subtitle: 'Train your brain with quick calculations' },
        { id: 'timer', emoji: '⏱️', label: 'Timer', subtitle: 'Speed Reading, Pomodoro & custom focus timers' },
        { id: 'eye-exercise', emoji: '👁️', label: 'Eye Movement Exercise', subtitle: 'Train reading eye movement with a tracking ball' },
        { id: 'mandala', emoji: '🕉️', label: 'Mandala Meditation', subtitle: 'Gaze at a spinning mandala with calming music' }
    ];

    var toolsLoaded = null;

    function loadTools() {
        if (toolsLoaded) return toolsLoaded;
        toolsLoaded = new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = 'quiz-tools.js?v=1.0.0';
            s.onload = function () { resolve(window.SLATools); };
            s.onerror = function () { reject(new Error('Could not load the tools bundle.')); };
            document.head.appendChild(s);
        });
        return toolsLoaded;
    }

    // =====================================================================
    // 12. ROUTER
    // =====================================================================

    function findMeta(id) {
        var found = null;
        catalogue.sections.forEach(function (s) {
            s.quizzes.forEach(function (q) { if (q.id === id) found = q; });
        });
        return found;
    }

    var activeCleanup = null;

    // Returns a promise that settles once the view has rendered, so tests can
    // await a navigation instead of guessing at timers.
    function route() {
        if (activeCleanup) { activeCleanup(); activeCleanup = null; }
        closeDialog();

        var hash = window.location.hash.replace(/^#\/?/, '');
        var parts = hash.split('/').filter(Boolean);
        var view = parts[0] || 'home';
        var id = parts[1];

        var app = appEl();
        if (app) app.innerHTML = '<div class="quiz-loading" role="status">Loading…</div>';

        return loadCatalogue().then(function (data) {
            if (view === 'home') {
                document.title = 'Know Yourself Better — Free Student Assessments | Super Learner Academy';
                return render(homeView(data));
            }
            if (view === 'about') {
                document.title = 'About These Assessments | Super Learner Academy';
                return render(aboutView(data));
            }
            if (view === 'tools') {
                var tool = TOOLS.filter(function (t) { return t.id === id; })[0];
                if (!tool) return render(errorView('That tool does not exist.'));
                document.title = tool.label + ' | Super Learner Academy';
                return loadTools().then(function (tools) {
                    var host = h('div', { class: 'tool-container' });
                    render(host);
                    activeCleanup = tools.mount(id, host, { go: go, h: h, svg: svg, openDialog: openDialog });
                }).catch(function (err) {
                    render(errorView(err.message));
                });
            }
            if (view === 'username') {
                var meta = findMeta(id);
                if (!meta) return render(errorView('That assessment does not exist.'));
                document.title = meta.title + ' | Super Learner Academy';
                return render(usernameView(meta));
            }
            if (view === 'quiz' || view === 'results') {
                return loadQuiz(id).then(function (quiz) {
                    document.title = quiz.title + ' | Super Learner Academy';
                    render(view === 'quiz' ? quizView(quiz) : resultsView(quiz));
                });
            }
            go('#/');
        }).catch(function (err) {
            render(errorView(
                'Could not load the assessments (' + err.message + '). ' +
                'Check your connection and reload the page.'
            ));
        });
    }

    window.addEventListener('hashchange', route);
    document.addEventListener('DOMContentLoaded', function () {
        if (!window.location.hash) window.location.replace('#/');
        route();
    });

    // =====================================================================
    // 13. TEST SURFACE
    // Mirrors script.js's window.SLA pattern - tests eval this file inside
    // jsdom and reach the pure logic through here.
    // =====================================================================

    window.SLAQuiz = {
        bandFor: bandFor,
        pointsFor: pointsFor,
        maxPointsFor: maxPointsFor,
        scoreTotal: scoreTotal,
        scoreDomains: scoreDomains,
        dominantDomains: dominantDomains,
        scoreAnswerKey: scoreAnswerKey,
        tallyOptions: tallyOptions,
        tallyWordLists: tallyWordLists,
        tallyVARK: tallyVARK,
        categorizeVARK: categorizeVARK,
        tallyPoles: tallyPoles,
        poleBand: poleBand,
        generateStudyPlan: generateStudyPlan,
        scoreQuiz: scoreQuiz,
        optionsFor: optionsFor,
        readState: readState,
        writeState: writeState,
        clearAnswers: clearAnswers,
        playConfetti: playConfetti,
        // Exported for the download-image regression tests: the rasterised
        // PNG itself can't be checked under jsdom, but these two are where it
        // has gone wrong before.
        buildForeignObject: buildForeignObject,
        inlineStyles: inlineStyles,
        TOOLS: TOOLS,
        // DOM helpers - quiz-tools.js is handed these at mount time, so tests
        // that mount a tool directly need them too.
        h: h,
        svg: svg,
        route: route,
        // Navigate and resolve once the view is on screen.
        navigate: function (hash) {
            if (window.location.hash === hash) return route();
            window.location.hash = hash;
            return route();
        }
    };
})();
