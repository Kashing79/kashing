// s14 — 粉彩婴戏图. Macro of the glazed wall of a famille-rose (粉彩) vessel: the arc is the upper edge of a painted
// green slope; on it just TWO big children at play — one astride a bamboo hobby-horse (竹马), one carrying a lantern and
// looking back — brush line over soft enamel washes on a milk-white ground, close enough that the frame crops their hair.
// Below the slope: bare glaze with a window's reflection lying across it, and pin-holes.
//
// Everything painted lives on ONE transparent "paint" layer (drawn painter's-order: every patch of enamel is a filled
// shape with pooled colour at its rim and along its folds, then its ink line). The layer is then given the slight
// relief of over-glaze enamel (bumpLight on its own luminance/alpha) and dropped onto the porcelain with a hair of shadow.
// In draw() the painted surface turns about the arc's centre while the light (shading + reflection) stays put.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 200;
let S = null;
let SEED = 0;
const LW = 2.9;   // contour weight in a child's own units (the children are drawn at about ×2.1)

const C = {
  cream: '#f5efe0', pink: '#e9a3a8', green: '#8fbf7a', ochre: '#a8643a', ink: '#2b2620',
  sepia: '#6b3a26', flesh: '#fdf0e4', fleshD: '#eeb09c', rouge: '#d2475f', hair: '#27211d',
};
// enamel families: base = the white-bodied wash, deep = colour pooled in folds and rims, light = 玻璃白 showing through
const ST = {
  pink: { base: '#ee9fad', deep: '#c43c66', light: '#fff2ef', line: '#5a2630' },
  rouge: { base: '#e77f93', deep: '#ae2748', light: '#fbd3d5', line: '#4e1c28' },
  green: { base: '#97ca7c', deep: '#35803f', light: '#edf8d9', line: '#253d27' },
  yellow: { base: '#f5d560', deep: '#cd841c', light: '#fffadc', line: '#5a3a18' },
  ochre: { base: '#c8824a', deep: '#7c3c1a', light: '#f3d3ae', line: '#3f2415' },
  white: { base: '#fbf3e4', deep: '#d59d8a', light: '#ffffff', line: '#4a3026' },
  blue: { base: '#a6cce0', deep: '#3f7ba2', light: '#eef6f8', line: '#27384a' },
  black: { base: '#3b332c', deep: '#120f0c', light: '#7a6e63', line: '#1c1714' },
};

// ───────────────────────── small geometry helpers ─────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s];
const nrm = (a) => { const m = Math.hypot(a[0], a[1]) || 1; return [a[0] / m, a[1] / m]; };
const mixP = (a, b, t) => [L.lerp(a[0], b[0], t), L.lerp(a[1], b[1], t)];

