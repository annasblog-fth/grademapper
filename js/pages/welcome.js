/* Little Grades: welcome flow (Pip sets up your profile), "how grades work", and the theme picker. */
(function () {
  'use strict';
  const LG = window.LG;
  const u = LG.u, E = LG.E, ui = LG.ui, store = LG.store;

  const W = (LG.pages.welcome = {});
  const L = (LG.pages.learn = {});

  const GRADE_CHOICES = [
    'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
    'College or university, year 1', 'College or university, year 2', 'College or university, year 3', 'College or university, year 4+',
    'Something else',
  ];
  const REGIONS = [
    { id: 'us', title: 'US letters and GPA', ex: 'A, B+, and a 4.0 scale' },
    { id: 'bc', title: 'Canada (BC)', ex: 'Percent and letters like A, B, C+' },
    { id: 'uk', title: 'UK', ex: 'A* to U letters' },
    { id: 'ib', title: 'IB', ex: 'Grades from 1 to 7' },
    { id: 'custom', title: 'My own scale', ex: 'You set the letters and cut-offs in Settings' },
  ];

  // ---------------------------------------------------------- theme picker
  /** Cards for each theme. Used here and in Settings. */
  ui.themePicker = (root, onChange) => {
    const app = store.appearance;
    LG.theme.THEMES.forEach((t) => { LG.theme.loadFont(t.display); });
    const dark = LG.theme.palette(app).isDark;
    root.innerHTML = LG.theme.THEMES.map((t) => {
      const c = LG.theme.previewColors(t.id, dark);
      const f = LG.theme.fontById(t.display);
      return '<button type="button" class="theme-card" data-theme="' + t.id + '" aria-pressed="' + (app.theme === t.id && !app.custom.on) + '">' +
        '<span class="tc-prev" style="background:' + c.bg + ';color:' + c.text + ';font-family:' + f.css + '">' +
        '<span class="tc-aa">Aa</span><i style="background:' + c.accent + '"></i><i class="b" style="background:' + c.text + '"></i></span>' +
        '<span class="tc-name">' + u.esc(t.name) + '</span><span class="tc-blurb">' + u.esc(t.blurb) + '</span></button>';
    }).join('');
    root.onclick = (e) => {
      const b = e.target.closest('[data-theme]');
      if (!b) return;
      store.setAppearance({ theme: b.dataset.theme, custom: { on: false } });
      ui.themePicker(root, onChange);
      if (onChange) onChange();
    };
  };

  // -------------------------------------------------------- how grades work
  const HOW = {
    converter: () => {
      const scale = store.scale();
      return '<div class="inline-tool"><div class="field"><label class="lbl" for="lc-pct">Try a percent</label><input class="in num" id="lc-pct" inputmode="decimal" value="88"></div>' +
        '<p class="lc-out" id="lc-out" aria-live="polite"></p></div><p class="hint">Showing the ' + u.esc(scale.label) + ' scale. Change it in Settings if your school is different.' + (scale.note ? ' ' + u.esc(scale.note) : '') + '</p>';
    },
  };
  function learnHTML() {
    return '<div class="learn">' +
      '<details class="card" open><summary><h3>Percent, letter and GPA</h3></summary>' +
      '<p>A grade starts as a <strong>percent</strong>: points you earned divided by points possible. Your school turns that percent into a <strong>letter</strong>, and some turn the letter into <strong>GPA points</strong> (an A is 4.0 on the common US scale).</p>' + HOW.converter() + '</details>' +

      '<details class="card"><summary><h3>Weighted averages</h3></summary>' +
      '<p>Not everything counts the same. A final exam might be worth 30% of your grade and homework only 10%. To find your grade, multiply each category\'s average by its weight, then add them up. Change the numbers to see how it moves.</p>' +
      '<div class="wa-table" role="group" aria-label="Weighted average example">' +
      [['Tests', 50, 80], ['Homework', 20, 100], ['Projects', 30, 70]].map((r, i) =>
        '<div class="wa-row"><span>' + r[0] + '</span><label class="sr-only" for="wa-w' + i + '">' + r[0] + ' weight percent</label><input class="in num" id="wa-w' + i + '" inputmode="decimal" value="' + r[1] + '"><span aria-hidden="true">% worth</span>' +
        '<label class="sr-only" for="wa-a' + i + '">' + r[0] + ' average percent</label><input class="in num" id="wa-a' + i + '" inputmode="decimal" value="' + r[2] + '"><span aria-hidden="true">% average</span></div>').join('') +
      '</div><p class="wa-out" id="wa-out" aria-live="polite"></p></details>' +

      '<details class="card"><summary><h3>Weighted and unweighted GPA</h3></summary>' +
      '<p><strong>Unweighted</strong> GPA treats every class the same, so the top is 4.0. <strong>Weighted</strong> GPA gives bonus points for harder classes like honors, AP or IB, so a 4.5 or even a 5.0 is possible at some schools. Colleges often recalculate GPA their own way, so use yours as a guide.</p></details>' +

      '<details class="card"><summary><h3>What do I need on my next test?</h3></summary>' +
      '<p>This is the question the app answers for you. Say you want 85%, you have 80% on the first 70% of the course, and the final is worth 30%. The score you need on the final is the one that pulls the weighted total up to 85%.</p>' +
      '<p class="wa-out" id="need-demo"></p><p class="hint">Add a course and set a goal, and Little Grades does this for every upcoming test, even with several categories and drop-lowest rules.</p></details></div>';
  }
  function bindLearn(root) {
    const scale = store.scale();
    const out = u.$('#lc-out', root);
    const pct = u.$('#lc-pct', root);
    const calc = () => {
      const p = E.num(pct.value);
      if (p === null) { out.textContent = 'Type a percent to see its letter.'; return; }
      const b = E.bandFor(p, scale);
      const pts = E.pointsFor(p, scale, {});
      out.textContent = E.fmt(p) + '% is a ' + b.letter + (pts !== null ? ', worth ' + pts.toFixed(1) + ' ' + (scale.pointsLabel || 'points') : '') + '.';
    };
    pct.addEventListener('input', calc); calc();
    const wa = () => {
      const course = { categories: [0, 1, 2].map((i) => ({ id: 'w' + i, name: 'c' + i, weight: u.$('#wa-w' + i, root).value, dropLowest: 0, entries: [{ id: 'e' + i, name: 'x', score: u.$('#wa-a' + i, root).value, max: '100' }] })) };
      const g = E.courseGrade(course);
      const total = E.totalWeight(course);
      u.$('#wa-out', root).textContent = g.percent === null ? 'Fill in the numbers to see your grade.' :
        'Your grade: ' + E.fmt(g.percent) + '%' + (Math.abs(total - 100) > 0.05 ? ' (the weights add up to ' + E.fmt(total) + '%, so I scaled them to match)' : '') + '.';
    };
    u.$$('.wa-table input', root).forEach((i) => i.addEventListener('input', wa)); wa();
    const demo = E.neededScore({ categories: [
      { id: 'a', name: 'Coursework', weight: 70, dropLowest: 0, entries: [{ id: 'a1', name: 'All', score: 80, max: 100 }] },
      { id: 'b', name: 'Final', weight: 30, dropLowest: 0, entries: [{ id: 'b1', name: 'Final', score: '', max: 100 }] },
    ] }, 85);
    u.$('#need-demo', root).textContent = 'Example: you need ' + E.fmt(demo.needed) + '% on the final.';
  }
  L.render = (view) => {
    view.innerHTML = '<h1 class="page-title">How grades work</h1>' +
      ui.bubble('Grades can feel like a secret code. Here it is in plain words, with numbers you can play with.', { mood: 'think' }) + learnHTML() +
      '<p><a class="btn" href="#/home">Back to home</a></p>';
    bindLearn(view);
    ui.enhance(view);
  };
  L.title = 'How grades work';

  // ------------------------------------------------------------- the flow
  let step = 0;
  const STEPS = ['hello', 'grade', 'scale', 'goals', 'needs', 'learn', 'look', 'done'];

  function finish() {
    store.state.profile.onboarded = true;
    store.save();
  }

  function stepBody(name, p) {
    const nm = p.name ? p.name : 'friend';
    switch (name) {
      case 'hello':
        return { say: 'Hi, I\'m Pip! I\'ll help you keep track of your grades and plan what comes next. First, what should I call you?', mood: 'cheer',
          html: '<div class="field"><label class="lbl" for="w-name">Your name or nickname</label><input class="in" id="w-name" value="' + u.esc(p.name) + '" autocomplete="given-name" placeholder="e.g. Sam"></div>' +
            '<p class="hint">This stays on your device. There are no accounts here.</p>' };
      case 'grade':
        return { say: 'Nice to meet you, ' + nm + '! What grade or year are you in right now?', mood: 'happy',
          html: '<fieldset class="choice-grid"><legend class="lbl">Grade or year</legend>' + GRADE_CHOICES.map((g, i) =>
            '<label class="choice"><input type="radio" name="w-grade" value="' + u.esc(g) + '"' + (p.grade === g ? ' checked' : '') + '><span>' + u.esc(g) + '</span></label>').join('') + '</fieldset>' };
      case 'scale':
        return { say: 'Schools give out grades in different ways. Which one is closest to yours?', mood: 'think',
          html: '<fieldset class="choice-list"><legend class="lbl">Grading style</legend>' + REGIONS.map((r) =>
            '<label class="choice wide"><input type="radio" name="w-region" value="' + r.id + '"' + (p.region === r.id ? ' checked' : '') + '><span><strong>' + u.esc(r.title) + '</strong><small>' + u.esc(r.ex) + '</small></span></label>').join('') + '</fieldset>' +
            '<p class="hint">You can change this any time, and edit the exact cut-offs in Settings.</p>' };
      case 'goals':
        return { say: 'Goals make things less foggy. What average would feel great this year? If you have colleges in mind, add them too. Both are optional.', mood: 'happy',
          html: '<div class="field narrow"><label class="lbl" for="w-goal">My goal average %</label><input class="in num" id="w-goal" inputmode="decimal" value="' + u.esc(p.goal) + '" placeholder="85"></div>' +
            '<h3 class="sub">Colleges or programs I like</h3><div id="w-colleges">' + collegeRows(p) + '</div>' +
            '<button type="button" class="btn" id="w-add-college">' + u.icon('plus') + ' Add a college</button>' };
      case 'needs': {
        const scale = store.scale();
        const rows = [];
        const g = E.num(p.goal);
        if (g !== null) rows.push(['My goal', g]);
        p.colleges.forEach((c) => { const a = E.num(c.avg); if (a !== null) rows.push([c.name || 'A college', a]); });
        const say = rows.length
          ? 'Here is what those numbers mean on your scale. A good habit: aim a couple of points above the line, so one bad day does not matter.'
          : 'No numbers yet, and that is fine. You can set a goal for each course later, and I will work out what you need on every test.';
        return { say, mood: 'think',
          html: rows.length ? '<table class="plain"><thead><tr><th>Target</th><th>Average</th><th>Letter</th>' + (E.hasPoints(scale) ? '<th>' + u.esc(scale.pointsLabel || 'Points') + '</th>' : '') + '</tr></thead><tbody>' +
            rows.map((r) => { const b = E.bandFor(r[1], scale); return '<tr><td>' + u.esc(r[0]) + '</td><td>' + E.fmt(r[1]) + '%</td><td>' + u.esc(b.letter) + '</td>' + (E.hasPoints(scale) ? '<td>' + (b.points != null ? b.points.toFixed(1) : '') + '</td>' : '') + '</tr>'; }).join('') +
            '</tbody></table>' : '<p class="muted">Tap Next to keep going.</p>' };
      }
      case 'learn':
        return { say: 'Quick tour: how grades actually work. Open a card and try the numbers. You can find this again any time.', mood: 'happy', html: learnHTML() };
      case 'look':
        return { say: 'Last thing, ' + nm + ': pick a look you like. Colours, fonts and shapes can all change later.', mood: 'cheer',
          html: '<div class="theme-grid" id="w-themes"></div>' +
            '<fieldset class="seg-wrap"><legend class="lbl">Light or dark</legend><div class="seg" id="w-mode">' +
            [['auto', 'Match my phone'], ['light', 'Light'], ['dark', 'Dark']].map((m) => '<button type="button" data-v="' + m[0] + '" aria-pressed="' + (store.appearance.mode === m[0]) + '">' + m[1] + '</button>').join('') + '</div>' +
            '<p class="hint">Academic and Neon are dark themes, so this switch does nothing for them.</p></fieldset>' };
      default:
        return { say: 'You\'re all set, ' + nm + '! Add a course and I\'ll show you where you stand. Remember: grades show what you have done so far, not what you can do.', mood: 'cheer',
          html: '<div class="stack"><button type="button" class="btn primary" id="w-first">' + u.icon('plus') + ' Add my first course</button>' +
            '<button type="button" class="btn" id="w-example">Try an example course first</button>' +
            '<a class="btn quiet" href="#/home" id="w-home">Go to home</a></div>' };
    }
  }
  function collegeRows(p) {
    if (!p.colleges.length) return '<p class="muted" id="w-nocol">No colleges yet. That is okay.</p>';
    return p.colleges.map((c) =>
      '<div class="college-row" data-col="' + c.id + '"><div class="field"><label class="lbl" for="cl-n-' + c.id + '">College or program</label><input class="in" id="cl-n-' + c.id + '" data-f="name" value="' + u.esc(c.name) + '" autocomplete="off"></div>' +
      '<div class="field"><label class="lbl" for="cl-a-' + c.id + '">Usually wants %</label><input class="in num" id="cl-a-' + c.id + '" data-f="avg" inputmode="decimal" value="' + u.esc(c.avg) + '" placeholder="85"></div>' +
      '<button type="button" class="icon-btn" data-del="' + c.id + '" aria-label="Remove ' + u.esc(c.name || 'this college') + '">' + u.icon('x') + '</button></div>').join('');
  }

  W.render = (view) => {
    const p = store.state.profile;
    const name = STEPS[step];
    const body = stepBody(name, p);
    const last = name === 'done';
    if (last) finish();
    view.innerHTML =
      '<section class="wizard" aria-labelledby="wiz-h">' +
      '<h1 class="sr-only" id="wiz-h">Set up your profile</h1>' +
      '<div class="wiz-top"><p class="step-count">Step ' + (step + 1) + ' of ' + STEPS.length + '</p>' +
      (last ? '' : '<button type="button" class="btn quiet small" id="w-skip">Skip setup</button>') + '</div>' +
      '<div class="dots" aria-hidden="true">' + STEPS.map((s, i) => '<i class="' + (i < step ? 'done' : i === step ? 'now' : '') + '"></i>').join('') + '</div>' +
      ui.bubble(body.say, { mood: body.mood, cls: 'big' }) +
      '<div class="card wiz-card">' + body.html + '</div>' +
      '<div class="wiz-actions">' + (step > 0 ? '<button type="button" class="btn" id="w-back">' + u.icon('back') + ' Back</button>' : '<span></span>') +
      (last ? '' : '<button type="button" class="btn primary" id="w-next">' + (step === STEPS.length - 2 ? 'Finish' : 'Next') + ' ' + u.icon('chev') + '</button>') + '</div></section>';
    ui.enhance(view);

    const go = (n) => { step = Math.max(0, Math.min(STEPS.length - 1, n)); LG.app.rerender(true); };
    const el = (id) => u.$('#' + id, view);
    if (el('w-next')) el('w-next').addEventListener('click', () => go(step + 1));
    if (el('w-back')) el('w-back').addEventListener('click', () => go(step - 1));
    if (el('w-skip')) el('w-skip').addEventListener('click', () => { finish(); location.hash = '#/home'; });

    if (name === 'hello') {
      el('w-name').addEventListener('input', (e) => { p.name = e.target.value.trim(); store.save(); });
      el('w-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(step + 1); });
    }
    if (name === 'grade') u.$$('input[name="w-grade"]', view).forEach((r) => r.addEventListener('change', () => { p.grade = r.value; store.save(); }));
    if (name === 'scale') u.$$('input[name="w-region"]', view).forEach((r) => r.addEventListener('change', () => { p.region = r.value; store.save(); }));
    if (name === 'goals') {
      el('w-goal').addEventListener('input', (e) => { p.goal = e.target.value; store.save(); });
      const box = el('w-colleges');
      box.addEventListener('input', (e) => {
        const row = e.target.closest('[data-col]'); if (!row) return;
        const c = p.colleges.filter((x) => x.id === row.dataset.col)[0];
        if (c) { c[e.target.dataset.f] = e.target.value; store.save(); }
      });
      box.addEventListener('click', (e) => {
        const b = e.target.closest('[data-del]'); if (!b) return;
        p.colleges = p.colleges.filter((x) => x.id !== b.dataset.del); store.save(); box.innerHTML = collegeRows(p);
      });
      el('w-add-college').addEventListener('click', () => {
        const c = { id: u.uid('col'), name: '', avg: '', reqs: [] };
        p.colleges.push(c); store.save(); box.innerHTML = collegeRows(p);
        const f = document.getElementById('cl-n-' + c.id); if (f) f.focus();
      });
    }
    if (name === 'learn') bindLearn(view);
    if (name === 'look') {
      const grid = el('w-themes');
      ui.themePicker(grid, () => {});
      el('w-mode').addEventListener('click', (e) => {
        const b = e.target.closest('[data-v]'); if (!b) return;
        store.setAppearance({ mode: b.dataset.v });
        u.$$('#w-mode button', view).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        ui.themePicker(grid, () => {});
      });
    }
    if (name === 'done') {
      el('w-first').addEventListener('click', () => { LG.app.flag = 'addCourse'; location.hash = '#/grades'; });
      el('w-example').addEventListener('click', () => { LG.app.flag = 'example'; location.hash = '#/grades'; });
      el('w-home').addEventListener('click', () => { step = 0; });
    }
  };
  W.restart = () => { step = 0; };
  W.title = 'Welcome';
})();
