/**
 * Hindi / English tests for quiz.js.
 *
 * The contract these lock down: English is the single source of truth for
 * SCORING, and the Hindi sidecars in QuizQuestions/hi/ only replace what is
 * displayed. So the same answers must produce the same score in both
 * languages — including for the three scorers that match on option TEXT
 * (tally-vark, tally-word-list, tally-option).
 *
 * Structural drift between a sidecar and its English file is caught by
 * scripts/check_translations.py; this file covers the runtime behaviour.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../..');
const quizScript = readFileSync(resolve(ROOT, 'quiz.js'), 'utf-8');
const quizHTML = readFileSync(resolve(ROOT, 'quiz.html'), 'utf-8');

const catalogue = JSON.parse(readFileSync(resolve(ROOT, 'QuizQuestions/index.json'), 'utf-8'));
const allIds = catalogue.sections.flatMap((s) => s.quizzes.map((q) => q.id));

const loadEN = (id) => JSON.parse(readFileSync(resolve(ROOT, 'QuizQuestions', `${id}.json`), 'utf-8'));
const loadHI = (id) => JSON.parse(readFileSync(resolve(ROOT, 'QuizQuestions/hi', `${id}.json`), 'utf-8'));

const DEVANAGARI = /[ऀ-ॿ]/;

function stubFetch() {
    vi.stubGlobal('fetch', vi.fn((url) => {
        const path = resolve(ROOT, String(url).split('?')[0]);
        if (!existsSync(path)) {
            return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(new Error('404')) });
        }
        const body = readFileSync(path, 'utf-8');
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(body)) });
    }));
}

// quiz.js is evaluated exactly ONCE for this file — see quiz-render.test.js
// for why re-evaluating stacks up duplicate listeners.
let scriptEvaluated = false;

function injectShell() {
    document.documentElement.innerHTML = quizHTML
        .replace(/<script[\s\S]*?<\/script>/g, '')
        .replace(/<link[^>]*>/g, '');
    if (!scriptEvaluated) {
        new Function(quizScript)();
        scriptEvaluated = true;
    }
}

const boot = (hash) => window.SLAQuiz.navigate(hash);

beforeEach(() => {
    stubFetch();
    sessionStorage.clear();
    localStorage.clear();
    window.scrollTo = () => {};
    injectShell();
    window.SLAQuiz.setLang('en');
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------

describe('sidecar coverage', () => {
    it('ships a Hindi file for every quiz in the catalogue', () => {
        const files = readdirSync(resolve(ROOT, 'QuizQuestions/hi'));
        for (const id of allIds) {
            expect(files, `no Hindi translation for ${id}`).toContain(`${id}.json`);
        }
        expect(files).toContain('index.json');
    });

    it('translates every question of every quiz', () => {
        for (const id of allIds) {
            const en = loadEN(id);
            const hi = loadHI(id);
            expect(hi.questions.length, `${id} question count`).toBe(en.questions.length);

            en.questions.forEach((q, i) => {
                const patch = hi.questions[i];
                // social-type's question text is just '1/20'..'20/20' — numbers
                // need no translation, but its options do.
                if (patch.text !== undefined) {
                    expect(patch.text, `${id} Q${i + 1}`).toMatch(DEVANAGARI);
                }
                if (q.options) {
                    expect(patch.options.length, `${id} Q${i + 1} options`).toBe(q.options.length);
                }
            });
        }
    });

    it('never translates a key the scorers read', () => {
        for (const id of allIds) {
            const hi = loadHI(id);
            expect(hi.id, `${id} must not restate id`).toBeUndefined();
            expect(hi.scorer, `${id} must not restate scorer`).toBeUndefined();
            expect(hi.wordLists, `${id} must not translate wordLists`).toBeUndefined();
            expect(hi.categories, `${id} must not translate categories`).toBeUndefined();

            (hi.questions || []).forEach((q, i) => {
                expect(q.domain, `${id} Q${i + 1} domain`).toBeUndefined();
                expect(q.category, `${id} Q${i + 1} category`).toBeUndefined();
                (q.options || []).forEach((o, oi) => {
                    expect(o.score, `${id} Q${i + 1} option ${oi} score`).toBeUndefined();
                    expect(o.correct, `${id} Q${i + 1} option ${oi} correct`).toBeUndefined();
                    expect(o.tag, `${id} Q${i + 1} option ${oi} tag`).toBeUndefined();
                    expect(o.key, `${id} Q${i + 1} option ${oi} key`).toBeUndefined();
                });
            });
        }
    });
});

describe('mergeTranslation', () => {
    const merge = (a, b) => window.SLAQuiz.mergeTranslation(a, b);

    it('overlays strings and leaves untouched keys alone', () => {
        const out = merge({ title: 'Focus', scorer: 'likert-total' }, { title: 'फोकस' });
        expect(out.title).toBe('फोकस');
        expect(out.scorer).toBe('likert-total');
    });

    it('merges arrays by index and keeps entries the patch omits', () => {
        const out = merge(
            { questions: [{ text: 'one' }, { text: 'two' }] },
            { questions: [{ text: 'एक' }] }
        );
        expect(out.questions[0].text).toBe('एक');
        expect(out.questions[1].text).toBe('two');
    });

    it('keeps the English option text reachable as textEn', () => {
        const out = merge({ options: [{ text: 'Youtube / Ted Talks' }] }, { options: [{ text: 'यूट्यूब' }] });
        expect(out.options[0].text).toBe('यूट्यूब');
        expect(out.options[0].textEn).toBe('Youtube / Ted Talks');
        expect(window.SLAQuiz.scoreText(out.options[0])).toBe('Youtube / Ted Talks');
    });

    it('does not invent a textEn when the text was not translated', () => {
        const out = merge({ options: [{ text: '42' }] }, { options: [{ text: '42' }] });
        expect(out.options[0].textEn).toBeUndefined();
    });

    it('leaves the base untouched when the patch is missing or the wrong shape', () => {
        const base = { title: 'Focus', questions: [{ text: 'one' }] };
        expect(merge(base, undefined)).toBe(base);
        expect(merge(base, null)).toBe(base);
        expect(merge(base.questions, { nope: 1 })).toBe(base.questions);
    });

    it('adds keys the English file does not have', () => {
        const out = merge({ title: 'x' }, { ringCaption: 'कुल' });
        expect(out.ringCaption).toBe('कुल');
    });
});

describe('scoring is language-independent', () => {
    // Every answer index that exists, so text-matching scorers see real data.
    const answersFor = (quiz, pick) => quiz.questions.map((q, i) => {
        const n = (quiz.sharedOptions || q.options || []).length;
        return n ? pick(i) % n : 0;
    });

    for (const id of allIds) {
        it(`${id} scores the same in Hindi as in English`, () => {
            const en = loadEN(id);
            const hi = window.SLAQuiz.mergeTranslation(en, loadHI(id));

            for (const pick of [() => 0, (i) => i, (i) => i * 3 + 1]) {
                const answers = answersFor(en, pick);
                const a = window.SLAQuiz.scoreQuiz(en, answers);
                const b = window.SLAQuiz.scoreQuiz(hi, answers);

                // Numbers must match exactly; the prose attached to them is the
                // part that is expected to differ.
                expect(b.percentage, `${id} percentage`).toBe(a.percentage);
                expect(b.totalScore, `${id} totalScore`).toBe(a.totalScore);
                expect(b.estimatedIQ, `${id} estimatedIQ`).toBe(a.estimatedIQ);

                if (a.domains) {
                    expect(b.domains.map((d) => d.percentage)).toEqual(a.domains.map((d) => d.percentage));
                }
                if (a.chart) {
                    // Category ORDER and counts must survive; only the display
                    // name is allowed to change.
                    expect(b.chart.map((c) => c.value), `${id} chart values`)
                        .toEqual(a.chart.map((c) => c.value));
                }
                if (a.top) {
                    expect(b.top.name, `${id} dominant profile key`).toBe(a.top.name);
                }
                if (a.plan) {
                    expect(b.plan.strategy, `${id} strategy picked`).toBeTruthy();
                    expect(b.plan.examDistance).toBe(a.plan.examDistance);
                }
            }
        });
    }

    it('VARK still matches its English keywords after translation', () => {
        const en = loadEN('vark');
        const hi = window.SLAQuiz.mergeTranslation(en, loadHI('vark'));
        const answers = en.questions.map((q, i) => i % q.options.length);

        const a = window.SLAQuiz.tallyVARK(en, answers);
        const b = window.SLAQuiz.tallyVARK(hi, answers);
        expect(b.map((c) => c.value)).toEqual(a.map((c) => c.value));
        // …and at least one option really did get translated.
        expect(hi.questions[0].options[0].text).toMatch(DEVANAGARI);
        expect(b.some((c) => DEVANAGARI.test(c.name)), 'Hindi category labels').toBe(true);
    });

    it('Social Type still finds its word lists after translation', () => {
        const en = loadEN('social-type');
        const hi = window.SLAQuiz.mergeTranslation(en, loadHI('social-type'));
        const answers = en.questions.map((q, i) => i % q.options.length);

        const a = window.SLAQuiz.tallyWordLists(en, answers);
        const b = window.SLAQuiz.tallyWordLists(hi, answers);
        expect(b.map((c) => c.value)).toEqual(a.map((c) => c.value));
        // Some adjectives ('Fearful', 'Bold') are in no word list by design, so
        // the tallies do not have to reach 20 — they just have to be the same
        // count in both languages, i.e. the lookup still resolved.
        const total = b.reduce((t, c) => t + c.value, 0);
        expect(total).toBe(a.reduce((t, c) => t + c.value, 0));
        expect(total).toBeGreaterThan(0);
    });
});

describe('language selection', () => {
    it('defaults to English', () => {
        expect(window.SLAQuiz.readLang()).toBe('en');
    });

    it('remembers the choice in localStorage and in the session state', () => {
        window.SLAQuiz.setLang('hi');
        expect(localStorage.getItem('sla_quiz_lang')).toBe('hi');
        expect(window.SLAQuiz.readState().lang).toBe('hi');
        expect(window.SLAQuiz.readLang()).toBe('hi');
    });

    it('ignores a language it does not ship', () => {
        window.SLAQuiz.setLang('fr');
        expect(window.SLAQuiz.getLang()).toBe('en');
    });

    it('marks the document so the Devanagari font rules apply', () => {
        window.SLAQuiz.setLang('hi');
        expect(document.documentElement.getAttribute('data-lang')).toBe('hi');
        expect(document.documentElement.getAttribute('lang')).toBe('hi');
    });

    it('offers the picker on the name gate and switches on click', async () => {
        await boot('#/username/focus');
        const app = document.getElementById('app');

        const options = app.querySelectorAll('.username-form .lang-option');
        expect(options.length).toBe(2);
        expect(app.querySelector('.lang-option.is-active').textContent).toBe('English');

        app.querySelector('#name').value = 'Asha';
        options[1].click();
        await window.SLAQuiz.route();

        expect(window.SLAQuiz.getLang()).toBe('hi');
        // The typed name survives the re-render.
        expect(document.getElementById('name').value).toBe('Asha');
        expect(document.querySelector('.username-card h2').textContent).toMatch(DEVANAGARI);
        expect(document.querySelector('.submit-button').textContent).toMatch(DEVANAGARI);
    });

    it('stores the language with the run when the name is submitted', async () => {
        window.SLAQuiz.setLang('hi');
        await boot('#/username/focus');
        document.getElementById('name').value = 'Asha';
        document.querySelector('.username-form').dispatchEvent(new window.Event('submit', { cancelable: true }));

        const state = window.SLAQuiz.readState();
        expect(state.lang).toBe('hi');
        expect(state.quizId).toBe('focus');
    });
});

describe('Hindi rendering', () => {
    it('renders questions, options and navigation in Hindi', async () => {
        window.SLAQuiz.setLang('hi');
        await boot('#/quiz/focus');
        const app = document.getElementById('app');
        const hi = loadHI('focus');

        expect(app.querySelector('.question-text').textContent).toBe(hi.questions[0].text);
        const opts = Array.from(app.querySelectorAll('.option-text')).map((el) => el.textContent);
        expect(opts).toEqual(hi.sharedOptions);
        expect(app.querySelector('.quiz-title-small').textContent).toMatch(DEVANAGARI);
        expect(Array.from(app.querySelectorAll('.nav-button')).map((b) => b.textContent))
            .toEqual([hi.questions.length ? 'पीछे' : '', 'आगे'].filter(Boolean));
    });

    it('falls back to English when a sidecar is missing', async () => {
        // Serve a 404 for the Hindi file only.
        vi.stubGlobal('fetch', vi.fn((url) => {
            const raw = String(url).split('?')[0];
            if (raw.includes('QuizQuestions/hi/happiness.json')) {
                return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(new Error('404')) });
            }
            const path = resolve(ROOT, raw);
            const body = readFileSync(path, 'utf-8');
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(body)) });
        }));

        window.SLAQuiz.setLang('hi');
        await boot('#/quiz/happiness');
        expect(document.querySelector('.question-text').textContent)
            .toBe(loadEN('happiness').questions[0].text);
    });

    it('renders a Hindi result card with the same numbers as the English one', async () => {
        const en = loadEN('focus');
        const answers = en.questions.map(() => 3);

        window.SLAQuiz.setLang('en');
        window.SLAQuiz.writeState({ userName: 'Asha', quizId: 'focus', answers });
        await boot('#/results/focus');
        const englishPct = document.querySelector('.score-ring-pct').textContent;
        const bandKey = window.SLAQuiz.scoreQuiz(en, answers).band.key;
        expect(document.querySelector('.result-label').textContent)
            .toBe(en.levels[bandKey].label);

        window.SLAQuiz.setLang('hi');
        window.SLAQuiz.writeState({ userName: 'Asha', quizId: 'focus', answers });
        await boot('#/results/focus');

        expect(document.querySelector('.score-ring-pct').textContent).toBe(englishPct);
        expect(document.querySelector('.result-label').textContent)
            .toBe(loadHI('focus').levels[bandKey].label);
        expect(document.querySelector('.result-greeting').textContent).toMatch(/^Asha, /);
        expect(document.querySelector('.result-greeting').textContent).toMatch(DEVANAGARI);
        expect(document.querySelector('.download-button').textContent).toMatch(DEVANAGARI);
    });

    it('renders the home and about views in Hindi', async () => {
        window.SLAQuiz.setLang('hi');
        await boot('#/');
        expect(document.querySelector('.quiz-title').textContent).toBe('खुद को बेहतर जानें');
        const labels = Array.from(document.querySelectorAll('.quiz-button-label')).map((e) => e.textContent);
        expect(labels.some((l) => l.includes('मूड चेक'))).toBe(true);

        await boot('#/about');
        expect(document.querySelector('.about-content h1').textContent).toMatch(DEVANAGARI);
    });

    it('translates the static confirmation dialog in place', () => {
        window.SLAQuiz.setLang('hi');
        expect(document.querySelector('.quiz-dialog-title').textContent).toBe('होम पेज पर लौटें?');
        window.SLAQuiz.setLang('en');
        expect(document.querySelector('.quiz-dialog-title').textContent).toBe('Return to Home Page?');
    });
});

describe('every widget renders in Hindi', () => {
    // The result renderers reach into quiz-specific keys (levels, bands,
    // domains, plans, profiles, strategies). This drives all eight widgets
    // through a real render so a key a sidecar renamed or dropped shows up
    // here rather than as a blank card in the browser.
    for (const id of allIds) {
        it(`${id} renders a Hindi result card`, async () => {
            const en = loadEN(id);
            const answers = en.questions.map((q, i) => {
                const n = (en.sharedOptions || q.options || []).length;
                return n ? (i * 3 + 1) % n : 0;
            });

            window.SLAQuiz.setLang('hi');
            window.SLAQuiz.writeState({ userName: 'Asha', quizId: id, answers });
            await boot(`#/results/${id}`);

            const card = document.querySelector('.result-card');
            expect(card, `${id} produced no result card`).toBeTruthy();
            expect(card.textContent.trim().length, `${id} card is empty`).toBeGreaterThan(40);
            expect(card.textContent, `${id} fell back to the unsupported-widget message`)
                .not.toContain('Unsupported result type');
            expect(card.textContent, `${id} rendered no Hindi at all`).toMatch(DEVANAGARI);
            expect(card.textContent, `${id} leaked an undefined into the copy`)
                .not.toMatch(/undefined|\[object Object\]/);
        });
    }
});

describe('study-strategy advice table', () => {
    it('uses the English advice when no sidecar is layered on', () => {
        const quiz = loadEN('study-strategy');
        const urgentIndex = quiz.questions[6].options.findIndex((o) => o.tag === 'exam_urgent');
        const answers = quiz.questions.map((q, i) => (i === 6 ? urgentIndex : 0));
        expect(window.SLAQuiz.generateStudyPlan(quiz, answers).urgency).toContain('exam is very close');
    });

    it('uses the sidecar advice once Hindi is layered on', () => {
        const en = loadEN('study-strategy');
        const hi = window.SLAQuiz.mergeTranslation(en, loadHI('study-strategy'));
        const urgentIndex = en.questions[6].options.findIndex((o) => o.tag === 'exam_urgent');
        const answers = en.questions.map((q, i) => (i === 6 ? urgentIndex : 0));

        const plan = window.SLAQuiz.generateStudyPlan(hi, answers);
        expect(plan.urgency).toMatch(DEVANAGARI);
        expect(plan.revisionFrequency).toMatch(DEVANAGARI);
        expect(plan.practiceAdvice).toMatch(DEVANAGARI);
        expect(plan.encodingAdvice).toMatch(DEVANAGARI);
        expect(plan.timeAdvice).toMatch(DEVANAGARI);
    });

    it('still returns no urgency note when the exam is far away', () => {
        const en = loadEN('study-strategy');
        const hi = window.SLAQuiz.mergeTranslation(en, loadHI('study-strategy'));
        const far = en.questions[6].options.findIndex(
            (o) => o.tag !== 'exam_urgent' && o.tag !== 'exam_soon'
        );
        const answers = en.questions.map((q, i) => (i === 6 ? far : 0));
        expect(window.SLAQuiz.generateStudyPlan(hi, answers).urgency).toBeNull();
    });
});
