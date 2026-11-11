// s01 — 天青碗沿晨光. The opening "horizon" of 《中国古玩》: the far lip of a sky-blue (天青) glazed bowl in extreme
// close-up, photographed against the light. The arc is the rim. Below it the bowl wall is in shadow — night blue, with
// only a breath of glaze glowing just under the lip and a few hairline crackles (开片) catching the light. On the lip the
// glaze is thinnest, and it carries one soft moon-white highlight; above it the light blooms tianqing → blue-green →
// night blue. Nothing else: the space above keeps darkening for well over a frame height, because the title card is
// simply the camera tilted up into that darkness (see lib/titlecard.js) before it comes back down onto this exact image
// and the film loops.
//
// It is meant to read as a macro photograph, not as a drawn glow:
//   · depth of field — the lens is focused on the crest of the rim; toward both ends of the frame the lip, its highlight,
//     the crackle and the bubbles all fall softly out of focus (the edge stays centred on the arc, it only softens);
//   · the highlight has a shape — it is a band a few px deep that sits ON the lip (crisp upper edge, soft lower edge), its
//     strength and depth wander along the rim, crackle lines nick it, and it blooms a little like a hot edge does on film;
//   · two masses — light above, dark below, meeting on the arc; the glow under the lip falls away fast and then lingers;
//   · the bands of light above are not perfect circles: they swell and thin slowly, a little deeper toward the left.
//
// Everything static is shaded per pixel in init() with a dithered float pipeline (8-bit gradients this dark would band):
//   base   — the "before dawn" state, tall enough for the tilt
//   bright — the "first light" state, same geometry
//   lip    — the moon-white highlight on the lip (alpha only)
// Each frame is base + bright seen through a soft horizontal envelope that widens with k, so the light spreads outward
// along the rim from the crest; the lip highlight rides on top through a narrower envelope of its own.
import * as L from '../../../lib/core.js';

const { W, H } = L;

export const TITLE_TILT = 800;   // how far the title card tilts up (px)

const MX = 8;                    // spare pixels left / right / below (the camera only ever pushes in, never out)
const TOP = TITLE_TILT + 40;     // rows painted above the frame for the tilt
const CW = W + MX * 2;
const Q = 4, TMAX = 2800;        // colour LUTs: 0.25 px steps out to 2800 px from the rim
const UMAX = 1300;               // half-length of the 1-D tables that run along the rim (px of arc length)
const RL = 220;                  // the lip rolls away from the lens over this many px (foreshortens the crackle toward the rim)
const NR = 64;                   // the out-of-focus rim profiles cover this many px either side of the rim
const HR = 96;                   // the lip highlight, bloom included, reaches this far from the rim
const SAME = 830;                // from this distance above the rim upward "bright" and "base" are the same picture
const DC = 210;                  // crackle is only ever visible this far down the wall
const MU = 32, MT = 32, MTOP = 780;   // band-swell table: cell size along the rim / away from it, and how far up it applies
const STU = 40, STT = 4, STN = Math.ceil(440 / STT) + 3, SUN = Math.ceil((UMAX * 2) / STU) + 2;   // strata table: cell size along the rim / away from it
const STRATA = [[74, 10, -0.036], [110, 15, 0.042], [166, 12, -0.032], [238, 28, 0.036], [316, 22, -0.024]];   // [height above the rim, half-thickness, change in value]
const SIG = [0.5, 0.85, 1.4, 2.2, 3.3, 4.8, 6.8, 9];   // blur radii (px) the depth of field is tabulated for
let S = null;

// ── colour by distance from the rim (px). Task palette: 月白 #e6f3ef · 天青 #8fc9c4 · 青蓝 #3f7f9a · 夜蓝 #0d1b3a · #050a16 ──
const FAR = [[495, '#0d1b3a'], [650, '#0a152e'], [850, '#070f22'], [1150, '#050a16'], [2800, '#04080f']];
const SKY_BRIGHT = [[0, '#bde2dd'], [5, '#b1dcd7'], [14, '#a6d6d1'], [30, '#9ad0cb'], [54, '#8fc9c4'], [90, '#7bc1c3'], [134, '#63b1be'],
  [182, '#4f9cb2'], [236, '#3f7f9a'], [300, '#2e6992'], [370, '#205080'], [444, '#173b6a'], [520, '#122b53'], [600, '#0e2042'], [720, '#0a152e'], [850, '#070f22']];
