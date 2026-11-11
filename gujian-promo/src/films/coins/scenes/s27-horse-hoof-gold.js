// s27 — 马蹄金. "A hill of gold on black": extreme macro of a Western-Han horse-hoof gold piece, the arc is the upper
// outline of its swelling gold wall. The rim is not a clean line — it dissolves into a dense fringe of glitter points, and a
// little gold dust streams off both flanks (never over the crest, where the tagline sits).
//
// Below the arc, everything is shaded per pixel in init(): each pixel is mapped onto a sphere of radius arc.R, so the cast
// skin (fine solidification wrinkles, small pits, a few shallow flow lines) is foreshortened into streaks toward the limb.
// Reading inward from the arc: the limb, a few horizontal ripples in the wall, then a fine filigree band (two beaded wires
// around a herringbone pair of twisted wires — the feature that tells a horse-hoof gold from a plain gold cake), then the
// wall sinking into ochre and umber shadow. No inscription anywhere.
//
// The show is the glitter: ~2500 pre-placed points flare and die on a per-frame, seeded schedule (env.frame), a few with
// four-point star flares.
import * as L from '../../../lib/core.js';

const { W, H, TAU } = L;
const PAD = 72;          // the camera only slides round the circle centre (≤ 0.007 rad ≈ 18 px at the corners)
const TOP = 46;          // rows kept above the crest inside the gold bitmap (room for the baked glitter fringe)
const BM = 48;           // extra rows above that for the bloom to spill into
const VMAX = 1.3, NL = 1024;
let S = null;

// light value → gold. 0.27 umber, 0.55 ochre gold, 0.8 red gold, 1 highlight
const GOLD = [[0, '#0d0600'], [0.12, '#2a1403'], [0.27, '#4a2c08'], [0.4, '#7c460a'], [0.55, '#a86a14'], [0.68, '#cf8a1c'],
  [0.8, '#e9b13a'], [0.9, '#f7cc5a'], [1, '#fff3c0'], [1.3, '#fffef4']];

// filigree band, depths below the arc (px)
const BEAD_R = 6.4, ROPE_T = 17;
const BAND = { bead1: 262, ropeA: 281, ropeB: 299, bead2: 318 };
// horizontal ripples in the wall just inside the limb, and long shallow flow lines further down
const RIPPLES = [44, 66, 87, 107];
const FLOWS = [[166, 1.3], [212, 7.7], [388, 13.1], [452, 21.9]];

