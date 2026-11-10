// s15 — 铜钟. The shoulder of a colossal bronze bell rising out of the dark: the arc is the bell's silhouette.
// Below it the bronze rolls toward us (rows foreshorten at the limb), cast all over with columns of tiny
// inscription — rendered as unreadable square stroke-texture, never real characters — and two raised 弦纹 bands.
// Verdigris sits in the recesses; a cold violet→cyan rim light runs along the silhouette. Above: pure black.
//
// Everything lives below the arc, so the pre-rendered layers only cover the frame from just above the crest
// downward (plus PAD at the sides and bottom for the rotation). The bronze turns about the arc's centre under
// lights that stay fixed to the frame.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 240;
const LW = W + PAD * 2;
let TOP = 0, LH = 0;      // first frame row covered by the "low" layers, and their height (set in init)
let S = null;

/** a layer covering x ∈ [-PAD, W+PAD], y ∈ [TOP, H+PAD]; draw with frame coordinates */
function low(draw) {
  const c = L.makeCanvas(LW, LH); const g = c.getContext('2d');
  g.translate(PAD, -TOP);
  if (draw) draw(g, c);
  return c;
}
/** noise that follows the arc (sx stretches along it, sy radially), sized like a low layer */
function lowNoise(env, opts) {
  const a = env.arc;
  return L.noiseTex(LW, LH, { ...opts, polar: { cx: a.cx + PAD, cy: a.cy - TOP, R: a.R } });
}

// ── the bell's curvature ──
// Screen depth below the arc (d, px) ↔ distance measured on the bronze itself (s, px). The shoulder is a
// quarter-roll of radius ROLL: at the silhouette the surface is edge-on (rows squash to nothing), by d = ROLL it faces us.
const ROLL = 650;
const S_FLAT = (ROLL * Math.PI) / 2;
const sOf = (d) => (d <= 0 ? 0 : d < ROLL ? ROLL * Math.acos(1 - d / ROLL) : S_FLAT + (d - ROLL));
const dOf = (s) => (s <= 0 ? 0 : s < S_FLAT ? ROLL * (1 - Math.cos(s / ROLL)) : ROLL + (s - S_FLAT));

// layout on the bronze (surface px from the silhouette inward)
const CW = 28, CH = 25;                         // one inscription cell
const BAND_A = [372, 424], BAND_B = [706, 756]; // the two raised string-course bands (弦纹)
const ZONES = [[64, BAND_A[0] - 9], [BAND_A[1] + 9, BAND_B[0] - 9], [BAND_B[1] + 9, 1420]];
const RIDGES = [];                              // each band = thin / thick / thin half-round ridges: [centre s, width s]
for (const [s0, s1] of [BAND_A, BAND_B]) { const w = s1 - s0; RIDGES.push([s0 + w * 0.09, w * 0.13], [s0 + w * 0.5, w * 0.44], [s0 + w * 0.91, w * 0.13]); }

