// s33 — 打树花·城门. Night, in front of an old fort gate: a ladle of molten iron has just been flung against the
// wall above the gateway and bursts into a tree-crown of gold and red sparks.
// The arc = the edge of the gate's brick arch (券脸), its arris picked out by firelight. Above it: the black wall,
// peppered with glowing spatter; below it: the pitch-black gate passage, sparks raining down onto a bed of embers.
//
// Recipe: everything that does not move (lit brickwork, arch ring, ember bed, baked spatter) is rendered ONCE into a
// pixel buffer in init(). Every frame copies that buffer and plots ~45 000 particles straight into it, additively:
// shimmering spatter, airborne dust, spark streaks and soft foreground sparks — each one advancing along its own
// ballistic path with p (seeded, fully deterministic). One putImageData puts the frame on screen.
import * as L from '../lib/core.js';

const { W, H } = L;
const T = 40;                   // brick thickness (px): wall course height and voussoir pitch along the arc
const RING1 = 80;               // 券 — bricks set on end, radially
const RING2 = 40;               // 伏 — bricks laid flat, following the curve
const RING = RING1 + RING2;
const JOINT = 5;                // mortar joint
const IMP = { x: 985, y: 92 };  // where the molten iron hits the wall
const GRAV = 1500;              // px / sim-s²
const SIMT = 0.135;             // sim-seconds covered by the whole shot
const EXPO = 0.021;             // "shutter time" → streak length ≈ one frame of travel
const HEAPX = 1060;
let S = null;

// black → ember → red → orange → gold (the only colours in this shot)
const HEAT = [[0, '#040303'], [0.05, '#150504'], [0.14, '#3d0b07'], [0.28, '#8a140c'], [0.45, '#cc2412'], [0.6, '#ff3b1f'], [0.78, '#ff9a2a'], [1, '#ffe08a']];
const SPARK = [[0, '#4a0b07'], [0.22, '#8a140c'], [0.5, '#ff3b1f'], [0.76, '#ff9a2a'], [1, '#ffe08a']];

// float spark colours for the pixel plotter; values above 255 overexpose toward white-gold
const NLUT = 64;
const SLUT = new Float32Array(NLUT * 3);
{
  const ts = [0, 0.25, 0.5, 0.75, 1], cs = [[64, 9, 5], [150, 22, 12], [255, 62, 28], [305, 152, 46], [335, 265, 165]];
  for (let i = 0; i < NLUT; i++) {
    const h = i / (NLUT - 1); let k = 0; while (k < 3 && h > ts[k + 1]) k++;
    const u = (h - ts[k]) / (ts[k + 1] - ts[k]);
    for (let c = 0; c < 3; c++) SLUT[i * 3 + c] = cs[k][c] + (cs[k + 1][c] - cs[k][c]) * u;
  }
}
const lutIndex = (heat) => Math.round(L.clamp(heat) * (NLUT - 1)) * 3;
// small gaussian used as the glow round a white-hot spark head
const KR = 4, KS = KR * 2 + 1;
const KERN = new Float32Array(KS * KS);
for (let j = 0; j < KS; j++) for (let i = 0; i < KS; i++) { const d2 = (i - KR) * (i - KR) + (j - KR) * (j - KR); KERN[j * KS + i] = Math.exp(-d2 / 5.2); }

function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** 1 inside the tagline zone above the crest, falling softly to 0 around it */
function zoneMask(x, y, crestY) {
  const dx = Math.abs(x - 960) / 425, dy = Math.abs(y - (crestY - 135)) / 160;
  if (dx > 1.31 || dy > 1.31) return 0;
  const dx2 = dx * dx, dy2 = dy * dy;
  const d = Math.sqrt(Math.sqrt(dx2 * dx2 + dy2 * dy2));
  return 1 - L.smooth((d - 0.8) / 0.5);
}
/** rough density of the falling canopy at a wall point (two lobes either side of the impact) */
function canopy(x, y) {
  const dx = Math.abs(x - IMP.x) - 560, dy = y - IMP.y - 230;
  return Math.exp(-(dx * dx) / 176400 - (dy * dy) / 108900);
}

