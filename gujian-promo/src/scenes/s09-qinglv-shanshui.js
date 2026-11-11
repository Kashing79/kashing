// s09 — 青绿山水·山亭. A close crop of an old blue-and-green landscape on silk (绢本设色), as if re-photographed:
// the shared arc is the ridge of one huge rounded mountain. Malachite (石绿) body, azurite (石青) on the summit and the
// shaded flanks, outlines and hemp-fibre texture strokes (皴) in ochre-ink and gold that drape over the forms like leaf veins.
// A small red-columned, grey-tiled pavilion (四角攒尖亭) stands just behind the ridge left of centre; a path winds down from it.
//
// Recipe: the mountain is a stack of overlapping rounded "lobes" described in arc space (s = px along the arc, d = px below it).
// A half-res per-pixel pass in init() paints the washes (dark cap → body → pale foot, the way the genre models a rock) and the
// bands of white cloud; all line work is then drawn at full res on top. The pigment layer is chipped with a flake mask, laid
// over aged silk, embossed a little and covered with a weave. draw() is one blit plus a travelling glint on the gold.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 120;                      // the move is a push-in with a tiny rotation → a small margin is plenty
const LW = W + PAD * 2, LH = H + PAD * 2;
const RES = 0.5;                      // resolution of the per-pixel wash pass
const UMAX = 3.2, WN = 768, WK = (WN - 1) / (2 * UMAX);
const DMAX = 680, SMAX = 1420;        // extent of the layer in arc space
const PAV_X = 628;                    // pavilion axis (frame x)
const GOLD = '#e2b03a', RED = '#c8321e';   // 泥金 / 朱砂
let S = null;

const sm = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// ───────────────────────── mountain geometry (arc space) ─────────────────────────
function wobAt(lb, u) {
  const k = (L.clamp(u, -UMAX, UMAX - 1e-4) + UMAX) * WK, i = k | 0;
  return lb.wob[i] + (lb.wob[i + 1] - lb.wob[i]) * (k - i);
}
const lobeG = (lb, u) => { const au = u < 0 ? -u : u; return (u < 0 ? lb.wAl : lb.wAr) * (lb.p15 ? au * Math.sqrt(au) : au * au); };
/** (u, e) on lobe → (s, d). u = across the lobe in units of its width, e = px below its contour */
function ueToSD(lb, u, e) {
  if (lb.main) return [u * lb.w, e];
  const dd = lobeG(lb, u) + wobAt(lb, u) + e;
  return [lb.s0 + lb.lean * dd + u * lb.w, lb.d0 + dd];
}
/** px that (s, d) lies below the lobe's contour (> 0 = inside the lobe) */
function lobeE(lb, s, d) {
  if (lb.main) return d;
  const dd = d - lb.d0; if (dd < -24) return -1e6;
  const u = (s - lb.s0 - lb.lean * dd) * lb.iw;
  if (u <= -UMAX || u >= UMAX) return -1e6;
  return dd - lobeG(lb, u) - wobAt(lb, u);
}
function covered(lobes, i, s, d) {
  for (let j = lobes.length - 1; j > i; j--) { const e = lobeE(lobes[j], s, d); if (e > -1 && e < lobes[j].fadeMid) return true; }
  return false;
}
function sdToXY(a, s, d) { const th = s / a.R, r = a.R - d; return [a.cx + r * Math.sin(th), a.cy - r * Math.cos(th)]; }

// bands of white cloud (云气) lying in the folds: scalloped along the top, dissolving underneath.
// forms whose apex is below a band stand in front of it and poke through.
const MIST = [
  { s0: -1040, s1: -300, d0: 292, d1: 312, half: 40, k: 0.96, lam: 23, ph: 0.4 },
  { s0: 350, s1: 980, d0: 286, d1: 268, half: 36, k: 0.94, lam: 21, ph: 2.1 },
  { s0: -270, s1: 370, d0: 452, d1: 440, half: 30, k: 0.9, lam: 19, ph: 4.0 },
];
/** geometry of band b at s → [top, bottom, centre, taper] in d, or null outside it */
function mistGeom(b, s) {
  if (s <= b.s0 || s >= b.s1) return null;
  const t = (s - b.s0) / (b.s1 - b.s0);
  const dc = b.d0 + (b.d1 - b.d0) * t + 6 * Math.sin(t * 9 + b.s0);
  const env = Math.pow(Math.sin(Math.PI * t), 0.55);
  const big = Math.sin(s / (b.lam * 2.7) + 1.3 + b.ph);
  const puff = Math.pow(Math.abs(Math.sin(s / b.lam + b.ph)), 0.7) * (0.55 + 0.45 * big * big);
  return [dc - b.half * env * (0.42 + 0.58 * puff), dc + b.half * env * 0.45, dc, env];
}
function mistAt(s, d, lbD0) {
  let a = 0;
  for (let i = 0; i < MIST.length; i++) {
    const b = MIST[i], q = mistGeom(b, s);
    if (!q || lbD0 > q[2] - 26 || d <= q[0] - 3 || d >= q[1] + 24) continue;
    const v = sm((d - q[0] + 3) / 5) * (1 - sm((d - q[1] + 6) / 30)) * b.k * Math.min(1, q[3] * 3);
    if (v > a) a = v;
  }
  return a;
}

