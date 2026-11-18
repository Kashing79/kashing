// 球球 · 胶水（一小段 JavaScript，和引擎跑在同一个环境里）
//
//   · 把外壳的几个函数（现在几秒了、帮我存一下、岛在哪……）包成引擎要的 host
//   · 每一帧：让引擎往前走，再把"该画什么"的清单压成一个一维数组，Swift 那边一次就能拿走
//   · 像素不跟着清单走：Swift 发现哪张图变了，才按编号来拿那一张的像素
//   · 引擎可有可无的功能（sense / setQuality / den / 草地）都先问有没有

import Foundation

extension PetEngine {
    static let shim = #"""
var __qq = (function (G) {
  'use strict';
  var eng = null, last = [], ids = new WeakMap(), nid = 0, lawnImg = null;

  function fin(v, d) { v = +v; return (v === v && v !== Infinity && v !== -Infinity) ? v : d; }
  // 每张图一个名字：有 key 的用 key；没有的（三个角色各自那一张）按"是不是同一个对象"编号
  function keyOf(im) {
    if (im.key) return 'k:' + im.key;
    var n = ids.get(im);
    if (!n) { n = ++nid; ids.set(im, n); }
    return '#' + n;
  }
  // 清单 → 接在 out 后面，每项 10 格：id、图的名字、ver、宽、高、scale、x、y、flip、a
  function flat(out, items) {
    var n = 0;
    last = [];
    for (var i = 0; items && i < items.length; i++) {
      var it = items[i], im = it && it.img;
      if (!im || !im.data || !(im.w > 0) || !(im.h > 0)) continue;
      var s = fin(im.scale, 1);
      last.push(im);
      out.push(String(it.id), keyOf(im), im.key ? 1 : (im.ver | 0), im.w | 0, im.h | 0, s > 0 ? s : 1,
               fin(it.x, 0), fin(it.y, 0), it.flip ? 1 : 0, (it.a === undefined || it.a === null) ? 1 : fin(it.a, 1));
      n++;
    }
    return n;
  }

  // 往前走 dt 秒（一小步最多 1/60 秒），再把这一帧压成：
  //   [几项, 几个可点范围, 在拖吗, 有气泡吗, 气泡的字, 气泡 x, 气泡 y, 气泡编号, home, busy, 清单……, 可点范围……]
  function frame(dt) {
    if (!eng) return null;
    dt = fin(dt, 0);
    if (dt > 0) {
      if (dt > 0.25) dt = 0.25;
      var n = Math.max(1, Math.ceil(dt * 60 - 1e-6));
      for (var i = 0; i < n; i++) eng.step(dt / n);
    }
    var f = eng.compose() || {}, st = eng.status() || {};
    var out = [0, 0, f.drag ? 1 : 0, 0, '', 0, 0, 0, String(st.home || 'out'), eng.busy() | 0];
    out[0] = flat(out, f.items);
    var hot = f.hot || [], nh = 0;
    for (var j = 0; j < hot.length; j++) {
      var h = hot[j];
      if (!h || h.length < 4) continue;
      out.push(fin(h[0], 0), fin(h[1], 0), fin(h[2], 0), fin(h[3], 0));
      nh++;
    }
    out[1] = nh;
    var b = f.bubble;
    if (b && b.text) {
      out[3] = 1; out[4] = String(b.text); out[5] = fin(b.x, 0); out[6] = fin(b.y, 0);
      out[7] = (b.id === undefined || b.id === null) ? 0 : (b.id | 0);
    }
    return out;
  }

  // 岛上那一小格：[宽, 高, 几项, 清单……]
  function den(R) {
    if (!eng || typeof eng.den !== 'function') return null;
    var d = eng.den(R);
    if (!d) return null;
    var out = [fin(d.w, 0), fin(d.h, 0), 0];
    out[2] = flat(out, d.items);
    return out;
  }

  function create(json) {
    var o = JSON.parse(json), cfg = {}, C = G.PET_CONFIG || {}, k;
    for (k in C) cfg[k] = C[k];
    for (k in o) cfg[k] = o[k];
    if (!G.PET_ENGINE || typeof G.PET_ENGINE.create !== 'function') return false;
    var host = {
      now: function () { return G.__qq_now(); },
      storage: {
        get: function (key) { var v = G.__qq_get(String(key)); return (v === undefined || v === null || v === '') ? null : String(v); },
        set: function (key, v) { G.__qq_set(String(key), String(v)); }
      },
      haptic: function (kind) { G.__qq_haptic(String(kind)); },
      island: {
        center: function () { return +G.__qq_islandCenter() || 0; },
        visible: function () { return !!G.__qq_islandVisible(); },
        hit: function (x, y) { return !!G.__qq_islandHit(+x || 0, +y || 0); }
      },
      log: function (msg) { G.__qq_log(String(msg)); }
    };
    eng = G.PET_ENGINE.create(host, cfg);
    return !!eng;
  }

  return {
    create: create,
    frame: frame,
    den: den,
    // 刚才那张清单里第 i 项的像素
    data: function (i) { var im = last[i]; return im ? im.data : null; },
    configure: function (json) { if (eng) eng.configure(JSON.parse(json)); },
    sense: function (json) { if (eng && typeof eng.sense === 'function') eng.sense(JSON.parse(json)); },
    command: function (name) { if (eng) eng.command(String(name)); },
    pointer: function (type, x, y) { return (eng && eng.pointer(String(type), +x || 0, +y || 0)) ? true : false; },
    status: function () { return eng ? JSON.stringify(eng.status() || {}) : '{}'; },
    quality: function (q) { if (eng && typeof eng.setQuality === 'function') eng.setQuality(+q); },
    state: function () {
      if (!eng) return 'null';
      return JSON.stringify((eng._t && typeof eng._t.state === 'function') ? eng._t.state() : eng.status());
    },
    extra: function () {
      var o = {}, t = eng && eng._t;
      if (t && typeof t.perf === 'function') o.rigs = t.perf();
      if (t && typeof t.errors === 'function') o.artErrors = t.errors();
      return JSON.stringify(o);
    },
    // 草地：先画，返回 [宽, 高, scale]；像素另外拿（拿完就放手，不占着内存）
    lawn: function (w, h, phase, R, mode) {
      var L = G.PET_LAWN;
      lawnImg = null;
      if (!L || typeof L.render !== 'function') return null;
      var im = L.render(w, h, String(phase), R, { mode: String(mode) });
      if (!im || !im.data || !(im.w > 0) || !(im.h > 0)) return null;
      lawnImg = im;
      return [im.w | 0, im.h | 0, fin(im.scale, R)];
    },
    lawnData: function () { var d = lawnImg ? lawnImg.data : null; lawnImg = null; return d; },
    has: function () {
      var C = G.PET_CONFIG || {}, r = Math.round(+C.res);
      return JSON.stringify({
        engine: !!(G.PET_ENGINE && typeof G.PET_ENGINE.create === 'function'),
        created: !!eng,
        sense: !!(eng && typeof eng.sense === 'function'),
        quality: !!(eng && typeof eng.setQuality === 'function'),
        den: !!(eng && typeof eng.den === 'function'),
        lawn: !!(G.PET_LAWN && typeof G.PET_LAWN.render === 'function'),
        person: !!(G.PET_PERSON && typeof G.PET_PERSON.create === 'function'),
        fx: !!G.PET_FX,
        dogs: !!G.PET_DOGS,
        res: (r >= 1 && r <= 4) ? r : 2,
        clock: (C.clock && C.clock.length) ? C.clock : null,
        reunion: C.reunion ? String(C.reunion) : null
      });
    },
    // 空转三百万圈：开了"即时编译"十几毫秒就转完，没开要一百多毫秒
    probe: function () { var s = 0; for (var k = 0; k < 3000000; k++) { s = (s + k * 7) % 1000003; } return s; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
"""#
}
