// s05 — 珊瑚红撞松石绿. Six frames, two colours: straight down onto the far rim of a coral-red (珊瑚红) glazed dish
// lying on a flat turquoise (松石绿) ground. The arc is the lip, carrying a hairline of gilding (描金).
//
// Everything below the arc is shaded per pixel once in init(): the blown glaze (吹釉) is a fine, even mist of
// droplets — two scales of soft stipple plus a slow cloudiness — over a ramp that is brightest where the wall
// rises to the lip and deepens toward the well; one pale, soft reflection runs concentric with the rim.
// The gilt line has a rounded cross-section (olive where it mirrors the turquoise ground, a broken highlight
// along its crown, thinner and warmer where the brush ran dry). draw() only slides that layer a few pixels
// round the circle and lets the glints on the gold breathe.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 80;          // the slide is ±11 px along the arc: a small margin is plenty
let S = null;

const sstep = (a, b, v) => { const t = v <= a ? 0 : v >= b ? 1 : (v - a) / (b - a); return t * t * (3 - 2 * t); };

// ── allocation-free worley noise: squared distance to the nearest point in cD1, two ids for that cell in cId / cId2 ──
let cD1 = 0, cId = 0, cId2 = 0;
function cell(x, y, salt) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let d1 = 9, id = 0;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const cx = xi + ox, cy = yi + oy;
    let h = (Math.imul(cx, 374761393) + Math.imul(cy, 668265263) + salt) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    const dx = cx + (h & 1023) / 1023 - x, dy = cy + ((h >>> 10) & 1023) / 1023 - y, d = dx * dx + dy * dy;
    if (d < d1) { d1 = d; id = h; }
  }
  cD1 = d1; cId = ((id >>> 20) & 255) / 255; cId2 = ((id >>> 28) & 15) / 15;
}

function lut(stops, n = 512) {
  const f = L.makeRamp(stops), out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const c = f(i / (n - 1)); out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2]; }
  return out;
}
const rgb = (c) => L.parseColor(c);

