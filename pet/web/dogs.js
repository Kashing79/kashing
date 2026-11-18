// 小狗的"骨架 + 渲染器"
//
// 不是一帧一帧画死的图：每一帧都按当前的姿势，把身体、腿、头、耳朵、尾巴现算现画成像素。
// 所以尾巴怎么摇、耳朵怎么甩、怎么呼吸、怎么迈步，都是连续的，姿势之间也会平滑过渡。
//
// 用法：
//   var rig = PET_DOGS.create('gold' | 'dax', 毛色名);
//   rig.update(dt, { pose, speed, air, wag, pant, look, carry, ... });
//   var img = rig.render(faceLeft);   // { data, w, h, ox, oy, box, mouth, top, back }
(function (root) {
  'use strict';

  var W = 84, H = 56;          // 每只狗自己的小画布
  var OX = 44, GY = 50;        // 原点：身体中心正下方的地面，在画布里的位置

  function rgb(h) {
    h = h.replace('#', '');
    return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
  }
  var INK = rgb('#2a1f2d');
  var WHITE = [255, 255, 255];

  // ------------------------------------------------------------
  //  毛色。每种"材质"是 [亮, 中, 暗, 交界线]
  // ------------------------------------------------------------
  function M(a, b, c, r) { return [rgb(a), rgb(b), rgb(c), rgb(r || c)]; }
  var COATS = {
    gold: {
      coat: M('#f8d889', '#e8b04f', '#c58a2f', '#a56f22'),
      far: M('#d79b3c', '#c0862c', '#9c6920', '#855618'),
      cream: M('#fff2cf', '#fbe3a8', '#eecb82', '#d9ae5f'),
      ear: M('#d9a044', '#c98b30', '#a87024', '#8f5d1c'),
      muzzle: M('#fdebc0', '#f6d896', '#e3b96a', '#c99a48'),
      nose: rgb('#2f2226'), eye: rgb('#2a1f2d'), tongue: M('#ff9fb0', '#f27f95', '#d9627b'),
      collar: M('#e8564f', '#d2443f', '#a82f2c'), tag: rgb('#ffd24a'), mouth: rgb('#7a3b36'),
    },
    dax_red: {
      coat: M('#dc915a', '#bb6730', '#93481c', '#743514'),
      far: M('#9c4f20', '#8a421a', '#6b3012', '#57260d'),
      cream: M('#eebd8a', '#dfa063', '#c58248', '#a96a35'),
      ear: M('#8a441c', '#783816', '#5c2a10', '#47200b'),
      muzzle: M('#e0a36a', '#cd8648', '#aa6832', '#8d5324'),
      nose: rgb('#2a1c1e'), eye: rgb('#2a1f2d'), tongue: M('#ff9fb0', '#f27f95', '#d9627b'),
      collar: M('#5a97ec', '#3f7fd8', '#2c5fa8'), tag: rgb('#ffd24a'), mouth: rgb('#5e2a22'),
    },
    dax_blacktan: {
      coat: M('#5a5158', '#3f373c', '#2c2529', '#1f1a1d'),
      far: M('#332c30', '#2a2428', '#1d181b', '#141012'),
      cream: M('#e4ad70', '#cf9150', '#b07638', '#8f5d2a'),
      ear: M('#3a3237', '#2c2529', '#1f1a1d', '#141012'),
      muzzle: M('#e4ad70', '#cf9150', '#b07638', '#8f5d2a'),
      nose: rgb('#17110f'), eye: rgb('#120d10'), tongue: M('#ff9fb0', '#f27f95', '#d9627b'),
      collar: M('#f06a62', '#d94a44', '#a8322e'), tag: rgb('#ffd24a'), mouth: rgb('#3a1c18'),
    },
    dax_cream: {
      coat: M('#fbe7bf', '#eccb94', '#cfa869', '#b38a4d'),
      far: M('#d6b074', '#c59d62', '#a47f48', '#8a6838'),
      cream: M('#fff6df', '#f9e8c2', '#e6cc99', '#cfae74'),
      ear: M('#d9b074', '#c69a5c', '#a57c44', '#8a6434'),
      muzzle: M('#fff3d6', '#f6e0b0', '#e0c184', '#c7a362'),
      nose: rgb('#3a2a26'), eye: rgb('#2a1f2d'), tongue: M('#ff9fb0', '#f27f95', '#d9627b'),
      collar: M('#5a97ec', '#3f7fd8', '#2c5fa8'), tag: rgb('#ffd24a'), mouth: rgb('#7a4a3a'),
    },
  };

  // ------------------------------------------------------------
  //  体型
  // ------------------------------------------------------------
  var BREED = {
    gold: {
      L: 12.5, rC: 5.7, rH: 4.9, leg: 11, up: 5.7, low: 5.8, legR: 1.4, thigh: 2.6, pawR: 1.7, farX: 2.3, jk: 0.38,
      neck: 5.4, neckR0: 4.3, neckR1: 3.6, headR: 4.9, snout: 4.5, snoutR: 2.65,
      earL: 4.9, earR0: 1.7, earR1: 2.2, earX: -0.62, earY: 0.42, earA: 0.28,
      eyeX: 0.34, eyeY: 0.14, tailL: 13.5, tailR: 1.45, tailN: 5,
      trot: 21, gallop: 36, swing: 3.6, lift: 2.5, bob: 0.6,
    },
    dax: {
      L: 14.5, rC: 3.9, rH: 3.3, leg: 4.7, up: 2.45, low: 2.6, legR: 1.1, thigh: 1.6, pawR: 1.35, farX: 1.6, jk: 0.6,
      neck: 4.0, neckR0: 2.9, neckR1: 2.5, headR: 3.5, snout: 5.0, snoutR: 1.55,
      earL: 5.2, earR0: 1.2, earR1: 1.85, earX: -0.55, earY: 0.5, earA: 0.3,
      eyeX: 0.38, eyeY: 0.2, tailL: 8.5, tailR: 0.75, tailN: 5,
      trot: 8.5, gallop: 14, swing: 1.8, lift: 1.1, bob: 0.3,
    },
  };

  // ------------------------------------------------------------
  //  像素画布和几种基本形状
  // ------------------------------------------------------------
  function Buf() {
    this.c = new Uint8ClampedArray(W * H * 4);
    this.m = new Uint8Array(W * H);
  }
  Buf.prototype.clear = function () { this.c.fill(0); this.m.fill(0); };
  function put(b, i, j, col) {
    if (i < 0 || j < 0 || i >= W || j >= H) return;
    var k = j * W + i, o = k * 4;
    b.c[o] = col[0]; b.c[o + 1] = col[1]; b.c[o + 2] = col[2]; b.c[o + 3] = 255;
    b.m[k] = 1;
  }
  // 世界坐标（x 向前，y 向上）里的一个像素
  function dot(b, x, y, col) { put(b, Math.floor(x + OX), Math.floor(GY - y), col); }

  // 一头粗一头细的"胶囊"。光从左上方来：上缘亮、下缘暗。rim = 压在别的部位上时描一圈交界线
  function cap(b, x0, y0, r0, x1, y1, r1, mat, opt) {
    opt = opt || {};
    var hi = opt.hi === undefined ? 0.42 : opt.hi, lo = opt.lo === undefined ? -0.36 : opt.lo;
    var rim = opt.rim ? 1.0 : 0;
    var rmax = Math.max(r0, r1) + rim + 1;
    var i0 = Math.max(0, Math.floor(Math.min(x0, x1) - rmax + OX)), i1 = Math.min(W - 1, Math.ceil(Math.max(x0, x1) + rmax + OX));
    var j0 = Math.max(0, Math.floor(GY - Math.max(y0, y1) - rmax)), j1 = Math.min(H - 1, Math.ceil(GY - Math.min(y0, y1) + rmax));
    var dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy;
    for (var j = j0; j <= j1; j++) {
      for (var i = i0; i <= i1; i++) {
        var px = i + 0.5 - OX, py = GY - (j + 0.5);
        var t = L2 > 1e-6 ? ((px - x0) * dx + (py - y0) * dy) / L2 : 0;
        t = t < 0 ? 0 : (t > 1 ? 1 : t);
        var ex = px - (x0 + dx * t), ey = py - (y0 + dy * t), r = r0 + (r1 - r0) * t;
        var d = Math.sqrt(ex * ex + ey * ey);
        if (d <= r) {
          var s = d > 1e-3 ? ((ey * 0.92 - ex * 0.38) / d) * (d / r) : 0;
          put(b, i, j, s > hi ? mat[0] : (s < lo ? mat[2] : mat[1]));
        } else if (rim && d <= r + rim && b.m[j * W + i]) {
          var o = (j * W + i) * 4;
          b.c[o] = mat[3][0]; b.c[o + 1] = mat[3][1]; b.c[o + 2] = mat[3][2];
        }
      }
    }
  }
  // 椭圆（可以转一个角度）
  function ell(b, cx, cy, rx, ry, rot, mat, opt) {
    opt = opt || {};
    var hi = opt.hi === undefined ? 0.42 : opt.hi, lo = opt.lo === undefined ? -0.36 : opt.lo;
    var rim = opt.rim ? 1.0 : 0;
    var rmax = Math.max(rx, ry) + rim + 1, cs = Math.cos(rot || 0), sn = Math.sin(rot || 0);
    var i0 = Math.max(0, Math.floor(cx - rmax + OX)), i1 = Math.min(W - 1, Math.ceil(cx + rmax + OX));
    var j0 = Math.max(0, Math.floor(GY - cy - rmax)), j1 = Math.min(H - 1, Math.ceil(GY - cy + rmax));
    for (var j = j0; j <= j1; j++) {
      for (var i = i0; i <= i1; i++) {
        var px = i + 0.5 - OX - cx, py = GY - (j + 0.5) - cy;
        var u = (px * cs + py * sn) / rx, v = (-px * sn + py * cs) / ry;
        var q = Math.sqrt(u * u + v * v);
        if (q <= 1) {
          var nx = u * cs - v * sn, ny = u * sn + v * cs;
          var s = (ny * 0.92 - nx * 0.38);
          put(b, i, j, s > hi ? mat[0] : (s < lo ? mat[2] : mat[1]));
        } else if (rim) {
          var u2 = (px * cs + py * sn) / (rx + rim), v2 = (-px * sn + py * cs) / (ry + rim);
          if (u2 * u2 + v2 * v2 <= 1 && b.m[j * W + i]) {
            var o = (j * W + i) * 4;
            b.c[o] = mat[3][0]; b.c[o + 1] = mat[3][1]; b.c[o + 2] = mat[3][2];
          }
        }
      }
    }
  }

  // 两节腿：已知关节 J 和脚 F，求膝盖 K。bend = +1 膝盖朝前，-1 朝后
  function knee(Jx, Jy, Fx, Fy, a, c, bend) {
    var dx = Fx - Jx, dy = Fy - Jy, d = Math.sqrt(dx * dx + dy * dy);
    var dmax = a + c - 0.02, dmin = Math.abs(a - c) + 0.02;
    if (d > dmax) { Fx = Jx + dx / d * dmax; Fy = Jy + dy / d * dmax; d = dmax; }
    if (d < dmin) d = dmin;
    var A = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - c * c) / (2 * a * d))));
    var base = Math.atan2(Fy - Jy, Fx - Jx);
    var ang = base + A * bend;
    return [Jx + a * Math.cos(ang), Jy + a * Math.sin(ang), Fx, Fy];
  }

  // ------------------------------------------------------------
  //  各种姿势（目标值；实际画的时候会从当前姿势平滑过渡过去）
  //  脚的位置：[相对关节的前后偏移, 离地高度]
  // ------------------------------------------------------------
  function basePose(B) {
    return {
      hy: B.leg + B.jk * B.rH, cy: B.leg + B.jk * B.rC,
      neck: 1.02, head: -0.1, tail: 0.3, curl: 0.25, ear: 0,
      mouth: 0, tongue: 0, back: 0,
      fnx: 0.3, fny: 0, ffx: 0.9, ffy: 0, hnx: -1.2, hny: 0, hfx: -0.2, hfy: 0,
    };
  }
  function poseOf(B, name, kind) {
    var P = basePose(B), g = kind === 'gold';
    switch (name) {
      case 'alert':
        P.neck = 1.2; P.head = -0.05; P.tail = 0.75; P.ear = -0.1;
        break;
      case 'sit':
        P.hy = 0.94 * B.rH; P.neck = 1.2; P.head = -0.1; P.tail = -0.05; P.curl = 0.05;
        P.hnx = g ? 3.2 : 2.6; P.hfx = g ? 2.6 : 2.2; P.fnx = 0.6; P.ffx = 0.2;
        break;
      case 'paw':
        P.hy = 0.94 * B.rH; P.neck = 1.2; P.head = -0.02; P.tail = 0.1; P.curl = 0.1;
        P.hnx = g ? 3.2 : 2.6; P.hfx = g ? 2.6 : 2.2; P.ffx = 0.2;
        P.fnx = B.leg * 0.72; P.fny = P.cy - 0.55 * B.rC;
        break;
      case 'scratch':
        P.hy = 0.94 * B.rH; P.neck = 1.0; P.head = -0.45; P.tail = -0.05; P.curl = 0.05; P.ear = 0.3;
        P.hfx = g ? 2.6 : 2.2; P.fnx = 0.6; P.ffx = 0.2;
        P.hnx = B.L * 0.62; P.hny = P.cy + B.rC * 0.2;
        break;
      case 'lie':
        P.hy = 0.9 * B.rH; P.cy = 0.92 * B.rC; P.neck = 0.82; P.head = -0.05; P.tail = -0.12; P.curl = 0;
        P.fnx = B.leg * 0.98; P.fny = 0.7; P.ffx = B.leg * 0.8; P.ffy = 0.7;
        P.hnx = B.leg * 0.62; P.hny = 0.6; P.hfx = B.leg * 0.5; P.hfy = 0.6;
        break;
      case 'sleep':
        P.hy = 0.88 * B.rH; P.cy = 0.9 * B.rC; P.neck = g ? -0.05 : 0.02; P.head = -0.18; P.tail = -0.2; P.curl = -0.05; P.ear = 0.5;
        P.fnx = B.leg * 0.98; P.fny = 0.7; P.ffx = B.leg * 0.8; P.ffy = 0.7;
        P.hnx = B.leg * 0.62; P.hny = 0.6; P.hfx = B.leg * 0.5; P.hfy = 0.6;
        break;
      case 'bow':
        P.cy = 0.98 * B.rC + 0.5; P.neck = 0.42; P.head = 0.3; P.tail = 1.05; P.curl = 0.35;
        P.fnx = B.leg * 0.95; P.fny = 0.6; P.ffx = B.leg * 0.75; P.ffy = 0.6;
        break;
      case 'dig':
        P.cy = 0.98 * B.rC + (g ? 2.2 : 0.9); P.neck = -0.25; P.head = -0.7; P.tail = 0.95; P.curl = 0.3;
        P.fnx = B.leg * 0.7; P.fny = 0.4; P.ffx = B.leg * 0.5; P.ffy = 0.4;
        break;
      case 'beg':
        P.hy = 0.96 * B.rH; P.cy = P.hy + B.L * (g ? 0.9 : 0.93); P.neck = 1.25; P.head = 0.05; P.tail = -0.1; P.curl = 0;
        P.hnx = 2.0; P.hfx = 1.4;
        P.fnx = B.rC * 0.95 + 0.6; P.fny = P.cy - B.rC * 0.25; P.ffx = B.rC * 0.7 + 0.6; P.ffy = P.cy - B.rC * 0.7;
        break;
      case 'roll':
        P.back = 1; P.hy = 0.92 * B.rH; P.cy = 0.92 * B.rC; P.neck = 0.2; P.head = 0.6; P.tail = 0.05; P.curl = 0.1; P.ear = 0.2;
        P.mouth = 0.8; P.tongue = 0.9;
        P.fnx = 1.8; P.fny = P.cy + B.leg * 0.8; P.ffx = -0.6; P.ffy = P.cy + B.leg * 0.72;
        P.hnx = -1.6; P.hny = P.hy + B.leg * 0.8; P.hfx = 0.8; P.hfy = P.hy + B.leg * 0.72;
        break;
      case 'sniff':
        P.cy -= g ? 1.6 : 0.5; P.neck = g ? -0.85 : -0.5; P.head = g ? -0.95 : -0.85; P.tail = 0.55; P.ear = 0.05;
        break;
      case 'tug':
        P.cy -= B.leg * 0.3; P.hy += 0.4; P.neck = 0.25; P.head = -0.02; P.tail = 0.7; P.mouth = 0.45;
        P.fnx = B.leg * 0.5; P.ffx = B.leg * 0.4; P.hnx = -B.leg * 0.3; P.hfx = -B.leg * 0.2;
        break;
      case 'lick':
        P.neck = 0.62; P.head = -0.12; P.tail = 0.8; P.mouth = 0.55; P.tongue = 1.25;
        break;
      case 'air':
        P.neck = 0.75; P.head = 0.05; P.tail = 0.25; P.curl = 0; P.ear = 0.7;
        P.fnx = B.leg * 0.75; P.fny = P.cy - B.jk * B.rC - B.leg * 0.45; P.ffx = B.leg * 0.6; P.ffy = P.fny + 0.6;
        P.hnx = -B.leg * 0.85; P.hny = P.hy - B.jk * B.rH - B.leg * 0.4; P.hfx = -B.leg * 0.7; P.hfy = P.hny + 0.6;
        break;
      default: break;   // stand
    }
    return P;
  }
  var KEYS = ['hy', 'cy', 'neck', 'head', 'tail', 'curl', 'ear', 'mouth', 'tongue', 'back',
              'fnx', 'fny', 'ffx', 'ffy', 'hnx', 'hny', 'hfx', 'hfy'];

  // ------------------------------------------------------------
  //  一只狗
  // ------------------------------------------------------------
  function Rig(kind, coatName) {
    this.kind = kind;
    this.B = BREED[kind];
    this.C = COATS[coatName] || COATS[kind === 'gold' ? 'gold' : 'dax_red'];
    this.buf = new Buf();
    this.P = poseOf(this.B, 'stand', kind);   // 当前姿势
    this.pose = 'stand';
    this.t = Math.random() * 10;
    this.phase = Math.random();               // 步伐
    this.gait = 0;                            // 0 站着 … 1 在走/跑
    this.run = 0;                             // 0 小跑 … 1 飞奔
    this.wagT = Math.random() * 6;
    this.wag = 0.3;
    this.earV = 0; this.earA = 0;
    this.blink = 0; this.blinkAt = 1 + Math.random() * 3;
    this.eye = 1; this.happy = 0;
    this.pant = 0; this.carry = 0; this.look = 0; this.lookT = 0;
    this.shake = 0; this.lastSpeed = 0; this.air = 0; this.bark = 0;
    this.out = { data: this.buf.c, w: W, h: H, ox: OX, oy: GY, box: [0, 0, 0, 0], mouth: [0, 0], top: 0, back: [0, 0], nose: [0, 0] };
  }

  // in: { pose, speed(像素/秒), air(0..1 腾空), wag(0..1 兴奋度), pant, carry, look(-1..1 抬头/低头看),
  //       happy(眯眼), shake(拔河/抖动), bark }
  Rig.prototype.update = function (dt, I) {
    var B = this.B, P = this.P, kind = this.kind;
    this.t += dt;
    var name = I.air > 0.25 ? 'air' : (I.pose || 'stand');
    this.pose = name;
    var T = poseOf(B, name, kind);

    // 姿势平滑过渡
    var rate = name === 'air' ? 22 : 11;
    var k = 1 - Math.exp(-rate * dt);
    for (var n = 0; n < KEYS.length; n++) { var key = KEYS[n]; P[key] += (T[key] - P[key]) * k; }

    // 步伐
    var sp = Math.max(0, I.speed || 0);
    var gTarget = (sp > 5 && name !== 'air') ? 1 : 0;
    this.gait += (gTarget - this.gait) * (1 - Math.exp(-14 * dt));
    var fast = sp > (kind === 'gold' ? 78 : 58) ? 1 : 0;
    this.run += (fast - this.run) * (1 - Math.exp(-9 * dt));
    var stride = B.trot + (B.gallop - B.trot) * this.run;
    if (sp > 1) this.phase = (this.phase + sp * dt / stride) % 1;

    // 耳朵：跑起来往后飘，急停会往前甩一下
    var acc = (sp - this.lastSpeed) / Math.max(dt, 1e-3);
    this.lastSpeed = sp;
    var earT = Math.min(0.95, sp * 0.006) - Math.max(-0.5, Math.min(0.5, acc * 0.0009));
    this.earV += ((earT - this.earA) * 60 - this.earV * 9) * dt;
    this.earA += this.earV * dt;

    // 眨眼
    this.blinkAt -= dt;
    if (this.blinkAt <= 0) { this.blink = 0.13; this.blinkAt = 1.6 + Math.random() * 3.6; }
    if (this.blink > 0) this.blink -= dt;
    var eyeT = (name === 'sleep' || this.blink > 0) ? 0 : 1;
    this.eye += (eyeT - this.eye) * (1 - Math.exp(-30 * dt));
    this.happy += (((I.happy || name === 'roll' || name === 'scratch') ? 1 : 0) - this.happy) * (1 - Math.exp(-12 * dt));

    // 摇尾巴
    var w = I.wag === undefined ? 0.3 : I.wag;
    this.wag += (w - this.wag) * (1 - Math.exp(-6 * dt));
    this.wagT += dt * (2.2 + this.wag * 6.5);

    this.pant += ((I.pant ? 1 : 0) - this.pant) * (1 - Math.exp(-8 * dt));
    this.carry += ((I.carry ? 1 : 0) - this.carry) * (1 - Math.exp(-16 * dt));
    this.look += ((I.look || 0) - this.look) * (1 - Math.exp(-7 * dt));
    this.shake = I.shake || 0;
    this.bark += ((I.bark ? 1 : 0) - this.bark) * (1 - Math.exp(-30 * dt));
    this.air = I.air || 0;
  };

  Rig.prototype.render = function (faceLeft) {
    var b = this.buf, B = this.B, P = this.P, C = this.C, kind = this.kind, g = kind === 'gold';
    var t = this.t, G = this.gait, R = this.run, ph = this.phase * Math.PI * 2;
    b.clear();

    var onBack = P.back > 0.5;
    var sleeping = this.pose === 'sleep';
    var breath = Math.sin(t * (sleeping ? 1.5 : 2.4)) * (sleeping ? 0.38 : 0.22);
    var wagS = Math.sin(this.wagT * Math.PI * 2);
    var wagAmp = 0.12 + this.wag * 0.5;
    var jit = this.shake ? (Math.sin(t * 46) > 0 ? 0.6 : -0.6) * this.shake : 0;

    // ---- 脊柱：屁股 H、胸 C ----
    var bob = G * B.bob * (R > 0.5 ? Math.sin(ph) : Math.sin(ph * 2));
    var pitch = G * R * (g ? 1.0 : 0.55) * Math.sin(ph + 0.6);          // 飞奔时前后起伏
    var hy = P.hy + bob * 0.6 - pitch + (onBack ? 0 : breath * 0.25);
    var cy = P.cy + bob + pitch + breath;
    var dyy = cy - hy, len = B.L + G * R * (g ? 1.3 : 1.0) * Math.sin(ph - 0.9);   // 飞奔时身体一伸一缩
    var sep = Math.sqrt(Math.max(1, len * len - dyy * dyy));
    var hx = -sep / 2 + jit + (this.wag > 0.55 && !G ? wagS * 0.35 : 0), cx = sep / 2 + jit;
    var ux = (cx - hx) / len, uy = dyy / len;                           // 脊柱方向

    // ---- 关节 ----
    var jfx = cx - 0.12 * B.rC * ux, jfy = cy - B.jk * B.rC, jhx = hx + 0.02 * B.rH, jhy = hy - B.jk * B.rH;
    if (onBack) { jfy = cy + 0.3 * B.rC; jhy = hy + 0.3 * B.rH; }

    // ---- 脚 ----
    function foot(jx, baseX, baseY, off, front) {
      var x = jx + baseX, y = baseY;
      if (G > 0.01) {
        var beta = 0.5 - 0.12 * R;
        var p = ((ph / (Math.PI * 2)) + off) % 1; if (p < 0) p += 1;
        var sw = B.swing * (1 + 0.75 * R), gx, gy;
        if (p < beta) { gx = sw * (1 - 2 * p / beta); gy = 0; }
        else { var s = (p - beta) / (1 - beta); gx = sw * (-1 + 2 * s); gy = B.lift * (1 + 0.5 * R) * Math.sin(Math.PI * s); }
        x += (gx + (front ? 0.2 : -0.2) * sw) * G; y += gy * G;
      }
      return [x, y];
    }
    // 小跑：对角的腿一起；飞奔：两条后腿、两条前腿各自几乎同时
    var oFN = 0, oFF = 0.5 - 0.42 * R, oHN = 0.5 - 0.1 * R, oHF = 0 + 0.52 * R;
    var wig = onBack ? Math.sin(t * 9) * 0.9 : 0, wig2 = onBack ? Math.cos(t * 7.5) * 0.8 : 0;
    var digA = this.pose === 'dig' ? Math.sin(t * 22) : 0;
    var scr = this.pose === 'scratch' ? Math.sin(t * 30) * 1.1 : 0;
    var fn = foot(jfx, P.fnx + wig + digA * 1.6, P.fny + Math.max(0, digA) * 0.8, oFN, true);
    var ff = foot(jfx + B.farX, P.ffx - wig2 - digA * 1.6, P.ffy + Math.max(0, -digA) * 0.8, oFF, true);
    var hn = foot(jhx, P.hnx + wig2 + scr * 0.3, P.hny + scr, oHN, false);
    var hf = foot(jhx + B.farX, P.hfx - wig, P.hfy, oHF, false);

    // ---- 脖子、头 ----
    var look = this.look;
    var nAng = P.neck + look * 0.22 + G * 0.05 * Math.sin(ph * 2) - G * R * 0.25;
    var hAng = P.head + look * 0.42 + (this.bark > 0.1 ? 0.25 * this.bark : 0) + G * R * 0.1;
    var n0x = cx + 0.22 * B.rC * ux - 0.42 * B.rC * uy, n0y = cy + 0.22 * B.rC * uy + 0.42 * B.rC * ux;
    if (onBack) { n0x = cx + 0.5 * B.rC; n0y = cy - 0.05 * B.rC; }
    var hdx = n0x + B.neck * Math.cos(nAng), hdy = n0y + B.neck * Math.sin(nAng);
    if (hdy < B.headR * 0.92) hdy = B.headR * 0.92;                    // 头别钻到地里
    var hc = Math.cos(hAng), hs = Math.sin(hAng);
    function hp(x, y) { return [hdx + x * hc - y * hs, hdy + x * hs + y * hc]; }   // 头部坐标 → 世界坐标

    // ---- 尾巴 ----
    var tx = hx - 0.74 * B.rH * ux - 0.38 * B.rH * uy, ty = hy - 0.74 * B.rH * uy + 0.38 * B.rH * ux;
    if (onBack) { tx = hx - 0.9 * B.rH; ty = hy - 0.2 * B.rH; }
    var tailA = P.tail + wagS * wagAmp + G * R * -0.25, segL = B.tailL / B.tailN;
    var tail = [[tx, ty]];
    for (var q = 0; q < B.tailN; q++) {
      var a = tailA + P.curl * (q / (B.tailN - 1)) * (g ? 1.0 : 1.5) + Math.sin(this.wagT * Math.PI * 2 - q * 0.7) * wagAmp * 0.35 * q / B.tailN;
      var px = tail[q][0] - Math.cos(a) * segL, py = tail[q][1] + Math.sin(a) * segL;
      var minY = B.tailR * (g ? 1.6 : 1.0);
      if (py < minY) py = minY;
      tail.push([px, py]);
    }

    // ============ 开始画（从远到近）============
    var coat = C.coat, far = C.far, cream = C.cream;

    // 尾巴
    if (g) {
      for (q = 0; q < B.tailN; q++) {     // 下面一层浅色的饰毛
        var f0 = 1 - q / B.tailN, f1 = 1 - (q + 1) / B.tailN, bulge = Math.sin(Math.PI * (q + 0.5) / B.tailN);
        cap(b, tail[q][0], tail[q][1] - 1.3 - bulge * 0.9, 0.9 + bulge * 1.3 * f0 + 0.3,
               tail[q + 1][0], tail[q + 1][1] - 1.2 - bulge * 0.7, 0.6 + bulge * 1.1 * f1, cream, { hi: 0.75, lo: -0.3 });
      }
      for (q = 0; q < B.tailN; q++) {
        cap(b, tail[q][0], tail[q][1], B.tailR * (1 - 0.45 * q / B.tailN), tail[q + 1][0], tail[q + 1][1], B.tailR * (1 - 0.45 * (q + 1) / B.tailN), coat, { hi: 0.3 });
      }
    } else {
      for (q = 0; q < B.tailN; q++) {
        cap(b, tail[q][0], tail[q][1], B.tailR * (1 - 0.6 * q / B.tailN) + 0.25, tail[q + 1][0], tail[q + 1][1], B.tailR * (1 - 0.6 * (q + 1) / B.tailN) + 0.25, coat, { hi: 0.5, lo: -0.2 });
      }
    }

    // 一条腿：大腿 + 小腿 + 爪子
    function leg(jx, jy, F, front, mat, pawMat, nearSide) {
      var K = knee(jx, jy, F[0], F[1], B.up, B.low, front ? -1 : 1);
      var r0 = front ? B.legR * 1.25 : B.thigh;
      if (!front && nearSide && g && !onBack) {      // 金毛后腿后面的"裤子"饰毛
        cap(b, jx - 1.9, jy + 0.6, 1.5, K[0] - 2.0, K[1] + 0.8, 0.7, cream, { hi: 0.8 });
      }
      if (front && nearSide && g && !onBack) {       // 前腿后面的饰毛
        cap(b, jx - 1.2, jy - 0.4, 1.0, K[0] - 1.2, K[1] + 0.9, 0.45, cream, { hi: 0.8 });
      }
      cap(b, jx, jy, r0, K[0], K[1], B.legR * 1.05, mat, { rim: nearSide });
      cap(b, K[0], K[1], B.legR * 1.05, K[2], K[3] + B.pawR * 0.45, B.legR * 0.9, mat, {});
      var up = onBack || F[1] > 1.2;
      ell(b, K[2] + (up ? 0 : 0.55), K[3] + B.pawR * 0.5, B.pawR, B.pawR * 0.62, 0, pawMat, { hi: 0.25, lo: -0.75 });
    }
    var pawNear = g ? cream : C.cream, pawFar = far;

    // 远侧的腿
    leg(jhx + B.farX, jhy, hf, false, far, pawFar, false);
    leg(jfx + B.farX, jfy, ff, true, far, pawFar, false);

    // 身体
    cap(b, hx, hy, B.rH, cx, cy, B.rC, coat, { hi: 0.56, lo: -0.44 });
    if (g) {
      // 肚子下面的饰毛、胸口的浅色大毛领
      if (!onBack) cap(b, hx + sep * 0.28, hy - B.rH * 0.86, 0.9, cx - B.rC * 0.55, cy - B.rC * 0.92, 1.2, cream, { hi: 0.8, lo: -0.5 });
      ell(b, cx + B.rC * 0.5, cy + (onBack ? 0.3 : -0.38) * B.rC, B.rC * 0.55, B.rC * 0.7, 0.25, cream, { hi: 0.55, lo: -0.6 });
    } else {
      // 腊肠：深胸
      ell(b, cx + B.rC * 0.1, cy - B.rC * 0.22, B.rC * 0.98, B.rC * 0.95, 0, coat, { hi: 0.7, lo: -0.4 });
      ell(b, cx + B.rC * 0.62, cy + (onBack ? 0.3 : -0.42) * B.rC, 1.5, 1.8, 0.2, C.muzzle, { hi: 0.7, lo: -0.6 });
    }
    if (onBack) {   // 四脚朝天：露出浅色的肚皮
      cap(b, hx + 1, hy + B.rH * 0.35, B.rH * 0.55, cx - 1, cy + B.rC * 0.35, B.rC * 0.55, g ? cream : C.muzzle, { hi: 0.2, lo: -0.8 });
    }

    // 近侧的腿
    leg(jhx, jhy, hn, false, coat, pawNear, true);
    leg(jfx, jfy, fn, true, coat, pawNear, true);

    // 脖子
    cap(b, n0x - 0.6 * ux, n0y - 0.9, B.neckR0, hdx - 0.2, hdy - 0.4, B.neckR1, coat, { lo: -0.5 });
    // 项圈
    var ncx = n0x + (hdx - n0x) * 0.42, ncy = n0y + (hdy - n0y) * 0.42 - 0.4;
    var nl = Math.sqrt((hdx - n0x) * (hdx - n0x) + (hdy - n0y) * (hdy - n0y)) || 1;
    var pxn = -(hdy - n0y) / nl, pyn = (hdx - n0x) / nl, cr = (B.neckR0 + B.neckR1) / 2 + 0.3;
    cap(b, ncx - pxn * cr, ncy - pyn * cr, 0.72, ncx + pxn * cr, ncy + pyn * cr, 0.72, C.collar, { hi: 0.2, lo: -0.6 });
    var tgx = pxn * cr * (pyn < 0 ? 1 : -1), tgy = pyn * cr * (pyn < 0 ? 1 : -1);
    dot(b, ncx + tgx + 0.6, ncy + tgy - 0.8, C.tag);

    // 头：下巴（张嘴时）→ 舌头 → 头骨 → 吻部 → 嘴角 → 鼻子 → 耳朵 → 眼睛
    var mouth = Math.max(P.mouth, this.pant * 0.72, this.carry * 0.5, this.bark * 0.9);
    var tongue = Math.max(P.tongue, this.pant * (0.75 + 0.22 * Math.sin(t * 15)));
    if (this.pose === 'lick') tongue = 1.0 + 0.45 * Math.sin(t * 13);
    var R = B.headR, snY = -R * (g ? 0.2 : 0.14);
    var sn0 = hp(R * 0.42, snY), sn1 = hp(R * 0.5 + B.snout, snY - (g ? 0.15 : 0.35));
    var dk = [C.mouth, C.mouth, C.mouth, C.mouth];
    if (mouth > 0.06) {
      var jw0 = hp(R * 0.28, snY - B.snoutR * 0.55), ja = hAng - mouth * 0.6 - 0.1;
      var jl = B.snout * 0.92 + R * 0.2;
      var jw1 = [jw0[0] + jl * Math.cos(ja), jw0[1] + jl * Math.sin(ja)];
      // 嘴里
      cap(b, jw0[0] + 0.6, jw0[1] + 0.3, B.snoutR * 0.55, (jw1[0] + sn1[0]) / 2, (jw1[1] + sn1[1]) / 2 - 0.4, B.snoutR * 0.3, dk, {});
      cap(b, jw0[0], jw0[1], B.snoutR * 0.62, jw1[0], jw1[1], B.snoutR * 0.46, C.muzzle, { hi: 0.85, lo: -0.25 });
      if (tongue > 0.08) {
        var t0 = [jw0[0] + jl * 0.42 * Math.cos(ja + 0.15), jw0[1] + jl * 0.42 * Math.sin(ja + 0.15) + 0.5];
        var tl = B.snout * 0.5 * Math.min(1.7, tongue) + 0.8;
        var tA = ja - 0.45 * Math.min(1, tongue);
        cap(b, t0[0], t0[1], g ? 1.1 : 0.85, t0[0] + tl * Math.cos(tA), t0[1] + tl * Math.sin(tA), g ? 1.0 : 0.75, C.tongue, { hi: 0.3, lo: -0.5 });
      }
    }
    ell(b, hdx, hdy, R, R * 0.97, 0, coat, { rim: true, hi: 0.5, lo: -0.5 });
    cap(b, sn0[0], sn0[1], B.snoutR * 1.05, sn1[0], sn1[1], B.snoutR * 0.88, g ? C.muzzle : coat, { hi: 0.5, lo: -0.5 });
    if (g) {   // 金毛：脑门到鼻梁保持金色，吻部两侧是浅色
      var st0 = hp(R * 0.3, R * 0.12), st1 = hp(R * 0.5 + B.snout * 0.7, snY + B.snoutR * 0.6);
      cap(b, st0[0], st0[1], B.snoutR * 0.8, st1[0], st1[1], B.snoutR * 0.42, coat, { hi: 0.25, lo: -0.95 });
    } else {   // 腊肠：下颌是浅一点的棕色
      var mz0 = hp(R * 0.5, snY - B.snoutR * 0.45), mz1 = hp(R * 0.5 + B.snout * 0.9, snY - B.snoutR * 0.45 - 0.3);
      cap(b, mz0[0], mz0[1], B.snoutR * 0.55, mz1[0], mz1[1], B.snoutR * 0.5, C.muzzle, { hi: 0.9, lo: -0.5 });
    }
    // 嘴角（闭着嘴的时候是一条微微上翘的线）
    if (mouth <= 0.06) {
      for (var mk = 0.3; mk <= 0.86; mk += 0.14) {
        var mp0 = hp(R * 0.5 + B.snout * mk, snY - B.snoutR * (g ? 0.62 : 0.5));
        dot(b, mp0[0], mp0[1], C.mouth);
      }
      var mc = hp(R * 0.5 + B.snout * 0.2, snY - B.snoutR * (g ? 0.4 : 0.3));
      dot(b, mc[0], mc[1], C.mouth);
    }
    // 鼻子
    var ns = hp(R * 0.5 + B.snout + (g ? 0.15 : 0.25), snY + (g ? 0.7 : 0.35));
    ell(b, ns[0], ns[1], g ? 1.45 : 1.1, g ? 1.25 : 1.0, 0, [C.nose, C.nose, C.nose, C.nose], {});
    dot(b, ns[0] - 0.5, ns[1] + 0.6, g ? [104, 86, 92] : [90, 72, 76]);
    // 耳朵（软的，会甩）
    var e0 = hp(R * B.earX, R * B.earY);
    var eA = B.earA + P.ear + this.earA + G * 0.22 * Math.sin(ph * 2 + 1) + (this.shake ? Math.sin(t * 40) * 0.25 : 0);
    var e1 = [e0[0] - Math.sin(eA) * B.earL, e0[1] - Math.cos(eA) * B.earL];
    if (e1[1] < B.earR1 * 0.8) e1[1] = B.earR1 * 0.8;
    cap(b, e0[0], e0[1], B.earR0, e1[0], e1[1], B.earR1, C.ear, { rim: true, hi: 0.55, lo: -0.45 });
    // 眼睛
    var ey = hp(R * B.eyeX, R * B.eyeY);
    var exi = Math.floor(ey[0] + OX), eyj = Math.floor(GY - ey[1]);
    if (this.happy > 0.5) {          // 眯眼笑 ^
      put(b, exi - 1, eyj, C.eye); put(b, exi, eyj - 1, C.eye); put(b, exi + 1, eyj, C.eye);
    } else if (this.eye < 0.45) {    // 闭眼
      put(b, exi - 1, eyj, C.eye); put(b, exi, eyj, C.eye); if (g) put(b, exi + 1, eyj, C.eye);
    } else {
      put(b, exi, eyj, C.eye); put(b, exi, eyj - 1, C.eye);
      put(b, exi + 1, eyj, C.eye); put(b, exi + 1, eyj - 1, C.eye);
      put(b, exi, eyj - 1, WHITE);   // 眼神光
      if (g) { put(b, exi - 1, eyj - 2, C.coat[2]); put(b, exi, eyj - 2, C.coat[2]); }   // 一点眉骨的阴影
      if (!g && C === COATS.dax_blacktan) put(b, exi + 1, eyj - 3, C.cream[1]);          // 黑棕色腊肠的"眉点"
    }

    // ---- 最外面描一圈边，顺便量出包围盒 ----
    var m = b.m, c = b.c, x0 = W, y0 = H, x1 = -1, y1 = -1, i, j, idx;
    for (j = 0; j < H; j++) {
      for (i = 0; i < W; i++) {
        idx = j * W + i;
        if (m[idx] === 1) continue;
        if ((i > 0 && m[idx - 1] === 1) || (i < W - 1 && m[idx + 1] === 1) || (j > 0 && m[idx - W] === 1) || (j < H - 1 && m[idx + W] === 1)) {
          var o = idx * 4;
          c[o] = INK[0]; c[o + 1] = INK[1]; c[o + 2] = INK[2]; c[o + 3] = 255;
          m[idx] = 2;
          if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j;
        }
      }
    }
    // 面向左：整张图左右镜像
    if (faceLeft) {
      for (j = 0; j < H; j++) {
        var row = j * W * 4;
        for (i = 0; i < W / 2; i++) {
          var a4 = row + i * 4, b4 = row + (W - 1 - i) * 4, tmp;
          for (var kk = 0; kk < 4; kk++) { tmp = c[a4 + kk]; c[a4 + kk] = c[b4 + kk]; c[b4 + kk] = tmp; }
        }
      }
    }
    var O = this.out, sgn = faceLeft ? -1 : 1;
    O.box[0] = faceLeft ? W - 1 - x1 : x0; O.box[1] = y0; O.box[2] = faceLeft ? W - 1 - x0 : x1; O.box[3] = y1;
    var mp = hp(R * 0.5 + B.snout * 0.9, snY - B.snoutR * 0.7 - mouth * 0.8);
    O.mouth[0] = mp[0] * sgn; O.mouth[1] = mp[1];
    O.nose[0] = ns[0] * sgn; O.nose[1] = ns[1];
    O.top = hdy + B.headR;
    O.back[0] = ((hx + cx) / 2) * sgn; O.back[1] = (hy + cy) / 2 + (B.rH + B.rC) / 2;
    O.headX = hdx * sgn; O.headY = hdy;
    O.ox = faceLeft ? W - OX : OX;
    return O;
  };

  root.PET_DOGS = {
    create: function (kind, coat) { return new Rig(kind, coat); },
    W: W, H: H, OX: OX, GY: GY, BREED: BREED, COATS: COATS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
