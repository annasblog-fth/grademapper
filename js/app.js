/* grademapper: app shell (router, navigation, lock screen, reminders, printing, start-up). */
(function () {
  'use strict';
  const LG = window.LG;
  const u = LG.u, E = LG.E, ui = LG.ui, store = LG.store;

  const NAV = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'grades', label: 'Grades', icon: 'grades' },
    { id: 'activities', label: 'Activities', icon: 'activities' },
    { id: 'calendar', label: 'Calendar', icon: 'calendar' },
    { id: 'settings', label: 'Settings', icon: 'me' },
  ];
  const ROUTES = {
    home: () => LG.pages.home, grades: () => LG.pages.grades, activities: () => LG.pages.activities,
    calendar: () => LG.pages.calendar, settings: () => LG.pages.settings,
    learn: () => LG.pages.learn, welcome: () => LG.pages.welcome, archive: () => LG.pages.archive,
  };
  const NAV_FOR = { learn: 'home', welcome: 'home', archive: 'grades' };
  const NAME = 'grademapper';

  const app = (LG.app = { flag: null, current: null, name: NAME, version: '2.0.0' });
  let lastHash = null;      // the last page shown, so opening Tools never moves the person off their page
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

  // Where the cursor was, so it can be put back after the page redraws (keyboard and screen-reader users).
  function focusSpot(root, which) {
    const el = which || document.activeElement;
    if (!el || el === document.body || el === root || !root.contains(el)) return null;
    if (el.id) return { id: el.id };
    const path = [];
    for (let n = el; n && n !== root; n = n.parentElement) path.unshift(Array.prototype.indexOf.call(n.parentElement.children, n));
    return { path, tag: el.tagName };
  }
  // The thing the person just pressed, and where it was on screen. After the page redraws, the page is nudged so that
  // thing sits at the same spot (a theme change can make the content above it taller or shorter).
  let anchor = null;
  document.addEventListener('click', (e) => {
    const el = e.target && e.target.closest ? e.target.closest('button, a, input, select, label, summary') : null;
    const view = u.$('#view');
    anchor = el && view && view.contains(el) ? { spot: focusSpot(view, el), top: el.getBoundingClientRect().top, at: Date.now() } : null;
  }, true);
  function findSpot(root, spot) {
    let el = null;
    if (spot.id) el = document.getElementById(spot.id);
    else { el = root; for (let i = 0; i < spot.path.length && el; i++) el = el.children[spot.path[i]]; if (el && el.tagName !== spot.tag) el = null; }
    return el && root.contains(el) ? el : null;
  }
  function restoreFocus(root, spot) {
    if (!spot) return;
    const el = findSpot(root, spot);
    if (el && root.contains(el) && typeof el.focus === 'function') { try { el.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }

  /**
   * mode: 'nav' = the person went to a page (start at the top),
   *       'keep' = the same page was redrawn after a change (stay exactly where they were scrolled),
   *       'top' = the same page, but start again from the top (the welcome steps).
   */
  function render(mode) {
    if (store.locked) { showLock(); return; }
    let { name, params } = parseHash();
    if (!name) name = store.state.profile.onboarded ? 'home' : 'welcome';
    if (name === 'tools') {
      // Tools is a panel in the top-right corner now. Old links and bookmarks still work: open the panel, stay put.
      const back = lastHash || '#/home';
      try { history.replaceState(null, '', location.pathname + location.search + back); } catch (e) { location.hash = back; }
      if (app.current) { LG.dock.open(params[0] || null); return; }
      render('nav'); LG.dock.open(params[0] || null); return;
    }
    if (!ROUTES[name]) name = 'home';
    lastHash = '#/' + [name].concat(params).join('/');
    const page = ROUTES[name]();
    // Read the scroll position BEFORE the page is replaced. (Reading it afterwards gives 0 and sends the person to the top.)
    const y = window.scrollY;
    const oldView = u.$('#view');
    const routeKey = name + '/' + params.join('/');
    const same = oldView.dataset.route === routeKey;
    const keep = mode === 'keep' || (same && mode !== 'top' && mode !== 'nav');
    const spot = keep ? focusSpot(oldView) : null;
    // A fresh element each time, so event listeners from the previous page never pile up.
    const view = oldView.cloneNode(false);
    oldView.replaceWith(view);

    if (currentPage && currentPage.leave) currentPage.leave();
    currentPage = page;
    app.current = name;
    document.body.dataset.page = name;
    u.$('#shell').hidden = false;
    u.$('#lock').hidden = true;
    view.innerHTML = '';
    view.dataset.route = routeKey;
    if (keep) view.dataset.still = '1'; else delete view.dataset.still;   // a redraw after a change should not replay the entrance animation
    try {
      page.render(view, params);
    } catch (err) {
      console.error(err);
      view.innerHTML = '<div class="empty"><p>Something went wrong showing this page.</p><p class="muted">Your data is safe. Try going home.</p><a class="btn primary" href="#/home">Go home</a></div>';
    }
    setNav(name);
    document.title = (page.title ? page.title + ' · ' : '') + NAME;
    const h1 = u.$('h1', view);
    ui.enhance(view);
    if (keep) {
      window.scrollTo(0, y);
      restoreFocus(view, spot);
      if (anchor && anchor.spot && Date.now() - anchor.at < 2500) {
        const el = findSpot(view, anchor.spot);
        if (el) { const d = el.getBoundingClientRect().top - anchor.top; if (Math.abs(d) > 1) window.scrollBy(0, d); }
      }
    } else {
      window.scrollTo(0, 0);
      if (!same && h1 && !u.$('dialog[open]')) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
    }
  }
  // rerender() keeps the scroll position. rerender(false) starts from the top again.
  app.rerender = (keepScroll) => render(keepScroll === false ? 'top' : 'keep');

  window.addEventListener('hashchange', () => render('nav'));

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
      try { await store.unlock(input.value); render('nav'); startReminders(); }
      catch (ex) { err.textContent = 'That passphrase did not work. Try again.'; input.select(); }
    });
    u.$('#lock-wipe', box).addEventListener('click', async () => {
      const ok = await ui.confirm({ title: 'Delete everything?', body: 'This erases the locked data from this device for good.', confirmLabel: 'Delete everything', danger: true });
      if (!ok) return;
      store.wipe(); LG.pages.welcome.restart(); location.hash = '#/welcome'; render('nav'); startReminders();
    });
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
        try { if ('Notification' in window && Notification.permission === 'granted') new Notification(NAME, { body: msg, icon: 'icons/icon-192.png' }); } catch (err) { /* ignore */ }
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
    LG.dock.init();
    if (!r.locked) {
      const s = store.state;
      if (!s.prefs.termId) s.prefs.termId = s.terms[s.terms.length - 1].id;
      startReminders();
    }
    render('nav');
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* offline mode is a bonus, not a must */ });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
