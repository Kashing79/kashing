// s32 — 哥窑金丝铁线. Straight down onto a Ge-ware dish, macro on the glaze.
// The arc is the dish's mouth rim: where the glaze thins over the lip the dark body shows through as a plum-brown line (紫口).
// Below the arc: fat, opaque cream glaze broken by a two-generation crackle — the old cracks are thick iron-black lines
// (铁线) that enclose irregular blocks, the young ones are fine amber threads (金丝) inside every block. Blocks are small
// under the rim and grow toward the middle of the dish; a few clusters of blocks have fired grey-celadon.
// Above the arc: plain moon-white silk twill, out of focus, with the soft shadow of the rim.
//
// The crackle is grown, not tiled: a rectangle in "unrolled" rim coordinates (u along the rim, v toward the dish centre)
// is split recursively. Every new crack leaves the two older cracks it joins at a right angle (a cubic bent to do so),
// which is what real craquelure does and what keeps it from reading as honeycomb. One noise warp is applied to all
// points afterwards, so the lines waver but every T-junction stays closed.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 90;
const LW = W + PAD * 2;
let S = null;

const COL = {
  cream: '#ddd0aa', celadon: '#a9b3a2', iron: '#1e1a17', gold: '#c8922e', silk: '#eeeadc', mouth: '#4a3038',
};

