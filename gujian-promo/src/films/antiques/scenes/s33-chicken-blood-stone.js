// s33 — 鸡血石. A polished dome of black-ground chicken-blood stone (黑地鸡血) in the dark; only black and vermilion.
// The arc is the stone's upper silhouette: a hair-thin vermilion rim light with a narrow dark gutter hugging its outside.
// Below it the ground is lacquer-black with faint grey wisps; from the bottom of frame a big mass of "blood" wells up —
// cinnabar-red clots whose edges break into bands, clouds and loose grains. Above the arc a near-black red-brown void
// is dusted with cinnabar motes like red stardust under a microscope (thin and dim behind the tagline).
//
// Built once in init():
//   · stone  — the blood is shaded per pixel: a warped mound + flow bands give a signed "amount of blood" T (px);
//              worley cells turn T into individual grains (solid inside, scattered at the fringe);
//   · dust   — ~50 k motes, split into a steady layer and three twinkle groups that are cross-faded per frame.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 72;      // the stone slides ≈ ±11 px along the arc
const BP = 44;       // the dust behind it moves far less
let S = null;

const sstep = (a, b, v) => { let t = (v - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
function h2(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// allocation-free worley: distance to the nearest feature point in cD, two independent ids of that cell in cId / cId2
let cD = 0, cId = 0, cId2 = 0, cDx = 0, cDy = 0;
function cell(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let d1 = 9, hb = 0, bx = 0, by = 0;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const cx = xi + ox, cy = yi + oy;
    let h = (Math.imul(cx, 374761393) + Math.imul(cy, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    const dx = cx + (h & 1023) / 1023 - x, dy = cy + ((h >>> 10) & 1023) / 1023 - y, d = dx * dx + dy * dy;
    if (d < d1) { d1 = d; hb = h; bx = dx; by = dy; }
  }
  cD = Math.sqrt(d1); cId = ((hb >>> 20) & 63) / 63; cId2 = ((hb >>> 26) & 63) / 63; cDx = bx; cDy = by;
}

/** a layer that only covers frame rows y0…y1 (plus `pad` px left and right); draw in frame coordinates */
function band(pad, y0, y1, draw) {
  const c = L.makeCanvas(W + pad * 2, y1 - y0), g = c.getContext('2d');
  g.translate(pad, -y0); c._x0 = -pad; c._y0 = y0;
  if (draw) draw(g, c);
  return c;
}
/** L.blit for band layers */
function blitAt(ctx, env, c, o = {}) {
  const { rot = 0, zoom = 1, alpha = 1, blend = 'source-over' } = o, a = env.arc;
  ctx.save();
  ctx.globalAlpha *= alpha; ctx.globalCompositeOperation = blend;
  ctx.translate(a.cx, a.crestY); ctx.scale(zoom, zoom); ctx.translate(-a.cx, -a.crestY);
  if (rot) { ctx.translate(a.cx, a.cy); ctx.rotate(rot); ctx.translate(-a.cx, -a.cy); }
  ctx.drawImage(c, c._x0, c._y0);
  ctx.restore();
}

const BLOOD = [[0, '#240302'], [0.2, '#6e0f0c'], [0.42, '#a81510'], [0.6, '#d81e1a'], [0.8, '#ee2c1c'], [0.91, '#ff4a32'], [0.97, '#ff8466'], [1, '#ffd0bc']];
const MOTE = [[0, '#340705'], [0.28, '#74100c'], [0.52, '#c01a15'], [0.72, '#e42c1c'], [0.85, '#ff5236'], [0.94, '#ff9a7c'], [1, '#ffe2d4']];
// rounded, cloud-like lumps (0 … ~0.8, mean ≈ 0.3)
const billow = (n, x, y) => Math.abs(n.n2(x, y)) * 0.6 + Math.abs(n.n2(x * 2.1 + 5, y * 2.1 - 3)) * 0.28 + Math.abs(n.n2(x * 4.3 - 7, y * 4.3 + 9)) * 0.12;

/** everything below the arc: black ground + the blood, shaded per pixel */
function buildBody(env) {
  const a = env.arc;
  const X0 = -PAD, Y0 = Math.floor(a.crestY) - 2;
  const RW = W + PAD * 2, RH = H + PAD - Y0;
  const nA = L.makeNoise('s33a'), nB = L.makeNoise('s33b');
  const PHI = -0.3, ca = Math.cos(PHI), sa = Math.sin(PHI);   // the blood "flows" up toward the right

  // slow fields on a coarse grid
  const CS = 4, cw = Math.ceil(RW / CS) + 2, ch = Math.ceil(RH / CS) + 2;
  const fT = new Float32Array(cw * ch), fTone = new Float32Array(cw * ch), fW = new Float32Array(cw * ch), fH = new Float32Array(cw * ch),
    fGx = new Float32Array(cw * ch), fGy = new Float32Array(cw * ch), fS = new Float32Array(cw * ch);
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const x = X0 + i * CS, y = Y0 + j * CS, k = j * cw + i;
    // flow coordinates, bent so the bands meander instead of running ruler-straight
    const bx = x + 70 * nA.n2(x / 290 + 1.3, y / 290 - 4.1), by = y + 55 * nA.n2(x / 290 - 8.6, y / 290 + 2.9);
    const A = bx * ca + by * sa, B = -bx * sa + by * ca;
    // grey-black flocculent clouds in the ground
    fW[k] = sstep(0.3, 0.85, nA.fbm(A / 340 + 3, B / 150 - 5, 4, 2, 0.5) * 0.5 + 0.5 + 0.08 * nB.n2(x / 70, y / 70));
    if (y < 640) { fT[k] = -999; continue; }
    const dr = a.drAt(x, y);
    const wx = 70 * nA.fbm(x / 340 + 3.1, y / 340 - 7.7, 3), wy = 60 * nA.fbm(x / 340 - 21.4, y / 340 + 13.2, 3);
    const T0 = (1 - Math.hypot((x + wx - 950) / 650, (y + wy - 1235) / 430)) * 400;
    let T = T0 + 120 * (billow(nB, x / 200 + 9, y / 160 - 4) - 0.3) + 22 * nB.fbm(A / 220 + 1.7, B / 50 + 5.2, 3);
    // bands and clouds that have drifted off the main mass, thinning out with distance
    const bT = (nA.fbm(A / 250 + 11, B / 62 - 3, 3) - 0.4) * 240 - Math.max(0, -T0) * 1.0;
    if (bT > T) T = bT;
    T -= 600 * sstep(-190, -80, dr);      // the ground under the rim stays clean black
    fT[k] = T;
    // deep red inside, the freshest vermilion along the upper edge where the side light skims it
    fTone[k] = 0.54 + 0.26 * nA.fbm(A / 420 + 5, B / 170 - 9, 2) - 0.27 * sstep(30, 250, T) + 0.07 * nB.fbm(x / 34 + 2, y / 34, 2) - 0.1 * sstep(950, 1130, y);
    // thin places inside the mass: broad lenses lying with the flow where the grains part and the black ground shows through
    fS[k] = sstep(0.02, 0.62, nB.fbm(A / 330 + 31, B / 105 - 17, 2) + 0.12 * nB.n2(x / 55, y / 55)) * sstep(20, 90, T);
    fH[k] = 0.3 + 0.7 * sstep(-0.3, 0.5, nB.fbm(x / 210 - 6, y / 210 + 8, 2));     // how dusty the edge is here: crisp ↔ powdery
    fGx[k] = 0.7 * nA.n2(x / 170 + 40, y / 170 - 17); fGy[k] = 0.7 * nA.n2(x / 170 - 23, y / 170 + 61);   // stretches / squeezes the grain lattice → coarse and fine patches
  }
  const bil = (src, i, j) => {
    const fx = i / CS, fy = j / CS, i0 = fx | 0, j0 = fy | 0, tx = fx - i0, ty = fy - j0, k = j0 * cw + i0;
    const a0 = src[k], a1 = src[k + 1], b0 = src[k + cw], b1 = src[k + cw + 1];
    return (a0 + (a1 - a0) * tx) * (1 - ty) + (b0 + (b1 - b0) * tx) * ty;
  };

  const rampF = L.makeRamp(BLOOD), lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) { const c = rampF(i / 255); lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2]; }
  const img = new ImageData(RW, RH), d = img.data;      // the black ground
  const gim = new ImageData(RW, RH), e = gim.data;      // the blood alone
  const rs = L.rng('s33glint'), glints = [];
  for (let j = 0; j < RH; j++) {
    const y = Y0 + j;
    for (let i = 0; i < RW; i++) {
      const x = X0 + i, o = (j * RW + i) * 4;
      const w = bil(fW, i, j), hp = h2(x, y);
      d[o] = 5 + 8 * w + 2 * hp; d[o + 1] = 3 + 5 * w + hp; d[o + 2] = 3 + 5 * w + hp; d[o + 3] = 255;
      const T = bil(fT, i, j);
      if (T < -100) continue;
      const Tj = T + 10 * nB.n2(x / 12, y / 12) + 4.5 * nB.n2(x / 4.4 + 7, y / 4.4);
      const thin = bil(fS, i, j);
      const D = sstep(-72 * bil(fH, i, j), 4, Tj) * (1 - 0.36 * thin), paste = sstep(-3, 4, Tj) * (1 - 0.72 * thin);
      const wgx = bil(fGx, i, j), wgy = bil(fGy, i, j);
      // a sparse population of bigger crystals among the fine ones
      cell(x / 13.5 + wgy * 0.5 + 7.3, y / 13.5 - wgx * 0.5 + 2.9);
      const bigR = 0.2 + 0.2 * cId2, big = cId < 0.2 * D ? sstep(bigR, bigR * 0.6, cD) : 0, bigTone = cId2;
      cell(x / 6.2 + wgx, y / 6.2 + wgy);
      const rad = 0.24 + 0.3 * cId2;
      let grain = cId < D * D ? sstep(rad, rad * 0.45, cD) : 0;
      if (big > grain) grain = big;
      const cover = paste > grain ? paste : grain;
      if (cover < 0.003) continue;
      const edge = 1 - sstep(0, 46, T), gId = cId, gD = cD;
      // each grain is a little bead lit from the upper left; one in thirty turns a facet straight at the light
      const bead = L.clamp((cDx + cDy) * 0.7071 / rad, -1, 1), flash = cId2 > 0.96 && cD < rad * 0.62 && D > 0.4;
      // every grain is a crystal lying its own way: most sit near the local red, a few flash, a few stay dark
      let gv = (gId - 0.5) * 0.3 + (cId2 > 0.9 ? 0.2 : cId2 < 0.12 ? -0.2 : 0);
      cell(x / 23 + 31.7, y / 23 - 12.4);       // clots: the grains come in lumps of slightly different red
      let t = bil(fTone, i, j) + 0.34 * edge + gv + (cId - 0.5) * 0.12 - 0.17 * sstep(0.26, 0.6, gD) * paste + (hp - 0.5) * 0.08 + 0.13 * bead - 0.2 * thin;
      if (flash) t = Math.max(t, 0.93 + 0.07 * hp); else if (t > 0.9) t = 0.9;
      if (big > 0.5) t += 0.1 + 0.22 * (bigTone - 0.35);
      if (paste < 0.5) t += 0.12 * (1 - thin);        // loose grains at the fringe catch the most light
      const li = ((t < 0 ? 0 : t > 1 ? 1 : t) * 255 | 0) * 3;
      e[o] = lut[li]; e[o + 1] = lut[li + 1]; e[o + 2] = lut[li + 2]; e[o + 3] = cover * 255;
      if (paste > 0.9 && T > 6 && rs() < 0.0003 * (1 + 2 * edge)) glints.push({ x, y, s: rs.range(0.6, 1.7), ph: rs(), k: rs() });
    }
  }
  const cnv = L.makeCanvas(RW, RH); cnv.getContext('2d').putImageData(img, 0, 0);
  const blood = L.makeCanvas(RW, RH), bg = blood.getContext('2d'); bg.putImageData(gim, 0, 0);
  // star points: small loose clots of grains strewn round the mass, thinning out with distance
  const rc = L.rng('s33clot');
  bg.translate(-X0, -Y0);
  for (let n = 0, made = 0; n < 4000 && made < 46; n++) {
    const x = rc.range(-PAD, W + PAD), y = rc.range(700, H + PAD);
    const T0 = (1 - Math.hypot((x - 950) / 650, (y - 1235) / 430)) * 400;
    if (T0 > -40 || a.drAt(x, y) > -130 || rc() > Math.exp(T0 / 150)) continue;
    made++;
    const cnt = rc.int(2, 12), sig = rc.range(1.5, 6), ang = PHI + rc.range(-0.4, 0.4), tone = rc.range(0.55, 0.95);
    for (let q = 0; q < cnt; q++) {
      const u = rc.gauss() * sig * 2.2, v = rc.gauss() * sig, c = rampF(L.clamp(tone + rc.range(-0.15, 0.1)));
      bg.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; bg.globalAlpha = rc.range(0.6, 1);
      bg.beginPath(); bg.ellipse(x + u * Math.cos(ang) - v * Math.sin(ang), y + u * Math.sin(ang) + v * Math.cos(ang), rc.range(0.8, 2.7), rc.range(0.7, 2.1), rc() * 3.14, 0, L.TAU); bg.fill();
    }
  }
  return { cnv, blood, X0, Y0, glints };
}

/** the stone layer: dark gutter outside the rim, the body, the rim light */
function buildStone(env) {
  const a = env.arc, R = a.R;
  const body = buildBody(env);
  const Y0 = Math.floor(a.crestY) - 70, Y1 = H + PAD;
  const full = (g) => g.fillRect(-PAD, Y0, W + PAD * 2, Y1 - Y0);
  const sp = a.span(PAD + 40);
  const layer = band(PAD, Y0, Y1, (g) => {
    // the gutter: a narrow dark trench hugging the outside of the rim, with a faint lit lip beyond it
    g.fillStyle = L.radial(g, a.cx, a.cy, R - 2, R + 38, [[0, 'rgba(4,2,2,1)'], [0.74, 'rgba(4,2,2,0.97)'], [0.9, 'rgba(4,2,2,0.5)'], [1, 'rgba(4,2,2,0)']]);
    a.pathBand(g, 40, -3); g.fill();
    g.fillStyle = L.radial(g, a.cx, a.cy, R + 33, R + 52, [[0, 'rgba(150,44,26,0)'], [0.25, 'rgba(150,44,26,0.3)'], [1, 'rgba(150,44,26,0)']]);
    a.pathBand(g, 54, 31); g.fill();

    {
      const rl = L.rng('s33lip'), nl = L.makeNoise('s33lip'), mr = L.makeRamp(MOTE);
      for (let i = 0; i < 5200; i++) {
        const th = rl.range(-sp, sp);
        if (rl() > 0.25 + 0.75 * (nl.fbm(th * R / 110, 4.2, 2) * 0.5 + 0.5)) continue;
        const dd = 41 + Math.abs(rl.gauss()) * 5 + (rl.chance(0.2) ? rl.range(0, 14) : 0);
        const p = a.pt(th, dd), c = mr(Math.pow(rl(), 1.5));
        g.globalAlpha = rl.range(0.3, 0.95); g.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
        const rad = rl.range(0.4, 1.25);
        g.fillRect(p.x - rad, p.y - rad, rad * 2, rad * 2);
      }
      g.globalAlpha = 1;
    }

    g.save(); a.clipBelow(g, 0);
    g.drawImage(body.cnv, body.X0, body.Y0);
    // the polished dome mirrors a soft light: one long reflection lying along the limb on the key-light side
    const refl = band(PAD, Y0, Y1, (s) => {
      const box2 = (x0, x1, k) => {
        const t = band(PAD, Y0, Y1, (q) => {
          q.fillStyle = L.radial(q, a.cx, a.cy, R - 330, R - 236, [[0, 'rgba(176,28,18,0)'], [0.35, `rgba(176,28,18,${0.3 * k})`], [0.75, `rgba(176,28,18,${0.4 * k})`], [1, 'rgba(176,28,18,0)']]);
          q.fillRect(-PAD, Y0, W + PAD * 2, Y1 - Y0);
          q.globalCompositeOperation = 'destination-in';
          const e0 = 150 / W;
          q.fillStyle = L.linear(q, 0, 0, W, 0, [[0, 'rgba(0,0,0,0)'], [x0 / W, 'rgba(0,0,0,0)'], [x0 / W + e0, 'rgba(0,0,0,1)'], [x1 / W - e0, 'rgba(0,0,0,1)'], [x1 / W, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0)']]);
          q.fillRect(-PAD, Y0, W + PAD * 2, Y1 - Y0);
        });
        s.drawImage(t, -PAD, Y0);
      };
      const box = (x0, x1, k) => {
        const t = band(PAD, Y0, Y1, (q) => {
          q.fillStyle = L.radial(q, a.cx, a.cy, R - 76, R - 26, [[0, 'rgba(150,22,14,0)'], [0.3, `rgba(150,22,14,${0.12 * k})`], [0.7, `rgba(170,26,16,${0.34 * k})`], [0.9, `rgba(176,28,18,${0.4 * k})`], [1, 'rgba(176,28,18,0)']]);
          q.fillRect(-PAD, Y0, W + PAD * 2, Y1 - Y0);
          q.globalCompositeOperation = 'destination-in';
          const e0 = 170 / W;
          q.fillStyle = L.linear(q, 0, 0, W, 0, [[0, 'rgba(0,0,0,0)'], [x0 / W, 'rgba(0,0,0,0)'], [x0 / W + e0, 'rgba(0,0,0,1)'], [x1 / W - e0, 'rgba(0,0,0,1)'], [x1 / W, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0)']]);
          q.fillRect(-PAD, Y0, W + PAD * 2, Y1 - Y0);
        });
        s.drawImage(t, -PAD, Y0);
      };
      box(250, 900, 0.85); box(1180, 1560, 0.3);
      // the polish is only "seen" where it mirrors the light: hairline scratches and settled dust show up inside the strips
      const rr = L.rng('s33scr');
      s.globalCompositeOperation = 'source-atop'; s.lineCap = 'round';
      for (let i = 0; i < 26; i++) {
        const th = a.thetaAtX(rr.range(300, 1450)), dr0 = -rr.range(26, 76), len = rr.range(30, 150) / R, tilt = rr.range(-16, 16);
        const p0 = a.pt(th - len / 2, dr0 - tilt / 2), p1 = a.pt(th + len / 2, dr0 + tilt / 2);
        s.strokeStyle = rr.chance(0.5) ? `rgba(255,96,64,${rr.range(0.25, 0.6)})` : `rgba(20,2,2,${rr.range(0.3, 0.7)})`; s.lineWidth = rr.range(0.6, 1.1);
        s.beginPath(); s.moveTo(p0.x, p0.y); s.lineTo(p1.x, p1.y); s.stroke();
      }
      for (let i = 0; i < 260; i++) {
        const p = a.pt(a.thetaAtX(rr.range(300, 1450)), -rr.range(26, 76));
        s.fillStyle = rr.chance(0.6) ? `rgba(255,110,76,${rr.range(0.3, 0.9)})` : `rgba(14,2,2,${rr.range(0.3, 0.7)})`;
        s.beginPath(); s.arc(p.x, p.y, rr.range(0.4, 1.2), 0, L.TAU); s.fill();
      }
    });
    g.globalCompositeOperation = 'lighter';
    // cinnabar lies in a faintly translucent matrix: the deeper grains show as a soft red haze round the crisp ones
    g.filter = 'blur(7px)'; g.globalAlpha = 0.16; g.drawImage(body.blood, body.X0, body.Y0);
    g.filter = 'blur(30px)'; g.globalAlpha = 0.1; g.drawImage(body.blood, body.X0, body.Y0);
    g.filter = 'none'; g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.drawImage(body.blood, body.X0, body.Y0);
    g.globalCompositeOperation = 'lighter';
    g.drawImage(refl, -PAD, Y0);
    // the limb itself mirrors a little of the red void behind it
    const sheen = band(PAD, Y0, Y1, (s) => {
      s.fillStyle = L.radial(s, a.cx, a.cy, R - 60, R, [[0, 'rgba(120,20,12,0)'], [0.6, 'rgba(130,22,14,0.08)'], [0.9, 'rgba(170,28,18,0.22)'], [1, 'rgba(200,34,22,0.4)']]);
      s.fillRect(-PAD, Y0, W + PAD * 2, Y1 - Y0);
      s.globalCompositeOperation = 'destination-in';
      s.fillStyle = L.linear(s, 0, 0, W, 0, [[0, 'rgba(0,0,0,0.45)'], [0.3, 'rgba(0,0,0,1)'], [0.55, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,0.25)']]);
      s.fillRect(-PAD, Y0, W + PAD * 2, Y1 - Y0);
    });
    g.drawImage(sheen, -PAD, Y0);
    g.restore();

    // ── the rim light ──
    const nz = L.makeNoise('s33rim'), r = L.rng('s33rim');
    const rimRamp = L.makeRamp([[0, '#7a100c'], [0.5, '#d81e1a'], [0.85, '#ff4a32'], [1, '#ff7a58']]), mote = L.makeRamp(MOTE);
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.filter = 'blur(3px)'; g.strokeStyle = 'rgba(216,30,26,0.22)'; g.lineWidth = 7; a.stroke(g, -3, -sp, sp);
    g.filter = 'none'; g.globalCompositeOperation = 'source-over';
    const step = 3 / R;
    for (let th = -sp; th < sp; th += step) {
      const s = th * R;
      const n1 = nz.fbm(s / 140, 2.2, 3) * 0.5 + 0.5, n2 = nz.n2(s / 9, 7.7) * 0.5 + 0.5;
      const key = 0.7 + 0.3 * Math.exp(-Math.pow((th + 0.12) / 0.22, 2));
      const I = L.clamp((0.35 + 0.65 * n1) * key + 0.15 * (n2 - 0.5));
      const w = 1.5 + 1.3 * n1 * key + 0.5 * n2;
      g.strokeStyle = L.css(rimRamp(I)); g.globalAlpha = 0.75 + 0.25 * I; g.lineWidth = w;
      g.beginPath(); g.arc(a.cx, a.cy, R - w / 2, th - Math.PI / 2, th + step * 1.3 - Math.PI / 2); g.stroke();
    }
    // cinnabar specks just inside the edge catch the same light
    const DC = ['#d81e1a', '#ff4a32', '#8c120e', '#ff7a58', '#d81e1a'];
    for (let i = 0; i < 4200; i++) {
      const th = r.range(-sp, sp), s = th * R;
      const clump = nz.fbm(s / 60, 9.1, 2) * 0.5 + 0.5;
      if (r() > 0.2 + 0.8 * clump) continue;
      const dd = Math.pow(r(), 2.2) * 20;
      const p = a.pt(th, 1 - dd), rad = r.range(0.4, 1.3) * (r.chance(0.06) ? 1.8 : 1);
      g.globalAlpha = r.range(0.35, 1) * (1 - dd / 26);
      g.fillStyle = r.pick(DC);
      g.beginPath(); g.arc(p.x, p.y, rad, 0, L.TAU); g.fill();
    }
    // … and loose grains have settled on the edge itself, in little drifts
    for (let i = 0; i < 2600; i++) {
      const th = r.range(-sp, sp), s = th * R;
      const drift = sstep(0.5, 0.78, nz.fbm(s / 95, 23.4, 3) * 0.5 + 0.5);
      if (r() > 0.04 + 0.96 * drift) continue;
      const dd = Math.abs(r.gauss()) * (1.6 + 3.4 * drift);
      const p = a.pt(th, dd + 0.4), c = mote(L.clamp(Math.pow(r(), 1.6) * 1.05));
      g.globalAlpha = r.range(0.55, 1); g.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
      const rad = r.range(0.6, 1.7) * (r.chance(0.08) ? 1.6 : 1);
      g.beginPath(); g.ellipse(p.x, p.y, rad, rad * r.range(0.6, 1), r() * 3.14, 0, L.TAU); g.fill();
    }
    g.restore();
  });

  // shallow depth of field: the far ends of the limb go a touch soft, and so does the bottom of frame,
  // where the dome bulges toward the lens
  const lg = layer.getContext('2d');
  const dof = (px, mask) => {
    const soft = band(PAD, Y0, Y1), sg = soft.getContext('2d');
    sg.save(); sg.setTransform(1, 0, 0, 1, 0, 0); sg.filter = `blur(${px}px)`; sg.drawImage(layer, 0, 0); sg.filter = 'none'; sg.restore();
    sg.globalCompositeOperation = 'destination-in'; sg.fillStyle = mask; full(sg);
    lg.globalCompositeOperation = 'destination-out'; lg.fillStyle = mask; full(lg);
    lg.globalCompositeOperation = 'lighter'; lg.drawImage(soft, -PAD, Y0);
    lg.globalCompositeOperation = 'source-over';
  };
  dof(1.7, L.linear(lg, 0, 0, W, 0, [[0, 'rgba(0,0,0,1)'], [0.16, 'rgba(0,0,0,0.5)'], [0.32, 'rgba(0,0,0,0)'], [0.7, 'rgba(0,0,0,0)'], [0.86, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,1)']]));
  dof(2.6, L.linear(lg, 0, 985, 0, H + 30, [[0, 'rgba(0,0,0,0)'], [0.5, 'rgba(0,0,0,0.4)'], [1, 'rgba(0,0,0,0.85)']]));
  return { stone: layer, glints: body.glints };
}

/** the void behind the stone, dusted with cinnabar motes */
function buildBack(env) {
  const a = env.arc;
  const Y0 = -BP, Y1 = Math.ceil(a.yAt(-BP - 30)) + 16;
  const nz = L.makeNoise('s33bg');
  const base = band(BP, Y0, Y1, (g) => {
    const full = () => g.fillRect(-BP, Y0, W + BP * 2, Y1 - Y0);
    g.fillStyle = '#1a0a08'; full();
    g.fillStyle = L.radial(g, a.cx, a.crestY - 60, 120, 1250, [[0, 'rgba(7,3,3,0.55)'], [0.45, 'rgba(7,3,3,0.26)'], [1, 'rgba(7,3,3,0)']]); full();
    g.globalCompositeOperation = 'lighter';
    for (const cx of [-60, W + 60]) { g.fillStyle = L.radial(g, cx, -40, 0, 880, [[0, 'rgba(60,10,7,0.3)'], [1, 'rgba(60,10,7,0)']]); full(); }
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.22;
    g.drawImage(L.noiseTex(W + BP * 2, Y1 - Y0, { seed: 's33mott', scale: 340, octaves: 4, res: 0.2, contrast: 1.5 }), -BP, Y0);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  });
  const tw = [0, 1, 2].map(() => band(BP, Y0, Y1));
  const ctxs = [base.getContext('2d'), ...tw.map((c) => c.getContext('2d'))];
  const ramp = L.makeRamp(MOTE), pal = [];
  for (let i = 0; i < 64; i++) pal.push(ramp(i / 63));
  const r = L.rng('s33dust'), hot = [];
  const tcy = a.crestY - 135;
  // a mote is a crystal splinter, not a dot: three to five uneven corners, lying any way round
  const shard = (g, x, y, rad) => {
    const n = 3 + ((r() * 2.7) | 0), a0 = r() * L.TAU, sq = r.range(0.5, 1), ca = Math.cos(a0), sa = Math.sin(a0);
    g.beginPath();
    for (let k = 0; k < n; k++) {
      const aa = (k + r.range(-0.3, 0.3)) * L.TAU / n, rr = rad * r.range(0.6, 1.3);
      const u = Math.cos(aa) * rr, v = Math.sin(aa) * rr * sq, px = x + u * ca - v * sa, py = y + u * sa + v * ca;
      if (k) g.lineTo(px, py); else g.moveTo(px, py);
    }
    g.closePath(); g.fill();
  };
  for (let n = 0; n < 215000; n++) {
    const x = r.range(-BP, W + BP), y = r.range(Y0, Y1);
    if (a.drAt(x, y) < 24) continue;
    const dn = Math.hypot((x - a.cx) / 1010, (y - (a.crestY - 110)) / 600);
    const calm = sstep(0.85, 1.9, Math.hypot((x - a.cx) / 430, (y - tcy) / 175));     // 0 behind the tagline
    const dens = (0.5 + 0.5 * sstep(0.2, 1.1, dn)) * (0.24 + 0.76 * calm) * (0.55 + 0.9 * (nz.fbm(x / 240, y / 240, 3) * 0.5 + 0.5));
    if (r() > dens) continue;
    const u = r();
    let rad, cls;
    if (u < 0.46) { rad = r.range(0.55, 1.0); cls = 0; } else if (u < 0.86) { rad = r.range(1.1, 2.0); cls = 1; } else if (u < 0.98) { rad = r.range(2.0, 3.1); cls = 2; } else { rad = r.range(3.1, 4.4); cls = 3; }
    let b = L.clamp(Math.pow(r(), 2.2) * (0.8 + 0.1 * cls) + 0.05 * cls);
    const facet = cls > 0 && r() < 0.09;       // a face turned straight at the light: these are the sparks
    if (facet) b = r.range(0.86, 1);
    b *= 0.5 + 0.5 * calm;
    const soft = sstep(0.9, 1.5, dn) * (0.4 + 0.6 * r());      // out toward the corners the motes drift out of focus
    const grp = r() < 0.5 ? 0 : 1 + Math.floor(r() * 3);
    const g = ctxs[grp], c = pal[Math.min(63, (b * 63) | 0)];
    const al = L.lerp(0.6, 1, r());
    if (cls === 0) {
      g.globalAlpha = al * (1 - 0.3 * soft); g.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
      const rr = rad * (1 + 0.5 * soft);
      g.fillRect(x - rr, y - rr * 0.8, rr * 2, rr * 1.6);
    } else if (soft < 0.4) {
      g.globalAlpha = al; g.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
      shard(g, x, y, rad * (1 + 0.4 * soft));
      if (b > 0.5 && cls > 1) {         // the lit corner of a bigger splinter
        const c2 = pal[Math.min(63, ((b + 0.2) * 63) | 0)];
        g.fillStyle = `rgb(${c2[0] | 0},${c2[1] | 0},${c2[2] | 0})`;
        shard(g, x - rad * 0.3, y - rad * 0.3, rad * 0.45);
      }
    } else {
      const R2 = rad * (1.3 + 1.5 * soft), cs = `${c[0] | 0},${c[1] | 0},${c[2] | 0}`;
      g.globalAlpha = 1;
      g.fillStyle = L.radial(g, x, y, 0, R2, [[0, `rgba(${cs},${al * 0.6})`], [0.55, `rgba(${cs},${al * 0.5})`], [1, `rgba(${cs},0)`]]);
      g.beginPath(); g.arc(x, y, R2, 0, L.TAU); g.fill();
    }
    if (facet && calm > 0.6 && soft < 0.4 && hot.length < 260) hot.push({ x, y, s: rad, ph: r(), k: r.range(0.5, 1) });
  }
  ctxs.forEach((g) => { g.globalAlpha = 1; });
  return { back: base, tw, hot };
}

/** a glint: a hard pink-white core with only a breath of bloom round it */
function glowSprite() {
  const c = L.makeCanvas(64, 64), g = c.getContext('2d');
  g.fillStyle = L.radial(g, 32, 32, 0, 32, [[0, 'rgba(255,232,214,1)'], [0.14, 'rgba(255,170,132,0.95)'], [0.3, 'rgba(255,84,54,0.4)'], [0.6, 'rgba(230,40,28,0.08)'], [1, 'rgba(216,30,26,0)']]);
  g.fillRect(0, 0, 64, 64);
  return c;
}

export default {
  name: '鸡血石',
  tone: 'light',
  init(env) {
    S = { ...buildBack(env), ...buildStone(env), spr: glowSprite() };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const t = p * (env.frames - 1);                 // frame index
    const rot = L.lerp(-0.0045, 0.0045, p);
    const bo = { rot: rot * 0.35, zoom: L.lerp(1.0, 1.012, p) };

    // the void and its dust: three groups of motes breathe out of step
    blitAt(ctx, env, S.back, bo);
    for (let i = 0; i < 3; i++) {
      const al = 0.22 + 0.78 * (0.5 + 0.5 * Math.cos(L.TAU * (t / 4.6 + i / 3)));
      blitAt(ctx, env, S.tw[i], { ...bo, blend: 'lighter', alpha: al });
    }
    // … and single motes flare
    L.cam(ctx, env, bo, () => {
      ctx.globalCompositeOperation = 'lighter';
      for (const q of S.hot) {
        const f = Math.pow(Math.max(0, Math.cos(L.TAU * (t / 5.2 + q.ph))), 5) * q.k;
        if (f < 0.04) continue;
        const sz = (3.5 + q.s * 2.6) * (0.6 + 0.4 * f);
        ctx.globalAlpha = f;
        ctx.drawImage(S.spr, q.x - sz, q.y - sz, sz * 2, sz * 2);
      }
    });

    // the stone
    blitAt(ctx, env, S.stone, { rot });

    // star points in the blood
    L.cam(ctx, env, { rot }, () => {
      ctx.globalCompositeOperation = 'lighter';
      for (const q of S.glints) {
        const f = 0.3 + 0.7 * Math.pow(Math.max(0, Math.cos(L.TAU * (t / 5.6 + q.ph))), 3);
        const sz = (2.4 + q.s * 2.4) * (0.7 + 0.3 * f);
        ctx.globalAlpha = f * (0.45 + 0.55 * q.k);
        ctx.drawImage(S.spr, q.x - sz, q.y - sz, sz * 2, sz * 2);
      }
    });

    // the hot spot of the rim light travels along the arc
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const hx = L.lerp(0.3, 0.44, p);
    ctx.strokeStyle = L.linear(ctx, 0, 0, W, 0, [[0, 'rgba(255,74,50,0)'], [hx - 0.2, 'rgba(255,74,50,0)'], [hx - 0.05, 'rgba(255,96,64,0.55)'], [hx, 'rgba(255,196,170,1)'],
      [hx + 0.05, 'rgba(255,96,64,0.55)'], [hx + 0.2, 'rgba(255,74,50,0)'], [1, 'rgba(255,74,50,0)']]);
    ctx.lineWidth = 2.4; a.stroke(ctx, -1.2);
    const gx = hx * W;
    ctx.translate(gx, a.yAt(gx)); ctx.rotate(a.thetaAtX(gx)); ctx.scale(1, 0.3);
    ctx.fillStyle = L.radial(ctx, 0, 0, 0, 110, [[0, 'rgba(255,90,60,0.34)'], [0.3, 'rgba(216,30,26,0.13)'], [1, 'rgba(216,30,26,0)']]);
    ctx.fillRect(-110, -110, 220, 220);
    ctx.restore();
  },
};
