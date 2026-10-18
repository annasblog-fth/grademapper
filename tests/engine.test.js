// Run with:  node tests/engine.test.js
const assert = require('node:assert/strict');
const E = require('../js/engine.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (err) { console.log('FAIL  ' + name + '\n      ' + err.message); process.exitCode = 1; }
}
const close = (a, b, d = 1e-6) => assert.ok(Math.abs(a - b) < d, a + ' is not close to ' + b);
const cat = (name, weight, entries, dropLowest = 0) => ({
  id: name, name, weight, dropLowest,
  entries: entries.map(([score, max, extra], i) => ({ id: name + i, name: name + ' ' + (i + 1), score, max, ...(extra || {}) })),
});
const course = (name, cats, extra) => ({ id: name, name, categories: cats, ...(extra || {}) });

console.log('Little Grades engine');

// ------------------------------------------------------------ averaging
test('worked example from the research doc gives 81%', () => {
  const c = course('x', [cat('Tests', 50, [[80, 100]]), cat('Homework', 20, [[100, 100]]), cat('Projects', 30, [[70, 100]])]);
  close(E.courseGrade(c).percent, 81);
});

test('several entries in one category are averaged automatically', () => {
  // 90%, 90% and 70% -> 83.33%
  close(E.categoryAverage(cat('Tests', 50, [[18, 20], [45, 50], [7, 10]])), 83.3333333, 1e-5);
});

test('decimal scores, decimal weights and comma decimals work', () => {
  const c = course('x', [cat('Quiz', '2.5', [['9,5', '10']]), cat('Rest', '97.5', [[80, 100]])]);
  close(E.courseGrade(c).percent, (95 * 2.5 + 80 * 97.5) / 100);
});

test('drop-lowest removes the worst marks but always keeps one', () => {
  close(E.categoryAverage(cat('Quizzes', 10, [[6, 10], [9, 10], [8, 10]], 1)), 85);
  close(E.categoryAverage(cat('Quizzes', 10, [[6, 10]], 3)), 60);
});

test('categories with nothing graded are skipped and weights are scaled', () => {
  close(E.courseGrade(course('x', [cat('A', 50, [[90, 100]]), cat('B', 50, [['', 100]])])).percent, 90);
});

test('weights that do not add to 100 still give a sensible grade', () => {
  close(E.courseGrade(course('x', [cat('A', 30, [[80, 100]]), cat('B', 30, [[100, 100]])])).percent, 90);
});

test('an empty course has no grade instead of crashing', () => {
  assert.equal(E.courseGrade(course('x', [])).percent, null);
  assert.equal(E.courseGrade(course('x', [cat('A', 50, [['', 100]])])).percent, null);
});

test('extra credit (score above max) is allowed; missing max means 100', () => {
  close(E.entryPercent({ score: 22, max: 20 }), 110);
  close(E.entryPercent({ score: 72, max: '' }), 72);
});

// ------------------------------------------------------- what do I need
test('needed score matches the textbook formula for a single final', () => {
  const c = course('x', [cat('Coursework', 70, [[80, 100]]), cat('Final', 30, [['', 100]])]);
  const n = E.neededScore(c, 85);
  assert.equal(n.status, 'reachable');
  assert.equal(n.needed, 96.7); // (85 - 80*0.7) / 0.3 = 96.67, rounded up
  assert.ok(E.courseGrade(c, n.needed).percent >= 85);
});

test('needed score accounts for drop-lowest on the upcoming entries', () => {
  const c = course('x', [cat('Quizzes', 100, [[2, 10], ['', 10]], 1)]);
  const n = E.neededScore(c, 80);
  assert.equal(n.status, 'reachable');
  assert.equal(n.needed, 80);
});

test('goal already covered / out of reach / nothing upcoming / no goal', () => {
  assert.equal(E.neededScore(course('x', [cat('C', 90, [[100, 100]]), cat('F', 10, [['', 100]])]), 85).status, 'secured');
  const out = E.neededScore(course('x', [cat('C', 90, [[50, 100]]), cat('F', 10, [['', 100]])]), 85);
  assert.equal(out.status, 'out-of-reach');
  close(out.bestCase, 55);
  const done = course('x', [cat('A', 100, [[80, 100]])]);
  assert.equal(E.neededScore(done, 85).status, 'no-upcoming');
  assert.equal(E.neededScore(done, '').status, 'no-goal');
});

