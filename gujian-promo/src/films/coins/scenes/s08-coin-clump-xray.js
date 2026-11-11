// s08 — 钱坨的X光片. A radiograph (negative look: dense = white) of a hoard clump — hundreds of cash coins rusted into one lump.
// The arc is the outer contour of the lump, wrapped in a thick bright crust of corrosion and soil. Inside: the stacked
// shadows of round coins with SQUARE holes, lying at every angle; the more metal the beam crosses, the whiter the film.
// Between the coins: foamy, cloudy corrosion and black gas pores. Above the arc: bare black film base.
//
// Everything below the arc is computed per pixel in init() as an X-ray would form it:
//   density = corrosion matrix (cloud + foam − pores) + Σ coin thickness along the beam + crust shell
//   film    = 1 − exp(−density)   → tone ramp (film black → blue-grey → cold grey → white)
// draw() pushes in a little under a fixed arc clip (so the contour never leaves the arc), sweeps a soft scan band
// left → right and jitters the film grain every frame.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 64;
let S = null;

const sstep = (a, b, v) => { let t = (v - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };

// ── allocation-free worley noise: squared distances in cD1 / cD2, cell id in cId ──
let cD1 = 0, cD2 = 0, cId = 0;
function cell(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let d1 = 9, d2 = 9, id = 0;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const cx = xi + ox, cy = yi + oy;
    let h = (Math.imul(cx, 374761393) + Math.imul(cy, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    const dx = cx + (h & 1023) / 1023 - x, dy = cy + ((h >>> 10) & 1023) / 1023 - y, d = dx * dx + dy * dy;
    if (d < d1) { d2 = d1; d1 = d; id = ((h >>> 20) & 255) / 255; } else if (d < d2) d2 = d;
  }
  cD1 = d1; cD2 = d2; cId = id;
}

/** where the coins lie inside the lump: a few hero coins, rusted-together rolls, edge-on coins and a loose jumble */
function layCoins(a) {
  const r = L.rng('s08-coins');
  const K = 1.12;                  // overall coin scale (all coins are much the same size, as in a real hoard)
  const coins = [];
  // c = cos(tilt): 1 = flat-on to the beam (a full circle), small = nearly edge-on (a thin bright ellipse)
  // soft = geometric unsharpness: coins far from the film come out blurred
  const add = (x, y, rc, c, psi, rot, gain, soft = 1) => coins.push({
    x, y, rc: rc * K, c, psi, rot, gain, soft, seed: r.range(0, 90),
    hs: r.range(0.235, 0.27),      // half-side of the square hole / radius
    wr: r.range(0.13, 0.165),      // width of the outer rim (外郭) / radius
    eat: r.chance(0.35) ? r.range(0.3, 0.7) : 0,   // some coins are half eaten by corrosion
    wedge: r.range(-0.2, 0.2), wa: r.range(0, L.TAU),
  });
  const onArc = (theta, depth) => a.pt(theta, -depth);
  // hero coins — big, clean, close to the middle of the frame
  const heroes = [
    [-0.09, 272, 136, 0.97, 0.3, 0.4, 1.1],
    [0.13, 226, 124, 0.76, -0.52, 1.05, 1.0],
    [0.035, 492, 128, 0.9, 1.1, 0.15, 1.0],
  ];
  for (const [th, dp, rc, c, psi, rot, gain] of heroes) { const p = onArc(th, dp); add(p.x, p.y, rc, c, psi, rot, gain, 1.3); }
  // far coins first (soft ghosts that fill the depth of the lump)
  const span = a.span(PAD + 180), heroN = heroes.length;
  for (let row = 0; row < 4; row++) {
    const depth = 182 + row * 186, rr = a.R - depth, step = (240 * K) / rr;
    for (let th = -span + ((row + 1) % 2) * step * 0.5; th <= span; th += step) {
      const rc = r.range(100, 122), dp = Math.max(rc * K + 26, depth + r.range(-60, 60));
      const p = onArc(th + r.range(-0.35, 0.35) * step, dp);
      add(p.x, p.y, rc, 1 - 0.62 * Math.pow(r(), 1.2), r.range(0, Math.PI), r.range(0, Math.PI / 2), r.range(0.4, 0.6), r.range(3.2, 5));
    }
  }
  // rolls: coins that were once strung together, now one rusted cylinder seen at an angle → rings nested one inside the next
  const roll = (th, dp, n, c, psi, rc) => {
    const p = onArc(th, dp), sinT = Math.sqrt(1 - c * c), ax = -Math.sin(psi), ay = Math.cos(psi);
    const pitch = rc * K * 0.16 * sinT;
    let s = -0.5 * (n - 1) * pitch;
    for (let i = 0; i < n; i++) {
      add(p.x + ax * s + r.range(-2, 2), p.y + ay * s + r.range(-2, 2), rc * r.range(0.975, 1.025),
        L.clamp(c + r.range(-0.025, 0.025), 0.2, 1), psi + r.range(-0.035, 0.035), r.range(0, Math.PI / 2), 0.31, 1.5);
      s += pitch * r.range(0.82, 1.2);
    }
  };
  roll(-0.35, 262, 11, 0.33, 0.95, 120);
  roll(0.36, 360, 10, 0.36, -0.5, 122);
  roll(-0.2, 548, 8, 0.42, -1.2, 118);
  roll(0.6, 226, 9, 0.34, 0.35, 116);
  roll(-0.63, 236, 8, 0.4, -0.3, 118);
  // the loose jumble in front: a jittered grid in (arc length, depth) so the whole lump is filled
  for (let row = 0; row < 4; row++) {
    const depth = 170 + row * 190, rr = a.R - depth, step = (207 * K) / rr;
    for (let th = -span + (row % 2) * step * 0.5; th <= span; th += step) {
      const u = r(), c = u < 0.14 ? r.range(0.035, 0.085) : u < 0.28 ? r.range(0.26, 0.45) : 1 - 0.5 * Math.pow(r(), 1.4);
      const rc = r.range(106, 126), psi = r.range(0, Math.PI), rot = r.range(0, Math.PI / 2), gain = r.range(0.8, 1.05), soft = r.range(1.2, 2.4);
      const dp = Math.max(rc * K + 26, depth + r.range(-52, 52));
      const p = onArc(th + r.range(-0.3, 0.3) * step, dp);
      let near = false;
      for (let k = 0; k < heroN; k++) if (Math.hypot(coins[k].x - p.x, coins[k].y - p.y) < 150 * K) near = true;
      if (near) continue;
      add(p.x, p.y, rc, c, psi, rot, gain, soft);
    }
  }
  return coins;
}

/** add every coin's metal thickness (along the beam) into C */
function castCoins(coins, C, RW, RH, X0, Y0) {
  const nz = L.makeNoise('s08-metal');
  for (const q of coins) {
    const rc = q.rc, c = q.c, cp = Math.cos(q.psi), sp = Math.sin(q.psi), cr = Math.cos(q.rot), sr = Math.sin(q.rot);
    const ext = rc + 6;
    const edgeOn = c < 0.2, cb = edgeOn ? c + 0.07 : c;
    const bw = Math.sqrt((ext * cp) ** 2 + (ext * cb * sp) ** 2) + 3, bh = Math.sqrt((ext * sp) ** 2 + (ext * cb * cp) ** 2) + 3;
    const i0 = Math.max(0, Math.floor(q.x - bw - X0)), i1 = Math.min(RW - 1, Math.ceil(q.x + bw - X0));
    const j0 = Math.max(0, Math.floor(q.y - bh - Y0)), j1 = Math.min(RH - 1, Math.ceil(q.y + bh - Y0));
    if (edgeOn) {
      // seen on edge: a bright spindle as long as the coin is wide, a little dimmer in the middle where the hole is
      const hs = q.hs * rc, gain = q.gain * 1.9;
      for (let j = j0; j <= j1; j++) {
        const dy = Y0 + j - q.y;
        for (let i = i0; i <= i1; i++) {
          const dx = X0 + i - q.x, u = dx * cp + dy * sp, w = Math.abs(-dx * sp + dy * cp), un = u / rc;
          if (un <= -1 || un >= 1) continue;
          const chord = Math.sqrt(1 - un * un), hw = c * rc * chord + 0.055 * rc;
          const t = 1 - sstep(hw - 1.6, hw + 1.6, w); if (t <= 0) continue;
          const mid = 1 - 0.34 * (1 - sstep(hs - 3, hs + 3, Math.abs(u)));
          C[j * RW + i] += t * (0.35 + 0.65 * chord) * mid * gain * (0.9 + 0.12 * nz.n2(u / 14 + q.seed, w / 9));
        }
      }
      continue;
    }
    const gain = q.gain * Math.min(2.2, 1 / c);          // a tilted coin puts more metal in the beam
    const hs = q.hs * rc, hi = hs + 0.066 * rc, rin = rc * (1 - q.wr), ext2 = ext * ext, k1 = 1.9 / rc, k2 = 6.3 / rc;
    const wx = Math.cos(q.wa) * q.wedge / rc, wy = Math.sin(q.wa) * q.wedge / rc;
    for (let j = j0; j <= j1; j++) {
      const dy = Y0 + j - q.y;
      for (let i = i0; i <= i1; i++) {
        const dx = X0 + i - q.x;
        const u = dx * cp + dy * sp, v = (-dx * sp + dy * cp) / c;
        const rho2 = u * u + v * v; if (rho2 > ext2) continue;
        const rho = Math.sqrt(rho2);
        const aa = q.soft * 0.9 * (rho > 1 ? Math.sqrt(u * u + (v / c) * (v / c)) / rho : 1);   // one screen px, measured on the coin
        const lx = u * cr + v * sr, ly = -u * sr + v * cr;
        const ax = lx < 0 ? -lx : lx, ay = ly < 0 ? -ly : ly, sq = ax > ay ? ax : ay;   // square distance → SQUARE hole
        const hole = 1 - sstep(hs - aa, hs + aa, sq);
        if (hole >= 1) continue;
        const m1 = nz.n2(lx * k1 + q.seed, ly * k1 - q.seed * 0.7), m2 = nz.n2(lx * k2 - q.seed, ly * k2 + 3.1);
        const re = rc * (1 + 0.004 * m2 + 0.011 * m1);                       // a worn, slightly nibbled edge
        const disc = 1 - sstep(re - aa, re + aa, rho);
        if (disc <= 0) continue;
        const rim = sstep(rin - aa * 2.6, rin + aa * 1.2, rho);              // 外郭
        const inr = 1 - sstep(hi - aa * 1.2, hi + aa * 2.6, sq);             // 内郭
        const relief = rim > inr ? rim : inr;
        let field = 0.36 * (0.82 + 0.36 * m1 + 0.16 * m2) * (1 + lx * wx + ly * wy);
        field *= 1 - 0.45 * sstep(0.5, 0.8, m2);                             // pitting
        let top = 0.98 * (0.9 + 0.1 * m2);
        if (q.eat) { const e = q.eat * sstep(0.0, 0.5, m1 * 0.8 + m2 * 0.35); field *= 1 - e; top *= 1 - 0.55 * e; }
        C[j * RW + i] += disc * (1 - hole) * (field + (top - field) * relief) * gain;
      }
    }
  }
}

/** the radiograph of the lump: everything below the arc (cropped canvas, origin at X0,Y0 in frame coords) */
function buildClump(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const X0 = -PAD, Y0 = Math.floor(a.crestY) - 6;
  const RW = W + PAD * 2, RH = H + PAD - Y0, N = RW * RH;
  const nA = L.makeNoise('s08a'), nB = L.makeNoise('s08b');

  // 1) slow fields on a coarse grid
  const CS = 4, cw = Math.ceil(RW / CS) + 2, ch = Math.ceil(RH / CS) + 2;
  const cWx = new Float32Array(cw * ch), cWy = new Float32Array(cw * ch), cCloud = new Float32Array(cw * ch),
    cCav = new Float32Array(cw * ch), cFm = new Float32Array(cw * ch), cVx = new Float32Array(cw * ch), cVy = new Float32Array(cw * ch);
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const px = X0 + i * CS, py = Y0 + j * CS, k = j * cw + i;
    const wx = nA.fbm(px / 330, py / 330, 2), wy = nA.fbm(px / 330 + 40, py / 330 - 17, 2);
    cWx[k] = wx; cWy[k] = wy;
    const ux = px + 90 * wx, uy = py + 90 * wy;
    cCloud[k] = nB.fbm(ux / 185, uy / 185, 4, 2, 0.55);
    cCav[k] = nA.fbm(ux / 340 + 9, uy / 250 - 3, 3);
    cFm[k] = nB.fbm(px / 260 - 21, py / 260 + 5, 3);
    cVx[k] = nA.fbm(px / 64 + 3, py / 64 + 71, 2); cVy[k] = nB.fbm(px / 64 - 47, py / 64 + 13, 2);
  }
  const bil = (src, i, j) => {
    const fx = i / CS, fy = j / CS, i0 = fx | 0, j0 = fy | 0, tx = fx - i0, ty = fy - j0, k = j0 * cw + i0;
    const a0 = src[k], a1 = src[k + 1], b0 = src[k + cw], b1 = src[k + cw + 1];
    return (a0 + (a1 - a0) * tx) * (1 - ty) + (b0 + (b1 - b0) * tx) * ty;
  };

  // 2) the coins
  const C = new Float32Array(N);
  castCoins(layCoins(a), C, RW, RH, X0, Y0);

  // 3) film response — the task card's five tones only (film black → dark blue-grey → cold grey → grey-white → white);
  //    a grey-and-black negative, deliberately NOT the saturated blue of a hospital film
  const ramp = L.makeRamp([[0, '#050607'], [0.09, '#0a0f12'], [0.24, '#1b2328'], [0.42, '#45525a'], [0.6, '#7f8a8f'], [0.79, '#bcc5c9'], [0.9, '#d7dde0'], [1, '#f6f8f9']]);
  const NL = 2048, lut = new Uint8ClampedArray(NL * 3);
  for (let i = 0; i < NL; i++) { const t = i / (NL - 1), c = ramp(L.lerp(t, sstep(0.03, 0.97, t), 0.4)); lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2]; }

  const img = new ImageData(RW, RH), d = img.data;
  for (let j = 0; j < RH; j++) {
    const py = Y0 + j, ddy = cy - py;
    for (let i = 0; i < RW; i++) {
      const px = X0 + i, ddx = px - cx, rr = Math.sqrt(ddx * ddx + ddy * ddy), dp = R - rr;   // dp = depth below the contour
      if (dp < -6) continue;
      const k = j * RW + i;
      const wx = bil(cWx, i, j), wy = bil(cWy, i, j), cloud = bil(cCloud, i, j), cav = bil(cCav, i, j), fm = bil(cFm, i, j);
      const vx = bil(cVx, i, j), vy = bil(cVy, i, j);
      const ux = px + 40 * wx + 17 * vx, uy = py + 40 * wy + 17 * vy;
      // foam: round dark bubbles with thin bright membranes between them, at two sizes
      cell(ux / 74, uy / 74);
      const r1 = Math.sqrt(cD1), e1 = Math.sqrt(cD2) - r1, id1 = cId;
      cell(ux / 27 + 11.3, uy / 27 - 7.1);
      const r2 = Math.sqrt(cD1), e2 = Math.sqrt(cD2) - r2, id2 = cId;
      // how hollow the lump is here: a belt of cavities just under the crust, pockets deeper in
      const belt = sstep(46, 110, dp) * (1 - sstep(170, 320, dp));
      const V = sstep(-0.08, 0.36, cav + 0.44 * belt - 0.12);
      const gate = sstep(0.02, 0.22, V + 0.6 * sstep(0.1, 0.4, fm));     // bubbles only where it is hollow or foamy
      // cloudy corrosion: soft billows
      const cl = sstep(-0.36, 0.4, cloud);
      let m = 0.36 + 0.82 * cl;
      // the hollower, the bigger the bubbles — until they merge and only thin bright membranes are left between them
      const ri1 = 0.1 + 0.2 * id1 + 0.46 * V, bub1 = (1 - sstep(ri1, ri1 + 0.15, r1)) * gate, mem1 = (1 - sstep(0.01, 0.1, e1)) * (0.3 + 0.7 * sstep(-0.35, 0.25, vx + vy));
      const ri2 = 0.12 + 0.2 * id2 + 0.3 * V, bub2 = (1 - sstep(ri2, ri2 + 0.18, r2)) * gate, mem2 = (1 - sstep(0.0, 0.12, e2)) * (0.4 + 0.6 * sstep(-0.3, 0.3, vx - vy));
      m *= 1 - (0.78 + 0.18 * id1) * bub1 * (1 - 0.9 * mem1);
      m *= 1 - 0.5 * bub2 * (1 - 0.6 * mem2) * (1 - 0.5 * V);
      m += V * (0.34 * mem1 + 0.1 * mem2 * bub1 + 0.3 * sstep(0.5, 0.68, r1) * bub1);
      // gas pores: small round black spots with a faint bright lip; a few dense mineral grains
      cell(px / 46 + 3.7, py / 46 + 9.2);
      if (cId > 0.42) {
        const pd = Math.sqrt(cD1), pr = 0.07 + 0.25 * (cId - 0.42);
        m *= 1 - 0.9 * (1 - sstep(pr * 0.65, pr, pd));
        m += 0.12 * sstep(pr * 0.9, pr * 1.15, pd) * (1 - sstep(pr * 1.15, pr * 1.9, pd));
      } else if (cId < 0.07) m += 1.6 * (1 - sstep(0.03, 0.075, Math.sqrt(cD1)));
      m *= 0.72 + 0.46 * sstep(60, 560, dp);
      // the crust: a thick bright shell (the beam grazes it edge-on), laminated, its underside billowing inward
      let sh = 0;
      if (dp < 240) {
        const al = Math.atan2(ddx, ddy) * R;
        const tk = 62 + 28 * nA.n2(al / 300, 3.1) + 10 * nA.n2(al / 70, 8.2);
        const wisp = 38 * nB.fbm(al / 150, dp / 90, 3) + 12 * nB.fbm(al / 46, dp / 46, 2);
        const s = 1 - sstep(0.42 * tk, 1.32 * tk, dp + wisp);
        const lam = 0.5 + 0.5 * nB.n2(al / 170, dp / 5.5);
        sh = s * (1.6 + 0.8 * lam) + 0.9 * (1 - sstep(0, 9, dp));
      }
      const x = 0.78 * m + 0.9 * C[k] + sh;
      const v = 1 - Math.exp(-x);
      const li = ((v * (NL - 1)) | 0) * 3, o = k * 4;
      d[o] = lut[li]; d[o + 1] = lut[li + 1]; d[o + 2] = lut[li + 2]; d[o + 3] = 255;
    }
  }
  const cnv = L.makeCanvas(RW, RH), g = cnv.getContext('2d');
  g.putImageData(img, 0, 0);
  // halation: the densest parts bloom a little into their surroundings
  const hot = L.blurred(L.filtered(cnv, 'brightness(0.78) contrast(2.4)'), 12);
  g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.3; g.drawImage(hot, 0, 0);
  // static film mottle
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.16;
  g.drawImage(L.grainTex(RW, RH, { seed: 's08mottle', amount: 0.7, size: 2 }), 0, 0);
  // the lump thickens and the film darkens toward the bottom corners
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = 1;
  g.fillStyle = L.radial(g, cx - X0, a.crestY + 170 - Y0, 520, 1250, [[0, '#ffffff'], [1, '#8c979c']]);
  g.fillRect(0, 0, RW, RH);
  g.globalCompositeOperation = 'source-over';
  return { cnv, X0, Y0 };
}

