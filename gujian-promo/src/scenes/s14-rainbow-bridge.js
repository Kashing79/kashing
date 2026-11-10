// s14 — 虹桥. A detail of a Song handscroll (the manner of《清明上河图》) painted in ink and thin colour on old silk:
// the arc is the deck edge of the pier-less timber "rainbow bridge" — a heavy brush line on top of the edge board.
// Below it the woven arch (编木拱): straight logs of two interleaved systems, each one butting a cross-beam at its ends and
// ducking UNDER the next cross-beam at its middle, rope-lashed at every joint — a faceted arc, never one bent beam.
// On the deck a small procession (stall under a sunshade, porter, parasol, donkey rider, sedan chair …) behind a
// two-rail timber balustrade; under the arch the river's ink ripples and a boat with its mast lowered.
// Three paint sheets (bridge / figures / near railing) are painted as flat washes + ink line, aged (mottled pigment, flaking,
// silk weave, tide lines, mildew, roll creases), then blit with a slow rot; the procession drifts a few px further along the deck.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 130;
const LW = W + PAD * 2, LH = H + PAD * 2;
let S = null;

const C = {
  base: '#e6d6ae',       // fresh silk under the paint; the multiply "aging" sheet brings it down to ≈ #d8c49a
  wood: '#8a5a34', woodPale: '#a97c4a', woodInk: '#6b5a45',
  ink: '#2b2620', blue: '#4b6a78', red: '#b5553a',
  white: '#f3ead4', flesh: '#e9c9a2', straw: '#c4a15c', grey: '#8f8572', donkey: '#7c7265', earth: '#b79a66',
};

// ───────────────────────── geometry helpers ─────────────────────────
/** Catmull-Rom resample that keeps the control-point parameter: [[x, y, t]…], t = segment index + fraction */
function spline(pts, step = 3, closed = false) {
  const m = pts.length, out = [];
  const P = (i) => (closed ? pts[((i % m) + m) % m] : pts[Math.max(0, Math.min(m - 1, i))]);
  const segs = closed ? m : m - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        i + t,
      ]);
    }
  }
  if (!closed) out.push([pts[m - 1][0], pts[m - 1][1], m - 1]);
  return out;
}
/** a tapered ribbon around a polyline: widths per control point (or [start, end]) → two edges + closed polygon */
function ribbon(pts, widths, step) {
  const sp = spline(pts, step), n = sp.length, A = [], B = [];
  const two = widths.length === 2 && pts.length !== 2;
  const wAt = (t) => {
    if (two) return L.lerp(widths[0], widths[1], t / (pts.length - 1));
    const i = Math.min(widths.length - 2, Math.floor(t));
    return L.lerp(widths[i], widths[i + 1], t - i);
  };
  for (let i = 0; i < n; i++) {
    const a = sp[Math.max(0, i - 1)], b = sp[Math.min(n - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const mm = Math.hypot(nx, ny) || 1; nx /= mm; ny /= mm;
    const hw = wAt(sp[i][2]) / 2;
    A.push([sp[i][0] + nx * hw, sp[i][1] + ny * hw]); B.push([sp[i][0] - nx * hw, sp[i][1] - ny * hw]);
  }
  return { A, B, poly: A.concat(B.slice().reverse()) };
}
const ell = (cx, cy, rx, ry, n = 20, rot = 0) => {
  const o = [], c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) { const t = (i / n) * L.TAU, x = Math.cos(t) * rx, y = Math.sin(t) * ry; o.push([cx + x * c - y * s, cy + x * s + y * c]); }
  return o;
};
const loop = (pts) => pts.concat([pts[0]]);

// ───────────────────────── the painter: flat wash + ink line on two sheets ─────────────────────────
/**
 * Every shape is a wash (opaque: pigment already mixed with the silk colour) plus brush lines on a separate ink sheet.
 * A later wash knocks out the ink underneath it, so things painted later properly hide what is behind them.
 */
function makePen(seed0) {
  const wash = L.makeLayer(PAD), ink = L.makeLayer(PAD);
  const gw = wash.getContext('2d'), gi = ink.getContext('2d');
  let n = 0;
  const trace = (g, pts) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); };
  const pen = {
    wash, ink, gw, gi, k: 1, lw: 1,
    /** run fn inside a local transform; k = the transform's scale (keeps stroke sampling sensible) */
    scope(setup, k, fn) { gw.save(); gi.save(); const k0 = pen.k; setup(gw); setup(gi); pen.k = k0 * k; fn(); pen.k = k0; gw.restore(); gi.restore(); },
    clip(path, fn) { gw.save(); gi.save(); path(gw); gw.clip(); path(gi); gi.clip(); fn(); gw.restore(); gi.restore(); },
    /** wash. path = [[x,y]…] or (ctx) => {…build path…}; a = pigment strength over the silk */
    fill(path, color, a = 0.8, o = {}) {
      let p = path;
      if (typeof path !== 'function') { const pts = o.smooth ? spline(path, 2.5 / pen.k, true) : path; p = (g) => trace(g, pts); }
      gi.save(); gi.globalCompositeOperation = 'destination-out'; gi.fillStyle = '#000'; p(gi); gi.fill(); gi.restore();
      gw.fillStyle = o.style || L.mix(C.base, color, a); p(gw); gw.fill();
    },
    /** a second, translucent glaze over an existing wash (shading) — does not disturb the ink */
    tint(path, style) {
      const p = typeof path === 'function' ? path : (g) => trace(g, path);
      gw.fillStyle = style; p(gw); gw.fill();
    },
    /** brush line */
    line(pts, w = 1, o = {}) {
      L.inkStroke(gi, pts, {
        width: w * pen.lw, color: o.color || C.ink, seed: seed0 + (n++), taper: o.taper || [0.08, 0.14],
        wobble: o.wobble === undefined ? 0.3 : o.wobble, dry: o.dry || 0, alpha: o.alpha === undefined ? 0.94 : o.alpha, smoothStep: (o.step || 3) / pen.k,
      });
    },
    /** sharp-cornered outline: one stroke per side (inkStroke would round the corners of a closed polygon) */
    poly(pts, w = 1, o = {}) {
      for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; pen.line([[p[0] - (q[0] - p[0]) * 0.03, p[1] - (q[1] - p[1]) * 0.03], [q[0] + (q[0] - p[0]) * 0.03, q[1] + (q[1] - p[1]) * 0.03]], w, { taper: [0.03, 0.03], ...o }); }
    },
    /** tapered limb / pole: wash + an ink line down each side */
    tube(pts, widths, color, a = 0.8, lw = 1, o = {}) {
      const t = ribbon(pts, widths, 2.5 / pen.k);
      pen.fill(t.poly, color, a);
      if (lw > 0) { pen.line(t.A, lw, o); pen.line(t.B, lw, o); }
      return t;
    },
  };
  return pen;
}

// ───────────────────────── the woven arch ─────────────────────────
function ribGeom(a) {
  const TL = 40, DB = 50, FAS = 44;                 // log thickness, cross-beam diameter, depth of the deck-edge board
  const DRC = -(FAS + 4 + DB / 2);                  // centre of the cross-beams = centreline of the log ends
  const SAG = TL / 2 + DB / 2;                      // a straight log must dip this far to pass under the next cross-beam
  const DEL = Math.acos(1 - SAG / (a.R + DRC));     // → angular spacing of the joints
  /** dr of the centreline of the log whose middle sits at joint j (it spans joints j-1 … j+1) */
  const chord = (th, j) => ((a.R + DRC) * Math.cos(DEL)) / Math.cos(th - j * DEL) - a.R;
  const pair = (th) => { const j = Math.floor(th / DEL); return [chord(th, j), chord(th, j + 1)]; };
  const lowDr = (th) => { const p = pair(th); return Math.min(p[0], p[1]) - TL / 2; };
  const upDr = (th) => { const p = pair(th); return Math.max(p[0], p[1]) + TL / 2; };
  return { TL, DB, FAS, DRC, SAG, DEL, chord, lowDr, upDr };
}

