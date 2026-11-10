// s30 — 琉璃海水纹. A glazed-tile (琉璃) relief of sea waves, seen close and lit from the upper left.
// Above the arc: a flat field of imperial-yellow glaze — fine crazing (开片), a few flakes down to the pale clay body, scratches.
// The arc itself: the white foam bead on the crest of the top row of waves.
// Below it, top → bottom (the traditional order): curling spray volutes (浪花) → rows of concentric half-round
// billows (平水, growing with depth) → slanted parallel ribs (立水) at the very bottom.
// The relief is a tiny height-field renderer: init() evaluates colour + height per pixel in the arc's polar frame,
// then lights it (diffuse + glaze specular + contact shadows). draw() only blits and cross-fades two lightings.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 64;                        // the move is only a few px of rot + a breath of zoom
const LW = W + PAD * 2, LH = H + PAD * 2;
const RIM = 15;                        // width of the foam bead that rides the arc (its outer edge IS the arc)
// rows of billows, nearest the arc first: [radius, depth of the apex below the arc]. The last row is the 立水:
// big arches whose foam lip trims a field of slanted ribs.
const ROWS = [[120, 9], [142, 100], [168, 177], [198, 264], [256, 358]];
const LI_ROW = 4, LI_LIP = 27;         // the 立水 row and the width (px) of its foam lip
const VR = 64;                         // spray volute radius
let S = null;

// ───────────── glaze colours (albedo, 0..1) ─────────────
const rgb = (c) => { const p = L.parseColor(c); return [p[0] / 255, p[1] / 255, p[2] / 255]; };
const WH_HI = rgb('#f1ede0'), WH_LO = [0.66, 0.76, 0.77];
const BL_HI = rgb('#2f7bcc'), BL_LO = rgb('#164684');
const GR_HI = rgb('#27a87c'), GR_LO = rgb('#126a4e');
const DB_HI = rgb('#1c4c84'), DB_LO = rgb('#0f2a44');
const DG_HI = rgb('#176f5a'), DG_LO = rgb('#0c3936');
const GRV = [0.04, 0.115, 0.2];        // glaze pooled dark in the grooves
const BODY = rgb('#d8cbae');           // the fired clay body where glaze has worn off
// bands of one billow from its free edge inwards: [lo, hi] colour, per colour scheme
const EDGES = [1, 0.86, 0.665, 0.47, 0.285, 0];
const NB = EDGES.length - 2;           // index of the innermost band (the domed heart)
const PAL = [
  [[WH_LO, WH_HI], [BL_LO, BL_HI], [GR_LO, GR_HI], [BL_LO, BL_HI], [DB_LO, DB_HI]],
  [[WH_LO, WH_HI], [GR_LO, GR_HI], [BL_LO, BL_HI], [GR_LO, GR_HI], [DG_LO, DG_HI]],
];

// sample outputs (module-level to keep the per-pixel loop allocation-free)
let oR = 0, oG = 0, oB = 0, oH = 0, oGl = 0, oTop = 0;

/** one 平水 billow: concentric rounded ridges. t = 0 at its centre … 1 at its free edge */
function sampleScale(t, r, v, tone) {
  let i = 0;
  while (i < NB && t < EDGES[i + 1]) i++;
  const e0 = EDGES[i], e1 = EDGES[i + 1], bw = (e0 - e1) * r;
  let u = (e0 - t) / (e0 - e1); if (u < 0) u = 0; else if (u > 1) u = 1;
  let s, edgePx;
  if (i === NB) { s = Math.sqrt(1 - (1 - u) * (1 - u)); edgePx = u * bw; }          // domed heart
  else { s = Math.sin(Math.PI * u); edgePx = (u < 0.5 ? u : 1 - u) * bw; if (i === 0 && u < 0.5) edgePx = 99; }
  let g = edgePx / 2.3; if (g > 1) g = 1; g = g * g * (3 - 2 * g);
  const lo = PAL[v][i][0], hi = PAL[v][i][1], k = s * (0.55 + 0.45 * s), m = 1 + tone;
  oR = GRV[0] + ((lo[0] + (hi[0] - lo[0]) * k) * m - GRV[0]) * g;
  oG = GRV[1] + ((lo[1] + (hi[1] - lo[1]) * k) * m - GRV[1]) * g;
  oB = GRV[2] + ((lo[2] + (hi[2] - lo[2]) * k) * m - GRV[2]) * g;
  const amp = (bw * 0.3 > 9 ? 9 : bw * 0.3) * (i === 0 ? 1.2 : i === NB ? 0.6 : 1);
  oH = amp * s * (1.3 - 0.3 * s) + 4.5 * t;       // each billow lifts toward its free edge, like an overlapping scale
  oGl = 0.35 + 0.65 * g; oTop = i === NB ? 0 : s;
}

