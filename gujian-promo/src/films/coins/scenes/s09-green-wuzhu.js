// s09 — 绿锈五铢. Flat-lay macro of the top edge of a Han wuzhu coin lying on cream xuan paper.
// The arc is the coin's outer edge; just inside it runs the raised outer rim (外郭), then the sunken field (肉),
// all under a thick malachite crust that reads like a leaf: a fine reticulated crackle, a pebbly grain, and a few long
// crust fissures fanning obliquely toward the rim like veins (they are cracks in the corrosion layer, not casting marks).
// A streak of ochre burial soil lies centre-right, bleeding brown into the green.
// Only the uppermost ~3 mm of the coin is in frame, so the inscription and the square hole never appear.
//
// The coin is shaded per pixel in init(): height field → normal → key light from the upper left, then two sparse
// "glitter" layers (same normals, two slightly different light azimuths) that cross-fade as the coin turns.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 90;
const RIMW = 118;      // width of the outer rim (外郭) in px
let S = null;

const sstep = (a, b, v) => { let t = (v - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };

// allocation-free worley noise: squared distances in cD1/cD2, cell id in cId
let cD1 = 0, cD2 = 0, cId = 0;
function cell(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let d1 = 9, d2 = 9, id = 0;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const cx = xi + ox, cy = yi + oy;
    let h = (Math.imul(cx, 374761393) + Math.imul(cy, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    const dx = cx + (h & 1023) / 1023 - x, dy = cy + ((h >>> 10) & 1023) / 1023 - y, dd = dx * dx + dy * dy;
    if (dd < d1) { d2 = d1; d1 = dd; id = ((h >>> 20) & 255) / 255; } else if (dd < d2) d2 = dd;
  }
  cD1 = d1; cD2 = d2; cId = id;
}

const lut = (stops) => {
  const f = L.makeRamp(stops), o = new Float32Array(256 * 3);
  for (let i = 0; i < 256; i++) { const c = f(i / 255); o[i * 3] = c[0]; o[i * 3 + 1] = c[1]; o[i * 3 + 2] = c[2]; }
  return o;
};

/** the long crust fissures: a lopsided fan rooted below-left of frame, each bowing toward the rim like a leaf vein */
function veinCurves(a) {
  const r = L.rng('s09veins'), nz = L.makeNoise('s09veinw');
  const out = [];
  const bez = (p0, p1, bow, n, seed) => {
    const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
    let nx = -(p1[1] - p0[1]), ny = p1[0] - p0[0]; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
    if (ny > 0) { nx = -nx; ny = -ny; }                         // always bow toward the top of frame
    const c = [mx + nx * bow * m, my + ny * bow * m];
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t, wob = Math.sin(t * Math.PI);  // pinned at both ends
      pts.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0] + nx * wob * 5 * nz.n2(t * m / 130, seed),
        u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1] + ny * wob * 5 * nz.n2(t * m / 130, seed)]);
    }
    return pts;
  };
  const rot = (v, ang) => [v[0] * Math.cos(ang) - v[1] * Math.sin(ang), v[0] * Math.sin(ang) + v[1] * Math.cos(ang)];
  const twig = (pts, t, side, ang, len, w, lvl) => {
    const i = Math.max(1, Math.min(pts.length - 2, Math.round(t * (pts.length - 1))));
    const P = pts[i], T = [pts[i + 1][0] - pts[i - 1][0], pts[i + 1][1] - pts[i - 1][1]];
    const m = Math.hypot(T[0], T[1]) || 1; T[0] /= m; T[1] /= m;
    let A = rot(T, ang), B = rot(T, -ang);
    if (A[1] > B[1]) { const q = A; A = B; B = q; }             // A = the one heading up toward the rim
    const D = side > 0 ? A : B;
    const tw = bez(P, [P[0] + D[0] * len, P[1] + D[1] * len], side > 0 ? 0.13 : -0.1, 22, out.length * 3.3 + 1);
    out.push({ pts: tw, w0: w, w1: w * 0.38, lvl });
    return tw;
  };
  const root = [-200, 1700];
  const ends = [-130, 150, 500, 870, 1250, 1640, 2060];
  ends.forEach((ex, n) => {
    const p1 = [ex, a.yAt(ex, -(RIMW - 8))];
    const p0 = [root[0] + r.range(-40, 40), root[1] + r.range(-40, 40)];
    const main = bez(p0, p1, r.range(0.075, 0.12), 90, n * 7.1);
    out.push({ pts: main, w0: 26, w1: 10, lvl: 0 });
    // one or two forks that run on to the rim, then short twigs on both sides
    const nf = n % 2 ? 1 : 2;
    for (let f = 0; f < nf; f++) {
      const fk = twig(main, r.range(0.74, 0.8) + f * 0.09, 1, r.range(0.36, 0.5), r.range(170, 250), 11, 1);
      twig(fk, r.range(0.35, 0.6), -1, r.range(0.6, 0.9), r.range(60, 120), 5, 2);
    }
    for (let q = 0; q < 2; q++) twig(main, r.range(0.68, 0.96), q % 2 ? 1 : -1, r.range(0.7, 1.0), r.range(60, 120), 5.6, 2);
  });
  return out;
}