/** Catmull-Rom through pts (open or closed) → dense [[x, y, u]] where u is the control-point parameter */
function cr(pts, closed = false, step = 5) {
  const n = pts.length, out = [];
  const P = (i) => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const m = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let j = 0; j < m; j++) {
      const t = j / m, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        i + t,
      ]);
    }
  }
  if (!closed) out.push([pts[n - 1][0], pts[n - 1][1], n - 1]);
  return out;
}
/** straight-edged polygon → dense points (corners stay sharp when an ink stroke is run round it) */
function dense(pts, closed = true, step = 6) {
  const out = [], n = pts.length, segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = pts[i], b = pts[(i + 1) % n], m = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let j = 0; j < m; j++) out.push(mixP(a, b, j / m));
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}
const ell = (cx, cy, rx, ry, n = 14, rot = 0) => {
  const o = [], c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) { const t = (i / n) * L.TAU, x = Math.cos(t) * rx, y = Math.sin(t) * ry; o.push([cx + x * c - y * s, cy + x * s + y * c]); }
  return o;
};
const bbox = (pts) => {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  return [x0, y0, x1, y1];
};
/** a closed contour drawn the way a brush draws it: in two or three pulls that swell, thin out, and do not quite meet */
function contour(g, poly, lw, color) {
  const n = poly.length, r = L.rng('s14o' + (SEED++));
  if (n < 46) { ink(g, poly.concat([poly[0], poly[1]]), lw, { taper: [0.02, 0.05], color }); return; }
  const parts = n > 120 ? 3 : 2, start = r.int(0, n - 1), cuts = [];
  for (let k = 0; k <= parts; k++) cuts.push(start + Math.round((n * k) / parts + (k && k < parts ? r.range(-0.08, 0.08) * n : 0)));
  for (let k = 0; k < parts; k++) {
    const i0 = cuts[k] + r.int(0, 2), i1 = cuts[k + 1] + r.int(-2, 3), seg = [];
    for (let i = i0; i <= i1; i++) seg.push(poly[((i % n) + n) % n]);
    if (seg.length > 2) ink(g, seg, lw * r.range(0.86, 1.2), { taper: [r.range(0.03, 0.08), r.range(0.06, 0.16)], color });
  }
}
function trace(g, pts, close) {
  g.beginPath();
  for (let i = 0; i < pts.length; i++) { if (i) g.lineTo(pts[i][0], pts[i][1]); else g.moveTo(pts[i][0], pts[i][1]); }
  if (close) g.closePath();
}
/** a fine brush line: pressure swell, tapered lift-off */
const SHK = L.makeNoise('s14shake');
/** the hand is not a ruler: push a polyline slowly off its true course (so line and colour never quite register) */
function shake(pts, amp, id) {
  let t = 0; const out = [];
  for (let i = 0; i < pts.length; i++) {
    if (i) t += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    out.push([pts[i][0] + amp * SHK.n2(t / 60, id * 7.31), pts[i][1] + amp * SHK.n2(t / 60 + 31.7, id * 3.17)]);
  }
  return out;
}
function ink(g, pts, w = LW, o = {}) {
  const id = SEED++, amp = o.shake === undefined ? 1.5 : o.shake;
  if (amp) pts = shake(pts, amp, id);
  L.inkStroke(g, pts, {
    width: w, color: o.color || C.ink, seed: 's14i' + id, taper: o.taper || [0.1, 0.3],
    wobble: o.wobble === undefined ? 0.42 : o.wobble, alpha: o.alpha === undefined ? 0.88 : o.alpha, smoothStep: 3,
  });
}
/** a limb / ribbon / stick: polygon of varying width round a smooth centre line */
function tube(center, widths, step = 5) {
  const c = cr(center, false, step), n = c.length, Lf = [], Rt = [];
  for (let i = 0; i < n; i++) {
    const a = c[Math.max(0, i - 1)], b = c[Math.min(n - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
    const u = Math.min(widths.length - 1 - 1e-6, c[i][2]), k = Math.floor(u), t = u - k;
    const hw = L.lerp(widths[k], widths[k + 1], L.smooth(t)) / 2;
    Lf.push([c[i][0] + nx * hw, c[i][1] + ny * hw]); Rt.push([c[i][0] - nx * hw, c[i][1] - ny * hw]);
  }
  return { poly: Lf.concat(Rt.slice().reverse()), left: Lf, right: Rt, c };
}
/**
 * One patch of enamel. poly = dense closed outline.
 * o: base (the wash), light + lightCol (玻璃白 showing through, soft streaks), deep (colour pooled at the rim and in the folds),
 *    wash (0..1: the patch is shaded from 玻璃白 at its upper left to pooled colour at its lower right — the 粉彩 look),
 *    streak {dir, seed} (broad brush drags of the wash), folds (polylines: wash + line), ew (wash width scale), edge (rim strength),
 *    lw (line width), outline, inkColor, pattern(g) (clipped)
 */
function piece(g, poly, o = {}) {
  const { base, deep = null, light = null, lightCol = '#ffffff', folds = [], ew = 1, edge = 1, lw = LW, outline = true, inkColor = C.ink, pattern = null,
    foldInk = true, foldLw = lw * 0.74, foldAlpha = 0.88, wash = 0, streak = null } = o;
  g.save();
  const mr = L.rng('s14m' + (SEED++)), mis = o.mis === undefined ? 1 : o.mis;
  g.translate(mr.range(-1.7, 1.7) * mis, mr.range(-1.7, 1.7) * mis);          // the colour never sits exactly inside its line
  trace(g, poly, true); g.fillStyle = base; g.fill(); g.clip();
  g.lineJoin = 'round'; g.lineCap = 'round';
  if (wash && deep) {
    const [x0, y0, x1, y1] = bbox(poly), w = x1 - x0, h = y1 - y0, m = Math.max(w, h);
    g.fillStyle = L.radial(g, x0 + w * 0.34, y0 + h * 0.32, 0, m * 0.72, [[0, L.rgba(lightCol, 0.7 * wash)], [0.5, L.rgba(lightCol, 0.26 * wash)], [1, L.rgba(lightCol, 0)]]);
    g.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
    g.fillStyle = L.radial(g, x0 + w * 0.8, y0 + h * 0.94, 0, m * 0.78, [[0, L.rgba(deep, 0.4 * wash)], [0.55, L.rgba(deep, 0.13 * wash)], [1, L.rgba(deep, 0)]]);
    g.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
  }
  if (streak && deep) {
    // the wash was dragged on with a soft brush: broad, barely darker / lighter bands running one way
    const [x0, y0, x1, y1] = bbox(poly), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, m = Math.hypot(x1 - x0, y1 - y0) / 2;
    const r = L.rng(streak.seed), d = nrm(streak.dir), q = [-d[1], d[0]];
    for (let i = 0; i < (streak.n || 11); i++) {
      const off = r.range(-m, m) * 0.8, s0 = r.range(-m, -m * 0.1), s1 = s0 + r.range(m * 0.5, m * 1.4), bend = r.range(-0.14, 0.14) * m;
      const a = [cx + q[0] * off + d[0] * s0, cy + q[1] * off + d[1] * s0], b = [cx + q[0] * off + d[0] * s1, cy + q[1] * off + d[1] * s1];
      g.strokeStyle = r.chance(0.55) ? deep : lightCol; g.globalAlpha = r.range(0.05, 0.12); g.lineWidth = r.range(7, 24);
      g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo((a[0] + b[0]) / 2 + q[0] * bend, (a[1] + b[1]) / 2 + q[1] * bend, b[0], b[1]); g.stroke();
    }
    g.globalAlpha = 1;
  }
  if (light) {
    g.strokeStyle = lightCol;
    for (const lp of light) for (const [w, al] of [[48, 0.13], [32, 0.2], [18, 0.26], [8, 0.22]]) { g.globalAlpha = al; g.lineWidth = w * ew; trace(g, lp, false); g.stroke(); }
  }
  if (deep) {
    g.strokeStyle = deep;
    // colour pools at the rim — more on the side away from the light
    g.save(); g.translate(-3.5 * ew, -4.5 * ew);
    for (const [w, al] of [[46, 0.08], [30, 0.11], [16, 0.16], [7, 0.2]]) { g.globalAlpha = al * edge; g.lineWidth = w * ew; trace(g, poly, true); g.stroke(); }
    g.restore();
    for (const f of folds) {
      const fp = cr(f, false, 6);
      for (const [w, al] of [[38, 0.1], [24, 0.15], [13, 0.22], [5, 0.28]]) { g.globalAlpha = al; g.lineWidth = w * ew; trace(g, fp, false); g.stroke(); }
    }
  }
  g.globalAlpha = 1;
  if (pattern) pattern(g);
  g.restore();
  if (outline) contour(g, poly, lw, inkColor);
  if (foldInk) for (const f of folds) ink(g, f, foldLw, { taper: [0.06, 0.55], color: inkColor, alpha: foldAlpha });
}
/** short creases on the inside of a bent limb */
function creases(g, t, a, b, c, col, lw = 2.2) {
  const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
  if (Math.abs(cross) < 400) return;
  const inn = cross > 0 ? t.left : t.right, out = cross > 0 ? t.right : t.left, n = t.c.length;
  let m = 0; for (let i = 0; i < n; i++) if (t.c[i][2] <= 1) m = i;
  for (const [o, f] of [[-2, 0.55], [2, 0.42]]) {
    const i0 = L.clamp(m + o, 0, n - 1) | 0, i1 = L.clamp(m + o + (o < 0 ? -3 : 3), 0, n - 1) | 0;
    ink(g, [inn[i0], mixP(inn[i0], out[i1], f * 0.5), mixP(inn[i1], out[i1], f)], lw, { taper: [0.05, 0.65], color: col });
  }
}

// ───────────────────────── the children ─────────────────────────
function hand(g, c, ang, open = false) {
  g.save(); g.translate(c[0], c[1]); g.rotate(ang); g.scale(1.22, 1.22);
  if (open) {
    // a plump open palm: stubby fingers together, the thumb standing off
    piece(g, cr([[-12, 10], [-13, -8], [-3, -13], [3, -22], [10, -26], [15, -20], [13, -12], [24, -11], [31, -5], [32, 3], [27, 10], [14, 13], [0, 13]], true, 3), { base: C.flesh, deep: C.fleshD, ew: 0.4, lw: 2.3, inkColor: C.sepia });
    ink(g, [[31, -1], [25, -1.5], [20, -2]], 1.5, { color: C.sepia, taper: [0.02, 0.5] });
    ink(g, [[30, 4.5], [25, 4], [20, 3.5]], 1.5, { color: C.sepia, taper: [0.02, 0.5] });
    ink(g, [[27, -7], [23, -6.5], [19, -6]], 1.4, { color: C.sepia, taper: [0.02, 0.5], alpha: 0.75 });
    ink(g, [[4, -12], [8, -8], [9, -3]], 1.4, { color: C.sepia, alpha: 0.7 });
  } else {
    piece(g, cr([[-12, -10], [2, -13], [14, -8], [18, 2], [12, 11], [0, 13], [-12, 10]], true, 3), { base: C.flesh, deep: C.fleshD, ew: 0.4, lw: 2.3, inkColor: C.sepia });
    ink(g, [[7, -9], [11, -2], [8, 6]], 1.6, { color: C.sepia });
    ink(g, [[1, -11], [5, -3], [2, 5]], 1.5, { color: C.sepia, alpha: 0.7 });
  }
  g.restore();
}
function shoe(g, ank, ang, col) {
  g.save(); g.translate(ank[0], ank[1]); g.rotate(ang); g.scale(1.14, 1.14);
  piece(g, cr([[-14, -6], [-19, 8], [-13, 18], [12, 20], [34, 18], [42, 11], [32, 3], [14, -5]], true, 4), { base: col.base, deep: col.deep, ew: 0.4, lw: 2.5, inkColor: col.line });
  // white layered sole
  g.strokeStyle = 'rgba(254,250,240,0.96)'; g.lineWidth = 3.8; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-14, 18.5); g.quadraticCurveTo(12, 22, 37, 17.5); g.stroke();
  ink(g, [[-16, 21], [12, 24.5], [39, 19.5]], 2, {});
  g.restore();
}
function arm(g, sh, el, wr, col, trim, o = {}) {
  const d = nrm(sub(wr, el));
  hand(g, add(wr, d, 13), Math.atan2(d[1], d[0]), !!o.open);
  const t = tube([add(sh, nrm(sub(sh, el)), 8), el, wr], o.w || [54, 50, 60]), n = t.c.length;
  const fl = []; for (let i = 5; i < n - 9; i += 3) fl.push(mixP(t.left[i], t.right[i], 0.7));
  piece(g, t.poly, { base: col.base, deep: col.deep, light: [t.c.slice(2, n - 2)], lightCol: col.light, outline: false, inkColor: col.line, folds: fl.length > 2 ? [fl] : [], foldLw: 1.9, foldAlpha: 0.6, wash: 0.6 });
  const k = Math.max(1, n - 5);
  piece(g, t.left.slice(k).concat(t.right.slice(k).reverse()), { base: trim.base, deep: trim.deep, ew: 0.3, outline: false });
  ink(g, t.left, LW, { taper: [0.05, 0.02], color: col.line }); ink(g, t.right, LW, { taper: [0.05, 0.02], color: col.line });
  ink(g, [t.left[n - 1], t.right[n - 1]], LW, { taper: [0.04, 0.04], color: col.line });
  ink(g, [t.left[k], t.right[k]], 2, { taper: [0.04, 0.04], color: col.line });
  creases(g, t, sh, el, wr, col.line);
}
function leg(g, hip, knee, ank, col, shoeCol, shoeAng = 0, o = {}) {
  shoe(g, ank, shoeAng, shoeCol);
  const t = tube([hip, knee, ank], o.w || [76, 64, 40]), n = t.c.length;
  const fl = []; for (let i = 7; i < n - 9; i += 3) fl.push(mixP(t.left[i], t.right[i], 0.32));
  piece(g, t.poly, { base: col.base, deep: col.deep, light: [t.c.slice(3, n - 3)], lightCol: col.light, outline: false, inkColor: col.line, folds: fl.length > 2 ? [fl] : [], foldLw: 1.9, foldAlpha: 0.6, wash: 0.6 });
  ink(g, t.left, LW, { taper: [0.02, 0.02], color: col.line }); ink(g, t.right, LW, { taper: [0.02, 0.02], color: col.line });
  ink(g, [t.left[n - 1], t.right[n - 1]], LW, { taper: [0.04, 0.04], color: col.line });
  ink(g, [t.left[n - 3], t.right[n - 3]], 1.9, { taper: [0.04, 0.04], alpha: 0.75, color: col.line });
  creases(g, t, hip, knee, ank, col.line);
}
/** the short cross-collared jacket. N = base of the neck, P = hips */
function torso(g, N, P, st, o = {}) {
  const ax = nrm(sub(P, N)), q = [ax[1], -ax[0]], len = Math.hypot(P[0] - N[0], P[1] - N[1]), col = st.jacket, wd = o.wd || 1.16, f = len / 144;
  const at = (s, d) => [N[0] + ax[0] * s + q[0] * d * wd, N[1] + ax[1] * s + q[1] * d * wd];   // s down the spine, d toward the child's front
  const poly = cr([at(-6, -24), at(14 * f, -50), at(len * 0.5, -56), at(len + 14, -70), at(len + 30, -38), at(len + 36, 4), at(len + 28, 46), at(len + 12, 67), at(len * 0.56, 60), at(18 * f, 47), at(-6, 22)], true, 5);
  const folds = [
    [at(len * 0.5, -27), at(len * 0.74, -19), at(len + 30, -13)],              // the closing edge, down the wearer's right side
    [at(len * 0.56, -53), at(len * 0.8, -41), at(len + 20, -50)],
    [at(len * 0.66, 58), at(len * 0.84, 42), at(len + 22, 50)],
  ];
  piece(g, poly, {
    base: col.base, deep: col.deep, inkColor: col.line, folds, pattern: o.pattern, wash: 1, streak: { dir: ax, seed: 's14st' + (SEED++) },
    light: [cr([at(30 * f, 30), at(len * 0.55, 44), at(len + 2, 40)], false, 6), cr([at(34 * f, -30), at(len * 0.72, -26), at(len + 6, -14)], false, 6)], lightCol: col.light,
  });
  if (o.sash) {
    const t = tube([at(len * 0.63, -60), at(len * 0.72, 2), at(len * 0.63, 65)], [17, 21, 17]);
    piece(g, t.poly, { base: o.sash.base, deep: o.sash.deep, ew: 0.3, outline: false });
    ink(g, t.left, 2.3, { taper: [0.03, 0.03], color: o.sash.line }); ink(g, t.right, 2.3, { taper: [0.03, 0.03], color: o.sash.line });
  }
  // crossed lapels in the trim colour, closing to the wearer's right (右衽): in this view the child's left side is the far one,
  // so the upper lapel starts at the far side of the neck and runs down toward the near armpit
  for (const cpts of [[at(-8, -22), at(18 * f, -20), at(46 * f, -6)], [at(-8, 24), at(20 * f, 16), at(48 * f, -5), at(72 * f, -30)]]) {
    const t = tube(cpts, cpts.map(() => 15.5));
    piece(g, t.poly, { base: st.trim.base, deep: st.trim.deep, ew: 0.3, outline: false });
    ink(g, t.left, 2.2, { taper: [0.03, 0.03], color: st.trim.line }); ink(g, t.right, 2.2, { taper: [0.03, 0.03], color: st.trim.line });
  }
}
/** big round head on a 100-unit grid, three-quarter view facing +x (flip: looking back over the shoulder) */
function head(g, c, r, o = {}) {
  const { tilt = 0, hair = 'peach', ribbon = C.rouge, flip = false } = o;
  g.save(); g.translate(c[0], c[1]); g.rotate(tilt); g.scale((flip ? -1 : 1) * r / 100, r / 100);
  const HC = { base: C.hair, deep: '#0c0a08' };
  const tuft = (pts, wisps = []) => {
    piece(g, cr(pts, true, 4), { base: HC.base, deep: HC.deep, ew: 0.5, lw: 2.6 });
    for (const w of wisps) ink(g, w, 3, { taper: [0.02, 0.85], alpha: 0.88 });
  };
  const bun = (bx, by, br, side) => {
    // the tie: two short ribbon ends flying outward, a red band at the root
    ink(g, [[bx + side * br * 0.4, by + br * 0.72], [bx + side * br * 1.1, by + br * 0.5], [bx + side * br * 1.55, by + br * 0.78]], 8.5, { color: ribbon, taper: [0.05, 0.45], alpha: 0.95, wobble: 0.15 });
    ink(g, [[bx + side * br * 0.4, by + br * 0.84], [bx + side * br * 1.0, by + br * 1.05], [bx + side * br * 1.25, by + br * 1.5]], 7.5, { color: ribbon, taper: [0.05, 0.45], alpha: 0.95, wobble: 0.15 });
    tuft(ell(bx, by, br, br * 0.9, 10));
    g.strokeStyle = 'rgba(214,204,190,0.5)'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.arc(bx, by, br * 0.58, Math.PI * 1.08, Math.PI * 1.55); g.stroke();
    g.fillStyle = ribbon; g.beginPath(); g.ellipse(bx, by + br * 0.84, br * 0.62, br * 0.25, 0, 0, L.TAU); g.fill();
  };
  if (hair === 'buns') bun(50, -103, 23, 1);
  const skull = cr([[0, -100], [46, -93], [80, -65], [96, -24], [95, 8], [100, 34], [93, 60], [72, 84], [42, 97], [8, 97], [-32, 87], [-66, 63], [-89, 27], [-97, -14], [-87, -54], [-55, -86]], true, 5);
  piece(g, skull, {
    base: C.flesh, deep: C.fleshD, edge: 0.8, lw: 3.7, inkColor: C.sepia, wash: 0.55, lightCol: '#ffffff',
    light: [cr([[-30, -60], [10, -70], [40, -55]], false, 6)],
    pattern: (q) => {
      // 胭脂 on the cheeks: a soft bloom, deepest at its heart
      for (const [bx, by, br, al] of [[20, 42, 42, 0.85], [87, 38, 24, 0.66]]) {
        q.fillStyle = L.radial(q, bx, by, 0, br, [[0, L.rgba('#e8788a', al)], [0.45, L.rgba('#ee96a0', al * 0.6)], [1, L.rgba('#f1aab0', 0)]]);
        q.fillRect(bx - br, by - br, br * 2, br * 2);
      }
    },
  });
  // ear
  piece(g, cr([[-52, -2], [-68, 0], [-77, 16], [-73, 36], [-60, 44], [-50, 32], [-47, 12]], true, 3), { base: C.flesh, deep: C.fleshD, ew: 0.35, lw: 3.1, inkColor: C.sepia });
  ink(g, [[-67, 10], [-61, 20], [-63, 33]], 2.3, { color: C.sepia });
  // brows: thin, high
  ink(g, [[2, -25], [20, -34], [44, -29]], 3.6, { taper: [0.15, 0.5], alpha: 0.85 });
  ink(g, [[62, -31], [76, -36], [90, -30]], 3.1, { taper: [0.2, 0.4], alpha: 0.85 });
  // eyes: a long slender upper lid, a small dark pupil tucked under it, a whisper of lower lid
  ink(g, [[3, -1], [15, -9], [30, -9.5], [45, -2]], 4.2, { taper: [0.2, 0.3], wobble: 0.15 });
  ink(g, [[61, -5], [71, -11], [82, -10.5], [91, -4]], 3.8, { taper: [0.2, 0.3], wobble: 0.15 });
  ink(g, [[11, 3.5], [25, 6.5], [39, 3]], 1.7, { color: C.sepia, alpha: 0.5, taper: [0.2, 0.2] });
  ink(g, [[66, 1], [77, 3.5], [87, 0.5]], 1.6, { color: C.sepia, alpha: 0.5, taper: [0.2, 0.2] });
  g.fillStyle = '#1c1714';
  g.beginPath(); g.ellipse(26, -3.6, 5, 4.6, 0, 0, L.TAU); g.fill();
  g.beginPath(); g.ellipse(76.5, -5.4, 4.3, 4.1, 0, 0, L.TAU); g.fill();
  // nose, mouth, the fold of a plump chin
  ink(g, [[58, 3], [64, 17], [55, 21]], 2.8, { color: C.sepia, taper: [0.2, 0.3] });
  g.fillStyle = L.rgba(C.rouge, 0.95);
  g.beginPath(); g.ellipse(54, 43.5, 8.6, 4.2, 0, 0, L.TAU); g.fill();
  g.beginPath(); g.ellipse(54, 48.5, 5.8, 3.6, 0, 0, L.TAU); g.fill();
  ink(g, [[42, 42.5], [54, 46.5], [66, 42]], 2.4, { taper: [0.2, 0.2] });
  ink(g, [[34, 70], [51, 77], [68, 69]], 1.9, { color: C.sepia, alpha: 0.5, taper: [0.2, 0.2] });
  // the tufts left on a shaved head
  if (hair === 'peach') {
    tuft([[10, -102], [48, -98], [74, -80], [80, -58], [66, -46], [50, -56], [36, -48], [20, -58], [6, -72], [0, -90]], [[[68, -48], [70, -38], [68, -30]], [[36, -50], [35, -40], [38, -33]], [[52, -56], [53, -46], [51, -40]], [[22, -58], [20, -50], [22, -44]]]);
    tuft([[-90, -40], [-66, -58], [-44, -46], [-42, -20], [-56, -4], [-72, 0], [-88, -14]], [[[-52, -8], [-50, 2], [-52, 8]], [[-66, -2], [-66, 8], [-63, 14]], [[-80, -8], [-81, 0], [-78, 6]]]);
  } else if (hair === 'buns') {
    bun(-50, -95, 27, -1);
    tuft([[26, -100], [52, -95], [68, -80], [66, -62], [50, -62], [36, -72], [22, -88]], [[[56, -63], [57, -54], [55, -48]], [[40, -70], [40, -61], [42, -55]]]);
  }
  g.restore();
}
/**
 * Assemble a child from joints (all in the child's own frame: feet at y = 0, up is −y, facing +x).
 * J: N, P, H, r, tilt, flipHead, far/near arm [shoulder, elbow, wrist], far/near leg [hip, knee, ankle, shoeAngle]
 * pr: back / mid / preArm / front callbacks for the things they carry
 */
function kid(g, J, st, pr = {}) {
  if (pr.back) pr.back(g);
  arm(g, J.armFar[0], J.armFar[1], J.armFar[2], st.jacket, st.trim, { open: !!J.openFar });
  if (J.legFar) leg(g, J.legFar[0], J.legFar[1], J.legFar[2], st.pants, st.shoe, J.legFar[3]);
  if (pr.mid) pr.mid(g);
  if (J.legNear) leg(g, J.legNear[0], J.legNear[1], J.legNear[2], st.pants, st.shoe, J.legNear[3]);
  torso(g, J.N, J.P, st, { pattern: st.pattern, sash: st.sash });
  head(g, J.H, J.r || 80, { tilt: J.tilt || 0, hair: st.hair, ribbon: st.ribbon, flip: !!J.flipHead });
  if (pr.preArm) pr.preArm(g);
  arm(g, J.armNear[0], J.armNear[1], J.armNear[2], st.jacket, st.trim);
  if (pr.front) pr.front(g);
}
/** stand a child BEHIND the bank at screen x0: `sink` of its own units are hidden below the contour */
function place(g, env, x0, k, sink, fn) {
  const a = env.arc, th = a.thetaAtX(x0), p = a.pt(th, -sink * k);
  g.save(); g.translate(p.x, p.y); g.rotate(th * 0.5); g.scale(k, k);
  fn(g); g.restore();
}

// ───────────────────────── playthings: one each ─────────────────────────
function leaf(g, bx, by, ang, len, wid, col) {
  g.save(); g.translate(bx, by); g.rotate(ang);
  piece(g, cr([[0, 0], [len * 0.3, -wid * 0.5], [len * 0.7, -wid * 0.36], [len, 0], [len * 0.7, wid * 0.36], [len * 0.3, wid * 0.5]], true, 3), { base: col.base, deep: col.deep, ew: 0.4, lw: 2.2, inkColor: col.line, wash: 0.5, lightCol: col.light });
  ink(g, [[2, 0], [len * 0.5, 0], [len * 0.94, 0]], 1.6, { alpha: 0.7, color: col.line });
  g.restore();
}
/** 竹马: a bamboo pole ridden between the legs, two leaves left on the end that trails on the ground */
function bambooHorse(g, tail, mid, tip, leaves = true) {
  const d = nrm(sub(tail, mid)), ang = Math.atan2(d[1], d[0]);
  if (leaves) {
    leaf(g, tail[0] + 16, tail[1] - 8, ang + 0.62, 84, 23, ST.green);
    leaf(g, tail[0] + 4, tail[1] - 2, ang + 0.12, 96, 25, ST.green);
  }
  const t = tube([tail, mid, tip], [14, 17, 16]);
  piece(g, t.poly, { base: '#a5d28a', deep: ST.green.deep, ew: 0.34, lw: 2.5, light: [t.c], lightCol: '#f3fae2', inkColor: ST.green.line });
  for (const u of [0.06, 0.2, 0.33, 0.61, 0.77, 0.93]) { const i = Math.round(u * (t.c.length - 1)); ink(g, [t.left[i], t.right[i]], 2.8, { taper: [0.02, 0.02], color: ST.green.line }); }
}
/** a round lantern hanging by a cord from the point (x, y) */
function lantern(g, x, y) {
  ink(g, [[x, y], [x + 1, y + 18]], 2, { taper: [0.02, 0.02] });
  const cy = y + 80;
  for (let i = -2; i <= 2; i++) ink(g, [[x + i * 3, cy + 64], [x + i * 6 + (i & 1) * 2, cy + 98], [x + i * 8 - 4, cy + 136]], 4, { color: ST.yellow.deep, taper: [0.02, 0.5], alpha: 0.95 });
  piece(g, cr(ell(x, cy + 68, 9, 8, 8), true, 3), { base: ST.rouge.base, deep: ST.rouge.deep, ew: 0.3, lw: 2.1, inkColor: ST.rouge.line });
  piece(g, cr(ell(x, cy, 52, 55, 14), true, 4), {
    base: L.radial(g, x - 17, cy - 19, 2, 84, [[0, '#fff3ee'], [0.38, '#f3a0ae'], [1, '#d4476a']]), deep: '#a82848', edge: 1.1, lw: LW, inkColor: ST.rouge.line,
    pattern: (q) => {
      q.strokeStyle = L.rgba('#a82848', 0.46); q.lineWidth = 2.4; q.lineCap = 'round';
      for (const k of [-0.7, -0.33, 0.04, 0.4, 0.74]) { q.beginPath(); q.moveTo(x + k * 15, cy - 55); q.quadraticCurveTo(x + k * 90, cy, x + k * 15, cy + 55); q.stroke(); }
    },
  });
  for (const s of [-1, 1]) {
    const yy = cy + s * 54;
    piece(g, dense([[x - 21, yy - 7], [x + 21, yy - 7], [x + 23, yy + 7], [x - 23, yy + 7]]), { base: ST.ochre.base, deep: ST.ochre.deep, ew: 0.3, lw: 2.3, inkColor: ST.ochre.line });
  }
}

// ───────────────────────── the two children ─────────────────────────
/** astride the bamboo horse, both fists on the pole, leaning into the gallop (the bank hides the legs and the pole's trailing end) */
function kidHorse(g) {
  const st = { jacket: ST.pink, trim: ST.green, pants: ST.yellow, shoe: ST.black, hair: 'buns', ribbon: C.rouge, sash: ST.green };
  kid(g, {
    N: [20, -240], P: [-6, -124], H: [36, -302], r: 80, tilt: -0.06,
    armFar: [[30, -222], [86, -196], [130, -172]], armNear: [[8, -222], [46, -176], [88, -153]],
  }, st, { mid: () => bambooHorse(g, [-120, -54], [-8, -100], [222, -195], false) });
}
/** carrying the lantern ahead on a stick, looking back and beckoning */
function kidLantern(g) {
  const st = { jacket: ST.ochre, trim: ST.yellow, pants: ST.pink, shoe: ST.black, hair: 'peach', ribbon: C.rouge, sash: ST.blue };
  kid(g, {
    N: [-4, -236], P: [2, -120], H: [-6, -298], r: 80, tilt: 0.05, flipHead: true, openFar: true,
    armFar: [[6, -218], [-66, -208], [-108, -242]], armNear: [[-10, -218], [36, -186], [80, -200]],
  }, st, {
    preArm: () => ink(g, [[54, -187], [92, -202], [150, -226], [214, -252]], 5.4, { color: C.sepia, taper: [0.02, 0.1], alpha: 0.95, wobble: 0.15 }),
    front: () => lantern(g, 214, -252),
  });
}

// ───────────────────────── the green slope ─────────────────────────
const GCOLS = ['#263a26', '#2d4a2e', '#2b2620', '#33603a'];
function grassClump(g, a, r, th, dr, sc, col) {
  a.at(g, th, dr, () => {
    const nb = r.int(4, 6);
    for (let b = 0; b < nb; b++) {
      const lean = L.lerp(-0.95, 0.95, (b + r.range(-0.3, 0.3)) / (nb - 1)), len = sc * r.range(24, 44) * (1 - 0.3 * Math.abs(lean)), bx = r.range(-5, 5) * sc;
      L.inkStroke(g, [[bx, 2], [bx + Math.sin(lean * 0.4) * len * 0.55, -Math.cos(lean * 0.4) * len * 0.55], [bx + Math.sin(lean) * len, -Math.cos(lean) * len]],
        { width: sc * r.range(3.2, 4.6), color: col, seed: 's14g' + (SEED++), taper: [0.02, 0.8], wobble: 0.25, alpha: 0.9 });
    }
  });
}
function slope(g, env) {
  const a = env.arc, sp = a.span(PAD + 180), nz = L.makeNoise('s14slope'), r = L.rng('s14grass');
  const N = 260, lowPts = [];
  for (let i = 0; i <= N; i++) {
    const th = L.lerp(sp, -sp, i / N), u = th * a.R;
    const p = a.pt(th, -(122 + 50 * nz.fbm(u / 760, 1.3, 3) + 5 * nz.n2(u / 150, 7.7)));
    lowPts.push([p.x, p.y]);
  }
  g.save();
  g.beginPath(); a.trace(g, 0, -sp, sp); for (const p of lowPts) g.lineTo(p[0], p[1]); g.closePath();
  g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 170, a.R, [[0, L.rgba('#cdeab2', 0.9)], [0.35, L.rgba('#b2dc96', 0.97)], [0.7, '#9dcf83'], [0.92, '#8ec577'], [1, '#82bd6c']]);
  g.fill(); g.clip();
  // a second, deeper wash laid in long drifting patches
  g.drawImage(L.polarNoiseLayer(env, PAD, { seed: 's14w2', scale: 230, sx: 3.4, sy: 0.7, octaves: 3, res: 0.25, contrast: 1.5,
    ramp: [[0, L.rgba('#eaf7d6', 0.3)], [0.36, L.rgba('#eaf7d6', 0)], [0.54, L.rgba('#5aa257', 0)], [0.66, L.rgba('#5aa257', 0.2)], [1, L.rgba('#3f8a45', 0.42)]] }), -PAD, -PAD);
  // one long shading stroke part-way down the bank, running with the contour and breaking where the brush lifted
  g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const t0 = L.lerp(-sp, sp, (i + r.range(0.0, 0.35)) / 9), ln = (2 * sp / 9) * r.range(0.5, 0.86), dr = -(62 + 12 * nz.n2(i * 1.7, 3.3));
    for (const [w, al] of [[26, 0.1], [15, 0.14], [7, 0.2]]) { g.strokeStyle = L.rgba('#3c8443', al); g.lineWidth = w; a.stroke(g, dr, t0, t0 + ln); }
  }
  // pigment pooled along the lower rim of the wash, and under the crest line
  g.lineJoin = 'round';
  g.strokeStyle = L.rgba('#5aa257', 0.28); g.lineWidth = 11; trace(g, lowPts, false); g.stroke();
  g.strokeStyle = L.rgba('#479049', 0.4); g.lineWidth = 3.4; trace(g, lowPts, false); g.stroke();
  g.strokeStyle = L.rgba('#479049', 0.16); g.lineWidth = 38; a.stroke(g, -6, -sp, sp);
  g.strokeStyle = L.rgba('#3f8a45', 0.2); g.lineWidth = 16; a.stroke(g, -5, -sp, sp);
  g.restore();

  // the brush contour ON the arc: its upper edge is fixed, the brush swells downward and now and then runs thin
  const M = 640, up = [], dn = [];
  for (let i = 0; i <= M; i++) {
    const th = L.lerp(-sp, sp, i / M), u = th * a.R;
    const w = Math.max(2.4, 6.4 + 3.0 * nz.n2(u / 150, 3.1) + 1.4 * nz.n2(u / 31, 8.8));
    const p0 = a.pt(th, 1.4), p1 = a.pt(th, 1.4 - w);
    up.push([p0.x, p0.y]); dn.push([p1.x, p1.y]);
  }
  g.fillStyle = L.rgba('#232d1c', 0.92); trace(g, up.concat(dn.reverse()), true); g.fill();
  // the doubled line under it: finer, in long broken runs
  for (let i = 0; i < 10; i++) {
    const t0 = L.lerp(-sp, sp, (i + r.range(0.0, 0.3)) / 10), ln = (2 * sp / 10) * r.range(0.6, 0.94), dr = -r.range(15, 19);
    ink(g, L.arcPts(a, dr, t0, t0 + ln, 24), r.range(2.6, 3.6), { color: '#2a4428', alpha: 0.66, taper: [0.06, 0.3], wobble: 0.5 });
  }
  // grass: a handful of big springy tufts, unevenly spaced (px along the arc from the crest)
  for (const [u, dr, sc] of [[-1130, -62, 1.9], [-905, -30, 1.5], [-640, -78, 2.2], [-250, -46, 1.7], [-70, -88, 1.3], [215, -58, 2.1], [520, -34, 1.5], [585, -84, 1.9], [905, -56, 2.2], [1160, -40, 1.6], [1390, -76, 2.0], [-1420, -44, 1.8]]) {
    grassClump(g, a, r, u / a.R, dr, sc, r.pick(GCOLS));
  }
  // moss dots (苔点): a few fat clusters on the bank
  for (const [u, dr] of [[-1010, -84], [-455, -26], [-380, -92], [60, -30], [370, -96], [760, -74], [1040, -98], [1265, -28], [-1300, -92], [1500, -60]]) {
    a.at(g, u / a.R, dr, () => {
      const n = r.int(3, 5);
      for (let k = 0; k < n; k++) {
        const rx = r.range(6.5, 11.5);
        g.fillStyle = L.rgba(r.pick(['#24361f', '#2b2620', '#2f5230']), r.range(0.72, 0.92));
        g.beginPath(); g.ellipse(r.range(-30, 30), r.range(-6, 12), rx, rx * r.range(0.55, 0.75), r.range(-0.3, 0.3), 0, L.TAU); g.fill();
      }
    });
  }
}

