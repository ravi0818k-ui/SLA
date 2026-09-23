/**
 * Unit tests for the quiz engine ported from quiz-assessment-app.
 *
 * quiz.js is loaded the same way script.js is elsewhere in this suite: read
 * from disk and executed with `new Function`, because jsdom does not run
 * injected <script> tags. The pure scoring logic is reached through
 * window.SLAQuiz.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../..');
const quizScript = readFileSync(resolve(ROOT, 'quiz.js'), 'utf-8');

function loadQuizJSON(id) {
    return JSON.parse(readFileSync(resolve(ROOT, 'QuizQuestions', `${id}.json`), 'utf-8'));
}

const catalogue = JSON.parse(readFileSync(resolve(ROOT, 'QuizQuestions/index.json'), 'utf-8'));
const allIds = catalogue.sections.flatMap((s) => s.quizzes.map((q) => q.id));

beforeEach(() => {
    delete window.SLAQuiz;
    // quiz.html's shell elements that quiz.js reaches for at load time
    document.body.innerHTML =
        '<main id="app"></main>' +
        '<div id="confetti-container"></div>' +
        '<div id="quiz-dialog" hidden>' +
        '<button data-dialog-cancel></button><button data-dialog-confirm></button>' +
        '</div>';
    new Function(quizScript)();
});

afterEach(() => {
    vi.restoreAllMocks();
});

// Answer every question with the given option index (clamped to the options
// that question actually has).
function answerAll(quiz, index) {
    return quiz.questions.map((q) => {
        const count = quiz.sharedOptions ? quiz.sharedOptions.length : q.options.length;
        return Math.min(index, count - 1);
    });
}

describe('quiz catalogue', () => {
    it('index.json lists every quiz file, and nothing extra', () => {
        const files = readdirSync(resolve(ROOT, 'QuizQuestions'))
            .filter((f) => f.endsWith('.json'))
            .map((f) => f.replace('.json', ''))
            .filter((f) => f !== 'index' && f !== 'reading-texts');

        expect(allIds.slice().sort()).toEqual(files.slice().sort());
    });

    it('declares 19 quizzes', () => {
        expect(allIds).toHaveLength(19);
    });

    it('every quiz file has questions, a scorer and a widget', () => {
        for (const id of allIds) {
            const quiz = loadQuizJSON(id);
            expect(quiz.questions.length, `${id} questions`).toBeGreaterThan(0);
            expect(quiz.scorer, `${id} scorer`).toBeTruthy();
            expect(quiz.widget, `${id} widget`).toBeTruthy();
        }
    });

    it('every question has options to choose from', () => {
        for (const id of allIds) {
            const quiz = loadQuizJSON(id);
            quiz.questions.forEach((q, i) => {
                const opts = window.SLAQuiz.optionsFor(quiz, q);
                expect(opts.length, `${id} Q${i + 1}`).toBeGreaterThan(1);
                opts.forEach((o) => expect(typeof o.text).toBe('string'));
            });
        }
    });

    it("index.json's question counts match the quiz files", () => {
        for (const section of catalogue.sections) {
            for (const meta of section.quizzes) {
                expect(loadQuizJSON(meta.id).questions.length, meta.id).toBe(meta.questions);
            }
        }
    });
});

describe('scoreQuiz - every quiz scores without throwing', () => {
    // Index 0 is the "lowest" answer, 4 the highest, so these bracket the range.
    for (const index of [0, 2, 4]) {
        it(`handles an all-option-${index} run for all 19 quizzes`, () => {
            for (const id of allIds) {
                const quiz = loadQuizJSON(id);
                const result = window.SLAQuiz.scoreQuiz(quiz, answerAll(quiz, index));
                expect(result, id).toBeTruthy();

                if (result.percentage !== undefined) {
                    expect(result.percentage, `${id} percentage`).toBeGreaterThanOrEqual(0);
                    expect(result.percentage, `${id} percentage`).toBeLessThanOrEqual(100);
                }
                // Every quiz must resolve to something renderable.
                expect(
                    Boolean(result.band || result.chart || result.plan),
                    `${id} produced no band/chart/plan`
                ).toBe(true);
            }
        });
    }

    it('chart slices never sum to more than 100%', () => {
        for (const id of allIds) {
            const quiz = loadQuizJSON(id);
            const result = window.SLAQuiz.scoreQuiz(quiz, answerAll(quiz, 1));
            if (!result.chart) continue;
            const sum = result.chart.reduce((a, d) => a + d.percentage, 0);
            expect(sum, `${id} chart sum`).toBeLessThanOrEqual(100.01);
        }
    });
});

describe('bandFor', () => {
    const minBands = [
        { min: 75, label: 'high' },
        { min: 50, label: 'mid' },
        { min: 0, label: 'low' }
    ];

    it('picks the first band whose min is met', () => {
        expect(window.SLAQuiz.bandFor(minBands, 80).label).toBe('high');
        expect(window.SLAQuiz.bandFor(minBands, 60).label).toBe('mid');
        expect(window.SLAQuiz.bandFor(minBands, 10).label).toBe('low');
    });

    it('treats min as inclusive at the boundary', () => {
        expect(window.SLAQuiz.bandFor(minBands, 75).label).toBe('high');
        expect(window.SLAQuiz.bandFor(minBands, 50).label).toBe('mid');
    });

    it('supports max-style bands', () => {
        const maxBands = [{ max: 30, label: 'light' }, { max: 55, label: 'some' }, { max: 100, label: 'heavy' }];
        expect(window.SLAQuiz.bandFor(maxBands, 20).label).toBe('light');
        expect(window.SLAQuiz.bandFor(maxBands, 30).label).toBe('light');
        expect(window.SLAQuiz.bandFor(maxBands, 31).label).toBe('some');
        expect(window.SLAQuiz.bandFor(maxBands, 90).label).toBe('heavy');
    });

    it('supports iqMin bands, matched on the IQ value not the percentage', () => {
        const iqBands = [{ iqMin: 130, label: 'superior' }, { iqMin: 90, label: 'average' }, { iqMin: 0, label: 'low' }];
        expect(window.SLAQuiz.bandFor(iqBands, 100, 135).label).toBe('superior');
        expect(window.SLAQuiz.bandFor(iqBands, 100, 95).label).toBe('average');
        expect(window.SLAQuiz.bandFor(iqBands, 100, 72).label).toBe('low');
    });
});

describe('pointsFor - Likert scoring and reverse items', () => {
    const likert = {
        sharedOptions: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
        questions: [{ text: 'normal' }, { text: 'flipped', reverse: true }]
    };

    it('scores a shared-Likert answer as index + 1', () => {
        expect(window.SLAQuiz.pointsFor(likert, likert.questions[0], 0)).toBe(1);
        expect(window.SLAQuiz.pointsFor(likert, likert.questions[0], 4)).toBe(5);
    });

    it('flips reverse-scored questions (6 - score on a 5-point scale)', () => {
        expect(window.SLAQuiz.pointsFor(likert, likert.questions[1], 0)).toBe(5);
        expect(window.SLAQuiz.pointsFor(likert, likert.questions[1], 4)).toBe(1);
        expect(window.SLAQuiz.pointsFor(likert, likert.questions[1], 2)).toBe(3);
    });

    it('scores an unanswered question as 0', () => {
        expect(window.SLAQuiz.pointsFor(likert, likert.questions[0], null)).toBe(0);
        expect(window.SLAQuiz.pointsFor(likert, likert.questions[0], undefined)).toBe(0);
    });

    it('uses the option\'s own score when the quiz is not shared-Likert', () => {
        const scored = { questions: [{ text: 'q', options: [{ text: 'a', score: 2 }, { text: 'b', score: 5 }] }] };
        expect(window.SLAQuiz.pointsFor(scored, scored.questions[0], 0)).toBe(2);
        expect(window.SLAQuiz.pointsFor(scored, scored.questions[0], 1)).toBe(5);
    });
});

describe('scoreTotal', () => {
    it('a full-bottom run scores the minimum, a full-top run scores 100%', () => {
        const quiz = loadQuizJSON('happiness');
        const low = window.SLAQuiz.scoreTotal(quiz, answerAll(quiz, 0));
        const high = window.SLAQuiz.scoreTotal(quiz, answerAll(quiz, 4));

        expect(low.totalScore).toBe(quiz.questions.length);      // 1 point each
        expect(high.totalScore).toBe(quiz.questions.length * 5); // 5 points each
        expect(high.percentage).toBe(100);
        expect(low.percentage).toBe(20);
    });

    it('reverse items cancel out on the Focus quiz', () => {
        const quiz = loadQuizJSON('focus');
        const reverseCount = quiz.questions.filter((q) => q.reverse).length;
        expect(reverseCount, 'focus should have reverse-scored items').toBeGreaterThan(0);

        const top = window.SLAQuiz.scoreTotal(quiz, answerAll(quiz, 4));
        const expected = (quiz.questions.length - reverseCount) * 5 + reverseCount * 1;
        expect(top.totalScore).toBe(expected);
    });
});

describe('scoreDomains', () => {
    it('domain percentages and the overall percentage agree', () => {
        const quiz = loadQuizJSON('self-image');
        const result = window.SLAQuiz.scoreDomains(quiz, answerAll(quiz, 3));

        expect(result.domains.length).toBe(Object.keys(quiz.domains).length);

        const summedScore = result.domains.reduce((a, d) => a + d.score, 0);
        const summedMax = result.domains.reduce((a, d) => a + d.max, 0);
        expect(summedScore).toBe(result.totalScore);
        expect(summedMax).toBe(result.maxScore);
        expect(result.percentage).toBeCloseTo((summedScore / summedMax) * 100, 6);
    });

    it('every domain named by a question exists in the quiz\'s domain table', () => {
        for (const id of allIds) {
            const quiz = loadQuizJSON(id);
            if (!quiz.domains) continue;
            for (const q of quiz.questions) {
                if (!q.domain) continue;
                expect(Object.keys(quiz.domains), `${id}: ${q.domain}`).toContain(q.domain);
            }
        }
    });
});

describe('categorizeVARK', () => {
    // Preserved from src/utils/categories.js - keyword matching on option text.
    it('classifies representative option text', () => {
        expect(window.SLAQuiz.categorizeVARK('Watch Youtube videos')).toBe('Visual');
        expect(window.SLAQuiz.categorizeVARK('Listen to Podcasts')).toBe('Auditory');
        expect(window.SLAQuiz.categorizeVARK('Read Books')).toBe('Reading/Writing');
        expect(window.SLAQuiz.categorizeVARK('Solve Puzzles')).toBe('Kinesthetic');
    });

    it('returns null when nothing matches', () => {
        expect(window.SLAQuiz.categorizeVARK('zzzz nothing here')).toBeNull();
    });

    it('classifies the large majority of real VARK options', () => {
        const quiz = loadQuizJSON('vark');
        const all = quiz.questions.flatMap((q) => q.options.map((o) => o.text));
        const matched = all.filter((t) => window.SLAQuiz.categorizeVARK(t) !== null);
        // The keyword lists are inherited as-is; this guards against a
        // regression that would silently drop answers from the tally.
        expect(matched.length / all.length).toBeGreaterThan(0.8);
    });
});

describe('tallyPoles - brain dominance and motivation', () => {
    it('an all-first-option run is 100% the first pole', () => {
        const quiz = loadQuizJSON('brain-dominance');
        const data = window.SLAQuiz.tallyPoles(quiz, quiz.questions.map(() => 0));
        expect(data[0].percentage).toBe(100);
        expect(data[1].percentage).toBe(0);
    });

    it('picks the dominant band above the threshold, balanced otherwise', () => {
        const quiz = loadQuizJSON('motivation');
        const n = quiz.questions.length;

        const allIntrinsic = window.SLAQuiz.tallyPoles(quiz, quiz.questions.map(() => 0));
        expect(window.SLAQuiz.poleBand(quiz, allIntrinsic).label).toMatch(/Intrinsic/);

        const allExtrinsic = window.SLAQuiz.tallyPoles(quiz, quiz.questions.map(() => 1));
        expect(window.SLAQuiz.poleBand(quiz, allExtrinsic).label).toMatch(/Extrinsic/);

        const split = window.SLAQuiz.tallyPoles(quiz, quiz.questions.map((_, i) => (i < Math.floor(n / 2) ? 0 : 1)));
        expect(window.SLAQuiz.poleBand(quiz, split).label).toMatch(/Balanced/);
    });
});

describe('scoreAnswerKey - IQ', () => {
    it('a perfect run gives 100% and the top of the IQ scale', () => {
        const quiz = loadQuizJSON('iq');
        const perfect = quiz.questions.map((q) => q.options.findIndex((o) => o.correct));
        expect(perfect.every((i) => i >= 0), 'every IQ question needs a correct option').toBe(true);

        const result = window.SLAQuiz.scoreAnswerKey(quiz, perfect);
        expect(result.percentage).toBe(100);
        expect(result.estimatedIQ).toBe(quiz.iqScale.base + quiz.iqScale.range);
        expect(result.totalScore).toBe(quiz.questions.length);
    });

    it('an all-wrong run gives 0% and the base of the IQ scale', () => {
        const quiz = loadQuizJSON('iq');
        const wrong = quiz.questions.map((q) => q.options.findIndex((o) => !o.correct));
        const result = window.SLAQuiz.scoreAnswerKey(quiz, wrong);
        expect(result.percentage).toBe(0);
        expect(result.estimatedIQ).toBe(quiz.iqScale.base);
    });
});

describe('tallyOptions - profile quizzes', () => {
    it('ranks the most-chosen option first and maps it to a profile', () => {
        for (const id of ['spirit-animal', 'mood-check']) {
            const quiz = loadQuizJSON(id);
            const result = window.SLAQuiz.scoreQuiz(quiz, quiz.questions.map(() => 0));
            expect(result.top, `${id} top`).toBeTruthy();
            expect(quiz.profiles[result.top.name], `${id}: no profile for ${result.top.name}`).toBeTruthy();
        }
    });

    it('every option key on a profile quiz maps to a real profile', () => {
        for (const id of ['spirit-animal', 'mood-check']) {
            const quiz = loadQuizJSON(id);
            const names = Object.keys(quiz.profiles);
            quiz.questions.forEach((q, qi) => {
                q.options.forEach((o) => {
                    // The key ('Bear', 'Calm') is what indexes quiz.profiles -
                    // the option's visible text is prose and never matches.
                    expect(o.key, `${id} Q${qi + 1} option has no key`).toBeTruthy();
                    expect(names, `${id} Q${qi + 1}: "${o.key}"`).toContain(o.key);
                });
            });
        }
    });
});

describe('generateStudyPlan', () => {
    it('produces a plan with a strategy for each subject option', () => {
        const quiz = loadQuizJSON('study-strategy');
        const subjectOptions = quiz.questions[0].options;

        subjectOptions.forEach((_, subjectIndex) => {
            const answers = quiz.questions.map((q, i) => (i === 0 ? subjectIndex : 0));
            const plan = window.SLAQuiz.generateStudyPlan(quiz, answers);

            expect(plan.strategy, `subject ${subjectIndex}`).toBeTruthy();
            expect(plan.strategy.title).toBeTruthy();
            expect(plan.strategy.steps.length).toBeGreaterThan(0);
            expect(plan.revisionFrequency).toBeTruthy();
            expect(plan.practiceAdvice).toBeTruthy();
            expect(plan.encodingAdvice).toBeTruthy();
            expect(plan.timeAdvice).toBeTruthy();
        });
    });

    it('surfaces an urgency note only when the exam is close', () => {
        const quiz = loadQuizJSON('study-strategy');
        const examQuestion = quiz.questions[6];
        const urgentIndex = examQuestion.options.findIndex((o) => o.tag === 'exam_urgent');
        expect(urgentIndex, 'study-strategy Q7 should offer an exam_urgent option').toBeGreaterThanOrEqual(0);

        const urgent = quiz.questions.map((q, i) => (i === 6 ? urgentIndex : 0));
        expect(window.SLAQuiz.generateStudyPlan(quiz, urgent).urgency).toContain('exam is very close');

        const farIndex = examQuestion.options.findIndex(
            (o) => o.tag !== 'exam_urgent' && o.tag !== 'exam_soon'
        );
        const relaxed = quiz.questions.map((q, i) => (i === 6 ? farIndex : 0));
        expect(window.SLAQuiz.generateStudyPlan(quiz, relaxed).urgency).toBeNull();
    });
});

describe('dominantDomains (exhaustion check)', () => {
    const d = (name, percentage) => ({ name, percentage, score: 0, max: 12 });

    it('returns the single highest domain', () => {
        const top = window.SLAQuiz.dominantDomains(
            [d('Mental', 80), d('Physical', 20), d('Emotional', 30), d('Stress', 40)],
            { within: 10, floor: 15, limit: 2 }
        );
        expect(top.map((x) => x.name)).toEqual(['Mental']);
    });

    it('treats a domain within the tolerance as co-dominant', () => {
        const top = window.SLAQuiz.dominantDomains(
            [d('Mental', 83), d('Physical', 25), d('Emotional', 33), d('Stress', 78)],
            { within: 10, floor: 15, limit: 2 }
        );
        expect(top.map((x) => x.name)).toEqual(['Mental', 'Stress']);
    });

    it('honours the limit when more domains tie', () => {
        const top = window.SLAQuiz.dominantDomains(
            [d('Mental', 50), d('Physical', 50), d('Emotional', 50), d('Stress', 50)],
            { within: 10, floor: 15, limit: 2 }
        );
        expect(top).toHaveLength(2);
    });

    it('returns nothing when the top score is below the floor', () => {
        const top = window.SLAQuiz.dominantDomains(
            [d('Mental', 10), d('Physical', 8), d('Emotional', 0), d('Stress', 5)],
            { within: 10, floor: 15, limit: 2 }
        );
        expect(top).toEqual([]);
    });

    it('returns nothing for an all-zero run rather than every domain', () => {
        const top = window.SLAQuiz.dominantDomains(
            [d('Mental', 0), d('Physical', 0), d('Emotional', 0), d('Stress', 0)],
            { within: 10, floor: 15, limit: 2 }
        );
        expect(top).toEqual([]);
    });

    it('is safe on an empty domain list', () => {
        expect(window.SLAQuiz.dominantDomains([], {})).toEqual([]);
    });
});

describe('tiredness quiz', () => {
    const quiz = loadQuizJSON('tiredness');

    // "Not at all" must be worth 0, not 1 - a student who reports no
    // exhaustion at all has to land on 0%, or the whole tool reads as
    // "everyone is at least a bit exhausted".
    it('scores an all-"Not at all" run as 0%', () => {
        const r = window.SLAQuiz.scoreQuiz(quiz, answerAll(quiz, 0));
        expect(r.percentage).toBe(0);
        expect(r.totalScore).toBe(0);
    });

    it('scores an all-"Very much" run as 100%', () => {
        const r = window.SLAQuiz.scoreQuiz(quiz, answerAll(quiz, 3));
        expect(r.percentage).toBe(100);
        expect(r.maxScore).toBe(45);
    });

    it('splits into the four documented domains with 12/12/12/9 maxima', () => {
        const r = window.SLAQuiz.scoreQuiz(quiz, answerAll(quiz, 3));
        expect(r.domains.map((x) => x.name)).toEqual(['Mental', 'Physical', 'Emotional', 'Stress']);
        expect(r.domains.map((x) => x.max)).toEqual([12, 12, 12, 9]);
    });

    it('normalises domains of different length, so Stress can still win', () => {
        // Stress = 3 questions at "Very much" (9/9), everything else at 0.
        const answers = quiz.questions.map((q) => (q.domain === 'Stress' ? 3 : 0));
        const r = window.SLAQuiz.scoreQuiz(quiz, answers);
        const top = window.SLAQuiz.dominantDomains(r.domains, {
            within: quiz.coDominantWithin, floor: quiz.dominantFloor, limit: quiz.maxDominant
        });
        expect(top.map((x) => x.name)).toEqual(['Stress']);
        expect(top[0].percentage).toBe(100);
    });

    it('has an action plan for every domain it can report', () => {
        Object.keys(quiz.domains).forEach((name) => {
            expect(quiz.plans[name], `${name} plan`).toBeTruthy();
            expect(quiz.plans[name].lead.length, `${name} lead`).toBeGreaterThan(10);
        });
    });
});

// The "Download as Image" path rasterises the card through an SVG
// <foreignObject>. jsdom can't rasterise, so these cover the two places that
// silently produced a blank-white PNG instead of the card.
describe('downloadResultCard image building', () => {
    function offScreenHolder(innerHTML) {
        const holder = document.createElement('div');
        // exactly how downloadResultCard parks the card to measure it
        holder.setAttribute('style', 'position:fixed;left:-10000px;top:0;width:900px;background:#ffffff;padding:24px;');
        holder.innerHTML = innerHTML;
        document.body.appendChild(holder);
        return holder;
    }

    it('does not carry the off-screen positioning into the foreignObject', () => {
        const holder = offScreenHolder('<p>Your result</p>');
        const svg = window.SLAQuiz.buildForeignObject(holder, 900, 400);
        const embedded = svg.querySelector('foreignObject > div > div');

        expect(embedded, 'embedded copy').toBeTruthy();
        // A fixed box at left:-10000px inside the SVG is laid out 10,000px to
        // the left of the viewport, so every pixel rasterises as blank white.
        expect(embedded.style.position).toBe('static');
        expect(embedded.style.left).toBe('auto');
        expect(embedded.style.top).toBe('auto');

        const serialized = new XMLSerializer().serializeToString(svg);
        expect(serialized).not.toContain('-10000px');
        expect(serialized).toContain('position: static');
    });

    it('keeps the live card untouched while exporting', () => {
        const holder = offScreenHolder('<p>Your result</p>');
        window.SLAQuiz.buildForeignObject(holder, 900, 400);
        // the measuring holder itself stays parked off-screen; only the
        // embedded copy is re-positioned
        expect(holder.style.position).toBe('fixed');
    });

    it('pins an exact size on text-free boxes and a minimum on text boxes', () => {
        const holder = offScreenHolder(
            '<div id="track" style="height:10px;width:200px"></div>' +
            '<div id="label" style="height:20px;width:200px">Mental Exhaustion</div>'
        );
        window.SLAQuiz.inlineStyles(holder);

        // The bar track has no text and must hold its 10px, or the coloured
        // fill inside it collapses to nothing.
        expect(holder.querySelector('#track').style.height).toBe('10px');
        // The label may re-wrap in the rasteriser's fallback font, so it gets
        // room to grow instead of being drawn through by the bar below it.
        expect(holder.querySelector('#label').style.minHeight).toBe('20px');
        expect(holder.querySelector('#label').style.height).toBe('');
    });

    it('inlines the offsets an absolutely positioned child needs', () => {
        // .score-ring-label is centred with top/left 50% + translate(-50%,-50%);
        // without these the ring's percentage lands outside the ring.
        const holder = offScreenHolder(
            '<div id="pct" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)">64%</div>'
        );
        window.SLAQuiz.inlineStyles(holder);
        const pct = holder.querySelector('#pct');
        expect(pct.style.position).toBe('absolute');
        expect(pct.style.top).toBe('50%');
        expect(pct.style.left).toBe('50%');
        expect(pct.style.transform).toContain('translate');
    });
});

describe('session state', () => {
    it('round-trips answers through sessionStorage', () => {
        window.SLAQuiz.writeState({ userName: 'Asha', quizId: 'vark', answers: [1, 2, 3] });
        const state = window.SLAQuiz.readState();
        expect(state.userName).toBe('Asha');
        expect(state.answers).toEqual([1, 2, 3]);
    });

    it('clearAnswers drops the run but keeps the name', () => {
        window.SLAQuiz.writeState({ userName: 'Asha', quizId: 'vark', answers: [1, 2, 3] });
        window.SLAQuiz.clearAnswers();
        const state = window.SLAQuiz.readState();
        expect(state.answers).toBeUndefined();
        expect(state.quizId).toBeUndefined();
        expect(state.userName).toBe('Asha');
    });
});