/** the bare film base above the arc: faint fog, hairline scratches, dust */
function buildFilm() {
  return L.makeLayer(PAD, (g) => {
    g.drawImage(L.noiseLayer(PAD, { seed: 's08fog', scale: 620, octaves: 3, res: 0.125, ramp: [[0, 'rgba(27,35,40,0)'], [0.5, 'rgba(27,35,40,0)'], [1, 'rgba(27,35,40,0.3)']] }), -PAD, -PAD);
    const r = L.rng('s08film');
    g.lineCap = 'round';
    for (let i = 0; i < 44; i++) {
      const x = r.range(-PAD, W + PAD), y = r.range(-PAD, H), ang = Math.PI / 2 + r.gauss() * 0.14, len = r.range(60, 520), bend = r.range(-14, 14);
      g.strokeStyle = L.rgba('#7f8a8f', r.range(0.04, 0.13)); g.lineWidth = r.range(0.5, 1.1);
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(ang) * len * 0.5 + bend, y + Math.sin(ang) * len * 0.5, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      g.stroke();
    }
    L.speckle(g, { seed: 's08dust', count: 260, x: -PAD, y: -PAD, w: W + PAD * 2, h: H + PAD * 2, rMin: 0.4, rMax: 1.5, colors: ['#7f8a8f', '#d7dde0'], alpha: [0.06, 0.3] });
  });
}

