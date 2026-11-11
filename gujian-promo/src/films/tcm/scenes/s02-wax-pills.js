// s02 — 蜡丸. Macro of the rim of a round cake of yellow beeswax, lit from behind.
// The arc is the outer edge of the cake. Just inside it a row of wax-shell pills (蜡壳丸) sits half sunk into the raised rim:
// creamy translucent balls, each with the thin seam where the two half shells meet. Below them the cake itself:
// honey-yellow wax with concentric pouring rings stepping down into amber. Above: black, with a little lit dust.
//
// How it is built (everything in init, then two blits per frame):
//   BODY — the cake. A tone field T(U, d) is evaluated on a polar grid (U = px along the arc, d = px below it), so every
//          ring is concentric by construction, then mapped through one beeswax colour ramp.
//   TOP  — the raised rim: backlit lip, shelf, cast shadows, and the pills (each shaded per pixel as a translucent sphere).
//   BODY turns a little slower than TOP, so the rings read as lying inside the wax.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 150;     // side margin of the pre-rendered layers (rot ≤ 0.011 rad → ≤ 27 px of slide)
const PADB = 70;     // margin below the frame
const LEDGE = 162;   // depth (px below the arc) of the front edge of the raised rim the pills sit in
let S = null;

const sstep = (a, b, v) => { const t = L.clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// tone (0 = deep shadow … 1 = backlit edge) → colour
const WAX = [[0, '#0e0501'], [0.12, '#351704'], [0.26, '#6b3409'], [0.38, '#8a4b0f'], [0.5, '#c06c0c'], [0.6, '#e39312'],
  [0.7, '#f0b429'], [0.8, '#fbc640'], [0.88, '#ffd96f'], [0.95, '#ffe9a3'], [1, '#fff6d6']];
const SHELL = [[0, '#6e3206'], [0.18, '#b3560c'], [0.32, '#de7c16'], [0.44, '#f29a26'], [0.56, '#f9bd52'], [0.68, '#fcd98a'],
  [0.8, '#ffe9a3'], [0.9, '#fff2c8'], [1, '#fffbe8']];
function toneLut(stops) {
  const f = L.makeRamp(stops), out = new Uint8ClampedArray(1024 * 3);
  for (let i = 0; i < 1024; i++) { const c = f(i / 1023); out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2]; }
  return out;
}

