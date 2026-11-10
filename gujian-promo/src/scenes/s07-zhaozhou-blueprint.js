// s07 — 赵州桥蓝图（安济桥 立面）. A chalk survey drawing on Prussian-blue cyanotype paper.
// The shared arc is the INTRADOS of the main arch (the boldest chalk line). Above it: the ring of voussoirs,
// the open spandrels (two small arches on each shoulder — large one outboard, small one inboard), the gently
// cambered deck and its balustrade. Below it: the void under the bridge, filled with the draughtsman's
// construction geometry (radii from the centre, chord and sagitta, angle arc, scale bar, title block).
// NOTE: the shoulders are drawn schematically closer to the crown than on the real bridge so that both small
// arches fit in a 16:9 close-up; no dimensions or numbers are written anywhere.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 240;
const CHALK = '#f2f5f7';
const BLUE = '#1f4f86', DEEP = '#173d6b', WORN = '#3d6ea3';

// geometry in px (x offsets are measured from the centre axis)
const RING = 80;          // main arch ring thickness (intrados → extrados)
const JOINT = 78;         // voussoir length along the intrados
const DECK_H = 62;        // top of deck above the extrados at the crown
const DECK_R = 14000;     // camber radius of the deck line
const SLAB = 15;          // cornice course under the deck edge
const RAIL_H = 72, POST_H = 98, POST_W = 20, POST_SP = 136;
const ARCH_SPECS = [{ d: 550, span: 144, rise: 54, ring: 24 }, { d: 805, span: 192, rise: 72, ring: 30 }]; // inner (small) / outer (large): spans in the ratio 2.85 : 3.81
const FAN = [1.5, 4.5, 7.5, 10.5]; // radial construction lines, in voussoir units from the axis (they pass through joints)
const CREASE_X = [300, 1220], CREASE_Y = 818;
const BLOCK = { x: 1500, y: 902, w: 346, h: 122 };
let S = null;

// ───────────────────────── chalk helpers ─────────────────────────
function chalk(g, pts, width, seed, o = {}) {
  L.chalkStroke(g, pts, {
    width, color: o.color || CHALK, seed: 's07' + seed, density: o.density === undefined ? 0.8 : o.density,
    jitter: o.jitter === undefined ? 1.0 : o.jitter, alpha: o.alpha === undefined ? 0.92 : o.alpha, step: o.step || 1.5,
  });
}
/** heavy line: a dusty feathered pass under a dense core */
function bold(g, pts, width, seed) {
  chalk(g, pts, width * 1.6, seed + 'f', { density: 0.24, alpha: 0.55, jitter: 2 });
  chalk(g, pts, width, seed + 'c', { density: 0.97, alpha: 1 });
  chalk(g, pts, width * 0.62, seed + 'k', { density: 0.9, alpha: 1, jitter: 0.6 });
}
const ln = (g, x0, y0, x1, y1, width, seed, o) => chalk(g, [[x0, y0], [x1, y1]], width, seed, o);
function dash(g, x0, y0, x1, y1, pat, width, seed, o = {}) {
  const len = Math.hypot(x1 - x0, y1 - y0); const ux = (x1 - x0) / len, uy = (y1 - y0) / len;
  let d = o.phase || 0, i = 0;
  while (d < len) {
    const seg = pat[i % pat.length];
    if (i % 2 === 0) {
      const s0 = Math.max(0, d), e = Math.min(len, d + seg);
      if (e - s0 > 1) chalk(g, [[x0 + ux * s0, y0 + uy * s0], [x0 + ux * e, y0 + uy * e]], width, seed + '_' + i, o);
    }
    d += seg; i++;
  }
}
/** filled-ish arrowhead: tip at (x,y), pointing along `ang` */
function arrow(g, x, y, ang, size, width, seed) {
  for (const k of [-1, -0.5, 0, 0.5, 1]) {
    const b = ang + Math.PI + k * 0.34;
    ln(g, x, y, x + Math.cos(b) * size, y + Math.sin(b) * size, width, seed + 'a' + k, { density: 0.92, alpha: 1 });
  }
}
const tick = (g, x, y, len, width, seed) => ln(g, x - len * 0.36, y + len * 0.36, x + len * 0.36, y - len * 0.36, width, seed, { density: 0.9, alpha: 1 });
function circPts(x, y, r, a0 = 0, a1 = L.TAU, n = 36) {
  const out = [];
  for (let i = 0; i <= n; i++) { const t = L.lerp(a0, a1, i / n); out.push([x + r * Math.cos(t), y + r * Math.sin(t)]); }
  return out;
}
function crossMark(g, x, y, r, width, seed) {
  ln(g, x - r * 1.7, y, x + r * 1.7, y, width, seed + 'h');
  ln(g, x, y - r * 1.7, x, y + r * 1.7, width, seed + 'v');
  chalk(g, circPts(x, y, r), width, seed + 'o');
}
function dot(g, x, y, r, seed) {
  for (let i = 0; i < 4; i++) { const t = i * 0.8; ln(g, x - Math.cos(t) * r, y - Math.sin(t) * r, x + Math.cos(t) * r, y + Math.sin(t) * r, r * 1.1, seed + 'd' + i, { density: 0.95, alpha: 1 }); }
}
/** 512² tile of chalk-coloured per-pixel specks (alpha = rnd^pow) — the "tooth" of the paper */
function toothTile(seed, pow) {
  const n = 512, c = L.makeCanvas(n, n), g = c.getContext('2d');
  const img = g.createImageData(n, n), d = img.data, r = L.rng(seed);
  for (let i = 0; i < d.length; i += 4) { d[i] = 242; d[i + 1] = 245; d[i + 2] = 247; d[i + 3] = 255 * Math.pow(r(), pow); }
  g.putImageData(img, 0, 0);
  return c;
}

