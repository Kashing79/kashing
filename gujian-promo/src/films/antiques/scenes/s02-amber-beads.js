// s02 — 蜜蜡珠串 (macro photograph). The arc is the envelope of a strand of honey-amber beads: nine or ten round beads sit
// shoulder to shoulder along it, crowns on the arc, a twist of silk cord and a dark notch between neighbours.
// The lens is wide open and focused on the crest: the three beads there are sharp, the strand falls out of focus toward both
// ends of the frame, and the nearer coils of the same strand (lower in the frame, closer to the lens) dissolve into big soft
// honey-coloured blobs that deepen to amber brown. Above: black, a little lit dust.
//
// Each bead is shaded per pixel in init(): a wax-like translucent sphere — wrapped diffuse from a soft box at the upper left,
// the light that has crossed the bead glowing in the opposite lower crescent, back light spilling over the outward limb —
// with cloudy, streaming inclusions (云絮状流纹). The soft-box reflection is rendered to a separate sprite so that it can
// slide over the bead while the strand turns.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 130;
const BR = 104;     // bead radius (px) → about nine beads across the frame
const GAP = 9;      // length of cord showing between two beads
const SPAD = 26;    // transparent margin round every bead sprite (room for its circle of confusion)
let S = null;

const sstep = (a, b, v) => { const t = L.clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const norm3 = (v) => { const m = Math.hypot(v[0], v[1], v[2]); return [v[0] / m, v[1] / m, v[2] / m]; };

// key light: a soft box at the upper left, in front (unit vector, screen space: −y is up, +z toward the lens)
const LK = norm3([-0.44, -0.62, 0.65]);
const HV = norm3([LK[0], LK[1], LK[2] + 1]);                                   // half-vector with the view direction
const LXY = (() => { const m = Math.hypot(LK[0], LK[1]); return [LK[0] / m, LK[1] / m]; })();
const SU = norm3([-LK[2], 0, LK[0]]);                                          // the soft box's own horizontal …
const SV = [LK[1] * SU[2] - LK[2] * SU[1], LK[2] * SU[0] - LK[0] * SU[2], LK[0] * SU[1] - LK[1] * SU[0]];   // … and vertical axes
// a dim reflector card low on the right
const LF = norm3([0.62, 0.42, 0.66]);

// intensity → colour, one ramp for the clear honey and one for the cloudy wax (creamier, lighter)
const NL = 512;
function makeLut(stops) {
  const f = L.makeRamp(stops);
  const out = new Float32Array(NL * 3);
  for (let i = 0; i < NL; i++) { const c = f(i / (NL - 1)); out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2]; }
  return out;
}
const CLEAR = [[0, '#100501'], [0.1, '#431803'], [0.24, '#923f06'], [0.38, '#c66c0d'], [0.52, '#e89917'], [0.68, '#f9ba2e'], [0.84, '#ffd768'], [1, '#fff1b8']];
const CLOUD = [[0, '#180903'], [0.1, '#5c2807'], [0.24, '#aa590f'], [0.38, '#d7891c'], [0.52, '#f0ae2d'], [0.68, '#fbc64c'], [0.84, '#ffe08a'], [1, '#fff6d4']];

/** a cropped layer: frame coordinates inside `draw`, but the canvas only covers [x0, x0+w] × [y0, y0+h] */
function makeBand(x0, y0, w, h, draw) {
  const c = L.makeCanvas(w, h), g = c.getContext('2d');
  c._x0 = x0; c._y0 = y0;
  g.translate(-x0, -y0);
  if (draw) draw(g, c);
  return c;
}
function blitBand(ctx, env, band, o = {}) {
  L.cam(ctx, env, o, () => {
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    if (o.blend) ctx.globalCompositeOperation = o.blend;
    ctx.drawImage(band, band._x0, band._y0);
  });
}
/** defocus with a disc-shaped kernel (flat-topped, like a lens wide open). gain > 1 keeps small highlights burning. */
function lensBlur(src, radius, n = 22, gain = 1) {
  const c = L.makeCanvas(src.width, src.height), g = c.getContext('2d');
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, gain / n);   // additive → a true average, transparent samples included
  for (let i = 0; i < n; i++) {
    const rr = radius * Math.sqrt((i + 0.5) / n), th = i * 2.399963;
    g.drawImage(src, Math.cos(th) * rr, Math.sin(th) * rr);
  }
  return L.blurred(c, Math.max(0.6, radius * 0.2));
}
/** multiply `src` by an opaque tint painted by `paint(g)` while keeping src's alpha */
function multiplyKeepAlpha(src, paint) {
  const c = L.makeCanvas(src.width, src.height), g = c.getContext('2d');
  paint(g);
  g.globalCompositeOperation = 'multiply'; g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'destination-in'; g.drawImage(src, 0, 0);
  return c;
}