function makeLobes() {
  const r = L.rng('s09-lobes-b');
  const nz = L.makeNoise('s09wob');
  const out = [];
  const add = (s0, d0, w, lean, o = {}) => {
    const A = o.A ?? r.range(0.74, 1.0), skew = o.skew ?? r.range(-0.22, 0.22);
    const lb = {
      s0, d0, w, iw: 1 / w, lean, wAl: w * A * (1 + skew), wAr: w * A * (1 - skew), p15: o.p15 ?? r.chance(0.45), name: o.name || '',
      blue: o.blue ?? (r.chance(0.6) ? r.range(0.8, 1) : r.range(0.08, 0.3)),
      capLen: o.cap ?? w * r.range(0.2, 0.3), len: w * r.range(0.8, 1.0), footLen: o.foot ?? r.range(48, 82),
      side: 1, seed: r.range(0, 90), ochre: o.ochre || 0, small: w < 130,
      fs: o.soft ? w * r.range(0.28, 0.42) : 1e6, fl: o.soft ? w * r.range(0.5, 0.75) : 1,
    };
    lb.fadeMid = o.soft ? lb.fs + lb.fl * 0.45 : 1e6;
    const a1 = Math.min(9, w * 0.034), a2 = Math.min(4, w * 0.016);
    lb.wob = new Float32Array(WN);
    for (let k = 0; k < WN; k++) {
      const u = (k / (WN - 1)) * 2 * UMAX - UMAX;
      lb.wob[k] = a1 * nz.n2((u * w) / 95 + lb.seed, 1.7) + a2 * nz.n2((u * w) / 30 + lb.seed, 8.3);
    }
    out.push(lb);
    return lb;
  };
  // first rank of shoulders under the summit
  add(-1340, 104, 300, -0.55, { blue: 0.9 });
  const A = add(-800, 128, 340, -0.4, { name: 'A', blue: 0.2 });
  const B = add(-215, 172, 290, -0.12, { name: 'B', blue: 0.95, skew: 0.1 });
  const C = add(345, 112, 370, 0.18, { name: 'C', blue: 0.22 });
  const D = add(930, 150, 320, 0.42, { name: 'D', blue: 0.92 });
  add(1430, 108, 300, 0.6, { blue: 0.3 });
  // spurs between the ranks, to break the rhythm
  add(-505, 226, 170, -0.3, { blue: 0.15, A: 0.95 });
  add(628, 214, 185, 0.34, { blue: 0.9, A: 0.9 });
  add(1090, 238, 150, 0.5, { blue: 0.2, A: 1.0 });
  add(-1010, 232, 160, -0.5, { blue: 0.9, A: 1.0 });
  // second rank
  add(-1160, 318, 300, -0.5, { blue: 0.3 });
  const E = add(-545, 330, 300, -0.28, { name: 'E', blue: 0.92 });
  const F = add(60, 304, 320, 0.04, { name: 'F', ochre: 1, blue: 0 });   // an ochre slope (赭石坡) at the heart of the picture
  const G = add(690, 300, 300, 0.3, { name: 'G', blue: 0.2 });
  add(1230, 322, 300, 0.5, { blue: 0.95 });
  // third + fourth rank (mostly below the frame, fills the padding)
  add(-880, 492, 300, -0.4, { blue: 0.25 });
  add(-262, 478, 290, -0.12, { name: 'J', blue: 0.2 });
  add(392, 466, 300, 0.16, { name: 'K', blue: 0.95 });
  add(985, 476, 300, 0.4, { blue: 0.2 });
  add(-560, 626, 300, -0.2, {}); add(80, 634, 300, 0, {}); add(700, 622, 300, 0.25, {});
  // alum-head boulders (矾头) crowding under the summit ridge: rounded rocks that dissolve into the slope below.
  // none where the path comes down from the pavilion
  for (let k = 0; k < 11; k++) {
    const s0 = -1340 + k * 268 + r.range(-80, 80);
    if (s0 > -480 && s0 < -110) continue;
    add(s0, r.range(30, 76), r.chance(0.3) ? r.range(92, 120) : r.range(46, 76), (s0 / 1500) * 0.5 + r.range(-0.1, 0.1), { A: r.range(0.5, 0.8), p15: false, foot: r.range(26, 44), soft: true });
  }
  // more of them riding the shoulders of the big forms
  for (const P of [A, B, C, D, E, F, G]) {
    for (const sg of [-1, 1]) {
      if (r.chance(0.2)) continue;
      const [s, d] = ueToSD(P, sg * r.range(0.36, 0.8), r.range(12, 36));
      if (P === B && sg < 0) continue;
      add(s, d, r.range(56, 104), P.lean + sg * 0.25, { A: r.range(0.55, 0.85), p15: false, foot: r.range(24, 40), ochre: P.ochre && r.chance(0.6) ? 1 : 0, soft: true });
    }
  }
  out.sort((p, q) => p.d0 - q.d0);
  // the mountain itself: its contour IS the arc
  out.unshift({ main: true, s0: 0, d0: 0, w: 1500, iw: 1 / 1500, lean: 0, wAl: 0, wAr: 0, blue: 1, capLen: 100, len: 380, footLen: 74, side: 1, seed: 3.1, ochre: 0, name: 'M', fs: 1e6, fl: 1, fadeMid: 1e6 });
  return out;
}

/** turn a list of (u,e) on lobe i into visible screen polylines [[x,y,u,s]...] (splits where a nearer form or the mist covers it) */
function visRuns(a, lobes, i, ue) {
  const lb = lobes[i], runs = []; let cur = null;
  for (let k = 0; k < ue.length; k++) {
    const e = ue[k][1];
    const [s, d] = ueToSD(lb, ue[k][0], e);
    if (d > 1 && d < DMAX && s > -SMAX && s < SMAX && e < lb.fadeMid && !covered(lobes, i, s, d) && mistAt(s, d, lb.d0) < 0.42) {
      if (!cur) { cur = []; runs.push(cur); }
      const p = sdToXY(a, s, d); p.push(ue[k][0], s); cur.push(p);
    } else cur = null;
  }
  return runs.filter((q) => q.length > 1);
}
function poly(g, pts, color, width, alpha) {
  if (pts.length < 2) return;
  g.globalAlpha = alpha; g.strokeStyle = color; g.lineWidth = width;
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.stroke();
}

