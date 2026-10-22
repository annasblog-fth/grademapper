/* grademapper: calendar (upcoming tests, what they are worth, what to aim for, reminders). */
(function () {
  'use strict';
  const LG = window.LG;
  const u = LG.u, E = LG.E, ui = LG.ui, store = LG.store;
  const C = (LG.pages.calendar = {});

  let mode = 'list';
  let cursor = u.todayISO().slice(0, 7);
  let selected = u.todayISO();

  const aimText = (need) => {
    if (!need) return '';
    if (need.status === 'reachable') return 'Aim for about ' + E.fmt(need.needed) + '%';
    if (need.status === 'secured') return 'Your goal is already covered';
    if (need.status === 'out-of-reach') return 'Best possible: ' + E.fmt(need.bestCase) + '%';
    return '';
  };

  function eventItem(e) {
    const d = u.parseISO(e.due);
    const aim = e.scored ? '' : aimText(e.need);
    return '<li class="event' + (e.scored ? ' done' : '') + '" data-ev="' + e.id + '" data-course="' + e.courseId + '">' +
      '<span class="date-badge" aria-hidden="true"><b>' + d.getDate() + '</b>' + u.esc(d.toLocaleDateString(undefined, { month: 'short' })) + '</span>' +
      '<div class="ev-main"><strong>' + u.esc(e.name || 'Untitled') + '</strong>' +
      '<span class="muted">' + u.esc(e.courseName) + (e.category ? ' &middot; ' + u.esc(e.category) : '') + '</span>' +
      '<span class="muted">' + u.esc(u.relDay(e.due)) + (e.time ? ' &middot; ' + u.esc(u.fmtTime(e.time)) : '') + ' &middot; worth ' + E.fmt(e.worth) + '%' + (e.remind >= 0 && !e.scored ? ' &middot; ' + u.icon('bell', 'inline') + 'reminder set' : '') + '</span>' +
      (aim ? '<span class="aim">' + u.icon('flag', 'inline') + u.esc(aim) + '</span>' : '') +
      (e.scored ? '<span class="aim">' + u.icon('check', 'inline') + 'Scored</span>' : '') + '</div>' +
      '<div class="ev-btns">' + (e.scored ? '' : '<button type="button" class="btn small" data-act="score">Add score</button>') +
      '<button type="button" class="icon-btn" data-act="edit" aria-label="Edit ' + u.esc(e.name || 'item') + '">' + u.icon('edit') + '</button></div></li>';
  }

  function listView(events) {
    const today = u.todayISO();
    const weekEnd = u.addDays(today, 7);
    const pending = events.filter((e) => !e.scored);
    const groups = [
      { title: 'Past the date, waiting for a score', hint: 'No rush. Add the score when you have it and your grade updates.', items: pending.filter((e) => e.due < today) },
      { title: 'This week', items: pending.filter((e) => e.due >= today && e.due <= weekEnd) },
      { title: 'Later', items: pending.filter((e) => e.due > weekEnd) },
    ].filter((g) => g.items.length);
    const done = events.filter((e) => e.scored).slice(-8).reverse();
    let html = groups.map((g) => '<section class="group" aria-label="' + u.esc(g.title) + '"><h3 class="group-h">' + u.esc(g.title) + '</h3>' + (g.hint ? '<p class="muted">' + u.esc(g.hint) + '</p>' : '') + '<ul class="plain-list">' + g.items.map(eventItem).join('') + '</ul></section>').join('');
    if (!pending.length) {
      html = '<div class="empty"><p>Nothing coming up.</p><p class="muted">Add a test or assignment with a due date, and it will show here with what it is worth and what to aim for.</p></div>';
    }
    if (done.length) html += '<details class="card"><summary><h3>Recently scored</h3></summary><ul class="plain-list">' + done.map(eventItem).join('') + '</ul></details>';
    return html;
  }

  function monthView(events) {
    const [y, m] = cursor.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const start = new Date(y, m - 1, 1 - first.getDay());
    const today = u.todayISO();
    const byDay = {};
    events.forEach((e) => { (byDay[e.due] = byDay[e.due] || []).push(e); });
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const iso = u.toISO(d);
      const items = byDay[iso] || [];
      const pend = items.filter((e) => !e.scored).length;
      const out = d.getMonth() !== m - 1;
      cells += '<button type="button" class="day' + (out ? ' out' : '') + (iso === today ? ' today' : '') + (pend ? ' has' : '') + '" data-day="' + iso + '" aria-pressed="' + (iso === selected) + '" aria-label="' +
        u.esc(d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })) + (items.length ? ', ' + items.length + ' item' + (items.length === 1 ? '' : 's') : '') + '">' +
        '<span>' + d.getDate() + '</span>' + (items.length ? '<i class="count" aria-hidden="true">' + items.length + '</i>' : '') + '</button>';
    }
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayItems = (byDay[selected] || []);
    return '<div class="month"><div class="month-head"><button type="button" class="icon-btn" data-act="prev" aria-label="Previous month">' + u.icon('back') + '</button>' +
      '<h3 aria-live="polite">' + u.esc(first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })) + '</h3>' +
      '<button type="button" class="icon-btn" data-act="next" aria-label="Next month">' + u.icon('chev') + '</button></div>' +
      '<div class="weekdays" aria-hidden="true">' + names.map((n) => '<span>' + n + '</span>').join('') + '</div>' +
      '<div class="days">' + cells + '</div></div>' +
      '<section class="group" aria-label="Selected day"><h3 class="group-h">' + u.esc(u.fmtDate(selected, { weekday: 'long', month: 'long', day: 'numeric' })) + '</h3>' +
      (dayItems.length ? '<ul class="plain-list">' + dayItems.map(eventItem).join('') + '</ul>' : '<p class="muted">Nothing on this day.</p>') + '</section>';
  }

  // -------------------------------------------------------------- dialogs
  async function eventDialog(existing) {
    const s = store.state;
    if (!existing && !s.courses.length) {
      await ui.modal({ title: 'Add a course first', html: '<p>Tests and assignments belong to a course, so grademapper can work out what they are worth. Add a course on the Grades page, then come back.</p>', actions: [{ label: 'OK', kind: 'primary', value: true }] });
      return;
    }
    let course, cat, entry;
    if (existing) {
      course = store.course(existing.courseId);
      course.categories.forEach((k) => k.entries.forEach((en) => { if (en.id === existing.id) { cat = k; entry = en; } }));
    }
    const courseOpts = s.courses.map((c) => ({ value: c.id, label: c.name }));
    const en = entry || { name: '', due: u.addDays(u.todayISO(), 7), time: '', remind: '1440' };
    const html =
      '<div class="form-grid">' +
      (existing ? '<p class="muted span2">' + u.esc(course.name) + ' &middot; ' + u.esc(cat.name) + '</p>' :
        '<div class="field span2"><label class="lbl" for="ev-course">Course</label><select class="in" id="ev-course">' + ui.options(courseOpts, courseOpts[0].value) + '</select></div>' +
        '<div class="field span2"><label class="lbl" for="ev-cat">Category</label><select class="in" id="ev-cat"></select></div>') +
      '<div class="field span2"><label class="lbl" for="ev-name">Name</label><input class="in" id="ev-name" value="' + u.esc(en.name) + '" placeholder="e.g. Unit 4 test" autocomplete="off"></div>' +
      '<div class="field"><label class="lbl" for="ev-due">Due date</label><input class="in" type="date" id="ev-due" value="' + u.esc(en.due || '') + '"></div>' +
      '<div class="field"><label class="lbl" for="ev-time">Time (optional)</label><input class="in" type="time" id="ev-time" value="' + u.esc(en.time || '') + '"></div>' +
      '<div class="field span2"><label class="lbl" for="ev-remind">Remind me</label><select class="in" id="ev-remind">' + ui.options(LG.consts.REMIND, en.remind == null ? '' : en.remind) + '</select></div></div>' +
      '<p class="hint" id="ev-hint"></p>';
    let saved = null, removeDate = false;
    const actions = [{ label: 'Cancel', kind: 'ghost', value: false }];
    if (existing) actions.push({ label: 'Remove from calendar', kind: 'ghost', value: true, onClick: () => { removeDate = true; } });
    actions.push({ label: existing ? 'Save' : 'Add', kind: 'primary', value: true, onClick: (d) => {
      const v = (id) => u.$('#' + id, d).value;
      if (!v('ev-name').trim()) { u.$('#ev-name', d).focus(); return false; }
      if (!v('ev-due')) { u.$('#ev-due', d).focus(); return false; }
      saved = { name: v('ev-name').trim(), due: v('ev-due'), time: v('ev-time'), remind: v('ev-remind'), courseId: existing ? null : v('ev-course'), catId: existing ? null : v('ev-cat') };
    } });
    const ok = await ui.modal({
      title: existing ? 'Edit ' + (existing.name || 'item') : 'Add a test or assignment', html, actions,
      onOpen: (d) => {
        if (!existing) {
          const fill = () => {
            const c = store.course(u.$('#ev-course', d).value);
            const sel = u.$('#ev-cat', d);
            sel.innerHTML = c.categories.length ? ui.options(c.categories.map((k) => ({ value: k.id, label: k.name || 'Untitled category' })), c.categories[0].id) : '<option value="">(no categories yet)</option>';
            u.$('#ev-hint', d).textContent = c.categories.length ? 'This adds an upcoming item to ' + c.name + ', so your grade can plan around it.' : 'This course has no categories yet. Add some on its page first.';
          };
          u.$('#ev-course', d).addEventListener('change', fill); fill();
        }
        u.$('#ev-name', d).focus();
      },
    });
    if (!ok) return;
    if (existing) {
      if (removeDate) { entry.due = ''; entry.time = ''; entry.remind = ''; }
      else if (saved) { entry.name = saved.name; entry.due = saved.due; entry.time = saved.time; entry.remind = saved.remind; }
    } else if (saved) {
      const c = store.course(saved.courseId);
      const k = c && c.categories.filter((x) => x.id === saved.catId)[0];
      if (!k) { ui.toast('Pick a category first. Add one on the course page if it has none.'); return; }
      k.entries.push({ id: u.uid('e'), name: saved.name, score: '', max: '100', due: saved.due, time: saved.time, remind: saved.remind });
      cursor = saved.due.slice(0, 7); selected = saved.due;
    }
    store.save(); LG.app.rerender();
  }

  async function scoreDialog(ev) {
    const course = store.course(ev.courseId);
    let entry;
    course.categories.forEach((k) => k.entries.forEach((en) => { if (en.id === ev.id) entry = en; }));
    let out = null;
    const ok = await ui.modal({
      title: 'Score for ' + (ev.name || 'this item'),
      html: '<div class="form-grid"><div class="field"><label class="lbl" for="sc-score">Score</label><input class="in num" id="sc-score" inputmode="decimal"></div>' +
        '<div class="field"><label class="lbl" for="sc-max">Out of</label><input class="in num" id="sc-max" inputmode="decimal" value="' + u.esc(entry.max || '100') + '"></div></div>',
      actions: [{ label: 'Cancel', kind: 'ghost', value: false }, { label: 'Save score', kind: 'primary', value: true, onClick: (d) => {
        const sc = E.num(u.$('#sc-score', d).value);
        if (sc === null) { u.$('#sc-score', d).focus(); return false; }
        out = { score: String(sc), max: u.$('#sc-max', d).value.trim() || '100' };
      } }],
    });
    if (!ok || !out) return;
    entry.score = out.score; entry.max = out.max;
    store.save();
    const celebrated = LG.pages.grades.evaluateGoal(course, true);
    LG.app.rerender();
    if (!celebrated) ui.toast('Saved. Your ' + course.name + ' grade is now ' + E.fmt(E.courseGrade(course).percent) + '%.');
  }

  // ---------------------------------------------------------------- page
  C.render = (view) => {
    const s = store.state;
    const events = E.collectEvents(s.courses, s.profile.goal);
    const supports = 'Notification' in window;
    const perm = supports ? Notification.permission : 'unsupported';
    const on = !!s.prefs.remindersOn;

    view.innerHTML =
      '<h1 class="page-title">Calendar</h1>' +
      '<div class="row-between wrap"><button type="button" class="btn primary" data-act="add">' + u.icon('plus') + ' Add a test or assignment</button>' +
      '<div class="seg" id="mode-seg" role="group" aria-label="Calendar view"><button type="button" data-v="list" aria-pressed="' + (mode === 'list') + '">' + u.icon('list') + ' List</button><button type="button" data-v="month" aria-pressed="' + (mode === 'month') + '">' + u.icon('grid') + ' Month</button></div></div>' +
      '<section class="card remind" aria-labelledby="rm-h"><h2 id="rm-h">Reminders</h2>' +
      (on ? '<p>' + u.icon('bell', 'inline') + 'Reminders are on. ' + (perm === 'granted' ? 'You will get a notification while grademapper is open.' : perm === 'denied' ? 'Notifications are blocked in your browser, so reminders show inside the app.' : 'Reminders show inside the app.') + '</p>' : '<p class="muted">Get a nudge before a test, with what to aim for.</p>') +
      '<div class="row-wrap">' + (on ? '<button type="button" class="btn" data-act="remind-off">Turn reminders off</button>' : '<button type="button" class="btn primary" data-act="remind-on">' + u.icon('bell') + ' Turn on reminders</button>') +
      '<button type="button" class="btn" data-act="ics">' + u.icon('download') + ' Add to my phone calendar</button></div>' +
      '<p class="hint">A website can only remind you while it is open. For reminders when it is closed, download the calendar file and open it on your phone. Your phone\'s own calendar app will then do the reminding.</p></section>' +
      (mode === 'list' ? listView(events) : monthView(events));
    ui.enhance(view);

    u.$('#mode-seg', view).addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { mode = b.dataset.v; LG.app.rerender(); } });
    view.addEventListener('click', async (e) => {
      const day = e.target.closest('[data-day]');
      if (day) { selected = day.dataset.day; cursor = selected.slice(0, 7); LG.app.rerender(); return; }
      const b = e.target.closest('[data-act]'); if (!b) return;
      const act = b.dataset.act;
      const row = b.closest('[data-ev]');
      const ev = row && events.filter((x) => x.id === row.dataset.ev)[0];
      if (act === 'add') eventDialog(null);
      else if (act === 'edit' && ev) eventDialog(ev);
      else if (act === 'score' && ev) scoreDialog(ev);
      else if (act === 'prev' || act === 'next') {
        const [y, m] = cursor.split('-').map(Number);
        const d = new Date(y, m - 1 + (act === 'next' ? 1 : -1), 1);
        cursor = d.getFullYear() + '-' + u.pad(d.getMonth() + 1); LG.app.rerender();
      } else if (act === 'remind-on') {
        s.prefs.remindersOn = true; store.save();
        if ('Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (err) { /* ignore */ } }
        LG.app.rerender(); ui.toast('Reminders are on.');
      } else if (act === 'remind-off') { s.prefs.remindersOn = false; store.save(); LG.app.rerender(); }
      else if (act === 'ics') {
        const list = events.filter((x) => !x.scored && x.due >= u.todayISO());
        if (!list.length) { ui.toast('Nothing upcoming to export yet.'); return; }
        u.download('grademapper-calendar.ics', u.makeICS(list), 'text/calendar;charset=utf-8');
        ui.toast('Calendar file saved. Open it on your phone to add the dates and reminders.');
      }
    });
  };
  C.title = 'Calendar';
})();
