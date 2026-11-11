// s21 — 供石盆景剪影. Dusk on the scholar's desk, backlit: the arc is the upper edge of a round incense stand whose top is
// dressed with moss and fine gravel. Everything below it is ink-black; against a rouge → aubergine glow stand a slender,
// perforated scholar's rock (瘦、皱、漏、透) on its fitted wooden stand, a dwarf pine in a shallow pot on a low table beside
// it, and — far off to the right, out of focus — one small vase.
//
// Recipe
//   sky   : per-pixel ramp of the distance above the arc (the glow hugs the table), taller and hotter behind the rock,
//           sinking toward aubergine on the right; dithered so the dark end never bands. Static.
//   ground: a few thousand individual gravel grains and moss cushions painted far → near, every grain a dark body with a
//           rouge crescent on the side facing the light, so the horizon reads as backlit granules, not as a drawn line.
//   rock  : implicit field (knobby blobs along an S-shaped spine + ridged noise − holes) shaded per pixel: grazing light on
//           the up-left flanks and on the far walls of the holes.
//   pine  : spline trunk and branches, three pads built from fans of single needles.
//   finish: rim light = shape minus the shape shifted away from the light; halation (the glow bleeding a few px into every
//           edge); depth of field (the right-hand side of the stand and the vase go soft).
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 64;
const FW = W + PAD * 2, FH = H + PAD * 2;
let S = null;

const INK = '#07040a';
const WINE = '#2d0719';          // what the black lifts to where the glow grazes it
const ROUGE = '#d81e4a';
const ROUGE_DIM = '#8a1436';
const SINK = -3;                 // every foot stands 3 px into the gravel
const GROUP = { x: 40, y: 150, w: 610, h: 590 };     // frame rect holding the rock and the pine
const VASE = { x: 1380, y: 440, w: 200, h: 220 };    // … and the vase

const sstep = (a, b, v) => { const t = L.clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// ───────────────────────── sky ─────────────────────────
function buildSky(env) {
  const a = env.arc, N = 1024, UMAX = 3.6;
  const ramp = L.makeRamp([[0, '#ee2c54'], [0.07, '#e0224c'], [0.3, '#d41d4a'], [0.7, '#aa174e'], [1.15, '#7a1552'], [1.7, '#4b0f41'], [2.4, '#24082c'], [3.6, '#16051c']]
    .map(([t, c]) => [t / UMAX, c]));
  const lut = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const c = ramp(i / (N - 1)); lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2]; }
  const img = new ImageData(W, H), d = img.data;
  let seed = 0x2545f491 | 0;
  for (let y = 0; y < H; y++) {
    const dy = y - a.cy;
    for (let x = 0; x < W; x++) {
      const dx = x - a.cx;
      const dr = Math.sqrt(dx * dx + dy * dy) - a.R;
      const bx = (x - 500) / 740, b = Math.exp(-bx * bx);          // the glow stands taller behind the rock and the pine
      let u = (dr > 0 ? dr : 0) / (290 * (0.74 + 0.56 * b));
      const rx = (x - 1150) / 900; u += 0.5 * (rx <= 0 ? 0 : rx >= 1 ? 1 : rx * rx * (3 - 2 * rx));   // … and sinks on the right
      let f = (u / UMAX) * (N - 1); if (f > N - 2) f = N - 2;
      const i0 = f | 0, t = f - i0, q = i0 * 3, o = (y * W + x) * 4;
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      const dn = (((seed >>> 9) & 0xffff) / 65535 - 0.5) * 1.7;
      d[o] = lut[q] + (lut[q + 3] - lut[q]) * t + dn;
      d[o + 1] = lut[q + 1] + (lut[q + 4] - lut[q + 1]) * t + dn;
      d[o + 2] = lut[q + 2] + (lut[q + 5] - lut[q + 2]) * t + dn;
      d[o + 3] = 255;
    }
  }
  const c = L.makeCanvas(W, H);
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

