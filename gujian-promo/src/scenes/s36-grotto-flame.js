// s36 — 石窟火焰纹龛楣. The flame-pattern lintel band (火焰纹龛楣) over a Northern-Wei cave niche, pale sandstone on black.
// The arc is the outer contour of the lintel. Under it a dense field of carved flame tongues streams outward along
// the radius — slender S-curved blades with a sharp spine and incised contour lines, overlapping like the barbs of a
// feather — raked by a soft lamp from below. Below the band: a roll moulding, then the dark of the niche.
//
// Everything is a real height field: each tongue is evaluated analytically in polar (u = arc length, v = depth below
// the arc) space, composited back-to-front, eroded with noise, then lit per pixel in init() (normal · key light,
// two-radius cavity occlusion, marched cast shadows) and mapped onto the sandstone ramp.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 120;     // camera margin (the move is only 5 frames long)
const RES = 0.75;    // resolution of the height field / lighting pass
const RIM = 9;       // width of the plain fillet along the outer edge (px)
const BAND = 412;    // depth of the flame band below the arc (px)
const MOLD = 24;     // roll moulding that closes the band on the niche side
const GROUND = -26;  // the ground between the flames is cut deep and stays in shadow
const SLOPE = 7 / 95; // tongues overlap like shingles: each row sits this much prouder per px of depth
let S = null;

const sstep = (a, b, v) => { const t = L.clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// shared shape tables over τ (0 = root of a tongue, 1 = its tip)
const LUTN = 256;
const SINL = new Float32Array(LUTN + 2), SWL = new Float32Array(LUTN + 2);
for (let i = 0; i < LUTN + 2; i++) {
  const t = Math.min(1, i / (LUTN - 1));
  SINL[i] = Math.sin(Math.PI * t);
  SWL[i] = (Math.pow(1 - t, 0.7) * (0.7 + 1.2 * t)) / 0.826; // blade outline: swelling body, needle tip
}

/** the flame tongues, sorted back → front */
function makeTongues(uMax) {
  const r = L.rng('s36-flame');
  const T = [];
  const rows = [
    { tip: RIM + 5, pitch: 162, len: 346, w: 36 },
    { tip: 126, pitch: 156, len: 318, w: 35 },
    { tip: 242, pitch: 150, len: 280, w: 34 },
    { tip: 352, pitch: 146, len: 210, w: 32 },
  ];
  // every tip flicks toward the axis of the niche (mirrored left / right); the one on the axis stands straight
  const dirOf = (u) => (Math.abs(u) < 14 ? 0 : -Math.sign(u));
  rows.forEach((row, k) => {
    const n = Math.ceil(uMax / row.pitch) + 1;
    for (let i = -n; i <= n; i++) {
      const onAxis = i === 0 && k % 2 === 0;
      const uc = (i + (k % 2 ? 0.5 : 0)) * row.pitch + (onAxis ? 0 : r.range(-10, 10));
      const cl = row.len * (onAxis ? 1.04 : r.range(0.9, 1.08));
      for (const j of [-1, 1, 0]) {
        const aj = Math.abs(j);
        const len = cl * (aj ? r.range(0.66, 0.78) : 1);
        const uB = uc + j * row.pitch * 0.27 + (onAxis ? 0 : r.range(-5, 5));
        const dir = dirOf(uB);
        T.push({
          key: k + 0.5 + 0.12 * (1 - aj) + r.range(-0.02, 0.02),
          uB, vTip: row.tip + (cl - len) * 0.86 + (aj ? r.range(-8, 10) : r.range(-1, 3)) + (onAxis && !aj ? -1 : 0),
          len, w0: row.w * (aj ? 0.8 : 1) * r.range(0.93, 1.07),
          lean: j * 0.05 + r.range(-0.012, 0.012),
          bow: -dir * r.range(0.085, 0.12), flick: dir * r.range(0.2, 0.28) * (aj ? 1.12 : 1),
          amp: r.range(11.5, 13.5), ns: aj ? 1.5 : 2, rip: 0.3,
        });
      }
    }
  });
  // wisps: thin barbs between the big tongues (more of them up against the rim)
  const nW = Math.round((uMax * 2) / 24);
  for (let i = 0; i < nW; i++) {
    const uB = r.range(-uMax, uMax);
    const vTip = r.chance(0.55) ? r.range(RIM + 7, 100) : r.range(70, BAND - 60);
    const dir = r.chance(0.1) ? -dirOf(uB) : dirOf(uB);
    T.push({
      key: (vTip - (RIM + 5)) / 112 + 0.1, uB, vTip, len: r.range(120, 230), w0: r.range(7.5, 13),
      lean: r.range(-0.06, 0.06), bow: -dir * r.range(0.07, 0.13), flick: dir * r.range(0.18, 0.32),
      amp: r.range(7, 9.5), ns: 0, rip: 0,
    });
  }
  T.sort((p, q) => p.key - q.key);
  return T;
}

function boxBlur(src, w, h, r, passes = 2) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  const inv = 1 / (2 * r + 1);
  let a = src;
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      const o = y * w; let s = 0;
      for (let k = -r; k <= r; k++) s += a[o + (k < 0 ? 0 : k >= w ? w - 1 : k)];
      for (let x = 0; x < w; x++) {
        tmp[o + x] = s * inv;
        const xa = x - r, xb = x + r + 1;
        s += a[o + (xb >= w ? w - 1 : xb)] - a[o + (xa < 0 ? 0 : xa)];
      }
    }
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += tmp[(k < 0 ? 0 : k >= h ? h - 1 : k) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = s * inv;
        const ya = y - r, yb = y + r + 1;
        s += tmp[(yb >= h ? h - 1 : yb) * w + x] - tmp[(ya < 0 ? 0 : ya) * w + x];
      }
    }
    a = out;
  }
  return out;
}

