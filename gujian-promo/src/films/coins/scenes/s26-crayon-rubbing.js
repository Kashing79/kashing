// s26 — 蜡笔拓钱. A sheet of rough light-blue paper laid over the back of a cash coin and scribbled with an
// ultramarine crayon, the way children take rubbings of coins. The arc is the coin's outer rim (外郭) coming up
// through the paper; below it, across the blank field (肉), a slim crescent (月纹) and one straight edge of the
// square hole's inner rim (内郭). No inscription is rubbed.
//
// The rubbing is simulated per pixel in init():
//   tooth  – the paper's grain, as a percentile field U (which pixels are peaks)
//   contact – how firmly the paper is backed at each pixel: raised parts of the coin ≈ 1 (more along their edges),
//             the sunken field barely, a "tent" gap right beside every raised edge, nothing off the coin or over the hole
//   pressure – the sum of a few hundred slanted back-and-forth crayon strokes, each with the streaky footprint of a worn tip
// A pixel takes wax when its tooth percentile clears 1 − coverage(pressure × contact), so colour only ever sits on the
// peaks of the grain: speckle, dry gaps and all. Strokes added during the shot are small patches computed the same way.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 64;
const LW = W + PAD * 2, LH = H + PAD * 2, N = LW * LH;
let S = null;

const RIM = 104;                 // width of the outer rim band, px
const FIELD = 0.12;              // contact in the sunken field (raised = 1)
const COVMAX = 0.965, SOFT = 0.035;
const MID = [36, 86, 200];       // 群青 #2456c8
const DEEP = [23, 58, 154];      // 浓处 #173a9a

