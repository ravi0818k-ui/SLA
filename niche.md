# Niche.md — Audience, Positioning & Content Strategy

> Source of truth for **what Super Learner Academy says and to whom**.
> `theme.md` covers how the site *looks*; this covers what it *says*.
> Every headline, section, FAQ answer, ad, and video should be traceable to something on this page.
> The condensed version of these rules lives in `CLAUDE.md` → "Positioning & content niche".

---

## 1. Niche Statement

> **Help students get better grades by teaching practical, science-informed strategies for improving memory, focus, study skills, and growth mindset.**

Three words carry the whole positioning — drop any one and the offer weakens:

| Word | What it commits us to | What it rules out |
|---|---|---|
| **Students** | Speaking to a school/college-age learner and their exams | Generic "productivity" or corporate-training framing |
| **Science-informed** | Naming real mechanisms and explaining *why* a technique works | Pseudo-science, mystique, "unlock 100% of your brain" |
| **Practical** | Techniques usable on tonight's homework, taught by demonstration | Theory lectures, abstract motivation, pure inspiration |

**The core promise:** better grades come from a *better method*, not more hours.
**The core identity shift:** from "someone who studies hard" → "someone who knows how to learn."

---

## 2. Target Viewer Profile

**Primary:** students, especially teens and young adults — Class 6 through graduation, plus board and competitive-exam aspirants (JEE, NEET, UPSC, CA).

**Secondary:** parents of those students — they often hold the payment decision, so copy should survive a skeptical parent reading over the student's shoulder.

**Footnote, never the lead:** working professionals and lifelong learners. They're welcome and mentioned last; they don't get to reshape the messaging.

| | |
|---|---|
| **Pain point** | Forgetting what they study, losing focus, using ineffective study methods, feeling stuck at average performance |
| **Dream result** | Remember more, focus better, study smarter, achieve higher grades |
| **Core desire** | Become a **confident, effective learner** — rather than simply studying harder |

### The six pains, as written on the site

These drive the `#challenges` section. Use this exact vocabulary in ads and hooks — it's the language the reader already uses in their own head:

1. **You forget it by exam day** — revised twice, still blanks in the hall
2. **Long hours, average marks** — studies more than friends who score higher
3. **Focus breaks in 10 minutes** — attention gone before the first page ends
4. **Re-reading & highlighting** — the lowest-yield method, used as the only method
5. **No revision system** — crams the night before, forgets within a week
6. **"I'm just an average student"** — has accepted a ceiling that is method, not ability

> The last one is the emotional core of the niche. Every other pain is mechanical; this one is identity. Lead with it when a hook needs to cut deep.

---

## 3. Content Pillars

Three pillars. They organise everything — the workshop days, the landing page, and the content calendar.

### Pillar 01 — Memory & Brain
*Stop forgetting what you studied last week.*

Memory techniques, the **Hook System**, observation training, **neurobics**, and how the brain learns.

**Topic bank:** Hook System for lists/dates/formulas · memory palace / method of loci · encoding vs. retrieval · why cramming fails · observation drills · neurobics exercises · chunking · mnemonics for formulas and periodic table · how sleep consolidates memory

### Pillar 02 — Study & Focus
*Replace the methods that feel productive with the ones that work.*

Effective study methods, concentration, practice strategies, and learning approaches.

**Topic bank:** active recall · spaced practice / the forgetting curve · why re-reading and highlighting rank lowest · building a revision schedule · interleaving · deep-work study blocks · phone/distraction control · Feynman technique · past-paper strategy · pre-exam breathing for clarity

### Pillar 03 — Mindset & Learning
*Techniques fail without the identity behind them.*

Growth mindset, self-talk, meditation, and building the identity of a capable learner.

**Topic bank:** growth vs. fixed mindset · "I'm bad at maths" as a fixable belief · neuroplasticity · self-talk scripts · recovering from a bad result · exam anxiety and how stress blocks recall · meditation for students · consistency and study identity · comparison with toppers

---

