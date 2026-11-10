// s13 — 木构斗拱. Bare, unpainted timber bracket sets lying on a sheet of old paper.
// The arc is the top edge of a curved eave tie-beam (挑檐枋); a row of pegs runs along it. Under the beam hang the
// bracket sets, seen square-on: cap block (栌斗) → short bow arm with three small blocks → long bow arm with three
// small blocks → beam. Each tier is wider and stands further forward than the one below, so every piece throws a
// shadow on the next and the voids between sets (拱眼) fall into darkness.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 240;

// every size is a multiple of one module (斗口), the way the real thing is set out
const U = 42;
const BEAM = 106;                         // radial depth of the beam whose top edge is the arc
const PITCH = 11 * U;                     // centre-to-centre spacing of the sets along the arc
const ARM_H = 1.4 * U;                    // depth of a bow arm (拱)
const ARM1_W = 6.2 * U, ARM2_W = 9.2 * U; // short arm / long arm
const DOU_W = 1.45 * U, DOU_B = 0.95 * U, DOU_H = U;   // small block (升): top width, foot width, height
const EAR = 0.4 * U;                      // a small block's ears lap this far over the member it carries
const LU_W = 3 * U, LU_B = 2.2 * U, LU_H = 2 * U;       // cap block (栌斗)
// distances below the arc, measured toward the circle centre
const Y_DOU2 = BEAM - EAR;                // upper row of blocks (they carry the beam)
const Y_ARM2 = Y_DOU2 + DOU_H;            // long arm
const Y_DOU1 = Y_ARM2 + ARM_H - EAR;      // lower row of blocks (they carry the long arm)
const Y_ARM1 = Y_DOU1 + DOU_H;            // short arm
const Y_LU = Y_ARM1 + ARM_H - 0.8 * U;    // cap block: the short arm sits 0.8 U deep in its mouth
const Y_PLATE = Y_LU + LU_H;              // plate the cap blocks stand on
const PLATE_H = 1.25 * U;
const Y_LINTEL = Y_PLATE + PLATE_H;       // big lintel under the plate
const LINTEL_H = 6 * U;

const PAPER = '#e6d7b8';
const LIGHT = [-0.56, -0.83];             // direction TOWARD the light on screen (upper left)

let S = null;

// ───────────────────────── procedural timber ─────────────────────────
/** long-grain face of a plank: growth rings cut lengthwise (dark late-wood lines, soft early wood), fibres, pores, raised grain */
function woodTexture(w, h, seed) {
  const nz = L.makeNoise(seed);
  const f = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const breathe = 1.7 * Math.sin(y / 71 + 1.3) + 0.9 * Math.sin(y / 23.7);   // ring spacing tightens and opens
    for (let x = 0; x < w; x++) {
      const warp = 44 * nz.fbm(x / 860, y / 130, 2) + 7 * nz.n2(x / 210 + 40, y / 38 - 7);
      const ring = (y + warp) / 10 + breathe;
      const t = ring - Math.floor(ring);
      const late = t < 0.84 ? Math.pow(t / 0.84, 3) : (1 - t) / 0.16;          // slow darkening, then a sharp return
      const fiber = nz.n2(x / 64, y / 1.3 + 90);
      const pore = nz.n2(x / 17 + 300, y / 0.85);
      f[y * w + x] = 0.69 - 0.36 * late + 0.085 * fiber - (pore > 0.45 ? (pore - 0.45) * 0.36 : 0);
    }
  }
  const ramp = L.makeRamp([[0, '#2a1707'], [0.24, '#55311a'], [0.46, '#8e5e34'], [0.64, '#b07a45'], [0.82, '#d39d60'], [1, '#ebc188']]);
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) { const c = ramp(i / 255); lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2]; }
  const img = new ImageData(w, h); const d = img.data;
  for (let y = 0; y < h; y++) {
    const ym = (y > 0 ? y - 1 : 0) * w, yp = (y < h - 1 ? y + 1 : y) * w;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      // hard late-wood stands proud of the worn early wood → light it from above
      const v = L.clamp(f[i] + 0.85 * (f[ym + x] - f[yp + x]));
      const li = (v * 255) | 0, k = i * 4;
      d[k] = lut[li * 3]; d[k + 1] = lut[li * 3 + 1]; d[k + 2] = lut[li * 3 + 2]; d[k + 3] = 255;
    }
  }
  const c = L.makeCanvas(w, h); const g = c.getContext('2d');
  g.putImageData(img, 0, 0);
  // age: broad streaks where the surface has darkened or bleached
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.6;
  g.drawImage(L.noiseTex(w, h, { seed: seed + 'a', scale: 260, sx: 3.5, sy: 0.55, octaves: 3, res: 0.2, contrast: 1.3, ramp: [[0, '#b38a5c'], [0.55, '#ffffff'], [1, '#ffffff']] }), 0, 0);
  g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.4;
  g.drawImage(L.noiseTex(w, h, { seed: seed + 'b', scale: 110, sx: 7, sy: 0.5, octaves: 3, res: 0.25, contrast: 1.7 }), 0, 0);
  return c;
}

