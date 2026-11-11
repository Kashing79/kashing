// s29 — 白瓷研钵. Macro of the outer wall of a white porcelain mortar: the arc is the outer silhouette of its thick,
// rounded lip. Below the arc the glazed wall — warm white, faint throwing rings, a few pinholes, powder-dusted finger marks,
// one underglaze cobalt line under the lip; lit from the upper left, the right third lying in a soft warm-grey cast shadow.
// Above the arc: finely ground cinnamon-brown powder heaped behind the mortar, rising and falling like small dunes.
//
// Both halves are shaded per pixel in init():
//   bowl   — every pixel is mapped to (U = distance along the rim, s = distance below the lip edge); a macro profile (rounded
//            lip → undercut → gently turning wall) plus a micro height field (throwing rings, glaze orange-peel, pinholes)
//            gives a normal that is lit with a wrapped diffuse term; the glossy highlights go to a separate layer so that
//            draw() can let them slide a little against the surface.
//   powder — a dune height field on a coarse grid (lit by a raking light with marched cast shadows) plus full-resolution
//            lumps, clods and grains; flattened to plain fine powder inside the text-safe zone above the crest.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 96;
const LIP = 92;          // height of the rounded lip (px)
const RB = 1700;         // how quickly the wall turns away to the left / right (px of arc per unit of normal)
let S = null;