// ── polar tone field → pixels ──────────────────────────────────────────────────────────────────────
/** evaluate fn(U, d) on a grid: 6 px steps along the arc, 1 px steps in depth */
function polarGrid(env, reg, dMin, dMax, fn) {
  const a = env.arc;
  const thMax = Math.atan2(W / 2 + PAD + 4, a.cy - (reg.y + reg.h)) + 0.012;
  const dU = 6, U0 = -thMax * a.R, nU = Math.ceil((2 * thMax * a.R) / dU) + 2, nD = Math.ceil(dMax - dMin) + 2;
  const T = new Float32Array(nU * nD);
  for (let j = 0; j < nD; j++) { const d = dMin + j; for (let i = 0; i < nU; i++) T[j * nU + i] = fn(U0 + i * dU, d); }
  return { U0, dU, nU, d0: dMin, nD, T };
}
/** paint the grid into a canvas covering `reg`, for depths dTop … dEnd (anti-aliased at dTop, faded out over `fade` px at dEnd) */
function rasterize(env, reg, grid, lut, dTop, dEnd, fade) {
  const a = env.arc, RW = reg.w, RH = reg.h;
  const img = new ImageData(RW, RH), px = img.data;
  const { U0, dU, nU, d0, nD, T } = grid;
  for (let j = 0; j < RH; j++) {
    const ddy = a.cy - (reg.y + j + 0.5);
    for (let i = 0; i < RW; i++) {
      const ddx = reg.x + i + 0.5 - a.cx;
      const d = a.R - Math.sqrt(ddx * ddx + ddy * ddy);
      if (d < dTop - 0.5 || d > dEnd) continue;
      let al = d - dTop + 0.5; if (al > 1) al = 1;
      if (fade && d > dEnd - fade) al *= (dEnd - d) / fade;
      const fu = (Math.atan2(ddx, ddy) * a.R - U0) / dU;
      let fd = d - d0; if (fd < 0) fd = 0; else if (fd > nD - 1.001) fd = nD - 1.001;
      const iu = fu | 0, id = fd | 0, tu = fu - iu, td = fd - id, k = id * nU + iu;
      const t = (T[k] * (1 - tu) + T[k + 1] * tu) * (1 - td) + (T[k + nU] * (1 - tu) + T[k + nU + 1] * tu) * td;
      let li = (t * 1023) | 0; li = (li < 0 ? 0 : li > 1023 ? 1023 : li) * 3;
      const o = (j * RW + i) * 4;
      px[o] = lut[li]; px[o + 1] = lut[li + 1]; px[o + 2] = lut[li + 2]; px[o + 3] = al * 255;
    }
  }
  const c = L.makeCanvas(RW, RH);
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

// ── the pouring rings: two 1-D profiles over depth ────────────────────────────────────────────────
const D_MIN = -12, D_MAX = 720, DN = (D_MAX - D_MIN) * 2 + 1;
const prof = (arr, d) => { let f = (d - D_MIN) * 2; f = f < 0 ? 0 : f > DN - 1.001 ? DN - 1.001 : f; const i = f | 0; return arr[i] + (arr[i + 1] - arr[i]) * (f - i); };
function ringProfiles() {
  const base = new Float32Array(DN), ridge = new Float32Array(DN);
  const r = L.rng('s02rings'), rings = [];
  for (let d = LEDGE + 52; d < D_MAX; d += r.range(30, 74)) rings.push({ d, s: r.range(0.45, 1), w: r.range(1.7, 2.9), len: r.range(22, 60) });
  let ph = 0;
  for (let i = 0; i < DN; i++) {
    const x = D_MIN + i * 0.5;
    // honey at the rim sinking to amber, plus the shaded riser right under the shelf
    base[i] = 0.82 - 0.3 * L.smooth((x - 175) / 450) - (x > LEDGE - 2 ? 0.3 * Math.exp(-(x - LEDGE + 2) / 15) : 0);
    // each ring: a lip that catches the back light, and the shadow it throws on the layer below
    let v = 0;
    for (const k of rings) {
      const u = x - k.d;
      v += 0.22 * k.s * Math.exp(-(u * u) / (k.w * k.w));
      if (u > 0) v -= 0.17 * k.s * Math.exp(-u / k.len) * (1 - Math.exp(-u / 2.2)); else v += 0.07 * k.s * Math.exp(u / 18);
    }
    ph += L.TAU / (7.5 + 2.5 * Math.sin(x / 53)) * 0.5;
    ridge[i] = v + 0.009 * Math.sin(ph) * sstep(180, 240, x);   // faint ripples between the rings
  }
  return { base, ridge };
}

// ── the cake ──────────────────────────────────────────────────────────────────────────────────────
function buildBody(env, reg, lut) {
  const a = env.arc, nA = L.makeNoise('s02a'), nB = L.makeNoise('s02b');
  const { base, ridge } = ringProfiles();
  const grid = polarGrid(env, reg, 20, a.R - Math.hypot(0, a.cy - (reg.y + reg.h)) + 12, (U, d) => {
    // hand-poured: the rings wander a few px, more so deep in the cake
    const wob = (nA.n2(U / 560 + 3.1, d / 300) * 0.7 + nA.n2(U / 210 - 8, d / 160 + 5) * 0.3) * (2 + 7 * sstep(150, 520, d));
    const dd = d + wob;
    let t = prof(base, dd) + prof(ridge, dd) * (0.72 + 0.42 * nB.n2(U / 300 + 7.7, dd / 140));
    t += 0.028 * nA.n2(U / 620, dd / 17 + 40) + 0.013 * nB.n2(U / 260 + 31, dd / 6);   // flow streaks drawn out along the rings
    t += 0.06 * nB.fbm(U / 240 + 11, d / 170 - 3, 3);                                    // cloudiness inside the wax
    return t;
  });
  const c = rasterize(env, reg, grid, lut, 30, 1e9, 0);
  const g = c.getContext('2d');
  g.translate(-reg.x, -reg.y);
  g.save(); a.clipBelow(g, -34);
  // the cake turns away from the light toward the sides and sinks to amber-brown deep down
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = L.radial(g, a.cx - 90, a.crestY + 210, 380, 1500, [[0, '#ffffff'], [0.55, '#eccb9c'], [1, '#bd8a52']]);
  g.fillRect(reg.x, reg.y, reg.w, reg.h);
  g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 760, a.R - 420, [[0, '#c88a44'], [1, '#ffffff']]);
  g.fillRect(reg.x, reg.y, reg.w, reg.h);
  g.globalCompositeOperation = 'source-over';
  // specks of pollen and propolis caught in the wax
  L.speckle(g, { seed: 's02speck', count: 520, x: reg.x, y: reg.y, w: reg.w, h: reg.h, rMin: 0.5, rMax: 1.9, colors: ['#5a2a05', '#7a3a08', '#3a1803'], alpha: [0.12, 0.5], test: (x, y) => a.drAt(x, y) < -LEDGE - 14 });
  L.speckle(g, { seed: 's02speck2', count: 160, x: reg.x, y: reg.y, w: reg.w, h: reg.h, rMin: 0.5, rMax: 1.4, colors: ['#fff0bd', '#ffe08a'], alpha: [0.15, 0.55], test: (x, y) => a.drAt(x, y) < -LEDGE - 14 });
  // a few air bubbles: dark refracting rim, light gathered on the side away from the lamp
  const r = L.rng('s02bub'), sp = a.span(PAD + 30);
  let cth = 0, cd = 300;
  for (let n = 0; n < 46; n++) {
    if (n % 4 === 0) { cth = r.range(-sp, sp); cd = r.range(LEDGE + 50, 520); }
    const th = cth + r.gauss() * 0.02, d = L.clamp(cd + r.gauss() * 40, LEDGE + 26, 570), rad = 1.8 + Math.pow(r(), 2.4) * 7;
    a.at(g, th, -d, () => {
      g.fillStyle = L.radial(g, 0, 0, rad * 0.55, rad * 1.25, [[0, 'rgba(84,36,4,0)'], [0.6, 'rgba(84,36,4,0.5)'], [1, 'rgba(84,36,4,0)']]);
      g.beginPath(); g.arc(0, 0, rad * 1.25, 0, L.TAU); g.fill();
      g.fillStyle = L.radial(g, 0, rad * 0.4, 0, rad, [[0, 'rgba(255,238,170,0.85)'], [0.55, 'rgba(255,208,96,0.3)'], [1, 'rgba(255,200,80,0)']]);
      g.beginPath(); g.arc(0, 0, rad, 0, L.TAU); g.fill();
      g.fillStyle = L.radial(g, 0, -rad * 0.5, 0, rad * 0.8, [[0, 'rgba(96,42,5,0.5)'], [1, 'rgba(96,42,5,0)']]);
      g.beginPath(); g.arc(0, 0, rad, 0, L.TAU); g.fill();
      g.fillStyle = 'rgba(255,250,228,0.85)';
      g.beginPath(); g.ellipse(-rad * 0.28, -rad * 0.5, Math.max(0.6, rad * 0.2), Math.max(0.45, rad * 0.12), -0.5, 0, L.TAU); g.fill();
    });
  }
  g.restore();
  // macro depth of field: the cake swells toward the lens at the bottom of frame and goes soft
  const soft = L.blurred(c, 4.5), sg = soft.getContext('2d');
  sg.globalCompositeOperation = 'destination-in';
  sg.translate(-reg.x, -reg.y);
  sg.fillStyle = L.radial(sg, a.cx, a.cy, a.R - 570, a.R - 330, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
  sg.fillRect(reg.x, reg.y, reg.w, reg.h);
  g.drawImage(soft, reg.x, reg.y);
  return c;
}

// ── the pills ─────────────────────────────────────────────────────────────────────────────────────
function layoutPills(env) {
  const a = env.arc, r = L.rng('s02pills'), s = a.span(PAD + 130), out = [];
  let th = -s, prev = 0;
  while (th < s) {
    const rad = r.range(64, 84);
    th += (prev + rad + r.range(28, 50)) / a.R;
    // the wax closes round each ball a little below its waist: a circle on the sphere, seen from just above → a flat ellipse
    const elev = r.range(0.12, 0.2), h = r.range(0.46, 0.6), rho = Math.sqrt(1 - h * h);
    out.push({ th, r: rad, pro: r.range(1.5, 4.5), tilt: r.range(-0.13, 0.13), elev, sink: h * Math.cos(elev), sa: rho, sb: rho * Math.sin(elev) * 1.15, tone: r.range(-0.02, 0.02), seed: out.length });
    prev = rad;
  }
  // compose: one pill just left of the crest
  let best = out[0];
  for (const p of out) if (Math.abs(p.th) < Math.abs(best.th)) best = p;
  const shift = -0.017 - best.th;
  for (const p of out) p.th += shift;
  return out;
}
/**
 * One wax-shell pill, shaded per pixel as a translucent sphere lit from behind and above (local frame: −y = out toward the lamp).
 * Light that has crossed the ball comes out warmer the longer its path, so the crown is cream and the foot glows orange;
 * the faint darker heart is the pill itself, seen through the hollow shell. Matte: no hard specular anywhere.
 */
function buildPill(p, lut) {
  const SS = 1.5, r = p.r, m = 3, half = r + m, N = Math.ceil(half * 2 * SS);
  const img = new ImageData(N, N), px = img.data;
  const nz = L.makeNoise('s02pill' + p.seed);
  // the seam: a great circle whose plane normal is "up", tipped toward the lens by elev and rolled by tilt
  const ce = Math.cos(p.elev), mx = ce * Math.sin(p.tilt), my = -ce * Math.cos(p.tilt), mz = Math.sin(p.elev);
  for (let j = 0; j < N; j++) {
    const y = ((j + 0.5) / SS - half) / r;
    for (let i = 0; i < N; i++) {
      const x = ((i + 0.5) / SS - half) / r, q = x * x + y * y;
      let cov = (1 - Math.sqrt(q)) * r * SS + 0.5;
      if (cov <= 0) continue; if (cov > 1) cov = 1;
      // the wax of the rim closes round the foot of the ball
      const ax = x / p.sa, yc = p.sink + (ax * ax < 1 ? p.sb * Math.sqrt(1 - ax * ax) : 0);
      let vis = ((yc - y) * r * SS) / 2.4 + 0.5;
      if (vis <= 0) continue; if (vis > 1) vis = 1;
      const z = q < 1 ? Math.sqrt(1 - q) : 0;
      const Ld = y * 0.62 + z * 0.785;                                    // > 0: the back light has to cross the ball to get here
      const direct = sstep(0.22, -0.5, Ld), trans = Math.exp(-2.3 * (Ld > 0 ? Ld : 0));
      let f = (-0.45 * x - 0.52 * y + 0.73 * z + 0.55) / 1.55; if (f < 0) f = 0;   // soft fill from the upper left
      let t = 0.48 + 0.26 * trans + 0.3 * f * f + 0.16 * direct + p.tone;
      t -= 0.22 * sstep(0.2, 0.95, y);                                     // the underside turns away from everything
      const hx = x - 0.03, hy = y - 0.1;
      t -= 0.07 * sstep(1, 0.2, Math.sqrt(hx * hx + hy * hy) / 0.62) * z;  // the pill inside
      t -= 0.16 * sstep(0.3, 0, yc - y);                                   // contact shadow where it sinks into the rim
      const sd = x * mx + y * my + z * mz;
      t -= 0.3 * (0.75 + 0.25 * nz.n2(x * 2.2 + 5, y * 2.2)) * Math.exp(-(sd * sd) / 0.00046);   // the seam …
      const e2 = sd - 0.052; t += 0.055 * Math.exp(-(e2 * e2) / 0.0011);                        // … and its lit lip
      t += 0.022 * nz.fbm(x * 3 + 9, y * 3 - 4, 2) + 0.009 * nz.n2(x * 15, y * 15 + 7);
      let li = (t * 1023) | 0; li = (li < 0 ? 0 : li > 1023 ? 1023 : li) * 3;
      const o = (j * N + i) * 4;
      px[o] = lut[li]; px[o + 1] = lut[li + 1]; px[o + 2] = lut[li + 2]; px[o + 3] = 255 * cov * vis;
    }
  }
  const c = L.makeCanvas(N, N);
  c.getContext('2d').putImageData(img, 0, 0);
  return { c, half };
}
/** the travelling highlight: a soft bloom on the crown plus a brighter back-lit edge (unit sprite, scaled per pill) */
function buildHighlight() {
  const N = 240, R = N / 2 - 4, img = new ImageData(N, N), px = img.data;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = (i + 0.5 - N / 2) / R, y = (j + 0.5 - N / 2) / R, q = x * x + y * y;
    if (q >= 1) continue;
    const z = Math.sqrt(1 - q), bx = x + 0.2, by = y + 0.5;
    let al = 0.95 * Math.pow(1 - z, 1.6) * sstep(0.25, -0.75, y) + 0.8 * Math.exp(-(bx * bx + by * by * 2.2) / 0.11);
    al = L.clamp(al) * L.clamp((1 - Math.sqrt(q)) * R);
    const o = (j * N + i) * 4;
    px[o] = 255; px[o + 1] = 247; px[o + 2] = 214; px[o + 3] = al * 255;
  }
  const c = L.makeCanvas(N, N);
  c.getContext('2d').putImageData(img, 0, 0);
  c._k = N / 2 / R;   // sprite half-size in pill radii
  return c;
}

