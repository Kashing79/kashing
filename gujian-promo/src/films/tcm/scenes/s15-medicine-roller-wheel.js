// s15 — 药碾轮. Macro, level with the rim of the cast-iron wheel (碾轮) of a medicine roller (药碾) while it is rolling:
// the arc is the wheel's upper edge. Below it the disc face is smeared into concentric threads by motion blur —
// rust brown, dark orange and iron black, a brighter burnished band part-way in, the ground rim (刃口) catching the light.
// A hair-thin violet → cold-blue rim light rides the edge and dies away to both sides; a small puff of herb dust is
// thrown up on the left. Above the arc: near-black brown with the faintest horizontal drag marks.
//
// How it is built: the wheel face is painted once as a flat "strip" (x = distance along the rim, y = depth below it)
// where motion blur is simply horizontal smear, then bent onto the arc per pixel in init(). Two such layers turn about
// the arc's centre at different speeds (so the threads flow and shimmer) under lights that stay fixed to the frame.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 260;        // room at the sides / bottom for the rotation
const SU = 4;           // rim px per strip px (everything is smeared along the rim, so the strip can be coarse that way)
const BX = 60;          // side margin of the drifting background streaks
const VIOLET = '#7a4fd0', BLUE = '#3aa0d8';
let S = null;

const sstep = (a, b, v) => { const t = L.clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
function lut(stops, n = 512) {
  const f = L.makeRamp(stops), o = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const c = f(i / (n - 1)); o[i * 3] = c[0]; o[i * 3 + 1] = c[1]; o[i * 3 + 2] = c[2]; }
  return o;
}

// ───────────────────────── geometry: frame pixel → (distance along rim, depth below rim) ─────────────────────────
function buildMap(env) {
  const a = env.arc, R = a.R;
  const X0 = -PAD, Y0 = Math.floor(a.crestY) - 3;
  const LW = W + PAD * 2, LH = H + PAD - Y0;
  const SH = Math.ceil(R - (a.cy - (H + PAD))) + 6;                       // deepest point the layer reaches
  const thMax = Math.atan2(W / 2 + PAD, a.cy - (H + PAD)) + 0.012;
  const SW = Math.ceil((thMax * R) / SU) * 2 + 6;
  const mx = new Float32Array(LW * LH), my = new Float32Array(LW * LH);
  for (let j = 0; j < LH; j++) {
    const ddy = a.cy - (Y0 + j + 0.5);
    for (let i = 0; i < LW; i++) {
      const ddx = X0 + i + 0.5 - a.cx, k = j * LW + i;
      mx[k] = (Math.atan2(ddx, ddy) * R) / SU + SW / 2 - 0.5;
      my[k] = R - Math.sqrt(ddx * ddx + ddy * ddy);
    }
  }
  return { X0, Y0, LW, LH, SH, SW, mx, my };
}

