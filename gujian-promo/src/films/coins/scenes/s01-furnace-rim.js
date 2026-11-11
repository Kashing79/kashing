// s01 — 炉火映钱郭. The opening image, and the one the film returns to: an eclipse.
// The arc is the top of the raised outer rim (外郭) of one enormous cash coin, seen as a silhouette against the glow of the
// furnace behind it. Above the arc the glow is a pure gradient (white-hot at the edge → 炽橙 → 暗红 → 铜绿黑); below it the coin
// is almost black: a hair-line of orange on the rounded edge, then the broad rim band and its inner step barely lifted out
// of the dark by a cold verdigris-coloured fill light, then nothing. No inscription is shown.
//
// Everything is shaded per pixel once, in init, into one tall dithered plate (frame + the dark space above it that the title
// card tilts up into). Two small additive "difference" plates carry the motion: the glow spreading sideways along the arc,
// and one slow breath of the hot centre. The coin itself never moves.
import * as L from '../../../lib/core.js';

const { W, H } = L;

export const TITLE_TILT = 720;      // px the title card tilts up
const TOP = TITLE_TILT + 8;         // rows of sky kept above the frame
const GLOW_MAX = 390;               // the glow has died away completely this far above the arc (px)
const RIMW = 250, BEV = 9, STEP = 14, RELIEF = 5;   // outer rim: width, rounded edge, inner step, height (px)
const HMAX = 1.12, NH = 2048;
const FLOOR = [2, 5, 4];            // 钱体黑 #020504
const COOL = [13, 40, 34];          // the cold fill light that finds the rim (copper-green)
const STRATA = 0.035;                // faint concentric layering in the glow (smoke / heat), never a flame shape

// heat → colour. The palette anchors: 暗红 #8a1c10 @0.30, 炽橙 #ff7a1a @0.68, 炉心亮 #ffd08a @0.90
const HEAT = [[0, '#000000'], [0.05, '#140504'], [0.10, '#2a0906'], [0.18, '#521009'], [0.30, '#8a1c10'], [0.42, '#b82e10'],
  [0.55, '#e04a12'], [0.68, '#ff7a1a'], [0.80, '#ffa340'], [0.90, '#ffd08a'], [1.0, '#fff0cf'], [1.12, '#fff8ea']];
// the dark space, by height above the arc (px): 铜绿黑 #07120f, a shade fuller near the fire, deeper far up
const SKY = [[0, '#091915'], [350, '#091814'], [650, '#081511'], [900, '#07120f'], [1200, '#060f0d'], [1700, '#050d0b']];

// embers: [U = px along the arc from the crest, dr = px above the arc, core radius, brightness, soft (out-of-focus radius, 0 = sharp)]
const SPARKS = [
  [-318, 22, 1.3, 1.0, 0], [96, 40, 1.5, 1.0, 0], [432, 18, 1.0, 0.8, 0], [-112, 78, 1.1, 0.85, 0], [246, 96, 1.2, 0.8, 0],
  [-540, 34, 1.0, 0.7, 0], [28, 150, 1.0, 0.7, 0], [-226, 196, 1.1, 0.6, 0], [372, 232, 0.9, 0.5, 0], [-58, 318, 0.9, 0.45, 0],
  [640, 52, 0.9, 0.55, 0], [168, 60, 0, 0.5, 4.6], [-402, 128, 0, 0.36, 5.4],
  // a very few, far up in the dark (they sit outside the title's place)
  [-648, 612, 0.8, 0.3, 0], [596, 748, 0.8, 0.26, 0], [-772, 968, 0.7, 0.22, 0],
];

