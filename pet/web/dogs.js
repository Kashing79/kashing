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
        bT[idx] = tone > 0.62 ? (tone > 0.95 ? 5 : 4) : (tone > 0.18 ? 3 : (tone > -0.28 ? 2 : 1));
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
        bT[idx] = tone > 0.62 ? (tone > 0.95 ? 5 : 4) : (tone > 0.18 ? 3 : (tone > -0.28 ? 2 : 1));
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
      HL: 12.6,                                     // 头长：后脑勺到鼻尖
      skull: [0.30, 0.02, 0.32, 0.29],              // 头骨：中心 (u, v)、两个半轴（都是头长的几分之几）
      stop: [0.50, -0.03, 0.17, 0.16],              // 额头到鼻梁之间的那一块
      muz: [0.56, -0.10, 0.145, 0.885, -0.105, 0.112],    // 上吻：起点 (u, v, 半径) → 终点 (u, v, 半径)
      jaw: [0.48, -0.205, 0.09, 0.84, -0.215, 0.066], hinge: [0.28, -0.14],
      nose: [0.975, -0.04, 0.072], eye: [0.50, 0.075], lip: -0.23,
      earAt: [0.26, 0.13], earL: 0.42, earR: [0.135, 0.095], earRest: -78,
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
      HL: 11.0,
      skull: [0.26, 0.0, 0.27, 0.215],
      stop: [0.43, -0.015, 0.14, 0.135],
      muz: [0.46, -0.05, 0.112, 0.925, -0.085, 0.062],
      jaw: [0.42, -0.135, 0.062, 0.865, -0.155, 0.045], hinge: [0.22, -0.12],
      nose: [0.985, -0.08, 0.062], eye: [0.42, 0.05], lip: -0.14,
      earAt: [0.19, 0.13], earL: 0.50, earR: [0.10, 0.145], earRest: -80,
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

  // ============================================================
  //  8. 一只狗
  // ============================================================
  function Rig(kind, coatName, seed) {
    if (!BREED[kind]) kind = 'dax';
    this.kind = kind;
    this.B = BREED[kind];
    this.coat = COATS[coatName] ? coatName : (kind === 'gold' ? 'gold' : 'dax_red');
    this.C = COATS[this.coat];
    this.pal = buildPal(this.C);
    this.rs = ((seed === undefined ? Math.random() * 4e9 : seed) >>> 0) || 7;   // 自己的随机数（只用来错开时间，不影响画法）
    var T = TARGET[kind];
    this.t = this.rnd() * 20;

    // 姿势：from → to，cur 是过渡到一半的样子，ch 是叠上腾空、急停这些之后真正拿去算骨架的
    this.pose = 'stand'; this.prev = 'stand'; this.to = T.stand;
    this.from = copyCh({}, T.stand); this.cur = copyCh({}, T.stand); this.ch = copyCh({}, T.stand);
    this.pt = 9; this.pdur = 0.3; this.pe = 1;

    // 步态
    this.S = 0;                  // 一共走了多远
    this.phase = this.rnd();     // 这一步走到哪了（0..1）
    this.G = 0;                  // 0 站着 … 1 在走/跑
    this.vS = 0; this.gt = 0; this.gb = 0; this.sprint = false; this.moving = false;
    this.off = [0, 0, 0, 0]; this.runP = [0, 0, 0, 0];
    this.legs = [];
    for (var k = 0; k < 4; k++) this.legs.push({ down: true, x: 0, y: 0, lx: 0, w0: 0, w: 0, u: -1, kap: 0, s: 1, xtd: 0, D: 0.6 });
    this.loadF = 0; this.loadH = 0; this.lastSp = 0; this.accS = 0; this.brake = 0; this.push = 0;
    this.varF = 1; this.varFt = 1; this.varL = 1; this.varLt = 1;
    this.bobS = 0; this.bobH = 0; this.flexA = 0; this.gNeck = 0; this.gHead = 0; this.gTail = 0; this.lam = 10; this.fq = 1;

    // 腾空、落地、急停、转身
    this.airT = -1; this.vz0 = 0; this.wAir = 0; this.wTuck = 0; this.wReach = 0; this.wDangle = 0; this.wCrouch = 0; this.wBrace = 0;
    this.landK = 0; this.landF = 0; this.landFV = 0; this.landH = 0; this.landHV = 0; this.landWait = -1; this.lastLanding = 0; this.sinceKick = 9;
    this.turnT = 1; this.lastFace = 0;

    // 耳朵、尾巴（弹簧，带惯性）
    this.earA = 0; this.earV = 0; this.earB = 0; this.earBV = 0;
    this.tailA = T.stand.tail; this.tailV = 0; this.tailB = T.stand.tail; this.tailBV = 0;
    this.wag = 0.3; this.wagT = this.rnd();
    this.fur = 0; this.furV = 0;          // 饰毛往后飘多少

    // 脸
    this.blinkAt = 1 + this.rnd() * 3; this.blink = 0;
    this.mood = 'none'; this.md = { ear: 0, earUp: 0, tail: 0, neck: 0, head: 0, wag: 1, smile: 0 };
    this.happy = 0; this.sleepy = 0; this.pant = 0; this.pantT = 0; this.exert = 0; this.carry = 0; this.bark = 0; this.shake = 0;
    this.look = 0; this.laW = 0; this.laX = 0; this.laY = 0;
    this.breathT = this.rnd(); this.br = 0;

    // 站着时的小动作
    this.flickAt = 2 + this.rnd() * 5; this.noseAt = 2 + this.rnd() * 4; this.nose = 0;
    this.shiftAt = 3 + this.rnd() * 4; this.shiftT = 0; this.shiftS = 0;
    this.tiltAt = 3 + this.rnd() * 4; this.tiltT = 0; this.tiltS = 0; this.tiltHold = 0;
    this.actT = this.rnd() * 3;           // 刨地、挠痒这些小动作自己的钟

    this.J = {}; this.J0 = {};
    this.LG = new Float64Array(40);       // 四条腿解出来的关节
    this.TL = new Float64Array(24);       // 尾巴每一节的位置
    this.outs = {};                       // 每种分辨率一张自己的图
    this.out = null;
  }
  Rig.prototype.rnd = function () {
    var x = this.rs;
    x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    this.rs = x || 7;
    return x / 4294967296;
  };
  // 一下带阻尼的弹簧（落地的一沉、耳朵的一甩都用它）
  function spring(o, pk, vk, target, w, z, dt) {
    var n = dt > 0.012 ? Math.ceil(dt / 0.012) : 1, h = dt / n;
    for (var i = 0; i < n; i++) {
      o[vk] += (w * w * (target - o[pk]) - 2 * z * w * o[vk]) * h;
      o[pk] += o[vk] * h;
    }
  }

  // 每一步都要调：把时间往前推。很便宜，不画东西。
  //   I: { pose, speed, air, wag, pant, carry, look, happy, shake, bark,        ← 第二版就有的
  //        mood, lookAt, vx, vy, accel, landing, turn, sleepy,                  ← 第三版加的
  //        vz（往上的速度，有的话腾空的几段分得更准）, crouch（0..1，起跳前先蹲一下） }
  Rig.prototype.update = function (dt, I) {
    I = I || {};
    if (!(dt > 0)) dt = 0;
    if (dt > 0.1) dt = 0.1;
    var B = this.B, kind = this.kind, gold = kind === 'gold', T = TARGET[kind], k, n;
    this.t += dt;
    this.actT += dt;

    // ---- 换姿势 ----
    var name = IS_POSE[I.pose] ? I.pose : 'stand';
    if (name !== this.pose) {
      copyCh(this.from, this.cur);
      this.to = T[name];
      this.pdur = (gold ? 0.42 : 0.27) * ((BIG[name] || BIG[this.pose]) ? 1.3 : 1);
      this.prev = this.pose; this.pose = name; this.pt = 0;
    }
    if (this.pt < 9) {
      this.pt += dt;
      var dur = this.pdur, tick = dur * 0.2, done = true;
      for (n = 0; n < NCH; n++) {
        var key = CH[n][0], g = CH[n][1];
        var u = (this.pt - (g === 1 ? tick : (g === 2 ? tick * 2 : 0))) / dur;
        if (u < 1) done = false;
        this.cur[key] = this.from[key] + (this.to[key] - this.from[key]) * (g === 3 ? smooth(u) : easePose(u));
      }
      this.pe = smooth(this.pt / dur);
      if (done) this.pt = 9;
    }

    // ---- 腾空和落地 ----
    var air = (I.air || 0) > 0.25;
    this.sinceKick += dt;
    if (air && this.airT < 0) { this.airT = 0; this.vz0 = I.vz > 0 ? I.vz : 0; }
    if (!air && this.airT >= 0) { if (this.airT > 0.08) this.kick(1); this.airT = -1; }
    var landing = +I.landing || 0;
    if (landing > 0.5 && this.lastLanding <= 0.5 && this.sinceKick > 0.3 && !air) this.kick(landing);
    this.lastLanding = landing;
    this.wAir = approach(this.wAir, air ? 1 : 0, air ? 24 : 14, dt);
    var tuck = 0, reach = 0, dangle = 0;
    if (air) {
      this.airT += dt;
      var fl = (I.vz !== undefined && this.vz0 > 0) ? clamp(0.5 - 0.5 * I.vz / this.vz0, 0, 1) : this.airT / 0.46;   // 飞到哪了
      dangle = smooth((this.airT - (name === 'air' ? 0.4 : 1.0)) / 0.3);        // 一直不落地 = 被拎着
      tuck = smooth((fl - 0.18) / 0.2) * (1 - smooth((fl - 0.55) / 0.2)) * (1 - dangle);
      reach = smooth((fl - 0.55) / 0.2) * (1 - dangle);
    }
    this.wTuck = approach(this.wTuck, tuck, 20, dt);
    this.wReach = approach(this.wReach, reach, 20, dt);
    this.wDangle = approach(this.wDangle, dangle, 10, dt);
    this.wCrouch = approach(this.wCrouch, clamp(+I.crouch || 0, 0, 1), 22, dt);
    // 落地的一沉：前半身先到，后半身晚一点
    var lw = gold ? 17 : 26;
    spring(this, 'landF', 'landFV', 0, lw, 0.5, dt);
    spring(this, 'landH', 'landHV', 0, lw * 0.92, 0.5, dt);
    if (this.landWait >= 0) { this.landWait -= dt; if (this.landWait < 0) this.landHV -= this.landK * 0.85; }

    // ---- 速度、加速度 ----
    var sp = +I.speed || 0;
    if (sp < 0) sp = 0;
    var acc = I.accel !== undefined ? +I.accel : (dt > 0 ? (sp - this.lastSp) / dt : 0);
    this.lastSp = sp;
    this.accS = approach(this.accS, acc, 8.3, dt);
    var gg = gold ? 338 : 490;
    var brake = clamp(-this.accS / gg, 0, 0.9), push = clamp(this.accS / gg, 0, 0.6);
    this.brake = approach(this.brake, brake, 20, dt); this.push = approach(this.push, push, 20, dt);
    var moving = sp > 3 && !air;
    this.wBrace = approach(this.wBrace, (brake > 0.4 && sp > 10 && !air) ? smooth((brake - 0.4) / 0.3) : 0, brake > 0.4 ? 16 : 7, dt);
    this.G = approach(this.G, moving ? 1 : 0, moving ? 18 : 9, dt);

    // ---- 步态 ----
    this.vS = approach(this.vS, sp, 12, dt);
    var v = Math.max(this.vS, gold ? 8 : 6);
    gaitAt(kind, v);
    this.varF = approach(this.varF, this.varFt, 5, dt); this.varL = approach(this.varL, this.varLt, 5, dt);
    var f = gF * this.varF, lam = v / f, ds = sp * dt;
    this.fq = f; this.lam = lam;
    this.bobS = gBobS; this.bobH = gBobH; this.flexA = gFlex; this.gNeck = gNeck; this.gHead = gHead; this.gTail = gTail;
    var FFp = FOOTFALL[kind], bd = FFp.band;
    // 用哪种步态：快到一定程度换上去，慢到一定程度才换下来（中间留一段，免得来回跳）
    if (this.accS > 0.6 * B.accel && sp > 3) this.sprint = true;            // 猛地起跑：直接用飞奔的步子
    else if (this.accS < 0.15 * B.accel) this.sprint = false;
    if (this.gt === 0 && this.vS > bd[1]) this.gt = 1; else if (this.gt === 1 && this.vS < bd[0]) this.gt = 0;
    if (this.gt === 1 && this.vS > bd[3]) this.gt = 2; else if (this.gt === 2 && this.vS < bd[2]) this.gt = 1;
    var gt = this.sprint ? 2 : this.gt;
    var o = this.off, rp = this.runP;
    var w2 = smooth((v - FFp.v2) / (FFp.v3 - FFp.v2)), w3 = smooth((v - FFp.v3) / (FFp.v4 - FFp.v3));
    for (k = 0; k < 4; k++) rp[k] = arcLerp(arcLerp(FFp.run[k], FFp.run2[k], w2), FFp.run3[k], w3);
    // 起步
    if (moving && !this.moving) {
      for (k = 0; k < 4; k++) {
        var L0 = this.legs[k], far0 = k & 1;
        L0.down = true; L0.w = 0; L0.y = 0;
        L0.x = this.cur[LEGS[k] + 'x'] + (far0 ? (k < 2 ? B.farX : -B.farX) : 0);
      }
      if (this.sprint) { this.gb = 2; this.phase = frac((gold ? rp[3] : rp[2]) - 0.05); }   // 两条后腿先收到身下，一起蹬
      else { this.gb = this.gt; var pat = this.gt === 0 ? FFp.walk : (this.gt === 1 ? FFp.trot : rp); this.phase = frac(pat[0] + gD + 0.02); }
    }
    this.moving = moving;
    var dph = ds / lam;
    this.phase += dph;
    if (this.phase >= 1) {
      this.phase -= 1;
      this.varFt = 1 + (this.rnd() - 0.5) * 0.05; this.varLt = 1 + (this.rnd() - 0.5) * 0.2;    // 没有两步是一模一样的
    }
    // 步态之间慢慢换：一步半左右换完
    var step = dph / 1.4 + dt * (this.sprint ? 6 : 0.5);
    this.gb += clamp(gt - this.gb, -step, step);
    var gb = this.gb, lo = gb < 1 ? FFp.walk : FFp.trot, hi = gb < 1 ? FFp.trot : rp, tt = smooth(gb < 1 ? gb : gb - 1);
    for (k = 0; k < 4; k++) o[k] = arcLerp(lo[k], hi[k], tt);
    var runW = gb > 1 ? gb - 1 : 0;
    this.runW = runW;

    // ---- 四只脚 ----
    // 踩在地上的脚钉在地面上不动：身体往前走了 ds，它在身体坐标里就往后退 ds（不是按时间摆腿，所以不打滑）。
    // 离地的脚沿一条弧线迈到下一个落脚点。
    var hrF = B.reachF * 0.5 * (1 + 0.12 * runW), hrH = B.reachH * 0.5 * (1 + 0.12 * runW);
    var rho = gold ? 0.3 : 0.5;
    var kPeak = gb < 1 ? lerp(1.1, 1.5, gb) : lerp(1.5, 1.9, gb - 1);
    var lf = 0, lh = 0;
    for (k = 0; k < 4; k++) {
      var L = this.legs[k], fore = k < 2, far = k & 1;
      var x0 = fore ? B.fpad + (far ? B.farX : 0) : B.hpad - (far ? B.farX : 0);
      var xp = (fore ? B.T0[0] + B.S0[0] : B.T0[0] - B.L + B.HJ[0]) + (far ? (fore ? B.farX : -B.farX) : 0);
      var hr = fore ? hrF : hrH, s = gD * lam, D = gD;
      if (s > 2 * hr) { s = 2 * hr; D = s / lam; }                   // 腿够不到那么远：这条腿早一点离地
      var room = hr - s / 2, c = clamp(x0 + (fore ? 0.12 : -0.10) * s, xp - room, xp + room);
      var xtd = c + s / 2, p = frac(this.phase - o[k]);
      L.s = s; L.xtd = xtd; L.D = D;
      if (!moving) { L.u = -1; L.kap = approach(L.kap, 0, 12, dt); continue; }
      if (L.down) {
        L.x -= ds;
        if (p >= D) { L.down = false; L.lx = L.x; L.w0 = Math.min(0.85, (p - D) / (1 - D)); L.w = 0; }
      }
      if (!L.down) {
        if (p < D) { if (L.w > 0.5) L.x = xtd - p * lam; L.down = true; L.y = 0; L.w = 0; L.kap = 0; }
        else {
          var w = ((p - D) / (1 - D) - L.w0) / (1 - L.w0);
          if (w < L.w) w = L.w; else if (w > 1) w = 1;
          L.w = w;
          var dx = xtd - L.lx, m = Math.abs(dx) > 0.5 ? -rho * lam * (1 - D) * (1 - L.w0) / dx : 0;
          if (m < -1.5) m = -1.5; else if (m > 0) m = 0;
          var w2s = w * w, w3s = w2s * w;
          L.x = L.lx + dx * ((3 * w2s - 2 * w3s) + m * (w3s - 2 * w2s + w) + m * (w3s - w2s));
          var wp = 1 - Math.pow(1 - w, fore ? lerp(1.25, 1.8, runW) : 1.18);
          L.y = (fore ? gLiftF : gLiftH) * this.varL * Math.pow(Math.sin(PI * wp), 1.1);
          if (fore) {
            if (runW > 0 && w < 0.5) L.x -= (gold ? 0.9 : 0.4) * runW * Math.sin(TAU * w);        // 飞奔时前脚先往后收一下
            L.kap = kPeak * Math.sin(PI * (w < 0.4 ? w / 0.8 : 0.5 + (w - 0.4) / 1.2));           // 腕关节折起来，落地前再甩直
          }
        }
      }
      L.u = L.down ? clamp((xtd - L.x) / s, 0, 1) : -1;
      if (L.down) { var sn = Math.sin(PI * L.u); if (fore) { if (sn > lf) lf = sn; } else if (sn > lh) lh = sn; }
    }
    this.loadF = approach(this.loadF, lf, 25, dt); this.loadH = approach(this.loadH, lh, 25, dt);

    // ---- 表情和状态 ----
    var mname = MOODS[I.mood] ? I.mood : 'none';
    this.mood = mname;
    var mt = MOODS[mname], md = this.md;
    for (n = 0; n < MOOD_KEYS.length; n++) { var mk = MOOD_KEYS[n]; md[mk] = approach(md[mk], mt[mk], 7, dt); }
    this.happy = approach(this.happy, (I.happy || name === 'roll' || name === 'scratch') ? 1 : 0, 12, dt);
    this.sleepy = approach(this.sleepy, clamp(+I.sleepy || 0, 0, 1), 3, dt);
    this.carry = approach(this.carry, I.carry ? 1 : 0, 16, dt);
    this.bark = approach(this.bark, I.bark ? 1 : 0, 30, dt);
    this.shake = +I.shake || 0;
    this.look = approach(this.look, clamp(+I.look || 0, -1, 1), 7, dt);
    if (I.lookAt && I.lookAt.length === 2) { this.laX = approach(this.laX, +I.lookAt[0] || 0, 10, dt); this.laY = approach(this.laY, +I.lookAt[1] || 0, 10, dt); }
    this.laW = approach(this.laW, I.lookAt ? 1 : 0, 8, dt);
    // 跑累了会喘：跑得越久喘得越久
    var KV = gold ? 62 : 64;
    this.exert = clamp(this.exert + dt * (sp > KV * 1.3 ? 0.45 * sp / (KV * 2.5) : -0.09), 0, 1);
    var pantOn = (I.pant || this.exert > 0.5 || sp > KV * 2.2) && !I.carry && name !== 'sleep';
    this.pant = approach(this.pant, pantOn ? 1 : 0, 8, dt);
    this.pantT += dt;
    // 摇尾巴
    this.wag = approach(this.wag, I.wag === undefined ? 0.3 : clamp(+I.wag, 0, 1), 6, dt);
    this.wagT += dt * (1.2 + 2.8 * this.wag);
    // 眨眼：间隔不固定，偶尔连眨两下；困了眨得慢
    this.blinkAt -= dt;
    if (this.blinkAt <= 0) {
      this.blink = 0.09 + this.sleepy * 0.12;
      this.blinkAt = this.rnd() < 0.1 ? 0.24 : 2.5 + this.rnd() * 3.5;
    }
    if (this.blink > 0) this.blink -= dt;
    // 呼吸：停一会儿 → 吸气 → 停一会儿 → 呼气（不是匀速的正弦）
    var asleep = name === 'sleep';
    this.breathT = frac(this.breathT + dt / (asleep ? 4.2 : (gold ? 2.3 : 2.0)));
    var bt = this.breathT;
    this.br = bt < 0.44 ? 0 : (bt < 0.52 ? smooth((bt - 0.44) / 0.08) : (bt < 0.89 ? 1 : 1 - smooth((bt - 0.89) / 0.11)));

    // ---- 站着时的小动作：抖耳朵、动鼻子、换一下重心、歪一下头 ----
    var calm = this.G < 0.1 && !air && (name === 'stand' || name === 'alert' || name === 'sit' || name === 'lie' || name === 'beg');
    this.flickAt -= dt; this.noseAt -= dt; this.shiftAt -= dt; this.tiltAt -= dt;
    if (this.flickAt <= 0) { this.flickAt = (gold ? 4 : 2) + this.rnd() * (gold ? 6 : 3.5); if (calm || asleep) this.earV -= 7 + this.rnd() * 4; }
    if (this.noseAt <= 0) { this.noseAt = 2.5 + this.rnd() * 5; this.nose = 0.16; }
    if (this.nose > 0) this.nose -= dt;
    if (this.shiftAt <= 0) { this.shiftAt = (gold ? 5 : 2.5) + this.rnd() * (gold ? 6 : 3); this.shiftT = calm && (name === 'stand' || name === 'alert') ? (this.rnd() < 0.5 ? -1 : 1) * (this.shiftT === 0 ? 1 : 0) : 0; }
    this.shiftS = approach(this.shiftS, calm ? this.shiftT : 0, 3.5, dt);
    if (this.tiltAt <= 0) { this.tiltAt = (gold ? 4 : 2.5) + this.rnd() * 5; this.tiltT = calm ? (this.rnd() - 0.5) * 2 : 0; this.tiltHold = 0.6 + this.rnd() * 0.8; }
    if (this.tiltHold > 0) { this.tiltHold -= dt; if (this.tiltHold <= 0) this.tiltT = 0; }
    this.tiltS = approach(this.tiltS, calm ? this.tiltT : 0, 9, dt);

    // ---- 耳朵：跑起来往后飘，小跑时一颠一颠，急停往前甩，落地往下一沉再弹回来 ----
    var earT = this.cur.ear + md.ear + Math.min(1.15, sp * 0.0075) * this.G - clamp(this.accS * 0.0012, -0.6, 0.6) + this.G * 0.35 * (this.loadF - 0.4);
    if (air) earT += this.wReach * -0.7 + (1 - this.wReach) * 0.5;
    if (this.shake) earT += Math.sin(this.t * 40) * 0.3 * this.shake;
    spring(this, 'earA', 'earV', earT, gold ? 17 : 21, 0.34, dt);
    spring(this, 'earB', 'earBV', this.earA, gold ? 13 : 15, 0.3, dt);
    // ---- 尾巴 ----
    var upr = UPRIGHT[name] || 0;
    var tailT = lerp(this.cur.tail, this.gTail, this.G * upr) + md.tail * (name === 'sleep' ? 0 : 1) - this.brake * 0.3 + this.push * 0.2;
    spring(this, 'tailA', 'tailV', tailT, gold ? 13 : 18, 0.5, dt);
    spring(this, 'tailB', 'tailBV', this.tailA, gold ? 9 : 12, 0.4, dt);
    // ---- 饰毛：身体一动，毛梢慢半拍 ----
    spring(this, 'fur', 'furV', Math.min(1, sp / 150) - clamp(this.accS * 0.0015, -0.5, 0.5), 11, 0.4, dt);
  };
  // 落地：往下的一下冲击（前半身先，后半身晚 0.04 秒），耳朵尾巴跟着甩
  Rig.prototype.kick = function (k) {
    var gold = this.kind === 'gold';
    this.landK = (gold ? 34 : 22) * k;
    this.landFV -= this.landK;
    this.landWait = 0.04;
    this.earV += 9 * k; this.tailV -= 5 * k; this.furV += 6 * k;
    this.sinceKick = 0;
  };

  // 某个姿势现在占几成（换姿势换到一半时，新旧两个各占一部分）
  Rig.prototype.pw = function (name) {
    var e = this.pt < 9 ? this.pe : 1;
    return (this.pose === name ? e : 0) + (this.prev === name && this.pt < 9 ? 1 - e : 0);
  };

  // 把现在的状态算成一副骨架（只算，不画）。face：1 脸朝右，−1 朝左（"看向某一点"要用）
  Rig.prototype.solve = function (face) {
    var B = this.B, kind = this.kind, gold = kind === 'gold', T = TARGET[kind], J = this.J, J0 = this.J0, ch = this.ch, LG = this.LG;
    var name = this.pose, t = this.t, md = this.md, k;

    // ---- 姿势：换姿势换到一半的样子，再叠上：起跳前的蹲、腾空的几段、急停 ----
    copyCh(ch, this.cur);
    mixCh(ch, T._crouch, this.wCrouch);
    if (this.wAir > 0.002) {
      mixCh(ch, T.air, this.wAir);
      mixCh(ch, T._tuck, this.wAir * this.wTuck);
      mixCh(ch, T._reach, this.wAir * this.wReach);
      mixCh(ch, T._dangle, this.wAir * this.wDangle);
    }
    mixCh(ch, T._brace, this.wBrace);
    var G = this.G * (1 - this.wBrace) * (1 - this.wAir), upr = UPRIGHT[name] || 0;
    J.G = G;

    // ---- 躯干 ----
    var tx = ch.tx, ty = ch.ty, thT = ch.thT, thP = ch.thP, len = ch.len, c = Math.cos(ch.roll * PI);
    trunkPts(J0, B, tx, ty, thT, thP, len, c);       // 这个姿势"本来"的关节位置：悬空的脚是跟着它走的
    var p0x = J0.S0x, p0y = J0.S0y, p1x = J0.HJx, p1y = J0.HJy;
    var dyT = 0, dyP = 0, hgt = B.T0[1], flex = 0;
    if (G > 0.002) {
      // 走、跑：整个身子压低一点；脚踩实的时候身体最低，腾空的时候最高；飞奔时脊柱一弓一伸
      dyT += G * (-0.04 * hgt + this.bobS * (0.3 - this.loadF));
      dyP += G * (-0.04 * hgt + this.bobH * (0.3 - this.loadH));
      flex = this.flexA * Math.cos(TAU * (this.phase - FOOTFALL[kind].phi0)) * G;
      thT -= 0.4 * flex; thP += 0.6 * flex; len *= 1 - 0.2 * flex;
    }
    J.flex = flex;
    // 起步往前压、刹车往后坐
    var mv = Math.min(1, this.vS / 30 + this.wBrace);
    dyP -= (0.12 * this.brake + 0.04 * this.push) * hgt * mv;
    dyT += (0.025 * this.brake - 0.05 * this.push) * hgt * mv;
    tx += (0.9 * this.push - 0.5 * this.brake) * mv * (gold ? 1 : 0.6);
    // 落地的一沉
    dyT += this.landF; dyP += this.landH;
    // 站久了换一下重心
    tx += this.shiftS * (gold ? 0.4 : 0.3); dyP -= Math.abs(this.shiftS) * 0.2;
    // 摇尾巴摇得欢：屁股跟着扭（腊肠整个身子都在扭）
    var wagS = Math.sin(this.wagT * TAU), wig = clamp((this.wag - 0.55) / 0.45, 0, 1) * (1 - G) * (name === 'sleep' ? 0 : 1);
    var wigX = wig * wagS * (gold ? 0.3 : 0.5);
    if (!gold) tx -= wigX * 0.4;
    // 拔河：左右猛甩
    if (this.shake) tx += (Math.sin(t * 46) > 0 ? 0.3 : -0.3) * this.shake;
    ty += dyT;
    var dth = (dyT - dyP) / B.L;
    thT += dth; thP += dth;
    trunkPts(J, B, tx, ty, thT, thP, len, c);
    J.Px += wigX; J.HJx += wigX; J.TSx += wigX;
    J.br = this.br; J.len = len;

    // ---- 四条腿 ----
    var up = c < 0 ? -1 : 1;
    var wDig = this.pw('dig'), wScr = this.pw('scratch'), wRoll = this.pw('roll'), wBeg = this.pw('beg'), wPaw = this.pw('paw');
    var at = this.actT;
    for (k = 0; k < 4; k++) {
      var key = LEGS[k], fore = k < 2, far = k & 1, L = this.legs[k];
      var ox = far ? (fore ? B.farX : -B.farX) : 0, oy = far ? B.farY : 0;
      var jx = fore ? J.S0x : J.HJx, jy = fore ? J.S0y : J.HJy, pl = ch[key + 'p'];
      var px = ch[key + 'x'] + (1 - pl) * (jx - (fore ? p0x : p1x)) + ox, py = ch[key + 'y'] + (1 - pl) * (jy - (fore ? p0y : p1y));
      var d = ch[key + 'd'], kap = fore ? ch[key + 'k'] : 0;
      // 换姿势的时候脚是抬起来迈过去的，不是在地上拖
      if (this.pt < 9 && pl > 0.5 && G < 0.5) {
        var mvx = Math.abs(this.to[key + 'x'] - this.from[key + 'x']);
        if (mvx > 0.8) py += Math.min(1.5, 0.28 * mvx) * Math.sin(PI * this.pe) * (far ? 0.7 : 1);
      }
      // —— 小动作 ——（哪个姿势有自己的小动作，就加在这里）
      if (wDig > 0.01 && fore) {            // 刨地：两只前脚轮流往后扒
        var dg = at * (gold ? 5 : 7) * TAU + (far ? PI : 0);
        px += wDig * (gold ? 2.6 : 1.7) * Math.sin(dg); py += wDig * (gold ? 1.5 : 0.9) * Math.max(0, Math.cos(dg));
      }
      if (wScr > 0.01 && k === 2) { var sc = Math.sin(at * 6 * TAU); px += wScr * 0.5 * sc; py += wScr * (gold ? 1.0 : 0.7) * sc; }   // 挠痒：后脚一秒六下
      if (wRoll > 0.01) { px += wRoll * (fore ? 0.9 : 0.8) * Math.sin(at * (fore ? 9 : 7.5) + k * 1.7); }                           // 打滚：四脚朝天乱蹬
      if (wBeg > 0.01 && fore) py += wBeg * 0.35 * Math.sin(at * 6 + k);                                                           // 作揖：前爪一点一点
      if (wPaw > 0.01 && k === 0) py += wPaw * 0.4 * Math.sin(at * 5);
      // —— 走、跑 ——
      if (G > 0.002) {
        px = lerp(px, L.x, G); py = lerp(py, L.y + B.padY, G);
        d = lerp(d, fore ? B.dF : B.dH, G); kap = lerp(kap, L.kap, G);
      }
      if (fore) foreIK(LG, k * 10, jx + ox, jy + oy, px, py + oy, B, d, kap, up);
      else hindIK(LG, k * 10, jx + ox, jy + oy, px, py + oy, B, d, up);
    }

    // ---- 脖子和头 ----
    var neck = ch.neck, head = ch.head, gu = G * upr;
    neck = lerp(neck, this.gNeck, gu); head = lerp(head, this.gHead, gu);          // 走得越快，头越往前探
    var mw = (name === 'sleep' || name === 'roll') ? 0.2 : 1;
    neck += md.neck * mw; head += md.head * mw;                                    // 心情
    neck += this.look * 0.22; head += this.look * 0.42;                            // 抬头低头
    head += this.bark * 0.22; neck += this.bark * 0.06;                            // 叫：头一扬
    head -= this.sleepy * 0.12 * mw; neck -= this.sleepy * 0.1 * mw;               // 困了头往下耷拉
    head += this.tiltS * 0.1;                                                      // 站着时偶尔动一下头
    if (G > 0.002) {
      var nod = (this.loadF - 0.45) * (gold ? 0.07 : 0.05) * G;                     // 前脚踩实的时候头点一下
      neck -= nod; head -= nod * 0.5;
      neck += 0.5 * flex; head -= 0.2 * flex;                                      // 飞奔：身体伸开时脖子往前探，收拢时抬起来
    }
    if (this.shake) head += Math.sin(t * 46) * 0.07 * this.shake;
    head += this.landF * 0.05; neck += this.landF * 0.03;                          // 落地：头往下一栽
    head -= this.push * 0.15 * mv; neck -= this.push * 0.2 * mv;                   // 起步：头压低往前冲
    head += this.brake * 0.12 * mv; neck += this.brake * 0.15 * mv;                // 刹车：头扬起来
    var nl = B.neck, hx = J.N0x + nl * Math.cos(neck), hy = J.N0y + nl * Math.sin(neck);
    if (this.laW > 0.01) {                 // 看向某一点：头转过去一大半，脖子跟一点；转不过去的角度就到头为止
      var want = Math.atan2(this.laY - hy, Math.max(2, this.laX * face - hx));
      var dl = clamp(want - head, -0.9, 0.9) * this.laW;
      head += dl * 0.65; neck += dl * 0.3;
      hx = J.N0x + nl * Math.cos(neck); hy = J.N0y + nl * Math.sin(neck);
    }
    hy -= 0.3 * G * this.bobS * (0.3 - this.loadF);                                // 身体颠的时候头颠得少一点
    var vs = c < 0 ? -1 : 1;
    var minY = B.HL * (B.skull[3] + 0.02);                                         // 头别钻到地里
    var sky = hy + B.HL * B.skull[0] * Math.sin(head);
    if (sky < minY) hy += minY - sky;
    J.hx = hx; J.hy = hy; J.hp = head; J.neck = neck; J.vs = vs;

    // ---- 嘴、舌头 ----
    var wLick = this.pw('lick');
    var jaw = Math.max(ch.jaw, this.pant * 0.5, this.carry * 0.75, this.bark * 0.9);
    var tongue = Math.max(ch.tongue, this.pant) * (1 - this.carry);
    if (wLick > 0.01) tongue = lerp(tongue, 1.0 + 0.4 * Math.sin(at * 13), wLick);
    J.jaw = jaw * 0.6; J.tongue = tongue; J.lick = wLick;
    J.pantStep = this.pant > 0.3 ? (Math.floor(this.pantT * 12) & 1) : 0;

    // ---- 尾巴：一节一节接起来，越往梢越慢半拍 ----
    var N = B.tailN, TL = this.TL, segL = B.tailL / N, q;
    var wAmp = this.wag < 0.04 ? 0 : (10 + 30 * this.wag) * D2R * md.wag * (1 - 0.5 * G) * (1 - this.runW * G) * (name === 'sleep' ? 0 : 1) * (c < 0 ? 0.6 : 1);
    var x = J.TSx, y = J.TSy, dPel = thP - ch.thP, minT = B.tailR[1] + 0.2;
    TL[0] = x; TL[1] = y;
    for (q = 0; q < N; q++) {
      var fr = q / (N - 1);
      var a = lerp(this.tailA, this.tailB, fr) + ch.curl * fr * (gold ? 1.0 : 1.4) + dPel * 0.7
            + wAmp * Math.sin(this.wagT * TAU - fr * 1.6) * (0.35 + 0.65 * fr);
      var sl = segL * (1.14 - 0.32 * fr);
      x -= Math.cos(a) * sl; y += Math.sin(a) * sl;
      if (y < minT) y = minT;
      TL[q * 2 + 2] = x; TL[q * 2 + 3] = y;
    }
    J.wagS = wagS;

    // ---- 脸 ----
    var eye = MOODS[this.mood].eye;
    if (this.happy > 0.5) eye = 'happy';
    if (this.sleepy > 0.6 && eye === 'open') eye = 'sleepy';
    if (this.pw('sleep') > 0.5 || this.blink > 0) eye = 'shut';
    J.eye = eye; J.brow = MOODS[this.mood].brow; J.smile = md.smile > 0.5 || this.happy > 0.5;
    J.earA = this.earA; J.earB = this.earB; J.earUp = md.earUp;

    // ---- 锚点（身体坐标）----
    var cu = Math.cos(head) * B.HL, su = Math.sin(head) * B.HL;
    J.mouthX = hx + B.ball[0] * cu - B.ball[1] * vs * su - J.jaw * 1.2; J.mouthY = hy + B.ball[0] * su + B.ball[1] * vs * cu - J.jaw * 0.8;
    J.noseX = hx + cu - B.nose[1] * vs * su; J.noseY = hy + su + B.nose[1] * vs * cu;
    J.headX = hx + B.skull[0] * cu; J.headY = hy + B.skull[0] * su;
    J.backX = (J.Px + J.Tx) / 2; J.backY = (J.Py + J.Ty) / 2 + (B.rib[1] + B.pel[1]) / 2 * c;
    return J;
  };

  // ---- 画一条腿、一只脚掌、一撮毛 ----
  function drawPaw(px, py, ma, sz, mat, z, part, pd) {
    var tx = -Math.sin(ma), ty = Math.cos(ma), lift = sz[1] - pd;
    brush(z, 0.8, mat, part, 0.3, 0);
    ell(px + tx * sz[0] * 0.36 - Math.cos(ma) * lift, py + ty * sz[0] * 0.36 - Math.sin(ma) * lift, sz[0], sz[1], ma + PI / 2);
  }
  function drawHind(B, LG, k, jx, jy, far, bias) {
    var o = k * 10, kx = LG[o], ky = LG[o + 1], hx = LG[o + 2], hy = LG[o + 3], px = LG[o + 6], py = LG[o + 7], ma = LG[o + 8];
    var z = far ? -30 : 10, mat = far ? M_COATF : M_COAT, part = far ? P_FHIND : P_NHIND;
    brush(z, 2, mat, part, 0.3, bias);
    ell((jx + kx) / 2, (jy + ky) / 2, B.thigh[0], B.thigh[1], Math.atan2(ky - jy, kx - jx));     // 大腿：一整块肌肉
    brush(z, 1.2, mat, part, 0.3, bias);
    cap(kx, ky, B.gaskR[0], hx, hy, B.gaskR[1]);                                                  // 小腿
    cap(hx + B.hock * Math.sin(ma), hy - B.hock * Math.cos(ma), B.metaR * 0.95, hx, hy, B.metaR); // 飞节往后突出的那一点
    cap(hx, hy, B.metaR, px - Math.cos(ma) * 0.5, py - Math.sin(ma) * 0.5, B.metaR * 0.95);       // 跖骨
    drawPaw(px, py, ma, B.hpaw, far ? M_PAWF : M_PAW, z + 0.6, part, B.padY);
  }
  function drawFore(B, LG, k, sx, sy, far, bias) {
    var o = k * 10, jx = LG[o], jy = LG[o + 1], ex = LG[o + 2], ey = LG[o + 3], cx = LG[o + 4], cy = LG[o + 5], px = LG[o + 6], py = LG[o + 7], ma = LG[o + 8];
    var z = far ? -29 : 14, mat = far ? M_COATF : M_COAT, part = far ? P_FFORE : P_NFORE;
    brush(z, 2, mat, part, 0.3, bias);
    if (!far) ell((sx + jx) / 2, (sy + jy) / 2, B.shoulder[0], B.shoulder[1], Math.atan2(jy - sy, jx - sx));   // 肩：沿着肩胛骨的一块肌肉
    cap(jx, jy, B.armR[0], ex, ey, B.armR[1]);                                                    // 上臂
    brush(z, 1.2, mat, part, 0.3, bias);
    cap(ex, ey, B.foreR[0], cx, cy, B.foreR[1]);                                                  // 小臂
    cap(cx, cy, B.pastR, px - Math.cos(ma) * 0.5, py - Math.sin(ma) * 0.5, B.pastR * 0.95);       // 掌骨
    drawPaw(px, py, ma, B.fpaw, far ? M_PAWF : M_PAW, z + 0.6, part, B.padY);
  }
  // 一排毛梢：从 (x0,y0) 到 (x1,y1) 均匀排 n 撮，每撮长 len、朝 ang 方向。长短和方向各不一样，但每次都一样（不会闪）
  var RND = (function () { var a = [], s = 12345; for (var i = 0; i < 64; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; a.push(s / 0x3fffffff - 1); } return a; })();
  function tufts(x0, y0, x1, y1, n, len, ang, r0, r1, seed, bell) {
    for (var i = 0; i < n; i++) {
      var u = (i + 0.5) / n, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u;
      var l = len * (bell ? 0.45 + 0.55 * Math.sin(PI * u) : 1) * (1 + 0.25 * RND[(seed + i) & 63]);
      var a = ang + 0.18 * RND[(seed + i + 17) & 63];
      cap(x, y, r0, x + Math.cos(a) * l, y + Math.sin(a) * l, r1);
    }
  }
  // 一块"贴图"里的一格：k×k 个像素
  function blk(ax, ay, di, dj, k, mat, tone) {
    for (var b = 0; b < k; b++) for (var a = 0; a < k; a++) pix(ax + di * k + a, ay + dj * k + b, mat, tone);
  }

  // 把骨架画到草稿上。F：1 脸朝右，−1 朝左
  Rig.prototype.draw = function (F) {
    var B = this.B, C = this.C, J = this.J, LG = this.LG, TL = this.TL, gold = this.kind === 'gold', ch = this.ch;
    var c = J.c, bias = C.bias, k, q, cT = J.cT, sT = J.sT, cP = J.cP, sP = J.sP;
    // 转身：不是一下子翻面。头先转过去，前半身跟上，后半身和尾巴最后；每一段在横向上压扁再反过来
    var tu = this.turnT, cH = 1, cF = 1, cR = 1;
    if (tu < 1) {
      cH = -Math.cos(PI * smooth(tu * 1.5)); cF = -Math.cos(PI * smooth(tu * 1.25 - 0.12)); cR = -Math.cos(PI * smooth(tu * 1.25 - 0.25));
      if (Math.abs(cH) < 0.14) cH = cH < 0 ? -0.14 : 0.14;
      if (Math.abs(cF) < 0.14) cF = cF < 0 ? -0.14 : 0.14;
      if (Math.abs(cR) < 0.14) cR = cR < 0 ? -0.14 : 0.14;
    }
    var fR = F * cR, fF = F * cF, fH = F * cH;
    J.fR = fR; J.fF = fF; J.fH = fH;
    var stream = clamp(this.fur, -0.6, 1.2);      // 毛梢往后飘多少

    // ================= 后半身 =================
    TS = 0; TO = 0; TC = fR;
    // 远侧后腿
    drawHind(B, LG, 3, J.HJx - B.farX, J.HJy + B.farY, true, bias);
    // 尾巴
    var N = B.tailN, r0 = B.tailR[0], r1 = B.tailR[1];
    if (gold) {
      // 尾巴下面的一排长毛（"旗子"）：中间最长，两头短；跑起来往后飘
      brush(-13, 0.4, M_CREAM, P_TAIL, 0.55, 0); sFlag = F_TUFT;
      for (q = 0; q < 9; q++) {
        var tu9 = (q + 0.6) / 9.4 * N, ti = Math.min(N - 1, Math.floor(tu9)), tf = tu9 - ti;
        var fx = TL[ti * 2] + (TL[ti * 2 + 2] - TL[ti * 2]) * tf, fy = TL[ti * 2 + 1] + (TL[ti * 2 + 3] - TL[ti * 2 + 1]) * tf;
        var ta = Math.atan2(TL[ti * 2 + 3] - TL[ti * 2 + 1], TL[ti * 2 + 2] - TL[ti * 2]);       // 这一节尾巴朝哪
        var fa = lerp(ta + PI * 0.5 + 0.45, -PI * 0.5 - 0.3, 0.45) + stream * 0.35 + 0.16 * RND[q + 3];
        var fl = 3.9 * (0.4 + 0.6 * Math.sin(PI * Math.pow((q + 0.5) / 9, 0.85))) * (1 + 0.2 * RND[q + 20]);
        cap(fx, fy - 0.3, 1.1, fx + Math.cos(fa) * fl, fy + Math.sin(fa) * fl, 0.3);
      }
    }
    brush(-12, 1, M_COAT, P_TAIL, 0.25, bias);
    for (q = 0; q < N; q++) cap(TL[q * 2], TL[q * 2 + 1], lerp(r0, r1, q / N), TL[q * 2 + 2], TL[q * 2 + 3], lerp(r0, r1, (q + 1) / N));
    if (C.points) {            // 黑棕色：尾巴根下面一小段是浅棕
      brush(-11.9, 0.2, M_TAN, P_TAIL, 0.5, 0); sOver = P_TAIL;
      cap(TL[0], TL[1] - r0 * 0.7, r0 * 0.45, TL[4], TL[5] - r0 * 0.5, r0 * 0.3);
    }
    // 骨盆
    brush(0, 3, M_COAT, P_TRUNK, 0.1, bias);
    if (C.gloss) sFlag = F_TOP;
    ell(J.Px - B.pelUp * c * sP, J.Py + B.pelUp * c * cP, B.pel[0], B.pel[1], J.thP);
    // 腰：两头分属后半身和前半身（转身时两头各转各的）
    var lo = B.loin;
    var lax = (J.Px + lo[0] * cP - lo[1] * c * sP) * fR, lay = J.Py + lo[0] * sP + lo[1] * c * cP;
    var lbx = (J.Tx + lo[3] * cT - lo[4] * c * sT) * fF, lby = J.Ty + lo[3] * sT + lo[4] * c * cT;
    TC = 1;
    cap(lax, lay, lo[2], lbx, lby, lo[5]);
    if (gold && c > 0) {      // 金毛肚子下面的一排毛
      brush(-2, 0.4, M_CREAM, P_FUR, 0.55, 0); sFlag = F_TUFT;
      tufts(lax + 1.2 * fR, lay - lo[2] + 0.5, lbx - 0.6 * fF, lby - lo[5] + 0.4, 6, 1.7, (-PI * 0.5 - 0.17 - stream * 0.3) * (fR < 0 ? -1 : 1) + (fR < 0 ? PI : 0), 0.9, 0.3, 30, true);
    }
    TC = fR;
    // 近侧后腿（金毛大腿后面有"裤子"毛）
    if (gold && c > 0) {
      var kx = LG[20], ky = LG[21], hkx = LG[22], hky = LG[23];
      brush(8, 0.4, M_CREAM, P_NHIND, 0.55, 0); sFlag = F_TUFT;
      tufts(J.HJx - B.thigh[1] * 0.9, J.HJy + 0.2, (kx + hkx) / 2 - 1.3, (ky + hky) / 2 + 0.4, 5, 2.5, -2.25 - stream * 0.3, 1.0, 0.3, 40, false);
    }
    drawHind(B, LG, 2, J.HJx, J.HJy, false, bias);

    // ================= 前半身 =================
    TC = fF;
    drawFore(B, LG, 1, J.S0x + B.farX, J.S0y + B.farY, true, bias);
    brush(0, 3, M_COAT, P_TRUNK, 0.1, bias);
    if (C.gloss) sFlag = F_TOP;
    var br = J.br * 0.25;
    ell(J.Tx - br * sT, J.Ty + br * cT, B.rib[0], B.rib[1] + br, J.thT);                                  // 胸腔（吸气时往上鼓一格）
    var wi = B.wither, cs = B.chest;
    ell(J.Tx + wi[0] * cT - (wi[1] + br * 2) * c * sT, J.Ty + wi[0] * sT + (wi[1] + br * 2) * c * cT, wi[2], wi[3], J.thT);   // 肩隆
    sFlag = 0;
    ell(J.Tx + cs[0] * cT - cs[1] * c * sT, J.Ty + cs[0] * sT + cs[1] * c * cT, cs[2], cs[3], J.thT);     // 前胸
    if (ch.belly > 0.02) {     // 翻过来：露出浅色的肚皮
      brush(3.2, 0.3, M_CREAM, P_BELLY, 0.3, 0);
      var bw_ = ch.belly;
      TC = 1;
      cap(lax, lay + lo[2] * 0.45, lo[2] * 0.5 * bw_, lbx, lby + lo[5] * 0.5, lo[5] * 0.55 * bw_);
      TC = fF;
      ell(J.Tx + 1.0 * cT, J.Ty + B.rib[1] * 0.45, B.rib[0] * 0.75 * bw_, B.rib[1] * 0.5 * bw_, J.thT);
    }
    if (gold) {
      // 胸口的浅色大毛领 + 下缘的毛梢
      var bxc = J.Tx + (cs[0] + 0.5) * cT - (cs[1] - 0.6) * c * sT, byc = J.Ty + (cs[0] + 0.5) * sT + (cs[1] - 0.6) * c * cT;
      brush(3.2, 0.4, M_CREAM, P_FUR, 0.3, 0);
      ell(bxc, byc, 2.3, 3.6, J.thT + 0.25);
      if (c > 0) {
        brush(-1, 0.4, M_CREAM, P_FUR, 0.55, 0); sFlag = F_TUFT;
        tufts(bxc + 1.6, byc - 0.5, bxc - 1.6, byc - 3.4, 5, 1.8, -1.9 - stream * 0.3, 0.9, 0.3, 50, false);
      }
    } else {
      // 腊肠：胸口一块浅色
      brush(3.2, 0.3, M_TAN, P_FUR, 0.4, 0);
      ell(J.Tx + (cs[0] + 0.55) * cT - (cs[1] - 0.9) * c * sT, J.Ty + (cs[0] + 0.55) * sT + (cs[1] - 0.9) * c * cT, 1.05, 1.5, J.thT + 0.2);
    }
    // 近侧前腿（金毛小臂后面有一排毛）
    if (gold && c > 0) {
      brush(13, 0.4, M_CREAM, P_NFORE, 0.55, 0); sFlag = F_TUFT;
      tufts(LG[2] - 0.9, LG[3] - 0.3, LG[4] - 0.8, LG[5] + 1.6, 4, 1.8, -2.0 - stream * 0.3, 0.8, 0.3, 60, false);
    }
    drawFore(B, LG, 0, J.S0x, J.S0y, false, bias);

    // ================= 脖子和头（转身时先转）=================
    TS = J.N0x; TO = J.N0x * fF; TC = fH;
    var hx = J.hx, hy = J.hy, hp = J.hp, vs = J.vs, HL = B.HL;
    var cn = Math.cos(J.neck), sn = Math.sin(J.neck), nr0 = B.neckR0, nr1 = B.neckR1;
    var nsx = J.N0x - 0.5 * cn - 0.2, nsy = J.N0y - 0.5 * sn - 0.5 * c;
    var nex = hx - 0.25 * nr1 * cn + 0.55 * nr1 * sn * vs, ney = hy - 0.25 * nr1 * sn - 0.55 * nr1 * cn * vs;
    brush(4, 3, M_COAT, P_TRUNK, 0.15, bias);
    cap(nsx, nsy, nr0, nex, ney, nr1);
    if (gold && c > 0) {       // 脖子前面的毛
      brush(3.6, 0.4, M_CREAM, P_FUR, 0.55, 0); sFlag = F_TUFT;
      tufts(nex + nr1 * 0.7 * sn + 0.6 * cn, ney - nr1 * 0.7 * cn, nsx + nr0 * 0.85 * sn + 0.5, nsy - nr0 * 0.85 * cn + 1.0, 4, 1.7, -1.35 - stream * 0.25, 0.9, 0.3, 70, false);
    }
    // 项圈：横在脖子中间，只画在脖子上；下面挂一块小牌子
    var cmx = lerp(nsx, nex, 0.56), cmy = lerp(nsy, ney, 0.56), cr = lerp(nr0, nr1, 0.56) + 0.3;
    brush(7.5, 0.3, M_COLLAR, P_COLLAR, 0.5, 0); sOver = P_TRUNK;
    cap(cmx + sn * cr, cmy - cn * cr, gold ? 0.66 : 0.55, cmx - sn * cr, cmy + cn * cr, gold ? 0.66 : 0.55);
    var tgi = PI_(cmx + sn * (cr - 0.5) * vs + 0.3), tgj = PJ_(cmy - cn * (cr - 0.5) * vs - 0.6), sk = RR === 1 ? 1 : Math.round(RR / 2);
    blk(tgi, tgj, 0, 0, sk, M_TAG, 3);
    if (RR > 1) blk(tgi, tgj, 0, 1, sk, M_TAG, 1);

    // 头：先下巴、嘴里、舌头，再头骨和吻，再鼻子、耳朵，最后点眼睛
    var ux = Math.cos(hp) * HL, uy = Math.sin(hp) * HL, vx = -Math.sin(hp) * HL * vs, vy = Math.cos(hp) * HL * vs;
    var ja = J.jaw, cj = Math.cos(ja), sj = Math.sin(ja), hg = B.hinge, jw = B.jaw, mz = B.muz, lip = B.lip;
    // 下巴绕着嘴角后面的铰链往下转
    var j0u = hg[0] + (jw[0] - hg[0]) * cj + (jw[1] - hg[1]) * sj, j0v = hg[1] - (jw[0] - hg[0]) * sj + (jw[1] - hg[1]) * cj;
    var j1u = hg[0] + (jw[3] - hg[0]) * cj + (jw[4] - hg[1]) * sj, j1v = hg[1] - (jw[3] - hg[0]) * sj + (jw[4] - hg[1]) * cj;
    brush(20, 1, M_MUZ, P_JAW, 0.3, 0);
    cap(hx + j0u * ux + j0v * vx, hy + j0u * uy + j0v * vy, jw[2] * HL, hx + j1u * ux + j1v * vx, hy + j1u * uy + j1v * vy, jw[5] * HL);
    if (ja > 0.05) {
      // 嘴里：一块暗红，夹在上唇和下巴之间
      var gap = (lip - (j1v + jw[5])) * 0.5;
      if (gap > 0.01) {
        brush(18.5, 0, M_MOUTH, P_MOUTH, 1, 0);
        var mu = (mz[3] + j1u) * 0.5 - 0.02, mv2 = (lip + j1v) * 0.5;
        cap(hx + (hg[0] + 0.2) * ux + (lip - 0.03) * vx, hy + (hg[0] + 0.2) * uy + (lip - 0.03) * vy, 0.03 * HL, hx + mu * ux + mv2 * vx, hy + mu * uy + mv2 * vy, Math.min(gap + 0.02, 0.12) * HL);
      }
    }
    if (J.tongue > 0.05) {
      // 舌头：贴着下巴伸出来，舌尖往下搭；喘气时舌尖一上一下
      var tg = Math.min(1.5, J.tongue), tr = (gold ? 0.062 : 0.05) * HL;
      var t0u = hg[0] + (0.56 - hg[0]) * cj + (jw[1] + 0.045 - hg[1]) * sj, t0v = hg[1] - (0.56 - hg[0]) * sj + (jw[1] + 0.045 - hg[1]) * cj;
      var tlen = 0.30 + 0.12 * tg, t1u = t0u + tlen * cj, t1v = t0v - tlen * sj;
      brush(21, 0.8, M_TONGUE, P_TONGUE, 0.4, 0.1);
      var t0x = hx + t0u * ux + t0v * vx, t0y = hy + t0u * uy + t0v * vy, t1x = hx + t1u * ux + t1v * vx, t1y = hy + t1u * uy + t1v * vy;
      cap(t0x, t0y, tr, t1x, t1y, tr);
      if (J.lick > 0.3) cap(t1x, t1y, tr, t1x + (ux * 0.16 + vx * 0.12) * tg, t1y + (uy * 0.16 + vy * 0.12) * tg, tr * 0.8);       // 舔：舌尖往前上方卷
      else cap(t1x, t1y, tr, t1x + ux * 0.03, t1y - (0.10 + 0.07 * tg) * HL - (J.pantStep ? 0.5 / RR : 0), tr * 0.85);            // 舌尖耷拉下来
    }
    // 头骨 + 上吻（同一个部位，中间没有接缝）
    var sk_ = B.skull;
    brush(22, 2, M_COAT, P_HEAD, 0.15, bias);
    ell(hx + sk_[0] * ux + sk_[1] * vx, hy + sk_[0] * uy + sk_[1] * vy, sk_[2] * HL, sk_[3] * HL, hp);
    var sp_ = B.stop;
    ell(hx + sp_[0] * ux + sp_[1] * vx, hy + sp_[0] * uy + sp_[1] * vy, sp_[2] * HL, sp_[3] * HL, hp);
    brush(22, 1.6, M_COAT, P_HEAD, 0.3, bias);
    cap(hx + mz[0] * ux + mz[1] * vx, hy + mz[0] * uy + mz[1] * vy, mz[2] * HL, hx + mz[3] * ux + mz[4] * vx, hy + mz[3] * uy + mz[4] * vy, mz[5] * HL);
    // 嘴唇一带颜色浅一点
    brush(22.5, 0.2, M_MUZ, P_HEAD, 0.5, 0); sOver = P_HEAD;
    var lv = lip + (gold ? 0.045 : 0.03), lr = (gold ? 0.05 : 0.032) * HL;
    cap(hx + (mz[0] + 0.07) * ux + lv * vx, hy + (mz[0] + 0.07) * uy + lv * vy, lr, hx + (mz[3] - 0.03) * ux + (lv + 0.012) * vx, hy + (mz[3] - 0.03) * uy + (lv + 0.012) * vy, lr * 0.9);
    // 鼻子
    var ns = B.nose, ntw = this.nose > 0 ? 0.012 : 0;
    var nox = hx + ns[0] * ux + (ns[1] + ntw) * vx, noy = hy + ns[0] * uy + (ns[1] + ntw) * vy;
    brush(25, 1, M_NOSE, P_NOSE, 0.2, 0.05);
    ell(nox, noy, ns[2] * HL, ns[2] * HL * 0.9, hp);
    // 耳朵：软的，主要顺着重力往下垂；跑起来往后飘，耳尖比耳根慢半拍
    var ea = B.earAt, eL = B.earL * HL, er0 = B.earR[0] * HL, er1 = B.earR[1] * HL;
    var ebx = hx + ea[0] * ux + (ea[1] + J.earUp * 0.03) * vx, eby = hy + ea[0] * uy + (ea[1] + J.earUp * 0.03) * vy;
    var e0 = -PI / 2 + 0.4 * hp + (B.earRest + PI / 2) * vs;
    var a1 = e0 - J.earA, a2 = e0 - J.earB, l1 = (eL - er1) * 0.55, l2 = (eL - er1) * 0.45;
    var emx = ebx + Math.cos(a1) * l1, emy = eby + Math.sin(a1) * l1, etx = emx + Math.cos(a2) * l2, ety = emy + Math.sin(a2) * l2;
    var minE = er1 + 0.1;
    if (ety < minE) ety = minE;
    if (emy < minE) emy = minE;
    brush(26, 1, M_EAR, P_EAR, 0.35, bias);
    cap(ebx, eby, er0, emx, emy, lerp(er0, er1, 0.7));
    cap(emx, emy, lerp(er0, er1, 0.7), etx, ety, er1);
    if (C.points) {            // 黑棕色：耳朵前缘一道浅棕
      brush(26.5, 0.1, M_TAN, P_EAR, 0.6, 0); sOver = P_EAR;
      cap(ebx + er0 * 0.7, eby - 0.4, 0.3, emx + er1 * 0.75, emy, 0.3);
    }

    // ---- 脸上的"贴图"：眼睛、眉毛、嘴线、鼻子上的高光。只挪整格，不跟着头旋转 ----
    var fs = TC < 0 ? -1 : 1;          // 脸朝哪边
    var uj = vs > 0 ? -1 : 1;          // 头顶朝上还是朝下（肚皮朝天时是倒着的）
    var ey_ = B.eye, exw = hx + ey_[0] * ux + ey_[1] * vx, eyw = hy + ey_[0] * uy + ey_[1] * vy;
    var ei = PI_(exw), ej = PJ_(eyw), st = J.eye, K = M_EYE;
    var bw2 = J.brow, brM = C.points ? M_TAN : M_COAT, brT = C.points ? 3 : 2;
    if (RR === 1) {
      if (st === 'shut' || st === 'sleepy') { pix(ei, ej, M_COAT, 1); pix(ei + fs, ej, M_COAT, 1); }
      else if (st === 'happy') { pix(ei - 1, ej, K, 1); pix(ei, ej + uj, K, 1); pix(ei + 1, ej, K, 1); }
      else { pix(ei, ej, K, 1); pix(ei + fs, ej, K, 1); pix(ei, ej + uj, K, 1); pix(ei + fs, ej + uj, K, 1); pix(fs > 0 ? ei : ei - 1, uj < 0 ? ej - 1 : ej, K, 5); }
    } else {
      var wide = gold ? 3 : 2, x0e = gold ? -1 : 0, n;
      // 这一格在屏幕上的列：脸朝左时左右对调
      if (st === 'shut') {
        for (n = 0; n < wide; n++) blk(ei, ej, (x0e + n) * fs, 0, sk, M_COAT, 1);
      } else if (st === 'happy') {
        blk(ei, ej, -1, 0, sk, K, 1); blk(ei, ej, 0, uj, sk, K, 1); blk(ei, ej, 1, 0, sk, K, 1);
      } else {
        var rows = st === 'sleepy' ? 1 : (st === 'wide' ? 3 : 2);
        for (var rj = 0; rj < rows; rj++) for (n = 0; n < wide; n++) blk(ei, ej, (x0e + n) * fs, rj * uj, sk, K, 1);
        if (st === 'soft') for (n = 0; n < wide; n++) blk(ei, ej, (x0e + n) * fs, uj, sk, M_COAT, 2);          // 眼皮放松：上面一行盖住
        if (st !== 'sleepy') {
          // 眼神光永远在左上角（光不跟着狗转）
          var li = fs > 0 ? x0e : -(x0e + wide - 1), tj = (rows - 1) * uj;
          blk(ei, ej, li, uj < 0 ? tj : 0, sk, K, 5);
        } else {
          for (n = 0; n < wide; n++) blk(ei, ej, (x0e + n) * fs, uj, sk, M_COAT, 2);                            // 困：上眼皮耷拉下来
        }
        if (gold && st !== 'sleepy') blk(ei, ej, 0, -uj, sk, K, 2);                                             // 下眼睑一点棕色
      }
      // 眉毛：平时在眼睛上面隔一行；抬高 = 好奇，眉头压低 = 专注，眉尾下垂 = 委屈
      var bro = (st === 'wide' ? 4 : 3) + bw2[0], b0 = gold ? 0 : 1;
      if (st !== 'happy' || C.points) {
        blk(ei, ej, b0 * fs, (bro - (bw2[1] < 0 ? 1 : 0)) * uj, sk, brM, brT);
        blk(ei, ej, (b0 + 1) * fs, (bro - (bw2[1] > 0 ? 1 : 0)) * uj, sk, brM, brT);
      }
    }
    // 嘴：闭着的时候是一条线，嘴角往上翘一格
    if (ja <= 0.05 && RR > 1) {
      var m0u = mz[3] - 0.01, m1u = mz[0] + 0.1, mvv = lip + 0.005;
      seg(hx + m0u * ux + mvv * vx, hy + m0u * uy + mvv * vy, hx + m1u * ux + mvv * vx, hy + m1u * uy + mvv * vy, M_COAT, 1);
      var mci = PI_(hx + (m1u - 0.035) * ux + mvv * vx), mcj = PJ_(hy + (m1u - 0.035) * uy + mvv * vy);
      pix(mci, mcj + uj, M_COAT, 1);
      if (J.smile) pix(mci - fs, mcj + uj * 2, M_COAT, 1);
    }
    // 鼻子上的一点湿润的高光
    if (RR > 1) pix(PI_(nox) - 1, PJ_(noy) - 1, M_NOSE, 5);
    // 黑棕色：嘴边的浅棕已经画过了；再加四只爪子（爪子的材质本来就是浅棕）

    // 短毛的反光：背上的亮线在肩和胯的位置断开（不然就成了一条从头到尾的亮边）
    J.gapA = PI_((J.Lx - 1.0) * 1) ; J.gapB = PI_(J.Tx + B.wither[0] - 1.5);
  };

  // 画出来。faceLeft：脸朝左；R：一个世界单位画成几个像素（默认 1）；
  // sub（可以不给）：0..1，身体在像素格子里往右挪不到一格的零头 —— 引擎如果把"画在哪"的小数部分传进来，
  // 踩在地上的脚就能一个像素都不抖。
  Rig.prototype.render = function (faceLeft, R, sub) {
    R = Math.round(+R) || 1;
    if (R < 1) R = 1; else if (R > 4) R = 4;
    var o = this.outs[R];
    if (!o) {
      var data = new Uint8ClampedArray(W * R * H * R * 4);
      o = this.outs[R] = {
        w: W * R, h: H * R, data: data, d32: new Uint32Array(data.buffer), scale: R, ox: OX * R, oy: GY * R, key: null, ver: 0,
        box: [0, 0, -1, -1], mouth: [0, 0], nose: [0, 0], back: [0, 0], seat: [0, 0], headX: 0, headY: 0, top: 0, half: 0,
      };
    }
    this.out = o;
    var F = faceLeft ? -1 : 1;
    if (this.lastFace && this.lastFace !== F && this.turnT > 0.5) this.turnT = 0;     // 没人告诉我们"转身了"：自己发现
    this.lastFace = F;
    var J = this.solve(F);
    useScratch(R);
    sub = +sub || 0;
    X0 = OX + sub / R; Y0 = GY;
    this.draw(F);
    // 擦掉上一帧
    var b = o.box, d32 = o.d32, w = o.w, j;
    for (j = b[1]; j <= b[3]; j++) d32.fill(0, j * w + b[0], j * w + b[2] + 1);
    finish(d32, this.pal, this.C, b);
    // 锚点：世界单位；dx 已经按朝向翻好了
    var fF = J.fF, fH = J.fH, nx0 = J.N0x * fF, B = this.B;
    o.mouth[0] = nx0 + (J.mouthX - J.N0x) * fH; o.mouth[1] = J.mouthY;
    o.nose[0] = nx0 + (J.noseX - J.N0x) * fH; o.nose[1] = J.noseY;
    o.headX = nx0 + (J.headX - J.N0x) * fH; o.headY = J.headY;
    o.back[0] = J.backX * fF; o.back[1] = J.backY;
    o.seat[0] = (J.Tx + J.Px) / 2 * fF; o.seat[1] = (J.Ty + J.Py) / 2 + (B.seat[1] - B.T0[1]) * (J.c > 0 ? 1 : 0.4);
    o.top = b[3] >= b[1] ? GY - b[1] / R : 0;
    o.half = METRICS[this.kind].half;
    o.ox = OX * R + sub;
    o.ver++;
    return o;
  };

  // 给检查步态的工具用：四只脚掌现在在哪（身体坐标）、是不是踩在地上、一共走了多远
  Rig.prototype.probe = function () {
    var J = this.solve(this.lastFace || 1), LG = this.LG, feet = [];
    for (var k = 0; k < 4; k++) feet.push({ x: LG[k * 10 + 6], y: LG[k * 10 + 7] - (k & 1 ? this.B.farY : 0), down: this.legs[k].down && this.moving, reach: LG[k * 10 + 9], u: this.legs[k].u });
    return { S: this.S, phase: this.phase, feet: feet, f: this.fq, stride: this.lam, gait: this.gb, G: this.G, J: J };
  };

  // 每种狗有多大（世界单位）：鼻尖到尾巴尖、站着时头顶的高度、半个身长（碰撞用）、嘴离身体中心多远
  var METRICS = {
    gold: { length: 45, height: 24, half: 22.5, mouthReach: 20 },
    dax:  { length: 39, height: 15, half: 19.5, mouthReach: 18 },
  };

  root.PET_DOGS = {
    create: function (kind, coat, seed) { return new Rig(kind, coat, seed); },
    POSES: POSES, MOODS: Object.keys(MOODS).filter(function (m) { return m !== 'none'; }),
    COATS: COATS, BREED: BREED, METRICS: METRICS,
    W: W, H: H, OX: OX, GY: GY,
  };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
