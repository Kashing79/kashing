// s07 — 经络图蓝晒. A chalk study on Prussian-blue cyanotype paper.
// The shared arc is the contour of a shoulder (a fragment only — no head, no face), drawn as the boldest chalk line.
// Below it seven meridian lines run down the body, each dabbed with a few acupoints at uneven intervals (a few ringed);
// between them two dashed proportional guides and a couple of short cross-ticks. Above it, cutting in from the two
// upper corners: a group of bold slanted parallels with rungs, a graduated measuring line and a right-angle bracket.
// Nothing is written anywhere: no characters, no numerals, no point names. The drawing is this film's own invention,
// not a copy of any historical chart.
//
// Chalk is synthesised per pixel in init(): every stroke is first drawn as soft-edged coverage, then thresholded
// against a clumpy "grip" field that shares its grain with the paper's embossed tooth, so the chalk breaks into
// islands, skips where the hand was light and frays at its edges. Each animated mark is a tight pre-rendered canvas
// revealed with an arc-space clip. Focus is baked in: sharpest round the crest, a touch soft toward the corners.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 80;                       // camera only drifts a few px → a slim margin is enough
const TW = W + PAD * 2, TH = H + PAD * 2;
const BLUE = '#1f4e79', DEEP = '#153a5c', CHALK = '#f1f4f2', GREY = '#b9cbd6';
const PALE = L.mix(CHALK, GREY, 0.5); // lightly laid chalk
const sq = (v) => v * v;
let S = null;

// meridians, left → right. th = where the line meets the shoulder contour (radians from the crest),
// lat(d) = sideways drift in px at depth d below the contour, dots = acupoint depths (uneven on purpose), ring = ringed ones,
// ghost = [d0, d1, side]: a stretch that was gone over twice, slightly out of register; over = how far the stroke starts above the contour
const MER = [
  { th: -0.345, w: 13.5, lat: (d) => 62 * sq(d / 500), dots: [92, 236, 352], ring: [1] },
  { th: -0.235, w: 18, over: 30, ghost: [150, 430, 1], lat: (d) => -40 * sq(d / 500) + 9 * Math.sin(d / 120), dots: [60, 172, 318, 468], ring: [] },
  { th: -0.118, w: 11.5, lat: (d) => 40 * Math.pow(d / 500, 1.5), dots: [124, 276, 420], ring: [1] },
  { th: -0.062, w: 15, over: 16, lat: (d) => 66 * Math.pow(d / 500, 1.5), dots: [66, 226, 404], ring: [] },
  { th: 0.058, w: 19, ghost: [40, 300, -1], lat: (d) => -50 * sq(d / 500), dots: [96, 184, 330, 470], ring: [2] },
  { th: 0.185, w: 12.5, over: 38, lat: (d) => 32 * Math.sin(d / 190), dots: [70, 304, 424], ring: [0] },
  { th: 0.3, w: 15.5, ghost: [200, 520, 1], lat: (d) => -68 * sq(d / 500), dots: [118, 338, 432], ring: [1] },
];
// timing (in shot progress p): the shot cuts in with the drawing already under way — the bold pass is finishing its sweep
// along the contour and the first meridians are dropping from it; the points are dabbed on as each line passes them, then
// the guides and ticks. Everything is finished by p ≈ 0.55 and holds, so the cut-out frame is the complete chart.
const ARC_SWEEP = [0, 0.1], ARC_FROM = 0.12;
const MER_T0 = -0.17, MER_STEP = 0.04, MER_DUR = 0.3;

// ───────────────────────── paper tooth ─────────────────────────
/**
 * Two normalised fields (mean 0, sd 1) over the whole sheet, built from the same grains so they agree:
 *   z = the fine tooth (→ the embossed relief canvas), f = a clumpier "grip" field (→ where chalk takes and where it skips).
 * grip = white canvas whose alpha is how readily rubbed dust settles (the peaks of the tooth).
 */
