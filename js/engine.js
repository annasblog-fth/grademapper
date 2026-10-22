/*
 * grademapper: calculation engine
 *
 * Pure functions only. No screens, no storage, no browser code.
 * The same file runs in Node (for the tests) and in the page.
 *
 * Data shape:
 *   course   = { id, name, subject, level, credits, target, termId, categories: [category] }
 *   category = { id, name, weight, dropLowest, entries: [entry] }
 *   entry    = { id, name, score, max, due, time, remind }
 *
 * An entry with a blank score is "upcoming" (not graded yet).
 * Weights are plain numbers and can be decimals (2.5 means 2.5%).
 * Inside a category every entry counts equally, as a percent of its own max.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GradeEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const EPS = 1e-9;

  /** Turn "12", "12.5", "12,5" or 12 into a number. Blank or junk becomes null. */
  function num(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v !== 'string') return null;
    const s = v.trim().replace(',', '.');
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  /** Round to one decimal place (the +1e-7 keeps 89.95 from becoming 89.9). */
  function round1(x) {
    return Math.round(x * 10 + 1e-7) / 10;
  }

  /** 87 -> "87", 87.44 -> "87.4" */
  function fmt(x) {
    return round1(x).toFixed(1).replace(/\.0$/, '');
  }

  // ---------------------------------------------------------------- scales

  const DEFAULT_BONUS = { regular: 0, honors: 0.5, ap: 1, ib: 1 };

  const SCALES = {
    us: {
      id: 'us',
      label: 'US letter and 4.0 GPA',
      pointsLabel: 'GPA',
      allowsBonus: true,
      bands: [
        { min: 93, letter: 'A', points: 4.0 },
        { min: 90, letter: 'A-', points: 3.7 },
        { min: 87, letter: 'B+', points: 3.3 },
        { min: 83, letter: 'B', points: 3.0 },
        { min: 80, letter: 'B-', points: 2.7 },
        { min: 77, letter: 'C+', points: 2.3 },
        { min: 73, letter: 'C', points: 2.0 },
        { min: 70, letter: 'C-', points: 1.7 },
        { min: 67, letter: 'D+', points: 1.3 },
        { min: 63, letter: 'D', points: 1.0 },
        { min: 60, letter: 'D-', points: 0.7 },
        { min: 0, letter: 'F', points: 0 },
      ],
    },
    // BC secondary school scale. Schools can differ, so the app should say so.
    bc: {
      id: 'bc',
      label: 'Canada (BC percent and letter)',
      pointsLabel: '',
      bands: [
        { min: 86, letter: 'A' },
        { min: 73, letter: 'B' },
        { min: 67, letter: 'C+' },
        { min: 60, letter: 'C' },
        { min: 50, letter: 'C-' },
        { min: 0, letter: 'F' },
      ],
    },
    uk: {
      id: 'uk',
      label: 'UK (A* to U letters)',
      pointsLabel: '',
      note: 'Approximate. Real UK boundaries change by exam board and year.',
      bands: [
        { min: 90, letter: 'A*' },
        { min: 80, letter: 'A' },
        { min: 70, letter: 'B' },
        { min: 60, letter: 'C' },
        { min: 50, letter: 'D' },
        { min: 40, letter: 'E' },
        { min: 0, letter: 'U' },
      ],
    },
    ib: {
      id: 'ib',
      label: 'IB (1 to 7)',
      pointsLabel: 'IB grade',
      note: 'Approximate. Real IB boundaries change by subject and exam session.',
      bands: [
        { min: 80, letter: '7', points: 7 },
        { min: 70, letter: '6', points: 6 },
        { min: 60, letter: '5', points: 5 },
        { min: 50, letter: '4', points: 4 },
        { min: 40, letter: '3', points: 3 },
        { min: 30, letter: '2', points: 2 },
        { min: 0, letter: '1', points: 1 },
      ],
    },
  };

  // More scales, by country (added in version 2). The four above keep their ids and numbers exactly as before.
  // These are common school or national cut-offs and are marked approximate: schools and exam boards differ.
  const APPROX = 'Approximate. Schools and exam boards differ, so check yours and use a custom scale if it is different.';
  const mk = (id, label, bands, extra) => { SCALES[id] = Object.assign({ id, label, pointsLabel: '', note: APPROX, bands: bands.map((b) => Object.assign({ min: b[0], letter: b[1] }, b[2] != null ? { points: b[2] } : {})) }, extra || {}); };
  mk('us-plain', 'US letters without plus or minus (4.0 GPA)', [[90, 'A', 4], [80, 'B', 3], [70, 'C', 2], [60, 'D', 1], [0, 'F', 0]], { pointsLabel: 'GPA', allowsBonus: true });
  mk('ca-letter', 'Canada (letters with a 4.0 GPA)', [[90, 'A+', 4], [85, 'A', 4], [80, 'A-', 3.7], [77, 'B+', 3.3], [73, 'B', 3], [70, 'B-', 2.7], [67, 'C+', 2.3], [63, 'C', 2], [60, 'C-', 1.7], [57, 'D+', 1.3], [53, 'D', 1], [50, 'D-', 0.7], [0, 'F', 0]], { pointsLabel: 'GPA' });
  mk('ca-on', 'Canada (Ontario levels 1 to 4)', [[80, 'Level 4'], [70, 'Level 3'], [60, 'Level 2'], [50, 'Level 1'], [0, 'Below 50']]);
  mk('uk-gcse', 'UK (GCSE 9 to 1)', [[85, '9', 9], [77, '8', 8], [69, '7', 7], [60, '6', 6], [52, '5', 5], [44, '4', 4], [35, '3', 3], [25, '2', 2], [15, '1', 1], [0, 'U', 0]], { pointsLabel: 'Grade' });
  mk('uk-degree', 'UK (university degree classes)', [[70, 'First'], [60, '2:1'], [50, '2:2'], [40, 'Third'], [0, 'Fail']]);
  mk('ie', 'Ireland (Leaving Cert, Higher level)', [[90, 'H1', 100], [80, 'H2', 88], [70, 'H3', 77], [60, 'H4', 66], [50, 'H5', 56], [40, 'H6', 46], [30, 'H7', 37], [0, 'H8', 0]], { pointsLabel: 'CAO points' });
  mk('au', 'Australia (university grades, 7-point GPA)', [[85, 'HD', 7], [75, 'D', 6], [65, 'C', 5], [50, 'P', 4], [0, 'N', 0]], { pointsLabel: 'GPA' });
  mk('in-cbse', 'India (CBSE grades, 10-point)', [[91, 'A1', 10], [81, 'A2', 9], [71, 'B1', 8], [61, 'B2', 7], [51, 'C1', 6], [41, 'C2', 5], [33, 'D', 4], [0, 'E', 0]], { pointsLabel: 'Grade points' });
  mk('sg', 'Singapore (O-Level A1 to F9)', [[75, 'A1'], [70, 'A2'], [65, 'B3'], [60, 'B4'], [55, 'C5'], [50, 'C6'], [45, 'D7'], [40, 'E8'], [0, 'F9']]);
  mk('za', 'South Africa (achievement levels 1 to 7)', [[80, '7', 7], [70, '6', 6], [60, '5', 5], [50, '4', 4], [40, '3', 3], [30, '2', 2], [0, '1', 1]], { pointsLabel: 'Level' });
  mk('ng', 'Nigeria (WAEC A1 to F9)', [[75, 'A1'], [70, 'B2'], [65, 'B3'], [60, 'C4'], [55, 'C5'], [50, 'C6'], [45, 'D7'], [40, 'E8'], [0, 'F9']]);
  mk('de', 'Germany (grades 1 to 6)', [[92, '1'], [81, '2'], [67, '3'], [50, '4'], [30, '5'], [0, '6']]);
  mk('fr', 'France (mentions, from a mark out of 20)', [[80, 'Tres bien'], [70, 'Bien'], [60, 'Assez bien'], [50, 'Passable'], [0, 'Insuffisant']]);
  mk('es', 'Spain (0 to 10 words)', [[90, 'Sobresaliente'], [70, 'Notable'], [60, 'Bien'], [50, 'Suficiente'], [0, 'Insuficiente']]);
  mk('cn', 'China (four levels)', [[90, 'Excellent'], [80, 'Good'], [70, 'Medium'], [60, 'Pass'], [0, 'Fail']]);
  mk('jp', 'Japan (S to F, 4-point)', [[90, 'S', 4], [80, 'A', 3], [70, 'B', 2], [60, 'C', 1], [0, 'F', 0]], { pointsLabel: 'GPA' });
  mk('kr', 'South Korea (A+ to F, 4.5 GPA)', [[95, 'A+', 4.5], [90, 'A0', 4], [85, 'B+', 3.5], [80, 'B0', 3], [75, 'C+', 2.5], [70, 'C0', 2], [65, 'D+', 1.5], [60, 'D0', 1], [0, 'F', 0]], { pointsLabel: 'GPA' });

  // Countries: pick a country first, then one of its scales. Every scale is listed under exactly one country.
  const COUNTRIES = [
    { id: 'us', name: 'United States', scales: ['us', 'us-plain'] },
    { id: 'ca', name: 'Canada', scales: ['bc', 'ca-letter', 'ca-on'] },
    { id: 'uk', name: 'United Kingdom', scales: ['uk', 'uk-gcse', 'uk-degree'] },
    { id: 'ie', name: 'Ireland', scales: ['ie'] },
    { id: 'au', name: 'Australia', scales: ['au'] },
    { id: 'in', name: 'India', scales: ['in-cbse'] },
    { id: 'sg', name: 'Singapore', scales: ['sg'] },
    { id: 'za', name: 'South Africa', scales: ['za'] },
    { id: 'ng', name: 'Nigeria', scales: ['ng'] },
    { id: 'de', name: 'Germany', scales: ['de'] },
    { id: 'fr', name: 'France', scales: ['fr'] },
    { id: 'es', name: 'Spain', scales: ['es'] },
    { id: 'cn', name: 'China', scales: ['cn'] },
    { id: 'jp', name: 'Japan', scales: ['jp'] },
    { id: 'kr', name: 'South Korea', scales: ['kr'] },
    { id: 'intl', name: 'International schools (IB)', scales: ['ib'] },
    { id: 'other', name: 'Somewhere else, or my own scale', scales: ['custom'] },
  ];
  const countryById = (id) => COUNTRIES.filter((c) => c.id === id)[0] || null;
  /** The country a scale id belongs to ('other' for custom and for anything unknown). */
  function countryOfScale(scaleId) {
    for (const c of COUNTRIES) if (c.scales.indexOf(scaleId) >= 0) return c;
    return countryById('other');
  }
  /** Scales to offer for a country, as { id, label, note }. 'custom' is described by the person's own settings. */
  function scalesOfCountry(countryId) {
    const c = countryById(countryId);
    if (!c) return [];
    return c.scales.map((id) => (id === 'custom' ? { id, label: 'My own scale (set it up in Settings)', note: '' } : { id, label: SCALES[id].label, note: SCALES[id].note || '' }));
  }

  /** Clean up a list of custom bands: numbers only, sorted high to low, always ends at 0. */
  function normalizeBands(bands) {
    const out = [];
    for (const b of bands || []) {
      const min = num(b.min);
      const letter = String(b.letter == null ? '' : b.letter).trim();
      if (min === null || letter === '') continue;
      const band = { min: Math.max(0, min), letter };
      const pts = num(b.points);
      if (pts !== null) band.points = pts;
      out.push(band);
    }
    out.sort((a, b) => b.min - a.min);
    if (out.length === 0) return SCALES.us.bands.slice();
    if (out[out.length - 1].min > 0) out.push({ min: 0, letter: 'F', ...(out.some((b) => b.points != null) ? { points: 0 } : {}) });
    return out;
  }

  /** A scale by id. 'custom' is built from the person's own bands. */
  function getScale(id, custom) {
    if (id === 'custom') {
      const c = custom || {};
      const bands = normalizeBands(c.bands);
      return {
        id: 'custom',
        label: c.label || 'Custom',
        pointsLabel: c.pointsLabel || 'Points',
        allowsBonus: !!c.bonus,
        bands,
      };
    }
    return SCALES[id] || SCALES.us;
  }

  function hasPoints(scale) {
    return scale.bands.some((b) => b.points != null);
  }

  /** The band (letter, points, min) a percent falls in. Uses the one-decimal value you see on screen. */
  function bandFor(percent, scale) {
    const p = round1(percent);
    for (const b of scale.bands) if (p >= b.min - EPS) return b;
    return scale.bands[scale.bands.length - 1];
  }

  /** GPA-style points for a percent. Weighted adds the course-level bonus (honors, AP, IB). */
  function pointsFor(percent, scale, opts) {
    if (percent === null || percent === undefined) return null;
    const b = bandFor(percent, scale);
    if (b.points == null) return null;
    let p = b.points;
    const o = opts || {};
    if (o.weighted && scale.allowsBonus && p > 0) {
      const bonus = Object.assign({}, DEFAULT_BONUS, o.bonus || {});
      p += num(bonus[o.level || 'regular']) || 0;
    }
    return p;
  }

  // ------------------------------------------------------------ averaging

  /** Percent for one entry, or null when it has no score yet (or an unusable max). */
  function entryPercent(e) {
    const s = num(e.score);
    if (s === null) return null;
    let m = num(e.max);
    if (m === null) m = 100;
    if (m <= 0) return null;
    return (s / m) * 100;
  }

  function isUpcoming(e) {
    return num(e.score) === null;
  }

  /** Average a list of percents after dropping the lowest few. Always keeps at least one. */
  function averageOf(percents, dropLowest) {
    if (percents.length === 0) return { average: null, used: 0, dropped: 0 };
    const want = Math.max(0, Math.floor(num(dropLowest) || 0));
    const dropped = Math.min(want, percents.length - 1);
    const kept = percents.slice().sort((a, b) => a - b).slice(dropped);
    const sum = kept.reduce((t, p) => t + p, 0);
    return { average: sum / kept.length, used: kept.length, dropped };
  }

  /**
   * Percents for a category. If `hypothetical` is a number, every upcoming entry
   * counts as that score, so drop-lowest treats them like real marks.
   */
  function categoryPercents(cat, hypothetical) {
    const out = [];
    for (const e of cat.entries || []) {
      const p = entryPercent(e);
      if (p !== null) out.push(p);
      else if (hypothetical !== undefined && hypothetical !== null && isUpcoming(e)) out.push(hypothetical);
    }
    return out;
  }

  function categoryAverage(cat, hypothetical) {
    return averageOf(categoryPercents(cat, hypothetical), cat.dropLowest).average;
  }

  function weightOf(cat) {
    const w = num(cat.weight);
    return w === null ? 0 : Math.max(0, w);
  }

  /**
   * Weighted grade for the whole course.
   * Categories with nothing to count are skipped, and the weights of the rest are
   * scaled to add up to 100%. So a course that is half graded still shows an honest "so far".
   */
  function courseGrade(course, hypothetical) {
    let sum = 0;
    let weightUsed = 0;
    const categories = [];
    for (const cat of course.categories || []) {
      const avg = categoryAverage(cat, hypothetical);
      const w = weightOf(cat);
      categories.push({ id: cat.id, name: cat.name, weight: w, average: avg });
      if (avg === null || w === 0) continue;
      sum += avg * w;
      weightUsed += w;
    }
    return { percent: weightUsed > 0 ? sum / weightUsed : null, weightUsed, categories };
  }

  function totalWeight(course) {
    return (course.categories || []).reduce((t, c) => t + weightOf(c), 0);
  }

  // ----------------------------------------- terms, GPA and requirements

  function creditsOf(course) {
    const c = num(course.credits);
    return c === null ? 1 : c;
  }

  /**
   * Cumulative result over a list of courses: credit-weighted average percent,
   * and (when the scale has points) credit-weighted GPA.
   */
  function cumulative(courses, scale, opts) {
    let pctSum = 0, ptsSum = 0, credits = 0, ptsCredits = 0, count = 0;
    for (const course of courses || []) {
      const g = courseGrade(course).percent;
      const cr = creditsOf(course);
      if (g === null || cr <= 0) continue;
      count++;
      credits += cr;
      pctSum += g * cr;
      const pts = pointsFor(g, scale, Object.assign({}, opts, { level: course.level }));
      if (pts !== null) { ptsSum += pts * cr; ptsCredits += cr; }
    }
    return {
      percent: credits > 0 ? pctSum / credits : null,
      points: ptsCredits > 0 ? ptsSum / ptsCredits : null,
      credits,
      count,
    };
  }

  /** One summary per term (in order), skipping terms with nothing graded. Used for the trend graph. */
  function termSummaries(terms, courses, scale, opts) {
    const out = [];
    for (const t of terms || []) {
      const mine = (courses || []).filter((c) => c.termId === t.id);
      const sum = cumulative(mine, scale, opts);
      if (sum.count > 0) out.push({ id: t.id, name: t.name, percent: sum.percent, points: sum.points, count: sum.count });
    }
    return out;
  }

  /**
   * Compare a college's course requirements with the courses taken.
   * requirement = { subject, years }; a course counts its credits (1 for a full year).
   */
  function requirementProgress(requirements, courses) {
    return (requirements || []).map((r) => {
      const need = num(r.years) || 0;
      const have = (courses || [])
        .filter((c) => c.subject && c.subject === r.subject)
        .reduce((t, c) => t + Math.max(0, creditsOf(c)), 0);
      return { subject: r.subject, need, have, met: have >= need - EPS, short: Math.max(0, need - have) };
    });
  }

  // ------------------------------------------------------------- archive
  // Earlier classes and grades the person adds by hand (version 2). The functions above never look at these.
  //   class   = { id, kind: 'class', name, subject, level, credits, period, when, percent, letter, note }
  //   summary = { id, kind: 'summary', label, period, when, gpa, percent, credits, note }

  /** The percent for an archived class: the typed percent, or the middle of the typed letter's band. Null if neither. */
  function archivePercent(rec, scale) {
    const p = num(rec && rec.percent);
    if (p !== null) return Math.max(0, p);
    const letter = String((rec && rec.letter) || '').trim().toLowerCase();
    if (!letter) return null;
    const bands = scale.bands;
    for (let i = 0; i < bands.length; i++) {
      if (String(bands[i].letter).toLowerCase() === letter) {
        const top = i === 0 ? 100 : bands[i - 1].min;
        return (bands[i].min + top) / 2;
      }
    }
    return null;
  }

  /** [{ pct, pts, cr }] for each archive record that has something to count. */
  function archiveRows(archive, scale, opts) {
    const rows = [];
    for (const rec of archive || []) {
      if (!rec) continue;
      if (rec.kind === 'summary') {
        const pct = num(rec.percent);
        const gpa = num(rec.gpa);
        if (pct === null && gpa === null) continue;
        const cr = num(rec.credits);
        rows.push({ pct, pts: gpa, cr: cr !== null && cr > 0 ? cr : 1, rec });
      } else {
        const pct = archivePercent(rec, scale);
        if (pct === null) continue;
        const cr = creditsOf(rec);
        if (cr <= 0) continue;
        rows.push({ pct, pts: pointsFor(pct, scale, Object.assign({}, opts, { level: rec.level })), cr, rec });
      }
    }
    return rows;
  }

  function sumRows(rows) {
    let pctSum = 0, pctCr = 0, ptsSum = 0, ptsCr = 0, credits = 0;
    for (const r of rows) {
      credits += r.cr;
      if (r.pct !== null) { pctSum += r.pct * r.cr; pctCr += r.cr; }
      if (r.pts !== null) { ptsSum += r.pts * r.cr; ptsCr += r.cr; }
    }
    return { percent: pctCr > 0 ? pctSum / pctCr : null, points: ptsCr > 0 ? ptsSum / ptsCr : null, credits, count: rows.length };
  }

  /** Credit-weighted result over the archive alone. */
  function archiveCumulative(archive, scale, opts) {
    return sumRows(archiveRows(archive, scale, opts));
  }

  /** Current courses and the archive together. With an empty archive this equals cumulative(). */
  function cumulativeAll(courses, archive, scale, opts) {
    const rows = archiveRows(archive, scale, opts);
    for (const course of courses || []) {
      const g = courseGrade(course).percent;
      const cr = creditsOf(course);
      if (g === null || cr <= 0) continue;
      rows.push({ pct: g, pts: pointsFor(g, scale, Object.assign({}, opts, { level: course.level })), cr });
    }
    return sumRows(rows);
  }

  /** One summary per archive period (for example "Grade 9"), oldest first. Used by the trend chart. */
  function archivePeriods(archive, scale, opts) {
    const groups = [];
    const byKey = {};
    archiveRows(archive, scale, opts).forEach((r, idx) => {
      const name = String(r.rec.period || '').trim() || 'Earlier';
      if (!byKey[name]) { byKey[name] = { name, rows: [], when: '', first: idx }; groups.push(byKey[name]); }
      const g = byKey[name];
      g.rows.push(r);
      const w = String(r.rec.when || '');
      if (w && (!g.when || w < g.when)) g.when = w;
    });
    groups.sort((a, b) => (a.when && b.when ? a.when.localeCompare(b.when) || a.first - b.first : a.when ? -1 : b.when ? 1 : a.first - b.first));
    return groups.map((g) => Object.assign({ name: g.name, when: g.when }, sumRows(g.rows))).filter((g) => g.percent !== null);
  }

  // ---------------------------------------------------- "What do I need?"

  function hasUpcoming(course) {
    return (course.categories || []).some((c) => weightOf(c) > 0 && (c.entries || []).some(isUpcoming));
  }

  /**
   * What score, on every upcoming entry, gets the course to `target` percent?
   *
   * For one final worth w, this is the classic
   *   needed = (target - current * (1 - w)) / w
   * but this version also handles several categories, decimals and drop-lowest
   * by searching for the answer (the grade only ever goes up as the score goes up).
   *
   * status: 'no-goal' | 'no-upcoming' | 'secured' | 'reachable' | 'out-of-reach'
   */
  function neededScore(course, target) {
    const t = num(target);
    if (t === null) return { status: 'no-goal' };
    if (!hasUpcoming(course)) return { status: 'no-upcoming' };

    const at = (x) => courseGrade(course, x).percent;
    const best = at(100);
    if (at(0) >= t - EPS) return { status: 'secured', needed: 0, bestCase: best };
    if (best < t - EPS) return { status: 'out-of-reach', bestCase: best };

    let lo = 0;
    let hi = 100;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (at(mid) >= t - EPS) hi = mid;
      else lo = mid;
    }
    // Round UP to one decimal so scoring exactly the number shown really reaches the goal.
    const needed = Math.min(100, Math.ceil(hi * 10 - 1e-6) / 10);
    return { status: 'reachable', needed, bestCase: best };
  }

  /** How much of the final grade one entry is worth (approximate when a category uses drop-lowest). */
  function entryWorth(course, cat, entry) {
    const cats = (course.categories || []).filter((c) => weightOf(c) > 0 && (c.entries || []).length > 0);
    const used = cats.reduce((t, c) => t + weightOf(c), 0);
    if (used <= 0 || weightOf(cat) <= 0 || !(cat.entries || []).length) return 0;
    return ((weightOf(cat) / used) * 100) / cat.entries.length;
  }

  /** Every upcoming entry with how much of the final grade it is worth. */
  function upcomingItems(course) {
    const items = [];
    for (const c of course.categories || []) {
      for (const e of c.entries || []) {
        if (isUpcoming(e) && weightOf(c) > 0) {
          items.push({ id: e.id, name: e.name, category: c.name, worth: entryWorth(course, c, e), due: e.due || '', time: e.time || '' });
        }
      }
    }
    return items;
  }

  /**
   * Every entry that has a due date, across all courses, sorted by date.
   * `needed` is the average the course needs on what is still to come for its goal.
   */
  function collectEvents(courses, defaultTarget) {
    const out = [];
    for (const course of courses || []) {
      const target = num(course.target) !== null ? course.target : defaultTarget;
      const need = neededScore(course, target);
      for (const cat of course.categories || []) {
        for (const e of cat.entries || []) {
          if (!e.due) continue;
          out.push({
            id: e.id,
            courseId: course.id,
            courseName: course.name,
            category: cat.name,
            name: e.name,
            due: e.due,
            time: e.time || '',
            // minutes before the due time; -1 means no reminder (0 means "at the time")
            remind: num(e.remind) === null ? -1 : num(e.remind),
            scored: !isUpcoming(e),
            worth: entryWorth(course, cat, e),
            need,
          });
        }
      }
    }
    out.sort((a, b) => (a.due + (a.time || '99:99')).localeCompare(b.due + (b.time || '99:99')));
    return out;
  }

  // ----------------------------------------------------------- tone of voice

  /**
   * The encouraging message. Each result has a `tone` so the screen can show an
   * icon and a label as well as a colour (never colour alone).
   */
  function coach(course, target, scale) {
    const t = num(target);
    const grade = courseGrade(course).percent;
    const need = neededScore(course, t);

    if (need.status === 'no-goal') {
      return { tone: 'empty', headline: 'Pick a goal to aim for.', body: 'Type a percent or tap a letter and I will show you what it takes.' };
    }
    if (need.status === 'no-upcoming') {
      if (grade === null) {
        return { tone: 'empty', headline: 'Ready when you are.', body: 'Add a score, or an upcoming test with its score left blank, and I will work out where you stand.' };
      }
      const band = bandFor(grade, scale);
      if (grade >= t - EPS) {
        return { tone: 'great', headline: 'Goal met. Well done.', body: 'You finished at ' + fmt(grade) + '% (' + band.letter + '). That came from steady work all term.' };
      }
      return {
        tone: 'reach',
        headline: 'All marks are in.',
        body: 'You finished at ' + fmt(grade) + '% (' + band.letter + '), ' + fmt(t - grade) + ' points under your goal. Use it to decide what to try next term. It says nothing about what you can do.',
      };
    }
    if (need.status === 'secured') {
      return { tone: 'great', headline: 'Your goal is already covered.', body: 'Even a rough patch on what is left keeps you at ' + fmt(t) + '% or above. Keep going and enjoy it.' };
    }
    if (need.status === 'out-of-reach') {
      const b = bandFor(need.bestCase, scale);
      return {
        tone: 'reach',
        headline: 'This goal is out of reach this term.',
        body: 'With the marks still to come, the most you can finish with is about ' + fmt(need.bestCase) + '% (' + b.letter + '). That is a result worth being proud of, and you can aim for it instead.',
        suggestGoal: b.min > 0 ? b.min : Math.floor(need.bestCase),
      };
    }

    // reachable
    const n = need.needed;
    if (grade !== null && n <= grade + EPS) {
      return { tone: 'great', headline: 'You are on track.', body: 'Matching your average so far (about ' + fmt(grade) + '%) on the rest gets you to ' + fmt(t) + '%.' };
    }
    if (n <= 90) {
      let body = 'A steady effort on the rest of the term gets you there.';
      if (grade !== null) {
        const diff = n - grade;
        if (diff <= 5) body = 'That is a small step up from where you are now.';
        else if (diff <= 12) body = 'That is a solid step up, and a realistic one.';
        else body = 'That is a real step up. A short plan for each upcoming test will help.';
      }
      return { tone: 'steady', headline: 'Aim for about ' + fmt(n) + '% on what is left.', body };
    }
    // Stretch: offer a nearer goal as a back-up.
    const lower = scale.bands.find((b) => b.min > 0 && b.min < t - EPS);
    let body = 'You would need about ' + fmt(n) + '% on everything left.';
    if (lower) {
      const alt = neededScore(course, lower.min);
      if (alt.status === 'secured') body += ' A back-up goal of ' + lower.min + '% is already covered.';
      else if (alt.status === 'reachable') body += ' If you want a back-up, ' + lower.min + '% needs about ' + fmt(alt.needed) + '%.';
    }
    return { tone: 'stretch', headline: 'This one is a stretch, and worth a try.', body };
  }

  return {
    SCALES, DEFAULT_BONUS, EPS, num, round1, fmt,
    COUNTRIES, countryById, countryOfScale, scalesOfCountry,
    archivePercent, archiveRows, archiveCumulative, cumulativeAll, archivePeriods,
    getScale, normalizeBands, hasPoints, bandFor, pointsFor,
    entryPercent, isUpcoming, averageOf, categoryPercents, categoryAverage,
    courseGrade, totalWeight, creditsOf, cumulative, termSummaries, requirementProgress,
    hasUpcoming, neededScore, entryWorth, upcomingItems, collectEvents, coach,
  };
});