## 4. How the Niche Maps to the Live Page

The pillar structure is load-bearing — it repeats in five places, and they must stay in sync. Changing one means changing all five.

| Where | How the pillars appear |
|---|---|
| Hero `.hero-features` | 🧠 Memory & Brain · 🎯 Study & Focus · 🌱 Mindset & Growth |
| Hero orbit badges | Hook System, Neurobics, Growth Mindset, Deep Focus, Meditation, Read Faster |
| `#pillars` section | Three cards, one per pillar, each with four technique tags |
| `#curriculum` day cards | Day 1 = Pillar 01, Day 2 = Pillar 02, Day 3 = Pillar 03 |
| FAQ "What will I learn in 3 days?" | Answer is structured day-by-day as the three pillars |

**Full page flow, and the job each section does:**

| Section | Job |
|---|---|
| `#hero` | Promise the outcome (higher marks) and the wedge (smarter, not harder) |
| `#pillars` | Show there's a *system*, not a bag of tricks |
| `#curriculum` | Make the system concrete — named techniques, one pillar per day |
| `#countdown` | Urgency |
| `#challenges` | Agitate the six pains in the reader's own words |
| `#science` | Prove the mechanism — this is what earns "science-informed" |
| `#who-for` | Self-identification, students first |
| `#coach` | Credibility |
| `#included` | Value stack |
| `#testimonials` | Social proof of outcomes |
| `#pricing` | Convert |
| `#faq` | Remove last objections (incl. "is this real science?" and "will it improve my grades?") |

---

## 5. Copy Rules

### Do

- **Lead with the grade result, not the skill.** "Score higher" is the headline; "better recall" is the mechanism.
- **Name real techniques.** "The Hook System," "active recall," "spaced practice," "neurobics" — specificity is what separates this from every other study-tips page.
- **Explain the mechanism.** The `#science` section exists because a student who understands *why* recall beats re-reading actually changes their behaviour. Teach the reason, not just the rule.
- **Write for tonight's homework.** Every technique should be usable within 24 hours of learning it.
- **Keep the parent in mind.** Copy should read as credible to an adult paying for it.

### Don't

- **No pseudo-science.** "Photographic memory" was removed from the hero badges for exactly this reason — it sat next to a science claim and undercut it.
  - ✅ Defensible: memory palaces, mnemonics, spaced repetition, active recall, neuroplasticity, attention training
  - ❌ Off-limits: eidetic/photographic memory, "you only use 10% of your brain," learning styles as fixed neurology, subliminal learning, brain-hemisphere personality claims
- **No invented outcome numbers.** `.testimonial-result` badges summarise what a quote already claims — never a fabricated figure like "+23%" or "60% → 85%." The grades FAQ deliberately refuses to promise a number; don't "improve" it by adding one.
  - ⚠️ **Open action:** the three testimonials on the page are still placeholders. Replace with real, verified student results before running paid traffic. There's an HTML comment above that grid as a reminder.
- **Don't drift to "productivity."** Time-management, morning routines, and hustle content are adjacent but off-niche. The subject is *learning*, and the scoreboard is *grades*.
- **Don't lead with professionals.** They're a footnote in `#who-for` by design.

---

## 6. Off-Niche (say no to these)

Speed-reading as a standalone claim · IQ testing · corporate/L&D training · general productivity and time management · career advice · subject tutoring (we teach *how* to learn, not the syllabus) · exam-paper leaks or shortcuts · anything promising results without practice.

---

## 7. Message Hierarchy (for ads, thumbnails, hooks)

Ordered by pull. Start at the top and only move down if a channel needs variety.

1. **"Studying hard but marks not moving?"** — the pain, in their words
2. **"It's your method, not your ability."** — the reframe that creates hope
3. **"Study smarter. Score higher."** — the promise
4. **"Re-reading is the worst way to study. Here's what works."** — the pattern-interrupt
5. **"Three pillars: memory, focus, mindset."** — the system
6. **"Backed by learning science, not motivation."** — the differentiator
