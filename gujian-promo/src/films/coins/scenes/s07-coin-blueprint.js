// s07 — 方孔圆钱规制图. A chalk working drawing of a round coin with a square hole, on Prussian-blue cyanotype paper.
// The shared arc is the OUTER EDGE of the coin (the boldest chalk line); a second concentric line 66 px inside it
// marks the width of the raised outer rim (外郭). Below: radial construction lines from the centre of the circle,
// the dash-dot centre axis, and — at the bottom of frame — the top of the square hole (穿) wrapped by the double
// line of the inner rim (内郭). The flat field between the two rims is the 肉.
// NOTE: schematic, not to scale — the field is foreshortened so the hole fits in a 16:9 close-up of the rim.
// Only the four part names are written; no dimensions, figures or dates anywhere.
//
// Chalk is rendered per pixel in init(): every line is first drawn as a soft "pressure" mask, then thresholded
// against a clumpy paper-tooth field, so strokes get a dense core, ragged skipping edges and a sprinkle of dust.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 120;
const CHALK = '#f3f6f8', BLUE = '#1b4f8a', DEEP = '#123a69', WORN = '#3f73ab';

const RIM = 66;            // 外郭: width of the outer rim (arc → second concentric line)
const STEP = 0.09;         // angular pitch of the radial construction lines (rad)
const HOLE_TOP = 350;      // 穿: top edge of the square hole, px below the crest
const HOLE_HALF = 430;     // 穿: half-width of the hole
const NEI = 46;            // 内郭: width of the inner rim
const CREASE_X = [318, 1742], CREASE_Y = 306;
// fold lines (slightly off-square to the drawing, as a folded sheet always is): [x0, y0, x1, y1, seed]
const FOLDS = [[318 - 9, -PAD, 318 + 9, H + PAD, 'v0'], [1742 + 6, -PAD, 1742 - 6, H + PAD, 'v1'], [-PAD, CREASE_Y + 8, W + PAD, CREASE_Y - 8, 'h']];
let S = null;

const WHITE = (a) => `rgba(255,255,255,${L.clamp(a).toFixed(3)})`;
const hash = (x, y) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// ───────────────────────── paper tooth ─────────────────────────
/** 512² tile, values uniformly distributed in [0,1): per-pixel grit mixed with ~2.7 px clumps */
function makeTooth(seed) {
  const n = 512, N = n * n, r = L.rng(seed), m = 150;
  const low = new Float32Array(m * m);
  for (let i = 0; i < low.length; i++) low[i] = r();
  const v = new Float32Array(N);
  for (let y = 0; y < n; y++) {
    const fy = (y * m) / n, y0 = Math.floor(fy), ty = fy - y0, y1 = (y0 + 1) % m;
    for (let x = 0; x < n; x++) {
      const fx = (x * m) / n, x0 = Math.floor(fx), tx = fx - x0, x1 = (x0 + 1) % m;
      const c = (low[y0 * m + x0] * (1 - tx) + low[y0 * m + x1] * tx) * (1 - ty) + (low[y1 * m + x0] * (1 - tx) + low[y1 * m + x1] * tx) * ty;
      v[y * n + x] = 0.4 * r() + 0.6 * c;
    }
  }
  const B = 4096, hist = new Uint32Array(B), cum = new Float32Array(B);
  for (let i = 0; i < N; i++) hist[Math.min(B - 1, (v[i] * B) | 0)]++;
  let acc = 0;
  for (let b = 0; b < B; b++) { acc += hist[b]; cum[b] = acc / N; }
  for (let i = 0; i < N; i++) v[i] = cum[Math.min(B - 1, (v[i] * B) | 0)];
  return v;
}
/** tooth → tileable speck canvas. fn(t) → alpha 0..1 */
function toothCanvas(tooth, rgb, fn) {
  const n = 512, c = L.makeCanvas(n, n), g = c.getContext('2d');
  const img = g.createImageData(n, n), d = img.data;
  for (let i = 0; i < n * n; i++) { d[i * 4] = rgb[0]; d[i * 4 + 1] = rgb[1]; d[i * 4 + 2] = rgb[2]; d[i * 4 + 3] = 255 * L.clamp(fn(tooth[i])); }
  g.putImageData(img, 0, 0);
  return c;
}

