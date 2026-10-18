/* Little Grades: activities (volunteering, sports, clubs) and college course requirements. */
(function () {
  'use strict';
  const LG = window.LG;
  const u = LG.u, E = LG.E, ui = LG.ui, store = LG.store;
  const A = (LG.pages.activities = {});

  const TYPES = ['Volunteering', 'Sports', 'Club or team', 'Job', 'Arts and music', 'Leadership', 'Other'];
  const MAJORS = ['STEM', 'Health and medicine', 'Business', 'Arts and design', 'Humanities', 'Education', 'Law and public service', 'Trades and technical', 'Not sure yet', 'Other'];

  const hoursOf = (a) => {
    const t = E.num(a.totalHours);
    return t === null ? 0 : Math.max(0, t);
  };
  const fmtMonth = (ym) => {
    const m = /^(\d{4})-(\d{2})$/.exec(ym || '');
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '';
  };

  function activityForm(a) {
    return '<div class="form-grid">' +
      '<div class="field span2"><label class="lbl" for="ac-name">What is it?</label><input class="in" id="ac-name" value="' + u.esc(a.name) + '" placeholder="e.g. Food bank shifts" autocomplete="off"></div>' +
      '<div class="field"><label class="lbl" for="ac-type">Type</label><select class="in" id="ac-type">' + ui.options(TYPES, a.type) + '</select></div>' +
      '<div class="field"><label class="lbl" for="ac-major">Related major</label><select class="in" id="ac-major">' + ui.options(MAJORS, a.major) + '</select></div>' +
      '<div class="field span2"><label class="lbl" for="ac-role">Your role</label><input class="in" id="ac-role" value="' + u.esc(a.role) + '" placeholder="e.g. Volunteer, captain, member" autocomplete="off"></div>' +
      '<div class="field"><label class="lbl" for="ac-hpw">Hours per week</label><input class="in num" id="ac-hpw" inputmode="decimal" value="' + u.esc(a.hoursPerWeek) + '"></div>' +
      '<div class="field"><label class="lbl" for="ac-total">Total hours</label><input class="in num" id="ac-total" inputmode="decimal" value="' + u.esc(a.totalHours) + '"></div>' +
      '<div class="field"><label class="lbl" for="ac-start">Started</label><input class="in" type="month" id="ac-start" value="' + u.esc(a.start) + '"></div>' +
      '<div class="field"><label class="lbl" for="ac-end">Ended</label><input class="in" type="month" id="ac-end" value="' + u.esc(a.end) + '"></div>' +
      '<div class="field span2"><label class="lbl" for="ac-notes">Notes</label><textarea class="in" id="ac-notes" rows="3" placeholder="What you did, what you learned, awards...">' + u.esc(a.notes) + '</textarea></div></div>' +
      '<p class="hint">Leave "Ended" blank if you still do it.</p>';
  }

  async function editActivity(existing) {
    const a = existing || { id: u.uid('a'), name: '', type: 'Volunteering', major: 'Not sure yet', role: '', hoursPerWeek: '', totalHours: '', start: '', end: '', notes: '' };
    let out = null;
    const ok = await ui.modal({
      title: existing ? 'Edit activity' : 'Add an activity',
      html: activityForm(a),
      actions: [{ label: 'Cancel', kind: 'ghost', value: false }, { label: 'Save', kind: 'primary', value: true, onClick: (d) => {
        const v = (id) => u.$('#' + id, d).value.trim();
        if (!v('ac-name')) { u.$('#ac-name', d).focus(); u.$('#ac-name', d).setAttribute('aria-invalid', 'true'); return false; }
        out = Object.assign({}, a, { name: v('ac-name'), type: v('ac-type'), major: v('ac-major'), role: v('ac-role'), hoursPerWeek: v('ac-hpw'), totalHours: v('ac-total'), start: v('ac-start'), end: v('ac-end'), notes: u.$('#ac-notes', d).value.trim() });
      } }],
    });
    if (!ok || !out) return;
    const list = store.state.activities;
    const i = list.findIndex((x) => x.id === out.id);
    if (i >= 0) list[i] = out; else list.push(out);
    store.save(); LG.app.rerender();
  }

  async function collegeDialog(c) {
    const col = c || { id: u.uid('col'), name: '', avg: '', reqs: [] };
    let out = null;
    const ok = await ui.modal({
      title: c ? 'Edit college' : 'Add a college',
      html: '<div class="form-grid"><div class="field span2"><label class="lbl" for="cd-name">College or program</label><input class="in" id="cd-name" value="' + u.esc(col.name) + '" autocomplete="off"></div>' +
        '<div class="field"><label class="lbl" for="cd-avg">Usually wants %</label><input class="in num" id="cd-avg" inputmode="decimal" value="' + u.esc(col.avg) + '" placeholder="85"></div></div>' +
        '<p class="hint">Check the college\'s own website for the real numbers. Entries here are only as accurate as what you type.</p>',
      actions: [{ label: 'Cancel', kind: 'ghost', value: false }, { label: 'Save', kind: 'primary', value: true, onClick: (d) => {
        const name = u.$('#cd-name', d).value.trim();
        if (!name) { u.$('#cd-name', d).focus(); return false; }
        out = Object.assign({}, col, { name, avg: u.$('#cd-avg', d).value.trim() });
      } }],
    });
    if (!ok || !out) return;
    const list = store.state.profile.colleges;
    const i = list.findIndex((x) => x.id === out.id);
    if (i >= 0) list[i] = out; else list.push(out);
    store.save(); LG.app.rerender();
  }

  A.render = (view) => {
    const s = store.state;
    const groupBy = s.prefs.actGroup === 'major' ? 'major' : 'type';
    const acts = s.activities.slice();
    const totalHours = acts.reduce((t, a) => t + hoursOf(a), 0);

    // groups
    const keys = groupBy === 'major' ? MAJORS : TYPES;
    const groups = keys.map((k) => ({ key: k, items: acts.filter((a) => (a[groupBy] || 'Other') === k) })).filter((g) => g.items.length);
    const known = new Set(keys);
    const extra = acts.filter((a) => !known.has(a[groupBy] || 'Other'));
    if (extra.length) groups.push({ key: 'Other', items: extra });

    const actList = groups.length
      ? groups.map((g) => {
          const hrs = g.items.reduce((t, a) => t + hoursOf(a), 0);
          return '<section class="group" aria-label="' + u.esc(g.key) + '"><h3 class="group-h">' + u.esc(g.key) + '<span class="muted">' + g.items.length + ' &middot; ' + E.fmt(hrs) + ' hours</span></h3><ul class="plain-list">' +
            g.items.map((a) =>
              '<li class="act" data-act-id="' + a.id + '"><div class="act-main"><strong>' + u.esc(a.name) + '</strong>' +
              '<span class="muted">' + [a.role, groupBy === 'major' ? a.type : a.major].filter(Boolean).map(u.esc).join(' &middot; ') + '</span>' +
              '<span class="muted">' + [a.hoursPerWeek ? E.fmt(E.num(a.hoursPerWeek) || 0) + ' hrs/week' : '', hoursOf(a) ? E.fmt(hoursOf(a)) + ' hrs total' : '', a.start ? fmtMonth(a.start) + ' to ' + (a.end ? fmtMonth(a.end) : 'now') : ''].filter(Boolean).join(' · ') + '</span>' +
              (a.notes ? '<span class="act-notes">' + u.esc(a.notes) + '</span>' : '') + '</div>' +
              '<div class="act-btns"><button type="button" class="icon-btn" data-act="edit" aria-label="Edit ' + u.esc(a.name) + '">' + u.icon('edit') + '</button>' +
              '<button type="button" class="icon-btn" data-act="del" aria-label="Delete ' + u.esc(a.name) + '">' + u.icon('trash') + '</button></div></li>').join('') + '</ul></section>';
        }).join('')
      : '<div class="empty"><p>Nothing logged yet.</p><p class="muted">Volunteering, sports, clubs, a part-time job: it all counts. Add what you do and see your hours add up.</p></div>';

    // requirements
    const colleges = s.profile.colleges;
    const reqs = colleges.length
      ? colleges.map((c) => {
          const prog = E.requirementProgress(c.reqs, s.courses);
          return '<article class="card college" data-col="' + c.id + '" aria-label="' + u.esc(c.name) + '">' +
            '<div class="row-between"><div><h3>' + u.esc(c.name) + '</h3>' + (E.num(c.avg) !== null ? '<p class="muted">Usually wants about ' + E.fmt(E.num(c.avg)) + '%</p>' : '') + '</div>' +
            '<div class="act-btns"><button type="button" class="icon-btn" data-act="col-edit" aria-label="Edit ' + u.esc(c.name) + '">' + u.icon('edit') + '</button>' +
            '<button type="button" class="icon-btn" data-act="col-del" aria-label="Remove ' + u.esc(c.name) + '">' + u.icon('trash') + '</button></div></div>' +
            (prog.length ? '<ul class="plain-list req-list">' + prog.map((r, i) => {
              const pct = r.need > 0 ? Math.min(100, (r.have / r.need) * 100) : 100;
              const names = s.courses.filter((x) => x.subject === r.subject).map((x) => x.name);
              return '<li><div class="row-between"><strong>' + u.esc(r.subject) + '</strong><span class="status ' + (r.met ? 'met' : 'short') + '">' + (r.met ? u.icon('check') + 'Met' : E.fmt(r.short) + ' to go') + '</span></div>' +
                '<div class="bar" role="img" aria-label="' + E.fmt(r.have) + ' of ' + E.fmt(r.need) + ' ' + (r.need === 1 ? 'year' : 'years') + '"><i style="width:' + pct + '%"></i></div>' +
                '<p class="muted">' + E.fmt(r.have) + ' of ' + E.fmt(r.need) + ' ' + (r.need === 1 ? 'year' : 'years') + (names.length ? ' &middot; ' + names.map(u.esc).join(', ') : '') + '</p>' +
                '<button type="button" class="link-btn" data-act="req-del" data-i="' + i + '">Remove this requirement</button></li>';
            }).join('') + '</ul>' : '<p class="muted">No requirements added yet.</p>') +
            '<form class="req-add" data-col-form="' + c.id + '"><div class="field"><label class="lbl" for="rq-s-' + c.id + '">Subject</label><select class="in" id="rq-s-' + c.id + '">' + ui.options(LG.consts.SUBJECTS, 'English') + '</select></div>' +
            '<div class="field narrow"><label class="lbl" for="rq-y-' + c.id + '">Years</label><input class="in num" id="rq-y-' + c.id + '" inputmode="decimal" value="1"></div>' +
            '<button type="submit" class="btn">' + u.icon('plus') + ' Add</button></form></article>';
        }).join('')
      : '<div class="empty"><p>No colleges yet.</p><p class="muted">Add a college or program to compare the courses you have taken with what it asks for.</p></div>';

    view.innerHTML =
      '<h1 class="page-title">Activities</h1>' +
      ui.bubble('Everything you do outside class counts. Log it here, and it is all ready when you need it for an application.', { mood: 'happy' }) +
      '<div class="row-between wrap"><button type="button" class="btn primary" data-act="add">' + u.icon('plus') + ' Add an activity</button>' +
      '<fieldset class="seg-wrap inline"><legend class="lbl">Group by</legend><div class="seg" id="grp-seg"><button type="button" data-v="type" aria-pressed="' + (groupBy === 'type') + '">Type</button><button type="button" data-v="major" aria-pressed="' + (groupBy === 'major') + '">Major</button></div></fieldset></div>' +
      (acts.length ? '<p class="muted"><strong>' + acts.length + '</strong> activit' + (acts.length === 1 ? 'y' : 'ies') + ' &middot; <strong>' + E.fmt(totalHours) + '</strong> hours logged</p>' : '') +
      '<div class="stack">' + actList + '</div>' +
      '<section aria-labelledby="req-h" class="stack"><div class="row-between"><h2 id="req-h">Course requirements</h2><button type="button" class="btn" data-act="col-add">' + u.icon('plus') + ' Add a college</button></div>' +
      '<p class="muted">Optional. Tell me what a college asks for, and I will count the courses you have taken against it.</p>' + reqs + '</section>';

    ui.enhance(view);

    u.$('#grp-seg', view).addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      s.prefs.actGroup = b.dataset.v; store.save(); LG.app.rerender();
    });
    view.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const act = b.dataset.act;
      const row = b.closest('[data-act-id]');
      const col = b.closest('[data-col]');
      if (act === 'add') editActivity(null);
      else if (act === 'edit' && row) editActivity(s.activities.filter((x) => x.id === row.dataset.actId)[0]);
      else if (act === 'del' && row) {
        const idx = s.activities.findIndex((x) => x.id === row.dataset.actId);
        const gone = s.activities[idx];
        s.activities.splice(idx, 1); store.save(); LG.app.rerender();
        ui.toast('Deleted ' + gone.name + '.', { actionLabel: 'Undo', onAction: () => { s.activities.splice(idx, 0, gone); store.save(); LG.app.rerender(); } });
      } else if (act === 'col-add') collegeDialog(null);
      else if (act === 'col-edit' && col) collegeDialog(s.profile.colleges.filter((x) => x.id === col.dataset.col)[0]);
      else if (act === 'col-del' && col) {
        const c = s.profile.colleges.filter((x) => x.id === col.dataset.col)[0];
        const ok = await ui.confirm({ title: 'Remove ' + c.name + '?', body: 'Its requirements will be removed too.', confirmLabel: 'Remove', danger: true });
        if (!ok) return;
        const idx = s.profile.colleges.indexOf(c);
        s.profile.colleges.splice(idx, 1); store.save(); LG.app.rerender();
        ui.toast('Removed ' + c.name + '.', { actionLabel: 'Undo', onAction: () => { s.profile.colleges.splice(idx, 0, c); store.save(); LG.app.rerender(); } });
      } else if (act === 'req-del' && col) {
        const c = s.profile.colleges.filter((x) => x.id === col.dataset.col)[0];
        c.reqs.splice(Number(b.dataset.i), 1); store.save(); LG.app.rerender();
      }
    });
    view.addEventListener('submit', (e) => {
      const f = e.target.closest('[data-col-form]'); if (!f) return;
      e.preventDefault();
      const c = s.profile.colleges.filter((x) => x.id === f.dataset.colForm)[0];
      const subject = u.$('select', f).value;
      const years = E.num(u.$('input', f).value);
      if (!c || years === null || years <= 0) { ui.toast('Enter how many years it asks for, like 4 or 0.5.'); return; }
      c.reqs.push({ id: u.uid('r'), subject, years: String(years) });
      store.save(); LG.app.rerender();
    });
  };
  A.title = 'Activities';
})();
