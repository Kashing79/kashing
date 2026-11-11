// s26 — 青花分水. Macro of an underglaze-blue porcelain surface: two hand-thrown cobalt rings (弦纹, one broad, one narrow)
// ride the arc; under them a scrolling lotus (缠枝莲) painted the 分水 way — dark outlines first, then watery cobalt
// floated inside them in three strengths, each wash drying to a darker tide line, with a thin white "水路" left between
// wash and outline. Above the rings the glaze is left blank.
//
// How it is made: everything blue is first accumulated as PIGMENT DENSITY, not colour —
//   · the scroll is drawn into four masks (outline, wash 1/2/3) in painter's order, each new blade erasing what it covers;
//   · tide lines = mask × (1 − blurred mask); the masks are packed into the R/G/B channels of one canvas and read back once;
//   · the two rings are computed per pixel in polar coordinates (u = px along the arc, v = px below it): brush-hair streaks,
//     pooled edges, 飞白 where the brush runs dry, and a joint where the lap closes (接笔);
//   · density × granulation → one cobalt ramp (淡水 → 钴蓝 → 浓料). Glaze, bubbles, depth of field and sheen go on top.
import * as L from '../../../lib/core.js';

const { W, H, TAU } = L;
const PAD = 80;
const Y0 = 250;                         // the pigment work area starts at this frame row (nothing is painted higher up)
const MW = W + PAD * 2, MH = H + PAD - Y0;
const GAP = 9.5;                        // 水路: the white left between a wash and its outline
const TH = 84;                          // broad ring: v ∈ [0, TH]  → its upper edge IS the arc
const N_C = 128, N_H = 10;              // narrow ring: centre depth and half-width
const UJ = -560, UJ2 = 640;             // where each ring's lap closes
const DMAX = 1.45;
let S = null;

const sstep = (a, b, v) => { const t = L.clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const hash = (i, j) => { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/** smooth width profile through [[s, value]…] (Catmull-Rom) */
function prof(tab) {
  const n = tab.length, m = [];
  for (let i = 0; i < n; i++) { const p = tab[Math.max(0, i - 1)], q = tab[Math.min(n - 1, i + 1)]; m.push((q[1] - p[1]) / (q[0] - p[0])); }
  return (s) => {
    if (s <= tab[0][0]) return tab[0][1];
    if (s >= tab[n - 1][0]) return tab[n - 1][1];
    let i = 1; while (tab[i][0] < s) i++;
    const h = tab[i][0] - tab[i - 1][0], t = (s - tab[i - 1][0]) / h, t2 = t * t, t3 = t2 * t;
    return Math.max(0, (2 * t3 - 3 * t2 + 1) * tab[i - 1][1] + (t3 - 2 * t2 + t) * h * m[i - 1] + (-2 * t3 + 3 * t2) * tab[i][1] + (t3 - t2) * h * m[i]);
  };
}
const PETAL = prof([[0, 0.5], [0.16, 0.84], [0.4, 1], [0.64, 0.86], [0.82, 0.5], [0.93, 0.2], [1, 0]]);   // lotus petal with an ogee tip
const LEAF = prof([[0, 0.1], [0.12, 0.52], [0.36, 1], [0.6, 0.86], [0.8, 0.52], [0.93, 0.2], [1, 0]]);

/** polygon round a dense axis polyline: half-width wl(s) on one side, wr(s) on the other, s ∈ [0, sEnd] */
function ribbon(axis, wl, wr = wl, sEnd = 1) {
  const n = axis.length, A = [], B = [];
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1); if (s > sEnd + 1e-6) break;
    const p = axis[Math.max(0, i - 1)], q = axis[Math.min(n - 1, i + 1)];
    let nx = -(q[1] - p[1]), ny = q[0] - p[0]; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
    const l = wl(s), r = wr(s);
    A.push([axis[i][0] + nx * l, axis[i][1] + ny * l]); B.push([axis[i][0] - nx * r, axis[i][1] - ny * r]);
  }
  return { left: A, right: B, poly: A.concat(B.slice().reverse()) };
}
/** an axis that starts at (bu,bv) heading `ang` and curls by `curl` radians, mostly toward its tip */
function curlAxis(bu, bv, ang, len, curl, pw = 1.7) {
  const pts = [[bu, bv]], N = 16; let x = bu, y = bv;
  for (let i = 1; i <= N; i++) { const h = ang + curl * Math.pow((i - 0.5) / N, pw); x += (Math.cos(h) * len) / N; y += (Math.sin(h) * len) / N; pts.push([x, y]); }
  return pts;
}