const sstep = (a, b, v) => { let t = (v - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const c01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ── cheap integer-hash value noise for the per-pixel passes (simplex is kept for the slow fields) ──
function hash(ix, iy) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vn(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * fx + (c - a + (a - b - c + d) * fx) * fy;
}

const UO = 1500, UN = UO * 2 + 4;
const uAt = (t, U) => { let f = U + UO; if (f < 0) f = 0; else if (f > UN - 2) f = UN - 2; const i = f | 0; return t[i] + (t[i + 1] - t[i]) * (f - i); };

/** the porcelain: everything below the arc. Returns { bowl, spec } (canvases cropped to the rows below the crest) */
function buildBowl(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const X0 = -PAD, Y0 = Math.floor(a.crestY) - 2;
  const RW = W + PAD * 2, RH = H + PAD - Y0, N = RW * RH;
  const nA = L.makeNoise('s29a'), nB = L.makeNoise('s29b');
  const toXY = (U, s) => { const rr = R - s, th = U / R; return [cx + rr * Math.sin(th), cy - rr * Math.cos(th)]; };

  // ── profiles over s (px below the lip edge) ──
  const TS = 4, SMAX = 760, TN = SMAX * TS + 4;
  const tNr = new Float32Array(TN), tAo = new Float32Array(TN), tRing = new Float32Array(TN);
  const aL = LIP / 2, s1 = LIP * 0.78, s2 = LIP * 1.16;
  for (let i = 0; i < TN; i++) {
    const s = i / TS;
    let nr;
    if (s <= s1) nr = -(s - aL) / aL;                                              // the lip: a half-round bead
    else if (s <= s2) nr = L.lerp(-(s1 - aL) / aL, -0.05, sstep(s1, s2, s));       // undercut fillet back to the wall
    else nr = -0.05 - 0.22 * Math.pow((s - s2) / 600, 1.25);                       // the belly slowly turns under
    tNr[i] = nr;
    const q = (s - LIP * 0.98) / (LIP * 0.17);
    tAo[i] = 1 - 0.2 * Math.exp(-q * q);
    tRing[i] = 0.4 * nA.n2(s / 31, 1.7) + 0.18 * nA.n2(s / 11.7 + 40, 5.1) + 0.08 * nA.n2(s / 4.6 + 80, 9.3);   // throwing rings (px of height)
  }
  const sAt = (t, s) => { let f = s * TS; if (f < 0) f = 0; else if (f > TN - 2) f = TN - 2; const i = f | 0; return t[i] + (t[i + 1] - t[i]) * (f - i); };

  // ── things that only vary along the rim ──
  const tW = new Float32Array(UN), tC = new Float32Array(UN), tD = new Float32Array(UN), tLip = new Float32Array(UN), tGrv = new Float32Array(UN);
  for (let i = 0; i < UN; i++) {
    const U = i - UO;
    tW[i] = 11 + 2.4 * nA.n2(U / 430, 21.3) + 0.9 * nA.n2(U / 61, 3.3) + 0.35 * nA.n2(U / 13, 8.8);   // half-width of the cobalt line
    tC[i] = 1.6 * nB.n2(U / 520, 4.2) + 0.5 * nB.n2(U / 47, 17.7);                                       // its centre wanders a hair
    tD[i] = 0.5 + 0.5 * nB.fbm(U / 210, 31.9, 3);                                                        // how loaded the brush was
    tLip[i] = Math.max(0, nA.fbm(U / 240, 77.1, 3) + 0.05) * 2;                                          // powder fallen on the lip
    tGrv[i] = Math.max(0, nB.fbm(U / 170, 55.5, 3) + 0.1) * 1.7;                                         // powder caught under the lip
  }

  // ── slow 2-D fields on a coarse grid ──
  const CS = 4, cw = Math.ceil(RW / CS) + 2, ch = Math.ceil(RH / CS) + 2;
  const cWob = new Float32Array(cw * ch), cAmp = new Float32Array(cw * ch), cTone = new Float32Array(cw * ch);
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const ddx = X0 + i * CS - cx, ddy = cy - (Y0 + j * CS), rr = Math.hypot(ddx, ddy);
    const U = Math.atan2(ddx, ddy) * R, s = R - rr, k = j * cw + i;
    cWob[k] = 7 * nA.fbm(U / 620, s / 240, 2);
    cAmp[k] = 0.8 + 0.55 * nA.fbm(U / 380 + 9, s / 90 + 3, 2);
    cTone[k] = nB.fbm(U / 520 - 4, s / 420 + 11, 3);
  }
  const bil = (src, i, j) => {
    const fx = i / CS, fy = j / CS, i0 = fx | 0, j0 = fy | 0, tx = fx - i0, ty = fy - j0, k = j0 * cw + i0;
    const a0 = src[k], a1 = src[k + 1], b0 = src[k + cw], b1 = src[k + cw + 1];
    return (a0 + (a1 - a0) * tx) * (1 - ty) + (b0 + (b1 - b0) * tx) * ty;
  };

  // ── pass 1: polar coordinates + micro height field ──
  const Ua = new Float32Array(N), Sa = new Float32Array(N), Hh = new Float32Array(N), Cv = new Float32Array(N), PM = new Float32Array(N);
  for (let j = 0; j < RH; j++) {
    const y = Y0 + j, ddy = cy - y;
    for (let i = 0; i < RW; i++) {
      const k = j * RW + i, x = X0 + i, ddx = x - cx, rr = Math.sqrt(ddx * ddx + ddy * ddy);
      if (rr > R + 2) { Sa[k] = -9; continue; }
      const s = R - rr, U = Math.atan2(ddx, ddy) * R;
      Ua[k] = U; Sa[k] = s;
      const ring = sAt(tRing, s + bil(cWob, i, j)) * bil(cAmp, i, j) * (0.45 + 0.55 * sstep(LIP * 0.9, LIP * 1.4, s));
      Hh[k] = ring + 0.07 * vn(x / 9.5, y / 9.5) + 0.03 * vn(x / 3.9 + 7, y / 3.9 + 3);   // + the glaze's faint orange-peel
    }
  }

  // ── pinholes (棕眼): small pits where the glaze crawled back from a burst bubble ──
  const rp = L.rng('s29pits');
  const pits = [[-560, 250, 4.6], [-120, 215, 3.4], [-415, 452, 5.4], [205, 300, 3.8], [-760, 330, 3.2], [330, 470, 4.4], [-30, 372, 2.6]];
  for (let n = 0; n < 16; n++) pits.push([rp.range(-1200, 1200), rp.range(LIP * 1.75, 600), rp.range(2, 4.6)]);
  for (const [U0, s0, rad] of pits) {
    const [px, py] = toXY(U0, s0), depth = rad * 0.5, e = Math.ceil(rad * 1.5) + 2;
    for (let j = Math.max(1, Math.floor(py - e - Y0)); j <= Math.min(RH - 2, Math.ceil(py + e - Y0)); j++) {
      for (let i = Math.max(1, Math.floor(px - e - X0)); i <= Math.min(RW - 2, Math.ceil(px + e - X0)); i++) {
        const k = j * RW + i; if (Sa[k] < 0) continue;
        const dx = X0 + i - px, dy = Y0 + j - py, d2 = (dx * dx + dy * dy) / (rad * rad * 2.25);
        if (d2 >= 1) continue;
        const f = (1 - d2) * (1 - d2);
        Hh[k] -= depth * f; Cv[k] = Math.max(Cv[k], Math.min(1, f * f * 2.4));
      }
    }
  }

  // ── finger marks: powder left by a dusty fingertip, caught on the friction ridges ──
  function print(U0, s0, ra, rb, ang, lam, strength, so) {
    const [px, py] = toXY(U0, s0), ca = Math.cos(ang), sa = Math.sin(ang), e = Math.ceil(Math.max(ra, rb) * 1.3) + 4;
    const i0 = Math.max(0, Math.floor(px - e - X0)), i1 = Math.min(RW - 1, Math.ceil(px + e - X0));
    const j0 = Math.max(0, Math.floor(py - e - Y0)), j1 = Math.min(RH - 1, Math.ceil(py + e - Y0));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * RW + i; if (Sa[k] < 0) continue;
      const dx = X0 + i - px, dy = Y0 + j - py, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
      const rag = 1 + 0.44 * (vn(i / 31 + so, j / 31) - 0.5) + 0.2 * (vn(i / 9, j / 9 + so) - 0.5);
      const d = Math.sqrt((u / ra) * (u / ra) + (v / rb) * (v / rb)) * rag;
      if (d >= 1.14) continue;
      const base = 1 - sstep(0.6, 1.12, d);
      // arches over a core low in the pad, opening downward
      const v0 = rb * 0.18, wv = 10 * (vn(i / 46 + 3 + so, j / 46 + 7) - 0.5);
      const ph = (v < v0 ? Math.hypot(u * 0.86, v - v0) : Math.abs(u * 0.86) + 0.3 * (v - v0)) + wv;
      const rd = 0.5 + 0.5 * Math.cos(ph * 6.2832 / lam);
      const patch = 0.4 + 0.6 * vn(i / 27 + 60 + so, j / 27 + 13);
      const q = (d - 0.84) / 0.12;
      const cres = Math.exp(-q * q) * sstep(-0.2, 0.7, -v / rb) * 0.55;   // the leading edge pushes a denser crescent
      const val = strength * (base * (0.14 + 0.86 * rd * rd) * patch + cres * (0.45 + 0.55 * rd));
      if (val > PM[k]) PM[k] = val;
    }
  }
  print(-205, 392, 120, 164, -0.22, 10.5, 0.66, 0);
  print(62, 446, 104, 142, 0.17, 10.5, 0.4, 40);
  print(640, 352, 96, 124, 0.5, 10.5, 0.34, 80);

  // ── pass 2: shade ──
  const img = new ImageData(RW, RH), d = img.data, simg = new ImageData(RW, RH), sd = simg.data;
  let LX = -0.42, LY = 0.62, LZ = 0.66; { const m = Math.hypot(LX, LY, LZ); LX /= m; LY /= m; LZ /= m; }
  let HX = LX, HY = LY, HZ = LZ + 1; { const m = Math.hypot(HX, HY, HZ); HX /= m; HY /= m; HZ /= m; }
  const KM = 3.0;                       // how strongly the micro relief tilts the normal
  const NT0 = -0.235;                   // where the soft-box reflection sits on the wall (normal's sideways component)
  const SB = LIP + 46;                  // cobalt line: distance below the lip edge
  const crestY = a.crestY;
  for (let j = 1; j < RH - 1; j++) {
    const y = Y0 + j, ddy = cy - y, yy = y - crestY;
    const xb0 = 1210 + 0.52 * yy + 14 * Math.sin(yy / 140 + 0.6), pen = 20 + 0.13 * Math.max(0, yy);
    for (let i = 1; i < RW - 1; i++) {
      const k = j * RW + i; let s = Sa[k];
      if (s < -1) continue;
      const cov = c01(s + 0.5); if (s < 0) s = 0;
      const x = X0 + i, ddx = x - cx, rr = R - Sa[k], sn = ddx / rr, cs = ddy / rr, U = Ua[k];
      // macro normal in the local frame (t = along the rim, r = outward, z = toward the lens)
      const nr = sAt(tNr, s), nt = U / RB;
      const onLip = 1 - sstep(LIP * 0.7, LIP * 1.2, s);
      const hx = (Hh[k + 1] - Hh[k - 1]) * 0.5, hy = (Hh[k + RW] - Hh[k - RW]) * 0.5;
      const ntp = nt - KM * (hx * cs + hy * sn), nrp = nr - KM * (hx * sn - hy * cs);
      const nz = Math.sqrt(Math.max(0.02, 1 - ntp * ntp - nrp * nrp));
      const Lt = LX * cs - LY * sn, Lr = LX * sn + LY * cs;
      const lit = sstep(-0.15, 0.9, ntp * Lt + nrp * Lr + nz * LZ);
      // the cast shadow over the right third
      const sh = sstep(xb0 - pen, xb0 + pen, x + 12 * Math.sin(Math.PI * c01(s / LIP)) * onLip);
      const direct = lit * (1 - 0.95 * sh);
      const ambK = sAt(tAo, s) * (1 - 0.07 * sstep(280, 640, s)) * (1 - 0.1 * sh * sstep(0, 700, x - xb0));
      const up = nrp > 0 ? nrp : 0;
      const eR = 0.76 * ambK + 0.05 * up + 0.286 * direct, eG = 0.72 * ambK + 0.012 * up + 0.333 * direct, eB = 0.675 * ambK - 0.03 * up + 0.387 * direct + 0.012 * sh;

      // ── albedo ──
      const tone = bil(cTone, i, j), hk = Hh[k];
      let ar = 0.957 * (1 + 0.012 * tone + 0.016 * hk), ag = 0.941 * (1 + 0.008 * tone + 0.018 * hk), ab = 0.902 * (1 - 0.006 * tone + 0.022 * hk);
      const pq = (s - LIP * 1.05) / (LIP * 0.085), pool = Math.exp(-pq * pq);          // glaze pools a touch greener under the lip
      ar *= 1 - 0.07 * pool; ag *= 1 - 0.025 * pool; ab *= 1 - 0.01 * pool;
      // the cobalt line, painted on the wheel under the glaze
      let jb = 0; if (U > -650 && U < -555) jb = Math.sin(Math.PI * (U + 650) / 95);   // where the brush lapped its own start
      const hw = uAt(tW, U) + 2.6 * jb, sC = SB + uAt(tC, U) + 1.8 * jb, e = Math.abs(s - sC) - hw;
      if (e < 16) {
        const m = 1 - sstep(-1.4, 1.4, e), halo = e > 0 ? 0.2 * Math.exp(-e / 3.4) : 0.2;
        let dn = 0.6 + 0.3 * uAt(tD, U) + 0.16 * sstep(-hw, hw, s - sC) - 0.36 * (vn(U / 55, s / 1.8) - 0.5) + 0.22 * jb
          + 0.28 * sstep(0.7, 0.9, vn(U / 21 + 9, s / 6 + 3));                         // heaped-and-piled dark flecks
        const t = c01((dn - 0.3) / 0.9);
        const cr = (52 - 36 * t) / 255, cg = (104 - 60 * t) / 255, cb = (192 - 80 * t) / 255;
        const mm = Math.max(m * Math.min(1, 0.55 + 0.5 * dn), halo * (1 - m));
        ar += (cr - ar) * mm; ag += (cg - ag) * mm; ab += (cb - ab) * mm;
      }
      // pinholes: brown and dark inside
      const cav = Cv[k];
      if (cav > 0) { const o = cav * 0.9; ar += (0.3 - ar) * o; ag += (0.2 - ag) * o; ab += (0.12 - ab) * o; }
      // powder on the glaze: finger marks, a wiped streak, grains on the lip and in the undercut
      let pm = PM[k];
      if (U > -590 && U < -170 && s > 280 && s < 380) {
        const tU = (U + 590) / 420, q = (s - (332 + 13 * Math.sin(U / 90))) / 19;
        pm += 0.34 * sstep(0, 0.45, tU) * (1 - sstep(0.8, 1, tU)) * Math.exp(-q * q) * (0.2 + 0.8 * vn(U / 60 + 5, s / 2.1));
      }
      const gq = (s - LIP * 1.03) / 4.5;
      pm += 0.5 * uAt(tGrv, U) * Math.exp(-gq * gq);
      const h1 = hash(i, j), hc = hash(i >> 1, j >> 1);
      let ma = pm * (0.5 + 1.0 * h1);
      if (hc < 0.0008 + 0.05 * uAt(tLip, U) * Math.exp(-s / 16)) ma = 0.8;            // single grains
      if (ma > 0.9) ma = 0.9;
      if (ma > 0.002) {
        const gv = 0.72 + 0.5 * hash(i + 37, j + 91);
        ar += (0.6 * gv - ar) * ma; ag += (0.385 * gv - ag) * ma; ab += (0.195 * gv - ab) * ma;
      }

      let r = ar * eR, g = ag * eG, b = ab * eB;
      // grazing reflection of the powder right at the silhouette
      const eb = 0.24 * Math.exp(-s / 3) * (1 - 0.5 * sh);
      r += (0.5 - r) * eb; g += (0.33 - g) * eb; b += (0.18 - b) * eb;
      const o = k * 4;
      d[o] = r * 255; d[o + 1] = g * 255; d[o + 2] = b * 255; d[o + 3] = cov * 255;

      // ── glossy highlights (kept apart so they can slide) ──
      const Ht = HX * cs - HY * sn, Hr = HX * sn + HY * cs, ndh = ntp * Ht + nrp * Hr + nz * HZ;
      let sp = 0;
      if (ndh > 0.9) sp = Math.pow(ndh, 240) + 0.2 * Math.pow(ndh, 30);
      const lc = (nrp - 0.34) / 0.13;
      sp = sp * onLip + 0.07 * Math.exp(-lc * lc) * onLip;                              // + a faint sheen all along the lip
      // soft-box reflection on the wall: a broad band and a slim companion
      const vfade = sstep(LIP * 1.22, LIP * 1.8, s) * (1 - sstep(300, 600, s));
      const bq = Math.abs(ntp - NT0), bq2 = Math.abs(ntp - (NT0 - 0.132));
      sp += (0.36 * (1 - sstep(0.026, 0.092, bq)) + 0.2 * (1 - sstep(0.006, 0.026, bq2))) * vfade;
      sp *= (1 - 0.96 * sh) * (1 - Math.min(1, ma * 1.6)) * (1 - 0.8 * cav);
      if (sp > 0.004) { sd[o] = 255; sd[o + 1] = 253; sd[o + 2] = 247; sd[o + 3] = Math.min(1, sp) * cov * 255; }
    }
  }
  const bowl = L.makeCanvas(RW, RH), bg = bowl.getContext('2d');
  bg.putImageData(img, 0, 0);
  const spec = L.makeCanvas(RW, RH);
  spec.getContext('2d').putImageData(simg, 0, 0);

  // hairline scratches from years of wiping (mostly round the bowl) and a few iron specks — drawn only onto the porcelain
  bg.save(); bg.globalCompositeOperation = 'source-atop'; bg.translate(-X0, -Y0); bg.lineCap = 'round';
  const rs = L.rng('s29scratch');
  for (let n = 0; n < 54; n++) {
    const U0 = rs.range(-1150, 1150), s0 = rs.range(LIP * 1.3, 620), len = rs.range(40, 260), tilt = rs.chance(0.25) ? rs.range(-0.6, 0.6) : rs.range(-0.05, 0.05);
    const al = rs.range(0.05, 0.14), lw = rs.range(0.6, 1.1), pts = [];
    for (let t = 0; t <= 8; t++) { const u = t / 8 - 0.5; pts.push(toXY(U0 + len * u, s0 + tilt * len * u)); }
    const run = (dy, style) => { bg.strokeStyle = style; bg.lineWidth = lw; bg.beginPath(); pts.forEach((p, t) => (t ? bg.lineTo(p[0], p[1] + dy) : bg.moveTo(p[0], p[1] + dy))); bg.stroke(); };
    run(0, `rgba(122,108,90,${al})`); run(0.9, `rgba(255,255,255,${al * 1.3})`);
  }
  for (let n = 0; n < 46; n++) {
    const [px, py] = toXY(rs.range(-1200, 1200), rs.range(LIP * 1.25, 640));
    bg.fillStyle = `rgba(74,50,30,${rs.range(0.2, 0.6)})`;
    bg.beginPath(); bg.arc(px, py, rs.range(0.5, 1.5), 0, L.TAU); bg.fill();
  }
  bg.restore();
  bowl._x0 = X0; bowl._y0 = Y0; spec._x0 = X0; spec._y0 = Y0;
  return { bowl, spec };
}

