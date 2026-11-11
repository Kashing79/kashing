// s23 — 红外热成像 (the file keeps its first-cut name). An infrared thermogram of a round hall's eave in saturated
// false colour, filling the whole frame: no black, no dots, no HUD.
//   arc   = the eave edge (檐口): cool lime-yellow above it, hot magenta / violet below it
//   below = a row of big, uneven tile-end blobs (勾头) hugging the arc, then concentric isotherm bands
//           (crimson → purple → yellow → violet → orange …) that wobble and break up as they go down
//   above = soft vertical bands (the columns and door leaves of the storey behind, far out of focus): amber, coral,
//           magenta and two thin cold lines. Behind the tagline they keep to yellow ↔ lime — the same brightness —
//           so the ink lettering sits on an even, bright field.
// How it is made: ONE scalar "temperature" field T(x, y) is assembled per pixel (analytic eave edge, rounded-box blobs,
// a radial band profile, a low-res stripe field, noise) and pushed through ONE colour ramp. Every boundary therefore
// carries the real isotherm fringe of a thermal camera (lime → yellow → orange → red on the way to magenta) and the
// colours never mix into mud. Lens softness and depth of field are added afterwards in colour space.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 140;
const LW = W + PAD * 2, LH = H + PAD * 2;
let S = null;

// cold → hot
const THERMO = L.makeRamp([
  [0.00, '#3b5b7c'], [0.07, '#4a8b8a'], [0.15, '#56bf74'], [0.26, '#a2d83a'], [0.385, '#dde43a'], [0.48, '#f9d638'],
  [0.56, '#fba42e'], [0.635, '#f36a36'], [0.70, '#e93a55'], [0.78, '#d6197a'], [0.86, '#ac1280'], [0.93, '#7f1178'], [1.00, '#560f68'],
]);
const T_AIR = 0.385;    // the lime-yellow of the open air above the eave
const T_HOT = 0.9;      // the purple the roof rests at between its bands

const sst = (a, b, v) => { const t = v <= a ? 0 : v >= b ? 1 : (v - a) / (b - a); return t * t * (3 - 2 * t); };

/** three noise fields packed into the RGB of one low-res image, enlarged to the layer by the canvas (bilinear) */
function noiseRGB(div, smooth, fn) {
  const M = 3;                                         // spare cells all round, so the blur below never reaches past the image
  const gw = Math.ceil(LW / div) + 1 + M * 2, gh = Math.ceil(LH / div) + 1 + M * 2;
  const img = new ImageData(gw, gh); const d = img.data;
  const v = [0, 0, 0];
  let k = 0;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    fn((i - M) * div - PAD, (j - M) * div - PAD, v);
    d[k++] = 128 + 127 * v[0]; d[k++] = 128 + 127 * v[1]; d[k++] = 128 + 127 * v[2]; d[k++] = 255;
  }
  const small = L.makeCanvas(gw, gh); small.getContext('2d').putImageData(img, 0, 0);
  const out = L.makeCanvas(LW, LH); const g = out.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  if (smooth) g.filter = `blur(${div * smooth}px)`;    // bilinear kinks would turn into polygonal isotherms
  g.drawImage(small, 0, 0, gw, gh, -M * div, -M * div, gw * div, gh * div);
  g.filter = 'none';
  return g.getImageData(0, 0, LW, LH).data;
}

