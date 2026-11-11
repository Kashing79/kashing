// s02 — 一串铜钱. Macro of a string of cash coins (一贯) coiled into a big ring, seen from the side: every coin stands on
// edge across the cord, so the lens only ever meets rims (钱缘) — never a face, never an inscription.
// The roll of coins is a tube of radius A0 whose OUTER LIMB is the arc. Along it each rim top is a fat, worn brass bead;
// focus sits on that row. Below the arc the rims turn toward the lens and fall out of focus: the seams melt and what is
// left are the lights mirrored in the brass, as honey-coloured bands concentric with the arc.
// A real string is never tidy, so nothing here repeats: the coins differ in thickness, diameter, lean, edge profile, alloy
// and patina (rubbed bright / honey-toned / chocolate / a touch of verdigris). They lean in loose groups like dominoes,
// and where two groups lean together the hemp cord shows in the gap, down on the axis of the roll (the plane of focus again).
//
// Everything under the arc is shaded per pixel in init(): a pixel is mapped onto its coin (thickness coordinate u,
// elevation α round the rim), a height field (uneven casting skin, file marks, pores, knocks) bends the normal, and the
// mirrored direction looks up a small painted studio (back light, a window-shaped key from the upper left, a warm kicker,
// broad front fills). Patina decides how much of that mirror survives. The sharp row of beads is rendered at full
// resolution, the defocused body at half; depth of field, bloom and bokeh are added afterwards.
import * as L from '../../../lib/core.js';

const { W, H, TAU } = L;
const PAD = 64;                     // the string only slides ±20 px, a small margin is enough
const A0 = 400;                     // mean coin radius on screen (px) → the roll is a tube of radius A0 under the arc
const CORD_D = 350, CORD_R = 58;    // the cord rides high in the square holes: depth of its centre line below the arc, half-thickness
const AMAX = 1.95, QMIN = Math.cos(AMAX);
const NP = 512, NT = 96, PMAX = 4.3;   // the painted studio: NP steps over the elevation ψ of the mirrored ray, NT across left–right
const GAPS = [7, 13];               // index of the coin to the RIGHT of each place where the cord shows
const S_GAP1 = -335;                // where the first of them sits along the arc (px from the crest)
let S = null;

const sstep = (a, b, v) => { let t = (v - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };

// the string, left to right: [thickness px, kind, lean, top (px below the arc), edge profile]
// kinds: B rubbed bright brass · H honey-toned · C chocolate patina · R redder alloy · G chocolate with verdigris
const SPEC = [
  [134, 'H', -0.12, 1, 'soft'], [126, 'B', -0.125, 0, 'round'], [104, 'C', -0.12, 5, 'flat'], [148, 'H', -0.125, -2, 'round'],
  [116, 'B', -0.13, 1, 'soft'], [98, 'G', -0.135, 6, 'round'], [140, 'H', -0.14, 0, 'soft'],
  // — the cord shows here —
  [168, 'B', 0.14, -3, 'round'], [112, 'R', 0.12, 3, 'soft'], [134, 'H', 0.07, -1, 'round'], [124, 'B', 0.02, 0, 'flat'],
  [156, 'C', -0.04, -2, 'round'], [100, 'H', -0.1, 5, 'soft'],
  // — and here —
  [138, 'G', 0.1, 1, 'round'], [118, 'B', 0.095, 2, 'soft'], [146, 'H', 0.1, -2, 'round'], [108, 'C', 0.09, 5, 'flat'],
  [130, 'R', 0.095, 0, 'soft'], [122, 'H', 0.09, 2, 'round'], [140, 'B', 0.09, 0, 'soft'],
];
const KIND = {
  B: { pat: 0.1, pv: 0.2, rough: 0.05, wear: 0.15, tint: [1.0, 0.77, 0.3], file: 0.6, lump: 0.8 },
  H: { pat: 0.44, pv: 0.4, rough: 0.13, wear: 0.4, tint: [1.0, 0.71, 0.25], file: 0.8, lump: 1.0 },
  C: { pat: 0.9, pv: 0.24, rough: 0.2, wear: 0.95, tint: [1.0, 0.73, 0.27], file: 0.5, lump: 1.25 },
  R: { pat: 0.36, pv: 0.38, rough: 0.11, wear: 0.35, tint: [1.0, 0.57, 0.21], file: 0.7, lump: 0.9 },
  G: { pat: 0.74, pv: 0.32, rough: 0.2, wear: 0.7, tint: [1.0, 0.73, 0.27], file: 0.5, lump: 1.2, verd: 0.3 },
};
// corner of the rim as fractions of the thickness: [rw min, rw max, rh min, rh max]
const SHAPE = { round: [0.42, 0.5, 0.25, 0.34], soft: [0.3, 0.4, 0.17, 0.25], flat: [0.17, 0.25, 0.09, 0.15] };

// ── tiny allocation-free worley noise (squared distance in cD1, cell id in cId) ──
let cD1 = 0, cId = 0;
function cell(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let d1 = 9, id = 0;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const cx = xi + ox, cy = yi + oy;
    let h = (Math.imul(cx, 374761393) + Math.imul(cy, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    const dx = cx + (h & 1023) / 1023 - x, dy = cy + ((h >>> 10) & 1023) / 1023 - y, d = dx * dx + dy * dy;
    if (d < d1) { d1 = d; id = ((h >>> 20) & 255) / 255; }
  }
  cD1 = d1; cId = id;
}

/** piecewise-linear scalar profile from [[x, v], …] */
function pl(stops) {
  return (x) => {
    if (x <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) if (x <= stops[i][0]) { const a = stops[i - 1], b = stops[i]; return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]); }
    return stops[stops.length - 1][1];
  };
}

/**
 * What the brass mirrors. Rows: ψ = elevation of the mirrored ray (0° = straight behind the string, 90° = overhead,
 * 180° = the lens; on a plain rim ψ = 2α). Columns: how far the ray leans left/right. `sharp` is the studio itself,
 * `rough` the same studio seen in a patinated (matte) surface.
 */