// ───────────────────────── the two rings (per pixel, polar) ─────────────────────────
/** one pass of a loaded brush between edges e0..e1 (px below the arc): pooled edges, hair streaks, 飞白 when dry */
function lap(nb, u, v, e0, e1, load, dry, so, gr) {
  const c = L.clamp((v - e0) / 1.6 + 0.5) * L.clamp((e1 - v) / 1.6 + 0.5);
  if (c <= 0) return 0;
  const t = (v - e0) / (e1 - e0), ed = Math.abs(2 * t - 1);
  const hair = nb.fbm(u / 520 + so, v / 4.4 + so * 3.7, 3, 2.2, 0.55) * 0.5 + 0.5;
  const fine = nb.n2(u / 95 + so, v / 1.8) * 0.5 + 0.5;
  const dd = dry * (1 - 0.6 * ed * ed * ed);                       // the edges of a stroke hold their colour longest
  const fw = sstep(0.8 - 0.55 * dd, 0.93 - 0.55 * dd, hair * 0.8 + fine * 0.2 + 0.12 * (gr - 0.5));
  const body = load * (0.74 + 0.3 * Math.pow(ed, 2.6)) * (0.84 + 0.3 * hair) * (0.84 + 0.32 * gr);
  return c * (body * (1 - 0.95 * fw) + fw * 0.26 * sstep(0.55, 0.8, gr));
}
function ringDensity(nb, u, v, x, y) {
  let d = 0;
  const gr = nb.n2(x / 3.1, y / 3.1) * 0.5 + 0.5;                  // cobalt granulation
  if (v < TH + 16) {
    const rag = 1.1 * nb.n2(u / 13, 5.5);
    const w0 = 2.0 * nb.n2(u / 260, 1.3) + rag * 0.8;
    const w1 = 3.6 * nb.n2(u / 300, 21.1) + 1.6 * nb.n2(u / 60, 3.3) + rag;
    if (u < UJ + 190) {
      // the end of the turn: thinner colour, running dry, drifting off register and lifting just past the joint
      const tail = sstep(UJ - 900, UJ, u), lift = sstep(UJ + 10, UJ + 185, u), drift = sstep(UJ - 460, UJ, u);
      const e0 = w0 + 3 * drift + lift * TH * 0.36, e1 = TH + w1 - 5 * drift - lift * TH * 0.52;
      if (e1 - e0 > 1) d += lap(nb, u, v, e0, e1, 0.84 + 0.1 * nb.n2(u / 420, 9.9) - 0.16 * tail, 0.2 + 0.2 * nb.n2(u / 640, 15.5) + 0.42 * tail + 0.3 * lift, 0, gr);
    }
    if (u > UJ - 14) {
      // the fresh start: a blunt, heavily loaded head, then a long even run that slowly dries toward the right
      const k = u - UJ, blob = Math.exp(-(((k - 34) / 44) ** 2));
      const start = sstep(-8, 7, k - 6 * nb.n2(v / 9, 77.7));
      const e0 = w0 - 1.6 * blob, e1 = TH + w1 + 6 * blob;
      d += start * lap(nb, u, v, e0, e1, 1.0 + 0.24 * blob - 0.1 * sstep(0, 1200, k) + 0.08 * nb.n2(u / 420, 33.3),
        0.05 + 0.16 * (nb.n2(u / 640, 44.4) * 0.5 + 0.5) + 0.32 * sstep(500, 1750, k), 50, gr);
    }
  }
  if (v > N_C - 26 && v < N_C + 26) {
    const k = u - UJ2, blob = Math.exp(-(((k - 16) / 30) ** 2));
    const c0 = N_C + 2.2 * nb.n2(u / 330, 40.2) + 0.8 * nb.n2(u / 50, 47.1);
    const hw = N_H + 2.4 * nb.n2(u / 210, 51.7) + 3 * blob;
    const before = k < 0 ? sstep(-520, 0, k) : 0;
    d += lap(nb, u, v, c0 - hw, c0 + hw, 0.88 + 0.14 * nb.n2(u / 380, 60.6) + 0.3 * blob - 0.2 * before,
      0.12 + 0.3 * (nb.n2(u / 560, 70.7) * 0.5 + 0.5) + 0.4 * before, 120, gr);
  }
  return d;
}