/**
 * One bead, shaded per pixel → { base, spec } (two canvases of the same size, the bead centred, SPAD px of margin).
 * o: { axis (angle of the cord on screen = the bead's theta on the arc), flow (direction of the streaming inclusions),
 *      ox, oy (noise offsets), opq (−0.25 clearer … +0.35 cloudier), warm (intensity bias), age (0 fresh honey … 1 deeper orange),
 *      sq (hand-ground beads are a little short along the drill axis: 0.95 … 1), lit (how much key light reaches it, 0.5 … 1), gloss }
 */
function shadeBead(rad, o, nz, lutClear, lutCloud) {
  const inner = Math.ceil(rad * 2) + 6, size = inner + SPAD * 2, c = size / 2;
  const img = new ImageData(size, size), d = img.data;
  const simg = new ImageData(size, size), sd = simg.data;
  const ax = Math.cos(o.axis), ay = Math.sin(o.axis);     // along the cord
  const ux = Math.sin(o.axis), uy = -Math.cos(o.axis);    // outward, away from the circle's centre: where the back light spills over the limb
  const fa = Math.cos(o.flow), fb = Math.sin(o.flow), ga = Math.cos(o.flow + 0.9), gb = Math.sin(o.flow + 0.9);
  const ox = o.ox, oy = o.oy;
  const dim = (1 - o.lit) / 0.5, mr = 1 - 0.2 * dim, mg = 1 - 0.44 * dim, mb = 1 - 0.6 * dim;   // out of the pool of light the honey deepens to amber
  for (let j = SPAD; j < size - SPAD; j++) {
    const Y = (j + 0.5 - c) / rad;
    for (let i = SPAD; i < size - SPAD; i++) {
      const X = (i + 0.5 - c) / rad;
      const al = (X * ax + Y * ay) / o.sq, pe = -X * ay + Y * ax, aal = al < 0 ? -al : al;
      const x = al * ax - pe * ay, y = al * ay + pe * ax, r2 = x * x + y * y, rr = Math.sqrt(r2);
      const cov = (1 - rr) * rad + 0.5;
      if (cov <= 0) continue;
      const z = r2 < 1 ? Math.sqrt(1 - r2) : 0;

      // ── inclusions: a layer wrapped on the sphere (compressed toward the limb) + a deeper, magnified, softer one ──
      const k = rr > 1e-3 ? Math.asin(rr < 1 ? rr : 1) / rr : 1;
      const sx = x * k, sy = y * k;
      const px = sx * fa + sy * fb, py = -sx * fb + sy * fa;
      const w1 = nz.fbm(px * 0.62 + ox, py * 0.62 + oy, 2), w2 = nz.fbm(px * 0.62 + ox + 5.2, py * 0.62 + oy - 3.7, 2);
      const c1 = nz.fbm(px * 0.5 + 1.05 * w1 + ox * 1.7, py * 1.3 + 1.05 * w2 - oy * 1.3, 3, 2.1, 0.5);
      const qx = (x * ga + y * gb) * 0.6, qy = (-x * gb + y * ga) * 0.6;
      const v1 = nz.n2(qx * 0.9 - ox, qy * 0.9 + oy * 0.7);
      const c2 = nz.fbm(qx * 0.8 + 1.1 * v1 + ox * 0.3 + 9, qy * 1.4 - 1.1 * v1 + oy + 4, 2);
      const cloud = 0.3 + 0.7 * sstep(-0.42, 0.52, c1 * 0.62 + c2 * 0.5 + o.opq);   // 蜜蜡 is never quite clear: even its honey veins are milky
      let fil = 1 - Math.abs(nz.n2(px * 1.15 + 2.0 * w1 + ox * 2.1, py * 3.3 + 2.0 * w2 + oy * 0.9));
      fil *= fil; fil *= fil; fil *= fil;                                  // thin streaming filaments

      // ── light ──
      const ndl = x * LK[0] + y * LK[1] + z * LK[2];
      let dif = L.clamp((ndl + 0.5) / 1.5);                                  // wax: the terminator wraps far round
      dif = dif * Math.sqrt(dif);
      const s = -(x * LXY[0] + y * LXY[1]), t = x * LXY[1] - y * LXY[0];     // s = +1 at the limb farthest from the light
      const tg = Math.exp(-((s - 0.6) * (s - 0.6)) / 0.08) * Math.exp(-(t * t) / 0.52) * sstep(1.0, 0.8, rr);   // light that crossed the bead
      const up = L.clamp(0.5 + 0.5 * (x * ux + y * uy) / (rr + 1e-4));
      const rim = Math.pow(1 - z, 1.35) * (0.07 + 0.93 * up * up);           // back light through the thin limb
      const iClear = 0.125 + 0.31 * dif + 0.62 * tg + 0.74 * rim;
      const iCloud = 0.15 + 0.42 * dif + 0.42 * tg + 0.6 * rim;
      let I = iClear + (iCloud - iClear) * cloud + o.warm;
      I += 0.3 * Math.pow(1 - z, 5) * up * up * up;                         // the crown burns brightest against the dark
      I -= 0.1 * Math.pow(1 - z, 1.4) * (1 - up);                            // … the bead turns away into shadow underneath
      I += 0.06 * Math.pow(1 - z, 3) * (1 - up) * (1 - up);                  // … and picks up the glow of the coils below along its lower edge
      I += 0.075 * fil * sstep(0.35, 0.8, cloud) * (0.4 + dif);
      // the skin of old wax-amber is never glassy: a fine orange-peel, compressed toward the limb like everything on a ball
      const peel = 0.6 * nz.n2(sx * 30 + ox, sy * 30 - oy) + 0.4 * nz.n2(sx * 64 - oy, sy * 64 + ox);
      I += 0.022 * peel * (0.45 + dif);

      // ── reflections (computed on a normal roughened by the same orange-peel) ──
      const mx = x + 0.016 * peel, my = y + 0.016 * nz.n2(sx * 30 - oy + 7.3, sy * 30 + ox + 2.9);
      const mz2 = 1 - mx * mx - my * my, mz = mz2 > 0 ? Math.sqrt(mz2) : 0;
      const rx = 2 * mz * mx, ry = 2 * mz * my, rz = 2 * mz * mz - 1;
      const dk = rx * LK[0] + ry * LK[1] + rz * LK[2];
      let box = 0;
      if (dk > 0.15) {
        const a = (rx * SU[0] + ry * SU[1] + rz * SU[2]) / dk, b = (rx * SV[0] + ry * SV[1] + rz * SV[2]) / dk;
        const aa = a < 0 ? -a : a, bb = b < 0 ? -b : b;
        box = 0.6 * sstep(0.9, 0.26, aa) * sstep(0.64, 0.14, bb)           // the soft box itself, well feathered: wax, not glass …
          + 0.4 * sstep(0.44, 0.16, aa) * sstep(0.3, 0.08, bb);            // … with a small hot heart
        I += 0.17 * Math.exp(-(a * a) / 1.5 - (b * b) / 0.9);                // … and the broad waxy sheen around it
      }
      const df = rx * LF[0] + ry * LF[1] + rz * LF[2];
      if (df > 0.86) I += 0.07 * sstep(0.86, 0.97, df) * sstep(1.0, 0.8, rr);   // the reflector card, barely there

      // the neighbours: a warm bounce on either flank, darkness where the beads actually touch
      I += 0.06 * Math.exp(-((aal - 0.72) * (aal - 0.72)) / 0.022 - (pe * pe) / 0.34);
      I -= 0.15 * Math.exp(-((al + 0.93) * (al + 0.93)) / 0.05 - ((pe - 0.1) * (pe - 0.1)) / 0.3);   // the left-hand neighbour stands in the key light
      I -= 0.06 * Math.exp(-((al - 0.97) * (al - 0.97)) / 0.02 - (pe * pe) / 0.2);
      // the drill channel shows faintly through the clear parts; its two mouths sit on the limb where the cord enters
      I -= 0.07 * Math.exp(-(pe * pe) / 0.004) * (1 - 0.8 * cloud) * sstep(1.0, 0.84, aal);
      const hole = Math.exp(-((aal - 0.99) * (aal - 0.99)) / 0.004 - (pe * pe) / 0.012);
      I *= 1 - 0.7 * hole;

      I = I < 0 ? 0 : I > 1 ? 1 : I;
      const li = ((I * (NL - 1)) | 0) * 3;
      let cr = lutClear[li] + (lutCloud[li] - lutClear[li]) * cloud;
      let cg = lutClear[li + 1] + (lutCloud[li + 1] - lutClear[li + 1]) * cloud;
      let cb = lutClear[li + 2] + (lutCloud[li + 2] - lutClear[li + 2]) * cloud;
      const sat = tg * (1 - 0.5 * cloud);                                  // transmitted light comes out deeper in colour
      cr *= mr; cg *= (1 - 0.085 * o.age) * (1 - 0.05 * sat) * mg; cb *= (1 - 0.3 * o.age) * (1 - 0.32 * sat) * mb;
      const o4 = (j * size + i) * 4, al8 = (cov > 1 ? 1 : cov) * 255;
      d[o4] = cr; d[o4 + 1] = cg; d[o4 + 2] = cb; d[o4 + 3] = al8;
      if (box > 0.004) { sd[o4] = 255; sd[o4 + 1] = 250; sd[o4 + 2] = 232; sd[o4 + 3] = box * (0.9 + 0.1 * peel) * al8 * o.gloss; }
    }
  }
  const base = L.makeCanvas(size, size), g = base.getContext('2d');
  g.putImageData(img, 0, 0);
  const spec = L.makeCanvas(size, size);
  spec.getContext('2d').putImageData(simg, 0, 0);
  // a few small bubbles: dark meniscus toward the light, a bright point on the far side
  const r = L.rng('bub' + o.ox);
  const nb = r.int(1, 3);
  g.globalCompositeOperation = 'source-atop';
  for (let n = 0; n < nb; n++) {
    const ang = r.range(0, L.TAU), dist = Math.sqrt(r()) * 0.62 * rad, br = r.range(2.2, 4.2) * (r.chance(0.25) ? 1.5 : 1);
    const bx = c + Math.cos(ang) * dist, by = c + Math.sin(ang) * dist;
    g.fillStyle = 'rgba(255,236,160,0.2)'; g.beginPath(); g.arc(bx, by, br, 0, L.TAU); g.fill();
    g.strokeStyle = 'rgba(90,40,6,0.55)'; g.lineWidth = Math.max(0.9, br * 0.32);
    g.beginPath(); g.arc(bx, by, br, Math.PI * 0.95, Math.PI * 1.95); g.stroke();
    g.fillStyle = 'rgba(255,250,222,0.9)'; g.beginPath(); g.arc(bx + br * 0.34, by + br * 0.38, br * 0.36, 0, L.TAU); g.fill();
  }
  // hairline wear from generations of handling: a bright lip with a darker groove beside it
  const ns = r.int(3, 6);
  g.lineCap = 'round';
  for (let n = 0; n < ns; n++) {
    const ang = r.range(0, L.TAU), dist = Math.sqrt(r()) * 0.74 * rad, dir = r.range(0, Math.PI), len = r.range(0.14, 0.5) * rad, bend = r.range(-0.22, 0.22) * len;
    const x0 = c + Math.cos(ang) * dist - Math.cos(dir) * len / 2, y0 = c + Math.sin(ang) * dist - Math.sin(dir) * len / 2;
    const x1 = x0 + Math.cos(dir) * len, y1 = y0 + Math.sin(dir) * len, mx = (x0 + x1) / 2 - Math.sin(dir) * bend, my = (y0 + y1) / 2 + Math.cos(dir) * bend;
    const al = r.range(0.04, 0.12);
    g.lineWidth = 0.9;
    g.strokeStyle = `rgba(84,38,6,${al * 0.9})`; g.beginPath(); g.moveTo(x0 + 0.6, y0 + 0.8); g.quadraticCurveTo(mx + 0.6, my + 0.8, x1 + 0.6, y1 + 0.8); g.stroke();
    g.strokeStyle = `rgba(255,246,208,${al})`; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.stroke();
  }
  // one or two shallow dings
  const nd = r.int(0, 2);
  for (let n = 0; n < nd; n++) {
    const ang = r.range(0, L.TAU), dist = Math.sqrt(r()) * 0.7 * rad, pr = r.range(1.6, 3.2);
    const bx = c + Math.cos(ang) * dist, by = c + Math.sin(ang) * dist;
    g.fillStyle = 'rgba(70,30,4,0.4)'; g.beginPath(); g.ellipse(bx, by, pr, pr * 0.7, r.range(0, 3), 0, L.TAU); g.fill();
    g.fillStyle = 'rgba(255,244,200,0.4)'; g.beginPath(); g.ellipse(bx + pr * 0.5, by + pr * 0.6, pr * 0.8, pr * 0.3, 0.6, 0, L.TAU); g.fill();
  }
  // dust: no bead in front of a macro lens is ever clean
  const nk = r.int(3, 7);
  for (let n = 0; n < nk; n++) {
    const ang = r.range(0, L.TAU), dist = Math.sqrt(r()) * 0.8 * rad, sz = r.range(0.7, 1.6);
    const bx = c + Math.cos(ang) * dist, by = c + Math.sin(ang) * dist;
    g.fillStyle = 'rgba(60,26,4,0.3)'; g.beginPath(); g.arc(bx + 0.9, by + 1.1, sz, 0, L.TAU); g.fill();
    g.fillStyle = `rgba(255,248,225,${r.range(0.4, 0.75)})`; g.beginPath(); g.arc(bx, by, sz, 0, L.TAU); g.fill();
  }
  return { base: softLimb(base, c, rad, 2.2), spec, c, rad };
}

