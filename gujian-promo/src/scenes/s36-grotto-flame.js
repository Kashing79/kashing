// s36 — 石窟火焰纹龛楣. Detail of the flame-pattern lintel (火焰纹龛楣) over a Northern-Wei cave niche: pale sandstone on black.
// The arc is the outer contour of the lintel (a plain fillet). Under it runs the stylised flame band: rows of slender,
// S-curved tongues with a spine and incised contour lines, streaming outward along the radius and overlapping like the
// barbs of a feather; their tips flick toward the axis of the niche, mirrored left / right. A roll moulding (龛梁)
// closes the band; below it the niche falls into darkness, with one more faint concentric roll. Nothing above the arc.
// (A carved, formalised pattern band — not realistic fire; no figures, text or dates.)
//
// Everything is a real height field: each tongue is evaluated analytically in polar space (u = arc length, v = depth
// below the arc), composited back-to-front with a V-groove cut round its outline, eroded with noise, then lit per pixel
// in init() — normal · low key light from below, two-radius cavity occlusion, swept-horizon cast shadows — and mapped
// onto the sandstone ramp. draw() is a single blit.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 64;      // camera margin (the move is only 5 frames long and a few px wide)
const RES = 0.5;     // resolution of the height field / lighting pass (the forms are big and soft: half res is plenty)
const RIM = 12;      // width of the plain fillet along the outer edge (px)
const BAND = 760;    // depth of the flame band below the arc (px) — pushed in, the moulding is out of frame
const MOLD = 20;     // roll moulding that closes the band on the niche side
const GROUND = -40;  // the ground between the flames is cut deep and stays in shadow
const SLOPE = 0.02;   // tongues overlap like shingles: every px of depth sits this much prouder
const CARVE = 16;     // width of the V-groove cut around every tongue (px)
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