const SKY_DIM = [[0, '#5a9cae'], [2.5, '#468aa0'], [9, '#3f7f9a'], [26, '#35708f'], [58, '#2a5d82'], [105, '#204b74'], [165, '#183b66'], [240, '#132e58'],
  [320, '#10254b'], [422, '#0e1f41'], ...FAR];
const DEEP = [[300, '#081327'], [430, '#060d1c'], [620, '#050a16'], [1400, '#04080f']];
// under the lip the light drops fast (the wall is in shadow) and then lingers as a long, low glow inside the glaze
const BODY_BRIGHT = [[0, '#c4e5e0'], [1.2, '#aad7d2'], [2.6, '#8fc9c4'], [4.5, '#6aaeb6'], [7, '#4f93a6'], [10.5, '#3d7b96'], [16, '#2e6587'], [25, '#225276'],
  [38, '#194064'], [56, '#123152'], [80, '#0d2542'], [112, '#0a1c35'], [155, '#09172d'], [215, '#081428'], ...DEEP];
const BODY_DIM = [[0, '#5a9cae'], [1.3, '#4f93a6'], [3, '#3a7893'], [7, '#2a5f80'], [14, '#1e496c'], [26, '#163859'], [46, '#102948'], [80, '#0c1e3a'],
  [120, '#0a1830'], [170, '#09152b'], [240, '#081326'], ...DEEP];
const MOON = [233, 245, 241];    // the lip highlight (月白)

const sstep = (a, b, v) => { const t = v <= a ? 0 : v >= b ? 1 : (v - a) / (b - a); return t * t * (3 - 2 * t); };

/** colour function → Float32 LUT; the kinks between stops are rounded off more and more with distance from the rim (the rim itself stays crisp) */
function buildLut(f) {
  const n = TMAX * Q + 4, out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = i / Q, rad = Math.min(48, t * 0.17);
    let r = 0, g = 0, b = 0;
    for (let k = -4; k <= 4; k++) { const c = f(Math.max(0, t + (k / 4) * rad)); r += c[0]; g += c[1]; b += c[2]; }
    out[i * 3] = r / 9; out[i * 3 + 1] = g / 9; out[i * 3 + 2] = b / 9;
  }
  return out;
}
/** ramp `fa` handing over to ramp `fb` between distances a and b */
const handOver = (fa, fb, a, b) => (t) => {
  const k = sstep(a, b, t);
  if (k <= 0) return fa(t);
  if (k >= 1) return fb(t);
  const p = fa(t), q = fb(t);
  return [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k];
};

// ── depth of field ──
/** blur radius (px) at arc-length U from the crest: sharp on the crest, soft by the ends of the frame */
const sigmaOf = (U) => 0.5 + 5.8 * Math.pow(Math.min(1.3, Math.abs(U) / 1000), 1.7);
/** |U| (px) → fractional index into SIG */
function levelTable() {
  const t = new Float32Array(UMAX + 2), last = SIG.length - 1;
  for (let i = 0; i < t.length; i++) {
    const s = Math.min(SIG[last], sigmaOf(i));
    let j = 0;
    while (j < last - 1 && s > SIG[j + 1]) j++;
    t[i] = j + L.clamp((s - SIG[j]) / (SIG[j + 1] - SIG[j]));
  }
  return t;
}
/** gaussian-blur a 1-D profile (ch channels, Q samples per px) once per SIG level, returning the middle `half` px either side */
function blurLevels(src, n, ch, pad, half) {
  const m = half * Q * 2 + 1;
  return SIG.map((sg) => {
    const rad = Math.ceil(sg * 3 * Q), ker = new Float32Array(rad * 2 + 1), out = new Float32Array((m + 1) * ch);
    let sum = 0;
    for (let k = -rad; k <= rad; k++) { const w = Math.exp(-0.5 * (k / (sg * Q)) * (k / (sg * Q))); ker[k + rad] = w; sum += w; }
    for (let i = 0; i <= m; i++) {
      const c = Math.min(i, m - 1) + pad * Q;
      for (let h = 0; h < ch; h++) {
        let v = 0;
        for (let k = -rad; k <= rad; k++) v += src[Math.min(n - 1, Math.max(0, c + k)) * ch + h] * ker[k + rad];
        out[i * ch + h] = v / sum;
      }
    }
    return out;
  });
}
/** the picture across the rim (sky above, wall below) as it looks at each amount of defocus */
function rimProfiles(sky, body) {
  const pad = 30, half = (NR + pad) * Q, n = half * 2 + 1, src = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const s = (i - half) / Q, lut = s >= 0 ? sky : body, q = Math.round(Math.abs(s) * Q) * 3;
    src[i * 3] = lut[q]; src[i * 3 + 1] = lut[q + 1]; src[i * 3 + 2] = lut[q + 2];
  }
  return blurLevels(src, n, 3, pad, NR);
}
/**
 * the highlight on the lip, across the rim: a band that begins exactly at the rim, stays full for a couple of px and
 * dies away down the wall, plus the bloom a hot edge throws on film. Index: depth below the rim (negative = above it).
 */
