// s02 — 蜜蜡珠串 (macro). The arc is the envelope of a strand of honey-amber beads: ten or so round beads sit
// shoulder to shoulder along it, every bead's crown tangent to the arc, a thin cord and a dark notch between neighbours.
// Below, the inner coils of the same strand fall out of focus into honey-coloured concentric bands that deepen to amber brown;
// above, black with a little lit dust.
//
// Each bead is shaded per pixel in init(): a wax-like translucent sphere (wrapped diffuse from the upper left, light that has
// crossed the bead glowing in the opposite lower crescent, back light spilling over the outward limb) with cloudy, streaming
// inclusions (云絮状流纹) — the opaque wisps answer the key light, the clear honey between them answers the transmitted light.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 150;
const BR = 88;      // bead radius (px) → about ten and a half beads across the frame
const GAP = 9;      // length of cord showing between two beads
let S = null;

const sstep = (a, b, v) => { const t = L.clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// key light (unit vector, screen space: −y is up, +z toward the lens) and its half-vector with the view direction
const LK = [-0.30, -0.80, 0.52];
const HV = (() => { const m = Math.hypot(LK[0], LK[1], LK[2] + 1); return [LK[0] / m, LK[1] / m, (LK[2] + 1) / m]; })();
const LXY = (() => { const m = Math.hypot(LK[0], LK[1]); return [LK[0] / m, LK[1] / m]; })();

// intensity → colour: black-brown → 深琥珀褐 → 琥珀 → 蜜黄 → 透光亮部 → near white
const NL = 640;
function makeLut() {
  const f = L.makeRamp([[0, '#140702'], [0.12, '#5a2a08'], [0.28, '#a2530f'], [0.4, '#c9781a'], [0.6, '#f2b632'], [0.83, '#ffe08a'], [1, '#fff6cf']]);
  const out = new Float32Array(NL * 3);
  for (let i = 0; i < NL; i++) { const c = f(i / (NL - 1)); out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2]; }
  return out;
}

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
/** defocus with a disc-shaped kernel (flat-topped, like a lens wide open) */
function lensBlur(src, radius, n = 22) {
  const c = L.makeCanvas(src.width, src.height), g = c.getContext('2d');
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 / n;   // additive → a true average, transparent samples included
  for (let i = 0; i < n; i++) {
    const rr = radius * Math.sqrt((i + 0.5) / n), th = i * 2.399963;
    g.drawImage(src, Math.cos(th) * rr, Math.sin(th) * rr);
  }
  return L.blurred(c, Math.max(0.6, radius * 0.22));
}

/** multiply `src` by an opaque tint painted by `paint(g)` while keeping src's alpha (plain 'multiply' would also paint the transparent parts) */
function multiplyKeepAlpha(src, paint) {
  const c = L.makeCanvas(src.width, src.height), g = c.getContext('2d');
  paint(g);
  g.globalCompositeOperation = 'multiply'; g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'destination-in'; g.drawImage(src, 0, 0);
  return c;
}

/**
 * One bead, shaded per pixel. o: { axis (angle of the cord on screen = the bead's theta on the arc), flow (direction of the
 * streaming inclusions), ox, oy (noise offsets), opq (−0.2 clearer … +0.34 cloudier), warm (intensity bias),
 * age (0 = fresh lemon-honey … 1 = the deeper orange of an older bead) }
 */