// ───────────────────────── the washes (per-pixel, half res) ─────────────────────────
function shadeMountain(a, lobes) {
  const cw = Math.round(LW * RES), ch = Math.round(LH * RES);
  const img = new ImageData(cw, ch), D = img.data;
  const nz = L.makeNoise('s09pig');
  const n = lobes.length, R = a.R, inv = 1 / RES;
  // mineral colours: deep / mid / bright
  const GD = [10, 98, 64], GM = [24, 158, 100], GH = [104, 206, 140];      // 石绿 #0a6240 / #189e64 / #68ce8c
  const BD = [14, 40, 120], BM = [28, 86, 184], BL = [84, 140, 216];        // 石青 #0e2878 / #1c56b8 / #548cd8
  const OD = [140, 92, 40], OM = [196, 150, 72], OH = [222, 192, 126];
  const FOOT = [176, 220, 170], THIN = [190, 214, 160], MISTC = [246, 242, 228];   // 淡三绿 foot, thin passages stay green (not khaki)
  let cr = 0, cg = 0, cb = 0, ca = 0;
  const shade = (lb, e, u, m, s, d, bl, fine, th) => {
    const st = nz.n2((u * lb.w) / 18 + lb.seed, e / 230 + lb.seed * 0.31);      // streaks running down the slope
    const ee = Math.max(0, e * (1 + 0.3 * st) + bl * 14);
    const capLen = lb.main ? lb.capLen * (0.82 + 0.38 * nz.n2(s / 340, 5.5)) : lb.capLen;
    const capT = 1 - sm(ee / capLen);
    const bodyT = sm(ee / lb.len);
    const foot = m < lb.footLen ? 1 - sm((m * (1 + 0.3 * st)) / lb.footLen) : 0;
    const fl = sm((u * lb.side + 0.15) / 0.85);                                  // 0 = lit flank, 1 = shaded flank
    const c0 = lb.ochre ? OD : GD, c1 = lb.ochre ? OM : GM, c2 = lb.ochre ? OH : GH;
    let r_, g_, b_;
    if (bodyT < 0.5) { const t = bodyT / 0.5; r_ = c0[0] + (c1[0] - c0[0]) * t; g_ = c0[1] + (c1[1] - c0[1]) * t; b_ = c0[2] + (c1[2] - c0[2]) * t; }
    else { const t = (bodyT - 0.5) / 0.5 * 0.7; r_ = c1[0] + (c2[0] - c1[0]) * t; g_ = c1[1] + (c2[1] - c1[1]) * t; b_ = c1[2] + (c2[2] - c1[2]) * t; }
    const lit = (1 - fl) * 0.3 * (1 - capT * 0.6);
    r_ += (c2[0] - r_) * lit; g_ += (c2[1] - g_) * lit; b_ += (c2[2] - b_) * lit;
    // azurite over the cap and the shaded side
    if (lb.ochre) {
      const gA = fl * 0.6 * (1 - capT * 0.3);                                    // the ochre slope turns green in its shade
      r_ += (GM[0] - r_) * gA; g_ += (GM[1] - g_) * gA; b_ += (GM[2] - b_) * gA;
    } else {
      const bA = sm(lb.blue * capT * 1.12 + (0.42 + 0.42 * lb.blue) * fl * (1 - bodyT * 0.62) * (0.6 + 0.4 * capT) + 0.14 * bl);
      if (bA > 0) {
        const t = sm(ee / (capLen * 1.25)), q = t < 0.6 ? t / 0.6 : (t - 0.6) / 0.4, x0 = t < 0.6 ? BD : BM, x1 = t < 0.6 ? BM : BL;
        r_ += (x0[0] + (x1[0] - x0[0]) * q - r_) * bA; g_ += (x0[1] + (x1[1] - x0[1]) * q - g_) * bA; b_ += (x0[2] + (x1[2] - x0[2]) * q - b_) * bA;
      }
    }
    // the foot of every form thins to a pale wash so the next dark cap reads against it
    let al = 1;
    if (foot > 0) { const f = foot * 0.5; r_ += (FOOT[0] - r_) * f; g_ += (FOOT[1] - g_) * f; b_ += (FOOT[2] - b_) * f; al -= foot * 0.18; }
    // thick and thin passages of the wash
    if (bl > 0.18) { const f = (bl - 0.18) * 0.42; r_ += (THIN[0] - r_) * f; g_ += (THIN[1] - g_) * f; b_ += (THIN[2] - b_) * f; }
    const rim = e < 9 ? 0.78 + 0.22 * (e / 9) : 1;                                // pigment pools under each contour
    const gr = rim * (1 + 0.08 * fine - 0.1 * Math.min(0, bl));
    if (th > 0.2) al *= 1 - (th - 0.2) * 0.6;
    r_ *= gr; g_ *= gr; b_ *= gr;
    const mi = mistAt(s, d, lb.d0) * (0.9 + 0.1 * st);
    if (mi > 0.01) { const f = Math.min(1, mi * 1.05); r_ += (MISTC[0] - r_) * f; g_ += (MISTC[1] - g_) * f; b_ += (MISTC[2] - b_) * f; if (f > al) al = f; }
    cr = r_; cg = g_; cb = b_; ca = al;
  };
  for (let y = 0; y < ch; y++) {
    const fy = (y + 0.5) * inv - PAD, ddy = a.cy - fy;
    for (let x = 0; x < cw; x++) {
      const fx = (x + 0.5) * inv - PAD, ddx = fx - a.cx;
      const d = R - Math.sqrt(ddx * ddx + ddy * ddy);
      if (d < -6) continue;
      const s = Math.atan2(ddx, ddy) * R;
      const bl = nz.fbm(fx / 120 + 3.3, fy / 120 - 1.7, 3);                       // pooling of the wash
      const fine = nz.n2(fx / 7, fy / 7);                                          // pigment granules
      const th = nz.fbm(fx / 300 + 20, fy / 300 + 9, 2);
      // walk the forms front → back; soft boulders let the slope behind show through their feet
      let aR = 0, aG = 0, aB = 0, aA = 0, rem = 1, m = 1e9;
      for (let j = n - 1; j >= 0; j--) {
        const lb = lobes[j];
        let e, u, cov = 1;
        if (j === 0) { e = d < 0 ? 0 : d; u = s / 1500; }
        else {
          const dd = d - lb.d0;
          if (dd < -96) continue;
          u = (s - lb.s0 - lb.lean * dd) * lb.iw;
          if (u <= -UMAX || u >= UMAX) continue;
          const au = u < 0 ? -u : u, k = (u + UMAX) * WK, ki = k | 0;
          e = dd - (u < 0 ? lb.wAl : lb.wAr) * (lb.p15 ? au * Math.sqrt(au) : au * au) - (lb.wob[ki] + (lb.wob[ki + 1] - lb.wob[ki]) * (k - ki));
          if (e <= 0) { if (-e < m) m = -e; continue; }
          if (e > lb.fs) { cov = 1 - sm((e - lb.fs) / lb.fl); if (cov <= 0) continue; }
        }
        shade(lb, e, u, m, s, d, bl, fine, th);
        const wgt = rem * cov;
        aR += wgt * cr; aG += wgt * cg; aB += wgt * cb; aA += wgt * ca;
        rem -= wgt;
        if (rem < 0.01) break;
      }
      const k4 = (y * cw + x) * 4, iw = 1 / (1 - rem);
      D[k4] = aR * iw; D[k4 + 1] = aG * iw; D[k4 + 2] = aB * iw; D[k4 + 3] = aA * iw * 255;
    }
  }
  const c = L.makeCanvas(cw, ch);
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

// ───────────────────────── line work ─────────────────────────
function uReach(lb) { const q = (DMAX - lb.d0) / Math.min(lb.wAl, lb.wAr); return Math.min(UMAX - 0.05, lb.p15 ? Math.pow(q, 2 / 3) : Math.sqrt(q)); }

/** a stroke that starts firm and trails off thin */
function taperPoly(g, run, color, w, alpha) {
  poly(g, run, color, w * 0.55, alpha);
  if (run.length > 3) poly(g, run.slice(0, Math.ceil(run.length * 0.62)), color, w, alpha);
}

/** 皴: hemp-fibre strokes draped over each form, fanning down and outward like the veins of a leaf. ink → g, gold → gg */
function drawCun(g, gg, a, lobes) {
  const r = L.rng('s09cun');
  for (let i = 0; i < lobes.length; i++) {
    const lb = lobes[i];
    const wE = lb.main ? 330 : lb.w;
    const uS = lb.main ? SMAX / lb.w : Math.min(1.9, uReach(lb));
    // one fibre: starts at (u0, e0) and runs downhill for T (in units of the form's width), drifting outward
    const fibre = (u0, e0, T, latK) => {
      const uLoc = lb.main ? (u0 * lb.w) / 1000 : u0;
      const lat = (u0 < 0 ? -1 : 1) * (0.05 + 0.46 * Math.min(1, Math.abs(uLoc))) * latK;
      const fall = r.range(0.28, 0.6);
      const wav = r.range(-1, 1) * 0.02, wf = r.range(4, 9), ph = r.range(0, 6);
      const steps = Math.max(4, Math.round((T * wE * Math.hypot(lat, fall)) / 6));
      const ue = [];
      for (let q = 0; q <= steps; q++) {
        const t = (q / steps) * T;
        ue.push([u0 + ((lat * (t + t * t * 0.4) + wav * Math.sin(t * wf + ph)) * wE) / lb.w, e0 + fall * t * wE]);
      }
      return visRuns(a, lobes, i, ue);
    };
    // main veins: long gold lines with an ink companion
    const nMain = lb.main ? 14 : lb.small ? 2 : 6;
    for (let k = 0; k < nMain; k++) {
      const u0 = lb.main ? L.lerp(-uS, uS, (k + r.range(0.2, 0.8)) / nMain) : L.lerp(-0.85, 0.85, (k + r.range(0.15, 0.85)) / nMain);
      for (const run of fibre(u0, r.range(2, 7), r.range(0.8, 1.5) * (lb.main ? 0.42 : 1), r.range(0.8, 1.2) * (lb.main ? 1.8 : 1))) {
        taperPoly(g, run.map((p) => [p[0] + 1.6, p[1] + 1.2]), '#2e241a', 2.0, 0.5);
        taperPoly(gg, run, GOLD, lb.small ? 1.7 : 2.3, 0.96);
      }
    }
    // the fine fibres between them
    const count = Math.round((((lb.main ? SMAX : lb.w * uS) * 2) / (lb.small ? 7 : 5)) * (lb.main ? 0.6 : 1));   // the azurite summit band stays clean
    for (let k = 0; k < count; k++) {
      const u0 = r.range(-uS, uS);
      const deep = r.chance(0.4);
      const e0 = deep ? r.range(0.06, 0.7) * wE : r.range(1.5, 12);
      const T = r.range(0.22, 1) * (deep ? 0.6 : 1) * (lb.small ? 1.5 : lb.main ? 0.5 : 1);
      const gold = r.chance(0.4), w = r.range(1.0, 1.75), al = r.range(0.42, 0.8), dark = r.chance(0.55);
      for (const run of fibre(u0, e0, T, r.range(0.6, 1.3) * (lb.main ? 1.7 : 1))) {
        if (gold) taperPoly(gg, run, GOLD, w * 0.9, Math.min(1, al + 0.22));
        else taperPoly(g, run, dark ? '#3e2c1c' : '#26251f', w, al * (lb.main ? 0.6 : 1));
      }
    }
    // repeated contour lines (复线) just inside the outline
    const reps = lb.main ? 0 : lb.small ? 1 : 3;
    for (let k = 0; k < reps; k++) {
      const e = r.range(9, 15) * (k + 1), ua = r.range(-1.1, 0.1), ub = ua + r.range(0.5, 1.3);
      const ue = []; for (let u = ua; u < ub; u += 5 / lb.w) ue.push([u, e + 2.5 * Math.sin(u * 9 + k)]);
      const gold = r.chance(0.5);
      for (const run of visRuns(a, lobes, i, ue)) gold ? poly(gg, run, GOLD, 1.4, 0.85) : poly(g, run, '#3a2a1c', 1.3, 0.6);
    }
  }
  // long strokes following the summit ridge itself
  const M = lobes[0];
  for (const [e, gold, wd] of [[15, false, 1.5], [25, true, 1.6], [38, false, 1.2], [52, true, 1.2]]) {
    let s = -SMAX + r.range(0, 200);
    while (s < SMAX) {
      const len = r.range(160, 520), ue = [];
      for (let q = s; q < Math.min(SMAX, s + len); q += 8) ue.push([q / M.w, e + 2 * Math.sin(q / 60) + 1.5 * Math.sin(q / 17)]);
      for (const run of visRuns(a, lobes, 0, ue)) gold ? poly(gg, run, GOLD, wd, 0.85) : poly(g, run, '#3a2a1c', wd, 0.6);
      s += len + r.range(40, 260);
    }
  }
  g.globalAlpha = 1; gg.globalAlpha = 1;
}

/** outlines of every form: a breathing ochre-ink line with a gold line laid just inside it, plus moss dots (苔点) */
function drawContours(g, gg, a, lobes) {
  const r = L.rng('s09contour');
  for (let i = 1; i < lobes.length; i++) {
    const lb = lobes[i], du = 6 / lb.w, ue = [], ue2 = [];
    for (let u = -UMAX + 0.01; u < UMAX; u += du) { ue.push([u, 0]); ue2.push([u, lb.small ? 4.2 : 5.6]); }
    const runs = visRuns(a, lobes, i, ue);
    lb.runs = runs;
    for (const run of runs) {
      if (run.length < 4) continue;
      const pts = run.filter((_, k) => k % 2 === 0 || k === run.length - 1);
      L.inkStroke(g, pts, { width: lb.small ? 2.7 : 3.8, color: '#30231a', seed: i * 13 + run.length, taper: [0.1, 0.16], wobble: 0.45, alpha: 0.84 });
    }
    for (const run of visRuns(a, lobes, i, ue2)) poly(gg, run, GOLD, lb.small ? 1.5 : 2.1, 0.95);
    gg.globalAlpha = 1;
    // moss dots sitting on the outline
    for (const run of runs) {
      let k = Math.floor(r.range(2, 10));
      while (k < run.length - 1) {
        const n = r.int(2, 5);
        for (let q = 0; q < n; q++) {
          const p = run[Math.min(run.length - 1, k + q)];
          g.globalAlpha = r.range(0.6, 0.9); g.fillStyle = r.chance(0.3) ? '#16402f' : '#1f2420';
          g.beginPath(); g.ellipse(p[0] + r.range(-2, 2), p[1] - r.range(-1, 3.5), r.range(2.2, 4.2), r.range(1.5, 2.6), r.range(-0.3, 0.3), 0, L.TAU); g.fill();
        }
        k += n + Math.floor(r.range(5, 16));
      }
    }
    g.globalAlpha = 1;
  }
}

/** one small "dot-leaf" tree: a trunk and stacked horizontal dabs */
function tree(g, r, x, y, h, lean, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.strokeStyle = 'rgba(42,38,32,0.92)'; g.lineWidth = Math.max(1.2, h * 0.05); g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 3); g.quadraticCurveTo(lean * h * 0.3, -h * 0.5, lean * h, -h * 0.92); g.stroke();
  if (h > 40) { g.lineWidth = Math.max(1, h * 0.03); g.beginPath(); g.moveTo(lean * h * 0.4, -h * 0.5); g.lineTo(lean * h * 0.4 + h * 0.16, -h * 0.68); g.moveTo(lean * h * 0.3, -h * 0.4); g.lineTo(lean * h * 0.3 - h * 0.17, -h * 0.56); g.stroke(); }
  const n = Math.round(h / 2.6) + 4;
  for (let k = 0; k < n; k++) {
    const t = r.range(0.3, 1.06), spread = h * 0.36 * Math.sin(Math.min(1, t) * Math.PI * 0.86 + 0.3);
    const xx = lean * h * t + r.range(-spread, spread), yy = -h * t;
    const wv = r.range(0.11, 0.2) * h + 1.5, hv = wv * r.range(0.36, 0.5);
    const q = r();
    g.fillStyle = q < 0.3 ? 'rgba(24,84,62,0.86)' : q < 0.65 ? 'rgba(26,42,34,0.9)' : 'rgba(42,38,32,0.84)';
    g.beginPath(); g.ellipse(xx, yy, wv, hv, r.range(-0.2, 0.2), 0, L.TAU); g.fill();
  }
  g.restore();
}