function buildTooth() {
  const g1 = L.grainTex(TW, TH, { seed: 's07t1', amount: 1, size: 1 });
  const g2 = L.grainTex(TW, TH, { seed: 's07t2', amount: 1, size: 2 });
  const g5 = L.grainTex(TW, TH, { seed: 's07t3', amount: 1, size: 5 });
  const g11 = L.grainTex(TW, TH, { seed: 's07t4', amount: 1, size: 11 });
  const n = TW * TH;
  const field = (parts) => {
    const c = L.makeCanvas(TW, TH), g = c.getContext('2d', { willReadFrequently: true });
    for (const [tex, al] of parts) { g.globalAlpha = al; g.drawImage(tex, 0, 0); }
    const d = g.getImageData(0, 0, TW, TH).data, out = new Float32Array(n);
    let m = 0, v = 0;
    for (let i = 0; i < n; i++) m += d[i * 4];
    m /= n;
    for (let i = 0; i < n; i++) { const e = d[i * 4] - m; v += e * e; }
    const sd = Math.sqrt(v / n) || 1;
    for (let i = 0; i < n; i++) out[i] = (d[i * 4] - m) / sd;
    return out;
  };
  const z = field([[g1, 1], [g2, 0.5], [g5, 0.4]]);
  const f = field([[g5, 1], [g11, 0.4], [g2, 0.34], [g1, 0.1]]);
  // relief lit from the upper left + a little albedo (the blue pools deeper in the hollows)
  const img = new ImageData(TW, TH), o = img.data, gi = new ImageData(TW, TH), q = gi.data;
  for (let y = 0; y < TH; y++) {
    const up = y > 0 ? TW : 0, dn = y < TH - 1 ? TW : 0;
    for (let x = 0; x < TW; x++) {
      const k = y * TW + x, i = k * 4;
      const gx = z[k + (x < TW - 1 ? 1 : 0)] - z[k - (x > 0 ? 1 : 0)], gy = z[k + dn] - z[k - up];
      const s = 128 + (gx + gy) * 9 + z[k] * 8;
      o[i] = o[i + 1] = o[i + 2] = s; o[i + 3] = 255;
      q[i] = q[i + 1] = q[i + 2] = 255; q[i + 3] = 104 + 62 * z[k] + 40 * f[k];
    }
  }
  const relief = L.makeCanvas(TW, TH), grip = L.makeCanvas(TW, TH);
  relief.getContext('2d').putImageData(img, 0, 0);
  grip.getContext('2d').putImageData(gi, 0, 0);
  return { z, f, relief, grip };
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
    const wv = 1 + wob * nz.n2(s[i] / 70, 1.3) + 0.07 * nz.n2(s[i] / 9, 7.7) + ends * Math.exp(-e / (width * 1.3 + 4));
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
    const on = pat[0] * r.range(0.72, 1.28), off = pat[1] * r.range(0.75, 1.25);
    const j = Math.min(p.length - 1, i + Math.round(on / 2));
    if (j - i >= 3) ribbon(g, [p[i], p[(i + j) >> 1], p[j]], width * r.range(0.85, 1.15), seed + '_' + k, { ends: 0.2, ...o });
    i = j + Math.round(off / 2); k++;
  }
}
/** a dabbed point: the chalk pressed down and given a slight twist — lumpy, never quite round */
function dab(g, x, y, r, seed) {
  const nz = L.makeNoise('s07bl' + seed), rr = L.rng('s07dab' + seed), n = 22;
  const ax = 1 + rr.range(0.02, 0.24), rot = rr.range(0, Math.PI);
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(ax, 1 / ax);
  g.beginPath();
  for (let k = 0; k < n; k++) {
    const an = (k / n) * L.TAU, q = r * (1 + 0.2 * nz.n2(Math.cos(an) * 1.5 + 3, Math.sin(an) * 1.5));
    if (k === 0) g.moveTo(q * Math.cos(an), q * Math.sin(an)); else g.lineTo(q * Math.cos(an), q * Math.sin(an));
  }
  g.closePath(); g.fill();
  g.restore();
}
function ringPts(x, y, r, a0, sq2) {
  const out = [], n = 28;
  for (let k = 0; k <= n; k++) {
    const an = a0 + (k / n) * (L.TAU + 0.42), rr = r * (1 + sq2 * Math.sin(an * 2 + a0) + 0.06 * (k / n));
    out.push([x + rr * Math.cos(an), y + rr * Math.sin(an)]);
  }
  return out;
}

