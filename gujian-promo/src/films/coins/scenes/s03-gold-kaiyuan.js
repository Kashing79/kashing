// s03 — 金开元通宝微距. "A golden planet on black": the arc is the outer edge of a gold 開元通寶 seen face-on in extreme macro.
// Hugging the arc runs the raised outer rim (外郭); inside it the flat field (钱肉) falls from bright gold into deep orange gold
// like the lit side of a sphere. Sparse sand holes, the faintest concentric polishing lines, and — just rising over the bottom
// of frame, out of focus — the tops of the two door-leaves of 開 (the top character of the legend).
//
// Everything under the arc is shaded per pixel in init(): an analytic rim profile (rounded shoulder → domed top → inner wall)
// plus a micro height field (cast "orange peel", pits, nicks, the raised strokes) is lit from above and looked up in a gold
// ramp that stays saturated all the way down (shadows go red-orange, never grey). A second "sheen" layer stores how strongly
// each pixel answers a moving light; draw() reveals it through a soft window that travels along the rim.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 48;          // the camera only pushes in (zoom ≥ 1), so a small safety margin is enough
const RIM = 168;         // width of the raised outer rim, px
const EDGE = 30;         // rounded outer shoulder of the rim
const WALL = 18;         // inner wall dropping to the field
let S = null;