function shadeBead(rad, o, nz, lut) {
  const size = Math.ceil(rad * 2) + 6, c = size / 2;
  const img = new ImageData(size, size), d = img.data;
  const ax = Math.cos(o.axis), ay = Math.sin(o.axis);     // along the cord
  const ux = Math.sin(o.axis), uy = -Math.cos(o.axis);    // outward, away from the circle's centre: where the back light spills over the limb
  const fa = Math.cos(o.flow), fb = Math.sin(o.flow), ga = Math.cos(o.flow + 0.9), gb = Math.sin(o.flow + 0.9);
  const ox = o.ox, oy = o.oy;
  for (let j = 0; j < size; j++) {
    const y = (j + 0.5 - c) / rad;
    for (let i = 0; i < size; i++) {
      const x = (i + 0.5 - c) / rad, r2 = x * x + y * y, rr = Math.sqrt(r2);
      const cov = (1 - rr) * rad + 0.5;
      if (cov <= 0) continue;
      const z = r2 < 1 ? Math.sqrt(1 - r2) : 0;

      // ── inclusions. A layer wrapped on the sphere (compressed toward the limb) + a deeper, magnified one ──
      const k = rr > 1e-3 ? Math.asin(rr < 1 ? rr : 1) / rr : 1;
      const sx = x * k, sy = y * k;
      const px = sx * fa + sy * fb, py = -sx * fb + sy * fa;
      const w1 = nz.fbm(px * 0.8 + ox, py * 0.8 + oy, 2), w2 = nz.fbm(px * 0.8 + ox + 5.2, py * 0.8 + oy - 3.7, 2);
      const c1 = nz.fbm(px * 0.7 + 0.9 * w1 + ox * 1.7, py * 1.9 + 0.9 * w2 - oy * 1.3, 4, 2.1, 0.55);
      const qx = (x * ga + y * gb) * 0.72, qy = (-x * gb + y * ga) * 0.72;
      const v1 = nz.fbm(qx * 1.1 - ox, qy * 1.1 + oy * 0.7, 2);
      const c2 = nz.fbm(qx * 0.9 + 1.2 * v1 + ox * 0.3 + 9, qy * 1.7 - 1.2 * v1 + oy + 4, 3);
      const cloud = sstep(-0.3, 0.4, c1 * 0.62 + c2 * 0.5 + o.opq);
      let fil = 1 - Math.abs(nz.n2(px * 1.5 + 2.0 * w1 + ox * 2.1, py * 4.4 + 2.0 * w2 + oy * 0.9));
      fil *= fil; fil *= fil; fil *= fil;                                  // thin streaming filaments
      let fil2 = 1 - Math.abs(nz.n2(px * 3.1 + 2.4 * w2 - ox * 1.3, py * 7.5 + 2.4 * w1 + oy * 2.2));
      fil2 *= fil2; fil2 *= fil2; fil2 *= fil2;                            // … and a finer set between them

      // ── light ──
      const ndl = x * LK[0] + y * LK[1] + z * LK[2];
      const dif = L.clamp((ndl + 0.55) / 1.55);                              // wax: the terminator wraps far round
      const s = -(x * LXY[0] + y * LXY[1]), t = x * LXY[1] - y * LXY[0];     // s = +1 at the limb farthest from the light
      const tg = Math.exp(-((s - 0.5) * (s - 0.5)) / 0.115) * Math.exp(-(t * t) / 0.66) * sstep(1.0, 0.8, rr);   // light that crossed the bead
      const up = L.clamp(0.5 + 0.5 * (x * ux + y * uy) / (rr + 1e-4));
      const rim = Math.pow(1 - z, 1.6) * (0.18 + 0.82 * up * up);            // back light through the thin limb
      const ndh = x * HV[0] + y * HV[1] + z * HV[2];
      const sheen = ndh > 0 ? Math.pow(ndh, 16) : 0;                         // broad waxy lustre (the hot core is drawn live)
      const hot = Math.exp(-((s - 0.6) * (s - 0.6)) / 0.022 - (t * t) / 0.16) * sstep(1.0, 0.86, rr);   // … and comes to a soft focus
      const iClear = 0.14 + 0.31 * dif + 0.56 * tg + 0.2 * hot + 0.72 * rim + 0.12 * sheen;
      const iCloud = 0.25 + 0.45 * dif + 0.26 * tg + 0.08 * hot + 0.56 * rim + 0.2 * sheen;
      let I = iClear + (iCloud - iClear) * cloud + o.warm;
      I += 0.3 * Math.pow(1 - z, 5) * up * up * up;                        // the crown burns brightest against the dark
      I -= 0.1 * Math.pow(1 - z, 1.5) * (1 - up);                           // … and the bead turns away into shadow underneath
      I += (0.13 * fil + 0.075 * fil2) * sstep(0.08, 0.6, cloud) * (0.4 + dif);
      // the skin of old wax-amber is never glassy: a fine orange-peel, compressed toward the limb like everything on a ball
      I += 0.03 * (0.6 * nz.n2(sx * 34 + ox, sy * 34 - oy) + 0.4 * nz.n2(sx * 78 - oy, sy * 78 + ox)) * (0.45 + dif);
      // the drill channel shows faintly through the clear parts; its two mouths sit on the limb where the cord enters
      const al = x * ax + y * ay, pe = -x * ay + y * ax, aal = Math.abs(al);
      I -= 0.085 * Math.exp(-(pe * pe) / 0.0032) * (1 - 0.8 * cloud) * sstep(1.0, 0.86, aal);
      const hole = Math.exp(-((aal - 0.99) * (aal - 0.99)) / 0.0026 - (pe * pe) / 0.0075);
      I *= 1 - 0.62 * hole;

      I = I < 0 ? 0 : I > 1 ? 1 : I;
      const li = ((I * (NL - 1)) | 0) * 3;
      let cr = lut[li], cg = lut[li + 1], cb = lut[li + 2];
      // clear honey is deeper and more saturated; the cloudy wax is creamier
      const cl = 1 - cloud;
      cg *= (1 - 0.05 * cl) * (1 - 0.1 * o.age); cb *= (1 - 0.25 * cl) * (1 - 0.32 * o.age);
      cg += 5 * cloud * I; cb += 10 * cloud * I;
      const o4 = (j * size + i) * 4;
      d[o4] = cr; d[o4 + 1] = cg; d[o4 + 2] = cb; d[o4 + 3] = (cov > 1 ? 1 : cov) * 255;
    }
  }
  const cnv = L.makeCanvas(size, size), g = cnv.getContext('2d');
  g.putImageData(img, 0, 0);
  // a few tiny bubbles: dark meniscus toward the light, a bright point on the far side
  const r = L.rng('bub' + o.ox);
  const nb = r.int(1, 3);
  g.globalCompositeOperation = 'source-atop';
  for (let n = 0; n < nb; n++) {
    const ang = r.range(0, L.TAU), dist = Math.sqrt(r()) * 0.66 * rad, br = r.range(1.5, 3.4) * (r.chance(0.2) ? 1.5 : 1);
    const bx = c + Math.cos(ang) * dist, by = c + Math.sin(ang) * dist;
    g.fillStyle = 'rgba(255,238,170,0.22)'; g.beginPath(); g.arc(bx, by, br, 0, L.TAU); g.fill();
    g.strokeStyle = 'rgba(96,44,8,0.6)'; g.lineWidth = Math.max(0.8, br * 0.34);
    g.beginPath(); g.arc(bx, by, br, Math.PI * 0.95, Math.PI * 1.95); g.stroke();
    g.fillStyle = 'rgba(255,250,222,0.9)'; g.beginPath(); g.arc(bx + br * 0.34, by + br * 0.38, br * 0.36, 0, L.TAU); g.fill();
  }
  // hairline wear from generations of handling: a bright lip with a darker groove beside it
  const ns = r.int(6, 10);
  g.lineCap = 'round';
  for (let n = 0; n < ns; n++) {
    const ang = r.range(0, L.TAU), dist = Math.sqrt(r()) * 0.74 * rad, dir = r.range(0, Math.PI), len = r.range(0.14, 0.5) * rad, bend = r.range(-0.22, 0.22) * len;
    const x0 = c + Math.cos(ang) * dist - Math.cos(dir) * len / 2, y0 = c + Math.sin(ang) * dist - Math.sin(dir) * len / 2;
    const x1 = x0 + Math.cos(dir) * len, y1 = y0 + Math.sin(dir) * len, mx = (x0 + x1) / 2 - Math.sin(dir) * bend, my = (y0 + y1) / 2 + Math.cos(dir) * bend;
    const al = r.range(0.07, 0.2);
    g.lineWidth = 0.8;
    g.strokeStyle = `rgba(84,38,6,${al * 0.9})`; g.beginPath(); g.moveTo(x0 + 0.6, y0 + 0.8); g.quadraticCurveTo(mx + 0.6, my + 0.8, x1 + 0.6, y1 + 0.8); g.stroke();
    g.strokeStyle = `rgba(255,246,208,${al})`; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.stroke();
  }
  cnv._rad = rad; cnv._c = c;
  return cnv;
}

