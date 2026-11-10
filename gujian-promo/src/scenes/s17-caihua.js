// s17 — 旋子彩画. Macro of Qing-style beam painting (梁枋彩画), re-drawn as concentric bands under the arc:
//   arc        : a raised, gilded 沥粉贴金 line (the dominant edge)
//   below it   : the 箍头 band — 群青 with 退晕 steps and a strip of 连珠 pearls on black
//   then       : big 旋花 rosettes, one touching the next, 青/绿 alternating; every 旋瓣 steps deep → mid → light → white (退晕)
//                with a gilded 旋眼 at the heart; the cusps between rosettes carry a half 栀花 and a sword-tip petal
//   above      : the vermilion-lacquered board (垫板) with fine 断纹 cracks — kept calm for the tagline
// Everything is painted flat first, then aged: mineral-pigment grain, craquelure whose cells sometimes flake off to the
// grey 地仗 ground, relief lighting from a height map (raised 沥粉 lines, thick white 粉 lines), gold-leaf glitter.
import * as L from '../lib/core.js';

const { W, H, TAU } = L;
const PAD = 150;
let S = null;

// ── layout: radial offsets from the arc (negative = below it) ──
const BEAD = 16;                    // gilded bead sitting exactly under the arc: dr 0 → -16
const BAND = 76;                    // 箍头 band
const LINE = 8;                     // secondary gilded lines
const RW = 176;                     // radius of one 旋花
const B_TOP = -BEAD;
const FZ0 = B_TOP - BAND - LINE;    // top of the rosette zone (-100)
const FC = FZ0 - RW;                // rosette centres
const FZ1 = FZ0 - 2 * RW;           // bottom of the rosette zone
const B2_TOP = FZ1 - LINE;          // lower band
const BEAD2 = B2_TOP - BAND;

const COL = {
  b: { deep: '#1b46a0', mid: '#3f72cc', light: '#86ace6' },
  g: { deep: '#0f7f5c', mid: '#35a981', light: '#84d6ae' },
  white: '#f3efe3', ink: '#090d1d', ground: '#0b1738', strip: '#07080f', jitter: true,
};
// the same drawing in greys = a height map (white 粉 lines stand proud, ink lines sit low)
const HGT = {
  b: { deep: '#8a8a8a', mid: '#8f8f8f', light: '#949494' },
  g: { deep: '#8a8a8a', mid: '#8f8f8f', light: '#949494' },
  white: '#b6b6b6', ink: '#5a5a5a', ground: '#747474', strip: '#6c6c6c', jitter: false,
};

const sstep = (a, b, v) => { const t = L.clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const disc = (g, x, y, r, fill) => { g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };

const dTheta = (a) => (2 * RW + 2) / (a.R + FC);
const kMax = (a) => Math.ceil(a.span(PAD + 160) / dTheta(a)) + 1;

// ── allocation-free worley noise (results in cE = d2-d1, cId) ──
let cE = 0, cId = 0;
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
  cE = Math.sqrt(d2) - Math.sqrt(d1); cId = id;
}

// ───────────────────────── the painted pattern (colour or height palette) ─────────────────────────
/** one 旋瓣 / pearl-like disc with 退晕: ink outline → white 粉 line → light → mid → deep core */
function petal(g, P, pal, x, y, r, tone, jr) {
  const ox = jr ? jr.range(-1.6, 1.6) : 0, oy = jr ? jr.range(-1.6, 1.6) : 0;
  const t = jr ? jr.range(-0.07, 0.07) : 0;
  const grd = g.createRadialGradient(x + ox, y + oy, 0, x, y, r);
  const deep = tone(pal.deep, t), mid = tone(pal.mid, t), light = tone(pal.light, t);
  grd.addColorStop(0, deep); grd.addColorStop(0.43, deep);
  grd.addColorStop(0.45, mid); grd.addColorStop(0.645, mid);
  grd.addColorStop(0.665, light); grd.addColorStop(0.83, light);
  grd.addColorStop(0.85, P.white); grd.addColorStop(0.935, P.white);
  grd.addColorStop(0.955, P.ink); grd.addColorStop(1, P.ink);
  g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}