// ───────────────────────── layers ─────────────────────────
function buildPaint(env) {
  const paint = L.makeLayer(PAD, (g) => {
    // the two children come up from behind the bank: painted only above its contour, then the bank is laid over them
    const a = env.arc;
    g.save(); a.clipAbove(g, -3);
    place(g, env, 400, 2.15, 106, kidHorse);
    place(g, env, 1225, 2.1, 113, kidLantern);
    g.restore();
    slope(g, env);
  });
  // the enamel itself: uneven pooling, a fine tooth, then the slight relief of colour standing proud of the glaze
  L.overlayOn(paint, L.noiseLayer(PAD, { seed: 's14en', scale: 96, octaves: 3, contrast: 1.5, res: 0.25 }), { blend: 'soft-light', alpha: 0.24 });
  L.overlayOn(paint, L.noiseLayer(PAD, { seed: 's14en2', scale: 8, octaves: 2, contrast: 1.5, res: 0.5 }), { blend: 'soft-light', alpha: 0.15 });
  const relief = L.bumpLight(paint, { angle: 45, strength: 1.1, blur: 1.6, res: 0.6 });
  L.overlayOn(paint, relief, { blend: 'overlay', alpha: 0.46 });
  return L.blurred(paint, 1.0);
}
function buildSurface(env, paint) {
  const surf = L.makeLayer(PAD, (g) => {
    const full = () => g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    g.fillStyle = C.cream; full();
    // slow drift in the glaze thickness
    g.globalAlpha = 0.6;
    g.drawImage(L.noiseLayer(PAD, { seed: 's14glaze', scale: 420, octaves: 3, res: 0.2, ramp: [[0, '#eee5cd'], [0.5, '#f5efe0'], [1, '#fcf9f0']] }), -PAD, -PAD);
    g.globalAlpha = 1;
    // pin-holes (棕眼) and the odd iron speck
    const r = L.rng('s14pin');
    for (let i = 0; i < 46; i++) {
      const x = r.range(-PAD, W + PAD), y = r.range(-PAD, H + PAD), rad = r.range(1.1, 2.4) * (r.chance(0.14) ? 1.8 : 1);
      g.fillStyle = L.rgba('#fffdf6', 0.85); g.beginPath(); g.arc(x + rad * 0.55, y + rad * 0.6, rad * 1.05, 0, L.TAU); g.fill();
      g.fillStyle = L.rgba(r.chance(0.25) ? '#3a2a1c' : '#8a6238', r.range(0.45, 0.8)); g.beginPath(); g.arc(x, y, rad, 0, L.TAU); g.fill();
    }
    // hairline wear
    g.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const x = r.range(-PAD, W + PAD), y = r.range(-PAD, H + PAD), ang = r.range(-0.5, 0.5) + (r.chance(0.2) ? 1.2 : 0), len = r.range(60, 260), al = r.range(0.04, 0.1);
      const x1 = x + Math.cos(ang) * len, y1 = y + Math.sin(ang) * len;
      g.lineWidth = r.range(0.7, 1.3);
      g.strokeStyle = L.rgba('#7a5c3a', al); g.beginPath(); g.moveTo(x, y); g.lineTo(x1, y1); g.stroke();
      g.strokeStyle = L.rgba('#ffffff', al * 2.4); g.beginPath(); g.moveTo(x, y + 1); g.lineTo(x1, y1 + 1); g.stroke();
    }
    // colour breathing into the glaze round the enamel, then the enamel with a hair of shadow under its lower-right rim
    g.globalAlpha = 0.14; g.drawImage(L.blurred(paint, 12), -PAD, -PAD); g.globalAlpha = 1;
    g.shadowColor = 'rgba(110,72,36,0.34)'; g.shadowBlur = 3; g.shadowOffsetX = 1.6; g.shadowOffsetY = 2.2;
    g.drawImage(paint, -PAD, -PAD);
    g.shadowColor = 'rgba(0,0,0,0)'; g.shadowBlur = 0; g.shadowOffsetX = 0; g.shadowOffsetY = 0;
  });
  // macro lens: focus sits on the crest and the two children; the wall falls out of focus toward the frame's ends and its foot
  const sg0 = surf.getContext('2d');
  for (const [px, r0, r1] of [[3, 640, 1040], [7, 940, 1420]]) {
    const soft = L.blurred(surf, px), sg = soft.getContext('2d');
    sg.globalCompositeOperation = 'destination-in';
    sg.fillStyle = L.radial(sg, 960 + PAD, 420 + PAD, r0, r1, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]);
    sg.fillRect(0, 0, soft.width, soft.height);
    sg0.drawImage(soft, -PAD, -PAD);
  }
  return surf;
}
/**
 * Reflections on the glaze (half-res, padded). The lens is focused on the painted surface, so the window it mirrors is soft:
 * a long pane lying across the bare wall below the slope, a second, upright one in the gap between the children,
 * and a broken glint where the green enamel stands thick.
 */