/** the plane of focus lies on the bead's near surface: its outline, a radius farther away, is already a touch soft */
function softLimb(src, c, rad, px) {
  const w = src.width, h = src.height;
  const mask = (g) => L.radial(g, c, c, rad * 0.52, rad * 1.03, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]);
  const soft = L.blurred(src, px), sg = soft.getContext('2d');
  sg.globalCompositeOperation = 'destination-in'; sg.fillStyle = mask(sg); sg.fillRect(0, 0, w, h);
  const out = L.makeCanvas(w, h), og = out.getContext('2d');
  og.drawImage(src, 0, 0);
  og.globalCompositeOperation = 'destination-out'; og.fillStyle = mask(og); og.fillRect(0, 0, w, h);   // sharp × (1 − m) …
  og.globalCompositeOperation = 'lighter'; og.drawImage(soft, 0, 0);                                    // … + soft × m
  return out;
}

/** the bit of cord between two beads (drawn along +x, centred), defocused like the beads beside it */
function cordSprite(gap, coc) {
  const hw = gap / 2 + 16, th = 7.5, m = 30;
  const c = L.makeCanvas(Math.ceil(hw * 2 + m * 2), Math.ceil(th * 2 + m * 2)), g = c.getContext('2d');
  g.translate(c.width / 2, c.height / 2);
  g.beginPath(); g.rect(-hw, -th, hw * 2, th * 2); g.clip();
  g.fillStyle = L.linear(g, 0, -th, 0, th, [[0, '#6e3a08'], [0.3, '#e6a53a'], [0.5, '#c98420'], [1, '#3a1704']]);
  g.fillRect(-hw, -th, hw * 2, th * 2);
  g.lineWidth = 1.5; g.lineCap = 'butt';
  for (let u = -hw - 8; u < hw + 8; u += 4.6) {
    g.strokeStyle = 'rgba(58,22,3,0.6)'; g.beginPath(); g.moveTo(u, th); g.lineTo(u + 6.5, -th); g.stroke();
    g.strokeStyle = 'rgba(255,222,140,0.5)'; g.beginPath(); g.moveTo(u + 1.9, th); g.lineTo(u + 8.4, -th); g.stroke();
  }
  return coc >= 1 ? L.blurred(c, coc * 0.55) : c;
}