const VW = 0.5, VDUTY = 0.58, VEYE = 0.16;
/** a spray volute: a white foam arm winding clockwise into an eye, with a blue channel beside it */
function sampleVolute(t, phi, r, phs, tone) {
  const eyePx = (t - VEYE) * r;
  const m = 1 + tone;
  if (eyePx < 0) {
    const u = t / VEYE, s = Math.sqrt(1 - u * u);
    let g = -eyePx / 2.2; if (g > 1) g = 1; g = g * g * (3 - 2 * g);
    oR = GRV[0] + ((WH_LO[0] + (WH_HI[0] - WH_LO[0]) * s) * m - GRV[0]) * g;
    oG = GRV[1] + ((WH_LO[1] + (WH_HI[1] - WH_LO[1]) * s) * m - GRV[1]) * g;
    oB = GRV[2] + ((WH_LO[2] + (WH_HI[2] - WH_LO[2]) * s) * m - GRV[2]) * g;
    oH = 2 + VEYE * r * 0.75 * s; oGl = 0.35 + 0.65 * g; oTop = s;
    return;
  }
  let b = (1 - t) / VW - (phi - phs) / L.TAU; b -= Math.floor(b);
  const white = b < VDUTY;
  const u = white ? b / VDUTY : (b - VDUTY) / (1 - VDUTY);
  const bw = (white ? VDUTY : 1 - VDUTY) * VW * r;
  const s = Math.sin(Math.PI * u);
  let edgePx = (u < 0.5 ? u : 1 - u) * bw; if (eyePx < edgePx) edgePx = eyePx;
  let g = edgePx / 2.2; if (g > 1) g = 1; g = g * g * (3 - 2 * g);
  const lo = white ? WH_LO : BL_LO, hi = white ? WH_HI : BL_HI, k = s * (0.55 + 0.45 * s);
  oR = GRV[0] + ((lo[0] + (hi[0] - lo[0]) * k) * m - GRV[0]) * g;
  oG = GRV[1] + ((lo[1] + (hi[1] - lo[1]) * k) * m - GRV[1]) * g;
  oB = GRV[2] + ((lo[2] + (hi[2] - lo[2]) * k) * m - GRV[2]) * g;
  oH = (white ? 1.3 : 0.55) * (bw * 0.32 > 8 ? 8 : bw * 0.32) * s * (1.3 - 0.3 * s);
  oGl = 0.35 + 0.65 * g; oTop = white ? s : 0;
}

/** the foam bead on the arc. u = 0 on the arc … 1 at its inner edge */
function sampleRim(u) {
  if (u < 0) u = 0; else if (u > 1) u = 1;
  const x2 = 2 * u - 1, s = Math.sqrt(1 - x2 * x2);
  oH = u < 0.5 ? 20 * s : 12.5 + 7.5 * s;
  let g = ((1 - u) * RIM) / 2.6; if (g > 1) g = 1; g = g * g * (3 - 2 * g);
  let am = 1 - u / 0.2; am = am < 0 ? 0 : am * 0.5;      // a little yellow glaze ran into the white along the top
  const k = 1 - s;
  let r = WH_HI[0] - 0.2 * k, gg = WH_HI[1] - 0.12 * k, b = WH_HI[2] - 0.08 * k;
  r += (0.9 - r) * am; gg += (0.72 - gg) * am; b += (0.3 - b) * am;
  oR = GRV[0] + (r - GRV[0]) * g; oG = GRV[1] + (gg - GRV[1]) * g; oB = GRV[2] + (b - GRV[2]) * g;
  oGl = 0.4 + 0.6 * g; oTop = s;
}

const LI_SIN = Math.sin(L.deg(57)), LI_COS = Math.cos(L.deg(57)), LI_PER = 92;
/** the 立水 row: a white foam lip (t near 1) trimming the field of slanted ribs */
function sampleLishuiArch(t, r, s, d) {
  const lipPx = (1 - t) * r;
  if (lipPx < LI_LIP) {
    const u = lipPx / LI_LIP, sn = Math.sin(Math.PI * u);
    let g = u < 0.5 ? 1 : ((1 - u) * LI_LIP) / 2.4; if (g > 1) g = 1; g = g * g * (3 - 2 * g);
    const k = sn * (0.55 + 0.45 * sn);
    oR = GRV[0] + (WH_LO[0] + (WH_HI[0] - WH_LO[0]) * k - GRV[0]) * g;
    oG = GRV[1] + (WH_LO[1] + (WH_HI[1] - WH_LO[1]) * k - GRV[1]) * g;
    oB = GRV[2] + (WH_LO[2] + (WH_HI[2] - WH_LO[2]) * k - GRV[2]) * g;
    oH = 9.5 * sn * (1.3 - 0.3 * sn) + 4.5 * t; oGl = 0.35 + 0.65 * g; oTop = sn;
    return;
  }
  sampleLishui(s, d);
  let g = (lipPx - LI_LIP) / 2.4; if (g > 1) g = 1; g = g * g * (3 - 2 * g);
  oR = GRV[0] + (oR - GRV[0]) * g; oG = GRV[1] + (oG - GRV[1]) * g; oB = GRV[2] + (oB - GRV[2]) * g;
  oH = oH * g + 4.5 * t; oGl *= 0.5 + 0.5 * g;
}
/** 立水: parallel slanted ribs, blue / green / white in turn. s = arc length from the crest, d = depth */
function sampleLishui(s, d) {
  const along = -s * LI_COS + d * LI_SIN;
  let q = (s * LI_SIN + d * LI_COS + 7 * Math.sin(along / 38)) / LI_PER;
  const f = (q - Math.floor(q)) * LI_PER;
  let u, bw, lo, hi;
  if (f < 37) { u = f / 37; bw = 37; lo = BL_LO; hi = BL_HI; }
  else if (f < 71) { u = (f - 37) / 34; bw = 34; lo = GR_LO; hi = GR_HI; }
  else { u = (f - 71) / 21; bw = 21; lo = WH_LO; hi = WH_HI; }
  const sn = Math.sin(Math.PI * u);
  let g = ((u < 0.5 ? u : 1 - u) * bw) / 2.4; if (g > 1) g = 1; g = g * g * (3 - 2 * g);
  const k = sn * (0.55 + 0.45 * sn);
  oR = GRV[0] + (lo[0] + (hi[0] - lo[0]) * k - GRV[0]) * g;
  oG = GRV[1] + (lo[1] + (hi[1] - lo[1]) * k - GRV[1]) * g;
  oB = GRV[2] + (lo[2] + (hi[2] - lo[2]) * k - GRV[2]) * g;
  oH = (bw * 0.3 > 9 ? 9 : bw * 0.3) * sn * (1.3 - 0.3 * sn);
  oGl = 0.35 + 0.65 * g; oTop = sn;
}