/** soft, waxy highlight (white core, honey skirt) */
function buildHighlight() {
  const n = 128, c = L.makeCanvas(n, n), g = c.getContext('2d');
  g.fillStyle = L.radial(g, n / 2, n / 2, 0, n / 2, [[0, 'rgba(255,255,248,1)'], [0.2, 'rgba(255,253,236,0.96)'], [0.4, 'rgba(255,242,190,0.45)'], [0.7, 'rgba(255,226,140,0.1)'], [1, 'rgba(255,224,138,0)']]);
  g.fillRect(0, 0, n, n);
  return c;
}
/** the highlight sits where the bead's normal equals the half-vector; `shift` slides it along the cord (in radii) */
function putHighlight(g, hi, x, y, rad, th, shift, alpha) {
  const hx = x + rad * (HV[0] + shift * Math.cos(th)), hy = y + rad * (HV[1] + shift * Math.sin(th));
  g.save();
  g.translate(hx, hy); g.rotate(Math.atan2(HV[1], HV[0]) + Math.PI / 2);
  g.globalAlpha *= alpha;
  const sw = rad * 1.04, sh = rad * 0.62;
  g.drawImage(hi, -sw / 2, -sh / 2, sw, sh);
  g.restore();
}

/** the strand in focus: cord + beads + their own bloom */
function buildStrand(env, lut, hi) {
  const a = env.arc, nz = L.makeNoise('s02amber'), r = L.rng('s02beads');
  const lim = a.span(PAD + 150);
  // lay the beads out from the crest both ways (sizes vary by a few percent, crowns all tangent to the arc)
  const mk = () => ({ rad: BR * (1 + r.range(-0.034, 0.034)), flow: r.range(-0.9, 0.9), ox: r.range(-40, 40), oy: r.range(-40, 40), opq: r.range(-0.2, 0.34), warm: r.range(-0.02, 0.035), age: Math.pow(r(), 1.5) });
  const beads = [];
  const first = mk(); first.th = 0; beads.push(first);
  for (const dir of [1, -1]) {
    let prev = first;
    while (Math.abs(prev.th) < lim) {
      const b = mk();
      b.th = prev.th + dir * (prev.rad + b.rad + GAP) / (a.R - BR);
      beads.push(b); prev = b;
    }
  }
  beads.sort((p, q) => p.th - q.th);
  for (const b of beads) { b.axis = b.th; b.sprite = shadeBead(b.rad, b, nz, lut); }

  const X0 = -PAD, Y0 = Math.floor(a.crestY) - 90;
  const BW = W + PAD * 2, BH = Math.ceil(a.yAt(-PAD) + BR * 2 + 90) - Y0;
  const row = makeBand(X0, Y0, BW, BH, (g) => {
    // the cord: twisted silk, mostly hidden inside the beads
    g.lineCap = 'butt';
    g.strokeStyle = '#2c0f04'; g.lineWidth = 8; a.stroke(g, -BR + 1);
    g.strokeStyle = '#6b3009'; g.lineWidth = 5; a.stroke(g, -BR + 1);
    a.along({ spacing: 4.2, dr: -BR + 1, margin: PAD + 160 }, (q) => {
      a.at(g, q.theta, -BR + 1, () => {
        g.strokeStyle = 'rgba(226,150,52,0.75)'; g.lineWidth = 1.3;
        g.beginPath(); g.moveTo(-2.4, 2.2); g.lineTo(2.4, -2.6); g.stroke();
      });
    });
    g.strokeStyle = 'rgba(255,214,128,0.4)'; g.lineWidth = 1.2; a.stroke(g, -BR + 3.4);
    for (const b of beads) {
      const p = a.pt(b.th, -b.rad);
      b.x = p.x; b.y = p.y;
      g.drawImage(b.sprite, p.x - b.sprite._c, p.y - b.sprite._c);
    }
    // the key light falls off toward the right-hand end of the strand
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = L.linear(g, 0, 0, W, 0, [[0, 'rgba(30,12,2,0.1)'], [0.25, 'rgba(30,12,2,0)'], [0.6, 'rgba(30,12,2,0.04)'], [1, 'rgba(30,12,2,0.3)']]);
    g.fillRect(X0, Y0, BW, BH);
  });
  // the plane of focus cuts the strand near the crest: the beads toward either end go a touch soft
  const soft = L.blurred(row, 3.4), sg = soft.getContext('2d'), rg = row.getContext('2d');
  const focus = (g, x0) => L.linear(g, x0, 0, x0 + BW, 0, [[0, 'rgba(0,0,0,1)'], [0.1, 'rgba(0,0,0,0.9)'], [0.34, 'rgba(0,0,0,0)'], [0.68, 'rgba(0,0,0,0)'], [0.9, 'rgba(0,0,0,0.9)'], [1, 'rgba(0,0,0,1)']]);
  sg.globalCompositeOperation = 'destination-in'; sg.fillStyle = focus(sg, 0); sg.fillRect(0, 0, BW, BH);
  rg.globalCompositeOperation = 'destination-out'; rg.fillStyle = focus(rg, X0); rg.fillRect(X0, Y0, BW, BH);   // sharp × (1 − m) …
  rg.globalCompositeOperation = 'lighter'; rg.drawImage(soft, X0, Y0);                                          // … + soft × m
  rg.globalCompositeOperation = 'source-over';
  const bloom = L.blurred(row, 11);
  const halo = L.blurred(row, 26), hg = halo.getContext('2d');
  hg.translate(-X0, -Y0);
  hg.globalCompositeOperation = 'destination-in';     // the bloom belongs to the air above the strand; keep the seam under it dark
  hg.fillStyle = L.radial(hg, a.cx, a.cy, a.R - BR * 2 - 20, a.R - BR * 0.6, [[0, 'rgba(0,0,0,0.12)'], [1, 'rgba(0,0,0,1)']]);
  hg.fillRect(X0, Y0, BW, BH);
  const strand = makeBand(X0, Y0, BW, BH, (g) => {
    g.globalAlpha = 0.55; g.drawImage(halo, X0, Y0);
    g.globalAlpha = 1; g.drawImage(row, X0, Y0);
    g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.22; g.drawImage(bloom, X0, Y0);
  });
  return { strand, beads };
}

