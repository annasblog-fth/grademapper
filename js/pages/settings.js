/* grademapper: settings (look and feel, grading scale, privacy and backup). */
(function () {
  'use strict';
  const LG = window.LG;
  const u = LG.u, E = LG.E, ui = LG.ui, store = LG.store;
  const S = (LG.pages.settings = {});

  const seg = (id, label, options, current, hint) =>
    '<fieldset class="seg-wrap"><legend class="lbl">' + u.esc(label) + '</legend><div class="seg" id="' + id + '">' +
    options.map((o) => '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (String(current) === String(o[0])) + '">' + u.esc(o[1]) + '</button>').join('') + '</div>' +
    (hint ? '<p class="hint">' + u.esc(hint) + '</p>' : '') + '</fieldset>';

  function csvCell(v) {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function buildCSV() {
    const s = store.state;
    const rows = [['Term', 'Course', 'Category', 'Category weight %', 'Item', 'Score', 'Out of', 'Percent', 'Due date']];
    s.courses.forEach((c) => {
      const term = s.terms.filter((t) => t.id === c.termId)[0];
      c.categories.forEach((k) => k.entries.forEach((e) => {
        const p = E.entryPercent(e);
        rows.push([term ? term.name : '', c.name, k.name, k.weight, e.name, e.score, e.max, p === null ? '' : E.round1(p), e.due || '']);
      }));
    });
    // Archived classes and summaries (version 2). Nothing is added when the archive is empty.
    const scale = store.scale();
    (s.archive || []).forEach((r) => {
      const pct = r.kind === 'summary' ? E.num(r.percent) : E.archivePercent(r, scale);
      rows.push(['Archive: ' + (r.period || 'Earlier'), r.kind === 'summary' ? (r.label || 'Summary') + (r.gpa ? ' (GPA ' + r.gpa + ')' : '') : r.name, '(archived)', '', '', '', '', pct === null ? '' : E.round1(pct), '']);
    });
    return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  }

  // ------------------------------------------------------- scale editor
  function bandRows(bands, withPoints) {
    return bands.map((b, i) =>
      '<div class="band-row" data-i="' + i + '"><div class="field"><label class="lbl" for="bn-l-' + i + '">Letter</label><input class="in" id="bn-l-' + i + '" data-f="letter" value="' + u.esc(b.letter) + '" autocomplete="off"></div>' +
      '<div class="field"><label class="lbl" for="bn-m-' + i + '">From %</label><input class="in num" id="bn-m-' + i + '" data-f="min" inputmode="decimal" value="' + u.esc(b.min) + '"></div>' +
      (withPoints ? '<div class="field"><label class="lbl" for="bn-p-' + i + '">Points</label><input class="in num" id="bn-p-' + i + '" data-f="points" inputmode="decimal" value="' + u.esc(b.points == null ? '' : b.points) + '"></div>' : '') +
      '<button type="button" class="icon-btn" data-del="' + i + '" aria-label="Remove ' + u.esc(b.letter || 'this band') + '">' + u.icon('x') + '</button></div>').join('');
  }

  S.render = (view) => {
    const s = store.state, a = store.appearance, p = s.profile;
    const themeHasBoth = !!(LG.theme.themeById(a.theme).light && LG.theme.themeById(a.theme).dark);
    const cust = s.prefs.customScale;
    // The country comes first and the scale is one of that country's scales. Older saves work it out from the scale.
    const country = E.countryOfScale(p.region);
    const fontOpts = [['theme', 'Theme font']].concat(LG.theme.FONTS.map((f) => [f.id, f.name]));

    view.innerHTML =
      '<h1 class="page-title">Settings</h1>' +

      '<section class="card" aria-labelledby="ap-h"><h2 id="ap-h">Look and feel</h2>' +
      '<div class="theme-grid" id="st-themes"></div>' +
      seg('st-mode', 'Light or dark', [['auto', 'Match my phone'], ['light', 'Light'], ['dark', 'Dark']], a.mode, themeHasBoth && !a.custom.on ? '' : 'The theme you picked has one look, so this switch does nothing for it.') +
      '<details class="sub-panel" id="st-custom"' + (a.custom.on ? ' open' : '') + '><summary>Pick your own colours</summary>' +
      '<label class="check" for="cu-on"><input type="checkbox" id="cu-on"' + (a.custom.on ? ' checked' : '') + '><span>Use my colours instead of the theme</span></label>' +
      '<div class="color-grid">' +
      [['bg', 'Background'], ['text', 'Text'], ['accent', 'Accent']].map((c) => '<div class="field"><label class="lbl" for="cu-' + c[0] + '">' + c[1] + '</label><div class="color-row"><input type="color" id="cu-' + c[0] + '" value="' + u.esc(a.custom[c[0]]) + '"><code id="cu-' + c[0] + '-hex">' + u.esc(a.custom[c[0]].toUpperCase()) + '</code></div></div>').join('') + '</div>' +
      '<p class="hint" id="cu-warn" aria-live="polite"></p>' +
      '<p class="hint">If your text and background are too close together, I nudge the text colour so it stays readable.</p></details>' +
      '<div class="field"><label class="lbl" for="st-font">Font</label><select class="in" id="st-font">' + ui.options(fontOpts.map((f) => ({ value: f[0], label: f[1] })), a.font) + '</select></div>' +
      '<p class="font-sample" id="font-sample">The quick brown fox is on track for an A.</p>' +
      seg('st-radius', 'Corners', [['square', 'Square'], ['soft', 'Soft'], ['round', 'Round'], ['bubble', 'Bubble']], a.radius) +
      seg('st-cards', 'Cards', [['outline', 'Outlined'], ['flat', 'Flat'], ['lifted', 'Lifted']], a.cards) +
      seg('st-density', 'Spacing', [['cozy', 'Cozy'], ['compact', 'Compact']], a.density) +
      seg('st-anim', 'Animations', [['playful', 'Playful'], ['calm', 'Calm'], ['off', 'Off']], a.anim, 'Animations also turn off if your phone is set to reduce motion.') +
      '<div class="field"><label class="lbl" for="st-scale">Text size <output id="st-scale-out">' + Math.round(a.scale * 100) + '%</output></label><input type="range" id="st-scale" min="0.85" max="1.3" step="0.05" value="' + a.scale + '"></div>' +
      '<label class="check" for="st-hc"><input type="checkbox" id="st-hc"' + (a.contrast ? ' checked' : '') + '><span>High contrast</span></label>' +
      '<label class="check" for="st-dys"><input type="checkbox" id="st-dys"' + (a.dys ? ' checked' : '') + '><span>Dyslexia-friendly font and spacing</span></label>' +
      '<button type="button" class="btn quiet" id="st-reset-look">Reset the look to Standard</button></section>' +

      '<section class="card" aria-labelledby="gr-h"><h2 id="gr-h">Grading</h2>' +
      '<div class="field"><label class="lbl" for="gr-country">Country</label><select class="in" id="gr-country">' +
      ui.options(E.COUNTRIES.map((c) => ({ value: c.id, label: c.name })), country.id) + '</select></div>' +
      '<div class="field"><label class="lbl" for="gr-region">Grading scale in ' + u.esc(country.name) + '</label><select class="in" id="gr-region">' +
      ui.options(E.scalesOfCountry(country.id).map((x) => ({ value: x.id, label: x.label })), p.region) + '</select></div>' +
      (E.getScale(p.region, cust).note ? '<p class="hint">' + u.esc(E.getScale(p.region, cust).note) + '</p>' : '') +
      '<p class="hint">Schools differ. If your cut-offs are not the same, pick "Somewhere else, or my own scale" as the country and enter them.</p>' +
      (p.region === 'custom'
        ? '<div class="sub-panel open"><h3>My own scale</h3><div class="field"><label class="lbl" for="cs-pl">Name for the points (leave blank if none)</label><input class="in" id="cs-pl" value="' + u.esc(cust.pointsLabel) + '" placeholder="GPA"></div>' +
          '<label class="check" for="cs-bonus"><input type="checkbox" id="cs-bonus"' + (cust.bonus ? ' checked' : '') + '><span>Allow weighted bonus points (honors, AP, IB)</span></label>' +
          '<div id="bands">' + bandRows(cust.bands, true) + '</div><div class="row-wrap"><button type="button" class="btn" id="band-add">' + u.icon('plus') + ' Add a band</button></div>' +
          '<p class="hint">Each band starts at its "From %" and runs up to the next one. Sorted for you. A band at 0 is added if missing.</p></div>' : '') +
      '<fieldset class="seg-wrap"><legend class="lbl">GPA bonus points for weighted GPA</legend><div class="form-grid four">' +
      ['regular', 'honors', 'ap', 'ib'].map((k) => '<div class="field"><label class="lbl" for="bn-' + k + '">' + (k === 'ap' ? 'AP' : k === 'ib' ? 'IB' : k[0].toUpperCase() + k.slice(1)) + '</label><input class="in num" id="bn-' + k + '" data-bonus="' + k + '" inputmode="decimal" value="' + u.esc(s.prefs.bonus[k]) + '"></div>').join('') + '</div>' +
      '<p class="hint">Used when you switch to weighted GPA on the Grades page. Only for scales that have points, like US GPA.</p></fieldset></section>' +

      '<section class="card" aria-labelledby="pv-h"><h2 id="pv-h">Privacy and backup</h2>' +
      '<p>' + u.icon('lock', 'inline') + 'Everything stays on this device. There is no account, no ads and no tracking.</p>' +
      '<div class="stack-sm"><h3>Lock with a passphrase</h3><p class="muted">' + (store.encrypted ? 'Your data is encrypted. You will be asked for the passphrase each time you open the app.' : store.canEncrypt ? 'Optional. Your grades are scrambled with a passphrase so nobody who picks up your phone can read them.' : 'Encryption needs a secure (https) connection, so it is not available here.') + '</p>' +
      (store.canEncrypt ? (store.encrypted ? '<button type="button" class="btn" id="pv-remove">Remove passphrase</button>' : '<button type="button" class="btn" id="pv-set">' + u.icon('lock') + ' Set a passphrase</button>') : '') +
      '<p class="hint">There is no way to reset a forgotten passphrase. If you lose it, the data cannot be opened. Make a backup first.</p></div>' +
      '<div class="stack-sm"><h3>Backup</h3><p class="muted">Save everything to a file so your grades survive a new phone or a cleared browser.</p>' +
      '<div class="row-wrap"><button type="button" class="btn" id="pv-export">' + u.icon('download') + ' Download backup</button><button type="button" class="btn" id="pv-import">' + u.icon('upload') + ' Restore from backup</button></div>' +
      '<input type="file" id="pv-file" accept=".json,application/json" hidden></div>' +
      '<div class="stack-sm"><h3>Export</h3><div class="row-wrap"><button type="button" class="btn" id="pv-csv">' + u.icon('download') + ' Grades as CSV</button><button type="button" class="btn" id="pv-print">Print or save as PDF</button></div></div>' +
      '<div class="stack-sm danger-zone"><h3>Delete everything</h3><p class="muted">Removes every course, score, note and setting from this device in one tap.</p><button type="button" class="btn danger" id="pv-wipe">' + u.icon('trash') + ' Delete everything</button></div></section>' +

      '<section class="card" aria-labelledby="ab-h"><h2 id="ab-h">About</h2><p>grademapper helps you see where you stand and what you need next. Numbers are only as good as what you type in, and your school\'s rules always win.</p><p class="hint">Version ' + u.esc(LG.app.version) + '</p>' +
      '<div class="row-wrap"><button type="button" class="btn" id="ab-welcome">Run the welcome setup again</button><a class="btn" href="#/learn">How grades work</a><a class="btn" href="privacy.html">Privacy policy</a></div></section>';

    // ------------------------------------------------ appearance wiring
    const pick = (id, key, parse) => u.$('#' + id, view).addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      store.setAppearance({ [key]: parse ? parse(b.dataset.v) : b.dataset.v });
      LG.app.rerender(true);
    });
    ui.themePicker(u.$('#st-themes', view), () => LG.app.rerender(true));
    pick('st-mode', 'mode'); pick('st-radius', 'radius'); pick('st-cards', 'cards'); pick('st-density', 'density'); pick('st-anim', 'anim');

    const paintCustomWarn = () => {
      const c = store.appearance.custom;
      u.$('#cu-warn', view).textContent = u.contrast(c.text, c.bg) < 4.5 ? 'Those two colours are close, so I adjusted the text to keep it readable.' : '';
    };
    u.$('#cu-on', view).addEventListener('change', (e) => { store.setAppearance({ custom: { on: e.target.checked } }); LG.app.rerender(true); });
    ['bg', 'text', 'accent'].forEach((k) => u.$('#cu-' + k, view).addEventListener('input', (e) => {
      u.$('#cu-' + k + '-hex', view).textContent = e.target.value.toUpperCase();
      store.setAppearance({ custom: { [k]: e.target.value, on: true } });
      u.$('#cu-on', view).checked = true;
      paintCustomWarn();
    }));
    paintCustomWarn();
    u.$('#st-font', view).addEventListener('change', (e) => { store.setAppearance({ font: e.target.value }); });
    u.$('#st-scale', view).addEventListener('input', (e) => { u.$('#st-scale-out', view).textContent = Math.round(e.target.value * 100) + '%'; store.setAppearance({ scale: Number(e.target.value) }); });
    u.$('#st-hc', view).addEventListener('change', (e) => { store.setAppearance({ contrast: e.target.checked }); });
    u.$('#st-dys', view).addEventListener('change', (e) => { store.setAppearance({ dys: e.target.checked }); });
    u.$('#st-reset-look', view).addEventListener('click', () => { store.setAppearance(Object.assign({}, LG.theme.DEFAULT_APPEARANCE)); LG.app.rerender(true); ui.toast('Back to the Standard look.'); });

    // ----------------------------------------------------- grading wiring
    u.$('#gr-country', view).addEventListener('change', (e) => {
      const c = E.countryById(e.target.value); if (!c) return;
      p.country = c.id;
      if (c.scales.indexOf(p.region) < 0) p.region = c.scales[0];
      store.save(); LG.app.rerender(true);
    });
    u.$('#gr-region', view).addEventListener('change', (e) => { p.region = e.target.value; p.country = E.countryOfScale(p.region).id; store.save(); LG.app.rerender(true); });
    u.$$('[data-bonus]', view).forEach((i) => i.addEventListener('input', () => { s.prefs.bonus[i.dataset.bonus] = i.value; store.save(); }));
    if (p.region === 'custom') {
      u.$('#cs-pl', view).addEventListener('input', (e) => { cust.pointsLabel = e.target.value; store.save(); });
      u.$('#cs-bonus', view).addEventListener('change', (e) => { cust.bonus = e.target.checked; store.save(); });
      const box = u.$('#bands', view);
      box.addEventListener('input', (e) => {
        const row = e.target.closest('[data-i]'); if (!row || !e.target.dataset.f) return;
        cust.bands[Number(row.dataset.i)][e.target.dataset.f] = e.target.value; store.save();
      });
      box.addEventListener('change', () => { // tidy and re-sort once typing is done
        cust.bands = E.normalizeBands(cust.bands); store.save();
        box.innerHTML = bandRows(cust.bands, true);
      });
      box.addEventListener('click', (e) => {
        const b = e.target.closest('[data-del]'); if (!b) return;
        if (cust.bands.length <= 2) { ui.toast('Keep at least two bands.'); return; }
        cust.bands.splice(Number(b.dataset.del), 1); store.save(); box.innerHTML = bandRows(cust.bands, true);
      });
      u.$('#band-add', view).addEventListener('click', () => {
        cust.bands.push({ min: '', letter: '', points: '' }); box.innerHTML = bandRows(cust.bands, true);
        const last = u.$$('[data-f="letter"]', box).pop(); if (last) last.focus();
      });
    }

    // ----------------------------------------------------- privacy wiring
    const askPass = (title, withConfirm) => new Promise((resolve) => {
      let value = null;
      ui.modal({
        title,
        html: '<div class="field"><label class="lbl" for="pp-1">Passphrase</label><input class="in" type="password" id="pp-1" autocomplete="' + (withConfirm ? 'new-password' : 'current-password') + '"></div>' +
          (withConfirm ? '<div class="field"><label class="lbl" for="pp-2">Type it again</label><input class="in" type="password" id="pp-2" autocomplete="new-password"></div>' : '') +
          '<p class="hint" id="pp-err" role="alert"></p>' + (withConfirm ? '<p class="hint">Use something you will remember. There is no reset.</p>' : ''),
        actions: [{ label: 'Cancel', kind: 'ghost', value: false }, { label: 'OK', kind: 'primary', value: true, onClick: (d) => {
          const a1 = u.$('#pp-1', d).value, err = u.$('#pp-err', d);
          if (a1.length < 6) { err.textContent = 'Use at least 6 characters.'; return false; }
          if (withConfirm && a1 !== u.$('#pp-2', d).value) { err.textContent = 'Those do not match.'; return false; }
          value = a1;
        } }],
      }).then(() => resolve(value));
    });

    const setBtn = u.$('#pv-set', view);
    if (setBtn) setBtn.addEventListener('click', async () => {
      const pass = await askPass('Set a passphrase', true);
      if (!pass) return;
      try { await store.setPassphrase(pass); LG.app.rerender(true); ui.toast('Locked. You will need the passphrase next time.'); } catch (err) { ui.toast(err.message); }
    });
    const rmBtn = u.$('#pv-remove', view);
    if (rmBtn) rmBtn.addEventListener('click', async () => {
      const ok = await ui.confirm({ title: 'Remove the passphrase?', body: 'Your data will be stored without encryption on this device.', confirmLabel: 'Remove' });
      if (ok) { await store.removePassphrase(); LG.app.rerender(true); ui.toast('Passphrase removed.'); }
    });
    u.$('#pv-export', view).addEventListener('click', async () => {
      let pass = null;
      if (store.canEncrypt) {
        const enc = await ui.modal({ title: 'Download backup', html: '<p>Protect the backup file with a passphrase?</p><p class="hint">Recommended if you will keep it in email or cloud storage.</p>', actions: [{ label: 'Cancel', kind: 'ghost', value: 'cancel' }, { label: 'No passphrase', kind: 'ghost', value: 'plain' }, { label: 'Use a passphrase', kind: 'primary', value: 'enc' }] });
        if (enc === 'cancel' || enc === null) return;
        if (enc === 'enc') { pass = await askPass('Backup passphrase', true); if (!pass) return; }
      }
      try {
        u.download('grademapper-backup-' + u.todayISO() + '.json', await store.exportBackup(pass), 'application/json');
        ui.toast('Backup saved. Keep it somewhere safe.');
      } catch (err) { ui.toast(err.message); }
    });
    const fileIn = u.$('#pv-file', view);
    u.$('#pv-import', view).addEventListener('click', () => fileIn.click());
    fileIn.addEventListener('change', async () => {
      const f = fileIn.files && fileIn.files[0]; if (!f) return;
      const text = await f.text();
      const ok = await ui.confirm({ title: 'Restore this backup?', body: 'It replaces everything currently in the app.', confirmLabel: 'Restore', danger: true });
      if (!ok) { fileIn.value = ''; return; }
      try {
        let r = await store.importBackup(text);
        if (r.needsPassphrase) {
          const pass = await askPass('Backup passphrase', false);
          if (!pass) { fileIn.value = ''; return; }
          r = await store.importBackup(text, pass);
        }
        if (r.ok) { ui.toast('Backup restored.'); LG.app.rerender(true); }
      } catch (err) { ui.toast(err.message); }
      fileIn.value = '';
    });
    u.$('#pv-csv', view).addEventListener('click', () => { u.download('grademapper-' + u.todayISO() + '.csv', '﻿' + buildCSV(), 'text/csv;charset=utf-8'); ui.toast('CSV saved. It opens in Excel, Sheets or Numbers.'); });
    u.$('#pv-print', view).addEventListener('click', () => { LG.app.printSummary(); });
    u.$('#pv-wipe', view).addEventListener('click', async () => {
      const ok = await ui.modal({ title: 'Delete everything?', html: '<p>All courses, scores, activities, notes and settings will be erased from this device. This cannot be undone. A backup file you saved earlier will still work.</p>', actions: [{ label: 'Keep my data', kind: 'primary', value: false }, { label: 'Delete everything', kind: 'danger', value: true }] });
      if (!ok) return;
      store.wipe();
      LG.pages.welcome.restart();
      location.hash = '#/welcome';
      LG.app.rerender(true);
      ui.toast('Everything was deleted from this device.');
    });
    u.$('#ab-welcome', view).addEventListener('click', () => { LG.pages.welcome.restart(); location.hash = '#/welcome'; });
  };
  S.title = 'Settings';
})();