/** 1 inside the text-safe zone, easing to 0 about 110 px outside it (frame coordinates) */
function calm(env, x, y) {
  const cy = env.arc.crestY;
  const dx = x < 630 ? 630 - x : x > 1290 ? x - 1290 : 0, dy = y < cy - 260 ? cy - 260 - y : y > cy - 10 ? y - (cy - 10) : 0;
  const dd = Math.sqrt(dx * dx + dy * dy);
  return dd >= 110 ? 0 : 1 - L.smooth(dd / 110);
}

// ───────────── the relief: colour + height per pixel, in the arc's polar frame ─────────────
function buildField(env) {
  const a = env.arc, R = a.R;
  const cxL = a.cx + PAD, cyL = a.cy + PAD;
  const y0 = Math.max(0, Math.floor(a.crestY + PAD - 84));
  const fh = LH - y0, N = LW * fh;
  const rnd = L.rng('s30relief');
  const half = a.span(PAD + 160);

  const rows = ROWS.map(([r0, top], k) => {
    const c = top + r0, dth = (r0 * 1.94) / (R - c);
    const n = Math.ceil(half / dth) + 2, count = 2 * n + 1, ph = k % 2 ? 0.5 : 0;
    const row = { c, dth, n, count, ph, level: 4 + 8 * k, li: k === LI_ROW, lo: 0, hi: 0,
      x: new Float32Array(count), y: new Float32Array(count), r: new Float32Array(count), th: new Float32Array(count), tone: new Float32Array(count), vr: new Uint8Array(count) };
    let rmax = 0;
    for (let j = -n; j <= n; j++) {
      const i = j + n;
      const rr = r0 * (1 + rnd.range(-0.04, 0.04));
      const th = (j + ph + rnd.range(-0.03, 0.03)) * dth;
      const cc = k === 0 ? top + rr : c + rnd.range(-0.03, 0.03) * r0;
      row.th[i] = th; row.r[i] = rr;
      row.x[i] = cxL + (R - cc) * Math.sin(th); row.y[i] = cyL - (R - cc) * Math.cos(th);
      row.tone[i] = rnd.range(-0.1, 0.08); row.vr[i] = (k + (rnd.chance(0.14) ? 1 : 0)) % 2;
      if (rr > rmax) rmax = rr;
    }
    row.lo = c - rmax * 1.04 - 28; row.hi = c + rmax * 1.04 + 28;
    return row;
  });
  // spray volutes sit in front of the junctions of the top row, tucked up under the foam bead
  const r0w = rows[0], vcount = r0w.count - 1;
  const VX = new Float32Array(vcount), VY = new Float32Array(vcount), VRr = new Float32Array(vcount), VTH = new Float32Array(vcount), VPH = new Float32Array(vcount), VTONE = new Float32Array(vcount);
  const drops = [];
  for (let i = 0; i < vcount; i++) {
    const th = (r0w.th[i] + r0w.th[i + 1]) / 2, rr = VR * (1 + rnd.range(-0.07, 0.07)), cc = RIM - 5 + rr;
    VTH[i] = th; VRr[i] = rr; VX[i] = cxL + (R - cc) * Math.sin(th); VY[i] = cyL - (R - cc) * Math.cos(th);
    VPH[i] = 0.55 + rnd.range(-0.15, 0.15); VTONE[i] = rnd.range(-0.05, 0.05);
    // 浪花: a string of white beads flung up and forward from the curl, each smaller than the last, plus a few
    // strays — only on curls far enough from the centre that nothing can touch the title
    const fx = a.cx + R * Math.sin(th);
    if (Math.abs(fx - a.cx) < 420) continue;
    const big = rnd.range(0.9, 1.15);
    for (const [ox, up, dr] of [[16, 21, 11.5], [35, 37, 7.8], [49, 55, 5.4], [57, 72, 3.6], [-7, 43, 4.4], [74, 29, 3.2], [9, 66, 2.6]]) {
      const rr2 = dr * big, up2 = up * big + rnd.range(-1.5, 1.5), t2 = th + (ox * big + rnd.range(-1.5, 1.5)) / R;
      drops.push({ x: cxL + (R + up2) * Math.sin(t2), y: cyL - (R + up2) * Math.cos(t2), r: rr2 });
    }
  }

  const Hh = new Float32Array(N), Al = new Float32Array(N), Oc = new Float32Array(N), Gl = new Float32Array(N);
  const Cr = new Float32Array(N), Cg = new Float32Array(N), Cb = new Float32Array(N);
  const fld = (opts) => L.noiseTex(LW, fh, opts).getContext('2d').getImageData(0, 0, LW, fh).data;
  const WXf = fld({ seed: 's30wx', scale: 230, octaves: 3, res: 0.1, contrast: 1.6 });
  const WYf = fld({ seed: 's30wy', scale: 230, octaves: 3, res: 0.1, contrast: 1.6 });
  const FINE = fld({ seed: 's30fine', scale: 9, octaves: 2, res: 0.34, contrast: 1.4 });
  const CHIP = fld({ seed: 's30chip', scale: 34, octaves: 3, res: 0.25, contrast: 1.7 });
  const MOT = fld({ seed: 's30mot', scale: 120, octaves: 3, res: 0.125, contrast: 1.5 });

  const S2x = 0.669, S2y = 0.743;       // direction the light travels across the surface (toward lower right)
  const K = rows.length, VLEVEL = 27, VMAXD = RIM + VR * 2.3 + 30;
  for (let py = 0; py < fh; py++) {
    const Y = py + y0 + 0.5, ddy = cyL - Y;
    for (let px = 0; px < LW; px++) {
      const X = px + 0.5, ddx = X - cxL;
      const d = R - Math.sqrt(ddx * ddx + ddy * ddy);
      if (d < -0.5) continue;
      const i = py * LW + px, i4 = i * 4;
      const theta = Math.atan2(ddx, ddy);
      // hand-modelled wobble: rows wander a few px (none at the arc, which must stay exact)
      let wk = d / 150; if (wk > 1) wk = 1; const wamp = 6.5 * wk * wk * (3 - 2 * wk);
      const qx = X + (WXf[i4] / 255 - 0.5) * wamp, qy = Y + (WYf[i4] / 255 - 0.5) * wamp;
      let A = 0, ar = 0, ag = 0, ab = 0, ah = 0, agl = 0, aoc = 0, atop = 0, sh = 0;
      // 1) foam bead on the arc
      if (d < RIM + 0.5) {
        const cov = d < RIM - 0.5 ? 1 : RIM + 0.5 - d;
        sampleRim(d / RIM);
        A = cov; ar = cov * oR; ag = cov * oG; ab = cov * oB; ah = cov * oH; agl = cov * oGl; atop = cov * oTop;
      }
      if (d > RIM - 0.5 && d < RIM + 20) {
        const e = d > RIM ? d - RIM : 0, f = 1 - e / 20;
        let cast = -Math.sin(theta) * S2x + Math.cos(theta) * S2y; if (cast < 0) cast = 0;
        const s1 = cast * f * f * 0.85, s2 = 0.5 * Math.exp(-e / 3.5);
        sh = s1 > s2 ? s1 : s2;
      }
      // 2) spray volutes
      if (A < 0.995 && d < VMAXD) {
        const jv = Math.round(theta / r0w.dth - 0.5) + r0w.n;
        if (jv >= 0 && jv < vcount) {
          const vx = qx - VX[jv], vy = qy - VY[jv], dist = Math.sqrt(vx * vx + vy * vy), rr = VRr[jv], e = dist - rr;
          if (e < 0.5) {
            const cov = e < -0.5 ? 1 : 0.5 - e, w = (1 - A) * cov;
            sampleVolute(dist / rr > 1 ? 1 : dist / rr, Math.atan2(vx, -vy) - VTH[jv], rr, VPH[jv], VTONE[jv]);
            ar += w * oR; ag += w * oG; ab += w * oB; ah += w * (VLEVEL + oH); agl += w * oGl; atop += w * oTop; aoc += w * sh; A += w;
          }
          if (e > -0.5 && e < 24) {
            const ee = e > 0 ? e : 0, f = 1 - ee / 24;
            let cast = ((vx * S2x + vy * S2y) / dist + 0.15) / 0.85; if (cast < 0) cast = 0; else if (cast > 1) cast = 1;
            const s1 = cast * f * f * 0.85, s2 = 0.55 * Math.exp(-ee / 3.5), ss = s1 > s2 ? s1 : s2;
            if (ss > sh) sh = ss;
          }
        }
      }
      // 3) 平水 rows, nearest row (largest k) first
      for (let k = K - 1; k >= 0 && A < 0.995; k--) {
        const row = rows[k];
        if (d < row.lo || d > row.hi) continue;
        const jf = theta / row.dth - row.ph, jr = Math.round(jf), j0 = jr + row.n, j1 = j0 + (jf > jr ? 1 : -1);
        let bt = 9, bi = -1, bd = 0;
        for (let c = 0; c < 2; c++) {            // only the two nearest billows of a row can matter
          const idx = c ? j1 : j0;
          if (idx < 0 || idx >= row.count) continue;
          const vx = qx - row.x[idx], vy = qy - row.y[idx], dist = Math.sqrt(vx * vx + vy * vy), rr = row.r[idx], e = dist - rr;
          if (dist / rr < bt) { bt = dist / rr; bi = idx; bd = dist; }
          if (e > -0.5 && e < 18) {
            const ee = e > 0 ? e : 0, f = 1 - ee / 18;
            let cast = ((vx * S2x + vy * S2y) / dist + 0.1) / 0.8; if (cast < 0) cast = 0; else if (cast > 1) cast = 1;
            const s1 = cast * f * f * 0.8, s2 = 0.5 * Math.exp(-ee / 3.5), ss = s1 > s2 ? s1 : s2;
            if (ss > sh) sh = ss;
          }
        }
        if (bi < 0) continue;
        const rr = row.r[bi], e = bd - rr;
        if (e < 0.5) {
          const cov = e < -0.5 ? 1 : 0.5 - e, w = (1 - A) * cov;
          if (row.li) sampleLishuiArch(bt > 1 ? 1 : bt, rr, theta * R + qx - X, d + qy - Y);
          else sampleScale(bt > 1 ? 1 : bt, rr, row.vr[bi], row.tone[bi]);
          ar += w * oR; ag += w * oG; ab += w * oB; ah += w * (row.level + oH); agl += w * oGl; atop += w * oTop; aoc += w * sh; A += w;
        }
      }
      // 4) any chink left between the billows: dark ground
      if (A < 0.995) {
        const w = 1 - A;
        ar += w * GRV[0] * 1.3; ag += w * GRV[1] * 1.3; ab += w * GRV[2] * 1.3; agl += w * 0.5; aoc += w * (sh > 0.4 ? sh : 0.4);
      }
      // glaze life: uneven thickness, worn ridges showing the clay body, pin-prick surface
      const mot = MOT[i4] / 255, fine = FINE[i4] / 255;
      const mm = 0.84 + 0.32 * mot;
      ar *= mm; ag *= mm; ab *= mm;
      let chip = (CHIP[i4] / 255 - 0.975 + 0.1 * atop) / 0.035; chip = chip < 0 ? 0 : chip > 1 ? 1 : chip;
      if (chip > 0) {
        const bb = 0.86 + 0.28 * fine;
        ar += (BODY[0] * bb - ar) * chip; ag += (BODY[1] * bb - ag) * chip; ab += (BODY[2] * bb - ab) * chip;
        agl *= 1 - 0.92 * chip; ah -= 1.3 * chip;
      }
      ah += (fine - 0.5) * 0.5 + (mot - 0.5) * 2.5;
      const aE = d < 0.5 ? d + 0.5 : 1;
      Hh[i] = ah * aE; Al[i] = aE; Oc[i] = aoc; Gl[i] = agl; Cr[i] = ar; Cg[i] = ag; Cb[i] = ab;
    }
  }
  // spray beads above the arc
  for (const dp of drops) {
    const x0 = Math.max(1, Math.floor(dp.x - dp.r - 1)), x1 = Math.min(LW - 2, Math.ceil(dp.x + dp.r + 1));
    const ya = Math.max(1, Math.floor(dp.y - dp.r - 1) - y0), yb = Math.min(fh - 2, Math.ceil(dp.y + dp.r + 1) - y0);
    for (let py = ya; py <= yb; py++) for (let px = x0; px <= x1; px++) {
      const vx = px + 0.5 - dp.x, vy = py + y0 + 0.5 - dp.y, dist = Math.sqrt(vx * vx + vy * vy), e = dist - dp.r;
      if (e >= 0.5) continue;
      const cov = e < -0.5 ? 1 : 0.5 - e, u = dist / dp.r, sq = Math.sqrt(u < 1 ? 1 - u * u : 0), i = py * LW + px;
      const na = cov + Al[i] * (1 - cov), wo = (Al[i] * (1 - cov)) / na, wn = cov / na;
      Cr[i] = Cr[i] * wo + (WH_LO[0] + (WH_HI[0] - WH_LO[0]) * sq) * wn;
      Cg[i] = Cg[i] * wo + (WH_LO[1] + (WH_HI[1] - WH_LO[1]) * sq) * wn;
      Cb[i] = Cb[i] * wo + (WH_LO[2] + (WH_HI[2] - WH_LO[2]) * sq) * wn;
      Gl[i] = Gl[i] * wo + wn; Oc[i] *= wo; Al[i] = na;
      const hh = dp.r * 0.85 * sq; if (hh * cov > Hh[i]) Hh[i] = hh * cov;      // beads fuse where they touch
    }
  }
  // soften the height a touch so edges read as rounded glaze, not knife cuts
  const T = new Float32Array(N);
  for (let y = 0; y < fh; y++) { const o = y * LW; T[o] = Hh[o]; T[o + LW - 1] = Hh[o + LW - 1]; for (let x = 1; x < LW - 1; x++) T[o + x] = (Hh[o + x - 1] + 2 * Hh[o + x] + Hh[o + x + 1]) * 0.25; }
  for (let y = 1; y < fh - 1; y++) { const o = y * LW; for (let x = 0; x < LW; x++) Hh[o + x] = (T[o + x - LW] + 2 * T[o + x] + T[o + x + LW]) * 0.25; }
  return { y0, fh, N, Hh, Al, Oc, Gl, Cr, Cg, Cb, drops };
}

