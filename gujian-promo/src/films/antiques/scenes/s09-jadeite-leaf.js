// s09 — 翡翠雕叶. The arc is the rounded outer margin of a leaf carved from jadeite, lying on beige silk twill (绫).
// Below the arc: saturated, watery green — thin and glowing at the rim, deep toward the heart of the leaf — with an
// incised midrib and side veins, cloudy / thread-like colour, and one smear of honey-yellow jadeite (黄翡) on the right.
//
// The stone is shaded per pixel in init():
//   optical depth τ = thickness (grows inward from the rim) × colour concentration (warped wisps and blotches)
//   → looked up in a green ramp and a yellow ramp; the carved relief (vein grooves, the shallow valleys they sit in,
//   a slow polish undulation) is a height field whose slopes pick up a soft-box reflection, lit / shaded groove walls
//   and a little bounce from the silk. Everything is baked into one layer; draw() only slides it and moves the light.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 100;
let S = null;

const sstep = (a, b, v) => { const t = L.clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

function quad(P0, C, P1, n, t1 = 1) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * t1, m = 1 - t;
    out.push([m * m * P0[0] + 2 * m * t * C[0] + t * t * P1[0], m * m * P0[1] + 2 * m * t * C[1] + t * t * P1[1]]);
  }
  return out;
}

/** midrib + alternate side veins. Upper veins leave the midrib steeply and sweep forward (toward the tip, off-frame right), stopping short of the rim. */
function buildVeins(a) {
  const mid = L.smoothPath([[-460, 1196], [150, 1068], [640, 980], [1150, 918], [1680, 884], [2320, 872]], 8);
  const cum = [0];
  for (let i = 1; i < mid.length; i++) cum.push(cum[i - 1] + Math.hypot(mid[i][0] - mid[i - 1][0], mid[i][1] - mid[i - 1][1]));
  const total = cum[cum.length - 1];
  const at = (s) => {
    let i = 1; while (i < mid.length - 1 && cum[i] < s) i++;
    const k = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1), p0 = mid[i - 1], p1 = mid[i];
    const tx = p1[0] - p0[0], ty = p1[1] - p0[1], m = Math.hypot(tx, ty) || 1;
    return { x: L.lerp(p0[0], p1[0], k), y: L.lerp(p0[1], p1[1], k), tx: tx / m, ty: ty / m };
  };
  const upper = (s, t1 = 1) => {
    const m = at(s), g = -a.drAt(m.x, m.y);
    if (g < 90) return null;
    const nx = m.ty, ny = -m.tx;                       // outward (toward the rim)
    const C = [m.x + m.tx * 0.4 * g + nx * 0.62 * g, m.y + m.ty * 0.4 * g + ny * 0.62 * g];
    const pol = a.polar(m.x, m.y), e = a.pt(pol.theta + (1.02 * g) / a.R, -(44 + 0.07 * g));
    return { pts: quad([m.x, m.y], C, [e.x, e.y], 30, t1), g };
  };
  const lower = (s) => {
    const m = at(s), g = 330, nx = -m.ty, ny = m.tx;   // the far half of the leaf
    const C = [m.x + m.tx * 0.4 * g + nx * 0.62 * g, m.y + m.ty * 0.4 * g + ny * 0.62 * g];
    const E = [m.x + m.tx * 1.05 * g + nx * 0.86 * g, m.y + m.ty * 1.05 * g + ny * 0.86 * g];
    return { pts: quad([m.x, m.y], C, E, 26), g };
  };
  const veins = [{ pts: mid, w0: 18, w1: 9, depth: 1 }];
  const SP = 236;
  for (let s = 40; s < total - 40; s += SP) {
    const u = upper(s);
    if (u) veins.push({ pts: u.pts, w0: 10 * L.clamp(u.g / 300, 0.6, 1), w1: 2, depth: 0.7 });
    const lo = lower(s + SP * 0.5);
    veins.push({ pts: lo.pts, w0: 9.5, w1: 2, depth: 0.7 });
  }
  // centre line of the lobe that carries the yellow: built like a vein, run on past its end to the rim
  const yel = upper(40 + SP * 6.5, 1.32).pts;
  return { veins, yel };
}

