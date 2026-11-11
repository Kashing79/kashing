// s08 — 钱坨的X光片. A radiograph (negative look: dense = white) of a hoard clump — cash coins rusted into one lump, in macro.
// The arc is the outer contour of the lump: a bright rind of corrosion and soil, a dark spongy seam of gas bubbles under it,
// then the milky core in which a few BIG coins lie — round, each with a SQUARE hole, every one at its own angle; where they
// overlap the film goes whiter. Above the arc: bare black film base.
//
// Everything below the arc is computed per pixel in init() the way an X-ray forms:
//   density = corrosion matrix (billows − rounded voids − foam cavities + membranes) + Σ coin thickness along the beam + rind
//   film    = 1 − exp(−density)   → tone ramp (film black → dark blue-grey → cold grey → white)
// then finished like a photograph: halation around the dense parts, focus held near the crest and falling off to the sides.
// draw() drifts the plate a little (rotation about the arc's centre keeps the contour on the arc), sweeps a soft scan band
// left → right and scatters a few flecks of noise.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 64;
const TOP = 96;                    // room above the crest inside the plate (for the glow of the rind)
let S = null;

const sstep = (a, b, v) => { let t = (v - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };

// ── allocation-free worley noise: squared distances in cD1 / cD2, ids of the two nearest cells in cId / cId2,
//    and cBd = distance to the wall between those two cells (in cell units) ──
let cD1 = 0, cD2 = 0, cId = 0, cId2 = 0, cBd = 0;
function cell(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let d1 = 9, d2 = 9, id = 0, id2 = 0, ax = 0, ay = 0, bx = 0, by = 0;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const cx = xi + ox, cy = yi + oy;
    let h = (Math.imul(cx, 374761393) + Math.imul(cy, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    const dx = cx + (h & 1023) / 1023 - x, dy = cy + ((h >>> 10) & 1023) / 1023 - y, d = dx * dx + dy * dy;
    if (d < d1) { d2 = d1; id2 = id; bx = ax; by = ay; d1 = d; id = ((h >>> 20) & 255) / 255; ax = dx; ay = dy; }
    else if (d < d2) { d2 = d; id2 = ((h >>> 20) & 255) / 255; bx = dx; by = dy; }
  }
  const sx = ax - bx, sy = ay - by;
  cD1 = d1; cD2 = d2; cId = id; cId2 = id2; cBd = (d2 - d1) / (2 * Math.sqrt(sx * sx + sy * sy) + 1e-6);
}

/** after cell(): signed distance (px) to the wall of the bubble we are in — a round bubble pressed flat against its
 *  neighbours. > 0 inside the cavity, < 0 in the solid between bubbles. `open` > 0 pushes the shared wall back (a burst wall). */
function cavity(scale, open) {
  const dd = (0.5 + 0.3 * cId) * scale - Math.sqrt(cD1) * scale, bd = (cBd + open) * scale;
  return bd < dd ? bd : dd;
}

/** where the coins lie inside the lump (offsets from the crest point). All much the same size, as in a real hoard. */
function layCoins(a) {
  const r = L.rng('s08-coins-macro');
  const ox = a.cx, oy = a.crestY;
  const coins = [];
  // c = cos(tilt): 1 = flat-on to the beam (a full circle), small = strongly tilted (a narrow ellipse)
  // soft = geometric unsharpness: coins far from the film come out blurred
  const add = (x, y, rc, c, psi, rot, gain, soft, o = {}) => coins.push({
    x: ox + x, y: oy + y, rc, c, psi, rot, gain, soft, seed: r.range(0, 90),
    hs: r.range(0.238, 0.262),     // half-side of the square hole / radius
    wr: r.range(0.125, 0.155),     // width of the outer rim (外郭) / radius
    ecc: r.range(0.12, 0.4), ea: r.range(0, L.TAU),          // the rim is never the same width all round
    hox: r.range(-0.03, 0.03), hoy: r.range(-0.03, 0.03),   // nor is the hole dead centre
    hq: [r.range(0.95, 1.05), r.range(0.95, 1.05), r.range(0.95, 1.05), r.range(0.95, 1.05)],   // nor its four sides alike
    eat: o.eat || 0,               // how far corrosion has eaten into the metal
    chip: o.chip || null,          // a bite out of the edge: [angle, size]
    wedge: r.range(-0.16, 0.16), wa: r.range(0, L.TAU),
  });
  // far coins first: soft ghosts that give the lump its depth
  add(835, 560, 276, 0.74, 1.15, 0.2, 0.36, 5);
  add(-430, 226, 276, 0.34, -0.2, 0.9, 0.3, 3.4);
  // a roll: coins once strung together, now one rusted cylinder seen at an angle → rings nested one inside the next
  {
    const c = 0.47, psi = 0.38, rc = 278, n = 5, sinT = Math.sqrt(1 - c * c), ax = -Math.sin(psi), ay = Math.cos(psi), pitch = rc * 0.13 * sinT;
    let s = -0.5 * (n - 1) * pitch;
    for (let i = 0; i < n; i++) {
      add(-720 + ax * s + r.range(-3, 3), 480 + ay * s + r.range(-3, 3), rc * r.range(0.98, 1.02), L.clamp(c + r.range(-0.03, 0.03), 0.2, 1),
        psi + r.range(-0.04, 0.04), r.range(0, Math.PI / 2), 0.26, 2.7);
      s += pitch * r.range(0.8, 1.25);
    }
  }
  // the three coins the eye lands on
  add(560, 270, 272, 0.3, 0.27, 0.5, 0.36, 2.3, { eat: 0.35 });
  add(240, 457, 276, 0.78, -0.6, 1.0, 0.7, 1.9, { eat: 0.5, chip: [2.5, 0.2] });
  add(-215, 396, 280, 0.955, 0.5, 0.33, 1.0, 1.8, { eat: 0.25, chip: [-2.2, 0.13] });
  return coins;
}

/** add every coin's metal thickness (along the beam) into C */
function castCoins(coins, C, RW, RH, X0, Y0) {
  const nz = L.makeNoise('s08-metal');
  for (const q of coins) {
    const rc = q.rc, c = q.c, cp = Math.cos(q.psi), sp = Math.sin(q.psi), cr = Math.cos(q.rot), sr = Math.sin(q.rot);
    const ext = rc * 1.03 + q.soft * 2 + 2, cheap = q.soft > 3;
    const bw = Math.sqrt((ext * cp) ** 2 + (ext * c * sp) ** 2) + 3, bh = Math.sqrt((ext * sp) ** 2 + (ext * c * cp) ** 2) + 3;
    const i0 = Math.max(0, Math.floor(q.x - bw - X0)), i1 = Math.min(RW - 1, Math.ceil(q.x + bw - X0));
    const j0 = Math.max(0, Math.floor(q.y - bh - Y0)), j1 = Math.min(RH - 1, Math.ceil(q.y + bh - Y0));
    const gain = q.gain * Math.min(2.2, 1 / c);          // a tilted coin puts more metal in the beam
    const hs = q.hs * rc, hi = hs + 0.072 * rc, rin = rc * (1 - q.wr), ext2 = ext * ext, k1 = 2.2 / rc, k2 = 7.4 / rc;
    const wx = Math.cos(q.wa) * q.wedge / rc, wy = Math.sin(q.wa) * q.wedge / rc;
    const hq = q.hq;
    const ex = Math.cos(q.ea) * q.ecc, ey = Math.sin(q.ea) * q.ecc, hox = q.hox * rc, hoy = q.hoy * rc, wrc = q.wr * rc;
    const chx = q.chip ? Math.cos(q.chip[0]) * rc * 1.04 : 0, chy = q.chip ? Math.sin(q.chip[0]) * rc * 1.04 : 0, chr = q.chip ? q.chip[1] * rc : 0;
    for (let j = j0; j <= j1; j++) {
      const dy = Y0 + j - q.y;
      for (let i = i0; i <= i1; i++) {
        const dx = X0 + i - q.x;
        const u = dx * cp + dy * sp, v = (-dx * sp + dy * cp) / c;
        const rho2 = u * u + v * v; if (rho2 > ext2) continue;
        const rho = Math.sqrt(rho2);
        const aa = q.soft * (rho > 1 ? Math.sqrt(u * u + (v / c) * (v / c)) / rho : 1);   // one screen px, measured on the coin
        const lx = u * cr + v * sr, ly = -u * sr + v * cr;
        const hx = lx - hox, hy = ly - hoy;
        const ax = hx < 0 ? -hx * hq[0] : hx * hq[1], ay = hy < 0 ? -hy * hq[2] : hy * hq[3];
        let sq = ax > ay ? ax : ay;                                          // square distance → SQUARE hole
        if (sq < hi * 1.3) { const t = ax > ay ? ay / ax : ax / (ay + 1e-6), t2 = t * t; sq *= 1 + 0.05 * t2 * t2; }   // corners a touch worn
        const hole = 1 - sstep(hs - aa, hs + aa, sq);
        if (hole >= 1) continue;
        const m1 = nz.n2(lx * k1 + q.seed, ly * k1 - q.seed * 0.7), m2 = cheap ? 0 : nz.n2(lx * k2 - q.seed, ly * k2 + 3.1);
        const re = rc * (1 + 0.008 * m2 + 0.02 * m1);                       // a worn, slightly nibbled edge
        let disc = 1 - sstep(re - aa, re + aa, rho);
        if (disc <= 0) continue;
        if (chr) { const cd = Math.sqrt((lx - chx) * (lx - chx) + (ly - chy) * (ly - chy)) + 0.2 * chr * m1 + 0.12 * chr * m2; disc *= sstep(chr - aa * 1.5, chr + aa * 1.5, cd); }
        const rinL = rho > 1 ? rc - wrc * (1 + (lx * ex + ly * ey) / rho) : rin;
        const rim = sstep(rinL - aa * 2.4, rinL + aa * 1.3, rho);            // 外郭
        const inr = 1 - sstep(hi - aa * 1.3, hi + aa * 2.4, sq);             // 内郭
        const relief = rim > inr ? rim : inr;
        let field = 0.5 * (0.86 + 0.3 * m1 + 0.13 * m2) * (1 + lx * wx + ly * wy);
        field *= 1 - 0.42 * sstep(0.42, 0.8, m2);                            // pitting
        let top = (1.12 + 0.08 * m2) * (0.86 + 0.14 * sstep(-0.5, 0.3, m1));   // the raised rims are worn unevenly
        if (q.eat) { const e = q.eat * sstep(0.05, 0.6, m1 * 0.85 + m2 * 0.3); field *= 1 - e; top *= 1 - 0.6 * e; }
        C[j * RW + i] += disc * (1 - hole) * (field + (top - field) * relief) * gain;
      }
    }
  }
}

/** the radiograph of the lump: everything below the arc (cropped canvas, origin at X0,Y0 in frame coords) */
function buildClump(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const X0 = -PAD, Y0 = Math.floor(a.crestY) - TOP;
  const RW = W + PAD * 2, RH = H + PAD - Y0, N = RW * RH;
  const nA = L.makeNoise('s08a'), nB = L.makeNoise('s08b'), nC = L.makeNoise('s08c');
  const coins = layCoins(a), hero = coins[coins.length - 1], second = coins[coins.length - 2];

  // 1) slow fields on a coarse grid
  const CS = 6, cw = Math.ceil(RW / CS) + 2, ch = Math.ceil(RH / CS) + 2, CN = cw * ch;
  const fWx = new Float32Array(CN), fWy = new Float32Array(CN), fVx = new Float32Array(CN), fVy = new Float32Array(CN),
    fBody = new Float32Array(CN), fVoid = new Float32Array(CN), fSh1 = new Float32Array(CN), fRel = new Float32Array(CN),
    fGate = new Float32Array(CN), fPk = new Float32Array(CN), fTk = new Float32Array(CN), fWsp = new Float32Array(CN), fMem = new Float32Array(CN);
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const px = X0 + i * CS, py = Y0 + j * CS, k = j * cw + i;
    const ddx = px - cx, ddy = cy - py, dp = R - Math.sqrt(ddx * ddx + ddy * ddy), al = Math.atan2(ddx, ddy) * R;
    const wx = nA.fbm(px / 340, py / 340, 2), wy = nA.fbm(px / 340 + 40, py / 340 - 17, 2);
    fWx[k] = wx; fWy[k] = wy;
    fVx[k] = nA.fbm(px / 70 + 3, py / 70 + 71, 2); fVy[k] = nB.fbm(px / 70 - 47, py / 70 + 13, 2);
    const ux = px + 120 * wx, uy = py + 120 * wy;
    // the matrix: slow billows, a little denser to the upper left, thinning toward the lower right
    fBody[k] = 1.3 + 0.3 * nB.fbm(ux / 460, uy / 460, 3) - 0.24 * L.clamp((ddx + 0.7 * (py - a.crestY) - 420) / 800, -1, 1);
    // rounded hollows (smooth dark pockets, each with a firm bright lip): few and large, mostly on the right;
    // one sits behind the hero coin's hole so that the square reads dark
    const hx = (px - hero.x) / 170, hy = (py - hero.y) / 130;
    const qx = (px - (cx + 760)) / 260, qy = (py - (a.crestY + 470)) / 150;
    fVoid[k] = nA.fbm(ux / 400 + 9, uy / 330 - 3, 3) - 0.3 + 0.14 * L.clamp(ddx / 700, -1, 1) + 0.2 * sstep(300, 520, dp)
      + 0.75 * Math.exp(-(hx * hx + hy * hy)) + 0.5 * Math.exp(-(qx * qx + qy * qy));
    // thin overlapping flakes of corrosion (each a plateau with a crisp contour)
    fSh1[k] = nB.fbm(ux / 360 - 21, uy / 300 + 5, 3);
    // the spongy seam under the rind: wide and deep from the crest to the right, a thin seam elsewhere; a few pockets deeper in
    const run = sstep(-470, -150, al) * (1 - sstep(400, 780, al));
    const d0 = 138 + 26 * nA.n2(al / 380, 1.7) + 30 * run;
    const hh = 26 + 74 * run + 16 * nA.n2(al / 210, 5.3);
    const rag = 0.4 * nB.fbm(px / 150 + 5, py / 150 - 8, 3);
    const rel = (dp - d0) / hh;
    const g = (1 - sstep(0.6, 1.08, Math.abs(rel) + rag)) * (0.5 + 0.5 * run);
    fGate[k] = g; fRel[k] = rel;
    const clear = sstep(0.8, 1.2, Math.hypot(px - hero.x, py - hero.y) / hero.rc) * sstep(0.75, 1.15, Math.hypot(px - second.x, py - second.y) / second.rc);
    fPk[k] = sstep(0.22, 0.44, nC.fbm(ux / 230 - 4, uy / 200 + 12, 3)) * sstep(270, 420, dp) * 0.85 * clear;   // gas pockets between the coins
    fMem[k] = nC.fbm(px / 95 + 31, py / 95 - 9, 2);
    // the rind: thickness along the arc, and a wispy underside
    fTk[k] = 31 + 17 * nA.n2(al / 430, 3.1) + 8 * nA.n2(al / 95, 8.2);
    fWsp[k] = 11 * nB.fbm(al / 130, dp / 60, 3) + 4 * nB.n2(al / 38, dp / 30);
  }

  const tA = performance.now();
  // 2) the coins
  const C = new Float32Array(N);
  castCoins(coins, C, RW, RH, X0, Y0);

  const tB = performance.now();
  // 3) film response — the task card's five tones only (film black → dark blue-grey → cold grey → grey-white → white);
  //    a grey-and-black negative, deliberately NOT the saturated blue of a hospital film
  const ramp = L.makeRamp([[0, '#050607'], [0.1, '#0b1013'], [0.25, '#1b2328'], [0.42, '#4b585f'], [0.58, '#7f8a8f'], [0.75, '#b6c0c4'], [0.88, '#d7dde0'], [1, '#f6f8f9']]);
  const NL = 2048, lut = new Uint8ClampedArray(NL * 3);
  for (let i = 0; i < NL; i++) { const c = ramp(i / (NL - 1)); lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2]; }

  const img = new ImageData(RW, RH), d = img.data;
  const HS = 4, hw = Math.ceil(RW / HS), hh2 = Math.ceil(RH / HS), hot = new Float32Array(hw * hh2);
  const vcx = cx - 150, vcy = a.crestY + 130;
  for (let j = 0; j < RH; j++) {
    const py = Y0 + j, ddy = cy - py;
    const fy = j / CS, cj = fy | 0, ty = fy - cj;
    for (let i = 0; i < RW; i++) {
      const px = X0 + i, ddx = px - cx, rr = Math.sqrt(ddx * ddx + ddy * ddy), dp = R - rr;   // dp = depth below the contour
      if (dp < -3) continue;
      const k = j * RW + i;
      // bilinear weights into the coarse fields
      const fx = i / CS, ci = fx | 0, tx = fx - ci, kk = cj * cw + ci, kb = kk + cw;
      const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
      const wx = fWx[kk] * w00 + fWx[kk + 1] * w10 + fWx[kb] * w01 + fWx[kb + 1] * w11;
      const wy = fWy[kk] * w00 + fWy[kk + 1] * w10 + fWy[kb] * w01 + fWy[kb + 1] * w11;
      const vx = fVx[kk] * w00 + fVx[kk + 1] * w10 + fVx[kb] * w01 + fVx[kb + 1] * w11;
      const vy = fVy[kk] * w00 + fVy[kk + 1] * w10 + fVy[kb] * w01 + fVy[kb + 1] * w11;
      let m = fBody[kk] * w00 + fBody[kk + 1] * w10 + fBody[kb] * w01 + fBody[kb + 1] * w11;
      const vd = fVoid[kk] * w00 + fVoid[kk + 1] * w10 + fVoid[kb] * w01 + fVoid[kb + 1] * w11;
      const s1 = fSh1[kk] * w00 + fSh1[kk + 1] * w10 + fSh1[kb] * w01 + fSh1[kb + 1] * w11;
      let G = fGate[kk] * w00 + fGate[kk + 1] * w10 + fGate[kb] * w01 + fGate[kb + 1] * w11;
      const tk = fTk[kk] * w00 + fTk[kk + 1] * w10 + fTk[kb] * w01 + fTk[kb + 1] * w11;
      const wsp = fWsp[kk] * w00 + fWsp[kk + 1] * w10 + fWsp[kb] * w01 + fWsp[kb + 1] * w11;

      // a flake: a plateau with a crisp contour, like a sheet of rust lying over the rest
      if (s1 > 0.14) m += 0.24 * Math.sqrt(Math.min(1, (s1 - 0.14) / 0.5));
      // rounded hollows: steep at the lip, flat inside (the projection of a round hollow), with a denser lip around them
      if (vd > 0) m *= 1 - 0.66 * Math.pow(Math.min(1, vd / 0.5), 0.55 + 1.1 * L.clamp(0.5 + 1.4 * wy));   // here a firm lip, there a slow slope
      else if (vd > -0.09) { const lp = 1 + vd / 0.09; m += 0.16 * lp * lp; }
      // fine corrosion mottle
      m *= 0.95 + 0.07 * nC.n2(px / 27, py / 27) + 0.035 * nA.n2(px / 9 + 50, py / 9);

      // the rind: a shell seen edge-on — brightest where the beam grazes its inner face, tailing off inward
      const q = (dp + wsp) / tk;
      let sh = 0;
      if (q > 0 && q < 6) {
        sh = (Math.sqrt(q) - (q > 1 ? Math.sqrt(q - 1) : 0)) * (1 - sstep(2.4, 6, q));
        sh *= 1.2 + (q < 2 ? 0.26 * (1 - sstep(1, 2, q)) * nB.n2((ddx / rr) * R / 140, dp / 9) : 0);   // faint laminations
      }
      G *= sstep(0.8, 1.7, q);

      // foam — an X-ray of bubbles: round cavities pressed against one another, each dark in the middle and brightening
      // toward its wall (the beam runs along the membrane there). Big cells low in the seam, a lace of small ones toward
      // the rind, a fainter net behind (the foam has depth), a few smoke-thin filaments across.
      let rel = 0.6;
      const pk = fPk[kk] * w00 + fPk[kk + 1] * w10 + fPk[kb] * w01 + fPk[kb + 1] * w11;
      if (pk > G) G = pk; else rel = fRel[kk] * w00 + fRel[kk + 1] * w10 + fRel[kb] * w01 + fRel[kb + 1] * w11;
      if (G > 0.012) {
        const ux = px + 60 * wx + 5 * vx, uy = py + 60 * wy + 5 * vy;
        const mem = fMem[kk] * w00 + fMem[kk + 1] * w10 + fMem[kb] * w01 + fMem[kb + 1] * w11;
        const core = sstep(0.2, 0.68, G), upper = 1 - sstep(-0.6, 0.25, rel);
        // big cells (bigger and emptier low in the seam)
        cell(ux / 168, uy / 132);
        let pr = (cId + cId2) * 37.7; pr -= Math.floor(pr);
        let cd = cavity(150, pr < 0.3 ? 0.14 : 0), w = 1.0 + 2.4 * pr;
        const in1 = sstep(w, w + 2.6, cd), F1 = (1 - in1) + in1 * (0.5 * Math.exp(-(cd - w) / 15) + 0.24 * Math.exp(-(cd - w) / 4.5));
        // the net behind: membranes only
        cell(ux / 92 - 3.9, uy / 80 + 21.7);
        let bd = cBd * 86;
        const F3 = 0.5 * (1 - sstep(0.8, 3.0, bd)) + 0.16 * Math.exp(-bd / 9);
        // lace of small cells
        cell(ux / 47 + 11.3 + 0.12 * vy, uy / 42 - 7.1 + 0.12 * vx);
        cd = cavity(44, 0);
        const in2 = sstep(0.9, 2.9, cd), lip2 = Math.exp(-(cd - 0.9) / 7), F2 = (1 - in2) + in2 * 0.5 * lip2;
        // filaments
        const f1 = 1 - Math.abs(nB.n2(ux / 96 + 1.2 * wx, uy / 96 + 1.2 * wy));
        const fil = Math.pow(f1, 18) * 0.5 * sstep(-0.4, 0.2, vy + mem);
        const foam = 0.02 + 0.13 * upper + F1 * (0.95 - 0.5 * upper) + F3 * (0.5 + 0.3 * upper) * (0.35 + 0.65 * sstep(-0.5, 0.3, mem)) + F2 * (0.02 + 0.66 * upper) + fil * (0.4 + 0.6 * upper);
        m = m * (1 - core) + 1.1 * foam * core;
        // on the fringe the solid matrix is only nibbled by small bubbles
        const fr = sstep(0.02, 0.24, G) * (1 - core);
        m *= 1 - 0.8 * fr * in2 * (1 - 0.65 * lip2);
        sh *= 1 - 0.8 * core;
      }

      const edge = sstep(-1.4, 1.4, dp - 1.3 * (1 + vx));                  // the contour, on the arc (≤ 3 px of wobble inward)
      const x = m + sh + C[k];
      let v = 1 - Math.exp(-x);
      // the lump thickens and the film darkens away from the crest; film mottle
      const vdx = (px - vcx) / 1.5, vdy = py - vcy;
      v *= 1 - 0.26 * sstep(400, 1080, Math.sqrt(vdx * vdx + vdy * vdy));
      let h = (Math.imul(i >> 1, 374761393) ^ Math.imul(j >> 1, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177);
      v += (((h ^ (h >>> 16)) & 1023) / 1023 - 0.5) * 0.035 * (0.4 + v);
      v = v < 0 ? 0 : v > 1 ? 1 : v;
      const li = ((v * (NL - 1)) | 0) * 3, o = k * 4;
      d[o] = lut[li]; d[o + 1] = lut[li + 1]; d[o + 2] = lut[li + 2]; d[o + 3] = edge * 255;
      if (v > 0.78) hot[(j >> 2) * hw + (i >> 2)] += sstep(0.78, 0.99, v) * edge * 0.0625;
    }
  }
  const tC = performance.now();
  const sharp = L.makeCanvas(RW, RH), g = sharp.getContext('2d');
  g.putImageData(img, 0, 0);
  // halation: the densest parts bloom a little into their surroundings (and, at the rind, a breath into the black above)
  const hc = L.makeCanvas(hw, hh2), hg = hc.getContext('2d'), himg = new ImageData(hw, hh2), hd = himg.data;
  for (let i = 0; i < hw * hh2; i++) { hd[i * 4] = 206; hd[i * 4 + 1] = 218; hd[i * 4 + 2] = 226; hd[i * 4 + 3] = Math.min(1, hot[i]) * 255; }
  hg.putImageData(himg, 0, 0);
  g.save();
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.globalCompositeOperation = 'screen';
  g.filter = 'blur(4px)'; g.globalAlpha = 0.16; g.drawImage(hc, 0, 0, hw * HS, hh2 * HS);
  g.filter = 'blur(20px)'; g.globalAlpha = 0.09; g.drawImage(hc, 0, 0, hw * HS, hh2 * HS);
  g.restore();
  // depth of field: focus held around the crest (and along the rind), falling off toward the sides and the bottom
  const out = L.blurred(sharp, 6), og = out.getContext('2d');
  const mask = L.makeCanvas(RW, RH), mg = mask.getContext('2d');
  mg.save();
  mg.translate(cx - X0 - 30, a.crestY - Y0 + 160); mg.scale(1.8, 1);
  mg.fillStyle = L.radial(mg, 0, 0, 180, 540, [[0, 'rgba(0,0,0,1)'], [0.45, 'rgba(0,0,0,0.7)'], [1, 'rgba(0,0,0,0)']]);
  mg.fillRect(-RW, -RH, RW * 2, RH * 2);
  mg.restore();
  mg.translate(-X0, -Y0);
  mg.filter = 'blur(14px)'; mg.strokeStyle = 'rgba(0,0,0,0.8)'; mg.lineWidth = 64; a.stroke(mg, -14);
  mg.filter = 'none';
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(mask, 0, 0);
  og.drawImage(sharp, 0, 0);
  og.getImageData(0, 0, 1, 1);
  console.warn('s08 coins', (tB - tA) | 0, 'pixels', (tC - tB) | 0, 'post', (performance.now() - tC) | 0);
  return { cnv: out, X0, Y0 };
}

/** the bare film base: faint fog, a few hairline scratches, dust */
function buildFilm() {
  const c = L.makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#050607'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'screen';
  g.drawImage(L.noiseTex(W, H, { seed: 's08fog', scale: 700, octaves: 3, res: 0.125, ramp: [[0, 'rgba(27,35,40,0)'], [0.45, 'rgba(27,35,40,0)'], [1, 'rgba(27,35,40,0.34)']] }), 0, 0);
  const r = L.rng('s08film');
  g.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const x = r.range(0, W), y = r.range(-80, H * 0.7), ang = Math.PI / 2 + r.gauss() * 0.16, len = r.range(90, 560), bend = r.range(-16, 16);
    g.strokeStyle = L.rgba('#7f8a8f', r.range(0.03, 0.09)); g.lineWidth = r.range(0.5, 1.2);
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(ang) * len * 0.5 + bend, y + Math.sin(ang) * len * 0.5, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    g.stroke();
  }
  L.speckle(g, { seed: 's08dust', count: 120, x: 0, y: 0, w: W, h: H, rMin: 0.4, rMax: 1.4, colors: ['#7f8a8f', '#d7dde0'], alpha: [0.05, 0.24] });
  return c;
}

