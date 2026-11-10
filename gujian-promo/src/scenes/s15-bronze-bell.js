// s15 — 铜钟. The shoulder of a colossal bronze bell rising out of the dark: the arc is the bell's silhouette.
// Below it the bronze rolls toward us (rows foreshorten at the limb), cast all over with columns of tiny
// inscription — rendered as unreadable square stroke-texture, never real characters — and two raised 弦纹 bands.
// Verdigris sits in the recesses; a cold violet→cyan rim light runs along the silhouette. Above: pure black.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 240;
let S = null;

// ── the bell's curvature ──
// Screen depth below the arc (d, px) ↔ distance measured on the bronze itself (s, px). The shoulder is a
// quarter-roll of radius ROLL: at the silhouette the surface is edge-on (rows squash to nothing), by d = ROLL it faces us.
const ROLL = 650;
const S_FLAT = (ROLL * Math.PI) / 2;
const sOf = (d) => (d <= 0 ? 0 : d < ROLL ? ROLL * Math.acos(1 - d / ROLL) : S_FLAT + (d - ROLL));
const dOf = (s) => (s <= 0 ? 0 : s < S_FLAT ? ROLL * (1 - Math.cos(s / ROLL)) : ROLL + (s - S_FLAT));

// layout on the bronze (surface px from the silhouette inward)
const CW = 28, CH = 25;                       // one inscription cell
const BAND_A = [372, 424], BAND_B = [706, 756]; // the two raised string-course bands (弦纹)
const ZONES = [[64, BAND_A[0] - 9], [BAND_A[1] + 9, BAND_B[0] - 9], [BAND_B[1] + 9, 1420]];

