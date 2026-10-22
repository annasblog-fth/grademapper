/* grademapper: small helpers (DOM, dates, colours, icons, downloads). */
(function () {
  'use strict';
  const LG = (window.LG = window.LG || {});
  LG.pages = LG.pages || {};
  const u = (LG.u = {});

  // ------------------------------------------------------------------ DOM
  u.$ = (sel, root) => (root || document).querySelector(sel);
  u.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  u.esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  u.uid = (prefix) => (prefix || 'x') + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 7);
  u.debounce = (fn, ms) => {
    let t;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms);
    };
  };
  u.prefersReducedMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /** Save a text or Blob file. Works on the real site (not inside sandboxed previews). */
  u.download = (filename, content, mime) => {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  u.copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
  };

  // ---------------------------------------------------------------- dates
  // Dates are kept as local "YYYY-MM-DD" strings so time zones never shift a due date.
  const pad = (n) => String(n).padStart(2, '0');
  u.pad = pad;
  u.toISO = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  u.todayISO = () => u.toISO(new Date());
  u.parseISO = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  };
  u.addDays = (iso, n) => {
    const d = u.parseISO(iso);
    d.setDate(d.getDate() + n);
    return u.toISO(d);
  };
  u.daysBetween = (fromISO, toISO) => {
    const a = u.parseISO(fromISO), b = u.parseISO(toISO);
    if (!a || !b) return null;
    return Math.round((b - a) / 86400000);
  };
  u.fmtDate = (iso, opts) => {
    const d = u.parseISO(iso);
    return d ? d.toLocaleDateString(undefined, opts || { weekday: 'short', month: 'short', day: 'numeric' }) : '';
  };
  u.fmtTime = (hhmm) => {
    const m = /^(\d{2}):(\d{2})$/.exec(hhmm || '');
    if (!m) return '';
    const d = new Date(2000, 0, 1, Number(m[1]), Number(m[2]));
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };
  /** "Today", "Tomorrow", "In 5 days", "3 days ago" */
  u.relDay = (iso) => {
    const n = u.daysBetween(u.todayISO(), iso);
    if (n === null) return '';
    if (n === 0) return 'Today';
    if (n === 1) return 'Tomorrow';
    if (n === -1) return 'Yesterday';
    if (n > 1) return 'In ' + n + ' days';
    return Math.abs(n) + ' days ago';
  };
  /** Due moment as a Date, using 08:00 when no time is set. */
  u.dueDate = (iso, hhmm) => {
    const d = u.parseISO(iso);
    if (!d) return null;
    const m = /^(\d{2}):(\d{2})$/.exec(hhmm || '');
    d.setHours(m ? Number(m[1]) : 8, m ? Number(m[2]) : 0, 0, 0);
    return d;
  };

  // --------------------------------------------------------------- colours
  u.hexToRgb = (hex) => {
    let h = String(hex || '#000000').replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  u.rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  u.lum = (hex) => {
    const c = u.hexToRgb(hex).map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  u.contrast = (a, b) => {
    const la = u.lum(a), lb = u.lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };
  u.mix = (a, b, t) => {
    const A = u.hexToRgb(a), B = u.hexToRgb(b);
    return u.rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  };
  /** Nudge fg toward black or white until it reads on bg (default ratio 4.5). */
  u.ensureContrast = (fg, bg, min) => {
    min = min || 4.5;
    if (u.contrast(fg, bg) >= min) return fg;
    const target = u.lum(bg) > 0.4 ? '#000000' : '#ffffff';
    for (let t = 0.04; t <= 1.0001; t += 0.04) {
      const c = u.mix(fg, target, t);
      if (u.contrast(c, bg) >= min) return c;
    }
    return target;
  };
  u.inkOn = (bg, prefer) => {
    if (prefer && u.contrast(prefer, bg) >= 4.5) return prefer;
    return u.contrast('#000000', bg) >= u.contrast('#ffffff', bg) ? '#000000' : '#ffffff';
  };
  u.isValidHex = (s) => /^#[0-9a-f]{6}$/i.test(s || '');

  // ----------------------------------------------------------------- icons
  const ICON = {
    home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-6h4v6"/>',
    grades: '<path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3V4z"/><path d="M8 8h7M8 12h7"/>',
    activities: '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    tools: '<path d="M14.5 6.5a4 4 0 005 5L12 19l-4-4 6.5-8.5z"/><path d="M5 19l3-3"/>',
    me: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
    archive: '<path d="M4 7h16v4H4z"/><path d="M6 11v9h12v-9"/><path d="M10 15h4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    play: '<path d="M8 5v14l11-7z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
    reset: '<path d="M4 12a8 8 0 108-8"/><path d="M4 4v5h5"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
    speaker: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 010 6"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    chev: '<path d="M9 5l7 7-7 7"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    bell: '<path d="M6 17V11a6 6 0 0112 0v6l2 2H4l2-2z"/><path d="M10 21h4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    wave: '<path d="M3 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0"/>',
    count: '<path d="M5 6h14M5 12h14M5 18h8"/>',
    note: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7"/>',
    pencil: '<path d="M4 20l1-5L16 4l4 4L9 19l-5 1z"/><path d="M14 6l4 4"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/>',
    flag: '<path d="M6 21V4"/><path d="M6 5h11l-2 4 2 4H6"/>',
    trend: '<path d="M4 17l6-6 4 4 6-7"/><path d="M15 8h5v5"/>',
    mountain: '<path d="M3 19l6.5-11 4 6.5 2-3L21 19z"/>',
    circleCheck: '<circle cx="12" cy="12" r="10"/><path d="M7.5 12.5l3 3 6-7"/>',
    moon: '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  };
  u.icon = (name, cls) =>
    '<svg class="icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICON[name] || '') + '</svg>';

  // -------------------------------------------------------------------- ics
  /** A calendar file the phone's own calendar app can import, with reminders built in. */
  u.makeICS = (events) => {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//grademapper//EN', 'CALSCALE:GREGORIAN'];
    for (const e of events) {
      const d = u.parseISO(e.due);
      if (!d) continue;
      const ymd = e.due.replace(/-/g, '');
      lines.push('BEGIN:VEVENT', 'UID:' + e.id + '@grademapper', 'DTSTAMP:' + stamp);
      const t = /^(\d{2}):(\d{2})$/.exec(e.time || '');
      if (t) {
        const hhmm = t[1] + t[2] + '00';
        const endDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Number(t[1]) + 1, Number(t[2]));
        const endYmd = u.toISO(endDate).replace(/-/g, '');
        const endHm = u.pad(endDate.getHours()) + u.pad(endDate.getMinutes()) + '00';
        lines.push('DTSTART:' + ymd + 'T' + hhmm, 'DTEND:' + endYmd + 'T' + endHm);
      } else {
        lines.push('DTSTART;VALUE=DATE:' + ymd, 'DTEND;VALUE=DATE:' + u.addDays(e.due, 1).replace(/-/g, ''));
      }
      lines.push('SUMMARY:' + esc(e.courseName + ': ' + e.name));
      lines.push('DESCRIPTION:' + esc('Worth about ' + (Math.round(e.worth * 10) / 10) + '% of your grade.'));
      if (e.remind >= 0) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(e.name), 'TRIGGER:-PT' + Math.round(e.remind) + 'M', 'END:VALARM');
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  };
})();
