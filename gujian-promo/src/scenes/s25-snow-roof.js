// s25 — 雪后金瓦. A round yellow-glazed roof after snowfall, at dusk.
// Above the arc: one flat sheet of magenta dusk sky (the tagline sits here).
// The arc = the top of a fat, rounded snow cornice (雪檐) catching a thread of gold sunset light.
// Below: the snow has slid off the tube-tile ridges (筒瓦垄) in radial strips of every length, baring wet golden glaze;
// drip-shaped lobes and small icicles hang where snow meets tile.
// Recipe: the tiles are drawn as vector half-cylinders; the snow is a real height field (computed per pixel in polar
// coordinates at reduced resolution, in init) that is lit, tinted and composited over them, then everything is blit with a small rot.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 240;
const PITCH = 112;        // spacing of tile ridges along the arc (px)
const HALF = 31;          // half-width of a tube tile (筒瓦) at the arc
const TILE = 140;         // length of one tube tile between joints
const RES = 0.6;          // resolution of the per-pixel snow pass
const HS = 13;            // thickness of the snow sheet lying on the roof (height units = px)
const CAP_D = 112;        // depth of the row of nail caps (钉帽) below the arc
const CAP_R = 17;
const KN = 700;           // depth samples (2 px apart) of the per-ridge melt profile
const C = { sky: '#8a2f7f', snow: '#f4f1f6', shade: '#b9b3d6', gold: '#e0a81f', goldDark: '#8a5a0c', sun: '#ffcf7a' };
let S = null;

const sm = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// ───────────────────────── the plan: where the snow lies ─────────────────────────
/**
 * Everything is described in the roof's own polar coordinates: theta along the arc, d = depth below the arc (px).
 * Ridges sit at theta = (i + 0.5)·PITCH/R ("底瓦坐中": a trough, not a ridge, lies on the centre line).
 * Snow sheet field  S = T + K:  T = −cos across one pitch (−1 on a ridge crown, +1 in a trough: snow lingers in troughs),
 * K(ridge, d) = how buried that ridge is at depth d (−1.8 bare band under the cornice … ≈0 a bare strip one tile wide … +1.7 buried).
 * Snow lies where S > 0.
 */
function makePlan(env) {
  const a = env.arc, R = a.R;
  const sMax = Math.atan2(W / 2 + PAD, a.cy - (H + PAD)) + 0.08;
  const n = Math.ceil((sMax * R) / PITCH) + 2;
  const nz = L.makeNoise('s25plan');
  const r = L.rng('s25plan');
  // lookup tables over theta
  const NL = 8192, TH0 = -sMax, LS = (NL - 1) / (2 * sMax);
  const topL = new Float32Array(NL);   // undulation of the cornice's top edge about the arc (dr, px)
  const cL = new Float32Array(NL);     // depth of the cornice's lower edge
  const hcL = new Float32Array(NL);    // cornice thickness (height)
  const lobes = [];                    // drip lobes hanging off the cornice, one slot per trough
  for (let j = -n - 2; j <= n + 2; j++) lobes.push(r.chance(0.55) ? { j, amp: r.range(12, 40), sig: r.range(9, 17), off: r.range(-16, 16) } : null);
  for (let k = 0; k < NL; k++) {
    const th = TH0 + k / LS, sa = th * R;
    const s = sa / PITCH - 0.5, j = Math.floor(s), f = s - j;
    const T = -Math.cos(L.TAU * f);
    topL[k] = L.clamp(3.1 * nz.fbm(sa / 170, 3.3, 2) + 1.5 * nz.n2(sa / 46, 8.1), -4.5, 4.5);
    let c = 70 + 13 * nz.fbm(sa / 400, 1.7, 2) + 5 * nz.n2(sa / 80, 9.2) + 6 * T;
    const lb = lobes[j + n + 2];
    if (lb) { const x = (f - 0.5) * PITCH - lb.off; c += lb.amp * Math.exp(-(x * x) / (2 * lb.sig * lb.sig)); }
    cL[k] = c;
    hcL[k] = 28 + 6 * nz.fbm(sa / 260, 5.9, 2);
  }
  const lut = (arr, th) => arr[L.clamp(Math.round((th - TH0) * LS), 0, NL - 1)];
  // per-ridge melt profile
  const NR = 2 * n + 4;
  const Klut = new Float32Array(NR * KN);
  const ridges = [];
  for (let i = -n - 2; i <= n + 1; i++) {
    const theta = ((i + 0.5) * PITCH) / R;
    const c = lut(cL, theta);
    const u = r();
    const rd = {
      i, theta, c,
      bridged: r.chance(0.05),                      // snow never slid off this ridge near the cornice
      band: r.range(30, 95), tr: r.range(50, 100),    // fully bare band right under the cornice, then the troughs fill with snow
      k: r.range(-0.5, 0.2),                       // width bias of the bare strip (negative = wider)
      len: u < 0.24 ? r.range(160, 240) : u < 0.58 ? r.range(240, 360) : u < 0.83 ? r.range(360, 480) : 5000,
      tip: r.range(16, 44),
      hole: null,
      tone: r.range(-0.06, 0.06),
      jit: r.range(-6, 6),
    };
    if (rd.bridged) { if (r.chance(0.65)) { const d0 = c + r.range(60, 200); rd.hole = [d0, r.chance(0.5) ? 5000 : d0 + r.range(140, 380)]; } }
    else if (rd.len < 1000 && r.chance(0.28)) { const d0 = rd.len + rd.tip + r.range(50, 150); rd.hole = [d0, d0 + r.range(70, 260)]; }
    ridges.push(rd);
    const base = (i + n + 2) * KN;
    for (let q = 0; q < KN; q++) {
      const d = q * 2;
      let K = 1.7;
      if (!rd.bridged) K = L.lerp(1.7, rd.k, 1 - sm((d - rd.len) / rd.tip));
      if (rd.hole) K = L.lerp(K, rd.k - 0.08, sm((d - rd.hole[0]) / 46) * (1 - sm((d - rd.hole[1]) / 60)));
      if (!rd.bridged) K = L.lerp(K, -1.8, 1 - sm((d - (c + rd.band)) / rd.tr));
      Klut[base + q] = K;
    }
  }
  return { n, sMax, NL, TH0, LS, topL, cL, hcL, lut, lobes, ridges, Klut };
}

