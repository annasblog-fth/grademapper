/* grademapper: speech tools, notes and doodle pad. */
(function () {
  'use strict';
  const LG = window.LG;
  const u = LG.u, ui = LG.ui, store = LG.store;
  const views = LG.tools.views;

  // ---------------------------------------------------------------- speech
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const LANGS = [
    ['en-US', 'English (US)'], ['en-CA', 'English (Canada)'], ['en-GB', 'English (UK)'], ['fr-CA', 'French (Canada)'], ['fr-FR', 'French (France)'],
    ['es-ES', 'Spanish'], ['de-DE', 'German'], ['zh-CN', 'Chinese (Mandarin)'], ['pa-IN', 'Punjabi'], ['hi-IN', 'Hindi'], ['ja-JP', 'Japanese'], ['ko-KR', 'Korean'],
  ];
  let transcript = '';
  let rec = null;
  let listening = false;
  let panelView = null;       // the Speech tools screen, only while it is open
  let ttsOn = false;
  const SP = (LG.tools.speech = { _fn: [], on(fn) { SP._fn.push(fn); }, off(fn) { SP._fn = SP._fn.filter((f) => f !== fn); }, listening: () => listening, speaking: () => ttsOn });
  const spEmit = () => SP._fn.slice().forEach((f) => f());

  function stopRec() {
    if (rec) { try { rec.onend = null; rec.stop(); } catch (e) { /* ignore */ } }
    rec = null; const was = listening; listening = false;
    if (was) { if (panelView) panelView.paint('Stopped.'); spEmit(); }
  }
  SP.stopRecording = stopRec;
  SP.stopReading = () => { if (window.speechSynthesis) window.speechSynthesis.cancel(); ttsOn = false; spEmit(); };

  /** Start listening. Works with or without the Speech tools screen open, so recording carries on while the person uses other pages. */
  function startRec(lang) {
    rec = new SR();
    rec.lang = lang;
    rec.continuous = true; rec.interimResults = true;
    let base = transcript ? transcript.replace(/\s*$/, ' ') : '';
    rec.onresult = (e) => {
      let fin = '', interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) fin += r[0].transcript; else interim += r[0].transcript;
      }
      base += fin;
      transcript = base + interim;
      if (panelView) panelView.showText(transcript);
    };
    rec.onerror = (e) => {
      const msg = e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Microphone is blocked. Allow it in your browser settings and try again.' : e.error === 'no-speech' ? 'I did not hear anything. Try again closer to the sound.' : e.error === 'network' ? 'Speech to text needs a connection in this browser.' : 'Recording stopped (' + e.error + ').';
      if (panelView) panelView.paint(msg);
      if (e.error !== 'no-speech') { listening = false; spEmit(); if (panelView) panelView.paintBtn(); }
    };
    // Browsers end long sessions on their own, so quietly start again until the person presses stop.
    rec.onend = () => { if (listening) { try { rec.start(); } catch (err) { listening = false; spEmit(); if (panelView) panelView.paintBtn(); } } };
    try { rec.start(); listening = true; spEmit(); return true; } catch (err) { rec = null; return false; }
  }

  views.speech = {
    title: 'Speech tools',
    render(el) {
      const voices = () => (window.speechSynthesis ? window.speechSynthesis.getVoices() : []);
      el.innerHTML =
        '<section class="card tool" aria-labelledby="st-h"><h2 id="st-h">Lecture to text</h2>' +
        (SR ? '<p class="muted">Press record and talk or hold your phone near the speaker. The words appear below, ready to save as a note.</p>' +
          '<div class="field narrow"><label class="lbl" for="sr-lang">Language</label><select class="in" id="sr-lang">' + ui.options(LANGS.map((l) => ({ value: l[0], label: l[1] })), (navigator.language && LANGS.some((l) => l[0] === navigator.language)) ? navigator.language : 'en-US') + '</select></div>' +
          '<div class="row-wrap"><button type="button" class="btn primary big" id="sr-go">' + u.icon('mic') + ' Start recording</button></div>' +
          '<p class="muted" id="sr-status" aria-live="polite"></p>' +
          '<div class="field"><label class="lbl" for="sr-text">Transcript</label><textarea class="in" id="sr-text" rows="9" placeholder="Your words will appear here. You can fix mistakes by typing."></textarea></div>' +
          '<div class="row-wrap"><button type="button" class="btn" id="sr-save">Save as note</button><button type="button" class="btn" id="sr-copy">Copy</button><button type="button" class="btn quiet" id="sr-clear">Clear</button></div>' +
          '<p class="hint">Privacy note: in many browsers (Chrome, Edge, Safari) the browser itself sends your voice to its maker\'s servers to turn it into text. grademapper never sees or stores the audio. Skip this tool if that is not okay for your class.</p>'
          : '<p>Speech to text is not available in this browser. Try Chrome, Edge or Safari on your phone or computer.</p>') + '</section>' +

        '<section class="card tool" aria-labelledby="tts-h"><h2 id="tts-h">Read text aloud</h2>' +
        (window.speechSynthesis ?
          '<div class="field"><label class="lbl" for="tts-text">Text to read</label><textarea class="in" id="tts-text" rows="5" placeholder="Paste notes or an essay draft. Hearing it often shows what to fix."></textarea></div>' +
          '<div class="form-grid"><div class="field"><label class="lbl" for="tts-voice">Voice</label><select class="in" id="tts-voice"></select></div>' +
          '<div class="field"><label class="lbl" for="tts-rate">Speed <output id="tts-rate-out">1x</output></label><input type="range" id="tts-rate" min="0.6" max="1.6" step="0.1" value="1"></div></div>' +
          '<div class="row-wrap"><button type="button" class="btn primary" id="tts-go">' + u.icon('speaker') + ' Read aloud</button><button type="button" class="btn" id="tts-stop">' + u.icon('stop') + ' Stop</button></div>'
          : '<p>Reading aloud is not available in this browser.</p>') + '</section>';

      if (SR) {
        const ta = u.$('#sr-text', el), go = u.$('#sr-go', el), st = u.$('#sr-status', el);
        ta.value = transcript;
        ta.addEventListener('input', () => { transcript = ta.value; });
        const paintBtn = () => { go.innerHTML = listening ? u.icon('stop') + ' Stop recording' : u.icon('mic') + ' Start recording'; go.classList.toggle('rec', listening); };
        panelView = {
          paint: (msg) => { st.textContent = msg; },
          paintBtn,
          showText: (t) => { ta.value = t; ta.scrollTop = ta.scrollHeight; },
        };
        paintBtn();
        if (listening) st.textContent = 'Listening...';
        go.addEventListener('click', () => {
          if (listening) { stopRec(); paintBtn(); st.textContent = 'Stopped.'; return; }
          transcript = ta.value;
          if (startRec(u.$('#sr-lang', el).value)) { st.textContent = 'Listening... you can close this panel and keep recording.'; paintBtn(); } else st.textContent = 'Could not start the microphone.';
        });
        u.$('#sr-save', el).addEventListener('click', () => {
          if (!ta.value.trim()) { ui.toast('Record something first.'); return; }
          LG.tools.addNote('Lecture ' + new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), ta.value.trim());
          ui.toast('Saved to Notes.');
        });
        u.$('#sr-copy', el).addEventListener('click', async () => ui.toast((await u.copy(ta.value)) ? 'Copied.' : 'Could not copy. Select the text and copy it by hand.'));
        u.$('#sr-clear', el).addEventListener('click', () => { ta.value = ''; transcript = ''; if (listening) { stopRec(); paintBtn(); st.textContent = 'Stopped.'; } });
      }

      if (window.speechSynthesis) {
        const sel = u.$('#tts-voice', el);
        const fill = () => {
          const v = voices();
          sel.innerHTML = v.length ? v.map((x, i) => '<option value="' + i + '">' + u.esc(x.name + ' (' + x.lang + ')') + '</option>').join('') : '<option value="">Default voice</option>';
          const pref = v.findIndex((x) => x.lang === navigator.language) ;
          if (pref >= 0) sel.value = String(pref);
        };
        fill();
        window.speechSynthesis.onvoiceschanged = fill;
        u.$('#tts-rate', el).addEventListener('input', (e) => { u.$('#tts-rate-out', el).textContent = e.target.value + 'x'; });
        u.$('#tts-go', el).addEventListener('click', () => {
          const text = u.$('#tts-text', el).value.trim();
          if (!text) { ui.toast('Paste some text first.'); return; }
          window.speechSynthesis.cancel();
          const ut = new SpeechSynthesisUtterance(text);
          const v = voices()[Number(sel.value)];
          if (v) { ut.voice = v; ut.lang = v.lang; }
          ut.rate = Number(u.$('#tts-rate', el).value);
          ut.onstart = () => { ttsOn = true; spEmit(); };
          ut.onend = ut.onerror = () => { ttsOn = false; spEmit(); };
          window.speechSynthesis.speak(ut);
        });
        u.$('#tts-stop', el).addEventListener('click', () => SP.stopReading());
      }
    },
    leave() { panelView = null; },  // recording and reading aloud carry on; the popup has their stop buttons
  };

  // ----------------------------------------------------------------- notes
  let openNote = null;
  views.notes = {
    title: 'Notes',
    render(el) {
      const notes = store.state.notes;
      const paintList = () => {
        const q = (u.$('#nt-q', el).value || '').toLowerCase();
        const list = notes.filter((n) => !q || (n.title + ' ' + n.body).toLowerCase().includes(q));
        u.$('#nt-list', el).innerHTML = list.length
          ? list.map((n) => '<li><button type="button" class="note-item" data-id="' + n.id + '"><strong>' + u.esc(n.title || 'Untitled') + '</strong><span class="muted">' + u.esc((n.body || '').replace(/\s+/g, ' ').slice(0, 90)) + '</span><small class="muted">' + new Date(n.updated).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + '</small></button></li>').join('')
          : '<li class="empty">' + (notes.length ? 'No notes match that search.' : 'No notes yet. Add one, or save a lecture transcript here.') + '</li>';
      };
      const showEditor = (n) => {
        openNote = n ? n.id : null;
        const box = u.$('#nt-editor', el);
        if (!n) { box.hidden = true; u.$('#nt-main', el).hidden = false; return; }
        u.$('#nt-main', el).hidden = true; box.hidden = false;
        box.innerHTML = '<div class="field"><label class="lbl" for="nt-title">Title</label><input class="in" id="nt-title" value="' + u.esc(n.title) + '" autocomplete="off"></div>' +
          '<div class="field"><label class="lbl" for="nt-body">Note</label><textarea class="in" id="nt-body" rows="12">' + u.esc(n.body) + '</textarea></div>' +
          '<p class="muted" id="nt-count"></p><div class="row-wrap"><button type="button" class="btn primary" id="nt-done">' + u.icon('check') + ' Done</button><button type="button" class="btn" id="nt-copy">Copy</button><button type="button" class="btn danger" id="nt-del">' + u.icon('trash') + ' Delete</button></div>';
        const body = u.$('#nt-body', box), title = u.$('#nt-title', box);
        const count = () => { u.$('#nt-count', box).textContent = LG.tools.wordStats(body.value).words + ' words'; };
        const save = () => { n.title = title.value; n.body = body.value; n.updated = Date.now(); store.save(); count(); };
        body.addEventListener('input', save); title.addEventListener('input', save); count();
        u.$('#nt-done', box).addEventListener('click', () => { if (!n.title.trim() && !n.body.trim()) notes.splice(notes.indexOf(n), 1); store.save(); showEditor(null); paintList(); });
        u.$('#nt-copy', box).addEventListener('click', async () => ui.toast((await u.copy(body.value)) ? 'Copied.' : 'Could not copy. Select the text and copy it by hand.'));
        u.$('#nt-del', box).addEventListener('click', async () => {
          const ok = await ui.confirm({ title: 'Delete this note?', body: 'You can undo right after.', confirmLabel: 'Delete', danger: true });
          if (!ok) return;
          const idx = notes.indexOf(n); notes.splice(idx, 1); store.save(); showEditor(null); paintList();
          ui.toast('Note deleted.', { actionLabel: 'Undo', onAction: () => { notes.splice(idx, 0, n); store.save(); paintList(); } });
        });
        title.focus();
      };
      el.innerHTML = '<div id="nt-main"><div class="row-between wrap"><button type="button" class="btn primary" id="nt-new">' + u.icon('plus') + ' New note</button>' +
        '<div class="field grow"><label class="lbl" for="nt-q">Search</label><input class="in" type="search" id="nt-q" placeholder="Search notes" autocomplete="off"></div></div>' +
        '<ul class="plain-list note-list" id="nt-list"></ul></div><div id="nt-editor" class="card tool" hidden></div>';
      paintList();
      u.$('#nt-q', el).addEventListener('input', paintList);
      u.$('#nt-new', el).addEventListener('click', () => { const n = { id: u.uid('n'), title: '', body: '', updated: Date.now() }; notes.unshift(n); store.save(); showEditor(n); });
      u.$('#nt-list', el).addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) showEditor(notes.filter((n) => n.id === b.dataset.id)[0]); });
      if (openNote) { const n = notes.filter((x) => x.id === openNote)[0]; if (n) showEditor(n); }
    },
    leave() { openNote = null; },
  };

  // ---------------------------------------------------------------- doodle
  const INKS = ['#111111', '#d6336c', '#e8590c', '#f2b705', '#2f9e44', '#1c7ed6', '#7048e8', '#ffffff'];
  let doodleData = null;
  views.doodle = {
    title: 'Doodle pad',
    render(el) {
      el.innerHTML = '<div class="card tool"><div class="doodle-tools">' +
        '<div class="inks" id="dd-inks" role="group" aria-label="Pen colour">' + INKS.map((c, i) => '<button type="button" class="ink" data-c="' + c + '" style="background:' + c + '" aria-label="Colour ' + (i + 1) + '" aria-pressed="' + (i === 0) + '"></button>').join('') + '</div>' +
        '<div class="field grow"><label class="lbl" for="dd-size">Pen size</label><input type="range" id="dd-size" min="1" max="30" value="5"></div></div>' +
        '<div class="canvas-wrap"><canvas id="dd-canvas" aria-label="Drawing area. Draw with your finger or mouse."></canvas></div>' +
        '<div class="row-wrap"><button type="button" class="btn" id="dd-undo">' + u.icon('back') + ' Undo</button><button type="button" class="btn" id="dd-eraser" aria-pressed="false">Eraser</button><button type="button" class="btn" id="dd-clear">Clear</button><button type="button" class="btn primary" id="dd-save">' + u.icon('download') + ' Save picture</button></div>' +
        '<p class="hint">Drawings are not saved when you leave this page, so save the picture if you want to keep it.</p></div>';
      const cv = u.$('#dd-canvas', el);
      const ctx = cv.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const history = [];
      let ink = INKS[0], erase = false, drawing = false, last = null;
      const paper = () => '#ffffff';
      const size = () => {
        const w = cv.parentElement.clientWidth;
        const h = Math.round(Math.min(w * 1.1, 480));
        const prev = doodleData;
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
        cv.style.width = w + 'px'; cv.style.height = h + 'px';
        ctx.fillStyle = paper(); ctx.fillRect(0, 0, cv.width, cv.height);
        if (prev) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, cv.width, cv.height); img.src = prev; }
      };
      size();
      const snapshot = () => { history.push(ctx.getImageData(0, 0, cv.width, cv.height)); if (history.length > 20) history.shift(); doodleData = cv.toDataURL(); };
      const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * cv.width, y: ((e.clientY - r.top) / r.height) * cv.height }; };
      const line = (a, b) => {
        ctx.strokeStyle = erase ? paper() : ink; ctx.lineWidth = Number(u.$('#dd-size', el).value) * dpr * (erase ? 2 : 1);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      };
      cv.addEventListener('pointerdown', (e) => { e.preventDefault(); cv.setPointerCapture(e.pointerId); snapshot(); drawing = true; last = pos(e); line(last, { x: last.x + 0.01, y: last.y }); });
      cv.addEventListener('pointermove', (e) => { if (!drawing) return; const p = pos(e); line(last, p); last = p; });
      const end = () => { if (drawing) { drawing = false; doodleData = cv.toDataURL(); } };
      cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
      u.$('#dd-inks', el).addEventListener('click', (e) => {
        const b = e.target.closest('[data-c]'); if (!b) return;
        ink = b.dataset.c; erase = false; u.$('#dd-eraser', el).setAttribute('aria-pressed', 'false');
        u.$$('#dd-inks .ink', el).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      });
      u.$('#dd-eraser', el).addEventListener('click', (e) => { erase = !erase; e.currentTarget.setAttribute('aria-pressed', String(erase)); });
      u.$('#dd-undo', el).addEventListener('click', () => { const s = history.pop(); if (s) { ctx.putImageData(s, 0, 0); doodleData = cv.toDataURL(); } });
      u.$('#dd-clear', el).addEventListener('click', () => { snapshot(); ctx.fillStyle = paper(); ctx.fillRect(0, 0, cv.width, cv.height); doodleData = cv.toDataURL(); });
      u.$('#dd-save', el).addEventListener('click', () => cv.toBlob((b) => { if (b) { u.download('doodle.png', b, 'image/png'); ui.toast('Picture saved.'); } }, 'image/png'));
    },
    leave() { /* keep the last drawing in memory while the app stays open */ },
  };
})();
