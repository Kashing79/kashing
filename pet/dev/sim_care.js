// 开发用：喂饭和拉粑粑（照料那一套）快进测试。R6-care.md 第 6 节的 T1-T19。
//   node sim_care.js            两部分都跑
//   node sim_care.js model      只跑第一部分：账本（needs.js）自己，几百天快进，一个"假的舞台"代替引擎（从 R6 的 sim_ref.js 搬过来）
//   node sim_care.js engine     只跑第二部分：真的引擎（没有网页的空环境），拨钟、模拟她在不在、鼠标、丢球、关开关、电脑睡着
//   想拿另一份 web/ 来跑：PET_WEB=那个目录 node sim_care.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const WEB = path.resolve(process.env.PET_WEB || path.join(__dirname, '../web'));
const PART = process.argv[2] || 'all';
// needs.js 在一个空环境里读进来（和外壳一样）
const N = (() => { const c = vm.createContext({}); vm.runInContext(fs.readFileSync(path.join(WEB, 'needs.js'), 'utf8'), c, { filename: 'needs.js' }); return c.PET_NEEDS; })();
let engineBad = 0;

let modelBad = 0;
const MIN = 60000, HOUR = 3600000, DAY = 24 * HOUR;
function rnd(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function modelPart() {
const UTC = { parts(ms) { const d = new Date(ms); return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes() }; } };
const BASE = Date.UTC(2027, 2, 1, 0, 0, 0);          // a Monday; "local time" = UTC in the simulation
const at = (day, h, m) => BASE + day * DAY + h * HOUR + (m || 0) * MIN;

function rnd(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// opts: start, end, seed, cfg, running(t), idle(t), saved (json or null), helpProb, feedNowAt [ms...], toggles [{t, set}]
function run(opts) {
  const R = rnd(opts.seed * 7919 + 13), U = (a, b) => a + R() * (b - a);
  const step = 5000, cfg = opts.cfg || {};
  let needs = null, saved = opts.saved || null, wasRunning = false, out = false, comeOutAt = 0;
  let act = null, busyUntil = 0, nextAuto = 0, resumeAt = 0;
  const log = [], bad = [], poops = [];        // poops on stage: { dog, t0, deadline }
  const perDay = {};                            // day key -> { meals, biscuits, snacks, dax, gold }
  const dayOf = (t) => Math.floor((t - BASE) / DAY);
  const D = (t) => (perDay[dayOf(t)] = perDay[dayOf(t)] || { meals: 0, biscuits: 0, snacks: 0, dax: 0, gold: 0, water: 0 });
  const hhmm = (t) => { const p = UTC.parts(t); return 'd' + dayOf(t) + ' ' + String(p.h).padStart(2, '0') + ':' + String(p.mi).padStart(2, '0'); };
  const ev = (t, k, x) => log.push(Object.assign({ t, at: hhmm(t), k }, x || {}));
  let lastAutoMeal = 0, lastPoop = { dax: 0, gold: 0 };
  let feedIdx = 0, togIdx = 0;
  const feedNowAt = (opts.feedNowAt || []).slice().sort((a, b) => a - b), toggles = (opts.toggles || []).slice().sort((a, b) => a.t - b.t);

  for (let t = opts.start; t < opts.end; t += step) {
    const running = opts.running ? opts.running(t) : true;
    const idle = opts.idle ? opts.idle(t) : 0;
    if (!running) {
      if (wasRunning) { saved = needs.save(); wasRunning = false; if (act && act.kind === 'meal') needs.mealDone(act.t0, act.meal, act.by, act.slot), saved = needs.save(); act = null; poops.length = 0; ev(t, 'stop'); }
      continue;
    }
    if (!wasRunning) {
      needs = N.create(cfg, opts.seed + dayOf(t) * 31 + 1, UTC);
      if (saved) needs.load(saved, t); else needs.tick(t, { idle: 0, out: false });
      wasRunning = true; out = false; comeOutAt = t + 2000; resumeAt = t; nextAuto = t + U(8, 14) * 1000; busyUntil = 0; act = null; poops.length = 0;
      ev(t, 'resume');
    }
    while (togIdx < toggles.length && toggles[togIdx].t <= t) { needs.set(toggles[togIdx].set); if (toggles[togIdx].set.potty === false) poops.length = 0; ev(t, 'toggle', toggles[togIdx].set); togIdx++; }
    const night = needs.isNight(t);
    if (!out) { if (!night && t >= comeOutAt) { out = true; if (needs.firstOuting(t)) ev(t, 'morning'); ev(t, 'out'); } }
    else if (night && idle > 150 && !act && !poops.length) { out = false; comeOutAt = 0; ev(t, 'home'); }
    const r = needs.tick(t, { idle, out });
    if (r.resumed) { act = null; poops.length = 0; resumeAt = t; ev(t, 'gap-resume'); continue; }

    // "feed now" pressed by her
    while (feedIdx < feedNowAt.length && feedNowAt[feedIdx] <= t) {
      feedIdx++;
      const f = needs.feedNow(t, { idle, out });
      ev(t, 'feedNow', { kind: f.kind });
      if (f.kind === 'full_gag') continue;
      if (f.kind === 'full') { if (act && act.kind === 'meal') continue; act = { kind: 'meal', meal: 'full', by: 'her', slot: f.slot, t0: t, end: t + U(60, 90) * 1000 }; }
      else if (f.kind === 'snack') act = { kind: 'meal', meal: 'snack', by: 'her', slot: -1, t0: t, end: t + U(30, 45) * 1000 };
      else needs.mealDone(t, 'biscuit', 'her', -1), D(t).biscuits++;
    }
    // activities that end now
    let justEnded = false;
    if (act && t >= act.end) {
      justEnded = true;
      if (act.kind === 'meal') {
        needs.mealDone(t, act.meal, act.by, act.slot);
        if (act.meal === 'full') { D(t).meals++; ev(t, 'meal', { by: act.by, slot: act.slot }); if (act.by === 'auto') { if (lastAutoMeal && t - lastAutoMeal < 180 * MIN - 2 * MIN) bad.push('auto meals too close at ' + hhmm(t)); lastAutoMeal = t; } }
        else { D(t).snacks++; ev(t, 'snack'); }
        if (cfg.water !== false) needs.drank(t);
      } else if (act.kind === 'potty') {
        const res = needs.poopDone(act.dog, t, false);
        D(t)[act.dog]++; ev(t, 'poop', { dog: act.dog, lucky: res.lucky });
        if (lastPoop[act.dog] && t - lastPoop[act.dog] < (act.dog === 'dax' ? 150 : 240) * MIN - MIN) bad.push('poops too close for ' + act.dog + ' at ' + hhmm(t));
        lastPoop[act.dog] = t;
        if (night) bad.push('poop at night ' + hhmm(t));
        const p = { dog: act.dog, t0: t, deadline: t + 120000, cleanAt: t + U(6, 25) * 1000, by: 'him' };
        if (R() < 0.10) p.cleanAt += U(10, 60) * 1000;                               // she interrupts the clean-up (throws the ball)
        if (R() < (opts.helpProb || 0) && idle < 60) { p.cleanAt = t + U(3, 15) * 1000; p.by = 'her'; }
        poops.push(p);
      } else if (act.kind === 'water') { needs.drank(t); D(t).water++; ev(t, 'water'); }
      else if (act.kind === 'biscuit') { needs.mealDone(t, 'biscuit', 'auto', -1); D(t).biscuits++; ev(t, 'biscuit'); }
      act = null; busyUntil = t; nextAuto = t + U(35, 90) * 1000;
    }
    // poops on stage: cleaned, or removed by the failsafe at the deadline
    for (let i = poops.length - 1; i >= 0; i--) {
      const p = poops[i];
      if (idle < 60) p.deadline = Math.min(p.deadline, Math.max(p.t0 + 60000, t + 15000));
      if (t >= p.cleanAt || t >= p.deadline) {
        const life = (Math.min(t, Math.max(p.cleanAt, p.t0)) - p.t0) / 1000;
        needs.cleaned(t >= p.cleanAt ? p.by : 'him');
        ev(t, 'clean', { dog: p.dog, by: t >= p.cleanAt ? p.by : 'failsafe', life: Math.round((t - p.t0) / 1000) });
        if (t - p.t0 > 125000) bad.push('poop lived ' + (t - p.t0) / 1000 + ' s');
        poops.splice(i, 1);
      }
    }
    // what may start now
    const quiet = out && !act && !justEnded && t >= busyUntil;
    if (quiet) {
      const onStage = (d) => poops.some((p) => p.dog === d);
      if (r.meal >= 0) {
        if (t - resumeAt < 4 * MIN - 5000) bad.push('meal too soon after resume at ' + hhmm(t));
        if (night || needs.minutesToNight(t) <= 30) bad.push('meal near night at ' + hhmm(t));
        if (idle >= 300) bad.push('meal while away at ' + hhmm(t));
        act = { kind: 'meal', meal: 'full', by: 'auto', slot: r.meal, t0: t, end: t + U(60, 90) * 1000 };
      } else if (r.urge.length && !onStage(r.urge[0])) {
        const dog = r.urge[0];
        if (t - resumeAt < 90000 - 5000) bad.push('potty too soon after resume at ' + hhmm(t));
        if (idle >= 300) bad.push('potty while away at ' + hhmm(t));
        if (needs.minutesToNight(t) <= 30) bad.push('potty near night at ' + hhmm(t));
        act = { kind: 'potty', dog, t0: t, end: t + (dog === 'dax' ? U(9, 14) : U(14, 20)) * 1000 };
      } else if (r.biscuit) act = { kind: 'biscuit', t0: t, end: t + 8000 };
      else if (r.thirsty) act = { kind: 'water', t0: t, end: t + U(25, 40) * 1000 };
      else if (t >= nextAuto && !night) {                                             // an automatic fetch session or another little scene
        busyUntil = t + U(15, 40) * 1000; nextAuto = busyUntil + U(35, 90) * 1000;
        const n = 2 + Math.floor(R() * 3); for (let i = 0; i < n; i++) needs.fetched(R() < 0.6 ? 'dax' : 'gold');
      }
    }
    // caps
    const d = D(t);
    if (d.dax > 3) bad.push('dax over cap on day ' + dayOf(t));
    if (d.gold > 2) bad.push('gold over cap on day ' + dayOf(t));
  }
  return { log, bad, perDay, saved: needs ? needs.save() : saved, needs };
}

function stat(a) { if (!a.length) return 'n/a'; const s = a.slice().sort((x, y) => x - y); const mean = s.reduce((p, c) => p + c, 0) / s.length; return 'min ' + s[0] + ' / mean ' + mean.toFixed(2) + ' / max ' + s[s.length - 1]; }
function count(log, k, f) { return log.filter((e) => e.k === k && (!f || f(e))).length; }
function report(name, runs, pick) {
  const cols = {};
  runs.forEach((r) => { const o = pick(r); for (const k in o) (cols[k] = cols[k] || []).push(o[k]); });
  console.log('\n== ' + name + ' (' + runs.length + ' runs)');
  for (const k in cols) console.log('   ' + k.padEnd(34) + stat(cols[k]));
  const bad = [].concat(...runs.map((r) => r.bad));
  console.log('   invariant violations: ' + bad.length + (bad.length ? '  e.g. ' + bad.slice(0, 3).join(' | ') : ''));
  return bad.length;
}
const basic = (r) => ({
  'full meals': count(r.log, 'meal'), 'biscuits': count(r.log, 'biscuit'), 'poops dax': count(r.log, 'poop', (e) => e.dog === 'dax'),
  'poops gold': count(r.log, 'poop', (e) => e.dog === 'gold'), 'water breaks': count(r.log, 'water'),
});
const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);
let totalBad = 0;

// A. One whole day, always present, from a state saved the evening before (so the morning rule applies)
function priorState(seed) { return run({ seed, start: at(-1, 8), end: at(-1, 23, 59), }).saved; }
totalBad += report('A. whole day 07:00-24:00, she is present all day', SEEDS.map((s) => run({ seed: s, saved: priorState(s), start: at(0, 7), end: at(1, 0) })), (r) => Object.assign(basic(r), {
  'first poop gold (min after 07:00)': Math.round(((r.log.find((e) => e.k === 'poop' && e.dog === 'gold') || { t: NaN }).t - at(0, 7)) / MIN),
  'first meal (min after 08:00)': Math.round(((r.log.find((e) => e.k === 'meal') || { t: NaN }).t - at(0, 8)) / MIN),
  'dax poop after breakfast (min)': (() => { const m = r.log.find((e) => e.k === 'meal'), p = r.log.find((e) => e.k === 'poop' && e.dog === 'dax' && m && e.t > m.t); return m && p ? Math.round((p.t - m.t) / MIN) : -1; })(),
  'gold poop after dinner (min)': (() => { const ms = r.log.filter((e) => e.k === 'meal'), m = ms[1], p = r.log.find((e) => e.k === 'poop' && e.dog === 'gold' && m && e.t > m.t); return m && p ? Math.round((p.t - m.t) / MIN) : -1; })(),
}));

// B. Eight hours, 09:00-17:00, first run ever (fresh install)
totalBad += report('B. first run ever, 09:00-17:00, present', SEEDS.map((s) => run({ seed: s, start: at(0, 9), end: at(0, 17) })), (r) => Object.assign(basic(r), {
  'first meal (min after start)': Math.round(((r.log.find((e) => e.k === 'meal') || { t: NaN }).t - at(0, 9)) / MIN),
  'first poop (min after start)': Math.round(((r.log.find((e) => e.k === 'poop') || { t: NaN }).t - at(0, 9)) / MIN),
}));

// B2. Eight hours on a normal day (state from the day before), 09:00-17:00 and 12:00-20:00
totalBad += report('B2. normal day, 09:00-17:00, present', SEEDS.map((s) => run({ seed: s, saved: priorState(s), start: at(0, 9), end: at(0, 17) })), basic);
totalBad += report('B3. normal day, 12:00-20:00, present', SEEDS.map((s) => run({ seed: s, saved: priorState(s), start: at(0, 12), end: at(0, 20) })), basic);

// C. One 3-hour session a day at a random time, 30 days; the app is closed otherwise
function sessions(seed, days, perDayFn) {
  const R = rnd(seed + 99), wins = [];
  for (let d = 0; d < days; d++) perDayFn(d, R).forEach((w) => wins.push(w));
  return wins;
}
function sessionStats(r, wins) {
  const m = [], p = [], firstMeal = [], total = [];
  wins.forEach(([a, b]) => {
    const inWin = r.log.filter((e) => e.t >= a && e.t < b);
    m.push(count(inWin, 'meal')); p.push(count(inWin, 'poop')); total.push(count(inWin, 'meal') + count(inWin, 'poop') + count(inWin, 'biscuit'));
    const fm = inWin.find((e) => e.k === 'meal'); if (fm) firstMeal.push(Math.round((fm.t - a) / MIN));
  });
  return { m, p, firstMeal, total };
}
{
  const all = { m: [], p: [], firstMeal: [], zeroMeal: 0, n: 0 }; let bad = 0;
  for (const s of SEEDS.slice(0, 40)) {
    const wins = sessions(s, 30, (d, R) => { const h = 8 + R() * 12; return [[at(d, 0) + h * HOUR, at(d, 0) + (h + 3) * HOUR]]; });
    const r = run({ seed: s, start: wins[0][0], end: wins[wins.length - 1][1], running: (t) => wins.some(([a, b]) => t >= a && t < b) });
    const st = sessionStats(r, wins); all.m.push(...st.m); all.p.push(...st.p); all.firstMeal.push(...st.firstMeal); all.n += wins.length; all.zeroMeal += st.m.filter((x) => x === 0).length; bad += r.bad.length;
    if (r.bad.length && bad < 6) console.log('   C bad:', r.bad.slice(0, 3));
  }
  console.log('\n== C. one 3-hour session a day at a random hour (start 08:00-20:00), 40 x 30 days');
  console.log('   full meals per session            ' + stat(all.m) + '   sessions with no meal: ' + (100 * all.zeroMeal / all.n).toFixed(1) + ' %');
  console.log('   poops per session (both dogs)     ' + stat(all.p));
  const hist = {}; all.p.forEach((x) => hist[x] = (hist[x] || 0) + 1); console.log('   poops per session histogram       ' + JSON.stringify(hist));
  const hm = {}; all.m.forEach((x) => hm[x] = (hm[x] || 0) + 1); console.log('   meals per session histogram       ' + JSON.stringify(hm));
  console.log('   first meal, minutes into session  ' + stat(all.firstMeal));
  console.log('   invariant violations: ' + bad); totalBad += bad;
}
// D. Two sessions a day: morning 1.5 h (start 07:30-09:30) and evening 2.5 h (start 19:00-21:00)
{
  const mm = [], pm = [], me = [], pe = []; let bad = 0;
  for (const s of SEEDS.slice(0, 40)) {
    const wins = sessions(s, 30, (d, R) => { const a = 7.5 + R() * 2, b = 19 + R() * 2; return [[at(d, 0) + a * HOUR, at(d, 0) + (a + 1.5) * HOUR], [at(d, 0) + b * HOUR, at(d, 0) + (b + 2.5) * HOUR]]; });
    const r = run({ seed: s, start: wins[0][0], end: wins[wins.length - 1][1], running: (t) => wins.some(([a, b]) => t >= a && t < b) });
    wins.forEach(([a, b], i) => { const w = r.log.filter((e) => e.t >= a && e.t < b); (i % 2 ? me : mm).push(count(w, 'meal')); (i % 2 ? pe : pm).push(count(w, 'poop')); });
    bad += r.bad.length;
  }
  console.log('\n== D. two sessions a day (morning 1.5 h, evening 2.5 h), 40 x 30 days');
  console.log('   morning: meals ' + stat(mm) + ' ; poops ' + stat(pm));
  console.log('   evening: meals ' + stat(me) + ' ; poops ' + stat(pe));
  console.log('   invariant violations: ' + bad); totalBad += bad;
}
// E. Open all day for 14 days with away periods and lid-closed periods
{
  let bad = 0; const perDayMeals = [], perDayDax = [], perDayGold = [], away = [];
  for (const s of SEEDS.slice(0, 40)) {
    const R = rnd(s + 5), aw = [], sl = [];
    for (let d = 0; d < 14; d++) {
      for (let i = 0; i < 5; i++) { const a = at(d, 8) + R() * 15 * HOUR; aw.push([a, a + (5 + R() * 85) * MIN]); }
      for (let i = 0; i < 2; i++) { const a = at(d, 9) + R() * 13 * HOUR; sl.push([a, a + (10 + R() * 110) * MIN]); }
    }
    const idle = (t) => { for (const [a, b] of aw) if (t >= a && t < b) return (t - a) / 1000 + 1; return 20; };
    const r = run({ seed: s, start: at(0, 7), end: at(14, 0), idle, running: (t) => !sl.some(([a, b]) => t >= a && t < b), helpProb: 0.2 });
    for (let d = 0; d < 14; d++) { const x = r.perDay[d] || { meals: 0, dax: 0, gold: 0 }; perDayMeals.push(x.meals); perDayDax.push(x.dax); perDayGold.push(x.gold); }
    bad += r.bad.length; if (r.bad.length) console.log('   E bad:', r.bad.slice(0, 3));
  }
  console.log('\n== E. open all day, 5 away periods (5-90 min) and 2 lid-closed periods (10-120 min) a day, 40 x 14 days');
  console.log('   full meals per day   ' + stat(perDayMeals));
  console.log('   poops per day, dax   ' + stat(perDayDax));
  console.log('   poops per day, gold  ' + stat(perDayGold));
  console.log('   invariant violations: ' + bad); totalBad += bad;
}
// F. Closed for three days, then opened at 10:00
totalBad += report('F. closed for 3 days, opened at 10:00, first 60 minutes', SEEDS.map((s) => run({ seed: s, saved: priorState(s), start: at(3, 10), end: at(3, 11) })), (r) => Object.assign(basic(r), {
  'events in the first 90 s': r.log.filter((e) => (e.k === 'meal' || e.k === 'poop') && e.t < at(3, 10) + 90000).length,
  'meals in the first 15 min': r.log.filter((e) => e.k === 'meal' && e.t < at(3, 10) + 15 * MIN).length,
}));
// G. Toggles
totalBad += report('G1. automatic feeding off, whole day', SEEDS.slice(0, 60).map((s) => run({ seed: s, saved: priorState(s), start: at(0, 7), end: at(1, 0), cfg: { feeding: false } })), basic);
totalBad += report('G2. potty off, whole day', SEEDS.slice(0, 60).map((s) => run({ seed: s, saved: priorState(s), start: at(0, 7), end: at(1, 0), cfg: { potty: false } })), basic);
totalBad += report('G3. potty switched off at 12:00, on again at 16:00', SEEDS.slice(0, 60).map((s) => run({ seed: s, saved: priorState(s), start: at(0, 7), end: at(1, 0), toggles: [{ t: at(0, 12), set: { potty: false } }, { t: at(0, 16), set: { potty: true } }] })), (r) => Object.assign(basic(r), {
  'poops between 12:00 and 16:00': r.log.filter((e) => e.k === 'poop' && e.t >= at(0, 12) && e.t < at(0, 16)).length,
}));
// H. Night owl: 21:00-02:00, she stays active
totalBad += report('H. 21:00-02:00, active the whole time', SEEDS.slice(0, 60).map((s) => run({ seed: s, saved: priorState(s), start: at(0, 21), end: at(1, 2) })), (r) => Object.assign(basic(r), {
  'care events after 23:30': r.log.filter((e) => (e.k === 'meal' || e.k === 'poop' || e.k === 'biscuit') && e.t >= at(0, 23, 30)).length,
}));
// I. "Feed now" pressed every 10 minutes all afternoon
totalBad += report('I. feed now every 10 min from 12:00 to 18:00', SEEDS.slice(0, 60).map((s) => run({ seed: s, saved: priorState(s), start: at(0, 7), end: at(1, 0), feedNowAt: Array.from({ length: 36 }, (_, i) => at(0, 12) + i * 10 * MIN) })), (r) => Object.assign(basic(r), {
  'feedNow -> full': count(r.log, 'feedNow', (e) => e.kind === 'full'), 'feedNow -> snack': count(r.log, 'feedNow', (e) => e.kind === 'snack'),
  'feedNow -> biscuit': count(r.log, 'feedNow', (e) => e.kind === 'biscuit'), 'feedNow -> full_gag': count(r.log, 'feedNow', (e) => e.kind === 'full_gag'),
}));
// J. Save / load round trip and determinism
{
  let bad = 0;
  for (const s of SEEDS.slice(0, 50)) {
    const a = run({ seed: s, saved: priorState(s), start: at(0, 7), end: at(0, 13) });
    const n1 = N.create({}, 1, UTC), n2 = N.create({}, 2, UTC);
    n1.load(a.saved, at(0, 13)); const j1 = n1.save(); n2.load(j1, at(0, 13)); const j2 = n2.save();
    const o1 = JSON.parse(j1), o2 = JSON.parse(j2);
    ['quietMeal', 'quietPotty', 'seed'].forEach((k) => { delete o1[k]; delete o2[k]; });   // resume() draws new quiet times: expected to differ
    if (JSON.stringify(o1) !== JSON.stringify(o2)) bad++;
    const b = run({ seed: s, saved: priorState(s), start: at(0, 7), end: at(0, 13) });
    if (JSON.stringify(a.log) !== JSON.stringify(b.log)) bad++;
  }
  console.log('\n== J. save/load round trip and same-seed determinism: ' + (bad ? bad + ' mismatches' : 'ok')); totalBad += bad;
}
// K. Clock anomalies: the clock jumps back 2 h at 13:00 (time-zone change) and forward 26 h on another run
{
  let bad = 0;
  for (const s of SEEDS.slice(0, 60)) {
    for (const jump of [-2 * HOUR, 26 * HOUR, 9 * HOUR]) {
      const first = run({ seed: s, saved: priorState(s), start: at(0, 7), end: at(0, 13) });
      const second = run({ seed: s, saved: first.saved, start: at(0, 13) + jump, end: at(0, 13) + jump + 10 * HOUR });
      bad += second.bad.length;
      const st = JSON.parse(second.saved);
      for (const d of ['dax', 'gold']) for (const k of ['full', 'bowel', 'thirst']) { const v = st.dogs[d][k]; if (!(v >= 0 && v <= 1.5)) bad++; }
      if (jump < 0) { const m = second.log.filter((e) => e.k === 'meal'); const lastFirst = first.log.filter((e) => e.k === 'meal').pop(); if (m.length && lastFirst && m[0].t + (-jump) - lastFirst.t < 180 * MIN - 2 * MIN) bad++; }
    }
  }
  console.log('== K. clock jumps (-2 h, +9 h, +26 h): ' + (bad ? bad + ' problems' : 'ok')); totalBad += bad;
}
console.log('\nTOTAL invariant violations (model): ' + totalBad);
  modelBad = totalBad;
// One sample day, for the document
{
  const r = run({ seed: 7, saved: priorState(7), start: at(0, 7), end: at(1, 0), helpProb: 0.3 });
  console.log('\nSample day (seed 7):');
  r.log.filter((e) => ['morning', 'meal', 'poop', 'clean', 'biscuit', 'water', 'home'].includes(e.k)).forEach((e) => console.log('   ' + e.at.slice(3) + '  ' + e.k + (e.dog ? ' ' + e.dog : '') + (e.by ? ' by ' + e.by : '') + (e.life !== undefined ? ' after ' + e.life + ' s' : '') + (e.lucky ? ' LUCKY' : '')));
}

}

