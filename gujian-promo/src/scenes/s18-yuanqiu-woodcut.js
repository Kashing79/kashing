// s18 — 圜丘·木刻版画. A black-and-white woodcut of the Circular Mound Altar seen from its foot:
// three concentric rings of white-marble balustrade (望柱 + 栏板) stacked one above the other, each standing on
// the hatched waist of its terrace wall (台帮) with a row of 螭首 water spouts under the posts.
// The arc is the top of the UPPER tier's handrail; everything above it is the solid printed black of the sky.
// Pipeline: draw the design as a crisp black/white "block" → per-pixel printing pass (cut-edge wobble, salt specks,
// wood-grain 飞白, ink squash, stray pepper) → composite onto laid paper. One sheet, one camera move, plus a
// macro-lens falloff that keeps the arc in focus and lets the lower tiers go slightly soft.
// Deliberate simplifications: the 柱头 are kept short (they would otherwise climb into the tagline), the lower tiers
// are drawn larger (nearer) rather than with more panels, and no stairway is shown (it would cut the arc at the crest).
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 120;
const LW = W + PAD * 2, LH = H + PAD * 2;
const INK = [12, 11, 10];   // 墨黑 #0c0b0a
let S = null;

// ── tier layout (d = px below the arc, s = scale; all bay geometry is in "unit px" × s) ──
const PU = 150;        // bay pitch (post centre → post centre), unit px — a Qing 栏板 is about twice as long as it is tall
const BAL = 98;        // balustrade: handrail top (0) → underside of the 地栿
const TIER_H = 164;    // balustrade + visible terrace wall (上枋 98–116, 束腰 116–148, 下枋 148–164), unit px
const TIERS = [
  { d0: 0, s: 1.08, phase: 0.5, seed: 1 },    // upper tier: a panel centred on the crest
  { d0: 213, s: 1.26, phase: 0.0, seed: 2 },  // middle tier: a post on the centre line
  { d0: 462, s: 1.45, phase: 0.5, seed: 3 },  // lower tier
];

// profile of a 荷叶净瓶 (leaf-and-vase support under the handrail): [half-width, d]
const VASE = [[11, 13], [10, 15.2], [4.4, 18.6], [3.9, 20.8], [7.6, 24.6], [8, 27.6], [5, 31.4], [6.4, 33], [7, 34.4]];
// front of a 螭首 (beast-head spout)
const HEAD = [[-14.5, 102.5], [-12.6, 99], [-8.4, 101.6], [8.4, 101.6], [12.6, 99], [14.5, 102.5], [15.5, 113], [13, 125], [7, 133], [-7, 133], [-13, 125], [-15.5, 113]];
const CAP = [[-10, 0.6], [-10, -2.2], [-11.6, -4.4], [-12, -9.4], [-11, -14.4], [-8, -18.2], [-3.4, -20], [3.4, -20], [8, -18.2], [11, -14.4], [12, -9.4], [11.6, -4.4], [10, -2.2], [10, 0.6]];

