// s05 — 珊瑚红撞松石绿. Six frames, two colours: a macro of the gilt lip of a coral-red (珊瑚红) vessel in front of a
// flat, out-of-focus turquoise (松石绿) ground. The arc is the lip.
//
// Everything below the arc is shaded per pixel once in init(), the way a lens would see a real glaze:
//   · a relief map (orange-peel swell and dimples, a scatter of pinholes 棕眼) lit from the upper left;
//   · glaze thickness drives the colour — thin and orange where it breaks over the lip and on the lands of the
//     orange peel, deeper and redder where it pooled in the hollows — under a fine blown-on stipple;
//   · a window reflection lies slantwise across the glaze; it is looked up through the relief, so its edges
//     crumble into the orange peel and every pinhole inside it stays dark;
//   · the lip itself: worn gilding (描金) that has rubbed through to a thread of white porcelain along the crown;
//   · depth of field: sharp under the crest, going soft toward the sides and the bottom; highlights bloom a little.
// draw() only slides that layer a few pixels round the circle while points of light on the rim flare and fade.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 56;          // the slide is ±11 px along the arc; the rest of the margin keeps the blur clean at the borders
let S = null;

const sstep = (a, b, v) => { const t = v <= a ? 0 : v >= b ? 1 : (v - a) / (b - a); return t * t * (3 - 2 * t); };
const c01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ── allocation-free worley noise: squared distance to the nearest point in cD1, the offset to it in (cDx, cDy), two ids ──
let cD1 = 0, cDx = 0, cDy = 0, cId = 0, cId2 = 0;
function cell(x, y, salt) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let d1 = 9, id = 0, bx = 0, by = 0;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const cx = xi + ox, cy = yi + oy;
    let h = (Math.imul(cx, 374761393) + Math.imul(cy, 668265263) + salt) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    const dx = cx + (h & 1023) / 1023 - x, dy = cy + ((h >>> 10) & 1023) / 1023 - y, d = dx * dx + dy * dy;
    if (d < d1) { d1 = d; id = h; bx = dx; by = dy; }
  }
  cD1 = d1; cDx = bx; cDy = by;
  cId = ((id >>> 20) & 255) / 255;
  cId2 = ((Math.imul(id ^ 0x5bd1e995, 0x27d4eb2f) >>> 9) & 4095) / 4095;
}

function lut(stops, n = 512) {
  const f = L.makeRamp(stops), out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const c = f(i / (n - 1)); out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2]; }
  return out;
}
const rgb = (c) => L.parseColor(c);

// where the key light finds the rim (theta from the crest): strongest left of centre, a second catch on the right
const gauss = (v) => Math.exp(-v * v);
const rimKey = (th) => Math.min(1, 0.3 + 0.7 * gauss((th + 0.11) / 0.17) + 0.42 * gauss((th - 0.26) / 0.07));

