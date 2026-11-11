// s01 — 草木晨光. The opening "horizon" of 《中国中医药》: the upper margin of one huge herb leaf, backlit at dawn.
// Below the arc the blade is ink-green, almost black; only the thin margin lets a little emerald through.
// Hugging the arc is the glow: a hairline of morning gold (the short hairs on the leaf edge catching the light),
// then bright emerald, deep emerald, and finally a clean ink-green dark that runs far above the frame —
// the title card is simply the camera tilted up into that dark, so this file also exports the three "opening" hooks.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 220;
let S = null; // cached layers

// colour of the air by height above the leaf edge (px): 晨金 → 明翠 → 深翠 → 墨绿黑
const SKY = [
  [-8, '#0b3a27'], [0, '#ffe7a0'], [4, '#f8cf5e'], [11, '#f2c14e'], [22, '#d2c654'], [38, '#8bc862'], [60, '#48c36d'],
  [86, '#2fbf71'], [126, '#23a966'], [172, '#178a55'], [226, '#0f6b46'], [296, '#0a4c34'], [380, '#073224'], [480, '#052117'],
  [620, '#04160f'], [900, '#030f0b'], [1900, '#020a07'],
];
const SKY_TOP = 1900;

// dew drops sitting on the margin: offset along the edge from the crest (px), half-width, height
const DROPS = [
  { x: -806, w: 19, h: 11.5 }, { x: -498, w: 34, h: 20.5 }, { x: -214, w: 15, h: 9 },
  { x: 142, w: 42, h: 25 }, { x: 452, w: 17, h: 10 }, { x: 716, w: 27, h: 16 },
];

function dropPath(g, w, h) {
  g.beginPath();
  g.moveTo(-w, 1.6);
  g.bezierCurveTo(-w * 1.03, -h * 0.74, -w * 0.56, -h, 0, -h);
  g.bezierCurveTo(w * 0.56, -h, w * 1.03, -h * 0.74, w, 1.6);
  g.quadraticCurveTo(0, 5.5, -w, 1.6);
  g.closePath();
}

