// s33 — 打树花·城门. Night, in front of an old fort gate: a ladle of molten iron has just been flung against the
// wall above the gateway and bursts into a tree-crown of gold and red sparks.
// The arc = the edge of the gate's brick arch (券脸), its arris picked out by firelight. Above it: the black wall,
// peppered with glowing spatter; below it: the pitch-black gate passage, sparks raining down onto a bed of embers.
// Recipe: everything that does not move is baked into ONE opaque layer in init(); every frame adds two alternating
// "twinkle" layers, two dust layers that expand away from the impact point, and ~5000 live spark streaks that
// advance along their own ballistic paths (deterministic, seeded).
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 64;                 // dust layers only ever zoom IN about the burst, so a small margin is plenty
const T = 40;                   // brick thickness (px): wall course height and voussoir pitch along the arc
const RING1 = 80;               // 券 — bricks set on end, radially
const RING2 = 40;               // 伏 — bricks laid flat, following the curve
const RING = RING1 + RING2;
const JOINT = 5;                // mortar joint
const IMP = { x: 985, y: 66 };  // where the molten iron hits the wall
const GRAV = 1500;              // px / sim-s²
const SIMT = 0.135;             // sim-seconds covered by the whole shot
const EXPO = 0.021;             // "shutter time" → streak length ≈ one frame of travel
const HEAPX = 1010;
let S = null;

// black → ember → red → orange → gold (the only colours in this shot)
const HEAT = [[0, '#040303'], [0.05, '#150504'], [0.14, '#3d0b07'], [0.28, '#8a140c'], [0.45, '#cc2412'], [0.6, '#ff3b1f'], [0.78, '#ff9a2a'], [1, '#ffe08a']];
const SPARK = [[0, '#4a0b07'], [0.22, '#8a140c'], [0.5, '#ff3b1f'], [0.76, '#ff9a2a'], [1, '#ffe08a']];
const COL = ['#8a140c', '#e0301a', '#ff5a1f', '#ff9a2a', '#ffe08a'];
const HEADC = [null, '#ff5a1f', '#ff9a2a', '#ffd27a', '#fff6dc'];
const ALPHA = [0.6, 0.72, 0.85, 0.95, 1];
const LW = [1.1, 1.7, 2.6];

function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** 1 inside the tagline zone above the crest, falling softly to 0 around it */
function zoneMask(x, y, crestY) {
  const dx = Math.abs(x - 960) / 430, dy = Math.abs(y - (crestY - 135)) / 175;
  if (dx > 1.36 || dy > 1.36) return 0;
  const d = Math.cbrt(dx * dx * dx + dy * dy * dy);
  return 1 - L.smooth((d - 0.8) / 0.55);
}
/** rough density of the falling canopy at a wall point (two lobes either side of the impact) */
function canopy(x, y) {
  const dx = Math.abs(x - IMP.x) - 560, dy = y - IMP.y - 230;
  return Math.exp(-(dx * dx) / 176400 - (dy * dy) / 108900);
}
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
  if (Math.sin(ang) > 0.5 && r.chance(0.75)) ang = -ang; // most of the splash goes up and sideways
  const v = 900 + 1700 * r();
  return { vx: v * Math.cos(ang), vy: v * Math.sin(ang), k: r.range(1.2, 2.4), tau0: 0.004 + 0.3 * Math.pow(r(), 1.5) };
}
const levelOf = (heat) => (heat > 0.82 ? 4 : heat > 0.62 ? 3 : heat > 0.42 ? 2 : heat > 0.2 ? 1 : 0);

