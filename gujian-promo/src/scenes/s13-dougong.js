// s13 — 木构斗拱. Bare, unpainted timber bracket sets laid against old paper.
// The arc is the top edge of a curved eave tie-beam (挑檐枋); a row of pegs runs along it, and under it hangs a row of
// bracket sets (攒) seen in true front elevation: 栌斗 → 泥道拱 + 散斗 → 慢拱 + 散斗 → 枋, with the end-grain heads of the
// projecting arms (华拱) stacked on the centre line. Between the sets: the deep dark gaps (拱眼).
// Everything is laid out in 分° (fen, the modular unit of the bracket system) and mapped through polar coordinates so
// every member is concentric with the arc — a `rot` about the arc centre slides the row along without bending anything.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 180;
const U = 5.2;                 // px per 分°
const B = 17;                  // depth of the beam on the arc (分°)
const PITCH = 100;             // spacing of the bracket sets along the arc (分°)
// vertical layout, 分° measured down from the arc (材高 15, 栔 6, 小斗 10 = 耳4 平2 欹4, 栌斗 20 = 耳8 平4 欹8)
const V_D2 = B - 4;            // top of the upper small blocks (their ears grip the beam)
const V_G2 = B + 6;            // top of the long arm 慢拱
const V_D1 = B + 17;           // top of the lower small blocks
const V_G1 = B + 27;           // top of the short arm 泥道拱
const V_LU = B + 34;           // top of the cap block 栌斗
const V_BOT = B + 54;          // underside of the cap block = top of the plate 普拍枋
const LIGHT = 45;              // bumpLight angle that lights from the upper left (see note in the final report)
let S = null;

// ───────────────────────── timber texture ─────────────────────────
const RAMPS = [
  [[0, '#281305'], [0.22, '#5a3518'], [0.45, '#96602f'], [0.62, '#b07a45'], [0.8, '#d09a5a'], [1, '#e9bb78']],   // golden
  [[0, '#261104'], [0.22, '#552f14'], [0.45, '#8f5629'], [0.62, '#a96d3b'], [0.8, '#c98c50'], [1, '#e2ad6c']],   // redder
  [[0, '#2b1607'], [0.22, '#5e3a1c'], [0.45, '#9c6a36'], [0.62, '#b8854d'], [0.8, '#d7a565'], [1, '#eec585']],   // paler, drier
  [[0, '#221004'], [0.22, '#4e2c12'], [0.45, '#855326'], [0.62, '#9f6835'], [0.8, '#bf8448'], [1, '#d9a463']],   // darker heartwood
];
function lutOf(stops) {
  const f = L.makeRamp(stops); const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) { const c = f(i / 255); lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2]; }
  return lut;
}
/** long-grain timber value at (s along the grain, t across it), px. Growth rings → sharp dark latewood lines. */
function woodVal(nz, s, t, ring, wave) {
  const wv = nz.fbm(s / 640, t / (ring * 8), 3) * wave + nz.n2(s / 170 + 40.5, t / (ring * 3)) * 0.2;
  const q = t / ring + wv;
  const f = q - Math.floor(q);
  const late = f < 0.82 ? Math.pow(f / 0.82, 3.2) : 1 - (f - 0.82) / 0.18;
  const fib = nz.n2(s / 64, t / 1.5) * 0.6 + nz.n2(s / 22 + 9.7, t / 0.9 + 3.1) * 0.4;
  const bl = nz.fbm(s / 330 + 5.3, t / 120 - 3.7, 2);
  return 0.71 - 0.52 * late + 0.13 * fib + 0.17 * bl;
}
/** per-pixel timber image. map(x, y, out) may remap canvas px → (s, t) and return false to leave a pixel empty. */
function woodImage(w, h, o, map) {
  const res = o.res || 1;
  const cw = Math.max(2, Math.round(w * res)), ch = Math.max(2, Math.round(h * res));
  const nz = L.makeNoise(o.seed), lut = lutOf(o.ramp);
  const img = new ImageData(cw, ch); const d = img.data; const st = [0, 0];
  let k = 0;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++, k += 4) {
    let s = x / res, t = y / res;
    if (map) { if (!map(s, t, st)) continue; s = st[0]; t = st[1]; }
    const li = (L.clamp(woodVal(nz, s + (o.os || 0), t + (o.ot || 0), o.ring, o.wave)) * 255) | 0;
    d[k] = lut[li * 3]; d[k + 1] = lut[li * 3 + 1]; d[k + 2] = lut[li * 3 + 2]; d[k + 3] = 255;
  }
  const small = L.makeCanvas(cw, ch); small.getContext('2d').putImageData(img, 0, 0);
  if (res === 1) return small;
  const out = L.makeCanvas(w, h); const g = out.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(small, 0, 0, w, h);
  return out;
}
/** give a timber image its surface: pores and loose fibres along the grain, then relief so the grain catches the light */
function finishTimber(c, seed, relief = 2.4) {
  const g = c.getContext('2d'), w = c.width, h = c.height, r = L.rng('s13fin' + seed);
  g.lineCap = 'round';
  for (let i = 0, n = (w * h) / 120; i < n; i++) {
    const x = r() * w, y = r() * h, len = r.range(5, 36);
    g.strokeStyle = r.chance(0.72) ? `rgba(50,22,5,${r.range(0.12, 0.42)})` : `rgba(255,226,170,${r.range(0.08, 0.24)})`;
    g.lineWidth = r.range(0.5, 1.1);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y + r.range(-0.8, 0.8)); g.stroke();
  }
  const bump = L.bumpLight(c, { angle: LIGHT, strength: relief, res: 1 });
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.6; g.drawImage(bump, 0, 0);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  return c;
}
/** timber whose grain follows the arc, covering depths v0..v1 px below it. Returns {c, x, y} (canvas + frame position). */
function polarWood(env, v0, v1, yTop, yBot, o) {
  const a = env.arc, x0 = -PAD, w = W + PAD * 2, h = Math.ceil(yBot - yTop);
  const cxp = a.cx - x0, cyp = a.cy - yTop, R = a.R, m = 6 / (o.res || 1);
  const c = woodImage(w, h, o, (x, y, st) => {
    const dx = x - cxp, dy = cyp - y; const dep = R - Math.sqrt(dx * dx + dy * dy);
    if (dep < v0 - m || dep > v1 + m) return false;
    st[0] = Math.atan2(dx, dy) * R; st[1] = dep; return true;
  });
  return { c, x: x0, y: yTop };
}

