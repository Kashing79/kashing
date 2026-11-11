// s35 — 清供白描稿. A brush line-drawing study (白描画稿) on apricot-yellow old paper.
// The arc is ONE pull of scorched ink (焦墨): the lip of a big porcelain vat — pressed, lifted, run dry into flying-white (飞白),
// re-charged and set down again, with a thinner second line under its left half. Below it, dashed off at speed: a sheaf of
// cut plum branches and bamboo standing in the vat (twig tips only just butting the rim), a small-mouthed vase in a few strokes
// on the left, a pot of sweet-flag (菖蒲) and a Buddha's-hand citron (佛手) on the right. Above the rim: nothing but old paper.
// Lines only, no colour or wash. Everything is drawn once in init() (paper → pale ink → scorched ink → wormholes) and
// blitted with a hair of rotation about the arc's centre.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 100;
const INK = '#1c1814', INK_L = '#6b6052', SPOT = '#b89a5e';
const NZ = L.makeNoise('s35qg');
let S = null;

const bump = (x, c, w) => { const d = (x - c) / w; return Math.exp(-d * d); };
const sstep = (a, b, x) => L.smooth((x - a) / (b - a));

// ───────────────────────── the brush ─────────────────────────
const _lx = [], _ly = [], _rx = [], _ry = [];
function fillRun(g, m) {
  if (m < 2) return;
  g.beginPath(); g.moveTo(_lx[0], _ly[0]);
  for (let k = 1; k < m; k++) g.lineTo(_lx[k], _ly[k]);
  for (let k = m - 1; k >= 0; k--) g.lineTo(_rx[k], _ry[k]);
  g.closePath(); g.fill();
}
/**
 * One brush stroke = a bundle of bristles. Pressure (提按) shapes the width; where the ink load runs low the bristles
 * part and skip (飞白). opts: w (px), seed, prof ('ding' 钉头鼠尾 | 'lan' 兰叶 | 'flat'), head, tin, tout, wob, wlen,
 * dry (0 = loaded … 0.8 = scorched), jit (hand tremor px), wf(u,s) custom width factor, load(u,s) custom ink load
 */
function brush(g, pts, o = {}) {
  const p = L.smoothPath(pts, o.step || 3);
  const n = p.length; if (n < 2) return;
  const w = o.w === undefined ? 5 : o.w, seed = o.seed === undefined ? 1 : o.seed, sd = ((seed * 0.731) % 97.3) + 0.37;
  const prof = o.prof || 'ding';
  const tin = o.tin === undefined ? 0.07 : o.tin, tout = o.tout === undefined ? 0.4 : o.tout, head = o.head === undefined ? 1.3 : o.head;
  const wob = o.wob === undefined ? 0.26 : o.wob, wl = o.wlen || 90, dry = o.dry === undefined ? 0.2 : o.dry, jit = o.jit || 0;
  const minW = o.minW === undefined ? 1 : o.minW;
  const cum = new Float32Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  const len = cum[n - 1] || 1;
  const X = new Float32Array(n), Y = new Float32Array(n), NX = new Float32Array(n), NY = new Float32Array(n), WD = new Float32Array(n);
  let wmax = 0;
  for (let i = 0; i < n; i++) {
    const u = cum[i] / len, s = cum[i];
    let k;
    if (o.wf) k = o.wf(u, s);
    else if (prof === 'lan') k = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.62)), 0.85) + 0.08;
    else if (prof === 'flat') k = 1;
    else {
      k = u < tin ? L.lerp(head * 0.8, head, u / tin) : u < tin * 3 ? L.lerp(head, 0.9, (u - tin) / (tin * 2)) : L.lerp(0.9, 0.72, (u - tin * 3) / (1 - tin * 3));
      if (tout > 0 && u > 1 - tout) k *= Math.pow((1 - u) / tout, 0.8);
    }
    k *= 1 + wob * NZ.n2(s / wl + sd * 5.3, sd * 2.9);
    const wd = Math.max(minW, w * k); WD[i] = wd; if (wd > wmax) wmax = wd;
    X[i] = p[i][0] + (jit ? jit * NZ.n2(s / 55 + sd, 5.5 + sd) : 0);
    Y[i] = p[i][1] + (jit ? jit * NZ.n2(s / 55 - sd, 9.5 - sd) : 0);
  }
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    const nx = -(Y[b] - Y[a]), ny = X[b] - X[a], m = Math.hypot(nx, ny) || 1; NX[i] = nx / m; NY[i] = ny / m;
  }
  const NB = wmax < 3.6 ? 1 : Math.min(24, Math.max(2, Math.round(wmax / 1.7)));
  for (let b = 0; b < NB; b++) {
    const off = NB === 1 ? 0 : (b + 0.5) / NB - 0.5, edge = Math.abs(off) * 2;
    const db = NZ.n2(b * 7.31 + sd * 11.1, sd * 3.7) * 0.5 + 0.5;
    let m = 0;
    for (let i = 0; i < n; i++) {
      const u = cum[i] / len, s = cum[i];
      const load = o.load ? o.load(u, s) : 1.1 - dry * (0.5 + 0.95 * u);
      const ink = load + 0.5 * NZ.n2(s / 46 + sd * 3.1, off * 6.3 + b * 1.7 + sd) + 0.22 * NZ.n2(s / 150 + sd, off * 1.3 - sd * 2) - 0.3 * dry * edge * edge - 0.3 * dry * db;
      if (ink > 0.4) {
        const hb = NB === 1 ? WD[i] / 2 : (WD[i] / NB) * 0.5 * L.clamp(0.55 + (ink - 0.4) * 1.7, 0.5, 1.32);
        const cx = X[i] + NX[i] * off * WD[i], cy = Y[i] + NY[i] * off * WD[i];
        _lx[m] = cx + NX[i] * hb; _ly[m] = cy + NY[i] * hb; _rx[m] = cx - NX[i] * hb; _ry[m] = cy - NY[i] * hb; m++;
      } else { fillRun(g, m); m = 0; }
    }
    fillRun(g, m);
  }
  // where the brush is set down the head is round and full
  if (o.cap !== false && prof !== 'lan' && dry < 0.6) { g.beginPath(); g.arc(X[0], Y[0], WD[0] * 0.5, 0, L.TAU); g.fill(); }
}
/** an ink blot with a lumpy outline */
function blot(g, x, y, rad, seed, sq = 0.9) {
  g.beginPath();
  for (let i = 0; i <= 22; i++) {
    const a = (i / 22) * L.TAU, rr = rad * (1 + 0.3 * NZ.n2(Math.cos(a) * 1.4 + seed, Math.sin(a) * 1.4 - seed));
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * sq;
    if (i) g.lineTo(px, py); else g.moveTo(px, py);
  }
  g.closePath(); g.fill();
}
/** drops flung off the brush in one direction (甩出的墨星): bigger near the hand, stretched along the throw */
function spatter(g, r, x, y, ang, n, reach, big = 4.2) {
  for (let i = 0; i < n; i++) {
    const d = reach * Math.pow(r(), 0.7), a = ang + r.gauss() * 0.3, rad = L.lerp(big, 1.1, d / reach) * r.range(0.55, 1.3);
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    g.save(); g.translate(px, py); g.rotate(a); g.scale(r.range(1, 1.9), 1); blot(g, 0, 0, rad, i * 3.3 + x, 1); g.restore();
  }
}
/** one pull of the big brush along the arc, in polar coordinates: widthAt/loadAt/drOf are functions of theta */
function arcPull(g, a, t0, t1, widthAt, loadAt, drOf, key, NB = 24) {
  const dth = 2.5 / a.R, r = L.rng('s35q-pull' + key);
  for (let b = 0; b < NB; b++) {
    const off = (b + 0.5) / NB - 0.5, edge = Math.abs(off) * 2, dryB = r();
    let m = 0;
    for (let th = t0; th <= t1; th += dth) {
      const w = widthAt(th);
      const ink = loadAt(th) + 0.48 * NZ.n2(th * 34 + key * 3, off * 4.6 + key) + 0.16 * NZ.n2(th * 120 + key, b * 3.3) - 0.14 * edge * edge - 0.1 * dryB;
      if (ink > 0.3) {
        const hb = (w / NB) * 0.5 * L.clamp(0.6 + ink * 0.8, 0.55, 1.4);
        const dr = drOf(th) + off * w + 0.5 * NZ.n2(th * 230 + b * 5.1, key);
        const sn = Math.sin(th), cs = Math.cos(th), r1 = a.R + dr + hb, r2 = a.R + dr - hb;
        _lx[m] = a.cx + r1 * sn; _ly[m] = a.cy - r1 * cs; _rx[m] = a.cx + r2 * sn; _ry[m] = a.cy - r2 * cs; m++;
      } else { fillRun(g, m); m = 0; }
    }
    fillRun(g, m);
  }
}
/** how far a twig may climb: it may only just butt the rim under the caption; far out to the sides it may poke through */
const tipLimit = (a) => (x) => { const d = Math.abs(x - a.cx); return d < 430 ? -1.5 : L.lerp(-1.5, 56, L.smooth((d - 430) / 130)); };
function capTo(a, x0, y0, x1, y1, lim) {
  let bx = x0, by = y0;
  for (let i = 1; i <= 32; i++) {
    const t = i / 32, x = L.lerp(x0, x1, t), y = L.lerp(y0, y1, t);
    if (a.drAt(x, y) > lim(x)) break;
    bx = x; by = y;
  }
  return [bx, by];
}

