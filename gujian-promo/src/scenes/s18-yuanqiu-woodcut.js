// s18 — 圜丘·木刻版画. A black-and-white woodcut of the Circular Mound Altar seen from its foot:
// three concentric rings of white-marble balustrade (望柱 + 栏板) stacked one above the other, each standing on
// the hatched waist of its terrace wall (台帮) with a row of 螭首 water spouts under the posts.
// The arc is the top of the UPPER tier's handrail; everything above it is the solid printed black of the sky.
// Pipeline: draw the design as a crisp black/white "block" → per-pixel printing pass (cut-edge wobble, salt specks,
// wood-grain 飞白, ink squash, stray pepper) → composite onto laid paper. One sheet, one camera move.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 120;
const LW = W + PAD * 2, LH = H + PAD * 2;
const INK = [12, 11, 10];
const PAPER = '#efe9da';
let S = null;

// ── tier layout (d = px below the arc, s = scale; all bay geometry is in "unit px" × s) ──
const PU = 104;        // bay pitch (post centre → post centre), unit px
const TIER_H = 160;    // balustrade (0–104) + terrace wall (104–160), unit px
const TIERS = [
  { d0: 0, s: 1.0, phase: 0.5, seed: 1 },     // upper tier: a panel centred on the crest
  { d0: 194, s: 1.2, phase: 0.0, seed: 2 },   // middle tier: a post on the centre line
  { d0: 426, s: 1.45, phase: 0.5, seed: 3 },  // lower tier
];

// profile of a 净瓶 (vase under the handrail): [half-width, d]
const VASE = [[10.5, 13], [9.5, 15.6], [4.2, 19.6], [3.7, 22.4], [7.8, 27.2], [8.3, 30.8], [5.2, 36], [6.6, 38.2], [7.2, 40.4]];