/** the flame tongues, sorted back → front — a macro view: only a handful of big tongues fill the frame */
const ROWGAP = 200;  // nominal depth between the tip lines of successive rows
function makeTongues(uMax) {
  const r = L.rng('s36-flame2');
  const T = [];
  const rows = [
    { tip: RIM - 6, pitch: 340, len: 700, w: 168 },          // the big tongues: tips run up under the rim
    { tip: RIM + ROWGAP, pitch: 340, len: 600, w: 130 },     // a second, lower layer showing in the V between them
  ];
  // every tip flicks toward the axis of the niche (mirrored left / right); near the axis the tongues straighten up
  const dirOf = (u) => -Math.sign(u) * sstep(30, 700, Math.abs(u));
  rows.forEach((row, k) => {
    const n = Math.ceil(uMax / row.pitch) + 1;
    for (let i = -n; i <= n; i++) {
      const onAxis = i === 0 && k === 0;
      const uB = (i + (k % 2 ? 0.5 : 0)) * row.pitch + (onAxis ? 0 : r.range(-26, 26));
      const len = row.len * (onAxis ? 1.0 : r.range(0.92, 1.06));
      const dir = dirOf(uB);
      const vTip = row.tip + (k === 0 ? (onAxis ? -2 : r.range(-2, 10)) : r.range(-40, 40));
      T.push({
        key: k === 0 ? 1 + r.range(0, 0.4) : r.range(0, 0.3),
        uB: uB - dir * len * 0.1, vTip, len, w0: row.w * (onAxis ? 1.04 : r.range(0.9, 1.08)),
        lean: r.range(-0.015, 0.015),
        bow: -dir * r.range(0.07, 0.1), flick: dir * r.range(0.16, 0.22),
        amp: r.range(36, 42), ns: 3, rip: k === 0 ? 0.26 : 0.22,
      });
    }
  });
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

function noiseData(w, h, opts) {
  const c = L.makeCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(L.noiseTex(w, h, opts), 0, 0);
  return g.getImageData(0, 0, w, h).data;
}

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
            const xc = tUB[t] + tLen[t] * (tLean[t] * tau + tBow[t] * (SINL[i0] + (SINL[i0 + 1] - SINL[i0]) * f) + tFlick[t] * tau * tau * tau);
            const d = Math.abs(u - xc);
            if (d >= hw + CARVE) continue;
            // a V-groove follows the outline, cut into whatever lies behind this tongue (fades out at tip and root)
            let kc = tt < 0.12 ? tt / 0.12 : 1; if (tt > 0.94) kc *= (1 - tt) / 0.06;
            if (d >= hw) { const g = 1 - (d - hw) / CARVE; hh -= 16 * g * g * kc; if (hh < floor) hh = floor; continue; }
            let under = hh - 16 * kc; if (under < floor) under = floor;
            const q = d / hw;
            let p = 0.4 * (1 - q) + 0.6 * (1 - q * q);                   // a clear spine, rounded flanks
            p -= tRip[t] * 0.5 * (1 - Math.cos(TAU * tNs[t] * q)) * (0.35 + 0.65 * q); // incised contour lines
            p -= 0.035 * (1 - Math.cos(TAU * 11 * q)) * q;                // fine combed striations, like barbs
            const tipF = tt < 0.12 ? Math.sqrt(tt / 0.12) : 1;            // the tip thins into the ground
            const own = 8 + SLOPE * (tVT[t] - RIM) + tKey[t] * 8 + tAmp[t] * (0.3 + 0.7 * p) * tipF;
            const top = own > under + 2 ? own : under + 2;                // never sink below what it overlaps
            let e = (hw - d) / Math.min(14, 0.25 * hw + 1); if (e > 1) e = 1;
            if (tt > 0.94) e *= (1 - tt) / 0.06;
            hh = under + (top - under) * e;
          }
        }
        hh -= SLOPE * (v - RIM);
        // a groove separates the flames from the moulding
        if (v > BAND - 6) hh += (GROUND - hh) * sstep(BAND - 6, BAND - 2, v);
      }
      // outer fillet: flat face, chamfered toward the flames
      if (v < RIM + 8) { const hr = GROUND + (34 - GROUND) * sstep(RIM + 7, RIM - 2, v); if (hr > hh) hh = hr; }
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
      if (hh > -24) hh *= 1 - 0.15 * wear;
      hh += (nPit[k4] - 128) * (hh < -24 ? 0.02 : 0.006 + 0.01 * wear) + (gr() - 0.5) * 0.3 - Math.max(0, nBed[k4] - 160) * 0.002;
      hgt[i] = hh;
    }
  }

  // ── 2) lighting: occlusion at two radii, a low key light from below (slightly left), cast shadows ──
  const b1 = boxBlur(hgt, w, h, Math.round(14 * RES), 2), b2 = boxBlur(hgt, w, h, Math.round(48 * RES), 2);
  let lx = -0.3, ly = 0.8, lz = 0.62; { const m = Math.hypot(lx, ly, lz); lx /= m; ly /= m; lz /= m; }
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
  const ramp = L.makeRamp([[0, '#030303'], [0.07, '#100d0a'], [0.2, '#352d24'], [0.42, '#857664'], [0.58, '#b3a58f'], [0.8, '#ddd2bf'], [1, '#f3ecdf'], [1.3, '#fffcf4']].map(([t, c]) => [t / 1.3, c]));
  const LN = 1024, lut = new Float32Array(LN * 3);
  for (let i = 0; i < LN; i++) { const c = ramp(i / (LN - 1)); lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2]; }
  const voidV = BAND + MOLD, GAIN = 1.0;
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
      const ao1 = L.clamp(1 + (h0 - b1[i]) / 12, 0.3, 1.5), ao2 = L.clamp(1 + (h0 - b2[i]) / 36, 0.25, 1.3);
      let I = (0.16 + 0.3 * inv) * ao1 * ao2 + 0.8 * d * sh * (0.55 + 0.45 * ao2);
      I += 0.3 * (1 - inv) * sstep(-22, 6, h0) * ao2;        // soft sheen rolling round the flanks: the edges glow
      if (v < BAND) I *= 0.12 + 0.88 * sstep(-38, -16, h0);   // the deep-cut ground drops into shadow
      else if (v < voidV) I *= 0.74;
      // lamp falloff: brightest over the niche, easing off toward the springing of the arch
      const un = Math.abs(ang[i]) / 1400;
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
      const warm = (big - 0.5) * 0.05;
      o[k4] = lut[li * 3] * (1 + warm); o[k4 + 1] = lut[li * 3 + 1]; o[k4 + 2] = lut[li * 3 + 2] * (1 - warm * 1.4); o[k4 + 3] = 255;
    }
  }
  const lit = L.makeCanvas(w, h);
  lit.getContext('2d').putImageData(img, 0, 0);

  // ── 3) onto the layer: grain, pores, and an exact silhouette on the arc ──
  const stone = L.makeLayer(PAD, (g) => {
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(lit, -PAD, -PAD, LW, LH);
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.5;
    g.drawImage(L.grainTex(LW, LH, { seed: 's36g', amount: 0.3 }), -PAD, -PAD);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-atop';
    L.speckle(g, { seed: 's36sp', count: 1800, x: -PAD, y: a.crestY - 10, w: LW, h: H + PAD - a.crestY + 10, rMin: 0.8, rMax: 2.4, colors: ['#352d24', '#241e18', '#5a4f42'], alpha: [0.08, 0.3] });
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
    const a = env.arc;
    const stone = buildStone(env);
    const halo = softCopy(stone, 0.5, 16), mist = softCopy(stone, 0.25, 60);
    // depth of field: focus sits on the tips under the crest; the sides and the bottom of the frame melt away
    const dof = softCopy(stone, 0.4, 14);
    {
      const g = dof.getContext('2d');
      g.globalCompositeOperation = 'destination-in';
      g.save(); g.translate(PAD + a.cx, PAD + a.crestY + 60); g.scale(1, 0.62);
      const m = g.createRadialGradient(0, 0, 0, 0, 0, 1050);
      m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(0.32, 'rgba(0,0,0,0.0)'); m.addColorStop(0.75, 'rgba(0,0,0,0.85)'); m.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = m; g.fillRect(-3000, -3000, 6000, 6000); g.restore();
    }
    // Everything shares one camera move, so it is flattened into a single opaque layer (one blit per frame):
    // black → wide soft light → bloom spilling over the edge → the stone → defocused copy toward the frame edges
    // → a veil of the same bloom on top → the lamp's warm pool over the middle of the band (overlay, so the black stays black).
    const comp = L.makeLayer(PAD, (g) => {
      g.fillStyle = '#030303'; g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
      g.globalCompositeOperation = 'screen';
      g.globalAlpha = 0.25; g.drawImage(mist, -PAD, -PAD);
      g.globalAlpha = 0.6; g.drawImage(halo, -PAD, -PAD);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.drawImage(stone, -PAD, -PAD);
      g.drawImage(dof, -PAD, -PAD);
      g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.32; g.drawImage(halo, -PAD, -PAD);
      g.globalAlpha = 1;
      const q = a.pt(0, -220);
      L.glow(g, q.x, q.y, 900, '#fff0d8', 0.26, 'overlay');
    });
    S = { comp };
  },
  draw(ctx, env, p) {
    // 5 frames: the carving slides a few px along the arc while the camera creeps in
    L.blit(ctx, env, S.comp, { rot: L.lerp(-0.0035, 0.0035, p), zoom: L.lerp(1.0, 1.012, p) });
  },
};