// ───────────────────────── ground: gravel + moss ─────────────────────────
/** one pebble: an irregular rounded blob; its body lifts toward wine near the glow, a rouge crescent on the up-left side */
function drawGrain(g, r, x, y, rad, lit, amb) {
  const n = r.int(5, 8), sq = r.range(0.66, 1), phi = r.range(-0.7, 0.7), cs = Math.cos(phi), sn = Math.sin(phi);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const ang = ((i + r.range(-0.32, 0.32)) / n) * L.TAU, rr = rad * r.range(0.74, 1.14);
    const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr * sq;
    pts.push([x + px * cs - py * sn, y + px * sn + py * cs]);
  }
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const p0 = pts[i], p1 = pts[(i + 1) % n], p2 = pts[(i + 2) % n];
    if (i === 0) g.moveTo((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);
    g.quadraticCurveTo(p1[0], p1[1], (p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2);
  }
  g.closePath();
  const body = amb > 0.02 ? L.mix(INK, WINE, L.clamp(amb)) : INK;
  if (lit > 0.025) {
    const ox = x + rad * 0.45, oy = y + rad * 0.5, thin = r.range(0.5, 0.66);
    const gr = g.createRadialGradient(ox, oy, rad * 0.6, ox, oy, rad * 1.7);
    gr.addColorStop(0, body); gr.addColorStop(thin, body);
    gr.addColorStop(thin + 0.2, L.mix(body, ROUGE_DIM, L.clamp(lit * 1.2)));
    gr.addColorStop(0.97, L.mix(body, lit > 1 ? '#f0345a' : ROUGE, L.clamp(lit)));
    g.fillStyle = gr;
  } else g.fillStyle = body;
  g.fill();
}

/** one moss cushion in a frame standing on the arc: a low dome bristling with leaf tips, some of them catching the light */
function drawMoss(g, r, w, hgt, lit, amb = 0) {
  const body = amb > 0.02 ? L.mix(INK, WINE, L.clamp(amb)) : INK;
  g.lineCap = 'round'; g.fillStyle = body;
  g.beginPath(); g.ellipse(0, 1, w / 2, hgt + 1, 0, Math.PI, L.TAU); g.lineTo(w / 2, 7); g.lineTo(-w / 2, 7); g.closePath(); g.fill();
  const n = Math.round(w * 1.6);
  for (let i = 0; i < n; i++) {
    const u = r(), ang = Math.PI * (1 + u), sx = (Math.cos(ang) * w) / 2, sy = Math.sin(ang) * hgt;
    const dir = -Math.PI / 2 + (u - 0.5) * 1.5 + r.gauss() * 0.4, len = r.range(1.5, 4.8);
    const ex = sx + Math.cos(dir) * len, ey = sy + Math.sin(dir) * len;
    g.strokeStyle = body; g.lineWidth = r.range(0.8, 1.6);
    g.beginPath(); g.moveTo(sx, sy + 1.5); g.lineTo(ex, ey); g.stroke();
    if (lit > 0.05 && u < 0.66 && r.chance(0.6)) {
      g.strokeStyle = L.rgba(r.chance(0.35) ? ROUGE : ROUGE_DIM, L.clamp(lit * r.range(0.45, 1.2)));
      g.lineWidth = r.range(0.7, 1.3);
      g.beginPath(); g.moveTo(L.lerp(sx, ex, 0.35), L.lerp(sy, ey, 0.35)); g.lineTo(ex, ey); g.stroke();
    }
  }
}

/** how strongly the glow grazes the table top at (theta, depth below the horizon): strongest left of the crest */
const sideAt = (th) => L.lerp(0.2, 1, L.smooth((0.32 - th) / 0.6));