// ================================================================
//  第二部分：真的引擎。拨钟、模拟她（鼠标、在不在、丢球、点、关开关），每一步查 R6 第 6 节能查的那几条
// ================================================================
function enginePart() {
  const PACKS = fs.existsSync(path.join(WEB, 'scenes')) ? fs.readdirSync(path.join(WEB, 'scenes')).filter(f => /\.js$/.test(f)).sort().map(f => 'scenes/' + f) : [];
  const FILES = ['config.js', 'sprites.js', 'fx.js', 'dogs.js', 'person.js', 'lawn.js', 'needs.js', 'pet.js'].concat(PACKS);
  const hyp = (x, y) => Math.sqrt(x * x + y * y);
  // R6 3.1 里和场面无关的几条（自己再实现一遍，独立核对）：P1 两边、P2 不贴边、P3 下半屏 / 底线、P5 离岛远、P7 狗站得下、P8 不在屏幕正中
  function staticRule(kind, x, y, F, view, strip, island) {
    const Wf = F.x1 - F.x0, Hf = F.y1 - F.y0, side = 0.28 * Wf, half = kind === 'gold' ? 23 : 20;
    if (x < F.x0 + 16 || x > F.x1 - 16) return 'P2';
    const left = x <= F.x0 + side, right = x >= F.x1 - side;
    if (!left && !right) return 'P1';
    if (strip) { if (Math.abs(y - F.y1) > 0.6) return 'P3 strip'; } else if (y < F.y0 + 0.5 * Hf - 0.6 || y > F.y1 - 5.4) return 'P3';
    if (island && hyp(x - island[0], y - island[1]) < Math.min(100, 0.3 * Wf) - 0.5) return 'P5';
    const cx = x + (left ? 1 : -1) * 9;
    if (cx < F.x0 + half + 1 || cx > F.x1 - half - 1) return 'P7';
    if (!strip && Math.abs(x - view.w / 2) <= 0.22 * view.w && Math.abs(y - view.h / 2) <= 0.22 * view.h) return 'P8';
    return '';
  }
  function scenario(roam, seed) {
    const bad = [], note = (m) => { if (bad.length < 12) bad.push(m); };
    const ctx = vm.createContext((vm.constants && vm.constants.DONT_CONTEXTIFY) || {});
    vm.runInContext('delete globalThis.console; var __s = ' + (seed >>> 0) + '; Math.random = function () { __s = (__s + 0x6D2B79F5) >>> 0; var t = Math.imul(__s ^ (__s >>> 15), 1 | __s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };', ctx);
    for (const f of FILES) { const p = path.join(WEB, f); if (fs.existsSync(p)) { try { vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); } catch (e) { note('loading ' + f + ': ' + e.message); } } }
    const G = vm.runInContext('globalThis', ctx);
    let clock = 0;
    const store = {}, view = roam ? { w: 504, h: 327 } : { w: 480, h: 110 }, insets = roam ? { top: 13, bottom: 24, left: 0, right: 0 } : { top: 0, bottom: 0, left: 0, right: 0 };
    const host = { now: () => clock, storage: { get: k => (k in store ? store[k] : null), set: (k, v) => { store[k] = String(v); } },
                   island: roam ? { center: () => view.w / 2, visible: () => true, hit: (x, y) => y < 16 && Math.abs(x - view.w / 2) < 40 } : null, log: m => note('engine log: ' + m) };
    const eng = G.PET_ENGINE.create(host, Object.assign({}, G.PET_CONFIG, { roam, res: 1, entrance: false, grass: !roam }));
    eng.configure({ view, insets });
    const T = eng._t, C = T.care;
    if (!C || !C.clock) { note('no care hooks'); return { bad, stats: {} }; }
    const R = rnd(seed * 31 + 7), U = (a, b) => a + R() * (b - a);
    const t0 = new Date(2027, 2, 1, 7, 55, 0).getTime();       // 本地时间早上 7:55（8:00 开早饭）
    C.clock(t0);
    T.set('touch', 0);
    const dt = 1 / 60, total = 2 * 3600;
    let idle = 5, cx = null, cy = null, cursorSet = 0, sweep = null, restT = 0, meals0 = 0, jumpAt = 5400, jumped = false, quietUntil = -1, potOffAt = 3600;
    const seenPoop = new Map(), scriptSince = new Map();
    const stats = { meals: 0, poops: 0, hotShown: 0, clicks: 0, failsafe: 0, forced: 0, sweeps: 0 };
    let lastLog = 0;
    for (let i = 0; i < total * 60; i++) {
      clock += dt;
      const now = T.state().now;
      // 她：多数时候在用电脑；鼠标隔一阵换个地方，偶尔停在便便上，偶尔很快地扫过去
      if (R() < dt / 15) { idle = R() < 0.15 ? U(60, 200) : U(0, 20); eng.sense({ idle }); }
      if (sweep) {
        sweep.k += dt * 300 / Math.max(1, sweep.len);
        if (sweep.k >= 1) sweep = null; else { cx = sweep.x0 + (sweep.x1 - sweep.x0) * sweep.k; cy = sweep.y; eng.sense({ cursor: [cx, cy] }); }
      } else if (R() < dt / 12) {
        const ps = C.props().filter(p => p.kind === 'poop');
        if (ps.length && R() < 0.5) {
          const p = ps[0];
          if (R() < 0.5) { cx = p.x; cy = p.y - 3; restT = 0; eng.sense({ cursor: [cx, cy] }); }
          else { sweep = { x0: p.x - 60, x1: p.x + 60, y: p.y - 3, k: 0, len: 120 }; stats.sweeps++; }
        } else { cx = U(0, view.w); cy = U(0, view.h); eng.sense({ cursor: [cx, cy] }); }
      }
      // 偶尔丢球、点狗、强制一次上厕所
      if (R() < dt / 300) { const b = T.boxes(); if (b.ball) { const m = [(b.ball[0] + b.ball[2]) / 2, (b.ball[1] + b.ball[3]) / 2]; eng.pointer('down', m[0], m[1]); eng.pointer('move', m[0] + 30, m[1] - 10); eng.pointer('up', 0, 0); } }
      if (R() < dt / 240) { const b = T.boxes(), w = R() < 0.5 ? b.dax : b.gold; if (w) { eng.pointer('down', (w[0] + w[2]) / 2, (w[1] + w[3]) / 2); eng.pointer('up', 0, 0); } }
      // （刚醒的 90 秒里不强制：那段时间什么都不该开始，测试自己也不去捣乱）
      if (R() < dt / 200 && !(quietUntil > now)) { if (C.force(R() < 0.5 ? 'poop:dax' : 'poop:gold')) stats.forced++; }
      // T13：一小时的时候把"拉粑粑"关掉 30 秒
      if (now >= potOffAt && potOffAt > 0) {
        const had = C.props().filter(p => p.kind === 'poop').length;
        eng.configure({ potty: false });
        eng.step(dt);
        if (C.props().filter(p => p.kind === 'poop').length) note('T13: a poop is still on stage after potty was switched off (had ' + had + ')');
        if (T.state().scripts.some(n => /^potty/.test(n))) note('T13: a potty routine still runs after potty was switched off');
        potOffAt = -now - 30;
      } else if (potOffAt < 0 && now >= -potOffAt) { eng.configure({ potty: true }); potOffAt = 0; }
      // T7：一个半小时的时候（最好在饭吃到一半）电脑睡 5 分钟
      if (!jumped && now >= jumpAt && (T.state().scripts.includes('care_meal') || C.props().length || now > jumpAt + 1200)) {
        jumped = true;
        meals0 = eng.status().care.meals;
        const busyMeal = T.state().scripts.includes('care_meal');
        C.clock(t0 + now * 1000 + 300000, true);
        eng.step(dt); const fr = eng.compose();
        if (fr.items.some(it => /^prop:/.test(it.id) && C.props().length)) note('T7: care props on the first frame after wake');
        if (C.props().length) note('T7: care props remain after wake');
        // 球在他手里（她正在玩、或者他正在演一段别的戏、球收在口袋里也行：那段戏一完就回手里）
        const bs = T.state().ball.st, ps0 = T.state().person.scene;
        if (bs !== 'hand' && bs !== 'free' && bs !== 'drag' && !(bs === 'pocket' && ps0 && !/^(care|potty|cleanup)/.test(ps0))) note('T7: the ball is not in his hand after wake (' + bs + ')');
        if (busyMeal && eng.status().care.meals !== meals0 + 1) note('T7: the interrupted meal was counted ' + (eng.status().care.meals - meals0) + ' times');
        quietUntil = now + 90;
      }
      eng.step(dt);
      const fr = (i % 2 === 0) ? eng.compose() : null;
      const st = T.state(), F = st.F, ps = C.props();
      // T8：便便活不过 120 秒；她在用电脑时活不过 max(出现后 60 秒, 她回来后 15 秒)
      for (const p of ps) {
        if (p.kind === 'poop') {
          if (p.age > 121) note('T8: a poop lived ' + p.age.toFixed(1) + ' s');
          if (!seenPoop.has(p.id)) {
            seenPoop.set(p.id, now); stats.poops++;
            const r = staticRule(p.dog, p.x, p.y, F, { w: st.LW, h: st.LH }, !roam, roam ? [view.w / 2, F.y0] : null);
            if (r) note('T9/T18: a poop broke rule ' + r + ' at (' + p.x.toFixed(1) + ', ' + p.y.toFixed(1) + ')');
            if (quietUntil > now) note('T7: a poop appeared within 90 s of waking');
          }
        } else if (/^bowl_water/.test(p.kind)) { if (p.age > 46) note('T11: the water bowl stayed ' + p.age.toFixed(1) + ' s'); }
        else if (/^bowl/.test(p.kind)) { if (p.age > 151) note('T11: a bowl stayed ' + p.age.toFixed(1) + ' s'); }
      }
      // T11：照料的戏都在时限里演完
      for (const n of st.scripts) { if (!scriptSince.has(n)) scriptSince.set(n, now); else if (/^(care|potty|cleanup)/.test(n) && now - scriptSince.get(n) > (n === 'care_meal' ? 111 : 46)) { note('T11: ' + n + ' ran ' + (now - scriptSince.get(n)).toFixed(0) + ' s'); scriptSince.set(n, now); } }
      for (const n of Array.from(scriptSince.keys())) if (!st.scripts.includes(n)) scriptSince.delete(n);
      // T16：便便能点的范围只在鼠标停够 0.25 秒以后才出现；前四个永远是球、金毛、小人、小腊肠
      if (fr) {
        const poopIn = ps.filter(p => p.kind === 'poop' && cx !== null && Math.abs(cx - p.x) <= 4.5 && Math.abs(cy - (p.y - 3)) <= 5);
        restT = poopIn.length && !sweep ? restT + 2 * dt : 0;
        const extra = fr.hot.length - ((T.boxes().ball ? 1 : 0) + ['dax', 'gold', 'person'].filter(k => !st[k === 'person' ? 'person' : k].hidden).length);
        if (extra > 0) { stats.hotShown++; if (!poopIn.length && !ps.some(p => p.live)) note('T16: a prop rect is hot without the cursor on it'); if (sweep) note('T16: a sweeping cursor made a poop hot'); }
        if (extra > 0 && restT < 0.2) note('T16: a poop became hot after only ' + restT.toFixed(2) + ' s of dwell');
        // 停够了偶尔点一下（她自己收拾）
        if (extra > 0 && R() < 0.02) { eng.pointer('down', cx, cy); eng.pointer('up', 0, 0); stats.clicks++; }
      }
      // T17：谁都不站在便便上，球也不停在上面
      for (const p of ps) {
        if (p.kind !== 'poop' || now - seenPoop.get(p.id) < 0.5) continue;
        for (const k of ['dax', 'gold', 'person']) { const a = st[k]; if (!a.hidden && (a.z || 0) === 0 && hyp(a.x - p.x, a.y - p.y) < 8 - 0.01) note('T17: ' + k + ' stood ' + hyp(a.x - p.x, a.y - p.y).toFixed(1) + ' wu from a poop (' + a.st + '/' + (a.pose || '') + '/' + (a.scene || '') + ')'); }
        if (st.ball.st === 'free' && st.ball.z <= 4.5 && hyp(st.ball.x - p.x, st.ball.y - p.y) < 8 - 0.01) note('T17: the ball lies on a poop');
      }
      const lg = C.log();
      for (let k = lastLog; k < lg.length; k++) { if (lg[k].k === 'meal') stats.meals++; if (lg[k].k === 'failsafe') stats.failsafe++; if (lg[k].k === 'start' && quietUntil > now && lg[k].role !== 'cleanup' && lg[k].role !== 'herclean' && lg[k].role !== 'morning') note('T7: care scene ' + lg[k].role + ' started within 90 s of waking'); }
      lastLog = lg.length;
      for (const k of ['dax', 'gold', 'person']) if (!Number.isFinite(st[k].x) || !Number.isFinite(st[k].y)) note(k + ' position is not finite');
      if (bad.length >= 12) break;
    }
    // T10：夜里。23:20 起 20 分钟：23:30 以后不开始新的照料；睡下以后台上什么都没有
    const n0 = T.state().now;
    C.clock(new Date(2027, 2, 1, 23, 20, 0).getTime());
    eng.step(dt);
    const startLog = C.log().length;
    for (let i = 0; i < 20 * 60 * 60; i++) { clock += dt; eng.sense({ idle: 400 }); eng.step(dt); if (i % 4 === 0) eng.compose(); }
    const late = C.log().slice(startLog).filter(e => e.k === 'start' && e.role !== 'cleanup' && e.role !== 'herclean' && e.t >= new Date(2027, 2, 1, 23, 30, 0).getTime());
    if (late.length) note('T10: ' + late.length + ' care scene(s) started after 23:30: ' + late.map(e => e.role).join(','));
    C.clock(new Date(2027, 2, 2, 1, 0, 0).getTime());
    for (let i = 0; i < 400 * 60; i++) { clock += dt; eng.sense({ idle: 900 }); eng.step(dt); if (i % 4 === 0) eng.compose(); }
    if (C.props().length) note('T10: care props on stage at 01:00 while they sleep');
    for (const m of T.sceneErrors()) note('scene error: ' + m);
    stats.status = eng.status().care;
    stats.log = C.log().filter(e => /meal|poop|water|biscuit|herclean|failsafe|cleaned|abort|nodrop|giveup/.test(e.k)).length;
    return { bad, stats };
  }
  const seeds = (process.env.SEEDS || '1,2').split(',').map(Number);
  console.log('\n== engine: 2 simulated hours from 07:55 per run (breakfast, forced potty breaks, her cursor and clicks, potty off for 30 s, a 5-minute sleep), then the night');
  for (const roam of [true, false]) for (const s of seeds) {
    const t0 = Date.now(), r = scenario(roam, s);
    console.log('   ' + (roam ? 'roam' : 'strip') + ' seed ' + s + ': ' + JSON.stringify(r.stats) + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
    for (const b of r.bad) console.log('     FAIL ' + b);
    engineBad += r.bad.length;
  }
  console.log('   engine invariant violations: ' + engineBad);
}

if (PART === 'all' || PART === 'model') modelPart();
if (PART === 'all' || PART === 'engine') enginePart();
console.log('\nCovered: T1 (A), T2 (B2), T3 (B), T4 (C), T5 (E), T6 (F), T10 (H, engine night), T12 (J), T13 (G, engine toggle), T14 (I), T15 (K) in the model part;');
console.log('         T7, T8, T9, T10, T11 (time-outs, caps), T13, T16, T17, T18 in the engine part. Not covered: T11 fetch-rate ratio, T14 0.3 s answer, T19 cost (see headless.js perf).');
console.log((modelBad + engineBad) ? 'RESULT: FAILED' : 'RESULT: OK');
process.exit((modelBad + engineBad) ? 1 : 0);