function paintBack(env, pen) {
  const a = env.arc, R = a.R;
  const sp = a.span(PAD + 260);
  const Pt = (th, dr) => { const q = a.pt(th, dr); return [q.x, q.y]; };
  const r = L.rng('s14back');
  const G = ribGeom(a);
  const { gw } = pen;

  // ── river: thin 花青 wash, deeper in the shade of the arch
  const below = (dr) => (c) => {
    c.beginPath();
    for (let i = 0; i <= 80; i++) { const p = Pt(L.lerp(-sp, sp, i / 80), dr); if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }
    c.lineTo(W + PAD + 400, H + PAD + 60); c.lineTo(-PAD - 400, H + PAD + 60); c.closePath();
  };
  pen.fill(below(-90), null, 0, {
    style: L.radial(gw, a.cx, a.cy, R - 560, R - 120, [[0, L.mix(C.base, C.blue, 0.17)], [0.6, L.mix(C.base, C.blue, 0.26)], [0.9, L.mix(C.base, L.mix(C.blue, C.ink, 0.2), 0.36)], [1, L.mix(C.base, L.mix(C.blue, C.ink, 0.3), 0.46)]]),
  });
  // ripples: long, level brush lines that swell and thin
  const wcol = L.mix(C.ink, C.blue, 0.32);
  for (let y = a.crestY + 150; y < H + PAD; y += r.range(22, 31)) {
    let x = -PAD - r.range(0, 260);
    while (x < W + PAD) {
      const len = r.range(170, 520), amp = r.range(3, 7.5), wl = r.range(100, 180), ph = r.range(0, L.TAU), tilt = r.range(-7, 7);
      const pts = [];
      for (let u = 0; u <= len; u += 20) pts.push([x + u, y + amp * Math.sin(ph + (u / wl) * L.TAU) + (u / len - 0.5) * tilt]);
      pen.line(pts, r.range(2.3, 3.8), { color: wcol, alpha: r.range(0.66, 0.96), taper: [0.25, 0.35], step: 6 });
      x += len + r.range(30, 150);
    }
  }
  boat(env, pen, r);
  willow(pen, L.rng('s14willowL'), 20, 860, { h: 640, lean: 46, w: 56, stubs: 4, shoots: 14 });
  willow(pen, L.rng('s14willowR'), 1934, 860, { h: 600, lean: -52, w: 50, stubs: 4, shoots: 13 });

  // ── bridge silhouette: everything between the arc and the underside of the lowest logs (dark gaps between the timbers)
  const NS = 280;
  const silh = (c) => {
    c.beginPath();
    for (let i = 0; i <= NS; i++) { const p = Pt(L.lerp(-sp, sp, i / NS), 0); if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }
    for (let i = NS; i >= 0; i--) { const th = L.lerp(-sp, sp, i / NS); const p = Pt(th, G.lowDr(th) + 1); c.lineTo(p[0], p[1]); }
    c.closePath();
  };
  pen.fill(silh, L.mix(C.ink, C.wood, 0.22), 0.86);
  // a second row of logs glimpsed in the gaps
  for (const d of [-G.FAS - 12, -G.FAS - 27]) pen.line(L.arcPts(a, d, -sp, sp, 90), 1.6, { alpha: 0.5, taper: [0, 0] });

  // ── the logs: system B (odd joints) lies behind system A (even joints)
  const jmax = Math.ceil(sp / G.DEL) + 1;
  const h = G.TL / 2;
  const drawLog = (j) => {
    const front = j % 2 === 0;
    const A = Pt((j - 1) * G.DEL, G.DRC), B = Pt((j + 1) * G.DEL, G.DRC);
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]), ux = (B[0] - A[0]) / len, uy = (B[1] - A[1]) / len, nx = -uy, ny = ux;
    const q = (t, o) => [A[0] + ux * t + nx * o, A[1] + uy * t + ny * o];      // t along the log, o across (+ = toward the water)
    const run = (o, t0 = 8, t1 = len - 8, jit = 0.9) => { const pts = []; const n = Math.round((t1 - t0) / 70); for (let i = 0; i <= n; i++) pts.push(q(L.lerp(t0, t1, i / n), o + r.range(-jit, jit))); return pts; };
    const col = front ? L.mix(C.wood, C.woodPale, 0.5) : L.mix(C.woodInk, C.ink, 0.12);
    pen.fill([q(8, -h), q(len - 8, -h), q(len - 8, h), q(8, h)], col, front ? 0.8 : 0.84);
    // roundness: a paler crown, a darker belly
    pen.tint([q(8, -h + 3), q(len - 8, -h + 3), q(len - 8, -h * 0.25), q(8, -h * 0.25)], L.rgba(C.base, front ? 0.2 : 0.13));
    pen.tint([q(8, h * 0.3), q(len - 8, h * 0.3), q(len - 8, h), q(8, h)], L.rgba(C.ink, 0.2));
    // grain
    for (let i = 0; i < 5; i++) {
      const o = r.range(-h * 0.72, h * 0.72); let t = r.range(20, 140);
      while (t < len - 80) {
        const l = r.range(70, 280), t1 = Math.min(len - 14, t + l);
        pen.line([q(t, o), q((t + t1) / 2, o + r.range(-2.2, 2.2)), q(t1, o + r.range(-1.5, 1.5))], r.range(1.0, 1.9), { alpha: r.range(0.35, 0.62), taper: [0.3, 0.4] });
        t += l + r.range(30, 170);
      }
    }
    // a knot or two
    for (let i = 0; i < 2; i++) {
      const c = q(r.range(60, len - 60), r.range(-h * 0.4, h * 0.4));
      pen.line(loop(ell(c[0], c[1], r.range(5, 8), r.range(2.4, 3.6), 10, Math.atan2(uy, ux))), 1.3, { alpha: 0.55 });
    }
    pen.line(run(-h), 4.0, { taper: [0.01, 0.01] });
    pen.line(run(h), 4.8, { taper: [0.01, 0.01] });
  };
  for (let j = -jmax; j <= jmax; j++) if (j % 2 !== 0) drawLog(j);
  for (let j = -jmax; j <= jmax; j++) if (j % 2 === 0) drawLog(j);

  // ── rope lashings: beside every cross-beam (binding the butting log to the one passing beneath) and where the two systems cross
  const lash = (th0, wraps, pitch) => {
    const rr = R + G.DRC;
    const wpts = (th) => { const t = Pt(th, G.upDr(th) + 3), b = Pt(th, G.lowDr(th) - 3); return [t, [(t[0] + b[0]) / 2 + 2.5, (t[1] + b[1]) / 2], b]; };
    const e0 = wpts(th0 - (pitch * 0.6) / rr), e1 = wpts(th0 + ((wraps - 1) * pitch + pitch * 0.6) / rr);
    pen.fill([e0[0], e1[0], e1[2], e0[2]], C.straw, 0.72);
    for (let m = -0.5; m < wraps; m++) pen.line(wpts(th0 + ((m + 0.1) * pitch) / rr), 2.6, { taper: [0.06, 0.06], alpha: 0.92 });
    for (let m = 0; m < wraps; m++) { const t = wpts(th0 + ((m - 0.25) * pitch) / rr), b = wpts(th0 + ((m + 0.35) * pitch) / rr); pen.line([t[0], b[1]], 1.1, { alpha: 0.5 }); pen.line([t[1], b[2]], 1.1, { alpha: 0.5 }); }
  };
  for (let j = -jmax; j <= jmax; j++) {
    const th = j * G.DEL, off = (G.DB / 2 + 15) / (R + G.DRC);
    lash(th + off, 3, 9);
    lash(th - off - 18 / (R + G.DRC), 3, 9);
    lash(th + G.DEL / 2 - 9 / (R + G.DRC), 2, 9);
  }

  // ── cross-beam ends (横木): round log heads with growth rings
  for (let j = -jmax; j <= jmax; j++) {
    const c = Pt(j * G.DEL, G.DRC), rad = G.DB / 2;
    pen.fill(ell(c[0], c[1], rad, rad, 30), L.mix(C.woodPale, C.straw, 0.55), 0.88);
    pen.tint((g) => { g.beginPath(); g.arc(c[0], c[1], rad, 0, L.TAU); g.arc(c[0] - 5, c[1] - 6, rad * 0.92, 0, L.TAU, true); }, L.rgba(C.ink, 0.26));
    pen.line(loop(ell(c[0], c[1], rad - 1.2, rad - 1.2, 22, r.range(0, 6))), 4.0, { taper: [0.02, 0.02], step: 4 });
    pen.line(loop(ell(c[0] + 0.8, c[1] + 0.5, rad * 0.62, rad * 0.6, 16, r.range(0, 6))), 1.5, { alpha: 0.6, taper: [0.1, 0.2] });
    pen.line(loop(ell(c[0] + 1.2, c[1] + 0.8, rad * 0.32, rad * 0.3, 12, r.range(0, 6))), 1.3, { alpha: 0.55, taper: [0.1, 0.2] });
    pen.fill(ell(c[0] + 1.4, c[1] + 1, 2.2, 2.2, 8), C.ink, 0.8);
    const ca = r.range(0, L.TAU);
    pen.line([[c[0] + Math.cos(ca) * 5, c[1] + Math.sin(ca) * 5], [c[0] + Math.cos(ca + 0.15) * (rad - 3), c[1] + Math.sin(ca + 0.15) * (rad - 3)]], 1.4, { alpha: 0.7 });
  }

  // ── the deck seen from slightly above: a pale band of trodden earth behind the near edge
  pen.fill((c) => a.pathBand(c, 92, 0, -sp, sp), null, 0, { style: L.radial(gw, a.cx, a.cy, R, R + 92, [[0, L.mix(C.base, C.white, 0.45)], [0.1, L.mix(C.base, C.earth, 0.3)], [0.5, L.mix(C.base, C.earth, 0.36)], [1, C.base]]) });
  for (let i = 0; i < 90; i++) {
    const th = r.range(-sp, sp), d = r.range(8, 66), l = r.range(40, 160) / R;
    pen.line([Pt(th, d), Pt(th + l / 2, d + r.range(-1.5, 1.5)), Pt(th + l, d)], r.range(1, 2), { alpha: r.range(0.14, 0.3), taper: [0.3, 0.4] });
  }

  // ── deck-edge board: the long plank the railing stands on
  pen.fill((c) => a.pathBand(c, 0, -G.FAS, -sp, sp), L.mix(C.wood, C.woodPale, 0.7), 0.82);
  pen.tint((c) => a.pathBand(c, -G.FAS * 0.55, -G.FAS, -sp, sp), L.rgba(C.ink, 0.17));
  for (let i = 0; i < 70; i++) {
    const th = r.range(-sp, sp), d = -r.range(12, G.FAS - 6), l = r.range(60, 300) / R;
    pen.line([Pt(th, d), Pt(th + l / 2, d + r.range(-1.6, 1.6)), Pt(th + l, d + r.range(-1, 1))], r.range(0.9, 1.7), { alpha: r.range(0.3, 0.55), taper: [0.3, 0.4] });
  }
  // scarf joints + iron nail heads
  for (let th = -sp + 0.07; th < sp; th += 0.236) {
    pen.line([Pt(th, -9), Pt(th + 0.008, -G.FAS + 3)], 2.2, { alpha: 0.85 });
    for (const dd of [-16, -34]) for (const sx of [-0.011, 0.02]) { const c = Pt(th + sx, dd); pen.fill(ell(c[0], c[1], 2.6, 2.6, 8), C.ink, 0.8); }
  }
  pen.line(L.arcPts(a, -G.FAS, -sp, sp, 110), 4.6, { taper: [0, 0], wobble: 0.3 });
  pen.line(L.arcPts(a, -G.FAS * 0.52, -sp, sp, 110), 1.9, { taper: [0, 0], alpha: 0.6 });
  // THE ARC: one heavy brush line whose upper edge is the arc itself
  pen.line(L.arcPts(a, -6, -sp, sp, 150), 12, { taper: [0, 0], wobble: 0.12 });
}