function makeGround(env) {
  const a = env.arc, r = L.rng('s21ground'), nz = L.makeNoise('s21g');
  const half = a.span(PAD + 40) * a.R;
  const litAt = (th, d) => sideAt(th) * Math.exp(-d / 34) * (0.6 + 0.4 * nz.n2((th * a.R) / 150, 4.2));
  const lump = (s) => 3.3 * nz.fbm(s / 130, 0.3, 2);                 // the horizon is lumpy, not ruled
  const items = [];
  // rows of grains: packed tight at the horizon (we look across the surface), opening up and growing toward the lens
  const rows = [0, 0.8, 2, 3.5, 5.5, 8, 11, 15, 20, 26, 33, 41, 51, 63, 77, 93, 112, 134, 160];
  rows.forEach((d, k) => {
    const size = 11 + d * 0.085;
    let s = -half + r.range(0, size);
    while (s < half) {
      let rad = size * 0.5 * Math.exp(r.gauss() * 0.5);
      if (r.chance(0.07)) rad *= r.range(1.7, 2.5);                    // the odd big pebble
      rad = L.clamp(rad, 2.2, 30);
      const th = s / a.R;
      let top = -d + lump(s) * Math.exp(-d / 30) + (k < 2 ? r.range(-3, 2.2) : r.range(-3, 3));
      if (k < 3) top = Math.min(top, -7 + 1.7 * rad, 5.5);            // no pebble floats above its neighbours
      items.push({ kind: 'g', d, th, rad, top, lit: litAt(th, d) * (0.12 + 1.7 * Math.pow(r(), 2.4)), amb: sideAt(th) * Math.exp(-d / 62) * r.range(0.55, 1) });
      s += rad * r.range(1.0, 1.9);
    }
  });
  // moss cushions scattered over the gravel
  for (const d of [0, 0.8, 2, 5.5, 11, 20, 33]) {
    let s = -half + r.range(0, 200);
    while (s < half) {
      const w = r.range(34, 124), hgt = r.range(3, 6.5), th = s / a.R;
      if (nz.fbm(s / 260 + 3, d / 9 + 1.7, 2) > 0.0) {
        items.push({ kind: 'm', d, th, w, hgt, top: Math.min(2.2, -d + lump(s) * Math.exp(-d / 30) + r.range(-2, 1.5)), lit: litAt(th, d), amb: sideAt(th) * Math.exp(-d / 62) * 0.8 });
      }
      s += w * r.range(0.9, 2.4);
    }
  }
  items.sort((p, q) => p.d - q.d);
  return items;
}
function drawGround(g, env, items, seed) {
  const a = env.arc, r = L.rng(seed);
  for (const it of items) {
    if (it.kind === 'g') { const p = a.pt(it.th, it.top - it.rad * 0.85); drawGrain(g, r, p.x, p.y, it.rad, it.lit, it.amb); }
    else a.at(g, it.th, it.top - it.hgt, () => drawMoss(g, r, it.w, it.hgt, it.lit, it.amb));
  }
}