/** bend a strip (ImageData) onto the arc → canvas covering x ∈ [X0, X0+LW), y ∈ [Y0, Y0+LH); crisp anti-aliased rim */
function warp(M, strip, premul) {
  const { LW, LH, SW, SH, mx, my } = M, src = strip.data;
  const img = new ImageData(LW, LH), d = img.data, row = SW * 4;
  const xMax = SW - 1.001, yMax = SH - 1.001;
  for (let k = 0, n = LW * LH; k < n; k++) {
    const v = my[k]; if (v <= -0.5) continue;
    let fx = mx[k], fy = v - 0.5;
    if (fx < 0) fx = 0; else if (fx > xMax) fx = xMax;
    if (fy < 0) fy = 0; else if (fy > yMax) fy = yMax;
    const x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0;
    const p = (y0 * SW + x0) * 4, q = p + row, o = k * 4;
    let w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
    const cov = v >= 0.5 ? 1 : v + 0.5;
    if (premul) {
      w00 *= src[p + 3]; w10 *= src[p + 7]; w01 *= src[q + 3]; w11 *= src[q + 7];
      const al = w00 + w10 + w01 + w11; if (al < 0.5) continue;
      d[o] = (src[p] * w00 + src[p + 4] * w10 + src[q] * w01 + src[q + 4] * w11) / al;
      d[o + 1] = (src[p + 1] * w00 + src[p + 5] * w10 + src[q + 1] * w01 + src[q + 5] * w11) / al;
      d[o + 2] = (src[p + 2] * w00 + src[p + 6] * w10 + src[q + 2] * w01 + src[q + 6] * w11) / al;
      d[o + 3] = al * cov;
    } else {
      d[o] = src[p] * w00 + src[p + 4] * w10 + src[q] * w01 + src[q + 4] * w11;
      d[o + 1] = src[p + 1] * w00 + src[p + 5] * w10 + src[q + 1] * w01 + src[q + 5] * w11;
      d[o + 2] = src[p + 2] * w00 + src[p + 6] * w10 + src[q + 2] * w01 + src[q + 6] * w11;
      d[o + 3] = 255 * cov;
    }
  }
  const c = L.makeCanvas(LW, LH);
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

// ───────────────────────── the wheel face, unrolled ─────────────────────────
/** tone of the iron by depth below the rim (0 = black … 1 = hottest highlight): the wheel's radial section */
function profile(v) {
  if (v < 1.5) return 0.6;                                               // the very edge (the rim light sits here)
  if (v < 5) return L.lerp(0.6, 0.94, sstep(1.5, 5, v));                 // … then the ground edge flashing warm
  if (v < 16) return L.lerp(0.94, 0.66, sstep(5, 16, v));
  if (v < 44) return L.lerp(0.66, 0.52, (v - 16) / 28);                  // the ground bevel of the rim (刃口)
  if (v < 50) return L.lerp(0.52, 0.13, sstep(44, 50, v));               // where the grinding stops: a dark line …
  if (v < 57) return L.lerp(0.13, 0.42, sstep(50, 57, v));               // … and the lip of the as-cast face
  let t = L.lerp(0.42, 0.23, sstep(57, 80, v));                          // as-cast iron: dark, threaded with black
  t += 0.17 * sstep(250, 400, v);                                        // rustier toward the hub
  t += 0.45 * Math.exp(-Math.pow((v - 258) / 78, 2));                    // the burnished band rubbed by the trough
  t += 0.08 * Math.exp(-Math.pow((v - 434) / 5, 2));                     // the face swells toward the hub: a soft break
  t -= 0.06 * sstep(450, 660, v);
  return t;
}

/** horizontally smeared marks drawn onto a strip: each fades in fast at its leading (left) end and trails off */
function paintStreaks(g, SW, SH, seed, dens, bright) {
  const r = L.rng(seed);
  const mark = (y, len, th, col, al, soft) => {
    const x = r.range(-len * 0.6, SW - len * 0.4);
    g.fillStyle = L.linear(g, x, 0, x + len, 0, [[0, L.rgba(col, 0)], [0.15, L.rgba(col, al)], [0.45, L.rgba(col, al * 0.85)], [1, L.rgba(col, 0)]]);
    if (soft) {
      g.globalAlpha = 0.35; g.fillRect(x, y - th * 0.5, len, th);
      g.globalAlpha = 0.5; g.fillRect(x, y - th * 0.32, len, th * 0.64);
      g.globalAlpha = 0.7; g.fillRect(x, y - th * 0.14, len, th * 0.28);
      g.globalAlpha = 1;
    } else g.fillRect(x, y - th * 0.5, len, th);
  };
  const anyV = () => 58 + Math.pow(r(), 1.25) * (SH - 60);
  // broad soft smears: rust blooms and iron-black patches dragged round the wheel
  for (let i = 0; i < 64 * dens; i++) mark(anyV(), r.range(130, 430), r.range(7, 40), r.pick(['#070403', '#140805', '#d0661f', '#e8842e', '#5e2a10', '#070403']), r.range(0.14, 0.34) * (bright ? 0.7 : 1), true);
  // iron-black threads
  for (let i = 0; i < (bright ? 40 : 150) * dens; i++) mark(anyV(), r.range(60, 330), r.range(0.8, 3.4), r.pick(['#070403', '#120705', '#1e0d06']), r.range(0.3, 0.75));
  // dark-orange / amber threads
  for (let i = 0; i < 130 * dens; i++) mark(anyV(), r.range(60, 300), r.range(0.7, 2.6), r.pick(['#e8842e', '#ff9c44', '#d4631f', '#c8742e', '#ffb262']), r.range(0.22, 0.6));
  // glints: single bright points on the burnished band drawn out into long hot lines
  for (let i = 0; i < 26 * dens; i++) mark(r.range(170, 350), r.range(120, 420), r.range(0.7, 1.6), r.pick(['#ffd9a4', '#ffe8c4', '#ffc078']), r.range(0.45, 0.9));
  // herb powder caught on the face, flung into pale trails
  for (let i = 0; i < 64 * dens; i++) {
    const y = r.chance(0.55) ? r.range(60, 190) : r.range(300, 520);
    mark(y, r.range(36, 200), r.range(0.6, 1.8), r.pick(['#f4e0b4', '#ead2a2', '#fff0d0']), r.range(0.3, 0.8));
  }
  // … and packed into the line where the ground bevel meets the cast face
  for (let i = 0; i < 30 * dens; i++) mark(r.range(47.5, 52.5), r.range(30, 150), r.range(0.8, 1.9), r.pick(['#f4e0b4', '#ead2a2', '#fff0d0']), r.range(0.25, 0.7));
  // hairline glints on the ground bevel
  for (let i = 0; i < 70 * dens; i++) mark(r.range(6, 44), r.range(80, 320), r.range(0.6, 1.3), r.pick(['#fff1d8', '#ffd09a', '#2a1208', '#3a1a0c']), r.range(0.25, 0.6));
}

function buildFaceStrip(M) {
  const { SW, SH } = M;
  const nA = L.makeNoise('s15tcm-a'), nB = L.makeNoise('s15tcm-b');
  const RUST = lut([[0, '#050302'], [0.13, '#240b04'], [0.3, '#6a2a0e'], [0.46, '#8a4a22'], [0.64, '#c8742e'], [0.8, '#f08a30'], [0.92, '#ffac58'], [1, '#ffd09a']]);
  const IRON = lut([[0, '#030202'], [0.2, '#120806'], [0.4, '#40200f'], [0.56, '#7a4420'], [0.7, '#b9672a'], [0.84, '#e8903e'], [1, '#ffcf9c']]);
  // v-only tables (quarter-pixel steps so the wobbled lookups stay smooth)
  const NP = (SH + 48) * 4, PL = new Float32Array(NP), RING = new Float32Array(NP);
  for (let i = 0; i < NP; i++) {
    const v = i / 4;
    PL[i] = profile(v);
    RING[i] = (0.3 * nA.n2(3.3, v / 3.1) + 0.3 * nB.n2(8.1, v / 11) + 0.4 * nA.n2(21.7, v / 27)) * sstep(56, 80, v);   // turning marks: identical all the way round
  }
  const img = new ImageData(SW, SH), d = img.data;
  for (let j = 0; j < SH; j++) {
    const v = j + 0.5;
    const bevel = 1 - sstep(42, 56, v), band = Math.exp(-Math.pow((v - 255) / 96, 2));
    const wobA = 6 * sstep(72, 260, v);                                    // deeper in, the threads wander a little
    const quiet = L.lerp(0.6, 1, sstep(0.2, 0.46, profile(v)));          // black iron stays quiet, the lit zones carry the streaks
    const aB = L.lerp(0.24 * quiet, 0.06, bevel), aM = L.lerp(0.1 * quiet, 0.07, bevel), aH = L.lerp(0.035, 0.12, bevel) + 0.02 * band, aP = 0.11 * quiet * (1 - bevel);
    const rustZ = (1 - bevel) * (1 - 0.65 * band);
    for (let i = 0; i < SW; i++) {
      const u = (i + 0.5 - SW / 2) * SU;
      const vv = wobA ? v + wobA * nB.n2(u / 1300 + 5, v / 260) : v;
      const n0 = nB.n2(u / 1500 - 3, vv / 300 + 11) * 0.65 + nB.n2(u / 700 + 9, vv / 120 - 4) * 0.35;      // where the rust sits
      const n1 = nA.n2(u / 1000, vv / 36) * 0.65 + nA.n2(u / 520 + 40, vv / 17 + 3) * 0.35;                 // broad bands
      const n2 = nA.n2(u / 1000 + 71, vv / 8.5) * 0.6 + nB.n2(u / 560 - 18, vv / 4.2 + 50) * 0.4;          // threads
      const n3 = nB.n2(u / 620 + 7, vv / 2.1 - 30) * 0.6 + nA.n2(u / 380 - 55, vv / 1.15 + 9) * 0.4;       // hairlines
      const pi = Math.max(0, Math.min(NP - 1, (vv * 4) | 0));
      let t = PL[pi] + aP * n0 + aB * n1 + aM * n2 + aH * n3 + 0.16 * RING[pi];
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const rust = L.clamp(0.22 + 0.62 * rustZ + 0.55 * n0);
      const li = ((t * 511) | 0) * 3, o = (j * SW + i) * 4;
      d[o] = IRON[li] + (RUST[li] - IRON[li]) * rust;
      d[o + 1] = IRON[li + 1] + (RUST[li + 1] - IRON[li + 1]) * rust;
      d[o + 2] = IRON[li + 2] + (RUST[li + 2] - IRON[li + 2]) * rust;
      d[o + 3] = 255;
    }
  }
  const c = L.makeCanvas(SW, SH), g = c.getContext('2d', { willReadFrequently: true });
  g.putImageData(img, 0, 0);
  paintStreaks(g, SW, SH, 's15tcm-marks', 1, false);
  return g.getImageData(0, 0, SW, SH);
}

/** a second, sparser sheet of marks on transparent ground: it turns faster than the face, so the blur shimmers */
function buildOverStrip(M) {
  const { SW, SH } = M;
  const c = L.makeCanvas(SW, SH), g = c.getContext('2d', { willReadFrequently: true });
  paintStreaks(g, SW, SH, 's15tcm-over', 0.55, true);
  return g.getImageData(0, 0, SW, SH);
}

// ───────────────────────── fixed light ─────────────────────────
/** multiply layer: the key light falls off along the wheel and toward the hub (shadows stay warm, never grey) */
function buildShade(env) {
  const a = env.arc;
  const c = L.makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  g.save(); a.clipBelow(g, 0);
  // circular brushing answers a lamp with a wedge of light running from rim to hub; away from it the iron sinks into warm dark
  g.fillStyle = L.linear(g, 0, 0, W, 0, [[0, '#b47860'], [0.14, '#c68a6e'], [0.3, '#e4b698'], [0.4, '#fbe6d2'], [0.46, '#ffffff'], [0.53, '#f8dcc4'], [0.66, '#dca886'], [0.84, '#c0866a'], [1, '#ae745c']]);
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 600, a.R - 330, [[0, '#8a5a42'], [1, '#ffffff']]);
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.55;
  g.drawImage(L.noiseTex(W, H, { seed: 's15tcm-blot', scale: 520, octaves: 3, warp: 0.6, res: 0.2, ramp: [[0, '#a87866'], [0.5, '#ffffff'], [1, '#ffffff']] }), 0, 0);
  g.restore();
  return c;
}

