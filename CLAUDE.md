# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A static (no build step) webinar registration landing page for Super Learner Academy — pure HTML/CSS/vanilla JS, deployed via GitHub Pages behind the custom domain in `CNAME` (`www.superlearneracademy.in`). Three pages: `index.html` (landing page), `thank-you.html` (post-payment page) and `quiz.html` (the free "Know Yourself Better" assessment app - see its own section below). All copy, prices, dates, and links are non-technical and driven from `data.json` so the page can be updated without editing HTML. See `theme.md` for the color/typography/spacing design system (source of truth is `style.css`'s `:root` tokens — `design-reference.md` describes an earlier/different project variant and should not be used for this site's actual styling).

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

There is no build, lint, or dev-server script — open `index.html` directly or serve the folder statically to preview.

## Architecture

### Single-file JS with a `window.SLA` test surface

All behavior lives in `script.js` (one file, ~900 lines, IIFE-style top-level functions, no modules/imports). At the bottom, the internal functions that need testing are re-exported onto `window.SLA` (e.g. `SLA.loadData`, `SLA.injectContent`, `SLA.calculateTimeRemaining`, `SLA.getStickyVisibility`, `SLA.toggleFAQ`). Tests load `script.js` by reading the file and executing it with `new Function(scriptContent)` inside jsdom (see `tests/unit/data-loading.test.js`) — **jsdom does not execute injected `<script>` tags**, so this eval approach is the only way tests observe script.js behavior. When adding a new testable function, expose it on `window.SLA` the same way.

`document.addEventListener('DOMContentLoaded', ...)` at the bottom is the single entry point: it fetches `data.json`, then branches on `document.body.getAttribute('data-page') === 'thank-you'` to run either the thank-you page initializers (`playConfetti`, `initThankYouPage`) or the landing page initializers (`initCountdown`, `initFAQ`, `initStickyCTA`, `initScrollAnimations`, `initCoachImageFallback`, `initQuotesSlider`). Both branches call `initAnalytics`.

### Data-driven content via `data-bind` attributes

`data.json` is fetched at runtime and injected into the DOM through declarative attributes rather than templating:
- `data-bind="path.to.value"` → sets `textContent` (dot path resolved by `getNestedValue`)
- `data-bind-href="path.to.value"` → sets `href`
- `data-dynamic-only` → hidden entirely if `data.json` fails to load

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

A second, self-contained app in the same repo: 18 free self-assessments and 11 brain-training
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

The 18 quizzes are **not** 18 code paths. Each `QuizQuestions/<id>.json` declares a `scorer` and a
`widget`, and `quiz.js` dispatches on those. To add or change a quiz, edit its JSON; only add code
if a genuinely new scoring shape is needed.

- **Scorers**: `likert-total`, `likert-domains`, `score-domains`, `scores-array-domains`,
  `answer-key-categories`, `tally-option`, `tally-word-list`, `tally-vark`, `binary-index`,
  `study-plan`.
- **Widgets**: `ring`, `ring-domains`, `pie`, `pie-band`, `score-domains`, `profile`, `plan`.
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

## Shared site chrome (`site-nav.css` / `site-nav.js`) and `about.html`

Added for Google's Search Quality Rater / E-E-A-T signals: a reader (or a human rater)
must be able to tell who runs the site and how to contact them from any page.

- **`site-nav.css` + `site-nav.js`** are deliberately standalone — they must not depend on
  `style.css` or `quiz.css`, because those two never load on the same page. `site-nav.js` only
  wires up open/close (plus Escape, backdrop click and a tab loop); the panel markup is **static
  HTML duplicated in each page**, so the About/Contact/Tools links exist with JS disabled.
- Present on `index.html`, `about.html`, `quiz.html`, `thank-you.html` and
  `generatenotes/index.html`. The copy in `generatenotes/` uses `../` hrefs — if you edit the nav
  or footer, edit **all five**.
- Nav z-indexes are 9993–9995 on purpose: **below** `index.html`'s `.top-bar` (9999), the quiz's
  `.quiz-dialog` (9999) and `#protection-popup`, and **above** the landing page's `.sticky-cta`
  (9990). `.top-bar ~ .site-nav .site-nav-toggle` drops the button to `top: 58px` on pages that
  have the urgency banner, so don't move the nav out of its sibling position after `.top-bar`.
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
