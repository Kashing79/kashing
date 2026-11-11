// s05 — 红墙黄瓦. Six frames of pure colour collision: flat turquoise sky / a yellow-glazed wall cap (墙帽) on the arc /
// a hair-thin green glazed moulding in the eave's shadow / sunlit vermilion palace-wall plaster filling everything below.
// The arc is the scalloped skyline of the cap: a row of small tube-tile humps (+HUMP / −TROUGH px about the arc), rimmed in
// pale gold against a single flat teal so that it is the strongest edge in the frame.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 120;          // the move is only a few px of rot, so a modest margin is plenty
const PITCH = 40;         // spacing of tile ridges along the arc
const HALF = 11.5;        // half-width of a tube tile (筒瓦)
const HUMP = 3.5;         // tube-tile crests rise HUMP above the arc …
const TROUGH = 2.5;       // … and the pan-tile troughs between them meet the sky TROUGH below it
const EAVE = 70;          // depth of the eave line below the arc (local +y points to the circle centre)
const DISC = 12.5;        // radius of the round tile-end (勾头/瓦当)
const G0 = EAVE + 30;     // green glazed moulding: top …
const G1 = EAVE + 43;     // … and bottom
const WALL = EAVE + 47;   // the red plaster starts here
// the moulded dragon of a tile-end, as much as 25 px can carry: one sinuous relief ridge in a ±10 design space — thin tail low
// on the left, thick body, head high on the right, four leg nubs. It lies on the rising diagonal and tapers, so it reads as
// a creature in low relief rather than as a glyph.
const DRAGON = (() => {
  const N = 18, c = Math.cos(-0.62), sn = Math.sin(-0.62);
  const pts = [], hw = [];
  for (let k = 0; k < N; k++) {
    const t = k / (N - 1);
    const ax = -7.8 + 14.2 * t, lat = -4.4 * Math.sin(t * Math.PI * 2) * (0.62 + 0.38 * t);
    pts.push([ax * c - lat * sn, ax * sn + lat * c]);
    hw.push(t < 0.45 ? L.lerp(0.45, 1.75, L.smooth(t / 0.45)) : L.lerp(1.75, 1.2, L.smooth((t - 0.45) / 0.55)));
  }
  const nrm = pts.map((_, k) => {
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(N - 1, k + 1)], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [-(b[1] - a[1]) / d, (b[0] - a[0]) / d];
  });
  const outline = [...pts.map((p, k) => [p[0] + nrm[k][0] * hw[k], p[1] + nrm[k][1] * hw[k]]),
    ...pts.map((p, k) => [p[0] - nrm[k][0] * hw[k], p[1] - nrm[k][1] * hw[k]]).reverse()];
  // legs: short nubs leaving the body, raked back toward the tail
  const legs = [[5, 1], [6, -1], [11, 1], [12, -1]].map(([k, side]) => {
    const p = pts[k], n = nrm[k], tx = n[1], ty = -n[0];
    const dx = n[0] * side - tx * 0.55, dy = n[1] * side - ty * 0.55, d = Math.hypot(dx, dy);
    return [p[0] + n[0] * side * hw[k] * 0.6, p[1] + n[1] * side * hw[k] * 0.6, p[0] + n[0] * side * hw[k] * 0.6 + (dx / d) * 2.5, p[1] + n[1] * side * hw[k] * 0.6 + (dy / d) * 2.5];
  });
  const h = pts[N - 1], hn = nrm[N - 1];
  return { pts, outline, legs, head: [h[0] + hn[1] * 0.9, h[1] - hn[0] * 0.9], snout: [h[0] + hn[1] * 3.1, h[1] - hn[0] * 3.1] };
})();
let S = null;

// tile ridges, laid out "底瓦坐中": a trough (not a ridge) sits on the centre line
function tileAngles(a) {
  const s = a.span(PAD + 160);
  const n = Math.ceil((s * a.R) / PITCH) + 1;
  const out = [];
  for (let i = -n; i < n; i++) out.push(((i + 0.5) * PITCH) / a.R);
  return out;
}
function troughAngles(a) {
  const s = a.span(PAD + 160);
  const n = Math.ceil((s * a.R) / PITCH) + 1;
  const out = [];
  for (let i = -n; i <= n; i++) out.push((i * PITCH) / a.R);
  return out;
}

