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
const PITCH = 100;        // spacing of tile ridges along the arc (px)
const HALF = 27;          // half-width of a tube tile (筒瓦) at the arc
const TILE = 124;         // length of one tube tile between joints
const RES = 0.6;          // resolution of the per-pixel snow pass
const HS = 13;            // thickness of the snow sheet lying on the roof (height units = px)
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
    let c = 80 + 16 * nz.fbm(sa / 400, 1.7, 2) + 6 * nz.n2(sa / 80, 9.2) + 6 * T;
    const lb = lobes[j + n + 2];
    if (lb) { const x = (f - 0.5) * PITCH - lb.off; c += lb.amp * Math.exp(-(x * x) / (2 * lb.sig * lb.sig)); }
    cL[k] = c;
    hcL[k] = 30 + 7 * nz.fbm(sa / 260, 5.9, 2);
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
      bridged: r.chance(0.1),                       // snow never slid off this ridge near the cornice
      band: r.range(6, 55), tr: r.range(40, 85),    // fully bare band right under the cornice, then the troughs fill with snow
      k: r.range(-0.3, 0.28),                       // width bias of the bare strip (negative = wider)
      len: u < 0.2 ? r.range(170, 250) : u < 0.52 ? r.range(250, 400) : u < 0.7 ? r.range(400, 560) : 5000,
      tip: r.range(45, 110),
      hole: null,
      tone: r.range(-0.06, 0.06),
      jit: r.range(-6, 6),
    };
    if (rd.bridged) { if (r.chance(0.65)) { const d0 = c + r.range(60, 200); rd.hole = [d0, r.chance(0.5) ? 5000 : d0 + r.range(140, 380)]; } }
    else if (rd.len < 1000 && r.chance(0.4)) { const d0 = rd.len + rd.tip + r.range(50, 150); rd.hole = [d0, d0 + r.range(70, 260)]; }
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
    // 1) pan tiles (板瓦) in the troughs: deep amber, densely lapped
    g.save(); a.clipBelow(g, 16);
    g.fillStyle = L.radial(g, a.cx, a.cy, R - 950, R + 16, [[0, '#4d2e05'], [0.55, '#7f540b'], [1, '#a87613']]);
    g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    g.restore();
    for (let i = 0; i < P.ridges.length - 1; i++) {
      const mid = (P.ridges[i].theta + P.ridges[i + 1].theta) / 2;
      a.at(g, mid, 0, () => {
        const w0 = PITCH / 2 - HALF + 3;
        for (let d = 20 + r.range(-3, 3); d < DEPTH; d += 38) {
          const w = (w0 * (R - d)) / R;
          g.strokeStyle = 'rgba(46,24,2,0.62)'; g.lineWidth = 4.5;
          g.beginPath(); g.moveTo(-w, d - 4); g.quadraticCurveTo(0, d + 7, w, d - 4); g.stroke();
          g.strokeStyle = 'rgba(255,224,132,0.42)'; g.lineWidth = 1.8;
          g.beginPath(); g.moveTo(-w, d + 1); g.quadraticCurveTo(0, d + 12, w, d + 1); g.stroke();
        }
      });
    }
    // 2) tube tiles (筒瓦): glazed half-cylinders, one tile at a time, sun low on the left
    for (const rd of P.ridges) {
      a.at(g, rd.theta, 0, () => {
        const hwAt = (d) => (HALF * (R - d)) / R;
        const far = hwAt(DEPTH);
        // shadow thrown into the trough on the right, a thinner occlusion on the left
        g.fillStyle = L.linear(g, HALF - 3, 0, HALF + 24, 0, [[0, 'rgba(28,12,0,0.78)'], [1, 'rgba(28,12,0,0)']]);
        g.beginPath(); g.moveTo(HALF - 3, -24); g.lineTo(HALF + 24, -24); g.lineTo(far + 15, DEPTH); g.lineTo(far - 3, DEPTH); g.closePath(); g.fill();
        g.fillStyle = L.linear(g, -HALF - 8, 0, -HALF + 2, 0, [[0, 'rgba(28,12,0,0)'], [1, 'rgba(28,12,0,0.5)']]);
        g.beginPath(); g.moveTo(-HALF - 8, -24); g.lineTo(-HALF + 2, -24); g.lineTo(-far + 2, DEPTH); g.lineTo(-far - 6, DEPTH); g.closePath(); g.fill();
        let d0 = -24, d1 = 38 + rd.jit;
        while (d0 < DEPTH) {
          const h0 = hwAt(d0), h1 = hwAt(d1), hm = (h0 + h1) / 2;
          const tone = rd.tone + r.range(-0.07, 0.07);
          g.fillStyle = L.linear(g, -hm, 0, hm, 0, [
            [0, L.shade('#8a5a0c', tone)], [0.11, L.shade('#d0941a', tone)], [0.25, L.shade('#ffe487', tone)], [0.33, L.shade('#fbd04a', tone)],
            [0.5, L.shade('#e0a81f', tone)], [0.72, L.shade('#b47a10', tone)], [0.9, L.shade('#7a4a09', tone)], [1, L.shade('#4a2b05', tone)]]);
          g.beginPath(); g.moveTo(-h0, d0); g.lineTo(h0, d0); g.lineTo(h1, d1); g.lineTo(-h1, d1); g.closePath(); g.fill();
          // glaze: a broad soft sheen and a hard wet streak
          g.lineCap = 'round';
          g.strokeStyle = 'rgba(255,242,186,0.26)'; g.lineWidth = hm * 0.34;
          g.beginPath(); g.moveTo(-h0 * 0.42, d0 + 9); g.lineTo(-h1 * 0.42, d1 - 9); g.stroke();
          g.strokeStyle = 'rgba(255,253,236,0.85)'; g.lineWidth = 2.3;
          g.beginPath(); g.moveTo(-h0 * 0.47, d0 + 12); g.lineTo(-h1 * 0.47, d1 - r.range(10, 34)); g.stroke();
          // a breath of the magenta sky mirrored in the shadow flank
          g.strokeStyle = 'rgba(196,96,170,0.3)'; g.lineWidth = 2.2;
          g.beginPath(); g.moveTo(h0 * 0.8, d0 + 8); g.lineTo(h1 * 0.8, d1 - 8); g.stroke();
          // joint with the next tile (熊头搭接): a dark seam and a lit lip under it
          g.lineCap = 'butt';
          g.strokeStyle = 'rgba(52,28,2,0.72)'; g.lineWidth = 3;
          g.beginPath(); g.moveTo(-h1, d1); g.quadraticCurveTo(0, d1 - 6, h1, d1); g.stroke();
          g.strokeStyle = 'rgba(255,238,170,0.5)'; g.lineWidth = 1.5;
          g.beginPath(); g.moveTo(-h1 * 0.92, d1 + 3.5); g.quadraticCurveTo(0, d1 - 2.5, h1 * 0.7, d1 + 3.5); g.stroke();
          d0 = d1; d1 += TILE;
        }
      });
    }
    // 3) glaze mottling that runs down the slope, a little grime
    g.save(); a.clipBelow(g, 16);
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.5;
    g.drawImage(L.polarNoiseLayer(env, PAD, { seed: 's25glaze', scale: 30, sx: 1, sy: 7, octaves: 3, contrast: 1.5, res: 0.33 }), -PAD, -PAD);
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.35;
    g.drawImage(L.polarNoiseLayer(env, PAD, { seed: 's25dirt', scale: 230, octaves: 3, warp: 0.5, res: 0.2, ramp: [[0, '#6a4a2a'], [0.5, '#ffffff'], [1, '#ffffff']] }), -PAD, -PAD);
    g.restore();
  });
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
      dD[i] = d;
      // the cornice: a fat roll of snow between the arc and its scalloped lower edge
      const Sc = (c - d) / 14;
      if (Sc > -0.3) {
        aC[i] = sm((Sc + 0.05) / 0.14);
        const m = (d + 13) / (c + 13);
        if (m > 0 && m < 1) {
          let h = hcL[li] * 2 * Math.sqrt(m * (1 - m));
          h *= 1 + 0.17 * nz.fbm(X / 85, Y / 60, 2);
          hC[i] = h + 1.1 * nz.n2(X / 10, Y / 10);
        }
      }
      if (Sc > 0.7) continue; // the sheet is hidden under the cornice here
      // the sheet lying on the roof
      const sa = th * R, s = sa / PITCH - 0.5, j = Math.floor(s), f = s - j;
      const T = -Math.cos(L.TAU * f);
      let di = (d * 0.5) | 0; if (di < 0) di = 0; else if (di >= KN) di = KN - 1;
      let jj = j + n + 2; if (jj < 0) jj = 0; else if (jj > NRm) jj = NRm;
      const b = jj * KN + di;
      const fs = f * f * (3 - 2 * f);
      let K = Klut[b] + (Klut[b + KN] - Klut[b]) * fs;
      K += 0.26 * nz.fbm(sa / 64, d / 130, 2) + 0.3 * nz.n2(sa / 340 + 5.1, d / 460 + 1.3);
      const Ss = T + K;
      if (Ss > -0.5) {
        aS[i] = sm((Ss + 0.05) / 0.13);
        slS[i] = 0.34 * sm((Ss + 0.5) / 0.45);
        if (Ss > 0) {
          const e = Ss > 0.85 ? 1 : Ss / 0.85;
          hS[i] = HS * Math.sqrt(e) + e * (7.5 * nz.fbm(X / 200, Y / 200, 3) - 3.2 * T + 1.3 * nz.n2(X / 11, Y / 11));
        }
      }
    }
  }
  // light: low sun from the upper left; shadows take the violet of the sky
  const lx = -0.22, ly = -0.74, lz = 0.635;
  const ramp = L.makeRamp([[0, '#7f77b6'], [0.2, '#958dc6'], [0.44, C.shade], [0.705, '#eeeaf5'], [0.86, '#fffbf4'], [1, '#ffeac4']]);
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
        let cool = isCornice ? 0 : 0.26 * sm((d - 150) / 650) + 0.3 * sm(0.5 + 1.3 * nz.fbm(X / 360 + 3.7, Y / 250 - 1.9, 2)) * sm((d - 90) / 120);
        if (cool > 0) { cr += (shadeRGB[0] - cr) * cool; cg += (shadeRGB[1] - cg) * cool; cb += (shadeRGB[2] - cb) * cool; }
        // crystalline grain, the odd sparkle on lit snow
        const rv = rj();
        const jit = (rv - 0.5) * 9;
        cr += jit; cg += jit; cb += jit;
        if (rv > 0.9972 && t > 0.55) { cr = 255; cg = 253; cb = 244; }
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
  // sparkle sites: lit, solid snow
  const rs = L.rng('s25spark');
  const sparks = [];
  let guard = 0;
  while (sparks.length < 110 && guard++ < 6000) {
    const X = rs.range(-40, W + 40), Y = rs.range(a.crestY - 10, H + 20);
    const gx = Math.round((X + PAD) * RES), gy = Math.round((Y + PAD) * RES);
    if (gx < 2 || gy < 2 || gx >= gw - 2 || gy >= gh - 2) continue;
    const i = gy * gw + gx;
    const onC = aC[i] > 0.98 && dD[i] > 6 && dD[i] < 46, onS = aS[i] > 0.98 && aC[i] < 0.01 && hS[i] > HS * 0.9;
    if (!onC && !onS) continue;
    const p = a.polar(X, Y);
    sparks.push({ theta: p.theta, dr: p.dr, size: rs.range(0.7, 1.7) * (onC ? 1.15 : 1), ph: rs.int(0, 3), warm: rs.chance(0.45) });
  }
  return { sheet, cornice, gw, gh, sparks };
}

