// s04 — 福建土楼. Drone view down into a round rammed-earth tulou; we see the far half of the ring.
// The arc is the OUTER EAVE of the ring roof. Going inward (down the frame): shaded outer roof slope → ridge →
// sunlit inner slope of small grey tiles (瓦垄 run radially) → eave shadow → four storeys of timber galleries
// (posts, baluster railings, red lanterns, red door couplets) → cobbled courtyard → the roof of a lower inner ring.
//
// How it is built: the whole building is painted once as a flat "unrolled" strip (x = distance along the arc,
// y = depth inside the arc) — tiles and cobbles per pixel, timber work as vectors — and then wrapped onto the arc
// with a per-pixel polar warp. Everything is therefore concentric / radial, so rot about the arc centre is seamless.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 240;
const TOPM = 14;        // strip rows kept above the eave line (room for the scalloped tile ends)
const DEPTH = 650;      // strip rows below the eave line
const ROW = 10;         // 瓦垄 pitch of the main roof (px along the arc)
const ROW2 = 12;        // 瓦垄 pitch of the inner ring roof
const SPLIT = 0.56;     // share of a tile row taken by the convex cover tile (the rest is the trough)
const LAP = 6.5;        // exposed length of one tile
const BAY = 60;         // 开间: one bay of the gallery (px along the arc at the eave)
// depths inside the arc (px)
const D = { ridge: 64, eave: 206, f3: 246, f2: 291, f1: 335, kerb: 379, yard: 388, ring: 447, ridge2: 493 };
let S = null;

function h2(a, b) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function lutOf(stops) {
  const f = L.makeRamp(stops); const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) { const c = f(i / 255); lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2]; }
  return lut;
}
// brightness across one tile row (cover tile then trough), sun from the left / skylight only
const PROF = (() => {
  const N = 128, lit = new Float32Array(N), shd = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const fu = (i + 0.5) / N;
    if (fu < SPLIT) {
      const t = fu / SPLIT;
      lit[i] = 0.4 + 0.6 * Math.exp(-((t - 0.3) * (t - 0.3)) / 0.15);
      shd[i] = 0.5 + 0.28 * Math.sin(Math.PI * t);
    } else {
      const t = (fu - SPLIT) / (1 - SPLIT);
      lit[i] = 0.13 + 0.38 * L.smooth(t / 0.8) - 0.1 * L.smooth((t - 0.8) / 0.2);
      shd[i] = 0.2 + 0.16 * Math.sin(Math.PI * t);
    }
  }
  return { N, lit, shd };
})();

/** per-pixel small-grey-tile roof into rows yA..yB of an RGBA buffer (FW wide). */
function paintRoof(d, FW, yA, yB, o) {
  const { ridgeY, dir, lit, pitch, lap, seed, lut, gain, xg } = o;
  const prof = lit ? PROF.lit : PROF.shd, PN = PROF.N;
  const nR = Math.ceil(FW / pitch) + 4;
  const r = L.rng('s04roof' + seed);
  const tone = new Float32Array(nR), p1 = new Float32Array(nR), p2 = new Float32Array(nR);
  const wA = new Float32Array(nR), wF = new Float32Array(nR), wP = new Float32Array(nR), tF = new Float32Array(nR), tP = new Float32Array(nR);
  for (let i = 0; i < nR; i++) {
    tone[i] = 0.92 + 0.16 * r(); p1[i] = r() * 50; p2[i] = r() * 50;
    wA[i] = r.range(0.15, 0.9); wF[i] = r.range(0.02, 0.05); wP[i] = r() * L.TAU; tF[i] = r.range(0.03, 0.09); tP[i] = r() * L.TAU;
  }
  const lapT = lap * 1.25, edgeDark = lit ? 0.66 : 0.78, sd = seed * 1013;
  for (let y = yA; y < yB; y++) {
    const v = (y + 0.5 - ridgeY) * dir + 400;       // distance down the slope (+400 keeps tile indices positive)
    let k = y * FW * 4;
    for (let x = 0; x < FW; x++, k += 4) {
      const r0 = (x / pitch) | 0;
      let u = (x + wA[r0] * Math.sin(v * wF[r0] + wP[r0])) / pitch;
      if (u < 0) u = 0;
      const ri = u | 0, fu = u - ri;
      const cover = fu < SPLIT;
      const vv = cover ? (v + p1[ri]) / lap : (v + p2[ri]) / lapT;
      const ti = vv | 0, fv = vv - ti;
      const hh = h2(ri * 2 + (cover ? 0 : 1) + sd, ti);
      let m = prof[(fu * PN) | 0] * tone[ri] * (0.87 + 0.26 * hh) * (0.94 + 0.1 * fv) * (1 + 0.07 * Math.sin(v * tF[ri] + tP[ri]));
      if (hh > 0.985) m *= 1.25; else if (hh < 0.02) m *= 0.66;
      if (fv < 0.17) m *= edgeDark; else if (lit && fv > 0.83) m *= 1.1;
      m *= gain * xg[x];
      const li = (m >= 1 ? 255 : (m * 255) | 0) * 3;
      const cs = ((hh * 7.31) % 1 - 0.5) * 7;
      d[k] = lut[li] + cs; d[k + 1] = lut[li + 1] + cs * 0.4; d[k + 2] = lut[li + 2] - cs; d[k + 3] = 255;
    }
  }
}