/** clustered little trees along some of the lower ridges */
function drawTrees(g, a, lobes) {
  const r = L.rng('s09trees');
  const plan = { A: [[0.12, 0.62]], C: [[-0.78, -0.3]], D: [[-0.5, -0.12]], E: [[-0.2, 0.3]], G: [[-0.64, -0.22]], F: [[0.36, 0.74]], K: [[-0.5, -0.1]], J: [[0.1, 0.5]] };
  for (const lb of lobes) {
    const ranges = plan[lb.name]; if (!ranges || !lb.runs) continue;
    for (const [ua, ub] of ranges) {
      for (const run of lb.runs) {
        let next = 0;
        for (let k = 0; k < run.length; k++) {
          const p = run[k]; if (p[2] < ua || p[2] > ub) continue;
          if (k < next) continue;
          next = k + Math.round(r.range(2, 4.4));
          const t = (p[2] - ua) / (ub - ua), env = Math.sin(Math.PI * L.clamp(t, 0.05, 0.95));
          tree(g, r, p[0] + r.range(-3, 3), p[1] + r.range(0, 5), r.range(22, 34) + 20 * env * r.range(0.5, 1), r.range(-0.12, 0.12), p[3] / a.R);
        }
      }
    }
  }
}

/** fine line along the scalloped top of each cloud band (勾云), only where no nearer form hides it */
function drawCloudLines(g, a, lobes) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const b of MIST) {
    let cur = null; const runs = [];
    for (let s = b.s0 + 30; s < b.s1 - 30; s += 3) {
      const q = mistGeom(b, s), d = q[0] - 0.5;
      let hid = false;
      for (let j = lobes.length - 1; j > 0 && !hid; j--) { if (lobes[j].d0 <= q[2] - 26) continue; const e = lobeE(lobes[j], s, d); hid = e > -1 && e < lobes[j].fadeMid; }
      if (!hid) { if (!cur) { cur = []; runs.push(cur); } cur.push(sdToXY(a, s, d)); } else cur = null;
    }
    for (const run of runs) { poly(g, run, '#7d6844', 1.2, 0.62); poly(g, run.map((p) => [p[0], p[1] + 4.5]), '#ffffff', 2.2, 0.5); }
  }
  g.globalAlpha = 1;
}

