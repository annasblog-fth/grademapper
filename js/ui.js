/* Little Grades: shared UI pieces (toast, dialogs, Pip the mascot, speech bubbles, meter, confetti). */
(function () {
  'use strict';
  const LG = window.LG;
  const u = LG.u;
  const ui = (LG.ui = {});

  const animOn = () => document.documentElement.dataset.anim !== 'off';

  // ----------------------------------------------------------------- toast
  let toastTimer;
  ui.toast = (msg, opts) => {
    const o = opts || {};
    const box = u.$('#toast');
    if (!box) return;
    box.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'toast-pill';
    const span = document.createElement('span');
    span.textContent = msg;
    wrap.appendChild(span);
    if (o.actionLabel) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn small';
      b.textContent = o.actionLabel;
      b.addEventListener('click', () => { box.hidden = true; if (o.onAction) o.onAction(); });
      wrap.appendChild(b);
    }
    box.appendChild(wrap);
    box.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { box.hidden = true; }, o.ms || 7000);
  };

  // ---------------------------------------------------------------- dialogs
  /**
   * A native <dialog>: it traps focus and closes with Esc.
   * actions: [{ label, kind: 'primary'|'ghost'|'danger', value, keepOpen, onClick(dlg) }]
   * Resolves with the value of the action that closed it (or null).
   */
  ui.modal = (opts) => {
    return new Promise((resolve) => {
      const dlg = document.createElement('dialog');
      dlg.className = 'modal';
      const titleId = u.uid('dlg');
      dlg.setAttribute('aria-labelledby', titleId);
      dlg.innerHTML =
        '<div class="modal-head"><h2 id="' + titleId + '">' + u.esc(opts.title || '') + '</h2>' +
        '<button type="button" class="icon-btn" data-close aria-label="Close">' + u.icon('x') + '</button></div>' +
        '<div class="modal-body"></div><div class="modal-actions"></div>';
      const body = u.$('.modal-body', dlg);
      if (typeof opts.html === 'string') body.innerHTML = opts.html;
      else if (opts.html) body.appendChild(opts.html);
      const bar = u.$('.modal-actions', dlg);
      let result = null;
      (opts.actions || []).forEach((a) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn ' + (a.kind || 'ghost');
        b.textContent = a.label;
        b.addEventListener('click', () => {
          if (a.onClick && a.onClick(dlg) === false) return;
          if (a.keepOpen) return;
          result = a.value === undefined ? true : a.value;
          dlg.close();
        });
        bar.appendChild(b);
      });
      if (!bar.children.length) bar.remove();
      u.$('[data-close]', dlg).addEventListener('click', () => dlg.close());
      dlg.addEventListener('close', () => { dlg.remove(); resolve(result); });
      dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
      document.body.appendChild(dlg);
      dlg.showModal();
      if (opts.onOpen) opts.onOpen(dlg);
      else { const first = u.$('input, select, textarea', body); if (first) first.focus(); }
      ui.enhance(dlg);
    });
  };
  ui.confirm = (opts) =>
    ui.modal({
      title: opts.title,
      html: '<p>' + u.esc(opts.body || '') + '</p>',
      actions: [
        { label: opts.cancelLabel || 'Cancel', kind: 'ghost', value: false },
        { label: opts.confirmLabel || 'OK', kind: opts.danger ? 'danger' : 'primary', value: true },
      ],
    }).then((v) => v === true);

  // ------------------------------------------------------------------- Pip
  const MOUTH = {
    happy: '<path d="M25 40q7 7 14 0" />',
    cheer: '<path d="M24 38q8 11 16 0z" fill="var(--accent-ink)"/>',
    calm: '<path d="M27 41q5 3 10 0" />',
    think: '<path d="M27 42h10" />',
  };
  /** Pip, the little sprout who talks to you. Decorative, so hidden from screen readers. */
  ui.pip = (mood) =>
    '<svg class="pip-svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">' +
    '<path class="leaf" d="M32 14c-1-8 5-11 12-10 0 7-4 11-12 10z"/>' +
    '<path class="stem" d="M32 15v6"/>' +
    '<circle class="body" cx="32" cy="38" r="22"/>' +
    '<ellipse class="eye" cx="24" cy="34" rx="2.8" ry="3.6"/><ellipse class="eye" cx="40" cy="34" rx="2.8" ry="3.6"/>' +
    '<g class="mouth">' + (MOUTH[mood] || MOUTH.happy) + '</g>' +
    '<circle class="blush" cx="19" cy="42" r="3"/><circle class="blush" cx="45" cy="42" r="3"/>' +
    '</svg>';

  /** Pip with a speech bubble. The full text is always in the page for screen readers. */
  ui.bubble = (text, opts) => {
    const o = opts || {};
    return (
      '<div class="pip-row' + (o.cls ? ' ' + o.cls : '') + '">' +
      '<div class="pip">' + ui.pip(o.mood || 'happy') + '</div>' +
      '<div class="bubble" role="status"><span class="sr-only">' + u.esc(text) + '</span>' +
      '<span class="bubble-text" aria-hidden="true" data-text="' + u.esc(text) + '">' + u.esc(text) + '</span></div></div>'
    );
  };

  const typedBefore = new Set();
  /** Type bubble text out letter by letter (only the first time that text is seen, and only if animations are on). */
  ui.enhance = (root) => {
    u.$$('.bubble-text[data-text]', root || document).forEach((el) => {
      const text = el.getAttribute('data-text');
      if (!animOn() || typedBefore.has(text) || text.length > 220) { typedBefore.add(text); return; }
      typedBefore.add(text);
      el.textContent = '';
      let i = 0;
      const step = Math.max(10, Math.min(28, Math.floor(1400 / text.length)));
      const tick = () => {
        if (!el.isConnected) return;
        i += 1;
        el.textContent = text.slice(0, i);
        if (i < text.length) setTimeout(tick, step);
      };
      el.closest('.bubble').addEventListener('click', () => { i = text.length; el.textContent = text; }, { once: true });
      tick();
    });
  };

  // ----------------------------------------------------------- tone boxes
  const TONE_ICON = { great: 'circleCheck', steady: 'trend', stretch: 'mountain', reach: 'flag', empty: 'sparkle' };
  const TONE_TAG = { great: 'On track', steady: 'Within reach', stretch: 'Stretch goal', reach: 'Good to know', empty: 'Getting started' };
  ui.toneIcon = (tone) => u.icon(TONE_ICON[tone] || 'sparkle');
  ui.toneTag = (tone) => TONE_TAG[tone] || '';

  /** The encouraging message box: icon and label as well as colour. */
  ui.coachHTML = (c, attrs) =>
    '<div class="coach" data-tone="' + c.tone + '" ' + (attrs || '') + '>' +
    ui.toneIcon(c.tone) +
    '<span class="tag">' + ui.toneTag(c.tone) + '</span>' +
    '<p class="head">' + u.esc(c.headline) + '</p>' +
    '<p class="body">' + u.esc(c.body) + '</p>' +
    (c.suggestGoal ? '<button type="button" class="btn small" data-suggest="' + c.suggestGoal + '">Set my goal to ' + c.suggestGoal + '%</button>' : '') +
    '</div>';

  // ---------------------------------------------------------------- meter
  /** Goal meter: solid fill = where you are, stripes = still available, line = your goal. */
  ui.meterHTML = () =>
    '<div class="meter" role="img"><div class="track"><div class="best"></div><div class="fill"></div><div class="goal"></div></div>' +
    '<div class="goal-row"><span class="goal-label"></span></div><p class="meter-note"></p>' +
    '<div class="key" aria-hidden="true"><span><i></i>Where you are</span><span><i class="s"></i>Still available</span><span><i class="g"></i>Your goal</span></div></div>';

  ui.updateMeter = (el, v) => {
    const E = LG.E;
    const cur = v.cur === null || v.cur === undefined ? 0 : Math.max(0, Math.min(100, v.cur));
    u.$('.fill', el).style.width = cur + '%';
    const best = u.$('.best', el);
    if (v.best !== undefined && v.best !== null && v.best > cur + 0.05) {
      best.hidden = false;
      best.style.left = cur + '%';
      best.style.width = Math.max(0, Math.min(100, v.best) - cur) + '%';
    } else best.hidden = true;
    const goalOn = v.goal !== null && v.goal !== undefined && v.goal >= 0 && v.goal <= 100;
    u.$('.goal', el).hidden = !goalOn;
    u.$('.goal-row', el).hidden = !goalOn;
    if (goalOn) {
      u.$('.goal', el).style.left = v.goal + '%';
      const lab = u.$('.goal-label', el);
      lab.style.left = 'clamp(2.4rem, ' + v.goal + '%, calc(100% - 2.4rem))';
      lab.textContent = 'Goal ' + E.fmt(v.goal) + '%';
    }
    let note = v.note || '';
    if (!note) {
      if (v.cur === null || v.cur === undefined) note = 'Add a score to see how close you are.';
      else if (!goalOn) note = 'Set a goal to see your progress.';
      else if (v.cur >= v.goal - E.EPS) note = 'You are ' + E.fmt(v.cur - v.goal) + ' points past your goal.';
      else note = E.fmt(v.goal - v.cur) + ' points to go.';
      if (v.best !== undefined && v.best !== null && v.cur !== null && v.cur !== undefined && goalOn) note += ' Best possible: ' + E.fmt(v.best) + '%.';
    }
    u.$('.meter-note', el).textContent = note;
    el.setAttribute('aria-label', 'Progress toward your goal. ' + note);
  };

  // -------------------------------------------------------------- confetti
  ui.confetti = () => {
    if (!animOn()) return;
    const cv = document.createElement('canvas');
    cv.className = 'confetti';
    cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv);
    const dpr = window.devicePixelRatio || 1;
    const W = (cv.width = window.innerWidth * dpr);
    const H = (cv.height = window.innerHeight * dpr);
    const ctx = cv.getContext('2d');
    const cs = getComputedStyle(document.documentElement);
    const colours = ['--accent', '--t-great', '--t-stretch', '--t-reach', '--text'].map((k) => cs.getPropertyValue(k).trim() || '#888');
    const parts = [];
    for (let i = 0; i < 130; i++) {
      parts.push({
        x: W / 2 + (Math.random() - 0.5) * W * 0.3,
        y: H * 0.35,
        vx: (Math.random() - 0.5) * 14 * dpr,
        vy: (-Math.random() * 12 - 4) * dpr,
        s: (5 + Math.random() * 6) * dpr,
        r: Math.random() * 6.28,
        vr: (Math.random() - 0.5) * 0.4,
        c: colours[i % colours.length],
        shape: i % 3,
      });
    }
    const start = performance.now();
    (function frame(now) {
      const t = now - start;
      ctx.clearRect(0, 0, W, H);
      parts.forEach((p) => {
        p.vy += 0.32 * dpr;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.globalAlpha = Math.max(0, 1 - t / 2400);
        if (p.shape === 0) ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
        else if (p.shape === 1) { ctx.beginPath(); ctx.arc(0, 0, p.s / 2, 0, 6.28); ctx.fill(); }
        else { ctx.beginPath(); ctx.moveTo(0, -p.s / 2); ctx.lineTo(p.s / 2, p.s / 2); ctx.lineTo(-p.s / 2, p.s / 2); ctx.closePath(); ctx.fill(); }
        ctx.restore();
      });
      if (t < 2400) requestAnimationFrame(frame);
      else cv.remove();
    })(start);
  };

  // ------------------------------------------------------ goal celebration
  const CHEERS = [
    'You set a goal and you got there. That is worth a proper celebration.',
    'All that steady work added up. I am really proud of you.',
    'Goal reached! Take a moment to enjoy this one.',
    'You did it. Every study session in there counted.',
  ];
  ui.celebrate = (courseName, goal) => {
    ui.confetti();
    const text = CHEERS[Math.floor(Math.random() * CHEERS.length)];
    return ui.modal({
      title: 'Goal reached!',
      html: ui.bubble(text, { mood: 'cheer' }) + '<p class="celebrate-line">' + u.esc(courseName || 'Your course') + ' is at or above your goal of ' + LG.E.fmt(goal) + '%.</p>',
      actions: [{ label: 'Thank you, Pip', kind: 'primary', value: true }],
    });
  };

  // ------------------------------------------------------ small form bits
  ui.field = (id, label, value, attrs) =>
    '<div class="field"><label class="lbl" for="' + id + '">' + u.esc(label) + '</label>' +
    '<input class="in" id="' + id + '" value="' + u.esc(value) + '" ' + (attrs || '') + '></div>';

  ui.options = (list, selected) =>
    list.map((o) => {
      const v = typeof o === 'string' ? o : o.value;
      const l = typeof o === 'string' ? o : o.label;
      return '<option value="' + u.esc(v) + '"' + (String(v) === String(selected) ? ' selected' : '') + '>' + u.esc(l) + '</option>';
    }).join('');
})();
