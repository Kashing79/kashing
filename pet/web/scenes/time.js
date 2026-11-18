// 球球 · 戏包：时间和日子（R5 卡片 D01-D14）
//
// 一天有了形状：早上巡视、整点看表、下午茶、看夕阳、哈欠传染、睡前故事；日历上有几个要紧的日子。
// 钟点上的戏只在她在、它们在外面的时候演，错过了就错过了（不补）；只有礼物（D13、D14）会等她一整天。
// 日子、他那边的时区都从 config.js 来（dates、reunion、clock、hisClock……）：没写就不演，不会出错。
// 说明书在 pet.js 开头"怎么写一场戏"。
(function (G) {
  'use strict';
  var L = G.PET_SCENES = G.PET_SCENES || [];
  function add(r) { r.pack = 'time'; L.push(r); }
  // 两段戏之间传话用的小记事本：礼物 / 花被她点了没有
  var note = { gift: 0, bouquet: 0 };
  var picnicBlanket = null;          // 野餐布（草地印子的编号）：戏一完就收走

  function cx(S, x, m) { var F = S.field; m = m === undefined ? 24 : m; return Math.max(F.x0 + m, Math.min(F.x1 - m, x)); }
  function cy(S, y) { var F = S.field; return Math.max(F.y0, Math.min(F.y1, y)); }
  function hm2min(s) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return m ? (+m[1]) * 60 + (+m[2]) : -1; }
  function nowMin(S) { return S.time.h * 60 + S.time.m; }
  // 设定里的钟点（没写就用默认的）
  function teaTime(S) { var c = S.cfg; if (c.teaTime === '' || c.teaTime === null) return -1; return hm2min(c.teaTime || (c.care && c.care.biscuitTime) || '15:30'); }
  function nightStart(S) { var n = S.cfg.nightSleep; return n && n.length === 2 ? n[0] : -1; }
  // 下面三分之一（满屏时）里的一个点
  function lowPt(S, x) { var F = S.field; return { x: cx(S, x, 40), y: S.roam ? F.y1 - (F.y1 - F.y0) * S.rand(0.06, 0.22) : F.y1 }; }
  // 他那边现在几点（设定 clock[hisClock].tz；电脑上没有时区表 / 没设 → null）
  function hisHM(S) {
    var c = S.cfg, i = c.hisClock, list = c.clock;
    if (!(i >= 0) || !list || !list[i] || !list[i].tz) return null;
    try {
      var f = new Intl.DateTimeFormat('en-GB', { timeZone: list[i].tz, hour: '2-digit', minute: '2-digit', hour12: false });
      var s = f.format(new Date(S.time.ms)), m = /(\d{1,2})\D(\d{2})/.exec(s);
      return m ? ('0' + (+m[1] % 24)).slice(-2) + ':' + m[2] : null;
    } catch (e) { return null; }
  }

  // ============================================================
  //  D01 早上出岛：巡视领地（她的屏幕就是它们的地盘）
  // ============================================================
  add({ name: 'morning_rounds', zh: '早上出岛：巡视领地', kind: 'react', on: 'out', cast: 'man dax gold', tag: 'lively', mood: 'proud', keep: 12, cap: 1, timeout: 24,
    when: function (S, ev) { return !!(ev && ev.first) && S.time.h >= 5 && S.time.h < 12 && S.reunion() !== 0; },
    run: function* (S) {
      var man = S.man, dax = S.dax, gold = S.gold, F = S.field, stick = null;
      yield 1.0;
      // 1. 他抖一抖袖口，背着手看看这片草地
      S.ball.pocket();
      S.hold(man, ['p_dust', 'p_idle']); S.face(man, 'proud');
      yield 0.6;
      S.hold(man, ['p_behind', 'p_idle']); S.look(man, { x: man.x - 60, y: man.y, z: 10 });
      // 2. 小腊肠低着头沿着底边巡一圈：两个角落都闻一闻，看看东西都还在不在
      var y1 = F.y1, near = dax.x < (F.x0 + F.x1) / 2 ? F.x0 + 30 : F.x1 - 30, far = near < (F.x0 + F.x1) / 2 ? F.x1 - 30 : F.x0 + 30;
      var patrol = (function* () {
        yield S.go(dax, near, y1, 30, 'sniff', 5);
        S.emote('sniffs', dax, dax.face * 16, 0.5);
        yield S.go(dax, far, y1, 34, 'sniff', 6);
        S.emote('sniffs', dax, dax.face * 16, 0.5);
        dax.wag = 1;
      })();
      // 3. 同时金毛在场边找到今天要叼的东西（一根树枝），昂着头翘着尾巴送到他面前
      if (S.hasFx('stick')) {
        var sx = gold.x < (F.x0 + F.x1) / 2 ? F.x0 + 34 : F.x1 - 34;
        stick = S.prop.spawn('stick', '', sx, cy(S, gold.y + S.ry(10)), {});
        yield S.go(gold, S.beside(gold, stick, 0), S.spd(gold, 'trot'), null, 6);
        S.hold(gold, 'sniff');
        yield 0.4;
        S.prop.carry(stick, gold, 'mouth');
      }
      S.hold(gold, 'stand'); gold.look = 0.5; gold.wag = 1;
      yield S.go(gold, S.atHand(gold, -2), S.spd(gold, 'trot') * 0.8, null, 6);
      S.faceTo(gold, man); S.hold(gold, 'sit'); gold.look = 0;
      if (stick) S.prop.drop(stick, gold.x + gold.face * (gold.mx + 2), gold.y + S.ry(2));
      S.look(man, gold); S.face(man, 'smile');
      // 等小腊肠巡完（最多 8 秒）
      var t0 = S.t();
      while (S.t() - t0 < 8) { var r = patrol.next(); if (r.done) break; yield r.value; }
      // 4. 小腊肠回来报告：汪一声，坐下。他摸摸两只，转过来对她挥挥手；周一再握一下拳
      yield S.go(dax, S.atHand(dax, 3), S.spd(dax, 'run') * 0.8, null, 5);
      S.faceTo(dax, man); dax.bark = 0.3; S.emote('woof', dax, dax.face * 8, 0.5); S.hold(dax, 'sit');
      yield 0.5;
      S.faceTo(man, dax); S.hold(man, 'p_pat'); S.face(man, 'soft');
      yield 0.7;
      S.faceTo(man, gold); S.hold(man, 'p_pat');
      yield 0.7;
      S.hold(man, { f: ['p_wave_a', 'p_wave_b'], fps: 5 }); S.look(man, 'camera'); S.face(man, 'smile');
      S.say('morning', ['早安', '早安', 'Good morning']);
      yield 1.4;
      if (S.time.wd === 1) { S.hold(man, ['p_cheer', 'p_cheer2']); S.face(man, 'grin'); yield 0.7; }
      S.hold(man, null);
    },
  });

  // ============================================================
  //  D02 整点看表：一个活的布谷鸟钟（看几天才会发现，发现了就再也忘不掉）
  // ============================================================
  add({ name: 'on_the_hour', zh: '整点看表', kind: 'react', on: 'hour', cast: 'man dax gold', tag: 'calm', mood: 'funny', timeout: 6,
    when: function (S) { return !S.night() && S.her.present; },
    run: function* (S, ev) {
      var man = S.man, dax = S.dax, gold = S.gold, h = ev && ev.h !== undefined ? ev.h : S.time.h;
      // 1. 抬起手腕看表
      S.hold(man, 'p_watch'); S.face(man, 'focus');
      yield 0.6;
      // 2. 一个干脆的点头；同一刻小腊肠跳一下，金毛的尾巴拍一下地
      S.hold(man, null); S.face(man, 'proud');
      S.act(man, 'proud_nod', 0.8);
      if (!S.asleep(dax)) S.hop(dax, 90);
      gold.wag = 1;
      yield 0.6;
      gold.wag = 0.3;
      // 3. 中午和傍晚六点，点完头再慢慢伸个懒腰
      if (h === 12 || h === 18) { S.hold(man, { f: ['p_cheer', 'p_cheer2'], fps: 2 }); S.face(man, 'soft'); yield 1.2; }
      yield 0.6;
    },
  });

  // ============================================================
  //  D03 下午茶：他示范怎么休息，"嘘"一下她就成了同谋
  // ============================================================
  add({ name: 'tea_time', zh: '下午茶', cast: 'man gold dax', weight: 8, cap: 1, tag: 'calm', mood: 'mischievous', family: 'biscuit',
    when: function (S) { var t = teaTime(S), n = nowMin(S); return t >= 0 && n >= t && n < t + 30 && S.her.present && !S.night(); },
    run: function* (S) {
      var man = S.man, gold = S.gold, dax = S.dax, s = man.face;
      S.ball.pocket();
      // 1. 看表，从口袋里摸出一只小茶杯（冒着一缕热气）
      S.hold(man, 'p_watch'); S.face(man, 'neutral');
      yield 0.7;
      S.hold(man, ['p_pocket', 'p_hold']); S.item(man, S.hasFx('cup2') ? 'cup2' : 'cup'); S.face(man, 'smile');
      yield 0.7;
      // 2. 闭着眼抿一口，肩膀松下来
      S.hold(man, ['p_sip', 'p_hold']); S.face(man, 'sleepy');
      yield 1.5;
      // 3. 金毛坐着盯着杯子，口水慢慢挂下来；小腊肠扒在他小腿上
      S.hold(man, 'p_hold'); S.face(man, 'soft');
      var a = S.go(gold, cx(S, man.x + s * (gold.half * 0.6 + 14)), man.y + S.ry(-2), S.spd(gold, 'walk') * 1.6, null, 3);
      var b = S.go(dax, cx(S, man.x - s * (dax.half * 0.55 + 5)), man.y + S.ry(2), S.spd(dax, 'trot'), null, 3);
      yield S.all(a, b);
      S.faceTo(gold, man); S.hold(gold, 'sit'); S.look(gold, S.hand()); gold.wag = 0.4; S.emote('drool', gold, gold.face * 8, 1.6);
      S.faceTo(dax, man); S.hold(dax, ['rear', 'beg']); S.rig(dax, { pawAt: [dax.face * 5, 9] }); dax.wag = 1;
      yield 1.8;
      // 4. 左右看看，给两只各偷偷塞一块饼干；然后竖起手指对着她：嘘
      S.look(man, { x: man.x - 40, y: man.y, z: 20 });
      yield 0.35;
      S.look(man, { x: man.x + 40, y: man.y, z: 20 });
      yield 0.35;
      S.look(man, null);
      S.toss('bone', man, gold, 0.35, 8);
      yield 0.35;
      S.rig(gold, { snap: true }); S.emote('heart', gold, 0, 0.8);
      S.rig(dax, null); S.hold(dax, 'stand');
      S.toss('bone', man, dax, 0.3, 6);
      yield 0.35;
      S.emote('heart', dax, 0, 0.8); S.hold(dax, 'sit');
      S.hold(man, ['p_shh', 'p_front']); S.look(man, 'camera'); S.face(man, 'wink');
      yield 1.0;
      // 5. 喝完最后一口，杯子收回口袋
      S.hold(man, ['p_sip', 'p_hold']); S.face(man, 'soft'); S.look(man, null);
      yield 0.8;
      S.hold(man, ['p_pocket', 'p_hold']); S.item(man, null);
      yield 0.6;
      S.hold(man, null); S.rig(gold, null);
    },
  });

  // ============================================================
  //  D04 一起看夕阳：他拍拍身边空着的那块草地（唯一一次说"想你"，说得很轻）
  // ============================================================
  add({ name: 'sunset_watch', zh: '一起看夕阳', kind: 'react', on: ['dayphase', 'hour'], cast: 'man gold dax', tag: 'calm', mood: 'tender', keep: 90, cap: 1, timeout: 40,
    when: function (S, ev) {
      if (!S.her.present || S.night()) return false;
      var sh = S.cfg.sunsetHour;
      if (sh !== null && sh !== undefined && sh !== '') return ev.name === 'hour' && ev.h === +sh;
      return ev.name === 'dayphase' && ev.phase === 'dusk' && S.time.h >= 15;
    },
    run: function* (S) {
      var man = S.man, gold = S.gold, dax = S.dax, F = S.field;
      S.ball.pocket();
      // 1. 他停下来，看向近的那一边屏幕，走到下面三分之一靠中间的地方，朝着那边坐下
      var side = man.x < (F.x0 + F.x1) / 2 ? -1 : 1;
      S.look(man, { x: man.x + side * 100, y: man.y, z: 20 }); S.face(man, 'soft');
      yield 0.8;
      var p = lowPt(S, (F.x0 + F.x1) / 2 - side * 20);
      yield S.go(man, p, 24, null, 8);
      man.face = side; S.hold(man, 'p_sit');
      yield 0.6;
      // 2. 金毛挨着他坐下，他把手臂搭在它背上；小腊肠爬到他腿上坐着
      var a = S.go(gold, cx(S, man.x - side * (gold.half * 0.5 + 4)), man.y + S.ry(-2), S.spd(gold, 'walk') * 1.5, null, 5);
      var b = S.go(dax, cx(S, man.x + side * 16), man.y + S.ry(3), S.spd(dax, 'trot'), null, 5);
      yield S.all(a, b);
      gold.face = side; S.hold(gold, 'sit'); gold.wag = 0.2;
      S.hold(man, ['p_sit_arm', 'p_sit']);
      S.attach(dax, man, 'lap', 2, 0, false, 1); S.hold(dax, 'sit');
      yield 1.0;
      // 3. 一动不动地坐着。草地慢慢换成黄昏的颜色；一颗心慢慢升起来；金毛的尾巴扫一下
      S.look(man, { x: man.x + side * 200, y: man.y, z: 40 }); S.look(gold, { x: gold.x + side * 200, y: gold.y, z: 30 }); S.look(dax, { x: dax.x + side * 200, y: dax.y, z: 30 });
      yield 4.0;
      S.emote('heart', man, 0, 2.4);
      yield 3.0;
      gold.wag = 0.7;
      yield 0.8;
      gold.wag = 0.1;
      yield 3.0;
      // 4. 他拍拍另一边空着的草地——那个空位——手就留在那儿
      S.hold(man, ['p_sit_arm', 'p_sit']); S.face(man, 'wistful'); S.look(man, { x: man.x - side * 14, y: man.y, z: 0 });
      var e = S.anchor(man, 'hand2');
      S.bits(man.x - side * 10, man.y, 2, S.grass(), 4, 8);
      yield 3.0;
      // 5. 起来：狗狗伸懒腰；黄昏里接着过日子
      S.face(man, 'soft'); S.detach(dax, 30); S.hold(dax, 'stand'); S.hold(gold, 'stand'); S.look(man, null);
      yield 0.5;
      S.act(dax, 'stretch', 1.6); S.act(gold, 'stretch', 2.2);
      S.hold(man, null);
      yield 2.0;
    },
  });

  // ============================================================
  //  D05 哈欠会传染（她也许也被传染了——没有谁叫她去睡觉）
  // ============================================================
  add({ name: 'yawn_chain', zh: '哈欠会传染', cast: 'man gold dax', weight: 8, cap: 1, tag: 'calm', mood: 'sleepy', family: 'sleep',
    when: function (S) { var n = nightStart(S); return n >= 0 && S.time.h === (n + 23) % 24 && S.her.present; },
    run: function* (S) {
      var man = S.man, gold = S.gold, dax = S.dax;
      S.look(gold, man); S.look(dax, gold);
      // 1. 他捂着嘴打个哈欠
      yield S.act(man, 'yawn', 1.6);
      // 2. 金毛看着他，也张大嘴打了个哈欠
      yield S.act(gold, 'yawn', 1.7);
      // 3. 小腊肠扭过头去忍着……没忍住，打了一个最大的，只好坐下
      dax.face = -dax.face; S.rig(dax, { jaw: 0.1 });
      yield 0.6;
      S.rig(dax, null); S.faceTo(dax, man);
      yield S.act(dax, 'yawn', 1.1);
      S.hold(dax, 'sit');
      // 4. 他看到了，又打一个，认输
      S.face(man, 'sleepy');
      yield S.act(man, 'yawn', 1.6);
      // 5. 慢慢眨三下眼；金毛趴下
      S.face(man, 'sleepy'); S.hold(gold, 'lie'); S.rig(gold, { eyes: 'closed' });
      yield 1.6;
    },
  });

  // ============================================================
  //  D06 睡前故事（他最后回头看的那一眼，是给她的）
  // ============================================================
  add({ name: 'bedtime_story', zh: '睡前故事', cast: 'man dax gold', weight: 10, cap: 1, tag: 'calm', mood: 'sleepy', family: 'carry', timeout: 74,
    when: function (S) {
      var I = S.island();
      return S.night() && S.her.idle > 20 && S.quietFor() < 120 && !!(I && I.on && S.roam);
    },
    run: function* (S) {
      var man = S.man, dax = S.dax, gold = S.gold, I = S.island(), defiant = S.chance(0.3), i;
      if (!I) return;
      S.ball.pocket();
      // 1. 他走到岛底下坐好，从西装里掏出一本小书，翻开
      yield S.go(man, I.x, cy(S, I.y + 26), 24, null, 8);
      // （画的人还没画坐着读书的 p_read：那就站着捧书读——坐着的画面手里拿不了东西）
      var reading = S.has(man, 'p_read') ? 'p_read' : 'p_gaze';
      if (reading === 'p_read') S.hold(man, 'p_sit');
      S.face(man, 'soft');
      S.hold(man, 'p_pocket'); S.item(man, 'book_open');
      yield 0.6;
      S.hold(man, reading);
      // 2. 两只狗面朝他趴下；小腊肠的下巴搁在金毛的爪子上
      var a = S.go(gold, cx(S, man.x + man.face * (gold.half + 30)), man.y + S.ry(-3), S.spd(gold, 'walk') * 1.5, null, 5);
      var b = S.go(dax, cx(S, man.x + man.face * (dax.half + 10)), man.y + S.ry(7), S.spd(dax, 'walk') * 1.6, null, 5);
      yield S.all(a, b);
      S.faceTo(gold, man); S.faceTo(dax, man); S.hold(gold, 'lie'); S.hold(dax, 'lie'); S.rig(dax, { chin: true });
      if (defiant) {
        // "我不困"：小腊肠伏下身子冲他叫，绕着跑一小圈，叫到一半打了个哈欠……他把它像法棍一样抱起来
        yield 1.5;
        S.rig(dax, null); S.hold(dax, 'bow'); S.mood(dax, 'happy'); dax.wag = 1;
        yield 0.7;
        yield S.orbit(dax, { x: dax.x, y: dax.y }, 30, 10, 1, S.spd(dax, 'trot'));
        dax.bark = 0.3;
        yield 0.3;
        yield S.act(dax, 'yawn', 1.1);
        S.item(man, null); S.hold(man, null);
        yield S.go(man, S.manAt(dax, 12), 'stroll', null, 3);
      } else {
        // 3. 他读着，三秒翻一页。小腊肠的眼睛闭上了，翻成侧躺；金毛的头一点、一抬、又一点
        for (i = 0; i < 3; i++) {
          yield 1.5;
          S.item(man, 'book_turn');
          yield 0.25;
          S.item(man, 'book_open');
          if (i === 0) { S.rig(dax, { eyes: 'closed' }); }
          if (i === 1) { S.rig(dax, null); S.hold(dax, ['flop', 'sleep']); S.rig(dax, { eyes: 'closed' }); S.mood(gold, 'sleepy'); gold.look = -0.4; }
          if (i === 2) { gold.look = 0.2; }
          yield 1.2;
          gold.look = -0.4;
        }
        // 4. 他发现了，轻轻合上书，竖起手指：嘘
        S.item(man, 'book_closed');
        yield 0.5;
        S.item(man, null); S.hold(man, ['p_shh', 'p_front']); S.look(man, 'camera'); S.face(man, 'soft');
        yield 1.4;
        S.hold(man, null);
        yield S.go(man, S.manAt(dax, 12), 'stroll', null, 3);
      }
      // 5. 他把睡着的小腊肠抱起来；碰碰金毛，金毛眯着眼慢吞吞跟上
      S.faceTo(man, dax); S.hold(man, ['p_place', 'p_crouch']);
      yield 0.5;
      S.rig(dax, null); S.attach(dax, man, 'arms', 0, 0, false, 1); S.hold(dax, ['cradle', 'sleep']); S.rig(dax, { eyes: 'closed' });
      S.hold(man, ['p_carry', 'p_hold']); S.face(man, 'soft');
      S.hold(gold, 'stand'); S.mood(gold, 'sleepy'); S.rig(gold, { eyes: 'slit' });
      S.follow(gold, man, gold.half + 8, S.ry(-3), S.spd(gold, 'walk') * 0.9);
      yield S.go(man, I.x, cy(S, I.y + 8), 20, ['p_carry', 'p_hold'], 5);
      S.stop(gold); S.hold(gold, 'sit');
      // 6. 到了岛底下：他回头看她，小小地挥一下手说晚安（然后它们就回岛里睡了）
      S.look(man, 'camera');
      yield 0.6;
      S.hold(man, ['p_carry', 'p_hold']); S.face(man, 'smile');
      S.say('night', ['晚安', '晚安', 'Good night']);
      S.emote('z', dax, 0, 1.6);
      yield 1.6;
      // 抱着睡着的小腊肠等一会儿：她不碰它们，大家就回岛（引擎的"夜里回岛"），没等到也就散了
      yield S.until(function () { return S.quietFor() > 150; }, 30);
    },
  });

  // ============================================================
  //  D08 他那边天亮了 / 他那边要睡了（时区表在她电脑上：不联网）
  // ============================================================
  add({ name: 'his_time', zh: '他那边天亮了／他那边要睡了', kind: 'react', on: 'minute', cast: 'man', tag: 'calm', mood: 'tender', timeout: 8,
    when: function (S) {
      if (!S.her.present || S.night()) return false;
      var hm = hisHM(S), c = S.cfg;
      return !!hm && (hm === (c.hisMorning || '07:30') || hm === (c.hisNight || '23:30'));
    },
    run: function* (S) {
      var man = S.man, gold = S.gold, morning = hisHM(S) === (S.cfg.hisMorning || '07:30');
      S.ball.pocket();
      if (morning) {
        // 他的早上：伸个懒腰，头顶升起一个小太阳；掏出杯子抿一口，朝她举一举：干杯
        S.emote('sun', man, 0, 1.5);
        yield S.act(man, ['stretch', 'p_reach'], 1.6);
        S.hold(man, ['p_pocket', 'p_hold']); S.item(man, 'cup');
        yield 0.5;
        S.hold(man, ['p_sip', 'p_hold']); S.face(man, 'sleepy');
        yield 0.9;
        S.hold(man, ['p_show', 'p_front']); S.look(man, 'camera'); S.face(man, 'smile');
        if (S.dist(gold, man) < 120) S.emote('zs', gold, 0, 1.0);
        yield 1.2;
        S.item(man, null);
      } else {
        // 他的晚上：一个小月亮；转过来，小小地挥手说晚安，手在心口停一下
        S.emote('moon', man, 0, 1.5);
        S.hold(man, 'p_front'); S.look(man, 'camera'); S.face(man, 'soft');
        yield 1.2;
        S.hold(man, { f: ['p_wave_a', 'p_wave_b'], fps: 4 });
        S.say('hisNight');
        yield 0.9;
        S.hold(man, ['p_heart', 'p_front']);
        yield 1.0;
      }
      S.hold(man, null);
    },
  });

  // ============================================================
  //  D09 五点二十（一天只有一分钟的秘密）
  // ============================================================
  add({ name: 'secret_minute', zh: '五点二十', kind: 'react', on: 'minute', cast: 'man', tag: 'calm', mood: 'tender', timeout: 6,
    when: function (S, ev) {
      var list = S.cfg.secretTimes;
      if (list === undefined || list === null) list = ['13:14', '17:20'];
      return S.her.present && list.indexOf(ev.hm || S.time.hm) >= 0;
    },
    run: function* (S) {
      var man = S.man, gold = S.gold, big = S.time.md === '05-20';
      // 1. 瞄一眼手表
      S.hold(man, 'p_watch'); S.face(man, 'neutral');
      yield 0.8;
      // 2. 正对着她看过来；胸口的口袋里冒出一颗小心，他拍拍口袋
      S.hold(man, 'p_front'); S.look(man, 'camera'); S.face(man, 'soft');
      S.emote(big ? 'heart' : 'hs', man, man.face * 1.5, 1.4);
      if (big) { S.emote('heart', S.dax, 0, 1.2); S.emote('heart', gold, 0, 1.2); }
      yield 0.5;
      S.hold(man, ['p_heart', 'p_front']);
      yield 0.6;
      // 3. 金毛抬头看那颗心，摇尾巴；他转回去，好像什么都没发生
      if (S.dist(gold, man) < 140) S.emote('q', gold, 0, 0.6);
      S.hold(man, null); S.look(man, null); S.face(man, 'neutral');
      yield 0.5;
    },
  });

  // ============================================================
  //  D10 周末野餐：小腊肠半个身子钻进篮子里
  // ============================================================
  add({ name: 'weekend_picnic', zh: '周末野餐', cast: 'man dax gold', weight: 6, tag: 'calm', mood: 'tender', timeout: 50,
    when: function (S) {
      var wk = S.cfg.weekend || [6, 0], wd = S.time.wd, h = S.time.h;
      if (wk.indexOf(wd) < 0 || h < 11 || h >= 14 || !S.her.present) return false;
      // 一个周末只野餐一次：记下这个周末的星期六是哪天
      var sat = new Date(S.time.ms - ((wd + 1) % 7) * 86400000), key = sat.getFullYear() + '-' + (sat.getMonth() + 1) + '-' + sat.getDate();
      return S.mem.get('picnic') !== key && (!S.cursor.known || S.cursor.speed < 80);
    },
    run: function* (S) {
      var man = S.man, dax = S.dax, gold = S.gold, F = S.field, i;
      var wd = S.time.wd, sat = new Date(S.time.ms - ((wd + 1) % 7) * 86400000);
      S.mem.set('picnic', sat.getFullYear() + '-' + (sat.getMonth() + 1) + '-' + sat.getDate());
      S.ball.pocket();
      var p = lowPt(S, S.cursor.known && Math.abs(S.cursor.x - man.x) < 120 ? (S.cursor.x < (F.x0 + F.x1) / 2 ? F.x1 - 120 : F.x0 + 120) : man.x);
      yield S.go(man, p, 24, null, 8);
      var f = man.face;
      // 1. 从口袋里拉出一块格子野餐布，往前一抖：布飘下来铺好（布是平铺在地上的一块：它的近边就在他们脚后面，画在他们底下）
      //    小腊肠正好从布底下钻过去，从另一头冒出来
      S.hold(man, ['p_pocket', 'p_hold']); S.item(man, S.hasFx('blanket_folded') ? 'blanket_folded' : null);
      yield 0.6;
      S.item(man, null); S.hold(man, ['p_reach', 'p_cheer']); S.face(man, 'grin');
      var by = man.y + 3, bx = cx(S, man.x + f * 16, 30);
      // 布用"草地上的小印子"来画（画在所有角色底下，平平地铺在地上）；戏一完（包括被打断）就收走，见 end
      S.puff(bx, by - 8, true);
      picnicBlanket = S.decal('blanket', bx, by, { overlay: true });
      yield S.go(dax, cx(S, bx + f * 40), man.y + S.ry(3), S.spd(dax, 'run'), null, 2);
      S.emote('spark', dax, 0, 0.5);
      // 2. 他在布边上坐下，放下一只小篮子，给自己倒一杯茶
      S.hold(man, 'p_sit'); S.face(man, 'soft');
      var bk = S.prop.spawn('basket', '', cx(S, man.x + f * 13), man.y + 0.3, {});
      yield 0.6;
      S.item(man, 'cup');
      yield 0.8;
      // 3. 金毛在布的另一头趴下，很有礼貌地看别处，又看看篮子；小腊肠的前半截已经钻进篮子里了，尾巴摇个不停
      yield S.go(gold, cx(S, man.x + f * 36), man.y + S.ry(-7), S.spd(gold, 'walk') * 1.4, null, 4);
      gold.face = -f; S.hold(gold, 'lie'); S.look(gold, { x: gold.x + f * 40, y: gold.y, z: 10 });
      var q = S.prop.where(bk);
      yield S.go(dax, cx(S, q.x + f * (dax.half - 4)), man.y + 0.6, S.spd(dax, 'trot'), null, 3);
      dax.face = -f; S.hold(dax, 'sniff'); dax.wag = 1;
      S.clip(dax, f > 0 ? [q.x + 1, -9999, 99999, 99999] : [-99999, -9999, q.x - 1 + 99999, 99999]);
      yield 1.2;
      S.look(gold, bk);
      yield 1.0;
      S.look(gold, { x: gold.x + f * 40, y: gold.y, z: 10 });
      yield 1.2;
      // 4. 他把它从中间拎出来放好，一只一块饼干——金毛先，因为它乖
      S.clip(dax, null); S.item(man, null);
      S.hold(man, 'p_sit'); S.face(man, 'laugh');
      yield S.slide(dax, f * 8, 0, 0.4);
      S.hold(dax, 'sit');
      S.toss('bone', { x: man.x, y: man.y, z: 12 }, gold, 0.4, 10);
      yield 0.45;
      S.emote('heart', gold, 0, 0.8);
      S.toss('bone', { x: man.x, y: man.y, z: 12 }, dax, 0.4, 10);
      yield 0.45;
      S.emote('heart', dax, 0, 0.8);
      // 5. 三个都朝同一个方向坐着；安安静静，偶尔一个音符
      S.faceTo(dax, { x: man.x + f * 100 }); S.hold(dax, 'sit'); S.hold(gold, 'sit'); gold.face = f;
      S.item(man, 'cup'); S.face(man, 'soft'); S.look(man, { x: man.x + f * 100, y: man.y, z: 20 });
      for (i = 0; i < 3; i++) { yield S.rand(2, 2.8); S.emote(i === 1 ? 'hs' : 'note', S.pick([man, gold, dax]), 0, 1.0); }
      // 6. 叠起野餐布（小腊肠骑在布卷上一秒钟），全都收回口袋，一颗小星星
      S.item(man, null); S.hold(man, null);
      yield 0.4;
      S.prop.remove(bk, true);
      if (picnicBlanket) { S.decalRemove(picnicBlanket); picnicBlanket = S.decal('blanket_edge', bx, by, { overlay: true }); }
      yield 0.6;
      if (picnicBlanket) { S.decalRemove(picnicBlanket); picnicBlanket = null; }
      S.puff(bx, by - 6, false);
      if (S.hasFx('blanket_folded')) S.item(man, 'blanket_folded');
      yield 0.4;
      S.item(man, null);
      S.hold(man, ['p_pocket', 'p_hold']); S.emote('spark', man, 0, 0.6);
      yield 0.8;
      S.hold(man, null);
    },
    end: function (S) { if (picnicBlanket) { S.decalRemove(picnicBlanket); picnicBlanket = null; } },
  });

  // ============================================================
  //  D11 撕日历：离见面又近了一天，被他撕下来、被小腊肠撕碎
  // ============================================================
  add({ name: 'tear_the_page', zh: '撕日历', cast: 'man dax gold', weight: 6, cap: 1, tag: 'calm', mood: 'proud', hours: [[6, 14]],
    when: function (S) { var n = S.reunion(); return n !== null && n > 0 && S.her.present; },
    run: function* (S) {
      var man = S.man, dax = S.dax, gold = S.gold, n = S.reunion(), mile = [100, 50, 30, 10, 3].indexOf(n) >= 0, s = man.face;
      S.ball.pocket();
      // 1. 从口袋里拿出一本小小的撕页日历，举起来看
      S.hold(man, ['p_pocket', 'p_hold']); S.item(man, 'calendar');
      yield 0.6;
      S.hold(man, ['p_gaze', 'p_hold']); S.face(man, 'focus');
      yield 0.9;
      // 2. 潇洒地撕下最上面一页：那一页左右飘着落下来
      S.hold(man, ['p_show', 'p_hold']); S.face(man, 'grin');
      var h = S.hand();
      var sh = S.prop.spawn('calendar', 'sheet', cx(S, h.x + s * 4), man.y + S.ry(2), { z: h.z + 4, shadow: false });
      var t0 = S.t(), x0 = sh.x;
      yield S.each(0.9, function (t) { S.prop.move(sh, cx(S, x0 + s * t * 18 + Math.sin(t * 9) * 4), man.y + S.ry(2), Math.max(6, h.z + 4 - t * 22)); });
      // 3. 小腊肠一跳，半空中叼住，叼着它跑一圈胜利圈；金毛看看那页纸，再看看他
      S.faceTo(dax, sh); dax.wag = 1;
      var w = S.prop.where(sh);
      yield S.go(dax, S.beside(dax, { x: w.x, y: w.y, half: 3, mx: 3 }, 0), S.spd(dax, 'run'), null, 2);
      S.hop(dax, 125);
      yield 0.25;
      S.prop.carry(sh, dax, 'mouth');
      S.look(gold, dax);
      yield S.orbit(dax, { x: dax.x - s * 20, y: dax.y }, 26, 10, 1, S.spd(dax, 'run') * 0.7);
      S.look(gold, man);
      S.prop.remove(sh, false); S.bits(dax.x + dax.face * dax.mx, dax.y, 5, ['#ffffff', '#f7f5e9', '#d0353f'], 14, 26);
      // 4. 他看看新的一页，点点头，放回贴着心口的口袋；一颗小心。（里程碑：举高日历，两只都跳起来，一串星星）
      S.hold(man, ['p_gaze', 'p_hold']); S.face(man, 'soft');
      yield 0.8;
      if (mile) {
        S.hold(man, ['p_cheer', 'p_cheer2']); S.face(man, 'grin');
        S.hop(dax, 110); S.hop(gold, 70);
        S.bits(man.x, man.y - 30, 8, 'spark', 26, 40);
        yield 1.0;
      }
      S.act(man, 'proud_nod', 0.8);
      S.hold(man, ['p_pocket', 'p_hold']); S.item(man, null); S.emote('hs', man, 0, 1.0);
      yield 0.8;
      S.hold(man, null);
    },
  });

  // ============================================================
  //  D12 见面前一天：坐在岛下面等（狗会在窗口等它爱的人；这三个在等那个日子）
  // ============================================================
  add({ name: 'waiting_at_the_window', zh: '见面前一天：坐在岛下面等', cast: 'dax gold man', weight: 8, cap: 3, cool: 10800, tag: 'calm', mood: 'tender', timeout: 70,
    when: function (S) {
      var n = S.reunion(), I = S.island();
      return (n === 1 || (n === 0 && !S.mem.get('reunionDone'))) && !!(I && I.on && S.roam) && S.her.present;
    },
    run: function* (S) {
      var dax = S.dax, gold = S.gold, man = S.man, I = S.island(), F = S.field, i;
      if (!I) return;
      S.ball.pocket();
      // 1. 两只走到岛底下（倒数就显示在那儿），并排坐好往上看；金毛稳稳的，尾巴像节拍器；小腊肠坐下、站起、又坐下
      var a = S.go(dax, I.x + 12, I.y + 6, S.spd(dax, 'trot'), null, 8);
      var b = S.go(gold, I.x - 18, I.y + 4, S.spd(gold, 'walk') * 1.5, null, 8);
      yield S.all(a, b);
      S.hold(dax, 'sit'); S.hold(gold, 'sit'); dax.look = 1; gold.look = 1; gold.wag = 0.5;
      yield 0.8;
      S.hold(dax, 'stand');
      yield 0.5;
      S.hold(dax, 'sit');
      // 2. 小腊肠小声哼了一下，扒在金毛肩膀上想看得更高
      S.emote('note', dax, 0, 0.8);
      S.faceTo(dax, gold); S.hold(dax, ['rear', 'beg']); S.rig(dax, { pawAt: [dax.face * 10, 16] });
      yield 1.6;
      // 3. 金毛低头看它一眼，又抬头看那个数字。他背着手走到它们后面，也抬头看
      S.look(gold, dax);
      yield 0.6;
      S.look(gold, null); gold.look = 1;
      S.rig(dax, null); S.hold(dax, 'sit'); dax.look = 1;
      yield S.go(man, I.x - 2, cy(S, I.y), 22, ['p_behind', 'p_walk0'], 6);
      S.hold(man, ['p_behind', 'p_idle']); S.look(man, { x: I.x, y: I.y, z: 60 }); S.face(man, 'soft');
      // 4. 三个一动不动地抬头看；每过一阵子小腊肠跑到近的那边屏幕边上看看"门"，再跑回来
      var end = S.t() + S.rand(30, 45);
      while (S.t() < end) {
        yield 12;
        if (S.t() >= end) break;
        var ex = dax.x < (F.x0 + F.x1) / 2 ? F.x0 + 20 : F.x1 - 20;
        S.hold(dax, 'stand'); dax.look = 0;
        yield S.go(dax, ex, dax.y, S.spd(dax, 'trot'), null, 4);
        S.look(dax, { x: ex + (ex < I.x ? -40 : 40), y: dax.y, z: 10 });
        yield 0.8;
        S.look(dax, null);
        yield S.go(dax, I.x + 12, I.y + 6, S.spd(dax, 'trot'), null, 4);
        S.hold(dax, 'sit'); dax.look = 1;
      }
      S.hold(man, null);
    },
  });

  // ============================================================
  //  D13 纪念日：把礼物送到她鼠标边（金毛天生就是干这个的：把东西轻轻地送到人手里）
  // ============================================================
  function giftOf(kind) { return kind === 'birthday' ? 'cake' : (kind === 'anniversary' ? 'flower' : (kind === 'note' ? 'envelope' : 'gift')); }
  add({ name: 'special_delivery', zh: '纪念日：把礼物送到她鼠标边', kind: 'react', on: 'date', cast: 'man gold dax', tag: 'calm', mood: 'proud', keep: 300, timeout: 70,
    when: function (S, ev) { return !!ev && ev.kind !== 'reunion' && !!S.cursor.known; },
    run: function* (S, ev) {
      var man = S.man, gold = S.gold, dax = S.dax, kind = ev.kind || 'gift', g = giftOf(kind), courier = g === 'envelope' ? dax : gold, other = courier === gold ? dax : gold;
      var spr = g === 'cake' ? (S.hasFx('cake_lit') ? 'cake' : null) : (g === 'gift' ? 'gift' : g), state = g === 'cake' ? 'lit' : (g === 'gift' ? 'wrapped' : '');
      S.ball.pocket();
      // 1. 从西装内袋里拿出礼物，弯腰递给送信的那只（蛋糕他自己端）
      S.hold(man, ['p_pocket', 'p_hold']);
      yield 0.5;
      var box = S.prop.spawn(g, state, man.x, man.y, { hot: false });
      S.prop.carry(box, man, g === 'cake' ? 'arms' : 'hand');
      S.face(man, 'smile');
      if (courier !== null && g !== 'cake') {
        yield S.go(courier, S.atHand(courier), S.spd(courier, 'trot'), null, 5);
        S.faceTo(courier, man); S.faceTo(man, courier);
        S.hold(man, ['p_place', 'p_crouch']);
        yield 0.5;
        // 2. 它用最轻的嘴接过去，尾巴转成螺旋桨；另一只头上多了一个蝴蝶结
        S.prop.carry(box, courier, 'mouth'); S.rig(courier, { jaw: 0.3 }); courier.wag = 1;
        if (S.hasFx('ribbon')) { var rb = S.prop.spawn('ribbon', '', other.x, other.y, { shadow: false }); S.prop.carry(rb, other, 'headTop'); }
        S.hold(man, null);
        yield 0.6;
      } else {
        S.hold(man, ['p_carry', 'p_hold']);
      }
      // 3. 小心翼翼地横穿屏幕送到她鼠标下面；另一只在旁边护送
      var carrier = g === 'cake' ? man : courier;
      var to = S.toCursor(carrier, 16) || { x: carrier.x, y: carrier.y };
      S.follow(other, carrier, other.half + 14, S.ry(3), S.spd(other, 'walk') * 1.3);
      yield S.go(carrier, to, carrier === man ? 18 : S.spd(carrier, 'walk') * 1.2, carrier === man ? ['p_carry', 'p_hold'] : null, 12);
      S.stop(other);
      // 4. 坐下，把礼物放在她鼠标下面 30 的地方，用鼻子往前拱一下，往后退；另一只坐好作揖
      S.faceTo(carrier, 'cursor');
      var c30 = S.below(30) || { x: carrier.x, y: carrier.y };
      if (carrier !== man) S.hold(carrier, 'sit'); else S.hold(man, ['p_place', 'p_crouch']);
      yield 0.4;
      S.prop.drop(box, cx(S, carrier.x + carrier.face * ((carrier.mx || 6) + 4)), c30.y);
      S.rig(carrier, null);
      if (carrier !== man) { yield S.act(carrier, 'nudge', 0.6); yield S.slide(carrier, -carrier.face * 8, 0, 0.6); }
      else { S.hold(man, null); yield S.go(man, cx(S, man.x - man.face * 20), man.y, 20, null, 2); }
      S.faceTo(other, 'cursor'); S.hold(other, ['beg', 'sit']);
      S.prop.hot(box, { dwell: 0.2 });
      // 5. 都看看礼物，再看看她。她点（或者在蛋糕上一扫：吹蜡烛）——丝带弹开 / 火苗一歪灭了；心和星星；狗狗蹦；他挥手（纪念日鞠躬），说那天写好的话
      note.gift = 0;
      S.look(gold, box); S.look(dax, box);
      var t0 = S.t();
      yield S.until(function () { if (S.t() - t0 > 1.5) { S.look(gold, 'cursor'); S.look(dax, 'cursor'); } return note.gift === 1; }, 30);
      if (note.gift === 1) {
        note.gift = 0;
        var w = S.prop.where(box);
        if (g === 'cake') { S.prop.set(box, 'bent'); yield 0.3; S.prop.set(box, 'out'); S.emoteAt('wisp', w.x, w.y - 12, 1.0); }
        else if (g === 'gift') S.prop.set(box, 'open');
        S.emoteAt('heart', w.x - 6, w.y - 16, 1.2); S.emoteAt('spark', w.x + 6, w.y - 14, 0.8);
        S.bits(w.x, w.y - 6, 8, 'heart', 22, 40);
        S.hold(gold, 'stand'); S.hold(dax, 'stand'); S.hop(dax, 110); S.hop(gold, 70); gold.wag = 1; dax.wag = 1;
        S.look(man, 'camera');
        S.hold(man, kind === 'anniversary' ? ['p_bow', 'p_front'] : { f: ['p_wave_a', 'p_wave_b'], fps: 5 }); S.face(man, 'blush');
        if (ev.line) S.sayText(ev.line);
        yield 2.0;
        S.prop.hot(box, false);
        S.mem.set('giftDue', null);
        yield 1.0;
        return;
      }
      // 6. 她没点：金毛趴下，把礼物护在两只前爪中间，安安静静地等一会儿（不催）；
      //    还是没点：他把礼物收回口袋——晚上再送一次（屏幕上不留东西）
      S.hold(gold, 'lie'); S.rig(gold, { chin: true }); S.look(gold, 'cursor');
      var w2 = S.prop.where(box);
      if (gold.x !== undefined) yield S.go(gold, S.beside(gold, { x: w2.x, y: w2.y, half: 4, mx: 4 }, -4), S.spd(gold, 'walk'), null, 3);
      S.hold(gold, 'lie'); S.rig(gold, { chin: true });
      yield S.until(function () { return note.gift === 1; }, 20);
      if (note.gift === 1) {
        note.gift = 0;
        S.prop.set(box, g === 'cake' ? 'out' : (g === 'gift' ? 'open' : ''));
        S.emoteAt('heart', w2.x, w2.y - 16, 1.2); S.bits(w2.x, w2.y - 6, 8, 'heart', 22, 40);
        S.rig(gold, null); S.hold(gold, 'stand'); gold.wag = 1; S.look(man, 'camera'); S.face(man, 'blush');
        if (ev.line) S.sayText(ev.line);
        S.mem.set('giftDue', null);
        yield 1.6;
        return;
      }
      S.rig(gold, null); S.hold(gold, 'stand');
      yield S.go(man, S.beside(man, { x: w2.x, y: w2.y, half: 4, mx: 4 }, 2), 24, null, 4);
      S.hold(man, ['p_place', 'p_crouch']);
      yield 0.5;
      S.prop.remove(box, false); S.hold(man, ['p_pocket', 'p_hold']); S.emote('spark', man, 0, 0.5);
      if (!S.mem.get('giftDue') || S.mem.get('giftDue').day !== S.time.ymd) S.mem.set('giftDue', { day: S.time.ymd, kind: kind, line: ev.line || '' });
      else S.mem.set('giftDue', null);
      yield 0.6;
    },
  });
  // 白天没打开的礼物：晚上再送一次（只送这一次）
  add({ name: 'special_delivery_evening', zh: '纪念日：晚上再送一次礼物', cast: 'man gold dax', weight: 8, cap: 1, tag: 'calm', mood: 'proud', timeout: 70,
    when: function (S) { var d = S.mem.get('giftDue'); return !!d && d.day === S.time.ymd && S.time.h >= 19 && !S.night() && !!S.cursor.known && S.her.present; },
    run: function* (S) {
      var d = S.mem.get('giftDue');
      S.mem.set('giftDue', { day: '', kind: '', line: '' });
      var def = null;
      for (var i = 0; i < L.length; i++) if (L[i].name === 'special_delivery') def = L[i];
      if (def) yield* def.run(S, { name: 'date', kind: d.kind, line: d.line, days: 0 });
      S.mem.set('giftDue', null);
    },
  });
  // 礼物 / 蛋糕 / 花被点了（或者在蛋糕上扫了一下）：告诉正在演的那一段；那一段已经演完了的话，就在这里打开。
  // 只是叠在他身上的小反应（overlay）：不抢演员，不打断正在演的戏
  add({ name: 'gift_opened', zh: '她打开了礼物', kind: 'react', on: ['click', 'sweep'], cast: 'man', overlay: true, tag: 'hers', mood: 'proud', timeout: 6,
    when: function (S, ev) { var k = ev && ev.kind; return !!ev.prop && (k === 'gift' || k === 'cake' || k === 'flower' || k === 'envelope' || k === 'bouquet'); },
    run: function* (S, ev) {
      var p = ev && ev.prop;
      if (!p) return;
      if (p.kind === 'bouquet' && S.playing('reunion_day')) { note.bouquet = 2; return; }
      if (S.playing('special_delivery')) { note.gift = 1; return; }
      var w = S.prop.where(p);
      if (p.kind === 'cake') { S.prop.set(p, 'out'); S.emoteAt('wisp', w.x, w.y - 12, 1.0); }
      else if (p.kind === 'gift') S.prop.set(p, 'open');
      S.emoteAt('heart', w.x, w.y - 16, 1.2); S.bits(w.x, w.y - 6, 6, 'heart', 18, 34);
      S.look(S.man, 'camera'); S.face(S.man, 'blush');
      S.prop.hot(p, false); p.cap = Math.max(1, (S.now() - p.born) + 20);
      yield 1.4;
    },
  });

  // ============================================================
  //  D14 见面那天（那块一直在看的表，终于收进口袋）
  // ============================================================
  add({ name: 'reunion_day', zh: '见面那天', kind: 'react', on: 'date', cast: 'man dax gold', tag: 'calm', mood: 'proud', keep: 300, timeout: 60,
    when: function (S, ev) { return !!ev && ev.kind === 'reunion' && ev.days === 0 && S.mem.get('reunionDone') !== S.time.ymd; },
    run: function* (S) {
      var man = S.man, dax = S.dax, gold = S.gold, F = S.field, i;
      S.mem.set('reunionDone', S.time.ymd);
      S.ball.pocket();
      // 1. 岛鼓一下；两只狗戴着蝴蝶结冲出来，各自全速跑一整圈
      S.pulse('bulge');
      if (S.hasFx('ribbon')) {
        var r1 = S.prop.spawn('ribbon', '', dax.x, dax.y, { shadow: false }); S.prop.carry(r1, dax, 'headTop');
        var r2 = S.prop.spawn('ribbon', '', gold.x, gold.y, { shadow: false }); S.prop.carry(r2, gold, 'headTop');
      }
      var mid = { x: (F.x0 + F.x1) / 2, y: (F.y0 + F.y1) / 2 }, rx = (F.x1 - F.x0) / 2 - 40, ryy = (F.y1 - F.y0) / 2 - 10;
      var a = S.orbit(dax, mid, rx, ryy, 1, S.spd(dax, 'run'));
      var b = S.orbit(gold, mid, rx * 0.8, ryy * 0.8, 1, S.spd(gold, 'run') * 0.8);
      // 2. 他拿着一束花；最后看一次表，摘下来收进口袋：不用再数了
      S.item(man, 'bouquet'); S.hold(man, 'p_hold'); S.face(man, 'proud');
      yield 0.8;
      S.hold(man, 'p_watch'); S.face(man, 'soft');
      yield 1.0;
      S.hold(man, ['p_pocket', 'p_hold']); S.face(man, 'grin');
      yield 0.8;
      // 3. 走到下面正中间，正对着她，鞠一躬，双手把花递出来
      yield S.go(man, lowPt(S, (F.x0 + F.x1) / 2), 26, null, 8);
      S.hold(man, ['p_offer', 'p_front']); S.look(man, 'camera'); S.face(man, 'blush');
      yield S.any(S.all(a, b), 4);
      S.stop(dax); S.stop(gold);
      yield S.go(dax, cx(S, man.x + 30), man.y + S.ry(4), S.spd(dax, 'trot'), null, 4);
      yield S.go(gold, cx(S, man.x - 36), man.y + S.ry(2), S.spd(gold, 'trot'), null, 4);
      S.faceTo(dax, man); S.faceTo(gold, man); S.hold(dax, 'sit'); S.hold(gold, 'sit');
      // 4. 他弯腰把花轻轻放在她面前的草地上（她可以点）。她点了：花瓣和星星；三个各冒一颗心；他说那句话
      S.hold(man, ['p_place', 'p_crouch']);
      yield 0.5;
      S.item(man, null);
      var bq = S.prop.spawn('bouquet', '', cx(S, man.x + man.face * 10), cy(S, man.y + S.ry(6)), { hot: { dwell: 0.15 } });
      S.hold(man, ['p_offer', 'p_front']); S.look(man, 'camera'); S.face(man, 'blush');
      note.bouquet = 1;
      yield S.until(function () { return note.bouquet === 2 || !S.prop.alive(bq); }, 25);
      var clicked = note.bouquet === 2;
      note.bouquet = 0;
      S.prop.hot(bq, false);
      if (clicked) {
        var w = S.prop.where(bq);
        S.bits(w.x, w.y - 4, 10, ['#ff99aa', '#ffc2cc', '#ff5c85'], 26, 34);
        S.emoteAt('spark', w.x, w.y - 10, 0.8);
        S.emote('heart', man, 0, 1.2);
        yield 0.3;
        S.emote('heart', dax, 0, 1.2);
        yield 0.3;
        S.emote('heart', gold, 0, 1.2);
        S.say('reunion', ['終於見到你了', '终于见到你了', 'Finally, you']);
        yield 0.6;
      }
      S.prop.remove(bq, true);
      // 5. 狗狗围着他跳；他把小腊肠高高举起来，金毛扑在他身上；下面半个屏幕飘彩纸
      S.item(man, null);
      S.hold(dax, 'stand'); S.hold(gold, 'stand'); dax.wag = 1; gold.wag = 1;
      yield S.go(dax, S.manAt(dax, 8), S.spd(dax, 'trot'), null, 2);
      S.hold(man, ['p_reach', 'p_cheer']); S.face(man, 'laugh');
      S.attach(dax, man, 'hand', 0, 2, false, 1); S.hold(dax, ['held', 'stand']); S.rig(dax, { stiff: true });
      yield S.go(gold, cx(S, man.x - man.face * 14), man.y + S.ry(1), S.spd(gold, 'trot'), null, 2);
      S.faceTo(gold, man); S.hold(gold, ['rear', 'beg']); S.rig(gold, { pawAt: [gold.face * 6, 22] });
      var conf = ['#ff5c85', '#ffd342', '#67adeb', '#8fd16a', '#ffffff'];
      for (i = 0; i < 8; i++) {
        S.bits(S.rand(F.x0 + 20, F.x1 - 20), F.y1 - (F.y1 - F.y0) * S.rand(0.3, 0.5), 5, conf, 20, 10);
        yield 0.6;
      }
      S.rig(dax, null); S.detach(dax, 40); S.rig(gold, null); S.hold(gold, 'stand');
      S.hold(man, null);
      yield 0.8;
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