/** end grain: annual rings around the pith, medullary rays, grime toward the rim. The pith sits at the canvas centre. */
function endGrainTexture(n, seed) {
  const nz = L.makeNoise(seed);
  const ramp = L.makeRamp([[0, '#34200f'], [0.3, '#6c4424'], [0.58, '#a5733e'], [0.82, '#cf9c62'], [1, '#e8c08c']]);
  const img = new ImageData(n, n); const d = img.data;
  const c0 = n / 2;
  let k = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = x - c0, dy = (y - c0) * 1.12;
    const dist = Math.hypot(dx, dy) + 0.001;
    const ring = (dist + 4 * nz.fbm(x / 46, y / 46, 2)) / 4.5 + 0.3 * Math.sin(Math.atan2(dy, dx) * 3 + 1);
    const t = ring - Math.floor(ring);
    const late = t < 0.78 ? Math.pow(t / 0.78, 2.4) : (1 - t) / 0.22;
    const ray = nz.n2((dx / dist) * 11 + dist / 38, (dy / dist) * 11);
    const mott = nz.n2(x / 2.6, y / 2.6);
    const v = L.clamp(0.8 - 0.34 * late + 0.06 * ray + 0.05 * mott - 0.22 * L.smooth(dist / (n * 0.42)));
    const c = ramp(v);
    d[k++] = c[0]; d[k++] = c[1]; d[k++] = c[2]; d[k++] = 255;
  }
  const c = L.makeCanvas(n, n);
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

// ───────────────────────── carpentry helpers (all in a set's local frame: +x along the arc, +y toward the centre) ─────────────────────────
/** the screen light direction expressed in a frame rotated by th */
function lightIn(th) {
  const c = Math.cos(th), s = Math.sin(th);
  return [LIGHT[0] * c + LIGHT[1] * s, -LIGHT[0] * s + LIGHT[1] * c];
}

/** chamfer light: a pale line inside the edges that face the light, a dark one inside the edges that face away */
function bevel(g, th, path, o = {}) {
  const { d = 1.5, hi = 'rgba(255,230,184,0.55)', lo = 'rgba(30,12,2,0.5)', wHi = 2.2, wLo = 3 } = o;
  const [lx, ly] = lightIn(th);
  g.save(); path(); g.clip(); g.lineJoin = 'round';
  g.save(); g.translate(lx * d, ly * d); path(); g.strokeStyle = lo; g.lineWidth = wLo; g.stroke(); g.restore();
  g.save(); g.translate(-lx * d, -ly * d); path(); g.strokeStyle = hi; g.lineWidth = wHi; g.stroke(); g.restore();
  g.restore();
}

/** drying checks: thin lens-shaped splits that follow the grain, with a lit lower lip */
function checks(g, r, bb, n) {
  for (let k = 0; k < n; k++) {
    const len = r.range(0.3, 0.75) * bb.w, x0 = bb.x + r.range(0, bb.w - len), wmax = r.range(1.2, 2.6);
    let y = bb.y + r() * bb.h;
    const m = Math.max(4, Math.round(len / 10)), top = [], bot = [];
    for (let i = 0; i <= m; i++) {
      const u = i / m; y += r.range(-0.8, 0.8);
      const t = wmax * Math.pow(Math.sin(Math.PI * u), 0.6);
      top.push([x0 + u * len, y - t / 2]); bot.push([x0 + u * len, y + t / 2]);
    }
    g.beginPath(); top.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    for (let i = m; i >= 0; i--) g.lineTo(bot[i][0], bot[i][1]);
    g.closePath(); g.fillStyle = 'rgba(20,8,2,0.82)'; g.fill();
    g.beginPath(); bot.forEach((p, i) => (i ? g.lineTo(p[0], p[1] + 1) : g.moveTo(p[0], p[1] + 1)));
    g.strokeStyle = 'rgba(255,228,180,0.3)'; g.lineWidth = 0.9; g.stroke();
  }
}