function lipProfiles() {
  const pad = 30, half = (HR + pad) * Q, n = half * 2 + 1, src = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const d = (i - half) / Q;
    const core = d < 0 ? 0 : d < 3 ? 1 : Math.exp(-((d - 3) / 2.4) * ((d - 3) / 2.4));
    const bloom = 0.2 * Math.exp(-((d - 2) / 8) * ((d - 2) / 8)) + 0.07 * Math.exp(-Math.abs(d - 2) / 26);
    src[i] = core + bloom * (1 - core);
  }
  return blurLevels(src, n, 1, pad, HR);
}

/** the bands of light above the rim swell and thin slowly along its length, and run a little deeper toward the left */
function bandTable() {
  const nz = L.makeNoise('s01bands');
  const nu = Math.ceil((UMAX * 2) / MU) + 2, nt = Math.ceil(MTOP / MT) + 3, m = new Float32Array(nu * nt);
  for (let j = 0; j < nt; j++) {
    const t = j * MT, fade = 1 - sstep(520, 740, t);
    for (let i = 0; i < nu; i++) {
      const U = i * MU - UMAX;
      m[j * nu + i] = 1 + fade * (0.09 * nz.fbm(U / 760 + 3.3, t / 330 + 1.1, 2) - 0.075 * L.clamp(U / 1000, -1.2, 1.2));
    }
  }
  // a few faint strata in the light, like thin mist lying in layers behind the bowl: each is one long veil that follows
  // the rim, drifts a little in height, comes and goes along its length, and changes the value by only a few per cent
  const ns = L.makeNoise('s01strata'), st = new Float32Array(STN * SUN);
  for (let i = 0; i < SUN; i++) {
    const U = i * STU - UMAX;
    for (let j = 0; j < STN; j++) st[j * SUN + i] = 0.01 * sstep(14, 70, j * STT) * (1 - sstep(250, 430, j * STT)) * ns.n2(U / 1150 + 8.3, (j * STT) / 46);
    for (let li = 0; li < STRATA.length; li++) {
      const [T0, w, A] = STRATA[li];
      const tc = T0 * (1 + 0.13 * ns.n2(U / 980 + li * 13.7, 0.5 + li)), amp = A * (0.5 + 0.5 * ns.n2(U / 640 - li * 7.3, 3.1 + li * 2));
      for (let j = 0; j < STN; j++) { const e = (j * STT - tc) / w; st[j * SUN + i] += amp * Math.exp(-e * e); }
    }
  }
  return { m, nu, st };
}

const LIP = RL * Math.PI / 2;    // surface distance covered by the rolled part of the lip
/** depth below the rim on screen (px) → distance down the glaze surface, and back */
const surfV = (d) => (d < RL ? RL * Math.acos(1 - d / RL) : LIP + (d - RL));
const depthOf = (V) => (V <= 0 ? 0 : V < LIP ? RL * (1 - Math.cos(V / RL)) : RL + (V - LIP));

/**
 * 开片: crackle grows by subdivision — a new crack starts on an existing one, runs roughly square to it and stops at the
 * next crack it meets (T-junctions, never crossings). Built in glaze-surface coordinates (U along the rim, V down the wall)
 * and returned as polylines with a strength: the first, longest cracks are the boldest; a patch here and there crazes finer.
 * This close to the glaze the cells are big — only a handful of lines cross the lit strip under the lip.
 */
