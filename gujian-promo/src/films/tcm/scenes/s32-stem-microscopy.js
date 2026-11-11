// s32 — 药材显微·茎横切. A stained transverse section of a herbaceous stem under a bright-field microscope.
// The arc is the section's outer skin: one row of small, tightly packed blue-violet epidermal cells whose outline
// undulates a few pixels around env.arc. Below it, from outside in: a dark band of small thick-walled cells, cortex
// parenchyma that grows larger with depth, a ring of vascular bundles (dark cap → luminous phloem → ink-green xylem with
// big round vessel holes) and the wide thin-walled cells of the pith. Above the arc: the empty cream field of view.
// Deliberately schematic (no species implied), no labels, no scale bar.
//
// How it is made (all in init):
//   1. circle-pack "cells" whose target size depends on the tissue zone at that spot (zones live in polar coords:
//      s = distance along the arc, d = depth below it, so everything is concentric with the arc);
//   2. turn the packing into a power diagram (weighted Voronoi) → one convex polygon per cell; the lumen is the same
//      polygon clipped again with every wall pushed inward, then rounded;
//   3. photograph it: section-thickness shading, uneven staining, chromatic fringes (blue channel displaced),
//      field-curvature blur toward the edges, a diffraction line outside the skin.
// draw() blits the finished micrograph with a tiny stage drift, pulls focus and lets the wall rims shimmer.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 80;
let S = null;

const BG = '#efe9dd';            // field of view (lands on the palette's #ece6da after the illumination falloff)
const TEAL = '#17a08a', INK = '#0f4f4a', VIOLET = '#2b2f8f', WHITE = '#f8f6ee';
const EPI = 0, HYPO = 1, CORTEX = 2, PITH = 3, CAP = 4, RING = 5, PHLOEM = 6, XYLEM = 7, SHEATH = 8, VESSEL = 9;
const EPI_H = 15.5;              // nominal height of the epidermal row (px)