/** the dish: gilt lip + coral-red glaze, everything under the arc. Returns { cnv, x0, y0 } in frame coordinates. */
function buildDish(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const X0 = -PAD, Y0 = Math.floor(a.crestY) - 3;
  const RW = W + PAD * 2, RH = H + PAD - Y0;
  const nA = L.makeNoise('s05a'), nB = L.makeNoise('s05b');
  const NL = 512;

  // glaze by depth: lifted and orange where the wall climbs to the lip → the body colour → deep iron red in the well
  const GLAZE = lut([[0, '#fb7348'], [0.07, '#f56641'], [0.2, '#ef5a3c'], [0.42, '#e8543a'], [0.64, '#dc4830'], [0.84, '#c93c25'], [1, '#b8341f']], NL);
  // gilding across the lip, outer edge → inner edge: olive (it mirrors the turquoise ground) → gold → crown → ochre where it thins onto the red
  const GOLD = lut([[0, '#3d5f30'], [0.07, '#866818'], [0.18, '#cf9a2e'], [0.3, '#edc455'], [0.42, '#f6d974'], [0.55, '#e9c45a'], [0.72, '#dcab40'], [0.9, '#c0862a'], [1, '#a0661e']], NL);
  const DOT_D = rgb('#b22e1a'), DOT_L = rgb('#ff8650'), HOT = rgb('#f4703a'), COOL = rgb('#dc4239');
  const REFL = rgb('#ffa884'), SPARK = rgb('#ffe9d6'), EDGE = rgb('#8a2212'), BOUNCE = rgb('#ffa24e');
  const GHI = rgb('#fff0b0'), GTHIN = rgb('#cf8232'), GDARK = rgb('#ad781c');

  const img = new ImageData(RW, RH), px = img.data;
  for (let j = 0; j < RH; j++) {
    const y = Y0 + j, ddy = cy - y;
    for (let i = 0; i < RW; i++) {
      const x = X0 + i, ddx = x - cx;
      const rr = Math.sqrt(ddx * ddx + ddy * ddy), d = R - rr;      // d = px below the arc
      if (d < -0.5) continue;
      const th = Math.atan2(ddx, ddy), U = th * R;
      const gw = 15 + 1.1 * nB.n2(U / 41, 1.7) + 0.5 * nB.n2(U / 9.5, 5.1);   // hand-painted: the inner edge of the gold wavers
      const e = d - gw;
      let r = 0, g = 0, b = 0;

      // ── glaze ──
      if (e > -1) {
        // the wall turns up steeply at the lip, so the stipple is foreshortened there
        const V = d + 60 * (1 - Math.exp(-d / 50));
        let t = 0.7 * (d / 520) + 0.3 * ((y - a.crestY) / 520); t = t < 0 ? 0 : t > 1 ? 1 : t;
        const li = ((t * (NL - 1)) | 0) * 3;
        r = GLAZE[li]; g = GLAZE[li + 1]; b = GLAZE[li + 2];
        // slow drift between orange and red
        const hue = nA.n2(U / 560 + 3, V / 420 - 7);
        if (hue > 0) { const m = 0.09 * hue; r += (HOT[0] - r) * m; g += (HOT[1] - g) * m; b += (HOT[2] - b) * m; }
        else { const m = -0.09 * hue; r += (COOL[0] - r) * m; g += (COOL[1] - g) * m; b += (COOL[2] - b) * m; }
        // cloudiness of the sprayed coats and faint turning rings
        const cloud = 0.6 * nA.n2(U / 46, V / 46) + 0.4 * nB.n2(U / 17 + 9, V / 17 - 4);
        const lathe = nB.n2(U / 700 + 40, V / 11);
        let f = 1 + 0.02 * cloud + 0.016 * lathe;
        // the mist itself — droplets one to two px across, some denser (deeper red), some thin (pale orange) …
        cell(U / 4.4, V / 4.4, 11);
        {
          const rad = 0.22 + 0.2 * cId2, m = 1 - sstep(rad * 0.3, rad, Math.sqrt(cD1)), amp = cId * 2 - 1;
          if (m > 0) {
            if (amp < 0) { const k = -0.4 * m * amp; r += (DOT_D[0] - r) * k; g += (DOT_D[1] - g) * k; b += (DOT_D[2] - b) * k; }
            else { const k = 0.4 * m * amp; r += (DOT_L[0] - r) * k; g += (DOT_L[1] - g) * k; b += (DOT_L[2] - b) * k; }
          }
        }
        // … riding on a slightly coarser, softer speckle where droplets merged
        cell(U / 9.5 + 31, V / 9.5 - 17, 97);
        f += (cId - 0.5) * 0.12 * (1 - sstep(0.02, 0.22, cD1));
        cell(U / 21 - 5, V / 21 + 13, 211);                           // the odd heavier droplet
        if (cId > 0.6) { const rad = 0.07 + 0.08 * cId2, k = 0.15 * (1 - sstep(rad * 0.45, rad, Math.sqrt(cD1))); r += (DOT_D[0] - r) * k; g += (DOT_D[1] - g) * k; b += (DOT_D[2] - b) * k; }
        // key light from the upper left
        f *= 1 - 0.05 * ((x - 960) / 960);
        { const q = (d - 268) / 56; f *= 1 - 0.045 * Math.exp(-q * q); }
        r *= f; g *= f; b *= f;
        // one pale reflection concentric with the rim (soft, with a slightly brighter core), strongest left of centre
        const bd = d - 168, te = (th + 0.08) / 0.24;
        const refl = (0.78 * Math.exp(-bd * bd / 900) + 0.22 * Math.exp(-(bd + 4) * (bd + 4) / 60)) * (0.12 + 0.88 * Math.exp(-te * te)) * (0.86 + 0.14 * nB.n2(U / 150, 2.3));
        const rf = 0.62 * refl;
        r += (REFL[0] - r) * rf; g += (REFL[1] - g) * rf; b += (REFL[2] - b) * rf;
        // pin-point sparkle: the tiniest bumps of the glaze skin catch the light, mostly inside the reflection
        cell(U / 7.5 + 3, V / 7.5 + 9, 301);
        if (cId > 0.5) { const rad = 0.12 + 0.08 * cId2, sp = (1 - sstep(rad * 0.3, rad, Math.sqrt(cD1))) * (0.06 + 0.6 * refl) * 0.85; r += (SPARK[0] - r) * sp; g += (SPARK[1] - g) * sp; b += (SPARK[2] - b) * sp; }
        // under the gold: its little cast edge, and a warm bounce off the gilding
        if (e < 2.4) { const k = 0.42 * (1 - sstep(0.3, 2.4, e)); r += (EDGE[0] - r) * k; g += (EDGE[1] - g) * k; b += (EDGE[2] - b) * k; }
        const bn = 0.16 * Math.exp(-Math.max(0, e) / 7);
        r += (BOUNCE[0] - r) * bn; g += (BOUNCE[1] - g) * bn; b += (BOUNCE[2] - b) * bn;
      }

      // ── gilding ──
      if (e < 1) {
        const s = d <= 0 ? 0 : d >= gw ? 1 : d / gw;
        const li = ((s * (NL - 1)) | 0) * 3;
        let gr = GOLD[li], gg = GOLD[li + 1], gb = GOLD[li + 2];
        // brush streaks along the line: where the gold is thin the red warms it; where it is full it brightens
        const dens = 0.6 * nA.n2(U / 64 + 5, d / 7 + 10) + 0.4 * nB.n2(U / 15, d / 3.5 + 3);
        const inner = sstep(0.25, 1, s);
        if (dens < 0) { const k = -0.55 * dens * inner; gr += (GTHIN[0] - gr) * k; gg += (GTHIN[1] - gg) * k; gb += (GTHIN[2] - gb) * k; }
        else { const k = 1 + 0.07 * dens; gr *= k; gg *= k; gb *= k; }
        // polished metal mirrors its surroundings: slow turns of darker and brighter gold along the line
        const turn = nA.n2(U / 190 - 4, 6.6);
        if (turn < 0) { const k = -0.3 * turn; gr += (GDARK[0] - gr) * k; gg += (GDARK[1] - gg) * k; gb += (GDARK[2] - gb) * k; }
        else { const k = 1 + 0.08 * turn; gr *= k; gg *= k; gb *= k; }
        // the crown of the lip catches the light in broken dashes
        const rs = (s - 0.38) / 0.2, ridge = Math.exp(-rs * rs);
        const dash = sstep(0.02, 0.4, 0.6 * nA.n2(U / 38 + 8.3, 0.5) + 0.4 * nB.n2(U / 13, 2.1));
        const k1 = (th + 0.1) / 0.2, k2 = (th - 0.27) / 0.07;
        const key = Math.min(1, 0.5 + 0.5 * Math.exp(-k1 * k1) + 0.45 * Math.exp(-k2 * k2));
        const hk = ridge * (0.14 + 0.86 * dash * key);
        gr += (GHI[0] - gr) * hk; gg += (GHI[1] - gg) * hk; gb += (GHI[2] - gb) * hk;
        const hot = ridge * ridge * sstep(0.4, 0.9, dash * key) * 0.85;
        gr += (255 - gr) * hot; gg += (252 - gg) * hot; gb += (232 - gb) * hot;
        // metallic glitter
        const gl = nB.n2(U / 2.3, d / 2.3 + 40) - 0.35;
        if (gl > 0) { const add = gl * 110 * (0.25 + 0.75 * ridge); gr += add; gg += add * 0.95; gb += add * 0.7; }
        if (e > -1) { const k = sstep(-0.8, 0.8, e); r = gr + (r - gr) * k; g = gg + (g - gg) * k; b = gb + (b - gb) * k; }
        else { r = gr; g = gg; b = gb; }
      }

      const o = (j * RW + i) * 4;
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = d >= 0.5 ? 255 : (d + 0.5) * 255;
    }
  }
  const cnv = L.makeCanvas(RW, RH);
  cnv.getContext('2d').putImageData(img, 0, 0);
  return { cnv, x0: X0, y0: Y0 };
}

