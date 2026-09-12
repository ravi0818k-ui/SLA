"""Thin glue between worker.js and the unmodified generate_notes_pdf.py.

Nothing in here edits the generator. It only:
  1. prepends the bundled web fonts to FAMILIES so FontSet finds real faces,
  2. wraps Book.new_page to emit page-progress,
  3. drives parse_markdown/build_pdf against Pyodide's MEMFS and hands the
     resulting PDF bytes back to JavaScript.
"""

import json
import os
import time
import traceback
from pathlib import Path

import generate_notes_pdf as gen

FONT_DIR = "/fonts"
WORK_DIR = "/work"
IN_PATH = WORK_DIR + "/in.md"
OUT_PATH = WORK_DIR + "/out.pdf"

DEFAULT_OUTPUT = "Board_Exam_Notes.pdf"


class NotesError(Exception):
    """A problem we can explain in plain English, shown verbatim in the UI."""


# --------------------------------------------------------------------------
# 1. Font injection
# --------------------------------------------------------------------------
# FAMILIES maps family -> {"r": [paths], "b": [paths]}. FontSet walks each list
# and keeps the first path that exists, so inserting at index 0 wins without
# removing the original desktop candidates (harmless here, they never exist).

def _inject_fonts():
    injected = {}
    for family, styles in gen.FAMILIES.items():
        if not isinstance(styles, dict):
            continue
        for style, paths in styles.items():
            if not isinstance(paths, list):
                continue
            candidate = "%s/%s_%s.ttf" % (FONT_DIR, family, style)
            if candidate in paths:
                paths.remove(candidate)
            paths.insert(0, candidate)
            injected["%s_%s" % (family, style)] = os.path.exists(candidate)
    return injected


FONT_STATUS = _inject_fonts()


def font_report():
    """Which bundled faces actually landed in MEMFS. The worker surfaces 404s."""
    return json.dumps(FONT_STATUS)


# --------------------------------------------------------------------------
# 2. Page progress
# --------------------------------------------------------------------------
_progress_cb = None
_orig_new_page = gen.Book.new_page


def _new_page(self, header=True):
    result = _orig_new_page(self, header)
    if _progress_cb is not None:
        try:
            _progress_cb(len(self.pages))
        except Exception:
            # A dead JS proxy must never abort a render mid-way.
            pass
    return result


gen.Book.new_page = _new_page


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def _clean_overrides(raw):
    """Drop empty values so build_pdf's merge keeps the file's own settings."""
    out = {}
    for key, value in (raw or {}).items():
        if value is None or value == "":
            continue
        out[key] = value
    return out


def _resolve_output_name(parsed, upload_name):
    """1. the SETTINGS `output:` key, 2. the upload's basename, 3. the default.

    parse_markdown seeds settings["output"] with DEFAULT_OUTPUT before reading
    the file, so that exact value means "the markdown did not set one" and the
    uploaded filename should win instead.
    """
    settings = {}
    if isinstance(parsed, dict):
        settings = parsed.get("settings") or {}
    name = settings.get("output") if isinstance(settings, dict) else None

    if name and str(name) != DEFAULT_OUTPUT:
        return str(name)

    if upload_name:
        stem = Path(upload_name).stem
        if stem:
            return stem + ".pdf"

    return str(name) if name else DEFAULT_OUTPUT


def _blocks_of(parsed):
    if isinstance(parsed, dict):
        for key in ("blocks", "sections", "items"):
            value = parsed.get(key)
            if isinstance(value, list):
                return value
    if isinstance(parsed, list):
        return parsed
    return []


def _kind_of(block):
    if isinstance(block, dict):
        for key in ("kind", "type", "block_type"):
            if block.get(key):
                return str(block[key])
        return "block"
    for attr in ("kind", "type", "block_type"):
        value = getattr(block, attr, None)
        if value:
            return str(value)
    return type(block).__name__


def _tally(parsed):
    counts = {}
    for block in _blocks_of(parsed):
        kind = _kind_of(block)
        counts[kind] = counts.get(kind, 0) + 1
    return counts


def _resolved_font(settings):
    """The face FontSet actually picked, resolved exactly as build_pdf does.

    Mirrors generate_notes_pdf.build_pdf: the boolean `handwriting` setting
    chooses the family, and an explicit `font_family` overrides it.
    """
    family = "handwriting" if settings.get("handwriting", True) else "print"
    family = str(settings.get("font_family", family)).lower()
    path = gen.FontSet(family).paths.get("r")
    if not path:
        # FontSet.get() would fall back to ImageFont.load_default() here.
        return "load_default() (no font file found)"
    return os.path.basename(path)


# --------------------------------------------------------------------------
# 3. Entry point called from worker.js
# --------------------------------------------------------------------------

def generate(md_text, overrides_json, progress_cb=None):
    """Render markdown text to PDF bytes. Returns a JSON-able dict."""
    global _progress_cb

    started = time.time()
    overrides = _clean_overrides(json.loads(overrides_json or "{}"))
    upload_name = overrides.pop("__filename", "")

    os.makedirs(WORK_DIR, exist_ok=True)

    # A failed run must never be able to serve the previous run's PDF.
    if os.path.exists(OUT_PATH):
        os.remove(OUT_PATH)

    Path(IN_PATH).write_text(md_text, encoding="utf-8")

    _progress_cb = progress_cb
    try:
        parsed = gen.parse_markdown(IN_PATH)
        blocks = _blocks_of(parsed)
        if not blocks:
            raise NotesError(
                "This file has no ## sections. Check it against template.md."
            )

        merged = dict(parsed.get("settings") or {})
        merged.update(overrides)

        # build_pdf(md_file, output_file, overrides) merges overrides over the
        # settings it parsed from the file, exactly as the CLI does.
        gen.build_pdf(IN_PATH, OUT_PATH, overrides)

        if not os.path.exists(OUT_PATH):
            raise NotesError(
                "The renderer finished but produced no PDF."
            )

        data = Path(OUT_PATH).read_bytes()
        if not data:
            raise NotesError("The renderer produced an empty PDF.")

        return {
            "ok": True,
            "bytes": data,
            "filename": _resolve_output_name(parsed, upload_name),
            "info": {
                "blocks": len(blocks),
                "tally": _tally(parsed),
                "font": _resolved_font(merged),
                "bytes": len(data),
                "seconds": round(time.time() - started, 1),
            },
        }
    except NotesError as exc:  # already plain English
        return {
            "ok": False,
            "message": str(exc),
            "detail": traceback.format_exc(),
        }
    except Exception as exc:  # surfaced to the UI, never swallowed
        return {
            "ok": False,
            "message": "%s: %s" % (type(exc).__name__, exc),
            "detail": traceback.format_exc(),
        }
    finally:
        _progress_cb = None