// ───────────────────────── above the eave: vertical bands ─────────────────────────
// c = centre x, hw = half width, A = peak ΔT (+ hot, − cold), soft = edge softness (× hw), top = y where it fades in,
// gap = px above the eave where it gives out, foot = how much it swells where it meets the eave
const STRIPES = [
  { c: -80, hw: 70, A: 0.25, soft: 0.5 },
  { c: 92, hw: 50, A: 0.22, soft: 0.45, tilt: 0.01 },
  { c: 236, hw: 8, A: -0.36, soft: 1.0, foot: 1.6, tilt: -0.006 },
  { c: 302, hw: 26, A: 0.1, soft: 0.9 },
  { c: 430, hw: 52, A: 0.19, soft: 0.4, tilt: 0.008 },
  { c: 558, hw: 36, A: 0.38, soft: 0.4, tilt: -0.004 },
  { c: 684, hw: 30, A: -0.16, soft: 0.8 },
  { c: 772, hw: 46, A: 0.4, soft: 0.45, tilt: 0.006 },
  { c: 884, hw: 20, A: -0.3, soft: 0.8 },
  { c: 1012, hw: 28, A: 0.22, soft: 0.6, tilt: -0.008 },
  { c: 1108, hw: 40, A: -0.28, soft: 0.6 },
  { c: 1204, hw: 34, A: 0.42, soft: 0.5 },
  { c: 1290, hw: 20, A: -0.14, soft: 0.9 },
  { c: 1388, hw: 48, A: 0.2, soft: 0.45, tilt: 0.006 },
  { c: 1484, hw: 21, A: 0.41, soft: 0.5, tilt: -0.004 },
  { c: 1590, hw: 30, A: -0.17, soft: 0.9 },
  { c: 1684, hw: 44, A: 0.24, soft: 0.45, tilt: -0.01 },
  { c: 1770, hw: 16, A: 0.12, soft: 0.9 },
  { c: 1846, hw: 9, A: -0.38, soft: 1.0, foot: 1.8, tilt: 0.005 },
  { c: 1922, hw: 44, A: 0.28, soft: 0.45 },
  { c: 2056, hw: 50, A: 0.18, soft: 0.6 },
];
const UDIV = 4;
function buildStripes(env, teeth) {
  const a = env.arc;
  const gw = Math.ceil(LW / UDIV) + 2, gh = Math.ceil(LH / UDIV) + 2;
  const U = new Float32Array(gw * gh);
  const nz = L.makeNoise('s23stripes');
  STRIPES.forEach((st, n) => {
    const k = n * 7.31 + 1.7;
    for (let j = 0; j < gh; j++) {
      const y = j * UDIV - PAD;
      const cx = st.c + (st.tilt || 0) * (y - 300) + 5 * nz.n2(y / 380 + k, k * 3.7);
      const up = a.yAt(L.clamp(cx, a.cx - a.R * 0.9, a.cx + a.R * 0.9)) - y;       // px above the eave
      let hw = st.hw * (1 + 0.12 * nz.n2(y / 260 - k * 2.1, k));
      if (st.foot) hw *= 1 + st.foot * (1 - sst(4, 64, up));
      let e = 0.86 + 0.24 * nz.n2(y / 420 + k * 5.3, 1.7 - k);                      // blotchy along its length
      if (st.top !== undefined) e *= sst(st.top - 80, st.top + 80, y);
      if (st.gap) e *= sst(st.gap - 50, st.gap + 60, up);
      if (st.A > 0) e *= L.lerp(0.62, 1, sst(0, 130, up));                           // hot bands cool a little toward the eave, so the eave keeps its edge
      if (e <= 0) continue;
      const sf = Math.max(7, hw * st.soft), amp = st.A * e;
      const i0 = Math.max(0, Math.floor((cx - hw - sf + PAD) / UDIV)), i1 = Math.min(gw - 1, Math.ceil((cx + hw + sf + PAD) / UDIV));
      for (let i = i0; i <= i1; i++) {
        const dd = Math.abs(i * UDIV - PAD - cx);
        U[j * gw + i] += amp * (1 - sst(hw - sf, hw + sf, dd));
      }
    }
  });
  // cold pockets: small green spots sitting in some of the notches between the tile ends, just above the eave
  const r = L.rng('s23pockets');
  for (let n = 0; n < teeth.length - 1; n++) {
    const t0 = teeth[n], t1 = teeth[n + 1];
    if (!r.chance(0.6)) continue;
    const s = (t0.s + t0.hw + t1.s - t1.hw) / 2 + r.range(-8, 8);
    const p = a.pt(s / a.R, r.range(7, 15)), rx = r.range(15, 26), ry = r.range(10, 16), A = -r.range(0.17, 0.3);
    const i0 = Math.max(0, Math.floor((p.x - rx * 2.6 + PAD) / UDIV)), i1 = Math.min(gw - 1, Math.ceil((p.x + rx * 2.6 + PAD) / UDIV));
    const j0 = Math.max(0, Math.floor((p.y - ry * 2.6 + PAD) / UDIV)), j1 = Math.min(gh - 1, Math.ceil((p.y + ry * 2.6 + PAD) / UDIV));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const ex = (i * UDIV - PAD - p.x) / rx, ey = (j * UDIV - PAD - p.y) / ry;
      U[j * gw + i] += A * Math.exp(-(ex * ex + ey * ey));
    }
  }
  // behind the tagline the bands may change hue (yellow ↔ lime) but not brightness
  const LIMH = 0.062, LIMC = 0.125;
  for (let j = 0; j < gh; j++) {
    const y = j * UDIV - PAD;
    const cy = L.lerp(0.7, 1, sst(a.crestY - 520, a.crestY - 280, y));
    for (let i = 0; i < gw; i++) {
      const x = i * UDIV - PAD;
      const c = sst(548, 640, x) * (1 - sst(1280, 1372, x)) * cy;
      if (c <= 0) continue;
      const u = U[j * gw + i];
      U[j * gw + i] = u + ((u > 0 ? LIMH * Math.tanh(u / LIMH) : LIMC * Math.tanh(u / LIMC)) - u) * c;
    }
  }
  return { U, gw };
}