function buildSparks(env, heapTop) {
  const crest = env.arc.crestY;
  const r = L.rng('s33sparks');
  const list = [];
  const P = [0, 0];
  const add = (s, heat) => {
    s.lv = levelOf(heat);
    const q = r();
    s.wc = q < 0.58 - heat * 0.2 ? 0 : q < 0.86 - heat * 0.1 ? 1 : 2;
    s.u = r(); s.ex = r.range(0.7, 1.5); s.fork = s.lv >= 2 && r.chance(0.07); s.seed = r.int(0, 99999);
    list.push(s);
  };
  // the canopy: sparks of every age between the impact and the ground
  for (let n = 0, tries = 0; n < 2700 && tries < 60000; tries++) {
    const s = sampleCanopy(r); s.type = 0;
    flightAt(s, s.tau0 + SIMT * 0.5, P);
    if (P[0] < -60 || P[0] > W + 60 || P[1] < -60 || P[1] > H + 60) continue;
    if (r() < zoneMask(P[0], P[1], crest) * 0.9) continue;
    add(s, L.clamp(1.08 - s.tau0 / 1.5 + r.range(-0.2, 0.25))); n++;
  }
  // the fresh splash right at the impact: young, fast, white-hot
  for (let n = 0; n < 820; n++) { const s = sampleCore(r); s.type = 0; add(s, L.clamp(1.1 - s.tau0 * 0.8 + r.range(-0.25, 0.1))); }
  // rain: cooled sparks from the previous throw, falling at terminal speed in front of the gateway
  for (let n = 0; n < 820; n++) {
    const s = { type: 1, x: r.range(-40, W + 40), y: crest - 230 + (H - crest + 290) * Math.pow(r(), 0.8), vx: r.range(-70, 70), vy: r.range(600, 1080) };
    add(s, r.range(0.08, 0.66));
  }
  // sparks bouncing off the ember bed
  for (let n = 0; n < 260; n++) {
    const x = L.clamp(HEAPX + r.gauss() * 400, 10, W - 10);
    const ang = L.deg(-90 + r.gauss() * 34), v = r.range(140, 640);
    const s = { type: 2, x, y: heapTop[Math.round(x)] - 2, vx: v * Math.cos(ang), vy: v * Math.sin(ang) };
    s.tau0 = r.range(0, (-2 * s.vy / GRAV) * 0.95);
    add(s, r.range(0.3, 0.95));
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
  const hd = height.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  const img = new ImageData(W, H), o = img.data;
  const ramp = L.makeRamp(HEAT);
  const lut = new Uint8ClampedArray(1024 * 3);
  for (let i = 0; i < 1024; i++) { const c = ramp(i / 1023); lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2]; }
  const K = 7 / 255, R0 = 105 * 105;
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
      const alb = 0.3 + 0.7 * (h / 255);
      let lum = alb * (1.3 / (1 + r2 / R0)) * Math.max(0, 0.42 + rel);
      lum += alb * (0.05 + 0.11 * canopy(x, y)) * Math.max(0, 0.6 + rel * 0.8);
      if (dr < RING + 40) {
        const rel2 = ((gx * ex + gy * ey) / rr) * K;     // lit from below, by the embers in the gateway
        lum += alb * (0.15 * Math.exp(-dr / 40) + 0.5 * Math.exp(-dr / 4.5)) * Math.max(0, 0.55 + rel2);
      }
      if (x > 370 && x < 1550 && y > 180) lum *= 1 - 0.5 * zoneMask(x, y, crest);
      if (dr < 0.5) lum *= dr + 0.5;
      lum += (hash2(x, y) - 0.5) * 0.008;
      const li = (lum <= 0 ? 0 : lum >= 1 ? 1023 : (lum * 1023) | 0) * 3;
      o[i] = lut[li]; o[i + 1] = lut[li + 1]; o[i + 2] = lut[li + 2];
    }
  }
  const c = L.makeCanvas(W, H);
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