// ── the raised rim with the pills in it ───────────────────────────────────────────────────────────
function buildTop(env, reg, pills, lut) {
  const a = env.arc, nA = L.makeNoise('s02c'), nB = L.makeNoise('s02d');
  const grid = polarGrid(env, reg, -2, LEDGE + 8, (U, d) => {
    let t = 0.46 + 0.52 * Math.exp(-(d < 0 ? 0 : d) / 7);                  // the thin edge lets the back light straight through
    t += -0.035 * sstep(18, 80, d) + 0.14 * sstep(LEDGE - 52, LEDGE - 3, d);             // shaded hollow, then the shelf front lifts into the light
    t += 0.05 * nA.fbm(U / 90 + 20, d / 60 + 9, 3) + 0.028 * nB.n2(U / 320, d / 5 + 3);
    const e = (d - LEDGE) / 2.3;
    return t + 0.36 * Math.exp(-e * e);                                    // bright front edge of the shelf
  });
  const c = rasterize(env, reg, grid, lut, 0, LEDGE + 5.5, 3.5);
  const g = c.getContext('2d');
  g.translate(-reg.x, -reg.y);
  const disc = (x, y, rad) => { g.beginPath(); g.arc(x, y, rad, 0, L.TAU); g.fill(); };

  g.save(); a.clipBelow(g, 0);
  // each pill sits in its own shaded socket
  g.globalCompositeOperation = 'multiply';
  for (const p of pills) a.at(g, p.th, 0, () => {
    const cy = p.r - p.pro + p.r * 0.1;
    g.fillStyle = L.radial(g, 0, cy, p.r * 0.8, p.r * 1.5, [[0, 'rgba(92,38,5,0.85)'], [1, 'rgba(92,38,5,0)']]);
    disc(0, cy, p.r * 1.5);
  });
  // back light pouring through the gaps between the pills
  g.globalCompositeOperation = 'screen';
  for (let i = 0; i < pills.length - 1; i++) {
    const p0 = pills[i], p1 = pills[i + 1];
    const e0 = p0.th + p0.r / a.R, e1 = p1.th - p1.r / a.R, hw = ((e1 - e0) * a.R) / 2;
    a.at(g, (e0 + e1) / 2, 0, () => {
      g.scale((hw + 26) / 100, 1.05);
      g.fillStyle = L.radial(g, 0, 2, 0, 100, [[0, 'rgba(255,224,124,0.9)'], [0.32, 'rgba(255,188,62,0.42)'], [1, 'rgba(240,150,30,0)']]);
      disc(0, 2, 100);
    });
  }
  // shadows thrown toward the lens, straight down the cake …
  g.globalCompositeOperation = 'multiply';
  for (const p of pills) a.at(g, p.th, 0, () => {
    const by = p.r - p.pro + (p.sink + p.sb) * p.r;         // lowest point of the seat line
    g.translate(0, by + p.r * 0.1); g.scale(p.r / 100, (p.r * 1.95) / 100);
    g.fillStyle = L.radial(g, 0, 0, 0, 100, [[0, 'rgba(96,42,6,0.7)'], [0.45, 'rgba(110,52,8,0.38)'], [1, 'rgba(124,62,10,0)']]);
    disc(0, 0, 100);
  });
  // … each with a pool of warm light in it that came through the ball
  g.globalCompositeOperation = 'screen';
  for (const p of pills) a.at(g, p.th, 0, () => {
    const by = p.r - p.pro + (p.sink + p.sb) * p.r;
    g.translate(0, by + p.r * 0.1); g.scale((p.r * 0.6) / 100, (p.r * 0.36) / 100);
    g.fillStyle = L.radial(g, 0, 0, 0, 100, [[0, 'rgba(255,150,40,0.6)'], [0.5, 'rgba(250,130,30,0.25)'], [1, 'rgba(240,120,20,0)']]);
    disc(0, 0, 100);
  });
  g.restore();

  // the pills, then the wax meniscus that climbs each one
  for (const p of pills) a.at(g, p.th, 0, () => {
    const sp = buildPill(p, S.shellLut);
    g.drawImage(sp.c, -sp.half, p.r - p.pro - sp.half, sp.half * 2, sp.half * 2);
    const cy = p.r - p.pro + p.sink * p.r;
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(255,196,96,0.2)'; g.lineWidth = 5;
    g.beginPath(); g.ellipse(0, cy + 3, p.sa * p.r, p.sb * p.r, 0, 0.45, Math.PI - 0.45); g.stroke();
    g.strokeStyle = 'rgba(255,214,128,0.42)'; g.lineWidth = 1.3;
    g.beginPath(); g.ellipse(0, cy + 1.8, p.sa * p.r, p.sb * p.r, 0, 0.45, Math.PI - 0.45); g.stroke();
  });
  return c;
}

