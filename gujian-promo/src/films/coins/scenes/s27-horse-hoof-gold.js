// s27 — 马蹄金. "A hill of gold on black": extreme macro of a Western-Han horse-hoof gold piece; the arc is the upper
// outline of its swelling gold wall. The rim is not a ruled line — it dissolves into a dense fringe of glitter points, and a
// little gold dust streams off both flanks (never over the crest, where the tagline sits).
//
// Everything under the arc is shaded per pixel in init(): a pebbled cast skin (every grain a small dome that throws its own
// spark), folds, pits and a few shallow flow lines that follow the wall, squeezed where the skin rolls over the limb, lit by
// one hard light above the crest so the gold falls from pale and red gold into ochre and umber. Reading inward from the arc:
// the limb, the wall, then a filigree band (beaded wire / two twisted wires laid as a herringbone / beaded wire — the feature
// that tells a horse-hoof gold from a plain gold cake), then shadow. Focus sits on the crest; flanks and foreground go soft.
// No inscription anywhere.
//
// The show is the glitter: ~2500 pre-placed points flare and die on a seeded per-frame schedule (env.frame); a few carry
// four-point star flares.
import * as L from '../../../lib/core.js';

const { W, H, TAU } = L;
const PAD = 72;          // the camera only slides round the circle centre (≤ 0.007 rad ≈ 18 px at the corners)
const TOP = 46;          // rows kept above the crest inside the gold bitmap (room for the baked glitter fringe)
const BM = 48;           // extra rows above that for the bloom to spill into
const VMAX = 1.3, NL = 1024;
let S = null;

// light value → gold. 0.27 umber, 0.55 ochre gold, 0.8 red gold, 1 highlight
const GOLD = [[0, '#0c0400'], [0.1, '#280f02'], [0.2, '#3f2005'], [0.27, '#4a2c08'], [0.34, '#663808'], [0.42, '#8a4b08'], [0.55, '#a86a14'], [0.68, '#d08a1c'],
  [0.8, '#e9b13a'], [0.9, '#f8cf5e'], [1, '#fff3c0'], [1.3, '#fffef6']];

// filigree band, depths below the arc (px)
const BEAD_R = 11, ROPE_T = 27;
const BAND = { bead1: 250, ropeA: 277, ropeB: 304, bead2: 331 };
// long shallow flow lines that follow the wall: [depth, seed]
const FLOWS = [[72, 1.3], [138, 7.7], [198, 13.1], [414, 21.9], [476, 4.2]];

