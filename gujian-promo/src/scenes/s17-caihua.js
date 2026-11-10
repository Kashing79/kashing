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
  blue: ['#14388f', '#3f6fc8', '#86ade8'],    // 群青: deep / mid / light  (退晕三色阶)
  green: ['#0b7252', '#35a57c', '#88d8b0'],   // 石绿
  white: '#f3efe3', ink: '#131019', red: '#8e1f18',
};
const K3 = (c) => [c, c, c];
// gold is drawn BLACK in the colour pass and added afterwards from a gold-leaf texture through the mask pass
const PALS = {
  color: { goldLine: '#000', gold: '#000', white: COL.white, ink: COL.ink, blue: COL.blue, green: COL.green },
  mask: { goldLine: '#fff', gold: '#b4b4b4', white: '#000', ink: '#000', blue: K3('#000'), green: K3('#000') },
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
  petalRing(g, pal, pal[outer], { n: 10, rc: RF - 5 - 50, rho: 50, lw: 3, wl: 4.2, bands: [0, 9.5, 20], phase: -Math.PI / 2 });   // 头路瓣
  const R2 = 104;
  disc(g, 0, 0, R2 + 3.5, pal.goldLine);
  disc(g, 0, 0, R2, pal.gold);
  petalRing(g, pal, pal[inner], { n: 8, rc: R2 - 33, rho: 33, lw: 2.6, wl: 3.4, bands: [0, 7, 14.5], phase: -Math.PI / 2 + Math.PI / 8 }); // 二路瓣
  eye(g, pal, mode, 45);
  return c;
}

/** "一整二破": whole flowers on the centre row, half flowers on the edge line, every circle touching its neighbours */
function lattice(env) {
  const a = env.arc;
  const r1 = a.R + DR_W, rT = a.R + DR_L2, d = 2 * (RF + HALO) + 1;
  const c = (r1 * r1 + rT * rT - d * d) / (2 * r1 * rT);
  const P = 2 * Math.acos(c);
  const rB = r1 * c - Math.sqrt(Math.max(0, r1 * r1 * c * c - r1 * r1 + d * d));
  const reach = Math.asin(L.clamp((W / 2 + PAD + RF + 40) / rB, -1, 1)) + P;
  const K = Math.ceil(reach / P);
  const out = [];
  for (let k = -K; k <= K; k++) {
    out.push({ kind: 'W', theta: k * P, dr: DR_W });
    out.push({ kind: 'T', theta: (k + 0.5) * P, dr: DR_L2 });
    out.push({ kind: 'B', theta: (k + 0.5) * P, dr: rB - a.R });
  }
  return out;
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
  a.fillBelow(g, pal.gold, DR_L2 + 2);                              // gilded ground between the flowers
  const half = spr.W.width / 2;
  for (const f of lat) if (f.kind !== 'T') a.at(g, f.theta, f.dr, () => g.drawImage(f.kind === 'W' ? spr.W : spr.T, -half, -half));
  g.save(); a.clipBelow(g, DR_L2 + 2);
  for (const f of lat) if (f.kind === 'T') a.at(g, f.theta, f.dr, () => g.drawImage(spr.T, -half, -half));
  g.restore();
  // 箍头 band, painted top-down (each fill runs to the band's lower edge so no seams show)
  const G = pal.green;
  const stack = [
    [0, pal.goldLine],                                              // the arc itself: 沥粉贴金大线
    [-14, pal.white], [-19.5, G[2]], [-28, G[1]], [-36.5, G[0]],
    [-47, pal.goldLine], [-50.5, pal.ink],                          // 连珠带
    [-82.5, pal.goldLine], [-86, G[0]], [-96.5, G[1]], [-105, G[2]],
    [-113.5, pal.white], [-119, pal.goldLine],
  ];
  for (const [d0, c] of stack) a.fillBand(g, c, d0, DR_L2, -s, s);
  if (mode !== 'mask') a.along({ spacing: 30.5, dr: -66.5, t0: -s, t1: s }, (q) => a.at(g, q.theta, -66.5, () => bead(g, mode)));
}

