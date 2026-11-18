// 球球 · 戏包：照料（喂饭、喝水、上厕所、收拾）
//
// 这些戏 kind 都是 'care'，由引擎里的"照料导演"按账本（needs.js）开演：
//   care: 'meal' 开饭 · 'biscuit' 饼干 · 'fullgag' 吃饱啦 · 'water' 喝水 · 'potty' 上厕所 · 'pottyHome' 回岛里解决 ·
//   'cleanup' 他收拾 · 'herclean' 她点了一下便便以后 · 'morning' 今天头一回出岛
// ev 里是导演给的东西：开饭 { kind: 'full' | 'snack', by: 'auto' | 'her', spot: { x, y, g } }，上厕所 { dog, spot: { x, y, face } }，
// 收拾 { poop, dog }。账本的那几笔（吃过了、拉过了、收过了）用 S.care.* 记。
// 规矩和每一拍的样子见 R6-care.md 第 2 节；这里是能跑通的第一版（花样以后再加）。
(function (G) {
  'use strict';
  var L = G.PET_SCENES = G.PET_SCENES || [];
  function add(r) { r.pack = 'care'; r.kind = 'care'; L.push(r); }
  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  var TXT = {
    meal: ['開飯囉！', '开饭啦！', 'Dinner time!'],
    thanks: ['謝謝你～', '谢谢你～', 'Thank you!'],
    full: ['吃不下了～', '吃不下啦～', "We're full!"],
  };
  // 从口袋里掏东西（口袋是无底的；灰和小星星引擎会配上）
  function* pocket(S, item) {
    S.hold(S.man, 'p_pocket');
    yield 0.45;
    S.item(S.man, item || null);
  }

  // ============================================================
  //  开饭（R6 2.1）：叫 → 掏碗 → 摆碗、倒粮 → 等 → 开动（碗带着吃）→ 喝水 → 收碗
  // ============================================================
  add({ name: 'care_meal', zh: '开饭', care: 'meal', cast: 'man dax gold', timeout: 110,
    run: function* (S, ev) {
      var man = S.man, dax = S.dax, gold = S.gold, sp = ev.spot, g = sp.g, mx = sp.x, my = sp.y, EAT = S.care.EAT, reach = 11;
      var hurry = function () { return !!ev.hurry || ev.by === 'her'; };
      var BG = { x: mx - g * 34, y: my + S.ry(4) }, BD = { x: mx + g * 30, y: my + S.ry(4) }, W = { x: mx - g * 2, y: my + S.ry(8) };
      var snack = ev.kind === 'snack';
      // A. 叫大家：看看表，转过来笑
      S.hold(man, 'p_watch'); S.face(man, 'focus');
      S.hold(gold, 'alert'); S.hold(dax, 'alert'); S.emote('bang', dax, 0, 0.6);
      yield hurry() ? 0.4 : 1.2;
      S.hold(man, 'p_front'); S.face(man, 'grin');
      if (!S.say('meal', TXT.meal)) S.emote('food', man);
      S.hop(dax, 110); dax.bark = 0.3; S.hold(gold, 'stand'); gold.wag = 0.9;
      yield 0.8;
      // B. 球收进口袋，掏出一摞碗；两只狗跟着他走
      S.ball.pocket();
      yield* pocket(S, 'bowls_stack_bag');
      S.hold(man, 'p_carry'); S.face(man, 'soft');
      S.follow(dax, man, 14, S.ry(5), S.spd(dax, 'run') * 0.8);
      S.follow(gold, man, 34, S.ry(-3), 'trot');
      S.look(gold, man);
      yield S.go(man, mx, my, hurry() ? 46 : 30, 'p_carry', 14);
      // C. 摆碗：先金毛的，再小腊肠的；两只狗各自坐到等的地方
      S.go(gold, BG.x - g * (EAT + 8), BG.y, 'trot'); S.go(dax, BD.x + g * (EAT + 8), BD.y, 'trot');
      yield S.go(man, BG.x + g * reach, my, 40, 'p_carry', 6);
      S.faceTo(man, BG); S.hold(man, 'p_place');
      yield 0.5;
      var bg = S.prop.spawn('bowl_gold', 'empty', BG.x, BG.y, { care: true, keep: true, amount: 0 });
      yield S.go(man, BD.x - g * reach, my, 40, 'p_carry', 6);
      S.faceTo(man, BD); S.hold(man, 'p_place');
      yield 0.5;
      var bd = S.prop.spawn('bowl_dax', 'empty', BD.x, BD.y, { care: true, keep: true, amount: 0 });
      S.item(man, 'kibble_bag_closed');
      S.faceTo(gold, bg); S.hold(gold, 'sit'); gold.wag = 0.6; S.look(gold, bg);
      S.faceTo(dax, bd); S.hold(dax, ['taps', 'sit']); dax.wag = 1; S.look(dax, bd);
      // 坐好、等（她让开饭的时候不吊胃口）
      if (!hurry()) {
        S.hold(man, 'p_stay'); S.face(man, 'focus'); S.faceTo(man, gold);
        yield 0.6;
        S.faceTo(man, dax); S.hold(dax, 'sit');
        yield 0.6;
      }
      // 倒粮：一碗一碗满起来
      var bowls = [[bg, BG.x + g * reach, gold, 1.6], [bd, BD.x - g * reach, dax, 1.0]], i;
      for (i = 0; i < 2; i++) {
        var b = bowls[i][0], full = snack ? 0.5 : 1, dur = (hurry() ? 0.6 : 1) * bowls[i][3];
        yield S.go(man, bowls[i][1], my, 40, null, 4);
        S.faceTo(man, b); S.item(man, 'kibble_bag_pour'); S.hold(man, 'p_pour');
        yield S.each(dur, function (t) {
          b.amount = full * Math.min(1, t / dur);
          S.prop.set(b, b.amount > 0.55 ? 'full' : (b.amount > 0.01 ? 'half' : 'empty'));
          if (S.chance(0.12)) S.bits(b.x, b.y - 5, 1, 'kibble', 6, 12);
        });
        S.item(man, 'kibble_bag_closed'); S.hold(man, 'p_carry');
        if (bowls[i][2] === gold && S.hasFx('fx_drool0')) S.emote('drool0', gold, gold.face * 6, 1.2);
      }
      S.item(man, null);
      yield S.go(man, mx, my - S.ry(6), 30, null, 4);
      if (!hurry()) { S.hold(man, 'p_stay'); S.face(man, 'focus'); yield S.rand(1, 1.6); }
      S.hold(man, 'p_point'); S.emote('note', man); S.face(man, 'grin');
      // D. 开动：碗带着它们吃（被叫走也会回来接着吃），他拿回球在旁边看着
      S.care.eat(dax, bd, snack ? 1 / 5 : null);
      S.care.eat(gold, bg, snack ? 1 / 10 : null);
      yield 0.6;
      S.ball.home(); S.hold(man, 'p_hold'); S.face(man, 'soft');
      yield S.until(function () { return !S.care.eating(dax) && !S.care.eating(gold); }, 40);
      S.hold(man, null);
      // E. 喝水（正餐才有）
      if (!snack && S.cfg.care && S.cfg.care.water !== false && S.join(gold) && S.join(dax)) {
        S.ball.pocket();
        yield* pocket(S, 'bowl_water_full');
        yield S.go(man, W.x + g * reach, W.y, 40, null, 4);
        S.faceTo(man, W); S.hold(man, 'p_place');
        yield 0.5;
        S.item(man, null);
        var bw = S.prop.spawn('bowl_water', 'full', W.x, W.y, { care: true, keep: true, cap: 45 });
        yield S.go(gold, W.x - g * EAT, W.y, 'walk', null, 5);
        S.faceTo(gold, bw); S.hold(gold, ['drink', 'eat']);
        yield 1.5;
        yield S.go(dax, W.x + g * EAT, W.y, 'trot', null, 4);
        S.faceTo(dax, bw); S.hold(dax, ['drink', 'eat']); S.emote('hs', dax, 0, 1);
        yield S.each(2.5, function () { if (S.chance(0.06)) S.bits(bw.x, bw.y - 3, 1, 'water', 8, 14); });
        S.prop.set(bw, 'low');
        S.hold(gold, ['lickchops', 'sit']); S.hold(dax, ['lickchops', 'sit']);
        S.care.drank();
        yield 0.8;
        S.leave(gold); S.leave(dax);
      }
      // F. 收碗：一个一个收回口袋，拍拍手
      S.ball.pocket();
      var all = S.prop.all(), k;
      for (k = 0; k < all.length; k++) {
        var p = all[k];
        if (!/^bowl/.test(p.kind)) continue;
        yield S.go(man, p.x + (man.x < p.x ? -reach : reach), p.y - S.ry(1), 40, null, 3);
        S.faceTo(man, p); S.hold(man, 'p_place');
        yield 0.4;
        S.prop.remove(p, false);
        S.item(man, 'bowls_stack_empty'); S.hold(man, 'p_carry');
      }
      yield* pocket(S, null);
      S.hold(man, ['p_dust', 'p_idle']); S.face(man, 'smile');
      yield 0.5;
      S.care.mealDone();
      // 她让开的饭：两只狗跑到她鼠标旁边谢她，他鞠个躬
      if (ev.by === 'her') {
        S.ball.home();
        var spotD = S.toCursor(dax), spotG = S.toCursor(gold);
        if (S.join(dax) && S.join(gold)) {
          if (spotD && spotG) {
            if (Math.abs(spotD.x - spotG.x) < 30) spotG = { x: spotD.x + (spotD.x > S.cursor.x ? 30 : -30), y: spotD.y };
            S.go(dax, spotD, 'run', null, 4);
            yield S.go(gold, spotG, 'trot', null, 4);
            S.faceTo(dax, 'cursor'); S.faceTo(gold, 'cursor');
          }
          S.hop(dax, 110); S.emote('heart', dax); S.hold(gold, ['paw', 'sit']); S.emote('heart', gold, 0, 1.2);
        }
        S.hold(man, ['p_bow', 'p_front']); S.face(man, 'smile');
        if (!S.say('thanks', TXT.thanks)) S.emote('heart', man);
        yield 1.4;
      }
    },
  });

  // ============================================================
  //  饼干（R6 2.4 care_biscuit：就是老的"发零食"）；吃饱啦；喝水
  // ============================================================
  add({ name: 'care_biscuit', zh: '下午的小饼干', care: 'biscuit', cast: 'man dax gold', timeout: 30,
    run: function* (S, ev) {
      if (ev.sleepy) { S.face(S.man, 'yawn'); S.mood(S.dax, 'sleepy'); S.mood(S.gold, 'sleepy'); }
      yield* S.run('treat');
      if (ev.hand) S.care.mealDone(); else S.care.biscuitDone(ev.by);
    },
  });
  add({ name: 'care_full_gag', zh: '吃饱啦', care: 'fullgag', cast: 'man dax gold', timeout: 15,
    run: function* (S) {
      var man = S.man;
      S.hold(man, 'p_front'); S.face(man, 'oops');
      yield 0.3;
      S.hold(man, ['p_pocket', 'p_front']);
      yield 0.4;
      S.hold(man, ['p_shrug', 'p_front']); S.emote('sweat', man);
      S.hold(S.dax, 'roll'); S.hold(S.gold, 'lie'); S.emote('sigh', S.gold);
      yield 1.2;
      S.emote('dots', man);
      yield 0.8;
      S.emote('heart', S.dax); S.emote('heart', S.gold);
      S.hold(man, { f: ['p_wave_a', 'p_wave_b'], fps: 5 }); S.face(man, 'smile');
      S.say('full', TXT.full);
      yield 1.2;
    },
  });
  add({ name: 'care_water', zh: '喝水', care: 'water', cast: 'man dog', timeout: 45,
    run: function* (S) {
      var man = S.man, d = S.dog, o = S.other, EAT = S.care.EAT;
      yield S.go(d, S.atHand(d), 'walk', null, 8);
      S.faceTo(d, man); S.hold(d, 'sit'); d.pant = true;
      S.ball.pocket();
      yield* (function* () { S.hold(man, 'p_pocket'); yield 0.45; S.item(man, 'bowl_water_full'); })();
      var at = S.inFront(d, EAT, 0);
      S.faceTo(man, d); S.hold(man, 'p_place');
      yield 0.5;
      S.item(man, null);
      var bw = S.prop.spawn('bowl_water', 'full', at.x, at.y, { care: true, cap: 45 });
      S.hold(man, null); S.ball.home();
      d.pant = false; S.hold(d, ['drink', 'eat']);
      yield S.each(3.5, function () { if (S.chance(0.07)) S.bits(bw.x, bw.y - 3, 1, 'water', 8, 14); });
      S.hold(d, ['lickchops', 'sit']);
      if (S.join(o)) {
        yield S.go(o, bw.x + (o.x < bw.x ? -EAT : EAT), bw.y, 'trot', null, 5);
        S.faceTo(o, bw); S.hold(o, ['drink', 'eat']);
        yield 2.5;
        S.hold(o, ['lickchops', 'sit']);
      }
      S.prop.set(bw, 'low');
      S.care.drank();
      yield 0.6;
      S.faceTo(man, bw); S.hold(man, 'p_place');
      yield 0.4;
      S.prop.remove(bw, false);
      S.hold(man, ['p_dust', 'p_idle']);
      yield 0.5;
    },
    end: function (S, cancelled) { if (cancelled) S.care.drank(); },        // 被打断了也算喝过（不然一会儿又要来）
  });

  // ============================================================
  //  上厕所（R6 2.5）：找好的地方 → 走过去 → 转圈 → 蹲（这一段不让丢球打断）→ 拉 → 往前走两步、刨两下 → 走开
  // ============================================================
  function* squatAndDrop(S, d, P, squatSec, dropAt) {
    S.hold(d, ['squat', 'sit']);
    S.commit(squatSec + 0.3);                // 蹲着的这一段：她丢球也等它蹲完（拎起来不等）
    var p = null, dropped = false;
    yield S.each(squatSec, function (t) {
      if (!dropped && t >= squatSec * dropAt) {
        dropped = true;
        p = S.care.poop(d, P.x, P.y + S.ry(0.5));
        if (p) {
          var st = p.state;
          if (S.hasFx('poop_' + st + '_pop')) { S.prop.set(p, st + '_pop'); p.data.unpop = S.now() + 0.06; p.data.st = st; }
          S.emoteAt('spark', p.x, p.y - 7, 0.5);
          if (S.hasFx('fx_wisp')) S.emoteAt('wisp', p.x, p.y - 4, 1.2);
          if (st === 'gold') { S.emoteAt('clover', p.x, p.y - 10, 1.6); S.emoteAt('spark', p.x - 4, p.y - 9, 0.5); }
        }
      }
      if (p && p.data.unpop && S.now() >= p.data.unpop) { S.prop.set(p, p.data.st); p.data.unpop = 0; }
    });
    if (p && p.data.unpop) S.prop.set(p, p.data.st);
    return p;
  }
  // 那个地方还行吗（站的位置没被挤开，规矩也都还满足）
  function spotOK(S, d, P, C) { return Math.abs(d.x - C.x) <= 4 && Math.abs(d.y - C.y) <= 4 && !S.care.rule(d.kind, P.x, P.y); }
  add({ name: 'potty_dax', zh: '小腊肠：突然很急', care: 'potty', cast: 'dog', timeout: 30,
    when: function (S, ev) { return ev.dog === S.dax; },
    run: function* (S, ev) {
      var d = S.dog, P = ev.spot, face = P.face, C = { x: P.x + face * S.care.REAR, y: P.y };
      // 1. 一下子定住
      S.hold(d, 'alert'); S.emote('bang', d, 0, 0.6);
      yield 0.5;
      // 2. 冲过去，最后一段低头闻
      var near = { x: C.x - face * 30, y: C.y };
      if (dist(d, C) > 34) yield S.go(d, near, 'trot', null, 6);
      yield S.go(d, C.x - face * 6, C.y + S.ry(3), 'trot', 'sniff', 2);
      yield S.go(d, C.x, C.y, 'trot', 'sniff', 2);
      // 3. 转三圈，转完朝着屏幕中间、屁股对着那一点
      yield S.each(1.4, function (t) { d.face = (Math.floor(t / 0.4) % 2) ? -face : face; });
      d.face = face;
      if (!spotOK(S, d, P, C)) { S.care.abort(d); S.hold(d, 'alert'); S.emote('q', d, 0, 0.8); yield 1; return; }
      // 4-5. 蹲，拉
      S.mood(d, 'worried'); S.look(d, S.cursor.known && S.dist(S.cursor, d) < 250 ? 'cursor' : S.man);
      if (S.cursor.known && S.dist(S.cursor, d) < 120) { S.emote(S.hasFx('fx_blush') ? 'blush' : 'hs', d, 0, 1.2); S.look(d, null); }
      else S.emote(S.hasFx('fx_dots') ? 'dots' : 'q', d, 0, 1.2);
      var p = yield* squatAndDrop(S, d, P, S.rand(2.2, 3.0), 0.7);
      if (!p) { S.care.abort(d); S.hold(d, 'stand'); S.emote('q', d, 0, 0.8); yield 0.8; return; }      // 没拉成（地方被占了）：过一会儿换个地方
      // 6. 舒服了，往前走两步（刨土的时候脚碰不到它）
      S.mood(d, 'happy'); S.hold(d, 'stand'); S.emote('note', d); S.look(d, null);
      yield S.go(d, C.x + face * 12, C.y, 'walk', null, 1.5);
      // 7. 往后刨两下草
      if (p && S.chance(0.7)) {
        d.face = face; S.hold(d, ['kick', 'dig']);
        yield S.each(S.rand(1.0, 1.4), function () { if (S.chance(0.12)) S.bits(d.x - face * 10, d.y - 1, 1, S.grass(), 22, 30); });
      }
      // 8. 走开：疯跑一圈，或者跑到小人前面坐好
      S.hold(d, 'stand');
      if (S.chance(0.5)) {
        d.pant = true;
        for (var i = 0; i < 2; i++) { var q = S.randPt(80 * S.SK, d); if (p && dist(q, p) < 40) continue; yield S.go(d, q, 'run', null, 3); }
        S.faceTo(d, S.man); S.hold(d, 'bow'); d.wag = 1;
      } else {
        yield S.go(d, S.inFront(S.man, 22, 2), 'trot', null, 6);
        S.faceTo(d, S.man); S.hold(d, 'sit'); S.mood(d, 'proud'); d.wag = 1;
      }
      yield 0.8;
    },
  });
  add({ name: 'potty_gold', zh: '金毛：绅士的仪式', care: 'potty', cast: 'dog', timeout: 30,
    when: function (S, ev) { return ev.dog === S.gold; },
    run: function* (S, ev) {
      var d = S.dog, P = ev.spot, face = P.face, C = { x: P.x + face * S.care.REAR, y: P.y };
      // 1. 慢慢起来，看看小人，转身朝他的那个角落
      S.hold(d, 'stand');
      yield 0.8;
      S.faceTo(d, S.man); S.look(d, S.man);
      yield 0.6;
      S.look(d, null);
      // 2. 走过去，最后一段低头闻
      var far = dist(d, C);
      if (far > 40) yield S.go(d, C.x - face * 34, C.y, far > 250 ? 'trot' : 31, null, 12);
      yield S.go(d, C.x, C.y, 'sniff', 'sniff', 4);
      // 3. 慢慢转一圈坐定
      yield S.each(1.2, function (t) { d.face = t < 0.6 ? -face : face; });
      d.face = face;
      if (!spotOK(S, d, P, C)) { S.care.abort(d); S.hold(d, 'stand'); S.emote(S.hasFx('fx_dots') ? 'dots' : 'q', d, 0, 1); yield 1; return; }
      // 4-5. 蹲：头抬得高高的，看着远处
      S.mood(d, 'focused');
      if (S.cursor.known && S.dist(S.cursor, d) < 150) S.emote(S.hasFx('fx_blush') ? 'blush' : 'hs', d, 0, 1.2);
      var p = yield* squatAndDrop(S, d, P, S.rand(3.5, 5), 0.75);
      if (!p) { S.care.abort(d); S.hold(d, 'stand'); S.emote(S.hasFx('fx_dots') ? 'dots' : 'q', d, 0, 1); yield 0.8; return; }
      // 6. 站起来往前走三步，回头看一眼
      S.mood(d, null); S.hold(d, 'stand');
      yield S.go(d, C.x + face * 16, C.y, 'walk', null, 2);
      d.face = -face; yield 0.5; d.face = face; d.wag = 0.5;
      // 7. 偶尔刨两下，再甩甩毛
      if (p && S.chance(0.25)) {
        S.hold(d, ['kick', 'dig']);
        yield S.each(S.rand(1.6, 2.0), function () { if (S.chance(0.1)) S.bits(d.x - face * 12, d.y - 1, 1, S.grass(), 26, 34); });
        S.hold(d, 'stand');
        yield S.act(d, ['shakeoff', 'shake_off'], 1.6);
      }
      // 8. 走回小人身边坐好，像什么都没发生
      yield S.go(d, S.atHand(d), 'walk', null, 8);
      S.faceTo(d, S.man); S.hold(d, 'sit'); d.pant = true;
      yield 1;
    },
  });
  add({ name: 'potty_at_home', zh: '实在没地方：回岛里解决', care: 'pottyHome', cast: 'dog', timeout: 30,
    run: function* (S) {
      var d = S.dog;
      var inside = yield* S.enterIsland(d);
      if (!inside) { S.care.giveUp(d); return; }
      yield S.rand(5, 7);
      S.care.atHome(d);
      yield* S.leaveIsland(d);
      yield S.act(d, d === S.dax ? ['shakeoff', 'shake_off'] : ['stretch', 'wake_stretch'], 1.6);
      S.emote('note', d);
      yield 0.6;
    },
  });

  // ============================================================
  //  他收拾（R6 2.7 cleanup_bag；被她看见了就赶紧 = cleanup_caught）
  // ============================================================
  add({ name: 'cleanup_bag', zh: '套袋捡走', care: 'cleanup', cast: 'man', timeout: 30,
    run: function* (S, ev) {
      var man = S.man, p = ev.poop, gone = function () { return !S.prop.alive(p); };
      var caught = ev.caught || S.her.active && S.now() - p.born > 20;
      S.ball.pocket();
      // 0. 叹口气：职责所在
      S.emote('bang', man, 0, 0.5);
      if (!caught) {
        S.hold(man, ['p_sigh', 'p_idle']); S.face(man, 'pout'); S.emote('sigh', man, 0, 1.2);
        yield 1.0;
        S.face(man, 'soft');
      } else { S.face(man, 'oops'); S.emote('sweat', man, 0, 0.8); }
      yield* pocket(S, 'bag_open');
      if (gone()) return;
      // 1. 走过去（狗还蹲着就转过身等一下）
      var s = man.x < p.x ? -1 : 1, K = { x: p.x + s * 11, y: p.y + S.ry(1) };
      yield S.any(S.go(man, p.x + s * 30, p.y, caught ? 62 : 40, null, 10), gone);
      if (gone()) return;
      var dog = ev.dog;
      if (dog && S.playing('potty_' + (dog === S.dax ? 'dax' : 'gold'))) { S.hold(man, 'p_watch'); yield S.until(function () { return !S.playing('potty_dax') && !S.playing('potty_gold'); }, 8); }
      yield S.any(S.go(man, K, caught ? 62 : 40, null, 4), gone);
      if (gone()) return;
      // 2. 捡起来（手伸到之前 0.2 秒她就点不到了）
      S.faceTo(man, p); S.hold(man, 'p_place'); S.face(man, 'focus');
      S.prop.hot(p, null); p.data.picking = true;
      S.commit(2.2);
      yield 0.5;
      if (!gone()) { S.prop.remove(p, false); S.care.cleaned('him'); }
      S.item(man, 'bag_full');
      yield 0.3;
      // 3. 打个结，拿得远远的
      S.hold(man, ['p_knot', 'p_hold']);
      yield caught ? 0.5 : 1.0;
      S.hold(man, ['p_armlen', 'p_hold']);
      yield 0.5;
      // 4. 垃圾桶从地里冒出来，丢进去，又沉下去
      var bx = man.x - man.face * (caught ? 8 : 16), bin = S.prop.spawn('bin', 'pop', bx, man.y + S.ry(1), { shadow: false });
      yield 0.15;
      S.prop.set(bin, 'closed');
      if (!caught) { S.faceTo(man, bin); yield S.go(man, bx + (man.x > bx ? 7 : -7), man.y, 30, null, 1); }
      S.faceTo(man, bin); S.prop.set(bin, 'open');
      var h = S.hand(); S.item(man, null);
      yield S.toss('bag_full', h, { x: bin.x, y: bin.y, z: 6 }, 0.3, 4);
      S.prop.set(bin, 'closed');
      yield 0.6;
      S.prop.remove(bin, false);
      // 5. 拍拍手；被她看见了的话，转过来不好意思地鞠个躬
      if (caught) { S.hold(man, ['p_bow', 'p_front']); S.face(man, 'blush'); yield 0.8; }
      S.hold(man, ['p_dust', 'p_idle']); S.face(man, 'smile');
      yield 0.5;
    },
  });

  // —— 她点了一下便便（便便已经没了、小花长出来了）：那只狗跑到她鼠标旁边，他转过来鞠躬谢她 ——
  add({ name: 'cleanup_by_her', zh: '她点一下就干净', care: 'herclean', cast: 'who', timeout: 12,
    run: function* (S, ev) {
      var man = S.man, dog = ev.dog;
      if (!S.join(man)) man = null;
      if (dog && !S.join(dog)) dog = null;
      // 小花慢慢开
      var dz = null, list = S.prop.all('daisy');
      for (var i = 0; i < list.length; i++) if (Math.abs(list[i].x - ev.x) < 1 && Math.abs(list[i].y - ev.y) < 1) dz = list[i];
      if (dog && S.dist(dog, { x: ev.x, y: ev.y }) < 250) {
        var spot = S.toCursor(dog);
        S.hold(dog, 'alert');
        if (spot) { yield S.go(dog, spot, dog === S.dax ? 'run' : 'trot', null, 3); S.faceTo(dog, 'cursor'); }
        if (dog === S.dax) { S.hop(dog, 110); yield 0.4; S.hop(dog, 110); }
        else S.hold(dog, ['paw', 'sit']);
        S.emote('heart', dog);
      }
      if (dz) S.prop.set(dz, 'bloom');
      if (man) {
        S.ball.pocket(); S.ball.home();
        S.hold(man, ['p_bow', 'p_front']); S.face(man, 'smile');
        if (!S.say('thanks', TXT.thanks)) S.emote('heart', man);
      }
      yield 1.2;
    },
  });

  // ============================================================
  //  早安（今天头一回出岛，R6 2.8 简短版）：伸懒腰、甩毛、他整整领带看看表
  // ============================================================
  add({ name: 'care_morning', zh: '早安例行', care: 'morning', cast: 'man dax gold', timeout: 25,
    run: function* (S) {
      var man = S.man, dax = S.dax, gold = S.gold;
      S.act(gold, ['wake_stretch', 'stretch'], 3.5); S.act(dax, ['stretch'], 1.6);
      S.hold(man, { f: ['p_cheer', 'p_cheer2'], fps: 2 }); S.face(man, 'yawn');
      yield 1.4;
      S.act(dax, ['shakeoff', 'shake_off'], 1.4);
      S.hold(man, { f: ['p_tie_a', 'p_tie_b'], fps: 3 }); S.face(man, null);
      yield 1.2;
      S.hold(man, 'p_watch');
      yield 1.0;
      S.hold(man, null); S.face(man, 'smile'); S.emote('note', man);
      yield 0.6;
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