// ───────────────────────── geometry (分° → frame) ─────────────────────────
function quad(p0, c, p1, n) {
  const out = [];
  for (let i = 1; i <= n; i++) { const t = i / n, k = 1 - t; out.push([k * k * p0[0] + 2 * k * t * c[0] + t * t * p1[0], k * k * p0[1] + 2 * k * t * c[1] + t * t * p1[1]]); }
  return out;
}
/** add a polyline given in 分° to the current path, subdividing so straight runs follow the arc */
function trace(g, P, pts, close = true) {
  const n = pts.length, m = close ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const p0 = pts[i], p1 = pts[(i + 1) % n];
    const k = Math.max(1, Math.ceil(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 5));
    for (let j = 0; j < k; j++) {
      const q = P(L.lerp(p0[0], p1[0], j / k), L.lerp(p0[1], p1[1], j / k));
      if (i === 0 && j === 0) g.moveTo(q.x, q.y); else g.lineTo(q.x, q.y);
    }
  }
  if (close) g.closePath(); else { const q = P(pts[n - 1][0], pts[n - 1][1]); g.lineTo(q.x, q.y); }
}
/** bow arm 拱: ends keep a 6分° vertical face, the lower corner is cut back in four straight facets (卷杀) */
function gongShape(half, top, kx) {
  const b = top + 15, e = top + 6;
  const Rk = quad([half, e], [half, b], [half - kx, b], 4);
  const Lk = quad([-half + kx, b], [-half, b], [-half, e], 4);
  return {
    pts: [[-half, top], [half, top], [half, e], ...Rk, [-half + kx, b], ...Lk],
    top: [[-half, top], [half, top]], left: [[-half, e], [-half, top]], right: [[half, top], [half, e]],
    bottom: [[half, e], ...Rk, [-half + kx, b], ...Lk],
  };
}
/** bearing block 斗 / 升: square upper part (耳 + 平), concave tapered foot (欹) */
function douShape(cu, top, hw, hUp, hQi, inset) {
  const m = top + hUp, b = m + hQi;
  const Rq = quad([cu + hw, m], [cu + hw - inset * 0.9, m + hQi * 0.3], [cu + hw - inset, b], 4);
  const Lq = quad([cu - hw + inset, b], [cu - hw + inset * 0.9, m + hQi * 0.3], [cu - hw, m], 4);
  return {
    pts: [[cu - hw, top], [cu + hw, top], [cu + hw, m], ...Rq, [cu - hw + inset, b], ...Lq],
    top: [[cu - hw, top], [cu + hw, top]], left: [[cu - hw + inset, b], ...Lq, [cu - hw, top]], right: [[cu + hw, top], [cu + hw, m], ...Rq],
    bottom: [[cu + hw - inset, b], [cu - hw + inset, b]],
  };
}
const headShape = (top) => ({
  pts: [[-5, top], [5, top], [5, top + 15], [-5, top + 15]],
  top: [[-5, top], [5, top]], left: [[-5, top + 15], [-5, top]], right: [[5, top], [5, top + 15]], bottom: [[5, top + 15], [-5, top + 15]],
});