/** per-pixel river-cobble paving */
function paintCobbles(d, FW, hC, lut, xg) {
  const nz = L.makeNoise('s04cobble');
  let k = 0;
  for (let y = 0; y < hC; y++) {
    for (let x = 0; x < FW; x++, k += 4) {
      const c = nz.cell(x / 6.4, y / 5.6);
      let m = (0.24 + 0.76 * L.smooth(c.edge / 0.2)) * (0.72 + 0.4 * c.id) * (1.1 - 0.5 * c.d) * xg[x];
      const li = (m >= 1 ? 255 : (m * 255) | 0) * 3;
      d[k] = lut[li]; d[k + 1] = lut[li + 1]; d[k + 2] = lut[li + 2]; d[k + 3] = 255;
    }
  }
}

function drawRidge(g, FW, yc, seed) {
  const r = L.rng(seed);
  // shadow thrown onto the far (shaded) slope
  g.fillStyle = L.linear(g, 0, yc - 14, 0, yc - 5, [[0, 'rgba(8,6,5,0)'], [1, 'rgba(8,6,5,0.66)']]); g.fillRect(0, yc - 14, FW, 9);
  // ridge of tiles stacked on edge, bedded in lime
  g.fillStyle = L.linear(g, 0, yc - 6, 0, yc + 6, [[0, '#4b423b'], [0.25, '#8f8373'], [0.5, '#cbbfab'], [0.78, '#978a79'], [1, '#3a312b']]);
  g.fillRect(0, yc - 6, FW, 12);
  for (let x = 0; x < FW; x += r.range(2.6, 4.4)) { g.fillStyle = `rgba(22,16,12,${r.range(0.12, 0.5)})`; g.fillRect(x, yc - 6, 1, 12); }
  for (let i = 0; i < FW / 26; i++) {
    const x = r() * FW, w = r.range(5, 30);
    g.fillStyle = r.chance(0.6) ? `rgba(222,214,196,${r.range(0.15, 0.45)})` : `rgba(30,24,20,${r.range(0.2, 0.5)})`;
    g.fillRect(x, yc - 5 + r.range(0, 4), w, r.range(2, 6));
  }
  g.fillStyle = 'rgba(10,7,5,0.5)'; g.fillRect(0, yc + 6, FW, 1.8);
}