// ───────────────────────── the arc: the lip of the vat (缸口沿) ─────────────────────────
function drawRim(g, gl, a) {
  const s = a.span(PAD + 140);
  const r = L.rng('s35q-rim');
  // first pull: enters from the left, presses twice (顿), thins, runs dry into flying-white and lifts off right of centre
  arcPull(g, a, -s, 0.322,
    (th) => (18 + 8 * bump(th, -0.345, 0.04) + 5.5 * bump(th, -0.045, 0.07) - 5 * bump(th, -0.2, 0.06) + 2.6 * bump(th, 0.085, 0.03) - 4 * sstep(0.13, 0.29, th) + 1.7 * NZ.n2(th * 16, 2.2)) * (1 - 0.7 * sstep(0.288, 0.322, th)),
    (th) => 1.1 - 0.34 * bump(th, -0.21, 0.05) - 0.6 * sstep(0.13, 0.25, th) - 0.2 * sstep(0.29, 0.322, th),
    (th) => 1.0 * NZ.n2(th * 7, 4.4) - 0.2, 1.7);
  // second pull (复笔): brush re-charged, set down again a touch low, overlapping the dry tail
  arcPull(g, a, 0.266, s,
    (th) => 18.5 + 9 * bump(th, 0.279, 0.014) - 3.4 * bump(th, 0.39, 0.05) + 3 * bump(th, 0.47, 0.03) + 1.7 * NZ.n2(th * 16, 6.2),
    (th) => 1.1 - 0.3 * bump(th, 0.43, 0.04),
    (th) => -5 * Math.exp(-(th - 0.266) / 0.04) + 1.0 * NZ.n2(th * 7, 9.4) - 0.2, 5.3);
  const h = a.pt(0.2665, -5); blot(g, h.x, h.y, 13, 3.1);
  // the inner edge of the lip: a thinner line that leaves the big stroke near the crest and drops away to the left → 双线
  const inner = (t0, t1, d0, d1, key) => {
    const pts = [];
    for (let i = 0; i <= 40; i++) { const th = L.lerp(t0, t1, i / 40), q = a.pt(th, L.lerp(d0, d1, sstep(t0, t1, th)) + 2.4 * NZ.n2(th * 8, key)); pts.push([q.x, q.y]); }
    return pts;
  };
  brush(g, inner(0.04, -0.3, -5, -31, 8.8), { w: 6.4, seed: 11, head: 1.0, tin: 0.03, tout: 0.06, dry: 0.36, wob: 0.42, wlen: 120, step: 4 });
  brush(g, inner(-0.265, -s, -27, -37, 3.8), { w: 7.4, seed: 12, head: 1.25, tin: 0.03, tout: 0.02, dry: 0.26, wob: 0.4, wlen: 120, step: 4 });
  // … and in pale ink on the right, where the hand only felt for it
  brush(gl, inner(0.07, 0.3, -14, -30, 5.1), { w: 4.6, seed: 13, tin: 0.04, tout: 0.3, dry: 0.5, wob: 0.4, step: 4 });
  brush(gl, inner(0.33, s, -29, -35, 6.6), { w: 5.2, seed: 14, tin: 0.04, tout: 0.04, dry: 0.42, wob: 0.4, step: 4 });
  // drops shaken off where the brush first pressed, and where it was set down the second time
  const d0 = a.pt(-0.348, 0); spatter(g, r, d0.x - 4, d0.y + 26, 2.1, 7, 84);
  spatter(g, r, h.x + 10, h.y + 22, 1.2, 5, 60, 3.4);
}