/**
 * a pollarded spring willow on the far bank, in pale ink: a gnarled leaning trunk, a fist of knobby stubs,
 * and from every knob a spray of thin new shoots that spring upward, arch over and hang
 */
function willow(pen, r, x0, y0, o) {
  const { h = 480, lean = 40, w = 46, stubs = 4, shoots = 14 } = o;
  const col = L.mix(C.woodInk, C.ink, 0.25), leaf = L.mix(C.blue, '#8f9a4e', 0.5), sd = Math.sign(lean) || 1;
  const tp = [[x0, y0], [x0 + lean * 0.15 + 14 * sd, y0 - h * 0.3], [x0 + lean * 0.7 - 12 * sd, y0 - h * 0.66], [x0 + lean, y0 - h]];
  const trunk = pen.tube(tp, [w, w * 0.86, w * 0.74, w * 0.8], col, 0.46, 3, { alpha: 0.72 });
  for (let i = 0; i < 34; i++) {       // bark: short broken strokes down the trunk
    const k = Math.floor(r.range(0.05, 0.92) * trunk.A.length), t = r.range(0.12, 0.88);
    const p = [L.lerp(trunk.A[k][0], trunk.B[k][0], t), L.lerp(trunk.A[k][1], trunk.B[k][1], t)];
    pen.line([p, [p[0] + r.range(-4, 4), p[1] - r.range(12, 34)]], r.range(1.6, 3.2), { alpha: r.range(0.3, 0.6), taper: [0.2, 0.5] });
  }
  const top = tp[3], heads = [[top, -Math.PI / 2]];
  for (let i = 0; i < stubs; i++) {
    const ang = L.lerp(-2.62, -0.52, i / (stubs - 1)) + r.range(-0.12, 0.12), len = r.range(50, 96);
    const tip = [top[0] + Math.cos(ang) * len, top[1] + Math.sin(ang) * len];
    const mid = [(top[0] + tip[0]) / 2 + r.range(-8, 8), (top[1] + tip[1]) / 2 + r.range(-8, 8)];
    pen.tube([top, mid, tip], [w * 0.62, w * 0.44, w * 0.36], col, 0.46, 2.6, { alpha: 0.72 });
    heads.push([tip, ang]);
  }
  for (const [c] of heads) {
    const knob = ell(c[0], c[1], w * 0.27, w * 0.23, 9, r.range(0, 3)).map((q) => [q[0] + r.range(-3.5, 3.5), q[1] + r.range(-3.5, 3.5)]);
    pen.fill(knob, col, 0.5, { smooth: true });
    pen.line(knob.slice(0, 6), 2.2, { alpha: 0.66 }); pen.line(knob.slice(5).concat([knob[0]]), 1.8, { alpha: 0.55 });
    pen.line([[c[0] - 4, c[1] + 2], [c[0] + 1, c[1] - 3], [c[0] + 5, c[1] + 1]], 1.6, { alpha: 0.5 });
  }
  for (const [c, ang] of heads) for (let k = 0; k < shoots; k++) {
    let th = ang + r.range(-1.05, 1.05), x = c[0] + r.range(-7, 7), y = c[1] + r.range(-7, 7);
    const len = r.range(190, 400), bend = r.range(0.03, 0.065), pts = [[x, y]];
    for (let d = 0; d < len; d += 14) {
      let dv = Math.PI / 2 - th; while (dv > Math.PI) dv -= L.TAU; while (dv < -Math.PI) dv += L.TAU;   // turn toward "straight down", the short way round
      th += dv * bend * (1 + d / 110);
      x += Math.cos(th) * 14; y += Math.sin(th) * 14; pts.push([x, y]);
    }
    pen.line(pts, r.range(1.4, 2.3), { alpha: r.range(0.42, 0.66), taper: [0.02, 0.5], step: 7 });
    for (let m = 3; m < pts.length; m++) {
      if (!r.chance(0.85)) continue;
      const q = pts[m], sg = r.sign(), big = m / pts.length;      // leaves thicken toward the hanging tips
      pen.line([[q[0], q[1]], [q[0] + sg * r.range(4, 9), q[1] + r.range(7, 13)]], r.range(2.6, 4) + big * 1.6, { color: leaf, alpha: r.range(0.5, 0.82), taper: [0.1, 0.6] });
    }
  }
}

/** canal boat sliding under the arch: mat-roofed cabin, A-frame mast lowered onto its crutch, two boatmen */
function boat(env, pen, r) {
  const top = [[190, 1290], [270, 1120], [360, 1026], [520, 968], [740, 938], [1010, 930], [1230, 946], [1390, 996], [1490, 1100], [1540, 1290]];
  const sp = spline(top, 6);
  const roofY = (x) => { for (let i = 1; i < sp.length; i++) if (sp[i][0] >= x) return L.lerp(sp[i - 1][1], sp[i][1], (x - sp[i - 1][0]) / (sp[i][0] - sp[i - 1][0] || 1)); return sp[sp.length - 1][1]; };
  const path = (c) => { c.beginPath(); sp.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); };
  pen.fill(path, L.mix(C.straw, C.woodPale, 0.3), 0.78);
  pen.clip(path, () => {
    pen.tint((g) => { g.beginPath(); g.rect(100, 1000, 1500, 400); }, L.linear(pen.gw, 0, 960, 0, 1220, [[0, L.rgba(C.ink, 0)], [1, L.rgba(C.ink, 0.3)]]));
    // woven bamboo mat
    for (let x = -60; x < 1700; x += 19) {
      pen.line([[x, 900], [x + 215, 1260]], 1.3, { alpha: 0.42, taper: [0, 0] });
      pen.line([[x + 215, 900], [x, 1260]], 1.3, { alpha: 0.42, taper: [0, 0] });
    }
    // battens following the roof
    for (const off of [26, 74, 128]) pen.line(sp.filter((_, i) => i % 6 === 0).map((p) => [p[0], p[1] + off]), 3.2, { taper: [0, 0], alpha: 0.9 });
    for (let x = 330; x < 1500; x += 168) { const y = roofY(x); pen.line([[x, y + 4], [x - 7, y + 80], [x - 16, y + 180]], 3.4, { taper: [0, 0] }); pen.line([[x + 11, y + 4], [x + 5, y + 80], [x - 3, y + 180]], 1.6, { taper: [0, 0], alpha: 0.7 }); }
  });
  pen.line(top, 5.2, { taper: [0, 0], wobble: 0.22, step: 6 });

  // mast crutch + the lowered A-frame mast
  const cr = [1068, roofY(1068)];
  pen.tube([[cr[0], cr[1] + 2], [cr[0] + 2, cr[1] - 104]], [14, 11], C.wood, 0.78, 2.6, { taper: [0.02, 0.02] });
  pen.line([[cr[0] - 12, cr[1] - 112], [cr[0] + 2, cr[1] - 98], [cr[0] + 17, cr[1] - 116]], 4.2, { taper: [0.05, 0.05] });
  const m0 = [610, roofY(610) - 6], m1 = [676, roofY(676) - 8], mt = [1262, 778];
  pen.tube([m0, [(m0[0] + mt[0]) / 2, (m0[1] + mt[1]) / 2 + 5], mt], [15, 13, 9], L.mix(C.wood, C.woodInk, 0.5), 0.8, 2.6, { taper: [0.02, 0.02] });
  pen.tube([m1, [(m1[0] + mt[0]) / 2 + 6, (m1[1] + mt[1]) / 2 - 4], [mt[0] + 8, mt[1] - 3]], [15, 13, 9], L.mix(C.wood, C.woodPale, 0.35), 0.8, 2.8, { taper: [0.02, 0.02] });
  // rungs lashing the two legs together
  for (const t of [0.2, 0.36, 0.52, 0.68, 0.84]) {
    const x = L.lerp(m1[0], mt[0], t), y = L.lerp(m1[1], mt[1], t);
    pen.line([[x - 8, y - 10], [x + 2, y + 2], [x - 6, y + 13]], 2.6, { taper: [0.05, 0.05] });
  }
  // masthead block and stays
  pen.fill([[mt[0] - 6, mt[1] - 12], [mt[0] + 20, mt[1] - 18], [mt[0] + 24, mt[1] - 2], [mt[0] - 2, mt[1] + 6]], C.woodInk, 0.85);
  pen.poly([[mt[0] - 6, mt[1] - 12], [mt[0] + 20, mt[1] - 18], [mt[0] + 24, mt[1] - 2], [mt[0] - 2, mt[1] + 6]], 2.4);
  for (const e of [[1425, roofY(1425) + 8], [1560, 1130], [1730, 1210], [940, roofY(940)], [800, roofY(800)]]) {
    const mid = [(mt[0] + 14 + e[0]) / 2, (mt[1] - 6 + e[1]) / 2 + 12];
    pen.line([[mt[0] + 14, mt[1] - 6], mid, e], 1.9, { taper: [0.02, 0.02], alpha: 0.85, step: 6 });
  }

  // boatmen on the cabin roof: one fends the bridge off with a pole, one hauls on a stay
  pen.scope((g) => { g.translate(520, roofY(520) + 3); g.scale(-1.34, 1.34); }, 1.34, () => {
    laborer(pen, { jacket: C.white, pants: C.grey, sash: C.red, hat: 'jin', lean: 9, st: 10,
      armFar: [[-4, -77], [4, -86], [13, -95]], armNear: [[4, -77], [12, -80], [19, -90]],
      mid: () => pen.tube([[-22, -34], [16, -92], [58, -152]], [2.2, 2, 1.6], C.woodPale, 0.85, 0.7, { taper: [0.02, 0.02] }) });
  });
  pen.scope((g) => { g.translate(1378, roofY(1378) + 3); g.scale(-1.3, 1.3); }, 1.3, () => {
    laborer(pen, { jacket: L.mix(C.blue, C.white, 0.25), pants: C.white, sash: C.ink, hat: 'jin', lean: -8, st: 9,
      armFar: [[-4, -77], [6, -86], [17, -93]], armNear: [[4, -77], [14, -82], [24, -86]] });
  });
}

