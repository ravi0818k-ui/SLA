/**
 * Render smoke tests for quiz.html / quiz.js.
 *
 * The scoring tests cover the pure logic; these drive the actual views, so a
 * typo in a render function fails here instead of in the browser. fetch is
 * stubbed to read QuizQuestions/ straight off disk.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../..');
const quizScript = readFileSync(resolve(ROOT, 'quiz.js'), 'utf-8');
const quizHTML = readFileSync(resolve(ROOT, 'quiz.html'), 'utf-8');

const catalogue = JSON.parse(readFileSync(resolve(ROOT, 'QuizQuestions/index.json'), 'utf-8'));
const allIds = catalogue.sections.flatMap((s) => s.quizzes.map((q) => q.id));

function loadQuizJSON(id) {
    return JSON.parse(readFileSync(resolve(ROOT, 'QuizQuestions', `${id}.json`), 'utf-8'));
}

// Serve repo files to the page's fetch() calls.
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

// quiz.js is evaluated exactly ONCE for this file. Re-evaluating it per test
// would stack up a fresh set of window/document listeners each time, and the
// stale ones would race the live view. The shell markup is re-injected per
// test because tests/setup.js resets the document between tests.
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

// Navigate and wait for the view to be on screen.
function boot(hash) {
    return window.SLAQuiz.navigate(hash);
}

beforeEach(() => {
    stubFetch();
    sessionStorage.clear();
    // jsdom has no layout; quiz.js scrolls to the top after every render.
    window.scrollTo = () => {};
    injectShell();
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('quiz.html shell', () => {
    it('ships real fallback copy, not placeholders', () => {
        expect(quizHTML).toContain('Know Yourself Better');
        expect(document.querySelector(".quiz-boot").textContent).not.toMatch(/lorem ipsum|TODO|PLACEHOLDER/i);
    });

    it('carries the shell elements quiz.js reaches for', () => {
        expect(quizHTML).toContain('id="app"');
        expect(quizHTML).toContain('id="confetti-container"');
        expect(quizHTML).toContain('id="quiz-dialog"');
        expect(quizHTML).toContain('data-page="quiz"');
    });

    it('references quiz.css and quiz.js', () => {
        expect(quizHTML).toMatch(/href="quiz\.css/);
        expect(quizHTML).toMatch(/src="quiz\.js/);
    });
});

describe('site menu visibility', () => {
    it('marks the active view on <html> so the hamburger can be hidden mid-quiz', async () => {
        await boot('#/');
        expect(document.documentElement.getAttribute('data-view')).toBe('home');

        await boot('#/quiz/' + allIds[0]);
        expect(document.documentElement.getAttribute('data-view')).toBe('quiz');

        await boot('#/results/' + allIds[0]);
        expect(document.documentElement.getAttribute('data-view')).toBe('results');
    });

    it('hides the whole menu for the quiz view only', () => {
        const css = readFileSync(resolve(ROOT, 'quiz.css'), 'utf-8');
        expect(css).toMatch(/:root\[data-view="quiz"\]\s*\.site-nav\s*\{[^}]*display:\s*none/);
    });
});

describe('home view', () => {
    it('renders a button for every quiz and every tool', async () => {
        await boot('#/');
        const app = document.getElementById('app');

        expect(app.querySelectorAll('.quiz-section').length).toBe(catalogue.sections.length);

        const labels = Array.from(app.querySelectorAll('.quiz-button-label')).map((el) => el.textContent);
        for (const section of catalogue.sections) {
            for (const quiz of section.quizzes) {
                expect(labels.some((l) => l.includes(quiz.label)), `missing ${quiz.id}`).toBe(true);
            }
        }
        for (const tool of window.SLAQuiz.TOOLS) {
            expect(labels.some((l) => l.includes(tool.label)), `missing tool ${tool.id}`).toBe(true);
        }
    });

    it('links back to the workshop landing page', async () => {
        await boot('#/');
        const link = document.querySelector('.home-workshop-link');
        expect(link).toBeTruthy();
        expect(link.getAttribute('href')).toBe('index.html');
    });
});

describe('username gate', () => {
    it('renders the quiz title and stores the name on submit', async () => {
        await boot('#/username/vark');
        const app = document.getElementById('app');
        expect(app.querySelector('.username-card h2').textContent).toBe('VARK Learning Style Quiz');

        app.querySelector('#name').value = 'Asha';
        app.querySelector('.username-form').dispatchEvent(new window.Event('submit', { cancelable: true }));

        const state = window.SLAQuiz.readState();
        expect(state.userName).toBe('Asha');
        expect(state.quizId).toBe('vark');
    });

    it('does not advance on an empty name', async () => {
        await boot('#/username/vark');
        const app = document.getElementById('app');
        app.querySelector('.username-form').dispatchEvent(new window.Event('submit', { cancelable: true }));
        expect(window.SLAQuiz.readState().quizId).toBeUndefined();
    });
});

describe('quiz runner', () => {
    it('renders the first question with its options', async () => {
        await boot('#/quiz/vark');
        const app = document.getElementById('app');
        const quiz = loadQuizJSON('vark');

        expect(app.querySelector('.question-text').textContent).toBe(quiz.questions[0].text);
        expect(app.querySelectorAll('.option-item').length).toBe(quiz.questions[0].options.length);
        expect(app.querySelector('.quiz-title-small').textContent)
            .toBe(`Question 1 of ${quiz.questions.length}`);
    });

    it('records an answer when an option is clicked', async () => {
        await boot('#/quiz/happiness');
        document.querySelectorAll('.option-item')[2].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
        expect(window.SLAQuiz.readState().answers[0]).toBe(2);
    });

    it('Back is disabled on the first question', async () => {
        await boot('#/quiz/happiness');
        const buttons = document.querySelectorAll('.quiz-navigation .nav-button');
        expect(buttons[0].textContent).toBe('Back');
        expect(buttons[0].disabled).toBe(true);
    });

    it('renders a first question for all 19 quizzes', async () => {
        for (const id of allIds) {
            await boot(`#/quiz/${id}`);
            const app = document.getElementById('app');
            expect(app.querySelector('.question-text'), `${id} question text`).toBeTruthy();
            expect(app.querySelectorAll('.option-item').length, `${id} options`).toBeGreaterThan(1);
        }
    });
});

describe('results view', () => {
    async function showResults(id, optionIndex = 2) {
        const quiz = loadQuizJSON(id);
        const answers = quiz.questions.map((q) => {
            const count = quiz.sharedOptions ? quiz.sharedOptions.length : q.options.length;
            return Math.min(optionIndex, count - 1);
        });
        sessionStorage.setItem('sla_quiz_state', JSON.stringify({ userName: 'Asha', quizId: id, answers }));
        await boot(`#/results/${id}`);
        return document.getElementById('app');
    }

    it('renders a result card with actions for all 19 quizzes', async () => {
        for (const id of allIds) {
            const app = await showResults(id);
            expect(app.querySelector('.quiz-error'), `${id} errored`).toBeNull();
            expect(app.querySelector('.result-card'), `${id} result card`).toBeTruthy();
            expect(app.querySelector('.result-card').textContent.trim().length, `${id} empty card`)
                .toBeGreaterThan(40);
            expect(app.querySelectorAll('.result-actions button').length, `${id} actions`).toBe(2);
        }
    });

    it('shows the ring widget for a scored quiz', async () => {
        const app = await showResults('happiness');
        expect(app.querySelector('.score-ring')).toBeTruthy();
        expect(app.querySelector('.score-ring-pct').textContent).toMatch(/^\d+%$/);
    });

    it('shows a donut with a legend entry per category for VARK', async () => {
        const app = await showResults('vark');
        const quiz = loadQuizJSON('vark');
        expect(app.querySelectorAll('.chart-legend li').length).toBe(quiz.categories.length);
    });

    it('shows domain bars for a domain-scored quiz', async () => {
        const app = await showResults('self-image');
        const quiz = loadQuizJSON('self-image');
        expect(app.querySelectorAll('.domain-row').length).toBe(Object.keys(quiz.domains).length);
    });

    it('shows the dominant plan, all four bars and the disclaimer for the exhaustion check', async () => {
        // optionIndex 3 = "Very much" on every item, so every domain maxes out
        // and co-dominance is capped by maxDominant.
        const app = await showResults('tiredness', 3);
        const quiz = loadQuizJSON('tiredness');

        const plans = app.querySelectorAll('.plan-block');
        expect(plans.length).toBeGreaterThan(0);
        expect(plans.length).toBeLessThanOrEqual(quiz.maxDominant);
        expect(app.querySelectorAll('.domain-row').length).toBe(Object.keys(quiz.domains).length);
        expect(app.querySelector('.result-disclaimer').textContent).toContain('not a medical');
    });

    it('shows no action plan when nothing is exhausted', async () => {
        const app = await showResults('tiredness', 0);
        expect(app.querySelectorAll('.plan-block').length).toBe(0);
        expect(app.querySelector('.score-ring-pct').textContent).toBe('0%');
    });

    it('shows the profile hero and the chosen animal for Spirit Animal', async () => {
        const app = await showResults('spirit-animal', 0);
        expect(app.querySelector('.profile-hero-emoji').textContent.length).toBeGreaterThan(0);
        // Answering option 0 throughout should land on a real profile name.
        expect(app.querySelector('.result-label').textContent).toMatch(/Asha, you are The \w+/);
    });

    it('shows the estimated IQ as a big number, not a pie', async () => {
        const app = await showResults('iq');
        expect(app.querySelector('.result-bignum')).toBeTruthy();
        expect(app.querySelector('.chart-legend')).toBeNull();
        expect(app.querySelectorAll('.domain-row').length).toBe(4);
    });

    it('shows the study plan steps', async () => {
        const app = await showResults('study-strategy', 0);
        expect(app.querySelectorAll('.plan-steps li').length).toBeGreaterThan(0);
    });

    it('greets the user by name', async () => {
        const app = await showResults('happiness');
        expect(app.textContent).toContain('Asha');
    });

    it('errors cleanly when there are no answers for that quiz', async () => {
        sessionStorage.clear();
        await boot('#/results/vark');
        expect(document.querySelector('.quiz-error')).toBeTruthy();
    });
});

describe('routing', () => {
    it('falls back to an error view for an unknown quiz', async () => {
        await boot('#/username/not-a-real-quiz');
        expect(document.querySelector('.quiz-error')).toBeTruthy();
    });

    it('renders the about page listing every assessment', async () => {
        await boot('#/about');
        const app = document.getElementById('app');
        expect(app.querySelectorAll('.about-group').length).toBe(catalogue.sections.length);
        expect(app.querySelectorAll('.about-list li').length).toBe(allIds.length);
    });

    it('sets a document title per view', async () => {
        await boot('#/');
        expect(document.title).toContain('Know Yourself Better');
        await boot('#/username/eq');
        expect(document.title).toContain('EQ');
    });
});
