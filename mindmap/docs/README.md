# OpenMind — developer documentation

A free, open mind-map editor. Pure HTML/CSS/JavaScript with **no build step**,
**no backend**, **no account** and **no AI** — the same shape as the rest of
this repository. It ships as a folder of files that GitHub Pages serves as they
are.

- Landing page: `mindmap/index.html`
- Editor: `mindmap/editor.html`
- Live: <https://www.superlearneracademy.in/mindmap/>

---

## Running it

There is nothing to install and nothing to compile. The editor uses native ES
modules (`<script type="module">`), so it must be **served over http**, not
opened with `file://` — browsers refuse module imports from the filesystem.

```bash
# from the repository root
python -m http.server 8000
# then open http://localhost:8000/mindmap/
```

Tests run with the repository's existing vitest setup:

```bash
npm test                                          # everything
npx vitest run tests/unit/mindmap-core.test.js    # one file
npx vitest run tests/properties/mindmap.property.test.js
```

---

## Module map

```
mindmap/
├── index.html            PAGE-01  landing: recent maps, templates, import
├── editor.html           PAGE-02  editor shell (static markup = no-JS fallback)
├── manifest.webmanifest  PWA manifest
├── sw.js                 service worker, scoped to /mindmap/ only
├── css/                  base.css (tokens + widgets), landing.css, editor.css
├── templates/            *.json — one file per template + index.json
├── icons/                PWA icons (generated, see "Assets")
└── src/
    ├── core/             MindMap, Topic, Relationship, Theme, Document
    ├── canvas/           SVGCanvas, Zoom (Viewport), Pan, Selection, DragDrop
    ├── layout/           LayoutEngine, MindMapLayout, TreeLayout,
    │                     OrganizationLayout, LogicLayout, metrics
    ├── history/          History, Undo, Redo
    ├── storage/          IndexedDB, AutoSave, RecentFiles
    ├── import/           index (dispatcher), JSON, Markdown, Text
    ├── export/           index (dispatcher), JSON, Markdown, SVG, PNG, PDF
    ├── ui/               Toolbar, Sidebar, PropertiesPanel, ContextMenu,
    │                     Dialogs, Shortcuts
    ├── templates/        template catalogue loader
    ├── util/             dom, id, measure, sanitize, format
    ├── app.js            the Editor class — the only place commands live
    ├── boot-editor.js    editor entry point
    ├── landing.js        landing page entry point
    └── pwa.js            service worker registration
```

### The one rule

**Nothing renders itself.** The pipeline is one-directional:

```
model change → editor.commit() → LayoutEngine.calculate() → SVGCanvas.render()
                                                          → panels render
```

