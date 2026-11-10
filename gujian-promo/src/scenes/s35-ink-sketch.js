// s35 — 白描速写. A fast pen-and-brush sketch on a yellowed old sheet:
// the arc is ONE loaded brush stroke — the back (hand-rail line) of a stone arch bridge — with its pressure pulses,
// a dry "flying white" stretch and a re-inked join. Under it, dashed off at speed: the arch barrel and its hatched shadow,
// a bamboo clump, a pavilion with upturned eaves, reeds, a few strokes of water. Above it: only paper + two pale hills.
// Everything is drawn once in init() (paper → wash → pale ink → dark ink) and blitted with a tiny rotation.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 130;
const INK = '#1d1a16', INK_L = '#6a6258', PAPER = '#e6d9b9', SPOT = '#b39a68';
const LW = 1.5;                              // global line weight: the shot lasts 6 frames, so the hand is bold
const AX = 948, AY = 972, AR = 300;          // arch opening: centre on the waterline, radius
const PVX = 1530, PVY = 1034, PVS = 0.95;    // pavilion: centre of its plinth on the ground, scale
const NZ = L.makeNoise('s35pen');
const SEED_BAMBOO = 's35bamboo-1', SEED_REEDS = 's35reeds-1';
let S = null;

const bump = (x, c, w) => { const d = (x - c) / w; return Math.exp(-d * d); };
const sstep = (a, b, x) => L.smooth((x - a) / (b - a));

// ───────────────────────── the hand ─────────────────────────
/**
 * One pull of the pen: blunt wet head, thinner fast middle, flicked tail; width breathes, line may skip.
 * opts: w, seed, prof ('pen' | 'leaf' | 'flat'), tin/tout (taper fractions), head, wob, gap (0..0.5 → skips), jit, step, abs (ignore LW)
 */
function pen(g, pts, o = {}) {
  const w = (o.w === undefined ? 2.2 : o.w) * (o.abs ? 1 : LW), seed = o.seed === undefined ? 1 : o.seed;
  const p = L.smoothPath(pts, o.step || 3);
  const n = p.length; if (n < 2) return;
  const prof = o.prof || 'pen', tin = o.tin === undefined ? 0.07 : o.tin, tout = o.tout === undefined ? 0.3 : o.tout;
  const head = o.head === undefined ? 1.35 : o.head, wob = o.wob === undefined ? 0.36 : o.wob, gap = o.gap || 0, jit = o.jit || 0;
  const minW = o.minW === undefined ? 0.8 : o.minW, fq = o.freq || 5, sd = seed * 0.731, gf = o.gapFreq || 4;
  g.lineCap = 'round';
  let px = p[0][0], py = p[0][1];
  for (let i = 1; i < n; i++) {
    const u = i / (n - 1);
    let k;
    if (prof === 'leaf') k = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.62)), 0.85) + 0.07;
    else if (prof === 'flat') k = 1;
    else {
      k = u < tin ? L.lerp(head * 0.75, head, u / tin) : u < tin * 3 ? L.lerp(head, 0.86, (u - tin) / (tin * 2)) : 0.86;
      if (tout > 0 && u > 1 - tout) k *= Math.pow((1 - u) / tout, 0.75);
    }
    k *= 1 + wob * NZ.n2(u * fq + sd * 5.3, sd * 2.9);
    const x = p[i][0] + (jit ? jit * NZ.n2(i * 0.17 + sd, 5.5 + sd) : 0), y = p[i][1] + (jit ? jit * NZ.n2(i * 0.17 - sd, 9.5 - sd) : 0);
    if (!(gap > 0 && NZ.n2(u * gf + sd * 7.1, 3.3 + sd) > 1 - gap * 2)) {
      g.lineWidth = Math.max(minW, w * k);
      g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke();
    }
    px = x; py = y;
  }
}
/** an ink blot with a lumpy outline */
function blot(g, x, y, rad, seed) {
  g.beginPath();
  for (let i = 0; i <= 20; i++) {
    const a = (i / 20) * L.TAU, rr = rad * (1 + 0.3 * NZ.n2(Math.cos(a) * 1.4 + seed, Math.sin(a) * 1.4 - seed));
    const X = x + Math.cos(a) * rr, Y = y + Math.sin(a) * rr * 0.9;
    if (i) g.lineTo(X, Y); else g.moveTo(X, Y);
  }
  g.closePath(); g.fill();
}
/** droplets flung off the nib in one direction */
function spatter(g, r, x, y, ang, n, reach) {
  for (let i = 0; i < n; i++) {
    const d = reach * Math.pow(r(), 0.7), a = ang + r.gauss() * 0.35;
    blot(g, x + Math.cos(a) * d, y + Math.sin(a) * d, L.lerp(3.6, 1, d / reach) * r.range(0.6, 1.3), i * 3.3 + x);
  }
}
/** zig-zag scribble from A to B (pen never lifted) */
function zig(g, r, x0, y0, x1, y1, amp, pitch, o = {}) {
  const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(len / pitch));
  const ux = (x1 - x0) / len, uy = (y1 - y0) / len, sk = o.skew || 0;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, s = (i % 2 ? 1 : -1) * amp * r.range(0.45, 1.25) * (o.fade ? 1 - t * o.fade : 1);
    pts.push([x0 + ux * len * t - uy * s + ux * s * sk, y0 + uy * len * t + ux * s + uy * s * sk]);
  }
  pen(g, pts, { w: 1.8, tin: 0.03, tout: 0.1, wob: 0.4, freq: 12, ...o });
}
/** a tangle: the pen races back and forth inside an ellipse without lifting — foliage, undergrowth, deep shade */
function scrib(g, r, cx, cy, rx, ry, n, o = {}) {
  const pts = [], tilt = o.tilt || 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = rx * (2 * t - 1) + r.range(-1, 1) * rx * (2.4 / n), y = (i % 2 ? 1 : -1) * ry * r.range(0.2, 1) * Math.sqrt(Math.max(0.15, 1 - (2 * t - 1) * (2 * t - 1) * 0.8));
    pts.push([cx + x + y * tilt, cy + y]);
  }
  pen(g, pts, { w: 1.7, tin: 0.03, tout: 0.1, wob: 0.42, freq: 15, ...o });
}
/** a tuft of grass: quick upward flicks from one spot */
function tuft(g, r, x, y, n, h, seed) {
  for (let i = 0; i < n; i++) {
    const an = -Math.PI / 2 + r.range(-0.75, 0.75), l = h * r.range(0.5, 1.25), bx = x + r.range(-0.35, 0.35) * h;
    const ex = bx + Math.cos(an) * l, ey = y + Math.sin(an) * l;
    pen(g, [[bx, y + r.range(-3, 3)], [(bx + ex) / 2 + r.range(-0.12, 0.12) * l, (y + ey) / 2 + 2], [ex, ey]], { w: r.range(1.7, 2.9), seed: seed + i, tout: 0.65, head: 1.45 });
  }
}
/**
 * Parallel hatching (排线) over a region. inside(x,y) → bool, bb = [x0,y0,x1,y1], ang = stroke direction, gap = spacing.
 * opts: w, zig (join the strokes into one zig-zag), skip (prob.), lift (prob. of lifting the pen in zig mode), over (px over/under-shoot)
 */