// ───────────────────────── mask drawing (white = chalk pressure) ─────────────────────────
/** a chalk stroke along a polyline: pressure drifts along its length; a narrower second pass rides off-centre */
function curve(g, pts, width, seed, o = {}) {
  const a = o.a === undefined ? 1 : o.a, lo = o.lo === undefined ? 0.66 : o.lo;
  const p0 = o.g0 || pts[0], p1 = o.g1 || pts[pts.length - 1];
  const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); if (len < 0.5) return;
  const r = L.rng('s07k' + seed), n = Math.max(2, Math.round(len / 64));
  const gr = g.createLinearGradient(p0[0], p0[1], p1[0], p1[1]);
  for (let i = 0; i <= n; i++) gr.addColorStop(i / n, WHITE(a * (lo + (1 - lo) * r())));
  g.save(); g.lineCap = 'butt'; g.lineJoin = 'round'; g.strokeStyle = gr; g.lineWidth = width;
  g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
  if (!o.single) {
    const off = r.range(-0.2, 0.2) * width, e = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) || 1;
    const nx = -(pts[1][1] - pts[0][1]) / e, ny = (pts[1][0] - pts[0][0]) / e;
    g.translate(nx * off, ny * off); g.globalAlpha = 0.55; g.lineWidth = width * 0.56;
    g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
  }
  g.restore();
}
const rule = (g, x0, y0, x1, y1, width, seed, o) => curve(g, [[x0, y0], [x1, y1]], width, seed, o);
/** a heavy freehand-weight stroke whose width breathes along its length (the stick wears and turns in the hand) */
function ribbon(g, pts, width, seed, o = {}) {
  const lo = o.lo === undefined ? 0.85 : o.lo, vary = o.vary === undefined ? 0.16 : o.vary;
  const nz = L.makeNoise('s07rb' + seed), r = L.rng('s07rb' + seed), n = pts.length;
  const p0 = pts[0], p1 = pts[n - 1], len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), m = Math.max(2, Math.round(len / 64));
  const gr = g.createLinearGradient(p0[0], p0[1], p1[0], p1[1]);
  for (let i = 0; i <= m; i++) gr.addColorStop(i / m, WHITE(lo + (1 - lo) * r()));
  const A = [], B = [];
  let d = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const e = Math.hypot(nx, ny) || 1; nx /= e; ny /= e;
    if (i) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const hw = (width / 2) * (1 + vary * nz.n2(d / 210, 1.3) + vary * 0.5 * nz.n2(d / 55, 7.7));
    const sk = 0.12 * width * nz.n2(d / 320, 4.1);   // the two edges do not breathe together
    A.push([pts[i][0] + nx * (hw + sk), pts[i][1] + ny * (hw + sk)]); B.push([pts[i][0] - nx * (hw - sk), pts[i][1] - ny * (hw - sk)]);
  }
  g.save(); g.fillStyle = gr; g.beginPath();
  A.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  for (let i = n - 1; i >= 0; i--) g.lineTo(B[i][0], B[i][1]);
  g.closePath(); g.fill(); g.restore();
}
/** dashed / dash-dot ruled line. pat = [on, off, on, off…] */
function dash(g, x0, y0, x1, y1, pat, width, seed, o = {}) {
  const len = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / len, uy = (y1 - y0) / len;
  let d = o.phase || 0, i = 0;
  while (d < len) {
    const seg = pat[i % pat.length];
    if (i % 2 === 0) {
      const s0 = Math.max(0, d), e = Math.min(len, d + seg);
      if (e - s0 > 2) rule(g, x0 + ux * s0, y0 + uy * s0, x0 + ux * e, y0 + uy * e, width, seed + '_' + i, o);
    }
    d += seg; i++;
  }
}
/** solid slender arrowhead: tip at (x,y), pointing along `ang` */
function arrow(g, x, y, ang, size, a = 1) {
  g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = WHITE(a);
  g.beginPath(); g.moveTo(1, 0); g.lineTo(-size, -size * 0.33); g.lineTo(-size * 0.8, 0); g.lineTo(-size, size * 0.33); g.closePath(); g.fill();
  g.restore();
}
function ring(g, x, y, rad, width, seed) {
  const pts = [];
  for (let i = 0; i <= 40; i++) { const t = (i / 40) * L.TAU; pts.push([x + rad * Math.cos(t), y + rad * Math.sin(t)]); }
  curve(g, pts, width, seed, { single: true, g0: [x - rad, y - rad], g1: [x + rad, y + rad], lo: 0.75 });
}
/** registration mark: cross-hair through a small circle */
function regMark(g, x, y, rad, seed) {
  rule(g, x - rad * 2.1, y, x + rad * 2.1, y, 5.5, seed + 'h'); rule(g, x, y - rad * 2.1, x, y + rad * 2.1, 5.5, seed + 'v');
  ring(g, x, y, rad, 5.5, seed + 'o');
}