// ───────────────────────── golden glazed tiles ─────────────────────────
function buildTiles(env, P) {
  const a = env.arc, R = a.R;
  const DEPTH = 1120;
  return L.makeLayer(PAD, (g) => {
    const r = L.rng('s25tile');
    // 1) pan tiles (板瓦) in the troughs: deep amber, densely lapped ("压七露三": only a narrow lip of each shows)
    g.save(); a.clipBelow(g, 16);
    g.fillStyle = L.radial(g, a.cx, a.cy, R - 950, R + 16, [[0, '#3e2002'], [0.55, '#704305'], [1, '#9c6408']]);
    g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    g.restore();
    for (let i = 0; i < P.ridges.length - 1; i++) {
      const mid = (P.ridges[i].theta + P.ridges[i + 1].theta) / 2;
      a.at(g, mid, 0, () => {
        const w0 = PITCH / 2 - HALF + 4;
        // the trough is a shallow gutter: lighter down its middle
        g.fillStyle = L.linear(g, -w0, 0, w0, 0, [[0, 'rgba(255,200,80,0)'], [0.45, 'rgba(255,200,80,0.3)'], [0.6, 'rgba(255,200,80,0.24)'], [1, 'rgba(255,200,80,0)']]);
        g.beginPath(); g.moveTo(-w0, -24); g.lineTo(w0, -24); g.lineTo((w0 * (R - DEPTH)) / R, DEPTH); g.lineTo((-w0 * (R - DEPTH)) / R, DEPTH); g.closePath(); g.fill();
        for (let d = 18 + r.range(-3, 3); d < DEPTH; d += 40) {
          const w = (w0 * (R - d)) / R;
          g.strokeStyle = 'rgba(40,20,2,0.7)'; g.lineWidth = 5;
          g.beginPath(); g.moveTo(-w, d - 5); g.quadraticCurveTo(0, d + 8, w, d - 5); g.stroke();
          g.strokeStyle = 'rgba(255,226,130,0.6)'; g.lineWidth = 2;
          g.beginPath(); g.moveTo(-w, d); g.quadraticCurveTo(0, d + 13, w, d); g.stroke();
        }
      });
    }
    // 2) tube tiles (筒瓦): glazed half-cylinders, one tile at a time, sun low on the left
    for (const rd of P.ridges) {
      a.at(g, rd.theta, 0, () => {
        const hwAt = (d) => (HALF * (R - d)) / R;
        const far = hwAt(DEPTH);
        // shadow thrown into the trough on the right, a thinner occlusion on the left
        g.fillStyle = L.linear(g, HALF - 3, 0, HALF + 22, 0, [[0, 'rgba(24,10,0,0.85)'], [1, 'rgba(24,10,0,0)']]);
        g.beginPath(); g.moveTo(HALF - 3, -24); g.lineTo(HALF + 22, -24); g.lineTo(far + 14, DEPTH); g.lineTo(far - 3, DEPTH); g.closePath(); g.fill();
        g.fillStyle = L.linear(g, -HALF - 8, 0, -HALF + 2, 0, [[0, 'rgba(24,10,0,0)'], [1, 'rgba(24,10,0,0.55)']]);
        g.beginPath(); g.moveTo(-HALF - 8, -24); g.lineTo(-HALF + 2, -24); g.lineTo(-far + 2, DEPTH); g.lineTo(-far - 6, DEPTH); g.closePath(); g.fill();
        let d0 = -24, d1 = 44 + rd.jit;
        while (d0 < DEPTH) {
          const h0 = hwAt(d0), h1 = hwAt(d1), hm = (h0 + h1) / 2;
          const tone = rd.tone + r.range(-0.06, 0.06);
          g.fillStyle = L.linear(g, -hm, 0, hm, 0, [
            [0, L.shade('#6e3f04', tone)], [0.1, L.shade('#d08a08', tone)], [0.22, L.shade('#ffd43a', tone)], [0.3, L.shade('#ffec9a', tone)], [0.38, L.shade('#f9bf1e', tone)],
            [0.55, L.shade('#e6a40f', tone)], [0.74, L.shade('#b06a06', tone)], [0.9, L.shade('#693803', tone)], [1, L.shade('#341c02', tone)]]);
          g.beginPath(); g.moveTo(-h0, d0); g.lineTo(h0, d0); g.lineTo(h1, d1); g.lineTo(-h1, d1); g.closePath(); g.fill();
          // each tile swells very slightly and darkens toward the end tucked under its neighbour
          g.fillStyle = L.linear(g, 0, d0, 0, d1, [[0, 'rgba(60,30,0,0.18)'], [0.1, 'rgba(60,30,0,0)'], [0.85, 'rgba(255,236,150,0)'], [1, 'rgba(255,236,150,0.08)']]);
          g.beginPath(); g.moveTo(-h0, d0); g.lineTo(h0, d0); g.lineTo(h1, d1); g.lineTo(-h1, d1); g.closePath(); g.fill();
          // glaze: a broad soft sheen, a hard wet streak, a second faint reflection
          g.lineCap = 'round';
          g.strokeStyle = 'rgba(255,244,190,0.3)'; g.lineWidth = hm * 0.36;
          g.beginPath(); g.moveTo(-h0 * 0.42, d0 + 10); g.lineTo(-h1 * 0.42, d1 - 10); g.stroke();
          g.strokeStyle = 'rgba(255,254,240,0.95)'; g.lineWidth = 3;
          g.beginPath(); g.moveTo(-h0 * 0.46, d0 + 13); g.lineTo(-h1 * 0.46, d1 - r.range(12, 40)); g.stroke();
          g.strokeStyle = 'rgba(255,250,220,0.5)'; g.lineWidth = 1.2;
          g.beginPath(); g.moveTo(-h0 * 0.16, d0 + r.range(14, 40)); g.lineTo(-h1 * 0.16, d1 - 16); g.stroke();
          // the magenta sky mirrored in the shadow flank
          g.strokeStyle = 'rgba(214,96,176,0.42)'; g.lineWidth = 2.4;
          g.beginPath(); g.moveTo(h0 * 0.8, d0 + 9); g.lineTo(h1 * 0.8, d1 - 9); g.stroke();
          // joint with the next tile: a fine seam and the lit lip of the tile below
          g.lineCap = 'butt';
          g.strokeStyle = 'rgba(44,22,2,0.7)'; g.lineWidth = 2;
          g.beginPath(); g.moveTo(-h1, d1 - 1); g.quadraticCurveTo(0, d1 + 3, h1, d1 - 1); g.stroke();
          g.strokeStyle = 'rgba(255,240,176,0.55)'; g.lineWidth = 1.4;
          g.beginPath(); g.moveTo(-h1 * 0.9, d1 + 1.8); g.quadraticCurveTo(0, d1 + 5.6, h1 * 0.55, d1 + 1.8); g.stroke();
          d0 = d1; d1 += TILE;
        }
        // the nail cap (钉帽) near the eave end of every ridge: a glazed dome, half lost under the snow lip
        const cr = CAP_R;
        g.fillStyle = 'rgba(30,14,0,0.6)'; g.beginPath(); g.ellipse(5, CAP_D + 8, cr * 1.08, cr * 0.85, 0, 0, L.TAU); g.fill();
        g.fillStyle = L.radial(g, -cr * 0.36, CAP_D - cr * 0.4, 1, cr * 1.3, [[0, '#fff2b0'], [0.22, '#ffd03a'], [0.6, '#d48e0a'], [0.86, '#8a5206'], [1, '#4a2803']]);
        g.beginPath(); g.arc(0, CAP_D, cr, 0, L.TAU); g.fill();
        g.strokeStyle = 'rgba(214,96,176,0.5)'; g.lineWidth = 2; g.beginPath(); g.arc(0, CAP_D, cr - 2.2, -0.5, 0.9); g.stroke();
        g.fillStyle = 'rgba(255,255,244,0.95)'; g.beginPath(); g.ellipse(-cr * 0.38, CAP_D - cr * 0.42, cr * 0.24, cr * 0.15, -0.6, 0, L.TAU); g.fill();
      });
    }
    // 3) glaze mottling that runs down the slope, a little grime
    g.save(); a.clipBelow(g, 16);
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.42;
    g.drawImage(L.polarNoiseLayer(env, PAD, { seed: 's25glaze', scale: 30, sx: 1, sy: 7, octaves: 3, contrast: 1.5, res: 0.25 }), -PAD, -PAD);
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.25;
    g.drawImage(L.polarNoiseLayer(env, PAD, { seed: 's25dirt', scale: 230, octaves: 3, warp: 0.5, res: 0.14, ramp: [[0, '#7a4a1a'], [0.5, '#ffffff'], [1, '#ffffff']] }), -PAD, -PAD);
    g.restore();
    // richer, deeper gold: the layer overlaid on itself (a cheap contrast + saturation lift)
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.55; g.drawImage(g.canvas, 0, 0); g.restore();
  });
}