/** circle of confusion (px) of a bead of the focused strand: sharp at the crest, opening toward both ends of the frame */
const cocOf = (th) => 12.5 * Math.pow(L.clamp((Math.abs(th) - 0.1) / 0.31), 1.2);
/** how much of the key light reaches a point of the strand: the pool of light sits just left of the crest */
const fallOf = (x) => 1 - 0.5 * sstep(330, 1150, Math.abs(x - (W / 2 - 110)));

/** the strand in focus: cord + beads + their own bloom */
function buildStrand(env, lutClear, lutCloud) {
  const a = env.arc, nz = L.makeNoise('s02amber'), r = L.rng('s02beads');
  const lim = a.span(PAD + 20);
  // lay the beads out from the crest both ways: equal beads (a few percent apart), all threaded on the same line
  const mk = () => ({
    rad: BR * (1 + r.range(-0.03, 0.022)), sq: r.range(0.95, 0.995), gap: GAP * r.range(0.7, 1.35), flow: r.range(-0.9, 0.9), ox: r.range(-40, 40), oy: r.range(-40, 40),
    opq: r.range(-0.25, 0.36), warm: r.range(-0.03, 0.03), age: Math.pow(r(), 1.4), gloss: r.range(0.78, 1),
  });
  const beads = [];
  const first = mk(); first.th = 0; first.rad = BR; first.sq = 0.985; first.opq = 0.12; first.age *= 0.5; beads.push(first);
  for (const dir of [1, -1]) {
    let prev = first;
    while (Math.abs(prev.th) < lim) {
      const b = mk();
      b.th = prev.th + dir * (prev.rad * prev.sq + b.rad * b.sq + (dir > 0 ? prev.gap : b.gap)) / (a.R - BR);
      beads.push(b); prev = b;
    }
  }
  beads.sort((p, q) => p.th - q.th);
  for (const b of beads) {
    const p = a.pt(b.th, -BR);
    b.x = p.x; b.y = p.y;
    b.axis = b.th; b.lit = fallOf(b.x);
    b.sharp = shadeBead(b.rad, b, nz, lutClear, lutCloud);
    b.coc = cocOf(b.th);
    b.spr = b.coc < 1 ? b.sharp : { base: lensBlur(b.sharp.base, b.coc, 20), spec: lensBlur(b.sharp.spec, b.coc, 20, 1.5), c: b.sharp.c, rad: b.rad };
  }

  const X0 = -PAD, Y0 = Math.floor(a.crestY) - 110;
  const BW = W + PAD * 2, BH = Math.ceil(a.yAt(-PAD) + BR * 2 + 60) - Y0;
  const row = makeBand(X0, Y0, BW, BH, (g) => {
    // the cord: a twist of yellow silk, seen only in the gaps
    for (let i = 0; i < beads.length - 1; i++) {
      const b0 = beads[i], b1 = beads[i + 1];
      const thm = (b0.th + b0.rad * b0.sq / (a.R - BR) + b1.th - b1.rad * b1.sq / (a.R - BR)) / 2;
      const spr = cordSprite(b0.gap, cocOf(thm));
      a.at(g, thm, -BR, () => g.drawImage(spr, -spr.width / 2, -spr.height / 2));
    }
    // beads: the soft ones first, the sharp ones over them
    for (const b of [...beads].sort((p, q) => q.coc - p.coc)) g.drawImage(b.spr.base, b.x - b.spr.c, b.y - b.spr.c);
  });
  const bloom = L.blurred(row, 12);
  const halo = L.blurred(row, 30), hg = halo.getContext('2d');
  hg.translate(-X0, -Y0);
  hg.globalCompositeOperation = 'destination-in';     // the bloom belongs to the air above the strand; keep the seam under it dark
  hg.fillStyle = L.radial(hg, a.cx, a.cy, a.R - BR * 2 - 20, a.R - BR * 0.6, [[0, 'rgba(0,0,0,0.1)'], [1, 'rgba(0,0,0,1)']]);
  hg.fillRect(X0, Y0, BW, BH);
  const strand = makeBand(X0, Y0, BW, BH, (g) => {
    g.globalAlpha = 0.34; g.drawImage(halo, X0, Y0);
    g.globalAlpha = 1; g.drawImage(row, X0, Y0);
    g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.16; g.drawImage(bloom, X0, Y0);
  });
  return { strand, beads };
}

