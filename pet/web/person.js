// 穿西装的小人："骨架 + 剪纸片"，每一帧按当前的姿势现画成像素。
//
// 怎么读这个文件（从上到下）：
//   1. 颜色      —— 从 config.js 里的六个底色，各推出一条"暗 → 亮"的色阶
//   2. 画布      —— 多边形、胶囊、小方块；最后统一加交界线、亮边、描边
//   3. 剪纸片    —— 头、上身、鞋是用字符画"剪"出来的片（每个字符 = R=2 时的 1 个像素）
//   4. 长相      —— DESIGN：身材比例 + 这些字符画。想改他的样子，改这里
//   5. 表情      —— FACES：眼睛、眉毛、嘴、腮红的组合。和姿势互不相干
//   6. 姿势表    —— POSES：每个画面名字（p_idle、p_pat…）要摆成什么样。想加动作，加在这里
//   7. 骨架      —— update()：姿势之间平滑过渡、走和跑（脚踩住不滑）、眨眼、领带头发的晃动
//   8. 画        —— render()：按骨架把每一块画出来
//
// 用法（和 dogs.js 一样）：
//   var rig = PET_PERSON.create(PET_CONFIG);
//   rig.update(dt, { frame, moving, speed, t, carried, air, holding, look, face });
//   var img = rig.render(faceLeft, R);   // { w, h, data, scale, ox, oy, ver, box, top, hand, hand2, arms, head, mouth, holds }
//
// 单位：世界单位（wu）。R = 一个世界单位画成几个像素。字符画里一个字符 = 半个世界单位。
// 这个文件不碰网页的任何东西，在 Mac 外壳的 JavaScriptCore 里也能直接跑。
(function (G) {
  'use strict';

  var PI = Math.PI, RAD = PI / 180;
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function frac(v) { return v - Math.floor(v); }

  // ============================================================
  //  1. 颜色
  // ============================================================
  function rgbOf(c) {
    c = String(c).replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    return [parseInt(c.substr(0, 2), 16) || 0, parseInt(c.substr(2, 2), 16) || 0, parseInt(c.substr(4, 2), 16) || 0];
  }
  function toHsv(c) {
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d > 0) {
      if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return [h, mx > 0 ? d / mx * 100 : 0, mx * 100];
  }
  function fromHsv(h, s, v) {
    h = ((h % 360) + 360) % 360; s = clamp(s, 0, 100) / 100; v = clamp(v, 0, 100) / 100;
    var c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }
  function mixc(a, b, t) { return [Math.round(lerp(a[0], b[0], t)), Math.round(lerp(a[1], b[1], t)), Math.round(lerp(a[2], b[2], t))]; }

  // 从一个底色推出一条色阶：[描边, 最暗, 暗, 底色, 亮, 高光]。
  // 暗的一头往紫红偏，亮的一头往黄（暖色）或青（冷色）偏，这样不会"只是加黑加白"。
  function ramp(base) {
    var c = toHsv(base), h = c[0], s = c[1], v = c[2];
    function mk(dh, ss, vv) { return fromHsv(h + dh, ss, vv); }
    if (s < 12 && v >= 72) {                        // 近白（衬衫）：暗部偏冷，亮部偏暖
      return [fromHsv(245, 28, 50), fromHsv(238, 18, 68), fromHsv(230, 10, 82), base, fromHsv(50, 3, 99), fromHsv(50, 2, 100)];
    }
    if (v < 30) {                                   // 深色（头发、皮鞋）
      return [mk(15, s * 1.2, 9), mk(8, s * 1.12, v * 0.68), mk(4, s * 1.06, v * 0.84), base, mk(-12, s * 0.88, v * 1.5), mk(-26, s * 0.8, v * 2.2)];
    }
    if (s < 12) {                                   // 灰
      return [fromHsv(250, 22, v * 0.3), fromHsv(245, 16, v * 0.55), fromHsv(240, 10, v * 0.78), base, fromHsv(48, 4, v + 0.3 * (100 - v)), fromHsv(50, 3, v + 0.55 * (100 - v))];
    }
    if (h >= 300 || h < 60) {                       // 暖色（皮肤、领带）
      return [mk(-30, Math.max(0.9 * s, Math.min(60, s + 12)), clamp(v * 0.32, 9, 32)),
              mk(-16, Math.max(1.05 * s, Math.min(70, s + 13)), v * 0.58),
              mk(-8, Math.max(1.08 * s, Math.min(72, s + 9)), v * 0.79), base,
              mk(6, s * 0.8, v + 0.5 * (100 - v)), mk(12, s * 0.52, v + 0.85 * (100 - v))];
    }
    if (h >= 170) {                                 // 冷色（西装）
      return [mk(32, s * 0.82, clamp(v * 0.32, 9, 20)), mk(20, s * 0.93, v * 0.51), mk(10, s, v * 0.72), base,
              mk(-8, s * 0.89, v + 0.25 * (100 - v)), mk(-16, s * 0.71, v + 0.5 * (100 - v))];
    }
    return [mk(27, s * 0.84, v * 0.33), mk(16, s, v * 0.62), mk(8, s * 1.05, v * 0.82), base,     // 黄绿
            mk(-3, s * 0.78, v + 0.7 * (100 - v)), mk(-6, s * 0.38, 100)];
  }

  // 材质编号
  var HAIR = 1, SKIN = 2, SUIT = 3, TROU = 4, SHIRT = 5, TIE = 6, SHOE = 7, FEAT = 8;
  // 五官和小零件用到的颜色（FEAT 这种材质里的第几号）
  var F_PUPIL = 1, F_IRIS = 2, F_WHITE = 3, F_BROW = 4, F_MOUTH = 5, F_DEEP = 6, F_TEETH = 7, F_TONGUE = 8,
      F_BLUSH = 9, F_BLUSH2 = 10, F_WATER = 11, F_WATER2 = 12, F_SPARK = 13, F_LID = 14, F_CORNER = 15;

  var LE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;      // 这台机器的字节顺序
  function pack(c) { return LE ? ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0 : ((c[0] << 24) | (c[1] << 16) | (c[2] << 8) | 255) >>> 0; }

  // 调色盘：pal[材质 * 16 + 色调]
  function buildPalette(p) {
    var D = { hair: '#2b2530', skin: '#f3c9a5', suit: '#3a4c7a', shirt: '#f6f4ef', tie: '#d0353f', shoes: '#2a2024' }, k;
    p = p || {};
    for (k in D) if (!p[k]) p[k] = D[k];
    var pal = new Uint32Array(16 * 16), list = {};
    function put(m, arr) { for (var i = 0; i < arr.length; i++) pal[m * 16 + i] = pack(arr[i]); list[m] = arr; }
    var hair = ramp(rgbOf(p.hair)), skin = ramp(rgbOf(p.skin)), suit = ramp(rgbOf(p.suit));
    put(HAIR, hair); put(SKIN, skin); put(SUIT, suit);
    put(TROU, [suit[0], mixc(suit[0], suit[1], 0.5), suit[1], suit[2], suit[3], suit[4]]);     // 裤子：比上衣暗一级
    put(SHIRT, ramp(rgbOf(p.shirt))); put(TIE, ramp(rgbOf(p.tie))); put(SHOE, ramp(rgbOf(p.shoes)));
    var sk = toHsv(rgbOf(p.skin)), hv = toHsv(rgbOf(p.hair));
    var mouth = fromHsv(sk[0] - 30, Math.min(100, sk[1] + 24), sk[2] * 0.66);
    var dark = hv[2] < 45 ? hair[1] : fromHsv(hv[0], Math.min(60, hv[1] + 10), 16);            // 瞳孔：头发再浅也得是深的
    var f = [];
    f[F_PUPIL] = dark;
    f[F_IRIS] = fromHsv(22, 52, 34);
    f[F_WHITE] = [255, 255, 255];
    f[F_BROW] = hv[2] < 45 ? hair[3] : hair[2];
    f[F_MOUTH] = mouth;
    f[F_DEEP] = fromHsv(sk[0] - 46, Math.min(100, sk[1] + 28), sk[2] * 0.46);
    f[F_TEETH] = [255, 250, 242];
    f[F_TONGUE] = [242, 131, 153];
    f[F_BLUSH] = fromHsv(sk[0] - 16, Math.min(100, sk[1] + 20), sk[2] * 0.97);
    f[F_BLUSH2] = fromHsv(sk[0] - 10, Math.min(100, sk[1] + 9), sk[2] * 0.985);
    f[F_WATER] = [103, 173, 235];
    f[F_WATER2] = [178, 229, 255];
    f[F_SPARK] = [255, 211, 66];
    f[F_LID] = hv[2] < 45 ? hair[0] : dark;
    f[F_CORNER] = skin[1];
    f[0] = [0, 0, 0];
    put(FEAT, f);
    return { pal: pal, list: list };
  }

  // ============================================================
  //  2. 画布和基本形状
  //  每个像素记四样：材质、色调（0 描边 … 5 高光）、属于哪一块（分组）、第几个画上去的（前后）。
  //  全部画完以后 finish() 才把它们变成颜色。
  // ============================================================
  var CW = 56, CH = 50, CX = 28, CY = 46;        // 画布（世界单位）：宽、高、原点（两脚中间的地面）
  var cvs = {};
  function getCanvas(R) {
    var c = cvs[R];
    if (c) return c;
    var w = CW * R, h = CH * R, n = w * h;
    c = cvs[R] = { R: R, w: w, h: h, ox: CX * R, oy: CY * R, mat: new Uint8Array(n), tone: new Uint8Array(n), grp: new Uint8Array(n),
                   ord: new Uint8Array(n), sm: new Uint8Array(n), x0: 0, y0: 0, x1: -1, y1: -1 };
    return c;
  }
  var W = 0, H = 0, MAT = null, TONE = null, GRP = null, ORD = null;
  var cg = 0, co = 0, clipM = 0;                 // 正在画的：分组、前后顺序；clipM = 只许画在这种材质上
  var bx0 = 0, by0 = 0, bx1 = -1, by1 = -1;      // 这一帧画到的范围

  // 分组
  var G_ARMF = 1, G_LEGF = 2, G_LEGN = 3, G_TORSO = 4, G_HEAD = 5, G_HAIR = 6, G_ARMN = 7, G_FEAT = 8;

  function begin(c) {
    W = c.w; H = c.h; MAT = c.mat; TONE = c.tone; GRP = c.grp; ORD = c.ord;
    // 只清上一帧画过的那一块
    for (var j = c.y0; j <= c.y1; j++) MAT.fill(0, j * W + c.x0, j * W + c.x1 + 1);
    bx0 = W; by0 = H; bx1 = -1; by1 = -1; cg = 0; co = 0; clipM = 0;
  }
  function grow(i0, j0, i1, j1) {
    if (i0 < bx0) bx0 = i0; if (j0 < by0) by0 = j0; if (i1 > bx1) bx1 = i1; if (j1 > by1) by1 = j1;
  }

  var VX = new Float64Array(256), VY = new Float64Array(256), XS = new Float64Array(32), vn = 0;
  // 填一个多边形（顶点先写进 VX / VY）。像素中心在里面才算。
  // sh = 0：整片一个色调；sh = 1：当成圆柱，右边暗下去（光从左上来）
  function poly(m, t, sh) {
    var n = vn, i, j, y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9;
    for (i = 0; i < n; i++) { if (VY[i] < y0) y0 = VY[i]; if (VY[i] > y1) y1 = VY[i]; if (VX[i] < x0) x0 = VX[i]; if (VX[i] > x1) x1 = VX[i]; }
    var j0 = Math.max(0, Math.ceil(y0 - 0.5)), j1 = Math.min(H - 1, Math.ceil(y1 - 0.5) - 1);
    if (j1 < j0) return;
    grow(Math.max(0, Math.floor(x0)), j0, Math.min(W - 1, Math.ceil(x1)), j1);
    for (j = j0; j <= j1; j++) {
      var y = j + 0.5, c = 0, a, b;
      for (i = 0; i < n; i++) {
        var i2 = i + 1 === n ? 0 : i + 1, ya = VY[i], yb = VY[i2];
        if ((ya <= y && yb > y) || (yb <= y && ya > y)) {
          var xx = VX[i] + (y - ya) / (yb - ya) * (VX[i2] - VX[i]);
          for (a = c; a > 0 && XS[a - 1] > xx; a--) XS[a] = XS[a - 1];
          XS[a] = xx; c++;
          if (c >= 30) break;
        }
      }
      for (a = 0; a + 1 < c; a += 2) {
        var xa = XS[a], xb = XS[a + 1];
        var ia = Math.max(0, Math.ceil(xa - 0.5)), ib = Math.min(W - 1, Math.ceil(xb - 0.5) - 1), k = j * W + ia;
        var s1 = 1e9, s2 = 1e9;
        if (sh === 1) { b = xb - xa; s1 = xa + b * 0.79 - 0.5; s2 = b > 9 ? xb - 1.5 : 1e9; }
        for (i = ia; i <= ib; i++, k++) {
          if (clipM && MAT[k] !== clipM) continue;
          MAT[k] = m; TONE[k] = i > s2 ? t - 2 : (i > s1 ? t - 1 : t); GRP[k] = cg; ORD[k] = co;
        }
      }
    }
  }

  // 光的方向（屏幕上：左上、稍微朝着看的人）。人转身的时候光不跟着转。
  var LX = -0.3807, LY = 0.8016, LZ = 0.4609;
  // 一头粗一头细的"胶囊"（画布像素坐标）。色调按"表面朝哪儿"分成五档。
  //   far  整体暗一级（远侧的手脚）
  //   cut  第二头平着切掉（裤脚、袖口）
  //   f    压平多少（0 = 圆滚滚，1 = 一片）
  function cap(x0, y0, r0, x1, y1, r1, m, far, cut, f) {
    var rm = (r0 > r1 ? r0 : r1) + 1;
    var i0 = Math.max(0, Math.floor(Math.min(x0, x1) - rm)), i1 = Math.min(W - 1, Math.ceil(Math.max(x0, x1) + rm));
    var j0 = Math.max(0, Math.floor(Math.min(y0, y1) - rm)), j1 = Math.min(H - 1, Math.ceil(Math.max(y0, y1) + rm));
    if (i1 < i0 || j1 < j0) return;
    grow(i0, j0, i1, j1);
    var dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy, i, j;
    if (f === undefined) f = 0.25;
    for (j = j0; j <= j1; j++) {
      for (i = i0; i <= i1; i++) {
        var px = i + 0.5 - x0, py = j + 0.5 - y0;
        var t = L2 > 1e-6 ? (px * dx + py * dy) / L2 : 0;
        if (t > 1) { if (cut) continue; t = 1; } else if (t < 0) t = 0;
        var ex = px - dx * t, ey = py - dy * t, r = r0 + (r1 - r0) * t, d2 = ex * ex + ey * ey;
        if (d2 > r * r) continue;
        var k = j * W + i;
        if (clipM && MAT[k] !== clipM) continue;
        // 只看"离轴线多远"：两头的圆帽也当圆柱来打光，关节那里才不会冒出一块亮斑
        if (t === 0 || t === 1) { var al = L2 > 1e-6 ? (ex * dx + ey * dy) / L2 : 0; ex -= dx * al; ey -= dy * al; d2 = ex * ex + ey * ey; }
        var nx = ex / r, ny = -ey / r, nz = Math.sqrt(Math.max(0, 1 - d2 / (r * r))) * (1 - f) + f;
        var s = (nx * LX + ny * LY + nz * LZ) / Math.sqrt(nx * nx + ny * ny + nz * nz);
        var tone = s > 0.92 ? 5 : (s > 0.62 ? 4 : (s > 0.18 ? 3 : (s > -0.28 ? 2 : 1)));
        if (far && tone > 1) tone--;
        MAT[k] = m; TONE[k] = tone; GRP[k] = cg; ORD[k] = co;
      }
    }
  }
  // 一个小方块（画布像素，含 x0、y0，不含 x1、y1）
  function box(x0, y0, x1, y1, m, t) {
    if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 > W) x1 = W; if (y1 > H) y1 = H;
    if (x1 <= x0 || y1 <= y0) return;
    grow(x0, y0, x1 - 1, y1 - 1);
    for (var j = y0; j < y1; j++) for (var i = x0, k = j * W + x0; i < x1; i++, k++) {
      if (clipM && MAT[k] !== clipM && MAT[k] !== m) continue;
      MAT[k] = m; TONE[k] = t; GRP[k] = cg; ORD[k] = co;
    }
  }

  // 哪一块压在哪一块上面时，要在"被压住的那一边"留一条暗线：0 不要，1 暗一级，2 最暗
  var SEAM = new Uint8Array(16 * 16);
  (function () {
    for (var a = 1; a < 9; a++) for (var b = 1; b < 9; b++) {
      if (a === b || a === G_FEAT || b === G_FEAT) continue;
      SEAM[a * 16 + b] = (b === G_ARMF || b === G_LEGF) ? 2 : 1;
    }
    SEAM[G_HEAD * 16 + G_HAIR] = 0;       // 耳朵压着头发：不要线
  })();
  var DARKM = new Uint8Array(16); DARKM[HAIR] = 1; DARKM[SUIT] = 1; DARKM[TROU] = 1; DARKM[SHOE] = 1;

  // 收尾：交界线 → 深色材质顶上的亮边 → 皮肤背光那一侧 → 描边 → 上色
  function finish(c, img, pal) {
    var x0 = Math.max(1, bx0), y0 = Math.max(1, by0), x1 = Math.min(W - 2, bx1), y1 = Math.min(H - 2, by1), i, j, k, m, g, o, n, s, e;
    var SM = c.sm, d32 = img.d32;
    // 上一帧这张图画过的地方先擦掉
    for (j = img.y0; j <= img.y1; j++) d32.fill(0, j * W + img.x0, j * W + img.x1 + 1);
    if (x1 < x0 || y1 < y0) { img.x0 = img.y0 = 0; img.x1 = img.y1 = -1; c.x0 = c.y0 = 0; c.x1 = c.y1 = -1; return; }
    // 1) 交界线：两块不同的部位挨着，后面那块的边上暗一条（不用描边色，免得像填色本）
    for (j = y0; j <= y1; j++) for (i = x0, k = j * W + x0; i <= x1; i++, k++) {
      m = MAT[k]; SM[k] = 0;
      if (!m || m === FEAT) continue;
      g = GRP[k]; o = ORD[k]; s = 0;
      n = k - 1; if (MAT[n] && ORD[n] > o && GRP[n] !== g) { e = SEAM[GRP[n] * 16 + g]; if (e > s) s = e; }
      n = k + 1; if (MAT[n] && ORD[n] > o && GRP[n] !== g) { e = SEAM[GRP[n] * 16 + g]; if (e > s) s = e; }
      n = k - W; if (MAT[n] && ORD[n] > o && GRP[n] !== g) { e = SEAM[GRP[n] * 16 + g]; if (e > s) s = e; }
      n = k + W; if (MAT[n] && ORD[n] > o && GRP[n] !== g) { e = SEAM[GRP[n] * 16 + g]; if (e > s) s = e; }
      SM[k] = s;
    }
    for (j = y0; j <= y1; j++) for (i = x0, k = j * W + x0; i <= x1; i++, k++) {
      m = MAT[k];
      if (!m) continue;
      s = SM[k];
      if (s === 1) { if (TONE[k] > 1) TONE[k]--; }
      else if (s === 2) TONE[k] = 1;
      // 2) 头发、西装、皮鞋这些深色的东西：顶上那一圈提亮一级，深色壁纸上才看得出轮廓
      else if (DARKM[m]) { if (!MAT[k - W] && TONE[k] < 4 && TONE[k] > 1) TONE[k]++; }
      // 3) 皮肤：背光（右边）的边暗一级
      else if (m === SKIN) { if (!MAT[k + 1] && TONE[k] === 3) TONE[k] = 2; }
    }
    // 4) 描边（在轮廓外面加一圈，颜色跟着它贴着的材质走）+ 上色
    x0--; y0--; x1++; y1++;
    for (j = y0; j <= y1; j++) for (i = x0, k = j * W + x0; i <= x1; i++, k++) {
      m = MAT[k];
      if (m) { d32[k] = pal[m * 16 + TONE[k]]; continue; }
      o = -1; e = 0;
      if (i > 0 && (m = MAT[k - 1]) && m !== FEAT && ORD[k - 1] > o) { o = ORD[k - 1]; e = m; }
      if (i < W - 1 && (m = MAT[k + 1]) && m !== FEAT && ORD[k + 1] > o) { o = ORD[k + 1]; e = m; }
      if (j > 0 && (m = MAT[k - W]) && m !== FEAT && ORD[k - W] > o) { o = ORD[k - W]; e = m; }
      if (j < H - 1 && (m = MAT[k + W]) && m !== FEAT && ORD[k + W] > o) { o = ORD[k + W]; e = m; }
      if (e) d32[k] = pal[e * 16];
    }
    c.x0 = bx0; c.y0 = by0; c.x1 = bx1; c.y1 = by1;
    img.x0 = x0; img.y0 = y0; img.x1 = x1; img.y1 = y1;
  }

  // ============================================================
  //  3. 剪纸片
  //  一张字符画里，每种字母是一片；每一行它占"从第一个到最后一个这种字母"之间的那一段
  //  （中间夹着的别的字母后画、盖在它上面）。同一种字母每行只能有一段。
  //  R = 2 时画出来和字符画一模一样；别的 R 会把边缘连成斜线，所以放大缩小都还顺。
  // ============================================================
  // art 字符画；ox = 第几列是 x = 0；oy = 最下面一行的底边在 y 等于几（单位都是字符）
  // order = 'jnw…' 先画谁后画谁；span = { 字母: '也算在它这一段里的别的字母' }
  function plate(art, ox, oy, order, span) {
    var rows = art.length, pcs = [];
    for (var q = 0; q < order.length; q++) {
      var ch = order[q], set = ch + ((span && span[ch]) || ''), r0 = -1, r1 = -1, L = [], Rr = [], r, x;
      for (r = 0; r < rows; r++) {
        var a = -1, b = -1;
        if (art[r].indexOf(ch) >= 0) for (x = 0; x < art[r].length; x++) if (set.indexOf(art[r][x]) >= 0) { if (a < 0) a = x; b = x; }
        if (a < 0) { if (r0 >= 0 && r1 < 0) r1 = r - 1; continue; }
        if (r1 >= 0) throw new Error('person.js: 字母 "' + ch + '" 中间断开了（第 ' + r + ' 行）');
        if (r0 < 0) r0 = r;
        L.push(a - ox); Rr.push(b + 1 - ox);
      }
      if (r0 < 0) { pcs.push({ ch: ch, n: 0, top: 0, L: [], R: [] }); continue; }
      pcs.push({ ch: ch, n: L.length, top: oy + rows - r0, L: L, R: Rr });
    }
    return pcs;
  }

  // 当前的"坐标架"：片上的点 (lx, ly) 怎么变成画布上的点。
  // 主架 = 原点 (x, y) + 旋转 (c, s)；ly 高过 sp 的那部分用第二个架（上身从腰那里弯）。
  var FX0 = 0, FY0 = 0, FC0 = 1, FS0 = 0, FSP = 1e9, FX1 = 0, FY1 = 0, FC1 = 1, FS1 = 0, FK = 1, FD = 1;
  function frame(x, y, ang, k, d) { FX0 = x; FY0 = y; FC0 = Math.cos(ang); FS0 = Math.sin(ang); FSP = 1e9; FK = k; FD = d; }
  function frame2(sp, x, y, ang) { FSP = sp; FX1 = x; FY1 = y; FC1 = Math.cos(ang); FS1 = Math.sin(ang); }
  function loc(lx, ly) {
    if (ly > FSP) { ly -= FSP; VX[vn] = FX1 + FD * FK * (lx * FC1 + ly * FS1); VY[vn] = FY1 - FK * (ly * FC1 - lx * FS1); }
    else { VX[vn] = FX0 + FD * FK * (lx * FC0 + ly * FS0); VY[vn] = FY0 - FK * (ly * FC0 - lx * FS0); }
    vn++;
  }
  // 片上的一个点落在画布哪儿（不写进顶点表）
  var LOCX = 0, LOCY = 0;
  function at(lx, ly) {
    if (ly > FSP) { ly -= FSP; LOCX = FX1 + FD * FK * (lx * FC1 + ly * FS1); LOCY = FY1 - FK * (ly * FC1 - lx * FS1); }
    else { LOCX = FX0 + FD * FK * (lx * FC0 + ly * FS0); LOCY = FY0 - FK * (ly * FC0 - lx * FS0); }
  }

  var SHX = new Float64Array(64), SHY = new Float64Array(64), shOn = false;   // 每一行额外挪多少（头发、领带、衣摆的晃动）
  var TL = new Float64Array(64), TR = new Float64Array(64);
  // 画一片。b、w：往另一张字符画里的同一片变过去多少（转身时用）
  function piece(a, b, w, m, t, sh) {
    var n = a.n, top = a.top, L = a.L, Rr = a.R, i, hgt = 1;
    if (b && w > 0.001) {
      if (w > 0.999) { n = b.n; top = b.top; L = b.L; Rr = b.R; }
      else if (!a.n || !b.n) { if (w >= 0.5) { n = b.n; top = b.top; L = b.L; Rr = b.R; } }
      else {
        // 两片的行数可能不一样：按"从上到下的百分比"对上
        var nn = Math.max(a.n, b.n);
        for (i = 0; i < nn; i++) {
          var u = (i + 0.5) / nn, fa = clamp(u * a.n - 0.5, 0, a.n - 1), fb = clamp(u * b.n - 0.5, 0, b.n - 1);
          var ia = Math.floor(fa), ib = Math.floor(fb), ia2 = Math.min(a.n - 1, ia + 1), ib2 = Math.min(b.n - 1, ib + 1);
          TL[i] = lerp(lerp(a.L[ia], a.L[ia2], fa - ia), lerp(b.L[ib], b.L[ib2], fb - ib), w);
          TR[i] = lerp(lerp(a.R[ia], a.R[ia2], fa - ia), lerp(b.R[ib], b.R[ib2], fb - ib), w);
        }
        hgt = lerp(a.n, b.n, w) / nn; top = lerp(a.top, b.top, w); n = nn; L = TL; Rr = TR;
      }
    }
    if (!n) return;
    vn = 0;
    if (shOn) {
      loc(L[0] + SHX[0], top + SHY[0]);
      for (i = 0; i < n; i++) loc(L[i] + SHX[i], top - (i + 0.5) * hgt + SHY[i]);
      loc(L[n - 1] + SHX[n - 1], top - n * hgt + SHY[n - 1]); loc(Rr[n - 1] + SHX[n - 1], top - n * hgt + SHY[n - 1]);
      for (i = n - 1; i >= 0; i--) loc(Rr[i] + SHX[i], top - (i + 0.5) * hgt + SHY[i]);
      loc(Rr[0] + SHX[0], top + SHY[0]);
    } else {
      loc(L[0], top);
      for (i = 0; i < n; i++) loc(L[i], top - (i + 0.5) * hgt);
      loc(L[n - 1], top - n * hgt); loc(Rr[n - 1], top - n * hgt);
      for (i = n - 1; i >= 0; i--) loc(Rr[i], top - (i + 0.5) * hgt);
      loc(Rr[0], top);
    }
    poly(m, t, sh);
  }

  // 字母 → [材质, 色调, 是不是当圆柱来打光]
  var LET = {
    s: [SKIN, 3, 0], e: [SKIN, 3, 0], f: [SKIN, 3, 0], E: [SKIN, 2, 0], n: [SKIN, 3, 0],
    h: [HAIR, 3, 0], g: [HAIR, 3, 0], b: [HAIR, 3, 0], r: [HAIR, 3, 0], q: [HAIR, 3, 0], k: [HAIR, 2, 0],
    H: [HAIR, 4, 0], L: [HAIR, 5, 0], K: [HAIR, 2, 0],
    j: [SUIT, 3, 1], l: [SUIT, 2, 0], m: [SUIT, 2, 0], u: [SUIT, 2, 0], o: [SUIT, 5, 0],
    w: [SHIRT, 3, 0], c: [SHIRT, 4, 0], d: [SHIRT, 4, 0], p: [SHIRT, 4, 0],
    t: [TIE, 3, 0], T: [TIE, 4, 0], y: [TIE, 2, 0],
    x: [SHOE, 3, 0], X: [SHOE, 5, 0], z: [SHOE, 2, 0],
  };
  function drawPlate(pa, pb, w) {
    for (var i = 0; i < pa.length; i++) {
      var a = pa[i], d = LET[a.ch];
      piece(a, pb ? pb[i] : null, w, d[0], d[1], d[2]);
    }
  }

  // ============================================================
  //  4. 长相
  //  字符画一律画成"面向右"。一个字符 = 半个世界单位（R = 2 时正好 1 个像素）。
  // ============================================================
  var DESIGN = {
    // —— 身材（世界单位）——
    hip: 14,                  // 髋关节离地
    thigh: 6.45, shin: 6.3,   // 大腿、小腿
    ankle: 1.5,               // 脚踝离地
    waist: 4,                 // 髋 → 腰（上身从这里弯）
    torso: 10,                // 髋 → 头的轴心（下巴底）
    shY: 8.4, shZ: 4.9,       // 肩关节：比髋高多少、离中线多远
    hipZ: 1.6,                // 髋关节离中线多远
    armU: 5.2, armL: 5.0,     // 上臂、前臂
    rArm: [1.2, 1.05, 0.95],  // 手臂粗细（半径）：肩、肘、腕
    rLeg: [1.3, 1.2, 1.15],   // 腿：髋、膝、踝
    headX: 0.5,               // 侧面时头比脊柱靠前多少
    side: 0.25,               // 侧面时身体朝看的人这边偏多少（0 = 纯侧面）
    headTop: 11,              // 下巴底 → 头顶（世界单位）

    // —— 头：侧面（脸朝右的 3/4 视角）和正面 ——
    //    s 皮肤  e/f 耳朵  h 头发（顶和后）  g 另一边的头发  b/r 鬓角  q 额前翘起来的那一撮
    head: {
      ox: 10, oy: 0, order: 'sefhgbrq', span: { s: 'gbr' },
      side: [
        '..........qqqqqq....',
        '.....hhhhhqqqqqqqq..',
        '...hhhhhhhhhhhhhhhh.',
        '..hhhhhhhhhhhhhhhhhh',
        '.hhhhhhhhhhhhhhhhhhh',
        '.hhhhhhhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhhhhhhhh',
        'hhhhhhhhhhhssssggggg',
        'hhhhhhhhhsssssssgggg',
        'hhhhhhhhsssssssssggg',
        'hhhhhhhsssssssssssgg',
        'hhhhhhbssssssssssss.',
        'hhhhhhbssssssssssss.',
        '.hhheebssssssssssss.',
        '.hhheesssssssssssss.',
        '.hhheesssssssssssss.',
        '..hhessssssssssssss.',
        '..hh.sssssssssssss..',
        '...h..ssssssssssss..',
        '.......ssssssssss...',
        '.........sssssss....',
        '...........ssss.....',
      ],
      front: [
        '.........qqqqqqq....',
        '.....hhhhqqqqqqqqq..',
        '..hhhhhhhhhhhhhhhh..',
        '.hhhhhhhhhhhhhhhhhh.',
        '.hhhhhhhhhhhhhhhhhh.',
        '.hhhhhhhhhhhhhhhhhh.',
        '.hhhhhhhhhhhhhhhhhh.',
        '.hhhhhhsssssggggggg.',
        '.hhhhsssssssssggggg.',
        '.hhhssssssssssssggg.',
        '.hhssssssssssssssgg.',
        '..bssssssssssssssr..',
        '.ebssssssssssssssrf.',
        '.eessssssssssssssff.',
        '.eessssssssssssssff.',
        '.eessssssssssssssff.',
        '..essssssssssssssf..',
        '...ssssssssssssss...',
        '....ssssssssssss....',
        '.....ssssssssss.....',
        '......ssssssss......',
        '........ssss........',
      ],
    },
    // 头发上的高光：不跟着人左右翻（光一直从左上来），只画在头发上
    shine: {
      ox: 10, oy: 16, order: 'HL',
      side: [
        '.....LLL.LL.........',
        '....HHHHHHHH........',
        '....................',
      ],
      front: [
        '....LLL.LL..........',
        '...HHHHHHHH.........',
        '....................',
      ],
    },
    // 五官的位置（字符画里的格子，x 从轴心算、y 从下巴底往上）：[侧面, 正面]
    face: {
      eyeN: [[-1, 10], [-4, 10]],      // 近侧的眼睛：左上角
      eyeF: [[5, 10], [2, 10]],        // 远侧的眼睛
      eyeW: [[2, 2], [2, 2]],          // 眼睛宽几格：[近, 远]
      browN: [[-2, 12], [-5, 12]],     // 眉毛：左上角；宽见 browW
      browF: [[5, 12], [2, 12]],
      browW: [[3, 2], [3, 3]],
      nose: [[4, 6], [0, 6]],          // 鼻子的一点影子（侧面才画）
      mouth: [[3, 3], [0, 3]],         // 嘴的中心（嘴的那一行的底边）
      blushN: [[-3, 6], [-6, 6]],
      blushF: [[7, 6], [4, 6]],
      top: [[2, 22], [1, 22]],         // 头顶（放帽子）
    },

    // —— 上身：西装、衬衫领口、领带结、脖子 ——
    //    j 西装  n 脖子  w 衬衫  c/d 领尖  l/m 驳头的边线  t 领带结  o 扣子  p 口袋巾  u 门襟线
    body: {
      ox: 8, oy: -5, order: 'jnwcdlmutpo',
      side: [
        '......nnnn......',
        '....jjcnndd.....',
        '..jjjjjcttdjj...',
        '..jjjjjlwttwjjj.',
        '..jjjjjjlwwwwjj.',
        '..jjjjjjlwwwwjj.',
        '..jjjjjjjlwwwjj.',
        '..jjjjjjjlwwwjj.',
        '..jjjjjjjjlwwjj.',
        '..jjjjjjjjlwwjj.',
        '..jjjjjjjjjlwjj.',
        '...jjjjjjjjlwj..',
        '...jjjjjjjjjoj..',
        '...jjjjjjjjjjj..',
        '...jjjjjjjjjjj..',
        '...jjjjjjjjjjj..',
        '...jjjjjjjjjjj..',
        '...jjjjjjjjjjj..',
        '..jjjjjjjjjjjj..',
        '..jjjjjjjjjjjj..',
        '..jjjjjjjjjjjjj.',
        '..jjjjjjjjjjjjj.',
        '..jjjjjjjjjjjjj.',
        '..jjjjjjjjjjjjj.',
        '..jjjjjjjjjjjj..',
        '..jjjjjjjjjjj...',
      ],
      fox: 10,
      front: [
        '........nnnn........',
        '......jjcnndjj......',
        '...jjjjjcttdjjjjj...',
        '..jjjjjlwttwmjjjjj..',
        '..jjjjjlwwwwmjjjjj..',
        '..jjjjjlwwwwmjjjjj..',
        '..jjjjjjlwwmjjjppj..',
        '..jjjjjjlwwmjjjjjj..',
        '..jjjjjjlwwmjjjjjj..',
        '..jjjjjjlwwmjjjjjj..',
        '..jjjjjjjlmjjjjjjj..',
        '...jjjjjjjojjjjjj...',
        '...jjjjjjujjjjjjj...',
        '...jjjjjjujjjjjjj...',
        '...jjjjjjujjjjjjj...',
        '...jjjjjjujjjjjjj...',
        '...jjjjjjujjjjjjj...',
        '...jjjjjjujjjjjjj...',
        '..jjjjjjjujjjjjjjj..',
        '..jjjjjjjujjjjjjjj..',
        '..jjjjjjjujjjjjjjj..',
        '..jjjjjjjujjjjjjjj..',
        '..jjjjjjjujjjjjjjj..',
        '..jjjjjjjujjjjjjjj..',
        '..jjjjjjjujjjjjjjj..',
        '..jjjjjjjujjjjjjjj..',
      ],
    },
    // 领带垂下来的那一段：从领带结往下（会晃）。[x, y] = 这一段最上面那格的左上角：[侧面, 正面]
    tie: { at: [[2, 16], [-1, 16]], len: 7, sway: [[0, 0, 0, 1, 1, 1, 2], [0, 0, 0, 0, 0, 0, 0]] },

    // —— 鞋：原点在脚踝，底边在 -3 ——
    shoe: {
      ox: 3, oy: -3, order: 'xX',
      side: [
        '.xxxx....',
        'xxxxxxXX.',
        'xxxxxxxxx',
      ],
      front: [
        '.xxxx.',
        'xxxxxX',
        'xxxxxx',
      ],
    },
  };

  // 把字符画切成片（每套长相只切一次）
  function compile(D) {
    var K = {};
    K.headS = plate(D.head.side, D.head.ox, D.head.oy, D.head.order, D.head.span);
    K.headF = plate(D.head.front, D.head.ox, D.head.oy, D.head.order, D.head.span);
    K.shineS = plate(D.shine.side, D.shine.ox, D.shine.oy, D.shine.order);
    K.shineF = plate(D.shine.front, D.shine.ox, D.shine.oy, D.shine.order);
    K.bodyS = plate(D.body.side, D.body.ox, D.body.oy, D.body.order);
    K.bodyF = plate(D.body.front, D.body.fox === undefined ? D.body.ox : D.body.fox, D.body.oy, D.body.order);
    K.shoeS = plate(D.shoe.side, D.shoe.ox, D.shoe.oy, D.shoe.order);
    K.shoeF = plate(D.shoe.front, D.shoe.ox, D.shoe.oy, D.shoe.order);
    return K;
  }

  // ============================================================
  //  5. 表情
  //  eyes：open 睁着 | wide 睁大 | soft 笑眯一点 | half 半闭 | closed 闭上 | happy 弯弯的 | wink 眨一只
  //  brow：[抬高几格（负 = 压低）, 斜度（-1 = 眉头压下去，+1 = 眉头抬起来）]
  //  mouth：见下面的 MOUTHS；blush：0 没有、1 一点点、2 明显；extra：'sweat' | 'spark' | 'tear'
  // ============================================================
  var FACE = {
    neutral:   { eyes: 'open',   brow: [0, 0],   mouth: 'calm',  blush: 1 },
    smile:     { eyes: 'open',   brow: [0, 0],   mouth: 'smile', blush: 1 },
    grin:      { eyes: 'soft',   brow: [1, 0],   mouth: 'grin',  blush: 1 },
    laugh:     { eyes: 'happy',  brow: [1, 0],   mouth: 'laugh', blush: 2 },
    soft:      { eyes: 'soft',   brow: [0, 1],   mouth: 'soft',  blush: 2 },
    surprised: { eyes: 'wide',   brow: [2, 0],   mouth: 'oh',    blush: 0 },
    wink:      { eyes: 'wink',   brow: [1, 0],   mouth: 'smile', blush: 1, extra: 'spark' },
    blush:     { eyes: 'open',   brow: [0, 1],   mouth: 'tiny',  blush: 2, gaze: [0, -1] },
    sleepy:    { eyes: 'half',   brow: [-1, 0],  mouth: 'tiny',  blush: 1 },
    yawn:      { eyes: 'closed', brow: [1, 1],   mouth: 'yawn',  blush: 1, extra: 'tear' },
    focus:     { eyes: 'open',   brow: [-1, -1], mouth: 'flat',  blush: 0 },
    proud:     { eyes: 'closed', brow: [1, 0],   mouth: 'smirk', blush: 1, extra: 'spark' },
    oops:      { eyes: 'wide',   brow: [1, 1],   mouth: 'wobble', blush: 1, extra: 'sweat' },
    pout:      { eyes: 'half',   brow: [0, -1],  mouth: 'pout',  blush: 2 },
    kiss:      { eyes: 'happy',  brow: [1, 0],   mouth: 'kiss',  blush: 2 },
    wistful:   { eyes: 'half',   brow: [0, 1],   mouth: 'soft',  blush: 1, gaze: [0, -1] },
  };
  var FACES = Object.keys(FACE);
  // 眼睛"睁开多少"：过渡的时候就是在这个数上滑
  var EYE_OPEN = { open: 1, wide: 1.5, soft: 0.8, half: 0.5, closed: 0, happy: 0, wink: 1 };
  // 嘴：一串小方块 [x, y, 宽, 高, 颜色]。x 朝脸对着的方向，y 往下；(0, 0) 是嘴的中心那一格的左上角
  var MOUTHS = {
    calm:   [[-1, 0, 2, 1, F_MOUTH], [1, -1, 1, 1, F_CORNER]],
    tiny:   [[-1, 0, 2, 1, F_MOUTH]],
    flat:   [[-1, 0, 3, 1, F_MOUTH]],
    smile:  [[-1, 0, 2, 1, F_MOUTH], [-2, -1, 1, 1, F_CORNER], [1, -1, 1, 1, F_CORNER]],
    soft:   [[-1, 0, 2, 1, F_MOUTH], [-2, -1, 1, 1, F_CORNER], [1, -1, 1, 1, F_CORNER]],
    smirk:  [[-1, 0, 3, 1, F_MOUTH], [2, -1, 1, 1, F_MOUTH]],
    grin:   [[-2, -1, 1, 1, F_MOUTH], [-1, -1, 3, 1, F_TEETH], [2, -1, 1, 1, F_MOUTH], [-1, 0, 3, 1, F_MOUTH]],
    laugh:  [[-2, -1, 1, 2, F_MOUTH], [-1, -1, 3, 1, F_TEETH], [2, -1, 1, 2, F_MOUTH], [-1, 0, 3, 1, F_DEEP], [-1, 1, 3, 1, F_MOUTH], [0, 1, 1, 1, F_TONGUE]],
    oh:     [[-1, -1, 2, 2, F_DEEP]],
    yawn:   [[-1, -2, 3, 4, F_DEEP], [-1, -2, 3, 1, F_MOUTH], [0, 1, 2, 1, F_TONGUE]],
    wobble: [[-2, 0, 1, 1, F_MOUTH], [-1, -1, 1, 1, F_MOUTH], [0, 0, 1, 1, F_MOUTH], [1, -1, 1, 1, F_MOUTH]],
    pout:   [[-1, -1, 2, 1, F_MOUTH], [-2, 0, 1, 1, F_CORNER], [1, 0, 1, 1, F_CORNER]],
    kiss:   [[0, -1, 1, 2, F_MOUTH], [1, 0, 1, 1, F_CORNER]],
  };

  // ============================================================
  //  6. 姿势表
  //  每个画面名字 = 一张"目标表"。没写的项用 BASE 里的值。骨架会平滑地摆过去，不会一下子跳。
  //
  //  身体：
  //    q      0 = 侧面，1 = 正面（转身时自动经过中间）
  //    px py  骨盆相对站姿挪多少（py 负 = 蹲下去）
  //    lean   上身往前倾几度；bend 腰再多弯几度；tilt 正面时往一边歪几度
  //    hp     头抬起几度（负 = 低头）；hx hy 头平移（半个世界单位一格）
  //  手臂（角度都是"离自然下垂多少度"，正 = 往前抬）：
  //    na1 na2  近侧（靠看的人这边）上臂、前臂；nz1 nz2 往外张开的方位（0 = 朝前，90 = 朝外）
  //    fa1 fa2 fz1 fz2  远侧那只手
  //    nik / fik  [x, y]：直接说"手要到哪儿"（相对两脚中间的地面），会自动换算成上面的角度
  //    nh / fh  手型：'relax' 自然 | 'fist' 握拳 | 'open' 张开 | 'flat' 手心朝下 | 'grip' 抓着东西
  //    zn / zf  手臂画在第几层：2 = 最前，0.5 = 身前头后，-3 = 身后
  //  腿：
  //    sn sf  站着时近脚、远脚想站的位置（差得多了会自己迈一步过去）
  //    heel   踮脚（脚跟抬起的角度）
  //    fr     1 = 腿不踩地，脚踝直接去 ln / lf = [x, y, 脚背角度]（坐下、被拎起来）
  //  其它：
  //    face   默认表情；hold 'N' | 'F' | null：球在哪只手；held {…} 手里有东西时再叠加的改动
  //    tin    摆过去要几秒；swing 走路时手臂跟着摆
  //    keys   [{ at: 秒, …}]：这个画面里再分几步（先后摆的几个目标）
  //    anim   function (t, P, rig)：每一帧在目标上再加一点自己的动静（挥手、揉肚子）
  // ============================================================
  var BASE = {
    q: 0, px: 0, py: 0, lean: 0, bend: 0, tilt: 0, hp: 0, hx: 0, hy: 0,
    na1: 3, na2: 9, nz1: 0, nz2: 0, fa1: -3, fa2: 5, fz1: 0, fz2: 0,
    sn: -1.0, sf: 1.3, heel: 0, fr: 0, lnx: 0, lny: 1.5, lnp: 0, lfx: 0, lfy: 1.5, lfp: 0,
  };
  var PK = Object.keys(BASE);
  // 每一项跟着哪一拨动：身体先动，手臂慢半拍，头最后
  var PGRP = { q: 0, px: 0, py: 0, lean: 0, bend: 0, tilt: 0, hp: 2, hx: 2, hy: 2, na1: 1, na2: 1, nz1: 1, nz2: 1, fa1: 1, fa2: 1, fz1: 1, fz2: 1,
               sn: 0, sf: 0, heel: 0, fr: 0, lnx: 0, lny: 0, lnp: 0, lfx: 0, lfy: 0, lfp: 0 };

  var POSES = {
    // —— 站着（侧面）——
    p_idle: { face: 'neutral', tin: 0.26, held: { na1: 12, na2: 30, nh: 'grip', hold: 'N' } },
    p_idle2: 'p_idle', p_blink: 'p_idle',
    // —— 拿着球站着 ——
    p_hold: { na1: 24, na2: 88, nh: 'grip', hold: 'N', face: 'smile', tin: 0.24 },
    p_hold2: 'p_hold',
    // —— 走（腿由步态管；这里只管手臂怎么摆）——
    p_walk0: { swing: 1, face: 'neutral', tin: 0.16, held: { na1: 18, na2: 62, nh: 'grip', hold: 'N' } },
    p_walk1: 'p_walk0', p_walk2: 'p_walk0', p_walk3: 'p_walk0',
    // —— 丢球：先往后下方荡一下（预备），再举到脑后停住 ——
    p_windup: {
      face: 'focus', hold: 'N', nh: 'grip',
      keys: [
        { at: 0, tin: 0.11, na1: -34, na2: -18, lean: 4, px: 0.3, hp: -2 },
        { at: 0.1, tin: 0.19, na1: -104, na2: -152, lean: -7, bend: -3, px: -1.0, sf: 2.2, hp: 4, fa1: 32, fa2: 58 },
      ],
    },
    // —— 出手：手臂一下子甩到前上方（那一帧带一道残影）——
    p_release: { face: 'focus', hold: 'N', nh: 'open', tin: 0.05, na1: 112, na2: 98, lean: 11, bend: 4, px: 1.4, sf: 3.0, sn: -1.6, heel: 14, hp: 2, fa1: -30, fa2: -12, smear: 1 },
    // —— 随势：手臂继续往下划过去，身子跟着转，然后慢慢收回来 ——
    p_follow: {
      face: 'smile', hold: null, nh: 'relax',
      keys: [
        { at: 0, tin: 0.12, na1: 52, na2: 26, lean: 15, bend: 5, px: 1.8, sf: 3.0, sn: -1.6, heel: 22, fa1: -38, fa2: -20, hp: 5 },
        { at: 0.16, tin: 0.26, na1: 22, na2: 14, lean: 7, bend: 2, px: 1.0, sf: 2.4, sn: -1.2, heel: 0, fa1: -12, fa2: 2, hp: 4 },
      ],
    },
    // —— 伸手摸身边的狗的头 ——
    p_pat: {
      face: 'soft', tin: 0.24, lean: 13, bend: 9, px: -0.4, hp: -9, nh: 'flat', touch: [9.6, 17.5],
      held: { fa1: -40, fa2: -24, fh: 'grip', hold: 'F' },
      anim: function (t, P) { var s = Math.sin(t * 2 * PI * 2.1); P.tdx = s * 0.9; P.tdy = -Math.abs(s) * 0.5; },
    },
    // —— 举起双手（欢呼、伸懒腰；被拎起来时也用它）——
    p_cheer: {
      face: 'laugh', tin: 0.2, na1: 158, na2: 172, fa1: -152, fa2: -170, nh: 'open', fh: 'open', hp: 5, lean: -2, hold: 'N',
      anim: function (t, P) { var b = Math.max(0, Math.sin(t * 2 * PI * 2.6)); P.heel += b * 26; P.na2 += b * 6; P.fa2 -= b * 6; },
    },
    p_cheer2: 'p_cheer',
    // —— 蹲下来，和小腊肠一样高，揉一揉 ——
    p_crouch: {
      face: 'soft', tin: 0.3, py: -7.4, px: -2.6, lean: 20, bend: 16, heel: 34, hp: -6, nh: 'flat', touch: [8.2, 7.6],
      fik: [2.6, 9.4], held: { fik: [1.4, 9.6], fh: 'grip', hold: 'F' }, zf: 0.5,
      anim: function (t, P) { var s = Math.sin(t * 2 * PI * 2.6); P.tdx = s * 1.1; P.tdy = Math.abs(s) * 0.3; },
    },
    p_crouch2: 'p_crouch',
    // —— 坐在草地上：近腿曲着，手搭在膝盖上 ——
    p_sit: {
      face: 'soft', tin: 0.42, py: -11.2, px: -2.6, lean: -9, bend: 8, hp: 3, fr: 1,
      lnx: 4.2, lny: 1.5, lnp: 0, lfx: 9.4, lfy: 1.6, lfp: -38,
      nik: [3.4, 8.2], fik: [-6.2, 1.2], fh: 'flat', hold: null,
      held: { nik: [4.6, 6.2], nh: 'grip', hold: 'N' },
    },
    // —— 整理领带 ——
    p_tie_a: {
      face: 'proud', tin: 0.22, nik: [3.3, 21.6], nh: 'fist', hp: 6, zn: 2,
      held: { fa1: 10, fa2: 26, fh: 'grip', hold: 'F', zf: 0.5 },
      anim: function (t, P) { var s = Math.sin(t * 2 * PI * 1.6); P.tdy = s * 0.45; P.hp += s * 2; P.tie = s > 0 ? 1 : 0; },
    },
    p_tie_b: 'p_tie_a',
    // —— 看手表 ——
    p_watch: { face: 'neutral', tin: 0.24, na1: 28, na2: 118, nh: 'fist', hp: -11, hx: 0, lean: 2, watch: 1, gaze: [0, -1],
               held: { fa1: 10, fa2: 26, fh: 'grip', hold: 'F', zf: 0.5 } },
    // —— 正面站着 ——
    p_front: { q: 1, face: 'smile', tin: 0.24, na1: 0, na2: 2, fa1: 0, fa2: 2, nz1: 90, nz2: 90, fz1: 90, fz2: 90, sn: -0.3, sf: 0.3,
               held: { na1: 7, na2: 16, nh: 'grip', hold: 'N' } },
    p_front2: 'p_front', p_front_blink: 'p_front',
    // —— 正面朝看的人挥手 ——
    p_wave_a: {
      q: 1, face: 'grin', tin: 0.2, na1: 0, na2: 2, nz1: 90, nz2: 90, fa1: 128, fa2: 172, fz1: 90, fz2: 90, fh: 'open', sn: -0.3, sf: 0.3, tilt: 2, zf: 2,
      held: { na1: 7, na2: 16, nh: 'grip', hold: 'N' },
      anim: function (t, P) { var s = Math.sin(t * 2 * PI * 2.5); P.fa2 += s * 21; P.fa1 += s * 3; P.tilt += s * 0.8; },
    },
    p_wave_b: 'p_wave_a',
    // —— 被鼠标拎起来：吊着，腿乱蹬 ——
    carried: {
      face: 'oops', tin: 0.16, na1: 168, na2: 176, fa1: -166, fa2: -176, nh: 'fist', fh: 'fist', fr: 1, hp: 3, hold: null,
      lnx: -0.6, lny: 2.4, lnp: 34, lfx: 0.8, lfy: 2.8, lfp: 34, py: 0.6,
      anim: function (t, P) {
        var s = Math.sin(t * 2 * PI * 2.3), c = Math.sin(t * 2 * PI * 2.3 + 2.2), w = Math.sin(t * 2 * PI * 0.9);
        P.lnx += s * 2.6; P.lny += Math.max(0, s) * 1.8; P.lfx += c * 2.6; P.lfy += Math.max(0, c) * 1.8;
        P.lean = w * 5; P.na1 += w * 3; P.fa1 += w * 3;
      },
    },
    // —— 跳在半空（跳回岛里）——
    air: { face: 'grin', tin: 0.12, na1: 132, na2: 150, fa1: -118, fa2: -140, nh: 'open', fh: 'open', fr: 1, lean: 5, hp: 4, hold: 'N',
           lnx: -2.4, lny: 3.6, lnp: 30, lfx: 2.6, lfy: 4.4, lfp: 12 },
  };
  var FRAMES = ['p_front', 'p_front2', 'p_front_blink', 'p_wave_a', 'p_wave_b', 'p_idle', 'p_idle2', 'p_blink', 'p_hold', 'p_hold2',
                'p_walk0', 'p_walk1', 'p_walk2', 'p_walk3', 'p_windup', 'p_release', 'p_follow', 'p_pat', 'p_cheer', 'p_cheer2',
                'p_crouch', 'p_crouch2', 'p_sit', 'p_tie_a', 'p_tie_b', 'p_watch'];
  function poseOf(name) {
    var p = POSES[name];
    while (typeof p === 'string') { name = p; p = POSES[name]; }
    if (!p) { name = 'p_idle'; p = POSES.p_idle; }
    p._name = name;
    return p;
  }

  // 过渡用的几种"缓急"
  function easeIO(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeBack(t) { var c = 1.35; t -= 1; return 1 + (c + 1) * t * t * t + c * t * t; }     // 冲过头一点再回来

  // ============================================================
  //  7. 骨架
  // ============================================================
  // 两节骨头够一个点：从 (hx, hy) 出发，长 l1、l2，够 (ax, ay)。返回中间关节；dir = +1 关节朝前弯（膝盖），-1 朝后（手肘）
  var IKX = 0, IKY = 0, IKAX = 0, IKAY = 0;
  function ik2(hx, hy, ax, ay, l1, l2, dir) {
    var dx = ax - hx, dy = ay - hy, d = Math.sqrt(dx * dx + dy * dy), mx = l1 + l2 - 0.02, mn = Math.abs(l1 - l2) + 0.02;
    if (d < 1e-4) { dx = 0; dy = -1; d = 1e-4; }
    if (d > mx) { ax = hx + dx / d * mx; ay = hy + dy / d * mx; d = mx; }
    else if (d < mn) { ax = hx + dx / d * mn; ay = hy + dy / d * mn; d = mn; }
    var a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    var ux = (ax - hx) / d, uy = (ay - hy) / d;
    var px = -uy, py = ux;                       // 垂直方向
    if ((px * dir < 0) || (px === 0 && py * dir > 0)) { px = -px; py = -py; }
    IKX = hx + ux * a + px * h; IKY = hy + uy * a + py * h; IKAX = ax; IKAY = ay;
  }
  // 脚的几个点（相对脚踝，脚平放时）：脚跟、前掌、脚尖
  var HEELX = -1.1, BALLX = 2.2, SOLE = -1.5;
  // 脚背角 p（正 = 脚跟抬起）时，脚踝在哪儿。x = 脚平放时脚踝该在的位置
  var ANKX = 0, ANKY = 0;
  function ankleOf(x, p) {
    var a = p * RAD, c = Math.cos(a), s = Math.sin(a);
    if (p >= 0) { ANKX = x + BALLX - BALLX * c - SOLE * s; ANKY = BALLX * s - SOLE * c; }    // 绕前掌转
    else { ANKX = x + HEELX - HEELX * c - SOLE * s; ANKY = HEELX * s - SOLE * c; }           // 绕脚跟转
  }

  function Foot(x) {
    this.x = x;            // 脚平放时脚踝的位置（相对身体；脚踩住时会随着身体往前走而往后退）
    this.h = 0;            // 抬离地面多高
    this.p = 0;            // 脚背角
    this.on = true;        // 踩着地
    this.sx = x; this.w0 = 0; this.st = -1; this.tx = x; this.sp = 0;
  }

  function Rig(cfg, design) {
    cfg = cfg || {};
    var D = this.D = design ? Object.assign({}, DESIGN, design) : DESIGN, k;
    this.K = compile(D);
    var P = buildPalette(Object.assign({}, cfg.person || {}));
    this.pal = P.pal; this.colors = P.list;
    this.cur = {}; this.from = {}; this.tgt = {};
    for (k in BASE) { this.cur[k] = BASE[k]; this.from[k] = BASE[k]; this.tgt[k] = BASE[k]; }
    this.pose = poseOf('p_idle'); this.key = 0; this.ft = 0; this.tt = 1; this.td = 0.2; this.ease = 0;
    this.held = false; this.holdHand = null; this.nh = 'relax'; this.fh = 'relax'; this.zn = 2; this.zf = -3;
    this.tdx = 0; this.tdy = 0; this.tieUp = 0; this.watch = 0; this.smear = 0; this.sa1 = 0; this.sa2 = 0;
    this.touch = [0, 0]; this.hasTouch = false;
    // 步态
    this.feet = [new Foot(BASE.sn), new Foot(BASE.sf)];
    this.ph = 0; this.walking = false; this.gw = 0; this.v = 0; this.run = 0; this.dist = 0; this.bob = 0; this.glean = 0;
    this.sq = 0; this.sqv = 0;               // 骨盆上下的弹簧（落地、起步、停步时沉一下）
    this.lastAir = 0; this.lastMoving = false;
    // 朝向和转身
    this.want = null; this.vis = false; this.turnQ = 0;
    // 脸
    this.faceName = 'neutral'; this.eo = 1; this.arc = 0; this.wink = 0; this.by = 0; this.bt = 0; this.bl = 1;
    this.mouth = 'calm'; this.mouthTo = 'calm'; this.mt = 1; this.extra = null; this.et = 0;
    this.blink = 0; this.blinkAt = 1.5; this.blink2 = false; this.shut = false;
    this.gx = 0; this.gy = 0; this.lookP = 0;
    // 晃动的小东西：领带、头发、衣摆
    this.tieX = 0; this.tieV = 0; this.hairX = 0; this.hairV = 0; this.hairY = 0; this.hairYV = 0; this.hemX = 0; this.hemV = 0;
    this.pvx = 0; this.pvy = 0; this.lcx = 0; this.lcy = 0; this.first = true;
    // 呼吸、小动作
    this.clock = 0; this.breath = 0; this.seed = 12345;
    this.S = { top: 0 };
    this.imgs = {};
  }
  Rig.prototype.rand = function () { this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff; return this.seed / 0x7fffffff; };

  // 把一张姿势表里写了的项抄到目标里
  function applyFields(T, src) {
    for (var i = 0; i < PK.length; i++) { var k = PK[i]; if (src[k] !== undefined) T[k] = src[k]; }
  }
  // 目标姿势里肩膀在哪儿（算"手要到哪儿"时要用）
  var SHOX = 0, SHOY = 0;
  function shoulderOf(D, T, sgn) {
    var lo = (T.lean - 0.35 * T.bend) * RAD, up = (T.lean + 0.65 * T.bend) * RAD, d = D.shY - D.waist;
    SHOX = T.px + D.waist * Math.sin(lo) + d * Math.sin(up) - sgn * D.shZ * D.side;
    SHOY = D.hip + T.py + D.waist * Math.cos(lo) + d * Math.cos(up);
  }
  // 手要到 (x, y)：换算成上臂、前臂的角度，写进目标
  function reach(D, T, x, y, near) {
    shoulderOf(D, T, near ? 1 : -1);
    var l2 = D.armL + 1.0;                      // 前臂 + 半个手掌
    ik2(SHOX, SHOY, x, y, D.armU, l2, -1);
    var a1 = Math.atan2(IKX - SHOX, -(IKY - SHOY)) / RAD, a2 = Math.atan2(IKAX - IKX, -(IKAY - IKY)) / RAD;
    if (near) { T.na1 = a1; T.na2 = a2; T.nz1 = 0; T.nz2 = 0; } else { T.fa1 = a1; T.fa2 = a2; T.fz1 = 0; T.fz2 = 0; }
  }

  Rig.prototype.update = function (dt, input) {
    input = input || {};
    if (!(dt > 0)) dt = 1e-4;
    if (dt > 0.25) dt = 0.25;
    var n = Math.max(1, Math.ceil(dt / 0.01667)), h = dt / n;
    for (var i = 0; i < n; i++) this.step(h, input);
  };

  Rig.prototype.step = function (h, I) {
    var D = this.D, k, i, T = this.tgt, C = this.cur;
    this.clock += h;
    var moving = !!I.moving && (I.speed === undefined || I.speed > 0.5);
    var speed = moving ? (I.speed === undefined ? 24 : +I.speed) : 0;
    var held = !!I.holding;

    // ---------- 现在该摆哪个姿势 ----------
    var name = I.carried ? 'carried' : (I.air > 0.5 ? 'air' : (I.frame || 'p_idle'));
    var pose = poseOf(name);
    if (pose.swing && !moving) pose = poseOf(held ? 'p_hold' : 'p_idle');           // 走路的画面但其实没在走
    if (pose !== this.pose || held !== this.held) {
      var same = pose === this.pose;
      this.pose = pose; this.held = held;
      if (!same) { this.ft = 0; this.key = 0; }
      this.begin(pose.keys ? pose.keys[this.key] : pose);
    }
    this.ft += h;
    if (pose.keys && this.key + 1 < pose.keys.length && this.ft >= pose.keys[this.key + 1].at) { this.key++; this.begin(pose.keys[this.key]); }

    // ---------- 目标 ----------
    for (i = 0; i < PK.length; i++) T[PK[i]] = BASE[PK[i]];
    var kd = pose.keys ? pose.keys[this.key] : null;
    applyFields(T, pose);
    if (kd) applyFields(T, kd);
    if (held && pose.held) applyFields(T, pose.held);
    T.tdx = 0; T.tdy = 0; T.tie = 0;
    if (pose.anim) pose.anim(this.ft, T, this);
    this.tdx = T.tdx; this.tdy = T.tdy; this.tieUp = T.tie;
    // 手要去够的地方
    var nik = (held && pose.held && pose.held.nik) || (kd && kd.nik) || pose.nik;
    var fik = (held && pose.held && pose.held.fik) || (kd && kd.fik) || pose.fik;
    if (pose.touch) {
      var tx = pose.touch[0], ty = pose.touch[1], L = I.touch || I.look;
      if (L && L[0] * (this.vis ? -1 : 1) > 4 && L[0] * (this.vis ? -1 : 1) < 15 && L[1] > 3 && L[1] < 30) {     // 引擎说了要摸哪儿
        tx = clamp(L[0] * (this.vis ? -1 : 1), 6, 13); ty = clamp(L[1], pose.touch[1] - 9, pose.touch[1] + 9);
      }
      if (!this.hasTouch) { this.touch[0] = tx; this.touch[1] = ty; this.hasTouch = true; }
      this.touch[0] += (tx - this.touch[0]) * Math.min(1, h * 9); this.touch[1] += (ty - this.touch[1]) * Math.min(1, h * 9);
      reach(D, T, this.touch[0] + T.tdx, this.touch[1] + T.tdy, true);
    } else {
      this.hasTouch = false;
      if (nik) reach(D, T, nik[0] + T.tdx, nik[1] + T.tdy, true);
    }
    if (fik) reach(D, T, fik[0], fik[1], false);
    // 走路时的手臂、身子
    if (moving) this.swingArms(T, pose, speed, held);

    // ---------- 平滑地摆过去 ----------
    this.tt = Math.min(1, this.tt + h / this.td);
    var t = this.tt, F = this.from;
    for (i = 0; i < PK.length; i++) {
      k = PK[i];
      var g = PGRP[k], u = g === 0 ? t : (g === 1 ? clamp((t - 0.1) / 0.9, 0, 1) : clamp((t - 0.16) / 0.84, 0, 1));
      u = this.ease === 2 ? easeOut(u) : (g === 1 ? easeBack(u) : easeIO(u));
      C[k] = F[k] + (T[k] - F[k]) * u;
    }

    this.gait(h, moving, speed, pose);
    this.faceStep(h, I, pose, kd, moving);
    this.springs(h, moving, speed);

    // 呼吸：肩膀隔一阵抬 1 格再落回去（低 1.4 秒、高 1.2 秒）
    var bt = this.clock % 3.0;
    this.breath = (bt > 1.5 && bt < 2.85) ? 1 : 0;
    // 残影只留一瞬间
    this.smear = (pose.smear && this.ft < 0.055) ? 1 : 0;
    this.watch = pose.watch ? Math.min(1, this.watch + h * 6) : Math.max(0, this.watch - h * 8);
    // 落地：沉一下
    var air = I.air > 0.5 ? 1 : 0;
    if (this.lastAir && !air && !I.carried) this.sqv -= 26;
    this.lastAir = air;
    this.sqv += (-this.sq * 260 - this.sqv * 19) * h; this.sq += this.sqv * h;
  };

  // 换了目标：从现在的样子出发
  Rig.prototype.begin = function (spec) {
    for (var i = 0; i < PK.length; i++) this.from[PK[i]] = this.cur[PK[i]];
    this.tt = 0;
    this.td = Math.max(0.02, (spec && spec.tin) || this.pose.tin || 0.22);
    this.ease = this.td < 0.08 ? 2 : 0;
    var p = this.pose, hd = this.held && p.held ? p.held : null;
    function pick(k, d) { return (hd && hd[k] !== undefined) ? hd[k] : ((spec && spec[k] !== undefined) ? spec[k] : (p[k] !== undefined ? p[k] : d)); }
    this.nh = pick('nh', 'relax'); this.fh = pick('fh', 'relax');
    this.zn = pick('zn', 2); this.zf = pick('zf', -3);
    this.holdHand = pick('hold', p === POSES.p_follow ? null : 'N');
    if (p.smear) { this.sa1 = this.cur.na1; this.sa2 = this.cur.na2; }
  };

  // 走、跑时手臂怎么摆（和同侧的腿反着来）
  Rig.prototype.swingArms = function (T, pose, v, held) {
    var run = this.run, c = Math.cos(this.ph * 2 * PI), s = Math.sin(this.ph * 2 * PI);
    var amp = lerp(15 + clamp((v - 24) / 22, 0, 1) * 13, 40, run), bend = lerp(13, 82, run);
    if (pose.swing) {
      T.fa1 = amp * c - 2; T.fa2 = T.fa1 + bend + Math.max(0, c) * 12;
      if (!(held && pose.held)) { T.na1 = -amp * c + 2; T.na2 = T.na1 + bend + Math.max(0, -c) * 12; }
      else { T.na1 += -c * 3; T.na2 += s * 4 + run * 14; }                      // 拿着球：那只手弯着，只跟着颠一颠
      T.lean = lerp(2 + clamp((v - 24) / 22, 0, 1) * 3, 11, run);
      T.hp = lerp(0, 3, run);
    } else {
      T.lean += lerp(1, 5, run);
    }
  };

  // 步态参数：一个循环走多远、脚踩地占多大比例、抬多高、落在髋前面多远
  var GS = 18, GD = 0.62, GLIFT = 1.4, GAF = 5.4, GRUN = 0;
  function gaitParams(v) {
    var run = smooth((v - 50) / 11), u = clamp((v - 24) / 22, 0, 1);
    var stepW = v < 24 ? 9 * Math.pow(Math.max(v, 6) / 24, 0.55) : 9 + u * 3 + Math.max(0, v - 46) * 0.05;
    var stepR = 13.2 + (v - 62) * 0.17;
    GRUN = run;
    GS = 2 * lerp(stepW, stepR, run);
    GD = lerp(0.63 - u * 0.03, 0.40 - clamp((v - 62) / 40, 0, 1) * 0.05, run);
    GLIFT = lerp(1.25 + u * 0.5, 4.4 + clamp((v - 62) / 40, 0, 1), run);
    GAF = GS * GD * lerp(0.48, 0.36, run);
  }

  // 两只脚：走和跑的时候按节拍一步一步迈；站着的时候谁离该站的地方远了，谁就自己挪一步
  Rig.prototype.gait = function (h, moving, v, pose) {
    var f = this.feet, C = this.cur, i, ft, u;
    var rest = [C.sn, C.sf];
    if (moving) {
      gaitParams(v);
      this.v = v; this.run = GRUN;
      var dd = v * h;
      this.dist += dd;
      if (!this.walking) {
        // 起步：后面那只脚先迈；另一只脚从它现在踩的地方接着往后蹬
        this.walking = true;
        var lead = f[0].x <= f[1].x ? 0 : 1, st = f[1 - lead];
        var s0 = clamp((GAF - st.x) / (GS * GD), 0.05, 0.9);
        this.ph = frac(s0 * GD - (lead === 0 ? 0.5 : 0));
        for (i = 0; i < 2; i++) { f[i].st = -1; }
        st.on = true;
        ft = f[lead]; ft.on = false; ft.sx = ft.x; ft.sp = ft.p;
        u = frac(this.ph + (lead === 0 ? 0 : 0.5)); ft.w0 = clamp((u - GD) / (1 - GD), 0, 0.85);
        this.sqv -= 6;
      }
      this.ph = frac(this.ph + dd / GS);
      for (i = 0; i < 2; i++) {
        ft = f[i]; u = frac(this.ph + i * 0.5);
        if (u < GD) {                                   // 踩着地：脚不动，身体往前走
          if (!ft.on) { ft.on = true; ft.x = GAF; ft.h = 0; }
          else ft.x -= dd;
          var s = u / GD, hs = lerp(-15, -4, GRUN), to = lerp(40, 52, GRUN);
          ft.p = s < 0.14 ? hs * (1 - s / 0.14) : (s > 0.56 ? to * Math.pow((s - 0.56) / 0.44, 1.4) : 0);
          ft.h = 0;
        } else {                                        // 腾空：从离地的地方荡到下一个落脚点
          var w = (u - GD) / (1 - GD);
          if (ft.on) { ft.on = false; ft.sx = ft.x; ft.sp = ft.p; ft.w0 = Math.min(w, 0.6); }
          var ww = clamp((w - ft.w0) / (1 - ft.w0), 0, 1);
          var e = ww < 0.5 ? 2 * ww * ww : 1 - Math.pow(-2 * ww + 2, 2) / 2;
          ft.x = lerp(ft.sx, GAF, e);
          ft.h = GLIFT * Math.pow(Math.sin(PI * Math.pow(ww, 0.8)), 1.2) * (1 - ft.w0 * 0.5);
          ft.p = ww < 0.3 ? lerp(ft.sp, ft.sp + 14 + GRUN * 26, ww / 0.3) : lerp(ft.sp + 14 + GRUN * 26, lerp(-15, -4, GRUN), smooth((ww - 0.3) / 0.7));
        }
      }
      this.gw = Math.min(1, this.gw + h * 7);
    } else {
      if (this.walking) {
        this.walking = false; this.sqv -= 5 + this.run * 6;
        // 停下：还在半空的那只脚就近落到该站的地方
        for (i = 0; i < 2; i++) {
          ft = f[i];
          if (!ft.on) { ft.st = 0.35; ft.sx = ft.x - (ft.x - rest[i]) * 0; ft.tx = rest[i]; ft.sh = ft.h; ft.sp = ft.p; ft.sx = ft.x; }
        }
      }
      this.v = 0;
      this.gw = Math.max(0, this.gw - h * 6);
      this.run = Math.max(0, this.run - h * 5);
      // 正在挪的脚
      var busy = false;
      for (i = 0; i < 2; i++) {
        ft = f[i];
        if (ft.st >= 0) {
          busy = true;
          ft.st += h / 0.2;
          var q = clamp(ft.st, 0, 1), e2 = smooth(q);
          ft.tx = rest[i];
          ft.x = lerp(ft.sx, ft.tx, e2);
          ft.h = Math.sin(PI * q) * 1.1 + (ft.sh || 0) * (1 - q);
          ft.p = lerp(ft.sp || 0, 0, q) + Math.sin(PI * q) * 10;
          if (ft.st >= 1) { ft.st = -1; ft.on = true; ft.h = 0; ft.x = ft.tx; ft.p = 0; ft.sh = 0; }
        }
      }
      // 都踩稳了：谁离得远谁挪
      if (!busy && C.fr < 0.5) {
        var e0 = Math.abs(f[0].x - rest[0]), e1 = Math.abs(f[1].x - rest[1]), w2 = e0 >= e1 ? 0 : 1;
        if (Math.max(e0, e1) > 0.75) { ft = f[w2]; ft.st = 0; ft.sx = ft.x; ft.tx = rest[w2]; ft.on = false; ft.sh = 0; ft.sp = ft.p; }
      }
      for (i = 0; i < 2; i++) if (f[i].st < 0) { f[i].p += (C.heel - f[i].p) * Math.min(1, h * 16); f[i].h = 0; f[i].on = true; }
    }
  };

  // 表情：眼睛、眉毛、嘴各自往目标过渡；眨眼自己来
  Rig.prototype.faceStep = function (h, I, pose, kd, moving) {
    var name = I.face && FACE[I.face] ? I.face : ((kd && kd.face) || pose.face || 'neutral');
    if (!I.face && moving && this.run > 0.5 && pose.swing) name = 'smile';
    var F = FACE[name];
    this.faceName = name;
    // 眼睛
    var style = F.eyes, eo = EYE_OPEN[style];
    if (this.shut) eo = 0;
    var sp = h / 0.075;
    if (this.eo < eo) this.eo = Math.min(eo, this.eo + sp); else this.eo = Math.max(eo, this.eo - sp);
    var arc = style === 'happy' ? 1 : 0;
    if (this.arc !== arc && (this.eo < 0.3 || arc === 0)) this.arc = arc;
    this.wink = style === 'wink' ? Math.min(1, this.wink + sp) : Math.max(0, this.wink - sp);
    // 眉毛、腮红
    this.by += clamp(F.brow[0] - this.by, -h * 14, h * 14);
    this.bt += clamp(F.brow[1] - this.bt, -h * 12, h * 12);
    this.bl += clamp(F.blush - this.bl, -h * 8, h * 8);
    // 嘴：先收成一条小缝，再变成新的样子
    if (F.mouth !== this.mouthTo) { this.mouthTo = F.mouth; this.mt = 0; }
    if (this.mt < 1) { this.mt += h / 0.13; if (this.mt >= 0.5) this.mouth = this.mouthTo; }
    // 汗、星星、眼泪
    if (F.extra !== this.extra) { this.extra = F.extra || null; this.et = 0; }
    this.et += h;
    // 眨眼：隔 2~5 秒一次，偶尔连眨两下
    this.blinkAt -= h;
    if (this.blinkAt <= 0) {
      if (this.blink <= 0) this.blink = 0.13;
      this.blinkAt = this.blink2 ? 2 + this.rand() * 3.2 : (this.rand() < 0.14 ? 0.24 : 2 + this.rand() * 3.2);
      this.blink2 = !this.blink2 && this.blinkAt < 0.3;
    }
    if (this.blink > 0) this.blink -= h;
    this.shut = pose._name === 'p_idle' ? I.frame === 'p_blink' : (pose._name === 'p_front' ? I.frame === 'p_front_blink' : false);
    // 眼神：往要看的地方挪 1 格；头也跟着偏一点
    var gx = 0, gy = 0, lp = 0, L = I.look, D = this.D;
    if (F.gaze) { gx = F.gaze[0]; gy = F.gaze[1]; }
    else if (pose.gaze) { gx = pose.gaze[0]; gy = pose.gaze[1]; }
    else if (L) {
      var dx = L[0] * (this.vis ? -1 : 1), dy = L[1] - (D.hip + D.torso + 4.5), front = this.cur.q > 0.5;
      var dd = Math.sqrt(dx * dx + dy * dy);
      if (dd > 3) {
        if (front) gx = dx > 6 ? 1 : (dx < -6 ? -1 : 0); else gx = dx < -2 ? -1 : (dx > 14 && Math.abs(dy) < dx * 0.5 ? 1 : 0);
        gy = dy > Math.abs(dx) * 0.45 + 2 ? 1 : (dy < -Math.abs(dx) * 0.45 - 2 ? -1 : 0);
        if (!front && dx > 0) lp = clamp(Math.atan2(dy, dx) / RAD * 0.3, -9, 11);
      }
    }
    this.gx = gx; this.gy = gy;
    this.lookP += (lp - this.lookP) * Math.min(1, h * 7);
  };

  // 领带、头发、衣摆：跟在身体后面晃
  Rig.prototype.springs = function (h, moving, v) {
    var C = this.cur, D = this.D;
    // 胸口现在在哪儿（相对身体）→ 它的速度、加速度
    var cx = C.px + (D.shY) * Math.sin((C.lean + 0.5 * C.bend) * RAD), cy = C.py + this.bob + this.sq;
    if (this.first) { this.lcx = cx; this.lcy = cy; this.first = false; }
    var vx = (cx - this.lcx) / h + (moving ? v : 0), vy = (cy - this.lcy) / h;
    this.lcx = cx; this.lcy = cy;
    var ax = clamp((vx - this.pvx) / h, -900, 900), ay = clamp((vy - this.pvy) / h, -900, 900);
    this.pvx += (vx - this.pvx) * Math.min(1, h * 30); this.pvy += (vy - this.pvy) * Math.min(1, h * 30);
    var wind = clamp(this.pvx, -90, 90);
    // 领带尖：身子往前冲它就往后飘；上身前倾它就垂下来离开胸口
    var tt = -wind * 0.022 - ax * 0.0035 + Math.max(0, C.lean + C.bend * 0.6 - 4) * 0.075;
    this.tieV += ((tt - this.tieX) * 150 - this.tieV * 9) * h; this.tieX += this.tieV * h;
    // 头发：额前那一撮往后倒、上下颠
    var ht = -wind * 0.012 - ax * 0.002;
    this.hairV += ((ht - this.hairX) * 190 - this.hairV * 11) * h; this.hairX += this.hairV * h;
    this.hairYV += ((-ay * 0.0028 - this.hairY) * 210 - this.hairYV * 10) * h; this.hairY += this.hairYV * h;
    // 衣摆
    var et = -wind * 0.02 - ax * 0.003;
    this.hemV += ((et - this.hemX) * 120 - this.hemV * 8) * h; this.hemX += this.hemV * h;
  };

  // ------------------------------------------------------------
  //  算出这一帧每个关节在哪儿（世界单位，x 朝前、y 朝上，还没左右翻）
  // ------------------------------------------------------------
  Rig.prototype.solve = function () {
    var D = this.D, C = this.cur, S = this.S, f = this.feet, i;
    var q = clamp(Math.max(C.q, this.turnQ), 0, 1), wq = Math.sin(q * PI / 2), pa = Math.cos(q * PI / 2), pb = D.side + (1 - D.side) * wq;
    S.q = q; S.wq = wq; S.pa = pa; S.pb = pb;
    var L = D.thigh + D.shin, gw = this.gw, run = this.run;
    // 两只脚踝（踩地的 / 自由的 按 fr 混）
    var ax = [0, 0], ay = [0, 0], ap = [0, 0], fr = C.fr;
    for (i = 0; i < 2; i++) {
      var ft = f[i];
      ankleOf(ft.x, ft.p);
      var gx = ANKX, gy = ANKY + ft.h, gp = ft.p;
      if (ft.h > 0 && gp > 0) { var need = 0.25 + 3.3 * Math.sin(gp * RAD) + 1.3 * Math.cos(gp * RAD); if (gy < need) gy = need; }   // 脚尖别戳进地里
      if (fr > 0.001) {
        gx = lerp(gx, i ? C.lfx : C.lnx, fr); gy = lerp(gy, i ? C.lfy : C.lny, fr); gp = lerp(gp, i ? C.lfp : C.lnp, fr);
      }
      ax[i] = gx; ay[i] = gy; ap[i] = gp;
    }
    // 骨盆：走路时一高一低；不能高到踩着地的脚够不着
    var hx = C.px, hy = D.hip + C.py + this.sq;
    if (gw > 0.001) {
      var ph = this.ph, wb = -0.55 + 0.45 * Math.cos(4 * PI * (ph - 0.36));
      var rb = -1.45 + 0.85 * -Math.cos(4 * PI * (ph - GD * 0.5));
      this.bob = lerp(wb, rb, run) * gw;
      hy += this.bob;
    } else this.bob = 0;
    if (fr < 0.5) {
      for (i = 0; i < 2; i++) if (f[i].on || f[i].st >= 0 || !this.walking) {
        var ddx = ax[i] - hx, lim = L * L * 0.985 - ddx * ddx;
        var top = ay[i] + (lim > 0 ? Math.sqrt(lim) : 0);
        if (f[i].on && hy > top) hy = lerp(hy, top, 1 - fr * 2);
      }
    }
    S.hx = hx; S.hy = hy;
    // 膝盖
    S.leg = S.leg || [{}, {}];
    for (i = 0; i < 2; i++) {
      ik2(hx, hy, ax[i], ay[i], D.thigh, D.shin, 1);
      var lg = S.leg[i];
      lg.kx = IKX; lg.ky = IKY; lg.ax = IKAX; lg.ay = IKAY; lg.p = ap[i];
      lg.z = (i ? -1 : 1) * D.hipZ;
    }
    // 上身：下半截、上半截各自的角度（正面时前倾看不出来，只看得出往一边歪）
    var lean = C.lean + (gw > 0 ? 0 : 0), lo = (lean - 0.35 * C.bend) * RAD, up = (lean + 0.65 * C.bend) * RAD;
    S.lo = lo * pa + C.tilt * RAD * wq * 0.4; S.up = up * pa + C.tilt * RAD * wq;
    S.wx = hx * pa + D.waist * Math.sin(S.lo); S.wy = hy + D.waist * Math.cos(S.lo);
    var br = this.breath * 0.5;
    S.wy2 = S.wy + br;
    // 肩、头的轴心（都长在上半截上）
    var su = Math.sin(S.up), cu = Math.cos(S.up), d1 = D.shY - D.waist, d2 = D.torso - D.waist;
    S.sx = S.wx + d1 * su; S.sy = S.wy2 + d1 * cu;
    var hxo = D.headX * (1 - wq);
    S.nx = S.wx + d2 * su + hxo * cu + C.hx * 0.5; S.ny = S.wy2 + d2 * cu - hxo * su + C.hy * 0.5;
    S.hp = (C.hp + this.lookP) * (1 - wq * 0.6);
    // 手臂
    S.arm = S.arm || [{}, {}];
    for (i = 0; i < 2; i++) {
      var A = S.arm[i], sg = i ? -1 : 1;
      var a1 = (i ? C.fa1 : C.na1) * RAD, a2 = (i ? C.fa2 : C.na2) * RAD, z1 = (i ? C.fz1 : C.nz1) * RAD, z2 = (i ? C.fz2 : C.nz2) * RAD;
      A.sx = S.sx - sg * D.shZ * pb; A.sy = S.sy;
      var s1 = Math.sin(a1), s2 = Math.sin(a2);
      A.ex = A.sx + D.armU * (s1 * Math.cos(z1) * pa - sg * s1 * Math.sin(z1) * pb * (q > 0.5 ? 1 : 0.6));
      A.ey = A.sy - D.armU * Math.cos(a1);
      var fx = s2 * Math.cos(z2) * pa - sg * s2 * Math.sin(z2) * pb * (q > 0.5 ? 1 : 0.6), fy = -Math.cos(a2);
      A.wx = A.ex + D.armL * fx; A.wy = A.ey + D.armL * fy;
      var fl = Math.sqrt(fx * fx + fy * fy) || 1;
      A.dx = fx / fl; A.dy = fy / fl;                 // 前臂在屏幕上的方向（手顺着它长）
      A.hx = A.wx + A.dx * 1.0; A.hy = A.wy + A.dy * 1.0;     // 手心
    }
    S.ax = ax; S.ay = ay;
  };

  // ------------------------------------------------------------
  //  8. 画
  // ------------------------------------------------------------
  Rig.prototype.image = function (R) {
    var im = this.imgs[R];
    if (!im) {
      var c = getCanvas(R), data = new Uint8ClampedArray(c.w * c.h * 4);
      im = this.imgs[R] = { w: c.w, h: c.h, data: data, d32: new Uint32Array(data.buffer), scale: R, ox: c.ox, oy: c.oy, key: null, ver: 0,
                            box: [0, 0, 0, 0], top: 0, hand: [0, 0], hand2: [0, 0], arms: [0, 0], head: [0, 0], mouth: [0, 0], holds: true,
                            x0: 0, y0: 0, x1: -1, y1: -1 };
    }
    return im;
  };

  Rig.prototype.render = function (left, R) {
    R = clamp(Math.round(R || 1), 1, 4);
    left = !!left;
    if (this.want === null) { this.want = left; this.vis = left; }
    else if (left !== this.want) {
      this.want = left;
      if (Math.max(this.cur.q, this.turnQ) > 0.9) this.flip();         // 正对着的时候换边看不出来，直接换
    }
    var c = getCanvas(R), img = this.image(R);
    begin(c);
    this.solve();
    this.draw(c);
    finish(c, img, this.pal);
    this.anchors(img, c);
    img.ver++;
    return img;
  };
  // 换一边：脚踩的地方不变，所以相对身体的位置要反过来
  Rig.prototype.flip = function () {
    this.vis = !this.vis;
    for (var i = 0; i < 2; i++) { var f = this.feet[i]; f.x = -f.x; f.sx = -f.sx; f.tx = -f.tx; }
    this.tieX = -this.tieX; this.hairX = -this.hairX; this.hemX = -this.hemX; this.pvx = -this.pvx;
  };

  var ORDER = [0, 1, 2, 3, 4, 5], ZV = [0, 0, 0, 0, 0, 0];
  Rig.prototype.draw = function (c) {
    var S = this.S, R = c.R, i, j;
    // 远手、远腿、近腿、上身、头、近手：按前后排个序再画
    ZV[0] = S.q > 0.5 ? Math.max(this.zf, 0.5) : this.zf; ZV[1] = -2; ZV[2] = -1; ZV[3] = 0; ZV[4] = 1; ZV[5] = this.zn;
    for (i = 0; i < 6; i++) ORDER[i] = i;
    for (i = 1; i < 6; i++) { var o = ORDER[i]; for (j = i; j > 0 && ZV[ORDER[j - 1]] > ZV[o]; j--) ORDER[j] = ORDER[j - 1]; ORDER[j] = o; }
    this.dir = this.vis ? -1 : 1;
    for (i = 0; i < 6; i++) {
      co = i * 8 + 8;
      switch (ORDER[i]) {
        case 0: this.drawArm(c, 1); break;
        case 1: this.drawLeg(c, 1); break;
        case 2: this.drawLeg(c, 0); break;
        case 3: this.drawBody(c); break;
        case 4: this.drawHead(c); break;
        case 5: this.drawArm(c, 0); break;
      }
    }
  };
  // 世界单位 → 画布像素
  Rig.prototype.X = function (c, x) { return c.ox + this.dir * x * c.R; };
  Rig.prototype.Y = function (c, y) { return c.oy - y * c.R; };

  Rig.prototype.drawLeg = function (c, i) {
    var S = this.S, D = this.D, R = c.R, lg = S.leg[i], far = i === 1 && S.q < 0.5;
    cg = i ? G_LEGF : G_LEGN;
    var off = -lg.z * S.pb;                               // 两条腿左右错开一点
    function sx(v) { return Math.floor(v) + 0.5; }       // 对齐到像素中心：腿正好 5 格宽
    var hx = sx(this.X(c, S.hx * S.pa + off)), hy = Math.round(this.Y(c, S.hy));
    var kx = sx(this.X(c, lg.kx * S.pa + off)), ky = Math.round(this.Y(c, lg.ky));
    var ax = sx(this.X(c, lg.ax * S.pa + off)), ay = Math.round(this.Y(c, lg.ay));
    var r = D.rLeg;
    // 鞋（先画，裤脚盖在它上面）
    var w = S.wq;
    frame(ax, ay, lg.p * RAD * S.pa, R / 2, this.dir);
    var K = this.K, a, d, k;
    for (k = 0; k < K.shoeS.length; k++) {
      a = K.shoeS[k]; d = LET[a.ch];
      piece(a, K.shoeF[k], w, d[0], far ? Math.max(1, d[1] - 1) : d[1], 0);
    }
    cap(hx, hy, r[0] * R, kx, ky, r[1] * R, TROU, far, false);
    // 小腿多伸一点再平着切掉：裤脚盖住鞋口
    var dx = ax - kx, dy = ay - ky, l = Math.sqrt(dx * dx + dy * dy) || 1, ex = 0.45 * R;
    cap(kx, ky, r[1] * R, ax + dx / l * ex, ay + dy / l * ex, r[2] * R, TROU, far, true);
  };

  Rig.prototype.drawArm = function (c, i) {
    var S = this.S, D = this.D, R = c.R, A = S.arm[i], far = i === 1 && S.q < 0.5, r = D.rArm;
    cg = i ? G_ARMF : G_ARMN;
    var sx = Math.round(this.X(c, A.sx)), sy = Math.round(this.Y(c, A.sy));
    var ex = Math.round(this.X(c, A.ex)), ey = Math.round(this.Y(c, A.ey));
    var wx = Math.round(this.X(c, A.wx)), wy = Math.round(this.Y(c, A.wy));
    var dx = this.dir * A.dx, dy = -A.dy;                 // 画布上前臂的方向
    // 出手那一下的残影：从刚才手臂在的地方到现在，扫出一片亮的
    if (i === 0 && this.smear) this.drawSmear(c, sx, sy);
    cap(sx, sy, r[0] * R, ex, ey, r[1] * R, SUIT, far, false);
    cap(ex, ey, r[1] * R, wx, wy, r[2] * R, SUIT, far, true);
    // 袖口露出的一圈衬衫
    cap(wx, wy, r[2] * R * 0.96, wx + dx * 0.5 * R, wy + dy * 0.5 * R, r[2] * R * 0.96, SHIRT, far, true, 0.6);
    if (i === 0 && this.watch > 0.5) { var k2 = clipM; box(Math.round(wx - dx * R * 0.9 - 0.5 * R), Math.round(wy - dy * R * 0.9 - R * 0.5), Math.round(wx - dx * R * 0.9 + 0.5 * R), Math.round(wy - dy * R * 0.9 + 0.5 * R), FEAT, F_SPARK); clipM = k2; }
    // 手：手掌 + 大拇指
    var shp = i ? this.fh : this.nh, len = 1.3, rad = 1.0, fl = 0.5, th = 0.9;
    if (shp === 'fist' || shp === 'grip') { len = 0.9; rad = 1.05; th = 0.5; }
    else if (shp === 'open') { len = 1.7; rad = 1.1; th = 1.2; }
    else if (shp === 'flat') { len = 1.9; rad = 0.72; th = 0; }
    var bx = wx + dx * 0.5 * R, by = wy + dy * 0.5 * R;
    cap(bx, by, rad * R, bx + dx * len * R, by + dy * len * R, rad * R * 0.92, SKIN, far, false, fl);
    if (th > 0) {
      // 大拇指长在"朝前"的那一侧
      var px = -dy, py = dx, sg = (px * this.dir > 0 || (px === 0 && py < 0)) ? 1 : -1;
      if (shp === 'open') sg = -sg * (i ? -1 : 1) * (S.q > 0.5 ? 1 : -1);
      var tx = bx + dx * 0.55 * R + px * sg * rad * 0.7 * R, ty = by + dy * 0.55 * R + py * sg * rad * 0.7 * R;
      cap(tx, ty, 0.52 * R, tx + (px * sg * 0.6 + dx * 0.5) * th * R * 0.7, ty + (py * sg * 0.6 + dy * 0.5) * th * R * 0.7, 0.45 * R, SKIN, far, false, fl);
    }
  };
  // 残影：以肩为圆心的一段扇形，用西装最亮的两个色调
  Rig.prototype.drawSmear = function (c, sx, sy) {
    var D = this.D, R = c.R, C = this.cur, a0 = this.sa2, a1 = C.na2, n = 9, i;
    var r0 = (D.armU + D.armL) * 0.52 * R, r1 = (D.armU + D.armL + 1.8) * R;
    // 从旧角度绕过头顶甩到新角度（a0 是负的大角度，等价于 a0 + 360）
    var from = a0 < -60 ? a0 + 360 : a0, to = a1;
    vn = 0;
    for (i = 0; i <= n; i++) { var a = lerp(from, to, i / n) * RAD; VX[vn] = sx + this.dir * Math.sin(a) * r1; VY[vn] = sy + Math.cos(a) * r1; vn++; }
    for (i = n; i >= 0; i--) { var b = lerp(from, to, i / n) * RAD, rr = lerp(r1, r0, 1 - Math.pow(i / n, 2) * 0.55); VX[vn] = sx + this.dir * Math.sin(b) * rr; VY[vn] = sy + Math.cos(b) * rr; vn++; }
    poly(SUIT, 4, 0);
  };

  Rig.prototype.drawBody = function (c) {
    var S = this.S, D = this.D, R = c.R, K = this.K, k = R / 2, w = S.wq, i;
    cg = G_TORSO;
    var px = Math.round(this.X(c, S.hx * S.pa)), py = Math.round(this.Y(c, S.hy));
    // 衣摆往后飘：最下面几行各自挪一点
    var hem = Math.round(clamp(this.hemX, -2.4, 2.4));
    frame(px, py, S.lo, k, this.dir);
    var wy = D.waist * 2;
    at(0, wy);
    frame2(wy, LOCX, Math.round(LOCY - this.breath * R * 0.5 + 0.001), S.up);
    shOn = hem !== 0;
    if (shOn) { var n = K.bodyS[0].n; for (i = 0; i < 64; i++) { SHX[i] = 0; SHY[i] = 0; } SHX[n - 1] = hem; SHX[n - 2] = hem; SHX[n - 3] = hem * 0.5; SHX[n - 4] = hem * 0.5; }
    var a = K.bodyS[0], d = LET[a.ch];
    piece(a, K.bodyF[0], w, d[0], d[1], d[2]);
    shOn = false;
    for (i = 1; i < K.bodyS.length; i++) { a = K.bodyS[i]; d = LET[a.ch]; piece(a, K.bodyF[i], w, d[0], d[1], d[2]); }
    // 领带：从领带结垂下来，一格一格跟着晃
    var T = D.tie, tx = lerp(T.at[0][0], T.at[1][0], w), ty = lerp(T.at[0][1], T.at[1][1], w) + (this.tieUp ? 1 : 0);
    var sway = clamp(this.tieX, -3.2, 4.5);
    for (i = 0; i < T.len; i++) {
      var u = (i + 1) / T.len, off = lerp(T.sway[0][i], T.sway[1][i], w) + sway * u * u;
      at(tx + off + 1, ty - i - 0.5);
      var cx = Math.round(LOCX - this.dir * 0 ), cy = Math.round(LOCY - 0.5 * k * 1);
      var x0 = Math.round(LOCX - k), y0 = Math.round(LOCY - k * 0.5), ww = Math.max(1, Math.round(2 * k)), hh = Math.max(1, Math.round(k + 0.01));
      if (i === T.len - 1) { x0 += this.dir > 0 ? 0 : 0; ww = Math.max(1, ww - Math.round(k)); if (this.dir < 0) x0 += Math.round(k); }
      box(x0, y0, x0 + ww, y0 + hh, TIE, 3);
      // 背光的那一侧暗一级
      if (ww > 1) box(x0 + ww - Math.max(1, Math.round(k)), y0, x0 + ww, y0 + hh, TIE, 2);
    }
  };

  Rig.prototype.drawHead = function (c) {
    var S = this.S, D = this.D, R = c.R, K = this.K, k = R / 2, w = S.wq, i, a, d;
    var hx = Math.round(this.X(c, S.nx)), hy = Math.round(this.Y(c, S.ny));
    var ang = -S.hp * RAD;                                // 抬头 = 往后仰
    ang = Math.round(ang / (4 * RAD)) * 4 * RAD;          // 一档一档地转，免得边缘一直抖
    S.hpx = hx; S.hpy = hy; S.hang = ang;
    frame(hx, hy, ang, k, this.dir);
    var hsx = Math.round(clamp(this.hairX, -1.6, 1.6)), hsy = Math.round(clamp(this.hairY, -1, 1.4));
    for (i = 0; i < K.headS.length; i++) {
      a = K.headS[i]; d = LET[a.ch];
      cg = d[0] === HAIR ? G_HAIR : G_HEAD;
      if (a.ch === 'q' && (hsx || hsy)) {
        // 额前那一撮：顶上挪得多、根上不动
        shOn = true;
        for (var r = 0; r < 8; r++) { SHX[r] = r < 1 ? hsx : hsx * 0.5; SHY[r] = r < 1 ? hsy : 0; }
        piece(a, K.headF[i], w, d[0], d[1], d[2]);
        shOn = false;
      } else piece(a, K.headF[i], w, d[0], d[1], d[2]);
    }
    // 高光：光一直从左上来，所以这两片不跟着人翻
    cg = G_HAIR; clipM = HAIR;
    FD = 1;
    for (i = 0; i < K.shineS.length; i++) { a = K.shineS[i]; d = LET[a.ch]; piece(a, K.shineF[i], w, d[0], d[1], d[2]); }
    FD = this.dir; clipM = 0;
    this.drawFace(c, hx, hy, ang);
  };

  // 五官：位置跟着头，但每一格都是横平竖直的小方块，永远不转
  var FCX = 0, FCY = 0, FCK = 1, FCD = 1;
  function fc(x, y, w, h, f, mir) {
    if (mir && FCD < 0) x = -(x + w);
    var x0 = FCX + Math.round(FCK * x), x1 = FCX + Math.round(FCK * (x + w)), y0 = FCY + Math.round(FCK * y), y1 = FCY + Math.round(FCK * (y + h));
    if (x1 <= x0) x1 = x0 + 1;
    if (y1 <= y0) y1 = y0 + 1;
    box(x0, y0, x1, y1, FEAT, f);
  }
  Rig.prototype.fpt = function (p, w, dx, dy, wid) {
    // 字符画里的格子 → 画布像素（wid：这个零件宽几格；人朝左时要从另一头算起）
    var lx = lerp(p[0][0], p[1][0], w) + dx, ly = lerp(p[0][1], p[1][1], w) + dy;
    if (this.dir < 0) lx += wid;
    at(lx, ly);
    FCX = Math.round(LOCX); FCY = Math.round(LOCY);
  };
  Rig.prototype.drawFace = function (c, hx, hy, ang) {
    var S = this.S, D = this.D, F = D.face, R = c.R, w = S.wq, wi = w >= 0.5 ? 1 : 0, i;
    cg = G_FEAT; clipM = SKIN; FCK = R / 2; FCD = this.dir;
    var gx = this.gx * (w > 0.5 ? this.dir : 1), gy = this.gy;
    // 腮红
    var bl = Math.round(this.bl);
    if (bl > 0) {
      this.fpt(F.blushN, w, 0, 0, 2); fc(0, 0, 2, 1, bl > 1 ? F_BLUSH : F_BLUSH2, false);
      this.fpt(F.blushF, w, 0, 0, wi ? 2 : 1); fc(0, 0, wi ? 2 : 1, 1, bl > 1 ? F_BLUSH : F_BLUSH2, false);
      if (bl > 1) { this.fpt(F.blushN, w, 0, 0, 2); fc(-1, 0, 1, 1, F_BLUSH2, false); fc(2, 0, 1, 1, F_BLUSH2, false); }
    }
    // 鼻子：侧面时一点影子
    if (w < 0.5) { this.fpt(F.nose, w, 0, 0, 1); box(FCX, FCY, FCX + Math.max(1, Math.round(FCK)), FCY + Math.max(1, Math.round(FCK)), SKIN, 2); }
    // 眼睛
    var eo = this.eo * (this.blink > 0 ? (this.blink > 0.1 || this.blink < 0.03 ? 0.5 : 0) : 1);
    for (i = 0; i < 2; i++) {
      var ew = F.eyeW[wi][i], open = eo, arc = this.arc;
      if (this.wink > 0.5 && i === 0) { open = 0; arc = 1; }
      this.fpt(i ? F.eyeF : F.eyeN, w, gx, gy, ew);
      if (open < 0.25) {
        if (arc) { fc(0, 1, ew, 1, F_LID, false); fc(-1, 2, 1, 1, F_LID, false); fc(ew, 2, 1, 1, F_LID, false); }      // 弯弯的
        else fc(0, 2, ew, 1, F_LID, false);                                                                          // 闭着：一条线
      } else if (open < 0.65) {                 // 半闭
        fc(0, 1, ew, 1, F_LID, false); fc(0, 2, ew, 1, F_PUPIL, false);
      } else if (open < 0.9) {                  // 笑眯一点：下半截收上来
        fc(0, 0, ew, 1, F_LID, false); fc(0, 1, ew, 1, F_PUPIL, false); fc(0, 1, 1, 1, F_WHITE, false);
      } else if (open < 1.25) {                 // 睁着
        fc(0, 0, ew, 1, F_LID, false); fc(0, 1, ew, 1, F_PUPIL, false); fc(0, 2, ew, 1, F_IRIS, false); fc(0, 1, 1, 1, F_WHITE, false);
      } else {                                  // 睁大
        fc(0, -1, ew, 1, F_LID, false); fc(0, 0, ew, 2, F_PUPIL, false); fc(0, 2, ew, 1, F_IRIS, false); fc(0, 0, 1, 1, F_WHITE, false);
      }
    }
    // 眉毛
    var by = Math.round(this.by), bt = Math.round(this.bt);
    for (i = 0; i < 2; i++) {
      var bw = F.browW[wi][i];
      this.fpt(i ? F.browF : F.browN, w, 0, by + (this.gy > 0 ? 1 : 0), bw);
      // 眉头 = 靠近鼻子的那一头
      var inner = (i === 0) === (FCD > 0) ? bw - 1 : 0;
      if (w >= 0.5) inner = i === 0 ? bw - 1 : 0;
      for (var b = 0; b < bw; b++) fc(b, b === inner ? -bt : 0, 1, 1, F_BROW, false);
    }
    // 嘴
    var M = MOUTHS[(this.mt < 0.5 && this.mouth !== this.mouthTo) ? 'tiny' : this.mouth] || MOUTHS.calm;
    this.fpt(F.mouth, w, 0, 0, 0);
    S.mx = FCX; S.my = FCY;
    for (i = 0; i < M.length; i++) fc(M[i][0], M[i][1] - 1, M[i][2], M[i][3], M[i][4], true);
    clipM = 0;
    // 汗、星星、眼泪（画在头的旁边，不描边）
    var ex = this.extra;
    if (ex && this.et > 0.06) {
      this.fpt(F.eyeF, w, 0, 0, 2);
      var d = FCD;
      if (ex === 'sweat') { var sy = Math.min(3, Math.floor(this.et * 5)); fc(d > 0 ? 4 : -5, -4 + sy, 1, 1, F_WATER2, false); fc(d > 0 ? 4 : -5, -3 + sy, 1, 2, F_WATER, false); fc(d > 0 ? 3 : -4, -2 + sy, 1, 1, F_WATER, false); }
      else if (ex === 'tear') { fc(d > 0 ? 2 : -1, 3, 1, 1, F_WATER2, false); }
      else if (ex === 'spark') {
        var s = (Math.floor(this.et * 8) % 4) < 2 ? 1 : 0;
        fc(d > 0 ? 5 : -6, -5, 1, 3, F_SPARK, false); fc(d > 0 ? 4 : -7, -4, 3, 1, F_SPARK, false); fc(d > 0 ? 5 : -6, -4, 1, 1, F_WHITE, false);
        if (s) { fc(d > 0 ? 7 : -8, -7, 1, 1, F_SPARK, false); }
      }
    }
  };

  // 引擎要用的几个点（世界单位；dx 已经按朝向翻好）
  Rig.prototype.anchors = function (img, c) {
    var S = this.S, R = c.R, d = this.dir, D = this.D;
    img.box[0] = img.x0; img.box[1] = img.y0; img.box[2] = img.x1; img.box[3] = img.y1;
    img.top = (c.oy - img.y0) / R;
    var hh = this.holdHand, A = S.arm[hh === 'F' ? 1 : 0], B = S.arm[hh === 'F' ? 0 : 1];
    img.hand[0] = d * A.hx; img.hand[1] = A.hy;
    img.hand2[0] = d * B.hx; img.hand2[1] = B.hy;
    img.holds = !!hh;
    img.arms[0] = d * (S.sx + 3.4); img.arms[1] = S.sy - 3.2;
    var F = D.face, w = S.wq;
    at(lerp(F.top[0][0], F.top[1][0], w), lerp(F.top[0][1], F.top[1][1], w));
    FD = this.dir;
    img.head[0] = (LOCX - c.ox) / R; img.head[1] = (c.oy - LOCY) / R;
    img.mouth[0] = (S.mx - c.ox) / R + d * 0.5; img.mouth[1] = (c.oy - S.my) / R;
    img.feet = img.feet || [[0, 0, 0], [0, 0, 0]];
    for (var i = 0; i < 2; i++) { img.feet[i][0] = d * S.leg[i].ax; img.feet[i][1] = S.leg[i].ay; img.feet[i][2] = this.feet[i].on ? 1 : 0; }
  };

  // ============================================================
  //  9. 对外
  // ============================================================
  G.PET_PERSON = {
    create: function (cfg, design) { return new Rig(cfg, design); },
    FRAMES: FRAMES,
    FACES: FACES,
    METRICS: { height: 35, half: 6.5, reach: 9.6, eye: [2.4, 28.5], chest: [1.4, 20.5], release: [9.4, 25.6] },
    DESIGN: DESIGN, POSES: POSES, FACE: FACE,
  };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
