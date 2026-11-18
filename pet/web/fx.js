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
//  · 新颜色：在 RAMPS 里加一行（六级，从描边色到高光）。
//  · 同一样东西的几种状态（空碗 / 半碗 / 满碗）：同一个函数、不同的参数，表里各占一行。
//  · 几帧动画：函数开头先 p.box(...) 说好同一个摆放框，换帧时才不会跳。
//  · 放在地上的东西：把地面画在 y = 0，原点就是"脚下那一点"。
//  · 要告诉引擎"手 / 嘴拿哪儿"：p.anchor('grip', x, y)，图上就多一个 grip: [像素 x, 像素 y]。
//  · 歪着、倒着的样子：p.move(0, 0, 角度) 之后照原样画，光还是从左上来。
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
    // ---- 第二批：喂饭、便便、互动用的小道具 ----
    choc:  ['#3b1c22', '#59302a', '#744230', '#8f5b3b', '#b07f52', '#d4ab78'],     // 便便：牛奶巧克力色（不是腊肠的红棕）
    cred:  ['#572133', '#7d2839', '#992e40', '#d64945', '#f5806e', '#ffc4ad'],     // 金毛的碗、牵引绳（和它的红项圈一个色）
    cblue: ['#29224c', '#2f3a7a', '#3a4d99', '#4981d6', '#7ac0f5', '#c4e8ff'],     // 腊肠的碗（和它的蓝项圈一个色）
    kib:   ['#5e3020', '#7a3925', '#a86239', '#d18e54', '#edbc7b', '#fce2ac'],     // 狗粮
    kraft: ['#5a3b26', '#86603f', '#a98052', '#c9a06a', '#e2c28e', '#f4e0b6'],     // 牛皮纸袋、藤篮
    steel: ['#4b4868', '#5f5c80', '#8e8fad', '#bcc0d1', '#dcdde8', '#f0ece1'],     // 垃圾桶、夹子、水碗（浅钢色，带一点紫）
    navy:  ['#1f2440', '#283157', '#323f69', '#3a4c7a', '#566ba1', '#8094c4'],     // 他西装的藏青：夹子的长柄、桶脚、书皮
    cream: ['#61342b', '#ad7753', '#d6a774', '#f2d29b', '#ffefc2', '#fffae0'],     // 金毛的浅色毛（毛团、飘起来的毛）
    coat:  ['#4a221e', '#854728', '#b87133', '#e6a94e', '#fad378', '#ffeea8'],     // 金毛的毛色（想到的尾巴）
    wood:  ['#3d2420', '#5e3a2a', '#7f5236', '#a06d44', '#c38f5e', '#e0b886'],     // 树枝、梳子背
    paper: ['#5f5c80', '#a3a3bd', '#cfd0dc', '#f7f5e9', '#ffffff', '#ffffff'],     // 白纸、白杯子、照片的白边
    shoe:  ['#150f17', '#2a2024', '#3b3036', '#4f434b', '#6e6068', '#958890'],     // 他的皮鞋（想到的鞋）
    flame: ['#8a3a12', '#d9601c', '#ff9a2e', '#ffd34a', '#fff2a0', '#ffffff'],     // 蜡烛的火苗、灯笼里的光
    lilac: ['#4a3a6b', '#6d5a99', '#9c88c9', '#c7b6ea', '#e6dcff', '#ffffff'],     // 花束里的紫花
    check: ['#5c2a35', '#8a4450', '#b5626a', '#d98b8b', '#ecb8b0', '#f7e6dc'],     // 野餐布（灰粉格子，两种不扎眼的颜色）
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
  //    p.move(dx, dy, rot) / p.home()            之后画的东西整体挪到 (dx, dy)、再转 rot 弧度 / 恢复原样（画"歪着、倒着"的同一样东西时用）
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
    this.home();
  };
  // 整体挪动 / 转动：之后给出的坐标都先转 rot、再挪 (dx, dy)
  Pad.prototype.move = function (dx, dy, rot) { this.tx = dx || 0; this.ty = dy || 0; this.tr = rot || 0; this.tc = Math.cos(this.tr); this.ts = Math.sin(this.tr); };
  Pad.prototype.home = function () { this.move(0, 0, 0); };
  // 世界单位 → 画板上的像素位置
  Pad.prototype.X = function (x, y) { return this.cx + (this.tx + x * this.tc - y * this.ts) * this.R; };
  Pad.prototype.Y = function (x, y) { return this.cy + (this.ty + x * this.ts + y * this.tc) * this.R; };
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
    var R = this.R, px = this.X(cx, cy), py = this.Y(cx, cy), ax = rx * R, ay = ry * R, rot = rx === ry ? 0 : (o.rot || 0) + this.tr;
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
    var R = this.R, ax = this.X(x0, y0), ay = this.Y(x0, y0), bx = this.X(x1, y1), by = this.Y(x1, y1);
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
      var x = this.X(pts[k * 2], pts[k * 2 + 1]), y = this.Y(pts[k * 2], pts[k * 2 + 1]);
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
      var x = this.X(pts[k * 2], pts[k * 2 + 1]), y = this.Y(pts[k * 2], pts[k * 2 + 1]);
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
    var i = floor(this.X(x0, y0)), j = floor(this.Y(x0, y0)), i1 = floor(this.X(x1, y1)), j1 = floor(this.Y(x1, y1));
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
    var s = Math.max(1, round(this.R / 2)), i = floor(this.X(x, y)), j = floor(this.Y(x, y));
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
  Pad.prototype.anchor = function (name, x, y) { (this.marks || (this.marks = {}))[name] = [this.X(x, y), this.Y(x, y)]; };
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
    if (this.marks) for (var name in this.marks) im[name] = [this.marks[name][0] - x0, this.marks[name][1] - y0];
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
  // 骨头（也是狗饼干）：中间一根杆，两头各两个圆疙瘩
  function bone(p) {
    var hp = p.hp;
    p.cap(hp - 2.5, hp, hp + 2.5, hp, 0.75, 0.75, M.ivory, { f: 0.15 });
    p.disc(hp - 2.75, hp - 1, 1.25, M.ivory); p.disc(hp - 2.75, hp + 1, 1.25, M.ivory);
    p.disc(hp + 2.75, hp - 1, 1.25, M.ivory); p.disc(hp + 2.75, hp + 1, 1.25, M.ivory);
    p.outline(); p.soften();
  }

  // 蝴蝶：a.wing = 0 翅膀举着 / 1 平展 / 2 往下压 / 3 停着（侧面，翅膀合起来）；a.m = 翅膀的颜色
  function butterfly(p, a) {
    var m = M[a.m], w = a.wing, s, hp = p.hp, NO = { ol: false, lock: true };
    p.box(-4.5, -3.5, 5, 2.5);
    if (w === 3) {             // 停着：侧面，翅膀竖着合在一起，头朝左
      p.ell(hp + 1.0, 0.1, 1.0, 0.9, m, { tone: 2 });                                       // 后翅
      p.poly([hp - 0.75, 0.75, hp - 0.25, -3.25, hp + 1.25, -2.75, hp + 2.0, -0.75, hp + 0.75, 0.75], m, { tone: 3 });    // 前翅
      p.rim(m, 1, 0, 2);                                                                    // 翅膀靠外的一圈深一点，像花纹
      p.rim(m, -1, -1, 4);
      p.ell(hp + 0.5, -1.6, 0.5, 0.9, m, { rot: 0.3, tone: 4, over: m, thin: true });
      p.dot(hp + 0.75, -2.5, M.white, 4, { over: m, lock: true });
      p.dot(hp + 1.0, -0.25, M.white, 4, { over: m, lock: true });
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
    var m = M[a.m || 'grass'], i;
    var B = [[-2.1, -2.2, 3], [0, -3.2, 4], [2.1, -2.2, 3]];      // 三根草叶：尖在哪儿、第几级
    p.box(-3.5, -3.5, 3.5, 3.5);
    p.move(0, 0, a.rot);                                           // 整个转过去画
    for (i = 0; i < B.length; i++) p.cap(0, 0.4, B[i][0], B[i][1], 0.5, 0.2, m, { tone: B[i][2] });
    p.disc(0, 0.9, 0.75, M.soil, { tone: 3 });
    p.home();
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

  // ============================================================
  //  第二批：开饭、便便、收拾（R6），还有互动用的小道具（R5）
  //  地上的东西：原点在底边正中（y = 0 是地）。拿在手里 / 叼在嘴里的：图上有 grip（像素坐标）。
  //  规矩（R6 4.4）：圆圆的、像玩具、有一点光泽；不湿、不脏、不裂、不滴、不冒烟雾。
  // ============================================================
  // 一个只看整数的小随机数（同一个 n 永远一样）
  function hsh(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; }
  // 一颗颗的小粒子（狗粮）：左上亮、右下暗
  function pellet(sh) { return function (ux, uy) { var s = ux + uy; return (s < -0.45 ? 4 : (s > 0.45 ? 2 : 3)) + (sh || 0); }; }
  // 在椭圆 (cx, cy, rx, ry) 的上半边里一颗挨一颗地摆狗粮（只摆中心在 yMax 以上的）；先铺一层最暗的当缝
  function kibbles(p, cx, cy, rx, ry, yMax, seed) {
    var m = M.kib, base = [], k, P = [], tries = 0, q;
    for (k = 0; k <= 16; k++) { var t = PI + PI * k / 16; base.push(cx + rx * Math.cos(t), Math.min(yMax, cy + ry * Math.sin(t))); }
    p.poly(base, m, { tone: 1 });
    var n = Math.ceil(PI * rx * ry / 2 * 1.5) + 2;
    while (P.length < n && tries < n * 40) {
      tries++;
      var x = cx + (hsh(seed * 7919 + tries * 2) * 2 - 1) * rx, y = cy - hsh(seed * 104729 + tries * 2 + 1) * ry * 1.05;
      var ex = (x - cx) / rx, ey = (y - cy) / ry;
      if (ex * ex + ey * ey > 1 || y > yMax) continue;
      for (q = 0; q < P.length; q++) { var dx = P[q][0] - x, dy = P[q][1] - y; if (dx * dx + dy * dy < 0.75) break; }
      if (q === P.length) P.push([x, y]);
    }
    P.sort(function (A, B) { return A[1] - B[1]; });            // 后面的先画，前面的压在上面
    for (k = 0; k < P.length; k++) p.disc(P[k][0], P[k][1], 0.6, m, { tone: pellet(hsh(k * 13 + seed) < 0.18 ? 1 : 0) });
  }

  // 碗（侧面、稍微从上往下看）：碗口是一个扁椭圆——上面一道是对面的碗沿，下面一道是靠近的碗沿，中间是碗里面；
  // 碗身在碗口下面，上宽下窄，左边亮右边暗。
  // a.m 颜色；a.w 宽、a.h 高（连描边，空碗的尺寸）；a.tp 碗底比碗沿窄多少；a.ry 碗口椭圆的半高；
  // a.s：'empty' 空碗 / 'half' 半碗 / 'full' 满得冒尖 / 'water' 满满的水 / 'low' 水少了一点；
  // a.g 水面的亮光换个地方（水碗闪一闪的第二帧）；a.bone 碗身上印一个小骨头；a.y 整个往上挪多少（叠碗用）
  function bowl(p, a) {
    var m = M[a.m], hw = a.w / 2 - 0.5, oy = -(a.y || 0), ry = a.ry || 1.25, top = oy - a.h + ry + 0.5, bot = hw - (a.tp || 1.5), s = a.s;
    // 碗身
    p.poly([-hw, top, hw, top, bot, oy - 0.5, -bot, oy - 0.5], m, { tone: function (x, y) {
      var u = x / hw, t = u < -0.6 ? 4 : (u > 0.55 ? 2 : 3);
      if (y > oy - 1.0) t--;
      return t;
    } });
    p.rect(-hw + 1.0, top + ry + 0.5, -hw + 1.5, top + ry + 1.0 + (a.h > 5 ? 0.5 : 0), m, { tone: 5, lock: true });      // 左上一小块高光
    if (a.bone && R2(p)) {
      // 一个小骨头（亮一级）
      var by = round((top + ry + oy) / 2 * 2) / 2 + 0.25, B = { tone: 4, lock: true };
      p.rect(-1.75, by - 0.75, -0.75, by - 0.25, m, B); p.rect(0.75, by - 0.75, 1.75, by - 0.25, m, B);
      p.rect(-1.25, by - 0.25, 1.25, by + 0.25, m, B);
      p.rect(-1.75, by + 0.25, -0.75, by + 0.75, m, B); p.rect(0.75, by + 0.25, 1.75, by + 0.75, m, B);
    }
    // 碗口：外面一圈是碗沿（亮），里面
    p.ell(0, top, hw, ry, m, { tone: 4 });
    p.rect(-hw + 0.5, top - ry, -hw * 0.2, top - ry + 0.5, m, { tone: 5, over: m, lock: true });                        // 对面碗沿上的高光
    var irx = hw - 1, iry = ry - 0.5;
    if (s === 'water' || s === 'low') {
      p.ell(0, top, irx, iry, m, { tone: 2 });                                                                         // 碗壁里面
      var low = s === 'low' ? 0.5 : 0;
      p.ell(0, top + low * 0.5, irx - low, iry - low * 0.5, M.water, { tone: 3, over: m });                            // 水面
      p.rim(M.water, 0, -1, 2);                                                                                        // 水的边：一道蓝线
      var gx = a.g ? hw * 0.25 : -hw * 0.5, gy = top + low * 0.5;
      p.rect(gx, gy - 0.25, gx + (a.g ? 0.5 : 1.0), gy + 0.25, M.water, { tone: 5, over: M.water, lock: true });         // 一点白光
      if (a.g) p.dot(-hw * 0.5, gy - 0.25, M.water, 4, { over: M.water, lock: true });
    } else if (s === 'full') {
      p.ell(0, top, irx, iry, m, { tone: 1 });
      kibbles(p, 0, top, irx + 0.25, a.mound || 2.5, top + 0.25, a.w * 5);
    } else {
      p.ell(0, top, irx, iry, m, { tone: 1 });
      p.rim(m, 0, 1, 2);
      if (s === 'half') kibbles(p, 0, top + 0.25, irx - 0.25, iry + 0.25, top + 0.5, a.w * 3);
    }
    crescent(p, m, top, hw, ry);
  }
  // 靠近的那一道碗沿（碗口椭圆下面那一弯），压在碗里的东西前面
  function crescent(p, m, top, hw, ry) {
    var pts = [], i, n = 16;
    for (i = 0; i <= n; i++) { var t = PI * i / n; pts.push(hw * Math.cos(t), top + ry * Math.sin(t)); }
    for (i = n; i >= 0; i--) { var u = PI * i / n; pts.push((hw - 1) * Math.cos(u), top + (ry - 0.5) * Math.sin(u)); }
    p.poly(pts, m, { tone: function (x) { return x < -hw * 0.3 ? 5 : (x > hw * 0.6 ? 3 : 4); } });
  }
  function R2(p) { return p.R >= 2; }
  function bowlDraw(p, a) { bowl(p, a); p.outline(); if (a.grip) p.anchor('grip', -(a.w / 2 - 1), -(a.h - 1.5)); }
  // 叠起来的碗：蓝碗套在红碗里；a.bag = 狗粮袋立在里面（他抱着走的时候）
  function bowlStack(p, a) {
    bowl(p, { m: 'cred', w: 14, h: 6, tp: 1.5, s: 'empty', bone: 1 });
    bowl(p, { m: 'cblue', w: 10, h: 4.5, tp: 1.0, ry: 1.0, y: 3.0, s: 'empty' });
    if (a.bag) {
      p.move(0, -5.5); kbag(p, { inStack: 1 }); p.home();
      crescent(p, M.cblue, -3.0 - 4.5 + 1.0 + 0.5, 4.5, 1.0);
    }
    crescent(p, M.cred, -6 + 1.25 + 0.5, 6.5, 1.25);
    p.outline();
    p.anchor('grip', 0, 0);
  }

  // 狗粮袋（牛皮纸）：口卷了两道、侧面一道折、正面一张小标签上一个红爪印。a.pour = 倒着（转 135°，口朝下打开）
  function kbag(p, a) {
    var k = M.kraft, pour = a && a.pour;
    if (pour) p.move(0.5, -4.75, 2.36);                 // 转过去倒；按袋子正中画
    var dy = pour ? 4.75 : 0;
    p.poly([-2.75, -8 + dy, 2.75, -8 + dy, 3.0, -0.5 + dy, -3.0, -0.5 + dy], k, { tone: 3 });
    p.rect(1.75, -8 + dy, 3.0, -0.5 + dy, k, { tone: 2, over: k });                     // 侧面（背光）
    p.line(1.75, -7.5 + dy, 1.75, -1.0 + dy, k, 1, { over: k });                         // 侧面的折
    p.rim(k, -1, 0, 4);
    p.rect(-3.0, -1.0 + dy, 3.0, -0.5 + dy, k, { tone: 2, over: k });                    // 底下压一道暗
    p.line(-2.25, -7.5 + dy, -1.25, -6.5 + dy, k, 4, { over: k });                      // 纸上的一道褶（亮）
    if (!pour) {
      p.rect(-3.0, -9.5, 3.0, -8, k, { tone: 3 });                                      // 口卷了两道
      p.rect(-3.0, -9.5, 3.0, -9.0, k, { tone: 4 });
      p.line(-2.75, -8.75, 2.75, -8.75, k, 1, { over: k });
      p.rect(1.75, -9.0, 3.0, -8, k, { tone: 2, over: k });
      p.dot(-2.25, -9.5, k, 5, { lock: true });
    } else {
      p.ell(0, -8.25 + dy, 3.0, 0.9, k, { tone: 4 });                                   // 口张开：里面暗
      p.ell(0, -8.1 + dy, 2.3, 0.55, k, { tone: 1, over: k });
    }
    // 标签和红爪印
    var cx = -0.6, cy = -3.9 + dy, L = { lock: true }, pm = M.cred;
    p.rect(cx - 1.5, cy - 2.0, cx + 1.75, cy + 1.75, M.paper, { tone: 3, lock: true, ol: false });
    p.rect(cx + 1.25, cy - 2.0, cx + 1.75, cy + 1.75, M.paper, { tone: 2, lock: true, ol: false });
    p.rect(cx - 0.5, cy, cx + 0.75, cy + 1.0, pm, { tone: 3, lock: true });
    p.dot(cx - 0.75, cy - 0.5, pm, 3, L); p.dot(cx - 0.25, cy - 1.0, pm, 3, L); p.dot(cx + 0.5, cy - 1.0, pm, 3, L); p.dot(cx + 1.0, cy - 0.5, pm, 3, L);
    if (!a || !a.inStack) {
      if (pour) {
        p.home();
        kibbles(p, 4.4, 1.2, 1.0, 0.8, 1.6, 7);
        p.outline();
        p.anchor('grip', -2.2, -3.6);
      } else {
        p.outline();
        p.anchor('grip', -3.0, -4.5);
      }
    }
  }
  // 倒出来的一小股狗粮：a = 0 / 1 两帧（错开半颗，连着放像在往下流）
  function kfall(p, a) {
    var m = M.kib, i, P = a ? [[0.1, 1.1], [-0.5, 2.9], [0.4, 4.6], [-0.2, 6.4]] : [[-0.3, 0.2], [0.5, 2.0], [-0.4, 3.7], [0.3, 5.5], [-0.1, 7.3]];
    p.box(-1.5, -0.5, 1.5, 8);
    for (i = 0; i < P.length; i++) p.disc(P[i][0], P[i][1], 0.6, m, { tone: pellet(0), ol: false });
    p.rim(m, 1, 1, 1);
  }
  // 掉在地上的一颗狗粮（1.5 × 1）
  function kbit(p) {
    p.ell(0, -0.5, 0.75, 0.5, M.kib, { ol: false, tone: function (ux, uy) { var s = ux + uy * 1.4; return s < -0.5 ? 5 : (s > 0.5 ? 1 : 3); } });
  }

  // 便便：像挤出来的一圈一圈巧克力奶油。每一层是一条圆圆的带子，左上一点高光，下面压一道深色的缝；底是平的。
  // a.big 金毛的（三层，6 × 5）/ 小的（腊肠的，4 × 3.5）；a.m 颜色；a.pop 刚冒出来那一帧（矮 1 个像素、宽 2 个像素）；a.tw 多闪一个亮点
  function poop(p, a) {
    var m = M[a.m || 'choc'], px = 1 / p.R;
    // 每层：[中心 x, 中心 y, 半长（不算圆头）, 圆头半径]
    var T = a.big ? [[0, -1.25, 1.25, 1.25], [0.15, -2.85, 0.6, 1.0], [0.45, -4.0, 0.0, 0.6], [0.95, -4.4, 0.0, 0.3]]
                  : [[0, -1.0, 0.5, 1.0], [0.15, -2.2, 0.0, 0.75], [0.5, -2.95, 0.0, 0.3]];
    var H = a.big ? 4.6 : 3.1, W = a.big ? 5 : 3, sx = a.pop ? (W + 2 * px) / W : 1, sy = a.pop ? (H - px) / H : 1, i;
    if (a.big) p.box(-3.5, -5.5, 3.5, 0); else p.box(-2.5, -4, 2.5, 0);
    for (i = 0; i < T.length; i++) {
      var t = T[i], x0 = (t[0] - t[2]) * sx, x1 = (t[0] + t[2]) * sx, y = t[1] * sy, r = t[3] * (sx + sy) / 2;
      if (i) p.cap(x0, y + 0.5, x1, y + 0.5, r, r, m, { tone: 1, over: m });          // 压在下面那层上的一道缝
      p.cap(x0, y, x1, y, r, r, m, { tone: 3 });
      if (!i) p.rect(x0 - r, y, x1 + r, -0.5, m, { tone: 3 });                          // 平底
      p.rim(m, 0, -1, 4);
    }
    p.rim(m, 1, 0, 2); p.rim(m, 0, 1, 2);
    for (i = 0; i < T.length; i++) if (T[i][3] >= 0.6) p.dot((T[i][0] - T[i][2]) * sx - T[i][3] * 0.4, T[i][1] * sy - T[i][3] * 0.5, m, 5, { lock: true });   // 每层自己的小高光
    if (a.tw) p.dot(T[1][0] * sx + 0.75, T[1][1] * sy - 0.5, m, 5, { lock: true });
    p.outline();
  }

  // 便便袋（淡紫色，看不见里面）：a = 'roll' 一小卷套在骨头形的盒子上 / 'open' 套在手上像个手套（口朝上）/ 'full' 系好的小袋子（两只"耳朵"）
  function pbag(p, a) {
    var m = M.zzz;
    if (a === 'roll') {
      var n = M.navy;
      p.cap(-1.3, 0, 1.3, 0, 0.75, 0.75, n, { f: 0.3 });                                   // 骨头形的小盒子
      p.disc(-1.55, -0.5, 0.6, n, { f: 0.3 }); p.disc(-1.55, 0.5, 0.6, n, { f: 0.3 });
      p.disc(1.55, -0.5, 0.6, n, { f: 0.3 }); p.disc(1.55, 0.5, 0.6, n, { f: 0.3 });
      p.rect(-0.75, -0.75, 0.75, 0.75, m, { tone: 3 });                                    // 中间露出一卷淡紫的袋子
      p.rect(-0.75, -0.75, 0.75, -0.25, m, { tone: 4 });
      p.dot(-0.5, -0.75, m, 5, { lock: true });
      p.line(0.25, -0.5, 0.25, 0.5, m, 2, { over: m });
      p.outline();
      p.anchor('grip', 0, 0);
      return;
    }
    if (a === 'open') {
      // 原点 = 手腕那里的袋口；袋子软软地套住整只手，指尖朝下
      p.ell(0, 2.85, 2.25, 1.9, m, { f: 0.35 });
      p.rect(-1.75, 0.75, 1.75, 2.75, m, { tone: function (x) { return x < -0.75 ? 4 : (x > 1.0 ? 2 : 3); } });
      p.ell(-2.0, 2.25, 0.65, 0.85, m, { f: 0.3 });                                         // 大拇指那里鼓一点
      p.rect(-1.5, 0, 1.5, 0.75, m, { tone: 4 });                                           // 袋口收在手腕上
      p.dot(-1.5, -0.5, m, 4); p.dot(-0.25, -0.5, m, 4); p.dot(1.0, -0.5, m, 4);          // 袋口皱起来的几个小尖
      p.line(-0.5, 1.75, 0.25, 2.75, m, 2, { over: m }); p.line(0.75, 3.25, 1.25, 4.0, m, 2, { over: m });   // 两道软软的褶
      p.dot(-1.0, 2.0, m, 5, { lock: true });
      p.outline(); p.soften();
      p.anchor('grip', 0, 0);
      return;
    }
    // 系好的：上面一个小结、两只耳朵，下面圆圆的一兜
    p.ell(0, 3.0, 1.9, 1.65, m, { f: 0.25 });
    p.poly([-0.5, 0.25, 0.5, 0.25, 1.3, 1.75, -1.3, 1.75], m, { tone: function (x) { return x < -0.4 ? 4 : (x > 0.6 ? 2 : 3); } });
    p.ell(-0.95, -0.6, 0.85, 0.45, m, { rot: 0.85, tone: 4 }); p.ell(0.95, -0.6, 0.85, 0.45, m, { rot: -0.85, tone: 3 });   // 两只耳朵
    p.disc(0, 0.1, 0.5, m, { tone: 2 });                                                   // 小结
    p.dot(-0.9, 2.25, m, 5, { lock: true });
    p.outline(); p.soften();
    p.anchor('grip', 0, 0.1);
  }

  // 夹子：细长的藏青长柄，下面一个小小的钢夹。a = 'carry' 拿着走（夹子微微张开）/ 'full' 夹子合上 / 'use' 斜着，夹子在地上张开
  function scooper(p, a) {
    var n = M.navy, s = M.steel, use = a === 'use';
    var jaw = function (open) {
      // 两片夹子，像一对小贝壳；原点在夹子最下面的中点
      var g = open ? 0.9 : 0;
      p.ell(-0.7 - g * 0.5, -2.0, 0.9, 2.0, s, { rot: open ? 0.35 : 0.05, f: 0.3 });
      p.ell(0.7 + g * 0.5, -2.0, 0.9, 2.0, s, { rot: open ? -0.35 : -0.05, f: 0.3 });
      if (!open) p.line(0, -3.6, 0, -0.4, s, 1, { over: s });
      p.rect(-0.75, -4.75, 0.75, -3.75, n, { tone: 2 });                                   // 夹子和长柄接起来的地方
    };
    if (!use) {
      p.rect(-0.5, -17.5, 0.5, -4.5, n, { tone: function (x) { return x < 0 ? 4 : 3; } });  // 长柄
      p.rect(-0.75, -18, 0.75, -16.5, n, { tone: 4 });                                     // 柄头
      jaw(a === 'carry');
      p.outline();
      p.anchor('grip', 0, -11);
      return;
    }
    // 用的时候：斜着；夹子贴在地上张开
    jaw(true);
    p.move(0, -4.5, -0.62);
    p.rect(-0.5, -13.0, 0.5, 0.0, n, { tone: function (x, y) { return 3; } });
    p.rim(n, -1, -1, 4);
    p.rect(-0.75, -13.5, 0.75, -12.0, n, { tone: 4 });
    p.anchor('grip', 0, -6.5);
    p.home();
    p.outline();
  }

  // 脚踩的小垃圾桶（新的、干干净净）：圆顶盖子、两只藏青小脚、前面一个踏板。
  // a = 'closed' / 'open' 盖子掀开 30° / 'pop' 冒出来那一下（压扁一帧）
  function bin(p, a) {
    var s = M.steel, n = M.navy, sx = a === 'pop' ? 1.12 : 1, sy = a === 'pop' ? 0.86 : 1, top = -9 * sy;
    p.box(-5.5, -12.5, 5.5, 0);
    p.rect(-3 * sx, -1.5, -2 * sx, 0, n, { tone: 2 }); p.rect(2 * sx, -1.5, 3 * sx, 0, n, { tone: 2 });     // 两只脚
    p.poly([-4 * sx, top, 4 * sx, top, 3.5 * sx, -1.5, -3.5 * sx, -1.5], s, { tone: function (x) { var u = x / (4 * sx); return u < -0.7 ? 5 : (u > 0.6 ? 2 : 3); } });
    p.rim(s, 0, 1, 2);
    p.rect(-3.5 * sx, top + 1.5, 3.5 * sx, top + 2.0, s, { tone: 2, over: s });                             // 一道箍
    p.rect(-1.25 * sx, -2.25, 1.25 * sx, -1.5, n, { tone: 3 });                                              // 踏板
    if (a === 'open') {
      p.ell(0, top, 3.75, 0.75, s, { tone: 1 });                                                             // 桶口（里面暗，什么都看不见）
      p.move(4.25, top, 0.52);                                                                                // 盖子绕右边的合页掀起来
      p.ell(-4.25, -0.75, 4.25, 1.4, s, { tone: function (ux, uy) { return uy > 0.35 ? -1 : (ux < -0.4 ? 5 : 4); } });
      p.rect(-8.5, -0.5, 0, 0.5, s, { tone: 3 });
      p.home();
    } else {
      p.ell(0, top - 0.75, 4.25 * sx, 1.4 * sy, s, { tone: function (ux, uy) { return uy > 0.35 ? -1 : (ux < -0.4 ? 5 : 4); } });
      p.rect(-4.25 * sx, top - 0.5, 4.25 * sx, top + 0.5, s, { tone: 3 });
      p.rect(-0.5, top - 2.75 * sy, 0.5, top - 2.0 * sy, n, { tone: 3 });                                    // 盖子上的小把手
    }
    p.outline();
  }

  // 他的白手帕：拎着一个角，一道折痕
  function hanky(p) {
    var m = M.paper;
    p.poly([0, 0, 2.0, 2.0, 0.25, 4.0, -2.0, 2.0], m, { tone: function (x, y) { return x < -0.25 ? 4 : 3; } });
    p.line(0, 0.5, 0.25, 3.5, m, 2, { over: m });
    p.rim(m, 1, 1, 2);
    p.outline();
    p.anchor('grip', 0, 0.25);
  }

  // 小雏菊（不描边，和草地上的花一家）：a = 0 刚冒出来的芽 / 1 开花
  function daisy(p, a) {
    var g = M.grass, w = M.white, NO = { ol: false };
    if (!a) {
      p.line(0, -0.5, 0, -2.0, g, 2, NO);
      p.line(-0.75, -2.5, -0.25, -2.0, g, 4, NO); p.line(0.75, -2.5, 0.25, -2.0, g, 3, NO);
      p.dot(-1.0, -2.75, g, 4, NO); p.dot(1.0, -2.75, g, 3, NO);
      return;
    }
    p.line(p.hp, -0.5, p.hp, -3.5, g, 2, NO);                                            // 茎
    p.line(p.hp + 0.5, -1.5, p.hp + 1.25, -2.0, g, 4, NO); p.dot(p.hp + 1.5, -2.25, g, 4, NO);   // 一片叶子
    p.disc(p.hp, -4.25, 1.75, w, { tone: function (ux, uy) { return ux + uy > 0.7 ? 2 : 3; }, ol: false });
    p.dot(p.hp - 1.5, -4.25, w, 2, { ol: false }); p.dot(p.hp + 1.25, -4.25, w, 2, { ol: false });   // 花瓣之间的小缺口
    p.dot(p.hp, -5.75, w, 2, { ol: false });
    p.disc(p.hp, -4.25, 0.5, M.yolk, { tone: 3, ol: false, lock: true });
  }

  // ---------- 表情（第二批）----------
  // 想吃饭：一朵想法云，里面一个满满的小红碗
  // 想法云：先画好里面的小图（自己描好边），云再填在空的地方（under），小图就有自己的描边
  function thoughtCloud(p, small) {
    var w = M.white, k = small ? 0.88 : 1, U = { tone: 4, under: true };
    p.ell(0.5 * k, -1.0 * k, 3.6 * k, 2.6 * k, w, U);
    p.disc(-1.8 * k, -2.6 * k, 1.4 * k, w, U); p.disc(0.6 * k, -3.2 * k, 1.6 * k, w, U); p.disc(2.8 * k, -2.4 * k, 1.3 * k, w, U);
    p.disc(-2.4 * k, -0.2 * k, 1.2 * k, w, U); p.disc(3.3 * k, -0.4 * k, 1.1 * k, w, U);
    p.rim(w, 1, 1, 3); p.rim(w, 0, 1, 2);
    p.disc(-4.25 * k, 3.0 * k, 0.65, w, { tone: 4 }); p.disc(-6.3 * k, 5.0 * k, 0.4, w, { tone: 4 });     // 两个往下拖的小泡（和大泡分开）
  }
  function food(p) {
    var m = M.cred;
    kibbles(p, 0.6, -1.25, 1.6, 1.1, -1.0, 3);                                            // 冒尖的一小堆狗粮
    p.poly([-1.25, -1.0, 2.5, -1.0, 1.9, 0.5, -0.65, 0.5], m, { tone: function (x) { return x < -0.25 ? 4 : (x > 1.4 ? 2 : 3); } });
    p.rect(-1.5, -1.25, 2.75, -0.75, m, { tone: 5 });
    p.rect(1.5, -1.25, 2.75, -0.75, m, { tone: 4 });
    p.outline();
    thoughtCloud(p, 1);
    p.outline();
  }
  // 口水：一颗亮亮的水珠挂在一根细线上；a = 长度（2 / 3 / 5 世界单位）。最上面就是挂在嘴上的那一点（grip）
  function drool(p, a) {
    var m = M.water, NO = { ol: false };
    p.box(-0.5, 0, 1.0, 5.5);
    p.line(0, 0, 0, a - 1.5, m, 2, NO);
    p.ell(p.hp, a - 0.75, 0.5, a > 2 ? 0.75 : 0.5, m, { ol: false, tone: function (ux, uy) { return ux + uy < -0.3 ? 5 : (ux + uy > 0.5 ? 1 : 3); } });
    p.anchor('grip', 0, 0);
  }
  // 叹气：一小团淡淡的气，从嘴边往旁边飘；a = 大小（0.5 = 哼一声）
  function sigh(p, a) {
    var k = a || 1, m = M.dust, o = { f: 0.5, lo: 3, hi: 5, ol: false };
    p.disc(1.0 * k, -0.25 * k, 1.25 * k, m, o); p.disc(-0.6 * k, 0.1 * k, 0.9 * k, m, o); p.disc(2.3 * k, 0.2 * k, 0.8 * k, m, o);
    p.disc(-1.9 * k, 0.5 * k, Math.max(0.35, 0.45 * k), m, o);
    p.rim(m, 0, 1, 2); p.rim(m, 1, 0, 3);
  }
  // 三个点：a = 显示几个（1 / 2 / 3；三帧用同一个框，一个一个冒出来）
  function dots(p, a) {
    var m = M.dark;
    p.box(-3.5, -1, 3.5, 1);
    for (var i = 0; i < a; i++) {
      var x = -2.5 + i * 2.5;
      p.rect(x - 0.5, -0.5, x + 0.5, 0.5, m, { tone: 4 });
      p.dot(x - 0.5, -0.5, m, 5, { lock: true });
    }
    p.outline();
  }
  // 脸红：两道短短的粉色斜杠（贴在脸颊上，不飘）
  function blush(p) {
    var m = M.heart, NO = { ol: false };
    for (var i = 0; i < 2; i++) {
      var x = -1.75 + i * 2.0;
      p.line(x, 0.75, x + 1.0, -0.75, m, 3, NO);
      p.line(x + 0.5, 0.75, x + 1.5, -0.75, m, 4, NO);
    }
  }
  // 刚拉完那一下的两缕"新鲜"气（漫画里的意思，只出现一次）：两条淡淡的小波浪
  function wisp(p) {
    var m = M.steel, u = 0.5, i, j, NO = { ol: false };
    var W = [[0, 0, 1, 1, 1, 0, 0], [1, 2, 2, 2, 1, 1]];        // 从下往上，每一排往右挪几个像素：两道轻轻弯着的线
    for (i = 0; i < 2; i++) for (j = 0; j < W[i].length; j++) {
      var x = -1.5 + i * 1.75 + W[i][j] * u, y = 1.5 - j * u - i * u;
      p.rect(x, y, x + u, y + u, m, { tone: 3, ol: false });
      p.rect(x + u, y, x + 2 * u, y + u, m, { tone: 2, ol: false, under: true });
    }
  }
  // 四叶草（交好运），旁边一个小小的金色闪光
  function clover(p) {
    var g = M.grass, i, d = 1.3, hp = p.hp;
    p.cap(hp + 0.25, 0.75, hp + 1.25, 3.0, 0.3, 0.25, g, { tone: 2 });                       // 小茎
    for (i = 0; i < 4; i++) {
      var an = i * PI / 2 + PI / 4, c = Math.cos(an), s = Math.sin(an);
      p.disc(hp + c * d, s * d, 1.2, g, { f: 0.3, lo: 2, hi: 4 });                           // 一片叶子
    }
    p.line(hp, -2.5, hp, 2.5, g, 0, { over: g }); p.line(hp - 2.5, 0, hp + 2.5, 0, g, 0, { over: g });   // 四片叶子之间的缝
    for (i = 0; i < 4; i++) {
      var a2 = i * PI / 2 + PI / 4;
      p.dot(hp + Math.cos(a2) * 2.2, Math.sin(a2) * 2.2, g, 0, { over: g });                  // 每片叶子外头一个小缺口：像一颗心
    }
    p.dot(hp - 1.5, -1.0, g, 5, { lock: true }); p.dot(hp + 0.75, -1.5, g, 5, { lock: true });
    p.outline();
    var x = hp + 2.75, y = -2.75, o = { ol: false, lock: true };                              // 金色的小闪光
    p.dot(x, y, M.gold, 5, o); p.dot(x - 0.5, y, M.gold, 3, o); p.dot(x + 0.5, y, M.gold, 3, o); p.dot(x, y - 0.5, M.gold, 3, o); p.dot(x, y + 0.5, M.gold, 3, o);
  }


  // ============================================================
  //  互动用的小道具（R5 3.3）
  // ============================================================
  // 一段两股拧在一起的绳子（红、白斜条纹），沿着折线 pts 画，粗 r
  function twist(p, pts, r) {
    var i, red = M.cred, wt = M.ivory, len = 0, segs = [];
    for (i = 0; i + 3 < pts.length; i += 2) {
      p.cap(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], r, r, red, { f: 0.3 });
      var dx = pts[i + 2] - pts[i], dy = pts[i + 3] - pts[i + 1], l = sqrt(dx * dx + dy * dy) || 1;
      segs.push([pts[i], pts[i + 1], dx / l, dy / l, l]); len += l;
    }
    // 每隔一小段，斜着压一道白的
    for (i = 0; i < segs.length; i++) {
      var g = segs[i], t;
      for (t = 0.4; t < g[4]; t += 1.0) {
        var cx = g[0] + g[2] * t, cy = g[1] + g[3] * t, nx = -g[3], ny = g[2];
        p.line(cx - nx * r - g[2] * 0.4, cy - ny * r - g[3] * 0.4, cx + nx * r + g[2] * 0.4, cy + ny * r + g[3] * 0.4, wt, 4, { over: red });
      }
    }
  }
  // 绳结：4 × 4，红白两股
  function knot(p, x, y) {
    var red = M.cred, wt = M.ivory, k;
    p.disc(x, y, 1.6, red, { f: 0.3 });
    for (k = -2; k <= 2; k++) p.line(x + k * 1.5 - 1.6, y + 1.6, x + k * 1.5 + 1.6, y - 1.6, wt, 4, { over: red });
    p.rim(red, 1, 1, 2); p.rim(wt, 1, 1, 2); p.rim(red, -1, -1, 4); p.rim(wt, -1, -1, 5);
  }
  // 树枝（28 × 2）：稍微弯一点，中间偏右一个小杈；a.chew = 右头被咬过（露出浅色的木头）
  function stick(p, a) {
    var w = M.wood;
    p.cap(-13.5, 0.25, 0, -0.25, 0.5, 0.55, w, { f: 0.3 });
    p.cap(0, -0.25, 13.25, 0.25, 0.55, 0.45, w, { f: 0.3 });
    p.cap(6.0, -0.25, 7.5, -2.0, 0.35, 0.25, w, { f: 0.3 });
    p.dot(-8, 0, w, 1, { over: w }); p.dot(-3.5, -0.5, w, 2, { over: w }); p.dot(3.0, 0, w, 1, { over: w }); p.dot(10, 0, w, 2, { over: w });
    p.dot(-13.75, 0, w, 5, { over: w, lock: true });                                     // 断口：浅色的木头
    if (a && a.chew) {
      p.rect(10.5, -0.25, 13.25, 0.5, w, { tone: 5, over: w, lock: true });
      p.line(13.5, -0.5, 14.5, -1.0, w, 4); p.line(13.5, 0.5, 14.5, 1.0, w, 4);
    }
    p.outline();
    p.anchor('grip', 0, 0);
  }
  // 绳子玩具：a = 'ground' 平放 / 'carry' 叼着一头、另一头往下坠 / 'knot' 只有一个绳结（两张嘴之间拉紧时，线的两头用）
  function ropeToy(p, a) {
    if (a === 'knot') { knot(p, 0, 0); p.outline(); p.anchor('grip', 0, 0); return; }
    if (a === 'carry') {
      twist(p, [0, 0.5, 1.5, 3.5, 3.0, 6.0, 4.0, 8.5], 0.6);
      knot(p, 0, 0); knot(p, 4.25, 10.0);
      p.outline();
      p.anchor('grip', 0, 0);
      return;
    }
    twist(p, [-6.0, -1.75, -2.0, -2.25, 2.0, -1.5, 6.0, -1.75], 0.6);
    knot(p, -6.0, -1.75); knot(p, 6.0, -1.75);
    p.outline();
    p.anchor('grip', -6.0, -1.75);
  }
  // 红色牵引绳：a = 'ground' 盘在地上（一头是手环，一头是钢扣）/ 'handle' 只有手环（他手里）/ 'carry' 叼着手环、绳子垂下去
  function leash(p, a) {
    var r = M.cred, s = M.steel;
    var loop = function (x, y) {                                                        // 手环：3 × 4 的一个圈
      var pts = [], i;
      for (i = 0; i <= 12; i++) { var t = i / 12 * PI * 2; pts.push(x + Math.sin(t) * 1.0, y - 1.5 + Math.cos(t) * 1.5); }
      p.stroke(pts, 0.75, r, { tone: 3 });
    };
    if (a === 'handle') {
      loop(0, 0);
      p.stroke([0, 0, 0, 2.5], 0.75, r, { tone: 3 });
      p.rim(r, -1, 0, 4); p.rim(r, 1, 0, 2);
      p.outline();
      p.anchor('grip', 0, -2.75);
      return;
    }
    if (a === 'carry') {
      loop(0, 0);
      p.stroke([0, 0, 0.75, 3, 1.25, 6, 1.0, 9, 0.25, 11], 0.75, r, { tone: 3 });
      p.rect(-0.25, 11, 0.75, 12.5, s, { tone: 3 }); p.dot(0.25, 12.75, s, 2);            // 钢扣
      p.rim(r, -1, 0, 4); p.rim(r, 1, 0, 2);
      p.outline();
      p.anchor('grip', 0, -2.75);
      return;
    }
    loop(-6.5, -1.0);
    p.stroke([-6.5, -1.0, -4, -0.75, -1.5, -1.75, 1.5, -2.25, 4, -1.0, 6.5, -0.75], 0.75, r, { tone: 3 });
    p.rect(6.5, -1.25, 8.0, -0.25, s, { tone: 3 }); p.dot(8.25, -0.75, s, 2);
    p.rim(r, -1, -1, 4); p.rim(r, 1, 1, 2);
    p.outline();
    p.anchor('grip', -6.5, -2.5);
  }
  // 梳毛的刷子（5 × 3）：木头背、深色的刷毛；a.full = 刷毛上夹着一块奶油色的毛
  function brush(p, a) {
    var w = M.wood, d = M.shoe, c = M.cream;
    p.cap(-1.75, -1.25, 1.75, -1.25, 0.75, 0.75, w, { f: 0.35 });
    p.rect(-2.25, -0.75, 2.25, 0.5, d, { tone: function (x) { return (round(x * p.R) & 1) ? 2 : 4; } });
    if (a && a.full) {
      p.ell(0.25, 0.75, 2.4, 1.1, c, { f: 0.4, lo: 3 });
      p.dot(-2.0, 1.25, c, 4); p.dot(2.5, 1.5, c, 3); p.dot(-1.0, 1.75, c, 4);
    }
    p.outline();
    p.anchor('grip', 0, -1.75);
  }
  // 一团奶油色的毛（6 × 5），四周翘着几根；a = 转到哪一帧（0 / 1 / 2，滚起来轮着放）
  function furball(p, a) {
    var c = M.cream, i, ph = a * 2.1;
    p.box(-3.5, -5.5, 3.5, 0);
    p.ell(0, -2.4, 2.4, 2.1, c, { f: 0.35 });
    for (i = 0; i < 9; i++) {
      var an = ph + i * 0.7 + (hsh(i * 3 + 1) - 0.5) * 0.4, l = 2.3 + hsh(i * 7) * 0.9;
      p.line(Math.cos(an) * 1.6, -2.4 + Math.sin(an) * 1.4, Math.cos(an + 0.25) * l, -2.4 + Math.sin(an + 0.25) * l * 0.85, c, an > 2.4 && an < 5.5 ? 4 : 3);
    }
    p.line(Math.cos(ph) * 0.5 - 0.5, -2.9, Math.cos(ph) * 0.5 + 0.75, -1.9, c, 2, { over: c });        // 一道毛的纹路，跟着转
    p.outline();
    p.anchor('grip', 0, 0);
  }
  // 白杯子（4 × 4）：里面是茶，右边一个把手，上面一缕热气；a = 0 / 1 两帧热气
  function cup(p, a) {
    var m = M.paper, NO = { ol: false };
    p.box(-2.0, -6.5, 3.0, 0);
    var hp = [];                                                                        // 把手：一个小圈
    for (var i = 0; i <= 10; i++) { var t = -PI / 2 + i / 10 * PI; hp.push(1.6 + Math.cos(t) * 0.9, -2.0 + Math.sin(t) * 0.8); }
    p.stroke(hp, 0.5, m, { tone: 3 });
    p.poly([-1.6, -3.25, 1.6, -3.25, 1.25, -0.5, -1.25, -0.5], m, { tone: function (x) { return x < -0.75 ? 4 : (x > 0.75 ? 2 : 3); } });
    p.ell(0, -3.25, 1.6, 0.5, m, { tone: 4 });
    p.ell(0, -3.2, 1.1, 0.3, M.kib, { tone: 2, over: m });                              // 茶
    p.outline();
    var S = a ? [[0.25, -4.25], [0.0, -4.75], [0.25, -5.25], [0.5, -5.75]] : [[0.0, -4.25], [0.25, -4.75], [0.0, -5.25], [-0.25, -5.75]];
    for (i = 0; i < S.length; i++) p.dot(S[i][0], S[i][1], M.white, i < 2 ? 4 : 3, NO);
    p.anchor('grip', 2.3, -2.0);
  }
  // 台历（6 × 7）：白纸、上面一道红边和两个扣环；a.sheet = 撕下来飘着的那一页（5 × 5，a.tilt 歪多少）
  function calendar(p, a) {
    var w = M.paper, r = M.cred, d = M.shoe;
    if (a && a.sheet) {
      p.box(-3.5, -3.5, 3.5, 3.5);
      p.move(0, 0, a.tilt || 0);
      p.rect(-2.25 * (a.sq || 1), -2.25, 2.25 * (a.sq || 1), 2.25, w, { tone: 4 });
      p.rect(-2.25 * (a.sq || 1), -2.25, 2.25 * (a.sq || 1), -1.75, r, { tone: 3 });  // 撕下来时连着的一点红边
      p.rect(-0.75 * (a.sq || 1), -1.0, -0.25 * (a.sq || 1), 1.0, d, { tone: 3 }); p.rect(0.25 * (a.sq || 1), -1.0, 0.75 * (a.sq || 1), 1.0, d, { tone: 3 });   // 日期（两个数字）
      p.home();
      p.rim(w, 1, 1, 3);
      p.outline();
      p.anchor('grip', 0, -2.0);
      return;
    }
    p.rect(-2.5, -6.0, 2.5, -0.5, w, { tone: function (x) { return x > 1.5 ? 3 : 4; } });
    p.rect(-2.5, -6.0, 2.5, -4.5, r, { tone: 3 });
    p.rect(-2.5, -6.0, 2.5, -5.5, r, { tone: 4 });
    p.rect(-2.5, -1.0, 2.5, -0.5, w, { tone: 2 });                                     // 一沓纸的厚度
    p.dot(-1.25, -6.5, M.steel, 2); p.dot(1.0, -6.5, M.steel, 2);                      // 扣环
    p.rect(-1.25, -3.75, -0.5, -1.5, d, { tone: 3 }); p.rect(0.25, -3.75, 1.0, -1.5, d, { tone: 3 });   // 大大的日期
    p.outline();
    p.anchor('grip', 0, -0.5);
  }
  // 照片（4 × 5）：只看得到背面和白边
  function photo(p) {
    var w = M.paper;
    p.rect(-1.75, -4.75, 1.75, -0.5, w, { tone: 5 });
    p.rect(-1.25, -4.25, 1.25, -1.0, w, { tone: 3 });
    p.rim(w, 1, 1, 2);
    p.outline();
    p.anchor('grip', 0, -0.5);
  }
  // 小飞虫（1 × 1）：a = 0 / 1 翅膀在哪边
  function gnat(p, a) {
    p.box(-1, -1, 1, 1);
    p.dot(0, 0, M.dark, 1, { ol: false });
    p.dot(a ? 0.5 : -0.5, -0.5, M.white, 2, { ol: false });
  }
  // 小土堆（5 × 2，埋了东西的地方）/ 刚挖的坑（8 × 3，深色，四周一圈土渣）
  function mound(p, a) {
    var m = M.soil, NO = { ol: false };
    if (a && a.hole) {
      p.ell(0, -1.5, 4.0, 1.5, m, { tone: 3, ol: false });
      p.ell(0, -1.75, 3.0, 1.0, m, { tone: 0, ol: false, over: m });
      p.rim(m, 0, 1, 4);
      p.dot(-4.25, -0.5, m, 3, NO); p.dot(4.25, -1.0, m, 2, NO); p.dot(-3.25, -3.0, m, 3, NO); p.dot(3.75, -2.75, m, 4, NO); p.dot(1.5, -0.25, m, 4, NO);
      return;
    }
    var pts = [], i;
    for (i = 0; i <= 12; i++) { var t = PI + PI * i / 12; pts.push(2.25 * Math.cos(t), -0.5 + 1.25 * Math.sin(t)); }
    p.poly(pts, m, { tone: function (x, y) { return x < -0.75 && y < -0.75 ? 5 : (x > 0.75 ? 3 : 4); } });
    p.rect(-2.25, -0.75, 2.25, -0.5, m, { tone: 3 });
    p.dot(-0.5, -1.25, m, 2, { over: m }); p.dot(0.75, -1.0, m, 2, { over: m });
    p.outline();
    p.dot(-3.0, -0.5, m, 3, NO); p.dot(3.0, -0.75, m, 3, NO);
  }
  // 小灯笼（5 × 8）：藏青的架子，里面暖暖的光；a.glow = 地上那一圈暖光（20 宽，很淡）
  function lantern(p, a) {
    if (a && a.glow) {
      var f = M.flame;
      p.ell(0, 0, 10, 10, f, { tone: 4, ol: false, a: 0.06 });
      p.ell(0, 0, 7, 7, f, { tone: 4, ol: false, a: 0.12 });
      p.ell(0, 0, 4, 4, f, { tone: 4, ol: false, a: 0.18 });
      return;
    }
    var n = M.navy, fl = M.flame;
    p.rect(-1.75, -6.0, 1.75, -1.5, fl, { tone: function (x, y) { return y > -3.5 && x < 0.75 && x > -1.0 ? 4 : 3; } });
    p.dot(-0.25, -3.75, fl, 5, { lock: true });
    p.rect(-2.25, -1.5, 2.25, -0.5, n, { tone: 3 });                                   // 底座
    p.poly([-2.25, -6.0, 2.25, -6.0, 1.25, -7.25, -1.25, -7.25], n, { tone: 4 });      // 顶
    p.rect(-2.25, -6.5, 2.25, -6.0, n, { tone: 3 });
    p.rect(-0.25, -6.0, 0.25, -1.5, n, { tone: 2 });                                    // 中间一根框
    p.rect(-2.25, -6.0, -1.75, -1.5, n, { tone: 3 }); p.rect(1.75, -6.0, 2.25, -1.5, n, { tone: 2 });
    var h = [];
    for (var i = 0; i <= 8; i++) { var t = PI + i / 8 * PI; h.push(Math.cos(t) * 0.9, -7.5 + Math.sin(t) * 0.9); }
    p.stroke(h, 0.5, n, { tone: 3 });                                                   // 提手
    p.outline();
    p.anchor('grip', 0, -8.25);
  }
  // 野餐布：灰粉格子（同一种布，三级颜色织出格子），平铺在地上（44 × 26，从上往下斜着看，远的一边窄一点）
  // a.part：'flat' 铺着 / 'edge' 一个角翘起来 / 'lump' 布下面鼓起来一块（16 × 6，单独画，盖在布上）/ 'fold' 叠好抱着（8 × 6）/ 'den' 岛里盖着睡觉的那块（30 × 8）
  function gingham(x, y, sq) { var a = (Math.floor(x / 2) & 1) === 0, b = (Math.floor(y / (sq || 1.5)) & 1) === 0; return a && b ? 3 : (a || b ? 4 : 5); }
  function blanket(p, a) {
    var m = M.check, part = a.part;
    if (part === 'lump') {
      var pts = [], i;
      for (i = 0; i <= 16; i++) { var t = PI + PI * i / 16; pts.push(8 * Math.cos(t), -0.5 + 5.5 * Math.sin(t)); }
      p.poly(pts, m, { tone: function (x, y) {
        var bend = (y + 0.5) * 0.35 * Math.cos(x / 8 * PI / 2), t = gingham(x + 40, y - bend + 40, 1.5);
        var sh = x > 3.5 || (x > 0 && y > -2) ? 1 : 0;
        return t - sh;
      } });
      p.rim(m, -1, -1, 5); p.rim(m, 0, 1, 2);
      p.outline();
      return;
    }
    if (part === 'fold') {
      p.rect(-3.5, -5.5, 3.5, -0.5, m, { tone: function (x, y) { return gingham(x + 40, y + 40, 1.5); } });
      for (var k = 0; k < 3; k++) p.line(-3.25, -4.0 + k * 1.5, 3.25, -4.0 + k * 1.5, m, 2, { over: m });   // 叠了几层
      p.rim(m, 1, 0, 2); p.rim(m, -1, -1, 5);
      p.outline();
      p.anchor('grip', 0, -0.5);
      return;
    }
    if (part === 'den') {
      var d = [], j;
      for (j = 0; j <= 20; j++) { var u = PI + PI * j / 20; d.push(14.5 * Math.cos(u), -0.5 + 7.0 * Math.sin(u) * (0.75 + 0.25 * Math.abs(Math.cos(u)))); }
      p.poly(d, m, { tone: function (x, y) { var t = gingham(x + 40, y - (y + 0.5) * 0.3 + 40, 1.5); return x > 9 ? t - 1 : t; } });
      p.rect(-14.5, -1.5, 14.5, -0.5, m, { tone: 2 });                                  // 布边
      p.rim(m, -1, -1, 5);
      p.outline();
      return;
    }
    // 铺在地上：远边窄、近边宽；近边下面一道布的厚度
    var corner = part === 'edge';
    var Q = corner ? [-20, -25, 20, -25, 22, -7, 15, -0.5, -22, -0.5] : [-20, -25, 20, -25, 22, -0.5, -22, -0.5];
    p.poly(Q, m, { tone: function (x, y) { var sx = x * (1 + (y + 0.5) / 26 * 0.1); return gingham(sx + 44, y + 40, 1.5); } });
    p.rect(-22, -1.0, corner ? 15 : 22, -0.5, m, { tone: 2 });
    p.rim(m, 1, 0, 3);
    if (corner) {
      // 翘起来的角：看得到布的反面（素色），边上亮一道
      p.poly([22, -7, 15, -0.5, 19.5, -6.0, 23.5, -9.5], m, { tone: 2 });
      p.line(15.5, -1.0, 23.0, -9.0, m, 4);
    }
    p.outline();
  }
  // 藤编小篮子（12 × 9）：编出来的格纹、一圈卷边、提手、盖子掀开；a.front = 只画前面那一面（盖在蹲在篮子里的小腊肠前面）
  function basket(p, a) {
    var k = M.kraft, front = a && a.front;
    if (!front) {
      p.stroke([-4.75, -5.5, -4.0, -9.0, -1.5, -10.75, 1.5, -10.75, 4.0, -9.0, 4.75, -5.5], 0.75, k, { tone: 3 });   // 提手
      p.poly([-5.5, -6.0, 5.5, -6.0, 4.5, -9.25, -4.5, -9.25], k, { tone: function (x, y) { return gingham(x * 2 + 40, y * 2 + 40, 1) - 1; } });   // 掀开的盖子（立在后面）
      p.ell(0, -6.0, 5.5, 1.25, k, { tone: 1 });                                         // 篮子里面
    }
    p.poly([-6.0, -6.0, 6.0, -6.0, 5.0, -0.5, -5.0, -0.5], k, { tone: function (x, y) {
      var row = Math.floor((y + 40) / 1.0), off = (row & 1) ? 1 : 0, col = Math.floor((x + 40 + off) / 2);
      var t = (col + row) & 1 ? 3 : 4;
      if (((x + 40 + off) % 2) < 0.5) t = 2;                                            // 竖着的藤条之间的缝
      if (x > 4) t--;
      return t;
    } });
    p.rect(-6.25, -6.75, 6.25, -5.75, k, { tone: 4 });                                   // 卷边
    p.rect(-6.25, -6.75, -1.0, -6.25, k, { tone: 5 });
    p.rect(4.5, -6.25, 6.25, -5.75, k, { tone: 3 });
    p.outline();
    p.anchor('grip', 0, -10.75);
  }
  // 书：a = 'open' 两手捧着打开（7 × 5）/ 'turn' 翻页那一帧 / 'closed' 合上（4 × 5）
  function book(p, a) {
    var n = M.navy, w = M.paper, d = M.paper;
    if (a === 'closed') {
      p.rect(-1.75, -4.75, 1.75, -0.5, n, { tone: 3 });
      p.rect(-1.75, -4.75, -1.25, -0.5, n, { tone: 4 });                                 // 书脊
      p.rect(1.25, -4.5, 1.75, -0.75, w, { tone: 3 });                                    // 书页的边
      p.rect(-0.75, -3.75, 0.75, -3.25, M.gold, { tone: 3 });                              // 书名的小金条
      p.outline();
      p.anchor('grip', 0, -0.5);
      return;
    }
    // 打开：两页往中间低下去，封面从底下露出一点
    p.poly([-3.5, -4.0, -0.25, -3.25, 0.25, -3.25, 3.5, -4.0, 3.5, -0.75, 0.25, -0.25, -0.25, -0.25, -3.5, -0.75], n, { tone: 3 });
    p.poly([-3.0, -4.5, -0.25, -3.75, -0.25, -0.75, -3.0, -1.25], w, { tone: 4 });
    p.poly([0.25, -3.75, 3.0, -4.5, 3.0, -1.25, 0.25, -0.75], w, { tone: 3 });
    for (var i = 0; i < 3; i++) {                                                         // 几行字
      p.line(-2.5, -3.5 + i * 0.75, -0.75, -3.0 + i * 0.75, w, 2, { over: w });
      if (a !== 'turn') p.line(0.75, -3.0 + i * 0.75, 2.5, -3.5 + i * 0.75, w, 2, { over: w });
    }
    if (a === 'turn') p.poly([0.25, -3.75, 2.0, -5.5, 2.5, -2.5, 0.25, -0.75], w, { tone: 5 });   // 正翻过来的那一页
    p.outline();
    p.anchor('grip', 0, -0.5);
  }
  // 礼物盒（7 × 7）：浅蓝的盒子、粉色的丝带和蝴蝶结；a.open = 盖子掀到一边、丝带弹开、里面冒一点光
  function gift(p, a) {
    var b = M.sky, r = M.heart, open = a && a.open;
    p.rect(-3.0, -5.0, 3.0, -0.5, b, { tone: function (x) { return x < -2 ? 4 : (x > 1.75 ? 2 : 3); } });
    p.rect(-0.5, -5.0, 0.5, -0.5, r, { tone: 3 });                                        // 竖的丝带
    if (!open) {
      p.rect(-3.5, -6.0, 3.5, -4.75, b, { tone: 4 });                                     // 盖子
      p.rect(-0.5, -6.0, 0.5, -4.75, r, { tone: 4 });
      p.ell(-1.25, -6.75, 1.1, 0.7, r, { rot: 0.4, tone: 3 }); p.ell(1.25, -6.75, 1.1, 0.7, r, { rot: -0.4, tone: 3 });   // 蝴蝶结
      p.disc(0, -6.25, 0.5, r, { tone: 4 });
      p.rim(r, -1, -1, 4);
    } else {
      p.ell(0, -5.0, 2.75, 0.75, b, { tone: 1 });                                         // 盒子里面
      p.move(4.25, -2.25, 1.3); p.rect(-2.0, -0.5, 2.0, 0.5, b, { tone: 4 }); p.rect(-0.5, -0.5, 0.5, 0.5, r, { tone: 4 }); p.home();   // 盖子斜靠在盒子旁边
      p.stroke([-0.5, -5.0, -1.5, -6.5, -2.5, -6.0], 0.5, r, { tone: 3 }); p.stroke([0.5, -5.0, 1.75, -7.0, 2.75, -6.75], 0.5, r, { tone: 3 });   // 弹开的丝带
    }
    p.outline();
    if (open) { var o = { ol: false, lock: true }; p.dot(0, -7.5, M.gold, 5, o); p.dot(-0.5, -7.5, M.gold, 3, o); p.dot(0.5, -7.5, M.gold, 3, o); p.dot(0, -8.0, M.gold, 3, o); p.dot(0, -7.0, M.gold, 3, o); }
    p.anchor('grip', 0, -0.5);
  }
  // 一枝红花（3 × 8）：a.worn = 只剩花头（2 × 2，别在西装上 / 金毛耳朵后面）
  function flower(p, a) {
    var r = M.cred, g = M.grass;
    if (a && a.worn) {
      p.disc(p.hp, 0, 0.9, r, { f: 0.3 });
      p.dot(p.hp - 0.25, -0.25, r, 5, { lock: true });
      p.dot(p.hp + 0.75, 0.75, g, 3, { ol: false });
      p.outline();
      p.anchor('grip', 0, 0);
      return;
    }
    p.line(p.hp, -0.5, p.hp, -5.0, g, 2);
    p.ell(p.hp + 0.9, -2.5, 0.8, 0.35, g, { rot: -0.6, tone: 3 });                         // 一片叶子
    p.disc(p.hp, -6.25, 1.3, r, { f: 0.3 });
    p.line(p.hp - 0.5, -6.5, p.hp + 0.25, -5.5, r, 2, { over: r });                        // 花瓣的折
    p.dot(p.hp - 0.5, -7.0, r, 5, { lock: true });
    p.outline();
    p.anchor('grip', 0, -2.5);
  }
  // 小蛋糕（10 × 8）：盘子、奶油、草莓色的夹层、一根蜡烛。a.f = 'lit' 点着 / 'lit2' 火苗跳一下 / 'bent' 火苗被吹歪 / 'out' 灭了，一缕细烟
  function cake(p, a) {
    var w = M.paper, sp = M.ivory, pk = M.rose, f = a.f, fl = M.flame, NO = { ol: false };
    p.box(-5.5, -10.5, 5.5, 0);
    p.ell(0, -0.75, 5.0, 0.75, w, { tone: function (ux, uy) { return uy > 0.3 ? 2 : 4; } });     // 盘子
    p.rect(-3.5, -4.5, 3.5, -1.0, sp, { tone: function (x) { return x < -2.5 ? 4 : (x > 2.5 ? 2 : 3); } });   // 蛋糕
    p.rect(-3.5, -3.0, 3.5, -2.25, pk, { tone: 3 });                                      // 夹层
    p.ell(0, -4.5, 3.5, 0.75, w, { tone: 4 });                                            // 上面的奶油
    for (var i = -3; i <= 3; i += 1.5) p.disc(i, -3.75, 0.5, w, { tone: 4 });              // 奶油的花边
    p.dot(1.5, -4.75, pk, 3, { lock: true }); p.dot(-1.75, -4.5, pk, 4, { lock: true });   // 两颗小糖粒
    p.rect(-0.25, -7.0, 0.25, -4.75, M.sky, { tone: 3 });                                  // 蜡烛
    p.dot(-0.25, -6.25, M.white, 4, { lock: true }); p.dot(-0.25, -5.25, M.white, 4, { lock: true });
    p.outline();
    if (f === 'lit' || f === 'lit2') {
      var up = f === 'lit2' ? 0.5 : 0;
      p.dot(0, -7.5 - up, fl, 3, NO); p.dot(0, -8.0 - up, fl, 4, NO); if (up) p.dot(0, -8.5, fl, 5, NO);
    } else if (f === 'bent') {
      p.dot(0, -7.5, fl, 3, NO); p.dot(0.5, -7.75, fl, 4, NO);
    } else {
      p.dot(0, -7.5, M.dust, 2, NO); p.dot(0.5, -8.0, M.dust, 3, NO); p.dot(0, -8.5, M.dust, 3, NO); p.dot(0.5, -9.0, M.dust, 4, NO);
    }
    p.anchor('grip', 0, -0.5);
  }
  // 信封（7 × 5）：奶油色，封口一颗小红心
  function envelope(p) {
    var e = M.ivory;
    p.rect(-3.0, -4.5, 3.0, -0.5, e, { tone: 4 });
    p.line(-2.75, -4.25, 0, -2.25, e, 2, { over: e }); p.line(0, -2.25, 2.75, -4.25, e, 2, { over: e });   // 封口的两道折
    p.line(-2.75, -0.75, -1.0, -2.0, e, 3, { over: e }); p.line(2.75, -0.75, 1.0, -2.0, e, 3, { over: e });
    p.rim(e, 1, 1, 3);
    var h = M.heart, L = { lock: true };
    p.rect(-0.75, -2.75, 0.75, -2.25, h, { tone: 3, lock: true }); p.rect(-0.25, -2.25, 0.25, -1.75, h, { tone: 3, lock: true });
    p.dot(-0.75, -3.0, h, 3, L); p.dot(0.25, -3.0, h, 3, L);
    p.outline();
    p.anchor('grip', 0, -4.5);
  }
  // 一束花（8 × 10）：七朵小花、绿色的花茎、粉丝带打个结
  function bouquet(p) {
    var g = M.grass, i;
    p.poly([-2.0, -4.5, 2.0, -4.5, 0.75, -0.5, -0.75, -0.5], g, { tone: function (x) { return (round(x * p.R) & 1) ? 2 : 3; } });   // 花茎
    var F = [[-2.5, -6.0, 'cred'], [0, -6.5, 'yolk'], [2.5, -6.0, 'lilac'], [-1.25, -8.0, 'rose'], [1.25, -8.25, 'white'], [-2.75, -8.25, 'sky'], [2.75, -8.25, 'cred']];
    p.ell(-3.5, -5.0, 0.9, 0.45, g, { rot: 0.6, tone: 3 }); p.ell(3.5, -5.0, 0.9, 0.45, g, { rot: -0.6, tone: 2 });   // 两片叶子
    for (i = 0; i < F.length; i++) {
      p.disc(F[i][0], F[i][1], 1.05, M[F[i][2]], { f: 0.35, lo: 2, hi: 4 });
      p.dot(F[i][0], F[i][1], M.yolk, F[i][2] === 'yolk' ? 2 : 4, { lock: true });
    }
    p.ell(-0.9, -2.5, 0.7, 0.45, M.heart, { rot: 0.3, tone: 4 }); p.ell(0.9, -2.5, 0.7, 0.45, M.heart, { rot: -0.3, tone: 3 });   // 丝带
    p.dot(0, -2.5, M.heart, 2);
    p.outline();
    p.anchor('grip', 0, -2.5);
  }
  // 蝴蝶结（4 × 3）：戴在狗头上 / 项圈上
  function ribbon(p) {
    var r = M.heart, hp = p.hp;
    p.ell(hp - 1.15, -0.1, 1.15, 0.85, r, { rot: 0.45, f: 0.3, hi: 4 }); p.ell(hp + 1.15, -0.1, 1.15, 0.85, r, { rot: -0.45, f: 0.3, hi: 4 });   // 两个圈
    p.line(hp - 0.5, 0.5, hp - 1.0, 1.5, r, 2); p.line(hp + 0.5, 0.5, hp + 1.0, 1.5, r, 2);                                                         // 两条小尾巴
    p.dot(hp - 1.25, -0.25, r, 1, { over: r }); p.dot(hp + 1.25, -0.25, r, 1, { over: r });                                                       // 圈里面的影子
    p.disc(hp, 0, 0.5, r, { tone: 4 });                                                                                                          // 中间的结
    p.dot(hp - 0.25, -0.25, r, 5, { lock: true });
    p.outline();
    p.anchor('grip', 0, 0);
  }
  // 地上一片暖暖的阳光（60 × 24，很淡，只画在草地那一层）
  function sunpatch(p) {
    var f = M.flame;
    p.ell(0, 0, 30, 12, f, { tone: 5, ol: false, a: 0.05 });
    p.ell(0, 0, 25, 9.5, f, { tone: 5, ol: false, a: 0.09 });
    p.ell(0, 0, 19, 7, f, { tone: 5, ol: false, a: 0.12 });
  }
  // 睡过的地方第二天冒出来的小花（草地自己那种 3 × 3 像素的小花，带两片小叶子；不描边）
  function napFlower(p, a) {
    var m = M[a.m], NO = { ol: false };
    p.dot(-0.75, 0.75, M.grass, 4, NO); p.dot(0.75, 0.5, M.grass, 3, NO);
    p.disc(p.hp, 0, 0.75, m, { tone: a.m === 'white' ? 4 : 3, ol: false });
    p.rim(m, 1, 1, 2);
    p.disc(p.hp, 0, 0.25, M.yolk, { tone: a.m === 'yolk' ? 2 : 3, ol: false, lock: true });
  }
  // 被睡扁的一片草（40 × 14）：比草地亮一级的、倒向一边的短草叶，稀稀的不是一整块
  function flatGrass(p, a) {
    var m = M[a.m], i;
    for (i = 0; i < 200; i++) {
      var x = (hsh(i * 2 + 11) * 2 - 1) * 19, y = (hsh(i * 2 + 12) * 2 - 1) * 6.5, ex = x / 19, ey = y / 6.5, r2 = ex * ex + ey * ey;
      if (r2 > 1 || hsh(i + 900) > 0.42 * (1 - 0.6 * r2)) continue;
      var l = 1.0 + hsh(i + 77) * 1.5;
      p.line(x, y, x + l, y - l * 0.15, m, hsh(i + 5) < 0.2 ? 4 : 3, { ol: false });
    }
  }

  // ---------- 表情（R5 3.4）----------
  // 嗅一嗅：鼻子前面两三道小弯；a = 0（两道，近）/ 1（三道，远一点）
  function sniffs(p, a) {
    var m = M.white, NO = { ol: false }, i, k = a === undefined ? 1 : a;
    p.box(-0.5, -2.5, 4.5, 2.0);
    for (i = 0; i < 2 + (k ? 1 : 0); i++) {
      var x = 0.5 + i * 1.25 + k * 0.5, y = -1.0 + (i & 1) * 1.0;
      p.dot(x, y - 0.5, m, 3, NO); p.dot(x + 0.5, y, m, 4, NO); p.dot(x, y + 0.5, m, 3, NO);
      p.dot(x - 0.5, y, M.steel, 2, { ol: false, under: true });
    }
  }
  // 打喷嚏：往前一小股飞沫（3–5 个像素）；a.m = 颜色（花粉的黄色版用 yolk）
  function achoo(p, a) {
    var m = M[a.m], NO = { ol: false }, P = [[0.5, 0, 3], [1.5, -0.75, 4], [2.0, 0.5, 3], [3.0, -0.25, 4], [3.5, 1.0, 3], [4.25, -1.0, 2]];
    for (var i = 0; i < P.length; i++) p.dot(P[i][0], P[i][1], m, P[i][2], NO);
  }
  // 晕乎乎：头顶一圈扁扁的螺旋（a = 转到第几帧，0..3），外头一颗小星星
  function dizzy(p, a) {
    var m = M.gold, NO = { ol: false }, ph = (a || 0) * PI / 2, i, n = 40;
    p.box(-3.5, -2.5, 3.5, 2.0);
    for (i = 0; i <= n; i++) {
      var t = i / n, an = ph + t * PI * 3.2, r = 0.4 + t * 2.4;
      p.dot(Math.cos(an) * r, Math.sin(an) * r * 0.45, m, t > 0.5 ? 3 : 2, NO);
    }
    var ea = ph + PI * 3.2, ex = Math.cos(ea) * 3.0, ey = Math.sin(ea) * 3.0 * 0.45;
    p.dot(ex, ey, m, 5, NO); p.dot(ex - 0.5, ey, m, 4, NO); p.dot(ex + 0.5, ey, m, 4, NO); p.dot(ex, ey - 0.5, m, 4, NO); p.dot(ex, ey + 0.5, m, 4, NO);
  }
  // 想法云里的小图（5 × 5 像素左右）：a = 想到了什么
  function thoughtIcon(p, a) {
    var cx = 0.5, cy = -1.4;
    if (a === 'ball') { p.disc(cx, cy, 1.25, M.ball, { f: 0.3 }); p.line(cx - 0.75, cy - 0.75, cx + 0.25, cy + 0.75, M.seam, 4, { over: M.ball }); }
    else if (a === 'bone') { p.cap(cx - 1.0, cy, cx + 1.0, cy, 0.4, 0.4, M.ivory, { f: 0.2 }); p.disc(cx - 1.2, cy - 0.45, 0.5, M.ivory); p.disc(cx - 1.2, cy + 0.45, 0.5, M.ivory); p.disc(cx + 1.2, cy - 0.45, 0.5, M.ivory); p.disc(cx + 1.2, cy + 0.45, 0.5, M.ivory); }
    else if (a === 'shoe') { p.poly([cx - 1.5, cy + 0.75, cx - 1.5, cy - 0.75, cx - 0.25, cy - 0.75, cx + 0.5, cy - 0.25, cx + 1.75, cy + 0.0, cx + 1.75, cy + 0.75], M.shoe, { tone: 3 }); p.rim(M.shoe, -1, -1, 5); p.rect(cx - 1.5, cy + 0.5, cx + 1.75, cy + 0.75, M.shoe, { tone: 1 }); }
    else if (a === 'butterfly') { p.disc(cx - 0.75, cy - 0.4, 0.75, M.pink, { tone: 3 }); p.disc(cx + 0.75, cy - 0.4, 0.75, M.pink, { tone: 3 }); p.disc(cx - 0.6, cy + 0.6, 0.5, M.pink, { tone: 2 }); p.disc(cx + 0.6, cy + 0.6, 0.5, M.pink, { tone: 2 }); p.line(cx, cy - 0.75, cx, cy + 1.0, M.dark, 2); }
    else if (a === 'hole') { p.ell(cx, cy + 0.25, 1.75, 0.8, M.soil, { tone: 3 }); p.ell(cx, cy + 0.15, 1.2, 0.45, M.soil, { tone: 0, over: M.soil }); }
    else if (a === 'tail') { p.stroke([cx - 1.5, cy + 1.0, cx - 0.5, cy + 0.25, cx + 0.5, cy - 0.5, cx + 1.25, cy - 1.5], 0.75, M.coat, { tone: 3 }); p.rim(M.coat, 0, 1, 2); p.dot(cx - 0.5, cy + 0.75, M.cream, 4); p.dot(cx + 0.5, cy + 0.0, M.cream, 4); }
    else if (a === 'heart') { heartMini(p, cx, cy); }
    else if (a === 'cursor') { p.poly([cx - 1.0, cy - 1.75, cx - 1.0, cy + 1.0, cx - 0.25, cy + 0.25, cx + 0.25, cy + 1.5, cx + 0.75, cy + 1.25, cx + 0.25, cy, cx + 1.25, cy], M.paper, { tone: 5 }); }
    else if (a === 'bouquet') { p.poly([cx - 0.75, cy - 0.25, cx + 0.75, cy - 0.25, cx + 0.25, cy + 1.5, cx - 0.25, cy + 1.5], M.grass, { tone: 3 }); p.disc(cx - 0.75, cy - 0.75, 0.6, M.cred, { tone: 3 }); p.disc(cx + 0.75, cy - 0.75, 0.6, M.yolk, { tone: 3 }); p.disc(cx, cy - 1.25, 0.6, M.rose, { tone: 3 }); }
    p.outline();
  }
  function heartMini(p, cx, cy) {
    var h = M.heart;
    p.disc(cx - 0.6, cy - 0.4, 0.7, h, { tone: 3 }); p.disc(cx + 0.6, cy - 0.4, 0.7, h, { tone: 3 });
    p.poly([cx - 1.3, cy - 0.2, cx + 1.3, cy - 0.2, cx, cy + 1.3], h, { tone: 3, raw: true });
    p.dot(cx - 0.75, cy - 0.75, h, 5, { lock: true });
  }
  function thought(p, a) { if (a) thoughtIcon(p, a); thoughtCloud(p, 0); p.outline(); }
  // 无声地低吼：嘴边两道短短的锯齿
  function grr(p) {
    var m = M.heart, NO = { ol: false }, i, j;
    for (j = 0; j < 2; j++) for (i = 0; i <= 6; i++) p.dot(i * 0.5 - 1.5 + j * 0.5, j * 1.5 + ((i & 1) ? -0.5 : 0), m, 1, NO);
  }
  // 大大的一声"汪"（金毛的）：两倍大的叫声；a = 冒出来时放大到几倍
  function bigwoof(p, a) { p.box(-9, -9, 9, 4); woof(p, a); }
  // 太阳 / 月亮（7 × 7 像素）
  function sun(p) {
    var m = M.gold, i, NO = { ol: false };
    p.disc(p.hp, 0, 1.0, m, { f: 0.3 });
    p.outline();
    for (i = 0; i < 8; i++) { var an = i * PI / 4; p.dot(p.hp + Math.cos(an) * 1.9, Math.sin(an) * 1.9, m, i < 4 ? 4 : 3, NO); }
  }
  function moon(p) {
    var m = M.yolk, R = p.R, i, j;
    // 一个像素一个像素地看：在大圆里、又不在挪开的小圆里，就是月牙
    for (j = -2 * R; j <= 2 * R; j++) for (i = -2 * R; i <= 2 * R; i++) {
      var x = (i + 0.5) / R, y = (j + 0.5) / R, ix = x - 0.85, iy = y + 0.45;
      if (x * x + y * y <= 1.7 * 1.7 && ix * ix + iy * iy > 1.35 * 1.35) p.set(floor(p.X(x, y)), floor(p.Y(x, y)), m, x + y < -0.6 ? 5 : 4);
    }
    p.n++;
    p.rim(m, 1, 1, 3);
    p.outline();
  }
  // 飘起来的毛（2–3 个像素）、纸屑（1 个像素）、花瓣（2 个像素）
  function furTuft(p, a) {
    var c = M.cream, NO = { ol: false };
    p.dot(0, 0, c, 4, NO); p.dot(0.5, 0, c, 3, NO);
    if (!a) p.dot(0, -0.5, c, 5, NO);
  }
  function confetti(p, a) { p.dot(0, 0, M[a.m], a.t, { ol: false }); }
  function petal(p, a) { var r = M.rose, NO = { ol: false }; p.dot(0, 0, r, 4, NO); p.dot(a ? 0 : 0.5, a ? 0.5 : 0, r, 3, NO); }

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
    // ---- 开饭（R6）：碗的颜色和项圈一样，一看就知道是谁的 ----
    ['bowl_gold_empty', bowlDraw, { m: 'cred', w: 14, h: 6, tp: 1.5, s: 'empty', bone: 1 }, '金毛的红碗：空的（看得见碗里面）。14 × 6，原点在底边正中'],
    ['bowl_gold_half', bowlDraw, { m: 'cred', w: 14, h: 6, tp: 1.5, s: 'half', bone: 1 }, '金毛的红碗：半碗狗粮'],
    ['bowl_gold_full', bowlDraw, { m: 'cred', w: 14, h: 6, tp: 1.5, s: 'full', bone: 1, mound: 3.0 }, '金毛的红碗：满得冒尖（14 × 8）'],
    ['bowl_dax_empty', bowlDraw, { m: 'cblue', w: 10, h: 4.5, tp: 1.0, ry: 1.0, s: 'empty', grip: 1 }, '小腊肠的蓝碗：空的（矮矮宽宽）。grip 在靠近的碗沿上（叼着走）'],
    ['bowl_dax_half', bowlDraw, { m: 'cblue', w: 10, h: 4.5, tp: 1.0, ry: 1.0, s: 'half', grip: 1 }, '小腊肠的蓝碗：半碗'],
    ['bowl_dax_full', bowlDraw, { m: 'cblue', w: 10, h: 4.5, tp: 1.0, ry: 1.0, s: 'full', grip: 1, mound: 2.5 }, '小腊肠的蓝碗：满的（10 × 6）'],
    ['bowl_water_full', bowlDraw, { m: 'steel', w: 12, h: 5, tp: 1.25, ry: 1.0, s: 'water' }, '水碗：满的（浅钢色，一道蓝水线、一点白光）'],
    ['bowl_water_full2', bowlDraw, { m: 'steel', w: 12, h: 5, tp: 1.25, ry: 1.0, s: 'water', g: 1 }, '水碗：满的，水面闪一下（和上一张轮着放）'],
    ['bowl_water_low', bowlDraw, { m: 'steel', w: 12, h: 5, tp: 1.25, ry: 1.0, s: 'low' }, '水碗：水少了（水线低 1 个像素）'],
    ['bowls_stack_empty', bowlStack, {}, '两只碗叠在一起（蓝碗套在红碗里），他抱着走。grip 在底边正中'],
    ['bowls_stack_bag', bowlStack, { bag: 1 }, '叠起来的碗里立着狗粮袋（14 × 15），他抱着走'],
    ['kibble_bag_closed', kbag, {}, '狗粮袋（牛皮纸，卷着口，红爪印）7 × 10。grip 在侧面正中'],
    ['kibble_bag_pour', kbag, { pour: 1 }, '狗粮袋倒着倒狗粮（转 135°，口朝下开着）'],
    ['kibble_fall_a', kfall, 0, '倒出来的一小股狗粮：第 1 帧（3 × 8，和 b 轮着放）'],
    ['kibble_fall_b', kfall, 1, '倒出来的一小股狗粮：第 2 帧'],
    ['kibble_bit', kbit, 0, '掉在地上的一颗狗粮（1.5 × 1）'],
    // ---- 便便（R6 4.4：像挤出来的巧克力奶油；不脏、不湿、没有苍蝇）----
    ['poop_s', poop, { big: 0 }, '小腊肠的便便（4 × 3.5）：两层加一个小尖'],
    ['poop_l', poop, { big: 1 }, '金毛的便便（6 × 5）：三层加一个小尖'],
    ['poop_gold', poop, { big: 1, m: 'gold' }, '金色的便便（狗屎运）'],
    ['poop_s_pop', poop, { big: 0, pop: 1 }, '小便便冒出来那一帧（矮 1 像素、宽 2 像素，60 毫秒）'],
    ['poop_l_pop', poop, { big: 1, pop: 1 }, '大便便冒出来那一帧'],
    ['poop_gold_pop', poop, { big: 1, m: 'gold', pop: 1 }, '金便便冒出来那一帧'],
    ['poop_gold2', poop, { big: 1, m: 'gold', tw: 1 }, '金便便闪一下（多一个亮点，和 poop_gold 轮着放）'],
    ['bag_roll', pbag, 'roll', '便便袋：一小卷套在骨头形的小盒子上（4 × 3，淡紫色）'],
    ['bag_open', pbag, 'open', '便便袋：套在他手上像个手套（5 × 5）。grip = 手腕那里的袋口，原点也在那儿'],
    ['bag_full', pbag, 'full', '便便袋：系好了（4 × 5.5），看不见里面。grip = 小结，原点也在那儿'],
    ['scooper_carry', scooper, 'carry', '夹子：拿着走（3 × 18，藏青长柄、小钢夹）。grip 在柄的正中'],
    ['scooper_use', scooper, 'use', '夹子：斜着，夹子在地上张开（12 × 14）。原点 = 夹子着地的那一点'],
    ['scooper_full', scooper, 'full', '夹子：合上了（夹着东西，看不见）'],
    ['bin_closed', bin, 'closed', '小垃圾桶：盖着（9 × 11，新的、干净的）'],
    ['bin_open', bin, 'open', '小垃圾桶：盖子掀开 30°'],
    ['bin_pop', bin, 'pop', '小垃圾桶冒出来那一帧（压扁）'],
    ['hanky', hanky, 0, '他的白手帕（4 × 4，一道折痕）。grip = 拎着的那个角'],
    ['daisy_sprout', daisy, 0, '小雏菊刚发芽（2 × 3，不描边）'],
    ['daisy_bloom', daisy, 1, '小雏菊开了（4 × 6，不描边）'],
    ['fx_food', food, 0, '表情：想吃饭（想法云里一个满满的小红碗，8 × 7）'],
    ['fx_drool0', drool, 2, '表情：口水，短（1 × 2）。三帧按顺序放；grip = 挂在嘴上的那一点'],
    ['fx_drool1', drool, 3, '表情：口水，长一点（1 × 3）'],
    ['fx_drool2', drool, 5, '表情：口水，最长（1 × 5）；掉下去换成一个 spark'],
    ['fx_sigh', sigh, 1, '表情：叹一口气（一小团淡淡的气，5 × 3，往旁边飘）'],
    ['fx_dots', dots, 3, '表情：三个点（7 × 2）'],
    ['fx_blush', blush, 0, '表情：脸红（两道粉色短斜杠，4 × 2，贴在脸上）'],
    ['fx_wisp', wisp, 0, '表情：刚拉完冒的两缕"新鲜"气（4 × 4，只出现一次、1.2 秒）'],
    ['fx_clover', clover, 0, '表情：四叶草带一点金光（6 × 6）'],
    // ---- 互动用的小道具（R5 3.3），按 R5 3.7 的顺序 ----
    ['stick', stick, {}, '树枝（28 × 2）：地上躺着 / 横着叼在嘴里。grip 在正中'],
    ['stick_chewed', stick, { chew: 1 }, '树枝：右头被咬过（露出浅色的木头）'],
    ['rope', ropeToy, 'ground', '绳子玩具（16 × 4）：两个红白绳结，平放在地上。grip 在左边的结'],
    ['rope_carry', ropeToy, 'carry', '绳子玩具：叼着一头，另一头往下坠。grip = 叼着的那个结'],
    ['rope_knot', ropeToy, 'knot', '绳子玩具的一个结（4 × 4）：两张嘴之间拉紧时，画在线的两头；线的颜色用 RAMPS.cred / RAMPS.ivory'],
    ['leash', leash, 'ground', '红色牵引绳盘在地上（一头手环、一头钢扣）。线的颜色 = RAMPS.cred'],
    ['leash_handle', leash, 'handle', '牵引绳的手环（3 × 4）：他手里拿着，绳子由引擎画成线。grip = 手环'],
    ['leash_carry', leash, 'carry', '牵引绳叼在嘴里，绳子垂下去。grip = 手环'],
    ['brush', brush, {}, '梳毛的木刷子（5 × 3）。grip = 刷子背'],
    ['brush_full', brush, { full: 1 }, '刷子上夹满了奶油色的毛'],
    ['furball', furball, 0, '一团奶油色的毛（6 × 5），原点在底边正中；滚起来 furball → furball_b → furball_c'],
    ['furball_b', furball, 1, '毛团滚动的第 2 帧'],
    ['furball_c', furball, 2, '毛团滚动的第 3 帧'],
    ['cup', cup, 0, '白杯子（4 × 4）里一杯茶，冒一缕热气。grip = 把手'],
    ['cup2', cup, 1, '白杯子：热气的第 2 帧（和 cup 轮着放）'],
    ['calendar', calendar, {}, '台历（6 × 7）：白纸、红边。grip 在底边'],
    ['calendar_sheet', calendar, { sheet: 1, tilt: -0.3 }, '撕下来的一页（5 × 5）往一边歪着飘'],
    ['calendar_sheet2', calendar, { sheet: 1, tilt: 0.35, sq: 0.8 }, '撕下来的一页往另一边歪（之字形飘落时和上一张轮着放）'],
    ['photo', photo, 0, '照片（4 × 5）：只看得到背面和白边。grip 在底边'],
    ['gnat', gnat, 0, '小飞虫（1 × 1）'],
    ['gnat2', gnat, 1, '小飞虫：翅膀换一边'],
    ['mound', mound, {}, '小土堆（5 × 2，埋了东西的地方，草地上的贴花）'],
    ['hole', mound, { hole: 1 }, '刚挖的坑（8 × 3，深色，四周一圈土渣；草地上的贴花）'],
    ['mound_hole', mound, { hole: 1 }, '同 hole'],
    ['lantern', lantern, {}, '小灯笼（5 × 8），站在地上，里面暖暖的光。grip = 提手'],
    ['lantern_glow', lantern, { glow: 1 }, '灯笼地上的一圈暖光（20 宽，最浓 18%），原点在正中'],
    ['blanket', blanket, { part: 'flat' }, '野餐布（44 × 26），灰粉格子，平铺在地上'],
    ['blanket_edge', blanket, { part: 'edge' }, '野餐布：右前角翘起来'],
    ['blanket_lump', blanket, { part: 'lump' }, '野餐布下面鼓起来的一块（16 × 6，盖在布上画，原点在底边正中）'],
    ['blanket_folded', blanket, { part: 'fold' }, '叠好的野餐布（8 × 6），他抱着。grip 在底边'],
    ['blanket_den', blanket, { part: 'den' }, '岛里盖着睡觉的那块布（30 × 8）'],
    ['basket', basket, {}, '藤编小篮子（12 × 9），盖子掀开、有提手。grip = 提手'],
    ['basket_front', basket, { front: 1 }, '篮子的前面那一面：小腊肠蹲在篮子里时，画在它前面'],
    ['book_open', book, 'open', '打开的书（7 × 5），两手捧着。grip 在底边'],
    ['book_turn', book, 'turn', '翻页那一帧'],
    ['book_closed', book, 'closed', '合上的书（4 × 5）'],
    ['gift_wrapped', gift, {}, '礼物盒（7 × 7），浅蓝盒子、粉丝带。grip 在底边'],
    ['gift_open', gift, { open: 1 }, '礼物盒打开了：盖子歪在旁边、丝带弹开、冒一点光'],
    ['flower', flower, {}, '一枝红花（3 × 8）。grip 在花茎中间'],
    ['flower_worn', flower, { worn: 1 }, '只剩花头的小红花（2 × 2）：别在西装上 / 金毛耳朵后面'],
    ['cake_lit', cake, { f: 'lit' }, '小蛋糕（10 × 8），一根蜡烛点着。grip 在底边'],
    ['cake_lit2', cake, { f: 'lit2' }, '蛋糕：火苗跳一下（和 cake_lit 轮着放）'],
    ['cake_bent', cake, { f: 'bent' }, '蛋糕：火苗被吹歪'],
    ['cake_out', cake, { f: 'out' }, '蛋糕：吹灭了，一缕细烟'],
    ['envelope', envelope, 0, '信封（7 × 5），封口一颗小红心。grip 在上边正中'],
    ['bouquet', bouquet, 0, '一束花（8 × 10）：七朵小花、粉丝带。grip = 丝带'],
    ['ribbon', ribbon, 0, '粉色蝴蝶结（4 × 3），戴在狗头上或项圈上'],
    ['sunpatch', sunpatch, 0, '草地上一片暖暖的阳光（60 × 24，很淡，只画在草地那一层），原点在正中'],
    ['nap_flower', napFlower, { m: 'white' }, '睡过的地方冒出来的小白花（草地贴花，不描边）'],
    ['nap_flower_y', napFlower, { m: 'yolk' }, '睡过的地方冒出来的小黄花'],
    ['nap_flower_p', napFlower, { m: 'rose' }, '睡过的地方冒出来的小粉花'],
    ['flat_grass', flatGrass, { m: 'grass' }, '被睡扁的一片草（40 × 14，白天的草色），原点在正中'],
    ['flat_grass_dusk', flatGrass, { m: 'grassD' }, '被睡扁的一片草（傍晚）'],
    ['flat_grass_night', flatGrass, { m: 'grassN' }, '被睡扁的一片草（夜里）'],
    // ---- 表情（R5 3.4）----
    ['fx_huff', sigh, 0.5, '表情：哼一声（半个叹气）'],
    ['fx_dots0', dots, 1, '三个点一个一个冒出来：第 1 个'],
    ['fx_dots1', dots, 2, '三个点：第 2 个'],
    ['fx_dots2', dots, 3, '三个点：第 3 个'],
    ['fx_sniffs', sniffs, 1, '表情：鼻子前面嗅一嗅的小弯'],
    ['fx_sniffs0', sniffs, 0, '嗅一嗅：第 1 帧（两道）'],
    ['fx_sniffs1', sniffs, 1, '嗅一嗅：第 2 帧（三道）'],
    ['fx_achoo', achoo, { m: 'water' }, '表情：打喷嚏的一小股飞沫（朝右，引擎按朝向翻）'],
    ['fx_achoo_y', achoo, { m: 'yolk' }, '表情：打喷嚏，花粉的黄色'],
    ['fx_dizzy', dizzy, 0, '表情：晕乎乎（头顶的螺旋）'],
    ['fx_dizzy0', dizzy, 0, '晕乎乎：转的第 1 帧'],
    ['fx_dizzy1', dizzy, 1, '晕乎乎：第 2 帧'],
    ['fx_dizzy2', dizzy, 2, '晕乎乎：第 3 帧'],
    ['fx_dizzy3', dizzy, 3, '晕乎乎：第 4 帧'],
    ['fx_thought', thought, null, '表情：空的想法云（9 × 8，两个往下拖的小泡）'],
    ['fx_thought_ball', thought, 'ball', '想法云：想到球'],
    ['fx_thought_bone', thought, 'bone', '想法云：想到骨头'],
    ['fx_thought_shoe', thought, 'shoe', '想法云：想到他的鞋'],
    ['fx_thought_butterfly', thought, 'butterfly', '想法云：想到蝴蝶'],
    ['fx_thought_hole', thought, 'hole', '想法云：想到一个坑'],
    ['fx_thought_tail', thought, 'tail', '想法云：想到金毛的尾巴'],
    ['fx_thought_heart', thought, 'heart', '想法云：想到爱心'],
    ['fx_thought_cursor', thought, 'cursor', '想法云：想到鼠标箭头'],
    ['fx_thought_bouquet', thought, 'bouquet', '想法云：想到一束花'],
    ['fx_grr', grr, 0, '表情：无声地低吼（嘴边两道短锯齿）'],
    ['fx_bigwoof', bigwoof, 2, '表情：金毛低低的一声"汪"（两倍大的叫声）'],
    ['fx_bigwoof_pop0', bigwoof, 1.2, '大叫声冒出来：小'],
    ['fx_bigwoof_pop1', bigwoof, 2.3, '大叫声冒出来：涨大一圈'],
    ['fx_bigwoof_pop2', bigwoof, 1.9, '大叫声冒出来：缩回来一点'],
    ['fx_sun', sun, 0, '表情：小太阳（他那边天亮了）'],
    ['fx_moon', moon, 0, '表情：弯弯的月亮（他那边要睡了）'],
    ['fur', furTuft, 0, '粒子：飘起来的一小撮毛（3 个像素）'],
    ['fur2', furTuft, 1, '粒子：一小撮毛（2 个像素）'],
    ['confetti0', confetti, { m: 'heart', t: 3 }, '粒子：纸屑（粉）'],
    ['confetti1', confetti, { m: 'gold', t: 3 }, '粒子：纸屑（金黄）'],
    ['confetti2', confetti, { m: 'blue', t: 3 }, '粒子：纸屑（蓝）'],
    ['confetti3', confetti, { m: 'grass', t: 4 }, '粒子：纸屑（绿）'],
    ['confetti4', confetti, { m: 'zzz', t: 3 }, '粒子：纸屑（淡紫）'],
    ['confetti5', confetti, { m: 'paper', t: 4 }, '粒子：纸屑（白）'],
    ['confetti6', confetti, { m: 'cred', t: 3 }, '粒子：纸屑（红）'],
    ['petal0', petal, 0, '粒子：粉色花瓣（横着）'],
    ['petal1', petal, 1, '粒子：粉色花瓣（竖着）'],
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
