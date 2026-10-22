/* grademapper version 2: tests for the new engine pieces, plus a check that the old pieces still give the same answers as version 1.
   Run: node tests/engine-v2.test.js   (looks for the version 1 engine at ../v1-baseline/js/engine.js when it is there) */
'use strict';
const fs = require('fs');
const path = require('path');
const E = require('../js/engine.js');
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('  ok  ' + name); } catch (e) { failed++; console.log('FAIL  ' + name + '\n      ' + e.message); } }
function eq(a, b, msg) { if (a !== b) throw new Error((msg || '') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); }
function near(a, b, msg) { if (Math.abs(a - b) > 1e-9) throw new Error((msg || '') + ' expected ' + b + ' got ' + a); }

// ---------------------------------------------------------------- scales
test('every scale is sorted high to low and ends at 0', () => {
  Object.keys(E.SCALES).forEach((id) => {
    const b = E.SCALES[id].bands;
    eq(b[b.length - 1].min, 0, id + ' last band');
    for (let i = 1; i < b.length; i++) if (!(b[i - 1].min > b[i].min)) throw new Error(id + ' not strictly descending at ' + i);
    eq(E.SCALES[id].id, id, 'id matches key');
  });
});
test('every scale belongs to exactly one country; custom belongs to "other"', () => {
  const seen = {};
  E.COUNTRIES.forEach((c) => c.scales.forEach((s) => { seen[s] = (seen[s] || 0) + 1; }));
  Object.keys(E.SCALES).forEach((id) => eq(seen[id], 1, id + ' listed'));
  eq(seen.custom, 1, 'custom listed');
  Object.keys(seen).forEach((id) => { if (id !== 'custom' && !E.SCALES[id]) throw new Error('unknown scale ' + id); });
  eq(E.countryOfScale('custom').id, 'other');
  eq(E.countryOfScale('bc').id, 'ca');
  eq(E.countryOfScale('us').id, 'us');
  eq(E.countryOfScale('nonsense').id, 'other');
});
test('the four version 1 scales keep their ids and first/last bands', () => {
  ['us', 'bc', 'uk', 'ib'].forEach((id) => { if (!E.SCALES[id]) throw new Error(id); });
  eq(E.SCALES.us.bands[0].letter, 'A'); eq(E.SCALES.bc.bands[0].min, 86); eq(E.SCALES.ib.bands[0].points, 7);
});
test('scalesOfCountry lists the scales for a country', () => {
  const ca = E.scalesOfCountry('ca').map((s) => s.id);
  eq(ca.join(','), 'bc,ca-letter,ca-on');
  eq(E.scalesOfCountry('nowhere').length, 0);
});
test('new scale lookups work through getScale', () => {
  eq(E.bandFor(92, E.getScale('ie')).letter, 'H1');
  eq(E.bandFor(79.96, E.getScale('ca-on')).letter, 'Level 4'); // 79.96 shows as 80.0
  eq(E.bandFor(84.9, E.getScale('au')).letter, 'D');
  eq(E.pointsFor(86, E.getScale('au')), 7);
  eq(E.bandFor(10, E.getScale('de')).letter, '6');
  eq(E.getScale('does-not-exist').id, 'us');
});

// --------------------------------------------------------------- archive
const us = E.getScale('us');
test('archivePercent: typed percent wins; letters use the middle of the band', () => {
  eq(E.archivePercent({ percent: '88' }, us), 88);
  eq(E.archivePercent({ percent: '', letter: 'A' }, us), 96.5);
  eq(E.archivePercent({ letter: ' b+ ' }, us), (87 + 90) / 2);
  eq(E.archivePercent({ letter: 'F' }, us), 30);
  eq(E.archivePercent({ letter: 'Z' }, us), null);
  eq(E.archivePercent({}, us), null);
  eq(E.archivePercent({ percent: '88', letter: 'F' }, us), 88);
});
test('archiveCumulative: credit-weighted percent and GPA', () => {
  const a = [
    { kind: 'class', name: 'Bio', credits: '1', percent: '90' },
    { kind: 'class', name: 'Math', credits: '3', percent: '80' },
  ];
  const r = E.archiveCumulative(a, us, {});
  near(r.percent, (90 + 240) / 4);
  near(r.points, (3.7 * 1 + 2.7 * 3) / 4);
  eq(r.credits, 4); eq(r.count, 2);
});
test('archive summary records count by their credits (1 when blank)', () => {
  const r = E.archiveCumulative([{ kind: 'summary', gpa: '3.5', credits: '10' }, { kind: 'summary', percent: '80' }], us, {});
  near(r.points, 3.5);          // only one record has a GPA
  near(r.percent, 80);          // only one has a percent
  eq(r.credits, 11);
  eq(E.archiveCumulative([{ kind: 'summary' }, { kind: 'class', name: 'x' }], us, {}).percent, null);
});
test('cumulativeAll with an empty archive equals cumulative()', () => {
  const course = { id: 'c', credits: '2', level: 'regular', categories: [{ id: 'k', weight: 100, dropLowest: 0, entries: [{ id: 'e', score: '84', max: '100' }] }] };
  const a = E.cumulative([course], us, {}), b = E.cumulativeAll([course], [], us, {});
  near(a.percent, b.percent); near(a.points, b.points); eq(a.credits, b.credits); eq(a.count, b.count);
  const c = E.cumulativeAll([course], [{ kind: 'class', credits: '2', percent: '96' }], us, {});
  near(c.percent, 90); eq(c.credits, 4);
});
test('weighted GPA bonus applies to archived classes by level', () => {
  const r = E.archiveCumulative([{ kind: 'class', credits: '1', percent: '95', level: 'ap' }], us, { weighted: true });
  near(r.points, 5);
});
test('archivePeriods groups by period and orders by date, then by entry order', () => {
  const a = [
    { kind: 'class', period: 'Grade 10', when: '2025-06', credits: '1', percent: '80' },
    { kind: 'class', period: 'Grade 9', when: '2024-06', credits: '1', percent: '90' },
    { kind: 'class', period: 'Grade 9', when: '2024-06', credits: '1', percent: '70' },
    { kind: 'class', period: '', credits: '1', percent: '60' },
  ];
  const p = E.archivePeriods(a, us, {});
  eq(p.map((x) => x.name).join('|'), 'Grade 9|Grade 10|Earlier');
  near(p[0].percent, 80); eq(p[0].count, 2);
  eq(E.archivePeriods([], us, {}).length, 0);
});