// ───────────────────────── figures (unit = 1/100 of a standing person; +x = the way they face, −y = up) ─────────────────────────
function shoe(pen, x, y = 0) {
  pen.fill([[x - 3.6, y - 5.2], [x + 2.4, y - 5.4], [x + 6.8, y - 2], [x + 7.5, y - 0.2], [x + 7, y], [x - 3.9, y]], C.ink, 0.86);
}
function arm(pen, pts, widths, color, o = {}) {
  const t = pen.tube(pts, widths, color, 0.86, o.lw || 1.0);
  pen.line([t.A[t.A.length - 1], t.B[t.B.length - 1]], 0.8);
  if (o.hand !== false) {
    const e = pts[pts.length - 1], d = pts[pts.length - 2], dx = e[0] - d[0], dy = e[1] - d[1], m = Math.hypot(dx, dy) || 1;
    const hx = e[0] + (dx / m) * 2.1, hy = e[1] + (dy / m) * 2.1;
    pen.fill(ell(hx, hy, 2.4, 2.1, 10), C.flesh, 0.8);
    pen.line(loop(ell(hx, hy, 2.4, 2.1, 10)), 0.6, { alpha: 0.85 });
  }
}
function head(pen, x, y, o = {}) {
  const hat = o.hat || 'futou';
  const f = (px, py) => [x + px, y + py];
  pen.fill(ell(x + 0.2, y, 5.5, 6.5, 18), C.flesh, 0.8);
  pen.line([f(3.4, -4.8), f(5.3, -1.6), f(6.4, 0.7), f(5.1, 1.8), f(4.7, 4.1), f(2.2, 6.4), f(-1.8, 5.7), f(-4.4, 2.2)], 0.95, { taper: [0.05, 0.2] });
  pen.line([f(1.4, -1.2), f(3.9, -1.6)], 0.85);
  pen.line([f(1.0, -3.0), f(4.3, -3.5)], 0.55, { alpha: 0.75 });
  pen.line([f(3.3, 3.3), f(4.7, 3.1)], 0.5, { alpha: 0.7 });
  pen.line([f(-1.5, -0.8), f(-2.7, 0.9), f(-1.6, 2.5)], 0.6, { alpha: 0.7 });
  if (o.beard) { pen.line([f(4.3, 4.6), f(5.0, 8.6), f(3.6, 12)], 1.1, { taper: [0.1, 0.5] }); pen.line([f(2.4, 5.9), f(2.9, 9.6), f(2.2, 11.5)], 0.9, { taper: [0.1, 0.5] }); pen.line([f(4.6, 2.6), f(6.6, 4.4)], 0.6); }
  if (hat === 'futou' || hat === 'jin') {
    pen.fill([f(5.4, -3.1), f(4.6, -7.1), f(1.0, -9.6), f(-3.4, -10.1), f(-6.6, -8.0), f(-7.3, -3.8), f(-6.3, 0.9), f(-4.4, 1.9), f(-3.2, -2.2), f(0.8, -3.7)], C.ink, 0.9, { smooth: true });
    if (hat === 'futou') {
      pen.line([f(-6.6, -2.6), f(-10.4, -1.8), f(-13.4, 0.8)], 1.5, { taper: [0.05, 0.5] });
      pen.line([f(-6.3, -0.4), f(-9.6, 2.4), f(-11, 5.6)], 1.3, { taper: [0.05, 0.5] });
    } else pen.fill(ell(x - 3.2, y - 10.8, 2.8, 2.1, 10), C.ink, 0.9);
  } else if (hat === 'li') {
    const brim = [f(-13.5, -2.2), f(-4.6, -8.6), f(0.8, -12.4), f(6.2, -8.4), f(14.5, -1.8), f(6, -3.6), f(-5, -3.8)];
    pen.fill(brim, C.straw, 0.85);
    pen.line(brim.slice(0, 5), 1.05, { taper: [0.05, 0.05] });
    pen.line([brim[4], brim[5], brim[6], brim[0]], 0.9);
    pen.line([f(0.8, -12.4), f(-4.2, -4)], 0.5, { alpha: 0.6 }); pen.line([f(0.8, -12.4), f(4.8, -3.8)], 0.5, { alpha: 0.6 });
    pen.line([f(0.8, -12.4), f(-9, -3.2)], 0.45, { alpha: 0.5 }); pen.line([f(0.8, -12.4), f(10, -3)], 0.45, { alpha: 0.5 });
    pen.line([f(2.4, -3.4), f(3.9, 3.4), f(2.6, 6.2)], 0.5, { alpha: 0.6 });
  }
}
/** working man: short jacket, sash, trousers, striding */
function laborer(pen, o = {}) {
  const { jacket = C.white, pants = C.grey, sash = C.blue, hat = 'jin', lean = 5, st = 8, armNear, armFar, beard = false, mid = null } = o;
  const X = ([x, y]) => [x + (y < -42 ? (lean * (-y - 42)) / 58 : 0), y];
  pen.tube([[-1.5, -45], [-5 - st * 0.35, -25], [-7 - st, -5.5]], [9.5, 7, 4.4], L.mix(pants, C.ink, 0.14), 0.82, 1.0);
  shoe(pen, -8.5 - st);
  pen.tube([[2, -45], [6 + st * 0.5, -26], [4.5 + st, -5.5]], [10, 7.4, 4.6], pants, 0.82, 1.0);
  shoe(pen, 3.5 + st);
  if (armFar) arm(pen, armFar.map(X), [6.5, 6, 5], L.mix(jacket, C.ink, 0.14));
  const body = [[-3.2, -84], [-9.4, -79.5], [-11, -62], [-10.2, -48], [-11.6, -38.5], [0, -36.5], [10.8, -39], [9.6, -48], [9.6, -63], [7.8, -79.5], [3.2, -84]].map(X);
  pen.fill(body, jacket, 0.86);
  pen.line(body.slice(0, 5), 1.15, { taper: [0.05, 0.1] });
  pen.line(body.slice(4, 7), 1.05);
  pen.line(body.slice(6), 1.15, { taper: [0.1, 0.05] });
  pen.line([X([3.2, -84]), X([5.6, -72]), X([9.2, -62])], 0.8, { alpha: 0.8 });
  pen.tube([X([-10.8, -48.6]), X([0, -47]), X([10, -48.2])], [3.4, 3.4], sash, 0.82, 0.7);
  pen.line([X([-10.3, -47]), X([-14.4, -42]), X([-13.2, -36.5])], 1.6, { color: L.mix(sash, C.ink, 0.4), taper: [0.05, 0.4] });
  if (mid) mid(X);
  const hp = X([1.5, -91]);
  head(pen, hp[0], hp[1], { hat, beard });
  if (armNear) arm(pen, armNear.map(X), [7, 6.4, 5.2], jacket);
}
/** townsman in a long round-collared robe */
function robed(pen, o = {}) {
  const { robe = C.white, sash = C.ink, hat = 'futou', lean = 0, st = 3, armNear, armFar, beard = false, mid = null } = o;
  const X = ([x, y]) => [x + (lean * -y) / 100, y];
  shoe(pen, -10 - st); shoe(pen, 5 + st);
  if (armFar) arm(pen, armFar.map(X), [8, 9, 9.5], L.mix(robe, C.ink, 0.16));
  const body = [[-3.4, -84], [-9.6, -79.5], [-11.6, -64], [-10.8, -48], [-12.8, -28], [-15 - st, -6.5], [-5, -5], [5, -6.2], [14.5 + st, -4.6], [11.8, -26], [9.8, -46], [9.8, -63], [8, -79.5], [3.4, -84]].map(X);
  pen.fill(body, robe, 0.86);
  pen.line(body.slice(0, 6), 1.2, { taper: [0.05, 0.08] });
  pen.line(body.slice(5, 9), 1.1);
  pen.line(body.slice(8), 1.2, { taper: [0.08, 0.05] });
  pen.line([X([1, -45]), X([3.2, -27]), X([6 + st * 0.5, -8])], 0.85, { alpha: 0.85 });
  pen.line([X([-6, -44]), X([-8.2, -26]), X([-10.5 - st * 0.5, -9])], 0.75, { alpha: 0.75 });
  pen.line([X([6.5, -30]), X([9.5 + st * 0.4, -13])], 0.65, { alpha: 0.65 });
  pen.line([X([-3.4, -83.5]), X([0.2, -81]), X([3.6, -83.4])], 0.85);
  pen.tube([X([-11, -48.8]), X([0, -47.2]), X([10, -48])], [2.8, 2.8], sash, 0.86, 0.6);
  if (mid) mid(X);
  const hp = X([1.5, -91]);
  head(pen, hp[0], hp[1], { hat, beard });
  if (armNear) arm(pen, armNear.map(X), [8.5, 10, 11], robe);
}

