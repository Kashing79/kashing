// ============================================================
//  草地（PET_LAWN）
//
//  整张草地按画面大小一次画好，不用小块拼接，所以看不出重复。画法分四层：
//    1. 底色：几片很淡的深浅（像云影和太阳照着的地方），左上亮、右下暗（光从左上来），
//       再加一道道很淡的割草纹
//    2. 深浅交界的地方画成参差的草尖，不是光滑的"水渍"
//    3. 稀稀地撒草叶和草丛（颜色跟着脚下那一片的深浅走，所以哪里都不扎眼）
//    4. 更稀：三叶草、小花；偶尔一片落叶、几朵小蘑菇、一颗小石子、一只瓢虫
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

  // ---------- 颜色 ----------
  function rgb(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
  function hexOf(c) {
    return '#' + [0, 1, 2].map(function (i) { return ('0' + Math.max(0, Math.min(255, Math.round(c[i]))).toString(16)).slice(-2); }).join('');
  }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  // 草的五个定位色：最深（草根的影子）、暗、本色、亮、叶尖。暗的偏青蓝，亮的偏黄。
  var GRASS = {
    day:   ['#2e5c46', '#4a8761', '#599966', '#68a865', '#90c76b'],
    dusk:  ['#293442', '#43665a', '#4f784f', '#698754', '#b2ac60'],
    night: ['#10121c', '#1a292e', '#213836', '#2b453c', '#466151'],
  };
  // 三叶草比草偏青一点：暗、本色、亮
  var CLOVER = {
    day:   ['#3f8468', '#57a67e', '#86cf9a'],
    dusk:  ['#3d6a5e', '#52856a', '#8aa878'],
    night: ['#182b30', '#234541', '#34594c'],
  };
  // 别的小东西只写白天的颜色，傍晚 / 夜里由 grade() 统一压暗、调色
  var THINGS = {
    w: '#f7f5e9', v: '#b4b9d0',        // 白花瓣、背光的一面
    y: '#fadb5f', u: '#d6a04e',        // 黄花瓣
    p: '#faa0b6', q: '#c77798',        // 粉花瓣
    b: '#a9c4f5', c: '#7088cf',        // 小蓝花
    o: '#f2a93a',                      // 花心
    R: '#ee9063', r: '#cf5a40', e: '#8f3530',     // 红蘑菇：亮、本色、暗
    N: '#e3b77e', n: '#c08a55', f: '#8a5a3a',     // 褐蘑菇
    S: '#f6ecd4', s: '#c9b594', k: '#fbf3e4',     // 蘑菇柄：亮、暗；伞上的白点
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
    var r = Math.max(0, Math.min(255, Math.round(c[0]))), g = Math.max(0, Math.min(255, Math.round(c[1]))), b = Math.max(0, Math.min(255, Math.round(c[2])));
    return little ? ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0 : ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0;
  }
  var palCache = {};
  function paletteOf(phase) {
    if (PHASES.indexOf(phase) < 0) phase = 'day';
    var p = palCache[phase];
    if (p) return p;
    var a = GRASS[phase].map(rgb), cl = CLOVER[phase].map(rgb), cols = [], i;
    for (i = 1; i <= NG; i++) {
      var t = (i - 1) / 6, seg = Math.min(3, Math.floor(t));
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
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // 由坐标算出来的"随机"整数（不占用上面那串随机数）
  function hash(x, y, s) {
    var h = Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(s, 83492791);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
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

  // 一层平滑的随机起伏：每个格点一个随机数，中间平滑过渡。shear = 每往下一行，整层往旁边错开多少格（让花纹不那么横平竖直）
  function layer(W, H, cw, ch, shear, rnd) {
    var sh = Math.abs(shear) * H, gw = Math.ceil((W + sh) / cw) + 3, gh = Math.ceil(H / ch) + 2, g = new Float32Array(gw * gh), i;
    for (i = 0; i < g.length; i++) g[i] = rnd();
    return { g: g, gw: gw, cw: cw, ch: ch, shear: shear, off: shear < 0 ? sh : 0, row: new Float32Array(gw), ix: new Int32Array(W), tx: new Float32Array(W) };
  }
  function layerRow(L, y, W) {       // 准备第 y 行：上下两排格点先混好，再算出每一列落在哪一格
    var f = y / L.ch, k = Math.floor(f), t = f - k, g = L.g, gw = L.gw, row = L.row, o = k * gw, i;
    t = t * t * (3 - 2 * t);
    for (i = 0; i < gw; i++) row[i] = g[o + i] + (g[o + gw + i] - g[o + i]) * t;
    var x0 = (L.off + y * L.shear) / L.cw, dx = 1 / L.cw, ix = L.ix, tx = L.tx;
    for (i = 0; i < W; i++) { var fx = x0 + i * dx, kx = Math.floor(fx), u = fx - kx; ix[i] = kx; tx[i] = u * u * (3 - 2 * u); }
  }

  // ---------- 小图案（R = 2 时一个字符一个像素）----------
  // 草的颜色都是"相对脚下那一片"的：t 叶尖 l 亮叶 m 叶 d 草缝里的暗 r 草根 s 落在草上的影子
  var REL = { t: 8, l: 5, m: 3, d: -3, r: -6, s: -4 };
  // 草叶：一两根，很淡，到处都有
  var TICKS = [
    ['t', 'm'],
    ['t.', 'm.', 'md'],
    ['t.t', 'm.m', '.d.'],
    ['t..', '.m.', '.md'],
    ['..t', 't.m', 'm.m', '.d.'],
    ['.t.', 't.m', 'mdm'],
    ['t..t', 'm.t.', '.dm.'],
  ];
  // 草丛：少，稍微显眼一点
  var TUFTS = [
    ['..t...t', 't.l.t.m', 'l.l.m.m', 'dlldmmd', '.drrrd.'],
    ['.t..t.', '.l..m.', 't.lm.t', 'ldlmdm', '.drrd.'],
    ['t..t.', 'l.tm.', 'dlmd.', '.rr..'],
    ['...t....', 't..l..t.', 'l.tl.tm.', 'ldllmdmd', '.drrrrd.'],
    ['..t..', 't.l.t', 'l.l.m', 'dlmmd', '.rrr.'],
    ['t..t', 'l.tm', 'dlmd', '.rr.'],
  ];
  // 小花（花瓣亮面 / 背光面 / 花心），下面压一小条影子
  var FLOWERS = [
    [['.w.', 'wov', '.vs', '..s'], ['w...v', '.w.v.', '..o..', '.w.vs', 'w...v', '...ss'], ['..w..', '.www.', 'wwovv', '.wvv.', '..vs.', '...ss']],
    [['.y.', 'you', '.us', '..s'], ['.y.', 'you', '.us', '..s'], ['.yy.', 'yoou', 'yoou', '.uus', '..ss']],
    [['.p.', 'poq', '.qs', '..s'], ['p...q', '.p.q.', '..o..', '.p.qs', 'p...q', '...ss'], ['.p.', 'poq', '.qs', '..s']],
    [['bb', 'bc'], ['b.', 'bc'], ['bb.', 'bcc', '.c.']],
  ];
  var BLOOM = ['ww', 'wq', '.s'];
  var SHROOM_R = ['..rrr..', '.rRrkr.', 'rkRrrre', '.eeeee.', '..Ss.s.', '..Ssss.'];
  var SHROOM_r = ['.rr.', 'rRre', '.Sss'];
  var SHROOM_N = ['..nnn..', '.nNnnn.', 'nNNnnnf', '.fffff.', '..Ss.s.', '..Ssss.'];
  var SHROOM_n = ['.nn.', 'nNnf', '.Sss'];
  var ROCKS = [['.GGg.', 'Ggggh', 'ggghhs', '.hhhss'], ['.Gg.', 'Gghs', '.hss'], ['..GGg..', '.GGgggh', 'Ggggghh', '.ghhhhss', '...sssss']];
  var LEAVES = [
    { l: 'A', m: 'a', d: 'i', rows: ['..ll.', '.llmd', '.lmds', 'd.mss'] },
    { l: 'B', m: 'j', d: 'z', rows: ['....ll.', '..lllmd', '.llmmds', '.lmmdss', 'd.dsss.'] },
  ];
  var BUG = ['.x.', 'XxX', 'XXs'];
  var LUCKY = ['ll.mm', 'll.mm', '..d..', 'mm.mm', 'mm.mm'];       // 四叶草，整片草地只有一棵
  var TREFOILS = [['.l.', 'mdm'], ['.ll.', '.ll.', 'mmdd', 'mmdd'], ['.l.', 'm.m']];

  // ============================================================
  //  画
  // ============================================================
  function render(wWu, hWu, phase, R, opts) {
    opts = opts || {};
    R = Math.max(1, Math.min(8, Math.round(+R || 2)));
    var W = Math.max(1, Math.round(wWu * R)), H = Math.max(1, Math.round(hWu * R));
    if (R >= 4) return doubled(wWu, hWu, phase, R, opts, W, H);
    var seed = (opts.seed === undefined || opts.seed === null ? 20261118 : opts.seed) >>> 0;
    var strip = opts.mode === 'strip';
    var pal = paletteOf(phase), lut = pal.lut;
    var data = new Uint8ClampedArray(W * H * 4), out = new Uint32Array(data.buffer);
    var g = new Uint8Array(W * H);        // 先存起伏的高低，后来存"这一格底色是第几级"；最高位 = 这里已经放了东西
    var rnd = rng(seed), x, y, i, j, k, o;
    var K = opts.tune || {};

    // ---- strip：草带的上沿（每一列草从第几行开始）----
    var top = null, y0 = 0;
    if (strip) {
      top = new Int16Array(W);
      var bandPx = Math.max(1, Math.min(H - Math.min(H - 1, 6 * R), Math.round(STRIP_H * R))), e1 = rng(seed ^ 0x51ab), e = [], e2 = [];
      for (i = 0; i < Math.ceil(W / (11 * R)) + 4; i++) { e.push(e1()); e2.push(e1()); }
      y0 = H;
      for (x = 0; x < W; x++) {
        var fa = x / (36 * R), ka = Math.floor(fa), ta = fa - ka; ta = ta * ta * (3 - 2 * ta);
        var fb = x / (11 * R), kb = Math.floor(fb), tb = fb - kb; tb = tb * tb * (3 - 2 * tb);
        var und = (e[ka] + (e[ka + 1] - e[ka]) * ta - 0.5) * 3.0 + (e2[kb] + (e2[kb + 1] - e2[kb]) * tb - 0.5) * 1.0;
        top[x] = Math.max(0, H - bandPx + Math.round(und * R));
        if (top[x] < y0) y0 = top[x];
      }
    }

    // ---- 1. 底色的起伏 ----
    // 割草纹和深浅都顺着同一个方向微微斜着：先在"摆正了的坐标"里一行行算好，再按斜度错开来取
    var slope = K.slope === undefined ? 0.14 : K.slope, FH = H + Math.ceil(W * Math.abs(slope)) + 2;
    var L1 = layer(W, FH, (K.c1x || 150) * R, (K.c1y || 40) * R, 0.2, rnd), L2 = layer(W, FH, (K.c2x || 58) * R, (K.c2y || 18) * R, -0.3, rnd), L3 = layer(W, FH, (K.c3x || 17) * R, (K.c3y || 7) * R, 0.1, rnd);
    var w1 = K.w1 === undefined ? 0.58 : K.w1, w2 = K.w2 === undefined ? 0.30 : K.w2, w3 = K.w3 === undefined ? 0.12 : K.w3;
    var bandH = (K.bandH || 30) * R, bandS = K.band === undefined ? 1 : K.band, wob = K.wob === undefined ? 0.5 : K.wob;
    var lgA = K.lg === undefined ? 1 : K.lg;
    var fld = new Uint8Array(W * FH);
    var hist = new Uint32Array(128), cnt = 0;
    for (y = 0; y < FH; y++) {
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
    var share = K.share || [0.07, 0.22, 0.42, 0.22, 0.07], NL = share.length, lev = new Uint8Array(128), acc = 0, cum = 0, li = 0;
    var stepI = K.step || 2, lo = BASE - stepI * ((NL - 1) >> 1);
    for (i = 0; i < 128; i++) {
      while (li < NL - 1 && cum >= (acc + share[li]) * cnt) { acc += share[li]; li++; }
      lev[i] = lo + li * stepI; cum += hist[i];
    }
    for (y = y0; y < H; y++) {
      o = y * W;
      for (x = 0; x < W; x++) {
        if (top && y < top[x]) { g[o + x] = 0; continue; }
        var gv = g[o + x];
        g[o + x] = lev[gv >> 1] + (gv & 1) * bandS;
      }
    }

    // ---- 2. 深浅交界处：下面那一片的草尖参差地伸进上面那一片 ----
    for (y = y0 + 3; y < H; y++) {
      o = y * W;
      for (x = 0; x < W; x++) {
        var c0 = g[o + x], cu = g[o + x - W];
        if (c0 === cu || !c0 || !cu) continue;
        var hh = hash(x, y, seed) & 15;
        if (hh < 7) {
          g[o + x - W] = c0;
          if (hh < 3 && g[o + x - 2 * W]) { g[o + x - 2 * W] = c0; if (hh === 0 && g[o + x - 3 * W]) g[o + x - 3 * W] = c0; }
        }
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
    // 把一个小图案盖上去。草的颜色（REL 里的字母）按脚下的深浅算；map 可以把字母换成别的；cl = 用三叶草的颜色
    function stamp(rows, px, py, flip, map, cl) {
      var h = rows.length, w = rows[0].length;
      if (!free(px, py, w, h)) return false;
      var l0 = loc(px + (w >> 1), py + h - 1);
      for (var j = 0; j < h; j++) {
        var row = rows[j];
        for (var k = 0; k < row.length; k++) {
          var ch = row[flip ? row.length - 1 - k : k];
          if (ch === '.') continue;
          if (map && map[ch]) ch = map[ch];
          var d = REL[ch];
          P(px + k, py + j, d !== undefined ? (cl && d > -4 ? CL0 : 0) + rel(l0, d) : T[ch]);
        }
      }
      take(px, py, w, h);
      return true;
    }

    var AW = W, AH = H - y0, area = AW * AH / (R * R);     // 草地的面积（世界单位）
    var dens = R === 1 ? 0.6 : 1;                           // R = 1 时图案显得大，就少撒一些
    var pts, px, py;

    if (opts.mode === 'kit') {            // 开发用：把所有小图案排成一排排，方便放大了看
      var kx = 6, ky = 8, rowH = 0;
      var putK = function (rows, map, cl) { if (kx + rows[0].length + 4 > W) { kx = 6; ky += rowH + 4; rowH = 0; } stamp(rows, kx, ky, false, map, cl); kx += rows[0].length + 4; if (rows.length > rowH) rowH = rows.length; };
      TICKS.forEach(function (s) { putK(s); }); TUFTS.forEach(function (s) { putK(s); });
      TREFOILS.forEach(function (s) { putK(s, null, true); }); putK(LUCKY, null, true); putK(BLOOM);
      FLOWERS.forEach(function (fs) { fs.forEach(function (s) { putK(s); }); });
      [SHROOM_R, SHROOM_r, SHROOM_N, SHROOM_n].forEach(function (s) { putK(s); }); ROCKS.forEach(function (s) { putK(s); });
      LEAVES.forEach(function (lf) { putK(lf.rows, { l: lf.l, m: lf.m, d: lf.d }); }); putK(BUG);
      return { w: W, h: H, data: data, scale: R, ox: 0, oy: 0, key: null, ver: 1 };
    }

    // ---- 4a. 零星的小东西（先放，占好位置）----
    var r4 = rng(seed ^ 0x7f4a7c15);
    if (area > 6000) {
      pts = scatter(AW, AH, 150 * R, r4);
      for (i = 0; i < pts.length; i += 2) if (r4() < 0.5) stamp(ROCKS[(r4() * ROCKS.length) | 0], pts[i] | 0, y0 + (pts[i + 1] | 0), r4() < 0.5);
      pts = scatter(AW, AH, 205 * R, r4);
      for (i = 0; i < pts.length; i += 2) {
        if (r4() > 0.55) continue;
        px = pts[i] | 0; py = y0 + (pts[i + 1] | 0);
        var red = r4() < 0.6, fl = r4() < 0.5;
        if (stamp(red ? SHROOM_R : SHROOM_N, px, py, fl)) {
          stamp(red ? SHROOM_r : SHROOM_n, px + (fl ? -6 : 9), py + 3, fl);
          if (r4() < 0.5) stamp(red ? SHROOM_r : SHROOM_n, px + (fl ? 9 : -6), py + 4, !fl);
        }
      }
      pts = scatter(AW, AH, 120 * R, r4);
      for (i = 0; i < pts.length; i += 2) {
        if (r4() > 0.6) continue;
        var lf = LEAVES[(r4() * LEAVES.length) | 0], lc = r4() < 0.5;
        stamp(lf.rows, pts[i] | 0, y0 + (pts[i + 1] | 0), r4() < 0.5, lc ? { l: 'A', m: 'a', d: 'i' } : { l: 'B', m: 'j', d: 'z' });
      }
      if (!strip && phase !== 'night') stamp(BUG, (W * (0.2 + r4() * 0.6)) | 0, (H * (0.25 + r4() * 0.5)) | 0, r4() < 0.5);
    }

    // ---- 4b. 小花：几朵凑成一小片 ----
    var r5 = rng(seed ^ 0x3c6ef372);
    pts = scatter(AW, AH, (strip ? 40 : 62) * R, r5);
    for (i = 0; i < pts.length; i += 2) {
      if (r5() > (strip ? 0.55 : 0.5) * dens) continue;
      var kind = (r5() * 4) | 0, nf = kind === 3 ? 4 + ((r5() * 5) | 0) : 2 + ((r5() * 4) | 0), spread = kind === 3 ? 5 : 10;
      for (j = 0; j < nf; j++) {
        var an = r5() * 6.2832, di = (1.5 + r5() * spread) * R;
        px = (pts[i] + Math.cos(an) * di) | 0; py = y0 + ((pts[i + 1] + Math.sin(an) * di * 0.6) | 0);
        var fs = FLOWERS[kind], pick = r5();
        stamp(fs[pick < 0.62 ? 0 : (pick < 0.84 ? 1 : 2)], px, py, r5() < 0.5);
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
      if (isLucky && stamp(LUCKY, pts[i] | 0, y0 + (pts[i + 1] | 0), false, null, true)) made++;
      for (j = 0; j < want * 3 && made < want; j++) {
        var an2 = r6() * 6.2832, dr = Math.sqrt(r6());
        px = (pts[i] + Math.cos(an2) * dr * rx) | 0; py = y0 + ((pts[i + 1] + Math.sin(an2) * dr * ry) | 0);
        var tr = r6();
        if (stamp(TREFOILS[tr < 0.5 ? 0 : (tr < 0.75 ? 1 : 2)], px, py, r6() < 0.5, null, true)) made++;
      }
      if (made >= 4 && r6() < 0.7) {
        var nb = 1 + ((r6() * 2) | 0);
        for (j = 0; j < nb; j++) stamp(BLOOM, (pts[i] + (r6() - 0.5) * rx * 1.3) | 0, y0 + ((pts[i + 1] + (r6() - 0.5) * ry * 1.3) | 0), false);
      }
    }

    // ---- 3. 草丛（少）和草叶（多）----
    var r7 = rng(seed ^ 0x1b873593);
    pts = scatter(AW, AH, (K.tuftR || 21) * R, r7);
    for (i = 0; i < pts.length; i += 2) if (r7() < 0.7 * dens) stamp(TUFTS[(r7() * TUFTS.length) | 0], pts[i] | 0, y0 + (pts[i + 1] | 0), r7() < 0.5);
    pts = scatter(AW, AH, (K.tickR || 5.5) * R, r7);
    for (i = 0; i < pts.length; i += 2) if (r7() < (K.tickP || 0.55) * dens) stamp(TICKS[(r7() * TICKS.length) | 0], pts[i] | 0, y0 + (pts[i + 1] | 0), r7() < 0.5);

    // ---- strip：上沿长出参差的草叶 ----
    if (strip) fringe();
    function fringe() {
      var r8 = rng(seed ^ 0x85ebca6b), x, k, j;
      function px(xx, yy, c) { if (xx >= 0 && xx < W && yy >= 0 && yy < H) { out[yy * W + xx] = lut[c]; if (!g[yy * W + xx]) g[yy * W + xx] = 1; } }
      // 先是一排密密的短草尖
      for (x = 0; x < W; x++) {
        var ty = top[x], lt = g[ty * W + x] & 127;
        if (!lt) continue;
        var fh = hash(x, 7, seed) & 15, fz = fh < 3 ? 0 : (fh < 8 ? 1 : (fh < 12 ? 2 : (fh < 15 ? 3 : 4)));
        for (k = 1; k <= fz; k++) px(x, ty - k, k === fz && fz > 1 ? rel(lt, 3) : lt);
      }
      // 再隔一段长一丛高一点的
      x = (r8() * 5 * R) | 0;
      while (x < W - 6) {
        var l2 = g[top[x] * W + x] & 127, nb2 = 2 + ((r8() * 4) | 0);
        for (k = 0; k < nb2 && l2; k++) {
          var bx = x + k * 2, bh = 3 + ((r8() * 6) | 0), back = r8() < 0.35, lean = k < (nb2 - 1) / 2 ? -1 : (k > (nb2 - 1) / 2 ? 1 : 0);
          if (bx >= W) break;
          for (j = 0; j < bh; j++) {
            var yy = top[bx] - j, xx = bx + (lean && j >= ((bh + 2) >> 1) ? lean : 0);
            px(xx, yy, back ? rel(l2, -3) : (j >= bh - (bh >= 5 ? 2 : 1) ? rel(l2, 8) : rel(l2, 3)));
          }
        }
        x += nb2 * 2 + (((2 + r8() * 12) * R) | 0);
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
