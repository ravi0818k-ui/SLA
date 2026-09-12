# Notes Template Spec — turn a chapter PDF into a notes `.md`

> This file is a **specification, not notes**. Do not run it through the script.
> Give this file + a chapter PDF to an AI; it writes the notes `.md`.

The pipeline has three steps:

1. **You give an AI:** this `template.md` + the chapter PDF (e.g. `iest103.pdf`)
   — and optionally a worked example (`Ch3_Atmosphere_Summary.md`).
2. **The AI returns:** one notes file, e.g. `Ch4_MyChapter_Summary.md`.
3. **You run:** `python generate_notes_pdf.py Ch4_MyChapter_Summary.md`
   → a ruled, highlighted, handwriting-style notes PDF.

Everything below is what the AI in step 1 needs to know. Nothing here is
chapter content, so this file never changes from chapter to chapter.

---

## 1. What to produce

Pick one recipe per file. Both use the identical grammar.

**Recipe A — Chapter summary notes** (understanding + revision; the usual choice)

| Order | Block | How many |
| --- | --- | --- |
| 1 | `## SETTINGS` | exactly 1, at the top |
| 2 | `## BIGQ` | 1 — the chapter's own "big questions" if it has them |
| 3 | `## MINDMAP` | 2 — one for the whole chapter, one for its hardest mechanism |
| 4 | `## SECTION` | one per heading/sub-heading of the chapter (usually 8–14) |
| 5 | `## TABLE` | one per table in the chapter, plus any "compare the layers"-type chart worth making |
| 6 | `## FLOW` | 1–2 — for any cause→effect chain or process |
| 7 | `## COMPARE` | one per "distinguish between X and Y" pair |
| 8 | `## FACTFILE` | 1 — extra one-liners, dates, names, "did you know" facts |
| 9 | `## QUICK REVISION` | 1 — 12–18 one-line points |
| 10 | `## EXAM QUESTIONS` | 1 — the chapter's own questions, with marks |

Interleave 3–8 in chapter order (put a `## TABLE` right after the `## SECTION`
it belongs to). Blocks 9 and 10 always go last.

**Recipe B — Question/answer revision cards**

`## SETTINGS`, then 1–2 `## MINDMAP`, then one `## TOPIC` per examinable idea
(20–30 is normal), then `## QUICK REVISION`.

---

## 2. File skeleton

```
# Chapter title
> Chapter 3 · Book name · Grade 9
> Section-wise concept notes, mind maps & key points

## SETTINGS

- output: Ch3_Atmosphere_Summary.pdf
- page_size: A4
- handwriting: true
- highlight_keys: true
- ruled_pages: true
- cover_page: true
- contents_page: true

---

## SECTION

### Composition of the Atmosphere

**Concept:** ...
```

`output:` is the PDF filename — name it after the chapter. `---` between blocks
is optional and ignored; it just makes the file readable.

---

## 3. Block grammar

Each block is `## NAME`, an optional `### Title`, then its content lines.

### `## BIGQ` — numbered question boxes

```
## BIGQ

### The Big Questions

- What is the ==composition of the atmosphere==?
- How can we ==reduce our carbon footprint==?
```

### `## MINDMAP` — radial map

One line per branch: `- Label: detail`. The **first colon splits** label from
detail, so keep colons out of the label.

```
## MINDMAP

### Atmosphere & Climate

- Composition: ==78% Nitrogen==, ==21% Oxygen==, Argon 0.93%, CO2 0.04%
- Structure: 5 layers - Troposphere to Exosphere
- Monsoon: ==seasonal reversal of wind direction==
```

Rules: 6–8 branches per map, detail ≤ 14 words. Over 8 branches the map
continues on a second page, so prefer splitting into two maps by theme.

### `## SECTION` — the main concept notes

```
## SECTION

### Structure of the Atmosphere — the Five Layers

**Concept:** The atmosphere has a **layered structure**, marked out by
==changes in temperature and density with increasing altitude==.

**In simple words:** Think of it as a ==five-storey building==.

**Key points:** Layer-by-layer facts
- **Troposphere** — about ==12 km==. Temperature ++decreases++ with altitude.
- **Stratosphere** — up to ==50 km==. Holds the ==ozone layer==.

**Word to know:** **Altitude** is the height of a place above mean sea level.

**Key to remember:** ==T-S-M-T-E== -> Troposphere, Stratosphere, Mesosphere,
Thermosphere, Exosphere.

**Watch out:** !!Temperature falls with height ONLY in the troposphere and
mesosphere.!!

**Exam tip:** Draw the layers as five stacked bands and label both pauses.
```

### `## TABLE` — pipe table