/** the mountain path (山径) winding down from the pavilion until it slips behind a shoulder */
function drawPath(g, a, lobes) {
  const s0 = Math.asin((PAV_X - a.cx) / a.R) * a.R;
  const key = [[s0 + 20, 1], [s0 + 44, 26], [s0 + 6, 54], [s0 + 52, 86], [s0 + 92, 112], [s0 + 76, 142], [s0 + 108, 176], [s0 + 100, 210]];
  const sd = L.smoothPath(key, 5);
  const ue = sd.map(([s, d]) => [s / lobes[0].w, d]);
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const run of visRuns(a, lobes, 0, ue)) {
    poly(g, run, 'rgba(58,40,22,1)', 9.5, 0.6);
    poly(g, run, '#e2d2a8', 6.2, 0.95);
    poly(g, run, 'rgba(160,120,60,1)', 1, 0.5);
  }
  g.globalAlpha = 1;
}

// ───────────────────────── the pavilion ─────────────────────────
/** 四角攒尖亭: vermilion columns, grey tile roof with lifted corners, a finial; it stands just behind the ridge so the ridge line stays unbroken */
function drawPavilion(g, a) {
  const yb = a.yAt(PAV_X) + 8;
  const ink = 'rgba(42,38,32,0.92)';
  g.save(); g.translate(PAV_X, yb); g.scale(1.1, 1.1); g.lineJoin = 'round'; g.lineCap = 'round';
  // 台基
  g.fillStyle = '#c9bc9c'; g.fillRect(-58, -15, 116, 17);
  g.fillStyle = 'rgba(70,52,30,0.28)'; g.fillRect(-58, -7, 116, 9);
  g.strokeStyle = ink; g.lineWidth = 1.3; g.strokeRect(-58, -15, 116, 17);
  // the pavilion is open: the silk shows between the columns, shaded under the eaves
  g.fillStyle = 'rgba(64,52,36,0.14)'; g.fillRect(-46, -72, 92, 57);
  g.fillStyle = L.linear(g, 0, -70, 0, -40, [[0, 'rgba(40,30,20,0.5)'], [1, 'rgba(40,30,20,0)']]); g.fillRect(-46, -70, 92, 30);
  // back pair of columns
  for (const cx of [-17, 17]) { g.fillStyle = '#8a2a18'; g.fillRect(cx - 2.8, -70, 5.6, 55); g.strokeStyle = 'rgba(42,38,32,0.6)'; g.lineWidth = 0.8; g.strokeRect(cx - 2.8, -70, 5.6, 55); }
  // bench rail (坐凳栏杆), open in the middle bay
  g.fillStyle = '#9c3220';
  g.fillRect(-45, -31, 29, 4.5); g.fillRect(16, -31, 29, 4.5);
  g.strokeStyle = 'rgba(124,36,22,0.95)'; g.lineWidth = 1.6;
  for (let x = -40; x <= 40; x += 7) { if (Math.abs(x) < 15) continue; g.beginPath(); g.moveTo(x, -27); g.lineTo(x, -15); g.stroke(); }
  // front pair of columns
  for (const cx of [-45, 45]) {
    g.fillStyle = L.linear(g, cx - 4.5, 0, cx + 4.5, 0, [[0, '#e8573a'], [0.45, RED], [1, '#762212']]);
    g.fillRect(cx - 4.5, -72, 9, 57);
    g.strokeStyle = ink; g.lineWidth = 1; g.strokeRect(cx - 4.5, -72, 9, 57);
    g.fillStyle = '#a99c80'; g.fillRect(cx - 6.5, -18.5, 13, 4); g.strokeRect(cx - 6.5, -18.5, 13, 4);
  }
  // lintel (额枋) and little corner brackets
  g.fillStyle = '#a5341f'; g.fillRect(-51, -77, 102, 9); g.strokeStyle = ink; g.lineWidth = 1; g.strokeRect(-51, -77, 102, 9);
  g.fillStyle = '#9c3220';
  for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(sg * 40.5, -68); g.lineTo(sg * 27, -68); g.quadraticCurveTo(sg * 38, -66, sg * 40.5, -56); g.closePath(); g.fill(); }
  // roof: concave slopes, corners swept up
  const eave = () => { g.moveTo(-84, -93); g.bezierCurveTo(-60, -75, -30, -72, 0, -72); g.bezierCurveTo(30, -72, 60, -75, 84, -93); };
  const roof = () => { g.beginPath(); eave(); g.bezierCurveTo(62, -88, 22, -100, 5, -131); g.lineTo(-5, -131); g.bezierCurveTo(-22, -100, -62, -88, -84, -93); g.closePath(); };
  roof(); g.fillStyle = L.linear(g, -80, 0, 80, 0, [[0, '#aab0b0'], [0.38, '#7f8689'], [1, '#4a5054']]); g.fill();
  g.save(); roof(); g.clip();
  g.strokeStyle = 'rgba(34,36,36,0.62)'; g.lineWidth = 1.1;
  // 四角攒尖: the tile rows of a slope are parallel, square to the eave, and cut short by the hip ridges (only a round roof fans out)
  for (let i = -10; i <= 10; i++) { const ex = i * 7.6; g.beginPath(); g.moveTo(ex, -68); g.lineTo(ex, -134); g.stroke(); }
  g.fillStyle = L.linear(g, 0, -131, 0, -70, [[0, 'rgba(255,255,255,0.16)'], [0.55, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,0.24)']]); g.fillRect(-86, -132, 172, 64);
  g.restore();
  roof(); g.strokeStyle = ink; g.lineWidth = 1.5; g.stroke();
  // hip ridges (垂脊) and the heavy eave line
  g.strokeStyle = 'rgba(30,30,30,0.92)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(84, -93); g.bezierCurveTo(62, -88, 22, -100, 5, -131); g.moveTo(-84, -93); g.bezierCurveTo(-62, -88, -22, -100, -5, -131); g.stroke();
  g.lineWidth = 3.6; g.beginPath(); eave(); g.stroke();
  g.strokeStyle = 'rgba(214,214,204,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-72, -89); g.bezierCurveTo(-52, -78, -28, -76, 0, -76); g.bezierCurveTo(28, -76, 52, -78, 72, -89); g.stroke();
  // finial (宝顶)
  g.fillStyle = '#676b68'; g.fillRect(-4, -136, 8, 6); g.strokeStyle = ink; g.lineWidth = 1; g.strokeRect(-4, -136, 8, 6);
  g.fillStyle = L.radial(g, -1.5, -143, 0.5, 7, [[0, '#edd692'], [0.6, GOLD], [1, '#7c5e22']]);
  g.beginPath(); g.ellipse(0, -141.5, 5.6, 6.2, 0, 0, L.TAU); g.fill(); g.stroke();
  g.strokeStyle = ink; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, -147.5); g.lineTo(0, -154); g.stroke();
  g.restore();
  // companions: a few trees on the ridge either side
  const r = L.rng('s09pavtrees');
  for (const [dx, h, ln] of [[-112, 68, -0.06], [-138, 46, 0.08], [-92, 40, 0.1], [106, 54, 0.1], [128, 36, -0.08]]) tree(g, r, PAV_X + dx, a.yAt(PAV_X + dx) + 5, h, ln, 0);
}