/**
 * One piece of timber: its underside (we look up at it slightly) + the shadow it throws on whatever is already drawn,
 * then the textured, tinted, edge-worn front face. `inner` adds piece-specific shading while still clipped to the face.
 */
function timber(g, th, r, path, bb, tex, o = {}, inner = null) {
  const { ext = 8, sh = [8, 13, 16, 0.62], src = null } = o;
  const tint = o.tint === undefined ? r.range(-1, 1) : o.tint;
  g.save();
  g.shadowColor = `rgba(12,5,1,${sh[3]})`; g.shadowBlur = sh[2]; g.shadowOffsetX = sh[0]; g.shadowOffsetY = sh[1];
  g.translate(0, ext); path(); g.fillStyle = '#261407'; g.fill();
  g.restore();
  g.save(); path(); g.clip();
  const sx = src ? src.x : r.range(1, tex.width - bb.w - 2), sy = src ? src.y : r.range(1, tex.height - bb.h - 2);
  g.drawImage(tex, sx, sy, bb.w, bb.h, bb.x, bb.y, bb.w, bb.h);
  // no two pieces have aged alike
  if (tint > 0) { g.globalCompositeOperation = 'soft-light'; g.fillStyle = `rgba(255,238,200,${0.34 * tint})`; }
  else { g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgba(150,102,60,${-0.45 * tint})`; }
  g.fillRect(bb.x - 2, bb.y - 2, bb.w + 4, bb.h + 4);
  g.globalCompositeOperation = 'source-over';
  // grime gathers along the edges
  g.lineJoin = 'round';
  for (const [lw, al] of [[14, 0.09], [7, 0.11], [3, 0.15]]) { path(); g.strokeStyle = `rgba(36,16,4,${al})`; g.lineWidth = lw; g.stroke(); }
  if (inner) inner();
  g.restore();
  bevel(g, th, path, o.bevel);
  path(); g.strokeStyle = 'rgba(22,9,2,0.6)'; g.lineWidth = 1; g.stroke();
}

/** bow arm (拱): a squared timber whose ends are cut back underneath in short facets (卷杀) so they sweep up like a bow */
function gongPath(g, w, y0, h) {
  const hw = w / 2, c = 1.25 * U, v = h * 0.4, N = 4;
  g.beginPath();
  g.moveTo(-hw, y0); g.lineTo(hw, y0); g.lineTo(hw, y0 + v);
  for (let k = 1; k <= N; k++) { const a = (k / N) * Math.PI / 2; g.lineTo(hw - c * (1 - Math.cos(a)), y0 + v + (h - v) * Math.sin(a)); }
  for (let k = N; k >= 0; k--) { const a = (k / N) * Math.PI / 2; g.lineTo(-hw + c * (1 - Math.cos(a)), y0 + v + (h - v) * Math.sin(a)); }
  g.closePath();
}

/** block (斗 / 升): square upper part (ears + waist) over a foot that tapers inward with a slight hollow (斗欹) */
function douPath(g, w, wb, y0, h) {
  const ye = y0 + h * 0.6, hw = w / 2, hb = wb / 2;
  g.beginPath();
  g.moveTo(-hw, y0); g.lineTo(hw, y0); g.lineTo(hw, ye);
  g.quadraticCurveTo(hb + (hw - hb) * 0.18, ye + (h * 0.4) * 0.38, hb, y0 + h);
  g.lineTo(-hb, y0 + h);
  g.quadraticCurveTo(-hb - (hw - hb) * 0.18, ye + (h * 0.4) * 0.38, -hw, ye);
  g.closePath();
}

function drawGong(g, th, r, tex, w, y0, seats) {
  const h = ARM_H, hw = w / 2;
  const path = () => gongPath(g, w, y0, h);
  timber(g, th, r, path, { x: -hw, y: y0, w, h }, tex, { ext: 10, sh: [9, 15, 18, 0.66] }, () => {
    // lit along the top, turning away from the light toward the underside
    g.fillStyle = L.linear(g, 0, y0, 0, y0 + h, [[0, 'rgba(255,234,192,0.2)'], [0.32, 'rgba(255,234,192,0)'], [0.6, 'rgba(34,14,3,0)'], [1, 'rgba(34,14,3,0.36)']]);
    g.fillRect(-hw, y0, w, h);
    // the cut-back ends roll under
    for (const sg of [-1, 1]) {
      g.fillStyle = L.radial(g, sg * hw, y0 + h, 0, 1.6 * U, [[0, 'rgba(24,9,2,0.62)'], [0.5, 'rgba(24,9,2,0.22)'], [1, 'rgba(24,9,2,0)']]);
      g.fillRect(sg > 0 ? hw - 1.6 * U : -hw, y0, 1.6 * U, h);
    }
    // 拱眼: the shallow scoop cut into the top edge between the block seats
    for (let k = 0; k < seats.length - 1; k++) {
      const x1 = seats[k] + DOU_B / 2 + 6, x2 = seats[k + 1] - DOU_B / 2 - 6;
      if (x2 - x1 < 24) continue;
      const d = h * 0.3;
      g.beginPath(); g.moveTo(x1, y0 - 1); g.bezierCurveTo(x1 + 7, y0 + d * 1.3, x2 - 7, y0 + d * 1.3, x2, y0 - 1); g.closePath();
      g.fillStyle = L.linear(g, 0, y0, 0, y0 + d, [[0, 'rgba(22,8,2,0.7)'], [1, 'rgba(22,8,2,0.26)']]); g.fill();
      g.beginPath(); g.moveTo(x1, y0); g.bezierCurveTo(x1 + 7, y0 + d * 1.3 + 1.2, x2 - 7, y0 + d * 1.3 + 1.2, x2, y0);
      g.strokeStyle = 'rgba(255,230,184,0.45)'; g.lineWidth = 1.4; g.stroke();
    }
    checks(g, r, { x: -hw + 24, y: y0 + h * 0.4, w: w - 48, h: h * 0.45 }, r.int(1, 2));
  });
}

function drawDou(g, th, r, tex, x, y0, w, wb, h, big) {
  g.save(); g.translate(x, 0);
  const path = () => douPath(g, w, wb, y0, h);
  const ye = y0 + h * 0.6;
  timber(g, th, r, path, { x: -w / 2, y: y0, w, h }, tex, { ext: big ? 6 : 4, sh: big ? [9, 14, 16, 0.66] : [7, 11, 12, 0.62] }, () => {
    // upper part catches the light…
    g.fillStyle = L.linear(g, 0, y0, 0, ye, [[0, 'rgba(255,236,196,0.26)'], [1, 'rgba(255,236,196,0.04)']]);
    g.fillRect(-w / 2, y0, w, ye - y0);
    // …the hollowed foot turns under into shade
    g.fillStyle = L.linear(g, 0, ye, 0, y0 + h, [[0, 'rgba(30,12,2,0.3)'], [1, 'rgba(24,9,2,0.68)']]);
    g.fillRect(-w / 2, ye, w, y0 + h - ye);
    g.fillStyle = 'rgba(255,232,188,0.42)'; g.fillRect(-w / 2, ye - 1.4, w, 1.4);
    g.fillStyle = 'rgba(20,8,2,0.4)'; g.fillRect(-w / 2, ye, w, 1.6);
    if (big) checks(g, r, { x: -w / 2 + 12, y: y0 + 8, w: w - 24, h: h * 0.4 }, 1);
  });
  g.restore();
}

/** the end of an arm that runs straight toward us: end grain above, the cut-back underside receding below */
function drawEnd(g, th, r, endTex, y0) {
  const w = U, h = ARM_H, n = endTex.width;
  const src = { x: n / 2 - w / 2 + r.range(-11, 11), y: n / 2 - h * 0.34 + r.range(-10, 8) };
  const px = -w / 2 + n / 2 - src.x, py = y0 + n / 2 - src.y;    // where the pith lands
  const path = () => { g.beginPath(); g.rect(-w / 2, y0, w, h); };
  timber(g, th, r, path, { x: -w / 2, y: y0, w, h }, endTex, { ext: 9, sh: [10, 16, 15, 0.72], src, tint: r.range(-0.2, 0.7), bevel: { hi: 'rgba(255,238,204,0.7)' } }, () => {
    // radial checks opening from the pith
    for (let k = 0; k < 2; k++) {
      const a = r.range(0, L.TAU), len = r.range(16, 30), wd = r.range(1.6, 2.8);
      const ex = px + Math.cos(a) * len, ey = py + Math.sin(a) * len;
      g.beginPath(); g.moveTo(px, py); g.lineTo(ex - Math.sin(a) * wd, ey + Math.cos(a) * wd); g.lineTo(ex + Math.sin(a) * wd, ey - Math.cos(a) * wd); g.closePath();
      g.fillStyle = 'rgba(20,8,2,0.8)'; g.fill();
    }
    // below the square end face the underside is cut back in facets: seen head-on they are bands, each a step darker
    const y1 = y0 + h * 0.5, bands = 3, bh = (h * 0.5) / bands;
    for (let k = 0; k < bands; k++) {
      g.fillStyle = `rgba(26,10,2,${0.34 + 0.2 * k})`; g.fillRect(-w / 2, y1 + k * bh, w, bh + 0.5);
      g.fillStyle = 'rgba(255,230,184,0.22)'; g.fillRect(-w / 2, y1 + k * bh, w, 1);
    }
  });
}

// ───────────────────────── curved members (bands concentric with the arc) ─────────────────────────
/** wrap the plank texture round a band: thin radial slices, each a straight strip in its own local frame */
function bandFace(g, a, r, tex, y0, depth, cuts) {
  const step = 10;
  for (let k = 0; k < cuts.length - 1; k++) {
    const t0 = cuts[k], t1 = cuts[k + 1];
    const len = (t1 - t0) * a.R;
    const sc = Math.min(1, (tex.width - 6) / len);
    const sx0 = r.range(1, tex.width - 4 - len * sc), sy = r.range(1, tex.height - depth - 2);
    const n = Math.ceil(len / step);
    for (let i = 0; i < n; i++) {
      a.at(g, t0 + ((i + 0.5) * step) / a.R, -y0, () => { g.drawImage(tex, sx0 + i * step * sc, sy, step * sc + 1, depth, -step / 2 - 0.6, 0, step + 1.2, depth); });
    }
    // each length of timber has its own colour
    const tint = r.range(-1, 1);
    if (tint > 0) { g.globalCompositeOperation = 'soft-light'; g.fillStyle = `rgba(255,238,200,${0.3 * tint})`; }
    else { g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgba(150,102,60,${-0.4 * tint})`; }
    a.pathBand(g, -y0 + 1, -y0 - depth - 1, t0, t1); g.fill();
    g.globalCompositeOperation = 'source-over';
  }
  // butt joints between lengths
  for (let k = 1; k < cuts.length - 1; k++) {
    a.at(g, cuts[k], -y0, () => {
      g.fillStyle = 'rgba(16,6,1,0.85)'; g.fillRect(-1.1, 0, 2.2, depth);
      g.fillStyle = 'rgba(255,230,184,0.35)'; g.fillRect(1.1, 0, 1.2, depth);
      g.fillStyle = L.linear(g, -14, 0, 14, 0, [[0, 'rgba(30,12,2,0)'], [0.5, 'rgba(30,12,2,0.28)'], [1, 'rgba(30,12,2,0)']]); g.fillRect(-14, 0, 28, depth);
    });
  }
}