test('upcoming items show what each is worth and their due date', () => {
  const c = course('x', [cat('Tests', 60, [[80, 100], ['', 100, { due: '2026-11-02' }]]), cat('Final', 40, [['', 100]])]);
  const items = E.upcomingItems(c);
  assert.equal(items.length, 2);
  close(items[0].worth, 30);
  assert.equal(items[0].due, '2026-11-02');
  close(items[1].worth, 40);
});

// ---------------------------------------------------------- scales / GPA
test('letters and points: US boundaries', () => {
  const us = E.SCALES.us;
  assert.equal(E.bandFor(90, us).letter, 'A-');
  assert.equal(E.bandFor(89.94, us).letter, 'B+');
  assert.equal(E.bandFor(89.95, us).letter, 'A-'); // shows as 90%, so it is an A-
  assert.equal(E.bandFor(93, us).points, 4.0);
  assert.equal(E.bandFor(12, us).letter, 'F');
});

test('letters: BC, UK and IB', () => {
  assert.equal(E.bandFor(86, E.SCALES.bc).letter, 'A');
  assert.equal(E.bandFor(85.9, E.SCALES.bc).letter, 'B');
  assert.equal(E.bandFor(90, E.SCALES.uk).letter, 'A*');
  assert.equal(E.bandFor(39.9, E.SCALES.uk).letter, 'U');
  assert.equal(E.bandFor(80, E.SCALES.ib).letter, '7');
  assert.equal(E.pointsFor(65, E.SCALES.ib), 5);
  assert.equal(E.pointsFor(65, E.SCALES.bc), null); // no points on this scale
});

test('custom scale: sorted, cleaned, and always reaches 0', () => {
  const s = E.getScale('custom', { label: 'My school', pointsLabel: 'GP', bands: [{ min: '50', letter: 'P', points: 1 }, { min: 80, letter: 'H', points: 3 }, { min: 'x', letter: 'bad' }] });
  assert.deepEqual(s.bands.map((b) => b.letter), ['H', 'P', 'F']);
  assert.equal(E.bandFor(85, s).letter, 'H');
  assert.equal(E.bandFor(10, s).letter, 'F');
  assert.equal(E.hasPoints(s), true);
  // junk in, sensible defaults out
  assert.equal(E.getScale('custom', { bands: [] }).bands[0].letter, 'A');
});

test('weighted GPA adds the course-level bonus, but never to an F', () => {
  const us = E.SCALES.us;
  assert.equal(E.pointsFor(95, us, { weighted: false, level: 'ap' }), 4);
  assert.equal(E.pointsFor(95, us, { weighted: true, level: 'ap' }), 5);
  assert.equal(E.pointsFor(95, us, { weighted: true, level: 'honors' }), 4.5);
  assert.equal(E.pointsFor(95, us, { weighted: true, level: 'regular' }), 4);
  assert.equal(E.pointsFor(40, us, { weighted: true, level: 'ap' }), 0);
  assert.equal(E.pointsFor(95, E.SCALES.ib, { weighted: true, level: 'ap' }), 7); // no bonus on IB
  assert.equal(E.pointsFor(95, us, { weighted: true, level: 'ap', bonus: { ap: 0.8 } }), 4.8);
});

test('cumulative: credit-weighted average and GPA across courses', () => {
  const mk = (name, pct, credits, level) => course(name, [cat('All', 100, [[pct, 100]])], { credits, level });
  const courses = [mk('Math', 95, 1, 'ap'), mk('Art', 85, 0.5, 'regular'), mk('Blank', '', 1, 'regular')];
  courses[2].categories = [cat('All', 100, [['', 100]])];
  const un = E.cumulative(courses, E.SCALES.us, { weighted: false });
  close(un.percent, (95 * 1 + 85 * 0.5) / 1.5);
  close(un.points, (4 * 1 + 3.0 * 0.5) / 1.5); // 85 is a B (3.0)
  assert.equal(un.count, 2); // the ungraded course is skipped
  const w = E.cumulative(courses, E.SCALES.us, { weighted: true });
  close(w.points, (5 * 1 + 3.0 * 0.5) / 1.5);
  assert.equal(E.cumulative([], E.SCALES.us).percent, null);
});