// ───────────────────────── plum branches standing in the vat (折枝梅) ─────────────────────────
/** a five-petalled blossom, each petal one quick ring (圈梅) */
function blossom(g, r, x, y, R, sd) {
  const rot = r() * L.TAU, sq = r.range(0.74, 1);
  for (let k = 0; k < 5; k++) {
    const ph = rot + (k / 5) * L.TAU + r.range(-0.12, 0.12), pr = R * r.range(0.44, 0.55), pd = R * 0.56;
    const pcx = x + Math.cos(ph) * pd, pcy = y + Math.sin(ph) * pd * sq, a0 = ph + Math.PI + 0.85, sw = L.TAU - 1.7, pts = [];
    for (let j = 0; j <= 7; j++) { const t = a0 + (sw * j) / 7; pts.push([pcx + Math.cos(t) * pr, pcy + Math.sin(t) * pr * sq]); }
    brush(g, pts, { w: r.range(2.9, 3.7), head: 1.25, tin: 0.1, tout: 0.3, dry: 0.22, seed: sd + k, step: 2.5, cap: false });
  }
  blot(g, x, y, R * 0.13, sd);
  for (let k = 0; k < 6; k++) { const t = r() * L.TAU, d = R * r.range(0.24, 0.42); blot(g, x + Math.cos(t) * d, y + Math.sin(t) * d * sq, r.range(1.2, 2), sd + k * 2.1); }
}
function bud(g, r, x, y, R, ang, sd) {
  const pts = [];
  for (let j = 0; j <= 9; j++) { const t = ang + Math.PI + 0.3 + ((L.TAU - 0.5) * j) / 9; pts.push([x + Math.cos(t) * R, y + Math.sin(t) * R * 0.92]); }
  brush(g, pts, { w: 3, head: 1.2, tout: 0.25, dry: 0.2, seed: sd, step: 2.5, cap: false });
  blot(g, x - Math.cos(ang) * R * 0.95, y - Math.sin(ang) * R * 0.95, R * 0.42, sd + 1);
}
function drawPlum(g, gl, a) {
  const r = L.rng('s35q-plum-1'), lim = tipLimit(a);
  // old wood: angular, a knuckle at every turn; dragged with a dry brush (枯笔) and edged with two quick lines
  const TR = [
    { pts: [[1012, 1210], [990, 1085], [938, 965], [968, 868], [906, 778], [930, 700], [884, 642]], w: 25 },
    { pts: [[1066, 1210], [1078, 1070], [1124, 950], [1086, 858], [1152, 762], [1128, 686]], w: 19 },
    { pts: [[936, 1210], [884, 1052], [806, 962], [772, 862], [704, 792], [694, 714]], w: 13.5 },
  ];
  const seg = (p0, p1, w, sd) => {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
    const q0 = [p0[0] - ux * w * 0.3, p0[1] - uy * w * 0.3], q1 = [p1[0] + ux * w * 0.4, p1[1] + uy * w * 0.4];
    const bow = r.range(-0.05, 0.05) * l, mid = [(q0[0] + q1[0]) / 2 + nx * bow, (q0[1] + q1[1]) / 2 + ny * bow];
    if (w > 9) {
      brush(g, [q0, mid, q1], { w, prof: 'flat', dry: 0.66, wob: 0.3, wlen: 60, seed: sd, cap: false });
      const e = w * 0.5, sg = nx > 0 ? 1 : -1;       // the edge away from the light is the heavier one
      brush(g, [[q0[0] + sg * nx * e, q0[1] + sg * ny * e], [mid[0] + sg * nx * e * 1.06, mid[1] + sg * ny * e * 1.06], [q1[0] + sg * nx * e * 0.9, q1[1] + sg * ny * e * 0.9]], { w: 5.6, dry: 0.22, tout: 0.2, jit: 1.6, seed: sd + 0.3 });
      brush(g, [[q0[0] - sg * nx * e, q0[1] - sg * ny * e], [mid[0] - sg * nx * e * 1.06, mid[1] - sg * ny * e * 1.06], [q1[0] - sg * nx * e * 0.9, q1[1] - sg * ny * e * 0.9]], { w: 3.6, dry: 0.42, tout: 0.3, jit: 1.6, seed: sd + 0.6 });
    } else brush(g, [q0, mid, q1], { w, head: 1.3, tout: 0.15, dry: 0.3, seed: sd });
  };
  TR.forEach((t, ti) => {
    const n = t.pts.length - 1;
    for (let i = 0; i < n; i++) seg(t.pts[i], t.pts[i + 1], t.w * L.lerp(1, 0.44, i / (n - 1)), 100 + ti * 20 + i);
    // scars at the knuckles (节疤) and moss dots (苔点)
    for (let i = 2; i < n; i++) {
      const [kx, ky] = t.pts[i], R = t.w * L.lerp(0.42, 0.26, i / n), pts = [];
      for (let j = 0; j <= 9; j++) { const an = 0.6 + (L.TAU * 0.86 * j) / 9; pts.push([kx + Math.cos(an) * R, ky + Math.sin(an) * R * 0.8]); }
      brush(g, pts, { w: 3.4, tout: 0.3, dry: 0.3, seed: 160 + ti * 9 + i, step: 2.5 });
      for (let k = 0; k < 3; k++) blot(g, kx + r.range(-1.3, 1.3) * t.w, ky + r.range(-1.6, 1.6) * t.w, r.range(2.4, 4.6), ti * 10 + i + k, 0.7);
    }
  });
  // this year's shoots (气条): long, fast, nearly straight; each carries short side twigs with blossoms and buds
  const SH = [ // base x, y → tip x, dr at the tip (≤ 0: under the rim; > 0: pokes through), width
    [968, 868, 1000, -2, 8], [906, 778, 842, -1, 7], [930, 700, 950, -2, 6], [884, 642, 868, -1, 5.4],
    [938, 965, 1046, -44, 6.4],
    [1086, 858, 1076, -1, 7.6], [1152, 762, 1238, -3, 7], [1128, 686, 1142, -2, 6], [1124, 950, 1338, -34, 6.4], [1152, 762, 1186, -58, 5.4],
    [772, 862, 758, -2, 7], [704, 792, 622, -5, 6.4], [694, 714, 702, -1, 5.4], [806, 962, 640, -96, 6], [884, 1052, 566, -150, 6],
    [704, 792, 414, 34, 6], [1152, 762, 1500, 40, 6],
  ];
  let flowers = 0;
  SH.forEach(([x0, y0, tx, dr, w], si) => {
    const x1 = tx, y1 = a.yAt(tx) - dr, dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
    const bow = r.range(-0.045, 0.045) * len, mx = (x0 + x1) / 2 - Math.sin(ang) * bow, my = (y0 + y1) / 2 + Math.cos(ang) * bow;
    const at = (t) => [x0 * (1 - t) * (1 - t) + 2 * (2 * mx - (x0 + x1) / 2) * t * (1 - t) + x1 * t * t, y0 * (1 - t) * (1 - t) + 2 * (2 * my - (y0 + y1) / 2) * t * (1 - t) + y1 * t * t];
    brush(g, [[x0, y0], [mx, my], [x1, y1]], { w, seed: 200 + si, head: 1.4, tin: 0.05, tout: 0.5, dry: r.range(0.2, 0.5), wob: 0.3 });
    const nt = Math.max(2, Math.round(len / 62));
    for (let i = 0; i < nt; i++) {
      const t = L.lerp(0.22, 0.95, (i + r.range(0.1, 0.9)) / nt), [bx, by] = at(t), side = (i % 2 ? 1 : -1) * (r.chance(0.85) ? 1 : -1);
      const ta = ang + side * r.range(0.42, 0.95), tl = r.range(46, 120) * L.lerp(1, 0.55, t);
      let [ex, ey] = [bx + Math.cos(ta) * tl, by + Math.sin(ta) * tl];
      [ex, ey] = capTo(a, bx, by, ex, ey, lim);
      const l2 = Math.hypot(ex - bx, ey - by); if (l2 < 14) continue;
      const pale = r.chance(0.2);
      brush(pale ? gl : g, [[bx, by], [(bx + ex) / 2 + r.range(-3, 3), (by + ey) / 2 + r.range(-3, 3)], [ex, ey]], { w: w * r.range(0.5, 0.68), seed: 300 + si * 20 + i, head: 1.4, tin: 0.08, tout: 0.55, dry: r.range(0.15, 0.45) });
      // a spur off the twig
      if (l2 > 50 && r.chance(0.7)) {
        const u = r.range(0.35, 0.7), sx = L.lerp(bx, ex, u), sy = L.lerp(by, ey, u), sa = ta - side * r.range(0.5, 1.0), sl = r.range(18, 44);
        const [qx, qy] = capTo(a, sx, sy, sx + Math.cos(sa) * sl, sy + Math.sin(sa) * sl, lim);
        brush(g, [[sx, sy], [qx, qy]], { w: w * 0.42, seed: 500 + si * 20 + i, head: 1.5, tout: 0.6, dry: 0.3 });
      }
      // blossom, bud, or bare
      const k = r();
      if (k < 0.46 && flowers < 40) {
        const R = r.range(15, 22), u = r.range(0.45, 0.95), fx = L.lerp(bx, ex, u) - Math.sin(ta) * side * R * 0.9, fy = L.lerp(by, ey, u) + Math.cos(ta) * side * R * 0.9;
        if (a.drAt(fx, fy - R) < lim(fx) - 3) { blossom(g, r, fx, fy, R, 600 + si * 30 + i); flowers++; }
      } else if (k < 0.8) {
        const R = r.range(6, 9), fx = ex + Math.cos(ta) * R * 0.6, fy = ey + Math.sin(ta) * R * 0.6;
        if (a.drAt(fx, fy - R) < lim(fx) - 2) bud(g, r, fx, fy, R, ta, 700 + si * 30 + i);
        if (r.chance(0.5)) { const u = r.range(0.3, 0.7), R2 = r.range(5, 7.5), qx = L.lerp(bx, ex, u) + Math.sin(ta) * side * R2 * 1.2, qy = L.lerp(by, ey, u) - Math.cos(ta) * side * R2 * 1.2; if (a.drAt(qx, qy - R2) < lim(qx) - 2) bud(g, r, qx, qy, R2, ta - side * 1.4, 760 + si * 30 + i); }
      }
    }
  });
  // tangles of fine twigs gathering upward (乱线): the brush races up, back down and up again without lifting
  const TG = [[900, 772, 70, 0], [1004, 742, 60, 0], [1094, 752, 64, 0], [1190, 720, 60, 1], [770, 772, 66, 0], [668, 742, 54, 1], [1262, 726, 50, 0], [846, 700, 50, 1], [1050, 690, 46, 1]];
  TG.forEach(([bx, by, sp, pale], ti) => {
    const pts = [], k = r.int(3, 5);
    let x = bx + r.range(-10, 10);
    for (let i = 0; i < k; i++) {
      pts.push([x, by + r.range(-14, 22)]);
      const tx = bx + r.range(-1, 1) * sp * 1.5, ty = a.yAt(tx) - r.pick([-3, -4, -10, -26, -48]);
      const [ex, ey] = capTo(a, x, by, tx, ty, lim);
      pts.push([ex, ey]);
      x = bx + r.range(-1, 1) * sp * 0.6;
    }
    brush(pale ? gl : g, pts, { w: r.range(3, 4.2), seed: 800 + ti, head: 1.2, tin: 0.03, tout: 0.12, dry: 0.42, wob: 0.45, wlen: 50, step: 3 });
  });
}