/** the coin: everything below the arc. Returns { coin, spA, spB, X0, Y0 } (canvases cropped to the coin's region) */
function buildCoin(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const X0 = -PAD, Y0 = Math.floor(a.crestY) - 4;
  const RW = W + PAD * 2, RH = H + PAD - Y0, N = RW * RH;
  const nA = L.makeNoise('s09a'), nB = L.makeNoise('s09b');

  // ── rasterised masks (drawn with the canvas API in frame coords, read back as bytes) ──
  const mask = (draw, blur) => {
    const c = L.makeCanvas(RW, RH), g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, RW, RH);
    g.translate(-X0, -Y0); draw(g);
    const b = blur ? L.blurred(c, blur) : c;
    const px = b.getContext('2d').getImageData(0, 0, RW, RH).data, out = new Uint8Array(N);
    for (let k = 0; k < N; k++) out[k] = px[k * 4];
    return out;
  };
  const veins = veinCurves(a);
  const strokeVeins = (g, wk, wmin, maxLvl) => {
    g.save(); a.clipBelow(g, -(RIMW - 3));
    g.strokeStyle = '#fff'; g.lineCap = 'round';
    for (const v of veins) {
      if (v.lvl > maxLvl) continue;
      const n = v.pts.length - 1;
      for (let i = 1; i <= n; i++) {
        g.lineWidth = Math.max(wmin, L.lerp(v.w0, v.w1, i / n) * wk);
        g.beginPath(); g.moveTo(v.pts[i - 1][0], v.pts[i - 1][1]); g.lineTo(v.pts[i][0], v.pts[i][1]); g.stroke();
      }
    }
    g.restore();
  };
  const Vb = mask((g) => strokeVeins(g, 1, 2.4, 9), 3);          // the pale raised lips of each fissure
  const Vc = mask((g) => strokeVeins(g, 0.12, 1.1, 1), 0.7);        // the dark crack down its middle
  const soilShape = (g) => {                                     // burial soil: a diagonal streak centre-right
    const nz = L.makeNoise('s09soilshape'), r = L.rng('s09soil');
    g.fillStyle = '#fff';
    const blob = (x, y, rad) => { g.beginPath(); g.ellipse(x, y, rad, rad * 0.9, 0, 0, L.TAU); g.fill(); };
    const spine = L.smoothPath([[1132, a.yAt(1132, -(RIMW + 34))], [1150, 752], [1196, 846], [1212, 950], [1262, 1056], [1306, 1190], [1340, 1320]], 8);
    spine.forEach(([x, y], i) => {
      const t = i / (spine.length - 1);
      blob(x + 18 * nz.n2(t * 9, 1.3), y, 46 + 17 * Math.sin(t * 9.4 + 2.2) + 17 * nz.n2(t * 8, 4.1));
    });
    // soil packed into the corner under the rim beside the streak
    a.at(g, a.thetaAtX(1132) - 0.012, -(RIMW + 20), () => { g.beginPath(); g.ellipse(0, 0, 96, 13, 0, 0, L.TAU); g.fill(); });
    // a few ragged satellites, and two faint smears far to the left like the spots on a leaf
    const sat = [[1052, 962, 15], [1334, 902, 12], [1088, 842, 9], [1296, 1016, 10], [246, 908, 15], [570, 802, 10]];
    for (const [x, y, rad] of sat) for (let q = 0; q < 4; q++) blob(x + r.range(-rad, rad), y + r.range(-rad, rad) * 0.7, rad * r.range(0.5, 1));
  };
  const Sm = mask(soilShape, 14), Sw = mask(soilShape, 40);     // the soil itself / the wide stain around it

  // ── slow fields on a coarse grid (bilinear-sampled) ──
  const CS = 4, cw = Math.ceil(RW / CS) + 2, ch = Math.ceil(RH / CS) + 2, cn = cw * ch;
  const cLump = new Float32Array(cn), cHue = new Float32Array(cn), cPow = new Float32Array(cn), cWx = new Float32Array(cn),
    cWy = new Float32Array(cn), cSoil = new Float32Array(cn), cZone = new Float32Array(cn), cMid = new Float32Array(cn), cCor = new Float32Array(cn);
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const x = X0 + i * CS, y = Y0 + j * CS, k = j * cw + i;
    cLump[k] = nA.fbm(x / 120, y / 120, 4, 2, 0.55);
    cHue[k] = nA.fbm(x / 520 + 9, y / 520 - 4, 3);
    cPow[k] = nB.fbm(x / 70 + 40, y / 70, 3);
    cWx[k] = nB.n2(x / 170 + 5, y / 170); cWy[k] = nB.n2(x / 170 - 31, y / 170 + 19);
    cSoil[k] = nB.fbm(x / 52 - 7, y / 52 + 3, 3, 2, 0.6);
    cZone[k] = nA.fbm(x / 340 + 70, y / 340 + 21, 2);
    cMid[k] = nA.fbm(x / 30 - 12, y / 30 + 44, 2, 2, 0.6);
    cCor[k] = nB.fbm(x / 230 + 3, y / 230 - 8, 2);
  }
  let bk = 0, btx = 0, bty = 0;
  const B = (s) => { const a0 = s[bk], a1 = s[bk + 1], b0 = s[bk + cw], b1 = s[bk + cw + 1]; return (a0 + (a1 - a0) * btx) * (1 - bty) + (b0 + (b1 - b0) * btx) * bty; };

  // two small knocks on the edge (磕缺): u = arc length from the crest, w = half width, d = depth (px)
  const NICKS = [{ u: -338, w: 27, d: 10 }, { u: 596, w: 17, d: 6.5 }];

  const GREEN = lut([[0, '#0f3f27'], [0.2, '#1c5f3c'], [0.44, '#2f9a5f'], [0.6, '#3dae66'], [0.8, '#7cc47a'], [1, '#b9e6a6']]);
  const SOIL = lut([[0, '#644214'], [0.25, '#96702a'], [0.5, '#c9a24a'], [0.78, '#dcbc68'], [1, '#f1dd9f']]);

  // ── pass 1: height, albedo, occlusion, gloss ──
  const Hh = new Float32Array(N), Ao = new Float32Array(N), Gs = new Float32Array(N);
  const img = new ImageData(RW, RH), d = img.data;
  for (let j = 0; j < RH; j++) {
    const y = Y0 + j, ddy = cy - y, fy = j / CS, j0 = fy | 0;
    for (let i = 0; i < RW; i++) {
      const x = X0 + i, ddx = x - cx;
      const v = R - Math.sqrt(ddx * ddx + ddy * ddy);            // depth inside the arc
      if (v < -1.5) continue;
      const k = j * RW + i;
      const u = Math.atan2(ddx, ddy) * R;
      let e = 0;
      if (v < 26) {
        e = 0.45 * nA.n2(u / 41, 7.7);
        for (const q of NICKS) { const du = (u - q.u) / q.w; if (du > -1 && du < 1) e += q.d * Math.pow(1 - du * du, 0.75) * (1 + 0.3 * nB.n2(u / 8, 2.2)); }
      }
      const ins = v - e;                                           // > 0 inside the coin
      if (ins <= -0.5) continue;
      const fx = i / CS, i0 = fx | 0; bk = j0 * cw + i0; btx = fx - i0; bty = fy - j0;
      const lump = B(cLump), wx = B(cWx), wy = B(cWy), sn = B(cSoil);

      // rim profile: bevel up from the edge, flat-ish top, step down to the field
      const hOut = sstep(-0.5, 12, ins);
      const rimIn = 1 - sstep(RIMW - 9 + 3.5 * wx, RIMW + 8 + 3.5 * wx, v);
      const rimTop = hOut * rimIn;
      const rv = (v - RIMW * 0.5) / (RIMW * 0.5);
      const hRim = 8.5 * rimTop - 1.3 * rimIn * rv * rv;

      // corrosion crust: lumpy relief, a sugary grain, and a hairline crackle that comes and goes
      const mid = B(cMid);
      const g1 = nA.n2(x / 5.5, y / 5.5), g2 = nB.n2(x / 2.4 + 50, y / 2.4);
      const w1 = nA.n2(x / 13 + 80, y / 13), w2 = nB.n2(x / 13 - 20, y / 13 + 60);       // wiggle: no ruler-straight cracks
      cell(x / 35 + wx * 0.42 + w1 * 0.075, y / 35 + wy * 0.42 + w2 * 0.075);
      const e1 = Math.sqrt(cD2) - Math.sqrt(cD1), id1 = cId;
      const groove1 = 1 - sstep(0.008, 0.05 + 0.04 * id1, e1 + 0.01 * g1);
      const dome1 = sstep(0, 0.4, e1);
      cell(x / 11.5 + 17 + wy * 0.2 + w2 * 0.12, y / 11.5 - 5 + wx * 0.2 + w1 * 0.12);
      const e2 = Math.sqrt(cD2) - Math.sqrt(cD1), id2 = cId;
      const groove2 = 1 - sstep(0.02, 0.15, e2);
      const peb = 1 - Math.min(1, cD1 * 3.4);
      const zone = sstep(-0.3, 0.28, B(cZone));
      const cs = (0.16 + 0.84 * zone) * (1 - 0.72 * rimTop);

      // burial soil: thick and pale in the middle of the streak, thin, damp and brown at its ragged edge
      const sb = Sm[k] / 255;
      let sm = sb * 1.28 * (1 - 0.7 * rimIn) + 0.34 * sn + 0.13 * mid + (sb > 0.04 ? 0.12 * groove1 : 0) + 0.05 * g1;
      const dv = v - RIMW - 11, corner = Math.exp(-(dv * dv) / 70);
      sm = Math.max(sm, corner * (0.42 + 0.5 * B(cCor)) + 0.3 * sn + 0.08 * mid);
      const thick = sstep(0.56, 0.84, sm);
      const soil = sstep(0.47, 0.6, sm) * (0.78 + 0.22 * thick), seep = sstep(0.22, 0.5, sm) * (1 - soil);
      const stain = sstep(0.1, 0.75, (Sw[k] / 255) * 1.7 + 0.3 * sn + 0.12 * mid) * (1 - soil);

      // fissures
      const pw = B(cPow);
      const vb = (Vb[k] / 255) * (0.82 + 0.18 * sstep(-0.35, 0.25, pw + 0.5 * mid)), vc = Vc[k] / 255;
      const pit = id2 > 0.972 && lump + 0.6 * mid < 0.05 ? peb : 0, crys = id2 < 0.05 ? peb : 0;

      const det = 1 - 0.8 * soil;
      Hh[k] = hRim + 2.0 * lump * (1 - 0.5 * rimTop) + 1.1 * mid * (1 - 0.4 * rimTop)
        + det * cs * (0.7 * dome1 - 1.9 * groove1)
        + det * (0.32 * peb - 0.32 * groove2 * (0.4 + 0.6 * zone) - 1.5 * pit + 0.6 * crys)
        + 0.42 * g1 + 0.24 * g2
        + (3.6 * vb - 1.5 * vc) * (1 - 0.6 * soil)
        + soil * (0.3 + 1.1 * thick + 0.55 * g2 + 0.45 * g1 - 0.5 * groove1);

      // albedo
      let t = 0.46 + 0.46 * lump * (1 - 0.35 * rimTop) + 0.2 * mid + 0.24 * pw + 0.05 * dome1 * cs + 0.05 * peb + 0.06 * g1 + 0.05 * g2 + 0.25 * crys - 0.1 * rimTop;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      let li = ((t * 255) | 0) * 3;
      let cr = GREEN[li], cg = GREEN[li + 1], cb = GREEN[li + 2];
      const hu = B(cHue);
      if (hu > 0) { cr += hu * 52; cg += hu * 12; cb -= hu * 34; } else { cr += hu * 22; cb -= hu * 34; }   // yellow-green ↔ a breath of turquoise
      // the rim: a shade deeper, and darker still where its high spots are rubbed
      const rk = rimTop * (0.4 + 0.3 * sstep(0, 0.45, lump)); cr += (24 - cr) * rk; cg += (104 - cg) * rk; cb += (68 - cb) * rk;
      // crackle & pits go dark (brown where the soil has stained them)
      const dk = Math.min(1, det * (0.7 * groove1 * cs + 0.2 * groove2 * zone + 0.7 * pit));
      cr += (14 + 70 * seep - cr) * dk; cg += (62 - cg) * dk; cb += (38 - 14 * seep - cb) * dk;
      // fissures: pale tender-green lips, dark core
      const vk = Math.min(1, vb * 1.25) * 0.9 * (1 - 0.7 * soil);
      cr += (196 - cr) * vk; cg += (236 - cg) * vk; cb += (148 - cb) * vk;
      const ck = vc * 0.5 * (1 - 0.6 * soil);
      cr += (12 - cr) * ck; cg += (54 - cg) * ck; cb += (32 - cb) * ck;
      // brown seep round the soil, then the soil itself
      if (stain > 0) { const s1 = stain * 0.5; cr += (176 - cr) * s1; cg += (186 - cg) * s1; cb += (70 - cb) * s1; }      // the green yellows around the soil
      if (seep > 0) { const s2 = seep * (0.66 + 0.25 * mid); cr += (116 - cr) * s2; cg += (80 - cg) * s2; cb += (28 - cb) * s2; }
      if (soil > 0) {
        let ts = 0.16 + 0.5 * thick + 0.24 * sn + 0.22 * mid + 0.24 * g2 + 0.16 * g1 - 0.3 * groove1 - (g2 < -0.5 ? 0.3 : 0);
        ts = ts < 0 ? 0 : ts > 1 ? 1 : ts; li = ((ts * 255) | 0) * 3;
        cr += (SOIL[li] - cr) * soil; cg += (SOIL[li + 1] - cg) * soil; cb += (SOIL[li + 2] - cb) * soil;
      }
      // the very edge falls away
      const ek = 0.55 * (1 - sstep(0, 1.8, ins));
      cr += (16 - cr) * ek; cg += (58 - cg) * ek; cb += (36 - cb) * ek;

      const o = k * 4;
      d[o] = cr; d[o + 1] = cg; d[o + 2] = cb; d[o + 3] = Math.min(1, ins + 0.5) * 255;
      // the rim throws a soft shadow onto the field at its foot
      Ao[k] = 1 - 0.24 * (1 - sstep(RIMW + 2, RIMW + 34, v)) * (1 - rimIn) - 0.1 * dk;
      Gs[k] = (0.3 + 0.7 * peb) * (1 - 0.9 * soil) * (id2 > 0.6 ? 1 : 0.12) + 0.5 * crys + 0.25 * rk;
    }
  }

  // ── pass 2: light it. Key from the upper left, high; fill is implicit in the ambient term ──
  const nrm = (v) => { const m = Math.hypot(v[0], v[1], v[2]); return [v[0] / m, v[1] / m, v[2] / m]; };
  const LK = nrm([-0.5, -0.62, 0.6]);
  const half = (az) => { const c = Math.cos(az), s = Math.sin(az); return nrm([LK[0] * c - LK[1] * s, LK[0] * s + LK[1] * c, LK[2] + 1]); };
  const HK = half(0), HA = half(-0.3), HB = half(0.3);
  const imA = new ImageData(RW, RH), imB = new ImageData(RW, RH), dA = imA.data, dB = imB.data;
  for (let j = 1; j < RH - 1; j++) {
    for (let i = 1; i < RW - 1; i++) {
      const k = j * RW + i, o = k * 4;
      if (d[o + 3] === 0) continue;
      const hx = (Hh[k + 1] - Hh[k - 1]) * 0.5, hy = (Hh[k + RW] - Hh[k - RW]) * 0.5;
      const inv = 1 / Math.sqrt(hx * hx + hy * hy + 1), nx = -hx * inv, ny = -hy * inv, nz = inv;
      const df = nx * LK[0] + ny * LK[1] + nz * LK[2];
      let sh = 0.4 + 0.6 * (df > 0 ? df : 0) / LK[2];
      sh = (sh > 1.6 ? 1.6 : sh) * Ao[k];
      // broad light falloff: brightest upper-left, a touch deeper toward the lower right
      sh *= 1.05 - 0.13 * (i / RW) - 0.1 * (j / RH);
      const gs = Gs[k];
      const sk = nx * HK[0] + ny * HK[1] + nz * HK[2];
      const sp = sk > 0 ? Math.pow(sk, 30) * 0.5 * (0.3 + 0.5 * gs) : 0;       // soft sheen
      d[o] = d[o] * sh + 215 * sp; d[o + 1] = d[o + 1] * sh + 245 * sp; d[o + 2] = d[o + 2] * sh + 205 * sp;
      if (gs > 0.25) {
        const sa = nx * HA[0] + ny * HA[1] + nz * HA[2], sb = nx * HB[0] + ny * HB[1] + nz * HB[2];
        const ga = sa > 0.9 ? Math.pow(sa, 110) * gs * 520 : 0, gb = sb > 0.9 ? Math.pow(sb, 110) * gs * 520 : 0;
        if (ga > 4) { dA[o] = 240; dA[o + 1] = 255; dA[o + 2] = 226; dA[o + 3] = ga > 255 ? 255 : ga; }
        if (gb > 4) { dB[o] = 240; dB[o + 1] = 255; dB[o + 2] = 226; dB[o + 3] = gb > 255 ? 255 : gb; }
      }
    }
  }
  const put = (im) => { const c = L.makeCanvas(RW, RH); c.getContext('2d').putImageData(im, 0, 0); return c; };
  return { coin: put(img), spA: put(imA), spB: put(imB), X0, Y0 };
}