/** the ground powder heaped behind the mortar: everything above the arc */
function buildPowder(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy, crestY = a.crestY;
  const X0 = -PAD, Y0 = -PAD;
  const PW = W + PAD * 2, PH = Math.ceil(a.yAt(X0)) + 10 - Y0, N = PW * PH;
  const nA = L.makeNoise('s29p'), nB = L.makeNoise('s29q');
  // the text-safe zone above the crest stays plain fine powder
  const zx0 = 630, zx1 = 1290, zy0 = crestY - 260;
  const flat = (x, y) => sstep(zx0 - 200, zx0 - 30, x) * (1 - sstep(zx1 + 30, zx1 + 200, x)) * sstep(zy0 - 200, zy0 - 30, y);

  // ── dunes on a coarse grid ──
  const CS = 4, gw = Math.ceil(PW / CS) + 3, gh = Math.ceil(PH / CS) + 3;
  const Hd = new Float32Array(gw * gh), Fl = new Float32Array(gw * gh), Cv = new Float32Array(gw * gh), Lc = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const x = X0 + i * CS, y = Y0 + j * CS, k = j * gw + i, f = flat(x, y);
    Fl[k] = f;
    const wx = 70 * nA.fbm(x / 430 + 5, y / 430 - 2, 2), wy = 50 * nA.fbm(x / 430 - 8, y / 430 + 6, 2);
    const big = nA.fbm(x / 640 + 3, y / 400 + 9, 3);
    const rip = nB.ridged((x + 0.55 * y + wx) / 250, (y - 0.3 * x + wy) / 180, 3);
    const sm = nB.fbm(x / 90 + 13, y / 72 - 7, 3);
    Hd[k] = (46 * big + 36 * (rip - 0.55) + 8 * sm) * (1 - 0.96 * f) + 2 * sm * f;
    Cv[k] = nA.fbm(x / 300 - 20, y / 300 + 40, 3);
  }
  const hAt = (fx, fy) => {
    if (fx < 0) fx = 0; else if (fx > gw - 1.001) fx = gw - 1.001;
    if (fy < 0) fy = 0; else if (fy > gh - 1.001) fy = gh - 1.001;
    const i0 = fx | 0, j0 = fy | 0, tx = fx - i0, ty = fy - j0, k = j0 * gw + i0;
    return (Hd[k] + (Hd[k + 1] - Hd[k]) * tx) * (1 - ty) + (Hd[k + gw] + (Hd[k + gw + 1] - Hd[k + gw]) * tx) * ty;
  };
  // raking light from the upper left, 30° above the surface; crests throw real shadows
  const lx = -0.675, ly = -0.537, lz = 0.5, tanE = 0.577;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const k = j * gw + i;
    const hx = (Hd[j * gw + Math.min(gw - 1, i + 1)] - Hd[j * gw + Math.max(0, i - 1)]) / (2 * CS);
    const hy = (Hd[Math.min(gh - 1, j + 1) * gw + i] - Hd[Math.max(0, j - 1) * gw + i]) / (2 * CS);
    const nd = (-hx * lx - hy * ly + lz) / Math.sqrt(1 + hx * hx + hy * hy);
    let occ = 0; const h0 = Hd[k];
    for (let t = 1; t <= 20; t++) { const dd = t * 7, o = hAt(i - 0.78 * dd / CS, j - 0.62 * dd / CS) - h0 - dd * tanE; if (o > occ) occ = o; }
    Lc[k] = Math.max(0, nd) * 1.1 * (1 - 0.62 * sstep(0, 7, occ));
  }
  const bil = (src, i, j) => {
    const fx = i / CS, fy = j / CS, i0 = fx | 0, j0 = fy | 0, tx = fx - i0, ty = fy - j0, k = j0 * gw + i0;
    const a0 = src[k], a1 = src[k + 1], b0 = src[k + gw], b1 = src[k + gw + 1];
    return (a0 + (a1 - a0) * tx) * (1 - ty) + (b0 + (b1 - b0) * tx) * ty;
  };

  // ── full-resolution lumps and grain ──
  const Hm = new Float32Array(N), Sd = new Float32Array(N), Tn = new Float32Array(N);
  const Rin = (R - 6) * (R - 6);
  for (let j = 0; j < PH; j++) {
    const y = Y0 + j, ddy = cy - y;
    for (let i = 0; i < PW; i++) {
      const x = X0 + i, ddx = x - cx;
      if (ddx * ddx + ddy * ddy < Rin) continue;
      const k = j * PW + i;
      Hm[k] = 2.4 * vn(x / 17, y / 15) * (1 - 0.75 * bil(Fl, i, j)) + 1.0 * vn(x / 6.3 + 20, y / 5.9 + 11) + 0.5 * hash(i, j);
    }
  }
  // clods, dark coarse grains and pale chips: a bump in the height field, a tint, and a short shadow to the lower right
  function stamp(px, py, ra, rb, ang, hgt, tint, shadow, so) {
    const ca = Math.cos(ang), sa = Math.sin(ang), off = hgt * 1.5, e = Math.ceil(Math.max(ra, rb) * 1.4 + off) + 3;
    const i0 = Math.max(1, Math.floor(px - e - X0)), i1 = Math.min(PW - 2, Math.ceil(px + e - X0));
    const j0 = Math.max(1, Math.floor(py - e - Y0)), j1 = Math.min(PH - 2, Math.ceil(py + e - Y0));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * PW + i, dx = X0 + i - px, dy = Y0 + j - py;
      const rag = 1 + 0.7 * (vn(i / 2.9 + so, j / 2.9) - 0.5);
      const u = dx * ca + dy * sa, v = -dx * sa + dy * ca, d2 = ((u / ra) * (u / ra) + (v / rb) * (v / rb)) * rag;
      if (d2 < 1) { const f = Math.pow(1 - d2, 0.7); Hm[k] += hgt * f; if (tint) { const m = Math.min(1, f * 3); Tn[k] += (tint - Tn[k]) * m; } }
      const sx = dx - off * 0.78, sy = dy - off * 0.62, us = sx * ca + sy * sa, vs = -sx * sa + sy * ca;
      const d2s = ((us / ra) * (us / ra) + (vs / rb) * (vs / rb)) / 1.5;
      if (d2s < 1 && d2 >= 0.8) { const q = shadow * (1 - d2s); if (q > Sd[k]) Sd[k] = q; }
    }
  }
  const rc = L.rng('s29clod');
  const inPowder = (x, y) => { const ddx = x - cx, ddy = cy - y; return ddx * ddx + ddy * ddy > (R + 6) * (R + 6); };
  for (let n = 0; n < 520; n++) {
    const x = rc.range(X0, X0 + PW), y = rc.range(Y0, Y0 + PH), cl = vn(x / 150 + 3, y / 150 + 8), ch = rc();
    if (flat(x, y) > 0.06 || !inPowder(x, y) || (cl < 0.5 && ch > 0.22)) continue;
    const r = 3 + Math.pow(rc(), 2.4) * 13;
    stamp(x, y, r * rc.range(0.85, 1.3), r * rc.range(0.65, 1), rc.range(0, Math.PI), r * 0.5, 0, 0.36, n);
  }
  for (let n = 0; n < 110; n++) {
    const x = rc.range(X0, X0 + PW), y = rc.range(Y0, Y0 + PH);
    if (flat(x, y) > 0.03 || !inPowder(x, y)) continue;
    const r = rc.range(2.4, 6.5) * (rc.chance(0.12) ? 1.5 : 1);
    stamp(x, y, r * rc.range(0.9, 1.4), r * rc.range(0.6, 0.95), rc.range(0, Math.PI), r * 0.6, -0.92, 0.46, n + 600);
  }
  for (let n = 0; n < 34; n++) {
    const x = rc.range(X0, X0 + PW), y = rc.range(Y0, Y0 + PH);
    if (flat(x, y) > 0.03 || !inPowder(x, y)) continue;
    stamp(x, y, rc.range(6, 15), rc.range(1.6, 3.4), rc.range(0, Math.PI), 1.7, 0.75, 0.3, n + 900);
  }

  // ── shade ──
  const ramp = L.makeRamp([[0, '#241407'], [0.14, '#3c230f'], [0.28, '#5a3719'], [0.42, '#8a5a2e'], [0.58, '#ad763c'], [0.74, '#c98f52'], [0.9, '#dfae72'], [1, '#ecc48c']]);
  const NL = 1024, lut = new Float32Array(NL * 3);
  for (let i = 0; i < NL; i++) { const c = ramp(i / (NL - 1)); lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2]; }
  const img = new ImageData(PW, PH), d = img.data;
  const Rin2 = (R - 5) * (R - 5);
  for (let j = 1; j < PH - 1; j++) {
    const y = Y0 + j, ddy = cy - y;
    const xbp = 1500 + 0.3 * (y - crestY) + 38 * Math.sin(y / 170 + 1.1);
    for (let i = 1; i < PW - 1; i++) {
      const x = X0 + i, ddx = x - cx, rr2 = ddx * ddx + ddy * ddy;
      if (rr2 < Rin2) continue;
      const k = j * PW + i;
      let lit = bil(Lc, i, j) + 0.085 * (Hm[k + 1 + PW] - Hm[k - 1 - PW]);
      // the same thing that shades the bowl's right third also dims the powder toward the upper right
      const shp = sstep(xbp - 95, xbp + 95, x);
      lit = ((lit - 0.5) * (1 - 0.35 * shp) + 0.5) * (1 - 0.5 * shp) * (1 - Sd[k]);
      lit *= 1.08 - 0.15 * sstep(300, 1900, Math.hypot(x - 200, y - 100));
      // contact shadow of the rim, widening to the right where the lip blocks the light
      const dr = Math.sqrt(rr2) - R;
      if (dr < 130) {
        const U = Math.atan2(ddx, ddy) * R, wC = 18 + 80 * sstep(-500, 1200, U);
        lit *= (1 - 0.74 * Math.exp(-Math.max(0, dr) / 9)) * (1 - 0.62 * (1 - sstep(wC * 0.25, wC, dr)));
      }
      const li = ((lit < 0 ? 0 : lit > 1.3 ? 1 : lit / 1.3) * (NL - 1) | 0) * 3;
      let r = lut[li], g = lut[li + 1], b = lut[li + 2];
      let gm = 0.9 + 0.2 * hash(i * 3 + 1, j * 7 + 5);
      const g2 = hash(i + 911, j + 577);
      if (g2 > 0.99) gm *= 0.6; else if (g2 < 0.012) gm *= 1.3;
      const cv = bil(Cv, i, j);
      r *= gm * (1 + 0.05 * cv); g *= gm; b *= gm * (1 - 0.09 * cv);
      const tn = Tn[k];
      if (tn < 0) { const m = -tn * 0.85, q = 0.55 + 0.8 * lit; r += (58 * q - r) * m; g += (33 * q - g) * m; b += (15 * q - b) * m; }
      else if (tn > 0) { const m = tn * 0.8, q = 0.45 + 0.75 * lit; r += (204 * q - r) * m; g += (152 * q - g) * m; b += (94 * q - b) * m; }
      const o = k * 4;
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
    }
  }
  const c = L.makeCanvas(PW, PH);
  c.getContext('2d').putImageData(img, 0, 0);
  c._x0 = X0; c._y0 = Y0;

  // a few grains that catch the light (drawn live so they can twinkle)
  const rk = L.rng('s29spark'), sparks = [];
  let guard = 0;
  while (sparks.length < 9 && guard++ < 400) {
    const x = rk.range(40, W - 40), y = rk.range(30, 640);
    if (flat(x, y) > 0.02 || a.drAt(x, y) < 70 || x > 1380) continue;
    const pl = a.polar(x, y);
    sparks.push({ th: pl.theta, dr: pl.dr, ph: rk(), k: rk.range(0.6, 1), r: rk.range(1.3, 2.4) });
  }
  return { powder: c, sparks };
}