function buildMask(env) {
  const a = env.arc, s = a.span(PAD + 170), cx = a.cx, oy = a.crestY - 560;
  const P = (th, dr) => { const q = a.pt(th, dr); return [q.x, q.y]; };
  const yo = a.crestY + HOLE_TOP - NEI, yi = a.crestY + HOLE_TOP, xo = HOLE_HALF + NEI, xi = HOLE_HALF;
  const BOT = H + PAD + 30, TOP = -PAD - 30;
  return L.makeLayer(PAD, (g) => {
    // ── rubbed tone + hatching on the two raised rims ──
    g.save(); a.clipBand(g, 0, -RIM, -s, s);
    g.fillStyle = WHITE(0.13); g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    const hs = 37 / a.R; let hi = 0;
    for (let th = -s; th < s; th += hs) a.at(g, th, 0, () => rule(g, -22, -6, 22, RIM + 6, 8, 'ha' + hi++, { a: 0.42, lo: 0.3, single: true }));
    g.restore();
    g.save(); g.beginPath(); g.rect(cx - xo, yo, xo * 2, BOT - yo); g.rect(cx - xi, yi, xi * 2, BOT - yi); g.clip('evenodd');
    g.fillStyle = WHITE(0.13); g.fillRect(cx - xo, yo, xo * 2, BOT - yo);
    for (let x = cx - xo - (BOT - yo) - 20, i = 0; x < cx + xo + 20; x += 37, i++) rule(g, x, BOT, x + (BOT - yo), yo, 8, 'hb' + i, { a: 0.42, lo: 0.3, single: true });
    g.restore();

    // ── radial construction lines from the centre of the circle ──
    const RAD = [
      { k: -6, top: 0, w: 11.5 }, { k: -5, top: 0, w: 10.5 }, { k: -4, top: 46, w: 14.5 }, { k: -3, top: 28, w: 9.5, dd: 1 },
      { k: -2, top: 84, w: 16 }, { k: -1, top: -RIM, w: 10 }, { k: 1, top: 52, w: 13 }, { k: 2, top: -RIM, w: 9.5, dd: 1 },
      { k: 3, top: 68, w: 16 }, { k: 4, top: -RIM, w: 10 }, { k: 5, top: 0, w: 10, dd: 1 }, { k: 6, top: 0, w: 11.5 },
    ];
    for (const q of RAD) {
      const th = q.k * STEP, yEnd = Math.abs(q.k) <= 2 ? yo : BOT;
      const p0 = P(th, q.top), rEnd = (a.cy - yEnd) / Math.cos(th), p1 = P(th, rEnd - a.R);
      if (q.dd) dash(g, p0[0], p0[1], p1[0], p1[1], [104, 15, 12, 15], q.w, 'rd' + q.k, { phase: -((q.k * 37 + 200) % 70) });
      else rule(g, p0[0], p0[1], p1[0], p1[1], q.w, 'rd' + q.k, { lo: 0.74 });
    }
    // lines that were struck twice / abandoned
    { const t1 = STEP + 0.011, q0 = P(t1, -RIM - 26), q1 = P(t1, -RIM - 236); rule(g, q0[0], q0[1], q1[0], q1[1], 5.5, 'gh1', { a: 0.62, lo: 0.3, single: true });
      const t2 = -2 * STEP - 0.012, r0 = P(t2, 40), r1 = P(t2, -210); rule(g, r0[0], r0[1], r1[0], r1[1], 5.5, 'gh2', { a: 0.6, lo: 0.3, single: true }); }
    // short half-step divisions hanging inside the rim
    for (let k = -6; k <= 5; k++) {
      if (k === 2) continue; // the rim-width dimension sits here
      const th = (k + 0.5) * STEP, q0 = P(th, -RIM - 2), q1 = P(th, -RIM - 34);
      rule(g, q0[0], q0[1], q1[0], q1[1], 7.5, 'hf' + k, { lo: 0.6 });
    }
    // 中轴线: long-dash / dot, right through the sheet
    dash(g, cx, TOP, cx, BOT, [150, 18, 14, 18], 8, 'axis', { phase: -64, lo: 0.74 });
    // angle between two radii (bottom left)
    { const t0 = -4 * STEP, t1 = -3 * STEP, dr = -238;
      curve(g, L.arcPts(a, dr, t0 + 0.004, t1 - 0.004, 30), 5.5, 'ang', { lo: 0.7 });
      const q0 = P(t0, dr), q1 = P(t1, dr); arrow(g, q0[0] + 3, q0[1], t0 + Math.PI, 32); arrow(g, q1[0] - 3, q1[1], t1, 32); }

    // ── 外郭: the coin's edge (on the shared arc) and the inner line of the rim ──
    curve(g, L.arcPts(a, -RIM, -s, s, 220), 9, 'rimIn', { lo: 0.7 });
    ribbon(g, L.arcPts(a, 0, -s, s, 320), 22, 'edge', { lo: 0.92 });
    curve(g, L.arcPts(a, 0, -s, s, 220), 13, 'edge2', { lo: 0.8, single: true });
    curve(g, L.arcPts(a, 6.5, -s, -0.06, 100), 5, 'edge3', { a: 0.6, lo: 0.2, single: true });   // the compass went round twice
    curve(g, L.arcPts(a, -7, 0.13, s, 100), 5, 'edge4', { a: 0.6, lo: 0.2, single: true });

    // ── 内郭 + 穿: the square hole, its sides parallel to the axis ──
    rule(g, cx - xo - 20, yo, cx + xo + 20, yo, 10, 'no', { lo: 0.75 });
    rule(g, cx - xi - 14, yi, cx + xi + 14, yi, 14, 'ni', { lo: 0.86 });
    for (const sg of [-1, 1]) {
      rule(g, cx + sg * xo, yo - 20, cx + sg * xo, BOT, 10, 'so' + sg, { lo: 0.75 });
      rule(g, cx + sg * xi, yi - 14, cx + sg * xi, BOT, 14, 'si' + sg, { lo: 0.86 });
      rule(g, cx + sg * (xo + 5), yo - 5, cx + sg * (xi - 5), yi + 5, 5.5, 'mi' + sg, { lo: 0.7 });   // mitre of the corner
    }
    // the hole's top edge is square to the axis
    rule(g, cx, yo - 36, cx + 36, yo - 36, 5, 'sq1', { single: true }); rule(g, cx + 36, yo - 38, cx + 36, yo, 5, 'sq2', { single: true });

    // ── width of the outer rim (labelled 外郭) ──
    { const th = 2.5 * STEP, q0 = P(th, -RIM - 62), q1 = P(th, 132);
      rule(g, q0[0], q0[1], q1[0], q1[1], 6, 'dw', { lo: 0.72 });
      const t0 = P(th, 9), t1 = P(th, -RIM - 5);
      arrow(g, t0[0], t0[1], th + Math.PI / 2, 38); arrow(g, t1[0], t1[1], th - Math.PI / 2, 38);
      rule(g, q1[0] - 3, q1[1], q1[0] + 236, q1[1], 6, 'dws', { lo: 0.72 });
      L.text(g, '外郭', q1[0] + 124, q1[1] - 50, { font: 'brush', size: 80, weight: 400, color: '#fff', spacing: 8, stroke: { color: '#fff', width: 2.2 } }); }
    // ── width of the inner rim (labelled 内郭) ──
    { const x = cx + 303;
      rule(g, x, yo - 58, x, yi + 56, 6, 'dn', { lo: 0.72 });
      arrow(g, x, yo - 5, Math.PI / 2, 34); arrow(g, x, yi + 8, -Math.PI / 2, 34);
      L.text(g, '内郭', x - 4, yo - 104, { font: 'brush', size: 72, weight: 400, color: '#fff', spacing: 6, stroke: { color: '#fff', width: 1.7 } }); }
    L.text(g, '肉', cx - 302, yo - 104, { font: 'brush', size: 86, weight: 400, color: '#fff', stroke: { color: '#fff', width: 2.2 } });
    L.text(g, '穿', cx - 130, yi + 92, { font: 'brush', size: 90, weight: 400, color: '#fff', stroke: { color: '#fff', width: 2.2 } });

    // ── above the coin: a few oblique dimension lines, graduations, registration marks, a corner of the title block ──
    { const an = L.deg(-38), ux = Math.cos(an), uy = Math.sin(an), nx = -uy, ny = ux, bx = 250, by = 172 + oy;
      const seg = (off, t0, t1, w, seed, o) => rule(g, bx + nx * off + ux * t0, by + ny * off + uy * t0, bx + nx * off + ux * t1, by + ny * off + uy * t1, w, seed, o);
      seg(0, -460, 470, 14.5, 'oa', { lo: 0.82 });
      seg(-62, -300, 470, 9, 'ob', { lo: 0.7 });
      seg(-104, -230, 470, 6.5, 'oc', { lo: 0.65 });
      for (let i = 0, t = -310; t <= 300; t += 61, i++) {
        const major = i % 5 === 0;
        rule(g, bx + ux * t + nx * (-62 - (major ? 18 : 0)), by + uy * t + ny * (-62 - (major ? 18 : 0)), bx + ux * t + nx * (major ? 34 : -22), by + uy * t + ny * (major ? 34 : -22), major ? 8.5 : 6, 'ot' + i, { lo: 0.7 });
      } }
    { const an = L.deg(35), ux = Math.cos(an), uy = Math.sin(an), nx = -uy, ny = ux, bx = 1756, by = 268 + oy;
      rule(g, bx - ux * 310, by - uy * 310, bx + ux * 380, by + uy * 380, 11.5, 'pa', { lo: 0.8 });
      rule(g, bx - ux * 60 + nx * 50, by - uy * 60 + ny * 50, bx + ux * 380 + nx * 50, by + uy * 380 + ny * 50, 6.5, 'pb', { lo: 0.65 });
      for (const [t, l0, l1, w] of [[-196, -44, 44, 8.5], [-52, -40, 86, 8.5], [96, -30, 80, 6.5]]) rule(g, bx + ux * t + nx * l0, by + uy * t + ny * l0, bx + ux * t + nx * l1, by + uy * t + ny * l1, w, 'pt' + t, { lo: 0.7 }); }
    regMark(g, cx - 296, 226 + oy, 19, 'rg0'); regMark(g, cx + 862, 962 + oy, 19, 'rg1');
    { const bx = 1672, by = 124 + oy;   // 图签框: only its lower-left corner is in shot, left blank
      rule(g, bx, TOP, bx, by + 12, 11, 'tb0', { lo: 0.8 }); rule(g, bx - 12, by, W + PAD + 30, by, 11, 'tb1', { lo: 0.8 });
      rule(g, bx, by - 62, W + PAD + 30, by - 62, 6.5, 'tb2'); rule(g, bx + 136, by - 62, bx + 136, by, 6.5, 'tb3'); }
  });
}