/** the vessel: lip, gilding and coral-red glaze, everything under the arc. Returns { cnv, x0, y0 } in frame coordinates. */
function buildDish(env, nA, nB, rimDash) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const TOP = 30;                                   // rows kept above the crest: bloom and defocus spill over the edge
  const X0 = -PAD, Y0 = Math.floor(a.crestY) - TOP;
  const RW = W + PAD * 2, RH = H + PAD - Y0, N = RW * RH;
  const NL = 512;

  // ── pass 1: polar coordinates and the relief of the glaze skin ──
  const dd = new Float32Array(N), uu = new Float32Array(N), hgt = new Float32Array(N), pit = new Float32Array(N);
  for (let j = 0; j < RH; j++) {
    const ddy = cy - (Y0 + j);
    for (let i = 0; i < RW; i++) {
      const ddx = X0 + i - cx, o = j * RW + i;
      const d = R - Math.sqrt(ddx * ddx + ddy * ddy);      // px below the arc
      dd[o] = d;
      if (d < -2.5) continue;
      const U = Math.atan2(ddx, ddy) * R;                  // px along the arc
      uu[o] = U;
      const dc = d < 0 ? 0 : d;
      const V = dc + 46 * (1 - Math.exp(-dc / 38));        // the wall turns over at the lip: relief is foreshortened there
      // orange peel: a slow swell, lands and hollows, a finer ripple
      let h = 0.6 * nA.n2(U / 61 + 7.3, V / 55 - 2.1) + 0.28 * nB.n2(U / 28 - 3.7, V / 26 + 9.4) + 0.5 * nA.n2(U / 230 + 1.1, V / 190 + 5.5);
      // … and rounded dimples of every size, never two alike
      cell(U / 41 + 3.1, V / 41 + 8.7, 517);
      if (cId > 0.4) { const rad = 0.24 + 0.26 * cId2, m = 1 - sstep(0, rad * rad, cD1); h -= (0.3 + 0.8 * (cId - 0.4) / 0.6) * m * m; }
      // pinholes (棕眼): sparse, in loose clusters
      cell(U / 78 + 13.1, V / 78 - 8.2, 733);
      if (cId > 0.36) {
        const clus = nB.n2(U / 340 - 9.2, V / 300 + 4.4);
        if (cId > 0.62 - 0.26 * clus) {
          const rpx = 2.2 + 3.8 * cId2 * cId2, q = cD1 / ((rpx / 78) * (rpx / 78));
          if (q < 1) { const m = 1 - sstep(0.06, 1, q); pit[o] = m; h -= (1.3 + 0.3 * rpx) * m; }
        }
      }
      hgt[o] = h;
    }
  }

  // glaze by thickness: a thin wash over the white body → orange → the body colour → deep iron red where it pooled
  const GLAZE = lut([[0, '#ffd3a8'], [0.1, '#fdaa74'], [0.24, '#f98452'], [0.4, '#f16842'], [0.58, '#e8543a'], [0.76, '#da4630'], [0.9, '#c83b27'], [1, '#b8341f']], NL);
  // gilding from its worn, shaded tone to the burnished crown
  const GOLD = lut([[0, '#7d5516'], [0.22, '#a97a24'], [0.45, '#d2a43e'], [0.62, '#e6c15a'], [0.8, '#f3d97c'], [0.93, '#fdeeb0'], [1, '#fff8d8']], NL);
  const PITC = rgb('#7d1e0f'), HL = rgb('#fff1e4');

  const LX = -0.57, LY = -0.82;                    // toward the key light (upper left), on screen
  const KD = 2.6;                                  // how strongly the relief shades
  const KS = 1050, JIT = 8;                        // lever of the reflection through the relief; satin scatter
  const PHI = L.deg(13), CA = Math.cos(PHI), SA = Math.sin(PHI);
  const HX = 850, HY = 770, LH = 330, WH = 60, SU = 44, SV = 24, MU = 96, BEND = 0.00022;   // the window: centre, half-sizes, softness, mullion
  const LIP = 46;

  // ── pass 2: shade ──
  const img = new ImageData(RW, RH), px = img.data;
  const hlI = new ImageData(RW, RH), hp = hlI.data;      // the highlights alone, for the bloom
  for (let j = 1; j < RH - 1; j++) {
    const y = Y0 + j;
    for (let i = 1; i < RW - 1; i++) {
      const o = j * RW + i, d = dd[o];
      if (d < -0.5) continue;
      const x = X0 + i, U = uu[o];
      const dc = d < 0 ? 0 : d;
      const V = dc + 46 * (1 - Math.exp(-dc / 38));
      const h = hgt[o], pt = pit[o];
      const gx = (hgt[o + 1] - hgt[o - 1]) * 0.5, gy = (hgt[o + RW] - hgt[o - RW]) * 0.5;

      // ── glaze: thickness → colour ──
      const cloud = 0.6 * nB.n2(U / 270 + 3.3, V / 240 - 7.7) + 0.4 * nA.n2(U / 98 - 11, V / 90 + 2);
      let t = 0.58 + 0.1 * (dc / 520) + 0.13 * cloud - 0.085 * (h < -1.6 ? -1.6 : h > 1.4 ? 1.4 : h);
      if (dc < 260) {                                      // it breaks thin over the lip, to an uneven depth
        const ln = 40 * (1 + 0.42 * nA.n2(U / 150 + 5, 1.2) + 0.2 * nB.n2(U / 41 - 3, 7.7));
        t -= 0.45 * Math.exp(-Math.max(0, dc - 12) / ln);
      }
      t = c01(t);
      const li = ((t * (NL - 1)) | 0) * 3;
      let r = GLAZE[li], g = GLAZE[li + 1], b = GLAZE[li + 2];
      // the blown-on mist: droplets a couple of px across, denser or thinner, over a softer speckle where they merged
      let f = 1;
      cell(U / 4.6, V / 4.6, 11);
      { const rad = 0.2 + 0.22 * cId2, m = 1 - sstep(rad * 0.3, rad, Math.sqrt(cD1)); f += 0.07 * m * (cId * 2 - 1); }
      cell(U / 10.5 + 31, V / 10.5 - 17, 97);
      f += (cId - 0.5) * 0.07 * (1 - sstep(0.02, 0.25, cD1));
      // light: the relief, then the broad fall-off from the upper left into the depth of the wall
      let lam = -(gx * LX + gy * LY) * KD;
      lam = lam < -0.55 ? -0.55 : lam > 0.5 ? 0.5 : lam;
      f *= (1 + lam) * (1.05 - 0.055 * ((x - 960) / 960) - 0.1 * (dc / 520) + 0.07 * Math.exp(-dc / 26));
      r *= f; g *= f; b *= f;
      if (pt > 0) { const k = 0.55 * pt; r += (PITC[0] - r) * k; g += (PITC[1] - g) * k; b += (PITC[2] - b) * k; }

      // pin-pricks: tiny burst bubbles, each a dark nick with a point of light on its far wall
      let glint = 0;
      cell(U / 30 - 5.5, V / 30 + 1.9, 911);
      if (cId > 0.42) {
        const rpx = 1.1 + 1.7 * cId2 * cId2, sx = -cDx * 30, sy = -cDy * 30;      // px from the nick's centre
        const dk = Math.exp(-((sx + 0.35 * rpx) ** 2 + (sy + 0.5 * rpx) ** 2) / (rpx * rpx));
        const br = Math.exp(-((sx - 0.4 * rpx) ** 2 + (sy - 0.55 * rpx) ** 2) / (0.5 * rpx * rpx));
        const near = Math.exp(-(((x - HX) / 640) ** 2 + ((y - HY) / 330) ** 2));
        const amp = ((cId - 0.42) / 0.58) ** 2 * (0.25 + 0.75 * near);
        const kd = 0.3 * dk * (1 - br); r -= r * kd * 0.8; g -= g * kd; b -= b * kd;
        glint = 0.95 * br * amp;
      }

      // ── the window, seen through the relief ──
      let spec = 0;
      {
        const bx = x - HX, by = y - HY, reach = KS * (Math.abs(gx) + Math.abs(gy)) + JIT;
        if (Math.abs(bx * CA + by * SA) < LH + SU + reach && Math.abs(by * CA - bx * SA) < WH + SV + 40 + reach) {
          const qx = bx - KS * gx + JIT * nB.n2(x / 2.7, y / 2.7), qy = by - KS * gy + JIT * nA.n2(x / 2.7 + 40, y / 2.7 - 9);
          const du = qx * CA + qy * SA, dv = qy * CA - qx * SA - BEND * du * du;
          let w = sstep(-LH - SU, -LH + SU, du) * (1 - sstep(LH - SU, LH + SU, du)) * sstep(-WH - SV, -WH + SV, dv) * (1 - sstep(WH - SV, WH + SV, dv));
          if (w > 0) {
            w *= 0.12 + 0.88 * sstep(5, 17, Math.abs(du - MU));          // the glazing bar
            w *= 1 - 0.36 * c01((du + LH) / (2 * LH));                    // brighter at the end nearer the light
            spec = 0.9 * w;
          }
        }
      }
      if (glint > spec) spec = glint;
      if (spec > 0) { r += (HL[0] - r) * spec; g += (HL[1] - g) * spec; b += (HL[2] - b) * spec; }
      let bloom = spec * 0.7;

      // ── the lip: white porcelain, the red feathering out on it, worn gilding over both ──
      if (d < LIP) {
        const th = U / R;
        const wear = c01(0.5 + 0.46 * nA.n2(U / 430 + 2.2, 9.1) + 0.3 * nB.n2(U / 97 - 7.1, 3.3) + 0.1 * nA.n2(U / 24 + 4.4, 6.6));
        const gw = 25 + 2.4 * nB.n2(U / 52, 1.7) + 1.1 * nB.n2(U / 12.5, 5.1);             // inner edge of the gilding
        const dRed = 12.5 + 2.2 * nA.n2(U / 77, 3.9) + 1.2 * nB.n2(U / 19, 8.2);            // where the red stops short of the crown
        const wEdge = 1.5 + 9.5 * sstep(0.3, 0.92, wear) + 1.2 * nA.n2(U / 9, 1.3 + d / 4); // how far the gold has rubbed back
        // white porcelain: clean where it faces us, cooler where the outer turn mirrors the turquoise ground
        const cool = Math.exp(-dc / 2.1), wv = 0.965 + 0.035 * nB.n2(U / 30, d / 6);
        const wr = (251 - 78 * cool) * wv, wg = (247 - 38 * cool) * wv, wb = (238 - 34 * cool) * wv;
        const kred = sstep(dRed - 2.6, dRed + 2.6, d + 1.4 * nA.n2(U / 5.1, d / 5.1));
        r = wr + (r - wr) * kred; g = wg + (g - wg) * kred; b = wb + (b - wb) * kred;
        // gold: a band from the rubbed crown to its wavering inner edge, flecked where it has gone, with streaks left on the crown
        let cov = sstep(wEdge - 1.3, wEdge + 1.3, d) * (1 - sstep(gw - 1.1, gw + 1.1, d));
        if (cov > 0) {
          const fn = 0.55 * nA.n2(U / 13 + 3, d / 2.6 + 11) + 0.45 * nB.n2(U / 3.6, d / 2.2 - 5);
          cov *= 1 - sstep(0.52 - 0.3 * wear, 0.74 - 0.3 * wear, fn);
        }
        if (d > 1 && d < wEdge + 1.5) {
          const rem = 0.62 * sstep(0.22, 0.55, nB.n2(U / 17 - 2, d / 2.4 + 4)) * sstep(1, 2.4, d);
          if (rem > cov) cov = rem;
        }
        if (cov > 0.003) {
          let lg = 0.5 + 0.24 * Math.exp(-dc / 10) + 0.17 * nA.n2(U / 160 - 4, 6.6) + 0.09 * nB.n2(U / 7, d / 2.8 + 3)
            + 0.1 * rimKey(th) - 0.13 * sstep(gw - 9, gw, d);
          lg = c01(lg);
          const gi = ((lg * (NL - 1)) | 0) * 3, k = 0.97 * cov;
          r += (GOLD[gi] - r) * k; g += (GOLD[gi + 1] - g) * k; b += (GOLD[gi + 2] - b) * k;
        }
        // the crown of the lip turns through the light: one thin, broken line of it
        const q = (d - 4.6 - 0.8 * nB.n2(U / 33, 4.4)) / 1.35;
        const sl = Math.exp(-q * q) * (0.22 + 0.78 * rimKey(th)) * (0.2 + 0.8 * rimDash(U));
        r += (255 - r) * sl; g += (255 - 9 * cov - g) * sl; b += (250 - 52 * cov - b) * sl;
        if (sl * 0.8 > bloom) bloom = sl * 0.8;
      }

      const o4 = o * 4, al = d >= 0.5 ? 255 : (d + 0.5) * 255;
      px[o4] = r; px[o4 + 1] = g; px[o4 + 2] = b; px[o4 + 3] = al;
      if (bloom > 0.02) { hp[o4] = 255; hp[o4 + 1] = 240; hp[o4 + 2] = 224; hp[o4 + 3] = bloom * al; }
    }
  }
  const sharp = L.makeCanvas(RW, RH);
  sharp.getContext('2d').putImageData(img, 0, 0);

  // ── depth of field: the plane of focus runs along the lip under the crest; blur grows to the sides and into the depth ──
  const out = L.makeCanvas(RW, RH), og = out.getContext('2d');
  og.drawImage(sharp, 0, 0);
  const LEV = [1.5, 4, 9.5], MS = 8, mw = Math.ceil(RW / MS), mh = Math.ceil(RH / MS);
  const masks = LEV.map(() => new ImageData(mw, mh));
  for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) {
    const x = X0 + (i + 0.5) * MS, y = Y0 + (j + 0.5) * MS;
    const d = Math.max(0, R - Math.hypot(x - cx, cy - y));
    const ex = (x - 930) / 1040, ey = Math.max(0, d - 120) / 420;
    const beta = 9.5 * sstep(0.3, 1.15, Math.sqrt(0.55 * ex * ex + ey * ey));
    for (let k = 0; k < 3; k++) {
      const lo = k ? LEV[k - 1] : 0;
      masks[k].data[(j * mw + i) * 4 + 3] = 255 * c01((beta - lo) / (LEV[k] - lo));
    }
  }
  LEV.forEach((bpx, k) => {
    const mc = L.makeCanvas(mw, mh); mc.getContext('2d').putImageData(masks[k], 0, 0);
    const bl = L.blurred(sharp, bpx), bg = bl.getContext('2d');
    bg.globalCompositeOperation = 'destination-in'; bg.imageSmoothingEnabled = true; bg.imageSmoothingQuality = 'high';
    bg.drawImage(mc, 0, 0, mw * MS, mh * MS);
    og.drawImage(bl, 0, 0);
  });
  // ── halation: only the highlights bloom ──
  const hc = L.makeCanvas(RW, RH);
  hc.getContext('2d').putImageData(hlI, 0, 0);
  og.globalCompositeOperation = 'screen';
  og.globalAlpha = 0.5; og.drawImage(L.blurred(hc, 6), 0, 0);
  og.globalAlpha = 0.3; og.drawImage(L.blurred(hc, 20), 0, 0);
  og.globalAlpha = 1; og.globalCompositeOperation = 'source-over';
  return { cnv: out, x0: X0, y0: Y0 };
}