// ───────────────────────── pixel plotting (additive, into a Uint8ClampedArray) ─────────────────────────
function plot(d, w, h, x, y, r, g, b) {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const i = (y * w + x) * 4;
  d[i] += r; d[i + 1] += g; d[i + 2] += b; d[i + 3] = 255;
}
function grain(d, w, h, x, y, c, k, size) {
  plot(d, w, h, x, y, c[0] * k, c[1] * k, c[2] * k);
  if (size >= 1) { plot(d, w, h, x + 1, y, c[0] * k * 0.6, c[1] * k * 0.6, c[2] * k * 0.6); plot(d, w, h, x, y + 1, c[0] * k * 0.6, c[1] * k * 0.6, c[2] * k * 0.6); }
  if (size >= 2) { plot(d, w, h, x - 1, y, c[0] * k * 0.6, c[1] * k * 0.6, c[2] * k * 0.6); plot(d, w, h, x, y - 1, c[0] * k * 0.6, c[1] * k * 0.6, c[2] * k * 0.6); plot(d, w, h, x, y, 90, 80, 50); }
}
/** bilinear point: sub-pixel positions move smoothly from frame to frame */
function splat(d, x, y, r, g, b) {
  const xi = Math.floor(x), yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= W - 1 || yi >= H - 1) return;
  const fx = x - xi, fy = y - yi, gx = 1 - fx, gy = 1 - fy;
  let i = (yi * W + xi) << 2, w = gx * gy;
  d[i] += r * w; d[i + 1] += g * w; d[i + 2] += b * w;
  w = fx * gy; d[i + 4] += r * w; d[i + 5] += g * w; d[i + 6] += b * w;
  i += W << 2; w = gx * fy;
  d[i] += r * w; d[i + 1] += g * w; d[i + 2] += b * w;
  w = fx * fy; d[i + 4] += r * w; d[i + 5] += g * w; d[i + 6] += b * w;
}
/** a spark streak: dim, cool tail → bright, hot head; wid 1/2 swell the leading half into a teardrop */
function streak(d, tx, ty, hx, hy, ti, hi, k, wid) {
  const dx = hx - tx, dy = hy - ty, len = Math.sqrt(dx * dx + dy * dy);
  const n = len < 1 ? 1 : Math.ceil(len), inv = 1 / n;
  const r0 = SLUT[ti], g0 = SLUT[ti + 1], b0 = SLUT[ti + 2];
  const r1 = SLUT[hi] - r0, g1 = SLUT[hi + 1] - g0, b1 = SLUT[hi + 2] - b0;
  let px = 0, py = 0;
  if (wid) { const il = 0.8 / (len || 1); px = -dy * il; py = dx * il; }
  for (let j = 0; j <= n; j++) {
    const t = j * inv, w = k * (0.07 + 0.93 * t * t);
    const x = tx + dx * t, y = ty + dy * t;
    const r = (r0 + r1 * t) * w, g = (g0 + g1 * t) * w, b = (b0 + b1 * t) * w;
    splat(d, x, y, r, g, b);
    if (wid) {
      const s = 0.75 * t;
      splat(d, x + px, y + py, r * s, g * s, b * s); splat(d, x - px, y - py, r * s, g * s, b * s);
      if (wid > 1) {
        const s2 = (wid > 2 ? 0.7 : 0.4) * t; splat(d, x + 2 * px, y + 2 * py, r * s2, g * s2, b * s2); splat(d, x - 2 * px, y - 2 * py, r * s2, g * s2, b * s2);
        if (wid > 2) { const s3 = 0.4 * t * t; splat(d, x + 3.2 * px, y + 3.2 * py, r * s3, g * s3, b * s3); splat(d, x - 3.2 * px, y - 3.2 * py, r * s3, g * s3, b * s3); }
      }
    }
  }
}
function glowK(d, x, y, ci, k) {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi < KR || yi < KR || xi >= W - KR || yi >= H - KR) return;
  const r = SLUT[ci] * k, g = SLUT[ci + 1] * k, b = SLUT[ci + 2] * k;
  for (let j = 0; j < KS; j++) {
    let i = ((yi + j - KR) * W + xi - KR) << 2;
    for (let q = 0; q < KS; q++, i += 4) { const w = KERN[j * KS + q]; d[i] += r * w; d[i + 1] += g * w; d[i + 2] += b * w; }
  }
}
/** out-of-focus spark: a soft-edged disc of light */
function disc(d, cx, cy, rad, r, g, b) {
  const x0 = Math.max(0, Math.floor(cx - rad - 1)), x1 = Math.min(W - 1, Math.ceil(cx + rad + 1));
  const y0 = Math.max(0, Math.floor(cy - rad - 1)), y1 = Math.min(H - 1, Math.ceil(cy + rad + 1));
  const soft = 1 / (rad * 0.5);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dd = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
    let w = (rad - dd) * soft; if (w <= 0) continue; if (w > 1) w = 1;
    w = w * w * (3 - 2 * w);
    const i = (y * W + x) << 2;
    d[i] += r * w; d[i + 1] += g * w; d[i + 2] += b * w;
  }
}

// ───────────────────────── spark ballistics ─────────────────────────
// A spark leaves the impact point with velocity (vx, vy), feels gravity and linear air drag k:
// it shoots out, slows, then falls almost straight down — which is what gives 打树花 its willow / tree-crown outline.
function flightAt(s, tau, out) {
  if (tau < 0) tau = 0;
  const e = Math.exp(-s.k * tau), q = (1 - e) / s.k;
  out[0] = IMP.x + s.vx * q;
  out[1] = IMP.y + s.vy * q + (GRAV / s.k) * (tau - q);
}
function sampleCanopy(r) {
  const side = r.chance(0.52) ? -1 : 1;
  const u = r();
  const el = L.deg(u < 0.14 ? r.range(-50, -6) : u < 0.82 ? r.range(-6, 46) : r.range(46, 84)); // elevation above horizontal
  const v = 420 + 1500 * Math.pow(r(), 1.25);
  return { vx: side * v * Math.cos(el), vy: -v * Math.sin(el), k: r.range(0.95, 2.1), tau0: 0.03 + 2.6 * Math.pow(r(), 1.3) };
}
function sampleCore(r) {
  let ang = r.range(0, L.TAU);
  if (Math.sin(ang) > 0.45 && r.chance(0.8)) ang = -ang; // most of the splash goes up and sideways
  const v = 900 + 1700 * r();
  return { vx: v * Math.cos(ang), vy: v * Math.sin(ang), k: r.range(1.2, 2.4), tau0: 0.004 + 0.3 * Math.pow(r(), 1.5) };
}