/**
 * One per-pixel pass (half resolution) for the ageing: `crack` = craquelure lines, `chip` = whole crack cells of
 * paint that have fallen off. Lacquer above the arc gets long, lazy cracks; the paint gets a mud-crack net.
 */
function buildFields(env) {
  const a = env.arc, res = 0.5;
  const w = Math.round(FW * res), h = Math.round(FH * res);
  const nz = L.makeNoise('s17field');
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
      let line = 0, chip = 0;
      if (v < -1) {
        const c1 = nz.cell(u / 170 + wx * 0.5, v / 62 + wy * 0.5);
        const c2 = nz.cell(u / 66 + wx * 0.8 + 7.7, v / 30 + wy * 0.8 + 3.3);
        const patch = ss(-0.2, 0.35, nz.n2(u / 430 + 5, v / 430 + 9));
        line = Math.max((1 - ss(0, 0.034, c1.edge)) * 0.8, (1 - ss(0, 0.07, c2.edge)) * 0.45 * patch);
      } else {
        const c1 = nz.cell(u / 84 + wx * 0.45, v / 84 + wy * 0.45);
        const c2 = nz.cell(u / 27 + wx + 4.1, v / 27 + wy + 8.8);
        const m = nz.fbm(u / 300 + 11, v / 300 + 3, 3);
        const patch = ss(-0.3, 0.3, m);
        line = Math.max((1 - ss(0, 0.05, c1.edge)) * 0.9, (1 - ss(0, 0.13, c2.edge)) * 0.5 * patch);
        // chips: clusters of small crack cells; spare the hero flower under the crest and the gold line on the arc
        const hero = Math.exp(-(u * u) / (270 * 270)) * 0.3;
        if (v > 24 && m + (c2.id - 0.5) * 0.7 > 0.5 + hero) chip = 1;
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
  const chipBlack = tinted(F.chip, '#000');
  const msk = L.makeLayer(PAD, (g) => {
    all(g, '#000');
    geometry(g, env, 'mask', spr.mask, lat);
    fld(g, F.crack, 0.5); fld(g, chipBlack, 1);
  });
  // height map: gesso lines high, paint layers stepped, cracks and chips cut in, a little tooth everywhere
  const hgt = L.makeLayer(PAD, (g) => {
    all(g, '#666');
    geometry(g, env, 'height', spr.height, lat);
    lay(g, gran, 'overlay', 0.22); lay(g, mott, 'soft-light', 0.25);
    fld(g, F.crack, 0.85); fld(g, tinted(F.chip, '#2e2e2e'), 1);
  });
  const bump = L.bumpLight(hgt, { angle: 45, strength: 1.5, blur: 1, res: 0.6 });

  // gold leaf: warm mottled metal, worn through to the red bole here and there
  const gold = L.noiseLayer(PAD, { seed: 's17gold', scale: 36, octaves: 4, warp: 0.8, contrast: 1.5, res: 0.35,
    ramp: [[0, '#7a4310'], [0.22, '#b47c1e'], [0.5, '#e3b341'], [0.78, '#f3cf66'], [1, '#ffeaa0']] });
  {
    const g = gold.getContext('2d');
    g.drawImage(L.noiseLayer(PAD, { seed: 's17bole', scale: 120, octaves: 4, warp: 0.9, contrast: 1.7, res: 0.25,
      ramp: [[0, 'rgba(122,44,20,0.85)'], [0.24, 'rgba(122,44,20,0.5)'], [0.36, 'rgba(122,44,20,0)'], [1, 'rgba(122,44,20,0)']] }), 0, 0);
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.5; g.drawImage(gran, 0, 0);
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 1; g.drawImage(msk, 0, 0);
  }
  // exposed ground (地仗) where paint has flaked away
  const chipL = L.makeLayer(PAD, (g) => {
    all(g, '#b7a686');
    lay(g, mott, 'multiply', 0.5); lay(g, gran, 'soft-light', 0.6);
    g.globalCompositeOperation = 'destination-in'; fld(g, F.chip, 1);
  });
  const shadow = L.filtered(msk, 'invert(1) blur(3.5px)');

  const col = L.makeLayer(PAD, (g) => {
    // vermilion lacquer above the arc
    all(g, L.radial(g, a.cx, a.cy, a.R, a.R + 900, [[0, '#64130e'], [0.03, '#821c16'], [0.12, '#8e1f18'], [0.5, '#871d16'], [1, '#701711']]));
    geometry(g, env, 'color', spr.color, lat);
    // mineral pigment: mottled, granular, brushed along the beam, dusty
    g.save(); a.clipBelow(g, 0);
    lay(g, mott, 'soft-light', 0.55); lay(g, gran, 'soft-light', 0.55); lay(g, streak, 'soft-light', 0.28); lay(g, dirt, 'multiply', 0.5);
    g.restore();
    g.save(); a.clipAbove(g, 0);
    lay(g, mott, 'soft-light', 0.3); lay(g, streak, 'soft-light', 0.3); lay(g, dirt, 'multiply', 0.22);
    g.restore();
    fld(g, F.crack, 0.62);
    lay(g, shadow, 'multiply', 0.55, 3, 4);           // the raised gold throws a small shadow onto the paint
    lay(g, gold, 'lighter', 1);
    g.drawImage(chipL, -PAD, -PAD);
    lay(g, bump, 'hard-light', 0.78);
    // light: raking from the upper left, falling off toward the lower corners
    g.save(); a.clipBelow(g, 0);
    g.globalCompositeOperation = 'soft-light';
    all(g, L.radial(g, 760, 600, 0, 1250, [[0, 'rgba(255,244,214,0.5)'], [0.5, 'rgba(255,244,214,0.12)'], [1, 'rgba(0,0,0,0.35)']]));
    g.globalCompositeOperation = 'multiply';
    all(g, L.radial(g, a.cx, a.cy, a.R - 620, a.R - 180, [[0, 'rgba(60,40,30,0.55)'], [1, 'rgba(60,40,30,0)']]));
    g.restore();
    g.save(); a.clipAbove(g, 0);
    g.globalCompositeOperation = 'multiply';
    all(g, L.linear(g, 0, -PAD, 0, a.crestY, [[0, 'rgba(40,6,4,0.55)'], [0.55, 'rgba(40,6,4,0.12)'], [1, 'rgba(40,6,4,0)']]));
    g.restore();
    lay(g, L.grainTex(FW, FH, { seed: 17, amount: 0.3 }), 'overlay', 0.5);
  });

  // glints: only the gold answers the travelling light
  const hi = L.noiseLayer(PAD, { seed: 's17spark', scale: 8, octaves: 2, contrast: 2.8, res: 0.5,
    ramp: [[0, '#000'], [0.5, '#2a1c04'], [0.78, '#e2ac40'], [1, '#fff6d2']] });
  { const g = hi.getContext('2d'); g.globalCompositeOperation = 'multiply'; g.drawImage(msk, 0, 0); }

  const tmp = L.makeCanvas(W, H);
  return { main: L.filtered(col, 'saturate(1.14) contrast(1.05)'), hi, tmp, tg: tmp.getContext('2d') };
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
    const q = a.pt(L.lerp(-0.2, 0.05, p), -40);
    const tg = S.tg;
    tg.setTransform(1, 0, 0, 1, 0, 0);
    tg.globalCompositeOperation = 'source-over'; tg.fillStyle = '#000'; tg.fillRect(0, 0, W, H);
    L.blit(tg, env, S.hi, { rot, zoom });
    tg.globalCompositeOperation = 'multiply';
    tg.fillStyle = L.radial(tg, q.x, q.y, 0, 640, [[0, '#fff'], [0.3, '#aaa'], [0.7, '#333'], [1, '#000']]);
    tg.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.9; ctx.drawImage(S.tmp, 0, 0); ctx.restore();
    ctx.save(); a.clipBelow(ctx, 0);
    L.glow(ctx, q.x, q.y, 560, '#fff0c4', 0.16, 'soft-light');
    ctx.restore();
    L.vignette(ctx, { strength: 0.3 });
  },
};