// ───────────────────────── bamboo sprays (双钩竹) ─────────────────────────
function drawBamboo(g, gl, a) {
  const r = L.rng('s35q-bamboo-2'), lim = tipLimit(a);
  /** a leaf in outline: two lines from the stalk meeting at the tip, the first overshooting in a flick */
  const leaf = (c, x, y, ang, len, sd) => {
    const [tx, ty] = capTo(a, x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len, lim);
    const l = Math.hypot(tx - x, ty - y); if (l < 30) return;
    const cs = Math.cos(ang), sn = Math.sin(ang), nx = -sn, ny = cs, wd = Math.min(len, l * 1.25) * r.range(0.085, 0.115), bend = r.range(-0.1, 0.1) * l;
    const P = (t, o) => [x + cs * l * t + nx * (o * wd + bend * Math.sin(Math.PI * t)), y + sn * l * t + ny * (o * wd + bend * Math.sin(Math.PI * t))];
    brush(c, [P(0, 0), P(0.3, 1), P(0.62, 0.9), P(0.9, 0.3), P(1.06, -0.1)], { w: 5, seed: sd, head: 1.25, tin: 0.08, tout: 0.4, dry: 0.26, wob: 0.3 });
    brush(c, [P(0.02, 0), P(0.3, -1), P(0.62, -0.86), P(0.98, 0)], { w: 3.8, seed: sd + 0.5, head: 1.2, tin: 0.08, tout: 0.4, dry: 0.34, wob: 0.3 });
    if (r.chance(0.55)) brush(gl, [P(0.1, 0), P(0.5, 0.06), P(0.86, 0)], { w: 2.4, seed: sd + 0.8, tout: 0.5, dry: 0.4 });
  };
  const fan = (x, y, dir, n, len, sd, pale) => {
    for (let i = 0; i < n; i++) leaf(pale && i % 2 ? gl : g, x + r.range(-3, 3), y + r.range(-3, 3), dir + (i - (n - 1) / 2) * r.range(0.3, 0.46) + r.range(-0.08, 0.08), len * r.range(0.72, 1.2), sd + i * 1.7);
  };
  /** a culm in two lines, broken at every node, with a hooked tick across the joint */
  const culm = (ctrl, cw, nseg, sd, sprays) => {
    const p = L.smoothPath(ctrl, 6), n = p.length;
    const cum = [0]; for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
    const len = cum[n - 1];
    const at = (s) => { let i = 1; while (i < n - 1 && cum[i] < s) i++; const t = L.clamp((s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)); const x = L.lerp(p[i - 1][0], p[i][0], t), y = L.lerp(p[i - 1][1], p[i][1], t); const dx = p[i][0] - p[i - 1][0], dy = p[i][1] - p[i - 1][1], m = Math.hypot(dx, dy) || 1; return { x, y, ux: dx / m, uy: dy / m }; };
    let s0 = 0;
    for (let k = 0; k < nseg; k++) {
      const s1 = len * Math.pow((k + 1) / nseg, 0.9), wv = cw * L.lerp(1, 0.6, k / nseg);
      for (const sg of [1, -1]) {
        const pts = [];
        for (let j = 0; j <= 5; j++) { const q = at(L.lerp(s0 + 5, s1 - 5, j / 5)), o = sg * wv * 0.5 * (1 - 0.14 * Math.sin((Math.PI * j) / 5)); pts.push([q.x - q.uy * o, q.y + q.ux * o]); }
        brush(g, pts, { w: sg > 0 ? 4.6 : 3.4, seed: sd + k * 2 + sg, head: 1.3, tin: 0.06, tout: 0.08, dry: sg > 0 ? 0.24 : 0.4, wob: 0.3 });
      }
      const q = at(s1);
      if (k < nseg - 1) brush(g, [[q.x + q.uy * wv * 0.8 - q.ux * 3, q.y - q.ux * wv * 0.8 - q.uy * 3], [q.x + q.ux * 3, q.y + q.uy * 3], [q.x - q.uy * wv * 0.8 - q.ux * 2, q.y + q.ux * wv * 0.8 - q.uy * 2]], { w: 4.8, seed: sd + 50 + k, head: 1.3, tout: 0.3, dry: 0.2 });
      // sprays off the upper nodes: a thin stalk, then a fan of drooping leaves
      const sp = sprays[k];
      if (sp) for (const [side, tl, n, ll, dir] of sp) {
        const ta = Math.atan2(q.uy, q.ux) + side * r.range(0.6, 0.9), ex = q.x + Math.cos(ta) * tl, ey = q.y + Math.sin(ta) * tl;
        const [cx2, cy2] = capTo(a, q.x, q.y, ex, ey, (x) => lim(x) - 14);
        brush(g, [[q.x, q.y], [(q.x + cx2) / 2, (q.y + cy2) / 2 + 3], [cx2, cy2]], { w: 3.4, seed: sd + 70 + k, tout: 0.4, dry: 0.3 });
        fan(cx2, cy2, dir, n, ll, sd + 90 + k * 11 + side, k % 2 === 0);
      }
      s0 = s1;
    }
    const top = at(len); return top;
  };
  // right of the plum: a culm leaning out toward the sweet-flag
  culm([[1204, 1210], [1236, 990], [1274, 810], [1306, 664]], 15, 5, 1000, {
    1: [[1, 70, 3, 118, 0.62]], 2: [[-1, 54, 3, 104, 2.5], [1, 88, 4, 124, 0.38]], 3: [[1, 60, 3, 112, 0.2], [-1, 44, 3, 92, 2.2]], 4: [[1, 34, 3, 98, 0.5], [-1, 30, 2, 84, 2.75]],
  });
  // left of it: a thinner one leaning the other way, toward the vase
  culm([[770, 1210], [734, 1010], [672, 842], [600, 690]], 11.5, 5, 1200, {
    1: [[-1, 64, 3, 112, 2.6]], 2: [[-1, 84, 4, 122, 2.82], [1, 46, 3, 96, 0.9]], 3: [[-1, 56, 3, 110, 2.95], [1, 40, 2, 88, 0.6]], 4: [[-1, 30, 3, 100, 2.6], [1, 26, 2, 80, 0.3]],
  });
}