const sstep = (a, b, v) => { const t = L.clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/**
 * The thin margin of the blade, where light gets through: areoles (the little islands of tissue between the finest veins)
 * glow emerald, the veinlets between them stay dark. Computed per pixel in polar coordinates (U along the edge, depth inward),
 * only for the narrow band under the arc. Returns a canvas plus its frame-space origin.
 */
function buildMargin(env) {
  const a = env.arc, nz = L.makeNoise('s01areole'), nb = L.makeNoise('s01patch');
  const DEPTH = 110;
  const X0 = -PAD, X1 = W + PAD;
  const Y0 = Math.floor(a.crestY) - 2, Y1 = Math.ceil(a.yAt(X1, 0)) + DEPTH + 4;
  const w = X1 - X0, h = Y1 - Y0;
  const img = new ImageData(w, h), d = img.data;
  for (let j = 0; j < h; j++) {
    const dy = a.cy - (Y0 + j + 0.5);
    for (let i = 0; i < w; i++) {
      const dx = X0 + i + 0.5 - a.cx, rr = Math.sqrt(dx * dx + dy * dy), dep = a.R - rr;
      if (dep < -1.5 || dep > DEPTH) continue;
      const U = Math.atan2(dx, dy) * a.R, V = Math.max(0, dep);
      const c1 = nz.cell(U / 9.5 + 3.7, V / 9.5), c2 = nz.cell(U / 37 - 11.3, V / 31 + 5.1);
      // the blade is not evenly thin: light reaches a little deeper in some stretches of the margin than in others
      const reach = 21 + 10 * nb.fbm(U / 210, 0.3, 2);
      const T = Math.exp(-V / reach);
      const v1 = sstep(0.03, 0.2, c1.edge), v2 = sstep(0.015, 0.085, c2.edge);
      const lum = T * (0.12 + 0.88 * v1 * (0.42 + 0.58 * c1.id)) * (0.3 + 0.7 * v2);
      const o = (j * w + i) * 4;
      d[o] = 44 + 86 * lum; d[o + 1] = 190 + 45 * lum; d[o + 2] = 108 + 30 * lum; d[o + 3] = 255 * Math.min(0.82, lum * 0.9);
    }
  }
  const c = L.makeCanvas(w, h);
  c.getContext('2d').putImageData(img, 0, 0);
  return { c, x: X0, y: Y0 };
}

/** everything that belongs to the leaf and slides with it: blade, veins, lit hairs on the margin, dew */
function buildLeaf(env) {
  const a = env.arc;
  const span = a.span(PAD + 140);
  const full = (g) => g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
  const margin = buildMargin(env);

  // three faint lateral veins: parallel, all leaning the same way (toward the leaf tip, off to the right),
  // straight in the blade and bending forward as they near the margin, where they thin out and vanish
  const veins = L.blurred(L.makeLayer(PAD, (vg) => {
    const nv = L.makeNoise('s01vein');
    vg.lineCap = 'round';
    [-0.16, 0.1, 0.36].forEach((t1, n) => {
      const d0 = 900, dT = 0.25, N = 190;
      const at = (u) => {
        const th = t1 - dT + dT * (0.62 * u + 0.38 * Math.pow(u, 2.6));
        const dep = 20 + d0 * Math.pow(1 - u, 1.22);
        const wob = 5 * nv.n2(u * 5.2 + n * 9.1, n * 3.3) * (1 - u);
        return a.pt(th + wob / a.R, -dep);
      };
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < N; i++) {
          const u0 = i / N, p0 = at(u0), p1 = at(Math.min(1, (i + 1.4) / N));
          const al = L.smooth((1 - u0) / 0.26) * L.lerp(0.6, 1, u0);
          vg.strokeStyle = pass ? L.rgba('#259463', 0.4 * al) : L.rgba('#10603f', 0.3 * al);
          vg.lineWidth = (pass ? 1 : 3.6) * L.lerp(5.4, 1.1, Math.pow(u0, 0.8));
          vg.beginPath(); vg.moveTo(p0.x, p0.y); vg.lineTo(p1.x, p1.y); vg.stroke();
        }
      }
    });
  }), 2.2);

  return L.makeLayer(PAD, (g) => {
    // ── the blade ──
    g.save(); a.clipBelow(g, 0.5);
    const D = 1000;
    const body = [[0, '#0e6040'], [4, '#0b5038'], [12, '#083d2b'], [28, '#062c1f'], [55, '#051e15'], [100, '#04160f'], [190, '#03110c'], [500, '#020c08'], [1000, '#020907']];
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - D, a.R + 0.5, body.map(([d, c]) => [(D - d) / (D + 0.5), c]).reverse());
    full(g);
    // slow undulation of the blade: here and there the ink-green lifts by a breath
    g.drawImage(L.polarNoiseLayer(env, PAD, { seed: 's01blade', scale: 340, sx: 3.2, sy: 1, octaves: 3, contrast: 1.5, res: 0.2,
      ramp: [[0, 'rgba(0,0,0,0.3)'], [0.45, 'rgba(0,0,0,0)'], [0.62, 'rgba(10,52,36,0)'], [1, 'rgba(11,58,40,0.3)']] }), -PAD, -PAD);
    g.globalAlpha = 0.5; g.drawImage(veins, -PAD, -PAD); g.globalAlpha = 1;
    g.drawImage(margin.c, margin.x, margin.y);
    g.restore();

    // ── the margin catching the light: a hairline of gold and short dense hairs pointing outward ──
    const hair = L.makeLayer(PAD, (hg) => {
      hg.lineCap = 'round';
      hg.strokeStyle = 'rgba(242,193,78,0.55)'; hg.lineWidth = 5; a.stroke(hg, 0.6, -span, span);
      hg.strokeStyle = 'rgba(255,240,188,0.95)'; hg.lineWidth = 2.1; a.stroke(hg, 0.2, -span, span);
      const r = L.rng('s01hair');
      const half = a.R * span;
      for (let x = -half; x < half; x += r.range(1.1, 3.1)) {
        const len = 3 + 13 * Math.pow(r(), 2.3);
        const lean = 0.1 + r.gauss() * 0.27;
        const lw = r.range(0.55, 1.15), bend = r.range(-1.6, 1.6);
        a.at(hg, x / a.R, -0.8, () => {
          hg.rotate(lean);
          const gr = hg.createLinearGradient(0, 0, 0, -len);
          gr.addColorStop(0, 'rgba(255,232,150,0.95)'); gr.addColorStop(0.55, 'rgba(255,246,208,0.85)'); gr.addColorStop(1, 'rgba(255,246,208,0)');
          hg.strokeStyle = gr; hg.lineWidth = lw;
          hg.beginPath(); hg.moveTo(0, 0.6); hg.quadraticCurveTo(bend * 0.4, -len * 0.5, bend, -len); hg.stroke();
        });
      }
    });
    g.save();
    g.globalAlpha = 0.55; g.drawImage(L.blurred(hair, 5), -PAD, -PAD);
    g.globalAlpha = 1; g.drawImage(hair, -PAD, -PAD);
    g.restore();

    // ── dew: flat round drops stuck to the margin; one thin lit rim and one gold-white glint each ──
    for (const q of DROPS) {
      const th = q.x / a.R, { w, h } = q;
      const side = -L.clamp(th / 0.1, -1, 1);          // the glint sits on the side facing the light behind the crest
      a.at(g, th, 0, () => {
        g.save(); dropPath(g, w, h); g.clip();
        // water: dark where it bends the light away from us, glowing where it gathers it
        g.fillStyle = L.linear(g, 0, -h, 0, 4, [[0, 'rgba(4,34,22,0.95)'], [0.4, 'rgba(8,66,43,0.92)'], [0.74, 'rgba(28,150,92,0.9)'], [1, 'rgba(150,214,110,0.92)']]);
        g.fillRect(-w - 4, -h - 4, w * 2 + 8, h + 12);
        g.fillStyle = L.radial(g, -side * w * 0.34, -h * 0.2, 0, w * 0.62, [[0, 'rgba(226,236,128,0.85)'], [0.45, 'rgba(120,214,112,0.4)'], [1, 'rgba(47,191,113,0)']]);
        g.fillRect(-w - 4, -h - 4, w * 2 + 8, h + 12);
        // the outline goes dark (grazing angle) → the drop reads as a solid bead
        dropPath(g, w, h);
        g.strokeStyle = 'rgba(2,20,13,0.6)'; g.lineWidth = Math.max(3, w * 0.2); g.stroke();
        g.restore();
        // thin lit rim round the dome, strongest toward the light
        dropPath(g, w, h);
        g.strokeStyle = L.linear(g, -w, 0, w, 0, side > 0
          ? [[0, 'rgba(242,193,78,0.3)'], [0.6, 'rgba(255,236,170,0.8)'], [1, 'rgba(255,246,208,1)']]
          : [[0, 'rgba(255,246,208,1)'], [0.4, 'rgba(255,236,170,0.8)'], [1, 'rgba(242,193,78,0.3)']]);
        g.lineWidth = 1.25; g.stroke();
        // the glint
        const gx = side * w * 0.42, gy = -h * 0.6, gr = Math.max(1.6, w * 0.11);
        g.fillStyle = L.radial(g, gx, gy, 0, gr * 3.2, [[0, 'rgba(255,246,208,0.75)'], [0.35, 'rgba(250,214,120,0.3)'], [1, 'rgba(242,193,78,0)']]);
        g.fillRect(gx - gr * 4, gy - gr * 4, gr * 8, gr * 8);
        g.fillStyle = '#fff6d0';
        g.beginPath(); g.ellipse(gx, gy, gr, gr * 0.72, side * -0.5, 0, L.TAU); g.fill();
      });
    }
  });
}

