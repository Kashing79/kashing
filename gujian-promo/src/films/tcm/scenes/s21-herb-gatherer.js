// s21 — 采药人剪影. Dusk on a mountain ridge. The arc is the ridge line itself: a near-black mass with a ragged
// fringe of grass, traced by a hair-thin orange backlight. On the left third stands a small herb gatherer seen from
// behind (pack basket on his back with a few sprigs showing, short medicine hoe used as a staff) and, further left,
// an old pine with slanting boughs. Above: nothing but the afterglow — orange bleeding out of carmine beside the
// ridge on the left, sinking upward and rightward into deep purple and near black.
//
// Layers: the sky is shaded per pixel once (float maths + dither, so the long dark gradients do not band) and never
// moves; everything on the ridge lives in one padded layer that slides along the arc with `rot`.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 100;
const INK = '#0a0507';          // 剪影黑
const U0 = -660;                // where the afterglow sits: px of arc length from the crest (negative = left)
const PINE_X = 150, PINE_S = 1.2;
const MAN_X = 540, MAN_S = 1.15;
let S = null;

const sm = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// ───────────────────────── sky ─────────────────────────
function lut(stops, n = 2048) {
  const f = L.makeRamp(stops), out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const c = f(i / (n - 1)); out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2]; }
  return out;
}

