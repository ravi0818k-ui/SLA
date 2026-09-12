# Feature spec: browser-based notes generator (GitHub Pages, no server)

Implement a static web front-end for `generate_notes_pdf.py` so that anyone can
open a GitHub Pages URL, upload a notes `.md` file, watch it compile, and
download the finished PDF.

Everything runs in the visitor's browser. There is no backend, no API, no build
step, no bundler. The deployed site is plain files served by GitHub Pages.

---

## 1. Non-negotiable constraints

1. **No server-side logic of any kind.** No Node, no Python on a host, no
   serverless functions. GitHub Pages serves static files only.
2. **Do not modify `generate_notes_pdf.py`.** It stays the single source of
   truth for both the CLI and the web app. Every web-specific behaviour is
   achieved from outside the file. (See §4 — this is genuinely possible; do not
   "just add a small flag" to it.)
3. **The user's file never leaves their machine.** No uploads, no telemetry, no
   analytics. Say so in the UI.
4. **Only bundle fonts that are legally redistributable.** See §6.
5. The Python must run in a **Web Worker**, never on the main thread.

---

## 2. How it works

The renderer is CPython + Pillow compiled to WebAssembly, via **Pyodide**.
Pyodide ships a prebuilt Pillow wheel, and Pillow is the script's only
dependency, so the existing code runs unmodified.

```
index.html  ──▶  app.js  ──postMessage──▶  worker.js
                  (UI)                       │
                                             ├─ loadPyodide() from CDN
                                             ├─ loadPackage("Pillow")
                                             ├─ write fonts into MEMFS
                                             ├─ write uploaded .md into MEMFS
                                             ├─ run runner.py
                                             └─ read /work/out.pdf bytes
                                             │
            ◀────── {type:"done", bytes} ────┘
                    Blob → object URL → <a download> + <iframe> preview
```

---

## 3. Files to create

```
docs/                          <- GitHub Pages source folder
  index.html                   <- markup + styles (single file is fine)
  app.js                       <- UI, worker orchestration, download
  worker.js                    <- Pyodide host, runs off the main thread
  runner.py                    <- thin Python glue (see §4)
  generate_notes_pdf.py        <- COPY of the root file, byte-identical
  fonts/
    handwriting_r.ttf
    handwriting_b.ttf
    print_r.ttf
    print_b.ttf
    LICENSES.md                <- OFL text + attributions
  examples/
    Ch3_Atmosphere_Summary.md  <- copy, for the "Try an example" button
    Ch3_Atmosphere_Questions.md
```

> **Keeping the copy in sync.** `docs/generate_notes_pdf.py` must never diverge
> from the root one. Either add a GitHub Action that copies root → docs on push
> and fails the build if they differ, or add a short note in `README.md`
> documenting the manual copy step. Pick one and implement it; do not leave the
> duplication undocumented.

Enable Pages on the repo with source = `main` branch, `/docs` folder.

---

## 4. `runner.py` — the glue (this is the important part)

`generate_notes_pdf.py` needs no edits because of three properties of its
current design:

- `FontSet` is constructed **inside `build_pdf` at call time**
  (`generate_notes_pdf.py:1866`), not at import time. So mutating the
  module-level `FAMILIES` dict *after import but before calling* `build_pdf`
  changes which fonts get used.
- `parse_markdown` reads with `Path(path).read_text()` and `build_pdf` writes
  with `pages[0].save(output_file, ...)`. Both work normally against Pyodide's
  in-memory filesystem (MEMFS).
- `main()` is guarded by `if __name__ == "__main__"`, so importing the module
  does not touch `sys.argv` or call `sys.exit()`.

`runner.py` should do the following:

```python
import json, time, traceback
from pathlib import Path
import generate_notes_pdf as gen

FONT_DIR = "/fonts"

# 1. Font injection: prepend the bundled web fonts to every candidate list.
#    FAMILIES maps family -> {"r": [paths], "b": [paths]}; FontSet picks the
#    first path that exists, so inserting at index 0 wins.
for family, styles in gen.FAMILIES.items():
    for style, paths in styles.items():
        paths.insert(0, "%s/%s_%s.ttf" % (FONT_DIR, family, style))

# 2. Progress: wrap Book.new_page so the worker can report page counts.
#    (generate_notes_pdf.py:724 — it appends to self.pages)
_progress_cb = None
_orig_new_page = gen.Book.new_page

def _new_page(self, header=True):
    result = _orig_new_page(self, header)
    if _progress_cb:
        _progress_cb(len(self.pages))
    return result

gen.Book.new_page = _new_page


def generate(md_text, overrides_json, progress_cb=None):
    """Render markdown text to PDF bytes. Returns (bytes, info_dict)."""
    ...
```

Notes for the implementer:

- `build_pdf` mutates nothing global except via `FontSet`, so repeated calls in
  one session are safe. **Do** delete `/work/out.pdf` before each run so a
  failed run cannot serve a stale PDF.
- Return the suggested output filename too. Resolve it in this order:
  1. the `output:` key in the markdown's `## SETTINGS` block
     (`gen.parse_markdown("/work/in.md")["settings"]["output"]`),
  2. otherwise the uploaded file's own basename with `.pdf` substituted,
  3. otherwise `Board_Exam_Notes.pdf`.
- Also return the page count, the block-kind tally (`build_pdf` already computes
  one for its summary print), and the resolved font basename, so the UI can
  show a result summary.
- Wrap the `build_pdf` call so a malformed markdown file surfaces as a clean
  message. Catch `Exception` and send back `traceback.format_exc()` as detail
  the user can expand — never let it fail silently.

---

## 5. `worker.js`

Responsibilities, in order:

1. `importScripts()` Pyodide from the jsDelivr CDN. **Pin an exact version** —
   do not use a floating `latest` URL, because a Pyodide upgrade changes the
   bundled Python version and can break things with no code change on your side.
2. `loadPyodide({ stdout, stderr })` — route both into `postMessage` so the
   `print()` calls already in `build_pdf` (`generate_notes_pdf.py:1950-1956`)
   appear in the UI log.
3. `await pyodide.loadPackage("Pillow")`.
4. `fetch()` the four `.ttf` files and the two `.py` files, then write them into
   MEMFS with `pyodide.FS.writeFile`. Fonts are binary — write the
   `Uint8Array`, not a decoded string.
5. `pyodide.FS.mkdir("/fonts")` and `/work` before writing into them.
6. Add the directory containing `runner.py` to `sys.path`, then import it.
7. Post `{type:"ready"}` back to the page.

**Message protocol** (implement exactly this, both directions):

| Direction | Message | Meaning |
|---|---|---|
| page → worker | `{type:"init"}` | start booting Pyodide |
| worker → page | `{type:"boot", stage, pct}` | `stage` is human text e.g. `"Loading Pillow"` |
| worker → page | `{type:"ready"}` | accepting jobs |
| page → worker | `{type:"render", id, mdText, filename, overrides}` | render request |
| worker → page | `{type:"log", line}` | one line of Python stdout/stderr |
| worker → page | `{type:"progress", id, pages}` | pages rendered so far |
| worker → page | `{type:"done", id, bytes, filename, info}` | success |
| worker → page | `{type:"error", id, message, detail}` | failure + traceback |

Transfer the PDF as a **transferable** `ArrayBuffer` (second argument to
`postMessage`) rather than copying it.

Passing the progress callback into Python: hand `generate()` a plain JS function
as the `progress_cb` argument; Pyodide proxies it and it becomes callable from
Python. **Call `.destroy()` on the proxy when the job finishes** — proxies are
not garbage-collected across the JS/Python boundary, and leaking one per render
is the classic Pyodide memory bug.

---

## 6. Fonts

`FAMILIES` (`generate_notes_pdf.py:169-199`) points at `C:\Windows\Fonts\...`
and `/System/Library/...`. None of those exist in the browser, and without
replacements `FontSet` silently falls back to `ImageFont.load_default()` — a
tiny bitmap font that would ruin the output. Bundling real fonts is mandatory,
not optional.

**Do not commit Segoe Print, Comic Sans, Calibri, or Segoe UI.** Their Windows
and macOS licences permit local use, not redistribution. Shipping them in a
public repo would be infringement.

Use SIL Open Font License faces instead:

| Slot | Font | Why |
|---|---|---|
| `handwriting_r.ttf` | **Kalam Regular** | Genuine handwriting feel, generous x-height, stays legible at notes size. Has a real bold. |
| `handwriting_b.ttf` | **Kalam Bold** | |
| `print_r.ttf` | **Lato Regular** | Clean, and ships as true static TTFs. |
| `print_b.ttf` | **Lato Bold** | |

Alternatives if you dislike Kalam's look: **Caveat**, **Patrick Hand** (no bold —
you would have to point `b` at the regular), **Architects Daughter**.

Three hard requirements when sourcing the files:

1. **Static `.ttf` or `.otf` only.** Pillow's FreeType build **cannot read
   `.woff2`**, which is what the Google Fonts CSS API serves. Download the real
   TTFs from the `google/fonts` GitHub repo (`ofl/kalam/`, `ofl/lato/`) instead.
2. **Avoid variable fonts** where a static instance exists. Pillow loads a
   variable TTF at its default instance, so a `[wght]` variable file gives you
   no usable bold.
3. **Verify locally before committing**:
   `python -c "from PIL import ImageFont; ImageFont.truetype('fonts/handwriting_r.ttf', 32)"`.
   If that raises, the file is wrong.

Put the OFL text and per-font attribution in `docs/fonts/LICENSES.md`, and link
it from the page footer.