function hatch(g, r, inside, bb, ang, gap, o = {}) {
  const [x0, y0, x1, y1] = bb, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rad = Math.hypot(x1 - x0, y1 - y0) / 2 + 4;
  const c = Math.cos(ang), s = Math.sin(ang), nx = -s, ny = c;
  const runs = [];
  for (let d = -rad; d <= rad; d += gap * r.range(0.6, 1.4)) {
    let st = null;
    for (let t = -rad; t <= rad + 4; t += 4) {
      const x = cx + nx * d + c * t, y = cy + ny * d + s * t;
      const ins = t <= rad && x >= x0 && x <= x1 && y >= y0 && y <= y1 && inside(x, y);
      if (ins && st === null) st = t;
      else if (!ins && st !== null) { if (t - st > (o.minLen || 8)) runs.push([d, st, t - 4]); st = null; }
    }
  }
  const ov = o.over === undefined ? 4 : o.over, w = o.w || 1.8, seed = o.seed || 1;
  const P = (d, t) => [cx + nx * d + c * t, cy + ny * d + s * t];
  if (o.zig) {
    let pts = [], flip = false, k = 0;
    const flush = () => { if (pts.length > 1) pen(g, pts, { w: w * r.range(0.8, 1.25), seed: seed + (k++) * 3.1, tin: 0.02, tout: 0.05, wob: 0.4, freq: 18 }); pts = []; };
    for (const [d, a0, a1] of runs) {
      if (r.chance(o.skip || 0)) { flush(); continue; }
      const A = P(d, a0 - r.range(-ov, ov)), B = P(d, a1 + r.range(-ov, ov));
      if (flip) pts.push(B, A); else pts.push(A, B);
      flip = !flip;
      if (r.chance(o.lift === undefined ? 0.1 : o.lift)) flush();
    }
    flush();
  } else {
    runs.forEach(([d, a0, a1], i) => {
      if (r.chance(o.skip || 0)) return;
      const A = P(d, a0 - r.range(-ov, ov)), B = P(d, a1 + r.range(-ov, ov));
      const m = [(A[0] + B[0]) / 2 + nx * r.range(-2.5, 2.5), (A[1] + B[1]) / 2 + ny * r.range(-2.5, 2.5)];
      pen(g, r.chance(o.rev === undefined ? 0.5 : o.rev) ? [A, m, B] : [B, m, A], { w: w * r.range(0.8, 1.25), seed: seed + i * 1.7, tout: 0.45, head: 1.45 });
    });
  }
}

// ───────────────────────── the arc: one brush stroke ─────────────────────────
function drawArcStroke(g, a) {
  const s = a.span(PAD + 150), NB = 20, dth = 2.4 / a.R;
  const r = L.rng('s35arc');
  // a brush is a bundle of bristles: where the ink load runs low they separate → 飞白
  const pull = (t0, t1, widthAt, loadAt, drAt, key) => {
    for (let b = 0; b < NB; b++) {
      const off = b / (NB - 1) - 0.5, edge = Math.abs(off) * 2, dry = r();
      let prev = null;
      for (let th = t0; th <= t1; th += dth) {
        const w = widthAt(th);
        const q = a.pt(th, drAt(th) + off * w + 0.5 * NZ.n2(th * 230 + b * 5.1, key));
        const ink = loadAt(th) + 0.48 * NZ.n2(th * 34 + key * 3, off * 4.6 + key) - 0.14 * edge * edge - 0.1 * dry;
        if (prev && ink > 0.3) {
          g.lineWidth = Math.max(0.7, (w / NB) * 2.2 * L.clamp(0.55 + ink * 0.7, 0.5, 1.25));
          g.beginPath(); g.moveTo(prev.x, prev.y); g.lineTo(q.x, q.y); g.stroke();
        }
        prev = q;
      }
    }
  };
  g.lineCap = 'round';
  // first pull: enters from the left, presses twice (顿), then runs dry and lifts off on the right
  pull(-s, 0.356,
    (th) => (15.2 + 7 * bump(th, -0.338, 0.045) + 4.6 * bump(th, -0.03, 0.085) - 3.2 * bump(th, -0.19, 0.06) - 3.6 * sstep(0.12, 0.3, th) + 1.6 * NZ.n2(th * 16, 2.2)) * (1 - 0.72 * sstep(0.318, 0.356, th)),
    (th) => 1.05 - 0.4 * bump(th, -0.2, 0.05) - 0.7 * sstep(0.17, 0.275, th) - 0.25 * sstep(0.33, 0.356, th),
    (th) => 1.1 * NZ.n2(th * 7, 4.4) - 0.6, 1.7);
  // second pull (复笔): brush re-charged, set down again a little low, overlapping the dry tail
  pull(0.308, s,
    (th) => 15.4 + 7.5 * bump(th, 0.32, 0.016) - 2.2 * bump(th, 0.42, 0.05) + 1.6 * NZ.n2(th * 16, 6.2),
    (th) => 1.08 - 0.3 * bump(th, 0.47, 0.05),
    (th) => -4.2 * Math.exp(-(th - 0.308) / 0.045) + 1.0 * NZ.n2(th * 7, 9.4) - 0.5, 5.3);
  const h = a.pt(0.3085, -4.4); blot(g, h.x, h.y, 11.5, 3.1);
  // a quick pen line re-stating the curve; it wanders in and out of the brush stroke
  const rest = (t0, t1, base, amp, key, o) => {
    const pts = [];
    for (let i = 0; i <= 28; i++) { const th = L.lerp(t0, t1, i / 28), q = a.pt(th, base + amp * NZ.n2(th * 6.5, key)); pts.push([q.x, q.y]); }
    pen(g, pts, o);
  };
  rest(-0.31, 0.21, -3, 9, 8.8, { w: 2.1, seed: 11, tin: 0.02, tout: 0.12, gap: 0.08, gapFreq: 9 });
  rest(-0.5, -0.27, -4, 8, 3.8, { w: 1.9, seed: 12, tin: 0.02, tout: 0.2, gap: 0.1, gapFreq: 7 });
  // drops shaken off where the brush first pressed
  const d0 = a.pt(-0.345, 0); spatter(g, r, d0.x - 6, d0.y + 22, 2.2, 7, 70);
}

function drawRailing(g, a, r) {
  const s = a.span(PAD + 60);
  // lower rail and deck edge: thin pen lines pulled in overlapping lengths
  const run = (base, wMin, wMax, gap, key) => {
    let th = -s, i = 0;
    while (th < s) {
      const t1 = Math.min(s, th + r.range(0.09, 0.22)), pts = [];
      for (let k = 0; k <= 8; k++) { const t = L.lerp(th, t1, k / 8), q = a.pt(t, base + 2.6 * NZ.n2(t * 9, key) + (k === 0 ? r.range(-3, 3) : 0)); pts.push([q.x, q.y]); }
      pen(g, pts, { w: r.range(wMin, wMax), seed: key * 40 + i, tout: 0.22, gap, gapFreq: 6 });
      th = t1 - r.range(-0.014, 0.03); i++;
    }
  };
  run(-17, 1.1, 1.7, 0.22, 2.1);
  run(-45, 1.9, 2.8, 0.1, 5.7);
  // posts (望柱): quick downward ticks, some doubled, some forgotten
  a.along({ spacing: 104, t0: -s, t1: s }, (q) => {
    if (r.chance(0.08)) return;
    const th = q.theta + r.range(-0.005, 0.005);
    const p0 = a.pt(th + r.range(-0.0012, 0.0012), -7), p1 = a.pt(th + r.range(-0.002, 0.002), -47 - r.range(0, 8));
    pen(g, [[p0.x, p0.y], [p1.x, p1.y]], { w: r.range(2.3, 3.4), seed: 300 + q.i, tout: 0.35, head: 1.45 });
    if (r.chance(0.7)) {
      const o = r.range(8, 11) / a.R, q0 = a.pt(th + o, -9), q1 = a.pt(th + o + r.range(-0.0014, 0.0014), -44);
      pen(g, [[q0.x, q0.y], [q1.x, q1.y]], { w: r.range(1.2, 1.9), seed: 400 + q.i, tout: 0.4 });
    }
  });
}

// ───────────────────────── bridge body: arch, shadow, masonry ─────────────────────────
const inArch = (x, y, d = 0) => y < AY && (x - AX) * (x - AX) + (y - AY) * (y - AY) < (AR + d) * (AR + d);
const inSoffit = (x, y) => inArch(x, y, -6) && Math.hypot(x - AX - 22, y - AY - 52) > AR - 2;