/** the nearer coils of the strand — lower in the frame, closer to the lens, far out of focus: honey blobs deepening to amber brown */
function buildFront(env, beads) {
  const a = env.arc, SC = 0.5;
  const X0 = -PAD, Y0 = Math.floor(a.crestY) + BR * 2 - 150, BW = W + PAD * 2, BH = H + 70 - Y0;
  const rows = [
    { rad: 146, dr: -(BR * 2) - 146 - 2, blur: 40, tint: '#ecd6a4', rim: '#ffe296', disc: '#ffc23e', da: 0.3 },
    { rad: 190, dr: -(BR * 2) - 146 - 2 - 262, blur: 68, tint: '#dcaa6a', rim: '#ffc066', disc: '#ffae36', da: 0.2 },
  ];
  const r = L.rng('s02front');
  const lim = a.span(PAD + 360);
  const pool = beads.filter((b) => b.lit > 0.86);          // the honey ones from the pool of light
  return makeBand(X0, Y0, BW, BH, (g) => {
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    for (const rw of rows) {
      const half = L.makeCanvas(Math.ceil(BW * SC), Math.ceil(BH * SC)), hg = half.getContext('2d');
      hg.scale(SC, SC); hg.translate(-X0, -Y0);
      const step = (rw.rad * 2 + 8) / (a.R + rw.dr), pts = [];
      for (let th = -lim + r.range(0, step); th < lim; th += step * r.range(0.985, 1.04)) {
        const b = pool[r.int(0, pool.length - 1)].sharp, rad = rw.rad * (1 + r.range(-0.04, 0.03));
        const p = a.pt(th, rw.dr + r.range(-6, 6)), f = rad / b.rad, sz = b.base.width * f;
        hg.drawImage(b.base, p.x - sz / 2, p.y - sz / 2, sz, sz);
        hg.drawImage(b.spec, p.x - sz / 2, p.y - sz / 2, sz, sz);
        pts.push({ cx: p.x, cy: p.y, rad, th, x: p.x + rad * HV[0], y: p.y + rad * HV[1], k: r.range(0.5, 1), sz: r.range(0.85, 1.12) });
      }
      const tinted = multiplyKeepAlpha(half, (tg) => { tg.fillStyle = rw.tint; tg.fillRect(0, 0, half.width, half.height); });
      // back light on the crown of every bead of the coil → after the blur, a soft luminous arc along the top of each band
      const tg2 = tinted.getContext('2d');
      tg2.globalCompositeOperation = 'source-atop'; tg2.scale(SC, SC); tg2.translate(-X0, -Y0);
      tg2.lineCap = 'round'; tg2.strokeStyle = rw.rim; tg2.lineWidth = rw.rad * 0.1;
      for (const q of pts) { tg2.beginPath(); tg2.arc(q.cx, q.cy, q.rad - rw.rad * 0.06, q.th - Math.PI / 2 - 1.05, q.th - Math.PI / 2 + 0.8); tg2.stroke(); }
      const bl = lensBlur(tinted, rw.blur * SC, 30);
      const bg = bl.getContext('2d');                        // a little more punch: the blur has averaged the lights and darks away
      bg.globalCompositeOperation = 'overlay'; bg.globalAlpha = 0.38; bg.drawImage(bl, 0, 0);
      g.drawImage(bl, X0, Y0, BW, BH);
      // each bead's highlight opens into a disc of confusion
      g.globalCompositeOperation = 'screen';
      for (const q of pts) {
        const al = rw.da * q.k * fallOf(q.x), br = (rw.blur * 0.8 + 16) * q.sz;
        g.fillStyle = L.radial(g, q.x, q.y, 0, br, [[0, L.rgba(rw.disc, al * 0.82)], [0.74, L.rgba(rw.disc, al)], [0.9, L.rgba(rw.disc, al * 0.8)], [1, L.rgba(rw.disc, 0)]]);
        g.beginPath(); g.arc(q.x, q.y, br, 0, L.TAU); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
    }
    // deeper toward the bottom of the frame and away from the pool of light
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 620, a.R - 240, [[0, 'rgba(52,17,2,0.8)'], [0.55, 'rgba(52,17,2,0.3)'], [1, 'rgba(52,17,2,0)']]);
    g.fillRect(X0, Y0, BW, BH);
    g.fillStyle = L.radial(g, W / 2 - 110, a.crestY + 260, 420, 1250, [[0, 'rgba(60,18,1,0)'], [0.5, 'rgba(60,18,1,0.22)'], [1, 'rgba(60,18,1,0.46)']]);
    g.fillRect(X0, Y0, BW, BH);
    g.globalCompositeOperation = 'source-over';
  });
}