/** light the field: az = screen direction TO the light (deg, 225 = upper left), el = its elevation */
function shadeField(F, az, el) {
  const { fh, Hh, Al, Oc, Gl, Cr, Cg, Cb } = F;
  const Lx = Math.cos(L.deg(az)) * Math.cos(L.deg(el)), Ly = Math.sin(L.deg(az)) * Math.cos(L.deg(el)), Lz = Math.sin(L.deg(el));
  const hl = Math.hypot(Lx, Ly, Lz + 1), Hx = Lx / hl, Hy = Ly / hl, Hz = (Lz + 1) / hl;
  const img = new ImageData(LW, fh), o = img.data, SM = 3;
  for (let y = 1; y < fh - 1; y++) for (let x = 1; x < LW - 1; x++) {
    const i = y * LW + x, al = Al[i];
    if (al <= 0.003) continue;
    let gx = (Hh[i + 1] - Hh[i - 1]) * 0.5, gy = (Hh[i + LW] - Hh[i - LW]) * 0.5;
    const m2 = gx * gx + gy * gy;
    if (m2 > SM * SM) { const s = SM / Math.sqrt(m2); gx *= s; gy *= s; }
    const inv = 1 / Math.sqrt(gx * gx + gy * gy + 1), nx = -gx * inv, ny = -gy * inv;
    let nl = nx * Lx + ny * Ly + inv * Lz; if (nl < 0) nl = 0;
    let nh = nx * Hx + ny * Hy + inv * Hz; if (nh < 0) nh = 0;
    const oc = Oc[i], amb = 0.33 * (1 - 0.5 * oc), dif = 0.98 * nl * (1 - 0.92 * oc);
    const n2 = nh * nh, n4 = n2 * n2, n8 = n4 * n4, n16 = n8 * n8, n32 = n16 * n16, n64 = n32 * n32;
    const sp = Gl[i] * (1 - oc) * (n64 * n32 * 1.6 + n16 * 0.4);
    const j = i * 4;
    o[j] = (Cr[i] * (amb * 0.92 + dif * 1.04) + sp) * 255;
    o[j + 1] = (Cg[i] * (amb * 0.98 + dif) + sp * 0.99) * 255;
    o[j + 2] = (Cb[i] * (amb * 1.12 + dif * 0.95) + sp * 0.95) * 255;
    o[j + 3] = al * 255;
  }
  const c = L.makeCanvas(LW, fh);
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

// ───────────── the yellow glaze above the arc ─────────────
/**
 * Glaze crazing (开片): the walls of a jittered-grid Voronoi diagram, stroked as hairlines above the arc.
 * cell = mesh size (px); strength varies in slow patches and is held back over the title; skip = share of cells left open.
 */
function crackle(g, env, cell, seed, width, color, amount, skip) {
  const a = env.arc, nz = L.makeNoise('s30cr' + seed), r = L.rng('s30cr' + seed);
  const i0 = Math.floor(-PAD / cell) - 3, ni = Math.ceil(LW / cell) + 7, nj = Math.ceil((a.yAt(-PAD) + PAD) / cell) + 7;
  const SX = new Float32Array(ni * nj), SY = new Float32Array(ni * nj);
  for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) {
    let h = (Math.imul(i + i0, 374761393) ^ Math.imul(j + i0, 668265263) ^ seed) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    SX[j * ni + i] = (i + i0 + 0.06 + 0.88 * ((h & 1023) / 1023)) * cell;
    SY[j * ni + i] = (j + i0 + 0.06 + 0.88 * (((h >>> 10) & 1023) / 1023)) * cell;
  }
  const NBK = 5, paths = Array.from({ length: NBK }, () => new Path2D());
  let A = new Float64Array(72), B = new Float64Array(72);
  for (let j = 2; j < nj - 2; j++) for (let i = 2; i < ni - 2; i++) {
    const c = j * ni + i, px = SX[c], py = SY[c];
    if (a.drAt(px, py) < -cell * 1.6 || (skip && r() < skip)) continue;
    // the cell = a big square clipped by the bisector to every neighbouring site (nearest ring first)
    let n = 8, maxR2 = 8 * cell * cell;
    A[0] = px - 2 * cell; A[1] = py - 2 * cell; A[2] = px + 2 * cell; A[3] = py - 2 * cell; A[4] = px + 2 * cell; A[5] = py + 2 * cell; A[6] = px - 2 * cell; A[7] = py + 2 * cell;
    for (let ring = 1; ring <= 2 && n >= 6; ring++) {
      for (let dj = -ring; dj <= ring && n >= 6; dj++) for (let di = -ring; di <= ring && n >= 6; di++) {
        if (di > -ring && di < ring && dj > -ring && dj < ring) continue;
        const q = c + dj * ni + di, nx = SX[q] - px, ny = SY[q] - py;
        if (nx * nx + ny * ny > 4 * maxR2) continue;                    // bisector lies outside what is left
        const mx = px + nx * 0.5, my = py + ny * 0.5;
        let m = 0, ax = A[n - 2], ay = A[n - 1], da = (ax - mx) * nx + (ay - my) * ny;
        for (let k = 0; k < n; k += 2) {
          const bx = A[k], by = A[k + 1], db = (bx - mx) * nx + (by - my) * ny;
          if (db <= 0) { if (da > 0) { const t = da / (da - db); B[m++] = ax + (bx - ax) * t; B[m++] = ay + (by - ay) * t; } B[m++] = bx; B[m++] = by; }
          else if (da <= 0) { const t = da / (da - db); B[m++] = ax + (bx - ax) * t; B[m++] = ay + (by - ay) * t; }
          ax = bx; ay = by; da = db;
        }
        const T = A; A = B; B = T; n = m;
      }
      maxR2 = 0;
      for (let k = 0; k < n; k += 2) { const dx = A[k] - px, dy = A[k + 1] - py, d2 = dx * dx + dy * dy; if (d2 > maxR2) maxR2 = d2; }
    }
    if (n < 6) continue;
    const v = L.clamp(0.5 + 0.95 * nz.fbm(px / 330, py / 330, 3));
    const k = (0.1 + 1.0 * v) * (1 - 0.62 * calm(env, px, py));
    const path = paths[Math.min(NBK - 1, Math.floor(k * NBK))];
    path.moveTo(A[0], A[1]);
    for (let q = 2; q < n; q += 2) path.lineTo(A[q], A[q + 1]);
    path.closePath();
  }
  g.save(); g.strokeStyle = color; g.lineWidth = width; g.lineJoin = 'round';
  for (let b = 0; b < NBK; b++) { g.globalAlpha = amount * ((b + 0.5) / NBK); g.stroke(paths[b]); }
  g.restore();
}

