// s23 — 成分扫描伪彩图. The false-colour map an X-ray fluorescence area scan of a cash coin throws on the screen.
//   the arc        → the coin's outer edge: the hottest band of the map, a glowing magenta rim
//   just outside   → a stair-stepped halo of coarse square scan pixels (scatter signal), violet fading to black
//   below the arc  → concentric colour bands, rim inward: magenta · purple · orange · bright yellow · fluorescent green.
//                    Their borders wander like contour lines; corrosion shows up as islands with their own colour rings.
//   above the arc  → near-black screen with vertical neon spectral lines (discrete peaks, not a rainbow): dense and bright
//                    at the two sides, none above the crest where the tagline sits.
//
// The whole picture is ONE scalar field on a coarse scan grid (1 scan pixel = Q screen px), pushed through a colour LUT —
// the way real false-colour maps are made — so every border gets its natural fringe of in-between colours and the
// counting noise speckles the borders. The field is re-evaluated every frame (cheap at this resolution):
// band borders creep, the noise re-rolls, halo pixels flicker. No figures, letters or element symbols anywhere.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 60;                         // rot only slides the picture ~±20 px
const Q = 4;                            // one scan pixel = 4 screen px
const LW = (W + PAD * 2) / Q, LH = (H + PAD * 2) / Q;   // 510 × 300
const CELL = 10;                        // a halo block = 10 scan pixels = 40 screen px
const NMASK = (1 << 18) - 1;
let S = null;