// ───────────────────────── silk, age, seal ─────────────────────────
function makeCracks() {
  const r = L.rng('s09cracks'), nz = L.makeNoise('s09crk');
  const out = [];
  for (let i = 0; i < 64; i++) {
    const y0 = r.range(-PAD, H + PAD), x0 = r.range(-PAD - 200, W), len = r.range(120, 900), drift = r.range(-0.012, 0.012);
    const pts = [];
    for (let x = x0; x < x0 + len; x += 12) pts.push([x, y0 + (x - x0) * drift + 3.2 * nz.n2(x / 70, i * 3.1) + 1.2 * nz.n2(x / 14, i * 7.7)]);
    out.push({ pts, w: r.range(0.8, 1.7), a: r.range(0.4, 1) });
  }
  return out;
}

/** where the paint has come away: alpha mask (opaque = lost). Smooth low-res noise fields are upscaled first and
 *  thresholded at full resolution afterwards, so the chips keep crisp, irregular edges. */
function buildFlake(cracks) {
  const nz = L.makeNoise('s09flake');
  const c = L.makeCanvas(LW, LH), g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#000'; g.fillRect(0, 0, LW, LH);
  g.globalCompositeOperation = 'lighter'; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  // each field goes into one colour channel; 0.5 (→127) is its threshold
  const field = (ch, stepX, stepY, fn) => {
    const fw = Math.ceil(LW / stepX) + 1, fh = Math.ceil(LH / stepY) + 1;
    const img = new ImageData(fw, fh), d = img.data;
    for (let y = 0, k = 0; y < fh; y++) for (let x = 0; x < fw; x++, k += 4) { d[k + ch] = L.clamp(fn(x * stepX, y * stepY)) * 255; d[k + 3] = 255; }
    const t = L.makeCanvas(fw, fh); t.getContext('2d').putImageData(img, 0, 0);
    g.drawImage(t, 0, 0, fw * stepX, fh * stepY);
  };
  field(0, 3, 3, (x, y) => 0.5 + (nz.fbm(x / 21, y / 21, 2) - 0.53) * 3.2);                                                         // small chips
  field(1, 5, 5, (x, y) => 0.5 + (nz.fbm(x / 70 + 0.8 * nz.n2(x / 150, y / 150), y / 70 + 0.8 * nz.n2(x / 150 + 9, y / 150 + 4), 4) - 0.44) * 3.2); // a few larger losses
  field(2, 8, 2, (x, y) => 0.5 + (nz.fbm(x / 85 + 40, y / 7.5, 2) - 0.57) * 3.2);                                                    // rubbed streaks along the roll
  const id = g.getImageData(0, 0, LW, LH), d = id.data;
  for (let k = 0; k < d.length; k += 4) {
    let v = (d[k] - 120) * 18; const v1 = (d[k + 1] - 120) * 18, v2 = (d[k + 2] - 120) * 12;
    if (v1 > v) v = v1; if (v2 > v) v = v2;
    d[k] = d[k + 1] = d[k + 2] = 0; d[k + 3] = v < 0 ? 0 : v > 238 ? 238 : v;
  }
  g.putImageData(id, 0, 0);
  // wear comes in patches: keep it where a slow mask says so
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(L.noiseTex(LW, LH, { seed: 's09flakeM', scale: 360, octaves: 3, res: 0.12, contrast: 1.8, ramp: [[0, 'rgba(0,0,0,0.06)'], [0.42, 'rgba(0,0,0,0.2)'], [0.68, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,1)']] }), 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.translate(PAD, PAD);
  L.speckle(g, { seed: 's09chips', count: 4200, x: -PAD, y: -PAD, w: LW, h: LH, rMin: 0.6, rMax: 2.8, colors: ['#000'], alpha: [0.5, 1], squash: 0.7 });
  // losses along the cracks
  g.lineCap = 'round'; g.strokeStyle = '#000';
  for (const k of cracks) { g.globalAlpha = 0.5 + 0.45 * k.a; g.lineWidth = k.w * 1.3 + 0.5; g.beginPath(); k.pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); }
  return c;
}

/** threads of the silk: neutral grey ± so it can be overlaid on anything */
function buildWeave() {
  const c = L.makeCanvas(LW, LH), g = c.getContext('2d');
  g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, LW, LH);
  const r = L.rng('s09weave'), P = 4;
  const thread = (v) => (v > 0 ? `rgba(255,255,255,${Math.min(0.34, v * 0.2)})` : `rgba(0,0,0,${Math.min(0.34, -v * 0.2)})`);
  for (let x = 0; x < LW; x += P) { g.fillStyle = thread(r.gauss() * 0.22); g.fillRect(x, 0, P, LH); }
  for (let y = 0; y < LH; y += P) { g.fillStyle = thread(r.gauss() * 0.3); g.fillRect(0, y, LW, P); }
  // plain-weave over/under structure as a repeating tile
  const T = P * 2, tile = L.makeCanvas(T, T), tg = tile.getContext('2d'), img = new ImageData(T, T);
  const prof = [0.5, 1, 0.92, 0.36];
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const over = ((x >> 2) + (y >> 2)) % 2 === 0;
    const v = over ? prof[x & 3] * (0.75 + 0.25 * prof[y & 3]) : prof[y & 3] * (0.62 + 0.25 * prof[x & 3]);
    const k = (y * T + x) * 4, q = 128 + (v - 0.62) * 150;
    img.data[k] = img.data[k + 1] = img.data[k + 2] = q; img.data[k + 3] = 255;
  }
  tg.putImageData(img, 0, 0);
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.85;
  g.fillStyle = g.createPattern(tile, 'repeat'); g.fillRect(0, 0, LW, LH);
  return c;
}

/** a small vermilion seal impression. The pattern is a nine-fold-style meander on purpose: it is NOT legible text. */
function drawSeal(g, x, y, sz) {
  const c = L.makeCanvas(sz + 24, sz + 24), q = c.getContext('2d');
  q.translate(12, 12);
  q.strokeStyle = RED; q.lineJoin = 'miter'; q.lineCap = 'butt';
  const lw = sz * 0.062;
  q.lineWidth = lw * 1.25; q.strokeRect(lw, lw, sz - lw * 2, sz - lw * 2);
  q.lineWidth = lw;
  const m = lw * 3.3, cs = (sz - m * 2 - lw * 1.6) / 2;
  const snake = (ox, oy, vertical, n, flip) => {
    q.save(); q.translate(ox, oy);
    if (vertical) { q.transform(0, 1, 1, 0, 0, 0); }
    q.beginPath();
    for (let k = 0; k < n; k++) {
      const yy = (k / (n - 1)) * cs, l = k % 2 === (flip ? 1 : 0);
      if (k === 0) q.moveTo(l ? 0 : cs, yy);
      q.lineTo(l ? cs : 0, yy);
      if (k < n - 1) q.lineTo(l ? cs : 0, ((k + 1) / (n - 1)) * cs);
    }
    q.stroke(); q.restore();
  };
  const gap = lw * 1.6;
  snake(m, m, false, 5, false); snake(m + cs + gap, m, true, 5, true);
  snake(m, m + cs + gap, true, 4, false); snake(m + cs + gap, m + cs + gap, false, 5, true);
  // uneven inking and wear
  q.setTransform(1, 0, 0, 1, 0, 0);
  q.globalCompositeOperation = 'destination-out';
  q.drawImage(L.noiseTex(sz + 24, sz + 24, { seed: 's09seal', scale: 9, octaves: 3, res: 1, contrast: 1.8, ramp: [[0, 'rgba(0,0,0,0)'], [0.55, 'rgba(0,0,0,0)'], [0.72, 'rgba(0,0,0,0.75)'], [1, 'rgba(0,0,0,1)']] }), 0, 0);
  q.drawImage(L.noiseTex(sz + 24, sz + 24, { seed: 's09seal2', scale: 46, octaves: 2, res: 0.5, ramp: [[0, 'rgba(0,0,0,0.5)'], [0.45, 'rgba(0,0,0,0.12)'], [1, 'rgba(0,0,0,0)']] }), 0, 0);
  g.save(); g.translate(x, y); g.rotate(-0.012);
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = 1; g.drawImage(c, -12, -12);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 0.35; g.drawImage(c, -12, -12);
  g.restore();
}

function buildSilk(env, cracks) {
  const a = env.arc;
  return L.makeLayer(PAD, (g) => {
    const X0 = -PAD, Y0 = -PAD;
    g.fillStyle = '#dcae52'; g.fillRect(X0, Y0, LW, LH);   // honey-gold silk (金碧山水), clean and bright
    // the silk has toned unevenly: a little lighter where the light falls, barely deeper toward the borders
    g.fillStyle = L.radial(g, 900, 330, 160, 1500, [[0, 'rgba(240,206,124,0.55)'], [0.45, 'rgba(220,174,82,0)'], [1, 'rgba(176,122,44,0.22)']]);
    g.fillRect(X0, Y0, LW, LH);
    g.globalAlpha = 0.22;
    g.drawImage(L.noiseTex(LW, LH, { seed: 's09stainA', scale: 430, octaves: 4, res: 0.2, warp: 0.6, ramp: [[0, 'rgba(168,112,36,0.55)'], [0.45, 'rgba(190,136,52,0.10)'], [0.7, 'rgba(255,226,150,0)'], [1, 'rgba(255,232,160,0.28)']] }), X0, Y0);
    g.globalAlpha = 1;
    // a bright halo hugging the ridge (0–130 px above it) lifts the arc off the ground
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R, a.R + 130, [[0, 'rgba(244,212,130,0.6)'], [1, 'rgba(244,212,130,0)']]);
    g.fillRect(X0, Y0, LW, LH);
    // distant ranges: a breath of azurite wash, darkest along the top edge, dissolving before it reaches the ridge
    const farL = L.makeLayer(PAD), fq = farL.getContext('2d');
    const tmp = L.makeLayer(PAD), q = tmp.getContext('2d');
    const far = (pts, col, alpha, fade) => {
      const top = L.smoothPath(pts.map(([x, h]) => [x, a.yAt(x) - h]), 8);
      q.globalCompositeOperation = 'source-over'; q.clearRect(X0, Y0, LW, LH);
      q.beginPath(); q.moveTo(top[0][0], top[0][1]); top.forEach((p) => q.lineTo(p[0], p[1]));
      q.lineTo(top[top.length - 1][0], H + PAD); q.lineTo(top[0][0], H + PAD); q.closePath();
      q.fillStyle = col; q.fill();
      q.globalCompositeOperation = 'destination-in';
      q.fillStyle = L.radial(q, a.cx, a.cy, a.R + 6, a.R + fade, [[0, 'rgba(0,0,0,0)'], [0.3, 'rgba(0,0,0,0.22)'], [1, 'rgba(0,0,0,1)']]);
      q.fillRect(X0, Y0, LW, LH);
      fq.globalAlpha = alpha; fq.drawImage(tmp, X0, Y0);
    };
    far([[1230, 0], [1330, 60], [1430, 150], [1520, 196], [1600, 150], [1690, 236], [1780, 300], [1870, 250], [1960, 318], [2120, 280]], '#5f8fc0', 0.42, 330);
    far([[1180, 0], [1290, 36], [1390, 94], [1462, 122], [1550, 88], [1640, 150], [1736, 206], [1826, 160], [1930, 216], [2100, 180]], '#2a5fa8', 0.5, 250);
    far([[-180, 250], [-60, 290], [50, 232], [150, 262], [250, 180], [330, 110], [410, 40], [470, 0]], '#5f8fc0', 0.42, 330);
    far([[-180, 168], [-40, 206], [60, 150], [150, 182], [250, 112], [340, 58], [430, 0]], '#2a5fa8', 0.5, 250);
    g.drawImage(L.blurred(farL, 1.0), X0, Y0);
    // foxing and specks
    L.speckle(g, { seed: 's09fox', count: 500, x: X0, y: Y0, w: LW, h: LH, rMin: 0.6, rMax: 3.6, colors: ['#9a6420', '#7c4c14', '#b07a2a'], alpha: [0.08, 0.4] });
    L.speckle(g, { seed: 's09fox2', count: 60, x: X0, y: Y0, w: LW, h: LH, rMin: 5, rMax: 16, colors: ['#8a683a', '#7a5a30'], alpha: [0.04, 0.12] });
    // vertical creases from mounting, horizontal cracks from rolling
    const r = L.rng('s09crease');
    for (const cx of [404, 1118, 1612]) {
      const x = cx + r.range(-20, 20);
      g.fillStyle = L.linear(g, x - 14, 0, x + 14, 0, [[0, 'rgba(140,88,24,0)'], [0.5, 'rgba(140,88,24,0.10)'], [1, 'rgba(140,88,24,0)']]); g.fillRect(x - 14, Y0, 28, LH);
      g.fillStyle = 'rgba(255,248,226,0.14)'; g.fillRect(x + 1, Y0, 1.2, LH);
    }
    g.lineCap = 'round';
    for (const k of cracks) {
      g.strokeStyle = `rgba(86,60,32,${0.08 + 0.15 * k.a})`; g.lineWidth = k.w * 0.75;
      g.beginPath(); k.pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
      g.strokeStyle = `rgba(255,248,224,${0.12 * k.a})`; g.lineWidth = 0.9;
      g.beginPath(); k.pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1] + 1.3) : g.moveTo(p[0], p[1] + 1.3))); g.stroke();
    }
  });
}

