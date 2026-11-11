// s08 — 青铜鼎X光片. A conservation-lab radiograph of a bronze round ding (圆鼎), black / white / grey only.
// The arc is the outer outline of the vessel's rim: the thick lip prints as the brightest band on the film.
// Below it the belly is translucent — cloudy density, clusters of casting pores (small dark bubbles), a few crisp
// little squares (垫片, spacers), two thin bright mould seams (范线) and the whiter mass of a foot root showing through.
// Above the arc: clean film black, with one upright ear (立耳) standing on the rim at either side.
//
// Everything is computed once in init() as a "thickness" field T (how much metal the beam crosses), then run through a
// film curve → cold grey ramp. draw() only blits the plate, sweeps a soft scan band across the belly and jitters the grain.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 48;
const RIM = 58;            // width of the rim band on the film (px)
const EAR_TH = 0.355;      // the two ears stand at ±EAR_TH along the arc (well clear of the crest)
const EAR_H = 294;
const BG = '#050607';
let S = null;

const sstep = (a, b, v) => { const t = L.clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/** polyline of an arch (∩): up the left side, round the two top corners, down the right side */
function archPts(hw0, hw1, ht, rr, yb) {
  const pts = [], q = Math.PI / 2;
  for (let i = 0; i <= 12; i++) pts.push([L.lerp(-hw0, -hw1, i / 12), L.lerp(yb, -ht + rr, i / 12)]);
  for (let i = 1; i <= 10; i++) { const an = Math.PI + (i / 10) * q; pts.push([-hw1 + rr + Math.cos(an) * rr, -ht + rr + Math.sin(an) * rr]); }
  for (let i = 1; i <= 6; i++) pts.push([L.lerp(-hw1 + rr, hw1 - rr, i / 7), -ht]);
  for (let i = 0; i <= 10; i++) { const an = -q + (i / 10) * q; pts.push([hw1 - rr + Math.cos(an) * rr, -ht + rr + Math.sin(an) * rr]); }
  for (let i = 1; i <= 12; i++) pts.push([L.lerp(hw1, hw0, i / 12), L.lerp(-ht + rr, yb, i / 12)]);
  return pts;
}
/**
 * one upright ear: a thick arch standing on the rim, leaning slightly outward. Drawn in frame coords.
 * The outline is a hand-made casting, so it wanders by a few px. `lift` slides the shape outward: drawing it twice
 * (near face + far face of the slab) lets the overlap print denser than the single-thickness fringe.
 */
function earPath(g, a, s, lift) {
  const th = s * EAR_TH, p = a.pt(th, 0), nz = L.makeNoise('s08ear' + s);
  g.save(); g.translate(p.x, p.y); g.rotate(th * 0.5); g.translate(0, -lift);
  const ht = EAR_H, yb = 130;
  const wob = (pts, seed, amp) => L.smoothPath(pts.map(([x, y], i) => {
    const dx = x, dy = y + ht * 0.5, m = Math.hypot(dx, dy) || 1;
    const k = y > 0 ? 0 : amp * (nz.n2(i * 0.12, seed) + 0.4 * nz.n2(i * 0.47, seed + 5));
    return [x + (dx / m) * k, y + (dy / m) * k];
  }), 5);
  const outer = wob(archPts(156, 149, ht, 92, yb), 1.7, 2.5);
  const inner = wob(archPts(68, 62, ht - 90, 44, yb), 9.3, 2.1);
  g.beginPath();
  outer.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath();
  inner.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath();
  g.fill('evenodd');
  g.restore();
}
/** ear-local point → frame coords */
function earPt(a, s, lx, ly) {
  const th = s * EAR_TH, p = a.pt(th, 0), t = th * 0.5, c = Math.cos(t), sn = Math.sin(t);
  return [p.x + lx * c - ly * sn, p.y + lx * sn + ly * c];
}

function buildPlate(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const X0 = -PAD, Y0 = Math.max(-PAD, Math.floor(a.pt(EAR_TH, 0).y - EAR_H - 70));
  const RW = W + PAD * 2, RH = H + PAD - Y0;
  const nA = L.makeNoise('s08a'), nB = L.makeNoise('s08b');
  const toXY = (th, d) => [cx + (R - d) * Math.sin(th), cy - (R - d) * Math.cos(th)];
  const mk = () => { const c = L.makeCanvas(RW, RH); const g = c.getContext('2d', { willReadFrequently: true }); g.translate(-X0, -Y0); return [c, g]; };

  // ── ears: crisp mask + a blurred copy (≈ distance from the edge → rounded cross-section) ──
  const [cEar, gE] = mk();
  gE.save(); a.clipAbove(gE, -RIM + 5); gE.globalCompositeOperation = 'lighter'; gE.fillStyle = 'rgba(255,255,255,0.5)';
  for (const s of [-1, 1]) { earPath(gE, a, s, 0); earPath(gE, a, s, 17); }
  gE.restore();
  const earD = gE.getImageData(0, 0, RW, RH).data;                        // alpha: 0.5 = one face of the slab, 1 = both
  const softD = L.blurred(cEar, 9).getContext('2d').getImageData(0, 0, RW, RH).data;

  // ── marks canvas. R = sharp losses (pores, spacer outlines) · G = sharp gains (seams, spacers, string lines) · B = soft losses ──
  const [cM, gM] = mk();
  gM.fillStyle = '#000'; gM.fillRect(X0, Y0, RW, RH);
  gM.globalCompositeOperation = 'lighter';

  // spacers (垫片): small, crisp, slightly irregular squares set in the wall
  const SPACERS = [
    { th: -0.342, d: 236, s: 42, lite: 1, rot: 0.32 }, { th: -0.092, d: 372, s: 38, lite: -1, rot: -0.2 },
    { th: 0.118, d: 432, s: 46, lite: 1, rot: 0.55 }, { th: 0.322, d: 300, s: 40, lite: 1, rot: -0.42 },
    { th: 0.452, d: 188, s: 36, lite: -1, rot: 0.12 },
  ].map((q) => { const [x, y] = toXY(q.th, q.d); return { ...q, x, y }; });

  // mould seams (范线): run down the wall toward the feet
  const SEAMS = [-0.182, 0.238];
  const FEET = [
    { x: toXY(SEAMS[0], 500)[0], y: toXY(SEAMS[0], 500)[1], r: 246, amp: 0.2, ring: 0.1, core: 0.08 },
    { x: toXY(SEAMS[1], 665)[0], y: toXY(SEAMS[1], 665)[1], r: 252, amp: 0.19, ring: 0.1, core: 0.07 },
  ];

  // pore clusters (th, depth below the arc, spread along / across, count, radius range, tilt)
  const CLUSTERS = [
    { th: 0.05, d: 214, su: 285, sd: 56, n: 430, r0: 2.6, r1: 26, tilt: -0.06 },   // the big spongy band under the rim
    { th: -0.345, d: 392, su: 120, sd: 74, n: 120, r0: 2.2, r1: 15, tilt: 0.5 },
    { th: 0.39, d: 150, su: 125, sd: 44, n: 100, r0: 2.2, r1: 13, tilt: 0.2 },
    { th: 0.225, d: 468, su: 105, sd: 66, n: 90, r0: 2.2, r1: 16, tilt: -0.4 },
    { th: -0.045, d: 500, su: 95, sd: 52, n: 60, r0: 2, r1: 11, tilt: 0.1 },
    { th: -0.46, d: 150, su: 80, sd: 36, n: 50, r0: 2, r1: 9, tilt: -0.3 },
  ];
  const rp = L.rng('s08pores');
  const pores = [];
  const clearOfSpacers = (x, y, rad) => SPACERS.every((q) => Math.hypot(q.x - x, q.y - y) > q.s * 0.86 + rad);
  for (const c of CLUSTERS) {
    const own = [];
    let tries = 0;
    const ct = Math.cos(c.tilt), st = Math.sin(c.tilt);
    while (own.length < c.n && tries++ < c.n * 26) {
      const gu = rp.gauss(), gv = rp.gauss();
      if (Math.abs(gu) > 2.3 || Math.abs(gv) > 2.3) continue;
      const u = gu * c.su, v = gv * c.sd;
      const d = c.d + u * st + v * ct; if (d < 9) continue;
      const heart = Math.exp(-(gu * gu + gv * gv) * 0.4);          // the biggest voids sit at the heart of a cluster
      const rad = c.r0 + (c.r1 - c.r0) * Math.pow(rp(), 2.3) * (0.3 + 0.7 * heart);
      const [x, y] = toXY(c.th + (u * ct - v * st) / R, d);
      if (!clearOfSpacers(x, y, rad)) continue;
      let ok = true;
      for (const q of own) { if (Math.hypot(q.x - x, q.y - y) < (q.r + rad) * 0.94 + 1.6) { ok = false; break; } }
      if (ok) own.push({ x, y, r: rad, k: rp.range(0.55, 1) });
    }
    for (const q of own) pores.push(q);
    // a spongy zone is a little less dense overall
    const [hx, hy] = toXY(c.th, c.d);
    gM.save(); gM.translate(hx, hy); gM.rotate(c.th + c.tilt); gM.scale(c.su * 1.55, c.sd * 1.9);
    gM.fillStyle = L.radial(gM, 0, 0, 0, 1, [[0, 'rgba(0,0,255,0.6)'], [0.5, 'rgba(0,0,255,0.34)'], [1, 'rgba(0,0,255,0)']]);
    gM.beginPath(); gM.arc(0, 0, 1, 0, L.TAU); gM.fill(); gM.restore();
  }
  // stray single pores all over the wall
  const span = a.span(PAD + 10);
  for (let i = 0; i < 380; i++) {
    const [x, y] = toXY(rp.range(-span, span), rp.range(RIM + 10, 760));
    const rad = 1.4 + 4.6 * Math.pow(rp(), 2.4);
    if (clearOfSpacers(x, y, rad)) pores.push({ x, y, r: rad, k: rp.range(0.5, 1) });
  }
  // a few in the rim and in the thick ears (shrinkage gathers in heavy sections)
  for (let i = 0; i < 46; i++) { const [x, y] = toXY(rp.range(-span, span), rp.range(8, RIM - 8)); pores.push({ x, y, r: 1.3 + 3.4 * Math.pow(rp(), 2), k: 0.8 }); }
  for (const s of [-1, 1]) {
    for (let i = 0; i < 30; i++) {
      const top = rp.chance(0.6);
      const lx = top ? rp.gauss() * 46 + s * 18 : (rp.chance(0.5) ? -1 : 1) * 104 + rp.gauss() * 13;
      const ly = top ? -EAR_H + 44 + rp.gauss() * 15 : -rp.range(40, 220);
      const [x, y] = earPt(a, s, lx, ly);
      pores.push({ x, y, r: 1.6 + 6.5 * Math.pow(rp(), 2.6), k: rp.range(0.5, 0.95) });
    }
  }
  for (const q of pores) {
    const k = Math.min(1, 0.26 + q.r / 15) * q.k;  // a bigger void removes more metal → prints darker
    const gr = gM.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.r);
    gr.addColorStop(0, `rgba(255,0,0,${k})`); gr.addColorStop(0.6, `rgba(255,0,0,${k * 0.9})`);
    gr.addColorStop(0.86, `rgba(255,0,0,${k * 0.62})`); gr.addColorStop(0.96, `rgba(255,0,0,${k * 0.3})`); gr.addColorStop(1, 'rgba(255,0,0,0)');
    gM.fillStyle = gr; gM.beginPath(); gM.arc(q.x, q.y, q.r, 0, L.TAU); gM.fill();
  }
  // the far wall, superimposed: the same kind of voids, but fainter and softer
  for (let i = 0; i < 170; i++) {
    const [x, y] = toXY(rp.range(-span, span), rp.range(RIM + 30, 800));
    const rad = 7 + 26 * Math.pow(rp(), 1.8), al = rp.range(0.3, 0.75);
    gM.fillStyle = L.radial(gM, x, y, 0, rad, [[0, `rgba(0,0,255,${al})`], [0.55, `rgba(0,0,255,${al * 0.7})`], [1, 'rgba(0,0,255,0)']]);
    gM.beginPath(); gM.arc(x, y, rad, 0, L.TAU); gM.fill();
  }
  // tiny dense specks scattered through the metal
  for (let i = 0; i < 150; i++) {
    const [x, y] = toXY(rp.range(-span, span), rp.range(RIM + 12, 800));
    gM.fillStyle = `rgba(0,255,0,${rp.range(0.3, 0.8)})`; gM.beginPath(); gM.arc(x, y, 0.9 + 1.9 * Math.pow(rp(), 2), 0, L.TAU); gM.fill();
  }
  // spacers
  const rs = L.rng('s08spacer');
  gM.lineJoin = 'miter';
  for (const q of SPACERS) {
    const h = q.s / 2, ang = q.th + q.rot;
    const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([ux, uy]) => {
      const lx = ux * h * rs.range(0.86, 1.12), ly = uy * h * rs.range(0.86, 1.12);
      return [q.x + lx * Math.cos(ang) - ly * Math.sin(ang), q.y + lx * Math.sin(ang) + ly * Math.cos(ang)];
    });
    gM.beginPath(); pts.forEach((p, i) => (i ? gM.lineTo(p[0], p[1]) : gM.moveTo(p[0], p[1]))); gM.closePath();
    gM.fillStyle = q.lite > 0 ? 'rgba(0,255,0,0.56)' : 'rgba(255,0,0,0.26)'; gM.fill();
    gM.strokeStyle = 'rgba(255,0,0,0.62)'; gM.lineWidth = 2; gM.stroke();
  }
  // seams: a thin raised fin of extra metal, not quite straight
  gM.lineCap = 'round'; gM.lineJoin = 'round';
  SEAMS.forEach((th0, si) => {
    const pts = [];
    for (let d = RIM + 5; d < 900; d += 14) {
      const off = 4.2 * nA.n2(d / 170, 5 + si * 9) + 1.3 * nA.n2(d / 38, 21 + si * 3);
      pts.push(toXY(th0 + off / R, d));
    }
    const run = (w, al) => { gM.strokeStyle = `rgba(0,255,0,${al})`; gM.lineWidth = w; gM.beginPath(); pts.forEach((p, i) => (i ? gM.lineTo(p[0], p[1]) : gM.moveTo(p[0], p[1]))); gM.stroke(); };
    run(11, 0.12); run(3.4, 0.82);
  });
  // two raised string lines (弦纹) running round the wall below the rim
  gM.strokeStyle = 'rgba(0,255,0,0.34)'; gM.lineWidth = 6; a.stroke(gM, -(RIM + 84)); a.stroke(gM, -(RIM + 108));
  const mD = gM.getImageData(0, 0, RW, RH).data;

  // ── slow fields on a coarse grid: wall thickness, cloudy density, foot roots, the wall seen edge-on under the rim ──
  const CS = 3, cw = Math.ceil(RW / CS) + 2, ch = Math.ceil(RH / CS) + 2;
  const cT = new Float32Array(cw * ch);
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const x = X0 + i * CS, y = Y0 + j * CS, ddx = x - cx, ddy = cy - y;
    const d = R - Math.hypot(ddx, ddy), th = Math.atan2(ddx, ddy);
    const wx = nA.fbm(x / 520 + 3.1, y / 520 - 7.7, 3), wy = nA.fbm(x / 520 - 12.9, y / 520 + 5.3, 3);
    const n = nB.fbm(x / 330 + wx * 1.2, y / 330 + wy * 1.2, 5, 2, 0.56) * 0.5 + 0.5;
    const cl = 0.8 * sstep(0.24, 0.78, n) + 0.2 * (nA.fbm(x / 110 - 5, y / 110 + 60, 3) * 0.5 + 0.5);
    const big = nA.fbm(x / 760 + 40, y / 760 + 11, 2);
    let T = 0.25 + 0.46 * cl + 0.21 * big;
    T -= 0.07 * sstep(160, 620, d);                                   // deeper down we look straight through two thin walls
    T += 0.13 * Math.exp(-Math.max(0, d - RIM) / 60) + 0.1 * Math.exp(-Math.max(0, d - RIM) / 220);   // under the rim the far wall is seen edge-on
    for (const s of [-1, 1]) { const u = (th - s * EAR_TH) * R / 150; T += 0.13 * Math.exp(-u * u) * Math.exp(-Math.max(0, d - RIM) / 70); }
    for (const f of FEET) {
      const rho = Math.hypot(x - f.x, (y - f.y) / 0.84) / f.r;
      if (rho < 1.2) { const e = (rho - 0.9) / 0.055; T += f.amp * sstep(1.01, 0.95, rho) + f.ring * Math.exp(-e * e) - f.core * sstep(0.7, 0.36, rho); }
    }
    cT[j * cw + i] = T;
  }
  const bil = (i, j) => {
    const fx = i / CS, fy = j / CS, i0 = fx | 0, j0 = fy | 0, tx = fx - i0, ty = fy - j0, k = j0 * cw + i0;
    const a0 = cT[k], a1 = cT[k + 1], b0 = cT[k + cw], b1 = cT[k + cw + 1];
    return (a0 + (a1 - a0) * tx) * (1 - ty) + (b0 + (b1 - b0) * tx) * ty;
  };

  // ── film curve + cold grey ramp ──
  const ramp = L.makeRamp([[0, BG], [0.18, '#2c3133'], [0.5, '#8a9294'], [0.86, '#e8ecec'], [1, '#f7fbfb']]);
  const NL = 2048, LUT = new Uint8Array(NL * 3);
  for (let i = 0; i < NL; i++) {
    let v = L.clamp((i / (NL - 1)) * 1.2 / 1.08); v = L.lerp(v, v * v * (3 - 2 * v), 0.6);
    const c = ramp(v); LUT[i * 3] = c[0]; LUT[i * 3 + 1] = c[1]; LUT[i * 3 + 2] = c[2];
  }

  const out = new ImageData(RW, RH), o = out.data;
  for (let j = 0; j < RH; j++) {
    const y = Y0 + j, ddy = cy - y;
    for (let i = 0; i < RW; i++) {
      const k4 = (j * RW + i) * 4, x = X0 + i, ddx = x - cx;
      const d = R - Math.sqrt(ddx * ddx + ddy * ddy);
      const et = earD[k4 + 3] / 255, ea = et >= 0.5 ? 1 : et * 2;
      const cov = d <= -0.5 ? 0 : d >= 0.5 ? 1 : d + 0.5;
      let T = 0;
      if (cov > 0 || ea > 0) {
        const sm = bil(i, j);
        const fine = 0.5 * nA.n2(x / 7.5, y / 7.5) + 0.3 * nB.n2(x / 2.7 + 9, y / 2.7) + 0.5 * nB.n2(x / 23, y / 23 + 40);
        let Tb = 0;
        if (cov > 0) {
          if (d < RIM + 9) {
            // the lip: its flat top face (brightest) and, inside it, the thickness of the lip seen at a slant
            const along = 0.03 * nB.n2(Math.atan2(ddx, ddy) * R / 240, 3.3);
            let rim = L.lerp(1.09, 0.8, sstep(34, 38, d)) + along - 0.07 * (1 - sstep(0, 4.5, d));
            rim *= 1 + 0.03 * fine;
            Tb = L.lerp(rim, sm * (1 + 0.075 * fine), sstep(RIM - 1.5, RIM + 2, d));
          } else Tb = sm * (1 + 0.075 * fine);
          Tb *= cov;
        }
        let Te = 0;
        if (ea > 0) Te = (0.27 * ea + 0.5 * et + 0.12 * sstep(0.45, 0.95, softD[k4 + 3] / 255) + 0.42 * (sm - 0.62) * et) * (1 + 0.07 * fine);
        T = Tb > Te ? Tb : Te;
        const floor = 0.035 * (cov > ea ? cov : ea);
        T += (mD[k4 + 1] / 255) * 0.3 - (mD[k4 + 2] / 255) * 0.26 - (mD[k4] / 255) * 0.66;
        if (T < floor) T = floor;
      }
      const li = (T >= 1.2 ? NL - 1 : (T / 1.2 * (NL - 1)) | 0) * 3;
      o[k4] = LUT[li]; o[k4 + 1] = LUT[li + 1]; o[k4 + 2] = LUT[li + 2]; o[k4 + 3] = 255;
    }
  }
  const cnv = L.makeCanvas(RW, RH);
  cnv.getContext('2d').putImageData(out, 0, 0);

  const plate = L.makeLayer(PAD, (g) => {
    g.fillStyle = BG; g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    g.drawImage(cnv, X0, Y0);
  });
  // halation: the densest metal blooms a little into the emulsion around it
  const sw = Math.ceil(plate.width / 4), sh = Math.ceil(plate.height / 4);
  const small = L.makeCanvas(sw, sh), sg = small.getContext('2d');
  sg.drawImage(plate, 0, 0, sw, sh);
  const sq = L.makeCanvas(sw, sh), qg = sq.getContext('2d');
  qg.drawImage(small, 0, 0); qg.globalCompositeOperation = 'multiply'; qg.drawImage(small, 0, 0);
  const halo = L.blurred(sq, 5);
  const pg = plate.getContext('2d');
  pg.save(); pg.setTransform(1, 0, 0, 1, 0, 0);
  pg.imageSmoothingEnabled = true; pg.imageSmoothingQuality = 'high';
  pg.globalAlpha = 0.55; pg.drawImage(L.blurred(plate, 0.9), 0, 0);      // radiographs are never razor sharp
  pg.globalCompositeOperation = 'screen'; pg.globalAlpha = 0.17;
  pg.drawImage(halo, 0, 0, plate.width, plate.height);
  pg.restore();
  return plate;
}