/** bloom: only the hot parts of the rim (lip, pill crowns, shelf edge), blurred wide at half size */
function buildBloom(reg, top) {
  const up = 110, k = 0.5;
  const c = L.makeCanvas(reg.w * k, (reg.h + up) * k), g = c.getContext('2d');
  g.filter = 'brightness(0.62) contrast(2.6) blur(9px)';
  g.drawImage(top, 0, up * k, reg.w * k, reg.h * k);
  g.filter = 'none';
  return { c, x: reg.x, y: reg.y - up, w: reg.w, h: reg.h + up };
}

// ── dust in the black ─────────────────────────────────────────────────────────────────────────────
function dustSprite(stops) {
  const c = L.makeCanvas(64, 64), g = c.getContext('2d');
  g.fillStyle = L.radial(g, 32, 32, 0, 32, stops); g.fillRect(0, 0, 64, 64);
  return c;
}
function buildDust(env) {
  const a = env.arc, r = L.rng('s02dust'), out = [];
  for (let guard = 0; out.length < 76 && guard < 3000; guard++) {
    const x = r.range(-40, W + 40), y = r.range(-30, 760);
    const top = a.yAt(L.clamp(x, 0, W));
    if (y > top - 26) continue;
    // keep the pocket above the crest almost empty
    const ex = (x - a.cx) / 440, ey = (y - (a.crestY - 150)) / 215;
    if (ex * ex + ey * ey < 1 && !r.chance(0.1)) continue;
    const big = r.chance(0.13);
    const s = big ? r.range(13, 30) : r.range(5, 13) * (r.chance(0.22) ? 2 : 1);
    const lit = 0.5 + 0.5 * Math.exp(-(top - y) / 280);       // motes near the rim catch more of the back light
    out.push({ x, y, s, big, a: (big ? r.range(0.07, 0.17) : r.range(0.35, 1) * (s > 13 ? 0.45 : 1)) * lit,
      rise: (big ? 26 : 9) + s * r.range(0.4, 1.1), sway: r.range(-5, 5), ph: r(), fq: r.range(0.55, 1.6) });
  }
  return out;
}

