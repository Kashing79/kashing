// s02 — 一串铜钱. Macro of a string of cash coins (一贯) coiled into a big ring and seen from straight above:
// every coin stands on edge across the cord, so the camera only ever sees rims (钱缘) — never a face, never an inscription.
// The roll of coins is a tube of radius A0 whose OUTER LIMB is the arc: along it each rim top is a small rounded brass
// bead with a glint, separated from its neighbours by a dark seam. Focus sits on that row of beads.
// Below the arc the rims curve up toward the lens and out of focus: the seams melt, and what is left is the lights mirrored
// in the brass as honey-coloured bands concentric with the arc, darker with depth. In a few slack places the hemp cord
// shows through, down on the axis of the roll (which lies in the plane of focus again).
//
// Everything under the arc is shaded per pixel in init(): each pixel is mapped onto its coin (thickness coordinate u,
// elevation α round the rim), a small height field (file marks, casting skin) bends the normal, and the normal looks
// up a banded "matcap" plus real specular lobes (a back-top rim light and a key). Depth of field is added afterwards.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 120;
const T0 = 61;        // mean coin thickness on screen (px, measured along the arc)
const A0 = 400;       // coin radius on screen (px) → the roll is a tube of radius A0 lying just under the arc
const ROPE_R = 62;    // half-thickness of the hemp cord on the axis of the roll
const AMAX = 2.0, NLUT = 2048;
const TS = 760;       // size of the scratch canvas for the travelling light
let S = null;

const sstep = (a, b, v) => { const t = L.clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

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

/** what the rim mirrors, given as [depth below the arc in px, colour] → Float32 LUT over the elevation angle α (0 = limb) */
function bandLut(stops) {
  const f = L.makeRamp(stops.map(([d, c]) => [Math.acos(1 - d / A0) / AMAX, c]));
  const out = new Float32Array(NLUT * 3);
  for (let i = 0; i < NLUT; i++) { const c = f(i / (NLUT - 1)); out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2]; }
  return out;
}

/** the coins of the string, left to right. Thickness is "基本一致、略有参差"; u is measured along the arc. */
function makeCoins(a) {
  const r = L.rng('coins-s02-guan');
  const span = a.span(PAD + 240), R = a.R;
  const slackAt = [-0.5, -0.172, 0.119, 0.5];                  // slack places in the string where the cord shows
  const verdAt = [-0.5, -0.3, -0.045, 0.255, 0.47];            // a touch of verdigris on these
  const coins = [], slackIdx = [];
  let th = -span, prev = null, li = 0;
  while (th < span) {
    const w = (T0 * (1 + r.range(-0.085, 0.085))) / 2;
    let gap = r.range(1.8, 3.4);
    if (prev) {
      let nth = th + (prev.w + w + gap) / R;
      if (li < slackAt.length && nth > slackAt[li]) { slackIdx.push(coins.length); li++; gap = r.range(21, 24); nth = th + (prev.w + w + gap) / R; }
      th = nth;
    }
    let kind = 0; const roll = r();
    if (roll < 0.22) kind = 1; else if (roll < 0.39) kind = 2;      // 1 = rubbed bright (磨亮的铜黄), 2 = dark old patina
    if (prev && kind === 2 && prev.kind === 2) kind = 0;
    const t = w * 2, dia = r.range(-7, 7), top = r.range(-3.0, 2.0), ph = r.range(0.45, 1.05) * r.sign();
    const hue = r();   // a few redder (more copper) and a few paler (more zinc) alloys
    const c = {
      th, w, kind,
      rw: t * r.range(0.3, 0.37), rh: t * r.range(0.27, 0.33), crown: r.range(2.0, 3.6),   // worn, rounded corners of the rim
      facet: r.chance(0.4) ? r.range(0.04, 0.09) : 0,                                      // filed from both faces → a faint ridge
      taper: r.range(-0.035, 0.035), tilt: r.range(-0.0025, 0.0025),
      a: A0 + dia, dc: A0 + dia + top,                                                     // rim top sits within ±3 px of the arc
      aoff: r.range(-0.014, 0.014),
      tone: r.range(0.93, 1.07),
      tr: hue < 0.16 ? 1.03 : 1, tg: hue < 0.16 ? 0.89 : hue > 0.84 ? 1.04 : 1, tb: hue < 0.16 ? 0.74 : hue > 0.84 ? 1.2 : 1,
      kb: kind === 1 ? 0.5 : kind === 2 ? 1.1 : 0.8,
      shin: kind === 1 ? r.range(240, 360) : kind === 2 ? r.range(60, 100) : r.range(130, 230),
      gloss: kind === 1 ? 1.25 : kind === 2 ? 0.55 : 0.95,
      tarn: kind === 1 ? r.range(0, 0.2) : kind === 2 ? r.range(0.4, 0.8) : r.range(0.15, 0.55),
      verd: 0, dirt: r.range(0.4, 1),
      cphi: Math.cos(ph), sphi: Math.sin(ph), su: r.range(0, 4000), ss: r.range(0, 4000),
      pitTh: kind === 1 ? 0.975 : r.range(0.9, 0.965),
    };
    coins.push(c); prev = c;
  }
  // coins either side of a slack place lean away from it, a little less with each coin
  for (const s of slackIdx) for (let k = 0; k < 4; k++) {
    const f = 0.03 * (1 - k / 4);
    if (coins[s + k]) coins[s + k].tilt += f;
    if (coins[s - 1 - k]) coins[s - 1 - k].tilt -= f;
  }
  for (const vt of verdAt) {
    let best = 0; for (let i = 1; i < coins.length; i++) if (Math.abs(coins[i].th - vt) < Math.abs(coins[best].th - vt)) best = i;
    coins[best].verd = r.range(0.2, 0.32);
  }
  for (let i = 0; i < coins.length; i++) {
    const c = coins[i], n = coins[i + 1];
    c.bR = n ? (c.th + c.w / R + n.th - n.w / R) / 2 : 9;
  }
  return { coins, span };
}