function buildSky(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const c = L.makeCanvas(W, H), g = c.getContext('2d');
  const img = g.createImageData(W, H), d = img.data;
  const N = 2048;
  // body of the dusk: near black → 绛紫 → 胭脂 → a warmer carmine next to the ridge
  const LB = lut([[0, '#050207'], [0.1, '#12050f'], [0.32, '#3a0f2e'], [0.52, '#6c1c33'], [0.72, '#9d2933'], [1, '#c4382c']], N);
  // the afterglow itself: carmine → 霞橙 → a hotter core hugging the ridge
  const LO = lut([[0, '#c4382c'], [0.45, '#e4481f'], [0.75, '#f2541b'], [1, '#ff7426']], N);
  // very slow haze field (keeps the gradient from looking computed) on a coarse grid
  const CS = 24, cw = Math.ceil(W / CS) + 2, ch = Math.ceil(H / CS) + 2, hz = new Float32Array(cw * ch);
  const nz = L.makeNoise('s21haze');
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) hz[j * cw + i] = nz.fbm((i * CS) / 1100, (j * CS) / 320, 3);
  let seed = 0x2545f491 | 0;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 8) / 16777216; };
  for (let y = 0; y < H; y++) {
    const ddy = cy - y, fy = y / CS, j0 = fy | 0, ty = fy - j0;
    for (let x = 0; x < W; x++) {
      const ddx = x - cx, rr = Math.sqrt(ddx * ddx + ddy * ddy);
      const dr = rr > R ? rr - R : 0, u = Math.atan2(ddx, ddy) * R;
      const fx = x / CS, i0 = fx | 0, tx = fx - i0, k0 = j0 * cw + i0;
      const hv = (hz[k0] + (hz[k0 + 1] - hz[k0]) * tx) * (1 - ty) + (hz[k0 + cw] + (hz[k0 + cw + 1] - hz[k0 + cw]) * tx) * ty;
      // carmine body: strongest low on the left, thinning upward and to the right
      let B = (1 - 0.6 * sm((u + 760) / 1900)) * Math.exp(-Math.pow(dr / 700, 1.25)) + 0.03 * hv;
      // orange afterglow: a wide oval lying along the ridge …
      const du = u - U0, d2 = du * du, sg = du < 0 ? 820 : 440;
      let O = Math.exp(-d2 / (sg * sg)) * Math.exp(-Math.pow(dr / 250, 1.3)) * (1 + 0.07 * hv);
      // … with a hotter seam right on the crest where the sun went down
      const s2 = du < 0 ? 620 : 330;
      const hot = Math.exp(-d2 / (s2 * s2)) * Math.exp(-dr / 58) * 0.7;
      const k = sm((O * 1.08 - 0.05) / 0.82);
      B = B < 0 ? 0 : B > 1 ? 1 : B; O = O < 0 ? 0 : O > 1 ? 1 : O;
      const bi = ((B * (N - 1)) | 0) * 3, oi = ((O * (N - 1)) | 0) * 3;
      const n = (rnd() + rnd() - 1) * 2.1;       // triangular dither / fine grain
      const o = (y * W + x) * 4;
      let cr = LB[bi] + (LO[oi] - LB[bi]) * k, cg = LB[bi + 1] + (LO[oi + 1] - LB[bi + 1]) * k, cb = LB[bi + 2] + (LO[oi + 2] - LB[bi + 2]) * k;
      cr += (255 - cr) * hot; cg += (150 - cg) * hot; cb += (64 - cb) * hot;
      d[o] = cr + n; d[o + 1] = cg + n * 0.8; d[o + 2] = cb + n * 0.9;
      d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

// ───────────────────────── small drawing helpers ─────────────────────────
/** a single tapered grass blade standing at (x,y). ang: lean from vertical (rad, + = right); curl: extra bend toward the tip */
function blade(g, x, y, ang, len, w, curl) {
  const s0 = Math.sin(ang), c0 = Math.cos(ang), s1 = Math.sin(ang + curl), c1 = Math.cos(ang + curl);
  const mx = x + s0 * len * 0.55, my = y - c0 * len * 0.55;
  const tx = mx + s1 * len * 0.5, ty = my - c1 * len * 0.5;
  const px = c0 * w * 0.5, py = s0 * w * 0.5;
  g.beginPath();
  g.moveTo(x - px, y - py);
  g.quadraticCurveTo(mx - px * 0.7, my - py * 0.7, tx, ty);
  g.quadraticCurveTo(mx + px * 0.7, my + py * 0.7, x + px, y + py);
  g.closePath(); g.fill();
}
/** a long arching grass leaf whose direction turns by `curl` along its length */
function leaf(g, x, y, ang, len, w, curl) {
  const n = 12, Lp = [], Rp = [];
  let px = x, py = y;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a2 = ang + curl * Math.pow(t, 1.6);
    const hw = (w / 2) * Math.pow(1 - t, 0.75) * (0.75 + 0.5 * Math.sin(Math.min(1, t * 2.2) * Math.PI * 0.5));
    const nx = Math.cos(a2), ny = Math.sin(a2);
    Lp.push([px - nx * hw, py - ny * hw]); Rp.push([px + nx * hw, py + ny * hw]);
    px += (Math.sin(a2) * len) / n; py -= (Math.cos(a2) * len) / n;
  }
  g.beginPath(); g.moveTo(Lp[0][0], Lp[0][1]);
  for (let i = 1; i <= n; i++) g.lineTo(Lp[i][0], Lp[i][1]);
  for (let i = n; i >= 0; i--) g.lineTo(Rp[i][0], Rp[i][1]);
  g.closePath(); g.fill();
}
/** tapered branch / limb through pts, width w0 → w1, slightly knobbly */
function limb(g, pts, w0, w1, seed) {
  const p = L.smoothPath(pts, 3), n = p.length;
  const nz = L.makeNoise('limb' + seed);
  const A = [], B = [];
  for (let i = 0; i < n; i++) {
    const a = p[Math.max(0, i - 1)], b = p[Math.min(n - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
    const t = i / (n - 1);
    const hw = Math.max(0.5, (L.lerp(w0, w1, Math.pow(t, 0.85)) * (1 + 0.16 * nz.n2(t * 7, 1.3))) / 2);
    A.push([p[i][0] + nx * hw, p[i][1] + ny * hw]); B.push([p[i][0] - nx * hw, p[i][1] - ny * hw]);
  }
  g.beginPath(); g.moveTo(A[0][0], A[0][1]);
  for (let i = 1; i < n; i++) g.lineTo(A[i][0], A[i][1]);
  for (let i = n - 1; i >= 0; i--) g.lineTo(B[i][0], B[i][1]);
  g.closePath(); g.fill();
}
const poly = (g, pts) => { g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fill(); };
/** closed shape with rounded corners (quadratic through edge midpoints) */
function soft(g, pts) {
  const n = pts.length, m = (i) => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2];
  const s = m(0);
  g.beginPath(); g.moveTo(s[0], s[1]);
  for (let i = 1; i <= n; i++) { const c = pts[i % n], e = m(i); g.quadraticCurveTo(c[0], c[1], e[0], e[1]); }
  g.closePath(); g.fill();
}

// ───────────────────────── the ridge ─────────────────────────
function makeEdge() {
  const nz = L.makeNoise('s21edge');
  // ragged but tight: the solid edge stays within a few px of the arc
  return (u) => -2.2 + 2.4 * nz.fbm(u / 110, 0.3, 3) + 1.2 * nz.n2(u / 19, 7.7) + 0.5 * nz.n2(u / 6.5, 3.1);
}
function bodyPath(g, a, edge, off = 0) {
  const s = a.span(PAD + 170), n = Math.ceil((2 * s * a.R) / 2);
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const th = L.lerp(-s, s, i / n), q = a.pt(th, edge(th * a.R) + off);
    if (i === 0) g.moveTo(q.x, q.y); else g.lineTo(q.x, q.y);
  }
  g.lineTo(W + PAD + 500, H + PAD + 60); g.lineTo(-PAD - 500, H + PAD + 60); g.closePath();
}
function drawGrass(g, a, edge) {
  const r = L.rng('s21grass'), nz = L.makeNoise('s21dens');
  const um = a.span(PAD + 150) * a.R;
  g.fillStyle = INK;
  for (let u = -um; u < um; u += 1.6) {
    const d = 0.55 + 0.45 * nz.n2(u / 46, 1.1);
    if (!r.chance(0.35 + 0.6 * d)) continue;
    const calm = L.lerp(0.6, 1, sm((Math.abs(u) - 300) / 160));     // shorter under the text zone
    const uu = u + r.range(-0.8, 0.8), q = a.pt(uu / a.R, edge(uu) - 1.5);
    const len = 3.5 + (3.5 + 9 * d) * Math.pow(r(), 1.7) * calm;
    blade(g, q.x, q.y, r.gauss() * 0.34 + 0.12, len, r.range(1.2, 2.1), r.gauss() * 0.4);
  }
}
/** darker, denser tufts standing in front of the lit seam: they break it up into the ridge's ragged little rises */
function drawTufts(g, a, edge) {
  const r = L.rng('s21tufts');
  const um = a.span(PAD + 150) * a.R;
  g.fillStyle = INK;
  for (let i = 0; i < 74; i++) {
    const u = r.range(-um, um), calm = L.lerp(0.6, 1, sm((Math.abs(u) - 300) / 160));
    const n = r.int(6, 13), big = r.range(8, 16) * calm, wide = r.range(3, 9);
    for (let k = 0; k < n; k++) {
      const uu = u + r.range(-wide, wide), q = a.pt(uu / a.R, edge(uu) - 1.5);
      blade(g, q.x, q.y, r.gauss() * 0.5 + 0.1, big * r.range(0.5, 1), r.range(1.3, 2.4), r.gauss() * 0.5);
    }
  }
}
/** the backlit seam along the crest, drawn in white (tinted afterwards): a hairline plus the short, thin grass that glows through */
function drawSeam(g, a, edge) {
  const s = a.span(PAD + 160), n = Math.ceil((2 * s * a.R) / 2);
  g.strokeStyle = '#fff'; g.lineWidth = 1.8; g.lineJoin = 'round';
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const th = L.lerp(-s, s, i / n), q = a.pt(th, edge(th * a.R) + 0.3);
    if (i === 0) g.moveTo(q.x, q.y); else g.lineTo(q.x, q.y);
  }
  g.stroke();
  const r = L.rng('s21seam'), um = s * a.R;
  g.fillStyle = '#fff';
  for (let u = -um; u < um; u += 1.25) {
    if (!r.chance(0.8)) continue;
    const uu = u + r.range(-0.6, 0.6), q = a.pt(uu / a.R, edge(uu) - 0.5);
    g.globalAlpha = r.range(0.4, 1);
    blade(g, q.x, q.y, r.gauss() * 0.4 + 0.12, 2.5 + 5.5 * Math.pow(r(), 1.8), r.range(1, 1.6), r.gauss() * 0.4);
  }
  g.globalAlpha = 1;
}
/** low mound of scrub: lumpy leaf masses with a few twigs poking out */
function shrub(g, x, y, w, h, seed, twigs = true) {
  const r = L.rng(seed), n = Math.round(w / 3.4);
  g.beginPath(); g.ellipse(x, y + 1, w * 0.5, h * 0.72, 0, Math.PI, L.TAU); g.fill();
  for (let i = 0; i < n; i++) {
    const k = r.range(-1, 1), px = x + k * w * 0.5, top = h * (1 - k * k) * r.range(0.6, 1), rad = r.range(2.4, 4.8);
    g.beginPath(); g.arc(px, y - top + rad * 0.4, rad, 0, L.TAU); g.fill();
    if (twigs && r.chance(0.55)) {
      const ang = k * 0.9 + r.gauss() * 0.3, len = r.range(5, 10);
      blade(g, px, y - top, ang, len, 1.5, r.gauss() * 0.4);
      const ex = px + Math.sin(ang) * len, ey = y - top - Math.cos(ang) * len;
      g.beginPath(); g.ellipse(ex, ey, 2.6, 1.3, ang + r.range(-0.8, 0.8), 0, L.TAU); g.fill();
    }
  }
}
/** a clump of long grass leaves fanning out of one root, optionally with a couple of seed stalks */
function grassClump(g, x, y, size, seed, stalks = 0) {
  const r = L.rng(seed), n = r.int(15, 20);
  for (let i = 0; i < n; i++) {
    const ang = r.range(-1.15, 1.15);
    const len = size * r.range(0.45, 1) * (1 - 0.25 * Math.abs(ang));
    leaf(g, x + r.range(-5, 5), y + 2, ang, len, r.range(2.6, 4.2), ang * r.range(0.5, 1.3) + r.gauss() * 0.15);
  }
  for (let i = 0; i < stalks; i++) {
    const ang = r.range(-0.35, 0.45), len = size * r.range(1.1, 1.35), curl = r.range(0.25, 0.6) * (ang < 0 ? -1 : 1);
    let px = x + r.range(-3, 3), py = y, a2 = ang;
    g.lineWidth = 1.3; g.lineCap = 'round'; g.beginPath(); g.moveTo(px, py);
    for (let k = 1; k <= 12; k++) { a2 = ang + curl * Math.pow(k / 12, 2); px += (Math.sin(a2) * len) / 12; py -= (Math.cos(a2) * len) / 12; g.lineTo(px, py); }
    g.stroke();
    g.save(); g.translate(px, py); g.rotate(a2 + curl * 0.5);
    g.beginPath(); g.ellipse(0, -5, 2.1, 7.5, 0, 0, L.TAU); g.fill();
    g.restore();
  }
}
/** the faintest aerial perspective inside the mountain: nearer slopes, a shade darker, dusk mist pooled behind each */
function drawDepth(g, a) {
  const nz = L.makeNoise('s21hill');
  const s = a.span(PAD + 170), n = 300;
  const layers = [{ base: -210, amp: 46, len: 620 }, { base: -400, amp: 58, len: 760 }];
  layers.forEach((ly, k) => {
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R + ly.base - ly.amp - 20, a.R + ly.base + 150,
      [[0, 'rgba(40,14,46,0.34)'], [0.4, 'rgba(34,12,38,0.17)'], [1, 'rgba(22,8,24,0)']]);
    g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const th = L.lerp(-s, s, i / n), u = th * a.R;
      const q = a.pt(th, ly.base + ly.amp * nz.fbm(u / ly.len + k * 9.1, k * 3.3, 3) + 2.5 * nz.n2(u / 26, k + 5) + 1.2 * nz.n2(u / 7, k + 11));
      if (i === 0) g.moveTo(q.x, q.y); else g.lineTo(q.x, q.y);
    }
    g.lineTo(W + PAD + 500, H + PAD + 60); g.lineTo(-PAD - 500, H + PAD + 60); g.closePath();
    g.save(); g.shadowColor = '#070305'; g.shadowBlur = 22; g.fillStyle = '#070305'; g.fill(); g.restore();   // soft, misty top edge
  });
}
/** grass just under the crest, on our side of the ridge, catching the last light edge-on */
function drawLitFur(g, a, edge) {
  const r = L.rng('s21fur');
  const um = a.span(PAD + 150) * a.R;
  for (let i = 0; i < 4200; i++) {
    const u = U0 + r.gauss() * 620;
    if (Math.abs(u) > um) continue;
    const depth = Math.pow(r(), 1.6) * 30;
    const lat = Math.exp(-((u - U0) * (u - U0)) / (700 * 700));
    const al = (0.16 + 0.6 * r()) * lat * Math.pow(1 - depth / 32, 1.4);
    const q = a.pt(u / a.R, edge(u) - 2 - depth);
    g.fillStyle = L.rgba(r.chance(0.35) ? '#f2541b' : r.chance(0.5) ? '#c63c26' : '#9d2933', al);
    blade(g, q.x, q.y, r.gauss() * 0.4 + 0.12, r.range(4, 11), r.range(1.1, 1.9), r.gauss() * 0.4);
  }
}