/** fill a tapering band along a polyline: width = lerp(w0, w1) * k + add */
function taperPoly(g, pts, w0, w1, k = 1, add = 0) {
  const n = pts.length, A = [], B = [];
  for (let i = 0; i < n; i++) {
    const p = pts[Math.max(0, i - 1)], q = pts[Math.min(n - 1, i + 1)];
    let nx = -(q[1] - p[1]), ny = q[0] - p[0]; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
    const hw = (L.lerp(w0, w1, Math.pow(i / (n - 1), 0.8)) * k + add) / 2;
    A.push([pts[i][0] + nx * hw, pts[i][1] + ny * hw]); B.push([pts[i][0] - nx * hw, pts[i][1] - ny * hw]);
  }
  g.beginPath(); g.moveTo(A[0][0], A[0][1]);
  for (let i = 1; i < n; i++) g.lineTo(A[i][0], A[i][1]);
  for (let i = n - 1; i >= 0; i--) g.lineTo(B[i][0], B[i][1]);
  g.closePath(); g.fill();
}

function boxBlur(src, w, h) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x; tmp[k] = (src[k - (x > 0 ? 1 : 0)] + src[k] + src[k + (x < w - 1 ? 1 : 0)]) / 3;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x; out[k] = (tmp[k - (y > 0 ? w : 0)] + tmp[k] + tmp[k + (y < h - 1 ? w : 0)]) / 3;
  }
  return out;
}

const NL = 1024, TMAX = 1.6;
function lut(stops) {
  const f = L.makeRamp(stops), out = new Float32Array(NL * 3);
  for (let i = 0; i < NL; i++) { const c = f((i / (NL - 1)) * TMAX); out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2]; }
  return out;
}

