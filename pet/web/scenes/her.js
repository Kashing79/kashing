// 球球 · 戏包：和她（R5 卡片 C01-C18）
//
// 她的鼠标就是她的手。这里每一段要么是她自己引起的（点一下、按住、来回蹭、拎起来放到谁身上、甩鼠标），
// 要么是对"她在这儿"的一个安安静静的回应。她在忙的时候不拉她：往鼠标那儿去的戏，她一甩开就停。
// 谁都不会停在她的鼠标底下（S.toCursor / S.below 会停在鼠标下面一点、旁边）。
// 说明书在 pet.js 开头"怎么写一场戏"。
(function (G) {
  'use strict';
  var L = G.PET_SCENES = G.PET_SCENES || [];
  function add(r) { r.pack = 'her'; L.push(r); }

  function cx(S, x, m) { var F = S.field; m = m === undefined ? 20 : m; return Math.max(F.x0 + m, Math.min(F.x1 - m, x)); }
  function cy(S, y) { var F = S.field; return Math.max(F.y0, Math.min(F.y1, y)); }
  function isDog(S, a) { return !!a && (a === S.dax || a === S.gold); }
  // 鼠标正下方 n 的地上，不在就用 fallback
  function under(S, n, fb) { return S.below(n) || fb; }
  // 两段戏之间传话用的小记事本（只放数字、布尔；不放角色）
  var note = { five: 0, fiveN: 0, gift: 0, bouquet: 0 };

  // ============================================================
  //  C01 来回蹭着摸：越蹭越舒服，挠到痒处后腿直蹬，最后翻肚皮
  // ============================================================
  add({ name: 'rub_to_pet', zh: '来回蹭着摸（挠到痒处后腿直蹬）', kind: 'react', on: ['rub', 'press'], cast: 'dog', tag: 'hers', mood: 'tender', family: 'pet', weight: 3, timeout: 30,
    when: function (S, ev) { return isDog(S, ev.who) && !S.asleep(ev.who); },
    run: function* (S, ev) {
      var d = S.dog, gold = d === S.gold, t0 = S.t(), quiet = 0, n = 0, phase = 0, told = false, kick = false;
      var press = ev && ev.name === 'press';
      // 1. 停下，头转向她的手，尾巴摇起来
      S.hold(d, 'stand'); S.faceTo(d, 'cursor'); S.look(d, 'cursor'); d.wag = 1; S.mood(d, 'happy');
      yield 0.4;
      var late = S.time.h >= 22 || S.time.h < 5;
      while (S.t() - t0 < 14) {
        var r = S.rubbing(d), going = r > 0 || (press && S.t() - t0 < 2.5);
        if (going) {
          quiet = 0;
          // 2. 一直蹭：眯眼、往她那边靠，一会儿冒一颗小心
          if (phase === 0) { S.rig(d, { eyes: 'happy' }); S.hold(d, ['lean', 'stand']); phase = 1; }
          if (S.t() - t0 > n * 0.8 + 0.6 && n < 12) { n++; if (n % 2) S.emote('hs', d, S.rand(-4, 4), 0.9); }
          // 3. 蹭到屁股那一段：一条后腿跟着她的节奏蹬
          var zone = S.cursor.known ? (S.cursor.x - d.x) * d.face / Math.max(1, d.half) : 0;
          if (zone < -0.3 && !kick) { kick = true; S.act(d, 'kick', 1.2); }
          else if (zone >= -0.3) kick = false;
          // 4. 蹭了 4 秒：慢慢化掉——坐、趴、翻过来露肚皮（夜里慢慢地蹭：趴着就睡着了）
          if (S.t() - t0 > 4 && phase === 1) { phase = 2; S.hold(d, 'sit'); }
          else if (S.t() - t0 > 5 && phase === 2) { phase = 3; S.hold(d, 'lie'); }
          else if (S.t() - t0 > 6 && phase === 3) {
            phase = 4;
            if (late && r < 2) { S.hold(d, 'sleep'); S.rig(d, { eyes: 'closed' }); S.emote('zs', d, 0, 1.4); }
            else { S.hold(d, 'roll'); d.happy = 1; }
          }
          if (phase === 4 && !late && S.chance(0.08)) S.act(d, 'kick', 0.6);
          // 另一只也想要（C12）
          if (!told && S.t() - t0 > 2.5) { told = true; S.raise('petting', { dog: d, who: d }); }
        } else {
          quiet += 0.2;
          // 5. 她停手了：还靠着，睁开眼，鼻子往上拱一下——还要
          if (quiet > 0.55 && quiet < 0.8) { S.rig(d, null); if (phase >= 4) S.rig(d, { pawAt: [d.face * 6, 10] }); else S.act(d, 'nudge', 0.5); }
          if (quiet > 2) break;
        }
        yield 0.2;
      }
      // 6. 不摸了：甩甩毛，回去过自己的日子
      S.rig(d, null); d.happy = 0;
      if (phase === 4 && late) { yield 0.5; return; }
      S.hold(d, 'stand');
      yield S.act(d, 'shakeoff', gold ? 1.8 : 1.2);
    },
  });

  // ============================================================
  //  C02 点点鼻子：小腊肠会点回来
  // ============================================================
  add({ name: 'nose_boop', zh: '点点鼻子', kind: 'react', on: 'click', cast: 'who', tag: 'hers', mood: 'funny', cool: 5, weight: 5,
    when: function (S, ev) { return isDog(S, ev.who) && ev.zone === 'nose'; },
    run: function* (S) {
      var d = S.who, dax = d === S.dax;
      // 睡着了：鼻子抽一抽，一只爪子挪过来盖住鼻子，接着睡
      if (S.asleep(d)) { S.rig(d, { scent: true }); yield 0.5; S.rig(d, { pawAt: [d.face * 8, 4], eyes: 'closed' }); yield 1.2; return; }
      // 1. 头往后一缩，闭眼，一个小小的"！"
      S.hold(d, 'stand'); S.rig(d, { eyes: 'closed' }); S.emote('bang', d, d.face * 6, 0.4);
      yield S.slide(d, -d.face * 2, 0, 0.15);
      // 2. 低头对着自己的鼻子看，然后打个喷嚏
      S.rig(d, null); d.look = -0.4;
      yield 0.3;
      S.emote('achoo', d, d.face * (d.mx + 2), 0.4);
      yield S.act(d, 'sneeze', 0.7);
      d.look = 0;
      // 3. 甩甩头，舔舔鼻子
      S.rig(d, { amount: 0.3 });
      yield S.act(d, 'shakeoff', dax ? 0.6 : 0.9);
      S.rig(d, null);
      yield S.act(d, 'lickchops', 0.5);
      // 4. 小腊肠点回去：一跳，鼻子停在她鼠标下面一点；金毛冲她舔一下，一颗心
      S.look(d, 'cursor'); S.faceTo(d, 'cursor');
      if (dax) { S.hop(d, 90); yield 0.25; var c = S.point('cursor'); if (c) S.emoteAt('spark', c.x, S.cursor.y + 3, 0.5); yield 0.4; }
      else { S.hold(d, 'lick'); yield 0.5; S.emote('heart', d, 0, 0.9); S.hold(d, 'stand'); yield 0.4; }
      d.wag = 1;
      yield 0.4;
    },
  });

  // ============================================================
  //  C03 击个掌：金毛坐着，她的鼠标在它胸口前停一会儿
  // ============================================================
  add({ name: 'high_five', zh: '击个掌', kind: 'react', on: 'notice', cast: 'gold', tag: 'hers', mood: 'proud', cool: 20, weight: 4,
    when: function (S, ev) {
      var g = S.gold, c = S.cursor;
      if (ev.who !== g || g.pose !== 'sit' || !c.known) return false;
      var dx = (c.x - g.x) * g.face, up = g.y - c.y;
      return dx > 4 && dx < 40 && up > 4 && up < 28;
    },
    run: function* (S) {
      var g = S.gold, dax = S.dax, t;
      // 1. 看看鼠标，看看自己的爪子，再看看鼠标
      S.look(g, 'cursor');
      yield 0.3;
      S.look(g, { x: g.x + g.face * 10, y: g.y, z: 2 });
      yield 0.3;
      S.look(g, 'cursor');
      // 2. 抬爪子，对着鼠标，停在差 3 的地方；最多举 4 秒
      var c = S.cursor, both = note.fiveN >= 2;
      S.hold(g, both ? ['beg', 'paw'] : 'paw'); g.wag = 0.8;
      S.rig(g, { pawAt: [Math.max(6, Math.min(16, (c.x - g.x) * g.face - 3)), Math.max(6, Math.min(24, g.y - c.y - 3))] });
      note.five = 1; t = S.now();
      yield S.until(function () { return note.five === 2; }, 4);
      var hit = note.five === 2;
      note.five = 0;
      S.rig(g, null);
      if (!hit) {
        // 5. 她没拍：爪子放下，一个小小的问号。什么都没丢
        S.hold(g, 'sit'); S.emote('q', g, 0, 0.8); note.fiveN = 0;
        yield 0.8;
        return;
      }
      // 3. 拍到了：一颗小星星，爪子弹回来一点，眯眼，一颗心
      note.fiveN++;
      if (c.known) S.emoteAt('spark', c.x, c.y + 2, 0.5);
      S.rig(g, { eyes: 'happy' }); S.hold(g, 'sit'); S.emote('heart', g, 0, 0.9); g.wag = 1;
      yield 0.5;
      // 4. 小腊肠跑过来也要击掌：太矮了，只好跳起来碰鼠标
      if (S.join(dax)) {
        var p = S.toCursor(dax) || { x: g.x - g.face * 20, y: g.y };
        yield S.go(dax, p, S.spd(dax, 'run'), null, 2);
        S.faceTo(dax, 'cursor'); S.look(dax, 'cursor'); S.hold(dax, 'stand');
        S.hop(dax, 110);
        yield 0.3;
        if (S.cursor.known) S.emoteAt('spark', S.cursor.x, S.cursor.y + 2, 0.5);
        yield 0.5;
        S.hold(dax, 'sit'); dax.wag = 1;
      }
      yield 0.6;
    },
    end: function () { note.five = 0; },
  });
  // 金毛举着爪子的时候，她点了它：算击掌（只记一笔，不占演员；原来点狗的爱心照常）
  add({ name: 'high_five_tap', zh: '击掌：她拍到了', kind: 'react', on: 'click', cast: 'who', overlay: true, tag: 'hers',
    when: function (S, ev) { return ev.who === S.gold && note.five === 1; },
    run: function* () { note.five = 2; } });

  // ============================================================
  //  C04 伏击鼠标：看见、盯住、潜行、扑！
  // ============================================================
  add({ name: 'stalk_pounce', zh: '伏击鼠标', kind: 'react', on: 'drift', cast: 'dax', tag: 'seek', mood: 'mischievous', cool: 240, family: 'cursor', timeout: 18,
    when: function (S, ev) {
      var d = S.dax, c = S.cursor;
      if (!c.known || S.asleep(d)) return false;
      var dist = Math.abs(c.x - d.x) + Math.abs(c.y - (d.y - 8)) * 0.5;
      return dist > 40 && dist < 140;
    },
    run: function* (S) {
      var d = S.dax, g = S.gold, i;
      // 1. 头一下转过去，一只耳朵竖起来
      S.faceTo(d, 'cursor'); S.hold(d, ['alert', 'stand']); S.look(d, 'cursor'); S.rig(d, { earFlick: 1 }); d.wag = 0;
      if (S.free(g) !== false) S.look(g, 'cursor');
      yield 0.5;
      // 2. 盯住：身子慢慢压低，只有头跟着动
      S.rig(d, null); S.hold(d, ['stalk', 'bow']); S.mood(d, 'focused');
      yield 0.8;
      // 3. 潜行：往鼠标下面一点慢慢挪，鼠标一停它也停；停够了屁股扭一扭
      var t0 = S.t();
      yield S.until(function () {
        var p = S.toCursor(d, 8);
        if (!p) return true;
        if (S.cursor.still > 0.4) { S.stop(d); S.rig(d, { wiggle: 1 }); return S.t() - t0 > 1.2; }
        S.rig(d, null); S.go(d, p.x, p.y, 10, ['stalk', 'bow'], 3);
        return Math.abs(d.x - p.x) < 4;
      }, 2.4);
      S.rig(d, { wiggle: 1 });
      yield 0.5;
      // 4. 扑！落地成伏身，停在鼠标前面 10 的地方（不压在鼠标底下）
      S.rig(d, null); S.stop(d); S.hold(d, 'stand');
      var c = S.cursor, s = c.x > d.x ? 1 : -1;
      S.hop(d, 120);
      yield S.slide(d, s * Math.max(0, Math.min(30, Math.abs(c.x - d.x) - 12)), 0, 0.5);
      S.hold(d, 'bow'); S.puff(d.x + d.face * d.mx, d.y, false);
      yield 0.4;
      // 5. 看看爪子底下：什么都没有。抬头看鼠标：？
      d.look = -0.6;
      yield 0.5;
      d.look = 0; S.look(d, 'cursor'); S.emote('q', d, 0, 0.8);
      yield 0.6;
      // 6. 看她怎么动：甩开 → 下巴贴地，追一小段，叫一声；晃 → 伏身叫一声再扑；绕着它转 → 跟着转到晕
      var turns = 0, lastSide = s, t1 = S.t();
      while (S.t() - t1 < 6) {
        c = S.cursor;
        if (!c.known) break;
        if (c.speed > 120) {
          S.hold(d, 'lie'); S.rig(d, { chin: true });
          yield 0.3;
          S.rig(d, null); S.hold(d, 'stand');
          var p2 = S.toCursor(d, 10);
          if (p2) yield S.go(d, p2, S.spd(d, 'run'), null, 1);
          d.bark = 0.3; S.emote('woof', d, d.face * 10, 0.5);
          break;
        }
        var side = c.x > d.x ? 1 : -1;
        if (side !== lastSide) { turns++; lastSide = side; S.faceTo(d, 'cursor'); if (turns >= 4) { S.emote('dizzy', d, 0, 1.0); S.hold(d, 'sit'); yield 1.0; break; } }
        if (c.speed > 20 && c.speed <= 120 && S.chance(0.08)) {
          S.hold(d, 'bow'); d.bark = 0.3; S.emote('woof', d, d.face * 10, 0.4);
          yield 0.4;
          S.hold(d, 'stand'); S.hop(d, 110);
          yield 0.5;
        }
        if (c.y < d.y - 26 && Math.abs(c.x - d.x) < 16 && c.still > 0.3) {
          S.hold(d, ['rear', 'beg']); S.rig(d, { snap: true });
          yield 0.4;
          S.rig(d, null);
        }
        yield 0.15;
      }
      // 7. 收尾：昂着头绕一个小圈，然后一趴
      S.hold(d, 'stand'); S.mood(d, 'proud'); d.wag = 1;
      yield S.orbit(d, { x: d.x, y: d.y }, 10, 4, 1, S.spd(d, 'trot') * 0.6);
      S.hold(d, 'lie'); d.wag = 0.4;
      yield 0.6;
    },
  });

  // ============================================================
  //  C05 鼠标在这儿！——然后牵着它们散步（她甩鼠标找指针的那一下，也是她的口哨）
  // ============================================================
  add({ name: 'find_my_cursor', zh: '鼠标在这儿！——然后牵着它们散步', kind: 'react', on: 'shake', cast: 'dax gold', tag: 'hers', mood: 'playful', cool: 30, family: 'cursor', timeout: 52,
    when: function (S) { return S.cursor.known; },
    run: function* (S) {
      var dax = S.dax, gold = S.gold, man = S.man, i, joined = false;
      // 1. 小腊肠的耳朵"唰"地竖起来
      S.faceTo(dax, 'cursor'); S.hold(dax, 'alert'); S.emote('bang', dax, 0, 0.5); dax.wag = 1;
      yield 0.2;
      // 2. 从哪儿都直接冲过去；金毛小跑跟着
      var p = S.toCursor(dax, 2) || { x: dax.x, y: dax.y };
      var a = S.go(dax, p, S.spd(dax, 'run'), null, 5);
      var gp = S.toCursor(gold, 18) || { x: gold.x, y: gold.y };
      if (Math.abs(gp.x - p.x) < 30) gp = { x: cx(S, p.x + (p.x > S.cursor.x ? 34 : -34)), y: gp.y };
      var b = S.go(gold, gp, S.spd(gold, 'trot'), null, 6);
      yield a;
      // 3. 到了：刹车扬起一团灰；坐在鼠标下面，鼻子直直地指着它，叫一声：找到了
      S.puff(dax.x, dax.y, false);
      S.faceTo(dax, 'cursor'); S.hold(dax, 'sit'); S.look(dax, 'cursor'); dax.look = 1;
      dax.bark = 0.3; S.emote('woof', dax, dax.face * 8, 0.5);
      yield S.any(b, 1.2);
      // 4. 金毛坐在另一边，看看鼠标，又看看小腊肠
      S.faceTo(gold, 'cursor'); S.hold(gold, 'sit'); S.look(gold, 'cursor'); gold.wag = 0.8;
      yield 0.8;
      S.look(gold, dax);
      yield 1.0;
      // 5. 小腊肠跳一下碰碰鼠标（一颗小星星）
      S.hold(dax, 'stand'); S.hop(dax, 110);
      yield 0.3;
      if (S.cursor.known) S.emoteAt('spark', S.cursor.x, S.cursor.y + 2, 0.5);
      yield 0.6;
      dax.look = 0;
      // 6. 她要是慢慢拖着鼠标走：两只排成一队跟在后面散步；8 秒以后他也把球夹在胳膊下面跟上来
      var t0 = S.t(), still = 0, lastGlance = 0, walking = false;
      while (S.t() - t0 < 40) {
        var c = S.cursor;
        if (!c.known || c.speed > 160) break;
        if (c.speed >= 15) {
          walking = true; still = 0;
          S.track(dax, function () { var q = S.below(18); return q ? { x: cx(S, q.x - (dax.face || 1) * 20), y: q.y } : null; }, S.spd(dax, 'trot'));
          S.follow(gold, dax, 45, S.ry(-3), S.spd(gold, 'trot'));
          if (!joined && S.t() - t0 > 8 && S.join(man)) { joined = true; S.ball.pocket(); S.follow(man, gold, 40, S.ry(3), 40); }
          if (S.t() - lastGlance > 4) { lastGlance = S.t(); S.look(dax, 'cursor'); }
        } else {
          still += 0.2;
          if (walking && still > 0.4 && still < 2) { S.stop(dax); S.stop(gold); S.hold(dax, 'sniff'); S.hold(gold, 'sniff'); }
          if (still >= 3) break;
        }
        yield 0.2;
      }
      // 收尾：鼠标停下了——三个都坐好对着它，他点点头；她把鼠标甩走了——它们停下来看着，尾巴摇
      S.stop(dax); S.stop(gold);
      S.faceTo(dax, 'cursor'); S.faceTo(gold, 'cursor'); S.hold(dax, 'sit'); S.hold(gold, 'sit'); dax.wag = 1; gold.wag = 1;
      S.look(dax, 'cursor'); S.look(gold, 'cursor');
      if (joined) { S.stop(man); S.faceTo(man, 'cursor'); S.look(man, 'camera'); S.hold(man, 'p_front'); S.face(man, 'smile'); S.act(man, 'proud_nod', 1.2); }
      yield 1.6;
    },
  });

  // ============================================================
  //  C09 拎起一只，另外两个在下面跟着接
  // ============================================================
  function escort(name, carried, zh) {
    add({ name: name, zh: zh, kind: 'react', on: 'pickup', tag: 'hers', mood: 'funny', timeout: 30,
      cast: carried === 'dax' ? 'man gold' : (carried === 'gold' ? 'man dax' : 'dax gold'),
      when: function (S, ev) { return ev.who === S[carried]; },
      run: function* (S, ev) {
        var who = ev && ev.who, man = S.man, dax = S.dax, gold = S.gold, t0 = S.t(), reared = false;
        if (!who) return;
        yield 0.8;
        if (!who.carried) return;
        S.mem.set('escortAt', S.now());
        // 小人：手里的事一扔（！），跑到正下方，两只手举起来，左右挪着接；一滴汗
        if (carried !== 'man') {
          S.ball.pocket(); S.emote('bang', man, 0, 0.5);
          S.hold(man, ['p_reach', 'p_carry']); S.face(man, carried === 'gold' ? 'oops' : 'surprised'); S.look(man, who);
          S.track(man, function () { return { x: who.x, y: who.y + S.ry(2) }; }, 62, ['p_reach', 'p_carry']);
          S.emote('sweat', man, 4, 0.9);
        }
        // 另一只狗：金毛在下面跟着，仰着头担心；小腊肠在下面又跳又叫，追着尾巴
        var other = carried === 'dax' ? gold : dax;
        if (carried === 'man') {
          S.track(dax, function () { return { x: who.x + 12, y: who.y + S.ry(3) }; }, S.spd(dax, 'run'));
          S.track(gold, function () { return { x: who.x - 20, y: who.y + S.ry(-3) }; }, S.spd(gold, 'trot'));
          dax.wag = 1; gold.wag = 0.8; gold.look = 0.8;
        } else {
          S.track(other, function () { return { x: who.x - (other.face || 1) * (carried === 'gold' ? 8 : 4), y: who.y + S.ry(3) }; }, S.spd(other, other === gold ? 'trot' : 'run'));
          if (other === gold) { S.mood(gold, 'worried'); gold.look = 0.8; } else { dax.wag = 1; }
        }
        var hopAt = 0;
        yield S.until(function () {
          if (!who.carried) return true;
          var o = carried === 'man' ? dax : other;
          if (o === dax && o.z === 0 && S.now() > hopAt && S.dist(o, who) < 30) { hopAt = S.now() + S.rand(0.6, 1.1); S.hop(dax, 100); if (S.chance(0.4)) { dax.bark = 0.25; } }
          if (o === gold && !reared && S.t() - t0 > 2 && S.dist(gold, who) < 16) { reared = true; S.hold(gold, ['rear', 'stand']); S.rig(gold, { pawAt: [gold.face * 8, 26] }); }
          if (reared && S.t() - t0 > 3.2) { S.rig(gold, null); S.hold(gold, 'stand'); }
          return false;
        }, 26);
      },
    });
  }
  escort('carried_escort', 'dax', '拎起小腊肠：大家在下面跟着接');
  escort('carried_escort_gold', 'gold', '拎起金毛：小腊肠在下面又跳又叫');
  escort('carried_escort_man', 'man', '拎起小人：两只狗在下面追');
  // 放下来了：闻一闻、舔一下，他手按胸口松一口气；被拎的那只甩甩毛
  add({ name: 'carried_landing', zh: '放下来了：闻一闻、松口气', kind: 'react', on: 'drop', cast: 'man dax gold', tag: 'hers', mood: 'funny', timeout: 12,
    when: function (S, ev) { var t = S.mem.get('escortAt'); return !!ev.who && t !== undefined && S.now() - t < 40 && S.now() >= t; },
    run: function* (S, ev) {
      var who = ev && ev.who, man = S.man, dax = S.dax, gold = S.gold, i;
      S.mem.set('escortAt', -1e9);
      if (!who) return;
      if (who === man) {
        // 小人被放下：两只狗扑上来舔，他一屁股坐下，两颗心
        S.ball.pocket();
        var a = S.go(dax, cx(S, man.x + 12), man.y + S.ry(2), S.spd(dax, 'run'), null, 2);
        var b = S.go(gold, cx(S, man.x - 20), man.y + S.ry(-2), S.spd(gold, 'trot'), null, 2);
        yield S.any(S.all(a, b), 1.4);
        S.faceTo(dax, man); S.faceTo(gold, man); S.hold(dax, ['rear', 'stand']); S.hold(gold, 'lick');
        S.hold(man, ['p_fall', 'p_sit']); S.face(man, 'laugh'); S.puff(man.x, man.y, false);
        yield 0.6;
        S.hold(man, 'p_sit'); S.emote('heart', dax, 0, 0.9);
        yield 0.5;
        S.emote('heart', gold, 0, 0.9);
        yield 1.2;
        S.hold(man, null); S.hold(dax, 'stand'); S.hold(gold, 'stand');
        yield 0.4;
        return;
      }
      // 放下的是狗：另外两个凑过来，从耳朵闻到尾巴；舔一下
      var other = who === dax ? gold : dax;
      S.hold(who, 'stand'); S.faceTo(who, other);
      yield S.go(other, S.beside(other, who, 2), S.spd(other, 'trot'), null, 2);
      S.faceTo(other, who); S.hold(other, 'sniff'); S.emote('sniffs', other, other.face * 14, 0.5);
      S.faceTo(man, who); S.hold(man, ['p_heart', 'p_idle']); S.face(man, 'soft');
      yield 0.8;
      S.hold(other, 'lick'); S.emote('hs', who, 0, 0.8);
      yield 0.6;
      S.hold(man, 'p_tie_a'); S.face(man, 'proud');
      // 被拎的那只甩甩毛；小腊肠站起来舔金毛的下巴
      S.hold(other, 'stand');
      yield S.act(who, 'shakeoff', who === gold ? 1.7 : 1.1);
      if (who === gold) { S.hold(dax, ['rear', 'beg']); S.rig(dax, { pawAt: [dax.face * 8, 14] }); yield 0.8; S.rig(dax, null); S.hold(dax, 'stand'); }
      S.hold(man, null);
      yield 0.3;
    },
  });

  // ============================================================
  //  C10 把小腊肠放到金毛背上：骑着金毛巡场
  // ============================================================
  add({ name: 'piggyback_parade', zh: '把小腊肠放到金毛背上', kind: 'react', on: 'dropOn', cast: 'dax gold', tag: 'hers', mood: 'proud', family: 'carry', timeout: 20,
    when: function (S, ev) { return ev.who === S.dax && ev.target === S.gold; },
    run: function* (S) {
      var dax = S.dax, gold = S.gold, man = S.man, sleeping = S.asleep(gold), i;
      // 2. 落在背上坐好；金毛往下一沉又弹回来；一颗心
      S.attach(dax, gold, 'seat', 0, 0, false, 1); S.hold(dax, 'sit');
      S.emote('heart', dax, 0, 0.9);
      // 6. 金毛睡着呢：小腊肠就在它背上蜷起来一起睡；金毛的尾巴拍一下
      if (sleeping) {
        S.hold(gold, 'sleep'); S.hold(dax, ['sleep', 'lie']); S.rig(dax, { eyes: 'closed' }); gold.wag = 0.5;
        yield 1.0;
        gold.wag = 0.1; S.emote('zs', dax, 0, 1.4);
        yield 3.0;
        return;
      }
      yield S.slide(gold, 0, 0, 0.15);
      // 3. 金毛小心地站起来；小腊肠晃了一下（汗），然后稳住，昂起下巴
      S.hold(gold, 'stand'); gold.look = 0.3; S.look(gold, dax);
      S.emote('sweat', dax, 0, 0.6);
      yield 0.7;
      S.mood(dax, 'proud'); dax.look = 0.4; S.look(gold, null);
      // 4. 慢慢地、得意地绕一圈：出去 60 再回来，路过小人；他立正鼓掌
      var dir = (gold.x - man.x) > 0 ? -1 : 1, x0 = gold.x, y0 = gold.y;
      if (S.join(man)) { S.faceTo(man, gold); S.hold(man, { f: ['p_cheer', 'p_cheer2'], fps: 4 }); S.face(man, 'grin'); }
      yield S.go(gold, cx(S, x0 + dir * 60, 30), y0 + S.ry(8), 20, null, 4);
      yield S.go(gold, x0, y0, 20, null, 4);
      if (S.cast.indexOf(man) >= 0) { S.hold(man, ['p_laugh', 'p_cheer']); }
      // 5. 金毛趴下；小腊肠顺着肩膀滑下来，甩甩毛，伏下身：再来一次？
      S.hold(gold, 'lie');
      yield 0.6;
      S.detach(dax, 40); S.hold(dax, 'stand'); dax.look = 0;
      yield 0.6;
      yield S.act(dax, 'shakeoff', 1.0);
      S.faceTo(dax, 'cursor'); S.hold(dax, 'bow'); dax.wag = 1;
      yield 0.8;
    },
  });
  // 小人被放到金毛背上：金毛定住，回头看看背上的人，慢慢坐下；他滑到草地上，笑
  add({ name: 'piggyback_man', zh: '把小人放到金毛背上', kind: 'react', on: 'dropOn', cast: 'man gold', tag: 'hers', mood: 'funny', timeout: 10,
    when: function (S, ev) { return ev.who === S.man && ev.target === S.gold; },
    run: function* (S) {
      var man = S.man, gold = S.gold;
      S.ball.pocket();
      S.attach(man, gold, 'seat', 0, 0, false, 1); S.hold(man, 'p_sit'); S.face(man, 'surprised');
      S.hold(gold, 'stand'); S.rig(gold, { lookBack: true }); S.look(gold, man);
      yield 1.2;
      S.rig(gold, null); S.hold(gold, 'sit');
      yield 0.8;
      S.detach(man, 20);
      yield 0.4;
      S.hold(man, ['p_fall', 'p_sit']); S.puff(man.x, man.y, false);
      yield 0.5;
      S.hold(man, 'p_sit'); S.face(man, 'laugh'); S.emote('note', man, 0, 0.8);
      yield 1.2;
      S.hold(man, null);
    },
  });

  // ============================================================
  //  C11 放进他怀里（金毛也想当抱抱狗）
  // ============================================================
  add({ name: 'into_his_arms', zh: '放进他怀里', kind: 'react', on: 'dropOn', cast: 'man dax gold', tag: 'hers', mood: 'tender', family: 'carry', timeout: 16,
    when: function (S, ev) { return ev.target === S.man && (ev.who === S.dax || ev.who === S.gold); },
    run: function* (S, ev) {
      var man = S.man, dax = S.dax, gold = S.gold, i;
      S.ball.pocket();
      S.faceTo(man, ev.who);
      if (ev.who === dax) {
        // 1-2. 他抬头，两手一举接住，膝盖一弯：抱在怀里
        S.hold(man, ['p_carry', 'p_reach']); S.face(man, 'surprised');
        S.attach(dax, man, 'arms', 0, 0, false, 1); S.hold(dax, ['cradle', 'lie']);
        yield 0.4;
        // 3. 摇两下；它舔他下巴；他仰着头闭着眼笑；一颗心
        S.face(man, 'laugh');
        for (i = 0; i < 2; i++) { yield S.slide(man, 1.5, 0, 0.3); yield S.slide(man, -1.5, 0, 0.3); }
        S.emote('heart', man, 0, 0.9); S.emote('hs', dax, 0, 0.8);
        yield 0.6;
        // 4. 抱着走几步；金毛跟在后面，扒他的腿
        S.face(man, 'smile');
        S.follow(gold, man, gold.half + 6, S.ry(2), S.spd(gold, 'walk') * 1.2);
        yield S.go(man, cx(S, man.x + man.face * 20, 30), man.y, 20, ['p_carry', 'p_hold'], 2);
        S.stop(gold); S.faceTo(gold, man); S.hold(gold, ['rear', 'sit']); S.rig(gold, { pawAt: [gold.face * 10, 10] });
        yield 1.0;
        // 5. 放下来，空出来的手摸摸金毛，球回到手里
        S.hold(man, ['p_place', 'p_crouch']);
        yield 0.5;
        S.detach(dax, 0); S.hold(dax, 'stand'); S.rig(gold, null); S.hold(gold, 'sit');
        S.faceTo(man, gold); S.hold(man, 'p_pat'); S.face(man, 'soft'); S.emote('heart', gold, 0, 0.8);
        yield 0.9;
        return;
      }
      // 金毛：他只接住了前半截（金毛立起来扑在他胸口），往后退两步，一屁股坐在草地上
      S.hold(gold, ['rear', 'stand']); S.rig(gold, { pawAt: [gold.face * 6, 26] });
      S.hold(man, ['p_stagger', 'p_reach']); S.face(man, 'surprised');
      yield S.slide(man, -man.face * 4, 0, 0.5);
      S.hold(man, ['p_fall', 'p_sit']); S.puff(man.x, man.y, true);
      yield 0.5;
      // 金毛横趴在他腿上，只露出他的头和一只拍着它的手；小腊肠也跳上来凑热闹
      S.rig(gold, null); S.hold(gold, 'lie'); S.hold(man, ['p_sit_arm', 'p_sit']); S.face(man, 'laugh');
      yield S.slide(gold, -gold.face * 2, 0, 0.3);
      yield S.go(dax, cx(S, man.x + man.face * 16), man.y + S.ry(3), S.spd(dax, 'run'), null, 2);
      S.hop(dax, 100); S.emote('heart', dax, 0, 0.9);
      yield 1.0;
      S.emote('hs', man, 0, 0.9);
      yield 2.5;
      // 站起来拍拍西装：领带歪了，头发乱了
      S.hold(gold, 'stand'); S.hold(man, null);
      yield 0.5;
      S.hold(man, ['p_dust', 'p_idle']); S.face(man, 'wry');
      S.mem.set('tie', S.time.ms);
      yield 0.9;
    },
  });

  // ============================================================
  //  C12 你摸它不摸我？挤进来
  // ============================================================
  add({ name: 'wedge_in', zh: '你摸它不摸我？挤进来', kind: 'react', on: 'petting', cast: 'other', tag: 'hers', mood: 'funny', cool: 90, timeout: 10,
    when: function (S, ev) { var o = ev.dog === S.dax ? S.gold : S.dax; return !S.asleep(o) && S.dist(o, ev.dog) < 200; },
    run: function* (S, ev) {
      var o = S.other || (ev.dog === S.dax ? S.gold : S.dax), d = ev.dog, i;
      // 1. 另一只"唰"地抬头：！
      S.faceTo(o, d); S.emote('bang', o, 0, 0.5);
      yield 0.4;
      // 2. 小腊肠：冲过去，挤到她的手和金毛中间，从金毛下巴底下钻出来；金毛：慢悠悠走过来，挨着（半压着）小腊肠坐下，把大脑袋从底下伸进来
      var p = S.toCursor(o, o === S.dax ? 0 : 6) || S.beside(o, d, 0);
      yield S.go(o, p, o === S.dax ? S.spd(o, 'run') : S.spd(o, 'walk') * 1.6, null, 3);
      S.faceTo(o, 'cursor'); S.look(o, 'cursor');
      if (o === S.dax) { S.hold(o, ['rear', 'beg']); S.rig(o, { pawAt: [o.face * 6, 12] }); }
      else { S.hold(o, 'sit'); }
      o.wag = 1;
      // 3. 两个脑袋在鼠标底下挤来挤去：她摸着的那只眯眼，另一只一下一下地拱
      for (i = 0; i < 3; i++) { yield S.act(o, 'nudge', 0.6); yield 0.15; }
      // 4. 她两只换着摸：尾巴摇到一个节奏上，两颗心一起冒；她走开了：互相看一眼，小腊肠哼一声
      if (S.rubbing(o) > 0 || S.rubbing(d) > 0) { S.emote('heart', o, 0, 0.9); S.emote('heart', d, 0, 0.9); yield 1.0; }
      else { S.rig(o, null); S.hold(o, 'stand'); S.look(o, d); if (o === S.dax) S.emote('huff', o, o.face * 6, 0.6); yield 1.0; }
    },
  });

  // ============================================================
  //  C13 帮他正领带（谁也不提示：她自己发现的小秘密）
  // ============================================================
  add({ name: 'fix_his_tie', zh: '帮他正领带', kind: 'react', on: 'click', cast: 'man', tag: 'hers', mood: 'tender', weight: 6,
    when: function (S, ev) {
      if (ev.who !== S.man) return false;
      var t = S.mem.get('tie');
      return ev.zone === 'tie' || (t && S.time.ms - t < 600000);
    },
    run: function* (S) {
      var man = S.man, blush = S.chance(0.2);
      S.mem.set('tie', 0);
      // 2. 领带"啪"地正了：领结上一颗小星星
      var k = S.anchor(man, 'tie');
      S.emoteAt('spark', k.x, man.y - k.z, 0.5); S.rig(man, { tie: 'neat' });
      // 3. 低头摸摸领结，再抬头看她
      S.look(man, { x: man.x + man.face * 2, y: man.y, z: 18 }); S.hold(man, 'p_tie_a'); S.face(man, 'surprised');
      yield 0.8;
      S.hold(man, 'p_front'); S.look(man, 'camera'); S.face(man, 'soft');
      yield 0.3;
      // 4. 点一下头，一颗小心；五回里有一回还拉拉袖口，脸红
      S.act(man, 'proud_nod', 1.2); S.emote('hs', man, 0, 1.0);
      yield 0.9;
      if (blush) { S.face(man, 'blush'); yield S.act(man, 'cuffs', 2.0); }
      // 5. 之后几秒，肩膀挺得更直一点
      S.hold(man, null); S.face(man, 'proud');
      yield 2.0;
    },
  });

  // ============================================================
  //  C14 挠他痒痒：一本正经的人，只有她能让他破功
  // ============================================================
  add({ name: 'tickle_him', zh: '挠他痒痒', kind: 'react', on: 'rub', cast: 'man', tag: 'hers', mood: 'funny', timeout: 20,
    when: function (S, ev) { return ev.who === S.man; },
    run: function* (S) {
      var man = S.man, dax = S.dax, quiet = 0, broke = false, t0 = S.t(), stole = false;
      // 1. 站得笔直，目视前方：守住尊严
      S.hold(man, 'p_front'); S.face(man, 'neutral'); S.look(man, 'camera');
      yield 0.8;
      // 2. 肩膀一抽一抽，一条腿弯了一下，眼睛眨得飞快
      S.face(man, 'oops');
      yield S.slide(man, 0.6, 0, 0.12);
      yield S.slide(man, -0.6, 0, 0.12);
      yield 0.6;
      // 3. 绷不住了：笑弯了腰，一个个音符当作没声音的笑；球掉了，滚走了
      while (S.t() - t0 < 14) {
        if (S.rubbing(man) > 0) quiet = 0; else quiet += 0.2;
        if (quiet > 0.8) break;
        if (!broke && S.t() - t0 > 2) {
          broke = true;
          S.hold(man, ['p_laugh', 'p_cheer']); S.face(man, 'laugh');
          if (S.ball.inHand()) {
            var to = { x: cx(S, man.x + man.face * 26), y: cy(S, man.y + S.ry(4)) };
            S.ball.toss(to, 0.5, 6);
            // 4. 小腊肠趁机叼走球，跑一圈胜利圈再还回来
            if (!stole && S.join(dax)) {
              stole = true;
              S.go(dax, S.beside(dax, { x: to.x, y: to.y, half: 3, mx: 3 }, 0), S.spd(dax, 'run'), null, 2);
            }
          }
        }
        if (broke && S.chance(0.25)) S.emote('note', man, S.rand(-4, 4), 0.7);
        yield 0.2;
      }
      // 5. 她停手了：深吸一口气，拽一拽西装；领带歪了、头发乱了一阵
      S.hold(man, ['p_dust', 'p_idle']); S.face(man, 'wry');
      S.mem.set('tie', S.time.ms);
      if (stole && S.ball.where().st === 'rest') {
        yield S.go(dax, S.beside(dax, { x: S.ball.where().x, y: S.ball.where().y, half: 3, mx: 3 }, 0), S.spd(dax, 'run'), null, 2);
        S.ball.give(dax); dax.wag = 1;
        yield S.orbit(dax, { x: man.x, y: man.y }, 40, 14, 1, S.spd(dax, 'run') * 0.7);
        yield S.go(dax, S.atHand(dax), S.spd(dax, 'trot'), null, 2);
        S.faceTo(dax, man); S.faceTo(man, dax); S.hold(dax, 'sit'); S.hold(man, 'p_pat'); S.face(man, 'smile');
        S.ball.take();
        yield 0.8;
      } else yield 0.9;
      S.hold(man, null);
    },
  });

  // ============================================================
  //  C15 按住他一会儿：手放在心口，鞠一躬（很少很少：一个飞吻）
  // ============================================================
  add({ name: 'hand_on_heart', zh: '按住他一会儿', kind: 'react', on: 'press', cast: 'man', tag: 'hers', mood: 'tender', timeout: 12,
    when: function (S, ev) { return ev.who === S.man; },
    run: function* (S) {
      var man = S.man, gold = S.gold;
      // 很少才有的飞吻：六回里一回，一天最多一回；连着落空太多次就一定有一回
      var day = S.time.day, miss = S.mem.get('kissMiss') || 0, kissed = S.mem.get('kissDay') === day;
      var kiss = !kissed && (S.chance(1 / 6) || miss >= 18);
      if (kiss) { S.mem.set('kissDay', day); S.mem.set('kissMiss', 0); } else if (!kissed) S.mem.set('kissMiss', miss + 1);
      S.ball.pocket();
      // 1. 转过来正对着她，抬头看
      S.hold(man, 'p_front'); S.look(man, 'camera'); S.face(man, 'soft');
      yield 0.6;
      // 2. 右手放在心口，弯腰鞠一躬，停半秒
      S.hold(man, ['p_heart', 'p_bow']);
      yield 0.9;
      // 3. 直起身：一颗心从他胸口飞到她的鼠标那儿
      S.hold(man, 'p_front'); S.face(man, 'smile');
      var ch = S.anchor(man, 'chest');
      if (S.cursor.known) S.emoteTo('heart', { x: ch.x, y: man.y, z: ch.z }, 'cursor', 0.9);
      else S.emote('heart', man, 0, 1.0);
      if (!kiss) S.say('heart');
      yield 0.9;
      if (kiss) {
        // 4. 左右看看狗狗有没有在看……飞吻；马上正领带、看手表（脸红）
        S.look(man, { x: man.x - 40, y: man.y, z: 20 });
        yield 0.35;
        S.look(man, { x: man.x + 40, y: man.y, z: 20 });
        yield 0.35;
        S.look(man, 'camera');
        S.hold(man, ['p_kiss', 'p_front']); S.face(man, 'kiss');
        yield 0.5;
        if (S.cursor.known) S.emoteTo('hs', S.anchor(man, 'mouth'), 'cursor', 0.8); else S.emote('hs', man, 0, 1.0);
        yield 0.5;
        S.hold(man, 'p_tie_a'); S.face(man, 'blush'); S.look(man, null);
        yield 0.6;
        S.hold(man, 'p_watch');
        yield 0.7;
      }
      // 5. 金毛全看见了：？
      if (S.dist(gold, man) < 160) S.emote('q', gold, 0, 0.9);
      yield 0.6;
      S.hold(man, null);
    },
  });

  // ============================================================
  //  C16 你回来啦！离开越久，迎接越热烈（从不提她走了多久）
  // ============================================================
  add({ name: 'welcome_back', zh: '你回来啦！离开越久，迎接越热烈', kind: 'react', on: 'return', cast: 'man dax gold', mood: 'tender', keep: 6, timeout: 16,
    // 她回来时他们正在偷偷跳舞（B18 caught_dancing）：那一段就是这次的迎接，这里不再演
    when: function (S, ev) { return !(ev.tier >= 3 && (S.count('welcome_back') >= 2)) && !S.playing('caught_dancing') && S.last('caught_dancing') > 30; },
    run: function* (S, ev) {
      var man = S.man, dax = S.dax, gold = S.gold, tier = ev ? (ev.tier || 1) : 1, i;
      // 她的鼠标在哪：知道就往那儿，不知道就朝前看
      var known = S.cursor.known;
      // A：两个脑袋抬起来朝着她；金毛的尾巴拍拍地；小腊肠站起来摇一下；他抬头点点头
      S.look(dax, known ? 'cursor' : 'camera'); S.look(gold, known ? 'cursor' : 'camera'); S.look(man, 'camera');
      gold.wag = 1; dax.wag = 1; S.hold(dax, 'stand');
      S.act(man, 'proud_nod', 1.2); S.face(man, 'smile');
      if (tier <= 1 || !known) { yield 2.0; return; }
      S.ball.pocket();
      // B / C：金毛伸个懒腰，叼起最近的东西（他手里的球）；小腊肠冲向她的鼠标
      if (tier >= 3) { S.emote('bang', dax, 0, 0.5); yield S.act(dax, ['stretch', 'shakeoff'], 1.4); }
      S.act(gold, 'stretch', 2.2);
      var dp = S.toCursor(dax, 10) || { x: dax.x, y: dax.y };
      var a = S.go(dax, dp, S.spd(dax, 'run'), null, 4);
      if (tier >= 3) {
        // C：先蹦三下，再绕着她鼠标下面跑一圈
        yield a;
        for (i = 0; i < 3; i++) { S.hop(dax, 100); yield 0.4; }
        var c40 = S.below(40);
        if (c40) yield S.orbit(dax, c40, 60, 20, 1, S.spd(dax, 'run') * 0.8);
      }
      // 金毛叼着礼物（球）弯弯地小跑过去，整个身子都在扭，放在她鼠标下面 30 的地方
      yield 0.6;
      S.ball.home(); S.ball.give(gold); gold.wag = 1;
      var gp = S.toCursor(gold, 20) || { x: gold.x, y: gold.y };
      yield S.go(gold, gp, S.spd(gold, tier >= 3 ? 'trot' : 'walk') * 1.2, null, 5);
      S.faceTo(gold, 'cursor');
      var c30 = S.below(30);
      if (c30) S.ball.lay(cx(S, gold.x + gold.face * (gold.mx + 2)), c30.y); else S.ball.lay(gold.x + gold.face * gold.mx, gold.y);
      // 小腊肠转两圈、打个玩耍的喷嚏；两只都坐在她鼠标下面；他转过来挥挥手
      yield S.any(a, 1);
      S.faceTo(dax, 'cursor');
      for (i = 0; i < 2; i++) { S.turn(dax); yield 0.25; S.turn(dax); yield 0.25; }
      S.act(dax, 'sneeze', 0.6);
      S.hold(dax, 'sit'); S.hold(gold, 'sit'); S.look(dax, 'cursor'); S.look(gold, 'cursor');
      if (tier >= 3) { S.hold(man, 'p_tie_a'); yield 0.6; }
      S.hold(man, { f: ['p_wave_a', 'p_wave_b'], fps: 5 }); S.face(man, 'smile');
      if (tier >= 3) S.say('welcome', ['你回來啦', '你回来啦', 'Welcome back']);
      yield 1.6;
      S.hold(man, 'p_front');
      // C：最后两只都甩甩毛，在她看得见的地方安顿下来；球就放在那儿，她可以拿起来丢
      if (tier >= 3) { S.act(dax, 'shakeoff', 1.0); S.act(gold, 'shakeoff', 1.6); }
      yield S.until(function () { return S.ball.where().st !== 'rest'; }, 3);
    },
  });

  // ============================================================
  //  C17 你不动的时候，大狗过来趴在你脚边（屏幕最下面，不挡着你）
  // ============================================================
  add({ name: 'quiet_company', zh: '你不动的时候，大狗过来趴在你脚边', kind: 'solo', cast: 'gold', cap: 4, cool: 1200, tag: 'cursor', mood: 'tender', timeout: 300, aware: false,
    weight: function (S) {
      var c = S.cursor;
      if (!c.known || !S.her.present || S.night()) return 0;
      return (c.still > 90 || (S.her.typing && c.still > 180)) ? 30 : 0;
    },
    run: function* (S) {
      var g = S.me, F = S.field, end = S.t() + S.rand(200, 280), moved = 0;
      // 1. 走到她鼠标正下方的最底边；离鼠标不到 60 就往旁边让一让
      var spot = function () {
        var c = S.cursor, x = c.known ? c.x : g.x, y = F.y1;
        if (c.known && Math.abs(c.y - y) < 60 && Math.abs(c.x - x) < 60) x = c.x + (c.x > (F.x0 + F.x1) / 2 ? -64 : 64);
        return { x: cx(S, x, 30), y: y };
      };
      var p = spot();
      yield S.go(g, p, S.spd(g, 'walk') * 1.2, null, 12);
      // 2. 慢慢转一圈，"噗"地趴下，下巴搁在爪子上，朝着她的鼠标，叹一口气
      yield S.orbit(g, { x: g.x, y: g.y - 2 }, 6, 2, 1, S.spd(g, 'walk'));
      S.hold(g, 'lie'); S.puff(g.x, g.y, false); S.rig(g, { chin: true }); S.look(g, 'cursor'); S.faceTo(g, 'cursor');
      S.emote('sigh', g, g.face * 10, 0.9);
      // 3. 一直趴着：每 20 秒动一下耳朵或者慢慢拍一下尾巴；鼠标挪开太远就跟过去，再转圈趴下
      var tick = S.t() + 20;
      while (S.t() < end) {
        var c = S.cursor;
        if (!c.known) break;
        if (c.speed > 200) break;
        if (Math.abs(c.x - g.x) > 150) moved += 0.5; else moved = 0;
        if (moved > 20) {
          moved = 0; S.rig(g, null); S.hold(g, 'stand');
          yield S.go(g, spot(), S.spd(g, 'walk'), null, 10);
          S.hold(g, 'lie'); S.rig(g, { chin: true }); S.faceTo(g, 'cursor'); S.emote('sigh', g, g.face * 10, 0.9);
        }
        if (S.t() > tick) { tick = S.t() + 20; if (S.chance(0.5)) S.rig(g, { chin: true, earFlick: 1 }); else { g.wag = 0.5; } }
        else if (g.wag > 0.2) g.wag = 0.15;
        yield 0.5;
        S.rig(g, { chin: true });
      }
      // 5. 起来：拍三下尾巴，站起来伸个懒腰，走开
      S.rig(g, null); g.wag = 0.6;
      yield 0.8;
      S.hold(g, 'stand');
      yield S.act(g, 'stretch', 2.2);
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