function drawArch(g, a, r) {
  const ring = (rad, t0, t1, ox, oy, o) => {
    const pts = [];
    for (let i = 0; i <= 40; i++) { const t = L.lerp(t0, t1, i / 40), rr = rad + 3 * NZ.n2(t * 2.2, o.seed); pts.push([AX + ox + Math.cos(t) * rr, AY + oy + Math.sin(t) * rr]); }
    pen(g, pts, o);
  };
  // intrados twice (the second pass doesn't quite agree with the first), extrados once and broken
  ring(AR, Math.PI - 0.06, L.TAU + 0.05, 0, 0, { w: 4.6, seed: 21, tin: 0.03, tout: 0.1, wob: 0.34, freq: 9 });
  ring(AR - 5, L.TAU - 0.14, Math.PI + 0.24, 6, 4, { w: 2, seed: 22, tin: 0.03, tout: 0.2, gap: 0.14, gapFreq: 8 });
  ring(AR + 36, Math.PI + 0.02, L.TAU - 0.01, -1, 2, { w: 2.3, seed: 23, tin: 0.03, tout: 0.15, gap: 0.16, gapFreq: 10 });
  // voussoir joints (拱石缝): radial ticks, the keystone pair a touch heavier
  for (let t = Math.PI + 0.1; t < L.TAU - 0.06; t += r.range(0.11, 0.17)) {
    if (r.chance(0.14)) continue;
    const key = Math.abs(t - 1.5 * Math.PI) < 0.1, tt = t + r.range(-0.014, 0.014);
    pen(g, [[AX + Math.cos(t) * (AR + 4), AY + Math.sin(t) * (AR + 4)], [AX + Math.cos(tt) * (AR + 35 + r.range(-3, 6)), AY + Math.sin(tt) * (AR + 35)]],
      { w: key ? 2.8 : r.range(1.3, 2.1), seed: 500 + t * 9, tout: 0.3 });
  }
  // the far edge of the barrel, seen through the opening
  ring(AR - 1, Math.PI + 0.42, L.TAU - 0.5, 22, 52, { w: 1.7, seed: 24, tin: 0.04, tout: 0.25, gap: 0.16, gapFreq: 7 });
  // soffit in shadow: dense zig-zag hatching, then a second layer across it where it is darkest
  hatch(g, r, inSoffit, [AX - AR, AY - AR, AX + AR, AY], 1.08, 7.4, { w: 1.9, zig: true, lift: 0.06, over: 5, seed: 600 });
  hatch(g, r, (x, y) => inSoffit(x, y) && x < AX + 150 && y < AY - 90, [AX - AR, AY - AR, AX + AR, AY], 0.62, 10.5, { w: 1.7, zig: true, lift: 0.14, over: 5, seed: 640 });
  // …and one loaded brush dragged round under the crown: the blackest thing on the sheet after the arc itself
  ring(AR - 17, Math.PI + 0.36, L.TAU - 0.86, 4, 6, { w: 25, abs: true, prof: 'leaf', seed: 25, wob: 0.22, freq: 7 });
  ring(AR - 12, Math.PI + 0.12, Math.PI + 0.62, 2, 2, { w: 9, abs: true, prof: 'leaf', seed: 26, wob: 0.3 });
  // a third, careless go at the curve that overshoots the far springing
  ring(AR + 17, Math.PI + 0.34, L.TAU + 0.16, 9, 7, { w: 1.5, seed: 27, tin: 0.03, tout: 0.3, gap: 0.12, gapFreq: 6 });
  // piers dropping into the water
  for (const sgn of [-1, 1]) {
    const x = AX + sgn * AR;
    pen(g, [[x + sgn * 2, AY - 34], [x + sgn * 1, AY + 14]], { w: 3.2, seed: 30 + sgn, tout: 0.3 });
    pen(g, [[x + sgn * 38, AY - 48], [x + sgn * 36, AY + 6]], { w: 2, seed: 33 + sgn, tout: 0.4, gap: 0.1 });
  }
  // spandrel masonry: a few course lines + staggered joints near the arch
  const deck = (x, y) => a.drAt(x, y) < -58;
  const outside = (x, y) => Math.hypot(x - AX, y - AY) > AR + 44;
  for (const [x0, x1] of [[500, 730], [1166, 1330]]) {
    for (let dr = -100; dr > -340; dr -= r.range(52, 66)) {
      let x = x0 + r.range(-20, 30);
      while (x < x1) {
        const xe = Math.min(x1 + r.range(-10, 30), x + r.range(60, 160));
        const pts = [];
        for (let k = 0; k <= 4; k++) { const xx = L.lerp(x, xe, k / 4), yy = a.yAt(xx, dr) + r.range(-1.8, 1.8); if (outside(xx, yy) && yy < AY - 8) pts.push([xx, yy]); }
        if (pts.length > 2 && !r.chance(0.25)) pen(g, pts, { w: r.range(1.1, 1.7), seed: 700 + dr + x * 0.1, tout: 0.4, gap: 0.12 });
        if (pts.length > 1 && r.chance(0.5)) { const j = pts[r.int(0, pts.length - 1)]; pen(g, [[j[0], j[1]], [j[0] + r.range(-2, 2), j[1] + r.range(30, 48)]], { w: 1.1, seed: 760 + x, tout: 0.5 }); }
        x = xe + r.range(20, 70);
      }
    }
  }
  // shade on the wall: long racing zig-zags to the right of the arch, a lighter patch to its left
  hatch(g, r, (x, y) => deck(x, y) && outside(x, y) && y < AY - 14 && x > AX + 150 && x - AX < 130 + (AY - y) * 0.62, [AX + 120, 610, AX + AR + 190, AY], 2.02, 15, { w: 1.4, over: 10, skip: 0.08, rev: 0.85, minLen: 26, seed: 800 });
  hatch(g, r, (x, y) => deck(x, y) && outside(x, y) && y < AY - 40 && y > AY - 260 && x > AX - AR - 96, [AX - AR - 100, 640, AX - 60, AY], 2.02, 21, { w: 1.2, over: 8, skip: 0.25, rev: 0.85, minLen: 26, seed: 840 });
}

// ───────────────────────── banks & water ─────────────────────────
const BANK_L = [[AX - AR - 12, AY + 3], [596, 1002], [514, 1032], [430, 1078], [330, 1136], [190, 1250]];
const BANK_R = [[AX + AR + 12, AY + 3], [1302, 1004], [1378, 1040], [1448, 1084], [1546, 1144], [1690, 1250]];
function xOnBank(poly, y) {
  for (let i = 1; i < poly.length; i++) if (y <= poly[i][1]) { const p = poly[i - 1], q = poly[i]; return L.lerp(p[0], q[0], L.clamp((y - p[1]) / (q[1] - p[1]))); }
  return poly[poly.length - 1][0];
}
function drawBanks(g, r) {
  // where the bridge wall meets the ground
  pen(g, [[-PAD - 20, 1016], [120, 1002], [330, 1010], [510, 998], [AX - AR - 30, AY + 2]], { w: 2.2, seed: 41, tout: 0.2, gap: 0.3, gapFreq: 7, jit: 2.5 });
  pen(g, [[AX + AR + 30, AY + 1], [1326, 1000], [1392, 1008]], { w: 2.1, seed: 42, tout: 0.4, gap: 0.1, jit: 1.5 });
  pen(g, [[1700, 1030], [1800, 1022], [W + PAD + 20, 1030]], { w: 2.1, seed: 43, tout: 0.2, gap: 0.14, jit: 1.5 });
  // water's edge: a heavier, lumpy line each side, with a few shadow ticks hanging under the lip
  for (const [poly, sd] of [[BANK_L, 45], [BANK_R, 46]]) {
    const sg = sd === 45 ? 1 : -1;
    pen(g, poly, { w: 4, seed: sd, tin: 0.04, tout: 0.15, wob: 0.5, freq: 14, jit: 3.4, gap: 0.05 });
    pen(g, poly.map(([x, y]) => [x + sg * 11, y + 10]), { w: 1.5, seed: sd + 10, tout: 0.3, gap: 0.22, gapFreq: 8, jit: 2.5 });
    for (let i = 0; i < 16; i++) {
      const y = r.range(AY + 10, H + 40), x = xOnBank(poly, y) + sg * r.range(2, 12);
      pen(g, [[x, y], [x + sg * r.range(4, 12), y + r.range(10, 24)]], { w: r.range(1.2, 2), seed: 900 + i + sd, tout: 0.5 });
    }
  }
  // stones on the bank
  const rock = (x, y, w, h, sd) => {
    pen(g, [[x - w * 0.5, y], [x - w * 0.42, y - h * 0.7], [x - w * 0.05, y - h], [x + w * 0.36, y - h * 0.78], [x + w * 0.52, y - h * 0.1], [x + w * 0.46, y + 2]], { w: 2.6, seed: sd, tout: 0.2, wob: 0.45, step: 5 });
    hatch(g, r, (px, py) => px > x + w * 0.02 && py > y - h * 0.82 && py < y, [x - w * 0.5, y - h, x + w * 0.5, y], 1.2, 8, { w: 1.3, zig: true, lift: 0.1, over: 3, seed: sd + 5 });
  };
  rock(474, 1060, 96, 50, 51); rock(398, 1086, 62, 32, 52); rock(1470, 1076, 100, 50, 53);
}
function drawWater(g, r) {
  // the reflection under each pier: sideways zig-zags that widen and loosen as they go down
  for (const sgn of [-1, 1]) {
    let y = AY + 11;
    for (let i = 0; i < 7; i++) {
      const cx = AX + sgn * (AR + 16) + r.range(-10, 10), half = r.range(18, 34) + i * 6;
      zig(g, r, cx - half, y, cx + half, y + r.range(-2, 2), 3.2 + i * 0.5, r.range(15, 22), { w: L.lerp(2.3, 1.4, i / 7), seed: 60 + i + sgn * 20 });
      y += r.range(10, 15) + i * 1.4;
    }
  }
  // the bright opening mirrored: a few long calm strokes, shorter broken ones toward the banks
  for (let i = 0; i < 30; i++) {
    const y = AY + 10 + Math.pow(r(), 0.8) * (H + 40 - AY), xl = xOnBank(BANK_L, y) + 30, xr = xOnBank(BANK_R, y) - 30;
    const len = r.range(44, 290), x0 = r.range(xl, Math.max(xl + 10, xr - len)), x1 = Math.min(xr, x0 + len);
    const pts = [[x0, y]];
    for (let k = 1; k <= 3; k++) pts.push([L.lerp(x0, x1, k / 3), y + r.range(-2, 2)]);
    pen(g, pts, { w: r.range(1.2, 2.5), seed: 1000 + i, tin: 0.05, tout: 0.45, gap: 0.16, gapFreq: 5 });
  }
  // the soffit's shadow lying on the water: a few heavy sideways scribbles left of centre
  for (const [cx, y, half, w2, sd] of [[AX - 96, AY + 34, 150, 2.5, 1], [AX - 60, AY + 58, 120, 2.1, 2], [AX - 120, AY + 84, 96, 1.8, 3], [AX + 40, AY + 104, 70, 1.6, 4]]) {
    zig(g, r, cx - half, y, cx + half, y + r.range(-3, 3), 4.5, r.range(26, 40), { w: w2, seed: 1150 + sd, tout: 0.2 });
  }
  // dark mirror of the arch ring, continued below the waterline in dashes
  for (let t = 0.2; t < Math.PI - 0.2; t += r.range(0.13, 0.24)) {
    const rr = AR * r.range(0.93, 1.0), x = AX + Math.cos(t) * rr, y = AY + Math.sin(t) * rr * 0.4 + 8, l = r.range(16, 38);
    if (y < H + 30) pen(g, [[x - l, y + r.range(-1, 1)], [x, y + r.range(-1.5, 1.5)], [x + l, y + r.range(-1, 1)]], { w: r.range(1.6, 2.6), seed: 1100 + t * 10, tout: 0.4 });
  }
}