export default {
  name: '钱坨的X光片',
  tone: 'light',
  init(env) {
    const t0 = performance.now();
    const clump = buildClump(env);
    const t1 = performance.now();
    S = { clump, film: buildFilm() };
    console.warn('s08 timing clump', (t1 - t0) | 0, 'film', (performance.now() - t1) | 0);
  },
  draw(ctx, env, p) {
    const f = env.frame | 0;
    const zoom = L.lerp(0.99, 1.016, p), rot = L.lerp(-0.004, 0.004, p);
    const jr = L.rng('s08fr' + f);
    // film base
    ctx.drawImage(S.film, 0, 0);
    // the lump: it drifts along the arc and comes a touch closer; its contour stays on the arc
    L.cam(ctx, env, { zoom, rot }, () => ctx.drawImage(S.clump.cnv, S.clump.X0, S.clump.Y0));
    // the scan band: a broad soft lift of the mid-tones, travelling left → right (does nothing to the black)
    const bx = L.lerp(60, W - 60, p), bw = 300;
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.translate(bx, H / 2); ctx.rotate(0.07);
    ctx.fillStyle = L.linear(ctx, -bw, 0, bw, 0, [[0, '#808080'], [0.3, '#8e9396'], [0.5, '#a9b0b4'], [0.7, '#8e9396'], [1, '#808080']]);
    ctx.fillRect(-bw, -80, bw * 2, H);
    ctx.restore();
    // a few flecks of noise on the film, new every frame
    for (let i = 0; i < 46; i++) {
      const x = jr() * W, y = jr() * H, s = 0.8 + jr() * 1.5;
      ctx.fillStyle = `rgba(127,138,143,${(0.05 + 0.2 * jr()).toFixed(3)})`;
      ctx.fillRect(x, y, s, s);
    }
  },
};
