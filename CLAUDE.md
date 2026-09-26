# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A static (no build step) webinar registration landing page for Super Learner Academy — pure HTML/CSS/vanilla JS, deployed via GitHub Pages behind the custom domain in `CNAME` (`www.superlearneracademy.in`). Main pages: `index.html` (landing page), `thank-you.html` (post-payment page), `quiz.html` (the free "Know Yourself Better" assessment app) and `mindmap/` (the OpenMind mind-map editor) — the last two have their own sections below. All copy, prices, dates, and links are non-technical and driven from `data.json` so the page can be updated without editing HTML. See `theme.md` for the color/typography/spacing design system (source of truth is `style.css`'s `:root` tokens — `design-reference.md` describes an earlier/different project variant and should not be used for this site's actual styling).

Registration currently goes through **SuperProfile** (`data.json`'s `registration.link`), which redirects straight to `thank-you.html` with no query param, webhook, or transaction id to confirm payment — `initThankYouPage` in `script.js` always shows the "paid" view (no gate). `razorpay.md` documents a **future** migration plan to Razorpay (payment verification, webhook-to-Google-Sheets); none of that is live yet, so don't assume Razorpay params/verification exist.

## Positioning & content niche

All copy on this site is written to one niche — **helping students get better grades by teaching practical, science-informed strategies for memory, focus, study skills, and growth mindset.** `niche.md` is the full reference (audience profile, pain vocabulary, pillar topic banks, message hierarchy, off-niche list); the working rules are below. When editing headlines, section copy, FAQ answers, testimonials, or `data.json` text, keep it inside this frame:

- **Target reader** is a *student* (teens through graduation; board/JEE/NEET/UPSC/CA aspirants), secondarily their parents. Working professionals and lifelong learners are a footnote, not the lead — the "Who This Event Is For" list is deliberately ordered students-first.
- **The pain** is *studying hard but marks not moving*: forgetting by exam day, long hours with average results, focus breaking in minutes, re-reading/highlighting as the only method, no revision system, and the self-image of being "just an average student." The `#challenges` section is written against exactly these six.
- **The promised outcome** is *better grades through smarter method, not more hours*. Lead with the grade/score result; skills (recall, focus, calm) are the mechanism, not the headline.
- **Three content pillars** structure the whole page, and each maps to one workshop day. Keep this mapping consistent everywhere it appears (`#pillars` cards, the three `.day-card`s in `#curriculum`, the hero's `.hero-features`, the hero orbit badges, and the "What will I learn in 3 days" FAQ answer) — changing one means changing all of them:
  1. **Memory & Brain** (Day 1) — Hook System, observation training, neurobics, how the brain learns
  2. **Study & Focus** (Day 2) — active recall, spaced practice, revision scheduling, concentration
  3. **Mindset & Learning** (Day 3) — growth mindset, self-talk, meditation, learner identity/exam confidence

**Two content rules that are easy to violate:**

- **No pseudo-scientific claims.** "Photographic memory" was deliberately removed from the hero orbit badges (replaced with "Growth Mindset") because it undercuts the science-informed positioning. Don't reintroduce it or similar — memory palaces, mnemonics, spaced repetition, neuroplasticity are defensible; eidetic memory, "10% of your brain", learning-style-as-fixed-neurology are not. Name real techniques, and explain the *mechanism* — that's what the `#science` ("Why These Techniques Work") section exists for.
- **No invented outcome numbers.** The `.testimonial-result` badges in `#testimonials` summarise what each quote already claims — they must never carry a fabricated score ("+23%", "went from 60% to 85%"). There's an HTML comment above that grid saying testimonials must be replaced with real verified results before paid traffic; honour it. The "Will this actually improve my grades?" FAQ answer intentionally refuses to promise a number — don't "improve" it by adding one.

## Commands

```bash
npm test          # run full test suite once (vitest --run)
npm run test:watch  # watch mode
npx vitest run tests/unit/faq.test.js          # run a single file
npx vitest run tests/unit/faq.test.js -t "keyboard"  # run a single test by name
```

There is no build, lint, or dev-server script — open `index.html` directly or serve the folder statically to preview. **The mind-map app is the exception: it uses native ES modules, so it must be served over http** (`python -m http.server 8000` → `http://localhost:8000/mindmap/`); opening `mindmap/editor.html` from `file://` fails at the first import.

## Architecture

### Single-file JS with a `window.SLA` test surface

All behavior lives in `script.js` (one file, ~900 lines, IIFE-style top-level functions, no modules/imports). At the bottom, the internal functions that need testing are re-exported onto `window.SLA` (e.g. `SLA.loadData`, `SLA.injectContent`, `SLA.calculateTimeRemaining`, `SLA.getStickyVisibility`, `SLA.toggleFAQ`). Tests load `script.js` by reading the file and executing it with `new Function(scriptContent)` inside jsdom (see `tests/unit/data-loading.test.js`) — **jsdom does not execute injected `<script>` tags**, so this eval approach is the only way tests observe script.js behavior. When adding a new testable function, expose it on `window.SLA` the same way.

`document.addEventListener('DOMContentLoaded', ...)` at the bottom is the single entry point: it fetches `data.json`, then branches on `document.body.getAttribute('data-page') === 'thank-you'` to run either the thank-you page initializers (`playConfetti`, `initThankYouPage`) or the landing page initializers (`initCountdown`, `initFAQ`, `initStickyCTA`, `initScrollAnimations`, `initCoachImageFallback`, `initQuotesSlider`). Both branches call `initAnalytics`.

### Data-driven content via `data-bind` attributes

`data.json` is fetched at runtime and injected into the DOM through declarative attributes rather than templating:
- `data-bind="path.to.value"` → sets `textContent` (dot path resolved by `getNestedValue`)
- `data-bind-href="path.to.value"` → sets `href`
- `data-bind-html="path.to.value"` → sets `innerHTML` (used for FAQ answers in `data.json`'s `faq` section, which need `<strong>`)
- `data-dynamic-only` → hidden entirely if `data.json` fails to load

Strings bound either way may contain `{{path.to.value}}` placeholders, filled by `fillTemplate()` from the same `data.json` (e.g. `faq.price.answer` uses `{{registration.price}}`), so a price/date is defined once and reused in prose. Values substituted into `data-bind-html` are HTML-escaped; the template itself is not.

The static text/markup already in the HTML is the fallback shown when the fetch fails, so `index.html` and `thank-you.html` must always contain sane default copy, not placeholders. See `.kiro/specs/sla-webinar-landing-page/design.md` for the full schema and validation rules for `data.json`.

A disabled Google Sheets override path (`applySheetContent`, currently commented out in `script.js` around the `GOOGLE_SHEET_API_URL` block, plus `google-apps-script.js` on the Apps Script side) exists for optionally layering live-editable content on top of `data.json` — it was turned off for page-load speed, so don't assume it runs.

### Content-protection layer

`script.js` installs `contextmenu`/`keydown` listeners at load time (before any DOMContentLoaded logic) that block right-click, F12, Ctrl+Shift+I/J, Ctrl+U, Ctrl+S, Ctrl+C and show a popup via `showProtectionAlert()`. This is intentional (image/content protection for a paid funnel), not a bug — don't remove it as dead code.

### Testing strategy: unit + property-based, both via vitest/jsdom

- `tests/unit/*.test.js` — example-based tests (DOM structure, error handling, specific scenarios).
- `tests/properties/*.property.test.js` — [fast-check](https://github.com/dubzzz/fast-check) property tests (≥100 iterations) for pure logic functions, each tagged with a `Property N` comment matching the numbered properties in `.kiro/specs/sla-webinar-landing-page/design.md` (e.g. Property 1: sticky CTA visibility = `scrollY > 700`; Property 2: countdown component sum; Property 4: discount % = `Math.round((1 - current/original) * 100)`; Property 6: FAQ single-open invariant).
- `tests/setup.js` provides `loadHTML`, `setupDOM`, `loadScript`, `createMockData` helpers and resets `document.documentElement.innerHTML` + `localStorage` before each test.
- When changing a property's underlying formula in `script.js`, check whether the corresponding property text in `design.md` and the property test's generator/assertion need updating too.
- **`tests/unit/structure.test.js` has 3 known-stale failures** (pre-existing, unrelated to any current work): it asserts exactly 2 `.day-card`s when the curriculum has 3, expects every `img.coach-img` to carry the hero's alt text when the coach-section image has its own, and looks for `.next-step-card` on `thank-you.html` where no such class exists. `npm test` is therefore expected to report 2–3 failures on a clean tree (a fast-check date-formatting property test in `tests/properties/formatting.property.test.js` is also intermittently flaky) against ~143 passing — treat that as the baseline, and don't assume your change caused it.

### Analytics: two separate systems, don't conflate them

- **Data-driven** (`initAnalytics` in `script.js`): conditionally injects GTM/FB Pixel only when `data.json`'s `analytics.gtmId`/`analytics.fbPixel` are non-empty. Covered by `tests/unit/analytics.test.js`.
- **Hardcoded Google Ads tag** (`AW-738572260`): a static `gtag.js` snippet in the `<head>` of both `index.html` and `thank-you.html` (not sourced from `data.json`). `trackPurchaseConversion()` in `script.js`, called from `initThankYouPage`, fires the `AW-738572260/aFfQCPv8iOocEOTvluAC` "Purchase" conversion event with a static `value: 455` (matching `registration.price`) and empty `transaction_id` (SuperProfile gives no real transaction id to attach). It's guarded by a `sessionStorage` flag (`sla_conversion_fired`) so a refresh/reload of the thank-you page doesn't double-fire the conversion — only the first load per browser tab session fires it.

### Countdown persistence

Countdown end date is echoed into `localStorage` (`sla_countdown_endDate`) so refreshing the page doesn't reset the timer, but `data.json`'s `countdown.endDate` always takes precedence over a stale localStorage value (Property 3 in design.md).

### Hero decorative graphics: mandala halo + orbiting badges

`.hero-visual` (in `index.html`'s hero section) layers, back to front: `.hero-visual::before` (blurred radial-gradient glow), `.hero-mandala` (a background-image ring, `Images/mandala.svg`), `.hero-orbit` (four `.orbit-anchor` divs at N/E/S/W, each wrapping one `.hero-badge` pill), then `.hero-coach-img` on top. All of this is purely decorative (`aria-hidden="true"`) around the transparent-background host photo — no new image assets were needed for it.

- **`Images/mandala.svg` is generated, not hand-authored.** `scripts/generate_mandala.py` builds it from trig (concentric rings + rotated petal shapes) using the site's color tokens. Re-run that script (`py -3 scripts/generate_mandala.py`) rather than hand-editing the SVG.
- **Mandala and orbit rotation are kept in sync by matching timing, not by sharing one keyframe.** `.hero-mandala` animates `mandala-spin` (which bakes in its own centering `translate(-50%, -50%)`), `.hero-orbit` animates the separate `orbit-spin` (no translate to preserve, just `rotate(360deg)`) — both 90s linear infinite, so they stay phase-locked. Each `.hero-badge` runs `counter-mandala-spin` (same duration, opposite direction) so the pill/text stays upright while its anchor point is carried around the circle by the parent's rotation.
- **`.hero-orbit`'s z-index is deliberately below `.hero-coach-img`'s.** Because the host photo's background is transparent, an orbiting badge shows through wherever the photo is transparent and disappears behind opaque (body) pixels instead of drawing text over the face/book. This is intentional layering — don't "fix" it by raising the orbit's z-index above the photo.
- **Don't use `transform: scale()` to shrink the whole orbit/badge group on mobile.** It was tried for the ≤576px breakpoint and rejected: scaling an absolutely-positioned group pulls its edge-anchored children *inward* toward the scale origin, dragging badges that were safely outside the photo onto it. Instead the ≤576px media query shrinks each badge's own font-size/padding/icon-size and gives `.orbit-n/e/s/w` a tighter radius directly.
- **Positions (mandala center/radius, orbit radius, the earlier host-photo recentering) were derived by scanning the photo's alpha channel with Pillow**, not eyeballed — see `scripts/recenter_host_photo.py` for the pattern (bounding-box scan → compute the subject's true center vs. canvas center → shift/report the offset). If the host photo is ever replaced, its silhouette will differ, so these percentages may need recalculating the same way rather than copied as-is.

### Performance: no build step means no automatic image optimization

Ad traffic lands on `index.html` and needs to render fast, but there's no build-time image pipeline — whatever gets dropped into `Images/` is what ships. This repo has a history of multi-megabyte, full-resolution photos (e.g. 1080×1080 PNGs with an alpha-channel cutout background) displayed at a few hundred px (the hero coach photo, the "Meet Your Coach" section image). When adding or replacing a photo, manually resize to ~2x its rendered CSS size and export as WebP (Pillow works fine: `im.resize(...).save(path, 'WEBP', quality=80)`) — WebP preserves transparency and cuts these photos by ~95% with no visible quality loss at that setting. Always set `width`/`height` attributes (avoids layout shift) and `loading="lazy"` for anything below the fold; the hero image additionally uses `fetchpriority="high"` since it's the LCP element.

Font Awesome's stylesheet (cdnjs `all.min.css`) is loaded in `index.html`'s `<head>` via `rel="preload"` + an `onload` swap (with a `<noscript>` fallback), not a normal blocking `<link rel="stylesheet">` — this lets the hero paint without waiting on the CDN request. The hero's orbiting badges (see above) do use FA icons above the fold now, but the deferred load still works fine for them in practice (icons pop in a beat after paint, screenshot-verified) — don't "fix" this into a blocking `<link>` on that assumption alone. `thank-you.html` intentionally keeps Font Awesome render-blocking because its success checkmark (`fas fa-check`) is the first thing visible there; don't "fix" that inconsistency without checking whether the icon in question is above the fold on that page.

The Google Fonts `<link>` in `<head>` is the only loader for Montserrat/Inter — don't reintroduce a second `@import url(...)` for the same fonts inside `style.css` (one existed and was removed as a redundant render-blocking request).

## Quiz app (`quiz.html`)

A second, self-contained app in the same repo: 19 free self-assessments and 11 brain-training
tools, aimed at the same student audience as the landing page and used as a free lead magnet.
It was ported from a separate React/Vite project (`quiz-assessment-app`, since removed) into the
same no-build, vanilla-JS shape as the rest of the site. **There is no React, no bundler and no
npm dependency in it** - recharts, MUI, canvas-confetti, html-to-image, jspdf, pdfjs and epubjs
were all either hand-rolled or moved to on-demand CDN loads.

### Files

- `quiz.html` - the single shell page (`data-page="quiz"`). Like `index.html`, the static markup
  inside it is the real no-JS fallback, not a placeholder.
- `quiz.js` - hash router, quiz engine, scorers, result widgets, `window.SLAQuiz` test surface.
- `quiz-tools.js` - the 11 interactive tools. Loaded lazily, only on the first `#/tools/<id>` route.
- `quiz.css` - the ported `App.css` plus a block of additions for the components that replaced a
  React dependency. It re-declares the same `:root` tokens as `style.css`; keep the two in sync.
- `QuizQuestions/` - `index.json` (home-page catalogue) plus one file per quiz, and
  `reading-texts.json` for the Speed Reading practice passages.
- `media/` - `audio/` (6 MP3s) and `peg-system/` (30 WebP peg images).

### Routing and state

Hash router: `#/`, `#/username/<id>`, `#/quiz/<id>`, `#/results/<id>`, `#/tools/<id>`, `#/about`.
Hash-based deliberately - it needs no GitHub Pages 404 redirect hack and no server rewrite.
React Router's `location.state` became `sessionStorage` under the key `sla_quiz_state`
(`{ userName, quizId, answers }`), so a mid-quiz refresh resumes at the first unanswered question.

`route()` returns a promise that resolves once the view is rendered, and `SLAQuiz.navigate(hash)`
wraps it - that is what the render tests await instead of guessing at timers.

### The quiz engine is data-driven - don't add per-quiz code

The 19 quizzes are **not** 19 code paths. Each `QuizQuestions/<id>.json` declares a `scorer` and a
`widget`, and `quiz.js` dispatches on those. To add or change a quiz, edit its JSON; only add code
if a genuinely new scoring shape is needed.

- **Scorers**: `likert-total`, `likert-domains`, `score-domains`, `scores-array-domains`,
  `answer-key-categories`, `tally-option`, `tally-word-list`, `tally-vark`, `binary-index`,
  `study-plan`.
- **Widgets**: `ring`, `ring-domains`, `pie`, `pie-band`, `score-domains`, `dominant-domain`,
  `profile`, `plan`.
- **`dominant-domain` reads a domain result the other way round.** `ring-domains`/`score-domains`
  lead with the *overall* band and show the domains as supporting bars; `dominant-domain`
  (the `tiredness` exhaustion check) leads with the **highest** domain, because that is what
  selects the action plan the student reads. The pick is `dominantDomains()` — a pure function
  tuned per quiz by `coDominantWithin` (points within the top score that still count as
  co-dominant — "you can have more than one type at once"), `dominantFloor` (below this nothing
  is worth acting on, so no plan is shown) and `maxDominant` (cap on plans surfaced). The plan
  copy lives in the JSON's `plans` map, keyed by domain name.
- **A 0-based Likert has to be option-scored, not `sharedOptions`.** `sharedOptions` hardcodes
  `index + 1`, so its lowest answer is worth 1 — on a "0 = not at all" instrument that puts an
  untroubled student at 25% instead of 0%. `tiredness` therefore repeats its four scored options
  per question; don't "tidy" it into `sharedOptions`.
- **Answers are always stored as the selected option's INDEX.** Every scorer works from
  `(question, index)`. The React version stored option *text* and matched it back to a label later;
  don't reintroduce that.
- `bands` are evaluated top-down, first match wins: `min` (pct >= min), `max` (pct <= max), `iqMin`
  (matched against the estimated IQ, not the percentage), or a bare band as a catch-all.
- Shared-Likert quizzes score `index + 1`, flipped to `(scale + 1) - score` when the question has
  `reverse: true`. Option-scored quizzes carry their own `score` per option.
- Spirit Animal and Mood Check options carry a **`key`** (`"Bear"`, `"Calm"`) separately from their
  display text; that key is what indexes the quiz's `profiles` table. Tallying the visible text
  instead silently produces no profile.

### Deliberate choices worth not "fixing"

- **EQ and IQ show domain bars, not a pie.** Their per-area scores are independent percentages, so
  a pie's slices summed to ~270%. The React version really did feed these to a pie chart; that was
  a bug, and the bars are the fix. Don't convert them back.
- **Spirit Animal renders an emoji on a brand gradient, not a photo.** The React profiles hotlinked
  six Unsplash URLs, two of which (Eagle, Wolf) were already dead 404s masked by an `onError`
  handler. The `image` field is stripped from the generated JSON. If real photos are ever wanted,
  add all six to `media/` - don't reintroduce hotlinks.
- **The content-protection layer exempts text fields.** `quiz.js` installs the same
  right-click/F12/Ctrl-U/Ctrl-C blocking as `script.js`, but `isTextField()` lets `<input>`,
  `<textarea>` and contenteditable through - this app has name inputs and a journaling tool, and
  blocking copy/paste there breaks real typing.
- **`appEl()` / `dialogEl()` resolve the shell elements at use time** rather than caching them, so
  the module never holds a reference to a detached node.
- **Charts are hand-rolled SVG.** The donut is built from `stroke-dasharray` arcs on concentric
  circles, which has no path-arc edge cases at 0% or 100%.
- **"Download as Image" is SVG `foreignObject` -> canvas -> PNG** (`downloadResultCard`). This is
  the same technique `html-to-image` used, with styles inlined because the rasterised SVG cannot
  reach `quiz.css`. It is browser-sensitive; verify in a real browser after touching it.

### Tools (`quiz-tools.js`)

`window.SLATools.mount(id, host, ctx)` renders one tool and **returns a cleanup function**. The
router calls that cleanup on every navigation, so a tool that starts a `requestAnimationFrame`
loop, `setInterval` or audio playback **must** stop it there - `tests/unit/quiz-tools.test.js`
asserts exactly that, including `vi.getTimerCount() === 0` after teardown.

Three libraries have no native equivalent and are loaded from cdnjs **on demand, inside the one
tool that needs them**: pdf.js and epub.js (Speed Reading file upload) and jsPDF (the three
Reflects worksheets). Nothing else on the page pays for them.

The canvas tools (Ball Focus, Eye Exercise) guard `getContext('2d')` and degrade to a message if
it returns null.

### Media

`media/audio/` was re-encoded with ffmpeg from the React project's originals: 82 MB -> 30 MB.
Speech tracks are 64 kbps mono; the two music/tone tracks (`mandala-inspiration`,
`852hz-reset-the-mind`) are 96 kbps stereo, because mono at 64k audibly hurt them.
`media/peg-system/` is 30 WebP files converted from 500x500 PNGs with Pillow at quality 82:
9.0 MB -> 0.9 MB. If these assets are ever replaced, re-apply the same treatment - there is no
build step to do it for you.

### Generated JSON

`QuizQuestions/*.json` was generated once from the React project's `src/data/questions.js` plus the
scoring rules that were embedded in each `*Results.jsx`. That generator depended on the React
source and is **not** reproducible now that `quiz-assessment-app` is gone - the JSON files are the
source of truth from here on. Edit them directly.

### Hindi / English: English is the source of truth for SCORING, Hindi only for display

Every quiz runs in either language. The picker is on the name gate (`usernameView`), which is what
the feature was asked for, and the home/about views carry the same switch so the app is never half
translated. The choice lives in `sessionStorage` (`sla_quiz_state.lang`) **and** `localStorage`
(`sla_quiz_lang`), so it survives a refresh and is remembered as the default next visit.

- **Translations are sidecar files**: `QuizQuestions/hi/<id>.json` (plus `hi/index.json` for the
  catalogue). They mirror the English file's shape and carry **display strings only**. `loadQuiz()`
  always fetches the English file first, then layers the sidecar over it with `mergeTranslation()`.
  A missing or broken sidecar silently falls back to English - it is never fatal.
- **`mergeTranslation()` is a structural overlay**: arrays merge by INDEX, objects by KEY, anything
  the sidecar omits stays English. So **option order and array lengths must never diverge** between
  a file and its sidecar - a reordered option would silently attach the right score to the wrong
  Hindi line. `scripts/check_translations.py` is the guard; run `py -3 scripts/check_translations.py`
  after editing any `QuizQuestions/*.json`.
- **Three scorers match on option TEXT** - `tally-vark` (English keywords), `tally-word-list`
  (Social Type's `wordLists`) and `tally-option`'s `opt.key || text` fallback. `mergeTranslation()`
  therefore stashes the original English string as `textEn`, and those scorers read it through
  `scoreText(opt)`, never the translated `text`. Don't "simplify" that back to `opt.text`.
- **Map KEYS are identifiers, not copy**: `domains`, `plans`, `profiles`, `strategies`,
  `wordLists` and `categories` keep their English keys in a sidecar. The Hindi name goes in the
  entry's `label` (domains/profiles) or in a `categoryLabels` map (VARK, Social Type), which
  `tallyVARK`/`tallyWordLists` use for the chart legend only. Translating `categories` in place
  would break the counter, because it is also the counter's key list.
- **`poles` IS translated in place** (Brain Dominance, Motivation) - `poleBand()` matches
  `band.poleAbove` against the pole's INDEX, so the two names are display-only.
- **Keys a sidecar may ADD** that the English file doesn't have: `ringCaption` (Hindi has no
  `'Your '` prefix for `renderRing` to strip), `label`, `categoryLabels`, `closingTitle`, and
  `advice` (see below). Everything else must already exist in the English file.
- **UI chrome** (buttons, headings, greetings, "Question 3 of 15") is not in the JSON - it lives in
  the `STRINGS` table in `quiz.js` and is read through `tr('key', vars)`. The lookup is named `tr`,
  not `t`, because several callbacks in that file already bind `t` as a loop variable. The
  confirmation dialog is static markup in `quiz.html` and is translated in place via `data-i18n`
  attributes.
- **`generateStudyPlan()`'s advice copy moved out of the function body** into the `PLAN_ADVICE`
  table, and is read through `adviceFor(quiz, group, tag)`. A quiz's own `advice` key overrides it,
  which is how `hi/study-strategy.json` translates those lines. English behaviour is unchanged -
  `study-strategy.json` has no `advice` key, so the defaults apply.
- **The Devanagari webfont is loaded on demand.** Montserrat/Inter carry no Devanagari, so
  `ensureHindiFont()` injects Noto Sans Devanagari the first time Hindi is picked, and
  `:root[data-lang="hi"]` in `quiz.css` switches to it. English visitors never pay for the request.
- **Content that must NOT be translated**: the IQ items that test English vocabulary
  (`EPHEMERAL`, `UBIQUITOUS`), the English letter/month sequences (`AZ, BY, CX`, `J, F, M, A`) and
  the `APPLE = 50` letter-sum puzzle keep their English terms - translating them changes what the
  question actually tests. Social Type's question text is just `1/20`..`20/20`, so it has no
  translation at all; only its adjectives do.
- **Tests**: `tests/unit/quiz-i18n.test.js` asserts that the same answers produce identical numbers
  in both languages for all 19 quizzes, that `textEn` survives the merge, that a missing sidecar
  falls back to English, and that no sidecar restates a scoring key.
- **The 11 tools in `quiz-tools.js` are still English only.** That was out of scope here; if they
  are ever translated they need their own approach, since their copy is inline in the JS.

## Mind map app (`mindmap/`)

A third self-contained app — **OpenMind**, a free mind-map editor — in the same no-build shape as
the rest of the site, aimed at the same student audience (map a chapter, collapse what you can
already recall, export a one-page revision sheet). Two pages: `mindmap/index.html` (landing,
recent maps, templates) and `mindmap/editor.html` (the editor). **No backend, no account, no AI,
no Pyodide** — everything runs in the browser and maps are stored on the device.
`mindmap/docs/README.md` is the full developer reference; the essentials are below.

### It uses native ES modules — unlike script.js and quiz.js

This is the one part of the repo that is **not** a single IIFE file. `mindmap/src/` is ~35 small
ES modules loaded with `<script type="module">`. Consequences:

- **`file://` will not work** — modules need http. Serve the folder
  (`python -m http.server 8000` → `http://localhost:8000/mindmap/`) to preview.
- **Tests import the modules directly** (`import { MindMap } from '../../mindmap/src/core/MindMap.js'`)
  instead of the `new Function(scriptContent)` trick `tests/setup.js` needs for `script.js`. There
  is no `window.SLA`-style test surface here and none is needed.
- Tests live in `tests/unit/mindmap-*.test.js` and `tests/properties/mindmap.property.test.js`
  (~80 tests, all passing). The property tests are numbered **M1–M8** and that numbering is
  mirrored in `mindmap/docs/README.md` — change one, change the other. They are unrelated to the
  numbered properties in `.kiro/specs/.../design.md`, which are the landing page's.

### One-directional render pipeline — nothing renders itself

```
model change -> Editor.commit() -> LayoutEngine.calculate() -> SVGCanvas.render() + panels render
```

`Editor.run(command)` in `mindmap/src/app.js` is the single entry point for every action; the
toolbar, menu bar, context menu, mobile bar and keyboard all call it. **Adding a button means
adding one element with `data-command="…"` to `editor.html`** — `ui/Toolbar.js` binds them by
delegation, so no JS change is needed. The static markup in both HTML files is the real no-JS
fallback, as everywhere else on this site.

### Things that look wrong but are deliberate

- **The content-protection layer is NOT installed here.** `script.js` and `quiz.js` block
  right-click / F12 / Ctrl+C; doing that in an editor would break its own copy, paste, context
  menu and typing. Don't "restore consistency" by adding it.
- **`topic.position` is a manual *nudge*, not a coordinate.** The auto layout always runs and the
  offset is added afterwards to the topic *and its whole subtree*, so a dragged branch keeps its
  shape and stays joined to its parent. Treating it as an absolute position detaches branches.
- **`topic.style` is sparse on purpose.** A missing key means "inherit from the theme", which is
  why switching theme never discards a deliberate choice. Don't fill it with resolved defaults.
  `style.width` works the same way: absent means "size the box to its text", and it is what the
  width grip on the focused node's right edge (and the Format panel's Width field) writes.
- **The inline editor measures itself from its own textarea value**, via `textBox()` in
  `layout/metrics.js` — the same function the layout sizes nodes with, plus a few px of slack so
  the browser doesn't wrap one character earlier than our measurement did. Sizing it from the
  last laid-out node instead is the bug where typing `you` into a fresh topic showed `yo / u`.
- **The focused topic carries two handles** drawn by `SVGCanvas`: a “+” that runs `add-child`
  and a width grip. `DragDrop` skips both, the way it skips the collapse toggle, and exports
  render with `primaryId: null` so neither reaches a PNG or SVG.
- **All five layouts come from one tidy-tree function** (`layout/TreeLayout.js`) with the axis as a
  parameter. A parent's band is the *sum* of its children's bands — that is what guarantees
  non-overlap (property M1). Don't special-case a layout; parameterise it.
- **Text is measured with an offscreen canvas 2d context** (`util/measure.js`), not by measuring
  live SVG `<text>`, which would cost a reflow per node. jsdom has no canvas, so tests silently
  use the character-width estimate — that's why one "Not implemented: getContext" line appears in
  test output. It is not a failure.
- **Markdown export escapes `*_~[]` etc. and the importer un-escapes them.** A topic literally
  called `*star*` used to come back as `star`; property M5 exists because of that bug. Don't
  simplify either side without the other.
- **Panes carry two classes in lockstep** — `is-X-hidden` (read by the desktop grid) and
  `is-X-open` (read by the overlay breakpoints) — so one toggle means the same thing at every
  width. See `Editor.togglePane()`.
- **Numbering is display-only.** `topic.numbering` on a parent numbers its subtree; the prefix is
  computed by `MindMap.numberPrefix()` and joined to the text only in `displayText()`
  (`layout/metrics.js`). Writing it into `topic.text` would break the Markdown round trip (M5),
  search and the outline.
- **Focus (F3) and drill-down (F4) are view state, not model state.** Focus passes `dimmedIds` to
  the renderer; drill-down passes `rootId` to `calculate()` so the layout walks from a different
  topic. Only "show level N" (`Alt+1…9`) touches the model, because `collapsed` is saved with the
  map. An export taken while drilled deliberately exports that branch.
- **`MindMap.fromState()` is the trust boundary.** It re-links orphans to the root, rebuilds every
  `children` array from `parentId` and breaks cycles, so a corrupt or hand-edited `.openmind` file
  opens instead of hanging. Import paths must go through it, never assign `topics` directly.

### Format, storage and PWA

`.openmind` is one versioned JSON object (`formatVersion` / `meta` / `view` / `map` / `assets`);
`migrate()` in `core/Document.js` is the only place a version bump is handled, and a newer *major*
version is refused rather than half-read. Storage is IndexedDB (`openmind` db: `maps`,
`templates`, `prefs`) with a **localStorage fallback** for private windows; autosave debounces
700 ms and flushes on `pagehide`.

`sw.js` is registered with scope `./` so it can never intercept the rest of the site.
**There is no build step to hash filenames, so bump `CACHE_VERSION` in `sw.js` whenever a shell
file changes**, or returning visitors keep the old copy. `mindmap/icons/*.png` are generated with
Pillow (same habit as `scripts/generate_mandala.py`), not hand-drawn.

### Templates are data

`mindmap/templates/*.json` plus `index.json`. Adding a template = adding a file and an index row;
no application code changes. Each is `{ id, name, description, icon, view, root }` where `root` is
the nested `{ text, children }` outline that `import/JSON.js` already reads.

### On-demand CDN

jsPDF is fetched from cdnjs **inside `export/PDF.js` only**, the same pattern the quiz tools use
for pdf.js/epub.js — nothing else on the page pays for it. PNG/PDF export of a map containing a
*remote* `http` image will fail (canvas tainting); uploaded images are data URIs and are fine.

## Shared site chrome (`site-nav.css` / `site-nav.js`) and `about.html`

Added for Google's Search Quality Rater / E-E-A-T signals: a reader (or a human rater)
must be able to tell who runs the site and how to contact them from any page.

- **`site-nav.css` + `site-nav.js`** are deliberately standalone — they must not depend on
  `style.css` or `quiz.css`, because those two never load on the same page. `site-nav.js` only
  wires up open/close (plus Escape, backdrop click and a tab loop); the panel markup is **static
  HTML duplicated in each page**, so the About/Contact/Tools links exist with JS disabled.
- Present on `index.html`, `about.html`, `quiz.html`, `thank-you.html`, `resources.html`,
  `generatenotes/index.html` and `mindmap/index.html`. The copies in `generatenotes/` and
  `mindmap/` use `../` hrefs — if you edit the nav or footer, edit **all seven**.
  (`mindmap/editor.html` deliberately has no site nav: it is a full-screen app whose own top bar
  links back to `mindmap/index.html`.)
- Nav z-indexes are 9993–9995 on purpose: **below** `index.html`'s `.top-bar` (9999), the quiz's
  `.quiz-dialog` (9999) and `#protection-popup`, and **above** the landing page's `.sticky-cta`
  (9990). `.top-bar ~ .site-nav .site-nav-toggle` drops the button to `top: 58px` on pages that
  have the urgency banner, so don't move the nav out of its sibling position after `.top-bar`.
- **The menu is hidden while a quiz question is on screen.** `quiz.js`'s router writes
  `data-view="<view>"` onto `<html>` on every navigation, and `quiz.css` has
  `:root[data-view="quiz"] .site-nav { display: none }` — the fixed toggle sits exactly where the
  question card's progress badge ("3/15") is. `site-nav.js` exposes `window.SLASiteNav`
  (`isOpen`/`close`) purely so the router can close an open panel instead of leaving body scroll
  locked behind a button that just became invisible.
- **`about.html`** is the E-E-A-T page: who runs the site, the founder's background, an explicit
  "what we will not claim" list (it restates the no-pseudo-science / no-invented-numbers rules
  above), what the free tools do with your data, refund terms, and contact. It carries an
  `AboutPage` + `Organization` JSON-LD block; `index.html` carries a matching `Organization` one.
  **If the prose and the JSON-LD ever disagree, that's the bug** — keep them in sync.
- Contact details live in `data.json` under `contact` (`email`, `emailHref`, `instagram`,
  `instagramHandle`) and are bound into the footer on the two pages that load `script.js`. The
  static text in the HTML is the real fallback everywhere else, so it must stay correct.
- The notes generator (`generatenotes/index.html`) still carries `<meta name="robots" content="noindex">`
  from before it was linked in the nav. Deliberately left alone — flip it only if you actually want
  that tool indexed.

## Content notes

- `quotes.json` feeds a rotating quote slider (`showQuote`/`nextQuote` in `script.js`); it's independent of `data.json`.
- `Super_Learner_Academy_Ebook.pdf` and `Favicon SLA/`, `Images/` are static assets referenced directly by the HTML — no asset pipeline.
- `scripts/` holds one-off Python/Pillow maintenance scripts (`generate_mandala.py`, `recenter_host_photo.py`) for regenerating/fixing image assets in `Images/`. These aren't part of a build (there is none) and aren't run automatically — re-run them by hand only when the relevant source asset changes.
- `scripts/check_translations.py` is different: it's a **validator**, not a generator. It checks every `QuizQuestions/hi/*.json` against its English original (array lengths, unknown keys, keys the scorers read) and should be run after any edit to a quiz JSON.
