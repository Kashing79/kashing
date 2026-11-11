// s25 — 茯苓片. Extreme macro of a whole poria sclerotium (茯苓个) cut in half, lying on a flat perilla-purple sheet.
// The arc is the outer edge of the cut face: a thin, uneven, dark-brown rind (茯苓皮) — wrinkled, split by drying cracks —
// whose outer lip is picked out by the top light as a broken line of warm yellow. Under it the powdery white flesh:
// a pale red-brown layer hugs the rind (赤茯苓) and seeps into the white in drip- and tongue-shaped stains with a darker
// tide line, then cleaner and cleaner chalk white with fine grain, pores and a few hairline cracks.
// (Research note: commercial 茯苓片 are peeled before slicing, so this is drawn as the section of a whole sclerotium —
// a thin rind, then pale brown-red, then white.)
//
// Everything is shaded per pixel once in init(), in polar coordinates about the arc centre
// (u = px of arc length from the crest, d = px below the arc): a height field (rind wrinkles, powder grain, cracks)
// is lit from the upper left, the stains come from blurred masks used as soft distance fields.
// draw() = two blits with a tiny rotation about the arc centre + a patch of key light that wanders along the rind's lip.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 80;
const MT = 110;                    // extra rows above the slice region for the stain masks (so their blur has something to chew on)
const LX = 0.36, LY = 0.93;        // direction the key light travels across the frame (from the upper left)
let S = null;

