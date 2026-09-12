# SLA

Static site for Super Learner Academy — the webinar landing page plus a
browser-based notes PDF generator. No build step; GitHub Pages serves the files
as they are, behind the domain in `CNAME`.

## Use it in your browser

**https://www.superlearneracademy.in/generatenotes/**

Drop a notes `.md` file on the page and it renders a printable,
handwritten-style PDF — no install, no account, no upload. CPython and Pillow
are compiled to WebAssembly with [Pyodide](https://pyodide.org/) and run inside
a Web Worker, so **your file never leaves your device**.

First visit downloads roughly 10 MB (Pyodide core, Pillow and the four bundled
fonts); the browser caches it afterwards, and a second render in the same
session skips the boot sequence entirely. Rendering is a few times slower than
desktop CPython — a full chapter takes tens of seconds.

Options mirror the CLI flags: font style (handwriting / print), page size
(A4 / Letter), ruled lines, cover page and contents page. The chosen values
persist in `localStorage`.

### Making a notes file from a chapter

The page renders a notes `.md` — it does not read chapter PDFs. A
**"Don't have a notes file yet?"** section on the page walks through the
three-step pipeline that `template.md` describes:

1. Download `template.md` (and optionally the worked example) from the page.
2. Give both, plus the chapter PDF, to any AI tool along with the copy-ready
   prompt on the page.
3. Save the reply as a `.md` and drop it into the page.

The prompt lives in the `#prompt-text` block in `generatenotes/index.html`; the
Copy button reads its `textContent`, so edit it there rather than duplicating it
elsewhere. Keep it consistent with `template.md` — it tells the AI to follow that
spec, to use only facts from the user's own chapter, and not to invent figures.

### What lives where

```
generatenotes/
  index.html              markup + styles
  app.js                  UI, worker orchestration, download
  worker.js               Pyodide host (off the main thread)
  runner.py               glue: font injection, progress hook, build_pdf call
  generate_notes_pdf.py   COPY of the root file, byte-identical
  fonts/                  Kalam + Lato, SIL OFL, with LICENSES.md
  examples/               sample chapters for the "Try an example" button
```

### Keeping the copy in sync

`generatenotes/generate_notes_pdf.py` **must stay byte-identical** to the root
`generate_notes_pdf.py`, which is the single source of truth for both the CLI
and the web app. Nothing web-specific may be added to it — `runner.py` achieves
every web-specific behaviour from outside the file, by mutating `FAMILIES` and
wrapping `Book.new_page` after import.

Three root files are mirrored into `generatenotes/`. After editing any of them,
copy it over:

```bash
cp generate_notes_pdf.py     generatenotes/
cp template.md               generatenotes/
cp Ch3_Atmosphere_Summary.md generatenotes/examples/
```

`.github/workflows/sync-notes-generator.yml` fails the build if any copy ever
diverges from its root original.

### Fonts

The generator's `FAMILIES` table points at `C:\Windows\Fonts\...` and
`/System/Library/...`, none of which exist in a browser — without replacements
`FontSet` silently falls back to `ImageFont.load_default()`, a tiny bitmap font.
So four SIL Open Font License faces are bundled and injected at the front of
every candidate list:

| Slot | Font |
|---|---|
| `handwriting_r.ttf` / `handwriting_b.ttf` | Kalam Regular / Bold |
| `print_r.ttf` / `print_b.ttf` | Lato Regular / Bold |

No Microsoft or Apple system fonts (Segoe Print, Comic Sans, Calibri, Segoe UI)
are committed — their licences permit local use, not redistribution. Full
licence text and attributions: [`generatenotes/fonts/LICENSES.md`](generatenotes/fonts/LICENSES.md).

Replacements must be static `.ttf`/`.otf` — Pillow's FreeType build cannot read
`.woff2`, which is what the Google Fonts CSS API serves. Verify before
committing:

```bash
python -c "from PIL import ImageFont; ImageFont.truetype('generatenotes/fonts/handwriting_r.ttf', 32)"
```

## Landing page

`index.html` and `thank-you.html` are driven by `data.json`; see `CLAUDE.md` for
the architecture, content rules and test strategy.

```bash
npm test   # vitest, run once
```
