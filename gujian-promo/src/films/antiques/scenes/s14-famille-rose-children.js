// s14 — 粉彩婴戏图. Macro of the glazed wall of a famille-rose (粉彩) vessel: the arc is the upper edge of a painted
// green bank; behind it two children at play, drawn the way a Qing enameller drew them — one astride a bamboo horse (竹马),
// one holding up a round lantern on a stick, the lantern hanging between them over the crest. Milk-white glaze all round,
// a window mirrored in the empty upper left, a long soft light lying across the bare wall under the bank.
//
// How it is painted (everything at full resolution, nothing is scaled up):
//  · every patch of enamel is a filled shape: a pale 玻璃白-bodied base, colour washed in from one side of each fold
//    (洗染: crisp at the fold, fading away from it), pooled a little inside the rim that faces away from the light,
//    faint drags of the brush, then its fine line (勾线: 1.3–2 px, set down with a touch of pressure, lifted to a point);
//  · alongside the colour a HEIGHT map is painted (how far each enamel stands proud of the glaze). It is lit once from the
//    upper left: a thin glint just inside the edges that face the light, a hair of shadow beyond the edges that do not;
//  · in draw() the painted wall turns about the arc's centre while the light (falloff + reflections) stays where it is.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 200;
let S = null;
let SEED = 0;
let G = null, HG = null;   // the colour / height contexts being painted on (both in frame coordinates)
let RX = 0, RY = 0;        // frame position of the region those contexts cover
let KS = 1, MIR = 1;       // scale and mirroring of the figure being painted (line weights and blurs are given in final pixels)

const C = { cream: '#f5efe0', ink: '#2b2620' };
// enamel families: lt = 玻璃白 showing through, base = the wash, mid / deep = colour gathered in folds and rims, line = its drawing colour
const F = {
  pink: { lt: '#fef0ec', base: '#f5c0c5', mid: '#e98fa2', deep: '#cf5677', line: '#8a2b46' },
  rouge: { lt: '#fde0dc', base: '#ec8497', mid: '#d5506f', deep: '#b22c50', line: '#741c36' },
  red: { lt: '#f9c4b4', base: '#d9553e', mid: '#c23c2b', deep: '#9a2518', line: '#6e1c12' },
  green: { lt: '#f0f8de', base: '#bfe0a6', mid: '#8cc27a', deep: '#559a56', line: '#2b5a33' },
  yellow: { lt: '#fffadf', base: '#f8e493', mid: '#eec95a', deep: '#d39c2e', line: '#7c5119' },
  blue: { lt: '#f0f8f9', base: '#b9d9e5', mid: '#86b7d0', deep: '#5289ad', line: '#2c4b66' },
  ochre: { lt: '#f6e0be', base: '#dba562', mid: '#bf7a3c', deep: '#96552a', line: '#5a3016' },
  flesh: { lt: '#fffdf8', base: '#fff6ec', mid: '#f6c4bb', deep: '#ec9494', line: '#9a4a36' },
  bamboo: { lt: '#f0f7d6', base: '#b6d892', mid: '#86b96d', deep: '#4f8d4c', line: '#2c5a30' },
  ink: { lt: '#77716c', base: '#2b2620', mid: '#1a1613', deep: '#0b0908', line: '#16120f' },
};