/** the inner coils of the strand, out of focus: honey bands deepening to amber brown */
function buildCoils(env, beads) {
  const a = env.arc, SC = 0.5;
  const X0 = -PAD, Y0 = Math.floor(a.crestY) + 96, BW = W + PAD * 2, BH = H + PAD - Y0;
  const rows = [];
  let edge = -(BR * 2 + 12);
  for (const [rad, blur, tint, glint, ga, rimc] of [[93, 19, '#e6b676', '#ffd684', 0.36, '#ffe9a6'], [103, 34, '#a66a35', '#f2a548', 0.26, '#f6b860'], [116, 46, '#6a3c1e', '#c4742e', 0.2, '#c8843c']]) {
    rows.push({ rad, blur, tint, glint, ga, rimc, dr: edge - rad }); edge -= rad * 2 + 10;
  }
  const r = L.rng('s02coils');
  const lim = a.span(PAD + 260);
  return makeBand(X0, Y0, BW, BH, (g) => {
    // warm depth between and under the coils
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 800, a.R - 110, [[0, '#1a0902'], [0.45, '#2e1204'], [0.8, 'rgba(70,30,6,0.85)'], [1, 'rgba(70,30,6,0)']]);
    g.fillRect(X0, Y0, BW, BH);
    for (let k = rows.length - 1; k >= 0; k--) {
      const rw = rows[k];
      const half = L.makeCanvas(Math.ceil(BW * SC), Math.ceil(BH * SC)), hg = half.getContext('2d');
      hg.scale(SC, SC); hg.translate(-X0, -Y0);
      const step = (rw.rad * 2 + 8) / (a.R + rw.dr), pts = [];
      for (let th = -lim + r.range(0, step); th < lim; th += step) {
        const b = beads[r.int(0, beads.length - 1)], rad = rw.rad * (1 + r.range(-0.03, 0.03));
        const p = a.pt(th, rw.dr), f = rad / b.sprite._rad, sz = b.sprite.width * f;
        hg.drawImage(b.sprite, p.x - sz / 2, p.y - sz / 2, sz, sz);
        pts.push({ cx: p.x, cy: p.y, rad, th, x: p.x + rad * (HV[0] + r.range(-0.05, 0.05)), y: p.y + rad * (HV[1] + r.range(-0.05, 0.05)), k: r.range(0.55, 1), sz: r.range(0.82, 1.12) });
      }
      const tinted = multiplyKeepAlpha(half, (tg) => { tg.fillStyle = rw.tint; tg.fillRect(0, 0, half.width, half.height); });
      // back light on the crown of every bead of the coil → after the blur, a soft luminous arc along the top of each band
      const tg2 = tinted.getContext('2d');
      tg2.globalCompositeOperation = 'source-atop'; tg2.scale(SC, SC); tg2.translate(-X0, -Y0);
      tg2.lineCap = 'round'; tg2.strokeStyle = rw.rimc; tg2.lineWidth = rw.rad * 0.085;
      for (const q of pts) { tg2.beginPath(); tg2.arc(q.cx, q.cy, q.rad - rw.rad * 0.05, q.th - Math.PI / 2 - 0.95, q.th - Math.PI / 2 + 0.95); tg2.stroke(); }
      const bl = lensBlur(tinted, rw.blur * SC, 28);
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(bl, X0, Y0, BW, BH);
      // each bead's highlight opens into a disc of confusion
      g.globalCompositeOperation = 'screen';
      for (const q of pts) {
        const al = rw.ga * q.k, br = (rw.blur * 0.9 + 6) * q.sz;
        g.fillStyle = L.radial(g, q.x, q.y, 0, br, [[0, L.rgba(rw.glint, al * 0.8)], [0.74, L.rgba(rw.glint, al)], [0.9, L.rgba(rw.glint, al * 0.7)], [1, L.rgba(rw.glint, 0)]]);
        g.beginPath(); g.arc(q.x, q.y, br, 0, L.TAU); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
    }
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = L.linear(g, 0, 0, W, 0, [[0, 'rgba(24,9,2,0.16)'], [0.3, 'rgba(24,9,2,0)'], [0.6, 'rgba(24,9,2,0.08)'], [1, 'rgba(24,9,2,0.4)']]);
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
        const rad = r.range(4, 13), al = r.range(0.035, 0.11) * near;
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

export default {
  name: '蜜蜡珠串',
  tone: 'light',
  init(env) {
    const a = env.arc;
    const lut = makeLut(), hi = buildHighlight();
    const { strand, beads } = buildStrand(env, lut, hi);
    const coils = buildCoils(env, beads);
    const rt = L.rng('s02twinkle'), motes = [];
    while (motes.length < 16) {
      const x = rt.range(40, W - 40), y = rt.range(30, 640);
      if (a.drAt(x, y) < 40) continue;
      motes.push({ x, y, rad: rt.range(1, 2.4), ph: rt(), k: rt.range(0.4, 1), vx: rt.range(-10, 10), vy: rt.range(-16, -4) });
    }
    S = {
      strand, coils, hi, motes,
      beads: beads.map((b) => ({ th: b.th, rad: b.rad })),
      dustFar: buildDust(env, 's02dustA', 420, false),
      dustNear: buildDust(env, 's02dustB', 26, true),
    };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.011, 0.011, p);
    ctx.fillStyle = '#070605'; ctx.fillRect(0, 0, W, H);
    // the strand's glow hanging in the air just above it
    ctx.fillStyle = L.radial(ctx, a.cx, a.cy, a.R - 40, a.R + 340, [[0, 'rgba(214,128,26,0.22)'], [0.3, 'rgba(160,84,14,0.09)'], [1, 'rgba(90,42,8,0)']]);
    ctx.fillRect(0, 0, W, H);
    // dust: far motes barely move, the defocused near ones drift up and across
    blitBand(ctx, env, S.dustFar, { dx: 5 * (p - 0.5), dy: -8 * (p - 0.5) });
    blitBand(ctx, env, S.dustNear, { dx: -14 * (p - 0.5), dy: -20 * (p - 0.5) });
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const m of S.motes) {
      const tw = (0.2 + 0.8 * Math.pow(0.5 + 0.5 * Math.sin((p * 1.3 + m.ph) * L.TAU), 2)) * m.k;
      const x = m.x + m.vx * (p - 0.5), y = m.y + m.vy * (p - 0.5), rr = m.rad * 7;
      ctx.fillStyle = L.radial(ctx, x, y, 0, rr, [[0, `rgba(255,244,214,${0.85 * tw})`], [0.16, `rgba(255,230,160,${0.4 * tw})`], [1, 'rgba(255,224,138,0)']]);
      ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    ctx.restore();

    // inner coils (closer to the lens → they slide a little faster), then the strand in focus
    blitBand(ctx, env, S.coils, { rot: rot * 1.35 });
    blitBand(ctx, env, S.strand, { rot });

    // highlights: one per bead, sliding across it as the strand turns; a gleam travels along the row
    const sweep = L.lerp(-0.2, -0.02, p), vis = a.span(140);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const b of S.beads) {
      const th = b.th + rot;
      if (th < -vis || th > vis) continue;
      const c = a.pt(th, -b.rad);
      const g = Math.exp(-((th - sweep) * (th - sweep)) / 0.03);
      putHighlight(ctx, S.hi, c.x, c.y, b.rad, th, -0.16 * (p - 0.5), 0.82 + 0.18 * g);
    }
    ctx.restore();
    const gl = a.pt(sweep, -70);
    L.glow(ctx, gl.x, gl.y, 330, '#ffd270', 0.15);
    L.vignette(ctx, { strength: 0.3, inner: 0.5 });
  },
};