// ───────────────────────── a small-mouthed vase, a few strokes (小口古瓶) ─────────────────────────
function drawVase(g, gl) {
  const cx = 300, o = (dx, y) => [cx + dx, y];
  // left contour in one breath: heavy where the brush is set down under the lip, lifting round the shoulder, pressing again on the belly
  brush(g, [o(-31, 752), o(-27, 792), o(-48, 816), o(-122, 852), o(-166, 906), o(-181, 966), o(-173, 1032), o(-158, 1094), o(-134, 1190)],
    { w: 9.5, seed: 1401, head: 1.4, tin: 0.04, tout: 0.04, dry: 0.3, wob: 0.4, wlen: 150 });
  // right contour in two goes that do not quite meet
  brush(g, [o(31, 752), o(27, 792), o(48, 816), o(124, 853), o(160, 897)], { w: 8, seed: 1402, head: 1.35, tin: 0.06, tout: 0.45, dry: 0.28, wob: 0.34 });
  brush(g, [o(150, 882), o(178, 938), o(183, 986), o(172, 1042), o(157, 1098), o(133, 1190)], { w: 9, seed: 1403, head: 1.4, tin: 0.05, tout: 0.04, dry: 0.34, wob: 0.4, wlen: 150 });
  brush(gl, [o(134, 850), o(176, 902), o(194, 968), o(186, 1040), o(168, 1110)], { w: 4.6, seed: 1404, tout: 0.3, dry: 0.4 });
  // rolled lip: front edge heavy, back edge light; a second line for its thickness
  const ell = (ex, ey, rx, ry, t0, t1, k = 12) => { const pts = []; for (let i = 0; i <= k; i++) { const t = L.lerp(t0, t1, i / k); pts.push([ex + Math.cos(t) * rx, ey + Math.sin(t) * ry]); } return pts; };
  brush(g, ell(cx, 741, 42, 10.5, Math.PI * 1.04, -0.12 * Math.PI), { w: 8.4, seed: 1405, head: 1.3, tin: 0.08, tout: 0.2, dry: 0.2, step: 2.5 });
  brush(g, ell(cx, 741, 41, 10, Math.PI * 1.02, Math.PI * 1.98), { w: 3.8, seed: 1406, tout: 0.3, dry: 0.3, step: 2.5 });
  brush(g, ell(cx, 751, 33, 7.5, Math.PI * 0.94, 0.1 * Math.PI), { w: 3.6, seed: 1407, tout: 0.4, dry: 0.3, step: 2.5 });
  // a ring at the root of the neck, two string lines (弦纹) round the shoulder
  brush(g, ell(cx, 795, 30, 6.5, Math.PI * 0.96, 0.14 * Math.PI), { w: 3.8, seed: 1408, tout: 0.4, dry: 0.34, step: 2.5 });
  brush(g, ell(cx, 868, 147, 24, Math.PI * 0.93, 0.2 * Math.PI, 20), { w: 4.6, seed: 1409, tin: 0.04, tout: 0.4, dry: 0.5, wob: 0.4 });
  brush(gl, ell(cx + 2, 883, 157, 25, Math.PI * 0.88, 0.07 * Math.PI, 20), { w: 3.8, seed: 1410, tin: 0.04, tout: 0.3, dry: 0.4 });
  // the belly turning: one long pale sweep low down
  brush(gl, ell(cx, 1010, 176, 30, Math.PI * 0.84, 0.3 * Math.PI, 20), { w: 3.6, seed: 1411, tin: 0.04, tout: 0.5, dry: 0.5 });
}

// ───────────────────────── a pot of sweet-flag (菖蒲) ─────────────────────────
function drawCalamus(g, gl) {
  const r = L.rng('s35q-calamus-1');
  const cx = 1468, ry0 = 972, RX = 142;
  const ell = (ex, ey, rx, ry, t0, t1, k = 16) => { const pts = []; for (let i = 0; i <= k; i++) { const t = L.lerp(t0, t1, i / k); pts.push([ex + Math.cos(t) * rx, ey + Math.sin(t) * ry]); } return pts; };
  // blades: clumped, short, each one a quick arc that presses at the root and flicks off at the tip
  const blades = [];
  for (let i = 0; i < 70; i++) {
    const bx = cx + L.clamp(r.gauss() * 46, -112, 112), by = ry0 - 5 + r.range(-7, 7);
    const lean = ((bx - cx) / 112) * 0.72 + r.gauss() * 0.2, len = r.range(104, 246) * (1 - 0.28 * Math.abs(lean));
    blades.push([bx, by, lean, len]);
  }
  blades.sort((p, q) => q[3] - p[3]);
  blades.forEach(([bx, by, lean, len], i) => {
    const far = i < 22 && i % 3 === 0;
    const a0 = -Math.PI / 2 + lean, arc = (lean >= 0 ? 1 : -1) * r.range(0.25, 0.75) + lean * 0.5;
    const mx = bx + Math.cos(a0) * len * 0.55, my = by + Math.sin(a0) * len * 0.55;
    const ex = mx + Math.cos(a0 + arc) * len * 0.45, ey = my + Math.sin(a0 + arc) * len * 0.45;
    brush(far ? gl : g, [[bx, by], [mx, my], [ex, ey]], { w: r.range(3.6, 6.4), seed: 1500 + i, head: 1.3, tin: 0.06, tout: 0.7, dry: r.range(0.1, 0.4), wob: 0.25 });
  });
  // the pot: front rim heavy, back rim only at the ends; sides, a string line, the foot
  brush(g, ell(cx, ry0, RX, 19, Math.PI * 1.02, -0.03 * Math.PI, 24), { w: 9, seed: 1601, head: 1.3, tin: 0.04, tout: 0.08, dry: 0.26, wob: 0.36, wlen: 140 });
  brush(g, ell(cx, ry0, RX, 17, Math.PI * 1.0, Math.PI * 1.2, 8), { w: 4, seed: 1602, tout: 0.5, dry: 0.3 });
  brush(g, ell(cx, ry0, RX, 17, 0, -Math.PI * 0.2, 8), { w: 4, seed: 1603, tout: 0.5, dry: 0.3 });
  brush(g, ell(cx, ry0 + 13, RX - 7, 18, Math.PI * 0.95, 0.12 * Math.PI, 24), { w: 3.8, seed: 1604, tout: 0.3, dry: 0.45 });
  brush(g, [[cx - RX + 1, ry0 + 4], [cx - RX + 12, ry0 + 46], [cx - RX + 30, ry0 + 84], [cx - RX + 44, ry0 + 100]], { w: 7.6, seed: 1605, head: 1.35, tout: 0.2, dry: 0.3 });
  brush(g, [[cx + RX - 1, ry0 + 4], [cx + RX - 13, ry0 + 48], [cx + RX - 31, ry0 + 85], [cx + RX - 46, ry0 + 100]], { w: 8.6, seed: 1606, head: 1.35, tout: 0.2, dry: 0.3 });
  brush(g, ell(cx, ry0 + 84, RX - 40, 17, Math.PI * 0.98, 0.02 * Math.PI, 20), { w: 6, seed: 1607, tin: 0.05, tout: 0.2, dry: 0.4, wob: 0.4 });
  brush(gl, ell(cx, ry0 + 50, RX - 16, 20, Math.PI * 0.9, 0.16 * Math.PI, 20), { w: 3.8, seed: 1608, tout: 0.4, dry: 0.4 });
  // stubby feet
  for (const sx of [-1, 1]) brush(g, [[cx + sx * (RX - 62), ry0 + 100], [cx + sx * (RX - 66), ry0 + 122], [cx + sx * (RX - 86), ry0 + 124]], { w: 6, seed: 1610 + sx, tout: 0.3, dry: 0.3 });
  // moss and grit at the roots
  for (let i = 0; i < 16; i++) blot(g, cx + r.gauss() * 62, ry0 - 6 + r.range(-6, 5), r.range(2, 4.4), 1650 + i, 0.6);
}