const sstep = (a, b, v) => { let t = (v - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const sq = (v) => v * v;
const hash = (x, y) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
/** cheap value noise, 0..1 */
function vn(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let fx = x - xi, fy = y - yi; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}
/** alpha channel of a blurred copy */
function blurAlpha(c, px) {
  const b = L.makeCanvas(c.width, c.height), g = b.getContext('2d', { willReadFrequently: true });
  g.filter = `blur(${px}px)`; g.drawImage(c, 0, 0); g.filter = 'none';
  const d = g.getImageData(0, 0, c.width, c.height).data, out = new Uint8Array(c.width * c.height);
  for (let i = 0, k = 3; i < out.length; i++, k += 4) out[i] = d[k];
  return out;
}

function buildSlice(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const X0 = -PAD, Y0 = Math.floor(a.crestY) - 10;
  const RW = W + PAD * 2, RH = H + PAD - Y0, N = RW * RH, MH = RH + MT;
  const nz = L.makeNoise('s25a'), nb = L.makeNoise('s25b');
  const pt = (u, d) => a.pt(u / R, -d);

  // ── 1-D tables along the arc (1 px of arc length per entry) ──
  const UM = Math.ceil(R * 0.6), TN = UM * 2 + 3;
  const E = new Float32Array(TN), T = new Float32Array(TN), LWT = new Float32Array(TN), GATE = new Float32Array(TN), KEY = new Float32Array(TN), SI = new Float32Array(TN), BASE = new Float32Array(TN);
  const rk = L.rng('s25knots'), knots = [];
  for (let i = 0; i < 9; i++) knots.push([rk.range(-1250, 1250), rk.range(45, 120), rk.range(-16, 26)]);
  for (let i = 0; i < TN; i++) {
    const u = i - UM;
    // the silhouette wanders a few px about the arc (rough skin), mean on the arc
    E[i] = 1.9 * nz.n2(u / 52, 1.3) + 1.1 * nz.n2(u / 15, 7.7) + 1.3 * nz.n2(u / 190, 4.1) + 0.45 * nz.n2(u / 5, 2.2);
    // rind thickness: thin on the whole, never the same twice
    let t = 54 + 17 * nz.n2(u / 360, 11.2) + 10 * nz.n2(u / 118, 21.5) + 4 * nz.n2(u / 31, 31.9);
    for (const [ku, kw, kh] of knots) t += kh * Math.exp(-sq((u - ku) / kw));
    T[i] = L.clamp(t, 22, 104);
    // the lit lip: how far the highlight reaches in from the edge, and where it breaks off
    LWT[i] = 5 + 21 * sstep(-0.4, 0.6, nz.n2(u / 170, 41.3) + 0.4 * nz.n2(u / 52, 44.9));
    GATE[i] = sstep(-0.7, -0.3, nz.n2(u / 150, 51.7) + 0.3 * nz.n2(u / 41, 57.1) + 0.35 * Math.exp(-sq((u + 260) / 420)));
    KEY[i] = 0.62 + 0.38 * Math.exp(-sq((u + 230) / 820));
    // how strongly the red layer has soaked in here, and how deep it sits before the drips start
    SI[i] = 0.58 + 0.42 * sstep(-0.45, 0.45, nz.n2(u / 240, 71.3) + 0.3 * nz.n2(u / 70, 75.9));
    BASE[i] = 15 + 13 * (0.5 + 0.5 * nz.n2(u / 95, 81.1)) + 5 * nz.n2(u / 22, 85.7);
  }
  const tl = (tb, u) => { let f = u + UM; f = f < 0 ? 0 : f > TN - 2 ? TN - 2 : f; const i = f | 0; return tb[i] + (tb[i + 1] - tb[i]) * (f - i); };

  // ── stain masks, drawn as plain shapes and blurred into soft distance fields ──
  const maskCanvas = (draw) => { const c = L.makeCanvas(RW, MH), g = c.getContext('2d'); g.translate(PAD, MT - Y0); g.fillStyle = '#fff'; draw(g); return c; };
  const band = (g, depth) => {
    g.beginPath();
    for (let u = -UM; u <= UM; u += 10) { const p = pt(u, -90); if (u === -UM) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y); }
    for (let u = UM; u >= -UM; u -= 5) { const p = pt(u, depth(u)); g.lineTo(p.x, p.y); }
    g.closePath(); g.fill();
  };
  const tongue = (g, u, d0, w, len, tilt, k1, k2) => a.at(g, u / R, -d0, () => {
    g.beginPath(); g.moveTo(-w * 0.5, -8);
    g.bezierCurveTo(-w * k1, len * 0.55, -w * 0.3 + tilt, len, tilt, len);
    g.bezierCurveTo(w * 0.3 + tilt, len, w * k2, len * 0.55, w * 0.5, -8);
    g.closePath(); g.fill();
  });
  // first generation: saturated drips hanging right under the rind
  const m1 = maskCanvas((g) => {
    const r = L.rng('s25dripC');
    band(g, (u) => tl(T, u) + tl(BASE, u));
    for (let u = -UM + 40; u < UM;) {
      const kind = r();
      let w, len;
      if (kind < 0.22) { w = r.range(170, 270); len = r.range(150, 265); }          // a long tongue
      else if (kind < 0.52) { w = r.range(105, 200); len = r.range(68, 150); }      // a drip
      else { w = r.range(50, 120); len = 18 + 70 * r(); }                           // a mere scallop
      tongue(g, u, tl(T, u) + 6, w, len, r.range(-0.18, 0.18) * len, r.range(0.44, 0.6), r.range(0.44, 0.6));
      if (kind < 0.22 && r.chance(0.7)) tongue(g, u + r.sign() * w * r.range(0.3, 0.5), tl(T, u) + 6, w * r.range(0.3, 0.45), len * r.range(0.45, 0.8), r.range(-12, 12), 0.5, 0.5);
      u += w * r.range(0.5, 0.95) + (r.chance(0.3) ? r.range(40, 200) : 0);
    }
  });
  // second generation: a much paler, broader front further in
  const m2 = maskCanvas((g) => {
    const r = L.rng('s25wash');
    band(g, (u) => tl(T, u) + 70 + 45 * nz.n2(u / 300, 91.7));
    for (let u = -UM + 90; u < UM;) {
      const w = r.range(240, 480), len = r.range(70, 215);
      tongue(g, u, tl(T, u) + 60, w, len, r.range(-0.2, 0.2) * len, 0.52, 0.52);
      u += w * r.range(0.6, 1.2);
    }
  });
  const As = blurAlpha(m1, 3.5), Am = blurAlpha(m1, 13), Al = blurAlpha(m1, 42), Bm = blurAlpha(m2, 26);

  // ── cracks and pores, drawn as thin strokes and read back as a "groove" channel ──
  const crkC = L.makeCanvas(RW, RH);
  {
    const g = crkC.getContext('2d'); g.translate(PAD, -Y0);
    g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
    const r = L.rng('s25crack');
    const seg = (u0, d0, u1, d1, w, al) => { const p = pt(u0, d0), q = pt(u1, d1); g.globalAlpha = al; g.lineWidth = w; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke(); };
    // a crack as a run of short straight pieces with sudden kinks, in (u, d); phi = heading (π/2 = straight inward)
    const walk = (u, d, phi, len, w0, w1, al0, al1, wig, branch) => {
      let left = len, home = phi;
      while (left > 0.5) {
        const st = Math.min(left, r.range(9, 34)), q = 1 - left / len;
        const nu = u + Math.cos(phi) * st, nd = d + Math.sin(phi) * st;
        seg(u, d, nu, nd, L.lerp(w0, w1, q) * r.range(0.7, 1.25), L.lerp(al0, al1, q));
        if (branch > 0 && r.chance(branch * st / 8)) walk(nu, nd, phi + r.sign() * r.range(0.6, 1.2), len * r.range(0.08, 0.2), L.lerp(w0, w1, q) * 0.7, 0.4, L.lerp(al0, al1, q) * 0.8, 0.2, wig, 0);
        u = nu; d = nd; left -= st;
        home += r.gauss() * wig * 0.35; phi = home + r.gauss() * wig * 2.4;
      }
    };
    // drying cracks across the rind (龟裂): open at the outer skin, pinching out toward the flesh
    for (let u = -UM + r.range(0, 60); u < UM; u += r.range(44, 210)) {
      const t = tl(T, u);
      walk(u, -3, Math.PI / 2 + r.sign() * r.range(0.15, 0.85), t * r.range(0.4, 1.0), r.range(0.9, 2.0), 0.6, 0.9, 0.5, 0.2, 0.3);
    }
    // … and a few that run with the skin
    for (let u = -UM + 30; u < UM; u += r.range(120, 380)) {
      const t = tl(T, u);
      walk(u, t * r.range(0.3, 0.62), r.range(-0.16, 0.16), r.range(40, 130), r.range(1.1, 2.0), 0.6, 0.85, 0.35, 0.2, 0.3);
    }
    // hairline cracks in the flesh
    const hair = [[-345, 6, 1.9, 330], [480, 150, 0.45, 380], [-830, 230, 2.5, 220], [170, 340, 1.25, 240]];
    for (const [u, d, phi, len] of hair) walk(u, tl(T, u) * (d < 20 ? 0.7 : 0) + d, phi, len, d < 20 ? 2.4 : 2.0, 0.6, 1, 0.3, 0.13, 0.1);
    // pores
    for (let i = 0; i < 150; i++) {
      const u = r.range(-1300, 1300), d = 62 + 640 * Math.pow(r(), 0.8), p = pt(u, d);
      const big = r.chance(0.12);
      g.globalAlpha = r.range(0.2, 0.7);
      g.beginPath(); g.ellipse(p.x, p.y, big ? r.range(2, 3.6) : r.range(0.7, 1.8), big ? r.range(1.4, 2.6) : r.range(0.6, 1.4), r() * 3.14, 0, L.TAU); g.fill();
    }
  }
  const CK = blurAlpha(crkC, 0.55);

  // ── slow fields on a coarse grid ──
  const CS = 4, cw = Math.ceil(RW / CS) + 2, ch = Math.ceil(RH / CS) + 2;
  const cMot = new Float32Array(cw * ch), cMot2 = new Float32Array(cw * ch), cWx = new Float32Array(cw * ch), cWy = new Float32Array(cw * ch);
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const x = X0 + i * CS, y = Y0 + j * CS, k = j * cw + i;
    cMot[k] = nz.fbm(x / 210 + 5.5, y / 210 - 3.1, 3);
    cMot2[k] = nb.fbm(x / 58 - 11.3, y / 58 + 27.9, 3);
    cWx[k] = nb.n2(x / 44 + 91, y / 44 - 17); cWy[k] = nz.n2(x / 44 - 63, y / 44 + 39);
  }
  const bil = (src, i, j) => {
    const fx = i / CS, fy = j / CS, i0 = fx | 0, j0 = fy | 0, tx = fx - i0, ty = fy - j0, k = j0 * cw + i0;
    const a0 = src[k], a1 = src[k + 1], b0 = src[k + cw], b1 = src[k + cw + 1];
    return (a0 + (a1 - a0) * tx) * (1 - ty) + (b0 + (b1 - b0) * tx) * ty;
  };

  // ── pass 1: materials + height ──
  const img = new ImageData(RW, RH), px = img.data;
  const Hh = new Float32Array(N), RM = new Float32Array(N), LP = new Float32Array(N), LQ = new Float32Array(N), EF = new Float32Array(N);
  for (let j = 0; j < RH; j++) {
    const y = Y0 + j, ddy = cy - y;
    for (let i = 0; i < RW; i++) {
      const x = X0 + i, ddx = x - cx, rr = Math.sqrt(ddx * ddx + ddy * ddy), d = R - rr;
      if (d < -7) continue;
      const u = Math.atan2(ddx, ddy) * R, dd = d + tl(E, u);
      if (dd <= -0.5) continue;
      const k = j * RW + i, o = k * 4;
      const t0 = tl(T, u);
      let tr = t0, rm = 0;
      if (dd < t0 + 22) {   // ragged inner face of the rind
        tr = t0 + 1.5 * nz.n2(u / 9, d / 9) + 4.5 * nz.n2(u / 34 + 40, d / 36) + 4 * nz.n2(u / 88 - 20, d / 70);
        rm = 1 - sstep(tr - 2.2, tr + 2.2, dd);
      }
      const ck = CK[k] / 255;
      const g1 = vn(x * 0.59, y * 0.59) - 0.5, g2 = vn(x * 0.21 + 7.3, y * 0.21 + 1.9) - 0.5;
      let cr = 0, cg = 0, cb = 0, hh = 0;

      if (rm < 1) {
        // ── flesh: chalky, matt, a compact of fine powder ──
        const below = dd - tr;
        const mot = bil(cMot, i, j), mot2 = bil(cMot2, i, j);
        const g3 = vn(x * 0.071 + 3.1, y * 0.071 + 9.7) - 0.5;
        const g0 = hash(i, j) - 0.5;
        let fr = 243, fg = 237, fb = 228;
        const kk = 0.024 * mot + 0.014 * mot2;                       // denser / looser patches of powder
        fr *= 1 + kk; fg *= 1 + kk * 1.12; fb *= 1 + kk * 1.5;
        // the red layer: drips with a tide line, a pale wash further in
        const wx = bil(cWx, i, j) * 6, wy = bil(cWy, i, j) * 6;
        let ii = (i + wx + 0.5) | 0, jj = (j + MT + wy + 0.5) | 0;
        ii = ii < 0 ? 0 : ii >= RW ? RW - 1 : ii; jj = jj < 0 ? 0 : jj >= MH ? MH - 1 : jj;
        const mk = jj * RW + ii;
        const as = As[mk] / 255, am = Am[mk] / 255, al = Al[mk] / 255, bm = Bm[mk] / 255;
        const nn = 0.2 * (vn(x * 0.11 + 4.4, y * 0.11 - 8.8) - 0.5) + 0.1 * (vn(x * 0.33 - 2.2, y * 0.33 + 6.6) - 0.5);
        const si = tl(SI, u);
        const inside = sstep(0.36, 0.64, as + nn);
        const rim = Math.exp(-sq((am + 0.6 * nn - 0.58) / 0.21));
        const deep = sstep(0.5, 0.98, al);
        const halo = sstep(0.02, 0.5, al) * (1 - inside);
        const body = inside * (0.4 + 0.36 * deep + 0.14 * mot2 + 0.12 * g3);
        const line = rim * (0.36 + 0.56 * vn(x * 0.034 + 13.1, y * 0.034 - 4.7)) * (1 - 0.3 * deep);
        let amt = si * (body + line * (1 - 0.45 * body) + 0.3 * halo) * (1 + 0.34 * g1 + 0.3 * g0);
        const wash = 0.2 * sstep(0.3, 0.72, bm + nn) * (0.65 + 0.35 * mot) + 0.08 * Math.exp(-sq((bm + 0.5 * nn - 0.52) / 0.12));
        amt = 1 - (1 - L.clamp(amt)) * (1 - wash);
        const seam = Math.exp(-Math.max(0, below) / 20);            // red-brown right against the rind
        amt = Math.max(amt, 0.92 * seam);
        const dk = sstep(0.5, 1, amt) * 0.7 + 0.3 * seam;
        const sr = L.lerp(203, 176, dk), sg = L.lerp(138, 94, dk), sb = L.lerp(124, 82, dk);
        fr += (sr - fr) * amt; fg += (sg - fg) * amt; fb += (sb - fb) * amt;
        // the rind stands a little proud and drops a soft shadow on the flesh
        const shd = 0.5 * Math.exp(-Math.max(0, below) / 6.5) + 0.13 * Math.exp(-Math.max(0, below) / 30);
        fr *= 1 - shd * 0.55; fg *= 1 - shd * 0.7; fb *= 1 - shd * 0.72;
        // powder grain, bright crumbs, the odd brown fleck
        const gr = 0.05 * g0 + 0.04 * g1 + 0.026 * g2 + 0.018 * g3;
        fr *= 1 + gr; fg *= 1 + gr; fb *= 1 + gr * 1.1;
        if (g0 > 0.4955) { fr += 9; fg += 9; fb += 10; } else if (g0 < -0.4984) { fr *= 0.84; fg *= 0.78; fb *= 0.72; }
        // grooves
        if (ck > 0) { const q = ck * 0.62; fr += (128 - fr) * q; fg += (98 - fg) * q; fb += (84 - fb) * q; }
        // the light falls off gently toward the bottom and the right
        const lg = 1.035 - 0.085 * sstep(140, 660, d) - 0.035 * sstep(420, 1100, x - 820);
        fr *= lg; fg *= lg; fb *= lg * (1 - (1.035 - lg) * 0.35);
        cr = fr; cg = fg; cb = fb;
        hh = 0.45 * g1 + 0.42 * g2 + 0.3 * g3 + 0.9 * mot2 - 2.8 * ck;
      }
      if (rm > 0) {
        // ── rind: rough wrinkled skin rolling over the edge, then its cut section ──
        const sdd = dd / Math.max(8, tr);
        const skin = 1 - sstep(0.26, 0.6, sdd);
        const wp = 7 * nb.n2(u / 95, dd / 60);
        const wr = sq(1 - Math.abs(nb.n2((u + wp) / 52, dd / 22 + 3.3)));
        const wr2 = sq(1 - Math.abs(nb.n2(u / 21 + 9.1, dd / 9 - 3.7)));
        const fine = nz.n2(u / 6.5 + 50, dd / 4.5);
        const amp = 0.3 + 0.7 * skin;
        const hb = 5 + 6 * sstep(0, 0.55 * tr, dd) + amp * (5.5 * wr + 2.2 * wr2) + 0.7 * fine - 2.2 * ck;
        const tone = L.clamp(0.5 + 0.55 * nb.n2(u / 140 + 3, dd / 75 + 8) + 0.2 * (wr - 0.4));
        let ar = L.lerp(31, 68, tone), ag = L.lerp(18, 41, tone), ab = L.lerp(12, 26, tone);
        // the cut section is a shade warmer and evener than the skin
        ar += (62 - ar) * (1 - skin) * 0.6; ag += (36 - ag) * (1 - skin) * 0.6; ab += (24 - ab) * (1 - skin) * 0.6;
        // earth still clinging to the crests
        const dust = 0.34 * sstep(0.5, 0.95, wr) * skin * (0.4 + 0.6 * vn(x * 0.09, y * 0.09));
        ar += (126 - ar) * dust; ag += (92 - ag) * dust; ab += (60 - ab) * dust;
        const gk = (1 + 0.26 * g1 + 0.2 * g2) * (1 - 0.82 * ck);
        ar *= gk; ag *= gk; ab *= gk;
        // top light on the lip: a band of warm yellow that reaches in as far as LWT says and breaks off where GATE closes;
        // its inner edge is ragged and sheds a few loose flecks onto the wrinkle crests below
        const lw = tl(LWT, u), gate = tl(GATE, u), dp = Math.max(0, dd);
        const m = 1 + 0.22 * nb.n2(u / 17 + 1.7, dd / 6 + 5.3) + 0.24 * (wr2 - 0.35) - 0.6 * sstep(0.3, 0.62, nz.n2(u / 74 + 5.5, dd / 30 + 2.5) + 0.3 * nz.n2(u / 19 - 8.1, dd / 11));
        const q = Math.exp(-dp / lw) * gate * m * (1 - 0.55 * ck);
        const fleck = sstep(0.8, 0.9, vn(u * 0.21 + 3, dd * 0.36 + 8)) * Math.exp(-dp / (2.4 * lw)) * gate * 0.9 * sstep(0.2, 0.6, wr2);
        const thin = sstep(0.3, 0.62, Math.exp(-dp / 2.3) * gate * (1 - 0.6 * ck) * (0.8 + 0.5 * wr2));   // the lip itself never quite loses the light
        LP[k] = tl(KEY, u) * Math.max(0.86 * sstep(0.34, 0.5, q) + 0.14 * sstep(0.1, 0.5, q), fleck, 0.9 * thin) * rm; LQ[k] = Math.max(q, fleck * 0.7, thin * 0.75);
        cr = cr * (1 - rm) + ar * rm; cg = cg * (1 - rm) + ag * rm; cb = cb * (1 - rm) + ab * rm;
        hh = hh * (1 - rm) + hb * rm;
      }
      px[o] = cr; px[o + 1] = cg; px[o + 2] = cb; px[o + 3] = dd < 0.5 ? (dd + 0.5) * 255 : 255;
      Hh[k] = hh; RM[k] = rm; EF[k] = sstep(0.4, 2.6, dd);
    }
  }

  // ── pass 2: light the height field ──
  const SH = Math.min(RH, Math.ceil(a.yAt(X0) - Y0) + 120);
  const spImg = new ImageData(RW, SH), sp = spImg.data;
  for (let j = 1; j < RH - 1; j++) {
    for (let i = 1; i < RW - 1; i++) {
      const k = j * RW + i, o = k * 4;
      if (!px[o + 3]) continue;
      const rel = ((Hh[k + 1] - Hh[k - 1]) * LX + (Hh[k + RW] - Hh[k - RW]) * LY) * 0.5 * EF[k];
      const rm = RM[k];
      let f = 1 + rel * 0.36; f = f < 0.78 ? 0.78 : f > 1.16 ? 1.16 : f;
      let cr = px[o] * f, cg = px[o + 1] * f, cb = px[o + 2] * f;
      if (rm > 0) {
        let v = rel * 1.2; v = v < -1 ? -1 : v > 1.3 ? 1.3 : v;
        const df = v >= 0 ? 0.8 + 1.0 * v : 0.8 + 0.5 * v;
        let rr = px[o] * df, rg = px[o + 1] * df, rb = px[o + 2] * df;
        if (v < 0) { rr += 138 * -v * 0.1; rg += 47 * -v * 0.1; rb += 127 * -v * 0.1; }   // the purple sheet bounces into the shadows
        let s = Math.max(LP[k], 0.26 * sstep(0.7, 1.25, v));
        if (s > 0) {
          if (s > 1) s = 1;
          const q = LQ[k], cq = LP[k] > 0 ? sstep(0.38, 0.82, q) : 0.5, hot = sstep(0.85, 1.2, q) * 0.42;   // ochre at the ragged inner edge → warm yellow → a pale hot core at the very lip
          const hr = L.lerp(198, 240, cq) + 15 * hot, hg = L.lerp(140, 212, cq) + 32 * hot, hbb = L.lerp(70, 138, cq) + 62 * hot;
          rr += (hr - rr) * s; rg += (hg - rg) * s; rb += (hbb - rb) * s;
          if (j < SH) { sp[o] = hr; sp[o + 1] = hg; sp[o + 2] = hbb; sp[o + 3] = s * rm * 255; }
        }
        cr += (rr - cr) * rm; cg += (rg - cg) * rm; cb += (rb - cb) * rm;
      }
      px[o] = cr; px[o + 1] = cg; px[o + 2] = cb;
    }
  }
  const slice = L.makeCanvas(RW, RH), sg = slice.getContext('2d');
  sg.putImageData(img, 0, 0);
  const spec = L.makeCanvas(RW, SH); spec.getContext('2d').putImageData(spImg, 0, 0);

  // ── depth of field: sharp under the crest, the powder goes soft toward the bottom of frame ──
  const soft = L.blurred(slice, 4), fg = soft.getContext('2d');
  fg.globalCompositeOperation = 'destination-in';
  fg.fillStyle = L.radial(fg, cx + PAD, cy - Y0, R - 600, R - 250, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);   // fully soft 600 px in, sharp from 250 px
  fg.fillRect(0, 0, RW, RH);
  sg.drawImage(soft, 0, 0);
  // … and a touch toward the two ends of the arc
  const side = L.blurred(slice, 1.8), dg = side.getContext('2d');
  dg.globalCompositeOperation = 'destination-in';
  dg.fillStyle = L.linear(dg, 0, 0, RW, 0, [[0, 'rgba(0,0,0,1)'], [0.2, 'rgba(0,0,0,0.5)'], [0.36, 'rgba(0,0,0,0)'], [0.66, 'rgba(0,0,0,0)'], [0.82, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,1)']]);
  dg.fillRect(0, 0, RW, RH);
  sg.drawImage(side, 0, 0);

  return { slice, spec, bloom: L.blurred(spec, 7), X0, Y0, RW, SH, tmp: L.makeCanvas(RW, SH) };
}

/** the sheet underneath: one flat field of perilla purple, nothing on it but paper tooth */
function buildBack(env) {
  const a = env.arc;
  return L.makeLayer(PAD, (g) => {
    const full = () => g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    g.fillStyle = '#8a2f7f'; full();
    g.fillStyle = L.radial(g, 820, 330, 120, 1500, [[0, 'rgba(166,60,150,0.2)'], [0.45, 'rgba(138,47,127,0)'], [1, 'rgba(92,26,90,0.34)']]); full();
    g.fillStyle = L.radial(g, a.cx + 260, a.cy, a.R - 4, a.R + 34, [[0, 'rgba(58,12,60,0.3)'], [0.4, 'rgba(58,12,60,0.12)'], [1, 'rgba(58,12,60,0)']]); full();
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.2;
    g.drawImage(L.noiseLayer(PAD, { seed: 's25paper', scale: 2.6, octaves: 2, res: 0.6, contrast: 1.6 }), -PAD, -PAD);
    g.globalAlpha = 0.05;
    g.drawImage(L.noiseLayer(PAD, { seed: 's25cloud', scale: 320, octaves: 3, res: 0.2, contrast: 1.4 }), -PAD, -PAD);
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.5;
    g.drawImage(L.grainTex(W + PAD * 2, H + PAD * 2, { seed: 25, amount: 0.16 }), -PAD, -PAD);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  });
}

export default {
  name: '茯苓片',
  tone: 'light',
  init(env) {
    S = { back: buildBack(env), ...buildSlice(env) };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.0065, 0.0065, p);
    L.blit(ctx, env, S.back, { rot });
    // the key light's hot patch drifts along the lip, against the slide of the slice
    const tg = S.tmp.getContext('2d');
    tg.globalCompositeOperation = 'copy'; tg.drawImage(S.spec, 0, 0);
    const hp = a.pt(L.lerp(-0.2, -0.02, p), -10);
    tg.globalCompositeOperation = 'destination-in';
    tg.fillStyle = L.radial(tg, hp.x - S.X0, hp.y - S.Y0, 40, 560, [[0, 'rgba(0,0,0,0.6)'], [0.5, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,0)']]);
    tg.fillRect(0, 0, S.RW, S.SH);
    L.cam(ctx, env, { rot }, () => {
      ctx.drawImage(S.slice, S.X0, S.Y0);
      ctx.globalCompositeOperation = 'screen';
      ctx.drawImage(S.tmp, S.X0, S.Y0);
      ctx.globalAlpha = 0.4;
      ctx.drawImage(S.bloom, S.X0, S.Y0);
    });
  },
};