/** 挑担: shoulder pole with a basket at each end */
function porter(pen) {
  const basket = (x, cover) => {
    pen.line([[x, -74], [x - 8.8, -45]], 0.65, { alpha: 0.85 }); pen.line([[x, -74], [x + 8.8, -45]], 0.65, { alpha: 0.85 }); pen.line([[x, -74], [x, -46]], 0.5, { alpha: 0.6 });
    if (cover) { const cv = [[x - 9, -45], [x - 6.4, -52.4], [x, -55.6], [x + 6.8, -52], [x + 9, -45]]; pen.fill(cv, cover, 0.74); pen.line(cv, 0.9); }
    const b = [[x - 9.8, -45], [x - 8.4, -30], [x - 6.2, -23.4], [x + 6.2, -23.4], [x + 8.4, -30], [x + 9.8, -45]];
    pen.fill(b, C.straw, 0.84);
    pen.line(b, 1.1, { taper: [0.04, 0.04] });
    pen.line([[x - 9.8, -45], [x + 9.8, -45]], 1.05);
    pen.line([[x - 9.3, -41.4], [x + 9.3, -41.4]], 0.6, { alpha: 0.75 });
    for (let i = -2; i <= 2; i++) pen.line([[x + i * 3.7 - 1.2, -41], [x + i * 3.2 + 1.2, -24.4]], 0.5, { alpha: 0.6 });
    pen.line([[x - 8.7, -34.6], [x + 8.7, -34.6]], 0.5, { alpha: 0.55 });
    pen.line([[x - 7.6, -28.6], [x + 7.6, -28.6]], 0.5, { alpha: 0.55 });
  };
  basket(-43, C.blue);
  laborer(pen, { jacket: C.white, pants: C.grey, sash: C.red, hat: 'li', lean: 6, st: 9,
    armFar: [[-4, -77], [-11, -70], [-15, -78]], armNear: [[4, -77], [12, -71], [17, -78.5]],
    mid: () => pen.tube([[-44, -73], [-22, -79.4], [3, -82.6], [26, -79.8], [46, -73.4]], [1.9, 2.4, 2.7, 2.4, 1.9], C.wood, 0.86, 0.75, { taper: [0.02, 0.02] }) });
  basket(45, null);
}
/** 撑伞: robed townsman under an oil-paper parasol */
function parasolWalker(pen) {
  robed(pen, { robe: C.blue, sash: C.ink, hat: 'futou', st: 3.5, beard: true,
    armFar: [[-3, -77], [-6.5, -62], [-3, -50]], armNear: [[3, -77], [9, -64], [14.5, -70.5]],
    mid: () => {
      pen.line([[15.6, -60], [13.6, -90], [12, -121]], 1.35, { taper: [0.02, 0.02] });
      const top = [[-17, -108.5], [-3.5, -118.6], [12, -123.6], [27.5, -118.6], [41, -108.5]], rim = [[41, -108.5], [27.5, -111.6], [12, -112.8], [-3.5, -111.6], [-17, -108.5]];
      pen.fill(spline(top, 1.2).concat(spline(rim, 1.2)), C.red, 0.72);
      for (const [i, x] of [-10, -3, 5, 12, 19, 27, 34].entries()) pen.line([[12, -123.6], [x, -112.8 + Math.abs(i - 3) * 0.75]], 0.55, { alpha: 0.65 });
      pen.line(top, 1.2); pen.line(rim, 1.0);
      pen.fill(ell(12, -124.8, 1.7, 1.7, 8), C.ink, 0.88);
    } });
}
/** 骑驴: grey donkey at a walk, a bearded rider, and a groom leading it */
function donkeyRider(pen) {
  const G = C.donkey, GD = L.mix(C.donkey, C.ink, 0.3);
  const hoof = (x, y) => pen.fill([[x - 2.2, y - 3.2], [x + 2, y - 3.2], [x + 3, y], [x - 2.8, y]], C.ink, 0.88);
  // far legs
  pen.tube([[22, -41], [28, -27], [30, -13], [33.5, -4.5]], [7.5, 5, 3.4, 3.4], GD, 0.82, 0.95); hoof(34.6, -1.8);
  pen.tube([[-21, -42], [-17, -26], [-11, -12], [-9, -3.2]], [9.5, 5.4, 3.6, 3.4], GD, 0.82, 0.95); hoof(-8.4, 0);
  // tail
  pen.tube([[-31.5, -50.5], [-35.6, -43], [-35.6, -32]], [2.8, 2.2, 1.6], GD, 0.85, 0.8);
  for (const e of [[-36.8, -23], [-34.6, -22.6], [-35.8, -21]]) pen.line([[-35.6, -33], e], 1.2, { taper: [0.05, 0.5] });
  // barrel
  const body = [[-30.5, -51], [-25, -57.2], [-10, -58.2], [1, -57.6], [13, -60], [22, -56], [24, -49], [20.5, -39.5], [3, -33.8], [-15, -35.6], [-26, -39.6], [-32, -45]];
  pen.fill(body, G, 0.82, { smooth: true });
  pen.fill([[-24, -39.4], [-14, -35.8], [3, -34], [19, -39], [8, -40.4], [-10, -40]], C.white, 0.6, { smooth: true });
  // neck + head
  const neck = [[13, -60], [20, -68.5], [27, -77.5], [30.5, -81], [36.5, -79.5], [43.5, -70], [49.5, -60], [51.5, -55.5], [48.5, -52], [42, -57.5], [36, -65], [30, -57], [24.5, -48], [18, -48]];
  pen.fill(neck, G, 0.82);
  pen.fill(ell(48.4, -56, 4.2, 3.7, 12, 0.6), C.white, 0.7);
  // ears
  pen.fill([[33, -81], [33, -91], [35.6, -98], [37.2, -90], [36, -81]], GD, 0.85, { smooth: true });
  pen.line([[33, -81], [33, -91], [35.6, -98], [37.2, -90], [36, -81]], 0.9);
  pen.fill([[29.4, -80], [26, -89], [26.5, -97.4], [30.6, -90], [32.6, -81]], G, 0.85, { smooth: true });
  pen.line([[29.4, -80], [26, -89], [26.5, -97.4], [30.6, -90], [32.6, -81]], 1.0);
  // outlines
  pen.line([[13, -60], [20, -68.5], [27, -77.5], [30, -80.5]], 1.1);
  pen.line([[33.5, -81], [37, -79.2], [43.5, -70], [49.5, -60], [51.5, -55.5], [48.5, -52], [42, -57.5], [36, -65]], 1.15, { taper: [0.05, 0.05] });
  pen.line([[36, -65], [30, -57], [24.5, -48], [22.5, -43]], 1.05);
  pen.line([[-25, -57.2], [-30.5, -51], [-32, -45], [-27, -39.8]], 1.15);
  pen.line([[-25, -57.2], [-10, -58.2], [1, -57.6], [13, -60]], 1.0);
  pen.line([[-26, -39.6], [-15, -35.6], [3, -33.8], [20.5, -39.5]], 1.1);
  for (let i = 0; i <= 8; i++) { const t = i / 8, x = L.lerp(15, 29.5, t), y = L.lerp(-62.5, -80, t); pen.line([[x, y], [x - 2.6, y - 2.6]], 1.25, { taper: [0.05, 0.5] }); }
  pen.fill(ell(40.2, -73.4, 1.25, 0.95, 8), C.ink, 0.9);
  pen.fill(ell(50, -56.2, 0.8, 0.6, 6), C.ink, 0.85);
  pen.line([[48.6, -52.3], [46, -54.6]], 0.6);
  pen.line([[43.2, -69.6], [44.6, -62], [46.6, -56.4]], 0.75); pen.line([[39.4, -62.6], [44.6, -62]], 0.7);   // bridle
  // near legs
  pen.tube([[19, -41], [19.5, -24], [18.5, -10], [19.5, -3]], [8.6, 5.2, 3.6, 3.8], G, 0.82, 1.0); hoof(19.8, 0);
  pen.tube([[-25, -42], [-29.5, -25], [-25.6, -11], [-25, -3]], [10.5, 6, 3.8, 3.8], G, 0.82, 1.0); hoof(-24.6, 0);
  // saddle cloth
  const cloth = [[-13, -59], [11, -60.2], [13.4, -46], [10, -40.2], [-11, -40.2], [-14.2, -46]];
  pen.fill(cloth, C.red, 0.74);
  pen.line(loop(cloth), 1.0, { taper: [0.03, 0.03] });
  pen.line([[-11.6, -44], [10.6, -44.4]], 0.6, { alpha: 0.7 });
  pen.line([[2, -40.2], [1.4, -34]], 1.3);
  // rider
  const robe = [[-2.6, -93], [-8.2, -89], [-10, -74], [-9, -62], [-10, -52], [-7, -41.6], [4, -39], [12, -42], [15.6, -54], [13.6, -62], [9, -66], [8.6, -76], [7.4, -89], [2.6, -93]];
  pen.fill([[6, -42], [11.6, -42], [13, -33.4], [17.6, -31.6], [17.6, -29.6], [7, -30]], C.ink, 0.86);
  pen.fill(robe, C.white, 0.9);
  pen.line(robe.slice(0, 6), 1.15, { taper: [0.05, 0.08] });
  pen.line(robe.slice(5, 9), 1.05);
  pen.line(robe.slice(8), 1.15, { taper: [0.08, 0.05] });
  pen.line([[-2, -62], [3, -52], [5, -41]], 0.8, { alpha: 0.8 });
  pen.line([[6, -64], [11, -55], [12.6, -45]], 0.75, { alpha: 0.75 });
  pen.tube([[-9.6, -67.4], [0, -65.6], [9, -66.8]], [2.6, 2.6], C.blue, 0.86, 0.6);
  pen.line([[-2.6, -92.4], [0.2, -90.2], [2.8, -92.4]], 0.8);
  head(pen, 1.6, -100, { hat: 'futou', beard: true });
  arm(pen, [[1, -88], [8, -76.5], [16, -71.5]], [8, 9.6, 9.8], C.white);
  pen.line([[18.4, -70.6], [32, -63.4], [46.4, -57.6]], 0.7, { taper: [0.02, 0.02] });   // rein
  // groom leading the donkey
  pen.line([[50.6, -54.6], [54, -51.4], [58.6, -57]], 0.7, { taper: [0.02, 0.02] });
  pen.scope((g) => g.translate(73, 0), 1, () => {
    laborer(pen, { jacket: L.mix(C.straw, C.white, 0.35), pants: C.white, sash: C.blue, hat: 'jin', lean: 4, st: 8,
      armFar: [[-4, -77], [-10, -66], [-14.4, -58]], armNear: [[4, -77], [9, -64], [14, -56]] });
  });
}
/** 抬轿: a roofed sedan chair on two poles, a bearer fore and aft */
function sedan(pen) {
  const bearer = (x, sash) => pen.scope((g) => g.translate(x, 0), 1, () => laborer(pen, { jacket: C.white, pants: C.grey, sash, hat: 'jin', lean: 3, st: 8,
    armFar: [[-4, -77], [-9, -66], [-10, -55]], armNear: [[4, -77], [11.5, -73], [10.4, -80.6]] }));
  bearer(-52, C.blue);
  // cabin
  const box = [[-21, -94], [21, -94], [21, -24], [-21, -24]];
  pen.fill(box, L.mix(C.woodPale, C.straw, 0.4), 0.82);
  pen.fill([[-21, -30], [21, -30], [21, -24], [-21, -24]], C.wood, 0.82);
  pen.fill([[-21, -94], [21, -94], [21, -87.4], [-21, -87.4]], C.red, 0.74);
  pen.fill([[-13.4, -75], [13.4, -75], [13.4, -50], [-13.4, -50]], C.blue, 0.8);
  for (const x of [-8.6, -3.4, 1.8, 7.4]) pen.line([[x, -74], [x + 0.8, -62], [x - 0.3, -51]], 0.6, { alpha: 0.7 });
  pen.line([[-13.4, -68.6], [13.4, -68.2]], 0.7, { alpha: 0.8 });
  pen.poly([[-13.4, -75], [13.4, -75], [13.4, -50], [-13.4, -50]], 1.0);
  pen.poly([[-14.4, -46], [14.4, -46], [14.4, -33.6], [-14.4, -33.6]], 0.8, { alpha: 0.85 });
  pen.line([[-14.4, -46], [14.4, -33.6]], 0.55, { alpha: 0.6 }); pen.line([[14.4, -46], [-14.4, -33.6]], 0.55, { alpha: 0.6 });
  pen.line([[-21, -87.4], [21, -87.4]], 0.9); pen.line([[-21, -30], [21, -30]], 0.9);
  for (const x of [-18, 18]) pen.line([[x, -87], [x, -30.4]], 0.7, { alpha: 0.8 });
  pen.poly(box, 1.35);
  for (const x of [-14, -7, 0, 7, 14]) pen.line([[x, -93.6], [x + 0.4, -88]], 0.5, { alpha: 0.6 });
  // roof
  const roof = [[-27.5, -93.4], [-22, -98.6], [-11, -104.4], [0, -106.6], [11, -104.4], [22, -98.6], [27.5, -93.4]];
  pen.fill(roof, L.mix(C.woodInk, C.blue, 0.35), 0.8);
  pen.line(roof, 1.25, { taper: [0.04, 0.04] });
  pen.line([[-27.5, -93.4], [27.5, -93.4]], 1.6, { taper: [0.02, 0.02] });
  for (const x of [-18, -9, 0, 9, 18]) pen.line([[x * 0.5, -106], [x * 1.25, -94]], 0.55, { alpha: 0.6 });
  pen.fill(ell(0, -108.6, 2.2, 2.4, 10), C.ink, 0.88);
  // near carrying pole, then the fore bearer whose shoulder it rides on
  pen.tube([[-72, -78.6], [0, -79.8], [72, -78.6]], [2.5, 3.0, 2.5], C.wood, 0.88, 0.8, { taper: [0.02, 0.02] });
  bearer(52, C.red);
  pen.tube([[42, -79.4], [72, -78.6]], [2.8, 2.5], C.wood, 0.88, 0.8, { taper: [0.02, 0.02] });
}
/** 摆摊: a stall under a big sunshade — trestle table, steamer baskets, the vendor */
function stall(pen) {
  // vendor behind the table
  pen.scope((g) => g.translate(-12, 0), 1, () => robed(pen, { robe: L.mix(C.blue, C.grey, 0.35), sash: C.white, hat: 'jin', st: 2,
    armFar: [[-3, -77], [-7, -63], [-4, -52]], armNear: [[3, -77], [11, -66], [20, -60]] }));
  // table
  for (const x of [11, 47]) { pen.tube([[x, -32], [x + (x < 30 ? -2 : 2), 0]], [2.6, 2.4], C.wood, 0.85, 0.75, { taper: [0.02, 0.02] }); }
  pen.line([[10, -13], [48, -13]], 1.0);
  pen.fill([[5, -35.4], [53, -35.4], [53, -31.6], [5, -31.6]], C.woodPale, 0.86);
  pen.poly([[5, -35.4], [53, -35.4], [53, -31.6], [5, -31.6]], 1.05);
  // steamer baskets + a heap of buns
  for (let i = 0; i < 3; i++) { const y = -35.6 - i * 5.2; pen.fill([[26, y - 5], [42, y - 5], [42, y], [26, y]], C.straw, 0.86); pen.poly([[26, y - 5], [42, y - 5], [42, y], [26, y]], 0.85); pen.line([[26.5, y - 2.5], [41.5, y - 2.5]], 0.45, { alpha: 0.6 }); }
  for (const [bx, by] of [[10, -37.6], [15.4, -37.6], [20.6, -37.6], [12.8, -41.4], [18, -41.4], [15.4, -45]]) { pen.fill(ell(bx, by, 2.9, 2.5, 10), C.white, 0.92); pen.line(loop(ell(bx, by, 2.9, 2.5, 10)), 0.6, { alpha: 0.85 }); }
  // sunshade
  pen.tube([[31, 0], [30, -60], [29, -120]], [2.6, 2.4, 2.2], C.wood, 0.86, 0.8, { taper: [0.02, 0.02] });
  const top = [[-33, -103], [-4, -116.6], [28, -126], [60, -119], [89, -108.6]], rim = [[89, -108.6], [60, -108.2], [28, -106.6], [-4, -104.6], [-33, -103]];
  pen.fill(spline(top, 1.5).concat(spline(rim, 1.5)), L.mix(C.straw, C.white, 0.45), 0.86);
  for (const [i, x] of [-20, -6, 10, 28, 46, 62, 78].entries()) pen.line([[28, -126], [x, -104 - i * 0.7]], 0.6, { alpha: 0.7 });
  pen.fill(spline(rim, 1.5).concat(spline([[-33, -99.2], [-4, -100.6], [28, -102.4], [60, -104], [89, -104.6]], 1.5)), C.blue, 0.78);
  pen.line(top, 1.3); pen.line(rim, 0.95);
  pen.line([[-33, -103], [-33, -99.2], [-4, -100.6], [28, -102.4], [60, -104], [89, -104.6], [89, -108.6]], 1.05, { taper: [0.02, 0.02] });
  pen.fill(ell(28, -127.4, 1.9, 1.9, 8), C.ink, 0.88);
}
/** 背负: a man bent under a sack */
function sackCarrier(pen) {
  laborer(pen, { jacket: C.blue, pants: C.white, sash: C.ink, hat: 'jin', lean: 14, st: 8,
    armFar: null, armNear: [[4, -77], [8.5, -87], [2, -94.5]],
    mid: (X) => {
      const sack = [[-25, -70], [-26.5, -84], [-18, -96.5], [-5, -100], [5, -94], [6.5, -82], [0.5, -70], [-10, -63.5], [-19.5, -64]].map(X);
      pen.fill(sack, L.mix(C.white, C.grey, 0.22), 0.92, { smooth: true });
      pen.line(spline(sack, 2, true).map((q) => [q[0], q[1]]).concat([sack[0]]), 1.2, { taper: [0.03, 0.03] });
      pen.line([X([-20, -90]), X([-13, -80]), X([-15, -67])], 0.75, { alpha: 0.7 });
      pen.line([X([-8, -96]), X([-3, -84]), X([-5, -72])], 0.7, { alpha: 0.65 });
      pen.line([X([-23, -78]), X([-17, -72])], 0.6, { alpha: 0.6 });
      pen.line([X([3.5, -94.5]), X([8.5, -99.5]), X([6.5, -93])], 1.3);   // the tied mouth of the sack
      pen.line([X([4, -95.5]), X([9.5, -95])], 1.0);
    } });
}
/** 拄杖: an old man with a staff */
function staffWalker(pen) {
  robed(pen, { robe: L.mix(C.straw, C.white, 0.55), sash: C.blue, hat: 'futou', beard: true, lean: 5, st: 2.5,
    armFar: [[-3, -77], [-7, -63], [-5, -51]], armNear: [[3, -77], [10, -66], [16, -62]],
    mid: () => pen.line([[21.5, 0], [18.5, -60], [16.6, -93]], 1.5, { taper: [0.02, 0.02] }) });
}

