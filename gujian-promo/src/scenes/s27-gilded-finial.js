// s27 — 鎏金宝顶. Night. The arc is the upper limb of a huge gilded (copper-bodied) roof finial ball, seen from below.
// The gold is alive with glitter: tens of thousands of fine flakes baked on the ball, plus a few thousand live ones
// that flash on and off every frame (seeded by the frame number) — some bloom into four-point star flares.
// Along the limb a fringe of gold dust lifts off into the black; the sky above the crest stays empty for the caption.
//
// Geometry: every point under the arc is mapped onto a real sphere of radius arc.R (Z = how far the surface faces the
// lens, 0 at the limb). We look UP at the ball by TILT, so its horizontal hoops (latitude lines) show as shallow
// arcs that close in on the limb toward the sides, and flakes are squashed toward the limb like on a real ball.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 160;
const LW = W + PAD * 2, LH = H + PAD * 2;
let S = null;

const TILT = L.deg(40), CA = Math.cos(TILT), SA = Math.sin(TILT);
// raised hoops (凸箍): latitude, half-width, relative height
const HOOPS = [
  { lat: L.deg(25.8), hw: L.deg(0.38), amp: 1.0 },
  { lat: L.deg(23.9), hw: L.deg(0.24), amp: 0.55 },
];

// ── brightness model: lit from above/behind → the limb glows, the face turned to us sinks into ochre shadow ──
const IMAX = 1.25;
const BASE = [[0, 0.92], [0.05, 0.88], [0.14, 0.8], [0.26, 0.67], [0.4, 0.49], [0.54, 0.33], [0.68, 0.21], [0.8, 0.14], [1, 0.08]];
// falloff curve as a smoothed lookup table (piecewise-linear stops, then relaxed so no band shows at the knots)
const BASE_LUT = (() => {
  const n = 513; let t = new Float32Array(n);
  for (let q = 0; q < n; q++) {
    const Z = q / (n - 1); let v = BASE[BASE.length - 1][1];
    for (let i = 1; i < BASE.length; i++) if (Z <= BASE[i][0]) { v = L.lerp(BASE[i - 1][1], BASE[i][1], (Z - BASE[i - 1][0]) / (BASE[i][0] - BASE[i - 1][0])); break; }
    t[q] = v;
  }
  for (let pass = 0; pass < 3; pass++) {
    const o = new Float32Array(n);
    for (let q = 0; q < n; q++) { let s = 0, c = 0; for (let d = -14; d <= 14; d++) { const k = Math.min(n - 1, Math.max(0, q + d)); s += t[k]; c++; } o[q] = s / c; }
    t = o;
  }
  return t;
})();
function baseI(Z) { const f = L.clamp(Z) * 512, i = f | 0; return i >= 512 ? BASE_LUT[512] : BASE_LUT[i] + (BASE_LUT[i + 1] - BASE_LUT[i]) * (f - i); }
// along the limb: a broad key-light zone left of the crest + a specular hot spot where the key glances off the limb
const KEY = -0.2;   // where the key light lands (radians from the crest; left of the caption)
const hotAt = (th, Z) => Math.exp(-Math.pow((th - KEY) / 0.17, 2)) * Math.exp(-Z / 0.22);
const azI = (th, Z) => 0.72 + 0.28 * Math.exp(-Math.pow((th - KEY) / 0.42, 2)) + 0.62 * hotAt(th, Z);
// hoop shading at a latitude: hl = ± light on the upper / lower flank, sh = the thin shadow it throws below, hb = height
let hl = 0, sh = 0, hb = 0;
function hoopAt(lat) {
  hl = 0; sh = 0; hb = 0;
  for (const hp of HOOPS) {
    const d = (lat - hp.lat) / hp.hw;
    if (d > -5 && d < 4) {
      const e = Math.exp(-d * d);
      hb += hp.amp * e; hl += hp.amp * d * e;
      const ds = d + 1.9; sh += hp.amp * 0.16 * Math.exp(-ds * ds * 0.8);
    }
  }
}
/** brightness of the ball at sphere coords (Z, theta) — used to light the flakes */
function surfI(Z, th) {
  const Y = Math.sqrt(1 - Z * Z) * Math.cos(th);
  hoopAt(Math.asin(Y * CA - Z * SA));
  return baseI(Z) * azI(th, Z) * (1 - sh) * (1 + 0.6 * hl);
}