// ───────────────────────── a Buddha's-hand citron, a few ring lines (佛手) ─────────────────────────
function drawFoshou(g, gl) {
  const r = L.rng('s35q-foshou-1');
  const C = [1832, 988], N = 7;
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    const ang = L.lerp(Math.PI * 1.0, Math.PI * 1.54, u) + r.range(-0.05, 0.05);       // fingers fan from "left" round to "up"
    const len = L.lerp(148, 214, Math.sin(Math.PI * (0.15 + 0.7 * u))) * r.range(0.9, 1.08), root = 50, wid = r.range(31, 41);
    const c = Math.cos(ang), s = Math.sin(ang), nx = -s, ny = c, curl = (i % 2 ? 1 : -1) * r.range(0.3, 0.7);
    const P = (t, o) => { const d = L.lerp(root, len, t), bend = curl * Math.pow(t, 2.2) * 42, k = wid * 0.5 * L.lerp(1, 0.6, t); return [C[0] + c * d + nx * (bend + o * k), C[1] + s * d + ny * (bend + o * k)]; };
    brush(g, [P(0, 1), P(0.35, 1.08), P(0.7, 1), P(0.93, 0.8), P(1.04, 0), P(0.93, -0.8), P(0.7, -1), P(0.35, -1.06), P(0.04, -0.9)],
      { w: 6.2, seed: 1700 + i, head: 1.3, tin: 0.05, tout: 0.22, dry: r.range(0.2, 0.42), wob: 0.36 });
    // a wrinkle or two across the knuckle
    for (const t of [0.42, 0.66]) if (r.chance(0.7)) brush(i % 2 ? gl : g, [P(t, 0.72), P(t + 0.05, 0), P(t - 0.01, -0.6)], { w: 3, seed: 1720 + i + t, tout: 0.5, dry: 0.3 });
  }
  // the heel of the fruit, its stalk, and a leaf going out of frame
  brush(g, [[C[0] - 44, C[1] + 36], [C[0] + 6, C[1] + 62], [C[0] + 58, C[1] + 44], [C[0] + 68, C[1] - 4], [C[0] + 44, C[1] - 44]], { w: 7.6, seed: 1741, head: 1.3, tout: 0.3, dry: 0.3, wob: 0.36 });
  brush(g, [[C[0] + 60, C[1] + 38], [C[0] + 84, C[1] + 56], [C[0] + 112, C[1] + 62]], { w: 10, seed: 1742, head: 1.2, tout: 0.1, dry: 0.4 });
  brush(g, [[C[0] + 78, C[1] + 44], [C[0] + 110, C[1] - 6], [C[0] + 170, C[1] - 30]], { w: 5, seed: 1743, tout: 0.4, dry: 0.3 });
  brush(g, [[C[0] + 80, C[1] + 50], [C[0] + 132, C[1] + 26], [C[0] + 172, C[1] - 26]], { w: 4, seed: 1744, tout: 0.4, dry: 0.3 });
  // the dish under it
  const pts = []; for (let i = 0; i <= 22; i++) { const t = L.lerp(Math.PI * 0.98, 0.3 * Math.PI, i / 22); pts.push([C[0] - 30 + Math.cos(t) * 196, C[1] + 56 + Math.sin(t) * 26]); }
  brush(g, pts, { w: 7.4, seed: 1750, head: 1.3, tin: 0.04, tout: 0.2, dry: 0.36, wob: 0.4, wlen: 130 });
  // pitted rind: a scatter of dots on the heel
  for (let i = 0; i < 12; i++) blot(gl, C[0] + r.range(-20, 52), C[1] + r.range(-30, 44), r.range(1.6, 3), 1760 + i);
}

// ───────────────────────── blots, flung drops, careless flicks ─────────────────────────
const BLOTS = [[352, 712, 8.5], [1692, 806, 10], [968, 868, 8], [1124, 950, 7], [604, 918, 6.5], [1322, 902, 5.5]];   // where the brush rested and the ink bled (洇)
function drawAccents(g, gl, a) {
  const r = L.rng('s35q-acc');
  BLOTS.forEach(([x, y, rad], i) => blot(g, x, y, rad, 1.1 + i * 1.3));
  spatter(g, r, 1692, 806, -0.75, 8, 92);
  spatter(g, r, 352, 712, -2.3, 6, 70, 3.6);
  spatter(g, r, 640, 700, 2.0, 5, 60, 3.4);
  spatter(g, r, 1150, 1010, 0.4, 6, 80, 3.6);
  // a few stars that landed above the rim, far out to the sides
  const p0 = a.pt(-0.335, 44); spatter(g, r, p0.x, p0.y, -2.5, 5, 54, 3.2);
  const p1 = a.pt(0.325, 52); spatter(g, r, p1.x, p1.y, -0.5, 4, 48, 3);
  // long careless flicks across the foot of the sheet
  for (const [x0, y0, x1, y1, bow, sd, c] of [[560, 1150, 520, 930, -30, 1, 0], [1296, 1150, 1330, 960, 26, 2, 1], [1660, 1130, 1700, 880, -20, 3, 0], [70, 1140, 96, 900, 18, 4, 1]]) {
    brush(c ? gl : g, [[x0, y0], [(x0 + x1) / 2 + bow, (y0 + y1) / 2], [x1, y1]], { w: 4.2, seed: 2800 + sd, head: 1.3, tin: 0.04, tout: 0.6, dry: 0.4 });
  }
}