/** in-place separable box blur of a Float32Array field (radius r, in grid px) */
function boxBlur(f, w, h, r) {
  const tmp = new Float32Array(Math.max(w, h)), k = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const o = y * w; let acc = 0;
    for (let x = -r; x <= r; x++) acc += f[o + (x < 0 ? 0 : x)];
    for (let x = 0; x < w; x++) { tmp[x] = acc * k; const xa = x + r + 1, xb = x - r; acc += f[o + (xa >= w ? w - 1 : xa)] - f[o + (xb < 0 ? 0 : xb)]; }
    for (let x = 0; x < w; x++) f[o + x] = tmp[x];
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += f[(y < 0 ? 0 : y) * w + x];
    for (let y = 0; y < h; y++) { tmp[y] = acc * k; const ya = y + r + 1, yb = y - r; acc += f[(ya >= h ? h - 1 : ya) * w + x] - f[(yb < 0 ? 0 : yb) * w + x]; }
    for (let y = 0; y < h; y++) f[y * w + x] = tmp[y];
  }
}

// ───────────────────────── snow: height field → light ─────────────────────────
function buildSnow(env, P) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const LW = W + PAD * 2, LH = H + PAD * 2;
  const gw = Math.round(LW * RES), gh = Math.round(LH * RES), N = gw * gh;
  const hS = new Float32Array(N), aS = new Float32Array(N), slS = new Float32Array(N); // sheet: height, solid alpha, slush alpha
  const hC = new Float32Array(N), aC = new Float32Array(N);                             // cornice: height, alpha
  const dD = new Float32Array(N);
  const nz = L.makeNoise('s25snow');
  const { TH0, LS, NL, cL, hcL, Klut, n } = P;
  const inv = 1 / RES, NRm = 2 * n + 2;
  // pass 1: the cornice, and the raw sheet field S (= T + K, snow where S > 0)
  const SS = new Float32Array(N).fill(1.2), TT = new Float32Array(N), live = new Uint8Array(N);
  for (let gy = 0; gy < gh; gy++) {
    const Y = (gy + 0.5) * inv - PAD, ddy = cy - Y;
    for (let gx = 0; gx < gw; gx++) {
      const X = (gx + 0.5) * inv - PAD, ddx = X - cx;
      const d = R - Math.sqrt(ddx * ddx + ddy * ddy);
      if (d < -18) continue;
      const i = gy * gw + gx;
      const th = Math.atan2(ddx, ddy);
      let li = ((th - TH0) * LS + 0.5) | 0; if (li < 0) li = 0; else if (li >= NL) li = NL - 1;
      const c = cL[li];
      dD[i] = d; live[i] = 1;
      // the cornice: a fat roll of snow between the arc and its scalloped lower edge
      const Sc = (c - d) / 14;
      if (Sc > -0.3) {
        aC[i] = sm((Sc + 0.05) / 0.14);
        const m = (d + 13) / (c + 13);
        if (m > 0 && m < 1) {
          const q = Math.abs(2 * m - 1);
          let h = hcL[li] * Math.sqrt(1 - q * q * q);             // a fat roll: broad crown, steep underside
          h *= 1 + 0.15 * nz.fbm(X / 120, Y / 70, 2);
          hC[i] = h + 0.2 * nz.n2(X / 13, Y / 13);
        }
      }
      // the sheet lying on the roof
      const sa = th * R, s = sa / PITCH - 0.5, j = Math.floor(s), f = s - j;
      // snow drifts a little to one side of a ridge or the other
      const T = -Math.cos(L.TAU * (f + 0.1 * nz.n2(sa / 330 + 11.3, d / 150 - 4.2)));
      let dq = d * 0.5; if (dq < 0) dq = 0; else if (dq > KN - 2) dq = KN - 2;
      const di = dq | 0, df = dq - di;
      let jj = j + n + 2; if (jj < 0) jj = 0; else if (jj > NRm) jj = NRm;
      const b = jj * KN + di;
      const fs = f * f * (3 - 2 * f);
      const k0 = Klut[b] + (Klut[b + 1] - Klut[b]) * df, k1 = Klut[b + KN] + (Klut[b + KN + 1] - Klut[b + KN]) * df;
      let K = k0 + (k1 - k0) * fs;
      K += 0.24 * nz.fbm(sa / 62, d / 105, 2) + 0.28 * nz.n2(sa / 340 + 5.1, d / 460 + 1.3);
      // here and there a whole slab has slid off, baring ridges and troughs together
      if (d < 520) K -= 1.9 * sm((nz.fbm(sa / 520 + 2.2, d / 360 + 7.7, 2) - 0.3) / 0.3) * (1 - sm((d - 300) / 220));
      SS[i] = T + K; TT[i] = T;
    }
  }
  // melt the field a little: a small blur rounds every corner into a soft, drip-like lobe
  boxBlur(SS, gw, gh, 3); boxBlur(SS, gw, gh, 2);
  // pass 2: sheet coverage and height from the melted field
  for (let gy = 0; gy < gh; gy++) {
    const Y = (gy + 0.5) * inv - PAD;
    for (let gx = 0; gx < gw; gx++) {
      const i = gy * gw + gx, Ss = SS[i];
      if (Ss <= -0.5 || !live[i] || (aC[i] >= 1 && dD[i] < 30)) continue; // nothing here, or buried deep under the cornice
      aS[i] = sm((Ss + 0.05) / 0.13);
      slS[i] = 0.2 * sm((Ss + 0.3) / 0.25);
      if (Ss > 0) {
        const X = (gx + 0.5) * inv - PAD;
        const e = Ss > 0.85 ? 1 : Ss / 0.85;
        hS[i] = HS * Math.sqrt(e) + e * (8 * nz.fbm(X / 210, Y / 210, 2) - 3.2 * TT[i] + 1.6 * nz.n2(X / 47, Y / 47) + 0.18 * nz.n2(X / 12, Y / 12));
      }
    }
  }
  // light: low sun from the upper left; shadows take the violet of the sky
  const lx = -0.22, ly = -0.74, lz = 0.635;
  const ramp = L.makeRamp([[0, '#7a71b4'], [0.24, '#9a92cb'], [0.44, C.shade], [0.6, '#dedaee'], [0.7, '#f7f5f9'], [0.82, '#fffefb'], [1, '#fff4e0']]);
  const lutN = 512, lutC = new Uint8ClampedArray(lutN * 3);
  for (let k = 0; k < lutN; k++) { const c = ramp(k / (lutN - 1)); lutC[k * 3] = c[0]; lutC[k * 3 + 1] = c[1]; lutC[k * 3 + 2] = c[2]; }
  const rj = L.rng('s25grain');
  const shadeRGB = L.parseColor('#aea7d2');
  const colorize = (hgt, alpha, slush, isCornice) => {
    const img = new ImageData(gw, gh), o = img.data;
    for (let y = 1; y < gh - 1; y++) {
      const Y = (y + 0.5) * inv - PAD;
      for (let x = 1; x < gw - 1; x++) {
        const i = y * gw + x;
        const solid = alpha[i], al = slush ? Math.max(solid, slush[i]) : solid;
        if (al < 0.004) continue;
        const hx = (hgt[i + 1] - hgt[i - 1]) * RES * 0.5, hy = (hgt[i + gw] - hgt[i - gw]) * RES * 0.5;
        const t = (-hx * lx - hy * ly + lz) / Math.sqrt(hx * hx + hy * hy + 1);
        let u = (t + 0.25) / 1.25; u = u < 0 ? 0 : u > 1 ? 1 : u;
        const q = ((u * (lutN - 1)) | 0) * 3;
        let cr = lutC[q], cg = lutC[q + 1], cb = lutC[q + 2];
        // broad, soft violet shadow patches and a slow fall into shade down the roof
        const X = (x + 0.5) * inv - PAD, d = dD[i];
        let cool = isCornice ? 0 : 0.1 * sm((d - 220) / 650) + 0.17 * sm(0.1 + 1.1 * nz.n2(X / 300 + 3.7, Y / 210 - 1.9)) * sm((d - 90) / 120);
        if (cool > 0) { cr += (shadeRGB[0] - cr) * cool; cg += (shadeRGB[1] - cg) * cool; cb += (shadeRGB[2] - cb) * cool; }
        // crystalline grain, the odd sparkle on lit snow
        const rv = rj();
        const jit = (rv - 0.5) * 7;
        cr += jit; cg += jit; cb += jit;
        if (rv > 0.9978 && t > 0.6) { cr = 255; cg = 254; cb = 248; }
        // translucent slush / ice skirt where the snow thins out over the glaze
        if (solid < 1) { const w = 1 - solid; cr += (214 - cr) * w; cg += (206 - cg) * w; cb += (238 - cb) * w; }
        const k = i * 4;
        o[k] = cr; o[k + 1] = cg; o[k + 2] = cb; o[k + 3] = al * 255;
      }
    }
    const c = L.makeCanvas(gw, gh);
    c.getContext('2d').putImageData(img, 0, 0);
    return c;
  };
  const sheet = colorize(hS, aS, slS, false);
  const cornice = colorize(hC, aC, null, true);
  // look-ups for dressing the roof afterwards: is this frame point bare glaze / solid snow?
  const at = (X, Y) => {
    const gx = Math.round((X + PAD) * RES - 0.5), gy = Math.round((Y + PAD) * RES - 0.5);
    if (gx < 2 || gy < 2 || gx >= gw - 2 || gy >= gh - 2) return null;
    const i = gy * gw + gx;
    return { S: SS[i], sheet: aS[i], cornice: aC[i], d: dD[i], h: hS[i] };
  };
  // sparkle sites: lit, solid snow
  const rs = L.rng('s25spark');
  const sparks = [];
  let guard = 0;
  while (sparks.length < 110 && guard++ < 6000) {
    const X = rs.range(-40, W + 40), Y = rs.range(a.crestY - 10, H + 20);
    const q = at(X, Y); if (!q) continue;
    const onC = q.cornice > 0.98 && q.d > 6 && q.d < 40, onS = q.sheet > 0.98 && q.cornice < 0.01 && q.h > HS * 0.9;
    if (!onC && !onS) continue;
    const p = a.polar(X, Y);
    sparks.push({ theta: p.theta, dr: p.dr, size: rs.range(0.7, 1.7) * (onC ? 1.15 : 1), ph: rs.int(0, 3), warm: rs.chance(0.45) });
  }
  return { sheet, cornice, gw, gh, sparks, at };
}

