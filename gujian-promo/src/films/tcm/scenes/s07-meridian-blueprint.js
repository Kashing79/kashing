// s07 — 经络图蓝晒. A chalk study on Prussian-blue cyanotype paper.
// The shared arc is the contour of a shoulder (a fragment only — no head, no face), drawn as the boldest chalk line.
// Below it seven meridian lines run down the body, each dotted with acupoints at uneven intervals (a few ringed);
// between them a couple of dashed proportional guides with short tick ladders. Above it, cutting in from the two
// upper corners: groups of slanted parallel construction lines, a graduated measuring line and a right-angle bracket.
// Nothing is written anywhere: no characters, no numerals, no point names. The drawing is this film's own invention,
// not a copy of any historical chart.
//
// Chalk is synthesised per pixel in init(): every stroke is first drawn as soft-edged coverage, then thresholded
// against the SAME tooth field that embosses the paper, so the chalk sits on the paper's peaks, skips in the hollows
// and frays into grains at its edges. Each animated mark is a tight pre-rendered canvas revealed with an arc-space clip.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 80;                       // camera only drifts a few px → a slim margin is enough
const TW = W + PAD * 2, TH = H + PAD * 2;
const BLUE = '#1f4e79', DEEP = '#153a5c', CHALK = '#f1f4f2', GREY = '#b9cbd6';
const sq = (v) => v * v;
let S = null;

// meridians, left → right. th = where the line leaves the shoulder contour (radians from the crest),
// lat(d) = sideways drift in px at depth d below the contour, dots = acupoint depths (uneven on purpose), ring = ringed ones,
// ghost = [d0, d1, side]: a stretch that was gone over twice, slightly out of register
const MER = [
  { th: -0.345, w: 13.5, lat: (d) => 62 * sq(d / 500), dots: [70, 168, 236, 352], ring: [2] },
  { th: -0.235, w: 17.5, ghost: [150, 430, 1], lat: (d) => -40 * sq(d / 500) + 9 * Math.sin(d / 120), dots: [52, 150, 300, 372, 470], ring: [1] },
  { th: -0.118, w: 11, lat: (d) => 40 * Math.pow(d / 500, 1.5), dots: [96, 196, 268, 420], ring: [] },
  { th: -0.062, w: 15, lat: (d) => 66 * Math.pow(d / 500, 1.5), dots: [58, 226, 330, 398, 492], ring: [2] },
  { th: 0.058, w: 18.5, ghost: [40, 300, -1], lat: (d) => -50 * sq(d / 500), dots: [80, 152, 318, 448], ring: [2] },
  { th: 0.185, w: 12, lat: (d) => 32 * Math.sin(d / 190), dots: [56, 204, 268, 404, 500], ring: [0] },
  { th: 0.3, w: 15.5, ghost: [200, 520, 1], lat: (d) => -68 * sq(d / 500), dots: [104, 184, 318, 410], ring: [1] },
];
// timing (in shot progress p): the bold pass sweeps along the contour, the meridians drop from it one after another,
// the points are dabbed on as each line passes them; everything is finished by p ≈ 0.68 and holds
const ARC_SWEEP = [0, 0.15], ARC_FROM = -0.08;
const MER_T0 = -0.055, MER_STEP = 0.045, MER_DUR = 0.3;

