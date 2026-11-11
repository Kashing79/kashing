// s23 — 多光谱下的瓷瓶. A conservation-lab multispectral capture of a porcelain vase seen from straight above,
// rendered in false colour on black. The arc is the round outer outline of the shoulder, drawn by the hottest
// magenta / orange of the colour scale, with the little stair-steps of sensor noise along its edge.
// Below it: the string lines (弦纹) and decoration bands of the shoulder, mapped to neon rings — a lemon band with a
// lotus scroll (缠枝莲), a ring of cyan-green lappets, a magenta band — and one shard-shaped patch where every colour
// jumps: an old repair showing up under the lamp. Above it: black, with the sparse vertical striping of a line scanner.
//
// How it is made: everything below the arc is ONE scalar field ("signal strength") computed per pixel in init()
// — radial band profile + pattern masks drawn on an unrolled (arc length × depth) canvas + lamp falloff + glaze mottling
// + sensor-cell noise — and then pushed through a single colour ramp. That is what false colour is: the hue only
// says how strong the signal is, so every soft edge turns into a little rainbow fringe by itself.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 72;
let S = null;

const sstep = (a, b, v) => { const t = L.clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const ihash = (n) => { n |= 0; n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d); n = Math.imul(n ^ (n >>> 12), 0x297a2d39); n ^= n >>> 15; return (n >>> 0) / 4294967296; };
const hash2 = (x, y) => ihash((Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0);

// the palette of the task sheet, and where each colour sits on the signal axis
const PAL = { K: '#030406', P: '#7a2bff', M: '#ff2bd6', O: '#ff7a1f', Y: '#e6ff3a', G: '#2de2a6' };
const SV = { P: 0.25, M: 0.43, O: 0.55, Y: 0.68, G: 0.84 };
const RAMP = [[0, PAL.K], [0.06, '#0a0524'], [0.14, '#2a0e7a'], [SV.P, PAL.P], [0.34, '#c42bf0'], [SV.M, PAL.M], [0.49, '#ff3f86'],
  [SV.O, PAL.O], [0.615, '#ffc428'], [SV.Y, PAL.Y], [0.76, '#84f06c'], [SV.G, PAL.G], [0.93, '#a8f7da'], [1, '#f4fff9']];

// radial band profile: [depth below the arc where the plateau starts, signal, half-width of the transition into it]
const BANDS = [
  [-1e9, 0.445, 0],                                          // rim, outer skin: hot magenta
  [13, 0.575, 3], [30, SV.M, 4], [39, SV.P, 4], [50, 0.08, 5],    // … orange core, back through magenta and purple into a dark groove
  [66, 0.35, 3], [73, 0.09, 3],                              // string line (弦纹), kept low so nothing competes with the rim
  [86, SV.Y - 0.02, 8], [198, 0.09, 7],                      // lemon band (lotus scroll)
  [210, SV.M + 0.03, 2.2], [216, 0.09, 2.2],                 // string line
  [228, SV.G - 0.025, 7], [330, 0.08, 7],                            // cyan-green band (lappets)
  [341, SV.Y, 2.2], [347, 0.08, 2.2],                        // string line
  [359, SV.M, 7], [468, 0.08, 7],                            // magenta band (scroll, reversed out in lemon)
  [478, SV.G, 2.2], [484, 0.08, 2.2],                        // string line
  [496, SV.P + 0.02, 7], [566, 0.09, 6], [575, SV.Y, 2.2], [580.5, 0.09, 2.2], [592, SV.P, 7],
];
// the wide bands answer a little stronger along their middle, like a tube: [from, to, extra signal]
const TUBES = [[86, 198, 0.04], [228, 330, 0.045], [359, 468, 0.06]];
const D0 = -10;

function buildProfile(dmax) {
  const n = (dmax - D0) * 2 + 4, out = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const d = D0 + k / 2; let v = BANDS[0][1];
    for (let s = 1; s < BANDS.length; s++) { const b = BANDS[s]; if (d < b[0] - b[2]) break; v = L.lerp(v, b[1], sstep(b[0] - b[2], b[0] + b[2], d)); }
    for (const [d0, d1, amp] of TUBES) if (d > d0 && d < d1) v += amp * Math.sin((Math.PI * (d - d0)) / (d1 - d0));
    out[k] = v;
  }
  return out;
}

