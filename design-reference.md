# Design Reference — Read For Success Landing Page

> This file is a complete reference for recreating/redesigning this project.
> Use this as a blueprint when building new landing pages for similar workshops.

---

## 1. Design System

### Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| Primary Dark | `#0a1628` | Hero background, dark sections |
| Secondary Dark | `#1a2744` | Gradients, cards |
| Accent Blue | `#4775B9` | Highlights, links, coach branding |
| Light Blue | `#6db3f8` | Text highlights on dark bg |
| CTA Orange | `#ff8c00` | Button gradient start |
| CTA Red-Orange | `#ff5e3a` | Button gradient end, urgency |
| Gold | `#ffd700` | Countdown numbers, stats |
| Success Green | `#43e97b` → `#38f9d7` | Checkmarks, success states |
| Light BG | `#f8faff` | Alternate section backgrounds |
| White | `#ffffff` | Cards, main content |
| Text Dark | `#1a1a2e` | Headings |
| Text Body | `#444444` | Body text |
| Text Muted | `#666666` | Subtitles, descriptions |

### Gradient Presets (for Day Cards / Icons)

```css
/* Day 1 */ background: linear-gradient(135deg, #667eea, #764ba2);
/* Day 2 */ background: linear-gradient(135deg, #f093fb, #f5576c);
/* Day 3 */ background: linear-gradient(135deg, #4facfe, #00f2fe);
/* Day 4 */ background: linear-gradient(135deg, #43e97b, #38f9d7);
/* Day 5 */ background: linear-gradient(135deg, #fa709a, #fee140);
/* Extra */ background: linear-gradient(135deg, #a29bfe, #6c5ce7);
```

### Typography

| Element | Font | Weight | Size |
|---------|------|--------|------|
| Headings | Poppins | 700-900 | 1.7rem - 2.6rem |
| Body text | Poppins | 400 | 0.85rem - 1rem |
| CTA buttons | Poppins | 800 | 0.9rem - 1.25rem |
| Stats/Numbers | Poppins | 800 | 1.5rem - 3.5rem |
| Badges/Labels | Poppins | 600-700 | 0.75rem - 0.9rem |

**Google Fonts import:**
```html
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
```

### Spacing

| Element | Value |
|---------|-------|
| Section padding | 80px vertical |
| Container max-width | 1200px |
| Card padding | 25px - 40px |
| Card border-radius | 16px - 24px |
| Button border-radius | 50px (pill shape) |
| Grid gap | 20px - 25px |
| Icon size (circles) | 60px - 65px |

### Shadows

```css
/* Cards */
box-shadow: 0 4px 20px rgba(0,0,0,0.06);

/* Cards on hover */
box-shadow: 0 15px 40px rgba(0,0,0,0.1);

/* CTA Button */
box-shadow: 0 8px 25px rgba(255, 94, 58, 0.4);

/* Pricing card */
box-shadow: 0 25px 60px rgba(0,0,0,0.3);

/* Coach image */
box-shadow: 0 15px 40px rgba(71, 117, 185, 0.3);
```

---

## 2. Page Structure (Sections in Order)

### Landing Page (`index.html`)