/** lines the draughtsman rubbed out again: a faint ghost of dust plus the smear of the cloth */
function buildGhost(env) {
  const a = env.arc, P = (th, dr) => { const q = a.pt(th, dr); return [q.x, q.y]; };
  const an = L.deg(-38), ux = Math.cos(an), uy = Math.sin(an), bx = 344, by = 292 + (a.crestY - 560);
  const G = [
    [[bx - ux * 470, by - uy * 470], [bx + ux * 540, by + uy * 540]],   // a first, longer setting-out line parallel to the graduated one
    [P(3.5 * STEP, -RIM - 14), P(3.5 * STEP, -760)],                      // a radius struck on the wrong division
  ];
  const fine = L.makeLayer(PAD, (g) => {
    G.forEach((l, i) => L.chalkStroke(g, l, { width: 11, color: CHALK, seed: 's07gh' + i, density: 0.32, alpha: 0.7, jitter: 3.2, step: 2 }));
  });
  const smear = L.makeLayer(PAD, (g) => {
    g.strokeStyle = L.rgba(CHALK, 0.5); g.lineCap = 'round'; g.lineWidth = 50;
    for (const l of G) { g.beginPath(); g.moveTo(l[0][0], l[0][1]); g.lineTo(l[1][0], l[1][1]); g.stroke(); }
  });
  const out = L.blurred(fine, 0.5), og = out.getContext('2d');
  og.globalAlpha = 0.2; og.drawImage(L.blurred(smear, 16), 0, 0);
  return out;
}