First row is the header. The `| --- |` separator row is optional and ignored.

```
## TABLE

### The five layers — quick revision chart

| Layer | Extent | Temperature with height | Special feature |
| --- | --- | --- | --- |
| Troposphere | Up to about 12 km | Decreases | Weather, clouds, tropopause |
| Stratosphere | Up to 50 km | Increases | Ozone layer, aeroplanes |
```

Keep to 2–5 columns. Never put a stray `|` inside cell text.

### `## FLOW` — arrow chain

```
## FLOW

### How wind is born (write this chain in your answer)

- Sun heats the land unequally
- Air over the hot area becomes light and rises
- A LOW-pressure area forms there
- Air rushes from high pressure to low pressure
- This moving air is called WIND
```

4–7 steps, one short line each.

### `## COMPARE` — difference chart

```
## COMPARE

### Land breeze vs Sea breeze

**Left:** Sea breeze (Day)
**Right:** Land breeze (Night)

- Time of blowing | Day, especially the afternoon | Night
- Direction | From ==sea to land== | From ==land to sea==
- Wind speed | Relatively higher | ++Low++, small pressure difference
```

Each row is `- point of difference | left value | right value`.

### `## FACTFILE` — sticky notes

```
## FACTFILE

### Did you know? (great one-liners for extra marks)

- The word ==monsoon== comes from the Arabic *mausim*, meaning **season**.
- ==Kalidasa's *Meghadutam*== traces the path of monsoon clouds.
```

6–10 notes, 1–3 lines each.

### `## TOPIC` — Q&A revision card (Recipe B)

Use these six labels, in this order:

```
## TOPIC

### Atmosphere

**Question:** What is the atmosphere?

**Simple def:** The atmosphere is the blanket of air surrounding the Earth,
held by ==gravity== and vital for life.

**Key to remember:** ATMOSPHERE = ==EARTH'S PROTECTIVE BLANKET==.

**One-liner question:** Which blanket of air surrounds Earth? --- Atmosphere.

**MCQ:** The atmosphere mainly helps Earth by: (A) removing gravity
(B) shielding harmful radiation and regulating temperature (C) stopping
sunlight (D) removing clouds. **Ans: B**

**Concept related to:** Gravity, weather, climate, gases, solar radiation.
```

MCQ format matters: options as `(A) ... (B) ... (C) ... (D) ...` on one line and
the answer as `**Ans: B**`. The script then draws the options with the correct
one highlighted in green.

### `## QUICK REVISION` — one-line strips

```
## QUICK REVISION

### Last-minute revision — read this 10 minutes before the exam

- Layers in order: ==Troposphere -> Stratosphere -> Mesosphere -> Thermosphere -> Exosphere==
- ==Weather = short term; Climate = long term (30 years or more)==
```

12–18 points, each one line, each carrying a number, name or exact term.

### `## EXAM QUESTIONS` — question list with marks

```
## EXAM QUESTIONS

### Questions & activities from the chapter

- What is atmosphere? Explain its composition with a pie diagram. | 5 marks
- In which layer do aeroplanes fly and why? | 2 marks
- Collect pictures of houses from different regions of India. | Activity
```

Format: `- question text | marks`. Take these from the chapter's own exercise
list wherever it has one.

---

## 4. Field labels → box styles

Inside `## SECTION`, the label decides how the text is drawn. Use these exact
labels to get these boxes:

| Label | Drawn as | Use it for |
| --- | --- | --- |
| `Concept:` | plain paragraph | the main explanation, in easy language |
| `In simple words:` | green box, pin icon | a one-sentence analogy a 14-year-old gets instantly |
| `Key points:` | tick-mark checklist | the facts to memorise (its own text becomes the heading) |
| `Word to know:` | labelled paragraph | the chapter's definition boxes / glossary terms |
| `Key to remember:` | big yellow star box | the single line worth memorising verbatim |
| `Exam tip:` | blue box, bulb icon | how to actually write the answer |
| `Trick:` | pink box | a mnemonic |
| `Watch out:` | red warning box | the trap, exception or common mix-up |
| `Real life link:` | plain paragraph | an everyday example |
| `Concept related to:` | coloured tag pills | 3–6 comma-separated linked terms |

Any other label (`Case study:`, `Diagram to draw:`) still works — it becomes a
labelled paragraph, so invent one when you need it. Order the fields as listed
above: explain → simplify → list → define → memorise → warn.

---

## 5. Inline highlighter markup