The focused topic (the selection's primary) carries two handles drawn by
`SVGCanvas`: a **“+”** on the side its branch grows towards, which runs
`add-child`, and a **width grip** on its right edge. Neither is a drag handle
for the node itself — `DragDrop` skips them, as it does the collapse toggle —
and exports render with `primaryId: null`, so no handle ever reaches a PNG.

`Editor.run(command)` is the single entry point for every action; the toolbar,
the menus, the context menu, the mobile bar and the keyboard all call it. A new
button is one element with `data-command="…"` in `editor.html` — no JavaScript
change.

---

## Data model

A topic is a plain serialisable object, so the whole document is JSON:

```js
{ id, parentId, text, children, position, style,
  note, tags, links, icons, image, collapsed }
```

- **`children` is the order.** Reordering never touches the topic map.
- **`position` is a manual *nudge*, not a coordinate.** The auto layout always
  runs; the offset is added afterwards to the topic *and its whole subtree*, so
  a dragged branch keeps its shape and stays connected to its parent. "Reset
  position" clears it.
- **`style` is sparse.** A missing key means "inherit from the theme", which is
  why switching theme never discards a deliberate choice. `style.width` is one
  of those keys: absent, the box sizes itself to its text (wrapping at
  `MAX_TEXT_WIDTH`); present, it is the manual width the grip on the node's
  right edge — or the Width field in the Format panel — wrote. Double-clicking
  the grip clears it.
- Relationships (arrows between any two topics) and boundaries (an outline
  around a subtree) are document-level lists, because they cross the tree.

`MindMap.fromState()` is the trust boundary: it re-links orphans to the root,
rebuilds every `children` array from `parentId`, and breaks cycles. A corrupt
or hand-edited file therefore opens instead of hanging.

### Study views — focus, drill-down and levels

Three view states that exist for revision rather than authoring, and none of
them change the model:

- **Show level N** (`Alt+1…9`, `Alt+0`) sets `collapsed` on everything deeper
  than N. It *is* a model change (it is undoable), because collapse state is
  saved with the map.
- **Focus** (`F3`) marks everything outside the selected branch as dimmed. Pure
  view state on the Editor (`focusBranchId`), passed to the renderer as
  `dimmedIds`.
- **Drill-down** (`F4`, `Shift+F4` to go back up) lays the map out from a topic
  other than the real root, by passing `rootId` to `calculate()`. The model is
  untouched — only what the layout walks changes — and the status bar shows a
  "back up" button so the state is never invisible. An export taken while
  drilled exports that branch, which is how a one-page revision sheet for a
  single chapter is made.

### Outline numbering

`topic.numbering` (`''`, `number`, `letter`, `roman`) switches numbering on for
everything *beneath* that topic. `MindMap.numberPrefix(id)` computes "2.3" by
walking up to the nearest ancestor that switched it on, and `displayText()` in
`layout/metrics.js` is the only place it is joined to the text. **It is never
written into `topic.text`**, so Markdown round trips, search and the outline
all still see what the user typed.

### File format — `.openmind`

One versioned JSON object, mirroring the folder layout in the spec:

```json
{
  "formatVersion": "1.0",
  "meta":   { "id": "...", "title": "...", "createdAt": "...", "updatedAt": "..." },
  "view":   { "theme": "sla", "layout": "mindmap", "zoom": 1, "pan": { "x": 0, "y": 0 } },
  "map":    { "rootId": "...", "topics": {}, "relationships": [], "boundaries": [] },
  "assets": { "<id>": "data:image/png;base64,..." }
}
```

`migrate()` in `core/Document.js` is the single place a future version bump is
handled. A document from a newer **major** version is refused rather than
half-read.

---

## Layout engine

```js
import { calculate } from './layout/LayoutEngine.js';
const result = calculate(map, { layout: 'mindmap', theme: 'sla' });
// result = { nodes: Map<id, {x,y,width,height,side}>, metrics, bounds, theme, connector }
```

All five layouts come from one tidy-tree algorithm (`layout/TreeLayout.js`) with
the axis as a parameter:

| id        | description                                   |
| --------- | --------------------------------------------- |
| `mindmap` | root centred, main branches alternate sides   |
| `right`   | right tree                                    |
| `left`    | left tree                                     |
| `org`     | organisation chart (top-down)                 |
| `logic`   | logic chart (right tree, bracket connectors)  |

A parent's band on the cross axis is the **sum** of its children's bands, which
is what guarantees no two nodes overlap and makes a deep branch push its
neighbours aside. Collapsed branches are simply absent from the walk, so
collapsing is free.

`layout/metrics.js` exposes `textBox(text, style)` separately from
`measureNode`, and the inline editor uses it to size itself from what is in the
textarea *right now*. That is what keeps a topic from wrapping mid-word while
it is being typed inside a box that was measured for the previous text.

Text is measured once per render with an offscreen canvas 2d context
(`util/measure.js`), cached per font+string — measuring live SVG `<text>` nodes
would cost a reflow per node and blow the 1,000-node target.

---

## Invariants (property tests)

`tests/properties/mindmap.property.test.js` checks these with fast-check over
100 random trees each. **Keep this list and the test numbering in step.**

| # | Property |
| - | -------- |
| M1 | Laid-out nodes never overlap, in any layout |
| M2 | Positions exist for exactly the visible topics — collapsed subtrees get none |
| M3 | The tree stays acyclic through arbitrary moves, and loses no topics |
| M4 | Deleting removes exactly the topic and its descendants |
| M5 | A Markdown export → import round trip preserves the tree |
| M6 | Undo after one committed change restores the previous state exactly |
| M7 | Search matches a topic iff the needle is in its text, note or tags |
| M8 | `toState` → `fromState` is lossless |

(The numbered properties in `.kiro/specs/sla-webinar-landing-page/design.md` are
the landing page's and are unrelated to these.)

---

## Import / export

Import sniffs the extension first and the content second
(`import/index.js`). Markdown headings become branches, bullets nest by indent,
blockquotes become notes and bare links become links.

Export goes through `export/index.js`: `.openmind` and JSON are text, SVG is the
map rendered again at 1:1 into a detached `<svg>` (so the export carries no
selection rings or viewport transform), PNG rasterises that SVG through a
canvas, and PDF places the PNG with **jsPDF loaded on demand from cdnjs** —
nothing else on the page pays for it.

Markdown export escapes the characters Markdown would read as formatting, and
the importer un-escapes them, so a topic literally called `*star*` survives the
round trip. Property M5 exists because it did not, at first.

---

## Storage

IndexedDB (`openmind` database: `maps`, `templates`, `prefs`), with a
**localStorage fallback** for private windows and blocked storage. Autosave
debounces 700 ms after the last edit and flushes on `pagehide` and
`visibilitychange`, so closing the tab cannot lose the last keystroke.

Everything is device-local. There is no server, so "delete site data" really
does delete the maps — the UI says so in both the footer and the delete dialog.

---

## Security

- No `eval`, no `new Function`, no `innerHTML` for content. Every node is built
  through `util/dom.js`.
- Every imported string passes `util/sanitize.js`: URLs are limited to
  http/https/mailto/tel, images to `https` or `data:image/*`, colours to
  colour-shaped strings, numbers clamped.
- Raw SVG/HTML import is refused outright; imports are text plus `JSON.parse`.
- Imported documents are rebuilt by `MindMap.fromState()`, never trusted as-is.
- Links render with `rel="noopener noreferrer nofollow"`.

The site-wide content-protection layer in `script.js`/`quiz.js` (blocking
right-click, F12, Ctrl+C) is **deliberately not installed here** — it would
break this app's own copy/paste, context menu and typing.

---

## PWA

`manifest.webmanifest` plus `sw.js`, registered with scope `./` so the worker
can never intercept anything outside `/mindmap/`. The app shell is cache-first
(refreshed in the background); everything else same-origin is network-first.

**There is no build step to hash filenames**, so bump `CACHE_VERSION` in
`sw.js` whenever a shell file changes, or returning visitors keep the old copy.

---

## Assets

`icons/*.png` are generated, not hand-drawn — see the Pillow snippet in the
project's `CLAUDE.md` (same approach as `scripts/generate_mandala.py`). Keep
them small; there is no image pipeline.

---

## Deliberately out of scope (MVP)

No login, accounts, cloud sync, real-time collaboration, backend, payments, AI,
chat, social features or Pyodide. Pyodide in particular has no business in a
mind-map engine — it would add megabytes of WebAssembly for nothing.

## Known limits

- Remote (`http`) images inside a map taint the canvas, so PNG/PDF export of a
  map containing one will fail with a message. Uploaded images (stored as data
  URIs) are fine.
- Very large maps (5,000+ topics) lay out fine but re-render the whole node
  layer on each change; virtualisation is the next optimisation if it is ever
  needed.
- The editor needs JavaScript. `editor.html` says so in a `<noscript>` block.