// ── pattern masks, drawn on an unrolled strip: x = arc length u (px at the rim), y = depth d below the arc ──
function leaf(g, x, y, ang, len, wid) {
  g.save(); g.translate(x, y); g.rotate(ang);
  g.beginPath(); g.moveTo(0, 0);
  g.bezierCurveTo(len * 0.25, -wid, len * 0.75, -wid * 0.85, len, 0);
  g.bezierCurveTo(len * 0.7, wid * 0.5, len * 0.3, wid * 0.55, 0, 0);
  g.fill(); g.restore();
}
/** a lotus head seen full-face: two rings of overlapping petals round a seed-pod */
function flower(g, x, y, r, turn, lvl, core) {
  g.save(); g.translate(x, y); g.rotate(turn);
  g.fillStyle = lvl;
  for (let i = 0; i < 8; i++) { g.save(); g.rotate((i * L.TAU) / 8); g.beginPath(); g.ellipse(0, -r * 0.62, r * 0.3, r * 0.42, 0, 0, L.TAU); g.fill(); g.restore(); }
  g.fillStyle = '#000'; g.beginPath(); g.arc(0, 0, r * 0.4, 0, L.TAU); g.fill();
  g.fillStyle = core; g.beginPath(); g.arc(0, 0, r * 0.24, 0, L.TAU); g.fill();
  g.restore();
}
/** 缠枝: an undulating stem, a flower head in every hollow with a tendril hooking round it, leaves along the stem */
function scroll(g, um, mid, A, lam, phase, fr, lvl, core) {
  const stem = (u) => mid + A * Math.sin((L.TAU * (u - phase)) / lam);
  g.strokeStyle = lvl; g.lineCap = 'round'; g.lineJoin = 'round';
  g.lineWidth = fr * 0.3; g.beginPath();
  for (let u = -um; u <= um; u += 5) { if (u === -um) g.moveTo(u, stem(u)); else g.lineTo(u, stem(u)); }
  g.stroke();
  const k0 = Math.floor((-um - phase) / (lam / 2)) - 1, k1 = Math.ceil((um - phase) / (lam / 2)) + 1;
  for (let k = k0; k <= k1; k++) {
    const u = phase + lam / 4 + (k * lam) / 2, sgn = k % 2 === 0 ? 1 : -1;      // sgn = 1: the stem runs on the inner (deeper) side here
    const fx = u, fy = mid - sgn * A * 0.42, rr = fr * 1.36, fk = 0.88 + 0.2 * ihash(k * 53 + Math.round(lam));
    // tendril: leaves the stem, hooks round the flower and ends in a bud
    g.lineWidth = fr * 0.22; g.beginPath();
    const a0 = sgn * L.deg(138), a1 = sgn * L.deg(366);
    g.moveTo(fx - rr * 1.12, stem(fx - rr * 1.12));
    g.arc(fx, fy, rr, a0, a1, sgn < 0);
    g.stroke();
    g.fillStyle = lvl; g.beginPath(); g.arc(fx + rr * Math.cos(a1), fy + rr * Math.sin(a1), fr * 0.24, 0, L.TAU); g.fill();
    flower(g, fx, fy, fr * fk, k * 0.7, lvl, core);
    // leaves where the stem crosses the middle of the band, all growing the same way
    const ux = phase + (k * lam) / 2, dir = Math.atan(((sgn * A * L.TAU) / lam));
    g.fillStyle = lvl;
    leaf(g, ux - 16, stem(ux - 16), dir - 0.95, fr * (1.0 + 0.3 * ihash(k * 17 + 3)), fr * 0.5);
    leaf(g, ux + 12, stem(ux + 12), dir + 0.9, fr * (1.0 + 0.3 * ihash(k * 29 + 5)), fr * 0.5);
    leaf(g, ux + lam * 0.13, stem(ux + lam * 0.13), dir * 0.4 + sgn * 1.0, fr * 0.8, fr * 0.4);
  }
}
/** a ring of lotus lappets (莲瓣), tips toward the rim, each with a double outline, standing on a plain ring */
function lappets(g, um) {
  const pitch = 128, top = 224, bot = 316, tip = 233, sh = 272, hw = pitch / 2 - 4.5;
  g.fillStyle = '#fff'; g.fillRect(-um, top, um * 2, bot - top);
  const n = Math.ceil(um / pitch) + 1;
  const path = (uc, inset) => {
    const w = hw - inset, t = tip + inset * 1.5, s = sh + inset * 0.4;
    g.beginPath(); g.moveTo(uc - w, bot + 2); g.lineTo(uc - w, s);
    g.bezierCurveTo(uc - w, s - 24, uc - 20, t + 20, uc, t);
    g.bezierCurveTo(uc + 20, t + 20, uc + w, s - 24, uc + w, s);
    g.lineTo(uc + w, bot + 2);
  };
  for (let i = -n; i <= n; i++) {
    const uc = i * pitch;
    g.fillStyle = '#000'; path(uc, 0); g.closePath(); g.fill();
    g.strokeStyle = 'rgb(128,128,128)'; g.lineWidth = 4; g.lineJoin = 'round'; path(uc, 11); g.stroke();
    // a small trefoil inside each petal
    g.fillStyle = 'rgb(150,150,150)';
    for (const [ox, oy, rr] of [[0, -44, 8], [-9, -31, 7], [9, -31, 7]]) { g.beginPath(); g.arc(uc + ox, bot + oy, rr, 0, L.TAU); g.fill(); }
    g.fillRect(uc - 2.5, bot - 28, 5, 16);
  }
}

