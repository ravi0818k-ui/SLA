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
        expect(data.board27.heroTitle).toMatch(/Padha hua .*bhoolna band karo/);
        expect(data.board27en.heroTitle).toMatch(/Stop forgetting .*what you study/);
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
        expect(d.querySelector('meta[property="og:title"]').content).toMatch(/bhoolna band karo/);
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

describe('next batch date (2026-11-27): "Agla batch shuru: Shanivaar, 28 Nov · 7:00 PM IST"', () => {
    const IST = (s) => Date.parse(s + '+05:30');
    let SLA;
    beforeEach(() => {
        delete window.SLA;
        document.documentElement.innerHTML = html;
        new Function(read('script.js'))();
        SLA = window.SLA;
    });

    it('is hidden in the static HTML, so no stale date shows without JavaScript', () => {
        const wraps = doc().querySelectorAll('[data-next-batch-wrap]');
        expect(wraps.length).toBe(2);   // hero + countdown section
        for (const w of wraps) {
            expect(w.hasAttribute('hidden')).toBe(true);
            expect(w.querySelector('[data-next-batch]').textContent).toBe('');
        }
    });

    it('shows the coming Saturday from data.json countdown.weekly and un-hides both lines', () => {
        const iso = SLA.initNextBatch(data, IST('2026-11-27T10:00:00'));   // a Friday
        expect(iso).toBe('2026-11-28T19:00:00+05:30');
        const wraps = document.querySelectorAll('[data-next-batch-wrap]');
        for (const w of wraps) {
            expect(w.hidden).toBe(false);
            expect(w.querySelector('[data-next-batch]').textContent).toBe('Shanivaar, 28 Nov · 7:00 PM IST');
        }
        expect(norm(document.querySelector('.b-next').textContent)).toBe('🗓️ Agla batch shuru: Shanivaar, 28 Nov · 7:00 PM IST');
    });

    it('after Saturday 7 PM it moves to the next week, same as the countdown', () => {
        expect(SLA.initNextBatch(data, IST('2026-11-28T19:00:00'))).toBe('2026-12-05T19:00:00+05:30');
        expect(document.querySelector('[data-next-batch]').textContent).toBe('Shanivaar, 5 Dec · 7:00 PM IST');
        expect(SLA.initNextBatch(data, IST('2026-12-31T23:30:00'))).toBe('2027-01-02T19:00:00+05:30');
    });

    it('formats English and morning times too', () => {
        expect(SLA.formatNextBatch('2026-11-28T19:00:00+05:30', 'en')).toBe('Saturday, 28 Nov · 7:00 PM IST');
        expect(SLA.formatNextBatch('2027-01-03T09:30:00+05:30', 'hi')).toBe('Ravivaar, 3 Jan · 9:30 AM IST');
        expect(SLA.formatNextBatch('2027-01-03T12:00:00+05:30', 'en')).toBe('Sunday, 3 Jan · 12:00 PM IST');
        expect(SLA.formatNextBatch('', 'hi')).toBe('');
    });

    it('does nothing without a weekly schedule', () => {
        expect(SLA.initNextBatch({ countdown: { endDate: '2026-12-01T19:00:00+05:30' } })).toBeNull();
        expect(document.querySelector('[data-next-batch-wrap]').hidden).toBe(true);
    });
});

describe('"Workshop mein kya-kya hai" at-a-glance tiles (2026-11-27)', () => {
    it('sits right after the hero and lists the 6 true inclusions', () => {
        const d = doc();
        const sec = d.getElementById('kya-milega');
        expect(sec).not.toBeNull();
        expect(sec.previousElementSibling.id).toBe('top');
        const titles = Array.from(sec.querySelectorAll('.b-glance-grid > li strong')).map((s) => norm(s.textContent.replace('→', '')));
        expect(titles).toEqual(['3 din LIVE class', 'Practical assignments', 'Breathing aur meditation', 'Learner-type survey',
            'Maths ka 4-step routine', 'Certificate + WhatsApp group']);
    });

    it('the survey tile opens the learner-type quiz, also from the built ad page', () => {
        expect(doc().querySelector('#kya-milega .b-glance-link').getAttribute('href')).toBe(QUIZ_LINK);
        const built = new JSDOM(read(`${PATH}/index.html`)).window.document;
        expect(built.querySelector('#kya-milega .b-glance-link').getAttribute('href')).toBe('../' + QUIZ_LINK);
    });

    it('makes no invented claims: no student counts, %, marks or price', () => {
        const t = norm(doc().getElementById('kya-milega').textContent);
        expect(t).not.toMatch(/\d{3,}|\d\s*\+|%|marks|topper|guarantee|₹|students? (trained|benefit)/i);
    });

    it('the price card lists assignments, breathing/meditation and the survey too', () => {
        const items = Array.from(doc().querySelectorAll('#price .b-checks li')).map((li) => norm(li.textContent));
        expect(items).toContain('Practical assignments: editable PDF worksheets, apne syllabus par');
        expect(items).toContain('Guided breathing aur meditation practice');
        expect(items).toContain('Free learner-type survey (3 minute)');
    });
});