// two-tone gold over a copper body: white-hot highlight → pale red-gold → 库金 → ochre gold → the copper showing in the shadows
const GOLD_STOPS = [[0, '#040201'], [0.08, '#1e0906'], [0.18, '#4c160a'], [0.28, '#80330f'], [0.4, '#b56813'], [0.52, '#d99a1c'],
  [0.64, '#ecb93c'], [0.76, '#f5d870'], [0.88, '#fff4c8'], [1, '#fffef4']];
// the glitter lies in drifts: one noise field (in sphere coords) shared by the metal underneath and by every layer of flakes
const NZP = L.makeNoise('s27patch');
const patchAt = (th, Z, R) => 0.62 * NZP.fbm(th * R / 120, Z * R / 120, 3) + 0.38 * NZP.fbm(th * R / 340 + 5.3, Z * R / 340 - 2.1, 2);

/** the smooth gilded ball under the glitter: satin gold, burnishing streaks along the latitudes, mottling, fine grain, hoops */
function buildBase(env) {
  const a = env.arc, R = a.R;
  const res = 0.5, cw = Math.ceil(LW * res), ch = Math.ceil(LH * res), N = cw * ch;
  const nz = L.makeNoise('s27gold');
  const hgt = new Float32Array(N), lum = new Float32Array(N);
  const j0 = Math.max(0, Math.floor((a.crestY - 16 + PAD) * res));
  for (let j = 0; j < ch; j++) {
    const py = (j + 0.5) / res - PAD, Y = (a.cy - py) / R;
    for (let i = 0; i < cw; i++) {
      const k = j * cw + i;
      if (j < j0) { lum[k] = -1; continue; }
      const px = (i + 0.5) / res - PAD, X = (px - a.cx) / R;
      const rr = X * X + Y * Y;
      if (rr > 1.016) { lum[k] = -1; continue; }
      const Z = rr >= 1 ? 0 : Math.sqrt(1 - rr);
      const lat = Math.asin(Y * CA - Z * SA), lon = Math.atan2(X, Z * CA + Y * SA);
      const u = lon * R * 0.92, v = lat * R;
      const fade = L.smooth(Z / 0.24);          // surface detail is too foreshortened to resolve near the limb
      const streak = nz.fbm(u / 560 + 3.1, v / 13, 3);
      const mott = nz.fbm(u / 340 + 9.7, v / 220 - 4.2, 3);
      const grain = nz.fbm(u / 6, v / 6, 2);
      hoopAt(lat);
      hgt[k] = hb * 3.4 + (grain * 1.1 + streak * 0.5) * fade;
      lum[k] = baseI(Z) * azI(Math.atan2(X, Y), Z) * (1 + 0.12 * mott + 0.08 * streak * fade) * (1 - sh);
    }
  }
  const ramp = L.makeRamp(GOLD_STOPS);
  const lut = new Uint8ClampedArray(1024 * 3);
  for (let i = 0; i < 1024; i++) { const c = ramp(i / 1023); lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2]; }
  const img = new ImageData(cw, ch), d = img.data;
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const k = j * cw + i, I0 = lum[k];
    if (I0 < 0) continue;
    const up = j > 0 && lum[k - cw] >= 0 ? hgt[k - cw] : hgt[k], dn = j < ch - 1 && lum[k + cw] >= 0 ? hgt[k + cw] : hgt[k];
    const lf = i > 0 && lum[k - 1] >= 0 ? hgt[k - 1] : hgt[k], rt = i < cw - 1 && lum[k + 1] >= 0 ? hgt[k + 1] : hgt[k];
    // light from above and a little from the left: slopes that climb as we move down-screen face the light
    const I = I0 + ((dn - up) * 0.085 + (rt - lf) * 0.03) * (0.28 + 0.85 * I0);
    const li = (L.clamp(I / IMAX) * 1023) | 0;
    d[k * 4] = lut[li * 3]; d[k * 4 + 1] = lut[li * 3 + 1]; d[k * 4 + 2] = lut[li * 3 + 2]; d[k * 4 + 3] = 255;
  }
  const small = L.makeCanvas(cw, ch);
  small.getContext('2d').putImageData(img, 0, 0);
  return small;
}

