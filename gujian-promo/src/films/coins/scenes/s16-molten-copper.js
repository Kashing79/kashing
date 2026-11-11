// s16 — 铜水. Macro across a crucible of molten copper: the arc is the upper edge of the melt, where surface tension
// humps the liquid into a meniscus and the limb glows almost orange-white against pure black.
// Below the arc, from the limb down: a band of fine wet granules (the oxide skin breaking up into crumbs, every crumb
// with its own glint) → a darker, wavy boundary where that skin ends → the clear orange-red depth of the melt, with a few
// rafts of dark-red slag and two or three bubbles.
//
// The melt is shaded per pixel in init(): every pixel under the arc gets surface coordinates (U along the limb, Sv down
// the bulge, compressed toward the limb like the surface of a drop seen edge-on), a height field gives relief, and the
// granule glints are written into three separate layers so draw() can flicker them frame by frame.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 40;         // the camera barely moves (liquid, not landscape) → a small margin is enough
const KF = 14;          // foreshortening: Sv = d + KF·√d  (d = px below the limb)
const GS = 21;          // granule pitch on the surface (px)
const KR = 1.4;         // relief strength
let S = null;

const sstep = (a, b, v) => { let t = (v - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const fore = (d) => d + KF * Math.sqrt(d);
const squash = (d) => 1 / (1 + KF / (2 * Math.sqrt(Math.max(d, 1))));   // local vertical compression of the surface on screen

// ── allocation-free worley: squared distances cD1/cD2, hash of the nearest cell cH, pixel − feature point (cDx, cDy) ──
let cD1 = 0, cD2 = 0, cH = 0, cDx = 0, cDy = 0;
function cell(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let d1 = 9, d2 = 9, hh = 0, bx = 0, by = 0;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const cx = xi + ox, cy = yi + oy;
    let h = (Math.imul(cx, 374761393) + Math.imul(cy, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    const dx = cx + (h & 1023) / 1023 - x, dy = cy + ((h >>> 10) & 1023) / 1023 - y, d = dx * dx + dy * dy;
    if (d < d1) { d2 = d1; d1 = d; hh = h; bx = dx; by = dy; } else if (d < d2) d2 = d;
  }
  cD1 = d1; cD2 = d2; cH = hh; cDx = -bx; cDy = -by;
}
const rehash = (h, salt) => { let v = Math.imul(h ^ salt, 0x45d9f3b); v ^= v >>> 15; v = Math.imul(v, 0x2c1b3c6d); return v ^ (v >>> 12); };

// rafts of slag (渣皮) floating on the clear part of the melt: frame position of the centre, half-sizes on the surface
const SLAGS = [
  { x: 585, y: 962, ax: 160, ay: 62, seed: 1 },
  { x: 1400, y: 934, ax: 100, ay: 44, seed: 2 },
  { x: 150, y: 1040, ax: 104, ay: 40, seed: 4 },
];
// bubbles: frame position of the foot, radius; the first one swells during the shot
const BUBBLES = [
  { x: 1046, y: 908, r: 74, grow: true },
  { x: 800, y: 826, r: 40 },
  { x: 1240, y: 992, r: 30 },
  { x: 1152, y: 936, r: 10 },
  { x: 1172, y: 915, r: 6 },
  { x: 857, y: 843, r: 8 },
];
// a very few sparks, far out to the sides (the tagline sits over the crest)
const SPARKS = [
  { x: 150, y: 520, r: 2.4, vx: -26, vy: -40 },
  { x: 268, y: 318, r: 1.6, vx: -14, vy: -30 },
  { x: 1768, y: 468, r: 2.2, vx: 24, vy: -42 },
  { x: 1664, y: 236, r: 1.5, vx: 12, vy: -28 },
];

function buildSurface(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const X0 = -PAD, Y0 = Math.floor(a.crestY) - 3;
  const RW = W + PAD * 2, RH = H + PAD - Y0, N = RW * RH;
  const nA = L.makeNoise('s16a'), nB = L.makeNoise('s16b');

  // where the granular skin ends: depth below the limb as a function of angle (thin on the left, deeper on the right, wavy)
  const TH = Math.atan2(W / 2 + PAD + 4, cy - (H + PAD)) + 0.01, NB = 4096;
  const Bl = new Float32Array(NB + 2);
  for (let i = 0; i < NB + 2; i++) {
    const u = L.lerp(-TH, TH, i / NB) * R;
    Bl[i] = 150 + 0.048 * u + 30 * nA.fbm(u / 520 + 3.1, 0.7, 2) + 9 * nA.n2(u / 115, 5.5) + 3 * nA.n2(u / 37, 9.1);
  }
  const slags = SLAGS.map((s) => { const pl = a.polar(s.x, s.y); return { th: pl.theta, S: fore(-pl.dr), ax: s.ax, ay: s.ay, seed: s.seed }; });

  // colour of the clear melt by depth below the skin edge: hottest orange right under the lip, redder further in
  const rampF = L.makeRamp([[0, '#ff8e30'], [14 / 520, '#ff7f24'], [60 / 520, '#fa641c'], [150 / 520, '#ee461a'], [290 / 520, '#e22c18'], [1, '#cc1c14']]);
  const RAMP = new Float32Array(521 * 3);
  for (let i = 0; i <= 520; i++) { const c = rampF(i / 520); RAMP[i * 3] = c[0]; RAMP[i * 3 + 1] = c[1]; RAMP[i * 3 + 2] = c[2]; }

  // 1) slow fields on a coarse grid
  const CS = 4, cw = Math.ceil(RW / CS) + 2, ch = Math.ceil(RH / CS) + 2;
  const cFilm = new Float32Array(cw * ch), cVein = new Float32Array(cw * ch), cMarb = new Float32Array(cw * ch), cAmp = new Float32Array(cw * ch), cHot = new Float32Array(cw * ch), cWx = new Float32Array(cw * ch), cWy = new Float32Array(cw * ch);
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const ddx = X0 + i * CS - cx, ddy = cy - (Y0 + j * CS), rr = Math.hypot(ddx, ddy);
    const d = Math.max(0, R - rr), U = Math.atan2(ddx, ddy) * rr, Sv = fore(d), k = j * cw + i;
    cMarb[k] = nB.fbm(U / 430 + 3, Sv / 300 - 8, 3);
    { const v = 1 - Math.abs(nA.n2(U / 330 - 2.5, Sv / 210 + 6.1) + 0.35 * nB.n2(U / 120 + 4, Sv / 80)); cVein[k] = v * v * v * v * v; }
    cAmp[k] = nA.fbm(U / 240 + 11, Sv / 200 + 4, 2);
    cFilm[k] = nB.fbm(U / 300 + 31, Sv / 36 - 2, 2);
    cHot[k] = nB.fbm(U / 950 - 7, Sv / 700 + 3, 2);
    cWx[k] = nA.n2(U / 210 + 5, Sv / 210); cWy[k] = nA.n2(U / 210 - 31, Sv / 210 + 19);
  }
  const bil = (src, i, j) => {
    const fx = i / CS, fy = j / CS, i0 = fx | 0, j0 = fy | 0, tx = fx - i0, ty = fy - j0, k = j0 * cw + i0;
    const a0 = src[k], a1 = src[k + 1], b0 = src[k + cw], b1 = src[k + cw + 1];
    return (a0 + (a1 - a0) * tx) * (1 - ty) + (b0 + (b1 - b0) * tx) * ty;
  };

  // 2) material pass: colour, height, glints
  const Hh = new Float32Array(N), Cr = new Float32Array(N), Cg = new Float32Array(N), Cb = new Float32Array(N);
  const Sp = new Float32Array(N), Wt = new Float32Array(N), Al = new Float32Array(N), Gp = new Uint8Array(N);
  for (let j = 0; j < RH; j++) {
    const ddy = cy - (Y0 + j);
    for (let i = 0; i < RW; i++) {
      const ddx = X0 + i - cx, rr = Math.sqrt(ddx * ddx + ddy * ddy), cov = R + 0.5 - rr;
      if (cov <= 0) continue;
      const k = j * RW + i;
      Al[k] = cov > 1 ? 1 : cov;
      const d = rr < R ? R - rr : 0, th = Math.atan2(ddx, ddy), U = th * rr, Sv = d + KF * Math.sqrt(d);
      const fb = ((th + TH) / (2 * TH)) * NB, ib = fb < 0 ? 0 : fb > NB ? NB : fb | 0;
      const t = d - (Bl[ib] + (Bl[ib + 1] - Bl[ib]) * (fb - ib));
      const amp = bil(cAmp, i, j);
      let r = 0, g = 0, b = 0, h = 0, sp = 0, grp = 0, wt = 0;
      if (t < 0) {
        // ── the granular skin: wet crumbs of breaking oxide — hot red, a few darker, a few orange-hot
        cell(U / GS + bil(cWx, i, j) * 0.6, Sv / GS + bil(cWy, i, j) * 0.6);
        const e1 = Math.sqrt(cD1), edge = Math.sqrt(cD2) - e1;
        const h2 = rehash(cH, 0x1b873593);
        const r1 = (h2 & 255) / 255, r2 = ((h2 >>> 8) & 255) / 255, r3 = ((h2 >>> 16) & 255) / 255;
        grp = ((h2 >>> 24) & 255) % 3;
        const fin = sstep(2, 14, d);                 // the crumbs melt into a smooth glowing lip at the very limb
        const gap = sstep(0.22, 0.5, -amp);          // … and where the skin has parted
        // every crumb is a soft round bump (not a tile): a dome on its feature point, barely parted from its neighbours
        const rad = 0.46 + 0.2 * r2, qd = e1 < rad ? 1 - (e1 * e1) / (rad * rad) : 0;
        const bead = qd * qd * (0.55 + 0.45 * sstep(0.0, 0.16, edge));
        let br, bg, bb, dull = 1;
        if (r1 < 0.1) { br = 138; bg = 20; bb = 12; dull = 0.45; }
        else if (r1 > 0.92) { br = 255; bg = 100; bb = 30; }
        else { const v = 0.92 + 0.2 * r2; br = 232 * v; bg = 40 * v; bb = 26 * v; }
        const bc = sstep(0, 0.55, bead);
        r = 170 + (br - 170) * bc; g = 20 + (bg - 20) * bc; b = 12 + (bb - 12) * bc;
        // a soft glossy band follows the limb where the meniscus turns over
        const gl = Math.exp(-((d - 56) * (d - 56)) / 1500), glb = gl * (0.16 + 0.12 * amp);
        r += (255 - r) * glb; g += (140 - g) * glb; b += (50 - b) * glb;
        h = bead * (1.3 + 0.8 * r3);
        // one wet fleck per crumb on its upper-left shoulder (crisp, irregular) + pin-point sparkle in between
        const mg = nB.n2(U / 2.6 + 50, Sv / 2.6);
        const ox = cDx + 0.34 * rad, oy = (cDy + 0.42 * rad) * 1.25, sz = rad * (0.3 + 0.34 * r3);
        const st = (r2 > 0.22 ? 0.55 + (0.45 * (r2 - 0.22)) / 0.78 : 0.14) * dull;
        const sheen = (0.42 + 0.58 * gl) * (0.8 + 0.45 * amp);
        sp = sstep(0.34, 0.7, Math.exp(-(ox * ox + oy * oy) / (sz * sz)) + 0.26 * mg) * st * 1.25;
        if (mg > 0.56) { const ms = (mg - 0.56) * 3.2; sp += (ms > 0.75 ? 0.75 : ms) * (0.4 + 0.6 * gl); }
        sp *= sheen;
        // a scatter of larger oxide flakes riding among the crumbs: angular, dark red, the melt wetting their edges
        cell(U / 58 + 3.3, Sv / 58 + 8.8);
        const hf = rehash(cH, 0x3c6ef372);
        const fr = 0.2 + (0.17 * ((hf >>> 8) & 255)) / 255;
        if ((hf & 255) < 18 && cD1 < fr * fr * 2.6) {
          const a0 = ((hf >>> 16) & 255) * 0.0246;
          let fd = 0;
          for (let q = 0; q < 7; q++) {
            const aq = a0 + q * 0.8976 + 0.3 * Math.sin(a0 * 3 + q * 2.1), wq = Math.sin(a0 * 5 + q * 4.3);
            const v = (cDx * Math.cos(aq) + cDy * Math.sin(aq)) / (fr * (0.84 + 0.16 * wq * wq));
            if (v > fd) fd = v;
          }
          fd += 0.17 * nA.n2(U / 6.5 + 1.5, Sv / 6.5 - 2.5);      // chipped, not ruled
          if (fd < 1.5) {
            const fl = 1 - sstep(0.84, 1.0, fd), ring = sstep(0.98, 1.1, fd) * (1 - sstep(1.1, 1.45, fd)) * 0.45;
            const tn = 0.82 + 0.3 * nA.n2(U / 7 + 3, Sv / 7);
            r += (124 * tn - r) * fl; g += (18 * tn - g) * fl; b += (11 * tn - b) * fl;
            r += (255 - r) * ring; g += (156 - g) * ring; b += (64 - b) * ring;
            h = h * (1 - fl) + (2.6 + 0.3 * tn) * fl;
            sp = sp * (1 - fl) + (mg > 0.6 ? (mg - 0.6) * 1.6 * fl : 0);
          }
        }
        const sm = 1 - fin * (1 - 0.6 * gap);
        r += (240 - r) * sm; g += (62 - g) * sm; b += (24 - b) * sm;
        h *= 1 - sm; sp *= 1 - sm;
        // the skin's lower edge: a dark groove
        const gr = sstep(-26, -2, t);
        if (gr > 0) { r *= 1 - 0.4 * gr; g *= 1 - 0.78 * gr; b *= 1 - 0.74 * gr; h *= 1 - gr; sp *= 1 - gr; }
      } else {
        // ── the clear melt
        const ti = (t > 519 ? 519 : t | 0) * 3;
        r = RAMP[ti]; g = RAMP[ti + 1]; b = RAMP[ti + 2];
        const m = bil(cMarb, i, j) * 1.5;
        if (m > 0) { const q = m > 1 ? 0.45 : 0.45 * m; r += (255 - r) * q; g += (132 - g) * q; b += (40 - b) * q; }
        else { const q = m < -1 ? 0.6 : -0.6 * m; r += (190 - r) * q; g += (24 - g) * q; b += (18 - b) * q; }
        // wet highlight riding just under the lip
        const vn = bil(cVein, i, j) * 0.3 * sstep(30, 120, t);      // faint brighter currents deep in the melt
        r += (255 - r) * vn; g += (150 - g) * vn; b += (56 - b) * vn;
        const occ = (1 - sstep(0, 13, t)) * 0.8;                    // the melt tucks under the skin's edge …
        r += (150 - r) * occ; g += (16 - g) * occ; b += (10 - b) * occ;
        const hl = Math.exp(-((t - 9.5) * (t - 9.5)) / 7) * (0.12 + 0.83 * sstep(-0.2, 0.5, nA.n2(U / 120 + 2.2, 3.3)));   // … and bulges out again with a long broken glint
        r += (255 - r) * hl; g += (214 - g) * hl; b += (150 - b) * hl;
        // thin films drifting on the surface, drawn out along the limb
        const film = bil(cFilm, i, j) * sstep(20, 80, t);
        r *= 1 + 0.05 * film; g *= 1 + 0.2 * film; b *= 1 + 0.12 * film;
        // slow swell of the liquid surface
        const fadeT = sstep(0, 30, t);
        h = 3.4 * nA.fbm(U / 300 + 9, Sv / 170 - 4, 2) * fadeT;
        wt = (0.2 + 0.8 * (1 - sstep(110, 320, t))) * sstep(30, 64, t);
        // specks of dross
        cell(U / 54 + 7.7, Sv / 54 + 3.1);
        const h3 = rehash(cH, 0x2545f491), q1 = (h3 & 255) / 255;
        if (q1 < 0.05) {
          const rad = 0.05 + (0.08 * ((h3 >>> 8) & 255)) / 255, dd = Math.sqrt(cD1) / rad;
          if (dd < 1.5) {
            const m2 = (1 - sstep(0.6, 1.0, dd)) * 0.6, ring = sstep(0.8, 1.05, dd) * (1 - sstep(1.05, 1.5, dd)) * 0.4;
            r += (255 - r) * m2; g += (176 - g) * m2; b += (90 - b) * m2; h += 1.6 * (1 - sstep(0.2, 1.0, dd));
            r += (150 - r) * ring; g += (20 - g) * ring; b += (12 - b) * ring;
          }
        }
        // rafts of slag
        for (let n = 0; n < slags.length; n++) {
          const P = slags[n], du = (th - P.th) * rr, dv = Sv - P.S;
          if (du > P.ax * 1.8 || du < -P.ax * 1.8 || dv > P.ay * 1.8 || dv < -P.ay * 1.8) continue;
          const nd = Math.sqrt((du * du) / (P.ax * P.ax) + (dv * dv) / (P.ay * P.ay));
          const wob = 0.27 * nA.fbm(du / (P.ax * 0.7) + P.seed * 13.7, dv / (P.ay * 1.1) - P.seed * 5.1, 2) + 0.03 * nB.n2(du / 17 + P.seed, dv / 17);
          const fp = (1 - nd + wob) * P.ay;       // ≈ surface px inside (+) / outside (−) the raft's edge
          if (fp < -60) continue;
          // the melt around a raft is a little cooler; right at the edge it climbs the crust and catches the light
          const halo = sstep(-55, 0, fp);
          r *= 1 - 0.12 * halo; g *= 1 - 0.42 * halo; b *= 1 - 0.36 * halo;
          const lit = 0.3 + 0.7 * sstep(0.5, -0.7, dv / P.ay + (0.5 * du) / P.ax);
          const men = Math.exp(-((fp + 3.2) * (fp + 3.2)) / 5) * 0.75 * lit;
          r += (255 - r) * men; g += (196 - g) * men; b += (116 - b) * men;
          h += 1.8 * sstep(-10, 0, fp);
          if (fp > 0) {
            cell(du / 30 + P.seed * 9.1, dv / 30 + P.seed * 4.3);
            const e2 = Math.sqrt(cD2) - Math.sqrt(cD1), hp = rehash(cH, 0x68bc21eb);
            const crack = 1 - sstep(0.0, 0.075, e2);
            const glowM = sstep(-0.15, 0.3, nB.fbm(du / 90 + P.seed * 3, dv / 70, 2));
            const thin = 1 - sstep(0, 24, fp);
            const tone = 0.62 + (0.45 * (hp & 255)) / 255 + 0.22 * nA.n2(du / 9, dv / 9);
            let sr = 90 * tone, sg = 14 * tone, sb = 10 * tone;
            sr += (182 - sr) * 0.7 * thin; sg += (26 - sg) * 0.7 * thin; sb += (16 - sb) * 0.7 * thin;
            const cg = crack * glowM * 0.92;
            sr += (255 - sr) * cg; sg += (112 - sg) * cg; sb += (30 - sb) * cg;
            const inn = sstep(0, 2.5, fp);
            r += (sr - r) * inn; g += (sg - g) * inn; b += (sb - b) * inn;
            h = h * (1 - inn) + inn * (1.8 + 2.2 * sstep(0, 6, fp) + 0.9 * sstep(0, 0.2, e2) + 0.35 * nA.n2(du / 7, dv / 7));
            wt *= 1 - inn;
            const dg = nB.n2(du / 4 + 9, dv / 4);
            if (dg > 0.6) { sp = (dg - 0.6) * 1.1 * inn * (1 - cg); grp = (hp >>> 9) % 3; }
          }
        }
      }
      // slow hot / cool drift across the melt, a little falloff toward the sides
      const hv = 1 + 0.1 * bil(cHot, i, j); r *= hv; g *= hv * hv; b *= hv;
      const sv = 1 - 0.2 * sstep(620, 1150, ddx < 0 ? -ddx : ddx); r *= sv; g *= sv * sv; b *= sv;
      // the limb: brightest line of the picture
      const rim2 = Math.exp(-d / 11) * 0.7, rim1 = Math.exp(-d / 4.2) * 0.95;
      r += (255 - r) * rim2; g += (122 - g) * rim2; b += (31 - b) * rim2;
      r += (255 - r) * rim1; g += (220 - g) * rim1; b += (165 - b) * rim1;
      Hh[k] = h; Cr[k] = r; Cg[k] = g; Cb[k] = b; Sp[k] = sp; Gp[k] = grp; Wt[k] = wt;
    }
  }

  // 3) relief + liquid glints → pixels
  const img = new ImageData(RW, RH), o = img.data;
  const sImg = [new ImageData(RW, RH), new ImageData(RW, RH), new ImageData(RW, RH)];
  const GX = 0.011, GY = 0.02, GW = 0.00005;
  for (let j = 0; j < RH; j++) {
    const jm = j > 0 ? -RW : 0, jp = j < RH - 1 ? RW : 0;
    for (let i = 0; i < RW; i++) {
      const k = j * RW + i, al = Al[k];
      if (al <= 0) continue;
      const hx = (Hh[k + (i < RW - 1 ? 1 : 0)] - Hh[k - (i > 0 ? 1 : 0)]) * 0.5, hy = (Hh[k + jp] - Hh[k + jm]) * 0.5;
      let rel = (hx * 0.5 + hy * 0.86) * KR; rel = rel < -0.45 ? -0.45 : rel > 0.55 ? 0.55 : rel;
      const up = rel > 0 ? rel : 0;
      let r = Cr[k] * (1 + rel) + up * 26, g = Cg[k] * (1 + rel * 1.15) + up * 60, b = Cb[k] * (1 + rel) + up * 18;
      const wt = Wt[k];
      if (wt > 0) {
        const e1 = hx - GX, e2 = hy - GY, s = Math.exp(-(e1 * e1 + e2 * e2) / GW) * wt * 0.42;
        r += (255 - r) * s; g += (190 - g) * s; b += (110 - b) * s;
      }
      const q = k * 4;
      o[q] = r; o[q + 1] = g; o[q + 2] = b; o[q + 3] = al * 255;
      const sp = Sp[k];
      if (sp > 0.03) {
        const s = sp > 1 ? 1 : sp, sd = sImg[Gp[k]].data;
        sd[q] = 255; sd[q + 1] = 150 + 94 * s; sd[q + 2] = 62 + 150 * s; sd[q + 3] = (s * 380 > 255 ? 255 : s * 380) * al;
      }
    }
  }
  const toCanvas = (im) => { const c = L.makeCanvas(RW, RH); c.getContext('2d').putImageData(im, 0, 0); return c; };
  const surf = toCanvas(img), spec = sImg.map(toCanvas);
  const soft = L.blurred(surf, 2.8), sg = soft.getContext('2d');
  sg.globalCompositeOperation = 'destination-in';
  sg.fillStyle = L.linear(sg, 0, 980 - Y0, 0, RH, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]);
  sg.fillRect(0, 0, RW, RH);
  surf.getContext('2d').drawImage(soft, 0, 0);

  // bloom: only the hot parts, blurred wide, kept at quarter size (it spills a little over the limb into the black)
  const BM = 160, bw = Math.round(RW / 4), bh = Math.round((RH + BM) / 4);
  const bloom = L.makeCanvas(bw, bh), bg = bloom.getContext('2d');
  bg.filter = 'brightness(0.62) contrast(2.8) blur(9px)';
  bg.drawImage(surf, 0, BM / 4, bw, RH / 4);
  bg.filter = 'none';
  return { surf, spec, bloom, X0, Y0, RW, RH, BM };
}

/** a bubble: a dome of liquid metal — dark where it mirrors the black above, orange where it mirrors the pool, one crisp glint */
function drawBubble(ctx, bx, by, r, fz, k) {
  const hb = r * fz * 0.9, ht = r * L.lerp(0.4, 0.98, k);
  ctx.save(); ctx.translate(bx, by);
  // the pool dips round the foot, then climbs the wall
  ctx.save(); ctx.scale(1, fz);
  ctx.fillStyle = L.radial(ctx, 0, 0, r * 0.9, r * 1.8, [[0, 'rgba(112,12,8,0.62)'], [0.45, 'rgba(150,20,10,0.26)'], [1, 'rgba(150,20,10,0)']]);
  ctx.beginPath(); ctx.arc(0, 0, r * 1.8, 0, L.TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,200,128,0.8)'; ctx.lineWidth = Math.max(1.6, r * 0.07); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, r * 1.07, 0.25, Math.PI - 0.25); ctx.stroke();
  ctx.restore();
  const dome = () => { ctx.beginPath(); ctx.ellipse(0, 0, r, ht, 0, Math.PI, L.TAU); ctx.ellipse(0, 0, r, hb, 0, 0, Math.PI); ctx.closePath(); };
  dome();
  ctx.fillStyle = L.linear(ctx, 0, -ht, 0, hb, [[0, '#6a0e0a'], [0.24, '#b01810'], [0.5, '#e2261a'], [0.78, '#ff7a1f'], [1, '#ffb45a']]);
  ctx.fill();
  ctx.save(); dome(); ctx.clip();
  ctx.fillStyle = L.radial(ctx, 0, hb * 0.15, r * 0.45, r * 1.04, [[0, 'rgba(90,14,10,0)'], [0.72, 'rgba(90,14,10,0.22)'], [1, 'rgba(64,8,6,0.85)']]);
  ctx.fillRect(-r - 2, -ht - 2, r * 2 + 4, ht + hb + 4);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = L.radial(ctx, r * 0.14, hb * 0.3, 0, r * 0.78, [[0, 'rgba(255,150,60,0.3)'], [1, 'rgba(255,110,30,0)']]);
  ctx.fillRect(-r - 2, -ht - 2, r * 2 + 4, ht + hb + 4);
  ctx.restore();
  // rim light on the upper-left shoulder
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,217,160,0.9)'; ctx.lineWidth = Math.max(1.4, r * 0.045);
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.95, ht * 0.94, 0, Math.PI * 1.1, Math.PI * 1.58); ctx.stroke();
  // the glint
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.translate(-r * 0.36, -ht * 0.5); ctx.rotate(-0.55); ctx.scale(1, 0.55);
  ctx.fillStyle = L.radial(ctx, 0, 0, 0, r * 0.62, [[0, 'rgba(255,170,80,0.5)'], [1, 'rgba(255,120,40,0)']]);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, L.TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = L.radial(ctx, 0, 0, 0, r * 0.27, [[0, '#fff6e2'], [0.5, 'rgba(255,225,170,0.95)'], [1, 'rgba(255,190,110,0)']]);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.27, 0, L.TAU); ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,230,180,0.9)';
  ctx.beginPath(); ctx.arc(r * 0.34, -ht * 0.16, Math.max(1.2, r * 0.055), 0, L.TAU); ctx.fill();
  ctx.restore();
}

