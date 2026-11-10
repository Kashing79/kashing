// s31 — 剪纸拼贴·水乡. A hand-made paper collage of a Jiangnan water town.
// Cream card above; the arc is the torn top edge of one big sheet of indigo paper (white core showing along the tear).
// On the blue sheet: white-wall / black-roof houses, a pale moon, a brown stone-arch bridge with a boat under it,
// a willow, a few red lanterns and a scrap of pencil hatching — every scrap is its own piece of paper with fibre,
// a thin lit edge and a soft drop shadow, stacked in a clear order.
import * as L from '../lib/core.js';

const { W, H, TAU } = L;
const PAD = 240;
const GW = W + PAD * 2, GH = H + PAD * 2;
let S = null;

const C = {
  card: '#efe8d8', blue: '#24509a', white: '#f6f3ea', black: '#1c1b1a', moon: '#f2e27a',
  red: '#c8261c', green: '#3f9a54', brown: '#6a3a1e',
};

// ───────────────────────── shared paper textures (grey, 128 = neutral) ─────────────────────────
function buildTextures() {
  // 1) grain: paper tooth (relief-lit fine noise) + tonal mottling + loose fibres
  const grain = L.makeCanvas(GW, GH); const g = grain.getContext('2d');
  const tooth = L.bumpLight(L.noiseTex(GW / 2, GH / 2, { seed: 's31tooth', scale: 2.3, octaves: 2, gain: 0.6, res: 1, contrast: 1.4 }), { angle: 225, strength: 0.22, res: 1 });
  g.imageSmoothingQuality = 'high';
  g.drawImage(tooth, 0, 0, GW, GH);
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.8;
  g.drawImage(L.noiseTex(GW, GH, { seed: 's31mot', scale: 240, octaves: 3, res: 0.1, contrast: 1.3, ramp: [[0, '#626262'], [1, '#9e9e9e']] }), 0, 0);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  const r = L.rng('s31fib'); g.lineCap = 'round';
  for (let i = 0; i < 11000; i++) {
    const x = r() * GW, y = r() * GH, len = r.range(4, 26), a = r() * Math.PI;
    g.strokeStyle = r.chance(0.55) ? `rgba(255,255,255,${r.range(0.08, 0.3).toFixed(3)})` : `rgba(0,0,0,${r.range(0.06, 0.22).toFixed(3)})`;
    g.lineWidth = r.range(0.5, 1.3);
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + r.range(-4, 4), y + Math.sin(a) * len * 0.5 + r.range(-4, 4), x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  // 2) crumple: flat-shaded voronoi facets with a thin lit crease between them (paper that was creased, then flattened)
  const res = 0.25, cw = Math.round(GW * res), ch = Math.round(GH * res);
  const nz = L.makeNoise('s31crumple');
  const img = new ImageData(cw, ch); const d = img.data;
  let k = 0;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const u0 = x / res / 210, v0 = y / res / 210;
    const u = u0 + 0.32 * nz.n2(u0 * 0.8 + 3.1, v0 * 0.8), v = v0 + 0.32 * nz.n2(u0 * 0.8 - 5.2, v0 * 0.8 + 9.4);
    const c1 = nz.cell(u, v), c2 = nz.cell(u * 2.4 + 11.3, v * 2.4 + 7.1);
    let s = 128 + (c1.id - 0.5) * 64 + (c2.id - 0.5) * 30;
    s += 34 * Math.exp(-(c1.edge * c1.edge) / 0.0016) + 14 * Math.exp(-(c2.edge * c2.edge) / 0.003);
    d[k++] = s; d[k++] = s; d[k++] = s; d[k++] = 255;
  }
  const small = L.makeCanvas(cw, ch); small.getContext('2d').putImageData(img, 0, 0);
  const crumple = L.makeCanvas(GW, GH); const cg = crumple.getContext('2d');
  cg.imageSmoothingQuality = 'high'; cg.filter = 'blur(1.4px)';
  cg.drawImage(small, 0, 0, GW, GH);
  return { grain, crumple };
}

