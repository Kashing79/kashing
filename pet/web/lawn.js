// ============================================================
//  草地（PET_LAWN）
//
//  整张草地按画面大小一次画好，不用小块拼接，所以看不出重复。画法分四层：
//    1. 底色：一道道很淡的割草纹（微微斜着），上面叠几片更淡的深浅（像云影），
//       左上亮、右下暗（光从左上来）
//    2. 深浅交界的地方画成一撮撮草尖，不是光滑的"水渍"
//    3. 稀稀地撒草叶和草丛（颜色跟着脚下那一片的深浅走，所以哪里都不扎眼；有的地方密一点，有的地方空着）
//    4. 更稀：三叶草、几朵凑在一起的小花；偶尔一片落叶、几朵小蘑菇、一颗小石子、一只瓢虫，
//       整片草地还藏着一棵四叶草
//  白天 / 傍晚 / 夜里只换颜色，不换形状。同一个 seed 画出来永远一样。
//
//  这个文件不碰网页的任何东西，在 Mac 外壳的 JavaScriptCore 里也能直接跑。
//  所有小图案都是按"一个世界单位 2 个像素"（R = 2）一格一格画的：
//    R = 1、3 时照样一格一个像素（东西会显得大一些 / 小一些）；R = 4 时整张按 R = 2 画好再放大一倍。
// ============================================================
(function (G) {
  'use strict';

  var PHASES = ['day', 'dusk', 'night'];
  var STRIP_H = 26;          // strip 模式：草带大约多高（世界单位）
  var SLOPE = 0.06;          // 割草纹斜多少（每往右 1，往上 0.06）
  var BAND_H = 30;           // 一道割草纹多宽（世界单位）
  var BAND_STEP = 2;         // 相邻两道差几级颜色（一级很淡，两级刚好看得出）
  var LIGHT = 2.6;           // 左上比右下亮多少（0 = 一样亮）
  var SHARE = [0.05, 0.12, 0.2, 0.26, 0.2, 0.12, 0.05];     // 云影分七级，每级占多少面积：两头的少，中间的多
  var floor = Math.floor, round = Math.round, imul = Math.imul;

  // ---------- 颜色 ----------
  function rgb(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
  function hexOf(c) {
    return '#' + [0, 1, 2].map(function (i) { return ('0' + Math.max(0, Math.min(255, round(c[i]))).toString(16)).slice(-2); }).join('');
  }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  // 草的五个定位色：最深（草根的影子）、暗、本色、亮、叶尖。暗的偏青蓝，亮的偏黄。
  var GRASS = {
    day:   ['#2b5a47', '#478a60', '#5a9d60', '#6fae5c', '#9ccc66'],
    dusk:  ['#2a3046', '#41665a', '#527d58', '#6e9058', '#c2b466'],
    night: ['#10121c', '#1a292e', '#213836', '#2b453c', '#466151'],
  };
  // 三叶草比草偏青一点：暗、本色、亮
  var CLOVER = {
    day:   ['#3d8560', '#52a068', '#74c07e'],
    dusk:  ['#3c6a5c', '#4f8468', '#7aa67a'],
    night: ['#182b30', '#234541', '#34594c'],
  };
  // 别的小东西只写白天的颜色，傍晚 / 夜里由 grade() 统一压暗、调色。
  // 字母不能和草用的那几个（t l m n e d r s）重复。
  var THINGS = {
    w: '#f7f5e9', v: '#b4b9d0',        // 白花瓣、背光的一面
    y: '#fadb5f', u: '#d6a04e',        // 黄花瓣
    p: '#faa0b6', q: '#c77798',        // 粉花瓣
    b: '#a9c4f5', c: '#7088cf',        // 蓝花瓣
    o: '#f2a93a',                      // 花心
    1: '#ee9063', 2: '#cf5a40', 3: '#8f3530',     // 红蘑菇：亮、本色、暗
    4: '#e3b77e', 5: '#c08a55', 6: '#8a5a3a',     // 褐蘑菇
    7: '#f6ecd4', 8: '#c9b594', 9: '#fbf3e4',     // 蘑菇柄：亮、暗；伞上的白点
    G: '#cdd0cf', g: '#9aa0a8', h: '#666b82',     // 石子：亮、本色、暗
    A: '#f0cb72', a: '#d9a441', i: '#a56c2e',     // 落叶（赭黄）
    B: '#e89a62', j: '#c96b3c', z: '#8f4530',     // 落叶（橘红）
    X: '#e0483c', x: '#2a1f2d',                   // 瓢虫
    E: '#e9dca2', F: '#b9a86e',                   // 草穗
  };
  function grade(c, phase) {
    if (phase === 'dusk') return [c[0] * 0.88 + 6, c[1] * 0.80 + 6, c[2] * 0.80 + 14];
    if (phase === 'night') {
      var l = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
      var r = c[0] * 0.45 + l * 0.55, g = c[1] * 0.45 + l * 0.55, b = c[2] * 0.45 + l * 0.55;
      return [r * 0.50 + 4, g * 0.57 + 8, b * 0.66 + 18];
    }
    return c;
  }

  // 调色盘里的编号：
  //   1..25  草，从最深到叶尖，一共 25 级（7 = 暗，13 = 本色，19 = 亮，25 = 叶尖）
  //   31..55 三叶草，同样 25 级
  //   64 起  别的小东西
  var NG = 25, BASE = 13, CL0 = 30, T0 = 64;
  var TN = Object.keys(THINGS), T = {};
  TN.forEach(function (k, i) { T[k] = T0 + i; });

  var little = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
  function pack(c) {
    var r = Math.max(0, Math.min(255, round(c[0]))), g = Math.max(0, Math.min(255, round(c[1]))), b = Math.max(0, Math.min(255, round(c[2])));
    return little ? ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0 : ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0;
  }
  var palCache = {};
  function paletteOf(phase) {
    if (PHASES.indexOf(phase) < 0) phase = 'day';
    var p = palCache[phase];
    if (p) return p;
    var a = GRASS[phase].map(rgb), cl = CLOVER[phase].map(rgb), cols = [], i;
    for (i = 1; i <= NG; i++) {
      var t = (i - 1) / 6, seg = Math.min(3, floor(t));
      cols[i] = mix(a[seg], a[seg + 1], t - seg);
      var u = (i - 1) / (NG - 1);
      cols[CL0 + i] = u < 0.5 ? mix(cl[0], cl[1], u * 2) : mix(cl[1], cl[2], u * 2 - 1);
    }
    TN.forEach(function (name) { cols[T[name]] = grade(rgb(THINGS[name]), phase); });
    var lut = new Uint32Array(256);
    for (i = 1; i < cols.length; i++) if (cols[i]) lut[i] = pack(cols[i]);
    p = palCache[phase] = { phase: phase, cols: cols, lut: lut };
    return p;
  }
  // 给别人用的：这个时段草地的几个颜色（"#rrggbb"）
  function palette(phase) {
    var p = paletteOf(phase), c = p.cols;
    return {
      phase: p.phase, deep: hexOf(c[1]), dark: hexOf(c[7]), base: hexOf(c[13]), light: hexOf(c[19]), tip: hexOf(c[25]),
      bits: [hexOf(c[22]), hexOf(c[16]), hexOf(c[9])],           // 被刨起来、踢起来的草屑用这几个颜色
      flowers: [hexOf(c[T.w]), hexOf(c[T.y]), hexOf(c[T.p]), hexOf(c[T.b])],
    };
  }

  // ---------- 随机数（自己的，所以同一个 seed 永远一样）----------
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = imul(s ^ (s >>> 15), 1 | s);
      t = (t + imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // 由坐标算出来的"随机"整数（不占用上面那串随机数）
  function hash(x, y, s) {
    var h = imul(x, 73856093) ^ imul(y, 19349663) ^ imul(s, 83492791);
    h = imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = imul(h ^ (h >>> 12), 0x297a2d39);
    return (h ^ (h >>> 15)) >>> 0;
  }

  // 均匀又不扎堆地撒点：任意两点至少隔 r。返回 [x0, y0, x1, y1, ...]
  function scatter(w, h, r, rnd) {
    var pts = [];
    if (w <= 0 || h <= 0) return pts;
    var cell = r / Math.SQRT2, gw = Math.ceil(w / cell), gh = Math.ceil(h / cell);
    var grid = new Int32Array(gw * gh), act = [], n = 0, i;
    for (i = 0; i < grid.length; i++) grid[i] = -1;
    function add(x, y) { grid[((y / cell) | 0) * gw + ((x / cell) | 0)] = n; act.push(n); pts.push(x, y); n++; }
    add(rnd() * w, rnd() * h);
    var r2 = r * r;
    while (act.length) {
      var ai = (rnd() * act.length) | 0, pi = act[ai], px = pts[pi * 2], py = pts[pi * 2 + 1], ok = false;
      for (var t = 0; t < 10 && !ok; t++) {
        var a = rnd() * 6.2832, d = r * (1 + rnd()), x = px + Math.cos(a) * d, y = py + Math.sin(a) * d;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        var gx = (x / cell) | 0, gy = (y / cell) | 0, good = true;
        var y0 = gy > 2 ? gy - 2 : 0, y1 = gy + 2 < gh ? gy + 2 : gh - 1, x0 = gx > 2 ? gx - 2 : 0, x1 = gx + 2 < gw ? gx + 2 : gw - 1;
        for (var yy = y0; yy <= y1 && good; yy++) {
          for (var xx = x0; xx <= x1; xx++) {
            var q = grid[yy * gw + xx];
            if (q >= 0) { var dx = pts[q * 2] - x, dy = pts[q * 2 + 1] - y; if (dx * dx + dy * dy < r2) { good = false; break; } }
          }
        }
        if (good) { add(x, y); ok = true; }
      }
      if (!ok) { act[ai] = act[act.length - 1]; act.pop(); }
    }
    return pts;
  }

  // 一层平滑的随机起伏：每个格点一个随机数，中间平滑过渡。shear = 每往下一行，整层往旁边错开多少（让花纹不那么横平竖直）
  function layer(W, H, cw, ch, shear, rnd) {
    var sh = Math.abs(shear) * H, gw = Math.ceil((W + sh) / cw) + 3, gh = Math.ceil(H / ch) + 2, g = new Float32Array(gw * gh), i;
    for (i = 0; i < g.length; i++) g[i] = rnd();
    return { g: g, gw: gw, cw: cw, ch: ch, shear: shear, off: shear < 0 ? sh : 0, row: new Float32Array(gw), ix: new Int32Array(W), tx: new Float32Array(W) };
  }
  function layerRow(L, y, W) {       // 准备第 y 行：上下两排格点先混好，再算出每一列落在哪一格
    var f = y / L.ch, k = floor(f), t = f - k, g = L.g, gw = L.gw, row = L.row, o = k * gw, i;
    t = t * t * (3 - 2 * t);
    for (i = 0; i < gw; i++) row[i] = g[o + i] + (g[o + gw + i] - g[o + i]) * t;
    var x0 = (L.off + y * L.shear) / L.cw, dx = 1 / L.cw, ix = L.ix, tx = L.tx;
    for (i = 0; i < W; i++) { var fx = x0 + i * dx, kx = fx | 0, u = fx - kx; ix[i] = kx; tx[i] = u * u * (3 - 2 * u); }
  }

  // ---------- 小图案（R = 2 时一个字符一个像素）----------
  // 草的颜色都是"相对脚下那一片"的：t 叶尖 l 亮叶 m 叶（草丛用）；n 叶尖 e 叶（零散的草叶用，淡一些）；
  // d 草缝里的暗 r 草根 s 落在草上的影子
  var REL = { t: 10, l: 7, m: 4, n: 8, e: 4, d: -3, r: -5, s: -4 };
  // 草叶：一两根，很淡，到处都有
  var TICKS = [
    ['n', 'e'],
    ['n.', 'e.', 'ed'],
    ['n.n', 'e.e', '.d.'],
    ['n..', '.e.', '.ed'],
    ['..n', 'n.e', 'e.e', '.d.'],
    ['n.n', '.e.'],
    ['.n..', 'n.e.', 'e.ed'],
    ['e', 'e'],
    ['e.', '.e'],
  ];
  // 草丛：少，稍微显眼一点，几根草叶从一个根上散开
  var TUFTS = [
    ['t..t..t', '.l.l.m.', '..llm..', '..drd..'],
    ['.t.t.t.', 't.llm.t', '.lllmm.', '..drd..'],
    ['..t..', 't.l.t', '.llm.', '..r..'],
    ['t...', 'l.t.', '.lm.', '.dr.'],
    ['..t...', '..l..t', 't.l.m.', '.llm..', '.drd..'],
    ['t.t.t', '.lmm.', '..r..'],
  ];
  // 小花（每种：常见的小朵、小朵的另一个样子、少见的大朵），下面压一小条影子
  var FLOWERS = [
    [['.w.', 'wov', '.v.', '.ss'], ['.w.', 'wov', '.v.', '.ss'], ['..w..', '.www.', 'wwovv', '.wvv.', '..v..', '..ss.']],
    [['.y.', 'you', '.u.', '.ss'], ['.y.', 'you', '.u.', '.ss'], ['.yy.', 'yoou', 'yoou', '.uu.', '.sss']],
    [['.p.', 'poq', '.q.', '.ss'], ['.p.', 'poq', '.q.', '.ss'], ['..p..', '.ppp.', 'ppoqq', '.pqq.', '..q..', '..ss.']],
    [['.b.', 'boc', '.c.', '.ss'], ['bc', '.s'], ['b.', 'cc']],
  ];
  var BLOOM = ['ww.', 'wq.', '.ss'];                                     // 三叶草开的小白花
  var SHROOMS = [
    [['..122..', '.19222.', '1222923', '.33333.', '..778..', '..778ss'], ['.12.', '1223', '.78s']],     // 红的
    [['..455..', '.44555.', '4555556', '.66666.', '..778..', '..778ss'], ['.45.', '4556', '.78s']],     // 褐的
  ];
  var ROCKS = [['.GGg..', 'Ggggh.', 'ggghhs', '.hhhss'], ['.Gg.', 'Gghs', '.hss'], ['..GGg...', '.GGgggh.', 'Ggggghhs', '.ghhhhss', '...sssss']];
  var LEAVES = [['....A.', '...AAa', '..AAai', '.AAais', '.Aaiss', 'i.sss.'], ['.A....', 'AAa...', 'AAai..', '.Aaai.', '..aiis', '...ssi'], ['..Aa', '.Aai', '.ais', 'i.s.']];
  var BUG = ['.XX.', 'xXxX', '.XXs'];                                    // 瓢虫：头朝左，背上一个黑点
  var LUCKY = ['.ll.mm.', 'lll.mmm', 'lll.mmm', '...d...', 'mmm.mmm', 'mmm.mmm', '.mmdmm.'];       // 四叶草，整片草地只有一棵
  var TREFOILS = [['.l.', 'mdm'], ['.l.', 'mdm'], ['l.m', '.d.'], ['.ll..', '.ll..', 'lldmm', 'll.mm'], ['..ll.', '..ll.', 'lldmm', 'll.mm']];
  // 草带上沿探出头的小花和草穗（最下面一行是根，贴着草带的上沿）
  var EDGE_STEMS = [
    ['.w.', 'wov', '.v.', '.m.', '.m.', 'lm.', '.m.', '.m.'],
    ['.y.', 'you', '.u.', '.m.', '.ml', '.m.', '.m.'],
    ['.p.', 'poq', '.q.', '.m.', 'lm.', '.m.'],
    ['.E.', '.EF', '.E.', '.EF', '.m.', '.m.', '.m.', '.m.'],
    ['E..', 'EF.', 'E..', '.m.', '.m.', '.m.'],
  ];
  // 草尖的高矮（一段 8 个像素）：交界线上看起来是一小撮一小撮的草
  var TEETH = [[0, 1, 2, 1, 0, 0, 1, 0], [0, 0, 1, 3, 1, 0, 0, 2], [1, 0, 0, 2, 1, 0, 1, 0], [0, 2, 0, 0, 1, 2, 1, 0], [0, 0, 0, 1, 0, 3, 1, 0], [1, 2, 0, 1, 0, 0, 2, 0], [0, 1, 0, 0, 2, 0, 0, 1]];
  function recolor(rows) { return rows.map(function (r) { return r.replace(/A/g, 'B').replace(/a/g, 'j').replace(/i/g, 'z'); }); }

  // ============================================================
  //  画
  // ============================================================
  function render(wWu, hWu, phase, R, opts) {
    opts = opts || {};
    R = Math.max(1, Math.min(8, round(+R || 2)));
    var W = Math.max(1, round(wWu * R)), H = Math.max(1, round(hWu * R));
    if (R >= 4) return doubled(wWu, hWu, phase, R, opts, W, H);
    var seed = (opts.seed === undefined || opts.seed === null ? 20261118 : opts.seed) >>> 0;
    var strip = opts.mode === 'strip';
    var pal = paletteOf(phase), lut = pal.lut;
    var data = new Uint8ClampedArray(W * H * 4), out = new Uint32Array(data.buffer);
    var g = new Uint8Array(W * H);        // 先存起伏的高低，后来存"这一格底色是第几级"；最高位 = 这里已经放了东西
    var rnd = rng(seed), x, y, i, j, k, o;

    // ---- strip：草带的上沿（每一列草从第几行开始）----
    var top = null, y0 = 0;
    if (strip) {
      top = new Int16Array(W);
      var bandPx = Math.max(1, Math.min(H - Math.min(H - 1, 6 * R), round(STRIP_H * R))), e1 = rng(seed ^ 0x51ab), e = [], e2 = [];
      for (i = 0; i < Math.ceil(W / (11 * R)) + 4; i++) { e.push(e1()); e2.push(e1()); }
      y0 = H;
      for (x = 0; x < W; x++) {
        var fa = x / (36 * R), ka = floor(fa), ta = fa - ka; ta = ta * ta * (3 - 2 * ta);
        var fb = x / (11 * R), kb = floor(fb), tb = fb - kb; tb = tb * tb * (3 - 2 * tb);
        var und = (e[ka] + (e[ka + 1] - e[ka]) * ta - 0.5) * 3.0 + (e2[kb] + (e2[kb + 1] - e2[kb]) * tb - 0.5) * 1.0;
        top[x] = Math.max(0, H - bandPx + round(und * R));
        if (top[x] < y0) y0 = top[x];
      }
    }

    // ---- 1. 底色的起伏 ----
    // 割草纹和深浅都顺着同一个方向微微斜着：先在"摆正了的坐标"里一行行算好，再按斜度错开来取
    var slope = SLOPE, FH = H + Math.ceil(W * Math.abs(slope)) + 2;
    // 三层起伏：大的管"哪一片亮哪一片暗"，小的让边缘不那么圆。都是横向拉长的（顺着割草的方向）
    var L1 = layer(W, FH, 170 * R, 50 * R, 0.2, rnd), L2 = layer(W, FH, 70 * R, 22 * R, -0.3, rnd), L3 = layer(W, FH, 17 * R, 8 * R, 0.1, rnd);
    var w1 = 0.58, w2 = 0.30, w3 = 0.12;
    var bandH = BAND_H * R, bandS = BAND_STEP, wob = 0.15;
    var lgA = LIGHT;
    var fld = new Uint8Array(W * FH);
    var hist = new Uint32Array(128), cnt = 0;
    for (y = y0; y < FH; y++) {               // strip 模式只有底下那一条要算
      layerRow(L1, y, W); layerRow(L2, y, W); layerRow(L3, y, W);
      var r1 = L1.row, r2 = L2.row, r3 = L3.row, i1 = L1.ix, i2 = L2.ix, i3 = L3.ix, t1 = L1.tx, t2 = L2.tx, t3 = L3.tx;
      var bq = y / bandH;
      o = y * W;
      for (x = 0; x < W; x++) {
        var a1 = r1[i1[x]], a2 = r2[i2[x]], a3 = r3[i3[x]];
        var v2 = a2 + (r2[i2[x] + 1] - a2) * t2[x];
        var v = w1 * (a1 + (r1[i1[x] + 1] - a1) * t1[x]) + w2 * v2 + w3 * (a3 + (r3[i3[x] + 1] - a3) * t3[x]);
        var bc = bq + (v2 - 0.5) * wob;                              // 割草纹：一道亮一道暗，边缘跟着起伏晃一晃
        var f = ((v - 0.5) * 230 + 64) | 0;
        if (f < 0) f = 0; else if (f > 127) f = 127;
        fld[o + x] = (f << 1) | ((bc | 0) & 1);
      }
    }
    // 光从左上来：左上亮一点，右下暗一点
    var sh0 = slope < 0 ? Math.ceil(W * -slope) : 0;
    for (y = y0; y < H; y++) {
      o = y * W;
      var lgy = (0.5 - y / H) * 16 * lgA;
      for (x = 0; x < W; x++) {
        if (top && y < top[x]) continue;
        var fv = fld[(y + sh0 + ((x * slope) | 0)) * W + x];
        var ff = (fv >> 1) + (((0.5 - x / W) * 23 * lgA + lgy) | 0);
        if (ff < 0) ff = 0; else if (ff > 127) ff = 127;
        hist[ff]++; cnt++;
        g[o + x] = (ff << 1) | (fv & 1);
      }
    }
    // 按面积分成几级：两头的少，中间的多
    var share = SHARE, NL = share.length, lev = new Uint8Array(128), acc = 0, cum = 0, li = 0;
    var lo = BASE - ((NL - 1) >> 1);
    for (i = 0; i < 128; i++) {
      while (li < NL - 1 && cum >= (acc + share[li]) * cnt) { acc += share[li]; li++; }
      lev[i] = lo + li; cum += hist[i];
    }
    for (y = y0; y < H; y++) {
      o = y * W;
      for (x = 0; x < W; x++) {
        if (top && y < top[x]) { g[o + x] = 0; continue; }
        var gv = g[o + x];
        g[o + x] = lev[gv >> 1] + (gv & 1) * bandS;
      }
    }

    // ---- 2. 深浅交界处：下面那一片的草尖一撮一撮地伸进上面那一片 ----
    for (y = y0 + 3; y < H; y++) {
      o = y * W;
      var salt = y >> 3;
      for (x = 0; x < W; x++) {
        var c0 = g[o + x], cu = g[o + x - W];
        if (c0 === cu || !c0 || !cu) continue;
        var th = TEETH[hash(x >> 3, salt, seed) % TEETH.length][x & 7];
        for (k = 1; k <= th; k++) { if (!g[o + x - k * W]) break; g[o + x - k * W] = c0; }
      }
    }
    for (i = 0; i < W * H; i++) out[i] = lut[g[i]];

    // ---- 画小东西用的几个小工具 ----
    function loc(px, py) { return g[py * W + px] & 127; }                 // 这一格的底色是第几级（0 = 没有草）
    function rel(l, d) { var c = l + d; return c < 1 ? 1 : (c > NG ? NG : c); }
    function P(px, py, c) { if (px >= 0 && py >= 0 && px < W && py < H && g[py * W + px]) out[py * W + px] = lut[c]; }
    // 这一块（外加一圈空隙）是不是还空着、而且整块都在草上
    function free(px, py, w, h) {
      if (px < 1 || py < 1 || px + w >= W - 1 || py + h >= H - 1) return false;
      for (var j = -1; j <= h; j++) for (var k = -1; k <= w; k++) { var gg = g[(py + j) * W + px + k]; if (!gg || (gg & 128)) return false; }
      return true;
    }
    function take(px, py, w, h) { for (var j = -1; j <= h; j++) for (var k = -1; k <= w; k++) g[(py + j) * W + px + k] |= 128; }
    // 把一个小图案盖上去。草的颜色（REL 里的字母）按脚下的深浅算；cl = 用三叶草的颜色。
    // flip = 左右镜像（只给草叶、草丛用：镜像以后亮的那几根还是在左边；有明暗、有影子的小东西不镜像，光才不会乱）
    function stamp(rows, px, py, flip, cl) {
      var h = rows.length, w = rows[0].length;
      if (!free(px, py, w, h)) return false;
      var l0 = loc(px + (w >> 1), py + h - 1);
      for (var j = 0; j < h; j++) {
        var row = rows[j];
        for (var k = 0; k < w; k++) {
          var ch = row[flip ? w - 1 - k : k];
          if (ch === '.') continue;
          if (flip) ch = ch === 'l' ? 'm' : (ch === 'm' ? 'l' : ch);
          var d = REL[ch];
          P(px + k, py + j, d !== undefined ? (cl && d > -4 ? CL0 : 0) + rel(l0, d) : T[ch]);
        }
      }
      take(px, py, w, h);
      return true;
    }
    // 这一带的草长得密不密（0..1，变化很慢）
    function lush(px, py) {
      var fx = px / (30 * R), fy = py / (18 * R), kx = floor(fx), ky = floor(fy), ux = fx - kx, uy = fy - ky;
      ux = ux * ux * (3 - 2 * ux); uy = uy * uy * (3 - 2 * uy);
      var a = (hash(kx, ky, seed + 77) & 255), b = (hash(kx + 1, ky, seed + 77) & 255), c = (hash(kx, ky + 1, seed + 77) & 255), d = (hash(kx + 1, ky + 1, seed + 77) & 255);
      return ((a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy) / 255;
    }

    var AW = W, AH = H - y0, area = AW * AH / (R * R);     // 草地的面积（世界单位）
    var dens = R === 1 ? 0.6 : 1;                           // R = 1 时图案显得大，就少撒一些
    var pts, px, py;

    if (opts.mode === 'kit') {            // 开发用：把所有小图案排成一排排，方便放大了看
      var kx = 6, ky = 10, rowH = 0;
      var putK = function (rows, cl) { if (kx + rows[0].length + 4 > W) { kx = 6; ky += rowH + 4; rowH = 0; } stamp(rows, kx, ky, false, cl); kx += rows[0].length + 4; if (rows.length > rowH) rowH = rows.length; };
      TICKS.forEach(function (s) { putK(s); }); TUFTS.forEach(function (s) { putK(s); });
      TREFOILS.forEach(function (s) { putK(s, true); }); putK(LUCKY, true); putK(BLOOM);
      FLOWERS.forEach(function (fs) { fs.forEach(function (s) { putK(s); }); });
      SHROOMS.forEach(function (ss) { ss.forEach(function (s) { putK(s); }); }); ROCKS.forEach(function (s) { putK(s); });
      LEAVES.forEach(function (s) { putK(s); }); putK(recolor(LEAVES[0])); putK(BUG);
      EDGE_STEMS.forEach(function (s) { putK(s); });
      return { w: W, h: H, data: data, scale: R, ox: 0, oy: 0, key: null, ver: 1 };
    }

    // ---- 4a. 零星的小东西（先放，占好位置）----
    var r4 = rng(seed ^ 0x7f4a7c15);
    if (area > 6000) {
      pts = scatter(AW, AH, 150 * R, r4);
      for (i = 0; i < pts.length; i += 2) if (r4() < 0.5) stamp(ROCKS[(r4() * ROCKS.length) | 0], pts[i] | 0, y0 + (pts[i + 1] | 0));
      pts = scatter(AW, AH, 205 * R, r4);
      for (i = 0; i < pts.length; i += 2) {
        if (r4() > 0.55) continue;
        px = pts[i] | 0; py = y0 + (pts[i + 1] | 0);
        var ms = SHROOMS[r4() < 0.6 ? 0 : 1], fl = r4() < 0.5;        // 一朵大的，旁边一两朵小的
        if (stamp(ms[0], px, py)) {
          stamp(ms[1], px + (fl ? -6 : 9), py + 3);
          if (r4() < 0.5) stamp(ms[1], px + (fl ? 9 : -6), py + 4);
        }
      }
      pts = scatter(AW, AH, 120 * R, r4);
      for (i = 0; i < pts.length; i += 2) {
        if (r4() > 0.6) continue;
        var lf = LEAVES[(r4() * LEAVES.length) | 0];
        stamp(r4() < 0.5 ? recolor(lf) : lf, pts[i] | 0, y0 + (pts[i + 1] | 0));
      }
      if (!strip && phase !== 'night') stamp(BUG, (W * (0.2 + r4() * 0.6)) | 0, (H * (0.25 + r4() * 0.5)) | 0);
    }

    // ---- 4b. 小花：几朵凑成一小片 ----
    var r5 = rng(seed ^ 0x3c6ef372);
    pts = scatter(AW, AH, (strip ? 40 : 62) * R, r5);
    for (i = 0; i < pts.length; i += 2) {
      if (r5() > (strip ? 0.55 : 0.5) * dens) continue;
      var kind = (r5() * 4) | 0, nf = 3 + ((r5() * 5) | 0), spread = 4 + nf * 1.1;
      for (j = 0; j < nf; j++) {
        var an = r5() * 6.2832, di = (1.5 + r5() * spread) * R;
        px = (pts[i] + Math.cos(an) * di) | 0; py = y0 + ((pts[i + 1] + Math.sin(an) * di * 0.6) | 0);
        var fs = FLOWERS[kind], pick = r5();
        stamp(fs[pick < 0.5 ? 0 : (pick < 0.88 ? 1 : 2)], px, py);
      }
    }

    // ---- 4c. 三叶草：一小丛一小丛，偶尔开一两朵小白花 ----
    var r6 = rng(seed ^ 0x9e3779b9), lucky = -1;
    pts = scatter(AW, AH, (strip ? 52 : 84) * R, r6);
    if (!strip && pts.length) lucky = (r6() * (pts.length >> 1)) | 0;
    for (i = 0; i < pts.length; i += 2) {
      var isLucky = (i >> 1) === lucky;
      if (r6() > 0.55 * dens && !isLucky) continue;
      var rx = (5 + r6() * 6) * R, ry = (3 + r6() * 3) * R, want = 6 + ((r6() * 9) | 0), made = 0;
      if (isLucky && stamp(LUCKY, pts[i] | 0, y0 + (pts[i + 1] | 0), false, true)) made++;
      for (j = 0; j < want * 3 && made < want; j++) {
        var an2 = r6() * 6.2832, dr = Math.sqrt(r6());
        px = (pts[i] + Math.cos(an2) * dr * rx) | 0; py = y0 + ((pts[i + 1] + Math.sin(an2) * dr * ry) | 0);
        if (stamp(TREFOILS[(r6() * TREFOILS.length) | 0], px, py, false, true)) made++;
      }
      if (made >= 4 && r6() < 0.7) {
        var nb = 1 + ((r6() * 2) | 0);
        for (j = 0; j < nb; j++) stamp(BLOOM, (pts[i] + (r6() - 0.5) * rx * 1.3) | 0, y0 + ((pts[i + 1] + (r6() - 0.5) * ry * 1.3) | 0), false);
      }
    }

    // ---- 3. 草丛（少）和草叶（多）：有的地方密，有的地方空 ----
    var r7 = rng(seed ^ 0x1b873593);
    pts = scatter(AW, AH, 17 * R, r7);
    for (i = 0; i < pts.length; i += 2) {
      px = pts[i] | 0; py = y0 + (pts[i + 1] | 0);
      if (r7() < (0.15 + 0.85 * lush(px, py)) * 0.8 * dens) stamp(TUFTS[(r7() * TUFTS.length) | 0], px, py, r7() < 0.5);
    }
    pts = scatter(AW, AH, 5.2 * R, r7);
    for (i = 0; i < pts.length; i += 2) {
      px = pts[i] | 0; py = y0 + (pts[i + 1] | 0);
      var lu = lush(px, py);
      if (r7() < (0.07 + 0.9 * lu * lu) * dens) stamp(TICKS[(r7() * TICKS.length) | 0], px, py, r7() < 0.5);
    }

    // ---- strip：上沿长出高高低低的草，偶尔探出一朵花、一根草穗 ----
    if (strip) fringe();
    function fringe() {
      var r8 = rng(seed ^ 0x85ebca6b), x, k;
      function fpx(xx, yy, c) { if (xx >= 0 && xx < W && yy >= 0 && yy < H) { out[yy * W + xx] = lut[c]; if (!g[yy * W + xx]) g[yy * W + xx] = 1; } }
      function lvl(xx) { xx = xx < 0 ? 0 : (xx >= W ? W - 1 : xx); return (g[Math.min(H - 1, top[xx] + 1) * W + xx] & 127) || BASE; }
      // 盖一个根在 (bx, top) 的图案（可以画到草带外面去）
      function fstamp(rows, bx) {
        var h = rows.length, w = rows[0].length, l0 = lvl(bx + (w >> 1));
        for (var j = 0; j < h; j++) for (var k = 0; k < w; k++) {
          var ch = rows[j][k];
          if (ch === '.') continue;
          var xx = bx + k, d = REL[ch];
          if (xx < 0 || xx >= W) continue;
          fpx(xx, top[xx] - (h - 1 - j), d !== undefined ? rel(l0, d) : T[ch]);
        }
      }
      // 一根高草：根在 bx 这一列的上沿，高 h，往 lean 那边弯；下半截两个像素宽，左边一列受光
      function tall(bx, h, lean, body, lit, tip) {
        if (bx < 0 || bx >= W) return;
        for (var j = 0; j < h; j++) {
          var u = j / h, sx = bx + round(lean * u * u * 1.6), wd = j < h * 0.5 ? 2 : 1;
          for (var k = 0; k < wd; k++) fpx(sx + k, top[bx] - j, j === h - 1 ? tip : (k === 0 ? lit : body));
        }
      }
      // 这一段的草长得野不野（0..1，沿着上沿慢慢变）
      var wl = [];
      for (k = 0; k < Math.ceil(W / (20 * R)) + 3; k++) wl.push(r8());
      function wild(xx) { var f = xx / (20 * R), i = floor(f), u = f - i; u = u * u * (3 - 2 * u); return wl[i] + (wl[i + 1] - wl[i]) * u; }
      // 后排：暗一点的高草，只长在比较野的那几段
      x = (r8() * 4) | 0;
      while (x < W) {
        var l0 = lvl(x), wv = wild(x);
        if (wv > 0.42) tall(x, round(2 + wv * 6 + r8() * 2), r8() < 0.5 ? (r8() < 0.5 ? -1 : 1) : 0, rel(l0, -3), rel(l0, -2), rel(l0, -2));
        x += 3 + ((r8() * 5) | 0);
      }
      // 中间：草地自己的边，密密的短草尖
      for (x = 0; x < W; x++) {
        var lt = lvl(x), fz = TEETH[hash(x >> 3, 9, seed) % TEETH.length][x & 7] + ((hash(x, 5, seed) & 3) ? 1 : 0);
        for (k = 1; k <= fz; k++) fpx(x, top[x] - k, lt);
      }
      // 前排：亮一点的草，一丛一丛（中间那根最高，两边的往外弯）；再隔远一点，一朵花或一根草穗
      x = 2 + ((r8() * 6) | 0);
      var nextStem = x + (((10 + r8() * 30) * R) | 0);
      while (x < W - 2) {
        var l1 = lvl(x);
        if (x >= nextStem) {
          fstamp(EDGE_STEMS[(r8() * EDGE_STEMS.length) | 0], x);
          nextStem = x + (((22 + r8() * 46) * R) | 0);
          x += 5 + ((r8() * 4) | 0);
          continue;
        }
        var wv2 = wild(x), hc = round(4 + wv2 * 4 + r8() * 2), five = r8() < 0.2 + wv2 * 0.4;
        if (five) { tall(x - 4, hc - 3, -2, rel(l1, 3), rel(l1, 5), rel(l1, 5)); tall(x + 4, hc - 3, 2, rel(l1, 0), rel(l1, 2), rel(l1, 2)); }
        tall(x - 2, hc - 2, -1, rel(l1, 3), rel(l1, 5), rel(l1, 7));
        tall(x + 2, hc - 1, 1, rel(l1, 0), rel(l1, 2), rel(l1, 4));
        tall(x, hc, r8() < 0.5 ? 0 : (r8() < 0.5 ? -1 : 1), rel(l1, 2), rel(l1, 5), rel(l1, 9));
        x += (five ? 12 : 8) + (((1 - wv2) * 14 + r8() * 9) | 0);
      }
    }

    return { w: W, h: H, data: data, scale: R, ox: 0, oy: 0, key: null, ver: 1 };
  }

  // R = 4（或更大的偶数）：按一半的分辨率画好，再把每个像素放大成一小块
  function doubled(wWu, hWu, phase, R, opts, W, H) {
    var c = R >> 1, im = render(wWu, hWu, phase, R / c, opts);
    var data = new Uint8ClampedArray(W * H * 4), out = new Uint32Array(data.buffer), src = new Uint32Array(im.data.buffer);
    for (var y = 0; y < H; y++) {
      var sy = Math.min(im.h - 1, (y / c) | 0) * im.w, o = y * W;
      for (var x = 0; x < W; x++) out[o + x] = src[sy + Math.min(im.w - 1, (x / c) | 0)];
    }
    return { w: W, h: H, data: data, scale: R, ox: 0, oy: 0, key: null, ver: 1 };
  }

  G.PET_LAWN = { render: render, palette: palette, PHASES: PHASES };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