/** one storey of the timber gallery in strip space. lvl 4..2 = upper floors with railings, 1 = ground floor */
function drawStorey(g, FW, d0, hS, lvl, seed) {
  const r = L.rng(seed);
  const nB = Math.ceil(FW / BAY) + 1;
  const beamH = lvl > 1 ? 5 : 0;
  const dB = d0 + hS;
  const railT = d0 + hS * 0.5, railB = dB - beamH;
  const shadB = d0 + hS * (lvl > 1 ? 0.34 : 0.4);
  const wallB = lvl > 1 ? railT + 4 : dB - 9;        // how far down the back wall is visible
  // ── back wall, bay by bay
  for (let b = -1; b < nB; b++) {
    const x = b * BAY, tone = r.range(-0.14, 0.1);
    if (lvl > 1) {
      g.fillStyle = L.shade('#96623a', tone); g.fillRect(x, d0, BAY + 1, hS);
      for (let px = x + 3; px < x + BAY; px += r.range(4, 7.5)) { g.fillStyle = `rgba(34,18,8,${r.range(0.12, 0.42)})`; g.fillRect(px, d0, 1, hS); }
      const dx = x + BAY * r.range(0.26, 0.56), dw = 12;
      g.fillStyle = r.chance(0.35) ? '#0d0806' : L.shade('#5a361d', r.range(-0.3, 0.05)); g.fillRect(dx, d0 + 4, dw, hS);
      g.fillStyle = 'rgba(20,10,5,0.7)'; g.fillRect(dx - 1.2, d0 + 3, 1.2, hS); g.fillRect(dx + dw, d0 + 3, 1.2, hS);
      if (r.chance(0.42)) {   // 春联
        g.fillStyle = '#d32a1b'; g.fillRect(dx - 5.4, d0 + 5, 3.2, wallB - d0 - 5); g.fillRect(dx + dw + 2.2, d0 + 5, 3.2, wallB - d0 - 5);
      }
      if (r.chance(0.6)) {    // small lattice window
        const wx = dx + (dx - x > BAY * 0.42 ? -17 : dw + 8);
        g.fillStyle = '#1a0f09'; g.fillRect(wx, d0 + 8, 9, 10);
        g.fillStyle = 'rgba(190,130,80,0.7)'; g.fillRect(wx + 2.6, d0 + 8, 0.9, 10); g.fillRect(wx + 5.6, d0 + 8, 0.9, 10);
      }
    } else {
      // ground floor: earthen plaster wall on a stone footing, kitchen doors with couplets
      g.fillStyle = L.shade('#cfa86f', tone * 0.7); g.fillRect(x, d0, BAY + 1, hS);
      g.fillStyle = L.shade('#a29782', tone); g.fillRect(x, dB - 15, BAY + 1, 6);
      g.fillStyle = L.linear(g, 0, dB - 9, 0, dB, [[0, '#8f8573'], [0.25, '#c4b9a3'], [1, '#b3a892']]); g.fillRect(x, dB - 9, BAY + 1, 9);
      const dx = x + BAY * r.range(0.3, 0.5), dw = 15, dt = d0 + 9;
      g.fillStyle = '#5c3a20'; g.fillRect(dx - 1.5, dt - 1.5, dw + 3, dB - 9 - dt + 1.5);
      g.fillStyle = r.chance(0.55) ? '#0f0906' : '#3b2414'; g.fillRect(dx, dt, dw, dB - 9 - dt);
      if (r.chance(0.5)) { g.fillStyle = '#6a4226'; g.fillRect(dx, dt, dw * 0.45, dB - 9 - dt); }
      if (r.chance(0.6)) {
        g.fillStyle = '#d42a1b'; g.fillRect(dx - 6.2, dt + 1, 3.4, dB - 14 - dt); g.fillRect(dx + dw + 2.8, dt + 1, 3.4, dB - 14 - dt);
        g.fillRect(dx + 1, dt - 6.5, dw - 2, 3.6);
      }
      if (r.chance(0.7)) {
        const wx = dx + (dx - x > BAY * 0.4 ? -20 : dw + 11);
        g.fillStyle = '#20140c'; g.fillRect(wx, dt + 3, 9, 9);
        g.fillStyle = 'rgba(120,80,50,0.9)'; g.fillRect(wx + 2.6, dt + 3, 1, 9); g.fillRect(wx + 5.6, dt + 3, 1, 9);
      }
    }
  }
  // ── shadows of the posts thrown onto the back wall (longer where the sun rakes, on the left)
  for (let b = -1; b < nB; b++) {
    const x = b * BAY, u = L.clamp(x / FW);
    const off = 5 + 17 * (1 - u);
    g.fillStyle = 'rgba(22,11,5,0.42)'; g.fillRect(x + off, d0, 6.5, hS);
  }
  // ── shadow of the floor above
  g.fillStyle = 'rgba(12,7,4,0.78)'; g.fillRect(0, d0, FW, shadB - d0);
  g.fillStyle = L.linear(g, 0, shadB, 0, shadB + 3, [[0, 'rgba(12,7,4,0.78)'], [1, 'rgba(12,7,4,0)']]); g.fillRect(0, shadB, FW, 3);
  // ── railing
  if (lvl > 1) {
    g.fillStyle = '#2a190e'; g.fillRect(0, railT, FW, railB - railT);
    for (let b = -1; b < nB; b++) {
      const x = b * BAY;
      if (r.chance(0.16)) {      // boarded panel instead of balusters
        g.fillStyle = L.shade('#a0663a', r.range(-0.18, 0.08)); g.fillRect(x, railT + 2, BAY, railB - railT - 2);
        for (let px = x + r.range(5, 9); px < x + BAY; px += r.range(6, 10)) { g.fillStyle = 'rgba(30,15,6,0.5)'; g.fillRect(px, railT + 2, 1, railB - railT - 2); }
      } else {
        for (let px = x + 4.5; px < x + BAY - 3; px += 5) {
          g.fillStyle = L.shade('#ad6f40', r.range(-0.2, 0.12)); g.fillRect(px, railT + 2, 2.7, railB - railT - 3);
          g.fillStyle = 'rgba(255,214,160,0.4)'; g.fillRect(px, railT + 2, 0.9, railB - railT - 3);
        }
      }
    }
    g.fillStyle = '#d9a873'; g.fillRect(0, railT, FW, 2.3);
    g.fillStyle = '#5e381f'; g.fillRect(0, railT + 2.3, FW, 1.2);
    g.fillStyle = '#94603a'; g.fillRect(0, railB - 2.6, FW, 2.6);
    // floor-edge beam
    g.fillStyle = L.linear(g, 0, railB, 0, dB, [[0, '#c18a58'], [0.3, '#8a5631'], [1, '#3a2011']]); g.fillRect(0, railB, FW, beamH);
  }
  // ── posts (+ small bracket block under the beam, stone plinth on the ground floor)
  for (let b = -1; b < nB; b++) {
    const x = b * BAY, tone = r.range(-0.1, 0.08), hw = lvl > 1 ? 3.8 : 4.4;
    g.fillStyle = L.linear(g, x - hw, 0, x + hw, 0, [[0, L.shade('#e0a873', tone)], [0.3, L.shade('#b06f3f', tone)], [1, L.shade('#43230e', tone)]]);
    g.fillRect(x - hw, d0, hw * 2, (lvl > 1 ? railB : dB - 6) - d0);
    g.fillStyle = L.shade('#8a5631', tone); g.fillRect(x - 8, d0, 16, 3);
    g.fillStyle = 'rgba(10,6,3,0.55)'; g.fillRect(x - 8, d0 + 3, 16, 1.2);
    if (lvl === 1) {
      g.fillStyle = L.linear(g, x - 6, 0, x + 6, 0, [[0, '#ddd2bc'], [0.5, '#b3a892'], [1, '#6f6656']]); g.fillRect(x - 6, dB - 8, 12, 5);
      g.fillStyle = 'rgba(30,22,14,0.5)'; g.fillRect(x - 5, dB - 3, 26, 2.4);
    }
  }
  // ── red lanterns, one to a bay, hanging from the beam above
  if (lvl > 1) {
    for (let b = -1; b < nB; b++) {
      const x = b * BAY + BAY / 2 + r.range(-1.5, 1.5), y = d0 + 11.5 + r.range(-0.8, 0.8), rx = 5, ry = 5.9;
      g.fillStyle = 'rgba(20,10,6,0.8)'; g.fillRect(x - 0.5, d0 + 2, 1, 5);
      g.fillStyle = L.radial(g, x, y, 0, 15, [[0, 'rgba(255,70,40,0.36)'], [1, 'rgba(255,70,40,0)']]); g.fillRect(x - 15, y - 15, 30, 30);
      g.fillStyle = L.radial(g, x - 1.6, y - 1.8, 0.4, 7.4, [[0, '#ff9a66'], [0.3, '#ee3a24'], [0.75, '#c71f14'], [1, '#7a0f0a']]);
      g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, L.TAU); g.fill();
      g.fillStyle = '#d6a43c'; g.fillRect(x - 2.4, y - ry - 1, 4.8, 1.6); g.fillRect(x - 2.2, y + ry - 0.6, 4.4, 1.5);
      g.fillStyle = '#e0b13f'; g.fillRect(x - 0.6, y + ry + 0.8, 1.2, 4.6);
    }
  }
}

