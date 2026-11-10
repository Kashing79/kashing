// s16 — 朱漆更鼓. Macro of the shoulder of a big watch-drum (更鼓) against black:
// the arc is the rim where the cowhide head folds over the barrel. Just below it the cream hide skirt is pinned
// by two staggered rows of dome-headed drum nails; under that the barrel swells away in vermilion lacquer —
// a wet highlight band, craquelure (断纹), a few rubbed patches and flakes, and worn gold-line clouds (描金云纹).
//
// Everything under the arc is shaded per pixel in init() from a height field laid out in drum coordinates
// (U = distance along the rim, d = depth below it). The lacquer's specular band is NOT baked: init() stores, per pixel,
// where on the barrel's curve that pixel "acts" once its bump slope is taken into account (E) — draw() then only looks
// up a 1-D highlight profile at E − E0(p), so the reflection slides over the crackle plates as the shot runs.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 120;
let S = null;

const RN = 26;            // nail-head radius (px)
const PITCH = 88;         // nail spacing along the rim
const ROWS = [52, 106];   // depth of the two nail rows below the rim
const HB = 150;           // depth of the hide skirt's cut edge
const KS = 520;           // how far a unit of radial slope drags the highlight (≈ radius of the barrel's bulge)
const CU = 124, CD = 50;  // size of a craquelure plate along / across the barrel
const KEY_T = -0.1;       // the key light sits a little left of centre