function drawTier(g, a, T) {
  const { d0, s, phase, seed } = T;
  const r = L.rng('s18tier' + seed);
  const Rt = a.R - d0;
  const pitch = PU * s;
  const half = Math.asin(Math.min(0.999, (W / 2 + PAD + 150) / Rt)) * Rt;
  const N = Math.ceil(half / pitch) + 1;
  const JIT = 0.75 * Math.sqrt(s);
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
      const hw = L.lerp(wa, wb, t) * (0.5 + (mid ? r.range(-0.12, 0.12) : 0));
      const off = mid ? r.range(-0.55, 0.55) : 0;
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
    const u = r.range(uA, uB), d = r.range(dA, dB), len = r.range(6, 17), w = r.range(1.5, 2.4);
    poly([[u, d], [u + len * 0.5, d - w * 0.5], [u + len, d + r.range(-0.6, 0.6)], [u + len * 0.5, d + w * 0.5]], '#000', 0.3);
  };

  // a run of short vertical shading cuts along a cleared strip (排线); prob = how much of the strip is in shade
  const ticks = (uA, uB, dA, dB, prob) => {
    if (prob < 0.04) return;
    for (let u = uA + r.range(0, 3); u < uB; u += 6.4 + r.range(-0.6, 0.6)) {
      if (!r.chance(prob)) continue;
      seg(u, dA + r.range(0, 1.2), u + r.range(-0.4, 0.4), dB - r.range(0, 2.4), 2.2, 0.8, '#000', 0.25);
    }
  };
  // the altar is a drum lit from the upper left: its right-hand side turns away into shade (0 lit → 1 shade)
  const shadeAt = (u) => 0.88 * L.smooth((u / Rt + 0.1) / 0.5);

  // white stone of the whole tier (balustrade + wall); the gap below it stays black
  g.fillStyle = '#fff';
  a.pathBand(g, -d0, -(d0 + TIER_H * s), -a.span(PAD + 260), a.span(PAD + 260)); g.fill();

  for (let i = -N; i <= N; i++) {
    u0 = (i + phase) * pitch;
    const A = 12, B = PU - 12; // panel between the posts
    const k = shadeAt(u0 + pitch * 0.5), kp = shadeAt(u0);

    // ── terrace wall (台帮) ──
    seg(-0.6, BAL, PU + 0.6, BAL, 4.2, 4.2, '#000');
    poly([[-0.6, 115.6], [PU + 0.6, 115.6], [PU + 0.6, 148.4], [-0.6, 148.4]], '#000');
    for (let u = 4 + r.range(-0.6, 0.6); u < PU - 3; u += 7.4 + r.range(-0.6, 0.6)) {   // 束腰: dark, hatched with white cuts
      const top = 119.2 + r.range(-0.9, 0.9), bot = 145.6 - Math.pow(r(), 2) * 8;
      if (r.chance(0.3 * k)) continue;
      seg(u, top, u + r.range(-0.7, 0.7), bot, 3.4 * (1 - 0.4 * k), 1.5 * (1 - 0.4 * k), '#fff', 0.35);
    }
    seg(-0.6, 164.9, PU + 0.6, 164.9, 2.6, 2.6, '#000', JIT * 1.5);                          // hand-cut lower edge of the 下枋
    nick(20, PU - 36, 103, 111.5, 0.6); nick(4, PU * 0.5, 152.5, 159, 0.6); nick(PU * 0.5, PU - 20, 152.5, 159, 0.5);
    ticks(19, PU - 17, 101.2, 113.8, k * 0.9); ticks(2, PU - 2, 151, 162, k * 0.8);
    // a broken white cut in the shadow between the tiers (the lip of the terrace below)
    if (r.chance(0.85)) { const ua = r.range(-4, 40), ub = r.range(84, PU + 8); seg(ua, 169.6 + r.range(-0.7, 0.7), ub, 169.6 + r.range(-0.7, 0.7), 0.6, 2.0, '#fff', 0.3); }

    // ── panel (栏板) ──
    // long low openings under the handrail, with the 净瓶 standing in them
    poly([[A, 13], [B, 13], [B, 34.4], [A, 34.4]], '#000');
    const mid = PU / 2;
    poly([...VASE.map(([w, d]) => [mid + w, d]), ...VASE.slice().reverse().map(([w, d]) => [mid - w, d])], '#fff', 0.4);
    poly([[A, 12.6], ...VASE.map(([w, d]) => [A + w * 0.8, d]), [A, 34.8]], '#fff', 0.4);
    poly([[B, 12.6], ...VASE.map(([w, d]) => [B - w * 0.8, d]), [B, 34.8]], '#fff', 0.4);
    seg(mid - 3.4, 26.2, mid + 3.6, 26.2, 1.5, 1.2, '#000', 0.25); // belly line of the vase
    // handrail (寻杖): a broken shadow line along the round bar, and the post's shadow falling on it
    { const ua = A + r.range(16, 30), ub = B - r.range(4, 26); seg(ua, 8.4, ub, 8.7, 2.0, 1.0, '#000', 0.3); }
    for (let q = 0; q < 3; q++) seg(A + 2.2 + q * 3.6, 2.6 + q * 0.8, A + 2.4 + q * 3.6, 11.6 - q * 2.6, 2.0, 0.8, '#000', 0.25);
    nick(A + 30, B - 20, 3, 6, 0.3);
    ticks(A + 15, B - 2, 5.4, 12.6, k * 0.85);
    // 面枋 strip with the post's shadow, then the recessed field: frame (top/left heavier = in shadow)
    for (let q = 0; q < 4; q++) seg(A + 2.4 + q * 3.7, 36 + q * 0.3, A + 2.6 + q * 3.7, 43.2 - q * 1.5, 2.0, 0.8, '#000', 0.25);
    ticks(A + 18, B - 2, 36, 43.6, k);
    seg(A + 7, 46.3, B - 7, 46.3, 3.8, 3.5, '#000');
    seg(A + 8.6, 45, A + 8.6, 80, 3.6, 3.2, '#000');
    seg(A + 7, 79.3, B - 7, 79.3, 2.3, 2.5, '#000');
    seg(B - 7.9, 45, B - 7.9, 80, 2.3, 2.3, '#000');
    {
      // vertical hatching, long under the post's shadow and dying away toward the light
      const uA = A + 14.6, uB = B - 12, n = Math.round((uB - uA) / 7.1);
      for (let q = 0; q <= n; q++) {
        const t = q / n, u = L.lerp(uA, uB, t) + r.range(-0.5, 0.5);
        const lit = L.lerp(29, 8.5, Math.pow(t, 0.8)) + r.range(-3, 3);
        const len = Math.min(30.6, L.lerp(lit, 30.6 - r.range(0, 2.5), Math.pow(k, 0.85)));
        seg(u, 47.6, u + r.range(-0.6, 0.6), 47.6 + len, 3.1 + 0.5 * k, 0.9 + 0.8 * k, '#000', 0.35);
      }
    }
    // 地栿
    seg(A, 84.6, B, 84.6, 3.0, 2.8, '#000');
    nick(A + 4, B - 20, 88.5, 94, 0.5);
    ticks(A + 2, B - 2, 87.2, 96.4, k * 0.9);

    // ── 螭首: a carved beast head projecting from the wall under every post ──
    poly(HEAD.map(([u, d]) => [u * 1.1 + 6, (d - 117) * 1.06 + 122.4]), '#000', 0.4);          // cast shadow, down-right
    poly(HEAD.map(([u, d]) => [u * 1.17, (d - 117) * 1.14 + 117]), '#000', 0.4);                 // outline
    poly(HEAD, '#fff', 0.35);
    seg(-12.2, 105.4, -2.2, 111.6, 3.1, 2.3, '#000', 0.2); seg(12.2, 105.4, 2.2, 111.6, 3.1, 2.3, '#000', 0.2);     // scowling brows
    poly([[-9.8, 113.2], [-5.2, 114.5], [-6.8, 117.2], [-9.4, 116.2]], '#000', 0.2);                               // eyes
    poly([[9.8, 113.2], [5.2, 114.5], [6.8, 117.2], [9.4, 116.2]], '#000', 0.2);
    poly([[-4.2, 119.2], [4.2, 119.2], [5.2, 121.6], [-5.2, 121.6]], '#000', 0.2);                                 // broad nose
    poly([[-6.6, 126.4], [-3.6, 124.2], [3.6, 124.2], [6.6, 126.4], [4.6, 130.6], [-4.6, 130.6]], '#000', 0.2);    // open mouth (the spout)

    // ── post (望柱) with its cap (柱头) standing proud of the handrail ──
    poly([[-12, -1], [12, -1], [12, BAL], [-12, BAL]], '#fff', 0.3);
    poly(CAP, '#fff', 0.45);
    seg(-9.6, -3.3, 9.6, -3.3, 1.9, 1.9, '#000', 0.25);                                           // neck ring
    poly([[6.3, -17], [10.1, -13.8], [11, -9.2], [10.6, -5.6], [7.4, -5.6], [8.3, -10], [7.5, -13.8]], '#000', 0.3); // shade on the cap
    seg(-4.6, -15.8, -4.9, -7.4, 1.6, 0.8, '#000', 0.25); seg(0.9, -16.8, 0.6, -7.4, 1.6, 0.8, '#000', 0.25);
    seg(-10.6, 0, -10.6, BAL, 2.9, 2.9, '#000');
    seg(10, 0, 10, BAL, 4.0, 4.0, '#000');
    for (let d = 8 + r.range(-1, 1); d < BAL - 4; d += 7.2 + r.range(-0.6, 0.6)) {                // shadow ticks down the right side
      const len = L.lerp(r.range(3.6, 7.2), r.range(11, 18.5), Math.pow(kp, 1.3));
      seg(9, d, 9 - len, d + r.range(0.2, 1.1), 2.3 + 0.4 * kp, 0.6, '#000', 0.25);
    }
  }
}