/** a whole 旋花 at the local origin (−y = outward) */
function xuanhua(g, P, outer, inner, tone, jr) {
  disc(g, 0, 0, RW, P.ground);
  const ring = (n, rc, rd, pal, phase) => {
    const ph = [];
    for (let k = 0; k < n; k++) { const v = phase + (k * TAU) / n; ph.push(Math.atan2(Math.sin(v), Math.cos(v))); }
    ph.sort((p, q) => Math.abs(q) - Math.abs(p));          // bottom petals first, the top one last → fish-scale overlap
    for (const v of ph) petal(g, P, pal, rc * Math.sin(v), -rc * Math.cos(v), rd, tone, jr);
  };
  ring(12, RW * 0.652, RW * 0.338, outer, 0);              // 头路瓣
  ring(8, RW * 0.365, RW * 0.218, inner, TAU / 16);        // 二路瓣
  disc(g, 0, 0, RW * 0.262, P.ink); disc(g, 0, 0, RW * 0.24, P.white);   // collar of the 旋眼 (the eye itself is gold)
}

/** what fills the cusp between two rosettes: half a 栀花 hanging from the band line + a sword-tip petal */
function gapOrnament(g, P, lobe, tip, tone, jr) {
  petal(g, P, lobe, -53, 3, 48, tone, jr);
  petal(g, P, lobe, 53, 3, 48, tone, jr);
  const shape = (k) => {
    const X = (x) => x * k, Y = (y) => 48 + (y - 48) * k;
    g.beginPath(); g.moveTo(X(-31), Y(-8)); g.quadraticCurveTo(X(-34), Y(76), X(0), Y(136)); g.quadraticCurveTo(X(34), Y(76), X(31), Y(-8)); g.closePath(); g.fill();
  };
  const t = jr ? jr.range(-0.06, 0.06) : 0;
  g.fillStyle = P.ink; shape(1);
  g.fillStyle = P.white; shape(0.9);
  g.fillStyle = tone(tip.light, t); shape(0.775);
  g.fillStyle = tone(tip.mid, t); shape(0.6);
  g.fillStyle = tone(tip.deep, t); shape(0.42);
  disc(g, 0, 0, 34, P.ink); disc(g, 0, 0, 31, P.white);
}

/** 箍头 band: 退晕 stripes either side of a black strip of 连珠 pearls */
function bandStripes(g, a, top, P, pal, pearl, s, tone, jr) {
  const st = [[0, P.white], [5, pal.light], [13, pal.deep], [20, P.strip], [56, pal.deep], [63, pal.light], [71, P.white]];
  for (let i = 0; i < st.length; i++) a.fillBand(g, st[i][1], top - st[i][0] + (i ? 0.4 : 0), top - BAND, -s, s);
  const dr = top - 38;
  a.along({ spacing: 38, dr, t0: -s, t1: s }, (q) => {
    a.at(g, q.theta, dr, () => {
      const t = jr ? jr.range(-0.08, 0.08) : 0;
      if (P.jitter) {
        disc(g, 0, 0, 15, tone(pearl.deep, t)); disc(g, -0.8, -1, 10.8, tone(pearl.light, t)); disc(g, -3, -3.6, 4.8, P.white);
      } else {
        g.fillStyle = L.radial(g, 0, 0, 0, 15, [[0, '#c4c4c4'], [0.6, '#a2a2a2'], [1, '#727272']]); g.beginPath(); g.arc(0, 0, 15, 0, TAU); g.fill();
      }
    });
  });
}

function drawPattern(g, env, P) {
  const a = env.arc, s = a.span(PAD + 320), dth = dTheta(a), K = kMax(a);
  const jr = P.jitter ? L.rng('s17jit') : null;
  const tone = (c, t) => (t ? L.shade(c, t) : c);
  g.save(); a.clipBelow(g, 0);
  a.fillBelow(g, P.ground, 2);
  bandStripes(g, a, B_TOP, P, P.b, P.g, s, tone, jr);
  a.fillBand(g, P.ground, FZ0 + 1, FZ1 - 1, -s, s);
  // cusps
  g.save(); a.clipBand(g, FZ0 + 1, FZ1 - 1, -s, s);
  for (let k = -K; k < K; k++) {
    const th = (k + 0.5) * dth;
    a.at(g, th, FZ0, () => gapOrnament(g, P, P.g, P.b, tone, jr));
    a.at(g, th, FZ1, () => { g.scale(1, -1); gapOrnament(g, P, P.b, P.g, tone, jr); });
  }
  g.restore();
  // rosettes
  for (let k = -K; k <= K; k++) {
    const even = Math.abs(k) % 2 === 0;
    a.at(g, k * dth, FC, () => xuanhua(g, P, even ? P.b : P.g, even ? P.g : P.b, tone, jr));
  }
  bandStripes(g, a, B2_TOP, P, P.g, P.b, s, tone, jr);
  g.restore();
}