// ───────────────────────── paper tooth ─────────────────────────
/** one clumpy fine-noise field for the whole sheet: z = normalised height (mean 0, sd 1) + a grey relief canvas */
function buildTooth() {
  const c = L.makeCanvas(TW, TH), g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(L.grainTex(TW, TH, { seed: 's07t1', amount: 1, size: 1 }), 0, 0);
  g.globalAlpha = 0.5; g.drawImage(L.grainTex(TW, TH, { seed: 's07t2', amount: 1, size: 2 }), 0, 0);
  g.globalAlpha = 0.4; g.drawImage(L.grainTex(TW, TH, { seed: 's07t3', amount: 1, size: 4 }), 0, 0);
  g.globalAlpha = 1;
  const d = g.getImageData(0, 0, TW, TH).data, n = TW * TH, z = new Float32Array(n);
  let m = 0, v = 0;
  for (let i = 0; i < n; i++) m += d[i * 4];
  m /= n;
  for (let i = 0; i < n; i++) { const e = d[i * 4] - m; v += e * e; }
  const sd = Math.sqrt(v / n) || 1;
  for (let i = 0; i < n; i++) z[i] = (d[i * 4] - m) / sd;
  // relief lit from the upper left + a little albedo (the blue pools deeper in the hollows)
  const img = new ImageData(TW, TH), o = img.data;
  for (let y = 0; y < TH; y++) {
    const up = y > 0 ? TW : 0, dn = y < TH - 1 ? TW : 0;
    for (let x = 0; x < TW; x++) {
      const k = y * TW + x;
      const gx = z[k + (x < TW - 1 ? 1 : 0)] - z[k - (x > 0 ? 1 : 0)], gy = z[k + dn] - z[k - up];
      const s = 128 + (gx + gy) * 9 + z[k] * 8, i = k * 4;
      o[i] = o[i + 1] = o[i + 2] = s; o[i + 3] = 255;
    }
  }
  const relief = L.makeCanvas(TW, TH);
  relief.getContext('2d').putImageData(img, 0, 0);
  return { z, relief };
}