function buildSparks(env, heapTop) {
  const crest = env.arc.crestY;
  const r = L.rng('s33sparks');
  const list = [];
  const P = [0, 0];
  const add = (s, heat) => {
    s.hi = lutIndex(heat); s.ti = lutIndex(heat * 0.42);
    const q = r();
    s.wid = q < 0.6 - heat * 0.2 ? 0 : q < 0.88 - heat * 0.1 ? 1 : 2;
    s.gain = r.range(0.75, 1.25) * (s.wid ? 1.1 : 1.3);
    s.hot = heat > 0.78 && s.wid > 0;
    s.u = r(); s.ex = r.range(0.7, 1.5); s.fork = heat > 0.5 && r.chance(0.03); s.seed = r.int(0, 99999);
    list.push(s);
  };
  // the canopy: sparks of every age between the impact and the ground
  for (let n = 0, tries = 0; n < 4300 && tries < 90000; tries++) {
    const s = sampleCanopy(r); s.type = 0;
    flightAt(s, s.tau0 + SIMT * 0.5, P);
    if (P[0] < -60 || P[0] > W + 60 || P[1] < -60 || P[1] > H + 60) continue;
    if (r() < zoneMask(P[0], P[1], crest) * 0.9) continue;
    add(s, L.clamp(1.1 - s.tau0 / 2.1 + r.range(-0.22, 0.22))); n++;
  }
  // the fresh splash right at the impact: young, fast, white-hot
  for (let n = 0; n < 1150; n++) { const s = sampleCore(r); s.type = 0; add(s, L.clamp(1.1 - s.tau0 * 0.8 + r.range(-0.25, 0.1))); }
  // heavy gobs of molten iron: slower, barely braked by the air, trailing long tails
  for (let n = 0, tries = 0; n < 64 && tries < 2000; tries++) {
    const s = sampleCore(r); s.type = 0;
    const slow = r.range(0.32, 0.62); s.vx *= slow; s.vy *= slow; s.k = r.range(0.55, 1.0); s.tau0 = 0.05 + 0.55 * r();
    flightAt(s, s.tau0 + SIMT, P);
    if (Math.abs(P[0] - 960) < 470 && P[1] > 215) continue;   // their long tails must never trail through the tagline
    add(s, 1); n++; s.wid = 3; s.gain = 1.5; s.hot = true; s.glob = true; s.ex = r.range(3, 5); s.fork = false;
  }
  // rain: cooled sparks from the previous throw, falling at terminal speed in front of the gateway
  for (let n = 0; n < 950; n++) {
    const s = { type: 1, x: r.range(-40, W + 40), y: crest - 230 + (H - crest + 290) * Math.pow(r(), 0.8), vx: r.range(-70, 70), vy: r.range(600, 1080) };
    add(s, 0.12 + 0.78 * Math.pow(r(), 1.7));
  }
  // sparks bouncing off the ember bed
  for (let n = 0; n < 300; n++) {
    const x = L.clamp(HEAPX + r.gauss() * 400, 10, W - 10);
    const ang = L.deg(-90 + r.gauss() * 34), v = r.range(140, 640);
    const s = { type: 2, x, y: heapTop[Math.round(x)] - 2, vx: v * Math.cos(ang), vy: v * Math.sin(ang) };
    s.tau0 = r.range(0, (-2 * s.vy / GRAV) * 0.95);
    add(s, r.range(0.35, 0.95));
  }
  return list;
}

// ───────────────────────── the wall ─────────────────────────
const voussoirStep = (a) => T / a.R;
const voussoirT0 = (a, i) => (i + 0.37) * voussoirStep(a);

/** greyscale height map: bricks high, mortar joints and the gate opening low */
function buildHeight(env) {
  const a = env.arc;
  const c = L.makeCanvas(W, H), g = c.getContext('2d');
  const r = L.rng('s33brick');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  // horizontal wall courses: big grey city-wall bricks, stretchers with the odd header
  const yMax = a.yAt(0) + 10;
  for (let row = -1; row * T + 14 < yMax; row++) {
    const y = row * T + 14;
    let x = -r.range(0, 4 * T) - 20;
    while (x < W + 20) {
      const len = r.chance(0.28) ? 2 * T : 4 * T;
      const v = Math.round(r.range(140, 215));
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x + JOINT / 2, y + JOINT / 2, len - JOINT, T - JOINT);
      x += len;
    }
  }
  // the arch ring replaces the courses next to the opening
  g.fillStyle = '#000'; a.pathBand(g, RING + JOINT / 2, -4); g.fill();
  const s = a.span(80), dth = voussoirStep(a), n = Math.ceil(s / dth) + 1, gap = (JOINT * 0.45) / a.R;
  for (let i = -n; i < n; i++) {           // 券: one brick-thickness wide, standing radially
    const t0 = voussoirT0(a, i);
    const v = Math.round(r.range(150, 222));
    g.fillStyle = `rgb(${v},${v},${v})`;
    a.pathBand(g, RING1 - JOINT / 2, r.range(0, 1.2), t0 + gap, t0 + dth - gap); g.fill();
  }
  const dth2 = (4 * T) / a.R;
  for (let t = -s - r.range(0, dth2); t < s;) {   // 伏: bricks lying along the curve
    const len = dth2 * (r.chance(0.22) ? 0.5 : 1);
    const v = Math.round(r.range(140, 210));
    g.fillStyle = `rgb(${v},${v},${v})`;
    a.pathBand(g, RING - JOINT / 2, RING1 + JOINT / 2, t + gap, t + len - gap); g.fill();
    t += len;
  }
  a.fillBelow(g, '#000', 0);
  // weathering: pitted faces + broad unevenness (joints stay black under 'overlay')
  g.globalCompositeOperation = 'overlay';
  g.globalAlpha = 0.6; g.drawImage(L.noiseTex(W, H, { seed: 's33pit', scale: 10, octaves: 3, res: 0.5, contrast: 1.8 }), 0, 0);
  g.globalAlpha = 0.5; g.drawImage(L.noiseTex(W, H, { seed: 's33mot', scale: 150, octaves: 3, res: 0.2, contrast: 1.5 }), 0, 0);
  return L.blurred(c, 1.2);
}

