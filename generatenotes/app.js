/* UI + worker orchestration. No framework, no build step. */

const $ = (id) => document.getElementById(id);

const STATES = {
  boot: $('state-boot'),
  idle: $('state-idle'),
  render: $('state-render'),
  done: $('state-done'),
  error: $('state-error'),
};

const STORAGE_KEY = 'sla_notes_options';
const EXAMPLE_FILE = 'examples/Ch3_Atmosphere_Summary.md';

const OPTIONS = [
  { id: 'opt-font', key: 'font_family', type: 'select' },
  { id: 'opt-size', key: 'page_size', type: 'select' },
  { id: 'opt-ruled', key: 'ruled_pages', type: 'check' },
  { id: 'opt-cover', key: 'cover_page', type: 'check' },
  { id: 'opt-contents', key: 'contents_page', type: 'check' },
];

let worker = null;
let ready = false;
let jobId = 0;
let activeJob = null;
let objectUrl = null;
let timerHandle = null;
let startedAt = 0;
let logLines = [];

/* ---------------------------------------------------------------- states */

function show(name) {
  Object.entries(STATES).forEach(([key, el]) => {
    el.hidden = key !== name;
  });
}

function releaseUrl() {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
}

/* --------------------------------------------------------------- options */

function loadOptions() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch (err) {
    saved = {};
  }
  OPTIONS.forEach((opt) => {
    const el = $(opt.id);
    if (!el || !(opt.key in saved)) return;
    if (opt.type === 'check') el.checked = Boolean(saved[opt.key]);
    else el.value = String(saved[opt.key]);
  });
}

function readOptions() {
  const out = {};
  OPTIONS.forEach((opt) => {
    const el = $(opt.id);
    if (!el) return;
    out[opt.key] = opt.type === 'check' ? el.checked : el.value;
  });
  return out;
}

function saveOptions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(readOptions()));
  } catch (err) {
    /* private mode — options just won't persist */
  }
}

/* ----------------------------------------------------------------- error */

function showError(message, detail) {
  stopTimer();
  activeJob = null;
  $('error-msg').textContent = message;
  const hasDetail = Boolean(detail && detail.trim());
  $('error-details').hidden = !hasDetail;
  $('error-detail').textContent = detail || '';
  show('error');
}

function showInlineError(message) {
  const el = $('idle-error');
  el.textContent = message;
  el.hidden = false;
}

function clearInlineError() {
  $('idle-error').hidden = true;
}

/* ----------------------------------------------------------------- timer */

function startTimer() {
  startedAt = Date.now();
  $('render-timer').textContent = '0s';
  timerHandle = setInterval(() => {
    const secs = Math.floor((Date.now() - startedAt) / 1000);
    $('render-timer').textContent = secs + 's';
  }, 1000);
}

function stopTimer() {
  if (timerHandle) {
    clearInterval(timerHandle);
    timerHandle = null;
  }
}

/* ------------------------------------------------------------------- log */

function appendLog(line) {
  logLines.push(line);
  if (logLines.length > 500) logLines = logLines.slice(-500);
  const text = logLines.join('\n');
  $('log-body').textContent = text;
  $('log-body-done').textContent = text;
  const pre = $('log-body');
  pre.scrollTop = pre.scrollHeight;
}

/* ---------------------------------------------------------------- worker */

function bootWorker() {
  try {
    worker = new Worker('worker.js');
  } catch (err) {
    showError(
      'This browser could not start a Web Worker, which the generator needs. Try a current version of Chrome, Firefox, Edge or Safari.',
      String(err)
    );
    return;
  }

  worker.onerror = (err) => {
    showError(
      'The rendering engine crashed unexpectedly. Reload the page to try again.',
      String((err && err.message) || err)
    );
  };

  worker.onmessage = (event) => handleMessage(event.data || {});
  worker.postMessage({ type: 'init' });
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'boot':
      $('boot-stage').textContent = msg.stage + '…';
      $('boot-bar').style.width = (msg.pct || 0) + '%';
      break;

    case 'ready':
      ready = true;
      $('drop').classList.remove('is-disabled');
      $('btn-example').disabled = false;
      warnAboutFonts(msg.missingFonts || []);
      show('idle');
      break;

    case 'log':
      appendLog(msg.line);
      break;

    case 'progress':
      if (msg.id !== activeJob) break;
      updateProgress(msg.pages);
      break;

    case 'done':
      if (msg.id !== activeJob) break;
      finish(msg);
      break;

    case 'error':
      if (msg.id !== null && msg.id !== activeJob) break;
      showError(msg.message, msg.detail);
      break;
  }
}

function warnAboutFonts(missing) {
  if (!missing.length) return;
  const el = $('font-warning');
  el.textContent =
    `Could not load ${missing.join(', ')}. The PDF will still render, but text in the affected style will fall back to a basic font and look noticeably worse.`;
  el.hidden = false;
}

/* ---------------------------------------------------------------- render */

/* build_pdf renders the body twice when a contents page is requested: once
   into a throwaway "probe" Book to discover real page numbers, then again for
   real. The page count therefore climbs, resets, and climbs again — so label
   the first pass instead of letting the counter look like it broke. */
let lastPages = 0;
let pass = 1;
let twoPass = false;

function updateProgress(pages) {
  if (pages < lastPages) pass += 1;
  lastPages = pages;

  const label = pages === 1 ? 'Page 1' : `Page ${pages}`;
  $('render-counter').textContent =
    twoPass && pass === 1 ? `${label} measured…` : `${label} rendered…`;
}