/** the ground: flat turquoise, far out of focus — a slow unevenness and a little tooth, nothing else */
function buildBack(env) {
  const a = env.arc;
  const c = L.makeCanvas(W, H), g = c.getContext('2d');
  const TH = Math.ceil(a.yAt(0)) + 40;                    // nothing of the ground shows below this
  g.fillStyle = '#2fb5a8'; g.fillRect(0, 0, W, H);
  g.fillStyle = L.radial(g, 560, 60, 120, 1750, [[0, 'rgba(110,232,216,0.17)'], [0.45, 'rgba(60,196,182,0.03)'], [1, 'rgba(8,120,112,0.2)']]);
  g.fillRect(0, 0, W, TH);
  g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.2;
  g.drawImage(L.noiseTex(W, TH, { seed: 's05wall', scale: 420, octaves: 3, res: 0.125, contrast: 1.5 }), 0, 0);
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.4;
  g.drawImage(L.grainTex(W, TH, { seed: 's05g', amount: 0.1 }), 0, 0);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  return c;
}

export default {
  name: '珊瑚红撞松石绿',
  tone: 'light',
  init(env) {
    const nA = L.makeNoise('s05a'), nB = L.makeNoise('s05b');
    // how readily each stretch of the rim throws the light back (shared by the baked rim line and the live glints)
    const rimDash = (U) => sstep(-0.05, 0.5, 0.6 * nA.n2(U / 44 + 8.3, 0.5) + 0.4 * nB.n2(U / 15, 2.1));
    const rg = L.rng('s05glint'), glints = [];
    const N = 7;
    for (let i = 0; i < N; i++) {
      const th = -0.36 + 0.72 * (i + rg.range(0.15, 0.85)) / N;
      glints.push({ th, len: rg.range(7, 22), k: rg.range(0.55, 1) * rimKey(th), ph: rg() });
    }
    S = { back: buildBack(env), dish: buildDish(env, nA, nB, rimDash), glints, rimDash };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.0046, 0.0046, p);
    ctx.drawImage(S.back, 0, 0);
    // the vessel turns a hair under the lens
    L.cam(ctx, env, { rot }, () => ctx.drawImage(S.dish.cnv, S.dish.x0, S.dish.y0));
    // points of light on the rim stay where the lamp puts them; each flares as a burnished stretch slides under it
    for (const q of S.glints) {
      const tw = q.k * (0.25 + 0.75 * S.rimDash((q.th - rot) * a.R)) * (0.55 + 0.45 * Math.cos((p * 0.8 + q.ph) * L.TAU));
      if (tw < 0.05) continue;
      a.at(ctx, q.th, -4.6, () => {
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.scale(2.2, 0.6);
        ctx.fillStyle = L.radial(ctx, 0, 0, 0, 26, [[0, `rgba(255,246,214,${0.75 * tw})`], [0.3, `rgba(255,228,160,${0.28 * tw})`], [1, 'rgba(255,220,140,0)']]);
        ctx.fillRect(-26, -26, 52, 52);
        ctx.restore();
        ctx.fillStyle = `rgba(255,254,246,${Math.min(1, 1.15 * tw)})`;
        ctx.beginPath(); ctx.ellipse(0, 0, q.len, 2.1, 0, 0, L.TAU); ctx.fill();
      });
    }
  },
};