/** silhouette of a (low-res) snow canvas pushed down the roof and blurred → a cast shadow, as a full padded layer */
function castShadow(env, src, { push, dx, blur, color }) {
  const a = env.arc;
  const LW = W + PAD * 2, LH = H + PAD * 2;
  const small = L.makeCanvas(src.width, src.height), sg = small.getContext('2d');
  const k = (a.R - push) / a.R, ccx = (a.cx + PAD) * RES, ccy = (a.cy + PAD) * RES;
  sg.filter = `blur(${blur * RES}px)`;
  sg.translate(ccx + dx * RES, ccy); sg.scale(k, k); sg.translate(-ccx, -ccy);
  sg.drawImage(src, 0, 0);
  sg.setTransform(1, 0, 0, 1, 0, 0); sg.filter = 'none';
  sg.globalCompositeOperation = 'source-in'; sg.fillStyle = color; sg.fillRect(0, 0, small.width, small.height);
  const out = L.makeCanvas(LW, LH), g = out.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(small, 0, 0, LW, LH);
  return out;
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
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  const full = (c, op = 'source-over', alpha = 1) => { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = op; g.globalAlpha = alpha; g.drawImage(c, 0, 0, LW, LH); g.restore(); };
  // thin shadow of the snow sheet on the glaze, then the sheet
  full(castShadow(env, snow.sheet, { push: 8, dx: 4, blur: 5, color: 'rgba(58,26,44,0.6)' }), 'multiply');
  full(snow.sheet);
  // the cornice throws a long violet shadow down the roof (dark gold on tile, blue-violet on snow)
  full(castShadow(env, snow.cornice, { push: 30, dx: 7, blur: 13, color: 'rgba(84,62,138,0.72)' }), 'multiply');
  full(castShadow(env, snow.cornice, { push: 9, dx: 2, blur: 5, color: 'rgba(60,34,84,0.5)' }), 'multiply');
  // icicles hanging from the drip lobes
  const r = L.rng('s25ice');
  for (const lb of P.lobes) {
    if (!lb || lb.amp < 15 || !r.chance(0.72)) continue;
    const th = ((lb.j + 1) * PITCH + lb.off) / R;
    const c = P.lut(P.cL, th);
    a.at(g, th, -(c - 7), () => drawIcicle(g, 12 + lb.amp * r.range(0.7, 1.7), r.range(6.5, 11), r));
    if (r.chance(0.45)) { const o = r.range(9, 20) * r.sign(); const th2 = th + o / R; a.at(g, th2, -(P.lut(P.cL, th2) - 7), () => drawIcicle(g, r.range(12, 30), r.range(4.5, 7), r)); }
  }
  full(snow.cornice);
  // warm sunset wash over the crown of the cornice
  g.save(); g.globalCompositeOperation = 'source-atop';
  g.fillStyle = L.radial(g, a.cx, a.cy, R - 30, R + 6, [[0, L.rgba(C.sun, 0)], [0.55, L.rgba(C.sun, 0.2)], [1, L.rgba(C.sun, 0.62)]]);
  a.pathBand(g, 8, -30, -sEdge, sEdge); g.fill();
  g.restore();
  // cut the silhouette: everything above the (gently undulating) top edge goes
  g.save(); g.globalCompositeOperation = 'destination-in';
  g.beginPath(); traceEdge(g, 0);
  g.lineTo(a.pt(sEdge, 0).x + 400, H + PAD + 900); g.lineTo(a.pt(-sEdge, 0).x - 400, H + PAD + 900); g.closePath();
  g.fillStyle = '#000'; g.fill();
  g.restore();
  // the thread of gold light on the very top of the snow
  const rim = L.makeLayer(PAD, (rg) => {
    rg.lineJoin = 'round'; rg.lineCap = 'round';
    rg.strokeStyle = C.sun; rg.lineWidth = 6; rg.beginPath(); traceEdge(rg, -3); rg.stroke();
    rg.strokeStyle = '#fff3d2'; rg.lineWidth = 2.4; rg.beginPath(); traceEdge(rg, -1.5); rg.stroke();
    rg.globalCompositeOperation = 'destination-in';
    rg.drawImage(L.noiseTex(LW, LH, { seed: 's25rim', scale: 120, sx: 1, sy: 30, octaves: 2, res: 0.2, contrast: 1.7, ramp: [[0, 'rgba(0,0,0,0.5)'], [0.5, 'rgba(0,0,0,0.9)'], [1, 'rgba(0,0,0,1)']] }), -PAD, -PAD);
  });
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.drawImage(rim, 0, 0); g.restore();
  const bloom = L.blurred(rim, 9);
  return { roof, bloom };
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
  g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.2;
  g.drawImage(L.noiseTex(W, H, { seed: 's25sky', scale: 460, octaves: 3, res: 0.2 }), 0, 0);
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.5;
  g.drawImage(L.grainTex(W, H, { seed: 's25sky', amount: 0.12, size: 2 }), 0, 0);
  g.globalAlpha = 0.35;
  g.drawImage(L.grainTex(W, H, { seed: 's25sky2', amount: 0.1, size: 1 }), 0, 0);
  return c;
}