const sstep = (a, b, v) => { const t = L.clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const hash2 = (i, j) => {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// tiny allocation-free worley noise (squared distance in cD1, cell id in cId)
let cD1 = 0, cId = 0;
function cell(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let d1 = 9, id = 0;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const cx = xi + ox, cy = yi + oy;
    let h = (Math.imul(cx, 374761393) + Math.imul(cy, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    const dx = cx + (h & 1023) / 1023 - x, dy = cy + ((h >>> 10) & 1023) / 1023 - y, d = dx * dx + dy * dy;
    if (d < d1) { d1 = d; id = ((h >>> 20) & 255) / 255; }
  }
  cD1 = d1; cId = id;
}

/** the big light: brightest on the crest, sinking with depth (d px below the arc) and toward the flanks (sn = sin θ) */
function macro(d, sn) {
  const c = Math.exp(-((sn + 0.03) / 0.5) * ((sn + 0.03) / 0.5));
  const dd = d < 0 ? 0 : d;
  return 0.27 + 0.53 * c * (0.42 + 0.58 * Math.exp(-dd / 300)) + 0.08 * Math.exp(-dd / 16) * (0.4 + 0.6 * c);
}

function buildSprites() {
  const dot = (stops) => { const c = L.makeCanvas(48, 48), g = c.getContext('2d'); g.fillStyle = L.radial(g, 24, 24, 0, 24, stops); g.fillRect(0, 0, 48, 48); return c; };
  const pale = dot([[0, 'rgba(255,253,242,1)'], [0.2, 'rgba(255,243,192,0.95)'], [0.48, 'rgba(242,190,78,0.4)'], [1, 'rgba(233,150,40,0)']]);
  const gold = dot([[0, 'rgba(255,236,168,1)'], [0.28, 'rgba(242,188,70,0.8)'], [0.6, 'rgba(222,150,40,0.28)'], [1, 'rgba(200,120,20,0)']]);
  const ember = dot([[0, 'rgba(255,204,108,1)'], [0.34, 'rgba(228,140,34,0.7)'], [1, 'rgba(168,96,16,0)']]);
  const soft = dot([[0, 'rgba(244,196,96,0.55)'], [0.62, 'rgba(236,172,60,0.42)'], [1, 'rgba(220,150,40,0)']]);
  // four-point star flare
  const star = L.makeCanvas(256, 256), g = star.getContext('2d');
  g.translate(128, 128); g.globalCompositeOperation = 'lighter';
  const streak = (ang, len, thick, al) => {
    g.save(); g.rotate(ang); g.scale(len / 128, thick / 128);
    g.fillStyle = L.radial(g, 0, 0, 0, 128, [[0, `rgba(255,251,230,${al})`], [0.1, `rgba(255,242,196,${al * 0.75})`], [0.45, `rgba(244,196,96,${al * 0.2})`], [1, 'rgba(233,160,50,0)']]);
    g.fillRect(-128, -128, 256, 256); g.restore();
  };
  streak(0, 126, 3.0, 1); streak(Math.PI / 2, 126, 3.0, 1); streak(Math.PI / 4, 44, 2.2, 0.5); streak(-Math.PI / 4, 44, 2.2, 0.5);
  g.fillStyle = L.radial(g, 0, 0, 0, 26, [[0, 'rgba(255,255,250,1)'], [0.3, 'rgba(255,243,192,0.55)'], [1, 'rgba(240,180,70,0)']]);
  g.fillRect(-26, -26, 52, 52);
  return [pale, gold, ember, soft, star];
}
const SP_PALE = 0, SP_GOLD = 1, SP_EMBER = 2, SP_SOFT = 3, SP_STAR = 4;

function beadSprite(r, V, col) {
  const SC = 2, half = Math.ceil(r + 4), c = L.makeCanvas(half * 2 * SC, half * 2 * SC), g = c.getContext('2d');
  g.scale(SC, SC); g.translate(half, half);
  g.fillStyle = L.radial(g, 1.0, 2.0, r * 0.5, r + 3.6, [[0, 'rgba(12,5,0,0.9)'], [1, 'rgba(12,5,0,0)']]);
  g.fillRect(-half, -half, half * 2, half * 2);
  g.fillStyle = L.radial(g, -r * 0.34, -r * 0.4, r * 0.04, r * 1.3, [[0, col(V + 0.62)], [0.16, col(V + 0.36)], [0.5, col(V + 0.04)], [0.82, col(V - 0.22)], [1, col(V - 0.34)]]);
  g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  // the wall bounces a little warm light into the shaded underside
  g.strokeStyle = L.rgba(col(V + 0.14), 0.5); g.lineWidth = 0.9; g.lineCap = 'round';
  g.beginPath(); g.arc(0, 0, r - 0.9, 0.25, 1.35); g.stroke();
  return c;
}
function strandSprite(len, wid, V, col) {
  const SC = 2, half = Math.ceil(len / 2 + 4), c = L.makeCanvas(half * 2 * SC, half * 2 * SC), g = c.getContext('2d');
  g.scale(SC, SC); g.translate(half, half);
  g.fillStyle = 'rgba(12,5,0,0.78)';
  g.beginPath(); g.ellipse(1.0, 1.1, wid / 2 + 1.5, len / 2 + 1.0, 0, 0, TAU); g.fill();
  g.fillStyle = L.linear(g, -wid / 2, 0, wid / 2, 0, [[0, col(V + 0.16)], [0.24, col(V + 0.5)], [0.5, col(V + 0.08)], [0.8, col(V - 0.2)], [1, col(V - 0.34)]]);
  g.beginPath(); g.ellipse(0, 0, wid / 2, len / 2, 0, 0, TAU); g.fill();
  return c;
}

/** the filigree band: beaded wire / twisted wire / twisted wire (opposite lay) / beaded wire, all concentric with the arc */
function drawFiligree(g, a, col) {
  const R = a.R, cx = a.cx, cy = a.cy, span = a.span(PAD + 40);
  const r = L.rng('s27fil');
  const NLV = 12, V0 = 0.2, V1 = 0.86;
  const lv = (V) => L.clamp(Math.round(((V - V0) / (V1 - V0)) * (NLV - 1)), 0, NLV - 1);
  const beadSp = [], strandSp = [];
  for (let i = 0; i < NLV; i++) {
    const V = L.lerp(V0, V1, i / (NLV - 1));
    beadSp.push(beadSprite(BEAD_R, V, col)); strandSp.push(strandSprite(ROPE_T * 1.22, 8.6, V, col));
  }
  // 1) the wires stand proud of the wall: a dark bed under them and a cast shadow on the side away from the light
  g.fillStyle = L.radial(g, cx, cy, R - 352, R - 248, [[0, 'rgba(16,7,0,0)'], [0.2, 'rgba(16,7,0,0.5)'], [0.3, 'rgba(16,7,0,0.84)'], [0.88, 'rgba(16,7,0,0.82)'], [1, 'rgba(16,7,0,0)']]);
  a.pathBand(g, -246, -354, -span, span); g.fill();
  // 2) wire cores, so the gaps between strands read as dark gold, not as holes
  const stops = [];
  for (let i = 0; i <= 12; i++) { const x = -PAD + (i / 12) * (W + PAD * 2); stops.push([i / 12, col(macro(290, (x - cx) / (R - 290)) - 0.3)]); }
  g.fillStyle = L.linear(g, -PAD, 0, W + PAD, 0, stops);
  a.pathBand(g, -(BAND.ropeA - ROPE_T / 2 + 1), -(BAND.ropeB + ROPE_T / 2 - 1), -span, span); g.fill();
  // 3) the two twisted wires, laid with opposite twist → a herringbone
  for (const [d, slant] of [[BAND.ropeA, 0.62], [BAND.ropeB, -0.62]]) {
    const rr = R - d, pitch = 8.2, n = Math.ceil((span * rr) / pitch);
    for (let i = -n; i <= n; i++) {
      const th = (i * pitch) / rr, m = macro(d, Math.sin(th)) * (1 + r.range(-0.07, 0.07));
      const sp = strandSp[lv(m)], jit = r.range(-0.04, 0.04);
      a.at(g, th, -d, () => {
        g.rotate(slant + jit); if (slant < 0) g.scale(-1, 1);
        g.drawImage(sp, -sp.width / 4, -sp.height / 4, sp.width / 2, sp.height / 2);
      });
    }
  }
  g.strokeStyle = 'rgba(16,7,0,0.5)'; g.lineWidth = 1.4; a.stroke(g, -(BAND.ropeA + BAND.ropeB) / 2, -span, span);
  // 4) the beaded wires
  const beads = [];
  for (const d of [BAND.bead1, BAND.bead2]) {
    const rr = R - d, pitch = BEAD_R * 2 + 0.7, n = Math.ceil((span * rr) / pitch);
    for (let i = -n; i <= n; i++) {
      const th = ((i + (d === BAND.bead2 ? 0.5 : 0)) * pitch) / rr;
      const m = macro(d, Math.sin(th)) * (1 + r.range(-0.06, 0.06));
      const p = a.pt(th, -d + r.range(-0.5, 0.5)), sp = beadSp[lv(m)], s = (sp.width / 2) * r.range(0.93, 1.06);
      g.drawImage(sp, p.x - s / 2, p.y - s / 2, s, s);
      beads.push({ x: p.x - BEAD_R * 0.34, y: p.y - BEAD_R * 0.4, m });
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

  // 1) slow fields on a half-resolution grid, in sphere coordinates (U along the parallel, Sv down the meridian from the limb)
  const AW = 1.6, AM = 5.0, AP = 1.3, AFL = 1.1, AG = 0.075, AR = 1.4, KR = 2.6;
  const CS = 2, cw = Math.ceil(RW / CS) + 2, ch = Math.ceil(RH / CS) + 2;
  const cH = new Float32Array(cw * ch), cPit = new Float32Array(cw * ch), cTone = new Float32Array(cw * ch);
  for (let j = 0; j < ch; j++) {
    const ddy = cy - (Y0 + j * CS);
    for (let i = 0; i < cw; i++) {
      const ddx = X0 + i * CS - cx, rr = Math.sqrt(ddx * ddx + ddy * ddy);
      if (rr > R + 4) continue;
      const q = Math.min(1, rr / R), Sv = R * Math.acos(q), U = Math.atan2(ddx, ddy) * rr, d = R - rr, k = j * cw + i;
      const wx = nB.n2(U / 210 + 5, Sv / 210), wy = nB.n2(U / 210 - 31, Sv / 210 + 19);
      const wr = nA.ridged(U / 44 + 0.55 * wx, Sv / 30 + 0.55 * wy, 3, 2.1, 0.55);       // solidification wrinkles
      const flow = nB.fbm(U / 520 + 3, Sv / 150 - 7, 3);                                 // slow swells, long along the arc
      cell(U / 54 + wx * 0.3, Sv / 54 + wy * 0.3);
      let pit = 0;
      if (cId < 0.46) { const rp = 0.13 + 0.2 * ((cId * 7.31) % 1); pit = 1 - sstep(rp * 0.35, rp, Math.sqrt(cD1)); }
      let fl = 0;
      if (d > 130 && d < 500) for (const [d0, sd] of FLOWS) {
        const u = (d - d0 - 11 * nA.n2(U / 360, sd)) / 5.5;
        if (u > -3 && u < 3) fl += Math.exp(-u * u) * sstep(-0.35, 0.25, nB.n2(U / 520 + sd, 2.2));
      }
      cH[k] = AW * wr + AM * flow - AP * pit - AFL * fl;
      cPit[k] = pit; cTone[k] = flow;
    }
  }
  const bil = (src, i, j) => {
    const fx = i / CS, fy = j / CS, i0 = fx | 0, j0 = fy | 0, tx = fx - i0, ty = fy - j0, k = j0 * cw + i0;
    const a0 = src[k], a1 = src[k + 1], b0 = src[k + cw], b1 = src[k + cw + 1];
    return (a0 + (a1 - a0) * tx) * (1 - ty) + (b0 + (b1 - b0) * tx) * ty;
  };

  // 2) full-resolution height field
  const Hh = new Float32Array(N), Gr = new Float32Array(N);
  for (let j = 0; j < RH; j++) {
    const ddy = cy - (Y0 + j);
    for (let i = 0; i < RW; i++) {
      const ddx = X0 + i - cx, rr = Math.sqrt(ddx * ddx + ddy * ddy), d = R - rr;
      if (d < -4) continue;
      const k = j * RW + i, dd = d < 0 ? 0 : d, q = (R - dd) / R, nz = Math.sqrt(1 - q * q), fade = sstep(0.04, 0.2, nz);
      const g = nB.n2(i * 0.29 + 11, j * 0.29 - 7);                                      // cast "orange peel"
      let h = (bil(cH, i, j) + AG * g) * fade;
      if (d > 26 && d < 126) {
        const wob = 5 * bil(cTone, i, j);
        for (let n = 0; n < RIPPLES.length; n++) { const u = (d - RIPPLES[n] - wob) / 4.4; if (u > -3 && u < 3) h += AR * Math.exp(-u * u); }
      }
      Hh[k] = h; Gr[k] = g;
    }
  }

  // 3) shade: top light, a touch from the left; every bump that faces it throws a spark
  const img = new ImageData(RW, RH), o = img.data;
  for (let j = 1; j < RH - 1; j++) {
    const ddy = cy - (Y0 + j);
    for (let i = 1; i < RW - 1; i++) {
      const ddx = X0 + i - cx, rr = Math.sqrt(ddx * ddx + ddy * ddy), d = R - rr;
      if (d < -3) continue;
      const k = j * RW + i, sn = ddx / rr, cs = ddy / rr, dd = d < 0 ? 0 : d, q = (R - dd) / R, nz = Math.sqrt(1 - q * q);
      const hx = (Hh[k + 1] - Hh[k - 1]) * 0.5, hy = (Hh[k + RW] - Hh[k - RW]) * 0.5;
      const ht = hx * cs + hy * sn, hr = (-hx * sn + hy * cs) * (0.25 + 0.75 * nz);   // along the arc / toward the centre
      let rel = KR * (0.9 * hr + 0.42 * ht); rel = rel < -0.62 ? -0.62 : rel > 0.8 ? 0.8 : rel;
      const m = macro(dd, sn) * (1 + 0.16 * bil(cTone, i, j));
      let V = m * (1 + rel);
      const e1 = hr - 0.075, e2 = ht - 0.03, sp = Math.exp(-(e1 * e1 + e2 * e2) / 0.0011);
      if (sp > 0.02) V += sp * 0.95 * (0.22 + m);
      const gl = Gr[k] - 0.42;
      if (gl > 0) V += gl * 2.3 * m * (1 + rel);
      V *= 1 - 0.5 * bil(cPit, i, j) * sstep(0.04, 0.2, nz);
      const li = ((V <= 0 ? 0 : V >= VMAX ? 1 : V / VMAX) * (NL - 1) | 0) * 3, p = k * 4;
      o[p] = LUT[li]; o[p + 1] = LUT[li + 1]; o[p + 2] = LUT[li + 2];
      // the rim is granular, not a ruled line
      o[p + 3] = d >= 2.4 ? 255 : 255 * sstep(-1.1, 2.4, d + 2.6 * (hash2(i, j) - 0.5));
    }
  }
  const cnv = L.makeCanvas(RW, RH), g = cnv.getContext('2d');
  g.putImageData(img, 0, 0);
  g.translate(-X0, -Y0);                 // frame coordinates from here on

  const beads = drawFiligree(g, a, col);

  // 4) baked glitter: a static bed of fine points on the gold, thickest toward the light …
  const r = L.rng('s27bake'), span = a.span(PAD + 40);
  const expo = (mean) => -mean * Math.log(1 - r() * 0.9999);
  g.globalCompositeOperation = 'lighter';
  for (let n = 0; n < 6200; n++) {
    const th = r.range(-span, span), d = r.chance(0.4) ? expo(24) - 1 : Math.pow(r(), 1.45) * 600;
    const m = macro(d, Math.sin(th)), keep = Math.pow(m / 0.86, 1.7) + 0.05, hs = 1.8 + Math.pow(r(), 3.2) * 6.5, al = r.range(0.3, 0.95), sp = r.pick([SP_PALE, SP_GOLD, SP_GOLD, SP_EMBER]);
    if (r() > keep) continue;
    const p = a.pt(th, -d);
    g.globalAlpha = al * L.clamp(m * 1.3);
    g.drawImage(spr[sp], p.x - hs, p.y - hs, hs * 2, hs * 2);
  }
  // … and the fringe that dissolves the rim (kept within 9 px of the arc over the crest, looser on the flanks)
  for (let n = 0; n < 3400; n++) {
    const th = r.range(-span, span), side = sstep(0.175, 0.42, Math.abs(th));
    let dr = r.chance(0.7) ? r.gauss() * 3.4 + 0.4 : expo(4.5 + 7 * side);
    const hs = 1.5 + Math.pow(r(), 2.6) * 4.2, al = r.range(0.35, 1), sp = r.pick([SP_PALE, SP_PALE, SP_GOLD, SP_GOLD, SP_EMBER]);
    if (dr > 9 + 27 * side) dr = 9 + 27 * side - r() * 6;
    const m = macro(0, Math.sin(th)), p = a.pt(th, dr);
    g.globalAlpha = al * L.clamp(m * 1.15) * (dr > 0 ? Math.exp(-dr / (9 + 14 * side)) : 1);
    g.drawImage(spr[sp], p.x - hs, p.y - hs, hs * 2, hs * 2);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';

  // bloom: quarter-size, blurred; drawn back with 'screen' so the hot gold glows and spills a little over its own rim
  const BS = 4, bloom = L.makeCanvas(Math.ceil(RW / BS), Math.ceil((RH + BM) / BS)), bg = bloom.getContext('2d');
  bg.filter = 'brightness(0.9) contrast(1.35) blur(5px)';
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
  const surf = [];
  // body
  for (let n = 0; n < 3300; n++) {
    const th = r.range(-span, span), d = r.chance(0.42) ? expo(26) - 1 : Math.pow(r(), 1.4) * 600;
    const m = macro(d, Math.sin(th)), u = r(), hs = 2.4 + Math.pow(r(), 3) * 9.5, al = r.range(0.5, 1), sp = r.pick([SP_PALE, SP_PALE, SP_GOLD, SP_EMBER]);
    const q = life({ hs, sp, al: al * L.clamp(m * 1.3), base: 0 });
    if (u > Math.pow(m / 0.85, 1.7) + 0.05) continue;
    const p = a.pt(th, -d); if (p.y > H + 50) continue;
    q.x = p.x; q.y = p.y; surf.push(q);
  }
  // the beads of the filigree catch the light one after another
  for (const b of beads) {
    const keep = r.chance(0.55), hs = r.range(3, 6.5), al = r.range(0.55, 1);
    const q = life({ x: b.x, y: b.y, hs, sp: SP_PALE, al: al * L.clamp(b.m * 1.5), base: 0.1 });
    if (keep && b.y < H + 30) surf.push(q);
  }
  // the rim
  for (let n = 0; n < 900; n++) {
    const th = r.range(-span, span), side = sstep(0.175, 0.42, Math.abs(th));
    const dr = Math.min(r.gauss() * 3.2 + 0.5, 8 + 14 * side), hs = 2.2 + Math.pow(r(), 2.4) * 6.5, al = r.range(0.5, 1), sp = r.pick([SP_PALE, SP_PALE, SP_GOLD]);
    const p = a.pt(th, dr);
    surf.push(life({ x: p.x, y: p.y, hs, sp, al: al * L.clamp(macro(0, Math.sin(th)) * 1.2), base: 0 }));
  }
  // dust shed from the rim: thick against the arc, thinning outward; nothing beyond 9 px over the crest
  const dust = [];
  for (let n = 0; n < 1000; n++) {
    const th = r.range(-span, span), side = sstep(0.175, 0.42, Math.abs(th));
    const dr = 2 + expo(5 + 30 * side), hs = 1.6 + Math.pow(r(), 2.4) * 4.2, al = r.range(0.35, 1), sp = r.pick([SP_PALE, SP_GOLD, SP_GOLD, SP_EMBER]), v = r.range(1, 9);
    const q = life({ th, dr, hs, sp, al: al * (0.45 + 0.55 * Math.exp(-dr / 90)) * L.clamp(macro(0, Math.sin(th)) * 1.3), base: 0.3, v: v * side });
    if (dr <= 9 + 300 * side) dust.push(q);
  }
  // a very little dust adrift far out on the flanks, some of it out of focus
  for (let n = 0; n < 120; n++) {
    const th = r.sign() * r.range(0.26, span), side = sstep(0.175, 0.42, Math.abs(th));
    const dr = 36 + Math.pow(r(), 1.7) * 540 * side, big = r.chance(0.2), hs = big ? r.range(6, 13) : 1.8 + Math.pow(r(), 2) * 3.6, al = r.range(0.3, 0.9), v = r.range(3, 14);
    dust.push(life({ th, dr, hs, sp: big ? SP_SOFT : r.pick([SP_GOLD, SP_PALE, SP_EMBER]), al: al * (big ? 0.3 : 0.8) * Math.exp(-dr / 420), base: 0.45, v }));
  }
  // star flares: each owns a frame, so two or three are always alight
  const stars = [];
  for (let n = 0; n < 20; n++) {
    const th = r.range(-0.47, 0.47), hs = r.range(46, 112) * (1 - 0.35 * Math.abs(th) / 0.47);
    const onBead = n % 5 === 4;
    let d = onBead ? BAND.bead1 - 3 : 10 + Math.pow(r(), 1.5) * 215;
    if (Math.abs(th) < 0.2) d = Math.max(d, 0.62 * hs + 6);      // keep the vertical ray out of the tagline zone
    const p = a.pt(th, -d);
    stars.push({ x: p.x, y: p.y, hs, al: r.range(0.75, 1) * L.clamp(macro(d, Math.sin(th)) * 1.5), f0: (n * 3) % 8 + r.range(-0.3, 0.3), w: r.range(1.5, 2.1) });
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
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.3;
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
    a.at(ctx, L.lerp(-0.075, 0.045, p), -70, () => {
      ctx.scale(2.6, 1);
      ctx.fillStyle = L.radial(ctx, 0, 0, 0, 230, [[0, 'rgba(255,214,120,0.2)'], [0.5, 'rgba(244,180,70,0.07)'], [1, 'rgba(233,160,50,0)']]);
      ctx.fillRect(-240, -240, 480, 480);
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
