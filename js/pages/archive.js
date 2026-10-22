/*
 * grademapper: the Archive (version 2).
 * A place for earlier classes, grades and GPA: last year's report card, a school you left, a GPA you already know.
 * Archived items count toward the "all time" average and GPA and show up in the trend, but never change the
 * courses and terms on the Grades page.
 */
(function () {
  'use strict';
  const LG = window.LG;
  const u = LG.u, E = LG.E, ui = LG.ui, store = LG.store;
  const A = (LG.pages.archive = {});

  const monthNow = () => u.todayISO().slice(0, 7);
  const levelLabel = (v) => (LG.consts.LEVELS.filter((l) => l.value === v)[0] || LG.consts.LEVELS[0]).label;

  /** Links that switch between the current Grades page and the Archive. Also used by the Grades page. */
  A.switcher = (active) =>
    '<nav class="seg-links" aria-label="Grades sections">' +
    '<a href="#/grades"' + (active === 'current' ? ' aria-current="page"' : '') + '>Current</a>' +
    '<a href="#/archive"' + (active === 'archive' ? ' aria-current="page"' : '') + '>Archive</a></nav>';

  function periods(s) {
    const seen = {}, out = [];
    s.archive.forEach((r) => { const p = String(r.period || '').trim(); if (p && !seen[p]) { seen[p] = 1; out.push(p); } });
    s.terms.forEach((t) => { if (!seen[t.name]) { seen[t.name] = 1; out.push(t.name); } });
    return out;
  }

  // ------------------------------------------------------------- dialogs
  async function classDialog(rec) {
    const s = store.state, scale = store.scale();
    const isNew = !rec;
    const r = rec || { period: '', when: '', subject: 'Other', level: 'regular', credits: '1' };
    const letters = scale.bands.map((b) => b.letter);
    const body =
      '<div class="form-grid">' +
      ui.field('ar-name', 'Class name', r.name || '', 'placeholder="e.g. Biology 10" autocomplete="off"') +
      '<div class="field"><label class="lbl" for="ar-period">When (a label)</label><input class="in" id="ar-period" list="ar-periods" value="' + u.esc(r.period || '') + '" placeholder="e.g. Grade 9" autocomplete="off"><datalist id="ar-periods">' + periods(s).map((p) => '<option value="' + u.esc(p) + '">').join('') + '</datalist></div>' +
      '<div class="field"><label class="lbl" for="ar-when">Finished (month, optional)</label><input class="in" type="month" id="ar-when" value="' + u.esc(r.when || '') + '"></div>' +
      '<div class="field"><label class="lbl" for="ar-subject">Subject</label><select class="in" id="ar-subject">' + ui.options(LG.consts.SUBJECTS, r.subject || 'Other') + '</select></div>' +
      '<div class="field"><label class="lbl" for="ar-level">Level</label><select class="in" id="ar-level">' + ui.options(LG.consts.LEVELS, r.level || 'regular') + '</select></div>' +
      '<div class="field"><label class="lbl" for="ar-credits">Credits</label><input class="in num" id="ar-credits" inputmode="decimal" value="' + u.esc(r.credits == null ? '1' : r.credits) + '"></div>' +
      '<div class="field"><label class="lbl" for="ar-percent">Final percent</label><input class="in num" id="ar-percent" inputmode="decimal" value="' + u.esc(r.percent || '') + '" placeholder="88"></div>' +
      '<div class="field"><label class="lbl" for="ar-letter">or letter</label><input class="in num" id="ar-letter" list="ar-letters" value="' + u.esc(r.letter || '') + '" placeholder="' + u.esc(letters[1] || 'B') + '" autocomplete="off"><datalist id="ar-letters">' + letters.map((l) => '<option value="' + u.esc(l) + '">').join('') + '</datalist></div></div>' +
      '<p class="hint">Type the percent if you know it. If you only know the letter, I use the middle of that letter\'s range on your scale (' + u.esc(scale.label) + '). Leave both blank and the class is kept but not counted.</p>' +
      '<div class="field"><label class="lbl" for="ar-note">Note (optional)</label><input class="in" id="ar-note" value="' + u.esc(r.note || '') + '" autocomplete="off"></div>';
    let out = null;
    const ok = await ui.modal({
      title: isNew ? 'Add an earlier class' : 'Edit this class', html: body,
      actions: [{ label: 'Cancel', kind: 'ghost', value: false }, { label: isNew ? 'Add class' : 'Save', kind: 'primary', value: true, onClick: (d) => {
        const v = (id) => u.$('#' + id, d).value;
        out = { name: v('ar-name').trim() || 'Untitled class', period: v('ar-period').trim(), when: v('ar-when'), subject: v('ar-subject'), level: v('ar-level'), credits: v('ar-credits').trim() || '1', percent: v('ar-percent').trim(), letter: v('ar-letter').trim(), note: v('ar-note').trim() };
      } }],
    });
    return ok ? out : null;
  }

  async function summaryDialog(rec) {
    const s = store.state, scale = store.scale();
    const isNew = !rec;
    const r = rec || { period: '', when: '' };
    const body =
      '<p class="muted">Use this when you know a year\'s GPA or average but do not have every class. It counts as one item, weighted by the credits you give it.</p>' +
      '<div class="form-grid">' +
      ui.field('as-label', 'Name', r.label || '', 'placeholder="e.g. Grade 9 report card" autocomplete="off"') +
      '<div class="field"><label class="lbl" for="as-period">When (a label)</label><input class="in" id="as-period" list="as-periods" value="' + u.esc(r.period || '') + '" placeholder="e.g. Grade 9" autocomplete="off"><datalist id="as-periods">' + periods(s).map((p) => '<option value="' + u.esc(p) + '">').join('') + '</datalist></div>' +
      '<div class="field"><label class="lbl" for="as-when">Finished (month, optional)</label><input class="in" type="month" id="as-when" value="' + u.esc(r.when || '') + '"></div>' +
      '<div class="field"><label class="lbl" for="as-gpa">' + u.esc(scale.pointsLabel || 'GPA') + ' (optional)</label><input class="in num" id="as-gpa" inputmode="decimal" value="' + u.esc(r.gpa || '') + '" placeholder="3.6"></div>' +
      '<div class="field"><label class="lbl" for="as-percent">Average percent (optional)</label><input class="in num" id="as-percent" inputmode="decimal" value="' + u.esc(r.percent || '') + '" placeholder="88"></div>' +
      '<div class="field"><label class="lbl" for="as-credits">Credits it covers</label><input class="in num" id="as-credits" inputmode="decimal" value="' + u.esc(r.credits || '') + '" placeholder="8"></div></div>' +
      '<p class="hint">Credits decide how much this counts next to your other items. Blank counts as 1 credit, which is a light touch. A full year of 8 classes is about 8.</p>' +
      '<div class="field"><label class="lbl" for="as-note">Note (optional)</label><input class="in" id="as-note" value="' + u.esc(r.note || '') + '" autocomplete="off"></div>';
    let out = null;
    const ok = await ui.modal({
      title: isNew ? 'Add a GPA or year summary' : 'Edit this summary', html: body,
      actions: [{ label: 'Cancel', kind: 'ghost', value: false }, { label: isNew ? 'Add summary' : 'Save', kind: 'primary', value: true, onClick: (d) => {
        const v = (id) => u.$('#' + id, d).value.trim();
        if (!v('as-gpa') && !v('as-percent')) { ui.toast('Add a GPA or an average percent so it can count.'); return false; }
        out = { label: v('as-label') || 'Earlier grades', period: v('as-period'), when: u.$('#as-when', d).value, gpa: v('as-gpa'), percent: v('as-percent'), credits: v('as-credits'), note: v('as-note') };
      } }],
    });
    return ok ? out : null;
  }

  // ------------------------------------------------------------- the page
  function groupsOf(archive) {
    const map = {}, groups = [];
    archive.forEach((r, i) => {
      const key = String(r.period || '').trim() || 'Earlier';
      if (!map[key]) { map[key] = { name: key, recs: [], when: '', first: i }; groups.push(map[key]); }
      map[key].recs.push(r);
      const w = String(r.when || '');
      if (w && (!map[key].when || w < map[key].when)) map[key].when = w;
    });
    groups.sort((a, b) => (a.when && b.when ? a.when.localeCompare(b.when) || a.first - b.first : a.when ? -1 : b.when ? 1 : a.first - b.first));
    return groups;
  }

  function rowHTML(r, scale, opts) {
    const isSum = r.kind === 'summary';
    const pct = isSum ? E.num(r.percent) : E.archivePercent(r, scale);
    const band = pct === null ? null : E.bandFor(pct, scale);
    const typed = !isSum && E.num(r.percent) === null && pct !== null;
    const pts = isSum ? E.num(r.gpa) : (pct === null ? null : E.pointsFor(pct, scale, Object.assign({}, opts, { level: r.level })));
    const name = isSum ? r.label : r.name;
    const meta = isSum
      ? 'Summary' + (E.num(r.credits) !== null ? ' &middot; ' + E.fmt(E.num(r.credits)) + ' credits' : '')
      : u.esc(r.subject || '') + ' &middot; ' + levelLabel(r.level) + (E.creditsOf(r) !== 1 ? ' &middot; ' + E.fmt(E.creditsOf(r)) + ' credits' : '');
    const grade = pct === null && pts === null
      ? '<span class="muted">Not counted</span>'
      : (pct !== null ? '<b>' + (typed ? '~' : '') + E.fmt(pct) + '%</b>' + (band && !isSum ? '<span>' + u.esc(band.letter) + '</span>' : '') : '') +
        (pts !== null ? '<span>' + u.esc(isSum ? scale.pointsLabel || 'GPA' : scale.pointsLabel || 'Points') + ' ' + pts.toFixed(isSum ? 2 : 1) + '</span>' : '');
    return '<li class="arch-row" data-id="' + r.id + '"><div class="cc-main"><strong>' + u.esc(name || 'Untitled') + '</strong><span class="muted">' + meta + '</span>' +
      (r.note ? '<span class="muted">' + u.esc(r.note) + '</span>' : '') + '</div>' +
      '<div class="cc-grade">' + grade + '</div>' +
      '<div class="arch-actions">' +
      (r.snapshot ? '<button type="button" class="icon-btn" data-act="restore" aria-label="Move ' + u.esc(name || 'this class') + ' back to Grades" title="Move back to Grades">' + u.icon('reset') + '</button>' : '') +
      '<button type="button" class="icon-btn" data-act="edit" aria-label="Edit ' + u.esc(name || 'this item') + '">' + u.icon('edit') + '</button>' +
      '<button type="button" class="icon-btn" data-act="del" aria-label="Delete ' + u.esc(name || 'this item') + '">' + u.icon('trash') + '</button></div></li>';
  }

  A.render = (view) => {
    const s = store.state;
    const scale = store.scale(), opts = store.gpaOpts();
    const arch = E.archiveCumulative(s.archive, scale, opts);
    const all = E.cumulativeAll(s.courses, s.archive, scale, opts);
    const hasPts = E.hasPoints(scale);
    const ptsLabel = scale.pointsLabel || 'Points';
    const line = (label, r) => r.percent === null && r.points === null ? '' :
      '<p><strong>' + label + '</strong> ' + (r.percent !== null ? E.fmt(r.percent) + '%' : '') + (hasPts && r.points !== null ? ' &middot; ' + u.esc(ptsLabel) + ' ' + r.points.toFixed(2) : '') + ' <span class="muted">(' + E.fmt(r.credits) + ' credits)</span></p>';

    const groups = groupsOf(s.archive);
    const list = groups.length
      ? groups.map((g) => {
          const gr = E.archiveCumulative(g.recs, scale, opts);
          return '<section class="card arch-group" aria-label="' + u.esc(g.name) + '"><div class="row-between"><h3>' + u.esc(g.name) + '</h3>' +
            (gr.percent !== null ? '<span class="muted">' + E.fmt(gr.percent) + '%' + (hasPts && gr.points !== null ? ' &middot; ' + u.esc(ptsLabel) + ' ' + gr.points.toFixed(2) : '') + '</span>' : '') + '</div>' +
            '<ul class="arch-list">' + g.recs.map((r) => rowHTML(r, scale, opts)).join('') + '</ul></section>';
        }).join('')
      : '<div class="empty"><p>Nothing in your archive yet.</p><p class="muted">Add classes from earlier years, or a GPA you already know. They count toward your all-time average without touching your current courses.</p></div>';

    view.innerHTML =
      '<h1 class="page-title">Archive</h1>' + A.switcher('archive') +
      '<p class="muted page-sub">Earlier classes, grades and GPA. Add them by hand, or move a finished course here.</p>' +
      '<section class="card" aria-labelledby="ar-sum-h"><h2 id="ar-sum-h">All together</h2>' +
      (arch.count || s.courses.length ? line('Archive only:', arch) + line('Archive and current courses:', all) +
        '<p class="hint">Each item counts by its credits. Classes where only a letter is known use the middle of that letter\'s range, so they show with a ~.</p>' : '<p class="muted">Your averages will show here once you add something.</p>') +
      '</section>' +
      '<div class="row-wrap"><button type="button" class="btn primary" data-act="add-class">' + u.icon('plus') + ' Add an earlier class</button>' +
      '<button type="button" class="btn" data-act="add-summary">' + u.icon('plus') + ' Add a GPA or year summary</button></div>' + list;

    view.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const act = b.dataset.act;
      if (act === 'add-class') {
        const r = await classDialog(null); if (!r) return;
        s.archive.push(Object.assign({ id: u.uid('a'), kind: 'class' }, r)); store.save(); LG.app.rerender(); ui.toast('Added to your archive.');
        return;
      }
      if (act === 'add-summary') {
        const r = await summaryDialog(null); if (!r) return;
        s.archive.push(Object.assign({ id: u.uid('a'), kind: 'summary' }, r)); store.save(); LG.app.rerender(); ui.toast('Added to your archive.');
        return;
      }
      const row = b.closest('[data-id]'); if (!row) return;
      const idx = s.archive.findIndex((x) => x.id === row.dataset.id);
      if (idx < 0) return;
      const rec = s.archive[idx];
      if (act === 'edit') {
        const r = await (rec.kind === 'summary' ? summaryDialog(rec) : classDialog(rec)); if (!r) return;
        Object.assign(rec, r); store.save(); LG.app.rerender();
      } else if (act === 'del') {
        s.archive.splice(idx, 1); store.save(); LG.app.rerender();
        ui.toast('Deleted ' + (rec.name || rec.label || 'that item') + '.', { actionLabel: 'Undo', onAction: () => { s.archive.splice(idx, 0, rec); store.save(); LG.app.rerender(); } });
      } else if (act === 'restore') {
        A.restore(rec.id);
      }
    });
  };
  A.title = 'Archive';

  // ------------------------------------------- moving courses in and out
  /** Move a current course into the archive. Keeps a copy of the whole course so it can be moved back. */
  A.archiveCourse = (course) => {
    const s = store.state;
    const term = s.terms.filter((t) => t.id === course.termId)[0];
    const pct = E.courseGrade(course).percent;
    const rec = {
      id: u.uid('a'), kind: 'class', name: course.name || 'Untitled class', period: term ? term.name : '', when: monthNow(),
      subject: course.subject, level: course.level, credits: String(course.credits == null ? '1' : course.credits),
      percent: pct === null ? '' : String(E.round1(pct)), letter: '', note: '', snapshot: JSON.parse(JSON.stringify(course)),
    };
    const idx = s.courses.indexOf(course);
    s.courses.splice(idx, 1);
    s.archive.push(rec);
    store.save();
    return { rec, idx };
  };
  /** Move an archived course (one that was moved here from Grades) back to the current courses. */
  A.restore = (id) => {
    const s = store.state;
    const i = s.archive.findIndex((x) => x.id === id);
    if (i < 0 || !s.archive[i].snapshot) return;
    const rec = s.archive[i];
    const course = rec.snapshot;
    if (!s.terms.some((t) => t.id === course.termId)) course.termId = store.currentTerm().id;
    s.archive.splice(i, 1);
    s.courses.push(course);
    store.save();
    LG.app.rerender();
    ui.toast('Moved ' + (course.name || 'the course') + ' back to Grades.', { actionLabel: 'Undo', onAction: () => {
      const ci = s.courses.indexOf(course); if (ci >= 0) s.courses.splice(ci, 1);
      s.archive.splice(Math.min(i, s.archive.length), 0, rec); store.save(); LG.app.rerender();
    } });
  };
})();