export default {
  name: '雪后金瓦',
  tone: 'light',
  init(env) {
    const P = makePlan(env);
    const snow = buildSnow(env, P);
    const { roof, bloom } = buildRoof(env, P, snow);
    S = { sky: buildSky(env), roof, bloom, sparks: snow.sparks };
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
    // snow crystals flashing
    L.cam(ctx, env, { rot }, () => {
      ctx.globalCompositeOperation = 'lighter';
      for (const sp of S.sparks) {
        const k = (env.frame + sp.ph) % 4;
        if (k > 1) continue;
        const q = a.pt(sp.theta, sp.dr), al = k === 0 ? 0.95 : 0.5, rad = 7 * sp.size;
        ctx.fillStyle = L.radial(ctx, q.x, q.y, 0, rad, [[0, L.rgba(sp.warm ? '#ffe9bd' : '#ffffff', al)], [0.25, L.rgba(sp.warm ? '#ffd58c' : '#e6e2ff', al * 0.35)], [1, 'rgba(255,255,255,0)']]);
        ctx.fillRect(q.x - rad, q.y - rad, rad * 2, rad * 2);
        ctx.fillStyle = L.rgba('#ffffff', al);
        ctx.fillRect(q.x - 0.9 * sp.size, q.y - 0.9 * sp.size, 1.8 * sp.size, 1.8 * sp.size);
      }
    });
  },
};