/** cream xuan paper with the coin's faint shadow hugging the arc (cropped: only the part above the coin is ever seen) */
function buildPaper(env) {
  const a = env.arc;
  const pw = W + PAD * 2, ph = Math.ceil(a.yAt(-PAD, 0)) + 60 + PAD;
  const c = L.makeCanvas(pw, ph), g = c.getContext('2d');
  g.drawImage(L.paperTex(pw, ph, { base: '#f1e7cd', seed: 's09paper', tone: '#b79b60', fiber: 0.5, stain: 0.24, grain: 0.15 }), 0, 0);
  g.translate(PAD, PAD);
  // long loose fibres of the paper
  const r = L.rng('s09fibre');
  g.lineCap = 'round';
  for (let i = 0; i < 150; i++) {
    const x = r.range(-PAD, W + PAD), y = r.range(-PAD, ph - PAD), len = r.range(40, 150), ang = r.range(0, Math.PI), bend = r.range(-0.5, 0.5);
    g.strokeStyle = r.chance(0.6) ? L.rgba('#fffaf0', r.range(0.12, 0.3)) : L.rgba('#a58a56', r.range(0.05, 0.13));
    g.lineWidth = r.range(0.6, 1.5);
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(ang + bend) * len * 0.5, y + Math.sin(ang + bend) * len * 0.5, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    g.stroke();
  }
  // even, bright light with a breath of falloff
  g.globalCompositeOperation = 'soft-light';
  g.fillStyle = L.linear(g, 0, -PAD, W, ph, [[0, 'rgba(255,252,240,0.3)'], [0.6, 'rgba(255,250,236,0)'], [1, 'rgba(120,96,50,0.16)']]);
  g.fillRect(-PAD, -PAD, pw, ph);
  g.globalCompositeOperation = 'source-over';
  // the coin's shadow: tight contact line + a very faint wide penumbra, with a whisper of green bounce
  g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 12, a.R + 90, [[0, 'rgba(70,64,30,0.42)'], [0.13, 'rgba(70,64,30,0.36)'], [0.19, 'rgba(78,74,36,0.17)'], [0.34, 'rgba(84,92,46,0.085)'], [0.62, 'rgba(92,120,60,0.03)'], [1, 'rgba(92,120,60,0)']]);
  g.fillRect(-PAD, -PAD, pw, ph);
  return c;
}

export default {
  name: '绿锈五铢',
  tone: 'dark',
  init(env) {
    S = { paper: buildPaper(env), ...buildCoin(env) };
  },
  draw(ctx, env, p) {
    const rot = L.lerp(-0.0065, 0.0065, p), zoom = L.lerp(0.994, 1.014, p);
    // the paper stays put (it only breathes with the push-in); the coin turns a hair about its own centre
    L.cam(ctx, env, { zoom, rot: rot * 0.1 }, () => ctx.drawImage(S.paper, -PAD, -PAD));
    L.cam(ctx, env, { rot, zoom }, () => {
      ctx.drawImage(S.coin, S.X0, S.Y0);
      // glitter: the grains that catch the light change as the coin turns
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 1 - sstep(0.1, 0.8, p); ctx.drawImage(S.spA, S.X0, S.Y0);
      ctx.globalAlpha = sstep(0.2, 0.9, p); ctx.drawImage(S.spB, S.X0, S.Y0);
    });
  },
};