// ───────────────────────── chalk ─────────────────────────
/** variable-width ribbon along a polyline (coverage only): hand pressure, a touch of wander, heavier where the chalk lands and lifts */
function ribbon(g, pts, width, seed, o = {}) {
  const { wob = 0.12, ends = 0.26, jit = 0.8, step = 3 } = o;
  const p = L.smoothPath(pts, step), n = p.length;
  if (n < 2) return;
  const nz = L.makeNoise('s07rb' + seed);
  const s = new Float32Array(n);
  for (let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  const tot = s[n - 1], lf = [], rt = [];
  for (let i = 0; i < n; i++) {
    const A = p[Math.max(0, i - 1)], B = p[Math.min(n - 1, i + 1)];
    let nx = -(B[1] - A[1]), ny = B[0] - A[0]; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
    const e = Math.min(s[i], tot - s[i]);
    const wv = 1 + wob * nz.n2(s[i] / 70, 1.3) + 0.05 * nz.n2(s[i] / 8, 7.7) + ends * Math.exp(-e / (width * 1.3 + 4));
    const hw = Math.max(0.7, (width * wv) / 2), j = jit * nz.n2(s[i] / 55, 9.1);
    lf.push([p[i][0] + nx * (hw + j), p[i][1] + ny * (hw + j)]); rt.push([p[i][0] - nx * (hw - j), p[i][1] - ny * (hw - j)]);
  }
  g.beginPath(); g.moveTo(lf[0][0], lf[0][1]);
  for (let i = 1; i < n; i++) g.lineTo(lf[i][0], lf[i][1]);
  for (let i = n - 1; i >= 0; i--) g.lineTo(rt[i][0], rt[i][1]);
  g.closePath(); g.fill();
  const cr = (width * (1 + ends)) / 2;
  g.beginPath(); g.arc(p[0][0], p[0][1], cr, 0, L.TAU); g.arc(p[n - 1][0], p[n - 1][1], cr * 0.92, 0, L.TAU); g.fill();
}
const seg = (g, x0, y0, x1, y1, width, seed, o) => ribbon(g, [[x0, y0], [x1, y1]], width, seed, o);
/** broken line: pat = [on, off] px, each dash its own little stroke */
function dashes(g, pts, pat, width, seed, o = {}) {
  const p = L.smoothPath(pts, 2), r = L.rng('s07ds' + seed);
  let i = 0, k = 0;
  while (i < p.length - 3) {
    const on = pat[0] * r.range(0.8, 1.2), off = pat[1] * r.range(0.8, 1.2);
    const j = Math.min(p.length - 1, i + Math.round(on / 2));
    if (j - i >= 3) ribbon(g, [p[i], p[(i + j) >> 1], p[j]], width, seed + '_' + k, { ends: 0.2, ...o });
    i = j + Math.round(off / 2); k++;
  }
}
/** a dabbed dot: slightly lumpy disc */
function blob(g, x, y, r, seed) {
  const nz = L.makeNoise('s07bl' + seed), n = 20;
  g.beginPath();
  for (let k = 0; k < n; k++) {
    const an = (k / n) * L.TAU, rr = r * (1 + 0.13 * nz.n2(Math.cos(an) * 1.4 + 3, Math.sin(an) * 1.4));
    if (k === 0) g.moveTo(x + rr * Math.cos(an), y + rr * Math.sin(an)); else g.lineTo(x + rr * Math.cos(an), y + rr * Math.sin(an));
  }
  g.closePath(); g.fill();
}
function ringPts(x, y, r, a0) {
  const out = [], n = 28;
  for (let k = 0; k <= n; k++) {
    const an = a0 + (k / n) * (L.TAU + 0.32), rr = r * (1 + 0.05 * Math.sin(an * 2 + a0) + 0.035 * (k / n));
    out.push([x + rr * Math.cos(an), y + rr * Math.sin(an)]);
  }
  return out;
}

/**
 * Turn coverage into chalk. box = {x,y,w,h} in frame coords (clamped to the sheet); draw(g) paints white coverage.
 * opts: gain (pressure), hole (threshold: higher = more skips), soft (edge softness px), color, halo (dust around the mark),
 *       streak (fn(X,Y) → -1..1: skips that run along the stroke), pressAmp, mottle / mottle2 (clumps at ~6 px / ~15 px),
 *       edge (threshold softness: big = hazy dust), seed
 * → { c, x, y, w, h }: a tight canvas and where it sits in the frame.
 */
function chalkLayer(T, box, draw, o = {}) {
  const { gain = 1, hole = 0.72, soft = 1.8, color = CHALK, halo = 0.3, streak = null, streakAmp = 0.18, pressAmp = 0.2, mottle = 0.2, mottle2 = 0.1, edge = 0.07, haloBlur = 4, seed = 'a' } = o;
  const m = 22;
  const x0 = Math.max(-PAD, Math.floor(box.x - m)), y0 = Math.max(-PAD, Math.floor(box.y - m));
  const x1 = Math.min(W + PAD, Math.ceil(box.x + box.w + m)), y1 = Math.min(H + PAD, Math.ceil(box.y + box.h + m));
  const w = Math.max(2, x1 - x0), h = Math.max(2, y1 - y0);
  const cov = L.makeCanvas(w, h), cg = cov.getContext('2d');
  cg.translate(-x0, -y0); cg.fillStyle = cg.strokeStyle = '#fff'; cg.lineCap = cg.lineJoin = 'round';
  draw(cg);
  const sc = L.makeCanvas(w, h), sg = sc.getContext('2d', { willReadFrequently: true });
  if (soft) sg.filter = `blur(${soft}px)`;
  sg.drawImage(cov, 0, 0); sg.filter = 'none';
  const img = sg.getImageData(0, 0, w, h), d = img.data;
  const nz = L.makeNoise('s07ck' + seed);
  const col = L.parseColor(color);
  for (let y = 0; y < h; y++) {
    const Y = y + y0, row = (Y + PAD) * TW + PAD + x0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, al = d[i + 3];
      if (al < 5) { d[i + 3] = 0; continue; }
      const X = x + x0;
      const press = 1 + pressAmp * nz.n2(X / 120, Y / 120);
      let th = hole - 0.2 * T.z[row + x] + mottle * nz.n2(X / 6.5 + 40, Y / 6.5) + mottle2 * nz.n2(X / 15 - 9, Y / 15 + 70);
      if (streak) th += streakAmp * streak(X, Y);
      const over = (al / 255) * gain * press - th;
      let t = (over + edge) / (edge * 2);
      t = t < 0 ? 0 : t > 1 ? 1 : t; t = t * t * (3 - 2 * t);
      // thinly laid chalk lets a little blue through
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 252 * t * (0.8 + 0.2 * (over > 0.3 ? 1 : over < 0 ? 0 : over / 0.3));
    }
  }
  sg.putImageData(img, 0, 0);
  const out = L.makeCanvas(w, h), og = out.getContext('2d');
  if (halo) { og.globalAlpha = halo; og.filter = `blur(${haloBlur}px)`; og.drawImage(sc, 0, 0); og.filter = 'none'; og.globalAlpha = 1; }
  og.drawImage(sc, 0, 0);
  return { c: out, x: x0, y: y0, w, h };
}
function boundsOf(pts, grow) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const q of pts) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
  return { x: x0 - grow, y: y0 - grow, w: x1 - x0 + grow * 2, h: y1 - y0 + grow * 2 };
}