// ───────────────────────── pigment layer ─────────────────────────
function buildPaint(env, lobes) {
  const a = env.arc;
  const wash = shadeMountain(a, lobes);
  const gold = L.makeLayer(PAD), gg = gold.getContext('2d');
  const over = L.makeLayer(PAD), og = over.getContext('2d');
  gg.lineCap = 'round'; gg.lineJoin = 'round';
  const sp = a.span(PAD + 140);
  const ridge = (g) => {     // closed path under the ridge; the edge is hand-drawn (±1 px) but stays on the arc
    const nz = L.makeNoise('s09ridge');
    g.beginPath();
    for (let i = 0; i <= 400; i++) { const th = L.lerp(-sp, sp, i / 400), p = a.pt(th, 1.1 * nz.n2(th * 60, 0.5)); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); }
    g.lineTo(W + PAD + 400, H + PAD + 400); g.lineTo(-PAD - 400, H + PAD + 400); g.closePath();
  };
  const pav = L.makeLayer(PAD, (g) => drawPavilion(g, a));
  const paint = L.makeLayer(PAD, (g) => {
    g.save(); ridge(g); g.clip();
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(wash, -PAD, -PAD, LW, LH);
    // mineral pigment is granular
    g.globalCompositeOperation = 'soft-light';
    g.globalAlpha = 0.5; g.drawImage(L.grainTex(LW, LH, { seed: 's09gA', amount: 0.6, size: 2 }), -PAD, -PAD);
    g.globalAlpha = 0.35; g.drawImage(L.grainTex(LW, LH, { seed: 's09gB', amount: 0.55, size: 1 }), -PAD, -PAD);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.lineCap = 'round'; g.lineJoin = 'round';
    drawCun(g, gg, a, lobes);
    drawContours(g, gg, a, lobes);
    g.restore();
    // things painted over the mountain
    og.save(); ridge(og); og.clip();
    drawCloudLines(og, a, lobes);
    drawPath(og, a, lobes);
    drawTrees(og, a, lobes);
    og.restore();
    // the summit outline: gold just inside, ochre-ink on the arc
    gg.globalAlpha = 0.96; gg.strokeStyle = GOLD; gg.lineWidth = 3.2; a.stroke(gg, -6.2, -sp, sp);
    gg.globalAlpha = 1;
    gg.setTransform(1, 0, 0, 1, 0, 0); gg.globalCompositeOperation = 'destination-out'; gg.drawImage(over, 0, 0);
    g.drawImage(gold, -PAD, -PAD);
    g.drawImage(over, -PAD, -PAD);
    L.inkStroke(g, L.arcPts(a, -1.6, -sp, sp, 110), { width: 4.4, color: '#2e2219', seed: 9, taper: [0, 0], wobble: 0.3, alpha: 0.9 });
  });
  // the same outline again, kept aside: ink soaks into the silk and does not flake, so the arc stays unbroken
  const ridgeInk = L.makeLayer(PAD, (g) => L.inkStroke(g, L.arcPts(a, -1.6, -sp, sp, 110), { width: 4.4, color: '#2e2219', seed: 9, taper: [0, 0], wobble: 0.3, alpha: 0.8 }));
  return { paint, gold, pav, ridgeInk };
}