const sstep = (a, b, v) => { const t = L.clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const hash2 = (i, j) => {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// tiny allocation-free worley noise (squared distances to the nearest / second-nearest point in cD1 / cD2, cell id in cId)
let cD1 = 0, cD2 = 0, cId = 0;
function cell(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let d1 = 9, d2 = 9, id = 0;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const cx = xi + ox, cy = yi + oy;
    let h = (Math.imul(cx, 374761393) + Math.imul(cy, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    const dx = cx + (h & 1023) / 1023 - x, dy = cy + ((h >>> 10) & 1023) / 1023 - y, d = dx * dx + dy * dy;
    if (d < d1) { d2 = d1; d1 = d; id = ((h >>> 20) & 255) / 255; } else if (d < d2) d2 = d;
  }
  cD1 = d1; cD2 = d2; cId = id;
}

/** the big light: a hard pool on the crest, sinking with depth (d px below the arc) and toward the flanks (sn = sin θ) */
function macro(d, sn) {
  const dd = d < 0 ? 0 : d, s = sn + 0.03, s2 = s * s;
  const A = Math.exp(-s2 / 0.13) * Math.exp(-dd / 230), B = Math.exp(-s2 / 0.56) * Math.exp(-dd / 600);
  return 0.2 + 0.46 * A + 0.16 * B + 0.13 * Math.exp(-dd / 18) * (1 - 0.5 * A);
}
// the skin is squeezed only where it rolls over the limb: surface distance from the limb, and its derivative
const Sof = (d) => d + 46 * (1 - Math.exp(-d / 20));
const gS = (d) => 1 + 2.3 * Math.exp(-d / 20);
/** how far out of focus a point of the frame is (0 = on the crest, 1 = foreground / far flank) */
const defocus = (x, d) => 1 - (1 - sstep(150, 520, d)) * (1 - 0.8 * sstep(430, 1000, Math.abs(x - W / 2)));

function buildSprites() {
  const dot = (stops) => { const c = L.makeCanvas(48, 48), g = c.getContext('2d'); g.fillStyle = L.radial(g, 24, 24, 0, 24, stops); g.fillRect(0, 0, 48, 48); return c; };
  const pale = dot([[0, 'rgba(255,253,242,1)'], [0.22, 'rgba(255,243,192,0.96)'], [0.5, 'rgba(244,192,80,0.4)'], [1, 'rgba(233,150,40,0)']]);
  const gold = dot([[0, 'rgba(255,238,172,1)'], [0.3, 'rgba(244,190,72,0.82)'], [0.6, 'rgba(224,150,40,0.28)'], [1, 'rgba(200,120,20,0)']]);
  const ember = dot([[0, 'rgba(255,206,110,1)'], [0.34, 'rgba(230,142,34,0.72)'], [1, 'rgba(168,96,16,0)']]);
  // out-of-focus glint: a flat disc with a slightly brighter edge
  const soft = dot([[0, 'rgba(246,196,92,0.5)'], [0.6, 'rgba(244,188,80,0.5)'], [0.78, 'rgba(250,206,110,0.6)'], [0.9, 'rgba(236,168,56,0.2)'], [1, 'rgba(220,150,40,0)']]);
  // four-point star flare
  const star = L.makeCanvas(256, 256), g = star.getContext('2d');
  g.translate(128, 128); g.globalCompositeOperation = 'lighter';
  const streak = (ang, len, thick, al) => {
    g.save(); g.rotate(ang); g.scale(len / 128, thick / 128);
    g.fillStyle = L.radial(g, 0, 0, 0, 128, [[0, `rgba(255,251,230,${al})`], [0.05, `rgba(255,244,200,${al * 0.82})`], [0.22, `rgba(250,212,120,${al * 0.32})`], [0.5, `rgba(240,180,70,${al * 0.07})`], [1, 'rgba(233,160,50,0)']]);
    g.fillRect(-128, -128, 256, 256); g.restore();
  };
  streak(0, 126, 4.2, 1); streak(Math.PI / 2, 126, 4.2, 1); streak(Math.PI / 4, 50, 3, 0.45); streak(-Math.PI / 4, 50, 3, 0.45);
  g.fillStyle = L.radial(g, 0, 0, 0, 34, [[0, 'rgba(255,255,250,1)'], [0.24, 'rgba(255,245,200,0.7)'], [0.6, 'rgba(246,196,90,0.16)'], [1, 'rgba(240,180,70,0)']]);
  g.fillRect(-34, -34, 68, 68);
  return [pale, gold, ember, soft, star];
}
const SP_PALE = 0, SP_GOLD = 1, SP_EMBER = 2, SP_SOFT = 3, SP_STAR = 4;

function beadSprite(r, V, col) {
  const SC = 2, half = Math.ceil(r + 8), c = L.makeCanvas(half * 2 * SC, half * 2 * SC), g = c.getContext('2d');
  g.scale(SC, SC); g.translate(half, half);
  g.fillStyle = L.radial(g, 1.4, 2.6, r * 0.5, r + 4.6, [[0, 'rgba(22,9,0,0.8)'], [1, 'rgba(22,9,0,0)']]);
  g.fillRect(-half, -half, half * 2, half * 2);
  g.fillStyle = L.radial(g, -r * 0.34, -r * 0.42, r * 0.04, r * 1.32, [[0, col(V + 0.56)], [0.14, col(V + 0.36)], [0.46, col(V + 0.05)], [0.8, col(V - 0.2)], [1, col(V - 0.32)]]);
  g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  // the wall bounces a little warm light into the shaded underside
  g.strokeStyle = L.rgba(col(V + 0.16), 0.55); g.lineWidth = r * 0.14; g.lineCap = 'round';
  g.beginPath(); g.arc(0, 0, r - r * 0.16, 0.3, 1.3); g.stroke();
  return c;
}
function strandSprite(len, wid, V, col) {
  const SC = 2, half = Math.ceil(len / 2 + 5), c = L.makeCanvas(half * 2 * SC, half * 2 * SC), g = c.getContext('2d');
  g.scale(SC, SC); g.translate(half, half);
  g.fillStyle = 'rgba(22,9,0,0.7)';
  g.beginPath(); g.ellipse(1.4, 1.5, wid / 2 + 1.8, len / 2 + 1.0, 0, 0, TAU); g.fill();
  g.fillStyle = L.linear(g, -wid / 2, 0, wid / 2, 0, [[0, col(V + 0.12)], [0.22, col(V + 0.48)], [0.46, col(V + 0.1)], [0.8, col(V - 0.18)], [1, col(V - 0.32)]]);
  g.beginPath(); g.ellipse(0, 0, wid / 2, len / 2, 0, 0, TAU); g.fill();
  return c;
}

/** the filigree band: beaded wire / twisted wire / twisted wire (opposite lay) / beaded wire, all concentric with the arc */
function drawFiligree(g, a, col) {
  const R = a.R, cx = a.cx, cy = a.cy, span = a.span(PAD + 40);
  const r = L.rng('s27fil');
  const NLV = 12, V0 = 0.16, V1 = 0.8;
  const lv = (V) => L.clamp(Math.round(((V - V0) / (V1 - V0)) * (NLV - 1)), 0, NLV - 1);
  const beadSp = [], strandSp = [];
  for (let i = 0; i < NLV; i++) {
    const V = L.lerp(V0, V1, i / (NLV - 1));
    beadSp.push(beadSprite(BEAD_R, V, col)); strandSp.push(strandSprite(ROPE_T * 1.24, 13.5, V, col));
  }
  const top = BAND.bead1 - BEAD_R, bot = BAND.bead2 + BEAD_R;
  // 1) the wires stand proud of the wall: a dark bed under them and a cast shadow on the side away from the light
  const r0 = R - bot - 24, r1 = R - top + 6, tt = (d) => (R - d - r0) / (r1 - r0);
  g.fillStyle = L.radial(g, cx, cy, r0, r1, [[0, 'rgba(26,11,1,0)'], [tt(bot + 9), 'rgba(30,13,1,0.36)'], [tt(bot - 1), 'rgba(30,13,1,0.56)'], [tt(top + 3), 'rgba(30,13,1,0.52)'], [1, 'rgba(26,11,1,0)']]);
  a.pathBand(g, -(top - 6), -(bot + 24), -span, span); g.fill();
  // 2) wire cores, so the gaps between strands read as dark gold, not as holes
  const stops = [];
  for (let i = 0; i <= 12; i++) { const x = -PAD + (i / 12) * (W + PAD * 2); stops.push([i / 12, col(macro(290, (x - cx) / (R - 290)) - 0.14)]); }
  g.fillStyle = L.linear(g, -PAD, 0, W + PAD, 0, stops);
  a.pathBand(g, -(BAND.ropeA - ROPE_T / 2 + 1.5), -(BAND.ropeB + ROPE_T / 2 - 1.5), -span, span); g.fill();
  // 3) the two twisted wires, laid with opposite twist → a herringbone. Hand-made: no two turns alike
  for (const [d, slant] of [[BAND.ropeA, 0.62], [BAND.ropeB, -0.62]]) {
    const rr = R - d, span2 = span * rr;
    for (let s = -span2; s <= span2; s += 12.4 * r.range(0.9, 1.12)) {
      const th = s / rr, m = macro(d, Math.sin(th)) * (1 + r.range(-0.1, 0.1));
      const sp = strandSp[lv(m)], jit = r.range(-0.07, 0.07), k = r.range(0.92, 1.06), w = (sp.width / 2) * k;
      a.at(g, th, -d + r.range(-0.8, 0.8), () => {
        g.rotate(slant + jit); if (slant < 0) g.scale(-1, 1);
        g.drawImage(sp, -w / 2, -w / 2, w, w);
      });
    }
  }
  g.strokeStyle = 'rgba(26,11,1,0.45)'; g.lineWidth = 1.8; a.stroke(g, -(BAND.ropeA + BAND.ropeB) / 2, -span, span);
  // 4) the beaded wires
  const beads = [];
  for (const d of [BAND.bead1, BAND.bead2]) {
    const rr = R - d, span2 = span * rr;
    for (let s = -span2 + (d === BAND.bead2 ? 9 : 0); s <= span2; s += (BEAD_R * 2 + 0.6) * r.range(0.86, 1.14)) {
      const th = s / rr, m = macro(d, Math.sin(th)) * (1 + r.range(-0.16, 0.14));
      const k = r.range(0.76, 1.12), p = a.pt(th, -d + r.range(-1.2, 1.2)), sp = beadSp[lv(m)], w = (sp.width / 2) * k;
      g.drawImage(sp, p.x - w / 2, p.y - w / 2, w, w);
      beads.push({ x: p.x - BEAD_R * 0.34 * k, y: p.y - BEAD_R * 0.42 * k, m, d });
    }
  }
  return beads;
}

/** everything under the arc, plus the baked glitter fringe that eats into the rim */
function buildDome(env, spr) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const X0 = -PAD, Y0 = Math.floor(a.crestY) - TOP;
  const RW = W + PAD * 2, RH = H + PAD - Y0, N = RW * RH;
  const nA = L.makeNoise('s27a'), nB = L.makeNoise('s27b');
  const ramp = L.makeRamp(GOLD.map(([t, c]) => [t / VMAX, c]));
  const LUT = new Uint8ClampedArray(NL * 3);
  for (let i = 0; i < NL; i++) { const c = ramp(i / (NL - 1)); LUT[i * 3] = c[0]; LUT[i * 3 + 1] = c[1]; LUT[i * 3 + 2] = c[2]; }
  const col = (V) => { const i = ((L.clamp(V / VMAX) * (NL - 1)) | 0) * 3; return `rgb(${LUT[i]},${LUT[i + 1]},${LUT[i + 2]})`; };

  // 1) slow fields on a half-resolution grid, in skin coordinates (U along the arc, Sv down from the limb)
  const AW = 1.1, AM = 6.0, AN = 2.4, APIT = 2.6, AFL = 2.3, APEB = 1.3, AG = 0.05, KR = 2.6;
  const CS = 2, cw = Math.ceil(RW / CS) + 2, ch = Math.ceil(RH / CS) + 2, CN = cw * ch;
  const cH = new Float32Array(CN), cPit = new Float32Array(CN), cTone = new Float32Array(CN), cWx = new Float32Array(CN), cWy = new Float32Array(CN);
  for (let j = 0; j < ch; j++) {
    const ddy = cy - (Y0 + j * CS);
    for (let i = 0; i < cw; i++) {
      const ddx = X0 + i * CS - cx, rr = Math.sqrt(ddx * ddx + ddy * ddy);
      if (rr > R + 6) continue;
      const d = rr > R ? 0 : R - rr, Sv = Sof(d), U = Math.atan2(ddx, ddy) * rr, k = j * cw + i;
      const wx = nB.n2(U / 170 + 5, Sv / 170), wy = nB.n2(U / 170 - 31, Sv / 170 + 19);
      const wr = nA.ridged(U / 74 + 0.5 * wx, Sv / 64 + 0.5 * wy, 3, 2.1, 0.5);            // folds of the solidified skin
      const swell = nB.fbm(U / 340 + 3, Sv / 250 - 7, 2);                                   // slow swells
      cell(U / 46 + 0.4 * wx, Sv / 46 + 0.4 * wy);
      const nod = Math.min(cD1 < 0.3 ? 1 - cD1 / 0.3 : 0, sstep(0, 0.3, Math.sqrt(cD2) - Math.sqrt(cD1))) * (cId - 0.38);   // larger lumps and dimples
      cell(U / 96 - 5.3 + 0.3 * wy, Sv / 96 + 9.1 + 0.3 * wx);
      let pit = 0;
      if (cId < 0.34) { const rp = 0.1 + 0.13 * ((cId * 7.31) % 1); pit = (1 - sstep(rp * 0.4, rp, Math.sqrt(cD1))) * sstep(0, 0.14, Math.sqrt(cD2) - Math.sqrt(cD1)); }
      let fl = 0;
      for (const [d0, sd] of FLOWS) {
        const u = (d - d0 - 14 * nA.n2(U / 420, sd)) / 11;
        if (u > -3 && u < 3) fl += Math.exp(-u * u) * sstep(-0.5, 0.1, nB.n2(U / 560 + sd, 2.2));
      }
      cH[k] = AW * wr + AM * swell + AN * nod - APIT * pit - AFL * fl;
      cPit[k] = pit; cTone[k] = swell; cWx[k] = wx; cWy[k] = wy;
    }
  }
  const bil = (src, i, j) => {
    const fx = i / CS, fy = j / CS, i0 = fx | 0, j0 = fy | 0, tx = fx - i0, ty = fy - j0, k = j0 * cw + i0;
    const a0 = src[k], a1 = src[k + 1], b0 = src[k + cw], b1 = src[k + cw + 1];
    return (a0 + (a1 - a0) * tx) * (1 - ty) + (b0 + (b1 - b0) * tx) * ty;
  };

  // 2) full-resolution height field: the pebbled grain, every grain a small dome of its own height
  const Hh = new Float32Array(N), Fa = new Float32Array(N), Pe = new Float32Array(N), Gr = new Float32Array(N + RW * 3 + 8);
  for (let j = 0; j < RH; j++) {
    const ddy = cy - (Y0 + j);
    for (let i = 0; i < RW; i++) {
      const ddx = X0 + i - cx, rr = Math.sqrt(ddx * ddx + ddy * ddy), d = R - rr;
      if (d < -4) continue;
      const k = j * RW + i, dd = d < 0 ? 0 : d, Sv = Sof(dd), U = Math.atan2(ddx, ddy) * rr;
      cell(U / 19 + 0.45 * bil(cWx, i, j), Sv / 19 + 0.45 * bil(cWy, i, j));
      const b = cD1 < 0.36 ? 1 - cD1 / 0.36 : 0, hgt = cId < 0.16 ? 0.05 : 0.3 + 0.7 * ((cId * 5.7) % 1);
      const g = nB.n2(i * 0.31 + 11, j * 0.31 - 7);
      Hh[k] = bil(cH, i, j) + APEB * b * hgt + AG * g;
      Fa[k] = b * (((cId * 13.7) % 1) - 0.5);      // each grain is tilted its own way → its own brightness
      Pe[k] = b * hgt; Gr[k] = g;
    }
  }

  // 3) shade: hard top light, a touch from the left; every grain that faces it throws a spark
  const img = new ImageData(RW, RH), o = img.data;
  for (let j = 1; j < RH - 1; j++) {
    const ddy = cy - (Y0 + j);
    for (let i = 1; i < RW - 1; i++) {
      const ddx = X0 + i - cx, rr = Math.sqrt(ddx * ddx + ddy * ddy), d = R - rr;
      if (d < -3) continue;
      const k = j * RW + i, sn = ddx / rr, cs = ddy / rr, dd = d < 0 ? 0 : d;
      const hx = (Hh[k + 1] - Hh[k - 1]) * 0.5, hy = (Hh[k + RW] - Hh[k - RW]) * 0.5;
      const ht = hx * cs + hy * sn, hr = (-hx * sn + hy * cs) / gS(dd);      // slope along the arc / toward the centre
      let rel = KR * (0.9 * hr + 0.42 * ht); rel = rel < -0.62 ? -0.62 : rel > 0.8 ? 0.8 : rel;
      const m = macro(dd, sn) * (1 + 0.2 * bil(cTone, i, j));
      let V = m * (1 + rel) + 0.55 * Fa[k] * m;
      // micro-roughness scatters the mirror direction, so a smooth flank gives a band of separate sparks, not a ruled bright line
      const e1 = hr - 0.075 + 0.05 * Gr[k], e2 = ht - 0.03 + 0.05 * Gr[k + RW * 3 + 5], sp = Math.exp(-(e1 * e1 + e2 * e2) / 0.0012);
      if (sp > 0.02) V += sp * 1.25 * m * (0.35 + m);
      V *= 1 - 0.6 * bil(cPit, i, j);
      const li = ((V <= 0 ? 0 : V >= VMAX ? 1 : V / VMAX) * (NL - 1) | 0) * 3, p = k * 4;
      o[p] = LUT[li]; o[p + 1] = LUT[li + 1]; o[p + 2] = LUT[li + 2];
      // the rim is granular, not a ruled line
      o[p + 3] = d >= 4.4 ? 255 : 255 * sstep(-1.2, 3.2, d + 2.4 * (hash2(i, j) - 0.5) + 2.4 * (Pe[k] - 0.3));
    }
  }
  const cnv = L.makeCanvas(RW, RH), g = cnv.getContext('2d');
  g.putImageData(img, 0, 0);
  g.translate(-X0, -Y0);                 // frame coordinates from here on

  const beads = drawFiligree(g, a, col);

  // 4) baked glitter: a static bed of glints on the gold, thickest where the light is …
  const r = L.rng('s27bake'), span = a.span(PAD + 40);
  const expo = (mean) => -mean * Math.log(1 - r() * 0.9999);
  g.globalCompositeOperation = 'lighter';
  for (let n = 0; n < 5200; n++) {
    const th = r.range(-span, span), d = r.chance(0.42) ? expo(26) + 1 : Math.pow(r(), 1.45) * 600;
    const m = macro(d, Math.sin(th)), keep = Math.pow(m / 0.8, 1.8) + 0.04, hs = 2.6 + Math.pow(r(), 3) * 11, al = r.range(0.3, 0.95), sp = r.pick([SP_PALE, SP_GOLD, SP_GOLD, SP_EMBER]);
    if (r() > keep) continue;
    const p = a.pt(th, -d);
    g.globalAlpha = al * L.clamp(m * 1.3);
    g.drawImage(spr[sp], p.x - hs, p.y - hs * 0.8, hs * 2, hs * 1.6);
  }
  // … and the fringe that dissolves the rim (kept within 9 px of the arc over the crest, looser on the flanks)
  for (let n = 0; n < 3600; n++) {
    const th = r.range(-span, span), side = sstep(0.175, 0.42, Math.abs(th));
    let dr = r.chance(0.7) ? r.gauss() * 3.6 - 0.4 : expo(4.5 + 8 * side);
    const hs = 2 + Math.pow(r(), 2.6) * 6.5, al = r.range(0.35, 1), sp = r.pick([SP_PALE, SP_PALE, SP_GOLD, SP_GOLD, SP_EMBER]);
    if (dr > 8 + 28 * side) dr = 8 + 28 * side - r() * 6;
    const m = macro(0, Math.sin(th)), p = a.pt(th, dr);
    g.globalAlpha = al * L.clamp(m * 1.15) * (dr > 0 ? Math.exp(-dr / (9 + 14 * side)) : 1);
    g.drawImage(spr[sp], p.x - hs, p.y - hs, hs * 2, hs * 2);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';

  // 5) depth of field: the crest is in focus; the flanks go a little soft, the foreground properly soft
  const soften = (px, d0, d1, x0, x1, kx) => {
    const b = L.blurred(cnv, px), bg = b.getContext('2d'), mk = L.makeCanvas(RW, RH), mg = mk.getContext('2d');
    mg.translate(-X0, -Y0);
    mg.fillStyle = L.radial(mg, cx, cy, R - d1, R - d0, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
    mg.fillRect(X0, Y0, RW, RH);
    const XW = x1 + 200, ta = 0.5 - x1 / (2 * XW), tb = 0.5 - x0 / (2 * XW), on = `rgba(0,0,0,${kx})`, off = 'rgba(0,0,0,0)';
    mg.fillStyle = L.linear(mg, cx - XW, 0, cx + XW, 0, [[0, on], [ta, on], [tb, off], [1 - tb, off], [1 - ta, on], [1, on]]);
    mg.fillRect(X0, Y0, RW, RH);
    bg.globalCompositeOperation = 'destination-in'; bg.drawImage(mk, 0, 0);
    g.drawImage(b, X0, Y0);
  };
  soften(2.6, 130, 320, 430, 900, 0.9);
  soften(7, 340, 560, 820, 1100, 0.7);

  // bloom: quarter-size, blurred; drawn back with 'screen' so the hot gold glows and spills a little over its own rim
  const BS = 4, bloom = L.makeCanvas(Math.ceil(RW / BS), Math.ceil((RH + BM) / BS)), bg = bloom.getContext('2d');
  bg.filter = 'brightness(0.9) contrast(1.4) blur(5px)';
  bg.drawImage(cnv, 0, BM / BS, RW / BS, RH / BS);
  bg.filter = 'none';
  return { cnv, bloom, X0, Y0, RW, RH, beads };
}

/** the points that flare and die: on the gold (slide with the surface), dust off the rim (own parallax), star flares */
function buildLive(env, beads) {
  const a = env.arc, span = a.span(PAD);
  const r = L.rng('s27live');
  const expo = (mean) => -mean * Math.log(1 - r() * 0.9999);
  let id = 0;
  const life = (q) => { q.id = id++; q.f0 = r.range(-1.5, 8.5); q.w = r.range(1.1, 2.4); q.fl = r.chance(0.18); return q; };
  // out of focus, a glint opens into a soft disc
  const lens = (q, d) => { const df = defocus(q.x, d); if (df > 0.3) { q.sp = SP_SOFT; q.hs = q.hs * (0.9 + 1.5 * df) + 5 * df; q.al *= 1 - 0.4 * df; } return q; };
  const surf = [];
  // body
  for (let n = 0; n < 4200; n++) {
    const th = r.range(-span, span), d = r.chance(0.45) ? expo(30) + 1 : Math.pow(r(), 1.4) * 600;
    const m = macro(d, Math.sin(th)), u = r(), hs = 4 + Math.pow(r(), 2.4) * 17, al = r.range(0.5, 1), sp = r.pick([SP_PALE, SP_PALE, SP_GOLD, SP_EMBER]);
    const q = life({ hs, sp, al: al * L.clamp(m * 1.35), base: 0 });
    if (u > Math.pow(m / 0.8, 1.6) + 0.07) continue;
    const p = a.pt(th, -d); if (p.y > H + 50) continue;
    q.x = p.x; q.y = p.y; surf.push(lens(q, d));
  }
  // a few fat glints where the light is hardest: these are the ones the eye catches
  for (let n = 0; n < 110; n++) {
    const th = r.gauss() * 0.2, hs = r.range(18, 36), al = r.range(0.7, 1);
    let d = 6 + expo(62);
    if (Math.abs(th) < 0.2) d = Math.max(d, 0.42 * hs + 2);      // their glow stays under the tagline zone
    const m = macro(d, Math.sin(th)), p = a.pt(th, -d), q = life({ x: p.x, y: p.y, hs, sp: SP_PALE, al: al * L.clamp(m * 1.3), base: 0 });
    q.fl = false; q.w = r.range(1.0, 1.7);
    if (d < 240 && Math.abs(th) < span) surf.push(q);
  }
  // the beads of the filigree catch the light one after another
  for (const b of beads) {
    const keep = r.chance(0.6), hs = r.range(5, 10), al = r.range(0.6, 1);
    const q = life({ x: b.x, y: b.y, hs, sp: SP_PALE, al: al * L.clamp(b.m * 1.7), base: 0.12 });
    if (keep && b.y < H + 30) surf.push(lens(q, b.d - 80));
  }
  // the rim
  for (let n = 0; n < 1000; n++) {
    const th = r.range(-span, span), side = sstep(0.175, 0.42, Math.abs(th));
    const dr = Math.min(r.gauss() * 3.4 - 0.6, 7 + 14 * side), hs = 3 + Math.pow(r(), 2.2) * 10, al = r.range(0.5, 1), sp = r.pick([SP_PALE, SP_PALE, SP_GOLD]);
    const p = a.pt(th, dr);
    const q = lens(life({ x: p.x, y: p.y, hs: Math.min(hs, side > 0.1 ? 99 : 7 + (7 - dr)), sp, al: al * L.clamp(macro(0, Math.sin(th)) * 1.25), base: 0 }), 0);
    if (q.sp === SP_SOFT) { q.hs = Math.min(q.hs, 13); q.al *= 0.7; }
    surf.push(q);
  }
  // dust shed from the rim: thick against the arc, thinning outward; nothing beyond 9 px over the crest
  const dust = [];
  for (let n = 0; n < 1100; n++) {
    const th = r.range(-span, span), side = sstep(0.175, 0.42, Math.abs(th));
    const dr = 2 + expo(5 + 34 * side), hs = 1.8 + Math.pow(r(), 2.4) * 5, al = r.range(0.35, 1), sp = r.pick([SP_PALE, SP_GOLD, SP_GOLD, SP_EMBER]), v = r.range(1, 9);
    const q = life({ th, dr, hs, sp, al: al * (0.45 + 0.55 * Math.exp(-dr / 90)) * L.clamp(macro(0, Math.sin(th)) * 1.5), base: 0.3, v: v * side });
    if (dr <= 9 + 300 * side) dust.push(q);
  }
  // a very little dust adrift far out on the flanks, some of it out of focus
  for (let n = 0; n < 130; n++) {
    const th = r.sign() * r.range(0.26, span), side = sstep(0.175, 0.42, Math.abs(th));
    const dr = 36 + Math.pow(r(), 1.7) * 540 * side, big = r.chance(0.22), hs = big ? r.range(7, 15) : 2 + Math.pow(r(), 2) * 4, al = r.range(0.3, 0.9), v = r.range(3, 14);
    dust.push(life({ th, dr, hs, sp: big ? SP_SOFT : r.pick([SP_GOLD, SP_PALE, SP_EMBER]), al: al * (big ? 0.34 : 0.85) * Math.exp(-dr / 420), base: 0.45, v }));
  }
  // star flares: each owns a frame, so two or three are always alight
  const stars = [];
  for (let n = 0; n < 24; n++) {
    const th = r.range(-0.45, 0.45), hs = r.range(78, 150) * (1 - 0.35 * Math.abs(th) / 0.45);
    const onBead = n % 5 === 4;
    let d = onBead ? BAND.bead1 - 4 : 10 + Math.pow(r(), 1.5) * 200;
    if (Math.abs(th) < 0.2) d = Math.max(d, 0.5 * hs + 6);      // keep the vertical ray out of the tagline zone
    const p = a.pt(th, -d);
    stars.push({ x: p.x, y: p.y, hs, al: r.range(0.8, 1) * L.clamp(macro(d, Math.sin(th)) * 1.7), f0: (n * 3) % 8 + r.range(-0.3, 0.3), w: r.range(1.5, 2.1) });
  }
  return { surf, dust, stars };
}

const twinkle = (q, f) => {
  if (q.fl) return hash2(q.id, f * 7 + 3) > 0.56 ? 1 : q.base + 0.1;
  const u = 1 - Math.abs(f - q.f0) / q.w;
  return u <= 0 ? q.base : Math.max(q.base, u * Math.sqrt(u));
};

export default {
  name: '马蹄金',
  tone: 'light',
  init(env) {
    const spr = buildSprites();
    const dome = buildDome(env, spr);
    const live = buildLive(env, dome.beads);
    S = { spr, dome, ...live };
  },
  draw(ctx, env, p) {
    const a = env.arc, f = env.frame, D = S.dome, spr = S.spr;
    const rot = L.lerp(-0.0065, 0.0065, p);
    ctx.fillStyle = '#030303'; ctx.fillRect(0, 0, W, H);

    // dust streaming off the flanks (slower than the surface → parallax), drifting outward
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const q of S.dust) {
      const I = twinkle(q, f) * q.al; if (I < 0.03) continue;
      const pt = a.pt(q.th + rot * 0.55, q.dr + q.v * p), sp = spr[q.sp];
      ctx.globalAlpha = I; ctx.drawImage(sp, pt.x - q.hs, pt.y - q.hs, q.hs * 2, q.hs * 2);
    }
    ctx.restore();

    // the gold: detail slides round the circle centre, the arc itself stays put
    ctx.save();
    ctx.translate(a.cx, a.cy); ctx.rotate(rot); ctx.translate(-a.cx, -a.cy);
    ctx.drawImage(D.cnv, D.X0, D.Y0);
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.34;
    ctx.drawImage(D.bloom, D.X0, D.Y0 - BM, D.RW, D.RH + BM);
    // the glitter: seeded by the frame number
    ctx.globalCompositeOperation = 'lighter';
    for (const q of S.surf) {
      const I = twinkle(q, f) * q.al; if (I < 0.03) continue;
      ctx.globalAlpha = I; ctx.drawImage(spr[q.sp], q.x - q.hs, q.y - q.hs, q.hs * 2, q.hs * 2);
    }
    ctx.restore();

    // a soft sheen travelling over the crown of the dome
    ctx.save(); a.clipBelow(ctx, 0); ctx.globalCompositeOperation = 'screen';
    a.at(ctx, L.lerp(-0.075, 0.045, p), -64, () => {
      ctx.scale(2.6, 1);
      ctx.fillStyle = L.radial(ctx, 0, 0, 0, 210, [[0, 'rgba(255,214,120,0.2)'], [0.5, 'rgba(244,180,70,0.07)'], [1, 'rgba(233,160,50,0)']]);
      ctx.fillRect(-220, -220, 440, 440);
    });
    ctx.restore();

    // star flares (an optical artefact: they stay upright)
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const cr = Math.cos(rot), sr = Math.sin(rot), star = spr[SP_STAR];
    for (const q of S.stars) {
      const u = 1 - Math.abs(f - q.f0) / q.w; if (u <= 0) continue;
      const dx = q.x - a.cx, dy = q.y - a.cy, x = a.cx + dx * cr - dy * sr, y = a.cy + dx * sr + dy * cr, hs = q.hs * (0.55 + 0.45 * u);
      ctx.globalAlpha = q.al * Math.sqrt(u); ctx.drawImage(star, x - hs, y - hs, hs * 2, hs * 2);
    }
    ctx.restore();
  },
};
