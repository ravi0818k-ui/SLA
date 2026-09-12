#!/usr/bin/env python3
"""
Board-exam notes PDF generator.

Turns a Markdown notes file into a hand-made-looking, ruled, highlighted
notebook PDF. Two kinds of notes are supported (both use the same syntax
and the same renderer):

    ChNN_Topic_Summary.md    section-wise chapter summary  (## SECTION blocks)
    ChNN_Topic_Questions.md  question / answer cards       (## TOPIC blocks)

The notes file itself is written by an AI from your chapter PDF plus
template.md, the template specification. See README.md.

Before the first run
--------------------
    Install Python 3.9+ and Pillow, then check the computer is ready:

        python -m pip install pillow
        python generate_notes_pdf.py --check

    Step-by-step instructions for Windows, Mac and Linux, including fonts,
    are in INSTALL_FIRST.txt

Usage
-----
    python generate_notes_pdf.py ChNN_Topic_Summary.md
    python generate_notes_pdf.py ChNN_Topic_Summary.md Chapter_Summary.pdf
    python generate_notes_pdf.py ChNN_Topic_Summary.md --font print --no-ruled
    python generate_notes_pdf.py --check

Template syntax
---------------
    # Chapter title
    > subtitle line

    ## SETTINGS                     - key: value pairs
    ## BIGQ                         - the chapter's big questions
    ## MINDMAP  / ### name          - "- Branch: detail" lines
    ## SECTION  / ### 1. Heading    - "**Label:** text" fields (+ "- " lists)
    ## TOPIC    / ### 1. Heading    - Q&A revision card
    ## TABLE    / ### name          - a markdown pipe table
    ## FLOW     / ### name          - "- step" lines drawn as an arrow chain
    ## COMPARE  / ### name          - "- aspect | left | right" rows
    ## FACTFILE / ### name          - "- fact" lines drawn as sticky notes
    ## QUICK REVISION               - "- point" lines
    ## EXAM QUESTIONS               - "- question | 3 marks" lines

A field label must contain a colon - "**Key to remember:** ..." or
"**Key to remember**: ..." - so a line that merely starts in bold stays a
paragraph. Field labels are matched by meaning, so "Key to remember",
"In simple words", "Exam tip", "Trick", "Watch out", "Key points" and
"Concept related to" each get their own box style; anything else is drawn
as a labelled paragraph, which means new labels need no code change.

Inline highlighter markup (works in every text field, and nests):
    **bold ink**    ==yellow highlight==    ++green highlight++
    !!pink highlight!!    __pen underline__    *italics* -> underline
    e.g. ==the ozone layer sits in the **stratosphere**==

Requirements
------------
    Python 3.9 or newer, and Pillow:   python -m pip install pillow
"""

import sys
import re
import os
import math
import platform
import unicodedata
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.stderr.write(
        "\n"
        "  This kit needs one free library called Pillow, and it is not\n"
        "  installed on this computer yet.\n"
        "\n"
        "  Install it by running:\n"
        "\n"
        "      python -m pip install pillow\n"
        "\n"
        "  On Windows, if that says 'python' is not recognized, try:\n"
        "\n"
        "      py -m pip install pillow\n"
        "\n"
        "  Then run your command again. Full instructions are in\n"
        "  INSTALL_FIRST.txt\n"
        "\n")
    raise SystemExit(1)


# ============================================================
# 1. PALETTE
# ============================================================

C = {
    "paper":      "#FFFDF6",
    "paper_alt":  "#FBF7EC",
    "rule":       "#D9E8F3",
    "margin":     "#E7A5A5",
    "hole":       "#EFEAE0",

    "ink":        "#232B36",
    "ink_soft":   "#4E5A68",
    "ink_faint":  "#7C8794",

    "pen":        "#123F63",   # blue ballpoint, body headings
    "pen_head":   "#0B5A82",   # section headings
    "pen_red":    "#AE2B22",   # teacher's red pen
    "pen_green":  "#1F6E3C",

    "hl_yellow":  "#FFEE86",
    "hl_green":   "#B9F0C8",
    "hl_pink":    "#FFC8DD",
    "hl_blue":    "#C4E4FF",

    "box_key":    "#FFF6C2",
    "box_key_br": "#C9A400",
    "box_key_tx": "#6B4E00",

    "box_simple": "#EAF8EE",
    "box_simple_br": "#63A97C",

    "box_exam":   "#E7F2FB",
    "box_exam_br": "#5D93B0",

    "box_trick":  "#FDEAF3",
    "box_trick_br": "#C46E96",

    "box_warn":   "#FDECE6",
    "box_warn_br": "#C86B4A",

    "box_soft":   "#F7FAFC",
    "box_soft_br": "#BACDDA",

    "sticky":     "#FFF3B0",
    "sticky_br":  "#D9B93C",

    "shadow":     "#E7E1D4",
    "line_soft":  "#BDCDD9",
}

# branch colours for mind maps / flows, cycled
BRANCH = [
    ("#E4F1FB", "#3C7FA6"),
    ("#FFF2CF", "#B58A19"),
    ("#E8F6EA", "#4E9163"),
    ("#FDE7EF", "#B4557F"),
    ("#EFEAFB", "#6C5CA8"),
    ("#FDEEE3", "#B87340"),
    ("#E6F5F5", "#3E8E8E"),
    ("#F3F0E4", "#8A8248"),
]

HIGHLIGHT_FILL = {
    "hl": C["hl_yellow"],
    "hg": C["hl_green"],
    "hp": C["hl_pink"],
}


# ============================================================
# 2. FONTS
# ============================================================