const sstep = (e0, e1, v) => { const t = v <= e0 ? 0 : v >= e1 ? 1 : (v - e0) / (e1 - e0); return t * t * (3 - 2 * t); };
const hash2 = (x, y) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// ───────────────────────── pseudo-inscription glyphs ─────────────────────────
// Random strokes on a loose grid: reads as dense cast regular-script at a glance, but spells nothing.
function buildGlyphSet(count) {
  const r = L.rng('s15glyph');
  const poly = (p, pts) => {
    let area = 0;
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
    if (area < 0) pts = pts.slice().reverse();
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
    p.closePath();
  };
  const TH = 0.088, TV = 0.108;
  const heng = (p, x0, x1, y) => { const tilt = (x1 - x0) * 0.07; poly(p, [[x0, y + TH / 2], [x0, y - TH / 2], [x1, y - TH / 2 - tilt], [x1 + TH * 0.35, y + TH * 0.6 - tilt]]); };
  const shu = (p, x, y0, y1) => poly(p, [[x - TV / 2, y0], [x + TV / 2, y0], [x + TV / 2, y1], [x - TV * 0.3, y1 + TV * 0.3]]);
  const slash = (p, x0, y0, x1, y1, t) => {
    const dx = x1 - x0, dy = y1 - y0, m = Math.hypot(dx, dy) || 1, nx = (-dy / m) * t / 2, ny = (dx / m) * t / 2;
    poly(p, [[x0 + nx, y0 + ny], [x0 - nx, y0 - ny], [x1 - nx * 0.35, y1 - ny * 0.35], [x1 + nx * 0.35, y1 + ny * 0.35]]);
  };
  const part = (p, bx, by, bw, bh, nH, nV, legs) => {
    for (let i = 0; i < nH; i++) {
      const y = by + bh * (0.08 + 0.84 * ((i + 0.5 + r.range(-0.2, 0.2)) / nH));
      const x0 = bx + bw * r.pick([0, 0, 0.06, 0.28, 0.4]), x1 = bx + bw * r.pick([1, 1, 0.92, 0.7, 0.86]);
      heng(p, x0, x1, y);
    }
    const cols = [0.06, 0.5, 0.94, 0.3, 0.72];
    const used = new Set();
    for (let i = 0; i < nV; i++) {
      let k = r.int(0, cols.length - 1); while (used.has(k)) k = (k + 1) % cols.length; used.add(k);
      const y0 = by + bh * r.pick([0, 0, 0.14, 0.34, 0.46]), y1 = by + bh * r.pick([1, 1, 0.9, 0.64, 0.8]);
      shu(p, bx + bw * (cols[k] + r.range(-0.04, 0.04)), y0, y1);
    }
    if (legs) {
      const cx = bx + bw * r.range(0.4, 0.6), y0 = by + bh * r.range(0.4, 0.6);
      if (r.chance(0.8)) slash(p, cx, y0, bx + bw * 0.02, by + bh, TV * 1.15);
      if (r.chance(0.8)) slash(p, cx + bw * 0.05, y0, bx + bw * 0.98, by + bh, TV * 1.25);
    }
    const ticks = r.int(0, 2);
    for (let i = 0; i < ticks; i++) { const x = bx + bw * r.range(0.15, 0.85), y = by + bh * r.range(0.05, 0.9), s = r.sign(); slash(p, x - 0.04 * s, y - 0.05, x + 0.05 * s, y + 0.07, TV * 1.3); }
  };
  const set = [];
  for (let i = 0; i < count; i++) {
    const p = new Path2D();
    const kind = r();
    if (kind < 0.42) { // left | right
      const split = r.range(0.34, 0.5);
      part(p, 0.04, 0.05, split - 0.08, 0.9, r.int(2, 3), r.int(1, 2), r.chance(0.25));
      part(p, split + 0.04, 0.04, 0.92 - split, 0.92, r.int(3, 4), r.int(1, 2), r.chance(0.35));
    } else if (kind < 0.78) { // top / bottom
      const split = r.range(0.36, 0.52);
      part(p, 0.08, 0.03, 0.84, split - 0.07, 2, r.int(2, 3), false);
      part(p, 0.05, split + 0.03, 0.9, 0.95 - split, r.int(2, 3), r.int(1, 2), r.chance(0.55));
    } else { // one dense block
      part(p, 0.05, 0.04, 0.9, 0.92, r.int(4, 5), r.int(2, 3), r.chance(0.5));
    }
    set.push(p);
  }
  return set;
}

