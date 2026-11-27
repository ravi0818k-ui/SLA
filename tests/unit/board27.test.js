/**
 * Board Exam 2027 self-study ad page (index-board27.html -> /selfstudy-ads-8-board-2027/, alias /ads-8/, 2026-11-27)
 * and its learner-type quiz (QuizQuestions/learner-type.json: study-HABIT types, not learning styles).
 * Copy deck: Documents\Super_Learner_Academy\Board_2027_Campaign\Board2027_Copy_Deck.md, sections 1 and 2.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createRequire } from 'module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const root = resolve(__dirname, '..', '..');
const read = (f) => readFileSync(resolve(root, f), 'utf-8');
const { buildPage } = require('../../scripts/build-ad-pages.js');

const SOURCE = 'index-board27.html';
const PATH = 'selfstudy-ads-8-board-2027';
const QUIZ_LINK = 'quiz.html#/username/learner-type';
const cfg = JSON.parse(read('ad-pages.json'));
const html = read(SOURCE);
const data = JSON.parse(read('data.json'));
const TYPES = ['Re-Reader', 'Last-Minute Crammer', 'Solution Watcher', 'Deep-Thinking Drifter', 'Self-Tester'];

const doc = () => new JSDOM(html).window.document;
const norm = (s) => s.replace(/\s+/g, ' ').trim();
/** Visible text of the page body in one mode: drops scripts and the blocks hidden in that mode. */
function visibleText(free, opts = {}) {
    const body = doc().body;
    body.querySelectorAll(free ? '[data-paid]' : '[data-free]').forEach((el) => el.remove());
    body.querySelectorAll('script, noscript, style, [hidden]').forEach((el) => el.remove());
    if (opts.dropFootNote) body.querySelectorAll('.sla-foot-note').forEach((el) => el.remove());
    return norm(body.textContent);
}

describe('registered as an ad page and in the site map', () => {
    const page = cfg.pages.find((p) => p.source === SOURCE);

    it('is in ad-pages.json with the /ads-8/ alias', () => {
        expect(page).toBeTruthy();
        expect(page.path).toBe(PATH);
        expect(page.aliases).toEqual(['ads-8']);
        expect(page.label).toMatch(/2027/);
    });

    it('is in site-nav.js SITE_MAP (Workshop pages) and stays out of sitemap.xml', () => {
        const nav = read('site-nav.js');
        expect(nav).toMatch(new RegExp(`path: '${PATH}/'[^\\n]*also: \\['ads-8/', '${SOURCE}'\\]`));
        expect(read('sitemap.xml')).not.toContain(PATH);
        expect(read('sitemap.xml')).not.toContain('ads-8');
    });

    it('the generated page and its alias are up to date with the source (npm run build:ads)', () => {
        const built = buildPage(html, page, cfg);
        expect(read(`${PATH}/index.html`)).toBe(built);
        expect(read('ads-8/index.html')).toBe(built);
        expect(built).toContain(`<link rel="canonical" href="${cfg.baseUrl}/${PATH}/">`);
        expect(built).toContain('<meta name="robots" content="noindex, follow">');
    });

    it('the homepage points board-2027 visitors at the page (CBSE + State Board tabs)', () => {
        const home = new JSDOM(read('index.html')).window.document;
        for (const id of ['panel-cbse', 'panel-state']) {
            const a = home.querySelector(`#${id} a[href="${PATH}/"]`);
            expect(a, id).not.toBeNull();
            expect(a.textContent).toMatch(/Board exam 2027/);
        }
    });
});