// ───────────────────────── the pigment layer ─────────────────────────
function buildPigment(env) {
  const a = env.arc, R = a.R;
  const P = (u, v) => { const th = u / R, r = R - v; return [a.cx + r * Math.sin(th), a.cy - r * Math.cos(th)]; };
  const mk = () => { const g = L.makeCanvas(MW, MH).getContext('2d'); g.translate(PAD, -Y0); g.lineJoin = 'round'; g.lineCap = 'round'; return g; };
  const LN = mk(), W1 = mk(), W2 = mk(), W3 = mk();
  const nzB = L.makeNoise('s26blade');

  const trace = (g, uv) => { g.beginPath(); for (let i = 0; i < uv.length; i++) { const q = P(uv[i][0], uv[i][1]); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); } g.closePath(); };
  /** a new shape goes on top: clear what it covers, and keep the washes underneath a 水路 away from it */
  const erase = (uv, gap = GAP) => {
    for (const g of [LN, W1, W2, W3]) {
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; trace(g, uv); g.fill();
      if (g !== LN && gap) { g.strokeStyle = '#000'; g.lineWidth = gap * 2; g.stroke(); }
      g.globalCompositeOperation = 'source-over';
    }
  };
  const fill = (g, uv, alpha = 1) => { g.fillStyle = `rgba(255,255,255,${alpha})`; trace(g, uv); g.fill(); };
  const dot = (u, v, r, alpha = 1) => { const q = P(u, v); LN.fillStyle = `rgba(255,255,255,${alpha})`; LN.beginPath(); LN.arc(q[0], q[1], r, 0, TAU); LN.fill(); };
  let nLine = 0;
  const line = (uv, w, o = {}) => {
    L.inkStroke(LN, uv.map((q) => P(q[0], q[1])), { width: w, color: '#fff', seed: 's26l' + (nLine++), taper: o.taper || [0.04, 0.3], wobble: o.wobble === undefined ? 0.3 : o.wobble, alpha: o.alpha === undefined ? 0.95 : o.alpha, smoothStep: 2.5 });
    if (o.head) dot(uv[0][0], uv[0][1], w * 0.66, 0.55);          // 顿: the brush sits a moment where the stroke begins
  };

  /** one outlined, water-shaded blade (petal or leaf) along a control polyline */
  let nBlade = 0;
  function blade(ctrl, hw, PROF, o = {}) {
    const { e = [0.9, 0.58, 0.3], al = [1, 1, 1], lw = 7, la = 0.95, side = 0, rib = 0 } = o;
    const k = (nBlade++) * 3.71 + 0.5;
    const axis = L.smoothPath(ctrl, 4);
    const wf = (s) => hw * PROF(s);
    const out = ribbon(axis, wf);
    erase(out.poly);
    const cap = (x) => (x >= 1 ? 0 : Math.sqrt(1 - x * x * x * x * x));
    const in1 = (s) => Math.max(0, wf(s) - GAP + 1.6 * nzB.n2(s * 5, k));
    if (al[0]) fill(W1, ribbon(axis, (s) => in1(s) * cap(s / e[0]), undefined, e[0]).poly, al[0]);
    if (al[1]) {
      const full = (s) => in1(s) * (side ? 0.97 : 0.8) * cap(s / e[1]), back = (s) => -in1(s) * 0.1 * cap(s / e[1]);
      fill(W2, ribbon(axis, side < 0 ? back : full, side > 0 ? back : full, e[1]).poly, al[1]);
    }
    if (al[2]) {
      const full = (s) => in1(s) * (side ? 0.94 : 0.56) * cap(s / e[2]), back = (s) => -in1(s) * 0.42 * cap(s / e[2]);
      fill(W3, ribbon(axis, side < 0 ? back : full, side > 0 ? back : full, e[2]).poly, al[2]);
    }
    line(out.left, lw, { alpha: la, head: la > 0.6 });
    line(out.right, lw, { alpha: la });
    if (rib) line(axis.slice(2, Math.floor(axis.length * 0.8)), lw * 0.62, { alpha: la * 0.9, taper: [0.03, 0.55] });
  }
  const pet = (fu, fv, phi, r0, r1, hw, bend, o) => {
    const b = [fu + r0 * Math.sin(phi), fv - r0 * Math.cos(phi)], t = [fu + r1 * Math.sin(phi), fv - r1 * Math.cos(phi)];
    blade([b, [(b[0] + t[0]) / 2 + (t[1] - b[1]) * bend, (b[1] + t[1]) / 2 - (t[0] - b[0]) * bend], t], hw, PETAL, o);
  };
  const leaf = (bu, bv, ang, len, hw, curl, o = {}) => blade(curlAxis(bu, bv, ang, len, curl), hw, LEAF, { e: [0.95, 0.7, 0.36], rib: 1, side: curl > 0 ? 1 : -1, ...o });

  /** lotus seen from the front: two tiers of eight broad pointed petals round a seed pod ringed with stamens */
  function lotusFront(fu, fv, Rf, rot, seed) {
    const r = L.rng(seed), N = 8;
    const up = (p) => Math.abs(Math.atan2(Math.sin(p), Math.cos(p)));
    const tier = (off, r0, r1, hw) => {
      const items = [];
      for (let i = 0; i < N; i++) items.push({ phi: rot + ((i + off + r.range(-0.07, 0.07)) * TAU) / N, k: r.range(0.95, 1.05), b: r.range(-0.06, 0.06), e1: r.range(0.52, 0.64), e2: r.range(0.25, 0.34) });
      items.sort((p, q) => up(q.phi) - up(p.phi));                 // lowest petals first, the top one last → it sits in front
      for (const it of items) pet(fu, fv, it.phi, Rf * r0, Rf * r1 * it.k, Rf * hw, it.b, { e: [0.9, it.e1, it.e2] });
    };
    tier(0, 0.34, 1.0, 0.27);
    tier(0.5, 0.13, 0.68, 0.2);
    const circ = (rad, n = 44, cu = fu, cv = fv) => { const pts = []; for (let i = 0; i < n; i++) { const t = (i / n) * TAU; pts.push([cu + rad * Math.sin(t), cv - rad * Math.cos(t)]); } return pts; };
    erase(circ(Rf * 0.3), 0);
    for (let i = 0; i < 20; i++) {                                   // stamens
      const t = ((i + r.range(-0.2, 0.2)) / 20) * TAU, r0 = Rf * 0.218, r1 = Rf * r.range(0.262, 0.286);
      line([[fu + r0 * Math.sin(t), fv - r0 * Math.cos(t)], [fu + r1 * Math.sin(t), fv - r1 * Math.cos(t)]], 4, { taper: [0, 0], alpha: 0.9 });
      dot(fu + r1 * Math.sin(t), fv - r1 * Math.cos(t), 4.6, 0.95);
    }
    const rp = Rf * 0.19;                                            // seed pod
    fill(W1, circ(rp - GAP * 0.75), 1);
    fill(W2, circ(rp * 0.66, 30, fu + rp * 0.16, fv + rp * 0.2), 1);
    const ring = circ(rp, 48); ring.push(ring[0], ring[1], ring[2]);
    line(ring, 6.5, { taper: [0, 0], wobble: 0.25 });
    dot(fu, fv, 5.6);
    for (let i = 0; i < 6; i++) { const t = ((i + 0.3) / 6) * TAU; dot(fu + rp * 0.56 * Math.sin(t), fv - rp * 0.56 * Math.cos(t), r.range(4.6, 5.8)); }
  }

  // ── the scroll, back to front ──
  const nzS = L.makeNoise('s26stem');
  const vs = (u) => 520 - 325 * Math.cos((u / 2600) * TAU);         // the main stem: one long wave arching over the flower
  { const pts = []; for (let u = -1500; u <= 1500; u += 30) pts.push([u, vs(u) + 5 * nzS.n2(u / 170, 3.1)]); line(pts, 15, { taper: [0, 0], wobble: 0.22, alpha: 1 }); }
  // the flower's own stalk spirals down inside the pocket on the left
  line([[-292, vs(-292)], [-336, 372], [-318, 470], [-250, 548], [-150, 590]], 12, { taper: [0, 0.1], wobble: 0.22, alpha: 1 });
  // curled leaves
  leaf(352, vs(352), -0.42, 350, 58, 2.0);
  leaf(318, vs(318) + 4, 1.75, 215, 38, -1.9);
  leaf(840, 500, -1.72, 350, 56, 2.3);
  leaf(-365, vs(-365), Math.PI + 0.38, 335, 55, -1.85);
  leaf(-815, 500, -1.45, 340, 54, -2.2);
  // the flower
  lotusFront(0, 462, 225, 0.05, 's26lotus');
  // a breath of the next band, far out on either side above the rings
  blade(curlAxis(-1180, -330, 0.22, 430, 2.0), 52, LEAF, { e: [0.95, 0, 0], al: [0.6, 0, 0], la: 0.3, lw: 6 });
  blade(curlAxis(1175, -318, Math.PI - 0.26, 410, -1.9), 50, LEAF, { e: [0.95, 0, 0], al: [0.55, 0, 0], la: 0.28, lw: 6 });

  // ── pack the masks: R = outline, G = wash strength, B = tide lines ──
  const comp = L.makeCanvas(MW, MH), cg = comp.getContext('2d');
  cg.fillStyle = '#000'; cg.fillRect(0, 0, MW, MH);
  const sg = L.makeCanvas(MW, MH).getContext('2d');
  const add = (mask, color, alpha) => {
    sg.globalCompositeOperation = 'copy'; sg.drawImage(mask, 0, 0);
    sg.globalCompositeOperation = 'source-in'; sg.fillStyle = color; sg.fillRect(0, 0, MW, MH);
    cg.globalCompositeOperation = 'lighter'; cg.globalAlpha = alpha; cg.drawImage(sg.canvas, 0, 0);
  };
  const rim = (mask, px) => { const g = L.makeCanvas(MW, MH).getContext('2d'); g.drawImage(mask, 0, 0); g.globalCompositeOperation = 'destination-out'; g.drawImage(L.blurred(mask, px), 0, 0); return g.canvas; };
  add(LN.canvas, '#ff0000', 1);
  add(L.blurred(W1.canvas, 1.2), '#00ff00', 0.2);
  add(L.blurred(W2.canvas, 1.2), '#00ff00', 0.26);
  add(L.blurred(W3.canvas, 1.2), '#00ff00', 0.3);
  add(rim(W1.canvas, 4), '#0000ff', 1); add(rim(W1.canvas, 16), '#0000ff', 0.45);
  add(rim(W2.canvas, 4), '#0000ff', 1); add(rim(W3.canvas, 4), '#0000ff', 1);
  cg.globalAlpha = 0.2; cg.drawImage(L.blurred(comp, 4), 0, 0);    // 晕散: the blue bleeds a little into the glaze
  cg.globalAlpha = 1; cg.globalCompositeOperation = 'source-over';

  // ── density ──
  const src = cg.getImageData(0, 0, MW, MH).data;
  const read = (o) => L.noiseTex(MW, MH, o).getContext('2d').getImageData(0, 0, MW, MH).data;
  const lo = read({ seed: 's26lo', scale: 150, octaves: 3, res: 0.25, warp: 0.7, contrast: 1.5 });      // where the water pooled
  const mi = read({ seed: 's26mi', scale: 9, octaves: 2, res: 0.5, contrast: 1.7 });                    // pigment mottle
  const dens = new Float32Array(MW * MH);
  for (let k = 0, o = 0; k < MW * MH; k++, o += 4) {
    const ln = src[o], wa = src[o + 1], rm = src[o + 2];
    if (ln + wa + rm < 3) continue;
    const l = lo[o] / 255, m = mi[o] / 255, w = wa / 255;
    dens[k] = w * (0.66 + 0.68 * l) + (rm / 255) * (0.5 + m) + w * sstep(0.6, 0.86, l * 0.5 + m * 0.5) * 0.3 + (ln / 255) * (0.74 + 0.5 * m);
  }
  const nb = L.makeNoise('s26ring');
  for (let i = 0; i < MW; i++) {
    const x = i - PAD, dx = x - a.cx;
    const j0 = Math.max(0, Math.floor(a.yAt(x) - Y0 - 8)), j1 = Math.min(MH - 1, j0 + 200);
    for (let j = j0; j <= j1; j++) {
      const y = j + Y0, dy = a.cy - y, v = R - Math.sqrt(dx * dx + dy * dy);
      if (v < -6 || v > N_C + 26) continue;
      const d = ringDensity(nb, Math.atan2(dx, dy) * R, v, x, y);
      if (d > 0) dens[j * MW + i] += d;
    }
  }

  // ── density → cobalt ──
  const ramp = L.makeRamp([[0, 'rgba(150,180,232,0)'], [0.03, 'rgba(150,180,232,0.5)'], [0.11, 'rgba(134,166,220,0.97)'], [0.2, '#5f86d2'], [0.32, '#3059bd'],
    [0.42, '#1c3fa0'], [0.56, '#152f80'], [0.7, '#0e1c50'], [1, '#070d2c']]);
  const NL = 1024, lut = new Uint8ClampedArray(NL * 4);
  for (let i = 0; i < NL; i++) { const c = ramp(i / (NL - 1)); lut[i * 4] = c[0]; lut[i * 4 + 1] = c[1]; lut[i * 4 + 2] = c[2]; lut[i * 4 + 3] = c[3] * 255; }
  const out = new ImageData(MW, MH), od = out.data;
  for (let j = 0, k = 0; j < MH; j++) for (let i = 0; i < MW; i++, k++) {
    const d = dens[k]; if (d <= 0.002) continue;
    const q = Math.min(NL - 1, ((d * (0.9 + 0.2 * hash(i, j))) / DMAX) * (NL - 1) | 0) * 4, o = k * 4;
    od[o] = lut[q]; od[o + 1] = lut[q + 1]; od[o + 2] = lut[q + 2]; od[o + 3] = lut[q + 3];
  }
  const pig = L.makeCanvas(MW, MH);
  pig.getContext('2d').putImageData(out, 0, 0);
  return pig;
}