/** silhouette of a (low-res) snow canvas pushed down the roof and blurred → a cast shadow (still low-res; upscale when compositing) */
function castShadow(env, src, { push, dx, blur, color }) {
  const a = env.arc;
  const small = L.makeCanvas(src.width, src.height), sg = small.getContext('2d');
  const k = (a.R - push) / a.R, ccx = (a.cx + PAD) * RES, ccy = (a.cy + PAD) * RES;
  sg.filter = `blur(${blur * RES}px)`;
  sg.translate(ccx + dx * RES, ccy); sg.scale(k, k); sg.translate(-ccx, -ccy);
  sg.drawImage(src, 0, 0);
  sg.setTransform(1, 0, 0, 1, 0, 0); sg.filter = 'none';
  sg.globalCompositeOperation = 'source-in'; sg.fillStyle = color; sg.fillRect(0, 0, small.width, small.height);
  return small;
}

function drawIcicle(g, len, w, r) {
  const bend = r.range(-0.07, 0.07) * len;
  g.beginPath();
  g.moveTo(-w / 2, -8);
  g.quadraticCurveTo(-w * 0.3, len * 0.5, bend, len);
  g.quadraticCurveTo(w * 0.34, len * 0.5, w / 2, -8);
  g.closePath();
  g.fillStyle = L.linear(g, -w / 2, 0, w / 2, 0, [[0, 'rgba(255,255,255,0.96)'], [0.28, 'rgba(232,228,248,0.82)'], [0.62, 'rgba(176,168,220,0.7)'], [1, 'rgba(122,110,184,0.85)']]);
  g.fill();
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(255,255,255,0.92)'; g.lineWidth = Math.max(1, w * 0.14);
  g.beginPath(); g.moveTo(-w * 0.2, 0); g.quadraticCurveTo(-w * 0.12, len * 0.45, bend * 0.8, len * 0.84); g.stroke();
  // the drop gathering at the tip, lit by the sunset
  g.fillStyle = 'rgba(255,232,180,0.95)';
  g.beginPath(); g.arc(bend, len + 1.2, Math.max(1.6, w * 0.2), 0, L.TAU); g.fill();
}