function crackle() {
  const r = L.rng('s01crackle'), nzp = L.makeNoise('s01craze'), segs = [];
  const split = (P, lvl) => {
    const n = P.length;
    let A = 0, cu = 0, cv = 0, li = 0, ll = 0;
    const len = [];
    for (let i = 0; i < n; i++) {
      const p = P[i], q = P[(i + 1) % n];
      A += p[0] * q[1] - q[0] * p[1]; cu += p[0]; cv += p[1];
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]); len.push(l); if (l > ll) { ll = l; li = i; }
    }
    A = Math.abs(A) / 2; cu /= n; cv /= n;
    const fine = nzp.fbm(cu / 520 + 4.4, cv / 520 - 9.1, 2) > 0.2;
    if (A < (fine ? r.range(3200, 8000) : r.range(11000, 30000)) || lvl > 13) return;
    // usually the new crack springs from the longest side of the cell, now and then from another long one
    if (r.chance(0.3)) { const cand = []; for (let i = 0; i < n; i++) if (len[i] > 0.6 * ll) cand.push(i); li = r.pick(cand); }
    const p = P[li], q = P[(li + 1) % n], t = r.range(0.24, 0.76);
    const ox = L.lerp(p[0], q[0], t), oy = L.lerp(p[1], q[1], t);
    const ang = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2 + L.clamp(r.gauss() * 0.42, -1, 1);
    let dx = Math.cos(ang), dy = Math.sin(ang);
    if (dx * (cu - ox) + dy * (cv - oy) < 0) { dx = -dx; dy = -dy; }
    let best = 1e9, hi = -1;
    for (let i = 0; i < n; i++) {
      if (i === li) continue;
      const c = P[i], e = P[(i + 1) % n], ex = e[0] - c[0], ey = e[1] - c[1], den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const tt = ((c[0] - ox) * ey - (c[1] - oy) * ex) / den, ss = ((c[0] - ox) * dy - (c[1] - oy) * dx) / den;
      if (tt > 1e-6 && ss >= 0 && ss <= 1 && tt < best) { best = tt; hi = i; }
    }
    if (hi < 0) return;
    const o = [ox, oy], h = [ox + dx * best, oy + dy * best];
    segs.push({ o, h, k: (lvl <= 2 ? 1 : Math.max(0.42, Math.pow(0.87, lvl - 2))) * r.range(0.62, 1) });
    const P1 = [o], P2 = [h];
    for (let i = (li + 1) % n; ; i = (i + 1) % n) { P1.push(P[i]); if (i === hi) break; }
    P1.push(h);
    for (let i = (hi + 1) % n; ; i = (i + 1) % n) { P2.push(P[i]); if (i === li) break; }
    P2.push(o);
    split(P1, lvl + 1); split(P2, lvl + 1);
  };
  split([[-UMAX, -70], [UMAX, -70], [UMAX, 560], [-UMAX, 560]], 0);
  return segs;
}