/** light the height map with a point light at the impact (grazing along the wall) + the ember light on the arch ring */
function buildWall(env, height) {
  const a = env.arc, crest = a.crestY;
  const hd = height.getContext('2d').getImageData(0, 0, W, H).data;
  const img = new ImageData(W, H), o = img.data;
  const ramp = L.makeRamp(HEAT);
  const lut = new Uint8ClampedArray(1024 * 3);
  for (let i = 0; i < 1024; i++) { const c = ramp(i / 1023); lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2]; }
  const K = 6 / 255, R0 = 105 * 105;
  for (let y = 0; y < H; y++) {
    const ym = y > 0 ? y - 1 : 0, yp = y < H - 1 ? y + 1 : y;
    const ey = y - a.cy, ly = IMP.y - y;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const ex = x - a.cx;
      const rr = Math.sqrt(ex * ex + ey * ey), dr = rr - a.R;
      o[i + 3] = 255;
      if (dr <= -0.5) { o[i] = 3; o[i + 1] = 2; o[i + 2] = 2; continue; }
      const h = hd[i];
      const gx = hd[(y * W + (x < W - 1 ? x + 1 : x)) * 4] - hd[(y * W + (x > 0 ? x - 1 : x)) * 4];
      const gy = hd[(yp * W + x) * 4] - hd[(ym * W + x) * 4];
      const lx = IMP.x - x;
      const r2 = lx * lx + ly * ly, r1 = Math.sqrt(r2) + 0.001;
      const rel = -((gx * lx + gy * ly) / r1) * K;      // slopes that face the burst light up
      const fall = 1 / (1 + r2 / R0);
      const alb = 0.3 + 0.7 * (h / 255);
      const albN = alb + (1 - alb) * 0.75 * fall * fall;   // right at the impact the iron runs into the joints too
      let lum = albN * 1.3 * fall * Math.max(0, 0.42 + rel * (1 - 0.6 * fall));
      lum += alb * (0.02 + 0.1 * canopy(x, y)) * Math.max(0, 0.6 + rel * 0.8);
      if (dr < RING + 40) {
        const rel2 = ((gx * ex + gy * ey) / rr) * K;     // lit from below, by the embers in the gateway
        lum += alb * (0.2 * Math.exp(-dr / 42) + 0.5 * Math.exp(-dr / 4.5)) * Math.max(0, 0.55 + rel2);
      }
      if (x > 400 && x < 1520 && y > 200) lum *= 1 - 0.62 * zoneMask(x, y, crest);
      if (dr < 0.5) lum *= dr + 0.5;
      lum += (hash2(x, y) - 0.5) * 0.008;
      const li = (lum <= 0 ? 0 : lum >= 1 ? 1023 : (lum * 1023) | 0) * 3;
      o[i] = lut[li]; o[i + 1] = lut[li + 1]; o[i + 2] = lut[li + 2];
    }
  }
  const c = L.makeCanvas(W, H);
  c.getContext('2d', { willReadFrequently: true }).putImageData(img, 0, 0);
  return c;
}

/** a hint of the barrel vault receding into the passage: just the lip of the brick soffit inside the arris */
function drawSoffit(g, env) {
  const a = env.arc;
  g.save(); a.clipBelow(g, -1.5);
  g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 70, a.R, [[0, 'rgba(120,20,10,0)'], [0.5, 'rgba(130,22,10,0.05)'], [0.85, 'rgba(150,26,12,0.15)'], [1, 'rgba(170,34,14,0.3)']]);
  g.fillRect(0, 0, W, H);
  const s = a.span(80), dth = voussoirStep(a), n = Math.ceil(s / dth) + 1;
  g.strokeStyle = 'rgba(0,0,0,0.8)'; g.lineWidth = 2.2;
  for (let i = -n; i < n; i++) {
    const t0 = voussoirT0(a, i);
    const p0 = a.pt(t0, -2), p1 = a.pt(t0 * 0.994, -72);   // longitudinal joints head for the vanishing point
    g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke();
    a.stroke(g, i & 1 ? -46 : -24, t0, t0 + dth);
  }
  g.restore();
}

/** the fire-lit arris of the arch: one short bright stroke per voussoir, sitting exactly on the arc */
function drawArris(g, env, hotOnly) {
  const a = env.arc;
  const nz = L.makeNoise('s33arris'), r = L.rng('s33arris');
  const ramp = L.makeRamp([[0, '#a81c0e'], [0.45, '#ff4a1f'], [0.75, '#ff9a2a'], [1, '#ffdc8c']]);
  const s = a.span(80), dth = voussoirStep(a), n = Math.ceil(s / dth) + 1, gap = 1.4 / a.R;
  g.save(); g.lineCap = 'butt';
  for (let i = -n; i < n; i++) {
    const t0 = voussoirT0(a, i), tm = t0 + dth / 2;
    const xr = (tm * a.R) / 620;
    let heat = L.clamp(0.62 + 0.3 * nz.n2(i * 0.23, 1.7) + 0.16 * nz.n2(i * 1.9, 7.1) + 0.2 * Math.exp(-xr * xr), 0.42, 1);
    let ta = t0 + gap, tb = t0 + dth - gap;
    if (r() < 0.1) { if (r.chance(0.5)) ta += dth * r.range(0.2, 0.45); else tb -= dth * r.range(0.2, 0.45); heat *= 0.85; }
    const jig = r.range(0, 0.7);
    if (!hotOnly) { g.strokeStyle = L.css(ramp(heat * 0.55)); g.lineWidth = 5; g.globalAlpha = 0.6; a.stroke(g, 2.5 + jig, ta, tb); }
    g.strokeStyle = L.css(ramp(heat)); g.lineWidth = 3.6; g.globalAlpha = 1; a.stroke(g, 1.8 + jig, ta, tb);
    g.strokeStyle = L.css(ramp(Math.min(1, heat + 0.25))); g.lineWidth = 1.5; g.globalAlpha = 0.9; a.stroke(g, 1.1 + jig, ta + gap, tb - gap);
  }
  g.restore();
}