// ───────────────────────── assemble the roof layer ─────────────────────────
function buildRoof(env, P, snow) {
  const a = env.arc, R = a.R;
  const LW = W + PAD * 2, LH = H + PAD * 2;
  const sEdge = a.span(PAD + 220);
  const topOf = (th) => P.lut(P.topL, th);
  const edge = [];
  { const nE = Math.ceil((2 * sEdge * R) / 3); for (let i = 0; i <= nE; i++) { const th = L.lerp(-sEdge, sEdge, i / nE); edge.push([th, topOf(th)]); } }
  const traceEdge = (g, off) => { edge.forEach(([th, dr], i) => { const p = a.pt(th, dr + off); if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y); }); };

  const roof = buildTiles(env, P);
  const g = roof.getContext('2d');
  g.setTransform(1, 0, 0, 1, PAD, PAD);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  const full = (c, op = 'source-over', alpha = 1) => { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = op; g.globalAlpha = alpha; g.drawImage(c, 0, 0, LW, LH); g.restore(); };
  // thin shadow of the snow sheet on the glaze, then the sheet
  full(castShadow(env, snow.sheet, { push: 8, dx: 4, blur: 5, color: 'rgba(66,26,40,0.5)' }), 'multiply');
  full(snow.sheet);
  // crumbs of snow left behind on the bare glaze near the melting edges
  const rc = L.rng('s25crumb');
  for (let k = 0; k < 1700; k++) {
    const X = rc.range(-PAD, W + PAD), Y = rc.range(a.crestY, H + PAD), rad = 0.9 + 2.6 * Math.pow(rc(), 3);
    const q = snow.at(X, Y);
    if (!q || q.cornice > 0.01 || q.S > -0.12 || q.S < -0.42) continue;
    const sq = rc.range(0.5, 0.9), ang = rc.range(0, 3.14);
    g.fillStyle = 'rgba(60,26,40,0.32)'; g.beginPath(); g.ellipse(X + rad * 0.45, Y + rad * 0.6, rad * 1.05, rad * sq, ang, 0, L.TAU); g.fill();
    g.fillStyle = rc.chance(0.5) ? '#f4f1f8' : '#dedaf0'; g.beginPath(); g.ellipse(X, Y, rad, rad * sq, ang, 0, L.TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.ellipse(X - rad * 0.25, Y - rad * 0.25, rad * 0.5, rad * sq * 0.5, ang, 0, L.TAU); g.fill();
  }
  // the cornice throws a long violet shadow down the roof (dark gold on tile, blue-violet on snow)
  full(castShadow(env, snow.cornice, { push: 36, dx: 8, blur: 12, color: 'rgba(82,54,134,0.8)' }), 'multiply');
  full(castShadow(env, snow.cornice, { push: 10, dx: 2, blur: 5, color: 'rgba(54,26,70,0.55)' }), 'multiply');
  // icicles hanging from the drip lobes
  const r = L.rng('s25ice');
  for (const lb of P.lobes) {
    if (!lb || lb.amp < 14 || !r.chance(0.8)) continue;
    const th = ((lb.j + 1) * PITCH + lb.off) / R;
    const c = P.lut(P.cL, th);
    a.at(g, th, -(c - 8), () => drawIcicle(g, 22 + lb.amp * r.range(1.1, 2.4), r.range(8.5, 13.5), r));
    if (r.chance(0.6)) { const o = r.range(11, 24) * r.sign(); const th2 = th + o / R; a.at(g, th2, -(P.lut(P.cL, th2) - 8), () => drawIcicle(g, r.range(18, 46), r.range(5.5, 9), r)); }
  }
  full(snow.cornice);
  // warm sunset wash over the crown of the cornice
  g.save(); g.globalCompositeOperation = 'source-atop';
  g.fillStyle = L.radial(g, a.cx, a.cy, R - 46, R + 6, [[0, L.rgba(C.sun, 0)], [0.45, L.rgba(C.sun, 0.14)], [0.72, L.rgba(C.sun, 0.42)], [1, L.rgba(C.sun, 0.9)]]);
  a.pathBand(g, 8, -46, -sEdge, sEdge); g.fill();
  g.restore();
  // the low sun rakes in from the left: a warm breath there, the far side sinking into violet
  g.save(); g.globalCompositeOperation = 'source-atop';
  g.fillStyle = L.linear(g, -PAD, 0, W + PAD, 0, [[0, 'rgba(255,196,120,0.2)'], [0.4, 'rgba(255,196,120,0)'], [0.6, 'rgba(96,70,170,0)'], [1, 'rgba(96,70,170,0.26)']]);
  g.fillRect(-PAD, -PAD, LW, LH);
  g.fillStyle = L.radial(g, a.cx, a.cy, R - 760, R - 260, [[0, 'rgba(70,48,130,0.3)'], [1, 'rgba(70,48,130,0)']]);
  g.fillRect(-PAD, -PAD, LW, LH);
  g.restore();
  // cut the silhouette: everything above the (gently undulating) top edge goes
  g.save(); g.globalCompositeOperation = 'destination-in';
  g.beginPath(); traceEdge(g, 0);
  g.lineTo(a.pt(sEdge, 0).x + 400, H + PAD + 900); g.lineTo(a.pt(-sEdge, 0).x - 400, H + PAD + 900); g.closePath();
  g.fillStyle = '#000'; g.fill();
  g.restore();
  // the thread of gold light on the very top of the snow (it thins and swells along the edge)
  const rim = L.makeLayer(PAD, (rg) => {
    rg.lineJoin = 'round'; rg.lineCap = 'round';
    rg.strokeStyle = '#ffc45e'; rg.lineWidth = 8; rg.beginPath(); traceEdge(rg, -4); rg.stroke();
    rg.strokeStyle = '#fff1cc'; rg.lineWidth = 2.6; rg.beginPath(); traceEdge(rg, -1.6); rg.stroke();
    rg.globalCompositeOperation = 'destination-in';
    rg.imageSmoothingEnabled = true; rg.imageSmoothingQuality = 'high';
    rg.drawImage(L.noiseTex(480, 4, { seed: 's25rim', scale: 22, octaves: 2, res: 1, contrast: 1.7, ramp: [[0, 'rgba(0,0,0,0.5)'], [0.5, 'rgba(0,0,0,0.9)'], [1, 'rgba(0,0,0,1)']] }), -PAD, -PAD, LW, LH);
  });
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.drawImage(rim, 0, 0); g.restore();
  const bloom = L.blurred(rim, 9);
  // glint sites: on the wet highlight of bare, sunlit tube tiles
  const rg2 = L.rng('s25glint');
  const glints = [];
  for (let k = 0; k < 400 && glints.length < 16; k++) {
    const rd = P.ridges[rg2.int(0, P.ridges.length - 1)], d = rg2.range(rd.c + 80, 500);
    const hw = (HALF * (R - d)) / R, theta = rd.theta - (0.46 * hw) / (R - d);
    const pt = a.pt(theta, -d);
    if (pt.x < -30 || pt.x > W + 30 || pt.y > H + 10) continue;
    const q = snow.at(pt.x, pt.y);
    if (!q || q.S > -0.75 || q.cornice > 0.01) continue;
    if (glints.some((o) => Math.hypot(o.x - pt.x, o.y - pt.y) < 150)) continue;
    glints.push({ x: pt.x, y: pt.y, theta, dr: -d, size: rg2.range(0.7, 1.25), ph: rg2.int(0, 2) });
  }
  return { roof, bloom, glints };
}

