# Google Ads — Working Notes

Running log of the Google Ads strategy/consulting conversation for the SLA webinar funnel. Kept in-repo so account/campaign context survives across sessions. Append new decisions and open questions as we go; don't let this drift out of sync with reality — note the date when something changes.

## Funnel & tracking as it exists today

- **Landing page → SuperProfile checkout → `thank-you.html`.** SuperProfile (`data.json`'s `registration.link`) is the only checkout path right now. It redirects to `thank-you.html` with **no query param, webhook, or transaction id** — so there is no server-side or client-side payment confirmation. `initThankYouPage` in `script.js` always renders the "paid" view; anyone who lands on `/thank-you.html` (paid or not) sees the same thing.
- **Conversion tag:** static `gtag.js` snippet (`AW-738572260`) hardcoded in the `<head>` of both `index.html` and `thank-you.html` — not sourced from `data.json`.
- **Conversion event:** `trackPurchaseConversion()` in `script.js`, called from `initThankYouPage`, fires `AW-738572260/aFfQCPv8iOocEOTvluAC` ("Purchase") with:
  - `value: 455` — **static**, matches `registration.price`, doesn't reflect actual amount paid (there's only ever one price point right now, but if that changes this will silently misreport).
  - `transaction_id: ''` — empty, because SuperProfile gives no real transaction id to attach.
  - Guarded by a `sessionStorage` flag (`sla_conversion_fired`) so a refresh/reload of the thank-you page doesn't double-fire — only first load per browser tab session fires it.
- **Implication for Google Ads:** because the thank-you page fires on *page view*, not on *confirmed payment*, the conversion count includes anyone who reaches that URL (direct nav, back button before payment completes, etc. — though the sessionStorage guard limits double-counting within a tab). Treat current conversion volume as a proxy, not ground truth, until Razorpay migration lands (see below).
- **GTM / FB Pixel:** wired up in `script.js` (`initAnalytics` → `injectGTM`/`injectFBPixel`) but currently **inactive** — `data.json`'s `analytics.gtmId` and `analytics.fbPixel` are both empty strings. No GTM container or Meta Pixel is live today.
- **Future state (`razorpay.md`):** a planned migration to Razorpay with real payment verification and a webhook → Google Sheets. Not live — don't plan campaigns assuming real transaction-level conversion value exists yet, but flag it as the fix for the "value/transaction_id" gaps above.

## Offer & audience basics

- Workshop: "Super Learner Academy - 3 Day Live Webinar", coach Abhishek Ranjan.
- Price: ₹455 (discounted from ₹4999 list) — a low-ticket front-end offer, classic webinar-funnel economics (low CAC target on the ₹455 sale, real monetization presumably on a backend upsell not in this repo).
- WhatsApp group join as a secondary/engagement CTA post-registration.
- Domain: `www.superlearneracademy.in`.

## Live campaigns

### "SLA - Workshop Leads..." (Demand Gen) → ad group "Workshop Leads" → Ad 1
- Ad type: Video ad, placements across YouTube/Discover/Gmail/Maps (Demand Gen format).
- Recommended Final URL: `https://www.superlearneracademy.in/` (landing page, not `thank-you.html` — cold Demand Gen traffic needs the full pitch before checkout).
- Business name: `Super Learner Academy`.
- "Generated videos" asset optimization is ON, so the YouTube video creative is auto-built from uploaded images — no separate video asset needed.
- Ad strength was "Incomplete" — missing Images, Logos, Headlines, Descriptions, Final URL at time of review (2026-08-29).

## Open questions / decisions log

- **2026-08-29 — Naming mismatch: "Workshop Leads" ad group vs. no lead-capture step.** The funnel has no lead form; the landing page sells the ₹455 seat directly via SuperProfile. The only conversion action wired up is the `AW-738572260` "Purchase" conversion (fires on `thank-you.html` page-load — see tracking notes above).
  **Why it matters:** if this campaign's conversion goal is set to something other than that Purchase action (e.g. an expected "Lead" goal that doesn't actually exist), it could be optimizing toward nothing.
  **Status: unresolved** — need to confirm which conversion goal this campaign is actually pointed at in Google Ads' campaign settings.

## Action items

- [ ] Confirm the "SLA - Workshop Leads" Demand Gen campaign's conversion goal is set to the `AW-738572260` Purchase action.
- [ ] Upload required creative assets for Ad 1: workshop/webinar banner, coach photo (Abhishek Ranjan), SLA logo (square + landscape).
- [ ] Set Call to action text to "Sign Up" or "Register" instead of "Automated".