const sstep = (a, b, v) => { const t = L.clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const hash2 = (i, j) => {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// kicker: low on the right, red-orange (only the rounded shoulder turns far enough to see it)
const KN = Math.hypot(0.72, -0.5, 0.48), KX = 0.72 / KN, KY = -0.5 / KN, KZ = 0.48 / KN;
// key light: high above the frame, a touch to the left, leaning toward the lens
const LN = Math.hypot(-0.06, -0.75, 0.66), LX = -0.06 / LN, LY = -0.75 / LN, LZ = 0.66 / LN;
const HN = Math.hypot(LX, LY, LZ + 1), HX = LX / HN, HY = LY / HN, HZ = (LZ + 1) / HN;

/** slope of the rim profile along the inward radius (d = depth below the arc); > 0 = rising toward the coin's centre */
function macroSlope(d) {
  if (d < 0) d = 0;
  if (d < EDGE) return 0.1 + 1.5 * Math.pow(1 - d / EDGE, 1.7);
  const w0 = RIM - WALL, w1 = RIM + 6;
  if (d < w0) return L.lerp(0.1, -0.16, (d - EDGE) / (w0 - EDGE));
  if (d < w1) { const t = (d - w0) / (w1 - w0), s = Math.sin(Math.PI * t); return -0.16 * (1 - t) - 1.4 * s * s; }
  return 0;
}

/** piecewise-smooth 1D curve through [[x, v], …] */
function curve(pts) {
  return (x) => {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) return L.lerp(pts[i - 1][1], pts[i][1], sstep(pts[i - 1][0], pts[i][0], x));
    return pts[pts.length - 1][1];
  };
}

// the tops of 開: the two leaves of 門 (丨 + ㇕ on the left, 丨 + ㇆ on the right). Only their upper ~100 px ever enter the frame.
const GLY = { yT: 1010, sw: 66, A: 400, G: 46, GH: 11, GE: 17 };
function glyphBoxes(cx) {
  const { yT, sw, A, G } = GLY, hw = sw * 0.8, far = H + PAD + 300;
  return [
    [cx - A, yT - 4, cx - A + sw, far], [cx - A, yT, cx - G, yT + hw], [cx - G - sw * 0.94, yT, cx - G, yT + 236], [cx - A, yT + 150, cx - G, yT + 150 + hw * 0.85],
    [cx + G, yT - 3, cx + G + sw * 0.94, yT + 236], [cx + G, yT, cx + A, yT + hw], [cx + A - sw, yT, cx + A, far], [cx + G, yT + 150, cx + A, yT + 150 + hw * 0.85],
  ];
}

function buildCoin(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const X0 = -PAD, Y0 = Math.floor(a.crestY) - 3;
  const RW = W + PAD * 2, RH = H + PAD - Y0, N = RW * RH;
  const nA = L.makeNoise('c03a'), nB = L.makeNoise('c03b');

  // gold ramp, indexed by intensity 0 … 1.5
  const IMAX = 1.5, NL = 1024;
  const rampFn = L.makeRamp([[0, '#070100'], [0.07, '#300802'], [0.15, '#681a04'], [0.25, '#96380a'], [0.4, '#b5610c'], [0.54, '#dc7e10'],
    [0.7, '#f2a51e'], [0.84, '#ffc23c'], [1.0, '#ffd76a'], [1.16, '#ffe088'], [1.32, '#ffe9a6'], [1.5, '#fff3c8']].map(([t, c]) => [t / IMAX, c]));
  const RAMP = new Float32Array(NL * 3);
  for (let i = 0; i < NL; i++) { const c = rampFn(i / (NL - 1)); RAMP[i * 3] = c[0]; RAMP[i * 3 + 1] = c[1]; RAMP[i * 3 + 2] = c[2]; }

  // "planet" falloff: brightest on the rim, deepening toward the bottom of frame
  const fd = curve([[0, 1.3], [90, 1.27], [RIM, 1.17], [240, 1.05], [340, 0.83], [450, 0.63], [540, 0.5], [720, 0.4]]);
  const FD = new Float32Array(800); for (let i = 0; i < 800; i++) FD[i] = fd(i);
  // the cast rim's inner edge is never a perfect circle
  const UM = 1500, WOB = new Float32Array(UM * 2 + 1);
  for (let i = 0; i <= UM * 2; i++) { const u = i - UM; WOB[i] = 1.5 * nA.n2(u / 190, 1.7) + 0.45 * nB.n2(u / 47, 5.1); }
  // slow unevenness of the metal on a coarse grid
  const CS = 6, cw = Math.ceil(RW / CS) + 2, ch = Math.ceil(RH / CS) + 2, cMed = new Float32Array(cw * ch);
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const ddx = X0 + i * CS - cx, ddy = cy - (Y0 + j * CS), rr = Math.hypot(ddx, ddy);
    const uu = Math.atan2(ddx, ddy) * R, dq = R - rr;
    cMed[j * cw + i] = nA.fbm(uu / 330 + 11, dq / 210 - 4, 3) + 0.55 * nB.fbm(uu / 90 - 5, dq / 70 + 8, 2) + 0.35 * nB.n2(uu / 2600 + 2, dq / 34);
  }
  const bil = (src, i, j) => {
    const fx = i / CS, fy = j / CS, i0 = fx | 0, j0 = fy | 0, tx = fx - i0, ty = fy - j0, k = j0 * cw + i0;
    const a0 = src[k], a1 = src[k + 1], b0 = src[k + cw], b1 = src[k + cw + 1];
    return (a0 + (a1 - a0) * tx) * (1 - ty) + (b0 + (b1 - b0) * tx) * ty;
  };

  // 1) polar coordinates + micro height field
  const Dd = new Float32Array(N), Uu = new Float32Array(N), Hh = new Float32Array(N), St = new Float32Array(N), Cv = new Float32Array(N), Gh = new Float32Array(N);
  for (let j = 0; j < RH; j++) {
    const ddy = cy - (Y0 + j);
    for (let i = 0; i < RW; i++) {
      const k = j * RW + i, ddx = X0 + i - cx, rr = Math.sqrt(ddx * ddx + ddy * ddy), d = R - rr;
      Dd[k] = d;
      if (d < -1.5) continue;
      const u = Math.atan2(ddx, ddy) * R; Uu[k] = u;
      // cast skin ("orange peel"): quieter on the rim, which handling has burnished
      const onRim = 1 - sstep(RIM - 30, RIM + 10, d);
      const peel = 0.55 * nA.n2(u / 13, d / 13) + 0.3 * nB.n2(u / 5.2 + 40, d / 5.2) + 0.3 * nB.n2(u / 41 - 8, d / 41 + 3);
      Hh[k] = peel * L.lerp(0.17, 0.09, onRim);
      // concentric polishing lines: long along the arc, a pixel or two across
      St[k] = 0.6 * nB.n2(u / 560 + 9, d / 1.9) + 0.4 * nA.n2(u / 1500 - 3, d / 4.9 + 70);
    }
  }

  // 2) sand holes (砂眼) and tiny knocks
  const r = L.rng('c03pits');
  const toPx = (u, d) => { const th = u / R, rr = R - d; return [cx + rr * Math.sin(th) - X0, cy - rr * Math.cos(th) - Y0]; };
  const stamp = (px, py, rx, ry, ang, depth, cavK, pw) => {
    const e = Math.ceil(Math.max(rx, ry)) + 2, ca = Math.cos(ang), sa = Math.sin(ang);
    for (let j = Math.max(1, Math.floor(py - e)); j <= Math.min(RH - 2, Math.ceil(py + e)); j++) {
      for (let i = Math.max(1, Math.floor(px - e)); i <= Math.min(RW - 2, Math.ceil(px + e)); i++) {
        const k = j * RW + i; if (Dd[k] < 2) continue;
        const dx = i - px, dy = j - py, lx = (dx * ca + dy * sa) / rx, ly = (-dx * sa + dy * ca) / ry, d2 = lx * lx + ly * ly;
        if (d2 >= 1) continue;
        const f = Math.pow(1 - d2, pw);
        Hh[k] -= depth * f; Cv[k] = Math.max(Cv[k], Math.min(1, f * cavK));
      }
    }
  };
  const pits = [];
  for (let n = 0; n < 58; n++) pits.push([r.range(-1090, 1090), 14 + Math.pow(r(), 0.9) * 540, r.chance(0.13) ? r.range(4.6, 7.6) : r.range(1.3, 3.5)]);
  for (const [cu, cd] of [[-610, 318], [352, 246], [760, 402]]) for (let n = 0; n < 6; n++) pits.push([cu + r.gauss() * 26, cd + r.gauss() * 17, r.range(1.1, 2.6)]);
  pits.push([214, 338, 9.5], [-388, 246, 7]);
  for (const [u0, d0, rp] of pits) {
    if (Math.abs(d0 - RIM) < 16) continue;                     // keep the rim's inner wall clean
    const [px, py] = toPx(u0, d0), ell = r.range(0.8, 1.15);
    stamp(px, py, rp, rp * ell, r.range(0, Math.PI), rp * r.range(0.55, 0.95), 2.1, 1.4);
  }
  for (let n = 0; n < 6; n++) {                                // knocks: short, shallow dents
    const [px, py] = toPx(r.range(-1000, 1000), r.chance(0.35) ? r.range(40, RIM - 40) : r.range(RIM + 40, 500));
    stamp(px, py, r.range(5, 11), r.range(1.8, 3.2), r.range(0, Math.PI), r.range(1.0, 1.8), 0.45, 1.2);
  }
  for (let n = 0; n < 22; n++) {                               // pin-head casting beads (raised)
    const [px, py] = toPx(r.range(-1080, 1080), 20 + r() * 520), rb = r.range(1.2, 2.4);
    stamp(px, py, rb, rb, 0, -rb * 0.55, 0, 1.2);
  }

  // 3) the raised strokes at the bottom of frame
  const boxes = glyphBoxes(cx), { GH, GE } = GLY, RC = 17;
  const j0g = Math.max(0, GLY.yT - 40 - Y0);
  for (let j = j0g; j < RH; j++) {
    const y = Y0 + j;
    for (let i = 0; i < RW; i++) {
      const x = X0 + i;
      if (x < cx - GLY.A - 30 || x > cx + GLY.A + 30) continue;
      let sd = 1e9;
      for (const b of boxes) {
        const mx = (b[0] + b[2]) / 2, my = (b[1] + b[3]) / 2;
        const qx = Math.abs(x - mx) - ((b[2] - b[0]) / 2 - RC), qy = Math.abs(y - my) - ((b[3] - b[1]) / 2 - RC);
        const s = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - RC;
        if (s < sd) sd = s;
      }
      if (sd > 6) continue;
      sd += 3.2 * nA.n2(x / 120 + 3, y / 120) + 2.0 * nA.n2(x / 44 - 7, y / 44) + 0.8 * nB.n2(x / 15, y / 15 + 9);
      const t = L.clamp(-sd / GE);
      const gh = t * t * (3 - 2 * t);
      Hh[j * RW + i] += GH * gh; Gh[j * RW + i] = gh;
    }
  }

  // 4) shade → base colour + "sheen" (response to the travelling light)
  const img = new ImageData(RW, RH), d8 = img.data, sim = new ImageData(RW, RH), s8 = sim.data;
  const U0 = -140, SIG = 1650;
  for (let j = 0; j < RH; j++) {
    const ddy = cy - (Y0 + j), jm = j > 0 ? -RW : 0, jp = j < RH - 1 ? RW : 0;
    for (let i = 0; i < RW; i++) {
      const k = j * RW + i, dd = Dd[k];
      if (dd < -1.5) continue;
      const ddx = X0 + i - cx, rr = R - dd, sn = ddx / rr, cs = ddy / rr, u = Uu[k];
      let hx = (Hh[k + (i < RW - 1 ? 1 : 0)] - Hh[k - (i > 0 ? 1 : 0)]) * 0.5, hy = (Hh[k + jp] - Hh[k + jm]) * 0.5;
      // rim profile (the inner wall wanders a little; the outer edge is exact)
      const ui = Math.max(0, Math.min(UM * 2, Math.round(u) + UM));
      const dW = dd + WOB[ui] * sstep(RIM - 70, RIM - 30, dd);
      const ms = macroSlope(dW);
      hx -= ms * sn; hy += ms * cs;
      const inv = 1 / Math.sqrt(hx * hx + hy * hy + 1);
      const nl = (-hx * LX - hy * LY + LZ) * inv, nh = (-hx * HX - hy * HY + HZ) * inv;
      const lat = (u - U0) / SIG, F = FD[Math.max(0, Math.min(799, dd | 0))] * Math.exp(-lat * lat);
      let I = F * Math.max(0.13, 0.7 + 1.15 * (nl - LZ));
      // the shoulder turns edge-on at the limb and mirrors the dark around it
      I *= 0.4 + 0.6 * sstep(-1, 10, dd);
      // the rim's shadow on the field
      if (dW > RIM - 4) I *= 1 - sstep(RIM - 4, RIM + 2, dW) * (0.5 * (1 - sstep(RIM, RIM + 36, dW)) + 0.2 * (1 - sstep(RIM, RIM + 150, dW)));
      // the worn inner corner of the rim catches a thread of light
      const ce = (dW - (RIM - WALL - 1)) / 3.6; I += F * 0.16 * Math.exp(-ce * ce);
      // the tops of the strokes are the high points: rubbed brighter
      const gh = Gh[k]; if (gh > 0) I *= 1 + 0.24 * gh;
      const st = St[k], top = sstep(EDGE - 12, EDGE + 8, dd) * (1 - sstep(RIM - WALL - 6, RIM - WALL + 6, dW));
      I += F * st * L.lerp(0.045, 0.085, top);
      I *= 1 + L.lerp(0.075, 0.1, top) * bil(cMed, i, j);
      const sp = nh > 0 ? Math.pow(nh, 46) : 0;
      I += sp * 0.32 * F;
      const cav = Cv[k];
      if (cav > 0) I *= 1 - 0.96 * cav;
      const li = Math.max(0, Math.min(NL - 1, (I / IMAX) * (NL - 1) | 0)) * 3, o = k * 4;
      const al = L.clamp(dd + 0.75);
      const ft = sstep(RIM - 8, RIM + 4, dW);   // the field runs a shade hotter (more orange) than the burnished rim
      const nk = (-hx * KX - hy * KY + KZ) * inv, kick = nk > 0 ? Math.min(1, Math.pow(nk, 6) * 1.5) * (1 - cav) : 0;
      const gm = (1 - 0.05 * ft) * (1 - 0.3 * kick), bm = (1 - 0.16 * ft) * (1 - 0.62 * kick);
      d8[o] = RAMP[li]; d8[o + 1] = RAMP[li + 1] * gm; d8[o + 2] = RAMP[li + 2] * bm; d8[o + 3] = al * 255;
      // sheen: broad lobe + sparkle of the polishing lines + micro-glitter
      let sb = (nh > 0 ? Math.pow(nh, 20) : 0) * (0.8 + 0.9 * Math.max(0, st)) + top * 0.42 * (1 + 0.9 * st);
      const gl = hash2(i, j);
      if (gl > 0.972) sb += ((gl - 0.972) / 0.028) * (0.25 + 0.4 * top);
      sb *= (1 - cav) * al * sstep(-1, 7, dd);
      s8[o] = 255; s8[o + 1] = 216; s8[o + 2] = 124; s8[o + 3] = L.clamp(sb) * 255;
    }
  }
  const coin = L.makeCanvas(RW, RH), g = coin.getContext('2d');
  g.putImageData(img, 0, 0);
  const sheen = L.makeCanvas(RW, RH);
  sheen.getContext('2d').putImageData(sim, 0, 0);

  // a few hairlines (bright lip + dark groove)
  g.save(); g.translate(-X0, -Y0); a.clipBelow(g, -3); g.lineCap = 'round';
  const rs = L.rng('c03hair');
  for (let n = 0; n < 7; n++) {
    const p0 = a.pt(rs.range(-0.3, 0.3), -rs.range(RIM + 30, 470)), ang = rs.range(-0.5, 0.5) + (rs.chance(0.5) ? 0 : Math.PI / 2), len = rs.range(50, 190), bend = rs.range(-14, 14);
    const x1 = p0.x + Math.cos(ang) * len, y1 = p0.y + Math.sin(ang) * len, mx = (p0.x + x1) / 2 - Math.sin(ang) * bend, my = (p0.y + y1) / 2 + Math.cos(ang) * bend;
    const al = rs.range(0.1, 0.22);
    for (const [dy, style] of [[0.9, `rgba(90,30,4,${al})`], [0, `rgba(255,236,170,${al * 1.1})`]]) {
      g.strokeStyle = style; g.lineWidth = rs.range(0.6, 1); g.beginPath(); g.moveTo(p0.x, p0.y + dy); g.quadraticCurveTo(mx, my + dy, x1, y1 + dy); g.stroke();
    }
  }
  g.restore();

  // shallow depth of field: the bottom of frame (nearest the lens) melts a little
  const near = L.blurred(coin, 7), ng = near.getContext('2d');
  ng.globalCompositeOperation = 'destination-in';
  ng.fillStyle = L.radial(ng, cx - X0, cy - Y0, R - 490, R - 300, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
  ng.fillRect(0, 0, RW, RH);
  g.drawImage(near, 0, 0);
  // … and so does the far limb (a true cross-fade: the soft copy replaces the sharp one, alpha edge included)
  const far = L.blurred(coin, 2.3), fg = far.getContext('2d');
  const limbMask = (c) => { c.fillStyle = L.radial(c, cx - X0, cy - Y0, R - 110, R - 12, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]); c.fillRect(0, 0, RW, RH); };
  fg.globalCompositeOperation = 'destination-in'; limbMask(fg);
  g.globalCompositeOperation = 'destination-out'; limbMask(g);
  g.globalCompositeOperation = 'lighter'; g.drawImage(far, 0, 0);
  g.globalCompositeOperation = 'source-over';

  // bloom: the bright metal glows into itself
  const bw = Math.ceil(RW / 4), bh = Math.ceil(RH / 4);
  const b1 = L.makeCanvas(bw, bh), bg = b1.getContext('2d');
  bg.fillStyle = '#000'; bg.fillRect(0, 0, bw, bh);
  bg.filter = 'blur(5px)'; bg.drawImage(coin, 0, 0, bw, bh); bg.filter = 'none';
  const b2 = L.makeCanvas(bw, bh), b2g = b2.getContext('2d');
  b2g.drawImage(b1, 0, 0); b2g.globalCompositeOperation = 'multiply'; b2g.drawImage(b1, 0, 0); b2g.fillStyle = '#ffb45a'; b2g.fillRect(0, 0, bw, bh);
  const bloom = L.makeCanvas(RW, RH), blg = bloom.getContext('2d');
  blg.imageSmoothingQuality = 'high'; blg.drawImage(b2, 0, 0, RW, RH);
  L.overlayOn(coin, bloom, { blend: 'screen', alpha: 0.28 });

  return { coin, sheen, X0, Y0 };
}