// ───────────────────────── pavilion with upturned eaves (翘角亭) ─────────────────────────
const pv = (pts) => pts.map(([x, y]) => [PVX + PVS * x, PVY + PVS * y]);
const HIP_R = [[4, -326], [26, -288], [62, -244], [112, -213], [160, -200], [192, -209], [207, -228], [213, -240]];
const HIP_L = HIP_R.map(([x, y]) => [-x, y]);
const RIB_R = [[2, -324], [16, -280], [36, -232], [54, -196], [64, -176]];
const RIB_L = RIB_R.map(([x, y]) => [-x, y]);
const EAVE = [[-211, -238], [-186, -203], [-128, -183], [-46, -174], [46, -174], [128, -183], [186, -203], [211, -238]];
function polyAt(poly, t) { const f = t * (poly.length - 1), i = Math.min(poly.length - 2, Math.floor(f)), k = f - i; return [L.lerp(poly[i][0], poly[i + 1][0], k), L.lerp(poly[i][1], poly[i + 1][1], k)]; }
function drawPavilion(g, r) {
  const P = (pts, o) => pen(g, pv(pts), o);
  // roof: two hip ridges sweeping out in a concave curve and kicking up at the corners
  P(HIP_L, { w: 5.4, seed: 71, tin: 0.04, tout: 0.2, head: 1.1, wob: 0.3 });
  P(HIP_R, { w: 6.2, seed: 72, tin: 0.04, tout: 0.2, head: 1.1, wob: 0.3 });
  // eave edge: sags through the middle, lifts to both corners; re-stated once
  P(EAVE, { w: 5.6, seed: 73, tin: 0.05, tout: 0.08, head: 1.0, wob: 0.38, freq: 9 });
  P(EAVE.slice(1, 7).map(([x, y]) => [x * 0.93, y + 12]), { w: 1.9, seed: 74, tout: 0.2, gap: 0.14, gapFreq: 7 });
  // inner ridges of the facing roof plane
  P(RIB_L, { w: 2.4, seed: 75, tout: 0.25 });
  P(RIB_R, { w: 3.1, seed: 76, tout: 0.25 });
  // tile rows: sparse on the lit faces, crowded on the right (shadow) face
  const rows = (A, B, n, t0, o) => {
    for (let k = 1; k <= n; k++) {
      const f = k / (n + 1), pts = [];
      for (let j = 0; j <= 6; j++) { const t = L.lerp(t0 + r.range(0, 0.12), 0.97, j / 6), p = polyAt(A, t), q = polyAt(B, Math.min(1, t * 0.98)); pts.push([L.lerp(p[0], q[0], f), L.lerp(p[1], q[1], f) + 2]); }
      if (!r.chance(o.skip || 0)) P(pts, { w: r.range(1.2, 1.9), seed: 780 + k + n * 7, tout: 0.3, gap: o.gap || 0.1, gapFreq: 6 });
    }
  };
  rows(RIB_R, HIP_R.slice(0, 5), 5, 0.22, { gap: 0.06 });
  rows(RIB_L, RIB_R, 2, 0.42, { gap: 0.25 });
  rows(HIP_L.slice(0, 5), RIB_L, 2, 0.35, { gap: 0.2 });
  // finial (宝顶): a bead on a short neck
  P([[0, -322], [0, -366]], { w: 3, seed: 77, tout: 0.5 });
  blot(g, PVX, PVY + PVS * -340, 9.5 * PVS, 7.1); blot(g, PVX + 0.5, PVY + PVS * -355, 5.2 * PVS, 7.9);
  P([[-12, -323], [0, -329], [12, -323]], { w: 2.4, seed: 78, tout: 0.2 });
  // deep shade tucked under the eave
  P([[-150, -167], [-70, -161], [50, -160], [152, -167]], { w: 12.5, abs: true, prof: 'leaf', seed: 79, wob: 0.28, freq: 8 });
  scrib(g, r, PVX, PVY + PVS * -160, PVS * 150, PVS * 7, 34, { w: 1.8, seed: 79.5 });
  scrib(g, r, PVX + PVS * 70, PVY + PVS * -157, PVS * 66, PVS * 6, 18, { w: 1.7, seed: 80 });
  // lintel, columns, hanging fretwork, bench rails
  P([[-130, -151], [-40, -149], [50, -149], [132, -152]], { w: 2.3, seed: 81, tout: 0.15, gap: 0.08 });
  P([[-122, -137], [0, -135], [124, -138]], { w: 1.4, seed: 82, tout: 0.2, gap: 0.16 });
  for (const [x, w2, sd] of [[-120, 4.2, 83], [-44, 3.5, 84], [44, 3.7, 85], [120, 4.8, 86]]) {
    P([[x + r.range(-2, 2), -158], [x + r.range(-1.5, 1.5), -90], [x + r.range(-2, 2), -18]], { w: w2, seed: sd, tin: 0.05, tout: 0.14, head: 1.25 });
    if (x > -100) P([[x + 9, -148], [x + 9.5 + r.range(-1, 1), -24]], { w: 1.3, seed: sd + 20, tout: 0.3, gap: 0.14 });
  }
  for (const [x0, x1] of [[-112, -52], [52, 112]]) {
    zig(g, r, PVX + PVS * x0, PVY + PVS * -126, PVX + PVS * x1, PVY + PVS * -126, 6, 11, { w: 1.3, seed: 87 + x0 });
    P([[x0 - 6, -62], [(x0 + x1) / 2, -64 + r.range(-2, 2)], [x1 + 6, -62]], { w: 2.2, seed: 88 + x0, tout: 0.2 });
    for (let x = x0 + 8; x < x1; x += r.range(14, 21)) P([[x, -60], [x + r.range(-1.5, 1.5), -26]], { w: 1.1, seed: 890 + x, tout: 0.4 });
  }
  // plinth and steps
  P([[-158, -22], [-60, -24], [70, -22], [160, -23]], { w: 3.5, seed: 91, tin: 0.04, tout: 0.12, gap: 0.05 });
  P([[-170, 0], [-30, 2], [80, 0], [174, 2]], { w: 2.2, seed: 92, tout: 0.2, gap: 0.14, gapFreq: 7 });
  P([[-160, -22], [-171, 1]], { w: 2.1, seed: 93, tout: 0.3 }); P([[161, -23], [175, 2]], { w: 2.5, seed: 94, tout: 0.3 });
  P([[-36, -14], [38, -13]], { w: 1.4, seed: 95, tout: 0.3 }); P([[-42, -6], [44, -5]], { w: 1.4, seed: 96, tout: 0.3 });
  hatch(g, r, () => true, [PVX + PVS * 60, PVY + PVS * -20, PVX + PVS * 160, PVY - 2], 1.25, 9, { w: 1.1, zig: true, over: 2, seed: 97 });
  // shadow side of the roof: a second, slanting layer of hatching over the right-hand face
  hatch(g, r, (x, y) => {
    const lx = (x - PVX) / PVS, ly = (y - PVY) / PVS;
    if (ly < -300 || ly > -186) return false;
    const t = (ly + 326) / 150, rib = polyAt(RIB_R, L.clamp(t)), hip = polyAt(HIP_R, L.clamp(t * 0.55));
    return lx > rib[0] + 6 && lx < hip[0] + (ly > -214 ? 60 : 0) - 6;
  }, [PVX, PVY + PVS * -310, PVX + PVS * 200, PVY + PVS * -180], 2.25, 10, { w: 1.3, zig: true, lift: 0.2, over: 3, seed: 98 });
}