// ───────────────────────── gilding ─────────────────────────
function goldBand(g, a, top, w, s) {
  g.fillStyle = L.radial(g, a.cx, a.cy, a.R + top - w, a.R + top, [[0, '#5f3a09'], [0.22, '#a9741a'], [0.5, '#dba634'], [0.74, '#f7d56a'], [0.9, '#fff0b0'], [1, '#f4cf66']]);
  a.pathBand(g, top, top - w, -s, s); g.fill();
}
function goldRing(g, r, w) {
  g.lineWidth = w; g.strokeStyle = '#6a430b'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
  g.lineWidth = w - 2.4; g.strokeStyle = '#d6a02f'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
  g.lineWidth = w * 0.36; g.strokeStyle = '#ffe9a0'; g.beginPath(); g.arc(-w * 0.12, -w * 0.17, r, 0, TAU); g.stroke();
}
/** gilded boss: 旋眼 (with a little ring of seed-petals) or the heart of a 栀花 */
function goldBoss(g, r, petals) {
  g.fillStyle = L.radial(g, -r * 0.34, -r * 0.4, r * 0.04, r * 1.2, [[0, '#fff6c8'], [0.22, '#f8d566'], [0.55, '#d79f2e'], [0.85, '#99661a'], [1, '#5f3a09']]);
  g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(84,48,6,0.8)'; g.lineWidth = Math.max(1.4, r * 0.07);
  if (petals) {
    for (let k = 0; k < petals; k++) {
      const v = (k * TAU) / petals, x = Math.sin(v) * r * 0.6, y = -Math.cos(v) * r * 0.6;
      g.beginPath(); g.arc(x, y, r * 0.3, 0, TAU); g.stroke();
      g.fillStyle = 'rgba(255,244,190,0.55)'; g.beginPath(); g.arc(x - r * 0.07, y - r * 0.09, r * 0.13, 0, TAU); g.fill();
    }
    g.beginPath(); g.arc(0, 0, r * 0.3, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(255,250,215,0.8)'; g.beginPath(); g.arc(-r * 0.08, -r * 0.1, r * 0.13, 0, TAU); g.fill();
  }
  g.strokeStyle = 'rgba(70,40,4,0.85)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, r - 1, 0, TAU); g.stroke();
}

function buildGold(env) {
  const a = env.arc, s = a.span(PAD + 320), dth = dTheta(a), K = kMax(a);
  return L.makeLayer(PAD, (g) => {
    for (let k = -K; k <= K; k++) a.at(g, k * dth, FC, () => { goldRing(g, RW - 3.5, 7); goldBoss(g, RW * 0.2, 7); });
    g.save(); a.clipBand(g, FZ0 + 2, FZ1 - 2, -s, s);
    for (let k = -K; k < K; k++) {
      const th = (k + 0.5) * dth;
      a.at(g, th, FZ0, () => goldBoss(g, 26, 0));
      a.at(g, th, FZ1, () => goldBoss(g, 26, 0));
    }
    g.restore();
    goldBand(g, a, 0, BEAD, s);
    goldBand(g, a, B_TOP - BAND, LINE, s);
    goldBand(g, a, FZ1, LINE, s);
    goldBand(g, a, BEAD2, BEAD, s);
    // gold leaf: uneven burnish, worn spots where the red bole shows, pin-point glitter
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = 0.6;
    g.drawImage(L.noiseLayer(PAD, { seed: 's17leaf', scale: 30, octaves: 3, res: 0.4, contrast: 1.7, warp: 0.5,
      ramp: [[0, 'rgba(96,52,6,0.95)'], [0.42, 'rgba(190,130,30,0)'], [0.68, 'rgba(255,240,170,0)'], [1, 'rgba(255,248,200,0.85)']] }), -PAD, -PAD);
    g.globalAlpha = 1;
    L.speckle(g, { seed: 's17bole', count: 5200, x: -PAD, y: -PAD, w: W + PAD * 2, h: H + PAD * 2, rMin: 0.7, rMax: 3.2, colors: ['#8a3413', '#5d2a0c', '#a2541a'], alpha: [0.25, 0.8] });
    L.speckle(g, { seed: 's17glit', count: 11000, x: -PAD, y: -PAD, w: W + PAD * 2, h: H + PAD * 2, rMin: 0.5, rMax: 1.5, colors: ['#fffbe0', '#fff2ae', '#ffffff'], alpha: [0.35, 1] });
  });
}

/** glitter that only exists where there is gold; two of these cross-fade → the leaf twinkles */
function buildSpark(gold, seed) {
  return L.makeLayer(PAD, (g) => {
    const r = L.rng(seed);
    for (let i = 0; i < 5200; i++) {
      const x = r.range(-PAD, W + PAD), y = r.range(300, H + PAD), rad = r.range(1.2, 4.2);
      g.fillStyle = L.radial(g, x, y, 0, rad, [[0, 'rgba(255,252,230,1)'], [0.35, 'rgba(255,236,150,0.8)'], [1, 'rgba(255,210,90,0)']]);
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(gold, -PAD, -PAD);
  });
}

// ───────────────────────── ageing: craquelure + flaked cells ─────────────────────────
function buildAging(env) {
  const a = env.arc, res = 0.5;
  const w = W + PAD * 2, h = H + PAD * 2, cw = Math.round(w * res), ch = Math.round(h * res);
  const nz = L.makeNoise('s17zone');
  const cImg = new ImageData(cw, ch), fImg = new ImageData(cw, ch), cd = cImg.data, fd = fImg.data;
  const tzY = a.crestY - 135;
  // slow fields on a coarse grid
  const CS = 6, gw = Math.ceil(cw / CS) + 2, gh = Math.ceil(ch / CS) + 2;
  const zf = new Float32Array(gw * gh), wx = new Float32Array(gw * gh), wy = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const fx = (i * CS) / res - PAD, fy = (j * CS) / res - PAD, ddx = fx - a.cx, ddy = a.cy - fy;
    const u = Math.atan2(ddx, ddy) * a.R, v = a.R - Math.hypot(ddx, ddy), k = j * gw + i;
    zf[k] = nz.fbm(u / 480, v / 480 + 3.3, 3);
    wx[k] = nz.fbm(u / 150 + 40.5, v / 150, 2); wy[k] = nz.fbm(u / 150 - 7.1, v / 150 + 21.7, 2);
  }
  const bil = (src, x, y) => {
    const fx = x / CS, fy = y / CS, i0 = fx | 0, j0 = fy | 0, tx = fx - i0, ty = fy - j0, k = j0 * gw + i0;
    return (src[k] + (src[k + 1] - src[k]) * tx) * (1 - ty) + (src[k + gw] + (src[k + gw + 1] - src[k + gw]) * tx) * ty;
  };
  let i = 0;
  for (let y = 0; y < ch; y++) {
    const fy = y / res - PAD;
    for (let x = 0; x < cw; x++, i += 4) {
      const fx = x / res - PAD, ddx = fx - a.cx, ddy = a.cy - fy;
      const u = Math.atan2(ddx, ddy) * a.R, v = a.R - Math.sqrt(ddx * ddx + ddy * ddy);
      const m = L.clamp(0.5 + bil(zf, x, y) * 1.25), ux = bil(wx, x, y), uy = bil(wy, x, y);
      let ci = 0, fl = 0;
      if (v > 0) {
        // paint on timber: cracks run mostly with the grain (along the arc); some cells have dropped off
        cell(u / 92 + ux * 0.5, v / 58 + uy * 0.5);
        ci = (1 - sstep(0.0, 0.07, cE)) * (0.25 + 0.75 * m);
        const keep = 0.3 + 0.7 * sstep(90, 560, Math.abs(u));
        if (v > 22 && cId < (0.006 + 0.07 * sstep(0.62, 1, m)) * keep) fl = sstep(0.05, 0.13, cE);
        cell(u / 33 + 9.5 + ux * 1.1, v / 23 + 5.5 + uy * 1.1);
        ci = Math.max(ci, (1 - sstep(0.0, 0.075, cE)) * 0.6 * sstep(0.4, 0.9, m));
        if (v > 22 && cId < (0.012 + 0.17 * sstep(0.6, 1, m)) * keep) fl = Math.max(fl, sstep(0.05, 0.16, cE));
      } else {
        // lacquer: finer 断纹; kept faint behind the tagline
        const tz = sstep(0.85, 1.7, Math.hypot((fx - 960) / 460, (fy - tzY) / 215));
        cell(u / 128 + 50.5 + ux * 0.7, v / 44 + 50.5 + uy * 0.7);
        ci = (1 - sstep(0.0, 0.05, cE)) * (0.3 + 0.6 * m) * (0.5 + 0.5 * tz);
        cell(u / 46 + 70.5 + ux * 1.2, v / 19 + 70.5 + uy * 1.2);
        ci = Math.max(ci, (1 - sstep(0.0, 0.07, cE)) * 0.42 * sstep(0.35, 0.9, m) * (0.35 + 0.65 * tz));
        if (v < -16 && cId < 0.085 * sstep(0.6, 1, m) * tz) fl = sstep(0.05, 0.16, cE);
      }
      cd[i] = 16; cd[i + 1] = 9; cd[i + 2] = 8; cd[i + 3] = ci * 255;
      fd[i] = fd[i + 1] = fd[i + 2] = 255; fd[i + 3] = fl * 255;
    }
  }
  const up = (img) => {
    const small = L.makeCanvas(cw, ch); small.getContext('2d').putImageData(img, 0, 0);
    const out = L.makeCanvas(w, h), g = out.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(small, 0, 0, w, h);
    out._pad = PAD; return out;
  };
  return { crack: up(cImg), flake: up(fImg) };
}

// ───────────────────────── vermilion lacquer above the arc ─────────────────────────
function paintLacquer(g, env) {
  const a = env.arc, FW = W + PAD * 2, FH = H + PAD * 2;
  g.fillStyle = L.radial(g, 240, -90, 80, 2050, [[0, '#a8291d'], [0.28, '#8e1f18'], [0.68, '#791812'], [1, '#540f0b']]);
  g.fillRect(-PAD, -PAD, FW, FH);
  // depth of the lacquer: slow clouds, then the brush drag of the last coat (follows the board = along the arc)
  g.save();
  g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.42;
  g.drawImage(L.noiseLayer(PAD, { seed: 's17lq1', scale: 380, octaves: 4, warp: 0.7, res: 0.2, contrast: 1.5 }), -PAD, -PAD);
  g.globalAlpha = 0.3;
  g.drawImage(L.polarNoiseLayer(env, PAD, { seed: 's17lq2', scale: 9, sx: 34, sy: 1, octaves: 3, res: 0.5, contrast: 1.5 }), -PAD, -PAD);
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.5;
  g.drawImage(L.noiseLayer(PAD, { seed: 's17lq3', scale: 150, octaves: 4, warp: 0.9, res: 0.25, contrast: 1.6, ramp: [[0, '#5a1410'], [0.5, '#ffffff'], [1, '#ffffff']] }), -PAD, -PAD);
  g.restore();
  L.speckle(g, { seed: 's17pit', count: 2600, x: -PAD, y: -PAD, w: FW, h: 900, rMin: 0.5, rMax: 1.7, colors: ['#2a0705', '#3d0c08'], alpha: [0.15, 0.55] });
  L.speckle(g, { seed: 's17dust', count: 700, x: -PAD, y: -PAD, w: FW, h: 900, rMin: 0.4, rMax: 1.3, colors: ['#f0b8a4', '#ffd9bf'], alpha: [0.08, 0.32] });
  // even out the tagline zone
  g.save(); g.translate(960, a.crestY - 140); g.scale(1, 0.5);
  g.fillStyle = L.radial(g, 0, 0, 0, 560, [[0, 'rgba(128,27,21,0.5)'], [0.6, 'rgba(128,27,21,0.4)'], [1, 'rgba(128,27,21,0)']]);
  g.fillRect(-600, -600, 1200, 1200);
  g.restore();
  // the board sits behind the beam: contact shade just above the arc
  g.fillStyle = L.radial(g, a.cx, a.cy, a.R, a.R + 34, [[0, 'rgba(22,3,2,0.62)'], [0.3, 'rgba(22,3,2,0.3)'], [1, 'rgba(22,3,2,0)']]);
  a.pathBand(g, 36, -2); g.fill();
}

function buildMain(env) {
  const a = env.arc, FW = W + PAD * 2, FH = H + PAD * 2;
  const gold = buildGold(env);
  const { crack, flake } = buildAging(env);

  // height map → relief light
  const height = L.makeLayer(PAD, (g) => {
    g.fillStyle = '#808080'; g.fillRect(-PAD, -PAD, FW, FH);
    g.globalAlpha = 0.16;
    g.drawImage(L.polarNoiseLayer(env, PAD, { seed: 's17lq2', scale: 9, sx: 34, sy: 1, octaves: 3, res: 0.5, contrast: 1.5 }), -PAD, -PAD);
    g.globalAlpha = 1;
    drawPattern(g, env, HGT);
    g.save(); a.clipBelow(g, 0);
    g.globalAlpha = 0.22; g.globalCompositeOperation = 'overlay';
    g.drawImage(L.grainTex(FW, FH, { seed: 's17hg', amount: 0.9, size: 2 }), -PAD, -PAD);
    g.restore();
    g.globalAlpha = 0.95; g.drawImage(L.filtered(gold, 'brightness(0) invert(1)'), -PAD, -PAD);
    g.globalAlpha = 0.85; g.drawImage(L.filtered(flake, 'brightness(0.22)'), -PAD, -PAD);
    g.globalAlpha = 1; g.drawImage(L.filtered(crack, 'brightness(0)'), -PAD, -PAD);
  });
  const bump = L.bumpLight(height, { angle: 45, strength: 3.4, blur: 1.1, res: 0.5 });

  // the bare 地仗 ground that shows where paint has flaked
  const groundSmall = L.stoneTex(FW / 2, FH / 2, { base: '#8a7760', dark: '#4e4034', light: '#b9a88c', seed: 's17ground', scale: 70, speck: 0.6 });
  const chips = L.makeLayer(PAD, (g) => {
    g.drawImage(groundSmall, -PAD, -PAD, FW, FH);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(flake, -PAD, -PAD);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(46,10,6,0.62)'; a.pathAbove(g, 0); g.fill();
  });

  const main = L.makeLayer(PAD, (g) => {
    paintLacquer(g, env);
    drawPattern(g, env, COL);
    // mineral pigment: uneven density, brush drag, coarse crystals, grime
    g.save(); a.clipBelow(g, 0);
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.55;
    g.drawImage(L.noiseLayer(PAD, { seed: 's17mott', scale: 44, octaves: 4, warp: 0.7, res: 0.33, contrast: 1.6 }), -PAD, -PAD);
    g.globalAlpha = 0.3;
    g.drawImage(L.polarNoiseLayer(env, PAD, { seed: 's17brush', scale: 7, sx: 10, sy: 1, octaves: 2, res: 0.5, contrast: 1.4 }), -PAD, -PAD);
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.4;
    g.drawImage(L.grainTex(FW, FH, { seed: 's17pg', amount: 0.75, size: 2 }), -PAD, -PAD);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    L.speckle(g, { seed: 's17xtal', count: 15000, x: -PAD, y: 380, w: FW, h: H + PAD - 380, rMin: 0.5, rMax: 2.1, colors: ['#e6fbff', '#c9ffe9', '#ffffff', '#bfe0ff'], alpha: [0.08, 0.42] });
    L.speckle(g, { seed: 's17dark', count: 7000, x: -PAD, y: 380, w: FW, h: H + PAD - 380, rMin: 0.5, rMax: 2.4, colors: ['#06102a', '#04241a', '#1a120a'], alpha: [0.1, 0.45] });
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.55;
    g.drawImage(L.noiseLayer(PAD, { seed: 's17grime', scale: 250, octaves: 4, warp: 0.8, res: 0.2, contrast: 1.5, ramp: [[0, '#6f5d40'], [0.55, '#ffffff'], [1, '#ffffff']] }), -PAD, -PAD);
    g.restore();
    // gilding stands proud of the paint
    g.save(); g.shadowColor = 'rgba(3,5,18,0.7)'; g.shadowBlur = 5; g.shadowOffsetX = 2.5; g.shadowOffsetY = 3.5;
    g.drawImage(gold, -PAD, -PAD);
    g.restore();
    // craquelure, flaked cells
    g.globalAlpha = 0.8; g.drawImage(crack, -PAD, -PAD); g.globalAlpha = 1;
    g.drawImage(chips, -PAD, -PAD);
    // relief
    g.globalCompositeOperation = 'overlay'; g.drawImage(bump, -PAD, -PAD);
    // raking light from the upper left; the beam falls away into shade toward the bottom
    g.globalCompositeOperation = 'soft-light';
    g.fillStyle = L.linear(g, 0, 0, W, H, [[0, 'rgba(255,238,205,0.4)'], [0.45, 'rgba(128,128,128,0)'], [1, 'rgba(0,0,12,0.5)']]);
    g.fillRect(-PAD, -PAD, FW, FH);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 640, a.R - 250, [[0, 'rgba(8,8,26,0.6)'], [1, 'rgba(8,8,26,0)']]);
    a.pathBelow(g, -200); g.fill();
  });
  return { main: L.filtered(main, 'saturate(1.2) contrast(1.06)'), gold };
}

