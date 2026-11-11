// s25 — 缠丝玛瑙. Macro of a slice of banded agate lying on a sheet of 胭脂水 (rouge-pink) paper.
// The arc is the outer edge of the nodule's skin (皮壳): a lumpy honey-yellow rind over a wet, near-black husk.
// Below it the milky chalcedony: hair-fine bands that run parallel to the skin and wrap every bump of it, so right under
// the husk they hang as a string of drip-shaped scallops whose edges bleed rouge; two small lilac crystal pockets (晶洞).
//
// How it is built (all in init):
//   • the banding is ONE scalar field — the distance from the inner wall of the husk (a union of round "drip" lobes),
//     gently warped — looked up in a 1-D colour sequence. Iso-lines of a single field can never cross each other.
//   • the skin gets a height map (bevel + lumps + pits) and is lit per pixel; three sets of specular glints, computed for
//     three light directions, are cross-faded in draw() so the wet highlights wander from frame to frame.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 80;
let S = null;

const sm = (a, b, v) => { const t = L.clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };

// ── tiny allocation-free worley noise (squared distances in cD1/cD2, cell id in cId) ──
let cD1 = 0, cD2 = 0, cId = 0;
function cell(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let d1 = 9, d2 = 9, id = 0;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const cx = xi + ox, cy = yi + oy;
    let h = (Math.imul(cx, 374761393) + Math.imul(cy, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    const dx = cx + (h & 1023) / 1023 - x, dy = cy + ((h >>> 10) & 1023) / 1023 - y, d = dx * dx + dy * dy;
    if (d < d1) { d2 = d1; d1 = d; id = ((h >>> 20) & 255) / 255; } else if (d < d2) d2 = d;
  }
  cD1 = d1; cD2 = d2; cId = id;
}

// ── palette ──
const C = {
  milk: [246, 239, 230], white: [254, 251, 245], water: [236, 227, 216],
  pinkPale: [248, 204, 221], pink: [236, 136, 178], rouge: [216, 74, 142], rougeDeep: [188, 44, 110],
  honeyPale: [247, 222, 158], honey: [233, 177, 58], honeyDeep: [205, 134, 26], amber: [124, 70, 16], tea: [168, 104, 40],
};

// ── the band sequence: colour as a function of distance from the husk wall (px) ──
const LUT_PX = 4, LUT_MAX = 900, LN = LUT_MAX * LUT_PX;
const ROUGE_T = 20.4;       // where the rouge line that outlines every drip starts
function buildBands() {
  const r = L.rng('s25bands');
  const bands = [];           // [t0, colour, softness of the boundary at t0]
  let t = 0;
  const push = (w, c, soft) => { bands.push([t, c, soft]); t += w; };
  // right against the husk: amber seam → honey → a clean white rim → the rouge line and its bleed
  push(2.4, C.amber, 0.6);
  push(4.5, C.honey, 1.0);
  push(3.0, C.honeyPale, 1.6);
  push(10.5, C.white, 2.2);
  push(4.4, C.rouge, 0.55);
  push(7, C.pink, 3.2);
  push(11, C.pinkPale, 4.5);
  push(1.8, C.white, 0.7);
  push(2, C.pink, 0.5);
  push(9, C.pinkPale, 1.6);
  push(4, C.white, 4);
  push(1.6, C.honey, 0.5);
  push(3, C.white, 0.8);
  push(1.4, C.honeyDeep, 0.45);
  push(15, C.milk, 1.4);
  // packets of silk-fine threads separated by calm milky zones
  let last = '';
  while (t < LUT_MAX + 40) {
    let kind = r.pick(['pink', 'honey', 'pink', 'honey', 'mixed', 'wide', 'ghost']);
    if (kind === last) kind = kind === 'honey' ? 'pink' : 'honey';
    if (!last) kind = 'honey';
    last = kind;
    if (kind === 'pink' || kind === 'honey' || kind === 'mixed') {
      const fam = kind === 'pink' ? [C.pinkPale, C.pink, C.pink, C.rouge] : kind === 'honey' ? [C.honeyPale, C.honey, C.honey, C.honeyDeep] : [C.pink, C.honey, C.pinkPale, C.honeyPale, C.honeyDeep, C.tea];
      const n = r.int(3, 9);
      for (let i = 0; i < n; i++) {
        // a thread: crisp on the wall side, its tint sometimes seeping into the white that follows
        push(r.chance(0.13) ? r.range(4, 8.5) : r.range(1.3, 3.1), r.pick(fam), r.range(0.35, 0.8));
        push(r.chance(0.15) ? r.range(6, 12) : r.range(1.7, 4.8), r.chance(0.55) ? C.white : r.chance(0.5) ? C.milk : C.water, r.chance(0.6) ? r.range(0.4, 0.9) : r.range(1.2, 3));
      }
    } else if (kind === 'ghost') {
      const n = r.int(2, 5);
      for (let i = 0; i < n; i++) { push(r.range(3, 9), C.water, r.range(1, 3.5)); push(r.range(3, 10), C.white, r.range(1, 3.5)); }
    } else {
      // a wider tinted layer: crisp on the wall side, dissolving on the other
      const pinkish = r.chance(0.5), c = pinkish ? C.pinkPale : C.honeyPale;
      push(r.range(1.6, 3), pinkish ? C.pink : C.honeyDeep, 0.5);
      push(r.range(10, 22), c, 1.2);
      push(r.range(6, 12), C.milk, r.range(5, 9));
    }
    if (r.chance(0.88)) push(r.range(14, 40) * (1 + t / 450), C.milk, r.range(3, 7));       // the calm zones widen toward the heart of the stone
  }
  const lut = new Float32Array((LN + 8) * 3);
  let bi = 0;
  for (let i = 0; i < LN + 8; i++) {
    const x = i / LUT_PX;
    while (bi < bands.length - 2 && x >= bands[bi + 1][0]) bi++;
    const b = bands[bi], prev = bands[Math.max(0, bi - 1)], next = bands[bi + 1];
    let c0 = b[1][0], c1 = b[1][1], c2 = b[1][2];
    const aa = (x - b[0]) / b[2];
    if (bi > 0 && aa < 1) { const w = 0.5 + 0.5 * aa * aa * (3 - 2 * aa), p = prev[1]; c0 = p[0] + (c0 - p[0]) * w; c1 = p[1] + (c1 - p[1]) * w; c2 = p[2] + (c2 - p[2]) * w; }
    const bb = (next[0] - x) / next[2];
    if (bb < 1 && bb >= 0) { const w = 0.5 * (1 - bb * bb * (3 - 2 * bb)), q = next[1]; c0 += (q[0] - c0) * w; c1 += (q[1] - c1) * w; c2 += (q[2] - c2) * w; }
    lut[i * 3] = c0; lut[i * 3 + 1] = c1; lut[i * 3 + 2] = c2;
  }
  return lut;
}

/** separable box blur of a float grid (edges clamped) */
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const o = y * w; let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[o + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) { tmp[o + x] = acc / n; acc += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)]; }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) { out[y * w + x] = acc / n; acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; }
  }
  return out;
}

