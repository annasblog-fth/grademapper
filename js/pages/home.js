/* grademapper: home (a calm overview with a daily word from Pip). */
(function () {
  'use strict';
  const LG = window.LG;
  const u = LG.u, E = LG.E, ui = LG.ui, store = LG.store;
  const H = (LG.pages.home = {});

  const NUDGES = [
    'Small steps count. Ten minutes of review today is plenty.',
    'You do not have to be perfect. You just have to keep going.',
    'Grades show what you have done so far, not what you can do.',
    'A rested brain remembers more. Sleep counts as studying.',
    'Stuck on something? Asking for help is a study skill.',
    'Pick one thing to finish today. That is a win.',
    'A mistake on a test shows you exactly what to review next.',
    'Progress is not a straight line. Look at the trend, not one day.',
    'Big task? Break it into small ones and start with the easiest.',
    'You have handled hard weeks before. You can handle this one.',
    'Drink some water, then tackle one thing.',
    'Taking a break is part of studying. Come back with fresh eyes.',
    'Your effort matters more than any single number.',
    'Showing up today is already the hard part.',
  ];

  function greeting(name) {
    const h = new Date().getHours();
    const part = h < 5 ? 'Hello' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    return name ? part + ', ' + name : part;
  }
  function dayIndex() {
    const d = new Date();
    return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
  }

  function motivation(ctx) {
    const soon = ctx.upcoming.filter((e) => u.daysBetween(u.todayISO(), e.due) <= 2)[0];
    if (soon) {
      const when = u.relDay(soon.due).toLowerCase();
      return { mood: 'think', text: 'Your ' + soon.courseName + ' ' + (soon.name || 'item') + ' is ' + (when === 'today' || when === 'tomorrow' ? when : when) + '. A short, calm review today beats a long panic later.' };
    }
    if (ctx.hard.length) return { mood: 'calm', text: 'A couple of goals are a stretch right now, and that is okay. Pick the one test that matters most and start there.' };
    if (!ctx.courseCount) return { mood: 'cheer', text: 'Let\'s add your first course and see where you stand. It takes about a minute.' };
    return { mood: 'happy', text: NUDGES[dayIndex() % NUDGES.length] };
  }

  H.render = (view) => {
    const s = store.state;
    const p = s.profile;
    const scale = store.scale();
    const opts = store.gpaOpts();
    const term = store.currentTerm();
    const today = u.todayISO();
    const termCourses = s.courses.filter((c) => c.termId === term.id);
    const sum = E.cumulative(termCourses, scale, opts);
    const all = E.cumulative(s.courses, scale, opts);
    const allTime = s.archive.length ? E.cumulativeAll(s.courses, s.archive, scale, opts) : null;
    const events = E.collectEvents(s.courses, p.goal).filter((e) => !e.scored);
    const upcoming = events.filter((e) => e.due >= today);
    const pastDue = events.filter((e) => e.due < today);
    const hard = termCourses.filter((c) => {
      const t = E.num(c.target);
      if (t === null || !E.hasUpcoming(c)) return false;
      const tone = E.coach(c, t, scale).tone;
      return tone === 'stretch' || tone === 'reach';
    });
    const m = motivation({ upcoming, hard, courseCount: s.courses.length });
    const goal = E.num(p.goal);
    const band = sum.percent === null ? null : E.bandFor(sum.percent, scale);
    const hasPts = E.hasPoints(scale);
    const ptsLabel = scale.pointsLabel || 'Points';
    const sub = [p.grade, p.region === 'custom' ? 'your own scale' : scale.label].filter(Boolean).join(' · ');

    const summary = sum.percent === null
      ? '<p class="muted">Nothing graded in ' + u.esc(term.name) + ' yet. Your average shows up here as soon as you add a score.</p>'
      : '<div class="score-row"><p class="score">' + E.fmt(sum.percent) + '<span class="u">%</span></p><div class="chips">' +
        '<span class="chip"><small>Letter</small>' + u.esc(band.letter) + '</span>' +
        (hasPts && sum.points !== null ? '<span class="chip"><small>' + u.esc(ptsLabel) + '</small>' + sum.points.toFixed(2) + '</span>' : '') + '</div></div>' +
        '<div data-meter>' + ui.meterHTML() + '</div>' +
        (s.terms.length > 1 && all.percent !== null ? '<p class="muted">All terms together: <strong>' + E.fmt(all.percent) + '%</strong>' + (hasPts && all.points !== null ? ' &middot; cumulative ' + u.esc(ptsLabel) + ' <strong>' + all.points.toFixed(2) + '</strong>' : '') + '</p>' : '') +
        (s.archive.length && allTime.percent !== null ? '<p class="muted">With your archive: <strong>' + E.fmt(allTime.percent) + '%</strong>' + (hasPts && allTime.points !== null ? ' &middot; all-time ' + u.esc(ptsLabel) + ' <strong>' + allTime.points.toFixed(2) + '</strong>' : '') + ' <a href="#/archive">Open the archive</a></p>' : '') +
        (hasPts && scale.allowsBonus ? '<p class="hint">Showing ' + (s.prefs.weighted ? 'weighted' : 'unweighted') + ' ' + u.esc(ptsLabel) + '. Change it on the Grades page.</p>' : '');

    const heads = hard.length
      ? '<section class="card" aria-labelledby="hu-h"><h2 id="hu-h">A gentle heads-up</h2><p class="muted">No stress. These are the courses where a little planning helps most.</p><ul class="plain-list">' +
        hard.map((c) => { const co = E.coach(c, c.target, scale); return '<li><a class="row-link" href="#/grades/' + c.id + '"><span class="mini-tone" data-tone="' + co.tone + '">' + ui.toneIcon(co.tone) + ui.toneTag(co.tone) + '</span><span><strong>' + u.esc(c.name) + '</strong><span class="muted">' + u.esc(co.headline) + '</span></span>' + u.icon('chev') + '</a></li>'; }).join('') +
        '</ul></section>'
      : '';

    const next = upcoming.slice(0, 4);
    const comingUp = '<section class="card" aria-labelledby="up-h"><div class="row-between"><h2 id="up-h">Coming up</h2><a class="btn small" href="#/calendar">Calendar</a></div>' +
      (next.length
        ? '<ul class="plain-list">' + next.map((e) =>
            '<li><a class="row-link" href="#/calendar"><span class="date-badge" aria-hidden="true"><b>' + u.parseISO(e.due).getDate() + '</b>' + u.esc(u.parseISO(e.due).toLocaleDateString(undefined, { month: 'short' })) + '</span>' +
            '<span><strong>' + u.esc(e.name || 'Untitled') + '</strong><span class="muted">' + u.esc(e.courseName) + ' &middot; ' + u.esc(u.relDay(e.due)) + ' &middot; worth ' + E.fmt(e.worth) + '%' +
            (e.need.status === 'reachable' ? ' &middot; aim for about ' + E.fmt(e.need.needed) + '%' : '') + '</span></span>' + u.icon('chev') + '</a></li>').join('') + '</ul>'
        : '<p class="muted">Nothing on the calendar. When you add a due date to a test or assignment, it shows up here with what it is worth.</p>') +
      (pastDue.length ? '<p class="hint">' + pastDue.length + ' item' + (pastDue.length === 1 ? ' is' : 's are') + ' past the date and waiting for a score. <a href="#/calendar">Add them</a></p>' : '') + '</section>';

    const courseList = termCourses.length
      ? '<ul class="course-list">' + termCourses.map((c) => {
          const g = E.courseGrade(c).percent;
          const b = g === null ? null : E.bandFor(g, scale);
          return '<li><a class="course-card" href="#/grades/' + c.id + '"><span class="cc-main"><strong>' + u.esc(c.name) + '</strong><span class="muted">' + u.esc(c.subject) + '</span></span>' +
            '<span class="cc-grade">' + (g === null ? '<span class="muted">No marks</span>' : '<b>' + E.fmt(g) + '%</b><span>' + u.esc(b.letter) + '</span>') + '</span><span class="cc-go">' + u.icon('chev') + '</span></a></li>';
        }).join('') + '</ul>'
      : '<div class="empty"><p>No courses yet.</p><div class="stack"><a class="btn primary" href="#/grades" data-flag="addCourse">' + u.icon('plus') + ' Add my first course</a><a class="btn" href="#/grades" data-flag="example">Try an example</a></div></div>';

    view.innerHTML =
      '<h1 class="page-title">' + u.esc(greeting(p.name)) + '</h1>' + (sub ? '<p class="muted page-sub">' + u.esc(sub) + '</p>' : '') +
      ui.bubble(m.text, { mood: m.mood }) +
      '<section class="card" aria-labelledby="sum-h"><h2 id="sum-h">' + u.esc(term.name) + '</h2>' + summary + '</section>' +
      heads + comingUp +
      '<section aria-labelledby="co-h" class="stack"><div class="row-between"><h2 id="co-h">Courses</h2><a class="btn small" href="#/grades">All grades</a></div>' + courseList + '</section>' +
      '<section class="card" aria-labelledby="tl-h"><h2 id="tl-h">Handy things</h2><div class="shortcut-grid">' +
      '<a class="shortcut" href="#/tools/timer">' + u.icon('clock') + 'Focus timer</a>' +
      '<a class="shortcut" href="#/tools/notes">' + u.icon('note') + 'Notes</a>' +
      '<a class="shortcut" href="#/learn">' + u.icon('sparkle') + 'How grades work</a>' +
      '<a class="shortcut" href="#/archive">' + u.icon('archive') + 'Archive</a>' +
      '<a class="shortcut" href="#/activities">' + u.icon('activities') + 'Activities</a></div></section>';

    if (sum.percent !== null) ui.updateMeter(u.$('[data-meter] .meter', view), { cur: sum.percent, goal });
    u.$$('[data-flag]', view).forEach((a) => a.addEventListener('click', () => { LG.app.flag = a.dataset.flag; }));
    ui.enhance(view);
  };
  H.title = 'Home';
})();