// ───────────────────────── bamboo, reeds, undergrowth ─────────────────────────
function leafFan(g, r, x, y, dir, n, len, seed) {
  for (let i = 0; i < n; i++) {
    const an = dir + (i - (n - 1) / 2) * r.range(0.26, 0.42) + r.range(-0.1, 0.1);
    const l = len * r.range(0.7, 1.25), bend = r.range(-0.1, 0.1) * l;
    const ex = x + Math.cos(an) * l, ey = y + Math.sin(an) * l;
    pen(g, [[x, y], [(x + ex) / 2 - Math.sin(an) * bend, (y + ey) / 2 + Math.cos(an) * bend], [ex, ey]],
      { w: r.range(7.5, 11) * Math.sqrt(l / 70), abs: true, prof: 'leaf', seed: seed + i * 1.3, wob: 0.14, step: 2.5 });
  }
}
function drawBamboo(g, r) {
  const stems = [ // base x, base y, height, lean, width
    [306, 1056, 452, 0.06, 7.4], [378, 1060, 380, 0.17, 6.4], [236, 1052, 322, -0.08, 6.0], [446, 1052, 286, 0.28, 5.0], [150, 1060, 262, -0.2, 5.0], [58, 1066, 238, -0.1, 5.4],
  ];
  stems.forEach(([bx, by, h, lean, w], si) => {
    const nseg = Math.max(3, Math.round(h / r.range(74, 92)));
    let x = bx, y = by, ang = -Math.PI / 2 + lean;
    for (let i = 0; i < nseg; i++) {
      const sl = (h / nseg) * r.range(0.9, 1.1), nx = x + Math.cos(ang) * sl, ny = y + Math.sin(ang) * sl, k = 1 - 0.5 * (i / nseg);
      // one joint of the culm, stopped short of the node; then the node tick
      pen(g, [[x, y], [(x + nx) / 2 + r.range(-1.5, 1.5), (y + ny) / 2], [nx - Math.cos(ang) * 6, ny - Math.sin(ang) * 6]], { w: w * k, seed: 1200 + si * 20 + i, tin: 0.1, tout: 0.06, head: 1.22, wob: 0.16 });
      if (i < nseg - 1) pen(g, [[nx - 9 * k - 3, ny + 2.5], [nx, ny - 2.5], [nx + 9 * k + 3, ny + 1.5]], { w: w * k * 0.5, seed: 1300 + si * 20 + i, tin: 0.2, tout: 0.3 });
      // twigs + hanging leaf fans from the upper nodes
      if (i >= 1) {
        const top = i === nseg - 1, nt = top ? 1 : r.int(1, 2);
        for (let t = 0; t < nt; t++) {
          const side = t === 0 ? (r.chance(0.5) ? 1 : -1) : (t % 2 ? 1 : -1) * (r.chance(0.8) ? 1 : -1);
          const ta = -Math.PI / 2 + side * r.range(0.7, 1.12), tl = r.range(22, top ? 34 : 58);
          const tx = nx + Math.cos(ta) * tl, ty = ny + Math.sin(ta) * tl;
          pen(g, [[nx, ny], [(nx + tx) / 2 + r.range(-3, 3), (ny + ty) / 2 + 3], [tx, ty]], { w: 1.4, seed: 1400 + si * 30 + i * 3 + t, tout: 0.4 });
          const dir = side > 0 ? r.range(0.62, 1.2) : Math.PI - r.range(0.62, 1.2);
          leafFan(g, r, tx, ty, dir, r.int(3, 4), r.range(64, 100), 1500 + si * 40 + i * 5 + t);
        }
      }
      x = nx; y = ny; ang += (lean >= 0 ? 1 : -1) * r.range(0.0, 0.05);
    }
    leafFan(g, r, x, y, Math.PI / 2 + r.range(-0.4, 0.4) + lean * 2, 3, r.range(54, 72), 1700 + si * 9);
  });
  // tangle at the foot of the clump
  scrib(g, r, 250, 1060, 230, 24, 26, { w: 1.8, seed: 1801, tilt: 0.4 });
  scrib(g, r, 90, 1076, 120, 18, 14, { w: 1.6, seed: 1802, tilt: -0.5 });
  tuft(g, r, 520, 1050, 6, 46, 1810); tuft(g, r, 196, 1070, 7, 54, 1820); tuft(g, r, 12, 1052, 6, 60, 1830);
}
function reedClump(g, r, x, y, n, hMin, hMax, spread, leanBias, seed, o = {}) {
  const k = o.k || 1;
  for (let i = 0; i < n; i++) {
    const bx = x + r.range(-spread, spread), by = y + r.range(-8, 16), h = r.range(hMin, hMax), lean = leanBias + r.range(-0.26, 0.26);
    const tx = bx + Math.sin(lean) * h, ty = by - Math.cos(lean) * h, bow = r.range(-0.12, 0.12) * h;
    const mx = (bx + tx) / 2 + bow, my = (by + ty) / 2;
    const at = (u) => [bx * (1 - u) * (1 - 2 * u) + mx * 4 * u * (1 - u) + tx * u * (2 * u - 1), by * (1 - u) * (1 - 2 * u) + my * 4 * u * (1 - u) + ty * u * (2 * u - 1)];
    pen(g, [[bx, by], [mx, my], [tx, ty]], { w: r.range(2, 3.4) * k, seed: seed + i, tin: 0.04, tout: 0.5, head: 1.2, gap: 0.05 });
    // blades: leave the stalk, arc out, and droop — the odd one snapped
    const nb = r.int(1, 2);
    for (let j = 0; j < nb; j++) {
      const [sx, sy] = at(r.range(0.2, 0.75)), side = r.chance(0.5 + lean) ? 1 : -1, l = r.range(70, 170) * Math.sqrt(k), droop = r.range(-0.15, 0.45) * l;
      const pts = [[sx, sy], [sx + side * l * 0.38, sy - l * 0.5], [sx + side * l * 0.8, sy - l * 0.46], [sx + side * l * 1.08, sy - l * 0.2 + droop]];
      if (r.chance(0.3)) pts.splice(3, 1, [sx + side * l * 0.86, sy - l * 0.3], [sx + side * l * 0.92, sy + l * 0.3]);
      pen(g, pts, { w: r.range(5.5, 9) * k, abs: true, prof: 'leaf', seed: seed + 50 + i * 4 + j, wob: 0.2 });
    }
    // plume (芦花): a feathery zig-zag nodding to one side
    if (r.chance(0.8)) {
      const side = lean >= 0 ? 1 : -1, pl = r.range(36, 64) * Math.sqrt(k), nf = r.int(5, 8);
      for (let j = 0; j < nf; j++) {
        const [sx, sy] = at(1 - j * r.range(0.02, 0.045) - 0.01), l = pl * r.range(0.3, 1) * (1 - j * 0.05), sd2 = r.chance(0.22) ? -side * 0.6 : side;
        pen(g, [[sx, sy], [sx + sd2 * l * 0.5, sy - l * r.range(0.05, 0.5)], [sx + sd2 * l * r.range(0.7, 1.15), sy + l * r.range(-0.1, 0.6)]], { w: r.range(1.5, 2.6) * k, seed: seed + 90 + i * 9 + j, tout: 0.6, head: 1.3 });
      }
    }
  }
}
function drawReeds(g, r) {
  const R = (k) => L.rng(SEED_REEDS + k);   // one random stream per clump
  reedClump(g, R('a'), 1262, 1104, 7, 150, 232, 62, 0.02, 2000);
  reedClump(g, R('b'), 1392, 1112, 4, 100, 170, 34, 0.26, 2100);
  reedClump(g, R('c'), 1880, 1092, 7, 170, 292, 44, 0.16, 2200);   // kept clear of the pavilion's upturned corner
  reedClump(g, R('d'), 1760, 1110, 3, 90, 150, 26, 0.24, 2300);
  reedClump(g, R('e'), 604, 1110, 6, 130, 228, 50, -0.14, 2400);
  reedClump(g, R('f'), 700, 1120, 3, 90, 150, 26, 0.2, 2500);
  // the hand moving faster than the eye: tangles thrown through the clumps
  scrib(g, r, 1300, 1066, 120, 30, 16, { w: 1.6, seed: 2601, tilt: 0.7 });
  scrib(g, r, 1840, 1056, 120, 34, 16, { w: 1.6, seed: 2603, tilt: -0.6 });
  scrib(g, r, 610, 1078, 96, 24, 13, { w: 1.5, seed: 2605, tilt: -0.6 });
  tuft(g, r, 1600, 1064, 7, 50, 2610); tuft(g, r, 1690, 1052, 5, 40, 2620); tuft(g, r, 760, 1090, 5, 40, 2630); tuft(g, r, 1150, 1094, 6, 44, 2640);
  // ground strokes under things
  for (const [x0, x1, y, sd] of [[60, 470, 1094, 1], [1380, 1720, 1050, 2], [1560, 1900, 1070, 3], [-60, 220, 1024, 4]]) {
    pen(g, [[x0, y], [(x0 + x1) / 2, y + r.range(-5, 5)], [x1, y + r.range(-4, 4)]], { w: 1.7, seed: 2700 + sd, tout: 0.5, gap: 0.2, gapFreq: 6 });
  }
}