/** white-on-transparent mask of every inscription stroke, laid out in radial columns and foreshortened rows */
function buildGlyphMask(env) {
  const a = env.arc;
  const glyphs = buildGlyphSet(96);
  const r = L.rng('s15rows');
  const nCols = Math.ceil((a.span(PAD + 120) * a.R) / CW);
  return low((g) => {
    g.fillStyle = '#fff';
    for (const [z0, z1] of ZONES) {
      const nRows = Math.floor((z1 - z0) / CH), pitch = (z1 - z0) / nRows;
      for (let k = 0; k < nRows; k++) {
        const sTop = z0 + k * pitch + pitch * 0.05, sBot = sTop + pitch * 0.9;
        const dTop = dOf(sTop), hpx = dOf(sBot) - dTop;
        if (hpx < 1.1) continue;
        if (a.crestY + dTop > H + PAD + 20) break;
        const wScale = (a.R - dTop - hpx / 2) / a.R;
        for (let j = -nCols; j <= nCols; j++) {
          const th = ((j + 0.5) * CW) / a.R;
          const p = a.pt(th, -dTop);
          const gi = r.int(0, glyphs.length - 1), jx = r.range(-0.03, 0.03), sc = r.range(0.95, 1.04), skip = r.chance(0.03);
          if (skip || p.x < -PAD - 40 || p.x > W + PAD + 40 || p.y > H + PAD + 30) continue;
          g.save();
          g.translate(p.x, p.y); g.rotate(th);
          g.scale(CW * 0.73 * wScale * sc, hpx);       // wide gutters between columns, tight leading within them
          g.translate(-0.5 + jx, 0);
          g.fill(glyphs[gi]);
          g.restore();
        }
      }
    }
  });
}