// ───────────────────────── geometry helpers ─────────────────────────
function dens(pts, step = 12) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let j = 0; j < n; j++) out.push([L.lerp(a[0], b[0], j / n), L.lerp(a[1], b[1], j / n)]);
  }
  return out;
}
/** scissor-cut outline: the polygon, densified, with a slow wander of a pixel or two (amp) — or a ragged tear (torn) */
function cut(pts, seed, amp = 1.5, period = 95, step = 12, torn = 0) {
  const d = dens(pts, torn ? 3.5 : step); const n = d.length; const nz = L.makeNoise('s31cut' + seed);
  const len = [0];
  for (let i = 1; i <= n; i++) len.push(len[i - 1] + Math.hypot(d[i % n][0] - d[i - 1][0], d[i % n][1] - d[i - 1][1]));
  const total = len[n];
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = d[(i - 1 + n) % n], b = d[(i + 1) % n];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
    const s = len[i]; const win = L.smooth(Math.min(s, total - s) / 30);
    let o = amp * nz.n2(s / period, 1.7) + amp * 0.35 * nz.n2(s / (period * 0.2), 8.3);
    if (torn) o += torn * (nz.n2(s / 13, 4.4) + 0.6 * nz.n2(s / 4.6, 6.1));
    out.push([d[i][0] + nx * o * win, d[i][1] + ny * o * win]);
  }
  return out;
}
function chaikin(pts, k = 0.22) {
  const out = []; const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    out.push([L.lerp(a[0], b[0], k), L.lerp(a[1], b[1], k)], [L.lerp(a[0], b[0], 1 - k), L.lerp(a[1], b[1], 1 - k)]);
  }
  return out;
}
/** a circle the way scissors make it: a many-sided polygon with softened corners */
function roundish(cx, cy, rx, ry, n, seed) {
  const r = L.rng('s31round' + seed); const pts = [];
  const a0 = r() * TAU;
  for (let i = 0; i < n; i++) {
    const a = a0 + ((i + r.range(-0.2, 0.2)) / n) * TAU; const q = r.range(0.965, 1.03);
    pts.push([cx + rx * q * Math.cos(a), cy + ry * q * Math.sin(a)]);
  }
  return chaikin(pts, 0.2);
}
/** tapered strip along a centre line: pts [[x,y]...] (smoothed), wf(t) → full width */
function strip(ctrl, wf, step = 8) {
  const p = L.smoothPath(ctrl, step); const n = p.length; const A = [], B = [];
  for (let i = 0; i < n; i++) {
    const a = p[Math.max(0, i - 1)], b = p[Math.min(n - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
    const hw = wf(i / (n - 1)) / 2;
    A.push([p[i][0] + nx * hw, p[i][1] + ny * hw]); B.push([p[i][0] - nx * hw, p[i][1] - ny * hw]);
  }
  return A.concat(B.reverse());
}
const quad = (p0, p1, p2, n = 14) => { const o = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; o.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]); } return o; };

// ───────────────────────── one piece of paper ─────────────────────────
let T = null;       // textures
let pieceNo = 0;
/**
 * Glue a piece of paper onto the layer. polys = one closed polyline or several (even-odd → holes).
 * o: color, sh (shadow strength), lift (how far the piece stands off the sheet), tex (fibre strength),
 *    crumple (0..1), edge (lit/shaded rim strength), curl (0..1 light falling across the piece)
 */
function paper(g, polys, o) {
  if (typeof polys[0][0] === 'number') polys = [polys];
  const { color, sh = 1, lift = 1, tex = 0.42, crumple = 0, edge = 1, curl = 1, peel = null } = o;
  const r = L.rng('s31pp' + (o.seed !== undefined ? o.seed : pieceNo++));
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of polys) for (const q of p) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hw = (x1 - x0) / 2 + 6, hh = (y1 - y0) / 2 + 6;
  const build = () => {
    g.beginPath();
    for (const p of polys) { g.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) g.lineTo(p[i][0], p[i][1]); g.closePath(); }
  };
  // a corner that has come unstuck: a deeper, softer shadow under it …
  if (peel) for (const [px, py, pr] of peel) {
    g.save(); g.filter = 'blur(8px)'; g.translate(9, 14);
    g.fillStyle = L.radial(g, px - 9, py - 14, 0, pr, [[0, 'rgba(4,8,26,0.5)'], [0.5, 'rgba(4,8,26,0.26)'], [1, 'rgba(4,8,26,0)']]);
    build(); g.fill('evenodd'); g.restore();
  }
  // soft shadow of the lifted sheet + tight contact shadow
  g.save();
  g.fillStyle = color;
  g.shadowColor = `rgba(4,8,26,${(0.34 * sh).toFixed(3)})`; g.shadowBlur = 17 * lift; g.shadowOffsetX = 5 * lift; g.shadowOffsetY = 9 * lift;
  build(); g.fill('evenodd');
  g.shadowColor = `rgba(4,8,26,${(0.5 * sh).toFixed(3)})`; g.shadowBlur = 2.6; g.shadowOffsetX = 1.2; g.shadowOffsetY = 2.2;
  build(); g.fill('evenodd');
  g.restore();
  // everything else stays inside the piece
  g.save(); build(); g.clip('evenodd');
  const place = (texCanvas, alpha, mode) => {
    let k = r.int(0, 3); if ((k & 1) && (hw > GH / 2 - 12 || hh > GW / 2 - 12)) k -= 1;
    const aw = (k & 1 ? GH : GW) / 2, ah = (k & 1 ? GW : GH) / 2;
    const ox = r.range(-1, 1) * Math.max(0, aw - hw), oy = r.range(-1, 1) * Math.max(0, ah - hh);
    g.save(); g.globalCompositeOperation = mode; g.globalAlpha = alpha;
    g.translate(cx + ox, cy + oy); g.rotate((k * Math.PI) / 2); if (r.chance(0.5)) g.scale(-1, 1);
    g.drawImage(texCanvas, -GW / 2, -GH / 2);
    g.restore();
  };
  if (crumple > 0) place(T.crumple, crumple, 'hard-light');
  if (tex > 0) place(T.grain, tex, 'hard-light');
  if (curl > 0) {
    // the sheet is never perfectly flat: light falls off across it
    const a = L.deg(48) + r.range(-0.6, 0.6), rad = Math.hypot(hw, hh);
    const dx = Math.cos(a) * rad, dy = Math.sin(a) * rad;
    g.fillStyle = L.linear(g, cx - dx, cy - dy, cx + dx, cy + dy, [[0, `rgba(255,252,240,${(0.11 * curl).toFixed(3)})`], [0.45, 'rgba(255,252,240,0)'], [0.6, 'rgba(0,0,20,0)'], [1, `rgba(0,0,20,${(0.16 * curl).toFixed(3)})`]]);
    g.fillRect(x0 - 8, y0 - 8, x1 - x0 + 16, y1 - y0 + 16);
  }
  // … and the lifted corner itself turns toward the light
  if (peel) for (const [px, py, pr] of peel) {
    g.fillStyle = L.radial(g, px, py, 0, pr * 0.85, [[0, 'rgba(255,255,250,0.22)'], [0.6, 'rgba(255,255,250,0.07)'], [1, 'rgba(255,255,250,0)']]);
    g.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  }
  if (edge > 0) {
    // paper thickness: the cut edge catches light on the upper-left and falls into shade on the lower-right
    g.lineJoin = 'round'; g.lineWidth = 1.9;
    g.save(); g.translate(1.1, 1.5); g.strokeStyle = `rgba(255,255,255,${(0.4 * edge).toFixed(3)})`; build(); g.stroke(); g.restore();
    g.save(); g.translate(-1.1, -1.5); g.strokeStyle = `rgba(0,0,10,${(0.2 * edge).toFixed(3)})`; build(); g.stroke(); g.restore();
  }
  g.restore();
}