// ───────────────────────── layers ─────────────────────────
function buildDark(env) {
  const a = env.arc;
  return L.makeLayer(PAD, (g) => {
    g.strokeStyle = INK; g.fillStyle = INK; g.lineJoin = 'round';
    // every motif gets its own random stream, so retouching one never reshuffles the others
    const r = L.rng('s35ink');
    drawArcStroke(g, a);
    drawRailing(g, a, L.rng('s35rail'));
    drawArch(g, a, L.rng('s35arch'));
    drawBanks(g, L.rng('s35bank'));
    drawWater(g, L.rng('s35water'));
    drawPavilion(g, L.rng('s35pavilion'));
    drawBamboo(g, L.rng(SEED_BAMBOO));
    drawReeds(g, L.rng(SEED_REEDS));
    // blots where the pen rested, a couple of flung drops
    BLOTS.forEach(([bx, by, br], i) => blot(g, bx, by, br, 1.1 + i * 1.3));
    blot(g, 584, 944, 3, 1.6); spatter(g, r, 1774, 846, -0.5, 6, 64); spatter(g, r, 640, 700, 1.9, 5, 56);
    // long careless flicks that stray across the opening
    for (const [x0, y0, x1, y1, bow, sd] of [[1176, 1096, 1092, 806, -46, 1], [1210, 1100, 1168, 848, 30, 2], [706, 1104, 800, 824, 40, 3], [742, 1110, 744, 870, -24, 4]]) {
      pen(g, [[x0, y0], [(x0 + x1) / 2 + bow, (y0 + y1) / 2], [x1, y1]], { w: r.range(1.7, 2.4), seed: 2800 + sd, tin: 0.04, tout: 0.6, head: 1.3 });
    }
  });
}
const BLOTS = [[572, 926, 8], [1774, 846, 9], [1120, 1052, 6], [640, 700, 5]];   // x, y, radius of the blots that bled
const HILL_L = [[-PAD - 30, 640], [-40, 590], [70, 528], [150, 486], [214, 470], [270, 496], [330, 528], [392, 514], [440, 522], [520, 566], [590, 600]];
const HILL_R = [[1356, 604], [1440, 566], [1530, 536], [1600, 514], [1660, 530], [1740, 580], [1800, 600], [1880, 584], [1960, 606], [W + PAD + 30, 660]];
/** pale ink: what lies far away */
function buildLight(env) {
  const a = env.arc;
  return L.makeLayer(PAD, (g) => {
    g.strokeStyle = INK_L; g.fillStyle = INK_L; g.lineJoin = 'round';
    const r = L.rng('s35light');
    // far shore seen through the arch, with a smudge of trees
    pen(g, [[AX - 270, AY - 54], [AX - 120, AY - 60], [AX + 40, AY - 55], [AX + 250, AY - 59]], { w: 1.8, seed: 3001, tout: 0.3, gap: 0.14, gapFreq: 7, jit: 1.5 });
    for (let i = 0; i < 6; i++) { const x = AX + r.range(-230, 160), y = AY - r.range(22, 44); pen(g, [[x, y], [x + r.range(50, 130), y + r.range(-1.5, 1.5)]], { w: 1.1, seed: 3010 + i, tout: 0.5, gap: 0.2 }); }
    // paler reeds standing further back
    reedClump(g, r, 1196, 1016, 3, 70, 120, 26, 0.1, 3100, { k: 0.6 });
    reedClump(g, r, 712, 1012, 3, 60, 110, 22, -0.1, 3200, { k: 0.6 });
    // distant hills: one wet stroke each along the ridge (kept well clear of the caption above the crest)
    g.save(); a.clipAbove(g, 14);
    const ridge = (pts, sd) => { pen(g, pts, { w: 5.5, seed: sd, prof: 'flat', wob: 0.55, freq: 7, gap: 0.07, gapFreq: 5, jit: 2, step: 4 }); pen(g, pts.map(([x, y]) => [x + 6, y + 7]), { w: 1.6, seed: sd + 1, tout: 0.3, gap: 0.3, gapFreq: 6, jit: 2 }); };
    ridge(HILL_L, 3401); ridge(HILL_R, 3403);
    g.restore();
  });
}
/** soft grey wash: hills, the shadowed soffit, the dark side of the roof, the reflection */
function buildWash(env) {
  const a = env.arc;
  const c = L.makeLayer(PAD, (g) => {
    const fillPoly = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
    g.save(); a.clipAbove(g, 16);
    for (const hill of [HILL_L, HILL_R]) {
      const sm = L.smoothPath(hill, 8), top = Math.min(...hill.map((p) => p[1]));
      g.fillStyle = L.linear(g, 0, top, 0, top + 170, [[0, L.rgba(INK_L, 0.5)], [0.35, L.rgba(INK_L, 0.26)], [1, L.rgba(INK_L, 0.04)]]);
      fillPoly([...sm, [sm[sm.length - 1][0], 900], [sm[0][0], 900]]);
    }
    g.restore();
    // soffit
    g.save(); g.beginPath(); g.arc(AX, AY, AR - 3, Math.PI, L.TAU); g.closePath(); g.clip();
    g.beginPath(); g.rect(AX - AR - 10, AY - AR - 10, AR * 2 + 20, AR + 10); g.arc(AX + 22, AY + 52, AR - 2, 0, L.TAU, true);
    g.fillStyle = L.rgba(INK_L, 0.46); g.fill('evenodd');
    g.restore();
    // far bank through the arch: a misty line of trees
    g.save(); g.beginPath(); g.arc(AX, AY, AR - 12, Math.PI, L.TAU); g.closePath(); g.clip();
    for (const [x0, x1, hgt, al] of [[AX - 270, AX - 6, 50, 0.42], [AX + 64, AX + 256, 30, 0.34]]) {
      const pts = [];
      for (let x = x0; x <= x1; x += 7) { const u = (x - x0) / (x1 - x0); pts.push([x, AY - 58 - hgt * Math.pow(Math.sin(Math.PI * u), 0.6) * (0.55 + 0.6 * NZ.n2(x * 0.045, 3.3))]); }
      g.fillStyle = L.rgba(INK_L, al); fillPoly([...pts, [x1, AY - 54], [x0, AY - 54]]);
    }
    g.restore();
    // blots that bled: a grey ring round each
    for (const [bx, by, br] of BLOTS) { g.fillStyle = L.radial(g, bx, by, br * 0.8, br * 2.6, [[0, L.rgba(INK_L, 0.5)], [0.7, L.rgba(INK_L, 0.3)], [1, L.rgba(INK_L, 0)]]); g.beginPath(); g.arc(bx, by, br * 2.6, 0, L.TAU); g.fill(); }
    // roof shade + under-eave
    g.fillStyle = L.rgba(INK_L, 0.38);
    fillPoly(pv([...RIB_R, [64, -172], [128, -181], [184, -200], ...HIP_R.slice(0, 6).reverse()]));
    g.fillStyle = L.rgba(INK_L, 0.32);
    fillPoly(pv([[-150, -172], [150, -172], [128, -148], [-126, -148]]));
    // pier reflections
    for (const sgn of [-1, 1]) { g.fillStyle = L.linear(g, 0, AY, 0, AY + 150, [[0, L.rgba(INK_L, 0.36)], [1, L.rgba(INK_L, 0)]]); g.fillRect(AX + sgn * (AR + 18) - 38, AY + 4, 76, 150); }
    // a breath of tone behind the bamboo
    g.fillStyle = L.radial(g, 300, 850, 20, 240, [[0, L.rgba(INK_L, 0.2)], [1, L.rgba(INK_L, 0)]]); g.fillRect(-PAD, 560, 700, 560);
  });
  // wet edges + granulation
  const out = L.blurred(c, 3.2);
  const g = out.getContext('2d');
  g.globalCompositeOperation = 'destination-out'; g.globalAlpha = 0.6;
  g.drawImage(L.noiseTex(out.width, out.height, { seed: 's35wash', scale: 70, octaves: 3, res: 0.25, contrast: 1.8, ramp: [[0, 'rgba(0,0,0,0.75)'], [0.55, 'rgba(0,0,0,0.1)'], [1, 'rgba(0,0,0,0)']] }), 0, 0);
  return out;
}

