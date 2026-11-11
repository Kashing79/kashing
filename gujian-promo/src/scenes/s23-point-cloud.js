// s23 — 红外热成像. An infrared survey of a timber hall, shot close: the eave of a round hall in false colour.
// The whole frame is one soft, saturated thermal image (no black, no dots, no HUD):
//   above the arc — the hall's façade: a chartreuse field broken by soft vertical bands (columns and lattice
//                  mullions hold heat differently), with a row of cool, dark bracket blocks (斗拱) sitting on the eave;
//   the arc       — the eave edge itself, a hot magenta-red band right under the brackets;
//   below the arc — the roof: concentric magenta / orange / yellow / violet bands, one per tile course.
// A scalar "temperature" field is built on a coarse polar grid, edge-sharpened the way thermal cameras do
// (which throws the green halos around every warm/cool edge), mapped through a false-colour ramp, then softened.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 120;
const RES = 0.4;   // field resolution (fraction of full res); the image is soft anyway

// false-colour ramp: violet → magenta → red → orange → yellow → chartreuse → green → cool grey-teal
const RAMP = L.makeRamp([
  [0.00, '#3a0b4c'], [0.12, '#651168'], [0.24, '#a3167a'], [0.34, '#dc2070'], [0.44, '#f4455c'],
  [0.54, '#ff7a3c'], [0.64, '#ffaa3a'], [0.74, '#f8da4a'], [0.83, '#d9ef4a'], [0.91, '#a6e65a'], [1.00, '#86bfae'],
]);
let S = null;

/** separable box blur on a Float32Array (w×h), radius r, two passes ≈ tent */
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  const pass = (a, b, horiz) => {
    const n = horiz ? w : h, m = horiz ? h : w;
    for (let j = 0; j < m; j++) {
      let acc = 0;
      const idx = (i) => (horiz ? j * w + Math.min(n - 1, Math.max(0, i)) : Math.min(n - 1, Math.max(0, i)) * w + j);
      for (let i = -r; i <= r; i++) acc += a[idx(i)];
      for (let i = 0; i < n; i++) {
        b[horiz ? j * w + i : i * w + j] = acc / (2 * r + 1);
        acc += a[idx(i + r + 1)] - a[idx(i - r)];
      }
    }
  };
  pass(src, tmp, true); pass(tmp, out, false);
  pass(out, tmp, true); pass(tmp, out, false);
  return out;
}