const noiseData = (w, h, opts) => L.noiseTex(w, h, opts).getContext('2d').getImageData(0, 0, w, h).data;

function buildStone(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const LW = W + PAD * 2, LH = H + PAD * 2;
  const w = Math.round(LW * RES), h = Math.round(LH * RES), N = w * h;

  // ── tongues → typed arrays + a (u,v) bucket grid ──
  const uMax = Math.atan2(W / 2 + PAD, cy - (H + PAD)) * R + 180;
  const T = makeTongues(uMax);
  const nT = T.length;
  const tKey = new Float32Array(nT), tUB = new Float32Array(nT), tVT = new Float32Array(nT), tLen = new Float32Array(nT), tW = new Float32Array(nT),
    tLean = new Float32Array(nT), tBow = new Float32Array(nT), tFlick = new Float32Array(nT), tAmp = new Float32Array(nT), tNs = new Float32Array(nT), tRip = new Float32Array(nT);
  T.forEach((t, i) => { tKey[i] = t.key; tUB[i] = t.uB; tVT[i] = t.vTip; tLen[i] = t.len; tW[i] = t.w0; tLean[i] = t.lean; tBow[i] = t.bow; tFlick[i] = t.flick; tAmp[i] = t.amp; tNs[i] = t.ns; tRip[i] = t.rip; });
  const CS = 32, U0 = -(uMax + 260), V0 = -8;
  const GW = Math.ceil((2 * (uMax + 260)) / CS), GH = Math.ceil((BAND + 48 - V0) / CS);
  const cells = Array.from({ length: GW * GH }, () => []);
  for (let i = 0; i < nT; i++) {
    for (let s = 0; s <= 110; s++) {
      const tau = s / 110, v = tVT[i] + (1 - tau) * tLen[i];
      const gy = Math.floor((v - V0) / CS); if (gy < 0 || gy >= GH) continue;
      const x = tUB[i] + tLen[i] * (tLean[i] * tau + tBow[i] * Math.sin(Math.PI * tau) + tFlick[i] * tau * tau * tau);
      const hw = tW[i] * SWL[Math.round(tau * (LUTN - 1))] + 4;
      const g0 = Math.max(0, Math.floor((x - hw - U0) / CS)), g1 = Math.min(GW - 1, Math.floor((x + hw - U0) / CS));
      for (let gx = g0; gx <= g1; gx++) { const c = cells[gy * GW + gx]; if (c[c.length - 1] !== i) c.push(i); }
    }
  }

  // ── noise fields (8-bit, read back once) ──
  const nPit = noiseData(w, h, { seed: 's36pit', scale: 8, octaves: 3, gain: 0.6, res: 0.5, contrast: 1.5 });
  const nBig = noiseData(w, h, { seed: 's36big', scale: 230, octaves: 4, warp: 0.7, res: 0.2, contrast: 1.5 });
  const nWear = noiseData(w, h, { seed: 's36wear', scale: 110, octaves: 4, warp: 0.5, res: 0.2, contrast: 1.7 });
  const nBed = noiseData(w, h, { seed: 's36bed', scale: 22, sx: 18, sy: 0.5, octaves: 3, warp: 0.25, res: 0.4, contrast: 1.6 });
  const gr = L.rng('s36grain');

  // ── 1) height field ──
  const hgt = new Float32Array(N), dep = new Float32Array(N), ang = new Float32Array(N);
  const TAU = L.TAU;
  for (let sy = 0; sy < h; sy++) {
    const y = (sy + 0.5) / RES - PAD, dy = cy - y;
    for (let sx = 0; sx < w; sx++) {
      const i = sy * w + sx;
      const dx = (sx + 0.5) / RES - PAD - cx;
      const v = R - Math.sqrt(dx * dx + dy * dy);
      dep[i] = v;
      if (v < -4) continue;
      const u = Math.atan2(dx, dy) * R;
      ang[i] = u;
      let hh = GROUND;
      if (v < BAND + 2) {
        hh += SLOPE * (v - RIM - 5);
        const gy = ((v - V0) / CS) | 0, gx = ((u - U0) / CS) | 0;
        if (gx >= 0 && gx < GW && gy >= 0 && gy < GH) {
          const c = cells[gy * GW + gx];
          for (let k = 0; k < c.length; k++) {
            const t = c[k];
            const tt = (v - tVT[t]) / tLen[t];
            if (tt <= 0 || tt >= 1) continue;
            const tau = 1 - tt, fi = tau * (LUTN - 1), i0 = fi | 0, f = fi - i0;
            const hw = tW[t] * (SWL[i0] + (SWL[i0 + 1] - SWL[i0]) * f);
            const xc = tUB[t] + tLen[t] * (tLean[t] * tau + tBow[t] * (SINL[i0] + (SINL[i0 + 1] - SINL[i0]) * f) + tFlick[t] * tau * tau * tau);
            const d = Math.abs(u - xc);
            if (d >= hw) continue;
            const q = d / hw;
            let p = 0.55 * (1 - q) + 0.45 * (1 - q * q);                 // sharp spine, rounded flanks
            if (tRip[t]) p -= tRip[t] * 0.5 * (1 - Math.cos(TAU * tNs[t] * q)) * (0.35 + 0.65 * q); // incised contour lines
            const tipF = tt < 0.16 ? Math.sqrt(tt / 0.16) : 1;            // the tip thins into the ground
            const own = 7 * tKey[t] * 112 / 95 + tAmp[t] * (0.32 + 0.68 * p) * tipF;
            const top = own > hh + 1.5 ? own : hh + 1.5;                  // never sink below what it overlaps
            let e = (hw - d) / 2.2; if (e > 1) e = 1;
            if (tt > 0.94) e *= (1 - tt) / 0.06;
            hh += (top - hh) * e;
          }
        }
        hh -= SLOPE * (v - RIM - 5);
        // a groove separates the flames from the moulding
        if (v > BAND - 6) hh += (GROUND - hh) * sstep(BAND - 6, BAND - 2, v);
      }
      // outer fillet: flat face, chamfered toward the flames
      if (v < RIM + 5) { const hr = GROUND + (12.5 - GROUND) * sstep(RIM + 4.5, RIM - 1, v); if (hr > hh) hh = hr; }
      // roll moulding, then the reveal falling away into the niche; a second, smaller roll deep inside
      if (v >= BAND - 1) {
        const s = (v - (BAND + MOLD / 2)) / (MOLD / 2);
        if (s < 1) hh = Math.max(hh, -4 + 16 * Math.sqrt(Math.max(0, 1 - s * s)));
        else {
          hh = -4 - (v - BAND - MOLD) * 0.9;
          const s2 = (v - (BAND + MOLD + 46)) / 8;
          if (s2 > -1 && s2 < 1) hh += 9 * Math.sqrt(1 - s2 * s2);
        }
      }
      // weathering: worn patches lose relief; pits, grit and faint horizontal bedding everywhere
      const k4 = i * 4;
      const wear = sstep(150, 235, nWear[k4]);
      hh *= 1 - 0.3 * wear;
      hh += (nPit[k4] - 128) * (0.011 + 0.012 * wear) + (gr() - 0.5) * 0.55 - Math.max(0, nBed[k4] - 160) * 0.009;
      hgt[i] = hh;
    }
  }

  // ── 2) occlusion (two radii) + cast shadows from the low key light ──
  const b1 = boxBlur(hgt, w, h, 3, 2), b2 = boxBlur(hgt, w, h, 15, 2);
  let lx = -0.5, ly = 0.78, lz = 0.4; { const m = Math.hypot(lx, ly, lz); lx /= m; ly /= m; lz /= m; }
  const lm = Math.hypot(lx, ly), sxs = lx / lm, sys = ly / lm, tanE = lz / lm;
  const img = new ImageData(w, h); const o = img.data;
  const ramp = L.makeRamp([[0, '#030303'], [0.07, '#0f0d0a'], [0.2, '#3a342c'], [0.42, '#857864'], [0.58, '#a89a84'], [0.8, '#d6cab6'], [1, '#efe6d6'], [1.3, '#fffaf0']].map(([t, c]) => [t / 1.3, c]));
  const LN = 1024, lut = new Float32Array(LN * 3);
  for (let i = 0; i < LN; i++) { const c = ramp(i / (LN - 1)); lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2]; }
  const voidV = BAND + MOLD;
  for (let sy = 1; sy < h - 1; sy++) {
    for (let sx = 1; sx < w - 1; sx++) {
      const i = sy * w + sx, v = dep[i], k4 = i * 4;
      if (v < -3) continue;
      const h0 = hgt[i];
      const gx = (hgt[i + 1] - hgt[i - 1]) * 0.5 * RES, gy = (hgt[i + w] - hgt[i - w]) * 0.5 * RES;
      const inv = 1 / Math.sqrt(gx * gx + gy * gy + 1);
      let d = (-gx * lx - gy * ly + lz) * inv; if (d < 0) d = 0;
      // cast shadow: march toward the light
      let ex = 0;
      for (let s = 1; s <= 11; s++) {
        const ds = s * 1.7;
        const px = (sx + sxs * ds + 0.5) | 0, py = (sy + sys * ds + 0.5) | 0;
        if (px < 0 || px >= w || py < 0 || py >= h) break;
        const e = hgt[py * w + px] - h0 - (ds / RES) * tanE;
        if (e > ex) ex = e;
      }
      const sh = 1 - L.clamp(ex / 3.2) * 0.9;
      const ao1 = L.clamp(1 + (h0 - b1[i]) / 4.5, 0.3, 1.55), ao2 = L.clamp(1 + (h0 - b2[i]) / 15, 0.22, 1.35);
      let I = (0.12 + 0.3 * inv) * ao1 * ao2 + 0.95 * d * sh * (0.55 + 0.45 * ao2);
      I *= 0.07 + 0.93 * sstep(-24, -2, h0);   // the deep-cut ground drops into shadow
      // lamp falloff: brightest over the niche, easing off toward the springing of the arch
      const un = Math.abs(ang[i]) / 1250;
      I *= 1.1 - 0.3 * un * un;
      // the niche: light dies quickly past the moulding
      if (v > voidV - 6) I *= 0.035 + 0.965 * (1 - sstep(voidV - 6, voidV + 26, v)) + 0.1 * sstep(voidV + 32, voidV + 42, v) * (1 - sstep(voidV + 48, voidV + 60, v));
      // sandstone albedo: mottling, grain, slightly darker bedding seams
      const big = nBig[k4] / 255;
      I *= 0.86 + 0.24 * big + (nPit[k4] - 128) * 0.0011 - Math.max(0, nBed[k4] - 160) * 0.0006;
      const li = (L.clamp(I / 1.3) * (LN - 1)) | 0;
      const warm = (big - 0.5) * 0.09;
      o[k4] = lut[li * 3] * (1 + warm); o[k4 + 1] = lut[li * 3 + 1]; o[k4 + 2] = lut[li * 3 + 2] * (1 - warm * 1.4); o[k4 + 3] = 255;
    }
  }
  const small = L.makeCanvas(w, h);
  small.getContext('2d').putImageData(img, 0, 0);

  // ── 3) up to full resolution, exact silhouette on the arc, full-res grain ──
  const stone = L.makeLayer(PAD, (g) => {
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(small, -PAD, -PAD, LW, LH);
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.5;
    g.drawImage(L.grainTex(LW, LH, { seed: 's36g', amount: 0.3 }), -PAD, -PAD);
    g.globalAlpha = 1; g.globalCompositeOperation = 'destination-in';
    g.fillStyle = '#000'; a.pathBelow(g, 0); g.fill();
  });
  return stone;
}

export default {
  name: '石窟火焰纹龛楣',
  tone: 'light',
  init(env) {
    const stone = buildStone(env);
    S = { stone, halo: L.blurred(stone, 13) };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.0035, 0.0035, p), zoom = L.lerp(1.0, 1.012, p);
    ctx.fillStyle = '#030303'; ctx.fillRect(0, 0, W, H);
    // soft bloom spilling a few px over the edge, then the stone itself, then a veil of the same bloom on top
    L.blit(ctx, env, S.halo, { rot, zoom, alpha: 0.6, blend: 'screen' });
    L.blit(ctx, env, S.stone, { rot, zoom });
    L.blit(ctx, env, S.halo, { rot, zoom, alpha: 0.26, blend: 'screen' });
    // the lamp breathes: a patch of warmer light drifts along the band (overlay → the black stays black)
    const q = a.pt(L.lerp(-0.07, 0.05, p), -170);
    L.glow(ctx, q.x, q.y, 820, '#fff0d2', 0.2 + 0.05 * Math.sin(p * 7), 'overlay');
  },
};