// ───────────────────────── the old pine ─────────────────────────
/** one spray of needles: bristles fanning out of a small dark core, between angles a0..a1 (fractions of π, 0 = right, 1 = left, up) */
function needleTuft(g, x, y, rad, r, a0 = 0.03, a1 = 0.97) {
  g.beginPath(); g.ellipse(x, y, rad * 0.62, rad * 0.36, 0, 0, L.TAU); g.fill();
  g.lineWidth = 1.15; g.lineCap = 'round';
  g.beginPath();
  const n = 18 + (rad | 0);
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI * r.range(a0, a1), len = rad * r.range(0.65, 1.12);
    g.moveTo(x + Math.cos(ang) * rad * 0.2, y + Math.sin(ang) * rad * 0.1);
    g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len * 0.74);
  }
  g.stroke();
}
/** a thick, flat-bottomed pad of foliage (针叶团块): tiers of needle sprays piled into a low bristly dome */
function pinePad(g, cx, cy, w, h, r) {
  g.beginPath(); g.ellipse(cx, cy - h * 0.22, w * 0.45, h * 0.3, 0, 0, L.TAU); g.fill();
  const rows = h > 26 ? 3 : h > 17 ? 2 : 1;
  for (let j = 0; j < rows; j++) {
    const f = rows === 1 ? 0 : j / (rows - 1);                       // 0 = bottom row, 1 = top
    const ww = w * L.lerp(0.46, 0.2, f), n = Math.max(2, Math.round((ww * 2) / 11));
    for (let i = 0; i < n; i++) {
      const k = (i / (n - 1)) * 2 - 1, end = j === 0 && Math.abs(k) > 0.99;
      const x = cx + k * ww + r.range(-3, 3);
      const y = cy - h * (0.1 + 0.6 * f) - h * 0.2 * (1 - k * k) + r.range(-2, 2);
      // the sprays at the two ends of the bottom row droop outward a little
      needleTuft(g, x, y, r.range(11, 15.5) * (1 - 0.2 * Math.abs(k) * (1 - f)), r, end && k > 0 ? -0.14 : 0.03, end && k < 0 ? 1.14 : 0.97);
    }
  }
}
function drawPine(g) {
  const r = L.rng('s21pine');
  g.fillStyle = INK; g.strokeStyle = INK;
  // root flare and a stout, kinked trunk that carries on to the top
  limb(g, [[-27, 14], [-12, 3], [-2, -18]], 8, 14, 'ra'); limb(g, [[31, 12], [15, 1], [6, -20]], 7, 14, 'rb');
  limb(g, [[2, 16], [0, -22], [9, -62], [3, -102], [-13, -140], [-12, -180], [1, -215], [10, -250], [5, -288]], 29, 8, 'trunk');
  // the long arm reaching out level to the right, sagging a little on the way
  limb(g, [[-12, -146], [22, -165], [58, -158], [98, -168], [138, -161], [176, -170], [200, -165]], 12.5, 3, 'r1');
  limb(g, [[56, -158], [64, -170], [74, -176]], 3.4, 1.6, 'r1a'); limb(g, [[136, -161], [146, -173], [158, -178]], 3.2, 1.5, 'r1b');
  // a short drooping arm lower on the same side
  limb(g, [[6, -90], [30, -104], [58, -99], [84, -90]], 7.5, 2.4, 'r0');
  // left bough
  limb(g, [[-13, -168], [-50, -189], [-90, -184], [-130, -196]], 9.5, 3, 'l1');
  limb(g, [[-88, -184], [-92, -196], [-86, -204]], 3, 1.4, 'l1a');
  // a dead snag low on the left
  limb(g, [[-2, -108], [-28, -124], [-52, -119]], 5.5, 1.6, 'snag'); limb(g, [[-34, -123], [-42, -133], [-46, -143]], 2.4, 1, 'snag2');
  // upper boughs and the leader
  limb(g, [[3, -220], [36, -239], [74, -234], [106, -244]], 7.5, 2.5, 'r2');
  limb(g, [[2, -238], [-34, -255], [-68, -252]], 6.5, 2.4, 'l2');
  limb(g, [[6, -280], [18, -297], [30, -303]], 4.5, 2, 'top');
  // foliage in flat tiers: [centre x, underside y, width, thickness]
  const pads = [
    [62, -168, 96, 28], [138, -172, 106, 30], [194, -169, 66, 22],
    [68, -100, 64, 19],
    [-70, -194, 92, 28], [-126, -200, 70, 22],
    [60, -244, 98, 28], [108, -248, 58, 20],
    [-46, -260, 92, 28],
    [10, -296, 112, 32], [46, -292, 70, 22], [-2, -322, 62, 20],
  ];
  for (const [x, y, w, h] of pads) pinePad(g, x, y, w, h, r);
}