// ───────────────────────── along the eave: tile-end blobs ─────────────────────────
function buildTeeth(env) {
  const a = env.arc, r = L.rng('s23teeth');
  const SM = a.span(PAD + 320) * a.R;
  const mk = (s, pitch) => {
    const flaw = r();
    const t = { s, hw: pitch * r.range(0.27, 0.36), dep: r.range(64, 96), heat: r.range(0.9, 0.99), lean: r.range(-0.2, 0.2) };
    if (flaw < 0.12) t.heat = r.range(0.83, 0.87);                     // a tile that runs cooler
    else if (flaw < 0.3) { t.hw *= 0.72; t.dep *= 0.78; }              // a chipped, smaller one
    return t;
  };
  const list = [mk(40, 190)];
  for (let s = list[0].s; s < SM;) { const p = r.range(150, 216); s += p; list.push(mk(s, p)); }
  for (let s = list[0].s; s > -SM;) { const p = r.range(150, 216); s -= p; list.unshift(mk(s, p)); }
  for (const t of list) if (Math.abs(t.s) < 330) t.heat = Math.max(t.heat, 0.94);   // the ones in focus are the hottest
  // nearest-blob lookup along the arc, 2 px steps
  const n = Math.ceil(SM) + 2, idx = new Int16Array(n);
  let q = 0;
  for (let i = 0; i < n; i++) {
    const s = -SM + i * 2;
    while (q < list.length - 1 && Math.abs(list[q + 1].s - s) < Math.abs(list[q].s - s)) q++;
    idx[i] = q;
  }
  // flat arrays for the pixel loop
  const m = list.length;
  const ts = new Float32Array(m), thw = new Float32Array(m), tdc = new Float32Array(m), thd = new Float32Array(m), trad = new Float32Array(m), theat = new Float32Array(m), tlean = new Float32Array(m);
  list.forEach((t, i) => { ts[i] = t.s; thw[i] = t.hw; tdc[i] = t.dep / 2 - 4; thd[i] = t.dep / 2 + 4; trad[i] = Math.min(t.hw, thd[i]) * 0.82; theat[i] = t.heat; tlean[i] = t.lean; });
  return { list, SM, idx, n, ts, thw, tdc, thd, trad, theat, tlean };
}

// ───────────────────────── below the eave: the radial band profile ─────────────────────────
// [px below the eave, T]. Smooth-stepped between the knots, so every band has a plateau and soft shoulders.
const BANDS = [[0, 0.69], [60, 0.71], [96, 0.78], [124, 0.9], [140, 0.945], [156, 0.86], [170, 0.93], [186, 0.94], [218, 0.61], [232, 0.53], [246, 0.53],
  [264, 0.62], [296, 0.92], [352, 0.95], [400, 0.66], [416, 0.6], [432, 0.6], [452, 0.68], [500, 0.9], [566, 0.86], [646, 0.66], [706, 0.68], [796, 0.9], [1400, 0.9]];