const sstep = (a, b, v) => { const t = L.clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// ── cropped layers: full padded width, rows y0..y1 of the frame; drawn in frame coordinates ──
function band(y0, y1, draw) {
  const c = L.makeCanvas(LW, y1 - y0), g = c.getContext('2d');
  g.translate(PAD, -y0);
  c._y0 = y0;
  if (draw) draw(g, c);
  return c;
}
const blur = (src, px) => { const c = L.blurred(src, px); c._y0 = src._y0; return c; };
const put = (g, c, alpha = 1, blend = 'source-over') => { g.save(); g.globalAlpha = alpha; g.globalCompositeOperation = blend; g.drawImage(c, -PAD, c._y0); g.restore(); };
const poly = (g, xy) => { g.beginPath(); g.moveTo(xy[0][0], xy[0][1]); for (let i = 1; i < xy.length; i++) g.lineTo(xy[i][0], xy[i][1]); g.closePath(); };

// ───────────────────────── the crackle network ─────────────────────────
function buildNet(env) {
  const a = env.arc, R = a.R;
  const r = L.rng('s32-ge-net-3');
  const UM = 1250, VT = -54, VB = 680;
  const Siron = (v) => 100 + 250 * sstep(30, 560, v);      // size of an iron-line block: small under the rim, large in the well
  const Sgold = (v) => 44 + 78 * sstep(30, 560, v);        // size of a gold-thread cell inside it
  const cracks = [], blocks = [], cells = [];

  const area = (P) => { let s = 0; for (let i = 0, n = P.length; i < n; i++) { const p = P[i], q = P[(i + 1) % n]; s += p[0] * q[1] - q[0] * p[1]; } return s / 2; };
  const centroid = (P) => {
    let x = 0, y = 0, s = 0;
    for (let i = 0, n = P.length; i < n; i++) { const p = P[i], q = P[(i + 1) % n], c = p[0] * q[1] - q[0] * p[1]; x += (p[0] + q[0]) * c; y += (p[1] + q[1]) * c; s += c; }
    return Math.abs(s) > 1e-6 ? [x / (3 * s), y / (3 * s)] : P[0];
  };
  const inside = (P, x, y) => {
    let c = false;
    for (let i = 0, n = P.length, j = n - 1; i < n; j = i++) { const p = P[i], q = P[j]; if ((p[1] > y) !== (q[1] > y) && x < ((q[0] - p[0]) * (y - p[1])) / (q[1] - p[1]) + p[0]) c = !c; }
    return c;
  };
  // longest extent of a polygon over 12 directions (+ the extent across it)
  const axes = (P) => {
    let best = null;
    for (let k = 0; k < 12; k++) {
      const an = (k / 12) * Math.PI, dx = Math.cos(an), dy = Math.sin(an);
      let lo = 1e9, hi = -1e9, lo2 = 1e9, hi2 = -1e9;
      for (const p of P) { const s = p[0] * dx + p[1] * dy, t = -p[0] * dy + p[1] * dx; if (s < lo) lo = s; if (s > hi) hi = s; if (t < lo2) lo2 = t; if (t > hi2) hi2 = t; }
      if (!best || hi - lo > best.len) best = { dx, dy, lo, hi, lo2, hi2, len: hi - lo };
    }
    return best;
  };
  // one new crack across the long axis of P; it meets both older edges square-on
  function split(P, ax, bend, jr) {
    const n = P.length;
    let best = null;
    for (let att = 0; att < 7; att++) {
      const f = r.range(0.34, 0.66), jit = r.range(-jr, jr);
      const s = L.lerp(ax.lo, ax.hi, f), tm = L.lerp(ax.lo2, ax.hi2, r.range(0.4, 0.6));
      const qx = ax.dx * s - ax.dy * tm, qy = ax.dy * s + ax.dx * tm;
      const an = Math.atan2(ax.dx, -ax.dy) + jit, dx = Math.cos(an), dy = Math.sin(an);
      const hits = [];
      for (let i = 0; i < n; i++) {
        const p = P[i], q = P[(i + 1) % n], ex = q[0] - p[0], ey = q[1] - p[1];
        const den = dx * ey - dy * ex; if (Math.abs(den) < 1e-9) continue;
        const wx = p[0] - qx, wy = p[1] - qy, t = (wx * ey - wy * ex) / den, e = (wx * dy - wy * dx) / den;
        if (e >= 0 && e < 1) hits.push({ t, i, ex, ey });
      }
      if (hits.length < 2) continue;
      hits.sort((h1, h2) => h1.t - h2.t);
      let k0 = 0, bl = -1;
      for (let k = 0; k + 1 < hits.length; k += 2) { const l = hits[k + 1].t - hits[k].t; if (l > bl) { bl = l; k0 = k; } }
      const h0 = hits[k0], h1 = hits[k0 + 1];
      if (h0.i === h1.i || bl < 14) continue;
      const A = [qx + h0.t * dx, qy + h0.t * dy], B = [qx + h1.t * dx, qy + h1.t * dy];
      const nrm = (h, sx, sy) => { let nx = -h.ey, ny = h.ex; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m; return nx * sx + ny * sy < 0 ? [-nx, -ny] : [nx, ny]; };
      const nA = nrm(h0, dx, dy), nB = nrm(h1, -dx, -dy);
      let k = 0.36 * bend * r.range(0.4, 1), path = null;
      const N = Math.max(3, Math.round(bl / 12));
      for (let tr = 0; tr < 3 && !path; tr++) {
        const c1x = A[0] + nA[0] * k * bl, c1y = A[1] + nA[1] * k * bl, c2x = B[0] + nB[0] * k * bl, c2y = B[1] + nB[1] * k * bl;
        const pts = []; let ok = true;
        for (let j = 0; j <= N; j++) {
          const t = j / N, m = 1 - t, b0 = m * m * m, b1 = 3 * m * m * t, b2 = 3 * m * t * t, b3 = t * t * t;
          const x = b0 * A[0] + b1 * c1x + b2 * c2x + b3 * B[0], y = b0 * A[1] + b1 * c1y + b2 * c2y + b3 * B[1];
          if (j > 0 && j < N && tr < 2 && !inside(P, x, y)) { ok = false; break; }
          pts.push([x, y]);
        }
        if (ok) path = pts; else k = tr === 0 ? k * 0.4 : 0;
      }
      const c1 = [A], c2 = [B];
      for (let q = (h0.i + 1) % n; ; q = (q + 1) % n) { c1.push(P[q]); if (q === h1.i) break; }
      c1.push(B); for (let j = N - 1; j >= 1; j--) c1.push(path[j]);
      for (let q = (h1.i + 1) % n; ; q = (q + 1) % n) { c2.push(P[q]); if (q === h0.i) break; }
      c2.push(A); for (let j = 1; j < N; j++) c2.push(path[j]);
      const a1 = Math.abs(area(c1)), a2 = Math.abs(area(c2)), ratio = Math.min(a1, a2) / (a1 + a2 + 1e-6);
      if (!best || ratio > best.ratio) best = { c1, c2, path, ratio };
      if (ratio > 0.24) break;
    }
    return best && best.ratio > 0.08 ? best : null;
  }

  // generation 1 — 铁线: the old, wide cracks
  let stack = [{ P: [[-UM, VT], [UM, VT], [UM, VB], [-UM, VB]], gen: 0 }];
  while (stack.length) {
    const { P, gen } = stack.pop();
    const ax = axes(P), ar = Math.abs(area(P)), c = centroid(P);
    const target = Siron(c[1]) * r.range(0.74, 1.38);
    if (gen < 30 && (Math.sqrt(ar) > target || (ax.len > 2.3 * (ar / ax.len) && ax.len > target * 1.25))) {
      const sp = split(P, ax, 1, gen <= 2 ? 0.55 : 0.38);
      if (sp) {
        const w = gen <= 1 ? r.range(8.6, 10.6) : gen <= 3 ? r.range(6.6, 8.8) : gen <= 5 ? r.range(5.0, 7.0) : r.range(4.0, 5.6);
        cracks.push({ uv: sp.path, kind: 0, gen, w, seed: r.range(0, 900) });
        stack.push({ P: sp.c1, gen: gen + 1 }, { P: sp.c2, gen: gen + 1 });
        continue;
      }
    }
    blocks.push({ P, c });
  }
  // generation 2 — 金丝: young, fine cracks inside every block
  blocks.forEach((b, bi) => {
    const dens = r.chance(0.1) ? 1.8 : r.range(0.82, 1.32);     // a few blocks stay almost uncrazed
    stack = [{ P: b.P, gen: 0 }];
    while (stack.length) {
      const { P, gen } = stack.pop();
      const ax = axes(P), ar = Math.abs(area(P)), c = centroid(P);
      const target = Sgold(c[1]) * dens * r.range(0.72, 1.4);
      if (gen < 20 && (Math.sqrt(ar) > target || (ax.len > 2.4 * (ar / ax.len) && ax.len > target * 1.3))) {
        const sp = split(P, ax, 1.15, 0.4);
        if (sp) {
          const k = { uv: sp.path, kind: 1, gen, w: gen === 0 ? r.range(3.6, 4.8) : r.range(2.6, 3.8), seed: r.range(0, 900), tone: r.int(0, 3), al: Math.min(1, r.range(0.72, 1.4)) };
          if (gen >= 1 && r.chance(0.13)) { k.cut = r.range(0.5, 0.82); k.rev = r.chance(0.5); }   // some threads die out before they reach the other side
          cracks.push(k);
          stack.push({ P: sp.c1, gen: gen + 1 }, { P: sp.c2, gen: gen + 1 });
          continue;
        }
      }
      cells.push({ P, c, block: bi });
    }
  });

  // ── to the frame: one shared warp (lines waver, junctions stay closed), then wrap onto the rim circle ──
  const nz = L.makeNoise('s32warp'), nw = L.makeNoise('s32width');
  const toXY = (u, v) => {
    const wu = u + 36 * nz.n2(u / 560 + 3.3, v / 560 - 8.1) + 14 * nz.n2(u / 250, v / 250) + 5 * nz.n2(u / 90 + 7.3, v / 90 - 3.1) + 1.2 * nz.n2(u / 21 + 40, v / 21 + 9);
    const wv = v + 30 * nz.n2(u / 560 - 14.2, v / 560 + 5.5) * sstep(-40, 160, v) + 14 * nz.n2(u / 250 + 31.7, v / 250 + 11.2) + 5 * nz.n2(u / 90 - 19.4, v / 90 + 23.8) + 1.2 * nz.n2(u / 21 - 8, v / 21 + 60);
    const th = wu / R, rr = R - wv;
    return [a.cx + rr * Math.sin(th), a.cy - rr * Math.cos(th)];
  };
  for (const c of cracks) {
    let d = L.smoothPath(c.uv, 4);
    let free0 = false, free1 = false;
    if (c.cut) {
      const m = Math.max(3, Math.round(d.length * c.cut));
      if (c.rev) { d = d.slice(d.length - m); free0 = true; } else { d = d.slice(0, m); free1 = true; }
    }
    const xy = d.map(([u, v]) => toXY(u, v)), n = xy.length;
    const sl = new Float32Array(n);
    for (let i = 1; i < n; i++) sl[i] = sl[i - 1] + Math.hypot(xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]);
    const tot = sl[n - 1], hw = new Float32Array(n), et = new Float32Array(n), young = c.gen > 0 || c.kind === 1;
    for (let i = 0; i < n; i++) {
      const s = sl[i];
      const f = 1 + 0.38 * nw.n2(s / 75 + c.seed, c.seed * 0.37) + 0.15 * nw.n2(s / 16, c.seed + 5);
      const j0 = free0 ? sstep(0, 44, s) : young ? L.lerp(0.6, 1, sstep(0, 30, s)) : 1;
      const j1 = free1 ? sstep(0, 44, tot - s) : young ? L.lerp(0.6, 1, sstep(0, 30, tot - s)) : 1;
      hw[i] = 0.5 * c.w * f * j0 * j1;
      et[i] = young ? sstep(0, 20, s) * sstep(0, 20, tot - s) : 1;     // halos and grooves close up where a crack runs into an older one
    }
    c.xy = xy; c.hw = hw; c.et = et;
  }
  // celadon clusters (u, v, radius)
  const clusters = [[-770, 255, 235], [-200, 410, 185], [440, 215, 235], [985, 310, 215]];
  const nc = L.makeNoise('s32cel');
  for (const b of blocks) {
    b.xy = b.P.map(([u, v]) => toXY(u, v));
    let m = 0;
    for (const [cu, cv, cr] of clusters) m = Math.max(m, 1 - Math.hypot(b.c[0] - cu, (b.c[1] - cv) * 1.15) / cr);
    b.cel = sstep(0.02, 0.5, m + 0.22 * nc.n2(b.c[0] / 240, b.c[1] / 240));
  }
  for (const c of cells) c.xy = c.P.map(([u, v]) => toXY(u, v));
  return { cracks, blocks, cells, clusters, toXY };
}

