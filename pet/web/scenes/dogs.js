// 球球 · 戏包：两只狗之间（R5 卡片 A01-A16）
//
//   小腊肠：五公斤的胆子，快、爱指挥、什么都要闻；金毛：三十公斤的耐心，慢、沉、大方，总是让着它。
//   每一段 = 一条记录 + 一个 generator，用的都是 pet.js 开头"怎么写一场戏"里的舞台指令。
//   姿势、动作、表情符号的名字画的人还在加：没有的会自己退回站着 / 不画，不会出错。
//   玩具（绳子、树枝）演完会在地上留一会儿（place.js 里金毛会把它叼回岛里收好）。
(function (G) {
  'use strict';
  var L = G.PET_SCENES = G.PET_SCENES || [];
  function add(r) { r.pack = 'dogs'; if (!r.cat) r.cat = 'A'; L.push(r); }

  // ============================================================
  //  小工具
  // ============================================================
  function cx(S, x, a) { var F = S.field, h = (a ? a.half : 20) + 2; return Math.max(F.x0 + h, Math.min(F.x1 - h, x)); }
  function cy(S, y) { var F = S.field; return Math.max(F.y0, Math.min(F.y1, y)); }
  function at(S, x, y, a) { return { x: cx(S, x, a), y: cy(S, y) }; }
  // 这一侧（s = 1 右边 / -1 左边）离 x 还有没有 w 那么宽的空地
  function room(S, x, s, w) { var F = S.field; return s > 0 ? F.x1 - x > w : x - F.x0 > w; }
  // 鼻尖在屏幕上的哪一点；从鼻尖冒出来的小表情（叹气、嗅一嗅、喷嚏）
  function noseAt(S, d) { var n = S.anchor(d, 'nose'); return { x: n.x, y: n.y - n.z }; }
  function fromNose(S, d, type, life, ahead) { var n = noseAt(S, d); S.emoteAt(type, n.x + d.face * (ahead || 3), n.y + 3, life || 0.8); }
  function sigh(S, d, small) { fromNose(S, d, small ? 'huff' : 'sigh', 0.9); }
  function sniffs(S, d) { fromNose(S, d, 'sniffs', 0.5, 4); }
  function achoo(S, d, pollen) { fromNose(S, d, pollen ? 'achoo_y' : 'achoo', 0.45, 5); }
  function grr(S, d) { fromNose(S, d, 'grr', 0.45, 1); }
  function woof(S, d, big) { d.bark = big ? 0.45 : 0.3; S.emote(big ? 'bigwoof' : 'woof', d, d.face * (big ? 14 : 10), big ? 0.9 : 0.6); }
  // 嘴在哪：{ x, y（脚下）, z }
  function mouth(S, d) { return S.anchor(d, 'mouth'); }
  // 两只狗都醒着、都没被拎着
  function awake2(S) { return !S.asleep(S.dax) && !S.asleep(S.gold); }
  // 玩具：地上已经有的那一个；没有就在场地边上"找到"一个（离 from 60-100 远）。keep：演完还留一会儿
  function toy(S, kind, from) {
    var p = S.prop.find(kind);
    if (p) return p;
    var F = S.field, s = from.x < (F.x0 + F.x1) / 2 ? 1 : -1, x = cx(S, from.x + s * S.rand(60, 100), null);
    var y = cy(S, from.y + S.ry(S.rand(-20, 20)));
    return S.prop.spawn(kind, '', x, y, { keep: true, cap: 300, data: { toy: true } });
  }
  function touchToy(S, p) { if (p && p.data) p.data.used = S.now(); }
  // 叼着走（绳子换成"叼着一头往下坠"的那张图），朝向跟着叼的那只
  function carryToy(S, p, d) { S.prop.carry(p, d, 'mouth'); if (p.kind === 'rope') S.prop.set(p, 'carry'); p.face = d.face; touchToy(S, p); }
  function dropToy(S, p, x, y) {
    if (!S.prop.alive(p)) return;
    if (x === undefined) S.prop.drop(p); else S.prop.drop(p, x, y);
    S.prop.set(p, ''); p.face = 1; touchToy(S, p);
  }
  // 戏完了 / 被打断：嘴里的玩具放回地上（引擎也会放，这里顺手把图换回平放的那张）
  function endToy(S) { ['rope', 'stick'].forEach(function (k) { var p = S.prop.find(k); if (p && p.holder) dropToy(S, p); }); }
  // 绕着一点转圈（dir 1 / -1 决定方向）：返回转完要的秒数
  function ring(S, d, c, rx, ry, laps, speed, dir) {
    var sp = typeof speed === 'number' ? speed : S.spd(d, speed);
    var L0 = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2), lapT = L0 / Math.max(20, sp * 0.85);
    var a0 = Math.atan2((d.y - c.y) / Math.max(1, ry || 1), (d.x - c.x) / rx), t0 = S.now();
    S.track(d, function () {
      var ang = a0 + dir * (S.now() - t0) / lapT * 2 * Math.PI;
      return { x: c.x + Math.cos(ang) * rx, y: c.y + Math.sin(ang) * ry };
    }, sp);
    return lapT * laps;
  }

  // ============================================================
  //  A01 撞到了，马上鞠躬赔礼
  // ============================================================
  add({ name: 'sorry_bow', zh: '撞到了，马上鞠躬赔礼', cast: 'dax gold', weight: 1, cool: 300, mood: 'playful', tag: 'lively', timeout: 14,
    when: function (S) { return awake2(S) && S.gold.energy > 0.3; },
    run: function* (S) {
      var dax = S.dax, gold = S.gold;
      yield S.stage(gold);
      S.hold(gold, 'stand'); gold.wag = 0.4;
      // 金毛屁股朝着小腊肠，小腊肠从后面冲过去
      var s = dax.x < gold.x ? -1 : 1;
      if (!room(S, gold.x, s, gold.half + 80)) s = -s;
      if (!room(S, gold.x, -s, gold.half + 50)) return;
      gold.face = -s;
      var y = gold.y + S.ry(3);
      yield S.go(dax, at(S, gold.x + s * (gold.half + 70), y, dax), 'trot', null, 5);
      S.faceTo(dax, gold); dax.wag = 1; dax.pant = true;
      yield 0.2;
      var rump = gold.x + s * gold.half * 0.55;
      S.go(dax, at(S, gold.x - s * (gold.half + 80), y, dax), 'run', null, 4);
      yield S.until(function () { return (dax.x - rump) * s <= 0; }, 3);
      // 0-0.6 秒：蹭到了后腿
      S.puff(rump, gold.y + 1, false);
      S.hop(gold, 60); S.slide(gold, s * 3, S.ry(-4), 0.3);
      S.rig(gold, { lookBack: true }); S.emote('bang', gold, 0, 0.7);
      yield 0.3;
      // 0.6-1.4 秒：刹车（一大团灰），掉头，马上伏下身子：对不起！还玩吗？
      S.stop(dax); S.puff(dax.x + dax.face * 8, dax.y, true);
      yield 0.25;
      S.faceTo(dax, gold); S.hold(dax, 'bow'); S.look(dax, gold); dax.wag = 1;
      yield 0.6;
      // 1.4-2.2 秒：金毛耳朵一软，打个"玩耍喷嚏"，也伏下来
      S.rig(gold, null); S.faceTo(gold, dax); S.mood(gold, 'happy');
      S.act(gold, 'sneeze', 0.6);
      yield 0.2;
      achoo(S, gold);
      yield 0.35;
      S.hold(gold, 'bow'); gold.wag = 0.9;
      yield 0.6;
      // 2.2-4 秒：一起蹦起来跑开，金毛追 1.5 秒就散了
      var away = at(S, dax.x + (dax.x >= gold.x ? 1 : -1) * 70, dax.y + S.ry(S.rand(-18, 18)), dax);
      S.hold(dax, 'stand'); S.hold(gold, 'stand'); S.mood(gold, null);
      var c = S.go(dax, away, 'run', null, 3);
      S.follow(gold, dax, 16, S.ry(2), S.spd(gold, 'run') * 0.8);
      yield 1.5;
      S.stop(gold); S.hold(gold, 'stand'); gold.pant = true;
      yield c;
      S.hold(dax, 'stand'); dax.pant = true;
      yield 0.4;
    },
  });

  // ============================================================
  //  A02 从大狗肚子底下钻过去
  // ============================================================
  add({ name: 'tunnel_run', zh: '从大狗肚子底下钻过去', cast: 'dax gold', weight: 2, cool: 600, mood: 'mischievous', tag: 'lively', timeout: 14,
    when: function (S) { return awake2(S) && S.dist(S.dax, S.gold) < 160; },
    run: function* (S) {
      var dax = S.dax, gold = S.gold;
      yield S.stage(gold);
      S.hold(gold, 'stand'); gold.wag = 0.3;
      var s = dax.x < gold.x ? -1 : 1;
      if (!room(S, gold.x, s, 80)) s = -s;
      if (!room(S, gold.x, s, 70) || !room(S, gold.x, -s, 70)) return;
      var y = gold.y + S.ry(-1);           // 在金毛身后一点点：金毛近处的腿画在它前面
      yield S.go(dax, at(S, gold.x + s * 72, y, dax), 'trot', null, 5);
      S.faceTo(dax, gold); dax.wag = 1; dax.pant = true;
      yield 0.25;
      // 第一趟：低着头，从前后腿中间冲过去
      dax.look = -0.6;
      var c = S.go(dax, at(S, gold.x - s * 70, y, dax), 'run', null, 3);
      yield S.until(function () { return (dax.x - gold.x) * s <= 0; }, 2);
      S.hold(gold, 'alert'); S.rig(gold, { pawUp: true }); gold.look = -0.8;
      yield c;
      dax.look = 0;
      // 金毛低头往肚子底下看，再回头看
      S.rig(gold, { pawUp: true, lookBack: true }); gold.look = 0;
      yield S.go(dax, at(S, gold.x - s * 86, cy(S, y + S.ry(22)), dax), 'run', null, 2);
      S.rig(gold, null); S.faceTo(gold, dax); S.hold(gold, 'stand');
      yield S.go(dax, at(S, gold.x - s * 66, y, dax), 'run', null, 2);
      // 第二趟，反过来：金毛吓得四脚一蹦
      dax.look = -0.6;
      var stopX = gold.x + s * (gold.mx + dax.mx + 16);
      c = S.go(dax, at(S, stopX, y, dax), 'run', null, 3);
      yield S.until(function () { return (dax.x - gold.x) * s >= 0; }, 2);
      S.hop(gold, 70); S.emote('bang', gold, 0, 0.7);
      yield c;
      dax.look = 0;
      S.puff(dax.x + dax.face * 8, dax.y, true);
      // 金毛冲着出口伏下身子；小腊肠掉头，鼻子对鼻子
      S.faceTo(gold, dax); S.hold(gold, 'bow'); gold.wag = 0.9;
      S.faceTo(dax, gold); S.hold(dax, 'stand');
      yield S.slide(dax, -s * 8, 0, 0.25);
      S.hold(dax, 'bow'); dax.wag = 1; S.look(dax, gold); S.look(gold, dax);
      yield 0.5;                                          // 定住，只有尾巴在动
      // 小腊肠一蹦，散开追一秒
      S.hold(dax, 'stand'); S.hold(gold, 'stand'); S.hop(dax, 110);
      yield 0.3;
      c = S.go(dax, at(S, dax.x + s * 60, dax.y + S.ry(S.rand(-16, 16)), dax), 'run', null, 2);
      S.follow(gold, dax, 18, 0, S.spd(gold, 'trot') * 1.3);
      yield 1.0;
      S.stop(gold); S.hold(gold, 'stand'); gold.pant = true;
      yield c;
      dax.pant = true;
      yield 0.3;
    },
  });

  // ============================================================
  //  A03 绕着大狗疯跑，突然定格
  // ============================================================
  add({ name: 'orbit_and_freeze', zh: '绕着大狗疯跑，突然定格', cast: 'dax gold', weight: 2, cool: 360, mood: 'playful', tag: 'lively', timeout: 18,
    when: function (S) { return awake2(S); },
    run: function* (S) {
      var dax = S.dax, gold = S.gold;
      yield S.stage(gold);
      if (!room(S, gold.x, 1, 50) || !room(S, gold.x, -1, 50)) return;
      S.hold(gold, 'lie'); gold.wag = 0.4;
      var c = { x: gold.x, y: gold.y }, rx = 38, ryy = S.ry(15), dir = dax.x < gold.x ? 1 : -1;
      yield S.go(dax, at(S, c.x + (dax.x < c.x ? -rx : rx), c.y, dax), 'run', null, 3);
      // 0-3 秒：一圈一圈地跑，金毛的头跟着转（看网球的人）
      S.look(gold, dax); dax.wag = 1; dax.pant = true;
      var T = ring(S, dax, c, rx, ryy, 2.2, 'run', dir);
      yield T * 0.45;
      S.emote('dizzy', gold, 0, 1.0);
      yield T * 0.55;
      // 3-3.4 秒：金毛两只前爪往前一拍，正好拦在它的路上
      S.faceTo(gold, dax); S.hold(gold, 'bow');
      S.puff(gold.x + gold.face * gold.half, gold.y, false);
      S.stop(dax); S.puff(dax.x + dax.face * 8, dax.y, true);
      // 3.4-4.2 秒：刹住，伏下来对着金毛；眼对眼，只有尾巴在动
      yield 0.2;
      S.faceTo(dax, gold); S.hold(dax, 'bow'); S.look(dax, gold); gold.wag = 0.8;
      yield 0.8;
      // 4.2-6 秒：炸开！小腊肠反着跑，金毛蹦起来颠颠地追半圈，追不上就算了
      S.hold(dax, 'stand'); S.hold(gold, 'stand');
      T = ring(S, dax, c, rx, ryy, 1.5, 'run', -dir);
      S.follow(gold, dax, 18, 0, S.spd(gold, 'trot') * 1.2);
      yield T * 0.4;
      S.stop(gold); S.hold(gold, 'stand'); gold.pant = true; S.look(gold, dax);
      yield T * 0.6;
      S.stop(dax);
      // 6-7 秒：金毛甩甩毛、叹口气趴下；小腊肠青蛙趴，喘
      S.hold(dax, 'lie'); dax.pant = true; S.look(dax, gold);
      yield S.act(gold, ['shakeoff', 'shake_off'], 1.8);
      S.hold(gold, 'lie'); sigh(S, gold);
      yield 1.2;
    },
  });

  // ============================================================
  //  A04 大尾巴逗小狗
  // ============================================================
  add({ name: 'tail_toy', zh: '大尾巴逗小狗', cast: 'dax gold', weight: 3, cool: 480, mood: 'mischievous', tag: 'calm', timeout: 16,
    when: function (S) { return awake2(S) && S.dist(S.dax, S.gold) < 150; },
    run: function* (S) {
      var dax = S.dax, gold = S.gold, i;
      yield S.stage(gold);
      var s = dax.x < gold.x ? -1 : 1;                  // 小腊肠在哪边：金毛的尾巴朝那边
      if (!room(S, gold.x, s, gold.half + 60)) s = -s;
      if (!room(S, gold.x, s, gold.half + 50)) return;
      gold.face = -s; S.hold(gold, 'lie'); gold.wag = 0.6;
      yield 0.5;
      var tip = S.anchor(gold, 'tailTip');
      // 0-1.5 秒：走到尾巴尖后面，盯着它看：左、右、左
      yield S.go(dax, at(S, tip.x + s * (16 + dax.mx), gold.y + S.ry(1), dax), 'trot', null, 5);
      S.faceTo(dax, gold); dax.wag = 0.2;
      for (i = 0; i < 3; i++) {
        tip = S.anchor(gold, 'tailTip');
        S.look(dax, { x: tip.x + (i % 2 ? 4 : -4), y: gold.y, z: tip.z });
        yield 0.3;
      }
      S.look(dax, null);
      S.hold(dax, 'stalk'); S.rig(dax, { wiggle: 1 }); S.mood(dax, 'focused');
      yield 0.55;
      // 1.5-2.2 秒：扑！落地趴下，两只前爪按在尾巴尖上
      S.rig(dax, null); S.hold(dax, 'stand'); S.hop(dax, 100);
      yield S.slide(dax, -s * 12, 0, 0.35);
      S.hold(dax, 'bow'); S.rig(dax, { pawAt: [dax.mx * 0.6, 0] });
      yield 0.5;
      // 2.2-3.2 秒：金毛回头看，冒个问号，把尾巴竖起来；小腊肠跳两下，够不着
      S.rig(gold, { lookBack: true, tailSet: 80 }); S.emote('q', gold, 0, 0.9);
      S.rig(dax, null); S.hold(dax, 'stand'); dax.look = 0.8; S.mood(dax, null);
      yield 0.25;
      S.hop(dax, 90); dax.wag = 1;
      yield 0.45;
      S.hop(dax, 90);
      yield 0.45;
      // 3.2-4.5 秒：尾巴"啪"地落下来，正好拍在它头顶
      S.rig(gold, { lookBack: true, tailSet: -20 });
      yield 0.15;
      S.emote('spark', dax, 0, 0.5); S.rig(dax, { ears: 1 }); dax.look = 0;
      yield 0.35;
      S.rig(dax, null);
      S.act(dax, 'sneeze', 0.6);
      yield 0.15;
      achoo(S, dax);
      yield 0.5;
      // 4.5-6.5 秒：一口叼住尾巴上的长毛，被尾巴甩得左右晃；金毛一甩就甩开了
      S.rig(gold, { lookBack: true }); gold.wag = 1;
      S.rig(dax, { jaw: 0.4 });
      S.track(dax, function () { var t = S.anchor(gold, 'tailTip'); return { x: t.x + s * dax.mx, y: dax.y }; }, 'trot', 'tug');
      yield 0.9;
      S.stop(dax); S.rig(dax, null); S.hold(dax, 'stand');
      tip = S.anchor(gold, 'tailTip');
      S.bits(tip.x, tip.y - tip.z, 3, 'fur', 14, 30);
      yield 0.15;
      dax.face = -dax.face;
      yield 0.2;
      dax.face = -dax.face;
      yield 0.15;
      S.hold(dax, 'bow'); dax.wag = 1;
      S.act(gold, 'nudge', 0.6);
      S.emote('heart', dax, 0, 1.1);
      yield 1.0;
      S.rig(gold, null); gold.wag = 0.5;
      yield 0.3;
    },
  });

  // ============================================================
  //  A05 大狗趴下来，让你赢
  // ============================================================
  add({ name: 'down_to_your_level', zh: '大狗趴下来，让你赢', cast: 'dax gold', weight: function (S) { return S.gold.energy < 0.45 ? 5 : 3; },
    cool: 480, mood: 'tender', tag: 'calm', timeout: 22,
    when: function (S) { return awake2(S); },
    run: function* (S) {
      var dax = S.dax, gold = S.gold, hopAt = 0;
      yield S.stage(gold);
      S.faceTo(gold, dax);
      if (!room(S, gold.x, gold.face, gold.mx + 70)) gold.face = -gold.face;
      // 0-1 秒：小腊肠在金毛脸前 12 处伏下身子，叫一声；金毛不站起来，反而趴下，前爪伸向它
      yield S.go(dax, at(S, gold.x + gold.face * (gold.mx + 12 + dax.mx), gold.y + S.ry(1), dax), 'trot', null, 5);
      S.faceTo(dax, gold); S.hold(dax, 'bow'); dax.wag = 1; woof(S, dax);
      S.hold(gold, 'lie'); gold.wag = 0.7; S.rig(gold, { pawAt: [gold.mx * 0.7, 1] });
      yield 0.5;
      S.hop(dax, 40);
      yield 0.5;
      // 1-4 秒：张着嘴"过招"：两个头绕着对方画 8 字，小腊肠前半身一蹦一蹦，前爪拍了两下金毛的嘴
      S.rig(gold, { jaw: 0.5 });
      yield S.each(3, function (t) {
        var a = mouth(S, gold), b = mouth(S, dax);
        S.look(dax, { x: a.x + Math.sin(t * 9.4) * 4, y: gold.y, z: a.z + Math.sin(t * 18.8) * 2.5 });
        S.look(gold, { x: b.x + Math.sin(t * 5) * 4, y: dax.y, z: b.z + Math.sin(t * 10) * 2.5 });
        var tap = (t > 0.9 && t < 1.2) || (t > 2.0 && t < 2.3);
        S.rig(dax, { jaw: 0.5, pawAt: tap ? [dax.mx + 3, 7] : null });
        if (t - hopAt > 0.6 && dax.z === 0) { hopAt = t; S.hop(dax, 40); }
      });
      // 4-5 秒：叼住一口耳朵毛往后拽；金毛的头被拽过去一点，眯着眼乐
      S.look(dax, null); S.look(gold, null);
      S.hold(dax, 'tug'); S.rig(dax, { jaw: 0.6 }); S.rig(gold, { eyes: 'happy', jaw: 0.3 }); grr(S, dax);
      yield S.slide(dax, -dax.face * 3, 0, 0.8);
      // 5-6.5 秒：金毛干脆翻过来肚皮朝天；小腊肠立起来两只前爪按在它胸口，尾巴竖得笔直，叫一声：我赢了
      S.rig(gold, null); S.hold(gold, 'roll'); gold.happy = 1; gold.wag = 0.8;
      S.rig(dax, null); S.hold(dax, 'rear'); S.rig(dax, { pawAt: [dax.mx * 0.7, 9], tailSet: 75 }); S.mood(dax, 'proud');
      yield 0.4;
      woof(S, dax);
      yield 1.1;
      // 6.5-8 秒：一只大爪子轻轻一拨：小腊肠也翻过去，并排在地上扭
      S.rig(gold, { pawAt: [12, 8] });
      yield 0.35;
      S.rig(dax, null); S.mood(dax, null); S.hold(dax, 'roll'); dax.happy = 1;
      yield S.slide(dax, -dax.face * 5, 0, 0.3);
      S.rig(gold, null);
      yield 1.1;
      // 8-9 秒：都翻起来趴着，喘
      S.hold(gold, 'lie'); S.hold(dax, 'lie'); dax.pant = true; gold.pant = true; dax.happy = 0; gold.happy = 0;
      yield 1.0;
      // 三成：鼻子对鼻子愣 0.4 秒，然后接着你追我赶
      if (gold.energy >= 0.45 && S.chance(0.3)) {
        S.hold(gold, 'stand'); S.hold(dax, 'stand'); S.look(dax, gold); S.look(gold, dax);
        yield 0.4;
        yield* S.run('chase');
      }
    },
  });

  // ============================================================
  //  A06 拔河，大狗故意放水（要有绳子：岛里掉出来的，或者地上剩下的；都没有就在场地边上找到一根）
  // ============================================================
  add({ name: 'tug_let_win', zh: '拔河，大狗故意放水', cast: 'dax gold', weight: function (S) { return S.prop.find('rope') ? 4 : 2; },
    cool: 720, mood: 'proud', tag: 'calm', family: 'tug', timeout: 24,
    when: function (S) { var r = S.prop.find('rope'); return awake2(S) && (!r || !r.holder); },
    run: function* (S) {
      var dax = S.dax, gold = S.gold, rope = toy(S, 'rope', dax), i, sc;
      yield S.stage(gold);
      // 先叼上绳子
      var w = S.prop.where(rope);
      yield S.go(dax, S.beside(dax, w, 5), 'run', null, 5);
      S.faceTo(dax, rope); S.hold(dax, 'sniff');
      yield 0.3;
      carryToy(S, rope, dax); dax.wag = 1;
      // 0-1 秒：叼着绳子跑到金毛跟前，拿绳子甩它的前腿，伏下来：来呀
      var s = dax.x < gold.x ? -1 : 1;
      if (!room(S, gold.x, s, 60)) s = -s;
      S.faceTo(gold, { x: gold.x + s });
      yield S.go(dax, at(S, gold.x + s * (gold.mx + dax.mx + 6), gold.y + S.ry(1), dax), 'run', null, 5);
      S.faceTo(dax, gold); rope.face = dax.face; S.hold(dax, 'stand'); S.rig(dax, { shake: 1 });
      yield 0.5;
      S.rig(dax, null); S.hold(dax, 'bow');
      yield 0.5;
      // 1-2 秒：金毛趴下，轻轻叼住另一头：绳子在两张嘴中间拉直
      S.hold(gold, 'lie'); S.rig(gold, { jaw: 0.4 }); S.faceTo(gold, dax);
      yield 0.6;
      S.hold(dax, 'tug'); dax.wag = 0.9;
      yield S.slide(dax, s * 4, 0, 0.3);
      dropToy(S, rope);
      sc = S.each(function () {          // 每一步：绳子挂在两张嘴中间
        if (!S.prop.alive(rope) || rope.holder) return;
        var a = mouth(S, gold), b = mouth(S, dax);
        S.prop.move(rope, (a.x + b.x) / 2, (gold.y + dax.y) / 2, Math.max(1, (a.z + b.z) / 2 - 2));
      });
      // 2-5 秒：小腊肠使劲拽：身子压低、后脚刨地，0.4 秒猛地一拽，一秒低吼一下；金毛的头只让一点点
      for (i = 0; i < 7; i++) {
        S.slide(dax, s * 1.2, 0, 0.12);
        S.bits(dax.x - dax.face * dax.half * 0.7, dax.y, 1, 'dirt', 14, 24);
        gold.look = -0.15;
        if (i % 2 === 0) grr(S, dax);
        yield 0.2;
        S.slide(dax, -s * 0.6, 0, 0.15);
        gold.look = 0;
        gold.wag = 0.7;
        yield 0.2;
      }
      // 5-6 秒：金毛慢慢一拉：小腊肠撑着腿被拖过去 8
      yield S.slide(dax, -s * 8, 0, 0.9);
      // 6-7 秒：金毛故意松口：小腊肠往后一个跟头，抱着绳子坐起来
      S.rig(gold, null);
      carryToy(S, rope, dax);
      S.hold(dax, 'roll'); S.hop(dax, 60);
      yield S.slide(dax, s * 10, 0, 0.5);
      S.hold(dax, 'sit'); S.emote('bang', dax, 0, 0.7);
      yield 0.5;
      // 7-10 秒：得意地绕金毛小跑一圈，头抬得高高的，再狠狠甩两下；把绳子放在金毛跟前，伏下：再来一局？
      S.hold(dax, 'stand'); S.mood(dax, 'proud'); dax.look = 0.4; dax.wag = 1;
      var T = ring(S, dax, { x: gold.x, y: gold.y }, 48, S.ry(16), 1, 'trot', s);
      yield S.each(T, function () { rope.face = dax.face; });
      S.stop(dax); S.rig(dax, { shake: 1 });
      yield 0.5;
      S.rig(dax, null);
      yield S.go(dax, at(S, gold.x + gold.face * (gold.mx + dax.mx + 8), gold.y + S.ry(1), dax), 'trot', null, 4);
      S.faceTo(dax, gold); rope.face = dax.face;
      dropToy(S, rope, mouth(S, dax).x, dax.y + S.ry(1));
      S.hold(dax, 'bow'); S.mood(dax, null); dax.look = 0;
      yield S.act(gold, 'yawn', 1.8);
      yield 0.4;
    },
    end: function (S) { endToy(S); },
  });

  // ============================================================
  //  A07 叼着球游行，你追我呀（丢球中途换不进来：引擎还没有"游行"这一段。现在：小人把球抛给金毛，金毛不还）
  // ============================================================
  add({ name: 'keep_away_parade', zh: '叼着球游行，你追我呀', cast: 'man dax gold', cat: 'A', weight: 1.5, cool: 600, mood: 'mischievous', timeout: 32,
    when: function (S) { return awake2(S) && S.ball.inHand() && S.gold.energy >= 0.4; },
    run: function* (S) {
      var man = S.man, dax = S.dax, gold = S.gold, i;
      // 小人把球轻轻抛给金毛
      var s = gold.x < man.x ? -1 : 1;
      if (!room(S, man.x, s, 90)) s = -s;
      yield S.all(S.go(gold, at(S, man.x + s * 40, man.y + S.ry(-2), gold), 'trot', null, 5), S.go(dax, at(S, man.x + s * 22, man.y + S.ry(6), dax), 'trot', null, 5));
      S.faceTo(gold, man); S.faceTo(dax, man); S.faceTo(man, gold);
      S.hold(gold, 'sit'); S.hold(dax, 'sit'); gold.wag = 0.8; dax.wag = 1;
      S.hold(man, 'p_windup'); S.face(man, 'smile');
      yield 0.5;
      S.hold(man, 'p_release');
      S.hold(gold, 'stand');
      yield S.ball.toss(gold, 0.55, 16);
      S.hold(man, null);
      // 0-1 秒：金毛停在离他 40 的地方，球叼得高高的，尾巴翘着，回头看小腊肠
      S.mood(gold, 'proud'); gold.look = 0.4; S.rig(gold, { tailSet: 25 }); gold.wag = 0.9;
      S.look(man, gold);
      yield S.go(gold, at(S, man.x + s * 70, man.y + S.ry(-4), gold), 'walk', null, 3);
      S.rig(gold, { tailSet: 25, lookBack: true }); S.look(gold, dax);
      yield 0.6;
      // 1-2 秒：小腊肠伏下叫一声；金毛叼着球也伏下回应
      S.hold(dax, 'bow'); S.faceTo(dax, gold); woof(S, dax);
      S.rig(gold, { tailSet: 25 }); S.faceTo(gold, dax); S.hold(gold, 'bow');
      yield 0.9;
      // 2-5 秒：金毛慢慢跑一个"8"字（够小腊肠追上的速度），小腊肠在后面紧追，快追上就拐弯
      S.hold(gold, 'stand'); S.hold(dax, 'stand');
      var c0 = { x: cx(S, gold.x + s * 30, gold), y: gold.y };
      var t0 = S.now(), per = 3.0;
      S.track(gold, function () {
        var k = (S.now() - t0) / per * 2 * Math.PI;
        return { x: c0.x + Math.sin(k) * 40, y: cy(S, c0.y + S.ry(Math.sin(2 * k) * 14)) };
      }, S.spd(gold, 'trot') * 1.1);
      S.follow(dax, gold, gold.half + 10, S.ry(2), 'run');
      yield 3.0;
      // 5-7 秒：停下来，把球放低到小腊肠的高度；小腊肠一扑，球又抬起来了。两次
      S.stop(gold); S.stop(dax);
      S.faceTo(dax, gold); S.faceTo(gold, dax);
      yield S.go(dax, at(S, gold.x + gold.face * (gold.mx + dax.mx + 4), gold.y + S.ry(1), dax), 'trot', null, 2);
      S.faceTo(dax, gold);
      for (i = 0; i < 2; i++) {
        gold.look = -0.5;
        yield 0.5;
        S.hop(dax, 80); gold.look = 0.6;
        yield 0.5;
      }
      // 7-8.5 秒：金毛趴下，球护在两只前爪中间，下巴压在上面；小腊肠左边试一下、右边试一下
      gold.look = 0; S.hold(gold, 'lie'); S.rig(gold, { chin: true, tailSet: 10 }); S.mood(gold, 'happy');
      for (i = 0; i < 2; i++) {
        yield S.go(dax, at(S, gold.x + gold.face * (gold.mx + 8) + (i ? 6 : -6), gold.y + S.ry(i ? 6 : -6), dax), 'run', null, 1.2);
        S.faceTo(dax, gold);
        S.look(gold, dax);
        yield 0.25;
      }
      // 8.5-10.5 秒：小腊肠趴在 14 外，扭头看别处，舔舔嘴：装作不在乎。金毛抬起下巴歪头看它——小腊肠一个冲刺抢走了球
      yield S.go(dax, at(S, gold.x + gold.face * (gold.mx + dax.mx + 14), gold.y + S.ry(2), dax), 'walk', null, 2);
      S.faceTo(dax, gold); dax.face = -dax.face; S.hold(dax, 'lie'); dax.look = 0.4;
      yield 0.6;
      S.act(dax, 'lickchops', 0.8);
      yield 0.8;
      S.rig(gold, { tilt: 1 }); S.look(gold, dax);
      yield 0.5;
      S.faceTo(dax, gold); S.hold(dax, 'stand');
      yield S.go(dax, at(S, gold.x + gold.face * (gold.mx + dax.mx - 2), gold.y + S.ry(1), dax), 'run', null, 0.6);
      S.ball.give(dax); S.emote('spark', dax, dax.face * 8, 0.5);
      S.rig(gold, null); S.mood(gold, null);
      // 10.5-12 秒：小腊肠叼着大大的球，尾巴竖着，昂首挺胸走回小人那儿；金毛拍拍尾巴，无所谓
      S.mood(dax, 'proud'); dax.look = 0.4; dax.wag = 1;
      gold.wag = 0.7;
      yield S.go(dax, S.atHand(dax), 'trot', null, 4);
      S.faceTo(dax, man); S.faceTo(man, dax);
      S.hold(dax, 'sit');
      S.hold(man, 'p_pat'); S.face(man, 'laugh');
      S.ball.take();
      S.emote('heart', dax, 0, 1.0); dax.happy = 1;
      yield 1.2;
      S.hold(man, null); dax.happy = 0;
    },
  });

  // ============================================================
  //  A08 一根树枝两只抬
  // ============================================================
  add({ name: 'two_on_a_stick', zh: '一根树枝两只抬', cast: 'dax gold', weight: 2, cool: 1200, cap: 3, mood: 'funny', tag: 'calm', hours: [7, 20], timeout: 30,
    when: function (S) { var p = S.prop.find('stick'); return awake2(S) && (!p || !p.holder); },
    run: function* (S) {
      var dax = S.dax, gold = S.gold, stick = toy(S, 'stick', dax), man = S.man;
      yield S.stage(gold);
      // 0-2 秒：小腊肠一路闻过去，叼住树枝的一头往后拖，尾巴转得飞快——几乎拖不动
      var w = S.prop.where(stick);
      yield S.go(dax, S.beside(dax, w, 11), 'sniff', 'sniff', 6);
      S.faceTo(dax, stick); S.hold(dax, 'sniff'); sniffs(S, dax);
      yield 0.4;
      carryToy(S, stick, dax); stick.face = 1;
      S.hold(dax, 'tug'); dax.wag = 1;
      var back = -dax.face;
      yield S.slide(dax, back * 5, 0, 1.0);
      // 2-3.5 秒：金毛走过来，低头闻一闻，叼住另一头：树枝横在两张嘴中间
      S.faceTo(gold, dax);
      yield S.go(gold, at(S, dax.x - dax.face * 4, cy(S, dax.y + S.ry(-8)), gold), 'walk', null, 5);
      S.faceTo(gold, { x: gold.x + dax.face }); dax.face = gold.face;
      S.hold(gold, 'sniff'); sniffs(S, gold);
      yield 0.6;
      S.hold(gold, 'stand'); gold.look = -0.6; S.rig(gold, { jaw: 0.4 });       // 大狗把自己那头放低到小狗的高度
      S.hold(dax, 'stand');
      // 小腊肠站到金毛前面一点、靠近观众这一侧：两张嘴差不多一样高
      yield S.go(dax, at(S, gold.x + gold.face * 22, cy(S, gold.y + S.ry(8)), dax), 6, null, 2);
      dax.face = gold.face;
      dropToy(S, stick);
      var hook = function () {
        if (!S.prop.alive(stick) || stick.holder) return;
        var a = mouth(S, gold), b = mouth(S, dax);
        S.prop.move(stick, (a.x + b.x) / 2, (gold.y + dax.y) / 2 + 0.02, Math.max(1, (a.z + b.z) / 2 - 1));
      };
      S.each(hook);
      // 3.5-4 秒：都愣住，互相看一眼；尾巴开始摇
      S.look(gold, dax); S.look(dax, gold);
      yield 0.5;
      gold.wag = 0.8; dax.wag = 1;
      // 4-9 秒：一起抬着走 100：金毛慢慢走，小腊肠腿都快抡成一团了
      var dir = gold.face, dist = room(S, gold.x, dir, 130) ? 100 : -100;
      if (dist < 0) { dir = -dir; gold.face = dir; dax.face = dir; yield S.go(dax, at(S, gold.x + dir * 22, dax.y, dax), 8, null, 3); }
      S.look(gold, null); S.look(dax, null);
      var gx = cx(S, gold.x + dir * 100, gold);
      S.go(gold, gx, gold.y, 20, null, 7);
      S.follow(dax, gold, -22, S.ry(8), 26);
      yield 2.5;
      // 9-10.5 秒：小腊肠停下来闻东西，被拖着走了 5，松了口；金毛回头等它，把那头放得更低，它又叼上
      S.stop(gold); S.stop(dax); S.hold(dax, 'sniff');
      yield S.slide(dax, dir * 5, 0, 0.5);
      S.rig(gold, { jaw: 0.4, lookBack: true }); gold.look = -0.8;
      yield 0.8;
      S.hold(dax, 'stand');
      yield 0.3;
      S.rig(gold, { jaw: 0.4 }); gold.look = -0.6;
      S.go(gold, cx(S, gold.x + dir * 40, gold), gold.y, 20, null, 3);
      S.follow(dax, gold, -22, S.ry(8), 26);
      yield 2.0;
      S.stop(gold); S.stop(dax);
      // 10.5-12 秒：他就在附近：一起放到他脚边；不然就各趴一头啃
      if (S.free(man) && S.dist(man, gold) < 120 && S.join(man)) {
        S.faceTo(man, gold);
        S.hold(man, 'p_pat'); S.face(man, 'smile');
        dropToy(S, stick);
        S.hold(gold, 'sit'); S.hold(dax, 'sit'); gold.look = 0.3;
        S.emote('hs', gold, 0, 1.0);
        yield 1.4;
        S.hold(man, null);
      } else {
        dropToy(S, stick);
        S.hold(gold, 'lie'); S.hold(dax, 'lie'); S.rig(gold, { chew: true }); S.rig(dax, { chew: true }); gold.look = -0.3;
        yield 3.0;
      }
      if (S.prop.alive(stick)) S.prop.set(stick, 'chewed');
    },
    end: function (S) { endToy(S); },
  });

  // ============================================================
  //  A09 趁大狗打盹偷玩具
  // ============================================================
  add({ name: 'stealth_heist', zh: '趁大狗打盹偷玩具', cast: 'dax gold', weight: 2, cool: 900, mood: 'mischievous', tag: 'calm', family: 'nose', timeout: 28,
    when: function (S) { return awake2(S) && S.dist(S.dax, S.gold) > 40; },
    run: function* (S) {
      var dax = S.dax, gold = S.gold, i;
      yield S.stage(gold);
      // 金毛趴着打盹，下巴压在玩具上
      var p = S.prop.find('rope') || S.prop.find('stick');
      if (p && p.holder) p = null;
      if (p && S.dist(gold, S.prop.where(p)) > 120) p = null;
      if (p) {
        yield S.go(gold, S.beside(gold, S.prop.where(p), 2), 'walk', null, 5);
        S.faceTo(gold, p);
      } else {
        p = S.prop.spawn('rope', '', gold.x + gold.face * (gold.mx - 4), gold.y + S.ry(0.5), { keep: true, cap: 300, data: { toy: true } });
      }
      touchToy(S, p);
      S.hold(gold, 'lie'); S.rig(gold, { chin: true, eyes: 'closed' }); gold.wag = 0.1;
      // 小腊肠在 60 外
      var s = dax.x < gold.x ? -1 : 1;
      if (!room(S, gold.x, s, 70)) s = -s;
      if (Math.abs(dax.x - gold.x) < 50) yield S.go(dax, at(S, gold.x + s * 66, gold.y + S.ry(4), dax), 'trot', null, 4);
      // 0-1 秒：发现了宝贝：竖起来、歪头
      S.faceTo(dax, gold); S.hold(dax, 'alert'); S.rig(dax, { tilt: 1 }); S.look(dax, p); S.mood(dax, 'curious');
      yield 0.9;
      // 1-5 秒：一步一停地挪过去（伏着身子），金毛耳朵一动就举着一只爪子定住
      S.rig(dax, null); S.mood(dax, 'focused');
      var goal = gold.x + gold.face * (gold.mx + dax.mx + 2);
      if ((goal - gold.x) * s < 0) goal = gold.x + s * (gold.mx + dax.mx + 2);
      for (i = 0; i < 3; i++) {
        var nx = dax.x + (goal - dax.x) * (i < 2 ? 0.4 : 1);
        yield S.go(dax, nx, gold.y + S.ry(1), 10, 'stalk', 2);
        S.stop(dax); S.hold(dax, 'alert');
        S.rig(gold, { chin: true, eyes: 'closed', earFlick: true });
        S.rig(dax, { pawUp: true });
        yield 0.5;
        S.rig(gold, { chin: true, eyes: 'closed' }); S.rig(dax, null);
      }
      S.faceTo(dax, p);
      // 5-6.5 秒：咬住玩具一头，小口小口往外拽三下；金毛叹口气，赶紧趴平
      for (i = 0; i < 3; i++) {
        S.hold(dax, 'tug');
        S.prop.move(p, p.x - dax.face * 2, p.y, 0);
        yield 0.22;
        S.hold(dax, 'stalk');
        yield 0.18;
        if (i === 1) { sigh(S, gold); S.hold(dax, 'lie'); S.rig(dax, { chin: true }); yield 0.6; S.rig(dax, null); }
      }
      // 6.5-7.5 秒：叼上就往后退，转身，尾巴竖得笔直，迈着高步走掉
      carryToy(S, p, dax);
      S.hold(dax, 'stand');
      yield S.slide(dax, -dax.face * 15, 0, 0.7);
      dax.face = -dax.face; p.face = dax.face;
      S.rig(dax, { tailSet: 75 }); S.mood(dax, 'proud');
      var off = at(S, dax.x + dax.face * 80, dax.y + S.ry(S.rand(-10, 10)), dax);
      var c = S.go(dax, off, 34, null, 4);
      // 7.5-9 秒：金毛睁开一只眼看着它，拍两下尾巴，又闭上。它都知道
      yield 0.4;
      S.rig(gold, { chin: true, eyes: 'slit' }); S.look(gold, dax);
      yield 0.5;
      gold.wag = 0.7;
      yield 0.6;
      gold.wag = 0.1; S.rig(gold, { chin: true, eyes: 'closed' });
      yield c;
      // 9-12 秒：趴在 80 外啃，回头看两次
      p.face = dax.face; dropToy(S, p, mouth(S, dax).x, dax.y + S.ry(1));
      S.hold(dax, 'lie'); S.rig(dax, { chew: true }); S.mood(dax, null);
      for (i = 0; i < 2; i++) {
        yield 1.0;
        S.rig(dax, { chew: true, lookBack: true });
        yield 0.5;
        S.rig(dax, { chew: true });
      }
      yield 0.5;
    },
    end: function (S) { endToy(S); },
  });

  // ============================================================
  //  A10 学大狗的跟屁虫
  // ============================================================
  add({ name: 'copycat_convoy', zh: '学大狗的跟屁虫', cast: 'dax gold', weight: 2, cool: 600, mood: 'funny', tag: 'calm', timeout: 20,
    when: function (S) { return awake2(S); },
    run: function* (S) {
      var dax = S.dax, gold = S.gold, F = S.field;
      yield S.stage(gold);
      var dir = (gold.x - F.x0) > (F.x1 - gold.x) ? -1 : 1;
      if (!room(S, gold.x, dir, 110)) return;
      // 0-1 秒：金毛慢慢出发巡视；小腊肠贴着它的尾巴跟上（鼻子离尾巴 4）
      gold.face = dir;
      var gap = gold.half + dax.mx + 4;
      var leg1 = S.go(gold, at(S, gold.x + dir * 45, gold.y + S.ry(S.rand(-8, 8)), gold), 'walk', null, 4);
      yield S.go(dax, at(S, gold.x - dir * gap, gold.y + S.ry(1), dax), 'trot', null, 3);
      S.follow(dax, gold, gap, S.ry(1), 'walk');
      yield leg1;
      // 1-5 秒：金毛停下闻一个地方；它一走，小腊肠闻同一个地方；金毛用后腿蹬两下草，小腊肠也蹬，小小的
      S.hold(gold, 'sniff'); var spot = mouth(S, gold);
      yield 0.8;
      S.hold(gold, 'stand');
      var leg2 = S.go(gold, at(S, gold.x + dir * 30, gold.y, gold), 'walk', null, 3);
      yield S.go(dax, at(S, spot.x - dir * dax.mx, gold.y + S.ry(1), dax), 'walk', null, 3);
      S.hold(dax, 'sniff'); sniffs(S, dax);
      yield leg2;
      S.act(gold, 'kick', 1.2); S.bits(gold.x - dir * gold.half, gold.y, 3, S.grass(), 18, 30);
      yield 0.6;
      S.hold(dax, 'stand');
      yield S.go(dax, at(S, gold.x - dir * gap, gold.y + S.ry(1), dax), 'walk', null, 2);
      S.act(dax, 'kick', 1.0); S.bits(dax.x - dir * dax.half, dax.y, 2, S.grass(), 10, 20);
      yield 0.9;
      // 5-6 秒：金毛走两步突然站住；小腊肠低着头直接撞上它的后腿，一屁股坐下
      S.follow(dax, gold, gap, S.ry(1), 'walk'); dax.look = -0.6;
      yield S.go(gold, at(S, gold.x + dir * 24, gold.y, gold), 'walk', null, 2);
      S.stop(gold);
      S.stop(dax);
      yield S.go(dax, gold.x - dir * (gold.half + dax.mx - 5), dax.y, 'walk', null, 1.5); S.puff(dax.x + dir * dax.mx, dax.y, false); S.emote('spark', dax, dir * 8, 0.5);
      S.hold(dax, 'sit'); dax.look = 0;
      yield 0.6;
      // 6-7 秒：金毛回头看它；小腊肠望天，舔舔嘴：刚才什么都没发生
      S.rig(gold, { lookBack: true }); S.look(gold, dax);
      dax.look = 0.4; S.look(dax, { x: dax.x - dir * 40, y: dax.y, z: 30 });
      S.act(dax, 'lickchops', 0.6);
      yield 1.0;
      // 7-8 秒：接着巡视；小腊肠隔着 10 规规矩矩地跟 3 秒
      S.rig(gold, null); S.look(gold, null); S.look(dax, null); dax.look = 0;
      S.hold(dax, 'stand');
      if (room(S, gold.x, dir, 70)) S.go(gold, at(S, gold.x + dir * 60, gold.y, gold), 'walk', null, 4);
      S.follow(dax, gold, gold.half + dax.half + 10, S.ry(1), 'walk');
      yield 3.0;
    },
  });

  // ============================================================
  //  A11 抢暖窝（小偷版 / 老大版），最后一起睡一会儿
  // ============================================================
  add({ name: 'warm_spot', zh: '抢暖窝', cast: 'dax gold', weight: 2, cool: 900, mood: 'sleepy', tag: 'calm', family: 'sleep', timeout: 150,
    when: function (S) { return awake2(S) && !S.night(); },
    run: function* (S) {
      var dax = S.dax, gold = S.gold, boss = S.chance(0.4), spot;
      yield S.stage(gold);
      if (!room(S, gold.x, 1, 50) || !room(S, gold.x, -1, 50)) return;
      if (!boss) {
        // 小偷版。金毛趴着；小腊肠在旁边好像睡着了
        S.hold(gold, 'lie'); S.rig(gold, { chin: true });
        var s = dax.x < gold.x ? -1 : 1;
        yield S.go(dax, at(S, gold.x + s * 52, gold.y + S.ry(6), dax), 'walk', null, 5);
        S.faceTo(dax, gold); S.hold(dax, 'sleep');
        yield 2.0;
        // 0-1 秒：金毛起来伸个懒腰，走开 30 去闻东西
        spot = { x: gold.x, y: gold.y, face: gold.face };
        S.rig(gold, null); S.hold(gold, 'stand');
        yield S.act(gold, 'stretch', 2.6);
        yield S.go(gold, at(S, gold.x - s * 34, gold.y + S.ry(-3), gold), 'walk', null, 3);
        S.hold(gold, 'sniff');
        // 1-2.5 秒：小腊肠睁开一只眼，一溜烟钻到那个位置上，转一圈，蜷起来，闭眼
        S.rig(dax, { eyes: 'slit' });
        yield 0.5;
        S.rig(dax, null); S.hold(dax, 'stand');
        yield S.go(dax, spot.x, spot.y, 'run', null, 2);
        yield S.act(dax, 'nest_circle');
        S.hold(dax, 'sleep');
        yield 0.5;
        // 2.5-4.5 秒：金毛回来，停在 12 外：看看自己的窝，看看它，再面无表情地看着屏幕外
        S.hold(gold, 'stand');
        yield S.go(gold, at(S, spot.x - s * (gold.half + dax.half + 6), spot.y, gold), 'walk', null, 4);
        S.faceTo(gold, dax); S.look(gold, { x: spot.x, y: spot.y, z: 0 });
        yield 0.6;
        S.look(gold, dax);
        yield 0.6;
        S.look(gold, 'camera');
        yield 0.7;
        S.look(gold, dax);
      } else {
        // 老大版：金毛占着窝；小腊肠走过来，挺胸站好瞪着它
        S.hold(gold, 'lie'); S.rig(gold, { chin: true });
        spot = { x: gold.x, y: gold.y, face: gold.face };
        var sb = dax.x < gold.x ? -1 : 1;
        yield S.go(dax, at(S, gold.x + sb * (gold.half + 22), gold.y + S.ry(2), dax), 'trot', null, 5);
        S.faceTo(dax, gold); S.hold(dax, 'alert'); S.mood(dax, 'focused'); S.look(dax, gold); S.look(gold, dax);
        yield 1.5;
        // 叫一声，哼一下；金毛把头扭开，打个哈欠
        woof(S, dax); sigh(S, dax, true);
        yield 0.4;
        S.look(gold, { x: gold.x - sb * 40, y: gold.y, z: 10 });
        yield S.act(gold, 'yawn', 1.8);
        // 用鼻子拱金毛的屁股两下：金毛叹口气，屁股先起来，往旁边挪两步，"咚"地趴下
        yield S.go(dax, at(S, gold.x - gold.face * (gold.half * 0.6) + sb * dax.mx * 0.4, gold.y + S.ry(2), dax), 'walk', null, 2);
        S.faceTo(dax, gold);
        yield S.act(dax, 'nudge', 0.6);
        yield S.act(dax, 'nudge', 0.6);
        sigh(S, gold); S.rig(gold, null); S.hold(gold, 'stand');
        yield 0.5;
        yield S.go(gold, at(S, gold.x - sb * 14, gold.y + S.ry(-2), gold), 'walk', null, 2);
        S.hold(gold, 'lie');
        yield 0.5;
        // 走进暖窝，刨三下，转两圈，蜷起来
        S.mood(dax, null); S.look(dax, null); S.look(gold, null);
        yield S.go(dax, spot.x, spot.y, 'walk', null, 2);
        S.hold(dax, 'dig');
        yield 0.5;
        yield S.act(dax, 'nest_circle');
        S.hold(dax, 'sleep');
      }
      // 4.5-6 秒：金毛拱两下它的屁股：它睡得更死了，偷偷睁一只眼
      S.hold(gold, 'stand');
      yield S.go(gold, at(S, dax.x - dax.face * (dax.half * 0.4) + (gold.x < dax.x ? -1 : 1) * gold.mx * 0.9, dax.y + S.ry(-2), gold), 'walk', null, 3);
      S.faceTo(gold, dax);
      yield S.act(gold, 'nudge', 0.7);
      yield S.act(gold, 'nudge', 0.7);
      S.rig(dax, { eyes: 'slit' });
      yield 0.6;
      S.rig(dax, null);
      // 6-8 秒：金毛叹口气，绕着它趴下，下巴搁在它背上；下巴底下小尾巴摇了两下
      sigh(S, gold);
      yield S.go(gold, at(S, dax.x - dax.face * 10, cy(S, dax.y + S.ry(-2)), gold), 'walk', null, 2);
      gold.face = dax.face; S.hold(gold, 'lie'); S.rig(gold, { chin: true });
      yield 0.8;
      dax.wag = 0.7;
      yield 0.6;
      dax.wag = 0.1; sigh(S, dax, true);
      // 一起睡一会儿（1 分钟左右）
      S.rig(gold, { chin: true, eyes: 'closed' });
      yield S.rand(1.0, 2.0);
      S.hold(gold, 'sleep'); S.rig(gold, null);
      yield S.rand(35, 75);
      // 醒了：伸懒腰、甩甩毛
      S.hold(dax, 'stand');
      yield S.act(dax, ['wake_stretch', 'stretch'], 3);
      S.hold(gold, 'stand');
      yield S.act(gold, ['shake_off', 'shakeoff'], 2.2);
    },
  });

  // ============================================================
  //  A12 钻到大狗怀里取暖（晚上、冷的月份、刚被吓过的时候多一点）
  // ============================================================
  function coldish(S) {
    var t = S.time, mo = +String(t.md || '01-01').slice(0, 2), south = S.cfg.hemisphere === 'south';
    var cold = south ? (mo >= 5 && mo <= 8) : (mo >= 11 || mo <= 2);
    return t.h >= 18 || cold || S.last('flyby_startle') < 20;
  }
  add({ name: 'under_the_wing', zh: '钻到大狗怀里取暖', cast: 'dax gold', weight: function (S) { return coldish(S) ? 3 : 1; }, cool: 900, mood: 'sleepy', tag: 'calm', family: 'sleep', timeout: 70,
    when: function (S) { return awake2(S); },
    run: function* (S) {
      var dax = S.dax, gold = S.gold;
      yield S.stage(gold);
      var f = gold.face;
      if (!room(S, gold.x, f, gold.mx + 30)) { f = -f; gold.face = f; }
      S.hold(gold, 'lie'); gold.wag = 0.3;
      // 0-1 秒：小腊肠打个哆嗦，看着金毛
      yield S.go(dax, at(S, gold.x + f * (gold.mx + dax.mx + 6), gold.y + S.ry(2), dax), 'walk', null, 5);
      S.faceTo(dax, gold); S.look(dax, gold);
      yield S.act(dax, 'shakeoff', 0.6);
      // 1-2.5 秒：走到金毛胸前，用鼻子往前腿底下拱三下；金毛抬起那条前腿
      yield S.go(dax, at(S, gold.x + f * (gold.half * 0.55 + dax.mx), gold.y + S.ry(1), dax), 'walk', null, 2);
      S.faceTo(dax, gold);
      S.act(dax, 'nudge', 0.5); yield 0.45;
      S.act(dax, 'nudge', 0.5); yield 0.45;
      S.rig(gold, { pawAt: [gold.half * 0.6, 6] });
      S.act(dax, 'nudge', 0.5); yield 0.45;
      // 2.5-4.5 秒：刨着钻进去：只剩屁股和摇着的尾巴露在金毛胳膊肘外面
      var back = S.anchor(gold, 'back'), topY = back.y - back.z + 1;
      var V = S.view, elbow = gold.x + f * gold.half * 0.45;
      // 只看得见胳膊肘外面、金毛背线以下的那一截（屁股和尾巴）
      S.clip(dax, f > 0 ? [elbow, topY, V.w, V.h] : [-10, topY, elbow + 10, V.h]);
      dax.face = -f;
      yield S.slide(dax, 0, S.ry(-3), 0.2);
      yield S.go(dax, at(S, elbow + f * (9 - dax.half), cy(S, gold.y + S.ry(-2)), dax), 12, 'dig', 1.2);
      dax.face = -f; S.hold(dax, 'dig'); dax.wag = 1;
      S.bits(dax.x, dax.y, 3, 'dirt', 12, 20);
      yield 1.4;
      // 4.5-6 秒：里面那一团转了个身（整个看不见 0.6 秒，金毛的前腿一颠一颠）；鼻子和头从金毛下巴底下钻出来
      S.clip(dax, [dax.x, dax.y, 0.01, 0.01]);
      S.rig(gold, { pawAt: [gold.half * 0.6, 8] });
      yield 0.3;
      S.rig(gold, { pawAt: [gold.half * 0.6, 5] });
      yield 0.3;
      dax.face = f; S.hold(dax, 'lie');
      var nx = gold.x + f * (gold.mx + 3);
      yield S.slide(dax, nx - f * dax.mx - dax.x, 0, 0.05);
      var chest = gold.x + f * (gold.half * 0.45);
      S.clip(dax, f > 0 ? [chest, -10, V.w, V.h + 20] : [-10, -10, chest + 10, V.h + 20]);
      dax.wag = 0.4;
      yield 1.0;
      // 6-8 秒：金毛把前腿放下来搭在它身上，像盖了条被子，下巴搁在上面；各眨一下慢眼，睡了
      S.rig(gold, { pawAt: [gold.half * 0.7, 3], chin: true });
      yield 0.8;
      S.rig(dax, { eyes: 'closed' });
      yield 0.5;
      S.rig(gold, { pawAt: [gold.half * 0.7, 3], chin: true, eyes: 'closed' });
      yield 0.6;
      S.emote('z', gold, gold.face * 8, 1.8);
      S.hold(gold, 'sleep'); S.rig(gold, { eyes: 'closed' });
      yield S.rand(22, 40);
      S.rig(dax, null); S.rig(gold, null); S.clip(dax, null);
      S.hold(dax, 'stand');
      yield S.slide(dax, f * 6, S.ry(3), 0.3);
      yield S.act(dax, 'shakeoff', 1.2);
    },
  });

  // ============================================================
  //  A13 小狗给大狗舔耳朵
  // ============================================================
  add({ name: 'ear_cleaning', zh: '小狗给大狗舔耳朵', cast: 'dax gold', weight: function (S) { return S.time.h >= 19 || S.quietFor() > 30 ? 3 : 2; },
    cool: 720, mood: 'tender', tag: 'calm', timeout: 18,
    when: function (S) { return awake2(S); },
    run: function* (S) {
      var dax = S.dax, gold = S.gold;
      yield S.stage(gold);
      S.hold(gold, 'lie'); gold.wag = 0.3;
      var f = gold.face;
      if (!room(S, gold.x, f, gold.mx + 20)) { f = -f; gold.face = f; }
      // 0-1.5 秒：走到金毛头边，闻它的耳朵
      var head = gold.x + f * (gold.mx - 6);
      yield S.go(dax, at(S, head + f * (dax.mx - 2), gold.y + S.ry(2), dax), 'walk', null, 5);
      dax.face = -f; S.hold(dax, 'sniff'); S.look(dax, gold);
      sniffs(S, dax);
      yield 0.7;
      sniffs(S, dax);
      yield 0.6;
      // 1.5-2.5 秒：前爪踩上金毛的前腿，用鼻子把耳朵掀起来
      S.hold(dax, 'rear'); S.rig(dax, { pawAt: [dax.mx * 0.6, 5] });
      yield 0.5;
      S.act(dax, 'nudge', 0.5); S.rig(gold, { earFlick: true });
      yield 0.5;
      // 2.5-5 秒：认真舔耳朵里面；金毛眯着眼，头歪向它，一条后腿慢慢在空中蹬
      S.rig(gold, null); S.hold(dax, 'lick'); S.mood(dax, 'focused'); S.rig(dax, null);
      S.rig(gold, { eyes: 'happy', tilt: f > 0 ? 1 : -1 });
      yield 0.8;
      S.act(gold, 'kick', 1.0);
      yield 1.0;
      S.act(gold, 'kick', 1.0);
      yield 0.7;
      // 5-6 秒：金毛化了：下巴平贴在地上，冒一个小音符
      S.rig(gold, { eyes: 'happy', chin: true }); S.emote('note', gold, 0, 1.1);
      yield 1.0;
      // 6-7 秒：小腊肠打个喷嚏，最后再舔一下，靠着金毛的脖子趴下
      S.mood(dax, null);
      S.act(dax, 'sneeze', 0.6);
      yield 0.15;
      achoo(S, dax);
      yield 0.5;
      S.hold(dax, 'lick');
      yield 0.4;
      dax.face = -f; S.hold(dax, 'lie'); dax.wag = 0.4;
      yield 1.2;
    },
  });

  // ============================================================
  //  A14 小狗做梦在跑，大狗伸爪按住
  // ============================================================
  add({ name: 'dream_runner', zh: '小狗做梦在跑，大狗伸爪按住', cast: 'dax gold', weight: function (S) { return S.quietFor() > 60 ? 3 : 1.5; },
    cool: 720, mood: 'tender', tag: 'calm', family: 'sleep', timeout: 70,
    when: function (S) { return awake2(S) && !S.night(); },
    run: function* (S) {
      var dax = S.dax, gold = S.gold, k = 0;
      yield S.stage(gold);
      // 小腊肠转圈刨窝，侧躺着睡；金毛趴在 30-50 外醒着
      yield S.act(dax, 'nest_circle');
      S.hold(dax, ['flop', 'sleep']); S.rig(dax, { eyes: 'closed' });
      var s = gold.x < dax.x ? -1 : 1;
      if (!room(S, dax.x, s, 50)) s = -s;
      yield S.go(gold, at(S, dax.x + s * (gold.half + dax.half + 14), dax.y + S.ry(-2), gold), 'walk', null, 5);
      S.faceTo(gold, dax); S.hold(gold, 'lie'); gold.wag = 0.2;
      yield S.rand(4, 8);
      // 0-2 秒：开始做梦：爪子划，尾巴尖一抖，腮帮鼓一下（闷闷的两声）；头上一个想法云：球
      S.rig(dax, { eyes: 'closed', dream: 0.6 });
      S.emote('thought_ball', dax, dax.face * 6, 3.6);
      yield S.each(2, function (t) { S.rig(dax, { eyes: 'closed', dream: 0.6 }); });
      // 2-3.5 秒：金毛抬起头，歪头看；梦里四条腿都在跑
      S.rig(gold, { tilt: 1 }); S.look(gold, dax);
      yield S.each(1.5, function () { S.rig(dax, { eyes: 'closed', dream: 1 }); });
      // 3.5-5 秒：金毛趴着往前蹭 8，闻闻它的耳朵
      S.rig(gold, null);
      yield S.slide(gold, -s * 8, 0, 1.0);
      sniffs(S, gold);
      yield S.each(0.5, function () { S.rig(dax, { eyes: 'closed', dream: 1 }); });
      // 5-6.5 秒：一只大前爪轻轻搭在它肩上：爪子慢下来，停了；叹一口气；想法云换成一颗小爱心
      S.rig(gold, { pawAt: [gold.mx * 0.8, 6] });
      yield S.each(1.5, function (t) { S.rig(dax, { eyes: 'closed', dream: Math.max(0, 1 - t / 1.2) }); });
      sigh(S, dax, true);
      S.emote('thought_heart', dax, dax.face * 6, 1.6);
      // 6.5-8 秒：金毛把下巴放在旁边，一起冒一个 z
      S.rig(gold, { pawAt: [gold.mx * 0.8, 5], chin: true, eyes: 'closed' });
      yield 1.0;
      S.emote('z', gold, 0, 1.8);
      yield 0.6;
      // 一起再睡一会儿
      S.hold(gold, 'sleep'); S.rig(gold, null); S.hold(dax, 'sleep'); S.rig(dax, null);
      yield S.rand(14, 26);
      S.hold(dax, 'stand');
      yield S.act(dax, ['wake_stretch', 'stretch'], 3);
    },
  });

  // ============================================================
  //  A15 分开一会儿就要转圈重逢：她把一只拎到离另一只 150 以外放下；或者两只走散了很远
  // ============================================================
  function* reunion(S) {
    var dax = S.dax, gold = S.gold;
    // 0-1.5 秒：看见对方（竖起来），跑到中间碰头：金毛颠颠地小跑，小腊肠全速
    S.faceTo(dax, gold); S.faceTo(gold, dax);
    S.hold(dax, 'alert'); S.hold(gold, 'alert'); S.look(dax, gold); S.look(gold, dax); dax.wag = 1; gold.wag = 1;
    yield 0.5;
    var mx = (dax.x + gold.x) / 2, my = (dax.y + gold.y) / 2, s = dax.x < gold.x ? -1 : 1;
    S.hold(dax, 'stand'); S.hold(gold, 'stand');
    yield S.all(S.go(dax, at(S, mx + s * (dax.mx + 2), my + S.ry(2), dax), 'run', null, 4), S.go(gold, at(S, mx - s * (gold.mx + 2), my, gold), 'trot', null, 4));
    S.faceTo(dax, gold); S.faceTo(gold, dax);
    // 1.5-2.5 秒：小腊肠立起来舔金毛的下巴；金毛低下头给它舔
    S.hold(dax, 'rear'); S.rig(dax, { pawAt: [dax.mx * 0.7, 10] }); gold.look = -0.5;
    yield 0.4;
    S.hold(dax, ['rear', 'lick']);
    yield 0.6;
    S.rig(dax, null); S.hold(dax, 'stand'); gold.look = 0;
    // 2.5-4.5 秒：转圈打招呼：鼻子贴着对方的身子，互相闻着转一圈
    var c = { x: (dax.x + gold.x) / 2, y: (dax.y + gold.y) / 2 }, r = 15, t0 = S.now(), per = 2.0;
    var a0 = dax.x < c.x ? Math.PI : 0;
    S.track(dax, function () { var k = a0 + (S.now() - t0) / per * 2 * Math.PI; return { x: c.x + Math.cos(k) * r, y: c.y + Math.sin(k) * S.ry(6) }; }, 'trot', 'sniff');
    S.track(gold, function () { var k = a0 + Math.PI + (S.now() - t0) / per * 2 * Math.PI; return { x: c.x + Math.cos(k) * r, y: c.y + Math.sin(k) * S.ry(6) }; }, 'trot', 'sniff');
    yield 0.6; sniffs(S, dax);
    yield 0.6; sniffs(S, gold);
    yield 0.8;
    S.stop(dax); S.stop(gold); S.faceTo(dax, gold); S.faceTo(gold, dax);
    // 4.5-5.5 秒：金毛拱一下它的肋骨，它晃一步；甩甩毛
    S.act(gold, 'nudge', 0.6);
    yield 0.3;
    yield S.slide(dax, -dax.face * 3, 0, 0.2);
    yield S.act(dax, 'shakeoff', 1.0);
    // 5.5-7 秒：一起伏下身子，蹦跶一秒，然后肩并肩走开 40
    S.hold(dax, 'bow'); S.hold(gold, 'bow');
    yield 0.6;
    S.hold(dax, 'stand'); S.hold(gold, 'stand'); S.hop(dax, 90);
    var dir = room(S, gold.x, gold.face, 60) ? gold.face : -gold.face;
    yield S.all(S.go(gold, at(S, gold.x + dir * 40, gold.y, gold), 'walk', null, 3), S.go(dax, at(S, gold.x + dir * 40, cy(S, gold.y + S.ry(7)), dax), 'walk', null, 3));
  }
  add({ name: 'reunion_circle', zh: '分开一会儿就要转圈重逢', kind: 'react', on: 'drop', cast: 'dog other', cool: 300, mood: 'tender', timeout: 16, keep: 2,
    when: function (S, ev) {
      if (!ev || !ev.who || ev.who.isPerson) return false;
      var o = ev.who === S.dax ? S.gold : S.dax;
      return !o.hidden && !o.carried && S.dist(ev.who, o) >= 150 && !S.asleep(o);
    },
    run: function* (S) { yield 0.6; yield* reunion(S); },
  });
  add({ name: 'reunion_far', zh: '走散了很远：跑回来转圈重逢', cast: 'dax gold', weight: function (S) { return S.dist(S.dax, S.gold) > 260 ? 4 : 0; }, cool: 300, mood: 'tender', tag: 'lively', timeout: 16,
    when: function (S) { return awake2(S) && S.roam; },
    run: function* (S) { yield* reunion(S); },
  });

  // ============================================================
  //  A16 小狗吓到了，大狗过来看看（别的戏发 startled；她把小腊肠扔下来摔了一下也算）
  // ============================================================
  add({ name: 'check_in', zh: '小狗吓到了，大狗过来看看', kind: 'react', on: ['startled', 'drop'], cast: 'dax gold', cool: 180, chance: 0.6, keep: 4, mood: 'tender', timeout: 12,
    when: function (S, ev) { return !!ev && (ev.name === 'startled' ? ev.who === S.dax : (ev.who === S.dax && S.dist(S.dax, S.gold) < 220)) && !S.asleep(S.gold); },
    run: function* (S, ev) {
      var dax = S.dax, gold = S.gold;
      if (ev && ev.name === 'drop') yield 0.6;
      // 0-1.5 秒：小腊肠还在那儿嘟囔；金毛不紧不慢走过来
      S.hold(dax, 'alert'); S.mood(dax, 'worried'); S.faceTo(dax, gold);
      S.hold(gold, 'stand'); S.mood(gold, null);
      var s = gold.x < dax.x ? -1 : 1;
      yield S.go(gold, at(S, dax.x + s * 3, cy(S, dax.y + S.ry(-2)), gold), S.spd(gold, 'walk') * 1.3, null, 4);
      // 1.5-2.5 秒：站在它身边，肩膀罩着它，闻它的耳朵
      gold.face = dax.face; S.look(gold, dax); gold.look = -0.6;
      sniffs(S, gold);
      yield 0.9;
      // 2.5-3.2 秒：慢慢舔一下它的头顶
      S.hold(gold, 'lick');
      yield 0.7;
      // 3.2-4 秒：小腊肠靠在大胸脯上，闭一下眼
      S.hold(gold, 'stand'); gold.look = 0;
      S.hold(dax, 'lean'); S.rig(dax, { eyes: 'closed' }); S.mood(dax, 'happy');
      S.emote('heart', dax, 0, 1.0);
      yield 0.9;
      // 4-5 秒：甩甩毛，尾巴又翘起来，颠颠地跑开；金毛就在原地趴下
      S.rig(dax, null); S.mood(dax, null); S.hold(dax, 'stand');
      yield S.act(dax, 'shakeoff', 1.0);
      dax.wag = 0.9;
      S.hold(gold, 'lie');
      yield S.go(dax, at(S, dax.x + dax.face * 50, dax.y + S.ry(S.rand(-12, 12)), dax), 'trot', null, 2);
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