function flare(ctx, x, y, size, alpha) {
  if (alpha <= 0.01) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha; ctx.translate(x, y);
  ctx.fillStyle = L.radial(ctx, 0, 0, 0, size, [[0, 'rgba(255,250,225,0.95)'], [0.18, 'rgba(255,226,140,0.5)'], [1, 'rgba(255,190,70,0)']]);
  ctx.fillRect(-size, -size, size * 2, size * 2);
  ctx.rotate(0.5);
  for (let k = 0; k < 2; k++) {
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = L.linear(ctx, -size * 1.7, 0, size * 1.7, 0, [[0, 'rgba(255,240,190,0)'], [0.5, 'rgba(255,250,225,0.9)'], [1, 'rgba(255,240,190,0)']]);
    ctx.beginPath(); ctx.moveTo(-size * 1.7, 0); ctx.lineTo(0, -1.3); ctx.lineTo(size * 1.7, 0); ctx.lineTo(0, 1.3); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

export default {
  name: '旋子彩画',
  tone: 'light',
  init(env) {
    const a = env.arc, dth = dTheta(a);
    const { main, gold } = buildMain(env);
    // where the leaf catches the light: the rosette eyes and a few points on the bead
    const glints = [];
    for (let k = -3; k <= 3; k++) { const q = a.pt(k * dth, FC); glints.push({ x: q.x - 12, y: q.y - 14, ph: (k + 3) * 0.37, size: 26 }); }
    [-0.31, -0.118, 0.052, 0.236].forEach((th, i) => { const q = a.pt(th, -4); glints.push({ x: q.x, y: q.y, ph: 0.5 + i * 0.29, size: 20 }); });
    S = { main, sparkA: buildSpark(gold, 's17spA'), sparkB: buildSpark(gold, 's17spB'), glints };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.006, 0.006, p), zoom = L.lerp(1.0, 1.022, p);
    L.blit(ctx, env, S.main, { rot, zoom });
    // gold leaf twinkles
    const tw = 0.5 + 0.5 * Math.sin(TAU * (p * 0.9 + 0.1));
    L.blit(ctx, env, S.sparkA, { rot, zoom, alpha: 0.2 + 0.8 * tw, blend: 'lighter' });
    L.blit(ctx, env, S.sparkB, { rot, zoom, alpha: 0.2 + 0.8 * (1 - tw), blend: 'lighter' });
    L.cam(ctx, env, { rot, zoom }, () => {
      // a sheen sliding along the gilded bead and across the paint below it
      const sx = L.lerp(620, 1330, p);
      ctx.save(); a.clipBand(ctx, 0, -BEAD);
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = L.linear(ctx, sx - 330, 0, sx + 330, 0, [[0, 'rgba(255,244,200,0)'], [0.5, 'rgba(255,246,205,0.55)'], [1, 'rgba(255,244,200,0)']]);
      ctx.fillRect(sx - 330, 0, 660, H);
      ctx.restore();
      ctx.save(); a.clipBelow(ctx, -BEAD);
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = L.radial(ctx, sx, a.crestY + 210, 0, 720, [[0, 'rgba(255,250,235,0.5)'], [0.5, 'rgba(255,250,235,0.18)'], [1, 'rgba(255,250,235,0)']]);
      ctx.fillRect(sx - 720, a.crestY - 520, 1440, 1460);
      ctx.restore();
    });
    L.cam(ctx, env, { rot, zoom }, () => {
      for (const q of S.glints) {
        const k = Math.sin(Math.PI * L.clamp(p * 1.15 - q.ph * 0.5 + 0.35));
        flare(ctx, q.x, q.y, q.size, 0.15 + 0.75 * k * k);
      }
    });
    L.vignette(ctx, { strength: 0.3, inner: 0.5 });
  },
};
