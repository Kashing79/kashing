// s26 — 青黛. Indigo-naturalis powder rubbed across rough pale-blue handmade paper with a fingertip.
// The arc is the upper edge of the first, heaviest smear: the finger's edge ploughs a thin dark ridge of powder there.
// Below it two more smears follow concentric arcs, each starting thick (near blue-black) and breaking up into
// dry "flying white" and loose specks. Above the arc: nothing but paper.
//
// Everything is rendered once, per pixel, in init():
//   · a paper "tooth" height field (shared by the paper shading and the powder),
//   · for each smear a "load" field in polar coords (u = distance along the arc, d = depth below the smear's top edge);
//     powder only sticks where load beats the tooth → heavy load covers the sheet, light load only dusts the peaks.
// draw() is a single blit with a tiny rotation about the arc centre, so no grain ever flickers.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 64;
const RW = W + PAD * 2, RH = H + PAD * 2;
const UMAX = 1800;                 // half-range of the 1-D lookup tables along the arc (px of arc length)
let S = null;

const sstep = (a, b, v) => { let t = (v - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const hash = (x, y) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

// 起笔 u0 → 收笔 u1 (arc-length px from the crest; negative = left). v0 = depth of the smear's top edge below the arc.
const STROKES = [
  { v0: 0, w: 186, core: 0.62, reach: 1.1, soft: 2, u0: -1650, u1: 2100, a0: 1.06, a1: 0.56, q0: 0.27, q1: 0.72, fw0: 0.07, fw1: 0.3, ridge: 0.5, jit: 1.3, drift: 0, narrow: 0.82, seed: 3.7, grains: 3000 },
  { v0: 274, w: 86, core: 0.45, reach: 1.22, soft: 6, u0: 850, u1: -790, a0: 1.08, a1: 0.5, q0: 0.05, q1: 0.6, fw0: 0.1, fw1: 0.3, ridge: 0.2, jit: 2.2, drift: 8, narrow: 0.74, seed: 19.3, grains: 1500 },
  { v0: 428, w: 124, core: 0.4, reach: 1.2, soft: 9, u0: -640, u1: 1300, a0: 0.8, a1: 0.5, q0: 0.05, q1: 0.6, fw0: 0.16, fw1: 0.3, ridge: 0.1, jit: 3, drift: 10, narrow: 0.82, seed: 41.9, grains: 1000 },
];

function prepStrokes() {
  const nz = L.makeNoise('s26edge');
  return STROKES.map((st) => {
    const dir = st.u1 > st.u0 ? 1 : -1, len = Math.abs(st.u1 - st.u0), n = UMAX * 2 + 2;
    const top = new Float32Array(n), wid = new Float32Array(n), bj = new Float32Array(n), rm = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = i - UMAX, q = L.clamp((dir * (u - st.u0)) / len);
      top[i] = st.v0 + st.drift * nz.n2(u / 620 + st.seed, 3.1) + st.jit * (0.6 * nz.n2(u / 44, st.seed * 1.7) + 0.4 * nz.n2(u / 13, st.seed * 2.9));
      wid[i] = st.w * (1 + 0.15 * nz.n2(u / 340 + st.seed * 3.3, 8.8)) * L.lerp(1, st.narrow, q);
      bj[i] = st.w * (0.13 * nz.n2(u / 170, st.seed + 5) + 0.06 * nz.n2(u / 46, st.seed + 9));
      rm[i] = 0.75 + 0.25 * nz.n2(u / 90, st.seed + 2);
    }
    return { ...st, dir, len, cap: st.w * 0.6, top, wid, bj, rm };
  });
}

/** per-pixel paper + powder → two canvases (RW×RH, origin at −PAD) */
function buildFields(env, strokes) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const nT = L.makeNoise('s26tooth'), nS = L.makeNoise('s26smear');
  const N = RW * RH;

  // 1) paper tooth: coarse handmade-paper grain (pixels of height, roughly −0.8..0.8)
  const T = new Float32Array(N);
  for (let j = 0; j < RH; j++) {
    const y = j - PAD;
    for (let i = 0; i < RW; i++) {
      const x = i - PAD;
      T[j * RW + i] = 0.5 * nT.n2(x / 4.2, y / 4.2) + 0.36 * nT.n2(x / 10 + 31.7, y / 10 - 17.3) + 0.22 * nT.n2(x / 27 - 5.1, y / 27 + 44.2) + 0.3 * (hash(i, j) - 0.5);
    }
  }

  // powder colour by amount: pale trace → 青黛 → 浓靛 → near blue-black
  const ramp = L.makeRamp([[0, '#5d88d6'], [0.25, '#2a5cc4'], [0.5, '#1f4fb8'], [0.68, '#1a3f9c'], [0.82, '#142a6e'], [0.93, '#101a56'], [1, '#0d1240']]);
  const NL = 512, lut = new Float32Array(NL * 3);
  for (let i = 0; i < NL; i++) { const c = ramp(i / (NL - 1)); lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2]; }
  const ST = [95, 138, 214];       // the soft stain a rubbed finger leaves in the fibres

  const paper = new ImageData(RW, RH), pd = paper.data;
  const powder = new ImageData(RW, RH), wd = powder.data;
  for (let j = 0; j < RH; j++) {
    const y = j - PAD, ddy = cy - y, jm = j > 0 ? RW : 0, jp = j < RH - 1 ? RW : 0;
    for (let i = 0; i < RW; i++) {
      const k = j * RW + i, o = k * 4, t = T[k];
      // paper: raking light from the upper left across the tooth
      const gx = T[k + (i < RW - 1 ? 1 : 0)] - T[k - (i > 0 ? 1 : 0)], gy = T[k + jp] - T[k - jm];
      let e = (gx + gy) * 0.1 + t * 0.022; e = e < -0.2 ? -0.2 : e > 0.12 ? 0.12 : e;
      pd[o] = 169 * (1 + 1.25 * e); pd[o + 1] = 200 * (1 + e); pd[o + 2] = 234 * (1 + 0.6 * e); pd[o + 3] = 255;

      // powder
      const ddx = i - PAD - cx, rr = Math.sqrt(ddx * ddx + ddy * ddy), v = R - rr;
      if (v < -6) continue;
      const u = Math.atan2(ddx, ddy) * R, fi = u + UMAX;
      if (fi < 0 || fi >= UMAX * 2) continue;
      const i0 = fi | 0, f = fi - i0;
      let load = 0, haze = 0;
      for (let n = 0; n < strokes.length; n++) {
        const st = strokes[n];
        if (v < st.v0 - 24 || v > st.v0 + st.w * (st.reach + 0.5) + 20) continue;
        const s = st.dir * (u - st.u0);
        if (s < -6 || s > st.len * 1.16) continue;
        const q = s / st.len;
        const top = st.top[i0] + (st.top[i0 + 1] - st.top[i0]) * f, w = st.wid[i0] + (st.wid[i0 + 1] - st.wid[i0]) * f;
        const d = v - top;
        let dTop = d, capB = 1;
        if (s < st.cap) {            // the fingertip lands: a rounded, soft-edged start
          const c = 1 - s / st.cap, hh = 0.5 * w * Math.sqrt(c < 1 ? 1 - c * c : 0) + 4 * nS.n2(d / 11, st.seed + 61.3);
          dTop = d - (0.5 * w - hh); capB = sstep(-10, 16, 0.5 * w + hh - d) * sstep(-4, 0.6 * st.cap, s + 9 * nS.n2(d / 9, st.seed + 71.7));
        }
        if (dTop < -st.soft) continue;
        const eTop = sstep(-0.8 * st.soft, 1.2 * st.soft, dTop);
        const db = d + st.bj[i0];
        const hz = (1 - sstep(st.core * w, (st.reach + 0.2) * w, db)) * capB;      // how far the finger pad dragged at all
        if (hz <= 0) continue;
        const fall = (1 - sstep(st.core * w, st.reach * w, db)) * capB;            // pressure dies away toward the lower side
        const band = 0.5 + 0.5 * nS.n2(u / 420 + st.seed, d / 30 + st.seed);        // broad pressure bands
        const sa = nS.n2(u / 210 + st.seed * 2.1, d / 6.5 + 7.7);                   // soft striations dragged by the finger
        const sb = nS.n2(u / 90 - st.seed, d / 2.7 + 3.3);
        const cl = nS.n2(u / 30 + 11.1, d / 30 - st.seed);                          // isotropic clumps: what is left when the load runs out
        const A = st.a0 + (st.a1 - st.a0) * sstep(st.q0, st.q1, q);
        const qc = q < 0 ? 0 : q > 1 ? 1 : q, fw = st.fw0 + (st.fw1 - st.fw0) * qc, eT = sstep(0.55, 1, qc) * 0.85;
        const qe = 1 + 0.08 * nS.n2(d / 16, st.seed + 13.1);
        const endF = 1 - sstep(qe - 0.3, qe, q);
        let ld = A * (0.8 + 0.2 * band) + fw * ((0.68 * sa + 0.32 * sb) * (1 - eT) + cl * eT * 1.2);
        ld += 0.3 * Math.exp(-Math.max(0, s) / (st.w * 1.5));                       // 起笔: powder lies thickest
        ld = ld * fall + st.ridge * st.rm[i0] * Math.exp(-(dTop - 6) * (dTop - 6) / 72);   // + ridge ploughed up along the top edge
        ld *= eTop * endF;                                                          // 收笔: thinning to specks
        if (ld > load) load = ld;
        const h2 = hz * eTop * (1 - sstep(qe - 0.2, qe + 0.06, q)) * Math.min(1, A + 0.25);
        if (h2 > haze) haze = h2;
      }
      if (haze < 0.01 && load < 0.02) continue;
      const cov = sstep(-0.19, 0.19, (load - 0.5) * 1.55 + t) * sstep(0.02, 0.1, load);
      const alpha = cov * (0.66 + 0.34 * sstep(0.15, 0.6, load));
      const stain = 0.4 * sstep(0.02, 0.75, haze) * (0.86 + 0.28 * t);
      const A2 = alpha + stain * (1 - alpha);
      if (A2 <= 0.003) continue;
      let m = (load + 0.22 * t) / 1.3; m = m < 0 ? 0 : m > 1 ? 1 : m;
      const li = ((m * (NL - 1)) | 0) * 3, tex = 1 + 0.08 * t + 0.07 * (hash(i + 7919, j + 104729) - 0.5);
      const ws = stain * (1 - alpha) / A2, wp = alpha / A2;
      wd[o] = ST[0] * ws + lut[li] * tex * wp; wd[o + 1] = ST[1] * ws + lut[li + 1] * tex * wp; wd[o + 2] = ST[2] * ws + lut[li + 2] * tex * wp;
      wd[o + 3] = A2 * 255;
    }
  }
  const pc = L.makeCanvas(RW, RH); pc.getContext('2d').putImageData(paper, 0, 0);
  const wc = L.makeCanvas(RW, RH); wc.getContext('2d').putImageData(powder, 0, 0);
  return { paper: pc, powder: wc };
}

