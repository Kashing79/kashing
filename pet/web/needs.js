// 球球 · 吃饭和拉粑粑的"肚子"（照料那一套的账本）
//
// 只算账，不演戏：两只狗饱不饱（full）、多久以后想上厕所（bowel）、渴不渴（thirst），几点该开饭，
// 她不在 / 电脑睡着的时候怎么补算。演戏的是引擎（pet.js 的"照料"那一节）和 scenes/care.js。
// 规矩（为什么这么设计）见 research 里的 R6-care.md 第 1 节；这里是它的参考实现搬过来的。
//
// 纯逻辑：不碰网页、没有定时器、不读 Date.now()——调的人给"墙上的钟"（毫秒）。自己有一个能存下来的随机数。
//
//   var N = PET_NEEDS.create(cfg, seed, clock)   cfg = config.js 里的 care（加上 nightSleep）；clock 可以不给（用本地时间）
//   N.tick(nowMs, { idle, out })   每秒调一次 → { resumed, meal（第几顿，-1 = 没有）, biscuit, urge: ['dax' …], thirsty }
//       idle = 她几秒没动静；out = 它们在外面、醒着
//   N.resume(nowMs)                刚醒 / 刚打开：补算，绝不攒一堆事一起来
//   N.firstOuting(nowMs)           今天头一回出岛（早上那一泡）
//   N.mealDone(nowMs, 'full' | 'snack' | 'biscuit', 'auto' | 'her', 第几顿)
//   N.feedNow(nowMs) → { kind: 'full' | 'snack' | 'biscuit' | 'full_gag' | 'midnight', slot, early }   她说"开饭"时该给什么
//   N.poopDone(dog, nowMs, hidden) → { lucky }      N.pottyGiveUp(dog, nowMs)      N.cleaned('him' | 'her')
//   N.drank(nowMs)    N.fetched(dog)    N.set({ feeding, potty, water })    N.save() → 字符串    N.load(字符串, nowMs)
//   N.state()  账本本身（测试看）
(function (G) {
  'use strict';
  var MIN = 60000, HOUR = 3600000;

  // 一个小随机数：整个状态就是一个整数，能存下来
  function Rng(seed) { this.s = (seed >>> 0) || 1; }
  Rng.prototype.next = function () {
    var a = (this.s = (this.s + 0x6D2B79F5) >>> 0);
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Rng.prototype.range = function (r) { return r[0] + this.next() * (r[1] - r[0]); };

  var DEFAULTS = {
    feeding: true,            // 小人自己按点喂饭
    potty: true,              // 狗会拉粑粑（小人会收拾）
    water: true,              // 吃完饭喝水，玩累了也喝
    lucky: true,              // 很少很少的"狗屎运"
    meals: ['08:00', '18:30'],
    biscuitTime: '15:30',     // 每天一块饼干；null = 没有
    nightSleep: [0, 7],
    tune: {
      presentIdle: 300,           // 秒：少于这么久没动静 = 她在
      activeIdle: 60,             // 秒：少于这么久 = 她正在用电脑
      gapSec: 90,                 // 两次 tick 隔了这么久以上 = 刚才没在跑（补算）
      minGapMin: 180,             // 两顿自动的正餐至少隔多久
      quietMealMin: [4, 10],      // 刚醒 / 刚打开：这么久以内不自动开饭
      quietPottySec: [90, 240],   // 刚醒 / 今天头一回出来：这么久以内不上厕所
      returnPottySec: [60, 240],  // 她走开又回来：这么久以内不上厕所（回来看到的第一件事不能是便便）
      noCareBeforeNightMin: 30,   // 快睡觉的这半小时里不开饭、不上厕所
      biscuitWindowMin: 90,       // 饼干时间过了多久以内还给
      biscuitAfterMealMin: 90,    // 但正餐以后这么久以内不给
      catchUpHours: 8,            // 关着 / 睡着的时间，最多补算这么多小时
      resumeMax: 0.95,            // 补算完 bowel 最多到这里：一打开绝不马上出事
      resumeThirstMax: 0.60,      // 渴也一样
      morningGapHours: 6,         // 早上那一泡：离上一次至少这么久
      snackFull: 0.35, snackBolus: 0.10, biscuitFull: 0.05,
      mealThirst: 0.35, fetchThirst: 0.004,
      waterGapMin: 45, waterCap: 4,
      biscuitPerHour: 3, biscuitPerDay: 8, snackPerDay: 2,
      feedNowSnackAfterMin: 150,  // "开饭"：上一顿正餐这么久以前 = 小份的一顿，不然只给饼干
      earlyMealMin: 45,           // "开饭"：离下一顿不到这么久 = 那一顿提前开
      luckyChance: 0.03, luckyMinDays: 5,
      dog: {
        // 吃完一顿：bolus = mealBolus × bolusVar 里随便一个数，在饭后 transitStartMin 起、transitLenMin 这么久里慢慢加到 bowel 上
        dax:  { fullHours: 4.5, bowelBase: 0.045, mealBolus: 0.75, bolusVar: [0.60, 1.15], transitStartMin: [6, 12],  transitLenMin: [8, 16],
                minPoopGapMin: 150, poopCap: 3, urgeDelaySec: [5, 40],   morningBowel: [0.30, 0.60], thirstBase: 0.10 },
        gold: { fullHours: 6.0, bowelBase: 0.025, mealBolus: 0.60, bolusVar: [0.75, 1.10], transitStartMin: [18, 28], transitLenMin: [15, 25],
                minPoopGapMin: 240, poopCap: 2, urgeDelaySec: [60, 180], morningBowel: [0.90, 1.15], thirstBase: 0.14 },
      },
    },
  };

  function merge(a, b) {
    var o = {}, k;
    for (k in a) o[k] = a[k];
    for (k in (b || {})) {
      if (b[k] === undefined) continue;
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) o[k] = merge(a[k], b[k]);
      else o[k] = b[k];
    }
    return o;
  }
  function hm(s) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return m ? (+m[1]) * 60 + (+m[2]) : -1; }

  // clock.parts(ms) → { y, mo, d, h, mi }（本地时间）。不给就用这台电脑的时区
  var LOCAL = { parts: function (ms) { var d = new Date(ms); return { y: d.getFullYear(), mo: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), mi: d.getMinutes() }; } };

  function create(userCfg, seed, clock) {
    var cfg = merge(DEFAULTS, userCfg || {}), T = cfg.tune;
    clock = clock || LOCAL;
    var rng = new Rng(seed || 12345);
    var DOGS = ['dax', 'gold'];

    function parts(ms) { return clock.parts(ms); }
    function dayKey(ms) { var p = parts(ms); return p.y + '-' + p.mo + '-' + p.d; }
    function minOfDay(ms) { var p = parts(ms); return p.h * 60 + p.mi; }
    function isNight(ms) {
      var n = cfg.nightSleep; if (!n || n.length !== 2) return false;
      var h = parts(ms).h;
      return n[0] <= n[1] ? (h >= n[0] && h < n[1]) : (h >= n[0] || h < n[1]);
    }
    function minutesToNight(ms) {
      var n = cfg.nightSleep; if (!n || n.length !== 2) return Infinity;
      if (isNight(ms)) return 0;
      var m = minOfDay(ms), s = (n[0] % 24) * 60, d = s - m;
      return d > 0 ? d : d + 1440;
    }
    // 饭点（一天里的第几分钟，从早到晚）；落在夜里、或者离睡觉太近的不算
    var slots = (cfg.meals || []).map(hm).filter(function (m) { return m >= 0; }).sort(function (a, b) { return a - b; }).slice(0, 3);
    slots = slots.filter(function (m) {
      var n = cfg.nightSleep; if (!n || n.length !== 2) return true;
      var h = m / 60, inNight = n[0] <= n[1] ? (h >= n[0] && h < n[1]) : (h >= n[0] || h < n[1]);
      var toNight = ((n[0] % 24) * 60 - m + 1440) % 1440 || 1440;
      return !inNight && toNight > T.noCareBeforeNightMin + 15;
    });
    var biscuitMin = cfg.biscuitTime ? hm(cfg.biscuitTime) : -1;

    // 头一回打开：半饱，不急；第一泡在第一顿饭以后
    function freshDog(name) { return { full: 0.5, bowel: name === 'gold' ? 0.45 : 0.30, thirst: 0.3, lastPoop: 0, poops: 0, bolus: null, urgeAt: 0 }; }
    function freshStats(day) { return { day: day, meals: 0, snacks: 0, biscuits: 0, fedByHer: 0, poops: 0, byHim: 0, byHer: 0, water: 0, lucky: false }; }
    var S = null;
    function init(now) {
      // morningDay = 今天：头一回打开的那天不来"早上那一泡"
      S = { v: 1, t: now, day: dayKey(now), served: {}, lastMeal: 0, biscuitDay: '', morningDay: dayKey(now), quietMeal: 0, quietPotty: 0,
            away: false, lastWater: 0, waterToday: 0, snacksToday: 0, biscuits: [], luckyDayNo: -999,
            dogs: { dax: freshDog('dax'), gold: freshDog('gold') }, stats: freshStats(dayKey(now)), seed: rng.s };
    }
    function rollDay(now) {
      var k = dayKey(now);
      if (k === S.day) return false;
      S.day = k; S.served = {}; S.waterToday = 0; S.snacksToday = 0;
      DOGS.forEach(function (d) { S.dogs[d].poops = 0; });
      S.stats = freshStats(k);
      return true;
    }
    function nonNightHours(from, to) {       // [from, to] 里不是夜里的小时数（每 5 分钟看一次）
      var h = 0, step = 5 * MIN;
      for (var t = from; t < to; t += step) if (!isNight(t)) h += Math.min(step, to - t) / HOUR;
      return h;
    }
    // 从 S.t 算到 now。growHours = 这段时间里 bowel / thirst 自己长多少小时（调的人已经封过顶）
    function advance(now, growHours) {
      var dt = Math.max(0, now - S.t), dh = dt / HOUR;
      DOGS.forEach(function (name) {
        var d = S.dogs[name], K = T.dog[name];
        d.full = Math.max(0, d.full - dh / K.fullHours);
        if (d.bolus) {
          var b = d.bolus, a0 = Math.max(S.t, b.t0), a1 = Math.min(now, b.t1);
          if (a1 > a0) d.bowel += b.amt * (a1 - a0) / (b.t1 - b.t0);
          if (now >= b.t1) d.bolus = null;
        }
        d.bowel += K.bowelBase * growHours;
        d.thirst += K.thirstBase * growHours;
        if (!cfg.potty) { d.bowel = 0; d.urgeAt = 0; }
        if (d.poops >= K.poopCap) d.bowel = Math.min(d.bowel, 0.9);
        d.bowel = Math.min(d.bowel, 1.5); d.thirst = Math.min(d.thirst, 1.5);
      });
      S.t = now;
    }
    // 刚才没在跑（关着、睡着、锁屏、藏起来）：补算，但绝不攒一堆事
    function resume(now) {
      if (!S) { init(now); }
      var gap = Math.max(0, now - S.t);
      var from = now - Math.min(gap, T.catchUpHours * HOUR);
      advance(now, nonNightHours(from, now));
      rollDay(now);
      DOGS.forEach(function (name) {
        var d = S.dogs[name];
        d.bowel = Math.min(d.bowel, T.resumeMax); d.thirst = Math.min(d.thirst, T.resumeThirstMax); d.urgeAt = 0;
      });
      S.quietMeal = now + rng.range(T.quietMealMin) * MIN;
      S.quietPotty = now + rng.range(T.quietPottySec) * 1000;
      S.away = false;
      S.seed = rng.s;
    }
    function pendingSlot(now) {
      var m = minOfDay(now), best = -1;
      for (var i = 0; i < slots.length; i++) if (slots[i] <= m && !S.served[i]) best = i;
      return best;
    }
    function nextSlotWithin(now, minutes) {
      var m = minOfDay(now);
      for (var i = 0; i < slots.length; i++) if (!S.served[i] && slots[i] > m && slots[i] - m <= minutes) return i;
      return -1;
    }
    function urgeOK(name, now, env) {
      var d = S.dogs[name], K = T.dog[name];
      return cfg.potty && d.bowel >= 1 && !isNight(now) && minutesToNight(now) > T.noCareBeforeNightMin &&
             d.poops < K.poopCap && (d.lastPoop === 0 || now - d.lastPoop >= K.minPoopGapMin * MIN) && !!env.out;
    }

    // env: { idle: 她几秒没动静, out: 它们在外面、醒着 }
    // 返回这会儿可以开始的事：{ resumed, meal: 第几顿（-1 没有）, biscuit, urge: [狗的名字], thirsty }
    function tick(now, env) {
      var out = { resumed: false, meal: -1, biscuit: false, urge: [], thirsty: false };
      if (!S) { init(now); resume(now); out.resumed = true; return out; }
      if (now - S.t > T.gapSec * 1000 || now < S.t - 1000) { if (now < S.t) S.t = now; resume(now); out.resumed = true; return out; }
      var night = isNight(now);
      advance(now, night ? 0 : Math.max(0, now - S.t) / HOUR);
      rollDay(now);
      var present = env.idle < T.presentIdle;
      if (!present) S.away = true;
      else if (S.away) { S.away = false; S.quietPotty = Math.max(S.quietPotty, now + rng.range(T.returnPottySec) * 1000); }
      var lateOK = !night && minutesToNight(now) > T.noCareBeforeNightMin;
      // 正餐
      if (cfg.feeding && lateOK && present && env.out && now >= S.quietMeal && (S.lastMeal === 0 || now - S.lastMeal >= T.minGapMin * MIN)) {
        out.meal = pendingSlot(now);
      }
      // 每天一块饼干
      if (cfg.feeding && biscuitMin >= 0 && S.biscuitDay !== S.day && out.meal < 0 && lateOK && present && env.out && now >= S.quietMeal) {
        var m = minOfDay(now);
        if (m >= biscuitMin && m <= biscuitMin + T.biscuitWindowMin && pendingSlot(now) < 0 &&
            (S.lastMeal === 0 || now - S.lastMeal >= T.biscuitAfterMealMin * MIN)) out.biscuit = true;
      }
      // 上厕所
      DOGS.forEach(function (name) {
        var d = S.dogs[name];
        if (urgeOK(name, now, env)) {
          if (!d.urgeAt) d.urgeAt = now + rng.range(T.dog[name].urgeDelaySec) * 1000;
          if (present && now >= d.urgeAt && now >= S.quietPotty) out.urge.push(name);
        } else d.urgeAt = 0;
      });
      // 喝水
      if (cfg.water && !night && present && env.out && S.waterToday < T.waterCap && (S.lastWater === 0 || now - S.lastWater >= T.waterGapMin * MIN) &&
          (S.dogs.dax.thirst >= 1 || S.dogs.gold.thirst >= 1)) out.thirsty = true;
      S.seed = rng.s;
      return out;
    }

    // 它们从岛里出来了（或者一打开就在外面）：今天头一回吗？
    function firstOuting(now) {
      if (!S) init(now);
      if (isNight(now) || S.morningDay === dayKey(now)) return false;
      S.morningDay = dayKey(now);
      DOGS.forEach(function (name) {
        var d = S.dogs[name], K = T.dog[name];
        if (!cfg.potty) return;
        var level = rng.range(K.morningBowel);
        if (d.lastPoop === 0 || now - d.lastPoop >= T.morningGapHours * HOUR) d.bowel = Math.max(d.bowel, level);
      });
      S.quietPotty = Math.max(S.quietPotty, now + rng.range(T.quietPottySec) * 1000);
      return true;
    }
    function bolusOf(K, now, amt) { var t0 = now + rng.range(K.transitStartMin) * MIN; return { t0: t0, t1: t0 + rng.range(K.transitLenMin) * MIN, amt: amt }; }
    // kind: 'full' | 'snack' | 'biscuit'；by: 'auto' | 'her'；slot: 正餐是第几顿（不是正餐给 -1）
    function mealDone(now, kind, by, slot) {
      rollDay(now);
      DOGS.forEach(function (name) {
        var d = S.dogs[name], K = T.dog[name];
        if (kind === 'full') {
          d.full = 1;
          d.bolus = bolusOf(K, now, K.mealBolus * rng.range(K.bolusVar));
          d.thirst = cfg.water ? 0 : Math.min(1.5, d.thirst + T.mealThirst);   // 正餐最后在水碗那儿喝过了
        } else if (kind === 'snack') {
          d.full = Math.min(1, d.full + T.snackFull);
          if (d.bolus) d.bolus.amt += T.snackBolus; else d.bolus = bolusOf(K, now, T.snackBolus);
        } else d.full = Math.min(1, d.full + T.biscuitFull);
      });
      if (kind === 'full') { S.lastMeal = now; for (var i = 0; i <= slot; i++) S.served[i] = true; S.stats.meals++; }
      else if (kind === 'snack') { S.snacksToday++; S.stats.snacks++; }
      else { S.biscuits.push(now); S.stats.biscuits++; if (by === 'auto') S.biscuitDay = S.day; }
      if (by === 'her') S.stats.fedByHer++;
      S.seed = rng.s;
    }
    // 她这会儿说"开饭"，该给什么
    function feedNow(now) {
      if (!S) init(now);
      rollDay(now);
      S.biscuits = S.biscuits.filter(function (t) { return now - t < 24 * HOUR; });
      var lastHour = S.biscuits.filter(function (t) { return now - t < HOUR; }).length;
      var today = S.stats.biscuits;
      var biscuitOK = lastHour < T.biscuitPerHour && today < T.biscuitPerDay;
      if (isNight(now)) return biscuitOK ? { kind: 'midnight', slot: -1 } : { kind: 'full_gag', slot: -1 };
      var p = pendingSlot(now);
      if (p >= 0) return { kind: 'full', slot: p };
      var e = nextSlotWithin(now, T.earlyMealMin);
      if (e >= 0) return { kind: 'full', slot: e, early: true };
      if ((S.lastMeal === 0 || now - S.lastMeal >= T.feedNowSnackAfterMin * MIN) && S.snacksToday < T.snackPerDay) return { kind: 'snack', slot: -1 };
      return biscuitOK ? { kind: 'biscuit', slot: -1 } : { kind: 'full_gag', slot: -1 };
    }
    // hidden = true：找不到地方，回岛里解决了（看不见，不过还是算一次）
    function poopDone(name, now, hidden) {
      rollDay(now);
      var d = S.dogs[name];
      d.bowel = Math.max(0, d.bowel - 1); d.lastPoop = now; d.poops++; d.urgeAt = 0;
      var lucky = false;
      if (!hidden) {
        S.stats.poops++;
        var dayNo = Math.floor(now / (24 * HOUR));
        if (name === 'gold' && cfg.lucky && dayNo - S.luckyDayNo >= T.luckyMinDays && rng.next() < T.luckyChance) { lucky = true; S.luckyDayNo = dayNo; S.stats.lucky = true; }
      }
      S.seed = rng.s;
      return { lucky: lucky };
    }
    function pottyGiveUp(name, now) { var d = S.dogs[name]; d.bowel = 0.3; d.urgeAt = 0; d.lastPoop = now; }
    function cleaned(by) { if (by === 'her') S.stats.byHer++; else S.stats.byHim++; }
    function drank(now) { S.dogs.dax.thirst = 0; S.dogs.gold.thirst = 0; S.lastWater = now; S.waterToday++; S.stats.water++; }
    function fetched(name) { var d = S && S.dogs[name]; if (d) d.thirst = Math.min(1.5, d.thirst + T.fetchThirst); }
    function set(o) {
      if (typeof o.feeding === 'boolean') cfg.feeding = o.feeding;
      if (typeof o.potty === 'boolean') { cfg.potty = o.potty; if (!o.potty && S) DOGS.forEach(function (n) { S.dogs[n].bowel = 0; S.dogs[n].urgeAt = 0; S.dogs[n].bolus = null; }); }
      if (typeof o.water === 'boolean') cfg.water = o.water;
    }
    function save() { if (!S) return ''; S.seed = rng.s; return JSON.stringify(S); }
    function load(json, now) {
      try { var o = JSON.parse(json); if (o && o.v === 1 && o.dogs && o.dogs.dax && o.dogs.gold) { S = o; rng.s = (o.seed >>> 0) || 1; } } catch (e) {}
      if (!S) init(now);
      resume(now);
    }
    return {
      cfg: cfg, slots: slots,
      tick: tick, resume: resume, firstOuting: firstOuting, mealDone: mealDone, feedNow: feedNow, poopDone: poopDone, pottyGiveUp: pottyGiveUp,
      cleaned: cleaned, drank: drank, fetched: fetched, set: set, save: save, load: load,
      state: function () { return S; }, isNight: isNight, minutesToNight: minutesToNight, pendingSlot: pendingSlot, dayKey: dayKey, minOfDay: minOfDay,
    };
  }

  G.PET_NEEDS = { create: create, DEFAULTS: DEFAULTS };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