function rampLut(stops, n = 256) {
  const f = L.makeRamp(stops), out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const c = f(i / (n - 1)); out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2]; }
  return out;
}

/** the agate slice: everything below the arc, plus three layers of wandering glints for the skin */
function buildSlice(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const X0 = -PAD, Y0 = Math.floor(a.crestY) - 16;
  const RW = W + PAD * 2, RH = H + PAD - Y0, N = RW * RH;
  const nA = L.makeNoise('s25a'), nB = L.makeNoise('s25b');
  const bandLut = buildBands();

  // ── 1-D profiles along the arc (index = u + UM; u = arc length from the crest, px; v = depth below the arc, px) ──
  const UM = 1900, UN = UM * 2 + 2;
  const vTop = new Float32Array(UN), vRind = new Float32Array(UN), vBase = new Float32Array(UN);
  for (let i = 0; i < UN; i++) {
    const u = i - UM;
    vTop[i] = L.clamp(0.4 + 2.2 * nA.n2(u / 85, 1.7) + 1.1 * nA.n2(u / 21, 8.3), -2.6, 3.4);      // silhouette: stays within ±3.5 px of the arc
    vRind[i] = Math.max(14, 31 + 13 * nB.n2(u / 150, 4.4) + 5 * nB.n2(u / 37, 12.9));               // honey rind → dark husk
    vBase[i] = 84 + 13 * nA.fbm(u / 230, 21.5, 2) + 4 * nB.n2(u / 47, 30.2);                      // husk → chalcedony (before the drips)
  }
  const prof = (arr, u) => { const f = u + UM, i = f | 0; return arr[i] + (arr[i + 1] - arr[i]) * (f - i); };

  // ── drip lobes hanging from the husk ──
  const rs = L.rng('s25lobes');
  const seeds = [];
  for (let u = -1820; u < 1820;) {
    const kind = rs();
    let r, hang;
    if (kind < 0.5) { r = rs.range(20, 40); hang = rs.range(6, 20); }
    else if (kind < 0.84) { r = rs.range(18, 32); hang = rs.range(22, 44); }
    else { r = rs.range(13, 21); hang = rs.range(48, 76); }
    seeds.push({ u, r, hang, lean: rs.range(-8, 8), neck: rs.range(0.6, 0.95), geo: 0 });
    u += r * rs.range(1.3, 2.5) + rs.range(4, 30);
  }
  // two of them hold a small crystal pocket
  const geos = [];
  for (const [gu, gr, gh] of [[-205, 45, 54], [585, 37, 45]]) {
    let best = seeds[0];
    for (const s of seeds) if (Math.abs(s.u - gu) < Math.abs(best.u - gu)) best = s;
    best.r = gr; best.hang = gh; best.lean = 0; best.neck = 0.9; best.geo = 1;
  }
  const BK = 128, buckets = [];
  for (const s of seeds) {
    const vb = prof(vBase, s.u);
    s.cu = s.u + s.lean; s.cv = vb + s.hang - s.r;          // centre of the round tip
    s.x0 = s.u; s.y0 = vb - 16;                             // the neck runs from inside the husk down to the tip
    s.ex = s.cu - s.x0; s.ey = s.cv - s.y0; s.il = 1 / Math.max(1e-3, s.ex * s.ex + s.ey * s.ey);
    s.rn = s.r * s.neck; s.long = s.hang > s.r * 0.9;
    if (s.geo) geos.push({ cu: s.cu, cv: s.cv + 5, rp: s.r - 11, ph: geos.length * 2.7 });
    const b = (s.u + UM) / BK | 0;
    (buckets[b] || (buckets[b] = [])).push(s);
  }
  // broad lobes that the deeper bands swell into (so they never read as a bullseye)
  const macro = [];
  for (let u = -2000; u < 2000;) { macro.push({ u, a: rs.range(14, 44), rho: rs.range(520, 1000) }); u += rs.range(240, 520); }
  const macroAt = (u) => { let m = -99; for (const q of macro) { const b = q.a - (u - q.u) * (u - q.u) / (2 * q.rho); m = -smin(-m, -b, 26); } return m; };

  // ── fields on a 2-px grid: wall distance D, band coordinate T, colour wash W, mottling M, rouge stain P ──
  const G = 2, gw = Math.ceil(RW / G) + 2, gh = Math.ceil(RH / G) + 2;
  const Dg = new Float32Array(gw * gh), Tg = new Float32Array(gw * gh), Wg = new Float32Array(gw * gh), Mg = new Float32Array(gw * gh), Pg = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) {
    const ddy = cy - (Y0 + j * G);
    for (let i = 0; i < gw; i++) {
      const ddx = X0 + i * G - cx, rr = Math.sqrt(ddx * ddx + ddy * ddy), v = R - rr, k = j * gw + i;
      if (v < 36) { Dg[k] = v - 84; continue; }
      const u = Math.atan2(ddx, ddy) * R;
      let d = v - prof(vBase, u);
      const b0 = (u + UM) / BK | 0;
      for (let b = b0 - 4; b <= b0 + 4; b++) {
        const list = buckets[b]; if (!list) continue;
        for (let q = 0; q < list.length; q++) {
          const s = list[q];
          const du = u - s.cu, dv = v - s.cv;
          d = smin(d, Math.sqrt(du * du + dv * dv) - s.r, 5);
          if (s.long) {
            const px = u - s.x0, py = v - s.y0, tt = L.clamp((px * s.ex + py * s.ey) * s.il);
            const qx = px - s.ex * tt, qy = py - s.ey * tt;
            d = smin(d, Math.sqrt(qx * qx + qy * qy) - s.rn, 7);
          }
        }
      }
      Dg[k] = d;
    }
  }
  // deeper bands forget the sharp cusps between the drips: they follow a progressively smoothed copy of the wall distance
  const Db1 = boxBlur(boxBlur(Dg, gw, gh, 5), gw, gh, 5), Db2 = boxBlur(boxBlur(Db1, gw, gh, 15), gw, gh, 15), Db3 = boxBlur(boxBlur(Db2, gw, gh, 30), gw, gh, 30);
  for (let j = 0; j < gh; j++) {
    const ddy = cy - (Y0 + j * G);
    for (let i = 0; i < gw; i++) {
      const k = j * gw + i, d0 = Dg[k];
      if (d0 < -1.5) continue;
      const ddx = X0 + i * G - cx, rr = Math.sqrt(ddx * ddx + ddy * ddy), v = R - rr, u = Math.atan2(ddx, ddy) * R;
      let d = d0 + (Db1[k] - d0) * sm(6, 38, d0);
      d += (Db2[k] - d) * sm(30, 105, d0);
      d += (Db3[k] - d) * sm(110, 270, d0);
      const deep = sm(30, 240, d);
      const tb = d * (1 + 0.14 * nA.n2(u / 650, 3.1) + 0.13 * nB.n2(u / 150, 7.7) * (1 - sm(28, 110, d))) - deep * macroAt(u) + 11 * deep * nA.fbm(u / 420, v / 260, 2) + 0.5 * sm(8, 60, d) * nB.n2(u / 60, v / 60);
      Tg[k] = Math.max(0, tb);
      // where the tint of the bands fades: partly along the bands, partly in soft clouds that ignore them
      const wash = L.clamp(0.1 + 0.6 * nB.fbm(u / 260 + 9, tb / 90, 2), 0, 0.5), cloud = 0.72 * sm(0.08, 0.55, nA.fbm(u / 230 + 77, v / 160 - 31, 2));
      const flick = 0.22 * sm(-0.2, 0.6, nB.n2(u / 240 + 3, tb / 9));          // every thread also waxes and wanes on its own
      Wg[k] = Math.min(0.88, sm(60, 140, tb) * (1 - (1 - wash) * (1 - cloud) * (1 - flick)) + 0.26 * sm(180, 520, tb));
      Mg[k] = nA.fbm(u / 170 - 4, v / 170 + 8, 2);
      Pg[k] = sm(0.2, 0.7, nB.fbm(u / 320 - 40, v / 210 + 13, 2)) * sm(90, 200, tb);
    }
  }

  // ── pass 1: chalcedony colour, skin height ──
  const img = new ImageData(RW, RH), px = img.data;
  const Hh = new Float32Array(N), Sk = new Float32Array(N), Rb = new Float32Array(N), Dd = new Float32Array(N), Al = new Float32Array(N), Gv = new Float32Array(N);
  const GEO = rampLut([[0, '#4a3a78'], [0.25, '#8672b8'], [0.5, '#b5a6dc'], [0.75, '#dcd2f1'], [1, '#ffffff']]);
  const Gs = new Uint8Array(N);       // crystal sparkle: which glint set (1..3) a pixel belongs to
  let jSkinMax = 0;
  for (let j = 0; j < RH; j++) {
    const ddy = cy - (Y0 + j), fy = j / G, j0 = fy | 0, ty = fy - j0;
    for (let i = 0; i < RW; i++) {
      const ddx = X0 + i - cx, rr = Math.sqrt(ddx * ddx + ddy * ddy), v = R - rr;
      if (v < -4) continue;
      const u = Math.atan2(ddx, ddy) * R;
      const vt = prof(vTop, u), al = L.clamp(v - vt + 0.5);
      if (al <= 0) continue;
      const k = j * RW + i, o = k * 4;
      Al[k] = al;
      const fx = i / G, i0 = fx | 0, tx = fx - i0, g0 = j0 * gw + i0, g1 = g0 + gw;
      const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
      const d = Dg[g0] * w00 + Dg[g0 + 1] * w10 + Dg[g1] * w01 + Dg[g1 + 1] * w11;
      const skin = L.clamp(0.5 - d);
      Sk[k] = skin; Dd[k] = d;
      if (skin < 1) {
        const tb = Tg[g0] * w00 + Tg[g0 + 1] * w10 + Tg[g1] * w01 + Tg[g1 + 1] * w11;
        const wv = Wg[g0] * w00 + Wg[g0 + 1] * w10 + Wg[g1] * w01 + Wg[g1 + 1] * w11;
        const mv = Mg[g0] * w00 + Mg[g0 + 1] * w10 + Mg[g1] * w01 + Mg[g1 + 1] * w11;
        const li = Math.min(LN - 2, tb * LUT_PX), l0 = li | 0, lt = li - l0, lo = l0 * 3;
        let cr = bandLut[lo] + (bandLut[lo + 3] - bandLut[lo]) * lt, cg = bandLut[lo + 1] + (bandLut[lo + 4] - bandLut[lo + 1]) * lt, cb = bandLut[lo + 2] + (bandLut[lo + 5] - bandLut[lo + 2]) * lt;
        // the tint of a band comes and goes
        cr += (246 - cr) * wv; cg += (239 - cg) * wv; cb += (230 - cb) * wv;
        // a faint rouge stain soaked into the stone here and there, not tied to any one band
        const pv = (Pg[g0] * w00 + Pg[g0 + 1] * w10 + Pg[g1] * w01 + Pg[g1 + 1] * w11) * 0.2;
        cr += (240 - cr) * pv; cg += (150 - cg) * pv; cb += (186 - cb) * pv;
        // rouge bleeding off the drips: the lower a lobe hangs, the more it stains the bands around it
        if (tb < 120 && tb > 18) {
          const hang = L.clamp((v - d - prof(vBase, u) - 3) / 36);
          const e = tb < ROUGE_T ? sm(18, ROUGE_T, tb) : Math.exp(-(tb - ROUGE_T) / 26);
          const am = e * hang * 0.62;
          cr += (216 - cr) * am; cg += (74 - cg) * am; cb += (142 - cb) * am;
        }
        // translucency: slow mottling, a touch deeper toward the bottom of the slice
        const mt = (1 + 0.035 * mv) * (1 - 0.06 * sm(220, 640, v));
        cr *= mt; cg *= mt * (1 - 0.012 * sm(220, 640, v)); cb *= mt * (1 - 0.03 * sm(220, 640, v));
        // the raised husk throws a short shadow down-right onto the polished face
        if (d < 14) {
          const sx = Math.max(0, (i - 4) / G), sy = Math.max(0, (j - 6) / G), si = sx | 0, sj = sy | 0, ax = sx - si, ay = sy - sj, h0 = sj * gw + si, h1 = h0 + gw;
          const ds = (Dg[h0] * (1 - ax) + Dg[h0 + 1] * ax) * (1 - ay) + (Dg[h1] * (1 - ax) + Dg[h1 + 1] * ax) * ay;
          const sh = 1 - 0.34 * L.clamp((2 - ds) / 8);
          cr *= sh; cg *= sh * 0.97; cb *= sh * 0.97;
        }
        px[o] = cr; px[o + 1] = cg; px[o + 2] = cb;
      }
      if (skin > 0) {
        if (j > jSkinMax) jSkinMax = j;
        // crystal pocket?
        let gcov = 0;
        for (let q = 0; q < geos.length; q++) {
          const ge = geos[q], du = (u - ge.cu) / 1.22, dv = (v - ge.cv) / 0.86;
          if (Math.abs(du) > ge.rp + 8 || Math.abs(dv) > ge.rp + 8) continue;
          const rim = (x, y) => { const an = Math.atan2(x, y); return Math.sqrt(x * x + y * y) - ge.rp * (1 + 0.16 * nA.n2(an * 1.2 + ge.ph, 5.5 + ge.ph) + 0.07 * nB.n2(an * 3.7 + ge.ph, 2.2)); };
          const dg = rim(du, dv);
          if (dg > 0.5) continue;
          gcov = L.clamp(0.5 - dg);
          const rho = -dg / ge.rp;                                         // 0 at the lining → ~1 in the middle of the hollow
          cell(u / 6 + ge.ph, v / 6);
          const s1 = Math.sqrt(cD1), edge = sm(0.0, 0.14, Math.sqrt(cD2) - s1);
          const hollow = sm(0.34, 0.74, rho + 0.18 * (cId - 0.5));
          // pale lilac crystal facets lining the pocket; the hollow behind them a deeper violet
          let tone = (0.6 + 0.4 * cId) * (1 - 0.18 * s1) * (0.62 + 0.38 * edge);
          tone += (0.1 + 0.14 * cId - tone) * hollow;
          tone *= 1 - 0.42 * L.clamp((rim(du - 5, dv - 7) + 9) / 9);       // the lip shades the upper-left inside
          tone += 0.16 * L.clamp((rim(du + 4, dv + 6) + 6) / 6);           // and the lower-right inside catches the light
          tone = L.clamp(tone + 0.45 * sm(-2.6, -0.4, dg));                // white chalcedony lining
          const gi = (tone * 255 | 0) * 3;
          px[o] = GEO[gi]; px[o + 1] = GEO[gi + 1]; px[o + 2] = GEO[gi + 2];
          if (cId > 0.74 && s1 < 0.28 && dg < -4 && hollow < 0.6) Gs[k] = 1 + ((cId * 97) | 0) % 3;
        }
        Gv[k] = gcov;
        // height of the skin
        const rv = v - vt, vr = prof(vRind, u);
        const rb = v - (vr + 7 * nB.fbm(u / 30, v / 30, 2));
        Rb[k] = rb;
        const rind = sm(2.2, -2.2, rb);
        cell(u / 26, v / 26);
        const pit = cId > 0.7 ? sm(0.26, 0.02, Math.sqrt(cD1)) : 0;
        const lumpH = 4.4 * nA.fbm(u / 66, v / 42, 2) + 0.9 * nB.fbm(u / 21, v / 21, 2);          // husk: broad wet lumps
        const lumpR = 4.6 * nA.fbm(u / 40 + 50, v / 26, 2) + 1.0 * nB.fbm(u / 13, v / 13, 2);      // rind: knobbly crust
        const lump = lumpH + (lumpR - lumpH) * rind;
        Hh[k] = (7 * sm(0, 11, rv) + lump * sm(0, 7, rv) + 3.4 * rind - 3 * pit) * sm(0, 7, -d) * (1 - gcov);
      }
    }
  }

  // ── pass 2: light the skin ──
  const SH = Math.min(RH, jSkinMax + 3);
  const LX = -0.42, LY = -0.72, LZ = 0.55;
  const HN = Math.hypot(LX, LY, LZ + 1), HX = LX / HN, HY = LY / HN, HZ = (LZ + 1) / HN;      // half-vector of the key light (broad gloss)
  // glints: a tight lobe ~19° off the surface normal, swung to three azimuths → three sets that only the steeper wet lumps reach
  const halves = [-0.5, 0, 0.5].map((ph) => {
    const lx = LX * Math.cos(ph) - LY * Math.sin(ph), ly = LX * Math.sin(ph) + LY * Math.cos(ph), n = Math.hypot(lx, ly), t = 0.34;
    return [lx / n * Math.sin(t), ly / n * Math.sin(t), Math.cos(t)];
  });
  const specI = halves.map(() => new ImageData(RW, SH));
  const RIND = rampLut([[0, '#643406'], [0.22, '#a86a10'], [0.4, '#d3961f'], [0.5, '#e9b13a'], [0.6, '#f3c24c'], [0.76, '#ffe07e'], [1, '#fff8d4']]);
  for (let j = 1; j < SH - 1; j++) {
    for (let i = 1; i < RW - 1; i++) {
      const k = j * RW + i, skin = Sk[k], o = k * 4;
      if (Al[k] <= 0) continue;
      px[o + 3] = Al[k] * 255;
      if (skin <= 0) continue;
      const hx = (Hh[k + 1] - Hh[k - 1]) * 0.5, hy = (Hh[k + RW] - Hh[k - RW]) * 0.5;
      const inv = 1 / Math.sqrt(hx * hx + hy * hy + 1), nx = -hx * inv, ny = -hy * inv, nz = inv;
      const diff = Math.max(0, nx * LX + ny * LY + nz * LZ);
      const nh = Math.max(0, nx * HX + ny * HY + nz * HZ);
      const gloss = Math.pow(nh, 22);
      const rb = Rb[k], rind = sm(1.6, -1.6, rb), d = Dd[k];
      // husk: near-black brown, wet; an orange-brown fringe under the rind; amber glow where it thins toward the chalcedony
      const sh = 0.42 + 1.05 * diff;
      let hr = 42 * sh + 22 * gloss, hg = 28 * sh + 17 * gloss, hb = 16 * sh + 13 * gloss;
      const up = Math.max(0, -ny) * 0.09; hr += 194 * up; hg += 51 * up; hb += 122 * up;      // the rouge paper mirrored in the wet stone
      const fr = sm(14, 1, rb) * 0.72;
      hr += (132 * sh - hr) * fr; hg += (70 * sh - hg) * fr; hb += (14 * sh - hb) * fr;
      const gw2 = Math.pow(sm(-14, 0, d), 1.4) * 0.76;
      hr += (182 - hr) * gw2; hg += (104 - hg) * gw2; hb += (22 - hb) * gw2;
      // rind: bright honey
      const ri = (L.clamp((0.14 + 0.66 * diff + 0.3 * gloss)) * 255 | 0) * 3;
      let cr = hr + (RIND[ri] - hr) * rind, cg = hg + (RIND[ri + 1] - hg) * rind, cb = hb + (RIND[ri + 2] - hb) * rind;
      const gv = Gv[k];
      if (gv > 0) { cr += (px[o] - cr) * gv; cg += (px[o + 1] - cg) * gv; cb += (px[o + 2] - cb) * gv; }
      if (skin < 1) { cr = px[o] + (cr - px[o]) * skin; cg = px[o + 1] + (cg - px[o + 1]) * skin; cb = px[o + 2] + (cb - px[o + 2]) * skin; }
      px[o] = cr; px[o + 1] = cg; px[o + 2] = cb;
      // glints
      const kk = skin * Al[k] * (1 - gv) * (0.85 + 0.15 * (1 - rind));
      for (let q = 0; q < 3; q++) {
        const hq = halves[q], sp = gv > 0.5 ? (Gs[k] === q + 1 ? 0.9 : 0) : Math.min(1, Math.pow(Math.max(0, nx * hq[0] + ny * hq[1] + nz * hq[2]), 150) * 1.7) * kk;
        if (sp > 0.012) { const sd = specI[q].data; sd[o] = 255; sd[o + 1] = 248 - 14 * rind; sd[o + 2] = 228 - 60 * rind; sd[o + 3] = sp * 255; }
      }
    }
  }
  for (let k = SH * RW - RW; k < N; k++) if (Al[k] > 0) px[k * 4 + 3] = Al[k] * 255;
  for (let j = 0; j < RH; j++) { const k0 = j * RW, k1 = k0 + RW - 1; px[k0 * 4 + 3] = Al[k0] * 255; px[k1 * 4 + 3] = Al[k1] * 255; }
  for (let i = 0; i < RW; i++) px[i * 4 + 3] = Al[i] * 255;

  const slice = L.makeCanvas(RW, RH), sg = slice.getContext('2d');
  sg.putImageData(img, 0, 0);
  // a little depth inside the stone (soft-light bloom of itself) and a fine tooth so nothing is vector-flat
  L.overlayOn(slice, L.blurred(slice, 7), { blend: 'soft-light', alpha: 0.28 });
  L.overlayOn(slice, L.grainTex(RW, RH, { seed: 's25grain', amount: 0.11 }), { blend: 'overlay', alpha: 0.55 });
  const spec = specI.map((im) => { const c = L.makeCanvas(RW, SH); c.getContext('2d').putImageData(im, 0, 0); const b = L.makeCanvas(RW, SH), bg = b.getContext('2d'); bg.drawImage(c, 0, 0); bg.globalAlpha = 0.5; bg.filter = 'blur(3px)'; bg.drawImage(c, 0, 0); return b; });
  // contact shadow: a narrow dark-rouge fringe where the slice rests on the paper
  const sil = L.makeCanvas(RW, SH), sl = sil.getContext('2d');
  sl.drawImage(slice, 0, 0); sl.globalCompositeOperation = 'source-in'; sl.fillStyle = '#560a32'; sl.fillRect(0, 0, RW, SH);
  const shadow = L.blurred(sil, 4);
  return { slice, spec, shadow, X0, Y0 };
}