/** fibres and flecks pressed into the sheet (kept faint over the tagline zone) */
function drawFibres(g, a) {
  const r = L.rng('s26fibre');
  const quiet = (x, y) => x > 580 && x < 1340 && y > a.crestY - 310 && y < a.crestY + 20;
  g.save(); g.lineCap = 'round';
  for (let i = 0; i < 640; i++) {
    const x = r.range(-PAD, W + PAD), y = r.range(-PAD, H + PAD);
    const long = r.chance(0.07), len = long ? r.range(70, 150) : r.range(6, 34), ang = r.range(0, Math.PI), kind = r();
    const b1 = r.range(-0.45, 0.45), b2 = r.chance(0.4) ? -b1 * r.range(0.4, 1.2) : b1 * r.range(0.3, 1.4);
    const k = quiet(x, y) ? 0.4 : 1;
    let col, lw;
    if (kind < 0.4) { col = L.rgba('#4673c2', r.range(0.3, 0.65) * k); lw = r.range(0.6, 1.2); }
    else if (kind < 0.8) { col = L.rgba('#f3f8ff', r.range(0.3, 0.8) * k); lw = r.range(0.5, 1.3); }
    else { col = L.rgba('#1d3f96', r.range(0.38, 0.8) * k); lw = r.range(0.6, 1.3); }
    if (long) lw *= 0.8;
    const cx = Math.cos(ang), cy = Math.sin(ang);
    g.strokeStyle = col; g.lineWidth = lw;
    g.beginPath(); g.moveTo(x, y);
    g.bezierCurveTo(x + cx * len * 0.33 - cy * len * b1, y + cy * len * 0.33 + cx * len * b1, x + cx * len * 0.66 - cy * len * b2, y + cy * len * 0.66 + cx * len * b2, x + cx * len, y + cy * len);
    g.stroke();
  }
  g.restore();
  L.speckle(g, { seed: 's26fleck', count: 900, x: -PAD, y: -PAD, w: RW, h: RH, rMin: 0.5, rMax: 1.7, colors: ['#2f58ad', '#1d3f96', '#4a78c8'], alpha: [0.18, 0.6], test: (x, y) => !quiet(x, y) || hash(x | 0, y | 0) < 0.4 });
  L.speckle(g, { seed: 's26pale', count: 500, x: -PAD, y: -PAD, w: RW, h: RH, rMin: 0.5, rMax: 1.6, colors: ['#f4f9ff', '#dcebfb'], alpha: [0.2, 0.6] });
  L.speckle(g, { seed: 's26bark', count: 26, x: -PAD, y: -PAD, w: RW, h: RH, rMin: 1.6, rMax: 3.2, colors: ['#1d3f96', '#24489c'], alpha: [0.45, 0.8], squash: 0.6, test: (x, y) => !quiet(x, y) });
}