const sstep = (a, b, v) => { let t = (v - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const hsh = (i, j) => { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

// ── the colour scale (scalar → colour). Outside the coin the signal lives in 0 … 0.3; the rim is the hot magenta peak;
//    the coin's face climbs from purple through orange and yellow to green (and a rare cyan-green hot spot beyond 1). ──
const SMAX = 1.16, NL = 2048;
const LUT_STOPS = [
  [0.000, '#05040a'], [0.045, '#0c0624'], [0.105, '#241068'], [0.175, '#5417ba'], [0.245, '#9a1fda'], [0.300, '#dc28da'],
  [0.335, '#ff2bd6'], [0.354, '#ff4ede'], [0.372, '#ffa6f2'], [0.390, '#ff56e0'], [0.406, '#ff34d8'], [0.428, '#ee2bd6'],
  [0.470, '#8c18cc'], [0.535, '#4a10b6'], [0.580, '#6a14b4'], [0.612, '#d81f86'], [0.636, '#ff3a5e'],
  [0.675, '#ff8a1f'], [0.720, '#ff9a22'], [0.762, '#ffbe34'], [0.815, '#ffe14a'], [0.870, '#f8ea44'],
  [0.910, '#cfe92e'], [0.945, '#9be81e'], [0.985, '#6fdd24'], [1.030, '#3fd24a'], [1.090, '#22dcae'], [1.160, '#3cf0e6'],
];
// ── depth below the rim (px) → scalar: plateaus (the bands) joined by short ramps (their borders) ──
const PROFILE = [
  [-8, 0.335], [0, 0.335], [8, 0.352], [20, 0.372], [32, 0.386], [46, 0.402], [56, 0.425],     // the rim (外郭): hot magenta
  [66, 0.5], [98, 0.535], [128, 0.56],                                            // purple
  [139, 0.632], [148, 0.682], [190, 0.7], [228, 0.722],                           // a red-pink contour, then orange
  [244, 0.818], [292, 0.836], [338, 0.856],                                       // bright yellow
  [356, 0.945], [420, 0.965], [520, 0.99], [800, 1.04],                           // fluorescent green
];
const P0 = -8, PSTEP = 0.5;

// the neon spectral lines: each is an intensity profile pushed through its own little colour scale (dark edge → hot core)
const STRIPE_RAMPS = {
  m: [[0, '#000000'], [0.18, '#2a0648'], [0.42, '#a012b0'], [0.68, '#ff2bd6'], [0.9, '#ff8cec'], [1.1, '#ffd4f8']],
  o: [[0, '#000000'], [0.18, '#3c0626'], [0.4, '#c81a58'], [0.62, '#ff6a22'], [0.82, '#ff9a1f'], [1.0, '#ffd640'], [1.1, '#fff0a0']],
  g: [[0, '#000000'], [0.18, '#06301e'], [0.42, '#1f9a36'], [0.68, '#8ee01e'], [0.9, '#c8f230'], [1.1, '#f2ff9a']],
  c: [[0, '#000000'], [0.18, '#052a44'], [0.42, '#0d8ab8'], [0.68, '#22d6f2'], [0.9, '#7ef0ff'], [1.1, '#d8fbff']],
};
const RAMP_IDS = ['m', 'o', 'g', 'c'], TMAX = 1.1, TN = 256;
// [side, distance from the centre line, width at half height, colour scale, peak] — dense and bright at the two sides,
// thinning out and dimming toward the middle, nothing above the crest
const STRIPES = [
  [-1, 392, 6, 'm', 0.4], [-1, 470, 22, 'c', 0.55], [-1, 548, 7, 'o', 0.72], [-1, 612, 44, 'm', 0.84], [-1, 668, 6, 'g', 0.8],
  [-1, 742, 70, 'o', 1.0], [-1, 800, 7, 'c', 0.9], [-1, 856, 36, 'g', 1.0], [-1, 915, 8, 'm', 1.0], [-1, 985, 60, 'o', 0.95],
  [1, 380, 5, 'c', 0.36], [1, 455, 16, 'm', 0.55], [1, 520, 6, 'g', 0.68], [1, 590, 52, 'o', 0.88], [1, 648, 6, 'm', 0.82],
  [1, 706, 26, 'c', 0.92], [1, 772, 8, 'o', 0.92], [1, 838, 76, 'm', 1.0], [1, 900, 7, 'g', 1.0], [1, 958, 44, 'g', 1.0],
];

function build(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const N = LW * LH;
  const nA = L.makeNoise('s23a'), nB = L.makeNoise('s23b');

  // LUT + profile table + noise table
  const ramp = L.makeRamp(LUT_STOPS.map(([t, c]) => [t / SMAX, c]));
  const LR = new Uint8Array(NL), LG = new Uint8Array(NL), LB = new Uint8Array(NL);
  for (let i = 0; i < NL; i++) { const c = ramp(i / (NL - 1)); LR[i] = c[0]; LG[i] = c[1]; LB[i] = c[2]; }
  const pf = L.makeRamp(PROFILE.map(([d, s]) => [(d - P0) / 808, [s * 200, 0, 0, 1]]));
  const PN = Math.round(808 / PSTEP) + 1, Ptab = new Float32Array(PN);
  for (let i = 0; i < PN; i++) Ptab[i] = pf(i / (PN - 1))[0] / 200;
  const rn = L.rng('s23noise');
  const NT = new Float32Array(NMASK + 1);
  for (let i = 0; i <= NMASK; i++) NT[i] = (rn() + rn() + rn() + rn() - 2) * 1.73;   // ≈ unit gaussian

  const D = new Float32Array(N), TH = new Float32Array(N), COV = new Float32Array(N);
  const Deff = new Float32Array(N), CA = new Float32Array(N), CB = new Float32Array(N), BL = new Float32Array(N), FN = new Float32Array(N);
  const HV = new Float32Array(N), CID = new Uint16Array(N);
  const ST = new Float32Array(N), SID = new Uint8Array(N), NA = new Float32Array(N);

  // ── halo blocks: a coarse screen-aligned grid; one grid line sits 28 px above the crest ──
  const colOff = ((Math.round((cx - CELL * Q / 2 + PAD) / Q) % CELL) + CELL) % CELL;
  const rowOff = ((Math.round((a.crestY - 28 + PAD) / Q) % CELL) + CELL) % CELL;
  const CW = Math.ceil(LW / CELL) + 2, CH = Math.ceil(LH / CELL) + 2;
  const cellV = new Float32Array(CW * CH);
  for (let cj = 0; cj < CH; cj++) for (let ci = 0; ci < CW; ci++) {
    const xc = -PAD + ((ci - 1) * CELL + colOff + CELL / 2) * Q, yc = -PAD + ((cj - 1) * CELL + rowOff + CELL / 2) * Q;
    const dOut = a.drAt(xc, yc), ax = Math.abs(xc - cx);
    const h1 = hsh(ci * 7 + 3, cj * 13 + 1), h2 = hsh(ci * 11 + 5, cj * 3 + 9);
    const side = sstep(330, 560, ax);
    let v = 0;
    if (dOut < -30) v = 0;
    else if (dOut < 24) v = L.lerp(0.17, 0.275, h1) * L.lerp(0.88, 1, side);
    else if (dOut < 64) v = h2 < 0.8 * side ? L.lerp(0.08, 0.23, h1) : 0;
    else if (dOut < 104) v = h2 < 0.32 * side ? L.lerp(0.05, 0.13, h1) : 0;
    else if (dOut < 150) v = h2 < 0.09 * side ? L.lerp(0.03, 0.06, h1) : 0;
    cellV[cj * CW + ci] = v;
  }

  // ── stripes: colour scales as flat tables ──
  const TR = new Uint8Array(4 * TN), TG = new Uint8Array(4 * TN), TB = new Uint8Array(4 * TN);
  RAMP_IDS.forEach((id, q) => {
    const f = L.makeRamp(STRIPE_RAMPS[id].map(([t, c]) => [t / TMAX, c]));
    for (let i = 0; i < TN; i++) { const c = f(i / (TN - 1)); TR[q * TN + i] = c[0]; TG[q * TN + i] = c[1]; TB[q * TN + i] = c[2]; }
  });
  const stripes = STRIPES.map(([side, ax, w, id, peak], n) => ({ x: cx + side * ax, hw: w / 2, q: RAMP_IDS.indexOf(id), peak, n }));

  // ── per-pixel static fields ──
  for (let j = 0; j < LH; j++) {
    const y = -PAD + (j + 0.5) * Q, ddy = cy - y;
    for (let i = 0; i < LW; i++) {
      const k = j * LW + i, x = -PAD + (i + 0.5) * Q, ddx = x - cx;
      const rr = Math.sqrt(ddx * ddx + ddy * ddy), d = R - rr, th = Math.atan2(ddx, ddy), u = th * R;
      D[k] = d; TH[k] = th;
      const cov = L.clamp(0.5 + d / Q); COV[k] = cov;
      FN[k] = NT[(k * 7 + 12345) & NMASK];
      NA[k] = 0.0145 * L.lerp(0.42, 1, sstep(40, 70, d));          // counting noise: the rim is the strongest signal, so the cleanest
      if (cov > 0) {
        const g = sstep(40, 220, d) * (1 + d / 500);
        const wv = g * (12 * nA.n2(u / 520, d / 700 + 3) + 5 * nA.n2(u / 190 + 9, d / 340))
          + sstep(16, 62, d) * (1 - sstep(62, 150, d)) * 5 * nB.n2(u / 120, 7.7);
        Deff[k] = d + wv;
        const cg = sstep(50, 190, d) * 9;
        CA[k] = cg * nB.n2(u / 240 + 31, d / 240); CB[k] = cg * nB.n2(u / 240 - 17, d / 240 + 55);
        BL[k] = 0.012 * nA.fbm(u / 70 + 5, d / 70, 3) + 0.007 * NT[(j * 131 + 77) & NMASK] * sstep(50, 90, d);   // + line-to-line gain wobble of the raster
      }
      if (cov < 1) {
        const ci = Math.floor((i - colOff) / CELL) + 1, cj = Math.floor((j - rowOff) / CELL) + 1, c = cj * CW + ci;
        HV[k] = cellV[c]; CID[k] = c;
        // the strongest spectral line at this pixel: soft-edged, a touch wavy, its strength wandering along its length
        const xw = x + 5 * nB.n2(x / 340, y / 250);
        let best = 0, bq = 0;
        for (const st of stripes) {
          const dx = Math.abs(xw - st.x); if (dx > st.hw * 5 + 30) continue;
          const qq = dx / (st.hw + 1.5);
          const m = L.clamp(0.66 + 0.58 * nB.fbm(st.n * 7.31 + x / 400, y / 330 + st.n * 3.1, 3), 0.3, 1.1);
          const v = st.peak * m * (Math.exp(-0.69 * qq * qq) + 0.1 * Math.exp(-qq / 2.2));
          if (v > best) { best = v; bq = st.n; }
        }
        ST[k] = best * L.lerp(0.78, 1, sstep(-PAD, 280, y)) * (1 - cov); SID[k] = bq;
      }
    }
  }

  // ── corrosion: islands of higher / lower signal, slightly stretched along the bands, ragged outline ──
  const blobs = [
    // theta, depth, along, across, amplitude
    [-0.215, 20, 80, 22, -0.12], [0.335, 26, 66, 20, -0.09],
    [-0.07, 98, 120, 24, 0.13], [0.26, 94, 80, 22, 0.15], [0.085, 88, 80, 16, -0.09], [-0.31, 100, 70, 22, 0.11],
    [0.13, 190, 170, 30, 0.11], [-0.23, 196, 130, 28, -0.13], [-0.02, 200, 70, 18, -0.09],
    [-0.10, 296, 190, 34, 0.1], [0.2, 292, 120, 28, -0.11],
    [0.03, 468, 170, 40, 0.1], [-0.16, 420, 110, 28, -0.1], [0.14, 400, 90, 24, -0.08],
  ];
  const rb = L.rng('s23blobs');
  for (let n = 0; n < 8; n++) blobs.push([rb.range(-0.44, 0.44), rb.range(70, 520), rb.range(36, 80), rb.range(12, 22), rb.range(0.07, 0.13) * rb.sign()]);
  for (let n = 0; n < 80; n++) blobs.push([rb.range(-0.45, 0.45), rb.range(66, 560), rb.range(6, 16), rb.range(4, 9), rb.range(0.08, 0.2) * (rb.chance(0.72) ? 1 : -1)]);   // segregation specks
  for (const [th0, d0, ru, rv, amp] of blobs) {
    const p = a.pt(th0, -d0), e = Math.max(ru, rv) * 1.5 + Q;
    const i0 = Math.max(0, Math.floor((p.x - e + PAD) / Q)), i1 = Math.min(LW - 1, Math.ceil((p.x + e + PAD) / Q));
    const j0 = Math.max(0, Math.floor((p.y - e + PAD) / Q)), j1 = Math.min(LH - 1, Math.ceil((p.y + e + PAD) / Q));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * LW + i; if (COV[k] <= 0) continue;
      const du = (TH[k] - th0) * (R - d0), dv = D[k] - d0;
      const wob = 1 + 0.3 * nA.n2(du / (ru * 0.6) + th0 * 91, dv / (rv * 0.8) + d0);
      const q2 = ((du * du) / (ru * ru) + (dv * dv) / (rv * rv)) * wob * wob;
      if (q2 >= 1) continue;
      BL[k] += amp * (1 - q2) * (1 - q2) * sstep(-2, 14, D[k]);
    }
  }

  // output buffers
  const small = L.makeCanvas(LW, LH), sg = small.getContext('2d');
  const img = sg.createImageData(LW, LH), px = new Uint32Array(img.data.buffer);
  const half = L.makeCanvas(LW / 2, LH / 2), soft = L.makeCanvas(LW, LH), bloom = L.makeCanvas(Math.round(LW / 4), Math.round(LH / 4));
  // depth-of-field mask (in layer space): sharp around the crest, soft toward the sides and the bottom
  const mask = L.makeCanvas(LW / 2, LH / 2), mg = mask.getContext('2d'), mi = mg.createImageData(mask.width, mask.height);
  for (let j = 0; j < mask.height; j++) for (let i = 0; i < mask.width; i++) {
    const x = -PAD + (i + 0.5) * Q * 2, y = -PAD + (j + 0.5) * Q * 2;
    const ex = (x - cx) / 1120, ey = y > a.crestY ? (y - a.crestY) / 760 : (a.crestY - y) / 1100;
    mi.data[(j * mask.width + i) * 4 + 3] = 255 * sstep(0.46, 1.08, Math.sqrt(ex * ex + ey * ey));
  }
  mg.putImageData(mi, 0, 0);
  const cellM = new Float32Array(CW * CH), stripeM = new Float32Array(stripes.length), stripeQ = stripes.map((st) => st.q * TN);
  const mid = L.makeCanvas(LW * 2, LH * 2);
  // a light vignette, baked in layer space
  const vig = L.makeCanvas(LW / 2, LH / 2), vg = vig.getContext('2d');
  vg.fillStyle = L.radial(vg, vig.width / 2, vig.height / 2, vig.height * 0.62, vig.width * 0.62, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.34)']]);
  vg.fillRect(0, 0, vig.width, vig.height);
  return { N, Deff, CA, CB, BL, FN, NA, half, mid, vig, stripeM, stripeQ, COV, HV, CID, ST, SID, TR, TG, TB, Ptab, PN, LR, LG, LB, NT, small, sg, img, px, soft, bloom, mask, cellM, CW, CH };
}

/** evaluate the field for this frame and write the scan-resolution picture into S.small */
function paint(p, f) {
  const { N, Deff, CA, CB, BL, FN, NA, COV, HV, CID, ST, SID, TR, TG, TB, Ptab, PN, LR, LG, LB, NT, px, cellM, stripeM, stripeQ } = S;
  const ph = p * L.TAU * 0.7, ca = Math.cos(ph), cb = Math.sin(ph);
  const off = (f * 40503 + 977) & NMASK;
  for (let c = 0; c < cellM.length; c++) cellM[c] = 0.86 + 0.3 * Math.sin(hsh(c, 5) * L.TAU + p * L.TAU * (0.6 + hsh(c, 9)));
  for (let q = 0; q < stripeM.length; q++) stripeM[q] = 1 + 0.07 * Math.sin(hsh(q, 21) * L.TAU + p * L.TAU * (0.5 + hsh(q, 33)));
  const K = (NL - 1) / SMAX, KT = (TN - 1) / TMAX;
  for (let k = 0; k < N; k++) {
    const cov = COV[k];
    const n = FN[k] * 0.6 + NT[(k + off) & NMASK] * 0.55;
    let s;
    if (cov >= 1) {
      let di = ((Deff[k] + ca * CA[k] + cb * CB[k] - P0) * 2) | 0; if (di < 0) di = 0; else if (di >= PN) di = PN - 1;
      s = Ptab[di] + BL[k] + NA[k] * n;
    } else {
      let so = HV[k]; so = so > 0 ? so * cellM[CID[k]] + 0.014 * n : 0.011 * n;
      if (cov > 0) {
        let di = ((Deff[k] + ca * CA[k] + cb * CB[k] - P0) * 2) | 0; if (di < 0) di = 0; else if (di >= PN) di = PN - 1;
        s = so + (Ptab[di] + BL[k] + NA[k] * n - so) * cov;
      } else s = so;
    }
    let li = (s * K) | 0; if (li < 0) li = 0; else if (li >= NL) li = NL - 1;
    let r = LR[li], g = LG[li], b = LB[li];
    const t = ST[k];
    if (t > 0.02) {
      const q = SID[k];
      let ti = ((t * (stripeM[q] + 0.1 * n) + 0.012 * n) * KT) | 0; if (ti < 0) ti = 0; else if (ti >= TN) ti = TN - 1;
      ti += stripeQ[q];
      r += TR[ti]; g += TG[ti]; b += TB[ti];
      if (r > 255) r = 255; if (g > 255) g = 255; if (b > 255) b = 255;
    }
    px[k] = 0xff000000 | (b << 16) | (g << 8) | r;
  }
  S.sg.putImageData(S.img, 0, 0);
}

export default {
  name: '成分扫描伪彩图',
  tone: 'light',
  init(env) { S = build(env); },
  draw(ctx, env, p) {
    const a = env.arc;
    const f = Math.round(p * (env.frames - 1));
    paint(p, f);
    // out-of-focus copy (masked) and bloom source, both made by shrinking the scan-resolution picture
    const hf = S.half.getContext('2d');
    hf.globalCompositeOperation = 'copy'; hf.imageSmoothingEnabled = true;
    hf.drawImage(S.small, 0, 0, S.half.width, S.half.height);
    const so = S.soft.getContext('2d');
    so.globalCompositeOperation = 'copy'; so.imageSmoothingEnabled = true;
    so.drawImage(S.half, 0, 0, S.soft.width, S.soft.height);
    so.globalCompositeOperation = 'destination-in';
    so.drawImage(S.mask, 0, 0, S.soft.width, S.soft.height);
    const bo = S.bloom.getContext('2d');
    bo.globalCompositeOperation = 'copy'; bo.filter = 'contrast(1.8) brightness(0.82) blur(2.4px)'; bo.imageSmoothingEnabled = true;
    bo.drawImage(S.half, 0, 0, S.bloom.width, S.bloom.height);
    bo.filter = 'none';

    // compose at half resolution: hard scan pixels, the out-of-focus copy over them, bloom, vignette
    const mg = S.mid.getContext('2d'), MW = S.mid.width, MH = S.mid.height;
    mg.globalAlpha = 1; mg.globalCompositeOperation = 'copy'; mg.imageSmoothingEnabled = false;
    mg.drawImage(S.small, 0, 0, MW, MH);
    mg.globalCompositeOperation = 'source-over'; mg.imageSmoothingEnabled = true;
    mg.drawImage(S.soft, 0, 0, MW, MH);
    mg.globalCompositeOperation = 'screen'; mg.globalAlpha = 0.34;
    mg.drawImage(S.bloom, 0, 0, MW, MH);
    mg.globalCompositeOperation = 'source-over'; mg.globalAlpha = 1;
    mg.drawImage(S.vig, 0, 0, MW, MH);

    // one blit to the frame: the picture slides a little round the coin's centre (the rim itself stays on the arc);
    // the 2× enlargement softens the pixel edges just enough to read as a photographed screen
    ctx.fillStyle = '#05040a'; ctx.fillRect(0, 0, W, H);
    const rot = L.lerp(-0.006, 0.006, p);
    ctx.save();
    ctx.translate(a.cx, a.cy); ctx.rotate(rot); ctx.translate(-a.cx, -a.cy);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(S.mid, -PAD, -PAD, W + PAD * 2, H + PAD * 2);
    ctx.restore();

    // the scan line: travels down the picture; whatever it has just passed is a little hotter
    const ys = Math.round(L.lerp(440, 1050, p) / Q) * Q;
    ctx.save();
    ctx.globalCompositeOperation = 'color-dodge';
    ctx.fillStyle = L.linear(ctx, 0, ys - 44, 0, ys + 4, [[0, '#000000'], [0.75, '#101010'], [0.9, '#484848'], [0.96, '#484848'], [1, '#000000']]);
    ctx.fillRect(0, ys - 44, W, 48);
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(255,150,236,0.08)'; ctx.fillRect(0, ys - 3, W, 2);
    ctx.restore();
  },
};