/**
 * Turn coverage into chalk. box = {x,y,w,h} in frame coords (clamped to the sheet); draw(g) paints white coverage.
 * opts: gain (pressure), hole (threshold: higher = more skips), rough (how strongly the paper's grip breaks the mark up),
 *       soft (edge softness px of the coverage), color, halo (dust around the mark), streak (fn(X,Y) → -1..1: skips that
 *       run along the stroke), pressAmp / pressLen (slow change of hand pressure), edge (threshold softness), seed
 * → { c, x, y, w, h }: a tight canvas and where it sits in the frame.
 */
function chalkLayer(T, box, draw, o = {}) {
  const { gain = 1.1, hole = 0.72, rough = 0.2, soft = 2, color = CHALK, halo = 0.22, haloBlur = 5, streak = null, streakAmp = 0.15,
    pressAmp = 0.22, pressLen = 130, edge = 0.05, crumbs = 1, seed = 'a' } = o;
  const m = 20;
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
  const col = L.parseColor(color), F = T.f, Z = T.z;
  // crumbs: bits of chalk that broke off and lie beside the mark, caught on the highest points of the tooth
  let near = null;
  if (crumbs) {
    const wc = L.makeCanvas(w, h), wg = wc.getContext('2d', { willReadFrequently: true });
    wg.filter = 'blur(8px)'; wg.drawImage(cov, 0, 0);
    near = wg.getImageData(0, 0, w, h).data;
  }
  for (let y = 0; y < h; y++) {
    const Y = y + y0, row = (Y + PAD) * TW + PAD + x0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, al = d[i + 3];
      if (al < 4) {
        d[i + 3] = 0;
        if (near && near[i + 3] > 5) {
          const c = 0.62 * F[row + x] + 0.5 * Z[row + x] - (2.62 - 0.85 * crumbs * (near[i + 3] / 255));
          if (c > 0) { d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = c > 0.22 ? 235 : 235 * (c / 0.22); }
        }
        continue;
      }
      const X = x + x0;
      let th = hole + rough * F[row + x];
      if (streak) th += streakAmp * streak(X, Y);
      const over = (al / 255) * gain * (1 + pressAmp * nz.n2(X / pressLen, Y / pressLen)) - th;
      if (over <= -edge) { d[i + 3] = 0; continue; }
      let t = over >= edge ? 1 : (over + edge) / (edge * 2);
      t = t * t * (3 - 2 * t);
      // thinly laid chalk lets a little blue through
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 250 * t * (0.76 + 0.24 * (over > 0.3 ? 1 : over < 0 ? 0 : over / 0.3));
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

/**
 * Bake the lens into a canvas that sits at frame position (ox, oy): sharp round (fx, fy), up to `px` of blur toward the
 * corners of the frame. Mutates and returns c.
 */
function focus(c, ox, oy, fx, fy, px) {
  const mask = (g) => {
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.translate(fx - ox, fy - oy); g.scale(1, 0.72);
    g.fillStyle = L.radial(g, 0, 0, 520, 1320, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]);
    g.fillRect(-3000, -3000, 6000, 6000); g.restore();
  };
  const b = L.blurred(c, px), bg = b.getContext('2d');
  bg.globalCompositeOperation = 'destination-in'; mask(bg);
  const g = c.getContext('2d');
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'destination-out'; mask(g);
  g.globalCompositeOperation = 'lighter'; g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(b, 0, 0);
  g.restore();
  return c;
}

// ───────────────────────── paper ─────────────────────────
function buildPaper(T) {
  return L.makeLayer(PAD, (g) => {
    g.fillStyle = BLUE; g.fillRect(-PAD, -PAD, TW, TH);
    // uneven exposure of the hand-coated sheet: slow, shallow pools of deeper and of cleaner blue
    g.drawImage(L.noiseTex(TW, TH, { seed: 's07c1', scale: 900, octaves: 3, res: 0.1, warp: 0.5, contrast: 1.3,
      ramp: [[0, L.rgba(DEEP, 0.3)], [0.44, L.rgba(DEEP, 0)], [0.58, L.rgba('#2a6db0', 0)], [1, L.rgba('#2a6db0', 0.3)]] }), -PAD, -PAD);
    g.globalAlpha = 0.12;
    g.drawImage(L.noiseTex(TW, TH, { seed: 's07c2', scale: 170, octaves: 4, res: 0.2, warp: 0.4, contrast: 1.4,
      ramp: [[0, L.rgba('#143660', 0.5)], [0.46, 'rgba(20,54,96,0)'], [0.6, 'rgba(58,124,190,0)'], [1, L.rgba('#3a7cbe', 0.36)]] }), -PAD, -PAD);
    // faint brush streaks of the sensitiser
    g.globalAlpha = 0.06;
    g.drawImage(L.noiseTex(TW, TH, { seed: 's07c3', scale: 60, sx: 30, sy: 1, octaves: 3, res: 0.25, contrast: 1.6,
      ramp: [[0, L.rgba('#10305a', 0.6)], [0.46, 'rgba(16,48,90,0)'], [0.6, 'rgba(84,144,204,0)'], [1, L.rgba('#5490cc', 0.45)]] }), -PAD, -PAD);
    g.globalAlpha = 1;
    // paper fibres
    const r = L.rng('s07fib');
    g.lineCap = 'round';
    for (let i = 0; i < 700; i++) {
      const x = r.range(-PAD, W + PAD), y = r.range(-PAD, H + PAD), len = r.range(10, 44), an = r() * Math.PI;
      g.strokeStyle = r.chance(0.55) ? L.rgba('#7fb0e2', r.range(0.04, 0.16)) : L.rgba('#0d2a4c', r.range(0.05, 0.18));
      g.lineWidth = r.range(0.6, 1.5);
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(an) * len * 0.5 + r.range(-5, 5), y + Math.sin(an) * len * 0.5 + r.range(-5, 5), x + Math.cos(an) * len, y + Math.sin(an) * len);
      g.stroke();
    }
    // tooth
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.78;
    g.drawImage(T.relief, -PAD, -PAD);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    // a few pin-holes and flecks
    L.speckle(g, { seed: 's07sp', count: 260, x: -PAD, y: -PAD, w: TW, h: TH, rMin: 0.6, rMax: 1.9, colors: ['#9cc3ec', '#0c2647', '#d2e3f3'], alpha: [0.1, 0.45] });
  });
}