/** a hint of the barrel vault receding into the passage: the brick soffit just inside the arris */
function drawSoffit(g, env) {
  const a = env.arc;
  g.save(); a.clipBelow(g, -1.5);
  g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 230, a.R, [[0, 'rgba(120,20,10,0)'], [0.55, 'rgba(120,20,10,0.05)'], [0.9, 'rgba(140,24,12,0.16)'], [1, 'rgba(160,30,14,0.3)']]);
  g.fillRect(0, 0, W, H);
  const s = a.span(80), dth = voussoirStep(a), n = Math.ceil(s / dth) + 1;
  g.strokeStyle = 'rgba(0,0,0,0.75)'; g.lineWidth = 2.2;
  const rings = [[-52, -128, -178], [-94, -156, -196]];
  for (let i = -n; i < n; i++) {
    const t0 = voussoirT0(a, i);
    const p0 = a.pt(t0, -2), p1 = a.pt(t0 * 0.985, -235);   // longitudinal joints converge toward the vanishing point
    g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke();
    for (const dr of rings[i & 1]) a.stroke(g, dr, t0, t0 + dth);
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
    let heat = L.clamp(0.6 + 0.3 * nz.n2(i * 0.23, 1.7) + 0.16 * nz.n2(i * 1.9, 7.1) + 0.2 * Math.exp(-xr * xr), 0.4, 1);
    let ta = t0 + gap, tb = t0 + dth - gap;
    const chip = r();
    if (chip < 0.1) { if (r.chance(0.5)) ta += dth * r.range(0.2, 0.45); else tb -= dth * r.range(0.2, 0.45); heat *= 0.85; }
    const jig = r.range(0, 0.7);
    if (!hotOnly) {
      g.strokeStyle = L.css(ramp(heat * 0.55)); g.lineWidth = 4.6; g.globalAlpha = 0.55; a.stroke(g, 2.3 + jig, ta, tb);
    }
    g.strokeStyle = L.css(ramp(heat)); g.lineWidth = 3.2; g.globalAlpha = 1; a.stroke(g, 1.6 + jig, ta, tb);
    g.strokeStyle = L.css(ramp(Math.min(1, heat + 0.25))); g.lineWidth = 1.3; g.globalAlpha = 0.85; a.stroke(g, 1.0 + jig, ta + gap, tb - gap);
  }
  g.restore();
}

/** long-exposure ghosts of the spark paths: gives the burst its willow-branch structure even in a single frame */
function drawTrails(g, env) {
  const crest = env.arc.crestY;
  const r = L.rng('s33trails'), P = [0, 0];
  const ramp = L.makeRamp(SPARK);
  const cols = []; for (let i = 0; i < 16; i++) cols.push(L.css(ramp(i / 15)));
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  for (let i = 0; i < 170; i++) {
    const s = sampleCanopy(r); s.k = r.range(0.95, 1.7);
    const tMax = r.range(1.0, 2.3), a0 = r.range(0.07, 0.24), lw = r.range(0.8, 1.6);
    let px = 0, py = 0;
    for (let t = 0.03, j = 0; t <= tMax; t += 0.022, j++) {
      flightAt(s, t, P);
      if (j > 0 && P[1] > -40 && P[1] < H + 40) {
        const u = t / tMax;
        let al = a0 * Math.pow(1 - u, 0.7) * (1 - 0.94 * zoneMask(P[0], P[1], crest));
        al *= hash2(i * 31 + j, 77) < 0.28 ? 0.25 : 1;       // broken, sputtering lines
        g.globalAlpha = al; g.strokeStyle = cols[Math.round(15 * L.clamp(1 - u * 0.95))]; g.lineWidth = lw;
        g.beginPath(); g.moveTo(px, py); g.lineTo(P[0], P[1]); g.stroke();
      }
      px = P[0]; py = P[1];
    }
  }
  g.restore();
}