const sstep = (a, b, v) => { const t = L.clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// tiny allocation-free worley noise (squared distance in cD1, cell id in cId)
let cD1 = 0, cId = 0;
function cell(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let d1 = 9, id = 0;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const qx = xi + ox, qy = yi + oy;
    let h = (Math.imul(qx, 374761393) + Math.imul(qy, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    const dx = qx + (h & 1023) / 1023 - x, dy = qy + ((h >>> 10) & 1023) / 1023 - y, d = dx * dx + dy * dy;
    if (d < d1) { d1 = d; id = ((h >>> 20) & 255) / 255; }
  }
  cD1 = d1; cId = id;
}

function build(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy, crest = a.crestY;

  // ── look-up tables ──
  const hf = L.makeRamp(HEAT), heat = new Float32Array(NH * 3);
  for (let i = 0; i < NH; i++) { const c = hf((i / (NH - 1)) * HMAX); heat[i * 3] = c[0]; heat[i * 3 + 1] = c[1]; heat[i * 3 + 2] = c[2]; }
  // how the heat falls off with height above the arc (at the crest; the sides use a compressed copy)
  const TPN = GLOW_MAX * 4 + 4, TP = new Float32Array(TPN);
  for (let i = 0; i < TPN; i++) { const dd = i / 4; TP[i] = Math.exp(-Math.pow(dd / 95, 0.78)) * (1 - sstep(170, GLOW_MAX - 5, dd)); }
  const BMAX = 1700, bf = L.makeRamp(SKY.map(([dd, c]) => [dd / BMAX, c])), base = new Float32Array((BMAX + 1) * 3);
  for (let i = 0; i <= BMAX; i++) { const c = bf(i / BMAX); base[i * 3] = c[0]; base[i * 3 + 1] = c[1]; base[i * 3 + 2] = c[2]; }
  // along the arc: amplitude (a*) and thickness (m*) of the glow in three states —
  // A = the opening frame (hot centre, thin embers out to the sides), B = spread wide, C = A with the centre swollen (the breath)
  const UOFF = 1300, UN = UOFF * 2 + 1;
  const aA = new Float32Array(UN), mA = new Float32Array(UN), gA = new Float32Array(UN);
  const aB = new Float32Array(UN), mB = new Float32Array(UN), gB = new Float32Array(UN);
  const aC = new Float32Array(UN), mC = new Float32Array(UN), gC = new Float32Array(UN);
  const hzL = new Float32Array(UN), shL = new Float32Array(UN);
  for (let i = 0; i < UN; i++) {
    const U = i - UOFF;
    const g0 = Math.exp(-Math.pow(U / (U < 0 ? 590 : 640), 2)), g1 = Math.exp(-Math.pow(U / 1180, 2)), gb = Math.exp(-Math.pow(U / 820, 2));
    aA[i] = 0.74 + 0.38 * g0; mA[i] = 0.55 + 0.45 * g0; gA[i] = g0;
    aB[i] = 0.84 + 0.28 * g1; mB[i] = 0.74 + 0.26 * g1; gB[i] = g1;
    aC[i] = aA[i] + 0.05 * gb; mC[i] = mA[i] * (1 + 0.09 * gb); gC[i] = g0 + 0.3 * gb;
    hzL[i] = 0.6 + 0.4 * Math.exp(-Math.pow((U + 160) / 820, 2));   // the fill light is a little stronger left of centre
    shL[i] = Math.exp(-Math.pow((U + 240) / 560, 2));               // where the rim's dull sheen sits
  }

  // ── the coin's relief (height in px), everything below the arc ──
  const YC0 = Math.floor(crest) - 2, CH = H - YC0;
  const hgt = new Float32Array(W * CH), vrd = new Float32Array(W * CH), rimM = new Float32Array(W * CH);
  const nA = L.makeNoise('s01a'), nB = L.makeNoise('s01b'), nS = L.makeNoise('s01s');
  for (let j = 0; j < CH; j++) {
    const ddy = cy - (YC0 + j + 0.5), ddy2 = ddy * ddy;
    for (let i = 0; i < W; i++) {
      const dx = i + 0.5 - cx, V = R - Math.sqrt(dx * dx + ddy2);
      if (V < -1.5) continue;
      const Vc = V < 0 ? 0 : V, U = Math.atan2(dx, ddy) * R, k = j * W + i;
      const rimw = RIMW + 1.6 * nA.n2(U / 170, 5.5) + 0.6 * nB.n2(U / 41, 8.8);   // a cast edge is never ruler-true
      let prof;
      if (Vc < BEV) { const q = 1 - Vc / BEV; prof = RELIEF * (1 - q * q); }       // the worn, rounded outer edge
      else if (Vc < rimw) prof = RELIEF;                                             // the flat top of the rim
      else prof = RELIEF * (1 - sstep(0, STEP, Vc - rimw));                          // the step down into the field
      const onRim = 1 - sstep(rimw - 3, rimw + STEP, Vc);
      const g1 = nA.n2(U / 2.6, Vc / 2.6), g2 = nB.n2(U / 7 + 31, Vc / 7);           // sand-cast grain
      const m = nA.fbm(U / 46 + 7, Vc / 46 - 3, 3);                                  // slow swell of the patina crust
      const big = nB.fbm(U / 260 - 11, Vc / 260 + 4, 2);
      const drift = sstep(-0.2, 0.3, big + 0.3 * m);                                 // where the patina crust lies thicker
      // traces of the file that dressed the rim, running round it; the crust has buried most of them
      const file = (0.13 * nB.n2(U / 190, Vc / 2.3 + 77) + 0.2 * nA.n2(U / 280 + 50, Vc / 7.5)) * onRim * (1 - 0.7 * drift) * sstep(10, 45, Vc);
      cell(U / 20, Vc / 20);                                                         // rust grains: small raised granules, in drifts
      let nod = 0;
      if (cId > 0.45) {
        const e = (cId - 0.45) / 0.55, rad = 0.12 + 0.18 * e, q = 1 - Math.sqrt(cD1) / rad;
        if (q > 0) nod = q * q * (3 - 2 * q) * (0.5 + 0.8 * e) * drift;
      }
      const fade = sstep(0, 5, Vc);   // roughness grows in from the silhouette, which stays a clean arc
      hgt[k] = prof + fade * (0.07 * g1 + 0.13 * g2 + 1.4 * m + file + nod);
      vrd[k] = L.clamp(0.45 + 0.8 * big + 0.3 * m + nod);
      rimM[k] = onRim;
    }
  }

  // ── shade: the plate (state A) and the two difference plates (B − A, C − A) ──
  const PH = H + TOP, img = new ImageData(W, PH), d = img.data;
  const YB0 = Math.floor(crest - GLOW_MAX - 4), BH = H - YB0;
  const i1 = new ImageData(W, BH), e1 = i1.data, i2 = new ImageData(W, BH), e2 = i2.data;
  let oR = 0, oG = 0, oB = 0;
  const sky = (drc, bi, mm, amp, st) => {
    let q = (drc / mm) * 4; if (q > TPN - 2) q = TPN - 2;
    const qi = q | 0;
    let t = (TP[qi] + (TP[qi + 1] - TP[qi]) * (q - qi)) * amp * st; if (t > HMAX) t = HMAX;
    const hi = ((t / HMAX) * (NH - 1) | 0) * 3;
    // the cold base only shows where the heat has died away, so the reds stay clean instead of going brown
    const kb = 1 - sstep(0, 0.14, t);
    oR = heat[hi] + base[bi] * kb; oG = heat[hi + 1] + base[bi + 1] * kb; oB = heat[hi + 2] + base[bi + 2] * kb;
  };
  let sd = 0x2545f491 | 0;
  for (let py = 0; py < PH; py++) {
    const yi = py - TOP, ddy = cy - (yi + 0.5), ddy2 = ddy * ddy;
    const j = yi - YC0, bo = (yi - YB0) * W * 4;
    for (let px = 0; px < W; px++) {
      const dx = px + 0.5 - cx, rr = Math.sqrt(dx * dx + ddy2), dr = rr - R;
      let r, g, b, rB = 0, gB = 0, bB = 0, rC = 0, gC = 0, bC = 0, band = false;
      if (dr >= GLOW_MAX) {
        const bi = (dr > BMAX ? BMAX : dr | 0) * 3;
        r = base[bi]; g = base[bi + 1]; b = base[bi + 2];
      } else {
        band = true;
        const U = Math.atan2(dx, ddy) * R;
        let ui = Math.round(U) + UOFF; ui = ui < 0 ? 0 : ui >= UN ? UN - 1 : ui;
        const drc = dr > 0 ? dr : 0, bi = (drc | 0) * 3;
        const cov = dr >= 0.5 ? 0 : dr <= -0.5 ? 1 : 0.5 - dr;   // 1 px anti-aliased silhouette exactly on the arc
        r = g = b = 0;
        if (cov < 1) {
          const st = drc > 14 ? 1 + STRATA * nS.fbm(U / 640, drc / 28, 2) * sstep(14, 70, drc) : 1;
          sky(drc, bi, mA[ui], aA[ui], st); r = oR; g = oG; b = oB;
          sky(drc, bi, mB[ui], aB[ui], st); rB = oR; gB = oG; bB = oB;
          sky(drc, bi, mC[ui], aC[ui], st); rC = oR; gC = oG; bC = oB;
        }
        if (cov > 0) {
          const V = dr < 0 ? -dr : 0, k = j * W + px;
          const hx = (hgt[k + (px < W - 1 ? 1 : 0)] - hgt[k - (px > 0 ? 1 : 0)]) * 0.5;
          const hy = (hgt[k + (j < CH - 1 ? W : 0)] - hgt[k - (j > 0 ? W : 0)]) * 0.5;
          const sn = dx / rr, cs = ddy / rr;
          const dV = -hx * sn + hy * cs, dU = hx * cs + hy * sn;   // slope going inward / along the arc
          // warm: the furnace light wraps over the rounded edge and rakes a little way down the rim
          let lw = 0.4 + 1.0 * dV; lw = lw < 0 ? 0 : lw > 1.3 ? 1.3 : lw;
          let line = 0;
          if (V < 16) { const bead = 0.9 + 0.2 * nS.n2(U / 13, 1.7) + 0.1 * nS.n2(U / 4.6, 9.1); line = 0.42 * Math.exp(-V / 2.6) * bead; }
          const warm = line + (0.2 * Math.exp(-V / 9) + 0.14 * Math.exp(-V / 40) + 0.02 * Math.exp(-V / 150)) * lw;
          const veil = 0.03 * Math.exp(-V / 80);   // a breath of lens glare over the black
          // cold: a dim copper-green fill from the front and below finds the rim's flat top and the lip of its inner step
          const onRim = rimM[k], v = vrd[k];
          let lc = 0.44 - 1.45 * dV - 0.4 * dU; lc = lc < 0 ? 0 : lc > 2.6 ? 2.6 : lc;
          const sheenV = (V - 118) / 72;
          lc += 0.38 * Math.exp(-sheenV * sheenV) * shL[ui] * onRim;
          const fld = 0.04 + 0.5 * (1 - sstep(RIMW + 30, RIMW + 250, V));
          const ic = sstep(14, 58, V) * (fld + (1 - fld) * onRim) * hzL[ui] * lc;
          const cr = FLOOR[0] + COOL[0] * (0.52 - 0.22 * v) * ic, cg = FLOOR[1] + COOL[1] * (0.58 + 0.42 * v) * ic, cb = FLOOR[2] + COOL[2] * (0.54 + 0.30 * v) * ic;
          const w1 = 1 - cov;
          let t = (0.85 + 0.15 * aA[ui]) * warm + veil * gA[ui]; let hi = ((t > HMAX ? HMAX : t) / HMAX * (NH - 1) | 0) * 3;
          r = r * w1 + (cr + heat[hi]) * cov; g = g * w1 + (cg + heat[hi + 1]) * cov; b = b * w1 + (cb + heat[hi + 2]) * cov;
          t = (0.85 + 0.15 * aB[ui]) * warm + veil * gB[ui]; hi = ((t > HMAX ? HMAX : t) / HMAX * (NH - 1) | 0) * 3;
          rB = rB * w1 + (cr + heat[hi]) * cov; gB = gB * w1 + (cg + heat[hi + 1]) * cov; bB = bB * w1 + (cb + heat[hi + 2]) * cov;
          t = (0.85 + 0.15 * aC[ui]) * warm + veil * gC[ui]; hi = ((t > HMAX ? HMAX : t) / HMAX * (NH - 1) | 0) * 3;
          rC = rC * w1 + (cr + heat[hi]) * cov; gC = gC * w1 + (cg + heat[hi + 1]) * cov; bC = bC * w1 + (cb + heat[hi + 2]) * cov;
        }
      }
      // ordered-noise dither: these gradients are far too slow and dark for 8 bits otherwise
      sd ^= sd << 13; sd ^= sd >>> 17; sd ^= sd << 5;
      const n1 = (sd & 1023) / 1023 - 0.5, n2 = ((sd >>> 10) & 1023) / 1023 - 0.5, n3 = ((sd >>> 20) & 1023) / 1023 - 0.5;
      const o = (py * W + px) * 4;
      d[o] = r + n1; d[o + 1] = g + n2; d[o + 2] = b + n3; d[o + 3] = 255;
      if (band && yi >= YB0) {
        const q = bo + px * 4;
        e1[q] = rB - r + n2; e1[q + 1] = gB - g + n3; e1[q + 2] = bB - b + n1; e1[q + 3] = 255;
        e2[q] = rC - r + n3; e2[q + 1] = gC - g + n1; e2[q + 2] = bC - b + n2; e2[q + 3] = 255;
      }
    }
  }
  const put = (im) => { const c = L.makeCanvas(im.width, im.height); c.getContext('2d').putImageData(im, 0, 0); return c; };
  const top = base[BMAX * 3 - 3 * 300];
  return {
    key: `${R}|${crest}|${cx}`, plate: put(img), dSpread: put(i1), dBreath: put(i2), yb0: YB0, heat,
    topCss: `rgb(${Math.round(base[1400 * 3])},${Math.round(base[1400 * 3 + 1])},${Math.round(base[1400 * 3 + 2])})`, top,
    sparks: SPARKS.map(([U, dr, rad, lum, soft], i) => { const q = L.rng('s01spark' + i); return { U, dr, rad, lum, soft, ph: q() * L.TAU, rise: q.range(12, 30), sway: q.range(3, 8) }; }),
  };
}

/** pre-render the plates (safe to call again and again) */
export function initOpening(env) {
  const a = env.arc, key = `${a.R}|${a.crestY}|${a.cx}`;
  if (!S || S.key !== key) S = build(env);
  return S;
}
let S = null;

/**
 * tilt: px the camera has tilted UP (the whole picture slides down by this much). 0 = the opening framing.
 * k:    0..1 the picture's own time: the glow spreads out along the arc and breathes once, the embers drift up.
 */
export function drawOpening(ctx, env, { tilt = 0, k = 0 } = {}) {
  const a = env.arc, s = initOpening(env);
  k = L.clamp(k);
  ctx.save();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = s.topCss; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(s.plate, 0, tilt - TOP);
  if (k > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = L.smooth(k);                               // the glow runs out along the arc …
    ctx.drawImage(s.dSpread, 0, s.yb0 + tilt);
    ctx.globalAlpha = 0.5 - 0.5 * Math.cos(k * L.TAU);            // … and the hot centre takes one slow breath
    ctx.drawImage(s.dBreath, 0, s.yb0 + tilt);
  }
  // embers
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1;
  ctx.translate(0, tilt);
  const heat = s.heat;
  for (const sp of s.sparks) {
    const dr = sp.dr + sp.rise * k * (sp.dr > 560 ? 0.4 : 1);
    const p = a.pt((sp.U + sp.sway * Math.sin(sp.ph + k * 2.4)) / a.R, dr);
    if (p.y + tilt < -30 || p.y + tilt > H + 30 || p.x < -30 || p.x > W + 30) continue;
    const fl = 0.84 + 0.16 * Math.sin(sp.ph * 3 + k * 8);
    const hot = sp.lum * (1 - 0.7 * sstep(30, 380, dr));
    const hi = ((L.lerp(0.3, 0.84, hot) / HMAX) * (NH - 1) | 0) * 3;
    const col = (al) => `rgba(${heat[hi] | 0},${heat[hi + 1] | 0},${heat[hi + 2] | 0},${al.toFixed(3)})`;
    if (sp.soft) {
      // an ember out of focus: a faint flat disc
      const rr = sp.soft, al = 0.16 * sp.lum * fl;
      ctx.fillStyle = L.radial(ctx, p.x, p.y, 0, rr, [[0, col(al)], [0.72, col(al * 0.9)], [1, col(0)]]);
      ctx.fillRect(p.x - rr, p.y - rr, rr * 2, rr * 2);
    } else {
      const rr = sp.rad * 4.5, al = (0.45 + 0.5 * sp.lum) * fl;
      ctx.fillStyle = L.radial(ctx, p.x, p.y, 0, rr, [[0, col(al)], [sp.rad / rr, col(al * 0.8)], [0.4, col(al * 0.14)], [1, col(0)]]);
      ctx.fillRect(p.x - rr, p.y - rr, rr * 2, rr * 2);
    }
  }
  ctx.restore();
}

export default {
  name: '炉火映钱郭',
  tone: 'light',
  init(env) { initOpening(env); },
  draw(ctx, env, p) { drawOpening(ctx, env, { tilt: 0, k: p }); },
};