const sstep = (a, b, v) => { let t = (v - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };

/** keep the part of convex polygon P (flat [x,y,…]) where nx·x + ny·y ≤ c */
function clipHalf(P, nx, ny, c) {
  const n = P.length; if (n < 6) return P;
  const out = [];
  let x0 = P[n - 2], y0 = P[n - 1], d0 = nx * x0 + ny * y0 - c;
  for (let i = 0; i < n; i += 2) {
    const x1 = P[i], y1 = P[i + 1], d1 = nx * x1 + ny * y1 - c;
    if ((d0 <= 0) !== (d1 <= 0)) { const t = d0 / (d0 - d1); out.push(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t); }
    if (d1 <= 0) out.push(x1, y1);
    x0 = x1; y0 = y1; d0 = d1;
  }
  return out;
}
function ngon(r, n, rot) { const P = []; for (let k = 0; k < n; k++) { const t = rot + (k / n) * L.TAU; P.push(Math.cos(t) * r, Math.sin(t) * r); } return P; }
function polyPath(g, P) { g.beginPath(); g.moveTo(P[0], P[1]); for (let i = 2; i < P.length; i += 2) g.lineTo(P[i], P[i + 1]); g.closePath(); }
/** convex polygon with every corner cut by a quadratic (f = 0.5 → a fully rounded blob) */
function roundPath(g, P, f, ox = 0, oy = 0) {
  const n = P.length >> 1;
  g.beginPath();
  for (let k = 0; k < n; k++) {
    const kp = (k + n - 1) % n, kn = (k + 1) % n;
    const x = P[k * 2] + ox, y = P[k * 2 + 1] + oy;
    const ax = x + (P[kp * 2] + ox - x) * f, ay = y + (P[kp * 2 + 1] + oy - y) * f;
    const bx = x + (P[kn * 2] + ox - x) * f, by = y + (P[kn * 2 + 1] + oy - y) * f;
    if (k === 0) g.moveTo(ax, ay); else g.lineTo(ax, ay);
    g.quadraticCurveTo(x, y, bx, by);
  }
  g.closePath();
}

// vessel layouts inside a bundle, in bundle units [u (across), v (0 = cambium … 1 = pith tip), radius / half-width]
const LAYOUTS = [
  [[-0.41, 0.28, 0.27], [0.42, 0.25, 0.25], [0.02, 0.6, 0.16], [0.0, 0.83, 0.085], [0.0, 0.2, 0.09]],
  [[-0.5, 0.2, 0.22], [0.0, 0.36, 0.26], [0.5, 0.22, 0.21], [-0.2, 0.7, 0.11], [0.2, 0.73, 0.1]],
  [[-0.33, 0.24, 0.25], [0.36, 0.3, 0.27], [-0.1, 0.62, 0.15], [0.2, 0.74, 0.1], [0.04, 0.16, 0.075]],
];

function buildCells(env, X0, Y0, LW, LH) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const nz = L.makeNoise('s32'), rr = L.rng('s32cells');
  const SMAX = a.span(PAD + 90) * R;
  // slow undulation of the skin (px, + = outward)
  const und = (s) => 2.6 * nz.n2(s / 240, 3.1) + 1.2 * nz.n2(s / 70 + 9, 7.7);

  // ── epidermis: cell boundaries along the arc; every cell bulges a little → a beaded outline ──
  const eb = [];
  for (let s = -SMAX - 40; s < SMAX + 40;) { eb.push(s); s += rr.range(16, 23.5) * (rr.chance(0.14) ? 1.3 : 1); }
  const outDr = (s) => {
    let lo = 0, hi = eb.length - 1;
    if (s <= eb[0] || s >= eb[hi]) return und(s) - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (eb[m] <= s) lo = m; else hi = m; }
    const fr = (s - eb[lo]) / (eb[hi] - eb[lo]);
    return und(s) + 1.5 * Math.pow(Math.sin(Math.PI * fr), 0.7) - 1.0;
  };

  // ── vascular bundles: a ring of large ones, smaller ones in between and a little further out ──
  const rb = L.rng('s32bundle');
  const bundles = [];
  const mk = (s0, d0, hw, hh, main) => { const tilt = rb.range(-0.1, 0.1); bundles.push({ s0, d0, hw, hh, main, ct: Math.cos(tilt), st: Math.sin(tilt), ph: rb.range(0, 90), lay: rb.int(0, 2), flip: rb.chance(0.5) ? -1 : 1 }); };
  const mains = [];
  for (let k = -3; k <= 3; k++) mains.push(-46 + k * 404 + rb.range(-26, 26));
  for (const s0 of mains) mk(s0, 244 + rb.range(-14, 14), 104 + rb.range(-9, 11), 134 + rb.range(-10, 14), true);
  for (let i = 0; i < mains.length - 1; i++) if (rb.chance(0.86)) mk((mains[i] + mains[i + 1]) / 2 + rb.range(-34, 34), 170 + rb.range(-14, 16), 52 + rb.range(-6, 7), 64 + rb.range(-7, 9), false);

  const hypoT = (s) => {
    let t = 40 + 24 * nz.n2(s / 210, 11.3);
    for (const b of bundles) { const q = (s - b.s0) / (b.hw * (b.main ? 1.0 : 1.25)); if (q > -3 && q < 3) t += (b.main ? 42 : 36) * Math.exp(-q * q); }
    return t;
  };
  // tissue zone + target cell radius at (s, d); result in Z
  const Z = { zone: 0, tr: 0, b: null, t: 0 };
  function zoneAt(s, d) {
    let be = 99, bb = null, bu = 0, bv = 0;
    for (const b of bundles) {
      const ds = s - b.s0, dd = d - b.d0;
      if (Math.abs(ds) > b.hw * 2.3 || Math.abs(dd) > b.hh * 2.3) continue;
      const u = (ds * b.ct + dd * b.st) / b.hw, v = (-ds * b.st + dd * b.ct) / b.hh;
      const gq = 1 - 0.16 * v, e = (u * u) / (gq * gq) + v * v;
      if (e < be) { be = e; bb = b; bu = u; bv = v; }
    }
    Z.b = bb; Z.t = 0;
    if (bb) {
      const wob = 0.07 * nz.n2(s / 36 + bb.ph, d / 36);
      const e = be * (1 + 1.3 * wob), m = bb.main;
      if (e < 1) {
        if (bv < -0.38 + 0.4 * bu * bu + wob) { Z.zone = CAP; Z.tr = m ? 6.2 : 5.2; }
        else if (e > 0.68 + wob) { Z.zone = RING; Z.tr = m ? 6.6 : 5.5; }
        else if (bv < 0.04 + 0.12 * bu * bu + wob) { Z.zone = PHLOEM; Z.tr = m ? 5.9 : 5.0; }
        else { Z.zone = XYLEM; Z.tr = m ? 7.6 : 6.1; }
        return;
      }
      be = e;
    }
    const hT = hypoT(s), dH = EPI_H + hT;
    let tr, zone;
    if (d < dH) {
      const t = L.clamp((d - EPI_H) / hT);
      zone = HYPO; tr = L.lerp(6.6, 9.6, Math.pow(t, 1.5)); Z.t = t;
    } else {
      tr = L.lerp(10.5, 30, sstep(0, 100, d - dH));
      tr = L.lerp(tr, 50, sstep(185, 400, d));
      tr *= 1 + 0.2 * nz.n2(s / 160 + 40, d / 160);
      zone = d - dH < 96 + 14 * nz.n2(s / 120, 21.5) ? CORTEX : PITH;
    }
    if (bb) {
      const f = (Math.sqrt(be) - 1) / 0.34;
      if (f < 1) { tr = Math.min(tr, L.lerp(8.5, tr, sstep(0, 1, f))); if (f < 0.24 && zone !== HYPO) zone = SHEATH; }
    }
    Z.zone = zone; Z.tr = tr;
  }

  // ── packing. Each seed is registered in every grid cell its circle touches, so a query only needs its own box ──
  const seeds = [];
  const G = 32, gx0 = X0 - 160, gy0 = Y0 - 160, gw = Math.ceil((LW + 320) / G), gh = Math.ceil((LH + 320) / G);
  const grid = new Array(gw * gh);
  const add = (x, y, r, zone, s, d, b, t) => {
    const i0 = Math.floor((x - r - gx0) / G), i1 = Math.floor((x + r - gx0) / G), j0 = Math.floor((y - r - gy0) / G), j1 = Math.floor((y + r - gy0) / G);
    if (i0 < 0 || j0 < 0 || i1 >= gw || j1 >= gh) return false;
    const id = seeds.length;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * gw + i; (grid[k] || (grid[k] = [])).push(id); }
    seeds.push({ x, y, r, zone, s, d, b, t });
    return true;
  };
  const fits = (x, y, r) => {
    const i0 = Math.max(0, Math.floor((x - r - gx0) / G)), i1 = Math.min(gw - 1, Math.floor((x + r - gx0) / G));
    const j0 = Math.max(0, Math.floor((y - r - gy0) / G)), j1 = Math.min(gh - 1, Math.floor((y + r - gy0) / G));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cell = grid[j * gw + i]; if (!cell) continue;
      for (let q = 0; q < cell.length; q++) {
        const c = seeds[cell[q]], dx = c.x - x, dy = c.y - y, lim = r + c.r - 0.12 * Math.min(r, c.r);
        if (dx * dx + dy * dy < lim * lim) return false;
      }
    }
    return true;
  };
  const toXY = (s, d) => { const th = s / R, rad = R - d; return [cx + rad * Math.sin(th), cy - rad * Math.cos(th)]; };

  // vessels first (the big round holes), then the epidermal row, then everything else from large to small
  for (const b of bundles) {
    for (const [u0, v0, fr] of LAYOUTS[b.lay]) {
      const rad = fr * b.hw * rb.range(0.9, 1.1);
      if (rad < 5.5) continue;
      const u = (u0 * b.flip + rb.range(-0.03, 0.03)) * b.hw, v = (v0 + rb.range(-0.03, 0.03)) * b.hh;
      const s = b.s0 + u * b.ct - v * b.st, d = b.d0 + u * b.st + v * b.ct;
      const [x, y] = toXY(s, d);
      if (fits(x, y, rad)) add(x, y, rad, VESSEL, s, d, b, 0);
    }
  }
  for (let k = 0; k < eb.length - 1; k++) {
    const sc = (eb[k] + eb[k + 1]) / 2, w = eb[k + 1] - eb[k];
    const [x, y] = toXY(sc, 7.2 - und(sc));
    add(x, y, w * 0.5, EPI, sc, 7.2, null, 0);
  }
  const passes = [[1.22, 17], [1.0, 12], [0.84, 8.5], [0.7, 6.5], [0.58, 5.2], [0.48, 4.6], [0.38, 4.2], [0.28, 4.2]];
  for (const [m, pitch] of passes) {
    const nx = Math.ceil((LW + 60) / pitch), ny = Math.ceil((LH + 40) / pitch), n = nx * ny;
    const order = new Uint32Array(n);
    for (let i = 0; i < n; i++) order[i] = i;
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rr() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
    for (let q = 0; q < n; q++) {
      const o = order[q];
      const x = X0 - 30 + ((o % nx) + rr()) * pitch, y = Y0 + (Math.floor(o / nx) + rr()) * pitch;
      const ddx = x - cx, ddy = cy - y, rad = Math.hypot(ddx, ddy), s = Math.atan2(ddx, ddy) * R, d = R - rad + und(s);
      if (d < EPI_H + 1) continue;
      zoneAt(s, d);
      const flo = Z.tr < 12 ? 0.76 : 0.26;
      const r = Math.max(4.3, Z.tr * Math.max(m, flo) * rr.range(0.86, 1.14));
      if (!fits(x, y, r)) continue;
      add(x, y, r, Z.zone, s, d, Z.b, Z.t);
    }
  }

  // ── dress every cell: wall colour, lumen colour, wall thickness, roundness ──
  const rc = L.rng('s32dress');
  for (const c of seeds) {
    const n1 = nz.n2(c.s / 190 + 5, c.d / 190 - 3) * 0.5 + 0.5, u = rc(), v = rc(), w = rc();
    c.f = 0.5; c.ecc = 1; c.rotA = 0;
    const thin = L.mix(L.mix(TEAL, '#138f96', n1), INK, 0.22 + 0.3 * u);   // thin parenchyma walls: teal drifting blue-green ↔ green
    switch (c.zone) {
      case EPI: c.wall = L.mix(VIOLET, '#17184f', 0.1 + 0.5 * u); c.lumen = L.mix('#5a5fc0', '#8d92de', v); c.inset = L.lerp(3.3, 4.2, w); break;
      case HYPO: {
        const t = c.t;
        c.wall = L.mix(L.mix('#06161f', '#10143f', n1 * 0.8), '#0c3d40', t * t * 0.9);
        c.lumen = L.mix(L.mix('#f6f39a', '#dcec7c', v), '#f6f5cf', t * 0.6);
        c.inset = Math.max(2.4, c.r * L.lerp(0.56, 0.27, t) * L.lerp(0.9, 1.1, w));
        break;
      }
      case CORTEX: c.wall = thin; c.lumen = L.mix(WHITE, '#f3f3cd', v * 0.6); c.inset = L.lerp(1.8, 2.6, w); c.f = L.lerp(0.4, 0.5, u); break;
      case PITH: c.wall = thin; c.lumen = L.mix(WHITE, '#f2f0df', v * 0.7); c.inset = L.lerp(1.6, 2.4, w); c.f = L.lerp(0.36, 0.5, u); break;
      case CAP: c.wall = L.mix('#051820', '#10133f', 0.7 * u); c.lumen = L.mix('#2f8f84', '#9fd08a', v * v); c.inset = c.r * L.lerp(0.54, 0.66, w); break;
      case RING: c.wall = L.mix('#06202a', '#0b3a3c', u); c.lumen = L.mix('#e4f08c', '#bff3d6', v); c.inset = c.r * L.lerp(0.44, 0.56, w); break;
      case PHLOEM: c.wall = L.mix('#06a88c', '#12c6a4', u); c.lumen = L.mix('#8af0d6', '#5fe6c8', v); c.inset = L.lerp(1.1, 1.6, w); c.f = L.lerp(0.3, 0.45, u); break;
      case XYLEM: c.wall = L.mix('#0a3a3c', '#0f6a62', u * 0.8); c.lumen = L.mix('#f4f8e6', '#9af0d6', v * 0.85); c.inset = Math.max(2.1, c.r * L.lerp(0.3, 0.42, w)); break;
      case SHEATH: c.wall = L.mix(thin, INK, 0.45); c.lumen = L.mix(WHITE, '#eef3e2', v); c.inset = L.lerp(1.9, 2.5, w); c.f = L.lerp(0.4, 0.5, u); break;
      default: c.wall = '#06262b'; c.lumen = '#fbf9f0'; c.inset = L.clamp(c.r * 0.2, 3.6, 6); c.ecc = L.lerp(0.9, 1, u); c.rotA = v * Math.PI;
    }
    if (c.zone === CORTEX || c.zone === PITH) {
      // a few cells keep faintly stained contents
      const k = rc();
      if (k < 0.04 && c.r < 26) c.lumen = L.mix('#c8eddd', '#a5e3cf', v);
      else if (k < 0.2) c.lumen = L.mix(WHITE, '#e2f3e6', 0.7);
    }
  }

  // ── power diagram: polygon of every cell, then its lumen ──
  const stamp = new Int32Array(seeds.length).fill(-1);
  const cells = [];
  const planes = [];
  for (let i = 0; i < seeds.length; i++) {
    const c = seeds[i];
    if (c.x < X0 - 50 || c.x > X0 + LW + 50 || c.y > Y0 + LH + 50) continue;
    const Rb = c.zone === VESSEL ? c.r * 1.15 : 1.85 * c.r + 4, q = 2 * Rb;
    const i0 = Math.max(0, Math.floor((c.x - q - gx0) / G)), i1 = Math.min(gw - 1, Math.floor((c.x + q - gx0) / G));
    const j0 = Math.max(0, Math.floor((c.y - q - gy0) / G)), j1 = Math.min(gh - 1, Math.floor((c.y + q - gy0) / G));
    planes.length = 0;
    for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) {
      const cell = grid[j * gw + ii]; if (!cell) continue;
      for (let k = 0; k < cell.length; k++) {
        const id = cell[k]; if (id === i || stamp[id] === i) continue; stamp[id] = i;
        const o = seeds[id], dx = o.x - c.x, dy = o.y - c.y, D = Math.hypot(dx, dy);
        if (D < 1e-3) continue;
        const t = (D * D + c.r * c.r - o.r * o.r) / (2 * D);
        if (t < Rb) planes.push(dx / D, dy / D, t, 0);
      }
    }
    // the skin itself bounds the outermost cells
    const rad = Math.hypot(c.x - cx, c.y - cy), dOut = R + outDr(c.s) - rad;
    if (dOut < Rb) planes.push((c.x - cx) / rad, (c.y - cy) / rad, dOut, c.zone === EPI ? 1.4 : 0.6);
    const rot = rc() * L.TAU;
    let P = ngon(Rb, 12, rot), Q = ngon(Math.max(0.5, Rb - c.inset), 12, rot);
    for (let k = 0; k < planes.length; k += 4) {
      P = clipHalf(P, planes[k], planes[k + 1], planes[k + 2]);
      // no wall is the same thickness all the way round
      Q = clipHalf(Q, planes[k], planes[k + 1], planes[k + 2] - c.inset * (0.72 + 0.6 * rc()) - planes[k + 3]);
    }
    if (P.length < 6) continue;
    for (let k = 0; k < P.length; k += 2) { P[k] += c.x; P[k + 1] += c.y; }
    if (Q.length >= 6) { for (let k = 0; k < Q.length; k += 2) { Q[k] += c.x; Q[k + 1] += c.y; } } else Q = null;
    c.P = P; c.Q = Q;
    cells.push(c);
  }
  for (const b of bundles) { const [x, y] = toXY(b.s0, b.d0 - 0.06 * b.hh); b.x = x; b.y = y; }
  return { cells, outDr, SMAX, bundles };
}