export default {
  name: '青铜鼎X光片',
  tone: 'light',
  init(env) {
    const plate = buildPlate(env);
    // film grain: a fine and a chunkier plate, shifted every frame
    const fine = L.grainTex(W + 128, H + 128, { seed: 's08f', amount: 0.62, size: 1 });
    const coarse = L.grainTex(W + 128, H + 128, { seed: 's08c', amount: 0.5, size: 2.5 });
    // base fog: a whisper of grain in the blacks so the film never goes digitally dead
    const fog = L.makeCanvas(W + 128, H + 128), fg = fog.getContext('2d');
    fg.drawImage(fine, 0, 0); fg.globalCompositeOperation = 'multiply'; fg.fillStyle = '#0b0d0d'; fg.fillRect(0, 0, fog.width, fog.height);
    S = { plate, fine, coarse, fog };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    L.blit(ctx, env, S.plate, { zoom: L.lerp(1.0, 1.012, p) });

    // the scan band: a soft bright column drifting left → right across the belly (long tail behind, firmer leading edge)
    const bx = L.lerp(430, 1500, p);
    ctx.save(); a.clipBelow(ctx, 0);
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = L.linear(ctx, bx - 330, 0, bx + 170, 0, [[0, '#808080'], [0.3, '#909090'], [0.5, '#b2b2b2'], [0.62, '#d2d2d2'], [0.67, '#dedede'], [0.74, '#cccccc'], [0.86, '#959595'], [1, '#808080']]);
    ctx.fillRect(bx - 330, 0, 500, H);
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = L.linear(ctx, bx - 250, 0, bx + 130, 0, [[0, 'rgba(206,218,218,0)'], [0.62, 'rgba(206,218,218,0.1)'], [0.7, 'rgba(206,218,218,0.1)'], [1, 'rgba(206,218,218,0)']]);
    ctx.fillRect(bx - 250, 0, 380, H);
    ctx.fillStyle = L.linear(ctx, bx - 2, 0, bx + 22, 0, [[0, 'rgba(240,246,246,0)'], [0.5, 'rgba(240,246,246,0.2)'], [1, 'rgba(240,246,246,0)']]);
    ctx.fillRect(bx - 2, 0, 24, H);
    ctx.restore();

    // grain, re-seeded per frame
    const r = L.rng('s08grain' + (env.frame | 0));
    L.overlayGrain(ctx, S.coarse, 0.34, 'overlay', r.int(0, 127), r.int(0, 127));
    L.overlayGrain(ctx, S.fine, 0.5, 'overlay', r.int(0, 127), r.int(0, 127));
    L.overlayGrain(ctx, S.fog, 0.3, 'lighter', r.int(0, 127), r.int(0, 127));
    L.vignette(ctx, { strength: 0.3, inner: 0.5 });
  },
};