/** loose grains shed along the lower edge of each smear and around its dissolving end */
function drawGrains(g, a, strokes) {
  const r = L.rng('s26grain');
  const cols = ['#142a6e', '#1f4fb8', '#19388c', '#0f2058'];
  g.save();
  for (const st of strokes) {
    for (let n = 0; n < st.grains; n++) {
      const mode = r();
      let s = r() * st.len * 1.04;
      if (mode >= 0.9) s = st.len * r.range(0.8, 1.1);
      const q = L.clamp(s / st.len), A = st.a0 + (st.a1 - st.a0) * sstep(st.q0, st.q1, q);
      const pick = r(), rad = 0.5 + 1.9 * Math.pow(r(), 3), al = r.range(0.45, 0.95), col = r.pick(cols), g1 = Math.abs(r.gauss()), g2 = r();
      if (pick > A * 0.95 + 0.1) continue;
      const u = st.u0 + st.dir * s;
      if (u < -UMAX + 2 || u > UMAX - 2) continue;
      const ui = Math.round(u + UMAX), w = st.wid[ui];
      let dd;
      if (mode < 0.7) dd = w * (st.core + (st.reach - st.core) * (0.45 + 0.75 * g2)) - st.bj[ui] + g1 * 14 - 4;
      else if (mode < 0.82) dd = w * (st.core + (st.reach - st.core) * g2 * 0.6) - st.bj[ui];
      else if (mode < 0.9) dd = -1.5 - st.soft * 0.5 - g1 * 6;
      else dd = -6 + (w * st.reach + 12) * g2;
      const th = u / a.R, rr = a.R - (st.top[ui] + dd), x = a.cx + rr * Math.sin(th), y = a.cy - rr * Math.cos(th);
      if (dd < 0 && st.v0 === 0 && Math.abs(x - a.cx) < 440) continue;       // nothing strays into the tagline zone
      g.globalAlpha = al; g.fillStyle = col;
      g.beginPath(); g.arc(x, y, rad, 0, L.TAU); g.fill();
    }
  }
  // a puff of loose powder where each fingertip landed
  for (const st of strokes) {
    if (Math.abs(st.u0) > 1100) continue;
    for (let n = 0; n < 190; n++) {
      const s = r.gauss() * st.cap * 0.55 - st.cap * 0.1, u = st.u0 + st.dir * s, ui = Math.round(u + UMAX);
      const dd = st.wid[ui] * (0.5 + 0.62 * r.gauss()), rad = 0.5 + 1.8 * Math.pow(r(), 3);
      const th = u / a.R, rr = a.R - (st.top[ui] + dd);
      g.globalAlpha = r.range(0.45, 0.95); g.fillStyle = r.pick(cols);
      g.beginPath(); g.arc(a.cx + rr * Math.sin(th), a.cy - rr * Math.cos(th), rad, 0, L.TAU); g.fill();
    }
  }
  g.restore();
}