// ───────────────────────── the herb gatherer ─────────────────────────
/** small sprig of herb: thin stem with alternate lance-shaped leaves */
function sprig(g, x0, y0, x1, y1, bend, leaves) {
  const mx = (x0 + x1) / 2 + bend, my = (y0 + y1) / 2;
  g.lineWidth = 1.3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.stroke();
  for (let i = 0; i <= leaves; i++) {
    const t = 0.3 + (0.7 * i) / leaves, it = 1 - t;
    const x = it * it * x0 + 2 * it * t * mx + t * t * x1, y = it * it * y0 + 2 * it * t * my + t * t * y1;
    const dir = Math.atan2(2 * it * (my - y0) + 2 * t * (y1 - my), 2 * it * (mx - x0) + 2 * t * (x1 - mx));
    const side = i === leaves ? 0 : (i % 2 ? 1 : -1) * 0.95;
    const len = i === leaves ? 8 : 7.5 - i * 0.5;
    g.save(); g.translate(x, y); g.rotate(dir + side);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.45, -2.5, len, 0); g.quadraticCurveTo(len * 0.45, 2.5, 0, 0); g.fill();
    g.restore();
  }
}
/**
 * Three-quarter back view, facing away to the right, standing on ground that rises to the right (`slope` px per px).
 * Origin = the ground under the back foot; y up is negative. About 160 units tall to the crown of the hat.
 */