// ───────────────────────── shapes ─────────────────────────
const box = (x0, y0, x1, y1, r, j = 5) => [[x0 + r.range(-j, j), y0 + r.range(-j, j)], [x1 + r.range(-j, j), y0 + r.range(-j, j)], [x1 + r.range(-j, j), y1], [x0 + r.range(-j, j), y1]];

/** front-facing tiled roof: a black trapezoid whose eave (bottom edge) is cut into a row of scallops (the tile ends) */
function eaveRoof(tl, tr, br, bl, n) {
  const pts = [tl, tr, br];
  const ex = (bl[0] - br[0]) / n, ey = (bl[1] - br[1]) / n; const seg = Math.hypot(ex, ey), rad = seg / 2;
  const ux = ex / seg, uy = ey / seg; const nx = uy, ny = -ux; // points "down" for a right-to-left edge
  for (let i = 0; i < n; i++) {
    const mx = br[0] + ex * (i + 0.5), my = br[1] + ey * (i + 0.5);
    for (let k = 1; k <= 6; k++) { const a = (k / 7) * Math.PI; pts.push([mx - ux * rad * Math.cos(a) - nx * rad * 0.82 * Math.sin(a), my - uy * rad * Math.cos(a) - ny * rad * 0.82 * Math.sin(a)]); }
    pts.push([br[0] + ex * (i + 1), br[1] + ey * (i + 1)]);
  }
  return pts;
}

/** stone arch bridge in side view: flat crown, stepped approaches, near-semicircular opening open to the water */
function bridgeShape(cx, yb, apexY, R0) {
  const r = L.rng('s31bridge'); const n = 12, half = 86, run = 39, total = 264;
  const f = (t) => 0.45 * t + 0.55 * (3 * t * t - 2 * t * t * t);
  const side = (sgn) => {
    const pts = [[cx + sgn * half, apexY + r.range(-1.5, 1.5)]]; let x = cx + sgn * half;
    for (let i = 1; i <= n; i++) {
      const y = apexY + total * f(i / n) + r.range(-1.6, 1.6);
      pts.push([x + r.range(-1.2, 1.2), y]);
      x += sgn * (run + r.range(-2.5, 2.5));
      pts.push([x, y + r.range(-1.2, 1.2)]);
    }
    pts.push([x + sgn * 7, yb]);
    return pts;
  };
  const left = side(-1).reverse(), right = side(1);
  const cyA = yb - 12; const nz = L.makeNoise('s31arch');
  const rad = (ph) => R0 * (1 + 0.011 * nz.n2(ph * 1.4, 2.2));
  const arch = [[cx + rad(0), yb]];
  for (let i = 0; i <= 44; i++) { const ph = (i / 44) * Math.PI; arch.push([cx + rad(ph) * Math.cos(ph), cyA - rad(ph) * Math.sin(ph)]); }
  arch.push([cx - rad(Math.PI), yb]);
  // voussoir ring: a lighter strip glued round the opening
  const ring = [];
  for (let i = 0; i <= 44; i++) { const ph = (i / 44) * Math.PI; ring.push([cx + rad(ph) * Math.cos(ph), cyA - rad(ph) * Math.sin(ph)]); }
  ring.unshift([cx + rad(0), yb]); ring.push([cx - rad(Math.PI), yb]);
  const outer = [];
  for (let i = 44; i >= 0; i--) { const ph = (i / 44) * Math.PI; const q = rad(ph) + 31 + 2.5 * nz.n2(ph * 2.3, 9.9); outer.push([cx + q * Math.cos(ph), cyA - q * Math.sin(ph)]); }
  outer.unshift([cx - rad(Math.PI) - 31, yb]); outer.push([cx + rad(0) + 31, yb]);
  return { body: left.concat(right, arch), ring: ring.concat(outer), cyA, rad };
}