/** the ground: flat turquoise with a little tooth, and the dish's narrow shadow hugging the outside of the lip */
function buildBack(env) {
  const a = env.arc;
  const c = L.makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#2fb5a8'; g.fillRect(0, 0, W, H);
  // barely-there falloff so it reads as a lit surface rather than a fill
  g.fillStyle = L.radial(g, 800, 240, 80, 1500, [[0, 'rgba(84,222,206,0.14)'], [0.45, 'rgba(60,196,182,0.03)'], [1, 'rgba(14,140,130,0.14)']]);
  g.fillRect(0, 0, W, H);
  const TH = Math.ceil(a.yAt(0)) + 30;
  g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.16;
  g.drawImage(L.noiseTex(W, TH, { seed: 's05tooth', scale: 3.2, octaves: 2, res: 1, contrast: 1.7 }), 0, 0);
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.5;
  g.drawImage(L.grainTex(W, TH, { seed: 's05g', amount: 0.12 }), 0, 0);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  // shadow: the dish's own disc, nudged up and to the right (the light comes from the lower left of the table)
  const disc = (dx, dy, blur, style) => {
    const s = L.makeCanvas(W, H), sg = s.getContext('2d');
    sg.filter = `blur(${blur}px)`; sg.fillStyle = style;
    sg.beginPath(); sg.arc(a.cx + dx, a.cy + dy, a.R, 0, L.TAU); sg.fill();
    g.drawImage(s, 0, 0);
  };
  disc(8, -15, 7, 'rgba(8,92,84,0.4)');
  disc(3, -4.6, 1.3, 'rgba(5,70,64,0.94)');
  return c;
}