// ───────────────────────── paper ─────────────────────────
const CREASES = [[1402, -PAD, 1386, H + PAD, 1, 1], [-PAD, 892, W + PAD, 872, 2, 0.8], [-PAD, 214, 420, -PAD, 3, 0.5], [1650, H + PAD, W + PAD, 820, 4, 0.5]];
function alongCrease(g, c, fn) {
  const [x0, y0, x1, y1] = c, len = Math.hypot(x1 - x0, y1 - y0);
  g.save(); g.translate(x0, y0); g.rotate(Math.atan2(y1 - y0, x1 - x0)); fn(len); g.restore();
}
function buildPaper(env) {
  const a = env.arc, w = W + PAD * 2, h = H + PAD * 2;
  const r = L.rng('s35q-paper');
  const inZone = (x, y) => x > 560 && x < 1360 && y > 220 && y < a.yAt(x) - 6;
  return L.makeLayer(PAD, (g) => {
    const full = () => g.fillRect(-PAD, -PAD, w, h);
    // apricot-yellow sheet: luminous in the middle, deepening to ochre toward the edges
    g.fillStyle = L.radial(g, 930, 400, 160, 1500, [[0, '#ecd69a'], [0.4, '#e2ca8e'], [0.75, '#d8bb76'], [1, '#c9a45a']]); full();
    // age toning: slow warm blotches, then a finer mottle
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = 0.6;
    g.drawImage(L.noiseTex(w, h, { seed: 's35q-m1', scale: 340, octaves: 4, warp: 0.7, res: 0.2, contrast: 1.5, ramp: [[0, '#dcb268'], [0.5, '#f9eecd'], [1, '#fffcee']] }), -PAD, -PAD);
    g.globalAlpha = 0.36;
    g.drawImage(L.noiseTex(w, h, { seed: 's35q-m2', scale: 44, octaves: 3, res: 0.25, contrast: 1.7, ramp: [[0, '#d0aa62'], [0.45, '#faf2dc'], [1, '#ffffff']] }), -PAD, -PAD);
    g.globalAlpha = 1;
    // water stains (水渍圈): pale pools ringed by a brown tide-line
    {
      const res = 1 / 3, cw = Math.round(w * res), ch = Math.round(h * res), img = new ImageData(cw, ch), d = img.data, nz = L.makeNoise('s35q-stain');
      const pools = [[214, 992, 336, 0.95], [1836, 104, 300, 0.8], [1178, 1012, 62, 0.8], [96, 606, 40, 0.75], [52, 120, 230, 0.6], [1716, 772, 96, 0.5]];
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        const fx = x / res - PAD, fy = y / res - PAD;
        let al = 0;
        for (let i = 0; i < pools.length; i++) {
          const p = pools[i], dx = fx - p[0], dy = fy - p[1];
          if (Math.abs(dx) > p[2] * 1.5 || Math.abs(dy) > p[2] * 1.5) continue;
          const dd = Math.hypot(dx, dy) / p[2] + 0.28 * nz.fbm(fx / 190 + i * 9.1, fy / 190 - i * 4.7, 3) + 0.035 * nz.n2(fx / 21, fy / 21);
          if (dd < 1) { const e = sstep(0.9, 0.995, dd); al += p[3] * (0.06 + 0.5 * e * e + 0.12 * bump(dd, 0.66, 0.025)); }
        }
        const k = (y * cw + x) * 4; d[k] = 150; d[k + 1] = 100; d[k + 2] = 38; d[k + 3] = Math.min(255, al * 255);
      }
      const sc = L.makeCanvas(cw, ch); sc.getContext('2d').putImageData(img, 0, 0);
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.filter = 'blur(1.5px)'; g.drawImage(sc, -PAD, -PAD, w, h); g.filter = 'none';
    }
    // foxing (霉斑): rusty freckles gathered in drifts; almost none where the caption will sit
    const drifts = [[1590, 280, 230], [380, 200, 250], [1010, 930, 280], [1770, 900, 220], [120, 640, 190], [1430, 720, 190], [690, 800, 200]];
    for (let i = 0; i < 300; i++) {
      let x, y;
      if (i % 3) { const dft = drifts[i % drifts.length]; x = dft[0] + r.gauss() * dft[2] * 0.6; y = dft[1] + r.gauss() * dft[2] * 0.6; } else { x = r.range(-PAD, W + PAD); y = r.range(-PAD, H + PAD); }
      const zone = inZone(x, y); if (zone && r.chance(0.88)) continue;
      const rad = L.lerp(2, zone ? 4.5 : 16, Math.pow(r(), 2.6)), al = r.range(0.16, 0.56) * (zone ? 0.4 : 1);
      const col = r.pick(['#a8651e', '#b0722a', SPOT, '#96581c']);
      g.fillStyle = L.radial(g, x, y, 0, rad, [[0, L.rgba(col, al)], [0.5, L.rgba(col, al * 0.7)], [1, L.rgba(col, 0)]]);
      g.beginPath(); g.ellipse(x, y, rad, rad * r.range(0.7, 1), r() * 3, 0, L.TAU); g.fill();
    }
    // mildew: grey-brown pepper in three corners
    for (const [mx, my, mr] of [[120, 960, 150], [1800, 1010, 170], [1850, 70, 150]]) {
      for (let i = 0; i < 60; i++) {
        const x = mx + r.gauss() * mr * 0.55, y = my + r.gauss() * mr * 0.55, rad = L.lerp(1, 5.5, Math.pow(r(), 2));
        g.fillStyle = L.radial(g, x, y, 0, rad, [[0, L.rgba('#5a4526', r.range(0.2, 0.5))], [1, L.rgba('#5a4526', 0)]]);
        g.beginPath(); g.arc(x, y, rad, 0, L.TAU); g.fill();
      }
    }
    g.globalCompositeOperation = 'source-over';
    // the caption's patch of paper is the cleanest on the sheet
    g.save(); g.translate(960, a.crestY - 150); g.scale(1, 0.56);
    g.fillStyle = L.radial(g, 0, 0, 120, 540, [[0, L.rgba('#e9d294', 0.55)], [0.6, L.rgba('#e9d294', 0.32)], [1, L.rgba('#e9d294', 0)]]);
    g.beginPath(); g.arc(0, 0, 540, 0, L.TAU); g.fill(); g.restore();
    L.speckle(g, { seed: 's35q-spk', count: 1500, x: -PAD, y: -PAD, w, h, rMin: 0.4, rMax: 1.8, colors: ['#6a4a1e', '#8a5e24', '#463018'], alpha: [0.1, 0.5], test: (x, y) => !inZone(x, y) || ((x * 7 + y * 13) | 0) % 4 === 0 });
    // long fibres caught in the sheet
    g.lineCap = 'round';
    for (let i = 0; i < 520; i++) {
      const x = r.range(-PAD, W + PAD), y = r.range(-PAD, H + PAD), len = r.range(10, 54), an = r() * Math.PI;
      g.strokeStyle = r.chance(0.55) ? L.rgba('#8a6224', r.range(0.08, 0.24)) : L.rgba('#fff6d8', r.range(0.1, 0.3));
      g.lineWidth = r.range(0.5, 1.3);
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(an) * len * 0.5 + r.range(-7, 7), y + Math.sin(an) * len * 0.5 + r.range(-7, 7), x + Math.cos(an) * len, y + Math.sin(an) * len); g.stroke();
    }
    // fine fold creases (折痕): a tonal step across the fold, a dark hairline, a worn pale ridge
    for (const cr of CREASES) alongCrease(g, cr, (len) => {
      const k = cr[5];
      g.fillStyle = L.linear(g, 0, -50, 0, 0, [[0, 'rgba(120,78,16,0)'], [1, `rgba(120,78,16,${0.1 * k})`]]); g.fillRect(0, -50, len, 50);
      g.fillStyle = L.linear(g, 0, 0, 0, 44, [[0, `rgba(255,246,214,${0.16 * k})`], [1, 'rgba(255,246,214,0)']]); g.fillRect(0, 0, len, 44);
      for (let x = 0; x < len; x += 5) {
        const n = NZ.n2(x * 0.012, cr[4] * 3.3), yy = 2.4 * NZ.n2(x * 0.004, 7 + cr[4]);
        g.fillStyle = `rgba(104,66,16,${(Math.max(0, 0.18 + 0.2 * n) * k).toFixed(3)})`; g.fillRect(x, yy - 1.2, 5.5, 1.2);
        g.fillStyle = `rgba(255,248,222,${(Math.max(0, 0.24 + 0.26 * n) * k).toFixed(3)})`; g.fillRect(x, yy, 5.5, 1.4);
      }
      for (let i = 0; i < len * 0.3 * k; i++) { g.fillStyle = L.rgba('#fff7dc', r.range(0.1, 0.42)); g.fillRect(r() * len, r.gauss() * 3, r.range(1, 4), r.range(0.6, 1.6)); }
    });
    // paper tooth and a gentle cockling of the sheet
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.5;
    g.drawImage(L.grainTex(w, h, { seed: 's35q-tooth', amount: 0.2, size: 2 }), -PAD, -PAD);
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.24;
    g.drawImage(L.noiseTex(w, h, { seed: 's35q-cockle', scale: 460, sx: 1.8, octaves: 3, res: 0.15, contrast: 1.5 }), -PAD, -PAD);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  });
}
/** bookworm holes (虫蛀): the sheet lies on dark wood — a shadowed pit with a lit lip on the side facing the light */
function drawHoles(g) {
  const r = L.rng('s35q-holes');
  const pit = (path) => {
    g.save(); g.translate(1.3, 1.3); g.fillStyle = 'rgba(255,244,206,0.75)'; path(); g.fill(); g.restore();
    g.save(); g.translate(-0.8, -0.8); g.fillStyle = 'rgba(96,62,18,0.5)'; path(); g.fill(); g.restore();
    g.fillStyle = '#2c1c0c'; path(); g.fill();
    g.save(); path(); g.clip(); g.translate(1.8, 1.8); g.fillStyle = '#6a4620'; path(); g.fill(); g.restore();
  };
  const lump = (x, y, rad, sd, sq) => () => {
    g.beginPath();
    for (let i = 0; i <= 14; i++) { const an = (i / 14) * L.TAU, rr = rad * (1 + 0.34 * NZ.n2(Math.cos(an) * 1.3 + sd, Math.sin(an) * 1.3 - sd)); const px = x + Math.cos(an) * rr, py = y + Math.sin(an) * rr * sq; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
    g.closePath();
  };
  // single holes
  for (const [x, y, rad] of [[1612, 318, 5], [246, 412, 4.2], [1826, 598, 5.5], [84, 872, 4.6], [704, 1016, 5], [1318, 836, 4], [468, 262, 3.6], [1470, 152, 4.4], [1004, 1052, 3.6], [1884, 884, 4], [556, 664, 3.2]]) {
    pit(lump(x + r.range(-4, 4), y + r.range(-4, 4), rad, x * 0.01 + y, r.range(0.7, 1)));
  }
  // galleries: the worm's wandering track
  for (const [x0, y0, an0, n, wd] of [[1566, 236, 0.5, 9, 3.4], [152, 512, -0.9, 7, 3], [1764, 1004, 2.6, 8, 3.2]]) {
    let x = x0, y = y0, an = an0;
    const cs = [];
    for (let i = 0; i < n; i++) { cs.push([x, y, wd * r.range(0.7, 1.3)]); an += r.range(-0.7, 0.7); const st = r.range(5, 8.5); x += Math.cos(an) * st; y += Math.sin(an) * st; }
    pit(() => { g.beginPath(); for (const [px, py, pr] of cs) { g.moveTo(px + pr, py); g.arc(px, py, pr, 0, L.TAU); } });
  }
}

/** what the paper's tooth takes back out of the ink: pinholes, dry patches, wear along the folds (a destination-out mask) */
function buildErosion() {
  const w = W + PAD * 2, h = H + PAD * 2, hw = w >> 1, hh = h >> 1;
  const c = L.makeCanvas(w, h), g = c.getContext('2d');
  const r = L.rng('s35q-tooth'), img = new ImageData(hw, hh), d = img.data;
  for (let i = 3; i < d.length; i += 4) { const v = r(); if (v > 0.93) d[i] = 50 + (v - 0.93) * 2000; }
  const pin = L.makeCanvas(hw, hh); pin.getContext('2d').putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true; g.globalAlpha = 0.75; g.drawImage(pin, 0, 0, w, h); g.globalAlpha = 1;
  g.drawImage(L.noiseTex(w, h, { seed: 's35q-dry', scale: 22, octaves: 3, res: 0.33, contrast: 2.1, ramp: [[0, 'rgba(0,0,0,0.42)'], [0.26, 'rgba(0,0,0,0.08)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0)']] }), 0, 0);
  g.drawImage(L.noiseTex(w, h, { seed: 's35q-dry2', scale: 260, octaves: 3, res: 0.15, contrast: 1.6, ramp: [[0, 'rgba(0,0,0,0.2)'], [0.5, 'rgba(0,0,0,0.03)'], [1, 'rgba(0,0,0,0)']] }), 0, 0);
  g.translate(PAD, PAD);
  for (const cr of CREASES) alongCrease(g, cr, (len) => {
    for (let i = 0; i < len * 0.7 * cr[5]; i++) { g.fillStyle = `rgba(0,0,0,${r.range(0.3, 1).toFixed(2)})`; g.fillRect(r() * len, r.gauss() * 1.7 - 0.5, r.range(1, 4.5), r.range(0.8, 2.4)); }
  });
  return c;
}
/** ink is not vector: soften the layer a touch, push its edge about with noise, and harden it again (rows from y0 down) */
function roughen(layer, y0) {
  const w = layer.width, h = layer.height - y0, c = L.makeCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true });
  g.filter = 'blur(1.1px)'; g.drawImage(layer, 0, -y0); g.filter = 'none';
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let y = 0, i = 3; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
    const al = d[i];
    if (al < 6 || al > 249) continue;
    const n = NZ.n2(x * 0.3, y * 0.3) * 0.27 + NZ.n2(x * 0.071 + 40, y * 0.071) * 0.13;
    d[i] = L.clamp((al / 255 - 0.42 + n) * 3.4 + 0.5) * 255;
  }
  g.putImageData(img, 0, 0);
  const lg = layer.getContext('2d');
  lg.save(); lg.setTransform(1, 0, 0, 1, 0, 0); lg.clearRect(0, y0, w, h); lg.drawImage(c, 0, y0); lg.restore();
}
function erode(layer, mask, amt) {
  const g = layer.getContext('2d');
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-out'; g.globalAlpha = amt;
  g.drawImage(mask, 0, 0);
  g.restore();
}