/** long-exposure ghosts of the spark paths: gives the burst its willow-branch structure even in a single frame */
function buildTrails(env) {
  const a = env.arc, crest = a.crestY;
  const c = L.makeCanvas(W, H), g = c.getContext('2d');
  const r = L.rng('s33trails'), P = [0, 0];
  const ramp = L.makeRamp(SPARK);
  const cols = []; for (let i = 0; i < 16; i++) cols.push(L.css(ramp(i / 15)));
  g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  for (let i = 0; i < 170; i++) {
    const s = sampleCanopy(r); s.k = r.range(0.95, 1.7);
    const tMax = r.range(1.0, 2.2), a0 = r.range(0.1, 0.32), lw = r.range(0.9, 1.8);
    let px = 0, py = 0;
    for (let t = 0.03, j = 0; t <= tMax; t += 0.022, j++) {
      flightAt(s, t, P);
      if (j > 0 && P[1] > -40 && P[1] < H + 40) {
        const u = t / tMax;
        let al = a0 * Math.pow(1 - u, 0.7) * (1 - 0.95 * zoneMask(P[0], P[1], crest)) * L.smooth(a.drAt(P[0], P[1]) / 90);
        al *= hash2(i * 31 + (j >> 1), 77) < 0.42 ? 0.12 : 1;       // broken, sputtering lines
        if (al > 0.004) {
          g.globalAlpha = al; g.strokeStyle = cols[Math.round(15 * L.clamp(1 - u * 0.95))]; g.lineWidth = lw;
          g.beginPath(); g.moveTo(px, py); g.lineTo(P[0], P[1]); g.stroke();
        }
      }
      px = P[0]; py = P[1];
    }
  }
  return c;
}

/** the molten iron itself: a white-hot splat smeared over the bricks, thrown-out fingers, beads of metal around it */
function drawSplat(g) {
  const r = L.rng('s33splat');
  const nz = L.makeNoise('s33splat');
  g.save(); g.globalCompositeOperation = 'lighter';
  // the glare washes out the brick joints right at the impact
  g.fillStyle = L.radial(g, IMP.x, IMP.y, 0, 230, [[0, 'rgba(255,150,50,0.75)'], [0.3, 'rgba(255,90,30,0.4)'], [0.65, 'rgba(200,40,16,0.12)'], [1, 'rgba(160,26,12,0)']]);
  g.fillRect(IMP.x - 240, IMP.y - 240, 480, 480);
  for (let i = 0; i < 34; i++) {
    const ang = r.range(0, L.TAU), down = Math.sin(ang) > 0.3;
    const len = r.range(50, 185) * (down ? 0.5 : 1), w = r.range(2.5, 8);
    const cx = Math.cos(ang), sy = Math.sin(ang);
    const x1 = IMP.x + cx * len, y1 = IMP.y + sy * len;
    g.fillStyle = L.linear(g, IMP.x, IMP.y, x1, y1, [[0, 'rgba(255,236,170,0.95)'], [0.4, 'rgba(255,150,40,0.75)'], [1, 'rgba(255,50,20,0)']]);
    g.beginPath(); g.moveTo(IMP.x - sy * w, IMP.y + cx * w); g.quadraticCurveTo(IMP.x + cx * len * 0.5, IMP.y + sy * len * 0.5, x1, y1);
    g.quadraticCurveTo(IMP.x + cx * len * 0.5, IMP.y + sy * len * 0.5, IMP.x + sy * w, IMP.y - cx * w); g.closePath(); g.fill();
  }
  // beads of iron stuck to the wall round the splash, stretched along the direction they flew
  for (let i = 0; i < 150; i++) {
    const ang = r.range(0, L.TAU), dist = 30 + 210 * Math.pow(r(), 1.5) * (Math.sin(ang) > 0.35 ? 0.6 : 1);
    const x = IMP.x + Math.cos(ang) * dist, y = IMP.y + Math.sin(ang) * dist;
    const rad = r.range(1.2, 4.2) * (1 - dist / 420), hot = 1 - dist / 300;
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = L.radial(g, 0, 0, 0, rad * 2.2, [[0, hot > 0.5 ? 'rgba(255,240,196,0.95)' : 'rgba(255,190,96,0.9)'], [0.4, 'rgba(255,130,40,0.6)'], [1, 'rgba(255,50,20,0)']]);
    g.scale(r.range(1.3, 2.6), 1); g.beginPath(); g.arc(0, 0, rad * 2.2, 0, L.TAU); g.fill();
    g.restore();
  }
  g.fillStyle = L.radial(g, IMP.x, IMP.y, 4, 70, [[0, '#fff6dc'], [0.4, '#ffd27a'], [0.72, 'rgba(255,138,42,0.85)'], [1, 'rgba(255,60,20,0)']]);
  g.beginPath();
  for (let i = 0; i <= 72; i++) {
    const ang = (i / 72) * L.TAU, rad = 46 + 20 * nz.n2(Math.cos(ang) * 1.6, Math.sin(ang) * 1.6) + 8 * nz.n2(Math.cos(ang) * 6, Math.sin(ang) * 6 + 9);
    const x = IMP.x + Math.cos(ang) * rad, y = IMP.y + Math.sin(ang) * rad * 0.86;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath(); g.fill();
  g.restore();
}

// ───────────────────────── embers, glitter, dust ─────────────────────────
/** the bed of embers along the bottom of frame, mounded where the rain of sparks piles up */
function buildHeap() {
  const y0 = 850, hh = H - y0;
  const nz = L.makeNoise('s33heap');
  const top = new Float32Array(W + 1), mnd = new Float32Array(W + 1);
  for (let x = 0; x <= W; x++) {
    const u = (x - HEAPX) / 800;
    mnd[x] = Math.pow(Math.max(0, 1 - u * u), 1.6);
    top[x] = H - 24 - 140 * mnd[x] - 16 * nz.fbm(x / 120, 3.3, 3) - 5 * nz.n2(x / 15, 8.1);
  }
  const fw = W >> 1, fh = (hh >> 1) + 1;
  const heatF = new Float32Array(fw * fh), crackF = new Float32Array(fw * fh);
  for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) {
    const x = i * 2, y = y0 + j * 2;
    heatF[j * fw + i] = nz.fbm(x / 170, y / 80, 3);
    crackF[j * fw + i] = nz.ridged(x / 52, y / 34 + 40, 3);
  }
  const ramp = L.makeRamp(HEAT);
  const img = new ImageData(W, hh), d = img.data;
  for (let y = 0; y < hh; y++) for (let x = 0; x < W; x++) {
    const yy = y0 + y, dep = yy - top[x];
    const hs = hash2((x + ((yy >> 1) & 1)) >> 1, yy >> 1) * 0.65 + hash2(x + 911, yy) * 0.35;
    let val;
    if (dep < 0) {                       // loose grains scattered just above the surface
      if (dep > -40 && hash2(x, yy + 5000) < 0.42 * Math.exp(dep / 8)) val = 0.3 + 0.7 * hs;
      else continue;
    } else {
      const fi = (y >> 1) * fw + (x >> 1);
      const cr = crackF[fi];
      val = 0.22 + 0.32 * heatF[fi] + 0.95 * cr * cr * cr + 0.55 * Math.exp(-dep / 6) + 0.26 * mnd[x] * Math.exp(-dep / 50) - 0.0011 * dep;
      val *= 0.28 + 1.35 * hs * hs;
      if (hs > 0.93) val += 0.4;
    }
    const c = ramp(L.clamp(val));
    const i = (y * W + x) * 4;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  const c = L.makeCanvas(W, hh);
  c.getContext('2d').putImageData(img, 0, 0);
  return { canvas: c, y0, top };
}

/** glowing spatter stuck to the wall: a static part (returned as a canvas) and a shimmering part (returned as arrays) */
function buildGlitter(env, heap) {
  const a = env.arc, crest = a.crestY;
  const base = new ImageData(W, H);
  const r = L.rng('s33glit');
  const ramp = L.makeRamp(SPARK);
  const tw = [];   // idx, r, g, b, phase, speed, size
  const twinkle = (x, y, c, k, size) => { x |= 0; y |= 0; if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) return; tw.push((y * W + x) * 4, c[0] * k, c[1] * k, c[2] * k, r.range(0, L.TAU), r.range(1.1, 2.6), size); };
  for (let n = 0, tries = 0; n < 38000 && tries < 500000; tries++) {
    const x = r() * W, y = r() * H;
    const dr = a.drAt(x, y);
    if (dr < 3) continue;
    const ri = Math.hypot(x - IMP.x, y - IMP.y);
    const hot = Math.exp(-ri / 300);
    const m = zoneMask(x, y, crest);
    let den = (0.15 + 0.95 * hot + 0.4 * canopy(x, y)) * (1 - 0.9 * m);
    if (dr < RING) den *= 0.7;
    if (r() > den) continue;
    let heat = Math.pow(r(), 1.7 - 1.1 * hot) * (0.72 + 0.5 * hot);
    if (m > 0.25) heat *= 0.45;
    const q = r();
    const size = m > 0.25 ? 0 : q < 0.7 ? 0 : q < 0.95 ? 1 : 2;
    const c = ramp(L.clamp(heat)), k = r.range(0.45, 1);
    if (r() < 0.5) grain(base.data, W, H, x, y, c, k, size); else twinkle(x, y, c, k * 1.5, size);
    n++;
  }
  // hot grains breathing on the ember bed
  for (let n = 0; n < 6500; n++) {
    const x = r() * (W - 1), dep = 90 * Math.pow(r(), 1.6) - 3;
    twinkle(x, heap.top[Math.round(x)] + dep, ramp(r.range(0.55, 1)), r.range(0.5, 1.1), r.chance(0.3) ? 1 : 0);
  }
  // a few beads of spatter big enough to flare
  const glints = [];   // x, y, lut index, gain, phase, speed
  for (let n = 0; n < 70;) {
    const x = r.range(10, W - 10), y = r.range(10, H - 10);
    if (a.drAt(x, y) < 14 || zoneMask(x, y, crest) > 0.03) continue;
    const hot = Math.exp(-Math.hypot(x - IMP.x, y - IMP.y) / 420);
    if (r() > 0.3 + 0.7 * hot + 0.4 * canopy(x, y)) continue;
    glints.push(x, y, lutIndex(r.range(0.6, 1)), r.range(0.35, 0.9), r.range(0, L.TAU), r.range(1.3, 2.9));
    n++;
  }
  const c = L.makeCanvas(W, H);
  c.getContext('2d').putImageData(base, 0, 0);
  return { base: c, tw: new Float32Array(tw), glints: new Float32Array(glints) };
}