export default {
  name: '铜水',
  tone: 'light',
  init(env) {
    const a = env.arc;
    S = buildSurface(env);
    S.bub = BUBBLES.map((q) => ({ ...q, fz: squash(-a.drAt(q.x, q.y)) })).sort((u, v) => u.y - v.y);
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const breath = Math.sin(Math.PI * L.clamp(p));          // one slow swell of brightness
    const fi = Math.round(p * (env.frames - 1));            // frame index within the shot → per-frame flicker
    const rot = L.lerp(-0.0012, 0.0012, p);

    // the dark: black, a tight hot halo hugging the limb, a very few sparks
    ctx.fillStyle = '#040202'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = L.radial(ctx, a.cx, a.cy, a.R - 2, a.R + 38, [[0, `rgba(255,96,30,${0.26 + 0.1 * breath})`], [0.3, 'rgba(226,38,26,0.085)'], [1, 'rgba(150,16,10,0)']]);
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < SPARKS.length; i++) {
      const s = SPARKS[i], x = s.x + s.vx * p, y = s.y + s.vy * p;
      const tw = 0.6 + 0.4 * (((rehash(fi * 31 + i * 7 + 3, 0x9e3779b1) >>> 8) & 255) / 255);
      const tx = x - s.vx * 1.25, ty = y - s.vy * 1.25, len = Math.hypot(s.vx, s.vy) * 1.25, nx = (-s.vy * 1.25) / len, ny = (s.vx * 1.25) / len;
      L.glow(ctx, x, y, s.r * 6, '#ff7a1f', 0.42 * tw);
      ctx.save();
      ctx.fillStyle = L.linear(ctx, x, y, tx, ty, [[0, `rgba(255,217,160,${0.95 * tw})`], [0.35, `rgba(255,122,31,${0.6 * tw})`], [1, 'rgba(226,38,26,0)']]);
      ctx.beginPath(); ctx.moveTo(x + nx * s.r * 0.8, y + ny * s.r * 0.8); ctx.lineTo(tx, ty); ctx.lineTo(x - nx * s.r * 0.8, y - ny * s.r * 0.8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffe2b4'; ctx.globalAlpha = tw; ctx.beginPath(); ctx.arc(x, y, s.r, 0, L.TAU); ctx.fill();
      ctx.restore();
    }

    // the melt
    L.cam(ctx, env, { rot }, () => {
      ctx.drawImage(S.surf, S.X0, S.Y0);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.14 * breath;
      ctx.drawImage(S.surf, S.X0, S.Y0);
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = 0.35 + 0.65 * (((rehash(fi * 7 + i * 13 + 1, 0x7f4a7c15) >>> 8) & 255) / 255);
        ctx.drawImage(S.spec[i], S.X0, S.Y0);
      }
      ctx.globalAlpha = 1;
      const e = L.ease.inOutQuad(p);
      for (const q of S.bub) {
        if (q.grow) drawBubble(ctx, q.x, q.y + 3 * (1 - e), q.r * L.lerp(0.8, 1, e), q.fz, L.lerp(0.3, 1, e));
        else drawBubble(ctx, q.x, q.y, q.r, q.fz, 0.92);
      }
      // heat bloom
      ctx.save(); a.clipBelow(ctx, 0);
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.14 + 0.26 * breath;
      ctx.drawImage(S.bloom, S.X0, S.Y0 - S.BM, S.RW, S.RH + S.BM);
      ctx.restore();
    });

    // the limb itself: one clean orange-white line, exactly on the arc
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.8 + 0.2 * breath;
    ctx.strokeStyle = L.linear(ctx, 0, 0, W, 0, [[0, 'rgba(255,150,60,0.55)'], [0.28, 'rgba(255,217,160,0.9)'], [0.5, 'rgba(255,232,186,1)'], [0.76, 'rgba(255,205,136,0.85)'], [1, 'rgba(255,150,60,0.55)']]);
    ctx.lineWidth = 2.4; a.stroke(ctx, -1.2);
    ctx.restore();
  },
};