/** pressure mask → chalk: dense core, skipping edges, dust */
function chalkify(mask, tooth) {
  const w = mask.width, h = mask.height;
  const rd = (c) => c.getContext('2d').getImageData(0, 0, w, h).data;
  const md = rd(L.blurred(mask, 1.25)), hd = rd(L.blurred(mask, 6));
  const pd = rd(L.noiseTex(w, h, { seed: 's07press', scale: 170, octaves: 3, res: 0.125, contrast: 1.8 }));
  const out = L.makeCanvas(w, h), og = out.getContext('2d');
  const img = og.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) {
    const ty = (y & 511) << 9;
    for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4, hv = hd[k + 3];
      if (hv === 0) continue;
      const t = tooth[ty | (x & 511)];
      let al = 0;
      const m = md[k + 3];
      if (m > 4) {
        const v = (m / 255) * (0.8 + 0.32 * (pd[k] / 255));
        al = (v * 1.06 - 0.1 - t) / 0.085 + 0.5;
        al = al < 0 ? 0 : al > 1 ? 1 : al;
      }
      if (al < 0.5 && hash(x, y) < (hv / 255) * 0.13) al = Math.max(al, 0.35 + 0.5 * hash(y + 7, x - 3));
      if (al <= 0) continue;
      d[k] = 243; d[k + 1] = 246; d[k + 2] = 248; d[k + 3] = 255 * al * (0.86 + 0.14 * hash(x + 91, y + 13));
    }
  }
  og.putImageData(img, 0, 0);
  out._pad = mask._pad;
  return out;
}