/** the unrolled building strip: FW × (TOPM + DEPTH), x = arc length, y = TOPM + depth */
function buildStrip(env) {
  const a = env.arc, R = a.R;
  const FW = Math.ceil((2 * a.span(PAD + 170) * R) / BAY) * BAY;
  const FH = TOPM + DEPTH;
  // sunlight comes from behind-left of the camera: the right-hand part of the ring faces it squarely, the left is raked
  const sunRoof = new Float32Array(FW), sunShade = new Float32Array(FW), sunWall = new Float32Array(FW);
  for (let x = 0; x < FW; x++) {
    const s = L.smooth(L.remap(x / FW, 0.14, 0.84, 0, 1));
    sunRoof[x] = L.lerp(0.74, 1.1, s); sunShade[x] = L.lerp(0.92, 1.04, s); sunWall[x] = L.lerp(0.8, 1.06, s);
  }
  const litLut = lutOf([[0, '#110c09'], [0.22, '#2f251e'], [0.45, '#594b40'], [0.62, '#786959'], [0.8, '#9d8d7a'], [1, '#c8b9a2']]);
  const shdLut = lutOf([[0, '#0d0a09'], [0.3, '#2a2420'], [0.55, '#443a34'], [0.8, '#5e544d'], [1, '#7a7068']]);
  const cobLut = lutOf([[0, '#4a3b28'], [0.3, '#8b7654'], [0.55, '#c2a678'], [0.8, '#dcc08d'], [1, '#f1dfb8']]);
  const yR = TOPM + D.ridge, yR2 = TOPM + D.ridge2;

  // ── roofs (per pixel)
  const B = L.makeCanvas(FW, FH), bg = B.getContext('2d');
  const img = new ImageData(FW, FH);
  paintRoof(img.data, FW, 0, yR, { ridgeY: yR, dir: -1, lit: false, pitch: ROW, lap: LAP * 0.7, seed: 1, lut: shdLut, gain: 0.88, xg: sunShade });
  paintRoof(img.data, FW, yR, TOPM + D.eave + 8, { ridgeY: yR, dir: 1, lit: true, pitch: ROW, lap: LAP, seed: 2, lut: litLut, gain: 1.0, xg: sunRoof });
  paintRoof(img.data, FW, TOPM + D.ring - 8, yR2, { ridgeY: yR2, dir: -1, lit: false, pitch: ROW2, lap: LAP * 0.7, seed: 3, lut: shdLut, gain: 0.78, xg: sunShade });
  paintRoof(img.data, FW, yR2, FH, { ridgeY: yR2, dir: 1, lit: true, pitch: ROW2, lap: LAP, seed: 4, lut: litLut, gain: 0.96, xg: sunRoof });
  bg.putImageData(img, 0, 0);
  // weathering: big damp blotches, rain streaks down the slope, sagging between purlins, lichen specks, moss by the eaves, repairs
  bg.globalCompositeOperation = 'soft-light'; bg.globalAlpha = 0.45;
  bg.drawImage(L.noiseTex(FW, FH, { seed: 's04w1', scale: 150, sx: 1.6, octaves: 4, res: 0.2, contrast: 1.8, ramp: [[0, '#1c140f'], [0.5, '#80786f'], [1, '#d6cab8']] }), 0, 0);
  bg.globalAlpha = 0.3;
  bg.drawImage(L.noiseTex(FW, FH, { seed: 's04w2', scale: 20, sx: 0.5, sy: 8, octaves: 3, res: 0.4, contrast: 1.6 }), 0, 0);
  bg.globalAlpha = 0.34;
  bg.drawImage(L.noiseTex(FW, FH, { seed: 's04sag', scale: 30, sx: 14, sy: 0.9, octaves: 2, res: 0.3, contrast: 1.5 }), 0, 0);
  bg.globalCompositeOperation = 'source-atop'; bg.globalAlpha = 1;
  L.speckle(bg, { seed: 's04lichen', count: 5200, x: 0, y: 0, w: FW, h: FH, rMin: 0.6, rMax: 3.4, squash: 1.5, colors: ['#b3ab94', '#9d9a86', '#c9c0aa', '#8a8a72'], alpha: [0.08, 0.42] });
  L.speckle(bg, { seed: 's04soot', count: 3200, x: 0, y: 0, w: FW, h: FH, rMin: 0.8, rMax: 4.2, squash: 1.7, colors: ['#0f0b08', '#1c1a10', '#231a12'], alpha: [0.1, 0.45] });
  {
    const moss = L.noiseTex(FW, FH, { seed: 's04moss', scale: 64, sx: 2.2, octaves: 4, res: 0.25, contrast: 1.6,
      ramp: [[0, 'rgba(32,34,18,0)'], [0.45, 'rgba(32,34,18,0.08)'], [1, 'rgba(26,28,14,0.66)']] });
    const mg = moss.getContext('2d'); mg.globalCompositeOperation = 'destination-in';
    const st = (d) => (TOPM + d) / FH;
    mg.fillStyle = L.linear(mg, 0, 0, 0, FH, [[0, 'rgba(0,0,0,0.7)'], [st(26), 'rgba(0,0,0,0.12)'], [st(130), 'rgba(0,0,0,0.08)'], [st(D.eave - 6), 'rgba(0,0,0,0.9)'], [st(D.eave + 10), 'rgba(0,0,0,0.9)'],
      [st(D.ring - 6), 'rgba(0,0,0,0.8)'], [st(D.ring + 30), 'rgba(0,0,0,0.15)'], [1, 'rgba(0,0,0,0.3)']]);
    mg.fillRect(0, 0, FW, FH);
    bg.drawImage(moss, 0, 0);
  }
  {
    const r = L.rng('s04patch');
    bg.globalCompositeOperation = 'soft-light';
    for (let i = 0; i < 40; i++) {
      const x = Math.round(r() * FW / ROW) * ROW, w = r.int(2, 8) * ROW, y = r.chance(0.75) ? TOPM + r.range(D.ridge + 6, D.eave - 20) : TOPM + r.range(D.ridge2 + 4, D.ridge2 + 40), h = r.range(16, 60);
      bg.fillStyle = r.chance(0.5) ? `rgba(225,212,195,${r.range(0.1, 0.26)})` : `rgba(18,12,8,${r.range(0.12, 0.3)})`;
      bg.fillRect(x, y, w, h);
    }
  }
  // the slopes as forms: the sunlit pitch is brightest below the ridge and dulls toward the damp eave; the far pitch falls away dark
  bg.globalCompositeOperation = 'soft-light'; bg.globalAlpha = 1;
  bg.fillStyle = L.linear(bg, 0, yR, 0, TOPM + D.eave, [[0, 'rgba(255,238,210,0.3)'], [0.3, 'rgba(255,238,210,0.12)'], [0.7, 'rgba(20,14,10,0.05)'], [1, 'rgba(20,14,10,0.36)']]);
  bg.fillRect(0, yR, FW, D.eave - D.ridge);
  bg.fillStyle = L.linear(bg, 0, 0, 0, yR, [[0, 'rgba(10,8,8,0.46)'], [0.4, 'rgba(10,8,8,0.16)'], [1, 'rgba(10,8,8,0.06)']]);
  bg.fillRect(0, 0, FW, yR);
  bg.fillStyle = L.linear(bg, 0, TOPM + D.ring, 0, yR2, [[0, 'rgba(10,8,8,0.45)'], [1, 'rgba(10,8,8,0.1)']]);
  bg.fillRect(0, TOPM + D.ring - 8, FW, D.ridge2 - D.ring + 8);
  bg.fillStyle = L.linear(bg, 0, yR2, 0, yR2 + 60, [[0, 'rgba(255,238,210,0.3)'], [1, 'rgba(255,238,210,0.05)']]);
  bg.fillRect(0, yR2, FW, FH - yR2);
  bg.globalCompositeOperation = 'source-over';
  drawRidge(bg, FW, yR, 's04ridge1');
  drawRidge(bg, FW, yR2, 's04ridge2');
  // the sunlit lip of the inner eave, the dark lip of the inner ring's eave
  bg.fillStyle = 'rgba(232,218,196,0.26)'; bg.fillRect(0, TOPM + D.eave - 3.5, FW, 7);
  bg.fillStyle = 'rgba(8,6,4,0.4)'; bg.fillRect(0, TOPM + D.ring - 4, FW, 7);
  // cut the roofs back to their scalloped eave lines (trough tiles poke out a little beyond the cover tiles)
  bg.globalCompositeOperation = 'destination-out'; bg.globalAlpha = 1; bg.fillStyle = '#000';
  bg.beginPath();
  const scal = (x, pitch) => { const fu = x / pitch - Math.floor(x / pitch); return fu < SPLIT ? 0 : 2.2 * Math.sin((Math.PI * (fu - SPLIT)) / (1 - SPLIT)); };
  for (let x = 0; x <= FW; x += 1) { const y = TOPM + D.eave + scal(x, ROW); if (x === 0) bg.moveTo(x, y); else bg.lineTo(x, y); }
  for (let x = FW; x >= 0; x -= 1) bg.lineTo(x, TOPM + D.ring - scal(x, ROW2));
  bg.closePath(); bg.fill();
  bg.globalCompositeOperation = 'source-over';

  // ── everything under the roofs
  const A = L.makeCanvas(FW, FH), g = A.getContext('2d');
  g.fillStyle = '#20140c'; g.fillRect(0, 0, FW, FH);
  // cobbled courtyard
  const hC = D.ring + 14 - D.kerb;
  const cimg = new ImageData(FW, hC);
  paintCobbles(cimg.data, FW, hC, cobLut, sunWall);
  g.putImageData(cimg, 0, TOPM + D.kerb);
  g.translate(0, TOPM);            // from here on y = depth inside the arc
  {
    const r = L.rng('s04yard');
    // damp, mossy patches
    g.save(); g.beginPath(); g.rect(0, D.kerb, FW, hC); g.clip();
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.6;
    g.drawImage(L.noiseTex(FW, hC, { seed: 's04damp', scale: 80, sx: 2.6, octaves: 4, res: 0.4, contrast: 1.7, ramp: [[0, '#8d7f5c'], [0.45, '#e4dac3'], [1, '#ffffff']] }), 0, D.kerb);
    g.restore();
    // granite slab paths crossing the yard on a few axes
    for (const bx of [0.5, 0.18, 0.82, 0.335, 0.665]) {
      const x = Math.round((bx * FW) / BAY) * BAY + BAY / 2 - 11;
      g.fillStyle = 'rgba(40,30,18,0.4)'; g.fillRect(x - 1.2, D.yard, 24.4, D.ring - D.yard);
      for (let y = D.yard + 3; y < D.ring + 10; y += 13) {
        g.fillStyle = L.shade('#cdbb96', r.range(-0.16, 0.06)); g.fillRect(x, y, 22, 12);
        g.fillStyle = 'rgba(255,246,225,0.28)'; g.fillRect(x, y, 22, 1.1);
      }
    }
    // stone well-heads
    for (const wx of [0.5 * FW + 316, 0.5 * FW - 612]) {
      g.fillStyle = 'rgba(30,20,10,0.45)'; g.beginPath(); g.ellipse(wx + 4, 415 - 4, 11.5, 8.5, 0, 0, L.TAU); g.fill();
      g.fillStyle = L.linear(g, wx - 10, 0, wx + 10, 0, [[0, '#cfc3a8'], [0.6, '#a79b82'], [1, '#6f6652']]); g.beginPath(); g.ellipse(wx, 415, 10, 7.6, 0, 0, L.TAU); g.fill();
      g.fillStyle = '#2a2a24'; g.beginPath(); g.ellipse(wx, 415.4, 6, 4.4, 0, 0, L.TAU); g.fill();
      g.fillStyle = 'rgba(150,170,170,0.35)'; g.beginPath(); g.ellipse(wx - 1.5, 416.4, 3, 1.8, 0, 0, L.TAU); g.fill();
    }
    // platform kerb of dressed granite + the drain that runs round the yard
    for (let x = 0; x < FW;) {
      const w = r.range(26, 52);
      g.fillStyle = L.shade('#cdc1a9', r.range(-0.12, 0.08)); g.fillRect(x, D.kerb, w - 1, D.yard - D.kerb - 2.5);
      x += w;
    }
    g.fillStyle = 'rgba(255,248,230,0.4)'; g.fillRect(0, D.kerb, FW, 1.4);
    g.fillStyle = '#6e624e'; g.fillRect(0, D.yard - 2.6, FW, 2.6);
    g.fillStyle = 'rgba(24,18,10,0.7)'; g.fillRect(0, D.yard, FW, 3);
    g.fillStyle = 'rgba(46,52,26,0.4)'; g.fillRect(0, D.yard + 3, FW, 5);
  }
  // the four storeys
  drawStorey(g, FW, D.eave, D.f3 - D.eave, 4, 's04f4');
  drawStorey(g, FW, D.f3, D.f2 - D.f3, 3, 's04f3');
  drawStorey(g, FW, D.f2, D.f1 - D.f2, 2, 's04f2');
  drawStorey(g, FW, D.f1, D.kerb - D.f1, 1, 's04f1');
  // timber: weathering streaks + patchy ageing; then the raking-sun falloff across the ring
  {
    const hG = D.kerb - D.eave;
    g.save(); g.beginPath(); g.rect(0, D.eave, FW, D.f1 - D.eave); g.clip();
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.3;
    g.drawImage(L.noiseTex(FW, hG, { seed: 's04wood', scale: 12, sx: 0.5, sy: 3, octaves: 3, res: 0.5, contrast: 1.6 }), 0, D.eave);
    g.restore();
    g.save(); g.beginPath(); g.rect(0, D.eave, FW, hG); g.clip();
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.5;
    g.drawImage(L.noiseTex(FW, hG, { seed: 's04age', scale: 120, sx: 1.4, octaves: 4, res: 0.25, contrast: 1.6, ramp: [[0, '#6a5646'], [0.5, '#e8dfd2'], [1, '#ffffff']] }), 0, D.eave);
    g.restore();
    g.save(); g.globalCompositeOperation = 'multiply';
    g.fillStyle = L.linear(g, 0, 0, FW, 0, [[0, '#b3b0ae'], [0.14, '#b3b0ae'], [0.5, '#dcd6ce'], [0.84, '#ffffff'], [1, '#ffffff']]);
    g.fillRect(0, D.eave, FW, D.yard + 2 - D.eave);
    g.restore();
    g.save(); g.globalCompositeOperation = 'soft-light';
    g.fillStyle = L.linear(g, 0, 0, FW, 0, [[0, 'rgba(120,140,170,0.25)'], [0.45, 'rgba(255,200,130,0.1)'], [0.8, 'rgba(255,196,120,0.4)'], [1, 'rgba(255,196,120,0.4)']]);
    g.fillRect(0, D.eave, FW, D.ring - D.eave);
    g.restore();
  }
  // cast shadows: the deep eave over the top gallery, and the inner ring over the yard
  g.fillStyle = L.linear(g, 0, D.eave, 0, D.eave + 32, [[0, 'rgba(8,5,3,0.9)'], [0.78, 'rgba(8,5,3,0.74)'], [0.9, 'rgba(8,5,3,0.4)'], [1, 'rgba(8,5,3,0)']]);
  g.fillRect(0, D.eave, FW, 32);
  g.fillStyle = L.linear(g, 0, D.ring - 30, 0, D.ring + 4, [[0, 'rgba(20,14,10,0)'], [0.16, 'rgba(20,14,10,0.55)'], [1, 'rgba(14,10,7,0.72)']]);
  g.fillRect(0, D.ring - 30, FW, 34);
  // roofs on top
  g.drawImage(B, 0, -TOPM);
  // the long morning shadow of the near half of the ring (out of frame): it lies across the yard and climbs the
  // galleries toward the left, where the ring turns away from the sun. Cool skylight fills it.
  g.save();
  g.beginPath(); g.rect(0, D.eave + 4, FW, FH); g.clip();
  g.globalCompositeOperation = 'multiply'; g.filter = 'blur(6px)'; g.fillStyle = '#737b90';
  g.beginPath();
  for (let x = -60; x <= FW + 60; x += 20) {
    const y = 216 + 520 * Math.pow(L.smooth((x / FW - 0.02) / 0.75), 1.25);
    if (x === -60) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.lineTo(FW + 60, FH + 60); g.lineTo(-60, FH + 60); g.closePath(); g.fill();
  g.restore();
  return { strip: A, FW, FH };
}

/** wrap the strip onto the arc (inverse polar mapping, bilinear) → a padded layer */
function wrapStrip(env, strip, FW, FH) {
  const a = env.arc, R = a.R;
  const LW = W + PAD * 2, LH = H + PAD * 2;
  const src = strip.getContext('2d').getImageData(0, 0, FW, FH).data;
  const out = new ImageData(LW, LH), o = out.data;
  const xMax = FW - 1.001, yMax = FH - 1.001, row = FW * 4, half = FW / 2 - 0.5;
  const yStart = Math.max(0, Math.floor(a.crestY - TOPM + PAD) - 1);
  for (let Y = yStart; Y < LH; Y++) {
    const dy = a.cy - (Y - PAD + 0.5), dy2 = dy * dy;
    let k = Y * LW * 4;
    for (let X = 0; X < LW; X++, k += 4) {
      const dx = X - PAD + 0.5 - a.cx;
      let fy = R - Math.sqrt(dx * dx + dy2) + TOPM - 0.5;
      if (fy < 0) continue;
      if (fy > yMax) fy = yMax;
      let fx = Math.atan2(dx, dy) * R + half;
      if (fx < 0) fx = 0; else if (fx > xMax) fx = xMax;
      const x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0;
      const i = y0 * row + x0 * 4, j = i + row;
      const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
      o[k] = src[i] * w00 + src[i + 4] * w10 + src[j] * w01 + src[j + 4] * w11;
      o[k + 1] = src[i + 1] * w00 + src[i + 5] * w10 + src[j + 1] * w01 + src[j + 5] * w11;
      o[k + 2] = src[i + 2] * w00 + src[i + 6] * w10 + src[j + 2] * w01 + src[j + 6] * w11;
      o[k + 3] = 255;
    }
  }
  const c = L.makeCanvas(LW, LH); c._pad = PAD;
  const g = c.getContext('2d');
  g.putImageData(out, 0, 0);
  g.translate(PAD, PAD);
  // crisp outer eave: the arc itself, with the trough tiles' ends poking a couple of px beyond the cover tiles
  const hs = FW / 2 / R;
  g.globalCompositeOperation = 'destination-in';
  g.beginPath();
  for (let x = 0; x <= FW; x += 1.5) {
    const fu = x / ROW - Math.floor(x / ROW);
    const dr = fu < SPLIT ? 0 : 1.3 * Math.sin((Math.PI * (fu - SPLIT)) / (1 - SPLIT));
    const q = a.pt((x - FW / 2) / R, dr);
    if (x === 0) g.moveTo(q.x, q.y); else g.lineTo(q.x, q.y);
  }
  g.lineTo(a.pt(hs, 0).x, H + PAD + 400); g.lineTo(a.pt(-hs, 0).x, H + PAD + 400);
  g.closePath(); g.fill();
  // finishing, only where the building is
  g.globalCompositeOperation = 'source-atop';
  // a breath of haze on the far rim, weight toward the bottom of frame
  g.fillStyle = L.radial(g, a.cx, a.cy, R - 70, R + 4, [[0, 'rgba(214,222,220,0)'], [1, 'rgba(214,222,220,0.16)']]);
  g.fillRect(-PAD, -PAD, LW, LH);
  g.fillStyle = L.radial(g, a.cx, a.cy, R - 640, R - 380, [[0, 'rgba(10,7,5,0.45)'], [1, 'rgba(10,7,5,0)']]);
  g.fillRect(-PAD, -PAD, LW, LH);
  g.globalCompositeOperation = 'source-over';
  return c;
}

/** mist and far hills */
function buildBack(env) {
  const a = env.arc;
  const X = -PAD, Y = -PAD, WW = W + PAD * 2, HH = H + PAD * 2;
  const hill = (g, o) => {
    const c = L.makeLayer(PAD, (q) => {
      const nz = L.makeNoise(o.seed);
      const pts = []; let top = 1e9;
      for (let x = X - 20; x <= W + PAD + 20; x += 5) {
        const y = o.y(x) - o.amp * nz.fbm((x / W) * o.freq + 3.7, 1.3, 4, 2.05, 0.5) - o.fuzz * (2.4 * nz.n2(x * 0.09, 9.1) + 1.2 * nz.n2(x * 0.31, 2.2));
        pts.push([x, y]); if (y < top) top = y;
      }
      q.beginPath(); q.moveTo(pts[0][0], pts[0][1]); for (const p of pts) q.lineTo(p[0], p[1]);
      q.lineTo(W + PAD + 20, H + PAD); q.lineTo(X - 20, H + PAD); q.closePath();
      q.fillStyle = L.linear(q, 0, top, 0, top + o.fade, [[0, L.rgba(o.color, o.alpha)], [0.25, L.rgba(o.color, o.alpha * 0.86)], [0.65, L.rgba(o.color, o.alpha * 0.3)], [1, L.rgba(o.color, 0)]]);
      q.fill();
      q.globalCompositeOperation = 'source-atop'; q.globalAlpha = o.tex;
      q.drawImage(L.noiseLayer(PAD, { seed: o.seed + 't', scale: 70, sx: 1.4, sy: 2.4, octaves: 4, res: 0.2, contrast: 1.7,
        ramp: [[0, L.rgba(L.shade(o.color, -0.28), 0.9)], [0.5, L.rgba(o.color, 0)], [1, 'rgba(240,243,238,0.75)']] }), X, Y);
    });
    g.drawImage(c, X, Y);
  };
  return L.makeLayer(PAD, (g) => {
    g.fillStyle = L.linear(g, 0, -PAD, 0, 900, [[0, '#cbd5d5'], [0.3, '#d8e0dd'], [0.62, '#e4e8e3'], [1, '#edf0ea']]);
    g.fillRect(X, Y, WW, HH);
    g.drawImage(L.noiseLayer(PAD, { seed: 's04sky', scale: 460, sx: 3, sy: 1, octaves: 4, res: 0.15, contrast: 1.4,
      ramp: [[0, 'rgba(180,196,197,0.38)'], [0.5, 'rgba(220,228,225,0)'], [1, 'rgba(252,252,247,0.6)']] }), X, Y);
    const dc = (x) => Math.abs(x - a.cx);
    hill(g, { seed: 's04h1', color: '#c0cbc8', alpha: 0.9, fade: 250, amp: 36, freq: 2.2, tex: 0.3, fuzz: 0.35,
      y: (x) => 262 - 46 * Math.exp(-(((x - 1380) / 540) ** 2)) - 26 * Math.exp(-(((x - 200) / 380) ** 2)) });
    hill(g, { seed: 's04h2', color: '#b3c0bd', alpha: 0.92, fade: 250, amp: 42, freq: 3.0, tex: 0.4, fuzz: 0.6,
      y: (x) => 348 - 62 * Math.exp(-(((x - 420) / 460) ** 2)) - 38 * Math.exp(-(((x - 1820) / 360) ** 2)) });
    // mist lying in the valley
    g.drawImage(L.noiseLayer(PAD, { seed: 's04v1', scale: 150, sx: 5, sy: 1, octaves: 4, res: 0.2, contrast: 1.5,
      ramp: [[0, 'rgba(236,240,235,0)'], [0.45, 'rgba(236,240,235,0.15)'], [1, 'rgba(240,243,238,0.85)']] }), X, Y);
    // nearer wooded spurs coming in from both sides
    hill(g, { seed: 's04h3', color: '#9fb0ad', alpha: 0.9, fade: 280, amp: 34, freq: 3.6, tex: 0.5, fuzz: 1,
      y: (x) => (x < a.cx ? 650 - 250 * L.smooth((dc(x) - 180) / 720) : 650 - 170 * L.smooth((dc(x) - 380) / 640)) });
    // the bright fog bank the building rises out of
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 20, a.R + 330, [[0, 'rgba(240,243,238,0.98)'], [0.3, 'rgba(238,241,236,0.8)'], [0.65, 'rgba(236,240,235,0.3)'], [1, 'rgba(236,240,235,0)']]);
    g.fillRect(X, Y, WW, HH);
  });
}