function tint(mask, style) {
  const c = L.makeCanvas(mask.width, mask.height); const g = c.getContext('2d');
  g.drawImage(mask, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = style; g.fillRect(0, 0, c.width, c.height);
  return c;
}

// ───────────────────────── bronze + verdigris (per-pixel, in surface coordinates) ─────────────────────────
function buildSurface(env) {
  const a = env.arc, res = 0.4;
  const cw = Math.round(LW * res), ch = Math.round(LH * res);
  const base = new ImageData(cw, ch);
  const b = base.data;
  const pfA = new Float32Array(cw * ch).fill(-9);   // verdigris field, thresholded later at full resolution
  const pcA = new Float32Array(cw * ch);            // its colour variation
  const n1 = L.makeNoise('s15mottle'), n2 = L.makeNoise('s15patina'), n3 = L.makeNoise('s15streak');
  const bandEdges = [BAND_A[0], BAND_A[1], BAND_B[0], BAND_B[1]];
  for (let y = 0; y < ch; y++) {
    const dy = a.cy - (y / res + TOP);
    for (let x = 0; x < cw; x++) {
      const dx = x / res - PAD - a.cx;
      const d = a.R - Math.sqrt(dx * dx + dy * dy);
      if (d < -6) continue;
      const u = Math.atan2(dx, dy) * a.R;
      const s = sOf(d);
      // bronze tone: big cast blotches + long streaks that run round the bell + fine tooth
      const mot = n1.fbm(u / 330, s / 330, 3);
      const str = n3.fbm(u / 1300 + 3.1, s / 30, 3);
      const fine = n1.n2(u / 7, s / 7);
      const t = L.clamp(0.42 + 0.6 * mot + 0.32 * str + 0.12 * fine);
      let R0, G0, B0;
      if (t < 0.5) { const k = t / 0.5; R0 = 26 + (88 - 26) * k; G0 = 16 + (59 - 16) * k; B0 = 9 + (35 - 9) * k; }
      else { const k = (t - 0.5) / 0.5; R0 = 88 + (150 - 88) * k; G0 = 59 + (103 - 59) * k; B0 = 35 + (60 - 35) * k; }
      // cuprite: dull red-brown oxide blooming here and there under the green
      const cup = sstep(0.18, 0.5, n3.fbm(u / 210 - 8, s / 210 + 5, 2) + 0.2 * fine) * 0.5;
      R0 += (116 - R0) * cup; G0 += (50 - G0) * cup; B0 += (28 - B0) * cup;
      // verdigris field: clusters of spots, more where damp sits against the raised bands
      const wx = n2.n2(u / 430 + 9.1, s / 430 - 3.3), wy = n2.n2(u / 430 - 5.2, s / 430 + 7.7);
      const blob = n2.fbm(u / 170 + wx * 0.45, s / 170 + wy * 0.45, 3);
      const region = n2.n2(u / 900 + 1.7, s / 600 - 2.2);
      const hf = n2.fbm(u / 10 + 77, s / 10, 2);
      const spots = n2.fbm(u / 24 - 31, s / 24 + 13, 2);
      let near = 0;
      for (let i = 0; i < 4; i++) { const e = Math.abs(s - bandEdges[i]); if (e < 26) near = Math.max(near, 1 - e / 26); }
      const pf = 0.58 * blob + 0.34 * region + 0.22 * near + 0.22 * hf + 0.36 * spots - 0.2 * str;
      // a thin dull wash of it stains the ground around the heavier growth
      const wash = sstep(0.02, 0.3, pf) * 0.24;
      R0 += (22 - R0) * wash; G0 += (44 - G0) * wash; B0 += (40 - B0) * wash;
      const i = y * cw + x;
      b[i * 4] = R0; b[i * 4 + 1] = G0; b[i * 4 + 2] = B0; b[i * 4 + 3] = 255;
      pfA[i] = pf; pcA[i] = 0.5 + 0.5 * n2.n2(u / 40 + 20, s / 40);
    }
  }
  const small = L.makeCanvas(cw, ch); small.getContext('2d').putImageData(base, 0, 0);
  const baseC = L.makeCanvas(LW, LH);
  {
    const g = baseC.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(small, 0, 0, LW, LH);
  }
  // full-resolution pass: threshold the field through per-pixel grain so the crust has a hard, crumbly edge
  const ground = new ImageData(LW, LH), crust = new ImageData(LW, LH);
  const gd = ground.data, cd = crust.data;
  for (let Y = 0; Y < LH; Y++) {
    const hy = L.clamp((Y + 0.5) * res - 0.5, 0, ch - 1.001), y0 = hy | 0, fy = hy - y0;
    for (let X = 0; X < LW; X++) {
      const hx = L.clamp((X + 0.5) * res - 0.5, 0, cw - 1.001), x0 = hx | 0, fx = hx - x0;
      const i0 = y0 * cw + x0;
      const p00 = pfA[i0], p10 = pfA[i0 + 1], p01 = pfA[i0 + cw], p11 = pfA[i0 + cw + 1];
      if (p00 < -5 || p10 < -5 || p01 < -5 || p11 < -5) continue;
      const pf = (p00 * (1 - fx) + p10 * fx) * (1 - fy) + (p01 * (1 - fx) + p11 * fx) * fy;
      if (pf < 0.14) continue;
      const g1 = hash2(X, Y), g2 = hash2(X >> 1, (Y >> 1) + 7919), g3 = hash2((X + 1) >> 2, (Y >> 2) + 104729);
      const v = pf + 0.2 * (0.4 * g1 + 0.35 * g2 + 0.25 * g3 - 0.5);
      const aG = sstep(0.25, 0.285, v);
      if (aG <= 0) continue;
      const pc = pcA[i0];
      const chalk = sstep(0.4, 0.66, v) * (0.35 + 0.65 * pc);
      const lum = 0.84 + 0.32 * g2;
      const PR = (24 + (56 - 24) * pc + (100 - 56) * chalk) * lum, PG = (68 + (128 - 68) * pc + (164 - 128) * chalk) * lum, PB = (62 + (117 - 62) * pc + (146 - 117) * chalk) * lum;
      const i = (Y * LW + X) * 4;
      gd[i] = PR; gd[i + 1] = PG; gd[i + 2] = PB; gd[i + 3] = 255 * aG * 0.94;
      const aC = sstep(0.39, 0.425, v);
      if (aC > 0) { cd[i] = PR; cd[i + 1] = PG; cd[i + 2] = PB; cd[i + 3] = 255 * aC * 0.95; }
    }
  }
  const full = (img) => { const c = L.makeCanvas(LW, LH); c.getContext('2d').putImageData(img, 0, 0); return c; };
  return { base: baseC, ground: full(ground), crust: full(crust) };
}

// ───────────────────────── raised string-course bands ─────────────────────────
function ridge(g, a, sc, sw) {
  const dT = dOf(sc - sw / 2), dB = dOf(sc + sw / 2), wp = dB - dT, dm = (dT + dB) / 2;
  g.lineCap = 'butt';
  g.strokeStyle = 'rgba(4,2,1,0.6)'; g.lineWidth = wp * 0.8 + 3; a.stroke(g, -(dB + wp * 0.25 + 1.5));   // cast shadow below
  // half-round moulding lit from above: shade across its width
  g.strokeStyle = L.radial(g, a.cx, a.cy, a.R - dB - 0.5, a.R - dT + 0.5, [[0, '#140b05'], [0.2, '#38250f'], [0.5, '#6d4a2b'], [0.72, '#9a7045'], [0.88, '#7d5936'], [1, '#462f1a']]);
  g.lineWidth = wp + 1; a.stroke(g, -dm);
}
/** where hands and ropes have rubbed the ridges bright: a broken line of polish along each crest */
function ridgeSheen(env) {
  const a = env.arc;
  const lay = low((g) => {
    for (const [sc, sw] of RIDGES) {
      const dT = dOf(sc - sw / 2), dB = dOf(sc + sw / 2), wp = dB - dT;
      g.strokeStyle = 'rgba(232,186,128,0.5)'; g.lineWidth = Math.max(1.2, wp * 0.34); a.stroke(g, -(dT + wp * 0.3));
      g.strokeStyle = 'rgba(255,232,190,0.95)'; g.lineWidth = Math.max(0.9, wp * 0.12); a.stroke(g, -(dT + wp * 0.25));
    }
  });
  const g = lay.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(lowNoise(env, { seed: 's15rub', scale: 50, sx: 5, sy: 1, octaves: 3, res: 0.25, contrast: 1.8,
    ramp: [[0, 'rgba(0,0,0,0.05)'], [0.36, 'rgba(0,0,0,0.16)'], [0.62, 'rgba(0,0,0,0.85)'], [1, 'rgba(0,0,0,1)']] }), 0, 0);
  return L.blurred(lay, 0.6);
}
/** verdigris packed into the grooves of the bands, broken up along the arc */
function bandDeposits(env) {
  const a = env.arc;
  const lay = low((g) => {
    for (const [s0, s1] of [BAND_A, BAND_B]) {
      const w = s1 - s0;
      for (const [sc, sw, col] of [[s0 + w * 0.215, w * 0.1, '#4f9a8c'], [s0 + w * 0.785, w * 0.1, '#43897d'], [s1 + 5, 9, '#3f8f84'], [s0 - 5, 8, '#357a70']]) {
        g.strokeStyle = col; g.lineWidth = Math.max(1.4, dOf(sc + sw / 2) - dOf(sc - sw / 2));
        a.stroke(g, -dOf(sc));
      }
    }
  });
  const g = lay.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(lowNoise(env, { seed: 's15groove', scale: 60, sx: 2.2, sy: 1, warp: 0.5, octaves: 3, res: 0.25, contrast: 1.7,
    ramp: [[0, 'rgba(0,0,0,0)'], [0.36, 'rgba(0,0,0,0)'], [0.62, 'rgba(0,0,0,0.75)'], [1, 'rgba(0,0,0,1)']] }), 0, 0);
  return L.blurred(lay, 0.7);
}

function buildBell(env) {
  const a = env.arc;
  const { base, ground, crust } = buildSurface(env);
  const mask = buildGlyphMask(env);
  // corrosion has eaten some of the casting away
  {
    const g = mask.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'destination-out';
    g.drawImage(lowNoise(env, { seed: 's15eat', scale: 90, octaves: 4, warp: 0.7, res: 0.25, contrast: 1.5,
      ramp: [[0, 'rgba(0,0,0,0)'], [0.64, 'rgba(0,0,0,0)'], [0.76, 'rgba(0,0,0,0.85)'], [1, 'rgba(0,0,0,1)']] }), 0, 0);
  }
  const occl = L.blurred(tint(mask, '#060402'), 3);
  const shadow = tint(mask, '#050301');
  const hi = tint(mask, '#efbb86');
  // stroke faces: rubbed bronze, a little uneven from stroke to stroke
  const face = tint(mask, '#8a5d35');
  {
    const g = face.getContext('2d');
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = 0.8;
    g.drawImage(lowNoise(env, { seed: 's15face', scale: 70, octaves: 3, res: 0.25, contrast: 1.6, ramp: [[0, 'rgba(52,31,16,0.8)'], [0.5, 'rgba(110,76,44,0.1)'], [1, 'rgba(196,148,96,0.5)']] }), 0, 0);
  }
  const deposits = bandDeposits(env);
  const sheen = ridgeSheen(env);
  const at = (g, c, ox = 0, oy = 0) => g.drawImage(c, -PAD + ox, TOP + oy);
  const bell = low((g) => {
    at(g, base);
    at(g, ground);                                  // verdigris lying in the ground, between the strokes
    // inscription in relief: soft occlusion, hard shadow down-right, sharp light up-left, then the face
    g.globalAlpha = 0.85; at(g, occl, 1, 1.6);
    g.globalAlpha = 0.9; at(g, shadow, 1.5, 2.1);
    g.globalAlpha = 0.55; at(g, hi, -1, -1.3);
    g.globalAlpha = 1; at(g, face);
    // string-course bands: sunk plain ground, three half-round ridges, rubbed crests, verdigris in the grooves
    for (const [s0, s1] of [BAND_A, BAND_B]) { g.strokeStyle = 'rgba(12,7,3,0.5)'; g.lineWidth = dOf(s1 + 4) - dOf(s0 - 4); a.stroke(g, -(dOf(s0 - 4) + dOf(s1 + 4)) / 2); }
    for (const [sc, sw] of RIDGES) ridge(g, a, sc, sw);
    at(g, sheen);
    g.globalAlpha = 0.9; at(g, deposits);
    // the thickest verdigris buries the strokes too
    g.globalAlpha = 1; at(g, crust);
    // cast-surface blotching, pits and flecks
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.55;
    at(g, lowNoise(env, { seed: 's15blot', scale: 230, octaves: 4, warp: 0.6, res: 0.25, contrast: 1.4, ramp: [[0, '#4a3a2c'], [0.55, '#ffffff'], [1, '#ffffff']] }));
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    const below = (x, y) => a.drAt(x, y) < -2;
    const box = { x: -PAD, y: TOP, w: LW, h: LH, squash: 0.6, test: below };
    L.speckle(g, { ...box, seed: 's15pit', count: 6500, rMin: 0.5, rMax: 2.4, colors: ['#0b0603', '#140b05', '#12302c'], alpha: [0.3, 0.85] });
    L.speckle(g, { ...box, seed: 's15fleck', count: 2600, rMin: 0.4, rMax: 1.5, colors: ['#8fcfbd', '#6fb5a6', '#c99a64', '#4fa092'], alpha: [0.25, 0.8] });
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.55;
    at(g, L.grainTex(LW, LH, { seed: 's15grain', amount: 0.32 }));
    // cut the silhouette: rotation about the arc's centre keeps this edge exactly on the arc
    g.globalCompositeOperation = 'destination-in'; g.globalAlpha = 1; g.fillStyle = '#000';
    a.pathBelow(g, 0); g.fill();
  });
  return L.filtered(bell, 'brightness(1.14) contrast(1.06) saturate(1.04)');
}

// ───────────────────────── light (fixed to the frame; the bronze slides underneath) ─────────────────────────
const grey = (v, tintC) => { const c = tintC || [1, 1, 1]; return `rgb(${Math.round(255 * L.clamp(v * c[0]))},${Math.round(255 * L.clamp(v * c[1]))},${Math.round(255 * L.clamp(v * c[2]))})`; };
/** a frame-wide strip from row TOP down; draw with frame coordinates */
function strip(draw) {
  const c = L.makeCanvas(W, H - TOP); const g = c.getContext('2d');
  g.translate(0, -TOP);
  draw(g);
  return c;
}

/** multiply layer: the limb falls into (cold) shade, one warm pool of light left of centre */
function buildShade(env) {
  const a = env.arc;
  return strip((g) => {
    g.fillStyle = '#fff'; g.fillRect(0, TOP, W, H - TOP);
    a.clipBelow(g, 0);
    const DEEP = 900, COLD = [0.8, 0.88, 1.3];
    const stops = [[0, 0.16, COLD], [8, 0.22, COLD], [30, 0.4, [0.93, 0.96, 1.1]], [80, 0.72], [170, 0.97], [260, 1], [400, 0.9], [520, 0.74], [900, 0.42]];
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - DEEP, a.R, stops.map(([d, v, t]) => [1 - d / DEEP, grey(v, t)]));
    g.fillRect(0, TOP, W, H - TOP);
    g.globalCompositeOperation = 'multiply';
    g.translate(820, a.crestY + 250); g.scale(1, 0.62);
    g.fillStyle = L.radial(g, 0, 0, 120, 1380, [[0, grey(1)], [0.25, grey(0.96)], [0.5, grey(0.7)], [0.75, grey(0.42)], [1, grey(0.24)]]);
    g.fillRect(-3000, -3000, 6000, 6000);
  });
}