function makeEnv() {
  const sharp = new Float32Array(NP * NT * 3), rough = new Float32Array(NP * NT * 3), tmp = new Float32Array(NP * NT * 3);
  const box = (v, a, b, e) => sstep(a - e, a + e, v) * (1 - sstep(b - e, b + e, v));
  const back = pl([[0, 1.2], [5, 1.85], [19, 2.3], [29, 1.55], [37, 0.5], [44, 0.2], [60, 0]]);                      // broad light behind → the lit cap of every bead
  const fill = pl([[80, 0], [98, 0.8], [116, 1.0], [127, 0.42], [135, 0.5], [140, 1.2], [145, 0.8], [155, 0.6], [167, 0.36], [182, 0.26], [205, 0.2], [235, 0.12], [250, 0.08]]);
  for (let ip = 0; ip < NP; ip++) {
    const pd = ((ip / (NP - 1)) * PMAX * 180) / Math.PI;
    const bk = back(pd), fl = fill(pd), keyP = box(pd, 50, 80, 3.2), kickP = box(pd, 52, 118, 13);
    for (let it = 0; it < NT; it++) {
      const rt = (it / (NT - 1)) * 2 - 1, o = (ip * NT + it) * 3;
      let r = 0.085, g = 0.055, b = 0.03;
      const bA = bk * (0.25 + 0.75 * Math.exp(-(((rt + 0.14) / 0.8) ** 2)));
      r += bA; g += bA * 0.93; b += bA * 0.76;
      const kA = 3.0 * keyP * box(rt, -0.68, -0.1, 0.05) * (1 - 0.5 * Math.exp(-(((rt + 0.39) / 0.024) ** 2)));          // a window with one glazing bar
      r += kA; g += kA * 0.97; b += kA * 0.9;
      const cA = 1.15 * kickP * sstep(0.42, 0.82, rt);                                                                   // warm kicker from the right
      r += cA; g += cA * 0.55; b += cA * 0.2;
      const fA = fl * (0.5 + 0.5 * Math.exp(-(((rt + 0.08) / 0.62) ** 2)));                                              // front fills → the honey bands of the body
      r += fA; g += fA * 0.88; b += fA * 0.66;
      sharp[o] = r; sharp[o + 1] = g; sharp[o + 2] = b;
    }
  }
  // rough = gaussian blur of sharp (separable)
  const blur1 = (src, dst, n, stride, lines, lineStride, sigma) => {
    const rad = Math.ceil(sigma * 2.5), kern = new Float32Array(rad * 2 + 1);
    let ks = 0; for (let i = -rad; i <= rad; i++) { kern[i + rad] = Math.exp(-(i * i) / (2 * sigma * sigma)); ks += kern[i + rad]; }
    for (let ln = 0; ln < lines; ln++) for (let i = 0; i < n; i++) {
      let r = 0, g = 0, b = 0;
      for (let q = -rad; q <= rad; q++) { let j = i + q; j = j < 0 ? 0 : j >= n ? n - 1 : j; const o = (ln * lineStride + j * stride) * 3, kv = kern[q + rad]; r += src[o] * kv; g += src[o + 1] * kv; b += src[o + 2] * kv; }
      const o = (ln * lineStride + i * stride) * 3; dst[o] = r / ks; dst[o + 1] = g / ks; dst[o + 2] = b / ks;
    }
  };
  blur1(sharp, tmp, NP, NT, NT, 1, 30);     // along ψ
  blur1(tmp, rough, NT, 1, NP, NT, 13);     // across
  return { sharp, rough };
}

/** the coins of the string. `s` is measured along the arc (px from the crest), `u` across a coin's thickness. */
function makeCoins() {
  const r = L.rng('coins-s02-guan-b');
  const coins = [];
  let s = 0, prev = null;
  SPEC.forEach(([t, kind, lean, top, shape], i) => {
    const K = KIND[kind], sh = SHAPE[shape], w = t / 2;
    const Ln = lean + r.range(-0.007, 0.007);
    let g0 = 3, dL = 0;
    if (prev) {
      dL = Ln - prev.L;
      // leaning together at the top → tight; leaning apart → a dark V between the two beads; cord gaps touch at the top and open downward
      g0 = GAPS.includes(i) ? 7 : dL < 0 ? 2 + -dL * r.range(150, 225) : r.range(1.5, 3.4);
      s += g0; prev.gR0 = g0; prev.gRk = dL;
    }
    const ph = r.range(0.5, 1.1) * r.sign();
    const c = {
      s: s + w, w, L: Ln, dtop: top + r.range(-1, 1), a: A0 * r.range(0.93, 1.08), kind,
      gL0: g0, gLk: dL, gR0: 3, gRk: 0,
      crown: r.range(2, 6.5), taper: r.range(-0.03, 0.03),
      rwL: t * r.range(sh[0], sh[1]), rhL: t * r.range(sh[2], sh[3]), rwR: t * r.range(sh[0], sh[1]), rhR: t * r.range(sh[2], sh[3]),
      wavA: r.range(0.4, 1.2), wavF: TAU / r.range(40, 72), wavP: r.range(0, TAU),
      nick: r.chance(0.45) ? { u: r.range(-0.7, 0.7) * w, wd: r.range(7, 15), dep: r.range(2, 5.5) } : null,   // a knock in the edge
      dents: [],
      pat: K.pat + r.range(-0.06, 0.06), pv: K.pv, rough: K.rough, wear: K.wear,
      tr: K.tint[0], tg: K.tint[1] * r.range(0.96, 1.04), tb: K.tint[2] * r.range(0.9, 1.1),
      pr: kind === 'R' ? 0.88 : 0.93, pg: kind === 'R' ? 0.38 : 0.52, pb: kind === 'R' ? 0.11 : 0.13,     // toned (thin patina) tint
      ar: kind === 'C' || kind === 'G' ? 0.3 : 0.42, ag: kind === 'C' || kind === 'G' ? 0.165 : 0.24, ab: kind === 'C' || kind === 'G' ? 0.06 : 0.08,
      kb: r.range(0.8, 1.1), file: K.file * r.range(0.7, 1.2), lump: K.lump * r.range(0.8, 1.2),
      cphi: Math.cos(ph), sphi: Math.sin(ph), su: r.range(0, 4000), sv: r.range(0, 4000),
      pitTh: kind === 'B' ? 0.972 : r.range(0.9, 0.96),
      aoff: r.range(-0.05, 0.05), tone: r.range(0.92, 1.08), verd: K.verd ? K.verd * r.range(0.85, 1.15) : 0, dirt: r.range(0.4, 1),
      ridge: r.chance(0.45) ? r.range(0.5, 1.2) * r.sign() : 0, ur: r.range(-0.3, 0.3) * w,              // trace of the mould seam round the edge
      edgeWear: r.range(0.1, 0.5),
    };
    for (let k = r.int(0, 2); k > 0; k--) c.dents.push({ u: r.range(-0.8, 0.8) * w, v: r.range(30, 340), rad: r.range(12, 26), dep: r.range(1.5, 4) });
    coins.push(c); prev = c; s += t;
  });
  const gl = coins[GAPS[0] - 1], gr = coins[GAPS[0]];
  const shift = S_GAP1 - (gl.s + gl.w + gr.s - gr.w) / 2;
  for (const c of coins) c.s += shift;
  // s → nearest coin (taken at mid depth, so the leaning ones are still found)
  const sMin = coins[0].s - coins[0].w - 60, sMax = coins[coins.length - 1].s + coins[coins.length - 1].w + 60;
  const NB = Math.ceil((sMax - sMin) / 4), lut = new Uint8Array(NB);
  for (let b = 0; b < NB; b++) {
    const sv = sMin + (b + 0.5) * 4; let best = 0, bm = -1e9;
    for (let i = 0; i < coins.length; i++) { const c = coins[i], m = c.w - Math.abs(sv - c.s - c.L * (200 - c.dtop)); if (m > bm) { bm = m; best = i; } }
    lut[b] = best;
  }
  return { coins, lut, sMin, binK: 1 / 4, NB };
}

