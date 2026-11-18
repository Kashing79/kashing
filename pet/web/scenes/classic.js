// 球球 · 戏包：最早的十一段小剧场（第二版就有的那些），原样搬过来
//
// 这个文件也是"一场戏怎么写"的样子：每一段是一条记录 + 一个 generator（function*），
// 里面用 S 上的舞台指令（S.go / S.hold / S.emote ……，全部写在 pet.js 开头"怎么写一场戏"那一节）。
// 只往全局数组 PET_SCENES 里放东西，不碰别的。
(function (G) {
  'use strict';
  var L = G.PET_SCENES = G.PET_SCENES || [];
  function add(r) { r.pack = 'classic'; L.push(r); }

  // ============================================================
  //  狗狗和狗狗
  // ============================================================
  add({ name: 'sniff', zh: '凑过去闻一闻', cast: 'dax gold', weight: 3, mood: 'playful', family: 'nose',
    run: function* (S) {
      var dax = S.dax, gold = S.gold;
      yield S.stage(gold);
      var s = dax.x < gold.x ? -1 : 1;
      S.hold(gold, 'alert'); S.faceTo(gold, dax); gold.wag = 0.6;
      yield S.go(dax, gold.x + s * (gold.mx + dax.mx + 7), gold.y + S.ry(1), S.spd(dax, 'trot'));
      S.faceTo(dax, gold); S.faceTo(gold, dax);
      S.hold(dax, 'sniff'); S.hold(gold, 'sniff'); dax.wag = 0.8; gold.wag = 0.8;
      yield 1.6;
      S.hold(dax, 'stand'); S.hold(gold, 'stand'); S.emote('heart', dax);
      yield 0.5;
      S.hold(dax, 'bow'); dax.wag = 1;
      yield 0.8;
      S.hold(gold, 'bow'); gold.wag = 1;
      yield 0.9;
      S.hop(dax, 110);
      yield 0.4;
    },
  });

  add({ name: 'chase', zh: '你追我赶', cast: 'dax gold', weight: 3, tag: 'lively', mood: 'playful',
    when: function (S) { return S.gold.energy >= 0.45; },        // 金毛累了就不追了
    run: function* (S) {
      var dax = S.dax, gold = S.gold, p, c, i;
      S.faceTo(dax, gold); S.faceTo(gold, dax);
      S.hold(dax, 'bow'); dax.wag = 1; dax.bark = 0.5; S.emote('woof', dax, dax.face * 12, 0.6);
      yield 0.7;
      S.hold(gold, 'bow'); gold.wag = 1;
      yield 0.6;
      for (i = 0; i < 3; i++) {
        p = S.randPt(70 * S.SK, dax);
        c = S.go(dax, p.x, p.y, S.spd(dax, 'run') * 0.95);
        S.follow(gold, dax, 16, S.ry(2), S.spd(gold, 'run') * 0.82);
        yield c;
        if (i === 1) { S.hop(dax, 120); yield 0.25; }
      }
      // 换过来：金毛跑，小腊肠追
      S.emote('bang', gold, 0, 0.6);
      p = S.randPt(90 * S.SK, gold);
      c = S.go(gold, p.x, p.y, S.spd(gold, 'run') * 0.9);
      S.follow(dax, gold, 14, S.ry(-2), S.spd(dax, 'run'));
      yield c;
      S.hold(gold, 'lie'); gold.pant = true;
      yield S.go(dax, gold.x + gold.face * (gold.mx + dax.mx + 2), gold.y + S.ry(3), S.spd(dax, 'trot'));
      S.hold(dax, 'sit'); dax.pant = true; S.faceTo(dax, gold);
      S.emote('note', dax);
      yield 2.4;
    },
  });

  add({ name: 'cuddle', zh: '挤在一起睡', cast: 'dax gold', weight: 2, mood: 'sleepy', family: 'sleep',
    run: function* (S) {
      var dax = S.dax, gold = S.gold;
      yield S.stage(gold);
      S.hold(gold, 'lie');
      yield 0.7;
      yield S.go(dax, gold.x + gold.face * 3, gold.y + S.ry(3), S.spd(dax, 'walk') * 1.6);
      dax.face = gold.face; S.hold(dax, 'lie');
      yield 1.0;
      S.hold(gold, 'sleep'); S.hold(dax, 'sleep');
      yield S.rand(7, 12);
      S.hold(dax, 'bow'); dax.wag = 0.6;
      yield 0.9;
      S.hold(gold, 'stand'); gold.wag = 0.7; S.emote('heart', gold);
      yield 0.7;
    },
  });

  add({ name: 'ride', zh: '小腊肠跳到金毛背上', cast: 'dax gold', weight: 2, mood: 'playful', family: 'carry',
    run: function* (S) {
      var dax = S.dax, gold = S.gold;
      yield S.stage(gold);
      S.hold(gold, 'lie'); gold.wag = 0.5;
      yield 0.6;
      yield S.go(dax, gold.x - gold.face * 22, gold.y + S.ry(1), S.spd(dax, 'trot'));
      S.faceTo(dax, gold); S.hold(dax, 'bow'); dax.wag = 1;
      yield 0.5;
      S.hold(dax, 'stand'); S.hop(dax, 150);
      yield function () { return dax.vz < 0 && dax.z <= 9; };
      S.attach(dax, gold, 'seat');            // 坐到背上（金毛的骨架会说背上哪里能坐）
      S.hold(dax, 'sit'); dax.wag = 1; gold.wag = 0.9; S.emote('heart', dax);
      yield 2.8;
      S.detach(dax, 100);
      yield S.go(dax, gold.x + gold.face * 34, gold.y + S.ry(3), S.spd(dax, 'trot'));
      S.faceTo(dax, gold); S.hold(dax, 'bow'); dax.wag = 1; S.hold(gold, 'stand');
      yield 0.8;
    },
  });

  add({ name: 'lick', zh: '金毛给小腊肠舔毛', cast: 'dax gold', weight: 2, mood: 'tender',
    run: function* (S) {
      var dax = S.dax, gold = S.gold;
      yield S.stage(dax);
      S.hold(dax, 'sit'); dax.wag = 0.5;
      var s = gold.x < dax.x ? -1 : 1;
      yield S.go(gold, dax.x + s * (gold.mx + 6), dax.y + S.ry(-1), S.spd(gold, 'walk') * 1.6);
      S.faceTo(gold, dax); S.faceTo(dax, gold);
      S.hold(gold, 'lick'); gold.wag = 0.8; dax.happy = 1;
      yield 1.5;
      S.emote('heart', dax); S.hold(dax, 'roll');
      yield 1.6;
      S.hold(gold, 'stand'); S.hold(dax, 'stand'); dax.happy = 0; dax.wag = 0.9;
      yield 0.5;
    },
  });

  // ============================================================
  //  人和狗狗
  // ============================================================
  add({ name: 'belly', zh: '揉肚子', cast: 'man dax gold', weight: 3, mood: 'tender',
    run: function* (S) {
      var man = S.man, dax = S.dax, gold = S.gold, i;
      var s = man.x < dax.x ? -1 : 1;
      S.hold(dax, 'sit'); S.faceTo(dax, man); dax.wag = 0.8;
      yield S.go(man, dax.x + s * S.pr(19), dax.y + S.ry(-1), 26);
      man.face = -s; S.faceTo(dax, man);
      S.hold(dax, 'roll'); dax.happy = 1;
      S.hold(man, { f: ['p_crouch', 'p_crouch2'], fps: 5 });
      for (i = 0; i < 3; i++) { S.emote(i % 2 ? 'hs' : 'heart', dax, S.rand(-4, 4)); yield 0.8; }
      // 金毛也要
      S.emote('bang', gold, 0, 0.6);
      yield S.go(gold, man.x + s * (gold.mx + S.pr(12)), man.y + S.ry(1), S.spd(gold, 'trot') * 1.3);
      S.faceTo(gold, man); S.hold(gold, 'sit'); gold.wag = 1;
      yield 0.4;
      man.face = s; S.hold(man, 'p_pat'); gold.happy = 1; S.emote('heart', gold);
      yield 1.1;
      S.hold(man, null); S.hold(dax, 'stand'); dax.happy = 0; gold.happy = 0;
      yield 0.4;
    },
  });

  add({ name: 'paw', zh: '握手', cast: 'man gold', weight: 3, mood: 'proud',
    run: function* (S) {
      var man = S.man, gold = S.gold;
      var s = man.x < gold.x ? -1 : 1;
      S.hold(gold, 'sit'); S.faceTo(gold, man); gold.wag = 0.7;
      yield S.go(man, gold.x + s * (gold.mx + S.pr(13)), gold.y + S.ry(0), 26);
      man.face = -s; S.faceTo(gold, man);
      S.hold(man, 'p_crouch2');
      yield 0.5;
      S.hold(gold, 'paw'); gold.wag = 1;
      yield 0.5;
      S.emote('spark', gold, gold.face * 12);
      yield 1.1;
      S.hold(gold, 'sit'); gold.happy = 1; S.hold(man, { f: ['p_cheer', 'p_cheer2'], fps: 5 }); S.emote('heart', gold);
      yield 0.9;
      S.hold(man, null); gold.happy = 0;
      yield 0.3;
    },
  });

  add({ name: 'treat', zh: '发零食', cast: 'man dax gold', weight: 3, mood: 'playful', family: 'biscuit',
    run: function* (S) {
      var man = S.man, dax = S.dax, gold = S.gold, i;
      var d = man.face;
      S.hold(man, 'p_hold'); S.item('bone'); S.emote('note', man);
      yield S.all(S.go(dax, man.x + d * 24, man.y + S.ry(3), S.spd(dax, 'run') * 0.8), S.go(gold, man.x + d * 50, man.y + S.ry(-2), S.spd(gold, 'trot') * 1.5));
      S.faceTo(dax, man); S.faceTo(gold, man);
      S.hold(dax, 'beg'); dax.wag = 1; S.hold(gold, 'sit'); gold.wag = 1; gold.look = 0.6;
      yield 1.0;
      var list = [dax, gold];
      for (i = 0; i < 2; i++) {
        var dog = list[i], h = S.handPos(d);
        S.hold(man, 'p_release'); S.item(null);
        S.toss('bone', h, dog, 0.42, 16);
        yield 0.3;
        S.hold(man, 'p_follow');
        if (dog === dax) { S.hold(dax, 'stand'); S.hop(dax, 125); } else S.hold(gold, 'alert');
        yield 0.25;
        S.emote('heart', dog); dog.happy = 1; dog.wag = 1;
        if (dog === dax) S.hold(dax, 'sit');
        yield 0.7;
        dog.happy = 0;
        if (i === 0) { S.hold(man, 'p_hold'); S.item('bone'); yield 0.5; }
      }
      S.hold(man, { f: ['p_cheer', 'p_cheer2'], fps: 5 });
      yield 0.8;
      S.hold(man, null); gold.look = 0;
    },
  });

  add({ name: 'sit', zh: '一起坐在草地上发呆', cast: 'man dax gold', weight: 2, mood: 'tender',
    run: function* (S) {
      var man = S.man, dax = S.dax, gold = S.gold, i;
      S.hold(man, 'p_sit');
      yield 0.6;
      yield S.go(dax, man.x + man.face * 6, man.y + S.ry(1), S.spd(dax, 'walk') * 1.8);
      dax.face = man.face; dax.lift = 3; S.hold(dax, 'lie'); dax.wag = 0.6; S.emote('heart', dax);
      yield S.go(gold, man.x - man.face * (gold.mx + 4), man.y + S.ry(2), S.spd(gold, 'walk') * 1.8);
      gold.face = man.face; S.hold(gold, 'lie'); gold.wag = 0.5;
      for (i = 0; i < 3; i++) { yield S.rand(2, 3.2); S.emote(S.pick(['note', 'hs', 'heart']), S.pick([man, dax, gold])); }
      dax.lift = 0; S.hold(dax, 'stand'); S.hold(gold, 'stand'); S.hold(man, null);
      yield 0.5;
    },
  });

  add({ name: 'walk', zh: '散步：小人走在前面，狗狗排队跟着', cast: 'man dax gold', weight: 3, tag: 'lively', mood: 'playful',
    when: function (S) { return S.gold.energy >= 0.45; },
    run: function* (S) {
      var man = S.man, dax = S.dax, gold = S.gold, i;
      S.emote('note', man);
      S.follow(dax, man, 22, S.ry(4), S.spd(dax, 'run') * 0.75);
      S.follow(gold, man, 46, S.ry(-2), S.spd(gold, 'trot') * 1.5);
      var n = S.randInt(2, 3);
      for (i = 0; i < n; i++) {
        var p = S.randPt(60 * S.SK, man);
        yield S.go(man, p.x, p.y, 30);
        yield 0.5;
      }
      S.hold(dax, 'sit'); S.hold(gold, 'sit'); S.faceTo(dax, man); S.faceTo(gold, man); dax.wag = 0.8; gold.wag = 0.8;
      S.hold(man, { f: ['p_wave_a', 'p_wave_b'], fps: 5 });
      yield 1.4;
      S.hold(man, null);
    },
  });

  add({ name: 'pets', zh: '金毛来讨摸，小腊肠吃醋', cast: 'man dax gold', weight: 3, mood: 'funny',
    run: function* (S) {
      var man = S.man, dax = S.dax, gold = S.gold, i;
      var s = gold.x < man.x ? -1 : 1;
      yield S.go(gold, man.x + s * (gold.mx + S.pr(12)), man.y + S.ry(1), S.spd(gold, 'trot') * 1.2);
      S.faceTo(gold, man); S.hold(gold, 'sit'); gold.wag = 1;
      man.face = s; S.hold(man, 'p_pat'); gold.happy = 1; S.emote('heart', gold);
      yield 1.2;
      S.emote('bang', dax, 0, 0.6);
      yield S.go(dax, man.x - s * S.pr(22), man.y + S.ry(2), S.spd(dax, 'run'));
      S.faceTo(dax, man); S.hold(dax, 'stand');
      for (i = 0; i < 3; i++) { S.hop(dax, 105); dax.bark = 0.3; yield 0.42; }
      man.face = -s; gold.happy = 0;
      S.hold(man, { f: ['p_crouch', 'p_crouch2'], fps: 5 }); S.hold(dax, 'sit'); dax.happy = 1; dax.wag = 1; S.emote('heart', dax);
      yield 1.4;
      S.hold(man, null); dax.happy = 0;
      yield 0.3;
    },
  });

  // ============================================================
  //  自己的小动作（solo）：闲下来的时候导演按 weight 挑一个。这是引擎原来写死的那一套，原样搬过来；
  //  别的戏包可以再往里加（kind: 'solo'，cast 只写一个角色）
  // ============================================================
  // —— 小腊肠：停不下来 ——
  add({ name: 'dax_visit', zh: '跑到小人旁边转转', kind: 'solo', cast: 'dax', weight: 20,
    run: function* (S) { var m = S.man; yield S.go(S.me, m.x + S.rand(-90, 90) * S.SK, m.y + S.ry(S.rand(-30, 30)), S.rand(26, 60) * S.SK, null, 14); } });
  add({ name: 'dax_trot', zh: '随便跑到一个地方', kind: 'solo', cast: 'dax', weight: 10,
    run: function* (S) { yield S.go(S.me, S.randPt(0), 'trot', null, 14); } });
  add({ name: 'dax_bow', zh: '冲小人伏下身子：玩嘛', kind: 'solo', cast: 'dax', weight: 8, mood: 'playful',
    run: function* (S) { var d = S.me; S.faceTo(d, S.man); S.hold(d, 'bow'); d.wag = 1; yield S.rand(1.4, 2.6); } });
  add({ name: 'dax_sit', zh: '坐着看小人', kind: 'solo', cast: 'dax', weight: 9,
    run: function* (S) { var d = S.me; S.faceTo(d, S.man); S.hold(d, 'sit'); d.wag = 0.5; yield S.rand(3, 6); } });
  add({ name: 'zoomies', zh: '满场疯跑', kind: 'solo', cast: 'dax', weight: 7, tag: 'lively',
    run: function* (S) {
      var d = S.me, a = S.randPt(80 * S.SK, d), b = S.randPt(80 * S.SK, a), back = { x: d.x, y: d.y }, way = [a, b, a, back], i;
      d.pant = true;
      for (i = 0; i < way.length; i++) yield S.go(d, way[i], 'run', null, 4);
    } });
  add({ name: 'tail_chase', zh: '追自己的尾巴', kind: 'solo', cast: 'dax', weight: 4, mood: 'funny',
    run: function* (S) {
      var d = S.me;
      d.wag = 0.9;
      yield S.each(1.3, function (t) { d.face = (Math.floor(t * 9) % 2) ? 1 : -1; });
      S.hold(d, 'sit'); d.wag = 0.8; S.emote('q', d, 0, 0.8);
      yield S.rand(1.5, 3);
    } });
  add({ name: 'dax_scratch', zh: '挠痒痒', kind: 'solo', cast: 'dax', weight: 7,
    run: function* (S) { S.hold(S.me, 'scratch'); yield S.rand(1.6, 2.6); } });
  add({ name: 'dax_sniff', zh: '低头闻着走', kind: 'solo', cast: 'dax', weight: 9, family: 'nose',
    run: function* (S) {
      var d = S.me, p = S.randPt(0);
      yield S.go(d, d.x + Math.max(-60, Math.min(60, p.x - d.x)), d.y + Math.max(-40, Math.min(40, p.y - d.y)), 'sniff', 'sniff', 14);
    } });
  add({ name: 'dax_dig', zh: '刨土', kind: 'solo', cast: 'dax', weight: 6, mood: 'mischievous',
    run: function* (S) { var d = S.me; S.hold(d, 'dig'); d.wag = 0.9; yield S.rand(1.8, 2.8); } });
  add({ name: 'dax_roll', zh: '打个滚', kind: 'solo', cast: 'dax', weight: 5,
    run: function* (S) { S.hold(S.me, 'roll'); yield S.rand(1.8, 3); } });
  add({ name: 'chase_butterfly', zh: '追蝴蝶', kind: 'solo', cast: 'dax', weight: 8, tag: 'lively',
    when: function (S) { return S.bfly.on; },
    run: function* (S) {
      var d = S.me, b = S.bfly, hopAt = 0;
      d.wag = 0.9; S.emote('bang', d, 0, 0.6);
      S.track(d, function () { return { x: b.x - (b.x > d.x ? 1 : -1) * 6, y: S.roam ? b.y + 16 : d.y }; }, S.spd(d, 'run') * 0.8);
      yield S.any(function () { return !b.on; }, S.each(9, function () {
        d.look = 0.8;
        if (Math.sqrt((b.x - d.x) * (b.x - d.x) + (b.y + 16 - d.y) * (b.y + 16 - d.y)) < 20 && d.z === 0 && S.now() > hopAt) {
          S.hop(d, 150); hopAt = S.now() + S.rand(0.7, 1.2); d.bark = 0.25; S.shoo();
        }
      }));
      S.stop(d); S.hold(d, 'sit'); d.pant = true; d.look = 0;
      yield S.rand(1.5, 3);
    } });
  add({ name: 'dax_lie', zh: '趴一会儿', kind: 'solo', cast: 'dax', weight: 3, mood: 'sleepy',
    when: function (S) { return S.quietFor() > 40; },
    run: function* (S) { S.hold(S.me, 'lie'); yield S.rand(6, 14); } });
  add({ name: 'dax_nap', zh: '打个盹', kind: 'solo', cast: 'dax', weight: 3, mood: 'sleepy',
    when: function (S) { return S.quietFor() > 180; },
    run: function* (S) { S.hold(S.me, 'sleep'); yield S.rand(25, 60); } });

  // —— 金毛：慢悠悠的 ——
  add({ name: 'gold_sit', zh: '坐着看小人', kind: 'solo', cast: 'gold', weight: 18,
    run: function* (S) { var d = S.me; S.faceTo(d, S.man); S.hold(d, 'sit'); d.wag = 0.5; yield S.rand(5, 10); } });
  add({ name: 'gold_lie', zh: '趴下歇会儿', kind: 'solo', cast: 'gold', weight: 16,
    run: function* (S) { S.hold(S.me, 'lie'); yield S.rand(8, 18); } });
  add({ name: 'gold_visit', zh: '走到小人旁边', kind: 'solo', cast: 'gold', weight: 18,
    run: function* (S) { var m = S.man; yield S.go(S.me, m.x + S.pick([-1, 1]) * S.rand(28, 60), m.y + S.ry(S.rand(-14, 14)), S.spd(S.me, 'walk') * 1.3, null, 14); } });
  add({ name: 'gold_wander', zh: '溜达', kind: 'solo', cast: 'gold', weight: 8,
    run: function* (S) { yield S.go(S.me, S.randPt(0), S.spd(S.me, 'walk') * 1.3, null, 14); } });
  add({ name: 'gold_scratch', zh: '挠痒痒', kind: 'solo', cast: 'gold', weight: 6,
    run: function* (S) { S.hold(S.me, 'scratch'); yield S.rand(1.8, 2.8); } });
  add({ name: 'gold_sniff', zh: '低头闻着走', kind: 'solo', cast: 'gold', weight: 9, family: 'nose',
    run: function* (S) {
      var d = S.me, p = S.randPt(0);
      yield S.go(d, d.x + Math.max(-50, Math.min(50, p.x - d.x)), d.y + Math.max(-30, Math.min(30, p.y - d.y)), 'sniff', 'sniff', 14);
    } });
  add({ name: 'gold_roll', zh: '打个滚', kind: 'solo', cast: 'gold', weight: 5,
    run: function* (S) { S.hold(S.me, 'roll'); yield S.rand(2, 3.2); } });
  add({ name: 'gold_watch_butterfly', zh: '坐着看蝴蝶', kind: 'solo', cast: 'gold', weight: 6,
    when: function (S) { return S.bfly.on; },
    run: function* (S) { var d = S.me; d.look = 0.6; S.faceTo(d, S.bfly); S.hold(d, 'sit'); d.wag = 0.6; S.look(d, S.bfly); yield S.rand(3, 5); } });
  add({ name: 'gold_nap', zh: '睡一觉', kind: 'solo', cast: 'gold', weight: 9, mood: 'sleepy',
    when: function (S) { return S.quietFor() > 120; },
    run: function* (S) { S.hold(S.me, 'sleep'); yield S.rand(30, 80); }, timeout: 90 });
  add({ name: 'gold_stand', zh: '站着摇摇尾巴', kind: 'solo', cast: 'gold', weight: 5,
    run: function* (S) { var d = S.me; S.hold(d, 'stand'); d.wag = 0.5; yield S.rand(2, 4); } });

  // —— 小人：隔一阵自己找点事做 ——
  add({ name: 'man_stroll', zh: '走两步', kind: 'solo', cast: 'man', weight: 20,
    run: function* (S) {
      var m = S.man, F = S.field, p = S.randPt(30 * S.SK, m), w = F.x1 - F.x0;
      var x = Math.max(F.x0 + w * 0.12, Math.min(F.x0 + w * 0.88, m.x + Math.max(-110 * S.SK, Math.min(110 * S.SK, p.x - m.x))));
      yield S.go(m, x, m.y + Math.max(-60, Math.min(60, p.y - m.y)), 24, null, 12);
    } });
  add({ name: 'man_front', zh: '转过来看着她', kind: 'solo', cast: 'man', weight: 12, mood: 'tender',
    run: function* (S) { S.hold(S.man, { f: ['p_front', 'p_front2'], fps: 1.18 }); yield S.rand(2.2, 4); } });
  add({ name: 'man_tie', zh: '整理领带', kind: 'solo', cast: 'man', weight: 10,
    run: function* (S) { S.hold(S.man, { f: ['p_tie_a', 'p_tie_b'], fps: 3 }); yield 1.7; } });
  add({ name: 'man_watch', zh: '看手表', kind: 'solo', cast: 'man', weight: 8,
    run: function* (S) { S.hold(S.man, 'p_watch'); yield 1.5; } });
  add({ name: 'man_stretch', zh: '伸个懒腰', kind: 'solo', cast: 'man', weight: 6,
    run: function* (S) { S.hold(S.man, { f: ['p_cheer', 'p_cheer2'], fps: 2 }); yield 1.2; } });
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