export default {
  name: '金开元通宝微距',
  tone: 'light',
  init(env) {
    const built = buildCoin(env);
    const TY = built.Y0 - 2;
    // pin-point glints on the rim that flare as the highlight passes over them
    const rg = L.rng('c03glint'), glints = [];
    for (let i = 0; i < 9; i++) glints.push({ th: L.lerp(-0.2, 0.06, (i + rg.range(0.1, 0.9)) / 9), d: rg.range(16, RIM - 50), k: rg.range(0.5, 1) });
    S = { ...built, TY, tmp: L.makeCanvas(W, H - TY), glints };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const z = L.lerp(1, 1.04, p);
    const thH = L.lerp(-0.14, -0.012, p);                     // where the travelling highlight sits
    const zx = (x) => a.cx + (x - a.cx) * z, zy = (y) => a.crestY + (y - a.crestY) * z;

    ctx.fillStyle = '#030201'; ctx.fillRect(0, 0, W, H);
    // a thread of dark-red glow outside the limb, gone into black at once
    ctx.fillStyle = L.radial(ctx, a.cx, a.cy, a.R - 2, a.R + 96, [[0, 'rgba(190,52,10,0.95)'], [0.06, 'rgba(140,34,8,0.9)'], [0.22, 'rgba(86,20,6,0.62)'], [0.5, 'rgba(56,12,4,0.24)'], [1, 'rgba(20,4,1,0)']]);
    ctx.fillRect(0, 0, W, H);
    // … swelling a little where the highlight rides the rim
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    a.at(ctx, thH, 6, () => {
      ctx.scale(3.2, 0.62);
      ctx.fillStyle = L.radial(ctx, 0, 0, 0, 150, [[0, 'rgba(226,80,16,0.62)'], [0.4, 'rgba(156,42,10,0.26)'], [1, 'rgba(74,18,6,0)']]);
      ctx.fillRect(-150, -150, 300, 300);
    });
    ctx.restore();

    // the coin: pushed in about the crest, then trimmed to the true arc so the edge never drifts
    const camT = (c) => { c.translate(a.cx, a.crestY); c.scale(z, z); c.translate(-a.cx, -a.crestY); };
    ctx.save(); a.clipBelow(ctx, 3);                          // 3 px of grace for the limb's soft (defocused) falloff
    camT(ctx); ctx.drawImage(S.coin, S.X0, S.Y0);
    ctx.restore();

    // travelling highlight: the sheen layer seen through a soft window sliding along the rim
    const t = S.tmp.getContext('2d');
    t.setTransform(1, 0, 0, 1, 0, 0); t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, S.tmp.width, S.tmp.height);
    t.translate(0, -S.TY); t.save(); camT(t); t.drawImage(S.sheen, S.X0, S.Y0); t.restore();
    t.globalCompositeOperation = 'destination-in';
    a.at(t, thH, -RIM * 0.4, () => {
      t.scale(1, 0.6);
      t.fillStyle = L.radial(t, 0, 0, 0, 470, [[0, 'rgba(0,0,0,0.9)'], [0.3, 'rgba(0,0,0,0.6)'], [0.62, 'rgba(0,0,0,0.2)'], [1, 'rgba(0,0,0,0)']]);
      t.fillRect(-4000, -4000, 8000, 8000);
    });
    ctx.save(); a.clipBelow(ctx, 0); ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(S.tmp, 0, S.TY);
    ctx.restore();

    // the light itself: a broad warm lift that follows the highlight across rim and field
    ctx.save(); a.clipBelow(ctx, 0); ctx.globalCompositeOperation = 'overlay';
    a.at(ctx, thH, -RIM * 0.6, () => {
      ctx.scale(1.25, 0.8);
      ctx.fillStyle = L.radial(ctx, 0, 0, 0, 560, [[0, 'rgba(255,238,176,0.3)'], [0.45, 'rgba(255,226,150,0.13)'], [1, 'rgba(255,220,140,0)']]);
      ctx.fillRect(-560, -560, 1120, 1120);
    });
    // concentric polishing throws the highlight into a soft spoke pointing at the coin's centre
    a.at(ctx, thH, -190, () => {
      ctx.scale(0.36, 1.7);
      ctx.fillStyle = L.radial(ctx, 0, 0, 0, 420, [[0, 'rgba(255,242,186,0.26)'], [0.5, 'rgba(255,230,160,0.1)'], [1, 'rgba(255,220,140,0)']]);
      ctx.fillRect(-420, -420, 840, 840);
    });
    ctx.restore();

    // rim light on the shoulder, hottest under the highlight
    const hx = a.pt(thH, 0).x / W;
    ctx.save(); a.clipBelow(ctx, 0); ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'butt';
    ctx.strokeStyle = L.linear(ctx, 0, 0, W, 0, [[0, 'rgba(255,190,90,0.05)'], [L.clamp(hx - 0.22), 'rgba(255,214,130,0.18)'], [L.clamp(hx), 'rgba(255,240,190,0.7)'], [L.clamp(hx + 0.22), 'rgba(255,214,130,0.18)'], [1, 'rgba(255,190,90,0.05)']]);
    for (const [lw, al] of [[14, 0.3], [8, 0.4], [3.5, 0.55]]) { ctx.globalAlpha = al; ctx.lineWidth = lw; a.stroke(ctx, -15 * z); }
    ctx.restore();

    // pin-point glints
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const q of S.glints) {
      const w = Math.exp(-Math.pow((q.th - thH) / 0.045, 2)) * q.k;
      if (w < 0.04) continue;
      const pt = a.pt(q.th, -q.d), rr = 18;
      ctx.save(); ctx.translate(zx(pt.x), zy(pt.y)); ctx.rotate(q.th); ctx.scale(2.6, 0.42);
      ctx.fillStyle = L.radial(ctx, 0, 0, 0, rr, [[0, `rgba(255,250,226,${0.85 * w})`], [0.16, `rgba(255,236,170,${0.42 * w})`], [0.5, `rgba(255,206,110,${0.08 * w})`], [1, 'rgba(255,190,90,0)']]);
      ctx.fillRect(-rr, -rr, rr * 2, rr * 2);
      ctx.restore();
    }
    ctx.restore();
    L.vignette(ctx, { strength: 0.2 });
  },
};