// ── 祥云: a ruyi-headed cloud cut as white line into the black sky (阴刻) ──
function drawCloud(g, cx, cy, sc, dir, seed) {
  const D = Math.PI / 180;
  const T = (x, y) => [cx + dir * x * sc, cy + y * sc];
  const lw = 7.6 * Math.sqrt(sc / 2);
  const head = [];
  for (let i = 0; i <= 44; i++) { const t = i / 44, ph = (-50 - 486 * (1 - t)) * D, rr = L.lerp(4, 22, t); head.push(T(-34 + rr * Math.cos(ph), rr * Math.sin(ph))); }
  for (let i = 1; i <= 16; i++) { const ph = L.lerp(155, 385, i / 16) * D; head.push(T(21 * Math.cos(ph), -26 + 21 * Math.sin(ph))); }
  for (let i = 1; i <= 44; i++) { const t = i / 44, ph = (-130 + 486 * t) * D, rr = L.lerp(22, 4, t); head.push(T(34 + rr * Math.cos(ph), rr * Math.sin(ph))); }
  L.inkStroke(g, head, { width: lw, color: '#fff', seed: seed + 1, taper: [0.04, 0.04], wobble: 0.3, smoothStep: 3 });
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
    drawCloud(g, 366, 232, 2.2, -1, 11);
    drawCloud(g, 1600, 176, 2.4, 1, 23);
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
          amt = 0.02 + 0.4 * (1 - calm);
        }
        // salt: tiny un-inked specks, thicker where the ink ran thin
        const z = (0.42 * v1 + 0.34 * v2 + 0.24 * vn(l3, x * 0.19 + 40.5, y * 0.19 + 11.5) - 0.5) * 9;
        const tS = 3.05 - 1.55 * patch * amt;
        let drop = sstep(tS, tS + 0.55, z);
        // wood grain: long hair-thin horizontal streaks where the plank's soft grain took less ink
        const gv = vn(l4, x / 230 + y * 0.003, y / 2.6 + 2.4 * f2v);
        const dg = sstep(0.8, 0.93, gv) * (0.25 + 0.75 * v2) * amt * (0.2 + 0.8 * patch) * (0.35 + 0.65 * inside);
        if (dg > drop) drop = dg;
        D = I * (1 - drop) * (1 - 0.02 * inside * (0.6 * v1 + 0.4 * v2));
      }
      if (I < 0.5 && inside > 0.02) {
        // pepper: flecks of ink that strayed onto the cleared wood beside the lines
        const z2 = (0.5 * v1 + 0.5 * vn(l2, x * 0.33 + 9.5, y * 0.33 + 71.5) - 0.5) * 9;
        const pe = sstep(2.75, 3.15, z2 + 0.9 * inside) * 0.85;
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
  // base a touch lighter than 纸白 #efe9da: stain, laid lines and ink bleed bring it back down to it
  const paper = L.paperTex(LW, LH, { base: '#f4eee0', seed: 's18paper', tone: '#9c8a64', fiber: 0.6, stain: 0.2, grain: 0.16 });
  return L.makeLayer(PAD, (g) => {
    g.drawImage(paper, -PAD, -PAD);
    // laid lines of the hand-made sheet
    g.fillStyle = 'rgba(110,92,58,0.05)';
    for (let y = -PAD; y < H + PAD; y += 8) g.fillRect(-PAD, y, LW, 1.1);
    // oil of the ink creeping a hair into the paper around every printed form
    g.globalAlpha = 0.08; g.drawImage(L.blurred(ink, 2.4), -PAD, -PAD); g.globalAlpha = 1;
    g.drawImage(ink, -PAD, -PAD);
  });
}