// ---------------------------------------- version 1 and 2 give the same answers
const v1Path = path.join(__dirname, '..', '..', 'v1-baseline', 'js', 'engine.js');
if (fs.existsSync(v1Path)) {
  const V1 = require(v1Path);
  let seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  function randCourse(i) {
    const cats = [];
    const nc = 1 + Math.floor(rnd() * 5);
    for (let c = 0; c < nc; c++) {
      const ne = Math.floor(rnd() * 6), entries = [];
      for (let e = 0; e < ne; e++) {
        const up = rnd() < 0.3;
        entries.push({ id: 'e' + i + c + e, name: 'x', score: up ? '' : pick([String(Math.floor(rnd() * 101)), String((rnd() * 40).toFixed(1)), '7,5', 'abc']), max: pick(['100', '40', '10', '', '0', '12.5']), due: up && rnd() < 0.7 ? '2026-12-01' : '', remind: pick(['', '0', '60']) });
      }
      cats.push({ id: 'k' + i + c, name: 'cat', weight: pick(['10', '20', '35', '2.5', '', '0', 30]), dropLowest: pick(['0', '1', '2', '']), entries });
    }
    return { id: 'c' + i, name: 'Course ' + i, credits: pick(['1', '0.5', '2', '', '0']), level: pick(['regular', 'honors', 'ap', 'ib']), target: pick(['', '70', '85', '95', '100']), categories: cats };
  }
  const scales = ['us', 'bc', 'uk', 'ib'];
  test('2000 random courses: every version 1 function gives the same answer in version 2', () => {
    for (let i = 0; i < 2000; i++) {
      const c = randCourse(i);
      const same = (name, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(name + ' differs on course ' + i + ': ' + JSON.stringify(a) + ' vs ' + JSON.stringify(b)); };
      same('courseGrade', V1.courseGrade(c), E.courseGrade(c));
      same('courseGrade hyp', V1.courseGrade(c, 73), E.courseGrade(c, 73));
      same('totalWeight', V1.totalWeight(c), E.totalWeight(c));
      same('neededScore', V1.neededScore(c, c.target), E.neededScore(c, c.target));
      same('coach', V1.coach(c, c.target, V1.getScale('us')), E.coach(c, c.target, E.getScale('us')));
      same('upcoming', V1.upcomingItems(c), E.upcomingItems(c));
      same('events', V1.collectEvents([c], '80'), E.collectEvents([c], '80'));
      const c2 = randCourse(i + 5000);
      scales.forEach((sid) => {
        const s1 = V1.getScale(sid), s2 = E.getScale(sid);
        same('scale ' + sid, s1, s2);
        const o = { weighted: i % 2 === 0, bonus: { honors: 0.5, ap: 1, ib: 1 } };
        same('cumulative ' + sid, V1.cumulative([c, c2], s1, o), E.cumulative([c, c2], s2, o));
      });
    }
    for (let p = -5; p <= 105; p += 0.37) scales.forEach((sid) => { if (JSON.stringify(V1.bandFor(p, V1.getScale(sid))) !== JSON.stringify(E.bandFor(p, E.getScale(sid)))) throw new Error('bandFor ' + sid + ' ' + p); });
    const custom = { label: 'x', bands: [{ min: '50', letter: 'P' }, { min: '0', letter: 'F' }] };
    eq(JSON.stringify(V1.getScale('custom', custom)), JSON.stringify(E.getScale('custom', custom)));
    eq(JSON.stringify(V1.num('1,5')), JSON.stringify(E.num('1,5')));
  });
} else console.log('  (version 1 engine not found, skipping the old-versus-new comparison)');

console.log('\n' + passed + ' passed' + (failed ? ', ' + failed + ' FAILED' : ''));
process.exit(failed ? 1 : 0);