/** the sheet of 胭脂水 paper: flat colour, the finest tooth */
function buildBg() {
  const c = L.makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#c2337a'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.42;
  g.drawImage(L.noiseTex(W, H, { seed: 's25paper', scale: 5, octaves: 2, res: 0.5, contrast: 1.5 }), 0, 0);
  g.globalAlpha = 0.14;
  g.drawImage(L.noiseTex(W, H, { seed: 's25paper2', scale: 620, octaves: 3, res: 0.125 }), 0, 0);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  const r = L.rng('s25fib');
  g.lineCap = 'round';
  for (let i = 0; i < 520; i++) {
    const x = r() * W, y = r() * H, len = r.range(5, 22), an = r() * Math.PI;
    g.strokeStyle = r.chance(0.5) ? `rgba(255,214,232,${r.range(0.03, 0.09)})` : `rgba(96,10,52,${r.range(0.03, 0.09)})`;
    g.lineWidth = r.range(0.5, 1.1);
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(an) * len * 0.5 + r.range(-3, 3), y + Math.sin(an) * len * 0.5 + r.range(-3, 3), x + Math.cos(an) * len, y + Math.sin(an) * len); g.stroke();
  }
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.6;
  g.drawImage(L.grainTex(W, H, { seed: 's25g', amount: 0.13 }), 0, 0);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  return c;
}