/** checks that follow a curved member */
function bandChecks(g, a, r, y0, depth, t0, t1, n) {
  for (let k = 0; k < n; k++) {
    const len = r.range(90, 380) / a.R, ts = r.range(t0, t1 - len), wmax = r.range(1.4, 3.2);
    let y = y0 + r.range(0.14, 0.86) * depth;
    const m = Math.max(5, Math.round((len * a.R) / 12)), top = [], bot = [];
    for (let i = 0; i <= m; i++) {
      const u = i / m; y += r.range(-0.9, 0.9);
      const t = wmax * Math.pow(Math.sin(Math.PI * u), 0.6);
      top.push(a.pt(ts + u * len, -(y - t / 2))); bot.push(a.pt(ts + u * len, -(y + t / 2)));
    }
    g.beginPath(); top.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    for (let i = m; i >= 0; i--) g.lineTo(bot[i].x, bot[i].y);
    g.closePath(); g.fillStyle = 'rgba(20,8,2,0.82)'; g.fill();
    g.beginPath(); bot.forEach((p, i) => (i ? g.lineTo(p.x, p.y + 1.1) : g.moveTo(p.x, p.y + 1.1)));
    g.strokeStyle = 'rgba(255,228,180,0.3)'; g.lineWidth = 1; g.stroke();
  }
}

