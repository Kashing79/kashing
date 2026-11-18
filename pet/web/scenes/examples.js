// 球球 · 戏包：三段小例子（照着写新戏用；它们也真的会演）
//
//   ex_rub       她用鼠标在狗身上来回蹭：翻肚皮（"出了什么事才演"的 react：手势 rub）
//   ex_teatime   下午三点半：小人分一块饼干（定时的 react：手里的东西、掉到地上的道具）
//   ex_flower    金毛自己闻一朵小花、打喷嚏（solo：道具、骨架自己的小动作、留在草地上的小印子）
//
// 说明书在 pet.js 开头"怎么写一场戏"。
(function (G) {
  'use strict';
  var L = G.PET_SCENES = G.PET_SCENES || [];
  function add(r) { r.pack = 'examples'; L.push(r); }

  // —— 1. 她蹭它：翻过来露肚皮，她一直蹭就一直冒爱心；停手一秒它就坐起来 ——
  add({
    name: 'ex_rub', zh: '来回蹭着摸：翻肚皮', kind: 'react', on: 'rub', cast: 'dog', tag: 'hers', mood: 'tender', family: 'pet',
    when: function (S, ev) { return !!ev.who && ev.who !== S.man; },       // 只管狗（蹭小人的另写）
    run: function* (S) {
      var d = S.dog, quiet = 0, n = 0;
      S.mood(d, 'happy'); d.wag = 1; d.happy = 1;
      S.hold(d, 'roll');
      S.look(d, 'cursor');
      while (quiet < 1 && S.t() < 12) {                  // 有上限：最多 12 秒
        if (S.rubbing(d)) { quiet = 0; if (S.chance(0.45)) S.emote(n++ % 3 ? 'heart' : 'hs', d, S.rand(-5, 5)); }
        else quiet += 0.35;
        yield 0.35;
      }
      S.hold(d, 'sit'); d.happy = 0;
      S.emote('heart', d);
      yield 0.8;
    },
  });

  // —— 2. 三点半：他从口袋里摸出一块饼干，小腊肠坐好讨，他一不小心掉到地上，小腊肠一口吃掉 ——
  add({
    name: 'ex_teatime', zh: '下午三点半：分一块饼干', kind: 'react', on: 'minute', at: '15:30', cast: 'man dax',
    keep: 90, cap: 1, mood: 'playful', family: 'biscuit',
    run: function* (S) {
      var man = S.man, dax = S.dax;
      S.item(man, 'bone');                                // 手里拿着一块饼干（图的名字）
      S.hold(man, 'p_hold'); S.face(man, 'smile'); S.emote('note', man);
      S.say('tea');                                       // 设定里写了 lines.tea 才说话
      yield S.go(dax, S.atHand(dax), 'run');
      S.faceTo(dax, man); S.faceTo(man, dax);
      S.hold(dax, ['beg', 'sit']); dax.wag = 1; S.look(dax, man); S.look(man, dax);
      yield 1.2;
      // 掉了：变成地上的一个道具（从手边落下去，弹一下）
      var h = S.hand();
      S.item(man, null);
      var b = S.prop.spawn('bone', '', h.x, h.y, { z: h.z });
      S.prop.fling(b, 0, 0, 20);
      S.face(man, 'oops'); S.hold(man, 'p_crouch');
      yield 0.5;
      yield S.go(dax, S.beside(dax, b, 1), 'trot');
      S.faceTo(dax, b); S.hold(dax, 'sniff');
      yield 0.6;
      S.prop.remove(b, false);
      S.bits(b.x, b.y - 1, 5, 'kibble', 14, 30);
      S.emote('heart', dax); dax.happy = 1;
      S.face(man, 'laugh'); S.hold(man, { f: ['p_cheer', 'p_cheer2'], fps: 5 });
      yield 1.0;
      dax.happy = 0;
    },
    end: function (S, cancelled) {
      if (cancelled) S.emote('q', S.dax, 0, 0.8);         // 被打断了：引擎会收走饼干、放好每个人，这里只加个小表情
    },
  });

  // —— 3. 金毛低头闻一朵小花，打个喷嚏；小花留在草地上（画在她的窗口后面，第二天就没了）——
  add({
    name: 'ex_flower', zh: '闻一朵小花', kind: 'solo', cast: 'gold', weight: 2, cap: 3, tag: 'calm', mood: 'tender',
    when: function (S) { return !S.night(); },
    run: function* (S) {
      var d = S.me, x = d.x + d.face * (d.mx + 5), y = d.y + S.ry(2);
      if (!S.clear(x, y, 10)) return;                    // 地上有别的东西：这次不演
      var f = S.prop.spawn('bloom_y', '', x, y, { shadow: false });
      S.hold(d, 'sniff'); S.look(d, f); d.wag = 0.4;
      yield 1.6;
      yield S.act(d, 'sneeze', 1.2);                      // 骨架会打喷嚏就打；还不会就直接往下走
      S.emote('heart', d, d.face * 4);
      S.hold(d, 'sit'); S.look(d, null);
      yield 1.2;
      if (S.cfg.lawnMemories !== false) S.decal('bloom_y', x, y, { days: 1 });
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
