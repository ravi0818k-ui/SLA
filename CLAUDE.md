# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A static (no build step) webinar registration landing page for Super Learner Academy — pure HTML/CSS/vanilla JS, deployed via GitHub Pages behind the custom domain in `CNAME` (`www.superlearneracademy.in`). Two pages: `index.html` (landing page) and `thank-you.html` (post-payment page). All copy, prices, dates, and links are non-technical and driven from `data.json` so the page can be updated without editing HTML. See `theme.md` for the color/typography/spacing design system (source of truth is `style.css`'s `:root` tokens — `design-reference.md` describes an earlier/different project variant and should not be used for this site's actual styling).

Registration currently goes through **SuperProfile** (`data.json`'s `registration.link`), which redirects straight to `thank-you.html` with no query param, webhook, or transaction id to confirm payment — `initThankYouPage` in `script.js` always shows the "paid" view (no gate). `razorpay.md` documents a **future** migration plan to Razorpay (payment verification, webhook-to-Google-Sheets); none of that is live yet, so don't assume Razorpay params/verification exist.

## Positioning & content niche

All copy on this site is written to one niche — **helping students get better grades by teaching practical, science-informed strategies for memory, focus, study skills, and growth mindset.** When editing headlines, section copy, FAQ answers, testimonials, or `data.json` text, keep it inside this frame:

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
- **`tests/unit/structure.test.js` has 3 known-stale failures** (pre-existing, unrelated to any current work): it asserts exactly 2 `.day-card`s when the curriculum has 3, expects every `img.coach-img` to carry the hero's alt text when the coach-section image has its own, and looks for `.next-step-card` on `thank-you.html` where no such class exists. `npm test` is therefore expected to report `3 failed | 61 passed` on a clean tree — treat that as the baseline, and don't assume your change caused it.

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

## Content notes

- `quotes.json` feeds a rotating quote slider (`showQuote`/`nextQuote` in `script.js`); it's independent of `data.json`.
- `Super_Learner_Academy_Ebook.pdf` and `Favicon SLA/`, `Images/` are static assets referenced directly by the HTML — no asset pipeline.
- `scripts/` holds one-off Python/Pillow maintenance scripts (`generate_mandala.py`, `recenter_host_photo.py`) for regenerating/fixing image assets in `Images/`. These aren't part of a build (there is none) and aren't run automatically — re-run them by hand only when the relevant source asset changes.