/** macro-lens falloff: a softened copy of the sheet that fades in away from the arc (the plane of focus) */
function buildSoft(env, sheet) {
  const a = env.arc;
  const soft = L.blurred(sheet, 2.4);
  const g = soft.getContext('2d');
  g.filter = 'none'; g.globalCompositeOperation = 'destination-in';
  const r0 = a.R - 760, r1 = a.R + 860, st = (dr) => (a.R + dr - r0) / (r1 - r0);
  g.fillStyle = L.radial(g, a.cx + PAD, a.cy + PAD, r0, r1, [
    [0, 'rgba(0,0,0,1)'], [st(-700), 'rgba(0,0,0,1)'], [st(-460), 'rgba(0,0,0,0.5)'], [st(-230), 'rgba(0,0,0,0)'],
    [st(300), 'rgba(0,0,0,0)'], [st(540), 'rgba(0,0,0,0.55)'], [st(760), 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,1)']]);
  g.fillRect(0, 0, LW, LH);
  return soft;
}

export default {
  name: '圜丘·木刻版画',
  tone: 'light',
  init(env) {
    const sheet = buildSheet(env);
    S = { sheet, soft: buildSoft(env, sheet) };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    // slow push-in with a small drift along the arc; zoom passes through 1 at mid-shot so the handrail sits on the arc
    const rot = L.lerp(-0.006, 0.006, p), zoom = L.lerp(0.986, 1.014, p);
    ctx.fillStyle = '#0c0b0a'; ctx.fillRect(0, 0, W, H);
    L.blit(ctx, env, S.sheet, { rot, zoom });
    L.blit(ctx, env, S.soft, { rot, zoom });
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