/** the little heap that never got rubbed out: a lit height field, drawn in its own tangent frame */
function buildHeap(th) {
  const K = 1.3, HW = 390, HH = 234, mx = HW / 2, my = HH / 2;
  const nz = L.makeNoise('s26heap');
  const G = (x, y, sx, sy) => Math.exp(-(x * x) / (sx * sx) - (y * y) / (sy * sy));
  const hf = new Float32Array(HW * HH);
  for (let j = 0; j < HH; j++) for (let i = 0; i < HW; i++) {
    const x = (i - mx) / K, y = (j - my) / K;
    let h = G(x + 4, y - 1, 44, 24) + 0.8 * G(x - 34, y - 9, 28, 17) + 0.66 * G(x + 46, y + 8, 27, 16) + 0.42 * G(x - 66, y + 9, 19, 11) + 0.4 * G(x - 6, y + 19, 30, 10) + 0.32 * G(x + 78, y - 2, 13, 9);
    h *= 1 + 0.34 * nz.fbm(x / 21, y / 21, 3);
    h += (0.06 * nz.fbm(i / 9 + 9, j / 9, 2) + 0.012 * nz.n2(i / 2.4, j / 2.4)) * sstep(0.05, 0.3, h);
    hf[j * HW + i] = h;
  }
  // light from the upper left, rotated into the heap's frame
  const gx0 = -0.6, gy0 = -0.62, lz = 0.5, c = Math.cos(-th), s = Math.sin(-th);
  const lx = gx0 * c - gy0 * s, ly = gx0 * s + gy0 * c;
  const ramp = L.makeRamp([[0, '#050a26'], [0.28, '#0b184c'], [0.5, '#142c74'], [0.72, '#2350b4'], [1, '#4a7de0']]);
  const img = new ImageData(HW, HH), d = img.data;
  for (let j = 1; j < HH - 1; j++) for (let i = 1; i < HW - 1; i++) {
    const k = j * HW + i, h = hf[k];
    const al = sstep(0.12, 0.2, h + 0.09 * nz.n2(i / 7, j / 7 + 40) + 0.05 * nz.n2(i / 2.4 + 9, j / 2.4));
    if (al <= 0) continue;
    const hx = (hf[k + 1] - hf[k - 1]) * 0.5 * 30 * K, hy = (hf[k + HW] - hf[k - HW]) * 0.5 * 30 * K;
    const inv = 1 / Math.sqrt(hx * hx + hy * hy + 1);
    let dif = (-hx * lx - hy * ly + lz) * inv; dif = dif < 0 ? 0 : dif;
    const col = ramp(L.clamp(dif * 0.98 + 0.035 * (hash(i, j) - 0.5)));
    const o = k * 4; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = al * 255;
  }
  const cnv = L.makeCanvas(HW, HH); cnv.getContext('2d').putImageData(img, 0, 0);
  // cast shadow: the heap's own silhouette, softened
  const M = 40, sh = L.makeCanvas(HW + M * 2, HH + M * 2), sg = sh.getContext('2d');
  sg.drawImage(cnv, M, M); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#0a1a5a'; sg.fillRect(0, 0, sh.width, sh.height);
  return { cnv, shadow: L.blurred(sh, 9), contact: L.blurred(sh, 3), HW, HH, M };
}