/** add one crack to the current path as a ribbon of varying width (width × mul + add) */
function ribbon(g, c, mul, add) {
  const p = c.xy, n = p.length, hw = c.hw, et = c.et;
  if (n < 2) return;
  const rx = new Float32Array(n), ry = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a0 = p[i ? i - 1 : 0], b0 = p[i < n - 1 ? i + 1 : n - 1];
    let nx = -(b0[1] - a0[1]), ny = b0[0] - a0[0]; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
    const h = hw[i] * mul + add * 0.5 * et[i];
    rx[i] = p[i][0] - nx * h; ry[i] = p[i][1] - ny * h;
    const lx = p[i][0] + nx * h, ly = p[i][1] + ny * h;
    if (i) g.lineTo(lx, ly); else g.moveTo(lx, ly);
  }
  for (let i = n - 1; i >= 0; i--) g.lineTo(rx[i], ry[i]);
  g.closePath();
}

// ───────────────────────── the glaze ─────────────────────────
function buildGlaze(env, net) {
  const a = env.arc;
  const Y0 = Math.floor(a.crestY) - 46, Y1 = H + PAD, BH = Y1 - Y0;
  const mk = (draw) => band(Y0, Y1, draw);
  const full = (g) => g.fillRect(-PAD, Y0, LW, BH);
  // fill every crack of one generation as a ribbon; `each` may set the style per crack (return false to skip it)
  const cracksOf = (g, kind, mul, add, each) => { for (const c of net.cracks) if (c.kind === kind && (!each || each(c) !== false)) { g.beginPath(); ribbon(g, c, mul, add); g.fill(); } };
  const noise = (o) => { const c = L.noiseTex(LW, BH, o); c._y0 = Y0; return c; };
  const rt = L.rng('s32tint');

  const glaze = mk((g) => { g.fillStyle = COL.cream; full(g); });
  const g = glaze.getContext('2d');

  // 1) every iron-line block fired a slightly different butter-cream …
  put(g, blur(mk((t) => {
    for (const b of net.blocks) {
      const cream = L.mix(COL.cream, rt.pick(['#e7d596', '#d8c68e', '#e8dbae', '#dfca88']), rt.range(0.2, 0.85));
      const cel = L.mix(COL.celadon, rt.pick(['#98ae9e', '#b4bca6', '#90a698']), rt.range(0.1, 0.8));
      t.fillStyle = t.strokeStyle = L.mix(cream, cel, b.cel * 0.5);
      t.lineWidth = 2; poly(t, b.xy); t.fill(); t.stroke();
    }
  }), 9));
  // … and in a few places the glaze went grey-celadon in soft clouds that pay no attention to the cracks
  put(g, blur(mk((t) => {
    for (const [cu, cv, cr] of net.clusters) {
      const [x, y] = net.toXY(cu, cv);
      t.save(); t.translate(x, y); t.rotate(cu / a.R); t.scale(1.12, 0.92);
      t.fillStyle = L.radial(t, 0, 0, 0, cr * 1.05, [[0, 'rgba(138,168,155,0.96)'], [0.45, 'rgba(150,174,158,0.72)'], [0.8, 'rgba(169,179,162,0.24)'], [1, 'rgba(169,179,162,0)']]);
      t.fillRect(-cr * 1.3, -cr * 1.3, cr * 2.6, cr * 2.6);
      t.restore();
    }
    t.globalCompositeOperation = 'destination-out';
    t.drawImage(L.noiseTex(LW, BH, { seed: 's32celmask', scale: 150, octaves: 3, warp: 0.8, res: 0.2, contrast: 1.7, ramp: [[0, 'rgba(0,0,0,0.75)'], [0.55, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0)']] }), -PAD, Y0);
  }), 10), 0.9);
  // 2) every gold-thread cell inside a block sits at its own tiny angle
  put(g, blur(mk((t) => {
    for (const c of net.cells) {
      const b = net.blocks[c.block], v = rt();
      if (b.cel > 0.2 && v < 0.5) t.fillStyle = L.rgba(rt.pick(['#8ea697', '#a2b5a5', '#c6ccb4']), rt.range(0.1, 0.42) * b.cel);
      else if (v < 0.5) t.fillStyle = L.rgba('#f6ecd0', rt.range(0.05, 0.34));
      else t.fillStyle = L.rgba('#c4a964', rt.range(0.04, 0.28));
      poly(t, c.xy); t.fill();
    }
  }), 4.5));
  // 3) the glaze itself: fat, opaque, clouded
  put(g, noise({ seed: 's32cloud', scale: 250, octaves: 4, warp: 0.7, res: 0.2, contrast: 1.5 }), 0.2, 'soft-light');
  put(g, noise({ seed: 's32curd', scale: 54, octaves: 3, res: 0.4, contrast: 1.5 }), 0.1, 'soft-light');

  // 4) stain bleeding out of the cracks into the glaze (洇染)
  put(g, blur(mk((t) => { t.fillStyle = '#8a6238'; cracksOf(t, 0, 1, 8); }), 4), 0.5, 'multiply');
  put(g, blur(mk((t) => { t.fillStyle = '#e0a02e'; cracksOf(t, 1, 1, 5, (c) => { t.globalAlpha = c.al; }); }), 2.6), 0.6, 'multiply');

  // 5) relief: every block is a shallow cushion, every crack a soft groove
  const hIron = mk((t) => { t.fillStyle = '#fff'; full(t); t.fillStyle = '#000'; cracksOf(t, 0, 1, 9); });
  const hGold = mk((t) => { t.fillStyle = '#fff'; full(t); t.fillStyle = '#555'; cracksOf(t, 1, 1, 3.5); });
  const dome = L.bumpLight(hIron, { angle: 45, strength: 10, blur: 30, res: 0.5 }); dome._y0 = Y0;
  const groove = L.bumpLight(hIron, { angle: 45, strength: 1.4, blur: 6, res: 0.5 }); groove._y0 = Y0;
  const fine = L.bumpLight(hGold, { angle: 45, strength: 1.1, blur: 3, res: 0.5 }); fine._y0 = Y0;
  put(g, dome, 0.7, 'overlay');
  put(g, groove, 0.55, 'overlay');
  put(g, fine, 0.45, 'overlay');

  // 6) satin sheen (酥光): a soft band of light lying round the wall, broken into facets because every cell tilts a little
  const facet = blur(mk((t) => { for (const c of net.cells) { t.fillStyle = `rgba(255,255,255,${(0.3 + 0.7 * Math.pow(rt(), 1.4)).toFixed(3)})`; poly(t, c.xy); t.fill(); } }), 3);
  const sheen = mk((t) => {
    t.fillStyle = L.radial(t, a.cx, a.cy, a.R - 350, a.R - 60, [[0, 'rgba(255,251,234,0)'], [0.5, 'rgba(255,251,234,1)'], [1, 'rgba(255,251,234,0)']]); full(t);
    t.globalCompositeOperation = 'destination-in';
    t.fillStyle = L.linear(t, 0, 0, W, 0, [[0, 'rgba(0,0,0,0.2)'], [0.32, 'rgba(0,0,0,1)'], [0.6, 'rgba(0,0,0,0.34)'], [1, 'rgba(0,0,0,0.06)']]); full(t);
    put(t, facet, 1, 'destination-in');
  });
  put(g, sheen, 0.55, 'soft-light');
  put(g, sheen, 0.16, 'screen');

  // 7) the cracks themselves — inside the glaze, so their edges are a little soft. Young gold first, old iron over it.
  put(g, blur(mk((t) => {
    const tones = ['#c8922e', '#b87a14', '#cf962c', '#bf8218'];
    cracksOf(t, 1, 1, 0, (c) => { t.fillStyle = tones[c.tone]; t.globalAlpha = c.al; });
  }), 0.5));
  put(g, blur(mk((t) => { t.fillStyle = '#4a3222'; cracksOf(t, 0, 1, 2.2); }), 1.3), 0.85);
  put(g, blur(mk((t) => { t.fillStyle = COL.iron; cracksOf(t, 0, 1, 0); }), 0.6));

  // 8) bubbles held in the glaze: a dust of pearl points, a few big enough to see
  g.save(); a.clipBelow(g, 30);
  L.speckle(g, { seed: 's32bub', count: 2600, x: -PAD, y: Y0, w: LW, h: BH, rMin: 0.6, rMax: 1.7, colors: ['#fffdf2', '#fff8e0'], alpha: [0.12, 0.5] });
  L.speckle(g, { seed: 's32pin', count: 500, x: -PAD, y: Y0, w: LW, h: BH, rMin: 0.5, rMax: 1.4, colors: ['#8a7446', '#6e5a36'], alpha: [0.1, 0.34] });
  const rb = L.rng('s32pearl'), pearls = [];
  for (let i = 0; i < 110; i++) {
    const x = rb.range(-PAD, W + PAD), y = rb.range(Y0, Y1), rad = rb.range(2.0, 3.8);
    if (a.drAt(x, y) > -26) continue;
    g.fillStyle = L.radial(g, x + rad * 0.3, y + rad * 0.3, rad * 0.4, rad * 1.5, [[0, 'rgba(120,96,52,0)'], [0.6, 'rgba(120,96,52,0.28)'], [1, 'rgba(120,96,52,0)']]);
    g.beginPath(); g.arc(x, y, rad * 1.5, 0, L.TAU); g.fill();
    g.fillStyle = L.radial(g, x - rad * 0.3, y - rad * 0.3, 0, rad, [[0, 'rgba(255,253,240,0.9)'], [0.5, 'rgba(255,250,228,0.45)'], [1, 'rgba(255,250,228,0)']]);
    g.beginPath(); g.arc(x, y, rad, 0, L.TAU); g.fill();
    pearls.push({ x, y, rad, ph: rb(), k: rb.range(0.5, 1) });
  }
  g.restore();

  // 9) light on the form: a broad soft pool left of centre; the wall rolls into shade under the lip and toward the corners
  const lp = a.pt(-0.11, -200);
  g.save();
  g.globalCompositeOperation = 'soft-light';
  g.fillStyle = L.radial(g, lp.x, lp.y, 40, 700, [[0, 'rgba(255,250,232,0.4)'], [0.5, 'rgba(255,250,232,0.16)'], [1, 'rgba(255,250,232,0)']]); full(g);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = L.radial(g, lp.x, lp.y, 340, 1450, [[0, '#ffffff'], [0.45, '#ebdfbe'], [1, '#b8a174']]); full(g);
  g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 110, a.R, [[0, 'rgba(160,128,84,0)'], [0.6, 'rgba(160,128,84,0.16)'], [1, 'rgba(150,112,76,0.42)']]); full(g);
  g.restore();

  // 10) depth of field: sharp under the crest, softening toward the sides and the bottom of frame
  const fc = { x: a.cx - 40, y: a.crestY + 130 };
  for (const [px, r0, r1] of [[2.2, 400, 820], [5.5, 720, 1260]]) {
    const soft = blur(glaze, px), sg = soft.getContext('2d');
    sg.globalCompositeOperation = 'destination-in';
    sg.fillStyle = L.radial(sg, fc.x + PAD, fc.y - Y0, r0, r1, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]);
    sg.fillRect(0, 0, soft.width, soft.height);
    put(g, soft);
  }

  // what a passing light picks out (half res): the lit shoulders of the blocks and the facets of the cells
  const hw = Math.ceil(LW / 2), hh = Math.ceil(BH / 2);
  const hc = L.makeCanvas(hw, hh), hg = hc.getContext('2d', { willReadFrequently: true });
  hg.drawImage(dome, 0, 0, hw, hh);
  hg.globalAlpha = 0.5; hg.drawImage(groove, 0, 0, hw, hh); hg.globalAlpha = 1;
  const im = hg.getImageData(0, 0, hw, hh), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const al = L.clamp((d[i] - 134) / 64); d[i] = 255; d[i + 1] = 247; d[i + 2] = 222; d[i + 3] = al * 255; }
  hg.putImageData(im, 0, 0);
  hg.globalAlpha = 0.3; hg.drawImage(facet, 0, 0, hw, hh); hg.globalAlpha = 1;
  hc._y0 = Y0;
  return { glaze, hi: hc, pearls };
}

// ───────────────────────── the rim: 紫口, its sheen, and the shadow it drops on the silk ─────────────────────────
function buildRim(env) {
  const a = env.arc;
  const Y0 = Math.floor(a.crestY) - 130, Y1 = Math.ceil(a.yAt(-PAD)) + 70;
  const full = (g) => g.fillRect(-PAD, Y0, LW, Y1 - Y0);
  const nz = L.makeNoise('s32rim');
  const s = a.span(PAD + 60), N = 260;
  const inner = (th) => { const u = th * a.R; return -(16.5 + 5 * nz.n2(u / 130, 1.7) + 2.6 * nz.n2(u / 34, 9.2) + 1.0 * nz.n2(u / 9, 4.4)); };
  const bandPath = (g, extra) => {
    g.beginPath(); a.trace(g, 6, -s, s);
    for (let i = N; i >= 0; i--) { const th = L.lerp(-s, s, i / N), p = a.pt(th, inner(th) - extra); g.lineTo(p.x, p.y); }
    g.closePath();
  };
  // the mouth: body colour showing through the thinned glaze, feathering into the cream below
  const mouth = band(Y0, Y1, (g) => {
    g.fillStyle = 'rgba(126,86,78,0.55)'; bandPath(g, 9); g.fill();
  });
  const m2 = blur(mouth, 5), mg = m2.getContext('2d');
  mg.translate(PAD, -Y0);
  put(mg, blur(band(Y0, Y1, (g) => {
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 26, a.R + 2, [[0, '#603f44'], [0.45, COL.mouth], [1, '#38222b']]);
    bandPath(g, 0); g.fill();
    // the body is not one flat colour: iron-dark flecks and thin places where a little glaze still clouds it
    g.save(); bandPath(g, 0); g.clip();
    const r = L.rng('s32mouth');
    for (let i = 0; i < 340; i++) {
      const th = r.range(-s, s), dr = -r.range(1, 19), len = r.range(8, 46), w = r.range(1, 3.4);
      a.at(g, th, dr, () => {
        g.fillStyle = r.chance(0.5) ? L.rgba('#2b1820', r.range(0.2, 0.55)) : L.rgba('#7c5a5e', r.range(0.15, 0.45));
        g.beginPath(); g.ellipse(0, 0, len, w, 0, 0, L.TAU); g.fill();
      });
    }
    g.restore();
  }), 0.9));
  // a crisp silhouette exactly on the arc
  mg.globalCompositeOperation = 'destination-out';
  mg.fillStyle = '#000'; a.pathAbove(mg, 0); mg.fill();
  mg.globalCompositeOperation = 'source-over';

  const rim = band(Y0, Y1, (g) => {
    // shadow on the silk: a tight contact shade all round, and the dish's own shadow thrown to the right by the key light
    g.save(); a.clipAbove(g, -5);
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R, a.R + 30, [[0, 'rgba(112,100,90,0.5)'], [0.3, 'rgba(112,100,90,0.22)'], [1, 'rgba(112,100,90,0)']]); full(g);
    g.fillStyle = L.radial(g, a.cx + 64, a.cy - 4, a.R - 22, a.R + 40, [[0, 'rgba(116,104,94,0.5)'], [0.36, 'rgba(116,104,94,0.4)'], [0.7, 'rgba(116,104,94,0.12)'], [1, 'rgba(116,104,94,0)']]); full(g);
    g.restore();
    put(g, m2);
    // the fat roll of glaze just inside the mouth catches the light
    g.save(); a.clipBelow(g, 0);
    const roll = blur(band(Y0, Y1, (t) => {
      t.strokeStyle = L.linear(t, 0, 0, W, 0, [[0, 'rgba(255,250,232,0.25)'], [0.3, 'rgba(255,250,232,0.85)'], [0.6, 'rgba(255,250,232,0.4)'], [1, 'rgba(255,250,232,0.12)']]);
      t.lineWidth = 13; t.beginPath();
      for (let i = 0; i <= N; i++) { const th = L.lerp(-s, s, i / N), p = a.pt(th, inner(th) - 21); if (i) t.lineTo(p.x, p.y); else t.moveTo(p.x, p.y); }
      t.stroke();
    }), 6);
    put(g, roll, 0.55, 'soft-light');
    // soft sheen on the lip itself
    const lip = blur(band(Y0, Y1, (t) => {
      t.strokeStyle = L.linear(t, 0, 0, W, 0, [[0, 'rgba(255,236,226,0.1)'], [0.27, 'rgba(255,240,230,0.75)'], [0.55, 'rgba(255,236,226,0.3)'], [1, 'rgba(255,236,226,0.06)']]);
      t.lineWidth = 2.4; a.stroke(t, -3.4, -s, s);
    }), 1.1);
    put(g, lip, 0.8, 'screen');
    g.restore();
  });
  return rim;
}