export default {
  name: '蜡丸',
  tone: 'light',
  init(env) {
    const a = env.arc;
    const y0 = Math.floor(a.crestY) - 12;
    const reg = { x: -PAD, y: y0, w: W + PAD * 2, h: H + PADB - y0 };
    S = { reg, shellLut: toneLut(SHELL) };
    const waxLut = toneLut(WAX);
    S.pills = layoutPills(env);
    S.body = buildBody(env, reg, waxLut);
    S.top = buildTop(env, reg, S.pills, waxLut);
    S.bloom = buildBloom(reg, S.top);
    S.hl = buildHighlight();
    S.dust = buildDust(env);
    S.pt = dustSprite([[0, 'rgba(255,247,224,1)'], [0.16, 'rgba(255,232,170,0.8)'], [0.45, 'rgba(250,200,110,0.16)'], [1, 'rgba(250,190,90,0)']]);
    S.bokeh = dustSprite([[0, 'rgba(255,224,150,0.5)'], [0.7, 'rgba(255,214,130,0.5)'], [0.86, 'rgba(255,224,156,0.66)'], [1, 'rgba(255,210,120,0)']]);
  },
  draw(ctx, env, p) {
    const a = env.arc, reg = S.reg;
    const rot = L.lerp(-0.011, 0.011, p);       // pills and rim slide along the arc
    const sw = L.lerp(-0.37, 0.37, p);          // where the travelling light is (theta on screen)
    ctx.fillStyle = '#050403'; ctx.fillRect(0, 0, W, H);
    // the back light catching the air just over the rim
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = L.radial(ctx, a.cx, a.cy, a.R - 2, a.R + 120, [[0, 'rgba(255,160,40,0.36)'], [0.12, 'rgba(232,120,20,0.17)'], [0.42, 'rgba(170,76,10,0.045)'], [1, 'rgba(110,44,4,0)']]);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    // dust: drifts up, flickers
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const m of S.dust) {
      const tw = 0.5 + 0.5 * Math.sin(L.TAU * (m.ph + p * m.fq));
      const x = m.x + m.sway * Math.sin(L.TAU * (m.ph * 3 + p * 0.5)), y = m.y - m.rise * p;
      ctx.globalAlpha = m.a * (0.4 + 0.6 * tw);
      ctx.drawImage(m.big ? S.bokeh : S.pt, x - m.s, y - m.s, m.s * 2, m.s * 2);
    }
    ctx.restore();
    // the cake: its rings lie inside the wax, so they turn less than the rim
    L.cam(ctx, env, { rot: rot * 0.6 }, () => ctx.drawImage(S.body, reg.x, reg.y));
    ctx.save(); a.clipBelow(ctx, -LEDGE); ctx.globalCompositeOperation = 'soft-light';
    const sp = a.pt(sw, -330);
    ctx.fillStyle = L.radial(ctx, sp.x, sp.y, 0, 540, [[0, 'rgba(255,240,190,0.5)'], [1, 'rgba(255,240,190,0)']]);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    // the rim and its pills, the highlight passing over one crown after another, and the bloom
    L.cam(ctx, env, { rot }, () => {
      ctx.drawImage(S.top, reg.x, reg.y);
      ctx.globalCompositeOperation = 'screen';
      for (const q of S.pills) {
        const u = (q.th + rot - sw) / 0.085, w = Math.exp(-u * u);
        if (w < 0.02) continue;
        const s = q.r * S.hl._k;
        a.at(ctx, q.th, 0, () => { ctx.globalAlpha = 0.85 * w; ctx.drawImage(S.hl, -s, q.r - q.pro - s, s * 2, s * 2); });
      }
      ctx.globalAlpha = 0.55;
      ctx.drawImage(S.bloom.c, S.bloom.x, S.bloom.y, S.bloom.w, S.bloom.h);
    });
    // a glint riding the lip with the light
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    a.at(ctx, sw, 0, () => {
      ctx.scale(3.4, 0.52);
      ctx.fillStyle = L.radial(ctx, 0, 0, 0, 100, [[0, 'rgba(255,214,130,0.3)'], [0.4, 'rgba(255,176,70,0.11)'], [1, 'rgba(240,140,30,0)']]);
      ctx.fillRect(-100, -100, 200, 200);
    });
    ctx.restore();
    L.vignette(ctx, { strength: 0.3 });
  },
};