// ───────────────────────── small geometry helpers ─────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const nrm = (a) => { const m = Math.hypot(a[0], a[1]) || 1; return [a[0] / m, a[1] / m]; };
const mixP = (a, b, t) => [L.lerp(a[0], b[0], t), L.lerp(a[1], b[1], t)];
const xy = (p) => [p[0], p[1]];
const ss = (e0, e1, v) => { const t = L.clamp((v - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const zc = (z) => { const v = Math.round(L.clamp(z) * 255); return `rgb(${v},${v},${v})`; };

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
/** straight-edged polyline → dense points (corners stay sharp) */
function dense(pts, closed = true, step = 5) {
  const out = [], n = pts.length, segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = pts[i], b = pts[(i + 1) % n], m = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let j = 0; j < m; j++) out.push(mixP(a, b, j / m));
  }
  if (!closed) out.push(xy(pts[n - 1]));
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
function addLine(g, pts) { for (let i = 0; i < pts.length; i++) { if (i) g.lineTo(pts[i][0], pts[i][1]); else g.moveTo(pts[i][0], pts[i][1]); } }
function addPoly(g, pts) { addLine(g, pts); g.closePath(); }
function trace(g, pts, close) { g.beginPath(); addLine(g, pts); if (close) g.closePath(); }
/** run fn in a moved / turned frame on BOTH the colour and the height context */
function xf(x, y, ang, fn) {
  for (const c of [G, HG]) { c.save(); c.translate(x, y); if (ang) c.rotate(ang); }
  fn();
  for (const c of [G, HG]) c.restore();
}
/** the hand is not a ruler: push a polyline slowly off its true course */
const SHK = L.makeNoise('s14shake');
function shake(pts, amp, id) {
  let t = 0; const out = [];
  for (let i = 0; i < pts.length; i++) {
    if (i) t += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    out.push([pts[i][0] + amp * SHK.n2(t / 60, id * 7.31), pts[i][1] + amp * SHK.n2(t / 60 + 31.7, id * 3.17)]);
  }
  return out;
}
/** a limb / ribbon / stick: polygon of varying width round a smooth centre line */
function tube(center, widths, step = 4) {
  const c = cr(center, false, step), n = c.length, Lf = [], Rt = [];
  for (let i = 0; i < n; i++) {
    const a = c[Math.max(0, i - 1)], b = c[Math.min(n - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
    const u = Math.min(widths.length - 1 - 1e-6, c[i][2]), k = Math.floor(u), t = u - k;
    const hw = L.lerp(widths[k], widths[k + 1], L.smooth(t)) / 2;
    Lf.push([c[i][0] + nx * hw, c[i][1] + ny * hw]); Rt.push([c[i][0] - nx * hw, c[i][1] - ny * hw]);
  }
  return { poly: Lf.concat(Rt.slice().reverse()), left: Lf, right: Rt, c: c.map(xy) };
}
/** the band between two offsets on ONE side of a polyline, swelling from nothing and dying away again: the footprint of a graded wash */
function wedge(p, side, w0, w1) {
  const n = p.length, a = [], b = [];
  for (let i = 0; i < n; i++) {
    const q0 = p[Math.max(0, i - 1)], q1 = p[Math.min(n - 1, i + 1)];
    let nx = -(q1[1] - q0[1]), ny = q1[0] - q0[0]; const m = Math.hypot(nx, ny) || 1; nx = (nx / m) * side; ny = (ny / m) * side;
    const pr = Math.pow(Math.sin(Math.PI * L.clamp(0.05 + 0.9 * (i / (n - 1)))), 0.7), w = w0 + (w1 - w0) * pr;
    a.push([p[i][0] + nx * w0, p[i][1] + ny * w0]); b.push([p[i][0] + nx * w, p[i][1] + ny * w]);
  }
  return a.concat(b.reverse());
}
function bloomAt(g, x, y, r, col, al) {
  g.fillStyle = L.radial(g, x, y, 0, r, [[0, L.rgba(col, al)], [0.25, L.rgba(col, al * 0.86)], [0.5, L.rgba(col, al * 0.5)], [0.75, L.rgba(col, al * 0.15)], [1, L.rgba(col, 0)]]);
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

// ───────────────────────── the enameller's two tools: the line and the wash ─────────────────────────
/**
 * 勾线 — one fine brush line. px = its weight in final pixels. The brush is set down with a touch of pressure (起笔),
 * runs even, and is lifted to a point (收笔). o.spindle: fine at both ends, fullest in the middle (lids, brows).
 * o: alpha, head, tin / tout (px of set-down / lift-off), tail, shake, z (height it adds)
 */
function line(pts, px, color, o = {}) {
  const id = SEED++;
  let p = (pts.length > 2 ? cr(pts, false, 2.5) : dense(pts, false, 2.5)).map(xy);
  const amp = o.shake === undefined ? 0.45 : o.shake;
  if (amp) p = shake(p, amp, id);
  const n = p.length; if (n < 2) return;
  const s = new Array(n); s[0] = 0;
  for (let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  const len = s[n - 1] || 1, w0 = px / KS;
  const tin = Math.min(len * 0.3, (o.tin === undefined ? 6 : o.tin) / KS), tout = Math.min(len * 0.6, (o.tout === undefined ? 24 : o.tout) / KS);
  const head = o.head === undefined ? 1.3 : o.head, tail = o.tail === undefined ? Math.max(0.3, 0.95 / px) : o.tail;
  const Lf = [], Rt = [];
  for (let i = 0; i < n; i++) {
    const a = p[Math.max(0, i - 1)], b = p[Math.min(n - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
    const d0 = s[i], d1 = len - s[i];
    let wv = 1 + 0.09 * SHK.n2((s[i] * KS) / 34, id * 5.3);                      // the pressure breathes a little
    if (o.spindle) wv *= 0.42 + 0.58 * Math.pow(Math.sin(Math.PI * L.clamp(d0 / len)), 0.7);
    else {
      if (tin > 0 && d0 < tin * 2) wv *= L.lerp(head, 1, L.smooth(d0 / (tin * 2)));
      if (tout > 0 && d1 < tout) wv *= L.lerp(tail, 1, Math.pow(d1 / tout, 0.7));
    }
    const hw = (w0 * wv) / 2;
    Lf.push([p[i][0] + nx * hw, p[i][1] + ny * hw]); Rt.push([p[i][0] - nx * hw, p[i][1] - ny * hw]);
  }
  const g = G, ch = Math.hypot(p[n - 1][0] - p[0][0], p[n - 1][1] - p[0][1]);
  g.save(); g.globalAlpha *= o.alpha === undefined ? 0.9 : o.alpha;
  // the ink runs a little thinner toward the end of the pull
  g.fillStyle = ch > 8 / KS ? L.linear(g, p[0][0], p[0][1], p[n - 1][0], p[n - 1][1], [[0, color], [0.55, L.rgba(color, 0.92)], [1, L.rgba(color, 0.7)]]) : color;
  trace(g, Lf.concat(Rt.reverse()), true); g.fill();
  if (!o.spindle && head >= 1) { g.beginPath(); g.arc(p[0][0], p[0][1], (w0 * head) / 2, 0, L.TAU); g.fill(); }
  g.restore();
  if (o.z) { HG.save(); HG.strokeStyle = zc(o.z); HG.lineWidth = w0 * 1.2; HG.lineCap = 'round'; HG.lineJoin = 'round'; trace(HG, p, false); HG.stroke(); HG.restore(); }
}
/** an open contour drawn in several pulls of the brush; cuts = fractions along it where the brush was lifted */
function pulls(d, cuts, px, color, o = {}) {
  const n = d.length, idx = [0].concat(cuts.map((c) => Math.round(c * (n - 1))), [n - 1]);
  for (let k = 0; k < idx.length - 1; k++) {
    const seg = d.slice(Math.max(0, idx[k] - (k ? 2 : 0)), idx[k + 1] + 1);
    if (seg.length > 2) line(seg, px, color, o);
  }
}
/** a closed contour: two or three pulls that do not quite meet */
function outline(poly, px, color, o = {}) {
  const n = poly.length, r = L.rng('s14o' + (SEED++));
  const parts = o.parts || (n > 150 ? 3 : n > 50 ? 2 : 1), start = o.start === undefined ? r.int(0, n - 1) : Math.round(o.start * n);
  for (let k = 0; k < parts; k++) {
    const i0 = start + Math.round((n * k) / parts), i1 = start + Math.round((n * (k + 1)) / parts) - (parts > 1 ? 1 : -1), seg = [];
    for (let i = i0; i <= i1; i++) seg.push(poly[((i % n) + n) % n]);
    if (seg.length > 2) line(seg, px * r.range(0.95, 1.06), color, { tout: 16, ...o });
  }
}
/**
 * One patch of enamel. poly = dense closed outline (figure units), fam = colour family.
 * o.z      height above the glaze (0..1)
 * o.grad   0..1: 玻璃白 on the side toward the light, colour gathering on the side away from it
 * o.rim    0..1: colour pooled just inside the rim that faces away from the light
 * o.folds  [{p, side: ±1 (which side of the line the wash lies on, +1 = to the right of travel), w, line (px, 0 = none), la}]; o.fw wash width px, o.fa alpha
 * o.hi     [[pts]…] 玻璃白 left showing; o.hw width px, o.ha alpha
 * o.drag   0..1 faint drags of the brush; o.dir their direction
 * o.pattern(g) drawn clipped; o.outline px (0 = none); o.mis colour-to-line misregistration px
 */
function patch(poly, fam, o = {}) {
  const g = G, id = SEED++, u = 1 / KS, z = o.z === undefined ? 0.5 : o.z;
  const [x0, y0, x1, y1] = bbox(poly), bw = x1 - x0, bh = y1 - y0;
  const r = L.rng('s14p' + id), mis = o.mis === undefined ? 0.7 : o.mis;
  g.save();
  g.translate(r.range(-1, 1) * mis * u, r.range(-1, 1) * mis * u);            // colour never sits exactly inside its line
  trace(g, poly, true); g.fillStyle = o.fill || fam.base; g.fill(); g.clip();
  g.lineJoin = 'round'; g.lineCap = 'round';
  const gr = o.grad === undefined ? 1 : o.grad;
  if (gr) {
    const ax = MIR > 0 ? x0 : x1, bx = MIR > 0 ? x1 : x0;
    g.fillStyle = L.linear(g, ax, y0, bx, y1, [[0, L.rgba(fam.lt, 0.82 * gr)], [0.3, L.rgba(fam.lt, 0.4 * gr)], [0.62, L.rgba(fam.lt, 0)]]);
    g.fillRect(x0 - 2, y0 - 2, bw + 4, bh + 4);
    g.fillStyle = L.linear(g, ax, y0, bx, y1, [[0.4, L.rgba(fam.mid, 0)], [0.8, L.rgba(fam.mid, 0.3 * gr)], [1, L.rgba(fam.mid, 0.5 * gr)]]);
    g.fillRect(x0 - 2, y0 - 2, bw + 4, bh + 4);
  }
  const rim = o.rim === undefined ? 1 : o.rim;
  if (rim) {
    g.save(); g.translate(-5 * u * MIR, -6 * u);
    g.filter = 'blur(4.5px)'; g.strokeStyle = L.rgba(fam.mid, 0.6 * rim); g.lineWidth = 14 * u; trace(g, poly, true); g.stroke();
    g.restore();
    g.filter = 'blur(1.2px)'; g.strokeStyle = L.rgba(fam.deep, 0.2 * rim); g.lineWidth = 4 * u; trace(g, poly, true); g.stroke();
    g.filter = 'none';
  }
  const folds = o.folds || [];
  if (folds.length) {
    const fpx = o.fw || 26, fw = fpx * u, fa = o.fa === undefined ? 0.6 : o.fa, ds = folds.map((f) => cr(f.p, false, 4));
    g.filter = `blur(${(fpx * 0.2).toFixed(1)}px)`; g.fillStyle = L.rgba(fam.mid, fa);
    g.beginPath(); ds.forEach((d, i) => addPoly(g, wedge(d, folds[i].side || 1, fw * 0.05, fw * (folds[i].w || 1)))); g.fill();
    g.filter = `blur(${(fpx * 0.07).toFixed(1)}px)`; g.fillStyle = L.rgba(fam.deep, fa * 0.5);
    g.beginPath(); ds.forEach((d, i) => addPoly(g, wedge(d, folds[i].side || 1, 0, fw * 0.3 * (folds[i].w || 1)))); g.fill();
    g.filter = 'none';
  }
  if (o.hi) {
    g.filter = `blur(${((o.hw || 12) * 0.4).toFixed(1)}px)`; g.strokeStyle = L.rgba(fam.lt, o.ha === undefined ? 0.75 : o.ha); g.lineWidth = (o.hw || 12) * u;
    g.beginPath(); for (const hp of o.hi) addLine(g, cr(hp, false, 5)); g.stroke(); g.filter = 'none';
  }
  if (o.pattern) o.pattern(g);
  const dg = o.drag === undefined ? 1 : o.drag;
  if (dg) {
    // the wash was drawn on with a soft brush: hair-fine streaks, barely lighter or deeper, all running one way
    const dir = nrm(o.dir || [0.25, 1]), q = [-dir[1], dir[0]], cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, m = Math.hypot(bw, bh) / 2;
    const n = Math.round(L.clamp((bw * bh * KS * KS) / 900, 5, 46) * dg);
    for (let i = 0; i < n; i++) {
      const off = r.range(-m, m), s0 = r.range(-m, m * 0.3), s1 = s0 + r.range(m * 0.35, m * 1.0), bend = r.range(-0.1, 0.1) * m;
      const a = [cx + q[0] * off + dir[0] * s0, cy + q[1] * off + dir[1] * s0], b = [cx + q[0] * off + dir[0] * s1, cy + q[1] * off + dir[1] * s1];
      g.strokeStyle = L.rgba(r.chance(0.5) ? fam.lt : fam.mid, r.range(0.07, 0.16)); g.lineWidth = r.range(1.5, 4.2) * u;
      g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo((a[0] + b[0]) / 2 + q[0] * bend, (a[1] + b[1]) / 2 + q[1] * bend, b[0], b[1]); g.stroke();
    }
  }
  g.restore();
  HG.fillStyle = zc(z); trace(HG, poly, true); HG.fill();
  for (const f of folds) if (f.line !== 0) line(f.p, f.line || 1.5, fam.line, { alpha: f.la === undefined ? 0.8 : f.la, tout: 30 });
  if (o.outline) outline(poly, o.outline, o.lineCol || fam.line, { alpha: 0.9 });
}
/** a border band (collar, cuff) round a centre line */
function band(centre, w, fam, z) {
  const t = tube(centre, centre.map(() => w), 3);
  patch(t.poly, fam, { z, grad: 0.8, rim: 0.8, drag: 0.5, dir: sub(centre[centre.length - 1], centre[0]) });
  line(t.left, 1.6, fam.line, { tout: 8 }); line(t.right, 1.6, fam.line, { tout: 8 });
}
/** a small pool of black enamel (hair): dense, a little glossy, its edge softened where the brush left hairs */
function inkMass(poly, wisps = []) {
  const g = G;
  g.save(); g.filter = 'blur(1.4px)'; g.fillStyle = L.rgba(C.ink, 0.55); trace(g, poly, true); g.fill(); g.filter = 'none'; g.restore();
  patch(poly, F.ink, { z: 0.82, grad: 0.32, rim: 0.7, drag: 0.6, mis: 0 });
  for (const w of wisps) line(w, 1.4, C.ink, { alpha: 0.85, head: 1, tin: 0, tout: 12, tail: 0.5 });
}
/** 团花: a faint roundel, white-petalled, on the pink */
function roundel(g, x, y, r, fam) {
  const u = 1 / KS;
  g.strokeStyle = L.rgba(fam.deep, 0.4); g.lineWidth = 1.3 * u; g.beginPath(); g.arc(x, y, r, 0, L.TAU); g.stroke();
  g.strokeStyle = L.rgba(fam.deep, 0.28); g.beginPath(); g.arc(x, y, r * 0.4, 0, L.TAU); g.stroke();
  g.fillStyle = L.rgba('#fffaf4', 0.86);
  for (let i = 0; i < 8; i++) { const t = (i / 8) * L.TAU + 0.3; g.beginPath(); g.ellipse(x + Math.cos(t) * r * 0.7, y + Math.sin(t) * r * 0.7, r * 0.18, r * 0.13, t, 0, L.TAU); g.fill(); }
  g.fillStyle = L.rgba(fam.deep, 0.5); g.beginPath(); g.arc(x, y, r * 0.15, 0, L.TAU); g.fill();
}
/** a small five-petalled flower scattered on the yellow */
function floret(g, x, y, r, col) {
  g.fillStyle = L.rgba(col, 0.6);
  for (let i = 0; i < 5; i++) { const t = (i / 5) * L.TAU - 1.57; g.beginPath(); g.arc(x + Math.cos(t) * r * 0.62, y + Math.sin(t) * r * 0.62, r * 0.36, 0, L.TAU); g.fill(); }
  g.fillStyle = L.rgba('#fffbe6', 0.92); g.beginPath(); g.arc(x, y, r * 0.24, 0, L.TAU); g.fill();
}

// ───────────────────────── the children (figure units: the head is 200 across, centred on the origin, facing +x) ─────────────────────────
/** a hair knot tied with red thread */
function knot(x, y, r) {
  const rr = L.rng('s14k' + (SEED++)), d = nrm([-x, -y]), q = [-d[1], d[0]];       // d: toward the crown, where it is tied
  const bx = x + d[0] * r * 0.9, by = y + d[1] * r * 0.9;
  for (const s of [-1, 1]) {
    const e0 = [bx + q[0] * s * r * 0.45, by + q[1] * s * r * 0.45];
    const e1 = [e0[0] + q[0] * s * r * 0.75 - d[0] * r * 0.2, e0[1] + q[1] * s * r * 0.75 - d[1] * r * 0.2];
    const e2 = [e1[0] + q[0] * s * r * 0.5 + d[0] * r * 0.4, e1[1] + q[1] * s * r * 0.5 + d[1] * r * 0.4];
    line([e0, e1, e2], 3.2, F.red.base, { alpha: 0.92, head: 1, tin: 2, tout: r * KS * 0.9, tail: 0.32, z: 0.62 });
  }
  const blob = cr(ell(x, y, r, r * 0.9, 9).map((p) => [p[0] + rr.range(-1.5, 1.5), p[1] + rr.range(-1.5, 1.5)]), true, 2.5);
  const up = [-d[0], -d[1]];
  inkMass(blob, [-0.7, 0.1, 0.8].map((t) => { const b = [x + (up[0] + q[0] * t) * r * 0.82, y + (up[1] + q[1] * t) * r * 0.82]; return [b, [b[0] + (up[0] + q[0] * t * 1.4) * r * 0.36, b[1] + (up[1] + q[1] * t * 1.4) * r * 0.36]]; }));
  // a soft light on the knot, and the thread
  G.save(); G.filter = 'blur(1.6px)'; G.strokeStyle = 'rgba(190,186,182,0.5)'; G.lineWidth = 2.6 / KS; G.lineCap = 'round';
  G.beginPath(); G.arc(x, y, r * 0.55, Math.PI * (MIR > 0 ? 1.05 : 1.45), Math.PI * (MIR > 0 ? 1.55 : 1.95)); G.stroke(); G.filter = 'none'; G.restore();
  patch(cr(ell(bx, by, r * 0.6, r * 0.24, 8, Math.atan2(q[1], q[0])), true, 2), F.red, { z: 0.7, grad: 0.6, rim: 0.8, drag: 0, outline: 1.3, mis: 0 });
}
/** the head, three-quarter view. o.hair: 'buns' (总角) | 'peach' (a tuft left on the shaved crown, another over the ear) */
function head(o = {}) {
  const FL = F.flesh, LC = FL.line, INK = C.ink, u = 1 / KS, g = G;
  if (o.hair === 'buns') knot(55, -96, 15);                                       // the far knot sits behind the crown
  const skullPts = [[2, -100], [40, -94], [70, -74], [88, -44], [93, -12], [95, 14], [98, 36], [92, 58], [76, 78], [52, 92], [24, 98], [-6, 94], [-36, 82], [-62, 62], [-82, 34], [-95, 0], [-97, -34], [-84, -66], [-58, -88], [-28, -98]];
  const skull = cr(skullPts, true, 3);
  const peach = cr([[2, -99], [28, -103], [52, -93], [63, -75], [56, -60], [41, -50], [27, -58], [11, -66], [0, -83]], true, 2.5);
  const tuft = cr(ell(-62, -23, 12, 16, 9, 0.1), true, 2.5);
  patch(skull, FL, {
    z: 0.56, grad: 0, rim: 0, drag: 0, mis: 0,
    pattern: () => {
      // 淡粉层层渲染: a breath of pink inside the contour on the side away from the light, then the cheeks, lids, chin
      g.save(); g.translate(-7 * u * MIR, -8 * u);
      g.filter = 'blur(9px)'; g.strokeStyle = L.rgba('#f3b0a8', 0.52); g.lineWidth = 19 * u; trace(g, skull, true); g.stroke(); g.filter = 'none';
      g.restore();
      bloomAt(g, 24, 47, 42, '#f19aa2', 0.46); bloomAt(g, 23, 48, 21, '#ea7d8e', 0.3);
      bloomAt(g, 84, 44, 23, '#f19aa2', 0.42);
      bloomAt(g, 26, 2, 21, '#f6b9b2', 0.24); bloomAt(g, 75, 0, 15, '#f6b9b2', 0.22);
      bloomAt(g, 54, 78, 19, '#f6b9b2', 0.26);
      bloomAt(g, 58, 38, 9, '#f19aa2', 0.3);
      // where the hair springs from the scalp
      if (o.hair === 'buns') { bloomAt(g, -50, -90, 34, '#5d5650', 0.26); bloomAt(g, 55, -90, 26, '#5d5650', 0.22); }
      else {
        g.filter = 'blur(5px)'; g.fillStyle = L.rgba('#5d5650', 0.34);
        g.beginPath(); addPoly(g, peach); addPoly(g, tuft); g.fill(); g.filter = 'none';
      }
    },
  });
  // the contour: forehead – cheek – chin in one pull, the back of the skull in another
  line(skullPts.slice(-1).concat(skullPts.slice(0, 13)), 1.9, LC, { tout: 30 });
  line([[-34, -97], [-58, -88], [-84, -66], [-97, -34], [-95, 0], [-82, 34], [-62, 62], [-46, 75]], 1.8, LC, { tout: 30 });
  // ear
  const ear = cr([[-46, 8], [-57, 1], [-68, 8], [-72, 24], [-67, 40], [-57, 48], [-48, 41], [-44, 24]], true, 2.5);
  patch(ear, FL, { z: 0.61, grad: 0, rim: 0.9, drag: 0, mis: 0, pattern: () => bloomAt(g, -60, 30, 18, '#f19aa2', 0.42) });
  line([[-45.5, 9], [-57, 1], [-68, 8], [-72, 24], [-67, 40], [-57, 48], [-49, 42]], 1.7, LC, { tout: 12 });
  line([[-61, 12], [-64.5, 25], [-59, 38]], 1.3, LC, { alpha: 0.7, tout: 10 });
  // brows: fine, pale, arched high
  line([[5, -7], [22, -17], [44, -10.5]], 1.5, INK, { alpha: 0.62, spindle: 1 });
  line([[60, -12.5], [72, -19], [86, -12.5]], 1.4, INK, { alpha: 0.6, spindle: 1 });
  // eyes: one slender lid each, the pupil a small dark bead tucked under it, a whisper of lower lid
  line([[9, 19.5], [18, 13], [30, 12], [42, 17.5]], 2.3, INK, { alpha: 0.95, spindle: 1, shake: 0.2 });
  line([[61, 16], [68.5, 10.5], [78, 10.5], [87.5, 15]], 2.1, INK, { alpha: 0.95, spindle: 1, shake: 0.2 });
  g.fillStyle = L.rgba(INK, 0.96);
  g.beginPath(); g.ellipse(29.5, 16.4, 3.5, 3.1, 0, 0, L.TAU); g.fill();
  g.beginPath(); g.ellipse(76.5, 14.2, 3.1, 2.8, 0, 0, L.TAU); g.fill();
  line([[14, 22.5], [26, 25], [38, 22]], 1.2, LC, { alpha: 0.5, spindle: 1 });
  line([[64, 19.5], [74, 21.5], [84, 19]], 1.2, LC, { alpha: 0.46, spindle: 1 });
  // nose: one small hook; mouth: a short smiling line with a touch of red above and below it (点朱); the plump chin
  line([[55, 26], [60.5, 36.5], [58, 41], [51.5, 41.5]], 1.4, LC, { alpha: 0.86, tout: 8 });
  g.fillStyle = L.rgba('#cf3f30', 0.84);
  g.beginPath(); g.ellipse(53, 56.3, 5.2, 2.3, -0.05, 0, L.TAU); g.fill();
  g.beginPath(); g.ellipse(53.2, 62.7, 4.4, 2.9, 0, 0, L.TAU); g.fill();
  line([[44.5, 57.3], [49, 59.6], [53.5, 60.2], [58, 59.2], [62, 56.4]], 1.5, '#7c241c', { alpha: 0.92, spindle: 1, shake: 0.2 });
  line([[40, 80], [52, 84.5], [64, 79.5]], 1.2, LC, { alpha: 0.45, spindle: 1 });
  // hair: small masses of ink
  if (o.hair === 'buns') knot(-50, -96, 19);
  else {
    inkMass(peach, [[[41, -50], [42, -43], [40, -37]], [[30, -57], [30, -49], [32, -44]], [[51, -55], [53, -47], [52, -42]], [[17, -63], [16, -56], [18, -51]]]);
    inkMass(tuft, [[[-58, -8], [-57, -1], [-59, 4]], [[-66, -8], [-67, -1], [-65, 3]]]);
    G.save(); G.filter = 'blur(2px)'; G.strokeStyle = 'rgba(190,186,182,0.42)'; G.lineWidth = 3 / KS; G.lineCap = 'round';
    trace(G, cr(MIR > 0 ? [[8, -84], [20, -93], [36, -95]] : [[36, -95], [50, -88], [57, -76]], false, 3), false); G.stroke(); G.filter = 'none'; G.restore();
  }
}
/** a small plump fist closed round a stick that runs along the local x axis */
function fist(x, y, ang) {
  xf(x, y, ang, () => {
    const FL = F.flesh;
    patch(cr([[-13, -8], [-4, -13.5], [8, -13], [15.5, -6], [16.5, 5], [10, 13], [-3, 14.5], [-12.5, 9.5]], true, 2), FL, {
      z: 0.66, grad: 0, rim: 0.8, drag: 0, mis: 0, outline: 1.7, pattern: (g) => { bloomAt(g, 8, -8, 12, '#f19aa2', 0.42); bloomAt(g, -6, 8, 10, '#f3b0a8', 0.3); },
    });
    line([[7, -12], [10.5, -4.5], [8.5, 3.5]], 1.3, FL.line, { alpha: 0.8, tout: 6 });
    line([[1, -13], [4, -5.5], [2, 2]], 1.3, FL.line, { alpha: 0.75, tout: 6 });
    line([[-5.5, -12.5], [-2.5, -6], [-4.5, 0]], 1.2, FL.line, { alpha: 0.65, tout: 6 });
    line([[-10, 5], [-2, 8], [6.5, 6]], 1.3, FL.line, { alpha: 0.75, tout: 6 });
  });
}
/** a stick of some thickness: bamboo (with nodes) or a plain cane */
function stick(p0, p1, w, fam, nodes = []) {
  const t = tube([p0, mixP(p0, p1, 0.5), p1], [w, w * 1.05, w * 0.94], 3), n = t.c.length;
  const lit = t.right.map((p, i) => mixP(p, t.left[i], 0.3)), dark = t.right.map((p, i) => mixP(p, t.left[i], 0.82));
  patch(t.poly, fam, {
    z: 0.64, grad: 0, rim: 0, drag: 0, mis: 0,
    pattern: (g) => {
      g.lineCap = 'butt';
      g.strokeStyle = L.rgba(fam.mid, 0.75); g.lineWidth = w * 0.36; trace(g, dark, false); g.stroke();
      g.strokeStyle = L.rgba(fam.lt, 0.9); g.lineWidth = w * 0.26; trace(g, lit, false); g.stroke();
    },
  });
  line(t.left, 1.6, fam.line, { tout: 0, tin: 0, head: 1 }); line(t.right, 1.5, fam.line, { tout: 0, tin: 0, head: 1, alpha: 0.8 });
  line([t.left[n - 1], t.right[n - 1]], 1.5, fam.line, { tout: 0, tin: 0, head: 1 });
  for (const f of nodes) {
    const i = Math.round(f * (n - 1));
    line([mixP(t.left[i], t.right[i], -0.12), mixP(t.left[i], t.right[i], 1.12)], 1.8, fam.line, { tout: 0, tin: 0, head: 1 });
    const j = Math.min(n - 1, i + 2);
    line([t.left[j], t.right[j]], 1.2, fam.line, { tout: 0, tin: 0, head: 1, alpha: 0.5 });
  }
}
/** the round lantern, hanging by a cord from (x, y) */
function lantern(x, y) {
  const R = F.rouge, O = F.ochre, rx = 62, ry = 66, cy = y + 32 + ry, g = G, r = L.rng('s14tassel');
  line([[x, y], [x + 0.5, y + 21]], 1.5, C.ink, { tout: 0, alpha: 0.85 });
  // tassel: fine threads, red and yellow by turns
  for (let i = -3; i <= 3; i++) {
    line([[x + i * 1.5, cy + ry + 21], [x + i * 2.5 + r.range(-1, 1), cy + ry + 46], [x + i * 3.3 + r.range(-2, 2), cy + ry + 74 + r.range(-6, 4)]], 1.7, i & 1 ? '#c8452f' : '#d9912e', { alpha: 0.92, tout: 22, tail: 0.55, z: 0.5 });
  }
  patch(cr(ell(x, cy + ry + 17, 5.6, 5.4, 8), true, 1.5), F.red, { z: 0.72, grad: 0.7, rim: 0.8, drag: 0, mis: 0, outline: 1.4 });
  const ball = cr(ell(x, cy, rx, ry, 18), true, 3);
  patch(ball, R, {
    z: 0.6, grad: 0, rim: 0.8, drag: 0.7, dir: [0.05, 1], outline: 1.9, mis: 0,
    pattern: () => {
      // round: 玻璃白 swelling toward the light, the rouge deepening away from it
      const hx = x - MIR * 19, hy = cy - 22;
      g.fillStyle = L.radial(g, hx, hy, 2, rx * 1.25, [[0, L.rgba(R.lt, 0.96)], [0.3, L.rgba(R.lt, 0.62)], [0.62, L.rgba(R.lt, 0.16)], [0.85, L.rgba(R.lt, 0)]]);
      g.fillRect(x - rx - 4, cy - ry - 4, rx * 2 + 8, ry * 2 + 8);
      g.fillStyle = L.radial(g, hx, hy, rx * 0.7, rx * 1.75, [[0, L.rgba(R.deep, 0)], [0.55, L.rgba(R.deep, 0.34)], [1, L.rgba(R.deep, 0.72)]]);
      g.fillRect(x - rx - 4, cy - ry - 4, rx * 2 + 8, ry * 2 + 8);
    },
  });
  // ribs: fine lines along the meridians
  for (const k of [-0.76, -0.4, 0, 0.4, 0.76]) {
    line([[x + k * rx * 0.3, cy - ry * 0.97], [x + k * rx * 0.86, cy - ry * 0.5], [x + k * rx, cy], [x + k * rx * 0.86, cy + ry * 0.5], [x + k * rx * 0.3, cy + ry * 0.97]], 1.4, R.line, { alpha: 0.62, tout: 0, tin: 0, head: 1 });
  }
  // a glint where the enamel stands thickest
  g.save(); g.filter = 'blur(2.2px)'; g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.ellipse(x - MIR * 23, cy - 30, 9, 5, -0.6 * MIR, 0, L.TAU); g.fill(); g.filter = 'none'; g.restore();
  // caps
  patch(dense([[x - 15, y + 20], [x + 15, y + 20], [x + 19, y + 34], [x - 19, y + 34]], true, 3), O, { z: 0.72, grad: 0.8, rim: 0.9, drag: 0, mis: 0, outline: 1.6 });
  patch(dense([[x - 19, cy + ry - 3], [x + 19, cy + ry - 3], [x + 15, cy + ry + 11], [x - 15, cy + ry + 11]], true, 3), O, { z: 0.72, grad: 0.8, rim: 0.9, drag: 0, mis: 0, outline: 1.6 });
}
/** the flesh showing in the V of the collar, with the shadow of the chin */
function throat(pts) {
  patch(dense(pts, true, 4), F.flesh, {
    z: 0.5, grad: 0, rim: 0, drag: 0, mis: 0,
    pattern: (g) => { g.filter = 'blur(6px)'; g.fillStyle = L.rgba('#eaa79c', 0.62); g.beginPath(); g.ellipse(12, 95, 54, 13, 0.05, 0, L.TAU); g.fill(); g.filter = 'none'; },
  });
}

/** astride the bamboo horse, both fists on the pole, leaning into the gallop (the bank hides the legs and the pole's trailing end) */
function kidA() {
  const P = F.pink, T = F.green;
  const dots = (g) => { for (const [x, y] of [[-74, 176], [-34, 247], [18, 253], [52, 176], [86, 252], [128, 176]]) roundel(g, x, y, 14, P); };
  // far sleeve, reaching forward to the pole, with its cuff
  patch(cr([[58, 126], [92, 132], [124, 160], [146, 196], [151, 222], [117, 236], [104, 212], [88, 190], [62, 172]], true, 4), P, {
    z: 0.47, fw: 22, folds: [{ p: [[98, 142], [122, 176], [135, 214]], side: 1 }], pattern: dots, dir: [0.4, 1],
  });
  line([[70, 125], [92, 132], [124, 160], [146, 196], [151, 221]], 1.9, P.line, { tout: 8 });
  line([[117, 235], [104, 212], [91, 193]], 1.7, P.line, { tout: 14 });
  patch(dense([[152, 221], [117, 236.5], [113, 224], [148, 208.5]], true, 3), T, { z: 0.58, grad: 0.8, rim: 0.8, drag: 0.5, outline: 1.6 });
  // the jacket
  patch(cr([[-40, 100], [-74, 114], [-100, 146], [-106, 210], [-102, 290], [-96, 400], [70, 404], [96, 330], [102, 262], [94, 200], [84, 150], [70, 122], [50, 104], [30, 112], [0, 112], [-25, 106]], true, 5), P, {
    z: 0.5, fw: 30, pattern: dots, dir: [0.1, 1],
    folds: [{ p: [[46, 152], [60, 204], [58, 258], [46, 318]], side: -1 }, { p: [[14, 168], [26, 214], [22, 266], [8, 320]], side: -1, la: 0.6 }, { p: [[84, 176], [74, 206], [72, 252], [80, 318]], side: 1, w: 0.7, la: 0.6 }],
    hi: [[[70, 140], [84, 190], [90, 250]]], hw: 13,
  });
  line([[52, 104], [70, 122], [84, 150], [94, 200], [102, 262], [96, 330]], 2.0, P.line, { tout: 0 });
  line([[-42, 100], [-74, 114], [-100, 146], [-106, 210], [-102, 300]], 2.0, P.line, { tout: 0 });
  // the bamboo horse, then the far fist over it
  stick([-62, 302], [192, 220.6], 11, F.bamboo, [0.16, 0.45, 0.9]);
  fist(131, 239.5, -0.31);
  // collar: crossed, the left lapel over the right (右衽)
  throat([[-38, 84], [48, 88], [52, 105], [12, 148], [-42, 99]]);
  band([[-42, 97], [-20, 118], [8, 142]], 13, T, 0.6);
  band([[52, 103], [36, 128], [8, 157], [-26, 184]], 13.5, T, 0.64);
  // near sleeve: hanging from the forearm, pushed into folds at the crook of the elbow
  const sl = cr([[56, 238], [30, 228], [4, 220], [-22, 206], [-40, 172], [-50, 134], [-72, 114], [-98, 136], [-107, 186], [-94, 236], [-58, 268], [-8, 279], [44, 273]], false, 4).map(xy);
  patch(sl, P, {
    z: 0.57, fw: 27, pattern: dots, dir: [0.5, 1],
    folds: [{ p: [[-80, 128], [-88, 172], [-82, 214]], side: -1, la: 0.6 }, { p: [[-24, 209], [-48, 227], [-78, 238]], side: 1 }, { p: [[-19, 213], [-30, 241], [-50, 262]], side: -1 }, { p: [[-6, 223], [8, 250], [30, 267]], side: 1, w: 0.8 }],
    hi: [[[-66, 124], [-92, 146], [-99, 186]], [[-8, 226], [22, 234], [44, 240]]], hw: 12,
  });
  pulls(sl, [0.42, 0.7], 2.0, P.line, { tout: 20 });
  patch(dense([[57, 237.5], [44.5, 274], [31, 272.5], [43.5, 233.5]], true, 3), T, { z: 0.66, grad: 0.8, rim: 0.8, drag: 0.5, outline: 1.6 });
  fist(67, 257.5, -0.31);
  xf(0, 0, 0.05, () => head({ hair: 'buns' }));
}
/** holding the lantern up on its stick (drawn facing +x, placed mirrored) */
function kidB() {
  const Y = F.yellow, T = F.blue, RED = '#cf5a3c';
  const dots = (g) => { for (const [x, y] of [[-78, 168], [-58, 228], [-18, 246], [28, 226], [54, 208], [-8, 160], [64, 150], [86, 236], [-48, 292], [32, 292], [78, 290]]) floret(g, x, y, 6.5, RED); };
  patch(cr([[-40, 100], [-74, 114], [-100, 146], [-104, 210], [-100, 290], [-96, 400], [70, 404], [90, 330], [95, 262], [91, 200], [83, 150], [70, 122], [50, 104], [30, 112], [0, 112], [-25, 106]], true, 5), Y, {
    z: 0.5, fw: 30, pattern: dots, dir: [0.1, 1],
    folds: [{ p: [[42, 128], [64, 150], [80, 188]], side: 1, la: 0.6 }, { p: [[80, 196], [72, 246], [80, 304]], side: 1, w: 0.8 }, { p: [[20, 272], [30, 292], [26, 316]], side: -1, la: 0.6 }, { p: [[-40, 274], [-34, 294], [-40, 316]], side: -1, la: 0.6 }],
    hi: [[[66, 136], [80, 186], [86, 250]]], hw: 13,
  });
  line([[52, 104], [70, 122], [83, 150], [91, 200], [95, 262], [90, 330]], 2.0, Y.line, { tout: 0 });
  line([[-42, 100], [-74, 114], [-100, 146], [-104, 210], [-100, 300]], 2.0, Y.line, { tout: 0 });
  // the lantern's stick and the lantern
  stick([62, 251], [246, 22], 5.4, F.ochre);
  lantern(246, 22);
  // collar (drawn so that, mirrored on the wall, it still closes to the wearer's right)
  throat([[-38, 84], [48, 88], [52, 105], [30, 141], [-42, 99]]);
  band([[52, 103], [42, 121], [30, 139]], 13, T, 0.6);
  band([[-42, 97], [-14, 120], [22, 150], [60, 184]], 13.5, T, 0.64);
  // near sleeve, the forearm lifted
  const sl = cr([[74, 188], [44, 190], [10, 196], [-20, 200], [-40, 170], [-50, 134], [-72, 114], [-98, 136], [-108, 188], [-96, 240], [-62, 270], [-10, 274], [40, 260], [88, 236]], false, 4).map(xy);
  patch(sl, Y, {
    z: 0.57, fw: 27, pattern: dots, dir: [0.5, 1],
    folds: [{ p: [[-80, 128], [-90, 174], [-84, 218]], side: -1, la: 0.6 }, { p: [[-22, 203], [-48, 226], [-80, 240]], side: 1 }, { p: [[-17, 207], [-26, 238], [-44, 262]], side: -1 }, { p: [[0, 204], [20, 232], [50, 250]], side: 1, w: 0.8 }],
    hi: [[[-66, 124], [-92, 146], [-100, 188]], [[0, 203], [34, 198], [64, 196]]], hw: 12,
  });
  pulls(sl, [0.42, 0.7], 2.0, Y.line, { tout: 20 });
  patch(dense([[74, 188], [88, 236], [75.3, 238.8], [61.3, 190.8]], true, 3), T, { z: 0.66, grad: 0.8, rim: 0.8, drag: 0.5, outline: 1.6 });
  fist(100, 204, Math.atan2(-182, 146));
  xf(0, 0, -0.05, () => head({ hair: 'peach' }));
}
/** stand a figure on the wall: (x, y) = centre of its head in the frame, k = scale, mir = −1 to face left, lean = radians forward */
function place(x, y, k, mir, lean, fn) {
  KS = k; MIR = mir;
  for (const c of [G, HG]) { c.save(); c.translate(x, y); c.rotate(lean * mir); c.scale(k * mir, k); }
  fn();
  for (const c of [G, HG]) c.restore();
  KS = 1; MIR = 1;
}

// ───────────────────────── the green bank ─────────────────────────
const GCOLS = ['#24361f', '#2b2620', '#2c4a2b'];
const TUFTS = [[-1330, -50, 1.2], [-1120, -40, 1.2], [-900, -8, 1.1], [-700, -62, 1.3], [-470, -6, 1.0], [-300, -50, 1.25], [-120, -20, 0.95], [70, -70, 1.2], [230, -8, 1.0], [420, -44, 1.3], [640, -12, 1.1], [800, -66, 1.2], [1010, -30, 1.3], [1220, -10, 1.1]];
const MOSS = [[-1260, -24], [-1000, -80], [-590, -28], [-380, -92], [-30, -48], [300, -90], [540, -70], [900, -26], [1130, -84]];
function slope(env) {
  const g = G, a = env.arc, sp = a.span(PAD + 180), nz = L.makeNoise('s14slope'), r = L.rng('s14grass');
  // the lower edge of the green wash, and of the thinner first wash that shows below it here and there
  const N = 560, low = [], low2 = [];
  for (let i = 0; i <= N; i++) {
    const th = L.lerp(sp, -sp, i / N), u = th * a.R;
    const d = 114 + 46 * nz.fbm(u / 760, 1.3, 3) + 10 * nz.n2(u / 140, 7.7) + 3.4 * nz.n2(u / 41, 2.2) + 1.1 * nz.n2(u / 13, 5.1);
    const d2 = d + 15 + 13 * nz.n2(u / 210, 11.3) + 4 * nz.n2(u / 47, 15.9);
    const p = a.pt(th, -d), p2 = a.pt(th, -d2);
    low.push([p.x, p.y]); low2.push([p2.x, p2.y]);
  }
  const bandPath = (c, pts) => { c.beginPath(); a.trace(c, 0, -sp, sp); for (const p of pts) c.lineTo(p[0], p[1]); c.closePath(); };
  bandPath(g, low2); g.fillStyle = L.rgba('#d3ebbc', 0.82); g.fill();
  bandPath(HG, low2); HG.fillStyle = zc(0.2); HG.fill();
  g.save();
  bandPath(g, low);
  g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 170, a.R, [[0, '#c3e3a8'], [0.35, '#acd692'], [0.7, '#96c87f'], [0.93, '#86bd70'], [1, '#7bb566']]);
  g.fill(); g.clip();
  // a second, deeper wash laid in long drifting patches
  g.drawImage(L.polarNoiseLayer(env, PAD, { seed: 's14w2', scale: 230, sx: 3.4, sy: 0.7, octaves: 3, res: 0.25, contrast: 1.5,
    ramp: [[0, L.rgba('#eaf7d6', 0.34)], [0.36, L.rgba('#eaf7d6', 0)], [0.54, L.rgba('#5aa257', 0)], [0.66, L.rgba('#5aa257', 0.2)], [1, L.rgba('#3f8a45', 0.4)]] }), -PAD, -PAD);
  // everything soft goes on one sheet that is blurred once: broad pulls of the brush along the bank, colour pooled under the
  // crest line and along the lower rim of the wash
  const sheet = L.makeCanvas(g.canvas.width, g.canvas.height), sg = sheet.getContext('2d');
  sg.translate(-RX, -RY); sg.lineCap = 'round'; sg.lineJoin = 'round';
  for (const [n, col, a0, a1, w0, w1] of [[18, '#479a50', 0.12, 0.26, 12, 36], [13, '#e6f5cc', 0.16, 0.32, 10, 26]]) {
    for (let i = 0; i < n; i++) {
      const t0 = L.lerp(-sp, sp, (i + r.range(0, 0.8)) / n), ln = ((2 * sp) / n) * r.range(0.7, 1.9), dr = -r.range(24, 124), tilt = r.range(-14, 14), pts = [];
      for (let k = 0; k <= 14; k++) { const p = a.pt(t0 + (ln * k) / 14, dr + tilt * (k / 14 - 0.5) + 5 * nz.n2(i * 3.1, k * 0.4)); pts.push([p.x, p.y]); }
      sg.strokeStyle = L.rgba(col, r.range(a0, a1)); sg.lineWidth = r.range(w0, w1); trace(sg, pts, false); sg.stroke();
    }
  }
  sg.strokeStyle = L.rgba('#3f8a47', 0.4); sg.lineWidth = 24; a.stroke(sg, -9, -sp, sp);
  sg.strokeStyle = L.rgba('#4c9a53', 0.42); sg.lineWidth = 12; trace(sg, low, false); sg.stroke();
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'blur(4.5px)'; g.drawImage(sheet, 0, 0); g.filter = 'none'; g.restore();
  // hair-fine streaks of the brush, running with the bank
  g.lineCap = 'round';
  for (let i = 0; i < 190; i++) {
    const t0 = r.range(-sp, sp), ln = r.range(50, 240) / a.R, dr = -r.range(8, 150), tilt = r.range(-6, 6), pts = [];
    for (let k = 0; k <= 8; k++) { const p = a.pt(t0 + (ln * k) / 8, dr + tilt * (k / 8 - 0.5)); pts.push([p.x, p.y]); }
    g.strokeStyle = L.rgba(r.chance(0.5) ? '#eef8d8' : '#3f8f49', r.range(0.07, 0.17)); g.lineWidth = r.range(1.4, 3.6); trace(g, pts, false); g.stroke();
  }
  // the rim where the wash stopped and dried a shade deeper
  g.strokeStyle = L.rgba('#3f8a45', 0.34); g.lineWidth = 4.6; g.lineJoin = 'round'; trace(g, low, false); g.stroke();
  // pin-point bubbles in the thick green
  for (let i = 0; i < 150; i++) {
    const p = a.pt(r.range(-sp, sp), -r.range(10, 140)), rad = r.range(0.9, 1.7);
    g.fillStyle = L.rgba('#2f7a3c', r.range(0.25, 0.5)); g.beginPath(); g.arc(p.x, p.y, rad + 0.7, 0, L.TAU); g.fill();
    g.fillStyle = L.rgba('#f2fbe2', r.range(0.5, 0.85)); g.beginPath(); g.arc(p.x - 0.4, p.y - 0.5, rad * 0.62, 0, L.TAU); g.fill();
  }
  g.restore();
  bandPath(HG, low);
  HG.fillStyle = L.radial(HG, a.cx, a.cy, a.R - 170, a.R, [[0, zc(0.3)], [0.7, zc(0.42)], [1, zc(0.5)]]); HG.fill();

  // the brush contour ON the arc: its upper edge is fixed, the brush swells downward and now and then runs thin
  const M = 700, up = [], dn = [];
  for (let i = 0; i <= M; i++) {
    const th = L.lerp(-sp, sp, i / M), u = th * a.R;
    const w = Math.max(2.3, 5.6 + 2.7 * nz.n2(u / 150, 3.1) + 1.2 * nz.n2(u / 31, 8.8));
    const p0 = a.pt(th, 1.4), p1 = a.pt(th, 1.4 - w);
    up.push([p0.x, p0.y]); dn.push([p1.x, p1.y]);
  }
  const edge = up.concat(dn.reverse());
  g.fillStyle = L.rgba('#232d1c', 0.93); trace(g, edge, true); g.fill();
  HG.fillStyle = zc(0.64); trace(HG, edge, true); HG.fill();
  // the doubled line under it: finer, in long broken runs
  for (let i = 0; i < 10; i++) {
    const t0 = L.lerp(-sp, sp, (i + r.range(0.0, 0.3)) / 10), ln = ((2 * sp) / 10) * r.range(0.6, 0.94), dr = -r.range(14, 18);
    line(L.arcPts(a, dr, t0, t0 + ln, 26), r.range(2.0, 2.7), '#2a4428', { alpha: 0.6, tin: 8, tout: 70, tail: 0.3, shake: 0.9 });
  }
  // grass: a few springy tufts drawn in ink under the green (px along the arc from the crest, depth, size)
  for (const [u0, dr, sc] of TUFTS) {
    const th = u0 / a.R, base = a.pt(th, dr), nb = r.int(4, 6), col = r.pick(GCOLS);
    xf(base.x, base.y, th, () => {
      for (let b = 0; b < nb; b++) {
        const lean = L.lerp(-0.95, 0.95, (b + r.range(-0.3, 0.3)) / (nb - 1)), len = sc * r.range(30, 54) * (1 - 0.28 * Math.abs(lean)), bx = r.range(-5, 5) * sc, curl = lean * r.range(0.2, 0.6);
        line([[bx, 2], [bx + Math.sin(lean * 0.45) * len * 0.5, -Math.cos(lean * 0.45) * len * 0.5], [bx + Math.sin(lean + curl) * len, -Math.cos(lean + curl) * len]],
          sc * r.range(2.3, 3.1), col, { alpha: 0.9, head: 1.2, tin: 4, tout: len * 0.75, tail: 0.3, shake: 0.3, z: 0.62 });
      }
    });
  }
  // moss dots (苔点): a few fat clusters, each dot a bead of dark enamel
  for (const [u0, dr] of MOSS) {
    const n = r.int(3, 5);
    for (let k = 0; k < n; k++) {
      const th = (u0 + r.range(-34, 34)) / a.R, c = a.pt(th, dr + r.range(-12, 12)), rx = r.range(6, 10.5), ry = rx * r.range(0.6, 0.85);
      const blob = cr(ell(c.x, c.y, rx, ry, 7, th + r.range(-0.4, 0.4)).map((p) => [p[0] + r.range(-1.1, 1.1), p[1] + r.range(-1.1, 1.1)]), true, 2);
      g.fillStyle = L.rgba(r.pick(['#234a2a', '#1f3a22', '#2b2620']), r.range(0.8, 0.92)); trace(g, blob, true); g.fill();
      HG.fillStyle = zc(0.8); trace(HG, blob, true); HG.fill();
    }
  }
}

// ───────────────────────── layers ─────────────────────────
/** paint fn on a small sheet covering one part of the wall (blurred washes stay cheap there), then lay it into the big layers */
function region(paint, hmap, x0, y0, w, h, fn) {
  const c = L.makeCanvas(w, h), hc = L.makeCanvas(w, h);
  G = c.getContext('2d'); HG = hc.getContext('2d'); RX = x0; RY = y0;
  G.translate(-x0, -y0); HG.translate(-x0, -y0);
  fn();
  paint.getContext('2d').drawImage(c, x0, y0); hmap.getContext('2d').drawImage(hc, x0, y0);
  G = null; HG = null;
}
/** light the height map once from the upper left → a transparent sheet of glints (white) and shade (warm dark) */
function reliefLight(hmap) {
  const w = hmap.width, h = hmap.height;
  const tmp = L.makeCanvas(w, h), tg = tmp.getContext('2d', { willReadFrequently: true });
  tg.filter = 'blur(1.25px)'; tg.drawImage(hmap, 0, 0); tg.filter = 'none';
  const src = tg.getImageData(0, 0, w, h).data, hg = new Float32Array(w * h);
  for (let i = 0, k = 0; i < hg.length; i++, k += 4) hg[i] = (src[k] * src[k + 3]) / 255;
  const img = new ImageData(w, h), o = img.data, nz = L.makeNoise('s14glint');
  const s = 0.012, lx = -0.35, ly = -0.75, lz = 0.56;
  let hx = lx, hy = ly, hz = lz + 1; const hm = Math.hypot(hx, hy, hz); hx /= hm; hy /= hm; hz /= hm;
  for (let y = 1; y < h - 1; y++) {
    let i = y * w + 1;
    for (let x = 1; x < w - 1; x++, i++) {
      const gx = hg[i + 1] - hg[i - 1], gy = hg[i + w] - hg[i - w];
      if (gx === 0 && gy === 0) continue;
      const nx = -gx * 0.5 * s, ny = -gy * 0.5 * s, inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      const dif = (nx * lx + ny * ly + lz) * inv - lz;
      let v = dif > 0 ? dif * 0.5 : dif * 0.42;
      const sd = (nx * hx + ny * hy + hz) * inv - 0.955;
      if (sd > 0) { const t = sd / 0.045; v += t * t * 0.62 * (0.15 + 0.85 * ss(-0.35, 0.4, nz.n2(x / 64, y / 64))); }   // the glint comes and goes along an edge
      const k = i * 4;
      if (v > 0.004) { o[k] = 255; o[k + 1] = 253; o[k + 2] = 244; o[k + 3] = v >= 1 ? 255 : v * 255; }
      else if (v < -0.004) { o[k] = 78; o[k + 1] = 44; o[k + 2] = 30; o[k + 3] = v <= -1 ? 255 : -v * 255; }
    }
  }
  tg.clearRect(0, 0, w, h); tg.putImageData(img, 0, 0);
  return tmp;
}
function buildPaint(env) {
  const a = env.arc, paint = L.makeLayer(PAD), hmap = L.makeLayer(PAD);
  // the two children come up from behind the bank: painted only above its contour, then the bank is laid over them
  region(paint, hmap, 400, -10, 520, 660, () => { a.clipAbove(G, -3); a.clipAbove(HG, -3); place(590, 195, 1.3, 1, 0.035, kidA); });
  region(paint, hmap, 860, -10, 620, 660, () => { a.clipAbove(G, -3); a.clipAbove(HG, -3); place(1290, 190, 1.28, -1, 0.02, kidB); });
  region(paint, hmap, -PAD, 500, W + PAD * 2, 590, () => slope(env));
  // enamel is never laid perfectly even; here and there a pin-prick bubble burst in the firing
  L.overlayOn(paint, L.noiseLayer(PAD, { seed: 's14en', scale: 80, octaves: 3, contrast: 1.4, res: 0.25 }), { blend: 'soft-light', alpha: 0.15 });
  const pits = L.makeLayer(PAD, (g) => {
    const r = L.rng('s14pits');
    for (let i = 0; i < 900; i++) {
      const x = r.range(-PAD, W + PAD), y = r.range(-PAD, 760), rad = r.range(0.8, 1.5);
      g.fillStyle = L.rgba('#5a3a2a', r.range(0.16, 0.34)); g.beginPath(); g.arc(x, y, rad + 0.5, 0, L.TAU); g.fill();
      g.fillStyle = L.rgba('#ffffff', r.range(0.35, 0.7)); g.beginPath(); g.arc(x + 0.5, y + 0.6, rad * 0.6, 0, L.TAU); g.fill();
    }
  });
  L.overlayOn(paint, pits, { blend: 'source-over', alpha: 1 });
  // the enamel's surface is not dead flat either
  const hg = hmap.getContext('2d');
  hg.save(); hg.setTransform(1, 0, 0, 1, 0, 0); hg.globalCompositeOperation = 'source-atop'; hg.globalAlpha = 0.3;
  hg.drawImage(L.noiseLayer(PAD, { seed: 's14wav', scale: 20, octaves: 2, res: 0.5 }), 0, 0); hg.restore();
  return { paint, light: reliefLight(hmap) };
}
function buildSurface(env, paint, light) {
  const surf = L.makeLayer(PAD, (g) => {
    const full = () => g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    g.fillStyle = C.cream; full();
    // slow drift in the glaze thickness
    g.globalAlpha = 0.55;
    g.drawImage(L.noiseLayer(PAD, { seed: 's14glaze', scale: 460, octaves: 3, res: 0.2, ramp: [[0, '#efe7d2'], [0.5, '#f5efe0'], [1, '#fbf8ee']] }), -PAD, -PAD);
    g.globalAlpha = 1;
    // pin-holes (棕眼): a dark speck in a paler dimple, lit on the wall that faces the light; the odd iron spot
    const r = L.rng('s14pin');
    for (let i = 0; i < 40; i++) {
      const x = r.range(-PAD, W + PAD), y = r.range(-PAD, H + PAD), rad = r.range(1.2, 2.3) * (r.chance(0.15) ? 1.7 : 1), iron = r.chance(0.22);
      bloomAt(g, x, y, rad * 4.2, '#fffdf6', 0.75);
      g.fillStyle = L.rgba(iron ? '#3a2a1c' : '#8a6238', r.range(0.5, 0.82)); g.beginPath(); g.arc(x, y, rad, 0, L.TAU); g.fill();
      g.fillStyle = L.rgba('#fffdf6', 0.8); g.beginPath(); g.arc(x + rad * 0.7, y + rad * 0.8, rad * 0.55, 0, L.TAU); g.fill();
    }
    // a few hairlines of wear
    g.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const x = r.range(-PAD, W + PAD), y = r.range(-PAD, H + PAD), ang = r.range(-0.5, 0.5) + (r.chance(0.2) ? 1.2 : 0), len = r.range(70, 260), al = r.range(0.04, 0.085);
      const x1 = x + Math.cos(ang) * len, y1 = y + Math.sin(ang) * len, bx = (x + x1) / 2 + r.range(-8, 8), by = (y + y1) / 2 + r.range(-8, 8);
      g.lineWidth = r.range(1.2, 1.5);
      g.strokeStyle = L.rgba('#7a5c3a', al); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(bx, by, x1, y1); g.stroke();
      g.strokeStyle = L.rgba('#ffffff', al * 2.2); g.beginPath(); g.moveTo(x, y + 1.2); g.quadraticCurveTo(bx, by + 1.2, x1, y1 + 1.2); g.stroke();
    }
    // a breath of colour in the glaze round the enamel, the enamel with a hair of shadow under its lower-right rim, then its light
    g.globalAlpha = 0.07; g.drawImage(L.blurred(paint, 9), -PAD, -PAD); g.globalAlpha = 1;
    g.shadowColor = 'rgba(105,70,40,0.26)'; g.shadowBlur = 2.6; g.shadowOffsetX = 1.4; g.shadowOffsetY = 2.0;
    g.drawImage(paint, -PAD, -PAD);
    g.shadowColor = 'rgba(0,0,0,0)'; g.shadowBlur = 0; g.shadowOffsetX = 0; g.shadowOffsetY = 0;
    g.drawImage(light, -PAD + 2.0, -PAD + 2.4);
  });
  // macro lens: focus sits on the crest, the lantern and the two faces; the wall falls out of focus toward the frame's ends and its foot
  const sg0 = surf.getContext('2d');
  for (const [px, r0, r1] of [[2.2, 600, 940], [5.5, 900, 1340]]) {
    const soft = L.blurred(surf, px), sg = soft.getContext('2d');
    sg.globalCompositeOperation = 'destination-in';
    sg.fillStyle = L.radial(sg, 960 + PAD, 400 + PAD, r0, r1, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]);
    sg.fillRect(0, 0, soft.width, soft.height);
    sg0.drawImage(soft, -PAD, -PAD);
  }
  return surf;
}
/**
 * Reflections on the glaze (half-res, padded; they are out of focus — the lens is focused on the painted surface, not on what it mirrors):
 * a four-paned window in the empty upper left, bowed by the wall's curve; a long soft light lying across the bare wall below
 * the bank; a broken glint where the green enamel stands thick. The glaze's faint orange-peel ruffles their edges.
 */
function buildGloss(env) {
  const a = env.arc, res = 0.5, GW = Math.round((W + PAD * 2) * res), GH = Math.round((H + PAD * 2) * res);
  const img = new ImageData(GW, GH), d = img.data, nz = L.makeNoise('s14gloss');
  for (let j = 0; j < GH; j++) {
    const y = j / res - PAD;
    for (let i = 0; i < GW; i++) {
      const x = i / res - PAD, ddx = x - a.cx, ddy = a.cy - y, rr = Math.sqrt(ddx * ddx + ddy * ddy), dr = rr - a.R;
      let v = 0;
      if (dr < -24 && dr > -100) {
        // light catching the thickness of the green enamel: a broken streak that follows the bank
        const u = Math.atan2(ddx, ddy) * a.R, d0 = dr + 46 + 6 * nz.n2(u / 140, 4.4);
        const brk = ss(-0.2, 0.4, nz.n2(u / 60, dr / 18 + 30));
        v = 0.26 * Math.exp(-(d0 * d0) / (2 * 6 * 6)) * brk * Math.exp(-Math.pow((u + 300) / 640, 2));
      } else if (dr < -170) {
        // the long light on the bare wall: fattest left of centre where the light comes from, dying away at both ends
        const u = Math.atan2(ddx, ddy) * a.R;
        const op = 4.5 * nz.n2(u / 90, dr / 90) + 1.5 * nz.n2(u / 17 + 9, dr / 17);
        const along = Math.exp(-Math.pow((u + 220) / 780, 2));
        const hw = 9 + 25 * along;
        const e = dr + 322 + op - 0.016 * u;                                               // > 0 above the middle of the light
        const core = (1 - ss(hw - 8, hw + 24, e)) * ss(-hw - 38, -hw + 6, e);
        const halo = Math.exp(-(e * e) / (2 * 105 * 105));
        v = (0.66 * core + 0.15 * halo) * along;
      } else if (dr > 24 && x < 470 && y < 440) {
        // the window: two by two panes, soft
        const wx = x - 212, wy = y - 196, op = 3.0 * nz.n2(x / 80, y / 80) + 1.2 * nz.n2(x / 19 + 5, y / 19);
        const bx = wx - 0.00045 * wy * wy + 0.05 * wy + op, by = wy + 0.1 * wx + op * 0.6;
        const px = Math.max(1 - ss(33, 52, Math.abs(bx + 57)), 1 - ss(33, 52, Math.abs(bx - 57)));
        const py = Math.max(1 - ss(50, 69, Math.abs(by + 73)), 1 - ss(50, 69, Math.abs(by - 73)));
        const bloom = Math.exp(-(bx * bx) / (2 * 115 * 115) - (by * by) / (2 * 165 * 165));
        v = 0.56 * px * py * (0.72 + 0.28 * L.clamp(1 - (by + 130) / 300)) + 0.1 * bloom;
      }
      if (v <= 0.003) continue;
      const k = (j * GW + i) * 4;
      d[k] = 253; d[k + 1] = 253; d[k + 2] = 250; d[k + 3] = L.clamp(v) * 255;
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
    const { paint, light } = buildPaint(env);
    const t1 = performance.now();
    const surface = buildSurface(env, paint, light);
    const t2 = performance.now();
    const gloss = buildGloss(env);
    console.warn(`s14 timing: paint ${(t1 - t0) | 0} surface ${(t2 - t1) | 0} gloss ${(performance.now() - t2) | 0}`);
    S = { surface, gloss };
  },
  draw(ctx, env, p) {
    // the painted wall turns slowly: children and bank slide along the arc
    const rot = L.lerp(-0.012, 0.012, p);
    L.blit(ctx, env, S.surface, { rot, zoom: L.lerp(1.0, 1.012, p) });
    // the light does not turn with it: it comes from the upper left, and the wall rolls away toward its foot and the far corners …
    ctx.save(); ctx.globalCompositeOperation = 'multiply';
    const a = env.arc;
    ctx.fillStyle = L.radial(ctx, 640, 210, 280, 1850, [[0, '#ffffff'], [0.5, '#fbf7ee'], [1, '#eee6d6']]);
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = L.radial(ctx, a.cx, a.cy, a.R - 720, a.R - 170, [[0, '#e9e1d0'], [0.45, '#f4eee2'], [0.75, '#fbf8f1'], [1, '#ffffff']]);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    // … and the reflections lie still on the glaze
    L.cam(ctx, env, { rot: -rot * 0.35 }, () => ctx.drawImage(S.gloss, -PAD, -PAD, W + PAD * 2, H + PAD * 2));
  },
};