/** soft glow hugging the contour: the bright crust bleeds a little into the black */
function buildHalo(env) {
  const a = env.arc;
  const c = L.makeCanvas(W, H), g = c.getContext('2d');
  g.lineWidth = 34; g.strokeStyle = 'rgba(215,221,224,0.9)'; a.stroke(g, -18);
  const tight = L.blurred(c, 9), wide = L.blurred(c, 34);
  const out = L.makeCanvas(W, H), og = out.getContext('2d');
  og.globalAlpha = 0.55; og.drawImage(wide, 0, 0);
  og.globalAlpha = 0.7; og.drawImage(tight, 0, 0);
  // tint the glow toward the film's blue-grey
  og.globalAlpha = 1; og.globalCompositeOperation = 'source-atop'; og.fillStyle = 'rgba(96,128,146,0.3)'; og.fillRect(0, 0, W, H);
  return out;
}

export default {
  name: '钱坨的X光片',
  tone: 'light',
  init(env) {
    const clump = buildClump(env);
    S = {
      clump, film: buildFilm(), halo: buildHalo(env),
      grain: L.grainTex(W + 96, H + 96, { seed: 's08grain', amount: 0.6, size: 1 }),
    };
  },
  draw(ctx, env, p) {
    const a = env.arc, f = env.frame | 0;
    const zoom = L.lerp(1.0, 1.04, p), rot = L.lerp(-0.0028, 0.0028, p);
    const jr = L.rng('s08fr' + f);
    // film base
    ctx.fillStyle = '#050607'; ctx.fillRect(0, 0, W, H);
    L.blit(ctx, env, S.film, { zoom, rot, blend: 'screen' });
    // glow of the crust into the black
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.5 + 0.04 * jr(); ctx.drawImage(S.halo, 0, 0); ctx.restore();

    // the scan band: where it is this frame
    const bx = L.lerp(140, W - 140, p), bw = 225, tilt = 0.09;
    const bandGrad = (stops) => L.linear(ctx, -bw, 0, bw, 0, stops);
    const bandRect = (fn) => { ctx.save(); ctx.translate(bx, H / 2); ctx.rotate(tilt); fn(); ctx.fillRect(-bw, -H, bw * 2, H * 2); ctx.restore(); };

    // the lump — pushed in a touch under a fixed clip, so its contour stays exactly on the arc
    ctx.save();
    a.clipBelow(ctx, 0);
    L.cam(ctx, env, { zoom, rot }, () => ctx.drawImage(S.clump.cnv, S.clump.X0, S.clump.Y0));
    ctx.globalCompositeOperation = 'color-dodge';
    bandRect(() => { ctx.fillStyle = bandGrad([[0, '#000'], [0.2, '#090b0c'], [0.36, '#171c1f'], [0.5, '#2b3337'], [0.64, '#171c1f'], [0.8, '#090b0c'], [1, '#000']]); });
    ctx.globalCompositeOperation = 'screen';
    bandRect(() => { ctx.fillStyle = bandGrad([[0, 'rgba(215,225,230,0)'], [0.47, 'rgba(215,225,230,0)'], [0.5, 'rgba(215,225,230,0.14)'], [0.53, 'rgba(215,225,230,0)'], [1, 'rgba(215,225,230,0)']]); });
    ctx.restore();
    // the band barely lifts the bare film base too
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    bandRect(() => { ctx.fillStyle = bandGrad([[0, 'rgba(27,35,40,0)'], [0.5, 'rgba(27,35,40,0.13)'], [1, 'rgba(27,35,40,0)']]); });
    ctx.restore();

    // film grain, re-seated every frame
    L.overlayGrain(ctx, S.grain, 0.3, 'overlay', Math.floor(jr() * 96), Math.floor(jr() * 96));
    // a few flecks of noise on the black
    ctx.save();
    for (let i = 0; i < 70; i++) {
      const x = jr() * W, y = jr() * H, s = 0.8 + jr() * 1.4;
      ctx.fillStyle = `rgba(127,138,143,${(0.05 + 0.2 * jr()).toFixed(3)})`;
      ctx.fillRect(x, y, s, s);
    }
    ctx.restore();
  },
};