/** colour-dodge layer: the sheen on the burnished band and the ground rim, strongest a little left of the crest
 *  (dodge multiplies what is there, so bright threads flare while the black ones stay black — polished metal, not haze) */
function buildSpec(env) {
  const a = env.arc, D = 440;
  const c = L.makeCanvas(W, H), g = c.getContext('2d');
  const t = (dr) => (dr + D) / D;
  const C = '150,104,64';
  g.fillStyle = L.radial(g, a.cx, a.cy, a.R - D, a.R, [
    [0, `rgba(${C},0)`], [t(-400), `rgba(${C},0)`], [t(-315), `rgba(${C},0.45)`], [t(-256), `rgba(${C},1)`], [t(-200), `rgba(${C},0.5)`], [t(-125), `rgba(${C},0)`],
    [t(-46), `rgba(${C},0)`], [t(-28), `rgba(${C},0.7)`], [t(-8), `rgba(${C},0.55)`], [1, `rgba(${C},0.2)`]]);
  a.pathBelow(g, 0); g.fill();
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = L.linear(g, 0, 0, W, 0, [[0.2, 'rgba(0,0,0,0)'], [0.4, 'rgba(0,0,0,0.9)'], [0.46, 'rgba(0,0,0,1)'], [0.53, 'rgba(0,0,0,0.85)'], [0.74, 'rgba(0,0,0,0)']]);
  g.fillRect(0, 0, W, H);
  return c;
}
/** screen layer: the glow where the wedge of light crosses the burnished band, and a smaller one on the ground rim */
function buildBloom(env) {
  const a = env.arc;
  const c = L.makeCanvas(W, H), g = c.getContext('2d');
  g.save(); a.clipBelow(g, 0);
  a.at(g, -0.055, -258, () => {
    g.scale(3.6, 1);
    g.fillStyle = L.radial(g, 0, 0, 0, 150, [[0, 'rgba(255,138,44,0.3)'], [0.4, 'rgba(255,120,36,0.13)'], [1, 'rgba(255,110,30,0)']]);
    g.fillRect(-160, -160, 320, 320);
  });
  a.at(g, -0.06, -252, () => {      // its hot core
    g.scale(5.2, 1);
    g.fillStyle = L.radial(g, 0, 0, 0, 46, [[0, 'rgba(255,178,86,0.24)'], [0.5, 'rgba(255,150,60,0.09)'], [1, 'rgba(255,140,50,0)']]);
    g.fillRect(-50, -50, 100, 100);
  });
  a.at(g, -0.05, -22, () => {
    g.scale(7, 1);
    g.fillStyle = L.radial(g, 0, 0, 0, 44, [[0, 'rgba(255,190,120,0.3)'], [0.5, 'rgba(255,160,90,0.1)'], [1, 'rgba(255,150,80,0)']]);
    g.fillRect(-50, -50, 100, 100);
  });
  g.restore();
  return c;
}