/** draw a cropped layer (canvas with _x0/_y0 in frame coordinates), rotated about the arc's centre */
function put(ctx, a, c, rot) {
  ctx.save();
  if (rot) { ctx.translate(a.cx, a.cy); ctx.rotate(rot); ctx.translate(-a.cx, -a.cy); }
  ctx.drawImage(c, c._x0, c._y0);
  ctx.restore();
}

export default {
  name: '白瓷研钵',
  tone: 'light',
  init(env) {
    const { bowl, spec } = buildBowl(env);
    const { powder, sparks } = buildPowder(env);
    S = { bowl, spec, powder, sparks };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.0045, 0.0045, p), rp = rot * 0.4;
    // the powder behind: slides less (parallax)
    put(ctx, a, S.powder, rp);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const q of S.sparks) {
      const tw = Math.pow(Math.max(0, Math.cos((p * 0.9 + q.ph) * L.TAU)), 2) * q.k;
      if (tw < 0.04) continue;
      const pt = a.pt(q.th + rp, q.dr), gr = q.r * 6;
      ctx.fillStyle = L.radial(ctx, pt.x, pt.y, 0, gr, [[0, `rgba(255,238,196,${0.95 * tw})`], [0.18, `rgba(255,214,150,${0.5 * tw})`], [0.5, `rgba(240,170,96,${0.1 * tw})`], [1, 'rgba(240,170,96,0)']]);
      ctx.fillRect(pt.x - gr, pt.y - gr, gr * 2, gr * 2);
    }
    ctx.restore();
    // the mortar: surface detail slides along the arc …
    put(ctx, a, S.bowl, rot);
    // … and the glossy highlights drift a little further than the glaze they sit on
    put(ctx, a, S.spec, rot + L.lerp(-0.0055, 0.0055, p));
  },
};