// ───────────────────────── geometry ─────────────────────────
function makeGeo(a) {
  const step = JOINT / a.R;
  const yExt = (x) => a.yAt(x, RING);
  const yDeck = (x) => a.crestY - RING - DECK_H + ((x - a.cx) * (x - a.cx)) / (2 * DECK_R);
  const arches = [];
  for (const sgn of [-1, 1]) for (const sp of ARCH_SPECS) {
    const xc = a.cx + sgn * sp.d, half = sp.span / 2;
    const r = (half * half + sp.rise * sp.rise) / (2 * sp.rise);
    const phi = Math.asin(half / r);
    // crown of the small ring tucks right under the cornice; the uphill foot sits on the back of the main arch
    const springY = Math.min(yDeck(xc) + SLAB + 6 + sp.ring + sp.rise, yExt(xc - sgn * half) - 1);
    arches.push({ sgn, xc, half, r, r2: r + sp.ring, ring: sp.ring, phi, springY, cy: springY - sp.rise + r, xL: xc - half, xR: xc + half });
  }
  return { step, yExt, yDeck, arches };
}
function archPts(A, rad, n = 30, p0 = -A.phi, p1 = A.phi) {
  const out = [];
  for (let i = 0; i <= n; i++) { const ps = L.lerp(p0, p1, i / n); out.push([A.xc + rad * Math.sin(ps), A.cy - rad * Math.cos(ps)]); }
  return out;
}

// ───────────────────────── paper ─────────────────────────
function buildPaper() {
  const w = W + PAD * 2, h = H + PAD * 2;
  return L.makeLayer(PAD, (g) => {
    g.fillStyle = BLUE; g.fillRect(-PAD, -PAD, w, h);
    // uneven exposure of the cyanotype: deep pools and paler, washed-out fields
    g.drawImage(L.noiseTex(w, h, { seed: 's07a', scale: 780, octaves: 4, res: 0.2, warp: 0.6, contrast: 1.7,
      ramp: [[0, L.rgba(DEEP, 0.95)], [0.4, L.rgba(DEEP, 0.2)], [0.58, L.rgba(WORN, 0)], [1, L.rgba(WORN, 0.55)]] }), -PAD, -PAD);
    g.globalAlpha = 0.4;
    g.drawImage(L.noiseTex(w, h, { seed: 's07m', scale: 120, octaves: 4, res: 0.25, warp: 0.4, contrast: 1.5,
      ramp: [[0, L.rgba('#12325c', 0.6)], [0.48, 'rgba(18,50,92,0)'], [0.6, 'rgba(84,134,190,0)'], [1, L.rgba('#5486be', 0.4)]] }), -PAD, -PAD);
    // brush streaks of the hand-coated sensitiser
    g.globalAlpha = 0.26;
    g.drawImage(L.noiseTex(w, h, { seed: 's07b', scale: 30, sx: 46, sy: 1, octaves: 3, res: 0.33, contrast: 1.7,
      ramp: [[0, L.rgba('#0f2d55', 0.55)], [0.46, 'rgba(15,45,85,0)'], [0.6, 'rgba(96,146,202,0)'], [1, L.rgba('#6092ca', 0.42)]] }), -PAD, -PAD);
    g.globalAlpha = 1;
    // paper fibres
    const r = L.rng('s07fib');
    g.lineCap = 'round';
    for (let i = 0; i < 3400; i++) {
      const x = r.range(-PAD, W + PAD), y = r.range(-PAD, H + PAD), len = r.range(7, 44), an = r() * Math.PI;
      g.strokeStyle = r.chance(0.55) ? L.rgba('#8db4e0', r.range(0.07, 0.3)) : L.rgba('#0c274b', r.range(0.08, 0.3));
      g.lineWidth = r.range(0.5, 1.6);
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(an) * len * 0.5 + r.range(-5, 5), y + Math.sin(an) * len * 0.5 + r.range(-5, 5), x + Math.cos(an) * len, y + Math.sin(an) * len);
      g.stroke();
    }
    // tooth: chunky + fine grain
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.85;
    g.drawImage(L.grainTex(w, h, { seed: 's07g3', amount: 0.42, size: 3 }), -PAD, -PAD);
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 1;
    g.drawImage(L.grainTex(w, h, { seed: 's07g1', amount: 0.2, size: 1 }), -PAD, -PAD);
    g.globalCompositeOperation = 'source-over';
    L.speckle(g, { seed: 's07sp', count: 900, x: -PAD, y: -PAD, w, h, rMin: 0.4, rMax: 1.7, colors: ['#9dbfe6', '#0b2445', '#c9dcf0'], alpha: [0.1, 0.5] });
  });
}

