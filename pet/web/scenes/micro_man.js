// 球球 · 戏包：小人自己的小习惯（R5 第 2 节 M23-M29）和他一个人时的小动作
//
// 都是 solo：他闲下来时导演挑一个，1-6 秒，随时让给别的戏和她的手。
// 动作本身大多是骨架自己会演的一小段（PET_PERSON.ACTS：抛接球、背手踮脚、擦鞋、看手机……）；
// 画的人还没做的动作 S.act 会马上算完，所以每段都另外摆了一个能看的姿势兜底。
(function (G) {
  'use strict';
  var L = G.PET_SCENES = G.PET_SCENES || [];
  function add(r) { r.pack = 'micro_man'; r.kind = 'solo'; r.cast = 'man'; L.push(r); }

  // 骨架会演这个动作就演（最多 sec 秒）；不会就摆个姿势撑 sec 秒
  function act(S, name, sec, frame, face) {
    if (S.has(S.man, name)) return S.act(S.man, name, sec);
    if (frame) S.hold(S.man, frame);
    if (face) S.face(S.man, face);
    return sec;
  }
  function near(S, a, r) { return !a.hidden && S.dist(a, S.man) < r; }
  // 有狗刚刚出了洋相（翻跟头、扑空、追尾巴……）：这些名字是别的戏包里的小动作，没有也没关系
  var GAGS = ['tail_chase', 'zoomies', 'dax_roll', 'gold_roll', 'mole_pounce', 'dead_bug', 'flyby_startle', 'fly_snap', 'chase_butterfly', 'dax_dig', 'sploot_rest'];

  // —— M23 抛接球：把球往上抛 12 再接住，两次；十次里有一次没接住，自己去捡 ——
  add({ name: 'man_ball_toss', zh: '抛接球', weight: 3, cool: 120, mood: 'playful',
    when: function (S) { return S.ball.inHand(); },
    run: function* (S) {
      var m = S.man, i;
      if (S.chance(0.1)) {
        // 没接住：弹一下滚走，他自己弯腰捡回来
        S.face(m, 'focus');
        yield S.ball.toss(m, 0.5, 10);
        var to = { x: m.x + m.face * S.rand(10, 18), y: m.y + S.ry(2) };
        yield S.ball.toss(to, 0.5, 6);
        S.face(m, 'oops'); S.emote('sweat', m, 0, 0.6);
        yield S.go(m, to.x - m.face * 6, to.y, 24, null, 2);
        S.hold(m, ['p_place', 'p_crouch']);
        yield 0.4;
        S.ball.home(); S.hold(m, null); S.face(m, 'grin');
        yield 0.5;
        return;
      }
      if (S.has(m, 'man_ball_toss')) { yield S.act(m, 'man_ball_toss', 3.4); return; }
      S.look(m, 'ball'); S.face(m, 'focus');
      for (i = 0; i < 2; i++) yield S.ball.toss(m, 0.55, 12);
      S.face(m, 'proud');
      yield 0.4;
    } });

  // —— M24 背着手踮脚：左看看右看看；有狗在看他就冲它笑 ——
  add({ name: 'man_rock_heels', zh: '背着手踮脚', weight: 3, cool: 180, mood: 'tender',
    run: function* (S) {
      var m = S.man, d = near(S, S.dax, 80) ? S.dax : (near(S, S.gold, 90) ? S.gold : null);
      if (d) { S.look(m, d); S.face(m, 'smile'); }
      yield act(S, 'man_rock_heels', 3.6, ['p_behind', 'p_idle'], 'smile');
    } });

  // —— M25 掏手帕擦鞋尖：擦三下，鞋头一闪 ——
  add({ name: 'man_shoe_shine', zh: '掏手帕擦鞋尖', weight: 2, cool: 1500, mood: 'proud',
    run: function* (S) {
      var m = S.man;
      S.ball.pocket(); S.item(m, 'hanky');
      S.look(m, { x: m.x + m.face * 3, y: m.y, z: 0 });
      yield act(S, 'man_shoe_shine', 4.4, ['p_place', 'p_crouch'], 'focus');
      S.emote('spark', m, m.face * 4, 0.6);
      S.item(m, null);
      yield 0.3;
    } });

  // —— M26 拍掉袖子上的狗毛：和狗亲热完 30 秒之内 ——
  add({ name: 'man_lint', zh: '拍掉袖子上的狗毛', cool: 90,
    weight: function (S) {
      var list = ['golden_lean', 'nudge_for_more', 'baguette_carry', 'lap_trap', 'brushing_day', 'creeping_stay', 'nap_pile', 'belly', 'pets', 'paw', 'into_his_arms', 'shoelace_ambush'];
      for (var i = 0; i < list.length; i++) if (S.last(list[i]) < 30) return 8;
      return 0;
    },
    run: function* (S) { yield act(S, 'man_lint', 3.0, ['p_dust', 'p_idle'], 'wry'); } });

  // —— M27 看她一眼：转过来，温柔地看一秒；鼠标就在旁边不动的话，挥挥手 ——
  add({ name: 'man_glance', zh: '看她一眼', weight: 3, cool: 200, mood: 'tender',
    when: function (S) { return S.her.present; },
    run: function* (S) {
      var m = S.man;
      S.look(m, 'camera');
      if (S.cursor.known && S.cursorNear(m, 40) && S.cursor.still > 0.5) {
        S.hold(m, { f: ['p_wave_a', 'p_wave_b'], fps: 5 }); S.face(m, 'smile');
        yield 1.4;
        return;
      }
      yield act(S, 'man_glance', 1.5, 'p_front', 'soft');
    } });

  // —— M28 看狗狗闹，笑一下 ——
  add({ name: 'man_chuckle', zh: '看狗狗闹，笑一下', cool: 30, mood: 'funny',
    weight: function (S) {
      for (var i = 0; i < GAGS.length; i++) if (S.playing(GAGS[i]) || S.last(GAGS[i]) < 3) return 8;
      return 0;
    },
    run: function* (S) {
      var m = S.man, d = S.dist(S.dax, m) < S.dist(S.gold, m) ? S.dax : S.gold;
      if (S.dist(d, m) > 150) return;
      S.faceTo(m, d); S.look(m, d);
      yield act(S, 'man_chuckle', 1.8, ['p_laugh', 'p_cheer'], 'laugh');
    } });

  // —— M29 哼歌点脚：一个音符，轻轻晃 ——
  add({ name: 'man_hum', zh: '哼歌点脚', weight: 2, cool: 300, mood: 'playful',
    run: function* (S) {
      var m = S.man;
      S.emote('note', m, m.face * 3, 1.0);
      var w = act(S, 'man_hum', 3.6, ['p_behind', 'p_idle'], 'whistle');
      yield 1.5;
      S.emote('note', m, m.face * 5, 1.0);
      yield w;
    } });

  // ============================================================
  //  他一个人的时候（骨架的独角戏）
  // ============================================================
  add({ name: 'man_pockets', zh: '手插兜晃一晃', weight: 2, cool: 150,
    run: function* (S) { yield act(S, 'pockets_rock', 4.0, ['p_behind', 'p_idle'], 'soft'); } });
  add({ name: 'man_hair', zh: '捋一下头发', weight: 2, cool: 200, mood: 'proud',
    run: function* (S) { yield act(S, 'hair_run', 2.4, 'p_tie_a', 'proud'); } });
  add({ name: 'man_cuffs', zh: '拉一拉袖口', weight: 2, cool: 200, mood: 'proud',
    run: function* (S) { yield act(S, 'cuffs', 2.5, ['p_dust', 'p_tie_b'], 'proud'); } });
  add({ name: 'man_phone', zh: '看手机，看着看着笑了', weight: 2, cool: 420, mood: 'tender',
    run: function* (S) {
      var m = S.man;
      S.ball.pocket();
      var w = act(S, 'phone_smile', 4.0, 'p_watch', 'soft');
      yield 2.6;
      if (S.chance(0.5)) S.emote('hs', m, 0, 1.0);
      yield w;
    } });
  add({ name: 'man_sky', zh: '抬头看天', weight: 2, cool: 300, mood: 'tender',
    run: function* (S) { S.look(S.man, { x: S.man.x + S.man.face * 20, y: S.man.y, z: 90 }); yield act(S, 'sky', 3.6, 'p_idle', 'soft'); } });
  add({ name: 'man_whistle', zh: '背着手吹口哨', weight: 2, cool: 300, mood: 'playful',
    run: function* (S) {
      var m = S.man, w = act(S, 'whistle', 3.6, ['p_behind', 'p_idle'], 'whistle');
      S.emote('note', m, m.face * 4, 0.9);
      yield 1.3;
      S.emote('note', m, m.face * 6, 0.9);
      yield w;
    } });
  add({ name: 'man_sit_grass', zh: '在草地上坐一会儿', weight: 2, cool: 400, mood: 'sleepy', tag: 'calm',
    when: function (S) { return !S.night(); },
    run: function* (S) { S.ball.pocket(); yield act(S, 'sit_grass', 6.0, 'p_sit', 'soft'); } });
  add({ name: 'man_lie_back', zh: '躺下枕着手，再起来', cool: 900, mood: 'sleepy', tag: 'calm',
    weight: function (S) { return S.time.h >= 13 && S.time.h < 17 ? 2 : 0.6; },
    run: function* (S) { S.ball.pocket(); yield act(S, 'lie_back', 8.5, 'p_sit', 'sleepy'); if (S.chance(0.5)) S.emote('z', S.man, 0, 1.2); } });
  add({ name: 'man_ball_spin', zh: '球在指尖上转', weight: 1.5, cool: 400, mood: 'proud',
    when: function (S) { return S.ball.inHand() && S.has(S.man, 'ball_spin'); },
    run: function* (S) { yield S.act(S.man, 'ball_spin', 3.4); } });
  add({ name: 'man_practice', zh: '空丢一下练手', weight: 1.5, cool: 300, mood: 'playful',
    when: function (S) { return S.ball.inHand() && S.has(S.man, 'practice_throw'); },
    run: function* (S) { yield S.act(S.man, 'practice_throw', 2.0); } });
  add({ name: 'man_lace', zh: '单膝跪下系鞋带', weight: 1, cool: 900,
    run: function* (S) { S.ball.pocket(); yield act(S, 'shoelace', 4.0, ['p_place', 'p_crouch'], 'focus'); } });
  add({ name: 'man_jog', zh: '原地小跑两下', cool: 600, mood: 'playful', tag: 'lively',
    weight: function (S) { return S.time.h >= 7 && S.time.h < 11 ? 2 : 0.5; },
    run: function* (S) { yield act(S, 'jog_spot', 3.8, 'p_walk1', 'focus'); } });
  // 偷偷跳两步：只在她没在看（没在玩）的时候
  add({ name: 'man_two_step', zh: '没人看的时候偷偷跳两步', weight: 1.5, cool: 600, mood: 'funny',
    when: function (S) { return !S.her.engaged && S.has(S.man, 'two_step'); },
    run: function* (S) {
      var m = S.man;
      S.emote('note', m, 0, 0.9);
      yield S.act(m, 'two_step', 4.2);
      // 跳完才发现鼠标就在旁边：脸红，假装整理领带
      if (S.cursor.known && S.cursorNear(m, 90)) { S.look(m, 'camera'); S.hold(m, 'p_tie_a'); S.face(m, 'blush'); yield 1.0; }
    } });
  add({ name: 'man_yawn', zh: '捂着嘴打个哈欠', cool: 900, mood: 'sleepy',
    weight: function (S) { var h = S.time.h; return (h >= 13 && h < 16) || h >= 22 ? 1.5 : 0.3; },
    run: function* (S) { yield act(S, 'yawn', 2.2, 'p_yawn', 'yawn'); } });
  add({ name: 'man_morning_stretch', zh: '两手举过头顶伸懒腰', cool: 900, mood: 'proud',
    weight: function (S) { var h = S.time.h; return h >= 6 && h < 11 ? 2 : 0.6; },
    run: function* (S) { S.ball.pocket(); yield act(S, 'stretch', 2.6, 'p_reach', 'proud'); } });
  add({ name: 'man_look_around', zh: '手搭凉棚找狗狗', cool: 240,
    weight: function (S) { return S.dist(S.dax, S.man) > 160 && S.dist(S.gold, S.man) > 160 ? 3 : 0; },
    run: function* (S) { yield act(S, 'look_around', 2.4, 'p_watch', 'focus'); } });
  add({ name: 'man_beckon', zh: '拍拍腿叫小腊肠过来', cool: 400, mood: 'playful',
    weight: function (S) { return S.dist(S.dax, S.man) > 120 ? 1.5 : 0; },
    run: function* (S) { S.faceTo(S.man, S.dax); S.look(S.man, S.dax); yield act(S, 'beckon', 2.0, ['p_call', 'p_idle'], 'whistle'); } });
  // 她在跟它们玩的时候，偶尔冲她竖个大拇指 / 鞠一小躬
  add({ name: 'man_thumbs_up', zh: '冲她竖大拇指', cool: 900, cap: 3, mood: 'proud',
    weight: function (S) { return S.her.engaged ? 1.5 : 0; },
    run: function* (S) { S.look(S.man, 'camera'); yield act(S, 'thumbs_up', 2.4, 'p_front', 'wink'); } });
  add({ name: 'man_little_bow', zh: '对她鞠一小躬', cool: 1200, cap: 2, mood: 'tender',
    weight: function (S) { return S.her.engaged ? 1 : 0; },
    run: function* (S) { S.look(S.man, 'camera'); yield act(S, 'bow', 2.4, ['p_bow', 'p_front'], 'smile'); } });
  add({ name: 'man_heart_hands', zh: '比个心（很少）', cool: 3600, cap: 1, mood: 'tender',
    weight: function (S) { return S.her.engaged && S.time.h >= 18 ? 1 : 0; },
    run: function* (S) { S.look(S.man, 'camera'); yield act(S, 'heart_hands', 2.8, ['p_heart', 'p_front'], 'blush'); S.emote('hs', S.man, 0, 1.0); } });

  // —— 领带歪了好一阵子（三分钟）她都没帮他正：他自己发现了，正一正（她帮他正的那段在 her.js）——
  add({ name: 'man_tie_notice', zh: '自己发现领带歪了', cool: 60,
    weight: function (S) { var t = S.mem.get('tie'); return t && S.time.ms - t > 180000 ? 10 : 0; },
    run: function* (S) {
      var m = S.man;
      S.mem.set('tie', 0);
      S.look(m, { x: m.x + m.face * 2, y: m.y, z: 20 }); S.face(m, 'surprised');
      yield 0.5;
      yield act(S, 'tie_fix', 2.4, 'p_tie_a', 'oops');
    } });
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