const sstep = (a, b, v) => { let t = (v - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const sq = (v) => v * v;
function hash2(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** where the coin's relief sits, all derived from the shared arc */
function geometry(a) {
  const mTop = a.crestY + 288, mT = 38, mL = 440, mRa = 1150;      // crescent: top of its back, thickness, half-length, radius of its back
  const sagA = mRa - Math.sqrt(mRa * mRa - mL * mL), sagB = sagA - mT;
  const mRb = (mL * mL + sagB * sagB) / (2 * sagB);                // radius of its belly, so that both curves meet at the horns
  return { mTop, mT, mL, mRa, mRb, mcyA: mTop + mRa, mcyB: mTop + mT + mRb,
    hTop: a.crestY + 452, hW: 22, hHalf: 640 };                    // inner rim: top edge, width, half-side of its outer square
}

// ───────────────────────── paper ─────────────────────────
function buildPaper(a) {
  const c = L.makeCanvas(LW, LH), g = c.getContext('2d');
  g.fillStyle = '#a9c4ea'; g.fillRect(0, 0, LW, LH);
  // pulp clouds: barely-there drifts of deeper and paler blue
  g.drawImage(L.noiseTex(LW, LH, { seed: 's26cloud', scale: 320, octaves: 3, res: 0.125,
    ramp: [[0, 'rgba(111,143,196,0.16)'], [0.5, 'rgba(169,196,234,0)'], [1, 'rgba(226,237,252,0.2)']] }), 0, 0);
  g.drawImage(L.noiseTex(LW, LH, { seed: 's26cloud2', scale: 46, octaves: 2, res: 0.25,
    ramp: [[0, 'rgba(111,143,196,0.07)'], [0.5, 'rgba(169,196,234,0)'], [1, 'rgba(232,241,253,0.08)']] }), 0, 0);
  const r = L.rng('s26paper');
  const inText = (x, y, m) => x > 600 - m + PAD && x < 1320 + m + PAD && y > a.crestY - 292 - m + PAD && y < a.crestY + 6 + PAD;
  // fibres: short curled hairs, most a deeper blue, some pale
  g.lineCap = 'round';
  for (let i = 0; i < 1900; i++) {
    const x = r() * LW, y = r() * LH, len = 6 + Math.pow(r(), 2.4) * 74, ang = r() * Math.PI, bend = r.range(-0.9, 0.9) * len * 0.5;
    const dark = r.chance(0.64), calm = inText(x, y, 20) ? 0.7 : 1;
    g.strokeStyle = dark ? L.rgba('#6f8fc4', r.range(0.4, 0.95) * calm) : L.rgba('#e6f0fd', r.range(0.3, 0.8) * calm);
    g.lineWidth = r.range(0.6, 1.5);
    const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo((x + ex) / 2 - Math.sin(ang) * bend, (y + ey) / 2 + Math.cos(ang) * bend, ex, ey);
    g.stroke();
  }
  // specks of darker pulp
  for (let i = 0; i < 3800; i++) {
    const x = r() * LW, y = r() * LH, rad = 0.5 + Math.pow(r(), 3) * 1.4;
    g.fillStyle = r.chance(0.7) ? L.rgba('#6f8fc4', r.range(0.3, 0.85)) : L.rgba('#eaf2fd', r.range(0.3, 0.7));
    g.beginPath(); g.arc(x, y, rad, 0, L.TAU); g.fill();
  }
  for (let i = 0; i < 90; i++) {
    const x = r() * LW, y = r() * LH, rad = r.range(1.7, 4.4) * (r.chance(0.2) ? 1.3 : 1);
    if (inText(x, y, 12)) continue;
    g.fillStyle = L.rgba(L.mix('#6f8fc4', '#2456c8', r.range(0, 0.45)), r.range(0.6, 0.95));
    g.beginPath(); g.ellipse(x, y, rad, rad * r.range(0.65, 1), r() * Math.PI, 0, L.TAU); g.fill();
  }
  return g.getImageData(0, 0, LW, LH).data;
}

// ───────────────────────── crayon strokes ─────────────────────────
/** the uneven face of a worn crayon tip: pressure across the width of a stroke */
function tipLut(r) {
  const K = 22, a = new Float32Array(K + 1);
  let v = r.range(0.75, 1.1);
  for (let i = 0; i <= K; i++) { v = L.clamp(v + r.range(-0.3, 0.3), 0.4, 1.25); a[i] = r.chance(0.11) ? v * 0.22 : v; }
  return a;
}

/** pressure footprint of one stroke (frame coords in, layer-pixel bbox + Float32 buffer out) */
function footprint(st) {
  const ax = st.x0 + PAD, ay = st.y0 + PAD, bx = st.x1 + PAD, by = st.y1 + PAD;
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
  const w = st.w, hw = w / 2, bow = st.bow || 0, m = hw + Math.abs(bow) + 2;
  const X0 = Math.max(0, Math.floor(Math.min(ax, bx) - m)), X1 = Math.min(LW - 1, Math.ceil(Math.max(ax, bx) + m));
  const Y0 = Math.max(0, Math.floor(Math.min(ay, by) - m)), Y1 = Math.min(LH - 1, Math.ceil(Math.max(ay, by) + m));
  if (X1 < X0 || Y1 < Y0) return null;
  const bw = X1 - X0 + 1, bh = Y1 - Y0 + 1, d = new Float32Array(bw * bh);
  const lut = st.lut, K = lut.length - 1;
  const tailLen = Math.max(hw * 0.5, (st.tail || 0) * len), ph = st.ph || 0;
  for (let yy = 0; yy < bh; yy++) {
    const py = Y0 + yy - ay;
    for (let xx = 0; xx < bw; xx++) {
      const px = X0 + xx - ax;
      const s = px * ux + py * uy;
      if (s < -hw || s > len + hw) continue;
      const q = (2 * s) / len - 1;
      const t = -px * uy + py * ux + bow * (1 - q * q);
      const at = t < 0 ? -t : t;
      if (at >= hw) continue;
      const f = (t / w + 0.5) * K, fi = f | 0;
      let v = lut[fi] + (lut[fi + 1 > K ? K : fi + 1] - lut[fi]) * (f - fi);
      v *= sstep(hw, hw - 5, at);                                                       // soft shoulders
      v *= sstep(-hw * 0.7, hw * 0.5, s) * (1 - sstep(len - tailLen, len + hw * 0.7, s)); // touch-down and lift-off
      v *= 0.86 + 0.14 * Math.sin(s * 0.045 + ph);
      d[yy * bw + xx] = st.press * v;
    }
  }
  return { X0, Y0, bw, bh, d };
}

/** a run of back-and-forth slanted strokes marching along a path */
function zig(list, r, o) {
  let s = o.s0, i = 0;
  const fwdStep = o.step > 0;
  while ((fwdStep ? s < o.s1 : s > o.s1) && (o.count === undefined || i < o.count)) {
    const [x, y, tx, ty] = o.at(s);
    const ang = o.ang(s) + r.range(-0.08, 0.08), cs = Math.cos(ang), sn = Math.sin(ang);
    const vx = tx * cs + ty * sn, vy = ty * cs - tx * sn;     // the stroke's direction, leaning off the path toward its outer side
    const short = !!o.short && r.chance(o.short);
    const up = r.range(o.up[0], o.up[1]) / sn;
    const dn = (short ? r.range(o.down[0] - 60, o.down[0] - 20) : o.down[0] + (o.down[1] - o.down[0]) * Math.pow(r(), 1.6)) / sn;
    const fwd = i % 2 === 0;
    const pr = o.press(s, x, y) * r.range(0.78, 1.2);
    const wd = r.range(o.w[0], o.w[1]), bow = r.range(-5, 5), lut = tipLut(r), lift = r.chance(0.4), tl = r.range(0.22, 0.5), ph = r.range(0, 6.28);
    if (pr > 0.04) {
      const ax = x - vx * dn, ay = y - vy * dn, bx = x + vx * up, by = y + vy * up;
      list.push({ x0: fwd ? ax : bx, y0: fwd ? ay : by, x1: fwd ? bx : ax, y1: fwd ? by : ay, w: wd, press: pr,
        bow, lut, tail: !fwd && lift ? tl : 0.03, ph, frame: o.frame ? o.frame(i) : 0 });
    }
    s += o.step * r.range(0.72, 1.28); i++;
  }
}

function buildStrokes(a, G) {
  const list = [], r = L.rng('s26strokes'), R = a.R;
  const rimAt = (s) => { const th = s / R, p = a.pt(th, -RIM / 2); return [p.x, p.y, Math.cos(th), Math.sin(th)]; };
  const sEnd = a.span(PAD + 70) * R;
  const sOfX = (x) => Math.asin((x - a.cx) / R) * R;
  const fadeEnds = (x) => L.lerp(1, 0.42, sstep(330, 850, Math.abs(x - 1010)));     // 两端渐渐涂淡
  const slant = (base) => (s) => L.deg(base) + (0.5 * s) / R;                        // the hand keeps roughly the same slant on screen

  // outer rim, first pass: one even zig-zag across the whole width
  zig(list, r, { at: rimAt, s0: -sEnd, s1: sEnd, step: 23, ang: slant(62), up: [RIM / 2 + 18, RIM / 2 + 44], down: [RIM / 2 + 14, RIM / 2 + 80],
    w: [32, 48], press: (s, x) => 0.74 * fadeEnds(x), short: 0.14 });
  // second pass over the middle: firmer, flatter strokes spaced so each one still reads
  zig(list, r, { at: rimAt, s0: sOfX(330), s1: sOfX(1650), step: 40, ang: slant(49), up: [RIM / 2 + 18, RIM / 2 + 40], down: [RIM / 2 - 26, RIM / 2 + 62],
    w: [38, 54], press: (s, x) => 0.86 * sstep(660, 380, Math.abs(x - 1000)) });
  // a few long pulls along the rim itself
  for (let i = 0; i < 7; i++) {
    const th = r.range(-0.21, 0.21), len = r.range(240, 520), dr = -r.range(22, 84), h = len / 2 / R;
    const A = a.pt(th - h, dr), B = a.pt(th + h, dr);
    list.push({ x0: A.x, y0: A.y, x1: B.x, y1: B.y, w: r.range(28, 42), press: r.range(0.5, 0.8), bow: (len * len) / (8 * R), lut: tipLut(r), tail: r.range(0.1, 0.35), ph: r.range(0, 6.28), frame: 0 });
  }

  // crescent
  const moonAt = (X) => {
    const xc = L.clamp(X, -G.mL, G.mL);
    const yU = G.mcyA - Math.sqrt(G.mRa * G.mRa - X * X), yL = G.mcyB - Math.sqrt(G.mRb * G.mRb - xc * xc);
    const ph = Math.asin(X / G.mRa);
    return [a.cx + X, Math.abs(X) <= G.mL ? (yU + yL) / 2 : yU, Math.cos(ph), Math.sin(ph)];
  };
  zig(list, r, { at: moonAt, s0: -G.mL - 46, s1: G.mL + 30, step: 21, ang: (X) => L.deg(60) + 0.5 * Math.asin(X / G.mRa), up: [26, 58], down: [24, 62],
    w: [28, 42], press: (X) => 0.8 * L.lerp(1, 0.6, sstep(120, 470, Math.abs(X + 40))) });
  zig(list, r, { at: moonAt, s0: -330, s1: 250, step: 37, ang: (X) => L.deg(50) + 0.5 * Math.asin(X / G.mRa), up: [22, 46], down: [20, 50],
    w: [32, 46], press: (X) => 0.75 * sstep(340, 180, Math.abs(X + 40)) });

  // inner rim of the square hole: only lightly gone over (隐约)
  const yBar = G.hTop + G.hW / 2, xLeg = G.hHalf - G.hW / 2;
  const barP = L.makeNoise('s26bar');
  zig(list, r, { at: (x) => [a.cx + x, yBar, 1, 0], s0: -G.hHalf - 50, s1: G.hHalf + 50, step: 23, ang: () => L.deg(60), up: [22, 48], down: [22, 50],
    w: [28, 40], press: (x) => 0.5 + 0.2 * barP.n2(x / 260, 0.5) });
  for (const sgn of [-1, 1]) {
    zig(list, r, { at: (y) => [a.cx + sgn * xLeg, y, 0, 1], s0: G.hTop - 30, s1: H + PAD + 60, step: 26, ang: () => L.deg(150), up: [14, 30], down: [14, 30],
      w: [28, 40], press: () => 0.42 });
  }

  // ── strokes added while we watch: the scribble keeps working outward along the rim, plus a few on the inner marks ──
  const fresh = { up: [RIM / 2 + 18, RIM / 2 + 40], down: [RIM / 2 + 20, RIM / 2 + 74], w: [42, 54] };
  zig(list, r, { at: rimAt, s0: sOfX(1390), s1: 9e9, step: 35, count: 10, ang: slant(62), ...fresh, press: () => 1.15, frame: (i) => 1 + (i >> 1) });
  zig(list, r, { at: rimAt, s0: sOfX(590), s1: -9e9, step: -35, count: 10, ang: slant(62), ...fresh, press: () => 1.15, frame: (i) => 1 + (i >> 1) });
  zig(list, r, { at: moonAt, s0: 150, s1: 9e9, step: 58, count: 5, ang: (X) => L.deg(60) + 0.5 * Math.asin(X / G.mRa), up: [28, 54], down: [26, 58],
    w: [36, 46], press: () => 1.1, frame: (i) => 1 + i });
  zig(list, r, { at: (x) => [a.cx + x, yBar, 1, 0], s0: -70, s1: -9e9, step: -62, count: 5, ang: () => L.deg(60), up: [24, 46], down: [24, 48],
    w: [34, 44], press: () => 0.95, frame: (i) => 1 + i });
  return list;
}

// ───────────────────────── the rubbing ─────────────────────────
function buildRubbing(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const G = geometry(a);
  const pd = buildPaper(a);

  // 1) paper tooth → percentile field
  const nT = L.makeNoise('s26tooth');
  const T = new Float32Array(N), U = new Float32Array(N);
  let mn = 1e9, mx = -1e9;
  for (let yy = 0, i = 0; yy < LH; yy++) {
    for (let xx = 0; xx < LW; xx++, i++) {
      const v = 0.62 * nT.n2(xx / 3.4, yy / 3.4) + 0.36 * nT.n2(xx / 8.3 + 31.7, yy / 8.3 - 17.3) + 0.16 * nT.n2(xx / 44 - 5.1, yy / 44 + 9.3) + 0.4 * (hash2(xx, yy) - 0.5);
      T[i] = v; if (v < mn) mn = v; if (v > mx) mx = v;
    }
  }
  const BINS = 4096, hist = new Uint32Array(BINS), sc = (BINS - 1) / (mx - mn), cdf = new Float32Array(BINS);
  for (let i = 0; i < N; i++) hist[((T[i] - mn) * sc) | 0]++;
  for (let b = 0, acc = 0; b < BINS; b++) { acc += hist[b]; cdf[b] = acc / N; }
  for (let i = 0; i < N; i++) U[i] = cdf[((T[i] - mn) * sc) | 0];

  // 2) contact with the coin underneath, and the paper's own height (for a faint emboss)
  const nG = L.makeNoise('s26coin');
  const Cn = new Float32Array(N), Hh = new Float32Array(N);
  for (let yy = 0; yy < LH; yy++) {
    const y = yy - PAD, ddy = cy - y;
    for (let xx = 0; xx < LW; xx++) {
      const x = xx - PAD, ddx = x - cx, i = yy * LW + xx;
      const dr = Math.sqrt(ddx * ddx + ddy * ddy) - R;
      if (dr > 32) continue;
      const body = sstep(30, -3, dr);            // the sheet drapes from the coin's edge down to the table
      if (dr > 4) { Hh[i] = body * 0.6; continue; }
      let raised = 0, boost = 0, dE = 1e9;
      // outer rim
      const below = -(dr + RIM);                 // > 0 once we are under the band, in the field
      if (below < 4) {
        let ew = 0, nick = 0;
        if (dr > -9 || below > -9) {
          const sA = Math.atan2(ddx, ddy) * R;
          ew = nG.n2(sA / 36, 1.7) * 0.9 + nG.n2(sA / 6.5, 5.3) * 0.45;
          if (dr > -9) nick = 4 * sstep(0.62, 0.92, nG.n2(sA / 70, 9.9));   // small dents in an old rim
        }
        raised = sstep(1.5, -1.5, dr + nick - ew) * sstep(1.5, -1.5, below + ew);
        boost = 0.42 * Math.exp(-sq((dr + nick + 3.5) / 3.5)) + 0.22 * Math.exp(-sq((below + 3.5) / 3.5));
      } else dE = below;
      // crescent
      const dm = Math.min(G.mRa - Math.hypot(ddx, y - G.mcyA), Math.hypot(ddx, y - G.mcyB) - G.mRb);   // > 0 inside
      if (dm > -4) {
        const ew = dm < 7 ? nG.n2(x / 26, y / 26) * 1.2 : 0;
        const m = sstep(-1.5, 1.5, dm + ew);
        if (m > raised) { raised = m; boost = 0.2 * m; }
      } else if (-dm < dE) dE = -dm;
      // inner rim + hole
      const X = ddx < 0 ? -ddx : ddx;
      const dO = Math.min(G.hHalf - X, y - G.hTop), dH = Math.min(G.hHalf - G.hW - X, y - G.hTop - G.hW);
      let hole = 0;
      if (dO > -4) {
        const ew = (dO < 7 || dH > -7) ? nG.n2(x / 26 + 50, y / 26) * 1.1 : 0;
        hole = sstep(-1.5, 1.5, dH + ew);
        const m = sstep(-1.5, 1.5, dO + ew) * (1 - hole);
        if (m > raised) { raised = m; boost = 0.15 * m; }
      } else if (-dO < dE) dE = -dO;
      let c = 0;
      if (raised > 0.004) {
        const pit = sstep(0.5, 0.8, nG.n2(x / 11 + 7.3, y / 11 - 3.1));             // corrosion pits print as blanks
        c = raised * Math.max(0.05, 0.94 + 0.2 * nG.fbm(x / 80, y / 80, 2) + boost - 0.8 * pit);
      }
      if (raised < 1 && dr < 0 && hole < 1) c += (1 - raised) * (1 - hole) * FIELD * sstep(9, 30, dE);
      Cn[i] = c;
      Hh[i] = body * (0.6 + 0.4 * raised - 0.22 * hole);
    }
  }

  // 3) grain relief + emboss shading, lit from the upper left
  const Sh = new Float32Array(N);
  for (let yy = 3; yy < LH - 3; yy++) {
    for (let xx = 3; xx < LW - 3; xx++) {
      const i = yy * LW + xx;
      Sh[i] = 0.034 * (T[i + 1 + LW] - T[i - 1 - LW]) + 0.15 * (Hh[i + 3 + 3 * LW] - Hh[i - 3 - 3 * LW]);
    }
  }

  // 4) pressure
  const P = new Float32Array(N);
  const strokes = buildStrokes(a, G);
  const shadeInto = (i, p, out, o) => {
    const k = i * 4;
    let r = pd[k], g = pd[k + 1], b = pd[k + 2], sh = Sh[i];
    const c = Cn[i];
    if (c > 0 && p > 0.004) {
      const pc = p * c, cov = COVMAX * (1 - Math.exp(-pc)), e = U[i] - (1 - cov);
      let al = 0.3 * sstep(0.62, 0.95, cov), d = 0;        // once the peaks are loaded, a thin smear of wax reaches the valleys
      if (e > -SOFT) {
        let a2 = e >= SOFT ? 1 : (e + SOFT) / (2 * SOFT); a2 = a2 * a2 * (3 - 2 * a2);
        const thick = e > 0.4 ? 1 : e < 0 ? 0 : e / 0.4;
        d = thick * sstep(0.7, 2.8, pc);
        a2 *= 0.88 + 0.12 * thick;
        al += (1 - al) * a2;
      }
      r += (MID[0] + (DEEP[0] - MID[0]) * d - r) * al;
      g += (MID[1] + (DEEP[1] - MID[1]) * d - g) * al;
      b += (MID[2] + (DEEP[2] - MID[2]) * d - b) * al;
      sh *= 1 + 1.3 * al;
    }
    const m = 1 + sh;
    out[o] = r * m; out[o + 1] = g * m; out[o + 2] = b * m; out[o + 3] = 255;
  };

  for (const st of strokes) {
    if (st.frame) continue;
    const f = footprint(st); if (!f) continue;
    for (let yy = 0; yy < f.bh; yy++) { const row = (f.Y0 + yy) * LW + f.X0, o = yy * f.bw; for (let xx = 0; xx < f.bw; xx++) P[row + xx] += f.d[o + xx]; }
  }
  const img = new ImageData(LW, LH), od = img.data;
  for (let i = 0; i < N; i++) shadeInto(i, P[i], od, i * 4);
  const base = L.makeCanvas(LW, LH);
  base.getContext('2d').putImageData(img, 0, 0);
  base._pad = PAD;

  // 5) the strokes that arrive during the shot: opaque patches of exactly the pixels they change
  const patches = [];
  for (const st of strokes.filter((s) => s.frame).sort((p, q) => p.frame - q.frame)) {
    const f = footprint(st); if (!f) continue;
    const pi = new ImageData(f.bw, f.bh), q = pi.data;
    let any = false;
    for (let yy = 0; yy < f.bh; yy++) {
      const row = (f.Y0 + yy) * LW + f.X0, o = yy * f.bw;
      for (let xx = 0; xx < f.bw; xx++) {
        const dp = f.d[o + xx]; if (dp < 0.004) continue;
        const i = row + xx; P[i] += dp;
        if (Cn[i] > 0) { shadeInto(i, P[i], q, (o + xx) * 4); any = true; }
      }
    }
    if (!any) continue;
    const c = L.makeCanvas(f.bw, f.bh);
    c.getContext('2d').putImageData(pi, 0, 0);
    patches.push({ c, x: f.X0 - PAD, y: f.Y0 - PAD, frame: st.frame });
  }
  return { base, patches };
}

export default {
  name: '蜡笔拓钱',
  tone: 'dark',
  init(env) {
    S = buildRubbing(env);
  },
  draw(ctx, env, p) {
    const k = Math.round(p * (env.frames - 1));
    const rot = L.lerp(-0.003, 0.003, p);       // the sheet slides a few pixels along the arc
    L.blit(ctx, env, S.base, { rot });
    L.cam(ctx, env, { rot }, () => { for (const q of S.patches) if (q.frame <= k) ctx.drawImage(q.c, q.x, q.y); });
    // soft daylight from the upper left; the corners fall into a deeper blue, never grey
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = L.radial(ctx, 720, 300, 150, 1500, [[0, 'rgba(255,255,255,0.2)'], [0.5, 'rgba(255,255,255,0)'], [1, 'rgba(30,62,150,0.24)']]);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  },
};
