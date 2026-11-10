// s17 — 旋子彩画. A macro view of Qing-style xuanzi caihua (旋子彩画) on a beam, bent onto the shared arc.
// Above the arc: deep vermilion lacquer with fine crackle (the tagline sits here).
// On the arc:    a raised, gilded line (沥粉贴金).
// Below:         the 箍头 band (石绿退晕 with a 连珠 strip), then the 藻头 — big 旋花 in the "一整二破" layout
//                (whole flowers flanked by half flowers hanging from the line), petals graded in three tones
//                (退晕) with white lines, gilded 旋眼 and 菱角地.
// Everything is built three times from the same geometry — colour, gold mask, height map — so the paint can be
// given real relief (bumpLight), gold-leaf texture, craquelure and flaked-off chips that follow the crack cells.
import * as L from '../lib/core.js';

const { W, H, TAU } = L;
const PAD = 240;
const FW = W + PAD * 2, FH = H + PAD * 2;
let S = null;

const RF = 178;                         // 旋花 radius
const HALO = 4.5;                       // white line (粉线) around every flower
const DR_L2 = -128;                     // lower edge of the 箍头 band: the line the half flowers hang from
const DR_W = DR_L2 - RF - HALO - 1.5;   // centre row of whole flowers

const COL = {
  blue: ['#12338e', '#3a6ccb', '#8db4ef'],    // 群青: deep / mid / light  (退晕三色阶)
  green: ['#07704e', '#2fa67a', '#8adcb2'],   // 石绿
  white: '#f3efe3', ink: '#131019', red: '#8e1f18',
};
const K3 = (c) => [c, c, c];
// gold is drawn BLACK in the colour pass and added afterwards from a gold-leaf texture through the mask pass
const PALS = {
  color: { goldLine: '#000', gold: '#000', white: COL.white, ink: COL.ink, blue: COL.blue, green: COL.green },
  mask: { goldLine: '#fff', gold: '#c6c6c6', white: '#000', ink: '#000', blue: K3('#000'), green: K3('#000') },
  height: { goldLine: '#f2f2f2', gold: '#868686', white: '#b8b8b8', ink: '#6c6c6c', blue: ['#7e7e7e', '#8c8c8c', '#9a9a9a'], green: ['#7e7e7e', '#8c8c8c', '#9a9a9a'] },
};

const disc = (g, x, y, r, fill) => { if (r <= 0) return; g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };

/** one ring of 旋瓣: overlapping round petals, each tucked under the next one (pinwheel), graded from the rim inward */
function petalRing(g, pal, cols, o) {
  const { n, rc, rho, lw, wl, bands, phase } = o;
  for (let i = 0; i < n; i++) {
    const a0 = phase + (i / n) * TAU, a1 = phase + ((i + 1) / n) * TAU;
    const x = Math.cos(a0) * rc, y = Math.sin(a0) * rc;
    const nx = Math.cos(a1) * rc, ny = Math.sin(a1) * rc;
    const m = Math.hypot(nx - x, ny - y), ux = (nx - x) / m, uy = (ny - y) / m;
    g.save();
    g.beginPath(); g.rect(-400, -400, 800, 800); g.arc(nx, ny, rho, 0, TAU); g.clip('evenodd');   // everything except the next petal
    disc(g, x, y, rho, pal.goldLine);               // 沥粉金线
    disc(g, x, y, rho - lw, pal.white);             // 白粉线
    // the three tones slide toward the hidden side so the halo is widest on the exposed edge
    const tone = (b, c) => disc(g, x + ux * b * 0.34, y + uy * b * 0.34, rho - lw - wl - b, c);
    tone(bands[0], cols[2]); tone(bands[1], cols[1]); tone(bands[2], cols[0]);
    g.restore();
  }
}

