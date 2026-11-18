// 球球 · 戏包：狗狗自己的小动作（R5 第 2 节 M01-M21）
//
//   一只狗、1-10 秒、不占别人：闲下来的时候导演按 weight 挑一个（solo）；有几样是"出了事才演"（react：鼠标嗖地飞过、
//   鼠标停在旁边、另一只刚甩完毛……）。骨架那边已经把这些小动作排好了（PET_DOGS.ACTS 里同名的那些），
//   这里只管走位、表情符号、碎屑、道具，以及什么时候演。
//   睡觉那一段（转圈刨窝 → 睡 → 做梦 / 拍尾巴 / 动耳朵 → 两段式伸懒腰 → 甩毛）把 M02 M03 M07 M08 M09 串在一起。
(function (G) {
  'use strict';
  var L = G.PET_SCENES = G.PET_SCENES || [];
  function add(r) { r.pack = 'micro_dogs'; L.push(r); }

  // ---------------- 小工具 ----------------
  function cx(S, x, a) { var F = S.field, h = (a ? a.half : 20) + 2; return Math.max(F.x0 + h, Math.min(F.x1 - h, x)); }
  function cy(S, y) { var F = S.field; return Math.max(F.y0, Math.min(F.y1, y)); }
  function at(S, x, y, a) { return { x: cx(S, x, a), y: cy(S, y) }; }
  function noseAt(S, d) { var n = S.anchor(d, 'nose'); return { x: n.x, y: n.y - n.z }; }
  function fromNose(S, d, type, life, ahead) { var n = noseAt(S, d); S.emoteAt(type, n.x + d.face * (ahead || 3), n.y + 3, life || 0.8); }
  function sigh(S, d, small) { fromNose(S, d, small ? 'huff' : 'sigh', 0.9); }
  function sniffs(S, d) { fromNose(S, d, 'sniffs', 0.5, 4); }
  function achoo(S, d, pollen) { fromNose(S, d, pollen ? 'achoo_y' : 'achoo', 0.45, 5); }
  function other(S, d) { return d === S.dax ? S.gold : S.dax; }
  function ok(S, a) { return !!a && !a.hidden && !a.carried; }
  // 另一只醒着、离得不远：有一半的机会它也跟着做（M18）
  function spread(S, d, act) {
    var o = other(S, d);
    if (ok(S, o) && !S.asleep(o) && S.dist(d, o) < 80) S.raise('contagion', { who: d, dog: d, act: act });
  }
  // 现在有什么新鲜的东西可以看：蝴蝶、地上的道具、她的鼠标、小人
  function curiosity(S, d) {
    if (S.bfly.on && Math.abs(S.bfly.x - d.x) < 160) return S.bfly;
    var ps = S.prop.all(), i;
    for (i = 0; i < ps.length; i++) if (!ps[i].holder && S.dist(d, ps[i]) < 90) return ps[i];
    if (S.cursor.known && Math.abs(S.cursor.x - d.x) < 130 && S.cursor.y < d.y + 10) return 'cursor';
    return ok(S, S.man) ? S.man : null;
  }
  var ICON = { gold: ['ball', 'bone', 'shoe'], dax: ['butterfly', 'hole', 'tail'] };

  // ============================================================
  //  睡一觉：M03 转圈刨窝 → 睡 → M09 做梦（想法云）/ M07 有人走过拍拍尾巴 / M08 她的鼠标停在旁边就动动耳朵 → M02 起床伸懒腰 → M01 甩毛
  //  睡满 45 秒的地方记下来（第二天那里会开小花，见 place.js 的 nap_flowers）
  // ============================================================
  function* nap(S, d, minT, maxT) {
    yield S.act(d, 'nest_circle');
    S.hold(d, 'sleep'); d.wag = 0.1; sigh(S, d, true);
    var t0 = S.t(), len = S.rand(minT, maxT), dreamAt = t0 + S.rand(10, 22), thumpAt = t0 + 3, ackAt = t0 + 2;
    var seen = {}, i, a, cast = [S.man, other(S, d)];
    while (S.t() - t0 < len) {
      var now = S.t();
      // M09 做梦：爪子划、尾巴尖抖，头上一个想法云
      if (now >= dreamAt) {
        dreamAt = now + S.rand(20, 40);
        var icon = S.chance(0.05) ? 'heart' : S.pick(ICON[d.kind]);
        S.emote('thought_' + icon, d, d.face * 8, 3.2);
        yield S.act(d, 'dream_bubble');
        if (icon === 'heart') { d.wag = 0.5; yield 2.0; d.wag = 0.1; }
        sigh(S, d, true);
        continue;
      }
      // M08 她的鼠标停在它头边：耳朵动一下，睁一条缝，尾巴拍两下；再待 3 秒：睡梦里伸一只爪子去够
      var hd = S.anchor(d, 'head');
      if (S.cfg.cursorPlay !== false && now >= ackAt && S.dwell(hd, 22) > 0.6) {
        ackAt = now + 30;
        S.look(d, 'cursor');
        yield S.act(d, 'sleepy_ack');
        sigh(S, d);
        if (S.dwell(hd, 22) > 2.5) {
          var c = S.cursor, dx = (c.x - d.x) * d.face;
          S.rig(d, { pawAt: [Math.max(4, Math.min(16, dx)), 4] });
          S.emote('thought_cursor', d, d.face * 8, 2.0);
          yield 1.6;
          S.rig(d, null);
        }
        S.look(d, null);
        continue;
      }
      // M07 金毛闭着眼，有人从旁边 50 以内走过：睁一条缝，尾巴拍三下地
      if (d.kind === 'gold' && now >= thumpAt) {
        for (i = 0; i < cast.length; i++) {
          a = cast[i];
          if (!ok(S, a)) continue;
          var key = a.kind, near = S.dist(a, d) < 50, moved = seen[key] && Math.abs(seen[key][0] - a.x) + Math.abs(seen[key][1] - a.y) > 1.5;
          seen[key] = [a.x, a.y];
          if (near && moved) {
            thumpAt = now + 20;
            S.look(d, a);
            yield S.act(d, 'tail_thump');
            S.look(d, null);
            break;
          }
        }
      }
      yield 0.25;
    }
    // 睡满 45 秒：记下这个地方
    if (S.t() - t0 >= 45) {
      var list = S.mem.get('napSpots') || [];
      list.push({ x: Math.round(d.x), y: Math.round(d.y), day: S.time.day, k: d.kind });
      while (list.length > 6) list.shift();
      S.mem.set('napSpots', list);
    }
    // M02 起床：两段式伸懒腰，然后甩毛
    S.hold(d, 'stand');
    yield S.act(d, 'wake_stretch');
    spread(S, d, 'shake_off');
  }

  // ============================================================
  //  M01 甩毛
  // ============================================================
  add({ name: 'm_shake_off', zh: '甩毛', kind: 'solo', cast: 'dog', weight: function (S) { return S.me && S.me.kind === 'gold' ? 4 : 5; }, cool: 25,
    run: function* (S) {
      var d = S.me;
      S.hold(d, 'stand');
      S.act(d, 'shake_off');
      yield 0.3;
      if (d.kind === 'gold') S.bits(d.x, d.y - 14, 3, 'fur', 22, 30);
      else S.bits(d.x, d.y - 8, 3, S.grass(), 16, 30);
      yield 0.4;
      S.bits(d.x - d.face * d.half * 0.5, d.y - 6, 2, d.kind === 'gold' ? 'fur' : 'dirt', 14, 20);
      yield function () { return !d.ract || d.ractDone; };
      spread(S, d, 'shake_off');
      yield 0.4;
    } });

  // ============================================================
  //  M02 伸懒腰（两段式：前面压低、后腿一条一条往后拖）
  // ============================================================
  add({ name: 'm_wake_stretch', zh: '两段式伸懒腰', kind: 'solo', cast: 'dog', weight: function (S) { return S.quietFor() > 60 ? 4 : 2; }, cool: 60,
    run: function* (S) {
      var d = S.me;
      S.hold(d, 'stand');
      yield S.act(d, 'wake_stretch');
      spread(S, d, 'stretch');
      yield 0.3;
    } });

  // ============================================================
  //  M03 + M09 …：犯困了，转圈刨窝，睡一会儿
  // ============================================================
  add({ name: 'm_nest_nap', zh: '转圈刨窝，睡一觉（做梦、拍尾巴、动耳朵）', kind: 'solo', cast: 'dog', mood: 'sleepy', timeout: 130,
    weight: function (S) { var q = S.quietFor(); return q > 90 ? 6 : (q > 30 ? 3 : 1); }, cool: 40,
    when: function (S) { return !S.night(); },
    run: function* (S) { yield* nap(S, S.me, 30, 80); } });

  // ============================================================
  //  M04 金毛"轰"地趴下，叹一大口气；然后只有眉毛和眼睛跟着走过的人动
  // ============================================================
  add({ name: 'm_flump_sigh', zh: '轰然趴下，叹一口大气', kind: 'solo', cast: 'gold', weight: 7, cool: 30, mood: 'sleepy', timeout: 24,
    run: function* (S) {
      var d = S.me, i, a;
      S.hold(d, 'lie');
      S.act(d, 'flump_sigh');
      yield 0.7;
      S.puff(d.x, d.y, false);
      yield 0.8;
      sigh(S, d);
      yield function () { return !d.ract || d.ractDone; };
      S.rig(d, { chin: true });
      var until = S.t() + S.rand(4, 9), thumped = false;
      while (S.t() < until) {
        // 谁在附近走：眼睛跟着它
        var best = null, bd = 120;
        [S.man, S.dax].forEach(function (o) { if (ok(S, o) && S.dist(o, d) < bd) { bd = S.dist(o, d); best = o; } });
        S.look(d, best || null);
        if (!thumped && best && bd < 50 && S.chance(0.3)) { thumped = true; yield S.act(d, 'tail_thump'); }
        yield 0.4;
      }
    } });

  // ============================================================
  //  M05 歪头：有新鲜东西（蝴蝶、地上的道具、她的鼠标、小人）
  // ============================================================
  add({ name: 'm_head_tilt', zh: '歪头', kind: 'solo', cast: 'dog', weight: function (S) { return S.me && S.me.kind === 'gold' ? 4 : 5; }, cool: 20,
    run: function* (S) {
      var d = S.me, tg = curiosity(S, d);
      if (!tg) return;
      if (tg === 'cursor') S.faceTo(d, 'cursor'); else S.faceTo(d, tg);
      S.hold(d, d.kind === 'gold' ? 'sit' : 'stand'); S.look(d, tg); S.mood(d, 'curious');
      yield 0.3;
      yield S.act(d, 'head_tilt');
      d.wag = 0.6;
      if (S.chance(0.4)) spread(S, d, 'head_tilt');
      yield 0.5;
    } });

  // ============================================================
  //  M06 走两步回头等你
  // ============================================================
  add({ name: 'm_look_back', zh: '走两步回头等你', kind: 'solo', cast: 'dog', weight: 3, cool: 45,
    run: function* (S) {
      var d = S.me, from = ok(S, S.man) && S.dist(d, S.man) < 90 ? S.man : other(S, d);
      if (!ok(S, from)) return;
      var s = d.x >= from.x ? 1 : -1, F = S.field;
      if ((s > 0 && F.x1 - d.x < 70) || (s < 0 && d.x - F.x0 < 70)) s = -s;
      yield S.go(d, at(S, d.x + s * S.rand(22, 30), d.y + S.ry(S.rand(-6, 6)), d), 'walk', null, 3);
      S.look(d, from);
      yield S.act(d, 'look_back_wait');
      yield 1.0;
      S.look(d, null);
      if (S.chance(0.5)) yield S.go(d, at(S, d.x + s * 30, d.y, d), 'walk', null, 3);
      else yield S.go(d, S.beside(d, from, 10), 'trot', null, 3);
    } });

  // ============================================================
  //  M07 懒得起来，尾巴拍拍地（金毛趴着闭眼，有人走过）
  // ============================================================
  add({ name: 'm_tail_thump', zh: '懒得起来，尾巴拍拍地', kind: 'solo', cast: 'gold', weight: 4, cool: 20, mood: 'sleepy', timeout: 20,
    run: function* (S) {
      var d = S.me, seen = {}, t = 0;
      S.hold(d, 'lie'); S.rig(d, { chin: true, eyes: 'closed' }); d.wag = 0.1;
      while (t < 14) {
        var hit = null;
        [S.man, S.dax].forEach(function (o) {
          if (!ok(S, o)) return;
          var moved = seen[o.kind] && Math.abs(seen[o.kind][0] - o.x) + Math.abs(seen[o.kind][1] - o.y) > 1.5;
          seen[o.kind] = [o.x, o.y];
          if (moved && S.dist(o, d) < 50) hit = o;
        });
        if (!hit && S.cursorNear(d, 50) && S.cursor.speed > 5) hit = 'cursor';
        if (hit) {
          S.rig(d, { chin: true }); S.look(d, hit);
          yield S.act(d, 'tail_thump');
          S.bits(d.x - d.face * d.half, d.y, 2, 'dirt', 8, 14);
          S.rig(d, { chin: true, eyes: 'closed' }); S.look(d, null);
          return;
        }
        yield 0.3; t += 0.3;
      }
    } });

  // ============================================================
  //  M08 睡着时她的鼠标停在旁边：动动耳朵，不醒（react：notice）
  // ============================================================
  add({ name: 'm_sleepy_ack', zh: '睡着时你路过，动动耳朵', kind: 'react', on: 'notice', cast: 'who', tag: 'cursor', cool: 30, mood: 'sleepy', timeout: 40,
    when: function (S, ev) { return !!ev && !!ev.who && !ev.who.isPerson && S.asleep(ev.who) && ev.dist < 40; },
    run: function* (S) {
      var d = S.me;
      S.hold(d, 'sleep'); S.look(d, 'cursor');
      yield S.act(d, 'sleepy_ack');
      sigh(S, d);
      if (S.dwell(S.anchor(d, 'head'), 26) > 2.5) {
        var dx = (S.cursor.x - d.x) * d.face;
        S.rig(d, { pawAt: [Math.max(4, Math.min(16, dx)), 4] });
        S.emote('thought_cursor', d, d.face * 8, 2.0);
        yield 1.6;
        S.rig(d, null);
      }
      S.look(d, null);
      yield S.rand(14, 28);                      // 接着睡
      S.hold(d, 'stand');
      yield S.act(d, 'wake_stretch');
    } });

  // ============================================================
  //  M10 立起来瞭望（小腊肠）
  // ============================================================
  add({ name: 'm_periscope', zh: '立起来瞭望', kind: 'solo', cast: 'dax', weight: function (S) { return S.dist(S.dax, S.gold) > 200 || (ok(S, S.man) && S.dist(S.dax, S.man) > 200) ? 7 : 4; }, cool: 40,
    run: function* (S) {
      var d = S.me;
      yield S.act(d, 'periscope');
      // 看见了：小跑过去
      var tg = ok(S, S.man) && S.dist(d, S.man) > 160 ? S.man : (S.dist(d, S.gold) > 160 ? S.gold : null);
      if (tg) yield S.go(d, S.beside(d, tg, 12), 'trot', null, 5);
    } });

  // ============================================================
  //  M11 青蛙趴（小腊肠）：喘着气，懒懒地摇两下；然后睡一下，或者光用前腿往前拖 3（海豹爬）
  // ============================================================
  add({ name: 'm_sploot_rest', zh: '青蛙趴', kind: 'solo', cast: 'dax', weight: function (S) { return S.quietFor() < 20 ? 5 : 3; }, cool: 40,
    run: function* (S) {
      var d = S.me;
      yield S.act(d, 'sploot_rest');
      if (S.chance(0.5)) { S.hold(d, 'lie'); yield S.slide(d, d.face * 3, 0, 0.8); S.hold(d, 'stand'); }
      else { S.hold(d, 'lie'); S.rig(d, { chin: true }); yield S.rand(3, 5); }
    } });

  // ============================================================
  //  M12 听地下的动静，高高扑下去（小腊肠）；鼻头脏 10 秒
  // ============================================================
  add({ name: 'm_mole_pounce', zh: '听地下的动静，高高扑下去', kind: 'solo', cast: 'dax', weight: 3, cool: 240, mood: 'mischievous',
    run: function* (S) {
      var d = S.me, F = S.field;
      if ((d.face > 0 && F.x1 - d.x < 40) || (d.face < 0 && d.x - F.x0 < 40)) d.face = -d.face;
      S.act(d, 'mole_pounce');
      yield 2.4;
      yield S.slide(d, d.face * 8, 0, 0.45);
      S.puff(d.x + d.face * d.mx, d.y, false);
      yield S.each(0.8, function (t) { if (Math.floor(t * 10) % 2) S.bits(d.x + d.face * (d.mx - 2), d.y, 1, 'dirt', 18, 40); });
      yield 0.2;
      achoo(S, d);
      yield function () { return !d.ract || d.ractDone; };
    } });

  // ============================================================
  //  M13 咬小飞虫：一只小虫绕着头转，头跟着一顿一顿；咬两口，舔舔嘴（或者一脸问号）
  // ============================================================
  add({ name: 'm_fly_snap', zh: '咬小飞虫', kind: 'solo', cast: 'dog', weight: 3, cool: 300, mood: 'funny', hours: [8, 19],
    run: function* (S) {
      var d = S.me, ang = 0;
      S.hold(d, d.kind === 'gold' ? 'lie' : 'sit');
      yield 0.4;
      var h = S.anchor(d, 'head');
      var g = S.prop.spawn('gnat', '', h.x, d.y + 0.5, { z: h.z + 4, shadow: false });
      var orbit = function (t, dt) {
        if (!S.prop.alive(g)) return;
        var hh = S.anchor(d, 'head');
        ang += (dt || 1 / 60) * 1.5 * 2 * Math.PI;
        S.prop.move(g, hh.x + d.face * 2 + Math.cos(ang) * 6, d.y + 0.5, Math.max(1, hh.z + 3 + Math.sin(ang) * 3));
        S.look(d, g);
      };
      S.each(orbit);
      S.act(d, 'fly_snap');
      var T = (d.kind === 'gold' ? [1.2, 2.2] : [1.0, 1.75]);
      yield T[0];
      S.emote('spark', d, d.face * (d.mx + 2), 0.4);
      yield T[1] - T[0];
      S.emote('spark', d, d.face * (d.mx + 2), 0.4);
      // 小虫飞走了
      S.prop.fling(g, d.face * 60, S.ry(-20), 80);
      yield 0.4;
      S.prop.remove(g, false);
      S.look(d, null);
      yield function () { return !d.ract || d.ractDone; };
      if (S.chance(0.4)) S.emote('q', d, 0, 0.9);
      yield 0.4;
    } });

  // ============================================================
  //  M14 闻到了，顺着气味找（小腊肠）：抬鼻子嗅三下，然后低头顺着他走过的路一路闻过去，碰碰他的鞋，打个喷嚏
  // ============================================================
  add({ name: 'm_scent_track', zh: '闻到了，顺着气味找', kind: 'solo', cast: 'dax', weight: 3, cool: 240, family: 'nose',
    when: function (S) { return ok(S, S.man) && S.dist(S.dax, S.man) > 50 && S.dist(S.dax, S.man) < 260; },
    run: function* (S) {
      var d = S.me, man = S.man, i;
      S.faceTo(d, man); S.hold(d, 'stand'); d.look = 0.8; S.rig(d, { scent: true });
      for (i = 0; i < 3; i++) { sniffs(S, d); yield 0.33; }
      S.rig(d, null); d.look = 0;
      // 一路闻过去：路线左右摆 3
      var x0 = d.x, y0 = d.y, t0 = S.now(), sp = S.spd(d, 'sniff') * 1.6;
      var goal = S.beside(d, man, 2), len = Math.max(1, S.dist(d, goal));
      S.track(d, function () {
        var k = Math.min(1, (S.now() - t0) * sp / len), w = Math.sin(k * Math.PI * 5) * 3 * (1 - k);
        return { x: x0 + (goal.x - x0) * k, y: cy(S, y0 + (goal.y - y0) * k + S.ry(w)) };
      }, sp * 1.3, 'sniff');
      d.wag = 0.5;
      yield S.until(function () { return S.dist(d, goal) < 3; }, Math.min(9, len / sp + 2));
      S.stop(d); S.faceTo(d, man); S.hold(d, 'sniff');
      yield S.act(d, 'nudge');
      achoo(S, d);
      yield S.act(d, 'sneeze');
      d.happy = 1; d.wag = 1;
      yield 0.8;
      d.happy = 0;
    } });

  // ============================================================
  //  M15 随便叼个东西巡游（金毛）：叼起地上的玩具，昂着头翘着尾巴走一段弧线，然后趴下，下巴压在玩具上
  // ============================================================
  function looseToy(S, d) {
    var ps = S.prop.all(), i;
    for (i = 0; i < ps.length; i++) { var p = ps[i]; if (!p.holder && (p.kind === 'rope' || p.kind === 'stick') && S.dist(d, p) < 200) return p; }
    return null;
  }
  add({ name: 'm_carry_parade', zh: '随便叼个东西巡游', kind: 'solo', cast: 'gold', weight: function (S) { return looseToy(S, S.gold) ? 6 : 0; }, cool: 240, mood: 'proud',
    run: function* (S) {
      var d = S.me, p = looseToy(S, d);
      if (!p) return;
      yield S.go(d, S.beside(d, S.prop.where(p), 2), 'walk', null, 6);
      S.faceTo(d, p); S.hold(d, 'sniff');
      yield 0.6;
      S.prop.carry(p, d, 'mouth'); if (p.kind === 'rope') S.prop.set(p, 'carry'); p.face = d.face; if (p.data) p.data.used = S.now();
      S.hold(d, 'stand'); S.mood(d, 'proud'); d.look = 0.4; S.rig(d, { tailSet: 50 }); d.wag = 0.9;
      var s = d.face, F = S.field;
      if ((s > 0 && F.x1 - d.x < 80) || (s < 0 && d.x - F.x0 < 80)) s = -s;
      var mid = at(S, d.x + s * 30, d.y + S.ry(-14), d), end = at(S, d.x + s * 60, d.y, d);
      yield S.go(d, mid, 30, null, 3);
      p.face = d.face;
      yield S.go(d, end, 30, null, 3);
      p.face = d.face;
      // 献给"随便谁"：趴下，玩具放在两只前爪中间，下巴压在上面
      S.rig(d, null); S.mood(d, null); d.look = 0;
      var m = S.anchor(d, 'mouth');
      S.prop.drop(p, m.x, d.y + S.ry(0.5)); S.prop.set(p, ''); p.face = 1;
      S.hold(d, 'lie'); S.rig(d, { chin: true });
      yield S.rand(3, 6);
    },
    end: function (S) { var p = S.prop.find('rope'); if (p && p.holder === S.gold) { S.prop.drop(p); S.prop.set(p, ''); } } });

  // ============================================================
  //  M16 晒太阳（10-16 点）：走到一片阳光里，坐着仰起鼻子闭上眼，一动不动；然后侧躺下睡一会儿
  //  有草地时地上画一片淡淡的阳光（在她的窗口后面），演完就收走
  // ============================================================
  add({ name: 'm_sunbathe', zh: '晒太阳', kind: 'solo', cast: 'dog', weight: 3, cool: 900, mood: 'sleepy', hours: [10, 16], timeout: 60,
    run: function* (S) {
      var d = S.me, p = S.randPt(30, d);
      p = at(S, d.x + Math.max(-80, Math.min(80, p.x - d.x)), d.y + Math.max(-50, Math.min(50, p.y - d.y)), d);
      if (S.cfg.lawnMemories !== false) S._sun = S.decal('sunpatch', p.x, p.y + 6, {});
      yield S.go(d, p, 'walk', null, 6);
      S.faceTo(d, { x: d.x + (S.chance(0.5) ? 1 : -1) });
      yield S.act(d, 'sunbathe');
      S.emote('spark', d, d.face * 6, 0.6);
      S.hold(d, ['flop', 'lie']); S.rig(d, { eyes: 'closed' });
      yield S.rand(8, 20);
      if (d.kind === 'gold') d.pant = true;
      S.rig(d, null); S.hold(d, 'stand');
      yield S.act(d, 'shake_off');
    },
    end: function (S) { if (S._sun) S.decalRemove(S._sun); } });

  // ============================================================
  //  M17 四脚朝天睡着了（金毛打滚时有时这样收尾）
  // ============================================================
  add({ name: 'm_dead_bug', zh: '四脚朝天睡着了', kind: 'solo', cast: 'gold', weight: 2, cool: 600, mood: 'funny', timeout: 20,
    run: function* (S) {
      var d = S.me;
      S.hold(d, 'roll'); d.happy = 1;
      if (S.grass) S.bits(d.x, d.y - 2, 3, S.grass(), 16, 30);
      yield S.act(d, 'dead_bug');
      d.happy = 0;
      S.hold(d, 'lie');
      yield 0.5;
    } });

  // ============================================================
  //  M18 甩毛、哈欠、伸懒腰会传染（react：另一只刚做完）——一半的机会；小人偶尔也跟着打个哈欠
  // ============================================================
  add({ name: 'm_contagion', zh: '甩毛和哈欠会传染', kind: 'react', on: 'contagion', cast: 'other', cool: 240, chance: 0.5, timeout: 8,
    when: function (S, ev) { return !!ev && !!S.other && !S.asleep(S.other) && S.dist(ev.who, S.other) < 80; },
    run: function* (S, ev) {
      var d = S.me, src = ev.who, act = ev.act || 'shake_off';
      S.faceTo(d, src); S.look(d, src);
      S.rig(d, { tilt: d.kind === 'gold' ? 1 : -1 });
      yield 0.6;
      S.rig(d, null); S.look(d, act === 'head_tilt' ? (ev.target || src) : null);
      if (act === 'head_tilt') { S.rig(d, { tilt: src.kind === 'gold' ? -1 : 1 }); yield 1.0; S.rig(d, null); return; }
      yield S.act(d, act === 'stretch' ? 'wake_stretch' : (act === 'yawn' ? 'yawn' : 'shake_off'));
      if (act === 'yawn' && S.chance(0.2) && S.free(S.man) && S.join(S.man)) yield S.act(S.man, 'yawn');
    } });

  // ============================================================
  //  M19 鼠标嗖地飞过，吓一跳（react：flyby）。小腊肠：蹦起来、举爪定住、冲着走掉的鼠标叫两声、低头闻、甩毛；
  //  金毛只是抖抖耳朵慢慢转头眨个眼。吓完了发一个 startled（金毛会过来看看它：dogs.js 的 check_in）
  // ============================================================
  add({ name: 'flyby_startle', zh: '鼠标嗖地飞过，吓一跳', kind: 'react', on: 'flyby', cast: 'who', tag: 'cursor', cool: 300, mood: 'funny', timeout: 10,
    when: function (S, ev) { return !!ev && !!ev.who && !ev.who.isPerson && !S.asleep(ev.who); },
    run: function* (S, ev) {
      var d = S.me, vx = ev && ev.vx ? ev.vx : 1, gone = { x: d.x + (vx > 0 ? 60 : -60), y: d.y, z: 20 };
      if (d.kind === 'gold') {
        S.look(d, gone);
        yield S.act(d, 'flyby_startle');
        S.look(d, null);
        return;
      }
      S.emote('bang', d, 0, 0.7);
      S.act(d, 'flyby_startle');
      yield S.slide(d, -d.face * 4, 0, 0.35);
      S.faceTo(d, gone); S.look(d, gone);
      yield 1.2;
      d.bark = 0.25; S.emote('woof', d, d.face * 10, 0.5);
      yield 0.4;
      d.bark = 0.25; S.emote('woof', d, d.face * 10, 0.5);
      yield 0.5;
      S.look(d, null);
      yield function () { return !d.ract || d.ractDone; };
      S.raise('startled', { who: d, dog: d });
    } });

  // ============================================================
  //  M20 闻闻你的手（react：她的鼠标停在金毛头前 30-60）：转过头，伸长脖子嗅三下，认出来了：眯眼、尾巴慢慢扫；
  //  她再凑过来就用头顶一下鼠标（冒个小爱心）；她走开就目送、叹口气
  // ============================================================
  add({ name: 'sniff_hello', zh: '闻闻你的手', kind: 'react', on: 'notice', cast: 'who', tag: 'cursor', cool: 180, mood: 'tender', timeout: 10,
    when: function (S, ev) { return !!ev && ev.who === S.gold && !S.asleep(S.gold) && ev.dist > 20 && ev.dist < 66; },
    run: function* (S) {
      var d = S.me;
      S.faceTo(d, 'cursor'); S.look(d, 'cursor');
      S.act(d, 'sniff_hello');
      yield 0.6;
      sniffs(S, d);
      yield 0.5;
      sniffs(S, d);
      yield 0.5;
      sniffs(S, d);
      yield 1.0;
      d.wag = 0.7;
      var near = S.cursorNear(d, 26);
      yield 0.6;
      if (S.cursorNear(d, 26) || near) S.emote('hs', d, d.face * 6, 1.0);
      else sigh(S, d);
      yield function () { return !d.ract || d.ractDone; };
      S.look(d, null);
    } });

  // ============================================================
  //  M21 得意地蹬两下草（小腊肠）
  // ============================================================
  add({ name: 'm_kick_scuff', zh: '得意地蹬两下草', kind: 'solo', cast: 'dax', weight: 3, cool: 60, mood: 'proud',
    run: function* (S) {
      var d = S.me;
      S.act(d, 'kick_scuff');
      yield S.each(0.8, function (t) { if (Math.floor(t * 8) % 2) S.bits(d.x - d.face * d.half, d.y, 1, S.grass(), 16, 26); });
      yield function () { return !d.ract || d.ractDone; };
      S.mood(d, 'proud'); S.rig(d, { tailSet: 70 }); d.look = 0.4;
      yield S.go(d, at(S, d.x + d.face * 12, d.y, d), 'walk', null, 2);
      yield 0.3;
    } });
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
