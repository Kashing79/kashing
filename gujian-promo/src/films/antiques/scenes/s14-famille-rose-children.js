// s14 — 粉彩婴戏图. Macro of the glazed wall of a famille-rose (粉彩) vessel: the arc is the upper edge of a painted
// green slope; on it a row of children at play (kite, bamboo hobby-horse, lantern, butterfly), fine ink outline over
// soft enamel washes on a milk-white ground. Below the slope: bare glaze with a soft window reflection and pin-holes.
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
function trace(g, pts, close) {
  g.beginPath();
  for (let i = 0; i < pts.length; i++) { if (i) g.lineTo(pts[i][0], pts[i][1]); else g.moveTo(pts[i][0], pts[i][1]); }
  if (close) g.closePath();
}
/** a fine brush line: pressure swell, tapered lift-off */
function ink(g, pts, w = 2.4, o = {}) {
  L.inkStroke(g, pts, {
    width: w, color: o.color || C.ink, seed: 's14i' + (SEED++), taper: o.taper || [0.1, 0.3],
    wobble: o.wobble === undefined ? 0.3 : o.wobble, alpha: o.alpha === undefined ? 0.88 : o.alpha, smoothStep: 3,
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
 *    folds (polylines: wash + line), ew (wash width scale), edge (rim strength), lw (line width), outline, inkColor, pattern(g) (clipped)
 */
function piece(g, poly, o = {}) {
  const { base, deep = null, light = null, lightCol = '#ffffff', folds = [], ew = 1, edge = 1, lw = 2.4, outline = true, inkColor = C.ink, pattern = null, foldInk = true } = o;
  g.save();
  trace(g, poly, true); g.fillStyle = base; g.fill(); g.clip();
  g.lineJoin = 'round'; g.lineCap = 'round';
  if (light) {
    g.strokeStyle = lightCol;
    for (const lp of light) for (const [w, al] of [[48, 0.13], [32, 0.2], [18, 0.26], [8, 0.22]]) { g.globalAlpha = al; g.lineWidth = w * ew; trace(g, lp, false); g.stroke(); }
  }
  if (deep) {
    g.strokeStyle = deep;
    for (const [w, al] of [[46, 0.06], [30, 0.09], [16, 0.13], [7, 0.17]]) { g.globalAlpha = al * edge; g.lineWidth = w * ew; trace(g, poly, true); g.stroke(); }
    for (const f of folds) {
      const fp = cr(f, false, 6);
      for (const [w, al] of [[38, 0.1], [24, 0.14], [13, 0.2], [5, 0.26]]) { g.globalAlpha = al; g.lineWidth = w * ew; trace(g, fp, false); g.stroke(); }
    }
  }
  g.globalAlpha = 1;
  if (pattern) pattern(g);
  g.restore();
  if (outline) ink(g, poly.concat([poly[0], poly[1]]), lw, { taper: [0.015, 0.03], color: inkColor });
  if (foldInk) for (const f of folds) ink(g, f, lw * 0.74, { taper: [0.06, 0.55], color: inkColor });
}
/** short creases on the inside of a bent limb */
function creases(g, t, a, b, c, col, lw = 1.8) {
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
function hand(g, c, ang) {
  g.save(); g.translate(c[0], c[1]); g.rotate(ang);
  piece(g, cr([[-12, -10], [2, -13], [14, -8], [18, 2], [12, 11], [0, 13], [-12, 10]], true, 3), { base: C.flesh, deep: C.fleshD, ew: 0.4, lw: 2, inkColor: C.sepia });
  ink(g, [[7, -9], [11, -2], [8, 6]], 1.4, { color: C.sepia });
  ink(g, [[1, -11], [5, -3], [2, 5]], 1.3, { color: C.sepia, alpha: 0.7 });
  g.restore();
}
function shoe(g, ank, ang, col) {
  g.save(); g.translate(ank[0], ank[1]); g.rotate(ang);
  piece(g, cr([[-14, -6], [-19, 8], [-13, 18], [12, 20], [34, 18], [42, 11], [32, 3], [14, -5]], true, 4), { base: col.base, deep: col.deep, ew: 0.4, lw: 2.2, inkColor: col.line });
  // white layered sole
  g.strokeStyle = 'rgba(254,250,240,0.96)'; g.lineWidth = 3.4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-14, 18.5); g.quadraticCurveTo(12, 22, 37, 17.5); g.stroke();
  ink(g, [[-16, 21], [12, 24.5], [39, 19.5]], 1.7, {});
  g.restore();
}
function arm(g, sh, el, wr, col, trim, o = {}) {
  const d = nrm(sub(wr, el));
  hand(g, add(wr, d, 12), Math.atan2(d[1], d[0]));
  const t = tube([add(sh, nrm(sub(sh, el)), 8), el, wr], o.w || [48, 45, 52]), n = t.c.length;
  const fl = []; for (let i = 3; i < n - 6; i += 3) fl.push(mixP(t.left[i], t.right[i], 0.7));
  piece(g, t.poly, { base: col.base, deep: col.deep, light: [t.c.slice(2, n - 2)], lightCol: col.light, outline: false, inkColor: col.line, folds: fl.length > 2 ? [fl] : [] });
  const k = Math.max(1, n - 4);
  piece(g, t.left.slice(k).concat(t.right.slice(k).reverse()), { base: trim.base, deep: trim.deep, ew: 0.3, outline: false });
  ink(g, t.left, 2.4, { taper: [0.05, 0.02], color: col.line }); ink(g, t.right, 2.4, { taper: [0.05, 0.02], color: col.line });
  ink(g, [t.left[n - 1], t.right[n - 1]], 2.4, { taper: [0.04, 0.04], color: col.line });
  ink(g, [t.left[k], t.right[k]], 1.6, { taper: [0.04, 0.04], color: col.line });
  creases(g, t, sh, el, wr, col.line);
}
function leg(g, hip, knee, ank, col, shoeCol, shoeAng = 0, o = {}) {
  shoe(g, ank, shoeAng, shoeCol);
  const t = tube([hip, knee, ank], o.w || [62, 52, 30]), n = t.c.length;
  const fl = []; for (let i = 5; i < n - 5; i += 3) fl.push(mixP(t.left[i], t.right[i], 0.32));
  piece(g, t.poly, { base: col.base, deep: col.deep, light: [t.c.slice(3, n - 3)], lightCol: col.light, outline: false, inkColor: col.line, folds: fl.length > 2 ? [fl] : [] });
  ink(g, t.left, 2.4, { taper: [0.02, 0.02], color: col.line }); ink(g, t.right, 2.4, { taper: [0.02, 0.02], color: col.line });
  ink(g, [t.left[n - 1], t.right[n - 1]], 2.6, { taper: [0.04, 0.04], color: col.line });
  ink(g, [t.left[n - 3], t.right[n - 3]], 1.5, { taper: [0.04, 0.04], alpha: 0.75, color: col.line });
  creases(g, t, hip, knee, ank, col.line);
}
/** scattered five-dot blossoms on a garment */
function florets(seed, col, x0, y0, x1, y1, n = 16, centre = '#fffae8') {
  return (q) => {
    const r = L.rng(seed);
    for (let i = 0; i < n; i++) {
      const x = r.range(x0, x1), y = r.range(y0, y1), rot = r() * L.TAU;
      q.fillStyle = L.rgba(col, 0.74);
      for (let k = 0; k < 5; k++) { q.beginPath(); q.arc(x + Math.cos(rot + k * 1.2566) * 5.2, y + Math.sin(rot + k * 1.2566) * 5.2, 2.8, 0, L.TAU); q.fill(); }
      q.fillStyle = L.rgba(centre, 0.92); q.beginPath(); q.arc(x, y, 2.1, 0, L.TAU); q.fill();
    }
  };
}
/** small scattered rings (团花 reduced to a circle and a dot) */
function rings(seed, col, x0, y0, x1, y1, n = 14) {
  return (q) => {
    const r = L.rng(seed);
    q.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      const x = r.range(x0, x1), y = r.range(y0, y1);
      q.strokeStyle = L.rgba(col, 0.8); q.beginPath(); q.arc(x, y, 7.5, 0, L.TAU); q.stroke();
      q.fillStyle = L.rgba(col, 0.9); q.beginPath(); q.arc(x, y, 2.4, 0, L.TAU); q.fill();
    }
  };
}
/** the short cross-collared jacket. N = base of the neck, P = hips */
function torso(g, N, P, st, o = {}) {
  const ax = nrm(sub(P, N)), q = [ax[1], -ax[0]], len = Math.hypot(P[0] - N[0], P[1] - N[1]), col = st.jacket;
  const at = (s, d) => [N[0] + ax[0] * s + q[0] * d, N[1] + ax[1] * s + q[1] * d];   // s down the spine, d toward the child's front
  const poly = cr([at(-6, -24), at(14, -50), at(len * 0.5, -55), at(len + 16, -71), at(len + 31, -36), at(len + 36, 4), at(len + 28, 46), at(len + 12, 68), at(len * 0.56, 61), at(18, 47), at(-6, 22)], true, 5);
  const folds = [
    [at(48, 12), at(len * 0.62, 21), at(len + 30, 27)],
    [at(len * 0.5, -51), at(len * 0.78, -33), at(len + 24, -43)],
    [at(len * 0.66, 58), at(len * 0.84, 42), at(len + 22, 50)],
  ];
  piece(g, poly, {
    base: col.base, deep: col.deep, inkColor: col.line, folds, pattern: o.pattern,
    light: [cr([at(30, 30), at(len * 0.55, 44), at(len + 2, 40)], false, 6), cr([at(34, -30), at(len * 0.72, -26), at(len + 6, -14)], false, 6)], lightCol: col.light,
  });
  if (o.sash) {
    const t = tube([at(len * 0.66, -58), at(len * 0.73, 2), at(len * 0.66, 63)], [13, 15, 13]);
    piece(g, t.poly, { base: o.sash.base, deep: o.sash.deep, ew: 0.3, outline: false });
    ink(g, t.left, 1.9, { taper: [0.03, 0.03], color: o.sash.line }); ink(g, t.right, 1.9, { taper: [0.03, 0.03], color: o.sash.line });
  }
  // crossed lapels in the trim colour
  for (const cpts of [[at(-8, 22), at(18, 20), at(46, 6)], [at(-8, -24), at(20, -16), at(48, 5), at(72, 30)]]) {
    const t = tube(cpts, cpts.map(() => 12.5));
    piece(g, t.poly, { base: st.trim.base, deep: st.trim.deep, ew: 0.3, outline: false });
    ink(g, t.left, 1.8, { taper: [0.03, 0.03], color: st.trim.line }); ink(g, t.right, 1.8, { taper: [0.03, 0.03], color: st.trim.line });
  }
}
/** big round head on a 100-unit grid, three-quarter view facing +x */
function head(g, c, r, o = {}) {
  const { tilt = 0, hair = 'peach', ribbon = C.rouge } = o;
  g.save(); g.translate(c[0], c[1]); g.rotate(tilt); g.scale(r / 100, r / 100);
  const HC = { base: C.hair, deep: '#0c0a08' };
  const tuft = (pts, wisps = []) => {
    piece(g, cr(pts, true, 4), { base: HC.base, deep: HC.deep, ew: 0.5, lw: 2.2 });
    for (const w of wisps) ink(g, w, 2.4, { taper: [0.02, 0.85], alpha: 0.88 });
  };
  const bun = (bx, by, br, side) => {
    // the tie: two short ribbon ends flying outward, a red band at the root
    ink(g, [[bx + side * br * 0.4, by + br * 0.72], [bx + side * br * 1.1, by + br * 0.5], [bx + side * br * 1.55, by + br * 0.78]], 7.5, { color: ribbon, taper: [0.05, 0.45], alpha: 0.95, wobble: 0.15 });
    ink(g, [[bx + side * br * 0.4, by + br * 0.84], [bx + side * br * 1.0, by + br * 1.05], [bx + side * br * 1.25, by + br * 1.5]], 6.5, { color: ribbon, taper: [0.05, 0.45], alpha: 0.95, wobble: 0.15 });
    tuft(ell(bx, by, br, br * 0.9, 10));
    g.strokeStyle = 'rgba(214,204,190,0.5)'; g.lineWidth = 2.6; g.lineCap = 'round';
    g.beginPath(); g.arc(bx, by, br * 0.58, Math.PI * 1.08, Math.PI * 1.55); g.stroke();
    g.fillStyle = ribbon; g.beginPath(); g.ellipse(bx, by + br * 0.84, br * 0.62, br * 0.25, 0, 0, L.TAU); g.fill();
  };
  if (hair === 'buns') bun(50, -105, 23, 1);
  const skull = cr([[0, -100], [46, -93], [80, -65], [96, -24], [95, 8], [100, 34], [93, 60], [72, 84], [42, 97], [8, 97], [-32, 87], [-66, 63], [-89, 27], [-97, -14], [-87, -54], [-55, -86]], true, 5);
  piece(g, skull, {
    base: C.flesh, deep: C.fleshD, edge: 0.7, lw: 3, inkColor: C.sepia,
    light: [cr([[-30, -60], [10, -70], [40, -55]], false, 6)], lightCol: '#ffffff',
    pattern: (q) => {
      for (const [bx, by, br, al] of [[18, 42, 38, 0.8], [86, 38, 22, 0.62]]) {
        q.fillStyle = L.radial(q, bx, by, 0, br, [[0, L.rgba('#ea8090', al)], [0.45, L.rgba('#ee96a0', al * 0.6)], [1, L.rgba('#f1aab0', 0)]]);
        q.fillRect(bx - br, by - br, br * 2, br * 2);
      }
    },
  });
  // ear
  piece(g, cr([[-52, -2], [-68, 0], [-77, 16], [-73, 36], [-60, 44], [-50, 32], [-47, 12]], true, 3), { base: C.flesh, deep: C.fleshD, ew: 0.35, lw: 2.6, inkColor: C.sepia });
  ink(g, [[-67, 10], [-61, 20], [-63, 33]], 1.9, { color: C.sepia });
  // brows: thin, high
  ink(g, [[2, -25], [20, -34], [44, -29]], 3, { taper: [0.15, 0.5], alpha: 0.85 });
  ink(g, [[62, -31], [76, -36], [90, -30]], 2.6, { taper: [0.2, 0.4], alpha: 0.85 });
  // eyes: a long slender upper lid, a small dark pupil tucked under it, a whisper of lower lid
  ink(g, [[3, -1], [15, -9], [30, -9.5], [45, -2]], 3.6, { taper: [0.2, 0.3], wobble: 0.15 });
  ink(g, [[61, -5], [71, -11], [82, -10.5], [91, -4]], 3.2, { taper: [0.2, 0.3], wobble: 0.15 });
  ink(g, [[11, 3.5], [25, 6.5], [39, 3]], 1.4, { color: C.sepia, alpha: 0.5, taper: [0.2, 0.2] });
  ink(g, [[66, 1], [77, 3.5], [87, 0.5]], 1.3, { color: C.sepia, alpha: 0.5, taper: [0.2, 0.2] });
  g.fillStyle = '#1c1714';
  g.beginPath(); g.ellipse(26, -3.6, 4.7, 4.4, 0, 0, L.TAU); g.fill();
  g.beginPath(); g.ellipse(76.5, -5.4, 4.1, 3.9, 0, 0, L.TAU); g.fill();
  // nose, mouth, the fold of a plump chin
  ink(g, [[58, 3], [64, 17], [55, 21]], 2.3, { color: C.sepia, taper: [0.2, 0.3] });
  g.fillStyle = L.rgba(C.rouge, 0.95);
  g.beginPath(); g.ellipse(54, 43.5, 8.4, 4, 0, 0, L.TAU); g.fill();
  g.beginPath(); g.ellipse(54, 48.5, 5.6, 3.4, 0, 0, L.TAU); g.fill();
  ink(g, [[42, 42.5], [54, 46.5], [66, 42]], 2, { taper: [0.2, 0.2] });
  ink(g, [[34, 70], [51, 77], [68, 69]], 1.5, { color: C.sepia, alpha: 0.5, taper: [0.2, 0.2] });
  // the tufts left on a shaved head
  if (hair === 'peach') {
    tuft([[10, -102], [48, -98], [74, -80], [80, -58], [66, -46], [50, -56], [36, -48], [20, -58], [6, -72], [0, -90]], [[[68, -48], [70, -38], [68, -30]], [[36, -50], [35, -40], [38, -33]], [[52, -56], [53, -46], [51, -40]], [[22, -58], [20, -50], [22, -44]]]);
    tuft([[-90, -40], [-66, -58], [-44, -46], [-42, -20], [-56, -4], [-72, 0], [-88, -14]], [[[-52, -8], [-50, 2], [-52, 8]], [[-66, -2], [-66, 8], [-63, 14]], [[-80, -8], [-81, 0], [-78, 6]]]);
  } else if (hair === 'buns') {
    bun(-50, -97, 27, -1);
    tuft([[26, -100], [52, -95], [68, -80], [66, -62], [50, -62], [36, -72], [22, -88]], [[[56, -63], [57, -54], [55, -48]], [[40, -70], [40, -61], [42, -55]]]);
  } else if (hair === 'topknot') {
    tuft([[-16, -95], [-14, -116], [-32, -140], [-26, -160], [-6, -150], [9, -162], [22, -142], [8, -116], [8, -95]]);
    g.fillStyle = ribbon; g.beginPath(); g.ellipse(-3, -113, 15, 6.5, 0, 0, L.TAU); g.fill();
    ink(g, [[-16, -113], [-36, -108], [-48, -92]], 6, { color: ribbon, taper: [0.05, 0.5], alpha: 0.95 });
    tuft([[26, -100], [52, -95], [70, -78], [72, -58], [56, -52], [44, -62], [30, -58], [18, -78]], [[[60, -54], [62, -44], [60, -38]], [[36, -60], [36, -50], [38, -44]], [[47, -60], [48, -51], [46, -45]]]);
    tuft([[-88, -38], [-68, -54], [-48, -44], [-46, -22], [-60, -8], [-80, -12]], [[[-56, -10], [-54, -1], [-56, 5]], [[-72, -10], [-72, -2], [-69, 4]]]);
  }
  g.restore();
}
/**
 * Assemble a child from joints (all in the child's own frame: feet at y = 0, up is −y, facing +x).
 * J: N, P, H, tilt, far/near arm [shoulder, elbow, wrist], far/near leg [hip, knee, ankle, shoeAngle]
 * pr: back / mid / preArm / front callbacks for the things they carry
 */
function kid(g, J, st, pr = {}) {
  if (pr.back) pr.back(g);
  arm(g, J.armFar[0], J.armFar[1], J.armFar[2], st.jacket, st.trim);
  leg(g, J.legFar[0], J.legFar[1], J.legFar[2], st.pants, st.shoe, J.legFar[3]);
  if (pr.mid) pr.mid(g);
  leg(g, J.legNear[0], J.legNear[1], J.legNear[2], st.pants, st.shoe, J.legNear[3]);
  torso(g, J.N, J.P, st, { pattern: st.pattern, sash: st.sash });
  head(g, J.H, J.r || 61, { tilt: J.tilt || 0, hair: st.hair, ribbon: st.ribbon });
  if (pr.preArm) pr.preArm(g);
  arm(g, J.armNear[0], J.armNear[1], J.armNear[2], st.jacket, st.trim);
  if (pr.front) pr.front(g);
}
/** stand a child on the slope at screen x0; returns local → frame coordinate mapper */
function place(g, env, x0, k, flip, fn) {
  const a = env.arc, th = a.thetaAtX(x0), p = a.pt(th, -9), tl = th * 0.5;
  g.save(); g.translate(p.x, p.y); g.rotate(tl); g.scale(k * flip, k);
  fn(g); g.restore();
  const c = Math.cos(tl), s = Math.sin(tl);
  return (lx, ly) => { const X = lx * k * flip, Y = ly * k; return [p.x + X * c - Y * s, p.y + X * s + Y * c]; };
}

// ───────────────────────── playthings ─────────────────────────
function ribbonTail(g, pts, widths, col) {
  const t = tube(pts, widths, 5);
  piece(g, t.poly, { base: col.base, deep: col.deep, ew: 0.35, outline: false });
  ink(g, t.left, 1.7, { taper: [0.02, 0.2], color: col.line }); ink(g, t.right, 1.7, { taper: [0.02, 0.2], color: col.line });
}
function kite(g, cx, cy, ang, sc) {
  g.save(); g.translate(cx, cy); g.rotate(ang); g.scale(sc, sc);
  ribbonTail(g, [[-4, 84], [-26, 130], [2, 178], [-24, 230], [-4, 286], [-22, 330]], [10, 11, 10, 9, 7, 2], ST.pink);
  ribbonTail(g, [[5, 84], [28, 124], [4, 164], [30, 208], [12, 254], [26, 292]], [10, 11, 10, 9, 7, 2], ST.green);
  const top = [0, -98], rt = [66, -16], bt = [0, 90], lf = [-66, -16];
  piece(g, dense([top, rt, bt, lf]), {
    base: ST.yellow.base, deep: ST.yellow.deep, lw: 2.4, inkColor: ST.ochre.line,
    pattern: (q) => {
      // rose upper panel, yellow lower panel, a green roundel where the sticks cross
      q.fillStyle = L.linear(q, 0, -98, 0, -10, [[0, ST.rouge.base], [0.6, ST.pink.base], [1, '#fbe0df']]);
      q.beginPath(); q.moveTo(top[0], top[1]); q.lineTo(rt[0], rt[1]); q.lineTo(lf[0], lf[1]); q.closePath(); q.fill();
      q.fillStyle = L.linear(q, 0, -16, 0, 90, [[0, ST.yellow.light], [1, ST.yellow.base]]);
      q.beginPath(); q.moveTo(bt[0], bt[1]); q.lineTo(rt[0], rt[1]); q.lineTo(lf[0], lf[1]); q.closePath(); q.fill();
      q.fillStyle = L.rgba(ST.green.base, 0.95); q.beginPath(); q.arc(0, -16, 17, 0, L.TAU); q.fill();
      q.fillStyle = L.rgba(ST.yellow.light, 0.95); q.beginPath(); q.arc(0, -16, 8, 0, L.TAU); q.fill();
      q.strokeStyle = L.rgba(ST.green.deep, 0.7); q.lineWidth = 2; q.beginPath(); q.arc(0, -16, 17, 0, L.TAU); q.stroke();
    },
  });
  ink(g, [top, bt], 1.8, { taper: [0.02, 0.02], alpha: 0.75, color: ST.ochre.line }); ink(g, [lf, rt], 1.8, { taper: [0.02, 0.02], alpha: 0.75, color: ST.ochre.line });
  g.restore();
}
function butterfly(g, x, y, ang, sc) {
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(sc, sc);
  const wing = (m, sq) => {
    g.save(); g.scale(m * sq, 1);
    piece(g, cr([[4, 4], [34, 8], [46, 26], [34, 44], [14, 34]], true, 3), { base: ST.yellow.base, deep: ST.yellow.deep, ew: 0.45, lw: 1.9, inkColor: ST.ochre.line });
    piece(g, cr([[3, -6], [20, -36], [50, -50], [64, -30], [50, -6], [14, 4]], true, 3), {
      base: ST.pink.light, deep: ST.rouge.deep, ew: 0.75, edge: 1.6, lw: 2, inkColor: ST.rouge.line,
      pattern: (q) => { q.fillStyle = L.rgba(ST.rouge.deep, 0.75); q.beginPath(); q.arc(46, -30, 6, 0, L.TAU); q.fill(); q.fillStyle = '#fffaf0'; q.beginPath(); q.arc(46, -30, 2.6, 0, L.TAU); q.fill(); },
    });
    ink(g, [[6, -4], [26, -22], [46, -42]], 1.3, { alpha: 0.55, color: ST.rouge.line }); ink(g, [[8, -2], [32, -12], [56, -24]], 1.3, { alpha: 0.55, color: ST.rouge.line });
    g.restore();
  };
  wing(-1, 0.72); wing(1, 1);
  ink(g, [[0, -16], [1, 0], [0, 26]], 6, { taper: [0.2, 0.4], alpha: 0.95 });
  ink(g, [[-1, -14], [-10, -34], [-20, -42]], 1.4, { taper: [0.02, 0.2] }); ink(g, [[2, -14], [10, -36], [22, -42]], 1.4, { taper: [0.02, 0.2] });
  g.restore();
}
function lantern(g, x, y) {
  ink(g, [[x, y], [x + 1, y + 22]], 1.6, { taper: [0.02, 0.02] });
  const cy = y + 78;
  for (let i = -2; i <= 2; i++) ink(g, [[x + i * 2.5, cy + 56], [x + i * 5 + (i & 1) * 2, cy + 88], [x + i * 6.5 - 3, cy + 122]], 3, { color: ST.yellow.deep, taper: [0.02, 0.5], alpha: 0.95 });
  piece(g, cr(ell(x, cy + 60, 8, 7, 8), true, 3), { base: ST.rouge.base, deep: ST.rouge.deep, ew: 0.3, lw: 1.7, inkColor: ST.rouge.line });
  piece(g, cr(ell(x, cy, 46, 50, 14), true, 4), {
    base: L.radial(g, x - 14, cy - 16, 2, 72, [[0, '#fff0ec'], [0.4, '#f29aa9'], [1, '#d24468']]), deep: '#a82848', edge: 1.1, lw: 2.4, inkColor: ST.rouge.line,
    pattern: (q) => {
      q.strokeStyle = L.rgba('#a82848', 0.5); q.lineWidth = 1.8;
      for (const k of [-0.72, -0.37, 0, 0.37, 0.72]) { q.beginPath(); q.moveTo(x + k * 14, cy - 50); q.quadraticCurveTo(x + k * 80, cy, x + k * 14, cy + 50); q.stroke(); }
    },
  });
  for (const s of [-1, 1]) {
    const yy = cy + s * 49;
    piece(g, dense([[x - 19, yy - 6], [x + 19, yy - 6], [x + 21, yy + 6], [x - 21, yy + 6]]), { base: ST.ochre.base, deep: ST.ochre.deep, ew: 0.3, lw: 2, inkColor: ST.ochre.line });
  }
}
function fan(g, hx, hy, cx, cy, r) {
  const d = nrm([cx - hx, cy - hy]);
  const t = tube([[hx - d[0] * 18, hy - d[1] * 18], [hx, hy], [cx - d[0] * (r - 4), cy - d[1] * (r - 4)]], [8, 7, 6]);
  piece(g, t.poly, { base: ST.ochre.base, deep: ST.ochre.deep, ew: 0.3, lw: 1.9, inkColor: ST.ochre.line });
  piece(g, cr(ell(cx, cy, r, r * 0.97, 16), true, 4), {
    base: '#fef9ee', deep: '#e7b0a2', edge: 1, lw: 2.4, inkColor: ST.pink.line,
    pattern: (q) => {
      q.strokeStyle = L.rgba(ST.green.deep, 0.8); q.lineWidth = 2.2; q.lineCap = 'round';
      q.beginPath(); q.moveTo(cx - 20, cy + 18); q.quadraticCurveTo(cx - 2, cy + 2, cx + 14, cy - 16); q.stroke();
      for (const [px, py, pr] of [[cx + 12, cy - 16, 8], [cx - 6, cy + 2, 6.5], [cx + 22, cy - 2, 5.5]]) {
        q.fillStyle = L.radial(q, px, py, 0, pr, [[0, ST.rouge.deep], [0.6, ST.pink.base], [1, L.rgba(ST.pink.base, 0.6)]]);
        q.beginPath(); q.arc(px, py, pr, 0, L.TAU); q.fill();
      }
    },
  });
  ink(g, cr(ell(cx, cy, r - 7, r * 0.97 - 7, 16), true, 4), 1.2, { alpha: 0.45, taper: [0.02, 0.02], color: ST.pink.line });
}
function leaf(g, bx, by, ang, len, wid, col) {
  g.save(); g.translate(bx, by); g.rotate(ang);
  piece(g, cr([[0, 0], [len * 0.3, -wid * 0.5], [len * 0.7, -wid * 0.36], [len, 0], [len * 0.7, wid * 0.36], [len * 0.3, wid * 0.5]], true, 3), { base: col.base, deep: col.deep, ew: 0.4, lw: 1.7, inkColor: col.line });
  ink(g, [[2, 0], [len * 0.5, 0], [len * 0.94, 0]], 1.2, { alpha: 0.7, color: col.line });
  g.restore();
}

// ───────────────────────── the four children ─────────────────────────
function kidKite(g) {
  const st = { jacket: ST.yellow, trim: ST.green, pants: ST.pink, shoe: ST.black, hair: 'topknot', ribbon: C.rouge, sash: ST.green, pattern: rings('s14r1', ST.yellow.deep, -90, -330, 90, -120, 15) };
  kid(g, {
    N: [-14, -316], P: [-2, -172], H: [-14, -384], tilt: -0.3,
    armFar: [[-2, -298], [42, -262], [80, -266]], armNear: [[-8, -300], [40, -322], [84, -358]],
    legFar: [[-12, -172], [-34, -96], [-50, -22], 0], legNear: [[4, -172], [36, -98], [62, -22], 0],
  }, st, {
    back: () => {   // the reel in the lower hand
      const t = tube([[93, -300], [94, -272], [95, -238]], [15, 17, 15]);
      piece(g, t.poly, { base: ST.ochre.base, deep: ST.ochre.deep, ew: 0.35, lw: 2, inkColor: ST.ochre.line });
      for (const u of [0.3, 0.42, 0.54, 0.66]) { const i = Math.round(u * (t.c.length - 1)); ink(g, [t.left[i], t.right[i]], 1.2, { alpha: 0.7, taper: [0.02, 0.02] }); }
    },
  });
}
function kidHorse(g) {
  const st = { jacket: ST.pink, trim: ST.yellow, pants: ST.white, shoe: ST.black, hair: 'buns', ribbon: C.rouge, sash: ST.green, pattern: florets('s14fl', ST.rouge.deep, -80, -330, 110, -120, 20) };
  kid(g, {
    N: [12, -318], P: [-14, -176], H: [28, -384], tilt: 0.04,
    armFar: [[22, -300], [70, -264], [102, -232]], armNear: [[2, -302], [-44, -280], [-72, -244]],
    legFar: [[-6, -176], [46, -118], [58, -36], -0.15], legNear: [[-18, -176], [-32, -94], [-72, -32], 0.7],
  }, st, {
    mid: () => {   // 竹马: a bamboo pole between the legs, a few leaves left on its trailing end
      leaf(g, -196, -16, Math.PI + 0.75, 62, 17, ST.green); leaf(g, -204, -10, Math.PI + 0.25, 70, 18, ST.green); leaf(g, -200, -6, Math.PI - 0.2, 54, 15, ST.green);
      const t = tube([[-214, -4], [-52, -122], [150, -266]], [10, 12, 11]);
      piece(g, t.poly, { base: '#9fce84', deep: ST.green.deep, ew: 0.3, lw: 2, light: [t.c], lightCol: '#f3fae2', inkColor: ST.green.line });
      for (const u of [0.08, 0.22, 0.36, 0.5, 0.64, 0.78, 0.93]) { const i = Math.round(u * (t.c.length - 1)); ink(g, [t.left[i], t.right[i]], 2.2, { taper: [0.02, 0.02], color: ST.green.line }); }
    },
    front: () => {   // the switch he whips his horse with
      ink(g, [[-70, -236], [-98, -276], [-128, -304], [-164, -314]], 2.6, { color: C.sepia, taper: [0.02, 0.4], alpha: 0.95 });
      for (const [dx, dy] of [[-12, 26], [2, 34], [14, 24]]) ink(g, [[-164, -314], [-164 + dx * 0.5, -314 + dy * 0.5], [-164 + dx, -314 + dy]], 4.2, { color: ST.rouge.deep, taper: [0.05, 0.6], alpha: 0.9 });
    },
  });
}
function kidLantern(g) {
  const st = { jacket: ST.green, trim: ST.pink, pants: ST.yellow, shoe: ST.rouge, hair: 'peach', ribbon: C.rouge, sash: ST.pink, pattern: florets('s14f3', '#fbfff2', -90, -330, 100, -120, 16, ST.yellow.deep) };
  kid(g, {
    N: [4, -318], P: [-6, -174], H: [16, -385], tilt: 0.02,
    armFar: [[0, -300], [-36, -256], [-52, -212]], armNear: [[4, -302], [44, -268], [82, -284]],
    legFar: [[-12, -174], [-28, -98], [-56, -26], 0.22], legNear: [[0, -174], [30, -100], [36, -22], 0],
  }, st, {
    preArm: () => ink(g, [[56, -262], [94, -292], [138, -348], [176, -402]], 4, { color: C.sepia, taper: [0.02, 0.12], alpha: 0.95, wobble: 0.15 }),
    front: () => lantern(g, 176, -402),
  });
}
function kidButterfly(g) {
  const st = { jacket: ST.ochre, trim: ST.yellow, pants: ST.pink, shoe: ST.black, hair: 'buns', ribbon: C.rouge, sash: ST.blue, pattern: rings('s14r4', ST.yellow.light, -90, -330, 100, -120, 15) };
  kid(g, {
    N: [10, -322], P: [-12, -178], H: [26, -390], tilt: -0.2,
    armFar: [[14, -304], [-34, -272], [-64, -236]], armNear: [[6, -304], [72, -298], [126, -332]],
    legFar: [[-4, -178], [38, -112], [48, -32], 0.2], legNear: [[-16, -178], [-34, -98], [-76, -40], 0.75],
  }, st, {
    preArm: () => fan(g, 136, -340, 174, -386, 42),
  });
}

// ───────────────────────── the green slope ─────────────────────────
const GCOLS = ['#263a26', '#2d4a2e', '#2b2620', '#33603a'];
function grassClump(g, a, r, th, dr, sc, col) {
  a.at(g, th, dr, () => {
    const nb = r.int(4, 7);
    for (let b = 0; b < nb; b++) {
      const lean = L.lerp(-0.95, 0.95, (b + r.range(-0.3, 0.3)) / (nb - 1)), len = sc * r.range(20, 42) * (1 - 0.3 * Math.abs(lean)), bx = r.range(-5, 5) * sc;
      L.inkStroke(g, [[bx, 2], [bx + Math.sin(lean * 0.4) * len * 0.55, -Math.cos(lean * 0.4) * len * 0.55], [bx + Math.sin(lean) * len, -Math.cos(lean) * len]],
        { width: sc * r.range(2.8, 4.2), color: col, seed: 's14g' + (SEED++), taper: [0.02, 0.8], wobble: 0.2, alpha: 0.9 });
    }
  });
}
function slope(g, env) {
  const a = env.arc, sp = a.span(PAD + 180), nz = L.makeNoise('s14slope'), r = L.rng('s14grass');
  const N = 260, lowPts = [];
  for (let i = 0; i <= N; i++) {
    const th = L.lerp(sp, -sp, i / N), u = th * a.R;
    const p = a.pt(th, -(116 + 20 * nz.fbm(u / 420, 1.3, 3) + 5 * nz.n2(u / 90, 7.7)));
    lowPts.push([p.x, p.y]);
  }
  g.save();
  g.beginPath(); a.trace(g, 0, -sp, sp); for (const p of lowPts) g.lineTo(p[0], p[1]); g.closePath();
  g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 150, a.R, [[0, L.rgba('#cbe8b0', 0.88)], [0.35, L.rgba('#b3db98', 0.96)], [0.7, '#9fce86'], [0.92, '#90c57a'], [1, '#84bd6f']]);
  g.fill(); g.clip();
  // a second, deeper wash laid in drifting patches
  g.drawImage(L.polarNoiseLayer(env, PAD, { seed: 's14w2', scale: 190, sx: 3, sy: 0.8, octaves: 3, res: 0.25, contrast: 1.4,
    ramp: [[0, L.rgba('#5aa257', 0)], [0.5, L.rgba('#5aa257', 0)], [0.62, L.rgba('#5aa257', 0.16)], [1, L.rgba('#479049', 0.3)]] }), -PAD, -PAD);
  // enamel mottling
  g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.22;
  g.drawImage(L.polarNoiseLayer(env, PAD, { seed: 's14w3', scale: 22, sx: 2.6, sy: 1, octaves: 3, res: 0.4, contrast: 1.5 }), -PAD, -PAD);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  // pigment pooled along the lower rim of the wash, and under the crest line
  g.lineJoin = 'round';
  g.strokeStyle = L.rgba('#5aa257', 0.26); g.lineWidth = 9; trace(g, lowPts, false); g.stroke();
  g.strokeStyle = L.rgba('#479049', 0.36); g.lineWidth = 3; trace(g, lowPts, false); g.stroke();
  g.strokeStyle = L.rgba('#479049', 0.16); g.lineWidth = 34; a.stroke(g, -6, -sp, sp);
  g.strokeStyle = L.rgba('#479049', 0.18); g.lineWidth = 14; a.stroke(g, -4, -sp, sp);
  g.restore();

  // the ink contour ON the arc: its upper edge is fixed, the brush swells downward
  const M = 640, up = [], dn = [];
  for (let i = 0; i <= M; i++) {
    const th = L.lerp(-sp, sp, i / M), u = th * a.R;
    const w = Math.max(1.6, 3.8 + 1.9 * nz.n2(u / 95, 3.1) + 1.0 * nz.n2(u / 24, 8.8));
    const p0 = a.pt(th, 1.3), p1 = a.pt(th, 1.3 - w);
    up.push([p0.x, p0.y]); dn.push([p1.x, p1.y]);
  }
  g.fillStyle = L.rgba('#27301f', 0.9); trace(g, up.concat(dn.reverse()), true); g.fill();
  // the doubled line under it: finer, broken where the brush ran dry
  for (let i = 0; i < 22; i++) {
    const t0 = L.lerp(-sp, sp, (i + r.range(0.0, 0.3)) / 22), ln = (2 * sp / 22) * r.range(0.55, 0.92), dr = -r.range(10.5, 13.5);
    ink(g, L.arcPts(a, dr, t0, t0 + ln, 16), r.range(1.6, 2.3), { color: '#2a4428', alpha: 0.62, taper: [0.08, 0.3] });
  }
  // grass: clumps of springy blades, gathered in loose drifts rather than evenly sown
  const clump = (th, dr, sc, col) => grassClump(g, a, r, th, dr, sc, col);
  const gs = a.span(PAD + 120), steps = Math.ceil((2 * gs * a.R) / 66);
  for (let i = 0; i <= steps; i++) {
    const th = L.lerp(-gs, gs, (i + r.range(-0.4, 0.4)) / steps), u = th * a.R, row = r();
    const drift = nz.n2(u / 210, 21.7);                                                     // −1 … 1: where the grass grows thick
    if (drift < -0.25 && row > 0.3) continue;
    if (row < 0.14) clump(th, -r.range(7, 12), r.range(0.55, 0.75), r.pick(GCOLS));          // a few tufts breaking the crest
    else clump(th, -r.range(32, 92), r.range(0.85, 1.25) * (1 + 0.3 * Math.max(0, drift)), r.pick(GCOLS));
    if (drift > 0.1 && r.chance(0.6)) clump(th + r.range(0.006, 0.02), -r.range(46, 100), r.range(0.6, 0.95), r.pick(GCOLS));
  }
  // moss dots (苔点) clustered on the contour and down the slope
  const msteps = Math.ceil((2 * gs * a.R) / 130);
  for (let i = 0; i <= msteps; i++) {
    const th = L.lerp(-gs, gs, (i + r.range(-0.4, 0.4)) / msteps), dr = r.chance(0.6) ? -r.range(18, 26) : -r.range(44, 96);
    a.at(g, th, dr, () => {
      const n = r.int(3, 6);
      for (let k = 0; k < n; k++) {
        const rx = r.range(3.8, 7);
        g.fillStyle = L.rgba(r.pick(['#24361f', '#2b2620', '#2f5230']), r.range(0.7, 0.92));
        g.beginPath(); g.ellipse(r.range(-20, 20), r.range(-3, 9), rx, rx * r.range(0.5, 0.7), r.range(-0.3, 0.3), 0, L.TAU); g.fill();
      }
    });
  }
}

// ───────────────────────── layers ─────────────────────────
function buildPaint(env) {
  const K = 1.22;
  const paint = L.makeLayer(PAD, (g) => {
    slope(g, env);
    const kp = [452, 102];
    kite(g, kp[0], kp[1], 0.42, 0.86);
    const w1 = place(g, env, 255, K, 1, kidKite);
    // kite line: reel → raised hand → bridle
    const h0 = w1(94, -296), h1 = w1(93, -370);
    ink(g, [h0, mixP(h0, h1, 0.5), h1], 1.5, { taper: [0.02, 0.02], alpha: 0.8, wobble: 0.1 });
    const mid = mixP(h1, kp, 0.5);
    ink(g, [h1, [mid[0] + 4, mid[1] + 9], [kp[0] - 6, kp[1] - 10]], 1.5, { taper: [0.02, 0.02], alpha: 0.8, wobble: 0.1 });
    place(g, env, 725, K, 1, kidHorse);
    place(g, env, 1140, K, 1, kidLantern);
    const w4 = place(g, env, 1492, K, 1, kidButterfly);
    const b = w4(196, -488); butterfly(g, b[0], b[1], 0.45, 0.96);
    // a few blades in front of the feet so the children stand IN the grass
    const a = env.arc, rg = L.rng('s14feet');
    for (const fx of [196, 330, 668, 792, 1090, 1196, 1418, 1560]) grassClump(g, a, rg, a.thetaAtX(fx + rg.range(-14, 14)), -rg.range(20, 27), rg.range(0.55, 0.75), rg.pick(GCOLS));
  });
  // the enamel itself: uneven pooling, a fine tooth, then the slight relief of colour standing proud of the glaze
  L.overlayOn(paint, L.noiseLayer(PAD, { seed: 's14en', scale: 80, octaves: 3, contrast: 1.4, res: 0.25 }), { blend: 'soft-light', alpha: 0.16 });
  L.overlayOn(paint, L.noiseLayer(PAD, { seed: 's14en2', scale: 9, octaves: 2, contrast: 1.5, res: 0.5 }), { blend: 'soft-light', alpha: 0.14 });
  const relief = L.bumpLight(paint, { angle: 45, strength: 1.0, blur: 1.2, res: 0.75 });
  L.overlayOn(paint, relief, { blend: 'overlay', alpha: 0.36 });
  return paint;
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
    for (let i = 0; i < 80; i++) {
      const x = r.range(-PAD, W + PAD), y = r.range(-PAD, H + PAD), rad = r.range(0.8, 2.0) * (r.chance(0.12) ? 1.7 : 1);
      g.fillStyle = L.rgba('#fffdf6', 0.85); g.beginPath(); g.arc(x + rad * 0.55, y + rad * 0.6, rad * 1.05, 0, L.TAU); g.fill();
      g.fillStyle = L.rgba(r.chance(0.25) ? '#3a2a1c' : '#8a6238', r.range(0.45, 0.8)); g.beginPath(); g.arc(x, y, rad, 0, L.TAU); g.fill();
    }
    // hairline wear
    g.lineCap = 'round';
    for (let i = 0; i < 40; i++) {
      const x = r.range(-PAD, W + PAD), y = r.range(-PAD, H + PAD), ang = r.range(-0.5, 0.5) + (r.chance(0.2) ? 1.2 : 0), len = r.range(50, 240), al = r.range(0.04, 0.1);
      const x1 = x + Math.cos(ang) * len, y1 = y + Math.sin(ang) * len;
      g.lineWidth = r.range(0.6, 1.1);
      g.strokeStyle = L.rgba('#7a5c3a', al); g.beginPath(); g.moveTo(x, y); g.lineTo(x1, y1); g.stroke();
      g.strokeStyle = L.rgba('#ffffff', al * 2.4); g.beginPath(); g.moveTo(x, y + 1); g.lineTo(x1, y1 + 1); g.stroke();
    }
    // colour breathing into the glaze round the enamel, then the enamel with a hair of shadow under its lower-right rim
    g.globalAlpha = 0.16; g.drawImage(L.blurred(paint, 10), -PAD, -PAD); g.globalAlpha = 1;
    g.shadowColor = 'rgba(110,72,36,0.3)'; g.shadowBlur = 2.4; g.shadowOffsetX = 1.2; g.shadowOffsetY = 1.6;
    g.drawImage(paint, -PAD, -PAD);
    g.shadowColor = 'rgba(0,0,0,0)'; g.shadowBlur = 0; g.shadowOffsetX = 0; g.shadowOffsetY = 0;
  });
  // macro lens: focus sits on the crest, the wall goes a touch soft toward the frame's ends
  const soft = L.blurred(surf, 2.6), sg = soft.getContext('2d');
  sg.globalCompositeOperation = 'destination-in';
  sg.fillStyle = L.radial(sg, 960 + PAD, 470 + PAD, 620, 1250, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]);
  sg.fillRect(0, 0, soft.width, soft.height);
  surf.getContext('2d').drawImage(soft, -PAD, -PAD);
  return surf;
}
/** reflections on the glaze (half-res, padded): a window lying across the bare wall below the slope, and a second, upright one above the crest */
function buildGloss(env) {
  const a = env.arc, res = 0.5, GW = Math.round((W + PAD * 2) * res), GH = Math.round((H + PAD * 2) * res);
  const img = new ImageData(GW, GH), d = img.data, nz = L.makeNoise('s14gloss');
  const ss = (e0, e1, v) => { const t = L.clamp((v - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
  for (let j = 0; j < GH; j++) {
    const y = j / res - PAD;
    for (let i = 0; i < GW; i++) {
      const x = i / res - PAD, ddx = x - a.cx, ddy = a.cy - y, rr = Math.sqrt(ddx * ddx + ddy * ddy), dr = rr - a.R;
      let v = 0;
      if (dr < -150) {
        const u = Math.atan2(ddx, ddy) * a.R;
        const wob = 2.2 * nz.n2(u / 70, dr / 70) + 0.9 * nz.n2(u / 22 + 9, dr / 22);     // the glaze's orange-peel just ruffles the reflection's edge
        const d1 = Math.abs(dr + 302 + wob);
        const core = 1 - ss(27, 41, d1), halo = Math.exp(-(d1 * d1) / (2 * 150 * 150));
        const along = Math.exp(-Math.pow((u + 120) / 880, 2));
        const gap = 1 - 0.88 * Math.exp(-Math.pow((u - 270) / 17, 2)) - 0.88 * Math.exp(-Math.pow((u + 500) / 17, 2));
        const sheen = 0.82 + 0.18 * Math.exp(-Math.pow((u + 180) / 300, 2));              // brightest left of centre, where the light comes from
        v = (0.9 * core * gap * sheen + 0.12 * halo) * along;
      } else if (y < 520 && x > 780 && x < 1190) {
        // upright window above the crest: four panes, bowed by the wall's curve, much fainter
        const bx = x - 986 - 0.0004 * (y - 180) * (y - 180) + 1.2 * nz.n2(x / 60, y / 60), by = y - 176 - 0.05 * (x - 986);
        const px = Math.max(1 - ss(14, 24, Math.abs(bx + 27)), 1 - ss(14, 24, Math.abs(bx - 27)));
        const py = Math.max(1 - ss(50, 62, Math.abs(by + 66)), 1 - ss(50, 62, Math.abs(by - 66)));
        const bloom = Math.exp(-(bx * bx) / (2 * 60 * 60) - (by * by) / (2 * 120 * 120));
        v = 0.5 * px * py * (0.75 + 0.25 * L.clamp(1 - by / 200)) + 0.1 * bloom;
      }
      if (v <= 0.003) continue;
      const k = (j * GW + i) * 4;
      d[k] = 250; d[k + 1] = 253; d[k + 2] = 255; d[k + 3] = L.clamp(v) * 255;
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
    const paint = buildPaint(env);
    S = { surface: buildSurface(env, paint), gloss: buildGloss(env) };
  },
  draw(ctx, env, p) {
    // the painted wall turns slowly: children and slope slide along the arc
    const rot = L.lerp(-0.015, 0.015, p);
    L.blit(ctx, env, S.surface, { rot });
    // the light does not turn with it: the wall rolls away toward the bottom and the corners …
    ctx.save(); ctx.globalCompositeOperation = 'multiply';
    const a = env.arc;
    ctx.fillStyle = L.radial(ctx, 760, 260, 300, 1750, [[0, '#ffffff'], [0.55, '#fcf7ec'], [1, '#f2e6cd']]);
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = L.radial(ctx, a.cx, a.cy, a.R - 660, a.R - 345, [[0, '#e4d9c1'], [0.55, '#f4eddd'], [1, '#ffffff']]);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    // … and the windows' reflections lie still on the glaze
    L.cam(ctx, env, { rot: -rot * 0.4 }, () => ctx.drawImage(S.gloss, -PAD, -PAD, W + PAD * 2, H + PAD * 2));
  },
};