function paintFigures(env, pen) {
  const a = env.arc;
  const K = 2.85;
  pen.lw = 1.15;
  // [distance along the arc from the crest (px), how far back on the deck (px), who, facing]
  const cast = [
    [-800, 52, stall, -1], [-1130, 34, staffWalker, 1],
    [-498, 30, porter, 1], [-262, 46, parasolWalker, -1],
    [-15, 38, donkeyRider, 1], [522, 48, sedan, 1],
    [852, 30, sackCarrier, 1], [992, 44, staffWalker, 1], [1140, 32, parasolWalker, 1],
  ];
  cast.sort((p, q) => q[1] - p[1]);   // far side of the deck first
  for (const [s, dr, fn, flip] of cast) {
    const th = s / a.R, p = a.pt(th, dr), sl = Math.tan(th);
    // people stand plumb on the sloping deck: shear, don't rotate
    pen.scope((g) => { g.translate(p.x, p.y); g.transform(1, sl, 0, 1, 0, 0); g.scale(flip * K, K); }, K, () => fn(pen));
  }
}

/** the near balustrade: plumb posts, a hand rail and a lower rail following the deck */
function paintRail(env, pen) {
  const a = env.arc, sp = a.span(PAD + 260);
  const r = L.rng('s14rail');
  const PITCH = 152, PW = 15, POST = 98;
  const col = L.mix(C.wood, C.woodPale, 0.6);
  for (const [d0, w] of [[26, 8.5], [78, 10]]) {
    pen.fill((c) => a.pathBand(c, d0 + w, d0, -sp, sp), col, 0.84);
    pen.tint((c) => a.pathBand(c, d0 + w * 0.42, d0, -sp, sp), L.rgba(C.ink, 0.16));
    pen.line(L.arcPts(a, d0 + w, -sp, sp, 110), 2.7, { taper: [0, 0] });
    pen.line(L.arcPts(a, d0, -sp, sp, 110), 3.2, { taper: [0, 0] });
  }
  const n = Math.ceil((sp * a.R) / PITCH);
  for (let i = -n; i <= n; i++) {
    const x = a.cx + a.R * Math.sin(((i + 0.5) * PITCH) / a.R), xl = x - PW / 2, xr = x + PW / 2;
    const yl = a.yAt(xl) - 1, yr = a.yAt(xr) - 1, yt = a.yAt(x) - POST;
    const post = [[xl, yl], [xl, yt + 3], [xl + 3, yt], [xr - 3, yt], [xr, yt + 3], [xr, yr]];
    pen.fill(post, L.mix(col, C.woodPale, 0.4), 0.86);
    pen.tint([[x + 2, yt], [xr, yt + 3], [xr, yr], [x + 2, (yl + yr) / 2]], L.rgba(C.ink, 0.18));
    pen.line([[xl + r.range(-0.6, 0.6), yl], [xl + r.range(-0.6, 0.6), (yl + yt) / 2], [xl, yt + 3], [xl + 3, yt]], 2.6, { taper: [0.02, 0.02] });
    pen.line([[xr - 3, yt], [xr, yt + 3], [xr + r.range(-0.6, 0.6), (yr + yt) / 2], [xr + r.range(-0.6, 0.6), yr]], 3.0, { taper: [0.02, 0.02] });
    pen.line([[xl + 3, yt], [xr - 3, yt]], 2.4, { taper: [0.02, 0.02] });
    pen.line([[xl + 1, yt + 11], [xr - 1, yt + 11]], 1.4, { alpha: 0.7 });
    pen.line([[x - 1, yt + 16], [x - 1.5, yl - 8]], 1.0, { alpha: 0.4, taper: [0.2, 0.3] });
  }
}