// ───────────────────────── sky ─────────────────────────
function buildSky(env) {
  const a = env.arc;
  const c = L.makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = C.sky; g.fillRect(0, 0, W, H);
  // all but flat: a breath of afterglow where it meets the roof, a breath deeper toward the top
  g.fillStyle = L.radial(g, a.cx, a.cy, a.R, a.R + 560, [[0, 'rgba(255,128,176,0.10)'], [0.4, 'rgba(255,128,176,0.03)'], [1, 'rgba(255,128,176,0)']]);
  g.fillRect(0, 0, W, H);
  g.fillStyle = L.linear(g, 0, 0, 0, 430, [[0, 'rgba(46,6,70,0.16)'], [1, 'rgba(46,6,70,0)']]);
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.13;
  g.drawImage(L.noiseTex(W, H, { seed: 's25sky', scale: 460, octaves: 3, res: 0.15 }), 0, 0);
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.6;
  g.drawImage(L.grainTex(W, H, { seed: 's25sky', amount: 0.13, size: 2 }), 0, 0);
  return c;
}

/** a small four-point glint of sun on wet glaze */
function star(ctx, x, y, rad, al) {
  ctx.fillStyle = L.radial(ctx, x, y, 0, rad, [[0, `rgba(255,252,236,${al})`], [0.18, `rgba(255,232,160,${al * 0.5})`], [1, 'rgba(255,220,140,0)']]);
  ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  for (const [sx, sy] of [[1, 0.07], [0.07, 1]]) {
    ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy);
    ctx.fillStyle = L.radial(ctx, 0, 0, 0, rad * 2.1, [[0, `rgba(255,255,246,${al})`], [0.3, `rgba(255,240,190,${al * 0.55})`], [1, 'rgba(255,230,160,0)']]);
    ctx.fillRect(-rad * 2.1, -rad * 2.1, rad * 4.2, rad * 4.2);
    ctx.restore();
  }
}