function flakePath(g, f) {
  const nz = L.makeNoise('s30fl' + f.seed), n = 120, cs = Math.cos(f.rot || 0), sn = Math.sin(f.rot || 0);
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const ph = (i / n) * L.TAU, ux = Math.cos(ph), uy = Math.sin(ph);
    const k = 1 + 0.3 * nz.n2(ux * 1.2 + 3, uy * 1.2) + 0.11 * nz.n2(ux * 3.4, uy * 3.4 + 7) + 0.035 * nz.n2(ux * 9, uy * 9 + 1);
    const lx = f.rx * k * ux, ly = f.ry * k * uy, x = f.x + lx * cs - ly * sn, y = f.y + lx * sn + ly * cs;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
}
/** a patch where the glaze has spalled off: matte pale body in a shallow pit, shadowed under its upper-left lip */
function drawFlake(g, f, bodyPat) {
  g.save(); g.filter = 'blur(3px)'; g.strokeStyle = 'rgba(255,238,160,0.4)'; g.lineWidth = 9; flakePath(g, f); g.stroke(); g.restore();
  g.save(); flakePath(g, f); g.clip();
  g.fillStyle = bodyPat; g.fillRect(f.x - 400, f.y - 400, 800, 800);
  g.fillStyle = 'rgba(232,184,32,0.1)'; g.fillRect(f.x - 400, f.y - 400, 800, 800);
  g.save(); g.filter = 'blur(2.5px)'; g.strokeStyle = 'rgba(76,46,6,0.8)'; g.lineWidth = 7; g.translate(3, 3.6); flakePath(g, f); g.stroke(); g.restore();
  g.save(); g.strokeStyle = 'rgba(255,251,228,0.85)'; g.lineWidth = 2.2; g.translate(-1.2, -1.5); flakePath(g, f); g.stroke(); g.restore();
  g.restore();
  g.save(); g.strokeStyle = 'rgba(122,74,6,0.55)'; g.lineWidth = 1; flakePath(g, f); g.stroke(); g.restore();
}