// ───────────────────────── background ─────────────────────────
function buildBack(env) {
  const a = env.arc;
  const BH = Math.ceil(a.yAt(0)) + 30;
  const c = L.makeCanvas(W, BH), g = c.getContext('2d');
  g.fillStyle = L.linear(g, 0, 0, 0, BH, [[0, '#030202'], [0.38, '#070504'], [0.7, '#110805'], [1, '#160a06']]);
  g.fillRect(0, 0, W, BH);
  // the wheel is rolling sideways: its silhouette smears along its travel → nothing above the level crest, a soft brown bleed above the falling shoulders
  const gh = L.makeCanvas(W, BH), gg = gh.getContext('2d');
  for (let k = 1; k <= 14; k++) {
    const s = k * 13, al = 0.05 * (1 - k / 15);
    for (const sg of [-1, 1]) {
      gg.save(); gg.translate(sg * s, 0); gg.globalAlpha = al;
      gg.fillStyle = L.radial(gg, a.cx, a.cy, a.R - 220, a.R, [[0, '#2a1108'], [0.7, '#6b3417'], [1, '#9a5226']]);
      a.pathBelow(gg, 0); gg.fill(); gg.restore();
    }
  }
  g.filter = 'blur(2.5px)'; g.drawImage(gh, 0, 0); g.filter = 'none';
  // a breath of warm bounce hugging the rim
  g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 4, a.R + 190, [[0, 'rgba(92,40,16,0.3)'], [0.3, 'rgba(60,26,11,0.12)'], [1, 'rgba(40,16,8,0)']]);
  g.fillRect(0, 0, W, BH);
  return c;
}
/** the faintest horizontal drag marks in the dark (drifts sideways); kept quieter still where the tagline sits */
function buildDrag(env) {
  const a = env.arc;
  const BW = W + BX * 2, BH = Math.ceil(a.yAt(0)) + 30;
  const c = L.makeCanvas(BW, BH), g = c.getContext('2d');
  g.drawImage(L.noiseTex(BW, BH, { seed: 's15tcm-drag1', scale: 7, sx: 90, sy: 1, octaves: 3, contrast: 1.7, res: 0.5,
    ramp: [[0, 'rgba(0,0,0,0.4)'], [0.42, 'rgba(20,9,5,0)'], [0.7, 'rgba(84,40,18,0)'], [1, 'rgba(132,66,30,0.13)']] }), 0, 0);
  g.drawImage(L.noiseTex(BW, BH, { seed: 's15tcm-drag2', scale: 44, sx: 30, sy: 1, octaves: 3, contrast: 1.5, res: 0.25,
    ramp: [[0, 'rgba(0,0,0,0.3)'], [0.5, 'rgba(40,18,9,0)'], [1, 'rgba(110,54,24,0.12)']] }), 0, 0);
  g.globalCompositeOperation = 'destination-out';
  g.save(); g.translate(BX + a.cx, a.crestY - 140); g.scale(2.1, 1);
  g.fillStyle = L.radial(g, 0, 0, 60, 250, [[0, 'rgba(0,0,0,0.72)'], [1, 'rgba(0,0,0,0)']]);
  g.fillRect(-300, -300, 600, 600);
  g.restore();
  // darker toward the top
  g.fillStyle = L.linear(g, 0, 0, 0, BH, [[0, 'rgba(0,0,0,0.85)'], [0.55, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,0)']]);
  g.fillRect(0, 0, BW, BH);
  return c;
}

function blitLow(ctx, env, M, layer, rot, alpha = 1) {
  const a = env.arc;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(a.cx, a.cy); ctx.rotate(rot); ctx.translate(-a.cx, -a.cy);
  ctx.drawImage(layer, M.X0, M.Y0);
  ctx.restore();
}

export default {
  name: '药碾轮',
  tone: 'light',
  init(env) {
    const M = buildMap(env);
    const face = warp(M, buildFaceStrip(M), false);
    const over = warp(M, buildOverStrip(M), true);
    // herb dust thrown off the rim on the left
    const rd = L.rng('s15tcm-dust'), dust = [];
    for (let i = 0; i < 170; i++) {
      const ang = -Math.PI / 2 - 0.6 + rd.gauss() * 0.42;       // up and to the left: the way the rim is travelling
      dust.push({
        th0: -0.192 + rd.gauss() * 0.014, ca: Math.cos(ang), sa: Math.sin(ang), dist: 3 + Math.pow(rd(), 2.0) * 150,
        sp: rd.range(8, 36), sz: 0.6 + Math.pow(rd(), 2.8) * 2.2, ph: rd(), k: rd.range(0.4, 1), tr: rd.chance(0.3),
        col: rd.pick(['#fff0d2', '#ffe2b0', '#ffd09a', '#f6dcb0', '#d9c8ff', '#bfe4ff']),
      });
    }
    S = { M: { X0: M.X0, Y0: M.Y0 }, face, over, shade: buildShade(env), spec: buildSpec(env), bloom: buildBloom(env), back: buildBack(env), drag: buildDrag(env), dust };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    // ── the dark behind ──
    ctx.fillStyle = '#160a06'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(S.back, 0, 0);
    ctx.drawImage(S.drag, -BX + L.lerp(34, -34, p), 0);

    // ── the wheel: the blurred threads stream to the left, the two sheets at different speeds ──
    const flow = L.lerp(0.5, -0.5, p);
    blitLow(ctx, env, S.M, S.face, flow * 0.08);
    blitLow(ctx, env, S.M, S.over, flow * 0.15, 0.9);
    ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(S.shade, 0, 0);
    ctx.globalCompositeOperation = 'color-dodge'; ctx.drawImage(S.spec, L.lerp(12, -12, p), 0);
    ctx.globalCompositeOperation = 'screen'; ctx.drawImage(S.bloom, L.lerp(12, -12, p), 0);
    ctx.globalCompositeOperation = 'source-over';

    // ── rim light: hair-thin violet at the crest, turning cold blue to the right, dying away to both sides; it breathes ──
    const br = 0.8 + 0.2 * Math.sin(p * Math.PI);
    const pk = L.lerp(-0.012, 0.012, p);
    const grad = (al, c1 = '#8a5fe6', c2 = '#946cf0') => L.linear(ctx, 0, 0, W, 0, [
      [0.02, L.rgba(VIOLET, 0)], [0.15 + pk, L.rgba(VIOLET, 0.3 * al)], [0.34 + pk, L.rgba(c1, al)], [0.52 + pk, L.rgba(c2, al)],
      [0.66 + pk, L.rgba('#4f8fe2', 0.92 * al)], [0.8, L.rgba(BLUE, 0.6 * al)], [0.93, L.rgba(BLUE, 0.14 * al)], [0.99, L.rgba(BLUE, 0)]]);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    // glow above the edge, and the cold light spilling onto the ground bevel just below it
    for (const [w, al, dr] of [[46, 0.085, 10], [20, 0.2, 5.5], [9, 0.42, 2.5], [26, 0.2, -12], [10, 0.24, -5], [84, 0.1, -104]]) {
      ctx.strokeStyle = grad(al * br); ctx.lineWidth = w; a.stroke(ctx, dr);
    }
    // the line itself: laid on opaque so it stays violet instead of bleaching out over the bright iron
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = grad(br); ctx.lineWidth = 3.8; a.stroke(ctx, 0.5);
    ctx.strokeStyle = grad(0.92 * br, '#c9b2ff', '#d4c2ff'); ctx.lineWidth = 1.4; a.stroke(ctx, 1.1);
    ctx.globalCompositeOperation = 'screen';

    // ── herb dust: a small puff kicked up off the rim on the left ──
    const o0 = a.pt(-0.192, 0);
    ctx.save(); ctx.translate(o0.x - 22, o0.y - 20); ctx.rotate(-0.5); ctx.scale(1.7, 1);
    ctx.fillStyle = L.radial(ctx, 0, 0, 0, 74, [[0, 'rgba(255,226,180,0.24)'], [0.45, 'rgba(206,176,255,0.1)'], [1, 'rgba(160,140,255,0)']]);
    ctx.fillRect(-80, -80, 160, 160);
    ctx.restore();
    ctx.lineCap = 'round';
    for (const q of S.dust) {
      const o = a.pt(q.th0, 1);
      const dd = q.dist + q.sp * p;
      const x = o.x + q.ca * dd, y = o.y + q.sa * dd + 10 * p * p * (dd / 120);
      const al = q.k * (1 - L.clamp(dd / 185) * 0.8) * (0.72 + 0.28 * Math.sin((p * 1.3 + q.ph) * L.TAU));
      if (q.tr) {
        const tl = q.sp * 0.3, tx = x - q.ca * tl, ty = y - q.sa * tl;
        const gr = ctx.createLinearGradient(x, y, tx, ty);
        gr.addColorStop(0, L.rgba(q.col, al * 0.8)); gr.addColorStop(1, L.rgba(q.col, 0));
        ctx.strokeStyle = gr; ctx.lineWidth = q.sz * 0.8;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
      }
      const rr = q.sz * 2.6;
      ctx.fillStyle = L.radial(ctx, x, y, 0, rr, [[0, L.rgba('#fff8ea', al)], [0.28, L.rgba(q.col, al * 0.75)], [1, L.rgba(q.col, 0)]]);
      ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    ctx.restore();

    L.vignette(ctx, { strength: 0.3 });
  },
};