// ───────────────────────── paper ─────────────────────────
function buildPaper(T) {
  return L.makeLayer(PAD, (g) => {
    g.fillStyle = BLUE; g.fillRect(-PAD, -PAD, TW, TH);
    // uneven exposure of the hand-coated sheet: slow pools of deeper blue and of a brighter, cleaner blue
    g.drawImage(L.noiseTex(TW, TH, { seed: 's07c1', scale: 820, octaves: 3, res: 0.1, warp: 0.5, contrast: 1.4,
      ramp: [[0, L.rgba(DEEP, 0.42)], [0.44, L.rgba(DEEP, 0)], [0.58, L.rgba('#2a6db0', 0)], [1, L.rgba('#2a6db0', 0.4)]] }), -PAD, -PAD);
    g.globalAlpha = 0.22;
    g.drawImage(L.noiseTex(TW, TH, { seed: 's07c2', scale: 150, octaves: 4, res: 0.2, warp: 0.4, contrast: 1.4,
      ramp: [[0, L.rgba('#143660', 0.5)], [0.46, 'rgba(20,54,96,0)'], [0.6, 'rgba(58,124,190,0)'], [1, L.rgba('#3a7cbe', 0.36)]] }), -PAD, -PAD);
    // faint brush streaks of the sensitiser
    g.globalAlpha = 0.07;
    g.drawImage(L.noiseTex(TW, TH, { seed: 's07c3', scale: 60, sx: 30, sy: 1, octaves: 3, res: 0.25, contrast: 1.6,
      ramp: [[0, L.rgba('#10305a', 0.6)], [0.46, 'rgba(16,48,90,0)'], [0.6, 'rgba(84,144,204,0)'], [1, L.rgba('#5490cc', 0.45)]] }), -PAD, -PAD);
    g.globalAlpha = 1;
    // paper fibres
    const r = L.rng('s07fib');
    g.lineCap = 'round';
    for (let i = 0; i < 1100; i++) {
      const x = r.range(-PAD, W + PAD), y = r.range(-PAD, H + PAD), len = r.range(8, 40), an = r() * Math.PI;
      g.strokeStyle = r.chance(0.55) ? L.rgba('#7fb0e2', r.range(0.05, 0.2)) : L.rgba('#0d2a4c', r.range(0.06, 0.22));
      g.lineWidth = r.range(0.5, 1.4);
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(an) * len * 0.5 + r.range(-5, 5), y + Math.sin(an) * len * 0.5 + r.range(-5, 5), x + Math.cos(an) * len, y + Math.sin(an) * len);
      g.stroke();
    }
    // tooth
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.75;
    g.drawImage(T.relief, -PAD, -PAD);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    // pin-holes and flecks
    L.speckle(g, { seed: 's07sp', count: 520, x: -PAD, y: -PAD, w: TW, h: TH, rMin: 0.5, rMax: 1.8, colors: ['#9cc3ec', '#0c2647', '#d2e3f3'], alpha: [0.1, 0.5] });
  });
}