/** a whole curved timber: underside + cast shadow, wrapped grain, radial shading given as [[0..1 from top to bottom, colour]...] */
function band(g, a, r, tex, y0, depth, cuts, o = {}) {
  const { ext = 10, sh = [9, 16, 20, 0.66], shade = null, nChecks = 6 } = o;
  const s = a.span(PAD + 160);
  g.save();
  g.shadowColor = `rgba(12,5,1,${sh[3]})`; g.shadowBlur = sh[2]; g.shadowOffsetX = sh[0]; g.shadowOffsetY = sh[1];
  a.pathBand(g, -y0 - ext, -y0 - depth - ext, -s, s); g.fillStyle = '#231206'; g.fill();
  g.restore();
  g.save(); a.clipBand(g, -y0, -y0 - depth, -s, s);
  bandFace(g, a, r, tex, y0, depth, cuts);
  if (shade) {
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - y0 - depth, a.R - y0, shade.map(([t, c]) => [1 - t, c]));
    g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
  }
  bandChecks(g, a, r, y0, depth, -s, s, nChecks);
  g.restore();
}

// ───────────────────────── the timber layer ─────────────────────────
function buildWood(env) {
  const a = env.arc;
  const tex = woodTexture(2048, 448, 's13wood');
  const endTex = endGrainTexture(220, 's13end');
  const s = a.span(PAD + 160);
  const dth = PITCH / a.R;
  const nSets = Math.ceil(s / dth) + 1;
  const cutsFrom = (first, every) => { const out = []; for (let i = first; i <= nSets + every; i += every) out.push(i * dth); return out; };
  const full = (g) => g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);

  return L.makeLayer(PAD, (g) => {
    // the timber lies on the paper: a soft contact shadow creeps out above the beam
    g.save(); a.clipAbove(g, -0.5);
    g.shadowColor = 'rgba(74,46,16,0.6)'; g.shadowBlur = 20; g.shadowOffsetY = -1;
    g.strokeStyle = 'rgba(74,46,16,0.9)'; g.lineWidth = 14; a.stroke(g, -9, -s, s);
    g.shadowBlur = 6; a.stroke(g, -9, -s, s);
    g.restore();

    // the recess behind the brackets (拱眼壁): deep shadow, a ghost of boards
    g.save(); a.clipBelow(g, -BEAM + 6);
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 620, a.R - BEAM, [[0, '#1b0f07'], [0.45, '#170c05'], [1, '#0d0603']]);
    full(g);
    g.globalAlpha = 0.9;
    g.drawImage(L.polarNoiseLayer(env, PAD, { seed: 's13wall', scale: 26, sx: 0.55, sy: 9, octaves: 3, contrast: 1.6, res: 0.3,
      ramp: [[0, 'rgba(0,0,0,0.55)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(160,104,56,0.16)']] }), -PAD, -PAD);
    g.restore();

    // lintel and the plate the cap blocks stand on
    band(g, a, L.rng('s13lintel'), tex, Y_LINTEL, LINTEL_H, [-(nSets + 0.5) * dth, (nSets + 0.5) * dth], {
      ext: 12, sh: [8, 18, 26, 0.7], nChecks: 7,
      shade: [[0, 'rgba(18,7,1,0.72)'], [0.1, 'rgba(26,10,2,0.42)'], [0.3, 'rgba(30,12,2,0.2)'], [0.6, 'rgba(30,12,2,0.3)'], [1, 'rgba(14,5,1,0.78)']] });
    band(g, a, L.rng('s13plate'), tex, Y_PLATE, PLATE_H, cutsFrom(-nSets - 2, 3), {
      ext: 9, sh: [8, 14, 16, 0.7], nChecks: 5,
      shade: [[0, 'rgba(255,236,196,0.3)'], [0.12, 'rgba(255,236,196,0.06)'], [0.5, 'rgba(30,12,2,0.08)'], [1, 'rgba(26,10,2,0.5)']] });
    g.save(); a.clipBand(g, -Y_PLATE, -Y_PLATE - 3, -s, s); g.fillStyle = 'rgba(255,234,190,0.5)'; full(g); g.restore();

    // bracket sets, lower tiers first
    for (let i = -nSets; i <= nSets; i++) {
      const th = i * dth, r = L.rng('s13set' + i);
      a.at(g, th, 0, () => {
        drawGong(g, th, r, tex, ARM1_W, Y_ARM1, [-(ARM1_W - DOU_W) / 2 + 2, 0, (ARM1_W - DOU_W) / 2 - 2]);
        drawDou(g, th, r, tex, 0, Y_LU, LU_W, LU_B, LU_H, true);
        drawEnd(g, th, r, endTex, Y_ARM1);
        drawGong(g, th, r, tex, ARM2_W, Y_ARM2, [-(ARM2_W - DOU_W) / 2 + 2, 0, (ARM2_W - DOU_W) / 2 - 2]);
        for (const k of [-1, 0, 1]) drawDou(g, th, r, tex, k * ((ARM1_W - DOU_W) / 2 - 2), Y_DOU1, DOU_W, DOU_B, DOU_H, false);
        drawEnd(g, th, r, endTex, Y_ARM2);
      });
    }

    // the beam: its top edge IS the arc
    band(g, a, L.rng('s13beam'), tex, 0, BEAM, cutsFrom(-nSets - 2 + ((nSets + 1) % 3), 3), {
      ext: 12, sh: [10, 20, 24, 0.72], nChecks: 9,
      shade: [[0, 'rgba(255,238,200,0.34)'], [0.07, 'rgba(255,238,200,0.1)'], [0.3, 'rgba(255,238,200,0)'], [0.62, 'rgba(30,12,2,0.06)'], [0.9, 'rgba(26,10,2,0.36)'], [1, 'rgba(18,7,1,0.6)']] });
    // crisp arris: a dark line where it meets the paper, a pale chamfer just inside
    g.save(); a.clipBand(g, 0, -BEAM, -s, s);
    g.strokeStyle = 'rgba(255,240,206,0.62)'; g.lineWidth = 2.2; a.stroke(g, -3.2, -s, s);
    g.strokeStyle = 'rgba(40,18,5,0.9)'; g.lineWidth = 2.4; a.stroke(g, -0.6, -s, s);
    g.restore();

    // a row of pegs along the beam
    const pr = L.rng('s13pegs');
    const pegStep = PITCH / 6 / a.R;
    for (let k = -Math.ceil(s / pegStep); k <= Math.ceil(s / pegStep); k++) {
      a.at(g, (k + 0.5) * pegStep, -BEAM * 0.47 + pr.range(-1.2, 1.2), () => {
        const rad = pr.range(6.4, 8), hole = pr.chance(0.07);
        g.fillStyle = 'rgba(16,6,1,0.9)'; g.beginPath(); g.arc(1, 1.6, rad + 1.5, 0, L.TAU); g.fill();
        g.fillStyle = 'rgba(255,232,190,0.4)'; g.beginPath(); g.arc(1.6, 2.4, rad + 1.6, 0.1, 1.5); g.arc(1, 1.6, rad + 1.5, 1.5, 0.1, true); g.fill();
        if (hole) return;
        g.fillStyle = L.radial(g, -2, -2.4, 0.5, rad * 1.5, [[0, '#8f5d31'], [0.55, '#653d1e'], [1, '#3f2410']]);
        g.beginPath(); g.arc(0, 0, rad, 0, L.TAU); g.fill();
        g.strokeStyle = 'rgba(24,10,2,0.5)'; g.lineWidth = 0.8;
        g.beginPath(); g.arc(pr.range(-1, 1), pr.range(-1, 1), rad * 0.5, 0, L.TAU); g.stroke();
        g.strokeStyle = 'rgba(255,226,176,0.5)'; g.lineWidth = 1.1;
        g.beginPath(); g.arc(0, 0, rad - 0.8, Math.PI * 1.02, Math.PI * 1.62); g.stroke();
      });
    }

    // upper row of blocks: they stand proud of the beam and grip it with their ears
    for (let i = -nSets; i <= nSets; i++) {
      const th = i * dth, r = L.rng('s13top' + i);
      a.at(g, th, 0, () => {
        for (const k of [-1, 0, 1]) drawDou(g, th, r, tex, k * ((ARM2_W - DOU_W) / 2 - 2), Y_DOU2, DOU_W, DOU_B, DOU_H, false);
      });
    }

    // light over the whole assembly: warm key from the upper left, falling away to the right and into the depth
    g.save(); a.clipBelow(g, 0);
    g.globalCompositeOperation = 'soft-light';
    g.fillStyle = L.radial(g, 640, a.crestY + 60, 60, 1500, [[0, 'rgba(255,226,170,0.42)'], [0.45, 'rgba(255,226,170,0.1)'], [0.7, 'rgba(20,8,0,0.12)'], [1, 'rgba(20,8,0,0.5)']]);
    full(g);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 760, a.R - 260, [[0, 'rgba(60,34,14,1)'], [0.5, 'rgba(150,118,90,1)'], [1, 'rgba(255,255,255,1)']]);
    full(g);
    g.restore();
  });
}

