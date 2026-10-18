/* Little Grades: mini tools (focus timer, sound player, word counter). Speech, notes and doodle are in tools-media.js. */
(function () {
  'use strict';
  const LG = window.LG;
  const u = LG.u, E = LG.E, ui = LG.ui, store = LG.store;

  const tools = (LG.tools = { views: {}, timer: null, noise: null });
  const P = (LG.pages.tools = {});

  // ---------------------------------------------------------------- sound
  let audioCtx = null;
  const getCtx = () => {
    if (!audioCtx) { const AC = window.AudioContext || window.webkitAudioContext; audioCtx = AC ? new AC() : null; }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  };
  /** A soft two-note chime. Safe to call without audio support. */
  function chime() {
    try {
      const ctx = getCtx(); if (!ctx) return;
      [660, 880].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        const t0 = ctx.currentTime + i * 0.22;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
        o.connect(g); g.connect(ctx.destination); o.start(t0); o.stop(t0 + 1);
      });
    } catch (e) { /* ignore */ }
    try { if (navigator.vibrate) navigator.vibrate([120, 80, 120]); } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------- timer
  const PRESETS = [
    { id: '25', label: 'Focus 25, break 5', focus: 25, brk: 5 },
    { id: '50', label: 'Deep 50, break 10', focus: 50, brk: 10 },
    { id: '15', label: 'Quick 15, break 3', focus: 15, brk: 3 },
    { id: 'custom', label: 'Countdown' },
    { id: 'stopwatch', label: 'Stopwatch' },
  ];
  const T = (tools.timer = {
    preset: '25', customMin: 20, phase: 'focus', total: 25 * 60000, left: 25 * 60000,
    endAt: 0, startedAt: 0, elapsed: 0, running: false, sessions: 0, _iv: null, _fn: [],
  });
  const presetOf = (id) => PRESETS.filter((p) => p.id === id)[0];
  T.on = (fn) => { T._fn.push(fn); };
  T.off = (fn) => { T._fn = T._fn.filter((f) => f !== fn); };
  const emit = () => T._fn.slice().forEach((f) => f());
  T.isStopwatch = () => T.preset === 'stopwatch';
  T.remaining = () => (T.running && !T.isStopwatch() ? Math.max(0, T.endAt - Date.now()) : T.left);
  T.elapsedMs = () => (T.running ? Date.now() - T.startedAt : T.elapsed);
  T.progress = () => (T.isStopwatch() || !T.total ? 0 : 1 - T.remaining() / T.total);
  T.label = () => {
    const ms = T.isStopwatch() ? T.elapsedMs() : T.remaining();
    const s = Math.ceil(T.isStopwatch() ? ms / 1000 - 0.999 : ms / 1000);
    return u.pad(Math.floor(s / 60)) + ':' + u.pad(s % 60);
  };
  T.phaseLabel = () => (T.isStopwatch() ? 'Stopwatch' : T.preset === 'custom' ? 'Countdown' : T.phase === 'focus' ? 'Focus time' : 'Break time');
  T.setPreset = (id) => {
    T.pause(true);
    T.preset = id; T.phase = 'focus';
    const p = presetOf(id);
    if (id === 'stopwatch') { T.total = 0; T.left = 0; T.elapsed = 0; }
    else if (id === 'custom') { T.total = Math.max(1, Number(T.customMin) || 1) * 60000; T.left = T.total; }
    else { T.total = p.focus * 60000; T.left = T.total; }
    emit();
  };
  T.setCustom = (min) => { T.customMin = min; if (T.preset === 'custom' && !T.running) T.setPreset('custom'); };
  T.start = () => {
    if (T.running) return;
    getCtx(); // unlock audio on this tap so the chime can play later
    if (T.isStopwatch()) T.startedAt = Date.now() - T.elapsed;
    else { if (T.left <= 0) T.left = T.total; T.endAt = Date.now() + T.left; }
    T.running = true;
    if (!T._iv) T._iv = setInterval(tick, 250);
    emit();
  };
  T.pause = (silent) => {
    if (!T.running) return;
    if (T.isStopwatch()) T.elapsed = Date.now() - T.startedAt; else T.left = Math.max(0, T.endAt - Date.now());
    T.running = false;
    clearInterval(T._iv); T._iv = null;
    if (!silent) emit();
  };
  T.reset = () => {
    T.pause(true);
    T.phase = 'focus';
    T.setPreset(T.preset);
  };
  function tick() {
    if (T.running && !T.isStopwatch() && Date.now() >= T.endAt) finish();
    emit();
  }
  function finish() {
    T.running = false; clearInterval(T._iv); T._iv = null; T.left = 0;
    chime();
    const p = presetOf(T.preset);
    if (p && p.focus) {
      if (T.phase === 'focus') {
        T.sessions += 1;
        T.phase = 'break'; T.total = p.brk * 60000; T.left = T.total;
        ui.toast('Nice focus! Time for a ' + p.brk + ' minute break.', { ms: 9000 });
      } else {
        T.phase = 'focus'; T.total = p.focus * 60000; T.left = T.total;
        ui.toast('Break is over. Ready for another round when you are.', { ms: 9000 });
      }
    } else {
      T.left = T.total;
      ui.toast('Time is up. Well done for sticking with it.', { ms: 9000 });
    }
  }

  /** A little plant that grows while you focus. */
  function sproutSVG(p, resting) {
    const stem = 6 + 46 * Math.min(1, p);
    const top = 78 - stem;
    let parts = '<ellipse class="sp-soil" cx="50" cy="82" rx="26" ry="6"/><path class="sp-pot" d="M30 82h40l-5 16H35z"/>';
    parts += '<path class="sp-stem" d="M50 82V' + top.toFixed(1) + '"/>';
    if (p > 0.22) parts += '<path class="sp-leaf" d="M50 ' + (top + stem * 0.45).toFixed(1) + 'q-18 -2 -20 -16q16 -2 20 16z"/>';
    if (p > 0.5) parts += '<path class="sp-leaf" d="M50 ' + (top + stem * 0.3).toFixed(1) + 'q18 -2 20 -16q-16 -2 -20 16z"/>';
    if (p > 0.82 || resting) {
      const cy = top;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * 6.2832;
        parts += '<circle class="sp-petal" cx="' + (50 + Math.cos(a) * 9).toFixed(1) + '" cy="' + (cy + Math.sin(a) * 9).toFixed(1) + '" r="6"/>';
      }
      parts += '<circle class="sp-core" cx="50" cy="' + cy.toFixed(1) + '" r="5"/>';
    } else if (p > 0.05) parts += '<circle class="sp-bud" cx="50" cy="' + top.toFixed(1) + '" r="' + (3 + p * 4).toFixed(1) + '"/>';
    return '<svg class="sprout" viewBox="0 0 100 100" aria-hidden="true">' + parts + '</svg>';
  }

  tools.views.timer = {
    title: 'Focus timer',
    render(el) {
      el.innerHTML =
        '<div class="card tool"><div class="seg wrap" id="tm-presets" role="group" aria-label="Timer type">' +
        PRESETS.map((p) => '<button type="button" data-v="' + p.id + '" aria-pressed="' + (T.preset === p.id) + '">' + u.esc(p.label) + '</button>').join('') + '</div>' +
        '<div class="field narrow" id="tm-custom" ' + (T.preset === 'custom' ? '' : 'hidden') + '><label class="lbl" for="tm-min">Minutes</label><input class="in num" id="tm-min" inputmode="numeric" value="' + T.customMin + '"></div>' +
        '<div class="timer-stage"><div id="tm-plant"></div><p class="timer-phase" id="tm-phase"></p><p class="timer-time" id="tm-time" role="timer"></p></div>' +
        '<div class="row-wrap center"><button type="button" class="btn primary big" id="tm-go"></button><button type="button" class="btn" id="tm-reset">' + u.icon('reset') + ' Reset</button></div>' +
        '<p class="muted center" id="tm-sessions"></p></div>' +
        '<p class="hint">The timer keeps running if you visit other pages. You will hear a soft chime when it finishes.</p>';
      const paint = () => {
        u.$('#tm-time', el).textContent = T.label();
        u.$('#tm-phase', el).textContent = T.phaseLabel() + (T.running ? '' : T.left < T.total || T.elapsed ? ' (paused)' : '');
        const go = u.$('#tm-go', el);
        const html = T.running ? u.icon('pause') + ' Pause' : u.icon('play') + ' Start';
        if (go.dataset.h !== html) { go.innerHTML = html; go.dataset.h = html; }
        u.$('#tm-plant', el).innerHTML = sproutSVG(T.isStopwatch() ? 0.1 : T.phase === 'break' ? 1 : T.progress(), T.phase === 'break' && !T.isStopwatch());
        u.$('#tm-sessions', el).textContent = T.sessions ? 'Focus sessions finished today: ' + T.sessions : '';
      };
      this._paint = paint;
      T.on(paint); paint();
      u.$('#tm-presets', el).addEventListener('click', (e) => {
        const b = e.target.closest('[data-v]'); if (!b) return;
        T.setPreset(b.dataset.v);
        u.$$('#tm-presets button', el).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        u.$('#tm-custom', el).hidden = b.dataset.v !== 'custom';
      });
      u.$('#tm-min', el).addEventListener('input', (e) => { const n = E.num(e.target.value); if (n !== null && n > 0 && n <= 600) T.setCustom(n); });
      u.$('#tm-go', el).addEventListener('click', () => (T.running ? T.pause() : T.start()));
      u.$('#tm-reset', el).addEventListener('click', () => T.reset());
    },
    leave() { if (this._paint) T.off(this._paint); },
  };

  // ---------------------------------------------------------------- noise
  const N = (tools.noise = { type: null, vol: 0.4, endAt: 0, _src: null, _master: null, _nodes: [], _sleep: null, _fn: [] });
  N.on = (fn) => { N._fn.push(fn); };
  N.off = (fn) => { N._fn = N._fn.filter((f) => f !== fn); };
  const nEmit = () => N._fn.slice().forEach((f) => f());
  const buffers = {};
  function makeBuffer(ctx, kind) {
    if (buffers[kind]) return buffers[kind];
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w * 0.5;
      else if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      }
    }
    buffers[kind] = buf;
    return buf;
  }
  N.SOUNDS = [
    { id: 'white', label: 'White noise', note: 'Even and bright. Good for masking chatter.' },
    { id: 'pink', label: 'Pink noise', note: 'Softer than white. Like steady wind.' },
    { id: 'brown', label: 'Brown noise', note: 'Deep and rumbly.' },
    { id: 'rain', label: 'Rain', note: 'Steady rainfall.' },
    { id: 'ocean', label: 'Ocean', note: 'Slow waves.' },
  ];
  N.stop = () => {
    const ctx = audioCtx;
    if (N._src && ctx && N._master) {
      const src = N._src, master = N._master, nodes = N._nodes;
      try { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(0, ctx.currentTime, 0.08); } catch (e) { /* ignore */ }
      setTimeout(() => { try { src.stop(); } catch (e) { /* ignore */ } nodes.forEach((n) => { try { n.disconnect(); if (n.stop) n.stop(); } catch (e) { /* ignore */ } }); }, 400);
    }
    N._src = null; N._master = null; N._nodes = []; N.type = null; N.endAt = 0;
    clearTimeout(N._sleep); N._sleep = null;
    nEmit();
  };
  N.start = (type) => {
    const ctx = getCtx();
    if (!ctx) { ui.toast('This browser cannot play sound here.'); return; }
    if (N._src) { const keepSleep = N.endAt; N.stop(); N.endAt = keepSleep; }
    const kind = type === 'rain' ? 'pink' : type === 'ocean' ? 'brown' : type;
    const src = ctx.createBufferSource();
    src.buffer = makeBuffer(ctx, kind); src.loop = true;
    const master = ctx.createGain();
    master.gain.value = 0.0001;
    const nodes = [];
    let tail = src;
    if (type === 'rain') {
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7500;
      src.connect(hp); hp.connect(lp); tail = lp; nodes.push(hp, lp);
    } else if (type === 'ocean') {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800;
      const wave = ctx.createGain(); wave.gain.value = 0.55;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;
      const depth = ctx.createGain(); depth.gain.value = 0.4;
      lfo.connect(depth); depth.connect(wave.gain); lfo.start();
      src.connect(lp); lp.connect(wave); tail = wave; nodes.push(lp, wave, lfo, depth);
    }
    tail.connect(master); master.connect(ctx.destination);
    src.start();
    master.gain.setTargetAtTime(N.vol, ctx.currentTime, 0.25);
    N._src = src; N._master = master; N._nodes = nodes; N.type = type;
    nEmit();
  };
  N.setVolume = (v) => {
    N.vol = v;
    if (N._master && audioCtx) N._master.gain.setTargetAtTime(v, audioCtx.currentTime, 0.05);
  };
  N.setSleep = (min) => {
    clearTimeout(N._sleep); N._sleep = null; N.endAt = 0;
    if (min > 0) { N.endAt = Date.now() + min * 60000; N._sleep = setTimeout(() => { N.stop(); ui.toast('Sound stopped. Sleep well, or study well.'); }, min * 60000); }
    nEmit();
  };

  tools.views.noise = {
    title: 'Sound player',
    render(el) {
      el.innerHTML =
        '<div class="card tool"><div class="sound-grid" id="sd-list" role="group" aria-label="Sounds">' +
        N.SOUNDS.map((s) => '<button type="button" class="sound" data-v="' + s.id + '" aria-pressed="false"><span class="sound-icon">' + u.icon('wave') + '</span><span><strong>' + s.label + '</strong><small>' + s.note + '</small></span></button>').join('') + '</div>' +
        '<div class="field"><label class="lbl" for="sd-vol">Volume</label><input type="range" id="sd-vol" min="0.05" max="1" step="0.05" value="' + N.vol + '"></div>' +
        '<div class="field narrow"><label class="lbl" for="sd-sleep">Stop after</label><select class="in" id="sd-sleep">' + ui.options([{ value: 0, label: 'Keep playing' }, { value: 15, label: '15 minutes' }, { value: 30, label: '30 minutes' }, { value: 60, label: '1 hour' }], 0) + '</select></div>' +
        '<div class="row-wrap"><button type="button" class="btn" id="sd-stop">' + u.icon('stop') + ' Stop sound</button></div><p class="muted" id="sd-status" aria-live="polite"></p></div>' +
        '<p class="hint">These sounds are made right on your device, so they work offline and there is nothing to download. Playing continues if you visit other pages.</p>';
      const paint = () => {
        u.$$('#sd-list .sound', el).forEach((b) => b.setAttribute('aria-pressed', String(N.type === b.dataset.v)));
        const s = N.SOUNDS.filter((x) => x.id === N.type)[0];
        u.$('#sd-status', el).textContent = s ? 'Playing ' + s.label.toLowerCase() + (N.endAt ? ', stops at ' + new Date(N.endAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '') + '.' : 'Nothing playing.';
      };
      this._paint = paint; N.on(paint); paint();
      u.$('#sd-list', el).addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; if (N.type === b.dataset.v) N.stop(); else N.start(b.dataset.v); });
      u.$('#sd-vol', el).addEventListener('input', (e) => N.setVolume(Number(e.target.value)));
      u.$('#sd-sleep', el).addEventListener('change', (e) => N.setSleep(Number(e.target.value)));
      u.$('#sd-stop', el).addEventListener('click', () => N.stop());
    },
    leave() { if (this._paint) N.off(this._paint); },
  };

  // ---------------------------------------------------------- word counter
  let wordsDraft = '';
  function wordStats(t) {
    const trimmed = t.trim();
    const words = (trimmed.match(/\S+/g) || []).length;
    return {
      words,
      chars: t.length,
      charsNoSpace: t.replace(/\s/g, '').length,
      sentences: trimmed ? trimmed.split(/[.!?]+/).filter((x) => x.trim()).length : 0,
      paragraphs: trimmed ? trimmed.split(/\n\s*\n/).filter((x) => x.trim()).length : 0,
      reading: words ? Math.max(1, Math.round(words / 200)) : 0,
      speaking: words ? Math.max(1, Math.round(words / 130)) : 0,
    };
  }
  tools.wordStats = wordStats;
  tools.views.words = {
    title: 'Word counter',
    render(el) {
      el.innerHTML =
        '<div class="card tool"><div class="field"><label class="lbl" for="wc-text">Your text</label><textarea class="in" id="wc-text" rows="9" placeholder="Type or paste here. Nothing leaves your device."></textarea></div>' +
        '<div class="stat-grid" id="wc-stats" aria-live="polite"></div>' +
        '<div class="field narrow"><label class="lbl" for="wc-goal">Word goal (optional)</label><input class="in num" id="wc-goal" inputmode="numeric" placeholder="500"></div>' +
        '<div class="bar-wrap" id="wc-bar" hidden><div class="bar" role="img" aria-label="Progress toward word goal"><i></i></div><p class="muted" id="wc-bar-txt"></p></div>' +
        '<div class="row-wrap"><button type="button" class="btn" id="wc-copy">' + u.icon('note') + ' Copy</button><button type="button" class="btn" id="wc-save">Save as note</button><button type="button" class="btn quiet" id="wc-clear">Clear</button></div></div>';
      const ta = u.$('#wc-text', el);
      ta.value = wordsDraft;
      const paint = () => {
        const st = wordStats(ta.value);
        wordsDraft = ta.value;
        const tile = (n, l) => '<div class="stat"><b>' + n + '</b><span>' + l + '</span></div>';
        u.$('#wc-stats', el).innerHTML = tile(st.words, 'words') + tile(st.chars, 'characters') + tile(st.charsNoSpace, 'without spaces') + tile(st.sentences, 'sentences') + tile(st.paragraphs, 'paragraphs') + tile(st.reading ? st.reading + ' min' : '0', 'reading time');
        const goal = E.num(u.$('#wc-goal', el).value);
        const wrap = u.$('#wc-bar', el);
        wrap.hidden = !(goal && goal > 0);
        if (!wrap.hidden) {
          const pct = Math.min(100, (st.words / goal) * 100);
          u.$('.bar i', wrap).style.width = pct + '%';
          u.$('#wc-bar-txt', el).textContent = st.words >= goal ? 'Goal reached: ' + st.words + ' of ' + goal + ' words.' : st.words + ' of ' + goal + ' words, ' + (goal - st.words) + ' to go.';
        }
      };
      ta.addEventListener('input', paint);
      u.$('#wc-goal', el).addEventListener('input', paint);
      u.$('#wc-copy', el).addEventListener('click', async () => ui.toast((await u.copy(ta.value)) ? 'Copied.' : 'Could not copy. Select the text and copy it by hand.'));
      u.$('#wc-clear', el).addEventListener('click', () => { ta.value = ''; paint(); ta.focus(); });
      u.$('#wc-save', el).addEventListener('click', () => {
        if (!ta.value.trim()) { ui.toast('Type something first.'); return; }
        tools.addNote('Word counter text', ta.value);
        ui.toast('Saved to Notes.');
      });
      paint();
    },
  };

  /** Add a note from another tool. */
  tools.addNote = (title, body) => {
    const n = { id: u.uid('n'), title, body, updated: Date.now() };
    store.state.notes.unshift(n);
    store.save();
    return n;
  };

  // ------------------------------------------------------------- tools page
  const CARDS = [
    { id: 'timer', icon: 'clock', name: 'Focus timer', blurb: 'Study rounds with a plant that grows.' },
    { id: 'noise', icon: 'wave', name: 'Sound player', blurb: 'White, pink and brown noise, rain, ocean.' },
    { id: 'words', icon: 'count', name: 'Word counter', blurb: 'Words, reading time and a word goal.' },
    { id: 'speech', icon: 'mic', name: 'Speech tools', blurb: 'Turn a lecture into text, or hear text read aloud.' },
    { id: 'notes', icon: 'note', name: 'Notes', blurb: 'Quick notes that stay on your device.' },
    { id: 'doodle', icon: 'pencil', name: 'Doodle pad', blurb: 'Sketch an idea and save it as a picture.' },
  ];
  let activeView = null;
  P.render = (view, params) => {
    const id = params && params[0];
    const v = tools.views[id];
    if (!v) {
      view.innerHTML = '<h1 class="page-title">Tools</h1><p class="muted page-sub">Small helpers for studying. They all work offline.</p>' +
        '<div class="tool-grid">' + CARDS.map((c) => '<a class="tool-card" href="#/tools/' + c.id + '">' + u.icon(c.icon) + '<strong>' + c.name + '</strong><span>' + c.blurb + '</span></a>').join('') + '</div>';
      return;
    }
    const meta = CARDS.filter((c) => c.id === id)[0];
    view.innerHTML = '<p><a class="back" href="#/tools">' + u.icon('back') + ' All tools</a></p><h1 class="page-title">' + u.esc(meta ? meta.name : v.title) + '</h1><div class="tool-body"></div>';
    activeView = v;
    v.render(u.$('.tool-body', view), params.slice(1));
  };
  P.leave = () => { if (activeView && activeView.leave) activeView.leave(); activeView = null; };
  P.title = 'Tools';
})();
