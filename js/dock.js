/*
 * grademapper: the Tools panel (top-right) and the "tool in use" popup.
 *
 * - The Tools button sits in the top-right corner of every page. It opens a panel that floats above the
 *   page, so a tool can be used while the person moves between Home, Grades, Calendar and the rest.
 * - Timer, sounds, recording and reading aloud all keep running when the panel is closed or the page changes.
 * - While any of them is running, a small popup shows what is on and lets the person pause or stop it.
 */
(function () {
  'use strict';
  const LG = window.LG;
  const u = LG.u, tools = LG.tools;
  const T = tools.timer, N = tools.noise;

  const D = (LG.dock = { isOpen: false, toolId: null });
  let view = null;      // the tool screen currently inside the panel
  let lastFocus = null;

  const els = {};
  const $ = (id) => document.getElementById(id);

  function metaOf(id) { return tools.CARDS.filter((c) => c.id === id)[0]; }

  // ---------------------------------------------------------------- panel
  function showList() {
    leaveView();
    D.toolId = null;
    els.title.textContent = 'Tools';
    els.back.hidden = true;
    els.body.innerHTML = '<p class="muted panel-sub">They keep working while you use other pages.</p><div class="tool-list">' +
      tools.CARDS.map((c) => '<button type="button" class="tool-card" data-tool="' + c.id + '">' + u.icon(c.icon) + '<strong>' + c.name + '</strong><span>' + c.blurb + '</span></button>').join('') + '</div>';
  }
  function leaveView() {
    if (view && view.leave) { try { view.leave(); } catch (e) { /* ignore */ } }
    view = null;
  }
  function showTool(id) {
    const v = tools.views[id];
    if (!v) { showList(); return; }
    leaveView();
    D.toolId = id;
    const meta = metaOf(id);
    els.title.textContent = meta ? meta.name : v.title;
    els.back.hidden = false;
    els.body.innerHTML = '<div class="tool-body"></div>';
    view = v;
    v.render(els.body.firstChild, []);
    els.body.scrollTop = 0;
  }

  D.open = (id) => {
    if (!els.panel) return;
    if (!D.isOpen) lastFocus = document.activeElement;
    els.panel.hidden = false;
    D.isOpen = true;
    els.btn.setAttribute('aria-expanded', 'true');
    document.body.dataset.panel = 'open';
    if (id && tools.views[id]) showTool(id); else if (!id) { if (D.toolId) showTool(D.toolId); else showList(); } else showList();
    els.title.focus({ preventScroll: true });
    paintPopup();
  };
  D.close = (returnFocus) => {
    if (!els.panel || !D.isOpen) return;
    leaveView();
    D.toolId = null;
    els.panel.hidden = true;
    D.isOpen = false;
    els.btn.setAttribute('aria-expanded', 'false');
    delete document.body.dataset.panel;
    if (returnFocus !== false) { const t = lastFocus && document.contains(lastFocus) ? lastFocus : els.btn; try { t.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    paintPopup();
  };
  D.toggle = () => (D.isOpen ? D.close() : D.open());

  // ---------------------------------------------------------------- popup
  // One row per tool in use. The rows are rebuilt only when the set of tools in use (or their state) changes,
  // so the buttons do not flicker while the clock text ticks.
  let popSig = '';
  function active() {
    const list = [];
    const sw = T.isStopwatch();
    const timerUsed = T.running || (sw ? T.elapsed > 0 : T.left < T.total);
    if (timerUsed) list.push({ id: 'timer', icon: 'clock', running: T.running });
    if (N.type) list.push({ id: 'noise', icon: 'wave' });
    const S = tools.speech;
    if (S && S.listening()) list.push({ id: 'speech', icon: 'mic', kind: 'rec' });
    if (S && S.speaking()) list.push({ id: 'speech', icon: 'speaker', kind: 'read' });
    return list;
  }
  function textFor(a) {
    if (a.id === 'timer') return T.phaseLabel() + ' ' + T.label() + (T.running ? '' : ' (paused)');
    if (a.id === 'noise') return N.labelOf(N.type) + (N.source === 'loading' ? ' (loading)' : '') + (N.endAt ? ' until ' + new Date(N.endAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');
    if (a.kind === 'rec') return 'Recording a lecture';
    return 'Reading aloud';
  }
  function paintPopup() {
    if (!els.pop) return;
    const list = active();
    const sig = list.map((a) => a.id + (a.kind || '') + (a.running ? 'r' : '') + (a.id === 'noise' ? N.type : '')).join('|');
    els.btn.classList.toggle('in-use', list.length > 0);
    els.dot.hidden = list.length === 0;
    els.btn.setAttribute('aria-label', list.length ? 'Tools, ' + list.length + (list.length === 1 ? ' tool' : ' tools') + ' in use' : 'Tools');
    if (!list.length) { els.pop.hidden = true; els.pop.innerHTML = ''; popSig = ''; document.body.dataset.popup = 'off'; document.documentElement.style.setProperty('--popup-h', '0px'); return; }
    els.pop.hidden = false;
    document.body.dataset.popup = 'on';
    if (sig !== popSig) {
      popSig = sig;
      els.pop.innerHTML = list.map((a, i) => {
        const act = a.id === 'timer'
          ? '<button type="button" class="pop-btn" data-act="toggle" aria-label="' + (a.running ? 'Pause timer' : 'Resume timer') + '">' + u.icon(a.running ? 'pause' : 'play') + '</button>' +
            '<button type="button" class="pop-btn" data-act="reset" aria-label="Reset timer">' + u.icon('reset') + '</button>'
          : '<button type="button" class="pop-btn" data-act="stop" aria-label="Stop ' + (a.id === 'noise' ? 'sound' : a.kind === 'rec' ? 'recording' : 'reading') + '">' + u.icon('stop') + '</button>';
        return '<div class="pop-row" data-i="' + i + '" data-id="' + a.id + '" data-kind="' + (a.kind || '') + '"><button type="button" class="pop-main" data-act="open" aria-label="Open ' + (metaOf(a.id) ? metaOf(a.id).name : 'tool') + '">' + u.icon(a.icon) + '<span class="pop-text"></span></button>' + act + '</div>';
      }).join('');
    }
    u.$$('.pop-row', els.pop).forEach((row) => {
      const a = list[Number(row.dataset.i)];
      const span = u.$('.pop-text', row);
      const t = textFor(a);
      if (span.textContent !== t) span.textContent = t;
    });
    document.documentElement.style.setProperty('--popup-h', els.pop.offsetHeight + 'px');
  }
  function popClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const row = b.closest('.pop-row');
    const id = row.dataset.id, kind = row.dataset.kind, act = b.dataset.act;
    if (act === 'open') { D.open(id); return; }
    if (id === 'timer') { if (act === 'toggle') (T.running ? T.pause() : T.start()); else T.reset(); }
    else if (id === 'noise') N.stop();
    else if (kind === 'rec') tools.speech.stopRecording();
    else tools.speech.stopReading();
    paintPopup();
  }

  // ---------------------------------------------------------------- start-up
  D.init = () => {
    els.btn = $('tools-btn'); els.dot = $('tools-dot'); els.panel = $('tools-panel'); els.title = $('tools-title');
    els.back = $('tools-back'); els.close = $('tools-close'); els.body = $('tools-body'); els.pop = $('tool-popup');
    if (!els.btn || !els.panel) return;
    els.btn.innerHTML = u.icon('tools') + '<span>Tools</span><i id="tools-dot" class="in-use-dot" hidden></i>';
    els.dot = $('tools-dot');
    els.back.innerHTML = u.icon('back') + '<span class="sr-only">All tools</span>';
    els.close.innerHTML = u.icon('x') + '<span class="sr-only">Close tools</span>';
    els.btn.addEventListener('click', D.toggle);
    els.close.addEventListener('click', () => D.close());
    els.back.addEventListener('click', () => { showList(); els.title.focus({ preventScroll: true }); });
    els.body.addEventListener('click', (e) => { const c = e.target.closest('[data-tool]'); if (c) { showTool(c.dataset.tool); els.title.focus({ preventScroll: true }); } });
    els.pop.addEventListener('click', popClick);
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !D.isOpen || u.$('dialog[open]')) return;
      D.close();
    });
    // Any link to #/tools or #/tools/<id> (Home shortcuts, old bookmarks) opens the panel and leaves the page where it is.
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#/tools"], [data-open-tool]');
      if (!a) return;
      e.preventDefault();
      const id = a.dataset.openTool || (a.getAttribute('href') || '').replace(/^#\/tools\/?/, '');
      lastFocus = a;
      D.open(id || null);
    });
    T.on(paintPopup); N.on(paintPopup);
    if (tools.speech) tools.speech.on(paintPopup);
    paintPopup();
  };
})();
