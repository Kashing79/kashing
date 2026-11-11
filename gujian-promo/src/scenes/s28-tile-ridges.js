// s28 — 月下瓦垄. A macro photograph of an old grey-tile roof (筒瓦屋面) under the moon, almost black & white.
// The arc is the roof's round ridge (过垄脊): the crowns of the 筒瓦 rolling over it make a softly waved edge whose
// crests touch env.arc. Below it only seven or eight FAT tile ridges fill the frame — no two alike: different widths,
// tiles that sit crooked, chipped ends, a broken tile, lime pointing (捉节灰 / 夹垄灰) that has half fallen away,
// crusts of lichen, cushions of moss and a few 瓦松 standing in the troughs.
// Recipe: build a real HEIGHT FIELD of the roof once in init(), light it with a raking moon from the upper left
// (lambert + marched soft shadows; the light gets lower down the slope, so the shadows open into black wedges),
// split-tone it (cold moonlit faces, a breath of warm bounce in the shadows), then give it a lens: sharp at the crest,
// falling out of focus toward the sides and the eaves. draw() only blits that one layer with a small rot.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 80;         // the camera only drifts ~16 px; a small margin keeps the per-pixel pass small
const MT = 36;          // head-room above the ridge in the cropped layer (for the lens blur and the halation)
const TOP = 2;          // dr of the tallest crowns (their bright rim then sits right on the arc)
const HT = 58;          // how far a full 筒瓦 stands above the pan tiles (height units = px)
const PAN = 0.3;        // depth of the 板瓦 trough as a fraction of HT
const FOOT = 0.2;       // the mortar packed along the foot of a tube (夹垄灰), as a fraction of HT
const AMP = 26;         // oblique view: a full tube height shifts this many px up-screen → the wave height at the ridge
const WB = 100;         // near the ridge the mortar packing rounds the cross-section into a soft wave
const W0 = 72, KR = 26; // the roof rolls away over the ridge: width and drop of that roll-off
const WOB = 3.2;        // how far a tile ridge snakes off its line (px)
const STEP = 6;         // the lower end of each 筒瓦 sits this proud of the head of the next one
const PHI = L.deg(38);  // direction the light TRAVELS on screen (0 = → , 90 = ↓): from the upper left
const EL_TOP = L.deg(52), EL_LOW = L.deg(19);   // moon elevation above the tile surface: high at the ridge, raking lower down
const BG = -300;        // height value that marks "sky"
let S = null;