function scratch(g, pts, seed, k = 1) {
  L.sketchLine(g, pts, { width: 1.5, color: '#6e4204', seed, wobble: 1.8, passes: 1, alpha: 0.36 * k });
  L.sketchLine(g, pts.map(([x, y]) => [x + 1.2, y + 1.3]), { width: 1.1, color: '#fff4c4', seed, wobble: 1.8, passes: 1, alpha: 0.5 * k });
}
function joint(g, x0, y0, x1, y1, seed) {
  g.save(); g.filter = 'blur(5px)'; g.strokeStyle = 'rgba(255,240,170,0.3)'; g.lineWidth = 16; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.restore();
  L.sketchLine(g, [[x0, y0], [x1, y1]], { width: 2.6, color: '#3e2706', seed, wobble: 0.7, passes: 1, alpha: 0.8 });
  L.sketchLine(g, [[x0 + 1.8, y0 + 1.8], [x1 + 1.8, y1 + 1.8]], { width: 1.2, color: '#fff6cc', seed, wobble: 0.7, passes: 1, alpha: 0.55 });
}

function buildBase(env, F, relief) {
  const a = env.arc, r = L.rng('s30glaze');
  const JY = a.crestY - 298;                    // one bed joint, well above the title
  return L.makeLayer(PAD, (g) => {
    // glaze body: imperial yellow, a little lighter toward the light
    g.fillStyle = L.linear(g, -PAD, -PAD, W + PAD, H * 0.75, [[0, '#f8d654'], [0.4, '#eec028'], [1, '#e2ad16']]);
    g.fillRect(-PAD, -PAD, LW, LH);
    g.drawImage(L.noiseTex(LW, LH, { seed: 's30y1', scale: 430, octaves: 4, res: 0.12, contrast: 1.5, ramp: [[0, 'rgba(190,120,0,0.24)'], [0.5, 'rgba(232,184,32,0)'], [1, 'rgba(255,240,156,0.3)']] }), -PAD, -PAD);
    g.drawImage(L.noiseTex(LW, LH, { seed: 's30y2', scale: 52, octaves: 3, res: 0.25, contrast: 1.5, ramp: [[0, 'rgba(170,104,0,0.11)'], [0.5, 'rgba(232,184,32,0)'], [1, 'rgba(255,244,170,0.13)']] }), -PAD, -PAD);
    g.drawImage(L.noiseTex(LW, LH, { seed: 's30y3', scale: 80, sx: 0.4, sy: 8, octaves: 3, res: 0.2, contrast: 1.6, ramp: [[0, 'rgba(160,98,0,0.07)'], [0.55, 'rgba(0,0,0,0)'], [1, 'rgba(255,242,170,0.08)']] }), -PAD, -PAD);
    // the glassy surface is never dead flat: a faint orange-peel that catches the light
    g.save(); g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.26;
    g.drawImage(L.bumpLight(L.noiseTex(LW, LH, { seed: 's30peel', scale: 76, octaves: 3, res: 0.2, contrast: 1.3 }), { angle: 230, strength: 2.4, res: 0.34 }), -PAD, -PAD);
    g.restore();
    // big facing tiles: each fired a shade differently; the title sits inside one tile
    const tiles = [[-285, JY, 830, 1400, 'rgba(206,140,6,0.1)'], [1375, JY, 830, 1400, 'rgba(255,238,150,0.1)'],
      [-580, JY - 560, 830, 560, 'rgba(255,240,160,0.09)'], [250, JY - 560, 830, 560, 'rgba(200,134,4,0.08)'], [1080, JY - 560, 830, 560, 'rgba(240,170,20,0.07)']];
    for (const [x, y, w, h, c] of tiles) { g.fillStyle = c; g.fillRect(x, y, w, h); }
    // crazing: an open mesh of darker hairlines over a much finer, fainter one
    crackle(g, env, 10, 0x2f6b1d, 0.7, '#7a4a04', 0.26, 0);
    crackle(g, env, 26, 0x51ed27, 1.05, '#6a3c02', 0.44, 0.1);
    // joints
    joint(g, -PAD, JY, W + PAD, JY, 1);
    joint(g, 545, JY, 545, H, 2); joint(g, 1375, JY, 1375, H, 3);
    joint(g, 250, -PAD, 250, JY, 4); joint(g, 1080, -PAD, 1080, JY, 5); joint(g, 1910, -PAD, 1910, JY, 6);
    // dirt washed down from the spalls, then the spalls themselves
    const flakes = [
      { x: 268, y: 176, rx: 44, ry: 150, rot: -0.04, seed: 1 }, { x: 1648, y: 138, rx: 88, ry: 46, rot: 0.25, seed: 2 },
      { x: 548, y: JY + 4, rx: 25, ry: 17, rot: 0.5, seed: 3 }, { x: 1379, y: JY - 3, rx: 13, ry: 10, rot: 0, seed: 4 },
      { x: 96, y: 548, rx: 34, ry: 23, rot: 0.3, seed: 5 }, { x: 1842, y: 430, rx: 24, ry: 44, rot: -0.2, seed: 6 },
      { x: 846, y: 82, rx: 19, ry: 11, rot: 0.1, seed: 7 }, { x: 1250, y: 30, rx: 30, ry: 15, rot: -0.3, seed: 8 },
      { x: 1512, y: 566, rx: 15, ry: 10, rot: 0.4, seed: 9 }, { x: 426, y: 610, rx: 12, ry: 8, rot: -0.5, seed: 10 },
      { x: -40, y: 250, rx: 50, ry: 70, rot: 0.2, seed: 11 }, { x: 1975, y: 120, rx: 40, ry: 80, rot: 0.1, seed: 12 },
    ];
    for (let i = 0; i < 16; i++) {
      const x = r.range(-PAD, W + PAD), y = r.range(-PAD, 640);
      if (calm(env, x, y) > 0.02 || a.drAt(x, y) < 40) continue;
      flakes.push({ x, y, rx: r.range(3, 8), ry: r.range(2.5, 6), rot: r.range(0, 3), seed: 20 + i });
    }
    for (const f of flakes.slice(0, 2)) {
      g.fillStyle = L.linear(g, 0, f.y, 0, f.y + f.ry + 260, [[0, 'rgba(120,76,10,0)'], [0.25, 'rgba(120,76,10,0.15)'], [1, 'rgba(120,76,10,0)']]);
      g.fillRect(f.x - f.rx * 0.7, f.y, f.rx * 1.4, f.ry + 260);
    }
    const bodyPat = g.createPattern(L.stoneTex(360, 360, { base: '#e6dbc2', dark: '#b7a583', light: '#f8f2e2', seed: 's30body', scale: 70, speck: 0.8, rough: 0.7 }), 'repeat');
    for (const f of flakes) drawFlake(g, f, bodyPat);
    // scratches and scuffs
    scratch(g, [[560, 150], [820, 84], [1130, 92], [1430, 196], [1560, 300]], 11);
    scratch(g, [[1432, 20], [1470, 250], [1452, 560]], 12, 0.9);
    scratch(g, [[40, 468], [250, 404], [470, 452]], 13);
    scratch(g, [[1610, 352], [1760, 300], [1930, 356]], 14, 0.9);
    scratch(g, [[330, 40], [392, 250], [372, 392]], 15, 0.7);
    scratch(g, [[690, 236], [860, 206], [1010, 232]], 16, 0.55);
    for (let i = 0; i < 40; i++) {
      const x = r.range(-PAD, W + PAD), y = r.range(-PAD, 700), len = r.range(14, 70), an = r.range(-1.3, 1.3);
      if (calm(env, x, y) > 0.05) continue;
      scratch(g, [[x, y], [x + Math.cos(an) * len * 0.5 + r.range(-4, 4), y + Math.sin(an) * len * 0.5 + r.range(-4, 4)], [x + Math.cos(an) * len, y + Math.sin(an) * len]], 30 + i, r.range(0.4, 0.9));
    }
    L.chalkStroke(g, [[1700, 520], [1790, 470], [1900, 500]], { width: 26, color: '#fff3c0', seed: 5, density: 0.2, alpha: 0.22 });
    L.chalkStroke(g, [[120, 380], [200, 330], [240, 350]], { width: 20, color: '#fff3c0', seed: 6, density: 0.2, alpha: 0.2 });
    // pin-holes and grit in the glaze (sparser over the title)
    L.speckle(g, { seed: 's30pin', count: 2600, x: -PAD, y: -PAD, w: LW, h: 900, rMin: 0.4, rMax: 1.7, colors: ['#7a4a05', '#5c3602', '#fff4be', '#a86c08'], alpha: [0.12, 0.55], test: (x, y) => calm(env, x, y) < 0.3 });
    L.speckle(g, { seed: 's30pin2', count: 500, x: 500, y: 180, w: 920, h: 420, rMin: 0.4, rMax: 1.1, colors: ['#8a5606', '#fff4be'], alpha: [0.08, 0.3] });
    // where the relief rises out of the ground the yellow glaze has pooled deeper, and a dark crevice hugs the bead
    g.save(); a.pathBand(g, 52, -2);
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R, a.R + 52, [[0, 'rgba(148,80,0,0.5)'], [0.2, 'rgba(184,112,0,0.26)'], [1, 'rgba(190,120,0,0)']]);
    g.fill(); g.restore();
    g.save(); g.strokeStyle = 'rgba(56,30,0,0.7)'; g.lineWidth = 3.2; a.stroke(g, 0.6); g.restore();
    // spray beads throw small shadows on the yellow
    g.save(); g.filter = 'blur(2.5px)';
    g.fillStyle = 'rgba(96,52,0,0.55)';
    for (const d of F.drops) { g.beginPath(); g.arc(d.x - PAD + d.r * 0.5, d.y - PAD + d.r * 0.62, d.r * 1.02, 0, L.TAU); g.fill(); }
    g.restore();
    // the relief
    g.drawImage(relief, -PAD, F.y0 - PAD);
  });
}

export default {
  name: '琉璃海水纹',
  tone: 'dark',
  init(env) {
    const F = buildField(env);
    const base = buildBase(env, F, shadeField(F, 230, 38));
    const alt = shadeField(F, 204, 44);          // the same relief under a light that has swung a little
    S = { base, alt, y0: F.y0 };
  },
  draw(ctx, env, p) {
    const rot = L.lerp(-0.0055, 0.0055, p), zoom = L.lerp(1.0, 1.014, p);
    L.blit(ctx, env, S.base, { rot, zoom });
    // highlights slide along the glazed ridges as the light swings
    const k = L.smooth(p);
    if (k > 0.004) L.cam(ctx, env, { rot, zoom }, () => { ctx.globalAlpha = k; ctx.drawImage(S.alt, -PAD, S.y0 - PAD); });
    // a soft sheen crossing the flat yellow glaze
    const sx = L.lerp(-420, 520, p);
    ctx.save(); env.arc.clipAbove(ctx, 3);
    ctx.fillStyle = L.linear(ctx, sx, 0, sx + 1150, 560, [[0, 'rgba(255,248,214,0)'], [0.5, 'rgba(255,248,214,0.13)'], [1, 'rgba(255,248,214,0)']]);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  },
};