const CREASES = [[1366, -PAD, 1351, H + PAD, 1], [-PAD, 868, W + PAD, 851, 2]];
function alongCrease(g, c, fn) {
  const [x0, y0, x1, y1] = c, len = Math.hypot(x1 - x0, y1 - y0);
  g.save(); g.translate(x0, y0); g.rotate(Math.atan2(y1 - y0, x1 - x0)); fn(len); g.restore();
}
function buildPaper(env) {
  const a = env.arc, w = W + PAD * 2, h = H + PAD * 2;
  const c = L.paperTex(w, h, { base: PAPER, seed: 's35p', tone: SPOT, fiber: 1, stain: 0.7, grain: 0.16 });
  c._pad = PAD;
  const g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, PAD, PAD); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  const r = L.rng('s35paper');
  const inZone = (x, y) => x > 590 && x < 1330 && y > 250 && y < a.crestY + 4;
  // blotchy age-toning, then the sheet browning toward its edges
  g.globalCompositeOperation = 'multiply';
  g.globalAlpha = 0.42;
  g.drawImage(L.noiseTex(w, h, { seed: 's35m1', scale: 320, octaves: 4, warp: 0.7, res: 0.2, contrast: 1.4, ramp: [[0, '#c9b184'], [0.5, '#f1e8d2'], [1, '#ffffff']] }), -PAD, -PAD);
  g.globalAlpha = 0.3;
  g.drawImage(L.noiseTex(w, h, { seed: 's35m2', scale: 40, octaves: 3, res: 0.25, contrast: 1.7, ramp: [[0, '#b9a273'], [0.45, '#f6efde'], [1, '#ffffff']] }), -PAD, -PAD);
  g.globalAlpha = 1;
  g.fillStyle = L.radial(g, 940, 440, 520, 1500, [[0, '#ffffff'], [0.5, '#f1e6c9'], [1, '#cdb486']]);
  g.fillRect(-PAD, -PAD, w, h);
  // water stains (水渍): pale pools ringed by a brown tide-line
  {
    const res = 1 / 3, cw = Math.round(w * res), ch = Math.round(h * res), img = new ImageData(cw, ch), d = img.data, nz = L.makeNoise('s35stain');
    const pools = [[236, 948, 330, 0.9], [1808, 136, 300, 0.8], [1160, 1052, 150, 0.6], [44, 150, 230, 0.7], [1700, 770, 120, 0.45]];
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const fx = x / res - PAD, fy = y / res - PAD;
      let al = 0;
      for (let i = 0; i < pools.length; i++) {
        const p = pools[i], dx = fx - p[0], dy = fy - p[1];
        if (Math.abs(dx) > p[2] * 1.5 || Math.abs(dy) > p[2] * 1.5) continue;
        const dd = Math.hypot(dx, dy) / p[2] + 0.3 * nz.fbm(fx / 190 + i * 9.1, fy / 190 - i * 4.7, 3) + 0.035 * nz.n2(fx / 21, fy / 21);
        if (dd < 1) { const e = sstep(0.9, 0.995, dd); al += p[3] * (0.05 + 0.44 * e * e + 0.1 * bump(dd, 0.66, 0.025)); }
      }
      const k = (y * cw + x) * 4; d[k] = 126; d[k + 1] = 90; d[k + 2] = 42; d[k + 3] = Math.min(255, al * 255);
    }
    const sc = L.makeCanvas(cw, ch); sc.getContext('2d').putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.filter = 'blur(1.6px)'; g.drawImage(sc, -PAD, -PAD, w, h); g.filter = 'none';
  }
  // foxing (霉斑): rusty freckles, gathered in drifts; almost none where the caption will sit
  const drifts = [[1580, 290, 240], [400, 190, 260], [1000, 900, 300], [1760, 900, 220], [110, 600, 200], [1420, 700, 200], [700, 740, 220]];
  for (let i = 0; i < 330; i++) {
    let x, y;
    if (i % 3) { const dft = drifts[i % drifts.length]; x = dft[0] + r.gauss() * dft[2] * 0.6; y = dft[1] + r.gauss() * dft[2] * 0.6; } else { x = r.range(-PAD, W + PAD); y = r.range(-PAD, H + PAD); }
    const zone = inZone(x, y); if (zone && r.chance(0.85)) continue;
    const rad = L.lerp(2, zone ? 5 : 17, Math.pow(r(), 2.6)), al = r.range(0.14, 0.52) * (zone ? 0.45 : 1);
    const col = r.pick(['#8f5f2a', '#9a6b33', '#a57a3e', '#7c5226']);
    g.fillStyle = L.radial(g, x, y, 0, rad, [[0, L.rgba(col, al)], [0.5, L.rgba(col, al * 0.7)], [1, L.rgba(col, 0)]]);
    g.beginPath(); g.ellipse(x, y, rad, rad * r.range(0.7, 1), r() * 3, 0, L.TAU); g.fill();
  }
  // mildew: grey-brown pepper in three corners
  for (const [mx, my, mr] of [[130, 950, 150], [1790, 1010, 170], [1840, 80, 150]]) {
    for (let i = 0; i < 70; i++) {
      const x = mx + r.gauss() * mr * 0.55, y = my + r.gauss() * mr * 0.55, rad = L.lerp(1, 5.5, Math.pow(r(), 2));
      g.fillStyle = L.radial(g, x, y, 0, rad, [[0, L.rgba('#4f4534', r.range(0.2, 0.5))], [1, L.rgba('#4f4534', 0)]]);
      g.beginPath(); g.arc(x, y, rad, 0, L.TAU); g.fill();
    }
  }
  g.globalCompositeOperation = 'source-over';
  // the caption's patch of paper is the cleanest on the sheet
  g.save(); g.translate(960, a.crestY - 140); g.scale(1, 0.56);
  g.fillStyle = L.radial(g, 0, 0, 120, 520, [[0, L.rgba('#dccda8', 0.5)], [0.6, L.rgba('#dccda8', 0.3)], [1, L.rgba('#dccda8', 0)]]);
  g.beginPath(); g.arc(0, 0, 520, 0, L.TAU); g.fill(); g.restore();
  L.speckle(g, { seed: 's35spk', count: 1700, x: -PAD, y: -PAD, w, h, rMin: 0.4, rMax: 1.8, colors: ['#5a4424', '#7a5a2c', '#3a2c18'], alpha: [0.1, 0.55], test: (x, y) => !inZone(x, y) || ((x * 7 + y * 13) | 0) % 3 === 0 });
  // long fibres caught in the sheet
  g.lineCap = 'round';
  for (let i = 0; i < 520; i++) {
    const x = r.range(-PAD, W + PAD), y = r.range(-PAD, H + PAD), len = r.range(10, 54), an = r() * Math.PI;
    g.strokeStyle = r.chance(0.55) ? L.rgba('#7a5c2c', r.range(0.08, 0.26)) : L.rgba('#fff8e4', r.range(0.1, 0.3));
    g.lineWidth = r.range(0.5, 1.3);
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(an) * len * 0.5 + r.range(-7, 7), y + Math.sin(an) * len * 0.5 + r.range(-7, 7), x + Math.cos(an) * len, y + Math.sin(an) * len); g.stroke();
  }
  // fold creases (折痕): a tonal step across the fold, a dark hairline, a worn pale ridge
  for (const cr of CREASES) alongCrease(g, cr, (len) => {
    g.fillStyle = L.linear(g, 0, -60, 0, 0, [[0, 'rgba(74,50,14,0)'], [1, 'rgba(74,50,14,0.09)']]); g.fillRect(0, -60, len, 60);
    g.fillStyle = L.linear(g, 0, 0, 0, 50, [[0, 'rgba(255,248,226,0.14)'], [1, 'rgba(255,248,226,0)']]); g.fillRect(0, 0, len, 50);
    for (let x = 0; x < len; x += 5) {
      const n = NZ.n2(x * 0.012, cr[4] * 3.3), yy = 2.6 * NZ.n2(x * 0.004, 7 + cr[4]);
      g.fillStyle = `rgba(70,48,18,${Math.max(0, 0.16 + 0.2 * n).toFixed(3)})`; g.fillRect(x, yy - 1.3, 5.5, 1.3);
      g.fillStyle = `rgba(255,250,232,${Math.max(0, 0.22 + 0.26 * n).toFixed(3)})`; g.fillRect(x, yy, 5.5, 1.5);
    }
    for (let i = 0; i < len * 0.4; i++) { g.fillStyle = L.rgba('#fff9e8', r.range(0.1, 0.45)); g.fillRect(r() * len, r.gauss() * 3.2, r.range(1, 4), r.range(0.6, 1.7)); }
  });
  // paper tooth (a coarser grain than the film's) and gentle cockling of the sheet
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.5;
  g.drawImage(L.grainTex(w, h, { seed: 's35tooth', amount: 0.2, size: 2 }), -PAD, -PAD);
  g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.26;
  g.drawImage(L.noiseTex(w, h, { seed: 's35cockle', scale: 460, sx: 1.8, octaves: 3, res: 0.15, contrast: 1.5 }), -PAD, -PAD);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  return c;
}