/** 旋眼: the gilded flower heart — a rim, six small petals and a boss, all in raised gesso */
function eye(g, pal, mode, RE) {
  disc(g, 0, 0, RE + 4.5, pal.white);
  disc(g, 0, 0, RE + 0.5, pal.goldLine);
  disc(g, 0, 0, RE - 4.5, pal.gold);
  const n = 6, pr = RE * 0.27, pc = RE * 0.52;
  for (let i = 0; i <= n; i++) {
    const last = i === n;
    const ang = (i / n) * TAU - Math.PI / 2;
    const x = last ? 0 : Math.cos(ang) * pc, y = last ? 0 : Math.sin(ang) * pc, r = last ? RE * 0.25 : pr;
    if (mode === 'height') {
      g.fillStyle = L.radial(g, x, y, 0, r, [[0, '#ffffff'], [0.7, '#cfcfcf'], [1, '#8c8c8c']]);
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    } else if (mode === 'mask') {
      disc(g, x, y, r, '#fff');
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
    }
  }
}

function flowerSprite(mode, outer, inner) {
  const pal = PALS[mode];
  const sz = Math.ceil(2 * (RF + HALO + 3));
  const c = L.makeCanvas(sz, sz), g = c.getContext('2d');
  g.translate(sz / 2, sz / 2);
  disc(g, 0, 0, RF + HALO, pal.white);
  disc(g, 0, 0, RF, pal.goldLine);
  disc(g, 0, 0, RF - 5, pal.gold);                 // 菱角地: the gilded triangles left between the petals
  petalRing(g, pal, pal[outer], { n: 12, rc: RF - 5 - 58, rho: 58, lw: 3, wl: 4.2, bands: [0, 9, 20], phase: -Math.PI / 2 });   // 头路瓣
  const R2 = 104;
  disc(g, 0, 0, R2 + 3.5, pal.goldLine);
  disc(g, 0, 0, R2, pal.gold);
  petalRing(g, pal, pal[inner], { n: 8, rc: R2 - 40, rho: 40, lw: 2.6, wl: 3.4, bands: [0, 7, 15], phase: -Math.PI / 2 + Math.PI / 8 }); // 二路瓣
  eye(g, pal, mode, 45);
  return c;
}

/**
 * "一整二破": whole flowers on the centre row, half flowers hanging from the edge line, every circle touching its
 * neighbours. The packing is a hexagonal lattice in log-polar space, so it stays tight when wrapped onto the arc
 * (flowers on inner rows are proportionally smaller).
 */
function lattice(env) {
  const a = env.arc;
  const rT = a.R + DR_L2, RW = RF + HALO + 0.5;
  const kap = -0.5 * Math.log(1 - (2 * RW) / rT);
  const P = 2 * Math.sqrt(3) * kap;
  const e1 = Math.exp(-kap), e3 = Math.exp(-3 * kap);
  const rows = {
    W: { dr: DR_L2 - RW, rad: RW },
    T: { dr: DR_L2, rad: rT * (1 - e1) },
    B: { dr: (rT * (e1 + e3)) / 2 - a.R, rad: (rT * (e1 - e3)) / 2 },
  };
  const reach = Math.asin(L.clamp((W / 2 + PAD + RF + 40) / (a.R + rows.B.dr), -1, 1)) + P;
  const K = Math.ceil(reach / P);
  const out = [];
  for (let k = -K; k <= K; k++) {
    for (const kind of ['B', 'W', 'T']) {
      const r = rows[kind];
      out.push({ kind, theta: (kind === 'W' ? k : k + 0.5) * P, dr: r.dr, rad: r.rad, sc: (r.rad - 0.5) / (RF + HALO) });
    }
  }
  return out;
}

/** the gilded ground left between the circles, shrunk by `inset` px → lets us run a raised line just inside every gap */
function gapInset(env, lat, inset, color) {
  const a = env.arc;
  return L.makeLayer(PAD, (g) => {
    a.fillBelow(g, color, DR_L2 - inset);
    g.globalCompositeOperation = 'destination-out';
    for (const f of lat) { const p = a.pt(f.theta, f.dr); g.beginPath(); g.arc(p.x, p.y, f.rad + inset, 0, TAU); g.fill(); }
  });
}

