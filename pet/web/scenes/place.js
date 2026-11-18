// 球球 · 戏包：地方（R5 卡片 E01-E12）——岛、程序坞、屏幕边、草地
//
//   她屏幕上的东西就是它们的家具：岛是放玩具的柜子和一扇门，程序坞是沙发和篱笆，屏幕边是可以冲着叫的院墙。
//   岛（S.island）、程序坞（S.dock）、菜单栏图标（S.statusItem）、岛弹一下（S.pulse）都是外壳给的，可能没有：
//   没有的时候每一段要么换一个说得通的地方（口袋、屏幕最下面那条边），要么这次不演。
//   做不到的几张卡（E02 夜里露在岛外的尾巴、E04 球卡在岛沿上、E05 从左边跑出去从右边回来）要等引擎，见交接说明。
(function (G) {
  'use strict';
  var L = G.PET_SCENES = G.PET_SCENES || [];
  function add(r) { r.pack = 'place'; if (!r.cat && r.kind !== 'solo' && r.kind !== 'react') r.cat = 'E'; L.push(r); }

  // ---------------- 小工具 ----------------
  function cx(S, x, a) { var F = S.field, h = (a ? a.half : 20) + 2; return Math.max(F.x0 + h, Math.min(F.x1 - h, x)); }
  function cy(S, y) { var F = S.field; return Math.max(F.y0, Math.min(F.y1, y)); }
  function at(S, x, y, a) { return { x: cx(S, x, a), y: cy(S, y) }; }
  function noseAt(S, d) { var n = S.anchor(d, 'nose'); return { x: n.x, y: n.y - n.z }; }
  function fromNose(S, d, type, life, ahead) { var n = noseAt(S, d); S.emoteAt(type, n.x + d.face * (ahead || 3), n.y + 3, life || 0.8); }
  function sigh(S, d, small) { fromNose(S, d, small ? 'huff' : 'sigh', 0.9); }
  function sniffs(S, d) { fromNose(S, d, 'sniffs', 0.5, 4); }
  function achoo(S, d, pollen) { fromNose(S, d, pollen ? 'achoo_y' : 'achoo', 0.45, 5); }
  function woof(S, d, big) { d.bark = big ? 0.5 : 0.3; S.emote(big ? 'bigwoof' : 'woof', d, d.face * (big ? 14 : 10), big ? 1.0 : 0.6); }
  function ok(S, a) { return !!a && !a.hidden && !a.carried; }
  function awake2(S) { return !S.asleep(S.dax) && !S.asleep(S.gold); }
  // 岛：看得见、满屏模式才算。{ x, y（岛正下方的地上）, rimY（岛下沿在屏幕上的 y）}
  function isle(S) {
    var I = S.island();
    if (!I || !I.on || !S.roam) return null;
    var rimY = I.rim && isFinite(I.rim.y) ? I.rim.y : S.field.y0 - 26;
    return { x: I.x, y: I.y, rimY: rimY };
  }
  // 程序坞的上沿（能当沙发靠背的那条线）；没有程序坞时：场地紧贴着屏幕最下面的话，就拿屏幕下边当它
  function dockLine(S, needDock) {
    var D = S.dock(), F = S.field;
    if (D && D.w > 40) return { x0: D.x + D.w * 0.15, x1: D.x + D.w * 0.85, y: Math.min(F.y1, D.y), dock: true };
    if (needDock) return null;
    return { x0: F.x0 + 30, x1: F.x1 - 30, y: F.y1, dock: false };
  }
  function toyOut(S) { var p = S.prop.find('rope') || S.prop.find('stick'); return p || null; }
  function used(S, p) { return p && p.data && p.data.used ? S.now() - p.data.used : (p ? S.now() - p.born : 0); }

  // ============================================================
  //  E01 岛就是玩具箱：他敲敲岛底，岛里"翻箱倒柜"，掉下来一个玩具；没有岛（或者太远）就从口袋里掏
  //  玩具拿出来以后接着演玩具的戏（绳子 → 拔河；树枝 → 两只抬）
  // ============================================================
  add({ name: 'island_toy_chute', zh: '岛就是玩具箱：敲一敲掉玩具', cast: 'man dax gold', family: 'island', weight: 3, cool: 600, mood: 'playful', tag: 'calm', timeout: 50,
    when: function (S) { return !toyOut(S) && awake2(S) && !S.night(); },
    run: function* (S) {
      var man = S.man, dax = S.dax, gold = S.gold, I = isle(S);
      var toys = S.cfg.toys && S.cfg.toys.length ? S.cfg.toys : ['rope', 'stick'];
      var kind = S.mem.get('toyOfDay') && S.mem.get('toyDay') === S.time.day ? S.mem.get('toyOfDay') : S.pick(toys);
      if (kind !== 'rope' && kind !== 'stick') kind = 'rope';
      S.mem.set('toyOfDay', kind); S.mem.set('toyDay', S.time.day);
      var p = null, s;
      if (I && Math.abs(I.x - man.x) < 300) {
        // 0-0.8 秒：走到岛底下，抬头，伸手敲两下
        yield S.go(man, I.x - 4, I.y + 2, 'brisk', null, 8);
        S.faceTo(man, I.x + 1); S.look(man, { x: I.x, y: I.y, z: I.y - I.rimY });
        s = man.x < (S.field.x0 + S.field.x1) / 2 ? 1 : -1;
        yield S.all(S.go(dax, at(S, I.x + s * 30, I.y + S.ry(10), dax), 'run', null, 6), S.go(gold, at(S, I.x - s * 36, I.y + S.ry(6), gold), 'trot', null, 6));
        S.hold(man, ['p_reach', 'p_cheer']); S.face(man, 'focus');
        yield 0.3;
        S.emoteAt('spark', I.x - 2, I.rimY + 4, 0.4);
        yield 0.3;
        S.emoteAt('spark', I.x + 2, I.rimY + 4, 0.4);
        // 0.8-1.6 秒：岛里像有人在翻东西；小腊肠坐得笔直往上看，尾巴摇成一团；金毛坐在旁边歪着头
        S.pulse('rummage');
        S.faceTo(dax, I.x); S.faceTo(gold, I.x);
        S.hold(dax, 'sit'); dax.look = 1; dax.wag = 1; S.look(dax, { x: I.x, y: I.y, z: I.y - I.rimY });
        S.hold(gold, 'sit'); S.rig(gold, { tilt: 1 }); gold.wag = 0.7; S.look(gold, { x: I.x, y: I.y, z: I.y - I.rimY });
        yield 0.8;
        // 1.6-2.4 秒：岛"吐"出一个玩具，从下沿掉下来
        S.pulse('drop');
        S.hold(man, null);
        var h = S.hand();
        p = S.prop.spawn(kind, '', man.x + man.face * 4, man.y + S.ry(0.5), { z: Math.max(h.z + 6, I.y - I.rimY), keep: true, cap: 300, data: { toy: true, used: S.now() } });
        S.look(man, p); S.look(dax, p); S.look(gold, p);
        if (S.chance(0.7)) {
          // 六成多：他一只手接住
          yield S.until(function () { return !S.prop.alive(p) || p.z <= h.z + 2; }, 1.2);
          S.prop.carry(p, man, 'hand'); S.hold(man, 'p_hold'); S.face(man, 'proud');
          S.emote('spark', man, man.face * 6, 0.5);
        } else {
          // 两成多：金毛跳起来半空叼住，得意地绕他小跑一圈再交给他
          S.rig(gold, null); S.hold(gold, 'stand'); S.hop(gold, 150);
          yield 0.25;
          S.prop.carry(p, gold, 'mouth'); if (kind === 'rope') S.prop.set(p, 'carry'); p.face = gold.face;
          yield function () { return gold.z === 0; };
          S.mood(gold, 'proud'); gold.look = 0.4;
          var t0 = S.now(), c = { x: man.x, y: man.y }, a0 = gold.x < man.x ? Math.PI : 0;
          S.track(gold, function () { var k = a0 + (S.now() - t0) / 2.4 * 2 * Math.PI; return { x: c.x + Math.cos(k) * 34, y: cy(S, c.y + Math.sin(k) * S.ry(12)) }; }, 'trot');
          yield S.each(2.4, function () { p.face = gold.face; });
          S.stop(gold); S.mood(gold, null); gold.look = 0;
          yield S.go(gold, S.atHand(gold), 'walk', null, 2);
          S.faceTo(gold, man); S.faceTo(man, gold); S.hold(gold, 'sit');
          S.hold(man, 'p_pat'); S.face(man, 'laugh');
          yield 0.5;
          S.prop.set(p, ''); S.prop.carry(p, man, 'hand'); S.hold(man, 'p_hold');
        }
      } else {
        // 没有岛：从西装口袋里掏出来（口袋是无底的）
        S.faceTo(man, dax); S.hold(man, 'p_pocket'); S.face(man, 'smile');
        yield S.all(S.go(dax, S.atHand(dax, 3), 'run', null, 5), S.go(gold, at(S, man.x - (dax.x < man.x ? -1 : 1) * (gold.mx + 14), man.y + S.ry(-2), gold), 'trot', null, 5));
        yield 0.3;
        var hh = S.hand();
        S.puff(hh.x, man.y - hh.z, false); S.emote('spark', man, man.face * 6, 0.5);
        p = S.prop.spawn(kind, '', hh.x, man.y, { keep: true, cap: 300, data: { toy: true, used: S.now() } });
        S.prop.carry(p, man, 'hand'); S.hold(man, 'p_hold');
        yield 0.4;
      }
      // 2.4-3 秒：举在鼻子那么高；两只一起凑上来闻
      S.rig(gold, null); S.look(dax, null); S.look(gold, null); dax.look = 0.4;
      S.faceTo(dax, man); S.faceTo(gold, man);
      yield S.all(S.go(dax, S.atHand(dax, 3), 'trot', null, 3), S.go(gold, S.atHand(gold, -2), 'walk', null, 3));
      S.faceTo(dax, man); S.faceTo(gold, man);
      S.hold(dax, 'sniff'); S.hold(gold, 'sniff'); sniffs(S, dax); sniffs(S, gold);
      yield 0.8;
      // 放到地上，他就不管了：玩具的戏开始
      S.hold(man, ['p_place', 'p_crouch']);
      yield 0.4;
      var m = S.hand();
      S.prop.drop(p, m.x, man.y + S.ry(3)); if (p.data) p.data.used = S.now();
      S.hold(man, null); S.face(man, 'smile'); S.look(man, dax);
      S.hold(dax, 'stand'); S.hold(gold, 'stand'); dax.look = 0;
      S.leave(man);
      yield 0.3;
      yield* S.run(kind === 'rope' ? 'tug_let_win' : 'two_on_a_stick');
    },
    end: function (S) { var p = toyOut(S); if (p && p.holder) { S.prop.drop(p); S.prop.set(p, ''); } } });

  // —— E01 收拾：玩具放着 90 秒没人碰，金毛把它叼回岛底下，往上一甩，岛"咕咚"一口吞进去；没有岛就叼给他，他收进口袋 ——
  add({ name: 'toy_tidy', zh: '玩完把玩具叼回岛里', cast: 'gold', family: 'island', mood: 'proud', tag: 'calm', timeout: 30,
    weight: function (S) { var p = toyOut(S); return p && !p.holder && used(S, p) > 90 ? 8 : 0; },
    when: function (S) { var p = toyOut(S); return !!p && !p.holder && !S.asleep(S.gold); },
    run: function* (S) {
      var gold = S.gold, p = toyOut(S), I = isle(S);
      if (!p || p.holder) return;
      yield S.go(gold, S.beside(gold, S.prop.where(p), 2), 'walk', null, 8);
      S.faceTo(gold, p); S.hold(gold, 'sniff');
      yield 0.4;
      S.prop.carry(p, gold, 'mouth'); if (p.kind === 'rope') S.prop.set(p, 'carry'); p.face = gold.face;
      S.hold(gold, 'stand'); gold.wag = 0.7;
      if (I) {
        yield S.go(gold, I.x - 6, I.y, 'trot', null, 10);
        S.faceTo(gold, I.x + 1); p.face = gold.face;
        S.hold(gold, 'sit'); gold.look = 1;
        yield 0.5;
        // 头往上一甩：玩具飞进岛里
        var m = S.anchor(gold, 'mouth');
        S.prop.remove(p, false);
        yield S.toss(p.kind === 'rope' ? 'rope_knot' : 'stick', { x: m.x, y: gold.y, z: m.z }, { x: I.x, y: I.y, z: I.y - I.rimY + 2 }, 0.4, 10);
        S.pulse('gulp'); S.emoteAt('spark', I.x, I.rimY + 4, 0.5);
        gold.look = 0; S.hold(gold, 'stand'); gold.wag = 1;
        yield 0.6;
      } else {
        var man = S.man;
        if (!ok(S, man)) { S.prop.drop(p); S.prop.set(p, ''); return; }
        yield S.go(gold, S.atHand(gold), 'walk', null, 8);
        S.faceTo(gold, man); p.face = gold.face; S.hold(gold, 'sit');
        if (S.free(man) && S.join(man)) {
          S.faceTo(man, gold); S.hold(man, 'p_pat'); S.face(man, 'smile');
          yield 0.6;
          S.prop.remove(p, false);
          S.hold(man, 'p_pocket'); S.emote('spark', man, man.face * 4, 0.5);
          yield 0.6;
        } else {
          S.prop.drop(p, S.anchor(gold, 'mouth').x, gold.y + S.ry(2)); S.prop.set(p, '');
          yield 0.8;
        }
      }
    },
    end: function (S) { var p = toyOut(S); if (p && p.holder === S.gold) { S.prop.drop(p); S.prop.set(p, ''); } } });

  // ============================================================
  //  E03 叼着长树枝进不了门：金毛想把树枝收回岛里，横着叼，"咚"地撞在门框上……歪头、想一想，原来竖着进
  //  （卡片原本是晚上回岛那一刻；回岛的时候戏插不进去，所以白天收玩具时演）
  // ============================================================
  add({ name: 'door_too_wide', zh: '叼着长树枝进不了门', cast: 'gold dax', family: 'island', weight: function (S) { var p = S.prop.find('stick'); return p && !p.holder && used(S, p) > 40 ? 4 : 0; },
    cool: 1800, cap: 1, mood: 'funny', tag: 'calm', timeout: 40,
    when: function (S) { var p = S.prop.find('stick'); return !!isle(S) && !!p && !p.holder && awake2(S); },
    run: function* (S) {
      var gold = S.gold, dax = S.dax, p = S.prop.find('stick'), I = isle(S), i;
      if (!p || !I) return;
      yield S.go(gold, S.beside(gold, S.prop.where(p), 2), 'walk', null, 8);
      S.faceTo(gold, p); S.hold(gold, 'sniff');
      yield 0.4;
      S.prop.carry(p, gold, 'mouth'); p.face = 1; S.hold(gold, 'stand'); gold.wag = 0.8;
      // 0-1.5 秒：排队到岛底下
      yield S.all(S.go(gold, I.x - 4, I.y, 'trot', null, 10), S.go(dax, at(S, I.x + 34, I.y + S.ry(8), dax), 'trot', null, 10));
      S.faceTo(gold, I.x + 1); S.faceTo(dax, gold); S.hold(dax, 'sit'); dax.look = 0.8;
      for (i = 0; i < 2; i++) {
        // 1.5-2.5 秒：一跳——树枝横着卡在门两边（两头各冒一个火星），岛晃一下；掉回来眨眨眼
        S.hop(gold, 190);
        yield S.until(function () { return gold.vz <= 0; }, 0.6);
        var m = S.anchor(gold, 'mouth');
        S.emoteAt('spark', m.x - 13, m.y - m.z, 0.4); S.emoteAt('spark', m.x + 13, m.y - m.z, 0.4);
        S.pulse('shake');
        yield function () { return gold.z === 0; };
        S.rig(gold, { eyes: 'closed' });
        yield 0.2;
        S.rig(gold, null);
        if (i === 0) {
          // 2.5-4 秒：退五步助跑，再来；小腊肠冲着这动静叫一声
          yield S.slide(gold, -gold.face * 0, S.ry(14), 0.8);
          woof(S, dax);
          yield S.go(gold, I.x - 4, I.y, 'run', null, 2);
        }
      }
      // 4-5.5 秒：坐下。往左歪头、往右歪头——三个点：在想
      S.hold(gold, 'sit');
      S.rig(gold, { tilt: -1 }); S.emote('dots', gold, 0, 1.2);
      yield 0.6;
      S.rig(gold, { tilt: 1 });
      yield 0.7;
      // 5.5-6.5 秒：亮了！歪着头一跳：树枝竖着送进去，然后是狗，然后是尾巴
      S.emote('spark', gold, 0, 0.6);
      S.rig(gold, { tilt: 1 });
      yield 0.3;
      S.hold(gold, 'stand');
      var ok2 = yield* S.enterIsland(gold);
      if (ok2) {
        S.pulse('gulp');
        S.faceTo(dax, I.x); S.hold(dax, 'sit'); S.rig(dax, { tilt: 1 });
        yield 2.0;
        S.rig(dax, null);
        yield* S.leaveIsland(gold);
        S.hold(gold, 'stand'); gold.wag = 1; S.emote('heart', gold, 0, 1.0);
        yield 0.8;
      }
    },
    end: function (S) { var p = S.prop.find('stick'); if (p && p.holder) { S.prop.drop(p); S.prop.set(p, ''); } } });

  // ============================================================
  //  E06 小狗对着屏幕外报警，大狗来撑腰（小腊肠走到屏幕左右边上的时候）
  // ============================================================
  function* sentinel(S, side) {
    var dax = S.dax, gold = S.gold, man = S.man, F = S.field, out = side === 'left' ? -1 : 1, i;
    var edgeX = out < 0 ? F.x0 : F.x1;
    // 0-1 秒：在边上停下，竖起来、举着一只爪，耳朵朝前，瞪着屏幕外面
    if (Math.abs(dax.x - edgeX) > dax.half + 30) yield S.go(dax, edgeX - out * (dax.half + 14), dax.y, 'trot', null, 4);
    dax.face = out; S.hold(dax, 'alert'); S.rig(dax, { pawUp: true, ears: -1 }); S.mood(dax, 'focused');
    S.look(dax, { x: edgeX + out * 60, y: dax.y, z: 10 });
    yield 0.8;
    // 1-2.5 秒：尖声叫三下，每叫一下往后一跳（隔得远远的才勇敢）
    S.rig(dax, { ears: -1 });
    for (i = 0; i < 3; i++) {
      woof(S, dax); S.hop(dax, 50); S.slide(dax, -out * 3, 0, 0.25);
      yield 0.5;
    }
    // 2.5-4.5 秒：金毛在哪儿都抬起头，叹口气，晃过来也往外看；小腊肠胆子大了，往前一步再叫
    S.look(gold, dax); sigh(S, gold);
    yield 0.4;
    yield S.go(gold, at(S, dax.x - out * 4, cy(S, dax.y + S.ry(-6)), gold), S.spd(gold, 'walk') * 1.6, null, 5);
    gold.face = out; S.hold(gold, 'stand'); S.look(gold, { x: edgeX + out * 80, y: gold.y, z: 14 });
    yield S.slide(dax, out * 6, 0, 0.3);
    woof(S, dax);
    yield 0.6;
    // 4.5-5.5 秒：金毛低低地"汪"一声
    woof(S, gold, true);
    yield 1.0;
    // 5.5-6.5 秒：都竖着耳朵听，头往两边歪。什么都没有
    S.rig(dax, { tilt: 1 }); S.rig(gold, { tilt: -1 });
    yield 1.0;
    // 6.5-8 秒：金毛低头看小腊肠（问号）；小腊肠得意地在边上蹬两下草，甩甩毛，挺着胸走回去，坐在他旁边，他摸摸它
    S.rig(gold, null); S.look(gold, dax); S.emote('q', gold, 0, 0.9);
    S.rig(dax, null); S.mood(dax, 'proud'); S.look(dax, null);
    yield S.act(dax, ['kick_scuff', 'kick'], 1.6);
    S.bits(dax.x - dax.face * dax.half, dax.y, 3, S.grass(), 16, 24);
    yield S.act(dax, ['shake_off', 'shakeoff'], 1.2);
    if (ok(S, man) && S.free(man) && S.join(man)) {
      yield S.go(dax, S.atHand(dax), 'trot', null, 6);
      S.faceTo(dax, man); S.faceTo(man, dax); S.hold(dax, 'sit');
      S.hold(man, 'p_pat'); S.face(man, 'smile'); S.emote('heart', dax, 0, 1.0); dax.happy = 1;
      yield 1.2;
      S.hold(man, null); dax.happy = 0;
    } else {
      S.rig(dax, { tailSet: 70 });
      yield S.go(dax, at(S, dax.x - out * 50, dax.y, dax), 'walk', null, 3);
    }
  }
  add({ name: 'sentinel_and_backup', zh: '小狗对着屏幕外报警，大狗来撑腰', kind: 'react', on: 'edge', cast: 'dax gold', cool: 900, chance: 0.6, mood: 'proud', tag: 'lively', timeout: 22,
    when: function (S, ev) { return !!ev && ev.who === S.dax && (ev.side === 'left' || ev.side === 'right') && !S.night() && S.time.h >= 7 && S.time.h < 20 && awake2(S); },
    run: function* (S, ev) { yield* sentinel(S, ev.side); } });

  // ============================================================
  //  E07 程序坞当沙发（金毛背靠着它睡）；小腊肠想在坞角底下打洞
  //  没有程序坞：靠着屏幕最下面那条边睡，在屏幕下面的角落里刨
  // ============================================================
  add({ name: 'dock_sofa', zh: '程序坞当沙发', kind: 'solo', cast: 'gold', mood: 'sleepy', timeout: 80,
    weight: function (S) { var q = S.quietFor(); return q > 60 ? (S.dock() ? 6 : 3) : 0; }, cool: 300,
    when: function (S) { return !S.night(); },
    run: function* (S) {
      var d = S.me, D = dockLine(S, false), F = S.field;
      if (!D) return;
      var x = Math.max(D.x0 + d.half, Math.min(D.x1 - d.half, d.x + S.rand(-40, 40)));
      yield S.go(d, cx(S, x, d), D.y, 'walk', null, 12);
      // 顺着它转一圈，背贴着它"咚"地躺下，尾巴搭在边上
      d.face = S.chance(0.5) ? 1 : -1;
      yield S.act(d, 'nest_circle');
      S.hold(d, 'lie'); S.rig(d, { tailSet: -60, chin: true }); sigh(S, d);
      yield 2.0;
      S.rig(d, { tailSet: -60, chin: true, eyes: 'closed' });
      yield 1.5;
      S.hold(d, 'sleep'); S.rig(d, { tailSet: -60 });
      yield S.rand(20, 45);
      S.rig(d, null); S.hold(d, 'stand');
      yield S.act(d, 'wake_stretch');
    } });
  add({ name: 'dock_dig', zh: '小腊肠想在程序坞的角底下打洞', kind: 'solo', cast: 'dax', weight: 1, cool: 1200, mood: 'mischievous', timeout: 20,
    run: function* (S) {
      var d = S.me, D = dockLine(S, false), F = S.field;
      if (!D) return;
      // 程序坞圆圆的那一头和桌面接缝的地方；没有程序坞就是屏幕下面的角
      var left = Math.abs(d.x - D.x0) < Math.abs(d.x - D.x1), ex = D.dock ? (left ? S.dock().x : S.dock().x + S.dock().w) : (left ? F.x0 : F.x1);
      var face = D.dock ? (left ? 1 : -1) : (left ? -1 : 1);
      yield S.go(d, cx(S, ex - face * (d.mx - 2), d), D.y, 'trot', null, 10);
      d.face = face; S.hold(d, 'sniff'); sniffs(S, d);
      yield 0.8;
      sniffs(S, d);
      yield 0.6;
      // 刨 2.5 秒：屁股撅着，土渣乱飞，鼻子塞在角里
      S.hold(d, 'dig'); d.wag = 1;
      yield S.each(2.5, function (t) { if (Math.floor(t * 12) % 2) S.bits(d.x + d.face * 6, d.y, 1, 'dirt', 22, 40); });
      // 退出来，打个喷嚏，小跑走开（改天去另一头试试）
      S.hold(d, 'stand'); S.rig(d, { dirty: true });
      yield S.slide(d, -face * 8, 0, 0.5);
      yield S.act(d, 'sneeze', 0.7);
      achoo(S, d);
      yield S.go(d, at(S, d.x - face * 60, d.y + S.ry(-20), d), 'trot', null, 3);
    } });

  // ============================================================
  //  E08 程序坞后面的潜望镜尾巴：小腊肠躲到程序坞"后面"沿着走，只有竖着的尾巴尖在上沿露着走；
  //  金毛盯着那根尾巴尖，跟着走；到了另一头小腊肠一蹦，正好蹦到金毛脸上
  //  （没有程序坞时：场地贴着屏幕下边的话，就躲在屏幕下边"后面"走）
  // ============================================================
  add({ name: 'dock_shark_fin', zh: '程序坞后面的潜望镜尾巴', cast: 'dax gold', weight: function (S) { return dockLine(S, !nearBottom(S)) ? 1.5 : 0; },
    cool: 1200, mood: 'mischievous', tag: 'calm', timeout: 40,
    when: function (S) { return awake2(S) && !!dockLine(S, !nearBottom(S)); },
    run: function* (S) {
      var dax = S.dax, gold = S.gold, D = dockLine(S, !nearBottom(S)), i;
      if (!D) return;
      var V = S.view, dir = Math.abs(dax.x - D.x0) < Math.abs(dax.x - D.x1) ? 1 : -1;
      var x0 = dir > 0 ? D.x0 : D.x1, x1 = dir > 0 ? D.x1 : D.x0, len = Math.abs(x1 - x0);
      if (len < 90) return;
      if (len > 200) {             // 太长了：只走离小腊肠近的那 200
        x0 = Math.max(Math.min(D.x0, D.x1), Math.min(Math.max(D.x0, D.x1) - 200, dax.x - 100));
        if (dir < 0) x0 += 200;
        x1 = x0 + dir * 200; len = 200;
      }
      // 金毛在附近趴着
      yield S.go(gold, at(S, x0 + dir * len * 0.35, D.y - S.ry(16), gold), 'walk', null, 8);
      S.hold(gold, 'lie');
      // 0-1 秒：小跑到程序坞的一头，一步"迈到后面"：身子沉下去，只剩竖着的尾巴
      yield S.go(dax, cx(S, x0, dax), D.y, 'trot', null, 10);
      dax.face = dir;
      S.clip(dax, [-10, -10, V.w + 20, D.y + 9.5]);
      S.rig(dax, { tailSet: 85 });
      yield S.each(0.5, function (t) { dax.lift = -14 * Math.min(1, t / 0.5); });
      S.look(gold, { x: dax.x, y: D.y, z: 6 });
      // 1-5 秒：尾巴尖沿着上沿走；走到三分之一、三分之二各停一下，耳朵和眼睛冒出来看一眼
      for (i = 1; i <= 3; i++) {
        var tx = x0 + dir * len * i / 3;
        var c = S.go(dax, cx(S, tx, dax), D.y, 'trot', null, 6);
        yield S.each(Math.min(6, len / 3 / S.spd(dax, 'trot') + 0.5), function () {
          S.look(gold, { x: dax.x, y: D.y, z: 6 });
          if (i === 2 && gold.pose === 'lie') { S.hold(gold, 'stand'); S.follow(gold, dax, -(gold.mx - 4), S.ry(-10), 'walk'); }
        });
        yield c;
        if (i < 3) {
          yield S.each(0.25, function (t) { dax.lift = -14 + 7 * Math.min(1, t / 0.25); });
          yield 0.4;
          yield S.each(0.25, function (t) { dax.lift = -7 - 7 * Math.min(1, t / 0.25); });
        }
      }
      // 5-6 秒：到了另一头一蹦出来，正好蹦到金毛脸上；金毛伏下身子
      S.stop(gold);
      dax.lift = 0; S.clip(dax, null); S.rig(dax, null);
      S.faceTo(dax, gold); S.hop(dax, 110);
      yield S.slide(dax, 0, S.ry(-8), 0.3);
      S.emote('bang', gold, 0, 0.6); S.faceTo(gold, dax); S.hold(gold, 'bow'); gold.wag = 1;
      S.hold(dax, 'bow'); dax.wag = 1;
      yield 0.9;
      if (gold.energy >= 0.45 && S.chance(0.5)) { S.hold(gold, 'stand'); S.hold(dax, 'stand'); yield* S.run('chase'); }
    },
    end: function (S) { S.dax.lift = 0; } });
  // 场地是不是一直铺到屏幕最下面（没有程序坞时，"躲到屏幕下边后面"才说得通）
  function nearBottom(S) { return S.view.h - S.field.y1 < 6; }

  // ============================================================
  //  E09 够不着的那颗球：菜单栏上我们自己那个网球图标（外壳告诉我们它在哪；不知道就不演）
  // ============================================================
  add({ name: 'menubar_ball', zh: '够不着的那颗球', cast: 'dax gold man', cat: 'E', weight: 2, cap: 1, cool: 86400, fromDay: 3, mood: 'funny', tag: 'calm', timeout: 30,
    when: function (S) { var x = S.statusItem(); return S.roam && x !== null && x !== undefined && isFinite(x) && x > S.field.x0 && x < S.field.x1 && awake2(S) && S.ball.inHand(); },
    run: function* (S) {
      var dax = S.dax, gold = S.gold, man = S.man, sx = S.statusItem(), F = S.field, i, menu0 = S.mem.get('menuAt') || -1;
      var icon = { x: sx, y: F.y0, z: F.y0 + 6 };
      var jumped = function () { var m = S.mem.get('menuAt'); return m && m !== menu0 && S.now() - m < 2 && S.now() >= m; };
      function* jumpAll() { S.hop(dax, 90); S.hop(gold, 90); S.emote('bang', dax, 0, 0.6); S.emote('bang', gold, 0, 0.6); menu0 = S.mem.get('menuAt'); yield 0.6; }
      // 0-2 秒：小腊肠小跑到图标正下方，坐下，仰着头瞪着它
      yield S.go(dax, cx(S, sx + 4, dax), F.y0, 'trot', null, 10);
      S.faceTo(dax, sx); S.hold(dax, 'sit'); dax.look = 1; S.look(dax, icon); S.mood(dax, 'focused');
      yield 1.0;
      // 2-5 秒：跳三下，一下比一下高，都差得远；冲它叫一声
      var pw = [100, 125, 150];
      for (i = 0; i < 3; i++) { S.hold(dax, 'stand'); S.hop(dax, pw[i]); yield 0.75; if (jumped()) yield* jumpAll(); }
      dax.bark = 0.3; S.emote('woof', dax, dax.face * 10, 0.6);
      yield 0.5;
      // 5-7 秒：把金毛叫来；金毛立起来也够不着。两只一起往上看
      S.faceTo(dax, gold);
      yield S.go(gold, at(S, sx - 26, F.y0 + S.ry(2), gold), 'trot', null, 8);
      S.faceTo(gold, sx); S.hold(gold, 'rear'); S.rig(gold, { pawAt: [10, 22] }); S.look(gold, icon);
      S.faceTo(dax, sx); S.hold(dax, 'sit'); S.look(dax, icon);
      yield 1.4;
      if (jumped()) yield* jumpAll();
      S.rig(gold, null); S.hold(gold, 'sit'); gold.look = 1;
      // 7-9 秒：他走过来，顺着它们的目光往上看，看看手里的球，再看看图标，再看看球；把真球举给它们看：没兴趣
      yield S.go(man, cx(S, sx + 40, null), F.y0 + S.ry(8), 'stroll', null, 10);
      S.faceTo(man, sx); S.look(man, icon);
      yield 0.8;
      S.look(man, 'ball');
      yield 0.5;
      S.look(man, icon);
      yield 0.5;
      S.look(man, 'ball'); S.face(man, 'wry');
      yield 0.4;
      S.hold(man, ['p_show', 'p_hold']); S.look(man, dax);
      yield 1.0;
      if (jumped()) yield* jumpAll();
      // 9-11 秒：他耸耸肩，把真球远远丢出去：本能赢了
      S.hold(man, ['p_shrug', 'p_idle']); S.face(man, 'smile');
      yield 0.7;
      S.hold(man, null);
      S.fetch(1);
    } });
  // 她打开了菜单：记一下时间（正在看图标的那段戏会全体吓一跳）
  add({ name: 'menubar_ball_menu', zh: '（记下她打开菜单的时间）', kind: 'react', on: 'menu', cast: 'dax', overlay: true, timeout: 1,
    run: function* (S) { S.mem.set('menuAt', S.now()); } });

  // ============================================================
  //  E10 各有各的窝：小腊肠睡屏幕下面的一个角，金毛睡岛底下（或者程序坞正中间）；六成的觉在自己的窝里睡。
  //  她把睡着的谁拎到别处：它眨眨眼，看看四周，小跑回自己的窝。一天里第三次放在同一个新地方（40 以内）：闻一闻，转一圈，就睡这儿了
  // ============================================================
  function spotOf(S, d) {
    var F = S.field, m = S.mem.get('spot_' + d.kind), w = F.x1 - F.x0, h = Math.max(0, F.y1 - F.y0);
    if (m && isFinite(m.fx)) return { x: cx(S, F.x0 + m.fx * w, d), y: cy(S, F.y0 + m.fy * h) };
    if (d.kind === 'dax') return { x: cx(S, F.x0 + w * 0.08, d), y: F.y1 };
    var I = isle(S);
    if (I) return { x: cx(S, I.x - 18, d), y: I.y };
    return { x: cx(S, F.x0 + w * 0.5, d), y: F.y1 };
  }
  function setSpot(S, d) {
    var F = S.field, w = Math.max(1, F.x1 - F.x0), h = Math.max(1, F.y1 - F.y0);
    S.mem.set('spot_' + d.kind, { fx: (d.x - F.x0) / w, fy: F.y1 > F.y0 ? (d.y - F.y0) / h : 1 });
  }
  function* spotNap(S, d, first) {
    if (first) { S.rig(d, { eyes: 'closed' }); yield 0.4; S.rig(d, null); }
    yield S.act(d, 'nest_circle');
    S.hold(d, 'sleep'); sigh(S, d, true);
    S.mem.set('zz_' + d.kind, S.now());
    var t0 = S.t(), len = S.rand(30, 70), dreamAt = t0 + S.rand(10, 20);
    while (S.t() - t0 < len) {
      if (S.t() >= dreamAt) { dreamAt = S.t() + S.rand(20, 40); S.emote('thought_' + S.pick(d.kind === 'gold' ? ['ball', 'bone', 'shoe'] : ['butterfly', 'hole', 'tail']), d, d.face * 8, 3.0); yield S.act(d, 'dream_bubble'); continue; }
      yield 0.5;
    }
    S.mem.set('zz_' + d.kind, undefined);
    if (S.t() - t0 >= 45) {
      var list = S.mem.get('napSpots') || [];
      list.push({ x: Math.round(d.x), y: Math.round(d.y), day: S.time.day, k: d.kind });
      while (list.length > 6) list.shift();
      S.mem.set('napSpots', list);
    }
    S.hold(d, 'stand');
    yield S.act(d, 'wake_stretch');
  }
  add({ name: 'favourite_spot_nap', zh: '回自己的窝睡觉', kind: 'solo', cast: 'dog', mood: 'sleepy', timeout: 130, cool: 60,
    weight: function (S) { var q = S.quietFor(); return q > 90 ? 9 : (q > 30 ? 4 : 0); },
    when: function (S) { return !S.night(); },
    run: function* (S) {
      var d = S.me, p = spotOf(S, d);
      yield S.go(d, p, S.dist(d, p) > 150 ? 'trot' : 'walk', null, 14);
      yield* spotNap(S, d, false);
    },
    end: function (S, cancelled, why) {
      var d = S.me, z = S.mem.get('zz_' + d.kind);
      S.mem.set('zz_' + d.kind, undefined);
      if (cancelled && why === 'carried' && z !== undefined) S.mem.set('lifted_' + d.kind, S.now());
    } });
  add({ name: 'favourite_spot_return', zh: '被拎走了：回自己的窝（或者就睡这儿了）', kind: 'react', on: 'drop', cast: 'who', mood: 'sleepy', timeout: 120, keep: 2,
    when: function (S, ev) {
      var d = ev && ev.who;
      if (!d || d.isPerson) return false;
      var t = S.mem.get('lifted_' + d.kind), dt = S.now() - (+t || -1e9);
      return dt >= 0 && dt < 30;
    },
    run: function* (S) {
      var d = S.me, p = spotOf(S, d), k = 'relearn_' + d.kind, r = S.mem.get(k) || {};
      S.mem.set('lifted_' + d.kind, undefined);
      yield 0.5;
      // 眨眨眼，看看四周
      S.hold(d, 'stand'); S.rig(d, { eyes: 'closed' });
      yield 0.25;
      S.rig(d, null); S.look(d, { x: d.x - 30, y: d.y, z: 8 });
      yield 0.4;
      S.look(d, { x: d.x + 30, y: d.y, z: 8 });
      yield 0.4;
      S.look(d, null);
      // 一天里第三次放在同一个新地方：就睡这儿了
      if (r.day !== S.time.day || !(Math.abs(r.x - d.x) < 40 && Math.abs(r.y - d.y) < 40)) r = { day: S.time.day, x: d.x, y: d.y, n: 0 };
      r.n++;
      S.mem.set(k, r);
      if (r.n >= 3 || S.dist(d, p) < 30) {
        S.hold(d, 'sniff'); sniffs(S, d);
        yield 0.8;
        if (r.n >= 3) { setSpot(S, d); S.emote('spark', d, 0, 0.6); S.mem.set(k, undefined); }
      } else {
        yield S.go(d, p, 'trot', null, 12);
      }
      yield* spotNap(S, d, false);
    } });

  // ============================================================
  //  E11 把饼干埋在屏幕角落，改天再挖：他给小腊肠一块饼干，它不吃，偷偷埋在下面的角落里（留一个小土堆，存下来）；
  //  过 20 分钟以后的某个时候挖出来吃掉——有时候被金毛先闻到挖走了，再用鼻子拱还给它
  // ============================================================
  add({ name: 'buried_treasure', zh: '把饼干埋在屏幕角落', cast: 'man dax', cat: 'E', weight: 2, cap: 1, cool: 3600, mood: 'mischievous', tag: 'calm', family: 'biscuit', hours: [8, 21], timeout: 40,
    when: function (S) { return S.cfg.lawnMemories !== false && !S.mem.get('mound') && !S.asleep(S.dax); },
    run: function* (S) {
      var man = S.man, dax = S.dax, gold = S.gold, F = S.field;
      // 他掏出一块饼干丢给它
      S.faceTo(man, dax); S.hold(man, ['p_pocket', 'p_hold']); S.face(man, 'smile');
      yield S.go(dax, S.atHand(dax), 'run', null, 5);
      S.faceTo(dax, man); S.hold(dax, 'sit'); dax.wag = 1;
      S.item(man, 'bone'); S.hold(man, 'p_hold');
      yield 0.6;
      S.item(man, null); S.hold(man, 'p_release');
      yield S.toss('bone', man, dax, 0.35, 10);
      S.item(dax, 'bone'); S.hold(man, null); dax.happy = 1;
      // 0-2 秒：它不吃。回头看看金毛有没有在看，叼着跑到下面的一个角
      S.rig(dax, { lookBack: true }); if (ok(S, gold)) S.look(dax, gold);
      yield 0.8;
      S.rig(dax, null); S.look(dax, null); dax.happy = 0;
      var left = dax.x < (F.x0 + F.x1) / 2, cn = S.corner(left ? 'bl' : 'br', 16);
      var x = cx(S, cn.x + (left ? 4 : -4), dax), y = F.y1;
      yield S.go(dax, x, y, 'trot', null, 12);
      // 脸朝着角：坑在两只前爪底下（离角不到 12，草地关着的时候也画得出来）
      var face = left ? -1 : 1;
      dax.face = face;
      var hx = Math.max(F.x0 + 4, Math.min(F.x1 - 4, dax.x + face * dax.half * 0.6));
      // 2-4.5 秒：刨 2 秒（一个小坑），把饼干放进去
      S.hold(dax, 'dig'); dax.wag = 0.8;
      var hole = S.decal('hole', hx, y + 1, {});
      yield S.each(2.0, function (t) { if (Math.floor(t * 12) % 2) S.bits(hx, y, 1, 'dirt', 20, 36); });
      S.hold(dax, 'sniff'); S.item(dax, null);
      yield 0.4;
      // 4.5-7 秒：用鼻子把土拱回去（四下），再拿爪子拍平；鼻头脏了
      for (var i = 0; i < 4; i++) { yield S.act(dax, 'nudge', 0.55); S.bits(hx, y, 1, 'dirt', 8, 12); }
      S.decalRemove(hole);
      var id = S.decal('mound', hx, y + 1, { days: 2, overlay: true });
      S.mem.set('mound', { x: hx, y: y + 1, id: id, ms: S.time.ms || 0, day: S.time.day });
      S.hold(dax, 'stand'); S.rig(dax, { pawAt: [dax.mx * 0.7, 0], dirty: true });
      yield 0.5;
      S.rig(dax, { dirty: true });
      // 7-8 秒：若无其事地看看四周，甩甩毛，走开
      S.look(dax, { x: x - face * 40, y: y, z: 20 });
      yield 0.6;
      S.look(dax, null);
      yield S.act(dax, 'shake_off', 1.2);
      yield S.go(dax, at(S, x - face * 50, y + S.ry(-18), dax), 'trot', null, 3);
    } });
  add({ name: 'dig_up_treasure', zh: '把埋的饼干挖出来', cast: 'dax gold', cat: 'E', mood: 'mischievous', tag: 'calm', family: 'nose', timeout: 40, cool: 600,
    weight: function (S) {
      var m = S.mem.get('mound');
      if (!m) return 0;
      var age = (S.time.ms || 0) - (m.ms || 0);
      return age > 20 * 60000 ? 6 : 0;
    },
    when: function (S) { var m = S.mem.get('mound'); return !!m && awake2(S) && S.her.present; },
    run: function* (S) {
      var dax = S.dax, gold = S.gold, m = S.mem.get('mound');
      if (!m) return;
      // 存了两天以上的土堆早就不画了：忘掉它
      if (((S.time.ms || 0) - (m.ms || 0)) > 2 * 86400000) { S.mem.set('mound', undefined); return; }
      var F = S.field, mx = Math.max(F.x0 + 4, Math.min(F.x1 - 4, m.x)), my = cy(S, m.y - 1), face = mx < (F.x0 + F.x1) / 2 ? -1 : 1;
      var dig = function* (d, strokes) {
        yield S.go(d, cx(S, mx - face * d.half * 0.6, d), my, 'trot', null, 12);
        d.face = face; S.hold(d, 'sniff'); sniffs(S, d);
        yield 0.6;
        S.hold(d, 'dig');
        yield S.each(strokes, function (t) { if (Math.floor(t * 12) % 2) S.bits(mx, my, 1, 'dirt', 20, 36); });
        S.decalRemove(m.id);
        S.emote('spark', d, d.face * (d.mx + 2), 0.6);
        S.item(d, 'bone');
        S.hold(d, 'stand');
      };
      S.mem.set('mound', undefined);
      if (S.chance(0.7)) {
        // A：它回来了，闻一闻，挖出来；叼着脏兮兮的宝贝巡游一下，趴下啃 4 秒
        yield* dig(dax, 1.4);
        S.rig(dax, { dirty: true }); S.mood(dax, 'proud'); dax.look = 0.4; dax.wag = 1;
        yield S.go(dax, at(S, dax.x - face * 50, dax.y + S.ry(-14), dax), 'walk', null, 3);
        S.hold(dax, 'lie'); S.mood(dax, null); dax.look = 0; S.rig(dax, { chew: true, dirty: true });
        yield 4.0;
        S.item(dax, null); S.bits(dax.x + dax.face * dax.mx, dax.y, 4, 'kibble', 12, 24);
        S.emote('heart', dax, 0, 1.0);
        yield 0.6;
      } else {
        // B：金毛巡逻时抬着鼻子闻到了，走过去两下就挖出来，叼走了；小腊肠回来一看：空坑！顺着味儿找过去，金毛用鼻子把饼干拱还给它
        S.hold(gold, 'stand'); gold.look = 0.8; S.rig(gold, { scent: true });
        yield 1.0;
        S.rig(gold, null); gold.look = 0;
        yield* dig(gold, 0.7);
        var hole = S.decal('hole', mx, my + 1, {});
        yield S.go(gold, at(S, gold.x - face * 70, gold.y + S.ry(-20), gold), 'walk', null, 5);
        S.hold(gold, 'lie');
        yield S.go(dax, cx(S, mx - face * dax.half * 0.6, dax), my, 'trot', null, 12);
        dax.face = face; S.hold(dax, 'sniff');
        yield 0.5;
        S.emote('bang', dax, 0, 0.6);
        yield 0.6;
        S.emote('q', dax, 0, 0.9);
        yield 0.8;
        S.decalRemove(hole);
        yield S.go(dax, S.beside(dax, gold, 3), 'sniff', 'sniff', 8);
        S.faceTo(dax, gold); S.faceTo(gold, dax); S.hold(dax, 'sit');
        yield 0.4;
        S.item(gold, null);
        yield S.toss('bone', gold, dax, 0.3, 4);
        S.item(dax, 'bone'); S.act(gold, 'nudge', 0.6);
        yield 0.6;
        S.hold(dax, 'lie'); S.rig(dax, { chew: true });
        yield 2.5;
        S.item(dax, null); S.bits(dax.x + dax.face * dax.mx, dax.y, 4, 'kibble', 12, 24);
        S.emote('heart', dax, 0, 1.0);
        yield 0.6;
      }
    } });

  // ============================================================
  //  E12 睡过的地方，第二天开小花（草地那一层，她的窗口后面）：前一天睡满一会儿的地方开出 1-3 朵小花，开 6 天；
  //  早上小腊肠跑去一朵一朵地闻，被花粉呛得打个喷嚏，歪着头一脸惊讶；有时候金毛挨着自己的花趴下（不压着）
  // ============================================================
  add({ name: 'nap_flowers', zh: '睡过的地方，第二天开小花', cast: 'dax gold', cat: 'E', mood: 'tender', tag: 'calm', timeout: 30, cool: 3600,
    weight: function (S) {
      var list = S.mem.get('napSpots') || [], i;
      for (i = 0; i < list.length; i++) if (list[i].day !== S.time.day) return 8;
      return 0;
    },
    when: function (S) { return S.cfg.lawnMemories !== false && awake2(S) && !S.night(); },
    run: function* (S) {
      var dax = S.dax, gold = S.gold, list = S.mem.get('napSpots') || [], keep = [], old = [], i, j, F = S.field;
      for (i = 0; i < list.length; i++) (list[i].day !== S.time.day ? old : keep).push(list[i]);
      S.mem.set('napSpots', keep);
      if (!old.length) return;
      var kinds = ['nap_flower', 'nap_flower_y', 'nap_flower_p'], spots = [];
      for (i = 0; i < old.length; i++) {
        var sp = old[i], n = S.randInt(1, 3), x = Math.max(F.x0 + 6, Math.min(F.x1 - 6, sp.x)), y = cy(S, sp.y);
        for (j = 0; j < n; j++) S.decal(S.pick(kinds), x + S.rand(-11, 11), y + S.rand(-3, 4), { days: 6 });
        spots.push({ x: x, y: y, k: sp.k });
      }
      // 小腊肠跑到最近那一处，一朵一朵地闻，打个带花粉的喷嚏，歪着头惊讶
      var t = spots[spots.length - 1];
      yield S.go(dax, at(S, t.x - 14, t.y + S.ry(1), dax), 'trot', null, 10);
      S.faceTo(dax, t.x + 1);
      for (i = 0; i < 3; i++) {
        S.hold(dax, 'sniff'); sniffs(S, dax);
        yield 0.45;
        if (i < 2) yield S.slide(dax, dax.face * 5, 0, 0.3);
      }
      yield S.act(dax, 'sneeze', 0.7);
      achoo(S, dax, true);
      S.hold(dax, 'stand'); S.rig(dax, { tilt: 1 }); S.mood(dax, 'curious');
      yield 1.0;
      S.rig(dax, null); S.mood(dax, null);
      // 金毛那一处：有时候挨着花趴下，下巴贴着草
      for (i = 0; i < spots.length; i++) {
        if (spots[i].k === 'gold' && S.chance(0.6)) {
          var g = spots[i];
          yield S.go(gold, at(S, g.x - 24, g.y + S.ry(-1), gold), 'walk', null, 10);
          gold.face = 1; S.hold(gold, 'lie'); S.rig(gold, { chin: true }); S.look(gold, { x: g.x, y: g.y, z: 0 });
          yield 3.0;
          break;
        }
      }
    } });
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