/** relief shading from a grey height map (white = high). (lx,ly) points TOWARD the light on screen. 128 = flat. */
function emboss(height, opts = {}) {
  const { lx = -0.64, ly = -0.77, strength = 3, res = 1 } = opts;
  const w = height.width, h = height.height;
  const cw = Math.max(2, Math.round(w * res)), ch = Math.max(2, Math.round(h * res));
  const t = L.makeCanvas(cw, ch); const tg = t.getContext('2d', { willReadFrequently: true });
  tg.imageSmoothingEnabled = true; tg.imageSmoothingQuality = 'high';
  tg.drawImage(height, 0, 0, cw, ch);
  const src = tg.getImageData(0, 0, cw, ch).data;
  const out = new ImageData(cw, ch); const o = out.data;
  for (let y = 0; y < ch; y++) {
    const yu = y > 0 ? y - 1 : 0, yd = y < ch - 1 ? y + 1 : y;
    for (let x = 0; x < cw; x++) {
      const xl = x > 0 ? x - 1 : 0, xr = x < cw - 1 ? x + 1 : x;
      const gx = src[(y * cw + xr) * 4] - src[(y * cw + xl) * 4];
      const gy = src[(yd * cw + x) * 4] - src[(yu * cw + x) * 4];
      const i = (y * cw + x) * 4;
      o[i] = o[i + 1] = o[i + 2] = 128 - (gx * lx + gy * ly) * strength;
      o[i + 3] = 255;
    }
  }
  tg.putImageData(out, 0, 0);
  if (res === 1) return t;
  const c = L.makeCanvas(w, h); const g = c.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(t, 0, 0, w, h);
  return c;
}

// ───────────────────────── sky ─────────────────────────
function buildSky() {
  const c = L.makeCanvas(W, H); const g = c.getContext('2d');
  // peacock-glaze teal, one flat value (no lift toward the wall, no darkening at the top): the cap must be the brightest thing against it
  g.fillStyle = '#149c95'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.5;
  g.drawImage(L.grainTex(W, H, { seed: 's05sky', amount: 0.17, size: 2 }), 0, 0);
  g.globalAlpha = 0.35;
  g.drawImage(L.grainTex(W, H, { seed: 's05sky2', amount: 0.14, size: 1 }), 0, 0);
  return c;
}

// ───────────────────────── red plaster ─────────────────────────
function makeCracks(a) {
  const r = L.rng('s05crack');
  const out = [];
  const s = a.span(PAD + 40);
  const walk = (x, y, ang, steps, w, depth) => {
    const pts = [[x, y]];
    for (let i = 0; i < steps; i++) {
      ang += r.gauss() * 0.12;
      if (r.chance(0.04)) ang += r.sign() * r.range(0.3, 0.7);
      const st = r.range(5, 11);
      x += Math.cos(ang) * st; y += Math.sin(ang) * st;
      pts.push([x, y]);
      if (depth < 2 && r.chance(0.05)) walk(x, y, ang + r.sign() * r.range(0.5, 1.3), Math.max(3, Math.floor(steps * r.range(0.25, 0.5))), w * 0.7, depth + 1);
    }
    out.push({ pts, w, a: r.range(0.55, 1) });
  };
  for (let i = 0; i < 14; i++) {
    const th = r.range(-s, s), dr = -r.range(WALL + 6, 640);
    const p = a.pt(th, dr);
    // most cracks run down the wall (toward the circle centre), a few wander sideways
    const ang = Math.PI / 2 + th + (r.chance(0.3) ? r.range(-1.4, 1.4) : r.range(-0.35, 0.35));
    walk(p.x, p.y, ang, r.int(26, 70), r.range(0.7, 1.3), 0);
  }
  return out;
}
function strokeCracks(g, cracks, color, alpha, wMul, dx = 0, dy = 0) {
  g.save(); g.strokeStyle = color; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const c of cracks) {
    const n = c.pts.length;
    g.globalAlpha = alpha * c.a;
    // hairlines die away toward both ends: the whole length thin, the middle stretches re-stroked wider
    for (const [f0, f1, wm] of [[0, 1, 0.5], [0.12, 0.88, 0.75], [0.28, 0.72, 1]]) {
      const i0 = Math.floor(n * f0), i1 = Math.max(i0 + 2, Math.ceil(n * f1));
      g.lineWidth = c.w * wMul * wm;
      g.beginPath();
      for (let i = i0; i < i1 && i < n; i++) (i > i0 ? g.lineTo(c.pts[i][0] + dx, c.pts[i][1] + dy) : g.moveTo(c.pts[i][0] + dx, c.pts[i][1] + dy));
      g.stroke();
    }
  }
  g.restore();
}
/** map-cracking (龟裂): hairlines along warped Voronoi cell borders, only inside a few drifting zones. alpha-only canvas */
function crazeTex(rg, color) {
  const res = 0.75, cw = Math.round(rg.RW * res), ch = Math.round(rg.RH * res);
  const nz = L.makeNoise('s05craze');
  const col = L.parseColor(color);
  const img = new ImageData(cw, ch); const d = img.data;
  let k = 0;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++, k += 4) {
    const fx = x / res - PAD, fy = y / res + rg.Y0;
    const zone = nz.fbm(fx / 430 + 3.1, fy / 430 - 1.7, 3);
    const m = L.smooth((zone + 0.02) / 0.32);
    if (m <= 0) continue;
    const wx = nz.n2(fx / 95, fy / 95) * 0.38, wy = nz.n2(fx / 95 + 40.3, fy / 95 - 17.9) * 0.38;
    const e = nz.cell(fx / 36 + wx, fy / 36 + wy).edge;
    const line = 1 - L.smooth(e / 0.04);
    if (line <= 0) continue;
    d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = 255 * line * m;
  }
  const c = L.makeCanvas(cw, ch);
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