// ───────────────────────── aging ─────────────────────────
function makeCreases() {
  // a handscroll cracks ACROSS its rolling direction: irregular vertical creases that fade in and out along their length
  const r = L.rng('s14crease'), nz = L.makeNoise('s14crease'); const out = [];
  let x = -PAD + r.range(30, 240), id = 0;
  while (x < W + PAD) {
    const pts = [], drift = r.range(-26, 26), k = r.range(0.35, 1);
    for (let y = -PAD; y <= H + PAD; y += 40) {
      const a = L.clamp(0.3 + 1.5 * nz.n2(y / 260, id * 7.3));          // strength of this stretch (0 = the crease vanishes)
      pts.push([x + (drift * y) / H + 7 * nz.n2(y / 190, id * 3.1 + 50), y, a * k]);
    }
    out.push({ pts, k });
    x += r.range(130, 520); id++;
  }
  return out;
}
function buildTex(creases) {
  const dark = '#3a2a18';
  const mottle = L.noiseTex(LW, LH, { seed: 's14mot', scale: 64, octaves: 4, res: 0.33, warp: 0.6, contrast: 1.7,
    ramp: [[0, L.rgba(C.base, 0.55)], [0.4, L.rgba(C.base, 0.06)], [0.6, L.rgba(dark, 0)], [1, L.rgba(dark, 0.22)]] });
  const grain = L.noiseTex(256, 256, { seed: 's14gr', scale: 3.4, octaves: 2, res: 1, contrast: 2.2,
    ramp: [[0, L.rgba(C.base, 0.5)], [0.38, L.rgba(C.base, 0)], [0.7, L.rgba(dark, 0)], [1, L.rgba(dark, 0.2)]] });
  const dry = L.noiseTex(256, 256, { seed: 's14dry', scale: 2.8, octaves: 2, res: 1, contrast: 2.4,
    ramp: [[0, 'rgba(0,0,0,0.7)'], [0.26, 'rgba(0,0,0,0.08)'], [0.42, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0)']] });
  const fade = L.noiseTex(LW, LH, { seed: 's14fade', scale: 44, octaves: 3, res: 0.25, contrast: 1.6,
    ramp: [[0, 'rgba(0,0,0,0.4)'], [0.36, 'rgba(0,0,0,0.06)'], [1, 'rgba(0,0,0,0)']] });
  // flaked paint: bare silk flecks strung along the roll creases, plus scattered pin-holes
  const flake = L.makeLayer(PAD, (g) => {
    const r = L.rng('s14flake');
    for (const c of creases) for (const [x, y, k] of c.pts) for (let i = 0; i < 5; i++) {
      if (!r.chance(0.7 * k)) continue;
      const w = r.range(1.2, 4.4), hh = r.range(3, 16);
      g.fillStyle = L.rgba(r.chance(0.5) ? C.base : '#efe2c0', r.range(0.5, 0.95));
      g.fillRect(x - w / 2 + r.range(-2.2, 2.2), y + r.range(0, 40), w, hh);
    }
    L.speckle(g, { seed: 's14fl', count: 1700, x: -PAD, y: -PAD, w: LW, h: LH, rMin: 0.8, rMax: 3.6, colors: [C.base, '#efe2c0'], alpha: [0.4, 0.95] });
  });
  return { mottle, grain, dry, fade, flake };
}
/** age a painted sheet and lay it onto target */
function flatten(target, pen, tex) {
  let g = pen.gw; g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.drawImage(tex.mottle, 0, 0);
  g.fillStyle = g.createPattern(tex.grain, 'repeat'); g.fillRect(0, 0, LW, LH);
  g.restore();
  g = pen.gi; g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = g.createPattern(tex.dry, 'repeat'); g.fillRect(0, 0, LW, LH);
  g.drawImage(tex.fade, 0, 0);
  g.restore();
  const t = target.getContext('2d'); t.save(); t.setTransform(1, 0, 0, 1, 0, 0);
  t.drawImage(pen.wash, 0, 0); t.drawImage(pen.ink, 0, 0);
  t.globalCompositeOperation = 'source-atop'; t.drawImage(tex.flake, 0, 0);
  t.restore();
  return target;
}
function weaveTile() {
  // plain-weave silk at this magnification: threads ≈ 4 px apart, some thicker (slubs), the gaps between them a shade darker
  const P = 4, N = 96, c = L.makeCanvas(P * N, P * N), g = c.getContext('2d');
  const r = L.rng('s14weave');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < N; i++) {
    g.fillStyle = `rgba(96,72,38,${r.range(0.04, 0.1).toFixed(3)})`; g.fillRect(i * P, 0, 1.5, c.height);
    g.fillStyle = `rgba(96,72,38,${r.range(0.05, 0.12).toFixed(3)})`; g.fillRect(0, i * P, c.width, 1.5);
  }
  g.fillStyle = 'rgba(60,42,20,0.13)';
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if ((i + j) % 2 === 0) g.fillRect(i * P, j * P, 1.5, 1.5);
  // slubs: short stretches where a thread runs thick (never a ruled line right across the sheet)
  for (let i = 0; i < 80; i++) {
    const u = r.int(0, N - 1) * P, v = r.range(0, c.width), len = r.range(10, 56);
    g.fillStyle = `rgba(86,64,32,${r.range(0.06, 0.15).toFixed(3)})`;
    if (r.chance(0.6)) { g.fillRect(v, u, len, 1.8); g.fillRect(v - c.width, u, len, 1.8); } else { g.fillRect(u, v, 1.8, len); g.fillRect(u, v - c.height, 1.8, len); }
  }
  return c;
}
/** the multiply sheet: uneven toning, tide lines, mildew, the weave of the silk, roll creases */
function buildAging(creases) {
  const spots = L.makeLayer(PAD, (g) => {
    const nz = L.makeNoise('s14mold'), r = L.rng('s14mold');
    L.speckle(g, { seed: 's14fox', count: 3800, x: -PAD, y: -PAD, w: LW, h: LH, rMin: 1, rMax: 7, colors: ['#8a6c3e', '#6f5530', '#9b7d4d'], alpha: [0.12, 0.6],
      test: (x, y) => nz.fbm(x / 340, y / 340, 3) > 0.1 });
    for (let i = 0; i < 46; i++) {
      const x = r.range(-PAD, W + PAD), y = r.range(-PAD, H + PAD), rad = r.range(14, 70);
      if (nz.fbm(x / 340, y / 340, 3) < -0.05) continue;
      g.fillStyle = L.radial(g, x, y, 0, rad, [[0, L.rgba('#6f5530', r.range(0.16, 0.34))], [0.6, L.rgba('#8a6c3e', 0.1)], [1, L.rgba('#8a6c3e', 0)]]);
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  });
  return L.makeLayer(PAD, (g) => {
    g.fillStyle = '#fff'; g.fillRect(-PAD, -PAD, LW, LH);
    g.globalCompositeOperation = 'multiply';
    g.drawImage(L.noiseTex(LW, LH, { seed: 's14tone', scale: 620, octaves: 4, res: 0.2, warp: 0.6, ramp: [[0, '#c9af80'], [0.5, '#ecdfc1'], [1, '#fffaf0']] }), -PAD, -PAD);
    // a couple of old water stains with their darker tide lines
    g.globalAlpha = 0.6;
    g.drawImage(L.noiseTex(LW, LH, { seed: 's14tideB', scale: 760, octaves: 3, res: 0.3, warp: 0.55,
      ramp: [[0, '#fff'], [0.655, '#fff'], [0.685, '#eadbb8'], [0.7, '#c2a672'], [0.72, '#efe2c4'], [1, '#f3e9d0']] }), -PAD, -PAD);
    // slow vertical undulation of the mounted silk
    g.globalAlpha = 0.6;
    g.drawImage(L.noiseTex(LW, LH, { seed: 's14roll', scale: 210, sx: 0.5, sy: 30, octaves: 2, res: 0.15, ramp: [[0, '#dccfb0'], [0.5, '#f6efdf'], [1, '#fff']] }), -PAD, -PAD);
    g.globalAlpha = 1;
    g.drawImage(L.blurred(spots, 1.3), -PAD, -PAD);
    g.fillStyle = g.createPattern(weaveTile(), 'repeat'); g.fillRect(-PAD, -PAD, LW, LH);
    g.lineCap = 'round';
    for (const c of creases) for (let i = 1; i < c.pts.length; i++) {
      const p = c.pts[i - 1], q = c.pts[i], k = (p[2] + q[2]) / 2;
      if (k < 0.04) continue;
      g.strokeStyle = `rgba(92,68,36,${(0.09 * k).toFixed(3)})`; g.lineWidth = 12; g.beginPath(); g.moveTo(p[0] + 5, p[1]); g.lineTo(q[0] + 5, q[1]); g.stroke();
      g.strokeStyle = `rgba(80,58,30,${(0.5 * k).toFixed(3)})`; g.lineWidth = 1.4; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
    }
  });
}

export default {
  name: '虹桥',
  tone: 'dark',
  init(env) {
    const creases = makeCreases();
    const tex = buildTex(creases);
    const pb = makePen(1000); paintBack(env, pb);
    const back = flatten(L.makeLayer(PAD, (g) => { g.fillStyle = C.base; g.fillRect(-PAD, -PAD, LW, LH); }), pb, tex);
    const pf = makePen(4000); paintFigures(env, pf);
    const fig = flatten(L.makeLayer(PAD), pf, tex);
    const pr = makePen(7000); paintRail(env, pr);
    const rail = flatten(L.makeLayer(PAD), pr, tex);
    // bake the aging sheet into each paint sheet (multiply, keeping the sheet's own alpha) so draw() is just three blits
    const aging = buildAging(creases);
    const bake = (layer) => {
      const keep = L.makeCanvas(LW, LH); keep.getContext('2d').drawImage(layer, 0, 0);
      const g = layer.getContext('2d'); g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'multiply'; g.drawImage(aging, 0, 0);
      g.globalCompositeOperation = 'destination-in'; g.drawImage(keep, 0, 0);
      g.restore();
      return layer;
    };
    S = { back: bake(back), fig: bake(fig), rail: bake(rail) };
  },
  draw(ctx, env, p) {
    // the whole painting slides along the arc; the procession drifts a little further, as if still walking
    const rot = L.lerp(-0.0065, 0.0065, p), zoom = L.lerp(1.0, 1.02, p);
    L.blit(ctx, env, S.back, { rot, zoom });
    L.blit(ctx, env, S.fig, { rot: rot + L.lerp(-0.0022, 0.0022, p), zoom });
    L.blit(ctx, env, S.rail, { rot, zoom });
    // raking light across the silk: warm upper left, falling away to the lower right
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = L.radial(ctx, L.lerp(560, 700, p), 240, 60, 1650, [[0, 'rgba(255,246,222,0.5)'], [0.45, 'rgba(150,140,120,0)'], [1, 'rgba(36,22,8,0.55)']]);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  },
};