/** the molten iron itself: a white-hot splat smeared over the bricks, with runs dribbling down the wall */
function drawSplat(g) {
  const r = L.rng('s33splat');
  const nz = L.makeNoise('s33splat');
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 30; i++) {
    const ang = r.range(0, L.TAU), down = Math.sin(ang) > 0.3;
    const len = r.range(46, 170) * (down ? 0.55 : 1), w = r.range(3, 9);
    const cx = Math.cos(ang), sy = Math.sin(ang);
    const x1 = IMP.x + cx * len, y1 = IMP.y + sy * len;
    g.fillStyle = L.linear(g, IMP.x, IMP.y, x1, y1, [[0, 'rgba(255,236,170,0.95)'], [0.4, 'rgba(255,150,40,0.75)'], [1, 'rgba(255,50,20,0)']]);
    g.beginPath(); g.moveTo(IMP.x - sy * w, IMP.y + cx * w); g.quadraticCurveTo(IMP.x + cx * len * 0.5, IMP.y + sy * len * 0.5, x1, y1);
    g.quadraticCurveTo(IMP.x + cx * len * 0.5, IMP.y + sy * len * 0.5, IMP.x + sy * w, IMP.y - cx * w); g.closePath(); g.fill();
  }
  g.fillStyle = L.radial(g, IMP.x, IMP.y, 4, 66, [[0, '#fff6dc'], [0.38, '#ffd27a'], [0.72, 'rgba(255,138,42,0.85)'], [1, 'rgba(255,60,20,0)']]);
  g.beginPath();
  for (let i = 0; i <= 72; i++) {
    const ang = (i / 72) * L.TAU, rad = 44 + 18 * nz.n2(Math.cos(ang) * 1.6, Math.sin(ang) * 1.6) + 7 * nz.n2(Math.cos(ang) * 6, Math.sin(ang) * 6 + 9);
    const x = IMP.x + Math.cos(ang) * rad, y = IMP.y + Math.sin(ang) * rad * 0.86;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath(); g.fill();
  // runs of iron dribbling down the face of the wall
  for (const [dx, len, w] of [[-34, 96, 5], [-9, 132, 6.5], [17, 78, 4.5], [41, 112, 5.5], [-58, 58, 3.5]]) {
    const x = IMP.x + dx, y0 = IMP.y + 18, y1 = y0 + len;
    g.fillStyle = L.linear(g, 0, y0, 0, y1, [[0, 'rgba(255,226,150,0.9)'], [0.55, 'rgba(255,130,36,0.8)'], [1, 'rgba(255,70,24,0.75)']]);
    g.beginPath(); g.moveTo(x - w, y0); g.quadraticCurveTo(x - w * 0.5, y0 + len * 0.6, x - w * 0.55, y1 - w);
    g.arc(x, y1 - w, w * 0.62, Math.PI, 0, true); g.quadraticCurveTo(x + w * 0.5, y0 + len * 0.6, x + w, y0); g.closePath(); g.fill();
    L.glow(g, x, y1 - w, w * 5, '#ff8a2a', 0.5, 'lighter');
  }
  g.restore();
}