/** fine airborne sparks: too small to streak, each one still flies its own path */
function buildDust(env) {
  const crest = env.arc.crestY;
  const r = L.rng('s33dust'), P = [0, 0];
  const out = [];   // vx, vy, k, tau0, jx, jy, r, g, b, size
  const ramp = L.makeRamp(SPARK);
  for (let n = 0, tries = 0; n < 24000 && tries < 400000; tries++) {
    const s = sampleCanopy(r); flightAt(s, s.tau0 + SIMT * 0.5, P);
    const jx = r.gauss() * 16, jy = r.gauss() * 16;
    const x = P[0] + jx, y = P[1] + jy;
    if (x < -20 || x >= W + 20 || y < -20 || y >= H + 20) continue;
    const m = zoneMask(x, y, crest);
    if (r() < m * 0.95) continue;
    const heat = L.clamp(1.0 - s.tau0 / 2.2 + r.range(-0.3, 0.2)) * (m > 0.2 ? 0.4 : 1);
    const c = ramp(heat), k = r.range(0.45, 1.1);
    out.push(s.vx, s.vy, s.k, s.tau0, jx, jy, c[0] * k, c[1] * k, c[2] * k, m < 0.2 && r.chance(0.25) ? 1 : 0);
    n++;
  }
  return new Float32Array(out);
}
/** a sprinkling of out-of-focus sparks close to the lens */
function buildBokeh(env) {
  const crest = env.arc.crestY;
  const r = L.rng('s33bokeh');
  const out = [];   // x, y, rad, r, g, b, parallax
  const cols = [[255, 46, 20], [255, 46, 20], [255, 70, 24], [255, 96, 28], [255, 128, 40]];
  for (let n = 0; n < 150;) {
    const x = r.range(-30, W + 30), y = r.range(-30, H + 30);
    if (r() < zoneMask(x, y, crest) * 1.3) continue;
    const rad = r.range(2.6, 10), al = r.range(0.16, 0.4) * (rad < 5 ? 1.5 : 1), c = r.pick(cols);
    out.push(x, y, rad, c[0] * al, c[1] * al, c[2] * al, r.range(0.07, 0.16));
    n++;
  }
  return new Float32Array(out);
}