test('term summaries give one point per graded term, in order', () => {
  const terms = [{ id: 't1', name: 'Fall' }, { id: 't2', name: 'Spring' }, { id: 't3', name: 'Empty' }];
  const courses = [
    course('A', [cat('x', 100, [[80, 100]])], { termId: 't1' }),
    course('B', [cat('x', 100, [[90, 100]])], { termId: 't2' }),
  ];
  const s = E.termSummaries(terms, courses, E.SCALES.us, {});
  assert.deepEqual(s.map((x) => x.name), ['Fall', 'Spring']);
  close(s[1].percent, 90);
});

test('requirement progress compares courses taken with what a college asks for', () => {
  const courses = [
    course('English 10', [], { subject: 'English', credits: 1 }),
    course('English 11', [], { subject: 'English', credits: 1 }),
    course('Math 10', [], { subject: 'Math', credits: 1 }),
    course('Spanish', [], { subject: 'Language', credits: 0.5 }),
  ];
  const p = E.requirementProgress([{ subject: 'English', years: 4 }, { subject: 'Math', years: 1 }, { subject: 'Language', years: 2 }], courses);
  assert.deepEqual(p.map((x) => x.met), [false, true, false]);
  close(p[0].short, 2);
  close(p[2].have, 0.5);
});

// ----------------------------------------------------------- calendar
test('events: only dated entries, sorted, with worth and the aim-for number', () => {
  const c1 = course('Math', [
    cat('Tests', 50, [[80, 100, { due: '2026-11-10' }], ['', 100, { due: '2026-10-20', time: '09:00', remind: 1440 }]]),
    cat('Final', 50, [['', 100]]),
  ], { target: 85 });
  const c2 = course('Bio', [cat('Labs', 100, [['', 100, { due: '2026-10-18' }]])], { target: '' });
  const ev = E.collectEvents([c1, c2], 80);
  assert.deepEqual(ev.map((e) => e.due), ['2026-10-18', '2026-10-20', '2026-11-10']);
  assert.equal(ev[1].remind, 1440);
  assert.equal(ev[0].remind, -1); // no reminder set
  assert.equal(ev[2].scored, true);
  close(ev[1].worth, 25);
  assert.equal(ev[1].need.status, 'reachable'); // uses the course goal of 85
  assert.equal(ev[0].need.status, 'reachable'); // Bio falls back to the default goal of 80
});

// -------------------------------------------------------------- coach
test('coach tone for each situation', () => {
  const us = E.SCALES.us;
  const mk = (graded, finalW) => course('x', [cat('Work', 100 - finalW, [[graded, 100]]), cat('Final', finalW, [['', 100]])]);
  assert.equal(E.coach(course('x', []), 85, us).tone, 'empty');
  assert.equal(E.coach(mk(95, 30), 85, us).tone, 'great');
  assert.equal(E.coach(mk(80, 30), 85, us).tone, 'stretch'); // needs 96.7
  assert.equal(E.coach(mk(84, 30), 85, us).tone, 'steady');  // needs 87.3
  assert.equal(E.coach(mk(84, 30), '', us).tone, 'empty');
});

test('coach: out of reach offers a nearer goal; finished courses get closure', () => {
  const c = course('x', [cat('Coursework', 90, [[50, 100]]), cat('Final', 10, [['', 100]])]);
  const r = E.coach(c, 85, E.SCALES.us);
  assert.equal(r.tone, 'reach');
  assert.equal(r.suggestGoal, 55);
  assert.equal(E.coach(c, 85, E.SCALES.bc).suggestGoal, 50);
  const done = course('x', [cat('A', 100, [[90, 100]])]);
  assert.equal(E.coach(done, 85, E.SCALES.us).headline, 'Goal met. Well done.');
  assert.equal(E.coach(done, 95, E.SCALES.us).headline, 'All marks are in.');
});

console.log('\n' + passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
