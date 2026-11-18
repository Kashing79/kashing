// 两只狗的"骨架 + 渲染器"（第三版）
//
// 不是一帧一帧画死的图：每次都按当前的姿势，把骨架现算出来，再现画成像素。
// 所以怎么迈步、怎么喘气、怎么摇尾巴都是连续的，姿势之间也会平滑过渡。
//
// 用法：
//   var rig = PET_DOGS.create('gold' | 'dax', 毛色名);
//   rig.update(dt, { pose, speed, air, wag, pant, carry, look, happy, shake, bark,
//                    mood, lookAt, vx, vy, accel, landing, turn, sleepy, vz, crouch });
//   var img = rig.render(faceLeft, R);   // R = 一个世界单位画成几个像素（默认 1）
//
// 这个文件从上到下分成几块，想加东西先看这里：
//   1. 颜色        RAMP（色阶）、COATS（每种毛色用哪些色阶）
//   2. 画像素      cap / ell / pix 往草稿上画，finish 收尾（去杂点、接缝、描边）
//   3. 体型        BREED：两种狗的骨头长短、粗细、头上各个点的位置
//   4. 骨架        trunkPts / foreIK / hindIK：由"躯干摆在哪、脚踩在哪"算出每个关节
//   5. 姿势表      POSE_DEF：一个姿势名 → 躯干和四只脚的目标（只有这一处）
//   6. 心情表      MOODS：眼睛、眉毛、耳朵、尾巴怎么变（和姿势互不相干，可以叠在任何姿势上）
//   7. 步态表      GAIT：速度 → 步频、着地时间、抬脚高度……；FOOTFALL：四只脚落地的先后
//   8. Rig         update（每一步都调，很便宜）→ solve（算骨架）→ draw（画）→ render（收尾、给出锚点）
//
// 坐标：身体自己的坐标里 x 朝前、y 朝上，原点在身体中心正下方的地面上；单位是"世界单位"。
// 光永远从屏幕左上方来。狗转身时是把骨架左右翻过来重新打光，不是把画好的图翻过来。
(function (root) {
  'use strict';

  // ============================================================
  //  0. 常量和小工具
  // ============================================================
  var W = 80, H = 48;          // 每只狗自己那张小画布（世界单位）
  var OX = 40, GY = 42;        // 原点（身体中心正下方的地面）在画布里的位置
  var PI = Math.PI, TAU = PI * 2, D2R = PI / 180;
  var LX = -0.3808, LY = 0.8016, LZ = 0.4609;   // 光的方向（x 右、y 上、z 朝观众）

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { t = t < 0 ? 0 : (t > 1 ? 1 : t); return t * t * (3 - 2 * t); }
  function frac(v) { return v - Math.floor(v); }
  function approach(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
  // 在一圈（周期 1）上从 a 走到 b，走近的那一边
  function arcLerp(a, b, t) { var d = b - a; d -= Math.round(d); return frac(a + d * t); }

  // ============================================================
  //  1. 颜色
  //  每种材质一条 6 级的色阶：0 描边 · 1 最暗 · 2 暗部 · 3 本色 · 4 亮部 · 5 高光
  //  暗的一头往紫红偏，亮的一头往黄偏（不是同一个颜色加黑加白）
  // ============================================================
  var RAMP = {
    gold:    ['#4a221e', '#854728', '#b87133', '#e6a94e', '#fad378', '#ffeea8'],   // 金毛
    cream:   ['#61342b', '#ad7753', '#d6a774', '#f2d29b', '#ffefc2', '#fffae0'],   // 金毛的浅色饰毛
    red:     ['#3d181c', '#66261d', '#8f3f22', '#b86230', '#d98c4e', '#f2be7e'],   // 红棕腊肠
    tan:     ['#52221f', '#7a3925', '#a86239', '#d18e54', '#edbc7b', '#fce2ac'],   // 腊肠的浅棕（嘴边、胸口、爪子）
    black:   ['#17111a', '#211a26', '#2d2536', '#3c3547', '#535066', '#75778f'],   // 黑棕腊肠的黑
    dcream:  ['#5c342e', '#945e47', '#c29269', '#ebcc96', '#fae9bb', '#fffae0'],   // 奶油腊肠
    nose:    ['#150f17', '#291f29', '#291f29', '#291f29', '#49404c', '#736c7a'],
    tongue:  ['#7a3351', '#b25074', '#b25074', '#f28399', '#f28399', '#ffb2b9'],
    collarR: ['#572133', '#992e40', '#992e40', '#d64945', '#d64945', '#f5806e'],
    collarB: ['#29224c', '#3a4d99', '#3a4d99', '#4981d6', '#4981d6', '#7ac0f5'],
    tag:     ['#804219', '#eb972a', '#eb972a', '#ffd342', '#ffd342', '#fff08c'],
    eye:     ['#150f17', '#150f17', '#3d2318', '#664227', '#b8cbe0', '#ffffff'],   // 1 瞳孔 · 2/3 棕色 · 5 眼神光
  };
  // 材质编号（草稿上每个像素记一个）
  var M_COAT = 1, M_COATF = 2, M_CREAM = 3, M_CREAMF = 4, M_EAR = 5, M_MUZ = 6, M_NOSE = 7, M_TONGUE = 8,
      M_MOUTH = 9, M_COLLAR = 10, M_TAG = 11, M_EYE = 12, M_PAW = 13, M_PAWF = 14, M_TAN = 15, M_N = 16;

  // 每种毛色：各个部位用哪条色阶、往暗里挪几级。far（远侧的腿）= 同一条色阶整体暗一级
  //   gloss 短毛的反光 · bias 整体压暗（黑狗） · rim 暗色的毛在上缘留一道亮边（深色壁纸上才看得见轮廓）
  var COATS = {
    gold:         { coat: 'gold',   cream: 'cream',  ear: ['gold', -1],   muz: 'cream',  paw: 'cream',  tan: 'cream', collar: 'collarR', gloss: 0, bias: 0, rim: 0, points: 0 },
    dax_red:      { coat: 'red',    cream: 'tan',    ear: ['red', -1],    muz: 'tan',    paw: 'tan',    tan: 'tan',   collar: 'collarB', gloss: 1, bias: 0, rim: 0, points: 0 },
    dax_blacktan: { coat: 'black',  cream: 'tan',    ear: ['black', 0],   muz: 'tan',    paw: 'tan',    tan: 'tan',   collar: 'collarR', gloss: 1, bias: -0.22, rim: 1, points: 1 },
    dax_cream:    { coat: 'dcream', cream: 'dcream', ear: ['dcream', -1], muz: 'dcream', paw: 'dcream', tan: 'dcream', collar: 'collarB', gloss: 1, bias: 0, rim: 0, points: 0 },
  };

  var LE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;   // 这台机器是不是低位在前
  function pack(hex) {
    var h = hex.replace('#', ''), r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
    return LE ? ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0 : ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0;
  }
  // 调色盘：pal[材质 * 8 + 明暗级别]
  function buildPal(C) {
    var pal = new Uint32Array(M_N * 8);
    function set(m, name, shift) {
      var r = RAMP[name];
      pal[m * 8] = pack(r[0]);
      for (var t = 1; t <= 5; t++) pal[m * 8 + t] = pack(r[clamp(t + (shift || 0), 1, 5)]);
    }
    set(M_COAT, C.coat, 0); set(M_COATF, C.coat, -1);
    set(M_CREAM, C.cream, 0); set(M_CREAMF, C.cream, -1);
    set(M_EAR, C.ear[0], C.ear[1]);
    set(M_MUZ, C.muz, 0); set(M_PAW, C.paw, 0); set(M_PAWF, C.paw, -1); set(M_TAN, C.tan, 0);
    set(M_NOSE, 'nose', 0); set(M_TONGUE, 'tongue', 0); set(M_COLLAR, C.collar, 0); set(M_TAG, 'tag', 0); set(M_EYE, 'eye', 0);
    // 嘴里：一整块暗红；它的描边跟着毛色走
    for (var t = 1; t <= 5; t++) pal[M_MOUTH * 8 + t] = pack(RAMP.tongue[0]);
    pal[M_MOUTH * 8] = pack(RAMP[C.muz][0]);
    return pal;
  }

  // ============================================================
  //  2. 画像素
  //  先往"草稿"上画：每个像素记下 属于哪个部位 P、什么材质 M、明暗级别 T、远近 Z、标记 F。
  //  全部画完以后 finish() 再统一：去杂点 → 部位之间的接缝 → 描边 → 填成真正的颜色。
  // ============================================================
  var SCR = {};                 // 每种分辨率一套草稿，所有狗共用
  var bw = 0, bh = 0, bP, bM, bT, bF, bZ;
  var RR = 1;                   // 现在是按几倍画的
  var X0 = OX, Y0 = GY;         // 原点（世界单位；X0 里带着"不到一个像素的零头"）
  var TS = 0, TO = 0, TC = 1;   // 横向的变换：屏幕 x = TO + (x − TS) × TC。TC = −1 就是脸朝左
  var bx0, by0, bx1, by1;       // 这一帧画过的范围
  var sZ = 0, sZb = 0, sMat = 1, sPart = 1, sFlat = 0, sBias = 0, sFlag = 0, sOver = 0;   // 现在的"画笔"
  var MINR = 0.71;              // 再细就会断成一粒一粒的
  var F_LOCK = 1, F_SOFT = 2, F_CORE = 4, F_TUFT = 8, F_TOP = 16;

  function useScratch(R) {
    var s = SCR[R];
    if (!s) {
      var n = W * R * H * R;
      s = SCR[R] = { P: new Uint8Array(n), M: new Uint8Array(n), T: new Uint8Array(n), F: new Uint8Array(n), Z: new Float32Array(n) };
    }
    RR = R; bw = W * R; bh = H * R; bP = s.P; bM = s.M; bT = s.T; bF = s.F; bZ = s.Z;
    bP.fill(0);
    bx0 = bw; by0 = bh; bx1 = -1; by1 = -1;
  }
  // 换画笔：z 远近（大的在前）、zb 鼓起来多少、材质、部位、flat 压扁程度（0 圆鼓鼓 … 1 一片平）、bias 整体调亮调暗
  function brush(z, zb, mat, part, flat, bias) { sZ = z; sZb = zb; sMat = mat; sPart = part; sFlat = flat; sBias = bias || 0; sFlag = 0; sOver = 0; }

  // 一头粗一头细的"胶囊"
  function cap(x0, y0, r0, x1, y1, r1) {
    var ax = (TO + (x0 - TS) * TC + X0) * RR, ay = (Y0 - y0) * RR, bx = (TO + (x1 - TS) * TC + X0) * RR, by = (Y0 - y1) * RR;
    var ra = r0 * RR, rb = r1 * RR;
    if (ra < MINR) ra = MINR;
    if (rb < MINR) rb = MINR;
    var rm = ra > rb ? ra : rb;
    var i0 = Math.floor((ax < bx ? ax : bx) - rm), i1 = Math.ceil((ax > bx ? ax : bx) + rm);
    var j0 = Math.floor((ay < by ? ay : by) - rm), j1 = Math.ceil((ay > by ? ay : by) + rm);
    if (i0 < 1) i0 = 1; if (j0 < 1) j0 = 1; if (i1 > bw - 2) i1 = bw - 2; if (j1 > bh - 2) j1 = bh - 2;
    if (i0 > i1 || j0 > j1) return;
    if (i0 < bx0) bx0 = i0; if (i1 > bx1) bx1 = i1; if (j0 < by0) by0 = j0; if (j1 > by1) by1 = j1;
    var dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, inv = L2 > 1e-9 ? 1 / L2 : 0, dr = rb - ra;
    var f1 = 1 - sFlat, i, j;
    for (j = j0; j <= j1; j++) {
      var py = j + 0.5 - ay, row = j * bw;
      for (i = i0; i <= i1; i++) {
        var px = i + 0.5 - ax;
        var t = (px * dx + py * dy) * inv;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        var ex = px - dx * t, ey = py - dy * t, r = ra + dr * t, q = (ex * ex + ey * ey) / (r * r);
        if (q > 1) continue;
        var idx = row + i, nz = Math.sqrt(1 - q), zz = sZ + nz * sZb;
        if (bP[idx] !== 0) { if (bZ[idx] >= zz) continue; } else if (sOver) continue;
        if (sOver && bP[idx] !== sOver) continue;
        var nf = nz * f1 + sFlat;
        var tone = ((ex * LX - ey * LY) / r + nf * LZ) / Math.sqrt(q + nf * nf) + sBias;
        bT[idx] = tone > 0.62 ? (tone > 0.92 ? 5 : 4) : (tone > 0.18 ? 3 : (tone > -0.28 ? 2 : 1));
        bP[idx] = sPart; bM[idx] = sMat; bZ[idx] = zz; bF[idx] = sFlag;
      }
    }
  }
  // 椭圆（可以转一个角度）
  function ell(cx, cy, rx, ry, rot) {
    var px0 = (TO + (cx - TS) * TC + X0) * RR, py0 = (Y0 - cy) * RR;
    var cs = Math.cos(rot) * TC, sn = Math.sin(rot);
    if (TC !== 1 && TC !== -1) { var nn = Math.sqrt(cs * cs + sn * sn) || 1; cs /= nn; sn /= nn; }
    var ra = rx * RR, rb = ry * RR;
    if (ra < MINR) ra = MINR;
    if (rb < MINR) rb = MINR;
    var rm = ra > rb ? ra : rb;
    var i0 = Math.floor(px0 - rm), i1 = Math.ceil(px0 + rm), j0 = Math.floor(py0 - rm), j1 = Math.ceil(py0 + rm);
    if (i0 < 1) i0 = 1; if (j0 < 1) j0 = 1; if (i1 > bw - 2) i1 = bw - 2; if (j1 > bh - 2) j1 = bh - 2;
    if (i0 > i1 || j0 > j1) return;
    if (i0 < bx0) bx0 = i0; if (i1 > bx1) bx1 = i1; if (j0 < by0) by0 = j0; if (j1 > by1) by1 = j1;
    var ia = 1 / ra, ib = 1 / rb, f1 = 1 - sFlat, i, j;
    for (j = j0; j <= j1; j++) {
      var py = py0 - (j + 0.5), row = j * bw;         // 朝上为正
      for (i = i0; i <= i1; i++) {
        var px = i + 0.5 - px0;
        var u = (px * cs + py * sn) * ia, v = (py * cs - px * sn) * ib, q = u * u + v * v;
        if (q > 1) continue;
        var idx = row + i, nz = Math.sqrt(1 - q), zz = sZ + nz * sZb;
        if (bP[idx] !== 0) { if (bZ[idx] >= zz) continue; } else if (sOver) continue;
        if (sOver && bP[idx] !== sOver) continue;
        var nf = nz * f1 + sFlat;
        var tone = ((u * cs - v * sn) * LX + (u * sn + v * cs) * LY + nf * LZ) / Math.sqrt(q + nf * nf) + sBias;
        bT[idx] = tone > 0.62 ? (tone > 0.92 ? 5 : 4) : (tone > 0.18 ? 3 : (tone > -0.28 ? 2 : 1));
        bP[idx] = sPart; bM[idx] = sMat; bZ[idx] = zz; bF[idx] = sFlag;
      }
    }
  }
  // 世界坐标 → 像素格子
  function PI_(x) { return Math.floor((TO + (x - TS) * TC + X0) * RR); }
  function PJ_(y) { return Math.floor((Y0 - y) * RR); }
  // 点一个像素（只盖在已经画了东西的地方；点上去的不再参加去杂点和接缝）
  function pix(i, j, mat, tone) {
    if (i < 1 || j < 1 || i >= bw - 1 || j >= bh - 1) return;
    var idx = j * bw + i;
    if (!bP[idx]) return;
    bM[idx] = mat; bT[idx] = tone; bF[idx] |= F_LOCK;
  }
  // 一像素宽的线（两头是世界坐标）
  function seg(x0, y0, x1, y1, mat, tone) {
    var i0 = PI_(x0), j0 = PJ_(y0), i1 = PI_(x1), j1 = PJ_(y1);
    var dx = Math.abs(i1 - i0), dy = Math.abs(j1 - j0), sx = i0 < i1 ? 1 : -1, sy = j0 < j1 ? 1 : -1, err = dx - dy;
    for (var n = 0; n < 200; n++) {
      pix(i0, j0, mat, tone);
      if (i0 === i1 && j0 === j1) break;
      var e2 = err * 2;
      if (e2 > -dy) { err -= dy; i0 += sx; }
      if (e2 < dx) { err += dx; j0 += sy; }
    }
  }

  // 部位编号。GRP = 哪些部位算"一整块"（之间不画接缝）；SEAM = 被别的部位压住时，交界处怎么处理
  //   0 不管 · 1 在背光的那一侧暗一级（近处的腿压在身上、头压在脖子上） · 2 一道最暗的线（远侧的腿、尾巴根）
  var P_TRUNK = 1, P_FHIND = 2, P_FFORE = 3, P_TAIL = 4, P_NHIND = 5, P_NFORE = 6, P_HEAD = 7, P_JAW = 8,
      P_TONGUE = 9, P_EAR = 10, P_NOSE = 11, P_COLLAR = 12, P_FUR = 13, P_MOUTH = 14, P_FEAR = 15, P_BELLY = 16;
  var GRP = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 7, 12, 1, 14, 15, 1]);
  var SEAM = new Uint8Array([0, 1, 2, 2, 2, 1, 1, 1, 1, 0, 1, 0, 1, 1, 0, 2, 1]);

  // 收尾：把草稿变成真正的图
  //   d32   这只狗自己的输出（Uint32Array，一格一个像素）
  //   pal   调色盘
  //   C     毛色（反光、亮边要用）
  //   box   量出来的包围盒 [x0, y0, x1, y1]
  function finish(d32, pal, C, box) {
    var x0 = bx0, y0 = by0, x1 = bx1, y1 = by1, i, j, idx, pass;
    if (x1 < x0) { box[0] = box[1] = 0; box[2] = box[3] = -1; return; }

    // (1) 去杂点：明暗级别和四邻（同一个部位里的）都不一样的孤点，跟着邻居走。两遍。
    for (pass = 0; pass < 2; pass++) {
      for (j = y0; j <= y1; j++) {
        idx = j * bw + x0;
        for (i = x0; i <= x1; i++, idx++) {
          var p = bP[idx];
          if (!p || (bF[idx] & F_LOCK)) continue;
          var t = bT[idx];
          var a = bP[idx - 1] === p ? bT[idx - 1] : 0, b = bP[idx + 1] === p ? bT[idx + 1] : 0;
          var c = bP[idx - bw] === p ? bT[idx - bw] : 0, d = bP[idx + bw] === p ? bT[idx + bw] : 0;
          if (a === t || b === t || c === t || d === t) continue;
          var n = (a && (a === b || a === c || a === d)) ? a : ((b && (b === c || b === d)) ? b : ((c && c === d) ? c : (a || b || c || d)));
          if (n) bT[idx] = n;
        }
      }
    }

    // (2) 接缝：两个部位挨着的地方，在"被压住的那个"上做记号
    for (j = y0; j <= y1; j++) {
      idx = j * bw + x0;
      for (i = x0; i <= x1; i++, idx++) {
        var p1 = bP[idx];
        if (!p1) continue;
        var g1 = GRP[p1], q1, k;
        q1 = bP[idx + 1];
        if (q1 && GRP[q1] !== g1) {
          if (bZ[idx] > bZ[idx + 1]) { k = SEAM[q1]; if (k && !(bF[idx + 1] & F_LOCK)) bF[idx + 1] |= k === 2 ? F_CORE : F_SOFT; }   // 被压的在右边：背光侧
          else { k = SEAM[p1]; if (k === 2 && !(bF[idx] & F_LOCK)) bF[idx] |= F_CORE; }
        }
        q1 = bP[idx + bw];
        if (q1 && GRP[q1] !== g1) {
          if (bZ[idx] > bZ[idx + bw]) { k = SEAM[q1]; if (k && !(bF[idx + bw] & F_LOCK)) bF[idx + bw] |= k === 2 ? F_CORE : F_SOFT; }   // 被压的在下面：背光侧
          else { k = SEAM[p1]; if (k === 2 && !(bF[idx] & F_LOCK)) bF[idx] |= F_CORE; }
        }
      }
    }

    // (3) 填颜色 + 最外面描一圈边（四邻里有实心的空格子 → 用最靠前那个邻居的"描边色"）
    var gloss = C.gloss, rim = C.rim;
    var tx0 = bw, ty0 = bh, tx1 = -1, ty1 = -1;
    var X0c = x0 - 1, X1c = x1 + 1, Y0c = y0 - 1, Y1c = y1 + 1;
    for (j = Y0c; j <= Y1c; j++) {
      idx = j * bw + X0c;
      for (i = X0c; i <= X1c; i++, idx++) {
        var pp = bP[idx];
        if (pp) {
          var tt = bT[idx], f = bF[idx];
          if (f & F_CORE) tt = 1;
          else if ((f & F_SOFT) && tt > 1) tt--;
          else if (!(f & F_LOCK) && !bP[idx - bw]) {
            // 上缘的那一行：短毛的反光（只在标了 F_TOP 的地方）；深色的毛留一道亮边
            if (gloss && (f & F_TOP) && tt >= 3) tt = 5;
            else if (rim && tt < 4 && bM[idx] === M_COAT) tt = 4;
          }
          d32[idx] = pal[bM[idx] * 8 + tt];
        } else {
          var best = -1e9, m = 0;
          if (bP[idx - 1] && bZ[idx - 1] > best) { best = bZ[idx - 1]; m = bM[idx - 1]; }
          if (bP[idx + 1] && bZ[idx + 1] > best) { best = bZ[idx + 1]; m = bM[idx + 1]; }
          if (j > 0 && bP[idx - bw] && bZ[idx - bw] > best) { best = bZ[idx - bw]; m = bM[idx - bw]; }
          if (j < bh - 1 && bP[idx + bw] && bZ[idx + bw] > best) { best = bZ[idx + bw]; m = bM[idx + bw]; }
          if (!m) continue;
          d32[idx] = pal[m * 8];
        }
        if (i < tx0) tx0 = i; if (i > tx1) tx1 = i; if (j < ty0) ty0 = j; if (j > ty1) ty1 = j;
      }
    }
    box[0] = tx0; box[1] = ty0; box[2] = tx1; box[3] = ty1;
  }

  // ============================================================
  //  3. 体型（世界单位；角度是"度"，用的时候再换算）
  //  数字来自两个品种的标准比例：金毛近似方形、胸深到肘、背线平；腊肠身长是肩高的 1.75 倍、
  //  胸骨往前突、离地只有肩高的三分之一。
  // ============================================================
  var BREED = {
    gold: {
      a: 4.2, b: 6.6,                       // 脊柱两段：骨盆—腰、腰—胸
      T0: [4.0, 14.3],                      // 站着时胸腔中心
      rib: [6.4, 5.3], pel: [4.3, 4.1], pelUp: 0.3,
      loin: [0.8, 0.5, 3.7, -2.0, 0.1, 4.7],        // 腰：骨盆这头 (x, y, 半径)，胸腔那头 (x, y, 半径)
      wither: [2.0, 4.0, 2.6, 1.9],                 // 肩隆：位置和大小
      chest: [5.2, -1.0, 1.8, 2.8],                 // 前胸
      S0: [2.3, 3.9], N0: [3.6, 3.3],               // 胸腔上的点：肩胛骨顶端、脖子根
      HJ: [-0.8, -0.1], tailSet: [-3.4, 3.1],       // 骨盆上的点：髋关节、尾巴根
      ls: 5.16, lh: 5.80, lr: 5.81, lmc: 2.73, dF: -26.2,   // 前腿：肩胛骨、上臂、小臂、掌骨；肩胛骨和小臂"联动"的夹角
      lf: 6.28, lt: 6.72, lm: 2.93, dH: -14.6,              // 后腿：大腿、小腿、跖骨；大腿和跖骨"联动"的夹角
      padY: 0.6, fpad: 6.4, hpad: -9.4,             // 站着时脚掌关节的高度、前后脚的位置
      farX: 1.2, farY: 0.4,                         // 远侧的腿：前腿再往前、后腿再往后这么多，整体抬高一点
      shoulder: [3.6, 2.6], armR: [2.2, 1.35], foreR: [1.3, 1.05], pastR: 1.0, fpaw: [1.6, 1.0],
      thigh: [4.0, 2.9], gaskR: [1.55, 0.95], metaR: 0.9, hock: 0.5, hpaw: [1.5, 0.95],
      neck: 5.4, neckR0: 4.2, neckR1: 3.3, neckA: 47, headA: -12,
      HL: 11.6,                                     // 头长：后脑勺到鼻尖
      skull: [0.27, 0.0, 0.30, 0.265],              // 头骨：中心 (u, v)、两个半轴（都是头长的几分之几）
      muz: [0.50, -0.105, 0.130, 0.905, -0.090, 0.098],   // 上吻：起点 (u, v, 半径) → 终点 (u, v, 半径)
      jaw: [0.42, -0.19, 0.085, 0.85, -0.195, 0.062], hinge: [0.26, -0.135],
      nose: [0.975, -0.045, 0.066], eye: [0.53, 0.085], lip: -0.215,
      earAt: [0.25, 0.135], earL: 0.40, earR: [0.13, 0.085], earRest: -78,
      ball: [1.02, -0.36],
      tailL: 12.4, tailN: 7, tailR: [1.3, 0.55], tailA: -28, tailCurl: 0.3,
      reachF: 17.0, reachH: 16.2,                   // 一步里脚能扫过的最大距离（量出来的）
      accel: 340, seat: [-0.5, 19.4],
    },
    dax: {
      a: 4.0, b: 6.2,
      T0: [3.6, 7.2],
      rib: [5.2, 3.5], pel: [3.1, 2.8], pelUp: 0.4,
      loin: [0.5, 0.45, 2.75, -2.0, 0.15, 3.3],
      wither: [1.9, 2.75, 2.1, 1.15],
      chest: [4.7, 0.15, 1.55, 1.95],
      S0: [2.0, 2.7], N0: [3.2, 2.1],
      HJ: [-0.4, -0.3], tailSet: [-2.4, 2.4],
      ls: 3.61, lh: 3.75, lr: 3.14, lmc: 1.09, dF: -30.7,
      lf: 3.30, lt: 3.39, lm: 2.01, dH: -29.4,
      padY: 0.5, fpad: 6.1, hpad: -7.8,
      farX: 0.9, farY: 0.4,
      shoulder: [2.5, 1.9], armR: [1.6, 1.1], foreR: [1.05, 0.95], pastR: 0.9, fpaw: [1.45, 0.85],
      thigh: [2.6, 1.9], gaskR: [1.1, 0.85], metaR: 0.8, hock: 0.35, hpaw: [1.25, 0.8],
      neck: 4.6, neckR0: 2.9, neckR1: 2.2, neckA: 55, headA: -10,
      HL: 10.4,
      skull: [0.25, 0.0, 0.27, 0.205],
      muz: [0.44, -0.045, 0.105, 0.925, -0.078, 0.058],
      jaw: [0.40, -0.125, 0.06, 0.87, -0.15, 0.042], hinge: [0.22, -0.12],
      nose: [0.985, -0.075, 0.058], eye: [0.47, 0.05], lip: -0.135,
      earAt: [0.195, 0.14], earL: 0.52, earR: [0.095, 0.14], earRest: -80,
      ball: [1.02, -0.40],
      tailL: 10.5, tailN: 6, tailR: [0.85, 0.4], tailA: -8, tailCurl: 0.5,
      reachF: 12.3, reachH: 11.0,
      accel: 760, seat: [-0.5, 10.7],
    },
  };
  // 把角度换成弧度，算出几样常用的量
  (function () {
    for (var k in BREED) {
      var B = BREED[k];
      B.kind = k;
      B.dF *= D2R; B.dH *= D2R; B.neckA *= D2R; B.headA *= D2R; B.earRest *= D2R; B.tailA *= D2R;
      B.L = B.a + B.b;
    }
  })();

  // ============================================================
  //  4. 骨架
  // ============================================================
  // 躯干：胸腔中心 (tx, ty)、胸段和腰段的俯仰 thT / thP（弧度，头高为正）、len 拉长缩短、c 翻身（1 正着 … −1 肚皮朝天）
  function trunkPts(J, B, tx, ty, thT, thP, len, c) {
    var cT = Math.cos(thT), sT = Math.sin(thT), cP = Math.cos(thP), sP = Math.sin(thP);
    J.Tx = tx; J.Ty = ty; J.cT = cT; J.sT = sT; J.cP = cP; J.sP = sP; J.c = c; J.thT = thT; J.thP = thP;
    J.Lx = tx - B.b * len * cT; J.Ly = ty - B.b * len * sT;
    J.Px = J.Lx - B.a * len * cP; J.Py = J.Ly - B.a * len * sP;
    J.S0x = tx + B.S0[0] * cT - B.S0[1] * c * sT; J.S0y = ty + B.S0[0] * sT + B.S0[1] * c * cT;
    J.N0x = tx + B.N0[0] * cT - B.N0[1] * c * sT; J.N0y = ty + B.N0[0] * sT + B.N0[1] * c * cT;
    J.HJx = J.Px + B.HJ[0] * cP - B.HJ[1] * c * sP; J.HJy = J.Py + B.HJ[0] * sP + B.HJ[1] * c * cP;
    J.TSx = J.Px + B.tailSet[0] * cP - B.tailSet[1] * c * sP; J.TSy = J.Py + B.tailSet[0] * sP + B.tailSet[1] * c * cP;
  }

  // 两节骨头：从 (jx, jy) 去够 (fx, fy)，第一节长 A、第二节长 Bn。返回第一节的角度（关节往前鼓的那个解）。
  // 够不着的时候不会一下子绷直：超过 97% 以后越来越难伸，永远到不了 100%。
  var ikD = 0, ikBase = 0, ikReach = 0;
  function twoBone(jx, jy, fx, fy, A, Bn) {
    var dx = fx - jx, dy = fy - jy, d = Math.sqrt(dx * dx + dy * dy), mx = A + Bn, mn = Math.abs(A - Bn) + 0.02;
    var r = d / mx;
    ikReach = r;
    if (r > 0.97) { r = 0.97 + 0.025 * (1 - Math.exp(-(r - 0.97) / 0.025)); d = r * mx; }
    if (d < mn) d = mn;
    var ca = (A * A + d * d - Bn * Bn) / (2 * A * d);
    if (ca > 1) ca = 1; else if (ca < -1) ca = -1;
    ikD = d; ikBase = Math.atan2(dy, dx);
    return ikBase + Math.acos(ca);
  }
  // 前腿：肩胛骨顶端 (sx, sy) → 肩关节 → 肘 → 腕 → 脚掌 (fx, fy)。
  //   del 肩胛骨和小臂的夹角（"联动"：走路时两者几乎平行着摆）· kap 腕关节往后折多少 · up = −1 表示肚皮朝天
  // 结果写进 o[k..k+9]：肩关节、肘、腕、脚掌的 x y，再加掌骨的方向
  function foreIK(o, k, sx, sy, fx, fy, B, del, kap, up) {
    if (up < 0) fy = 2 * sy - fy;
    var qx = B.lr + B.lmc * Math.cos(kap), qy = -B.lmc * Math.sin(kap), lq = Math.sqrt(qx * qx + qy * qy), dq = del + Math.atan2(qy, qx);
    var vx = B.ls + lq * Math.cos(dq), vy = lq * Math.sin(dq), eps = Math.atan2(vy, vx);
    var u = twoBone(sx, sy, fx, fy, Math.sqrt(vx * vx + vy * vy), B.lh) - eps, a = u + del;
    var px = sx + ikD * Math.cos(ikBase), py = sy + ikD * Math.sin(ikBase);
    var ex = px - lq * Math.cos(u + dq), ey = py - lq * Math.sin(u + dq);
    o[k] = sx + B.ls * Math.cos(u); o[k + 1] = sy + B.ls * Math.sin(u);
    o[k + 2] = ex; o[k + 3] = ey;
    o[k + 4] = ex + B.lr * Math.cos(a); o[k + 5] = ey + B.lr * Math.sin(a);
    o[k + 6] = px; o[k + 7] = py;
    o[k + 8] = a - kap;
    if (up < 0) { o[k + 1] = 2 * sy - o[k + 1]; o[k + 3] = 2 * sy - o[k + 3]; o[k + 5] = 2 * sy - o[k + 5]; o[k + 7] = 2 * sy - o[k + 7]; o[k + 8] = -o[k + 8]; }
    o[k + 9] = ikReach;
  }
  // 后腿：髋 (hx, hy) → 膝 → 飞节 → 脚掌 (fx, fy)。del 大腿和跖骨的夹角
  // 结果写进 o[k..k+9]：膝、飞节的 x y，（空两格），脚掌的 x y，跖骨的方向
  function hindIK(o, k, hx, hy, fx, fy, B, del, up) {
    if (up < 0) fy = 2 * hy - fy;
    var vx = B.lf + B.lm * Math.cos(del), vy = B.lm * Math.sin(del), eps = Math.atan2(vy, vx);
    var u = twoBone(hx, hy, fx, fy, Math.sqrt(vx * vx + vy * vy), B.lt) - eps, a = u + del;
    var px = hx + ikD * Math.cos(ikBase), py = hy + ikD * Math.sin(ikBase);
    o[k] = hx + B.lf * Math.cos(u); o[k + 1] = hy + B.lf * Math.sin(u);
    o[k + 2] = px - B.lm * Math.cos(a); o[k + 3] = py - B.lm * Math.sin(a);
    o[k + 4] = o[k + 2]; o[k + 5] = o[k + 3];
    o[k + 6] = px; o[k + 7] = py;
    o[k + 8] = a;
    if (up < 0) { o[k + 1] = 2 * hy - o[k + 1]; o[k + 3] = 2 * hy - o[k + 3]; o[k + 5] = o[k + 3]; o[k + 7] = 2 * hy - o[k + 7]; o[k + 8] = -o[k + 8]; }
    o[k + 9] = ikReach;
  }

  // ============================================================
  //  5. 姿势表 —— 一个姿势名对应的"目标"只写在这里
  //  每个姿势只写和"站着"不一样的地方：
  //    at / x / y   躯干摆在哪。at 说 (x, y) 指的是哪个点：
  //                 'T' 胸腔中心（默认）· 'S' 肩胛骨顶端 · 'P' 骨盆 · 'H' 髋关节
  //    thT / thP    胸段、腰段抬起多少度（头高为正）
  //    roll         1 = 翻过来肚皮朝天
  //    len          身体拉长（>1）或缩短（<1）
  //    neck / head  脖子、头（后脑勺→鼻尖）的方向，度，相对水平线
  //    tail / curl  尾巴根翘起多少度、往上卷多少
  //    jaw / tongue 嘴张多大（0..1）、舌头伸多长
  //    ear          耳朵往后甩多少（弧度；负的 = 往前竖）
  //    fn ff hn hf  近侧前脚、远侧前脚、近侧后脚、远侧后脚：
  //                 [x, 离地高度, 夹角, 腕关节]      踩在地上的脚（身体晃的时候它不动）
  //                 { r: [dx, dy], d: 夹角, k: 腕关节 }  悬空的脚：相对肩胛骨顶端 / 髋关节（跟着身体走）
  //                 { a: [x, y],   d: 夹角, k: 腕关节 }  悬空的脚：直接写位置
  //                 夹角 = 肩胛骨和小臂（大腿和跖骨）之间差多少度；不写就是走路时的"联动"角度。
  //                 远侧的脚也按近侧的位置写，画的时候会自动往旁边错开。
  //  名字以 _ 开头的是内部用的（起跳、落地、急停……），不对外公开。
  //  加新姿势：在这里加一条，再把名字写进 POSES；如果它有自己的小动作，去 solve() 里的"小动作"那一段加。
  // ============================================================
  var POSE_DEF = {
    stand: {
      gold: { x: 4.0, y: 14.3, neck: 47, head: -12, tail: -28, curl: 0.3 },
      dax:  { x: 3.6, y: 7.2, neck: 55, head: -10, tail: -8, curl: 0.5 },
    },
    alert: {
      gold: { x: 4.6, y: 14.7, thT: 1.5, neck: 59, head: -4, tail: 14, curl: 0.35, ear: -0.3 },
      dax:  { x: 4.2, y: 7.45, thT: 1.5, neck: 67, head: -2, tail: 24, curl: 0.5, ear: -0.25 },
    },
    sit: {
      gold: { at: 'S', x: 2.5, y: 18.0, thT: 44, thP: 74, neck: 66, head: -8, tail: -6, curl: 0.05, fn: [3.0, 0], ff: [3.0, 0], hn: [2.0, 0], hf: [2.4, 0] },
      dax:  { at: 'S', x: 6.6, y: 9.9, thT: 14, thP: 40, neck: 70, head: -5, tail: -4, curl: 0.05, fn: [7.0, 0], ff: [7.0, 0], hn: [-0.6, 0], hf: [-0.2, 0] },
    },
    paw: {
      gold: { at: 'S', x: 2.5, y: 18.0, thT: 44, thP: 74, neck: 64, head: -4, tail: -6, curl: 0.05, fn: { a: [11.5, 11.2], d: 35, k: 55 }, ff: [3.0, 0], hn: [2.0, 0], hf: [2.4, 0] },
      dax:  { at: 'S', x: 6.6, y: 9.9, thT: 14, thP: 40, neck: 68, head: -2, tail: -4, curl: 0.05, fn: { a: [12.2, 5.6], d: 30, k: 45 }, ff: [7.0, 0], hn: [-0.6, 0], hf: [-0.2, 0] },
    },
    scratch: {
      gold: { at: 'S', x: 2.5, y: 17.2, thT: 40, thP: 78, neck: -20, head: -30, tail: -6, curl: 0, ear: 0.3, fn: [3.0, 0], ff: [3.0, 0], hn: { a: [8.0, 13.5] }, hf: [2.0, 0] },
      dax:  { at: 'S', x: 6.6, y: 9.7, thT: 12, thP: 46, neck: 40, head: -22, tail: -4, curl: 0, ear: 0.3, fn: [7.0, 0], ff: [7.0, 0], hn: { a: [3.2, 5.2] }, hf: [-0.4, 0] },
    },
    lie: {
      gold: { x: 4.0, y: 5.7, thT: 3, thP: 12, neck: 55, head: -8, tail: -5, curl: 0, fn: [13.2, 0.5, 60], ff: [12.6, 0.5, 60], hn: [-3.2, 0], hf: [-2.6, 0] },
      dax:  { x: 3.6, y: 3.85, thT: 2, thP: 8, neck: 60, head: -6, tail: -4, curl: 0.1, fn: [10.4, 0.35, 48], ff: [10.0, 0.35, 48], hn: [-3.4, 0], hf: [-3.0, 0] },
    },
    sleep: {
      gold: { x: 4.0, y: 5.6, thT: 2, thP: 12, neck: -37, head: -6, tail: -5, curl: 0, ear: 0.2, fn: [13.2, 0.5, 60], ff: [12.6, 0.5, 60], hn: [-3.2, 0], hf: [-2.6, 0] },
      dax:  { x: 3.6, y: 3.9, thT: 4, thP: 22, neck: -15, head: -8, tail: -4, curl: 0.1, ear: 0.2, fn: [10.4, 0.35, 48], ff: [10.0, 0.35, 48], hn: [-2.6, 0], hf: [-2.2, 0] },
    },
    bow: {
      gold: { at: 'P', x: -6.8, y: 14.5, thT: -45, thP: -40, neck: 20, head: 12, tail: 62, curl: 0.4, fn: [12.8, 0.5, 50], ff: [12.2, 0.5, 50] },
      dax:  { at: 'P', x: -6.6, y: 8.0, thT: -28, thP: -22, neck: 35, head: 15, tail: 52, curl: 0.5, fn: [10.4, 0.35, 30], ff: [10.0, 0.35, 30] },
    },
    dig: {
      gold: { x: 4.6, y: 10.2, thT: -20, thP: -10, neck: -30, head: -42, tail: 55, curl: 0.3, fn: [11.0, 0], ff: [11.0, 0] },
      dax:  { x: 3.9, y: 5.5, thT: -12, thP: -6, neck: -15, head: -28, tail: 45, curl: 0.4, fn: [7.8, 0], ff: [7.8, 0] },
    },
    beg: {
      gold: { at: 'H', x: -1.0, y: 3.9, thT: 58, thP: 80, neck: 75, head: 10, tail: -4, curl: 0, fn: { r: [8.3, -5.0], d: -20, k: 70 }, ff: { r: [7.8, -5.8], d: -20, k: 70 }, hn: [3.2, 0], hf: [3.6, 0] },
      dax:  { at: 'H', x: -1.0, y: 2.2, thT: 78, thP: 86, neck: 72, head: 20, tail: -4, curl: 0, fn: { r: [7.1, -2.7], d: -20, k: 70 }, ff: { r: [6.7, -3.3], d: -20, k: 70 }, hn: [1.4, 0], hf: [1.8, 0] },
    },
    roll: {
      gold: { x: 4.0, y: 5.4, thT: 2, thP: -2, roll: 1, neck: 8, head: 10, tail: -5, curl: 0.1, jaw: 0.5, tongue: 0.9, ear: 0.2,
              fn: { r: [2.5, -8.5], d: -10, k: 80 }, ff: { r: [1.0, -8.0], d: -10, k: 80 }, hn: { r: [2.2, -7.5] }, hf: { r: [1.0, -7.0] } },
      dax:  { x: 3.6, y: 3.7, thT: 2, thP: -2, roll: 1, neck: 10, head: 12, tail: -4, curl: 0.1, jaw: 0.5, tongue: 0.9, ear: 0.2,
              fn: { r: [1.8, -4.8], d: -10, k: 80 }, ff: { r: [0.8, -4.5], d: -10, k: 80 }, hn: { r: [1.6, -4.2] }, hf: { r: [0.8, -4.0] } },
    },
    sniff: {
      gold: { x: 4.2, y: 12.7, thT: -8, thP: -4, neck: -40, head: -62, tail: -5, curl: 0.2, fn: [6.9, 0], ff: [6.9, 0] },
      dax:  { x: 3.8, y: 6.7, thT: -5, thP: -2, neck: -25, head: -33, tail: 30, curl: 0.4, fn: [6.4, 0], ff: [6.4, 0] },
    },
    tug: {
      gold: { x: 2.6, y: 10.6, thT: -6, thP: 12, neck: -48, head: -12, tail: 40, curl: 0.3, jaw: 0.45, fn: [9.4, 0], ff: [9.4, 0], hn: [-7.9, 0], hf: [-7.9, 0] },
      dax:  { x: 2.6, y: 6.0, thT: 2, thP: 12, neck: 8, head: -4, tail: 35, curl: 0.4, jaw: 0.45, fn: [8.0, 0], ff: [8.0, 0], hn: [-6.6, 0], hf: [-6.6, 0] },
    },
    lick: {
      gold: { x: 4.2, y: 13.6, thT: -4, thP: -1, neck: -5, head: -30, tail: 20, curl: 0.35, jaw: 0.35, tongue: 1 },
      dax:  { x: 3.6, y: 7.2, neck: 45, head: 15, tail: 25, curl: 0.5, jaw: 0.35, tongue: 1 },
    },
    air: {
      gold: { x: 4.0, y: 14.0, thT: 6, thP: -4, len: 1.06, neck: 30, head: -8, tail: -4, curl: 0, ear: 0.6,
              fn: { r: [8.5, -9.5], d: -20 }, ff: { r: [9.5, -8.5], d: -20 }, hn: { r: [-9.5, -7.5] }, hf: { r: [-10.5, -6.5] } },
      dax:  { x: 3.6, y: 7.0, thT: 5, thP: -5, len: 1.05, neck: 40, head: -6, tail: 0, curl: 0, ear: 0.6,
              fn: { r: [6.0, -5.2], d: -25 }, ff: { r: [6.6, -4.6], d: -25 }, hn: { r: [-6.2, -3.6] }, hf: { r: [-6.8, -3.0] } },
    },
    // —— 下面是内部用的 ——
    _crouch: {   // 起跳前往下一蹲
      gold: { x: 3.6, y: 11.1, thT: -3, thP: 4, neck: 40, head: -10, tail: -20, curl: 0.2, ear: 0.3 },
      dax:  { x: 3.3, y: 5.9, thT: -3, thP: 5, neck: 48, head: -8, tail: -5, curl: 0.3, ear: 0.3 },
    },
    _tuck: {     // 跳到最高点：四条腿收在肚子下面
      gold: { x: 4.0, y: 14.2, thT: 2, thP: 6, len: 0.96, neck: 36, head: -10, tail: 4, curl: 0.1, ear: 0.1,
              fn: { r: [3.5, -8.0], d: -30, k: 95 }, ff: { r: [4.6, -7.4], d: -30, k: 85 }, hn: { r: [3.2, -7.2] }, hf: { r: [2.2, -6.6] } },
      dax:  { x: 3.6, y: 7.1, thT: 2, thP: 8, len: 0.95, neck: 46, head: -8, tail: 6, curl: 0.2, ear: 0.1,
              fn: { r: [2.6, -4.4], d: -30, k: 95 }, ff: { r: [3.3, -4.0], d: -30, k: 85 }, hn: { r: [2.0, -3.4] }, hf: { r: [1.4, -3.0] } },
    },
    _reach: {    // 往下落：前腿伸出去找地面
      gold: { x: 4.0, y: 13.8, thT: -10, thP: -3, len: 1.03, neck: 38, head: -14, tail: 20, curl: 0.1, ear: -0.5,
              fn: { r: [7.0, -13.5], d: -22 }, ff: { r: [8.4, -12.8], d: -22 }, hn: { r: [-4.5, -9.5] }, hf: { r: [-6.0, -9.0] } },
      dax:  { x: 3.6, y: 6.9, thT: -9, thP: -3, len: 1.03, neck: 44, head: -12, tail: 24, curl: 0.1, ear: -0.5,
              fn: { r: [4.6, -8.2], d: -26 }, ff: { r: [5.5, -7.8], d: -26 }, hn: { r: [-3.0, -5.0] }, hf: { r: [-3.8, -4.6] } },
    },
    _dangle: {   // 被拎在半空：四条腿垂着
      gold: { x: 4.0, y: 14.0, thT: 16, thP: 26, neck: 30, head: -22, tail: -70, curl: -0.1, ear: 0.1,
              fn: { r: [2.5, -15.5], d: -20, k: 35 }, ff: { r: [3.6, -15.0], d: -20, k: 30 }, hn: { r: [1.5, -13.0] }, hf: { r: [0.6, -12.6] } },
      dax:  { x: 3.6, y: 7.0, thT: 14, thP: 24, neck: 38, head: -18, tail: -65, curl: -0.1, ear: 0.1,
              fn: { r: [1.8, -9.2], d: -24, k: 35 }, ff: { r: [2.5, -8.9], d: -24, k: 30 }, hn: { r: [1.2, -7.0] }, hf: { r: [0.6, -6.7] } },
    },
    _brace: {    // 急停：前腿撑在前面，屁股往下坐
      gold: { x: 3.2, y: 12.6, thT: 6, thP: 16, neck: 62, head: -2, tail: 10, curl: 0.2, ear: -0.6, fn: [10.2, 0], ff: [10.2, 0], hn: [-6.6, 0], hf: [-6.6, 0] },
      dax:  { x: 3.0, y: 6.5, thT: 5, thP: 15, neck: 68, head: 0, tail: 20, curl: 0.3, ear: -0.6, fn: [8.3, 0], ff: [8.3, 0], hn: [-5.8, 0], hf: [-5.8, 0] },
    },
  };
  // 对外公开的姿势名
  var POSES = ['stand', 'alert', 'sit', 'paw', 'scratch', 'lie', 'sleep', 'bow', 'dig', 'beg', 'roll', 'sniff', 'tug', 'lick', 'air'];

  // 姿势的"通道"：名字 + 哪一拨动（0 躯干 · 1 脖子和头，慢一拍 · 2 耳朵尾巴，慢两拍 · 3 脚，不做预备和过冲）
  var CH = [
    ['tx', 0], ['ty', 0], ['thT', 0], ['thP', 0], ['roll', 0], ['len', 0], ['belly', 0],
    ['neck', 1], ['head', 1], ['jaw', 1], ['tongue', 1],
    ['ear', 2], ['tail', 2], ['curl', 2],
    ['fnx', 3], ['fny', 3], ['fnd', 3], ['fnk', 3], ['fnp', 3],
    ['ffx', 3], ['ffy', 3], ['ffd', 3], ['ffk', 3], ['ffp', 3],
    ['hnx', 3], ['hny', 3], ['hnd', 3], ['hnp', 3],
    ['hfx', 3], ['hfy', 3], ['hfd', 3], ['hfp', 3],
  ];
  var NCH = CH.length;
  var LEGS = ['fn', 'ff', 'hn', 'hf'];

  // 把一条姿势定义换成一组通道值（只在一开始算一次）
  var tmpJ = {};
  function buildPose(B, def) {
    var P = {}, c = def.roll ? -1 : 1;
    P.thT = (def.thT || 0) * D2R; P.thP = (def.thP || 0) * D2R; P.roll = def.roll || 0; P.len = def.len || 1; P.belly = def.roll ? 1 : 0;
    var x = def.x, y = def.y, at = def.at || 'T';
    var cT = Math.cos(P.thT), sT = Math.sin(P.thT), cP = Math.cos(P.thP), sP = Math.sin(P.thP);
    if (at === 'S') { x -= B.S0[0] * cT - B.S0[1] * c * sT; y -= B.S0[0] * sT + B.S0[1] * c * cT; }
    else if (at === 'P' || at === 'H') {
      if (at === 'H') { x -= B.HJ[0] * cP - B.HJ[1] * c * sP; y -= B.HJ[0] * sP + B.HJ[1] * c * cP; }
      x += B.a * cP + B.b * cT; y += B.a * sP + B.b * sT;
    }
    P.tx = x; P.ty = y;
    P.neck = (def.neck === undefined ? B.neckA / D2R : def.neck) * D2R;
    P.head = (def.head === undefined ? B.headA / D2R : def.head) * D2R;
    P.tail = (def.tail === undefined ? B.tailA / D2R : def.tail) * D2R;
    P.curl = def.curl === undefined ? B.tailCurl : def.curl;
    P.jaw = def.jaw || 0; P.tongue = def.tongue || 0; P.ear = def.ear || 0;
    trunkPts(tmpJ, B, P.tx, P.ty, P.thT, P.thP, P.len, c);
    for (var n = 0; n < 4; n++) {
      var k = LEGS[n], fore = n < 2, s = def[k], jx = fore ? tmpJ.S0x : tmpJ.HJx, jy = fore ? tmpJ.S0y : tmpJ.HJy;
      var px, py, d = fore ? B.dF : B.dH, kap = 0, plant = 1;
      if (!s) { px = fore ? B.fpad : B.hpad; py = B.padY; }
      else if (s.length) { px = s[0]; py = s[1] + B.padY; if (s[2] !== undefined) d = s[2] * D2R; if (s[3] !== undefined) kap = s[3] * D2R; }
      else {
        if (s.r) { px = jx + s.r[0]; py = jy + s.r[1] * c; } else { px = s.a[0]; py = s.a[1]; }
        if (s.d !== undefined) d = s.d * D2R;
        if (s.k !== undefined) kap = s.k * D2R;
        plant = 0;
      }
      P[k + 'x'] = px; P[k + 'y'] = py; P[k + 'd'] = d; P[k + 'p'] = plant;
      if (fore) P[k + 'k'] = kap;
    }
    return P;
  }
  var TARGET = { gold: {}, dax: {} };
  (function () {
    for (var name in POSE_DEF) for (var kind in BREED) TARGET[kind][name] = buildPose(BREED[kind], POSE_DEF[name][kind]);
  })();
  var IS_POSE = {};
  POSES.forEach(function (p) { IS_POSE[p] = 1; });
  // 这些姿势是"站着的"：走起来的时候脖子、尾巴跟着速度变
  var UPRIGHT = { stand: 1, alert: 1, lick: 0.5 };
  // 这些姿势换起来动作大，过渡慢一点
  var BIG = { sit: 1, paw: 1, scratch: 1, lie: 1, sleep: 1, beg: 1, roll: 1, bow: 1 };

  function copyCh(dst, src) { for (var n = 0; n < NCH; n++) { var k = CH[n][0]; dst[k] = src[k]; } return dst; }
  function mixCh(dst, target, w) { if (w <= 0) return; for (var n = 0; n < NCH; n++) { var k = CH[n][0]; dst[k] += (target[k] - dst[k]) * w; } }
  // 换姿势时的走法：先往反方向让一点点（预备）→ 中间快两头慢 → 冲过头一点 → 回来
  function easePose(u) {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    var s = smooth((u - 0.1) / 0.66);
    var ant = u < 0.2 ? -0.06 * Math.sin(PI * u / 0.2) : 0;
    var ov = u > 0.62 ? 0.055 * Math.sin(PI * (u - 0.62) / 0.38) : 0;
    return s + ant + ov;
  }

  // ============================================================
  //  6. 心情表 —— 只改脸、耳朵和尾巴，不改身体的姿势，可以叠在任何姿势上
  //    eye   眼睛的样子：open 睁着 · happy 笑眯眯 · sleepy 半闭 · wide 睁大 · soft 眼皮放松
  //    brow  眉毛：[抬高几格, 倾斜]，倾斜 1 = 眉头往下压（专注），−1 = 眉尾往下掉（委屈）
  //    ear   耳朵往后贴多少（弧度；负的往前竖）· earUp 耳根抬高
  //    tail  尾巴根再翘多少（弧度）· neck / head 脖子和头再抬多少（弧度）· wag 摇尾巴的幅度乘几
  //    smile 嘴角再翘一格
  // ============================================================
  var MOODS = {
    none:    { eye: 'open',   brow: [0, 0],  ear: 0,     earUp: 0,    tail: 0,     neck: 0,     head: 0,     wag: 1,   smile: 0 },
    happy:   { eye: 'happy',  brow: [0, 0],  ear: 0.05,  earUp: 0,    tail: 0.3,   neck: 0.04,  head: 0.05,  wag: 1.3, smile: 1 },
    sleepy:  { eye: 'sleepy', brow: [-1, 0], ear: 0.18,  earUp: -0.2, tail: -0.35, neck: -0.12, head: -0.1,  wag: 0.3, smile: 0 },
    guilty:  { eye: 'open',   brow: [0, -1], ear: 0.5,   earUp: -0.3, tail: -1.0,  neck: -0.35, head: -0.2,  wag: 0.2, smile: 0 },
    curious: { eye: 'wide',   brow: [1, 0],  ear: -0.4,  earUp: 0.3,  tail: 0.15,  neck: 0.08,  head: 0.14,  wag: 0.8, smile: 0 },
    proud:   { eye: 'soft',   brow: [0, 0],  ear: -0.1,  earUp: 0.1,  tail: 0.6,   neck: 0.16,  head: 0.12,  wag: 1,   smile: 1 },
    worried: { eye: 'open',   brow: [1, -1], ear: 0.35,  earUp: -0.2, tail: -0.5,  neck: -0.1,  head: -0.04, wag: 0.3, smile: 0 },
    focused: { eye: 'open',   brow: [0, 1],  ear: -0.3,  earUp: 0.2,  tail: 0.1,   neck: -0.1,  head: -0.06, wag: 0.4, smile: 0 },
  };
  var MOOD_KEYS = ['ear', 'earUp', 'tail', 'neck', 'head', 'wag', 'smile'];

  // ============================================================
  //  7. 步态
  //  GAIT：速度（世界单位/秒）→ 步频 f（每秒迈几个完整的步）、D（一步里脚踩在地上的时间占几成）、
  //        前/后脚抬多高、肩/胯上下颠多少、脊柱一弓一伸的幅度（弧度）、脖子/头/尾巴的角度（度）。
  //        行与行之间平滑过渡。步幅 = 速度 ÷ 步频，是算出来的，不是定死的。
  //  小狗的腿短，同样的步态下步子迈得快得多（大约是金毛的 1.7 倍）。
  // ============================================================
  var GAIT = {
    //      速度   f     D     抬前  抬后  颠肩  颠胯  脊柱  脖子 头   尾巴
    gold: [[0,    0.97, 0.72, 1.7,  1.4,  0.3,  0.3,  0,    47, -12, -28],
           [12,   1.05, 0.70, 1.7,  1.5,  0.3,  0.3,  0,    44, -12, -24],
           [24,   1.21, 0.66, 1.9,  1.6,  0.4,  0.4,  0,    42, -12, -20],
           [42,   1.37, 0.62, 2.1,  1.7,  0.45, 0.45, 0,    40, -13, -16],
           [62,   1.99, 0.47, 2.7,  2.3,  0.8,  0.8,  0.02, 33, -16, -8],
           [90,   2.24, 0.41, 3.1,  2.6,  1.0,  1.0,  0.03, 30, -16, -5],
           [112,  2.39, 0.38, 3.3,  2.8,  1.1,  1.1,  0.03, 28, -15, -4],
           [136,  2.53, 0.35, 4.2,  3.7,  1.4,  1.5,  0.18, 27, -14, -3],
           [153,  2.56, 0.35, 4.4,  3.9,  1.4,  1.5,  0.20, 27, -14, -3],
           [170,  2.63, 0.33, 4.5,  4.1,  1.5,  1.6,  0.23, 26, -13, -2],
           [237,  2.95, 0.27, 5.3,  5.0,  1.6,  1.9,  0.34, 24, -10, 0]],
    dax:  [[0,    1.64, 0.72, 0.85, 0.7,  0,    0,    0,    55, -10, -8],
           [14,   1.87, 0.69, 0.9,  0.75, 0,    0,    0,    54, -10, -6],
           [26,   2.19, 0.64, 1.0,  0.8,  0,    0,    0,    52, -9,  -3],
           [36,   2.33, 0.62, 1.05, 0.85, 0,    0,    0,    50, -9,  0],
           [51,   3.36, 0.47, 1.4,  1.2,  0.4,  0.4,  0.02, 47, -10, 5],
           [64,   3.51, 0.45, 1.45, 1.25, 0.45, 0.45, 0.03, 45, -10, 8],
           [96,   4.05, 0.38, 1.7,  1.45, 0.5,  0.5,  0.04, 41, -10, 10],
           [105,  4.13, 0.37, 1.8,  1.55, 0.5,  0.5,  0.05, 40, -9,  10],
           [122,  4.31, 0.31, 2.2,  1.95, 0.7,  0.8,  0.28, 37, -9,  10],
           [135,  4.36, 0.30, 2.25, 2.0,  0.7,  0.8,  0.31, 35, -8,  9],
           [150,  4.50, 0.28, 2.3,  2.1,  0.8,  0.9,  0.36, 34, -8,  8],
           [203,  5.00, 0.25, 2.7,  2.5,  0.9,  1.0,  0.45, 32, -7,  6]],
  };
  var gF = 0, gD = 0, gLiftF = 0, gLiftH = 0, gBobS = 0, gBobH = 0, gFlex = 0, gNeck = 0, gHead = 0, gTail = 0;
  function gaitAt(kind, v) {
    var tab = GAIT[kind], n = tab.length, i = 0;
    while (i < n - 2 && v > tab[i + 1][0]) i++;
    var a = tab[i], b = tab[i + 1], t = smooth((v - a[0]) / (b[0] - a[0]));
    gF = a[1] + (b[1] - a[1]) * t; gD = a[2] + (b[2] - a[2]) * t;
    gLiftF = a[3] + (b[3] - a[3]) * t; gLiftH = a[4] + (b[4] - a[4]) * t;
    gBobS = a[5] + (b[5] - a[5]) * t; gBobH = a[6] + (b[6] - a[6]) * t; gFlex = a[7] + (b[7] - a[7]) * t;
    gNeck = (a[8] + (b[8] - a[8]) * t) * D2R; gHead = (a[9] + (b[9] - a[9]) * t) * D2R; gTail = (a[10] + (b[10] - a[10]) * t) * D2R;
  }
  // 四只脚落地的先后（一整步算 1；顺序是 近前、远前、近后、远后；近后脚算 0）
  //   慢走：一只一只落（后脚 → 同侧前脚 → 另一边后脚 → 另一边前脚），任何时候至少两只脚在地上
  //   小跑：对角的两只脚一起落
  //   飞奔：金毛是后脚一前一后、前脚一前一后，然后四脚腾空；
  //         腊肠是两只后脚几乎一起落、一起蹬（兔子跳），再两只前脚，中间腾空两次
  var FOOTFALL = {
    gold: { walk: [0.20, 0.70, 0, 0.50], trot: [0.53, 0.03, 0, 0.50], run: [0.15, 0.00, 0, 0.70], run2: [0.19, 0.04, 0, 0.72], run3: [0.28, 0.14, 0, 0.78],
            band: [46, 58, 116, 128], v2: 136, v3: 170, v4: 237, phi0: 0.65 },
    dax:  { walk: [0.25, 0.75, 0, 0.50], trot: [0.53, 0.03, 0, 0.50], run: [0.54, 0.42, 0, 0.12], run2: [0.57, 0.45, 0, 0.08], run3: [0.57, 0.45, 0, 0.08],
            band: [38, 50, 108, 120], v2: 122, v3: 150, v4: 203, phi0: 0.95 },
  };

//@@PART3@@
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
