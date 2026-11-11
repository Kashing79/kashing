// s37 — 扇形展开的铜钱. A long string of cash coins bent round into one big ring and fanned open, seen from straight
// above the ring: every coin stands on its rim, so all we see is rim after rim — narrow copper blades that run from
// the outer circle (the arc) down toward the ring's centre like the gills of a mushroom. The arc is the outer limb of
// all those rims, picked out by a thin pale-gold back-light; below it the blades glow furnace-orange on the side that
// faces the key light (upper left) and drop to dark red on the other, with deep black slots between them. Above: black.
//
// Everything under the arc is shaded per pixel in init(): each pixel is mapped to (θ, depth below the arc), assigned to
// a coin, and lit from that coin's own cross-section (flat filed edge + rounded arrises), its position round the rim
// (a cylinder seen from above: grazing at the limb, turning to face the lens further down) and its own tilt, wear and
// tarnish. Energy → colour goes through one copper ramp so shadows fall to red and highlights rise to pale gold.
// No inscriptions are visible from this angle and none are drawn.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 100;
const RO = 470;          // coin radius in px (a coin is ~17 thicknesses across: the rim is a thin blade)
const PSI = 0.5;         // where round the rim the key light sits (angle from the limb)
const BG = [4, 3, 3];
let S = null;