describe('copy: the board 2027 story, bound to data.json "board27"', () => {
    it('leads with the copy-deck hero and binds every key to data.json board27', () => {
        expect(data.board27.heroTitle).toMatch(/Tuition, coaching, self-study/);
        expect(data.board27.heroEyebrow).toMatch(/Class 10 & 12/);
        expect(data.board27.heroEyebrow).toMatch(/2027/);
        expect(html).not.toMatch(/data-bind(?:-html|-href)?="(?:bright|board|parents|hindi|pro)\./);
        const keys = [...html.matchAll(/data-bind(?:-html|-href)?="board27\.(\w+)"/g)].map((m) => m[1]);
        expect(keys.length).toBeGreaterThan(10);
        for (const k of new Set(keys)) expect(typeof data.board27[k], k).toBe('string');
        for (const k of ['topBar', 'dateRange', 'heroEyebrow', 'heroTitle', 'heroSub', 'buttonText', 'stickyText', 'trustLine', 'whatsappText', 'whatsappChat'])
            expect(typeof data.board27[k], k).toBe('string');
    });

    it('has free-mode wording for its buttons and trust line (no price)', () => {
        for (const k of ['buttonText', 'stickyText', 'trustLine']) {
            const v = data.freeSignup.copy[`board27.${k}`];
            expect(v, k).toBeTruthy();
            expect(v).not.toMatch(/₹|price|refund|UPI/i);
        }
    });

    it('has the story sections in order and drops the off-message "topper" section', () => {
        const ids = [...html.matchAll(/<section[^>]*id="([^"]+)"/g)].map((m) => m[1]);
        const want = ['top', 'kya-ye-aap-ho', 'ruk-kar-socho', 'workshop', 'learner-type', 'kiske-liye', 'coach', 'vaada', 'faq'];
        expect(ids.filter((id) => want.includes(id))).toEqual(want);
        expect(ids).not.toContain('topper');
        expect(visibleText(false)).not.toMatch(/topper/i);
        expect((html.match(/class="b-vs-row"/g) || []).length).toBeGreaterThanOrEqual(8); // 4-row comparison + the promise table
    });

    it('pain cards are our lines in the student voice, not testimonials (no names, quotes or review styling)', () => {
        const cards = doc().querySelectorAll('#kya-ye-aap-ho .b-pain');
        expect(cards.length).toBe(5);
        for (const c of cards) {
            expect(c.tagName).not.toBe('BLOCKQUOTE');
            expect(c.className).not.toMatch(/review|testimonial/);
            expect(c.textContent).not.toMatch(/[“”"]/);
            expect(c.querySelector('footer, cite')).toBeNull();
        }
        expect(html).not.toContain('id="reviews"');
        expect(data.bright.showTestimonials).toBe(false);
    });

    it('keeps the three pillars and the honest goal line', () => {
        const text = visibleText(false);
        for (const p of ['Memory & Brain', 'Study & Focus', 'Mindset & Learning']) expect(text).toContain(p);
        expect(text).toMatch(/Lakshya: aap itna khud padhna seekh jao ki har tuition aur coaching ka ghanta sach mein kaam aaye/);
        expect(text).toMatch(/Kya mujhe tuition ya coaching chhodni padegi\? Nahi\./);
    });

    it('never promises marks, %, rank, results or "no coaching needed", and never attacks tuition', () => {
        for (const free of [true, false]) {
            // the standard footer note ("we don't promise any marks, rank or job") and the honest "guarantee? Nahi." FAQ are the
            // only places these words may appear; the copy fields are checked without the _help note and the WhatsApp URL
            const copy = Object.entries(data.board27).filter(([k]) => k !== '_help' && k !== 'whatsappChat').map(([, v]) => v).join(' ');
            const text = visibleText(free, { dropFootNote: true }).replace('Kya aap marks ki guarantee dete ho?', '') + ' ' + copy;
            expect(text).not.toMatch(/guarantee|\d+\s*%|percent|\brank\b|topper|pakka|100 ?%/i);
            expect(text).not.toMatch(/(?:coaching|tuition)(?: ki)? (?:zaroorat|jarurat) nahi/i);
            expect(text).not.toMatch(/marks? (?:badh|improve)\w* (?:honge|jaayenge|karenge)|result (?:pakka|guaranteed)/i);
            expect(text).not.toMatch(/tuition (?:bekaar|bekar|waste)|coaching (?:bekaar|bekar|waste)/i);
        }
        // the one "guarantee" on the page is the honest FAQ that says no
        const faq = [...doc().querySelectorAll('.faq-item')].find((i) => /guarantee/.test(i.textContent));
        expect(norm(faq.querySelector('.faq-answer').textContent)).toMatch(/^Nahi\./);
    });

    it('stock photos are reused from Images/photos and never captioned as students', () => {
        const imgs = [...doc().querySelectorAll('img')].filter((i) => /Images\/photos\//.test(i.getAttribute('src')));
        expect(imgs.length).toBeGreaterThanOrEqual(3);
        for (const img of imgs) {
            expect(existsSync(resolve(root, img.getAttribute('src'))), img.getAttribute('src')).toBe(true);
            expect(img.getAttribute('alt')).not.toMatch(/student|topper|result/i);
            expect(img.closest('figure')).toBeNull();
        }
    });

    it('title, description and og tags are set for this page, with no price in the title', () => {
        const d = doc();
        expect(d.title).toMatch(/Board Exam 2027/);
        expect(d.title).not.toMatch(/₹|\d{2,} ?(?:rs|inr)/i);
        expect(d.querySelector('meta[name="description"]').content).toMatch(/Class 10 & 12/);
        expect(d.querySelector('meta[property="og:url"]').content).toBe(`${cfg.baseUrl}/${PATH}/`);
        expect(d.querySelector('meta[property="og:title"]').content).toMatch(/atak jaate ho/);
    });
});

describe('FAQ JSON-LD matches the visible FAQ', () => {
    it('same questions and answers, in order (paid-mode set; the free twin of the refund question is skipped)', () => {
        const d = doc();
        const ld = [...d.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent)).find((j) => j['@type'] === 'FAQPage');
        const visible = [...d.querySelectorAll('.faq-item:not([data-free])')].map((i) => ({
            q: norm(i.querySelector('.faq-question span').textContent),
            a: norm(i.querySelector('.faq-answer').textContent)
        }));
        expect(ld.mainEntity.map((e) => e.name)).toEqual(visible.map((v) => v.q));
        expect(ld.mainEntity.map((e) => norm(e.acceptedAnswer.text))).toEqual(visible.map((v) => v.a));
        // the copy-deck FAQs are there, and the shared free/price, language, timing and no-upsell ones are kept
        const qs = visible.map((v) => v.q).join('\n');
        for (const q of ['Kya mujhe tuition ya coaching chhodni padegi?', 'Board exam 2027 paas hai. Abhi ye workshop kyun?',
            'Kya ye Science, Commerce aur Arts sab ke liye hai?', 'Kya aap marks ki guarantee dete ho?', 'Workshop kis language mein hai?',
            'Class kab aur kaise hoti hai?', 'Kya end mein koi aur course bechenge?', 'Refund policy kya hai?']) expect(qs).toContain(q);
        expect(d.querySelector('.faq-item[data-free]').textContent).toMatch(/free kyun hai/);
    });
});

describe('learner-type survey links', () => {
    it('the survey block, hero link and final CTA point at the learner-type quiz (and the built page keeps it working)', () => {
        const d = doc();
        expect(d.querySelector('#learner-type h2').textContent).toBe('Aap kis type ke learner ho?');
        expect(d.querySelector(`#learner-type a[href="${QUIZ_LINK}"]`).textContent).toMatch(/Free survey shuru karein/);
        expect(d.querySelector(`#top a[href="${QUIZ_LINK}"]`).textContent).toMatch(/Aap kis type ke learner ho\?/);
        expect(d.querySelector('#learner-type').textContent).toMatch(/aapke dimaag ki banawat nahi\. Aadat badal sakti hai\./);
        expect(read(`${PATH}/index.html`)).toContain(`href="../${QUIZ_LINK}"`);
    });

    it('never links or promotes the VARK or Brain Dominance quizzes', () => {
        const hrefs = [...doc().querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).join(' ');
        expect(hrefs).not.toMatch(/vark|brain-dominance/i);
        expect(visibleText(false) + visibleText(true)).not.toMatch(/vark|brain dominance|learning style|visual learner|auditory/i);
    });
});

describe('learner-type quiz (QuizQuestions/learner-type.json)', () => {
    const quiz = JSON.parse(read('QuizQuestions/learner-type.json'));
    const hi = JSON.parse(read('QuizQuestions/hi/learner-type.json'));
    const catalogue = JSON.parse(read('QuizQuestions/index.json'));

    beforeEach(() => {
        delete window.SLAQuiz;
        document.body.innerHTML = '<main id="app"></main><div id="confetti-container"></div>' +
            '<div id="quiz-dialog" hidden><button data-dialog-cancel></button><button data-dialog-confirm></button></div>';
        new Function(read('quiz.js'))();
    });

    it('is a keyed tally quiz (no new scorer) with 10 questions, one option per habit type', () => {
        expect(quiz.scorer).toBe('tally-option');
        expect(quiz.widget).toBe('profile');
        expect(quiz.title).toBe('What Type of Learner Are You?');
        expect(quiz.questions.length).toBe(10);
        for (const q of quiz.questions) expect(q.options.map((o) => o.key).sort()).toEqual(TYPES.slice().sort());
        expect(Object.keys(quiz.profiles).sort()).toEqual(TYPES.slice().sort());
    });

    it('is listed first in the catalogue, in both languages', () => {
        expect(catalogue.sections[0].quizzes[0].id).toBe('learner-type');
        expect(catalogue.sections[0].quizzes[0].questions).toBe(10);
        const hiCat = JSON.parse(read('QuizQuestions/hi/index.json'));
        expect(hiCat.sections[0].quizzes.length).toBe(catalogue.sections[0].quizzes.length);
        expect(hiCat.sections[0].quizzes[0].title).toMatch(/लर्नर/);
    });

    it.each(TYPES)('answering every %s option gives that type', (type) => {
        const answers = quiz.questions.map((q) => q.options.findIndex((o) => o.key === type));
        const r = window.SLAQuiz.scoreQuiz(quiz, answers);
        expect(r.top.name).toBe(type);
        expect(r.top.value).toBe(10);
        expect(r.secondary).toBeNull();
    });

    it('every profile has a name, a short description, first-fix steps; every result carries the habit line', () => {
        for (const t of TYPES) {
            const p = quiz.profiles[t];
            expect(p.name).toMatch(/^The /);
            expect(p.description.length).toBeGreaterThan(60);
            expect(p.description.length).toBeLessThan(400);
            expect(p.steps.length).toBeGreaterThanOrEqual(2);
            expect(hi.profiles[t].steps.length).toBe(p.steps.length);
        }
        expect(quiz.stepsTitle).toMatch(/First fix/);
        expect(quiz.disclaimer).toMatch(/^This is your study habit today, not how your brain is wired\. Habits can change/);
        const all = JSON.stringify({ ...quiz, _note: '' });
        expect(all).not.toMatch(/visual learner|auditory|kinesthetic|left.brain|right.brain|guarantee|\d+\s*%/i);
    });

    it('the result links back to this workshop page (rendering is tested in quiz-render.test.js)', () => {
        expect(quiz.cta.href).toBe(`${PATH}/`);
        expect(existsSync(resolve(root, PATH, 'index.html'))).toBe(true);
        expect(hi.cta.href).toBeUndefined();
    });

    it('a mixed set of answers gives a top type and a secondary type', () => {
        const answers = quiz.questions.map((q, i) => q.options.findIndex((o) => o.key === (i < 6 ? 'Re-Reader' : 'Last-Minute Crammer')));
        const r = window.SLAQuiz.scoreQuiz(quiz, answers);
        expect(r.top.name).toBe('Re-Reader');
        expect(r.secondary.name).toBe('Last-Minute Crammer');
    });
});