function buildLayer(env) {
  const a = env.arc;
  const strokes = prepStrokes();
  const f = buildFields(env, strokes);
  return L.makeLayer(PAD, (g) => {
    g.drawImage(f.paper, -PAD, -PAD);
    // slow cloudiness of the pulp
    g.save(); g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.11;
    g.drawImage(L.noiseTex(RW, RH, { seed: 's26pulp', scale: 260, octaves: 4, res: 0.1, contrast: 1.3 }), -PAD, -PAD);
    g.restore();
    drawFibres(g, a);
    g.drawImage(f.powder, -PAD, -PAD);
    drawGrains(g, a, strokes);

    // the heap: pushed aside at the lower edge of the heaviest smear, left of centre
    const st = strokes[0], hu = -560, ui = Math.round(hu + UMAX), th = hu / a.R;
    const hp = a.pt(th, -(st.top[ui] + st.wid[ui] * 0.9));
    const heap = buildHeap(th);
    g.save(); g.globalCompositeOperation = 'multiply';
    g.translate(hp.x + 14, hp.y + 16); g.rotate(th); g.globalAlpha = 0.62;
    g.drawImage(heap.shadow, -heap.HW / 2 - heap.M, -heap.HH / 2 - heap.M);
    g.restore();
    g.save(); g.globalCompositeOperation = 'multiply';
    g.translate(hp.x + 4, hp.y + 5); g.rotate(th); g.globalAlpha = 0.6;
    g.drawImage(heap.contact, -heap.HW / 2 - heap.M, -heap.HH / 2 - heap.M);
    g.restore();
    g.save(); g.translate(hp.x, hp.y); g.rotate(th); g.drawImage(heap.cnv, -heap.HW / 2, -heap.HH / 2); g.restore();
    // crumbs that rolled off it
    const r = L.rng('s26crumb');
    for (let i = 0; i < 54; i++) {
      const ox = r.gauss() * 135, oy = r.gauss() * 36 + 24, rad = 1.5 + 3.4 * Math.pow(r(), 2.2);
      const x = hp.x + ox * Math.cos(th) - oy * Math.sin(th), y = hp.y + ox * Math.sin(th) + oy * Math.cos(th);
      g.fillStyle = 'rgba(10,26,90,0.38)'; g.beginPath(); g.ellipse(x + rad * 0.7, y + rad * 0.8, rad * 1.15, rad * 0.9, 0.6, 0, L.TAU); g.fill();
      g.fillStyle = r.pick(['#10225f', '#142a6e', '#0d1c52']); g.beginPath(); g.ellipse(x, y, rad, rad * r.range(0.72, 1), r.range(0, 3), 0, L.TAU); g.fill();
      g.fillStyle = 'rgba(58,108,210,0.7)'; g.beginPath(); g.arc(x - rad * 0.3, y - rad * 0.34, rad * 0.45, 0, L.TAU); g.fill();
    }

    // one soft window light over the whole sheet
    g.save(); g.globalCompositeOperation = 'soft-light';
    g.fillStyle = L.linear(g, 0, -PAD, W, H + PAD, [[0, 'rgba(255,255,255,0.14)'], [0.5, 'rgba(255,255,255,0)'], [0.5, 'rgba(0,16,80,0)'], [1, 'rgba(0,16,80,0.16)']]);
    g.fillRect(-PAD, -PAD, RW, RH);
    g.restore();
  });
}

export default {
  name: '青黛',
  tone: 'dark',
  init(env) {
    S = { layer: buildLayer(env) };
  },
  draw(ctx, env, p) {
    ctx.fillStyle = '#a9c8ea'; ctx.fillRect(0, 0, W, H);
    // the sheet slides a hair along the arc; every grain stays where it fell
    L.blit(ctx, env, S.layer, { rot: L.lerp(-0.0055, 0.0055, p) });
  },
};