function bead(g, mode) {
  const r = 12.5;
  if (mode === 'color') {
    disc(g, 0, 0, r, COL.blue[2]);
    disc(g, 0.6, 0.6, r - 2.2, COL.blue[1]);
    disc(g, 1.6, 1.6, r - 5, COL.blue[0]);
    disc(g, -3.6, -3.6, 2.6, COL.white);
  } else if (mode === 'height') {
    g.fillStyle = L.radial(g, 0, 0, 0, r, [[0, '#e8e8e8'], [0.65, '#b4b4b4'], [1, '#6c6c6c']]);
    g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  }
}

/** the whole painted surface below the arc, in one of the three passes */
function geometry(g, env, mode, spr, lat) {
  const a = env.arc, pal = PALS[mode];
  const s = a.span(PAD + 200);
  a.fillBelow(g, pal.gold, DR_L2 + 2);                              // gilded ground between the flowers (菱角地)
  if (mode !== 'color') {
    g.drawImage(gapInset(env, lat, 6.5, pal.goldLine), -PAD, -PAD);
    g.drawImage(gapInset(env, lat, 10, pal.gold), -PAD, -PAD);
  }
  const half = spr.W.width / 2;
  const stamp = (f) => a.at(g, f.theta, f.dr, () => { g.scale(f.sc, f.sc); g.drawImage(f.kind === 'W' ? spr.W : spr.T, -half, -half); });
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  for (const f of lat) if (f.kind !== 'T') stamp(f);
  g.save(); a.clipBelow(g, DR_L2 + 2);
  for (const f of lat) if (f.kind === 'T') stamp(f);
  g.restore();
  // 箍头 band, painted top-down (each fill runs to the band's lower edge so no seams show)
  const G = pal.green;
  const stack = [
    [0, pal.goldLine],                                              // the arc itself: 沥粉贴金大线
    [-17, pal.white], [-22, G[2]], [-30, G[1]], [-38, G[0]],
    [-48, pal.goldLine], [-51.5, pal.ink],                          // 连珠带
    [-83.5, pal.goldLine], [-87, G[0]], [-97, G[1]], [-105, G[2]],
    [-113, pal.white], [-118.5, pal.goldLine],
  ];
  for (const [d0, c] of stack) a.fillBand(g, c, d0, DR_L2, -s, s);
  if (mode !== 'mask') a.along({ spacing: 30.5, dr: -67.5, t0: -s, t1: s }, (q) => a.at(g, q.theta, -67.5, () => bead(g, mode)));
}

/** Worley cells that report the distance (in px) to the nearest cell wall, also for stretched cells → even hairlines */
function makeCells(seed) {
  const r = L.rng(seed);
  const perm = new Uint8Array(512), jx = new Float32Array(256), jy = new Float32Array(256);
  const p0 = []; for (let i = 0; i < 256; i++) p0.push(i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p0[i]; p0[i] = p0[j]; p0[j] = t; }
  for (let i = 0; i < 512; i++) perm[i] = p0[i & 255];
  for (let i = 0; i < 256; i++) { jx[i] = 0.1 + 0.8 * r(); jy[i] = 0.1 + 0.8 * r(); }
  const o = { edge: 0, id: 0 };
  return (x, y, sx, sy) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    let d1 = 1e9, d2 = 1e9, ax = 0, ay = 0, bx = 0, by = 0, id = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const cx = xi + ox, cy = yi + oy;
      const h = perm[(cx & 255) + perm[cy & 255]];
      const fx = cx + jx[h] - x, fy = cy + jy[h] - y;
      const d = fx * fx + fy * fy;
      if (d < d1) { d2 = d1; bx = ax; by = ay; d1 = d; ax = fx; ay = fy; id = h; } else if (d < d2) { d2 = d; bx = fx; by = fy; }
    }
    const nx = (bx - ax) / sx, ny = (by - ay) / sy;
    o.edge = (d2 - d1) / (2 * Math.sqrt(nx * nx + ny * ny) + 1e-9);
    o.id = id / 255;
    return o;
  };
}