function startRender(mdText, filename) {
  if (!ready) return;

  if (!mdText.trim()) {
    showInlineError('That file is empty.');
    return;
  }

  clearInlineError();
  releaseUrl();
  logLines = [];
  appendLog(`Rendering ${filename}…`);

  const overrides = readOptions();
  lastPages = 0;
  pass = 1;
  twoPass = Boolean(overrides.contents_page);

  activeJob = ++jobId;
  $('render-file').textContent = filename;
  $('render-counter').textContent = 'Starting the renderer…';
  show('render');
  startTimer();

  worker.postMessage({
    type: 'render',
    id: activeJob,
    mdText,
    filename,
    overrides,
  });
}

function toObject(value) {
  if (value instanceof Map) return Object.fromEntries(value);
  return value || {};
}

function finish(msg) {
  stopTimer();
  activeJob = null;

  const blob = new Blob([msg.bytes], { type: 'application/pdf' });
  objectUrl = URL.createObjectURL(blob);

  const link = $('download-link');
  link.href = objectUrl;
  link.download = msg.filename || 'Board_Exam_Notes.pdf';

  const info = toObject(msg.info);
  const tally = toObject(info.tally);
  const chips = [];

  if (info.blocks) chips.push(['Blocks', info.blocks]);
  const kinds = Object.entries(tally)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([kind, n]) => `${n} ${kind}`)
    .join(', ');
  if (kinds) chips.push(['Content', kinds]);
  if (info.font) chips.push(['Font', info.font]);
  if (info.bytes) chips.push(['Size', (info.bytes / 1048576).toFixed(2) + ' MB']);
  if (info.seconds) chips.push(['Took', info.seconds + 's']);

  $('done-summary').innerHTML = chips
    .map(([label, value]) => `<span class="chip"><strong>${label}:</strong> ${escapeHtml(String(value))}</span>`)
    .join('');

  // A browser with no built-in PDF viewer renders the iframe as a blank box
  // and fires no error, so ask it up front rather than waiting for a failure
  // that never arrives. `undefined` means an older browser — try anyway.
  const frame = $('preview');
  const fallback = $('preview-fallback');
  const canPreview = navigator.pdfViewerEnabled !== false;

  if (canPreview) {
    frame.hidden = false;
    fallback.hidden = true;
    frame.src = objectUrl;
    frame.onerror = () => {
      frame.hidden = true;
      frame.removeAttribute('src');
      fallback.hidden = false;
    };
  } else {
    frame.hidden = true;
    frame.removeAttribute('src');
    fallback.hidden = false;
  }

  show('done');
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

/* ------------------------------------------------------------------ file */

async function acceptFile(file) {
  if (!file) return;

  if (!/\.md$/i.test(file.name)) {
    showInlineError(`"${file.name}" isn't a markdown file. Choose a file ending in .md.`);
    return;
  }

  try {
    const text = await file.text();
    startRender(text, file.name);
  } catch (err) {
    showInlineError('That file could not be read. It may not be UTF-8 text.');
  }
}

async function loadExample() {
  clearInlineError();
  try {
    const res = await fetch(EXAMPLE_FILE);
    if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
    const text = await res.text();
    startRender(text, EXAMPLE_FILE.split('/').pop());
  } catch (err) {
    showInlineError('The example file could not be loaded (' + err.message + ').');
  }
}

function reset() {
  releaseUrl();
  const frame = $('preview');
  frame.removeAttribute('src');
  $('file-input').value = '';
  clearInlineError();
  show('idle');
}

/* ---------------------------------------------------------- copy prompt */

function legacyCopy(text) {
  // navigator.clipboard needs a secure context; this covers the rest.
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();

  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (err) {
    ok = false;
  }
  document.body.removeChild(area);
  return ok;
}

async function copyPrompt() {
  const btn = $('btn-copy-prompt');
  const text = $('prompt-text').textContent;

  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch (err) {
    ok = legacyCopy(text);
  }

  if (!ok) {
    // Nothing worked — select it so the user can copy by hand.
    const range = document.createRange();
    range.selectNodeContents($('prompt-text'));
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  btn.textContent = ok ? 'Copied' : 'Press Ctrl+C';
  btn.classList.toggle('is-done', ok);

  setTimeout(() => {
    btn.textContent = 'Copy';
    btn.classList.remove('is-done');
  }, 2000);
}

/* ------------------------------------------------------------------ wire */

function wire() {
  const drop = $('drop');
  const input = $('file-input');

  drop.classList.add('is-disabled');
  $('btn-example').disabled = true;

  drop.addEventListener('click', () => input.click());
  drop.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input.click();
    }
  });

  input.addEventListener('change', () => acceptFile(input.files[0]));

  ['dragenter', 'dragover'].forEach((name) => {
    drop.addEventListener(name, (event) => {
      event.preventDefault();
      drop.classList.add('is-over');
    });
  });

  ['dragleave', 'drop'].forEach((name) => {
    drop.addEventListener(name, (event) => {
      event.preventDefault();
      drop.classList.remove('is-over');
    });
  });

  drop.addEventListener('drop', (event) => {
    const file = event.dataTransfer && event.dataTransfer.files[0];
    acceptFile(file);
  });

  // The page itself must not navigate away if a file misses the drop zone.
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  $('btn-example').addEventListener('click', loadExample);
  $('btn-copy-prompt').addEventListener('click', copyPrompt);
  $('btn-reset').addEventListener('click', reset);
  $('btn-error-reset').addEventListener('click', reset);

  OPTIONS.forEach((opt) => {
    const el = $(opt.id);
    if (el) el.addEventListener('change', saveOptions);
  });

  window.addEventListener('pagehide', releaseUrl);
}

loadOptions();
wire();
bootWorker(); // eagerly, in parallel with the visitor reading the page