function drawTier(g, a, T) {
  const { d0, s, phase, seed } = T;
  const r = L.rng('s18tier' + seed);
  const Rt = a.R - d0;
  const pitch = PU * s;
  const half = Math.asin(Math.min(0.999, (W / 2 + PAD + 150) / Rt)) * Rt;
  const N = Math.ceil(half / pitch) + 1;
  const JIT = 0.55 * Math.sqrt(s);
  let u0 = 0;
  const M = (u, d) => { const th = (u0 + u * s) / Rt, rr = Rt - d * s; return [a.cx + rr * Math.sin(th), a.cy - rr * Math.cos(th)]; };
  const jit = (j) => (r() - 0.5) * 2 * j;
  const poly = (pts, col, j = JIT) => {
    g.fillStyle = col; g.beginPath();
    for (let i = 0; i < pts.length; i++) { const p = M(pts[i][0], pts[i][1]); const x = p[0] + jit(j), y = p[1] + jit(j); if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.closePath(); g.fill();
  };
  // a cut line / wedge from (ua,da) to (ub,db), full widths wa → wb (unit px); long lines are faceted like knife work
  const seg = (ua, da, ub, db, wa, wb, col, j = JIT) => {
    const du = ub - ua, dd = db - da, len = Math.hypot(du, dd) || 1, nx = -dd / len, ny = du / len;
    const n = Math.max(1, Math.round((len * s) / 24));
    const back = [];
    g.fillStyle = col; g.beginPath();
    for (let i = 0; i <= n; i++) {
      const t = i / n, mid = i > 0 && i < n;
      const hw = L.lerp(wa, wb, t) * (0.5 + (mid ? r.range(-0.08, 0.08) : 0));
      const off = mid ? r.range(-0.4, 0.4) : 0;
      const cu = ua + du * t, cd = da + dd * t;
      const p1 = M(cu + nx * (hw + off), cd + ny * (hw + off)), p2 = M(cu - nx * (hw - off), cd - ny * (hw - off));
      const x = p1[0] + jit(j), y = p1[1] + jit(j);
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
      back.push(p2);
    }
    for (let i = n; i >= 0; i--) g.lineTo(back[i][0] + jit(j), back[i][1] + jit(j));
    g.closePath(); g.fill();
  };
  // residual knife nick in a cleared (white) strip: a small black sliver along the band
  const nick = (uA, uB, dA, dB, prob) => {
    if (!r.chance(prob)) return;
    const u = r.range(uA, uB), d = r.range(dA, dB), len = r.range(5, 15), w = r.range(1.2, 2.1);
    poly([[u, d], [u + len * 0.5, d - w * 0.5], [u + len, d + r.range(-0.6, 0.6)], [u + len * 0.5, d + w * 0.5]], '#000', 0.3);
  };

  // white stone of the whole tier (balustrade + wall); the gap below it stays black
  g.fillStyle = '#fff';
  a.pathBand(g, -d0, -(d0 + TIER_H * s), -a.span(PAD + 260), a.span(PAD + 260)); g.fill();

  for (let i = -N; i <= N; i++) {
    u0 = (i + phase) * pitch + r.range(-1.2, 1.2) * s * 0.0; // posts stay on the grid; irregularity lives in the cuts
    const A = 12, B = PU - 12; // panel between the posts

    // ── terrace wall (台帮): 上枋 104–123, 束腰 123–146 (dark, white-cut hatching), 下枋 146–160 ──
    seg(-0.6, 104, PU + 0.6, 104, 3.3, 3.3, '#000');
    poly([[-0.6, 122.6], [PU + 0.6, 122.6], [PU + 0.6, 146.4], [-0.6, 146.4]], '#000');
    for (let u = 3.4 + r.range(-0.6, 0.6); u < PU - 2; u += 6.4 + r.range(-0.5, 0.5)) {
      const top = 126 + r.range(-0.8, 0.8), bot = 143.6 - Math.pow(r(), 2) * 6;
      seg(u, top, u + r.range(-0.6, 0.6), bot, 2.7, 0.9, '#fff', 0.35);
    }
    nick(4, PU - 18, 109, 119, 0.55); nick(4, PU - 18, 150, 156.5, 0.5);
    // faint second edge under the 下枋: a broken white cut in the shadow between the tiers
    if (r.chance(0.8)) { const ua = r.range(0, 34), ub = r.range(58, PU + 6); seg(ua, 165.2 + r.range(-0.7, 0.7), ub, 165.2 + r.range(-0.7, 0.7), 0.5, 1.6, '#fff', 0.3); }

    // ── panel (栏板) ──
    // openings under the handrail, with the 净瓶 standing in them
    poly([[A, 13], [B, 13], [B, 40.4], [A, 40.4]], '#000');
    const mid = PU / 2;
    poly([...VASE.map(([w, d]) => [mid + w, d]), ...VASE.slice().reverse().map(([w, d]) => [mid - w, d])], '#fff', 0.4);
    poly([[A, 12.6], ...VASE.map(([w, d]) => [A + w * 0.82, d]), [A, 40.8]], '#fff', 0.4);
    poly([[B, 12.6], ...VASE.map(([w, d]) => [B - w * 0.82, d]), [B, 40.8]], '#fff', 0.4);
    seg(mid - 3.2, 29.2, mid + 3.4, 29.2, 1.4, 1.1, '#000', 0.25); // belly line of the vase
    // handrail (寻杖): one broken shadow line along the round bar
    { const ua = A + r.range(3, 16), ub = B - r.range(3, 20); seg(ua, 8.3, ub, 8.6, 1.5, 0.8, '#000', 0.3); }
    nick(A + 4, B - 18, 3, 6, 0.3);
    // recessed panel field: frame (top/left heavier = in shadow) + vertical hatching falling away from the light
    seg(A + 7, 51.3, B - 7, 51.3, 3.0, 2.8, '#000');
    seg(A + 8.4, 50, A + 8.4, 84, 2.9, 2.6, '#000');
    seg(A + 7, 83.3, B - 7, 83.3, 1.7, 2.0, '#000');
    seg(B - 7.9, 50, B - 7.9, 84, 1.8, 1.8, '#000');
    {
      const uA = A + 13.6, uB = B - 11.5; let k = 0; const n = Math.round((uB - uA) / 6.2);
      for (let q = 0; q <= n; q++) {
        const u = L.lerp(uA, uB, q / n) + r.range(-0.5, 0.5), t = q / n;
        const len = L.lerp(28.5, 10, Math.pow(t, 0.85)) + r.range(-3.2, 3.2);
        seg(u, 52.4, u + r.range(-0.5, 0.5), 52.4 + len, 2.5, 0.7, '#000', 0.3); k++;
      }
    }
    // 地栿
    seg(A, 88.6, B, 88.6, 2.4, 2.2, '#000');
    nick(A + 4, B - 18, 93, 99.5, 0.45);

    // ── 螭首: a carved beast head projecting from the wall under every post ──
    const HEAD = [[-10, 106.5], [10, 106.5], [11.6, 117.5], [9.6, 128], [4.2, 133.4], [-4.2, 133.4], [-9.6, 128], [-11.6, 117.5]];
    poly(HEAD.map(([u, d]) => [u * 1.12 + 5.2, (d - 120) * 1.08 + 124.4]), '#000', 0.4);         // cast shadow, down-right
    poly(HEAD.map(([u, d]) => [u * 1.2, (d - 120) * 1.16 + 120]), '#000', 0.4);                  // outline
    poly(HEAD, '#fff', 0.35);
    seg(-8.2, 111.6, -2.2, 113.8, 1.7, 1.2, '#000', 0.2); seg(8.2, 111.6, 2.2, 113.8, 1.7, 1.2, '#000', 0.2); // brows
    poly([[-6.2, 116], [-4.4, 114.9], [-2.8, 116.2], [-4.4, 118]], '#000', 0.2);                  // eyes
    poly([[6.2, 116], [4.4, 114.9], [2.8, 116.2], [4.4, 118]], '#000', 0.2);
    seg(-6.4, 124.2, 0, 125.6, 1.5, 1.7, '#000', 0.2); seg(0, 125.6, 6.4, 124.2, 1.7, 1.5, '#000', 0.2);   // muzzle
    seg(0, 119.6, 0, 125.4, 1.3, 1.3, '#000', 0.2);

    // ── post (望柱) with its cap (柱头) standing proud of the handrail ──
    poly([[-12, -1], [12, -1], [12, 104], [-12, 104]], '#fff', 0.3);
    poly([[-10, 0.6], [-10, -2.2], [-11.6, -4.4], [-12, -9.2], [-11, -14.6], [-8, -18.6], [-3.4, -20.6], [3.4, -20.6], [8, -18.6], [11, -14.6], [12, -9.2], [11.6, -4.4], [10, -2.2], [10, 0.6]], '#fff', 0.45);
    seg(-9.6, -3.3, 9.6, -3.3, 1.7, 1.7, '#000', 0.25);                                           // neck ring
    poly([[6.3, -17.6], [10.1, -14], [11, -9], [10.6, -5.6], [7.4, -5.6], [8.3, -10], [7.5, -14]], '#000', 0.3); // shade on the cap
    seg(-4.6, -16.2, -4.9, -7.4, 1.5, 0.7, '#000', 0.25); seg(0.9, -17.2, 0.6, -7.4, 1.5, 0.7, '#000', 0.25);
    seg(-10.9, 0, -10.9, 104, 2.2, 2.2, '#000');
    seg(10.4, 0, 10.4, 104, 3.2, 3.2, '#000');
    for (let d = 7 + r.range(-1, 1); d < 100; d += 5.6 + r.range(-0.5, 0.5)) {                    // shadow ticks down the right side
      const len = r.range(4.2, 8.4) * (d > 13 && d < 40 ? 0.85 : 1);
      seg(9.6, d, 9.6 - len, d + r.range(0.2, 1.1), 2.0, 0.5, '#000', 0.25);
    }
  }
}

// ── 祥云: a ruyi-headed cloud cut as white line into the black sky (阴刻) ──
function drawCloud(g, cx, cy, sc, dir, seed) {
  const D = Math.PI / 180;
  const T = (x, y) => [cx + dir * x * sc, cy + y * sc];
  const lw = 5.6 * Math.sqrt(sc / 2);
  const head = [];
  for (let i = 0; i <= 44; i++) { const t = i / 44, ph = (-50 - 486 * (1 - t)) * D, rr = L.lerp(4, 22, t); head.push(T(-34 + rr * Math.cos(ph), rr * Math.sin(ph))); }
  for (let i = 1; i <= 16; i++) { const ph = L.lerp(155, 385, i / 16) * D; head.push(T(21 * Math.cos(ph), -26 + 21 * Math.sin(ph))); }
  for (let i = 1; i <= 44; i++) { const t = i / 44, ph = (-130 + 486 * t) * D, rr = L.lerp(22, 4, t); head.push(T(34 + rr * Math.cos(ph), rr * Math.sin(ph))); }
  L.inkStroke(g, head, { width: lw, color: '#fff', seed: seed + 1, taper: [0.03, 0.03], wobble: 0.16, smoothStep: 3 });
  // trailing tail + a small secondary curl riding on it
  L.inkStroke(g, [[-44, 25], [-12, 32], [30, 30.5], [82, 23], [140, 26.5], [214, 17]].map(([x, y]) => T(x, y)), { width: lw * 1.05, color: '#fff', seed: seed + 2, taper: [0.06, 0.62], wobble: 0.15 });
  L.inkStroke(g, [[14, 43], [62, 41], [118, 45], [176, 38]].map(([x, y]) => T(x, y)), { width: lw * 0.8, color: '#fff', seed: seed + 3, taper: [0.25, 0.6], wobble: 0.15 });
  const curl = [T(60, 24.5), T(80, 20)];
  for (let i = 0; i <= 30; i++) { const t = i / 30, ph = (78 - 420 * t) * D, rr = L.lerp(15, 3, t); curl.push(T(97 + rr * Math.cos(ph), 4 + rr * Math.sin(ph))); }
  L.inkStroke(g, curl, { width: lw * 0.85, color: '#fff', seed: seed + 4, taper: [0.1, 0.05], wobble: 0.14, smoothStep: 3 });
}

/** the "block": white = cut away (paper shows), black = wood left standing (prints) */
function buildDesign(env) {
  const a = env.arc;
  return L.makeLayer(PAD, (g) => {
    g.fillStyle = '#000'; g.fillRect(-PAD, -PAD, LW, LH);
    // clouds, well clear of the text zone
    drawCloud(g, 372, 236, 2.05, -1, 11);
    drawCloud(g, 1592, 178, 2.25, 1, 23);
    // a few long drifting streaks of air beside them
    const streak = (x0, x1, y, w, seed) => L.inkStroke(g, [[x0, y], [L.lerp(x0, x1, 0.4), y - 5], [L.lerp(x0, x1, 0.75), y + 3], [x1, y - 2]], { width: w, color: '#fff', seed, taper: [0.45, 0.5], wobble: 0.2 });
    streak(-60, 300, 392, 4.2, 31); streak(96, 430, 420, 3.2, 32);
    streak(1470, 1800, 330, 4.2, 33); streak(1640, 2010, 358, 3.4, 34); streak(1360, 1560, 70, 3.2, 35);
    // ground beyond the lowest tier: black, with a few broken concentric cuts (only ever seen at the very bottom)
    const last = TIERS[TIERS.length - 1]; const dG = last.d0 + TIER_H * last.s;
    const r = L.rng('s18ground');
    for (let d = dG + 16; d < dG + 420; d += r.range(13, 22)) {
      const Rr = a.R - d, s = a.span(PAD + 200);
      for (let th = -s; th < s;) {
        const len = r.range(40, 220) / Rr, gap = r.range(14, 70) / Rr;
        const pts = L.arcPts(a, -d, th, Math.min(s, th + len), 6);
        L.inkStroke(g, pts, { width: r.range(1.6, 3.2), color: '#fff', seed: Math.floor(d * 7 + th * 900), taper: [0.3, 0.4], wobble: 0.2 });
        th += len + gap;
      }
    }
    for (const T of TIERS) drawTier(g, a, T);
  });
}

function makeLat(seed, n) {
  const r = L.rng(seed); const v = new Float32Array(n * n);
  for (let i = 0; i < v.length; i++) v[i] = r();
  return { a: v, n, m: n - 1 };
}
/** tileable smooth value noise in [0,1] */
function vn(lat, x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let fx = x - xi, fy = y - yi; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const m = lat.m, n = lat.n, a = lat.a;
  const x0 = xi & m, x1 = (xi + 1) & m, y0 = (yi & m) * n, y1 = ((yi + 1) & m) * n;
  const p = a[y0 + x0], q = a[y0 + x1], r = a[y1 + x0], s = a[y1 + x1];
  const top = p + (q - p) * fx;
  return top + (r + (s - r) * fx - top) * fy;
}
const sstep = (a, b, v) => { const t = v <= a ? 0 : v >= b ? 1 : (v - a) / (b - a); return t * t * (3 - 2 * t); };

/** the printing pass: turn the crisp block into an impression (alpha = ink density) */
function buildInk(env, design) {
  const a = env.arc;
  const mS = L.blurred(design, 1.0).getContext('2d').getImageData(0, 0, LW, LH).data;
  // wide blur at half res → "how much ink is around here" (ink squash in solids, pepper beside lines)
  const hw = Math.ceil(LW / 2), hh = Math.ceil(LH / 2);
  const wc = L.makeCanvas(hw, hh); const wg = wc.getContext('2d', { willReadFrequently: true });
  wg.fillStyle = '#000'; wg.fillRect(0, 0, hw, hh);
  wg.filter = 'blur(4px)'; wg.drawImage(design, 0, 0, LW, LH, 0, 0, LW / 2, LH / 2); wg.filter = 'none';
  const mW = wg.getImageData(0, 0, hw, hh).data;

  // coarse fields: where the block was inked thin (patches of 飞白) and the slow wave of the wood grain
  const GS = 12, gw = Math.ceil(LW / GS) + 2, gh = Math.ceil(LH / GS) + 2;
  const nA = L.makeNoise('s18patch'), nB = L.makeNoise('s18wave');
  const f1 = new Float32Array(gw * gh), f2 = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const X = gx * GS, Y = gy * GS, i = gy * gw + gx;
    f1[i] = nA.fbm(X / 330, Y / 230, 3);
    f2[i] = nB.fbm(X / 600, Y / 110, 2);
  }
  const l1 = makeLat('s18a', 512), l2 = makeLat('s18b', 512), l3 = makeLat('s18c', 256), l4 = makeLat('s18d', 256);
  const out = new ImageData(LW, LH); const o = out.data;
  const cxL = a.cx + PAD, cyL = a.cy + PAD, R = a.R;
  // text zone (frame coords → layer coords), kept calm
  const zx0 = 560 + PAD, zx1 = 1360 + PAD, zy0 = a.crestY - 300 + PAD, zy1 = a.crestY + PAD;
  for (let y = 0; y < LH; y++) {
    const dy = y - cyL;
    const gyf = y / GS, gy0 = Math.floor(gyf), ty = gyf - gy0, row0 = gy0 * gw, row1 = row0 + gw;
    const wrow = (y >> 1) * hw;
    const zdy = y < zy0 ? zy0 - y : y > zy1 ? y - zy1 : 0;
    for (let x = 0; x < LW; x++) {
      const k = (y * LW + x) * 4;
      const m = mS[k] * (1 / 255);                       // 1 = cut away, 0 = standing wood
      const v1 = vn(l1, x * 0.61, y * 0.61), v2 = vn(l2, x * 0.27, y * 0.27), v3 = vn(l3, x * 0.117, y * 0.117);
      // the cut edge: slightly ragged, a touch of wobble a few px long
      const zE = (0.3 * v1 + 0.4 * v2 + 0.3 * v3 - 0.5) * 8;
      const I = sstep(-0.42, 0.42, (0.5 - m) * 7 + 0.5 * zE);
      const inside = 1 - mW[(wrow + (x >> 1)) * 4] * (1 / 255);   // 1 deep inside a solid black
      let D = 0;
      if (I > 0.003) {
        const dx = x - cxL;
        const below = dx * dx + dy * dy < R * R;
        const gxf = x / GS, gx0 = Math.floor(gxf), tx = gxf - gx0, i0 = row0 + gx0, i1 = row1 + gx0;
        const f1v = L.lerp(L.lerp(f1[i0], f1[i0 + 1], tx), L.lerp(f1[i1], f1[i1 + 1], tx), ty);
        const f2v = L.lerp(L.lerp(f2[i0], f2[i0 + 1], tx), L.lerp(f2[i1], f2[i1 + 1], tx), ty);
        let patch = 0.5 + 1.15 * f1v; patch = patch < 0 ? 0 : patch > 1 ? 1 : patch;
        let amt = 1;
        if (!below) {
          const zdx = x < zx0 ? zx0 - x : x > zx1 ? x - zx1 : 0;
          const calm = 1 - sstep(0, 260, Math.sqrt(zdx * zdx + zdy * zdy));
          amt = 0.06 + 0.5 * (1 - calm);
        }
        // salt: tiny un-inked specks, thicker where the ink ran thin
        const z = (0.42 * v1 + 0.34 * v2 + 0.24 * vn(l3, x * 0.19 + 40.5, y * 0.19 + 11.5) - 0.5) * 9;
        const tS = 2.75 - 1.5 * patch * amt;
        let drop = sstep(tS, tS + 0.55, z);
        // wood grain: long hair-thin horizontal streaks where the plank's soft grain took less ink
        const gv = vn(l4, x / 230 + y * 0.003, y / 2.6 + 2.4 * f2v);
        const dg = sstep(0.8, 0.93, gv) * (0.25 + 0.75 * v2) * amt * (0.2 + 0.8 * patch) * (0.35 + 0.65 * inside);
        if (dg > drop) drop = dg;
        D = I * (1 - drop) * (1 - 0.07 * inside * v3);
      }
      if (I < 0.5 && inside > 0.02) {
        // pepper: flecks of ink that strayed onto the cleared wood beside the lines
        const z2 = (0.5 * v1 + 0.5 * vn(l2, x * 0.33 + 9.5, y * 0.33 + 71.5) - 0.5) * 9;
        const pe = sstep(2.25, 2.7, z2 + 1.1 * inside) * 0.85;
        if (pe > D) D = pe;
      }
      if (D <= 0.004) continue;
      o[k] = INK[0]; o[k + 1] = INK[1]; o[k + 2] = INK[2]; o[k + 3] = D >= 1 ? 255 : D * 255;
    }
  }
  const ink = L.makeCanvas(LW, LH);
  ink.getContext('2d').putImageData(out, 0, 0);
  ink._pad = PAD;
  return ink;
}

