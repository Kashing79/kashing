// ============================================================
//  小道具和表情（PET_FX）
//
//  小球、骨头、蝴蝶、灰尘、爱心、感叹号……每一样都是"现画"的：
//  用世界单位描述形状，再按 R（一个世界单位画几个像素）画成像素图，所以换分辨率不用重画。
//  和角色是一家人：光都从左上来；每种材料一条由暗到亮、顺带变一点色相的色阶；
//  描边用这种材料自己的深色；像素要么不透明要么全透明（只有影子和萤火虫的光晕例外）。
//
//  想加一样新东西：
//    1. 写一个小函数  function xxx(p, a) { ……用画板 p 画…… }
//    2. 在下面的 SPRITES 表里加一行  ['名字', xxx, 参数, '一句话说明']
//  画板 p 的用法见"画板"那一节；(0, 0) 是这张图自己的原点，x 向右、y 向下，单位是世界单位。
//
//  这个文件不碰网页的任何东西，在 Mac 外壳的 JavaScriptCore 里也能直接跑。
// ============================================================
(function (G) {
  'use strict';

  var floor = Math.floor, ceil = Math.ceil, round = Math.round, sqrt = Math.sqrt, abs = Math.abs, PI = Math.PI;
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function resOf(R) { R = round(+R || 2); return R < 1 ? 1 : (R > 8 ? 8 : R); }

  // ---------- 光：从左上、稍微偏向看的人这边照过来（屏幕坐标，y 向下）----------
  var LX = -0.381, LY = -0.802, LZ = 0.461;

  // ---------- 材料：每种六级颜色（0 描边、1 最暗、2 暗、3 本色、4 亮、5 高光）----------
  var RAMPS = {
    ball:  ['#314c1d', '#658f25', '#95bd2a', '#cfe63c', '#ebf768', '#fdffb8'],     // 网球
    seam:  ['#314c1d', '#8fa86a', '#b8cc8f', '#dfe8c0', '#f7fae6', '#ffffff'],     // 网球上的白线（2 = 在暗处，4 = 在亮处）
    ivory: ['#4f3a44', '#9b8478', '#cdbb9f', '#efe2c4', '#fbf5e0', '#fffdf4'],     // 骨头
    heart: ['#661f3c', '#9e2a55', '#c73867', '#ff5c85', '#ff99aa', '#ffd6da'],     // 爱心
    gold:  ['#804219', '#c26a1f', '#eb972a', '#ffd342', '#fff08c', '#fffcd6'],     // 感叹号、问号、星星、叫声
    dust:  ['#7d7066', '#9e9082', '#c7bcab', '#e6dfcf', '#f7f4e9', '#ffffff'],     // 灰尘
    zzz:   ['#4c4573', '#6a6aa3', '#8792cc', '#bed2fa', '#e6eeff', '#ffffff'],     // 睡觉的 Z
    water: ['#3f528c', '#4f7fc4', '#67adeb', '#b2e5ff', '#e6f7ff', '#ffffff'],     // 汗、水滴
    blue:  ['#29224c', '#3a4d99', '#4981d6', '#7ac0f5', '#c4e8ff', '#ffffff'],     // 音符
    pink:  ['#7a2a55', '#b5477a', '#e86a9c', '#ff9cc0', '#ffc9dc', '#fff0f5'],     // 粉蝴蝶
    sky:   ['#2f3f8f', '#4a6fc9', '#6aa6ee', '#9fd0ff', '#d2ecff', '#f4fbff'],     // 蓝蝴蝶
    dark:  ['#2a1f2d', '#2a1f2d', '#3d3040', '#574a5c', '#7a6c80', '#a79aad'],     // 蝴蝶的身子、没有自己颜色的小东西
    white: ['#5f5c80', '#8e8fad', '#b4b9d0', '#f7f5e9', '#ffffff', '#ffffff'],     // 白花瓣、高光点
    grass: ['#2b5a47', '#478a60', '#5a9d60', '#6fae5c', '#9ccc66', '#c8e88a'],     // 草（白天）
    grassD: ['#2a3046', '#41665a', '#527d58', '#6e9058', '#c2b466', '#e2d58c'],    // 草（傍晚）
    grassN: ['#10121c', '#1a292e', '#213836', '#2b453c', '#466151', '#6a8573'],    // 草（夜里）
    soil:  ['#3b2a2a', '#4d3a36', '#6b5244', '#8a6f5c', '#a98a70', '#c7ab8e'],     // 泥土、爪印
    ochre: ['#6b4420', '#a56c2e', '#d9a441', '#f0cb72', '#fae7a6', '#fff6d6'],     // 落叶（黄）
    rust:  ['#6b2f22', '#96452c', '#c96b3c', '#e89a62', '#f6c38a', '#ffe6bd'],     // 落叶（橘红）
    yolk:  ['#804219', '#b8802f', '#d6a04e', '#fadb5f', '#fff08c', '#fffcd6'],     // 黄花瓣、花心
    rose:  ['#7a2a55', '#a8557a', '#c77798', '#faa0b6', '#ffd0dc', '#fff0f4'],     // 粉花瓣
    glow:  ['#6a7a2a', '#a8c23a', '#d6ee5a', '#eaff8a', '#f6ffc4', '#ffffff'],     // 萤火虫的光
  };
  var MNAME = Object.keys(RAMPS), M = {}, COL = [null];
  function rgbOf(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
  MNAME.forEach(function (k, i) { M[k] = i + 1; COL[i + 1] = RAMPS[k].map(rgbOf); });

  // 法线 (nx, ny, nz) → 第几级颜色。f 越大越"扁"（大块的东西不要鼓得像气球）
  function toneOf(nx, ny, nz, f) {
    nz = nz * (1 - f) + f;
    var t = (nx * LX + ny * LY + nz * LZ) / sqrt(nx * nx + ny * ny + nz * nz);
    return t > 0.92 ? 5 : (t > 0.62 ? 4 : (t > 0.18 ? 3 : (t > -0.28 ? 2 : 1)));
  }

  // ============================================================
  //  画板
  //    p.disc(cx, cy, r, 材料, o)                圆（自动对齐像素，小圆也圆）
  //    p.ell(cx, cy, rx, ry, 材料, o)            椭圆（o.rot 可以转个角度）
  //    p.cap(x0, y0, x1, y1, r0, r1, 材料, o)    一头粗一头细的圆棍
  //    p.poly([x0, y0, x1, y1, ...], 材料, o)    多边形（平的）
  //    p.rect(x0, y0, x1, y1, 材料, o)           方块
  //    p.stroke([x0, y0, ...], 粗细, 材料, o)    粗线（圆头）
  //    p.line(x0, y0, x1, y1, 材料, 第几级, o)   一个像素粗的细线
  //    p.dot(x, y, 材料, 第几级, o)              一个小点（R 大的时候是一小块）
  //    p.bevel(材料, o)                          给平的形状加厚度：上边亮、下边暗
  //    p.rim(材料, dx, dy, 第几级, 宽)           朝 (dx, dy) 那个方向挨着边的像素，改成第几级（比如右下一圈暗）
  //    p.outline()                               描边（颜色跟着挨着的材料走）
  //    p.soften()                                描边拐弯处里面那个像素暗一级，圆的东西更圆（描边之后用；有棱角的字别用）
  //    p.box(x0, y0, x1, y1)                     说明"摆放时按这个框来"（几帧动画用同一个框才不会跳）
  //    p.anchor('grip', x, y)                    记一个位置（比如手拿哪儿），会出现在图的属性里
  //  o 里可以写：
  //    tone 固定用第几级（不写就按光照算）；f 扁平程度；lo / hi 最暗 / 最亮到第几级；sh 整体亮几级（负数 = 暗）；
  //    ol: false 这些像素周围不描边；over: true 只画在已经有东西的地方；under: true 只画在空的地方；
  //    lock: true 之后不许别的步骤改它的颜色；a 透明度（0..1，只给光晕用）
  // ============================================================
  var SIDE = 64;                 // 画板的边长（世界单位）：比任何一样小东西都大
  function Pad(R) {
    this.R = R; this.W = this.H = SIDE * R; this.cx = this.cy = (SIDE / 2) * R;
    this.hp = 0.5 / R;           // 半个像素（世界单位）：想让图案左右对称又是奇数宽，就把中心放在 x = hp
    var n = this.W * this.H;
    this.m = new Uint8Array(n);  // 材料（0 = 空）
    this.t = new Uint8Array(n);  // 第几级颜色
    this.f = new Uint8Array(n);  // 标记：1 不描边，2 锁住
    this.a = new Uint8Array(n);  // 透明度（0 = 不透明）
    this.o = new Uint16Array(n); // 第几笔画上去的（描边时，挨着好几种材料就听最后画的那个）
    this.g = new Uint8Array(n);  // 描边时算哪种材料（画在别的东西上面的高光、花纹，算底下那种）
    this.reset(true);
  }
  Pad.prototype.reset = function (first) {
    if (!first && this.x1 >= this.x0) {
      for (var y = this.y0; y <= this.y1; y++) {
        var o = y * this.W;
        for (var x = this.x0; x <= this.x1; x++) { this.m[o + x] = 0; this.t[o + x] = 0; this.f[o + x] = 0; this.a[o + x] = 0; this.o[o + x] = 0; this.g[o + x] = 0; }
      }
    }
    this.x0 = this.W; this.y0 = this.H; this.x1 = -1; this.y1 = -1;
    this.n = 0; this.bb = null; this.marks = null;
  };
  // 往 (i, j) 这个像素上画
  Pad.prototype.set = function (i, j, mat, tone, o) {
    if (i < 1 || j < 1 || i >= this.W - 1 || j >= this.H - 1) return;
    var k = j * this.W + i, has = this.m[k];
    if (o) {
      if (o.over && (!has || (o.over !== true && has !== o.over))) return;
      if (o.under && has) return;
      if (o.sh) tone += o.sh;
      if (o.lo !== undefined && tone < o.lo) tone = o.lo;
      if (o.hi !== undefined && tone > o.hi) tone = o.hi;
    }
    this.m[k] = mat; this.t[k] = tone < 0 ? 0 : (tone > 5 ? 5 : tone);
    this.f[k] = o ? ((o.ol === false ? 1 : 0) | (o.lock ? 2 : 0)) : 0;
    this.a[k] = o && o.a !== undefined ? clamp(round(o.a * 255), 1, 255) : 0;
    if (!(o && o.over && has)) { this.g[k] = mat; this.o[k] = this.n; }
    if (i < this.x0) this.x0 = i; if (i > this.x1) this.x1 = i; if (j < this.y0) this.y0 = j; if (j > this.y1) this.y1 = j;
  };
  Pad.prototype.ell = function (cx, cy, rx, ry, mat, o) {
    o = o || {};
    var R = this.R, px = this.cx + cx * R, py = this.cy + cy * R, ax = rx * R, ay = ry * R, rot = o.rot || 0;
    if (!rot && !o.raw) {
      // 对齐像素：直径取整；偶数直径圆心落在像素的角上，奇数直径落在像素正中
      var dx = round(ax * 2), dy = round(ay * 2);
      if (dx < 1) dx = 1; if (dy < 1) dy = 1;
      px = dx & 1 ? floor(px) + 0.5 : round(px); py = dy & 1 ? floor(py) + 0.5 : round(py);
      ax = dx === 3 ? 1.4 : dx / 2 + (dx >= 13 ? 0.2 : 0); ay = dy === 3 ? 1.4 : dy / 2 + (dy >= 13 ? 0.2 : 0);
    }
    else if (rot && !o.thin) { ax += 0.2; ay += 0.2; }      // 斜着的椭圆稍微放一点，两头才不会只剩一个像素尖
    var c = Math.cos(rot), s = Math.sin(rot), ext = Math.max(ax, ay) + 1;
    var i0 = floor(px - ext), i1 = ceil(px + ext), j0 = floor(py - ext), j1 = ceil(py + ext);
    var fixed = o.tone, f = o.f === undefined ? 0.25 : o.f;
    this.n++;
    for (var j = j0; j <= j1; j++) for (var i = i0; i <= i1; i++) {
      var ex = i + 0.5 - px, ey = j + 0.5 - py;
      var ux = (ex * c + ey * s) / ax, uy = (-ex * s + ey * c) / ay, d = ux * ux + uy * uy;
      if (d > 1) continue;
      var tone;
      if (typeof fixed === 'function') tone = fixed(ux, uy, d);
      else if (fixed !== undefined) tone = fixed;
      else { var nz = sqrt(1 - d); tone = toneOf(ux * c - uy * s, ux * s + uy * c, nz, f); }
      this.set(i, j, mat, tone, o);
    }
  };
  Pad.prototype.disc = function (cx, cy, r, mat, o) { this.ell(cx, cy, r, r, mat, o); };
  Pad.prototype.cap = function (x0, y0, x1, y1, r0, r1, mat, o) {
    o = o || {};
    var R = this.R, ax = this.cx + x0 * R, ay = this.cy + y0 * R, bx = this.cx + x1 * R, by = this.cy + y1 * R;
    r0 *= R; r1 *= R;
    var vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1, ext = Math.max(r0, r1) + 1;
    var i0 = floor(Math.min(ax, bx) - ext), i1 = ceil(Math.max(ax, bx) + ext), j0 = floor(Math.min(ay, by) - ext), j1 = ceil(Math.max(ay, by) + ext);
    var fixed = o.tone, f = o.f === undefined ? 0.25 : o.f;
    this.n++;
    for (var j = j0; j <= j1; j++) for (var i = i0; i <= i1; i++) {
      var qx = i + 0.5 - ax, qy = j + 0.5 - ay, u = clamp((qx * vx + qy * vy) / l2, 0, 1);
      var ex = qx - vx * u, ey = qy - vy * u, r = r0 + (r1 - r0) * u, d = (ex * ex + ey * ey) / (r * r);
      if (d > 1) continue;
      this.set(i, j, mat, fixed !== undefined ? fixed : toneOf(ex / r, ey / r, sqrt(1 - d), f), o);
    }
  };
  Pad.prototype.poly = function (pts, mat, o) {
    o = o || {};
    var R = this.R, n = pts.length >> 1, X = [], Y = [], i, j, k, i0 = 1e9, i1 = -1e9, j0 = 1e9, j1 = -1e9;
    for (k = 0; k < n; k++) {
      var x = this.cx + pts[k * 2] * R, y = this.cy + pts[k * 2 + 1] * R;
      if (!o.raw) { x = round(x); y = round(y); }             // 顶点对齐到像素的边上
      X.push(x); Y.push(y);
      if (x < i0) i0 = x; if (x > i1) i1 = x; if (y < j0) j0 = y; if (y > j1) j1 = y;
    }
    var tone = o.tone === undefined ? 3 : o.tone;
    this.n++;
    for (j = floor(j0); j <= ceil(j1); j++) for (i = floor(i0); i <= ceil(i1); i++) {
      var qx = i + 0.5, qy = j + 0.5, inside = false;
      for (k = 0; k < n; k++) {
        var k2 = (k + 1) % n;
        if ((Y[k] > qy) !== (Y[k2] > qy) && qx < (X[k2] - X[k]) * (qy - Y[k]) / (Y[k2] - Y[k]) + X[k]) inside = !inside;
      }
      if (inside) this.set(i, j, mat, typeof tone === 'function' ? tone((qx - this.cx) / R, (qy - this.cy) / R) : tone, o);
    }
  };
  Pad.prototype.rect = function (x0, y0, x1, y1, mat, o) { this.poly([x0, y0, x1, y0, x1, y1, x0, y1], mat, o); };
  Pad.prototype.stroke = function (pts, w, mat, o) {
    o = o || {};
    var R = this.R, n = pts.length >> 1, X = [], Y = [], k, wp = Math.max(1, round(w * R)), half = wp / 2;
    var i0 = 1e9, i1 = -1e9, j0 = 1e9, j1 = -1e9;
    for (k = 0; k < n; k++) {
      var x = this.cx + pts[k * 2] * R, y = this.cy + pts[k * 2 + 1] * R;
      if (wp & 1) { x = floor(x) + 0.5; y = floor(y) + 0.5; } else { x = round(x); y = round(y); }   // 线的正中对齐像素，粗细才均匀
      X.push(x); Y.push(y);
      if (x < i0) i0 = x; if (x > i1) i1 = x; if (y < j0) j0 = y; if (y > j1) j1 = y;
    }
    var tone = o.tone === undefined ? 3 : o.tone, lim = half * half - 0.001;
    this.n++;
    for (var j = floor(j0 - half) - 1; j <= ceil(j1 + half) + 1; j++) for (var i = floor(i0 - half) - 1; i <= ceil(i1 + half) + 1; i++) {
      var qx = i + 0.5, qy = j + 0.5, best = 1e9;
      for (k = 0; k < (n > 1 ? n - 1 : 1); k++) {
        var k2 = n > 1 ? k + 1 : k, vx = X[k2] - X[k], vy = Y[k2] - Y[k], l2 = vx * vx + vy * vy;
        var u = l2 ? clamp(((qx - X[k]) * vx + (qy - Y[k]) * vy) / l2, 0, 1) : 0, ex = qx - X[k] - vx * u, ey = qy - Y[k] - vy * u, d = ex * ex + ey * ey;
        if (d < best) best = d;
      }
      if (best < lim) this.set(i, j, mat, tone, o);
    }
  };
  Pad.prototype.line = function (x0, y0, x1, y1, mat, tone, o) {
    var R = this.R, i = floor(this.cx + x0 * R), j = floor(this.cy + y0 * R), i1 = floor(this.cx + x1 * R), j1 = floor(this.cy + y1 * R);
    var dx = abs(i1 - i), dy = -abs(j1 - j), sx = i < i1 ? 1 : -1, sy = j < j1 ? 1 : -1, err = dx + dy;
    this.n++;
    for (;;) {
      this.set(i, j, mat, tone, o);
      if (i === i1 && j === j1) break;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; i += sx; }
      if (e2 <= dx) { err += dx; j += sy; }
    }
  };
  Pad.prototype.dot = function (x, y, mat, tone, o) {
    var R = this.R, s = Math.max(1, round(R / 2)), i = floor(this.cx + x * R), j = floor(this.cy + y * R);
    this.n++;
    for (var b = 0; b < s; b++) for (var a = 0; a < s; a++) this.set(i + a, j + b, mat, tone, o);
  };
  // 平的形状加厚度：最上面一圈亮（o.light，默认 4），最下面一圈暗（o.dark，默认 2）；o.side = true 时左边也亮、右边也暗
  Pad.prototype.bevel = function (mat, o) {
    o = o || {};
    var W = this.W, lt = o.light === undefined ? 4 : o.light, dk = o.dark === undefined ? 2 : o.dark, w = Math.max(1, round((o.w || 0.5) * this.R));
    var up = [], dn = [], x, y, k, q;
    for (y = this.y0; y <= this.y1; y++) for (x = this.x0; x <= this.x1; x++) {
      k = y * W + x;
      if (this.m[k] !== mat || (this.f[k] & 2)) continue;
      var lit = false, shd = false;
      for (q = 1; q <= w; q++) {
        if (this.m[k - q * W] !== mat || (o.side && this.m[k - q] !== mat)) lit = true;
        if (this.m[k + q * W] !== mat || (o.side && this.m[k + q] !== mat)) shd = true;
      }
      if (lit && !shd) up.push(k); else if (shd && !lit) dn.push(k);
    }
    for (q = 0; q < up.length; q++) this.t[up[q]] = lt;
    for (q = 0; q < dn.length; q++) this.t[dn[q]] = dk;
  };
  // 朝 (dx, dy) 方向挨着边的那一圈像素（宽 w 个世界单位，至少 1 个像素）改成第 tone 级
  Pad.prototype.rim = function (mat, dx, dy, tone, w) {
    var W = this.W, n = Math.max(1, round((w || 0) * this.R)), hit = [], x, y, k, q;
    for (y = this.y0; y <= this.y1; y++) for (x = this.x0; x <= this.x1; x++) {
      k = y * W + x;
      if (this.m[k] !== mat || (this.f[k] & 2)) continue;
      for (q = 1; q <= n; q++) if (this.m[k + (dy * W + dx) * q] !== mat) { hit.push(k); break; }
    }
    for (q = 0; q < hit.length; q++) this.t[hit[q]] = tone;
  };
  // 描边：挨着图案（上下左右）的空像素，涂上那种材料的描边色
  Pad.prototype.outline = function () {
    var W = this.W, add = [], x, y, k, q;
    var D = [-W, -1, 1, W];
    for (y = this.y0 - 1; y <= this.y1 + 1; y++) for (x = this.x0 - 1; x <= this.x1 + 1; x++) {
      k = y * W + x;
      if (this.m[k]) continue;
      var best = 0, bo = -1;
      for (q = 0; q < 4; q++) { var nk = k + D[q]; if (this.m[nk] && !(this.f[nk] & 1) && this.t[nk] > 0 && this.o[nk] > bo) { bo = this.o[nk]; best = this.g[nk]; } }
      if (best) add.push(k, best);
    }
    this.n++;
    for (q = 0; q < add.length; q += 2) {
      k = add[q]; this.m[k] = this.g[k] = add[q + 1]; this.t[k] = 0; this.f[k] = 3; this.o[k] = this.n;
      x = k % W; y = (k / W) | 0;
      if (x < this.x0) this.x0 = x; if (x > this.x1) this.x1 = x; if (y < this.y0) this.y0 = y; if (y > this.y1) this.y1 = y;
    }
  };
  // 描边拐弯的地方，里面那个像素暗一级：弧线看起来更圆（只动图案里面，不碰外面）
  Pad.prototype.soften = function () {
    var W = this.W, hit = [], x, y, k, q;
    for (y = this.y0; y <= this.y1; y++) for (x = this.x0; x <= this.x1; x++) {
      k = y * W + x;
      if (!this.m[k] || this.t[k] < 2 || (this.f[k] & 2)) continue;
      var u = this.m[k - W] && this.t[k - W] === 0, d = this.m[k + W] && this.t[k + W] === 0, l = this.m[k - 1] && this.t[k - 1] === 0, r = this.m[k + 1] && this.t[k + 1] === 0;
      if ((u || d) && (l || r)) hit.push(k);
    }
    for (q = 0; q < hit.length; q++) this.t[hit[q]]--;
  };
  Pad.prototype.box = function (x0, y0, x1, y1) { var R = this.R; this.bb = [round(this.cx + x0 * R), round(this.cy + y0 * R), round(this.cx + x1 * R) - 1, round(this.cy + y1 * R) - 1]; };
  Pad.prototype.anchor = function (name, x, y) { (this.marks || (this.marks = {}))[name] = [x, y]; };
  // 收工：裁出有像素的那一块（四周留 1 个像素的空），交出一张图
  Pad.prototype.done = function (key) {
    var W = this.W, x0 = this.x0, y0 = this.y0, x1 = this.x1, y1 = this.y1, bb = this.bb;
    if (x1 < x0) { x0 = x1 = this.cx; y0 = y1 = this.cy; }
    if (bb) { x0 = Math.min(x0, bb[0]); y0 = Math.min(y0, bb[1]); x1 = Math.max(x1, bb[2]); y1 = Math.max(y1, bb[3]); }
    else bb = [x0, y0, x1, y1];
    x0--; y0--; x1++; y1++;
    var w = x1 - x0 + 1, h = y1 - y0 + 1, d = new Uint8ClampedArray(w * h * 4);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var k = (y0 + y) * W + x0 + x, mat = this.m[k];
      if (!mat) continue;
      var c = COL[mat][this.t[k]], o = (y * w + x) * 4;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = this.a[k] || 255;
    }
    var im = { w: w, h: h, data: d, scale: this.R, ox: this.cx - x0, oy: this.cy - y0, key: key, ver: 1, bb: [bb[0] - x0, bb[1] - y0, bb[2] - x0, bb[3] - y0] };
    if (this.marks) for (var name in this.marks) im[name] = [this.cx - x0 + this.marks[name][0] * this.R, this.cy - y0 + this.marks[name][1] * this.R];
    return im;
  };
  var pads = {};
  function padOf(R) { var p = pads[R] || (pads[R] = new Pad(R)); p.reset(); return p; }

  // ============================================================
  //  小球：半径 4（连描边）。rot = 转了多少（弧度，往右滚是正的），白线跟着转；
  //  squash 0..1 = 落地时压扁（贴着地面，变宽，体积不变）；
  //  （额外）squash -1..0 = 飞得快时拉长，dir 是拉长的方向（弧度，默认竖着）
  // ============================================================
  var BALL_STEPS = 24;          // 一圈分成多少格
  var ballCache = {};
  function ball(rot, squash, R, dir) {
    R = resOf(R);
    var qi = round((+rot || 0) / (PI * 2) * BALL_STEPS) % BALL_STEPS;
    if (qi < 0) qi += BALL_STEPS;
    var qs = round(clamp(+squash || 0, -1, 1) * 4), qd = 0;
    if (qs < 0) { qd = round((dir === undefined ? PI / 2 : +dir) / PI * 8) % 8; if (qd < 0) qd += 8; }
    var key = 'ball_' + qi + '_' + qs + '_' + qd + '@' + R;
    return ballCache[key] || (ballCache[key] = drawBall(qi / BALL_STEPS * PI * 2, qs / 4, qd * PI / 8, R, key));
  }
  // 网球上的白线：两段弧，画在"跟着球一起转"的那张图上。每段 [圆心在球心左右多远, 弧的半径]（球的半径算 1）：
  // 一段长的从球心附近弯过去，一段短的贴着另一边
  var SEAMS = [[-1.15, 0.95], [1.5, 0.95]];
  function drawBall(rot, s, dir, R, key) {
    var p = padOf(R), rf = 4 - 1 / R;       // 球面的半径；外面再包一圈描边正好是 4
    var rx = rf, ry = rf, cy = 0, ang = 0, k;
    if (s > 0) { k = 1 - 0.3 * s; ry = round(rf * k * R) / R; rx = round(rf / sqrt(k) * R) / R; cy = rf - ry; }
    else if (s < 0) { k = 1 - 0.25 * s; rx = rf * k; ry = rf / sqrt(k); ang = dir; }
    // 毛茸茸的球：亮面大、高光小、最暗的一圈很窄
    p.ell(0, cy, rx, ry, M.ball, { rot: ang, raw: !!ang, tone: function (ux, uy, d) {
      var c = Math.cos(ang), sn = Math.sin(ang), nx = ux * c - uy * sn, ny = ux * sn + uy * c, nz = sqrt(1 - d) * 0.9 + 0.1;
      var t = (nx * LX + ny * LY + nz * LZ) / sqrt(nx * nx + ny * ny + nz * nz);
      if (R < 2) return t > 0.7 ? 4 : (t > -0.1 ? 3 : 2);              // 太小了：三级就够
      return t > 0.955 ? 5 : (t > 0.66 ? 4 : (t > 0.12 ? 3 : (t > -0.36 ? 2 : 1)));
    } });
    var W = p.W, px = p.cx, py = p.cy + cy * R, ax = rx * R, ay = ry * R, N = 200, line = [];
    var ca = Math.cos(ang), sa = Math.sin(ang), cr = Math.cos(rot), sr = Math.sin(rot), si;
    for (si = 0; si < (R < 2 ? 1 : SEAMS.length); si++) {
      var pi = -1, pj = -1, pv = false;
      for (k = 0; k <= N; k++) {
        var an = k / N * PI * 2, u = SEAMS[si][0] + SEAMS[si][1] * Math.cos(an), v = SEAMS[si][1] * Math.sin(an);
        var vis = u * u + v * v < 0.93;
        var x = u * cr - v * sr, y = u * sr + v * cr;                    // 跟着球转
        // 球被压扁 / 拉长时，花纹跟着变形
        var ex = x * ax, ey = y * ay, i = floor(px + ex * ca - ey * sa), j = floor(py + ex * sa + ey * ca);
        if (vis && pv && (i !== pi || j !== pj)) {
          // 从上一个点连到这个点
          var dx = abs(i - pi), dy = -abs(j - pj), sx = pi < i ? 1 : -1, sy = pj < j ? 1 : -1, err = dx + dy, ci = pi, cj = pj;
          for (;;) {
            line.push(cj * W + ci);
            if (ci === i && cj === j) break;
            var e2 = 2 * err;
            if (e2 >= dy) { err += dy; ci += sx; }
            if (e2 <= dx) { err += dx; cj += sy; }
          }
        }
        pi = i; pj = j; pv = vis;
      }
    }
    var on = {}, q, kk;
    for (q = 0; q < line.length; q++) if (p.m[line[q]] === M.ball) on[line[q]] = 1;
    // 拐角处多出来的像素去掉，线才干净
    for (q = 0; q < line.length; q++) {
      kk = line[q];
      if (!on[kk]) continue;
      var hN = (on[kk - 1] ? 1 : 0) + (on[kk + 1] ? 1 : 0), vN = (on[kk - W] ? 1 : 0) + (on[kk + W] ? 1 : 0);
      if (hN === 1 && vN === 1) {
        var hx = on[kk - 1] ? -1 : 1, vy = on[kk - W] ? -W : W;
        if (!on[kk + hx + vy]) on[kk] = 0;
      }
    }
    for (q = 0; q < line.length; q++) {
      kk = line[q];
      if (!on[kk]) continue;
      p.t[kk] = p.t[kk] >= 3 ? 4 : 2; p.m[kk] = M.seam; p.f[kk] = 2;
      if (R >= 3 && p.m[kk + W] === M.ball) { p.t[kk + W] = p.t[kk + W] >= 3 ? 4 : 2; p.m[kk + W] = M.seam; p.f[kk + W] = 2; }
    }
    p.outline();
    if (R > 1) p.soften();
    return p.done(key);
  }

  // ============================================================
  //  影子：一个扁扁的椭圆，中间实一点，往外淡两级，没有硬边。halfW = 半宽（世界单位），alpha = 最实的地方有多实
  // ============================================================
  var shCache = {};
  function shadow(halfW, alpha, R) {
    R = resOf(R);
    halfW = Math.max(0.5, round((+halfW || 2) * 4) / 4);                 // 半宽按 1/4 个单位取整，免得缓存里攒一大堆差不多的图
    var a8 = clamp(round((+alpha || 0) * 255), 0, 255), key = 'sh_' + halfW + '_' + a8 + '@' + R;
    if (shCache[key]) return shCache[key];
    var hw = Math.max(1, round(halfW * R)), hh = Math.max(1, round(clamp(0.45 + halfW * 0.09, 0.7, 2.3) * R));
    var w = hw * 2 + 2, h = hh * 2 + 2, d = new Uint8ClampedArray(w * h * 4);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var ex = (x + 0.5 - w / 2) / hw, ey = (y + 0.5 - h / 2) / hh, r2 = ex * ex + ey * ey;
      if (r2 > 1) continue;
      var o = (y * w + x) * 4, k = r2 < 0.42 ? 1 : (r2 < 0.74 ? 0.62 : 0.3);
      d[o] = 20; d[o + 1] = 32; d[o + 2] = 42; d[o + 3] = round(a8 * k);
    }
    return (shCache[key] = { w: w, h: h, data: d, scale: R, ox: w / 2, oy: h / 2, key: key, ver: 1, bb: [1, 1, w - 2, h - 2] });
  }

  // ============================================================
  //  飞溅的小碎屑：一个世界单位见方的色块
  // ============================================================
  var pxCache = {};
  function px(color, R) {
    R = resOf(R);
    color = String(color || '#ffffff').toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(color)) color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
    var key = 'px_' + color + '@' + R;
    if (pxCache[key]) return pxCache[key];
    var c = /^#[0-9a-f]{6}$/.test(color) ? rgbOf(color) : [255, 255, 255], d = new Uint8ClampedArray(R * R * 4);
    for (var i = 0; i < R * R; i++) { d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; }
    return (pxCache[key] = { w: R, h: R, data: d, scale: R, ox: R / 2, oy: R / 2, key: key, ver: 1, bb: [0, 0, R - 1, R - 1] });
  }

  // ============================================================
  //  一样一样的小东西
  // ============================================================
  // 骨头：中间一根细杆，两头各两个圆疙瘩
  function bone(p) {
    p.cap(-2.6, 0, 2.6, 0, 0.6, 0.6, M.ivory, { f: 0.2 });
    p.disc(-3, -1, 1, M.ivory); p.disc(-3, 1, 1, M.ivory); p.disc(3, -1, 1, M.ivory); p.disc(3, 1, 1, M.ivory);
    p.outline(); p.soften();
  }

  // 蝴蝶：a.wing = 0 翅膀举着 / 1 平展 / 2 往下压 / 3 停着（侧面，翅膀合起来）；a.m = 翅膀的颜色
  function butterfly(p, a) {
    var m = M[a.m], w = a.wing, s, hp = p.hp, NO = { ol: false, lock: true };
    p.box(-4.5, -3.5, 5, 2.5);
    if (w === 3) {             // 停着：侧面，翅膀竖着合在一起，头朝左
      p.ell(hp + 1.0, 0.1, 1.0, 0.9, m, { tone: 2 });                                       // 后翅
      p.poly([hp - 0.75, 0.75, hp - 0.25, -3.25, hp + 1.25, -2.75, hp + 2.0, -0.75, hp + 0.75, 0.75], m, { tone: 3 });    // 前翅
      p.rim(m, -1, -1, 4);
      p.ell(hp + 0.6, -1.6, 0.55, 0.9, m, { rot: 0.3, tone: 4, over: m, thin: true });
      p.dot(hp + 0.75, -2.5, M.white, 4, { over: m, lock: true });
      p.outline(); p.soften();
      p.line(hp - 1.5, 1.25, hp + 1.25, 1.25, M.dark, 2, NO);                               // 身子
      p.line(hp - 1.5, 0.75, hp - 2.25, -0.5, M.dark, 2, NO);                               // 触角
      return;
    }
    var U = [[1.6, -1.6, 1.6, 1.0, -0.9], [2.0, -0.7, 1.9, 1.15, -0.25], [1.5, 0.1, 1.5, 0.85, 0.5]][w];     // 上翅：x, y, rx, ry, 角度
    var L = [[1.1, 0.5, 0.9, 0.75, 0], [1.4, 1.0, 1.15, 0.9, 0.3], [1.0, 1.2, 0.85, 0.65, 0.6]][w];           // 下翅
    var ay = [-1.8, -2.4, -1.5][w];                                                          // 触角从多高的地方伸出去
    for (s = -1; s <= 1; s += 2) {
      p.ell(hp + s * L[0], L[1], L[2], L[3], m, { rot: s * L[4], tone: 2 });
      p.ell(hp + s * U[0], U[1], U[2], U[3], m, { rot: s * U[4], tone: 3 });
      p.ell(hp + s * U[0] * 0.75, U[1] + 0.15, U[2] * 0.5, U[3] * 0.5, m, { rot: s * U[4], tone: 4, over: m, thin: true });
      p.dot(hp + s * U[0] * 1.35, U[1] - U[3] * 0.25, M.white, 4, { over: m, lock: true });
    }
    p.outline(); p.soften();
    p.line(hp, ay + 0.5, hp, 1.4, M.dark, 2, NO);                                           // 身子：细细一条
    p.line(hp - 0.5, ay, hp - 1.0, ay - 0.6, M.dark, 2, NO); p.line(hp + 0.5, ay, hp + 1.0, ay - 0.6, M.dark, 2, NO);   // 触角
  }

  // 灰尘：a = 第几帧（0 刚冒出来的一团 → 1 鼓起来 → 2 散开 → 3 只剩几点）。贴着地面（y = 0 是地）
  function puff(p, a) {
    var B = [
      [[-0.9, -1.0, 1.0], [0.7, -1.0, 1.0], [0, -1.5, 1.0]],
      [[-1.9, -1.2, 1.2], [1.8, -1.1, 1.1], [0, -1.9, 1.5], [-0.6, -1.0, 1.0]],
      [[-3.0, -1.7, 0.9], [-1.9, -1.9, 1.0], [1.9, -2.0, 0.9], [3.0, -1.5, 0.7], [-0.1, -3.5, 0.55]],
      [[-3.0, -2.3, 0.4], [-1.0, -3.5, 0.5], [1.5, -2.9, 0.4], [3.1, -1.7, 0.3]],
    ][a], i;
    p.box(-4, -4.5, 4, 0);
    for (i = 0; i < B.length; i++) p.disc(B[i][0], B[i][1], B[i][2], M.dust, { f: 0.5, lo: 3, hi: 5, ol: false });
    if (a < 3) { p.rim(M.dust, 1, 1, 2); p.rim(M.dust, 0, 1, 1); }           // 底下压一道暗边，在白底上也看得见
  }

  // 爱心：a.s = 大小（1 = 正常），a.sx / a.sy = 横竖各拉伸多少（"啵"地弹出来那几帧用）
  function heart(p, a) {
    var s = a.s || 1, sx = s * (a.sx || 1), sy = s * (a.sy || 1), hp = p.hp;
    if (a.box) p.box(-5, -4.5, 5, 4.5);
    p.disc(hp - 1.75 * sx, -1.2 * sy, 1.95 * s, M.heart, { tone: 3 });
    p.disc(hp + 1.75 * sx, -1.2 * sy, 1.95 * s, M.heart, { tone: 3 });
    p.poly([hp - 3.6 * sx, -0.6 * sy, hp + 3.6 * sx, -0.6 * sy, hp + 0.3, 3.4 * sy, hp - 0.3, 3.4 * sy], M.heart, { tone: 3, raw: true });
    p.rim(M.heart, 1, 1, 2, s > 0.7 ? 0.5 : 0);            // 右下一圈暗：有分量
    p.rim(M.heart, -1, -1, 4);                              // 左上一圈亮
    if (s > 0.7) p.ell(hp - 2.0 * sx, -1.7 * sy, 1.0 * s, 0.65 * s, M.heart, { rot: -0.6, tone: 4, over: M.heart, thin: true });
    p.dot(hp - (s > 0.7 ? 2.5 : 2.0) * sx, -(s > 0.7 ? 2.2 : 1.8) * sy, M.white, 4, { over: M.heart, lock: true });      // 高光
    p.outline();
    if (s > 0.7) p.soften();
  }

  // 感叹号：上粗下细的一竖，下面一个圆点
  function bang(p) {
    var hp = p.hp;
    p.poly([hp - 1.25, -3.75, hp + 1.25, -3.75, hp + 0.75, 0.25, hp - 0.75, 0.25], M.gold, { tone: 3 });
    p.rect(hp - 0.75, 1.25, hp + 0.75, 2.75, M.gold, { tone: 3 });
    p.rim(M.gold, 1, 0, 2); p.rim(M.gold, -1, 0, 4);
    p.rim(M.gold, 0, 1, 2);
    p.dot(hp - 0.75, -3.5, M.gold, 5, { over: M.gold, lock: true });
    p.outline();
  }

  // 音符
  function note(p) {
    p.rect(0, -3, 1, 2, M.blue, { tone: 3 });
    p.poly([1, -3, 2.5, -1.5, 2.5, -0.5, 1, -2], M.blue, { tone: 3 });
    p.rim(M.blue, -1, 0, 4); p.rim(M.blue, 1, 1, 2);
    p.ell(-0.75, 2, 1.5, 1.05, M.blue, { rot: -0.35, f: 0.3 });
    p.outline(); p.soften();
  }

  // 睡觉的 Z：a = 边长
  function zed(p, a) {
    var h = a / 2, t = 1, d = a * 0.3;
    p.poly([-h, -h, h, -h, h, -h + t, -h + d, h - t, h, h - t, h, h, -h, h, -h, h - t, h - d, -h + t, -h, -h + t], M.zzz, { tone: 3 });
    p.bevel(M.zzz);
    p.outline();
  }

  // 问号
  function question(p) {
    var pts = [], i, n = 9;
    for (i = 0; i <= n; i++) { var an = PI * (1.05 + 1.2 * i / n); pts.push(Math.cos(an) * 1.5, -1.6 + Math.sin(an) * 1.5); }
    pts.push(0, 0.2, 0, 1.0);
    p.stroke(pts, 1, M.gold, { tone: 3 });
    p.disc(0, 2.5, 0.5, M.gold, { tone: 3 });
    p.bevel(M.gold);
    p.outline(); p.soften();
  }

  // 四角的小星星：a = 0 刚亮（小）/ 1 最亮 / 2 快灭了（只剩四个点）
  function spark(p, a) {
    var hp = p.hp, r = [1.75, 2.75, 2.75][a], w = [0.5, 0.75, 0.5][a];
    p.box(-3.5, -3.5, 4, 3.5);
    if (a === 2) {
      p.dot(hp, -2.5, M.gold, 4); p.dot(hp, 2.5, M.gold, 3); p.dot(hp - 2.5, 0, M.gold, 4); p.dot(hp + 2.5, 0, M.gold, 3);
      p.disc(hp, p.hp, 0.75, M.gold, { tone: 4 });
      p.dot(hp, 0, M.gold, 5, { lock: true });
      p.outline();
      return;
    }
    p.poly([hp, -r, hp + w, 0, hp, r, hp - w, 0], M.gold, { tone: 3, raw: true });
    p.poly([hp - r, 0, hp, -w, hp + r, 0, hp, w], M.gold, { tone: 3, raw: true });
    p.line(hp, -r + p.hp, hp, r - p.hp, M.gold, 3); p.line(hp - r + p.hp, 0, hp + r - p.hp, 0, M.gold, 3);      // 再细也至少有一个像素粗的十字
    p.disc(hp, 0, a ? 1.25 : 0.75, M.gold, { tone: 4, over: true });
    p.disc(hp, 0, a ? 0.75 : 0.25, M.gold, { tone: 5, over: true });
    p.outline();
  }

  // 汗 / 水滴：上尖下圆
  function sweat(p) {
    var hp = p.hp;
    p.disc(hp, 1, 1.25, M.water, { f: 0.2 });
    p.poly([hp - 1.25, 0.5, hp, -2.75, hp + 1.25, 0.5], M.water, { tone: 3, raw: true });
    p.line(hp, -2.5, hp, 0, M.water, 3);
    p.rim(M.water, -1, -1, 4);
    p.dot(hp - 0.75, 0.75, M.white, 4, { over: M.water, lock: true });
    p.outline(); p.soften();
  }

  // 叫声：三道往外散开的短杠。a = 放大几倍（不写就是 1）
  function woof(p, a) {
    var A = [-0.95, 0, 0.95], hp = p.hp, k = a || 1, i;
    for (i = 0; i < 3; i++) {
      var c = Math.sin(A[i]), s = -Math.cos(A[i]), r0 = 2.3 * k, r1 = (i === 1 ? 4.3 : 4.0) * k, w = 0.5 * k, y0 = 1.5 * k;
      // 一根短杠 = 一个斜着的长方形
      p.poly([hp + c * r0 - s * w, y0 + s * r0 + c * w, hp + c * r1 - s * w, y0 + s * r1 + c * w,
              hp + c * r1 + s * w, y0 + s * r1 - c * w, hp + c * r0 + s * w, y0 + s * r0 - c * w], M.gold, { tone: 3, raw: true });
    }
    p.rim(M.gold, -1, -1, 4); p.rim(M.gold, 1, 1, 2);
    p.outline();
  }

  // 爪印（印在地上的，不描边）：a = 1 金毛的（大）/ 0 小腊肠的（小）
  function paw(p, a) {
    var NO = { tone: 2, ol: false }, hp = p.hp;
    if (a) {
      p.ell(hp, 0.75, 1.25, 1.0, M.soil, NO);                                                     // 掌垫
      p.disc(hp - 0.75, -1.25, 0.5, M.soil, NO); p.disc(hp + 0.75, -1.25, 0.5, M.soil, NO);      // 中间两个脚趾
      p.disc(hp - 1.75, -0.25, 0.5, M.soil, NO); p.disc(hp + 1.75, -0.25, 0.5, M.soil, NO);      // 两边的脚趾
    } else {
      p.rect(hp - 0.75, 0, hp + 0.75, 1, M.soil, NO);
      p.dot(hp - 0.5, -0.75, M.soil, 2, NO); p.dot(hp + 0.5, -0.75, M.soil, 2, NO);
      p.dot(hp - 1.0, -0.25, M.soil, 2, NO); p.dot(hp + 1.0, -0.25, M.soil, 2, NO);
    }
  }

  // 被踢起来的一小撮草：a.rot = 转到哪个角度（翻着跟头飞），a.m = 哪个时段的草色
  function sod(p, a) {
    var m = M[a.m || 'grass'], r = a.rot || 0, c = Math.cos(r), s = Math.sin(r), i;
    function X(x, y) { return x * c - y * s; }
    function Y(x, y) { return x * s + y * c; }
    var B = [[-2.1, -2.2, 3], [0, -3.2, 4], [2.1, -2.2, 3]];      // 三根草叶：尖在哪儿、第几级
    p.box(-3.5, -3.5, 3.5, 3.5);
    for (i = 0; i < B.length; i++) p.cap(X(0, 0.4), Y(0, 0.4), X(B[i][0], B[i][1]), Y(B[i][0], B[i][1]), 0.5, 0.2, m, { tone: B[i][2] });
    p.disc(X(0, 0.9), Y(0, 0.9), 0.75, M.soil, { tone: 3 });
    p.outline();
  }

  // 小花（从上往下看，不描边，和草地上的花是一家）：a.m = 花瓣的材料，a.big = 大一号
  function bloom(p, a) {
    var m = M[a.m], hp = p.hp;
    p.disc(hp, 0, a.big ? 1.25 : 0.75, m, { tone: a.m === 'white' ? 4 : 3, ol: false });
    p.rim(m, 1, 1, 2);                                                   // 右下的花瓣背光
    p.disc(hp, 0, 0.25, M.yolk, { tone: a.m === 'yolk' ? 2 : 3, ol: false, lock: true });
  }

  // 萤火虫：a = 0 最亮 / 1 暗一点 / 2 灭着（只是一个小黑点）
  function firefly(p, a) {
    var hp = p.hp;
    p.box(-2, -2, 2.5, 2);
    if (a === 2) { p.dot(hp, 0, M.dark, 2, { ol: false, a: 0.7 }); return; }
    p.disc(hp, 0, a ? 1.25 : 1.75, M.glow, { tone: 3, ol: false, a: a ? 0.14 : 0.2 });
    p.disc(hp, 0, a ? 0.75 : 1.25, M.glow, { tone: 3, ol: false, a: a ? 0.3 : 0.45 });
    if (!a) p.disc(hp, 0, 0.75, M.glow, { tone: 4, ol: false, a: 0.85 });
    p.dot(hp, 0, M.glow, a ? 3 : 5, { ol: false });
  }

  // 飘落的叶子：a.f = 0 平着 / 1 斜过来 / 2 侧着只剩一条 / 3 翻到另一面；a.m = 颜色
  function leaf(p, a) {
    var m = M[a.m], f = a.f, hp = p.hp;
    p.box(-2.5, -2, 3, 2);
    if (f === 2) { p.line(hp - 1.2, 0.8, hp + 1.2, -0.8, m, 2); p.outline(); return; }
    var rot = f === 3 ? 0.6 : -0.6, ry = f === 1 ? 0.55 : 0.95;
    p.ell(hp, 0, 1.75, ry, m, { rot: rot, tone: f === 3 ? 2 : 3 });
    p.rim(m, -1, -1, f === 3 ? 3 : 4);
    p.line(hp - 1.0, f === 3 ? -0.6 : 0.6, hp + 1.0, f === 3 ? 0.6 : -0.6, m, 1, { over: m });       // 叶脉
    p.outline();
  }

  // ---------- 名字、画法、参数、说明（有说明的是第二版没有的新图）----------
  var SPRITES = [
    ['bone', bone],
    ['bfly_a', butterfly, { wing: 0, m: 'pink' }],
    ['bfly_b', butterfly, { wing: 1, m: 'pink' }],
    ['bfly_c', butterfly, { wing: 2, m: 'pink' }, '粉蝴蝶：翅膀往下压的那一帧（扇翅膀按 a b c b 轮着来）'],
    ['bfly_rest', butterfly, { wing: 3, m: 'pink' }, '粉蝴蝶：停着不飞（侧面，翅膀合起来；头朝左）'],
    ['bfly2_a', butterfly, { wing: 0, m: 'sky' }],
    ['bfly2_b', butterfly, { wing: 1, m: 'sky' }],
    ['bfly2_c', butterfly, { wing: 2, m: 'sky' }, '蓝蝴蝶：翅膀往下压的那一帧'],
    ['bfly2_rest', butterfly, { wing: 3, m: 'sky' }, '蓝蝴蝶：停着不飞'],
    ['puff0', puff, 0],
    ['puff1', puff, 1],
    ['puff2', puff, 2],
    ['puff3', puff, 3, '灰尘的第四帧：只剩几点'],
    ['fx_heart', heart, { s: 1, box: 1 }],
    ['fx_heart_pop0', heart, { s: 0.55, box: 1 }, '爱心"啵"地冒出来：先是小小的一颗'],
    ['fx_heart_pop1', heart, { s: 1.12, sx: 1.08, sy: 0.96, box: 1 }, '爱心冒出来：涨得比正常大一圈'],
    ['fx_heart_pop2', heart, { s: 0.94, sx: 0.96, sy: 1.04, box: 1 }, '爱心冒出来：缩回来一点，然后换成 fx_heart'],
    ['fx_hs', heart, { s: 0.5 }],
    ['fx_bang', bang],
    ['fx_note', note],
    ['fx_z', zed, 5],
    ['fx_zs', zed, 4],
    ['fx_q', question],
    ['fx_spark', spark, 1],
    ['fx_spark0', spark, 0, '小星星闪一下：刚亮（小）'],
    ['fx_spark1', spark, 1, '小星星闪一下：最亮（和 fx_spark 一样）'],
    ['fx_spark2', spark, 2, '小星星闪一下：快灭了，只剩几个点'],
    ['fx_sweat', sweat],
    ['fx_woof', woof],
    ['paw', paw, 1, '爪印（金毛的，印在地上；左右脚用 flip 翻一下）'],
    ['paw_s', paw, 0, '爪印（小腊肠的）'],
    ['sod0', sod, { rot: 0 }, '被踢 / 刨起来的一小撮草，翻着跟头飞：第 1 帧'],
    ['sod1', sod, { rot: 2.1 }, '一小撮草：第 2 帧'],
    ['sod2', sod, { rot: 4.2 }, '一小撮草：第 3 帧'],
    ['sod0_dusk', sod, { rot: 0, m: 'grassD' }, '一小撮草（傍晚的草色）：第 1 帧'],
    ['sod1_dusk', sod, { rot: 2.1, m: 'grassD' }, '一小撮草（傍晚）：第 2 帧'],
    ['sod2_dusk', sod, { rot: 4.2, m: 'grassD' }, '一小撮草（傍晚）：第 3 帧'],
    ['sod0_night', sod, { rot: 0, m: 'grassN' }, '一小撮草（夜里的草色）：第 1 帧'],
    ['sod1_night', sod, { rot: 2.1, m: 'grassN' }, '一小撮草（夜里）：第 2 帧'],
    ['sod2_night', sod, { rot: 4.2, m: 'grassN' }, '一小撮草（夜里）：第 3 帧'],
    ['bloom_w', bloom, { m: 'white' }, '草地上的小白花（从上往下看，不描边，和草地自己长的花一个样）'],
    ['bloom_y', bloom, { m: 'yolk' }, '草地上的小黄花'],
    ['bloom_p', bloom, { m: 'rose' }, '草地上的小粉花'],
    ['bloom2_w', bloom, { m: 'white', big: 1 }, '大一号的小白花'],
    ['bloom2_y', bloom, { m: 'yolk', big: 1 }, '大一号的小黄花'],
    ['bloom2_p', bloom, { m: 'rose', big: 1 }, '大一号的小粉花'],
    ['firefly0', firefly, 0, '萤火虫：亮着（带一圈光晕，夜里的草地上用）'],
    ['firefly1', firefly, 1, '萤火虫：暗下去一半'],
    ['firefly2', firefly, 2, '萤火虫：灭着，只是一个小点'],
    ['leaf_a0', leaf, { f: 0, m: 'ochre' }, '飘落的黄叶：平着'],
    ['leaf_a1', leaf, { f: 1, m: 'ochre' }, '飘落的黄叶：斜过来'],
    ['leaf_a2', leaf, { f: 2, m: 'ochre' }, '飘落的黄叶：侧着，只剩一条线'],
    ['leaf_a3', leaf, { f: 3, m: 'ochre' }, '飘落的黄叶：翻到另一面'],
    ['leaf_b0', leaf, { f: 0, m: 'rust' }, '飘落的红叶：平着'],
    ['leaf_b1', leaf, { f: 1, m: 'rust' }, '飘落的红叶：斜过来'],
    ['leaf_b2', leaf, { f: 2, m: 'rust' }, '飘落的红叶：侧着'],
    ['leaf_b3', leaf, { f: 3, m: 'rust' }, '飘落的红叶：翻到另一面'],
  ];

  var built = {};
  function build(cfg, R) {
    R = resOf(R);
    if (built[R]) return built[R];
    var S = {}, i;
    for (i = 0; i < SPRITES.length; i++) {
      var e = SPRITES[i], p = padOf(R);
      e[1](p, e[2]);
      S[e[0]] = p.done(e[0] + '@' + R);
    }
    return (built[R] = S);
  }
  var EXTRA = [];
  SPRITES.forEach(function (e) { if (e[3]) EXTRA.push({ name: e[0], what: e[3] }); });

  // RAMPS：每种材料的六级颜色（"#rrggbb"），给想配同色碎屑的人用
  G.PET_FX = { build: build, ball: ball, shadow: shadow, px: px, EXTRA: EXTRA, RAMPS: RAMPS };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
