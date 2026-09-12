/* Pyodide host. Everything Python happens here, never on the main thread. */

// Pinned deliberately: a floating "latest" URL changes the bundled CPython
// version underneath us and can break the renderer with no code change here.
const PYODIDE_VERSION = '0.26.4';
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

const FONT_FILES = [
  'handwriting_r.ttf',
  'handwriting_b.ttf',
  'print_r.ttf',
  'print_b.ttf',
];

let pyodide = null;
let runner = null;
let booting = false;
const missingFonts = [];

function post(msg, transfer) {
  self.postMessage(msg, transfer || []);
}

function boot(stage, pct) {
  post({ type: 'boot', stage, pct });
}

function log(line) {
  if (line === undefined || line === null) return;
  const text = String(line);
  if (!text.trim()) return;
  post({ type: 'log', line: text });
}

async function fetchBinary(url) {
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function fetchText(url) {
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}

function mkdirSafe(path) {
  try {
    pyodide.FS.mkdir(path);
  } catch (err) {
    // EEXIST on a warm reload is fine; anything else is real.
    if (!/exist/i.test(String(err))) throw err;
  }
}

async function init() {
  if (pyodide || booting) return;
  booting = true;

  try {
    boot('Downloading the Python engine', 5);
    importScripts(PYODIDE_BASE + 'pyodide.js');

    boot('Starting Python', 20);
    pyodide = await loadPyodide({
      indexURL: PYODIDE_BASE,
      stdout: log,
      stderr: log,
    });

    boot('Loading Pillow', 55);
    await pyodide.loadPackage('Pillow');

    boot('Loading fonts', 75);
    mkdirSafe('/fonts');
    mkdirSafe('/work');

    for (const name of FONT_FILES) {
      try {
        const bytes = await fetchBinary(`fonts/${name}`);
        pyodide.FS.writeFile(`/fonts/${name}`, bytes); // binary: Uint8Array
      } catch (err) {
        missingFonts.push(name);
        log(`WARNING: font ${name} failed to load (${err.message}).`);
      }
    }

    boot('Loading the renderer', 90);
    mkdirSafe('/app');
    for (const name of ['generate_notes_pdf.py', 'runner.py']) {
      const source = await fetchText(name);
      pyodide.FS.writeFile(`/app/${name}`, source, { encoding: 'utf8' });
    }

    await pyodide.runPythonAsync(`
import sys
if "/app" not in sys.path:
    sys.path.insert(0, "/app")
`);

    runner = pyodide.pyimport('runner');

    boot('Ready', 100);
    post({ type: 'ready', missingFonts });
  } catch (err) {
    booting = false;
    post({
      type: 'error',
      id: null,
      message: bootMessage(err),
      detail: String(err && err.stack ? err.stack : err),
    });
  }
}

function bootMessage(err) {
  const text = String(err && err.message ? err.message : err);
  if (/fetch|network|failed to load|importScripts/i.test(text)) {
    return 'Could not download the Python engine. Check your connection — a corporate proxy or blocker may be stopping the CDN (cdn.jsdelivr.net).';
  }
  if (/Pillow|package/i.test(text)) {
    return 'The Python engine started but Pillow (the image library) failed to load. Reload the page to try again.';
  }
  return 'The Python engine failed to start: ' + text;
}

function renderMessage(message) {
  if (/no ## sections/i.test(message)) {
    return message;
  }
  if (/memory|allocation|RangeError|out of memory/i.test(message)) {
    return 'The browser tab ran out of memory rendering this file. Every page is held as a full-size bitmap, so very long chapters can exhaust the tab — try splitting the markdown into smaller files.';
  }
  if (/FileNotFound|No such file/i.test(message)) {
    return 'The renderer looked for a file that is not there: ' + message;
  }
  return message;
}

async function render(job) {
  const { id, mdText, filename, overrides } = job;

  if (!runner) {
    post({
      type: 'error',
      id,
      message: 'The Python engine is not ready yet.',
      detail: '',
    });
    return;
  }

  const payload = Object.assign({}, overrides, { __filename: filename || '' });

  // Passed straight through: Pyodide wraps a plain JS function in a Python-side
  // JsProxy automatically, and that side is garbage-collected normally. The
  // proxy that does leak is the PyProxy coming back out of generate(), so every
  // one of those is destroyed in the finally block below.
  const onProgress = (pages) => {
    post({ type: 'progress', id, pages: Number(pages) });
  };

  let result = null;
  try {
    result = runner.generate(mdText, JSON.stringify(payload), onProgress);
    const ok = result.get('ok');

    if (!ok) {
      post({
        type: 'error',
        id,
        message: renderMessage(String(result.get('message'))),
        detail: String(result.get('detail') || ''),
      });
      return;
    }

    const bytesPy = result.get('bytes');
    const bytes = bytesPy.toJs ? bytesPy.toJs() : bytesPy;
    if (bytesPy.destroy) bytesPy.destroy();

    // dict_converter gives plain nested objects. Without it toJs() yields Maps
    // (and can leave PyProxies inside), which structured-clone rejects.
    const infoPy = result.get('info');
    const info = infoPy.toJs
      ? infoPy.toJs({ dict_converter: Object.fromEntries })
      : infoPy;
    if (infoPy.destroy) infoPy.destroy();

    const outName = String(result.get('filename'));
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

    post({ type: 'done', id, bytes: buffer, filename: outName, info }, [buffer]);
  } catch (err) {
    post({
      type: 'error',
      id,
      message: renderMessage(String(err && err.message ? err.message : err)),
      detail: String(err && err.stack ? err.stack : err),
    });
  } finally {
    if (result && result.destroy) result.destroy();
  }
}

self.onmessage = (event) => {
  const data = event.data || {};
  if (data.type === 'init') init();
  else if (data.type === 'render') render(data);
};