function buildSheet(env) {
  const ink = buildInk(env, buildDesign(env));
  const paper = L.paperTex(LW, LH, { base: PAPER, seed: 's18paper', tone: '#9c8a64', fiber: 0.6, stain: 0.3, grain: 0.16 });
  return L.makeLayer(PAD, (g) => {
    g.drawImage(paper, -PAD, -PAD);
    // laid lines of the hand-made sheet
    g.fillStyle = 'rgba(110,92,58,0.05)';
    for (let y = -PAD; y < H + PAD; y += 8) g.fillRect(-PAD, y, LW, 1.1);
    // oil of the ink creeping a hair into the paper around every printed form
    g.globalAlpha = 0.16; g.drawImage(L.blurred(ink, 2.4), -PAD, -PAD); g.globalAlpha = 1;
    g.drawImage(ink, -PAD, -PAD);
  });
}

export default {
  name: '圜丘·木刻版画',
  tone: 'light',
  init(env) {
    S = { sheet: buildSheet(env) };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    // slow push-in with a small drift along the arc; zoom passes through 1 at mid-shot so the handrail sits on the arc
    const rot = L.lerp(-0.006, 0.006, p), zoom = L.lerp(0.986, 1.014, p);
    ctx.fillStyle = '#0c0b0a'; ctx.fillRect(0, 0, W, H);
    L.blit(ctx, env, S.sheet, { rot, zoom });
    // copy-stand light: raking in from the upper left, falling off toward the lower right
    ctx.save(); ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = L.linear(ctx, 0, a.crestY - 200, W, H, [[0, 'rgba(255,248,230,0.3)'], [0.5, 'rgba(128,128,128,0)'], [1, 'rgba(0,0,0,0.3)']]);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    // a soft sheen sliding along the upper balustrade
    const gl = a.pt(L.lerp(-0.2, 0.02, p), -60);
    L.glow(ctx, gl.x, gl.y, 420, '#fff8e8', 0.07);
    L.vignette(ctx, { strength: 0.22 });
  },
};