/** the carved jadeite: returns { leaf (padded layer, transparent above the arc), bloom (padded layer of highlights) } */
function buildLeaf(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const X0 = -PAD, Y0 = Math.floor(a.crestY) - 2;
  const RW = W + PAD * 2, RH = H + PAD - Y0, N = RW * RH;
  const { veins, yel } = buildVeins(a);

  // ── incised grooves (full res): nested bands → a rounded U profile, 0..1 ──
  const sharp = L.makeCanvas(RW, RH), sg = sharp.getContext('2d');
  sg.fillStyle = '#000'; sg.fillRect(0, 0, RW, RH);
  sg.translate(-X0, -Y0); sg.fillStyle = '#fff';
  for (const v of veins) for (const [kf, al] of [[1, 0.22], [0.75, 0.487], [0.5, 0.625], [0.25, 0.867]]) {
    sg.globalAlpha = Math.min(1, al * v.depth); taperPoly(sg, v.pts, v.w0, v.w1, kf);
  }
  const gc = L.makeCanvas(RW, RH), gg = gc.getContext('2d', { willReadFrequently: true });
  gg.fillStyle = '#000'; gg.fillRect(0, 0, RW, RH);
  gg.filter = 'blur(1.3px)'; gg.drawImage(sharp, 0, 0); gg.filter = 'none';
  const Gd = gg.getImageData(0, 0, RW, RH).data;

  // ── the shallow valleys the veins sit in (quarter res, smoothed in float so the 8-bit steps never show in the gloss) ──
  const CS = 4, cw = Math.ceil(RW / CS) + 2, ch = Math.ceil(RH / CS) + 2;
  const vs = L.makeCanvas(cw, ch), vg = vs.getContext('2d');
  vg.fillStyle = '#000'; vg.fillRect(0, 0, cw, ch);
  vg.scale(1 / CS, 1 / CS); vg.translate(-X0 + CS / 2, -Y0 + CS / 2); vg.fillStyle = '#fff';   // pixel centres sit on the coarse nodes
  for (const v of veins) taperPoly(vg, v.pts, v.w0, v.w1, 3.2, 14);
  const vb = L.makeCanvas(cw, ch), vbg = vb.getContext('2d', { willReadFrequently: true });
  vbg.fillStyle = '#000'; vbg.fillRect(0, 0, cw, ch);
  vbg.filter = `blur(${22 / CS}px)`; vbg.drawImage(vs, 0, 0); vbg.filter = 'none';
  const vd = vbg.getImageData(0, 0, cw, ch).data;
  let Vq = new Float32Array(cw * ch);
  for (let i = 0; i < cw * ch; i++) Vq[i] = vd[i * 4] / 255;
  Vq = boxBlur(boxBlur(Vq, cw, ch), cw, ch);

  // ── slow fields on the coarse grid ──
  const nA = L.makeNoise('s09a'), nB = L.makeNoise('s09b');
  const cC = new Float32Array(cw * ch), cY = new Float32Array(cw * ch), cU = new Float32Array(cw * ch), cK = new Float32Array(cw * ch);
  const FC = Math.cos(-0.21), FS = Math.sin(-0.21);     // the "grain" of the stone runs along the leaf
  const ny1 = yel.length - 1;
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const x = X0 + i * CS, y = Y0 + j * CS, k = j * cw + i;
    const u = x * FC + y * FS, v = -x * FS + y * FC;
    const wx = 0.35 * nA.fbm(x / 700, y / 700, 2), wy = 0.35 * nA.fbm(x / 700 + 31, y / 700 - 17, 2);
    const blotch = nA.fbm(x / 640 + 4, y / 640, 2);                         // big soft clouds of colour
    const drift = nB.fbm(u / 900 + wx + 9, v / 150 + wy, 3);                // soft drifts along the grain
    const thr = Math.pow(nB.ridged(u / 1100 + wx, v / 110 + wy + 5, 2), 4); // a few deeper threads (色根)
    const mott = nA.fbm(x / 95 + 60, y / 95 - 8, 2);                         // soft granular clouding
    cC[k] = 0.46 + 0.34 * blotch + 0.3 * drift + 0.5 * thr + 0.07 * mott;
    cK[k] = sstep(0.28, 0.72, nA.fbm(x / 150 + 77, y / 150 + 5, 3));          // pale cottony inclusions (棉)
    cU[k] = nB.fbm(x / 270 + 5, y / 270 - 3, 2);
    // yellow: distance to the lobe's centre line, with a ragged cloudy boundary
    let ym = 0;
    const nn = nA.fbm(x / 150 + 11, y / 150 + 23, 2);
    if (x > 960 && x < 1840) {
      let best = 1e12, bt = 0;
      for (let q = 0; q < ny1; q++) {
        const ax = yel[q][0], ay = yel[q][1], vx = yel[q + 1][0] - ax, vy = yel[q + 1][1] - ay;
        let tt = ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy); tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
        const ex = x - ax - vx * tt, ey = y - ay - vy * tt, dd = ex * ex + ey * ey;
        if (dd < best) { best = dd; bt = (q + tt) / ny1; }
      }
      const hw = L.lerp(24, 72, sstep(0.08, 0.72, bt));
      const feather = nB.fbm(u / 260 + 3, v / 34 + 8, 2);
      ym = sstep(0.05, 0.3, bt) * sstep(1.15, 0.3, Math.sqrt(best) / (hw * (1 + 0.32 * nn + 0.4 * feather)));
      // a fainter fleck drifting off to the right of it
      const fx = x - 1668, fy = y - 706;
      ym = Math.max(ym, 0.65 * sstep(1.1, 0.25, Math.hypot(fx * 0.8 + fy * 0.5, fy * 1.15 - fx * 0.3) / (44 * (1 + 0.5 * nn))));
    }
    cY[k] = ym;
  }
  const bil = (src, i, j) => {
    const fx = i / CS, fy = j / CS, i0 = fx | 0, j0 = fy | 0, tx = fx - i0, ty = fy - j0, k = j0 * cw + i0;
    const a0 = src[k], a1 = src[k + 1], b0 = src[k + cw], b1 = src[k + cw + 1];
    return (a0 + (a1 - a0) * tx) * (1 - ty) + (b0 + (b1 - b0) * tx) * ty;
  };

  // ── slopes of the smooth relief, taken on the coarse grid and interpolated (so the gloss has no facets) ──
  const AP = 14, AG = 6, AU = 3;
  const Hs = new Float32Array(cw * ch), SX = new Float32Array(cw * ch), SY = new Float32Array(cw * ch);
  for (let k = 0; k < cw * ch; k++) Hs[k] = AU * cU[k] - AP * Vq[k];
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const k = j * cw + i;
    SX[k] = (Hs[k + (i < cw - 1 ? 1 : 0)] - Hs[k - (i > 0 ? 1 : 0)]) / (2 * CS);
    SY[k] = (Hs[k + (j < ch - 1 ? cw : 0)] - Hs[k - (j > 0 ? cw : 0)]) / (2 * CS);
  }
  const GK = AG / 255 / 2;

  // "orange peel" of the polish: a tiny wobble on the normal
  const peel = L.noiseTex(RW, RH, { seed: 's09peel', scale: 30, octaves: 2, res: 0.5, contrast: 1.4 });
  const Pd = peel.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, RW, RH).data;
  const POFF = 37 + 11 * RW;

  const GRN = lut([[0, '#d6fadc'], [0.1, '#90e7ac'], [0.2, '#56da8f'], [0.32, '#24c473'], [0.46, '#14ac60'], [0.6, '#109753'],
    [0.78, '#0c7643'], [0.98, '#0a5833'], [1.2, '#084027'], [1.6, '#042616']]);
  const YEL = lut([[0, '#fff6cc'], [0.1, '#fae48e'], [0.22, '#f2cf5e'], [0.36, '#e8bb46'], [0.5, '#e0b040'], [0.7, '#cf972c'],
    [0.95, '#b47a1e'], [1.6, '#8a5614']]);

  // ── shade ──
  const img = new ImageData(RW, RH), d = img.data;
  const sp = new ImageData(RW, RH), sd = sp.data;
  const LX = -0.6, LY = -0.8;                 // toward the key light (upper left)
  const S0 = 0.17;                            // the tilt that mirrors the soft-box into the lens
  for (let j = 0; j < RH; j++) {
    const ddy = cy - (Y0 + j), jm = j > 0 ? -RW : 0, jp = j < RH - 1 ? RW : 0;
    for (let i = 0; i < RW; i++) {
      const ddx = X0 + i - cx, rr = Math.sqrt(ddx * ddx + ddy * ddy);
      let dd = R - rr;
      if (dd < -2) continue;
      if (dd < 0) dd = 0;
      const k = j * RW + i, o = k * 4;
      const hx = bil(SX, i, j) - (Gd[o + (i < RW - 1 ? 4 : 0)] - Gd[o - (i > 0 ? 4 : 0)]) * GK;
      const hy = bil(SY, i, j) - (Gd[o + jp * 4] - Gd[o + jm * 4]) * GK;
      const p1 = (Pd[o] - 128) / 128, p2 = (Pd[((k + POFF) % N) * 4] - 128) / 128;
      const nx = -hx + 0.004 * p1, ny = -hy + 0.004 * p2;
      const grv = Gd[o] / 255, val = bil(Vq, i, j);
      const ym = bil(cY, i, j), cot = bil(cK, i, j);
      let C = bil(cC, i, j); C += (0.42 - C) * 0.65 * ym;                // the yellow is clearer, more even
      const f = nx * LX + ny * LY;                                      // > 0: tilted toward the light
      const lit = f > 0.22 ? 1 : f < -0.22 ? -1 : f / 0.22;
      // optical depth
      const rimT = 0.2 + 0.8 * Math.pow(sstep(0, 46, dd), 0.75);
      const Tb = 0.3 + 0.9 * sstep(0, 440, dd);
      let tau = Tb * (0.36 + C) * rimT + 0.34 * grv + 0.05 * val + 0.12 * lit;   // the side turned from the light glows from within
      if (dd < 2.4) tau += 0.32 * (1 - dd / 2.4);                       // the limb itself: a fine darker line
      if (tau < 0) tau = 0;
      const li = (Math.min(TMAX, tau) / TMAX * (NL - 1) | 0) * 3, ly = (Math.min(0.66, tau * 0.64) / TMAX * (NL - 1) | 0) * 3;
      let cr = GRN[li] + (YEL[ly] - GRN[li]) * ym, cg = GRN[li + 1] + (YEL[ly + 1] - GRN[li + 1]) * ym, cb = GRN[li + 2] + (YEL[ly + 2] - GRN[li + 2]) * ym;
      const ck = 0.07 * cot * (1 - grv) * (1 - ym);
      cr += (214 - cr) * ck; cg += (246 - cg) * ck; cb += (224 - cb) * ck;
      // relief: soft form shading, groove walls lit / in shade
      const wallS = sstep(0.3, 0.8, f), wallD = sstep(0.28, 0.85, -f);
      const sh = (1 + 0.05 * lit) * (1 - 0.5 * wallD) * (1 - 0.2 * grv);
      cr *= sh; cg *= sh; cb *= sh;
      // gloss: every shoulder that leans toward the soft-box carries a streak of it; a wide sheen round that; the lit wall of each groove
      const sl = Math.sqrt(nx * nx + ny * ny) + 1e-6, ca = f / sl, an = ca >= 1 ? 0 : Math.acos(ca);
      const er = (Math.min(sl, S0) - S0) / 0.03, ea = an / 0.46;
      const G = Math.exp(-er * er - ea * ea);
      const inner = sstep(10, 40, dd);
      let spec = (0.9 * sstep(0.5, 0.84, G) + 0.1 * G) * inner * (1 - 0.6 * wallS) + 0.72 * wallS;
      // bounce from the silk on slopes facing away
      const fx2 = nx - 0.1, fy2 = ny - 0.12, fill = 0.07 * Math.exp(-(fx2 * fx2 + fy2 * fy2) / 0.006) * inner;
      cr += 233 * fill; cg += 223 * fill; cb += 198 * fill;
      // the glassy line riding the rounded rim
      const th = ddx / R, rz = (dd - 6.2) / 1.9;
      const rim = Math.exp(-rz * rz) * (0.3 + 0.34 * Math.exp(-((th + 0.14) / 0.1) * ((th + 0.14) / 0.1)));
      spec += rim;
      if (spec > 1) spec = 1;
      d[o] = cr + (255 - cr) * spec; d[o + 1] = cg + (255 - cg) * spec; d[o + 2] = cb + (250 - cb) * spec; d[o + 3] = 255;
      sd[o] = 236; sd[o + 1] = 255; sd[o + 2] = 240; sd[o + 3] = 255 * spec;
    }
  }
  const cnv = L.makeCanvas(RW, RH); cnv.getContext('2d').putImageData(img, 0, 0);
  const scv = L.makeCanvas(RW, RH); scv.getContext('2d').putImageData(sp, 0, 0);

  const leaf = L.makeLayer(PAD, (g) => {
    g.save(); a.clipBelow(g, 0);
    g.drawImage(cnv, X0, Y0);
    // crystalline grain inside the stone (翠性), very fine
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.1;
    g.drawImage(L.noiseTex(RW, RH, { seed: 's09grain', scale: 6, octaves: 2, res: 0.5, contrast: 1.5 }), X0, Y0);
    g.restore();
  });
  const bloom = L.makeLayer(PAD, (g) => {
    g.save(); a.clipBelow(g, 0);
    g.filter = 'blur(13px)'; g.drawImage(scv, X0, Y0); g.filter = 'none';
    g.restore();
  });
  return { leaf, bloom };
}