// ───────────────────────── the paper ─────────────────────────
function buildPaper(env) {
  const a = env.arc;
  return L.makeLayer(PAD, (g) => {
    const PH = 1160;   // the paper only ever shows above the arc
    g.fillStyle = '#cdb98f'; g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    g.drawImage(L.paperTex(W + PAD * 2, PH, { base: PAPER, seed: 's13paper', tone: '#8d6a3a', fiber: 0.6, stain: 0.62, grain: 0.2 }), -PAD, -PAD);
    // light pools on the sheet toward the upper left; the far corners fall off a little
    g.fillStyle = L.radial(g, 760, 200, 100, 1500, [[0, 'rgba(255,248,226,0.2)'], [0.5, 'rgba(255,248,226,0)'], [1, 'rgba(120,88,44,0.2)']]);
    g.fillRect(-PAD, -PAD, W + PAD * 2, PH);

    // the faintest ghost of a measured drawing: the eave that this beam would carry, set out concentric with it
    const s = a.span(PAD + 120), ink = '#70502c';
    const rule = (dr, alpha, width, seed) => L.sketchLine(g, L.arcPts(a, dr, -s, s, 96), { width, color: ink, alpha, wobble: 0.7, seed });
    rule(40, 0.2, 1.1, 1); rule(104, 0.2, 1.1, 2); rule(112, 0.14, 0.9, 3); rule(168, 0.2, 1.1, 4); rule(180, 0.16, 1, 5);
    g.strokeStyle = L.rgba(ink, 0.2); g.lineWidth = 1.1;
    const dR = (2 * U) / a.R, nR = Math.ceil(s / dR);
    const jr = L.rng('s13ghost');
    for (let k = -nR; k <= nR; k++) {
      // rafter ends (round) and, above them, flying-rafter ends (square)
      a.at(g, (k + 0.5) * dR, 72, () => {
        g.beginPath(); g.arc(jr.range(-0.6, 0.6), jr.range(-0.6, 0.6), 0.6 * U, 0, L.TAU); g.stroke();
        g.strokeRect(-0.42 * U + jr.range(-0.6, 0.6), -70 - 0.42 * U, 0.84 * U, 0.84 * U);
      });
    }
    // centre lines of the bracket sets, dash-dot, the way a survey sheet marks them
    g.save(); g.setLineDash([26, 7, 3, 7]); g.strokeStyle = L.rgba(ink, 0.24); g.lineWidth = 1;
    const dth = PITCH / a.R, nS = Math.ceil(s / dth);
    for (let i = -nS; i <= nS; i++) { const p0 = a.pt(i * dth, 6), p1 = a.pt(i * dth, 250); g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke(); }
    g.restore();
  });
}

export default {
  name: '木构斗拱',
  tone: 'dark',
  init(env) {
    S = { wood: buildWood(env), paper: buildPaper(env) };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.006, 0.006, p), zoom = L.lerp(1.0, 1.03, p);
    L.blit(ctx, env, S.paper, { rot: rot * 0.35, zoom: 1 + (zoom - 1) * 0.4 });
    L.blit(ctx, env, S.wood, { rot, zoom });
    // a patch of raking light glides along the beam
    L.cam(ctx, env, { zoom }, () => {
      ctx.save(); a.clipBelow(ctx, 0);
      const q = a.pt(L.lerp(-0.13, 0.05, p), -70);
      L.glow(ctx, q.x, q.y, 560, '#ffe0aa', 0.34, 'overlay');
      ctx.restore();
    });
  },
};