// ───────────────────────── painting one member ─────────────────────────
const SH_DOU = { dx: 6, dy: 12, blur: 9, a: 0.74 };
const SH_HEAD = { dx: 13, dy: 26, blur: 15, a: 0.82 };
const SH_ARM = { dx: 5, dy: 10, blur: 12, a: 0.6 };

function edges(g, P, sh) {
  g.lineCap = 'butt'; g.lineJoin = 'round';
  const run = (pts, style, lw) => { g.strokeStyle = style; g.lineWidth = lw; g.beginPath(); trace(g, P, pts, false); g.stroke(); };
  run(sh.bottom, 'rgba(20,7,0,0.66)', 5);
  run(sh.right, 'rgba(20,7,0,0.46)', 4.4);
  run(sh.left, 'rgba(255,230,184,0.34)', 3.2);
  run(sh.top, 'rgba(255,236,196,0.7)', 3.6);
}
/** fill a member: cast shadow, its own piece of timber, tone, form shading, lit/dark edges, dark seam */
function member(g, a, P, th, sh, o) {
  const { uc, vc, w, h, tile, r, shadow, shade, extra, tone = 0 } = o;
  g.save();
  if (shadow) { g.shadowColor = `rgba(10,4,0,${shadow.a})`; g.shadowBlur = shadow.blur; g.shadowOffsetX = shadow.dx; g.shadowOffsetY = shadow.dy; }
  g.fillStyle = '#8f5d30'; g.beginPath(); trace(g, P, sh.pts); g.fill();
  g.restore();
  g.save(); g.beginPath(); trace(g, P, sh.pts); g.clip();
  a.at(g, th(uc), -vc * U, () => {
    if (tile) {
      const sw = Math.min(tile.width, w + 10), shh = Math.min(tile.height, h + 22);
      const ox = r.range(0, tile.width - sw), oy = r.range(0, tile.height - shh);
      g.save(); g.scale(r.chance(0.5) ? -1 : 1, 1);
      g.drawImage(tile, ox, oy, sw, shh, -sw / 2, -shh / 2, sw, shh);
      g.restore();
    }
    if (tone > 0) { g.fillStyle = `rgba(255,214,150,${tone})`; g.globalCompositeOperation = 'soft-light'; g.fillRect(-w, -h, w * 2, h * 2); }
    else if (tone < 0) { g.fillStyle = `rgba(52,22,4,${-tone})`; g.fillRect(-w, -h, w * 2, h * 2); }
    g.globalCompositeOperation = 'source-over';
    if (shade) shade(g, w, h);
  });
  if (extra) extra(g, P);
  edges(g, P, sh);
  g.restore();
  g.save(); g.strokeStyle = 'rgba(18,7,1,0.66)'; g.lineWidth = 1.1; g.beginPath(); trace(g, P, sh.pts); g.stroke(); g.restore();
}
const shadeArm = (kx) => (g, w, h) => {
  // a squared timber lit from the upper left: top a little brighter, belly falling into shade
  g.fillStyle = L.linear(g, 0, -h / 2, 0, h / 2 + 8, [[0, 'rgba(255,226,170,0.16)'], [0.3, 'rgba(255,226,170,0)'], [0.5, 'rgba(24,9,0,0)'], [1, 'rgba(24,9,0,0.5)']]);
  g.fillRect(-w, -h, w * 2, h * 2.4);
  g.fillStyle = L.linear(g, -w / 2, 0, w / 2, 0, [[0, 'rgba(255,226,170,0.1)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(24,9,0,0.24)']]);
  g.fillRect(-w, -h, w * 2, h * 2.4);
  // the facetted cut-backs at both ends face downward → darker
  for (const sgn of [-1, 1]) {
    const x0 = sgn * (w / 2 - kx * U * 1.25), x1 = sgn * (w / 2 + 4);
    g.fillStyle = L.linear(g, x0, -h * 0.05, x1, h * 0.55, [[0, 'rgba(24,9,0,0)'], [1, sgn > 0 ? 'rgba(24,9,0,0.66)' : 'rgba(24,9,0,0.46)']]);
    g.fillRect(Math.min(x0, x1), -h / 2 + 6 * U - 6, Math.abs(x1 - x0), h);
  }
};
/** 栱眼: between the blocks the upper arris of an arm is scooped away; the scoop tilts toward the sky and catches light */
const scoops = (top, zones) => (g, P) => {
  for (const [x0, x1] of zones) {
    const d = 2.7, lower = [[x0, top], ...quad([x0, top], [x0 + 0.4, top + d], [x0 + 3.4, top + d], 4), [x1 - 3.4, top + d], ...quad([x1 - 3.4, top + d], [x1 - 0.4, top + d], [x1, top], 4)];
    g.fillStyle = 'rgba(255,232,186,0.2)'; g.beginPath(); trace(g, P, lower); g.fill();
    g.strokeStyle = 'rgba(30,12,2,0.5)'; g.lineWidth = 1.2; g.beginPath(); trace(g, P, lower, false); g.stroke();
    g.strokeStyle = 'rgba(255,236,196,0.3)'; g.lineWidth = 1; g.beginPath(); trace(g, P, lower.map(([u, v]) => [u, v + 0.32]), false); g.stroke();
  }
};
const shadeDou = (upPx) => (g, w, h) => {
  const yM = -h / 2 + upPx;
  g.fillStyle = L.linear(g, 0, -h / 2, 0, yM, [[0, 'rgba(255,230,180,0.2)'], [1, 'rgba(255,230,180,0.02)']]);
  g.fillRect(-w, -h, w * 2, h / 2 + upPx);
  // the concave foot tucks under the square top: darkest right below the lip
  g.fillStyle = L.linear(g, 0, yM, 0, h / 2 + 2, [[0, 'rgba(18,7,0,0.72)'], [0.45, 'rgba(18,7,0,0.46)'], [1, 'rgba(18,7,0,0.26)']]);
  g.fillRect(-w, yM, w * 2, h);
  g.fillStyle = 'rgba(255,236,196,0.55)'; g.fillRect(-w, yM - 1.8, w * 2, 1.8);
  g.fillStyle = L.linear(g, -w / 2, 0, w / 2, 0, [[0, 'rgba(255,230,180,0.12)'], [0.45, 'rgba(0,0,0,0)'], [1, 'rgba(24,9,0,0.3)']]);
  g.fillRect(-w, -h, w * 2, h * 2);
};
/** end grain of a squared timber: growth rings round an off-centre pith, rays, a drying check */
function endGrain(g, w, h, r, seed) {
  const nz = L.makeNoise('s13eg' + seed);
  g.fillStyle = L.linear(g, 0, -h / 2, 0, h / 2, [[0, '#bd8548'], [1, '#8f5a2a']]); g.fillRect(-w, -h, w * 2, h * 2);
  const px = r.range(-0.7, 0.7) * w, py = r.range(0.25, 0.95) * h * (r.chance(0.75) ? 1 : -1);
  const far = Math.hypot(Math.abs(px) + w / 2, Math.abs(py) + h / 2) + 6;
  const step = r.range(4.6, 6.2);
  g.lineCap = 'round';
  for (let k = 1, rad = step * 0.6; rad < far; k++, rad += step * (0.75 + 0.5 * r())) {
    const wob = (ang) => rad * (1 + 0.035 * nz.n2(ang * 1.6, k * 0.21)) + 0.9 * nz.n2(ang * 7, k * 1.3);
    g.beginPath();
    for (let i = 0; i <= 72; i++) { const ang = (i / 72) * L.TAU, q = wob(ang); const x = px + Math.cos(ang) * q, y = py + Math.sin(ang) * q; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.strokeStyle = `rgba(74,38,12,${r.range(0.55, 0.9)})`; g.lineWidth = r.range(1.2, 2.3); g.stroke();
    g.beginPath();
    for (let i = 0; i <= 72; i++) { const ang = (i / 72) * L.TAU, q = wob(ang) + step * 0.45; const x = px + Math.cos(ang) * q, y = py + Math.sin(ang) * q; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.strokeStyle = 'rgba(246,206,146,0.34)'; g.lineWidth = 1.6; g.stroke();
  }
  // medullary rays
  for (let i = 0; i < 46; i++) {
    const ang = r() * L.TAU, r0 = r.range(4, far * 0.6), r1 = r0 + r.range(10, 40);
    g.strokeStyle = r.chance(0.5) ? 'rgba(60,30,8,0.16)' : 'rgba(250,214,160,0.16)'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(px + Math.cos(ang) * r0, py + Math.sin(ang) * r0); g.lineTo(px + Math.cos(ang) * r1, py + Math.sin(ang) * r1); g.stroke();
  }
  // a drying check opening from the pith
  const ca = Math.atan2(-py, -px) + r.range(-0.35, 0.35);
  g.strokeStyle = 'rgba(22,8,1,0.85)'; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(px + Math.cos(ca) * 3, py + Math.sin(ca) * 3);
  let cl = 3; const cmax = r.range(0.5, 0.85) * far;
  while (cl < cmax) { cl += 6; const j = nz.n2(cl * 0.08, 7.7) * 2.2; g.lineTo(px + Math.cos(ca) * cl - Math.sin(ca) * j, py + Math.sin(ca) * cl + Math.cos(ca) * j); }
  g.stroke();
}
/** head of a projecting arm 华拱 seen end-on: end-grain face on top, then the four facets of its cut-back underside */
const shadeHead = (seed) => (g, w, h) => {
  const r = L.rng('s13head' + seed);
  endGrain(g, w, h, r, seed);
  const y0 = -h / 2 + 6 * U, fh = (9 * U) / 4;
  for (let k = 0; k < 4; k++) {
    g.fillStyle = `rgba(20,8,0,${0.24 + 0.18 * k})`; g.fillRect(-w, y0 + k * fh, w * 2, fh + (k === 3 ? 20 : 0));
    g.fillStyle = 'rgba(255,232,190,0.3)'; g.fillRect(-w, y0 + k * fh - 0.6, w * 2, 1.2);
  }
  g.fillStyle = L.linear(g, -w / 2, 0, w / 2, 0, [[0, 'rgba(255,236,196,0.18)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(24,9,0,0.32)']]);
  g.fillRect(-w, -h, w * 2, h * 2);
  g.fillStyle = L.linear(g, 0, -h / 2, 0, -h / 2 + 6 * U, [[0, 'rgba(255,240,206,0.26)'], [1, 'rgba(255,240,206,0)']]);
  g.fillRect(-w, -h, w * 2, h / 2 + 6 * U);
};

// ───────────────────────── the timber layer ─────────────────────────
function buildWood(env) {
  const a = env.arc, R = a.R;
  const Rm = R - 36 * U;                       // radius at which 分° are true to scale along the arc
  const pitch = (PITCH * U) / Rm;              // angular spacing of the sets
  const sp = a.span(PAD + 160);
  const NS = Math.ceil(sp / pitch) + 1;

  // individual pieces of timber for the bracket members
  const tiles = [];
  for (let i = 0; i < 7; i++) tiles.push(finishTimber(woodImage(512, 128, { seed: 's13tile' + i, ramp: RAMPS[i % RAMPS.length], ring: [8.5, 11, 7, 9.5, 12, 8, 10][i], wave: [1.3, 2.1, 0.9, 1.7, 1.2, 2.4, 1.5][i] }), i));
  const beam = polarWood(env, -4, B * U, a.crestY - 8, a.yAt(-PAD, -B * U) + 10, { seed: 's13beam', ramp: RAMPS[1], ring: 9, wave: 1.5 });
  const beamBump = L.bumpLight(beam.c, { angle: LIGHT, strength: 2.4, res: 1 });
  const low = polarWood(env, V_BOT * U, 9999, a.crestY + V_BOT * U - 8, H + PAD * 0.45, { seed: 's13low', ramp: RAMPS[3], ring: 11, wave: 1.8, res: 0.6 });
  const panel = L.polarNoiseLayer(env, PAD, { seed: 's13panel', scale: 26, sx: 0.55, sy: 14, octaves: 3, contrast: 1.5, res: 0.25, ramp: [[0, '#050201'], [0.55, '#120904'], [1, '#27150a']] });

  return L.makeLayer(PAD, (g) => {
    const full = () => g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    // 0) the recess behind the brackets (拱眼): old boards deep in shadow
    g.save(); a.clipBelow(g, 3);
    g.fillStyle = '#0c0603'; full();
    g.drawImage(panel, -PAD, -PAD);
    g.fillStyle = L.radial(g, a.cx, a.cy, R - V_BOT * U, R - B * U, [[0, 'rgba(110,60,22,0.2)'], [0.35, 'rgba(60,30,10,0.03)'], [1, 'rgba(0,0,0,0.7)']]);
    full();
    g.restore();

    // 1) plate 普拍枋 and architrave 阑额 carrying the row
    {
      const d0 = V_BOT * U, d1 = d0 + 11 * U, d2 = d1 + 1.5 * U, D = 720;
      const t = (d) => 1 - (d - d0) / (D - d0);
      g.save(); a.clipBelow(g, -d0);
      g.drawImage(low.c, low.x, low.y);
      g.fillStyle = L.radial(g, a.cx, a.cy, R - D, R - d0, [
        [0, 'rgba(10,4,0,0.85)'], [t(d2 + 150), 'rgba(14,6,0,0.55)'], [t(d2 + 30), 'rgba(18,7,0,0.26)'], [t(d2 + 3), 'rgba(255,224,170,0.14)'], [t(d2 + 0.5), 'rgba(255,224,170,0.3)'],
        [t(d2), 'rgba(6,2,0,0.94)'], [t(d1), 'rgba(6,2,0,0.94)'], [t(d1 - 0.5), 'rgba(18,7,0,0.55)'], [t(d1 - 16), 'rgba(18,7,0,0.2)'],
        [t(d0 + 7), 'rgba(18,7,0,0.06)'], [t(d0 + 2.5), 'rgba(255,232,186,0.36)'], [1, 'rgba(255,238,200,0.5)']]);
      full();
      g.restore();
    }

    // 2) bracket sets, far → near
    const sets = [];
    for (let i = -NS; i <= NS; i++) {
      const r = L.rng('s13set' + i);
      const P = (u, v) => a.pt(i * pitch + (u * U) / Rm, -v * U);
      const T = (u) => i * pitch + (u * U) / Rm;
      const pick = () => tiles[r.int(0, tiles.length - 1)];
      const tone = (bias = 0) => r.range(-0.22, 0.16) + bias;
      const underside = (sh, d) => {
        const lo = sh.bottom.map(([u, v]) => [u, v + d]).reverse();
        g.fillStyle = '#371c0b'; g.beginPath(); trace(g, P, [...sh.bottom, ...lo]); g.fill();
      };
      // short arm 泥道拱
      const g1 = gongShape(31, V_G1, 14);
      underside(g1, 1.5);
      member(g, a, P, T, g1, { uc: 0, vc: V_G1 + 7.5, w: 62 * U, h: 15 * U, tile: pick(), r, tone: tone(-0.05), shadow: SH_ARM, shade: shadeArm(14), extra: scoops(V_G1, [[-14.2, -8.3], [8.3, 14.2]]) });
      // cap block 栌斗
      const lu = douShape(0, V_LU, 16, 12, 8, 4);
      member(g, a, P, T, lu, { uc: 0, vc: V_LU + 10, w: 32 * U, h: 20 * U, tile: pick(), r, tone: tone(-0.04) * 0.7, shadow: SH_DOU, shade: shadeDou(12 * U) });
      // first projecting arm, end-on
      member(g, a, P, T, headShape(V_G1), { uc: 0, vc: V_G1 + 7.5, w: 10 * U, h: 15 * U, tile: null, r, shadow: SH_HEAD, shade: shadeHead(i + 'a') });
      // long arm 慢拱
      const g2 = gongShape(46, V_G2, 12);
      underside(g2, 1.5);
      member(g, a, P, T, g2, { uc: 0, vc: V_G2 + 7.5, w: 92 * U, h: 15 * U, tile: pick(), r, tone: tone(), shadow: SH_ARM, shade: shadeArm(12), extra: scoops(V_G2, [[-29.2, -8.3], [8.3, 29.2]]) });
      // lower small blocks: two 散斗 on the arm ends, then the centre block riding on the projecting arm
      for (const cu of [-22.5, 22.5, 0]) {
        const d = douShape(cu, V_D1, 8, 6, 4, 2);
        member(g, a, P, T, d, { uc: cu, vc: V_D1 + 5, w: 16 * U, h: 10 * U, tile: pick(), r, tone: tone(), shadow: SH_DOU, shade: shadeDou(6 * U) });
      }
      // second projecting arm
      member(g, a, P, T, headShape(V_G2), { uc: 0, vc: V_G2 + 7.5, w: 10 * U, h: 15 * U, tile: null, r, shadow: SH_HEAD, shade: shadeHead(i + 'b') });
      sets.push({ r, P, T, pick, tone });
    }

    // 3) the beam on the arc (挑檐枋): grain follows the curve
    {
      const bd = B * U;
      // underside lip, seen from slightly below
      g.fillStyle = '#371c0b'; a.pathBand(g, -bd + 1, -bd - 8, -sp, sp); g.fill();
      g.save(); a.clipBand(g, 3, -bd, -sp, sp);
      g.drawImage(beam.c, beam.x, beam.y);
      // pores and fibres following the curve
      const rf = L.rng('s13beamfib');
      for (let k = 0; k < 2600; k++) {
        const t0 = rf.range(-sp, sp), dr = -rf.range(0, bd);
        g.strokeStyle = rf.chance(0.72) ? `rgba(50,22,5,${rf.range(0.12, 0.4)})` : `rgba(255,226,170,${rf.range(0.08, 0.22)})`;
        g.lineWidth = rf.range(0.5, 1.1); g.beginPath(); a.trace(g, dr, t0, t0 + rf.range(6, 40) / R); g.stroke();
      }
      g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.6; g.drawImage(beamBump, beam.x, beam.y);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      // lengths of timber joined over the bracket centres: each length its own tone
      const joints = [];
      for (let k = -NS - 1; k <= NS + 1; k++) if (((k % 3) + 3) % 3 === 2) joints.push(k * pitch);
      const rj = L.rng('s13joint');
      let prev = -sp - 0.1;
      for (const j of [...joints, sp + 0.1]) {
        const tn = rj.range(-0.2, 0.12);
        g.save(); a.clipBand(g, 6, -bd - 2, prev, j);
        if (tn > 0) { g.globalCompositeOperation = 'soft-light'; g.fillStyle = `rgba(255,214,150,${tn})`; } else g.fillStyle = `rgba(52,22,4,${-tn})`;
        full(); g.restore();
        prev = j;
      }
      // form: lit upper arris, body, shaded belly
      g.fillStyle = L.radial(g, a.cx, a.cy, R - bd, R, [[0, 'rgba(20,8,0,0.56)'], [0.1, 'rgba(20,8,0,0.24)'], [0.42, 'rgba(0,0,0,0)'], [0.82, 'rgba(255,232,186,0)'], [0.945, 'rgba(255,232,186,0.16)'], [0.96, 'rgba(255,238,200,0.5)'], [1, 'rgba(255,238,200,0.34)']]);
      full();
      // drying checks along the grain
      const rc = L.rng('s13check');
      for (let k = 0; k < 26; k++) {
        const t0 = rc.range(-sp, sp), len = rc.range(60, 300) / R, dr = -rc.range(10, bd - 8);
        g.strokeStyle = `rgba(26,10,2,${rc.range(0.35, 0.7)})`; g.lineWidth = rc.range(0.8, 1.7); g.beginPath(); a.trace(g, dr, t0, t0 + len); g.stroke();
        g.strokeStyle = 'rgba(255,230,186,0.22)'; g.lineWidth = 1; g.beginPath(); a.trace(g, dr - 1.4, t0 + len * 0.1, t0 + len * 0.9); g.stroke();
      }
      // the joints
      for (const j of joints) {
        const p0 = a.pt(j, 4), p1 = a.pt(j, -bd - 2);
        g.strokeStyle = 'rgba(16,6,0,0.88)'; g.lineWidth = 2; g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke();
        const q0 = a.pt(j + 2.2 / R, 4), q1 = a.pt(j + 2.2 / R, -bd - 2);
        g.strokeStyle = 'rgba(255,234,194,0.3)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(q0.x, q0.y); g.lineTo(q1.x, q1.y); g.stroke();
      }
      g.restore();
      // a row of wooden pegs 木销 pinning the beam: little discs of end grain, proud of the surface
      const rp = L.rng('s13peg');
      const stepA = pitch / 6;
      for (let k = Math.floor(-sp / stepA); k * stepA <= sp; k++) {
        const tp = (k + 0.5) * stepA + rp.range(-1.5, 1.5) / R, dp = -(6.6 * U + rp.range(-1.6, 1.6)), pr = rp.range(7.4, 8.8);
        a.at(g, tp, dp, () => {
          g.save(); g.rotate(-tp);     // keep the light direction fixed on the page
          g.fillStyle = 'rgba(14,5,0,0.6)'; g.beginPath(); g.ellipse(3, 4.2, pr + 1.4, pr + 0.8, 0, 0, L.TAU); g.fill();
          g.fillStyle = 'rgba(20,8,0,0.92)'; g.beginPath(); g.arc(0, 0, pr + 1.3, 0, L.TAU); g.fill();
          const tn = rp.range(-0.12, 0.14);
          g.fillStyle = L.radial(g, -pr * 0.35, -pr * 0.4, 0.5, pr * 1.25, [[0, L.shade('#d9a569', tn)], [0.55, L.shade('#a8713c', tn)], [1, L.shade('#673f1c', tn)]]);
          g.beginPath(); g.arc(0, 0, pr, 0, L.TAU); g.fill();
          g.strokeStyle = 'rgba(70,38,12,0.6)'; g.lineWidth = 0.9;
          const ex = rp.range(-2, 2), ey = rp.range(-2, 2);
          for (const q of [0.3, 0.58, 0.82]) { g.beginPath(); g.arc(ex * (1 - q), ey * (1 - q), pr * q, 0, L.TAU); g.stroke(); }
          g.strokeStyle = 'rgba(255,240,208,0.75)'; g.lineWidth = 1.3; g.beginPath(); g.arc(0, 0, pr - 0.8, Math.PI * 0.95, Math.PI * 1.65); g.stroke();
          g.restore();
        });
      }
    }

    // 4) upper small blocks: their ears lap over the beam and hold it
    for (const s of sets) {
      for (const cu of [-37.5, 37.5, 0]) {
        const d = douShape(cu, V_D2, 8, 6, 4, 2);
        member(g, a, s.P, s.T, d, { uc: cu, vc: V_D2 + 5, w: 16 * U, h: 10 * U, tile: s.pick(), r: s.r, tone: s.tone(0.03), shadow: SH_DOU, shade: shadeDou(6 * U) });
      }
    }

    // 5) age: uneven patina, dust in the pores, a few bright nicks
    g.save(); a.clipBelow(g, 3);
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.5;
    g.drawImage(L.noiseLayer(PAD, { seed: 's13patina', scale: 300, octaves: 4, warp: 0.5, res: 0.2, ramp: [[0, '#8a6240'], [0.5, '#f6e8d6'], [1, '#ffffff']] }), -PAD, -PAD);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    L.speckle(g, { seed: 's13dust', count: 2600, x: -PAD, y: a.crestY - 10, w: W + PAD * 2, h: H - a.crestY + 60, rMin: 0.4, rMax: 1.5, colors: ['#241004', '#3a1c08', '#f3d6a4'], alpha: [0.1, 0.5] });
    g.restore();
  });
}

// ───────────────────────── the paper ─────────────────────────
function buildPaper(env) {
  const a = env.arc;
  const hh = Math.ceil(a.yAt(-PAD) + PAD + 60);
  const tex = L.paperTex(W + PAD * 2, hh, { base: '#e6d7b8', seed: 513, tone: '#8a683a', fiber: 0.7, stain: 0.62, grain: 0.22 });
  return L.makeLayer(PAD, (g) => {
    g.drawImage(tex, -PAD, -PAD);
    // laid lines of a hand-made sheet (帘纹), and the wider chain lines across them
    const r = L.rng('s13laid');
    g.lineWidth = 1;
    for (let y = -PAD; y < hh - PAD; y += 3.2) { g.strokeStyle = `rgba(110,82,44,${r.range(0.015, 0.055)})`; g.beginPath(); g.moveTo(-PAD, y + 0.5); g.lineTo(W + PAD, y + 0.5 + r.range(-0.6, 0.6)); g.stroke(); }
    for (let x = -PAD + 30; x < W + PAD; x += 118) { g.strokeStyle = 'rgba(255,250,236,0.1)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, -PAD); g.lineTo(x + r.range(-3, 3), hh - PAD); g.stroke(); }
    // foxing: a scatter of small rusty spots
    L.speckle(g, { seed: 's13fox', count: 260, x: -PAD, y: -PAD, w: W + PAD * 2, h: hh, rMin: 0.8, rMax: 4.2, colors: ['#a97a42', '#8d5f2c', '#b98c55'], alpha: [0.05, 0.22] });
    g.fillStyle = L.radial(g, 640, 140, 120, 1750, [[0, 'rgba(255,250,236,0.26)'], [0.5, 'rgba(255,250,236,0)'], [1, 'rgba(120,88,46,0.22)']]);
    g.fillRect(-PAD, -PAD, W + PAD * 2, hh);
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
    const rot = L.lerp(-0.0075, 0.0075, p), zoom = L.lerp(1.0, 1.03, p);
    L.blit(ctx, env, S.wood, { rot, zoom });
    // warm key light from the upper left, pooling a little further along the beam as the shot runs
    const lx = L.lerp(540, 780, p), ly = a.crestY + 70;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = L.radial(ctx, lx, ly, 260, 1500, [[0, '#ffffff'], [0.45, '#e2cdb8'], [1, '#8d6a50']]);
    ctx.fillRect(0, a.crestY - 10, W, H);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = L.radial(ctx, lx, ly, 40, 900, [[0, 'rgba(255,214,150,0.5)'], [0.6, 'rgba(255,214,150,0.12)'], [1, 'rgba(255,214,150,0)']]);
    ctx.fillRect(0, a.crestY - 10, W, H);
    ctx.restore();
    // the paper covers everything above the arc → the beam's upper edge is exactly the arc on every frame
    ctx.save(); a.clipAbove(ctx, 0);
    L.blit(ctx, env, S.paper, { rot, zoom: 1 + (zoom - 1) * 0.6 });
    // the timber's soft contact shadow on the sheet
    ctx.strokeStyle = 'rgba(70,44,18,0.1)'; ctx.lineWidth = 16; a.stroke(ctx, 2);
    ctx.strokeStyle = 'rgba(60,36,14,0.16)'; ctx.lineWidth = 7; a.stroke(ctx, 1);
    ctx.restore();
    ctx.strokeStyle = 'rgba(40,20,6,0.55)'; ctx.lineWidth = 1.4; a.stroke(ctx, 0.3);
    L.vignette(ctx, { strength: 0.2, color: '#1a0c02', inner: 0.6, outer: 1.12 });
  },
};
