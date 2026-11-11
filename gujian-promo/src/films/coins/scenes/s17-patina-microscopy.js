// s17 — 锈色显微. The corrosion crust of a bronze coin under the microscope, pushed to pure pigment:
//   below the arc  → malachite (石绿): a bright, flat field of tiny grains and botryoidal knobs, flecked with yellow-green chips
//   on the arc     → a hair-thin seam of cuprite vermilion (朱) between the two crusts, slightly ragged
//   above the arc  → azurite (石青): deep blue blades slanting down to the right like the barbs of a feather, cuprite red and
//                    purple-black showing in the slits; the blades fuse into one calm blue face above the crest (tagline zone)
// Both crusts are shaded per pixel once in init() (worley grains / procedural blades), then slid against each other along the arc.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 64;          // the two layers only slide ~±11 px along the arc
let S = null;

const sstep = (a, b, v) => { let t = (v - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** integer lattice hash → [0,1) */
const hsh = (i, j) => { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

// ── allocation-free worley noise: squared distances in cD1/cD2, cell id in cId, vector pixel→feature in cDx/cDy ──
let cD1 = 0, cD2 = 0, cId = 0, cDx = 0, cDy = 0;
function cell(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let d1 = 9, d2 = 9, id = 0, bx = 0, by = 0;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const cx = xi + ox, cy = yi + oy;
    let h = (Math.imul(cx, 374761393) + Math.imul(cy, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    const dx = cx + (h & 1023) / 1023 - x, dy = cy + ((h >>> 10) & 1023) / 1023 - y, d = dx * dx + dy * dy;
    if (d < d1) { d2 = d1; d1 = d; id = ((h >>> 20) & 4095) / 4095; bx = dx; by = dy; } else if (d < d2) d2 = d;
  }
  cD1 = d1; cD2 = d2; cId = id; cDx = bx; cDy = by;
}

// slow fields on a coarse grid, bilinear-sampled per pixel
function coarse(X0, Y0, w, h, CS, fn) {
  const cw = Math.ceil(w / CS) + 2, ch = Math.ceil(h / CS) + 2, a = new Float32Array(cw * ch);
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) a[j * cw + i] = fn(X0 + i * CS, Y0 + j * CS);
  return { a, cw, CS };
}
function bil(f, i, j) {
  const fx = i / f.CS, fy = j / f.CS, i0 = fx | 0, j0 = fy | 0, tx = fx - i0, ty = fy - j0, k = j0 * f.cw + i0, a = f.a;
  const a0 = a[k], a1 = a[k + 1], b0 = a[k + f.cw], b1 = a[k + f.cw + 1];
  return (a0 + (a1 - a0) * tx) * (1 - ty) + (b0 + (b1 - b0) * tx) * ty;
}
function rampLut(stops, n = 256) {
  const f = L.makeRamp(stops), out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const c = f(i / (n - 1)); out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2]; }
  return out;
}

/** how strongly the feather structure shows at a frame point: 0 in the calm window above the crest → 1 toward the sides */
function featherMask(a, x, y, wob) {
  const ex = (x - a.cx) / 470, ey = (y - (a.crestY - 150)) / 380;
  return sstep(0.8, 1.5, Math.sqrt(ex * ex + ey * ey) + 0.22 * wob);
}

// ───────────────────────── azurite (above the arc) ─────────────────────────
function buildUpper(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const X0 = -PAD, Y0 = -PAD;
  const RW = W + PAD * 2, RH = Math.ceil(a.yAt(-PAD)) + 36 - Y0;
  const nA = L.makeNoise('s17u1'), nB = L.makeNoise('s17u2');
  const CS = 8;
  const fWarp = coarse(X0, Y0, RW, RH, CS, (x, y) => nA.fbm(x / 620, y / 620, 3));
  const fQ = coarse(X0, Y0, RW, RH, CS, (x, y) => nB.fbm(x / 310 + 9, y / 310, 3));
  const fGap = coarse(X0, Y0, RW, RH, CS, (x, y) => nA.fbm(x / 230 - 40, y / 230 + 17, 3));
  const fHue = coarse(X0, Y0, RW, RH, CS, (x, y) => nB.fbm(x / 540, y / 540 + 90, 3));

  // the "feather": long shafts (羽轴) running slightly up to the right, barbs (羽枝) between them slanting down to the right.
  // each band between two shafts gets its own barb angle / pitch / curl so neighbouring bands never line up.
  const SP = 196, B0 = -8, NB = 20;
  const bSin = new Float32Array(NB), bCos = new Float32Array(NB), bP = new Float32Array(NB), bOff = new Float32Array(NB), bCurve = new Float32Array(NB);
  for (let b = 0; b < NB; b++) {
    const bi = b + B0, h1 = hsh(bi, 17), h2 = hsh(bi, 91), h3 = hsh(bi, 233);
    const phi = ((bi & 1) ? 0.95 : 0.6) + (h1 - 0.5) * 0.16;
    bSin[b] = Math.sin(phi); bCos[b] = Math.cos(phi);
    bP[b] = 33 + 18 * h2; bOff[b] = h3 * 11; bCurve[b] = ((bi & 1) ? 1 : -1) * (0.9 + 1.2 * h1);
  }
  // across one blade (0 = its lit upper-right edge … 1 = its shadowed lower-left edge)
  const BL = rampLut([[0, '#102a68'], [0.03, '#8fbcff'], [0.09, '#3f80ec'], [0.28, '#2459c8'], [0.6, '#1f4fb0'], [0.88, '#173d93'], [1, '#0f2764']]);

  const img = new ImageData(RW, RH), d = img.data;
  const rIn2 = (R - 30) * (R - 30);
  for (let j = 0; j < RH; j++) {
    const y = Y0 + j, ddy = cy - y;
    for (let i = 0; i < RW; i++) {
      const x = X0 + i, ddx = x - cx;
      if (ddx * ddx + ddy * ddy < rIn2) continue;      // hidden under the malachite
      const wv = bil(fWarp, i, j);
      const m = featherMask(a, x, y, wv);
      let w = (y - 0.11 * (x - 960) + 36 * wv) / SP + 0.37;
      w += 0.17 * Math.sin(w * 2.1 + 1);               // uneven band heights
      const bi = Math.floor(w), t = w - bi, b = bi - B0;
      const tc = t - 0.5, pin = 4 * t * (1 - t), P = bP[b];
      const along = x * bCos[b] + y * bSin[b];
      const q = (-x * bSin[b] + y * bCos[b]) / P + bCurve[b] * tc * tc + 0.34 * bil(fQ, i, j) + bOff[b];
      const si = Math.floor(q), f = q - si;
      const hs = hsh(si, bi * 57 + 3), hs2 = hsh(si, bi * 131 + 71), hs3 = hsh(si, bi * 211 + 19);
      const f2 = f + 0.04 * nB.n2(along / 24, si * 3.17 + bi * 9.1);        // crystal edges are never ruler-straight
      let gw = 0.1 + 0.5 * hs * hs + 0.3 * bil(fGap, i, j);
      gw = (gw < 0.03 ? 0.03 : gw > 0.6 ? 0.6 : gw) * (0.18 + 0.82 * Math.sqrt(pin)) * m;   // slit width: lens-shaped, pinched at the shafts
      // blade body
      const fb = clamp01(f2 / (1 - gw));
      const segLen = P * (1.6 + 2.6 * hs2);
      const sl = along / segLen + hs * 13, ai = Math.floor(sl), af = sl - ai;
      const hseg = hsh(ai, si * 31 + bi * 7);
      const stri = nA.n2(along / 90 + hs * 5, q * 4.6), stri2 = nB.n2(along / 46 - hs * 3, q * 13.5);
      let lum = (0.84 + 0.34 * hseg) * (1 + 0.17 * stri + 0.14 * stri2);
      if (hseg > 0.87) lum *= 1.24;                                           // the odd facet turned square to the light
      if (hseg > 0.55 && m > 0.15) lum *= 1 - 0.45 * sstep(0.15, 0.5, m) * (1 - sstep(0, 2.2 / segLen, af));   // cleavage crack across the blade
      const li = ((fb * 255) | 0) * 3;
      const k = 0.07 + 0.93 * m;                                              // blades fuse into one face above the crest
      const ul = 1 + 0.05 * stri;
      let cr = 31 * ul, cg = 79 * ul, cb = 176 * ul;
      cr += (BL[li] * lum - cr) * k; cg += (BL[li + 1] * lum - cg) * k; cb += (BL[li + 2] * lum - cb) * k;
      // the slit between two blades: cuprite red, purple-black in the shadow of the blade above it
      const aa = 1.3 / P;
      if (gw > 0.004) {
        let bg = sstep(1 - gw - aa, 1 - gw, f2) * (1 - sstep(1 - aa, 1, f2));
        if (gw < aa * 1.3) bg *= gw / (aa * 1.3);
        if (bg > 0.004) {
          const gg = clamp01((f2 - (1 - gw)) / gw);
          cell(x / 5.2, y / 5.2);
          const gv = (0.84 + 0.3 * cId + 0.4 * (-cDx * 0.5 + cDy * 0.8)) * (0.66 + 0.34 * sstep(0, 0.14, cD2 - cD1));
          let gr, gG, gb;
          if (cId > 0.9) { gr = 255; gG = 112; gb = 58; } else { gr = 229 * gv; gG = 54 * gv; gb = 30 * gv; }
          if (hs3 < 0.23) {           // some slits stay almost entirely purple-black, with a few red embers
            const e = cId > 0.8 ? 0.7 : 0.12 * sstep(0.45, 1, gg);
            gr = 42 + (gr - 42) * e; gG = 18 + (gG - 18) * e; gb = 56 + (gb - 56) * e;
          } else {
            const sh = 0.9 * (1 - sstep(0.02, 0.42, gg));
            gr += (42 - gr) * sh; gG += (18 - gG) * sh; gb += (56 - gb) * sh;
          }
          cr += (gr - cr) * bg; cg += (gG - cg) * bg; cb += (gb - cb) * bg;
        }
      }
      // the shaft: a hairline of light with a cuprite / purple-black seam hugging its underside
      const sd = (t < 0.5 ? t : t - 1) * SP;          // px from the nearest shaft line, < 0 above it
      if (sd > -5 && sd < 9.5) {
        const sn = nB.n2(x / 38, bi * 5.3), tex = 1 + 0.14 * sn;
        const sw = sd / (0.75 + 0.5 * (0.5 + 0.5 * nA.n2(x / 85, bi * 3.1 - 4)));      // the seam swells and thins along its length
        const rk = sstep(-3.8, -2.6, sd) * (1 - sstep(-0.7, 0.5, sd)) * k * 0.8;
        if (rk > 0) { cr += (138 * tex - cr) * rk; cg += (188 * tex - cg) * rk; cb += (255 - cb) * rk; }
        const uk = sstep(-0.7, 0.5, sd) * (1 - sstep(3.4, 5.4, sw)) * m;
        if (uk > 0) {
          const red = sstep(-0.3, 0.0, nA.n2(x / 130, bi * 7.7 + 2));
          const ur = 42 + (229 - 42) * red, ug = 18 + (54 - 18) * red, ub = 56 + (30 - 56) * red;
          cr += (ur * tex - cr) * uk; cg += (ug * tex - cg) * uk; cb += (ub * tex - cb) * uk;
        }
      }
      // slow hue drift (ultramarine ↔ cobalt), illumination falloff, pigment grain
      const hv = bil(fHue, i, j);
      const dx0 = x - 960, dy0 = y - 300;
      const lf = (1.05 - 0.13 * sstep(420, 1250, Math.sqrt(dx0 * dx0 + dy0 * dy0))) * (0.97 + 0.06 * hsh(x, y)) * (0.9 + 0.1 * m);
      const o = (j * RW + i) * 4;
      d[o] = cr * (1 + 0.25 * hv) * lf; d[o + 1] = cg * (1 - 0.12 * hv) * lf; d[o + 2] = cb * lf; d[o + 3] = 255;
    }
  }
  const cnv = L.makeCanvas(RW, RH), g = cnv.getContext('2d');
  g.putImageData(img, 0, 0);
  g.translate(-X0, -Y0);

  // loose crumbs of malachite caught on the blades (kept out of the calm window).
  // No red ones: cuprite belongs to the ground layer and only ever shows through the slits from below.
  const rs = L.rng('s17crumbs');
  for (let n = 0; n < 120; n++) {
    const x = rs.range(-PAD, W + PAD), y = rs.range(-PAD, a.yAt(x) - 16);
    const m = featherMask(a, x, y, 0), pick = rs(), rad = 1.6 + 6.5 * Math.pow(rs(), 2.6), ph = rs() * 6;
    if (m < 0.5 || rs() > m) continue;
    const col = pick < 0.55 ? ['#f1ff9a', '#c8e04a', '#8aa624'] : ['#b4f7dc', '#2fbf8a', '#157a5c'];
    const poly = (ox, oy, sc) => {
      g.beginPath();
      for (let v = 0; v < 6; v++) { const an = (v / 6) * L.TAU + ph, rr = rad * sc * (0.7 + 0.5 * hsh(n, v)); const px = x + ox + Math.cos(an) * rr, py = y + oy + Math.sin(an) * rr; if (v) g.lineTo(px, py); else g.moveTo(px, py); }
      g.closePath(); g.fill();
    };
    g.fillStyle = 'rgba(30,10,44,0.6)'; poly(-rad * 0.3, rad * 0.35, 1.08);
    g.fillStyle = L.linear(g, x + rad, y - rad, x - rad, y + rad, [[0, col[0]], [0.4, col[1]], [0.62, col[1]], [1, col[2]]]); poly(0, 0, 1);
  }

  // crystal glints for the per-frame twinkle
  const rg = L.rng('s17glintU'), glints = [];
  for (let n = 0; n < 900 && glints.length < 170; n++) {
    const x = rg.range(-PAD, W + PAD), y = rg.range(-PAD, a.yAt(x) - 22);
    const m = featherMask(a, x, y, 0), u = rg(), sz = rg.range(2.5, 7.5);
    if (m < 0.42 || u > m) continue;
    glints.push({ x, y, r: sz, col: rg.pick(['#ffffff', '#bcd8ff', '#8fbcff']) });
  }
  return { cnv, X0, Y0, glints };
}

// ───────────────────────── malachite (below the arc) + the cuprite seam ─────────────────────────
function buildLower(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const X0 = -PAD, Y0 = Math.floor(a.crestY) - 26;
  const RW = W + PAD * 2, RH = H + PAD - Y0;
  const nA = L.makeNoise('s17l1'), nB = L.makeNoise('s17l2');
  const CS = 8;
  const fTone = coarse(X0, Y0, RW, RH, CS, (x, y) => nA.fbm(x / 430, y / 430, 3));
  const fYel = coarse(X0, Y0, RW, RH, CS, (x, y) => nA.fbm(x / 150 + 30, y / 150 - 12, 3));
  const fBot = coarse(X0, Y0, RW, RH, CS, (x, y) => nB.fbm(x / 250 - 7, y / 250 + 44, 3));
  const fWx = coarse(X0, Y0, RW, RH, CS, (x, y) => nB.n2(x / 70 + 5, y / 70));
  const fWy = coarse(X0, Y0, RW, RH, CS, (x, y) => nB.n2(x / 70 - 31, y / 70 + 19));
  const GS = 8.5, BS = 34, KS = 25;       // grain / botryoidal knob / chip sizes (px)
  const img = new ImageData(RW, RH), d = img.data;
  const rOut2 = (R + 26) * (R + 26);
  const vy0 = a.crestY + 60;
  for (let j = 0; j < RH; j++) {
    const y = Y0 + j, ddy = cy - y;
    for (let i = 0; i < RW; i++) {
      const x = X0 + i, ddx = x - cx, rr2 = ddx * ddx + ddy * ddy;
      if (rr2 > rOut2) continue;
      const dr = Math.sqrt(rr2) - R;
      const wx = bil(fWx, i, j), wy = bil(fWy, i, j);
      cell(x / GS + wx * 0.3, y / GS + wy * 0.3);
      const gd1 = cD1, ged = cD2 - cD1, gid = cId, gdx = cDx, gdy = cDy;
      // the boundary: ragged at two scales and following the grains, so the edge is a fringe of whole granules
      let u = -100, wl = 0, s = 0;
      if (dr > -34) {
        s = Math.atan2(ddx, ddy) * R;
        let e = 2.4 * nA.n2(s / 33, 3.7) + 1.3 * nA.n2(s / 8.5, 11.3) + 2.0 * (0.5 - Math.min(1, gd1 * 2.6));
        e = e < -4.6 ? -4.6 : e > 4.6 ? 4.6 : e;
        wl = 3.4 + 1.7 * nB.n2(s / 64, 5.1);          // width of the vermilion seam
        u = dr - (e - wl * 0.5);
        if (u > wl + 12) continue;
      }
      let cr = 0, cg = 0, cb = 0, al = 255;
      if (u < 0.7) {
        const tn = bil(fTone, i, j), ym = bil(fYel, i, j), ymp = ym > 0 ? ym : 0;
        const tm = clamp01(0.5 + tn * 1.3);                 // slow drift green ↔ teal
        const j1 = (gid * 7.31) % 1;
        // every granule is a tiny round bead of one clean pigment colour …
        if (gid < 0.045 + 0.3 * ymp) { const kk = 0.92 + 0.2 * j1; cr = 200 * kk; cg = 224 * kk; cb = 74 * kk; }       // 明黄绿
        else if (gid > 0.955) { cr = 18; cg = 150; cb = 108; }
        else if (gid > 0.86) { cr = 136; cg = 240; cb = 196; }
        else { const kk = 0.96 + 0.2 * j1; cr = (58 - 38 * tm) * kk; cg = (204 + 4 * tm) * kk; cb = (132 + 54 * tm) * kk; }   // 石绿
        const grad = 0.43 + 0.2 * ((gid * 5.7) % 1), gr = Math.sqrt(gd1);
        const gin = (1 - sstep(grad - 0.13, grad, gr)) * (0.55 + 0.45 * sstep(0, 0.07, ged));
        const gnx = -gdx / grad, gny = -gdy / grad;
        const gsh = 0.95 + 0.33 * (gnx * 0.5 - gny * 0.75);
        const hx = gnx - 0.3, hy = gny + 0.45, gsp = 46 * Math.exp(-(hx * hx + hy * hy) / 0.09);
        cr = cr * gsh + gsp * 0.9; cg = cg * gsh + gsp; cb = cb * gsh + gsp * 0.85;
        // … bedded in a darker green matrix; close to the seam the red ground shows through instead
        const rk = dr > -17 ? sstep(-17, -2, dr) * 0.85 : 0;
        const mr = 22 - 8 * tm + (204 - 18) * rk, mg = 160 + (42 - 160) * rk, mb = 112 + 34 * tm + (24 - 128) * rk;
        cr = mr + (cr - mr) * gin; cg = mg + (cg - mg) * gin; cb = mb + (cb - mb) * gin;
        // botryoidal knobs (葡萄状): glossy little domes crowding each other in patches
        const bm = sstep(0.04, 0.36, bil(fBot, i, j));
        if (bm > 0.01) {
          cell(x / BS + wx * 0.35, y / BS + wy * 0.35);
          if (cId < bm * 1.15) {
            const kr = 0.36 + 0.14 * ((cId * 31.7) % 1), kd = Math.sqrt(cD1), r = kd / kr;
            if (r < 1) {
              const nz = Math.sqrt(1 - r * r), nx = -cDx / kr, ny = -cDy / kr;
              const dif = nx * 0.42 - ny * 0.6 + nz * 0.68;          // lit from the upper right
              const crease = sstep(0, 0.08, cD2 - cD1);
              const sx = nx - 0.32, sy = ny + 0.44, spec = Math.exp(-(sx * sx + sy * sy) / 0.035);
              const ring = 0.5 + 0.5 * Math.sin(r * r * 8 + cId * 50);     // malachite's concentric banding
              const sh = (0.56 + 0.66 * (dif > 0 ? dif : 0)) * (0.66 + 0.34 * crease) * (0.93 + 0.12 * ring);
              const kR = (50 - 30 * tm) * sh + 170 * spec, kG = 212 * sh + 190 * spec, kB = (136 + 50 * tm) * sh + 170 * spec;
              const kin = 1 - sstep(0.93, 1, r);
              cr += (kR - cr) * kin; cg += (kG - cg) * kin; cb += (kB - cb) * kin;
            } else if (r < 1.3) {
              const sdw = (cDx * 0.55 - cDy * 0.83) / kd;              // contact shadow on the side away from the light
              if (sdw > 0) { const o2 = 1 - 0.34 * sdw * (1 - (r - 1) / 0.3); cr *= o2; cg *= o2; cb *= o2; }
            }
          }
        }
        // angular yellow-green chips lying on the surface
        cell(x / KS + 7.7, y / KS + 3.1);
        if (cId < 0.03 + 0.1 * ymp) {
          const ke = cD2 - cD1, kin = sstep(0.1, 0.15, ke);
          if (kin > 0) {
            const fc = (0.9 + 0.22 * ((cId * 977) % 1)) * (1 + 0.35 * (-cDx * 0.5 + cDy * 0.8)) * (0.9 + 0.2 * j1);
            const rim = 1 + 0.25 * (1 - sstep(0.15, 0.22, ke));
            cr += (200 * fc * rim - cr) * kin; cg += (224 * fc * rim - cg) * kin; cb += (74 * fc - cb) * kin;
          } else if (ke > 0.04) { cr *= 0.72; cg *= 0.74; cb *= 0.8; }
        }
        const dxv = x - 960, dyv = y - vy0;
        const fin = (1 + 0.1 * sstep(-12, -2, dr)) * (1.04 - 0.15 * sstep(350, 1300, Math.sqrt(dxv * dxv + dyv * dyv))) * (0.965 + 0.07 * hsh(x, y));
        cr *= fin; cg *= fin; cb *= fin;
      }
      if (u > -0.7) {
        // vermilion seam, then a short purple-black contact shadow fading out over the azurite
        const vn = 0.9 + 0.22 * nB.n2(s / 4.5, dr / 2.6) + 0.14 * sstep(wl * 0.4, wl, u);
        const tv = sstep(-0.7, 0.7, u);
        cr += (229 * vn - cr) * tv; cg += (54 * vn - cg) * tv; cb += (30 * vn - cb) * tv;
        if (u > wl - 0.7) {
          const ts = sstep(wl - 0.7, wl + 0.7, u), f = clamp01(1 - (u - wl) / 12);
          cr += (36 - cr) * ts; cg += (14 - cg) * ts; cb += (52 - cb) * ts;
          al = 255 + (255 * 0.66 * f * f - 255) * ts;
        }
      }
      const o = (j * RW + i) * 4;
      d[o] = cr; d[o + 1] = cg; d[o + 2] = cb; d[o + 3] = al;
    }
  }
  const cnv = L.makeCanvas(RW, RH);
  cnv.getContext('2d').putImageData(img, 0, 0);

  // sparkle sites on the granules
  const rg = L.rng('s17glintL'), glints = [];
  const span = a.span(PAD);
  for (let n = 0; n < 760; n++) {
    const th = rg.range(-span, span), dr = -5 - Math.pow(rg(), 1.25) * 640, pt = a.pt(th, dr);
    glints.push({ x: pt.x, y: pt.y, r: rg.range(1.3, 3.0), big: rg.chance(0.12), col: rg.pick(['#ffffff', '#f4ffc0', '#d9ff7a', '#c9fff0', '#ffffff']) });
  }
  return { cnv, X0, Y0, glints };
}

function star(ctx, x, y, r) {
  ctx.beginPath(); ctx.moveTo(x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.fill();
}

export default {
  name: '锈色显微',
  tone: 'light',
  init(env) {
    S = { up: buildUpper(env), lo: buildLower(env), grain: L.grainTex(512, 512, { seed: 's17shimmer', amount: 0.55 }) };
  },
  draw(ctx, env, p) {
    const a = env.arc, fr = env.frame | 0;
    // the two crusts creep in opposite directions along their boundary
    const rotU = L.lerp(0.0036, -0.0036, p), rotL = L.lerp(-0.0046, 0.0046, p);
    ctx.fillStyle = '#1f4fb0'; ctx.fillRect(0, 0, W, H);

    L.cam(ctx, env, { rot: rotU }, () => {
      ctx.drawImage(S.up.cnv, S.up.X0, S.up.Y0);
      // blade edges flash for a single frame each
      ctx.globalCompositeOperation = 'screen';
      const gl = S.up.glints;
      for (let i = 0; i < gl.length; i++) {
        const tw = hsh(i, fr * 7 + 1);
        if (tw > 0.3) continue;
        const q = gl[i], k = 1 - tw / 0.3;
        ctx.globalAlpha = 0.35 + 0.6 * k; ctx.fillStyle = q.col;
        star(ctx, q.x, q.y, q.r * (0.7 + 0.6 * k));
      }
    });

    L.cam(ctx, env, { rot: rotL }, () => {
      ctx.drawImage(S.lo.cnv, S.lo.X0, S.lo.Y0);
      // granules catch the light frame by frame
      ctx.globalCompositeOperation = 'screen';
      const gl = S.lo.glints;
      for (let i = 0; i < gl.length; i++) {
        const tw = hsh(i, fr * 13 + 5);
        if (tw > 0.34) continue;
        const q = gl[i], k = 1 - tw / 0.34;
        ctx.globalAlpha = 0.45 + 0.55 * k; ctx.fillStyle = q.col;
        if (q.big) star(ctx, q.x, q.y, 5 + 5 * k);
        else { ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, L.TAU); ctx.fill(); }
      }
    });

    // live pigment grain on the malachite (a different offset every frame)
    ctx.save();
    a.clipBelow(ctx, -3);
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.2;
    const ox = Math.floor(hsh(fr, 11) * 512), oy = Math.floor(hsh(fr, 29) * 512);
    ctx.translate(-ox, -oy);
    ctx.fillStyle = ctx.createPattern(S.grain, 'repeat');
    ctx.fillRect(ox, oy + a.crestY - 8, W, H - a.crestY + 8);
    ctx.restore();
  },
};
