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
const PAD = 64;      // camera margin (the move is only 5 frames long and a few px wide)
const RES = 1;       // resolution of the height field / lighting pass
const RIM = 9;       // width of the plain fillet along the outer edge (px)
const BAND = 412;    // depth of the flame band below the arc (px)
const MOLD = 20;     // roll moulding that closes the band on the niche side
const GROUND = -26;  // the ground between the flames is cut deep and stays in shadow
const SLOPE = 0.06;   // tongues overlap like shingles: every px of depth sits this much prouder
const CARVE = 6;      // width of the V-groove cut around every tongue (px)
let S = null;

const sstep = (a, b, v) => { const t = L.clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// shared shape tables over τ (0 = root of a tongue, 1 = its tip)
const LUTN = 256;
const SINL = new Float32Array(LUTN + 2), SWL = new Float32Array(LUTN + 2);
for (let i = 0; i < LUTN + 2; i++) {
  const t = Math.min(1, i / (LUTN - 1));
  SINL[i] = Math.sin(Math.PI * t);
  SWL[i] = (Math.pow(1 - t, 1.15) * (0.52 + 2.1 * t)) / 0.757; // flame outline: full lower body, long drawn-out tip
}

/** the flame tongues, sorted back → front */
const ROWGAP = 150;  // nominal depth between the tip lines of successive rows
function makeTongues(uMax) {
  const r = L.rng('s36-flame');
  const T = [];
  const rows = [
    { tip: RIM - 14, pitch: 132, len: 452, w: 31 },   // the tallest tongues run up under the rim
    { tip: RIM + 1 + ROWGAP, pitch: 132, len: 410, w: 31 },
    { tip: RIM + 1 + ROWGAP * 2, pitch: 132, len: 340, w: 30 },
  ];
  // every tip flicks toward the axis of the niche (mirrored left / right); near the axis the tongues straighten up
  const dirOf = (u) => -Math.sign(u) * sstep(8, 230, Math.abs(u));
  rows.forEach((row, k) => {
    const n = Math.ceil(uMax / row.pitch) + 1;
    for (let i = -n; i <= n; i++) {
      const onAxis = i === 0 && k === 0;
      const uc = (i + (k % 2 ? 0.5 : 0)) * row.pitch + (onAxis ? 0 : r.range(-13, 13));
      const cl = row.len * (onAxis ? 1.0 : r.range(0.9, 1.06));
      const drop = k === 0 ? 0 : r.range(-26, 30);   // break up the tip line of the lower rows
      for (const j of [-1, 1, 0]) {
        const aj = Math.abs(j);
        const len = cl * (aj ? r.range(0.52, 0.8) : 1);
        const uB = uc + j * row.pitch * 0.29 + (onAxis ? 0 : r.range(-5, 5));
        const dir = dirOf(uB);
        const vTip = row.tip + drop + (cl - len) * 0.9 + (aj ? r.range(-8, 8) : k === 0 ? r.range(-1, 2) : 0);
        T.push({
          key: (vTip - RIM) / ROWGAP + (aj ? 0.0 : 0.5) + k * 0.25,
          uB, vTip, len, w0: row.w * (aj ? 0.76 : 1) * r.range(0.92, 1.08),
          lean: j * 0.04 + r.range(-0.012, 0.012),
          bow: -dir * r.range(0.085, 0.115), flick: dir * r.range(0.2, 0.27) * (aj ? 1.12 : 1),
          amp: r.range(13, 15.5), ns: aj ? 1 : 2, rip: aj ? 0.2 : 0.23,
        });
      }
    }
  });
  // wisps: thin barbs between the big tongues (more of them up against the rim)
  const nW = Math.round((uMax * 2) / 19);
  for (let i = 0; i < nW; i++) {
    const uB = r.range(-uMax, uMax);
    const vTip = r.chance(0.72) ? r.range(RIM + 3, 140) : r.range(120, BAND - 110);
    const dir = dirOf(uB);
    T.push({
      key: (vTip - RIM) / ROWGAP - 0.3, uB, vTip, len: r.range(200, 330), w0: r.range(7, 13),
      lean: r.range(-0.04, 0.04), bow: -dir * r.range(0.08, 0.12), flick: dir * r.range(0.2, 0.3),
      amp: r.range(8, 10.5), ns: 0, rip: 0,
    });
  }
  T.sort((p, q) => p.key - q.key);
  return T;
}

function boxBlur(src, w, h, r, passes = 2) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), acc = new Float32Array(w);
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
    acc.fill(0);
    for (let k = -r; k <= r; k++) { const o = (k < 0 ? 0 : k >= h ? h - 1 : k) * w; for (let x = 0; x < w; x++) acc[x] += tmp[o + x]; }
    for (let y = 0; y < h; y++) {
      const o = y * w, oa = (y - r < 0 ? 0 : y - r) * w, ob = (y + r + 1 >= h ? h - 1 : y + r + 1) * w;
      for (let x = 0; x < w; x++) { out[o + x] = acc[x] * inv; acc[x] += tmp[ob + x] - tmp[oa + x]; }
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
  const CS = 20, U0 = -(uMax + 260), V0 = -8;
  const GW = Math.ceil((2 * (uMax + 260)) / CS), GH = Math.ceil((BAND + 48 - V0) / CS);
  const cells = Array.from({ length: GW * GH }, () => []);
  for (let i = 0; i < nT; i++) {
    for (let s = 0; s <= 110; s++) {
      const tau = s / 110, v = tVT[i] + (1 - tau) * tLen[i];
      const gy = Math.floor((v - V0) / CS); if (gy < 0 || gy >= GH) continue;
      const x = tUB[i] + tLen[i] * (tLean[i] * tau + tBow[i] * Math.sin(Math.PI * tau) + tFlick[i] * tau * tau * tau);
      const hw = tW[i] * SWL[Math.round(tau * (LUTN - 1))] + CARVE + 3;
      const g0 = Math.max(0, Math.floor((x - hw - U0) / CS)), g1 = Math.min(GW - 1, Math.floor((x + hw - U0) / CS));
      for (let gx = g0; gx <= g1; gx++) { const c = cells[gy * GW + gx]; if (c[c.length - 1] !== i) c.push(i); }
    }
  }

  // ── noise fields (8-bit, read back once) ──
  const nPit = noiseData(w, h, { seed: 's36pit', scale: 11 * RES, octaves: 3, gain: 0.6, res: 0.4, contrast: 1.5 });
  const nBig = noiseData(w, h, { seed: 's36big', scale: 300 * RES, octaves: 4, warp: 0.7, res: 0.2, contrast: 1.5 });
  const nBed = noiseData(w, h, { seed: 's36bed', scale: 34 * RES, sx: 16, sy: 0.5, octaves: 2, res: 0.25, contrast: 1.6 });
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
        hh += SLOPE * (v - RIM);
        const floor = hh;
        const gy = ((v - V0) / CS) | 0, gx = ((u - U0) / CS) | 0;
        if (gx >= 0 && gx < GW && gy >= 0 && gy < GH) {
          const c = cells[gy * GW + gx];
          for (let k = 0; k < c.length; k++) {
            const t = c[k];
            const tt = (v - tVT[t]) / tLen[t];
            if (tt <= 0 || tt >= 1) continue;
            const tau = 1 - tt, fi = tau * (LUTN - 1), i0 = fi | 0, f = fi - i0;
            let hw = tW[t] * (SWL[i0] + (SWL[i0 + 1] - SWL[i0]) * f);
            if (!tRip[t] && tau < 0.3) hw *= tau * (2 - tau / 0.3) / 0.3;   // wisps taper at the root too
            const xc = tUB[t] + tLen[t] * (tLean[t] * tau + tBow[t] * (SINL[i0] + (SINL[i0 + 1] - SINL[i0]) * f) + tFlick[t] * tau * tau * tau);
            const d = Math.abs(u - xc);
            if (d >= hw + CARVE) continue;
            // a V-groove follows the outline, cut into whatever lies behind this tongue (fades out at tip and root)
            let kc = tt < 0.12 ? tt / 0.12 : 1; if (tt > 0.94) kc *= (1 - tt) / 0.06;
            if (d >= hw) { const g = 1 - (d - hw) / CARVE; hh -= 9 * g * g * kc; if (hh < floor) hh = floor; continue; }
            let under = hh - 9 * kc; if (under < floor) under = floor;
            const q = d / hw;
            let p = 0.4 * (1 - q) + 0.6 * (1 - q * q);                   // a clear spine, rounded flanks
            if (tRip[t]) p -= tRip[t] * 0.5 * (1 - Math.cos(TAU * tNs[t] * q)) * (0.35 + 0.65 * q); // incised contour lines
            const tipF = tt < 0.16 ? Math.sqrt(tt / 0.16) : 1;            // the tip thins into the ground
            const own = 7 + SLOPE * (tVT[t] - RIM) + tKey[t] * 2.2 + tAmp[t] * (0.3 + 0.7 * p) * tipF;
            const top = own > under + 2 ? own : under + 2;                // never sink below what it overlaps
            let e = (hw - d) / 3; if (e > 1) e = 1;
            if (tt > 0.94) e *= (1 - tt) / 0.06;
            hh = under + (top - under) * e;
          }
        }
        hh -= SLOPE * (v - RIM);
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
      const wear = sstep(150, 235, 255 - nBig[k4]);
      hh *= 1 - 0.22 * wear;
      hh += (nPit[k4] - 128) * (hh < -14 ? 0.014 : 0.0035 + 0.006 * wear) + (gr() - 0.5) * 0.4 - Math.max(0, nBed[k4] - 160) * 0.0025;
      hgt[i] = hh;
    }
  }

  // ── 2) occlusion (two radii) + cast shadows from the low key light ──
  const b1 = boxBlur(hgt, w, h, Math.round(6.5 * RES), 2), b2 = boxBlur(hgt, w, h, Math.round(21 * RES), 2);
  let lx = -0.32, ly = 0.86, lz = 0.4; { const m = Math.hypot(lx, ly, lz); lx /= m; ly /= m; lz /= m; }
  const lm = Math.hypot(lx, ly), sxs = lx / lm, sys = ly / lm, tanE = lz / lm;
  // cast shadows: sweep away from the light carrying the shadow horizon (soft, unlimited range, no banding)
  const hor = new Float32Array(N);
  {
    const kx = sxs / sys, dec = tanE / sys / RES, sh0 = Math.floor(kx), f = kx - sh0;
    hor.set(hgt.subarray(N - w), N - w);
    for (let y = h - 2; y >= 0; y--) {
      const oy = y * w, ob = oy + w;
      for (let x = 0; x < w; x++) {
        let i0 = x + sh0, i1 = i0 + 1;
        if (i0 < 0) i0 = 0; else if (i0 >= w) i0 = w - 1;
        if (i1 < 0) i1 = 0; else if (i1 >= w) i1 = w - 1;
        const sv = hor[ob + i0] * (1 - f) + hor[ob + i1] * f - dec, hv = hgt[oy + x];
        hor[oy + x] = sv > hv ? sv : hv;
      }
    }
  }
  const img = new ImageData(w, h); const o = img.data;
  const ramp = L.makeRamp([[0, '#030303'], [0.07, '#0f0d0a'], [0.2, '#3a342c'], [0.42, '#897b63'], [0.58, '#a89a84'], [0.8, '#d6cab6'], [1, '#efe6d6'], [1.3, '#fffaf0']].map(([t, c]) => [t / 1.3, c]));
  const LN = 1024, lut = new Float32Array(LN * 3);
  for (let i = 0; i < LN; i++) { const c = ramp(i / (LN - 1)); lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2]; }
  const voidV = BAND + MOLD, GAIN = 1.35;
  for (let sy = 1; sy < h - 1; sy++) {
    for (let sx = 1; sx < w - 1; sx++) {
      const i = sy * w + sx, v = dep[i], k4 = i * 4;
      if (v < -3) continue;
      const h0 = hgt[i];
      const gx = (hgt[i + 1 - w] + 2 * hgt[i + 1] + hgt[i + 1 + w] - hgt[i - 1 - w] - 2 * hgt[i - 1] - hgt[i - 1 + w]) * 0.125 * RES * GAIN;
      const gy = (hgt[i + w - 1] + 2 * hgt[i + w] + hgt[i + w + 1] - hgt[i - w - 1] - 2 * hgt[i - w] - hgt[i - w + 1]) * 0.125 * RES * GAIN;
      const inv = 1 / Math.sqrt(gx * gx + gy * gy + 1);
      let d = (-gx * lx - gy * ly + lz) * inv; if (d < 0) d = 0;
      const ex = hor[i] - h0;
      const sh = 1 - L.clamp(ex / 3.2) * 0.9;
      const ao1 = L.clamp(1 + (h0 - b1[i]) / 6, 0.3, 1.6), ao2 = L.clamp(1 + (h0 - b2[i]) / 18, 0.25, 1.3);
      let I = (0.12 + 0.26 * inv) * ao1 * ao2 + 0.88 * d * sh * (0.55 + 0.45 * ao2);
      if (v < BAND) I *= 0.1 + 0.9 * sstep(-24, -9, h0);   // the deep-cut ground drops into shadow
      else if (v < voidV) I *= 0.74;
      // lamp falloff: brightest over the niche, easing off toward the springing of the arch
      const un = Math.abs(ang[i]) / 1250;
      I *= 1.1 - 0.3 * un * un;
      // the niche: light dies quickly past the moulding
      if (v > voidV - 6) {
        const s2 = (v - (voidV + 46)) / 9;   // the inner roll, lit on its underside
        const line = s2 > -1 && s2 < 1 ? Math.sqrt(1 - s2 * s2) * (0.55 + 0.45 * s2) : 0;
        I = I * (1 - sstep(voidV - 6, voidV + 24, v)) + 0.02 + 0.17 * line;
      }
      // sandstone albedo: mottling, grain, slightly darker bedding seams
      const big = nBig[k4] / 255;
      I *= 0.88 + 0.2 * big + (nPit[k4] - 128) * 0.0007 - Math.max(0, nBed[k4] - 160) * 0.0005;
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
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-atop';
    L.speckle(g, { seed: 's36sp', count: 5200, x: -PAD, y: a.crestY - 10, w: LW, h: H + PAD - a.crestY + 10, rMin: 0.5, rMax: 1.7, colors: ['#3a342c', '#2a251f', '#5a5042'], alpha: [0.1, 0.4] });
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = '#000'; a.pathBelow(g, 0); g.fill();
  });
  return stone;
}

