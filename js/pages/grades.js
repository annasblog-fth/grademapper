/* Little Grades: grades pages (terms, course list, trend chart, course editor). */
(function () {
  'use strict';
  const LG = window.LG;
  const u = LG.u, E = LG.E, ui = LG.ui, store = LG.store;

  // ------------------------------------------------------------- constants
  const SUBJECTS = ['English', 'Math', 'Science', 'Social studies', 'Language', 'Arts', 'PE or health', 'Technology or business', 'Other'];
  const LEVELS = [
    { value: 'regular', label: 'Regular' },
    { value: 'honors', label: 'Honors' },
    { value: 'ap', label: 'AP' },
    { value: 'ib', label: 'IB' },
  ];
  const REMIND = [
    { value: '', label: 'No reminder' },
    { value: '0', label: 'At the time' },
    { value: '60', label: '1 hour before' },
    { value: '1440', label: '1 day before' },
    { value: '2880', label: '2 days before' },
    { value: '10080', label: '1 week before' },
  ];
  const TEMPLATES = {
    blank: { label: 'Blank (I will add my own)', cats: [] },
    typical: { label: 'Typical: homework, quizzes, tests, final', cats: [['Homework', 20], ['Quizzes', 15], ['Tests', 35], ['Final exam', 30]] },
    exams: { label: 'Exam-heavy: assignments, midterm, final', cats: [['Assignments', 20], ['Midterm', 30], ['Final exam', 50]] },
    projects: { label: 'Project-based: participation, projects, tests', cats: [['Participation', 10], ['Projects', 50], ['Tests', 40]] },
  };
  LG.consts = { SUBJECTS, LEVELS, REMIND };

  const G = (LG.pages.grades = {});

  // ------------------------------------------------------------ data helpers
  function newEntry(extra) { return Object.assign({ id: u.uid('e'), name: '', score: '', max: '100' }, extra || {}); }
  function newCategory(name, weight) { return { id: u.uid('k'), name: name || '', weight: weight == null ? '' : String(weight), dropLowest: '0', entries: [] }; }

  function newCourse(o) {
    const s = store.state;
    const c = {
      id: u.uid('c'),
      name: o.name || 'New course',
      subject: o.subject || 'Other',
      level: o.level || 'regular',
      credits: o.credits == null ? '1' : String(o.credits),
      target: o.target == null ? s.profile.goal || '' : o.target,
      termId: o.termId || store.currentTerm().id,
      celebrated: null,
      categories: [],
    };
    const t = TEMPLATES[o.template || 'blank'];
    t.cats.forEach((p) => c.categories.push(newCategory(p[0], p[1])));
    return c;
  }

  /** A ready-made example course so people can try everything straight away. */
  G.sampleCourse = (termId) => {
    const today = u.todayISO();
    const e = (name, score, max, extra) => newEntry(Object.assign({ name, score: String(score), max: String(max) }, extra || {}));
    const c = newCourse({ name: 'Math 11 (example)', subject: 'Math', level: 'regular', credits: 1, target: '83', termId });
    const k = (name, w, drop, entries) => { const cat = newCategory(name, w); cat.dropLowest = String(drop); cat.entries = entries; return cat; };
    c.categories = [
      k('Homework', 15, 0, [e('Homework 1', 9, 10), e('Homework 2', 10, 10), e('Homework 3', 8, 10)]),
      k('Quizzes', 10, 1, [e('Quiz 1', 6, 10), e('Quiz 2', 9, 10), e('Quiz 3', 8, 10), e('Quiz 4', '', 10, { due: u.addDays(today, 4), time: '09:00', remind: '1440' })]),
      k('Unit tests', 35, 0, [e('Unit 1 test', 24, 30), e('Unit 2 test', 31, 40), e('Unit 3 test', '', 40, { due: u.addDays(today, 9), time: '10:30', remind: '1440' })]),
      k('Projects', 10, 0, [e('Project 1', 35, 50)]),
      k('Final exam', 30, 0, [e('Final exam', '', 100, { due: u.addDays(today, 40), time: '09:00', remind: '10080' })]),
    ];
    return c;
  };

  function goalStatus(course) {
    const t = E.num(course.target);
    const need = E.neededScore(course, t);
    const grade = E.courseGrade(course).percent;
    const reached = t !== null && (need.status === 'secured' || (need.status === 'no-upcoming' && grade !== null && grade >= t - E.EPS));
    return { t, need, grade, reached };
  }
  /** Celebrate when a goal becomes locked in. Returns true if it just did. */
  G.evaluateGoal = (course, userInitiated) => {
    const g = goalStatus(course);
    if (g.reached) {
      if (course.celebrated !== g.t) {
        course.celebrated = g.t;
        store.save();
        if (userInitiated) { ui.celebrate(course.name, g.t); return true; }
      }
    } else if (course.celebrated != null) {
      course.celebrated = null;
      store.save();
    }
    return false;
  };

  const levelLabel = (v) => (LEVELS.filter((l) => l.value === v)[0] || LEVELS[0]).label;
  const pointsChip = (scale, percent, course) => {
    if (percent === null) return '';
    const p = E.pointsFor(percent, scale, Object.assign({}, store.gpaOpts(), { level: course && course.level }));
    return p === null ? '' : '<span class="chip"><small>' + u.esc(scale.pointsLabel || 'Points') + '</small>' + p.toFixed(1) + '</span>';
  };

  // ------------------------------------------------------------ trend chart
  function trendChart(sums, goal) {
    const W = 360, H = 220, m = { l: 38, r: 14, t: 22, b: 38 };
    const vals = sums.map((s) => s.percent);
    const all = vals.concat(goal !== null ? [goal] : []);
    let lo = Math.max(0, Math.floor((Math.min.apply(null, all) - 6) / 5) * 5);
    let hi = Math.ceil((Math.max.apply(null, all) + 4) / 5) * 5;
    if (hi - lo < 20) lo = Math.max(0, hi - 20);
    const X = (i) => (sums.length === 1 ? (m.l + W - m.r) / 2 : m.l + ((W - m.l - m.r) * i) / (sums.length - 1));
    const Y = (v) => m.t + (H - m.t - m.b) * (1 - (v - lo) / (hi - lo));
    const step = hi - lo > 40 ? 20 : hi - lo > 20 ? 10 : 5;
    let grid = '';
    for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) {
      grid += '<line class="ch-grid" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(t) + '" y2="' + Y(t) + '"/><text class="ch-txt sm" x="' + (m.l - 6) + '" y="' + (Y(t) + 4) + '" text-anchor="end">' + t + '</text>';
    }
    const path = sums.map((s, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(s.percent).toFixed(1)).join(' ');
    const pts = sums.map((s, i) =>
      '<circle class="ch-pt" cx="' + X(i).toFixed(1) + '" cy="' + Y(s.percent).toFixed(1) + '" r="5"/>' +
      '<text class="ch-txt" x="' + X(i).toFixed(1) + '" y="' + (Y(s.percent) - 11).toFixed(1) + '" text-anchor="middle">' + E.fmt(s.percent) + '%</text>' +
      '<text class="ch-txt sm" x="' + X(i).toFixed(1) + '" y="' + (H - m.b + 18) + '" text-anchor="middle">' + u.esc(s.name.length > 10 ? s.name.slice(0, 9) + '…' : s.name) + '</text>'
    ).join('');
    let goalLine = '';
    if (goal !== null && goal >= lo && goal <= hi) {
      goalLine = '<line class="ch-goal" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(goal) + '" y2="' + Y(goal) + '"/>' +
        '<text class="ch-txt sm" x="' + (W - m.r) + '" y="' + (Y(goal) - 5) + '" text-anchor="end">Goal ' + E.fmt(goal) + '%</text>';
    }
    const label = 'Average by term: ' + sums.map((s) => s.name + ' ' + E.fmt(s.percent) + '%').join(', ') + (goal !== null ? '. Goal ' + E.fmt(goal) + '%.' : '.');
    const table =
      '<details class="table-alt"><summary>Show as a table</summary><table><thead><tr><th>Term</th><th>Average</th><th>Courses</th></tr></thead><tbody>' +
      sums.map((s) => '<tr><td>' + u.esc(s.name) + '</td><td>' + E.fmt(s.percent) + '%</td><td>' + s.count + '</td></tr>').join('') +
      '</tbody></table></details>';
    return '<figure class="chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + u.esc(label) + '">' + grid + goalLine +
      '<path class="ch-line" d="' + path + '"/>' + pts + '</svg>' +
      '<figcaption class="muted">Solid line: your average each term. Dashed line: your goal.</figcaption></figure>' + table;
  }

  // ------------------------------------------------------------------ list
  function renderList(view) {
    const s = store.state;
    const scale = store.scale();
    const opts = store.gpaOpts();
    const term = store.currentTerm();
    const courses = s.courses.filter((c) => c.termId === term.id);
    const sum = E.cumulative(courses, scale, opts);
    const all = E.cumulative(s.courses, scale, opts);
    const sums = E.termSummaries(s.terms, s.courses, scale, opts);
    const goal = E.num(s.profile.goal);
    const hasPts = E.hasPoints(scale);
    const band = sum.percent === null ? null : E.bandFor(sum.percent, scale);
    const ptsLabel = scale.pointsLabel || 'Points';

    let summary;
    if (sum.percent === null) {
      summary = '<p class="muted">No graded work in this term yet. Add a course, then add scores as they come in.</p>';
    } else {
      summary =
        '<div class="score-row"><p class="score" aria-live="polite">' + E.fmt(sum.percent) + '<span class="u">%</span></p>' +
        '<div class="chips"><span class="chip"><small>Letter</small>' + u.esc(band.letter) + '</span>' +
        (hasPts && sum.points !== null ? '<span class="chip"><small>' + u.esc(ptsLabel) + '</small>' + sum.points.toFixed(2) + '</span>' : '') + '</div></div>' +
        '<div data-meter>' + ui.meterHTML() + '</div>';
    }
    const cumLine = all.percent !== null && s.terms.length > 1
      ? '<p class="muted">All terms together: <strong>' + E.fmt(all.percent) + '%</strong>' + (hasPts && all.points !== null ? ' &middot; cumulative ' + u.esc(ptsLabel) + ' <strong>' + all.points.toFixed(2) + '</strong>' : '') + '</p>'
      : '';
    const weightedToggle = hasPts && scale.allowsBonus
      ? '<fieldset class="seg-wrap"><legend class="lbl">GPA type</legend><div class="seg" id="gpa-seg">' +
        '<button type="button" data-v="0" aria-pressed="' + !s.prefs.weighted + '">Unweighted</button>' +
        '<button type="button" data-v="1" aria-pressed="' + !!s.prefs.weighted + '">Weighted</button></div>' +
        '<p class="hint">' + (s.prefs.weighted ? 'Honors, AP and IB courses add bonus points. You can change the bonus in Settings.' : 'Every course counts the same, with a top mark of 4.0.') + '</p></fieldset>'
      : '';

    const courseCards = courses.length
      ? '<ul class="course-list">' + courses.map((c) => {
          const g = E.courseGrade(c).percent;
          const b = g === null ? null : E.bandFor(g, scale);
          const coach = E.coach(c, c.target, scale);
          const next = E.upcomingItems(c).filter((i) => i.due).sort((a, z) => a.due.localeCompare(z.due))[0];
          return '<li><a class="course-card" href="#/grades/' + c.id + '">' +
            '<span class="cc-main"><strong>' + u.esc(c.name) + '</strong>' +
            '<span class="muted">' + u.esc(c.subject) + ' &middot; ' + levelLabel(c.level) + (E.creditsOf(c) !== 1 ? ' &middot; ' + E.fmt(E.creditsOf(c)) + ' credits' : '') + '</span>' +
            (next ? '<span class="muted">Next: ' + u.esc(next.name || 'Untitled') + ', ' + u.esc(u.relDay(next.due).toLowerCase()) + '</span>' : '') +
            (E.num(c.target) !== null && coach.tone !== 'empty' ? '<span class="mini-tone" data-tone="' + coach.tone + '">' + ui.toneIcon(coach.tone) + ui.toneTag(coach.tone) + '</span>' : '') +
            '</span><span class="cc-grade">' + (g === null ? '<span class="muted">No marks</span>' : '<b>' + E.fmt(g) + '%</b><span>' + u.esc(b.letter) + '</span>') + '</span>' +
            '<span class="cc-go">' + u.icon('chev') + '</span></a></li>';
        }).join('') + '</ul>'
      : '<div class="empty"><p>No courses in <strong>' + u.esc(term.name) + '</strong> yet.</p><p class="muted">Add one to start tracking, or load an example to see how everything works.</p></div>';

    view.innerHTML =
      '<h1 class="page-title">Grades</h1>' +
      '<div class="term-bar"><div class="field"><label class="lbl" for="term-sel">Term</label><select class="in" id="term-sel">' +
      ui.options(s.terms.map((t) => ({ value: t.id, label: t.name })), term.id) + '</select></div>' +
      '<button type="button" class="icon-btn" data-act="term-add" aria-label="Add a term">' + u.icon('plus') + '</button>' +
      '<button type="button" class="icon-btn" data-act="term-rename" aria-label="Rename this term">' + u.icon('edit') + '</button>' +
      '<button type="button" class="icon-btn" data-act="term-del" aria-label="Delete this term">' + u.icon('trash') + '</button></div>' +
      '<section class="card" aria-labelledby="sum-h"><h2 id="sum-h">' + u.esc(term.name) + ' so far</h2>' + summary + cumLine + weightedToggle + '</section>' +
      (sums.length ? '<section class="card" aria-labelledby="trend-h"><h2 id="trend-h">Your trend</h2>' + trendChart(sums, goal) + '</section>' : '') +
      '<section aria-labelledby="courses-h" class="stack"><div class="row-between"><h2 id="courses-h">Courses</h2>' +
      '<button type="button" class="btn primary" data-act="course-add">' + u.icon('plus') + ' Add a course</button></div>' + courseCards +
      (courses.length ? '' : '<div><button type="button" class="btn" data-act="course-example">Load an example course</button></div>') + '</section>';

    if (sum.percent !== null) ui.updateMeter(u.$('[data-meter] .meter', view), { cur: sum.percent, goal });

    u.$('#term-sel', view).addEventListener('change', (e) => { s.prefs.termId = e.target.value; store.save(); LG.app.rerender(); });
    const seg = u.$('#gpa-seg', view);
    if (seg) seg.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      s.prefs.weighted = b.dataset.v === '1'; store.save(); LG.app.rerender();
    });
    view.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      ({ 'term-add': addTerm, 'term-rename': renameTerm, 'term-del': deleteTerm, 'course-add': addCourse, 'course-example': addExample }[b.dataset.act] || (() => {}))();
    });

    // The welcome flow can ask for a course dialog or the example straight away.
    if (LG.app.flag === 'addCourse') { LG.app.flag = null; setTimeout(addCourse, 0); }
    else if (LG.app.flag === 'example') { LG.app.flag = null; setTimeout(addExample, 0); }
  }

  async function termDialog(title, value) {
    let out = null;
    const r = await ui.modal({
      title,
      html: '<div class="field"><label class="lbl" for="term-name">Name</label><input class="in" id="term-name" value="' + u.esc(value) + '" autocomplete="off"></div>',
      actions: [{ label: 'Cancel', kind: 'ghost', value: false }, { label: 'Save', kind: 'primary', value: true, onClick: (d) => { out = u.$('#term-name', d).value.trim(); } }],
    });
    return r ? out : null;
  }
  async function addTerm() {
    const name = await termDialog('Add a term', 'Term ' + (store.state.terms.length + 1));
    if (!name) return;
    const t = { id: u.uid('t'), name };
    store.state.terms.push(t);
    store.state.prefs.termId = t.id;
    store.save(); LG.app.rerender();
  }
  async function renameTerm() {
    const t = store.currentTerm();
    const name = await termDialog('Rename this term', t.name);
    if (!name) return;
    t.name = name; store.save(); LG.app.rerender();
  }
  async function deleteTerm() {
    const s = store.state;
    const t = store.currentTerm();
    if (s.terms.length < 2) { ui.toast('Keep at least one term. You can rename this one instead.'); return; }
    const mine = s.courses.filter((c) => c.termId === t.id).length;
    const ok = await ui.confirm({
      title: 'Delete ' + t.name + '?',
      body: mine ? 'This also removes its ' + mine + ' course' + (mine === 1 ? '' : 's') + ' and their scores. You can undo right after.' : 'This term has no courses.',
      confirmLabel: 'Delete term', danger: true,
    });
    if (!ok) return;
    const snap = JSON.stringify({ terms: s.terms, courses: s.courses, termId: s.prefs.termId });
    s.terms = s.terms.filter((x) => x.id !== t.id);
    s.courses = s.courses.filter((c) => c.termId !== t.id);
    s.prefs.termId = s.terms[s.terms.length - 1].id;
    store.save(); LG.app.rerender();
    ui.toast('Deleted ' + t.name + '.', { actionLabel: 'Undo', onAction: () => {
      const b = JSON.parse(snap); s.terms = b.terms; s.courses = b.courses; s.prefs.termId = b.termId; store.save(); LG.app.rerender();
    } });
  }

  async function addCourse() {
    const s = store.state;
    const body =
      '<div class="form-grid">' +
      ui.field('nc-name', 'Course name', '', 'placeholder="e.g. Biology 11" autocomplete="off"') +
      '<div class="field"><label class="lbl" for="nc-subject">Subject</label><select class="in" id="nc-subject">' + ui.options(SUBJECTS, 'Other') + '</select></div>' +
      '<div class="field"><label class="lbl" for="nc-level">Level</label><select class="in" id="nc-level">' + ui.options(LEVELS, 'regular') + '</select></div>' +
      '<div class="field"><label class="lbl" for="nc-credits">Credits</label><input class="in num" id="nc-credits" inputmode="decimal" value="1"></div>' +
      '<div class="field"><label class="lbl" for="nc-term">Term</label><select class="in" id="nc-term">' + ui.options(s.terms.map((t) => ({ value: t.id, label: t.name })), store.currentTerm().id) + '</select></div>' +
      '<div class="field"><label class="lbl" for="nc-target">Goal %</label><input class="in num" id="nc-target" inputmode="decimal" value="' + u.esc(s.profile.goal) + '" placeholder="85"></div>' +
      '</div><div class="field"><label class="lbl" for="nc-template">Start with</label><select class="in" id="nc-template">' +
      ui.options(Object.keys(TEMPLATES).map((k) => ({ value: k, label: TEMPLATES[k].label })), 'typical') + '</select></div>' +
      '<p class="hint">Weights are just a starting point. You can change every one on the next screen.</p>';
    let created = null;
    const ok = await ui.modal({
      title: 'Add a course', html: body,
      actions: [{ label: 'Cancel', kind: 'ghost', value: false }, { label: 'Add course', kind: 'primary', value: true, onClick: (d) => {
        const v = (id) => u.$('#' + id, d).value;
        created = newCourse({ name: v('nc-name').trim() || 'New course', subject: v('nc-subject'), level: v('nc-level'), credits: v('nc-credits'), termId: v('nc-term'), target: v('nc-target'), template: v('nc-template') });
      } }],
    });
    if (!ok || !created) return;
    s.courses.push(created);
    s.prefs.termId = created.termId;
    store.save();
    location.hash = '#/grades/' + created.id;
  }
  function addExample() {
    const c = G.sampleCourse(store.currentTerm().id);
    store.state.courses.push(c);
    store.save(); LG.app.rerender();
    ui.toast('Example loaded. Change anything you like, or delete it when you are done.');
  }

  // ---------------------------------------------------------------- course
  function entryHTML(en) {
    const nm = en.name || 'this item';
    const upcoming = E.isUpcoming(en);
    return '<li class="entry" data-entry-row="' + en.id + '">' +
      '<input class="in" id="en-' + en.id + '" data-entry="' + en.id + '" data-f="name" value="' + u.esc(en.name) + '" placeholder="Name" autocomplete="off" aria-label="Name of item">' +
      '<div class="ecell"><label class="mini-lbl" for="es-' + en.id + '">Score</label><input class="in num sc-in" id="es-' + en.id + '" data-entry="' + en.id + '" data-f="score" inputmode="decimal" value="' + u.esc(en.score) + '" placeholder="&ndash;" autocomplete="off" aria-label="Score for ' + u.esc(nm) + '"></div>' +
      '<div class="ecell"><label class="mini-lbl" for="em-' + en.id + '">Out of</label><input class="in num" id="em-' + en.id + '" data-entry="' + en.id + '" data-f="max" inputmode="decimal" value="' + u.esc(en.max) + '" placeholder="100" autocomplete="off" aria-label="Out of, for ' + u.esc(nm) + '"></div>' +
      '<button type="button" class="icon-btn" data-act="del-entry" data-entry="' + en.id + '" aria-label="Remove ' + u.esc(nm) + '">' + u.icon('x') + '</button>' +
      '<div class="entry-due" ' + (upcoming ? '' : 'hidden') + '>' +
        '<button type="button" class="link-btn" data-act="due" aria-expanded="false" aria-controls="more-' + en.id + '">' + u.icon('calendar') + '<span data-due-label>' + dueLabel(en) + '</span></button>' +
        '<div class="entry-more" id="more-' + en.id + '" hidden>' +
          '<div class="field"><label class="lbl" for="ed-' + en.id + '">Due date</label><input class="in" type="date" id="ed-' + en.id + '" data-entry="' + en.id + '" data-f="due" value="' + u.esc(en.due || '') + '"></div>' +
          '<div class="field"><label class="lbl" for="et-' + en.id + '">Time</label><input class="in" type="time" id="et-' + en.id + '" data-entry="' + en.id + '" data-f="time" value="' + u.esc(en.time || '') + '"></div>' +
          '<div class="field"><label class="lbl" for="er-' + en.id + '">Remind me</label><select class="in" id="er-' + en.id + '" data-entry="' + en.id + '" data-f="remind">' + ui.options(REMIND, en.remind == null ? '' : en.remind) + '</select></div>' +
        '</div></div></li>';
  }
  function dueLabel(en) {
    if (!en.due) return 'Add a due date';
    return 'Due ' + u.fmtDate(en.due) + (en.time ? ', ' + u.fmtTime(en.time) : '');
  }
  function catHTML(cat) {
    const id = cat.id;
    return '<section class="cat" data-cat-id="' + id + '" aria-label="' + u.esc(cat.name || 'New category') + '">' +
      '<div class="cat-head">' +
        '<div><label class="lbl" for="cn-' + id + '">Category</label><input class="in" id="cn-' + id + '" data-f="name" value="' + u.esc(cat.name) + '" placeholder="e.g. Tests" autocomplete="off"></div>' +
        '<div><label class="lbl" for="cw-' + id + '">Worth %</label><input class="in num" id="cw-' + id + '" data-f="weight" inputmode="decimal" value="' + u.esc(cat.weight) + '" placeholder="20" autocomplete="off"></div>' +
        '<div><label class="lbl" for="cd-' + id + '">Drop low</label><input class="in num" id="cd-' + id + '" data-f="dropLowest" inputmode="numeric" value="' + u.esc(cat.dropLowest) + '" placeholder="0" autocomplete="off"></div>' +
      '</div>' +
      '<p class="avg">Average so far: <strong id="avg-' + id + '">&ndash;</strong></p>' +
      '<div class="entry-cols" aria-hidden="true"><span>Item</span><span>Score</span><span>Out of</span><span></span></div>' +
      '<ul class="entries">' + cat.entries.map(entryHTML).join('') + '</ul>' +
      '<div class="cat-actions"><button type="button" class="btn" data-act="add-entry">' + u.icon('plus') + ' Add a score</button><button type="button" class="btn quiet" data-act="del-cat">Remove category</button></div>' +
      '</section>';
  }

  function renderCourse(view, id) {
    const course = store.course(id);
    if (!course) {
      view.innerHTML = '<div class="empty"><p>That course was not found.</p><a class="btn primary" href="#/grades">Back to grades</a></div>';
      return;
    }
    const s = store.state;
    const scale = store.scale();
    const term = s.terms.filter((t) => t.id === course.termId)[0];
    const ref = { whatIf: Number(course.whatIf == null ? 85 : course.whatIf) };

    view.innerHTML =
      '<p><a class="back" href="#/grades">' + u.icon('back') + ' All courses</a></p>' +
      '<h1 class="sr-only" id="course-h1">' + u.esc(course.name || 'Course') + '</h1>' +
      '<section class="hero" aria-label="Your grade in this course">' +
        '<div><label class="lbl" for="course-name">Course</label><input class="course-name" id="course-name" autocomplete="off" placeholder="Course name" value="' + u.esc(course.name) + '"></div>' +
        '<p class="muted hero-meta">' + u.esc(course.subject) + ' &middot; ' + levelLabel(course.level) + ' &middot; ' + u.esc(term ? term.name : '') + '</p>' +
        '<div class="score-row"><p class="score" aria-live="polite"><span id="grade-pct">&ndash;</span><span class="u" id="grade-unit" hidden>%</span></p>' +
        '<div class="chips"><span class="chip" id="grade-letter" hidden></span><span id="grade-pts"></span></div></div>' +
        '<div id="meter">' + ui.meterHTML() + '</div>' +
        '<div id="coach-slot"></div>' +
      '</section>' +

      '<section class="card" aria-labelledby="need-h"><h2 id="need-h">What do I need?</h2>' +
        '<div class="goal-set"><div class="field"><label class="lbl" for="goal">My goal %</label><input class="in num" id="goal" inputmode="decimal" autocomplete="off" placeholder="85" value="' + u.esc(course.target) + '"></div><p class="letter" id="goal-letter"></p></div>' +
        '<div class="goal-chips" id="goal-chips" role="group" aria-label="Quick goals by letter"></div>' +
        '<div class="need" aria-live="polite"><p class="need-big" id="need-big">&ndash;</p><p class="need-cap" id="need-cap"></p></div>' +
        '<div id="upcoming-wrap" hidden><p class="sub">Still to come</p><ul class="upcoming" id="upcoming"></ul></div>' +
        '<div class="whatif" id="whatif" hidden><label class="sub" for="wi">What if I score this on everything left?</label>' +
        '<div class="whatif-row"><input type="range" id="wi" min="0" max="100" step="1" value="' + ref.whatIf + '"><output id="wi-out" for="wi"></output></div>' +
        '<p class="whatif-result" id="wi-result" aria-live="polite"></p></div>' +
      '</section>' +

      '<section class="scores" aria-labelledby="scores-h"><div class="scores-head"><h2 id="scores-h">Your scores</h2>' +
      '<p class="muted">Leave a score blank for anything still coming up. Decimals are fine everywhere.</p></div>' +
      '<div class="cats" id="cats"></div><p class="wsum" id="wsum"></p>' +
      '<div><button type="button" class="btn primary" id="add-cat">' + u.icon('plus') + ' Add a category</button></div></section>' +

      '<details class="card" id="course-settings"><summary><h2>Course settings</h2></summary><div class="form-grid">' +
      '<div class="field"><label class="lbl" for="cs-subject">Subject</label><select class="in" id="cs-subject">' + ui.options(SUBJECTS, course.subject) + '</select></div>' +
      '<div class="field"><label class="lbl" for="cs-level">Level</label><select class="in" id="cs-level">' + ui.options(LEVELS, course.level) + '</select></div>' +
      '<div class="field"><label class="lbl" for="cs-credits">Credits</label><input class="in num" id="cs-credits" inputmode="decimal" value="' + u.esc(course.credits) + '"></div>' +
      '<div class="field"><label class="lbl" for="cs-term">Term</label><select class="in" id="cs-term">' + ui.options(s.terms.map((t) => ({ value: t.id, label: t.name })), course.termId) + '</select></div></div>' +
      '<p class="hint">Credits count how much this course weighs in your GPA. A full-year course is usually 1, a semester course 0.5.</p>' +
      '<button type="button" class="btn danger" id="del-course">' + u.icon('trash') + ' Delete this course</button></details>';

    function renderEditor() {
      const box = u.$('#cats', view);
      box.innerHTML = course.categories.length ? course.categories.map(catHTML).join('')
        : '<p class="empty">No categories yet. Add one, like Tests or Homework, then say how much of your grade it is worth.</p>';
    }
    function renderChips() {
      const t = E.num(course.target);
      u.$('#goal-chips', view).innerHTML = scale.bands.filter((b) => b.min > 0).map((b) =>
        '<button type="button" data-goal="' + b.min + '" aria-pressed="' + (t === b.min) + '">' + u.esc(b.letter) + ' &middot; ' + b.min + '%</button>').join('');
    }
    const setText = (sel, t) => { const el = u.$(sel, view); if (el.textContent !== t) el.textContent = t; };

    function update() {
      const t = E.num(course.target);
      const g = E.courseGrade(course);
      const need = E.neededScore(course, t);
      const coach = E.coach(course, t, scale);
      g.categories.forEach((k) => {
        const el = document.getElementById('avg-' + k.id);
        if (el) el.textContent = k.average === null ? 'no scores yet' : E.fmt(k.average) + '%';
      });
      const total = E.totalWeight(course);
      setText('#wsum', course.categories.length ? (Math.abs(total - 100) < 0.05 ? 'Worth adds up to 100%.' : 'Worth adds up to ' + E.fmt(total) + '%. That is fine, I scale it to match.') : '');

      const band = g.percent === null ? null : E.bandFor(g.percent, scale);
      setText('#grade-pct', g.percent === null ? '–' : E.fmt(g.percent));
      u.$('#grade-unit', view).hidden = g.percent === null;
      const letterEl = u.$('#grade-letter', view);
      letterEl.hidden = !band;
      if (band) letterEl.innerHTML = '<small>Letter</small>' + u.esc(band.letter);
      u.$('#grade-pts', view).innerHTML = pointsChip(scale, g.percent, course);

      ui.updateMeter(u.$('#meter .meter', view), { cur: g.percent, goal: t !== null && t >= 0 && t <= 100 ? t : null, best: need.bestCase });

      const slot = u.$('#coach-slot', view);
      const html = ui.coachHTML(coach);
      if (slot.dataset.html !== html) { slot.innerHTML = html; slot.dataset.html = html; }

      setText('#goal-letter', t === null ? '' : 'is a ' + E.bandFor(t, scale).letter + ' on this scale');
      u.$$('#goal-chips button', view).forEach((b) => b.setAttribute('aria-pressed', String(t !== null && Number(b.dataset.goal) === t)));

      const items = E.upcomingItems(course);
      const n = items.length;
      let big = '–', cap = '';
      if (need.status === 'reachable') { big = E.fmt(need.needed) + '%'; cap = 'average needed on ' + (n === 1 ? 'what is still to come' : 'each of the ' + n + ' things still to come') + '.'; }
      else if (need.status === 'secured') { big = 'Covered'; cap = 'You already have enough for this goal.'; }
      else if (need.status === 'out-of-reach') { big = E.fmt(need.bestCase) + '%'; cap = 'is the most you can finish with. Try a nearer goal.'; }
      else if (need.status === 'no-upcoming') cap = 'Add something coming up (a test or assignment) and leave its score blank.';
      else cap = 'Enter a goal to see what you need.';
      setText('#need-big', big);
      setText('#need-cap', cap);

      u.$('#upcoming-wrap', view).hidden = n === 0;
      u.$('#upcoming', view).innerHTML = items.map((it) =>
        '<li><span>' + u.esc(it.name || 'Untitled') + '<small>' + u.esc(it.category || 'No category') + (it.due ? ' &middot; due ' + u.esc(u.fmtDate(it.due)) : '') + '</small></span>' +
        '<span class="w">worth ' + E.fmt(it.worth) + '%</span></li>').join('');

      const wi = u.$('#whatif', view);
      wi.hidden = !E.hasUpcoming(course);
      if (!wi.hidden) {
        const x = ref.whatIf;
        setText('#wi-out', E.fmt(x) + '%');
        const res = E.courseGrade(course, x).percent;
        let txt = '';
        if (res !== null) {
          txt = 'You would finish with ' + E.fmt(res) + '% (' + E.bandFor(res, scale).letter + ').';
          if (t !== null) txt += res >= t - E.EPS ? ' That reaches your goal.' : ' That is ' + E.fmt(t - res) + ' points short of your goal.';
        }
        setText('#wi-result', txt);
      }
    }

    function findCat(el) { const sec = el.closest('[data-cat-id]'); return sec && course.categories.filter((c) => c.id === sec.dataset.catId)[0]; }
    const cats = u.$('#cats', view);

    cats.addEventListener('input', (ev) => {
      const t = ev.target, f = t.dataset.f;
      if (!f) return;
      const cat = findCat(t);
      if (!cat) return;
      if (t.dataset.entry) {
        const en = cat.entries.filter((x) => x.id === t.dataset.entry)[0];
        if (!en) return;
        en[f] = t.value;
        const row = t.closest('.entry');
        if (f === 'name') {
          const nm = t.value || 'this item';
          u.$('[data-f="score"]', row).setAttribute('aria-label', 'Score for ' + nm);
          u.$('[data-f="max"]', row).setAttribute('aria-label', 'Out of, for ' + nm);
          u.$('[data-act="del-entry"]', row).setAttribute('aria-label', 'Remove ' + nm);
        }
        if (f === 'score' || f === 'max') u.$('.entry-due', row).hidden = !E.isUpcoming(en);
        if (f === 'due' && t.value && en.remind === undefined) {
          en.remind = '1440';
          u.$('[data-f="remind"]', row).value = '1440';
        }
        if (f === 'due' || f === 'time') u.$('[data-due-label]', row).textContent = dueLabel(en);
      } else {
        cat[f] = t.value;
        if (f === 'name') t.closest('[data-cat-id]').setAttribute('aria-label', t.value || 'New category');
      }
      store.save();
      update();
    });
    // Celebrate when a score is committed (not on every keystroke, which would steal focus mid-typing).
    cats.addEventListener('change', (ev) => {
      const f = ev.target.dataset.f;
      if (f === 'score' || f === 'max') G.evaluateGoal(course, true);
    });

    cats.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-act]');
      if (!btn) return;
      const cat = findCat(btn);
      if (!cat) return;
      const act = btn.dataset.act;
      if (act === 'due') {
        const more = u.$('#' + btn.getAttribute('aria-controls'), view);
        more.hidden = !more.hidden;
        btn.setAttribute('aria-expanded', String(!more.hidden));
        if (!more.hidden) u.$('input', more).focus();
      } else if (act === 'add-entry') {
        const en = newEntry();
        cat.entries.push(en);
        store.save(); renderEditor(); update();
        const f = document.getElementById('en-' + en.id); if (f) f.focus();
      } else if (act === 'del-entry') {
        const snap = JSON.stringify(course.categories);
        const gone = cat.entries.filter((x) => x.id === btn.dataset.entry)[0];
        cat.entries = cat.entries.filter((x) => x.id !== btn.dataset.entry);
        store.save(); renderEditor(); update();
        ui.toast('Removed ' + ((gone && gone.name) || 'that item') + '.', { actionLabel: 'Undo', onAction: () => { course.categories = JSON.parse(snap); store.save(); renderEditor(); update(); } });
      } else if (act === 'del-cat') {
        const snap = JSON.stringify(course.categories);
        course.categories = course.categories.filter((x) => x.id !== cat.id);
        store.save(); renderEditor(); update();
        ui.toast('Removed ' + (cat.name || 'that category') + '.', { actionLabel: 'Undo', onAction: () => { course.categories = JSON.parse(snap); store.save(); renderEditor(); update(); } });
      }
    });
    u.$('#add-cat', view).addEventListener('click', () => {
      const cat = newCategory('', '');
      cat.entries.push(newEntry());
      course.categories.push(cat);
      store.save(); renderEditor(); update();
      const f = document.getElementById('cn-' + cat.id); if (f) f.focus();
    });

    // goal, chips, suggestion, slider
    const setGoal = (v, silent) => {
      course.target = String(v);
      u.$('#goal', view).value = String(v);
      renderChips(); store.save(); update();
      if (!silent) G.evaluateGoal(course, false);
    };
    u.$('#goal', view).addEventListener('input', (e) => { course.target = e.target.value; renderChips(); store.save(); update(); G.evaluateGoal(course, false); });
    u.$('#goal-chips', view).addEventListener('click', (e) => { const b = e.target.closest('[data-goal]'); if (b) setGoal(b.dataset.goal); });
    view.addEventListener('click', (e) => { const b = e.target.closest('[data-suggest]'); if (b) setGoal(b.dataset.suggest); });
    u.$('#wi', view).addEventListener('input', (e) => { ref.whatIf = Number(e.target.value); course.whatIf = ref.whatIf; store.save(); update(); });

    // name and settings
    u.$('#course-name', view).addEventListener('input', (e) => { course.name = e.target.value; u.$('#course-h1', view).textContent = e.target.value || 'Course'; store.save(); });
    u.$('#course-name', view).addEventListener('change', () => { LG.app.rerender(); });
    ['subject', 'level', 'credits', 'term'].forEach((k) => {
      u.$('#cs-' + k, view).addEventListener('change', (e) => {
        if (k === 'term') course.termId = e.target.value; else course[k] = e.target.value;
        store.save();
        if (k !== 'credits') LG.app.rerender();
      });
    });
    u.$('#del-course', view).addEventListener('click', async () => {
      const ok = await ui.confirm({ title: 'Delete ' + course.name + '?', body: 'Its categories and scores will be removed. You can undo right after.', confirmLabel: 'Delete course', danger: true });
      if (!ok) return;
      const idx = s.courses.indexOf(course);
      s.courses.splice(idx, 1);
      store.save();
      location.hash = '#/grades';
      ui.toast('Deleted ' + course.name + '.', { actionLabel: 'Undo', onAction: () => { s.courses.splice(idx, 0, course); store.save(); location.hash = '#/grades/' + course.id; } });
    });

    renderEditor(); renderChips(); update();
    G.evaluateGoal(course, false); // mark an already-reached goal quietly, so it only celebrates for new progress
  }

  G.render = (view, params) => {
    if (params && params[0]) renderCourse(view, params[0]);
    else renderList(view);
  };
  G.title = 'Grades';
})();