function buildPlaster(env, rg, g, mids) {
  const a = env.arc;
  const { Y0, RW, RH } = rg;
  const tex = (opts) => L.noiseTex(RW, RH, { ...opts, ox: -PAD, oy: Y0, polar: opts.polar ? { cx: a.cx, cy: a.cy, R: a.R } : null });
  const put = (c, alpha = 1, blend = 'source-over') => { g.globalAlpha = alpha; g.globalCompositeOperation = blend; g.drawImage(c, -PAD, Y0, RW, RH); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; };
  const cracks = makeCracks(a);

  g.save(); a.clipBelow(g, -(WALL - 1));
  // base: earthy matte vermilion, brightest just under the cap
  g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 800, a.R - WALL, [[0, '#9a1a13'], [0.5, '#b2231a'], [1, '#c82c1c']]);
  g.fillRect(-PAD, Y0, RW, RH);
  // sun from the upper left
  g.globalCompositeOperation = 'soft-light';
  g.fillStyle = L.linear(g, -PAD, 0, W + PAD, 0, [[0, 'rgba(255,160,140,0.42)'], [0.42, 'rgba(255,160,140,0.18)'], [0.7, 'rgba(60,0,0,0.02)'], [1, 'rgba(40,0,6,0.42)']]);
  g.fillRect(-PAD, Y0, RW, RH);
  g.globalCompositeOperation = 'source-over';

  // broad, quiet blotches: damp darker fields and sun-bleached ones
  put(tex({ seed: 's05m1', scale: 340, octaves: 4, warp: 0.6, res: 0.2, contrast: 1.5,
    ramp: [[0, 'rgba(112,20,13,0.42)'], [0.42, 'rgba(112,20,13,0)'], [0.62, 'rgba(214,62,40,0)'], [1, 'rgba(214,62,40,0.2)']] }));
  put(tex({ seed: 's05m2', scale: 110, octaves: 4, warp: 0.5, res: 0.25, contrast: 1.5,
    ramp: [[0, 'rgba(108,18,12,0.24)'], [0.42, 'rgba(108,18,12,0)'], [0.66, 'rgba(214,62,40,0)'], [1, 'rgba(214,62,40,0.1)']] }));

  // rain wash: streaks running down the wall, strongest right under the eave, gathered into a few wet zones
  const wash = tex({ seed: 's05wash', polar: true, scale: 24, sx: 1, sy: 24, octaves: 4, contrast: 2.1, res: 0.4,
    ramp: [[0, 'rgba(92,14,9,0.66)'], [0.36, 'rgba(92,14,9,0)'], [0.68, 'rgba(214,62,40,0)'], [1, 'rgba(214,62,40,0.26)']] });
  const wash2 = tex({ seed: 's05wash2', polar: true, scale: 90, sx: 1, sy: 9, octaves: 3, contrast: 1.7, res: 0.25,
    ramp: [[0, 'rgba(96,15,10,0.4)'], [0.42, 'rgba(96,15,10,0)'], [0.66, 'rgba(214,62,40,0)'], [1, 'rgba(214,62,40,0.14)']] });
  const zones = tex({ seed: 's05zone', polar: true, scale: 210, sx: 1, sy: 5, octaves: 3, contrast: 2.2, res: 0.2,
    ramp: [[0, 'rgba(0,0,0,0.1)'], [0.4, 'rgba(0,0,0,0.16)'], [0.62, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,1)']] });
  {
    const wg = wash.getContext('2d'); wg.globalCompositeOperation = 'destination-in';
    wg.drawImage(zones, 0, 0);
  }
  for (const w of [wash, wash2]) {
    const wg = w.getContext('2d'); wg.globalCompositeOperation = 'destination-in';
    wg.fillStyle = L.radial(wg, a.cx + PAD, a.cy - Y0, a.R - 600, a.R - WALL, [[0, 'rgba(0,0,0,0.2)'], [0.55, 'rgba(0,0,0,0.6)'], [1, 'rgba(0,0,0,1)']]);
    wg.fillRect(0, 0, RW, RH);
  }
  put(wash2); put(wash);
  // runs that start exactly under individual drip tiles
  const runs = L.makeLayer(PAD, (q) => {
    const r = L.rng('s05runs');
    for (const th of mids) {
      if (!r.chance(0.6)) continue;
      const len = r.range(60, 280) * (r.chance(0.2) ? 1.7 : 1), w = r.range(2.5, 7.5), lean = r.range(-5, 5);
      const light = r.chance(0.42);
      a.at(q, th + r.range(-0.003, 0.003), -(WALL - 2), () => {
        q.fillStyle = L.linear(q, 0, 0, 0, len, light
          ? [[0, 'rgba(214,62,40,0.32)'], [0.4, 'rgba(214,62,40,0.16)'], [1, 'rgba(214,62,40,0)']]
          : [[0, 'rgba(76,10,7,0.66)'], [0.5, 'rgba(76,10,7,0.32)'], [1, 'rgba(76,10,7,0)']]);
        q.beginPath(); q.moveTo(-w / 2, 0); q.lineTo(w / 2, 0); q.lineTo(w * 0.16 + lean, len); q.lineTo(-w * 0.16 + lean, len); q.closePath(); q.fill();
      });
    }
  });
  g.drawImage(L.blurred(runs, 1.5), -PAD, -PAD);

  // cracks: fine crazing in a few zones, and a handful of long hairlines (sunk, so only a whisper of a lit lip)
  const craze = crazeTex(rg, '#4c0e08');
  put(craze, 0.28);
  strokeCracks(g, cracks, '#ff8a6a', 0.1, 1, 1.1, 1.1);
  strokeCracks(g, cracks, '#3f0a06', 0.78, 1);

  // grit: pits, and sand grains catching the sun
  L.speckle(g, { seed: 's05pit', count: 5600, x: -PAD, y: Y0, w: RW, h: RH, rMin: 0.5, rMax: 2.1, colors: ['#6b150d', '#4a0d08', '#7c1a12'], alpha: [0.2, 0.65] });
  L.speckle(g, { seed: 's05glint', count: 2200, x: -PAD, y: Y0, w: RW, h: RH, rMin: 0.45, rMax: 1.5, colors: ['#e2553a', '#f07050', '#ff9a78'], alpha: [0.15, 0.55] });

  // relief: brushed, sandy plaster + cracks, lit from the upper left
  const hc = L.makeCanvas(RW, RH); const hg = hc.getContext('2d');
  hg.fillStyle = '#808080'; hg.fillRect(0, 0, RW, RH);
  hg.globalAlpha = 0.5; hg.drawImage(tex({ seed: 's05h1', scale: 70, octaves: 4, res: 0.3, contrast: 1.4 }), 0, 0);
  hg.globalAlpha = 0.14; hg.drawImage(tex({ seed: 's05h3', polar: true, scale: 9, sx: 1, sy: 7, octaves: 3, res: 0.5, contrast: 1.6 }), 0, 0);
  hg.globalAlpha = 0.2; hg.drawImage(tex({ seed: 's05h2', scale: 5, octaves: 2, res: 0.7, contrast: 1.6 }), 0, 0);
  hg.globalAlpha = 0.3; hg.globalCompositeOperation = 'overlay';
  hg.drawImage(L.grainTex(RW, RH, { seed: 's05hg', amount: 0.85 }), 0, 0);
  hg.globalCompositeOperation = 'source-over'; hg.globalAlpha = 1;
  {
    const kg = craze.getContext('2d');                       // the same crazing, turned black, sinks into the relief
    kg.globalCompositeOperation = 'source-in'; kg.fillStyle = '#000'; kg.fillRect(0, 0, craze.width, craze.height);
  }
  hg.globalAlpha = 0.3; hg.drawImage(craze, 0, 0, RW, RH); hg.globalAlpha = 1;
  hg.save(); hg.translate(PAD, -Y0); strokeCracks(hg, cracks, '#000', 0.95, 1.5); hg.restore();
  put(emboss(hc, { strength: 1.6 }), 0.45, 'overlay');

  // a soft hot spot of sunlight left of centre
  g.globalCompositeOperation = 'soft-light';
  g.fillStyle = L.radial(g, a.cx - 320, a.crestY + 260, 40, 980, [[0, 'rgba(255,160,140,0.4)'], [1, 'rgba(255,160,140,0)']]);
  g.fillRect(-PAD, Y0, RW, RH);
  // … and the wall falls away into a deeper, cooler red toward the lower right
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = L.linear(g, a.cx + 80, a.crestY + 220, W + PAD, H + PAD, [[0, 'rgba(140,90,104,0)'], [1, 'rgba(140,90,104,0.5)']]);
  g.fillRect(-PAD, Y0, RW, RH);
  g.globalCompositeOperation = 'source-over';
  g.restore();
}

/**
 * the eave's cast shadow on the wall, thrown down and to the right by the upper-left sun: a deep band whose lower edge is
 * the row of round tile-ends and pointed drip tongues. Returns a black silhouette (crisp core + soft penumbra) to be tinted.
 */
function buildShadow(env, tiles, mids) {
  const a = env.arc;
  const sil = L.makeLayer(PAD, (q) => {
    q.fillStyle = '#000';
    a.pathBand(q, -(WALL - 6), -(WALL + 40)); q.fill();
    for (const th of tiles) a.at(q, th, 0, () => { q.beginPath(); q.arc(14, WALL + 40, DISC, 0, L.TAU); q.fill(); });
    for (const th of mids) a.at(q, th, 0, () => {
      q.beginPath(); q.moveTo(1, WALL + 38); q.lineTo(28, WALL + 38);
      q.quadraticCurveTo(29.5, WALL + 46, 22.6, WALL + 49); q.quadraticCurveTo(22, WALL + 57, 14.5, WALL + 64);
      q.quadraticCurveTo(7, WALL + 57, 6.4, WALL + 49); q.quadraticCurveTo(-0.5, WALL + 46, 1, WALL + 38);
      q.closePath(); q.fill();
    });
  });
  return L.makeLayer(PAD, (q) => {
    q.drawImage(L.blurred(sil, 2.5), -PAD, -PAD);
    q.globalAlpha = 0.45; q.drawImage(L.blurred(sil, 14), -PAD, -PAD); q.globalAlpha = 1;
    q.globalCompositeOperation = 'destination-in';
    q.fillStyle = L.radial(q, a.cx, a.cy, a.R - (WALL + 70), a.R - WALL, [[0, 'rgba(0,0,0,0.84)'], [1, 'rgba(0,0,0,1)']]);
    q.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
  });
}
/** a flat-colour copy of a silhouette layer */
function tinted(layer, color) {
  return L.makeLayer(PAD, (q) => {
    q.drawImage(layer, -PAD, -PAD);
    q.globalCompositeOperation = 'source-in';
    q.fillStyle = color; q.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
  });
}

// ───────────────────────── the glazed cap ─────────────────────────
function buildTiles(env, rg, tiles, mids) {
  const a = env.arc;
  const { Y0, RW, RH } = rg;
  // per-tile glaze variation: some tiles a paler gold, some more ochre (old and replacement pieces side by side)
  const tint = (c, t) => (t >= 0 ? L.mix(c, '#f6c22e', t) : L.mix(c, '#c9790a', -t));
  const base = L.makeLayer(PAD, (q) => {
    // 1) under the eave: the brick cornice lost in shadow
    q.fillStyle = L.radial(q, a.cx, a.cy, a.R - G0, a.R - (EAVE - 8), [[0, '#7a2010'], [0.5, '#571509'], [1, '#3a0d07']]);
    a.pathBand(q, -(EAVE - 8), -(G0 + 1)); q.fill();
    q.lineWidth = 1.4; q.strokeStyle = 'rgba(140,50,26,0.55)'; a.stroke(q, -(EAVE + 23));
    q.strokeStyle = 'rgba(10,2,1,0.6)'; a.stroke(q, -(EAVE + 24.6));
    // 2) the thin green glazed moulding
    q.fillStyle = L.radial(q, a.cx, a.cy, a.R - G1, a.R - G0, [[0, '#0f4a34'], [0.15, '#1f8f6a'], [0.42, '#22966f'], [0.5, '#45bd8a'], [0.58, '#22966f'], [0.85, '#1c8361'], [1, '#12503a']]);
    a.pathBand(q, -G0, -G1); q.fill();
    q.lineWidth = 1.4; q.strokeStyle = 'rgba(150,235,190,0.45)'; a.stroke(q, -(G0 + 6));
    a.along({ spacing: 124, dr: 0, margin: PAD + 120 }, (it) => {
      a.at(q, it.theta + 0.004, 0, () => { q.fillStyle = 'rgba(8,30,20,0.6)'; q.fillRect(-0.8, G0, 1.6, G1 - G0); q.fillStyle = 'rgba(190,255,220,0.25)'; q.fillRect(0.9, G0 + 2, 1, G1 - G0 - 4); });
    });
    q.fillStyle = '#4a0e0a'; a.pathBand(q, -G1, -(WALL + 0.5)); q.fill();
    // soft shadows of the drip tiles falling across the moulding
    q.save(); a.clipBand(q, -G0, -G1);
    for (const th of mids) a.at(q, th, 0, () => { q.fillStyle = L.radial(q, 7, G0 + 2, 1, 13, [[0, 'rgba(4,20,12,0.6)'], [1, 'rgba(4,20,12,0)']]); q.fillRect(-10, G0 - 8, 34, 28); });
    q.restore();
  });

  const glazed = L.makeLayer(PAD, (q) => {
    const r = L.rng('s05tile');
    // 3) pan-tile troughs (板瓦沟)
    q.fillStyle = '#b87408'; a.pathBand(q, -TROUGH, -(EAVE + 3)); q.fill();
    const hw = PITCH / 2 - HALF + 2.5;
    for (const th of mids) {
      a.at(q, th, 0, () => {
        // the tube to the left throws its shadow into the trough
        q.fillStyle = L.linear(q, -hw, 0, hw, 0, [[0, '#7c4804'], [0.38, '#cc880e'], [1, '#f2b21c']]);
        q.fillRect(-hw, TROUGH, hw * 2, EAVE + 3 - TROUGH);
        q.fillStyle = L.linear(q, 0, TROUGH, 0, EAVE, [[0, 'rgba(255,232,150,0.55)'], [0.2, 'rgba(255,232,150,0)'], [0.7, 'rgba(50,22,0,0)'], [1, 'rgba(50,22,0,0.35)']]);
        q.fillRect(-hw, TROUGH, hw * 2, EAVE + 3 - TROUGH);
        q.lineCap = 'round';
        for (let y = TROUGH + 8; y < EAVE - 2; y += 7.5) {
          q.strokeStyle = 'rgba(62,30,0,0.48)'; q.lineWidth = 1.5; q.beginPath(); q.moveTo(-hw, y - 2); q.quadraticCurveTo(0, y + 3.5, hw, y - 2); q.stroke();
          q.strokeStyle = 'rgba(255,220,120,0.4)'; q.lineWidth = 1; q.beginPath(); q.moveTo(-hw, y - 0.2); q.quadraticCurveTo(0, y + 5.3, hw, y - 0.2); q.stroke();
        }
      });
    }

    // 4) drip tiles (滴水): ruyi-shaped tongues hanging between and below the round tile-ends
    const y0 = EAVE - 1;
    const tongue = () => {
      q.beginPath();
      q.moveTo(-14, y0); q.quadraticCurveTo(0, y0 + 3.5, 14, y0);
      q.quadraticCurveTo(16, y0 + 9, 8.2, y0 + 12.5); q.quadraticCurveTo(7.6, y0 + 21, 0, y0 + 27);
      q.quadraticCurveTo(-7.6, y0 + 21, -8.2, y0 + 12.5); q.quadraticCurveTo(-16, y0 + 9, -14, y0);
      q.closePath();
    };
    for (const th of mids) {
      const tone = r.range(-0.3, 0.25);
      a.at(q, th, 0, () => {
        q.save(); q.translate(3, 4); tongue(); q.fillStyle = 'rgba(0,0,0,0.5)'; q.fill(); q.restore();
        tongue();
        q.fillStyle = L.linear(q, -10, y0, 8, y0 + 27, [[0, tint('#fbd24e', tone)], [0.45, tint('#e6a81c', tone)], [1, tint('#a8690a', tone)]]);
        q.fill();
        q.save(); q.clip();
        q.lineWidth = 2.4; q.strokeStyle = 'rgba(255,242,176,0.75)'; tongue(); q.stroke();
        q.restore();
        // moulded relief: a small raised boss
        q.fillStyle = 'rgba(88,46,0,0.55)'; q.beginPath(); q.arc(0.8, y0 + 12.3, 4.3, 0, L.TAU); q.fill();
        q.fillStyle = L.radial(q, -1.3, y0 + 10, 0.4, 5, [[0, '#fff3ba'], [0.55, tint('#efb62a', tone)], [1, tint('#b87a10', tone)]]);
        q.beginPath(); q.arc(0, y0 + 11.3, 3.9, 0, L.TAU); q.fill();
        q.lineWidth = 1; q.strokeStyle = 'rgba(60,28,0,0.7)'; tongue(); q.stroke();
      });
    }

    // 5) tube tiles (筒瓦): half-cylinders that roll over the top of the wall — their humps are the skyline
    for (const th of tiles) {
      const tone = r.range(-0.32, 0.3) * (r.chance(0.15) ? 1.8 : 1);
      const j1 = EAVE * 0.33 + r.range(-3, 3), j2 = EAVE * 0.63 + r.range(-3, 3);
      a.at(q, th, 0, () => {
        q.fillStyle = 'rgba(40,18,0,0.45)'; q.fillRect(HALF - 1, HUMP + 2, 5, EAVE - HUMP - 8);   // contact shadow to the right
        const body = () => { q.beginPath(); q.moveTo(-HALF, EAVE); q.lineTo(-HALF, HUMP); q.ellipse(0, HUMP, HALF, HUMP * 2, 0, Math.PI, 0); q.lineTo(HALF, EAVE); q.closePath(); };
        body();
        q.fillStyle = L.linear(q, -HALF, 0, HALF, 0, [
          [0, tint('#a86a08', tone)], [0.14, tint('#f0b01a', tone)], [0.27, tint('#ffc428', tone)], [0.31, '#fff4c0'], [0.35, tint('#f5b81c', tone)],
          [0.68, tint('#e09c12', tone)], [0.88, tint('#a66808', tone)], [1, tint('#6e4004', tone)]]);
        q.fill();
        q.save(); q.clip();
        // along its length: the roll-over at the top catches the sky, the eave end falls off
        q.fillStyle = L.linear(q, 0, -HUMP, 0, EAVE, [[0, 'rgba(255,246,190,0.85)'], [0.16, 'rgba(255,236,150,0)'], [0.7, 'rgba(70,34,0,0)'], [1, 'rgba(70,34,0,0.4)']]);
        q.fillRect(-HALF, -HUMP, HALF * 2, EAVE + HUMP);
        // joints between tile lengths
        for (const j of [j1, j2]) {
          q.strokeStyle = 'rgba(70,34,0,0.72)'; q.lineWidth = 1.6; q.beginPath(); q.moveTo(-HALF, j); q.quadraticCurveTo(0, j - 4.5, HALF, j); q.stroke();
          q.strokeStyle = 'rgba(255,240,170,0.55)'; q.lineWidth = 1; q.beginPath(); q.moveTo(-HALF, j + 2); q.quadraticCurveTo(0, j - 2.5, HALF, j + 2); q.stroke();
        }
        // glossy streak of glaze
        q.strokeStyle = 'rgba(255,254,236,0.7)'; q.lineWidth = 1.5; q.lineCap = 'round';
        const sx = -HALF * 0.42;
        q.beginPath(); q.moveTo(sx, 4); q.lineTo(sx, j1 - 5); q.moveTo(sx, j1 + 5); q.lineTo(sx, j2 - 5); q.moveTo(sx, j2 + 5); q.lineTo(sx, EAVE - 22); q.stroke();
        q.restore();

        // nail cap (钉帽): a glazed bead on the back of the tile just behind its round end
        const ny = EAVE - 14, nr = 4.7;
        q.fillStyle = 'rgba(50,24,0,0.55)'; q.beginPath(); q.ellipse(1.8, ny + 2.6, nr * 1.05, nr * 0.85, 0, 0, L.TAU); q.fill();
        q.fillStyle = L.radial(q, -1.6, ny - 1.8, 0.4, nr * 1.3, [[0, '#fff8d0'], [0.3, tint('#f8cc44', tone)], [0.75, tint('#c98a10', tone)], [1, '#74460a']]);
        q.beginPath(); q.arc(0, ny, nr, 0, L.TAU); q.fill();

        // round tile-end (勾头/瓦当): raised rim, sunk field, moulded relief
        const cy = EAVE + 5;
        q.fillStyle = 'rgba(0,0,0,0.55)'; q.beginPath(); q.arc(3, cy + 4.5, DISC, 0, L.TAU); q.fill();
        q.fillStyle = L.radial(q, -4.5, cy - 5.5, 1, DISC * 1.5, [[0, '#fff6c4'], [0.3, tint('#f8ca3c', tone)], [0.72, tint('#d0920f', tone)], [1, tint('#7c4c06', tone)]]);
        q.beginPath(); q.arc(0, cy, DISC, 0, L.TAU); q.fill();
        q.fillStyle = L.linear(q, -DISC, cy - DISC, DISC, cy + DISC, [[0, tint('#7c4a04', tone)], [0.55, tint('#c88c14', tone)], [1, tint('#f0b82c', tone)]]);
        q.beginPath(); q.arc(0, cy, DISC - 3.2, 0, L.TAU); q.fill();
        // the moulded dragon, as it reads from this distance: a sinuous ridge in low relief — shadow below-right, body, lit lip above-left
        q.save(); q.translate(0, cy); q.rotate(r.range(-0.16, 0.16)); q.scale(0.8, 0.8);
        q.lineCap = 'round'; q.lineJoin = 'round';
        const dragon = (ox, oy, col, grow) => {
          q.fillStyle = col; q.strokeStyle = col;
          q.beginPath(); DRAGON.outline.forEach(([x, y], k) => (k ? q.lineTo(x + ox, y + oy) : q.moveTo(x + ox, y + oy))); q.closePath(); q.fill();
          if (grow) { q.lineWidth = grow; q.stroke(); }
          q.lineWidth = 1.5 + grow;
          q.beginPath(); for (const [x0, y0l, x1, y1] of DRAGON.legs) { q.moveTo(x0 + ox, y0l + oy); q.lineTo(x1 + ox, y1 + oy); } q.stroke();
          q.beginPath(); q.arc(DRAGON.head[0] + ox, DRAGON.head[1] + oy, 2.3 + grow / 2, 0, L.TAU); q.fill();
          q.beginPath(); q.arc(DRAGON.snout[0] + ox, DRAGON.snout[1] + oy, 1.35 + grow / 2, 0, L.TAU); q.fill();
        };
        dragon(0.9, 1.1, 'rgba(70,34,0,0.6)', 0.9);
        dragon(0, 0, tint('#f2b622', tone), 0);
        q.globalAlpha = 0.7; q.strokeStyle = '#fff3b0'; q.lineWidth = 1;
        q.beginPath(); DRAGON.pts.forEach(([x, y], k) => { if (k >= 3) (k > 3 ? q.lineTo(x - 0.6, y - 0.7) : q.moveTo(x - 0.6, y - 0.7)); }); q.stroke();
        q.fillStyle = '#fff3b0'; q.beginPath(); q.arc(DRAGON.head[0] - 0.7, DRAGON.head[1] - 0.8, 0.9, 0, L.TAU); q.fill();
        q.restore();
        q.strokeStyle = 'rgba(60,28,0,0.75)'; q.lineWidth = 1; q.beginPath(); q.arc(0, cy, DISC - 0.4, 0, L.TAU); q.stroke();
        q.strokeStyle = 'rgba(255,243,176,0.92)'; q.lineWidth = 1.4; q.beginPath(); q.arc(0, cy, DISC - 1.6, Math.PI * 1.02, Math.PI * 1.52); q.stroke();
      });
    }

    // 6) glaze mottling and a little grime — painted only onto what is already there, kept warm so the yellow stays clean
    q.globalCompositeOperation = 'source-atop';
    const tex = (opts) => L.noiseTex(RW, RH, { ...opts, ox: -PAD, oy: Y0, polar: opts.polar ? { cx: a.cx, cy: a.cy, R: a.R } : null });
    q.drawImage(tex({ seed: 's05glaze', polar: true, scale: 13, sx: 1, sy: 4.5, octaves: 4, contrast: 1.7, res: 0.5,
      ramp: [[0, 'rgba(130,62,0,0.3)'], [0.38, 'rgba(130,62,0,0)'], [0.64, 'rgba(255,222,110,0)'], [1, 'rgba(255,222,110,0.18)']] }), -PAD, Y0);
    q.drawImage(tex({ seed: 's05dirt', scale: 150, octaves: 4, warp: 0.8, res: 0.25, contrast: 1.6,
      ramp: [[0, 'rgba(110,50,4,0.3)'], [0.38, 'rgba(110,50,4,0)'], [1, 'rgba(110,50,4,0)']] }), -PAD, Y0);
    q.globalCompositeOperation = 'source-over';
  });
  // a final lift so the cap reads as one luminous yellow band (overlay through its own silhouette)
  const lift = L.makeLayer(PAD, (q) => {
    q.drawImage(glazed, -PAD, -PAD);
    q.globalCompositeOperation = 'source-in';
    q.fillStyle = '#ffbe1e'; q.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
  });
  const gq = glazed.getContext('2d');
  gq.globalCompositeOperation = 'overlay'; gq.globalAlpha = 0.56; gq.drawImage(lift, -PAD, -PAD);
  gq.globalCompositeOperation = 'source-over'; gq.globalAlpha = 1;
  // the skyline is laid last so neither mottling nor lift can dull it: a pale-gold rim over every hump and along every
  // trough top — this scallop against the teal is the arc itself
  gq.strokeStyle = 'rgba(255,243,176,0.95)'; gq.lineCap = 'butt';
  const gap = PITCH / 2 - HALF;
  for (const th of mids) a.at(gq, th, 0, () => { gq.lineWidth = 2; gq.beginPath(); gq.moveTo(-gap - 0.5, TROUGH + 1); gq.lineTo(gap + 0.5, TROUGH + 1); gq.stroke(); });
  for (const th of tiles) a.at(gq, th, 0, () => { gq.lineWidth = 2.2; gq.beginPath(); gq.ellipse(0, HUMP, HALF - 1.1, HUMP * 2 - 1.1, 0, Math.PI, 0); gq.stroke(); });
  base.getContext('2d').drawImage(glazed, -PAD, -PAD);
  return base;
}

export default {
  name: '红墙黄瓦',
  tone: 'light',
  init(env) {
    const a = env.arc;
    const Y0 = Math.floor(a.crestY - 24);                       // heavy textures only cover the part of the frame below the arc
    const rg = { Y0, RW: W + PAD * 2, RH: H + PAD - Y0 };
    const tiles = tileAngles(a), mids = troughAngles(a);
    const cap = buildTiles(env, rg, tiles, mids);
    const shadow = buildShadow(env, tiles, mids);
    const wall = L.makeLayer(PAD, (g) => {
      buildPlaster(env, rg, g, mids);
      g.save(); a.clipBelow(g, -(WALL - 1));
      // a cool shadow against the warm wall: multiply drops red and green but leaves the blue, then a breath of violet → 绛紫
      g.globalCompositeOperation = 'multiply';
      g.drawImage(tinted(shadow, '#9a78ff'), -PAD, -PAD);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 0.12;
      g.drawImage(tinted(shadow, '#3a1050'), -PAD, -PAD);
      g.restore();
      g.drawImage(cap, -PAD, -PAD);
    });
    // a pale-gold copy of the cap, used as the mask for a travelling glint
    const glint = L.makeLayer(PAD, (g) => {
      g.drawImage(cap, -PAD, -PAD);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = '#ffd050'; g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    });
    S = { sky: buildSky(), wall, glint, scratch: L.makeCanvas(W, H) };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.0028, 0.0028, p);
    ctx.drawImage(S.sky, 0, 0);
    L.blit(ctx, env, S.wall, { rot });
    // sun glint sliding along the glazed cap (overlay: it lifts the glaze without bleaching it)
    const sg = S.scratch.getContext('2d');
    sg.globalCompositeOperation = 'source-over'; sg.clearRect(0, 0, W, H);
    L.blit(sg, env, S.glint, { rot });
    const gp = a.pt(L.lerp(-0.2, -0.11, p), -30);
    sg.globalCompositeOperation = 'destination-in';
    sg.fillStyle = L.radial(sg, gp.x, gp.y, 0, 240, [[0, 'rgba(0,0,0,1)'], [0.4, 'rgba(0,0,0,0.4)'], [1, 'rgba(0,0,0,0)']]);
    sg.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.drawImage(S.scratch, 0, 0); ctx.restore();
  },
};
