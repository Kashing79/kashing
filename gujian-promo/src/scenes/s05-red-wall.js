// s05 — 红墙黄瓦. Six frames of pure colour collision: flat turquoise sky / a yellow-glazed wall cap (墙帽) on the arc /
// a hair-thin green glazed moulding in the eave's shadow / sunlit vermilion palace-wall plaster filling everything below.
// The arc is the scalloped skyline of the cap: a row of small tube-tile humps (±HUMP px about the arc).
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 120;          // the move is only a few px of rot, so a modest margin is plenty
const PITCH = 40;         // spacing of tile ridges along the arc
const HALF = 11.5;        // half-width of a tube tile (筒瓦)
const HUMP = 4.5;         // tile crests rise HUMP above the arc, the troughs sit HUMP below it
const EAVE = 70;          // depth of the eave line below the arc (local +y points to the circle centre)
const DISC = 12.5;        // radius of the round tile-end (勾头/瓦当)
const G0 = EAVE + 30;     // green glazed moulding: top …
const G1 = EAVE + 43;     // … and bottom
const WALL = EAVE + 47;   // the red plaster starts here
// soft relief bumps of a tile-end's coiled dragon (团龙): a spiral run of [x, y, r] in a ±10 design space
const DRAGON = Array.from({ length: 11 }, (_, k) => {
  const t = k / 10, ang = -0.6 + t * Math.PI * 2 * 1.35, rad = 1.2 + 6.3 * t;
  return [rad * Math.cos(ang), rad * Math.sin(ang), k === 10 ? 2.7 : 1.5 + 0.8 * t];
});
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
function buildSky(env) {
  const a = env.arc;
  const c = L.makeCanvas(W, H); const g = c.getContext('2d');
  g.fillStyle = '#2aa7a0'; g.fillRect(0, 0, W, H);
  // all but flat: a breath lighter where it meets the wall, a breath deeper at the top
  g.fillStyle = L.radial(g, a.cx, a.cy, a.R, a.R + 820, [[0, 'rgba(126,226,212,0.13)'], [0.3, 'rgba(126,226,212,0.02)'], [1, 'rgba(6,74,84,0.14)']]);
  g.fillRect(0, 0, W, H);
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
      ang += r.gauss() * 0.3;
      if (r.chance(0.08)) ang += r.sign() * r.range(0.5, 1.2);
      const st = r.range(5, 11);
      x += Math.cos(ang) * st; y += Math.sin(ang) * st;
      pts.push([x, y]);
      if (depth < 2 && r.chance(0.1)) walk(x, y, ang + r.sign() * r.range(0.5, 1.3), Math.max(3, Math.floor(steps * r.range(0.25, 0.5))), w * 0.7, depth + 1);
    }
    out.push({ pts, w, a: r.range(0.55, 1) });
  };
  for (let i = 0; i < 30; i++) {
    const th = r.range(-s, s), dr = -r.range(WALL + 6, 640);
    const p = a.pt(th, dr);
    // most cracks run down the wall (toward the circle centre), a few wander sideways
    const ang = Math.PI / 2 + th + (r.chance(0.3) ? r.range(-1.4, 1.4) : r.range(-0.35, 0.35));
    walk(p.x, p.y, ang, r.int(10, 44), r.range(0.9, 1.8), 0);
  }
  return out;
}
function strokeCracks(g, cracks, color, alpha, wMul, dx = 0, dy = 0) {
  g.save(); g.strokeStyle = color; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const c of cracks) {
    g.globalAlpha = alpha * c.a; g.lineWidth = c.w * wMul;
    g.beginPath();
    c.pts.forEach((p, i) => (i ? g.lineTo(p[0] + dx, p[1] + dy) : g.moveTo(p[0] + dx, p[1] + dy)));
    g.stroke();
  }
  g.restore();
}
/** map-cracking (龟裂): hairlines along warped Voronoi cell borders, only inside a few drifting zones. alpha-only canvas */
function crazeTex(rg, color) {
  const res = 0.5, cw = Math.round(rg.RW * res), ch = Math.round(rg.RH * res);
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
    const e = nz.cell(fx / 62 + wx, fy / 62 + wy).edge;
    const line = 1 - L.smooth(e / 0.05);
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
  g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 800, a.R - WALL, [[0, '#a02417'], [0.5, '#b12a1a'], [1, '#c0311d']]);
  g.fillRect(-PAD, Y0, RW, RH);
  // sun from the upper left
  g.globalCompositeOperation = 'soft-light';
  g.fillStyle = L.linear(g, -PAD, 0, W + PAD, 0, [[0, 'rgba(255,214,170,0.36)'], [0.42, 'rgba(255,214,170,0.12)'], [0.7, 'rgba(60,0,0,0.04)'], [1, 'rgba(50,0,0,0.3)']]);
  g.fillRect(-PAD, Y0, RW, RH);
  g.globalCompositeOperation = 'source-over';

  // broad, quiet blotches: damp darker fields and sun-bleached ones
  put(tex({ seed: 's05m1', scale: 340, octaves: 4, warp: 0.6, res: 0.2, contrast: 1.5,
    ramp: [[0, 'rgba(112,20,13,0.55)'], [0.42, 'rgba(112,20,13,0)'], [0.62, 'rgba(216,84,56,0)'], [1, 'rgba(216,84,56,0.42)']] }));
  put(tex({ seed: 's05m2', scale: 110, octaves: 4, warp: 0.5, res: 0.25, contrast: 1.5,
    ramp: [[0, 'rgba(108,18,12,0.3)'], [0.42, 'rgba(108,18,12,0)'], [0.66, 'rgba(222,96,66,0)'], [1, 'rgba(222,96,66,0.2)']] }));

  // rain wash: streaks running down the wall, strongest right under the eave, gathered into a few wet zones
  const wash = tex({ seed: 's05wash', polar: true, scale: 24, sx: 1, sy: 24, octaves: 4, contrast: 2.1, res: 0.4,
    ramp: [[0, 'rgba(92,14,9,0.66)'], [0.36, 'rgba(92,14,9,0)'], [0.68, 'rgba(232,118,88,0)'], [1, 'rgba(232,118,88,0.5)']] });
  const wash2 = tex({ seed: 's05wash2', polar: true, scale: 90, sx: 1, sy: 9, octaves: 3, contrast: 1.7, res: 0.25,
    ramp: [[0, 'rgba(96,15,10,0.4)'], [0.42, 'rgba(96,15,10,0)'], [0.66, 'rgba(228,112,82,0)'], [1, 'rgba(228,112,82,0.28)']] });
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
          ? [[0, 'rgba(234,128,98,0.6)'], [0.4, 'rgba(230,120,90,0.3)'], [1, 'rgba(230,120,90,0)']]
          : [[0, 'rgba(76,10,7,0.66)'], [0.5, 'rgba(76,10,7,0.32)'], [1, 'rgba(76,10,7,0)']]);
        q.beginPath(); q.moveTo(-w / 2, 0); q.lineTo(w / 2, 0); q.lineTo(w * 0.16 + lean, len); q.lineTo(-w * 0.16 + lean, len); q.closePath(); q.fill();
      });
    }
  });
  g.drawImage(L.blurred(runs, 1.5), -PAD, -PAD);

  // a few flaked patches: the top coat has let go and an older, paler coat shows (slightly recessed in the relief)
  const peelOpts = { seed: 's05peel', scale: 150, octaves: 5, gain: 0.55, warp: 0.5, res: 0.35, contrast: 1.6 };
  put(tex({ ...peelOpts, ramp: [[0, 'rgba(0,0,0,0)'], [0.81, 'rgba(0,0,0,0)'], [0.825, 'rgba(204,80,52,0.42)'], [1, 'rgba(214,100,72,0.6)']] }));

  // cracks
  put(crazeTex(rg, '#4c0e08'), 0.5);
  strokeCracks(g, cracks, '#ffa487', 0.3, 1, 1.1, 1.1);
  strokeCracks(g, cracks, '#3f0a06', 0.78, 1);

  // grit: pits, and sand grains catching the sun
  L.speckle(g, { seed: 's05pit', count: 5600, x: -PAD, y: Y0, w: RW, h: RH, rMin: 0.5, rMax: 2.1, colors: ['#6b150d', '#4a0d08', '#7c1a12'], alpha: [0.2, 0.65] });
  L.speckle(g, { seed: 's05glint', count: 7000, x: -PAD, y: Y0, w: RW, h: RH, rMin: 0.45, rMax: 1.5, colors: ['#f08e6c', '#ffc2a6', '#e87850', '#ffe4d4'], alpha: [0.2, 0.85] });

  // relief: brushed, sandy plaster + recessed flakes + cracks, lit from the upper left
  const hc = L.makeCanvas(RW, RH); const hg = hc.getContext('2d');
  hg.fillStyle = '#808080'; hg.fillRect(0, 0, RW, RH);
  hg.globalAlpha = 0.36; hg.drawImage(tex({ seed: 's05h1', scale: 70, octaves: 4, res: 0.3, contrast: 1.4 }), 0, 0);
  hg.globalAlpha = 0.14; hg.drawImage(tex({ seed: 's05h3', polar: true, scale: 9, sx: 1, sy: 7, octaves: 3, res: 0.5, contrast: 1.6 }), 0, 0);
  hg.globalAlpha = 0.42; hg.drawImage(tex({ seed: 's05h2', scale: 5, octaves: 2, res: 0.7, contrast: 1.6 }), 0, 0);
  hg.globalAlpha = 0.5; hg.globalCompositeOperation = 'overlay';
  hg.drawImage(L.grainTex(RW, RH, { seed: 's05hg', amount: 0.85 }), 0, 0);
  hg.globalCompositeOperation = 'source-over'; hg.globalAlpha = 1;
  hg.drawImage(tex({ ...peelOpts, ramp: [[0, 'rgba(0,0,0,0)'], [0.81, 'rgba(0,0,0,0)'], [0.825, 'rgba(0,0,0,0.42)'], [1, 'rgba(0,0,0,0.42)']] }), 0, 0);
  hg.globalAlpha = 0.75; hg.drawImage(crazeTex(rg, '#000'), 0, 0, RW, RH); hg.globalAlpha = 1;
  hg.save(); hg.translate(PAD, -Y0); strokeCracks(hg, cracks, '#000', 0.95, 1.5); hg.restore();
  put(emboss(hc, { strength: 2.3 }), 0.55, 'overlay');

  // a soft hot spot of sunlight left of centre
  g.globalCompositeOperation = 'soft-light';
  g.fillStyle = L.radial(g, a.cx - 320, a.crestY + 260, 40, 980, [[0, 'rgba(255,204,160,0.3)'], [1, 'rgba(255,204,160,0)']]);
  g.fillRect(-PAD, Y0, RW, RH);
  g.restore();
}