// ───────────────────────── per-frame particle plotting ─────────────────────────
function plotGlitter(d, f) {
  const tw = S.tw;
  for (let j = 0; j < tw.length; j += 7) {
    const s = 0.5 + 0.5 * Math.sin(tw[j + 4] + f * tw[j + 5]);
    const k = 0.12 + 0.88 * s * s, i = tw[j];
    const r = tw[j + 1] * k, g = tw[j + 2] * k, b = tw[j + 3] * k;
    d[i] += r; d[i + 1] += g; d[i + 2] += b;
    if (tw[j + 6] >= 1) {
      const r2 = r * 0.6, g2 = g * 0.6, b2 = b * 0.6, dn = i + (W << 2);
      d[i + 4] += r2; d[i + 5] += g2; d[i + 6] += b2; d[dn] += r2; d[dn + 1] += g2; d[dn + 2] += b2;
      if (tw[j + 6] >= 2) { const up = i - (W << 2); d[i - 4] += r2; d[i - 3] += g2; d[i - 2] += b2; d[up] += r2; d[up + 1] += g2; d[up + 2] += b2; d[i] += 90 * k; d[i + 1] += 80 * k; d[i + 2] += 50 * k; }
    }
  }
  const gt = S.glints;
  for (let j = 0; j < gt.length; j += 6) {
    const s = 0.5 + 0.5 * Math.sin(gt[j + 4] + f * gt[j + 5]);
    glowK(d, gt[j], gt[j + 1], gt[j + 2], gt[j + 3] * (0.2 + 0.8 * s * s));
  }
}
function plotDust(d, p) {
  const du = S.dust, dT = p * SIMT;
  for (let j = 0; j < du.length; j += 10) {
    const k = du[j + 2], tau = du[j + 3] + dT;
    const q = (1 - Math.exp(-k * tau)) / k;
    const x = IMP.x + du[j] * q + du[j + 4], y = IMP.y + du[j + 1] * q + (GRAV / k) * (tau - q) + du[j + 5];
    if (du[j + 9]) splat(d, x, y, du[j + 6] * 2.2, du[j + 7] * 2.2, du[j + 8] * 2.2);
    else {
      const xi = x | 0, yi = y | 0;
      if (xi < 0 || yi < 0 || xi >= W || yi >= H) continue;
      const i = (yi * W + xi) << 2;
      d[i] += du[j + 6]; d[i + 1] += du[j + 7]; d[i + 2] += du[j + 8];
    }
  }
}
function plotBokeh(d, p) {
  const bk = S.bokeh;
  for (let j = 0; j < bk.length; j += 7) {
    const z = 1 + bk[j + 6] * p;
    disc(d, IMP.x + (bk[j] - IMP.x) * z, IMP.y + (bk[j + 1] - IMP.y) * z + 240 * bk[j + 6] * p, bk[j + 2], bk[j + 3], bk[j + 4], bk[j + 5]);
  }
}
function plotSparks(d, env, p) {
  const crest = env.arc.crestY, f = env.frame | 0;
  const P = S.P, Q = S.Q, dT = p * SIMT, list = S.sparks;
  for (let n = 0; n < list.length; n++) {
    const s = list[n];
    let hx, hy, tx, ty;
    if (s.type === 0) {
      flightAt(s, s.tau0 + dT, P); flightAt(s, s.tau0 + dT - EXPO * s.ex, Q);
      hx = P[0]; hy = P[1]; tx = Q[0]; ty = Q[1];
    } else if (s.type === 1) {
      hx = s.x + s.vx * dT; hy = s.y + s.vy * dT; tx = hx - s.vx * EXPO * s.ex; ty = hy - s.vy * EXPO * s.ex;
    } else {
      const t = s.tau0 + dT, t2 = Math.max(0, t - EXPO * s.ex);
      hx = s.x + s.vx * t; hy = s.y + s.vy * t + 0.5 * GRAV * t * t;
      if (hy > s.y + 3) continue;       // already back in the embers
      tx = s.x + s.vx * t2; ty = s.y + s.vy * t2 + 0.5 * GRAV * t2 * t2;
    }
    if (hx < -50 || hx > W + 50 || hy < -50 || hy > H + 50) continue;
    let hi = s.hi, ti = s.ti, wid = s.wid, gain = s.gain, hot = s.hot;
    if (hy < crest && hx > 400 && hx < 1520) {
      const m = zoneMask(hx, hy, crest);
      if (m > 0.02) { if (s.u < m * 0.94) continue; if (m > 0.3) { hi = ti; ti = 0; wid = 0; gain *= 0.7; hot = false; } }
    }
    streak(d, tx, ty, hx, hy, ti, hi, gain, wid);
    if (hot) glowK(d, hx, hy, hi, s.glob ? 1 : 0.5);
    if (s.fork && hi === s.hi) {        // iron sparks fork as the carbon in them burns
      const nb = 3 + (s.seed % 2);
      for (let k = 0; k < nb; k++) {
        const ang = hash2(s.seed + k * 17, f) * L.TAU, len = 4 + 7 * hash2(s.seed + k * 29, f + 3);
        streak(d, hx + Math.cos(ang) * len, hy + Math.sin(ang) * len, hx, hy, ti, hi, 0.9, 0);
      }
      glowK(d, hx, hy, hi, 0.4);
    }
  }
}