// ───────────────────────── the silk underneath ─────────────────────────
function buildSilk(env) {
  const a = env.arc;
  const Y0 = -PAD, Y1 = Math.ceil(a.yAt(-PAD)) + 60, BH = Y1 - Y0;
  // one repeat of a 2/2 twill (绫): every thread a rounded float with its own brightness
  const PX = 6, T = 384, nT = T / PX, r = L.rng('s32silk');
  const tw = [], tf = [];
  for (let i = 0; i < nT; i++) { tw.push(r.range(-1, 1)); tf.push(r.range(-1, 1)); }
  const img = new ImageData(T, T), d = img.data;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const ix = (x / PX) | 0, iy = (y / PX) | 0, fx = x / PX - ix, fy = y / PX - iy;
    const up = ((ix + iy) & 3) < 2;
    const prof = Math.sin((up ? fx : fy) * Math.PI);
    const v = L.clamp(0.5 + (up ? 0.16 : -0.14) + 0.5 * (prof - 0.64) + 0.14 * (up ? tw[ix] : tf[iy]));   // 0 = in the shade between threads, 1 = crown of a float
    const o = (y * T + x) * 4; d[o] = 226 + 29 * v; d[o + 1] = 222 + 33 * v; d[o + 2] = 210 + 45 * v; d[o + 3] = 255;
  }
  const tile = L.makeCanvas(T, T); tile.getContext('2d').putImageData(img, 0, 0);
  const sharp = band(Y0, Y1, (g) => {
    const full = () => g.fillRect(-PAD, Y0, LW, BH);
    g.fillStyle = '#f6f3e8'; full();      // the weave multiplies this down to 月白 #eeeadc on average
    g.save(); g.rotate(-0.13);
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.9;
    g.fillStyle = g.createPattern(tile, 'repeat'); g.fillRect(-600, -600, 3000, 2200);
    g.restore();
    // the slow lustre of the cloth
    g.save(); g.globalCompositeOperation = 'soft-light';
    g.globalAlpha = 0.07; g.drawImage(L.noiseTex(LW, BH, { seed: 's32slub', scale: 46, sx: 10, sy: 0.5, octaves: 3, res: 0.5, contrast: 1.6 }), -PAD, Y0);
    g.globalAlpha = 0.14; g.drawImage(L.noiseTex(LW, BH, { seed: 's32lustre', scale: 520, sx: 1.6, sy: 1, octaves: 3, res: 0.2, contrast: 1.4 }), -PAD, Y0);
    g.restore();
    // key light from the upper left
    g.fillStyle = L.radial(g, 380, 60, 100, 1500, [[0, 'rgba(255,255,252,0.6)'], [0.5, 'rgba(255,255,252,0.2)'], [1, 'rgba(255,255,252,0)']]); full();
    g.fillStyle = L.radial(g, 380, 60, 800, 2000, [[0, 'rgba(214,207,190,0)'], [1, 'rgba(214,207,190,0.42)']]); full();
  });
  return blur(sharp, 0.8);
}

