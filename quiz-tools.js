/* ==========================================================================
   Super Learner Academy — brain-training tools
   Loaded lazily by quiz.js the first time a #/tools/<id> route is opened, so
   none of this costs anything on the home page or during a quiz.

   Each tool is a function (host, ctx) that renders into `host` and returns a
   cleanup function. Cleanup MUST stop timers, animation frames, audio and
   document-level listeners - the router calls it on every navigation.

   The three libraries with no native equivalent (pdf.js, epub.js, jsPDF) are
   pulled from cdnjs on demand, inside the one tool that needs them.
   ========================================================================== */
(function () {
    'use strict';

    // =====================================================================
    // Shared helpers
    // =====================================================================

    var h, svgEl, go;

    function card(children) { return h('div', { class: 'tool-card' }, children); }

    function head(title, subtitle) {
        return h('div', { class: 'tool-head' }, [
            h('h1', { text: title }),
            subtitle ? h('p', { text: subtitle }) : null
        ]);
    }

    function backBar() {
        return h('div', { class: 'result-actions', style: 'padding-bottom:0' }, [
            h('button', { class: 'tool-btn tool-btn-ghost', onclick: function () { go('#/'); }, text: '← Back to Home' })
        ]);
    }

    function field(label, control) {
        return h('div', { class: 'tool-field' }, [h('label', { text: label }), control]);
    }

    function btn(label, onClick, opts) {
        opts = opts || {};
        return h('button', {
            class: 'tool-btn' + (opts.ghost ? ' tool-btn-ghost' : ''),
            onclick: onClick,
            disabled: opts.disabled,
            text: label
        });
    }

    function stat(value, label) {
        return h('div', { class: 'tool-stat' }, [
            h('div', { class: 'tool-stat-value', text: value }),
            h('div', { class: 'tool-stat-label', text: label })
        ]);
    }

    function mmss(totalSeconds) {
        var m = Math.floor(totalSeconds / 60);
        var s = totalSeconds % 60;
        return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    // Toggle-button group. Returns { el, value() }.
    function toggleGroup(options, initial, onChange) {
        var value = initial;
        var buttons = [];
        var wrap = h('div', { class: 'tool-controls', style: 'margin-bottom:0' }, options.map(function (o, i) {
            var b = h('button', {
                class: 'tool-btn' + (o.value === value ? '' : ' tool-btn-ghost'),
                text: o.label,
                onclick: function () {
                    value = o.value;
                    buttons.forEach(function (x, j) {
                        x.className = 'tool-btn' + (options[j].value === value ? '' : ' tool-btn-ghost');
                    });
                    if (onChange) onChange(value);
                }
            });
            buttons.push(b);
            return b;
        }));
        return { el: wrap, value: function () { return value; } };
    }

    // Load a script from cdnjs once, resolving with the global it defines.
    var cdnCache = {};
    function loadCDN(url, globalName) {
        if (cdnCache[url]) return cdnCache[url];
        cdnCache[url] = new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = url;
            s.onload = function () { resolve(globalName ? window[globalName] : null); };
            s.onerror = function () { reject(new Error('Could not load ' + url)); };
            document.head.appendChild(s);
        });
        return cdnCache[url];
    }

    // Fullscreen toggle wired to one element, with its own listener cleanup.
    function fullscreenControl(target) {
        var button = h('button', { class: 'tool-btn tool-btn-ghost', text: '⛶ Fullscreen' });

        function sync() {
            button.textContent = document.fullscreenElement ? '⊡ Exit Fullscreen' : '⛶ Fullscreen';
        }

        button.addEventListener('click', function () {
            if (!document.fullscreenElement) {
                if (target.requestFullscreen) target.requestFullscreen().catch(function () { });
            } else {
                document.exitFullscreen().catch(function () { });
            }
        });

        document.addEventListener('fullscreenchange', sync);

        return {
            el: button,
            destroy: function () {
                document.removeEventListener('fullscreenchange', sync);
                if (document.fullscreenElement) document.exitFullscreen().catch(function () { });
            }
        };
    }

    // Canvas tools degrade to a message rather than throwing if a 2D context
    // is unavailable (very old browsers, canvas disabled, headless DOMs).
    function canvasUnsupported(host, title, subtitle) {
        host.appendChild(card([
            head(title, subtitle),
            h('p', { class: 'tool-note', text: 'This exercise needs canvas graphics, which your browser has not made available. Try a different browser or re-enable canvas.' })
        ]));
        host.appendChild(backBar());
        return function () { };
    }

    // A simple audio-track list shared by the "Reset Your Brain" and NLP tools.
    function audioTrackList(tracks) {
        var audio = h('audio', { class: 'tool-audio', controls: 'controls', preload: 'none' });
        var items = [];
        var active = -1;

        function select(i) {
            active = i;
            items.forEach(function (el, j) {
                el.className = 'track-item' + (j === i ? ' is-active' : '');
            });
            audio.src = tracks[i].src;
            audio.play().catch(function () { /* autoplay blocked - controls still work */ });
        }

        var list = h('ul', { class: 'track-list' }, tracks.map(function (t, i) {
            var el = h('li', {
                class: 'track-item',
                tabindex: '0',
                role: 'button',
                onclick: function () { select(i); },
                onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i); } }
            }, [
                h('span', { class: 'track-emoji', text: t.icon }),
                h('div', {}, [
                    h('div', { class: 'track-name', text: t.title }),
                    h('div', { class: 'track-desc', text: t.description })
                ])
            ]);
            items.push(el);
            return el;
        }));

        return {
            el: h('div', {}, [list, audio]),
            destroy: function () { audio.pause(); audio.removeAttribute('src'); audio.load(); }
        };
    }

    // =====================================================================
    // Reset Your Brain (audio)
    // =====================================================================

    function audioTool(host) {
        var player = audioTrackList([
            {
                title: '852 Hz Reset The Mind', icon: '🧘',
                description: 'A frequency track to clear mental fog and restore clarity.',
                src: 'media/audio/852hz-reset-the-mind.mp3'
            },
            {
                title: 'This Sound Will Reset Your Brain', icon: '🧠',
                description: 'Deep reset audio to calm your nervous system and improve focus.',
                src: 'media/audio/reset-your-brain.mp3'
            }
        ]);

        host.appendChild(card([
            head('🎧 Reset Your Brain', 'Listen to these tracks to reset and recharge your mind'),
            player.el,
            h('p', { class: 'tool-note', text: 'Use headphones, sit comfortably, and let the track run to the end without multitasking.' })
        ]));
        host.appendChild(backBar());

        return player.destroy;
    }

    // =====================================================================
    // NLP: Positive Affirmation (audio + Bubble Exercise guide)
    // =====================================================================

    function nlpTool(host) {
        var player = audioTrackList([
            {
                title: 'A Ten Minute Guided Meditation', icon: '🧘',
                description: 'A calming guided meditation to center your mind and boost clarity.',
                src: 'media/audio/guided-meditation-10min.mp3'
            },
            {
                title: 'Rewire Your Brain with Neuroplasticity', icon: '🔄',
                description: 'Use neuroplasticity to reshape your thought patterns.',
                src: 'media/audio/rewire-your-brain.mp3'
            },
            {
                title: 'NLP Bubble Exercise', icon: '🫧',
                description: 'An NLP technique for transforming your self-image.',
                src: 'media/audio/nlp-bubble-exercise.mp3'
            }
        ]);

        var guide = h('div', { hidden: 'hidden' }, [
            h('h3', { class: 'result-subhead', text: '🫧 The Bubble Exercise — Step By Step' }),
            h('p', { class: 'result-text', text: 'For transforming your self-image, you will have to give up some behaviour and acquire some desirable behaviour. Here is how the Bubble Exercise works.' }),

            step('Step 1', ['Imagine that you are sitting comfortably inside a huge bubble (just like a soap bubble) that is friendly and likeable in every respect. You are feeling totally relaxed. There is a friendly window in this bubble and fresh cool air is coming in through it.']),

            step('Step 2', [
                "Now imagine that there is 'another you' standing on a huge platform outside this bubble.",
                "Think of all the changes and improvements you want to make in yourself. Create a movie in your imagination where all these changes are taking place in the life of the 'other you'.",
                "For example: if you feel fearful in a crowd, imagine the 'other you' is fearless and resourceful even in a big crowd. If you feel low and unenergetic, imagine the 'other you' is confident and creating real success."
            ]),

            step('Step 3', [
                "Give yourself the three 'VAK' NLP commands:",
                "👁️ SEE what the 'other you' would be seeing.",
                "👂 HEAR what the 'other you' would be hearing, and the compliments they receive.",
                "✋ FEEL what the 'other you' would be feeling — more confidence, higher energy, better health.",
                "Give yourself time to be comfortable with what you see, hear and feel. Create a strong, powerful image of the 'other you'."
            ]),

            step('Step 4', [
                "Let the movie complete. See your changed version — the 'other you' — walking towards you, both looking into each other's eyes.",
                "Start walking slowly towards the 'other you'. See them slowly enter your bubble. Embrace each other. With affection, both entities integrate into one 'you'.",
                "Both persons become one — you now carry all the attributes of the 'other you'."
            ]),

            h('div', { class: 'result-tip' }, [
                h('h4', { text: '✨ Results' }),
                h('p', { text: 'After finishing this exercise you will have a good feeling, and there is usually a marked improvement in your physiology. Improvements can be noticed almost immediately.' })
            ]),

            h('div', { class: 'result-tip' }, [
                h('h4', { text: '🔑 How to get the best results' }),
                h('ul', {}, [
                    h('li', { text: 'Do the exercise once a day for a minimum of 7 days for a lasting self-image change.' }),
                    h('li', { text: 'You must have an honest intention to transform your self-image.' }),
                    h('li', { text: 'Follow up with concrete action, consistently, in day-to-day living.' })
                ])
            ]),

            h('div', { class: 'result-tip' }, [
                h('h4', { text: '💡 Why it works' }),
                h('p', { text: "In ordinary visualization your conscious mind can object — \"you don't have that\". In the Bubble Exercise it cannot object, because it is 'the other you' who has achieved it, not you directly. That bypasses the resistance." })
            ])
        ]);

        function step(badge, paragraphs) {
            return h('div', { class: 'result-tip' }, [
                h('h4', { text: badge })
            ].concat(paragraphs.map(function (p) { return h('p', { text: p, style: 'margin-top:6px' }); })));
        }

        var toggle = btn('▼ Read the Bubble Exercise guide', function () {
            guide.hidden = !guide.hidden;
            toggle.textContent = guide.hidden ? '▼ Read the Bubble Exercise guide' : '▲ Hide the guide';
        }, { ghost: true });

        host.appendChild(card([
            head('🫧 NLP: Positive Affirmation', 'Transform your self-image with guided audio exercises'),
            player.el,
            h('div', { class: 'tool-controls', style: 'margin-top:18px' }, [toggle]),
            guide
        ]));
        host.appendChild(backBar());

        return player.destroy;
    }

    // =====================================================================
    // Mandala Meditation
    // =====================================================================

    var MANDALA_THEMES = [
        { name: 'Cosmic', colors: ['#6A3DE8', '#9B59B6', '#3498DB', '#1ABC9C', '#E74C3C'] },
        { name: 'Sunset', colors: ['#FF6B00', '#FFC107', '#E74C3C', '#FF8C00', '#FF1493'] },
        { name: 'Ocean', colors: ['#0077B6', '#00B4D8', '#90E0EF', '#48CAE4', '#023E8A'] },
        { name: 'Forest', colors: ['#2D6A4F', '#40916C', '#52B788', '#95D5B2', '#1B4332'] },
        { name: 'Aurora', colors: ['#7400B8', '#6930C3', '#5390D9', '#48BFE3', '#56CFE1'] },
        { name: 'Lotus', colors: ['#FF69B4', '#DA70D6', '#BA55D3', '#9370DB', '#8B008B'] }
    ];

    // Concentric rings of petals, circles and diamonds, redrawn on theme change.
    function buildMandala(colors) {
        var root = svgEl('svg', { viewBox: '0 0 400 400', class: 'mandala-spinner', 'aria-hidden': 'true' });
        var i;

        for (i = 0; i < 12; i++) {
            root.appendChild(svgEl('ellipse', {
                cx: 200, cy: 200, rx: 180, ry: 60, fill: 'none',
                stroke: colors[0], 'stroke-width': 2, opacity: 0.6,
                transform: 'rotate(' + (i * 30) + ' 200 200)'
            }));
        }
        for (i = 0; i < 16; i++) {
            root.appendChild(svgEl('circle', {
                cx: 200 + 120 * Math.cos(i * Math.PI / 8),
                cy: 200 + 120 * Math.sin(i * Math.PI / 8),
                r: 8, fill: colors[2], opacity: 0.5
            }));
        }
        for (i = 0; i < 6; i++) {
            root.appendChild(svgEl('polygon', {
                points: '200,80 ' + (200 + 40 * Math.cos(i * Math.PI / 3)) + ',' + (200 + 40 * Math.sin(i * Math.PI / 3)) +
                    ' 200,320 ' + (200 - 40 * Math.cos(i * Math.PI / 3)) + ',' + (200 - 40 * Math.sin(i * Math.PI / 3)),
                fill: 'none', stroke: colors[3], 'stroke-width': 1.5, opacity: 0.6,
                transform: 'rotate(' + (i * 30) + ' 200 200)'
            }));
        }
        for (i = 0; i < 12; i++) {
            var a = (i * 30) * Math.PI / 180;
            var x = 200 + 80 * Math.cos(a);
            var y = 200 + 80 * Math.sin(a);
            root.appendChild(svgEl('rect', {
                x: x - 10, y: y - 10, width: 20, height: 20,
                fill: colors[4], opacity: 0.6,
                transform: 'rotate(' + (i * 30) + ' ' + x + ' ' + y + ')'
            }));
        }
        root.appendChild(svgEl('circle', { cx: 200, cy: 200, r: 50, fill: 'none', stroke: colors[0], 'stroke-width': 2, opacity: 0.4 }));
        root.appendChild(svgEl('circle', { cx: 200, cy: 200, r: 34, fill: colors[2], opacity: 0.3 }));
        root.appendChild(svgEl('circle', { cx: 200, cy: 200, r: 16, fill: colors[1], opacity: 0.5 }));
        root.appendChild(svgEl('circle', { cx: 200, cy: 200, r: 6, fill: '#ffffff', opacity: 0.9 }));
        return root;
    }

    function mandalaTool(host) {
        var themeIndex = 0;
        var seconds = 0;
        var tick = null;
        var themeTimer = null;

        var stage = h('div', { class: 'tool-stage mandala-stage' }, [buildMandala(MANDALA_THEMES[0].colors)]);
        var timeEl = h('span', { class: 'tool-stat-value', text: '0:00' });
        var themeEl = h('span', { class: 'tool-stat-value', text: MANDALA_THEMES[0].name });
        var audio = h('audio', { src: 'media/audio/mandala-inspiration.mp3', loop: 'loop', preload: 'none' });

        function paint() {
            stage.innerHTML = '';
            stage.appendChild(buildMandala(MANDALA_THEMES[themeIndex].colors));
            themeEl.textContent = MANDALA_THEMES[themeIndex].name;
        }

        function nextTheme() {
            themeIndex = (themeIndex + 1) % MANDALA_THEMES.length;
            paint();
        }

        function stop() {
            clearInterval(tick); tick = null;
            clearInterval(themeTimer); themeTimer = null;
            audio.pause();
            startBtn.disabled = false;
            stopBtn.disabled = true;
        }

        function start() {
            seconds = 0;
            timeEl.textContent = '0:00';
            audio.play().catch(function () { /* autoplay blocked; the mandala still spins */ });
            tick = setInterval(function () {
                seconds++;
                timeEl.textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
            }, 1000);
            themeTimer = setInterval(nextTheme, 30000);
            startBtn.disabled = true;
            stopBtn.disabled = false;
        }

        var startBtn = btn('🕉️ Start Session', start);
        var stopBtn = btn('⏹ End Session', stop, { ghost: true, disabled: true });
        var fs = fullscreenControl(stage);

        host.appendChild(card([
            head('🕉️ Mandala Meditation', 'Gaze at the centre of the mandala, breathe deeply, and let your mind settle'),
            h('div', { class: 'tool-controls' }, [
                startBtn, stopBtn,
                btn('🎨 Next Theme', nextTheme, { ghost: true }),
                fs.el
            ]),
            stage,
            h('div', { class: 'tool-stat-row' }, [
                h('div', { class: 'tool-stat' }, [timeEl, h('div', { class: 'tool-stat-label', text: 'Session' })]),
                h('div', { class: 'tool-stat' }, [themeEl, h('div', { class: 'tool-stat-label', text: 'Theme' })])
            ]),
            audio,
            h('p', { class: 'tool-note', text: 'Breathe in… hold… breathe out. The theme changes every 30 seconds during a session.' })
        ]));
        host.appendChild(backBar());

        return function () { stop(); fs.destroy(); };
    }

    // =====================================================================
    // Focus Grid - peripheral vision training
    // =====================================================================

    function focusGridTool(host) {
        var rotation = 20;
        var gridSize = 380;
        var dotDistance = 150;
        var SCENE = 420;
        var DOT = 18;

        var grid = h('div', { class: 'focus-grid-inner' });
        // 15x15 of small red crosses, clipped to a diamond and slowly rotating
        for (var i = 0; i < 225; i++) {
            grid.appendChild(h('div', { class: 'fg-cell' }, [
                h('div', { class: 'fg-bar fg-bar-a' }),
                h('div', { class: 'fg-bar fg-bar-b' })
            ]));
        }

        var rotor = h('div', { class: 'focus-grid-rotor' }, [grid]);
        var centerDot = h('div', { class: 'fg-dot fg-dot-center' });
        var dots = [h('div', { class: 'fg-dot' }), h('div', { class: 'fg-dot' }), h('div', { class: 'fg-dot' })];
        var scene = h('div', { class: 'focus-grid-scene' }, [rotor, centerDot].concat(dots));

        function place() {
            rotor.style.width = gridSize + 'px';
            rotor.style.height = gridSize + 'px';
            rotor.style.animationDuration = rotation + 's';
            [270, 150, 30].forEach(function (deg, idx) {
                var rad = deg * Math.PI / 180;
                dots[idx].style.left = (SCENE / 2 + dotDistance * Math.cos(rad) - DOT / 2) + 'px';
                dots[idx].style.top = (SCENE / 2 + dotDistance * Math.sin(rad) - DOT / 2) + 'px';
            });
        }

        function slider(label, min, max, value, suffix, onInput) {
            var out = h('span', { class: 'fg-value', text: value + suffix });
            var input = h('input', {
                type: 'range', min: min, max: max, value: value,
                oninput: function (e) {
                    var v = Number(e.target.value);
                    out.textContent = v + suffix;
                    onInput(v);
                    place();
                }
            });
            return h('div', { class: 'tool-field' }, [h('label', { text: label }), input, out]);
        }

        var fs = fullscreenControl(scene);

        host.appendChild(card([
            head('🎯 Focus Grid', 'Peripheral vision and visual stability training'),
            h('div', { class: 'tool-controls' }, [
                slider('Rotation speed', 1, 60, rotation, 's', function (v) { rotation = v; }),
                slider('Grid size', 200, 420, gridSize, 'px', function (v) { gridSize = v; }),
                slider('Dot distance', 20, 200, dotDistance, 'px', function (v) { dotDistance = v; }),
                fs.el
            ]),
            h('div', { class: 'tool-stage focus-grid-stage' }, [scene]),
            h('p', { class: 'tool-note', text: '💡 Focus your eyes ONLY on the centre dot. Use peripheral vision to notice the three outer dots and the rotating grid. This trains focus, peripheral awareness and visual stability.' })
        ]));
        host.appendChild(backBar());

        place();
        return fs.destroy;
    }

    // =====================================================================
    // Peg System - visual memory pegs
    // =====================================================================

    function pegSystemTool(host) {
        var LEVELS = [
            { id: 1, pegs: 10, icon: '🌱', subtitle: 'Peg 1 – Peg 10' },
            { id: 2, pegs: 20, icon: '🌿', subtitle: 'Peg 1 – Peg 20' },
            { id: 3, pegs: 30, icon: '🌳', subtitle: 'Peg 1 – Peg 30' }
        ];

        var maxPeg = 0;
        var order = [];
        var index = 0;
        var view = 'single';
        var body = h('div');
        var fs = null;

        function src(n) { return 'media/peg-system/peg-' + n + '.webp'; }

        function shuffled(n) {
            var a = [];
            for (var i = 1; i <= n; i++) a.push(i);
            for (var j = a.length - 1; j > 0; j--) {
                var k = Math.floor(Math.random() * (j + 1));
                var t = a[j]; a[j] = a[k]; a[k] = t;
            }
            return a;
        }

        function sequential(n) {
            var a = [];
            for (var i = 1; i <= n; i++) a.push(i);
            return a;
        }

        function drawLevelSelect() {
            body.innerHTML = '';
            body.appendChild(h('h3', { class: 'result-subhead', style: 'text-align:center', text: 'Choose your level' }));
            body.appendChild(h('div', { class: 'tool-controls' }, LEVELS.map(function (l) {
                return btn(l.icon + ' Level ' + l.id + ' — ' + l.subtitle, function () {
                    maxPeg = l.pegs;
                    order = sequential(maxPeg);
                    index = 0;
                    drawViewer();
                });
            })));
        }

        function drawViewer() {
            body.innerHTML = '';

            var modeToggle = toggleGroup(
                [{ label: '🖼️ Single View', value: 'single' }, { label: '📋 Full Canvas', value: 'canvas' }],
                view,
                function (v) { view = v; index = v === 'canvas' ? 1 : 0; drawViewer(); }
            );

            body.appendChild(modeToggle.el);

            if (view === 'single') {
                var peg = order[index];
                var img = h('img', {
                    src: src(peg), alt: 'Peg ' + peg, width: 320, height: 320, loading: 'eager'
                });
                img.addEventListener('error', function () {
                    img.replaceWith(h('p', { class: 'tool-note', text: 'Image for peg ' + peg + ' could not be loaded.' }));
                });

                body.appendChild(h('div', { class: 'peg-viewer' }, [
                    h('div', { class: 'peg-viewer-num', text: 'Peg ' + peg }),
                    img,
                    h('p', { class: 'tool-note', text: (index + 1) + ' of ' + maxPeg })
                ]));

                body.appendChild(h('div', { class: 'tool-controls' }, [
                    btn('← Previous', function () { if (index > 0) { index--; drawViewer(); } }, { ghost: true, disabled: index === 0 }),
                    btn('Next →', function () { if (index < maxPeg - 1) { index++; drawViewer(); } }, { disabled: index >= maxPeg - 1 }),
                    btn('🔀 Random order', function () { order = shuffled(maxPeg); index = 0; drawViewer(); }, { ghost: true }),
                    btn('↺ Change level', drawLevelSelect, { ghost: true })
                ]));
            } else {
                var revealed = Math.max(1, index);
                var cells = order.slice(0, revealed).map(function (n) {
                    return h('div', { class: 'peg-card' }, [
                        h('img', { src: src(n), alt: 'Peg ' + n, width: 150, height: 150, loading: 'lazy' }),
                        h('div', { class: 'peg-card-label', text: 'Peg ' + n })
                    ]);
                });

                body.appendChild(h('div', { class: 'peg-grid' }, cells));
                body.appendChild(h('div', { class: 'tool-controls' }, [
                    btn('← Hide one', function () { if (index > 1) { index--; drawViewer(); } }, { ghost: true, disabled: revealed <= 1 }),
                    btn('Reveal next →', function () { if (index < maxPeg) { index++; drawViewer(); } }, { disabled: revealed >= maxPeg }),
                    btn('🔀 Random order', function () { order = shuffled(maxPeg); index = 1; drawViewer(); }, { ghost: true }),
                    btn('↺ Change level', drawLevelSelect, { ghost: true })
                ]));
                body.appendChild(h('p', { class: 'tool-note', text: revealed + ' of ' + maxPeg + ' revealed' }));
            }
        }

        var shell = card([
            head('🧠 Peg System', 'Memory training with visual pegs — link each number to its picture, then recall in order'),
            body
        ]);

        host.appendChild(shell);
        host.appendChild(backBar());

        fs = fullscreenControl(shell);
        shell.insertBefore(h('div', { class: 'tool-controls' }, [fs.el]), body);

        drawLevelSelect();
        return function () { fs.destroy(); };
    }

    // =====================================================================
    // Speed Reading - RSVP / pacer trainer with PDF, EPUB and TXT upload
    // =====================================================================

    function speedReadingTool(host) {
        var texts = {};
        var selected = 'brain';
        var custom = null;
        var scanMode = 1;
        var pacer = 'highlight';
        var speed = 150;
        var index = 0;
        var running = false;
        var timer = null;

        var reader = h('div', { class: 'tool-card', style: 'max-height:45vh;overflow-y:auto;line-height:2.4;font-size:17px' });
        var progressFill = h('div', { class: 'domain-fill', style: 'width:0%;background:#0B2A5B' });
        var progressLabel = h('span', { class: 'tool-stat-label', text: '0 / 0' });
        var select = h('select', { class: 'tool-input', onchange: function (e) { selected = e.target.value; reset(); draw(); } });
        var speedLabel = h('span', { class: 'fg-value', text: '150 WPM' });
        var startBtn = btn('▶ Start', toggleRun);
        var uploadError = h('p', { class: 'tool-note', style: 'color:#E53935', hidden: 'hidden' });
        var fileInput = h('input', { type: 'file', accept: '.pdf,.epub,.txt', style: 'display:none' });

        function words() {
            var t = (selected === 'custom' && custom) ? custom.text : (texts[selected] ? texts[selected].text : '');
            return t.split(/\s+/).filter(function (w) { return w.length > 0; });
        }

        function reset() {
            running = false;
            clearTimeout(timer);
            index = 0;
            startBtn.textContent = '▶ Start';
        }

        function toggleRun() {
            var list = words();
            if (!list.length) return;
            running = !running;
            startBtn.textContent = running ? '⏸ Pause' : (index > 0 ? '▶ Resume' : '▶ Start');
            if (running) step();
            else clearTimeout(timer);
        }

        function step() {
            if (!running) return;
            var list = words();
            if (index + scanMode >= list.length) {
                running = false;
                startBtn.textContent = '▶ Start';
                drawComplete(list.length);
                return;
            }
            index += scanMode;
            draw();
            timer = setTimeout(step, (60000 / speed) * scanMode);
        }

        function drawComplete(total) {
            reader.innerHTML = '';
            reader.appendChild(h('div', { style: 'text-align:center;padding:40px 20px' }, [
                h('div', { style: 'font-size:48px', text: '🎉' }),
                h('h3', { class: 'result-label', style: 'color:#34A853', text: 'Exercise complete' }),
                h('p', { class: 'result-text', style: 'text-align:center', text: 'You read ' + total + ' words at ' + speed + ' WPM with a ' + scanMode + '-word scan.' }),
                speed > 250 ? h('p', { class: 'result-text', style: 'text-align:center;color:#34A853', text: "⚡ That's faster than the 250 WPM world average. Keep pushing." }) : null,
                h('p', { class: 'tool-note', text: 'Next: raise the speed by 50 WPM, or widen the scan mode.' })
            ]));
            index = 0;
        }

        function draw() {
            var list = words();
            reader.innerHTML = '';
            var para = h('p', { style: 'margin:0' });

            list.forEach(function (word, i) {
                var isCurrent = i >= index && i < index + scanMode;
                var isPast = i < index;
                var style;

                if (pacer === 'highlight') {
                    style = 'padding:2px 1px;border-radius:3px;' +
                        (isCurrent ? 'background:#FFC107;color:#0B2A5B;font-weight:700;' : (isPast ? 'color:#bbb;' : 'color:#333;'));
                } else {
                    style = isPast ? 'color:#ccc;' : 'color:#333;';
                }

                para.appendChild(h('span', { style: style, text: word + ' ' }));
                if (pacer === 'line' && i === index) {
                    para.appendChild(h('span', {
                        style: 'display:inline-block;width:2px;height:1.2em;background:#E74C3C;vertical-align:middle;'
                    }));
                }
            });

            reader.appendChild(para);

            var shown = Math.min(index + scanMode, list.length);
            var pct = list.length ? (shown / list.length) * 100 : 0;
            progressFill.style.width = pct + '%';
            progressFill.style.background = speed > 250 ? '#34A853' : '#0B2A5B';
            progressLabel.textContent = shown + ' / ' + list.length + '  (' + pct.toFixed(0) + '%)';

            var highlighted = reader.querySelector('span[style*="FFC107"]');
            if (highlighted && running) highlighted.scrollIntoView({ block: 'center' });
        }

        function refreshSelect() {
            select.innerHTML = '';
            Object.keys(texts).forEach(function (k) {
                select.appendChild(h('option', { value: k, text: texts[k].label }));
            });
            if (custom) select.appendChild(h('option', { value: 'custom', text: '📄 ' + custom.label }));
            select.value = selected;
        }

        // --- upload: pdf.js / epub.js pulled from cdnjs only when used ----
        fileInput.addEventListener('change', function (e) {
            var file = e.target.files[0];
            if (!file) return;
            uploadError.hidden = true;
            var name = file.name.toLowerCase();

            var job;
            if (name.endsWith('.txt')) {
                job = file.text();
            } else if (name.endsWith('.pdf')) {
                job = loadCDN('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs')
                    .then(function () {
                        var lib = window.pdfjsLib;
                        lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';
                        return file.arrayBuffer();
                    })
                    .then(function (buf) { return window.pdfjsLib.getDocument({ data: buf }).promise; })
                    .then(function (pdf) {
                        var pages = [];
                        for (var p = 1; p <= pdf.numPages; p++) pages.push(p);
                        return pages.reduce(function (chain, p) {
                            return chain.then(function (acc) {
                                return pdf.getPage(p)
                                    .then(function (page) { return page.getTextContent(); })
                                    .then(function (c) {
                                        return acc + c.items.map(function (it) { return it.str; }).join(' ') + ' ';
                                    });
                            });
                        }, Promise.resolve(''));
                    });
            } else if (name.endsWith('.epub')) {
                job = loadCDN('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', 'JSZip')
                    .then(function () { return loadCDN('https://cdnjs.cloudflare.com/ajax/libs/epub.js/0.3.93/epub.min.js', 'ePub'); })
                    .then(function () { return file.arrayBuffer(); })
                    .then(function (buf) {
                        var book = window.ePub(buf);
                        return book.ready.then(function () {
                            return book.spine.items.reduce(function (chain, item) {
                                return chain.then(function (acc) {
                                    return book.load(item.href).then(function (doc) {
                                        var el = doc.querySelector ? doc.querySelector('body') : doc.body;
                                        return acc + (el ? el.textContent : '') + ' ';
                                    }).catch(function () { return acc; });
                                });
                            }, Promise.resolve(''));
                        });
                    });
            } else {
                uploadError.textContent = 'Unsupported file. Please upload a PDF, EPUB or TXT file.';
                uploadError.hidden = false;
                return;
            }

            uploadBtn.textContent = '⏳ Reading file…';
            uploadBtn.disabled = true;

            job.then(function (text) {
                var clean = String(text).replace(/\s+/g, ' ').trim();
                if (clean.length < 20) throw new Error('Could not extract readable text from that file.');
                custom = { label: file.name, text: clean };
                selected = 'custom';
                refreshSelect();
                reset();
                draw();
            }).catch(function (err) {
                uploadError.textContent = err.message || 'Failed to read that file.';
                uploadError.hidden = false;
            }).finally(function () {
                uploadBtn.textContent = '📁 Upload PDF / EPUB / TXT';
                uploadBtn.disabled = false;
                fileInput.value = '';
            });
        });

        var uploadBtn = btn('📁 Upload PDF / EPUB / TXT', function () { fileInput.click(); }, { ghost: true });

        var scanToggle = toggleGroup(
            [1, 2, 3, 5].map(function (n) { return { label: n + (n > 1 ? ' words' : ' word'), value: n }; }),
            1, function (v) { scanMode = v; reset(); draw(); }
        );

        var pacerToggle = toggleGroup(
            [{ label: '🟡 Word highlight', value: 'highlight' }, { label: '📏 Line pacer', value: 'line' }],
            'highlight', function (v) { pacer = v; reset(); draw(); }
        );

        var speedInput = h('input', {
            type: 'range', min: 150, max: 800, step: 10, value: 150,
            oninput: function (e) {
                speed = Number(e.target.value);
                speedLabel.textContent = speed + ' WPM' + (speed > 250 ? ' ⚡' : '');
            }
        });

        host.appendChild(card([
            head('👁️ Speed Reading Practice', 'Rapid eye movement training — train your eyes to scan in wider groups'),
            h('div', { class: 'tool-controls' }, [
                field('Reading text', select), uploadBtn, fileInput
            ]),
            uploadError,
            h('div', { class: 'tool-controls' }, [
                h('div', { class: 'tool-field' }, [h('label', { text: 'Words per fixation' }), scanToggle.el])
            ]),
            h('div', { class: 'tool-controls' }, [
                h('div', { class: 'tool-field' }, [h('label', { text: 'Pacer type' }), pacerToggle.el])
            ]),
            h('div', { class: 'tool-controls' }, [
                h('div', { class: 'tool-field', style: 'flex:1;min-width:240px' }, [
                    h('label', { text: 'Speed' }), speedInput, speedLabel
                ])
            ]),
            h('div', { class: 'tool-controls' }, [
                startBtn,
                btn('↺ Reset', function () { reset(); draw(); }, { ghost: true })
            ]),
            h('div', { class: 'domain-track' }, [progressFill]),
            h('p', { class: 'tool-note' }, [progressLabel])
        ]));
        host.appendChild(reader);
        host.appendChild(card([
            h('p', { class: 'tool-note', style: 'text-align:left', text: '💡 How to practise: start with a 1-word scan at 150 WPM. Once that is comfortable, move to 2 words, then 3 and 5. Only raise the speed when you still understand what you are reading. 5–10 minutes a day is enough.' })
        ]));
        host.appendChild(backBar());

        fetch('QuizQuestions/reading-texts.json')
            .then(function (r) { return r.json(); })
            .then(function (data) { texts = data; refreshSelect(); draw(); })
            .catch(function () {
                reader.appendChild(h('p', { class: 'tool-note', text: 'Could not load the practice texts. You can still upload your own file.' }));
            });

        return function () { running = false; clearTimeout(timer); };
    }

    // =====================================================================
    // Ball Focus Trainer - canvas physics
    // =====================================================================

    function ballFocusTool(host) {
        var W = 1280, H = 720, R = 14;
        var GRAVITY = 0.3, DAMPING = 0.85, DROP_INTERVAL = 10000;

        // Fibonacci batch sizes, as in the React version
        var FIB = [1, 1];
        while (FIB[FIB.length - 1] + FIB[FIB.length - 2] <= 150) {
            FIB.push(FIB[FIB.length - 1] + FIB[FIB.length - 2]);
        }
        var totalBalls = FIB.reduce(function (a, b) { return a + b; }, 0);

        var COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96E6A1', '#DDA0DD', '#F7DC6F',
            '#BB8FCE', '#85C1E9', '#F1948A', '#82E0AA', '#F8C471', '#AED6F1',
            '#FF6B00', '#1E5EFF', '#34A853', '#6A3DE8'];

        var canvas = h('canvas', { class: 'tool-canvas', width: W, height: H });
        var ctx = canvas.getContext('2d');
        if (!ctx) return canvasUnsupported(host, '🎱 Ball Focus Trainer', 'Track the bouncing balls');
        var balls = [];
        var raf = null;
        var running = false;
        var startedAt = 0, nextDrop = 0, fibIndex = 0, droppedInBatch = 0;

        var timeEl = h('div', { class: 'tool-stat-value', text: '0s' });
        var countEl = h('div', { class: 'tool-stat-value', text: '0' });
        var nextEl = h('div', { class: 'tool-stat-value', text: '—' });

        function makeBall() {
            return {
                x: Math.random() * (W - R * 2) + R,
                y: -R,
                vx: (Math.random() - 0.5) * 6,
                vy: Math.random() * 2 + 1,
                r: R + Math.random() * 5 - 2.5,
                color: COLORS[Math.floor(Math.random() * COLORS.length)]
            };
        }

        function loop() {
            var now = Date.now();
            timeEl.textContent = Math.floor((now - startedAt) / 1000) + 's';
            nextEl.textContent = Math.max(0, Math.ceil((nextDrop - now) / 1000)) + 's';

            if (now >= nextDrop && fibIndex < FIB.length) {
                if (droppedInBatch < FIB[fibIndex]) {
                    balls.push(makeBall());
                    droppedInBatch++;
                    countEl.textContent = String(balls.length);
                    if (droppedInBatch < FIB[fibIndex]) {
                        nextDrop = now + 300;
                    } else {
                        fibIndex++;
                        droppedInBatch = 0;
                        if (fibIndex < FIB.length) nextDrop = now + DROP_INTERVAL;
                    }
                }
            }

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, W, H);

            balls.forEach(function (b) {
                b.vy += GRAVITY;
                b.x += b.vx;
                b.y += b.vy;

                if (b.x - b.r <= 0) { b.x = b.r; b.vx = Math.abs(b.vx) * DAMPING; }
                if (b.x + b.r >= W) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * DAMPING; }
                if (b.y + b.r >= H) {
                    b.y = H - b.r;
                    b.vy = -Math.abs(b.vy) * DAMPING;
                    b.vx += (Math.random() - 0.5) * 2;
                }
                if (b.y - b.r <= 0) { b.y = b.r; b.vy = Math.abs(b.vy) * DAMPING; }

                // Never let a ball settle - this is a tracking exercise
                if (Math.abs(b.vy) < 2 && b.y + b.r >= H - 5) {
                    b.vy = -(Math.random() * 8 + 5);
                    b.vx = (Math.random() - 0.5) * 8;
                }

                var g = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.1, b.x, b.y, b.r);
                g.addColorStop(0, '#ffffff');
                g.addColorStop(0.3, b.color);
                g.addColorStop(1, b.color);
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
                ctx.fillStyle = g;
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.15)';
                ctx.lineWidth = 1;
                ctx.stroke();
            });

            raf = requestAnimationFrame(loop);
        }

        function start() {
            balls = [];
            fibIndex = 0;
            droppedInBatch = 0;
            startedAt = Date.now();
            nextDrop = Date.now();
            running = true;
            startBtn.disabled = true;
            stopBtn.disabled = false;
            raf = requestAnimationFrame(loop);
        }

        function stop() {
            running = false;
            if (raf) { cancelAnimationFrame(raf); raf = null; }
            startBtn.disabled = false;
            stopBtn.disabled = true;
        }

        var startBtn = btn('▶ Start', start);
        var stopBtn = btn('⏹ Stop', stop, { ghost: true, disabled: true });
        var fs = fullscreenControl(canvas);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        host.appendChild(card([
            head('🎱 Ball Focus Trainer', 'Track the bouncing balls — trains sustained attention and multiple-object tracking'),
            h('div', { class: 'tool-controls' }, [startBtn, stopBtn, fs.el]),
            canvas,
            h('div', { class: 'tool-stat-row' }, [
                h('div', { class: 'tool-stat' }, [timeEl, h('div', { class: 'tool-stat-label', text: 'Elapsed' })]),
                h('div', { class: 'tool-stat' }, [countEl, h('div', { class: 'tool-stat-label', text: 'Balls' })]),
                h('div', { class: 'tool-stat' }, [nextEl, h('div', { class: 'tool-stat-label', text: 'Next batch' })])
            ]),
            h('p', { class: 'tool-note', text: 'Balls drop in Fibonacci batches (1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89…) every 10 seconds, up to about ' + totalBalls + ' in total. Keep as many as you can in view at once.' })
        ]));
        host.appendChild(backBar());

        return function () { stop(); fs.destroy(); };
    }

    // =====================================================================
    // Eye Movement Exercise - reading sweep + pattern tracing
    // =====================================================================

    function eyeExerciseTool(host) {
        var PATTERNS = [
            { id: 'infinity-h', label: '∞ Horizontal Infinity' },
            { id: 'perimeter', label: '◻ Corner Perimeter' },
            { id: 'infinity-v', label: '∞ Vertical Infinity' },
            { id: 'diagonal', label: '✕ Diagonal Cross' },
            { id: 'circle', label: '○ Circle' }
        ];
        var MARGIN = 40, R = 14, LINE_HEIGHT = 50, CYCLES_PER_PATTERN = 3;

        var W = 1200, H = 700;
        var mode = 'reading';
        var readingSpeed = 6;
        var eyeSpeed = 0.025;
        var patternIndex = 0;
        var cycles = 0;
        var t = 0;
        var ball = { x: MARGIN, y: MARGIN + R, line: 0 };
        var raf = null;

        var canvas = h('canvas', { class: 'tool-canvas', width: W, height: H });
        var ctx = canvas.getContext('2d');
        if (!ctx) return canvasUnsupported(host, '👁️ Eye Movement Exercise', 'Train your eye muscles for smoother reading');

        function totalLines() { return Math.floor((H - MARGIN * 2) / LINE_HEIGHT); }

        function patternPos(tt, pattern) {
            var cx = W / 2, cy = H / 2;
            var rx = (W - MARGIN * 2) / 2 * 0.85;
            var ry = (H - MARGIN * 2) / 2 * 0.85;
            var angle, denom;

            switch (pattern) {
                case 'infinity-h':
                    angle = tt * Math.PI * 2;
                    denom = 1 + Math.sin(angle) * Math.sin(angle);
                    return { x: cx + (rx * Math.cos(angle)) / denom, y: cy + (ry * 0.5 * Math.sin(angle) * Math.cos(angle)) / denom };
                case 'infinity-v':
                    angle = tt * Math.PI * 2;
                    denom = 1 + Math.sin(angle) * Math.sin(angle);
                    return { x: cx + (rx * 0.5 * Math.sin(angle) * Math.cos(angle)) / denom, y: cy + (ry * Math.cos(angle)) / denom };
                case 'circle':
                    angle = tt * Math.PI * 2;
                    return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
                case 'perimeter': {
                    var topW = W - MARGIN * 2, sideH = H - MARGIN * 2;
                    var pos = ((tt % 1) + 1) % 1 * (2 * topW + 2 * sideH);
                    if (pos < topW) return { x: MARGIN + pos, y: MARGIN };
                    if (pos < topW + sideH) return { x: W - MARGIN, y: MARGIN + (pos - topW) };
                    if (pos < topW * 2 + sideH) return { x: W - MARGIN - (pos - topW - sideH), y: H - MARGIN };
                    return { x: MARGIN, y: H - MARGIN - (pos - topW * 2 - sideH) };
                }
                case 'diagonal': {
                    var seg = ((tt % 1) + 1) % 1;
                    var phase = Math.floor(seg * 4) % 4;
                    var frac = (seg * 4) % 1;
                    var tl = { x: MARGIN, y: MARGIN }, tr = { x: W - MARGIN, y: MARGIN };
                    var bl = { x: MARGIN, y: H - MARGIN }, br = { x: W - MARGIN, y: H - MARGIN };
                    if (phase === 0) return { x: tl.x + (br.x - tl.x) * frac, y: tl.y + (br.y - tl.y) * frac };
                    if (phase === 1) return { x: br.x + (tr.x - br.x) * frac, y: br.y + (tr.y - br.y) * frac };
                    if (phase === 2) return { x: tr.x + (bl.x - tr.x) * frac, y: tr.y + (bl.y - tr.y) * frac };
                    return { x: bl.x + (tl.x - bl.x) * frac, y: bl.y + (tl.y - bl.y) * frac };
                }
                default:
                    return { x: cx, y: cy };
            }
        }

        function drawBall(x, y) {
            var g = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, R);
            g.addColorStop(0, '#ff8a8a');
            g.addColorStop(0.5, '#ff3333');
            g.addColorStop(1, '#cc0000');
            ctx.beginPath();
            ctx.arc(x, y, R, 0, Math.PI * 2);
            ctx.fillStyle = g;
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        function readingFrame() {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, W, H);

            ctx.strokeStyle = '#f0f0f0';
            ctx.lineWidth = 1;
            for (var i = 0; i <= totalLines(); i++) {
                var ly = MARGIN + i * LINE_HEIGHT;
                ctx.beginPath();
                ctx.moveTo(MARGIN, ly);
                ctx.lineTo(W - MARGIN, ly);
                ctx.stroke();
            }

            ball.x += readingSpeed;
            if (ball.x >= W - MARGIN) {
                ball.line++;
                ball.x = MARGIN;
                if (ball.line >= totalLines()) ball.line = 0;
                ball.y = MARGIN + R + ball.line * LINE_HEIGHT;
            }

            ctx.fillStyle = 'rgba(30, 94, 255, 0.05)';
            ctx.fillRect(MARGIN, MARGIN + ball.line * LINE_HEIGHT - LINE_HEIGHT / 2 + R, W - MARGIN * 2, LINE_HEIGHT);

            for (var k = 0; k < 5; k++) {
                var tx = ball.x - (k + 1) * readingSpeed * 2;
                if (tx > MARGIN && tx < W - MARGIN) {
                    ctx.beginPath();
                    ctx.arc(tx, ball.y, R - k * 2, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255, 80, 80, ' + (0.15 - k * 0.03) + ')';
                    ctx.fill();
                }
            }

            drawBall(ball.x, ball.y);
            raf = requestAnimationFrame(readingFrame);
        }

        function patternFrame() {
            var prev = t;
            t += eyeSpeed;

            if (Math.floor(t) > Math.floor(prev)) {
                cycles++;
                if (cycles >= CYCLES_PER_PATTERN) {
                    cycles = 0;
                    patternIndex = (patternIndex + 1) % PATTERNS.length;
                    t = 0;
                }
            }

            var id = PATTERNS[patternIndex].id;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, W, H);

            // Faint guide showing the whole path
            ctx.strokeStyle = 'rgba(30, 94, 255, 0.12)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (var i = 0; i <= 200; i++) {
                var sp = patternPos(i / 200, id);
                if (i === 0) ctx.moveTo(sp.x, sp.y); else ctx.lineTo(sp.x, sp.y);
            }
            ctx.stroke();

            for (var k = 1; k <= 8; k++) {
                var tt = t - k * eyeSpeed * 3;
                if (tt >= 0) {
                    var tp = patternPos(tt, id);
                    ctx.beginPath();
                    ctx.arc(tp.x, tp.y, Math.max(1, R - k * 1.2), 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255, 80, 80, ' + Math.max(0, 0.2 - k * 0.025) + ')';
                    ctx.fill();
                }
            }

            var pos = patternPos(t, id);
            drawBall(pos.x, pos.y);

            ctx.fillStyle = 'rgba(11, 42, 91, 0.6)';
            ctx.font = "bold 16px 'Montserrat', sans-serif";
            ctx.textAlign = 'center';
            ctx.fillText(PATTERNS[patternIndex].label, W / 2, H - 20);

            raf = requestAnimationFrame(patternFrame);
        }

        function stop() {
            if (raf) { cancelAnimationFrame(raf); raf = null; }
            startBtn.disabled = false;
            stopBtn.disabled = true;
        }

        function start() {
            stop();
            startBtn.disabled = true;
            stopBtn.disabled = false;
            if (mode === 'reading') {
                ball = { x: MARGIN, y: MARGIN + R, line: 0 };
                raf = requestAnimationFrame(readingFrame);
            } else {
                t = 0; cycles = 0; patternIndex = 0;
                raf = requestAnimationFrame(patternFrame);
            }
        }

        var modeToggle = toggleGroup([
            { label: '📖 Reading sweep', value: 'reading' },
            { label: '🔄 Pattern tracing', value: 'pattern' }
        ], 'reading', function (v) { mode = v; stop(); speedRow.hidden = false; });

        var readingSpeedToggle = toggleGroup([
            { label: 'Slow', value: 3 }, { label: 'Medium', value: 6 },
            { label: 'Fast', value: 10 }, { label: 'Very fast', value: 15 }
        ], 6, function (v) { readingSpeed = v; eyeSpeed = v / 250; });

        var speedRow = h('div', { class: 'tool-controls' }, [
            h('div', { class: 'tool-field' }, [h('label', { text: 'Speed' }), readingSpeedToggle.el])
        ]);

        var startBtn = btn('▶ Start', start);
        var stopBtn = btn('⏹ Stop', stop, { ghost: true, disabled: true });
        var fs = fullscreenControl(canvas);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        host.appendChild(card([
            head('👁️ Eye Movement Exercise', 'Train your eye muscles for smoother reading and steadier focus'),
            h('div', { class: 'tool-controls' }, [
                h('div', { class: 'tool-field' }, [h('label', { text: 'Exercise' }), modeToggle.el])
            ]),
            speedRow,
            h('div', { class: 'tool-controls' }, [startBtn, stopBtn, fs.el]),
            canvas,
            h('p', { class: 'tool-note', text: 'Follow the red ball with your eyes only — keep your head still. In pattern mode the ball traces ∞ horizontal → perimeter → ∞ vertical → diagonal cross → circle, three cycles each.' })
        ]));
        host.appendChild(backBar());

        return function () { stop(); fs.destroy(); };
    }

    // =====================================================================
    // Mental Math
    // =====================================================================

    function mentalMathTool(host) {
        var OPERATIONS = [
            { id: 'addition', label: 'Addition (+)', symbol: '+' },
            { id: 'subtraction', label: 'Subtraction (−)', symbol: '−' },
            { id: 'multiplication', label: 'Multiplication (×)', symbol: '×' },
            { id: 'division', label: 'Division (÷)', symbol: '÷' }
        ];

        var op = null, level = null, minutes = 5;
        var score = 0, total = 0, timeLeft = 0;
        var question = null, options = [], locked = false;
        var timer = null;
        var body = h('div');

        function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

        function makeQuestion() {
            var one = level === 1;
            var min = one ? 1 : 10, max = one ? 9 : 99;
            var a, b, answer;

            switch (op) {
                case 'addition':
                    a = randInt(min, max); b = randInt(min, max); answer = a + b;
                    break;
                case 'subtraction':
                    a = randInt(min, max); b = randInt(min, a); answer = a - b;
                    break;
                case 'multiplication':
                    if (one) { a = randInt(1, 9); b = randInt(1, 9); }
                    else { a = randInt(10, 29); b = randInt(2, 10); }
                    answer = a * b;
                    break;
                default: // division - built from the answer so it divides exactly
                    if (one) { b = randInt(2, 9); answer = randInt(1, 8); }
                    else { b = randInt(2, 10); answer = randInt(10, 24); }
                    a = b * answer;
            }
            return { a: a, b: b, answer: answer };
        }

        function makeOptions(correct) {
            var set = [correct];
            while (set.length < 4) {
                var offset = randInt(-5, 5) || 1;
                var wrong = correct + offset;
                if (wrong >= 0 && set.indexOf(wrong) === -1) set.push(wrong);
            }
            for (var i = set.length - 1; i > 0; i--) {
                var j = randInt(0, i);
                var t = set[i]; set[i] = set[j]; set[j] = t;
            }
            return set;
        }

        function symbol() {
            var found = OPERATIONS.filter(function (o) { return o.id === op; })[0];
            return found ? found.symbol : '+';
        }

        function drawSetup() {
            clearInterval(timer);
            body.innerHTML = '';

            var opToggle = toggleGroup(OPERATIONS.map(function (o) {
                return { label: o.label, value: o.id };
            }), op, function (v) { op = v; startBtn.disabled = !(op && level); });

            var levelToggle = toggleGroup([
                { label: 'Level 1 — 1-digit', value: 1 },
                { label: 'Level 2 — 2-digit', value: 2 }
            ], level, function (v) { level = v; startBtn.disabled = !(op && level); });

            var timeToggle = toggleGroup([1, 2, 3, 5].map(function (t) {
                return { label: t + ' min', value: t };
            }), minutes, function (v) { minutes = v; });

            var startBtn = btn('▶ Start', startGame, { disabled: true });

            body.appendChild(h('div', { class: 'tool-controls' }, [
                h('div', { class: 'tool-field' }, [h('label', { text: 'Operation' }), opToggle.el])
            ]));
            body.appendChild(h('div', { class: 'tool-controls' }, [
                h('div', { class: 'tool-field' }, [h('label', { text: 'Level' }), levelToggle.el])
            ]));
            body.appendChild(h('div', { class: 'tool-controls' }, [
                h('div', { class: 'tool-field' }, [h('label', { text: 'Duration' }), timeToggle.el])
            ]));
            body.appendChild(h('div', { class: 'tool-controls' }, [startBtn]));
        }

        function startGame() {
            score = 0; total = 0; timeLeft = minutes * 60;
            timer = setInterval(function () {
                timeLeft--;
                if (timeLeft <= 0) { clearInterval(timer); drawResults(); return; }
                drawClock();
            }, 1000);
            nextQuestion();
        }

        var clockEl = null, scoreEl = null, feedbackEl = null;

        function drawClock() {
            if (clockEl) clockEl.textContent = mmss(Math.max(0, timeLeft));
            if (scoreEl) scoreEl.textContent = score + ' / ' + total;
        }

        function nextQuestion() {
            question = makeQuestion();
            options = makeOptions(question.answer);
            locked = false;
            drawPlaying();
        }

        function drawPlaying() {
            body.innerHTML = '';
            clockEl = h('div', { class: 'tool-stat-value', text: mmss(Math.max(0, timeLeft)) });
            scoreEl = h('div', { class: 'tool-stat-value', text: score + ' / ' + total });
            feedbackEl = h('div', { class: 'math-feedback' });

            body.appendChild(h('div', { class: 'tool-stat-row' }, [
                h('div', { class: 'tool-stat' }, [clockEl, h('div', { class: 'tool-stat-label', text: 'Time left' })]),
                h('div', { class: 'tool-stat' }, [scoreEl, h('div', { class: 'tool-stat-label', text: 'Correct' })])
            ]));

            body.appendChild(h('div', {
                class: 'math-problem',
                text: question.a + ' ' + symbol() + ' ' + question.b + ' = ?'
            }));

            body.appendChild(h('div', { class: 'tool-controls' }, options.map(function (value) {
                return btn(String(value), function () { answer(value); }, { ghost: true });
            })));

            body.appendChild(feedbackEl);
            body.appendChild(h('div', { class: 'tool-controls' }, [
                btn('⏹ End early', function () { clearInterval(timer); drawResults(); }, { ghost: true })
            ]));
        }

        function answer(value) {
            if (locked) return;
            locked = true;
            total++;
            var right = value === question.answer;
            if (right) score++;
            feedbackEl.textContent = right ? '✅ Correct' : '❌ It was ' + question.answer;
            feedbackEl.style.color = right ? '#34A853' : '#E53935';
            drawClock();
            setTimeout(function () { if (timeLeft > 0) nextQuestion(); }, 800);
        }

        function drawResults() {
            body.innerHTML = '';
            var accuracy = total ? Math.round((score / total) * 100) : 0;
            body.appendChild(h('div', { class: 'result-emoji', style: 'text-align:center', text: accuracy >= 80 ? '🏆' : accuracy >= 50 ? '👍' : '💪' }));
            body.appendChild(h('h2', { class: 'result-label', style: 'text-align:center', text: score + ' correct out of ' + total }));
            body.appendChild(h('div', { class: 'tool-stat-row' }, [
                stat(accuracy + '%', 'Accuracy'),
                stat(String(total), 'Attempted'),
                stat(minutes + ' min', 'Duration')
            ]));
            body.appendChild(h('div', { class: 'tool-controls' }, [
                btn('🔄 Play again', drawSetup)
            ]));
        }

        host.appendChild(card([
            head('🧮 Mental Math', 'Train your brain with quick calculations under time pressure'),
            body
        ]));
        host.appendChild(backBar());

        drawSetup();
        return function () { clearInterval(timer); };
    }

    // =====================================================================
    // Timer - speed reading / pomodoro / custom
    // =====================================================================

    function timerTool(host) {
        var mode = null;
        var phase = 'select';
        var duration = 120, timeLeft = 0;
        var pomodoroRound = 1, pomodoroPhase = 'focus';
        var customName = '', customMinutes = 5;
        var timer = null, countdownTimer = null;
        var body = h('div');
        var fs = null;

        function clearAll() {
            clearInterval(timer); timer = null;
            clearTimeout(countdownTimer); countdownTimer = null;
        }

        function drawSelect() {
            clearAll();
            phase = 'select'; mode = null;
            body.innerHTML = '';
            body.appendChild(h('div', { class: 'tool-controls' }, [
                btn('📖 Speed Reading Timer', function () { mode = 'speed-reading'; drawReadingSetup(); }),
                btn('🍅 Pomodoro', function () { mode = 'pomodoro'; drawPomodoroSetup(); }),
                btn('⏱️ Custom Timer', function () { mode = 'custom'; drawCustomSetup(); })
            ]));
        }

        function drawReadingSetup() {
            body.innerHTML = '';
            body.appendChild(h('h3', { class: 'result-subhead', style: 'text-align:center', text: '📖 Speed Reading Timer' }));
            body.appendChild(h('p', { class: 'tool-note', text: 'Pick how long you want to read for. You will get a breathing pause and a 3-2-1 countdown first.' }));
            body.appendChild(h('div', { class: 'tool-controls' }, [
                btn('2 min', function () { duration = 120; drawBreathing(); }),
                btn('5 min', function () { duration = 300; drawBreathing(); }),
                btn('← Back', drawSelect, { ghost: true })
            ]));
        }

        function drawPomodoroSetup() {
            body.innerHTML = '';
            body.appendChild(h('h3', { class: 'result-subhead', style: 'text-align:center', text: '🍅 Pomodoro Timer' }));
            body.appendChild(h('p', { class: 'tool-note', text: '25 minutes of focus → 5 minute break → repeat. Rounds continue until you stop.' }));
            body.appendChild(h('div', { class: 'tool-controls' }, [
                btn('▶ Start Pomodoro', function () {
                    duration = 1500; timeLeft = 1500;
                    pomodoroRound = 1; pomodoroPhase = 'focus';
                    run();
                }),
                btn('← Back', drawSelect, { ghost: true })
            ]));
        }

        function drawCustomSetup() {
            body.innerHTML = '';
            var nameInput = h('input', {
                type: 'text', class: 'tool-input', placeholder: 'e.g. Revision, Homework…',
                oninput: function (e) { customName = e.target.value; }
            });
            var minsInput = h('input', {
                type: 'number', min: 1, max: 120, value: 5, class: 'tool-input',
                oninput: function (e) { customMinutes = Math.max(1, parseInt(e.target.value, 10) || 1); }
            });

            body.appendChild(h('h3', { class: 'result-subhead', style: 'text-align:center', text: '⏱️ Custom Timer' }));
            body.appendChild(h('div', { class: 'tool-controls' }, [
                field('What is this timer for?', nameInput),
                field('Duration (minutes)', minsInput)
            ]));
            body.appendChild(h('div', { class: 'tool-controls' }, [
                btn('▶ Start Timer', function () {
                    duration = customMinutes * 60;
                    timeLeft = duration;
                    run();
                }),
                btn('← Back', drawSelect, { ghost: true })
            ]));
        }

        function drawBreathing() {
            body.innerHTML = '';
            body.appendChild(h('div', { class: 'result-emoji', style: 'text-align:center', text: '🫁' }));
            body.appendChild(h('h3', { class: 'result-label', style: 'text-align:center', text: 'Take deep breaths' }));
            body.appendChild(h('p', { class: 'tool-note', text: 'Breathe in deeply, exhale slowly. Do 3–5 cycles before you start reading.' }));
            body.appendChild(h('div', { class: 'tool-controls' }, [
                btn("I'm ready → Start", drawCountdown),
                btn('← Back', drawReadingSetup, { ghost: true })
            ]));
        }

        function drawCountdown() {
            var n = 3;
            body.innerHTML = '';
            var numEl = h('div', { class: 'timer-readout', text: '3' });
            body.appendChild(numEl);

            function tickDown() {
                n--;
                if (n > 0) {
                    numEl.textContent = String(n);
                    countdownTimer = setTimeout(tickDown, 1000);
                } else if (n === 0) {
                    numEl.textContent = 'Go!';
                    countdownTimer = setTimeout(function () { timeLeft = duration; run(); }, 800);
                }
            }
            countdownTimer = setTimeout(tickDown, 1000);
        }

        function run() {
            phase = 'running';
            drawRunning();
            clearInterval(timer);
            timer = setInterval(function () {
                timeLeft--;
                if (timeLeft <= 0) {
                    clearInterval(timer);
                    if (mode === 'pomodoro') {
                        if (pomodoroPhase === 'focus') {
                            pomodoroPhase = 'break'; duration = 300; timeLeft = 300;
                        } else {
                            pomodoroPhase = 'focus'; pomodoroRound++; duration = 1500; timeLeft = 1500;
                        }
                        run();
                        return;
                    }
                    drawDone();
                    return;
                }
                updateRunning();
            }, 1000);
        }

        var readoutEl = null, ringFill = null;

        function label() {
            if (mode === 'speed-reading') return '📖 Reading';
            if (mode === 'pomodoro') return pomodoroPhase === 'focus' ? '🍅 Focus — round ' + pomodoroRound : '☕ Break';
            return customName || 'Custom timer';
        }

        function drawRunning() {
            body.innerHTML = '';
            var r = 100, c = 2 * Math.PI * r;
            ringFill = svgEl('circle', {
                cx: 110, cy: 110, r: r, fill: 'none',
                stroke: pomodoroPhase === 'break' && mode === 'pomodoro' ? '#34A853' : '#1E5EFF',
                'stroke-width': 10, 'stroke-linecap': 'round',
                'stroke-dasharray': '0 ' + c,
                transform: 'rotate(-90 110 110)'
            });
            readoutEl = h('div', { class: 'timer-readout', text: mmss(timeLeft) });

            body.appendChild(h('div', { class: 'timer-phase', text: label() }));
            body.appendChild(h('div', { style: 'position:relative;width:220px;margin:0 auto' }, [
                svgEl('svg', { width: 220, height: 220, viewBox: '0 0 220 220' }, [
                    svgEl('circle', { cx: 110, cy: 110, r: r, fill: 'none', stroke: '#e9ecef', 'stroke-width': 10 }),
                    ringFill
                ]),
                h('div', { style: 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center' }, [readoutEl])
            ]));
            body.appendChild(h('div', { class: 'tool-controls' }, [
                btn('⏹ Stop', function () { clearAll(); drawDone(); }, { ghost: true })
            ]));
            updateRunning();
        }

        function updateRunning() {
            if (!readoutEl) return;
            readoutEl.textContent = mmss(Math.max(0, timeLeft));
            var c = 2 * Math.PI * 100;
            var done = duration > 0 ? ((duration - timeLeft) / duration) : 0;
            ringFill.setAttribute('stroke-dasharray', (done * c) + ' ' + c);
        }

        function drawDone() {
            clearAll();
            body.innerHTML = '';
            if (mode === 'speed-reading') {
                body.appendChild(h('div', { class: 'result-emoji', style: 'text-align:center', text: '🧘' }));
                body.appendChild(h('h3', { class: 'result-label', style: 'text-align:center', text: "Time's up" }));
                body.appendChild(h('div', { class: 'result-tip' }, [
                    h('h4', { text: 'Now recall' }),
                    h('p', { text: 'Close your eyes, relax, and try to recall what you read for at least one minute before looking back at the text. That retrieval is what moves it into long-term memory.' })
                ]));
            } else {
                body.appendChild(h('div', { class: 'result-emoji', style: 'text-align:center', text: '✅' }));
                body.appendChild(h('h3', { class: 'result-label', style: 'text-align:center', text: 'Timer complete' }));
                body.appendChild(h('p', { class: 'tool-note', text: 'Good work. Stand up, stretch, and breathe before the next block.' }));
            }
            body.appendChild(h('div', { class: 'tool-controls' }, [
                btn('🔄 Start a new timer', drawSelect)
            ]));
        }

        var shell = card([
            head('⏱️ Timer', 'Focus tools for deep learning sessions'),
            body
        ]);
        host.appendChild(shell);
        host.appendChild(backBar());

        fs = fullscreenControl(shell);
        shell.insertBefore(h('div', { class: 'tool-controls' }, [fs.el]), body);

        drawSelect();
        return function () { clearAll(); fs.destroy(); };
    }

    // =====================================================================
    // Reflects - affirmations, action plan and learning reflection (PDF out)
    // =====================================================================

    var NEGATIVE_STATEMENTS = [
        'I am not good at studying.',
        'My memory is very weak.',
        'Math is too difficult for me.',
        'I always forget what I study.',
        "I can't concentrate on anything.",
        'I am not intelligent enough to learn this.',
        'I will definitely fail this exam.',
        'Everyone learns faster than me.',
        'I made a mistake, so I am bad at this subject.',
        'I can never learn programming.'
    ];

    function loadJsPDF() {
        return loadCDN('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
            .then(function () { return window.jspdf.jsPDF; });
    }

    function reflectsTool(host) {
        var tab = 'affirmation';
        var body = h('div');

        // Affirmation state
        var name = '';
        var responses = NEGATIVE_STATEMENTS.map(function () { return ''; });
        // Action plan state
        var ap = { name: '', day: '', reflection: '', actions: ['', '', ''] };
        // Learning reflection state
        var lr = { name: '', date: '', topic: '', learnings: ['', '', ''], todos: ['', '', '', '', ''] };

        function pdfHeader(doc, pageWidth) {
            var y = 15;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.setTextColor(11, 42, 91);
            doc.text('Super Learner Academy', pageWidth / 2, y, { align: 'center' });
            y += 6;
            doc.setDrawColor(255, 107, 0);
            doc.setLineWidth(0.8);
            doc.line(60, y, pageWidth - 60, y);
            return y + 10;
        }

        function pdfFooter(doc, pageWidth) {
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text('Generated by Super Learner Academy', pageWidth / 2, 287, { align: 'center' });
        }

        function withPdf(fn, button, fileName) {
            var original = button.textContent;
            button.textContent = '⏳ Building PDF…';
            button.disabled = true;
            loadJsPDF().then(function (JsPDF) {
                var doc = new JsPDF('p', 'mm', 'a4');
                fn(doc, doc.internal.pageSize.getWidth());
                doc.save(fileName());
            }).catch(function () {
                alert('Could not load the PDF library. Check your connection and try again.');
            }).finally(function () {
                button.textContent = original;
                button.disabled = false;
            });
        }

        // ---- Tab 1: Positive Affirmations ----
        function drawAffirmation() {
            body.innerHTML = '';
            var nameInput = h('input', {
                type: 'text', class: 'tool-input', placeholder: 'Your name', value: name,
                oninput: function (e) { name = e.target.value; }
            });

            body.appendChild(h('p', { class: 'tool-note', style: 'text-align:left', text: 'Rewrite each negative statement as something true, specific and kind. Not "I am brilliant at maths" — something you would actually believe, like "I find maths hard right now, and I get better at it every time I practise."' }));
            body.appendChild(h('div', { class: 'tool-controls' }, [field('Name', nameInput)]));
            body.appendChild(h('div', { class: 'reflect-labels' }, [
                h('span', { style: 'color:#C0392B', text: 'Negative self-talk' }),
                h('span', { style: 'color:#27AE60', text: 'Your positive rewrite' })
            ]));

            NEGATIVE_STATEMENTS.forEach(function (statement, idx) {
                body.appendChild(h('div', { class: 'reflect-row' }, [
                    h('textarea', { class: 'reflect-negative', readonly: 'readonly', text: statement }),
                    h('textarea', {
                        class: 'reflect-positive', placeholder: 'Rewrite it…', value: responses[idx],
                        oninput: function (e) { responses[idx] = e.target.value; }
                    })
                ]));
            });

            var dl = btn('⬇ Download as PDF', function () {
                withPdf(function (doc, pageWidth) {
                    var margin = 20, usable = pageWidth - margin * 2;
                    var y = pdfHeader(doc, pageWidth);

                    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(11, 42, 91);
                    doc.text('Positive Affirmations', pageWidth / 2, y, { align: 'center' }); y += 8;
                    doc.setFontSize(11); doc.setTextColor(80, 80, 80);
                    doc.text('Turn negative self-talk into positive self-talk', pageWidth / 2, y, { align: 'center' }); y += 8;
                    doc.setTextColor(50, 50, 50);
                    doc.text('Name: ' + (name.trim() || 'Student'), pageWidth / 2, y, { align: 'center' }); y += 14;

                    NEGATIVE_STATEMENTS.forEach(function (statement, idx) {
                        if (y > 255) { doc.addPage(); y = pdfHeader(doc, pageWidth); }
                        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(192, 57, 43);
                        var neg = doc.splitTextToSize((idx + 1) + '. [Negative] ' + statement, usable);
                        doc.text(neg, margin, y); y += neg.length * 5 + 3;

                        doc.setFont('helvetica', 'normal'); doc.setTextColor(39, 174, 96);
                        var pos = doc.splitTextToSize('   [Positive] ' + (responses[idx] || '(not filled)'), usable);
                        doc.text(pos, margin, y); y += pos.length * 5 + 10;
                    });

                    pdfFooter(doc, pageWidth);
                }, dl, function () { return 'Positive Affirmations_' + (name.trim() || 'Student') + '.pdf'; });
            });

            body.appendChild(h('div', { class: 'tool-controls' }, [dl]));
        }

        // ---- Tab 2: Action Plan ----
        function drawActionPlan() {
            body.innerHTML = '';
            body.appendChild(h('div', { class: 'tool-controls' }, [
                field('Name', h('input', {
                    type: 'text', class: 'tool-input', value: ap.name,
                    oninput: function (e) { ap.name = e.target.value; }
                })),
                field('Day', h('input', {
                    type: 'text', class: 'tool-input', placeholder: 'e.g. Day 1', value: ap.day,
                    oninput: function (e) { ap.day = e.target.value; }
                }))
            ]));

            body.appendChild(h('h3', { class: 'result-subhead', text: 'Reflection statement' }));
            body.appendChild(h('textarea', {
                class: 'reflect-positive', style: 'width:100%;min-height:110px',
                placeholder: 'What did you notice about yourself today?', value: ap.reflection,
                oninput: function (e) { ap.reflection = e.target.value; }
            }));

            body.appendChild(h('h3', { class: 'result-subhead', text: 'Action plans' }));
            ap.actions.forEach(function (_, idx) {
                body.appendChild(h('textarea', {
                    class: 'reflect-positive', style: 'width:100%;min-height:70px;margin-bottom:10px',
                    placeholder: 'Action plan ' + (idx + 1), value: ap.actions[idx],
                    oninput: function (e) { ap.actions[idx] = e.target.value; }
                }));
            });

            var dl = btn('⬇ Download as PDF', function () {
                withPdf(function (doc, pageWidth) {
                    var margin = 20, usable = pageWidth - margin * 2;
                    var y = pdfHeader(doc, pageWidth);

                    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(11, 42, 91);
                    doc.text('Action Plan', pageWidth / 2, y, { align: 'center' }); y += 10;

                    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(50, 50, 50);
                    doc.text('Name: ' + (ap.name.trim() || 'Student'), margin, y); y += 7;
                    doc.text('Day: ' + (ap.day.trim() || '-'), margin, y); y += 12;

                    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(106, 61, 232);
                    doc.text('Reflection Statement', margin, y); y += 7;
                    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(50, 50, 50);
                    var ref = doc.splitTextToSize(ap.reflection || '(not filled)', usable);
                    doc.text(ref, margin, y); y += ref.length * 5 + 10;

                    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(52, 168, 83);
                    doc.text('Action Plans', margin, y); y += 8;

                    ap.actions.forEach(function (action, idx) {
                        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(50, 50, 50);
                        var lines = doc.splitTextToSize('Action Plan ' + (idx + 1) + ': ' + (action || '(not filled)'), usable);
                        doc.text(lines, margin, y); y += lines.length * 5 + 6;
                    });

                    pdfFooter(doc, pageWidth);
                }, dl, function () { return 'Action Plan_' + (ap.name.trim() || 'Student') + '.pdf'; });
            });

            body.appendChild(h('div', { class: 'tool-controls' }, [dl]));
        }

        // ---- Tab 3: Learning Reflection ----
        var LEARNING_LABELS = [
            'The most important thing I learned today:',
            'Another useful thing I learned:',
            'Something I want to remember for a long time:'
        ];

        function drawLearning() {
            body.innerHTML = '';
            body.appendChild(h('div', { class: 'tool-controls' }, [
                field('Name', h('input', {
                    type: 'text', class: 'tool-input', value: lr.name,
                    oninput: function (e) { lr.name = e.target.value; }
                })),
                field('Date', h('input', {
                    type: 'date', class: 'tool-input', value: lr.date,
                    oninput: function (e) { lr.date = e.target.value; }
                })),
                field('Session topic', h('input', {
                    type: 'text', class: 'tool-input', value: lr.topic,
                    oninput: function (e) { lr.topic = e.target.value; }
                }))
            ]));

            body.appendChild(h('h3', { class: 'result-subhead', text: 'My top 3 learnings' }));
            LEARNING_LABELS.forEach(function (label, idx) {
                body.appendChild(h('label', { class: 'tool-stat-label', style: 'display:block;margin:10px 0 4px', text: (idx + 1) + '. ' + label }));
                body.appendChild(h('textarea', {
                    class: 'reflect-positive', style: 'width:100%;min-height:70px', value: lr.learnings[idx],
                    oninput: function (e) { lr.learnings[idx] = e.target.value; }
                }));
            });

            body.appendChild(h('h3', { class: 'result-subhead', text: 'My top 5 todos for tomorrow' }));
            lr.todos.forEach(function (_, idx) {
                body.appendChild(h('input', {
                    type: 'text', class: 'tool-input', style: 'width:100%;margin-bottom:8px',
                    placeholder: 'Todo ' + (idx + 1), value: lr.todos[idx],
                    oninput: function (e) { lr.todos[idx] = e.target.value; }
                }));
            });

            var dl = btn('⬇ Download as PDF', function () {
                withPdf(function (doc, pageWidth) {
                    var margin = 20, usable = pageWidth - margin * 2;
                    var y = pdfHeader(doc, pageWidth);

                    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(11, 42, 91);
                    doc.text('My Learning Reflection', pageWidth / 2, y, { align: 'center' }); y += 12;

                    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(50, 50, 50);
                    doc.text('Name: ' + (lr.name.trim() || '-'), margin, y); y += 7;
                    doc.text('Date: ' + (lr.date.trim() || '-'), margin, y); y += 7;
                    doc.text('Session Topic: ' + (lr.topic.trim() || '-'), margin, y); y += 14;

                    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(255, 107, 0);
                    doc.text('My Top 3 Learnings', margin, y); y += 8;

                    LEARNING_LABELS.forEach(function (label, idx) {
                        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(80, 80, 80);
                        doc.text((idx + 1) + '. ' + label, margin, y); y += 6;
                        doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
                        var lines = doc.splitTextToSize(lr.learnings[idx] || '(not filled)', usable - 5);
                        doc.text(lines, margin + 5, y); y += lines.length * 5 + 8;
                    });

                    y += 4;
                    if (y > 240) { doc.addPage(); y = pdfHeader(doc, pageWidth); }
                    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(30, 94, 255);
                    doc.text('My Top 5 Todos for Tomorrow', margin, y); y += 8;

                    lr.todos.forEach(function (todo, idx) {
                        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(50, 50, 50);
                        var lines = doc.splitTextToSize((idx + 1) + '. ' + (todo || '(not filled)'), usable);
                        doc.text(lines, margin, y); y += lines.length * 5 + 6;
                    });

                    pdfFooter(doc, pageWidth);
                }, dl, function () { return 'Learning Reflection_' + (lr.name.trim() || 'Student') + '.pdf'; });
            });

            body.appendChild(h('div', { class: 'tool-controls' }, [dl]));
        }

        var tabs = toggleGroup([
            { label: '🪞 Positive Affirmations', value: 'affirmation' },
            { label: '🎯 Action Plan', value: 'action' },
            { label: '📝 Learning Reflection', value: 'learning' }
        ], 'affirmation', function (v) {
            tab = v;
            if (v === 'affirmation') drawAffirmation();
            else if (v === 'action') drawActionPlan();
            else drawLearning();
        });

        host.appendChild(card([
            head('🪞 Reflects', 'Turn negative self-talk into positive affirmations, and turn today into a plan'),
            tabs.el,
            body
        ]));
        host.appendChild(backBar());

        drawAffirmation();

        // Nothing async is left running; the PDF work is per-click.
        return function () { };
    }

    // =====================================================================
    // Registry
    // =====================================================================

    var TOOL_IMPLS = {
        'audio': audioTool,
        'nlp': nlpTool,
        'mandala': mandalaTool,
        'focus-grid': focusGridTool,
        'peg-system': pegSystemTool,
        'speed-reading': speedReadingTool,
        'ball-focus': ballFocusTool,
        'eye-exercise': eyeExerciseTool,
        'mental-math': mentalMathTool,
        'timer': timerTool,
        'reflects': reflectsTool
    };

    window.SLATools = {
        mount: function (id, hostEl, ctx) {
            h = ctx.h;
            svgEl = ctx.svg;
            go = ctx.go;

            var impl = TOOL_IMPLS[id];
            if (!impl) {
                hostEl.appendChild(card([h('p', { text: 'That tool is not available.' })]));
                return function () { };
            }
            return impl(hostEl, ctx) || function () { };
        },
        ids: Object.keys(TOOL_IMPLS)
    };
})();