// ───────────────────────── paper ─────────────────────────
function buildPaper(tooth) {
  const w = W + PAD * 2, h = H + PAD * 2;
  return L.makeLayer(PAD, (g) => {
    g.fillStyle = BLUE; g.fillRect(-PAD, -PAD, w, h);
    // uneven exposure of the cyanotype: slow pools of deeper pigment, a few paler fields
    g.drawImage(L.noiseTex(w, h, { seed: 's07cA', scale: 880, octaves: 3, res: 0.125, warp: 0.5, contrast: 1.6,
      ramp: [[0, L.rgba(DEEP, 0.8)], [0.42, L.rgba(DEEP, 0.12)], [0.6, L.rgba(WORN, 0)], [1, L.rgba(WORN, 0.3)]] }), -PAD, -PAD);
    // brush streaks of the hand-coated sensitiser
    g.globalAlpha = 0.2;
    g.drawImage(L.noiseTex(w, h, { seed: 's07cB', scale: 26, sx: 50, sy: 1, octaves: 3, res: 0.33, contrast: 1.7,
      ramp: [[0, L.rgba('#0d2c57', 0.6)], [0.45, 'rgba(13,44,87,0)'], [0.62, 'rgba(90,146,208,0)'], [1, L.rgba('#5a92d0', 0.45)]] }), -PAD, -PAD);
    g.globalAlpha = 1;
    // paper fibres
    const r = L.rng('s07fib');
    g.lineCap = 'round';
    for (let i = 0; i < 2600; i++) {
      const x = r.range(-PAD, W + PAD), y = r.range(-PAD, H + PAD), len = r.range(8, 52), an = r() * Math.PI;
      g.strokeStyle = r.chance(0.55) ? L.rgba('#74b0f2', r.range(0.08, 0.34)) : L.rgba('#0b2648', r.range(0.08, 0.32));
      g.lineWidth = r.range(0.5, 1.5);
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(an) * len * 0.5 + r.range(-5, 5), y + Math.sin(an) * len * 0.5 + r.range(-5, 5), x + Math.cos(an) * len, y + Math.sin(an) * len);
      g.stroke();
    }
    // tooth: light specks on the high points of the paper, pigment pooled in the low ones
    g.fillStyle = g.createPattern(toothCanvas(tooth, [70, 142, 232], (t) => Math.pow(L.clamp((t - 0.58) / 0.42), 1.6) * 0.46), 'repeat'); g.fillRect(-PAD, -PAD, w, h);
    g.fillStyle = g.createPattern(toothCanvas(tooth, [9, 34, 70], (t) => Math.pow(L.clamp((0.36 - t) / 0.36), 1.6) * 0.5), 'repeat'); g.fillRect(-PAD, -PAD, w, h);
    g.globalCompositeOperation = 'overlay';
    g.drawImage(L.grainTex(w, h, { seed: 's07g1', amount: 0.16, size: 1 }), -PAD, -PAD);
    g.globalCompositeOperation = 'source-over';
  });
}