/**
 * One per-pixel pass (reduced resolution) for the ageing: `crack` = craquelure hairlines, `chip` = whole crack cells
 * of paint that have fallen off. The lacquer above the arc gets long cracks running with the beam (断纹);
 * the paint gets a polygonal net with finer crazing in patches.
 */
function buildFields(env) {
  const a = env.arc, res = 0.6;
  const w = Math.round(FW * res), h = Math.round(FH * res);
  const nz = L.makeNoise('s17field');
  const cellA = makeCells('s17a'), cellB = makeCells('s17b');
  const ck = new ImageData(w, h), cp = new ImageData(w, h);
  const cd = ck.data, pd = cp.data;
  const ss = (e0, e1, x) => { const t = L.clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
  let i = 0;
  for (let y = 0; y < h; y++) {
    const py = y / res - PAD;
    for (let x = 0; x < w; x++, i += 4) {
      const px = x / res - PAD;
      const ddx = px - a.cx, ddy = a.cy - py;
      const v = a.R - Math.sqrt(ddx * ddx + ddy * ddy);        // > 0 below the arc
      const u = Math.atan2(ddx, ddy) * a.R;
      const wx = nz.n2(u / 190, v / 190), wy = nz.n2(u / 190 + 31.7, v / 190 - 12.3);
      const fade = 0.55 + 0.45 * nz.n2(u / 130 + 3.1, v / 130 + 7.9);
      let line = 0, chip = 0;
      if (v < -1) {
        let c = cellA(u / 340 + wx * 0.07, v / 66 + wy * 0.14, 340, 66);
        const l1 = 1 - ss(0.45, 1.5, c.edge);
        c = cellB(u / 120 + wx * 0.16 + 7.7, v / 34 + wy * 0.22 + 3.3, 120, 34);
        const patch = ss(0.05, 0.5, nz.n2(u / 430 + 5, v / 430 + 9));
        line = Math.max(l1 * 0.9, (1 - ss(0.4, 1.3, c.edge)) * 0.5 * patch) * fade;
      } else {
        let c = cellA(u / 92 + wx * 0.14, v / 92 + wy * 0.14, 92, 92);
        const l1 = 1 - ss(0.5, 1.7, c.edge);
        c = cellB(u / 27 + wx * 0.3 + 4.1, v / 27 + wy * 0.3 + 8.8, 27, 27);
        const m = nz.fbm(u / 300 + 11, v / 300 + 3, 3);
        const patch = ss(-0.25, 0.3, m);
        line = Math.max(l1 * 0.9, (1 - ss(0.4, 1.3, c.edge)) * 0.5 * patch) * fade;
        // chips: clusters of small crack cells; spare the hero flower under the crest and the gold line on the arc
        const hero = Math.exp(-(u * u) / (300 * 300)) * 0.3;
        if (v > 26 && m + (c.id - 0.5) * 0.7 > 0.6 + hero) chip = 1;
      }
      cd[i + 3] = line * 255;
      pd[i] = pd[i + 1] = pd[i + 2] = 255; pd[i + 3] = chip * 255;
    }
  }
  const crack = L.makeCanvas(w, h); crack.getContext('2d').putImageData(ck, 0, 0);
  const chip = L.makeCanvas(w, h); chip.getContext('2d').putImageData(cp, 0, 0);
  return { crack, chip };
}

function tinted(src, color) {
  const c = L.makeCanvas(src.width, src.height), g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  return c;
}

const RS = 390;   // radius of the travelling light

function build(env) {
  const a = env.arc;
  const lat = lattice(env);
  const spr = {};
  for (const m of ['color', 'mask', 'height']) spr[m] = { W: flowerSprite(m, 'blue', 'green'), T: flowerSprite(m, 'green', 'blue') };
  const F = buildFields(env);
  const fld = (g, c, alpha = 1) => { g.save(); g.globalAlpha = alpha; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(c, -PAD, -PAD, FW, FH); g.restore(); };
  const lay = (g, c, blend, alpha = 1, dx = 0, dy = 0) => { g.save(); g.globalCompositeOperation = blend; g.globalAlpha = alpha; g.drawImage(c, -PAD + dx, -PAD + dy); g.restore(); };
  const all = (g, style) => { g.fillStyle = style; g.fillRect(-PAD, -PAD, FW, FH); };

  // shared textures
  const mott = L.polarNoiseLayer(env, PAD, { seed: 's17mott', scale: 64, octaves: 4, warp: 0.6, contrast: 1.6, res: 0.3 });
  const dirt = L.noiseLayer(PAD, { seed: 's17dirt', scale: 340, octaves: 4, warp: 0.7, res: 0.2, contrast: 1.5, ramp: [[0, '#5d4a2c'], [0.42, '#d6c9ae'], [0.68, '#ffffff'], [1, '#ffffff']] });
  const gran = L.noiseLayer(PAD, { seed: 's17gran', scale: 5.5, octaves: 2, contrast: 2.3, res: 0.5 });
  const streak = L.polarNoiseLayer(env, PAD, { seed: 's17streak', scale: 9, sx: 14, sy: 1, octaves: 3, contrast: 1.7, res: 0.5 });

  // gold mask (white = gold) — cracks and chips eat into the leaf too
  const msk = L.makeLayer(PAD, (g) => {
    all(g, '#000');
    geometry(g, env, 'mask', spr.mask, lat);
    fld(g, F.crack, 0.45); fld(g, tinted(F.chip, '#000'), 1);
  });
  // height map: gesso lines high, paint layers stepped, cracks and chips cut in, a little tooth everywhere
  const hgt = L.makeLayer(PAD, (g) => {
    all(g, '#666');
    geometry(g, env, 'height', spr.height, lat);
    g.save(); a.clipBelow(g, 0); lay(g, gran, 'overlay', 0.16); g.restore();
    fld(g, F.crack, 0.22);
    g.save(); a.clipBelow(g, 0); fld(g, F.crack, 0.36); g.restore();
    fld(g, tinted(F.chip, '#2e2e2e'), 1);
  });
  const bump = L.bumpLight(hgt, { angle: 45, strength: 1.5, blur: 0.8, res: 0.6 });

  // gold leaf: warm mottled metal, worn through to the red bole here and there
  const gold = L.noiseLayer(PAD, { seed: 's17gold', scale: 36, octaves: 4, warp: 0.8, contrast: 1.4, res: 0.35,
    ramp: [[0, '#8f5510'], [0.2, '#c48a1c'], [0.45, '#e3b341'], [0.7, '#f6d262'], [1, '#fff0a8']] });
  {
    const g = gold.getContext('2d');
    g.drawImage(L.noiseLayer(PAD, { seed: 's17bole', scale: 120, octaves: 4, warp: 0.9, contrast: 1.7, res: 0.25,
      ramp: [[0, 'rgba(122,44,20,0.75)'], [0.13, 'rgba(122,44,20,0.3)'], [0.2, 'rgba(122,44,20,0)'], [1, 'rgba(122,44,20,0)']] }), 0, 0);
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.45; g.drawImage(gran, 0, 0);
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 1;
    g.fillStyle = L.radial(g, 800 + PAD, 640 + PAD, 0, 1350, [[0, '#ffffff'], [0.4, '#f0dfb4'], [1, '#a87a3a']]); g.fillRect(0, 0, FW, FH);
    g.drawImage(msk, 0, 0);
  }
  // exposed ground (地仗) where paint has flaked away
  const chipL = L.makeLayer(PAD, (g) => {
    all(g, '#b3a283');
    lay(g, mott, 'multiply', 0.5); lay(g, gran, 'soft-light', 0.6);
    g.globalCompositeOperation = 'destination-in'; fld(g, F.chip, 1);
  });
  const shadow = L.filtered(msk, 'invert(1) blur(3.5px)');

  const col = L.makeLayer(PAD, (g) => {
    // vermilion lacquer above the arc
    all(g, L.radial(g, a.cx, a.cy, a.R, a.R + 900, [[0, '#5a110c'], [0.03, '#761913'], [0.11, '#801b15'], [0.5, '#7a1913'], [1, '#63130e']]));
    geometry(g, env, 'color', spr.color, lat);
    // mineral pigment: mottled, granular, brushed along the beam, dusty
    g.save(); a.clipBelow(g, 0);
    lay(g, mott, 'soft-light', 0.34); lay(g, gran, 'soft-light', 0.5); lay(g, streak, 'soft-light', 0.2); lay(g, dirt, 'multiply', 0.3);
    g.restore();
    g.save(); a.clipAbove(g, 0);
    lay(g, mott, 'soft-light', 0.2); lay(g, streak, 'soft-light', 0.1); lay(g, dirt, 'multiply', 0.18);
    // a broad, soft gloss high on the lacquer (well above the tagline)
    g.globalCompositeOperation = 'soft-light';
    all(g, L.radial(g, a.cx, a.cy, a.R + 300, a.R + 620, [[0, 'rgba(255,220,200,0)'], [0.5, 'rgba(255,220,200,0.2)'], [1, 'rgba(255,220,200,0)']]));
    g.restore();
    fld(g, F.crack, 0.62);
    lay(g, shadow, 'multiply', 0.55, 3, 4);           // the raised gold throws a small shadow onto the paint
    lay(g, gold, 'lighter', 1);
    // the big line on the arc keeps most of its leaf: a clean bright bead of gold with a specular ridge
    g.save(); g.globalCompositeOperation = 'screen'; g.lineCap = 'butt';
    g.strokeStyle = 'rgba(255,214,110,0.38)'; g.lineWidth = 13; a.stroke(g, -8.5);
    g.strokeStyle = 'rgba(255,246,206,0.55)'; g.lineWidth = 2.6; a.stroke(g, -4.5);
    g.restore();
    g.drawImage(chipL, -PAD, -PAD);
    lay(g, bump, 'hard-light', 0.75);
    // light: raking from the upper left, falling off toward the lower corners
    g.save(); a.clipBelow(g, 0);
    g.globalCompositeOperation = 'soft-light';
    all(g, L.radial(g, 800, 620, 0, 1250, [[0, 'rgba(255,244,214,0.46)'], [0.45, 'rgba(255,244,214,0.1)'], [1, 'rgba(0,0,0,0.42)']]));
    g.globalCompositeOperation = 'multiply';
    all(g, L.radial(g, a.cx, a.cy, a.R - 640, a.R - 200, [[0, 'rgba(60,40,30,0.5)'], [1, 'rgba(60,40,30,0)']]));
    g.restore();
    g.save(); a.clipAbove(g, 0);
    g.globalCompositeOperation = 'multiply';
    all(g, L.linear(g, 0, -PAD, 0, a.crestY, [[0, 'rgba(40,6,4,0.55)'], [0.55, 'rgba(40,6,4,0.12)'], [1, 'rgba(40,6,4,0)']]));
    g.restore();
    lay(g, L.grainTex(FW, FH, { seed: 17, amount: 0.3 }), 'overlay', 0.45);
    // vignette baked in (it only ever shifts by a few px with the camera)
    const rad = Math.hypot(W / 2, H / 2);
    all(g, L.radial(g, W / 2, H / 2, rad * 0.5, rad * 1.1, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.34)']]));
  });

  // glints: only the gold answers the travelling light
  const hi = L.noiseLayer(PAD, { seed: 's17spark', scale: 8, octaves: 2, contrast: 2.8, res: 0.5,
    ramp: [[0, '#1c1202'], [0.5, '#4a330a'], [0.78, '#e2ac40'], [1, '#fff6d2']] });
  { const g = hi.getContext('2d'); g.globalCompositeOperation = 'multiply'; g.drawImage(msk, 0, 0); }

  const tmp = L.makeCanvas(RS * 2, RS * 2), tg = tmp.getContext('2d');
  const spot = L.radial(tg, RS, RS, 0, RS, [[0, '#fff'], [0.3, '#b0b0b0'], [0.7, '#333'], [1, '#000']]);
  // star glints sit on gilded ridges: the big line on the arc, the second line, flower hearts
  const stars = [];
  const sr = L.rng('s17stars');
  for (const th of [-0.262, -0.171, -0.104, -0.037, 0.021, 0.083]) { const q = a.pt(th + sr.range(-0.012, 0.012), -5); stars.push({ x: q.x, y: q.y, len: sr.range(20, 34), ph: sr.range(0, TAU) }); }
  for (const th of [-0.2, -0.06, 0.05]) { const q = a.pt(th, DR_L2 + 5); stars.push({ x: q.x, y: q.y, len: sr.range(13, 20), ph: sr.range(0, TAU) }); }
  for (const f of lat) if (f.kind !== 'B' && Math.abs(f.theta) < 0.4) { const q = a.pt(f.theta - 12 / a.R, f.dr - (f.kind === 'T' ? 22 : -14)); stars.push({ x: q.x, y: q.y, len: sr.range(14, 22), ph: sr.range(0, TAU) }); }
  return { main: L.filtered(col, 'saturate(1.24) contrast(1.06)'), hi, tmp, tg, spot, stars };
}

export default {
  name: '旋子彩画',
  tone: 'light',
  init(env) { S = build(env); },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.006, 0.006, p), zoom = L.lerp(1.0, 1.02, p);
    L.blit(ctx, env, S.main, { rot, zoom });
    // a light travels along the beam; the gold leaf flashes as it passes
    const q = a.pt(L.lerp(-0.2, 0.05, p), -60);
    const tg = S.tg;
    tg.setTransform(1, 0, 0, 1, 0, 0);
    tg.translate(RS - q.x, RS - q.y);
    L.blit(tg, env, S.hi, { rot, zoom, blend: 'copy' });
    tg.setTransform(1, 0, 0, 1, 0, 0);
    tg.globalCompositeOperation = 'multiply'; tg.fillStyle = S.spot; tg.fillRect(0, 0, RS * 2, RS * 2);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(S.tmp, q.x - RS, q.y - RS); ctx.restore();
    // a few star glints where the light catches a ridge of leaf
    L.cam(ctx, env, { rot, zoom }, () => {
      ctx.globalCompositeOperation = 'lighter';
      for (const sp of S.stars) {
        const d = Math.hypot(sp.x - q.x, sp.y - q.y);
        const k = L.clamp(1 - d / (RS * 1.05)) * (0.6 + 0.4 * Math.sin(sp.ph + env.frame * 2.1));
        if (k <= 0.03) continue;
        const len = sp.len * (0.55 + 0.6 * k);
        ctx.save(); ctx.translate(sp.x, sp.y); ctx.rotate(0.38);
        for (let j = 0; j < 2; j++) {
          ctx.fillStyle = L.linear(ctx, -len, 0, len, 0, [[0, 'rgba(255,236,170,0)'], [0.5, `rgba(255,248,214,${(0.95 * k).toFixed(3)})`], [1, 'rgba(255,236,170,0)']]);
          ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(0, -1.5); ctx.lineTo(len, 0); ctx.lineTo(0, 1.5); ctx.closePath(); ctx.fill();
          ctx.rotate(Math.PI / 2);
        }
        ctx.fillStyle = L.radial(ctx, 0, 0, 0, len * 0.45, [[0, `rgba(255,250,225,${(0.9 * k).toFixed(3)})`], [0.25, `rgba(255,224,140,${(0.4 * k).toFixed(3)})`], [1, 'rgba(255,210,110,0)']]);
        ctx.fillRect(-len, -len, len * 2, len * 2);
        ctx.restore();
      }
    });
  },
};