/** what the paper's tooth takes back out of the ink: pinholes, dry patches, wear along the folds (a destination-out mask) */
function buildErosion() {
  const w = W + PAD * 2, h = H + PAD * 2, hw = w >> 1, hh = h >> 1;
  const c = L.makeCanvas(w, h), g = c.getContext('2d');
  const r = L.rng('s35tooth'), img = new ImageData(hw, hh), d = img.data;
  for (let i = 3; i < d.length; i += 4) { const v = r(); if (v > 0.93) d[i] = 50 + (v - 0.93) * 2000; }
  const pin = L.makeCanvas(hw, hh); pin.getContext('2d').putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true; g.globalAlpha = 0.75; g.drawImage(pin, 0, 0, w, h); g.globalAlpha = 1;
  g.drawImage(L.noiseTex(w, h, { seed: 's35dry', scale: 22, octaves: 3, res: 0.33, contrast: 2.1, ramp: [[0, 'rgba(0,0,0,0.4)'], [0.26, 'rgba(0,0,0,0.08)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0)']] }), 0, 0);
  g.drawImage(L.noiseTex(w, h, { seed: 's35dry2', scale: 260, octaves: 3, res: 0.15, contrast: 1.6, ramp: [[0, 'rgba(0,0,0,0.2)'], [0.5, 'rgba(0,0,0,0.03)'], [1, 'rgba(0,0,0,0)']] }), 0, 0);
  g.translate(PAD, PAD);
  for (const cr of CREASES) alongCrease(g, cr, (len) => {
    for (let i = 0; i < len * 0.7; i++) { g.fillStyle = `rgba(0,0,0,${r.range(0.3, 1).toFixed(2)})`; g.fillRect(r() * len, r.gauss() * 1.7 - 0.5, r.range(1, 4.5), r.range(0.8, 2.4)); }
  });
  return c;
}
/** ink is not vector: soften the layer a touch, push its edge about with noise, and harden it again */
function roughen(layer) {
  const w = layer.width, h = layer.height, c = L.makeCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true });
  g.filter = 'blur(1.1px)'; g.drawImage(layer, 0, 0); g.filter = 'none';
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let y = 0, i = 3; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
    const al = d[i];
    if (al < 6 || al > 249) continue;
    const n = NZ.n2(x * 0.3, y * 0.3) * 0.27 + NZ.n2(x * 0.071 + 40, y * 0.071) * 0.13;
    d[i] = L.clamp((al / 255 - 0.42 + n) * 3.4 + 0.5) * 255;
  }
  g.putImageData(img, 0, 0);
  const lg = layer.getContext('2d');
  lg.setTransform(1, 0, 0, 1, 0, 0); lg.clearRect(0, 0, w, h); lg.drawImage(c, 0, 0);
}
function erode(layer, mask, amt) {
  const g = layer.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-out'; g.globalAlpha = amt;
  g.drawImage(mask, 0, 0);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
}

export default {
  name: '白描速写',
  tone: 'dark',
  init(env) {
    const paper = buildPaper(env), wash = buildWash(env), light = buildLight(env), dark = buildDark(env);
    const halo = L.blurred(dark, 5);      // ink feathering into the fibres (洇)
    roughen(dark);
    const mask = buildErosion(); erode(dark, mask, 0.6); erode(light, mask, 1);
    const pic = L.makeLayer(PAD, (g) => {
      g.drawImage(paper, -PAD, -PAD);
      g.globalCompositeOperation = 'multiply';
      g.globalAlpha = 0.85; g.drawImage(wash, -PAD, -PAD);
      g.globalAlpha = 0.26; g.drawImage(halo, -PAD, -PAD);
      g.globalAlpha = 0.74; g.drawImage(light, -PAD, -PAD);
      g.globalAlpha = 1; g.drawImage(dark, -PAD, -PAD);
      // raking light across the sheet: warm at the upper left, falling off to the lower right
      g.globalCompositeOperation = 'soft-light';
      g.fillStyle = L.linear(g, 0, 0, W, H, [[0, 'rgba(255,246,222,0.26)'], [0.5, 'rgba(128,128,128,0)'], [1, 'rgba(40,26,8,0.3)']]);
      g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    });
    S = { pic };
  },
  draw(ctx, env, p) {
    // the sheet turns a hair under the camera
    L.blit(ctx, env, S.pic, { rot: L.lerp(-0.0028, 0.0028, p), zoom: L.lerp(1.0, 1.012, p) });
  },
};