/** dust hanging in the dark: pin-points and a few defocused discs; brighter near the lit strand */
function buildDust(env, seed, count, big) {
  const a = env.arc, r = L.rng(seed);
  return makeBand(-80, -80, W + 160, 900, (g) => {
    for (let i = 0; i < count; i++) {
      const x = r.range(-70, W + 70), y = r.range(-70, 800);
      const dr = a.drAt(x, y);
      const col = r.pick(['#ffe9b0', '#fff6e0', '#ffe08a', '#f2c25a']);
      const near = 0.35 + 0.65 * Math.exp(-Math.max(0, dr) / 300);
      const keep = r();
      if (dr < 16 || (!big && keep > 0.3 + 0.7 * Math.exp(-dr / 240))) continue;
      if (big) {
        const rad = r.range(4, 14), al = r.range(0.035, 0.11) * near;
        g.fillStyle = L.radial(g, x, y, 0, rad, [[0, L.rgba(col, al * 0.8)], [0.72, L.rgba(col, al)], [0.9, L.rgba(col, al * 1.25)], [1, L.rgba(col, 0)]]);
        g.beginPath(); g.arc(x, y, rad, 0, L.TAU); g.fill();
      } else {
        const rad = L.lerp(0.6, 2.1, Math.pow(r(), 2.4)), al = r.range(0.12, 0.6) * near;
        if (rad > 1.3) { g.fillStyle = L.radial(g, x, y, 0, rad * 4, [[0, L.rgba(col, al * 0.3)], [1, L.rgba(col, 0)]]); g.beginPath(); g.arc(x, y, rad * 4, 0, L.TAU); g.fill(); }
        g.fillStyle = L.rgba(col, al); g.beginPath(); g.arc(x, y, rad, 0, L.TAU); g.fill();
      }
    }
    if (!big) {
      // a few floating fibres
      g.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const x = r.range(60, W - 60), y = r.range(40, 620), dr = a.drAt(x, y);
        if (dr < 50) continue;
        const dir = r.range(0, L.TAU), len = r.range(12, 30), bend = r.range(-9, 9);
        g.strokeStyle = L.rgba('#ffe9b0', r.range(0.1, 0.22) * (0.4 + 0.6 * Math.exp(-dr / 300))); g.lineWidth = r.range(0.7, 1.1);
        g.beginPath(); g.moveTo(x, y);
        g.quadraticCurveTo(x + Math.cos(dir) * len / 2 - Math.sin(dir) * bend, y + Math.sin(dir) * len / 2 + Math.cos(dir) * bend, x + Math.cos(dir) * len, y + Math.sin(dir) * len);
        g.stroke();
      }
    }
  });
}

