# Theme.md — Visual & Content Design Reference

> Source of truth: `style.css` (`:root` design tokens, lines 9–41) and `index.html`/`thank-you.html`.
> This describes the **current, live** theme. `design-reference.md` documents an earlier/different
> project variant (different palette, Poppins font) — don't use it for this site's actual styling.

---

## 1. Color Palette

Defined as CSS custom properties in `style.css :root`:

| Token | Hex | Usage |
|---|---|---|
| `--deep-learning-blue` | `#0B2A5B` | Primary dark background (hero, countdown, curriculum, footer sections) |
| `--memory-orange` | `#FF6B00` | CTA gradient start, urgency accents, icons |
| `--red-orange` | `#ff5e3a` | CTA gradient end, urgency accents |
| `--success-gold` | `#FFC107` | Countdown numbers, highlight stats |
| `--growth-green` | `#34A853` | Checkmarks, credentials, success states |
| `--smart-blue` | `#1E5EFF` | Secondary highlights, coach role subtitle |

Additional colors used directly (not tokenized) for darker gradient stops and section backgrounds:

| Hex | Usage |
|---|---|
| `#0a1628` | Darkest background — footer, gradient end-stops paired with `--deep-learning-blue` |
| `#1a3a6b` | Mid-tone gradient stop (coach/curriculum section backgrounds) |
| `#1a6b3c` / `#0f5132` / `#25a55f` | Green gradient variants (WhatsApp/success sections) |
| `#25D366` / `#128C7E` | WhatsApp brand green gradient |
| `#4facfe` / `#00f2fe` | Blue accent gradient (used sparingly, e.g. share buttons) |

Text colors (not tokenized, used inline):

| Hex | Usage |
|---|---|
| `#333` | Default body text (`body` color) |
| `#1a1a2e` | Headings on light/white backgrounds |
| `#555` / `#666` | Secondary/muted text, subtitles, descriptions |
| `#ffffff` | Text/headings on dark backgrounds, card backgrounds |

### Gradients

| Token/Selector | Value |
|---|---|
| `--cta-gradient` | `linear-gradient(135deg, #FF6B00, #ff5e3a)` — all CTA buttons |
| `--topbar-gradient` | `linear-gradient(135deg, #FF6B00, #ff5e3a)` — top urgency bar |
| Dark section gradient | `linear-gradient(135deg, #0a1628, #0B2A5B)` — hero, achievements, pricing, footer |
| Curriculum/coach gradient | `linear-gradient(135deg, #1a3a6b, #0B2A5B)` |
| WhatsApp CTA gradient | `linear-gradient(135deg, #25D366, #128C7E)` |

---

## 2. Typography

Imported via `@import` in `style.css` (also `<link>`-preconnected in `index.html`):

```css
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Inter:wght@400;500&display=swap');
```

| Token | Font | Weight | Used for |
|---|---|---|---|
| `--font-heading` | Montserrat | 700–800 | All headings, CTA buttons, countdown numbers, badges |
| `--font-body` | Inter | 400–500 | Body copy, descriptions, labels |

### Type scale (font-size by element)

| Element | Size |
|---|---|
| Hero H1 (`.hero-text h1`) | `2.4rem` (800 weight) |
| Section title (`.section-title`) | `2rem` (800 weight) |
| Section subtitle (`.section-subtitle`) | `1.1rem` (400 weight, `#666`) |
| Hero sub-headline | `1.1rem` |
| Countdown number | `2.5rem` (800 weight) |
| Countdown label | `0.85rem` |
| Price amount | `3.5rem` (800 weight) |
| Price currency | `2rem` |
| Original (struck-through) price | `1.2rem`, `rgba(255,255,255,0.5)` |
| Coach name | `1.8rem` |
| Coach card name (compact card) | `1.3rem` |
| Quote text | `1.15rem` |
| CTA button | `1rem` (800 weight) |
| Icons (challenge/included) | `2.5rem` |
| Mobile (≤480px) heading cap | `1.5rem` for all `h1/h2/h3` and `.section-title` |