/** per-pixel fields of the bowl wall just under the rim: the hairline crackle (already out of focus where the lens is) and the glaze depth */
function buildFields(a) {
  const R = a.R, cx = a.cx, cy = a.cy;
  const y0 = Math.floor(a.crestY) - 1, hgt = Math.min(H + MX, Math.ceil(a.yAt(-MX)) + DC + 4) - y0;
  const crk = new Float32Array(CW * hgt), ln = new Float32Array(CW * hgt);
  const nz = L.makeNoise('s01glaze'), nw = L.makeNoise('s01warp');
  // glaze thickness along the rim: the glow sinks a little deeper here, a little shallower there
  const gmod = new Float32Array(UMAX * 2 + 2);
  for (let i = 0; i < gmod.length; i++) { const U = i - UMAX; gmod[i] = 1 + 0.26 * nz.fbm(U / 520 + 3.1, 0.7, 3) + 0.06 * nz.n2(U / 70, 9.4); }
  // draw the cracks as hairlines: surface → screen (the lip rolls away, so they crowd together and flatten toward the rim)
  const lines = L.makeCanvas(CW, hgt), lg = lines.getContext('2d', { willReadFrequently: true });
  lg.translate(MX, -y0); lg.lineCap = 'round'; lg.lineJoin = 'round';
  for (const sg of crackle()) {
    const len = Math.hypot(sg.h[0] - sg.o[0], sg.h[1] - sg.o[1]), n = Math.max(2, Math.ceil(len / 9));
    lg.beginPath();
    for (let i = 0; i <= n; i++) {
      const U0 = L.lerp(sg.o[0], sg.h[0], i / n), V0 = L.lerp(sg.o[1], sg.h[1], i / n);
      // one smooth warp for every crack: they bow a little, and still meet exactly
      const U = U0 + 22 * nw.n2(U0 / 320 + 5.2, V0 / 320) + 3 * nw.n2(U0 / 90 + 1.7, V0 / 90 + 3.3);
      const V = V0 + 22 * nw.n2(U0 / 320 - 17.3, V0 / 320 + 40.1) + 3 * nw.n2(U0 / 90 - 22.9, V0 / 90 + 61.4);
      const p = a.pt(U / R, -depthOf(V));
      if (i) lg.lineTo(p.x, p.y); else lg.moveTo(p.x, p.y);
    }
    lg.strokeStyle = `rgba(255,255,255,${sg.k.toFixed(3)})`; lg.lineWidth = 1 + 0.6 * sg.k; lg.stroke();
  }
  const read = (c) => c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, CW, hgt).data;
  const l0 = lg.getImageData(0, 0, CW, hgt).data, l1 = read(L.blurred(lines, 1.6)), l2 = read(L.blurred(lines, 4.5));
  for (let j = 0; j < hgt; j++) {
    const ddy = cy - (y0 + j + 0.5), ddy2 = ddy * ddy;
    for (let i = 0; i < CW; i++) {
      const ddx = i - MX + 0.5 - cx, d = R - Math.sqrt(ddx * ddx + ddy2);
      if (d < 0.5 || d > DC) continue;
      const k = j * CW + i, q = k * 4 + 3;
      if (!(l0[q] | l1[q] | l2[q])) continue;
      const U = Math.atan2(ddx, ddy) * R, sg = sigmaOf(U);
      // out of focus the hairlines swell and fade
      const w1 = L.clamp((sg - 0.6) / 1.2), w2 = L.clamp((sg - 1.8) / 3.2);
      let line = l0[q] + (l1[q] * 1.25 - l0[q]) * w1;
      line = (line + (l2[q] * 1.7 - line) * w2) / 255 * (1 - 0.5 * L.clamp((sg - 1.5) / 5));
      ln[k] = line;
      // whole stretches of the network stay all but invisible; it fades out down the wall
      const vis = sstep(-0.42, 0.34, nz.fbm(U / 430 + 71, surfV(d) / 430 - 8, 3));
      crk[k] = line * (0.34 + 0.66 * vis) * sstep(0.5, 5, d) * (1 - sstep(DC - 90, DC, d));
    }
  }
  return { y0, hgt, crk, ln, gmod };
}