/** the eave's cast shadow on the wall: a band whose lower edge is scalloped by the tile-ends and drip tips */
function buildShadow(env, tiles, mids) {
  const a = env.arc;
  const sh = L.makeLayer(PAD, (q) => {
    q.fillStyle = '#000';
    a.pathBand(q, -(WALL - 6), -(WALL + 22)); q.fill();
    for (const th of tiles) a.at(q, th, 0, () => { q.beginPath(); q.arc(8, WALL + 18, DISC, 0, L.TAU); q.fill(); });
    for (const th of mids) a.at(q, th, 0, () => { q.beginPath(); q.moveTo(-2, WALL + 16); q.lineTo(18, WALL + 16); q.lineTo(9, WALL + 38); q.closePath(); q.fill(); });
    q.globalCompositeOperation = 'source-in';
    q.fillStyle = '#8c3a31'; q.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
  });
  return L.blurred(sh, 4);
}

// ───────────────────────── the glazed cap ─────────────────────────
function buildTiles(env, rg, tiles, mids) {
  const a = env.arc;
  const { Y0, RW, RH } = rg;
  // per-tile glaze variation: some tiles are lemony, some more orange (old and replacement pieces side by side)
  const tint = (c, t) => (t >= 0 ? L.mix(c, '#ffd75a', t) : L.mix(c, '#c9790a', -t));
  const base = L.makeLayer(PAD, (q) => {
    // 1) under the eave: the brick cornice lost in shadow
    q.fillStyle = L.radial(q, a.cx, a.cy, a.R - G0, a.R - (EAVE - 8), [[0, '#611d0e'], [0.5, '#38110a'], [1, '#210905']]);
    a.pathBand(q, -(EAVE - 8), -(G0 + 1)); q.fill();
    q.lineWidth = 1.4; q.strokeStyle = 'rgba(140,50,26,0.55)'; a.stroke(q, -(EAVE + 23));
    q.strokeStyle = 'rgba(10,2,1,0.6)'; a.stroke(q, -(EAVE + 24.6));
    // 2) the thin green glazed moulding
    q.fillStyle = L.radial(q, a.cx, a.cy, a.R - G1, a.R - G0, [[0, '#0f3626'], [0.2, '#2a7654'], [0.5, '#6bd3a0'], [0.7, '#2f7d5a'], [1, '#17422f']]);
    a.pathBand(q, -G0, -G1); q.fill();
    q.lineWidth = 1.4; q.strokeStyle = 'rgba(226,255,238,0.7)'; a.stroke(q, -(G0 + 6));
    a.along({ spacing: 124, dr: 0, margin: PAD + 120 }, (it) => {
      a.at(q, it.theta + 0.004, 0, () => { q.fillStyle = 'rgba(8,30,20,0.6)'; q.fillRect(-0.8, G0, 1.6, G1 - G0); q.fillStyle = 'rgba(190,255,220,0.25)'; q.fillRect(0.9, G0 + 2, 1, G1 - G0 - 4); });
    });
    q.fillStyle = '#2a0705'; a.pathBand(q, -G1, -(WALL + 0.5)); q.fill();
    // soft shadows of the drip tiles falling across the moulding
    q.save(); a.clipBand(q, -G0, -G1);
    for (const th of mids) a.at(q, th, 0, () => { q.fillStyle = L.radial(q, 7, G0 + 2, 1, 13, [[0, 'rgba(4,20,12,0.6)'], [1, 'rgba(4,20,12,0)']]); q.fillRect(-10, G0 - 8, 34, 28); });
    q.restore();
  });

  const glazed = L.makeLayer(PAD, (q) => {
    const r = L.rng('s05tile');
    // 3) pan-tile troughs (板瓦沟)
    q.fillStyle = '#b06c08'; a.pathBand(q, -HUMP, -(EAVE + 3)); q.fill();
    const hw = PITCH / 2 - HALF + 2.5;
    for (const th of mids) {
      a.at(q, th, 0, () => {
        // the tube to the left throws its shadow into the trough
        q.fillStyle = L.linear(q, -hw, 0, hw, 0, [[0, '#6e3e03'], [0.38, '#c07c0c'], [1, '#eaa91a']]);
        q.fillRect(-hw, HUMP, hw * 2, EAVE + 3 - HUMP);
        q.fillStyle = L.linear(q, 0, HUMP, 0, EAVE, [[0, 'rgba(255,232,150,0.55)'], [0.2, 'rgba(255,232,150,0)'], [0.7, 'rgba(50,22,0,0)'], [1, 'rgba(50,22,0,0.35)']]);
        q.fillRect(-hw, HUMP, hw * 2, EAVE + 3 - HUMP);
        q.lineCap = 'round';
        for (let y = HUMP + 7; y < EAVE - 2; y += 7.5) {
          q.strokeStyle = 'rgba(62,30,0,0.6)'; q.lineWidth = 1.5; q.beginPath(); q.moveTo(-hw, y - 2); q.quadraticCurveTo(0, y + 3.5, hw, y - 2); q.stroke();
          q.strokeStyle = 'rgba(255,220,120,0.4)'; q.lineWidth = 1; q.beginPath(); q.moveTo(-hw, y - 0.2); q.quadraticCurveTo(0, y + 5.3, hw, y - 0.2); q.stroke();
        }
        q.strokeStyle = 'rgba(255,238,170,0.85)'; q.lineWidth = 1.4; q.beginPath(); q.moveTo(-hw, HUMP + 0.7); q.lineTo(hw, HUMP + 0.7); q.stroke();
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
          [0, tint('#c0820c', tone)], [0.13, tint('#f6ba20', tone)], [0.3, '#fff2a8'], [0.42, tint('#fcc92e', tone)],
          [0.68, tint('#e9a818', tone)], [0.88, tint('#b6760a', tone)], [1, tint('#7a4a05', tone)]]);
        q.fill();
        q.save(); q.clip();
        // along its length: the roll-over at the top catches the sky, the eave end falls off
        q.fillStyle = L.linear(q, 0, -HUMP, 0, EAVE, [[0, 'rgba(255,250,214,0.9)'], [0.09, 'rgba(255,244,180,0.45)'], [0.26, 'rgba(255,244,180,0)'], [0.7, 'rgba(70,34,0,0)'], [1, 'rgba(70,34,0,0.28)']]);
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
        // rim light on the hump against the sky
        q.strokeStyle = 'rgba(255,252,222,0.95)'; q.lineWidth = 1.4;
        q.beginPath(); q.ellipse(0, HUMP, HALF - 0.7, HUMP * 2 - 0.7, 0, Math.PI * 1.04, Math.PI * 1.68); q.stroke();

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
        // the moulded dragon, as it reads from this distance: a coiled run of soft bumps inside the rim (no drawn glyph)
        q.save(); q.translate(0, cy); q.scale(0.8, 0.8);
        const bumps = DRAGON.map(([bx, by, br]) => [bx + r.range(-0.5, 0.5), by + r.range(-0.5, 0.5), br * r.range(0.85, 1.15)]);
        const coil = (ox, oy) => { q.beginPath(); bumps.forEach(([bx, by], k) => (k ? q.lineTo(bx + ox, by + oy) : q.moveTo(bx + ox, by + oy))); };
        q.lineCap = 'round'; q.lineJoin = 'round';
        q.strokeStyle = 'rgba(70,34,0,0.6)'; q.lineWidth = 4; coil(0.9, 1.1); q.stroke();
        q.strokeStyle = tint('#e2a81e', tone); q.lineWidth = 3.2; coil(0, 0); q.stroke();
        for (const [bx, by, br] of bumps) {
          q.fillStyle = L.radial(q, bx - br * 0.35, by - br * 0.4, 0.2, br * 1.15, [[0, '#fff6c8'], [0.45, tint('#f6c63a', tone)], [1, tint('#cf9416', tone)]]);
          q.beginPath(); q.arc(bx, by, br, 0, L.TAU); q.fill();
        }
        q.restore();
        q.strokeStyle = 'rgba(60,28,0,0.75)'; q.lineWidth = 1; q.beginPath(); q.arc(0, cy, DISC - 0.4, 0, L.TAU); q.stroke();
        q.strokeStyle = 'rgba(255,253,230,0.95)'; q.lineWidth = 1.4; q.beginPath(); q.arc(0, cy, DISC - 1.6, Math.PI * 1.02, Math.PI * 1.52); q.stroke();
      });
    }

    // 6) glaze mottling and a little grime — painted only onto what is already there, kept warm so the yellow stays clean
    q.globalCompositeOperation = 'source-atop';
    const tex = (opts) => L.noiseTex(RW, RH, { ...opts, ox: -PAD, oy: Y0, polar: opts.polar ? { cx: a.cx, cy: a.cy, R: a.R } : null });
    q.drawImage(tex({ seed: 's05glaze', polar: true, scale: 13, sx: 1, sy: 4.5, octaves: 4, contrast: 1.7, res: 0.5,
      ramp: [[0, 'rgba(130,62,0,0.3)'], [0.38, 'rgba(130,62,0,0)'], [0.64, 'rgba(255,246,196,0)'], [1, 'rgba(255,246,196,0.34)']] }), -PAD, Y0);
    q.drawImage(tex({ seed: 's05dirt', scale: 150, octaves: 4, warp: 0.8, res: 0.25, contrast: 1.6,
      ramp: [[0, 'rgba(110,50,4,0.3)'], [0.38, 'rgba(110,50,4,0)'], [1, 'rgba(110,50,4,0)']] }), -PAD, Y0);
    q.globalCompositeOperation = 'source-over';
  });
  // a final lift so the cap reads as one luminous yellow band (overlay through its own silhouette)
  const lift = L.makeLayer(PAD, (q) => {
    q.drawImage(glazed, -PAD, -PAD);
    q.globalCompositeOperation = 'source-in';
    q.fillStyle = '#ffe9a0'; q.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
  });
  const gq = glazed.getContext('2d');
  gq.globalCompositeOperation = 'overlay'; gq.globalAlpha = 0.3; gq.drawImage(lift, -PAD, -PAD);
  gq.globalCompositeOperation = 'source-over'; gq.globalAlpha = 1;
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
      g.globalCompositeOperation = 'multiply';
      g.drawImage(shadow, -PAD, -PAD);
      g.restore();
      g.drawImage(cap, -PAD, -PAD);
    });
    // a pale-gold copy of the cap, used as the mask for a travelling glint
    const glint = L.makeLayer(PAD, (g) => {
      g.drawImage(cap, -PAD, -PAD);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = '#fff4c0'; g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    });
    S = { sky: buildSky(env), wall, glint, scratch: L.makeCanvas(W, H) };
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
    sg.fillStyle = L.radial(sg, gp.x, gp.y, 0, 400, [[0, 'rgba(0,0,0,0.85)'], [0.4, 'rgba(0,0,0,0.4)'], [1, 'rgba(0,0,0,0)']]);
    sg.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.drawImage(S.scratch, 0, 0); ctx.restore();
  },
};