| Write | Get | Use for |
| --- | --- | --- |
| `**text**` | bold blue pen | key nouns inside a sentence |
| `==text==` | yellow highlighter | definitions and the exact terms an examiner looks for |
| `++text++` | green highlighter | facts, figures, dates, correct answers |
| `!!text!!` | pink highlighter | traps, exceptions, things students mix up |
| `__text__` | red underline | a keyword worth writing in every answer |
| `*text*` | red underline | book titles, foreign words (*mausim*) |

Markers nest: `==the ozone sits in the **stratosphere**==` is highlighted *and*
bold. Aim for **2–4 highlights per paragraph** — a page where everything is
highlighted is a page with nothing highlighted.

---

## 6. Parser rules (the things that actually break)

1. **A field label must contain a colon inside or right after the bold:**
   `**Key to remember:**` or `**Key to remember**:`. Without the colon it is
   drawn as an ordinary paragraph.
2. A line that merely *starts* bold stays a paragraph — `**Gravity** is the
   force of attraction ...` is safe, and is the right way to write a definition.
3. **Highlight markers must open and close on the same line.** A `==` left
   unclosed prints literally.
4. `- ` lines after a field belong to that field. A blank line or `---` ends the
   field.
5. A wrapped line with no marker is appended to the field or list item above it,
   so paragraphs may span several lines freely.
6. Only `#`, `>`, `## BLOCK`, `### Title` are structural. `####` and deeper are
   treated as ordinary text.
7. **Never use ``` code fences** in the notes file — the parser has no concept of
   them and would render the backticks.
8. Type arrows as `->`. The script converts them for fonts lacking the glyph.
9. Write `---` for a dash; it becomes an em dash. Avoid `|` except in tables and
   `## COMPARE` rows.
10. `### 1. Heading` is fine — the leading number is stripped, because the
    renderer draws its own numbered badge.
11. Unknown block names (`## SUMMARY`) are treated as a `## SECTION` with that
    title, so a typo degrades gracefully rather than crashing.
12. `## MINDMAP`, `## QUICK REVISION` and `## EXAM QUESTIONS` always start on a
    fresh page — everything else flows.

---

## 7. Writing rules (what makes the notes good)

- **Only what is in the chapter.** No outside facts, no invented examples,
  no invented exam questions. If the chapter gives a figure (78%, 12 km,
  June–September), use its exact figure.
- **Class-9 English.** Short sentences. Explain the idea before naming it.
- Keep every **number, proper noun, date and technical term** from the chapter —
  those are what marks are awarded for.
- Cover the chapter's boxes too: `THINK ABOUT IT`, `DON'T MISS OUT`,
  `LET'S EXPLORE`, glossary margins, case studies. They make good
  `Word to know:`, `Watch out:` and `## FACTFILE` material.
- `Key to remember:` is one line, in CAPITALS, that could be written on a palm.
- Every `## SECTION` should be answerable from its own `Key points:` alone.
- Prefer a `## TABLE` or `## COMPARE` over a long paragraph whenever the chapter
  compares things — the exam asks it that way.

---

## 8. Self-check before returning the file

- [ ] Starts with `# Title`, then `>` subtitle lines, then `## SETTINGS`.
- [ ] `output:` names a `.pdf` matching the chapter.
- [ ] Every field label has its colon inside the bold.
- [ ] Every `==`, `++`, `!!`, `__`, `**` is closed on its own line.
- [ ] Table rows all have the same number of `|` separators.
- [ ] Each `## COMPARE` row has exactly two `|`.
- [ ] Each `## EXAM QUESTIONS` line ends with `| n marks` or `| Activity`.
- [ ] Mind map branches ≤ 8 per block, no colon in a branch label.
- [ ] No code fences anywhere in the file.
- [ ] Every chapter heading has a matching `## SECTION`.

---

## 9. Copy-paste prompt for step 1

The ready-to-paste version of this, with variants and follow-ups, is in
`AI_PROMPT.txt`.

> I have uploaded a textbook chapter PDF and `template.md` (the notes template
> spec).
> Read the whole chapter, then write **one** notes Markdown file following
> Recipe A in the spec, obeying its grammar, parser rules and writing rules
> exactly. Name the file `ChNN_<Topic>_Summary.md` and set `output:` to
> `ChNN_<Topic>_Summary.pdf`. Use one `## SECTION` per chapter heading, in
> chapter order, and include every table, process, comparison, glossary term and
> exercise question the chapter contains. Highlight exam-critical terms with
> `==...==`, figures and facts with `++...++`, and traps with `!!...!!`.
> Invent nothing that is not in the chapter. Finish by running through the
> spec's self-check list, then output only the file contents.

For Recipe B, swap "Recipe A" for "Recipe B" and ask for
`ChNN_<Topic>_Questions.md`.