describe('English twin: index-board27-en.html -> /selfstudy-ads-9-board-2027-english/ (alias /ads-9/, 2026-11-27)', () => {
    const EN = 'index-board27-en.html';
    const EN_PATH = 'selfstudy-ads-9-board-2027-english';
    const enHtml = read(EN);
    const en = () => new JSDOM(enHtml).window.document;
    const count = (d, sel) => d.querySelectorAll(sel).length;

    it('is registered as an ad page with the /ads-9/ alias, and both built copies exist', () => {
        const page = cfg.pages.find((p) => p.source === EN);
        expect(page.path).toBe(EN_PATH);
        expect(page.aliases).toEqual(['ads-9']);
        expect(existsSync(resolve(root, `${EN_PATH}/index.html`))).toBe(true);
        expect(read('ads-9/index.html')).toBe(read(`${EN_PATH}/index.html`));
    });

    it('is English and binds only to data.json "board27en" (plus shared keys), every key existing', () => {
        expect(enHtml).toMatch(/<html lang="en">/);
        expect(enHtml).not.toMatch(/data-bind(?:-html|-href)?="board27\./);
        const keys = [...enHtml.matchAll(/data-bind(?:-html|-href)?="board27en\.([^"]+)"/g)].map((m) => m[1]);
        expect(keys.length).toBeGreaterThan(10);
        for (const k of new Set(keys)) expect(typeof data.board27en[k], k).toBe('string');
        expect(enHtml).toContain('data-bind="promise.englishShort"');
        for (const k of ['buttonText', 'stickyText', 'trustLine']) expect(data.freeSignup.copy[`board27en.${k}`]).toMatch(/free/i);
    });

    it('has the same sections and the same number of cards, rows, steps and FAQs as the Hinglish page', () => {
        const a = doc(), b = en();
        for (const sel of ['main > section', '.b-glance-grid > li', '.b-pain', '.b-vs-row', '.b-day', '.b-mini-steps li', '.b-type-chips li',
            '.b-steps > li', '#price .b-checks li', '.faq-item', '[data-next-batch]', 'a[href="quiz.html#/username/learner-type"]', '[data-paid]', '[data-free]']) {
            expect(count(b, sel), sel).toBe(count(a, sel));
        }
        expect((enHtml.match(/"@type": "Question"/g) || []).length).toBe(count(b, '.faq-item:not([data-free])'));
    });

    it('has no Hinglish in its visible text (apart from the link back to the Hinglish page)', () => {
        const body = en().body;
        body.querySelectorAll('script, style, .b-lang').forEach((el) => el.remove());
        const text = norm(body.textContent);
        expect(text).not.toMatch(/\b(hai|hain|karein|kaise|aap|aapka|mein|nahi|kya|kyun|padhai|seekh\w*|sawal|yaad|bhi|toh|din|ghante|Shanivaar|karo|wahi)\b/i);
        expect(text).toMatch(/Taught in Hinglish/);   // honest: the class itself is in Hinglish
        expect(text).toMatch(/live classes are taught in Hinglish/);
    });

    it('the two pages link to each other, also from the built ad pages', () => {
        expect(en().querySelector('.b-lang a').getAttribute('href')).toBe('selfstudy-ads-8-board-2027/');
        expect(doc().querySelector('.b-lang a').getAttribute('href')).toBe(EN_PATH + '/');
        const builtEn = new JSDOM(read(`${EN_PATH}/index.html`)).window.document;
        const builtHi = new JSDOM(read(`${PATH}/index.html`)).window.document;
        expect(builtEn.querySelector('.b-lang a').getAttribute('href')).toBe('../selfstudy-ads-8-board-2027/');
        expect(builtHi.querySelector('.b-lang a').getAttribute('href')).toBe(`../${EN_PATH}/`);
        expect(builtEn.querySelector('#whats-inside .b-glance-link').getAttribute('href')).toBe('../' + QUIZ_LINK);
    });

    it('shows the next batch in English', () => {
        delete window.SLA;
        document.documentElement.innerHTML = enHtml;
        new Function(read('script.js'))();
        window.SLA.initNextBatch(data, Date.parse('2026-11-27T10:00:00+05:30'));
        expect(norm(document.querySelector('.b-next').textContent)).toBe('🗓️ Next batch starts: Saturday, 28 Nov · 7:00 PM IST');
        expect(document.querySelector('.b-next-sm').textContent).toBe('Next batch: Saturday, 28 Nov · 7:00 PM IST');
    });

    it('the "Outside India?" bar on the Hinglish page links to this English twin, not the generic English page', () => {
        delete window.SLA;
        document.documentElement.innerHTML = html;
        new Function(read('script.js'))();
        const bar = window.SLA.initAbroadBar(data, { tz: 'Europe/London', now: Date.parse('2026-11-27T10:00:00Z'), search: '' });
        expect(bar.querySelector('a.sla-abroad-en').getAttribute('href')).toBe(EN_PATH + '/');
    });

    it('makes the same no-promise claims check as the Hinglish tiles', () => {
        const t = norm(en().getElementById('whats-inside').textContent);
        expect(t).not.toMatch(/\d{3,}|\d\s*\+|%|marks|topper|guarantee|₹|students? (trained|benefit)/i);
    });
});

describe('word stickers on the section photos (2026-11-27)', () => {
    it('both Board 2027 pages tag the "who it\'s for" and final photos with words, never claims', () => {
        for (const f of ['index-board27.html', 'index-board27-en.html']) {
            const d = new JSDOM(read(f)).window.document;
            const words = Array.from(d.querySelectorAll('.b-tagged .b-sticker')).map((s) => s.textContent);
            expect(words, f).toEqual(['Active recall', 'Board 2027', 'Memory', 'Focus']);
            for (const w of words) expect(w, f).not.toMatch(/%|100|guarantee|topper|10x|marks/i);
            for (const s of d.querySelectorAll('.b-tagged .b-sticker')) expect(s.getAttribute('aria-hidden')).toBe('true');
        }
    });
});