function buildThermal(env) {
  const a = env.arc, R = a.R;
  const FW = W + PAD * 2, FH = H + PAD * 2;
  const cw = Math.round(FW * RES), ch = Math.round(FH * RES);
  const nz = L.makeNoise('s23therm');
  const r = L.rng('s23therm');

  // ── columns above the arc (screen-vertical bands). amp < 0 → warmer (toward orange / magenta), > 0 → cooler (teal)
  const cols = [];
  for (let x = -PAD - 40; x < W + PAD + 60;) {
    const w = r.range(12, 40);
    const kind = r();
    const amp = kind < 0.2 ? r.range(0.08, 0.15) : kind < 0.55 ? -r.range(0.14, 0.24) : -r.range(0.4, 0.58);
    cols.push({ x, w, amp, seed: r.range(0, 100) });
    x += w + r.range(28, 96);
  }
  // per-row modulation of every column (each one fades in and out along its height)
  const colMod = cols.map((c) => {
    const m = new Float32Array(ch);
    for (let j = 0; j < ch; j++) { const y = j / RES - PAD; m[j] = L.clamp(0.62 + 0.55 * nz.fbm(c.seed, y / 520, 2)); }
    return m;
  });

  // ── bracket blocks on the eave: irregular spacing, size and temperature
  const teeth = [];
  const SP = a.span(PAD + 80) * R;
  for (let s = -SP + r.range(0, 60); s < SP;) {
    const cen = L.smooth((Math.abs(s) - 120) / 420);   // shorter under the tagline
    teeth.push({ s, w: r.range(40, 56), h: r.range(84, 112) * L.lerp(0.55, 1, cen), v: r.range(0.27, 0.34), lean: r.range(-0.1, 0.1), sq: r.range(2.2, 3.2) });
    s += r.range(150, 215);
  }

  const F = new Float32Array(cw * ch);
  for (let j = 0; j < ch; j++) {
    const y = j / RES - PAD;
    for (let i = 0; i < cw; i++) {
      const x = i / RES - PAD;
      const dx = x - a.cx, dy = a.cy - y;
      const rr = Math.hypot(dx, dy);
      const dr = rr - R;                      // > 0 above the arc
      const s = Math.atan2(dx, dy) * R;       // arc length from the crest
      let v;
      if (dr > 0) {
        // façade: chartreuse with slow, vertically streaked mottling
        v = 0.8 + 0.07 * nz.fbm(x / 260, y / 900, 3) + 0.04 * nz.fbm(x / 60 + 7, y / 700, 2);
        // the band behind the tagline stays calm and even
        const quiet = L.smooth((400 - Math.abs(x - W / 2)) / 150) * L.smooth((dr - 40) / 90);
        let cs = 0;
        for (let k = 0; k < cols.length; k++) {
          const c = cols[k], u = (x - c.x) / c.w;
          if (u < -2.6 || u > 2.6) continue;
          const uw = u + 0.35 * nz.n2(c.seed + 40, y / 300);
          cs += c.amp * colMod[k][j] * Math.exp(-uw * uw * uw * uw * 0.5);
        }
        v += cs * (1 - 0.72 * quiet);
        v = L.lerp(v, 0.82 + 0.02 * nz.fbm(x / 400 + 3, y / 400, 2), quiet * 0.6);
        // a warm breath rising off the eave
        v -= 0.16 * Math.exp(-dr / 26);
      } else {
        const d = -dr;
        // eave: hot magenta-red band, slightly ragged lower edge
        const wob = 30 * nz.fbm(s / 900 + 11, d / 400, 2) + 8 * nz.fbm(s / 160, d / 90 + 2, 2);
        const de = d + wob;
        const eave = 0.33 + 0.05 * nz.fbm(s / 120, d / 60 + 4, 2);
        // roof tile courses: concentric bands, widening downward, broken along the arc
        const ph = (de - 92) / L.lerp(124, 180, L.clamp(d / 700));
        const amp = 0.28 + 0.1 * nz.fbm(s / 700 + 9, d / 300, 2);
        const sw = Math.sin(ph * L.TAU - 1.1);
        const sw2 = sw + 0.3 * Math.sin(ph * L.TAU * 2 + 0.6);
        const band = 0.31 + amp * (1.75 * Math.pow(Math.max(0, sw2), 1.6) - 0.6 * Math.pow(Math.max(0, -sw2), 1.3)) + 0.06 * nz.fbm(s / 260 - 5, d / 110, 3);
        const t = L.smooth((de - 74) / 44);
        v = L.lerp(eave, band, t);
        v -= 0.05 * L.smooth((d - 420) / 500);
      }
      // bracket blocks straddle the arc (sit on the eave, their feet melt into it)
      if (dr > -40 && dr < 90) {
        for (let k = 0; k < teeth.length; k++) {
          const q = teeth[k], u = s - q.s - q.lean * dr;
          if (u < -80 || u > 80) continue;
          const hu = (dr + 34) / q.h;
          if (hu < -0.2 || hu > 1.4) continue;
          const e = Math.pow(Math.abs(u) / q.w, q.sq) + Math.pow(Math.abs(hu - 0.5) * 2, q.sq) + 0.12 * nz.n2(u / 30 + k, dr / 30);
          const m = L.smooth((1.25 - e) / 0.6);
          if (m > 0) v = L.lerp(v, q.v - 0.07 * L.smooth((0.9 - e) / 0.6), m);
        }
      }
      F[j * cw + i] = v;
    }
  }
  // thermal-camera edge enhancement: overshoot on both sides of every edge (green halos on the warm side)
  const B = boxBlur(F, cw, ch, 4);
  const lut = new Uint8ClampedArray(1024 * 3);
  for (let i = 0; i < 1024; i++) { const c = RAMP(i / 1023); lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2]; }
  const img = new ImageData(cw, ch), dd = img.data;
  for (let k = 0; k < F.length; k++) {
    const v = L.clamp(F[k] + 0.85 * (F[k] - B[k]));
    const li = ((v * 1023) | 0) * 3;
    dd[k * 4] = lut[li]; dd[k * 4 + 1] = lut[li + 1]; dd[k * 4 + 2] = lut[li + 2]; dd[k * 4 + 3] = 255;
  }
  const small = L.makeCanvas(cw, ch);
  small.getContext('2d').putImageData(img, 0, 0);
  const big = L.makeCanvas(FW, FH);
  const g = big.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.filter = 'blur(3px)';
  g.drawImage(small, 0, 0, FW, FH);
  g.filter = 'none';
  // depth of field: sharpest on the eave near the crest, melting toward the bottom and the far sides
  const soft = L.blurred(big, 11);
  const mask = L.makeCanvas(FW, FH), mg = mask.getContext('2d');
  mg.drawImage(soft, 0, 0);
  mg.globalCompositeOperation = 'destination-out';
  const fx = a.cx + PAD, fy = a.crestY + PAD + 40;
  mg.setTransform(1.9, 0, 0, 1, fx * (1 - 1.9), 0);
  mg.fillStyle = L.radial(mg, fx, fy, 120, 560, [[0, 'rgba(0,0,0,1)'], [0.55, 'rgba(0,0,0,0.6)'], [1, 'rgba(0,0,0,0)']]);
  mg.fillRect(-FW, -FH, FW * 3, FH * 3);
  g.drawImage(mask, 0, 0);
  big._pad = PAD;
  return big;
}

export default {
  name: '红外热成像',
  tone: 'dark',
  init(env) {
    S = { therm: buildThermal(env), grain: L.grainTex(W, H, { seed: 23, amount: 0.5, size: 2 }) };
  },
  draw(ctx, env, p) {
    const rot = L.lerp(-0.009, 0.009, p), zoom = L.lerp(1.0, 1.02, p);
    ctx.fillStyle = '#d9ef4a'; ctx.fillRect(0, 0, W, H);
    L.blit(ctx, env, S.therm, { rot, zoom });
    // sensor noise, a little
    ctx.save();
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.18;
    ctx.drawImage(S.grain, Math.round(-8 * p) % 2, 0);
    ctx.restore();
    L.vignette(ctx, { strength: 0.12, inner: 0.6, outer: 1.15 });
  },
};