function buildMasks(UM, DH) {
  const UW = Math.ceil(UM * 2);
  const mk = () => { const c = L.makeCanvas(UW, DH); const g = c.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#000'; g.fillRect(0, 0, UW, DH); g.translate(UM, -D0); return [c, g]; };
  // decoration (how much signal the painted pattern takes away / adds); blurred — the sensor never sees a crisp brush line
  const [cP, g] = mk();
  scroll(g, UM, 141, 34, 336, 52, 27, 'rgb(165,165,165)', '#fff');
  lappets(g, UM);
  scroll(g, UM, 413, 27, 262, -40, 22, '#fff', '#fff');
  const pat = L.blurred(cP, 2.6).getContext('2d').getImageData(0, 0, UW, DH).data;

  // the repair: R = filled-in shard, G = glue seams and the hairline breaks running away from it
  const [cQ, q] = mk();
  const shard = [[296, 110], [350, 92], [420, 116], [452, 164], [436, 228], [398, 272], [336, 262], [292, 218], [272, 162]];
  q.globalCompositeOperation = 'lighter';
  q.fillStyle = '#f00'; L.roughPoly(q, shard, { rough: 3.2, seed: 's23shard', step: 9 }); q.fill();
  q.strokeStyle = '#0f0'; q.lineJoin = 'round'; q.lineCap = 'round';
  q.lineWidth = 3; L.roughPoly(q, shard, { rough: 3.2, seed: 's23shard', step: 9 }); q.stroke();
  const crack = (pts, w0, w1) => {
    const p = L.smoothPath(pts, 5);
    for (let i = 1; i < p.length; i++) { q.lineWidth = L.lerp(w0, w1, i / p.length); q.beginPath(); q.moveTo(p[i - 1][0], p[i - 1][1]); q.lineTo(p[i][0], p[i][1]); q.stroke(); }
  };
  crack([[350, 92], [341, 70], [352, 46], [340, 20], [345, -6]], 2.8, 2.2);
  crack([[398, 272], [424, 312], [412, 362], [446, 420], [452, 490], [486, 566], [500, 650]], 2.8, 1.6);
  crack([[272, 162], [232, 174], [188, 158], [150, 172], [118, 164]], 2.4, 0.5);
  crack([[452, 164], [490, 152], [520, 168]], 2.2, 0.5);
  const rep = L.blurred(cQ, 0.8).getContext('2d').getImageData(0, 0, UW, DH).data;
  return { UW, pat, rep };
}

/** the vase: per-pixel signal → colour ramp. Returns a cropped layer {canvas, hot, X0, Y0, RW, RH} */
function buildBody(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const X0 = -PAD, Y0 = Math.floor(a.crestY) - 96;
  const RW = W + PAD * 2, RH = H + PAD - Y0;
  const DMAX = Math.ceil(R - (cy - (H + PAD))) + 16, DH = DMAX - D0;
  const UM = Math.ceil(Math.atan2(W / 2 + PAD + 6, cy - (H + PAD)) * R) + 16;
  const { UW, pat, rep } = buildMasks(UM, DH);
  const PROF = buildProfile(DMAX);

  const rampFn = L.makeRamp(RAMP), LUT = new Uint8ClampedArray(1024 * 3);
  for (let i = 0; i < 1024; i++) { const c = rampFn(i / 1023); LUT[i * 3] = c[0]; LUT[i * 3 + 1] = c[1]; LUT[i * 3 + 2] = c[2]; }

  // slow fields on a coarse grid (bilinear-sampled): band wobble, glaze mottling, fine ripple, lamp falloff, brightness
  const nA = L.makeNoise('s23a'), nB = L.makeNoise('s23b');
  const CS = 4, cw = Math.ceil(RW / CS) + 2, ch = Math.ceil(RH / CS) + 2;
  const cWob = new Float32Array(cw * ch), cMot = new Float32Array(cw * ch), cFin = new Float32Array(cw * ch), cLamp = new Float32Array(cw * ch), cLum = new Float32Array(cw * ch);
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const ddx = X0 + i * CS - cx, ddy = cy - (Y0 + j * CS), d = R - Math.hypot(ddx, ddy), u = Math.atan2(ddx, ddy) * R, k = j * cw + i;
    cWob[k] = nB.fbm(u / 190, d / 150, 2);
    cMot[k] = nA.fbm(u / 210, d / 95, 3, 2, 0.55);
    cFin[k] = nA.n2(u / 26 + 40, d / 26 - 7);
    // two lamps, one at either side (the usual copy-stand set-up), leave two broad lobes; the crown and the far flank read cooler
    const l1 = Math.exp(-(((u + 500) / 340) ** 2) - (((d - 150) / 160) ** 2)), l2 = Math.exp(-(((u - 700) / 260) ** 2) - (((d - 130) / 130) ** 2));
    // … and, inside each lobe, the glaze throws back a narrow crescent of glare that follows the curve of the shoulder
    const g1 = Math.exp(-(((u + 455) / 250) ** 2) - (((d - 137) / 26) ** 2)), g2 = Math.exp(-(((u - 735) / 150) ** 2) - (((d - 128) / 20) ** 2));
    const far = sstep(320, 640, d), flank = sstep(520, 1150, Math.abs(u + 80)) * sstep(60, 300, d);
    cLamp[k] = 0.05 * l1 + 0.04 * l2 + 0.15 * g1 + 0.1 * g2 - 0.05 * far - 0.04 * flank;
    cLum[k] = 0.88 + 0.16 * l1 + 0.11 * l2 - 0.2 * far - 0.1 * flank;
  }
  const bil = (src, i, j) => {
    const fx = i / CS, fy = j / CS, i0 = fx | 0, j0 = fy | 0, tx = fx - i0, ty = fy - j0, k = j0 * cw + i0;
    const a0 = src[k], a1 = src[k + 1], b0 = src[k + cw], b1 = src[k + cw + 1];
    return (a0 + (a1 - a0) * tx) * (1 - ty) + (b0 + (b1 - b0) * tx) * ty;
  };

  const HOT = 0.085;       // how far the signal lifts behind the scan line (second copy of the plate)
  const img = new ImageData(RW, RH), px = img.data, img2 = new ImageData(RW, RH), px2 = img2.data;
  for (let j = 0; j < RH; j++) {
    const y = Y0 + j, ddy = cy - y;
    for (let i = 0; i < RW; i++) {
      const x = X0 + i, ddx = x - cx, d = R - Math.sqrt(ddx * ddx + ddy * ddy);
      if (d < -66) continue;
      const u = Math.atan2(ddx, ddy) * R;
      const bn = hash2((x + 4096) / 3 | 0, (y + 4096) / 3 | 0) - 0.5;      // sensor-cell noise, 3 px cells
      // stair-stepped edge: 8 px wide teeth 2 px tall, and a 1 px shiver in between (the outline never strays more than 2 px)
      const h = ihash(Math.floor(u / 8) * 7919 + 13), h2 = ihash(Math.floor(u / 2) * 104729 + 71);
      const e = h < 0.2 ? 2 : h < 0.4 ? -2 : h2 < 0.2 ? 1 : h2 < 0.4 ? -1 : 0;
      const o = (j * RW + i) * 4;
      let s, hot = 0, alpha = 255, lum = 1, lift = HOT;
      if (d + e < 0) {
        // outside the object: the signal bleeds a little into the neighbouring cells, then nothing
        const dd = -d;
        s = 0.14 * Math.exp(-dd / 6) + 0.075 * Math.exp(-dd / 30) + bn * 0.03;
        if (dd > 5 && dd < 24 && hash2((x + 4096) / 4 | 0, (y + 8192) / 4 | 0) < 0.03) s += 0.22;      // stray cells firing just off the edge
        alpha = 255 * L.clamp((s - 0.012) * 13);
        if (alpha <= 0) continue;
        lift = HOT * 0.5;
      } else {
        const body = sstep(30, 72, d);
        const fin = bil(cFin, i, j);
        const dp = d + 5.5 * bil(cWob, i, j) * body;                    // the bands breathe a few px in width; the rim itself does not
        s = PROF[((dp - D0) * 2) | 0];
        const mi = (((dp - D0) | 0) * UW + ((u + UM) | 0)) * 4;
        const pm = pat[mi] / 255;
        if (pm > 0) s += (dp < 221 ? -0.43 : dp < 352 ? -0.6 : 0.27) * pm;
        s += (0.09 * bil(cMot, i, j) + 0.02 * fin) * body + bil(cLamp, i, j) * sstep(4, 30, d);
        if (s > 0.87) s = 0.87 + (s - 0.87) * 0.45;                              // the scale flattens toward its top: keep the greens green
        const qm = rep[mi] / 255, qs = rep[mi + 1] / 255;
        if (qm > 0) s = L.lerp(s, 0.37 + 0.26 * (s - 0.5) + 0.05 * fin, qm);    // the fill answers flat and weak, whatever is painted over it
        if (qs > 0) s = Math.max(s, L.lerp(s, 0.98, qs));                       // the glue line answers strongest of all
        s += bn * 0.04;
        hot = (1 - sstep(2.5, 9, d)) * 0.8;                                       // a thin white-hot skin on the very edge
        lum = bil(cLum, i, j); if (d < 50) lum = L.lerp(1.02, lum, sstep(32, 50, d));
      }
      const gr = (0.93 + 0.14 * hash2(x + 9000, y + 5000)) * lum;
      let li = ((s < 0 ? 0 : s > 1 ? 1 : s) * 1023 | 0) * 3;
      let r = LUT[li], g = LUT[li + 1], b = LUT[li + 2];
      if (hot > 0) { r += (255 - r) * hot; g += (226 - g) * hot; b += (246 - b) * hot; }
      px[o] = r * gr; px[o + 1] = g * gr; px[o + 2] = b * gr; px[o + 3] = alpha;
      const s2 = s + lift * (1 - 0.8 * sstep(0.7, 0.9, s));
      li = ((s2 < 0 ? 0 : s2 > 1 ? 1 : s2) * 1023 | 0) * 3;
      r = LUT[li]; g = LUT[li + 1]; b = LUT[li + 2];
      if (hot > 0) { r += (255 - r) * hot; g += (240 - g) * hot; b += (246 - b) * hot; }
      const gr2 = gr * 1.06;
      px2[o] = r * gr2; px2[o + 1] = g * gr2; px2[o + 2] = b * gr2; px2[o + 3] = Math.min(255, alpha * 1.4);
    }
  }
  // shallow depth of field: the shoulder climbs toward the lens as it nears the neck, so the inner bands go soft
  const finish = (im) => {
    const c = L.makeCanvas(RW, RH), g = c.getContext('2d');
    g.putImageData(im, 0, 0);
    const soft = L.blurred(c, 5), sg = soft.getContext('2d');
    sg.globalCompositeOperation = 'destination-in';
    sg.fillStyle = L.radial(sg, cx - X0, cy - Y0, R - 540, R - 250, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
    sg.fillRect(0, 0, RW, RH);
    g.drawImage(soft, 0, 0);
    return c;
  };
  return { canvas: finish(img), hot: finish(img2), X0, Y0, RW, RH };
}

/** black field with the vertical striping of a line scanner: uneven spacing, the same hues, much darker */
function buildBack(env) {
  const a = env.arc;
  const c = L.makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = PAL.K; g.fillRect(0, 0, W, H);
  // read-out floor: barely-there columns of deep violet
  g.globalAlpha = 0.55;
  g.drawImage(L.noiseTex(W, H, { seed: 's23floor', scale: 300, sx: 0.3, sy: 9, octaves: 3, res: 0.25, contrast: 1.8,
    ramp: [[0, 'rgba(26,10,84,0)'], [0.6, 'rgba(26,10,84,0)'], [1, 'rgba(40,14,110,0.5)']] }), 0, 0);
  g.globalAlpha = 1;
  const nz = L.makeNoise('s23stripes');
  const zone = (x) => sstep(350, 500, Math.abs(x - W / 2));     // 0 over the tagline → 1 outside it
  const SEG = 12;
  const column = (x0, w, hue, lum, seed, lift = 0) => {
    g.fillStyle = w < 7 ? hue : L.linear(g, x0, 0, x0 + w, 0, [[0, L.rgba(hue, 0)], [0.2, L.rgba(hue, 0.8)], [0.5, hue], [0.8, L.rgba(hue, 0.8)], [1, L.rgba(hue, 0)]]);
    const yEnd = Math.max(a.yAt(x0), a.yAt(x0 + w)) + 10, sp = 150 + 260 * ihash(seed + 5);
    for (let y = 0; y < yEnd; y += SEG) {
      const n = 0.5 + 0.5 * nz.n2(y / sp + seed * 3.7, seed * 0.31);
      const gate = sstep(0.1, 0.3, 0.5 + 0.5 * nz.n2(y / 460 - seed * 1.3, 40 + seed));      // long drop-outs
      const near = 1 + lift * sstep(yEnd - 420, yEnd - 30, y);      // the columns pick up signal as they near the object
      g.globalAlpha = L.clamp(lum * near * (0.5 + 0.5 * n) * (0.3 + 0.7 * gate) * (0.93 + 0.14 * ihash(seed * 977 + y)));
      g.fillRect(x0, y, w, SEG);
    }
    g.globalAlpha = 1;
  };
  // [x, width, hue, brightness]. Wide columns stay in magenta / purple (a dimmed yellow goes khaki); the acid hues are hairlines.
  const { M, P, O, Y, G } = PAL;
  const cols = [
    [-18, 64, M, 0.3], [70, 3, O, 0.85], [118, 26, P, 0.62], [176, 2.5, G, 0.75], [236, 104, P, 0.36], [268, 2.5, M, 0.9],
    [392, 20, M, 0.5], [446, 2, Y, 0.7], [508, 36, P, 0.42], [566, 2, M, 0.55],
    [676, 2, P, 0.2], [830, 2.5, P, 0.15], [1012, 2, P, 0.14], [1180, 2.5, P, 0.2],          // over the tagline: rare and nearly black
    [1338, 2.5, M, 0.6], [1372, 30, P, 0.45], [1446, 2, G, 0.7], [1492, 88, M, 0.3], [1548, 2.5, O, 0.85],
    [1640, 3, Y, 0.7], [1684, 34, P, 0.62], [1752, 2, M, 0.8], [1790, 112, P, 0.3], [1866, 2.5, G, 0.7], [1916, 30, M, 0.46],
  ];
  cols.forEach(([x, w, hue, lum], k) => {
    const z = w < 7 && Math.abs(x - W / 2) < 340 ? 1 : zone(x + w / 2);
    const out = zone(x + w / 2) > 0.5;
    if (w < 7 && out) column(x - 6, w + 12, hue, lum * 0.3, k + 77, 0.5);
    column(x, w, hue, lum * z, k + 1, out ? (w < 7 ? 0.25 : 0.9) : 0);
    // where a column lands on the shoulder the signal pools a little
    if (w > 10) L.glow(g, x + w / 2, a.yAt(x + w / 2) + 4, w * 0.8 + 54, hue, Math.min(0.7, lum * 1.7), 'screen');
  });
  // the same striping runs on through the object as a faint column-to-column gain error (soft-light overlay, 128 = none)
  const gain = L.makeCanvas(W, 4), gg = gain.getContext('2d');
  for (let x = 0; x < W; x += 2) { const v = 128 + Math.round(22 * nz.n2(x / 9, 3.3) + 14 * (ihash(x * 31 + 7) - 0.5)); gg.fillStyle = `rgb(${v},${v},${v})`; gg.fillRect(x, 0, 2, 4); }
  for (const [x, w, , lum] of cols) {
    gg.fillStyle = w < 7 ? `rgba(255,255,255,${0.5 * lum})` : L.linear(gg, x, 0, x + w, 0, [[0, 'rgba(255,255,255,0)'], [0.5, `rgba(255,255,255,${0.7 * lum})`], [1, 'rgba(255,255,255,0)']]);
    gg.fillRect(x, 0, w, 4);
  }
  // a few stuck sensor cells
  const rs = L.rng('s23hot');
  for (let i = 0; i < 130; i++) {
    const px = Math.floor(rs.range(0, W) / 3) * 3, py = Math.floor(rs.range(0, 760) / 3) * 3, z = zone(px);
    g.globalAlpha = rs.range(0.2, 0.8) * (0.2 + 0.8 * z);
    g.fillStyle = rs.pick([PAL.P, PAL.M, PAL.P, PAL.G, PAL.Y]);
    g.fillRect(px, py, 3, rs.chance(0.3) ? 6 : 3);
  }
  g.globalAlpha = 1;
  return { back: c, gain };
}

/** registration crosses in the corners and an unlabelled colour scale: static, on top of everything */
function buildHud() {
  const c = L.makeCanvas(W, H), g = c.getContext('2d');
  g.lineCap = 'butt';
  for (const [col, lw] of [['rgba(3,4,6,0.7)', 5], ['rgba(226,255,244,0.9)', 2]]) {
    g.strokeStyle = col; g.lineWidth = lw;
    for (const [x, y] of [[84, 78], [W - 84, 78], [84, H - 78], [W - 84, H - 78]]) {
      g.beginPath(); g.moveTo(x - 17, y); g.lineTo(x - 4, y); g.moveTo(x + 4, y); g.lineTo(x + 17, y);
      g.moveTo(x, y - 17); g.lineTo(x, y - 4); g.moveTo(x, y + 4); g.lineTo(x, y + 17); g.stroke();
    }
  }
  // colour scale (strong at the top, nothing at the bottom) — no numbers, no lettering
  const bx = W - 91, by = 150, bw = 14, bh = 250;
  g.fillStyle = PAL.K; g.fillRect(bx - 14, by - 8, bw + 22, bh + 16);
  g.fillStyle = L.linear(g, 0, by + bh, 0, by, RAMP.map(([t, col]) => [t, col]));
  g.fillRect(bx, by, bw, bh);
  g.strokeStyle = 'rgba(214,255,240,0.6)'; g.lineWidth = 1.5; g.strokeRect(bx - 0.5, by - 0.5, bw + 1, bh + 1);
  for (let i = 0; i <= 5; i++) { const y = by + (bh * i) / 5; g.beginPath(); g.moveTo(bx - 9, y); g.lineTo(bx - 3, y); g.stroke(); }
  return c;
}

export default {
  name: '多光谱下的瓷瓶',
  tone: 'light',
  init(env) {
    const body = buildBody(env);
    // bloom: a quarter-size blurred copy, screened back on
    const bw = Math.round(body.RW / 4), bh = Math.round(body.RH / 4);
    const small = L.makeCanvas(bw, bh); small.getContext('2d').drawImage(body.canvas, 0, 0, bw, bh);
    const bloom = L.blurred(small, 5.5);
    const TW = 380, tmp = L.makeCanvas(TW, H), tg = tmp.getContext('2d');
    const LINE = TW - 20;       // x of the scan line inside the window canvas
    const win = L.linear(tg, 0, 0, TW, 0, [[0, 'rgba(0,0,0,0)'], [0.4, 'rgba(0,0,0,0.25)'], [(LINE - 50) / TW, 'rgba(0,0,0,0.8)'], [(LINE - 1) / TW, 'rgba(0,0,0,1)'], [(LINE + 1) / TW, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0)']]);
    S = { body, bloom, ...buildBack(env), hud: buildHud(), tmp, tg, win, TW, LINE };
  },
  draw(ctx, env, p) {
    const a = env.arc, B = S.body;
    const rot = L.lerp(-0.0065, 0.0065, p);
    const xs = L.lerp(150, 1650, p);                           // the scan line sweeps left → right
    const pulse = 0.5 + 0.5 * Math.sin(p * L.TAU * 1.5 - 0.5);

    ctx.drawImage(S.back, 0, 0);
    // the vase: detail slides along the arc
    L.cam(ctx, env, { rot }, () => ctx.drawImage(B.canvas, B.X0, B.Y0));

    // behind the scan line the signal is still up: the same plate, read a notch higher on the colour scale
    const tg = S.tg, x0 = Math.round(xs - S.LINE);
    tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, S.TW, H);
    tg.translate(-x0, 0); tg.translate(a.cx, a.cy); tg.rotate(rot); tg.translate(-a.cx, -a.cy);
    tg.drawImage(B.hot, B.X0, B.Y0);
    tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'destination-in';
    tg.fillStyle = S.win; tg.fillRect(0, 0, S.TW, H);
    ctx.drawImage(S.tmp, x0, 0);

    // line-scanner striping carried through the object
    ctx.save(); a.clipBelow(ctx, 0); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.6;
    ctx.drawImage(S.gain, 0, 0, W, 4, 0, a.crestY - 4, W, H - a.crestY + 4);
    ctx.restore();

    // glow of the whole plate, breathing with the sweep
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.26 + 0.16 * pulse;
    L.cam(ctx, env, { rot }, () => ctx.drawImage(S.bloom, B.X0, B.Y0, B.RW, B.RH));
    ctx.restore();

    // the line itself (only where there is something to answer), and the spark where it crosses the rim
    const ya = a.yAt(xs);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = L.linear(ctx, 0, ya - 10, 0, H, [[0, 'rgba(226,255,244,0)'], [0.03, 'rgba(226,255,244,0.95)'], [1, 'rgba(226,255,244,0.75)']]);
    ctx.fillRect(xs - 1.5, ya - 10, 3, H - ya + 10);
    ctx.fillStyle = L.linear(ctx, xs - 18, 0, xs + 12, 0, [[0, 'rgba(45,226,166,0)'], [0.6, 'rgba(140,255,220,0.42)'], [1, 'rgba(45,226,166,0)']]);
    ctx.fillRect(xs - 18, ya - 4, 30, H - ya + 4);
    a.clipBelow(ctx, 14);
    L.glow(ctx, xs, ya + 14, 66, '#ffd4f4', 0.7);
    ctx.restore();

    ctx.drawImage(S.hud, 0, 0);
  },
};