// ───────────────────────── scholar's rock ─────────────────────────
const ROX = 135, ROY = 425, RKW = 270, RKH = 445;   // the rock patch; its base (centre of the stand's top) sits at (ROX, ROY)
function buildRock(th) {
  const nA = L.makeNoise('s21rkA'), nB = L.makeNoise('s21rkB');
  const pre = (arr) => arr.map(([cx, cy, rx, ry, rot = 0]) => ({ cx, cy, rx, ry, c: Math.cos(rot), s: Math.sin(rot), m: Math.min(rx, ry) }));
  // x to the right, y UP from the base. 云头雨脚: a narrow foot, a wandering waist, a heavy overhanging head
  const blobs = pre([
    [4, 26, 36, 38], [-8, 80, 30, 42, -0.2], [-26, 132, 37, 34], [6, 172, 31, 36], [34, 214, 36, 28, 0.4],
    [8, 252, 28, 36], [-12, 306, 52, 44, -0.3], [28, 338, 30, 30], [-2, 368, 20, 24, 0.2], [-54, 290, 24, 15, 0.3],
  ]);
  const holes = pre([[-12, 304, 17, 23, -0.4], [24, 230, 10, 15, 0.5], [-22, 128, 12, 18, 0.2], [8, 62, 6, 10], [27, 342, 7, 9]]);
  const F = new Float32Array(RKW * RKH), K = 9;
  for (let j = 0; j < RKH; j++) for (let i = 0; i < RKW; i++) {
    const x = i - ROX, y = ROY - j;
    const wx = x + 6 * nA.n2(x / 55 + 3.1, y / 55), wy = y + 6 * nA.n2(x / 55 - 9.4, y / 55 + 5.2);
    let acc = 1e-30;
    for (const b of blobs) {
      const dx = wx - b.cx, dy = wy - b.cy, u = (dx * b.c + dy * b.s) / b.rx, v = (-dx * b.s + dy * b.c) / b.ry;
      acc += Math.exp(((1 - Math.sqrt(u * u + v * v)) * b.m) / K);
    }
    let f = K * Math.log(acc);
    f += 15 * (nA.ridged(wx / 50, wy / 62, 2) - 0.5) + 2.2 * nB.fbm(wx / 15, wy / 15, 2);   // crags
    f -= 5 * Math.pow(nB.ridged(wx / 17 + 20, wy / 95, 2), 3);                             // upright furrows (皱)
    for (const h of holes) {
      const dx = wx - h.cx, dy = wy - h.cy, u = (dx * h.c + dy * h.s) / h.rx, v = (-dx * h.s + dy * h.c) / h.ry;
      const hd = (Math.sqrt(u * u + v * v) - 1) * h.m + 2.5 * nB.n2(wx / 12, wy / 12 + 40);
      if (hd < f) f = hd;
    }
    F[j * RKW + i] = f;
  }
  const img = new ImageData(RKW, RKH), d = img.data;
  const ink = L.parseColor(INK), hot = L.parseColor('#e3264f'), dim = L.parseColor(ROUGE_DIM);
  const cs = Math.cos(th), sn = Math.sin(th), lx = -0.8, ly = -0.6;
  for (let j = 1; j < RKH - 1; j++) for (let i = 1; i < RKW - 1; i++) {
    const k = j * RKW + i, f = F[k];
    if (f < -3) continue;
    if (-(i - ROX) * sn + (j - ROY) * cs > 4) continue;            // the foot disappears into the stand
    const gx = (F[k + 1] - F[k - 1]) * 0.5, gy = (F[k + RKW] - F[k - RKW]) * 0.5, gm = Math.hypot(gx, gy) + 1e-3;
    const dist = f / gm;
    let al = dist / 1.3 + 0.5; if (al <= 0) continue; if (al > 1) al = 1;
    const ndl = Math.max(0, (-gx * lx - gy * ly) / gm), dd = dist > 0 ? dist : 0;
    const tex = 0.4 + 1.1 * nB.ridged(i / 6.5, j / 6.5, 2), vary = 0.6 + 0.4 * nA.n2(i / 42 + 7, j / 42);
    const core = ndl * Math.exp(-dd / 2.4) * vary, glow = ndl * Math.exp(-dd / 9) * tex * 0.36 * vary;
    const a1 = Math.min(1, glow + core * 0.9), a2 = Math.min(1, core * core * 0.9), o = k * 4;
    d[o] = ink[0] + (dim[0] - ink[0]) * a1 + (hot[0] - dim[0]) * a2;
    d[o + 1] = ink[1] + (dim[1] - ink[1]) * a1 + (hot[1] - dim[1]) * a2;
    d[o + 2] = ink[2] + (dim[2] - ink[2]) * a1 + (hot[2] - dim[2]) * a2;
    d[o + 3] = al * 255;
  }
  const c = L.makeCanvas(RKW, RKH);
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

// ───────────────────────── furniture (paths in a frame standing on the arc: −y is up) ─────────────────────────
/** 随形木座: lipped top, recessed waist, cusped apron, two short hoof feet */
function standPath(g, hw, hgt) {
  const top = -hgt;
  g.beginPath();
  g.moveTo(-hw, top + 3); g.quadraticCurveTo(-hw, top, -hw + 4, top); g.lineTo(hw - 5, top - 1); g.quadraticCurveTo(hw, top - 1, hw, top + 3);
  g.lineTo(hw - 1, top + 7); g.lineTo(hw - 7, top + 8); g.lineTo(hw - 8, top + 13); g.lineTo(hw - 2, top + 15);
  g.quadraticCurveTo(hw + 1, -8, hw - 3, 0); g.lineTo(hw - 15, 0); g.quadraticCurveTo(hw - 13, -7, hw - 20, top + 21);
  g.quadraticCurveTo(0, top + 16, -hw + 20, top + 21);
  g.quadraticCurveTo(-hw + 13, -7, -hw + 15, 0); g.lineTo(-hw + 3, 0); g.quadraticCurveTo(-hw - 1, -8, -hw + 2, top + 15);
  g.lineTo(-hw + 8, top + 13); g.lineTo(-hw + 7, top + 8); g.lineTo(-hw + 1, top + 7);
  g.closePath();
}
/** 矮几: a thin top, a narrow apron, two legs turning in at the foot */
function tablePath(g, hw, hgt) {
  const top = -hgt;
  g.beginPath();
  g.moveTo(-hw - 3, top); g.lineTo(hw + 3, top); g.lineTo(hw + 3, top + 5); g.lineTo(hw - 4, top + 6);
  g.lineTo(hw - 3, -5); g.quadraticCurveTo(hw - 3, -1, hw - 9, 0); g.lineTo(hw - 14, 0); g.lineTo(hw - 12, top + 13);
  g.quadraticCurveTo(hw - 14, top + 10, hw - 26, top + 10); g.lineTo(-hw + 26, top + 10);
  g.quadraticCurveTo(-hw + 14, top + 10, -hw + 12, top + 13); g.lineTo(-hw + 14, 0); g.lineTo(-hw + 9, 0); g.quadraticCurveTo(-hw + 3, -1, -hw + 3, -5);
  g.lineTo(-hw + 4, top + 6); g.lineTo(-hw - 3, top + 5);
  g.closePath();
}
/** 浅盆: a shallow rectangular pot, sides leaning out to a lipped rim, on two small feet */
function potPath(g, y0) {
  g.beginPath();
  g.rect(-44, y0 - 4, 16, 5); g.rect(28, y0 - 4, 16, 5);
  g.moveTo(-50, y0 - 4); g.quadraticCurveTo(-56, y0 - 14, -58, y0 - 26); g.lineTo(-63, y0 - 27); g.lineTo(-63, y0 - 31);
  g.lineTo(63, y0 - 31); g.lineTo(63, y0 - 27); g.lineTo(58, y0 - 26); g.quadraticCurveTo(56, y0 - 14, 50, y0 - 4);
  g.closePath();
}
/** a small 胆瓶 on its stand */
function vasePath(g) {
  g.beginPath();
  g.moveTo(-24, 0); g.lineTo(-22, -5); g.lineTo(-19, -5); g.lineTo(-19, -8); g.lineTo(19, -8); g.lineTo(19, -5); g.lineTo(22, -5); g.lineTo(24, 0); g.closePath();
  g.moveTo(-13, -8);
  g.bezierCurveTo(-14, -12, -30, -18, -30, -40); g.bezierCurveTo(-30, -62, -9, -66, -8, -86);
  g.lineTo(-7.5, -112); g.quadraticCurveTo(-8, -117, -11, -119);
  g.lineTo(11, -119); g.quadraticCurveTo(8, -117, 7.5, -112); g.lineTo(8, -86);
  g.bezierCurveTo(9, -66, 30, -62, 30, -40); g.bezierCurveTo(30, -18, 14, -12, 13, -8);
  g.closePath();
}

// ───────────────────────── pine ─────────────────────────
/** Catmull-Rom through [[x, y, width] …] → dense [[x, y, width] …] */
function spline(pts, step = 3) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t;
      const c = (k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      out.push([c(0), c(1), Math.max(0.8, c(2))]);
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}
/** a gnarled limb: the spline swept with its width, bark wobbling along both edges */
function limb(g, pts, seed, wob = 0.13) {
  const P = spline(pts), n = P.length, nz = L.makeNoise(seed), A = [], B = [];
  for (let i = 0; i < n; i++) {
    const p = P[Math.max(0, i - 2)], q = P[Math.min(n - 1, i + 2)];
    let nx = -(q[1] - p[1]), ny = q[0] - p[0]; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
    const w = P[i][2] * 0.5 * (1 + wob * nz.n2(i * 0.09, 1.3) + wob * 0.7 * nz.n2(i * 0.31, 7.7));
    const k = P[i][2] * 0.12 * nz.n2(i * 0.05, 21.4);
    A.push([P[i][0] + nx * (w + k), P[i][1] + ny * (w + k)]); B.push([P[i][0] - nx * (w - k), P[i][1] - ny * (w - k)]);
  }
  g.beginPath(); g.moveTo(A[0][0], A[0][1]);
  for (let i = 1; i < n; i++) g.lineTo(A[i][0], A[i][1]);
  for (let i = n - 1; i >= 0; i--) g.lineTo(B[i][0], B[i][1]);
  g.closePath(); g.fill();
}
/** a pad of foliage (云片): tufts of single needles fanning up from twigs laid along a shallow dome */
function pinePad(g, r, cx, cy, w, tilt) {
  const n = Math.max(4, Math.round(w / 12)), cs = Math.cos(tilt), sn = Math.sin(tilt);
  g.lineCap = 'round'; g.strokeStyle = INK; g.fillStyle = INK;
  for (let layer = 0; layer < 2; layer++) for (let i = 0; i <= n; i++) {
    const u = i / n + r.range(-0.03, 0.03), e = 2 * u - 1;
    if (layer === 1 && Math.abs(e) > 0.6) continue;
    const lx = (e * w) / 2, ly = -(1 - e * e) * w * 0.1 - layer * 11 + r.range(-3, 3);
    const tx = cx + lx * cs - ly * sn, ty = cy + lx * sn + ly * cs;
    g.beginPath(); g.ellipse(tx, ty, r.range(6, 9), r.range(4, 6), tilt, 0, L.TAU); g.fill();
    const cnt = Math.round(r.range(26, 38)), lean = e * 0.8 + tilt;
    for (let k = 0; k < cnt; k++) {
      const ang = -Math.PI / 2 + L.clamp(lean + r.gauss() * 0.52, -1.75, 1.75);
      const len = r.range(13, 24), bend = r.range(-0.2, 0.2);
      g.lineWidth = r.range(1.0, 1.7);
      g.beginPath(); g.moveTo(tx + r.range(-3, 3), ty + r.range(-2, 2));
      g.quadraticCurveTo(tx + Math.cos(ang + bend) * len * 0.55, ty + Math.sin(ang + bend) * len * 0.55, tx + Math.cos(ang) * len, ty + Math.sin(ang) * len);
      g.stroke();
    }
  }
}

// ───────────────────────── compositing helpers ─────────────────────────
/** a canvas covering the frame rect q = {x, y, w, h}; draw into it with frame coordinates */
function crop(q, draw) {
  const c = L.makeCanvas(q.w, q.h), g = c.getContext('2d');
  g.translate(-q.x, -q.y);
  if (draw) draw(g);
  return c;
}
/** rim light: the part of `layer` that is not covered by the same shapes (plus `occluder`) shifted away from the light */
function addRim(layer, occluder, sx, sy, color, alpha, soft, breakup) {
  const c = L.makeCanvas(layer.width, layer.height), g = c.getContext('2d');
  g.drawImage(layer, 0, 0);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-out'; g.drawImage(layer, sx, sy);
  if (occluder) g.drawImage(occluder, sx, sy);
  if (breakup) { g.globalCompositeOperation = 'destination-in'; g.drawImage(breakup, 0, 0, c.width, c.height); }
  const out = soft ? L.blurred(c, soft) : c;
  const lg = layer.getContext('2d');
  lg.save(); lg.setTransform(1, 0, 0, 1, 0, 0); lg.globalCompositeOperation = 'source-atop'; lg.globalAlpha = alpha; lg.drawImage(out, 0, 0); lg.restore();
}
/** halation: the glow behind bleeds a few px into every edge (thin things — needles, twigs — soak up the most) */
function addWrap(layer, q, sky, alpha) {
  const c = L.makeCanvas(q.w, q.h), g = c.getContext('2d');
  g.filter = 'blur(12px)'; g.drawImage(sky, -q.x, -q.y); g.filter = 'none';
  g.globalCompositeOperation = 'destination-in'; g.drawImage(layer, 0, 0);
  g.globalCompositeOperation = 'destination-out'; g.drawImage(L.blurred(layer, 7), 0, 0);
  const lg = layer.getContext('2d');
  lg.save(); lg.setTransform(1, 0, 0, 1, 0, 0); lg.globalAlpha = alpha; lg.drawImage(c, 0, 0); lg.restore();
}
/** copy of a canvas whose alpha follows the horizontal stops [[frameX, alpha] …]; x0 = frame x of its left edge */
function maskX(src, x0, stops) {
  const c = L.makeCanvas(src.width, src.height), g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  const gr = g.createLinearGradient(0, 0, src.width, 0);
  for (const [x, al] of stops) gr.addColorStop(L.clamp((x - x0) / src.width), `rgba(0,0,0,${al})`);
  g.fillStyle = gr; g.fillRect(0, 0, src.width, src.height);
  return c;
}

function buildSilhouette(env, sky) {
  const a = env.arc;
  const thR = a.thetaAtX(497), thP = a.thetaAtX(318), thV = a.thetaAtX(1482);
  const loc = (th, lx, ly) => { const p = a.pt(th, SINK), c = Math.cos(th), s = Math.sin(th); return [p.x + lx * c - ly * s, p.y + lx * s + ly * c]; };
  const STAND_H = 32;

  // ── the rock, upright on its tilted stand ──
  const rb = loc(thR, 0, -STAND_H), base = { x: Math.round(rb[0]), y: Math.round(rb[1]) };
  const rock = crop(GROUP, (g) => g.drawImage(buildRock(thR), base.x - ROX, base.y - ROY));

  // ── stand, low table, pot, trunk and branches ──
  const B = loc(thP, 16, -61);
  const T = (pts) => pts.map(([x, y, w]) => [B[0] + x, B[1] + y, w]);
  const vec = crop(GROUP, (g) => {
    g.fillStyle = INK;
    a.at(g, thR, SINK, () => { standPath(g, 56, STAND_H); g.fill(); });
    a.at(g, thP, SINK, () => {
      tablePath(g, 76, 24); g.fill(); potPath(g, -24); g.fill();
      g.translate(5, -55); drawMoss(g, L.rng('s21potmoss'), 104, 8, 0);
    });
    g.fillStyle = INK;
    limb(g, T([[5, 10, 40], [0, 0, 31], [-9, -30, 24], [-36, -56, 20], [-53, -92, 17.5], [-38, -128, 15], [-40, -164, 12], [-60, -192, 8.5], [-80, -212, 5]]), 's21trunk');
    limb(g, T([[-48, -88, 12], [-90, -100, 8.5], [-128, -96, 6.5], [-170, -90, 3.5]]), 's21br1');
    limb(g, T([[-40, -124, 10.5], [-10, -134, 7.5], [18, -128, 5.5], [46, -118, 3]]), 's21br2');
    limb(g, T([[-56, -186, 6], [-84, -200, 4.5], [-108, -204, 2.5]]), 's21br3');
    limb(g, T([[-62, -194, 5], [-50, -210, 3.5], [-36, -214, 2.5]]), 's21br4');
    // exposed roots gripping the soil
    limb(g, T([[-6, -9, 11], [-24, 0, 7], [-38, 5, 3]]), 's21root1', 0.1);
    limb(g, T([[8, -7, 10], [22, 1, 6], [33, 5, 3]]), 's21root2', 0.1);
  });
  const breakup = L.noiseTex(GROUP.w, GROUP.h, { seed: 's21brk', scale: 46, octaves: 2, res: 0.5, contrast: 1.9, ramp: [[0, 'rgba(0,0,0,0.08)'], [0.45, 'rgba(0,0,0,0.55)'], [1, 'rgba(0,0,0,1)']] });
  addRim(vec, rock, 5, 4, ROUGE_DIM, 0.5, 2.2, breakup);
  addRim(vec, rock, 1.8, 1.4, '#e3264f', 0.85, 0.6, breakup);

  const needles = crop(GROUP, (g) => {
    const r = L.rng('s21needles');
    pinePad(g, r, B[0] - 138, B[1] - 100, 126, -0.04);
    pinePad(g, r, B[0] + 20, B[1] - 132, 82, 0.12);
    pinePad(g, r, B[0] - 72, B[1] - 216, 104, 0.03);
  });
  addRim(needles, null, 1.4, 1.1, '#c21c45', 0.4, 0.5, breakup);

  const group = crop(GROUP, (g) => { g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(rock, 0, 0); g.drawImage(vec, 0, 0); g.drawImage(needles, 0, 0); });
  addWrap(group, GROUP, sky, 0.3);

  // ── the vase, far off ──
  const vase = crop(VASE, (g) => { g.fillStyle = INK; a.at(g, thV, SINK, () => { g.scale(1.04, 1.04); vasePath(g); g.fill(); }); });
  addRim(vase, null, 4, 3, ROUGE_DIM, 0.45, 2, null);
  addRim(vase, null, 1.6, 1.2, '#d42049', 0.6, 0.7, null);
  addWrap(vase, VASE, sky, 0.3);

  // ── ground + objects, far to near ──
  const items = makeGround(env), far = items.filter((it) => it.d < 1.5), near = items.filter((it) => it.d >= 1.5);
  const sil = L.makeLayer(PAD, (g) => {
    // the table: ink, lifting to wine just under the lit edge on the side the glow comes from
    a.fillBelow(g, INK, -7);
    g.save(); a.clipBelow(g, -7);
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 200, a.R, [[0, L.rgba(WINE, 0)], [0.6, L.rgba(WINE, 0.3)], [1, L.rgba(WINE, 0.9)]]);
    g.fillRect(-PAD, -PAD, FW, FH);
    g.fillStyle = L.linear(g, 700, 0, W + PAD, 0, [[0, L.rgba(INK, 0)], [1, L.rgba(INK, 0.85)]]);
    g.fillRect(-PAD, -PAD, FW, FH);
    g.restore();
    drawGround(g, env, far, 's21far');
    g.drawImage(group, GROUP.x, GROUP.y); g.drawImage(vase, VASE.x, VASE.y);
    drawGround(g, env, near, 's21near');
    // the glow bleeding over the horizon itself
    g.globalCompositeOperation = 'source-atop'; g.lineWidth = 5;
    [[3, 0.16], [-1, 0.13], [-5, 0.09], [-9, 0.05], [-13, 0.025]].forEach(([dr, al]) => {
      g.strokeStyle = L.linear(g, 0, 0, W, 0, [[0, L.rgba('#e0224c', al)], [0.45, L.rgba('#e0224c', al)], [1, L.rgba('#b41a4c', al * 0.4)]]);
      a.stroke(g, dr);
    });
    g.globalCompositeOperation = 'source-over';
  });

  // ── depth of field: sharp from the pine to past the crest; the right-hand side of the table and the vase fall away ──
  const M = 24, D = { x: 900 - M, y: 430 - M, w: W + PAD - 900 + M, h: 600 + M * 2 };
  const src = crop(D, (g) => g.drawImage(sil, -PAD, -PAD));
  const mixed = L.makeCanvas(D.w, D.h), mg = mixed.getContext('2d');
  mg.globalCompositeOperation = 'lighter';
  mg.drawImage(maskX(src, D.x, [[1000, 1], [1400, 0]]), 0, 0);
  mg.drawImage(maskX(L.blurred(src, 2.2), D.x, [[1000, 0], [1400, 1], [1850, 0]]), 0, 0);
  mg.drawImage(maskX(L.blurred(src, 5.5), D.x, [[1400, 0], [1850, 1]]), 0, 0);
  const sg = sil.getContext('2d');
  sg.clearRect(900, 430, D.w - M, 600);
  sg.drawImage(mixed, M, M, D.w - M, 600, 900, 430, D.w - M, 600);
  return sil;
}

export default {
  name: '供石盆景剪影',
  tone: 'light',
  init(env) {
    const sky = buildSky(env);
    S = { sky, sil: buildSilhouette(env, sky) };
  },
  draw(ctx, env, p) {
    // the sky holds still; rock, pine and the grains of the table top slide along the arc
    const rot = L.lerp(-0.0045, 0.0045, p);
    ctx.drawImage(S.sky, 0, 0);
    L.blit(ctx, env, S.sil, { rot });
  },
};