/** heavily blurred copy of a layer, built at reduced resolution (cheap) and returned at layer size */
function softCopy(src, scale, px) {
  const sw = Math.round(src.width * scale), sh = Math.round(src.height * scale);
  const sm = L.makeCanvas(sw, sh), sg = sm.getContext('2d');
  sg.filter = `blur(${px * scale}px)`; sg.drawImage(src, 0, 0, sw, sh);
  const out = L.makeCanvas(src.width, src.height), og = out.getContext('2d');
  og.imageSmoothingEnabled = true; og.imageSmoothingQuality = 'high';
  og.drawImage(sm, 0, 0, out.width, out.height);
  out._pad = src._pad;
  return out;
}

export default {
  name: '石窟火焰纹龛楣',
  tone: 'light',
  init(env) {
    const stone = buildStone(env);
    const halo = L.blurred(stone, 13), mist = softCopy(stone, 0.25, 44);
    // everything shares one camera move, so flatten it into a single opaque layer:
    // black → wide soft light → bloom spilling a few px over the edge → the stone → a veil of the same bloom on top
    const comp = L.makeLayer(PAD, (g) => {
      g.fillStyle = '#030303'; g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
      g.globalCompositeOperation = 'screen';
      g.globalAlpha = 0.2; g.drawImage(mist, -PAD, -PAD);
      g.globalAlpha = 0.55; g.drawImage(halo, -PAD, -PAD);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.drawImage(stone, -PAD, -PAD);
      g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.3; g.drawImage(halo, -PAD, -PAD);
    });
    S = { comp };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.0035, 0.0035, p), zoom = L.lerp(1.0, 1.012, p);
    ctx.fillStyle = '#030303'; ctx.fillRect(0, 0, W, H);
    L.blit(ctx, env, S.comp, { rot, zoom });
    // the lamp breathes: a patch of warmer light drifts along the band (overlay → the black stays black)
    const q = a.pt(L.lerp(-0.07, 0.05, p), -170);
    L.glow(ctx, q.x, q.y, 820, '#fff0d2', 0.2 + 0.05 * Math.sin(p * 7), 'overlay');
  },
};