function drawGatherer(g, slope) {
  const gf = -18 * slope;                       // the front foot stands a little higher up the slope
  g.fillStyle = INK; g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round';
  // legs: trousers bound at the shin, cloth shoes
  soft(g, [[-13, -80], [-15, -55], [-14, -34], [-13, -14], [-14, -5], [-18, -1], [-18, 2], [0, 2], [1, -1], [-5, -6], [-5, -16], [-3, -36], [1, -58], [3, -80]]);
  soft(g, [[0, -80], [4, -60], [9, -44], [10, -28], [10, -12 + gf], [8, -4 + gf], [8, 1 + gf], [29, 1 + gf], [29, -2 + gf], [20, -6 + gf], [18.5, -14 + gf], [20, -30], [21.5, -45], [18, -62], [15, -80]]);
  // short belted tunic
  soft(g, [[-13, -128], [-2, -134], [9, -132], [15, -125], [16, -110], [13, -97], [13, -90], [18, -63], [4, -60], [-16, -62], [-11, -90], [-13, -104]]);
  // the pack basket (背篓): flared mouth with a thick rim, narrower rounded foot
  g.beginPath(); g.moveTo(-40, -133); g.lineTo(-7, -137); g.lineTo(-8, -86); g.quadraticCurveTo(-9, -80, -15, -80);
  g.lineTo(-27, -79.5); g.quadraticCurveTo(-32, -80, -33, -86); g.closePath(); g.fill();
  poly(g, [[-42.5, -134.2], [-5, -138.8], [-5, -134.4], [-42.5, -129.6]]);
  // herbs showing above the rim
  sprig(g, -36, -133, -58, -148, -3, 3);
  sprig(g, -32, -134, -51, -163, -5, 4);
  sprig(g, -26, -135, -40, -176, -4, 5);
  sprig(g, -21, -136, -29, -183, 3, 5);
  sprig(g, -17, -136.5, -23, -161, 2, 3);
  // neck, head, bamboo hat
  g.fillRect(1, -138, 8, 10);
  g.beginPath(); g.ellipse(6, -143, 8.6, 9.6, 0, 0, L.TAU); g.fill();
  g.beginPath(); g.moveTo(-14, -146.5); g.lineTo(4.5, -161); g.quadraticCurveTo(6.5, -162.2, 8.5, -160.6); g.lineTo(28, -149);
  g.quadraticCurveTo(7, -142.5, -14, -146.5); g.closePath(); g.fill();
  // near arm reaching down to the hoe
  limb(g, [[10, -124], [21, -106], [27, -92], [31.5, -79]], 9.5, 6, 'arm');
  g.beginPath(); g.arc(31.8, -77, 3.7, 0, L.TAU); g.fill();
  // 药锄 used as a staff: short shaft planted on the slope; at the top, by the hand, a small narrow blade that widens toward its edge
  const gx = 42, gy = -gx * slope + 1.5;
  g.lineWidth = 2.8; g.beginPath(); g.moveTo(31, -87); g.lineTo(gx, gy); g.stroke();
  poly(g, [[26, -84.6], [27.6, -89], [34.5, -90.2], [44, -88.4], [51.5, -83.6], [57.5, -74.5], [52, -70.8], [47.2, -78.2], [42.4, -82], [34, -83.6], [28, -83]]);
}
/** bamboo weave of the basket, picked out by the glow behind it (barely there) */
function drawWeave(g) {
  g.save();
  g.beginPath(); g.moveTo(-39, -129); g.lineTo(-8, -133.5); g.lineTo(-9, -84); g.lineTo(-32.5, -83); g.closePath(); g.clip();
  g.lineWidth = 0.8; g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const y = -126 + i * 5.2;
    g.strokeStyle = L.linear(g, -40, 0, -10, 0, [[0, 'rgba(242,84,27,0.5)'], [0.45, 'rgba(157,41,51,0.3)'], [1, 'rgba(157,41,51,0)']]);
    g.beginPath(); g.moveTo(-41, y + 2); g.quadraticCurveTo(-24, y + 1.6, -7, y - 2.2); g.stroke();
  }
  for (let i = 0; i < 5; i++) {
    const t = i / 5;
    g.strokeStyle = `rgba(200,62,34,${0.32 * (1 - t)})`;
    g.beginPath(); g.moveTo(-38.5 + t * 26, -131 - t * 4); g.lineTo(-32 + t * 20, -82); g.stroke();
  }
  g.restore();
}