// ───────────────────────── masonry tone (side-of-the-chalk shading) ─────────────────────────
function buildTone(env, G, tile) {
  const a = env.arc, s = a.span(PAD + 140);
  const xa = a.pt(-s, 0).x, xb = a.pt(s, 0).x;
  const massPath = (g) => { g.beginPath(); a.trace(g, 0, -s, s); for (let x = xb; x >= xa; x -= 40) g.lineTo(x, G.yDeck(x)); g.closePath(); };
  const openPath = (g, A) => {
    g.beginPath(); g.moveTo(A.xL, G.yExt(A.xL)); g.lineTo(A.xL, A.springY);
    g.arc(A.xc, A.cy, A.r, -Math.PI / 2 - A.phi, -Math.PI / 2 + A.phi);
    g.lineTo(A.xR, G.yExt(A.xR)); for (let x = A.xR; x >= A.xL; x -= 15) g.lineTo(x, G.yExt(x)); g.closePath();
  };
  return L.makeLayer(PAD, (g) => {
    // diagonal hatching, laid with the side of the chalk
    let i = 0;
    for (let x = xa - 200; x < xb + 200; x += 19) {
      const yt = G.yDeck(L.clamp(x + 120, xa, xb)) - 12, yb = a.yAt(L.clamp(x, xa, xb), 0) + 26;
      const k = 0.52; // lean
      ln(g, x, yb, x + (yb - yt) * k, yt, 12, 'hat' + i, { density: 0.26, alpha: 0.55, jitter: 2.4, step: 2 }); i++;
    }
    g.globalCompositeOperation = 'destination-in'; g.fillStyle = '#000'; massPath(g); g.fill();
    g.globalCompositeOperation = 'source-over';
    // even rubbed-in dust over all the stonework; a little heavier on the arch rings
    const pat = g.createPattern(tile, 'repeat');
    g.save(); massPath(g); g.clip(); g.fillStyle = pat; g.globalAlpha = 0.34; g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2); g.restore();
    g.save(); a.clipBand(g, RING, 0, -s, s); g.fillStyle = pat; g.globalAlpha = 0.3; g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2); g.restore();
    for (const A of G.arches) {
      g.save(); g.beginPath();
      g.arc(A.xc, A.cy, A.r2, -Math.PI / 2 - A.phi, -Math.PI / 2 + A.phi); g.arc(A.xc, A.cy, A.r, -Math.PI / 2 + A.phi, -Math.PI / 2 - A.phi, true); g.closePath();
      g.clip(); g.fillStyle = pat; g.globalAlpha = 0.3; g.fillRect(A.xc - 200, A.cy - 200, 400, 400); g.restore();
    }
    // the openings stay bare paper → they read as dark voids
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
    for (const A of G.arches) { openPath(g, A); g.fill(); }
    // uneven pressure
    g.globalAlpha = 0.55;
    g.drawImage(L.noiseTex(W + PAD * 2, H + PAD * 2, { seed: 's07tone', scale: 150, octaves: 3, res: 0.2, contrast: 1.6, ramp: [[0, 'rgba(0,0,0,1)'], [0.55, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0)']] }), -PAD, -PAD);
  });
}

// ───────────────────────── the drawing ─────────────────────────
function buildInk(env, G) {
  const a = env.arc, s = a.span(PAD + 140);
  const P = (th, dr) => { const q = a.pt(th, dr); return [q.x, q.y]; };
  const oy = a.crestY - 560; // annotations ride with the crest
  return L.makeLayer(PAD, (g) => {
    // ── construction geometry ──
    dash(g, a.cx, -PAD - 10, a.cx, H + PAD + 10, [118, 15, 10, 15], 4, 'axis', { alpha: 0.95, density: 0.86, phase: -40 });
    FAN.forEach((k, i) => {
      for (const sg of [-1, 1]) {
        const th = sg * k * G.step, p0 = P(th, -20), p1 = P(th, -900);
        dash(g, p0[0], p0[1], p1[0], p1[1], [92, 14, 10, 14], 4.8, 'fan' + i + sg, { alpha: 0.95, density: 0.86, phase: -((i * 37 + (sg > 0 ? 19 : 0)) % 60) });
      }
    });
    // chord and sagitta of the visible segment
    const thC = FAN[3] * G.step, c0 = P(-thC, 0), c1 = P(thC, 0);
    dash(g, c0[0] + 18, c0[1], c1[0] - 18, c1[1], [30, 13], 3, 'chord', { alpha: 0.88 });
    chalk(g, circPts(c0[0], c0[1], 9), 2.4, 'c0'); chalk(g, circPts(c1[0], c1[1], 9), 2.4, 'c1');
    ln(g, a.cx, c0[1] - 24, a.cx + 24, c0[1] - 24, 2.4, 'ra1'); ln(g, a.cx + 24, c0[1] - 24, a.cx + 24, c0[1], 2.4, 'ra2');
    arrow(g, a.cx, a.crestY + 9, -Math.PI / 2, 22, 2.6, 'sg0'); arrow(g, a.cx, c0[1] - 3, Math.PI / 2, 22, 2.6, 'sg1');
    // angle between two radii
    const tA0 = -FAN[2] * G.step, tA1 = -FAN[0] * G.step, drA = -262;
    chalk(g, L.arcPts(a, drA, tA0, tA1, 40), 3.4, 'ang', { alpha: 0.95, density: 0.86 });
    { const q0 = P(tA0, drA), q1 = P(tA1, drA); arrow(g, q0[0], q0[1], tA0 + Math.PI, 22, 2.6, 'an0'); arrow(g, q1[0], q1[1], tA1, 22, 2.6, 'an1'); }
    // radius arrow touching the intrados
    { const th = FAN[1] * G.step, q = P(th, -7); arrow(g, q[0], q[1], th - Math.PI / 2, 28, 3.2, 'rad'); }
    // water level under the arch: the draughtsman's stacked-line symbol with its datum triangle
    { const wy = 936 + oy;
      ln(g, a.cx - 372, wy, a.cx + 372, wy, 3.4, 'w0'); ln(g, a.cx - 262, wy + 16, a.cx + 262, wy + 16, 2.8, 'w1', { alpha: 0.9 }); ln(g, a.cx - 150, wy + 31, a.cx + 150, wy + 31, 2.3, 'w2', { alpha: 0.85 });
      const tx = a.cx + 300; ln(g, tx, wy - 2, tx - 13, wy - 24, 2.6, 'wt0'); ln(g, tx, wy - 2, tx + 13, wy - 24, 2.6, 'wt1'); ln(g, tx - 15, wy - 24, tx + 15, wy - 24, 2.6, 'wt2'); }

    // ── main arch ring ──
    for (let k = -Math.ceil(s / G.step) - 1; k <= Math.ceil(s / G.step); k++) {
      const th = (k + 0.5) * G.step, p0 = P(th, 4), p1 = P(th, RING - 3);
      ln(g, p0[0], p0[1], p1[0], p1[1], 4.8, 'jt' + k, { density: 0.86, alpha: 0.98 });
      // 腰铁: double-dovetail iron cramp let into the face across every joint
      a.at(g, th, RING * 0.5, () => {
        const bw = 11, bh = 5.5, o = { density: 0.95, alpha: 1, jitter: 0.5 };
        ln(g, -bw, -bh, bw, bh, 2.4, 'ya' + k, o); ln(g, -bw, bh, bw, -bh, 2.4, 'yb' + k, o);
        ln(g, -bw, -bh, -bw, bh, 2.4, 'yc' + k, o); ln(g, bw, -bh, bw, bh, 2.4, 'yd' + k, o);
        ln(g, -bw + 2, -2, -3, 0, 2.6, 'ye' + k, o); ln(g, -bw + 2, 2, -3, 0, 2.6, 'yf' + k, o); ln(g, bw - 2, -2, 3, 0, 2.6, 'yg' + k, o); ln(g, bw - 2, 2, 3, 0, 2.6, 'yh' + k, o);
      });
    }
    chalk(g, L.arcPts(a, RING, -s, s, 260), 7.2, 'extr', { density: 0.9, alpha: 1 });
    bold(g, L.arcPts(a, 0, -s, s, 260), 14, 'intr');
    chalk(g, L.arcPts(a, -5.5, -s, -0.03, 120), 4.5, 'intr2', { density: 0.4, alpha: 0.75, jitter: 1.6 }); // the line was gone over twice
    chalk(g, L.arcPts(a, 4.5, 0.11, s, 120), 4, 'intr3', { density: 0.34, alpha: 0.7, jitter: 1.6 });

    // ── open spandrels: two small arches on each shoulder ──
    G.arches.forEach((A, i) => {
      // piers down to the back of the main arch
      ln(g, A.xL, A.springY - 3, A.xL, G.yExt(A.xL) + 3, 5.2, 'pl' + i); ln(g, A.xR, A.springY - 3, A.xR, G.yExt(A.xR) + 3, 5.2, 'pr' + i);
      dash(g, A.xL + 6, A.springY, A.xR - 6, A.springY, [14, 9], 2.2, 'sp' + i, { alpha: 0.8 });
      if (A.sgn < 0) { tick(g, A.xL + 1, A.springY, 20, 2.6, 'st0' + i); tick(g, A.xR - 1, A.springY, 20, 2.6, 'st1' + i); } // clear-span dimension (figures on the left pair)
      // ring: joints, skewbacks, extrados, intrados
      const n = Math.max(5, Math.round((2 * A.phi * (A.r + A.ring / 2)) / 31));
      for (let j = 1; j < n; j++) {
        const ps = L.lerp(-A.phi, A.phi, j / n), sx = Math.sin(ps), cx = Math.cos(ps);
        ln(g, A.xc + (A.r + 2) * sx, A.cy - (A.r + 2) * cx, A.xc + (A.r2 - 2) * sx, A.cy - (A.r2 - 2) * cx, 3.1, 'aj' + i + '_' + j, { density: 0.84 });
      }
      for (const sg of [-1, 1]) {
        const sx = Math.sin(sg * A.phi), cx = Math.cos(A.phi);
        ln(g, A.xc + A.r * sx, A.cy - A.r * cx, A.xc + (A.r2 + 3) * sx, A.cy - (A.r2 + 3) * cx, 3.6, 'sk' + i + sg);
      }
      chalk(g, archPts(A, A.r2), 4.8, 'ae' + i, { density: 0.88, alpha: 1 });
      bold(g, archPts(A, A.r), 7.6, 'ai' + i);
    });

    // ── deck (cornice course) ──
    const deckTop = [], deckBot = [];
    for (let x = -PAD - 120; x <= W + PAD + 120; x += 60) { deckTop.push([x, G.yDeck(x)]); deckBot.push([x, G.yDeck(x) + SLAB]); }
    chalk(g, deckBot, 3.4, 'deckb', { density: 0.84 });
    bold(g, deckTop, 7, 'deckt');
    const nPost = Math.ceil((W / 2 + PAD + 140) / POST_SP);
    for (let k = -nPost * 2; k <= nPost * 2; k++) { const x = a.cx + k * POST_SP * 0.5 + 23; ln(g, x, G.yDeck(x) + 2, x, G.yDeck(x) + SLAB - 1, 2.2, 'dj' + k, { alpha: 0.8 }); }

    // ── balustrade: 望柱 + 栏板 ──
    for (let k = -nPost; k < nPost; k++) {
      const x = a.cx + (k + 0.5) * POST_SP, yb = G.yDeck(x), yt = yb - POST_H, hw = POST_W / 2;
      ln(g, x - hw, yb - 1, x - hw, yt + 15, 3.3, 'pa' + k); ln(g, x + hw, yb - 1, x + hw, yt + 15, 3.3, 'pb' + k);
      ln(g, x - hw - 3, yt + 15, x + hw + 3, yt + 15, 3, 'pc' + k);
      chalk(g, [[x - 7, yt + 14], [x - 9.5, yt + 5], [x, yt - 3], [x + 9.5, yt + 5], [x + 7, yt + 14]], 2.8, 'ph' + k);
      for (const hh of [36, 60]) ln(g, x - hw + 1, yb - hh, x + hw - 1, yb - hh, 2, 'pn' + k + hh, { alpha: 0.85 }); // 竹节望柱: node bands
      // panel to the next post
      const x0 = x + hw, x1 = x + POST_SP - hw, y0 = G.yDeck(x0), y1 = G.yDeck(x1);
      ln(g, x0, y0 - RAIL_H, x1, y1 - RAIL_H, 3.6, 'r1' + k);
      ln(g, x0, y0 - RAIL_H + 13, x1, y1 - RAIL_H + 13, 2.3, 'r2' + k, { alpha: 0.85 });
      ln(g, x0, y0 - 11, x1, y1 - 11, 2.6, 'r3' + k, { alpha: 0.9 });
      // recessed field of the panel
      const ix0 = x0 + 12, ix1 = x1 - 12, iy0 = G.yDeck(ix0), iy1 = G.yDeck(ix1);
      ln(g, ix0, iy0 - RAIL_H + 24, ix1, iy1 - RAIL_H + 24, 1.8, 'f1' + k, { alpha: 0.7 }); ln(g, ix0, iy0 - 21, ix1, iy1 - 21, 1.8, 'f2' + k, { alpha: 0.7 });
      ln(g, ix0, iy0 - RAIL_H + 24, ix0, iy0 - 21, 1.8, 'f3' + k, { alpha: 0.7 }); ln(g, ix1, iy1 - RAIL_H + 24, ix1, iy1 - 21, 1.8, 'f4' + k, { alpha: 0.7 });
      // the middle panels carry the carved dragons — hinted as two interlaced bodies
      if (k >= -3 && k <= 1) {
        const ym = (iy0 + iy1) / 2 - (RAIL_H + 3) / 2, wA = [], wB = [];
        for (let t = 0; t <= 1.0001; t += 1 / 24) {
          const xx = L.lerp(ix0 + 9, ix1 - 9, t), env2 = Math.sin(Math.PI * t) * 0.35 + 0.65, ph = t * Math.PI * 3;
          wA.push([xx, ym + Math.sin(ph) * 9 * env2]); wB.push([xx, ym - Math.sin(ph) * 9 * env2]);
        }
        chalk(g, wA, 2, 'dgA' + k, { alpha: 0.75 }); chalk(g, wB, 2, 'dgB' + k, { alpha: 0.75 });
      }
    }

    // ── dimension chain above the bridge (no figures) ──
    const DY = 152 + oy, ex = [-ARCH_SPECS[1].d, -ARCH_SPECS[0].d, 0, ARCH_SPECS[0].d, ARCH_SPECS[1].d];
    ln(g, a.cx - ARCH_SPECS[1].d - 46, DY, a.cx + ARCH_SPECS[1].d + 46, DY, 3, 'dim', { alpha: 0.95 });
    ex.forEach((d, i) => {
      const x = a.cx + d;
      if (d !== 0) ln(g, x, DY - 26, x, G.yDeck(x) - POST_H - 22, 2.3, 'ex' + i, { alpha: 0.8 });
      tick(g, x, DY, 30, 3.6, 'tk' + i);
    });
    // ring-thickness dimension (labelled 主拱券)
    { const th = -3 * G.step; const q0 = P(th, -50), q1 = P(th, RING + 34), t0 = P(th, 0), t1 = P(th, RING);
      ln(g, q0[0], q0[1], q1[0], q1[1], 2.6, 'rd');
      arrow(g, t0[0], t0[1] + 1, th - Math.PI / 2, 20, 2.6, 'rd0'); arrow(g, t1[0], t1[1] - 1, th + Math.PI / 2, 20, 2.6, 'rd1'); }
    // registration crosses
    crossMark(g, 96, 90, 17, 2.8, 'reg0'); crossMark(g, W - 96, 90, 17, 2.8, 'reg1'); crossMark(g, 96, H - 170, 17, 2.8, 'reg2');

    // ── graphic scale bar (no figures) ──
    { const x0 = 92, y0 = 992, cw = 58, n = 6, hh = 13;
      ln(g, x0, y0, x0 + cw * n, y0, 3, 'sb0'); ln(g, x0, y0 + hh, x0 + cw * n, y0 + hh, 3, 'sb1');
      for (let i = 0; i <= n; i++) ln(g, x0 + cw * i, y0 - (i === 0 || i === n ? 16 : 7), x0 + cw * i, y0 + hh, 2.8, 'sbt' + i);
      for (let i = 0; i < n; i += 2) for (let j = 0; j < 4; j++) ln(g, x0 + cw * i + 2, y0 + 2 + j * 3, x0 + cw * (i + 1) - 2, y0 + 2 + j * 3, 3.4, 'sbf' + i + j, { density: 0.9, alpha: 1 }); }

    // ── leaders for the labels ──
    const lead = (x0, y0, x1, y1, seed) => { ln(g, x0, y0, x1, y1, 2.4, seed, { alpha: 0.9 }); dot(g, x1, y1, 4.5, seed); };
    const Ai = G.arches.find((A) => A.sgn > 0 && A.half < 80), Ao = G.arches.find((A) => A.sgn > 0 && A.half > 80);
    const crown = (A) => A.cy - (A.r + A.r2) / 2;
    lead(a.cx + 646, 272 + oy, Ai.xc + 5, crown(Ai), 'l1'); lead(a.cx + 716, 272 + oy, Ao.xc - 6, crown(Ao), 'l2');
    lead(a.cx - 716, 272 + oy, a.cx - 700, G.yDeck(a.cx - 700) - 1, 'l3');
    lead(a.cx - 400, 272 + oy, a.cx - 424, G.yDeck(a.cx - 424) - 44, 'l4');

    // ── title block (cleared of construction lines) ──
    const B = BLOCK;
    g.clearRect(B.x - 12, B.y - 12, B.w + 24, B.h + 24);
    const rect = (x, y, w, h, wd, seed) => { ln(g, x - 4, y, x + w + 4, y, wd, seed + 't'); ln(g, x - 4, y + h, x + w + 4, y + h, wd, seed + 'b'); ln(g, x, y - 4, x, y + h + 4, wd, seed + 'l'); ln(g, x + w, y - 4, x + w, y + h + 4, wd, seed + 'r'); };
    rect(B.x, B.y, B.w, B.h, 4.4, 'blk');
    ln(g, B.x, B.y + 76, B.x + B.w, B.y + 76, 2.8, 'blk1'); ln(g, B.x + 128, B.y + 76, B.x + 128, B.y + B.h, 2.8, 'blk2'); ln(g, B.x + 240, B.y + 76, B.x + 240, B.y + B.h, 2.8, 'blk3');
  });
}

function buildText(env, G, tile) {
  const a = env.arc, oy = a.crestY - 560;
  return L.makeLayer(PAD, (g) => {
    const T = (s, x, y, size, o = {}) => L.text(g, s, x, y, { font: 'brush', size, weight: 400, color: CHALK, ...o });
    T('中轴', a.cx + 30, 84 + oy, 36, { vertical: true, spacing: 4 });
    T('敞肩小拱', a.cx + 680, 242 + oy, 44, { spacing: 4 });
    T('桥面', a.cx - 724, 242 + oy, 44, { spacing: 6 });
    T('栏板', a.cx - 394, 242 + oy, 44, { spacing: 6 });
    const q = a.pt(-3 * G.step, -88);
    T('主拱券', q.x - 2, q.y + 4, 44, { spacing: 2 });
    // clear spans of the small arches in metres (research g4-bridges: 外侧约 3.81 米、内侧约 2.85 米)
    for (const A of G.arches) if (A.sgn < 0) L.text(g, A.half > 80 ? '3.81' : '2.85', A.xc, A.springY - 21, { font: 'latin', size: A.half > 80 ? 34 : 30, weight: 600, italic: true, color: CHALK });
    T('安济桥', BLOCK.x + BLOCK.w / 2, BLOCK.y + 40, 54, { spacing: 16 });
    T('立面', BLOCK.x + 64, BLOCK.y + 100, 32, { spacing: 8 });
    // chalk doesn't fill the tooth of the paper
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = g.createPattern(tile, 'repeat'); g.globalAlpha = 0.7;
    g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
  });
}

// ───────────────────────── wear: fold creases and scuffs (drawn over the chalk) ─────────────────────────
function crease(g, x0, y0, x1, y1, seed) {
  const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
  g.save(); g.translate(x0, y0); g.rotate(ang);
  // the sheet no longer lies flat: a broad soft roll of light either side of the fold…
  g.fillStyle = L.linear(g, 0, -170, 0, 170, [[0, 'rgba(190,215,245,0)'], [0.5, 'rgba(190,215,245,0.085)'], [0.5, 'rgba(3,12,30,0.13)'], [1, 'rgba(3,12,30,0)']]);
  g.fillRect(0, -170, len, 340);
  // …and the ridge itself
  g.fillStyle = L.linear(g, 0, -10, 0, 10, [[0, 'rgba(214,230,248,0)'], [0.4, 'rgba(214,230,248,0.2)'], [0.5, 'rgba(3,12,30,0.36)'], [0.64, 'rgba(3,12,30,0.1)'], [1, 'rgba(3,12,30,0)']]);
  g.fillRect(0, -10, len, 20);
  g.restore();
  // cracked, rubbed-off pigment along the fold (it takes the chalk with it)
  const nz = L.makeNoise('s07cr' + seed), pts = [];
  const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
  for (let d = 0; d <= len; d += 26) { const o = 1.8 * nz.n2(d * 0.012, 1.7); pts.push([x0 + (x1 - x0) * d / len + nx * o, y0 + (y1 - y0) * d / len + ny * o]); }
  L.chalkStroke(g, pts, { width: 7, color: '#285a95', seed: 's07cra' + seed, density: 0.45, alpha: 0.8, jitter: 2 });
  L.chalkStroke(g, pts, { width: 4, color: '#8db2da', seed: 's07crb' + seed, density: 0.3, alpha: 0.7, jitter: 1.6 });
  L.chalkStroke(g, pts, { width: 2, color: '#dbe7f4', seed: 's07crc' + seed, density: 0.2, alpha: 0.75, jitter: 0.9 });
}
function buildWear() {
  const w = W + PAD * 2, h = H + PAD * 2;
  // abraded, whitened fields: soft patches broken into pin-point specks — strongest where the folds cross
  const scuff = L.noiseTex(w, h, { seed: 's07scuff', scale: 230, octaves: 5, gain: 0.6, res: 0.25, contrast: 2.0,
    ramp: [[0, 'rgba(126,170,218,0)'], [0.46, 'rgba(126,170,218,0)'], [0.8, 'rgba(140,182,226,0.6)'], [1, 'rgba(176,206,236,0.85)']] });
  const sg = scuff.getContext('2d');
  sg.globalCompositeOperation = 'destination-in';
  sg.fillStyle = sg.createPattern(toothTile('s07toothB', 1.1), 'repeat'); sg.fillRect(0, 0, w, h);
  const mask = L.makeLayer(PAD, (g) => {
    for (const x of CREASE_X) {
      g.fillStyle = L.radial(g, x, CREASE_Y, 0, 280, [[0, 'rgba(0,0,0,1)'], [0.4, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(x - 280, CREASE_Y - 280, 560, 560);
      g.fillStyle = L.linear(g, x - 60, 0, x + 60, 0, [[0, 'rgba(0,0,0,0)'], [0.5, 'rgba(0,0,0,0.55)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(x - 60, -PAD, 120, h);
    }
    g.fillStyle = L.linear(g, 0, CREASE_Y - 60, 0, CREASE_Y + 60, [[0, 'rgba(0,0,0,0)'], [0.5, 'rgba(0,0,0,0.55)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(-PAD, CREASE_Y - 60, w, 120);
    const r = L.rng('s07scf');
    for (let i = 0; i < 10; i++) { const x = r.range(-PAD, W + PAD), y = r.range(-PAD, H + PAD), rad = r.range(160, 380); g.fillStyle = L.radial(g, x, y, 0, rad, [[0, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  });
  sg.drawImage(mask, 0, 0);
  return L.makeLayer(PAD, (g) => {
    g.drawImage(scuff, -PAD, -PAD);
    for (const x of CREASE_X) crease(g, x, -PAD, x, H + PAD, 'v' + x);
    crease(g, -PAD, CREASE_Y, W + PAD, CREASE_Y, 'h');
    for (const x of CREASE_X) L.speckle(g, { seed: 's07fl' + x, count: 170, x: x - 70, y: CREASE_Y - 70, w: 140, h: 140, rMin: 0.6, rMax: 2.4, colors: ['#c9dbee', '#9fbfe2'], alpha: [0.3, 0.8] });
  });
}

export default {
  name: '赵州桥蓝图',
  tone: 'light',
  init(env) {
    const G = makeGeo(env.arc);
    const tile = toothTile('s07tooth', 2.2);
    const paper = buildPaper();
    const tone = buildTone(env, G, tile);
    const ink = buildInk(env, G);
    const txt = buildText(env, G, tile);
    const wear = buildWear();
    // flatten everything into one sheet: paper → shading → chalk dust → chalk → wear
    const g = paper.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    // palm smudges: chalk dust dragged across the sheet
    const smudge = L.makeLayer(PAD, (sg) => {
      const r = L.rng('s07smudge');
      for (let i = 0; i < 8; i++) {
        const x = r.range(-80, W - 200), y = r.range(60, H - 40), len = r.range(200, 460), an = r.range(-0.55, 0.15);
        ln(sg, x, y, x + Math.cos(an) * len, y + Math.sin(an) * len, r.range(46, 96), 'sm' + i, { density: 0.06, alpha: 0.6, jitter: 7, step: 3 });
      }
    });
    g.globalAlpha = 0.55; g.drawImage(L.blurred(smudge, 8), 0, 0);
    g.globalAlpha = 0.9; g.drawImage(tone, 0, 0);
    const lines = L.makeCanvas(paper.width, paper.height), lg = lines.getContext('2d');
    lg.drawImage(ink, 0, 0); lg.drawImage(txt, 0, 0);
    // uneven pressure: the chalk skips and thins in patches
    lg.globalCompositeOperation = 'destination-out';
    lg.drawImage(L.noiseTex(lines.width, lines.height, { seed: 's07press', scale: 200, octaves: 4, gain: 0.55, res: 0.2, contrast: 1.9, ramp: [[0, 'rgba(0,0,0,0)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.4)']] }), 0, 0);
    lg.globalCompositeOperation = 'source-over';
    g.globalAlpha = 0.34; g.drawImage(L.blurred(lines, 7), 0, 0);      // dust halo
    g.globalAlpha = 0.1; g.drawImage(L.blurred(lines, 22), 14, 5);     // a smear from the draughtsman's sleeve
    g.globalAlpha = 1; g.drawImage(lines, 0, 0);
    g.globalAlpha = 0.4; g.drawImage(lines, 0, 0);                     // pack the chalk a little denser
    g.globalAlpha = 1;
    g.drawImage(wear, 0, 0);
    S = { sheet: paper };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    ctx.fillStyle = BLUE; ctx.fillRect(0, 0, W, H);
    // the camera pushes in across the sheet; zoom passes through 1.0 mid-shot so the arch stays on the shared arc
    const zoom = L.lerp(0.9756, 1.0244, p), rot = L.lerp(-0.0045, 0.0045, p);
    L.blit(ctx, env, S.sheet, { rot, zoom });
    // fixed raking light — the sheet slides underneath it
    ctx.save(); ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = L.radial(ctx, 600, 250, 0, 1500, [[0, 'rgba(255,255,255,0.3)'], [0.5, 'rgba(255,255,255,0.04)'], [1, 'rgba(0,0,0,0.32)']]);
    ctx.fillRect(0, 0, W, H); ctx.restore();
    const gl = a.pt(L.lerp(-0.2, 0.16, p), 30);
    L.glow(ctx, gl.x, gl.y, 560, '#a9cdf7', 0.1);
    L.vignette(ctx, { strength: 0.3, color: '#04122a' });
  },
};