// ───────────────────────── the collage ─────────────────────────
function buildCollage(env) {
  const a = env.arc;
  return L.makeLayer(PAD, (g) => {
    // ── the torn edge of the big blue sheet: coloured skin (drB) and the white core that outruns it (drW) ──
    const nz = L.makeNoise('s31tear');
    const s = a.span(PAD + 170); const n = Math.ceil((2 * s * a.R) / 2);
    const eB = [], eW = [], prof = [];
    for (let i = 0; i <= n; i++) {
      const th = L.lerp(-s, s, i / n), al = th * a.R;
      const bite = Math.max(0, nz.n2(al / 170, 4.2) - 0.3) * 8;        // stretches where the blue skin peeled back further
      const drB = Math.max(-8, -0.3 + 2.1 * nz.fbm(al / 46, 1.3, 3) + 1.2 * nz.n2(al / 6.5, 7.7) - bite);
      const drW = Math.min(6.5, drB + 2.8 + bite * 0.85 + 2.6 * (0.5 + 0.5 * nz.n2(al / 21, 12.1)) + 1.0 * nz.n2(al / 4.3, 3.3));
      const pb = a.pt(th, drB), pw = a.pt(th, drW);
      eB.push([pb.x, pb.y]); eW.push([pw.x, pw.y]); prof.push([th, drB, drW]);
    }
    const sheet = (e) => { g.beginPath(); g.moveTo(e[0][0], e[0][1]); for (let i = 1; i < e.length; i++) g.lineTo(e[i][0], e[i][1]); g.lineTo(e[e.length - 1][0], H + PAD + 60); g.lineTo(e[0][0], H + PAD + 60); g.closePath(); };
    const line = (e) => { g.beginPath(); g.moveTo(e[0][0], e[0][1]); for (let i = 1; i < e.length; i++) g.lineTo(e[i][0], e[i][1]); };
    // faint contact shadow of the sheet on the card
    g.save(); g.filter = 'blur(2.2px)'; g.strokeStyle = 'rgba(70,52,26,0.30)'; g.lineWidth = 3.2; g.translate(0, -0.6); line(eW); g.stroke(); g.restore();
    g.save(); g.filter = 'blur(7px)'; g.strokeStyle = 'rgba(70,52,26,0.10)'; g.lineWidth = 12; line(eW); g.stroke(); g.restore();
    // white core
    g.fillStyle = '#fbfaf5'; sheet(eW); g.fill();
    g.save(); sheet(eW); g.clip();
    g.globalCompositeOperation = 'hard-light'; g.globalAlpha = 0.5; g.drawImage(T.grain, -PAD, -PAD);
    g.restore();
    // blue skin
    g.fillStyle = C.blue; sheet(eB); g.fill();
    g.save(); sheet(eB); g.clip();
    g.globalAlpha = 1;
    g.drawImage(L.noiseTex(GW, GH, { seed: 's31hue', scale: 420, octaves: 3, res: 0.08, contrast: 1.4, ramp: [[0, 'rgba(26,52,138,0.30)'], [0.5, 'rgba(36,80,154,0)'], [1, 'rgba(52,112,186,0.28)']] }), -PAD, -PAD);
    g.globalCompositeOperation = 'hard-light';
    g.globalAlpha = 0.2; g.drawImage(T.crumple, -PAD, -PAD);
    g.globalAlpha = 0.5; g.drawImage(T.grain, -PAD, -PAD);
    // the skin is stressed pale right at the tear
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.filter = 'blur(1.6px)'; g.strokeStyle = 'rgba(214,228,255,0.20)'; g.lineWidth = 5; g.translate(0, 2.5); line(eB); g.stroke();
    g.restore();
    // fuzz: white fibres standing off the core, blue shreds straying onto it
    const rf = L.rng('s31fuzz'); g.lineCap = 'round';
    for (let i = 0; i < 5200; i++) {
      const [th, drB, drW] = prof[rf.int(0, n)];
      const blue = rf.chance(0.42);
      const p = a.pt(th, blue ? drB + rf.range(-0.5, 2.2) : drW + rf.range(-1.2, 0.6));
      const dir = th - Math.PI / 2 + rf.gauss() * 0.9; const len = blue ? rf.range(0.8, 3.2) : rf.range(1.2, 5.5);
      g.strokeStyle = blue ? L.rgba(rf.chance(0.5) ? '#2b5aa6' : '#3c69b0', rf.range(0.45, 0.95)) : L.rgba('#fffefa', rf.range(0.3, 0.85));
      g.lineWidth = rf.range(0.5, 1.1);
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + Math.cos(dir) * len, p.y + Math.sin(dir) * len); g.stroke();
    }

    // ── everything glued on top stays well inside the sheet ──
    g.save(); a.clipBelow(g, -9);
    const r = L.rng('s31town');
    const chalk = (x0, y0, x1, y1, o) => L.chalkStroke(g, [[x0, y0], [x1, y1]], { width: 2.6, color: '#f1ede2', density: 0.92, alpha: 0.9, jitter: 0.7, seed: r.int(1, 9999), ...o });
    const win = (cx, cy, w, h) => {
      paper(g, cut(box(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, r, 3).map((q, i) => (i > 1 ? [q[0], q[1] + r.range(-3, 3)] : q)), 'w' + cx, 0.8, 60), { color: C.black, lift: 0.35, sh: 0.8, tex: 0.3, curl: 0.5 });
      chalk(cx, cy - h / 2 + 4, cx + r.range(-1.5, 1.5), cy + h / 2 - 4, { width: 2.6 }); chalk(cx - w / 2 + 4, cy, cx + w / 2 - 4, cy + r.range(-1.5, 1.5), { width: 2.6 });
    };
    const lantern = (x, yTop, cy) => {
      g.save(); g.strokeStyle = 'rgba(20,18,18,0.9)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, yTop); g.lineTo(x + 0.5, cy - 24); g.stroke(); g.restore();
      paper(g, cut([[x - 2.6, cy + 22], [x + 2.8, cy + 22], [x + 3.4, cy + 50], [x - 2.2, cy + 49]], 'lt' + x, 0.4, 40, 8), { color: '#e9c948', lift: 0.25, sh: 0.7, tex: 0.3, curl: 0 });
      paper(g, roundish(x, cy, 22, 26, 9, 'lan' + x), { color: C.red, lift: 0.5, sh: 0.95, tex: 0.42, curl: 1.2 });
      paper(g, cut([[x - 9, cy - 29], [x + 9, cy - 29.5], [x + 10, cy - 21.5], [x - 10, cy - 21]], 'lc' + x, 0.4, 40, 8), { color: C.black, lift: 0.25, sh: 0.7, tex: 0.25, curl: 0 });
      paper(g, cut([[x - 8, cy + 21], [x + 8, cy + 20.5], [x + 7.5, cy + 28], [x - 7.5, cy + 28]], 'lb' + x, 0.4, 40, 8), { color: C.black, lift: 0.25, sh: 0.7, tex: 0.25, curl: 0 });
    };
    const tileLines = (tl, tr, br, bl, nn) => {
      for (let i = 1; i < nn; i++) {
        const u = (i + r.range(-0.15, 0.15)) / nn;
        chalk(L.lerp(tl[0], tr[0], u), L.lerp(tl[1], tr[1], u) + 7, L.lerp(bl[0], br[0], u), L.lerp(bl[1], br[1], u) - 4, { width: 2.0, alpha: 0.5, density: 0.8, color: '#cfcabb' });
      }
    };
    // roof ridge (屋脊): a slate-grey strip along the top of an eave roof, its ends tipped up a little
    const ridge = (tl, tr, seed) => paper(g, cut([[tl[0] - 13, tl[1] - 10], [tl[0] + 22, tl[1] - 4], [tr[0] - 22, tr[1] - 4], [tr[0] + 13, tr[1] - 10], [tr[0] + 11, tr[1] + 3], [tr[0] - 22, tr[1] + 7], [tl[0] + 22, tl[1] + 7], [tl[0] - 11, tl[1] + 3]], seed, 0.6, 80, 10), { color: '#42474d', lift: 0.4, sh: 0.9, tex: 0.4, curl: 0.5 });
    const sliver = (x, y, len, th, tilt, color, seed) => {
      const pts = []; const m = 18;
      for (let i = 0; i <= m; i++) { const u = i / m; pts.push([x + (u - 0.5) * len, y + (u - 0.5) * len * tilt - th * 0.5 * Math.pow(Math.sin(Math.PI * u), 0.55)]); }
      for (let i = m; i >= 0; i--) { const u = i / m; pts.push([x + (u - 0.5) * len, y + (u - 0.5) * len * tilt + th * 0.5 * Math.pow(Math.sin(Math.PI * u), 0.7)]); }
      paper(g, cut(pts, seed, 0.6, 50, 6, 0.9), { color, lift: 0.3, sh: 0.8, tex: 0.4, curl: 0.4, edge: 0.7 });
    };

    // moon reflections & far ripples lying directly on the water
    sliver(585, 1041, 128, 13, 0.02, '#eedb72', 'rm1'); sliver(648, 1064, 86, 10, -0.03, '#eedb72', 'rm2');
    sliver(1318, 1049, 132, 12, 0.03, C.white, 'rw0');

    // ── moon ──
    paper(g, cut(roundish(598, 706, 92, 92, 12, 'moon'), 'moon', 1.0, 80, 10), { color: C.moon, lift: 1.2, tex: 0.5, crumple: 0.22, curl: 1.1, peel: [[664, 772, 95]] });

    // ── left bank: gable house (behind) + eave house (front) ──
    paper(g, cut([[250, 1140], [247, 792], [352, 702], [471, 788], [473, 1140]], 'Lb', 1.8), { color: C.white, tex: 0.55, crumple: 0.3 });
    win(362, 872, 42, 54);
    paper(g, cut([[352, 668], [507, 777], [489, 805], [352, 709], [221, 815], [203, 790]], 'Lbr', 1.4, 110), { color: C.black, tex: 0.34, lift: 0.8, crumple: 0.16, peel: [[498, 790, 90]] });
    paper(g, cut([[-95, 1140], [-92, 884], [268, 878], [264, 1140]], 'Lf', 1.8), { color: '#f3efe4', tex: 0.55, crumple: 0.3 });
    paper(g, cut([[96, 1140], [99, 966], [160, 962], [158, 1140]], 'door', 1.2, 70), { color: C.brown, lift: 0.5, tex: 0.5 });
    {
      const tl = [-78, 806], tr = [236, 798], br = [297, 880], bl = [-116, 886];
      paper(g, cut(eaveRoof(tl, tr, br, bl, 13), 'Lfr', 1.0, 120, 7), { color: C.black, tex: 0.34, lift: 0.9, crumple: 0.16, peel: [[296, 880, 80]] });
      tileLines(tl, tr, br, bl, 13);
      ridge(tl, tr, 'Lfg');
    }
    lantern(41, 890, 938); lantern(229, 888, 936);

    // ── right bank: gable house + low eave house running off frame ──
    paper(g, cut([[1565, 1140], [1563, 824], [1682, 732], [1801, 820], [1803, 1140]], 'Rm', 1.8), { color: C.white, tex: 0.55, crumple: 0.3 });
    win(1694, 888, 38, 50); win(1762, 884, 36, 48);
    paper(g, cut([[1682, 700], [1838, 811], [1821, 839], [1682, 741], [1546, 844], [1527, 818]], 'Rmr', 1.4, 110), { color: C.black, tex: 0.34, lift: 0.8, crumple: 0.16, peel: [[1830, 824, 90]] });
    paper(g, cut([[1796, 1140], [1794, 894], [2030, 892], [2032, 1140]], 'Rs', 1.8), { color: '#f3efe4', tex: 0.55, crumple: 0.3 });
    {
      const tl = [1808, 824], tr = [2030, 832], br = [2062, 898], bl = [1771, 900];
      paper(g, cut(eaveRoof(tl, tr, br, bl, 9), 'Rsr', 1.0, 120, 7), { color: C.black, tex: 0.34, lift: 0.9, crumple: 0.16 });
      tileLines(tl, tr, br, bl, 9);
      ridge(tl, tr, 'Rsg');
    }
    lantern(1824, 902, 948); lantern(1879, 902, 950);

    // ── the bridge ──
    const BX = 985, YB = 1010;
    const br = bridgeShape(BX, YB, 676, 258);
    paper(g, cut(br.body, 'bridge', 1.0, 140, 9), { color: C.brown, tex: 0.5, crumple: 0.3, lift: 1.1, peel: [[430, 1006, 120]] });
    paper(g, cut(br.ring, 'ring', 0.8, 120, 9), { color: '#a3683a', tex: 0.5, crumple: 0.18, lift: 0.45, sh: 0.9 });
    {
      // crayon joints between the arch stones
      const rr = L.rng('s31vous');
      for (let i = 1; i < 17; i++) {
        const ph = ((i + rr.range(-0.12, 0.12)) / 17) * Math.PI; const q0 = br.rad(ph) + 4, q1 = br.rad(ph) + 28;
        L.sketchLine(g, [[BX + q0 * Math.cos(ph), br.cyA - q0 * Math.sin(ph)], [BX + q1 * Math.cos(ph), br.cyA - q1 * Math.sin(ph)]], { width: 2.2, color: '#3a1c0b', wobble: 0.9, passes: 2, alpha: 0.8, seed: 40 + i });
      }
    }

    // ── pencil-hatched scrap: the stone quay in the corner ──
    {
      const poly = cut([[1492, 1001], [1650, 986], [1657, 973], [2040, 950], [2046, 1150], [1488, 1150]], 'quay', 1.4, 100);
      paper(g, poly, { color: '#ebe6d7', tex: 0.5, crumple: 0.3, lift: 1.0 });
      const x0 = 1440, y0 = 930, w = 640, h = 240;
      const c = L.makeCanvas(w, h); const k = c.getContext('2d'); k.translate(-x0, -y0);
      const rh = L.rng('s31hatch');
      const scribble = (xa, xb, top, bot, lean, gap, wd, al, sd) => {
        const pts = []; let x = xa;
        while (x < xb) {
          const yb2 = bot + rh.range(-16, 8), yt = top + (x - xa) * -0.045 + rh.range(-8, 16);
          pts.push([x + rh.range(-3, 3), yb2], [x + lean + rh.range(-4, 4), yt]);
          x += gap * rh.range(0.7, 1.35);
        }
        L.sketchLine(k, pts, { width: wd, color: '#34343a', seed: sd, wobble: 1.6, passes: 2, alpha: al });
      };
      scribble(1504, 1790, 1012, 1090, 44, 15, 2.9, 0.85, 3);
      scribble(1700, 2040, 988, 1092, 60, 19, 2.5, 0.8, 5);
      scribble(1560, 1900, 1000, 1085, -38, 27, 2.1, 0.6, 8);
      k.setTransform(1, 0, 0, 1, 0, 0); k.globalCompositeOperation = 'destination-out';
      k.drawImage(L.noiseTex(w, h, { seed: 's31graphite', scale: 1.7, octaves: 2, res: 1, contrast: 2.0, ramp: [[0, 'rgba(0,0,0,0.8)'], [0.4, 'rgba(0,0,0,0.22)'], [0.7, 'rgba(0,0,0,0)']] }), 0, 0);
      g.save(); g.beginPath(); g.moveTo(poly[0][0], poly[0][1]); for (const q of poly) g.lineTo(q[0], q[1]); g.closePath(); g.clip();
      g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.92; g.drawImage(c, x0, y0);
      g.restore();
    }

    // ── the boat under the arch ──
    {
      const bx = 1004, wy = 1002;
      // punting pole, then the arched mat awning with its bamboo hoops
      paper(g, cut([[bx + 86, wy - 24], [bx + 142, wy - 128], [bx + 147, wy - 126], [bx + 92, wy - 21]], 'pole', 0.4, 60, 8), { color: '#3a2413', lift: 0.3, sh: 0.7, tex: 0.3, curl: 0 });
      const can = []; for (let i = 0; i <= 14; i++) { const ph = Math.PI - (i / 14) * Math.PI; can.push([bx - 12 + 62 * Math.cos(ph), wy - 12 - 46 * Math.pow(Math.sin(ph), 0.8)]); }
      paper(g, cut(can, 'awning', 0.8, 70, 8), { color: '#b98a4c', lift: 0.6, tex: 0.5, curl: 1.2 });
      for (const dx of [-36, -12, 12, 36]) {
        const hgt = 46 * Math.pow(Math.sqrt(1 - (dx / 62) ** 2), 0.8) - 3;
        paper(g, cut([[bx - 12 + dx - 2.4, wy - 12], [bx - 12 + dx - 2, wy - 12 - hgt], [bx - 12 + dx + 2.4, wy - 12 - hgt], [bx - 12 + dx + 2.2, wy - 12]], 'hoop' + dx, 0.3, 40, 8), { color: '#4a2c14', lift: 0.2, sh: 0.6, tex: 0.25, curl: 0, edge: 0.6 });
      }
      // hull: a dark crescent, both ends turned up
      const top = L.smoothPath([[-128, -44], [-96, -24], [-40, -13], [42, -13], [98, -25], [128, -46]].map(([x, y]) => [bx + x, wy + y]), 8);
      const bot = L.smoothPath([[128, -46], [108, -6], [62, 14], [0, 19], [-62, 14], [-108, -5], [-128, -44]].map(([x, y]) => [bx + x, wy + y]), 8);
      paper(g, cut(top.concat(bot.slice(1, -1)), 'hull', 0.6, 80, 8), { color: C.black, lift: 0.8, tex: 0.34, curl: 0.8, peel: [[1130, 958, 60]] });
    }
    // ripples in front
    sliver(872, 1044, 124, 11, 0.02, C.white, 'rw1'); sliver(1096, 1050, 150, 12, -0.02, C.white, 'rw2'); sliver(985, 1066, 96, 9, 0.01, '#5f8fd0', 'rw3');
    sliver(760, 1062, 84, 9, -0.02, '#5f8fd0', 'rw4');

    // ── the willow: leaning trunk, four arching boughs, long thin strands weeping straight down from them ──
    {
      const rw = L.rng('s31willow');
      const boughs = [
        [[1486, 814], [1444, 734], [1380, 694], [1322, 712]],
        [[1486, 814], [1466, 722], [1434, 674], [1392, 666]],
        [[1486, 814], [1503, 724], [1532, 680], [1570, 678]],
        [[1486, 814], [1538, 746], [1596, 710], [1644, 732]],
        [[1486, 814], [1487, 742], [1483, 696], [1477, 660]],
      ].map((c) => L.smoothPath(c, 6));
      const strand = (bi, t, green, lift) => {
        const bp = boughs[bi]; const [sx, sy] = bp[Math.min(bp.length - 1, Math.round(t * (bp.length - 1)))];
        const side = bi === 4 ? (t > 0.9 ? -1 : 1) : bi < 2 ? -1 : 1; const outer = bi === 0 || bi === 3;
        const len = (outer ? L.lerp(238, 168, t) : bi === 4 ? 262 : L.lerp(284, 236, t)) * rw.range(0.9, 1.08);
        const c = quad([sx, sy - 3], [sx + side * rw.range(8, 20), sy + len * 0.34], [sx + side * rw.range(-2, 16) + 10, sy + len], 12);
        const wmax = rw.range(12.5, 16.5);
        const poly = strip(c, (u) => 3 + wmax * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.6)), 0.75), 9);
        paper(g, cut(poly, 'st' + bi + '_' + t, 0.5, 60, 8), { color: green, lift, sh: 0.9, tex: 0.5, curl: 0.8, edge: 0.9 });
      };
      for (let bi = 0; bi < 4; bi++) { strand(bi, 0.52, '#2c7a44', 0.4); strand(bi, 0.86, '#2c7a44', 0.4); }
      const trunk = strip([[1518, 1150], [1510, 1000], [1496, 892], [1486, 806]], (t) => L.lerp(42, 19, t), 12);
      paper(g, cut(trunk, 'trunk', 1.2, 90, 10), { color: '#44260f', lift: 0.7, tex: 0.5, crumple: 0.2 });
      boughs.forEach((bp, bi) => paper(g, cut(strip(bp.filter((_, i) => i % 3 === 0 || i === bp.length - 1), (t) => L.lerp(15, 5, t), 9), 'bough' + bi, 0.5, 70, 8), { color: '#44260f', lift: 0.5, sh: 0.9, tex: 0.45, curl: 0.5 }));
      strand(4, 0.82, C.green, 0.6); strand(4, 1.0, '#62b66c', 0.7);
      for (let bi = 0; bi < 4; bi++) {
        strand(bi, 0.36, C.green, 0.6); strand(bi, 0.7, rw.chance(0.5) ? '#62b66c' : C.green, 0.7); strand(bi, 1.0, bi % 2 ? C.green : '#62b66c', 0.7);
      }
    }
    g.restore();

    // ── one light over the whole sheet: warm from the upper left, falling away to the lower right ──
    g.save(); g.globalCompositeOperation = 'source-atop';
    g.fillStyle = L.radial(g, 420, 380, 120, 1950, [[0, 'rgba(255,248,230,0.10)'], [0.45, 'rgba(255,248,230,0)'], [0.6, 'rgba(6,8,30,0)'], [1, 'rgba(6,8,30,0.26)']]);
    g.fillRect(-PAD, -PAD, GW, GH);
    g.restore();
  });
}