const sstep = (a, b, v) => { let t = (v - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
function hsh(ix, iy) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

// craquelure: voronoi plates on a brick-offset lattice, measured in real px so every crack has the same width.
// out: vE = distance to the nearest crack, vH = plate hash, (vPu, vPd) = plate centre
let vE = 0, vH = 0, vPu = 0, vPd = 0;
function vor(u, v) {
  const yi = Math.floor(v / CD), xi = Math.floor(u / CU);
  let d1 = 1e12, d2 = 1e12, p1x = 0, p1y = 0, p2x = 0, p2y = 0, h1 = 0;
  for (let oy = -2; oy <= 2; oy++) {
    const cyi = yi + oy, off = cyi & 1 ? 0.5 : 0;
    for (let ox = -1; ox <= 1; ox++) {
      const cxi = xi + ox, h = hsh(cxi, cyi);
      const px = (cxi + off + 0.1 + 0.8 * ((h & 1023) / 1023)) * CU, py = (cyi + 0.12 + 0.76 * (((h >>> 10) & 1023) / 1023)) * CD;
      const dx = px - u, dy = py - v, dd = dx * dx + dy * dy;
      if (dd < d1) { d2 = d1; p2x = p1x; p2y = p1y; d1 = dd; p1x = px; p1y = py; h1 = h; } else if (dd < d2) { d2 = dd; p2x = px; p2y = py; }
    }
  }
  const sx = p2x - p1x, sy = p2y - p1y;
  vE = (d2 - d1) / (2 * Math.sqrt(sx * sx + sy * sy) + 1e-6);
  vH = h1; vPu = p1x; vPd = p1y;
}

/** worn gold-line cloud scrolls painted on the barrel → coverage mask (0..255) in region pixels */
function buildGiltMask(env, X0, Y0, RW, RH) {
  const a = env.arc;
  const c = L.makeCanvas(RW, RH), g = c.getContext('2d', { willReadFrequently: true });
  g.translate(-X0, -Y0);
  const spiral = (x0, y0, r, a0, turns, dir, n = 30) => {
    const out = [];
    for (let t = 0; t <= n; t++) { const u = t / n, ang = a0 + dir * u * turns * L.TAU, rad = r * (1 - 0.88 * Math.pow(u, 0.8)); out.push([x0 + rad * Math.cos(ang), y0 + rad * Math.sin(ang)]); }
    return out;
  };
  const cloud = (U, d, s, flip, seed) => {
    a.at(g, U / a.R, -d, () => {
      const fx = flip ? -s : s;
      const P = (pts, w, k, taper = [0.08, 0.2]) => L.inkStroke(g, pts.map(([x, y]) => [x * fx, y * s]), { width: w, color: '#fff', seed: seed * 7 + k, taper, wobble: 0.22, smoothStep: 3 });
      // ruyi head: a round crown between two scrolls that curl inward
      P([[-0.5, -0.5], [-0.56, -0.9], [-0.34, -1.2], [0, -1.3], [0.34, -1.2], [0.56, -0.9], [0.5, -0.5]], 7.5, 1, [0.12, 0.12]);
      P([[-0.42, -0.62], [-0.7, -0.66]].concat(spiral(-0.98, 0.02, 0.6, -Math.PI / 2, 1.45, -1)), 7.5, 2, [0.05, 0.3]);
      P([[0.42, -0.62], [0.7, -0.66]].concat(spiral(0.98, 0.02, 0.6, -Math.PI / 2, 1.45, 1)), 7.5, 3, [0.05, 0.3]);
      P([[-0.62, 0.6], [-0.2, 0.74], [0.2, 0.74], [0.62, 0.6]], 5.5, 4, [0.3, 0.3]);
      // streaming tail with a hooked end, and a short second streamer under it
      P([[0.1, 0.78], [0.8, 0.98], [1.6, 0.9], [2.3, 0.62], [2.75, 0.4]].concat(spiral(2.78, 0.12, 0.28, Math.PI / 2, 0.95, -1, 16)), 6.5, 5, [0.1, 0.3]);
      P([[0.9, 1.22], [1.6, 1.24], [2.3, 1.02], [2.9, 0.84]], 4.5, 6, [0.25, 0.4]);
      P([[-1.5, 0.74], [-1.9, 0.9], [-2.4, 0.86]], 4.5, 7, [0.2, 0.5]);
    });
  };
  cloud(-190, 408, 60, false, 1);
  cloud(480, 372, 54, true, 2);
  cloud(-800, 356, 52, true, 3);
  cloud(1040, 348, 52, false, 4);
  cloud(200, 540, 48, true, 5);
  cloud(-1320, 350, 52, false, 6);
  cloud(1540, 350, 52, true, 7);
  // a fine double gold line ringing the barrel above the clouds
  g.strokeStyle = '#fff'; g.lineWidth = 3.2; a.stroke(g, -(HB + 122));
  g.lineWidth = 1.6; a.stroke(g, -(HB + 131));
  const src = g.getImageData(0, 0, RW, RH).data, M = new Uint8Array(RW * RH);
  for (let k = 0; k < M.length; k++) M[k] = src[k * 4 + 3];
  return M;
}

function buildDrum(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const X0 = -PAD, Y0 = Math.floor(a.crestY) - 3;
  const RW = W + PAD * 2, RH = H + PAD - Y0, N = RW * RH;
  const nA = L.makeNoise('s16a'), nB = L.makeNoise('s16b'), nC = L.makeNoise('s16c');

  // ── slow fields on a coarse grid ──
  const CS = 4, cw = Math.ceil(RW / CS) + 2, ch = Math.ceil(RH / CS) + 2, CN = cw * ch;
  const cMot = new Float32Array(CN), cBuck = new Float32Array(CN), cTone = new Float32Array(CN), cWear = new Float32Array(CN),
    cCrk = new Float32Array(CN), cBrush = new Float32Array(CN), cWx = new Float32Array(CN), cWy = new Float32Array(CN), cGl = new Float32Array(CN);
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const ddx = X0 + i * CS - cx, ddy = cy - (Y0 + j * CS), rr = Math.hypot(ddx, ddy);
    const U = Math.atan2(ddx, ddy) * R, d = R - rr, k = j * cw + i;
    if (d < HB + 30) { cMot[k] = nA.fbm(U / 230, d / 120, 4); cBuck[k] = nA.fbm(U / 64 + 9, d / 80 + 3, 3); }
    if (d > HB - 30) {
      cTone[k] = nB.fbm(U / 430 + 5, d / 260, 4);
      cWear[k] = nB.fbm(U / 330 - 17, d / 150 + 31, 5, 2, 0.55);
      cCrk[k] = nB.fbm(U / 520 + 71, d / 300 - 9, 3);
      cBrush[k] = nC.fbm(U / 300, d / 26, 3);
      cWx[k] = nC.n2(U / 210 + 5, d / 210); cWy[k] = nC.n2(U / 210 - 31, d / 210 + 19);
      cGl[k] = nC.fbm(U / 58 + 13, d / 58 + 47, 3);
    }
  }
  const bil = (src, i, j) => {
    const fx = i / CS, fy = j / CS, i0 = fx | 0, j0 = fy | 0, tx = fx - i0, ty = fy - j0, k = j0 * cw + i0;
    const a0 = src[k], a1 = src[k + 1], b0 = src[k + cw], b1 = src[k + cw + 1];
    return (a0 + (a1 - a0) * tx) * (1 - ty) + (b0 + (b1 - b0) * tx) * ty;
  };

  // hand-cut lower edge of the hide, as a function of position along the rim
  const UH = 1560, EDGE = new Float32Array(UH * 2 + 1);
  for (let u = -UH; u <= UH; u++) EDGE[u + UH] = HB + 4.5 * nA.n2(u / 150, 1.7) + 1.7 * nA.n2(u / 24, 9.2) + 0.6 * nA.n2(u / 6, 4.4);

  const gilt = buildGiltMask(env, X0, Y0, RW, RH);

  // ── pass 1: height field + albedo + material ──
  const Hh = new Float32Array(N), Dd = new Float32Array(N), Ua = new Float32Array(N), E = new Float32Array(N);
  const Mat = new Uint8Array(N), Gl = new Uint8Array(N), Mg = new Uint8Array(N), Qe = new Float32Array(N);
  const img = new ImageData(RW, RH), px = img.data;
  const SWA = 286 / R;   // angular width of one barrel stave
  for (let j = 0; j < RH; j++) {
    const y = Y0 + j, ddy = cy - y;
    for (let i = 0; i < RW; i++) {
      const k = j * RW + i, x = X0 + i, ddx = x - cx, rr = Math.sqrt(ddx * ddx + ddy * ddy), d = R - rr;
      if (d < -1.2) continue;
      const th = Math.atan2(ddx, ddy), U = th * R, o = k * 4;
      Dd[k] = d; Ua[k] = U;
      let ui = Math.round(U) + UH; ui = ui < 0 ? 0 : ui > UH * 2 ? UH * 2 : ui;
      const de = EDGE[ui];
      if (d < de) {
        // ── cowhide skirt ──
        Mat[k] = 1;
        const tight = 0.25 + 0.75 * Math.exp(-d / 60);
        const cr = (nA.n2(U / 11, d / 170 + 3) * 0.3 + nA.n2(U / 34 + 40, d / 260) * 0.5) * tight;   // tension creases run straight down from the rim
        const pore = nB.n2(x / 2.7, y / 2.7) * 0.1 + nB.n2(x / 6.5 + 9, y / 6.5) * 0.08;
        Hh[k] = cr + pore + bil(cBuck, i, j) * 1.2 + 2.6 * sstep(0, 3.2, de - d);
        const m = bil(cMot, i, j) * 1.4;
        let r = 226, g = 207, b = 168;
        if (m > 0) { const t = m > 1 ? 1 : m; r += (244 - r) * t * 0.8; g += (232 - g) * t * 0.8; b += (203 - b) * t * 0.8; }   // thin, milky patches
        else { const t = m < -1 ? 1 : -m; r += (196 - r) * t; g += (157 - g) * t; b += (102 - b) * t; }                       // thick, honey-coloured ones
        const fol = nB.n2(x / 1.7 + 50, y / 1.7);                               // hair follicles
        const dirt = 1 - 0.14 * Math.max(0, -cr) + pore * 0.18 - (fol > 0.5 ? (fol - 0.5) * 0.22 : 0);
        const eg = 1 - sstep(0, 18, de - d);                                  // grime gathered along the cut edge
        r = (r + (128 - r) * eg * 0.42) * dirt; g = (g + (92 - g) * eg * 0.42) * dirt; b = (b + (56 - b) * eg * 0.42) * dirt;
        px[o] = r; px[o + 1] = g; px[o + 2] = b;
      } else {
        // ── vermilion lacquer ──
        Mat[k] = 2;
        const q = d - de; Qe[k] = q;
        const Ul = th * rr;
        vor(U + bil(cWx, i, j) * 30, d + bil(cWy, i, j) * 16);
        const e = vE, h2 = Math.imul(vH ^ 0x9e3779b9, 668265263) >>> 0;
        const tD = ((vH >>> 20) & 255) / 127.5 - 1, tU = ((h2 >>> 8) & 255) / 127.5 - 1, tT = ((h2 >>> 16) & 255) / 127.5 - 1, tC = (h2 & 255) / 255;
        const cm = sstep(-0.3, 0.05, bil(cCrk, i, j));                        // where the lacquer has crazed at all
        const line = cm * (1 - sstep(0.5, 1.45, e));
        const fine = nC.n2(Ul / 5.5, d / 5.5) * 0.6 + nC.n2(Ul / 2.4 + 31, d / 2.4) * 0.4;
        let h = 0.34 * bil(cBrush, i, j) + 0.05 * fine
          + cm * (tD * (d - vPd) * 0.012 + tU * (U - vPu) * 0.005)             // every plate tips its own way
          + cm * 0.4 * Math.exp(-e / 4.5)                                      // plate edges curl up
          - line;                                                             // the crack itself
        // stave joints telegraphing through the lacquer
        const sa = th / SWA + 0.37, si = Math.round(sa);
        let sd = (sa - si) * SWA * rr, seam = 0;
        if (sd > -26 && sd < 26) {
          sd += 3 * nA.n2(d / 90, si * 7.3);
          const ss = 0.55 + 0.45 * nA.n2(d / 140 + 5, si * 3.1);
          seam = ss * Math.exp(-(sd * sd) / 1.5);
          h += 0.28 * Math.exp(-Math.abs(sd) / 9) - 0.9 * seam;
        }
        const wearN = bil(cWear, i, j);
        const wv = wearN * 0.5 + 0.5 + 0.06 * fine + 0.08 * cm * Math.exp(-e / 7);
        const wear = sstep(0.69, 0.76, wv);
        // flakes: whole plates gone, down to the grey ground
        let chip = 0;
        if (tC < 0.045 && cm > 0.6 && wearN > 0 && q > 30) { chip = sstep(1.0, 2.6, e + 1.2 * fine) * sstep(-0.4, -0.15, nB.n2(U / 46 + 7, d / 34)); h -= 1.5 * chip; }
        let mg = gilt[k] / 255;
        if (mg > 0) {
          const keep = sstep(-0.32, 0.02, bil(cGl, i, j) + 0.22 * fine) * (tC > 0.72 && cm > 0.5 ? 0.12 : 1) * (1 - wear) * (1 - chip) * (1 - line);
          mg *= keep; h += 0.3 * mg;
        }
        Hh[k] = h;
        const tn = bil(cTone, i, j), tone = 1 + 0.16 * tn + 0.035 * tT * cm + 0.03 * fine;
        let r = 192 * tone, g = (34 + 14 * tn) * tone, b = (24 - 4 * tn) * tone;
        if (wear > 0) { const w = wear * 0.9; r += (62 - r) * w; g += (19 - g) * w; b += (12 - b) * w; }
        if (chip > 0) { const cv = 0.8 + 0.35 * fine; r += (136 * cv - r) * chip; g += (112 * cv - g) * chip; b += (86 * cv - b) * chip; }
        if (mg > 0) { r += (204 - r) * mg; g += (150 - g) * mg; b += (58 - b) * mg; }
        const dk = 1 - 0.72 * line - 0.6 * seam;
        px[o] = r * dk; px[o + 1] = g * dk; px[o + 2] = b * dk;
        Gl[k] = 255 * (1 - line) * (1 - 0.8 * wear) * (1 - 0.95 * chip) * (1 - 0.7 * seam) * sstep(1, 4, q);
        Mg[k] = 255 * mg;
      }
    }
  }

  // ── the nails: where they are ──
  const nails = [];
  const PA = PITCH / R, nmax = Math.ceil(a.span(PAD + 90) / PA) + 1;
  for (let row = 0; row < 2; row++) for (let n = -nmax; n <= nmax; n++) {
    const h = hsh(n * 7 + 13, row * 31 + 5);
    const th = (n + (row ? 0.5 : 0)) * PA + (((h & 255) / 255 - 0.5) * 5) / R;
    const rrN = R - ROWS[row] - (((h >>> 8) & 255) / 255 - 0.5) * 5;
    nails.push({ x: cx + rrN * Math.sin(th) - X0, y: cy - rrN * Math.cos(th) - Y0, rad: RN * (1 + (((h >>> 16) & 255) / 255 - 0.5) * 0.1), row, gilt: (h >>> 24) / 255, id: n * 2 + row });
  }
  const eachPx = (nl, ext, fn) => {
    const e = Math.ceil(nl.rad * ext);
    const j0 = Math.max(1, Math.floor(nl.y - e)), j1 = Math.min(RH - 2, Math.ceil(nl.y + e)), i0 = Math.max(1, Math.floor(nl.x - e)), i1 = Math.min(RW - 2, Math.ceil(nl.x + e));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(j * RW + i, i - nl.x, j - nl.y);
  };
  // each nail drags the hide down into a dimple, with pucker creases fanning out and a rusty halo
  for (const nl of nails) eachPx(nl, 2.3, (k, ox, oy) => {
    if (Mat[k] !== 1) return;
    const dist = Math.sqrt(ox * ox + oy * oy), out = Math.max(0, dist - nl.rad), t = dist / (1.5 * nl.rad);
    Hh[k] -= 2.2 * Math.exp(-t * t);
    const fan = Math.exp(-out / (0.8 * nl.rad));
    Hh[k] += 0.55 * fan * nA.n2(Math.atan2(oy, ox) * 2.6 + nl.id * 3.1, dist / 70);
    const st = Math.exp(-out / (0.3 * nl.rad)) * (0.55 + 0.45 * nB.n2(ox / 14 + nl.id, oy / 14)) * 0.3, o = k * 4;
    px[o] += (126 - px[o]) * st; px[o + 1] += (84 - px[o + 1]) * st; px[o + 2] += (46 - px[o + 2]) * st;
  });

  // ── pass 2: light it ──
  const lx = -0.46, ly = -0.888;
  for (let j = 0; j < RH; j++) {
    const ddy = cy - (Y0 + j);
    for (let i = 0; i < RW; i++) {
      const k = j * RW + i, mat = Mat[k];
      if (!mat) continue;
      const o = k * 4, d = Dd[k], h0 = Hh[k];
      const kl = i > 0 && Mat[k - 1] ? Hh[k - 1] : h0, kr = i < RW - 1 && Mat[k + 1] ? Hh[k + 1] : h0;
      const ku = j > 0 && Mat[k - RW] ? Hh[k - RW] : h0, kd = j < RH - 1 && Mat[k + RW] ? Hh[k + RW] : h0;
      const hx = (kr - kl) * 0.5, hy = (kd - ku) * 0.5;
      const ddx = X0 + i - cx, rr = R - d, sn = ddx / rr, cs = ddy / rr;
      const th = Ua[k] / R, sf = sstep(0.1, 0.54, Math.abs(th - KEY_T)), side = 1 - (mat === 1 ? 0.3 : 0.45) * sf;
      let rel = -(hx * lx + hy * ly);
      let r = px[o], g = px[o + 1], b = px[o + 2];
      if (mat === 1) {
        rel *= 1.25; rel = rel < -0.6 ? -0.6 : rel > 0.5 ? 0.5 : rel;
        // the hide rolls over the rim: it faces the light more and more toward the limb, with a bright bead on the very edge
        const roll = Math.exp(-d / 9), bead = Math.exp(-((d - 2.2) * (d - 2.2)) / 7);
        const lit = (0.94 + rel + 0.16 * roll + 0.2 * bead - 0.1 * Math.exp(-((d - 17) * (d - 17)) / 60)) * side;
        r *= lit; g *= lit; b *= lit * (1 - 0.06 * roll);
      } else {
        rel *= 1.2; rel = rel < -0.55 ? -0.55 : rel > 0.55 ? 0.55 : rel;
        let hv = -hx * sn + hy * cs; hv = hv < -0.4 ? -0.4 : hv > 0.4 ? 0.4 : hv;
        E[k] = d - KS * hv;
        const q = Qe[k];
        const lit = (1.12 - 0.7 * sstep(170, 700, d)) * side * (1 - 0.66 * Math.exp(-q / 6) - 0.2 * Math.exp(-q / 36)) * (1 + rel);
        // deep lacquer never goes fully flat: a broad soft sheen sits under the moving highlight
        const sh = 24 * Math.exp(-((d - 242) * (d - 242)) / 16000) * side * (Gl[k] / 255);
        r = r * lit + sh; g = g * lit + sh * 0.45; b = b * lit + sh * 0.32;
        if (rel > 0.3) { const sp = (rel - 0.3) * 150 * side; r += sp; g += sp * 0.7; b += sp * 0.5; }
      }
      px[o] = r; px[o + 1] = g; px[o + 2] = b;
      const al = d + 0.5; px[o + 3] = al >= 1 ? 255 : al <= 0 ? 0 : al * 255;
    }
  }

  // ── the nails: shadows, then the domes ──
  const SHX = 0.36, SHY = 0.5;
  for (const nl of nails) eachPx(nl, 2.0, (k, ox, oy) => {
    if (!Mat[k]) return;
    const dist = Math.sqrt(ox * ox + oy * oy);
    if (dist < nl.rad - 1.5) return;
    const sx = ox - SHX * nl.rad, sy = oy - SHY * nl.rad, ds = Math.sqrt(sx * sx + sy * sy);
    const cast = 0.6 * (1 - sstep(nl.rad * 0.72, nl.rad * 1.32, ds)), ao = 0.5 * Math.exp(-Math.max(0, dist - nl.rad) / 4.5);
    const m = 1 - Math.min(0.86, cast + ao), o = k * 4;
    px[o] *= m; px[o + 1] *= m * 0.94; px[o + 2] *= m * 0.88;
  });
  const hl = Math.hypot(-0.5, -0.66, 1.56), Hx = -0.5 / hl, Hy = -0.66 / hl, Hz = 1.56 / hl;      // half-vector of the key light
  const ll = Math.hypot(-0.5, -0.66, 0.56), Lx = -0.5 / ll, Ly = -0.66 / ll, Lz = 0.56 / ll;
  for (const nl of nails) {
    const Rs = nl.rad * 1.19, bounce = nl.row ? 0.55 : 0.2, gAmt = 0.3 * nl.gilt;
    eachPx(nl, 1.1, (k, ox, oy) => {
      const dist = Math.sqrt(ox * ox + oy * oy), cov = nl.rad - dist + 0.5;
      if (cov <= 0 || !Mat[k]) return;
      const dent = 0.075;
      let nx = ox / Rs + dent * nB.n2(ox / 9 + nl.id * 5.3, oy / 9 + 2.1), ny = oy / Rs + dent * nB.n2(ox / 9 - 7.7, oy / 9 + nl.id * 3.9);
      nx += 0.03 * nC.n2(ox / 2.2 + nl.id * 11, oy / 2.2); ny += 0.03 * nC.n2(ox / 2.2, oy / 2.2 + nl.id * 13);
      const nz = Math.sqrt(Math.max(0.03, 1 - nx * nx - ny * ny));
      const ndh = nx * Hx + ny * Hy + nz * Hz, ndl = Math.max(0, nx * Lx + ny * Ly + nz * Lz);
      const s1 = sstep(0.972, 0.992, ndh) + 0.3 * sstep(0.986, 0.996, nx * 0.36 - ny * 0.16 + nz * 0.919), s2 = Math.pow(Math.max(0, ndh), 12);
      // gilding survives on the crown; dark tarnish creeps up from the skirt in soft clouds
      const gm = sstep(0, 0.5, (nz - 0.56) * 1.2 + 0.6 * nA.fbm(ox / 13 + nl.id * 9.1, oy / 13 - nl.id * 4.7, 2) + gAmt);
      const di = 0.3 + 1.05 * ndl, dg = 0.2 + 0.98 * ndl;
      let r = 54 * di + (214 * dg + 150 * s2 - 54 * di) * gm + 52 * s2 * (1 - gm);
      let g = 40 * di + (160 * dg + 118 * s2 - 40 * di) * gm + 40 * s2 * (1 - gm);
      let b = 28 * di + (62 * dg + 60 * s2 - 28 * di) * gm + 28 * s2 * (1 - gm);
      // the skirt of the dome mirrors the pale hide around it (lit side) and the red barrel below
      const skirt = sstep(0.76, 0.56, nz), lee = 0.5 - 0.5 * (nx * 0.58 + ny * 0.81) / Math.sqrt(1.001 - nz * nz);
      const up = skirt * (0.14 + 0.5 * lee) * (0.55 + 0.45 * gm);
      r += 214 * up; g += 190 * up; b += 146 * up;
      const dn = sstep(0.25, 0.8, ny) * bounce * (0.5 + 0.5 * gm);
      r += 150 * dn; g += 30 * dn; b += 18 * dn;
      const base = 1 - 0.55 * sstep(nl.rad - 4.5, nl.rad, dist);
      r = r * base + 255 * s1; g = g * base + 240 * s1; b = b * base + 208 * s1;
      const o = k * 4, c = cov >= 1 ? 1 : cov;
      px[o] += (r - px[o]) * c; px[o + 1] += (g - px[o + 1]) * c; px[o + 2] += (b - px[o + 2]) * c;
    });
  }

  const cnv = L.makeCanvas(RW, RH);
  cnv.getContext('2d').putImageData(img, 0, 0);
  const body = L.makeLayer(PAD, (g) => { g.drawImage(cnv, X0, Y0); });
  // macro lens: the barrel swells toward the camera at the bottom of frame and drops out of focus
  const soft = L.blurred(body, 3.2), sg = soft.getContext('2d');
  sg.globalCompositeOperation = 'destination-in';
  sg.fillStyle = L.radial(sg, cx + PAD, cy + PAD, R - 640, R - 400, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
  sg.fillRect(0, 0, soft.width, soft.height);
  body.getContext('2d').drawImage(soft, -PAD, -PAD);
  // halation: a quarter-res blurred copy, screened back over the picture in draw()
  const BW = Math.ceil((W + PAD * 2) / 4), BH = Math.ceil((H + PAD * 2) / 4);
  const bloom = L.makeCanvas(BW, BH), bg = bloom.getContext('2d');
  bg.filter = 'blur(5px)'; bg.drawImage(body, 0, 0, BW, BH);
  const sbloom = L.makeCanvas(Math.ceil(RW / 4), Math.ceil(RH / 4));
  // a little dust hanging in the dark, well clear of the caption
  const dust = L.makeCanvas(W, H), dg = dust.getContext('2d'), dr = L.rng('s16dust');
  for (let n = 0; n < 70; n++) {
    const x = dr.range(0, W), y = dr.range(0, 700), rad = dr.range(0.6, 2.4), al = dr.range(0.05, 0.3) * (dr.chance(0.12) ? 2 : 1);
    if (a.drAt(x, y) < 26 || (x > 560 && x < 1360 && y > a.crestY - 330)) continue;
    dg.fillStyle = L.radial(dg, x, y, 0, rad * 2.2, [[0, L.rgba(dr.pick(['#cfd8e6', '#f1e3c8', '#ffffff']), al)], [1, 'rgba(255,255,255,0)']]);
    dg.fillRect(x - 6, y - 6, 12, 12);
  }

  // per-frame highlight buffer + 1-D profiles
  const spec = new ImageData(RW, RH);
  for (let k = 3; k < spec.data.length; k += 4) spec.data[k] = 255;
  const specC = L.makeCanvas(RW, RH);
  const BL = new Float32Array(1024);   // band profile vs (E − E0), 0.5 px steps, centre at 512
  for (let n = 0; n < 1024; n++) {
    const e = (n - 512) * 0.5, ae = Math.abs(e);
    BL[n] = 0.48 * (1 - sstep(11, 27, ae)) + 0.14 * Math.exp(-(e * e) / 70) + 0.18 * Math.exp(-(e * e) / 4200) + 0.13 * Math.exp(-((e - 128) * (e - 128)) / 110) + 0.04 * Math.exp(-((e - 128) * (e - 128)) / 1800);
  }
  const LL = new Float32Array(1024);   // lateral falloff vs |U − Uc|, 2 px steps
  for (let n = 0; n < 1024; n++) { const t = (n * 2) / 900; LL[n] = Math.exp(-t * t) * 0.92 + 0.08; }
  return { body, bloom, sbloom, dust, E, Ua, Gl, Mg, spec, specC, sctx: specC.getContext('2d'), BL, LL, X0, Y0, RW, RH, N };
}

/** refresh the lacquer's specular band for this frame. E0 = depth of the band's centre, Uc = where it is brightest along the rim */
function renderSpec(E0, Uc) {
  const { E, Ua, Gl, Mg, spec, BL, LL, N } = S, d = spec.data;
  for (let k = 0; k < N; k++) {
    const g = Gl[k];
    if (!g) continue;
    let ei = ((E[k] - E0) * 2 + 512) | 0; ei = ei < 0 ? 0 : ei > 1023 ? 1023 : ei;
    let li = Ua[k] - Uc; li = (li < 0 ? -li : li) * 0.5 | 0; if (li > 1023) li = 1023;
    const v = BL[ei] * LL[li] * g, m = Mg[k] * (1 / 255), o = k * 4;
    d[o] = v * (1 + 0.5 * m); d[o + 1] = v * (0.8 + 0.22 * m); d[o + 2] = v * (0.66 - 0.3 * m);
  }
  S.sctx.putImageData(spec, 0, 0);
}

export default {
  name: '朱漆更鼓',
  tone: 'light',
  init(env) { S = buildDrum(env); globalThis.__s16S = S; },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.006, 0.006, p);
    ctx.fillStyle = '#040404'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(S.dust, L.lerp(-3, 3, p), L.lerp(2, -2, p));
    L.blit(ctx, env, S.body, { rot });
    // the light stays put while the drum turns under it → the band creeps down the barrel and along the rim
    if (!(globalThis.__s16 || {}).once || !S._done) { renderSpec(L.lerp(228, 246, p), L.lerp(-330, -250, p) - rot * a.R); S._done = 1; }
    const DBG = globalThis.__s16 || {};
    const sb = S.sbloom.getContext('2d');
    if (!DBG.noSb) { sb.globalCompositeOperation = 'copy'; sb.filter = 'blur(3px)'; sb.drawImage(S.specC, 0, 0, S.sbloom.width, S.sbloom.height); }
    L.cam(ctx, env, { rot }, () => {
      ctx.globalCompositeOperation = DBG.blend || 'lighter'; if (DBG.noRot) ctx.setTransform(1, 0, 0, 1, 0, 0); if (DBG.smooth === 0) ctx.imageSmoothingEnabled = false; if (!DBG.noSpec) ctx.drawImage(S.specC, S.X0, S.Y0);
      ctx.globalAlpha = 0.5; if (!DBG.noSb) ctx.drawImage(S.sbloom, S.X0, S.Y0, S.sbloom.width * 4, S.sbloom.height * 4);
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.3; if (!DBG.noBloom) ctx.drawImage(S.bloom, -PAD, -PAD, S.bloom.width * 4, S.bloom.height * 4);
    });
  },
};