export default {
  name: '缠丝玛瑙',
  tone: 'light',
  init(env) {
    S = { bg: buildBg(), ...buildSlice(env) };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    ctx.drawImage(S.bg, 0, 0);
    const rot = L.lerp(-0.0042, 0.0042, p), zoom = L.lerp(1.0, 1.01, p);
    // the three glint sets take turns: the wet highlights wander over the skin
    const w = [L.clamp(1 - 2 * p), 1 - Math.abs(2 * p - 1), L.clamp(2 * p - 1)];
    L.cam(ctx, env, { rot, zoom }, () => {
      ctx.globalAlpha = 0.34; ctx.drawImage(S.shadow, S.X0, S.Y0 - 1); ctx.globalAlpha = 1;
      ctx.drawImage(S.slice, S.X0, S.Y0);
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) if (w[k] > 0.004) { ctx.globalAlpha = Math.pow(w[k], 0.6); ctx.drawImage(S.spec[k], S.X0, S.Y0); }
    });
    // soft sheen sliding over the polished face
    ctx.save(); a.clipBelow(ctx, -150); ctx.globalCompositeOperation = 'soft-light';
    a.at(ctx, L.lerp(-0.2, -0.12, p), -330, () => {
      ctx.scale(2.6, 1);
      ctx.fillStyle = L.radial(ctx, 0, 0, 0, 260, [[0, 'rgba(255,255,255,0.5)'], [0.5, 'rgba(255,255,255,0.2)'], [1, 'rgba(255,255,255,0)']]);
      ctx.fillRect(-270, -270, 540, 540);
    });
    ctx.restore();
  },
};