// ───────────────────────── glitter, dust, embers ─────────────────────────
/** the bed of embers along the bottom of frame, mounded where the rain of sparks piles up */
function buildHeap() {
  const y0 = 850, hh = H - y0;
  const nz = L.makeNoise('s33heap');
  const top = new Float32Array(W + 1);
  for (let x = 0; x <= W; x++) {
    const u = (x - HEAPX) / 800;
    const mound = Math.pow(Math.max(0, 1 - u * u), 1.6);
    top[x] = H - 24 - 140 * mound - 16 * nz.fbm(x / 120, 3.3, 3) - 5 * nz.n2(x / 15, 8.1);
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
      val = 0.24 + 0.32 * heatF[fi] + 0.95 * cr * cr * cr + 0.55 * Math.exp(-dep / 6) - 0.0011 * dep;
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

/** glowing spatter stuck to the wall (static) + two alternating sets that make it shimmer */
function buildGlitter(env, heap) {
  const a = env.arc, crest = a.crestY;
  const mk = () => new ImageData(W, H);
  const base = mk(), twA = mk(), twB = mk();
  const r = L.rng('s33glit');
  const ramp = L.makeRamp(SPARK);
  for (let n = 0, tries = 0; n < 34000 && tries < 400000; tries++) {
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
    const which = r();
    const tgt = which < 0.56 ? base : which < 0.78 ? twA : twB;
    grain(tgt.data, W, H, x, y, ramp(L.clamp(heat)), r.range(0.45, 1), size);
    n++;
  }
  // hot grains breathing on the ember bed
  for (let n = 0; n < 5200; n++) {
    const x = r() * (W - 1), dep = 90 * Math.pow(r(), 1.6) - 3;
    const y = heap.top[Math.round(x)] + dep;
    grain(n & 1 ? twA.data : twB.data, W, H, x, y, ramp(r.range(0.55, 1)), r.range(0.4, 0.9), r.chance(0.3) ? 1 : 0);
  }
  const out = [base, twA, twB].map((im) => { const c = L.makeCanvas(W, H); c.getContext('2d').putImageData(im, 0, 0); return c; });
  // a few glints big enough to flare
  const sp = glowSprite(26, 0.8);
  [out[1], out[2]].forEach((c, k) => {
    const g = c.getContext('2d'); g.globalCompositeOperation = 'lighter';
    const rr = L.rng('s33glint' + k);
    for (let n = 0; n < 34;) {
      const x = rr() * W, y = rr() * H;
      if (a.drAt(x, y) < 12 || zoneMask(x, y, crest) > 0.05) continue;
      const k2 = rr.range(0.5, 1.1);
      g.globalAlpha = rr.range(0.5, 1); g.drawImage(sp, x - 13 * k2, y - 13 * k2, 26 * k2, 26 * k2);
      n++;
    }
  });
  return { base: out[0], twA: out[1], twB: out[2] };
}

function glowSprite(size, k = 1) {
  const c = L.makeCanvas(size, size), g = c.getContext('2d'), h = size / 2;
  g.fillStyle = L.radial(g, h, h, 0, h, [[0, `rgba(255,244,214,${0.95 * k})`], [0.16, `rgba(255,214,130,${0.75 * k})`], [0.4, `rgba(255,130,40,${0.3 * k})`], [1, 'rgba(255,50,20,0)']]);
  g.fillRect(0, 0, size, size);
  return c;
}

/** fine airborne sparks, baked as points; the layer is zoomed about the impact so they fly outward */
function buildDustFar(env) {
  const crest = env.arc.crestY;
  const w = W + PAD * 2, h = H + PAD * 2;
  const img = new ImageData(w, h), d = img.data;
  const r = L.rng('s33dust'), P = [0, 0];
  const ramp = L.makeRamp(SPARK);
  for (let n = 0, tries = 0; n < 15000 && tries < 300000; tries++) {
    let x, y, heat;
    if (r.chance(0.8)) {
      const s = sampleCanopy(r); flightAt(s, s.tau0, P);
      x = P[0] + r.gauss() * 16; y = P[1] + r.gauss() * 16; heat = L.clamp(0.95 - s.tau0 / 1.7 + r.range(-0.25, 0.2));
    } else { x = r.range(-PAD, W + PAD); y = r.range(-PAD, H + PAD); heat = r.range(0, 0.45); }
    if (x < -PAD || x >= W + PAD || y < -PAD || y >= H + PAD) continue;
    const m = zoneMask(x, y, crest);
    if (r() < m * 0.94) continue;
    grain(d, w, h, x + PAD, y + PAD, ramp(heat * (m > 0.25 ? 0.4 : 1)), r.range(0.4, 1), m < 0.25 && r.chance(0.22) ? 1 : 0);
    n++;
  }
  const c = L.makeCanvas(w, h);
  c.getContext('2d').putImageData(img, 0, 0);
  c._pad = PAD;
  return c;
}
/** a sprinkling of out-of-focus sparks close to the lens */
function buildDustNear(env) {
  const crest = env.arc.crestY;
  const layer = L.makeLayer(PAD, (g) => {
    const r = L.rng('s33bokeh');
    g.globalCompositeOperation = 'lighter';
    for (let n = 0; n < 300;) {
      const x = r.range(-PAD, W + PAD), y = r.range(-PAD, H + PAD);
      if (r() < zoneMask(x, y, crest) * 1.2) continue;
      const rad = r.range(2.5, 8.5), al = r.range(0.1, 0.34) * (rad < 5 ? 1.3 : 1);
      const c = r.pick(['#ff3b1f', '#ff3b1f', '#ff9a2a', '#ff6a22', '#ffe08a']);
      g.fillStyle = L.radial(g, x, y, 0, rad, [[0, L.rgba(c, al)], [0.65, L.rgba(c, al * 0.8)], [1, L.rgba(c, 0)]]);
      g.beginPath(); g.arc(x, y, rad, 0, L.TAU); g.fill();
      n++;
    }
  });
  return L.blurred(layer, 1.4);
}

// ───────────────────────── live sparks ─────────────────────────
function drawSparks(ctx, env, p) {
  const crest = env.arc.crestY, f = env.frame | 0;
  const segs = S.segs, heads = S.heads;
  for (let b = 0; b < 15; b++) segs[b].length = 0;
  heads.length = 0;
  const P = S.P, Q = S.Q, dT = p * SIMT;
  for (let i = 0; i < S.sparks.length; i++) {
    const s = S.sparks[i];
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
    let lv = s.lv, wc = s.wc;
    if (hy < crest && hx > 370 && hx < 1550) {
      const m = zoneMask(hx, hy, crest);
      if (m > 0.02) { if (s.u < m * 0.93) continue; if (m > 0.3) { lv = Math.min(lv, 1); wc = 0; } }
    }
    segs[lv * 3 + wc].push(tx, ty, hx, hy);
    if (lv === 4 && wc > 0) heads.push(hx, hy);
    if (s.fork && lv >= 2) {            // iron sparks fork as the carbon in them burns
      const nb = 3 + (s.seed % 3), sg = segs[lv * 3];
      for (let k = 0; k < nb; k++) {
        const ang = hash2(s.seed + k * 17, f) * L.TAU, len = 5 + 11 * hash2(s.seed + k * 29, f + 3);
        sg.push(hx, hy, hx + Math.cos(ang) * len, hy + Math.sin(ang) * len);
      }
      heads.push(hx, hy);
    }
  }
  const run = (arr, k0) => {
    for (let j = 0; j < arr.length; j += 4) {
      ctx.moveTo(k0 ? L.lerp(arr[j], arr[j + 2], k0) : arr[j], k0 ? L.lerp(arr[j + 1], arr[j + 3], k0) : arr[j + 1]);
      ctx.lineTo(arr[j + 2], arr[j + 3]);
    }
  };
  const OFF = window.__s33off || {};
  ctx.save();
  ctx.globalCompositeOperation = OFF.xLighter ? 'source-over' : 'lighter'; ctx.lineCap = OFF.xRound ? 'butt' : 'round';
  // soft red halo under the bigger, hotter streaks
  if (!OFF.xHalo) {
  ctx.strokeStyle = 'rgba(255,60,24,0.2)';
  for (let wc = 1; wc < 3; wc++) {
    ctx.lineWidth = LW[wc] + 3.4; ctx.beginPath();
    for (let lv = 2; lv < 5; lv++) run(segs[lv * 3 + wc], 0);
    ctx.stroke();
  } }
  // streak bodies, coolest first
  if (!OFF.xBody) for (let lv = 0; lv < 5; lv++) for (let wc = 0; wc < 3; wc++) {
    const arr = segs[lv * 3 + wc]; if (!arr.length) continue;
    ctx.strokeStyle = COL[lv]; ctx.globalAlpha = ALPHA[lv]; ctx.lineWidth = LW[wc];
    if (OFF.xSingle) { for (let j = 0; j < arr.length; j += 4) { ctx.beginPath(); ctx.moveTo(arr[j], arr[j + 1]); ctx.lineTo(arr[j + 2], arr[j + 3]); ctx.stroke(); } }
    else { ctx.beginPath(); run(arr, 0); ctx.stroke(); }
  }
  // hotter leading ends
  if (!OFF.xHead) for (let lv = 1; lv < 5; lv++) for (let wc = 0; wc < 3; wc++) {
    const arr = segs[lv * 3 + wc]; if (!arr.length) continue;
    ctx.strokeStyle = HEADC[lv]; ctx.globalAlpha = 0.9; ctx.lineWidth = LW[wc] * 0.85;
    ctx.beginPath(); run(arr, 0.55); ctx.stroke();
  }
  ctx.globalAlpha = 0.9;
  if (!OFF.xSprite) for (let j = 0; j < heads.length; j += 2) ctx.drawImage(S.sprite, heads[j] - 14, heads[j + 1] - 14);
  ctx.restore();
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
    g.restore();
    drawTrails(g, env);
    drawSplat(g);
    // ember bed and the light it throws up into the passage
    g.save(); g.globalCompositeOperation = 'lighter';
    g.translate(HEAPX, 1000); g.scale(1, 0.48);
    g.fillStyle = L.radial(g, 0, 0, 0, 820, [[0, 'rgba(255,80,26,0.5)'], [0.3, 'rgba(210,40,16,0.26)'], [0.65, 'rgba(138,20,12,0.09)'], [1, 'rgba(138,20,12,0)']]);
    g.fillRect(-1300, -900, 2600, 1800);
    g.restore();
    g.drawImage(heap.canvas, 0, heap.y0);
    drawArris(g, env, false);
    // bloom of the arris on its own strip so the firelight can flicker
    const rimY = Math.floor(a.crestY - 40), rimH = Math.ceil(a.yAt(0) - rimY + 50);
    const rimSrc = L.makeCanvas(W, rimH), rg = rimSrc.getContext('2d');
    rg.translate(0, -rimY); drawArris(rg, env, true);
    const rim = L.makeCanvas(W, rimH), rg2 = rim.getContext('2d');
    rg2.globalCompositeOperation = 'lighter';
    rg2.filter = 'blur(13px)'; rg2.globalAlpha = 0.85; rg2.drawImage(rimSrc, 0, 0);
    rg2.filter = 'blur(4px)'; rg2.globalAlpha = 0.9; rg2.drawImage(rimSrc, 0, 0);
    S = {
      wall, twA: gl.twA, twB: gl.twB, rim, rimY,
      dustFar: buildDustFar(env), dustNear: buildDustNear(env),
      sparks: buildSparks(env, heap.top), sprite: glowSprite(28),
      segs: Array.from({ length: 15 }, () => []), heads: [], P: [0, 0], Q: [0, 0],
    };
  },
  draw(ctx, env, p) {
    const f = env.frame | 0;
    const OFF = window.__s33off || {};
    const fl = 0.84 + 0.16 * Math.sin(f * 2.4 + 0.7);     // firelight flicker, one value per frame
    if (!OFF.wall) ctx.drawImage(S.wall, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (!OFF.tw) ctx.drawImage(f % 2 ? S.twB : S.twA, 0, 0);
    ctx.globalAlpha = 0.55 + 0.45 * fl; if (!OFF.rim) ctx.drawImage(S.rim, 0, S.rimY);
    ctx.restore();
    if (!OFF.dustFar) L.blit(ctx, env, S.dustFar, { zoom: 1 + 0.05 * p, pivot: IMP, dy: 14 * p, blend: 'lighter' });
    if (!OFF.sparks) drawSparks(ctx, env, p);
    if (!OFF.dustNear) L.blit(ctx, env, S.dustNear, { zoom: 1 + 0.12 * p, pivot: IMP, dy: 34 * p, blend: 'lighter' });
    // the blaze at the point of impact
    if (!OFF.glow) {
    L.glow(ctx, IMP.x, IMP.y, 340, '#ff5a1f', 0.5 * fl);
    L.glow(ctx, IMP.x, IMP.y, 150, '#ffb347', 0.65 * fl);
    L.glow(ctx, IMP.x, IMP.y, 58, '#fff0c8', 0.9); }
    if (!OFF.vig) L.vignette(ctx, { strength: 0.22 });
  },
};