/**
 * color-dodge layer: soft reflections of the light sources as concentric bands, streaky along the arc,
 * on opaque black (so the blend reads it as an amount of light).
 */
function buildSpec(env) {
  const a = env.arc;
  return strip((g) => {
    g.fillStyle = '#000'; g.fillRect(0, TOP, W, H - TOP);
    const band = (dC, hw, alpha, col, xC, reach) => {
      const t = strip((tg) => {
        const r0 = a.R - dC - hw, r1 = a.R - dC + hw;
        tg.fillStyle = L.radial(tg, a.cx, a.cy, r0, r1, [[0, L.rgba(col, 0)], [0.2, L.rgba(col, alpha * 0.2)], [0.38, L.rgba(col, alpha * 0.68)], [0.5, L.rgba(col, alpha)], [0.62, L.rgba(col, alpha * 0.68)], [0.8, L.rgba(col, alpha * 0.2)], [1, L.rgba(col, 0)]]);
        tg.fillRect(0, TOP, W, H - TOP);
        tg.globalCompositeOperation = 'destination-in';
        const x0 = xC - reach, x1 = xC + reach;
        tg.fillStyle = L.linear(tg, x0, 0, x1, 0, [[0, 'rgba(0,0,0,0)'], [0.16, 'rgba(0,0,0,0.1)'], [0.32, 'rgba(0,0,0,0.5)'], [0.44, 'rgba(0,0,0,0.92)'], [0.5, 'rgba(0,0,0,1)'], [0.56, 'rgba(0,0,0,0.92)'], [0.68, 'rgba(0,0,0,0.5)'], [0.84, 'rgba(0,0,0,0.1)'], [1, 'rgba(0,0,0,0)']]);
        tg.fillRect(0, TOP, W, H - TOP);
      });
      g.globalCompositeOperation = 'lighter';
      g.drawImage(t, 0, TOP);
    };
    band(232, 96, 0.6, '#fff0de', 780, 1300);      // key: a long soft box
    band(330, 210, 0.26, '#ffeedd', 840, 1500);    // and the broad glow around it
    band(152, 20, 0.3, '#fff0de', 700, 1100);      // its thinner echo higher up the shoulder
    band(112, 11, 0.3, '#c4c6ff', 980, 1500);      // the rim light catching the first raised band
    band(50, 13, 0.46, '#c4c6ff', 900, 1500);      // cold strip just inside the limb
    band(470, 80, 0.24, '#ffe4c8', 1080, 1100);    // low fill
    g.globalCompositeOperation = 'multiply';
    g.drawImage(L.noiseTex(W, H - TOP, { seed: 's15sheen', scale: 20, sx: 46, sy: 1, octaves: 3, res: 0.3, contrast: 1.5,
      polar: { cx: a.cx, cy: a.cy - TOP, R: a.R }, ramp: [[0, '#8a8a8a'], [0.5, '#c8c8c8'], [1, '#ffffff']] }), 0, TOP);
  });
}