/** colour buckets so tens of thousands of flakes need only a handful of fillStyle changes */
const HERO = [0.6, 0.9, 1, 0.72, 0.5, 0.82, 1, 0.78];
const NB = 30;
function bucketColours() {
  const ramp = L.makeRamp(GOLD_STOPS); const out = [];
  for (let i = 0; i < NB; i++) out.push(L.css(ramp(i / (NB - 1))));
  return out;
}
const bucketOf = (I) => Math.round(L.clamp(I / IMAX) * (NB - 1));

/** baked glitter: flakes spread evenly over the SPHERE (uniform in Z and theta), so they crowd and flatten toward the limb */
function paintFlakes(g, env, cols) {
  const a = env.arc, R = a.R, r = L.rng('s27flakes'), nz = L.makeNoise('s27patch');
  const buckets = cols.map(() => []);
  for (let i = 0; i < 150000; i++) {
    const Z = r() * 0.78, th = r.range(-0.8, 0.8);
    const rad = R * Math.sqrt(1 - Z * Z), sn = Math.sin(th), cs = Math.cos(th);
    const x = a.cx + rad * sn, y = a.cy - rad * cs;
    if (x < -PAD - 4 || x > W + PAD + 4 || y > H + PAD + 4) continue;
    const patch = nz.fbm(th * R / 120, Z * R / 120, 3);       // glitter lies in drifts, not an even coat
    if (r() > 0.62 + 0.6 * patch) continue;
    const I0 = surfI(Z, th) * (1 + 0.25 * patch);
    const s = 1.1 + 3.6 * Math.pow(r(), 3.0);
    let If, al;
    if (r() < 0.25) { If = I0 * r.range(0.28, 0.6); al = r.range(0.35, 0.7); }                 // pits between the grains
    else { const k = Math.pow(r(), 2.4); If = L.lerp(I0 * 0.95, 1.22, k * (0.45 + 0.55 * Math.min(1, I0))); al = r.range(0.5, 0.95); }
    buckets[bucketOf(If)].push(x, y, s, Math.max(0.9, s * (0.22 + 0.95 * Z)), sn, cs, al);
  }
  for (let b = 0; b < NB; b++) {
    const q = buckets[b]; g.fillStyle = cols[b];
    for (let i = 0; i < q.length; i += 7) {
      g.globalAlpha = q[i + 6];
      g.setTransform(q[i + 5], q[i + 4], -q[i + 4], q[i + 5], q[i] + PAD, q[i + 1] + PAD);
      g.fillRect(-q[i + 2] / 2, -q[i + 3] / 2, q[i + 2], q[i + 3]);
    }
  }
  g.setTransform(1, 0, 0, 1, PAD, PAD); g.globalAlpha = 1;
}

/** trace a latitude line of the ball (the visible front part) */
function hoopPath(g, a, lat) {
  const cl = Math.cos(lat);
  g.beginPath();
  g.ellipse(a.cx, a.cy - a.R * Math.sin(lat) * CA, a.R * cl, a.R * cl * SA, 0, L.deg(-150), L.deg(-30));
}