function bandProfile() {
  const P = new Float32Array(1400);
  let q = 0;
  for (let d = 0; d < P.length; d++) {
    while (q < BANDS.length - 2 && d >= BANDS[q + 1][0]) q++;
    P[d] = L.lerp(BANDS[q][1], BANDS[q + 1][1], sst(BANDS[q][0], BANDS[q + 1][0], d));
  }
  return P;
}

// ───────────────────────── the thermogram ─────────────────────────
function buildThermogram(env) {
  const a = env.arc, R = a.R;
  const nz = L.makeNoise('s23thermo');
  // slow fields at 1/8: R = overall drift, G = how strongly each band shows (polar), B = lazy radial wander of the bands (polar)
  const NA = noiseRGB(8, 0, (x, y, v) => {
    const dx = x - a.cx, dy = a.cy - y, rr = Math.hypot(dx, dy), s = Math.atan2(dx, dy) * R, d = R - rr;
    v[0] = L.clamp(1.5 * nz.fbm(x / 1000 + 3.1, y / 1000 - 1.7, 3), -1, 1);
    v[1] = L.clamp(1.7 * nz.fbm(s / 540 + 9.2, d / 210 + 4.4, 3), -1, 1);
    v[2] = L.clamp(1.7 * nz.fbm(s / 400 - 5.3, d / 300 + 11.8, 2), -1, 1);
  });
  // quicker fields at 1/4: R = isotherm wobble (~90 px), G = blotches (~46 px), B = patches (~170 px)
  const NB = noiseRGB(4, 0.8, (x, y, v) => {
    v[0] = L.clamp(1.5 * nz.fbm(x / 88 + 21, y / 88 - 13, 2), -1, 1);
    v[1] = L.clamp(1.5 * nz.fbm(x / 46 + 40, y / 46 - 20, 2), -1, 1);
    v[2] = L.clamp(1.5 * nz.fbm(x / 170 - 8, y / 170 + 33, 2), -1, 1);
  });
  const tt = buildTeeth(env);
  const { U, gw } = buildStripes(env, tt.list);
  const P = bandProfile(), PMAX = P.length - 2;
  // sensor grain: a gaussian tile, read once per pixel and once per 2×2 block
  const gr = L.rng('s23grain'), G = new Float32Array(65536);
  for (let i = 0; i < 65536; i++) G[i] = L.clamp(gr.gauss(), -2.5, 2.5);
  // colour table (little-endian ABGR)
  const LUT = new Uint32Array(2048);
  for (let i = 0; i < 2048; i++) { const c = THERMO(i / 2047); LUT[i] = (255 << 24) | (Math.round(c[2]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[0]); }

  const img = new ImageData(LW, LH), out = new Uint32Array(img.data.buffer);
  const I = 1 / 127;
  for (let j = 0; j < LH; j++) {
    const y = j - PAD, dy = a.cy - y, dy2 = dy * dy;
    const fy = (y - (a.crestY + 40)) / 560, fy2 = fy * fy;
    const uty = (j & 3) * 0.25, ur0 = (j >> 2) * gw, ur1 = ur0 + gw;
    const g0 = (j & 255) << 8, g1 = (((j >> 1) + 91) & 255) << 8;
    let k = j * LW * 4, o = j * LW;
    for (let i = 0; i < LW; i++, k += 4, o++) {
      const dx = i - PAD - a.cx;
      const rr = Math.sqrt(dx * dx + dy2), dr = rr - R;
      const fx = dx / 1050;
      const foc = sst(0.25, 1.15, Math.sqrt(fx * fx + fy2));       // 0 in focus (around the crest) → 1 far out
      const we = 3 + 6 * foc;
      const nDrift = (NA[k] - 128) * I, nWob = (NB[k] - 128) * I, nBlot = (NB[k + 1] - 128) * I, nPatch = (NB[k + 2] - 128) * I;
      let Tup = 0, Tdn = 0;
      if (dr > -we) {
        const ui = i >> 2, utx = (i & 3) * 0.25;
        const u0 = U[ur0 + ui], u1 = U[ur1 + ui];
        const du = (u0 + (U[ur0 + ui + 1] - u0) * utx) * (1 - uty) + (u1 + (U[ur1 + ui + 1] - u1) * utx) * uty;
        Tup = T_AIR - 0.06 * sst(240, 700, dr) + du + 0.03 * nDrift + 0.02 * nBlot + 0.02 * nPatch;
        if (dr < 80) Tup += 0.035 * Math.exp(-(dr > 0 ? dr : 0) / 15);    // warmth leaking off the eave
      }
      if (dr < we) {
        const d = -dr, s = R * Math.asin(dx / rr);
        const deep = sst(70, 210, d);
        const nAmp = (NA[k + 1] - 128) * I, nWander = (NA[k + 2] - 128) * I;
        let dq = d + deep * (26 * nWander + 2.5 * nWob);
        dq = dq < 0 ? 0 : dq > PMAX ? PMAX : dq;
        const pi = dq | 0, pv = P[pi] + (P[pi + 1] - P[pi]) * (dq - pi);
        let amp = (0.92 + 0.62 * nAmp) * (1 - 0.38 * sst(620, 1250, s < 0 ? -s : s)); amp = amp < 0.3 ? 0.3 : amp > 1.04 ? 1.04 : amp;
        Tdn = T_HOT + (pv - T_HOT) * (1 + (amp - 1) * deep) + 0.016 * nBlot + 0.035 * nPatch + 0.05 * nAmp * (1 - deep);
        if (d < 130) {
          let si = ((s + tt.SM) * 0.5) | 0; si = si < 0 ? 0 : si >= tt.n ? tt.n - 1 : si;
          const q = tt.idx[si], rad = tt.trad[q];
          const qs = Math.abs(s - tt.ts[q] - tt.tlean[q] * (d - tt.tdc[q])) - (tt.thw[q] - rad), qd = Math.abs(d - tt.tdc[q]) - (tt.thd[q] - rad);
          const ox = qs > 0 ? qs : 0, oy = qd > 0 ? qd : 0;
          const sd = Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(qs, qd), 0) - rad + 9 * nWob + 4 * nBlot;
          const sf = 9 + 20 * foc;
          const m = 1 - sst(-sf, sf, sd);
          if (m > 0) Tdn += (tt.theat[q] + 0.02 * nBlot - Tdn) * m;
        }
      }
      let T = dr >= we ? Tup : dr <= -we ? Tdn : Tdn + (Tup - Tdn) * sst(-we, we, dr);
      T += 0.008 * G[g0 + (i & 255)] + 0.011 * G[g1 + (((i >> 1) + 37) & 255)];
      out[o] = LUT[T <= 0 ? 0 : T >= 1 ? 2047 : (T * 2047) | 0];
    }
  }
  const sharp = L.makeCanvas(LW, LH);
  sharp.getContext('2d').putImageData(img, 0, 0);
  return sharp;
}