export default {
  name: '清供白描稿',
  tone: 'dark',
  init(env) {
    const a = env.arc;
    const paper = buildPaper(env);
    const light = L.makeLayer(PAD), dark = L.makeLayer(PAD);
    const gl = light.getContext('2d'), g = dark.getContext('2d');
    gl.fillStyle = INK_L; g.fillStyle = INK;
    drawRim(g, gl, a);
    drawVase(g, gl);
    drawCalamus(g, gl);
    drawFoshou(g, gl);
    drawBamboo(g, gl, a);
    drawPlum(g, gl, a);
    drawAccents(g, gl, a);
    // ink that bled round the blots: a grey ring in the pale layer
    for (const [bx, by, br] of BLOTS) { gl.fillStyle = L.radial(gl, bx, by, br * 0.8, br * 2.7, [[0, L.rgba(INK_L, 0.6)], [0.7, L.rgba(INK_L, 0.34)], [1, L.rgba(INK_L, 0)]]); gl.beginPath(); gl.arc(bx, by, br * 2.7, 0, L.TAU); gl.fill(); }
    const halo = L.blurred(dark, 5);                    // ink feathering into the fibres (洇)
    const y0 = PAD + 430;
    roughen(dark, y0); roughen(light, y0);
    const mask = buildErosion(); erode(dark, mask, 0.6); erode(light, mask, 1);
    const pic = L.makeLayer(PAD, (c) => {
      c.drawImage(paper, -PAD, -PAD);
      c.globalCompositeOperation = 'multiply';
      c.globalAlpha = 0.24; c.drawImage(halo, -PAD, -PAD);
      c.globalAlpha = 0.8; c.drawImage(light, -PAD, -PAD);
      c.globalAlpha = 1; c.drawImage(dark, -PAD, -PAD);
      c.globalCompositeOperation = 'source-over';
      drawHoles(c);
      // raking light across the sheet: warm at the upper left, falling off to the lower right
      c.globalCompositeOperation = 'soft-light';
      c.fillStyle = L.linear(c, 0, 0, W, H, [[0, 'rgba(255,240,196,0.3)'], [0.5, 'rgba(128,128,128,0)'], [1, 'rgba(70,40,6,0.3)']]);
      c.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    });
    S = { pic };
  },
  draw(ctx, env, p) {
    // the sheet turns a hair under the camera; the ink does not deform
    L.blit(ctx, env, S.pic, { rot: L.lerp(-0.003, 0.003, p), zoom: L.lerp(1.0, 1.008, p) });
  },
};