function buildBody(env, cols) {
  const a = env.arc;
  const base = buildBase(env);
  return L.makeLayer(PAD, (g) => {
    g.save(); a.clipBelow(g, 0);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(base, -PAD, -PAD, LW, LH);
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.55;
    g.drawImage(L.grainTex(LW, LH, { seed: 's27grain', amount: 0.36 }), -PAD, -PAD);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    paintFlakes(g, env, cols);
    // the hoops catch a thin line of light on their upper shoulder, a hairline of shadow underneath
    for (const hp of HOOPS) {
      g.globalCompositeOperation = 'screen';
      g.strokeStyle = L.linear(g, -PAD, 0, W + PAD, 0, [[0, 'rgba(255,226,150,0.08)'], [0.34, `rgba(255,244,200,${0.44 * hp.amp})`], [0.6, `rgba(255,236,170,${0.24 * hp.amp})`], [1, 'rgba(255,226,150,0.05)']]);
      g.lineWidth = 1.3; hoopPath(g, a, hp.lat + hp.hw * 0.75); g.stroke();
      g.globalCompositeOperation = 'multiply';
      g.strokeStyle = `rgba(60,32,4,${0.35 * hp.amp})`; g.lineWidth = 2; hoopPath(g, a, hp.lat - hp.hw * 1.5); g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
    g.restore();
    // the limb itself: a hairline of white-gold exactly on the arc
    g.save(); a.clipBelow(g, 0);
    g.globalCompositeOperation = 'screen'; g.lineWidth = 3.2;
    g.strokeStyle = L.linear(g, -PAD, 0, W + PAD, 0, [[0, 'rgba(255,226,150,0.5)'], [0.33, 'rgba(255,250,228,0.95)'], [0.6, 'rgba(255,240,190,0.75)'], [1, 'rgba(255,226,150,0.4)']]);
    a.stroke(g, -1.2);
    g.restore();
  });
}

/** the part of the ball that bulges toward the lens (bottom of frame) drops out of focus */
const defocusAt = (Z) => L.smooth((Z - 0.5) / 0.22);
function defocus(env, body) {
  const a = env.arc;
  const soft = L.blurred(body, 4);
  const g = soft.getContext('2d');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = L.radial(g, a.cx + PAD, a.cy + PAD, a.R - 620, a.R - 290, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
  g.fillRect(0, 0, LW, LH);
  const bg = body.getContext('2d');
  bg.save(); bg.setTransform(1, 0, 0, 1, 0, 0); bg.globalAlpha = 1; bg.globalCompositeOperation = 'source-over';
  bg.drawImage(soft, 0, 0);
  bg.restore();
  return body;
}

// ── sprites ──
function dotSprite(size, core, halo) {
  const c = L.makeCanvas(size, size), g = c.getContext('2d'), m = size / 2;
  g.fillStyle = L.radial(g, m, m, 0, m, [[0, L.rgba(core, 1)], [0.2, L.rgba(core, 0.95)], [0.38, L.rgba(halo, 0.5)], [0.68, L.rgba(halo, 0.13)], [1, L.rgba(halo, 0)]]);
  g.fillRect(0, 0, size, size);
  return c;
}
function starSprite(size, core, halo) {
  const c = L.makeCanvas(size, size), g = c.getContext('2d'), m = size / 2;
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = L.radial(g, m, m, 0, m * 0.3, [[0, L.rgba(core, 1)], [0.2, L.rgba(core, 0.9)], [0.45, L.rgba(halo, 0.35)], [1, L.rgba(halo, 0)]]);
  g.fillRect(0, 0, size, size);
  const spike = (ang, len, thick, al) => {
    g.save(); g.translate(m, m); g.rotate(ang); g.scale(1, thick);
    g.fillStyle = L.radial(g, 0, 0, 0, len, [[0, L.rgba(core, al)], [0.25, L.rgba(halo, al * 0.6)], [0.6, L.rgba(halo, al * 0.16)], [1, L.rgba(halo, 0)]]);
    g.beginPath(); g.arc(0, 0, len, 0, L.TAU); g.fill();
    g.restore();
  };
  spike(0, m, 0.028, 1); spike(Math.PI / 2, m, 0.028, 1);
  spike(Math.PI / 4, m * 0.4, 0.05, 0.45); spike(-Math.PI / 4, m * 0.4, 0.05, 0.45);
  return c;
}

/** live flakes: tiny rects grouped by colour, packed as [x, y, w, h, phase, speed, alpha] */
function genLiveFlakes(env, cols) {
  const a = env.arc, R = a.R, r = L.rng('s27live');
  const buckets = cols.map(() => []);
  for (let i = 0; i < 30000; i++) {
    const Z = r() * 0.75, th = r.range(-0.78, 0.78);
    const rad = R * Math.sqrt(1 - Z * Z);
    const x = a.cx + rad * Math.sin(th), y = a.cy - rad * Math.cos(th);
    if (x < -70 || x > W + 70 || y > H + 70) continue;
    const I0 = surfI(Z, th);
    if (r() > 0.22 + 0.85 * I0) continue;                 // sparkle where the light is
    if (r() < 0.9 * defocusAt(Z)) continue;               // out of focus down there: the bokeh takes over
    const s = 1.2 + 2.2 * Math.pow(r(), 2.4);
    const If = L.lerp(I0, 1.25, r.range(0.45, 0.95));
    buckets[bucketOf(If)].push(x, y, s, Math.max(1, s * (0.3 + 0.9 * Z)), r() * L.TAU, r.range(1.0, 2.6), r.range(0.55, 1));
  }
  return buckets.map((q, b) => ({ color: cols[b], d: new Float32Array(q) })).filter((q) => q.d.length);
}

/** live glints with a soft bloom, and the few that flare into four-point stars */
function genGlints(env, spr) {
  const a = env.arc, R = a.R, r = L.rng('s27glint');
  const dots = [], stars = [];
  for (let i = 0; i < 9500; i++) {
    const Z = r() * 0.75, th = r.range(-0.78, 0.78);
    const rad = R * Math.sqrt(1 - Z * Z);
    const x = a.cx + rad * Math.sin(th), y = a.cy - rad * Math.cos(th);
    if (x < -60 || x > W + 60 || y > H + 60) continue;
    const I0 = surfI(Z, th), hot = hotAt(th, Z * 0.6);
    if (r() > 0.13 + 0.7 * I0 + 0.4 * hot) continue;
    const warm = r() > 0.25 + 0.7 * I0;                   // deeper, dimmer gold → amber glints
    const df = defocusAt(Z);
    if (df > 0.25 && r() < df * 0.8) {
      // out-of-focus glints swell into soft discs
      if (r() < 0.55) dots.push({ x, y, s: (12 + 34 * Math.pow(r(), 1.8)) * (0.6 + 0.6 * df), img: spr.bokeh, ph: r() * L.TAU, sp: r.range(0.6, 1.6), k: 2, al: r.range(0.2, 0.7) });
      continue;
    }
    dots.push({ x, y, s: (6 + 26 * Math.pow(r(), 2.6)) * (0.6 + 0.5 * Z / 0.75) * (1 + 1.2 * df) * (1 + 0.4 * hot), img: warm ? spr.dotAmber : spr.dotGold,
      ph: r() * L.TAU, sp: r.range(0.8, 2.3), k: 3, al: r.range(0.55, 1) * (0.55 + 0.45 * Math.min(1, I0)) * (1 - 0.3 * df) });
  }
  for (let i = 0; i < 820; i++) {
    const Z = Math.pow(r(), 1.5) * 0.74, th = r.range(-0.78, 0.78);
    const rad = R * Math.sqrt(1 - Z * Z);
    const x = a.cx + rad * Math.sin(th), y = a.cy - rad * Math.cos(th);
    if (x < -60 || x > W + 60 || y > H + 60) continue;
    const I0 = surfI(Z, th), hot = hotAt(th, Z * 0.6);
    if (r() > 0.4 + 0.35 * I0 + 0.5 * hot) continue;
    const s = (46 + 150 * Math.pow(r(), 2.6)) * (1 + 0.3 * hot);
    // keep flare spikes out of the caption zone above the crest
    if (Math.abs(x - a.cx) < 390 && y - s * 0.5 < a.crestY - 6) continue;
    const warm = r() > 0.35 + 0.6 * I0;
    stars.push({ x, y, s, img: warm ? spr.starAmber : spr.starGold, ph: r() * L.TAU, sp: r.range(0.55, 1.25), k: 4, al: r.range(0.6, 1) * (0.6 + 0.4 * Math.min(1, I0)) });
  }
  return { dots, stars };
}

/** gold dust lifting off the limb + a few motes adrift in the dark (none over the caption) */
function genDust(env, spr) {
  const a = env.arc, r = L.rng('s27dust');
  const out = [];
  const tmax = a.span(70);
  const inZone = (x, y) => x > 585 && x < 1335 && y > 240 && y < a.crestY - 8;
  // 1) the fringe hugging the limb: thin over the crest, fuller toward the sides
  for (let i = 0; i < 5200; i++) {
    const th = r.range(-tmax, tmax);
    const lam = L.lerp(4, 17, L.smooth(Math.abs(th) / 0.34)) * r.range(0.5, 1.5);
    const dr = -lam * Math.log(1 - 0.995 * r()) - 1.5;
    const p = a.pt(th, dr);
    if (inZone(p.x, p.y)) continue;
    const near = Math.exp(-Math.max(0, dr) / 26);
    const glow = r() < 0.07;
    out.push({ x: p.x, y: p.y, s: glow ? r.range(5, 11) : 0.8 + 1.5 * Math.pow(r(), 2), img: glow ? spr.dotGold : null,
      col: r.pick(['#fff3c0', '#f6d577', '#e9b949', '#e9b949', '#c48e2b']), al: r.range(0.35, 1) * (0.35 + 0.65 * near),
      ph: r() * L.TAU, sp: r.range(0.9, 2.4), vx: Math.sin(th) * dr * 0.12 + r.range(-1.5, 1.5), vy: -Math.cos(th) * dr * 0.12 + r.range(-1.5, 0.5) });
  }
  // 2) motes adrift, mostly off to the sides
  for (let i = 0; i < 300; i++) {
    const x = r.range(-60, W + 60), dr = 14 - 115 * Math.log(1 - 0.97 * r());
    const y = a.yAt(x, 0) - dr;
    const side = L.smooth((Math.abs(x - a.cx) - 360) / 420);
    if (r() > 0.1 + 0.9 * side || y < -30 || inZone(x, y)) continue;
    const far = Math.exp(-dr / 170);
    const kind = r();
    const th = a.thetaAtX(x);
    const base = { x, y, ph: r() * L.TAU, sp: r.range(0.7, 1.9), vx: Math.sin(th) * r.range(3, 12) + r.range(-5, 5), vy: -r.range(3, 14) };
    if (kind < 0.3) out.push({ ...base, s: r.range(5, 11), img: spr.dotGold, col: null, al: r.range(0.4, 0.9) * (0.35 + 0.65 * far) });
    else out.push({ ...base, s: 0.9 + 1.6 * Math.pow(r(), 1.6), img: null, col: r.pick(['#fff3c0', '#f6d577', '#e9b949', '#c48e2b']), al: r.range(0.4, 1) * (0.3 + 0.7 * far) });
  }
  return out;
}

export default {
  name: '鎏金宝顶',
  tone: 'light',
  init(env) {
    const cols = bucketColours();
    const spr = {
      dotGold: dotSprite(48, '#fffbe6', '#ffc955'),
      dotAmber: dotSprite(48, '#ffe2a0', '#e8962a'),
      starGold: starSprite(192, '#fffdf2', '#ffd169'),
      starAmber: starSprite(192, '#fff0c4', '#f0a23a'),
      bokeh: (() => {
        const c = L.makeCanvas(64, 64), g = c.getContext('2d');
        g.fillStyle = L.radial(g, 32, 32, 0, 32, [[0, 'rgba(232,150,40,0.5)'], [0.6, 'rgba(236,160,46,0.56)'], [0.8, 'rgba(250,190,84,0.62)'], [0.9, 'rgba(240,170,60,0.3)'], [1, 'rgba(233,160,50,0)']]);
        g.fillRect(0, 0, 64, 64); return c;
      })(),
    };
    const body = defocus(env, L.filtered(buildBody(env, cols), 'saturate(1.1) contrast(1.05)'));
    // photographic bloom: only the brightest gold bleeds, a few px past the limb
    const bw = Math.ceil(LW / 2), bh = Math.ceil(LH / 2);
    const bloom = L.makeCanvas(bw, bh); const bg = bloom.getContext('2d');
    bg.filter = 'brightness(0.8) contrast(2.2) blur(8px)';
    bg.drawImage(body, 0, 0, bw, bh);
    const gl = genGlints(env, spr);
    S = { body, bloom, star: spr.starGold, live: genLiveFlakes(env, cols), dots: gl.dots, stars: gl.stars, dust: genDust(env, spr) };
  },
  draw(ctx, env, p) {
    const a = env.arc, f = env.frame;
    // rot slides the glitter along the limb; the push-in is kept tiny so the limb stays on the shared arc at the frame edges
    const rot = L.lerp(-0.009, 0.009, p), zoom = L.lerp(0.997, 1.005, p);
    ctx.fillStyle = '#030303'; ctx.fillRect(0, 0, W, H);

    L.blit(ctx, env, S.body, { rot, zoom });
    L.cam(ctx, env, { rot, zoom }, () => {
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.45;
      ctx.drawImage(S.bloom, -PAD, -PAD, LW, LH);
      // the flakes that flash this frame
      ctx.globalCompositeOperation = 'lighter';
      for (const B of S.live) {
        ctx.fillStyle = B.color; const d = B.d;
        for (let i = 0; i < d.length; i += 7) {
          let t = Math.cos(d[i + 4] + d[i + 5] * f);
          if (t < 0.3) continue;
          t = t * t * t;
          ctx.globalAlpha = t * d[i + 6];
          ctx.fillRect(d[i] - d[i + 2] / 2, d[i + 1] - d[i + 3] / 2, d[i + 2], d[i + 3]);
        }
      }
      const sprites = (arr) => {
        for (const q of arr) {
          let t = Math.cos(q.ph + q.sp * f);
          if (t < 0.12) continue;
          t = Math.pow(t, q.k);
          const s = q.s * (0.7 + 0.3 * t);
          ctx.globalAlpha = Math.min(1, t * q.al * 1.35);
          ctx.drawImage(q.img, q.x - s / 2, q.y - s / 2, s, s);
        }
      };
      sprites(S.dots);
      sprites(S.stars);
      // one hero glint where the key light glances off the limb (left of the caption), pulsing frame by frame
      const hk = HERO[f % HERO.length], hp = a.pt(KEY - 0.03, -3), hs = 290 * (0.78 + 0.22 * hk);
      ctx.globalAlpha = hk;
      ctx.drawImage(S.star, hp.x - hs / 2, hp.y - hs / 2, hs, hs);
      ctx.globalAlpha = 1;
      L.glow(ctx, hp.x, hp.y, 70, '#ffe7a8', 0.5 * hk, 'lighter');
    });
    // key light sweeping along the limb
    ctx.save(); a.clipBelow(ctx, 0);
    const gl = a.pt(KEY + L.lerp(-0.07, 0.07, p), -34);
    L.glow(ctx, gl.x, gl.y, 440, '#ffdc92', 0.3);
    ctx.restore();
    // gold dust lifting off the limb
    L.cam(ctx, env, { rot: rot * 0.8, zoom }, () => {
      ctx.globalCompositeOperation = 'lighter';
      for (const q of S.dust) {
        const t = 0.4 + 0.6 * Math.max(0, Math.cos(q.ph + q.sp * f));
        const x = q.x + q.vx * p, y = q.y + q.vy * p;
        ctx.globalAlpha = Math.min(1, q.al * t);
        if (q.img) ctx.drawImage(q.img, x - q.s / 2, y - q.s / 2, q.s, q.s);
        else { ctx.fillStyle = q.col; ctx.fillRect(x - q.s / 2, y - q.s / 2, q.s, q.s); }
      }
    });
    L.vignette(ctx, { strength: 0.3 });
  },
};