/** beige silk twill: fine diagonal weave, long soft bands of lustre. Covers everything above the arc (plus a margin). */
function buildSilk(env) {
  const a = env.arc;
  const X0 = -PAD, Y0 = -PAD, RW = W + PAD * 2, RH = Math.ceil(a.yAt(X0)) + 16 - Y0;
  const nz = L.makeNoise('s09silk');
  const CS = 8, cw = Math.ceil(RW / CS) + 2, ch = Math.ceil(RH / CS) + 2;
  const cS = new Float32Array(cw * ch), cF = new Float32Array(cw * ch);
  const CA = Math.cos(L.deg(33)), SA = Math.sin(L.deg(33));
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const x = X0 + i * CS, y = Y0 + j * CS, u = x * CA + y * SA, v = -x * SA + y * CA;
    cS[j * cw + i] = nz.fbm(u / 3400 + 3, v / 170, 2);
    cF[j * cw + i] = nz.fbm(x / 800 + 40, y / 620 - 7, 2);
  }
  const bil = (src, i, j) => {
    const fx = i / CS, fy = j / CS, i0 = fx | 0, j0 = fy | 0, tx = fx - i0, ty = fy - j0, k = j0 * cw + i0;
    const a0 = src[k], a1 = src[k + 1], b0 = src[k + cw], b1 = src[k + cw + 1];
    return (a0 + (a1 - a0) * tx) * (1 - ty) + (b0 + (b1 - b0) * tx) * ty;
  };
  // yarn irregularity along warp and weft
  const r = L.rng('s09yarn'), rowJ = new Float32Array(RH), colJ = new Float32Array(RW);
  let pv = 0; for (let y = 0; y < RH; y++) { pv = pv * 0.55 + r.gauss() * 0.45; rowJ[y] = pv; }
  pv = 0; for (let x = 0; x < RW; x++) { pv = pv * 0.55 + r.gauss() * 0.45; colJ[x] = pv; }
  const img = new ImageData(RW, RH), d = img.data;
  const PITCH = 6.2;
  for (let j = 0; j < RH; j++) {
    const y = Y0 + j;
    for (let i = 0; i < RW; i++) {
      const x = X0 + i;
      const lustre = sstep(-0.5, 0.5, bil(cS, i, j)), fold = bil(cF, i, j);
      const up = (-x * SA + y * CA) / PITCH, al = x * CA + y * SA;
      const ridge = Math.sin(L.TAU * up), knot = Math.sin(al * 0.62 + Math.floor(up + 0.25) * 2.4);
      const dl = 0.024 * lustre - 0.01 + 0.004 * fold
        + ridge * (0.02 + 0.024 * lustre) * (0.72 + 0.28 * knot)
        + rowJ[j] * 0.009 + colJ[i] * 0.007
        + 0.03 - 0.05 * ((x / W) * 0.7 + (y / 760) * 0.3);
      const o = (j * RW + i) * 4;
      d[o] = 233 * (1 + dl); d[o + 1] = 223 * (1 + 1.1 * dl); d[o + 2] = 198 * (1 + 1.45 * dl); d[o + 3] = 255;
    }
  }
  const c = L.makeCanvas(RW, RH); c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