/**
 * Shade the coins for depths d ∈ [dMin, dMax] below the arc at pixel scale sc (1 = full resolution, 2 = half).
 * Returns { img, hot } canvases of size LW/sc × LH/sc (hot only when wantHot: extra glints for the travelling light).
 */
function shadeCoins(G, sc, dMin, dMax, wantHot) {
  const { R, cx, cy, X0, Y0, LW, LH, coins, lut, sMin, binK, NB, nA, nB, ES, ER } = G;
  const RW = Math.ceil(LW / sc), RH = Math.ceil(LH / sc), N = RW * RH, nC = coins.length;
  const fine = sc === 1;
  const Al = new Float32Array(N), Hh = new Float32Array(N), Sl = new Float32Array(N), Uu = new Float32Array(N), Xs = new Float32Array(N),
    Cv = new Float32Array(N), Gr = new Float32Array(N), Mh = new Float32Array(N), Ci = new Uint8Array(N);
  const R2out = (R - dMin) * (R - dMin), R2in = (R - dMax) * (R - dMax);

  // ── pass 1: which coin, where on its rim, and the height field ──
  for (let j = 0; j < RH; j++) {
    const ddy = cy - (Y0 + (j + 0.5) * sc);
    for (let i = 0; i < RW; i++) {
      const k = j * RW + i, ddx = X0 + (i + 0.5) * sc - cx, rr2 = ddx * ddx + ddy * ddy;
      if (rr2 > R2out || rr2 < R2in) { Al[k] = -1; continue; }
      const d = R - Math.sqrt(rr2), s = Math.atan2(ddx, ddy) * R;
      let b = ((s - sMin) * binK) | 0; b = b < 0 ? 0 : b >= NB ? NB - 1 : b;
      const c0 = lut[b];
      let ci = -1, m = -1e9, u = 0;
      for (let q = c0 - 1; q <= c0 + 1; q++) {
        if (q < 0 || q >= nC) continue;
        const cq = coins[q], uu = s - cq.s - cq.L * (d - cq.dtop), mm = cq.w - (uu < 0 ? -uu : uu);
        if (mm > m) { m = mm; ci = q; u = uu; }
      }
      const c = coins[ci], dp = d - c.dtop;
      if (m < -0.5 * sc) {
        // between two coins: a seam (filled with dusk in pass 2) or one of the wide gaps (left open for the cord)
        const cj = u > 0 ? ci + 1 : ci - 1; let g = -m;
        if (cj >= 0 && cj < nC) { const n = coins[cj], u2 = s - n.s - n.L * (d - n.dtop); g += (u2 < 0 ? -u2 : u2) - n.w; } else g = 99;
        if (g > 60) { Al[k] = -1; continue; }
        Al[k] = -2; Hh[k] = g; Sl[k] = dp - (u > 0 ? c.rhR : c.rhL); continue;
      }
      // rim profile across the thickness: a low crown with worn, rounded corners, a little waviness and the odd knock
      const w = c.w, uw = u / w;
      let drop = c.crown * uw * uw + c.taper * u + c.wavA * (1 + Math.sin(u * c.wavF + c.wavP));
      let slope = (2 * c.crown * u) / (w * w) + c.taper + c.wavA * c.wavF * Math.cos(u * c.wavF + c.wavP);
      let xs = 0;
      if (u > w - c.rwR) {
        xs = (u - (w - c.rwR)) / c.rwR; if (xs > 0.985) xs = 0.985;
        const sq = Math.sqrt(1 - xs * xs); drop += c.rhR * (1 - sq); slope += ((c.rhR / c.rwR) * xs) / sq;
      } else if (u < -(w - c.rwL)) {
        xs = (-u - (w - c.rwL)) / c.rwL; if (xs > 0.985) xs = 0.985;
        const sq = Math.sqrt(1 - xs * xs); drop += c.rhL * (1 - sq); slope -= ((c.rhL / c.rwL) * xs) / sq;
      }
      if (c.nick) { const t = (u - c.nick.u) / c.nick.wd, e = c.nick.dep * Math.exp(-t * t); drop += e; slope -= (2 * t * e) / c.nick.wd; }
      const aloc = c.a - drop;
      let q = (c.a - dp) / aloc;
      let cov = (dp - drop) / Math.sqrt(1 + (slope * slope > 9 ? 9 : slope * slope)) / sc + 0.5;
      if (cov <= 0) { Al[k] = -1; continue; }
      const cs2 = m / sc + 0.5; if (cs2 < cov) cov = cs2; if (cov > 1) cov = 1;
      if (q > 1) q = 1; else if (q < QMIN) q = QMIN;
      const al = Math.acos(q), sinA = Math.sqrt(1 - q * q);
      Al[k] = al; Cv[k] = cov; Ci[k] = ci; Sl[k] = slope; Uu[k] = u; Xs[k] = xs;
      // relief, laid out on the rim surface (U across the thickness, V round the circumference) so it foreshortens at the limb
      const fade = sstep(0.04, 0.22, sinA), V0 = c.a * al;
      const U = u + c.su, V = V0 + c.sv;
      const m1 = nA.n2(U / 74, V / 118), m2 = nB.n2(U / 27 + 9, V / 41 - 3);
      let h = c.lump * (1.7 * m1 + 0.8 * m2), gr = 0;                                              // uneven casting skin
      if (fine) {
        const fa = c.file * sstep(-0.25, 0.35, nB.n2(U / 95 + 5, V / 170 + 2));                    // file marks (锉痕), worn away in places
        if (fa > 0.01) {
          const fu = U * c.cphi + V * c.sphi, fv = -U * c.sphi + V * c.cphi;
          const fm = 0.55 * nA.n2(fu / 110, fv / 3.4) + 0.3 * nB.n2(fu / 46 + 7, fv / 1.6);
          h += fa * fm; if (fm < 0) gr = -fm * fa;
        }
        cell(U / 17, V / 17);
        if (cId > c.pitTh) {                                                                        // the odd casting pore
          const rad = 0.1 + (0.2 * (cId - c.pitTh)) / (1 - c.pitTh), r2 = rad * rad;
          if (cD1 < r2) { const f = 1 - cD1 / r2; h -= rad * 7 * f * f; gr += f; }
        }
      }
      for (let n = 0; n < c.dents.length; n++) {
        const dn = c.dents[n], du = u - dn.u, dv = V0 - dn.v, r2 = (du * du + dv * dv) / (dn.rad * dn.rad);
        if (r2 < 4) h -= dn.dep * Math.exp(-r2 * 1.2);
      }
      if (c.ridge !== 0) { const t = (u - c.ur) / 5; if (t > -3 && t < 3) h += c.ridge * Math.exp(-t * t) * (0.65 + 0.35 * m2); }
      Hh[k] = h * fade; Gr[k] = gr * fade; Mh[k] = m1;
    }
  }

  // ── pass 2: shade ──
  const img = new ImageData(RW, RH), px = img.data;
  const hotImg = wantHot ? new ImageData(RW, RH) : null, hp = hotImg ? hotImg.data : null;
  const LK0 = -0.36, LK1 = 0.83, LK2 = -0.42;      // where the key sits (for the matte parts)
  const LB0 = -0.1, LB1 = 0.37, LB2 = -0.92;       // … and the back light
  const PK = (NP - 1) / PMAX;
  const colFall = new Float32Array(RW);
  for (let i = 0; i < RW; i++) { const x = X0 + (i + 0.5) * sc, t = (x - 860) / 760; colFall[i] = 0.5 + 0.56 * Math.exp(-t * t); }
  for (let j = 0; j < RH; j++) {
    const ddy = cy - (Y0 + (j + 0.5) * sc);
    for (let i = 0; i < RW; i++) {
      const k = j * RW + i, al = Al[k];
      if (al === -1) continue;
      const o = k * 4;
      if (al === -2) {
        // seam: a little warm bounce between the faces just under the notch, then darkness; the wide gaps stay open
        const g = Hh[k], dq = Sl[k];
        const bn = Math.exp(-(dq > 0 ? dq : 0) / 34) * 0.5 * sstep(1, 7, g) * colFall[i];
        px[o] = 255 * (0.022 + 0.4 * bn); px[o + 1] = 255 * (0.013 + 0.19 * bn); px[o + 2] = 255 * (0.008 + 0.035 * bn);
        px[o + 3] = 255 * sstep(-4, 12, dq) * (1 - sstep(30, 58, g));
        continue;
      }
      const ci = Ci[k], c = coins[ci];
      const ddx = X0 + (i + 0.5) * sc - cx, rr = Math.sqrt(ddx * ddx + ddy * ddy), sn = ddx / rr, cs = ddy / rr, d = R - rr, dp = d - c.dtop;
      const kl = i > 0 && Al[k - 1] >= 0 && Ci[k - 1] === ci ? k - 1 : k, kr = i < RW - 1 && Al[k + 1] >= 0 && Ci[k + 1] === ci ? k + 1 : k;
      const ku = j > 0 && Al[k - RW] >= 0 && Ci[k - RW] === ci ? k - RW : k, kd = j < RH - 1 && Al[k + RW] >= 0 && Ci[k + RW] === ci ? k + RW : k;
      const hx = ((Hh[kr] - Hh[kl]) * (kr - kl === 2 ? 0.5 : 1)) / sc, hy = ((Hh[kd] - Hh[ku]) * (kd - ku === 2 * RW ? 0.5 : 1)) / sc;
      const ht = hx * cs + hy * sn, hv = -hx * sn + hy * cs;     // along the arc / toward the centre
      const sinA = Math.sin(al), bend = hv * sinA * c.kb;
      let an = al - bend; an = an < -0.25 ? -0.25 : an > AMAX ? AMAX : an;
      const mt = Sl[k] - ht * c.kb;
      let nt = mt / Math.sqrt(1 + mt * mt);
      const c0 = Math.sqrt(1 - nt * nt);
      let nr = Math.cos(an) * c0, nz = Math.sin(an) * c0;
      const nt0 = nt; nt -= c.L * nr; nr += c.L * nt0;          // the coin leans
      if (nz < 0.015) nz = 0.015;
      // the mirrored ray
      const rT = 2 * nz * nt, rR = 2 * nz * nr, rZ = 2 * nz * nz - 1;
      let psi = Math.atan2(rR, -rZ) + c.aoff; if (psi < -0.6) psi += TAU;
      psi = psi < 0 ? 0 : psi > PMAX ? PMAX : psi;
      const tq = rT < -1 ? -1 : rT > 1 ? 1 : rT;
      const e = (((psi * PK) | 0) * NT + (((tq * 0.5 + 0.5) * (NT - 1) + 0.5) | 0)) * 3;
      // surface state
      const xs = Xs[k], gr = Gr[k], u = Uu[k], U = u + c.su, V = c.a * al + c.sv;
      const right = u > 0;
      const gw = right ? c.gR0 + c.gRk * dp : c.gL0 + c.gLk * dp;                    // width of the gap on this side, here
      const tight = (1 - sstep(4, 34, gw)) * sstep(0, 46, dp + 12);                 // shut in by the neighbour (not at the open top of a notch)
      const pn = 0.5 + 0.5 * (0.62 * nA.n2(U / 66 + 11, V / 150 - 4) + 0.38 * nB.n2(U / 21 + 3, V / 34 + 8));
      const ew = xs > 0.15 && xs < 0.8 ? c.edgeWear * Math.sin(((xs - 0.15) / 0.65) * Math.PI) : 0;   // corners rubbed bright by the neighbours
      let P = c.pat + c.pv * (pn - 0.5) * 2 + 0.9 * gr + 0.4 * xs * xs * c.dirt - c.wear * sstep(-0.05, 0.65, Mh[k]) * (1 - 0.5 * xs) - ew;
      P = P < 0 ? 0 : P > 1 ? 1 : P;
      let rough = c.rough + 0.72 * sstep(0.12, 0.92, P); if (rough > 1) rough = 1;
      const er = ES[e] + (ER[e] - ES[e]) * rough, eg = ES[e + 1] + (ER[e + 1] - ES[e + 1]) * rough, eb = ES[e + 2] + (ER[e + 2] - ES[e + 2]) * rough;
      const tt = sstep(0.05, 0.8, P), metal = 1 - 0.78 * sstep(0.62, 1.0, P);
      const tr = c.tr + (c.pr - c.tr) * tt, tg = c.tg + (c.pg - c.tg) * tt, tb = c.tb + (c.pb - c.tb) * tt;
      // matte light for patina, verdigris and grime
      let dk = nt * LK0 + nr * LK1 + nz * LK2, db = nt * LB0 + nr * LB1 + nz * LB2;
      dk = dk < 0 ? 0 : dk; db = db < 0 ? 0 : db;
      const D = 0.16 + 1.05 * dk + 0.5 * db + 0.26 * nz;
      const occ = 1 - 0.85 * xs * xs * xs * tight;
      let cr = er * tr * metal * occ + D * c.ar * (1 - metal), cg = eg * tg * metal * occ + D * c.ag * (1 - metal), cb = eb * tb * metal * occ + D * c.ab * (1 - metal);
      const grime = sstep(0.5, 1, xs) * c.dirt * 0.6 * tight;
      if (grime > 0) { cr += (0.1 * D - cr) * grime; cg += (0.055 * D - cg) * grime; cb += (0.02 * D - cb) * grime; }
      let verd = 0;
      if (c.verd > 0) {
        // verdigris: matte green lumps, thickest in the notch between two rims and thinning down the seam
        const vv = nB.n2(U / 26 + 3, V / 40 + 9) * 0.5 + 0.5;
        verd = sstep(0.58, 0.72, vv + 0.5 * xs + 0.3 * Math.exp(-(c.a * al) / 210) + c.verd - 0.55);   // rubbed off the crown, kept in the corners
        if (verd > 0) {
          const vn = nA.n2(U / 6, V / 8) * 0.5 + 0.5, vm = verd * 0.92, vs = D * (0.75 + 0.5 * vn);
          cr += ((0.22 + 0.3 * vn) * vs - cr) * vm; cg += ((0.47 + 0.3 * vn) * vs - cg) * vm; cb += ((0.37 + 0.28 * vn) * vs - cb) * vm;
        }
      }
      const ao = (1 - 0.72 * Math.pow(xs, 2.6) * tight) * (1 - 0.5 * (gr > 1 ? 1 : gr));
      const mlt = c.tone * colFall[i] * ao;
      cr *= mlt; cg *= mlt; cb *= mlt;
      // film shoulder on the brightest channel: golds stay saturated, only the hottest cores bleach toward #ffe9a8
      let mx = cr > cg ? cr : cg; if (cb > mx) mx = cb;
      if (mx > 0.55) {
        const kk = (0.55 + 0.45 * (1 - Math.exp(-(mx - 0.55) / 0.45))) / mx; cr *= kk; cg *= kk; cb *= kk;
        if (mx > 1.1) { const wv = (1 - Math.exp(-(mx - 1.1) / 1.6)) * 0.85; cr += (1 - cr) * wv; cg += (1 - cg) * wv * 0.96; cb += (1 - cb) * wv * 0.8; }
      }
      const cov = Cv[k];
      px[o] = 255 * cr; px[o + 1] = 255 * cg; px[o + 2] = 255 * cb; px[o + 3] = 255 * cov;
      if (hp) {
        // a small hard light just behind the string: its glint sits on the crown of each bead and is switched on, coin by coin, in draw()
        const tp = (psi - 0.74) / 0.15, ta = (rT + 0.05) / 0.22;
        const hot = Math.exp(-tp * tp - ta * ta) * metal * (1 - 0.8 * rough) * (1 - 0.9 * verd) * occ * cov * 1.5;
        if (hot > 0.004) { hp[o] = 255; hp[o + 1] = 232; hp[o + 2] = 170; hp[o + 3] = 255 * (hot > 1 ? 1 : hot); }
      }
    }
  }
  const out = L.makeCanvas(RW, RH);
  out.getContext('2d').putImageData(img, 0, 0);
  let hot = null;
  if (hotImg) { hot = L.makeCanvas(RW, RH); hot.getContext('2d').putImageData(hotImg, 0, 0); }
  return { img: out, hot };
}