---

## 3. Spacing, Radius, Shadow & Motion Tokens

```css
--section-padding: 80px 20px;      /* 40px 16px on mobile ≤480px */
--container-max: 1200px;
--card-shadow: 0 4px 20px rgba(0,0,0,0.06);
--card-shadow-hover: 0 15px 40px rgba(0,0,0,0.1);
--cta-shadow: 0 8px 25px rgba(255,94,58,0.4);
--radius-card: 16px;
--radius-pill: 50px;               /* CTA buttons, badges */
--transition-base: 0.3s ease;
```

- `.card` — white background, `16px` radius, `24px` padding, lifts on hover (`translateY`) with shadow transition from `--card-shadow` to `--card-shadow-hover`.
- `.cta-button` — pill-shaped (`50px` radius), gradient background, `18px 36px` padding, pulse + shine animation (disabled under `prefers-reduced-motion`).
- Reduced-motion media query disables CTA pulse/shine and card hover transforms entirely — preserve this when adding new animations.

---

## 4. Page/Section Structure

### `index.html` (landing page)

Sticky top urgency bar → hero (headline + CTA + coach image) → countdown timer → "who this is for" checklist → challenges grid → curriculum (day cards, gradient headers) → meet-the-coach card + quote slider → what's included → testimonials → pricing/register (dark gradient, struck price → discounted price) → FAQ accordion → footer → sticky bottom CTA (appears after scroll) → scroll-to-top button.

### `thank-you.html`

Confetti animation → success hero (checkmark + thank-you message) → next steps (3 cards) → workshop details card → WhatsApp CTA (green gradient) → footer.

Both pages share: CTA button style, footer, and the analytics loader (GTM/FB Pixel, injected conditionally only when `data.json`'s `analytics.gtmId`/`fbPixel` are non-empty).

---

## 5. Content Voice & Copy Patterns

- **Urgency-first**: top bar and countdown timer emphasize a closing deadline ("Registration Closed!" `expiredMessage` in `data.json`); CTA button text is dynamic and price-inclusive, e.g. `REGISTER NOW FOR ₹455/- ONLY`.
- **Price anchoring**: original price always shown struck-through next to the discounted price (`.original-price`, `text-decoration: line-through`) to visualize the discount.
- **Day-by-day curriculum framing**: each day of the workshop gets its own card with a distinct gradient header and a checklist of outcomes (`<i class="fas fa-check"></i> Point`), per `day-card` markup in `index.html`.
- **Authority + social proof**: coach credentials (checkmark list), testimonials, and quote slider (`quotes.json`) reinforce trust.
- **All copy is data-driven where possible** — dynamic values (`registration.price`, `workshop.name`, `whatsapp.link`, etc.) come from `data.json` via `data-bind`/`data-bind-href` attributes (see `CLAUDE.md` for the mechanism); the static HTML text is the fallback shown if `data.json` fails to load, so it must always read as complete, sensible copy on its own.
- **Icons**: Font Awesome 6.5 (`fas fa-*`) used throughout for checkmarks, chevrons, WhatsApp, social icons — no custom icon set.

---

## 6. Responsive Breakpoints

| Breakpoint | Key changes |
|---|---|
| ≤992px | Hero stacks vertically, grids drop to 2 columns |
| ≤768px | Grids drop to 1 column, smaller titles |
| ≤480px | `--section-padding` overridden to `40px 16px`, headings capped at `1.5rem`, CTA buttons go full-width, countdown boxes tighten |

Global overflow guard: all images/video/iframe get `max-width: 100%; height: auto`; grid children get `min-width: 0; overflow-wrap: break-word` to prevent horizontal overflow at any viewport from 320px–1920px.

---

## 7. External Dependencies

| Resource | Source |
|---|---|
| Montserrat + Inter | Google Fonts CDN (`fonts.googleapis.com`) |
| Font Awesome 6.5 | `cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css` |

No CSS/JS frameworks, no build tools — see `CLAUDE.md` for the overall architecture.