export default {
  name: '哥窑金丝铁线',
  tone: 'dark',
  async init(env) {
    const net = buildNet(env);
    const gz = buildGlaze(env, net);
    const ys = Math.floor(env.arc.crestY) - 4;
    const scr = L.makeCanvas(W, H - ys);
    // bake the big layers into bitmaps: drawing canvas → canvas every frame forces a slow synchronous flush
    const bake = async (c) => { const b = await createImageBitmap(c); b._y0 = c._y0; return b; };
    S = { glaze: await bake(gz.glaze), hi: await bake(gz.hi), pearls: gz.pearls, rim: await bake(buildRim(env)), silk: await bake(buildSilk(env)), scr, sg: scr.getContext('2d'), ys };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.0045, 0.0045, p), zoom = L.lerp(1.0, 1.022, p);
    const lay = (g, c, o, sc = 1) => L.cam(g, env, o, () => g.drawImage(c, -PAD, c._y0, c.width * sc, c.height * sc));
    const T = [performance.now()];
    const tick = () => { ctx.getImageData(0, 0, 1, 1); T.push(performance.now()); };
    // silk: far below the rim, hardly moves
    lay(ctx, S.silk, { rot: rot * 0.3, zoom: 1 + (zoom - 1) * 0.3 });
    tick();
    // glaze — clipped on the true arc, so the push-in can never lift the edge off the line
    ctx.save(); a.clipBelow(ctx, 0);
    lay(ctx, S.glaze, { rot, zoom });
    tick();
    // a soft light wandering over the cushions of the blocks
    const lp = a.pt(L.lerp(-0.2, -0.05, p), -L.lerp(160, 215, p));
    const sg = S.sg;
    sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = 'source-over'; sg.clearRect(0, 0, W, S.scr.height);
    sg.translate(0, -S.ys);
    lay(sg, S.hi, { rot, zoom }, 2);
    sg.globalCompositeOperation = 'destination-in';
    sg.fillStyle = L.radial(sg, lp.x, lp.y, 0, 540, [[0, 'rgba(0,0,0,1)'], [0.45, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,0)']]);
    sg.fillRect(0, S.ys, W, H - S.ys);
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.5;
    ctx.drawImage(S.scr, 0, S.ys);
    ctx.globalAlpha = 1;
    tick();
    L.glow(ctx, lp.x, lp.y, 520, '#fff6dc', 0.2, 'soft-light');
    tick();
    // pearl points flash as the light passes
    L.cam(ctx, env, { rot, zoom }, () => {
      ctx.globalCompositeOperation = 'screen';
      for (const q of S.pearls) {
        const near = 1 - L.clamp(Math.hypot(q.x - lp.x, q.y - lp.y) / 620);
        const tw = Math.pow(Math.max(0, Math.cos((p * 0.9 + q.ph) * L.TAU)), 4) * q.k * (0.25 + 0.75 * near);
        if (tw < 0.05) continue;
        const rr = q.rad * 3.2;
        ctx.fillStyle = L.radial(ctx, q.x - 1, q.y - 1, 0, rr, [[0, `rgba(255,254,244,${0.95 * tw})`], [0.25, `rgba(255,248,222,${0.5 * tw})`], [1, 'rgba(255,244,210,0)']]);
        ctx.fillRect(q.x - rr, q.y - rr, rr * 2, rr * 2);
      }
    });
    ctx.restore();
    tick();
    // the mouth rim and its shadow: slides along the arc with the dish, never zooms → the edge stays exactly on the arc
    lay(ctx, S.rim, { rot });
    tick();
    L.vignette(ctx, { strength: 0.2, color: '#4a3a26', inner: 0.5 });
    tick();
    if (Math.abs(p - 0.5) < 0.01) console.log('s32 timing ' + T.slice(1).map((t, i) => (t - T[i]).toFixed(0)).join(' '));
  },
};