/** lens: everything a touch soft, and progressively out of focus away from the crest of the eave */
function lens(env, sharp) {
  const a = env.arc;
  const out = L.blurred(sharp, 1.6);
  const g = out.getContext('2d');
  const mix = (px, sc, r0, r1) => {
    const b = L.makeCanvas(LW * sc, LH * sc), bg = b.getContext('2d');
    bg.filter = `blur(${px * sc}px)`;
    bg.drawImage(sharp, 0, 0, b.width, b.height);
    bg.filter = 'none';
    bg.globalCompositeOperation = 'destination-in';
    bg.scale(sc, sc); bg.translate(PAD + a.cx, PAD + a.crestY + 40); bg.scale(1.85, 1);
    bg.fillStyle = L.radial(bg, 0, 0, r0, r1, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]);
    bg.fillRect(-LW, -LH, LW * 2, LH * 2);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(b, 0, 0, LW, LH);
  };
  mix(6, 1, 110, 420);
  mix(16, 0.5, 320, 740);
  out._pad = PAD;
  return out;
}

export default {
  name: '红外热成像',
  tone: 'dark',
  init(env) {
    S = { layer: lens(env, buildThermogram(env)) };
  },
  draw(ctx, env, p) {
    const rot = L.lerp(-0.008, 0.008, p), zoom = L.lerp(1.0, 1.022, p);
    ctx.fillStyle = '#dbe43c'; ctx.fillRect(0, 0, W, H);
    L.blit(ctx, env, S.layer, { rot, zoom });
  },
};