export default {
  name: '青绿山水·山亭',
  tone: 'dark',
  init(env) {
    const lobes = makeLobes();
    const cracks = makeCracks();
    const flake = buildFlake(cracks);
    const weave = buildWeave();
    const { paint, gold, pav, ridgeInk } = buildPaint(env, lobes);
    const all = buildSilk(env, cracks);
    const g = all.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    // the bare silk shows its threads strongly
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.45; g.drawImage(weave, 0, 0);
    // the seal is stamped after the weave so its meander keeps clean edges (the faint thread pass further down still unifies it)
    g.save(); g.translate(PAD, PAD); drawSeal(g, 1706, 118, 78); g.restore();
    // where pigment has flaked a stain of it remains in the silk
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 0.13; g.drawImage(paint, 0, 0);
    for (const c of [paint, gold, pav]) { const q = c.getContext('2d'); q.setTransform(1, 0, 0, 1, 0, 0); q.globalCompositeOperation = 'destination-out'; q.globalAlpha = c === pav ? 0.4 : 1; q.drawImage(flake, 0, 0); }
    g.globalAlpha = 1; g.drawImage(pav, 0, 0);
    g.globalAlpha = 1; g.drawImage(paint, 0, 0); g.drawImage(ridgeInk, 0, 0);
    // centuries of grime lie over silk and pigment alike
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.10;
    g.drawImage(L.noiseTex(LW, LH, { seed: 's09grime', scale: 340, octaves: 4, res: 0.2, warp: 0.5, contrast: 1.3, ramp: [[0, '#d9a85a'], [0.45, '#e6d6b4'], [0.7, '#ffffff'], [1, '#ffffff']] }), 0, 0);
    // thickness of the paint film: emboss its edges (pigment = high), lit from the upper left
    const hc = L.makeCanvas(LW, LH), hg = hc.getContext('2d');
    hg.drawImage(paint, 0, 0); hg.globalCompositeOperation = 'source-in'; hg.fillStyle = '#fff'; hg.fillRect(0, 0, LW, LH);
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.22;
    g.drawImage(L.bumpLight(hc, { angle: 45, strength: 1.7, blur: 1.2, res: 0.5 }), 0, 0);
    // threads still read through the paint, more faintly
    g.globalAlpha = 0.2; g.drawImage(weave, 0, 0);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    // bright copy of the gold for the travelling glint
    const gq = gold.getContext('2d'); gq.globalCompositeOperation = 'source-in'; gq.fillStyle = '#ffd866'; gq.fillRect(0, 0, LW, LH);
    // metallic sparkle: tiny near-white points that exist only on the gold lines (source-atop keeps the gold's alpha)
    gq.globalCompositeOperation = 'source-atop'; gq.translate(PAD, PAD);
    L.speckle(gq, { seed: 's09spark', count: 2600, x: -PAD, y: env.arc.crestY - 20, w: LW, h: H + PAD - env.arc.crestY + 20, rMin: 0.8, rMax: 1.6, colors: ['#fff6d0'], alpha: [0.75, 1] });
    gq.setTransform(1, 0, 0, 1, 0, 0); gq.globalCompositeOperation = 'source-over';
    const scratch = L.makeCanvas(W, H), sg = scratch.getContext('2d');
    sg.drawImage(all, 0, 0); sg.drawImage(gold, 0, 0); sg.clearRect(0, 0, W, H);   // touch the big layers once so the first frame is not slower than the rest
    S = { all, goldHi: gold, scratch, sg };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    // push-in centred on the authored scale: a zoom about the crest changes the arc's radius a little, so straddling 1.0
    // keeps the ridge within ±5 px of env.arc at the frame edges from the first frame to the last (exact mid-shot)
    const zoom = L.lerp(0.978, 1.024, p), rot = L.lerp(-0.0035, 0.0035, p);
    L.blit(ctx, env, S.all, { rot, zoom });
    // raking light catching the gold lines as the camera drifts
    const sg = S.sg;
    sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = 'source-over'; sg.globalAlpha = 1; sg.clearRect(0, 0, W, H);
    L.blit(sg, env, S.goldHi, { rot, zoom });
    sg.globalCompositeOperation = 'destination-in';
    const gx = L.lerp(520, 1380, p), gy = a.crestY + 150;
    sg.fillStyle = L.radial(sg, gx, gy, 0, 380, [[0, 'rgba(0,0,0,1)'], [0.45, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,0)']]);
    sg.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.9; ctx.drawImage(S.scratch, 0, 0); ctx.restore();
    // a soft sheen sliding across the silk
    ctx.save(); ctx.globalCompositeOperation = 'soft-light';
    const sx = L.lerp(420, 1500, p);
    ctx.fillStyle = L.linear(ctx, sx - 520, 0, sx + 520, 300, [[0, 'rgba(255,250,235,0)'], [0.5, 'rgba(255,250,235,0.16)'], [1, 'rgba(255,250,235,0)']]);
    ctx.fillRect(0, 0, W, H); ctx.restore();
    // copy-stand lighting: a little warmer and brighter from the upper left, falling off to the lower right
    ctx.save(); ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = L.linear(ctx, 0, 0, W, H, [[0, 'rgba(255,244,216,0.22)'], [0.5, 'rgba(128,128,128,0)'], [1, 'rgba(30,22,12,0.10)']]);
    ctx.fillRect(0, 0, W, H); ctx.restore();
  },
};