// ───────────────────────── assemble the ridge layer ─────────────────────────
/** the thin lit edge of a silhouette layer: tint it, then knock out a copy of itself shifted by (dx,dy) */
function rimOf(layer, dx, dy, style) {
  const c = L.makeCanvas(layer.width, layer.height); c._pad = layer._pad;
  const g = c.getContext('2d');
  g.drawImage(layer, 0, 0);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = typeof style === 'function' ? style(g) : style; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-out'; g.drawImage(layer, dx, dy);
  g.globalCompositeOperation = 'source-over';
  return c;
}
function buildRidge(env) {
  const a = env.arc, edge = makeEdge();
  const full = (g) => g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
  const gp = a.pt(U0 / a.R, 0);
  const st = (x) => (x + PAD) / (W + PAD * 2);
  const on = (x, sink = 2) => a.yAt(x) + sink;
  const slope = -Math.tan(a.thetaAtX(MAN_X));        // the ground under the man rises to the right
  const manAt = (g, fn) => { g.save(); g.translate(MAN_X, on(MAN_X, 2)); g.scale(MAN_S, MAN_S); fn(g); g.restore(); };

  // 1) silhouette of the ground: the mountain mass and its fringe of grass
  const sil = L.makeLayer(PAD, (g) => {
    g.fillStyle = INK; bodyPath(g, a, edge); g.fill();
    drawGrass(g, a, edge);
  });
  // the backlit seam of the ridge: hottest where the sun went down, cooling to carmine at the far right
  const seam = L.makeLayer(PAD, (g) => drawSeam(g, a, edge));
  const sg = seam.getContext('2d');
  sg.save(); sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = 'source-in';
  sg.fillStyle = L.linear(sg, 0, 0, seam.width, 0, [
    [0, 'rgba(255,140,56,1)'], [st(gp.x - 60), 'rgba(255,200,132,1)'], [st(gp.x + 240), 'rgba(255,150,66,1)'],
    [st(960), 'rgba(250,104,36,1)'], [st(1420), 'rgba(226,72,40,0.95)'], [1, 'rgba(190,52,48,0.85)']]);
  sg.fillRect(0, 0, seam.width, seam.height);
  sg.restore();
  const seamGlow = L.blurred(seam, 6);

  // 2) everything that stands on the ridge, as one pure silhouette
  const objs = L.makeLayer(PAD, (g) => {
    g.fillStyle = INK; g.strokeStyle = INK;
    // scrub and small grass clumps along the ridge (none under the text zone)
    for (const [x, w, h] of [[-40, 56, 10], [286, 46, 7], [398, 40, 8], [706, 44, 5], [1236, 40, 5.5], [1470, 52, 8], [1508, 36, 9], [1702, 44, 8], [1880, 40, 7], [1968, 60, 11]]) shrub(g, x, on(x, 1), w, h, 'sh' + x);
    for (const [x, sz] of [[78, 26], [330, 22], [452, 20], [636, 16], [1318, 19], [1490, 24], [1668, 22], [1870, 26], [1990, 30]]) grassClump(g, x, on(x), sz, 'gc' + x, 0);
    // the two or three low clumps of grass on the right
    grassClump(g, 1392, on(1392), 56, 'A', 2);
    grassClump(g, 1586, on(1586), 46, 'B', 1);
    grassClump(g, 1784, on(1784), 62, 'C', 2);
    // the old pine, and the herb gatherer (both stand plumb)
    g.save(); g.translate(PINE_X, on(PINE_X, 3)); g.scale(PINE_S, PINE_S); drawPine(g); g.restore();
    manAt(g, () => drawGatherer(g, slope));
    // grass in front of the trunk and the feet
    const r = L.rng('s21front');
    g.fillStyle = INK;
    for (const [x0, x1, n] of [[PINE_X - 50, PINE_X + 54, 50], [MAN_X - 32, MAN_X + 60, 40]]) {
      for (let i = 0; i < n; i++) {
        const x = r.range(x0, x1);
        blade(g, x, on(x, 3), r.gauss() * 0.4 + 0.1, r.range(5, 13), r.range(1.3, 2.2), r.gauss() * 0.5);
      }
    }
  });
  // a hairline of light on the sides that face the glow (fades with distance from it)
  const objTint = (g) => L.radial(g, gp.x + PAD, gp.y + PAD, 60, 640, [[0, 'rgba(255,150,70,0.55)'], [0.45, 'rgba(242,84,27,0.36)'], [1, 'rgba(200,60,40,0)']]);
  const rimL = rimOf(objs, 1.1, 0.5, objTint), rimR = rimOf(objs, -1.1, 0.5, objTint);

  return L.makeLayer(PAD, (g) => {
    g.drawImage(sil, -PAD, -PAD);
    // inside the mass: a whisper of dusk layering, grassy tooth, and a breath of red where the glow wraps over the crest
    g.save(); bodyPath(g, a, edge, -6); g.clip();
    drawDepth(g, a);
    g.globalAlpha = 0.26;
    g.drawImage(L.polarNoiseLayer(env, PAD, { seed: 's21turf', scale: 15, sx: 1.2, sy: 1.5, octaves: 4, contrast: 1.7, res: 0.4,
      ramp: [[0, 'rgba(0,0,0,0)'], [0.56, 'rgba(0,0,0,0)'], [1, 'rgba(58,20,52,0.55)']] }), -PAD, -PAD);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'screen';
    g.fillStyle = L.radial(g, gp.x, gp.y, 0, 400, [[0, 'rgba(120,28,18,0.3)'], [0.4, 'rgba(90,18,22,0.1)'], [1, 'rgba(60,10,20,0)']]);
    full(g);
    g.restore();
    drawLitFur(g, a, edge);
    g.globalAlpha = 0.9; g.drawImage(seamGlow, -PAD, -PAD); g.globalAlpha = 1;
    g.drawImage(seam, -PAD, -PAD);
    drawTufts(g, a, edge);
    // silhouettes over the lit ridge, then their own hairline rims
    g.drawImage(objs, -PAD, -PAD);
    g.save(); g.beginPath(); g.rect(gp.x, -PAD, W + PAD - gp.x, H + PAD * 2); g.clip(); g.drawImage(rimL, -PAD, -PAD); g.restore();
    g.save(); g.beginPath(); g.rect(-PAD, -PAD, gp.x + PAD, H + PAD * 2); g.clip(); g.drawImage(rimR, -PAD, -PAD); g.restore();
    manAt(g, () => drawWeave(g));
  });
}