const sstep = (e0, e1, v) => { const t = v <= e0 ? 0 : v >= e1 ? 1 : (v - e0) / (e1 - e0); return t * t * (3 - 2 * t); };

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
  const TH = 0.1, TV = 0.125;
  const heng = (p, x0, x1, y) => { const tilt = (x1 - x0) * 0.07; poly(p, [[x0, y + TH / 2], [x0, y - TH / 2], [x1, y - TH / 2 - tilt], [x1 + TH * 0.35, y + TH * 0.6 - tilt]]); };
  const shu = (p, x, y0, y1) => poly(p, [[x - TV / 2, y0], [x + TV / 2, y0], [x + TV / 2, y1], [x - TV * 0.3, y1 + TV * 0.3]]);
  const slash = (p, x0, y0, x1, y1, t) => {
    const dx = x1 - x0, dy = y1 - y0, m = Math.hypot(dx, dy) || 1, nx = (-dy / m) * t / 2, ny = (dx / m) * t / 2;
    poly(p, [[x0 + nx, y0 + ny], [x0 - nx, y0 - ny], [x1 - nx * 0.35, y1 - ny * 0.35], [x1 + nx * 0.35, y1 + ny * 0.35]]);
  };
  const part = (p, bx, by, bw, bh, nH, nV, legs) => {
    for (let i = 0; i < nH; i++) {
      const y = by + bh * (0.08 + 0.84 * ((i + 0.5 + r.range(-0.18, 0.18)) / nH));
      const x0 = bx + bw * r.pick([0, 0, 0.05, 0.3]), x1 = bx + bw * r.pick([1, 1, 0.92, 0.68]);
      heng(p, x0, x1, y);
    }
    const cols = [0.06, 0.5, 0.94, 0.3, 0.72];
    const used = new Set();
    for (let i = 0; i < nV; i++) {
      let k = r.int(0, cols.length - 1); while (used.has(k)) k = (k + 1) % cols.length; used.add(k);
      const y0 = by + bh * r.pick([0, 0, 0.12, 0.34]), y1 = by + bh * r.pick([1, 1, 0.9, 0.62]);
      shu(p, bx + bw * cols[k], y0, y1);
    }
    if (legs) {
      const cx = bx + bw * r.range(0.4, 0.6), y0 = by + bh * r.range(0.4, 0.6);
      if (r.chance(0.8)) slash(p, cx, y0, bx + bw * 0.02, by + bh, TV * 1.15);
      if (r.chance(0.8)) slash(p, cx + bw * 0.05, y0, bx + bw * 0.98, by + bh, TV * 1.25);
    }
    if (r.chance(0.4)) { const x = bx + bw * r.range(0.2, 0.8), y = by + bh * r.range(0.05, 0.3); slash(p, x - 0.04, y - 0.05, x + 0.05, y + 0.07, TV * 1.3); }
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
      part(p, 0.08, 0.03, 0.84, split - 0.07, r.int(2, 2), r.int(2, 3), false);
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
  const glyphs = buildGlyphSet(84);
  const r = L.rng('s15rows');
  const nCols = Math.ceil((a.span(PAD + 120) * a.R) / CW);
  return L.makeLayer(PAD, (g) => {
    g.fillStyle = '#fff';
    for (const [z0, z1] of ZONES) {
      const nRows = Math.floor((z1 - z0) / CH), pitch = (z1 - z0) / nRows;
      for (let k = 0; k < nRows; k++) {
        const sTop = z0 + k * pitch + pitch * 0.07, sBot = sTop + pitch * 0.86;
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
          g.scale(CW * 0.8 * wScale * sc, hpx);
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
  const a = env.arc, res = 0.5;
  const fw = W + PAD * 2, fh = H + PAD * 2;
  const cw = Math.round(fw * res), ch = Math.round(fh * res);
  const base = new ImageData(cw, ch), crust = new ImageData(cw, ch);
  const b = base.data, c = crust.data;
  const n1 = L.makeNoise('s15mottle'), n2 = L.makeNoise('s15patina'), n3 = L.makeNoise('s15streak');
  const bandEdges = [BAND_A[0], BAND_A[1], BAND_B[0], BAND_B[1]];
  const yStart = Math.max(0, Math.floor((a.crestY - 6 + PAD) * res));
  for (let y = yStart; y < ch; y++) {
    const dy = a.cy - (y / res - PAD);
    for (let x = 0; x < cw; x++) {
      const dx = x / res - PAD - a.cx;
      const d = a.R - Math.sqrt(dx * dx + dy * dy);
      if (d < -4) continue;
      const u = Math.atan2(dx, dy) * a.R;
      const s = sOf(d);
      // bronze tone: big cast blotches + long streaks that run round the bell + fine tooth
      const mot = n1.fbm(u / 330, s / 330, 4);
      const str = n3.fbm(u / 1300 + 3.1, s / 30, 3);
      const fine = n1.n2(u / 7, s / 7);
      const t = L.clamp(0.42 + 0.6 * mot + 0.32 * str + 0.12 * fine);
      let R0, G0, B0;
      if (t < 0.5) { const k = t / 0.5; R0 = 26 + (88 - 26) * k; G0 = 16 + (59 - 16) * k; B0 = 9 + (35 - 9) * k; }
      else { const k = (t - 0.5) / 0.5; R0 = 88 + (150 - 88) * k; G0 = 59 + (103 - 59) * k; B0 = 35 + (60 - 35) * k; }
      // verdigris. 1) a thin dull wash that lives in the ground between the strokes
      const wx = n2.n2(u / 430 + 9.1, s / 430 - 3.3), wy = n2.n2(u / 430 - 5.2, s / 430 + 7.7);
      const blob = n2.fbm(u / 150 + wx * 0.9, s / 150 + wy * 0.9, 4);
      const region = n2.n2(u / 900 + 1.7, s / 600 - 2.2);
      const hf = n2.fbm(u / 10 + 77, s / 10, 2);
      const wash = sstep(-0.3, 0.3, 0.8 * blob + 0.5 * region + 0.2 * hf) * 0.5;
      // 2) crusty patches with ragged, granular edges; more where water sits against the raised bands
      let near = 0, below = 0;
      for (let i = 0; i < 4; i++) {
        const e = s - bandEdges[i];
        if (Math.abs(e) < 26) near = Math.max(near, 1 - Math.abs(e) / 26);
        if ((i & 1) && e > 0 && e < 300) below = Math.max(below, 1 - e / 300);
      }
      const pf = 0.72 * blob + 0.45 * region + 0.24 * near + 0.3 * hf - 0.2 * str;
      // 3) runs that trickled down from the bands
      const drip = sstep(0.42, 0.7, n3.n2(u / 12 + 40, s / 330 + 3) + 0.25 * hf) * below * (0.65 + 0.35 * region);
      const pa = Math.max(sstep(0.2, 0.3, pf), drip * 0.9);
      const pc = 0.5 + 0.5 * n2.n2(u / 40 + 20, s / 40);
      const chalk = sstep(0.4, 0.66, pf) * (0.4 + 0.6 * pc);
      const PR = 30 + (66 - 30) * pc + (128 - 66) * chalk, PG = 80 + (146 - 80) * pc + (186 - 146) * chalk, PB = 74 + (134 - 74) * pc + (166 - 134) * chalk;
      const i = (y * cw + x) * 4;
      // wash first (dull, dark), then the crust
      R0 += (24 - R0) * wash; G0 += (62 - G0) * wash; B0 += (57 - B0) * wash;
      const k = pa * 0.92;
      b[i] = R0 + (PR - R0) * k; b[i + 1] = G0 + (PG - G0) * k; b[i + 2] = B0 + (PB - B0) * k; b[i + 3] = 255;
      // the thickest crust also buries the raised strokes
      const ca = sstep(0.36, 0.44, pf);
      c[i] = PR; c[i + 1] = PG; c[i + 2] = PB; c[i + 3] = 255 * ca * 0.92;
    }
  }
  const up = (img) => {
    const small = L.makeCanvas(cw, ch); small.getContext('2d').putImageData(img, 0, 0);
    const out = L.makeCanvas(fw, fh); const g = out.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(small, 0, 0, fw, fh);
    out._pad = PAD;
    return out;
  };
  return { base: up(base), crust: up(crust) };
}

// ───────────────────────── raised string-course bands ─────────────────────────
function ridge(g, a, sc, sw) {
  const dT = dOf(sc - sw / 2), dB = dOf(sc + sw / 2), wp = dB - dT, dm = (dT + dB) / 2;
  g.lineCap = 'butt';
  g.strokeStyle = 'rgba(4,2,1,0.6)'; g.lineWidth = wp * 0.8 + 3; a.stroke(g, -(dB + wp * 0.25 + 1.5));   // cast shadow below
  // half-round moulding lit from above: shade across its width
  g.strokeStyle = L.radial(g, a.cx, a.cy, a.R - dB - 0.5, a.R - dT + 0.5, [[0, '#1c1008'], [0.22, '#4a321c'], [0.52, '#8d6540'], [0.74, '#d2a674'], [0.86, '#b98a58'], [1, '#5e4126']]);
  g.lineWidth = wp + 1; a.stroke(g, -dm);
}
function stringBand(g, a, [s0, s1]) {
  const w = s1 - s0;
  // the plain sunk ground the ridges stand on
  g.strokeStyle = 'rgba(12,7,3,0.5)'; g.lineWidth = dOf(s1 + 4) - dOf(s0 - 4); a.stroke(g, -(dOf(s0 - 4) + dOf(s1 + 4)) / 2);
  ridge(g, a, s0 + w * 0.09, w * 0.13);
  ridge(g, a, s0 + w * 0.5, w * 0.44);
  ridge(g, a, s0 + w * 0.91, w * 0.13);
}
/** verdigris packed into the grooves of the bands, broken up along the arc */
function bandDeposits(env) {
  const a = env.arc;
  const lay = L.makeLayer(PAD, (g) => {
    for (const [s0, s1] of [BAND_A, BAND_B]) {
      const w = s1 - s0;
      for (const [sc, sw, col] of [[s0 + w * 0.215, w * 0.1, '#5aa697'], [s0 + w * 0.785, w * 0.1, '#4a9488'], [s1 + 5, 9, '#3f8f84'], [s0 - 5, 8, '#357a70']]) {
        g.strokeStyle = col; g.lineWidth = Math.max(1.4, dOf(sc + sw / 2) - dOf(sc - sw / 2));
        a.stroke(g, -dOf(sc));
      }
    }
  });
  const g = lay.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(L.polarNoiseLayer(env, PAD, { seed: 's15groove', scale: 46, sx: 3.2, sy: 1, octaves: 4, res: 0.33, contrast: 1.7,
    ramp: [[0, 'rgba(0,0,0,0)'], [0.4, 'rgba(0,0,0,0)'], [0.56, 'rgba(0,0,0,0.9)'], [1, 'rgba(0,0,0,1)']] }), 0, 0);
  return lay;
}

function buildBell(env) {
  const a = env.arc;
  const { base, crust } = buildSurface(env);
  const mask = buildGlyphMask(env);
  // corrosion has eaten some of the casting away
  {
    const g = mask.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'destination-out';
    g.drawImage(L.polarNoiseLayer(env, PAD, { seed: 's15eat', scale: 90, octaves: 4, warp: 0.7, res: 0.25, contrast: 1.5,
      ramp: [[0, 'rgba(0,0,0,0)'], [0.64, 'rgba(0,0,0,0)'], [0.76, 'rgba(0,0,0,0.85)'], [1, 'rgba(0,0,0,1)']] }), 0, 0);
  }
  const blot = L.polarNoiseLayer(env, PAD, { seed: 's15blot', scale: 230, octaves: 4, warp: 0.6, res: 0.25, contrast: 1.4, ramp: [[0, '#4a3a2c'], [0.55, '#ffffff'], [1, '#ffffff']] });
  const occl = L.blurred(tint(mask, '#060402'), 3);
  const shadow = tint(mask, '#050301');
  const hi = tint(mask, '#ffe6bc');
  // stroke faces: rubbed bronze, a little uneven from stroke to stroke
  const face = tint(mask, '#a37548');
  {
    const g = face.getContext('2d');
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = 0.8;
    g.drawImage(L.polarNoiseLayer(env, PAD, { seed: 's15face', scale: 70, octaves: 3, res: 0.25, contrast: 1.6, ramp: [[0, 'rgba(60,36,18,0.75)'], [0.5, 'rgba(120,84,50,0.1)'], [1, 'rgba(214,170,116,0.5)']] }), 0, 0);
  }
  const deposits = bandDeposits(env);
  return L.makeLayer(PAD, (g) => {
    g.drawImage(base, -PAD, -PAD);
    // inscription in relief: soft occlusion, hard shadow down-right, sharp light up-left, then the face
    g.globalAlpha = 0.85; g.drawImage(occl, -PAD + 1, -PAD + 1.6);
    g.globalAlpha = 0.9; g.drawImage(shadow, -PAD + 1.5, -PAD + 2.1);
    g.globalAlpha = 0.7; g.drawImage(hi, -PAD - 1, -PAD - 1.3);
    g.globalAlpha = 1; g.drawImage(face, -PAD, -PAD);
    // string-course bands
    stringBand(g, a, BAND_A);
    stringBand(g, a, BAND_B);
    g.globalAlpha = 0.9; g.drawImage(deposits, -PAD, -PAD);
    // the thickest verdigris buries the strokes too
    g.globalAlpha = 1; g.drawImage(crust, -PAD, -PAD);
    // cast-surface blotching, pits and flecks
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.55;
    g.drawImage(blot, -PAD, -PAD);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    const below = (x, y) => a.drAt(x, y) < -2;
    L.speckle(g, { seed: 's15pit', count: 6500, x: -PAD, y: a.crestY - 10, w: W + PAD * 2, h: H + PAD - a.crestY + 10, rMin: 0.5, rMax: 2.4, colors: ['#0b0603', '#140b05', '#12302c'], alpha: [0.3, 0.85], squash: 0.6, test: below });
    L.speckle(g, { seed: 's15fleck', count: 2600, x: -PAD, y: a.crestY - 10, w: W + PAD * 2, h: H + PAD - a.crestY + 10, rMin: 0.4, rMax: 1.5, colors: ['#8fcfbd', '#6fb5a6', '#c99a64', '#4fa092'], alpha: [0.25, 0.8], squash: 0.6, test: below });
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.55;
    g.drawImage(L.grainTex(W + PAD * 2, H + PAD * 2, { seed: 's15grain', amount: 0.32 }), -PAD, -PAD);
  });
}

// ───────────────────────── light (fixed to the frame; the bronze slides underneath) ─────────────────────────
const grey = (v, tintC) => { const c = tintC || [1, 1, 1]; return `rgb(${Math.round(255 * L.clamp(v * c[0]))},${Math.round(255 * L.clamp(v * c[1]))},${Math.round(255 * L.clamp(v * c[2]))})`; };

function buildShade(env) {
  const a = env.arc;
  const c = L.makeCanvas(W, H); const g = c.getContext('2d');
  const DEEP = 900, COLD = [0.8, 0.88, 1.3];
  const stops = [[0, 0.2, COLD], [8, 0.26, COLD], [30, 0.46, [0.93, 0.96, 1.1]], [80, 0.8], [170, 1], [340, 0.94], [520, 0.74], [900, 0.45]];
  g.fillStyle = L.radial(g, a.cx, a.cy, a.R - DEEP, a.R, stops.map(([d, v, t]) => [1 - d / DEEP, grey(v, t)]));
  g.fillRect(0, 0, W, H);
  // one pool of warm light, left of centre; the bell falls away into the dark on both sides
  g.globalCompositeOperation = 'multiply';
  g.save();
  g.translate(800, a.crestY + 240); g.scale(1, 0.62);
  g.fillStyle = L.radial(g, 0, 0, 120, 1380, [[0, grey(1)], [0.3, grey(0.93)], [0.6, grey(0.66)], [0.85, grey(0.4)], [1, grey(0.28)]]);
  g.fillRect(-3000, -3000, 6000, 6000);
  g.restore();
  return c;
}

/** soft reflections of the light sources: concentric bands, streaky along the arc. Padded so it can drift. */
function buildSpec(env) {
  const a = env.arc;
  const FW = W + PAD * 2, FH = H + PAD * 2;
  const lay = L.makeLayer(PAD, (g) => {
    const band = (dC, hw, alpha, col, xC, reach) => {
      const t = L.makeLayer(PAD, (tg) => {
        const r0 = a.R - dC - hw, r1 = a.R - dC + hw;
        tg.fillStyle = L.radial(tg, a.cx, a.cy, r0, r1, [[0, L.rgba(col, 0)], [0.2, L.rgba(col, alpha * 0.2)], [0.38, L.rgba(col, alpha * 0.68)], [0.5, L.rgba(col, alpha)], [0.62, L.rgba(col, alpha * 0.68)], [0.8, L.rgba(col, alpha * 0.2)], [1, L.rgba(col, 0)]]);
        tg.fillRect(-PAD, -PAD, FW, FH);
        tg.globalCompositeOperation = 'destination-in';
        const x0 = xC - reach, x1 = xC + reach;
        tg.fillStyle = L.linear(tg, x0, 0, x1, 0, [[0, 'rgba(0,0,0,0)'], [0.16, 'rgba(0,0,0,0.1)'], [0.32, 'rgba(0,0,0,0.5)'], [0.44, 'rgba(0,0,0,0.92)'], [0.5, 'rgba(0,0,0,1)'], [0.56, 'rgba(0,0,0,0.92)'], [0.68, 'rgba(0,0,0,0.5)'], [0.84, 'rgba(0,0,0,0.1)'], [1, 'rgba(0,0,0,0)']]);
        tg.fillRect(-PAD, -PAD, FW, FH);
      });
      g.globalCompositeOperation = 'lighter';
      g.drawImage(t, -PAD, -PAD);
    };
    band(236, 72, 0.5, '#ffd2ac', 760, 1250);     // key: a long soft box
    band(150, 22, 0.28, '#ffe0c4', 660, 900);      // its thinner echo higher up the shoulder
    band(50, 13, 0.5, '#dcdcff', 900, 1500);       // cold strip just inside the limb
    band(470, 80, 0.26, '#ffc898', 1080, 1100);    // low fill
  });
  const g = lay.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(L.polarNoiseLayer(env, PAD, { seed: 's15sheen', scale: 20, sx: 46, sy: 1, octaves: 3, res: 0.33, contrast: 1.5,
    ramp: [[0, 'rgba(0,0,0,0.25)'], [0.5, 'rgba(0,0,0,0.7)'], [1, 'rgba(0,0,0,1)']] }), 0, 0);
  return lay;
}

function buildRim(env) {
  const a = env.arc;
  const c = L.makeCanvas(W, H); const g = c.getContext('2d');
  // colour runs violet → cyan along the silhouette
  g.fillStyle = L.linear(g, 0, 0, W, 0, [[0, '#5548d8'], [0.28, '#7a6cff'], [0.5, '#8d84ff'], [0.68, '#6f9df0'], [0.85, '#58c8d8'], [1, '#48b2c4']]);
  g.fillRect(0, 0, W, H);
  // radial falloff: light wraps a little way onto the bronze, blooms a little way into the dark
  g.globalCompositeOperation = 'destination-in';
  const IN = 70, OUT = 90, T = IN + OUT;
  const al = [[-IN, 0], [-34, 0.07], [-14, 0.28], [-5, 0.6], [-1.5, 0.95], [0.5, 0.9], [3.5, 0.34], [10, 0.1], [26, 0.025], [OUT, 0]];
  g.fillStyle = L.radial(g, a.cx, a.cy, a.R - IN, a.R + OUT, al.map(([dr, v]) => [(dr + IN) / T, `rgba(0,0,0,${v})`]));
  g.fillRect(0, 0, W, H);
  g.fillStyle = L.linear(g, 0, 0, W, 0, [[0, 'rgba(0,0,0,0.5)'], [0.18, 'rgba(0,0,0,0.85)'], [0.4, 'rgba(0,0,0,1)'], [0.58, 'rgba(0,0,0,0.78)'], [0.78, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0.6)']]);
  g.fillRect(0, 0, W, H);
  // the crisp line itself
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = L.linear(g, 0, 0, W, 0, [[0, 'rgba(140,128,255,0.55)'], [0.45, 'rgba(206,200,255,0.9)'], [0.75, 'rgba(160,214,250,0.85)'], [1, 'rgba(110,214,230,0.55)']]);
  g.lineWidth = 2; a.stroke(g, -1);
  return c;
}

export default {
  name: '铜钟',
  tone: 'light',
  init(env) {
    S = { bell: buildBell(env), shade: buildShade(env), spec: buildSpec(env), rim: buildRim(env) };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.017, 0.017, p);      // the bell turns under fixed lights
    ctx.fillStyle = '#040404'; ctx.fillRect(0, 0, W, H);
    ctx.save();
    a.clipBelow(ctx, 0);
    L.blit(ctx, env, S.bell, { rot });
    ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(S.shade, 0, 0);
    L.blit(ctx, env, S.spec, { rot: -rot * 0.45, blend: 'color-dodge' });
    L.blit(ctx, env, S.spec, { rot: -rot * 0.45, blend: 'screen', alpha: 0.16 });
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'screen'; ctx.drawImage(S.rim, 0, 0);
    // a glint running along the silhouette
    const th = L.lerp(-0.1, 0.04, p);
    a.at(ctx, th, -1, () => {
      ctx.scale(1, 0.05);
      ctx.fillStyle = L.radial(ctx, 0, 0, 0, 330, [[0, 'rgba(226,222,255,0.8)'], [0.25, 'rgba(160,150,255,0.35)'], [1, 'rgba(120,110,255,0)']]);
      ctx.fillRect(-330, -330, 660, 660);
    });
    ctx.restore();
  },
};
