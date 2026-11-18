// 球球 · 戏包：小人和狗狗（R5 卡片 B01-B19）
//
// 他是送礼物的那个人：穿得很正式，有点害羞，对两只狗心软得一塌糊涂，没人看的时候偷偷调皮。
// 每一段都照着 R5 第 1.B 节的卡片排：几秒做什么、摆什么姿势、冒什么表情。
// 画的人还没画的姿势 / 画面，都用 ['新名字', '老名字'] 写，没有就退回老的，戏照样演得通。
// 新的戏不是第一天就全有（R5 4.2"慢慢发现"）：短小的和最早那几段第一天就有，大一点的从第 1-4 天起陆续出现
// （fromDay；设定 discovery: false 就第一天全有）。
// 说明书在 pet.js 开头"怎么写一场戏"。
(function (G) {
  'use strict';
  var L = G.PET_SCENES = G.PET_SCENES || [];
  function add(r) { r.pack = 'man'; L.push(r); }

  // —— 小工具 ——
  function sgn(v) { return v < 0 ? -1 : 1; }
  function cx(S, x, m) { var F = S.field; m = m === undefined ? 24 : m; return Math.max(F.x0 + m, Math.min(F.x1 - m, x)); }
  function cy(S, y) { var F = S.field; return Math.max(F.y0, Math.min(F.y1, y)); }
  // 往哪边空地多：1 = 右边，-1 = 左边
  function roomy(S, a) { var F = S.field; return (F.x1 - a.x) > (a.x - F.x0) ? 1 : -1; }
  // 领带歪了：记一笔（她点他就能帮他正过来，见 her.js 的 fix_his_tie）。一天最多歪 4 次
  function tieAskew(S) {
    var day = S.time.day, n = S.mem.get('tieDay') === day ? (S.mem.get('tieN') || 0) : 0;
    if (n >= 4) return;
    S.mem.set('tieDay', day); S.mem.set('tieN', n + 1);
    S.mem.set('tie', S.time.ms);
    S.rig(S.man, { tie: 'askew' });
  }
  // 他看着她（屏幕外面）一小会儿
  function glance(S, face) { S.look(S.man, 'camera'); if (face) S.face(S.man, face); }

  // ============================================================
  //  B01 金毛靠过来：三十公斤的信任，差点把人挤倒
  // ============================================================
  add({ name: 'golden_lean', zh: '金毛靠靠，差点把人挤倒', cast: 'man gold', weight: 3, cool: 360, tag: 'calm', mood: 'tender', family: 'lean',
    when: function (S) { return S.dist(S.gold, S.man) < 120 && S.gold.energy > 0.25; },
    run: function* (S) {
      var man = S.man, gold = S.gold, s = man.face, i;
      S.hold(man, null); S.look(man, gold);
      // 1. 走到他身边停下，背正好到他的胯（站在他腿前面）
      yield S.go(gold, cx(S, man.x + s * 4), man.y + S.ry(2), S.spd(gold, 'walk') * 1.5, null, 4);
      gold.face = s; S.look(man, null);
      // 2. 整个身子靠上去：他被挤得退半步，两手一抡
      S.hold(gold, ['lean', 'stand']); gold.wag = 0.4; S.look(gold, man);
      S.hold(man, ['p_stagger', 'p_idle']); S.face(man, 'surprised'); S.emote('bang', man, 0, 0.6);
      yield S.slide(man, -s * 1.5, S.ry(-1.5), 0.3);
      yield 0.5;
      // 3. 站稳了，看都不看，一只手搭到它头上
      S.hold(man, 'p_pat'); S.face(man, 'soft'); S.look(man, { x: man.x + s * 40, y: man.y, z: 30 });
      gold.look = 0.7; S.rig(gold, { eyes: 'closed' }); gold.wag = 0.3;
      yield 1.2;
      // 4. 挠耳朵三下；它靠得更用力了
      for (i = 0; i < 3; i++) { if (i === 1) S.slide(gold, -s * 0.6, 0, 0.3); if (i === 2) S.emote('hs', gold, s * 4); yield 0.5; }
      // 5. 他往旁边让一步：它靠空了，歪过去，赶紧迈一步站住
      S.hold(man, null);
      yield S.go(man, cx(S, man.x - s * 8), man.y, 18, null, 2);
      S.rig(gold, null); S.hold(gold, 'stand');
      yield S.slide(gold, -s * 2, 0, 0.25);
      S.emote('q', gold, 0, 0.8); gold.look = 0;
      S.faceTo(man, gold); S.face(man, 'grin');
      yield 0.8;
      // 6. 六成：他又挪回来半步，它叹口气接着靠
      if (S.chance(0.6)) {
        yield S.go(man, cx(S, man.x + s * 4), man.y, 14, null, 1.5);
        man.face = s; S.hold(gold, ['lean', 'stand']); S.rig(gold, { eyes: 'closed' }); S.emote('sigh', gold, s * 6);
        S.hold(man, 'p_pat'); S.face(man, 'soft');
        yield 0.9;
        S.emote('hs', gold, s * 4);
        yield 1.1;
      }
    },
  });

  // ============================================================
  //  B02 手一停，就用鼻子拱：你还没摸完
  // ============================================================
  add({ name: 'nudge_for_more', zh: '手一停，就用鼻子拱', cast: 'man gold', weight: 2, cool: 300, tag: 'calm', mood: 'funny', family: 'pet',
    when: function (S) { return S.dist(S.gold, S.man) < 160; },
    run: function* (S) {
      var man = S.man, gold = S.gold, s;
      S.hold(gold, 'sit'); S.faceTo(gold, man); gold.wag = 0.6;
      yield S.go(man, S.manAt(gold, 15), 'stroll', null, 5);
      S.faceTo(man, gold); S.faceTo(gold, man); s = man.face;
      // 1. 摸头；它闭着眼睛，下巴往上抬
      S.hold(man, 'p_pat'); S.face(man, 'soft'); S.look(man, gold);
      S.rig(gold, { eyes: 'closed' }); gold.look = 0.5; gold.wag = 0.5;
      yield 1.5;
      // 2. 他停下来看表，另一只手空着垂下来
      S.hold(man, 'p_watch'); S.face(man, 'neutral'); S.look(man, null);
      yield 1.0;
      // 3. 它睁开眼，鼻子钻到那只手底下，往上一挑，放回自己头上
      S.rig(gold, null); gold.look = 0.3;
      yield S.act(gold, 'nudge', 0.8);
      // 4. 他笑出来，接着摸
      S.hold(man, ['p_laugh', 'p_cheer']); S.face(man, 'laugh');
      yield 0.5;
      S.hold(man, 'p_pat'); S.face(man, 'smile'); S.rig(gold, { eyes: 'closed' }); gold.wag = 0.7;
      yield 0.7;
      // 5. 他停下来正领带——又被拱了一下，这下领带歪了
      S.hold(man, 'p_tie_a'); S.face(man, 'proud'); S.rig(gold, null);
      yield 0.5;
      S.act(gold, 'nudge', 0.6); S.emote('bang', man, 0, 0.5); S.face(man, 'oops');
      yield S.slide(man, -s * 1, 0, 0.15);
      tieAskew(S);
      yield 0.4;
      // 6. 他认输了：蹲下来两只手揉耳朵；它化成一摊趴下
      S.hold(man, ['p_crouch', 'p_crouch2']); S.face(man, 'soft'); S.look(man, gold);
      S.hold(gold, 'lie'); S.rig(gold, { eyes: 'closed' }); gold.wag = 0.4;
      S.emote('heart', gold, s * 5);
      yield 1.5;
    },
  });

  // 金毛刚把球交到他手里、被摸了一下（事件 fetched）：三回里有一回接着拱他的手（丢球玩完了才演）
  add({ name: 'nudge_after_fetch', zh: '交完球被摸，接着拱手', kind: 'react', on: 'fetched', cast: 'man gold', chance: 0.35, cool: 300, tag: 'calm', mood: 'funny', family: 'pet',
    when: function (S, ev) { return ev.who === S.gold && S.last('nudge_for_more') > 300; },
    run: function* (S) { yield* S.run('nudge_for_more'); },
  });

  // ============================================================
  //  B03 腿间穿梭：遛小狗的人都跳过这支舞
  // ============================================================
  add({ name: 'heel_weave', zh: '腿间穿梭', cast: 'man dax gold', weight: 2, cool: 360, tag: 'calm', mood: 'funny',
    when: function (S) { return S.dist(S.dax, S.man) < 120; },
    run: function* (S) {
      var man = S.man, dax = S.dax, gold = S.gold, dir = roomy(S, man), t0;
      S.ball.pocket();                 // 两只手都要用：球先收进口袋（戏完了引擎会放回他手里）
      var tx = cx(S, man.x + dir * 70, 30);
      // 1. 背着手散步；金毛跟在脚边
      S.follow(gold, man, gold.half + 14, S.ry(-3), S.spd(gold, 'walk') * 1.1);
      var walk = S.go(man, tx, man.y, 20, ['p_behind', 'p_walk0'], 7);
      S.face(man, 'soft');
      yield 1.2;
      // 2. 小腊肠在他两腿之间钻来钻去（8 字形），一会儿在前一会儿在后
      t0 = S.t();
      S.track(dax, function () { var k = (S.t() - t0) * 5.5; return { x: man.x + Math.sin(k) * 8 + dir * 4, y: man.y + S.ry(Math.cos(k) * 2.5) }; }, S.spd(dax, 'trot'));
      dax.wag = 1;
      yield 1.6;
      // 3. 他只好把脚抬得老高：一不小心走成了正步
      S.hold(man, ['p_sneak', 'p_walk0']); S.face(man, 'oops');
      walk = S.go(man, tx, man.y, 14, ['p_sneak', 'p_walk1'], 4);
      yield S.any(walk, 1.2);
      // 4. 踩空了一下：两只手一抡，站稳，愣 0.3 秒，抚平西装
      S.stop(man); S.hold(man, ['p_stagger', 'p_idle']); S.emote('sweat', man, 0, 0.7);
      yield S.slide(man, dir * 3, 0, 0.3);
      yield 0.4;
      S.hold(man, ['p_dust', 'p_tie_a']); S.face(man, 'proud');
      // 5. 小腊肠坐在他正前方，得意地摇尾巴；他很有风度地跨过去，接着走
      yield S.go(dax, cx(S, man.x + dir * 13), man.y + S.ry(1), S.spd(dax, 'trot'), null, 2);
      dax.face = -dir; S.hold(dax, 'sit'); S.mood(dax, 'proud'); dax.wag = 1;
      yield 0.8;
      S.hold(man, null); S.face(man, 'grin'); man.face = dir;
      S.hop(man, 60);
      yield S.go(man, cx(S, man.x + dir * 30, 30), man.y, 24, null, 3);
      S.stop(gold);
      yield 0.4;
    },
  });

  // ============================================================
  //  B04 咬领带：西装上唯一一样明摆着是狗玩具的东西
  // ============================================================
  add({ name: 'tie_tug', zh: '咬领带', cast: 'man dax gold', weight: 1, cool: 1200, cap: 3, tag: 'calm', mood: 'mischievous', family: 'tug',
    when: function (S) { return S.dist(S.dax, S.man) < 140; },
    run: function* (S) {
      var man = S.man, dax = S.dax, gold = S.gold, s, i, rope = null;
      S.ball.pocket();                 // 两只手都要用：球先收进口袋（戏完了引擎会放回他手里）
      S.faceTo(dax, man); S.hold(dax, 'stand'); dax.wag = 0.6;
      yield S.go(man, S.manAt(dax, 14), 'stroll', null, 5);
      S.faceTo(man, dax); S.faceTo(dax, man); s = man.face;
      // 1. 他蹲下去：领带晃到小腊肠鼻子跟前
      S.hold(man, 'p_crouch'); S.face(man, 'soft'); S.look(man, dax);
      yield 0.8;
      // 2. 小腊肠盯着领带头，歪头，左、右——咔，咬住
      var tip = S.anchor(man, 'tie');
      S.look(dax, tip); S.rig(dax, { tilt: 1 }); S.mood(dax, 'focused');
      yield 0.3;
      S.rig(dax, { tilt: -1 });
      yield 0.3;
      S.rig(dax, { tilt: 0, jaw: 1, snap: true });
      yield S.go(dax, cx(S, man.x + s * 10), dax.y, 30, null, 0.4);
      // 3. 拔河：它甩头往后拽，他一顿一顿地被拖过去；一只手按住领结，一只手平举：松口
      S.rig(dax, null); S.hold(dax, ['tug', 'stand']); S.mood(dax, 'happy'); dax.wag = 1;
      S.hold(man, ['p_stay', 'p_crouch']); S.face(man, 'oops'); S.emote('grr', dax, s * -8, 0.5);
      for (i = 0; i < 4; i++) {
        S.slide(dax, s * 1.6, 0, 0.2);
        yield S.slide(man, s * 2, 0, 0.2);
        if (i === 1) S.emote('grr', dax, s * -8, 0.5);
        yield 0.3;
      }
      // 4. 金毛叼着绳子玩具小跑过来，放在小腊肠面前换；小腊肠松口去抢
      if (S.hasFx('rope') && S.free(gold) !== false) {
        rope = S.prop.spawn('rope', '', gold.x, gold.y, {});
        S.prop.carry(rope, gold, 'mouth');
        yield S.go(gold, S.beside(gold, dax, 4, 2), S.spd(gold, 'trot'), null, 4);
        S.faceTo(gold, dax);
        S.prop.drop(rope);
        S.hold(gold, 'sit'); gold.wag = 0.8;
        yield 0.3;
        S.hold(dax, 'stand'); S.faceTo(dax, rope);
        yield S.go(dax, S.beside(dax, rope, 0), S.spd(dax, 'trot'), null, 1.5);
        S.prop.carry(rope, dax, 'mouth'); dax.wag = 1; S.emote('spark', dax, 0, 0.5);
      } else {
        // 没有绳子：他从口袋里摸出一块饼干丢出去
        S.hold(man, ['p_pocket', 'p_hold']); S.item(man, 'bone');
        yield 0.5;
        var to = { x: cx(S, dax.x - s * 26), y: dax.y, z: 0 };
        S.item(man, null); S.hold(man, 'p_release');
        yield S.toss('bone', man, to, 0.45, 12);
        S.hold(dax, 'stand');
        yield S.go(dax, to.x, to.y, S.spd(dax, 'run'), null, 1.5);
        S.hold(dax, 'sniff'); S.bits(dax.x + dax.face * dax.mx, dax.y, 4, 'kibble', 10, 20);
      }
      // 5. 他站起来：领带歪了、皱了；低头看看，又抬头看她，叹一口带笑的气
      tieAskew(S);
      S.hold(man, null); S.look(man, { x: man.x + s * 2, y: man.y, z: 20 }); S.face(man, 'pout');
      yield 0.6;
      S.hold(man, ['p_sigh', 'p_idle']); glance(S, 'smile');
      yield 1.1;
    },
  });

  // ============================================================
  //  B05 他一蹲下就被舔脸：和狗一样高的脸，谁忍得住
  // ============================================================
  add({ name: 'shoelace_ambush', zh: '他一蹲下就被舔脸', cast: 'man dax gold', weight: 2, cool: 720, tag: 'calm', mood: 'funny',
    when: function (S) { return S.dist(S.dax, S.man) < 110 && S.dist(S.gold, S.man) < 140 && !S.asleep(S.dax) && !S.asleep(S.gold); },
    run: function* (S) {
      var man = S.man, dax = S.dax, gold = S.gold, s = man.face, i;
      S.ball.pocket();                 // 两只手都要用：球先收进口袋（戏完了引擎会放回他手里）
      // 1. 鞋带松了：低头，蹲下系鞋带
      S.look(man, { x: man.x + s * 3, y: man.y, z: 0 }); S.face(man, 'focus');
      yield 0.5;
      S.hold(man, ['p_place', 'p_crouch']);
      yield 0.6;
      // 2. 小腊肠：一张和我一样高的脸！冲过来
      S.faceTo(dax, man); S.emote('bang', dax, 0, 0.6); dax.wag = 1;
      var ds = dax.x < man.x ? -1 : 1;
      yield S.go(dax, cx(S, man.x + ds * (dax.half * 0.55 + 6)), man.y + S.ry(1), S.spd(dax, 'run'), null, 3);
      // 3. 扑到他膝盖上，飞快地舔下巴；他眯着眼往后躲
      S.faceTo(dax, man); S.hold(dax, ['rear', 'beg']); S.rig(dax, { pawAt: [ds * -6, 9] }); dax.wag = 1;
      S.faceTo(man, dax); S.face(man, 'laugh'); S.look(man, dax);
      for (i = 0; i < 3; i++) { S.emote(i === 1 ? 'heart' : 'hs', dax, -ds * 4, 0.6); yield 0.3; }
      // 4. 金毛也小跑过来，从另一边慢慢地、大大地舔一口——他往后一倒，坐在草地上
      yield S.go(gold, cx(S, man.x - ds * (gold.half * 0.6 + 8)), man.y + S.ry(-1), S.spd(gold, 'trot'), null, 3);
      S.faceTo(gold, man); S.hold(gold, ['lick', 'stand']); gold.wag = 0.8;
      yield 0.5;
      S.hold(man, ['p_fall', 'p_sit']); S.puff(man.x, man.y, false); S.face(man, 'surprised');
      yield 0.5;
      // 5. 被两只夹在中间，坐着笑；三颗爱心
      S.hold(man, 'p_sit'); S.face(man, 'laugh');
      S.rig(dax, null); S.hold(dax, 'stand'); S.hold(gold, 'stand');
      for (i = 0; i < 3; i++) { S.emote('heart', [dax, man, gold][i], 0, 0.9); yield 0.5; }
      yield 0.4;
      // 6. 站起来，掏手帕擦脸，正领带
      S.hold(man, null); S.face(man, 'smile');
      yield 0.4;
      S.hold(man, ['p_pocket', 'p_hold']); S.item(man, 'hanky');
      yield 0.5;
      S.hold(man, ['p_wipe', 'p_hold']); S.face(man, 'oops');
      yield 0.8;
      S.item(man, null); S.hold(man, 'p_tie_a'); S.face(man, 'proud');
      yield 0.8;
    },
  });

  // ============================================================
  //  B06 颠球：西装里面藏着的那个爱显摆的人
  // ============================================================
  add({ name: 'keepie_uppie', zh: '颠球', cast: 'man dax gold', weight: 2, cool: 1200, tag: 'calm', mood: 'proud',
    when: function (S) { return S.ball.inHand() && S.dist(S.dax, S.man) < 150 && S.dist(S.gold, S.man) < 170; },
    run: function* (S) {
      var man = S.man, dax = S.dax, gold = S.gold, s = roomy(S, man), i, landed = S.chance(0.2);
      man.face = s;
      // 1. 他左右看看——两只狗过来，并排坐在他前面 30 远
      S.look(man, { x: man.x - 40, y: man.y, z: 20 });
      var a = S.go(dax, cx(S, man.x + s * 30), man.y + S.ry(4), S.spd(dax, 'trot'), null, 4);
      var b = S.go(gold, cx(S, man.x + s * 44), man.y + S.ry(-3), S.spd(gold, 'walk') * 1.6, null, 5);
      yield 0.4;
      S.look(man, { x: man.x + 40, y: man.y, z: 20 });
      yield S.all(a, b);
      S.faceTo(dax, man); S.faceTo(gold, man); S.hold(dax, 'sit'); S.hold(gold, 'sit'); dax.wag = 0.8; gold.wag = 0.5;
      S.look(dax, 'ball'); S.look(gold, 'ball');
      // 2. 颠：一下、两下、三下（两只狗的头跟着球一上一下）
      S.look(man, 'ball'); S.face(man, 'focus');
      for (i = 0; i < 4; i++) {
        S.hold(man, i % 2 ? ['p_juggle', 'p_hold'] : ['p_juggle', 'p_hold2']);
        yield S.ball.toss(man, 0.5, 8 + (i % 2) * 5);
      }
      // 3. 得意了：抛个高的，想转身用背接
      S.face(man, 'grin');
      if (landed) {
        // 五次里有一次真接住了：对她鞠一躬
        yield S.ball.toss(man, 1.0, 30);
        S.hold(man, ['p_bow', 'p_front']); glance(S, 'proud'); S.emote('spark', man, 0, 0.6);
        dax.bark = 0.3; S.hop(dax, 90); gold.wag = 1;
        yield 1.4;
        return;
      }
      var to = { x: cx(S, man.x - s * 26), y: cy(S, man.y + S.ry(4)) };
      var fly = S.ball.toss(to, 1.1, 34);
      yield 0.3;
      S.turn(man);
      yield 0.25;
      // 4. 砸在头上，弹走了
      S.emote('spark', man, 0, 0.5); S.hold(man, ['p_wipe', 'p_idle']); S.face(man, 'oops');
      yield fly;
      // 5. 小腊肠第一下就叼走了，金毛跟在后面；他揉着头，正正领带
      S.hold(dax, 'stand'); S.look(dax, null); S.look(gold, null);
      yield S.go(dax, S.beside(dax, { x: to.x, y: to.y, half: 3, mx: 3 }, 0), S.spd(dax, 'run'), null, 3);
      S.ball.give(dax); dax.wag = 1;
      S.hold(gold, 'stand');
      yield S.go(dax, S.atHand(dax), S.spd(dax, 'trot'), null, 4);
      S.faceTo(man, dax); S.faceTo(dax, man); S.hold(dax, 'sit');
      S.hold(man, 'p_pat'); S.face(man, 'smile');
      S.ball.take(); S.emote('heart', dax, 0, 0.8);
      yield 0.8;
      S.hold(man, 'p_tie_a'); S.face(man, 'proud');
      yield 0.8;
    },
  });

  // ============================================================
  //  B07 教坐下：一个把会的全做了一遍，就是不坐；一个一动不动
  // ============================================================
  add({ name: 'trick_lesson', zh: '教坐下：一个全做了，一个就是不坐', cast: 'man dax gold', weight: 1, cool: 1800, tag: 'calm', mood: 'funny', family: 'biscuit',
    run: function* (S) {
      var man = S.man, dax = S.dax, gold = S.gold, s, i;
      S.ball.pocket();                 // 两只手都要用：球先收进口袋（戏完了引擎会放回他手里）
      var tricks = ['bow', 'lie', 'roll', 'beg', 'spin', 'paw', 'bark'];
      // 1. 他站在小腊肠前面，拿着饼干，竖起一根手指：坐
      S.faceTo(dax, man); dax.wag = 1;
      yield S.go(man, S.manAt(dax, 24), 'stroll', null, 5);
      S.faceTo(man, dax); S.faceTo(dax, man); s = man.face;
      // 金毛坐在小腊肠后面（离他更远的那一头），自己留一块地方
      yield S.go(gold, cx(S, dax.x + s * (dax.half + gold.half * 0.6 + 4)), dax.y + S.ry(-5), S.spd(gold, 'walk') * 1.5, null, 5);
      S.faceTo(gold, man); S.hold(gold, 'sit'); gold.wag = 0.3; S.look(gold, man);
      S.item(man, 'bone'); S.hold(man, ['p_stay', 'p_hold']); S.face(man, 'focus'); S.look(man, dax);
      yield 1.0;
      // 2. 小腊肠等不及：除了坐，什么都来一遍（每样 0.35 秒）；后面的金毛一直端端正正坐着，口水慢慢挂下来
      S.look(dax, man); S.mood(dax, 'happy');
      for (i = 0; i < tricks.length; i++) {
        var t = tricks[i];
        if (t === 'spin') { S.hold(dax, 'stand'); S.turn(dax); }
        else if (t === 'bark') { S.hold(dax, 'stand'); S.faceTo(dax, man); dax.bark = 0.3; S.emote('woof', dax, dax.face * 10, 0.5); }
        else S.hold(dax, t);
        if (i === 2) S.emote('drool', gold, gold.face * 8, 1.6);
        yield 0.38;
      }
      // 3. 他看看这团旋风，再看看那尊雕像，叹口气，把饼干丢给金毛——它只动了动嘴
      S.look(man, gold); S.hold(man, ['p_sigh', 'p_hold']); S.face(man, 'wry');
      yield 0.7;
      S.item(man, null); S.hold(man, 'p_release');
      S.toss('bone', man, gold, 0.4, 10);
      yield 0.4;
      S.rig(gold, { snap: true }); S.emote('heart', gold, 0, 0.8); gold.wag = 0.8;
      // 4. 饼干一出手，小腊肠的屁股"啪"地坐到草地上：标准的坐，一脸无辜
      S.hold(dax, 'sit'); S.faceTo(dax, man); S.mood(dax, 'proud'); dax.wag = 0.6;
      yield 1.0;
      // 5. 他笑出声，又从口袋里摸出一块丢过去：小腊肠跳起来接住
      S.hold(man, ['p_laugh', 'p_cheer']); S.face(man, 'laugh');
      yield 0.6;
      S.hold(man, ['p_pocket', 'p_hold']); S.item(man, 'bone'); S.face(man, 'grin');
      yield 0.5;
      S.item(man, null); S.hold(man, 'p_release');
      S.toss('bone', man, dax, 0.4, 16);
      S.hold(dax, 'stand'); S.hop(dax, 125);
      yield 0.5;
      S.emote('heart', dax, 0, 0.8);
      // 6. 他蹲下去揉小腊肠的耳朵；金毛舔舔嘴
      S.hold(man, ['p_crouch', 'p_crouch2']); S.face(man, 'soft'); S.look(man, dax);
      S.hold(dax, 'sit'); dax.happy = 1;
      S.rig(gold, null); S.act(gold, 'lickchops', 0.8);
      yield 1.4;
      dax.happy = 0;
    },
  });

  // ============================================================
  //  B08 猜猜零食在哪只手：金毛守规矩，小腊肠直奔口袋
  // ============================================================
  add({ name: 'which_hand', zh: '猜猜零食在哪只手', cast: 'man gold dax', weight: 2, cool: 900, cap: 3, tag: 'calm', mood: 'playful', family: 'biscuit',
    run: function* (S) {
      var man = S.man, gold = S.gold, dax = S.dax, s = roomy(S, man), right = S.chance(0.7), first, i;
      S.ball.pocket();                 // 两只手都要用：球先收进口袋（戏完了引擎会放回他手里）
      man.face = s;
      // 1. 亮出一块饼干，两手往背后一藏，挪两下，再把两个拳头伸出来
      S.item(man, 'bone'); S.hold(man, 'p_hold'); S.face(man, 'grin'); glance(S);
      var a = S.go(gold, cx(S, man.x + s * (gold.half + 10)), man.y + S.ry(2), S.spd(gold, 'walk') * 1.6, null, 4);
      var b = S.go(dax, cx(S, man.x + s * 12), man.y + S.ry(6), S.spd(dax, 'trot'), null, 4);
      yield 0.6;
      S.item(man, null); S.hold(man, ['p_behind', 'p_idle']); S.look(man, gold);
      yield S.slide(man, s * 1.5, 0, 0.25);
      yield S.slide(man, -s * 1.5, 0, 0.25);
      yield S.all(a, b);
      S.faceTo(gold, man); S.faceTo(dax, man); S.hold(gold, 'sit'); S.hold(dax, 'sit'); gold.wag = 0.5; dax.wag = 0.9;
      S.hold(man, ['p_fists', 'p_hold']); S.face(man, 'wink');
      yield 0.5;
      // 2. 金毛闻左手、右手、再左手，尾巴慢慢摇；小腊肠的鼻子一直指着对的那只（看得出来的小提示）
      var fist = function (k) { var h = S.hand(k > 0 ? 'hand' : 'hand2'); return { x: h.x, y: man.y, z: h.z }; };
      S.hold(gold, 'sniff'); S.emote('dots', gold, 0, 1.2);
      S.look(dax, fist(right ? 1 : -1));
      for (i = 0; i < 3; i++) { S.look(gold, fist(i % 2 ? 1 : -1)); S.emote('sniffs', gold, gold.face * 18, 0.4); yield 0.7; }
      // 3. 金毛轻轻把一只爪子搭在一个拳头上（七成是右手）
      first = S.chance(0.7) ? right : !right;
      S.hold(gold, 'paw'); S.rig(gold, { pawAt: [gold.face * 14, 18] }); S.look(gold, fist(first ? 1 : -1));
      yield 0.9;
      // 4. 他张开手
      if (first === right) {
        S.hold(man, 'p_hold'); S.item(man, 'bone'); S.face(man, 'smile');
        yield 0.4;
        S.item(man, null); S.rig(gold, { snap: true }); S.emote('spark', gold, gold.face * 10, 0.5); S.emote('heart', gold, 0, 0.8);
      } else {
        S.hold(man, ['p_shrug', 'p_hold']); S.face(man, 'smile');
        yield 0.6;
        S.hold(man, 'p_hold'); S.item(man, 'bone');
        yield 0.4;
        S.item(man, null); S.rig(gold, { snap: true }); S.emote('heart', gold, 0, 0.8);
      }
      S.rig(gold, null); S.hold(gold, 'sit'); gold.wag = 1;
      yield 0.6;
      // 5. 小腊肠根本没在玩：它扒在他身上，整个鼻子塞进他的西装口袋——剩下的饼干都在那儿
      var ds = dax.x < man.x ? -1 : 1;
      yield S.go(dax, cx(S, man.x + ds * (dax.half * 0.55 + 5)), man.y + S.ry(1), S.spd(dax, 'trot'), null, 2);
      S.faceTo(dax, man); S.hold(dax, ['rear', 'beg']); S.rig(dax, { pawAt: [-ds * 5, 14] }); dax.wag = 1;
      S.emote('sniffs', dax, -ds * 6, 0.5);
      S.faceTo(man, dax); S.hold(man, 'p_hold'); S.face(man, 'surprised'); S.look(man, dax);
      yield 1.4;
      // 6. 他发现了，笑着往后一坐，也丢给它一块；它跳起来接住
      S.hold(man, ['p_laugh', 'p_cheer']); S.face(man, 'laugh');
      S.rig(dax, null); S.hold(dax, 'stand');
      yield S.slide(dax, ds * 10, 0, 0.3);
      S.hold(man, ['p_fall', 'p_sit']);
      yield 0.6;
      S.hold(man, 'p_sit');
      S.toss('bone', { x: man.x, y: man.y, z: 12 }, dax, 0.4, 12);
      S.hop(dax, 110);
      yield 0.5;
      S.emote('heart', dax, 0, 0.8); S.hold(dax, 'sit');
      yield 0.9;
    },
  });

  // ============================================================
  //  B09 球藏在背后：一个靠想，一个靠喊；客客气气伸爪子的那个赢了
  // ============================================================
  add({ name: 'behind_the_back', zh: '球藏在背后', cast: 'man dax gold', weight: 1, cool: 600, tag: 'calm', mood: 'playful',
    when: function (S) { return S.ball.inHand() && S.dist(S.dax, S.man) < 160 && S.dist(S.gold, S.man) < 170; },
    run: function* (S) {
      var man = S.man, dax = S.dax, gold = S.gold, s = roomy(S, man), i;
      man.face = s;
      // 1. 亮一下球，然后背到身后：球不见了。两只狗：？
      S.hold(man, ['p_show', 'p_hold']); S.face(man, 'grin');
      var a = S.go(dax, cx(S, man.x + s * 20), man.y + S.ry(3), S.spd(dax, 'trot'), null, 3);
      var b = S.go(gold, cx(S, man.x + s * 40), man.y + S.ry(-2), S.spd(gold, 'walk') * 1.6, null, 4);
      yield S.all(a, b);
      S.faceTo(dax, man); S.faceTo(gold, man); S.hold(dax, 'stand'); S.hold(gold, 'stand');
      S.ball.pocket(); S.hold(man, ['p_behind', 'p_idle']); S.face(man, 'wink');
      S.emote('q', dax, 0, 0.8); S.emote('q', gold, 0, 0.8);
      yield 0.9;
      // 2. 小腊肠对着他空空的手又跳又叫，再闻一闻：怪了
      for (i = 0; i < 3; i++) { S.hop(dax, 95); if (i === 1) { dax.bark = 0.3; S.emote('woof', dax, dax.face * 10, 0.5); } yield 0.45; }
      S.hold(dax, 'sniff'); S.emote('sniffs', dax, dax.face * 16, 0.4);
      yield 0.6;
      // 3. 金毛不慌不忙地绕到他背后去看；他转身把背藏开，转了一圈半，像在跳舞
      S.hold(dax, 'sit'); S.emote('q', dax, 0, 0.7);
      var orb = S.orbit(gold, { x: man.x, y: man.y }, 30, 10, 0.75, S.spd(gold, 'walk') * 1.5);
      S.face(man, 'grin');
      for (i = 0; i < 3; i++) { yield 0.55; S.faceTo(man, { x: man.x - (gold.x - man.x) }); }
      yield S.any(orb, 1.5);
      // 4. 金毛停下来，端端正正坐在他面前，伸出一只爪子：好好地请求
      yield S.go(gold, cx(S, man.x + man.face * (gold.half * 0.6 + 12)), man.y + S.ry(1), S.spd(gold, 'walk') * 1.4, null, 3);
      S.faceTo(gold, man); S.faceTo(man, gold); S.hold(gold, 'paw'); gold.wag = 0.8; S.look(gold, man);
      yield 1.2;
      // 5. 他心一软，直接把球递到它嘴里；金毛叼着球昂首挺胸绕一小圈
      S.face(man, 'soft'); S.hold(man, ['p_place', 'p_crouch']);
      S.ball.home();
      yield 0.4;
      S.ball.give(gold); S.hold(gold, 'stand'); gold.wag = 1; gold.look = 0.4;
      S.hold(man, null); S.emote('heart', gold, 0, 0.8);
      var g0 = { x: gold.x, y: gold.y };
      yield S.go(gold, cx(S, gold.x + gold.face * 30), gold.y + S.ry(6), S.spd(gold, 'walk') * 1.4, null, 2);
      yield S.go(gold, g0, S.spd(gold, 'walk') * 1.4, null, 2);
      // 6. 它把球放在他脚边，往后退两步，眼睛在球和他之间来回看；他捡起来，接着就是一次正常的丢球
      S.faceTo(gold, man); gold.look = 0;
      S.ball.lay(cx(S, man.x + man.face * 9), man.y + S.ry(2));
      yield S.slide(gold, -gold.face * 12, 0, 0.9);
      S.hold(gold, 'bow'); S.look(gold, 'ball');
      yield 0.5;
      S.look(gold, man);
      yield 0.4;
      S.hold(man, ['p_place', 'p_crouch']);
      yield 0.5;
      S.ball.home(); S.hold(man, null); S.face(man, 'grin');
      S.fetch(1);
      yield 0.4;
    },
  });

  // ============================================================
  //  B10 叼着他的袖口带路：丢球是狗的主意
  // ============================================================
  add({ name: 'sleeve_escort', zh: '叼着他的袖口带路', cast: 'man gold dax', weight: 1, cool: 1200, tag: 'calm', mood: 'playful',
    when: function (S) { return S.ball.inHand() && S.quietFor() > 60 && S.gold.energy > 0.5 && !S.her.away; },
    run: function* (S) {
      var man = S.man, gold = S.gold, dax = S.dax, dir = roomy(S, man), F = S.field;
      // 1. 金毛走过来，轻轻叼住他的袖口
      yield S.go(gold, S.atHand(gold), S.spd(gold, 'walk') * 1.6, null, 5);
      S.faceTo(gold, man); S.faceTo(man, gold);
      S.rig(gold, { jaw: 0.3 }); gold.wag = 0.7; S.look(man, gold);
      yield 0.8;
      // 2. 轻轻一拽：他被拖过去两步。他：？
      yield S.slide(man, gold.x > man.x ? 2 : -2, 0, 0.25);
      S.emote('q', man, 0, 0.8); S.face(man, 'surprised');
      yield 0.6;
      // 3. 带着他往空地多的那一边走 60-90；小腊肠尾巴竖着走在最前面开路
      var tx = cx(S, man.x + dir * S.rand(60, 90), 40), ty = cy(S, man.y + S.ry(S.rand(-20, 20)));
      gold.face = dir; S.rig(gold, { jaw: 0.3, lookBack: true }); gold.wag = 0.9;
      S.hold(man, ['p_led', 'p_stay']); S.face(man, 'grin');
      S.follow(man, gold, gold.half * 0.6 + 6, 0, 30);
      dax.wag = 1;
      var d1 = S.go(dax, cx(S, tx + dir * 46, 30), ty + S.ry(3), S.spd(dax, 'trot') * 0.6, null, 5);
      yield S.go(gold, tx + dir * (gold.half * 0.6 + 6), ty, 28, null, 4);
      yield S.any(d1, 0.5);
      S.stop(man);
      // 4. 松口，退三步，伏下身子；看看他另一只手里的球，看看空地，再看看他——三遍
      S.rig(gold, null); S.faceTo(gold, man);
      yield S.slide(gold, -gold.face * 10, 0, 0.8);
      S.hold(gold, 'bow'); gold.wag = 1;
      S.faceTo(dax, man); S.hold(dax, ['taps', 'stand']); dax.wag = 1;
      var open = { x: (gold.x < (F.x0 + F.x1) / 2) ? F.x1 - 40 : F.x0 + 40, y: gold.y, z: 4 };
      for (var i = 0; i < 3; i++) { S.look(gold, 'ball'); yield 0.3; S.look(gold, open); yield 0.3; S.look(gold, man); yield 0.25; }
      // 5. 他笑出来：就在这儿丢几个
      S.hold(man, ['p_laugh', 'p_cheer']); S.face(man, 'laugh');
      yield 1.0;
      S.hold(man, null);
      S.fetch(S.randInt(2, 3));
    },
  });

  // ============================================================
  //  B11 抱小腊肠像抱法棍：两头都托好，背是平的
  // ============================================================
  add({ name: 'baguette_carry', zh: '抱小腊肠像抱法棍', cast: 'man dax gold', cool: 900, tag: 'calm', mood: 'tender', family: 'carry',
    weight: function (S) { return S.time.h >= 17 ? 2 : 1; },
    when: function (S) { return S.dist(S.dax, S.man) < 140 && S.free(S.gold) !== false; },
    run: function* (S) {
      var man = S.man, dax = S.dax, gold = S.gold, dir = roomy(S, man), ds;
      S.ball.pocket();                 // 两只手都要用：球先收进口袋（戏完了引擎会放回他手里）
      // 1. 小腊肠扒在他腿上，尾巴转成螺旋桨：抱！
      yield S.go(dax, cx(S, man.x + (dax.x < man.x ? -1 : 1) * (dax.half * 0.55 + 5)), man.y + S.ry(1), S.spd(dax, 'trot'), null, 4);
      ds = dax.x < man.x ? -1 : 1;
      S.faceTo(dax, man); S.hold(dax, ['rear', 'beg']); S.rig(dax, { pawAt: [-ds * 5, 9] }); dax.wag = 1;
      S.faceTo(man, dax); S.look(man, dax); S.face(man, 'soft');
      yield 1.4;
      // 2. 他弯腰，一只手托胸，一只手托屁股，站起来：抱在怀里
      S.hold(man, ['p_place', 'p_crouch']);
      yield 0.6;
      S.rig(dax, null); S.attach(dax, man, 'arms', 0, 0, false, 1); S.hold(dax, ['cradle', 'lie']);
      S.hold(man, ['p_carry', 'p_hold']); S.face(man, 'smile');
      yield 0.6;
      // 3. 它和他一样长，头和尾巴从两边伸出去；他换一下手
      yield S.slide(man, 0, 0, 0.2);
      S.hop(man, 30);
      yield 0.5;
      // 4. 抱着走 100：小腊肠的耳朵一甩一甩，鼻子一直在闻；舔了他下巴一下。金毛跟在脚边，时不时抬头看
      man.face = dir; S.rig(dax, { scent: true }); dax.wag = 0.7;
      S.follow(gold, man, gold.half + 12, S.ry(-3), S.spd(gold, 'walk') * 1.1);
      var w = S.go(man, cx(S, man.x + dir * 100, 30), man.y + S.ry(S.rand(-15, 15)), 24, ['p_carry', 'p_hold'], 7);
      yield 1.6;
      S.emote('hs', man, 0, 0.8); S.face(man, 'laugh');
      yield 0.9;
      S.face(man, 'smile'); gold.look = 0.5;
      yield S.any(w, 3.5);
      gold.look = 0;
      // 5. 它看见了什么：头抬起来，耳朵竖起来，四条腿在空中划
      S.stop(man); S.stop(gold);
      S.rig(dax, { dream: 0.6 }); dax.look = 0.6; S.emote('bang', dax, 0, 0.6);
      yield 1.4;
      // 6. 他弯腰，后脚先着地放下来——它像上了发条一样冲出去；他拍拍袖子上的狗毛
      S.hold(man, ['p_place', 'p_crouch']);
      yield 0.5;
      S.rig(dax, null); dax.look = 0; S.detach(dax, 0); S.hold(dax, 'stand');
      var run = S.go(dax, cx(S, dax.x + dir * 60, 24), dax.y + S.ry(S.rand(-10, 10)), S.spd(dax, 'run'), null, 2);
      S.hold(man, ['p_dust', 'p_idle']); S.face(man, 'proud');
      yield S.all(run, 1.0);
      S.hold(man, null);
      yield 0.3;
    },
  });

  // ============================================================
  //  B12 三十公斤的"小狗"要坐腿上；然后被睡住了
  // ============================================================
  add({ name: 'lap_trap', zh: '三十公斤的"小狗"要坐腿上；然后被睡住了', cast: 'man gold dax', weight: 1, cool: 900, tag: 'calm', mood: 'sleepy', family: 'sleep', fromDay: 2,
    when: function (S) { return S.dist(S.gold, S.man) < 160; },
    run: function* (S) {
      var man = S.man, gold = S.gold, dax = S.dax, f = man.face, i;
      S.ball.pocket();                 // 两只手都要用：球先收进口袋（戏完了引擎会放回他手里）
      // 1. 他坐到草地上，两腿伸直
      S.hold(man, 'p_sit'); S.face(man, 'soft');
      yield 1.0;
      // 2. 金毛走过来，转过身，倒着退，退到屁股正好在他腿上，坐下——整个把他挡住了
      var gx = cx(S, man.x + f * (gold.half * 0.55 + 14));
      yield S.go(gold, gx, man.y + S.ry(2), S.spd(gold, 'walk') * 1.5, null, 4);
      gold.face = f; S.rig(gold, { reverse: true }); gold.wag = 0.6;
      yield S.slide(gold, -f * 9, 0, 1.0);
      S.rig(gold, null); S.hold(gold, 'sit'); gold.look = 0.3;
      // 3. 狗后面传来闷闷的一声；露在外面的那只手摸索着，找到它的胸口，抱住
      yield 0.4;
      S.emote('bang', man, -f * 4, 0.6); S.face(man, 'surprised');
      yield 0.6;
      S.hold(man, ['p_sit_arm', 'p_sit']); S.face(man, 'laugh');
      // 4. 金毛坐得又高又得意，喘着气，尾巴扫过他的鞋
      gold.pant = true; gold.wag = 0.8; S.mood(gold, 'proud');
      yield 1.8;
      // 5. 小腊肠来了：腿上被占了，哼一声，爬到他小腿上，转两圈，蜷起来——一秒就睡着
      yield S.go(dax, cx(S, man.x + f * 22), man.y + S.ry(3), S.spd(dax, 'trot'), null, 4);
      S.faceTo(dax, man); S.emote('huff', dax, 0, 0.6);
      yield 0.6;
      S.attach(dax, man, 'lap', 7, 0, false, 1);
      S.hold(dax, 'stand');
      for (i = 0; i < 2; i++) { yield 0.3; S.turn(dax); }
      S.hold(dax, ['sleep', 'lie']); S.rig(dax, { eyes: 'closed' });
      yield 0.6;
      // 6. 金毛下来，趴在他身边，下巴搁在他膝盖上。他一抬手，小腊肠的耳朵一抖——他僵住，手慢慢放下
      gold.pant = false; S.mood(gold, null); S.hold(gold, 'stand');
      yield S.go(gold, cx(S, man.x - f * (gold.half * 0.6 + 6)), man.y + S.ry(2), S.spd(gold, 'walk'), null, 3);
      gold.face = f; S.hold(gold, 'lie'); S.rig(gold, { chin: true, eyes: 'closed' });
      S.hold(man, 'p_sit'); S.face(man, 'neutral');
      yield 0.8;
      S.rig(dax, { eyes: 'closed', earFlick: 1 }); S.face(man, 'oops');
      yield 0.8;
      S.rig(dax, { eyes: 'closed' });
      // 两头都被压住，只有眼睛能动：朝她无奈地笑一笑
      glance(S, 'soft'); S.emote('hs', man, 0, 1.2);
      yield 2.0;
      // 7. 一直到有事发生（或者 20 秒左右）：脚麻了
      var t1 = S.t() + S.rand(12, 22);
      yield S.until(function () { return S.t() > t1 || S.ball.where().st !== 'hand'; }, 25);
      S.emote('sweat', man, f * 4, 0.8); S.face(man, 'oops');
      yield 0.8;
      // 小腊肠跳下去，金毛跟着站起来；他站起来，单脚跳两下，整理自己：头发乱了，领带歪了
      S.rig(dax, null); S.detach(dax, 90); S.hold(dax, 'stand');
      S.rig(gold, null); S.hold(gold, 'stand');
      yield 0.5;
      S.hold(man, null); S.face(man, 'oops');
      yield 0.4;
      S.hop(man, 40);
      yield 0.5;
      S.hop(man, 40);
      yield 0.5;
      tieAskew(S);
      S.hold(man, ['p_dust', 'p_idle']); S.face(man, 'smile');
      yield 0.8;
    },
  });

  // ============================================================
  //  B13 梳毛：一身狗毛（藏青色西装对上金毛掉毛季）
  // ============================================================
  add({ name: 'brushing_day', zh: '梳毛：一身狗毛', cast: 'man gold dax', cool: 3600, cap: 4, tag: 'calm', mood: 'funny', fromDay: 1,
    // 掉毛的季节（北半球 3-5 月、9-11 月）多梳几次
    weight: function (S) {
      var mo = +String(S.time.md).slice(0, 2), south = S.cfg.hemisphere === 'south';
      if (south) mo = ((mo + 5) % 12) + 1;
      return (mo >= 3 && mo <= 5) || (mo >= 9 && mo <= 11) ? 3 : 1;
    },
    when: function (S) { return S.dist(S.gold, S.man) < 160 && S.gold.energy > 0.3; },
    run: function* (S) {
      var man = S.man, gold = S.gold, dax = S.dax, i, s, fb = null;
      S.ball.pocket();                 // 两只手都要用：球先收进口袋（戏完了引擎会放回他手里）
      // 1. 从西装内袋掏出一把刷子，走到站着的金毛身边
      S.hold(gold, 'stand'); gold.wag = 0.5;
      S.hold(man, ['p_pocket', 'p_hold']); S.item(man, 'brush'); S.face(man, 'focus');
      yield 0.6;
      S.hold(man, null);
      // 站到它身侧：满屏时站在它身后（背正好在他手边），只有底部一条时站在屁股那一头
      var gx = S.roam ? gold.x - gold.face * 6 : gold.x - gold.face * (gold.half + 2);
      yield S.go(man, cx(S, gx), gold.y + S.ry(-5), 'stroll', null, 5);
      man.face = gold.face; s = man.face;
      S.look(man, { x: gold.x + gold.face * 4, y: gold.y, z: 18 });
      // 2. 顺着背刷五下：每一下都扬起几撮毛，飘起来落在他西装上；金毛闭着眼，靠着刷子，一条后腿一抽一抽
      S.rig(gold, { eyes: 'closed' }); S.hold(gold, ['lean', 'stand']); gold.wag = 0.3;
      for (i = 0; i < 5; i++) {
        S.hold(man, 'p_pat');
        yield 0.45;
        S.hold(man, null);
        S.bits(gold.x, gold.y - 18, 3, 'fur', 14, 30);
        if (i === 2) S.act(gold, 'kick', 1.0);
        yield 0.45;
      }
      // 3. 他把刷子举起来看：满满一块毛。地上的毛团成一个毛球，在草地上滚
      S.item(man, S.hasFx('brush_full') ? 'brush_full' : 'brush'); S.hold(man, ['p_gaze', 'p_hold']); S.face(man, 'surprised');
      if (S.hasFx('furball')) {
        fb = S.prop.spawn('furball', '', gold.x, gold.y + S.ry(3), { shadow: true });
        S.prop.fling(fb, -s * 22, 0, 0);
      }
      yield 1.4;
      // 4. 小腊肠伏低身子盯着毛球，扑！再抬头时，毛球顶在头上像一顶假发；打喷嚏，甩毛——还在头上
      if (fb) {
        var p = S.prop.where(fb);
        S.faceTo(dax, p); S.hold(dax, ['stalk', 'bow']); S.look(dax, fb);
        yield S.go(dax, S.beside(dax, { x: p.x, y: p.y, half: 3, mx: 3 }, 8), 14, ['stalk', 'bow'], 2);
        S.hold(dax, 'stand'); S.hop(dax, 100);
        yield 0.45;
        S.hold(dax, 'bow'); S.puff(dax.x + dax.face * dax.mx, dax.y, false);
        yield 0.35;
        S.prop.carry(fb, dax, 'headTop'); S.hold(dax, 'stand'); S.look(dax, null);
        yield S.act(dax, 'sneeze', 0.8);
        yield S.act(dax, 'shakeoff', 1.2);
        S.emote('q', dax, 0, 0.8);
        S.look(man, dax); S.face(man, 'laugh');
        yield 0.6;
      }
      // 5. 他低头看自己的藏青西装：一身奶油色的点点。叹气，拍一拍——毛只是挪了个地方
      S.look(man, { x: man.x, y: man.y, z: 14 }); S.hold(man, ['p_sigh', 'p_idle']); S.face(man, 'wry');
      yield 1.0;
      S.item(man, null); S.hold(man, ['p_dust', 'p_idle']);
      S.bits(man.x, man.y - 20, 3, 'fur', 8, 10);
      yield 0.9;
      // 6. 金毛最后一甩：一场暴风雪，全落在他身上。他闭了一秒眼——还是去挠它的耳朵
      S.rig(gold, null); S.hold(gold, 'stand');
      S.act(gold, 'shakeoff', 1.6);
      S.bits(gold.x, gold.y - 16, 12, 'fur', 30, 40);
      S.hold(man, null); S.face(man, 'sleepy');
      yield 1.3;
      S.hold(man, 'p_pat'); S.face(man, 'soft'); S.emote('hs', man, 0, 0.9);
      yield 1.2;
    },
  });

  // ============================================================
  //  B14 自己叼牵引绳来；半路小狗死活不走
  // ============================================================
  add({ name: 'leash_and_brakes', zh: '自己叼牵引绳来；半路小狗死活不走', cast: 'man gold dax', weight: 2, cool: 1200, tag: 'calm', mood: 'funny', fromDay: 1,
    when: function (S) { return S.gold.energy >= 0.45; },
    run: function* (S) {
      var man = S.man, gold = S.gold, dax = S.dax, I = S.island(), leash = null, i, dir;
      S.ball.pocket();                 // 两只手都要用：球先收进口袋（戏完了引擎会放回他手里）
      var kind = S.hasFx('leash_carry') ? 'leash_carry' : 'leash';
      // 开头：金毛去岛底下扒一扒，岛"咚"地掉下一根红绳；岛不在或太远，就去拱他的口袋
      if (I && I.on && S.roam && Math.abs(I.x - gold.x) < 260) {
        yield S.go(gold, I.x - 18, I.y, S.spd(gold, 'trot'), null, 6);
        S.hold(gold, ['rear', 'beg']); S.rig(gold, { pawAt: [gold.face * 6, 34] }); gold.look = 1;
        yield 0.5;
        S.pulse('drop');
        leash = S.prop.spawn('leash', '', gold.x + gold.face * gold.mx, gold.y + S.ry(1), { z: 24, sprite: kind });
        S.prop.fling(leash, 0, 0, -10);
        yield 0.6;
        S.rig(gold, null); gold.look = 0; S.hold(gold, 'stand');
        S.prop.carry(leash, gold, 'mouth');
        yield S.go(gold, S.atHand(gold), S.spd(gold, 'trot'), null, 6);
      } else {
        yield S.go(gold, S.atHand(gold), S.spd(gold, 'trot'), null, 6);
        S.faceTo(gold, man); S.faceTo(man, gold);
        S.act(gold, 'nudge', 0.6); S.emote('sniffs', gold, gold.face * 10, 0.4);
        yield 0.6;
        S.hold(man, ['p_pocket', 'p_hold']); S.face(man, 'smile');
        yield 0.5;
        leash = S.prop.spawn('leash', '', gold.x, gold.y, { sprite: kind });
        S.prop.carry(leash, gold, 'mouth');
        S.hold(man, null);
      }
      // 端端正正坐在他面前，叼着绳子，仰着头，尾巴在草上扫出一道弧
      S.faceTo(gold, man); S.faceTo(man, gold); S.hold(gold, 'sit'); gold.wag = 0.9; S.look(gold, man);
      yield 1.2;
      // 他假装研究手表（还眨了下眼）；金毛把绳子放在他鞋上，又叼起来，塞进他手里
      S.hold(man, 'p_watch'); S.face(man, 'wink');
      yield 0.8;
      S.prop.drop(leash, man.x + man.face * 4, man.y + S.ry(1));
      yield 0.5;
      S.prop.carry(leash, gold, 'mouth');
      yield S.act(gold, 'nudge', 0.6);
      // 他接过来：小腊肠反应过来了，原地转一圈，叫一声。出发——金毛自己叼着绳子的另一头
      S.hold(man, null); S.item(man, S.hasFx('leash_handle') ? 'leash_handle' : null); S.face(man, 'grin');
      S.hold(dax, 'stand'); S.turn(dax);
      yield 0.25;
      S.turn(dax); dax.bark = 0.3; S.emote('woof', dax, dax.face * 10, 0.5); dax.wag = 1;
      yield 0.6;
      dir = roomy(S, man);
      S.follow(gold, man, gold.half + 12, S.ry(3), S.spd(gold, 'walk') * 1.2);
      S.follow(dax, man, -26, S.ry(-3), S.spd(dax, 'trot') * 0.6);
      yield S.go(man, cx(S, man.x + dir * 70, 40), man.y + S.ry(S.rand(-20, 20)), 24, null, 5);
      // 半路：小腊肠突然停住，鼻子粘在一个地方
      S.stop(dax); S.hold(dax, 'sniff'); S.emote('sniffs', dax, dax.face * 16, 0.5);
      S.stop(gold); S.hold(gold, 'sit');
      S.faceTo(man, dax); S.hold(man, ['p_call', 'p_hold']); S.face(man, 'neutral');
      yield 1.2;
      // 它绕着那一点闻成一个小螺旋，头都不抬；他看看表，金毛打个哈欠
      var spot = { x: dax.x, y: dax.y };
      var orb = S.orbit(dax, spot, 6, 3, 1.5, 'sniff');
      S.hold(dax, 'sniff');
      S.hold(man, 'p_watch');
      S.act(gold, 'yawn', 1.6);
      yield S.any(orb, 2.6);
      // 闻够了：往后蹬两下草，小跑到队伍最前面，好像是别人在耽误时间。他耸耸肩
      S.stop(dax); S.hold(dax, 'stand');
      yield S.act(dax, 'kick', 0.9);
      S.bits(dax.x - dax.face * dax.half, dax.y, 4, S.grass(), 16, 30);
      dax.face = dir;
      var d2 = S.go(dax, cx(S, man.x + dir * 34), man.y + S.ry(-3), S.spd(dax, 'trot'), null, 3);
      S.hold(man, ['p_shrug', 'p_idle']); S.face(man, 'wry');
      yield S.all(d2, 1.0);
      S.hold(gold, 'stand');
      // 走完了：绳子收回口袋
      S.hold(man, null);
      S.follow(gold, man, gold.half + 12, S.ry(3), S.spd(gold, 'walk') * 1.2);
      yield S.go(man, cx(S, man.x + dir * 40, 40), man.y, 24, null, 3);
      S.stop(gold); S.faceTo(gold, man); S.hold(gold, 'sit');
      S.hold(man, ['p_pocket', 'p_hold']); S.item(man, null);
      if (leash) S.prop.remove(leash, false);
      yield 0.6;
      S.hold(man, null);
    },
  });

  // ============================================================
  //  B15 叫你等着，偷偷往前蹭：每回头看一次，它就近了三步
  // ============================================================
  add({ name: 'creeping_stay', zh: '叫你等着，偷偷往前蹭', cast: 'man dax gold', weight: 1, cool: 1500, cap: 3, tag: 'lively', mood: 'mischievous', fromDay: 2,
    when: function (S) { var F = S.field; return (F.x1 - F.x0) > 220; },
    run: function* (S) {
      var man = S.man, dax = S.dax, gold = S.gold, dir = roomy(S, man), i;
      S.ball.pocket();                 // 两只手都要用：球先收进口袋（戏完了引擎会放回他手里）
      // 狗狗排在他面前，他转身对着它们
      var a = S.go(dax, cx(S, man.x - dir * 22), man.y + S.ry(4), S.spd(dax, 'trot'), null, 4);
      var b = S.go(gold, cx(S, man.x - dir * 30), man.y + S.ry(-4), S.spd(gold, 'walk') * 1.5, null, 4);
      yield S.all(a, b);
      // 1. 他平举手掌：等着。金毛坐成一尊雕像；小腊肠坐是坐了，浑身发抖
      man.face = -dir; S.faceTo(dax, man); S.faceTo(gold, man);
      S.hold(man, ['p_stay', 'p_idle']); S.face(man, 'focus'); S.look(man, dax);
      S.hold(gold, 'sit'); gold.wag = 0.2; S.hold(dax, 'sit'); dax.wag = 1;
      yield 1.6;
      // 2. 他转身走开 70，背对着它们。小腊肠屁股贴地往前蹭了一下
      S.hold(man, null); S.face(man, 'proud');
      var w = S.go(man, cx(S, man.x + dir * 70, 30), man.y, 24, null, 4);
      yield 1.2;
      S.hop(dax, 20); S.slide(dax, dir * 6, 0, 0.3);
      yield S.any(w, 2);
      // 3. 他回头一看：小腊肠立刻定住，抬头研究天空。金毛一根毛都没动
      S.stop(man); S.turn(man); S.look(man, dax); S.face(man, 'neutral');
      dax.look = 0.8;
      yield 0.9;
      S.turn(man); S.look(man, null); dax.look = 0;
      // 4. 再往前走 30：又蹭了两下
      w = S.go(man, cx(S, man.x + dir * 30, 30), man.y, 24, null, 3);
      for (i = 0; i < 2; i++) { yield 0.7; S.hop(dax, 20); S.slide(dax, dir * 7, 0, 0.3); }
      yield S.any(w, 1);
      // 5. 他整个转过来，看见了这段距离：叉腰。小腊肠趴平，下巴贴地，眼睛看别处，舔舔嘴（心虚）
      S.stop(man); S.faceTo(man, dax); S.hold(man, ['p_hips', 'p_idle']); S.face(man, 'pout');
      S.hold(dax, 'lie'); S.rig(dax, { chin: true }); S.mood(dax, 'guilty');
      yield 0.5;
      S.act(dax, 'lickchops', 0.6);
      yield 1.0;
      // 6. 他摇摇头，笑了，单膝跪下张开手臂
      S.hold(man, ['p_kneel', 'p_crouch']); S.face(man, 'laugh');
      yield 0.8;
      // 7. 两只一起冲过来：小腊肠先到，一跳跳进他怀里；金毛晚一秒到，靠上来——把他撞得一屁股坐下
      S.rig(dax, null); S.mood(dax, 'happy'); S.hold(dax, 'stand'); dax.wag = 1; gold.wag = 1;
      var ds = dax.x < man.x ? -1 : 1;
      yield S.go(dax, cx(S, man.x + ds * 14), man.y + S.ry(2), S.spd(dax, 'run'), null, 3);
      S.hop(dax, 125);
      yield 0.3;
      S.attach(dax, man, 'arms', 0, 0, false, -1); S.hold(dax, ['cradle', 'sit']);
      yield S.go(gold, cx(S, man.x + ds * (gold.half * 0.5 + 8)), man.y + S.ry(1), S.spd(gold, 'run') * 0.7, null, 3);
      S.faceTo(gold, man); S.hold(gold, ['lean', 'stand']);
      S.hold(man, ['p_fall', 'p_sit']); S.puff(man.x, man.y, true); S.face(man, 'surprised');
      yield 0.6;
      // 8. 一堆：他坐着，小腊肠舔他下巴，金毛把头搁在他肩上。两三颗爱心；然后大家站起来
      S.hold(man, 'p_sit'); S.face(man, 'laugh'); S.hold(gold, 'sit'); S.rig(gold, { chin: true, eyes: 'closed' });
      for (i = 0; i < 3; i++) { S.emote(i % 2 ? 'hs' : 'heart', [dax, man, gold][i], 0, 0.9); yield 0.7; }
      yield 0.8;
      S.detach(dax, 60); S.rig(gold, null); S.hold(gold, 'stand'); S.hold(dax, 'stand');
      S.hold(man, null); S.face(man, 'smile');
      yield 0.8;
    },
  });

  // ============================================================
  //  B16 捉迷藏：他躲进岛里，小腊肠顺着气味找过来
  // ============================================================
  add({ name: 'hide_and_seek_island', zh: '捉迷藏：他躲进岛里', cast: 'man dax gold', weight: 2, cool: 10800, cap: 2, tag: 'lively', mood: 'playful', family: 'island', fromDay: 4,
    when: function (S) {
      var I = S.island();
      return !!(I && I.on && S.roam) && !S.night() && S.time.h >= 8 && S.her.present && !S.her.engaged && S.quietFor() > 120 &&
             S.dist(S.dax, S.man) > 60 && S.dist(S.gold, S.man) > 60;
    },
    run: function* (S) {
      var man = S.man, dax = S.dax, gold = S.gold, I = S.island(), trail = [], i;
      S.ball.pocket();                 // 两只手都要用：球先收进口袋（戏完了引擎会放回他手里）
      if (!I) return;
      // 1. 他踮着脚溜到岛底下（一路留下气味），左右看看，冲她"嘘"一下，一跳钻进岛里
      S.face(man, 'grin');
      var last = { x: man.x, y: man.y };
      trail.push(last);
      var sneak = S.go(man, I.x + S.rand(-30, 30), I.y + 30, 16, ['p_sneak', 'p_walk0'], 12);
      yield S.any(sneak, S.each(12, function () {
        if (Math.abs(man.x - last.x) + Math.abs(man.y - last.y) > 26) { last = { x: man.x, y: man.y }; trail.push(last); }
      }));
      S.look(man, { x: man.x - 40, y: man.y, z: 20 });
      yield 0.5;
      S.look(man, { x: man.x + 40, y: man.y, z: 20 });
      yield 0.5;
      if (S.cursor.known && S.cursorNear(man, 250)) { S.hold(man, ['p_shh', 'p_front']); glance(S, 'wink'); yield 0.9; }
      S.hold(man, null);
      S.pulse('gulp');
      var inside = yield* S.enterIsland(man);
      if (!inside) return;
      // 2. 金毛抬起头：人呢？左看看右看看。小腊肠一下惊醒
      S.hold(gold, 'alert'); S.look(gold, { x: gold.x - 50, y: gold.y, z: 10 }); S.emote('q', gold, 0, 1);
      S.hold(dax, 'alert'); S.emote('bang', dax, 0, 0.5);
      yield 0.8;
      S.look(gold, { x: gold.x + 50, y: gold.y, z: 10 });
      yield 0.8;
      S.look(gold, null);
      // 3. 小腊肠低头顺着他走过的路一路闻过去，尾巴竖得像天线；金毛慢慢跟着，抬着鼻子闻空气
      S.rig(dax, { tailSet: 60, scent: true }); dax.wag = 0.3;
      S.follow(gold, dax, 36, S.ry(-4), S.spd(gold, 'walk'));
      S.rig(gold, { scent: true }); gold.look = 0.5;
      for (i = 0; i < trail.length && i < 8; i++) {
        var p = trail[i], over = (i === 2) ? 10 : 0;
        yield S.go(dax, p.x + S.rand(-3, 3) + over * (p.x > dax.x ? 1 : -1), p.y + S.ry(S.rand(-2, 2)), 24, 'sniff', 3);
      }
      yield S.go(dax, I.x + 12, I.y + 2, 24, 'sniff', 4);
      // 4. 气味断在岛底下：小腊肠抬头，叫两声，往上跳；金毛坐下仰着头，低低地"汪"一声
      S.rig(dax, null); S.hold(dax, 'stand'); dax.look = 1;
      dax.bark = 0.6; S.emote('woof', dax, 0, 0.5);
      yield 0.5;
      S.hop(dax, 110);
      S.stop(gold); S.rig(gold, null);
      yield S.go(gold, I.x - 22, I.y + 4, S.spd(gold, 'walk') * 1.4, null, 3);
      S.hold(gold, 'sit'); gold.look = 1; S.emote('bigwoof', gold, 0, 0.8);
      yield 1.0;
      // 5. 岛鼓了一下，他从岛里掉下来，正好落在两只中间
      S.pulse('bulge');
      yield* S.leaveIsland(man);
      // 6. 开派对：小腊肠转圈蹦，金毛整个后半身都在扭；他单膝跪下把两只都抱住
      dax.look = 0; gold.look = 0; S.hold(gold, 'stand'); gold.wag = 1; dax.wag = 1;
      S.faceTo(dax, man); S.faceTo(gold, man);
      for (i = 0; i < 3; i++) { S.turn(dax); S.hop(dax, 95); yield 0.45; }
      S.faceTo(dax, man);
      S.hold(man, ['p_kneel', 'p_crouch']); S.face(man, 'laugh');
      S.emote('heart', dax, 0, 0.9);
      yield 0.5;
      S.emote('heart', gold, 0, 0.9);
      yield 1.4;
    },
  });

  // ============================================================
  //  B17 午睡叠成一堆（她回来会想拍下来的那一幕）
  // ============================================================
  add({ name: 'nap_pile', zh: '午睡叠成一堆', cast: 'man gold dax', weight: 3, cool: 7200, cap: 2, tag: 'calm', mood: 'sleepy', family: 'sleep', timeout: 74, fromDay: 2,
    when: function (S) {
      var t = S.time.h * 60 + S.time.m;
      return ((t >= 13 * 60 && t < 15 * 60 + 30) || S.her.idle > 600) && !S.night();
    },
    run: function* (S) {
      var man = S.man, gold = S.gold, dax = S.dax, F = S.field, i, f;
      S.ball.pocket();                 // 两只手都要用：球先收进口袋（戏完了引擎会放回他手里）
      // 在下面三分之一、离她的鼠标远一点的地方
      var px = man.x, py = S.roam ? F.y1 - (F.y1 - F.y0) * S.rand(0.05, 0.25) : man.y;
      if (S.cursor.known && Math.abs(S.cursor.x - px) < 150) px = S.cursor.x < (F.x0 + F.x1) / 2 ? F.x1 - 80 : F.x0 + 80;
      yield S.go(man, cx(S, px, 60), py, 24, null, 8);
      f = man.face;
      // 1. 打个哈欠，松一松领带，往后一躺
      yield S.act(man, 'yawn', 1.8);
      S.rig(man, { tie: 'loose' });
      S.hold(man, 'p_sit'); S.face(man, 'sleepy');
      yield 0.8;
      S.hold(man, ['p_lie', 'p_sit']); S.face(man, 'soft');
      yield 0.8;
      // 2. 金毛转一圈，挨着他躺下，头搁在他胸口；他的手落在它脖子上
      // （挨着他、在他身后一点躺：他躺着的样子露在前面，金毛的头朝着他的胸口）
      yield S.go(gold, cx(S, man.x + f * 3), man.y + S.ry(-2), S.spd(gold, 'walk') * 1.4, null, 5);
      gold.face = -f; S.hold(gold, 'lie'); S.rig(gold, { chin: true, eyes: 'closed' }); gold.wag = 0.2;
      yield 1.2;
      // 3. 小腊肠爬上他的肚子，扒两下，转三圈，蜷成一个甜甜圈
      yield S.go(dax, cx(S, man.x + f * 18), man.y + S.ry(2), S.spd(dax, 'trot'), null, 5);
      S.attach(dax, man, 'lap', 0, 0, false, 1); S.hold(dax, 'dig');
      yield 0.5;
      S.hold(dax, 'stand');
      for (i = 0; i < 3; i++) { S.turn(dax); yield 0.3; }
      S.hold(dax, ['sleep', 'lie']); S.rig(dax, { eyes: 'closed' });
      yield 1.0;
      // 4. 三种呼吸，三种快慢；z、zs
      S.face(man, 'sleepy');
      S.emote('zs', dax, 0, 1.4);
      yield 1.2;
      S.emote('z', man, 0, 1.6);
      yield 1.6;
      // 5. 定格一会儿（她的鼠标凑过来：金毛不睁眼地拍拍尾巴，他懒懒地抬一下手）
      var end = S.t() + S.rand(26, 40), zAt = 0, waved = -99;
      yield S.until(function () {
        if (S.t() > zAt) { zAt = S.t() + S.rand(3, 5); S.emote(S.pick(['z', 'zs']), S.pick([man, gold, dax]), 0, 1.6); }
        if (S.cursor.known && S.cursorNear(man, 60) && S.t() - waved > 8) {
          waved = S.t(); gold.wag = 0.8; S.emote('hs', man, 0, 1.0);
        } else if (S.t() - waved > 1.2) gold.wag = 0.2;
        return S.t() > end || S.ball.where().st !== 'hand';
      }, 45);
      // 起来：小腊肠下来伸懒腰，金毛伸懒腰，他坐起来重新系好领带
      S.rig(dax, null); S.detach(dax, 40); S.hold(dax, 'stand');
      yield 0.4;
      S.act(dax, ['stretch', 'shakeoff'], 1.6);
      S.rig(gold, null); S.hold(gold, 'stand');
      S.act(gold, ['stretch', 'shakeoff'], 2.2);
      S.hold(man, 'p_sit'); S.face(man, 'sleepy');
      yield 1.2;
      S.rig(man, null); S.hold(man, ['p_knot', 'p_tie_a']); S.face(man, 'smile');
      yield 1.2;
    },
  });

  // ============================================================
  //  B18 偷偷跳舞被发现：她不在的时候，他在偷偷练习
  // ============================================================
  add({ name: 'caught_dancing', zh: '偷偷跳舞被发现', cast: 'man gold dax', weight: 4, cap: 1, fromDay: 3, tag: 'calm', mood: 'funny', timeout: 74,
    when: function (S) { return S.her.away && S.her.idle < 1150 && S.gold.energy > 0.4; },
    run: function* (S) {
      var man = S.man, gold = S.gold, dax = S.dax, s = man.face, back = false, i = 0;
      S.ball.pocket();                 // 两只手都要用：球先收进口袋（戏完了引擎会放回他手里）
      // 1. 他和金毛在跳华尔兹：金毛站起来，两只前爪搭在他手里；慢慢地转，他点着头数拍子。小腊肠坐着当观众，跟着晃
      yield S.go(gold, cx(S, man.x + s * (gold.half * 0.45 + 4)), man.y + S.ry(1), S.spd(gold, 'walk') * 1.5, null, 4);
      S.faceTo(gold, man); S.faceTo(man, gold);
      yield S.go(dax, cx(S, man.x - s * 34), man.y + S.ry(6), S.spd(dax, 'trot'), null, 4);
      S.faceTo(dax, man); S.hold(dax, 'sit'); dax.wag = 0.6;
      var hold = function () {
        S.hold(gold, ['rear', 'beg']); S.rig(gold, { pawAt: [gold.face * 10, 22] }); gold.wag = 0.7;
        S.hold(man, ['p_waltz', 'p_carry']); S.face(man, 'soft'); S.look(man, gold);
      };
      hold();
      // 一直跳，跳到她回来（最多一分钟）
      yield S.until(function () {
        if (!S.her.away || (S.cursor.known && S.cursor.still < 0.3)) { back = true; return true; }
        return false;
      }, 0.1);
      var t0 = S.t(), turnAt = 0;
      while (!back && S.t() - t0 < 58) {
        if (S.t() > turnAt) {
          turnAt = S.t() + 1.2; i++;
          var d = (i % 2 ? 1 : -1) * 4;
          S.slide(man, d, 0, 0.6); S.slide(gold, d, 0, 0.6); S.slide(dax, i % 2 ? 1 : -1, 0, 0.6);
          S.emote('note', man, 0, 0.8);
        }
        yield 0.1;
        if (!S.her.away || (S.cursor.known && S.cursor.still < 0.3 && S.her.idle < 2)) back = true;
      }
      if (!back) { S.hold(man, null); S.rig(gold, null); S.hold(gold, 'stand'); yield 0.5; return; }
      // 2. 小腊肠先发现了她：！汪
      S.faceTo(dax, 'cursor'); S.emote('bang', dax, 0, 0.6); dax.bark = 0.3; S.hold(dax, 'stand');
      yield 0.5;
      // 3. 他一步停在半空，转过来看着她：愣住。金毛还在晃
      S.hold(man, 'p_front'); glance(S, 'surprised');
      yield 0.6;
      // 4. 松开手，清清嗓子，正领带，看手表，吹个口哨：什么都没发生。脸红
      S.rig(gold, null); S.hold(gold, 'sit');
      S.hold(man, 'p_tie_a'); S.face(man, 'blush'); S.look(man, null);
      yield 0.6;
      S.hold(man, 'p_watch'); S.emote('note', man, 0, 0.9);
      yield 0.8;
      // 5. 金毛还没跳够，又把爪子搭上来；他认了，再转一圈，对她鞠一躬
      S.faceTo(man, gold); hold();
      yield 0.6;
      S.slide(man, 4, 0, 0.6); S.slide(gold, 4, 0, 0.6);
      yield 0.6;
      S.rig(gold, null); S.hold(gold, 'sit'); gold.wag = 1;
      S.hold(man, ['p_bow', 'p_front']); glance(S, 'blush');
      yield 1.1;
    },
  });

  // ============================================================
  //  B19 口袋里的照片（我们从来看不到照片上是谁；她知道）
  // ============================================================
  add({ name: 'pocket_photo', zh: '口袋里的照片', cast: 'man gold dax', cap: 1, tag: 'calm', mood: 'tender', fromDay: 3,
    weight: function (S) { return S.time.h >= 18 ? 2 : 0.5; },
    when: function (S) { return S.her.present && !S.her.engaged && S.dist(S.gold, S.man) < 180; },
    run: function* (S) {
      var man = S.man, gold = S.gold, dax = S.dax, s = man.face, gs;
      S.ball.pocket();                 // 两只手都要用：球先收进口袋（戏完了引擎会放回他手里）
      // 1. 他左右看看，从西装内袋里拿出一张小照片（只看得到背面和白边）
      S.look(man, { x: man.x - 40, y: man.y, z: 22 });
      yield 0.5;
      S.look(man, { x: man.x + 40, y: man.y, z: 22 });
      yield 0.4;
      S.hold(man, ['p_pocket', 'p_hold']); S.item(man, 'photo'); S.face(man, 'neutral');
      yield 0.6;
      // 2. 低头看着它：肩膀松下来，眼神从想念变成温柔，冒出一颗小小的心
      S.hold(man, ['p_gaze', 'p_hold']); S.face(man, 'wistful'); S.look(man, S.hand());
      yield 1.2;
      S.face(man, 'soft'); S.emote('hs', man, 0, 1.2);
      yield 1.2;
      // 3. 金毛凑过来，站起来看：尾巴摇得飞快——它认得那是谁。小腊肠跳了两下看不到，叫一声
      gs = gold.x < man.x ? -1 : 1;
      yield S.go(gold, cx(S, man.x + gs * (gold.half * 0.45 + 6)), man.y + S.ry(1), S.spd(gold, 'walk') * 1.5, null, 4);
      S.faceTo(gold, man); S.hold(gold, ['rear', 'sit']); S.rig(gold, { pawAt: [-gs * 6, 16] }); gold.wag = 1; S.look(gold, S.hand());
      yield S.go(dax, cx(S, man.x - gs * 16), man.y + S.ry(3), S.spd(dax, 'trot'), null, 3);
      S.faceTo(dax, man); dax.wag = 1;
      S.hop(dax, 100);
      yield 0.5;
      S.hop(dax, 110); dax.bark = 0.3;
      yield 0.6;
      // 4. 他蹲下来给小腊肠看：小腊肠舔了照片一口；他小心地在袖子上擦干净
      S.rig(gold, null); S.hold(gold, 'sit');
      man.face = dax.x < man.x ? -1 : 1;
      S.hold(man, ['p_crouch', 'p_place']); S.face(man, 'smile'); S.look(man, dax);
      S.hold(dax, 'lick');
      yield 0.8;
      S.hold(dax, 'sit');
      S.hold(man, ['p_dust', 'p_gaze']); S.face(man, 'oops');
      yield 0.6;
      // 5. 放回贴着心口的口袋，拍两下，朝她看一眼，继续他的事
      S.hold(man, ['p_pocket', 'p_hold']);
      yield 0.4;
      S.item(man, null); S.hold(man, ['p_heart', 'p_front']); S.face(man, 'soft');
      yield 0.8;
      glance(S, 'soft');
      yield 0.6;
      S.hold(man, null); S.look(man, null);
      yield 0.4;
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
