/* Little Grades: app shell (router, navigation, lock screen, reminders, printing, start-up). */
(function () {
  'use strict';
  const LG = window.LG;
  const u = LG.u, E = LG.E, ui = LG.ui, store = LG.store;

  const NAV = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'grades', label: 'Grades', icon: 'grades' },
    { id: 'activities', label: 'Activities', icon: 'activities' },
    { id: 'calendar', label: 'Calendar', icon: 'calendar' },
    { id: 'tools', label: 'Tools', icon: 'tools' },
    { id: 'settings', label: 'Settings', icon: 'me' },
  ];
  const ROUTES = {
    home: () => LG.pages.home, grades: () => LG.pages.grades, activities: () => LG.pages.activities,
    calendar: () => LG.pages.calendar, tools: () => LG.pages.tools, settings: () => LG.pages.settings,
    learn: () => LG.pages.learn, welcome: () => LG.pages.welcome,
  };
  const NAV_FOR = { learn: 'home', welcome: 'home' };

  const app = (LG.app = { flag: null, current: null });
  let currentPage = null;

  function parseHash() {
    const parts = (location.hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
    return { name: parts[0] || '', params: parts.slice(1) };
  }

  // -------------------------------------------------------------- shell
  function buildShell() {
    u.$('#nav').innerHTML = NAV.map((n) => '<a class="nav-item" href="#/' + n.id + '" data-nav="' + n.id + '">' + u.icon(n.icon) + '<span>' + n.label + '</span></a>').join('');
  }
  function setNav(name) {
    const active = NAV_FOR[name] || name;
    u.$$('#nav .nav-item').forEach((a) => {
      const on = a.dataset.nav === active;
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  function render(keepScroll) {
    if (store.locked) { showLock(); return; }
    let { name, params } = parseHash();
    if (!name) name = store.state.profile.onboarded ? 'home' : 'welcome';
    if (!ROUTES[name]) name = 'home';
    const page = ROUTES[name]();
    // A fresh element each time, so event listeners from the previous page never pile up.
    const oldView = u.$('#view');
    const view = oldView.cloneNode(false);
    oldView.replaceWith(view);
    const y = window.scrollY;

    if (currentPage && currentPage.leave) currentPage.leave();
    currentPage = page;
    app.current = name;
    document.body.dataset.page = name;
    u.$('#shell').hidden = false;
    u.$('#lock').hidden = true;
    const fresh = view.dataset.route !== name + '/' + params.join('/');
    view.innerHTML = '';
    view.dataset.route = name + '/' + params.join('/');
    try {
      page.render(view, params);
    } catch (err) {
      console.error(err);
      view.innerHTML = '<div class="empty"><p>Something went wrong showing this page.</p><p class="muted">Your data is safe. Try going home.</p><a class="btn primary" href="#/home">Go home</a></div>';
    }
    setNav(name);
    document.title = (page.title ? page.title + ' · ' : '') + 'Little Grades';
    const h1 = u.$('h1', view);
    if (keepScroll) window.scrollTo(0, y);
    else {
      window.scrollTo(0, 0);
      if (fresh && h1 && !u.$('dialog[open]')) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
    }
    ui.enhance(view);
    paintTimerPill();
  }
  app.rerender = (keepScroll) => render(!!keepScroll);

  window.addEventListener('hashchange', () => render(false));

  // ---------------------------------------------------------- lock screen
  function showLock() {
    u.$('#shell').hidden = true;
    const box = u.$('#lock');
    box.hidden = false;
    box.innerHTML =
      '<div class="lock-card">' + ui.bubble('Welcome back! Your grades are locked. Type your passphrase to open them.', { mood: 'calm' }) +
      '<form id="lock-form" class="card"><div class="field"><label class="lbl" for="lock-pass">Passphrase</label><input class="in" type="password" id="lock-pass" autocomplete="current-password"></div>' +
      '<p class="hint" id="lock-err" role="alert"></p><div class="row-wrap"><button type="submit" class="btn primary">' + u.icon('lock') + ' Unlock</button></div></form>' +
      '<details class="card"><summary>Forgot it?</summary><p>There is no way to reset a passphrase, because that is what keeps your grades private. If you have a backup file, you can start fresh and restore it.</p>' +
      '<button type="button" class="btn danger" id="lock-wipe">Delete everything and start over</button></details></div>';
    ui.enhance(box);
    const input = u.$('#lock-pass', box);
    input.focus();
    u.$('#lock-form', box).addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = u.$('#lock-err', box);
      err.textContent = 'Checking...';
      try { await store.unlock(input.value); render(false); startReminders(); }
      catch (ex) { err.textContent = 'That passphrase did not work. Try again.'; input.select(); }
    });
    u.$('#lock-wipe', box).addEventListener('click', async () => {
      const ok = await ui.confirm({ title: 'Delete everything?', body: 'This erases the locked data from this device for good.', confirmLabel: 'Delete everything', danger: true });
      if (!ok) return;
      store.wipe(); LG.pages.welcome.restart(); location.hash = '#/welcome'; render(false); startReminders();
    });
  }

  // -------------------------------------------------------- timer pill
  function paintTimerPill() {
    const pill = u.$('#timer-pill');
    const T = LG.tools && LG.tools.timer;
    if (!pill || !T) return;
    const show = T.running && !(app.current === 'tools' && parseHash().params[0] === 'timer');
    pill.hidden = !show;
    if (show) pill.innerHTML = u.icon('clock') + '<span>' + u.esc(T.phaseLabel()) + ' ' + u.esc(T.label()) + '</span>';
  }

  // ------------------------------------------------------------ reminders
  let remTimer = null;
  function checkReminders() {
    if (store.locked || !store.state.prefs.remindersOn) return;
    const now = Date.now();
    const events = E.collectEvents(store.state.courses, store.state.profile.goal).filter((e) => !e.scored && e.remind >= 0);
    let changed = false;
    events.forEach((e) => {
      const due = u.dueDate(e.due, e.time);
      if (!due) return;
      const at = due.getTime() - e.remind * 60000;
      const key = e.id + '|' + e.due + '|' + e.remind;
      if (now >= at && now < at + 6 * 3600000 && !store.state.reminded[key]) {
        store.state.reminded[key] = now; changed = true;
        const aim = e.need.status === 'reachable' ? ' Aim for about ' + E.fmt(e.need.needed) + '%.' : '';
        const msg = e.courseName + ': ' + (e.name || 'item') + ' ' + u.relDay(e.due).toLowerCase() + ', worth ' + E.fmt(e.worth) + '%.' + aim;
        ui.toast(msg, { ms: 15000 });
        try { if ('Notification' in window && Notification.permission === 'granted') new Notification('Little Grades', { body: msg, icon: 'icons/icon-192.png' }); } catch (err) { /* ignore */ }
      }
    });
    if (changed) {
      const keep = {}; const cutoff = now - 30 * 86400000;
      Object.keys(store.state.reminded).forEach((k) => { if (store.state.reminded[k] > cutoff) keep[k] = store.state.reminded[k]; });
      store.state.reminded = keep; store.save();
    }
  }
  function startReminders() {
    clearInterval(remTimer);
    checkReminders();
    remTimer = setInterval(checkReminders, 30000);
  }

  // ------------------------------------------------------------- printing
  app.printSummary = () => {
    const s = store.state, scale = store.scale(), opts = store.gpaOpts();
    const rows = s.terms.map((t) => {
      const mine = s.courses.filter((c) => c.termId === t.id);
      if (!mine.length) return '';
      const sum = E.cumulative(mine, scale, opts);
      return '<h2>' + u.esc(t.name) + (sum.percent !== null ? ' &mdash; ' + E.fmt(sum.percent) + '%' : '') + '</h2><table><thead><tr><th>Course</th><th>Level</th><th>Credits</th><th>Grade</th><th>Letter</th></tr></thead><tbody>' +
        mine.map((c) => { const g = E.courseGrade(c).percent; return '<tr><td>' + u.esc(c.name) + '</td><td>' + u.esc(c.level) + '</td><td>' + E.fmt(E.creditsOf(c)) + '</td><td>' + (g === null ? '' : E.fmt(g) + '%') + '</td><td>' + (g === null ? '' : u.esc(E.bandFor(g, scale).letter)) + '</td></tr>'; }).join('') + '</tbody></table>';
    }).join('');
    const all = E.cumulative(s.courses, scale, opts);
    const acts = s.activities.length ? '<h2>Activities</h2><table><thead><tr><th>Activity</th><th>Type</th><th>Role</th><th>Hours</th></tr></thead><tbody>' +
      s.activities.map((a) => '<tr><td>' + u.esc(a.name) + '</td><td>' + u.esc(a.type) + '</td><td>' + u.esc(a.role) + '</td><td>' + u.esc(a.totalHours) + '</td></tr>').join('') + '</tbody></table>' : '';
    const host = document.createElement('div');
    host.id = 'print-root';
    host.innerHTML = '<h1>' + u.esc(s.profile.name ? s.profile.name + '\'s grades' : 'My grades') + '</h1><p>' + u.esc(scale.label) + ' &middot; printed ' + u.esc(u.fmtDate(u.todayISO(), { year: 'numeric', month: 'long', day: 'numeric' })) + '</p>' +
      (all.percent !== null ? '<p><strong>Overall: ' + E.fmt(all.percent) + '%</strong>' + (all.points !== null ? ' &middot; ' + u.esc(scale.pointsLabel || 'Points') + ' ' + all.points.toFixed(2) : '') + '</p>' : '') + rows + acts;
    document.body.appendChild(host);
    document.body.classList.add('printing');
    const done = () => { host.remove(); document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    try { window.print(); } catch (e) { done(); ui.toast('Printing is not available here.'); }
    setTimeout(() => { if (document.body.classList.contains('printing')) done(); }, 60000);
  };

  // --------------------------------------------------------------- start-up
  function boot() {
    store.loadAppearance();
    LG.theme.apply(store.appearance);
    // Load every font in the background so the font picker previews are right.
    setTimeout(() => LG.theme.loadAllFonts(), 1500);
    buildShell();
    const r = store.load();
    store.on((what) => {
      if (what === 'save-error') ui.toast('Could not save. Your browser storage may be full or blocked. Download a backup to be safe.', { ms: 12000 });
      if (what === 'wiped' || what === 'imported') startReminders();
    });
    LG.tools.timer.on(paintTimerPill);
    u.$('#timer-pill').addEventListener('click', () => { location.hash = '#/tools/timer'; });
    if (!r.locked) {
      const s = store.state;
      if (!s.prefs.termId) s.prefs.termId = s.terms[s.terms.length - 1].id;
      startReminders();
    }
    render(false);
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* offline mode is a bonus, not a must */ });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