/** everything below the arc: the roll of coins, shaded per pixel */
async function buildString(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const X0 = -PAD, Y0 = Math.floor(a.crestY) - 70;
  const RW = W + PAD * 2, RH = H + PAD - Y0, N = RW * RH;
  const { coins, span } = makeCoins(a);
  const nA = L.makeNoise('s02c-a'), nB = L.makeNoise('s02c-b');

  // bright rim → brass → a dark band → a crisp reflected line → gold → honey → dark → line → … darker with depth
  const BAND = bandLut([[0, '#6e3d08'], [5, '#c48524'], [12, '#e6b045'], [24, '#f4c75a'], [40, '#e2aa3e'], [52, '#cf9029'], [60, '#9a5f12'], [70, '#7a470b'],
    [82, '#85500d'], [89, '#d89c34'], [96, '#ffe08a'], [103, '#f3bf50'], [120, '#e0a438'], [150, '#cd8a22'], [166, '#aa6a18'], [180, '#84500f'], [200, '#7a480d'],
    [208, '#b97c22'], [214, '#eab756'], [221, '#cf9230'], [244, '#c08020'], [272, '#9c6216'], [288, '#70430d'], [316, '#653c0c'], [324, '#96601a'], [340, '#a66c1c'],
    [372, '#80500f'], [400, '#5e390b'], [440, '#472a08'], [470, '#3a2208'], [552, '#2a1806']]);

  // theta → coin index
  const NB = 8192, binScale = NB / (2 * span);
  const lut = new Uint16Array(NB);
  for (let b = 0, ci = 0; b < NB; b++) { const th = -span + (b + 0.5) / binScale; while (ci < coins.length - 1 && th > coins[ci].bR) ci++; lut[b] = ci; }

  // ── pass 1: geometry + height field ──
  const Al = new Float32Array(N), Hh = new Float32Array(N), Sl = new Float32Array(N), Uu = new Float32Array(N), Xs = new Float32Array(N),
    Cv = new Float32Array(N), Cav = new Float32Array(N), Ci = new Uint16Array(N);
  const R2out = (R + 10) * (R + 10), nC = coins.length, QMIN = Math.cos(AMAX);
  for (let j = 0; j < RH; j++) {
    const ddy = cy - (Y0 + j);
    for (let i = 0; i < RW; i++) {
      const k = j * RW + i, ddx = X0 + i - cx, rr2 = ddx * ddx + ddy * ddy;
      if (rr2 > R2out) { Al[k] = -1; continue; }
      const rr = Math.sqrt(rr2), d = R - rr, th = Math.atan2(ddx, ddy);
      let b = ((th + span) * binScale) | 0; b = b < 0 ? 0 : b >= NB ? NB - 1 : b;
      let ci = lut[b], c = coins[ci];
      let u = (th - c.th) * R - c.tilt * (d - 150), au = u < 0 ? -u : u;
      if (au > c.w + 0.5) {
        const cj = u > 0 ? ci + 1 : ci - 1;
        if (cj < 0 || cj >= nC) { Al[k] = -1; continue; }
        const c2 = coins[cj], u2 = (th - c2.th) * R - c2.tilt * (d - 150), au2 = u2 < 0 ? -u2 : u2;
        if (au2 <= c2.w + 0.5) { ci = cj; c = c2; u = u2; au = au2; }
        else {                                    // in the seam between two coins
          const e1 = au - c.w, e2 = au2 - c2.w;
          Al[k] = -2; Hh[k] = e1 + e2; Uu[k] = u > 0 ? e1 / (e1 + e2) : e2 / (e1 + e2); Ci[k] = ci < cj ? ci : cj; Sl[k] = d; continue;
        }
      }
      // rim profile across the thickness: a low crown (or a filed ridge) with rounded corners. The corners are fullest where
      // the rim is seen in silhouette (the "beads" on the arc) and tighten as the rim turns to face the lens.
      const w = c.w, uw = u / w;
      let drop0 = c.crown * uw * uw, slope0 = (-2 * c.crown * u) / (w * w);
      if (c.facet > 0) { const q2 = Math.sqrt(u * u + 6); drop0 += c.facet * (q2 - 2.45); slope0 -= (c.facet * u) / q2; }
      slope0 += c.taper;
      let drop = drop0, slope = slope0, xs = 0, rk = 1, q = 0, aloc = 0;
      for (let pass = 0; pass < 2; pass++) {
        const rw = c.rw * rk, rh = c.rh * rk, flat = w - rw;
        drop = drop0; slope = slope0; xs = 0;
        if (au > flat) {
          xs = (au - flat) / rw; if (xs > 0.992) xs = 0.992;
          const sq = Math.sqrt(1 - xs * xs), sl = ((rh / rw) * xs) / sq;
          drop += rh * (1 - sq); slope -= u > 0 ? sl : -sl;
        }
        aloc = c.a - drop; q = (c.dc - d) / aloc;
        if (pass === 0) { if (q >= 0.955) break; rk = 1 - 0.52 * sstep(0.3, 0.85, Math.acos(q < QMIN ? QMIN : q)); }
      }
      const dtop = c.dc - aloc;
      let cov = (d - dtop) / Math.sqrt(1 + (slope * slope > 9 ? 9 : slope * slope)) + 0.5;
      if (cov <= 0) { Al[k] = -1; continue; }
      const cs2 = w + 0.5 - au; if (cs2 < cov) cov = cs2; if (cov > 1) cov = 1;
      if (q > 1) q = 1; else if (q < QMIN) q = QMIN;
      const al = Math.acos(q), sinA = Math.sqrt(1 - q * q);
      Al[k] = al; Cv[k] = cov; Ci[k] = ci; Sl[k] = slope; Uu[k] = u; Xs[k] = xs;
      // fine relief, laid out on the rim surface (U across the thickness, Sv round the circumference) so it foreshortens at the limb
      const fade = sstep(0.05, 0.24, sinA);
      const U = u + c.su, Sv = c.a * al + c.ss;
      const fu = U * c.cphi + Sv * c.sphi, fv = -U * c.sphi + Sv * c.cphi;
      let h = 0.2 * nA.n2(fu / 64, fv / 2.4) + 0.1 * nB.n2(fu / 30 + 7, fv / 1.15);       // oblique file marks (锉痕)
      h += 0.8 * nA.n2(U / 26 + 3.1, Sv / 44) + 0.2 * nB.n2(U / 8, Sv / 11 + 5);          // uneven casting skin
      cell(U / 13, Sv / 13);
      if (cId > c.pitTh) {                                                                 // the odd casting pore
        const rad = 0.1 + (0.22 * (cId - c.pitTh)) / (1 - c.pitTh), r2 = rad * rad;
        if (cD1 < r2) { const f = 1 - cD1 / r2; h -= rad * 5 * f * f; Cav[k] = f * fade; }
      }
      Hh[k] = h * fade;
    }
  }

  // ── pass 2: shade ──
  const img = new ImageData(RW, RH), px = img.data;            // the coins
  const hotImg = new ImageData(RW, RH), hp = hotImg.data;      // extra glints for the travelling light
  const undImg = new ImageData(RW, RH), up = undImg.data;      // what lies behind the slack gaps: darkness and the cord
  const nrm = (x, y, z) => { const m = Math.hypot(x, y, z); return [x / m, y / m, z / m]; };
  const LK = nrm(-0.07, 0.47, -0.88);   // key: high behind the string, a touch from the left → a glint on top of every rim
  const LR = nrm(-0.03, 0.3, -0.954);   // broad rim light from behind
  const colFall = new Float32Array(RW);
  for (let i = 0; i < RW; i++) { const x = X0 + i; colFall[i] = 0.76 + 0.34 * Math.exp(-((x - 800) / 860) * ((x - 800) / 860)); }
  const HOT_AL = Math.acos(1 - 120 / A0);
  for (let j = 0; j < RH; j++) {
    const Y = Y0 + j, ddy = cy - Y;
    for (let i = 0; i < RW; i++) {
      const k = j * RW + i, al = Al[k];
      if (al === -1) continue;
      const o = k * 4;
      if (al === -2) {
        // seam: darkness, a little warm bounce between the faces near the top, a warm dusk deeper down
        const g = Hh[k], d = Sl[k];
        const bounce = Math.exp(-(d > 0 ? d : 0) / 26) * 0.4 * sstep(1, 6, g);
        let gr = 5 + 96 * bounce, gg = 4 + 50 * bounce, gb = 3 + 8 * bounce;
        const ga = 255 * sstep(-2, 9, d);
        if (g <= 9) { const dk = sstep(70, 240, d); px[o] = gr + 46 * dk; px[o + 1] = gg + 22 * dk; px[o + 2] = gb + 3 * dk; px[o + 3] = ga; continue; }
        // a slack gap: the hemp cord crosses it on the axis of the roll — three twisted strands, lit from above
        const dd = (d - A0 + 12) / ROPE_R;
        if (dd > -1 && dd < 1) {
          const x = Uu[k], ci = Ci[k], along = (x - 0.5) * g, q = dd * ROPE_R;
          const lit = Math.sqrt(1 - dd * dd) * (0.74 - 0.26 * dd);
          const wob = nA.n2(along / 26 + ci * 3, q / 30) * 0.22;
          const phs = (along * 0.8 + q) / 50 + ci * 0.37 + wob, fr = phs - Math.floor(phs);
          const ridge = Math.pow(Math.sin(Math.PI * fr), 0.7);                              // each strand is a rounded ridge
          const fib = nA.n2((along * 0.62 - q * 0.78) / 2.4 + ci * 13, (along * 0.78 + q * 0.62) / 30) * 0.5 + 0.5;
          const fine = nB.n2(along / 1.3 + ci * 5, q / 1.3) * 0.5 + 0.5;
          const v = lit * (0.3 + 0.7 * ridge) * (0.62 + 0.5 * fib) * (0.85 + 0.3 * fine) * (0.5 + 0.5 * Math.sin(Math.PI * x)) * (0.6 + 0.4 * colFall[i]) * 1.12;
          gr += 26 * lit + 250 * v; gg += 11 * lit + 184 * v; gb += 88 * v;
        }
        up[o] = gr; up[o + 1] = gg; up[o + 2] = gb; up[o + 3] = ga;
        continue;
      }
      const ci = Ci[k], c = coins[ci];
      const ddx = X0 + i - cx, rr = Math.sqrt(ddx * ddx + ddy * ddy), sn = ddx / rr, cs = ddy / rr;
      const dk = sstep(90, 300, R - rr), seamK = 1 - 0.6 * dk;      // seams read softer where the roll is out of focus
      const kl = i > 0 && Al[k - 1] >= 0 && Ci[k - 1] === ci ? k - 1 : k, kr = i < RW - 1 && Al[k + 1] >= 0 && Ci[k + 1] === ci ? k + 1 : k;
      const ku = j > 0 && Al[k - RW] >= 0 && Ci[k - RW] === ci ? k - RW : k, kd = j < RH - 1 && Al[k + RW] >= 0 && Ci[k + RW] === ci ? k + RW : k;
      const hx = (Hh[kr] - Hh[kl]) * (kr - kl === 2 ? 0.5 : 1), hy = (Hh[kd] - Hh[ku]) * (kd - ku === 2 * RW ? 0.5 : 1);
      const ht = hx * cs + hy * sn, hv = -hx * sn + hy * cs;     // along the arc / toward the centre
      const sinA = Math.sin(al), bend = hv * sinA * c.kb;
      let an = al - bend; an = an < 0 ? 0 : an > AMAX ? AMAX : an;
      const mt = ht * c.kb + Sl[k];
      const nt = -mt / Math.sqrt(1 + mt * mt), c0 = Math.sqrt(1 - nt * nt);
      const nr = Math.cos(an) * c0, nz = Math.sin(an) * c0;
      // the mirrored bands: looked up with a gentler bend so they stay clean, stepping a little from coin to coin
      let anl = al - bend * 0.3 + c.aoff * sinA; anl = anl < 0 ? 0 : anl > AMAX ? AMAX : anl;
      const li = (((anl / AMAX) * (NLUT - 1)) | 0) * 3;
      let cr = BAND[li], cg = BAND[li + 1], cb = BAND[li + 2];
      if (c.kind === 2) { cr = 24 + cr * 0.54; cg = 11 + cg * 0.47; cb = 3 + cb * 0.4; }          // dark old patina: lower, flatter
      else if (c.kind === 1) { cr = cr * 1.05 + 8; cg = cg * 1.1 + 7; cb = cb * 1.3 + 5; }        // rubbed bright
      cr *= c.tr; cg *= c.tg; cb *= c.tb;
      const xs = Xs[k], cav = Cav[k];
      // surface state: tarnish (warmer, darker), grime packed into the seams, pores
      const U = Uu[k] + c.su, Sv = c.a * al + c.ss;
      const tn = sstep(0.45, 0.9, nA.n2(U / 60 + 11, Sv / 120 - 4) * 0.5 + 0.5 + 0.3 * xs) * c.tarn;
      if (tn > 0) { cr *= 1 - 0.12 * tn; cg *= 1 - 0.24 * tn; cb *= 1 - 0.34 * tn; }
      const grime = sstep(0.55, 1, xs) * c.dirt * 0.5 * seamK;
      if (grime > 0) { cr += (40 - cr) * grime; cg += (20 - cg) * grime; cb += (5 - cb) * grime; }
      // light: key from the upper left; corners turn toward the neighbouring coin and fall into its shadow
      let side = 1 - 0.85 * nt - 0.45 * nt * nt; side = side < 0.14 ? 0.14 : side > 1.45 ? 1.45 : side;
      side = 1 + (side - 1) * (1 - 0.5 * dk);
      const ao = 1 - 0.78 * Math.pow(xs, 2.6) * seamK;
      const m = c.tone * colFall[i] * side * ao * (1 - 0.65 * cav);
      cr *= m; cg *= m; cb *= m;
      // speculars: reflect the view vector (0,0,1) about the normal
      const rT = 2 * nz * nt, rR = 2 * nz * nr, rZ = 2 * nz * nz - 1;
      const sk = rT * LK[0] + rR * LK[1] + rZ * LK[2], sr = rT * LR[0] + rR * LR[1] + rZ * LR[2];
      const occ = (1 - 0.8 * xs * xs) * (1 - 0.8 * cav) * colFall[i];
      let verd = 0;
      if (c.verd > 0) {
        // verdigris: matte green lumps, thickest in the notch between two rims and thinning down the seam
        const sl = c.a * al;
        const vv = nB.n2(U / 20 + 3, Sv / 32 + 9) * 0.5 + 0.5;
        verd = sstep(0.6, 0.72, vv + 0.45 * xs + 0.3 * Math.exp(-sl / 190) + c.verd - 0.55);   // rubbed off the crown, kept in the corners
        if (verd > 0) {
          const lam = L.clamp(0.3 + nr * 0.55 + nz * 0.35 - nt * 0.25), vn = nA.n2(U / 5, Sv / 6.5) * 0.5 + 0.5;
          const vm = verd * 0.9, vs = (0.5 + 0.62 * lam) * (0.85 + 0.3 * vn) * colFall[i];
          cr += ((54 + 36 * vn) * vs - cr) * vm; cg += ((126 + 38 * vn) * vs - cg) * vm; cb += ((90 + 30 * vn) * vs - cb) * vm;
        }
      }
      const metal = (1 - 0.9 * verd) * occ;
      if (sr > 0) { const rim = Math.pow(sr, 7) * 0.3 * metal * (0.6 + 0.4 * c.gloss); cr += 255 * rim; cg += 182 * rim; cb += 78 * rim; }
      let spec = 0;
      if (sk > 0) { spec = Math.pow(sk, c.shin) * c.gloss * metal * 1.6; cr += 255 * spec; cg += 240 * spec; cb += 190 * spec; }
      // micro-glitter where the light rakes the filed surface
      const gl = nB.n2(U / 1.7 + 50, Sv / 1.7) - 0.52;
      if (gl > 0 && sr > 0.5) { const sp = gl * 170 * (sr - 0.5) * metal * c.gloss; cr += sp; cg += sp * 0.9; cb += sp * 0.62; }
      const cov = Cv[k];
      px[o] = cr; px[o + 1] = cg; px[o + 2] = cb; px[o + 3] = 255 * cov;
      // extra energy that only shows inside the travelling light (see draw): wider glints on the rim tops
      if (al < HOT_AL && sk > 0) {
        const hot = (Math.pow(sk, 50) * 0.62 + spec * 0.5) * metal * c.gloss * cov;
        if (hot > 0.004) { hp[o] = 255; hp[o + 1] = 230; hp[o + 2] = 160; hp[o + 3] = 255 * (hot > 1 ? 1 : hot); }
      }
    }
  }
  const base = L.makeCanvas(RW, RH);
  base.getContext('2d').putImageData(img, 0, 0);
  const coinsC = L.makeCanvas(RW, RH), g = coinsC.getContext('2d');
  g.drawImage(base, 0, 0);
  // macro depth of field: focus sits on the row of rim tops; below, the roll bulges toward the lens and goes progressively soft,
  // so the seams melt while the broad mirrored bands stay
  const ax = cx - X0, ay = cy - Y0;
  const soften = (blurPx, d0, d1) => {            // sharp above depth d0, fully this blur below d1
    const b = L.blurred(base, blurPx), bg = b.getContext('2d');
    bg.globalCompositeOperation = 'destination-in';
    bg.fillStyle = L.radial(bg, ax, ay, R - d1, R - d0, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
    bg.fillRect(0, 0, RW, RH);
    g.drawImage(b, 0, 0);
  };
  soften(2.5, 110, 190);
  soften(6, 190, 280);
  soften(10, 280, 380);
  soften(14, 380, 470);
  // out of focus the brass glows: lift the body toward a clean saturated honey …
  const dStops = (list) => list.map(([d, c]) => [1 - d / 540, c]).reverse();
  const fullRad = (stops) => { const c = L.makeCanvas(RW, RH), t = c.getContext('2d'); t.fillStyle = L.radial(t, ax, ay, R - 540, R, dStops(stops)); t.fillRect(0, 0, RW, RH); return c; };
  L.overlayOn(coinsC, fullRad([[0, 'rgba(255,170,50,0)'], [70, 'rgba(255,170,50,0)'], [150, 'rgba(255,160,36,0.7)'], [300, 'rgba(255,150,26,1)'], [540, 'rgba(255,136,18,1)']]),
    { blend: 'soft-light', alpha: 0.5 });
  // … and restate the mirrored lights as clean concentric bands over the melted seams (grey: >128 lifts, <128 deepens)
  const gy = (v, al = 1) => `rgba(${v},${v},${v},${al})`;
  L.overlayOn(coinsC, fullRad([[0, gy(128, 0)], [100, gy(128, 0)], [124, gy(164)], [150, gy(140)], [176, gy(104)], [198, gy(88)], [208, gy(150)], [215, gy(190)], [224, gy(158)],
    [262, gy(134)], [292, gy(92)], [314, gy(86)], [324, gy(150)], [340, gy(166)], [372, gy(122)], [410, gy(94)], [450, gy(108)], [470, gy(128)], [540, gy(128)]]),
    { blend: 'overlay', alpha: 0.5 });
  // then let it fall away toward the bottom of frame
  g.save(); g.globalCompositeOperation = 'source-atop';
  g.fillStyle = L.linear(g, 0, 860 - Y0, 0, 1150 - Y0, [[0, 'rgba(10,6,3,0)'], [1, 'rgba(10,6,3,0.7)']]);
  g.fillRect(0, 0, RW, RH);
  g.restore();

  // assemble: darkness + cord behind, the (soft-edged) coins in front
  const layer = L.makeCanvas(RW, RH), lg = layer.getContext('2d');
  lg.putImageData(undImg, 0, 0);
  lg.drawImage(coinsC, 0, 0);

  const hotSharp = L.makeCanvas(RW, RH);
  hotSharp.getContext('2d').putImageData(hotImg, 0, 0);
  const hot = L.blurred(hotSharp, 6), hg = hot.getContext('2d');
  hg.globalCompositeOperation = 'lighter'; hg.drawImage(hotSharp, 0, 0);

  // bloom source: only the hot parts, at quarter size
  const bw = Math.round(RW / 4), bh = Math.round(RH / 4);
  const bloom = L.makeCanvas(bw, bh), bg2 = bloom.getContext('2d');
  bg2.filter = 'brightness(0.7) contrast(2.6) blur(4.5px)';
  bg2.drawImage(layer, 0, 0, bw, bh);
  bg2.filter = 'none';
  // bake the big layers to bitmaps so the per-frame draws stay cheap
  const [coinsBmp, hotBmp] = await Promise.all([createImageBitmap(layer), createImageBitmap(hot)]);
  return { coins: coinsBmp, hot: hotBmp, bloom, X0, Y0, RW, RH };
}

/** soft round sprite */
function dotSprite(color, stops) {
  const c = L.makeCanvas(64, 64), g = c.getContext('2d');
  g.fillStyle = L.radial(g, 32, 32, 0, 32, stops.map(([t, al]) => [t, L.rgba(color, al)]));
  g.fillRect(0, 0, 64, 64);
  return c;
}

/** dust hanging in the dark above the string */
function makeDust(a) {
  const r = L.rng('coins-s02-dust'), out = [];
  let guard = 0;
  while (out.length < 150 && guard++ < 6000) {
    const x = r.range(-40, W + 40), y = r.range(-30, 760);
    const clear = a.yAt(L.clamp(x, 0, W)) - y;                 // px above the rim tops
    if (clear < 30) continue;
    if (r() > 0.22 + 0.78 * L.clamp(clear / 430)) continue;    // thinner just above the coins
    const cls = r();
    const m = { x, y, ph: r(), f: r.range(0.5, 1.7), spr: r.int(0, 2) };
    if (cls < 0.87) { m.r = r.range(0.9, 2.3); m.al = r.range(0.25, 0.95); m.k = 1; }
    else if (cls < 0.97) { m.r = r.range(3.5, 7); m.al = r.range(0.1, 0.26); m.k = 1.7; }
    else { m.r = r.range(14, 26); m.al = r.range(0.03, 0.055); m.k = 2.6; m.spr = 3; }
    m.vx = r.range(4, 15) * m.k; m.vy = -r.range(2, 9) * m.k;
    out.push(m);
  }
  return out;
}

export default {
  name: '一串铜钱',
  tone: 'light',
  async init(env) {
    const a = env.arc;
    const str = await buildString(env);
    // the dark behind: not quite dead black — a breath of warm haze low down and a veil of very fine far dust
    const back = L.makeLayer(30, (g) => {
      g.fillStyle = '#050403'; g.fillRect(-30, -30, W + 60, H + 60);
      g.fillStyle = L.radial(g, a.cx - 140, a.crestY + 260, 120, 1000, [[0, 'rgba(70,40,10,0.3)'], [0.5, 'rgba(50,28,8,0.12)'], [1, 'rgba(40,22,6,0)']]);
      g.fillRect(-30, -30, W + 60, H + 60);
      L.speckle(g, { seed: 'coins-s02-far', count: 420, x: -30, y: -30, w: W + 60, h: 760, rMin: 0.35, rMax: 1.1, colors: ['#ffe9a8', '#d9a441', '#fff4d6'], alpha: [0.05, 0.3],
        test: (x, y) => y < a.yAt(L.clamp(x, 0, W)) - 40 });
    });
    const sprites = [
      dotSprite('#ffe9a8', [[0, 1], [0.22, 0.6], [0.5, 0.16], [1, 0]]),
      dotSprite('#fff6dc', [[0, 1], [0.22, 0.6], [0.5, 0.16], [1, 0]]),
      dotSprite('#ffc66a', [[0, 1], [0.22, 0.6], [0.5, 0.16], [1, 0]]),
      dotSprite('#ffd98a', [[0, 0.8], [0.7, 0.8], [0.88, 1], [0.95, 0.4], [1, 0]]),   // out-of-focus disc
    ];
    const tmp = L.makeCanvas(TS, TS);
    S = { ...str, back, sprites, dust: makeDust(a), tmp, tg: tmp.getContext('2d') };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.0085, 0.0085, p), zoom = L.lerp(1.0, 1.012, p);
    const cam = { rot, zoom };
    L.blit(ctx, env, S.back, { dx: 5 * p, dy: -3 * p });

    // dust: slow drift, each mote breathing at its own rate
    ctx.save();
    for (const m of S.dust) {
      const tw = 0.42 + 0.58 * (0.5 + 0.5 * Math.sin(L.TAU * (p * m.f + m.ph)));
      const x = m.x + m.vx * p, y = m.y + m.vy * p, s = m.r * 5;
      ctx.globalAlpha = m.al * tw;
      ctx.drawImage(S.sprites[m.spr], x - s / 2, y - s / 2, s, s);
    }
    ctx.restore();

    // light spilling over the back of the string
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = L.radial(ctx, a.cx, a.cy, a.R - 12, a.R + 150, [[0, 'rgba(226,150,48,0.24)'], [0.22, 'rgba(184,121,31,0.1)'], [1, 'rgba(184,121,31,0)']]);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // the string itself slides round its centre
    L.cam(ctx, env, cam, () => {
      ctx.drawImage(S.coins, S.X0, S.Y0);
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.3;
      ctx.drawImage(S.bloom, S.X0, S.Y0, S.RW, S.RH);
    });

    // a light travelling along the string: rim after rim flares as it passes, and a sheen follows it over the body
    const thw = L.lerp(-0.2, 0.11, L.ease.inOutQuad(p)), wp = a.pt(thw, -40);
    const ox = Math.round(wp.x - TS / 2), oy = Math.round(wp.y - TS / 2), tg = S.tg;
    tg.setTransform(1, 0, 0, 1, -ox, -oy); tg.globalCompositeOperation = 'source-over'; tg.clearRect(ox, oy, TS, TS);
    L.cam(tg, env, cam, () => tg.drawImage(S.hot, S.X0, S.Y0));
    tg.globalCompositeOperation = 'destination-in';
    tg.fillStyle = L.radial(tg, wp.x, wp.y, 0, TS / 2, [[0, 'rgba(0,0,0,1)'], [0.42, 'rgba(0,0,0,0.62)'], [1, 'rgba(0,0,0,0)']]);
    tg.fillRect(ox, oy, TS, TS);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(S.tmp, ox, oy); ctx.restore();
    ctx.save(); a.clipBelow(ctx, 4);
    const sh = a.pt(thw, -170);
    L.glow(ctx, sh.x, sh.y, 430, '#ffb648', 0.12);
    ctx.restore();

    L.vignette(ctx, { strength: 0.3, inner: 0.52 });
  },
};