/** the hemp cord where it crosses one of the wide gaps: three twisted strands, fibres running along them. In the plane of focus. */
function shadeCord(G, gi, lg) {
  const { R, cx, cy, X0, Y0, LW, LH, coins, nA, nB, a } = G;
  const cl = coins[gi - 1], cr_ = coins[gi];
  const edgeL = (d) => cl.s + cl.w + cl.L * (d - cl.dtop), edgeR = (d) => cr_.s - cr_.w + cr_.L * (d - cr_.dtop);
  const d0 = CORD_D - CORD_R - 26, d1 = CORD_D + CORD_R + 30;
  const sA = Math.min(edgeL(d0), edgeL(d1)) - 60, sB = Math.max(edgeR(d0), edgeR(d1)) + 60, sMid = (edgeL(CORD_D) + edgeR(CORD_D)) / 2;
  let xa = 1e9, xb = -1e9, ya = 1e9, yb = -1e9;
  for (const sv of [sA, sB]) for (const dv of [d0, d1]) { const p = a.pt(sv / R, -dv); xa = Math.min(xa, p.x); xb = Math.max(xb, p.x); ya = Math.min(ya, p.y); yb = Math.max(yb, p.y); }
  const bx = Math.max(0, Math.floor(xa - X0)), by = Math.max(0, Math.floor(ya - Y0)), bw = Math.min(LW, Math.ceil(xb - X0)) - bx, bh = Math.min(LH, Math.ceil(yb - Y0)) - by;
  if (bw <= 0 || bh <= 0) return;
  const img = new ImageData(bw, bh), px = img.data;
  const sag = (gi % 2 ? 1 : -1) * 0.07, sg = 0.82, cg_ = 0.57;      // the strands climb at about 55° to the cord
  for (let j = 0; j < bh; j++) {
    const ddy = cy - (Y0 + by + j + 0.5);
    for (let i = 0; i < bw; i++) {
      const xw = X0 + bx + i + 0.5, ddx = xw - cx, rr = Math.sqrt(ddx * ddx + ddy * ddy), d = R - rr, s = Math.atan2(ddx, ddy) * R;
      const e1 = s - edgeL(d), e2 = edgeR(d) - s;
      if (e1 < -50 || e2 < -50) continue;
      const q = d - (CORD_D + sag * (s - sMid)), dd = q / CORD_R, ad = dd < 0 ? -dd : dd;
      const o = (j * bw + i) * 4, sl = s - sMid + gi * 131;
      const wall = sstep(-14, 30, e1) * sstep(-14, 30, e2);       // the flanking coins shade it
      if (ad >= 1) {
        // stray fibres standing off the cord
        if (ad < 1.3) {
          const hair = sstep(0.55, 0.8, nA.n2((sl * 0.94 - q * 0.34) / 1.7 + 40, (sl * 0.34 + q * 0.94) / 26)) * (1 - (ad - 1) / 0.3);
          if (hair > 0.02) { const v = 0.55 * wall; px[o] = 255 * 0.82 * v; px[o + 1] = 255 * 0.64 * v; px[o + 2] = 255 * 0.38 * v; px[o + 3] = 255 * hair * 0.8; }
        }
        continue;
      }
      const phi = Math.asin(dd), vv = phi * CORD_R;
      const wob = 0.1 * nA.n2(sl / 60, vv / 60);
      const ph = sl / 86 + (phi * 3) / TAU + wob + gi * 0.37, fr = ph - Math.floor(ph);
      const ridge = Math.pow(Math.sin(Math.PI * fr), 0.62);                                        // each strand is a rounded ridge
      const nz = Math.sqrt(1 - dd * dd);
      // strand flank: the side of each strand that faces the light (upper left)
      const flank = (0.5 - fr) * 2;
      let lit = 0.2 + 0.62 * nz + 0.3 * -dd + 0.22 * flank * (1 - ridge * 0.4);
      lit = lit < 0.04 ? 0.04 : lit;
      // yarns and fibres: nearly parallel to the cord, slightly twisted
      const al2 = sl * cg_ + vv * sg * 0.5, ac2 = vv - sl * 0.12;
      const yarn = nB.n2(al2 / 90 + gi * 7, ac2 / 7) * 0.5 + 0.5;
      const fib = nA.n2(al2 / 46 + gi * 13, ac2 / 2.3) * 0.5 + 0.5;
      const fine = nB.n2(al2 / 22, ac2 / 1.1 + 9) * 0.5 + 0.5;
      const tex = (0.55 + 0.3 * yarn + 0.38 * fib) * (0.82 + 0.36 * fine);
      const v = lit * (0.24 + 0.76 * ridge) * tex * (0.3 + 0.7 * wall) * 1.25;
      const sat = 0.5 + 0.5 * fib;                                                                 // bright fibres are paler
      let rC = 0.03 + v * (0.86 + 0.1 * sat), gC = 0.018 + v * (0.66 + 0.16 * sat), bC = 0.01 + v * (0.36 + 0.2 * sat);
      rC = rC > 1 ? 1 : rC; gC = gC > 1 ? 1 : gC; bC = bC > 1 ? 1 : bC;
      const aa = (1 - ad) * CORD_R + 0.5;
      px[o] = 255 * rC; px[o + 1] = 255 * gC; px[o + 2] = 255 * bC; px[o + 3] = 255 * (aa > 1 ? 1 : aa);
    }
  }
  const cv = L.makeCanvas(bw, bh);
  cv.getContext('2d').putImageData(img, 0, 0);
  lg.drawImage(cv, bx, by);
}