/** halation: the sky above the ridge, blurred, to be screened back over the frame so the light eats a little into every dark edge */
const HP = 40;
function buildHalo(env, sky) {
  const c = L.makeCanvas(W + HP * 2, H + HP * 2), g = c.getContext('2d');
  g.drawImage(sky, HP, HP);
  // stretch the border pixels outward so the blur does not fade toward the frame edges
  g.drawImage(sky, 0, 0, 1, H, 0, HP, HP, H); g.drawImage(sky, W - 1, 0, 1, H, W + HP, HP, HP, H);
  g.drawImage(sky, 0, 0, W, 1, HP, 0, W, HP);
  g.translate(HP, HP);
  env.arc.fillBelow(g, '#000', -1);                   // no light comes from inside the mountain
  return L.blurred(c, 15);
}

export default {
  name: '采药人剪影',
  tone: 'light',
  init(env) {
    const sky = buildSky(env);
    S = { sky, halo: buildHalo(env, sky), ridge: buildRidge(env) };
  },
  draw(ctx, env, p) {
    ctx.drawImage(S.sky, 0, 0);                              // the afterglow does not move
    const rot = L.lerp(-0.0055, 0.0065, p);                  // man and pine drift along the ridge
    L.blit(ctx, env, S.ridge, { rot });
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.11;
    ctx.drawImage(S.halo, -HP, -HP);
    ctx.restore();
  },
};