/** displace (and slightly defocus) the blue channel → yellow rims inside the bright lumens, blue on the far walls */
function chroma(C, px, py, k, bx, by, blurB) {
  const w = C.width, h = C.height;
  const out = L.makeCanvas(w, h), o = out.getContext('2d');
  const tmp = L.makeCanvas(w, h), t = tmp.getContext('2d');
  t.drawImage(C, 0, 0);
  t.globalCompositeOperation = 'multiply'; t.fillStyle = '#ffff00'; t.fillRect(0, 0, w, h);
  o.drawImage(tmp, 0, 0);
  t.globalCompositeOperation = 'source-over'; t.drawImage(C, 0, 0);
  t.save();
  t.setTransform(k, 0, 0, k, px * (1 - k) + bx, py * (1 - k) + by);
  if (blurB) t.filter = `blur(${blurB}px)`;
  t.drawImage(C, 0, 0);
  t.restore();
  t.globalCompositeOperation = 'multiply'; t.fillStyle = '#0000ff'; t.fillRect(0, 0, w, h);
  o.globalCompositeOperation = 'lighter'; o.drawImage(tmp, 0, 0);
  return out;
}

async function build(env) {
  const T0 = performance.now(); const tm = [];
  const a = env.arc, R = a.R;
  const X0 = -PAD, Y0 = Math.floor(a.crestY) - 44, LW = W + PAD * 2, LH = H + PAD - Y0;
  const { cells, outDr, SMAX, bundles } = buildCells(env, X0, Y0, LW, LH);
  tm.push('cells ' + cells.length + ' ' + (performance.now() - T0).toFixed(0));
  const mk = () => { const c = L.makeCanvas(LW, LH), g = c.getContext('2d'); g.translate(-X0, -Y0); return [c, g]; };
  const pts = [];
  for (let s = -SMAX; s <= SMAX; s += 2.5) { const p = a.pt(s / R, outDr(s)); pts.push(p.x, p.y); }
  const skin = (g, close, dy = 0) => {
    g.beginPath(); g.moveTo(pts[0], pts[1] + dy);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1] + dy);
    if (close) { g.lineTo(pts[pts.length - 2], Y0 + LH + 60); g.lineTo(pts[0], Y0 + LH + 60); g.closePath(); }
  };
  const lumenPath = (g, c, ox = 0, oy = 0) => {
    if (c.zone === VESSEL) { const rl = c.r - c.inset; g.beginPath(); g.ellipse(c.x + ox, c.y + oy, rl, rl * c.ecc, c.rotA, 0, L.TAU); } else roundPath(g, c.Q, c.f, ox, oy);
  };

  // 1) the section: walls first (every cell paints its own half of the wall), then the lumina
  const [T, g] = mk();
  g.save(); skin(g, true); g.clip();
  g.fillStyle = '#0b4444'; g.fillRect(X0, Y0, LW, LH);
  g.lineJoin = 'round'; g.lineWidth = 1.2;
  for (const c of cells) { g.fillStyle = g.strokeStyle = c.wall; polyPath(g, c.P); g.fill(); g.stroke(); }
  for (const c of cells) if (c.zone === VESSEL) { g.fillStyle = c.wall; g.beginPath(); g.arc(c.x, c.y, c.r * 1.03, 0, L.TAU); g.fill(); }
  for (const c of cells) { if (c.zone !== VESSEL && !c.Q) continue; g.fillStyle = c.lumen; lumenPath(g, c); g.fill(); }
  // cuticle
  g.strokeStyle = '#1b1c63'; g.lineWidth = 5; skin(g, false); g.stroke();
  g.restore();

  // lumen mask (used for the ghost walls and the rim light)
  const [M, mg] = mk();
  mg.fillStyle = '#fff';
  for (const c of cells) { if (c.zone !== VESSEL && !c.Q) continue; lumenPath(mg, c); mg.fill(); }
  tm.push('paint ' + (performance.now() - T0).toFixed(0));

  // 2) the far face of the section: every large cell shows a second, out-of-focus wall line inside its lumen
  const [ghost, gg] = mk();
  const rg = L.rng('s32ghost');
  gg.lineJoin = 'round';
  for (const c of cells) {
    if (c.r < 17 || (c.zone !== CORTEX && c.zone !== PITH && c.zone !== VESSEL)) continue;
    const ang = rg.range(0, L.TAU), off = rg.range(2.5, 5.5) * (c.r > 30 ? 1.4 : 1);
    gg.strokeStyle = L.rgba(TEAL, rg.range(0.2, 0.42)); gg.lineWidth = rg.range(2.4, 4);
    lumenPath(gg, c, Math.cos(ang) * off, Math.sin(ang) * off); gg.stroke();
  }
  const ghostB = L.blurred(ghost, 2.4), gb = ghostB.getContext('2d');
  gb.globalCompositeOperation = 'destination-in'; gb.drawImage(M, 0, 0);
  g.drawImage(ghostB, X0, Y0);

  // 3) uneven staining + fine granularity (same hue, only value/saturation move)
  L.overlayOn(T, L.noiseTex(LW, LH, { seed: 's32stain', scale: 170, octaves: 3, warp: 0.6, res: 0.2, contrast: 1.5, ramp: [[0, '#56706c'], [0.5, '#808080'], [1, '#a9a39a']] }), { blend: 'soft-light', alpha: 0.55 });
  L.overlayOn(T, L.noiseTex(LW, LH, { seed: 's32fine', scale: 7, octaves: 2, res: 0.4, contrast: 1.7 }), { blend: 'soft-light', alpha: 0.22 });

  // the phloem of every bundle glows: thin walls, dense contents, the brightest stain on the slide
  g.save(); skin(g, true); g.clip(); g.globalCompositeOperation = 'screen';
  for (const b of bundles) {
    g.fillStyle = L.radial(g, b.x, b.y, 0, b.hw * 0.95, [[0, 'rgba(60,236,196,0.34)'], [0.55, 'rgba(40,220,184,0.16)'], [1, 'rgba(40,220,184,0)']]);
    g.fillRect(b.x - b.hw, b.y - b.hw, b.hw * 2, b.hw * 2);
  }
  g.restore();

  // 4) section thickness: the walls' own blurred shadow falls into the lumina (a tight one and a wide one)
  const op = L.makeCanvas(LW, LH), og = op.getContext('2d');
  og.fillStyle = '#0b4444'; og.fillRect(0, 0, LW, LH); og.drawImage(T, 0, 0);
  L.overlayOn(T, L.blurred(op, 2.6), { blend: 'multiply', alpha: 0.3 });
  L.overlayOn(T, L.blurred(op, 10), { blend: 'multiply', alpha: 0.2 });
  tm.push('shade ' + (performance.now() - T0).toFixed(0));

  // 5) on the slide: cream field, a soft shadow and a bright diffraction line hugging the skin
  const [C, cg] = mk();
  cg.fillStyle = BG; cg.fillRect(X0, Y0, LW, LH);
  cg.save(); cg.shadowColor = 'rgba(44,50,120,0.3)'; cg.shadowBlur = 12; cg.strokeStyle = 'rgba(44,50,120,0.08)'; cg.lineWidth = 8; skin(cg, false, 1); cg.stroke(); cg.restore();
  cg.save(); cg.shadowColor = 'rgba(255,253,244,0.9)'; cg.shadowBlur = 2; cg.strokeStyle = 'rgba(255,253,244,0.85)'; cg.lineWidth = 2.2; skin(cg, false, -2.4); cg.stroke(); cg.restore();
  cg.drawImage(T, X0, Y0);
  // halation: the bright lumina bleed a little over their walls
  cg.save(); cg.setTransform(1, 0, 0, 1, 0, 0); cg.globalCompositeOperation = 'screen'; cg.globalAlpha = 0.16; cg.drawImage(L.blurred(C, 7), 0, 0); cg.restore();

  // 6) lens: chromatic fringes, a breath of overall softness, field curvature toward the edges
  const fx = a.cx - 30 - X0, fy = a.crestY + 90 - Y0;
  const CA = chroma(C, fx, fy, 1.003, 1.3, 2.0, 1.0);
  const sharp = L.blurred(CA, 0.8), sg = sharp.getContext('2d');
  const dofMask = (cv, r0, r1) => {
    const m = cv.getContext('2d');
    m.save(); m.globalCompositeOperation = 'destination-in';
    m.translate(fx, fy); m.scale(1, 0.7);
    m.fillStyle = L.radial(m, 0, 0, r0, r1, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]);
    m.fillRect(-LW * 2, -LH * 3, LW * 4, LH * 6);
    m.restore();
    return cv;
  };
  sg.drawImage(dofMask(L.blurred(CA, 2), 330, 760), 0, 0);
  sg.drawImage(dofMask(L.blurred(CA, 4.2), 640, 1150), 0, 0);
  tm.push('lens ' + (performance.now() - T0).toFixed(0));

  // 7) the illumination: bright in the middle of the field, falling off and warming a touch toward the corners.
  //    It is baked into the slide layer (the stage only moves a few px) and into the static field behind it.
  const illum = L.makeCanvas(W + PAD * 2, H + PAD * 2), ig = illum.getContext('2d');
  ig.translate(PAD, PAD);
  ig.fillStyle = L.radial(ig, 985, 480, 300, 1380, [[0, '#fdfbf8'], [0.5, '#f8f5f0'], [1, '#e6dfd8']]);
  ig.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
  ig.globalCompositeOperation = 'multiply'; ig.globalAlpha = 0.5;
  ig.drawImage(L.noiseTex(W + PAD * 2, H + PAD * 2, { seed: 's32field', scale: 420, octaves: 2, res: 0.15, ramp: [[0, '#f4f0ea'], [1, '#ffffff']] }), -PAD, -PAD);
  ig.globalAlpha = 1; ig.globalCompositeOperation = 'source-over';
  sg.save(); sg.globalCompositeOperation = 'multiply'; sg.drawImage(illum, X0 + PAD, Y0 + PAD, LW, LH, 0, 0, LW, LH); sg.restore();
  const back = L.makeCanvas(W, H), bg = back.getContext('2d');
  bg.fillStyle = BG; bg.fillRect(0, 0, W, H);
  bg.globalCompositeOperation = 'multiply'; bg.drawImage(illum, -PAD, -PAD);

  const feather = (cv) => {
    const m = cv.getContext('2d');
    m.save(); m.setTransform(1, 0, 0, 1, 0, 0); m.globalCompositeOperation = 'destination-in';
    m.fillStyle = L.linear(m, 0, 0, 0, 16, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]);
    m.fillRect(0, 0, LW, LH);
    m.restore();
    return cv;
  };
  const soft = feather(L.blurred(sharp, 4));
  feather(sharp);

  // 8) rim light: a thin bright crescent on the wall at the upper-left of every lumen (shimmers in draw)
  const [rimC, rmg] = mk();
  rmg.drawImage(M, X0 - 2, Y0 - 2.6);
  rmg.globalCompositeOperation = 'source-in'; rmg.fillStyle = '#e4ffd6'; rmg.fillRect(X0, Y0, LW, LH);
  rmg.globalCompositeOperation = 'destination-out'; rmg.drawImage(M, X0, Y0);
  const rim = L.blurred(rimC, 0.8);
  tm.push('fin ' + (performance.now() - T0).toFixed(0));

  const bmp = await Promise.all([sharp, soft, rim, back].map((c) => createImageBitmap(c)));
  tm.push('bmp ' + (performance.now() - T0).toFixed(0));
  console.warn('s32 init: ' + tm.join(' | '));
  return { sharp: bmp[0], soft: bmp[1], rim: bmp[2], back: bmp[3], X0, Y0 };
}

export default {
  name: '药材显微·茎横切',
  tone: 'dark',
  async init(env) { S = await build(env); },
  draw(ctx, env, p) {
    ctx.drawImage(S.back, 0, 0);
    // the stage drifts a few pixels along the arc while the objective creeps in; zoom straddles 1 so the arc stays put
    const rot = L.lerp(-0.0035, 0.0035, p), zoom = L.lerp(0.989, 1.011, p);
    const blur = (1 - sstep(0, 0.55, p)) * 0.92;                       // focus: slightly soft → sharp
    const tw = 0.3 + 0.28 * Math.sin(env.frame * 2.2 + 0.7);           // wall rims shimmer
    L.cam(ctx, env, { rot, zoom }, () => {
      ctx.drawImage(S.sharp, S.X0, S.Y0);
      if (blur > 0.01) { ctx.globalAlpha = blur; ctx.drawImage(S.soft, S.X0, S.Y0); }
      else { ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = tw; ctx.drawImage(S.rim, S.X0, S.Y0); ctx.globalCompositeOperation = 'source-over'; }
      ctx.globalAlpha = 1;
    });
  },
};