/** shade rows y0..y1 of the picture: sky above the rim, bowl wall below, dithered so the dark gradients never band */
function paint(a, y0, y1, sky, body, F, T, gain, strata, seed) {
  const R = a.R, cx = a.cx, cy = a.cy;
  const near = rimProfiles(sky, body), lvl = T.lvl, bm = T.band.m, nu = T.band.nu, st = T.band.st, last = SIG.length - 1;
  const hgt = y1 - y0, img = new ImageData(CW, hgt), o8 = img.data;
  let s = seed | 0 || 1, o = 0;
  for (let j = 0; j < hgt; j++) {
    const ddy = cy - (y0 + j + 0.5), ddy2 = ddy * ddy;
    const fj = y0 + j - F.y0;
    for (let i = 0; i < CW; i++, o += 4) {
      const ddx = i - MX + 0.5 - cx, dr = Math.sqrt(ddx * ddx + ddy2) - R;
      let r, g, b;
      if (dr >= MTOP) {
        const t = dr * Q, i0 = t | 0, f = t - i0, q = i0 * 3;
        r = sky[q] + (sky[q + 3] - sky[q]) * f; g = sky[q + 1] + (sky[q + 4] - sky[q + 1]) * f; b = sky[q + 2] + (sky[q + 5] - sky[q + 2]) * f;
      } else {
        const U = Math.atan2(ddx, ddy) * R, au = U < 0 ? -U : U;
        let se, lut;   // signed distance from the rim after the slow swells: > 0 sky, < 0 wall
        if (dr > 0) {
          const fu = (U + UMAX) / MU, iu = fu | 0, tu = fu - iu, ft = dr / MT, it = ft | 0, tt = ft - it, k0 = it * nu + iu;
          const m = (bm[k0] + (bm[k0 + 1] - bm[k0]) * tu) * (1 - tt) + (bm[k0 + nu] + (bm[k0 + nu + 1] - bm[k0 + nu]) * tu) * tt;
          se = dr / m; lut = sky;
        } else {
          const d = -dr, gm = F.gmod[(U + UMAX) | 0];
          se = -(d < 3 ? d : d - (d - 3) * (1 - 1 / gm) * Math.exp(-d / 90)); lut = body;   // only the glow near the lip breathes
        }
        const as = se < 0 ? -se : se;
        let wn = as >= NR - 4 ? 0 : as <= NR - 20 ? 1 : (NR - 4 - as) / 16;
        if (wn < 1) {
          const t = as * Q, i0 = t | 0, f = t - i0, q = i0 * 3;
          r = lut[q] + (lut[q + 3] - lut[q]) * f; g = lut[q + 1] + (lut[q + 4] - lut[q + 1]) * f; b = lut[q + 2] + (lut[q + 5] - lut[q + 2]) * f;
        } else { r = g = b = 0; }
        if (wn > 0) {
          // near the rim: the same profile, as soft as the lens renders it at this point along the rim
          const lv = lvl[au > UMAX ? UMAX : au | 0], la = lv | 0, lf = lv - la, A = near[la], B = near[la < last ? la + 1 : last];
          const t = (se + NR) * Q, i0 = t | 0, f = t - i0, q = i0 * 3;
          const ar = A[q] + (A[q + 3] - A[q]) * f, ag = A[q + 1] + (A[q + 4] - A[q + 1]) * f, ab = A[q + 2] + (A[q + 5] - A[q + 2]) * f;
          const br = B[q] + (B[q + 3] - B[q]) * f, bg = B[q + 1] + (B[q + 4] - B[q + 1]) * f, bb = B[q + 2] + (B[q + 5] - B[q + 2]) * f;
          const nr = ar + (br - ar) * lf, ng = ag + (bg - ag) * lf, nb = ab + (bb - ab) * lf;
          r += (nr - r) * wn; g += (ng - g) * wn; b += (nb - b) * wn;
        }
        if (dr > 12 && dr < 432) {
          const fu = (U + UMAX) / STU, iu = fu | 0, tu = fu - iu, ft = dr / STT, it = ft | 0, tt = ft - it, k0 = it * SUN + iu;
          const v = 1 + strata * ((st[k0] + (st[k0 + 1] - st[k0]) * tu) * (1 - tt) + (st[k0 + SUN] + (st[k0 + SUN + 1] - st[k0 + SUN]) * tu) * tt);
          r *= v; g *= v; b *= v;
        }
        if (dr < 0 && fj >= 0 && fj < F.hgt) {
          const kI = F.crk[fj * CW + i];
          if (kI > 0.004) { const d = -dr, w = kI * gain * (0.36 * Math.exp(-d / 40) + 0.1 * Math.exp(-d / 110)); r += 143 * w; g += 201 * w; b += 196 * w; }
        }
      }
      // very fine grain (triangular noise), a little stronger in the light; doubles as dither
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5; const n1 = (s >>> 0) / 4294967296;
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5; const n2 = (s >>> 0) / 4294967296;
      const gn = (n1 + n2 - 1) * (1.15 + 0.017 * (0.3 * r + 0.6 * g + 0.1 * b));
      o8[o] = r + gn; o8[o + 1] = g + gn; o8[o + 2] = b + gn; o8[o + 3] = 255;
    }
  }
  const c = L.makeCanvas(CW, hgt);
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

/** the moon-white highlight on the lip, as an alpha layer: its strength and depth wander along the rim, crackle nicks it, the lens softens it */
function paintLip(a, F, T) {
  const R = a.R, cx = a.cx, cy = a.cy, prof = lipProfiles(), lvl = T.lvl, last = SIG.length - 1;
  const y0 = Math.floor(a.crestY) - HR - 2, y1 = Math.min(H + MX, Math.ceil(a.yAt(-MX)) + HR + 2), hgt = y1 - y0;
  const nz = L.makeNoise('s01lip'), inten = new Float32Array(UMAX * 2 + 2), thick = new Float32Array(UMAX * 2 + 2);
  for (let i = 0; i < inten.length; i++) {
    const U = i - UMAX;
    inten[i] = L.clamp(0.9 + 0.26 * nz.fbm(U / 330 + 2.2, 0.3, 3) + 0.07 * nz.n2(U / 34, 5.1), 0.5, 1.08);
    thick[i] = L.clamp(1 + 0.3 * nz.fbm(U / 250 - 7.7, 4.4, 2) + 0.09 * nz.n2(U / 46, 1.9), 0.62, 1.45);
  }
  const img = new ImageData(CW, hgt), o8 = img.data;
  let s = 6021023, o = 0;
  for (let j = 0; j < hgt; j++) {
    const ddy = cy - (y0 + j + 0.5), ddy2 = ddy * ddy, fj = y0 + j - F.y0;
    for (let i = 0; i < CW; i++, o += 4) {
      const ddx = i - MX + 0.5 - cx, d = R - Math.sqrt(ddx * ddx + ddy2);
      o8[o] = MOON[0]; o8[o + 1] = MOON[1]; o8[o + 2] = MOON[2];
      if (d <= 1 - HR || d >= HR - 1) continue;
      const U = Math.atan2(ddx, ddy) * R, au = U < 0 ? -U : U, iu = (U + UMAX) | 0;
      const dk = d > 0 ? d / thick[iu] : d;
      const lv = lvl[au > UMAX ? UMAX : au | 0], la = lv | 0, lf = lv - la, A = prof[la], B = prof[la < last ? la + 1 : last];
      const t = (dk + HR) * Q, i0 = t | 0, f = t - i0;
      const ha = A[i0] + (A[i0 + 1] - A[i0]) * f, hb = B[i0] + (B[i0 + 1] - B[i0]) * f;
      let al = (ha + (hb - ha) * lf) * inten[iu];
      if (d > 0 && fj >= 0 && fj < F.hgt) al *= 1 - 0.6 * Math.min(1, F.ln[fj * CW + i] * 1.6);   // a crack crossing the lip nicks the highlight
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5; const n1 = (s >>> 0) / 4294967296;
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5; const n2 = (s >>> 0) / 4294967296;
      o8[o + 3] = al * 255 + (n1 + n2 - 1) * 0.8 + 0.5;
    }
  }
  const c = L.makeCanvas(CW, hgt);
  c.getContext('2d').putImageData(img, 0, 0);
  return { c, y0 };
}

/** the odd bubble suspended in the glaze, lit from behind (汝釉气泡"寥若晨星"): sparse points, thinning out with depth, swelling into soft discs out of focus */
function bubbles(a, canvas, yTop, gain) {
  const g = canvas.getContext('2d'), r = L.rng('s01bubbles'), span = a.span(MX + 30);
  g.save(); g.translate(MX, -yTop); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 46; i++) {
    const th = r.range(-span, span), d = 6 + 170 * Math.pow(r(), 1.9), r0 = r.range(0.7, 2.1), k = r.range(0.35, 1);
    const rad = r0 + 0.75 * (sigmaOf(th * a.R) - 0.5);
    const p = a.pt(th, -d), al = gain * k * Math.pow(r0 / rad, 1.25) * (0.55 * Math.exp(-d / 40) + 0.12 * Math.exp(-d / 150));
    g.fillStyle = L.radial(g, p.x, p.y, 0, rad * 2.2, [[0, `rgba(214,238,232,${al.toFixed(4)})`], [0.45, `rgba(143,201,196,${(al * 0.4).toFixed(4)})`], [1, 'rgba(143,201,196,0)']]);
    g.fillRect(p.x - rad * 2.4, p.y - rad * 2.4, rad * 4.8, rad * 4.8);
  }
  g.restore();
}

