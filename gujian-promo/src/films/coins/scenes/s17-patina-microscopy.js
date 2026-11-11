// s17 — 锈色显微. The corrosion crust of a bronze coin under the stereo microscope, pushed to pure pigment:
//   below the arc  → malachite (石绿): a bright, flat crust of granules and botryoidal knobs, mottled with yellow-green
//   on the arc     → a hair-thin seam of cuprite vermilion (朱) between the two crusts, slightly ragged
//   above the arc  → azurite (石青): big deep-blue blades slanting down to the right like the barbs of a feather, cuprite red and
//                    purple-black showing in the slits; the blades fuse into one calm blue face above the crest (tagline zone)
// Both crusts are built once in init() as a height field + pigment colour per pixel, lit by one raking light from the upper
// right, then given a shallow depth of field (focus on the crest of the arc). draw() only slides the two layers against each
// other along the arc and lets a few out-of-focus sparkles come and go.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 48;          // the two layers only slide ~±14 px along the arc; the rest is room for the blur
let S = null;

const sstep = (a, b, v) => { let t = (v - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** integer lattice hash → [0,1) */
const hsh = (i, j) => { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

// the one light of the shot: low, from the upper right (unit vector surface → light), and its half-vector with the viewer
const LX = 0.52, LY = -0.62, LZ = 0.59;
const HN = Math.hypot(LX, LY, LZ + 1), HX = LX / HN, HY = LY / HN, HZ = (LZ + 1) / HN;

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

// ── a crust of rounded lumps: the union of paraboloid caps of random radius, one per lattice cell ──
// lV = cap value of the winning lump (1 at its top, 0 at its rim, < 0 outside every lump; -9 if there is none),
// lV2 = runner-up (lV - lV2 small → the crease between two lumps), lId / lR / lDx,lDy = id, radius, vector pixel→centre.
// pres < 1 thins the lumps out (only cells with a low id survive, and they shrink before they vanish).
let lV = 0, lV2 = 0, lId = 0, lR = 1, lDx = 0, lDy = 0;
function lumps(x, y, rMin, rVar, pres) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let b1 = -9, b2 = -9, id = 0, bx = 0, by = 0, br = 1;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const cx = xi + ox, cy = yi + oy;
    let h = (Math.imul(cx, 374761393) + Math.imul(cy, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    const cid = ((h >>> 20) & 4095) * 0.0002442;
    let r = rMin + rVar * ((h >>> 6) & 255) * 0.003922;
    if (pres < 1) { let amp = (pres * 1.3 - cid) * 3.3333; if (amp <= 0) continue; if (amp > 1) amp = 1; r *= 0.55 + 0.45 * amp; }
    const dx = cx + (h & 1023) * 0.0009775 - x, dy = cy + ((h >>> 10) & 1023) * 0.0009775 - y;
    const v = 1 - (dx * dx + dy * dy) / (r * r);
    if (v > b1) { b2 = b1; b1 = v; id = cid; bx = dx; by = dy; br = r; } else if (v > b2) b2 = v;
  }
  lV = b1; lV2 = b2; lId = id; lR = br; lDx = bx; lDy = by;
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

/**
 * Light a pigment-colour image in place from its height field.
 * hB = height (px), sB = occlusion / cast shadow / falloff multiplier, gB = gloss (0..1).
 * Shadows sink toward the ambient colour (never dead black); highlights push the pigment up and let the clipped channel
 * spill into the others, so a lit blue goes azure-white and a lit green goes mint instead of grey.
 */
function relight(d, hB, sB, gB, RW, RH, o) {
  const { kd, amb, spec, pw } = o;
  for (let j = 1; j < RH - 1; j++) {
    for (let i = 1; i < RW - 1; i++) {
      const p = j * RW + i, q = p * 4;
      if (d[q + 3] === 0) continue;
      const hx = (hB[p + 1] - hB[p - 1]) * 0.5, hy = (hB[p + RW] - hB[p - RW]) * 0.5;
      const inv = 1 / Math.sqrt(1 + hx * hx + hy * hy);
      let lum = 1 + kd * ((-hx * LX - hy * LY + LZ) * inv / LZ - 1);
      if (lum < 0) lum = 0;
      lum *= sB[p];
      let r = d[q], g = d[q + 1], b = d[q + 2];
      if (lum <= 1) {
        const k = 1 - lum;
        r = r * lum + amb[0] * k; g = g * lum + amb[1] * k; b = b * lum + amb[2] * k;
      } else {
        r *= lum; g *= lum; b *= lum;
        let ov = 0;
        if (r > 255) { ov += r - 255; r = 255; }
        if (g > 255) { ov += g - 255; g = 255; }
        if (b > 255) { ov += b - 255; b = 255; }
        if (ov > 0) { ov *= 0.45; r += ov; g += ov; b += ov; }
      }
      const gl = gB[p];
      if (gl > 0.01) {
        const nh = (-hx * HX - hy * HY + HZ) * inv;
        if (nh > 0.93) { const s = Math.pow(nh, pw) * gl * sB[p]; r += spec[0] * s; g += spec[1] * s; b += spec[2] * s; }
      }
      const gr = 0.972 + 0.056 * hsh(i, j);          // pigment tooth
      d[q] = r * gr; d[q + 1] = g * gr; d[q + 2] = b * gr;
    }
  }
}

// focus sits on the crest of the arc; this is how far (in "focus radii") a frame point is from it
const FOC = { rx: 700, ry: 330, dy: 24 };
const focusDist = (a, x, y) => Math.hypot((x - a.cx) / FOC.rx, (y - (a.crestY + FOC.dy)) / FOC.ry);

/** shallow depth of field: progressively blurred copies are laid over the sharp layer away from the focus; the arc edge itself stays crisp */
function depthOfField(env, src, X0, Y0) {
  const a = env.arc, w = src.width, h = src.height, hw = Math.ceil(w / 2), hh = Math.ceil(h / 2);
  const out = L.makeCanvas(w, h), g = out.getContext('2d');
  g.drawImage(src, 0, 0);
  // the blurs are done at half size (nobody can tell, and it is four times cheaper)
  const half = L.makeCanvas(hw, hh);
  half.getContext('2d').drawImage(src, 0, 0, w / 2, h / 2);
  // a soft ribbon along the arc that the blur is kept out of: the shared edge must stay exact
  const rib = L.makeCanvas(hw, hh), rgx = rib.getContext('2d');
  rgx.scale(0.5, 0.5); rgx.translate(-X0, -Y0); rgx.filter = 'blur(5px)'; rgx.strokeStyle = '#000'; rgx.lineWidth = 40; a.stroke(rgx, 0); rgx.filter = 'none';
  const tmp = L.makeCanvas(hw, hh), tg = tmp.getContext('2d');
  for (const [px, e0, e1] of [[0, 0.9, 1.3], [2.1, 1.25, 1.75], [4.4, 1.7, 2.5]]) {
    const bl = px ? L.blurred(half, px) : half;
    tg.setTransform(1, 0, 0, 1, 0, 0);
    tg.globalCompositeOperation = 'copy';
    tg.drawImage(bl, 0, 0);
    tg.globalCompositeOperation = 'destination-in';
    tg.setTransform(FOC.rx / 2, 0, 0, FOC.ry / 2, (a.cx - X0) / 2, (a.crestY + FOC.dy - Y0) / 2);
    const grd = tg.createRadialGradient(0, 0, e0, 0, 0, e1);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.5, 'rgba(0,0,0,0.5)'); grd.addColorStop(1, 'rgba(0,0,0,1)');
    tg.fillStyle = grd; tg.fillRect(-9, -9, 18, 18);
    tg.setTransform(1, 0, 0, 1, 0, 0);
    tg.globalCompositeOperation = 'destination-out';
    tg.drawImage(rib, 0, 0);
    g.drawImage(tmp, 0, 0, hw * 2, hh * 2);
  }
  return out;
}

// a 256² tile of fine noise, sampled per pixel for the micro surface (cheaper than simplex in the inner loops)
function microTile(seed, sc) {
  const n = L.makeNoise(seed), t = new Float32Array(65536);
  for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) t[(j << 8) | i] = n.n2(i / sc, j / sc);
  return t;
}

/** how strongly the feather structure shows at a frame point: 0 in the calm window above the crest → 1 toward the sides */
function featherMask(a, x, y, wob) {
  const ex = (x - a.cx) / 480, ey = (y - (a.crestY - 150)) / 350;
  return sstep(0.8, 1.5, Math.sqrt(ex * ex + ey * ey) + 0.22 * wob);
}

// ───────────────────────── azurite (above the arc) ─────────────────────────
function buildUpper(env) {
  const T0 = performance.now();
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const X0 = -PAD, Y0 = -PAD;
  const RW = W + PAD * 2, RH = Math.ceil(a.yAt(-PAD)) + 36 - Y0;
  const nA = L.makeNoise('s17u1'), nB = L.makeNoise('s17u2');
  const CS = 8;
  const fWarp = coarse(X0, Y0, RW, RH, CS, (x, y) => nA.fbm(x / 620, y / 620, 3));
  const fQ = coarse(X0, Y0, RW, RH, CS, (x, y) => nB.fbm(x / 310 + 9, y / 310, 3));
  const fGap = coarse(X0, Y0, RW, RH, CS, (x, y) => nA.fbm(x / 260 - 40, y / 260 + 17, 3));
  const fHue = coarse(X0, Y0, RW, RH, CS, (x, y) => nB.fbm(x / 540, y / 540 + 90, 3));
  const MT = microTile('s17micro', 2.9);
  const SR = new Float32Array(1025), rs0 = L.rng('s17stri');
  for (let n = 0; n < 1024; n++) SR[n] = rs0() * 2 - 1;
  SR[1024] = SR[0];

  // the "feather": long shafts (羽轴) running slightly up to the right, big blades (羽枝) between them slanting down to the right.
  // each band between two shafts gets its own blade angle / pitch / curl so neighbouring bands never line up.
  const SP = 214, B0 = -8, NB = 22;
  const bSin = new Float32Array(NB), bCos = new Float32Array(NB), bP = new Float32Array(NB), bOff = new Float32Array(NB), bCurve = new Float32Array(NB);
  for (let b = 0; b < NB; b++) {
    const bi = b + B0, h1 = hsh(bi, 17), h2 = hsh(bi, 91), h3 = hsh(bi, 233);
    const phi = ((bi & 1) ? 0.98 : 0.62) + (h1 - 0.5) * 0.2;
    bSin[b] = Math.sin(phi); bCos[b] = Math.cos(phi);
    bP[b] = 84 + 44 * h2; bOff[b] = h3 * 11; bCurve[b] = ((bi & 1) ? 1 : -1) * (0.35 + 0.5 * h1);
  }

  const img = new ImageData(RW, RH), d = img.data, NPX = RW * RH;
  const hB = new Float32Array(NPX), sB = new Float32Array(NPX), gB = new Float32Array(NPX);
  const rIn2 = (R - 30) * (R - 30), rAO2 = (R + 64) * (R + 64);
  for (let j = 0; j < RH; j++) {
    const y = Y0 + j, ddy = cy - y;
    for (let i = 0; i < RW; i++) {
      const x = X0 + i, ddx = x - cx, rr2 = ddx * ddx + ddy * ddy;
      if (rr2 < rIn2) continue;      // hidden under the malachite
      const wv = bil(fWarp, i, j);
      const m = featherMask(a, x, y, wv), k = 0.05 + 0.95 * m, vary = 0.3 + 0.7 * m;
      let w = (y - 0.11 * (x - 960) + 30 * wv) / SP + 0.37;
      w += 0.17 * Math.sin(w * 2.1 + 1);               // uneven band heights
      const bi = Math.floor(w), t = w - bi, b = bi - B0;
      const tc = t - 0.5, pinS = Math.sqrt(4 * t * (1 - t)), P = bP[b];
      const along = x * bCos[b] + y * bSin[b];
      let q = (-x * bSin[b] + y * bCos[b]) / P + bCurve[b] * tc * tc + 0.12 * bil(fQ, i, j) + bOff[b];
      q += (1.7 / P) * nB.n2(along / 36, q * 0.7 + bi * 9.1);                // crystal edges are never ruler-straight
      const si = Math.floor(q), f = q - si;
      const hs = hsh(si, bi * 57 + 3), hs2 = hsh(si, bi * 131 + 71), hs3 = hsh(si, bi * 211 + 19);
      let gw = 0.2 + 0.2 * hs + 0.24 * bil(fGap, i, j);
      gw = (gw < 0.1 ? 0.1 : gw > 0.44 ? 0.44 : gw) * (0.2 + 0.8 * pinS) * m;   // slit width: lens-shaped, pinched at the shafts
      const gapPx = gw * P, Wb = P - gapPx, xb = f * P;
      // each blade is broken along its length into cleavage segments, every one a slightly different pair of facets
      const segLen = P * (1.1 + 1.9 * hs2);
      const sl = along / segLen + hs * 13, ai = Math.floor(sl), af = sl - ai;
      const hseg = hsh(ai, si * 31 + bi * 7), hseg2 = hsh(ai, si * 17 + bi * 29 + 5), hseg3 = hsh(ai, si * 7 + bi * 3 + 11);
      const Hb = (11 + 10 * hs3) * (0.3 + 0.7 * pinS) * k * (1 + 0.4 * (hseg - 0.5) * vary);
      let bw = 5 + 11 * hseg2; if (bw > Wb * 0.45) bw = Wb * 0.45;       // the bevel that faces the light
      const back = 0.36 + (0.95 * hseg3 - 0.48) * vary;                    // how far the main facet falls away behind it
      const xc = xb < Wb ? xb : Wb;
      let h = xc < bw ? Hb * xc / bw : Hb * (1 - back * (xc - bw) / (Wb - bw));
      const hEdge = Hb * (1 - back);
      if (m < 0.98) h *= 1 - sstep(Wb - 16 * (1 - m), Wb, xc);            // in the calm face the blades melt into each other
      h += (af - 0.5) * segLen * (hseg - 0.5) * 0.11 * k * m;             // cleavage steps
      // growth striations, dead parallel to the blade: some facets silky, some glass-smooth
      const c1 = q * 15 + along * 0.004 + hs * 37 + 4096, c2 = q * 38 - along * 0.007 + hs * 11 + 8192;
      const i1 = c1 | 0, i2 = c2 | 0, k1 = i1 & 1023, k2 = i2 & 1023;
      const stri = SR[k1] + (SR[k1 + 1] - SR[k1]) * (c1 - i1), stri2 = SR[k2] + (SR[k2 + 1] - SR[k2]) * (c2 - i2);
      h += (0.25 + 0.75 * k * hseg2) * (0.55 * stri + 0.3 * stri2);
      const tone = 1 + (0.24 * (hs - 0.5) + 0.12 * (hseg - 0.5)) * k;
      let cr = 27 * tone, cg = 72 * tone, cb = 176 * tone, sh = 1, gloss = 0.85;

      // the slit between two blades: cuprite red on the floor, purple-black in the shadow of the blade that overhangs it
      if (gapPx > 0.5 && xb > Wb - 0.7) {
        let bg = sstep(Wb - 0.7, Wb + 0.7, xb) * (1 - sstep(P - 1.4, P, xb));
        if (gapPx < 2) bg *= gapPx / 2;
        const gp = xb - Wb;
        cell(x / 5.6, y / 5.6);
        const bump = 1 - 1.7 * Math.sqrt(cD1), gv = 0.84 + 0.3 * cId;
        let gr = 229 * gv, gG = 54 * gv, gb = 30 * gv;
        if (cId > 0.9) { gr = 255; gG = 112; gb = 58; }
        const Ls = 1.25 * (hEdge > 0 ? hEdge : 0) + 2.5;
        let shd = 0.1 + 0.9 * sstep(Ls * 0.5, Ls * 1.15, gp);
        if (hs3 < 0.23) shd *= cId > 0.8 ? 0.75 : 0.22;                 // some slits stay almost entirely purple-black, a few red embers
        if (gp > 0) { const wall = sstep(0, 2.4 + 12 * (1 - m), gp); h += ((bump > 0 ? bump * 1.5 : 0) - h) * wall; }
        cr += (gr - cr) * bg; cg += (gG - cg) * bg; cb += (gb - cb) * bg;
        sh += (shd - 1) * bg; gloss += (0.12 - gloss) * bg;
      }

      // the shaft: a raised spine catching the light, with a cuprite / purple-black seam hugging its underside
      const sd = (t < 0.5 ? t : t - 1) * SP;          // px from the nearest shaft line, < 0 above it
      if (sd > -8 && sd < 15) {
        const sn = nB.n2(x / 38, bi * 5.3);
        const rg = 1 - Math.abs(sd + 2.6) / 5.2;
        if (rg > 0) { h += 7 * m * rg * (1 + 0.25 * sn); cr += (44 - cr) * rg * 0.6 * m; cg += (104 - cg) * rg * 0.6 * m; cb += (214 - cb) * rg * 0.6 * m; }
        const sw = (sd - 2) / (0.9 + 0.9 * (0.5 + 0.5 * nA.n2(x / 85, bi * 3.1 - 4)));      // the seam swells and thins along its length
        const uk = sstep(1.8, 3.2, sd) * (1 - sstep(4.2, 6.6, sw)) * m;
        if (uk > 0) {
          const red = sstep(-0.3, 0.0, nA.n2(x / 130, bi * 7.7 + 2)), tex = 1 + 0.14 * sn;
          cr += (229 * tex - cr) * uk; cg += (54 * tex - cg) * uk; cb += (30 * tex - cb) * uk;
          sh += ((0.2 + 0.8 * red) - sh) * uk; h -= h * uk; gloss += (0.12 - gloss) * uk;
        }
      }

      // the crust below stands proud of this one: a soft occlusion shadow along the seam
      if (rr2 < rAO2) sh *= 0.8 + 0.2 * sstep(4, 60, Math.sqrt(rr2) - R);
      // slow hue drift (ultramarine ↔ cobalt), illumination falloff, micro surface
      const hv = bil(fHue, i, j);
      const dx0 = x - 960, dy0 = y - 330;
      sh *= 1.05 - 0.17 * sstep(420, 1250, Math.sqrt(dx0 * dx0 + dy0 * dy0));
      h += 0.36 * MT[((y & 255) << 8) | (x & 255)];
      const p = j * RW + i, o = p * 4;
      d[o] = cr * (1 + 0.5 * hv); d[o + 1] = cg * (1 - 0.2 * hv); d[o + 2] = cb; d[o + 3] = 255;
      hB[p] = h; sB[p] = sh; gB[p] = gloss;
    }
  }
  const T1 = performance.now();
  relight(d, hB, sB, gB, RW, RH, { kd: 0.92, amb: [24, 13, 56], spec: [190, 215, 255], pw: 46 });
  const T2 = performance.now();
  const raw = L.makeCanvas(RW, RH);
  raw.getContext('2d').putImageData(img, 0, 0);
  const cnv = depthOfField(env, raw, X0, Y0);
  cnv.getContext('2d').getImageData(0, 0, 1, 1);
  console.warn('TIMING upper pass1', (T1 - T0) | 0, 'relight', (T2 - T1) | 0, 'dof', (performance.now() - T2) | 0);

  // crystal glints for the per-frame twinkle
  const rg = L.rng('s17glintU'), glints = [];
  for (let n = 0; n < 900 && glints.length < 120; n++) {
    const x = rg.range(-PAD, W + PAD), y = rg.range(-PAD, a.yAt(x) - 26);
    const m = featherMask(a, x, y, 0), u = rg(), sz = rg.range(2.2, 5.5);
    if (m < 0.45 || u > m) continue;
    const fd = focusDist(a, x, y);
    glints.push({ x, y, r: sz * (1 + 1.5 * clamp01((fd - 1) / 1.2)), soft: fd > 1.45, k: rg.int(0, 1) });
  }
  return { cnv, X0, Y0, glints };
}

// ───────────────────────── malachite (below the arc) + the cuprite seam ─────────────────────────
function buildLower(env) {
  const T0 = performance.now();
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const X0 = -PAD, Y0 = Math.floor(a.crestY) - 26;
  const RW = W + PAD * 2, RH = H + PAD - Y0;
  const nA = L.makeNoise('s17l1'), nB = L.makeNoise('s17l2');
  const CS = 8;
  const fTone = coarse(X0, Y0, RW, RH, CS, (x, y) => nA.fbm(x / 430, y / 430, 3));
  const fYel = coarse(X0, Y0, RW, RH, CS, (x, y) => 0.6 * nA.fbm(x / 210 + 30, y / 210 - 12, 3) + 0.4 * nB.fbm(x / 62 + 3, y / 62 + 8, 2));
  const fBot = coarse(X0, Y0, RW, RH, CS, (x, y) => nB.fbm(x / 250 - 7, y / 250 + 44, 3));
  const fPack = coarse(X0, Y0, RW, RH, CS, (x, y) => nA.fbm(x / 170 - 55, y / 170 + 21, 2));
  const fWx = coarse(X0, Y0, RW, RH, CS, (x, y) => nB.n2(x / 70 + 5, y / 70));
  const fWy = coarse(X0, Y0, RW, RH, CS, (x, y) => nB.n2(x / 70 - 31, y / 70 + 19));
  const GS = 19, BS = 54;                 // granule / botryoidal knob lattice sizes (px)
  const MT = microTile('s17grit', 2.6);
  const img = new ImageData(RW, RH), d = img.data, NPX = RW * RH;
  const hB = new Float32Array(NPX), sB = new Float32Array(NPX), gB = new Float32Array(NPX);
  const rOut2 = (R + 26) * (R + 26);
  const lx0 = 1160, ly0 = a.crestY + 60;
  for (let j = 0; j < RH; j++) {
    const y = Y0 + j, ddy = cy - y;
    for (let i = 0; i < RW; i++) {
      const x = X0 + i, ddx = x - cx, rr2 = ddx * ddx + ddy * ddy;
      if (rr2 > rOut2) continue;
      const dr = Math.sqrt(rr2) - R;
      const wx = bil(fWx, i, j), wy = bil(fWy, i, j);
      lumps(x / GS + wx * 0.5, y / GS + wy * 0.5, 0.5 + 0.22 * bil(fPack, i, j), 0.42, 1);
      const gv = lV, gid = lId, gR = lR;
      // the boundary: ragged at two scales and following the granules, so the edge is a fringe of whole grains
      let u = -100, wl = 0, s = 0;
      if (dr > -34) {
        s = Math.atan2(ddx, ddy) * R;
        let e = 2.2 * nA.n2(s / 33, 3.7) + 1.2 * nA.n2(s / 8.5, 11.3) + 2.0 * ((gv < 0 ? 0 : gv) - 0.5);
        e = e < -3.6 ? -3.6 : e > 3.6 ? 3.6 : e;
        const pocket = nB.n2(s / 190, 8.8) - 0.5;
        wl = 3.3 + 1.6 * nB.n2(s / 64, 5.1) + (pocket > 0 ? pocket * 8 : 0);          // width of the vermilion seam
        u = dr - (e - wl * 0.5);
        if (u > wl + 12) continue;
      }
      let cr = 0, cg = 0, cb = 0, al = 255, h = 0, sh = 1, gloss = 0;
      if (u < 0.7) {
        const tn = bil(fTone, i, j), tm = clamp01(0.5 + tn * 1.3);                 // slow drift green ↔ teal
        const j1 = (gid * 7.31) % 1, j2 = (gid * 23.17) % 1;
        // every granule is one clean pigment colour: 石绿, now and then a paler or a deeper one …
        if (gid > 0.975) { cr = 18; cg = 150; cb = 108; }
        else if (gid > 0.93) { cr = 136; cg = 240; cb = 196; gloss = 0.5; }
        else { const kk = 0.95 + 0.2 * j1; cr = (58 - 38 * tm) * kk; cg = (204 + 4 * tm) * kk; cb = (132 + 54 * tm) * kk; }
        // … and whole drifts of them turned 明黄绿, the way lichen mottles a rock
        const yk = sstep(-0.05, 0.05, 0.04 + 0.78 * sstep(0.0, 0.34, bil(fYel, i, j)) - j2);
        if (yk > 0) { const kk = 0.86 + 0.16 * j1; cr += (200 * kk - cr) * yk; cg += (224 * kk - cg) * yk; cb += (74 * kk - cb) * yk; }
        const g1 = gv > 0 ? gv : 0;
        h = 0.3 * gR * GS * (0.6 * g1 + 0.4 * g1 * g1) * (0.7 + 0.6 * j1);
        // bedded in a darker green matrix; close to the seam the red ground shows through instead
        const gin = sstep(0, 0.14, gv);
        const rk = dr > -17 ? sstep(-17, -2, dr) * 0.85 : 0;
        const mr = 22 - 8 * tm + (204 - 18) * rk, mg = 160 + (42 - 160) * rk, mb = 112 + 34 * tm + (24 - 128) * rk;
        cr = mr + (cr - mr) * gin; cg = mg + (cg - mg) * gin; cb = mb + (cb - mb) * gin;
        sh = 0.72 + 0.28 * sstep(-0.05, 0.3, gv);
        gloss += 0.2;
        // botryoidal knobs (葡萄状): silky domes of very different sizes crowding each other in patches
        let cover = 0;
        const bm = sstep(0.2, 0.5, bil(fBot, i, j));
        if (bm > 0.01) {
          lumps(x / BS + wx * 0.14 + 3.3, y / BS + wy * 0.14 + 1.7, 0.4, 0.46, bm * 0.8);
          if (lV > -8) {
            if (lV > 0) {
              const v = lV;
              cover = sstep(0, 0.14, v);
              const ring = 0.5 + 0.5 * Math.sin((1 - v) * 7 + lId * 50);     // malachite's concentric banding, very faint
              const kk = (0.94 + 0.1 * ring) * (0.94 + 0.14 * ((lId * 53.3) % 1));
              const kR = (50 - 30 * tm) * kk, kG = 206 * kk, kB = (134 + 50 * tm) * kk;
              cr += (kR - cr) * cover; cg += (kG - cg) * cover; cb += (kB - cb) * cover;
              h = h * (1 - 0.8 * cover) + 0.34 * lR * BS * (0.5 * v + 0.5 * Math.sqrt(v));
              sh += (1 - sh) * cover * 0.85;
              sh *= 0.8 + 0.2 * sstep(0, 0.14, v - (lV2 > 0 ? lV2 : 0));  // the crease where two domes meet
              gloss += (0.6 - gloss) * cover;
            } else {
              const dd = Math.sqrt(lDx * lDx + lDy * lDy), rr = dd / lR;      // contact shadow on the side away from the light
              if (rr < 1.5) { const sdw = (lDx * 0.64 - lDy * 0.77) / dd; if (sdw > 0) sh *= 1 - 0.5 * sdw * (1 - (rr - 1) / 0.5); }
            }
          }
        }
        // grit
        h += 0.75 * MT[((y & 255) << 8) | (x & 255)] * (1 - 0.6 * cover);
        // the rim of the mound catches the light; the light pools on its upper right shoulder
        const dxv = x - lx0, dyv = y - ly0;
        sh *= (1 + 0.14 * sstep(-26, -3, dr)) * (1.05 - 0.17 * sstep(300, 1350, Math.sqrt(dxv * dxv + dyv * dyv)));
      }
      if (u > -0.7) {
        // vermilion seam, then a short purple-black contact shadow fading out over the azurite
        const vn = 0.9 + 0.22 * nB.n2(s / 4.5, dr / 2.6) + 0.14 * sstep(wl * 0.4, wl, u);
        const tv = sstep(-0.7, 0.7, u);
        cr += (229 * vn - cr) * tv; cg += (54 * vn - cg) * tv; cb += (30 * vn - cb) * tv;
        h -= h * tv; sh += (1 - sh) * tv; gloss -= gloss * tv;
        if (u > wl - 0.7) {
          const ts = sstep(wl - 0.7, wl + 0.7, u), f = clamp01(1 - (u - wl) / 12);
          cr += (36 - cr) * ts; cg += (14 - cg) * ts; cb += (52 - cb) * ts;
          al = 255 + (255 * 0.66 * f * f - 255) * ts;
        }
      }
      const p = j * RW + i, o = p * 4;
      d[o] = cr; d[o + 1] = cg; d[o + 2] = cb; d[o + 3] = al;
      hB[p] = h; sB[p] = sh; gB[p] = gloss;
    }
  }
  const T1 = performance.now();
  relight(d, hB, sB, gB, RW, RH, { kd: 0.5, amb: [8, 62, 54], spec: [215, 255, 235], pw: 38 });
  const T2 = performance.now();
  const raw = L.makeCanvas(RW, RH);
  raw.getContext('2d').putImageData(img, 0, 0);
  const cnv = depthOfField(env, raw, X0, Y0);
  cnv.getContext('2d').getImageData(0, 0, 1, 1);
  console.warn('TIMING lower pass1', (T1 - T0) | 0, 'relight', (T2 - T1) | 0, 'dof', (performance.now() - T2) | 0);

  // sparkle sites on the granules
  const rg = L.rng('s17glintL'), glints = [];
  const span = a.span(PAD);
  for (let n = 0; n < 300; n++) {
    const th = rg.range(-span, span), dr = -8 - Math.pow(rg(), 1.25) * 640, pt = a.pt(th, dr);
    const fd = focusDist(a, pt.x, pt.y);
    glints.push({ x: pt.x, y: pt.y, r: rg.range(2, 4.6) * (1 + 1.9 * clamp01((fd - 1) / 1.2)), soft: fd > 1.45, k: rg.int(0, 2) });
  }
  return { cnv, X0, Y0, glints };
}

/** a sparkle sprite: a tight hot point when in focus, a flat disc of confusion with a brighter rim when out of focus */
function sprite(col, bokeh) {
  const c = L.makeCanvas(64, 64), g = c.getContext('2d');
  g.fillStyle = L.radial(g, 32, 32, 0, 32, bokeh
    ? [[0, L.rgba(col, 0.42)], [0.7, L.rgba(col, 0.46)], [0.86, L.rgba(col, 0.62)], [1, L.rgba(col, 0)]]
    : [[0, L.rgba(col, 1)], [0.22, L.rgba(col, 0.9)], [0.5, L.rgba(col, 0.25)], [1, L.rgba(col, 0)]]);
  g.fillRect(0, 0, 64, 64);
  return c;
}

function twinkle(ctx, gl, spr, fr, salt, rate) {
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < gl.length; i++) {
    const tw = hsh(i, fr * salt + 1);
    if (tw > rate) continue;
    const q = gl[i], k = 1 - tw / rate, r = q.r * (0.75 + 0.5 * k);
    ctx.globalAlpha = q.soft ? 0.3 + 0.4 * k : 0.5 + 0.5 * k;
    ctx.drawImage(spr[q.k][q.soft ? 1 : 0], q.x - r, q.y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

export default {
  name: '锈色显微',
  tone: 'light',
  init(env) {
    const t0 = performance.now(); const up = buildUpper(env); const t1 = performance.now(); const lo = buildLower(env); console.warn('s17 timing up', (t1 - t0) | 0, 'lo', (performance.now() - t1) | 0);
    S = {
      up, lo,
      sprU: ['#ffffff', '#a9ccff'].map((c) => [sprite(c, false), sprite(c, true)]),
      sprL: ['#ffffff', '#f1ffb0', '#c4ffe8'].map((c) => [sprite(c, false), sprite(c, true)]),
      grain: L.grainTex(512, 512, { seed: 's17shimmer', amount: 0.55 }),
    };
  },
  draw(ctx, env, p) {
    const a = env.arc, fr = env.frame | 0;
    // the two crusts creep in opposite directions along their boundary
    const rotU = L.lerp(0.0036, -0.0036, p), rotL = L.lerp(-0.0046, 0.0046, p);
    ctx.fillStyle = '#1f4fb0'; ctx.fillRect(0, 0, W, H);

    L.cam(ctx, env, { rot: rotU }, () => {
      ctx.drawImage(S.up.cnv, S.up.X0, S.up.Y0);
      twinkle(ctx, S.up.glints, S.sprU, fr, 7, 0.3);       // blade edges flash for a single frame each
    });

    L.cam(ctx, env, { rot: rotL }, () => {
      ctx.drawImage(S.lo.cnv, S.lo.X0, S.lo.Y0);
      twinkle(ctx, S.lo.glints, S.sprL, fr, 13, 0.34);     // granules catch the light frame by frame
    });

    // live pigment grain on the malachite (a different offset every frame)
    ctx.save();
    a.clipBelow(ctx, -3);
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.14;
    const ox = Math.floor(hsh(fr, 11) * 512), oy = Math.floor(hsh(fr, 29) * 512);
    ctx.translate(-ox, -oy);
    ctx.fillStyle = ctx.createPattern(S.grain, 'repeat');
    ctx.fillRect(ox, oy + a.crestY - 8, W, H - a.crestY + 8);
    ctx.restore();
  },
};