const hash2 = (a, b) => {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const sm = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// broken 筒瓦: [tube (relative to the hero tube at the crest), tile number down the ridge, where the break starts (fraction of
// the tile), slant of the fracture, which part is gone (1 = lower, 0 = upper), seed]
const BREAKS = [[-1, 1, 0.38, 0.36, 1, 3.1], [2, 2, 0.55, -0.45, 0, 8.7], [-4, 1, 0.5, 0.2, 1, 5.5], [4, 1, 0.3, 0.4, 1, 1.9]];
// 瓦松 clumps: [tube (relative), side of that tube whose trough it roots in (−1 left, +1 right), how far across the trough
// (0 = at this tube's foot … 1 = at the next tube's foot), distance down the slope, scale, seed]
const WASONG = [[0, -1, 0.5, 318, 1.0, 'a'], [1, 1, 0.5, 396, 0.8, 'b'], [-3, 1, 0.5, 270, 0.9, 'c']];

function makeGeom(env) {
  const a = env.arc, R = a.R;
  const SMAX = 1480;                                        // arc-px half-range covered by the ridges
  const r = L.rng('s28ridges-b');
  const n = 15, mid = 7;
  const thw = new Float32Array(n), gap = new Float32Array(n), tc = new Float32Array(n), thk = new Float32Array(n);
  const tlean = new Float32Array(n), tph = new Float32Array(n), tlt = new Float32Array(n), tjo = new Float32Array(n);
  const tgL = new Float32Array(n), tgR = new Float32Array(n), tlp = new Float32Array(n), tpo = new Float32Array(n);
  for (let i = 0; i < n; i++) { thw[i] = r.range(66, 92); gap[i] = r.range(64, 106); }
  // the ridges at the crest are placed by hand: a big one just left of centre, slighter neighbours either side
  thw[mid] = 93; thw[mid - 1] = 74; thw[mid + 1] = 84; gap[mid - 1] = 92; gap[mid] = 70; gap[mid + 1] = 98; thw[mid + 2] = 70; thw[mid - 2] = 88; gap[mid - 2] = 72;
  tc[mid] = -66;
  for (let i = mid + 1; i < n; i++) tc[i] = tc[i - 1] + thw[i - 1] + gap[i - 1] + thw[i];
  for (let i = mid - 1; i >= 0; i--) tc[i] = tc[i + 1] - thw[i + 1] - gap[i] - thw[i];
  for (let i = 0; i < n; i++) {
    thk[i] = L.clamp(0.9 + ((thw[i] - 66) / 27) * 0.1 + r.range(-0.02, 0.02), 0.87, 1);   // wider tiles stand taller
    tlean[i] = r.range(-0.014, 0.014);
    tph[i] = r.range(0, 100);
    tlt[i] = r.range(198, 252);
    tjo[i] = tlt[i] - r.range(72, 188);                     // the first joint below the ridge falls somewhere else on every ridge
    tgL[i] = i > 0 ? gap[i - 1] : 90; tgR[i] = i < n - 1 ? gap[i] : 90;
    tlp[i] = r.range(58, 82); tpo[i] = r.range(0, tlp[i]);
  }
  thk[mid] = 1; thk[mid + 1] = 0.95; thk[mid - 1] = 0.9;
  /** cross-section of the intact roof at lateral offset d (px) from the axis of tube k: 1 on the crown of a full tile,
   *  FOOT where it beds into the mortar, negative down in the 板瓦 trough */
  const macro = (k, d) => {
    const hw = thw[k], ad = d < 0 ? -d : d;
    if (ad < hw) { const q = ad / hw, t = Math.sqrt(1 - q * q); return (t > FOOT ? t : FOOT) * thk[k]; }
    const dn = ad - hw, g = d > 0 ? tgR[k] : tgL[k]; let u = dn / g; if (u > 0.5) u = 0.5;
    const e = 1 - 2 * u;
    return -PAN * (1 - e * e) + FOOT * thk[k] * Math.exp(-dn / 8);
  };
  // per px along the arc: which tube is nearest (by its edge), the softened section the ridge shows against the sky,
  // and how far each crown sits below the line (they are not all exactly level)
  const NS = 2 * SMAX + 1;
  const nz = L.makeNoise('s28');
  const lut = new Uint8Array(NS), raw = new Float32Array(NS), edgeP = new Float32Array(NS), dcapT = new Float32Array(NS);
  for (let si = 0; si < NS; si++) {
    const s = si - SMAX; let best = 0, bd = 1e9;
    for (let k = 0; k < n; k++) { const dd = Math.abs(s - tc[k]) - thw[k]; if (dd < bd) { bd = dd; best = k; } }
    lut[si] = best; raw[si] = macro(best, s - tc[best]);
    dcapT[si] = (nz.n2(s / 300, 11.3) * 0.5 + 0.5) * 2.0;
  }
  const box = (src, dst, rad) => {
    let acc = 0; const wn = 2 * rad + 1;
    for (let i = -rad; i <= rad; i++) acc += src[L.clamp(i, 0, NS - 1)];
    for (let i = 0; i < NS; i++) { dst[i] = acc / wn; acc += src[Math.min(NS - 1, i + rad + 1)] - src[Math.max(0, i - rad)]; }
  };
  const tmp = new Float32Array(NS);
  box(raw, tmp, 13); box(tmp, edgeP, 9);
  // every ridge snakes a little off its line
  const NVW = 720, wobT = new Float32Array(n * NVW);
  for (let k = 0; k < n; k++) for (let v = 0; v < NVW; v++) wobT[k * NVW + v] = tlean[k] * v + WOB * nz.n2(k * 3.7 + 0.5, v * 0.0045 + tph[k]);
  /** the waved ridge silhouette: dr of the roof's upper edge at angle th */
  const edgeDr = (th) => {
    const sf = th * R + SMAX, si = L.clamp(Math.floor(sf), 0, NS - 2), t = L.clamp(sf - si);
    return TOP - AMP * (1 - (edgeP[si] * (1 - t) + edgeP[si + 1] * t)) - (dcapT[si] * (1 - t) + dcapT[si + 1] * t);
  };
  const thMax = (SMAX - 30) / R;
  const edgePath = (g) => {
    const step = 1.5 / R;
    g.beginPath();
    let first = true;
    for (let th = -thMax; th <= thMax; th += step) {
      const p = a.pt(th, edgeDr(th));
      if (first) { g.moveTo(p.x, p.y); first = false; } else g.lineTo(p.x, p.y);
    }
    g.lineTo(W + PAD + 300, H + PAD + 300); g.lineTo(-PAD - 300, H + PAD + 300); g.closePath();
  };
  return { a, R, n, mid, SMAX, NS, NVW, thw, tc, thk, tlt, tjo, tgL, tgR, tlp, tpo, lut, edgeP, dcapT, wobT, macro, nz, edgePath };
}

/** 瓦松 (Orostachys): a rosette of fleshy leaves under scaly, tapering spires — little pagodas. Painted bract by bract:
 *  the foot stands in the trough's shadow, the upper part rises into the moonlight and is lit from the left. */
function paintWasong(g, bx, by, up, sc, seed) {
  const r = L.rng('s28ws' + seed);
  const LIT = [214, 223, 232], MID = [84, 98, 114], DRK = [13, 17, 23], SHD = [26, 18, 12];
  const leaf = (x, y, ang, len, wid, col) => {
    const c = Math.cos(ang), s = Math.sin(ang), mx = x + c * len * 0.42, my = y + s * len * 0.42;
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(mx - s * wid, my + c * wid, x + c * len, y + s * len);
    g.quadraticCurveTo(mx + s * wid, my - c * wid, x, y);
    g.fillStyle = col; g.fill();
  };
  const tone = (lf, lit) => {                    // lf: −1 = the side facing the moon … +1 = the far side; lit: 0 in shadow … 1 in the light
    const t = L.clamp((lf + 1) * 0.5), a0 = t < 0.4 ? LIT : MID, a1 = t < 0.4 ? MID : DRK, k = t < 0.4 ? t / 0.4 : (t - 0.4) / 0.6;
    const j = 0.86 + 0.28 * r();
    const c = [0, 1, 2].map((i) => L.lerp(SHD[i] * (1.5 - t), (a0[i] + (a1[i] - a0[i]) * k) * j, lit));
    return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  };
  const cnt = r.int(3, 4), order = [];
  for (let q = 0; q < cnt; q++) order.push(q);
  // rosette leaves splayed around the foot (they stay in the dark, only just readable)
  for (let e = 0; e < 13; e++) {
    const la = up + L.lerp(-1.9, 1.9, e / 12) + r.range(-0.12, 0.12);
    leaf(bx + r.range(-16, 16) * sc, by + r.range(-3, 5) * sc, la, r.range(20, 34) * sc, r.range(4, 6) * sc, tone(Math.sin(la - up), 0.1 + 0.25 * r()));
  }
  for (const q of order) {
    const off = (q - (cnt - 1) / 2) * r.range(15, 21) * sc;
    const ang0 = up + (q - (cnt - 1) / 2) * 0.17 + r.range(-0.1, 0.1), bend = r.range(-0.22, 0.22);
    const len = r.range(64, 96) * sc * (q === 1 ? 1.55 : 1), wid = r.range(8.5, 11.5) * sc * (q === 1 ? 1.15 : 1);
    const ox = bx + Math.cos(up + Math.PI / 2) * off, oy = by + Math.sin(up + Math.PI / 2) * off + r.range(-4, 6) * sc;
    const tiers = Math.round(len / (4.6 * sc)), u0 = r.range(0.24, 0.4);
    let px = ox, py = oy;
    for (let i = 0; i <= tiers; i++) {
      const u = i / tiers, ang = ang0 + bend * u;
      px += Math.cos(ang) * (len / tiers); py += Math.sin(ang) * (len / tiers);
      const hw = wid * (1 - 0.88 * u) * (u < 0.1 ? 0.55 + 4.5 * u : 1);
      const lit = sm((u - u0) / 0.2);
      const na = Math.max(1, Math.round(hw / (3.1 * sc)));
      for (let m = na; m >= -na; m--) {             // far side first, the moonlit bracts last
        const lf = na ? m / na : 0, nx = Math.cos(ang + Math.PI / 2), ny = Math.sin(ang + Math.PI / 2);
        const sx = px + nx * lf * hw + r.range(-0.8, 0.8), sy = py + ny * lf * hw + r.range(-0.8, 0.8);
        leaf(sx, sy, ang + lf * 0.95 + r.range(-0.15, 0.15), (10.5 - 4.5 * u) * sc * r.range(0.85, 1.2), 2.9 * sc, tone(lf * 0.9 - 0.1, lit));
      }
    }
  }
}

function buildRoof(env) {
  const G = makeGeom(env);
  const { a, R, n, mid, SMAX, NS, NVW, thw, tc, thk, tlt, tjo, tlp, tpo, lut, edgeP, dcapT, wobT, macro, nz } = G;
  const x0 = -PAD, y0 = Math.floor(a.crestY - 8), x1 = W + PAD, y1 = H + PAD;
  const cw = x1 - x0, ch = y1 - y0, NPX = cw * ch;
  const Hm = new Float32Array(NPX), Al = new Float32Array(NPX), Ao = new Float32Array(NPX);
  const mossH = new Float32Array(NPX), mossA = new Float32Array(NPX), pitH = new Float32Array(NPX);

  // ── stamps (all in map px): moss cushions, pits, chips, a few cracks ──
  /** a spot on the roof → map px. k = tube, lat = px off its axis, w = distance down the slope */
  const toMap = (k, lat, w) => {
    const v = w + AMP * (1 - macro(k, lat));
    const q = a.pt((tc[k] + wobT[k * NVW + Math.min(NVW - 1, Math.max(0, v | 0))] + lat) / R, TOP - v);
    return [q.x - x0, q.y - y0];
  };
  const stamp = (arr, arrA, mx, my, rad, hgt) => {
    const i0 = Math.max(0, Math.floor(mx - rad)), i1 = Math.min(cw - 1, Math.ceil(mx + rad));
    const j0 = Math.max(0, Math.floor(my - rad)), j1 = Math.min(ch - 1, Math.ceil(my + rad));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const d2 = ((i - mx) * (i - mx) + (j - my) * (j - my)) / (rad * rad);
      if (d2 >= 1) continue;
      const kk = 1 - d2, idx = j * cw + i;
      if (hgt > 0) { const hh = hgt * Math.sqrt(kk); if (hh > arr[idx]) arr[idx] = hh; const aa = L.clamp(kk * 2.4); if (arrA && aa > arrA[idx]) arrA[idx] = aa; }
      else arr[idx] += hgt * kk;
    }
  };
  const rm = L.rng('s28moss-b');
  const kMin = 1, kMax = n - 2;
  const cushion = (k, lat, w, big) => {
    const [cx, cy] = toMap(k, lat, w);
    const cnt = big ? rm.int(5, 9) : rm.int(2, 4);
    for (let q = 0; q < cnt; q++) {
      const rad = big ? rm.range(6, 13) : rm.range(3.5, 7);
      stamp(mossH, mossA, cx + rm.range(-1, 1) * (big ? 13 : 6), cy + rm.range(-1, 1) * (big ? 26 : 9), rad, rad * rm.range(0.5, 0.8));
    }
  };
  // moss gathers where water lingers: along the moonlit foot of the tubes and in the joints
  for (let m = 0; m < 46; m++) {
    const k = rm.int(kMin, kMax);
    cushion(k, -(thw[k] + rm.range(-8, 10)), 50 + 560 * Math.pow(rm(), 1.1), rm.chance(0.45));
  }
  for (let m = 0; m < 26; m++) {
    const k = rm.int(kMin, kMax);
    cushion(k, -thw[k] * rm.range(0.5, 0.95), rm.int(1, 3) * tlt[k] - tjo[k] + rm.range(-3, 8), false);
  }
  // pits, chips knocked out of tile ends, and a few cracks that run across a tile
  const rp = L.rng('s28pits-b');
  for (let m = 0; m < 900; m++) stamp(pitH, null, rp() * cw, rp() * ch, rp.range(1.6, 3.8) * (rp.chance(0.08) ? 2.4 : 1), -rp.range(0.8, 2.4));
  for (let m = 0; m < 40; m++) {
    const k = rp.int(kMin, kMax), lat = rp.range(-0.9, 0.9) * thw[k];
    const [mx, my] = toMap(k, lat, rp.int(1, 3) * tlt[k] - tjo[k] + rp.range(-2, 9));
    for (let q = 0; q < 4; q++) stamp(pitH, null, mx + rp.range(-10, 10), my + rp.range(-3, 6), rp.range(4, 11), -rp.range(3, 6.5));
  }
  for (let m = 0; m < 4; m++) {
    const k = mid + [-2, 1, 3, -5][m]; let lat = -thw[k] * rp.range(0.5, 0.9), w = [150, 330, 120, 200][m] + rp.range(-20, 20);
    const dl = (thw[k] * rp.range(1.0, 1.5)) / 30; let dw = rp.range(-1.4, 1.4);
    for (let q = 0; q < 30; q++) {
      const [mx, my] = toMap(k, L.clamp(lat, -thw[k], thw[k]), w);
      stamp(pitH, null, mx, my, rp.range(1.5, 2.4), -rp.range(2.6, 4.2));
      lat += dl; w += dw + rp.range(-1.6, 1.6); if (rp.chance(0.2)) dw = rp.range(-2.4, 2.4);
    }
  }
  const brk = new Uint8Array(n * 16);
  BREAKS.forEach((b, i) => { brk[(mid + b[0]) * 16 + b[1]] = i + 1; });

  // ── height field + albedo ──
  // the slow noises are sampled on coarse grids and interpolated: broad blotches / roughness / lichen (1/6), lumps (1/2)
  const GS = 6, gw2 = Math.ceil(cw / GS) + 2, gh2 = Math.ceil(ch / GS) + 2;
  const gA = new Float32Array(gw2 * gh2), gR = new Float32Array(gw2 * gh2), gL = new Float32Array(gw2 * gh2), gD = new Float32Array(gw2 * gh2);
  for (let j = 0; j < gh2; j++) for (let i = 0; i < gw2; i++) {
    const X = x0 + i * GS, Y = y0 + j * GS, o = j * gw2 + i;
    gA[o] = nz.fbm(X * 0.0085, Y * 0.0085, 3);
    gR[o] = nz.fbm(X * 0.017 + 70, Y * 0.017 - 30, 2);
    gL[o] = nz.fbm(X * 0.0105 - 40, Y * 0.0105 + 90, 4, 2.1, 0.55);        // pale crustose lichen / old limewash
    gD[o] = nz.fbm(X * 0.019 + 140, Y * 0.019 + 10, 3);                    // dark lichen, soot
  }
  const bw2 = (cw >> 1) + 2, bh2 = (ch >> 1) + 2, gB = new Float32Array(bw2 * bh2);
  for (let j = 0; j < bh2; j++) for (let i = 0; i < bw2; i++) gB[j * bw2 + i] = nz.fbm((x0 + i * 2) * 0.062 + 13, (y0 + j * 2) * 0.062, 2);
  let HMAX = 0;
  for (let j = 0; j < ch; j++) {
    const Y = y0 + j + 0.5, dy = a.cy - Y;
    const gy = (j + 0.5) / GS, gj = gy | 0, ty = gy - gj;
    const by = (j + 0.5) * 0.5, bj = by | 0, tby = by - bj;
    for (let i = 0; i < cw; i++) {
      const idx = j * cw + i, X = x0 + i + 0.5, dx = X - a.cx;
      const rr = Math.sqrt(dx * dx + dy * dy);
      const v = R + TOP - rr;                         // px below the crown line
      if (v < -2) { Hm[idx] = BG; continue; }
      const s = Math.atan2(dx, dy) * R;
      let si = (s + SMAX) | 0; if (si < 0) si = 0; else if (si >= NS) si = NS - 1;
      const k = lut[si], hwk = thw[k], lt = tlt[k];
      const vi = v < 0 ? 0 : v >= NVW ? NVW - 1 : v | 0;
      let d = s - tc[k] - wobT[k * NVW + vi];
      const dc = dcapT[si];
      let p = macro(k, d);
      let w = v - AMP * (1 - p) - dc;                 // distance down the slope from the ridge (oblique projection)
      const isTube = (d < 0 ? -d : d) < hwk;
      let jt = 0, r1 = 0.5, r2 = 0.5, r3 = 0.5, r4 = 0.5;
      if (isTube) {
        jt = Math.floor(((w > 0 ? w : 0) + tjo[k]) / lt);
        r1 = hash2(k * 31 + 7, jt); r2 = hash2(k * 17 + 3, jt + 91); r3 = hash2(k + 500, jt * 13 + 5); r4 = hash2(k * 5 + 11, jt * 7 + 29);
        if (jt > 0) {
          // each tile sits a little off the line, a little askew, a hair wider or prouder than its neighbours
          const tv0 = w + tjo[k] - jt * lt;
          d += (r1 - 0.5) * 13 + (r4 - 0.5) * 0.09 * (tv0 - lt * 0.5);
          const q = (d < 0 ? -d : d) / (hwk * (0.95 + 0.1 * r3));
          const t = q < 1 ? Math.sqrt(1 - q * q) : 0;
          p = (t > FOOT ? t : FOOT) * thk[k] * (0.94 + 0.1 * r2);
          w = v - AMP * (1 - p) - dc;
        }
      }
      if (w < WB) {                                   // toward the ridge the section melts into the soft wave of the silhouette
        const bl = sm(w / WB), pe = edgeP[si];
        p = pe + (p - pe) * bl; w = v - AMP * (1 - p) - dc;
      }
      if (w < -14) { Hm[idx] = BG; continue; }
      const wq = w > 0 ? w : 0;
      const gx = (i + 0.5) / GS, gi = gx | 0, tx = gx - gi, g0 = gj * gw2 + gi;
      const nA = (gA[g0] * (1 - tx) + gA[g0 + 1] * tx) * (1 - ty) + (gA[g0 + gw2] * (1 - tx) + gA[g0 + gw2 + 1] * tx) * ty;
      const nR = (gR[g0] * (1 - tx) + gR[g0 + 1] * tx) * (1 - ty) + (gR[g0 + gw2] * (1 - tx) + gR[g0 + gw2 + 1] * tx) * ty;
      const nL = (gL[g0] * (1 - tx) + gL[g0 + 1] * tx) * (1 - ty) + (gL[g0 + gw2] * (1 - tx) + gL[g0 + gw2 + 1] * tx) * ty;
      const nD = (gD[g0] * (1 - tx) + gD[g0 + 1] * tx) * (1 - ty) + (gD[g0 + gw2] * (1 - tx) + gD[g0 + gw2 + 1] * tx) * ty;
      const bx = (i + 0.5) * 0.5, bi = bx | 0, tbx = bx - bi, b0 = bj * bw2 + bi;
      const nB = (gB[b0] * (1 - tbx) + gB[b0 + 1] * tbx) * (1 - tby) + (gB[b0 + bw2] * (1 - tbx) + gB[b0 + bw2 + 1] * tbx) * tby;   // lumps 15—25 px
      const nC = nz.n2(X * 0.27 + 40, Y * 0.27);                        // grit
      let h, al;
      if (isTube) {
        let tv = wq + tjo[k] - jt * lt; if (tv < 0) tv = 0; else if (tv > lt) tv = lt;
        let tfd = -1;                                                   // > 0: this far past the fracture of a broken tile
        const bi2 = jt < 16 ? brk[k * 16 + jt] : 0;
        if (bi2) {
          const B = BREAKS[bi2 - 1];
          const tf = B[2] * lt + B[3] * d + 17 * nz.n2(d * 0.045 + B[5], 3.3) + 6 * nz.n2(d * 0.19, B[5] + 9);
          tfd = B[4] ? tv - tf : tf - tv;
        }
        if (tfd > 8) {
          // a broken tile: what is left is its bed — a ridge of old mortar and mud with lime lumps in it
          const q = d / (hwk * 0.5), lump = nz.n2(X * 0.035 + 5, Y * 0.035 + 50);
          p = 0.08 + 0.2 * Math.exp(-q * q) + 0.07 * lump;
          h = HT * p + nB * 2.6;
          al = 0.3 + 0.6 * sm(lump * 2.4 + 0.15 + nB * 0.6);
        } else {
          const dj = jt === 0 ? lt - tv : Math.min(tv, lt - tv);          // distance to the nearest joint
          h = HT * p + STEP * (tv / lt - 0.5) + (r3 - 0.5) * 2.6;
          al = 0.5 + 0.24 * r2 - (r1 > 0.8 ? 0.16 : 0) + (r4 > 0.86 ? 0.16 : 0);
          al *= 0.92 + 0.16 * nz.n2(s * 0.05, wq * 0.006 + 9);            // rain has streaked the tile down the slope
          if (dj < 46) {
            const jid = tv < lt * 0.5 && jt > 0 ? jt : jt + 1;
            const hl = hash2(k * 7 + 1, jid * 3 + 2);
            // 捉节灰: the lime that points each joint — a lumpy white band, part of it long gone
            const bw = 10 + 15 * hl + 5 * nz.n2(d * 0.07 + jid * 7.3, k * 1.7 + 0.3) + nB * 4;
            const pres = nz.n2(d * 0.028 + jid * 3.1, k * 5.3) + (hl < 0.2 ? -0.6 : 0.45);
            const lw = sm((bw - dj) / 3.5) * sm(pres / 0.12);
            const gapv = Math.exp(-(dj * dj) / 10) * (1 - lw);
            h += lw * (2.2 + nB * 1.5) - 5 * gapv;
            al = (al + (0.98 - al) * lw) * (1 - 0.55 * gapv);
          }
          // lime has leached out of the joint above and run down the tile
          if (jt > 0 && tv < 150 && hash2(k * 7 + 1, jt * 3 + 2) >= 0.2) al += 0.24 * Math.exp(-tv / 60) * sm(nz.n2(d * 0.085 + jt * 5.1, k * 2.2) * 1.5 + 0.2);
          // 夹垄灰 smeared up the foot of the tile
          const q = (d < 0 ? -d : d) / hwk;
          if (q > 0.74) {
            const fl = sm((q - 0.86 - 0.07 * nB) / 0.05) * sm((nz.n2(k * 9.1 + (d > 0 ? 4 : 0), wq * 0.011) + 0.3) / 0.15);
            al += (0.94 - al) * fl; h += 1.4 * fl;
          }
          if (tfd > 0) { h -= 2 + tfd * 1.6; al = 0.8; }                  // the fresh, pale thickness of the broken tile
        }
      } else {
        // 板瓦: concave tiles lapped like scales, each lower edge standing proud of the tile below
        const kt = d > 0 ? k : (k > 0 ? k - 1 : 0), lp = tlp[kt];
        const wp = wq + tpo[kt] + 8 * nz.n2(s * 0.012 + kt * 7.7, wq * 0.004);
        const jp = Math.floor(wp / lp), pv = wp - jp * lp;
        const q1 = hash2(kt * 13 + 1, jp * 7 + 2);
        h = HT * p + 7.5 * (pv / lp) + (q1 - 0.5) * 2.8;
        al = 0.46 + 0.22 * q1;
        const dn = (d < 0 ? -d : d) - hwk;
        if (dn < 18) {                                 // 夹垄灰 along the foot of the tube — or the dark gap where it has dropped out
          const fw = 11 + 6 * nz.n2(wq * 0.02 + k * 3.1, d > 0 ? 6.5 : 5.5);
          if (dn < fw) {
            const t = 1 - dn / fw;
            if (nz.n2(k * 9.1 + (d > 0 ? 4 : 0), wq * 0.011) > -0.3) { h += 3.6 * t; al += (0.93 - al) * sm(t * 2); } else { h -= 1.6 * t; al *= 1 - 0.4 * t; }
          }
        }
      }
      // weathering: broad blotches, lumps, grit, pale lichen crust, dark lichen, moss
      const ro = sm(0.5 + 1.6 * nR);                                      // where the surface has gone rough
      h += nA * 1.6 + nB * (0.5 + 1.0 * ro) + nC * (0.2 + 0.3 * ro) + pitH[idx];
      al *= 0.92 + 0.2 * nA;
      const e1 = sm((nL - 0.2 + nB * 0.08) / 0.12);
      if (e1 > 0) { al += (0.95 - al) * 0.8 * e1; h += e1 * (0.9 + nB * 1.1 + nC * 0.5); }
      const e2 = sm((nD - 0.32 + nB * 0.1) / 0.1);
      if (e2 > 0) al *= 1 - 0.38 * e2;
      const mh = mossH[idx];
      if (mh > 0) { h += mh * (0.85 + 0.3 * nC); al *= 1 - 0.72 * mossA[idx]; }
      if (w < W0) {                                                       // the ridge rolls over, away from us, into the full moon
        const t = 1 - wq / W0; h -= KR * t * t;
        al = (al + (0.86 - al) * 0.5 * t) * (1 + 0.5 * t * t);
      }
      Hm[idx] = h; Al[idx] = al; Ao[idx] = 0.3 + 0.7 * L.clamp((p + PAN) / (1 + PAN));
      if (h > HMAX) HMAX = h;
    }
  }

  // ── the moon: elevation by distance down the slope ──
  const NV = 800, elS = new Float32Array(NV), elC = new Float32Array(NV), elT = new Float32Array(NV);
  for (let i = 0; i < NV; i++) {
    const t = L.clamp(i / 520), el = EL_TOP + (EL_LOW - EL_TOP) * (1 - (1 - t) * (1 - t));
    elS[i] = Math.sin(el); elC[i] = Math.cos(el); elT[i] = Math.tan(el);
  }
  const lx = Math.cos(PHI), ly = Math.sin(PHI);
  // ── cast shadows, marched at half resolution toward the moon; the penumbra widens with distance from the caster ──
  const cw2 = cw >> 1, ch2 = ch >> 1;
  const Hh = new Float32Array(cw2 * ch2), Sh = new Float32Array(cw2 * ch2);
  for (let j = 0; j < ch2; j++) for (let i = 0; i < cw2; i++) {
    const o = (j * 2) * cw + i * 2, h00 = Hm[o], h10 = Hm[o + 1], h01 = Hm[o + cw], h11 = Hm[o + cw + 1];
    Hh[j * cw2 + i] = (h00 < -100 || h10 < -100 || h01 < -100 || h11 < -100) ? BG : (h00 + h10 + h01 + h11) * 0.25;
  }
  for (let j = 0; j < ch2; j++) {
    const Y = y0 + j * 2 + 1, dy = a.cy - Y;
    for (let i = 0; i < cw2; i++) {
      const o = j * cw2 + i, h0 = Hh[o];
      if (h0 < -100) { Sh[o] = 1; continue; }
      const dx = x0 + i * 2 + 1 - a.cx;
      let vi = (R + TOP - Math.sqrt(dx * dx + dy * dy)) | 0; if (vi < 0) vi = 0; else if (vi >= NV) vi = NV - 1;
      const tE = elT[vi];
      let sh = 1;
      for (let t = 1; t < 170; t++) {
        const fx = i - lx * t, fy = j - ly * t;
        if (fx < 0 || fy < 0) break;
        const dist = 2 * t, ray = h0 + dist * tE;
        if (ray > HMAX) break;
        const c = ((ray - Hh[((fy + 0.5) | 0) * cw2 + ((fx + 0.5) | 0)]) / dist) * 6;
        if (c < sh) { sh = c; if (sh <= 0) { sh = 0; break; } }
      }
      Sh[o] = sh;
    }
  }

  // ── lighting + split-tone: cold where the moon falls, a little warm bounce where it does not ──
  const SUN = 1.75, FILL = 0.3;
  const Ux = 0.5, Uy = 0.42, Uz = 0.757;                         // dim warm fill from the lower right (what the courtyard gives back)
  const WR = 176, WG = 118, WB2 = 74;                            // its colour
  const ramp = L.makeRamp([[0, '#040506'], [0.15, '#0b1119'], [0.34, '#2f4054'], [0.56, '#7b8a9c'], [0.78, '#c9d3de'], [0.92, '#e8ecf0'], [1, '#f6f8fa']]);
  const cool = new Float32Array(1024 * 3);
  for (let i = 0; i < 1024; i++) { const c = ramp(i / 1023); cool[i * 3] = c[0]; cool[i * 3 + 1] = c[1]; cool[i * 3 + 2] = c[2]; }
  const img = new ImageData(cw, ch); const dd = img.data;
  for (let j = 0; j < ch; j++) {
    const Y = y0 + j + 0.5, dy = a.cy - Y;
    const sj = Math.min(ch2 - 1.001, Math.max(0, (j - 0.5) * 0.5)), sj0 = sj | 0, sty = sj - sj0;
    const fy = L.lerp(1, 0.8, sm((Y - a.crestY - 170) / 560));       // it dims a little toward the eaves
    for (let i = 0; i < cw; i++) {
      const idx = j * cw + i, o = idx * 4;
      const h0 = Hm[idx];
      dd[o + 3] = 255;
      if (h0 < -100 || i < 1 || j < 1 || i >= cw - 1 || j >= ch - 1) { dd[o] = 4; dd[o + 1] = 5; dd[o + 2] = 6; continue; }
      let hl = Hm[idx - 1], hr = Hm[idx + 1], hu = Hm[idx - cw], hd = Hm[idx + cw];
      if (hl < -100) hl = h0; if (hr < -100) hr = h0; if (hu < -100) hu = h0 - 1; if (hd < -100) hd = h0;
      const hx = (hr - hl) * 0.5, hy = (hd - hu) * 0.5;
      const nl = 1 / Math.sqrt(hx * hx + hy * hy + 1);
      const X = x0 + i + 0.5, dx = X - a.cx;
      let vi = (R + TOP - Math.sqrt(dx * dx + dy * dy)) | 0; if (vi < 0) vi = 0; else if (vi >= NV) vi = NV - 1;
      const cE = elC[vi], sE = elS[vi];
      let dif = (hx * lx * cE + hy * ly * cE + sE) * nl; if (dif < 0) dif = 0;
      const si2 = Math.min(cw2 - 1.001, Math.max(0, (i - 0.5) * 0.5)), si0 = si2 | 0, stx = si2 - si0, so = sj0 * cw2 + si0;
      const sh = (Sh[so] * (1 - stx) + Sh[so + 1] * stx) * (1 - sty) + (Sh[so + cw2] * (1 - stx) + Sh[so + cw2 + 1] * stx) * sty;
      let fil = (-hx * Ux - hy * Uy + Uz) * nl; if (fil < 0) fil = 0;
      const al = Al[idx];
      const fx = L.lerp(1.1, 0.8, sm((X + 100) / (W + 200)));          // the moon is at the upper left: the far right sinks into the night
      // a glint where the tile faces half-way between the moon and the lens
      const Hx = -lx * cE, Hy = -ly * cE, Hz = sE + 1, hm = 1 / Math.sqrt(Hx * Hx + Hy * Hy + Hz * Hz);
      const ndh = (-hx * Hx - hy * Hy + Hz) * hm * nl;
      const spec = ndh > 0 ? Math.pow(ndh, 16) * 0.2 * sh : 0;
      let c = al * SUN * dif * sh * fx * fy + spec;
      c = 1.04 * (1 - Math.exp(-1.6 * c)); if (c > 1) c = 1;          // soft shoulder: lit faces reach white without clipping flat
      c = c + (c * c * (3 - 2 * c) - c) * 0.6;                        // …then a print-like S-curve: crisp blacks, clean whites
      const li = ((c * 1023) | 0) * 3;
      const wf = (1 - c) * (1 - c) * FILL * al * Ao[idx] * (0.12 + 0.88 * fil * fil) * fy;   // the warm bounce only shows where the moon does not reach
      dd[o] = cool[li] + WR * wf; dd[o + 1] = cool[li + 1] + WG * wf; dd[o + 2] = cool[li + 2] + WB2 * wf;
    }
  }
  const small = L.makeCanvas(cw, ch);
  small.getContext('2d').putImageData(img, 0, 0);

  // ── the print (cropped to the roof): crisp waved silhouette, then the 瓦松 ──
  const chC = ch + MT;
  const sharp = L.makeCanvas(cw, chC);
  {
    const g = sharp.getContext('2d');
    g.translate(-x0, -y0 + MT);
    g.save(); G.edgePath(g); g.clip();
    g.drawImage(small, x0, y0);
    for (const [rk, side, across, w0, sc, seed] of WASONG) {
      const k = mid + rk, gp = side > 0 ? G.tgR[k] : G.tgL[k];
      const [mx, my] = toMap(k, side * (thw[k] + across * gp), w0);
      const bx = mx + x0, by = my + y0;
      paintWasong(g, bx, by, -Math.PI / 2 + Math.atan2(bx - a.cx, a.cy - by), sc, seed);
    }
    g.restore();
  }

  // ── the lens: in focus at the crest, softer toward the sides and the eaves (weights sum to 1, added with 'lighter') ──
  const b1 = L.blurred(sharp, 2.6), b2 = L.blurred(sharp, 7.5);
  const fxp = a.cx - 40 - x0, fyp = a.crestY + 70 - y0 + MT, RX = 1180, RY = 560;
  const win = (c, r0, r1, mode) => {                      // multiply the canvas alpha by a soft elliptical window (or its inverse)
    const g = c.getContext('2d');
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = mode;
    g.translate(fxp, fyp); g.scale(1, RY / RX);
    g.fillStyle = L.radial(g, 0, 0, r0 * RX, r1 * RX, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
    g.fillRect(-5000, -5000, 10000, 10000);
    g.restore();
  };
  win(sharp, 0.4, 0.74, 'destination-in');
  win(b1, 0.74, 1.2, 'destination-in'); win(b1, 0.4, 0.74, 'destination-out');
  win(b2, 0.74, 1.2, 'destination-out');
  const roof = L.makeCanvas(cw, chC);
  const rg = roof.getContext('2d');
  rg.globalCompositeOperation = 'lighter';
  rg.drawImage(b2, 0, 0); rg.drawImage(b1, 0, 0); rg.drawImage(sharp, 0, 0);
  rg.globalCompositeOperation = 'source-over';
  // silver grain over everything, in and out of focus alike — it belongs to the film, not to the roof
  const grain = L.grainTex(cw, chC, { seed: 's28g', amount: 0.5 });
  const gg = grain.getContext('2d');
  gg.globalAlpha = 0.42; gg.drawImage(L.grainTex(cw, chC, { seed: 's28g2', amount: 0.6, size: 3 }), 0, 0); gg.globalAlpha = 1;
  L.overlayOn(roof, grain, { blend: 'overlay', alpha: 0.5 });
  // halation: the moonlit tile blooms a little into the dark around it
  rg.globalCompositeOperation = 'screen'; rg.globalAlpha = 0.11;
  rg.drawImage(L.blurred(roof, 7), 0, 0);
  rg.globalCompositeOperation = 'source-over'; rg.globalAlpha = 1;
  return { roof, x: x0, y: y0 - MT };
}

export default {
  name: '月下瓦垄',
  tone: 'light',
  init(env) {
    S = buildRoof(env);
  },
  draw(ctx, env, p) {
    ctx.fillStyle = '#040506'; ctx.fillRect(0, 0, W, H);
    const a = env.arc;
    const rot = L.lerp(-0.007, 0.007, p), zoom = L.lerp(1.0, 1.01, p);
    L.cam(ctx, env, { rot, zoom }, () => ctx.drawImage(S.roof, S.x, S.y));
    // a breath of brighter moonlight drifting along the ridge: colour-dodge lifts the lit tile and leaves the blacks black
    const q = a.pt(L.lerp(-0.2, -0.06, p), -40);
    ctx.save(); a.clipBelow(ctx, TOP + 2); ctx.globalCompositeOperation = 'color-dodge';
    ctx.fillStyle = L.radial(ctx, q.x, q.y, 0, 640, [[0, '#3c4047'], [0.45, '#17191c'], [1, '#000000']]);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  },
};