// ───────────────────────── the drawing ─────────────────────────
function build(env) {
  const a = env.arc, R = a.R;
  const T = buildTooth();
  const sp = a.span(PAD + 60);
  const nzS = L.makeNoise('s07streak');
  const stArc = (X, Y) => { const dx = X - a.cx, dy = a.cy - Y; return nzS.n2((Math.atan2(dx, dy) * R) / 85, (Math.hypot(dx, dy) - R) / 2.3); };
  const stRad = (X, Y) => { const dx = X - a.cx, dy = a.cy - Y; return nzS.n2((Math.atan2(dx, dy) * R) / 2.3, (Math.hypot(dx, dy) - R) / 85); };
  const stAng = (ang) => { const c = Math.cos(ang), s = Math.sin(ang); return (X, Y) => nzS.n2((X * c + Y * s) / 85, (-X * s + Y * c) / 2.3); };
  const full = { x: -PAD, y: -PAD, w: TW, h: TH };
  const yEdge = a.yAt(-PAD, 0);

  // ── static: rubbed chalk tone hugging the inside of the contour (the body catches the light), palm smudges ──
  const dust = chalkLayer(T, { x: -PAD, y: a.crestY - 10, w: TW, h: yEdge - a.crestY + 360 }, (g) => {
    g.save(); a.clipBelow(g, 0);
    g.fillStyle = L.radial(g, a.cx, a.cy, R - 340, R, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,0.16)'], [1, 'rgba(255,255,255,0.46)']]);
    g.fillRect(-PAD, -PAD, TW, TH);
    g.restore();
  }, { soft: 0, halo: 0.55, haloBlur: 7, hole: 0.8, pressAmp: 0.3, streak: stRad, streakAmp: 0.09, mottle: 0.1, mottle2: 0.06, edge: 0.24, seed: 'dust' });
  const smudge = chalkLayer(T, full, (g) => {
    const r = L.rng('s07smudge');
    const spots = [[250, 250, 300, 0.26], [1700, 300, 320, 0.24], [1180, 860, 300, 0.16], [520, 930, 260, 0.15], [960, 300, 380, 0.07]];
    for (const [x, y, rad, al] of spots) {
      g.save(); g.translate(x, y); g.rotate(r.range(-0.7, 0.2)); g.scale(1.7, 0.8);
      g.fillStyle = L.radial(g, 0, 0, 0, rad, [[0, `rgba(255,255,255,${al})`], [0.5, `rgba(255,255,255,${al * 0.5})`], [1, 'rgba(255,255,255,0)']]);
      g.fillRect(-rad, -rad, rad * 2, rad * 2); g.restore();
    }
  }, { soft: 0, halo: 0, hole: 0.8, pressAmp: 0.4, mottle: 0.14, mottle2: 0.06, edge: 0.2, seed: 'smudge' });

  // ── static: the light first line of the contour (the bold pass goes over it) ──
  const under = chalkLayer(T, { x: -PAD, y: a.crestY - 14, w: TW, h: yEdge - a.crestY + 28 }, (g) => {
    ribbon(g, L.arcPts(a, 0, -sp, sp, 260), 8.5, 'under', { jit: 0.9, wob: 0.12, ends: 0 });
  }, { gain: 1.1, hole: 0.72, soft: 1.5, streak: stArc, seed: 'under', halo: 0.26 });

  // ── static: construction lines, upper left (parallel groups on a 42° slope) ──
  const ux = Math.cos(L.deg(-42)), uy = Math.sin(L.deg(-42)), nx = -uy, ny = ux;
  const P = (s, off) => [ux * s + nx * off, 500 + uy * s + ny * off];
  const sl = (g, s0, s1, off, wd, seed, o) => { const p0 = P(s0, off), p1 = P(s1, off); seg(g, p0[0], p0[1], p1[0], p1[1], wd, seed, o); };
  const cross = (g, s, o0, o1, wd, seed, o) => { const p0 = P(s, o0), p1 = P(s, o1); seg(g, p0[0], p0[1], p1[0], p1[1], wd, seed, o); };
  const LN = { jit: 1.7, wob: 0.2 };   // free-hand lines: more wander, more pressure change
  const tlBox = { x: -PAD, y: -PAD, w: 840, h: 800 };
  const tlMain = chalkLayer(T, tlBox, (g) => {
    sl(g, -180, 920, 0, 17, 'tlB', LN);                       // the heavy one…
    sl(g, 90, 560, 11.5, 4.8, 'tlBg', LN);                    // …gone over twice
    sl(g, -80, 800, -164, 12, 'tlA1', LN); sl(g, -40, 780, -214, 9, 'tlA2', LN); sl(g, 0, 760, -264, 12, 'tlA3', LN);   // a group of three
    sl(g, 236, 560, -64, 10, 'tlS1', LN); sl(g, 330, 492, -106, 9, 'tlS2', LN);                              // two short ones
    for (const [k, s] of [270, 366, 462].entries()) cross(g, s, -286, -142, 8, 'tlR' + k, LN);                // rungs across the three
    cross(g, 452, -42, 42, 10, 'tlX', LN);
  }, { gain: 1.1, soft: 2.6, streak: stAng(L.deg(-42)), seed: 'tl' });
  const tlAux = chalkLayer(T, tlBox, (g) => {
    const p0 = P(-150, 86), p1 = P(600, 86);
    dashes(g, [p0, p1], [36, 20], 7, 'tlD');
  }, { color: GREY, gain: 1.18, soft: 1.6, mottle: 0.16, streak: stAng(L.deg(-42)), seed: 'tla', halo: 0.2 });

  // ── static: upper right — graduated measuring line, right-angle bracket ──
  const vx = Math.cos(L.deg(50)), vy = Math.sin(L.deg(50)), mx = -vy, my = vx;
  const Q = (s, off) => [1480 + vx * s + mx * off, vy * s + my * off];
  const ql = (g, s0, o0, s1, o1, wd, seed, o) => { const p0 = Q(s0, o0), p1 = Q(s1, o1); seg(g, p0[0], p0[1], p1[0], p1[1], wd, seed, o); };
  const trBox = { x: 1330, y: -PAD, w: W + PAD - 1330, h: 800 };
  const trMain = chalkLayer(T, trBox, (g) => {
    ql(g, -150, 0, 840, 0, 12.5, 'trM', LN);                   // the measuring line
    ql(g, 300, -9.5, 640, -9.5, 4.6, 'trMg', LN);
    for (let k = 0; k <= 11; k++) {
      const s = 72 + 52 * k, big = k % 4 === 0;
      ql(g, s, big ? -14 : 0, s, big ? 54 : 27, big ? 8 : 6.5, 'trT' + k, { ends: 0.15 });
    }
    ql(g, -160, -156, 392, -156, 15.5, 'trB1', LN); ql(g, 392, -156, 392, -450, 15.5, 'trB2', LN);   // the bracket: a square corner cut off by the frame
  }, { gain: 1.1, soft: 2.6, streak: stAng(L.deg(50)), seed: 'tr' });
  const trAux = chalkLayer(T, trBox, (g) => {
    ql(g, 346, -166, 346, -208, 6.5, 'trq1', { ends: 0.1 }); ql(g, 346, -208, 382, -208, 6.5, 'trq2', { ends: 0.1 });   // right-angle mark in the corner
    dashes(g, [Q(250, 96), Q(720, 96)], [36, 20], 7, 'trD');
  }, { color: GREY, gain: 1.18, soft: 1.6, mottle: 0.16, streak: stAng(L.deg(50)), seed: 'tra', halo: 0.2 });

  // ── flatten the static sheet ──
  const sheet = buildPaper(T);
  const sg = sheet.getContext('2d');
  const put = (el, al = 1) => { sg.globalAlpha = al; sg.drawImage(el.c, el.x, el.y); sg.globalAlpha = 1; };
  put(smudge, 0.5); put(dust, 0.95);
  put(tlAux); put(trAux); put(tlMain); put(trMain); put(under);

  // ── animated: the bold pass over the contour ──
  const anim = [];
  const bold = chalkLayer(T, { x: -PAD, y: a.crestY - 30, w: TW, h: yEdge - a.crestY + 60 }, (g) => {
    ribbon(g, L.arcPts(a, 0, -sp, sp, 260), 19.5, 'bold', { jit: 1.1, wob: 0.13, ends: 0 });
    ribbon(g, L.arcPts(a, -8, -sp, -0.05, 120), 5.5, 'bold2', { jit: 1.3, wob: 0.2, ends: 0 });   // gone over twice, not quite in register
    ribbon(g, L.arcPts(a, 7.5, 0.13, sp, 120), 5, 'bold3', { jit: 1.3, wob: 0.2, ends: 0 });
  }, { gain: 1.14, hole: 0.73, soft: 2.7, streak: stArc, seed: 'bold', halo: 0.34 });
  const thEnd = a.span(PAD + 30);
  anim.push({ el: bold, t0: ARC_SWEEP[0], t1: ARC_SWEEP[1], base: (ARC_FROM + sp) / (thEnd + sp),
    clip: (ctx, f) => { a.clipBand(ctx, 60, -60, -sp - 0.02, L.lerp(-sp, thEnd, f)); },
    tip: (f) => a.pt(L.lerp(-sp, thEnd, f), 0) });

  // ── animated: meridians ──
  const dots = [], rings = [];
  MER.forEach((m, i) => {
    const at = (d) => { const q = a.pt(m.th + m.lat(d) / (R - d), -d); return [q.x, q.y]; };
    const pts = []; let dVis = 0, t0 = 9, t1 = -9;
    for (let d = 3; d <= 760; d += 12) {
      const q = at(d); pts.push(q);
      if (q[1] < H + 14) dVis = d;
      const th = m.th + m.lat(d) / (R - d); if (th < t0) t0 = th; if (th > t1) t1 = th;
    }
    dVis = Math.min(760, dVis + 16);
    const el = chalkLayer(T, boundsOf(pts, m.w + 14), (g) => {
      ribbon(g, pts, m.w, 'mer' + i, { jit: 1.8, wob: 0.2, ends: 0.3, step: 4 });
      if (m.ghost) {
        const [g0, g1, side] = m.ghost, gp = [];
        for (let d = g0; d <= g1; d += 14) { const q = a.pt(m.th + (m.lat(d) + side * (m.w * 0.5 + 3.5)) / (R - d), -d); gp.push([q.x, q.y]); }
        ribbon(g, gp, 4.8, 'merg' + i, { jit: 1.4, wob: 0.25, ends: 0, step: 4 });
      }
    }, { gain: 1.12, hole: 0.73, soft: 2.6, streak: stRad, seed: 'mer' + i, halo: 0.3 });
    const ts = MER_T0 + i * MER_STEP, te = ts + MER_DUR, mg = 60 / R;
    anim.push({ el, t0: ts, t1: te,
      clip: (ctx, f) => { a.clipBand(ctx, 24, -f * dVis, t0 - mg, t1 + mg); },
      tip: (f) => { const q = at(f * dVis); return { x: q[0], y: q[1] }; } });
    m.dots.forEach((d, k) => {
      const q = at(d), t = ts + MER_DUR * (d / dVis) + 0.02, r = 10.5 + m.w * 0.36;
      const ringed = m.ring.includes(k);
      dots.push({ x: q[0], y: q[1], r, t, seed: i + '_' + k });
      if (ringed) rings.push({ x: q[0], y: q[1], r: r + 18, t0: t + 0.035, t1: t + 0.14, a0: -2.2 + i * 0.9, seed: i + '_' + k });
    });
  });
  const dotBox = boundsOf(dots.map((d) => [d.x, d.y]), 66);
  const dotL = chalkLayer(T, dotBox, (g) => { for (const d of dots) blob(g, d.x, d.y, d.r, d.seed); }, { gain: 1.32, hole: 0.7, soft: 2.2, pressAmp: 0.1, mottle: 0.16, seed: 'dots', halo: 0.34 });
  const ringL = chalkLayer(T, dotBox, (g) => { for (const q of rings) ribbon(g, ringPts(q.x, q.y, q.r, q.a0), 6.6, 'ring' + q.seed, { jit: 0.6, wob: 0.18, ends: 0.18, step: 2 }); },
    { gain: 1.22, hole: 0.7, soft: 1.6, pressAmp: 0.1, mottle: 0.16, seed: 'rings', halo: 0.3 });

  // ── animated: dashed proportional guides and tick ladders (pale chalk) ──
  const auxOpt = (seed, streak) => ({ color: GREY, gain: 1.18, hole: 0.7, soft: 1.6, mottle: 0.16, streak, seed, halo: 0.2 });
  const dashArc = (dr, tA, tB, seed, ts, te) => {
    const pts = L.arcPts(a, dr, tA, tB, 80);
    const el = chalkLayer(T, boundsOf(pts, 30), (g) => {
      dashes(g, pts, [36, 20], 7, seed);
      for (const t of [tA, tB]) { const q0 = a.pt(t, dr + 20), q1 = a.pt(t, dr - 20); seg(g, q0.x, q0.y, q1.x, q1.y, 7, seed + 'e' + t, { ends: 0.1 }); }
    }, auxOpt(seed, stArc));
    anim.push({ el, t0: ts, t1: te, clip: (ctx, f) => { a.clipBand(ctx, dr + 36, dr - 36, tA - 0.02, L.lerp(tA - 0.01, tB + 0.02, f)); } });
  };
  dashArc(-196, -0.325, -0.022, 'dA', 0.26, 0.5);
  dashArc(-368, 0.018, 0.34, 'dB', 0.4, 0.62);
  { // a graduated guide between two meridians: a light rule with equal divisions ticked off on one side
    const th = 0.122, at = (d, off) => { const q = a.pt(th + off / (R - d), -d); return [q.x, q.y]; };
    const el = chalkLayer(T, boundsOf([at(30, -10), at(720, 40)], 30), (g) => {
      const rail = [];
      for (let d = 46; d <= 720; d += 48) rail.push(at(d, 0));
      ribbon(g, rail, 6.2, 'dR', { ends: 0.16, jit: 1.2, wob: 0.18 });
      for (let k = 0; k <= 8; k++) {
        const d = 98 + 44 * k, big = k % 4 === 0, p0 = at(d, big ? -7 : 0), p1 = at(d, big ? 36 : 21);
        seg(g, p0[0], p0[1], p1[0], p1[1], big ? 6.4 : 5.6, 'dRt' + k, { ends: 0.1 });
      }
    }, auxOpt('dR', stRad));
    anim.push({ el, t0: 0.34, t1: 0.62, clip: (ctx, f) => { a.clipBand(ctx, 0, -f * 640, th - 0.03, th + 0.04); } });
  }

  return { sheet, anim, dots, rings, dotL, ringL };
}

