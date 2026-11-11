// s36 — 石窟火焰纹龛楣. Macro of the flame-pattern lintel (火焰纹龛楣) over a Northern-Wei cave niche: warm moon-white
// sandstone on black, shot close with a shallow depth of field.
// The arc is the outer contour of the lintel — a plain, worn border fillet. Under it only six or seven big flames fit
// across the frame: broad S-curved tongues with a spine and incised contour lines nested inside the outline, their
// drawn-out tips running up to the border and flicking toward the axis of the niche (mirrored left / right). Further
// rows shingle over the first, half a step across, so the band is open at the border and a dense, bright mass below —
// like the barbs of a feather. Nothing above the arc.
// (A carved, formalised pattern band in shallow relief — not realistic fire; no figures, text or dates.)
//
// Everything is a real height field: each tongue is evaluated analytically in polar space (u = arc length, v = depth
// below the arc), composited back-to-front with a V-groove cut round its outline, broken by a few spalls and a crack,
// rounded by weathering, then lit per pixel in init() — a broad lamp from below-left (wrapped diffuse), two-radius
// cavity occlusion, soft swept-horizon shadows — and mapped onto a warm sandstone ramp. A bloom and a three-step
// focus falloff (sharp at the crest, soft toward the sides and the bottom) are baked in; draw() is a single blit.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 64;       // camera margin (the move is only 5 frames long and a few px wide)
const RIM = 21;       // width of the plain border fillet along the outer edge (px)
const RIM_H = 8;      // height of its face
const GROUND = -19;   // the ground between the flames: shallow relief, in half shadow
const SLOPE = 0.08;   // tongues overlap like shingles: every px of depth sits this much prouder
const CARVE = 9;      // width of the V-groove cut around every tongue (px)
const PITCH = 288;    // one flame every PITCH px of arc → six and a half across the frame
const ROWGAP = 172;   // depth between the tip lines of successive rows
const VMAX = 640;     // deepest v that can appear in the padded layer (crest column, bottom edge) + margin
let S = null;