export function initOpening(env) {
  const a = env.arc, key = `${a.R}/${a.crestY}/${a.cx}`;
  if (S && S.key === key) return S;
  const F = buildFields(a), T = { lvl: levelTable(), band: bandTable() };
  const yB0 = Math.floor(a.crestY) - SAME;                      // above this row "bright" and "base" are identical
  const fDim = L.makeRamp(SKY_DIM), skyDim = buildLut(fDim), skyBright = buildLut(handOver(L.makeRamp(SKY_BRIGHT), fDim, 590, 760));
  const base = paint(a, -TOP, H + MX, skyDim, buildLut(L.makeRamp(BODY_DIM)), F, T, 0.42, 0.7, 90210);
  const bright = paint(a, yB0, H + MX, skyBright, buildLut(L.makeRamp(BODY_BRIGHT)), F, T, 1, 1, 271828);
  bubbles(a, base, -TOP, 0.35);
  bubbles(a, bright, yB0, 1);
  const lip = paintLip(a, F, T);
  const tmp = L.makeCanvas(bright.width, bright.height), ltmp = L.makeCanvas(lip.c.width, lip.c.height);
  S = { key, base, bright, yB0, tmp, tg: tmp.getContext('2d'), lip: lip.c, yL0: lip.y0, ltmp, lg: ltmp.getContext('2d') };
  return S;
}