function buildGloss(env) {
  const a = env.arc, res = 0.5, GW = Math.round((W + PAD * 2) * res), GH = Math.round((H + PAD * 2) * res);
  const img = new ImageData(GW, GH), d = img.data, nz = L.makeNoise('s14gloss');
  const ss = (e0, e1, v) => { const t = L.clamp((v - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
  for (let j = 0; j < GH; j++) {
    const y = j / res - PAD;
    for (let i = 0; i < GW; i++) {
      const x = i / res - PAD, ddx = x - a.cx, ddy = a.cy - y, rr = Math.sqrt(ddx * ddx + ddy * ddy), dr = rr - a.R;
      let v = 0;
      if (dr < -24 && dr > -100) {
        // light catching the thickness of the green enamel: a broken streak that follows the slope
        const u = Math.atan2(ddx, ddy) * a.R, d0 = dr + 44 + 6 * nz.n2(u / 140, 4.4);
        const brk = ss(-0.2, 0.4, nz.n2(u / 60, dr / 18 + 30));
        v = 0.3 * Math.exp(-(d0 * d0) / (2 * 6 * 6)) * brk * Math.exp(-Math.pow((u + 300) / 640, 2));
      } else if (dr < -150) {
        // a long strip of window lying across the bare wall: soft (the lens is focused on the surface, not on the window),
        // fattest left of centre where the light comes from, thinning to nothing at both ends
        const u = Math.atan2(ddx, ddy) * a.R;
        const op = 3.6 * nz.n2(u / 74, dr / 74) + 1.4 * nz.n2(u / 23 + 9, dr / 23);       // the glaze's orange-peel ruffles the reflection's edge
        const along = Math.exp(-Math.pow((u + 170) / 820, 2));
        const hw = 8 + 30 * along;                                                         // half-width of the bright core
        const e = dr + 318 + op - 0.014 * u;                                               // > 0 above the strip's middle
        const core = (1 - ss(hw * 0.5, hw + 16, e)) * ss(-hw - 9, -hw * 0.55, e);
        const halo = Math.exp(-(e * e) / (2 * 120 * 120));
        // in the sheen round the strip the glaze shows its skin: a fine dimpling (橘皮) that catches the light
        const dim = 0.5 + 0.5 * (0.62 * nz.n2(x / 13, y / 13) + 0.38 * nz.n2(x / 5.5 + 40, y / 5.5));
        v = (0.92 * core * (0.85 + 0.15 * ss(hw, -hw, e)) + halo * (0.06 + 0.2 * dim * dim)) * along;
      } else if (dr > 4 && y < 600 && x > 690 && x < 1210) {
        // the same window seen again in the gap between the children: upright, four panes, bowed by the wall's curve
        const yy = y - 210, op = 2.4 * nz.n2(x / 66, y / 66) + 0.9 * nz.n2(x / 21 + 5, y / 21);
        const bx = x - 968 - 0.00055 * yy * yy - 0.07 * yy + op, by = yy + op * 0.6;
        const px = Math.max(1 - ss(15, 31, Math.abs(bx + 34)), 1 - ss(13, 28, Math.abs(bx - 31)));
        const py = Math.max(1 - ss(50, 70, Math.abs(by + 74)), 1 - ss(54, 76, Math.abs(by - 80)));
        const bloom = Math.exp(-(bx * bx) / (2 * 96 * 96) - (by * by) / (2 * 170 * 170));
        v = 0.8 * px * py * (0.7 + 0.3 * L.clamp(1 - (by + 140) / 300)) + 0.2 * bloom;
      }
      if (v <= 0.003) continue;
      const k = (j * GW + i) * 4;
      d[k] = 252; d[k + 1] = 253; d[k + 2] = 252; d[k + 3] = L.clamp(v) * 255;
    }
  }
  const c = L.makeCanvas(GW, GH);
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

export default {
  name: '粉彩婴戏图',
  tone: 'dark',
  init(env) {
    SEED = 0;
    const t0 = performance.now();
    const paint = buildPaint(env);
    const t1 = performance.now();
    const surface = buildSurface(env, paint);
    const t2 = performance.now();
    const gloss = buildGloss(env);
    console.warn(`s14 timing: paint ${(t1 - t0) | 0} surface ${(t2 - t1) | 0} gloss ${(performance.now() - t2) | 0}`);
    S = { surface, gloss };
  },
  draw(ctx, env, p) {
    // the painted wall turns slowly: children and slope slide along the arc
    const rot = L.lerp(-0.014, 0.014, p);
    L.blit(ctx, env, S.surface, { rot, zoom: L.lerp(1.0, 1.014, p) });
    // the light does not turn with it: it comes from the upper left, and the wall rolls away toward its foot and the corners …
    ctx.save(); ctx.globalCompositeOperation = 'multiply';
    const a = env.arc;
    ctx.fillStyle = L.radial(ctx, 660, 220, 300, 1850, [[0, '#ffffff'], [0.5, '#fbf6ea'], [1, '#eedfc4']]);
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = L.radial(ctx, a.cx, a.cy, a.R - 720, a.R - 170, [[0, '#e0d2b6'], [0.4, '#f1e9d7'], [0.7, '#f7f1e4'], [1, '#ffffff']]);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    // … and the window's reflections lie still on the glaze
    L.cam(ctx, env, { rot: -rot * 0.4 }, () => ctx.drawImage(S.gloss, -PAD, -PAD, W + PAD * 2, H + PAD * 2));
  },
};