export default {
  name: '珊瑚红撞松石绿',
  tone: 'light',
  init(env) {
    const rg = L.rng('s05glint'), glints = [];
    const N = 9;
    for (let i = 0; i < N; i++) {
      const th = -0.42 + 0.84 * (i + rg.range(0.15, 0.85)) / N;
      const k1 = (th + 0.1) / 0.2, k2 = (th - 0.27) / 0.08;
      const key = Math.min(1, 0.38 + 0.62 * Math.exp(-k1 * k1) + 0.5 * Math.exp(-k2 * k2));
      glints.push({ th, len: rg.range(12, 34), k: rg.range(0.65, 1) * key, ph: rg(), drift: rg.range(-0.003, 0.003) });
    }
    S = { back: buildBack(env), dish: buildDish(env), glints };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.0045, 0.0045, p);
    ctx.drawImage(S.back, 0, 0);
    // the dish turns a hair under the lens
    L.cam(ctx, env, { rot }, () => ctx.drawImage(S.dish.cnv, S.dish.x0, S.dish.y0));
    // the soft reflection drifts the other way across the glaze
    ctx.save(); a.clipBelow(ctx, -16); ctx.globalCompositeOperation = 'screen';
    a.at(ctx, L.lerp(-0.05, -0.11, p), -168, () => {
      ctx.scale(5.2, 0.7);
      ctx.fillStyle = L.radial(ctx, 0, 0, 0, 92, [[0, 'rgba(255,170,130,0.16)'], [0.5, 'rgba(255,150,110,0.055)'], [1, 'rgba(255,150,110,0)']]);
      ctx.fillRect(-96, -96, 192, 192);
    });
    ctx.restore();
    // glints on the gilding: each flares and fades as the lip slides under the light
    for (const q of S.glints) {
      const tw = q.k * (0.3 + 0.7 * Math.pow(0.5 + 0.5 * Math.cos((p * 0.75 + q.ph) * L.TAU), 2));
      if (tw < 0.04) continue;
      a.at(ctx, q.th + rot + q.drift * (p * 2 - 1), -5.8, () => {
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.scale(2.4, 0.62);
        ctx.fillStyle = L.radial(ctx, 0, 0, 0, 34, [[0, `rgba(255,242,186,${0.8 * tw})`], [0.25, `rgba(255,220,128,${0.34 * tw})`], [1, 'rgba(255,210,110,0)']]);
        ctx.fillRect(-34, -34, 68, 68);
        ctx.restore();
        ctx.fillStyle = `rgba(255,253,240,${Math.min(1, 1.2 * tw)})`;
        ctx.beginPath(); ctx.ellipse(0, 0, q.len, 3, 0, 0, L.TAU); ctx.fill();
      });
    }
  },
};