const sstep = (a, b, v) => { const t = L.clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// shared shape tables over x = s / λ (s = distance below the tip of a flame, px)
const LUTN = 1024, LUTX = 8, LS = (LUTN - 1) / LUTX;
const EXL = new Float32Array(LUTN + 2), PWL = new Float32Array(LUTN + 2);
for (let i = 0; i < LUTN + 2; i++) {
  const e = 1 - Math.exp(-Math.min(LUTN - 1, i) / LS);
  EXL[i] = e;                 // how far the body has swung back from under the hooked tip
  PWL[i] = Math.pow(e, 0.9);  // width: a drawn-out point that fills quickly into a full body
}

/** the flames, sorted back → front */
function makeTongues(uMax) {
  const r = L.rng('s36-flames-e');
  const T = [];
  const nRows = Math.ceil((VMAX + 60) / ROWGAP) + 1;
  const n = Math.ceil(uMax / PITCH) + 2;
  for (let k = 0; k < nRows; k++) {
    for (let i = -n; i <= n; i++) {
      const onAxis = i === 0 && k % 2 === 0;                    // the flames on the axis of the niche stand straight
      const hero = onAxis && k === 0;
      // a flame is laid out by its TIP (that is the part that shows); the body swings back from under it
      const uT = (i + (k % 2 ? 0.5 : 0)) * PITCH + (onAxis ? 0 : r.range(-30, 30));
      const size = hero ? 1.04 : r.range(0.86, 1.12);          // no two flames the same size
      const vTip = -6 + k * ROWGAP + (k === 0 ? (hero ? 0 : r.range(-1, 3)) : r.range(-32, 32));
      T.push({
        key: (vTip - RIM) / 150, uT, vTip, len: 640, w0: 110 * size,
        side: onAxis ? 0 : -Math.sign(uT),                       // every other tip hooks over toward the axis
        curl: r.range(128, 172) * size, lam: r.range(92, 124), mu: r.range(118, 146),
        lean: onAxis ? 0 : r.range(-0.03, 0.03), amp: r.range(0.9, 1.1), sw: r.range(50, 59) * (onAxis ? 0.9 : 1),
      });
    }
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

function noiseData(w, h, opts) {
  const c = L.makeCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(L.noiseTex(w, h, opts), 0, 0);
  return g.getImageData(0, 0, w, h).data;
}

function buildStone(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const LW = W + PAD * 2, LH = H + PAD * 2;
  const w = LW, h = LH, N = w * h;

  // ── tongues → typed arrays + a (u,v) bucket grid ──
  const uMax = Math.atan2(W / 2 + PAD, cy - (H + PAD)) * R + 200;
  const T = makeTongues(uMax);
  const nT = T.length;
  const F = () => new Float32Array(nT);
  const tKey = F(), tUT = F(), tVT = F(), tLen = F(), tW = F(), tSide = F(), tC = F(), tIL = F(), tIM = F(), tLean = F(), tAmp = F(), tSw = F();
  T.forEach((t, i) => { tKey[i] = t.key; tUT[i] = t.uT; tVT[i] = t.vTip; tLen[i] = t.len; tW[i] = t.w0; tSide[i] = t.side; tC[i] = t.curl; tIL[i] = LS / t.lam; tIM[i] = LS / t.mu; tLean[i] = t.lean; tAmp[i] = t.amp; tSw[i] = t.sw; });
  const CS = 24, U0 = -(uMax + 420), V0 = -12;
  const GW = Math.ceil((2 * (uMax + 420)) / CS), GH = Math.ceil((VMAX - V0) / CS);
  const cells = Array.from({ length: GW * GH }, () => []);
  for (let i = 0; i < nT; i++) {
    for (let sd = 0; sd <= tLen[i]; sd += 5) {
      const gy = Math.floor((tVT[i] + sd - V0) / CS); if (gy < 0 || gy >= GH) continue;
      const x = tUT[i] - tSide[i] * tC[i] * EXL[Math.min(LUTN - 1, Math.round(sd * tIL[i]))] + tLean[i] * sd;
      const hw = tW[i] * 1.06 * PWL[Math.min(LUTN - 1, Math.round(sd * tIM[i]))] + CARVE + 5;
      const g0 = Math.max(0, Math.floor((x - hw - U0) / CS)), g1 = Math.min(GW - 1, Math.floor((x + hw - U0) / CS));
      for (let gx = g0; gx <= g1; gx++) { const c = cells[gy * GW + gx]; if (c[c.length - 1] !== i) c.push(i); }
    }
  }

  // ── spalls (old breaks) and one crack ──
  const rs = L.rng('s36-spall');
  const SP = [
    // [u, v, ra (along the arc), rb (radial), depth]
    [-655, RIM + 2, 46, 13, 15], [418, RIM - 1, 26, 10, 12], [1065, RIM + 3, 58, 14, 16], [-1180, RIM, 34, 12, 14],
    [-372, 196, 30, 46, 13], [668, 132, 24, 38, 12], [-905, 250, 40, 30, 13], [236, 318, 34, 26, 11], [1240, 210, 36, 44, 13],
  ].map(([u, v, ra, rb, d]) => ({ u, v, ra, rb, d, ph: rs.range(0, 6.28) }));
  const crackU = new Float32Array(VMAX + 16);
  { const nz = L.makeNoise('s36-crack'); for (let i = 0; i < crackU.length; i++) crackU[i] = 792 - 0.42 * i + 26 * nz.fbm(i / 90, 3.7, 3) + 5 * nz.n2(i / 9, 9.1); }

  // ── noise fields (8-bit, read back once) ──
  const nPit = noiseData(w, h, { seed: 's36pit', scale: 13, octaves: 3, gain: 0.6, res: 0.4, contrast: 1.5 });
  const nBig = noiseData(w, h, { seed: 's36big', scale: 320, octaves: 4, warp: 0.7, res: 0.2, contrast: 1.5 });
  const nMid = noiseData(w, h, { seed: 's36mid', scale: 64, octaves: 3, res: 0.25, contrast: 1.4 });
  const gr = L.rng('s36grain');

  // ── 1) height field ──
  const raw = new Float32Array(N).fill(RIM_H), dep = new Float32Array(N), ang = new Float32Array(N);
  for (let sy = 0; sy < h; sy++) {
    const y = sy + 0.5 - PAD, dy = cy - y;
    for (let sx = 0; sx < w; sx++) {
      const i = sy * w + sx;
      const dx = sx + 0.5 - PAD - cx;
      const v = R - Math.sqrt(dx * dx + dy * dy);
      dep[i] = v;
      if (v < -6) continue;
      const u = Math.atan2(dx, dy) * R;
      ang[i] = u;
      const k4 = i * 4;
      const edgeN = 0.965 + 0.07 * (nMid[k4] / 255);    // hand-cut outlines: every edge wanders a little
      let hh = GROUND + SLOPE * (v - RIM);
      const floor = hh;
      const gy = ((v - V0) / CS) | 0, gx = ((u - U0) / CS) | 0;
      if (gx >= 0 && gx < GW && gy >= 0 && gy < GH) {
        const c = cells[gy * GW + gx];
        for (let k = 0; k < c.length; k++) {
          const t = c[k];
          const sd0 = v - tVT[t];
          if (sd0 <= 0 || sd0 >= tLen[t]) continue;
          const tt = sd0 / tLen[t];
          let xa = sd0 * tIL[t]; if (xa > LUTN - 1) xa = LUTN - 1;
          let xb = sd0 * tIM[t]; if (xb > LUTN - 1) xb = LUTN - 1;
          const ia = xa | 0, ib = xb | 0;
          const hw = tW[t] * edgeN * (PWL[ib] + (PWL[ib + 1] - PWL[ib]) * (xb - ib));
          const xc = tUT[t] - tSide[t] * tC[t] * (EXL[ia] + (EXL[ia + 1] - EXL[ia]) * (xa - ia)) + tLean[t] * sd0;
          const ds = u - xc, d = ds < 0 ? -ds : ds;
          if (d >= hw + CARVE) continue;
          // a V-groove follows the outline, cut into whatever lies behind this flame (fades out at tip and root)
          let kc = tt < 0.1 ? tt / 0.1 : 1; if (tt > 0.94) kc *= (1 - tt) / 0.06;
          if (d >= hw) { const g = 1 - (d - hw) / CARVE; hh -= 8 * g * g * kc; if (hh < floor) hh = floor; continue; }
          let under = hh - 8 * kc; if (under < floor) under = floor;
          const q = d / hw;
          // the flame is a sheaf of tongues nested inside its outline: each is a rounded roll that follows the BACK
          // edge and runs out to a point against the belly (on the axis: chevrons nested from both edges)
          const sd = tSide[t], sw = tSw[t];
          let ee, eMax;
          if (sd === 0) { ee = hw - d; eMax = hw; } else { ee = sd * ds + hw; eMax = 2 * hw; }
          ee += (edgeN - 1) * 30; if (ee < 0) ee = 0;
          const js = (ee / sw) | 0, al = ee - js * sw;
          let wj = eMax - js * sw; if (wj < 0) wj = 0;
          if (sd === 0) { wj = wj < sw ? 2 * wj : sw; } else if (wj > sw) wj = sw;
          let fq = wj > 1 ? al / wj : 0; if (fq > 1) fq = 1;
          const full = wj >= sw ? 1 : Math.sqrt(wj / sw);
          const roll = Math.pow(Math.sin(Math.PI * fq), 0.7) * full * (0.82 + 0.36 * (((js * 7 + t * 13) % 5) / 4));
          const tipF = tt < 0.12 ? Math.sqrt(tt / 0.12) : 1;            // the tip thins out
          const body = tAmp[t] * (4 + 8 * (1 - q * q) + 10 * roll) * tipF;
          const own = 6 + SLOPE * (tVT[t] - RIM) + tKey[t] * 1.6 + body;
          const lift = under + 3 + 0.6 * body;                          // it always stands proud of what it overlaps
          const top = own > lift ? own : lift;
          let e = (hw - d) / 5; if (e > 1) e = 1;
          if (tt > 0.94) e *= (1 - tt) / 0.06;
          hh = under + (top - under) * e * (2 - e);
        }
      }
      hh -= SLOPE * (v - RIM);
      // border fillet: flat face, a broad chamfer toward the flames
      if (v < RIM + 12) { const hr = GROUND + (RIM_H - GROUND) * sstep(RIM + 11, RIM - 2, v + (edgeN - 1) * 70); if (hr > hh) hh = hr; }
      // old breaks: shallow conchoidal scars with a rough bed
      for (let s = 0; s < SP.length; s++) {
        const sp = SP[s], du = (u - sp.u) / sp.ra, dv = (v - sp.v) / sp.rb;
        if (du > 1.5 || du < -1.5 || dv > 1.5 || dv < -1.5) continue;
        const f = 1 - du * du - dv * dv + 0.45 * Math.sin(sp.ph + du * 2.3 + dv * 1.7) * Math.cos(sp.ph * 1.7 + dv * 2.9 - du * 1.3) + (nPit[k4] - 128) * 0.004;
        if (f <= 0) continue;
        const bed = Math.max(GROUND + 2, hh - sp.d * Math.sqrt(Math.min(1, f * 1.4))) + (nPit[k4] - 128) * 0.02;
        if (bed < hh) hh += (bed - hh) * sstep(0, 0.16, f);
      }
      // the crack
      if (v >= 0 && v < VMAX) {
        const vi = v | 0, cu = crackU[vi] + (crackU[vi + 1] - crackU[vi]) * (v - vi), dc = Math.abs(u - cu);
        if (dc < 7) hh -= 7 * Math.exp(-dc * dc / 2.6) + 1.6 * (1 - dc / 7);
      }
      raw[i] = hh;
    }
  }

  // ── weathering: every arris is rounded; worn patches lose most of their crispness; then pits and grit ──
  const soft = boxBlur(raw, w, h, 2, 2), worn = boxBlur(raw, w, h, 7, 2);
  const hgt = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    if (dep[i] < -6) { hgt[i] = RIM_H; continue; }
    const k4 = i * 4;
    const wear = sstep(120, 215, 255 - nBig[k4]);
    let hh = soft[i] + (worn[i] - soft[i]) * (0.12 + 0.6 * wear);
    hh += (nPit[k4] - 128) * (hh < GROUND + 5 ? 0.016 : 0.006 + 0.007 * wear) + (gr() - 0.5) * 0.55;
    hgt[i] = hh;
  }

  // ── 2) lighting: a broad lamp from below-left (wrapped diffuse), occlusion at two radii, soft cast shadows ──
  const b1 = worn, b2 = boxBlur(raw, w, h, 24, 2);
  let lx = -0.5, ly = 0.66, lz = 0.5; { const m = Math.hypot(lx, ly, lz); lx /= m; ly /= m; lz /= m; }
  const lm = Math.hypot(lx, ly), sxs = lx / lm, sys = ly / lm, tanE = lz / lm;
  // cast shadows: sweep away from the light carrying the shadow horizon (soft, unlimited range, no banding)
  const hor = new Float32Array(N);
  {
    const kx = sxs / sys, dec = tanE / sys, sh0 = Math.floor(kx), f = kx - sh0;
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
  // warm moon-white sandstone: pale ivory lights, sand mid-tones, umber shadows that never go grey
  const ramp = L.makeRamp([[0, '#030303'], [0.07, '#110c08'], [0.2, '#403124'], [0.42, '#8f7a60'], [0.58, '#b5a388'], [0.8, '#ddd2bd'], [1, '#f2ebdc'], [1.3, '#fffcf4']].map(([t, c]) => [t / 1.3, c]));
  const LN = 1024, lut = new Float32Array(LN * 3);
  for (let i = 0; i < LN; i++) { const c = ramp(i / (LN - 1)); lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2]; }
  const GAIN = 1.2, WRAP = 0.16;
  for (let sy = 1; sy < h - 1; sy++) {
    for (let sx = 1; sx < w - 1; sx++) {
      const i = sy * w + sx, v = dep[i], k4 = i * 4;
      if (v < -3) continue;
      const h0 = hgt[i];
      const gx = (hgt[i + 1 - w] + 2 * hgt[i + 1] + hgt[i + 1 + w] - hgt[i - 1 - w] - 2 * hgt[i - 1] - hgt[i - 1 + w]) * 0.125 * GAIN;
      const gy = (hgt[i + w - 1] + 2 * hgt[i + w] + hgt[i + w + 1] - hgt[i - w - 1] - 2 * hgt[i - w] - hgt[i - w + 1]) * 0.125 * GAIN;
      const inv = 1 / Math.sqrt(gx * gx + gy * gy + 1);
      let d = ((-gx * lx - gy * ly + lz) * inv + WRAP) / (1 + WRAP); if (d < 0) d = 0;
      const ex = hor[i] - h0;
      const sh = 1 - L.clamp(ex / 9) * 0.72;
      const ao1 = L.clamp(1 + (h0 - b1[i]) / 9, 0.4, 1.45), ao2 = L.clamp(1 + (h0 - b2[i]) / 26, 0.4, 1.25);
      let I = (0.11 + 0.15 * inv) * ao1 * ao2 + 0.95 * d * sh * (0.6 + 0.4 * ao2);
      I *= 0.6 + 0.4 * sstep(GROUND + 2, GROUND + 15, h0);   // the cut-back ground sits in half shadow
      // lamp falloff: brightest over the niche, easing off toward the springing of the arch
      const un = ang[i] / 1250;
      I *= 1.08 - 0.26 * un * un - 0.05 * un;
      // a thread of edge light where the slab turns away into the dark
      if (v < 7) I *= 1 + 0.3 * (1 - sstep(0, 7, v));
      // sandstone albedo: broad mottling, grain
      const big = nBig[k4] / 255;
      I *= 0.9 + 0.16 * big + (nPit[k4] - 128) * 0.0006 + (nMid[k4] - 128) * 0.0004;
      const li = (L.clamp(I / 1.3) * (LN - 1)) | 0;
      const warm = (big - 0.5) * 0.07;
      o[k4] = lut[li * 3] * (1 + warm); o[k4 + 1] = lut[li * 3 + 1]; o[k4 + 2] = lut[li * 3 + 2] * (1 - warm * 1.5); o[k4 + 3] = 255;
    }
  }
  const lit = L.makeCanvas(w, h);
  lit.getContext('2d').putImageData(img, 0, 0);

  // ── 3) onto the layer: grain, pores, mineral glints, and an exact silhouette on the arc ──
  const stone = L.makeLayer(PAD, (g) => {
    g.drawImage(lit, -PAD, -PAD);
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.5;
    g.drawImage(L.grainTex(LW, LH, { seed: 's36g', amount: 0.3 }), -PAD, -PAD);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-atop';
    const box = { x: -PAD, y: a.crestY - 10, w: LW, h: H + PAD - a.crestY + 10 };
    L.speckle(g, { seed: 's36sp', count: 3400, ...box, rMin: 0.6, rMax: 2.2, colors: ['#4a3622', '#33261a', '#6b5238'], alpha: [0.1, 0.36] });
    L.speckle(g, { seed: 's36gl', count: 1500, ...box, rMin: 0.5, rMax: 1.3, colors: ['#fffaf0', '#fff3dc'], alpha: [0.12, 0.45] });
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

/** draw `src` into g (layer pixel space) through an elliptical focus mask: opaque inside r < inner, gone at r = 1 */
function focusBlit(g, src, fx, fy, rx, ry, inner) {
  const t = L.makeCanvas(src.width, src.height), tg = t.getContext('2d');
  tg.drawImage(src, 0, 0);
  tg.globalCompositeOperation = 'destination-in';
  tg.translate(fx, fy); tg.scale(rx, ry);
  const gr = tg.createRadialGradient(0, 0, inner, 0, 0, 1);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  tg.fillStyle = gr; tg.fillRect(-50, -50, 100, 100);
  g.drawImage(t, 0, 0);
}

export default {
  name: '石窟火焰纹龛楣',
  tone: 'light',
  init(env) {
    const a = env.arc;
    const stone = buildStone(env);
    const halo = L.blurred(stone, 14), mist = softCopy(stone, 0.25, 46);
    // Everything shares one camera move, so it is flattened into a single opaque layer (one blit per frame):
    // black → wide soft light → bloom spilling a few px over the edge → the stone → a veil of the same bloom on top
    // → the lamp's warm pool over the middle of the band (overlay, so the black stays black).
    const comp = L.makeLayer(PAD, (g) => {
      g.fillStyle = '#030303'; g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
      g.globalCompositeOperation = 'screen';
      g.globalAlpha = 0.16; g.drawImage(mist, -PAD, -PAD);
      g.globalAlpha = 0.5; g.drawImage(halo, -PAD, -PAD);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.drawImage(stone, -PAD, -PAD);
      g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.18; g.drawImage(halo, -PAD, -PAD);
      g.globalAlpha = 1;
      const q = a.pt(-0.012, -200);
      L.glow(g, q.x, q.y, 900, '#fff0d2', 0.16, 'overlay');
    });
    // depth of field: focus on the crest; the band softens toward both sides and toward the bottom of the frame
    const far = softCopy(comp, 0.5, 13), near = L.blurred(comp, 5);
    const out = L.makeCanvas(comp.width, comp.height), og = out.getContext('2d');
    og.drawImage(far, 0, 0);
    const fx = a.cx + PAD, fy = a.crestY + PAD + 80;
    focusBlit(og, near, fx, fy, 1560, 760, 0.5);
    focusBlit(og, comp, fx, fy, 900, 440, 0.4);
    out._pad = PAD;
    S = { comp: out };
  },
  draw(ctx, env, p) {
    // 5 frames: the carving slides a few px along the arc while the camera creeps in
    L.blit(ctx, env, S.comp, { rot: L.lerp(-0.0035, 0.0035, p), zoom: L.lerp(1.0, 1.012, p) });
  },
};
