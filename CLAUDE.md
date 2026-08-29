# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A static (no build step) webinar registration landing page for Super Learner Academy — pure HTML/CSS/vanilla JS, deployed via GitHub Pages behind the custom domain in `CNAME` (`www.superlearneracademy.in`). Two pages: `index.html` (landing page) and `thank-you.html` (post-payment page). All copy, prices, dates, and links are non-technical and driven from `data.json` so the page can be updated without editing HTML. See `theme.md` for the color/typography/spacing design system (source of truth is `style.css`'s `:root` tokens — `design-reference.md` describes an earlier/different project variant and should not be used for this site's actual styling).

Registration currently goes through **SuperProfile** (`data.json`'s `registration.link`), which redirects straight to `thank-you.html` with no query param, webhook, or transaction id to confirm payment — `initThankYouPage` in `script.js` always shows the "paid" view (no gate). `razorpay.md` documents a **future** migration plan to Razorpay (payment verification, webhook-to-Google-Sheets); none of that is live yet, so don't assume Razorpay params/verification exist.

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

### Analytics: two separate systems, don't conflate them

- **Data-driven** (`initAnalytics` in `script.js`): conditionally injects GTM/FB Pixel only when `data.json`'s `analytics.gtmId`/`analytics.fbPixel` are non-empty. Covered by `tests/unit/analytics.test.js`.
- **Hardcoded Google Ads tag** (`AW-738572260`): a static `gtag.js` snippet in the `<head>` of both `index.html` and `thank-you.html` (not sourced from `data.json`). `trackPurchaseConversion()` in `script.js`, called from `initThankYouPage`, fires the `AW-738572260/aFfQCPv8iOocEOTvluAC` "Purchase" conversion event with a static `value: 455` (matching `registration.price`) and empty `transaction_id` (SuperProfile gives no real transaction id to attach). It's guarded by a `sessionStorage` flag (`sla_conversion_fired`) so a refresh/reload of the thank-you page doesn't double-fire the conversion — only the first load per browser tab session fires it.

### Countdown persistence

Countdown end date is echoed into `localStorage` (`sla_countdown_endDate`) so refreshing the page doesn't reset the timer, but `data.json`'s `countdown.endDate` always takes precedence over a stale localStorage value (Property 3 in design.md).

## Content notes

- `quotes.json` feeds a rotating quote slider (`showQuote`/`nextQuote` in `script.js`); it's independent of `data.json`.
- `Super_Learner_Academy_Ebook.pdf` and `Favicon SLA/`, `Images/` are static assets referenced directly by the HTML — no asset pipeline.