export default {
  name: '打树花·城门',
  tone: 'light',
  init(env) {
    const a = env.arc;
    const wall = buildWall(env, buildHeight(env));
    const g = wall.getContext('2d');
    drawSoffit(g, env);
    const heap = buildHeap();
    const gl = buildGlitter(env, heap);
    // bake the static spatter into the wall, with a little bloom (kept on the wall side of the arc)
    g.save(); a.clipAbove(g, 0.5);
    g.globalCompositeOperation = 'lighter';
    g.filter = 'blur(22px)'; g.globalAlpha = 0.9; g.drawImage(gl.base, 0, 0);
    g.filter = 'blur(2.5px)'; g.globalAlpha = 0.7; g.drawImage(gl.base, 0, 0);
    g.filter = 'none'; g.globalAlpha = 1; g.drawImage(gl.base, 0, 0);
    const trails = buildTrails(env);
    g.filter = 'blur(1.2px)'; g.drawImage(trails, 0, 0);
    g.filter = 'none'; g.globalAlpha = 0.6; g.drawImage(trails, 0, 0);
    g.restore();
    {
      const sw = 1100, sh = 460;
      const fume = L.noiseTex(sw, sh, { seed: 's33fume', scale: 170, octaves: 4, warp: 1.1, res: 0.25, contrast: 1.6, ramp: [[0, 'rgba(255,90,30,0)'], [0.4, 'rgba(255,90,30,0)'], [1, 'rgba(255,120,44,0.5)']] });
      const fg = fume.getContext('2d');
      fg.globalCompositeOperation = 'destination-in';
      fg.translate(sw / 2, sh * 0.42); fg.scale(1, 0.42);
      fg.fillStyle = L.radial(fg, 0, 0, 0, sw / 2, [[0, 'rgba(0,0,0,1)'], [0.45, 'rgba(0,0,0,0.6)'], [1, 'rgba(0,0,0,0)']]);
      fg.fillRect(-sw, -sh * 3, sw * 2, sh * 6);
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.55; g.drawImage(fume, IMP.x - sw / 2, IMP.y - sh * 0.42); g.restore();
    }
    drawSplat(g);
    // ember bed, the light it throws up into the passage and a breath of lit smoke above it
    g.save(); g.globalCompositeOperation = 'lighter';
    const smoke = L.noiseTex(W, 480, { seed: 's33smoke', scale: 230, octaves: 4, warp: 0.9, res: 0.2, contrast: 1.5, ramp: [[0, 'rgba(150,24,12,0)'], [0.45, 'rgba(150,24,12,0)'], [1, 'rgba(200,44,18,0.55)']] });
    const sg = smoke.getContext('2d');
    sg.globalCompositeOperation = 'destination-in';
    sg.fillStyle = L.linear(sg, 0, 0, 0, 480, [[0, 'rgba(0,0,0,0)'], [0.35, 'rgba(0,0,0,0.12)'], [1, 'rgba(0,0,0,1)']]);
    sg.fillRect(0, 0, W, 480);
    g.globalAlpha = 0.5; g.drawImage(smoke, 0, H - 480); g.globalAlpha = 1;
    g.translate(HEAPX, 1000); g.scale(1, 0.46);
    g.fillStyle = L.radial(g, 0, 0, 0, 800, [[0, 'rgba(255,80,26,0.5)'], [0.3, 'rgba(210,40,16,0.24)'], [0.65, 'rgba(138,20,12,0.08)'], [1, 'rgba(138,20,12,0)']]);
    g.fillRect(-1400, -900, 2800, 1800);
    g.restore();
    g.drawImage(heap.canvas, 0, heap.y0);
    drawArris(g, env, false);
    // bloom of the arris: part baked in, part kept on a strip so the firelight can flicker
    const rimY = Math.floor(a.crestY - 40), rimH = Math.ceil(a.yAt(0) - rimY + 50);
    const rimSrc = L.makeCanvas(W, rimH), rg = rimSrc.getContext('2d');
    rg.translate(0, -rimY); drawArris(rg, env, true);
    const rim = L.makeCanvas(W, rimH), rg2 = rim.getContext('2d');
    rg2.globalCompositeOperation = 'lighter';
    rg2.filter = 'blur(13px)'; rg2.globalAlpha = 0.85; rg2.drawImage(rimSrc, 0, 0);
    rg2.filter = 'blur(4px)'; rg2.globalAlpha = 0.9; rg2.drawImage(rimSrc, 0, 0);
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.6; g.drawImage(rim, 0, rimY); g.restore();
    L.vignette(g, { strength: 0.2 });
    const fc = L.makeCanvas(W, H);
    S = {
      base: g.getImageData(0, 0, W, H).data, frame: new ImageData(W, H), fc, fctx: fc.getContext('2d', { willReadFrequently: true }),
      rim, rimY, tw: gl.tw, glints: gl.glints, dust: buildDust(env), bokeh: buildBokeh(env),
      sparks: buildSparks(env, heap.top), P: [0, 0], Q: [0, 0],
    };
  },
  draw(ctx, env, p) {
    const f = env.frame | 0;
    const fl = 0.5 + 0.5 * Math.sin(f * 2.4 + 0.7);     // firelight flicker, one value per frame
    const d = S.frame.data;
    d.set(S.base);
    plotGlitter(d, f);
    plotDust(d, p);
    plotSparks(d, env, p);
    plotBokeh(d, p);
    S.fctx.putImageData(S.frame, 0, 0);
    ctx.drawImage(S.fc, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.15 + 0.4 * fl; ctx.drawImage(S.rim, 0, S.rimY);
    ctx.restore();
    // the blaze at the point of impact
    L.glow(ctx, IMP.x, IMP.y, 330, '#ff5a1f', 0.3 + 0.2 * fl);
    L.glow(ctx, IMP.x, IMP.y, 140, '#ffb347', 0.45 + 0.25 * fl);
    L.glow(ctx, IMP.x, IMP.y, 52, '#fff0c8', 0.9);
  },
};