FAMILIES = {
    "handwriting": {
        "r": [
            r"C:\Windows\Fonts\segoepr.ttf",
            r"C:\Windows\Fonts\comic.ttf",
            r"C:\Windows\Fonts\Inkfree.ttf",
            "/System/Library/Fonts/Supplemental/Comic Sans MS.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ],
        "b": [
            r"C:\Windows\Fonts\segoeprb.ttf",
            r"C:\Windows\Fonts\comicbd.ttf",
            "/System/Library/Fonts/Supplemental/Comic Sans MS Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ],
    },
    "print": {
        "r": [
            r"C:\Windows\Fonts\calibri.ttf",
            r"C:\Windows\Fonts\segoeui.ttf",
            "/Library/Fonts/Arial.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ],
        "b": [
            r"C:\Windows\Fonts\calibrib.ttf",
            r"C:\Windows\Fonts\segoeuib.ttf",
            "/Library/Fonts/Arial Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ],
    },
}

# characters many handwriting fonts lack -> safe stand-ins
GLYPH_FALLBACK = {
    "\u2192": "->", "\u21d2": "=>", "\u2190": "<-", "\u2194": "<->",
    "\u2605": "*", "\u2606": "*", "\u2b50": "*",
    "\u2713": "+", "\u2714": "+", "\u2717": "x", "\u2718": "x",
    "\u26a0": "!", "\u203c": "!!",
    "\u2022": "-", "\u25aa": "-", "\u25cf": "-", "\u00c6": "-",
    "\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"',
    "\u2014": "-", "\u2013": "-", "\u2026": "...",
    "\u00b0": " deg", "\u00d7": "x", "\u2264": "<=", "\u2265": ">=",
    "\u2153": "1/3", "\u00bd": "1/2", "\u00bc": "1/4", "\u00be": "3/4",
    "\u00a0": " ",
}


class FontSet:
    """Font cache + per-font glyph coverage detection."""

    def __init__(self, family):
        fam = FAMILIES.get(family, FAMILIES["handwriting"])
        self.paths = {}
        for style, candidates in fam.items():
            self.paths[style] = next(
                (p for p in candidates if os.path.exists(p)), None
            )
        if not self.paths.get("r"):
            self.paths["r"] = self.paths.get("b")
        if not self.paths.get("b"):
            self.paths["b"] = self.paths.get("r")

        self._cache = {}
        self._glyphs = {}
        self._notdef = None
        self._probe = ImageDraw.Draw(Image.new("L", (90, 90), 0))
        self._probe_font = self.get("r", 34)
        if self.paths["r"]:
            self._notdef = self._render_probe("\ue001")

    def get(self, style, size):
        key = (style, int(size))
        if key not in self._cache:
            path = self.paths.get(style) or self.paths.get("r")
            if path:
                self._cache[key] = ImageFont.truetype(path, int(size))
            else:
                self._cache[key] = ImageFont.load_default()
        return self._cache[key]

    def _render_probe(self, ch):
        im = Image.new("L", (90, 90), 0)
        ImageDraw.Draw(im).text((6, 6), ch, font=self._probe_font, fill=255)
        return im.tobytes()

    def has_glyph(self, ch):
        if self._notdef is None:
            return True
        if ch not in self._glyphs:
            try:
                self._glyphs[ch] = self._render_probe(ch) != self._notdef
            except Exception:
                self._glyphs[ch] = False
        return self._glyphs[ch]

    def sanitize(self, text):
        """Replace characters the chosen font cannot draw.

        Handwriting fonts carry no glyphs for Indic transliteration marks
        (Kauṭilya, nakṣhatra ...), so those letters are folded down to their
        base letter instead of disappearing from the page.
        """
        out = []
        for ch in text:
            if ch in "\n\t " or self.has_glyph(ch):
                out.append(ch)
                continue
            folded = "".join(
                c for c in unicodedata.normalize("NFKD", ch)
                if not unicodedata.combining(c)
            )
            if folded and folded != ch and all(self.has_glyph(c) for c in folded):
                out.append(folded)
            else:
                out.append(GLYPH_FALLBACK.get(ch, ""))
        return "".join(out)


_MEASURE = ImageDraw.Draw(Image.new("RGB", (8, 8)))


def tw(text, font):
    return _MEASURE.textlength(text, font=font)


def line_text(line):
    return "".join(item[2] for item in line)


def ink_bottom(line, font, fallback):
    """How far below the draw origin a line's glyphs actually reach.

    Handwriting fonts sit low in their em box, so highlighter strokes and
    underlines are placed from the real glyph bottom, not from the font size.
    """
    text = line_text(line).strip()
    if not text:
        return fallback
    try:
        return font.getbbox(text)[3] + 2
    except Exception:
        return fallback


# ============================================================
# 3. MARKDOWN PARSING
# ============================================================

BLOCK_ALIASES = {
    "SETTINGS": "settings",
    "BIGQ": "bigq",
    "BIG QUESTIONS": "bigq",
    "MINDMAP": "mindmap",
    "MIND MAP": "mindmap",
    "SECTION": "section",
    "TOPIC": "topic",
    "TABLE": "table",
    "FLOW": "flow",
    "FLOWCHART": "flow",
    "COMPARE": "compare",
    "FACTFILE": "factfile",
    "FACT FILE": "factfile",
    "QUICK REVISION": "revision",
    "REVISION": "revision",
    "EXAM QUESTIONS": "examq",
    "EXAM": "examq",
}

ESCAPES = [
    (r"\\-\\>", "->"), (r"-\\>", "->"), (r"\\>", ">"), (r"<\\-", "<-"),
    (r"\\\*", "*"), (r"\\_", "_"), (r"\\\[", "["), (r"\\\]", "]"),
    (r"\\#", "#"), (r"\\\|", "|"), (r"\\&", "&"), (r"\\\$", "$"),
    (r"\\~", "~"), (r"\\\.", "."), (r"\\\(", "("), (r"\\\)", ")"),
]

# A field label must carry a colon - "**Key to remember:** ..." or
# "**Key to remember**: ..." - so a paragraph that merely *starts* with bold
# text ("**Gravity** is the force of attraction ...") stays a paragraph.
FIELD_RE = re.compile(r"^\*\*([^*\n]{1,48}?)\s*:\s*\*\*\s*(.*)$")
FIELD_RE_ALT = re.compile(r"^\*\*([^*\n]{1,48}?)\s*\*\*\s*:\s*(.*)$")
LIST_FIELD_RE = re.compile(r"^[-*+]\s*\*\*([^*\n]{1,48}?)\s*:\s*\*\*\s*(.*)$")
LIST_FIELD_RE_ALT = re.compile(r"^[-*+]\s*\*\*([^*\n]{1,48}?)\s*\*\*\s*:\s*(.*)$")


def unescape(text):
    for pat, rep in ESCAPES:
        text = re.sub(pat, rep, text)
    text = text.replace("`", "")
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)   # links -> label
    text = re.sub(r"-{2,}", "—", text)
    # single *italics* become pen underlines, the way students mark titles
    text = re.sub(r"(?<!\*)\*([^*\n]+)\*(?!\*)", r"__\1__", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def plain(text):
    """Strip every inline marker - for measuring headings, TOC, etc."""
    text = unescape(text)
    for m in ("**", "==", "++", "!!", "__"):
        text = text.replace(m, "")
    return text.strip()


def norm_label(label):
    key = plain(label).lower().replace("-", " ").replace("_", " ")
    key = re.sub(r"[^a-z ]", "", key)
    return re.sub(r"\s+", " ", key).strip()


def strip_number(title):
    """'3. Monsoon' -> 'Monsoon'; the renderer draws the number badge."""
    return re.sub(r"^\s*\(?\d+[.)]?\s*", "", title).strip() or title.strip()


class Block(dict):
    """A parsed template block."""

    def __init__(self, kind):
        super().__init__(
            kind=kind, title="", fields=[], items=[], rows=[], text=""
        )

    def field(self, *names):
        for name in names:
            for label, value in self["fields"]:
                if norm_label(label) == name:
                    return value
        return None


def parse_markdown(path):
    lines = Path(path).read_text(encoding="utf-8").splitlines()

    settings = {
        "output": "Board_Exam_Notes.pdf",
        "page_size": "A4",
        "handwriting": True,
        "highlight_keys": True,
        "ruled_pages": True,
        "contents_page": True,
        "cover_page": True,
    }

    doc = {"title": "Board Exam Notes", "subtitle": "", "blocks": []}

    block = None            # current Block
    field = None            # current [label, {"text":..,"items":[..]}]
    mode = None             # "settings" or "block"

    def push(kind):
        nonlocal block, field
        block = Block(kind)
        field = None
        doc["blocks"].append(block)
        return block

    for raw in lines:
        line = raw.rstrip()
        stripped = line.strip()

        if not stripped or set(stripped) <= set("-*_") and len(stripped) >= 3:
            field = None                      # blank line / horizontal rule
            continue

        # ---- chapter title / subtitle -------------------------------
        if stripped.startswith("# ") and not stripped.startswith("##"):
            doc["title"] = plain(stripped[2:])
            continue

        if stripped.startswith(">"):
            value = plain(stripped.lstrip("> "))
            if value:
                doc["subtitle"] = (
                    value if not doc["subtitle"]
                    else doc["subtitle"] + "  |  " + value
                )
            continue

        # ---- block headers ------------------------------------------
        if stripped.startswith("## "):
            name = plain(stripped[3:]).upper()
            kind = BLOCK_ALIASES.get(name)
            if kind == "settings":
                mode, block, field = "settings", None, None
                continue
            mode = "block"
            push(kind or "section")
            if not kind:                       # unknown header -> heading text
                block["title"] = plain(stripped[3:])
            continue

        # ---- settings -----------------------------------------------
        if mode == "settings":
            m = re.match(r"[-*]?\s*([A-Za-z_ ]+?)\s*:\s*(.*)", stripped)
            if m:
                key, value = m.group(1).strip(), m.group(2).strip()
                key = re.sub(r"\s+", "_", key.lower())
                if value.lower() in ("true", "yes", "on"):
                    settings[key] = True
                elif value.lower() in ("false", "no", "off"):
                    settings[key] = False
                else:
                    settings[key] = value
            continue

        if block is None:
            push("section")

        # ---- block title --------------------------------------------
        if stripped.startswith("### "):
            block["title"] = unescape(stripped[4:])
            field = None
            continue

        # ---- pipe table row -----------------------------------------
        if stripped.startswith("|") and stripped.count("|") >= 2:
            raw_cells = stripped.strip("|").split("|")
            # test for the header separator BEFORE unescaping, because
            # unescape() turns "---" into an em dash
            if all(re.fullmatch(r":?-{2,}:?", c.strip().replace(" ", ""))
                   or not c.strip() for c in raw_cells):
                continue
            block["rows"].append([unescape(c) for c in raw_cells])
            continue

        # ---- "**Label:** value" field -------------------------------
        m = FIELD_RE.match(stripped) or FIELD_RE_ALT.match(stripped)
        if m is None and field is None:
            # "- **Label:** value" is a field only at block level; inside a
            # field it is just a bolded bullet point
            m = (LIST_FIELD_RE.match(stripped)
                 or LIST_FIELD_RE_ALT.match(stripped))
        if m:
            label = m.group(1).strip().rstrip(":")
            value = {"text": unescape(m.group(2)), "items": []}
            field = [label, value]
            block["fields"].append(field)
            continue

        # ---- list item ----------------------------------------------
        if re.match(r"^[-*+]\s+", stripped) or re.match(r"^\d+[.)]\s+", stripped):
            item = unescape(re.sub(r"^([-*+]|\d+[.)])\s+", "", stripped))
            if field is not None:
                field[1]["items"].append(item)
            else:
                block["items"].append(item)
            continue

        # ---- plain / continuation text -------------------------------
        text = unescape(stripped)
        if field is not None:
            if field[1]["items"]:
                field[1]["items"][-1] += " " + text
            else:
                field[1]["text"] = (field[1]["text"] + " " + text).strip()
        elif block["items"]:
            block["items"][-1] += " " + text
        else:
            block["text"] = (block["text"] + " " + text).strip()

    # drop empty blocks
    doc["blocks"] = [
        b for b in doc["blocks"]
        if b["title"] or b["fields"] or b["items"] or b["rows"] or b["text"]
    ]
    doc["settings"] = settings
    return doc


# ============================================================
# 4. INLINE RICH TEXT
# ============================================================

SPAN_RE = re.compile(r"(\*\*.+?\*\*|==.+?==|\+\+.+?\+\+|!!.+?!!|__.+?__)", re.S)
MARKERS = {"**": "b", "==": "hl", "++": "hg", "!!": "hp", "__": "u"}

PLAIN = frozenset()
BOLD = frozenset({"b"})


def parse_spans(text, base=PLAIN):
    """Split marked-up text into (text, style-flags) runs.

    Styles nest and combine, so '==key **fact**==' is highlighted *and*
    bold, and '==Kauṭilya's *Arthaśhāstra*==' keeps its underline.
    """
    if isinstance(base, str):                       # tolerate "n" / "b"
        base = BOLD if base == "b" else PLAIN
    spans = []
    for part in SPAN_RE.split(text or ""):
        if not part:
            continue
        mark = part[:2]
        flag = MARKERS.get(mark)
        if flag and len(part) > 4 and part.endswith(mark):
            for inner, style in parse_spans(part[2:-2], base):
                spans.append((inner, style | {flag}))
        else:
            spans.append((part, base))
    return spans or [("", base)]


def is_bold(style):
    return bool(style & {"b", "hl", "hg", "hp"})


def highlight_of(style):
    for flag in ("hl", "hg", "hp"):
        if flag in style:
            return HIGHLIGHT_FILL[flag]
    return None


class RichText:
    """Wraps marked-up text into drawable lines."""

    def __init__(self, fs, size, base=PLAIN):
        self.fs = fs
        self.size = size
        self.base = BOLD if base == "b" else (
            PLAIN if isinstance(base, str) else base)

    def _font(self, style):
        return self.fs.get("b" if is_bold(style) else "r", self.size)

    def wrap(self, text, max_width):
        spans = parse_spans(text, self.base)
        lines, cur, x = [], [], 0.0

        def flush():
            nonlocal cur, x
            while cur and cur[-1][2].isspace():
                x -= cur[-1][1]
                cur.pop()
            if cur:
                lines.append(cur)
            cur, x = [], 0.0

        for raw, style in spans:
            token = self.fs.sanitize(raw)
            font = self._font(style)
            for word in re.split(r"(\s+)", token):
                if not word:
                    continue
                if word.isspace():
                    if cur:
                        w = tw(" ", font)
                        cur.append([x, w, " ", style])
                        x += w
                    continue
                w = tw(word, font)
                if w > max_width:                      # hard-break long word
                    piece = ""
                    for ch in word:
                        if tw(piece + ch, font) > max_width - x and piece:
                            pw = tw(piece, font)
                            cur.append([x, pw, piece, style])
                            flush()
                            piece = ch
                        else:
                            piece += ch
                    if piece:
                        pw = tw(piece, font)
                        cur.append([x, pw, piece, style])
                        x += pw
                    continue
                if x + w > max_width and cur:
                    flush()
                    x = 0.0
                cur.append([x, w, word, style])
                x += w
        flush()
        return lines or [[]]

    def line_height(self, extra=7):
        return int(self.size + extra)

    def height(self, text, max_width, extra=7):
        return len(self.wrap(text, max_width)) * self.line_height(extra)

    def draw_line(self, d, x0, y, line, color, lh):
        # highlighter strokes first, merging neighbouring words of one span
        i = 0
        while i < len(line):
            fill = highlight_of(line[i][3])
            if fill:
                j = i
                while j < len(line) and highlight_of(line[j][3]) == fill:
                    j += 1
                x1 = x0 + line[i][0] - 5
                x2 = x0 + line[j - 1][0] + line[j - 1][1] + 5
                marker_stroke(d, x1, y - 1, x2, y + lh - 5, fill)
                i = j
            else:
                i += 1

        for x, w, word, style in line:
            ink = color
            if "b" in style and not highlight_of(style):
                ink = C["pen"] if color == C["ink"] else color
            d.text((x0 + x, y), word, font=self._font(style), fill=ink)
            if "u" in style:
                yy = y + int(self.size * 1.30)
                d.line((x0 + x, yy, x0 + x + w, yy), fill=C["pen_red"], width=2)


def marker_stroke(d, x0, y0, x1, y1, fill):
    """A highlighter swipe: soft body with ragged marker ends."""
    if x1 <= x0:
        return
    d.rounded_rectangle((x0, y0, x1, y1), radius=4, fill=fill)
    d.polygon([(x0, y0), (x0 - 5, (y0 + y1) / 2), (x0, y1)], fill=fill)
    d.polygon([(x1, y0), (x1 + 5, (y0 + y1) / 2), (x1, y1)], fill=fill)


# ============================================================
# 5. NOTEBOOK PAGES
# ============================================================

PAGE_SIZES = {"A4": (1240, 1754), "LETTER": (1275, 1650)}


class Book:
    """Paginated notebook canvas with a flowing y cursor."""

    def __init__(self, doc, fs, first_header=True):
        s = doc["settings"]
        self.W, self.H = PAGE_SIZES.get(
            str(s.get("page_size", "A4")).upper(), PAGE_SIZES["A4"]
        )
        self.ruled = bool(s.get("ruled_pages", True))
        self.fs = fs
        self.title = doc["title"]
        self.margin_x = 118
        self.rule_x = 84
        self.right = self.W - 68
        self.top = 132
        self.bottom = self.H - 92
        self.pages = []
        self.im = None
        self.d = None
        self.y = self.top
        self.new_page(header=first_header)

    # -- geometry ------------------------------------------------------
    @property
    def width(self):
        return self.right - self.margin_x

    def avail(self):
        return self.bottom - self.y

    # -- pages ---------------------------------------------------------
    def new_page(self, header=True):
        im = Image.new("RGB", (self.W, self.H), C["paper"])
        d = ImageDraw.Draw(im)

        if self.ruled:
            for y in range(self.top - 24, self.bottom + 30, 38):
                d.line((self.rule_x + 6, y, self.W - 30, y),
                       fill=C["rule"], width=1)

        d.line((self.rule_x, 0, self.rule_x, self.H), fill=C["margin"], width=2)
        d.line((self.rule_x + 5, 0, self.rule_x + 5, self.H),
               fill=C["margin"], width=1)

        for hy in (int(self.H * 0.22), int(self.H * 0.5), int(self.H * 0.78)):
            d.ellipse((26, hy - 17, 60, hy + 17),
                      fill=C["hole"], outline=C["line_soft"], width=1)

        self.im, self.d, self.y = im, d, self.top
        self.pages.append(im)

        if header:
            f = self.fs.get("r", 20)
            d.text((self.margin_x, 62), self.fs.sanitize(self.title),
                   font=f, fill=C["ink_faint"])
            d.line((self.margin_x, 96, self.right, 96),
                   fill=C["line_soft"], width=2)
            d.line((self.margin_x, 101, self.right, 101),
                   fill=C["rule"], width=1)
        return im

    def ensure(self, height, header=True):
        """Break the page if `height` will not fit."""
        if self.y + height > self.bottom:
            self.new_page(header)
            return True
        return False

    def space(self, height):
        self.y = min(self.y + height, self.bottom + 1)

    def fresh(self):
        """Start a page unless the current one is still untouched."""
        if self.y > self.top + 4:
            self.new_page()

    # -- drawing primitives --------------------------------------------
    def shadowed_box(self, x0, y0, x1, y1, fill, border, radius=16, width=2):
        self.d.rounded_rectangle((x0 + 4, y0 + 5, x1 + 4, y1 + 5),
                                 radius=radius, fill=C["shadow"])
        self.d.rounded_rectangle((x0, y0, x1, y1), radius=radius,
                                 fill=fill, outline=border, width=width)

    def paragraph(self, text, size=25, color=None, indent=0, extra=8,
                  base="n", gap=6):
        """Flowing rich text; breaks across pages line by line."""
        color = color or C["ink"]
        rt = RichText(self.fs, size, base)
        lh = rt.line_height(extra)
        x0 = self.margin_x + indent
        for line in rt.wrap(text, self.right - x0):
            self.ensure(lh)
            rt.draw_line(self.d, x0, self.y, line, color, lh)
            self.y += lh
        self.space(gap)

    def bullets(self, items, size=24, icon="check", indent=18, color=None,
                gap=8):
        color = color or C["ink"]
        rt = RichText(self.fs, size)
        lh = rt.line_height(8)
        x0 = self.margin_x + indent + 34
        for item in items:
            lines = rt.wrap(item, self.right - x0)
            self.ensure(min(len(lines), 2) * lh)
            first = True
            for line in lines:
                self.ensure(lh)
                if first:
                    cy = self.y + lh / 2 - 2
                    if icon == "check":
                        icon_check(self.d, self.margin_x + indent + 4, cy,
                                   10, C["pen_green"])
                    elif icon == "star":
                        icon_star(self.d, self.margin_x + indent + 12, cy,
                                  11, C["hl_yellow"], C["box_key_br"])
                    elif icon == "arrow":
                        icon_arrow(self.d, self.margin_x + indent + 2, cy,
                                   22, C["pen"])
                    else:
                        self.d.ellipse(
                            (self.margin_x + indent + 8, cy - 5,
                             self.margin_x + indent + 18, cy + 5),
                            fill=C["pen"])
                    first = False
                rt.draw_line(self.d, x0, self.y, line, color, lh)
                self.y += lh
            self.space(gap)

    def boxed_text(self, text, items, fill, border, label=None,
                   label_color=None, size=24, icon=None, radius=16,
                   text_color=None, pad=16):
        """A callout box that survives page breaks by splitting itself."""
        text_color = text_color or C["ink"]
        label_color = label_color or border
        rt = RichText(self.fs, size)
        lh = rt.line_height(8)
        inner = self.right - self.margin_x - 2 * pad - (34 if icon else 0)

        lines = []
        if text:
            lines += rt.wrap(text, inner)
        for item in items or []:
            lines += rt.wrap("• " + item, inner)

        head = 0
        if label:
            head = 40
        i, first = 0, True
        while i < len(lines):
            room = self.avail() - (head if first else 0) - 2 * pad - 14
            cap = int(room // lh)
            if cap < min(2, len(lines) - i):
                self.new_page()
                continue
            take = lines[i:i + cap]
            h = len(take) * lh + 2 * pad + (head if first else 0)
            y0 = self.y
            self.shadowed_box(self.margin_x - 8, y0, self.right, y0 + h,
                              fill, border, radius)
            ty = y0 + pad
            if first and label:
                lx = self.margin_x + 6
                if icon == "star":
                    icon_star(self.d, lx + 12, ty + 12, 14,
                              C["hl_yellow"], border)
                    lx += 34
                elif icon == "bulb":
                    icon_bulb(self.d, lx + 12, ty + 12, 14, border)
                    lx += 34
                elif icon == "warn":
                    icon_warn(self.d, lx + 12, ty + 12, 15, border)
                    lx += 34
                elif icon == "pin":
                    icon_pin(self.d, lx + 12, ty + 12, 12, border)
                    lx += 34
                self.d.text((lx, ty), self.fs.sanitize(label.upper()),
                            font=self.fs.get("b", 23), fill=label_color)
                ty += head
            x_text = self.margin_x + pad + (34 if (icon and label) else 0)
            for line in take:
                rt.draw_line(self.d, x_text, ty, line, text_color, lh)
                ty += lh
            self.y = y0 + h + 14
            i += cap
            first = False


# ============================================================
# 6. VECTOR ICONS (no emoji fonts needed)
# ============================================================

def icon_star(d, cx, cy, r, fill, outline):
    pts = []
    for i in range(10):
        ang = -math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.46
        pts.append((cx + rr * math.cos(ang), cy + rr * math.sin(ang)))
    d.polygon(pts, fill=fill, outline=outline)


def icon_check(d, x, cy, r, color):
    d.line((x, cy, x + r * 0.55, cy + r * 0.6), fill=color, width=4)
    d.line((x + r * 0.55, cy + r * 0.6, x + r * 1.5, cy - r * 0.8),
           fill=color, width=4)


def icon_arrow(d, x, cy, w, color):
    d.line((x, cy, x + w - 7, cy), fill=color, width=3)
    d.polygon([(x + w - 9, cy - 6), (x + w, cy), (x + w - 9, cy + 6)],
              fill=color)


def icon_bulb(d, cx, cy, r, color):
    d.ellipse((cx - r, cy - r - 2, cx + r, cy + r - 2),
              fill=C["hl_yellow"], outline=color, width=2)
    d.rectangle((cx - r * 0.4, cy + r - 3, cx + r * 0.4, cy + r + 3),
                fill=color)
    for a in (-0.9, 0.0, 0.9):
        d.line((cx + (r + 4) * math.cos(a - math.pi / 2 - 1.6),
                cy + (r + 4) * math.sin(a - math.pi / 2),
                cx + (r + 9) * math.cos(a - math.pi / 2 - 1.6),
                cy + (r + 9) * math.sin(a - math.pi / 2)),
               fill=color, width=2)


def icon_warn(d, cx, cy, r, color):
    d.polygon([(cx, cy - r), (cx + r, cy + r * 0.8), (cx - r, cy + r * 0.8)],
              fill=C["hl_yellow"], outline=color)
    d.line((cx, cy - r * 0.35, cx, cy + r * 0.25), fill=color, width=3)
    d.ellipse((cx - 2, cy + r * 0.42, cx + 2, cy + r * 0.62), fill=color)


def icon_pin(d, cx, cy, r, color):
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=C["hl_pink"],
              outline=color, width=2)
    d.line((cx, cy + r, cx, cy + r + 8), fill=color, width=3)


def icon_brain(d, cx, cy, r, color):
    """A small node-and-branch glyph, used to mark mind-map pages."""
    d.ellipse((cx - r * 0.42, cy - r * 0.42, cx + r * 0.42, cy + r * 0.42),
              fill=C["hl_yellow"], outline=color, width=2)
    for ang in (-2.4, -0.7, 0.7, 2.4):
        x1 = cx + r * 0.42 * math.cos(ang)
        y1 = cy + r * 0.42 * math.sin(ang)
        x2 = cx + r * math.cos(ang)
        y2 = cy + r * math.sin(ang)
        d.line((x1, y1, x2, y2), fill=color, width=2)
        d.ellipse((x2 - r * 0.22, y2 - r * 0.22, x2 + r * 0.22,
                   y2 + r * 0.22), fill=C["hl_blue"], outline=color, width=2)


def curve(d, p0, p1, p2, color, width=3, steps=26):
    """Quadratic bezier, for mind-map branches."""
    prev = p0
    for i in range(1, steps + 1):
        t = i / steps
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
        d.line((prev[0], prev[1], x, y), fill=color, width=width)
        prev = (x, y)


def tape(d, x0, y0, x1, y1):
    """Washi-tape strip decoration."""
    d.polygon([(x0, y0 + 4), (x1, y0), (x1, y1), (x0, y1 - 4)],
              fill=C["hl_blue"])


# ============================================================
# 7. HEADINGS, CHIPS, TABLES
# ============================================================

def section_heading(book, number, text, color=None, size=33, tag=None):
    color = color or C["pen_head"]
    if number:
        text = strip_number(text)
    rt = RichText(book.fs, size, base="b")
    lines = rt.wrap(text, book.width - 60)
    lh = rt.line_height(9)
    book.ensure(len(lines) * lh + 58)

    y0 = book.y
    if number:
        cy = y0 + lh / 2
        book.d.ellipse((book.margin_x - 4, cy - 20, book.margin_x + 36, cy + 20),
                       fill=color)
        label = book.fs.sanitize(str(number))
        f = book.fs.get("b", 22)
        book.d.text((book.margin_x + 16 - tw(label, f) / 2, cy - 13),
                    label, font=f, fill="#FFFFFF")
    x0 = book.margin_x + (52 if number else 0)

    last_top = book.y
    for line in lines:
        last_top = book.y
        rt.draw_line(book.d, x0, book.y, line, color, lh)
        book.y += lh

    width = max((line[-1][0] + line[-1][1]) if line else 0 for line in lines)
    base = last_top + ink_bottom(lines[-1], book.fs.get("b", size), lh - 4)
    marker_stroke(book.d, x0, base, x0 + min(width, book.width - 60),
                  base + 10, C["hl_yellow"])
    book.y = base + 22

    if tag:                                   # margin note in the red margin
        f = book.fs.get("b", 17)
        book.d.text((book.rule_x - 6 - tw(tag, f), y0 + 6),
                    book.fs.sanitize(tag), font=f, fill=C["pen_red"])
    book.space(8)


def banner(book, text, icon=None, color=None, size=40):
    """Big page banner used by mind maps, revision pages, etc.

    The font shrinks and then wraps, so a long banner never runs off the
    right edge of the sheet.
    """
    color = color or C["pen_head"]
    label = book.fs.sanitize(text.upper())
    x = book.margin_x + (54 if icon else 0)
    max_w = book.right - x

    while size > 26 and tw(label, book.fs.get("b", size)) > max_w * 2:
        size -= 2
    f = book.fs.get("b", size)
    rt = RichText(book.fs, size, base="b")
    lines = rt.wrap(label, max_w)
    lh = rt.line_height(10)

    book.ensure(len(lines) * lh + 40)
    if icon:
        cy = book.y + size / 2 + 2
        if icon == "brain":
            icon_brain(book.d, book.margin_x + 20, cy, 21, color)
        elif icon == "star":
            icon_star(book.d, book.margin_x + 20, cy, 22, C["hl_yellow"], color)
        elif icon == "bulb":
            icon_bulb(book.d, book.margin_x + 20, cy, 20, color)
        elif icon == "pin":
            icon_pin(book.d, book.margin_x + 20, cy - 6, 14, color)

    last_top = book.y
    for line in lines:
        last_top = book.y
        rt.draw_line(book.d, x, book.y, line, color, lh)
        book.y += lh
    width = max((line[-1][0] + line[-1][1]) if line else 0 for line in lines)
    base = last_top + ink_bottom(lines[-1], f, size + 8)
    marker_stroke(book.d, x, base, min(x + width, book.right), base + 12,
                  C["hl_yellow"])
    book.y = base + 46


def chips(book, text, size=20, indent=0):
    """Comma separated values drawn as rounded tag pills."""
    values = [v.strip(" .") for v in re.split(r"[,;]", plain(text)) if v.strip(" .")]
    if not values:
        return
    f = book.fs.get("r", size)
    x = book.margin_x + indent
    h = size + 16
    book.ensure(h + 8)
    for i, value in enumerate(values):
        value = book.fs.sanitize(value)
        w = tw(value, f) + 26
        if x + w > book.right:
            book.y += h + 8
            book.ensure(h + 8)
            x = book.margin_x + indent
        fill, border = BRANCH[i % len(BRANCH)]
        book.d.rounded_rectangle((x, book.y, x + w, book.y + h),
                                 radius=h // 2, fill=fill, outline=border)
        book.d.text((x + 13, book.y + 7), value, font=f, fill=C["ink"])
        x += w + 10
    book.y += h + 12


def draw_table(book, rows, title=None, head_fill=None, size=21,
               zebra=True, first_col_bold=True):
    if not rows:
        return
    head_fill = head_fill or C["box_exam"]
    if title:
        section_heading(book, None, title, C["pen"], 27)

    headers, body = rows[0], rows[1:]
    cols = max(len(r) for r in rows)
    headers = headers + [""] * (cols - len(headers))
    body = [r + [""] * (cols - len(r)) for r in body]

    rt = RichText(book.fs, size)
    rt_head = RichText(book.fs, size, base="b")
    lh = rt.line_height(6)
    pad = 12

    # natural widths -> proportional fit, but never narrower than the
    # longest single word in the column (otherwise words get chopped)
    font = book.fs.get("r", size)
    natural, minimum = [], []
    for c in range(cols):
        cells = [headers[c]] + [r[c] for r in body]
        texts = [plain(x) for x in cells]
        natural.append(max(tw(t[:70], font) for t in texts) + 2 * pad + 6)
        words = [w for t in texts for w in t.split()] or [""]
        minimum.append(max(tw(w, font) for w in words) + 2 * pad + 6)

    width = book.width
    total = sum(natural) or 1
    widths = [w / total * width for w in natural]
    for _ in range(6):                       # grow narrow columns, shrink wide
        deficit = sum(max(0, minimum[c] - widths[c]) for c in range(cols))
        if deficit < 1:
            break
        slack = [max(0, widths[c] - minimum[c]) for c in range(cols)]
        pool = sum(slack) or 1
        widths = [
            max(widths[c], minimum[c]) - deficit * slack[c] / pool
            for c in range(cols)
        ]
    scale = width / (sum(widths) or 1)
    widths = [w * scale for w in widths]

    def row_lines(cells, rich):
        out, height = [], 0
        for c, cell in enumerate(cells):
            wrapped = rich.wrap(cell, widths[c] - 2 * pad)
            out.append(wrapped)
            height = max(height, len(wrapped) * lh)
        return out, height + 2 * pad - 4

    def draw_row(cells_lines, height, fill, rich, bold_first):
        x = book.margin_x
        book.d.rectangle((book.margin_x, book.y, book.margin_x + sum(widths),
                          book.y + height), fill=fill,
                         outline=C["line_soft"], width=1)
        for c, wrapped in enumerate(cells_lines):
            ty = book.y + pad - 2
            use = rt_head if (bold_first and c == 0) else rich
            for line in wrapped:
                use.draw_line(book.d, x + pad, ty, line, C["ink"], lh)
                ty += lh
            if c:
                book.d.line((x, book.y, x, book.y + height),
                            fill=C["line_soft"], width=1)
            x += widths[c]
        book.y += height

    head_lines, head_h = row_lines(headers, rt_head)
    book.ensure(head_h + lh * 2 + 24)
    draw_row(head_lines, head_h, head_fill, rt_head, False)

    for i, row in enumerate(body):
        cells_lines, h = row_lines(row, rt)
        if book.y + h > book.bottom:
            book.new_page()
            head_lines, head_h = row_lines(headers, rt_head)
            draw_row(head_lines, head_h, head_fill, rt_head, False)
        fill = C["paper_alt"] if (zebra and i % 2) else "#FFFFFF"
        draw_row(cells_lines, h, fill, rt, first_col_bold)

    book.space(20)


# ============================================================
# 8. MIND MAPS
# ============================================================

def draw_mindmap(book, block, per_page=8):
    branches = []
    for item in block["items"]:
        if ":" in item:
            label, detail = item.split(":", 1)
        elif " - " in item:
            label, detail = item.split(" - ", 1)
        else:
            label, detail = item, ""
        branches.append((plain(label).strip(), detail.strip()))

    title = block["title"] or "Mind Map"
    groups = [branches[i:i + per_page]
              for i in range(0, len(branches), per_page)] or [[]]

    for gi, group in enumerate(groups):
        book.fresh()
        name = title if gi == 0 else title + " (contd.)"
        banner(book, "mind map - " + name, icon="brain")
        if block["text"] and gi == 0:
            book.paragraph(block["text"], 22, C["ink_soft"])

        top = book.y + 10
        bottom = book.bottom - 20
        cx = (book.margin_x + book.right) / 2
        cy = (top + bottom) / 2

        # centre node
        rt_c = RichText(book.fs, 27, base="b")
        c_lines = rt_c.wrap(title, 230)
        c_lh = rt_c.line_height(6)
        cw, ch = 270, max(112, len(c_lines) * c_lh + 46)
        book.d.ellipse((cx - cw / 2 + 5, cy - ch / 2 + 6,
                        cx + cw / 2 + 5, cy + ch / 2 + 6), fill=C["shadow"])
        book.d.ellipse((cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2),
                       fill=C["hl_yellow"], outline=C["box_key_br"], width=3)
        ty = cy - len(c_lines) * c_lh / 2
        for line in c_lines:
            width = (line[-1][0] + line[-1][1]) if line else 0
            rt_c.draw_line(book.d, cx - width / 2, ty, line, C["pen"], c_lh)
            ty += c_lh

        if not group:
            continue

        # branch boxes
        rt_l = RichText(book.fs, 24, base="b")
        rt_d = RichText(book.fs, 19)
        box_w = min(300, (book.width - cw - 90) / 2)
        pad = 12
        boxes = []
        for label, detail in group:
            l_lines = rt_l.wrap(label, box_w - 2 * pad)
            d_lines = rt_d.wrap(detail, box_w - 2 * pad) if detail else []
            h = (len(l_lines) * rt_l.line_height(6)
                 + len(d_lines) * rt_d.line_height(6) + 2 * pad + 18)
            boxes.append((label, l_lines, d_lines, h))

        right = boxes[0::2]
        left = boxes[1::2]

        def stack(items, side):
            if not items:
                return []
            need = sum(b[3] for b in items)
            # spread the column over the whole writing area
            gap = 20.0
            if len(items) > 1:
                gap = max(16.0, min(110.0,
                                    (bottom - top - need) / (len(items) - 1)))
            total = need + gap * (len(items) - 1)
            y = max(top, cy - total / 2)
            out = []
            for b in items:
                x0 = (cx + cw / 2 + 62) if side > 0 else (book.margin_x)
                out.append((x0, y, b))
                y += b[3] + gap
            return out

        placed = [(p, 1) for p in stack(right, 1)] + \
                 [(p, -1) for p in stack(left, -1)]

        for i, ((x0, y0, b), side) in enumerate(placed):
            label, l_lines, d_lines, h = b
            fill, border = BRANCH[i % len(BRANCH)]
            x1 = x0 + box_w
            mid = y0 + h / 2

            anchor_x = cx + (cw / 2 - 8) * side
            box_edge = x0 if side > 0 else x1
            curve(book.d, (anchor_x, cy),
                  ((anchor_x + box_edge) / 2, mid),
                  (box_edge, mid), border, 3)
            book.d.ellipse((box_edge - 5, mid - 5, box_edge + 5, mid + 5),
                           fill=border)

            book.d.rounded_rectangle((x0 + 4, y0 + 5, x1 + 4, y0 + h + 5),
                                     radius=14, fill=C["shadow"])
            book.d.rounded_rectangle((x0, y0, x1, y0 + h), radius=14,
                                     fill=fill, outline=border, width=2)
            ty = y0 + pad
            for line in l_lines:
                rt_l.draw_line(book.d, x0 + pad, ty, line, border,
                               rt_l.line_height(6))
                ty += rt_l.line_height(6)
            ty += 6
            for line in d_lines:
                rt_d.draw_line(book.d, x0 + pad, ty, line, C["ink"],
                               rt_d.line_height(6))
                ty += rt_d.line_height(6)

        book.y = book.bottom


# ============================================================
# 9. FLOW CHARTS, COMPARISONS, STICKY NOTES
# ============================================================

def draw_flow(book, block):
    steps = [plain(s) for s in block["items"] if plain(s)]
    if not steps:
        return
    if block["title"]:
        section_heading(book, None, block["title"], C["pen"], 27, tag="flow")

    rt = RichText(book.fs, 23, base="b")
    box_w = min(640, book.width - 80)
    x0 = book.margin_x + (book.width - box_w) / 2
    pad = 14

    for i, step in enumerate(steps):
        lines = rt.wrap(step, box_w - 2 * pad)
        lh = rt.line_height(5)
        h = len(lines) * lh + 2 * pad
        if book.ensure(h + 46) and i:
            pass
        fill, border = BRANCH[i % len(BRANCH)]
        book.d.rounded_rectangle((x0 + 4, book.y + 5, x0 + box_w + 4,
                                  book.y + h + 5), radius=14, fill=C["shadow"])
        book.d.rounded_rectangle((x0, book.y, x0 + box_w, book.y + h),
                                 radius=14, fill=fill, outline=border, width=2)
        ty = book.y + pad - 2
        for line in lines:
            width = (line[-1][0] + line[-1][1]) if line else 0
            rt.draw_line(book.d, x0 + (box_w - width) / 2, ty, line,
                         C["ink"], lh)
            ty += lh
        book.y += h

        if i < len(steps) - 1:
            cx = x0 + box_w / 2
            book.d.line((cx, book.y + 4, cx, book.y + 26),
                        fill=C["pen"], width=3)
            book.d.polygon([(cx - 8, book.y + 24), (cx + 8, book.y + 24),
                            (cx, book.y + 38)], fill=C["pen"])
            book.y += 42
    book.space(18)


def draw_compare(book, block):
    def field_text(name, default):
        value = block.field(name)
        return plain(value["text"]) if value and value.get("text") else default

    left_name = field_text("left", "Left")
    right_name = field_text("right", "Right")
    rows = [["Point of difference", left_name, right_name]]
    for item in block["items"]:
        parts = [p.strip() for p in item.split("|")]
        if len(parts) >= 3:
            rows.append(parts[:3])
        elif len(parts) == 2:
            rows.append([parts[0], parts[1], ""])
    if block["rows"]:
        rows = block["rows"]
    if len(rows) < 2:
        return
    if block["title"]:
        section_heading(book, None, block["title"], C["pen"], 27,
                        tag="compare")
    draw_table(book, rows, None, C["box_simple"])


def draw_stickies(book, block):
    items = [i for i in block["items"] if plain(i)]
    if not items:
        return
    if block["title"]:
        section_heading(book, None, block["title"], C["pen"], 27, tag="facts")

    rt = RichText(book.fs, 21)
    cols = 2
    gap = 26
    note_w = int((book.width - gap * (cols - 1)) / cols)
    pad = 18

    row = []
    for i, item in enumerate(items):
        row.append(item)
        if len(row) == cols or i == len(items) - 1:
            heights, wraps = [], []
            for text in row:
                lines = rt.wrap(text, note_w - 2 * pad - 6)
                wraps.append(lines)
                heights.append(len(lines) * rt.line_height(7) + 2 * pad + 10)
            h = int(max(heights))
            book.ensure(h + 40)
            # M is slack around the note so rotation never clips the text
            M = 22
            for c, lines in enumerate(wraps):
                x0 = int(book.margin_x + c * (note_w + gap))
                note = Image.new("RGBA", (note_w + 2 * M, h + 2 * M),
                                 (0, 0, 0, 0))
                nd = ImageDraw.Draw(note)
                nd.rectangle((M + 5, M + 6, M + note_w + 5, M + h + 6),
                             fill=(0, 0, 0, 26))
                fill = C["sticky"] if (i + c) % 2 == 0 else C["hl_green"]
                nd.rectangle((M, M, M + note_w, M + h), fill=fill,
                             outline=C["sticky_br"], width=1)
                nd.polygon([(M + note_w - 34, M + h), (M + note_w, M + h),
                            (M + note_w, M + h - 34)], fill=(0, 0, 0, 22))
                ty = M + pad
                for line in lines:
                    rt.draw_line(nd, M + pad, ty, line, C["ink"],
                                 rt.line_height(7))
                    ty += rt.line_height(7)
                rot = note.rotate(2.0 if c % 2 == 0 else -1.8,
                                  expand=True, resample=Image.BICUBIC)
                dx = (rot.width - note.width) // 2
                dy = (rot.height - note.height) // 2
                book.im.paste(rot, (x0 - M - dx, int(book.y) - M - dy), rot)
                icon_pin(book.d, x0 + note_w / 2, book.y + 2, 9,
                         C["pen_red"])
            book.y += h + 34
            row = []
    book.space(10)


# ============================================================
# 10. CONTENT BLOCK RENDERERS
# ============================================================

FIELD_STYLES = [
    # (matcher, renderer key)
    (("key to remember", "key point to remember", "remember this", "key"),
     "key"),
    (("in simple words", "simple words", "simple def", "simple definition",
      "meaning", "definition"), "simple"),
    (("exam tip", "exam point", "board tip", "how to write in exam",
      "answer tip"), "exam"),
    (("trick", "mnemonic", "memory trick", "shortcut"), "trick"),
    (("watch out", "common mistake", "mistake", "careful", "caution",
      "dont confuse", "do not confuse"), "warn"),
    (("key points", "must know", "highlights", "points to note",
      "quick points", "important points"), "checklist"),
    (("concept related to", "linked concepts", "related concepts",
      "connects with"), "chips"),
    (("question", "one liner question", "one liner", "mcq", "answer"),
     "qa"),
    (("concept", "explanation", "easy explanation", "what it means",
      "in easy language", "story", "why it matters", "example",
      "real life link", "real life example"), "para"),
]


def field_style(label):
    key = norm_label(label)
    for names, style in FIELD_STYLES:
        if key in names:
            return style
    for names, style in FIELD_STYLES:
        if any(key.startswith(n) or n in key for n in names):
            return style
    return "labelled"


def render_field(book, label, value, highlight=True):
    text = value["text"]
    items = value["items"]
    style = field_style(label)
    pretty = plain(label)

    if style == "key" and highlight:
        book.boxed_text(text, items, C["box_key"], C["box_key_br"],
                        label="key to remember", icon="star",
                        text_color=C["box_key_tx"], size=25)
    elif style == "simple":
        book.boxed_text(text, items, C["box_simple"], C["box_simple_br"],
                        label=pretty, icon="pin", size=24)
    elif style == "exam":
        book.boxed_text(text, items, C["box_exam"], C["box_exam_br"],
                        label=pretty, icon="bulb", size=23)
    elif style == "trick":
        book.boxed_text(text, items, C["box_trick"], C["box_trick_br"],
                        label=pretty, icon="star", size=24)
    elif style == "warn":
        book.boxed_text(text, items, C["box_warn"], C["box_warn_br"],
                        label=pretty, icon="warn", size=23)
    elif style == "checklist":
        # "**Key points:** The five elements" -> the sentence becomes the
        # heading, so the label is not repeated above it
        label_text(book, plain(text) if text else pretty)
        book.bullets(items, 24, "check")
    elif style == "chips":
        label_text(book, pretty)
        chips(book, text or ", ".join(items), 20, 8)
    elif style == "para":
        if pretty.lower() not in ("concept", "explanation"):
            label_text(book, pretty)
        book.paragraph(text, 25)
        if items:
            book.bullets(items, 24, "dot")
    else:
        label_text(book, pretty)
        if text:
            book.paragraph(text, 24, indent=8)
        if items:
            book.bullets(items, 23, "arrow")


def label_text(book, text, color=None):
    f = book.fs.get("b", 23)
    book.ensure(34)
    label = book.fs.sanitize(text.rstrip(":") + ":")
    book.d.text((book.margin_x, book.y), label, font=f,
                fill=color or C["pen"])
    book.y += 32


def render_section(book, block, number=None):
    book.ensure(210)
    section_heading(book, number, block["title"] or "Section",
                    C["pen_head"], 32, tag="topic")
    if block["text"]:
        book.paragraph(block["text"], 25)
    for label, value in block["fields"]:
        render_field(book, label, value,
                     bool(book_setting(book, "highlight_keys", True)))
    if block["items"]:
        book.bullets(block["items"], 24, "check")
    if block["rows"]:
        draw_table(book, block["rows"])
    divider(book)


def book_setting(book, key, default=None):
    return getattr(book, "settings", {}).get(key, default)


def divider(book):
    book.space(6)
    if book.avail() < 40:
        return
    y = book.y
    book.d.line((book.margin_x, y, book.right, y), fill=C["line_soft"], width=1)
    for i in range(3):
        cx = (book.margin_x + book.right) / 2 + (i - 1) * 22
        book.d.ellipse((cx - 3, y - 3, cx + 3, y + 3), fill=C["line_soft"])
    book.space(26)


MCQ_SPLIT = re.compile(r"\(([A-Da-d])\)\s*")


def render_topic(book, block, number=None):
    """Q&A revision card."""
    book.ensure(260)
    title = block["title"] or "Topic"
    section_heading(book, number, title, C["pen_head"], 31, tag="Q")

    fields = {norm_label(l): v for l, v in block["fields"]}
    used = set()

    def take(*names):
        for name in names:
            if name in fields and name not in used:
                used.add(name)
                return fields[name]
        return None

    q = take("question")
    if q:
        book.boxed_text(q["text"], q["items"], "#FFFFFF", C["box_exam_br"],
                        label="question", icon="pin", size=25)

    definition = take("simple def", "simple definition", "answer", "concept",
                      "in simple words")
    if definition:
        book.paragraph(definition["text"], 25)
        if definition["items"]:
            book.bullets(definition["items"], 24, "dot")

    key = take("key to remember", "key")
    if key:
        render_field(book, "key to remember", key,
                     bool(book_setting(book, "highlight_keys", True)))

    one = take("one liner question", "one liner")
    if one:
        book.boxed_text(one["text"], one["items"], C["box_simple"],
                        C["box_simple_br"], label="one-liner", icon="bulb",
                        size=23)

    mcq = take("mcq")
    if mcq:
        render_mcq(book, mcq["text"] or " ".join(mcq["items"]))

    related = take("concept related to", "linked concepts")
    if related:
        label_text(book, "Concept related to")
        chips(book, related["text"] or ", ".join(related["items"]), 20, 8)

    for label, value in block["fields"]:
        if norm_label(label) not in used:
            render_field(book, label, value, True)

    if block["items"]:
        book.bullets(block["items"], 24, "check")
    divider(book)


def render_mcq(book, text):
    if not text:
        return
    answer = ""
    m = re.search(r"ans(?:wer)?\s*[:\-]?\s*\(?([A-Da-d])\)?", text,
                  re.IGNORECASE)
    if m:
        answer = m.group(1).upper()
        text = text[:m.start()].strip(" .*")

    parts = MCQ_SPLIT.split(text)
    stem = parts[0].strip(" .")
    options = []
    for i in range(1, len(parts) - 1, 2):
        options.append((parts[i].upper(), parts[i + 1].strip(" .*")))

    label_text(book, "MCQ", C["pen_red"])
    book.paragraph(stem, 23, indent=8)

    if not options:
        return
    rt = RichText(book.fs, 22)
    lh = rt.line_height(8)
    for letter, option in options:
        correct = (letter == answer)
        lines = rt.wrap(option, book.width - 110)
        h = len(lines) * lh + 12
        book.ensure(h)
        y0 = book.y
        if correct:
            marker_stroke(book.d, book.margin_x + 16, y0 - 2,
                          min(book.right, book.margin_x + 60 +
                              max((l[-1][0] + l[-1][1]) if l else 0
                                  for l in lines)),
                          y0 + h - 10, C["hl_green"])
        cy = y0 + lh / 2
        book.d.ellipse((book.margin_x + 22, cy - 15, book.margin_x + 52,
                        cy + 15),
                       fill="#FFFFFF",
                       outline=C["pen_green"] if correct else C["line_soft"],
                       width=2)
        f = book.fs.get("b", 20)
        book.d.text((book.margin_x + 37 - tw(letter, f) / 2, cy - 12),
                    letter, font=f,
                    fill=C["pen_green"] if correct else C["ink_soft"])
        ty = y0
        for line in lines:
            rt.draw_line(book.d, book.margin_x + 62, ty, line, C["ink"], lh)
            ty += lh
        if correct:
            icon_check(book.d, book.right - 40, cy, 12, C["pen_green"])
        book.y = y0 + h

    if answer:
        f = book.fs.get("b", 21)
        label = book.fs.sanitize("Ans: " + answer)
        w = tw(label, f) + 30
        book.ensure(44)
        book.d.rounded_rectangle((book.margin_x + 22, book.y,
                                  book.margin_x + 22 + w, book.y + 36),
                                 radius=18, fill=C["hl_green"],
                                 outline=C["pen_green"], width=2)
        book.d.text((book.margin_x + 37, book.y + 5), label, font=f,
                    fill=C["pen_green"])
        book.y += 46


def render_bigq(book, block):
    items = block["items"] or [block["text"]]
    book.ensure(150)
    banner(book, block["title"] or "the big questions", icon="bulb")
    rt = RichText(book.fs, 25, base="b")
    lh = rt.line_height(8)
    pad = 18
    x_text = book.margin_x + 74

    for i, item in enumerate(items, start=1):
        lines = rt.wrap(item, book.right - x_text - pad)
        h = len(lines) * lh + 2 * pad
        book.ensure(h + 14)
        y0 = book.y
        fill, border = BRANCH[(i - 1) % len(BRANCH)]
        book.shadowed_box(book.margin_x, y0, book.right, y0 + h, fill, border)
        cy = y0 + pad + lh / 2 - 2
        book.d.ellipse((book.margin_x + 18, cy - 20, book.margin_x + 58,
                        cy + 20), fill=border)
        f = book.fs.get("b", 23)
        book.d.text((book.margin_x + 38 - tw(str(i), f) / 2, cy - 14),
                    str(i), font=f, fill="#FFFFFF")
        ty = y0 + pad
        for line in lines:
            rt.draw_line(book.d, x_text, ty, line, C["ink"], lh)
            ty += lh
        book.y = y0 + h + 16
    book.space(10)


def render_revision(book, block):
    book.fresh()
    banner(book, block["title"] or "last-minute revision", icon="star")
    rt = RichText(book.fs, 23, base="b")
    lh = rt.line_height(7)
    pad = 10
    for i, item in enumerate(block["items"]):
        lines = rt.wrap(item, book.width - 90)
        h = len(lines) * lh + 2 * pad
        book.ensure(h + 10)
        y0 = book.y
        fill, border = BRANCH[i % len(BRANCH)]
        book.d.rounded_rectangle((book.margin_x, y0, book.right, y0 + h),
                                 radius=12, fill=fill, outline=border, width=1)
        book.d.rounded_rectangle((book.margin_x, y0, book.margin_x + 9,
                                  y0 + h), radius=4, fill=border)
        icon_star(book.d, book.margin_x + 34, y0 + pad + lh / 2 - 2, 12,
                  C["hl_yellow"], border)
        ty = y0 + pad
        for line in lines:
            rt.draw_line(book.d, book.margin_x + 60, ty, line, C["ink"], lh)
            ty += lh
        book.y = y0 + h + 10
    book.space(10)


def render_examq(book, block):
    book.fresh()
    banner(book, block["title"] or "exam practice questions", icon="bulb")
    rt = RichText(book.fs, 24)
    lh = rt.line_height(8)
    f_q = book.fs.get("b", 22)
    number_w = tw("Q%d." % max(len(block["items"]), 1), f_q) + 14
    for i, item in enumerate(block["items"], start=1):
        marks = ""
        if "|" in item:
            item, marks = [p.strip() for p in item.split("|", 1)]
        x_text = book.margin_x + number_w
        lines = rt.wrap(item, book.right - x_text - (110 if marks else 10))
        h = len(lines) * lh + 16
        book.ensure(h)
        y0 = book.y
        book.d.text((book.margin_x, y0 + 2), "Q" + str(i) + ".", font=f_q,
                    fill=C["pen_red"])
        ty = y0
        for line in lines:
            rt.draw_line(book.d, x_text, ty, line, C["ink"], lh)
            ty += lh
        if marks:
            fm = book.fs.get("b", 18)
            label = book.fs.sanitize(marks)
            w = tw(label, fm) + 22
            book.d.rounded_rectangle((book.right - w, y0 + 2, book.right,
                                      y0 + 34), radius=16,
                                     fill=C["hl_pink"], outline=C["pen_red"])
            book.d.text((book.right - w + 11, y0 + 7), label, font=fm,
                        fill=C["pen_red"])
        book.y = y0 + h + 6
        book.d.line((x_text, book.y, book.right, book.y),
                    fill=C["rule"], width=1)
        book.space(14)


# ============================================================
# 11. COVER + CONTENTS
# ============================================================

def render_cover(book, doc):
    d, W = book.d, book.W
    tape(d, book.margin_x + 40, 150, book.right - 40, 190)

    rt = RichText(book.fs, 58, base="b")
    lines = rt.wrap(doc["title"].upper(), book.width - 40)
    lh = rt.line_height(12)
    y = 250
    last_top = y
    for line in lines:
        last_top = y
        rt.draw_line(d, book.margin_x, y, line, C["pen_head"], lh)
        y += lh
    base = last_top + ink_bottom(lines[-1], book.fs.get("b", 58), lh)
    marker_stroke(d, book.margin_x, base, book.right - 60, base + 18,
                  C["hl_yellow"])
    y = base + 46

    if doc["subtitle"]:
        rt_s = RichText(book.fs, 28)
        for line in rt_s.wrap(doc["subtitle"], book.width - 40):
            rt_s.draw_line(d, book.margin_x, y, line, C["ink_soft"],
                           rt_s.line_height(8))
            y += rt_s.line_height(8)
    y += 40

    book.y = y
    counts = {}
    for b in doc["blocks"]:
        counts[b["kind"]] = counts.get(b["kind"], 0) + 1
    names = {
        "section": "concept sections", "topic": "question cards",
        "mindmap": "mind maps", "table": "tables", "flow": "flow charts",
        "compare": "comparison charts", "factfile": "fact files",
        "revision": "revision pages", "examq": "exam question sets",
    }
    def phrase(kind, n):
        label = names.get(kind, kind)
        if n == 1 and label.endswith("s"):
            label = label[:-1]
        return "**%d** %s" % (n, label)

    summary = ", ".join(
        phrase(k, n) for k, n in counts.items() if k in names
    )
    if summary:
        book.boxed_text("Inside these notes: " + summary + ".", [],
                        C["box_exam"], C["box_exam_br"],
                        label="what is inside", icon="pin", size=24)

    how = (
        "==Read== the easy-language explanation first, "
        "then look at the ++mind map++ to see how the ideas connect, "
        "then memorise every !!KEY TO REMEMBER!! box, "
        "and finally test yourself with the questions at the end."
    )
    book.boxed_text(how, [], C["box_key"], C["box_key_br"],
                    label="how to use these notes", icon="star",
                    text_color=C["box_key_tx"], size=24)

    book.boxed_text(
        "Colour code used in these notes:", [
            "==Yellow highlight== - definitions and exact terms the examiner looks for.",
            "++Green highlight++ - facts, figures and correct answers.",
            "!!Pink highlight!! - traps, exceptions and things students often mix up.",
            "__Underline__ - keywords worth writing in every answer.",
        ], C["box_soft"], C["box_soft_br"], label="colour code", icon="bulb",
        size=22)
    book.y = book.bottom


def render_contents(book, entries):
    if not entries:
        return
    book.fresh()
    banner(book, "contents", icon="pin")
    rt = RichText(book.fs, 24)
    lh = rt.line_height(9)
    f_num = book.fs.get("b", 22)
    for number, title, page in entries:
        lines = rt.wrap(title, book.width - 160)
        h = len(lines) * lh + 10
        book.ensure(h)
        y0 = book.y
        if number:
            book.d.text((book.margin_x, y0), str(number) + ".", font=f_num,
                        fill=C["pen"])
        ty = y0
        for line in lines:
            rt.draw_line(book.d, book.margin_x + 52, ty, line, C["ink"], lh)
            ty += lh
        page_label = str(page)
        book.d.text((book.right - tw(page_label, f_num), y0), page_label,
                    font=f_num, fill=C["ink_soft"])
        width = (lines[-1][-1][0] + lines[-1][-1][1]) if lines[-1] else 0
        dot_x0 = book.margin_x + 62 + width
        dot_x1 = book.right - tw(page_label, f_num) - 12
        yy = y0 + lh - 10
        x = dot_x0
        while x < dot_x1:
            book.d.ellipse((x, yy, x + 2, yy + 2), fill=C["line_soft"])
            x += 12
        book.y = y0 + h


# ============================================================
# 12. BUILD
# ============================================================

RENDERERS_NEED_FRESH = {"mindmap", "revision", "examq"}


def build_pdf(md_file, output_file, overrides=None):
    doc = parse_markdown(md_file)
    doc["settings"].update(overrides or {})
    s = doc["settings"]

    family = "handwriting" if s.get("handwriting", True) else "print"
    family = str(s.get("font_family", family)).lower()
    fs = FontSet(family)

    cover = bool(s.get("cover_page", True))
    book = Book(doc, fs, first_header=not cover)
    book.settings = s

    if cover:
        render_cover(book, doc)

    # ---- first pass: measure where numbered content lands -----------
    # (rendered twice so the contents page can carry real page numbers)
    def render_body(target):
        numbers = {"section": 0, "topic": 0}
        entries = []
        for block in doc["blocks"]:
            kind = block["kind"]
            if kind in RENDERERS_NEED_FRESH:
                target.fresh()
            if kind == "section":
                numbers["section"] += 1
                entries.append((numbers["section"],
                                plain(block["title"]) or "Section",
                                len(target.pages)))
                render_section(target, block, numbers["section"])
            elif kind == "topic":
                numbers["topic"] += 1
                render_topic(target, block, numbers["topic"])
            elif kind == "mindmap":
                draw_mindmap(target, block)
            elif kind == "table":
                draw_table(target, block["rows"], block["title"])
            elif kind == "flow":
                draw_flow(target, block)
            elif kind == "compare":
                draw_compare(target, block)
            elif kind == "factfile":
                draw_stickies(target, block)
            elif kind == "revision":
                render_revision(target, block)
            elif kind == "examq":
                render_examq(target, block)
            elif kind == "bigq":
                render_bigq(target, block)
        return entries

    entries = []
    if s.get("contents_page", True):
        probe = Book(doc, fs, first_header=not cover)
        probe.settings = s
        if cover:
            render_cover(probe, doc)
        probe.new_page()                      # placeholder contents page
        offset_probe = len(probe.pages)
        raw = render_body(probe)
        # page numbers are 1-based and already include cover + contents
        entries = [(n, t, p + 1) for n, t, p in raw]
        del probe, offset_probe
        render_contents(book, entries)

    render_body(book)

    # ---- footers ----------------------------------------------------
    total = len(book.pages)
    f = fs.get("r", 19)
    for idx, im in enumerate(book.pages, start=1):
        d = ImageDraw.Draw(im)
        d.line((book.margin_x, book.H - 74, book.right, book.H - 74),
               fill=C["rule"], width=1)
        left = fs.sanitize(doc["subtitle"] or doc["title"])
        d.text((book.margin_x, book.H - 62), left[:70], font=f,
               fill=C["ink_faint"])
        label = "%d / %d" % (idx, total)
        w = tw(label, f)
        d.ellipse((book.right - w - 26, book.H - 68, book.right + 4,
                   book.H - 34), fill=C["hl_yellow"])
        d.text((book.right - w - 11, book.H - 62), label, font=f,
               fill=C["ink_soft"])

    pages = [p.convert("RGB") for p in book.pages]
    pages[0].save(output_file, "PDF", resolution=150.0, save_all=True,
                  append_images=pages[1:])

    kinds = {}
    for b in doc["blocks"]:
        kinds[b["kind"]] = kinds.get(b["kind"], 0) + 1
    print("PDF generated: %s" % Path(output_file).resolve())
    print("Pages: %d   Font: %s" % (total, os.path.basename(
        fs.paths.get("r") or "default")))
    print("Blocks: " + ", ".join("%s=%d" % kv for kv in sorted(kinds.items())))


def run_check():
    """`--check`: report whether this computer is ready to make notes."""
    import PIL

    print("Board Notes Kit - environment check")
    print("-" * 52)

    py_ok = sys.version_info >= (3, 9)
    print("Python        : %s  %s" % (
        sys.version.split()[0], "OK" if py_ok else "TOO OLD (need 3.9+)"))
    print("Pillow        : %s  OK" % PIL.__version__)
    print("Platform      : %s" % platform.platform())
    print()

    ideal = {
        "handwriting": ("segoepr.ttf", "Segoe Print"),
        "print": ("calibri.ttf", "Calibri"),
    }
    fallback = False
    for family in ("handwriting", "print"):
        fs = FontSet(family)
        regular = fs.paths.get("r")
        bold = fs.paths.get("b")
        if not regular:
            print("%-13s : NO FONT FOUND" % family)
            fallback = True
            continue
        name = os.path.basename(regular)
        best, label = ideal[family]
        if name.lower() == best:
            note = "OK (%s)" % label
        else:
            note = "using a fallback font, not %s" % label
            fallback = True
        print("%-13s : %s  %s" % (family, name, note))
        print("%-13s   bold: %s" % ("", os.path.basename(bold or "-")))
    print()

    if not py_ok:
        print("NOT READY - install Python 3.9 or newer, then run this again.")
        return 1

    print("READY - you can generate notes.")
    if fallback:
        print()
        print("The notes will still be made, but the handwriting look will be")
        print("weaker because the preferred font is missing. See the FONTS")
        print("section of INSTALL_FIRST.txt to install one.")
    print()
    print("Try it now:")
    print("    python generate_notes_pdf.py examples/Ch3_Atmosphere_Questions.md")
    return 0


def main():
    args = [a for a in sys.argv[1:]]
    overrides = {}
    rest = []
    i = 0
    while i < len(args):
        a = args[i]
        if a in ("-h", "--help"):
            print(__doc__)
            return
        elif a in ("--check", "--test", "--doctor"):
            sys.exit(run_check())
        elif a == "--font" and i + 1 < len(args):
            overrides["font_family"] = args[i + 1]
            i += 1
        elif a == "--no-ruled":
            overrides["ruled_pages"] = False
        elif a == "--no-cover":
            overrides["cover_page"] = False
        elif a == "--no-contents":
            overrides["contents_page"] = False
        elif a == "--page" and i + 1 < len(args):
            overrides["page_size"] = args[i + 1]
            i += 1
        else:
            rest.append(a)
        i += 1

    if not rest:
        print(__doc__)
        sys.exit(1)

    md_file = rest[0]
    if not os.path.exists(md_file):
        print("ERROR: Markdown file not found: %s" % md_file)
        sys.exit(1)

    if len(rest) >= 2:
        output_file = rest[1]          # the user typed a path: use it as given
    else:
        # the name from SETTINGS lands beside the notes file, so
        # "generate_notes_pdf.py examples/notes.md" writes examples/notes.pdf
        name = parse_markdown(md_file)["settings"].get(
            "output", "Board_Exam_Notes.pdf")
        output_file = str(Path(md_file).resolve().parent / name)

    build_pdf(md_file, output_file, overrides)


if __name__ == "__main__":
    main()