/** everything below the arc → one layer (plus the glint layer for the travelling light) */
async function buildString(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const X0 = -PAD, Y0 = Math.floor(a.crestY) - 44, LW = W + PAD * 2, LH = H + PAD - Y0;
  const envMap = makeEnv();
  const G = { a, R, cx, cy, X0, Y0, LW, LH, ...makeCoins(), nA: L.makeNoise('s02c-a'), nB: L.makeNoise('s02c-b'), ES: envMap.sharp, ER: envMap.rough };
  const hi = shadeCoins(G, 1, -12, 236, true);       // the row of beads, in focus
  const lo = shadeCoins(G, 2, 138, 9999, false);     // the body, which will be thrown out of focus anyway
  const ax = cx - X0, ay = cy - Y0;                  // arc centre in layer pixels

  const maskRad = (cw, ch, k, da, db, extra) => {    // alpha 0 above depth da → 1 below db (k = pixel scale)
    const m = L.makeCanvas(cw, ch), g = m.getContext('2d');
    g.fillStyle = L.radial(g, ax / k, ay / k, (R - db) / k, (R - da) / k, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
    g.fillRect(0, 0, cw, ch);
    if (extra) { g.fillStyle = L.linear(g, 0, 0, cw, 0, extra.map(([t, al]) => [t, `rgba(0,0,0,${al})`])); g.fillRect(0, 0, cw, ch); }
    return m;
  };
  const mixIn = (dst, src, mask) => {                // dst = dst·(1 − mask) + src·mask
    const t = L.makeCanvas(dst.width, dst.height), tg = t.getContext('2d');
    tg.drawImage(src, 0, 0); tg.globalCompositeOperation = 'destination-in'; tg.drawImage(mask, 0, 0);
    const g = dst.getContext('2d');
    g.save(); g.globalCompositeOperation = 'destination-out'; g.drawImage(mask, 0, 0);
    g.globalCompositeOperation = 'lighter'; g.drawImage(t, 0, 0); g.restore();
  };

  // body: the roll bulges toward the lens → softer and softer with depth, so the seams melt while the broad mirrored bands stay
  const lw = lo.img.width, lh = lo.img.height;
  const body = L.blurred(lo.img, 3.5);
  mixIn(body, L.blurred(lo.img, 7.5), maskRad(lw, lh, 2, 200, 300));
  mixIn(body, L.blurred(lo.img, 12), maskRad(lw, lh, 2, 300, 430));

  // beads: sharp at the limb, going soft below — and toward the left edge of frame, where the string leaves the plane of focus
  const top = L.makeCanvas(LW, LH), tg = top.getContext('2d');
  tg.drawImage(hi.img, 0, 0);
  mixIn(top, L.blurred(hi.img, 2.4), maskRad(LW, LH, 1, 62, 128, [[0, 1], [0.2, 0.9], [0.36, 0], [0.86, 0], [1, 0.7]]));
  mixIn(top, L.blurred(hi.img, 5.5), maskRad(LW, LH, 1, 128, 205, [[0, 1], [0.1, 0.8], [0.22, 0], [1, 0]]));
  tg.globalCompositeOperation = 'destination-out';
  tg.drawImage(maskRad(LW, LH, 1, 176, 228), 0, 0);
  tg.globalCompositeOperation = 'source-over';

  const layer = L.makeCanvas(LW, LH), lg = layer.getContext('2d');
  for (const gi of GAPS) shadeCord(G, gi, lg);
  lg.imageSmoothingEnabled = true; lg.imageSmoothingQuality = 'high';
  lg.drawImage(body, 0, 0, lw * 2, lh * 2);
  lg.drawImage(top, 0, 0);
  // falls away toward the bottom of frame
  lg.save(); lg.globalCompositeOperation = 'source-atop';
  lg.fillStyle = L.linear(lg, 0, 880 - Y0, 0, 1150 - Y0, [[0, 'rgba(8,5,2,0)'], [1, 'rgba(8,5,2,0.6)']]);
  lg.fillRect(0, 0, LW, LH);
  lg.restore();
  // bloom: only the hot parts, from a quarter-size copy; it also puts a breath of halation over the limb
  const bw = Math.round(LW / 4), bh = Math.round(LH / 4);
  const bloom = L.makeCanvas(bw, bh), bg = bloom.getContext('2d');
  bg.filter = 'brightness(0.62) contrast(2.8) blur(5px)';
  bg.drawImage(layer, 0, 0, bw, bh);
  bg.filter = 'none';
  bg.globalCompositeOperation = 'destination-in';
  bg.fillStyle = L.radial(bg, ax / 4, ay / 4, (R + 20) / 4, (R + 42) / 4, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
  bg.fillRect(0, 0, bw, bh);
  lg.save(); lg.globalCompositeOperation = 'screen'; lg.globalAlpha = 0.34;
  lg.drawImage(bloom, 0, 0, LW, LH);
  lg.restore();

  // glints for the travelling light
  const hot = L.blurred(hi.hot, 5), hg = hot.getContext('2d');
  hg.globalCompositeOperation = 'lighter'; hg.drawImage(hi.hot, 0, 0);
  const boxes = G.coins.map((c) => {
    const p = a.pt(c.s / R, -c.dtop);
    const x = Math.max(0, Math.floor(p.x - c.w - 34 - X0)), y = Math.max(0, Math.floor(p.y - 30 - Y0));
    return { s: c.s, x, y, w: Math.min(LW - x, Math.ceil(c.w * 2 + 68)), h: Math.min(LH - y, 210) };
  }).filter((b) => b.w > 0 && b.h > 0);
  const [layerBmp, hotBmp] = await Promise.all([createImageBitmap(layer), createImageBitmap(hot)]);
  return { layer: layerBmp, hot: hotBmp, boxes, X0, Y0 };
}

/** soft round sprite */
function dotSprite(color, stops) {
  const c = L.makeCanvas(64, 64), g = c.getContext('2d');
  g.fillStyle = L.radial(g, 32, 32, 0, 32, stops.map(([t, al]) => [t, L.rgba(color, al)]));
  g.fillRect(0, 0, 64, 64);
  return c;
}

/** dust hanging in the dark above the string: a few sharp motes, more that are out of focus */
function makeDust(a) {
  const r = L.rng('coins-s02-dust-b'), nz = L.makeNoise('s02-dust'), out = [];
  let guard = 0;
  while (out.length < 64 && guard++ < 6000) {
    const x = r.range(-40, W + 40), y = r.range(-30, 760);
    const clear = a.yAt(L.clamp(x, 0, W)) - y;                 // px above the rim tops
    if (clear < 36) continue;
    // drifts in loose clouds, thicker toward the upper left where the light comes in, thin just above the coins
    const dens = (0.25 + 0.75 * L.clamp(clear / 420)) * (0.35 + 0.65 * (nz.fbm(x / 420, y / 300, 2) * 0.5 + 0.5)) * (0.55 + 0.45 * L.clamp(1 - x / 1500));
    if (r() > dens) continue;
    const cls = r();
    const m = { x, y, ph: r(), f: r.range(0.5, 1.6), spr: r.int(0, 2) };
    if (cls < 0.5) { m.r = r.range(1.0, 2.4); m.al = r.range(0.3, 0.95); m.k = 1; }
    else if (cls < 0.84) { m.r = r.range(3.5, 8); m.al = r.range(0.1, 0.3); m.k = 1.6; }
    else { m.r = r.range(13, 30); m.al = r.range(0.035, 0.085); m.k = 2.4; m.spr = 3; }
    m.vx = r.range(4, 14) * m.k; m.vy = -r.range(2, 8) * m.k;
    out.push(m);
  }
  return out;
}

/** out-of-focus glints on the body of the roll: discs of light, bigger the nearer the brass is to the lens */
function makeBokeh(a) {
  const r = L.rng('coins-s02-bokeh'), out = [];
  const bands = [182, 300, 318, 250, 400];
  for (let i = 0; i < 30; i++) {
    const th = r.range(-0.4, 0.4), d = r.pick(bands) + r.range(-34, 34);
    const p = a.pt(th, -d);
    if (p.y > H + 30 || p.x < -40 || p.x > W + 40) continue;
    out.push({ x: p.x, y: p.y, r: L.lerp(16, 46, L.clamp((d - 150) / 280)) * r.range(0.7, 1.2), al: r.range(0.07, 0.24), ph: r(), f: r.range(0.6, 1.5), spr: r.int(0, 1) });
  }
  return out;
}

export default {
  name: '一串铜钱',
  tone: 'light',
  async init(env) {
    const a = env.arc;
    const str = await buildString(env);
    // the dark behind: not quite dead black — a breath of warm haze low down, and a veil of far dust
    const back = L.makeCanvas(W, H), g = back.getContext('2d');
    g.fillStyle = '#050403'; g.fillRect(0, 0, W, H);
    g.fillStyle = L.radial(g, a.cx - 160, a.crestY + 240, 120, 980, [[0, 'rgba(70,40,10,0.26)'], [0.5, 'rgba(50,28,8,0.1)'], [1, 'rgba(40,22,6,0)']]);
    g.fillRect(0, 0, W, H);
    g.fillStyle = L.radial(g, 380, 150, 0, 760, [[0, 'rgba(64,52,38,0.12)'], [1, 'rgba(64,52,38,0)']]);
    g.fillRect(0, 0, W, H);
    const nz = L.makeNoise('s02-far');
    L.speckle(g, { seed: 'coins-s02-far-b', count: 520, x: 0, y: 0, w: W, h: 740, rMin: 0.4, rMax: 1.3, colors: ['#ffe9a8', '#d9a441', '#fff4d6'], alpha: [0.05, 0.28],
      test: (x, y) => y < a.yAt(x) - 44 && nz.fbm(x / 300, y / 220, 3) > 0.08 - 0.3 * L.clamp(1 - x / 1300) });
    const sprites = [
      dotSprite('#ffe9a8', [[0, 1], [0.22, 0.6], [0.5, 0.16], [1, 0]]),
      dotSprite('#fff6dc', [[0, 1], [0.22, 0.6], [0.5, 0.16], [1, 0]]),
      dotSprite('#ffc66a', [[0, 1], [0.22, 0.6], [0.5, 0.16], [1, 0]]),
      dotSprite('#ffd98a', [[0, 0.8], [0.7, 0.8], [0.88, 1], [0.95, 0.4], [1, 0]]),   // out-of-focus disc
    ];
    const bokehSpr = [
      dotSprite('#ffc45e', [[0, 0.72], [0.74, 0.78], [0.88, 1], [0.96, 0.35], [1, 0]]),
      dotSprite('#ffdf9a', [[0, 0.72], [0.74, 0.78], [0.88, 1], [0.96, 0.35], [1, 0]]),
    ];
    S = { ...str, back, sprites, bokehSpr, dust: makeDust(a), bokeh: makeBokeh(a) };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.0085, 0.0085, p), zoom = L.lerp(1.0, 1.012, p);
    ctx.drawImage(S.back, 0, 0);

    // dust: slow drift, each mote breathing at its own rate
    ctx.save();
    for (const m of S.dust) {
      const tw = 0.42 + 0.58 * (0.5 + 0.5 * Math.sin(TAU * (p * m.f + m.ph)));
      const x = m.x + m.vx * p, y = m.y + m.vy * p, s = m.r * 5;
      ctx.globalAlpha = m.al * tw;
      ctx.drawImage(S.sprites[m.spr], x - s / 2, y - s / 2, s, s);
    }
    ctx.restore();

    // the string slides round its centre; a light travels along it and rim after rim flares as it passes
    const sw = L.lerp(-520, 330, L.ease.inOutQuad(p));
    L.cam(ctx, env, { rot, zoom }, () => {
      ctx.drawImage(S.layer, S.X0, S.Y0);
      ctx.globalCompositeOperation = 'lighter';
      for (const b of S.boxes) {
        const t = (b.s - sw) / 210, al = Math.exp(-t * t);
        if (al < 0.03) continue;
        ctx.globalAlpha = al;
        ctx.drawImage(S.hot, b.x, b.y, b.w, b.h, S.X0 + b.x, S.Y0 + b.y, b.w, b.h);
      }
      // defocused glints breathing on the body
      for (const b of S.bokeh) {
        ctx.globalAlpha = b.al * (0.5 + 0.5 * Math.sin(TAU * (p * b.f + b.ph)));
        ctx.drawImage(S.bokehSpr[b.spr], b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
      }
    });
    // … and a sheen follows the light over the body
    ctx.save(); a.clipBelow(ctx, 4);
    const sh = a.pt(sw / a.R, -170);
    L.glow(ctx, sh.x, sh.y, 420, '#ffb648', 0.1);
    ctx.restore();
  },
};