/** a twinkling mote: white core, honey skirt */
function buildMote() {
  const n = 64, c = L.makeCanvas(n, n), g = c.getContext('2d');
  g.fillStyle = L.radial(g, n / 2, n / 2, 0, n / 2, [[0, 'rgba(255,244,214,0.85)'], [0.16, 'rgba(255,230,160,0.4)'], [1, 'rgba(255,224,138,0)']]);
  g.fillRect(0, 0, n, n);
  return c;
}

export default {
  name: '蜜蜡珠串',
  tone: 'light',
  init(env) {
    const a = env.arc;
    const { strand, beads } = buildStrand(env, makeLut(CLEAR), makeLut(CLOUD));
    const front = buildFront(env, beads);
    const rt = L.rng('s02twinkle'), motes = [];
    while (motes.length < 14) {
      const x = rt.range(40, W - 40), y = rt.range(30, 640);
      if (a.drAt(x, y) < 40) continue;
      motes.push({ x, y, rad: rt.range(1, 2.4), ph: rt(), k: rt.range(0.4, 1), vx: rt.range(-10, 10), vy: rt.range(-16, -4) });
    }
    S = {
      strand, front, motes, mote: buildMote(),
      beads: beads.map((b) => ({ th: b.th, rad: b.rad, spec: b.spr.spec, c: b.spr.c, fall: fallOf(b.x) })),
      dustFar: buildDust(env, 's02dustA', 420, false),
      dustNear: buildDust(env, 's02dustB', 26, true),
    };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.011, 0.011, p);
    ctx.fillStyle = '#070605'; ctx.fillRect(0, 0, W, H);
    // the strand's glow hanging in the air just above it
    ctx.fillStyle = L.radial(ctx, a.cx, a.cy, a.R - 40, a.R + 300, [[0, 'rgba(206,122,24,0.12)'], [0.3, 'rgba(150,78,12,0.045)'], [1, 'rgba(90,42,8,0)']]);
    ctx.fillRect(0, 0, W, H);
    // dust: far motes barely move, the defocused near ones drift up and across
    blitBand(ctx, env, S.dustFar, { dx: 5 * (p - 0.5), dy: -8 * (p - 0.5) });
    blitBand(ctx, env, S.dustNear, { dx: -14 * (p - 0.5), dy: -20 * (p - 0.5) });
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const m of S.motes) {
      const tw = (0.2 + 0.8 * Math.pow(0.5 + 0.5 * Math.sin((p * 1.3 + m.ph) * L.TAU), 2)) * m.k;
      const x = m.x + m.vx * (p - 0.5), y = m.y + m.vy * (p - 0.5), rr = m.rad * 7;
      ctx.globalAlpha = tw;
      ctx.drawImage(S.mote, x - rr, y - rr, rr * 2, rr * 2);
    }
    ctx.restore();

    // warm darkness under the strand and between the coils
    ctx.fillStyle = L.radial(ctx, a.cx, a.cy, a.R - 760, a.R - BR * 0.8, [[0, '#1b0902'], [0.5, '#3a1504'], [0.8, 'rgba(78,30,5,0.92)'], [1, 'rgba(78,30,5,0)']]);
    ctx.fillRect(0, a.crestY, W, H - a.crestY);
    // the strand in focus
    blitBand(ctx, env, S.strand, { rot });
    // soft-box reflections: one per bead, sliding across it as the strand turns; a gleam travels along the row
    const sweep = L.lerp(-0.2, -0.02, p), vis = a.span(160);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const b of S.beads) {
      const th = b.th + rot;
      if (th < -vis || th > vis) continue;
      const c = a.pt(th, -BR), sh = -0.15 * (p - 0.5) * b.rad;
      const g = Math.exp(-((th - sweep) * (th - sweep)) / 0.03);
      ctx.globalAlpha = b.fall * (0.8 + 0.2 * g);
      ctx.drawImage(b.spec, c.x - b.c + sh * Math.cos(th), c.y - b.c + sh * Math.sin(th));
    }
    ctx.restore();
    // the nearer coils, out of focus, in front of it (closer to the lens → they slide a little faster)
    blitBand(ctx, env, S.front, { rot: rot * 1.5 });

    const gl = a.pt(sweep, -70);
    L.glow(ctx, gl.x, gl.y, 330, '#ffd270', 0.13);
    L.vignette(ctx, { strength: 0.3, inner: 0.5 });
  },
};
