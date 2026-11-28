/**
 * Free-registration popup (2026-11-28). Loaded on demand by script.js initLeadForm() in free mode only.
 * Collects Student/Parent, name, WhatsApp number, optional email and class, posts it to the Google Sheet
 * web app (data.json leadForm.endpoint, google-apps-script-leads.js), then opens the clicked button's link
 * (the thank-you page, which counts the Google Ads conversion). Wording and class choices come from data.json leadForm.
 * Never blocks a sign-up: if saving fails or takes longer than leadForm.timeoutMs, the visitor still moves on.
 */
(function () {
    'use strict';

    var TRACK_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'gbraid', 'wbraid'];
    var STORE_KEY = 'sla_lead_tracking';
    var state = { root: null, lastFocus: null, target: '', busy: false };

    // ---------- pure helpers (tested) ----------

    /** "+91 98765-43210", "098765 43210", "9876543210" -> "9876543210"; anything else -> "". Same rule as the Apps Script. */
    function normalizePhone(v) {
        var d = String(v || '').replace(/\D/g, '');
        if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2);
        if (d.length === 11 && d.charAt(0) === '0') d = d.slice(1);
        return /^[6-9]\d{9}$/.test(d) ? d : '';
    }

    function isEmail(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
    }

    /** Returns { field: errorKey } for every problem; empty object = valid. */
    function validate(values, set) {
        var err = {};
        if (set.who && !values.who) err.who = 'errWho';
        if (!String(values.name || '').trim()) err.name = 'errName';
        if (!normalizePhone(values.phone)) err.phone = 'errPhone';
        if (String(values.email || '').trim() && !isEmail(values.email)) err.email = 'errEmail';
        if (!values.klass) err.klass = 'errClass';
        return err;
    }

    /** Page language -> copy key: hi (Devanagari), hinglish (hi-Latn), en (everything else). */
    function pickLang(lang) {
        lang = String(lang || '').toLowerCase();
        if (lang === 'hi') return 'hi';
        if (lang.indexOf('hi') === 0) return 'hinglish';
        return 'en';
    }

    function pickSet(cfg, name) {
        var sets = (cfg && cfg.sets) || {};
        return sets[name] || sets.all || { who: true, whoDefault: '', classes: ['Other'] };
    }

    /** First-touch ad parameters: kept for the visit so they survive moving between pages. */
    function collectTracking(search) {
        var saved = {};
        try { saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || '{}') || {}; } catch (e) { saved = {}; }
        var params;
        try { params = new URLSearchParams(search || ''); } catch (e) { params = null; }
        var fresh = {};
        TRACK_KEYS.forEach(function (k) { var v = params && params.get(k); if (v) fresh[k] = v.slice(0, 200); });
        var out = Object.keys(fresh).length ? fresh : saved;
        try { sessionStorage.setItem(STORE_KEY, JSON.stringify(out)); } catch (e) { /* storage off */ }
        return out;
    }

    // ---------- UI ----------

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text) n.textContent = text;
        return n;
    }

    function copyFor(cfg) {
        var all = (cfg && cfg.copy) || {};
        var k = pickLang(document.documentElement.getAttribute('lang'));
        var c = all[k] || all.en || {};
        var base = all.en || {};
        return function (key) { return c[key] !== undefined ? c[key] : (base[key] !== undefined ? base[key] : key); };
    }

    function build(cfg) {
        var t = copyFor(cfg);
        var set = pickSet(cfg, document.documentElement.getAttribute('data-lead-form') || 'all');
        var names = (t('classNames') && typeof t('classNames') === 'object') ? t('classNames') : {};
        var root = el('div', 'slaf');
        root.setAttribute('hidden', '');
        root.innerHTML = '';
        var back = el('div', 'slaf-back');
        back.setAttribute('data-slaf-close', '');
        var panel = el('div', 'slaf-panel');
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-labelledby', 'slaf-title');
        panel.setAttribute('aria-describedby', 'slaf-sub');

        var x = el('button', 'slaf-x');
        x.type = 'button';
        x.setAttribute('aria-label', t('close'));
        x.setAttribute('data-slaf-close', '');
        x.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
        panel.appendChild(x);

        var head = el('div', 'slaf-head');
        head.appendChild(el('p', 'slaf-chip', t('chip')));
        var h = el('h2', 'slaf-title', t('title')); h.id = 'slaf-title';
        head.appendChild(h);
        var sub = el('p', 'slaf-sub', t('sub')); sub.id = 'slaf-sub';
        head.appendChild(sub);
        panel.appendChild(head);

        var form = el('form', 'slaf-form');
        form.noValidate = true;
        form.setAttribute('autocomplete', 'on');

        // Who is filling this?
        if (set.who) {
            var fsWho = el('fieldset', 'slaf-field slaf-who');
            fsWho.setAttribute('data-field', 'who');
            fsWho.appendChild(el('legend', 'slaf-label', t('whoLabel')));
            var seg = el('div', 'slaf-seg');
            [['Student', t('student'), '🎒'], ['Parent', t('parent'), '👪']].forEach(function (o) {
                var lab = el('label', 'slaf-seg-opt');
                var inp = el('input');
                inp.type = 'radio'; inp.name = 'who'; inp.value = o[0];
                if (set.whoDefault === o[0]) inp.checked = true;
                var face = el('span', 'slaf-seg-face');
                face.appendChild(el('span', 'slaf-emoji', o[2]));
                face.appendChild(document.createTextNode(o[1]));
                lab.appendChild(inp); lab.appendChild(face);
                seg.appendChild(lab);
            });
            fsWho.appendChild(seg);
            fsWho.appendChild(errNode('who'));
            form.appendChild(fsWho);
        }

        form.appendChild(textField('name', t('nameLabel'), '', { type: 'text', autocomplete: 'name', placeholder: t('namePh'), maxLength: 80, required: true }));
        var phone = textField('phone', t('phoneLabel'), '', { type: 'tel', autocomplete: 'tel-national', inputMode: 'numeric', placeholder: t('phonePh'), maxLength: 16, required: true }, '+91');
        phone.appendChild(el('p', 'slaf-help', t('phoneHelp')));
        form.appendChild(phone);
        form.appendChild(textField('email', t('emailLabel'), t('optional'), { type: 'email', autocomplete: 'email', placeholder: t('emailPh'), maxLength: 120 }));

        // Class chips
        var fsClass = el('fieldset', 'slaf-field');
        fsClass.setAttribute('data-field', 'klass');
        var classLegend = el('legend', 'slaf-label');
        classLegend.setAttribute('data-slaf-class-label', '');
        fsClass.appendChild(classLegend);
        var chips = el('div', 'slaf-chips');
        (set.classes || []).forEach(function (c) {
            var lab = el('label', 'slaf-chip-opt');
            var inp = el('input');
            inp.type = 'radio'; inp.name = 'klass'; inp.value = c;
            lab.appendChild(inp);
            lab.appendChild(el('span', '', names[c] || c));
            chips.appendChild(lab);
        });
        fsClass.appendChild(chips);
        fsClass.appendChild(errNode('klass'));
        form.appendChild(fsClass);

        var minor = el('p', 'slaf-minor', t('minorNote'));
        minor.setAttribute('hidden', '');
        form.appendChild(minor);

        // Hidden trap field: people never see it, form-filling bots do.
        var trap = el('input', 'slaf-trap');
        trap.type = 'text'; trap.name = 'website'; trap.tabIndex = -1; trap.setAttribute('autocomplete', 'off'); trap.setAttribute('aria-hidden', 'true');
        form.appendChild(trap);

        var btn = el('button', 'slaf-submit', t('submit'));
        btn.type = 'submit';
        form.appendChild(btn);
        var status = el('p', 'slaf-status');
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        form.appendChild(status);

        var priv = el('p', 'slaf-privacy');
        priv.appendChild(document.createTextNode(t('privacy') + ' '));
        var pl = el('a', '', t('privacyLink'));
        pl.href = (document.documentElement.getAttribute('data-root') || '') + 'privacy-policy.html';
        pl.target = '_blank'; pl.rel = 'noopener';
        priv.appendChild(pl);
        form.appendChild(priv);

        panel.appendChild(form);
        root.appendChild(back);
        root.appendChild(panel);
        document.body.appendChild(root);

        function syncWho() {
            var who = whoValue(form, set);
            classLegend.textContent = !set.who ? t('classLabelPro') : (who === 'Parent' ? t('classLabelParent') : t('classLabel'));
            if (who === 'Student') minor.removeAttribute('hidden'); else minor.setAttribute('hidden', '');
        }
        syncWho();
        form.addEventListener('change', function (e) {
            if (e.target && e.target.name === 'who') syncWho();
            if (e.target && e.target.name) clearErr(form, e.target.name);
        });
        form.addEventListener('input', function (e) { if (e.target && e.target.name) clearErr(form, e.target.name); });
        form.addEventListener('submit', function (e) { e.preventDefault(); submit(cfg, set, form, t); });
        root.addEventListener('click', function (e) { if (e.target.closest('[data-slaf-close]')) close(); });
        root.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { close(); return; }
            if (e.key === 'Tab') trapFocus(e, panel);
        });

        function textField(name, label, hint, attrs, prefix) {
            var wrap = el('div', 'slaf-field');
            wrap.setAttribute('data-field', name);
            var lab = el('label', 'slaf-label', label);
            lab.htmlFor = 'slaf-' + name;
            if (hint) lab.appendChild(el('span', 'slaf-opt', ' (' + hint + ')'));
            wrap.appendChild(lab);
            var box = el('div', 'slaf-box' + (prefix ? ' slaf-has-prefix' : ''));
            if (prefix) box.appendChild(el('span', 'slaf-prefix', prefix));
            var inp = el('input', 'slaf-input');
            inp.id = 'slaf-' + name; inp.name = name;
            Object.keys(attrs).forEach(function (k) {
                if (k === 'inputMode') inp.setAttribute('inputmode', attrs[k]);
                else if (k === 'maxLength') inp.maxLength = attrs[k];
                else if (k === 'required') { if (attrs[k]) inp.setAttribute('aria-required', 'true'); }
                else inp.setAttribute(k, attrs[k]);
            });
            inp.setAttribute('aria-describedby', 'slaf-err-' + name);
            box.appendChild(inp);
            wrap.appendChild(box);
            wrap.appendChild(errNode(name));
            return wrap;
        }
        return root;
    }

    function errNode(name) {
        var p = el('p', 'slaf-err');
        p.id = 'slaf-err-' + name;
        return p;
    }

    function whoValue(form, set) {
        if (!set.who) return set.whoDefault || '';
        var c = form.querySelector('input[name="who"]:checked');
        return c ? c.value : '';
    }

    function clearErr(form, name) {
        var f = form.querySelector('[data-field="' + name + '"]');
        if (!f) return;
        f.classList.remove('is-bad');
        var p = f.querySelector('.slaf-err');
        if (p) p.textContent = '';
        var i = f.querySelector('input.slaf-input');
        if (i) i.removeAttribute('aria-invalid');
    }

    function showErrors(form, errors, t) {
        var first = null;
        Object.keys(errors).forEach(function (name) {
            var f = form.querySelector('[data-field="' + name + '"]');
            if (!f) return;
            f.classList.add('is-bad');
            var p = f.querySelector('.slaf-err');
            if (p) p.textContent = t(errors[name]);
            var i = f.querySelector('input.slaf-input') || f.querySelector('input');
            if (i && i.classList.contains('slaf-input')) i.setAttribute('aria-invalid', 'true');
            if (!first) first = i;
        });
        if (first) first.focus();
    }

    function trapFocus(e, panel) {
        var items = Array.prototype.filter.call(
            panel.querySelectorAll('button, a[href], input:not([type="hidden"]):not(.slaf-trap), select, textarea'),
            function (n) { return !n.disabled && n.offsetParent !== null; });
        if (!items.length) return;
        var first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    function gtagEvent(name, params) {
        try { if (typeof window.gtag === 'function') window.gtag('event', name, params || {}); } catch (e) { /* analytics never breaks the form */ }
    }

    function newId() {
        return 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    /** Sends the registration. Resolves when it was handed over (or failed); never rejects. */
    function send(endpoint, payload) {
        var body = JSON.stringify(payload);
        // text/plain + no-cors = a "simple" request: no CORS pre-flight, which Apps Script can't answer.
        // keepalive lets it finish even if the page moves on after the timeout.
        if (typeof fetch === 'function') {
            return fetch(endpoint, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body })
                .then(function () { return true; })
                .catch(function () {
                    try { return navigator.sendBeacon(endpoint, new Blob([body], { type: 'text/plain;charset=utf-8' })); } catch (e) { return false; }
                });
        }
        try { return Promise.resolve(navigator.sendBeacon(endpoint, new Blob([body], { type: 'text/plain;charset=utf-8' }))); } catch (e) { return Promise.resolve(false); }
    }

    function submit(cfg, set, form, t) {
        if (state.busy) return;
        var get = function (n) { var i = form.querySelector('[name="' + n + '"]'); return i ? i.value : ''; };
        var klass = form.querySelector('input[name="klass"]:checked');
        var values = { who: whoValue(form, set), name: get('name').trim(), phone: get('phone'), email: get('email').trim(), klass: klass ? klass.value : '' };
        var errors = validate(values, set);
        if (Object.keys(errors).length) { showErrors(form, errors, t); return; }

        var btn = form.querySelector('.slaf-submit');
        var status = form.querySelector('.slaf-status');
        var preview = !cfg.endpoint;
        state.busy = true;
        btn.disabled = true;
        btn.textContent = t('saving');

        var payload = {
            who: values.who, name: values.name, phone: normalizePhone(values.phone), email: values.email, klass: values.klass,
            website: get('website'),
            page: location.pathname, lang: document.documentElement.getAttribute('lang') || '',
            referrer: (document.referrer || '').slice(0, 200),
            device: window.matchMedia && window.matchMedia('(max-width: 760px)').matches ? 'mobile' : 'desktop',
            leadId: newId()
        };
        var tr = collectTracking(location.search);
        Object.keys(tr).forEach(function (k) { payload[k] = tr[k]; });

        if (preview) {
            btn.textContent = t('submit');
            btn.disabled = false;
            state.busy = false;
            status.textContent = t('previewDone');
            return;
        }

        var timeout = new Promise(function (res) { setTimeout(res, Number(cfg.timeoutMs) || 8000); });
        Promise.race([send(cfg.endpoint, payload), timeout]).then(function () {
            gtagEvent('sign_up', { method: 'lead_form', who: values.who || '', class_name: values.klass });
            try { sessionStorage.setItem('sla_lead_name', values.name.split(' ')[0]); } catch (e) { /* storage off */ }
            btn.textContent = t('done');
            status.textContent = t('done');
            window.location.href = state.target;
        });
    }

    function open(target) {
        var data = window.SLA_DATA || {};
        var cfg = data.leadForm || {};
        if (!state.root) state.root = build(cfg);
        state.target = target || (data.freeSignup && data.freeSignup.link) || 'thank-you.html';
        state.lastFocus = document.activeElement;
        state.root.removeAttribute('hidden');
        document.documentElement.classList.add('slaf-open');
        gtagEvent('lead_form_open', { page: location.pathname });
        var whoFirst = state.root.querySelector('input[name="who"]');
        var first = whoFirst && !state.root.querySelector('input[name="who"]:checked') ? whoFirst : state.root.querySelector('#slaf-name');
        setTimeout(function () { if (first) first.focus(); }, 30);
    }

    function close() {
        if (!state.root || state.busy) return;
        state.root.setAttribute('hidden', '');
        document.documentElement.classList.remove('slaf-open');
        if (state.lastFocus && state.lastFocus.focus) state.lastFocus.focus();
    }

    window.SLALeadForm = {
        open: open,
        close: close,
        normalizePhone: normalizePhone,
        isEmail: isEmail,
        validate: validate,
        pickLang: pickLang,
        pickSet: pickSet,
        collectTracking: collectTracking
    };
    document.dispatchEvent(new Event('slaf:ready'));
})();