// ───────────────────────── the drawing ─────────────────────────
function build(env) {
  const a = env.arc, R = a.R;
  const T = buildTooth();
  const sp = a.span(PAD + 60);
  const nzS = L.makeNoise('s07streak');
  const stArc = (X, Y) => { const dx = X - a.cx, dy = a.cy - Y; return nzS.n2((Math.atan2(dx, dy) * R) / 52, (Math.hypot(dx, dy) - R) / 2.8); };
  const stRad = (X, Y) => { const dx = X - a.cx, dy = a.cy - Y; return nzS.n2((Math.atan2(dx, dy) * R) / 2.8, (Math.hypot(dx, dy) - R) / 52); };
  const stAng = (ang) => { const c = Math.cos(ang), s = Math.sin(ang); return (X, Y) => nzS.n2((X * c + Y * s) / 52, (-X * s + Y * c) / 2.8); };
  const yEdge = a.yAt(-PAD, 0);
  const fx = a.cx, fy = a.crestY + 40;
  const lens = (el, px = 1.5) => {      // marks that sit wholly inside the sharp zone are left alone
    const dx = Math.max(Math.abs(el.x - fx), Math.abs(el.x + el.w - fx)), dy = Math.max(Math.abs(el.y - fy), Math.abs(el.y + el.h - fy)) / 0.72;
    if (Math.hypot(dx, dy) > 540) focus(el.c, el.x, el.y, fx, fy, px);
    return el;
  };

  // ── static: chalk rubbed in with the side of the stick just inside the contour (the body catches the light) ──
  const haze = L.makeCanvas(TW, TH), hg = haze.getContext('2d');
  hg.translate(PAD, PAD);
  hg.save(); a.clipBelow(hg, -3);
  hg.fillStyle = L.radial(hg, a.cx, a.cy, R - 440, R, [[0, L.rgba(CHALK, 0)], [0.34, L.rgba(CHALK, 0.035)], [0.66, L.rgba(CHALK, 0.11)], [0.88, L.rgba(CHALK, 0.24)], [1, L.rgba(CHALK, 0.4)]]);
  hg.fillRect(-PAD, -PAD, TW, TH);
  hg.restore();
  hg.setTransform(1, 0, 0, 1, 0, 0); hg.globalCompositeOperation = 'destination-in';
  // the rubbing went along the contour in a few uneven passes
  hg.drawImage(L.noiseTex(TW, TH, { seed: 's07hz', scale: 90, sx: 9, sy: 1, octaves: 2, res: 0.25, contrast: 1.3,
    polar: { cx: a.cx + PAD, cy: a.cy + PAD, R }, ramp: [[0, 'rgba(255,255,255,0.3)'], [1, 'rgba(255,255,255,1)']] }), 0, 0);
  hg.drawImage(T.grip, 0, 0);                    // dust only settles on the peaks of the tooth

  // ── static: the light first line of the contour (the bold pass goes over it) ──
  const under = chalkLayer(T, { x: -PAD, y: a.crestY - 14, w: TW, h: yEdge - a.crestY + 28 }, (g) => {
    ribbon(g, L.arcPts(a, 0, -sp, sp, 260), 9, 'under', { jit: 0.9, wob: 0.12, ends: 0 });
  }, { gain: 1.08, hole: 0.76, soft: 1.6, streak: stArc, seed: 'under', halo: 0.2 });

  // ── static: construction lines, upper left — a bold group of parallels on a 39.5° slope, two rungs, one tick ──
  const LN = { jit: 1.8, wob: 0.2 };   // free-hand lines: more wander, more pressure change
  const ux = Math.cos(L.deg(-39.5)), uy = Math.sin(L.deg(-39.5)), nx = -uy, ny = ux;
  const P = (s, off) => [ux * s + nx * off, 610 + uy * s + ny * off];
  const sl = (g, s0, s1, off, wd, seed, o) => { const p0 = P(s0, off), p1 = P(s1, off); seg(g, p0[0], p0[1], p1[0], p1[1], wd, seed, o); };
  const cross = (g, s, o0, o1, wd, seed, o) => { const p0 = P(s, o0), p1 = P(s, o1); seg(g, p0[0], p0[1], p1[0], p1[1], wd, seed, o); };
  const tl = chalkLayer(T, { x: -PAD, y: -PAD, w: 900, h: 800 }, (g) => {
    sl(g, -150, 1120, 0, 20, 'tl0', LN);                       // the heavy one…
    sl(g, 170, 660, 13, 5, 'tl0g', LN);                        // …gone over twice
    sl(g, -60, 606, -92, 15, 'tl1', LN);
    sl(g, -60, 1010, -150, 17, 'tl2', LN);
    sl(g, 156, 566, -208, 13.5, 'tl3', LN);
    sl(g, -60, 1010, -268, 16, 'tl4', LN);
    sl(g, 246, 770, -334, 14.5, 'tl5', LN);
    cross(g, 384, -304, -116, 12.5, 'tlR0', LN);               // rungs across the group
    cross(g, 506, -248, -50, 12, 'tlR1', LN);
    cross(g, 252, -44, 50, 12, 'tlX', LN);                     // a tick across the heavy line
  }, { gain: 1.1, hole: 0.74, soft: 2.2, pressAmp: 0.26, streak: stAng(L.deg(-39.5)), seed: 'tl' });

  // ── static: upper right — graduated measuring line, right-angle bracket ──
  const vx = Math.cos(L.deg(50)), vy = Math.sin(L.deg(50)), mx = -vy, my = vx;
  const Q = (s, off) => [1410 + vx * s + mx * off, vy * s + my * off];
  const ql = (g, s0, o0, s1, o1, wd, seed, o) => { const p0 = Q(s0, o0), p1 = Q(s1, o1); seg(g, p0[0], p0[1], p1[0], p1[1], wd, seed, o); };
  const tr = chalkLayer(T, { x: 1300, y: -PAD, w: W + PAD - 1300, h: 820 }, (g) => {
    const r = L.rng('s07ticks');
    ql(g, -150, 0, 1010, 0, 15.5, 'trM', LN);                  // the measuring line
    ql(g, 300, 11.5, 650, 11.5, 5, 'trMg', LN);
    for (let k = 0; k <= 7; k++) {                             // graduations: long and short by turns, stepped off by hand
      const s = 100 + 84 * k + r.range(-5, 5), big = k % 2 === 0, lean = r.range(-5, 5);
      ql(g, s, big ? 13 : 2, s + lean, big ? -r.range(54, 64) : -r.range(30, 38), big ? 10.5 : 9, 'trT' + k, { ends: 0.18, jit: 1 });
    }
    ql(g, -160, -170, 402, -170, 16, 'trB1', LN); ql(g, 398, -164, 400, -560, 16, 'trB2', LN);   // the bracket: a square corner cut off by the frame
  }, { gain: 1.1, hole: 0.74, soft: 2.2, pressAmp: 0.26, streak: stAng(L.deg(50)), seed: 'tr' });

  // ── flatten the static sheet ──
  const sheet = buildPaper(T);
  const sg = sheet.getContext('2d');
  const put = (el, al = 1) => { sg.globalAlpha = al; sg.drawImage(el.c, el.x, el.y); sg.globalAlpha = 1; };
  sg.drawImage(haze, -PAD, -PAD);
  put(tl); put(tr); put(under);
  focus(sheet, -PAD, -PAD, fx, fy, 1.5);

  // ── animated: the bold pass over the contour ──
  const anim = [];
  const bold = lens(chalkLayer(T, { x: -PAD, y: a.crestY - 30, w: TW, h: yEdge - a.crestY + 60 }, (g) => {
    ribbon(g, L.arcPts(a, 0, -sp, sp, 260), 20, 'bold', { jit: 1.1, wob: 0.13, ends: 0 });
    ribbon(g, L.arcPts(a, -8.5, -sp, -0.05, 120), 5.5, 'bold2', { jit: 1.3, wob: 0.2, ends: 0 });   // gone over twice, not quite in register
    ribbon(g, L.arcPts(a, 8, 0.13, sp, 120), 5, 'bold3', { jit: 1.3, wob: 0.2, ends: 0 });
  }, { gain: 1.14, hole: 0.7, soft: 2.2, streak: stArc, seed: 'bold', halo: 0.3 }));
  const thEnd = a.span(PAD + 30);
  anim.push({ el: bold, t0: ARC_SWEEP[0], t1: ARC_SWEEP[1], base: (ARC_FROM + sp) / (thEnd + sp),
    clip: (ctx, f) => { a.clipBand(ctx, 60, -60, -sp - 0.02, L.lerp(-sp, thEnd, f)); },
    tip: (f) => a.pt(L.lerp(-sp, thEnd, f), 0) });

  // ── animated: meridians ──
  const dots = [], rings = [];
  MER.forEach((m, i) => {
    const at = (d) => { const q = a.pt(m.th + m.lat(Math.max(0, d)) / (R - d), -d); return [q.x, q.y]; };
    const top = -(m.over || 0);
    const pts = []; let dVis = 0, t0 = 9, t1 = -9;
    for (let d = top + 3; d <= 760; d += 12) {
      const q = at(d); pts.push(q);
      if (q[1] < H + 14) dVis = d;
      const th = m.th + m.lat(Math.max(0, d)) / (R - d); if (th < t0) t0 = th; if (th > t1) t1 = th;
    }
    dVis = Math.min(760, dVis + 16);
    const el = lens(chalkLayer(T, boundsOf(pts, m.w + 14), (g) => {
      ribbon(g, pts, m.w, 'mer' + i, { jit: 1.8, wob: 0.22, ends: 0.3, step: 4 });
      if (m.ghost) {
        const [g0, g1, side] = m.ghost, gp = [];
        for (let d = g0; d <= g1; d += 14) { const q = a.pt(m.th + (m.lat(d) + side * (m.w * 0.5 + 4)) / (R - d), -d); gp.push([q.x, q.y]); }
        ribbon(g, gp, 5, 'merg' + i, { jit: 1.4, wob: 0.25, ends: 0, step: 4 });
      }
    }, { gain: 1.12, hole: 0.73, soft: 2.2, pressAmp: 0.26, streak: stRad, seed: 'mer' + i, halo: 0.26 }));
    const ts = MER_T0 + i * MER_STEP, te = ts + MER_DUR, mg = 60 / R;
    anim.push({ el, t0: ts, t1: te,
      clip: (ctx, f) => { a.clipBand(ctx, -top + 26, -L.lerp(top, dVis, f), t0 - mg, t1 + mg); },
      tip: (f) => { const q = at(L.lerp(top, dVis, f)); return { x: q[0], y: q[1] }; } });
    const rr = L.rng('s07pt' + i);
    m.dots.forEach((d, k) => {
      const q = at(d), t = ts + MER_DUR * ((d - top) / (dVis - top)) + 0.02, r = (11 + m.w * 0.5) * rr.range(0.84, 1.2);
      const ringed = m.ring.includes(k);
      dots.push({ x: q[0], y: q[1], r, t, seed: i + '_' + k });
      if (ringed) rings.push({ x: q[0] + rr.range(-4, 4), y: q[1] + rr.range(-4, 4), r: r + rr.range(20, 27), t0: t + 0.035, t1: t + 0.14, a0: -2.2 + i * 0.9, sq2: rr.range(0.07, 0.14), seed: i + '_' + k });
    });
  });
  // each point and each ring is its own small scrap of chalk
  for (const d of dots) {
    const e = d.r * 1.3 + 6;
    d.el = lens(chalkLayer(T, { x: d.x - e, y: d.y - e, w: e * 2, h: e * 2 }, (g) => dab(g, d.x, d.y, d.r, d.seed),
      { gain: 1.3, hole: 0.72, soft: 2, pressAmp: 0.1, seed: 'dot' + d.seed, halo: 0.3 }));
  }
  for (const q of rings) {
    const e = q.r * 1.16 + 10;
    q.el = lens(chalkLayer(T, { x: q.x - e, y: q.y - e, w: e * 2, h: e * 2 }, (g) => ribbon(g, ringPts(q.x, q.y, q.r, q.a0, q.sq2), 7.4, 'ring' + q.seed, { jit: 0.7, wob: 0.2, ends: 0.18, step: 2 }),
      { gain: 1.2, hole: 0.74, soft: 1.7, pressAmp: 0.14, seed: 'ring' + q.seed, halo: 0.24 }));
  }

  // ── animated: dashed proportional guides and short cross-ticks (lighter chalk) ──
  const auxOpt = (seed, streak) => ({ color: PALE, gain: 1.12, hole: 0.76, soft: 1.8, streak, seed, halo: 0.18 });
  const dashArc = (dr, tA, tB, seed, ts, te) => {
    const pts = L.arcPts(a, dr, tA, tB, 80);
    const el = lens(chalkLayer(T, boundsOf(pts, 34), (g) => {
      dashes(g, pts, [46, 27], 8.5, seed);
      for (const t of [tA, tB]) { const q0 = a.pt(t, dr + 24), q1 = a.pt(t, dr - 24); seg(g, q0.x, q0.y, q1.x, q1.y, 8.5, seed + 'e' + t, { ends: 0.14 }); }
    }, auxOpt(seed, stArc)));
    anim.push({ el, t0: ts, t1: te, clip: (ctx, f) => { a.clipBand(ctx, dr + 40, dr - 40, tA - 0.02, L.lerp(tA - 0.01, tB + 0.02, f)); } });
  };
  dashArc(-204, -0.305, -0.094, 'dA', 0.2, 0.38);
  dashArc(-246, 0.105, 0.345, 'dB', 0.3, 0.48);
  // two quick ticks struck across a meridian, the way a draughtsman marks a division
  for (const [k, mi, d, len, ang, wd, t] of [[0, 3, 306, 106, -42, 12.5, 0.36], [1, 1, 392, 90, -30, 12, 0.44]]) {
    const m = MER[mi], c = a.pt(m.th + m.lat(d) / (R - d), -d), ex = Math.cos(L.deg(ang)) * len / 2, ey = Math.sin(L.deg(ang)) * len / 2;
    const el = lens(chalkLayer(T, { x: c.x - len / 2 - 16, y: c.y - len / 2 - 16, w: len + 32, h: len + 32 }, (g) => {
      seg(g, c.x - ex, c.y - ey, c.x + ex, c.y + ey, wd, 'ck' + k, { ends: 0.2, jit: 1.2, wob: 0.2 });
    }, { gain: 1.12, hole: 0.72, soft: 2.1, streak: stAng(L.deg(ang)), seed: 'ck' + k, halo: 0.24 }));
    anim.push({ el, t0: t, t1: t + 0.05, clip: (ctx, f) => { ctx.beginPath(); ctx.rect(c.x - len, c.y - len, len * 2 * f + 8, len * 2); ctx.clip(); }, tip: (f) => ({ x: c.x + ex * (2 * f - 1), y: c.y + ey * (2 * f - 1), k: 0.7 }) });
  }

  return { sheet, anim, dots, rings };
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
      for (const d of S.dots) {
        if (p < d.t) continue;
        ctx.drawImage(d.el.c, d.el.x, d.el.y);
        if (p - d.t < 0.07) tips.push({ x: d.x, y: d.y, k: 0.7 });
      }
      for (const q of S.rings) {
        if (p < q.t0) continue;
        const f = (p - q.t0) / (q.t1 - q.t0);
        ctx.save();
        if (f < 1) { ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.arc(q.x, q.y, q.r * 1.16 + 40, q.a0 - 0.15, q.a0 - 0.15 + f * (L.TAU + 0.7)); ctx.closePath(); ctx.clip(); }
        ctx.drawImage(q.el.c, q.el.x, q.el.y);
        ctx.restore();
      }
      // a puff of chalk dust where a stroke is being laid
      for (const t of tips) L.glow(ctx, t.x, t.y, 30 * (t.k || 1), '#ffffff', 0.26);
    });
    // fixed soft raking light from the upper left; the corners only just fall away
    ctx.save(); ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = L.radial(ctx, 720, 330, 0, 1500, [[0, 'rgba(96,196,255,0.54)'], [0.5, 'rgba(96,196,255,0.2)'], [0.76, 'rgba(60,130,200,0.06)'], [1, 'rgba(8,24,52,0.16)']]);
    ctx.fillRect(0, 0, W, H); ctx.restore();
    L.vignette(ctx, { strength: 0.36, color: '#123354', inner: 0.56, outer: 1.12 });
  },
};