export function initOpening(env) {
  const a = env.arc;
  if (S && S.R === a.R && S.crestY === a.crestY) return S;
  // order of the glints: from the crest outward, like the light itself
  const order = DROPS.map((q, i) => i).sort((i, j) => Math.abs(DROPS[i].x) - Math.abs(DROPS[j].x));
  const flash = DROPS.map((q, i) => 0.16 + 0.68 * (order.indexOf(i) / (DROPS.length - 1)));
  S = { R: a.R, crestY: a.crestY, leaf: buildLeaf(env), flash };
  return S;
}

/**
 * tilt: px the camera has tilted UP (the whole picture slides down by this much). 0 = the opening framing.
 * k:    0..1 progress of the light itself (the glow spreads from the crest to both sides and widens; the dew glints in turn).
 */
export function drawOpening(ctx, env, { tilt = 0, k = 0 } = {}) {
  const a = env.arc; const s = initOpening(env);
  k = L.clamp(k);
  const e = L.smooth(k);
  const rot = L.lerp(-0.003, 0.003, k);
  const wide = L.lerp(0.86, 1.08, e);
  ctx.save();
  ctx.translate(0, tilt);
  const full = () => ctx.fillRect(-PAD, -tilt - PAD, W + PAD * 2, H + PAD * 2 + tilt);

  // the air: concentric bands hugging the leaf edge, running up into a clean dark
  ctx.fillStyle = L.radial(ctx, a.cx, a.cy, a.R - 8, a.R + SKY_TOP, SKY.map(([dr, c]) => [(Math.min(SKY_TOP, dr > 0 ? dr * wide : dr) + 8) / (SKY_TOP + 8), c]));
  full();
  // the light is right behind the crest: a long low bloom lying along the edge
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  ctx.translate(a.cx, a.crestY - 4); ctx.scale(L.lerp(3.0, 4.3, e), 1.1);
  ctx.fillStyle = L.radial(ctx, 0, 0, 0, 210, [[0, `rgba(255,216,112,${L.lerp(0.6, 0.8, e)})`], [0.2, `rgba(248,200,88,${L.lerp(0.34, 0.48, e)})`], [0.5, `rgba(196,206,92,${L.lerp(0.1, 0.15, e)})`], [1, 'rgba(47,191,113,0)']]);
  ctx.fillRect(-220, -220, 440, 440);
  ctx.restore();

  // the leaf (blade, lit hairs, dew) slides a hair's breadth along the arc
  L.blit(ctx, env, s.leaf, { rot });

  // light spreading from the crest toward both ends of the edge
  const sig = L.lerp(430, 900, e), sideCol = L.mix('#5a8a74', '#bfe6d2', e);
  const stops = [];
  for (let i = 0; i <= 14; i++) { const x = (i / 14) * W, wgt = 1 - Math.exp(-0.5 * Math.pow((x - a.cx) / sig, 2)); stops.push([i / 14, L.mix('#ffffff', sideCol, wgt)]); }
  ctx.save(); ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = L.linear(ctx, 0, 0, W, 0, stops);
  full();
  ctx.restore();

  // where the light is about to break over the edge, a little more of it soaks through the blade
  L.glow(ctx, a.cx, a.crestY + 10, 340, '#3fd07f', L.lerp(0.1, 0.16, e));

  // the dew glints, one after another
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  DROPS.forEach((q, i) => {
    const f = Math.exp(-Math.pow((k - s.flash[i]) / 0.075, 2));
    if (f < 0.02) return;
    const th = q.x / a.R, side = -L.clamp(th / 0.1, -1, 1);
    const dr = q.h * 0.6, p = a.pt(th + rot + (side * q.w * 0.42) / (a.R + dr), dr);
    const rr = (16 + q.w * 1.5) * (0.6 + 0.4 * f);
    ctx.fillStyle = L.radial(ctx, p.x, p.y, 0, rr, [[0, `rgba(255,250,224,${f})`], [0.16, `rgba(255,240,180,${0.7 * f})`], [0.5, `rgba(242,193,78,${0.16 * f})`], [1, 'rgba(242,193,78,0)']]);
    ctx.fillRect(p.x - rr, p.y - rr, rr * 2, rr * 2);
    // a small four-point star
    const sl = (22 + q.w * 2.2) * f;
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      ctx.strokeStyle = L.linear(ctx, p.x - dx * sl, p.y - dy * sl, p.x + dx * sl, p.y + dy * sl, [[0, 'rgba(255,246,208,0)'], [0.5, `rgba(255,250,226,${0.9 * f})`], [1, 'rgba(255,246,208,0)']]);
      ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(p.x - dx * sl, p.y - dy * sl); ctx.lineTo(p.x + dx * sl, p.y + dy * sl); ctx.stroke();
    }
  });
  ctx.restore();
  ctx.restore();
}

export const TITLE_TILT = 760;

export default {
  name: '草木晨光',
  tone: 'light',
  init(env) { initOpening(env); },
  draw(ctx, env, p) { drawOpening(ctx, env, { tilt: 0, k: p }); },
};