/** thin mist that drifts in front of the far rim near both ends of the arc */
function buildMist(env) {
  const a = env.arc;
  const c = L.polarNoiseLayer(env, PAD, { seed: 's04mist', scale: 130, sx: 4.5, sy: 1, octaves: 4, res: 0.2, contrast: 1.6,
    ramp: [[0, 'rgba(238,241,236,0)'], [0.42, 'rgba(238,241,236,0)'], [1, 'rgba(240,243,238,0.9)']] });
  const g = c.getContext('2d');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = L.radial(g, a.cx + PAD, a.cy + PAD, a.R - 120, a.R + 230, [[0, 'rgba(0,0,0,0)'], [0.26, 'rgba(0,0,0,0.5)'], [0.42, 'rgba(0,0,0,1)'], [0.6, 'rgba(0,0,0,0.8)'], [1, 'rgba(0,0,0,0)']]);
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = L.linear(g, 0, 0, c.width, 0, [[0, 'rgba(0,0,0,0.75)'], [0.16, 'rgba(0,0,0,0.6)'], [0.36, 'rgba(0,0,0,0)'], [0.68, 'rgba(0,0,0,0)'], [0.86, 'rgba(0,0,0,0.4)'], [1, 'rgba(0,0,0,0.5)']]);
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

export default {
  name: '福建土楼',
  tone: 'dark',
  init(env) {
    const { strip, FW, FH } = buildStrip(env);
    S = { house: wrapStrip(env, strip, FW, FH), back: buildBack(env), mist: buildMist(env) };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.01, 0.01, p), zoom = L.lerp(1.0, 1.035, p);
    L.blit(ctx, env, S.back, { rot: rot * 0.22, zoom: 1 + (zoom - 1) * 0.3 });
    L.blit(ctx, env, S.house, { rot, zoom });
    L.cam(ctx, env, { rot, zoom }, () => {
      // damp tiles catching the low sun: a soft sheen that stays put while the roof slides beneath it
      ctx.save(); a.clipBand(ctx, -D.ridge - 7, -D.eave + 2);
      const q = a.pt(0.13 - rot, -128);
      L.glow(ctx, q.x, q.y, 600, '#ffe2b8', 0.42, 'overlay');
      ctx.restore();
      // the sun pooling in the right-hand galleries and on the yard
      ctx.save(); a.clipBand(ctx, -D.eave - 30, -D.ring + 2);
      const s = a.pt(0.2 - rot, -320);
      L.glow(ctx, s.x, s.y, 560, '#ffc27a', 0.32, 'overlay');
      ctx.restore();
    });
    L.blit(ctx, env, S.mist, { rot: rot * 0.4, zoom: 1 + (zoom - 1) * 0.6, dx: L.lerp(-8, 12, p) });
  },
};