export default {
  name: '经络图蓝晒',
  tone: 'light',
  init(env) { S = build(env); },
  draw(ctx, env, p) {
    ctx.fillStyle = DEEP; ctx.fillRect(0, 0, W, H);
    // a very slight push-in; zoom passes through ~1.0 mid-shot so the contour stays on the shared arc
    const zoom = L.lerp(0.992, 1.016, p), rot = L.lerp(-0.0028, 0.0028, p);
    L.cam(ctx, env, { rot, zoom }, () => {
      ctx.drawImage(S.sheet, -PAD, -PAD);
      const tips = [];
      for (const e of S.anim) {
        let f = (p - e.t0) / (e.t1 - e.t0);
        if (e.base !== undefined) f = e.base + (1 - e.base) * L.clamp(f);   // the bold pass is already under way on the first frame
        if (f <= 0) continue;
        if (f >= 1) { ctx.drawImage(e.el.c, e.el.x, e.el.y); continue; }
        ctx.save(); e.clip(ctx, f); ctx.drawImage(e.el.c, e.el.x, e.el.y); ctx.restore();
        if (e.tip) tips.push(e.tip(f));
      }
      // acupoints: dabbed on as the line passes; rings are swept round afterwards
      const dl = S.dotL, rl = S.ringL;
      for (const d of S.dots) {
        if (p < d.t) continue;
        const s = d.r + 16, x = Math.round(d.x - s), y = Math.round(d.y - s), n = Math.round(s * 2);
        ctx.drawImage(dl.c, x - dl.x, y - dl.y, n, n, x, y, n, n);
        if (p - d.t < 0.07) tips.push({ x: d.x, y: d.y, k: 0.7 });
      }
      for (const q of S.rings) {
        if (p < q.t0) continue;
        const f = (p - q.t0) / (q.t1 - q.t0), s = q.r + 18, x = Math.round(q.x - s), y = Math.round(q.y - s), n = Math.round(s * 2);
        ctx.save();
        if (f < 1) { ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.arc(q.x, q.y, s + 4, q.a0 - 0.15, q.a0 - 0.15 + f * (L.TAU + 0.6)); ctx.closePath(); ctx.clip(); }
        ctx.drawImage(rl.c, x - rl.x, y - rl.y, n, n, x, y, n, n);
        ctx.restore();
      }
      // a puff of chalk dust where a stroke is being laid
      for (const t of tips) L.glow(ctx, t.x, t.y, 34 * (t.k || 1), '#ffffff', 0.3);
    });
    // fixed soft raking light from the upper left; corners sink to the deep blue
    ctx.save(); ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = L.radial(ctx, 720, 330, 0, 1500, [[0, 'rgba(96,196,255,0.56)'], [0.5, 'rgba(96,196,255,0.14)'], [0.72, 'rgba(8,24,52,0.05)'], [1, 'rgba(8,24,52,0.3)']]);
    ctx.fillRect(0, 0, W, H); ctx.restore();
    L.vignette(ctx, { strength: 0.62, color: '#123354', inner: 0.5, outer: 1.1 });
  },
};