export default {
  name: '翡翠雕叶',
  tone: 'dark',
  init(env) {
    const silk = buildSilk(env);
    const { leaf, bloom } = buildLeaf(env);
    // light that has passed through the stone falls on the silk as a green (and, by the yellow, honey) shadow
    const shWide = L.blurred(leaf, 20), shTight = L.blurred(leaf, 5);
    const wg = shWide.getContext('2d');            // the key light is upper left → the cast colour gathers toward the right
    wg.globalCompositeOperation = 'destination-in';
    wg.fillStyle = L.linear(wg, PAD, 0, PAD + W, 0, [[0, 'rgba(0,0,0,0.3)'], [0.2, 'rgba(0,0,0,0.5)'], [0.36, 'rgba(0,0,0,0.34)'], [0.6, 'rgba(0,0,0,0.85)'], [0.8, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0.8)']]);
    wg.fillRect(0, 0, shWide.width, shWide.height);
    const base = L.makeLayer(PAD, (g) => {
      g.drawImage(silk, -PAD, -PAD);
      g.globalCompositeOperation = 'multiply';
      g.globalAlpha = 0.46; g.drawImage(shWide, -PAD + 9, -PAD - 11);
      g.globalAlpha = 0.5; g.drawImage(shTight, -PAD + 1.5, -PAD - 3.5);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.drawImage(leaf, -PAD, -PAD);
      g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.5;
      g.drawImage(bloom, -PAD, -PAD);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    });
    S = { base };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.0042, 0.0042, p), zoom = L.lerp(1.0, 1.012, p);
    L.blit(ctx, env, S.base, { rot, zoom });
    const br = Math.sin(p * Math.PI);                 // the light inside swells, then settles
    L.cam(ctx, env, { zoom }, () => {
      ctx.save(); a.clipBelow(ctx, -0.5);
      ctx.globalCompositeOperation = 'screen';
      // transmitted light pooling under the rim
      a.at(ctx, L.lerp(-0.14, -0.05, p), -150, () => {
        ctx.scale(2.7, 1);
        ctx.fillStyle = L.radial(ctx, 0, 0, 0, 300, [[0, L.rgba('#7fe0a0', 0.06 + 0.1 * br)], [0.5, L.rgba('#3fd088', 0.03 + 0.05 * br)], [1, 'rgba(60,200,130,0)']]);
        ctx.fillRect(-320, -320, 640, 640);
      });
      // the glassy highlight travelling along the rim
      const pk = L.lerp(0.25, 0.4, p);
      const grad = (al) => L.linear(ctx, 0, 0, W, 0, [[0, 'rgba(246,255,244,0)'], [Math.max(0, pk - 0.17), `rgba(246,255,244,${0.08 * al})`],
        [pk, `rgba(246,255,244,${al})`], [pk + 0.2, `rgba(246,255,244,${0.1 * al})`], [1, 'rgba(246,255,244,0)']]);
      ctx.lineCap = 'round';
      ctx.strokeStyle = grad(0.3); ctx.lineWidth = 13; a.stroke(ctx, -9);
      ctx.strokeStyle = grad(0.95); ctx.lineWidth = 3.2; a.stroke(ctx, -6);
      ctx.restore();
    });
  },
};