One behavioural note worth checking after the swap: `FontSet.has_glyph`
(`generate_notes_pdf.py:255`) probes each font for coverage and substitutes via
`GLYPH_FALLBACK`. Kalam and Lato have different coverage from Segoe Print, so
render `examples/Ch3_Atmosphere_Summary.md` both ways and eyeball the arrows,
bullets and degree signs.

---

## 7. The page itself

### Layout

A single centred column. Four states, only one visible at a time:

1. **Booting** — a progress bar driven by the `boot` messages, plus honest text:
   "Loading the Python engine (about 10 MB, one time — it's cached afterwards)."
   Disable the upload control until `ready` arrives.
2. **Idle** — the drop zone and options.
3. **Rendering** — spinner, elapsed timer, live page counter
   ("Page 14 rendered…"), and a collapsible log fed by `log` messages.
4. **Done** — result summary, a large **Download PDF** button, an inline
   preview, and a "Render another" reset.

### Upload control

- A drop zone that accepts drag-and-drop **and** click-to-browse, wired to a
  hidden `<input type="file" accept=".md,text/markdown">`.
- Read with `File.text()` (UTF-8).
- Reject non-`.md` files with an inline message rather than a browser alert.
- Add a **"Try an example"** button that fetches
  `examples/Ch3_Atmosphere_Summary.md` and renders it. This matters: without a
  sample file, a first-time visitor has nothing to do after a 10 MB download.

### Options

Mirror the CLI flags in `main()` (`generate_notes_pdf.py:2011-2040`). These map
straight onto the `overrides` dict that `build_pdf` merges over the parsed
settings:

| Control | Override key | Values | Default |
|---|---|---|---|
| Font style | `font_family` | `handwriting` / `print` | `handwriting` |
| Page size | `page_size` | `A4` / `LETTER` | `A4` |
| Ruled lines | `ruled_pages` | boolean | on |
| Cover page | `cover_page` | boolean | on |
| Contents page | `contents_page` | boolean | on |

Keep them collapsed under an "Options" disclosure so the default path is just
*drop file → get PDF*. Persist the chosen values in `localStorage`.

### Download

```js
const blob = new Blob([bytes], { type: "application/pdf" });
const url  = URL.createObjectURL(blob);
```

Point both the `<a download="...">` and the preview `<iframe src>` at that URL,
and `URL.revokeObjectURL(url)` when the user resets or renders again.

### Preview

An `<iframe>` with the object URL, roughly 70vh tall, using the browser's
built-in PDF viewer. If the browser refuses to display it, fall back to showing
just the download button — never leave a blank grey box.

---

## 8. Performance and expectation-setting

- **First load** pulls roughly 10 MB (Pyodide core + Pillow + fonts). Cached by
  the browser afterwards. The booting state must say this plainly.
- **Rendering** is 3-5× slower than desktop CPython. The 51 KB sample chapter
  will take on the order of tens of seconds and holds every page as a full-size
  bitmap in memory. This is exactly why it belongs in a worker.
- Boot Pyodide **eagerly on page load**, in parallel with the user reading the
  page and choosing a file. Do not wait for the upload to start booting.
- Keep the Pyodide instance **alive between renders**. A second render should
  skip the whole boot sequence.
- Add `<link rel="preconnect">` to the CDN origin in `<head>`.

---

## 9. Error handling

Handle each of these with a specific, plain-English message — no stack traces as
the primary text, no silent failures:

- Pyodide or Pillow fails to load (offline, CDN blocked, corporate proxy).
- A font file 404s → say which one, and that output quality will suffer.
- Markdown that parses to zero blocks → "This file has no `##` sections. Check
  it against `template.md`."
- Any Python exception during `build_pdf` → a one-line summary, with the full
  traceback behind a "Show details" toggle.
- The tab running out of memory on a very large chapter. Catch what you can and
  suggest splitting the file.

---

## 10. Out of scope

Do not add: a markdown editor, server-side rendering, user accounts, a service
worker / offline mode, or a JS framework. Plain HTML, CSS and ES modules only.

---

## 11. Definition of done

- [ ] `docs/` deploys on GitHub Pages and works from a hard-refreshed browser.
- [ ] Dropping `examples/Ch3_Atmosphere_Summary.md` produces a PDF visually
      equivalent to the CLI output, modulo the font substitution.
- [ ] Both `handwriting` and `print` families render with their bundled fonts —
      confirm `ImageFont.load_default()` is never reached.
- [ ] All five option controls visibly change the output.
- [ ] Root `generate_notes_pdf.py` is unchanged; `git diff` on it is empty.
- [ ] A second render in the same session skips the boot sequence.
- [ ] Works in current Chrome, Firefox and Safari.
- [ ] `README.md` gains a "Use it in your browser" section with the Pages link.
- [ ] Font licences are committed and linked from the page footer.