// ───────────────────────── wear: fold creases and scuffs ─────────────────────────
function creasePts(x0, y0, x1, y1, seed) {
  const len = Math.hypot(x1 - x0, y1 - y0), nz = L.makeNoise('s07cr' + seed), pts = [];
  const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
  for (let d = 0; d <= len; d += 26) { const o = 1.8 * nz.n2(d * 0.012, 1.7); pts.push([x0 + ((x1 - x0) * d) / len + nx * o, y0 + ((y1 - y0) * d) / len + ny * o]); }
  return pts;
}
function crease(g, x0, y0, x1, y1, seed) {
  const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
  g.save(); g.translate(x0, y0); g.rotate(ang);
  // the sheet no longer lies flat: a broad roll of light one side of the fold, shade the other…
  g.fillStyle = L.linear(g, 0, -190, 0, 190, [[0, 'rgba(150,196,246,0)'], [0.5, 'rgba(150,196,246,0.05)'], [0.5, 'rgba(4,16,40,0.075)'], [1, 'rgba(4,16,40,0)']]);
  g.fillRect(0, -190, len, 380);
  // …and the ridge itself
  g.fillStyle = L.linear(g, 0, -9, 0, 9, [[0, 'rgba(190,220,250,0)'], [0.4, 'rgba(190,220,250,0.2)'], [0.5, 'rgba(3,12,30,0.3)'], [0.66, 'rgba(3,12,30,0.08)'], [1, 'rgba(3,12,30,0)']]);
  g.fillRect(0, -9, len, 18);
  g.restore();
  // pigment cracked and rubbed off along the fold
  const pts = creasePts(x0, y0, x1, y1, seed);
  L.chalkStroke(g, pts, { width: 7, color: WORN, seed: 's07cra' + seed, density: 0.4, alpha: 0.8, jitter: 2 });
  L.chalkStroke(g, pts, { width: 3.5, color: '#86b4e4', seed: 's07crb' + seed, density: 0.24, alpha: 0.7, jitter: 1.6 });
  L.chalkStroke(g, pts, { width: 2, color: '#d6e6f6', seed: 's07crc' + seed, density: 0.12, alpha: 0.7, jitter: 0.9 });
}
function buildWear(tooth) {
  const w = W + PAD * 2, h = H + PAD * 2;
  // abraded, paler fields broken into pin-point specks — strongest where the folds cross
  const scuff = L.noiseTex(w, h, { seed: 's07scuff', scale: 240, octaves: 5, gain: 0.6, res: 0.2, contrast: 2.0,
    ramp: [[0, 'rgba(96,150,210,0)'], [0.46, 'rgba(96,150,210,0)'], [0.8, 'rgba(110,164,222,0.7)'], [1, 'rgba(160,200,238,0.9)']] });
  const sg = scuff.getContext('2d');
  sg.globalCompositeOperation = 'destination-in';
  sg.fillStyle = sg.createPattern(toothCanvas(tooth, [255, 255, 255], (t) => Math.pow(t, 1.3)), 'repeat'); sg.fillRect(0, 0, w, h);
  const mask = L.makeLayer(PAD, (g) => {
    for (const x of CREASE_X) {
      g.fillStyle = L.radial(g, x, CREASE_Y, 0, 260, [[0, 'rgba(0,0,0,1)'], [0.4, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(x - 260, CREASE_Y - 260, 520, 520);
      g.fillStyle = L.linear(g, x - 54, 0, x + 54, 0, [[0, 'rgba(0,0,0,0)'], [0.5, 'rgba(0,0,0,0.6)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(x - 54, -PAD, 108, h);
    }
    g.fillStyle = L.linear(g, 0, CREASE_Y - 54, 0, CREASE_Y + 54, [[0, 'rgba(0,0,0,0)'], [0.5, 'rgba(0,0,0,0.6)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(-PAD, CREASE_Y - 54, w, 108);
    const r = L.rng('s07scf');
    for (let i = 0; i < 7; i++) { const x = r.range(-PAD, W + PAD), y = r.range(-PAD, H + PAD), rad = r.range(150, 340); g.fillStyle = L.radial(g, x, y, 0, rad, [[0, 'rgba(0,0,0,0.44)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  });
  sg.drawImage(mask, 0, 0);
  return L.makeLayer(PAD, (g) => {
    g.drawImage(scuff, -PAD, -PAD);
    for (const f of FOLDS) crease(g, ...f);
    for (const x of CREASE_X) L.speckle(g, { seed: 's07fl' + x, count: 150, x: x - 64, y: CREASE_Y - 64, w: 128, h: 128, rMin: 0.6, rMax: 2.3, colors: ['#c4daf0', '#8fb8e4'], alpha: [0.3, 0.8] });
  });
}

export default {
  name: '方孔圆钱规制图',
  tone: 'light',
  init(env) {
    const tooth = makeTooth('s07tooth');
    const paper = buildPaper(tooth);
    const chalk = chalkify(buildMask(env), tooth);
    // the folds have taken some of the chalk with them
    { const cg = chalk.getContext('2d'); cg.save(); cg.translate(PAD, PAD); cg.globalCompositeOperation = 'destination-out';
      for (const f of FOLDS) L.chalkStroke(cg, creasePts(...f), { width: 8, color: '#000', seed: 's07er' + f[4], density: 0.5, alpha: 1, jitter: 2 });
      cg.restore(); }
    // flatten into one sheet: paper → dust halo → chalk → wear
    const g = paper.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 0.8; g.drawImage(buildGhost(env), 0, 0);
    g.save(); g.translate(PAD, PAD); g.globalAlpha = 1;                   // loose chalk dust lying on the sheet
    L.speckle(g, { seed: 's07dust', count: 380, x: -PAD, y: -PAD, w: W + PAD * 2, h: H + PAD * 2, rMin: 0.6, rMax: 2.4, colors: [CHALK, '#cfe0f2'], alpha: [0.25, 0.85] });
    g.restore();
    g.globalAlpha = 0.3; g.drawImage(L.blurred(chalk, 5), 0, 0);
    g.globalAlpha = 0.09; g.drawImage(L.blurred(chalk, 20), 12, 5);     // a smear from the draughtsman's sleeve
    g.globalAlpha = 1; g.drawImage(chalk, 0, 0);
    g.drawImage(buildWear(tooth), 0, 0);
    S = { sheet: L.filtered(paper, 'saturate(1.2) contrast(1.04)') };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    ctx.fillStyle = BLUE; ctx.fillRect(0, 0, W, H);
    // the camera pushes in across the drawing and slides a touch along the rim; zoom passes through 1.0 mid-shot so the edge stays on the shared arc
    const zoom = L.lerp(0.9756, 1.0244, p), rot = L.lerp(-0.004, 0.004, p);
    L.blit(ctx, env, S.sheet, { rot, zoom });
    // fixed raking light — the sheet slides underneath it
    ctx.save(); ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = L.radial(ctx, 620, 260, 0, 1500, [[0, 'rgba(255,255,255,0.22)'], [0.5, 'rgba(255,255,255,0.03)'], [1, 'rgba(0,0,0,0.3)']]);
    ctx.fillRect(0, 0, W, H); ctx.restore();
    const gl = a.pt(L.lerp(-0.2, 0.14, p), 20);
    L.glow(ctx, gl.x, gl.y, 560, '#9cc8fa', 0.1);
    L.vignette(ctx, { strength: 0.22, color: '#04122a' });
  },
};