export default {
  name: '雪后金瓦',
  tone: 'light',
  init(env) {
    const t0 = performance.now();
    const P = makePlan(env);
    const snow = buildSnow(env, P);
    const t1 = performance.now();
    const { roof, bloom, glints } = buildRoof(env, P, snow);
    const t2 = performance.now();
    S = { sky: buildSky(env), roof, bloom, sparks: snow.sparks, glints };
    console.warn('TIMING snow', (t1 - t0) | 0, 'roof', (t2 - t1) | 0, 'sky', (performance.now() - t2) | 0);
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.0038, 0.0038, p);
    ctx.drawImage(S.sky, 0, 0);
    // halo of the lit snow edge against the dusk
    L.blit(ctx, env, S.bloom, { rot, blend: 'screen', alpha: 0.75 });
    L.blit(ctx, env, S.roof, { rot });
    // a sheen of low sun sliding along the cornice (kept on the roof so the sky stays flat)
    ctx.save(); a.clipBelow(ctx, 5);
    const gl = a.pt(L.lerp(-0.2, -0.1, p), -24);
    L.glow(ctx, gl.x, gl.y, 330, '#ffdca0', 0.2, 'soft-light');
    L.glow(ctx, gl.x, gl.y, 150, '#fff0cc', 0.16, 'screen');
    ctx.restore();
    L.cam(ctx, env, { rot }, () => {
      ctx.globalCompositeOperation = 'lighter';
      // snow crystals flashing
      for (const sp of S.sparks) {
        const k = (env.frame + sp.ph) % 4;
        if (k > 1) continue;
        const q = a.pt(sp.theta, sp.dr), al = k === 0 ? 0.95 : 0.5, rad = 4.5 * sp.size;
        ctx.fillStyle = L.radial(ctx, q.x, q.y, 0, rad, [[0, L.rgba(sp.warm ? '#ffe9bd' : '#ffffff', al)], [0.25, L.rgba(sp.warm ? '#ffd58c' : '#e6e2ff', al * 0.35)], [1, 'rgba(255,255,255,0)']]);
        ctx.fillRect(q.x - rad, q.y - rad, rad * 2, rad * 2);
        ctx.fillStyle = L.rgba('#ffffff', al);
        ctx.fillRect(q.x - 0.9 * sp.size, q.y - 0.9 * sp.size, 1.8 * sp.size, 1.8 * sp.size);
      }
      // sun glinting off the wet glaze: each glint swells and dies within three frames
      for (const gt of S.glints) {
        const k = (env.frame + gt.ph) % 3;
        const q = a.pt(gt.theta, gt.dr);
        star(ctx, q.x, q.y, 17 * gt.size * (k === 0 ? 1 : k === 1 ? 0.72 : 0.45), k === 0 ? 0.95 : k === 1 ? 0.7 : 0.4);
      }
    });
  },
};