/** the cream card everything is mounted on */
function buildCard() {
  const c = L.paperTex(GW, GH, { base: C.card, seed: 's31card', tone: '#ab9d7c', fiber: 0.5, stain: 0.08, grain: 0.1 });
  const g = c.getContext('2d');
  g.globalCompositeOperation = 'hard-light'; g.globalAlpha = 0.2;
  g.save(); g.translate(GW, GH); g.rotate(Math.PI); g.drawImage(T.grain, 0, 0); g.restore();
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  g.fillStyle = L.radial(g, PAD + 500, PAD + 120, 100, 2100, [[0, 'rgba(255,253,244,0.20)'], [0.5, 'rgba(255,253,244,0)'], [1, 'rgba(96,78,48,0.16)']]);
  g.fillRect(0, 0, GW, GH);
  c._pad = PAD;
  return c;
}

export default {
  name: '剪纸拼贴·水乡',
  tone: 'dark',
  init(env) {
    T = buildTextures(); pieceNo = 0;
    S = { card: buildCard(), collage: buildCollage(env) };
    T = null;
  },
  draw(ctx, env, p) {
    // 6 frames: the collage slips a few pixels along the arc under a locked-off camera
    const rot = L.lerp(-0.003, 0.003, p), zoom = L.lerp(1.0, 1.007, p);
    L.blit(ctx, env, S.card, { rot: rot * 0.35 });
    L.blit(ctx, env, S.collage, { rot, zoom });
  },
};