| # | Section | Background | Purpose |
|---|---------|-----------|---------|
| 1 | Top Bar | Orange gradient | Urgency text (blinking) |
| 2 | Hero | Dark blue gradient | Main headline + CTA + Coach image |
| 3 | Countdown Bar | Dark gradient | Timer urgency |
| 4 | Challenges | Light (#f8faff) | Pain points grid (3x3) |
| 5 | What You'll Learn | Dark blue gradient | 5-day curriculum cards |
| 6 | Meet Your Coach | White | Bio + credentials |
| 7 | Achievements | Dark gradient | Gallery grid (awards) |
| 8 | Invitation | Light (#f8faff) | What's included (4 cards) |
| 9 | Testimonials | White | Student reviews (3 cards) |
| 10 | Pricing/Register | Dark gradient | Price card + CTA |
| 11 | FAQ | Light (#f8faff) | Accordion |
| 12 | Footer | Darkest (#0a1628) | Links + copyright |
| - | Sticky Bottom CTA | Dark transparent | Always-visible CTA |
| - | Scroll to Top | Blue gradient | Utility button |

### Thank You Page (`thank-you.html`)

| # | Section | Purpose |
|---|---------|---------|
| 1 | Confetti Animation | Celebration feel |
| 2 | Success Hero | Checkmark + thank you message |
| 3 | Next Steps | 3 action cards |
| 4 | Workshop Details | Date, time, platform info |
| 5 | WhatsApp CTA | Join community group |
| 6 | Social Share | Share buttons |
| 7 | Footer | Navigation back |

---

## 3. Component Patterns

### CTA Button

```css
.cta-button {
    background: linear-gradient(135deg, #ff8c00, #ff5e3a);
    color: #fff;
    font-weight: 800;
    padding: 18px 36px;
    border-radius: 50px;
    box-shadow: 0 8px 25px rgba(255, 94, 58, 0.4);
    /* Shine animation + Pulse animation */
}
```

### Card Pattern

```css
.card {
    background: #fff;
    border-radius: 16px;
    padding: 30px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    border: 1px solid rgba(0,0,0,0.04);
    transition: transform 0.3s;
}
.card:hover {
    transform: translateY(-5px);
    box-shadow: 0 15px 40px rgba(0,0,0,0.1);
}
```

### Gradient Circle Icon

```css
.icon-circle {
    width: 65px;
    height: 65px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 1.5rem;
    /* Apply one of the gradient presets */
}
```

### Section Title Pattern

```css
.section-title {
    text-align: center;
    font-size: 2.3rem;
    font-weight: 800;
    color: #1a1a2e; /* or #fff for dark sections */
    margin-bottom: 10px;
}
.section-sub {
    text-align: center;
    font-size: 1.05rem;
    color: #666; /* or rgba(255,255,255,0.8) */
    margin-bottom: 40px;
}
```

### Day Card (Curriculum)

```html
<div class="day-card">
    <div class="day-header" style="background: linear-gradient(...);">
        <span class="day-badge">DAY X</span>
        <h3>Title</h3>
    </div>
    <ul class="day-list">
        <li><i class="fas fa-check"></i> Point</li>
    </ul>
</div>
```

### FAQ Accordion

```html
<div class="faq-item">
    <div class="faq-q" onclick="toggleFAQ(this)">
        <span>Question?</span>
        <i class="fas fa-chevron-down"></i>
    </div>
    <div class="faq-a"><p>Answer.</p></div>
</div>
```

---

## 4. Animations & Interactions

| Animation | Where | CSS/JS |
|-----------|-------|--------|
| Pulse | CTA buttons | `@keyframes pulse-anim` (box-shadow pulse) |
| Shine | CTA buttons | `::after` pseudo-element sliding |
| Float | Hero coach circle | `@keyframes float` (translateY) |
| Blink | Top bar text | `@keyframes blinker` (opacity) |
| Scroll reveal | Cards, grid items | IntersectionObserver + opacity/translateY |
| Hover lift | All cards | `transform: translateY(-5px)` on hover |
| FAQ toggle | Accordion | `max-height` transition + chevron rotate |
| Confetti | Thank-you page | JS-generated falling pieces |
| Countdown | Timer section | `setInterval` with `Date.now()` |

---

## 5. JavaScript Features

### Countdown Timer
- Reads end date from `data.json`
- Stores in `localStorage` for persistence across refreshes
- Uses `Date.now()` so it works correctly when user switches tabs
- Shows expired message when timer hits zero

### FAQ Accordion
- Click toggles `active` class
- Only one open at a time (closes others)
- Smooth max-height transition

### Scroll Events
- Scroll-to-top button appears after 400px scroll
- Sticky bottom CTA appears after 700px scroll
- Smooth scroll for anchor links

### Scroll Animations
- IntersectionObserver watches cards/grid items
- Fade-in + slide-up on enter viewport
- Staggered delays for grid items

---

## 6. Responsive Breakpoints

| Breakpoint | Changes |
|-----------|---------|
| ≤992px | Hero stacks vertically, 2-column grids, coach section stacks |
| ≤768px | 1-column grids, smaller titles, compact countdown |
| ≤480px | Minimal padding, smallest type, compact buttons |

---

## 7. File Structure

```
copy/
├── index.html              (v1 - simple version)
├── style.css               (v1 styles)
├── script.js               (v1 scripts)
├── funnel-flow.md          (funnel documentation)
├── design-reference.md     (this file)
│
└── v2/                     (v2 - full redesign)
    ├── index.html          (main landing page)
    ├── thank-you.html      (post-payment page)
    ├── style.css           (all styles)
    ├── script.js           (all interactions)
    └── data.json           (editable config - dates, prices, links)
```

---

## 8. Data Configuration (`data.json`)

```json
{
    "countdown": {
        "endDate": "2026-07-20T23:59:59",
        "timezone": "Asia/Kolkata",
        "expiredMessage": "Registration Closed!",
        "showAfterExpiry": false
    },
    "registration": {
        "price": "455",
        "originalPrice": "4999",
        "currency": "₹",
        "link": "https://pages.razorpay.com/pl_KEgk4cLwZxvVC0/view",
        "buttonText": "REGISTER NOW FOR ₹455/- ONLY"
    },
    "workshop": {
        "name": "Read For Success - 5 Day Speed Reading Challenge",
        "coach": "Dr. Manjunath",
        "days": 5,
        "startDate": "2026-07-21T19:00:00"
    }
}
```

---

## 9. External Dependencies

| Resource | CDN |
|----------|-----|
| Font Awesome 6.5 | `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css` |
| Google Fonts (Poppins) | `https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900` |

**No other dependencies.** Pure HTML, CSS, JavaScript. No frameworks, no build tools.

---

## 10. Conversion Optimization Checklist

- [x] Multiple CTAs throughout page (hero, after pain points, after curriculum, pricing)
- [x] Countdown timer with urgency
- [x] Blinking top bar with urgency text
- [x] Old price crossed out + new price highlighted
- [x] Social proof (testimonials, stats, "As Seen On")
- [x] Authority signals (awards, credentials, "50,000+ students")
- [x] Pain point agitation before solution reveal
- [x] Sticky bottom CTA on scroll
- [x] FAQ section for objection handling
- [x] Mobile-first responsive design
- [x] Fast loading (no heavy frameworks)
- [x] Pulse animation on CTA to draw attention
- [x] Scroll-reveal animations for engagement
- [x] Price anchoring (₹4,999 → ₹455 = 90% off)
- [x] Limited time framing ("Registration closes in...")

---

## 11. How to Customize for a New Project

1. **Update `data.json`** — Change dates, prices, links
2. **Update content in `index.html`** — Headlines, pain points, curriculum, testimonials
3. **Swap gradient colors** — Change the gradient presets for new branding
4. **Replace coach info** — Name, bio, credentials
5. **Update payment link** — New Razorpay/Stripe link
6. **Update `thank-you.html`** — Workshop details, WhatsApp link
7. **Update tracking** — Add your own FB Pixel, GTM, ClickMagick IDs

---

*This reference file contains everything needed to recreate or adapt this landing page design for any workshop/webinar funnel.*