const sstep = (a, b, v) => { let t = (v - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const hash2 = (x, y) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// tiny allocation-free worley noise (squared distance in cD, cell id in cI) for casting pits
let cD = 0, cI = 0;
function cell(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let d1 = 9, id = 0;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const qx = xi + ox, qy = yi + oy;
    let h = (Math.imul(qx, 374761393) + Math.imul(qy, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    const dx = qx + (h & 1023) / 1023 - x, dy = qy + ((h >>> 10) & 1023) / 1023 - y, d = dx * dx + dy * dy;
    if (d < d1) { d1 = d; id = ((h >>> 20) & 255) / 255; }
  }
  cD = d1; cI = id;
}

/** the string: every coin has its own thickness, spacing, wear, tilt, tarnish; a few lean or sit half a head low */
function makeCoins(a) {
  const r = L.rng('s37-fan');
  const uMax = a.span(PAD + 260) * a.R;
  const out = [];
  let u = -uMax;
  while (u < uMax) {
    const roll = r();
    const t = roll < 0.13 ? r.range(35, 42) : roll < 0.27 ? r.range(62, 74) : r.range(46, 60);
    const gap = L.clamp(27 + r.gauss() * 7, 13, 46);
    const o = r.chance(0.11) ? r.range(8, 22) : r.chance(0.06) ? -r.range(3, 5) : r.gauss() * 1.4;
    const th = (u + t / 2) / a.R;
    const worn = r();
    out.push({
      th, t, half: t / 2, o,
      lean: r.chance(0.14) ? r.sign() * r.range(0.014, 0.03) : r.gauss() * 0.004,   // px of sideways drift per px of depth
      ra: Math.min(t / 2, L.lerp(3.5, 11, worn * worn)),                              // arris radius: crisp filed edge … rounded by handling
      crown: r.range(0.03, 0.22), crownPx: r.range(0.3, 2.2),
      tilt: r.gauss() * 0.11,          // the whole flat of the edge turned a little toward / away from the light
      pitch: r.gauss() * 0.07,         // … and fore/aft, which slides its highlight up or down the blade
      tone: L.clamp(1 + r.gauss() * 0.1, 0.78, 1.18),
      hue: r.range(-1, 1),
      rimW: r.range(2.2, 5.5), rimI: r.range(0.55, 1.1),
      spec: r.range(0.4, 1.2),
      zh: -o + r.gauss() * 3,          // how proud the rim stands (decides who shadows whom)
      k: -0.09 * Math.sin(th) / 0.4 + r.gauss() * 0.012,   // how much of a face the lens sees past the rim (perspective: none at the crest)
      s1: r.range(0, 500), s2: r.range(0, 500),
    });
    u += t + gap;
  }
  return out;
}

function buildFan(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const coins = makeCoins(a), n = coins.length;
  const X0 = -PAD, Y0 = Math.floor(a.crestY) - 14;
  const RW = W + PAD * 2, RH = H + PAD - Y0;
  const img = new ImageData(RW, RH), px = img.data;
  const hot = new ImageData(RW, RH), hp = hot.data;      // highlights only → bloom
  const nA = L.makeNoise('s37a'), nB = L.makeNoise('s37b');

  // energy → colour: black → dark red → copper orange → bright orange → pale gold
  const NL = 1300, lut = new Float32Array((NL + 1) * 3);
  const ramp = L.makeRamp([[0, '#040303'], [0.07, '#160504'], [0.18, '#3d0d07'], [0.31, '#6e1a0c'], [0.44, '#a52e0e'], [0.58, '#e2591c'],
    [0.74, '#ff8f45'], [0.87, '#ffb566'], [1.0, '#f8d595'], [1.3, '#fff3d6']]);
  for (let i = 0; i <= NL; i++) { const q = ramp(i / 1000); lut[i * 3] = q[0]; lut[i * 3 + 1] = q[1]; lut[i * 3 + 2] = q[2]; }

  // u (arc length at the arc) → nearest coin
  const Q = 2, uMin = coins[0].th * R - 300, nQ = Math.ceil((coins[n - 1].th * R + 300 - uMin) / Q);
  const near = new Int16Array(nQ);
  for (let q = 0, j = 0; q < nQ; q++) {
    const u = uMin + q * Q;
    while (j < n - 1 && Math.abs(coins[j + 1].th * R - u) < Math.abs(coins[j].th * R - u)) j++;
    near[q] = j;
  }

  for (let jy = 0; jy < RH; jy++) {
    const ddy = cy - (Y0 + jy);
    for (let ix = 0; ix < RW; ix++) {
      const ddx = X0 + ix - cx, rr = Math.sqrt(ddx * ddx + ddy * ddy), d = R - rr;
      const o4 = (jy * RW + ix) * 4;
      px[o4 + 3] = 255; hp[o4 + 3] = 255;
      if (d < -8) { px[o4] = BG[0]; px[o4 + 1] = BG[1]; px[o4 + 2] = BG[2]; continue; }
      const th = Math.atan2(ddx, ddy);
      let q = ((th * R - uMin) / Q) | 0; q = q < 0 ? 0 : q >= nQ ? nQ - 1 : q;
      const j0 = near[q];
      // which rim covers this pixel, and how far the nearest rims are on either side
      let bar = -1, barX = 0, barZ = -1e9, sL = 1e9, sR = 1e9, cL = -1, cR = -1;
      for (let k = j0 - 2; k <= j0 + 2; k++) {
        if (k < 0 || k >= n) continue;
        const c = coins[k];
        const x = (th - c.th) * rr - c.lean * d, ax = x < 0 ? -x : x;
        if (ax < c.half + 0.5) { if (c.zh > barZ && d - c.o > -3) { bar = k; barX = x; barZ = c.zh; } }
        else if (x > 0) { const s = x - c.half; if (s < sL) { sL = s; cL = k; } }
        else { const s = -x - c.half; if (s < sR) { sR = s; cR = k; } }
      }
      const fade = 1 - 0.6 * sstep(300, 660, d);                       // everything sinks into the dark toward the ring's centre
      const tq = (th + 0.09) / 0.42, pool = 0.82 + 0.3 * Math.exp(-tq * tq);   // the key light pools left of the crest

      // ── the slot between two rims: black, with the neighbouring coin's face glowing a little way into it ──
      let gE = 0;
      if (d > 0 && cL >= 0 && cR >= 0) {
        const g = sL + sR, open = sstep(1.5, 13, g);
        const cr = coins[cR];
        if (cr.k < 0 && d > cr.o) {      // its left face: turned toward the light
          const dc = d - cr.o, wf = -cr.k * Math.sqrt(Math.max(0, 2 * RO * dc - dc * dc));
          if (sR < wf) {
            let kf = Math.cos(Math.acos(Math.max(-1, 1 - dc / RO)) - PSI); kf = kf > 0 ? Math.pow(kf, 1.6) : 0;
            gE += 0.6 * Math.exp(-sR / (3 + 0.28 * g)) * (1 - sstep(wf - 4, wf, sR)) * open * kf * cr.tone * (1 + 0.16 * nA.n2(sR * 0.45 + cr.s1, d * 0.02));
          }
        }
        const cl = coins[cL];
        if (cl.k > 0 && d > cl.o) {      // its right face: in shadow, lit only by copper bouncing off copper → deep red
          const dc = d - cl.o, wf = cl.k * Math.sqrt(Math.max(0, 2 * RO * dc - dc * dc));
          if (sL < wf) {
            let kf = Math.cos(Math.acos(Math.max(-1, 1 - dc / RO)) - PSI); kf = kf > 0 ? Math.pow(kf, 1.6) : 0;
            gE += 0.36 * Math.exp(-sL / (2.5 + 0.2 * g)) * (1 - sstep(wf - 4, wf, sL)) * open * kf * cl.tone * (1 + 0.16 * nA.n2(sL * 0.45 + cl.s1, d * 0.02));
          }
        }
        gE *= fade * pool;
      }
      let li = (gE * 1000) | 0; li = (li > NL ? NL : li) * 3;
      let cr0 = lut[li], cg0 = lut[li + 1], cb0 = lut[li + 2], hv = 0;

      // ── the rim of a coin ──
      if (bar >= 0) {
        const c = coins[bar], x = barX, ax = x < 0 ? -x : x, half = c.half, xn = x / half;
        let nx = c.tilt + c.crown * xn, drop = c.crownPx * xn * xn;
        const xa = ax - (half - c.ra);
        if (xa > 0) { let s = xa / c.ra; s = s > 1 ? 1 : s; nx += (x < 0 ? -s : s) * 0.95; drop += c.ra * (1 - Math.sqrt(1 - s * s)); }
        const nick = 0.9 * nB.n2(x * 0.3 + c.s1, c.s2);
        const dp = d - c.o - drop - nick;            // depth below this coin's own limb (its silhouette is its cross-section)
        if (dp > -0.5) {
          let cov = (dp + 0.5 < 1 ? dp + 0.5 : 1) * L.clamp(half + 0.5 - ax);
          const dpp = dp < 0 ? 0 : dp;
          const al = Math.acos(Math.max(-1, 1 - dpp / RO)) + c.pitch;
          let key = Math.cos(al - PSI); key = key > 0 ? Math.pow(key, 1.6) : 0;
          let lf = 1 - 1.05 * nx; lf = lf < 0.16 ? 0.16 : lf > 1.5 ? 1.5 : lf;
          // file marks run round the rim → long hairlines down the blade; slow tarnish; grain
          const sA = nA.n2(x * 0.55 + c.s1, d * 0.005 + c.s2), sB = nB.n2(x * 1.6 + c.s2, d * 0.011 + c.s1);
          const mo = nA.fbm(x * 0.03 + c.s1 * 3.1, d * 0.012 + c.s2, 3);
          let tex = 1 + 0.11 * sA + 0.07 * sB - 0.24 * sstep(0.05, 0.55, mo) + 0.1 * sstep(0.1, 0.6, -mo);
          tex *= 1 + 0.08 * (hash2(ix, jy) - 0.5);
          cell(x / 9 + c.s1 * 7, d / 11 + c.s2);
          const pit = cI > 0.86 ? 1 - sstep(0.012, 0.05, cD) : 0;
          let E = 0.045 + 0.72 * key * fade * lf * pool * c.tone * tex;
          // the arris that faces the light flashes in a broken line
          const e = (nx + 0.5) / 0.2;
          let sp = Math.exp(-e * e) * sstep(0.1, 0.5, al) * (1 - sstep(1.0, 1.45, al)) * c.spec;
          sp *= 0.3 + 0.7 * sstep(-0.25, 0.45, nB.n2(d * 0.045 + c.s1, c.s2));
          E += 0.42 * sp * fade * pool;
          // a prouder neighbour on the light side drops its shadow across this rim
          if (bar > 0) {
            const cl = coins[bar - 1], ls = (cl.zh - c.zh) * 3.2;
            if (ls > 2) { const xl = (th - cl.th) * rr - cl.lean * d - cl.half; E *= 0.4 + 0.6 * sstep(ls - 5, ls + 3, xl); }
          }
          E *= 1 - 0.7 * pit;
          li = (E * 1000) | 0; li = (li < 0 ? 0 : li > NL ? NL : li) * 3;
          let br = lut[li], bg = lut[li + 1] * (1 + 0.06 * c.hue), bb = lut[li + 2] * (1 + 0.05 * c.hue);
          // pale-gold back-light riding the limb
          const rim = Math.exp(-dpp / c.rimW) * c.rimI * (1 - 0.45 * (nx > 0 ? nx : 0)) * (0.8 + 0.2 * sA) * pool;
          br += rim * 250; bg += rim * 205; bb += rim * 128;
          cr0 += (br - cr0) * cov; cg0 += (bg - cg0) * cov; cb0 += (bb - cb0) * cov;
          hv = (Math.max(0, E - 0.78) * 1.6 + rim * 0.9) * cov;
        }
      }
      px[o4] = cr0; px[o4 + 1] = cg0; px[o4 + 2] = cb0;
      if (hv > 0) { hp[o4] = cr0 * hv; hp[o4 + 1] = cg0 * hv; hp[o4 + 2] = cb0 * hv; }
    }
  }
  const cnv = L.makeCanvas(RW, RH); cnv.getContext('2d').putImageData(img, 0, 0);
  const hcv = L.makeCanvas(RW, RH); hcv.getContext('2d').putImageData(hot, 0, 0);

  const full = (g) => g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
  const layer = L.makeLayer(PAD, (g) => { g.fillStyle = `rgb(${BG})`; full(g); g.drawImage(cnv, X0, Y0); });

  // depth of field: sharp round the crest, a touch soft toward the sides, softer again toward the bottom of frame
  const K0 = 'rgba(0,0,0,0)', K1 = 'rgba(0,0,0,1)';
  const side = L.blurred(layer, 2.2), sg = side.getContext('2d');
  sg.globalCompositeOperation = 'destination-in';
  sg.fillStyle = L.linear(sg, 0, 0, side.width, 0, [[0, K1], [0.1, K1], [0.3, K0], [0.7, K0], [0.9, K1], [1, K1]]);
  sg.fillRect(0, 0, side.width, side.height);
  const deep = L.blurred(layer, 5), dg = deep.getContext('2d');
  dg.globalCompositeOperation = 'destination-in';
  dg.fillStyle = L.radial(dg, cx + PAD, cy + PAD, R - 520, R - 290, [[0, K1], [1, K0]]);
  dg.fillRect(0, 0, deep.width, deep.height);
  const lg = layer.getContext('2d');
  lg.drawImage(side, -PAD, -PAD); lg.drawImage(deep, -PAD, -PAD);

  // bloom: the hot arrises and the back-lit limb bleed a little into the lens
  const hl = L.makeLayer(PAD, (g) => { g.fillStyle = '#000'; full(g); g.drawImage(hcv, X0, Y0); });
  lg.globalCompositeOperation = 'screen';
  lg.globalAlpha = 0.7; lg.drawImage(L.blurred(hl, 5), -PAD, -PAD);
  lg.globalAlpha = 0.5; lg.drawImage(L.blurred(hl, 20), -PAD, -PAD);
  lg.globalAlpha = 1; lg.globalCompositeOperation = 'source-over';
  return layer;
}

export default {
  name: '扇形展开的铜钱',
  tone: 'light',
  init(env) {
    S = { fan: buildFan(env) };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.003, 0.003, p), zoom = L.lerp(1.0, 1.012, p);
    L.blit(ctx, env, S.fan, { rot, zoom, dy: 1.2 * p });
    // the key light's sheen travels down the blades
    ctx.save(); a.clipBelow(ctx, 2); ctx.globalCompositeOperation = 'color-dodge';
    const c = L.lerp(60, 170, p), w = 110, r0 = a.R - c - w, r1 = a.R - c + w;
    ctx.fillStyle = L.radial(ctx, a.cx, a.cy, r0, r1, [[0, 'rgba(255,150,70,0)'], [0.5, 'rgba(255,160,80,0.3)'], [1, 'rgba(255,150,70,0)']]);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  },
};