// ───────────────────────── glaze, light, focus ─────────────────────────
function buildLayer(env, pig) {
  const a = env.arc;
  const layer = L.makeLayer(PAD, (g) => {
    const full = () => g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    g.fillStyle = '#e4edf2'; full();
    // the body turns gently away from the key light: clear upper left, 釉影 gathering toward the lower right
    g.fillStyle = L.linear(g, 150, 0, W - 150, H, [[0, 'rgba(244,249,252,0.9)'], [0.42, 'rgba(228,237,242,0)'], [1, 'rgba(186,204,218,0.92)']]); full();
    g.globalAlpha = 0.5;
    g.drawImage(L.noiseLayer(PAD, { seed: 's26cloud', scale: 460, octaves: 3, res: 0.2, warp: 0.5, ramp: [[0, 'rgba(196,212,224,0.55)'], [0.5, 'rgba(214,226,234,0)'], [1, 'rgba(248,251,253,0.5)']] }), -PAD, -PAD);
    g.globalAlpha = 1;
    g.drawImage(pig, -PAD, Y0);
    // the glaze over the painting: pin-holes, bubbles (they only show over the blue), a faint orange-peel
    const clear = (x, y) => !(x > 590 && x < 1330 && y > a.crestY - 300 && y < a.crestY - 2);   // keep the caption area spotless
    L.speckle(g, { seed: 's26pin', count: 150, x: -PAD, y: -PAD, w: W + PAD * 2, h: H + PAD * 2, rMin: 0.9, rMax: 2.4, colors: ['#9fb3c6', '#8a9db4', '#b3c4d4'], alpha: [0.25, 0.65], test: clear });
    L.speckle(g, { seed: 's26bub', count: 6500, x: -PAD, y: -PAD, w: W + PAD * 2, h: H + PAD * 2, rMin: 0.6, rMax: 2.0, colors: ['#ffffff', '#e6f0ff'], alpha: [0.08, 0.42] });
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.34;
    g.drawImage(L.bumpLight(L.noiseLayer(PAD, { seed: 's26peel', scale: 16, octaves: 2, res: 0.5 }), { angle: 45, strength: 1.5, res: 0.5 }), -PAD, -PAD);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  });
  // shallow focus: sharp round the crest, softening toward the sides and the bottom corners
  const lg = layer.getContext('2d');
  const soft = (px, r0, r1) => {
    const b = L.blurred(layer, px), bg = b.getContext('2d');
    bg.globalCompositeOperation = 'destination-in';
    bg.translate(PAD + a.cx, PAD + a.crestY + 60); bg.scale(1, 0.62);
    bg.fillStyle = L.radial(bg, 0, 0, r0, r1, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]);
    bg.fillRect(-3000, -3000, 6000, 6000);
    return b;
  };
  const s1 = soft(2.2, 520, 1000), s2 = soft(5, 860, 1350);
  lg.drawImage(s1, -PAD, -PAD); lg.drawImage(s2, -PAD, -PAD);
  return layer;
}

export default {
  name: '青花分水',
  tone: 'dark',
  init(env) {
    S = { layer: buildLayer(env, buildPigment(env)) };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    L.blit(ctx, env, S.layer, { rot: L.lerp(-0.0038, 0.0038, p) });
    // 釉光: one soft window reflection lying across the rings, drifting along the arc
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    a.at(ctx, L.lerp(-0.215, -0.175, p), -96, () => {
      ctx.rotate(0.07); ctx.scale(1, 0.2);
      ctx.fillStyle = L.radial(ctx, 0, 0, 0, 620, [[0, 'rgba(255,255,255,0.5)'], [0.3, 'rgba(248,252,255,0.3)'], [1, 'rgba(240,248,255,0)']]);
      ctx.fillRect(-620, -620, 1240, 1240);
    });
    ctx.restore();
  },
};