/**
 * horizontal envelope as a gradient: `peak` within `w` px of the light's centre, easing down to `floor` over the next
 * `fall` px. The light sits `off` px from the crest and reaches `skew` further on the left than on the right.
 */
function envelope(g, x0, x1, { w, fall, floor, peak, off = 0, skew = 0 }) {
  const grad = g.createLinearGradient(x0, 0, x1, 0), N = 56;
  for (let i = 0; i <= N; i++) {
    const x = L.lerp(-MX, W + MX, i / N) - W / 2 - off, ax = Math.abs(x);
    const e = floor + (peak - floor) * (1 - L.smooth((ax - w) / (fall * (x < 0 ? 1 + skew : 1 - skew))));
    grad.addColorStop(i / N, `rgba(0,0,0,${e.toFixed(4)})`);
  }
  return grad;
}
/** copy `src` into its scratch canvas, seen through a horizontal envelope */
function through(g, src, env) {
  g.globalCompositeOperation = 'copy'; g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = envelope(g, 0, src.width, env);
  g.fillRect(0, 0, src.width, src.height);
}

/**
 * tilt: px the camera has tilted UP (the whole picture slides down by this much). 0 = the opening framing.
 * k:    0..1 progress of the light itself — it spreads outward along the rim and brightens a touch, then holds.
 */
export function drawOpening(ctx, env, { tilt = 0, k = 0 } = {}) {
  const a = env.arc, s = initOpening(env);
  const u = L.smooth(L.clamp(k) / 0.86);          // settles a few frames before the end so the loop joins cleanly
  const zoom = 1 + 0.014 * u;
  ctx.save();
  ctx.fillStyle = '#04080f'; ctx.fillRect(0, 0, W, H);
  ctx.translate(0, tilt);
  ctx.translate(a.cx, a.crestY); ctx.scale(zoom, zoom); ctx.translate(-a.cx, -a.crestY);
  // before dawn
  ctx.drawImage(s.base, -MX, -TOP);
  if (s.yB0 + tilt < H) {
    // first light, spreading from the crest toward both ends of the rim
    through(s.tg, s.bright, { w: L.lerp(120, 700, u), fall: L.lerp(960, 1150, u), floor: L.lerp(0.1, 0.62, u), peak: L.lerp(0.84, 1, u), off: -50, skew: 0.12 });
    ctx.drawImage(s.tmp, -MX, s.yB0);
  }
  if (s.yL0 + tilt < H) {
    // the moon-white highlight on the lip: hottest at the crest, running out along the rim as the light grows
    through(s.lg, s.lip, { w: L.lerp(40, 540, u), fall: L.lerp(560, 900, u), floor: L.lerp(0, 0.45, u), peak: L.lerp(0.72, 1, u), off: -50, skew: 0.12 });
    ctx.drawImage(s.ltmp, -MX, s.yL0);
  }
  ctx.restore();
}

export default {
  name: '天青碗沿晨光',
  tone: 'light',
  init(env) { initOpening(env); },
  draw(ctx, env, p) { drawOpening(ctx, env, { tilt: 0, k: p }); },
};