/** screen layer: the cold rim light. Only the rows around the arc. */
function buildRim(env) {
  const a = env.arc;
  const IN = 70, OUT = 90, T = IN + OUT;
  const y0 = Math.floor(a.crestY - OUT - 4), y1 = Math.ceil(a.yAt(0) + IN + 4);
  const c = L.makeCanvas(W, y1 - y0); const g = c.getContext('2d');
  g.translate(0, -y0);
  // colour runs violet → cyan along the silhouette
  g.fillStyle = L.linear(g, 0, 0, W, 0, [[0, '#5548d8'], [0.28, '#7a6cff'], [0.5, '#8d84ff'], [0.68, '#6f9df0'], [0.85, '#58c8d8'], [1, '#48b2c4']]);
  g.fillRect(0, y0, W, y1 - y0);
  // radial falloff: light wraps a little way onto the bronze, blooms a little way into the dark
  g.globalCompositeOperation = 'destination-in';
  const al = [[-IN, 0], [-34, 0.07], [-14, 0.28], [-5, 0.6], [-1.5, 0.95], [0.5, 0.9], [3.5, 0.34], [10, 0.1], [26, 0.025], [OUT, 0]];
  g.fillStyle = L.radial(g, a.cx, a.cy, a.R - IN, a.R + OUT, al.map(([dr, v]) => [(dr + IN) / T, `rgba(0,0,0,${v})`]));
  g.fillRect(0, y0, W, y1 - y0);
  // not perfectly even along its length
  g.fillStyle = L.linear(g, 0, 0, W, 0, [[0, 'rgba(0,0,0,0.5)'], [0.18, 'rgba(0,0,0,0.85)'], [0.4, 'rgba(0,0,0,1)'], [0.58, 'rgba(0,0,0,0.78)'], [0.78, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0.6)']]);
  g.fillRect(0, y0, W, y1 - y0);
  // the crisp line itself
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = L.linear(g, 0, 0, W, 0, [[0, 'rgba(140,128,255,0.55)'], [0.45, 'rgba(206,200,255,0.9)'], [0.75, 'rgba(160,214,250,0.85)'], [1, 'rgba(110,214,230,0.55)']]);
  g.lineWidth = 2; a.stroke(g, -1);
  c._y0 = y0;
  return c;
}

export default {
  name: '铜钟',
  tone: 'light',
  init(env) {
    TOP = Math.floor(env.arc.crestY) - 8;
    LH = H + PAD - TOP;
    S = { bell: buildBell(env), shade: buildShade(env), spec: buildSpec(env), rim: buildRim(env) };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.017, 0.017, p);      // the bell turns under fixed lights; a touch faster than usual so it slides
    ctx.fillStyle = '#040404'; ctx.fillRect(0, 0, W, H);
    L.cam(ctx, env, { rot }, () => ctx.drawImage(S.bell, -PAD, TOP));
    ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(S.shade, 0, TOP);
    ctx.globalCompositeOperation = 'color-dodge'; ctx.drawImage(S.spec, 0, TOP);
    ctx.globalCompositeOperation = 'screen'; ctx.drawImage(S.rim, 0, S.rim._y0);
    // a glint running along the silhouette
    a.at(ctx, L.lerp(-0.1, 0.04, p), -1, () => {
      ctx.scale(1, 0.05);
      ctx.fillStyle = L.radial(ctx, 0, 0, 0, 330, [[0, 'rgba(226,222,255,0.8)'], [0.25, 'rgba(160,150,255,0.35)'], [1, 'rgba(120,110,255,0)']]);
      ctx.fillRect(-330, -330, 660, 660);
    });
  },
};
