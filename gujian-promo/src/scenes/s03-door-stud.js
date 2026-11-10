// s03 — 朱门金钉. Extreme macro of one gilded bronze door stud (门钉) on a palace gate:
// the arc is the upper silhouette of the dome. Behind it, out of focus, the vermilion door leaf with its
// regular rows and columns of studs melted into soft gold bokeh.
//
// The dome is shaded per pixel in init(): every pixel under the arc is mapped onto a real sphere of radius arc.R
// (U = distance along the parallel, S = distance down the meridian from the limb), so hammer marks, pits and wear
// are foreshortened toward the limb exactly like the surface of a ball. The bumped normal then looks up a
// "matcap" ramp: vermilion door reflection at the limb → soft highlight band → deepening gold.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 120;
let S = null;

const sstep = (a, b, v) => { const t = L.clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// ── tiny allocation-free worley noise (squared distances in cD1/cD2, cell id in cId) ──
let cD1 = 0, cD2 = 0, cId = 0;
function cell(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let d1 = 9, d2 = 9, id = 0;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const cx = xi + ox, cy = yi + oy;
    let h = (Math.imul(cx, 374761393) + Math.imul(cy, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    const dx = cx + (h & 1023) / 1023 - x, dy = cy + ((h >>> 10) & 1023) / 1023 - y, d = dx * dx + dy * dy;
    if (d < d1) { d2 = d1; d1 = d; id = ((h >>> 20) & 255) / 255; } else if (d < d2) d2 = d;
  }
  cD1 = d1; cD2 = d2; cId = id;
}

// colour ramp given in nz (0 = limb, grazing; 1 = facing the lens) → LUT indexed by elevation angle α = asin(nz)
const AMAX = 1.05, NLUT = 1024;
function lut(stops) {
  const f = L.makeRamp(stops); const out = new Float32Array(NLUT * 3);
  for (let i = 0; i < NLUT; i++) { const c = f(Math.sin((i / (NLUT - 1)) * AMAX)); out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2]; }
  return out;
}

/** the gilded dome: everything below the arc */
function buildDome(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const X0 = -PAD, Y0 = Math.floor(a.crestY) - 2;
  const RW = W + PAD * 2, RH = H + PAD - Y0, N = RW * RH;
  const nA = L.makeNoise('s03a'), nB = L.makeNoise('s03b');

  // matcaps. gold seen under the key light / away from it, and the bare bronze where the gilding has worn through
  const GOLD_LIT = lut([[0, '#c8381a'], [0.05, '#cf401c'], [0.11, '#d8541e'], [0.16, '#e47a28'], [0.21, '#f2a83c'], [0.255, '#ffcf58'],
    [0.285, '#ffdc6e'], [0.298, '#fff1b0'], [0.312, '#ffdc6e'], [0.345, '#fbcf5a'], [0.4, '#efbd48'], [0.45, '#dfa236'], [0.5, '#c98426'], [0.56, '#ae6a1a'], [0.64, '#935414'], [0.8, '#7a4410'], [1, '#6e4310']]);
  const GOLD_DIM = lut([[0, '#a82c14'], [0.05, '#b03317'], [0.11, '#c0491b'], [0.16, '#d16f26'], [0.21, '#e59e38'], [0.26, '#f6c85a'],
    [0.3, '#fde08a'], [0.345, '#f5cc5e'], [0.4, '#e2ae42'], [0.45, '#d09432'], [0.5, '#ba7922'], [0.56, '#a06018'], [0.64, '#874c12'], [0.8, '#6e3d0e'], [1, '#643c0e']]);
  const BRONZE = lut([[0, '#5e1c0c'], [0.11, '#6b2410'], [0.21, '#8a5220'], [0.3, '#b08040'], [0.4, '#855219'], [0.56, '#6e4310'], [1, '#4c2c0a']]);

  // 1) slow fields on a coarse grid (bilinear-sampled later)
  const CS = 4, cw = Math.ceil(RW / CS) + 2, ch = Math.ceil(RH / CS) + 2;
  const cWear = new Float32Array(cw * ch), cMed = new Float32Array(cw * ch), cTarn = new Float32Array(cw * ch),
    cVerd = new Float32Array(cw * ch), cWx = new Float32Array(cw * ch), cWy = new Float32Array(cw * ch);
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const ddx = X0 + i * CS - cx, ddy = cy - (Y0 + j * CS), rr = Math.hypot(ddx, ddy);
    const U = Math.atan2(ddx, ddy) * rr, Sv = R * Math.acos(Math.min(1, rr / R)), k = j * cw + i;
    cWear[k] = nA.fbm(U / 230, Sv / 230, 3, 2, 0.55);
    cMed[k] = nA.fbm(U / 300 + 40, Sv / 300 - 13, 3);
    cTarn[k] = nB.fbm(U / 900 - 7, Sv / 620 + 3, 3);
    cVerd[k] = nB.fbm(U / 170 + 21, Sv / 170 + 77, 3);
    cWx[k] = nB.n2(U / 240 + 5, Sv / 240); cWy[k] = nB.n2(U / 240 - 31, Sv / 240 + 19);
  }
  const bil = (src, i, j) => {
    const fx = i / CS, fy = j / CS, i0 = fx | 0, j0 = fy | 0, tx = fx - i0, ty = fy - j0, k = j0 * cw + i0;
    const a0 = src[k], a1 = src[k + 1], b0 = src[k + cw], b1 = src[k + cw + 1];
    return (a0 + (a1 - a0) * tx) * (1 - ty) + (b0 + (b1 - b0) * tx) * ty;
  };

  // 2) height field at full resolution (units: radians of tilt per surface px once differentiated)
  const Hh = new Float32Array(N), Wf = new Float32Array(N), Fn = new Float32Array(N), Gl = new Float32Array(N), Bw = new Float32Array(N), Cv = new Float32Array(N), Al = new Float32Array(N);
  const AF = 1.25, AM = 1.5, AG = 0.09, AS = 0.045;
  for (let j = 0; j < RH; j++) {
    const ddy = cy - (Y0 + j);
    for (let i = 0; i < RW; i++) {
      const k = j * RW + i, ddx = X0 + i - cx, rr = Math.sqrt(ddx * ddx + ddy * ddy);
      if (rr > R + 2) { Al[k] = -1; continue; }
      const q = Math.min(1, rr / R), al = Math.acos(q), nz = Math.sqrt(1 - q * q);
      Al[k] = al;
      const U = Math.atan2(ddx, ddy) * rr, Sv = R * al;
      const fadeFine = sstep(0.07, 0.24, nz), fadeBig = sstep(0.06, 0.22, nz);
      cell(U / 118 + bil(cWx, i, j) * 0.32, Sv / 118 + bil(cWy, i, j) * 0.32);
      const bowl = sstep(0.02, 0.52 + 0.14 * (cId - 0.5), Math.sqrt(cD1));   // each hammer blow leaves a shallow round dish with a soft rim
      const g1 = nA.n2(U / 10, Sv / 10), g2 = nB.n2(U / 4.2 + 50, Sv / 4.2);   // cast "orange peel"
      const streak = nB.n2(U / 260, Sv / 6 + 91);        // burnishing lines running round the stud
      Hh[k] = (AF * bowl + AM * bil(cMed, i, j)) * fadeBig + (AG * (g1 * 0.6 + g2 * 0.4) + AS * streak) * fadeFine;
      Fn[k] = g1; Gl[k] = g2; Bw[k] = bowl;
      Wf[k] = 0.3 * nA.n2(U / 40 + 9, Sv / 40 - 4) + 0.16 * nB.n2(U / 16 - 3, Sv / 16 + 8) + 0.06 * g1;   // fine structure of the wear edges
    }
  }

  // 3) sand holes (砂眼) and knocks: round on the sphere → squashed ellipses near the limb
  const r = L.rng('s03pits');
  const span = a.span(PAD + 20);
  for (let n = 0; n < 170; n++) {
    const th0 = r.range(-span, span), v0 = 16 + Math.pow(r(), 0.85) * 700;
    const big = r.chance(0.13);
    const rp = big ? r.range(6, 11) : r.range(1.6, 4.6), depth = rp * r.range(0.16, 0.36);
    const rr0 = R - v0, al0 = Math.acos(rr0 / R), U0 = th0 * rr0, S0 = R * al0;
    const px = cx + rr0 * Math.sin(th0) - X0, py = cy - rr0 * Math.cos(th0) - Y0;
    const e = Math.ceil(rp) + 2;
    for (let j = Math.max(1, Math.floor(py - e)); j <= Math.min(RH - 2, Math.ceil(py + e)); j++) {
      for (let i = Math.max(1, Math.floor(px - e)); i <= Math.min(RW - 2, Math.ceil(px + e)); i++) {
        const k = j * RW + i; if (Al[k] < 0) continue;
        const ddx = X0 + i - cx, ddy = cy - (Y0 + j), rr = Math.sqrt(ddx * ddx + ddy * ddy);
        const du = Math.atan2(ddx, ddy) * rr - U0, ds = R * Al[k] - S0;
        const d2 = (du * du + ds * ds) / (rp * rp);
        if (d2 >= 1) continue;
        const f = (1 - d2) * (1 - d2);
        Hh[k] -= depth * f; Cv[k] = Math.max(Cv[k], Math.min(1, f * 1.6));
      }
    }
  }

  // 4) shade
  const img = new ImageData(RW, RH), d = img.data;
  const KR = 2.6;
  for (let j = 0; j < RH; j++) {
    const ddy = cy - (Y0 + j), jm = j > 0 ? -RW : 0, jp = j < RH - 1 ? RW : 0;
    for (let i = 0; i < RW; i++) {
      const k = j * RW + i, al = Al[k];
      if (al < 0) continue;
      const ddx = X0 + i - cx, rr = Math.sqrt(ddx * ddx + ddy * ddy), sn = ddx / rr, cs = ddy / rr;
      const nz = Math.sin(al);
      const hx = (Hh[k + (i < RW - 1 ? 1 : 0)] - Hh[k - (i > 0 ? 1 : 0)]) * 0.5, hy = (Hh[k + jp] - Hh[k + jm]) * 0.5;
      const ht = hx * cs + hy * sn, hv = -hx * sn + hy * cs;       // along the arc / toward the centre (screen px)
      // tilt the sphere normal by the bump: radial slope changes the elevation above the limb, tangential slope slides the highlight sideways
      let a2 = al - hv * nz; a2 = a2 < 0 ? 0 : a2 > AMAX ? AMAX : a2;
      const nx2 = ddx / R - ht;
      const lt = (nx2 + 0.11) / 0.33, lat = Math.exp(-lt * lt);
      const li = ((a2 / AMAX) * (NLUT - 1) | 0) * 3;
      let cr = GOLD_DIM[li] + (GOLD_LIT[li] - GOLD_DIM[li]) * lat, cg = GOLD_DIM[li + 1] + (GOLD_LIT[li + 1] - GOLD_DIM[li + 1]) * lat, cb = GOLD_DIM[li + 2] + (GOLD_LIT[li + 2] - GOLD_DIM[li + 2]) * lat;
      const cav = Cv[k], g1 = Fn[k];
      // gilding rubbed thin (warmer, darker) toward the crown of the dome — the bottom of frame, where hands reach it —
      // and chipped through to the bronze in flecks; the highlight band and the limb stay clean
      const crown = sstep(0.36, 0.62, nz), wc = bil(cWear, i, j);
      const thin = L.clamp(0.8 * crown + 0.5 * wc * (0.35 + crown));
      if (thin > 0) { cr *= 1 - 0.07 * thin; cg *= 1 - 0.2 * thin; cb *= 1 - 0.36 * thin; }
      const wear = sstep(0.6, 0.76, wc + Wf[k] + 0.08 * (Bw[k] - 0.5) + 0.36 * crown - 0.5 * (1 - sstep(0.16, 0.34, nz)));
      if (wear > 0) { cr += (BRONZE[li] - cr) * wear; cg += (BRONZE[li + 1] - cg) * wear; cb += (BRONZE[li + 2] - cb) * wear; }
      // slow tarnish: only ever warmer and darker
      const tarn = Math.min(0.15, bil(cTarn, i, j)), tw = tarn < 0 ? tarn * 1.4 : tarn * 0.3;
      cr *= 1 + 0.06 * tw; cg *= 1 + 0.1 * tw; cb *= 1 + (tarn < 0 ? 0.17 : 0.1) * tw;
      // relief from the upper-left key light, measured on the surface (not the foreshortened screen) …
      const tR = -hv * nz, tT = -ht;
      let rel = -(tR * 0.835 + tT * 0.55) * KR * sstep(0.12, 0.3, nz); rel = rel < -0.5 ? -0.5 : rel > 0.65 ? 0.65 : rel;
      const sh = 1 + rel;
      cr *= sh; cg *= sh; cb *= sh;
      // … plus a tight specular lobe: the wall of every dish that faces the light flashes
      const e1 = tR + 0.023, e2 = tT + 0.016, spec = Math.exp(-(e1 * e1 + e2 * e2) / 0.0002);
      if (spec > 0.02) { const sp = spec * 105 * (0.35 + 0.65 * lat) * (1 - wear * 0.8) * sstep(0.17, 0.3, nz); cr += sp; cg += sp * 0.92; cb += sp * 0.6; }
      // micro-glitter of the gilding where the light rakes across it
      const gl = Gl[k] - 0.5;
      if (gl > 0) { const sp = gl * 70 * (0.25 + 0.75 * lat) * (1 - wear * 0.8) * sstep(0.2, 0.28, nz) * (1 - sstep(0.36, 0.5, nz) * 0.6); cr += sp; cg += sp * 0.94; cb += sp * 0.72; }
      // cavities go dark; a little verdigris gathers in some of them
      if (cav > 0) { const o = 1 - 0.82 * cav; cr *= o; cg *= o * 0.92; cb *= o * 0.85; }
      const vm = sstep(0.83, 0.9, bil(cVerd, i, j) * 0.5 + 0.5 + 0.32 * cav + 0.1 * wear + 0.04 * g1) * sstep(0.36, 0.46, nz);
      if (vm > 0) {
        const vs = (0.8 + 0.5 * rel + 0.1 * g1) * (1 - 0.45 * cav), m = vm * 0.8;
        cr += (82 * vs - cr) * m; cg += (140 * vs - cg) * m; cb += (114 * vs - cb) * m;
      }
      const o = k * 4;
      d[o] = cr; d[o + 1] = cg; d[o + 2] = cb; d[o + 3] = 255;
    }
  }
  const cnv = L.makeCanvas(RW, RH);
  cnv.getContext('2d').putImageData(img, 0, 0);

  // surface point (U, S) → frame coords
  const toXY = (U, Sv) => { const rr = R * Math.cos(Sv / R), th = U / rr; return [cx + rr * Math.sin(th), cy - rr * Math.cos(th)]; };

  const layer = L.makeLayer(PAD, (g) => {
    g.save(); a.clipBelow(g, 0);
    g.drawImage(cnv, X0, Y0);
    // hairline scratches (bright lip + dark groove), straight on the sphere → flattened toward the limb
    const rs = L.rng('s03scratch');
    g.lineCap = 'round';
    for (let n = 0; n < 70; n++) {
      const U0 = rs.range(-1250, 1250), S0 = rs.range(1000, 2100), ang = rs.range(0, Math.PI), len = rs.range(40, 300) * (rs.chance(0.12) ? 2 : 1), bend = rs.range(-0.12, 0.12);
      const pts = [];
      for (let t = 0; t <= 10; t++) { const u = t / 10 - 0.5, aa = ang + bend * u; pts.push(toXY(U0 + Math.cos(aa) * len * u, Math.max(860, S0 + Math.sin(aa) * len * u))); }
      const al = rs.range(0.08, 0.24), lw = rs.range(0.6, 1.1);
      const run = (dy, style) => { g.strokeStyle = style; g.lineWidth = lw; g.beginPath(); pts.forEach((p, t) => (t ? g.lineTo(p[0], p[1] + dy) : g.moveTo(p[0], p[1] + dy))); g.stroke(); };
      run(0.9, `rgba(74,36,6,${al * 0.8})`); run(0, `rgba(255,246,206,${al})`);
    }
    // the dome turns away from the key light toward the right and the lower corners
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = L.linear(g, -PAD, 0, W + PAD, 0, [[0, '#f6eddc'], [0.3, '#ffffff'], [0.62, '#f6e8d2'], [1, '#cdb089']]);
    g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    g.fillStyle = L.radial(g, a.cx - 160, a.crestY + 120, 500, 1500, [[0, '#ffffff'], [1, '#bf9f78']]);
    g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    g.restore();
  });
  // shallow depth of field: the limb (far away, edge-on) goes a touch soft
  const soft = L.blurred(layer, 2.4), sg = soft.getContext('2d');
  sg.globalCompositeOperation = 'destination-in';
  sg.fillStyle = L.radial(sg, a.cx + PAD, a.cy + PAD, R - 96, R + 8, [[0, 'rgba(0,0,0,0)'], [0.72, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,1)']]);
  sg.fillRect(0, 0, soft.width, soft.height);
  // … and so does the crown of the dome, which bulges toward the lens at the bottom of frame
  const near = L.blurred(layer, 4.5), ng = near.getContext('2d');
  ng.globalCompositeOperation = 'destination-in';
  ng.fillStyle = L.radial(ng, a.cx + PAD, a.cy + PAD, R - 640, R - 300, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
  ng.fillRect(0, 0, near.width, near.height);
  const lg = layer.getContext('2d');
  lg.save(); a.clipBelow(lg, 0); lg.drawImage(soft, -PAD, -PAD); lg.drawImage(near, -PAD, -PAD); lg.restore();
  return layer;
}

/** defocus with a disc-shaped kernel (flat-topped blur, like a real lens wide open) */
function lensBlur(src, radius, n = 30) {
  const c = L.makeCanvas(src.width, src.height), g = c.getContext('2d');
  for (let i = 0; i < n; i++) {
    const rr = radius * Math.sqrt((i + 0.5) / n), th = i * 2.399963;
    g.globalAlpha = 1 / (i + 1);
    g.drawImage(src, Math.cos(th) * rr, Math.sin(th) * rr);
  }
  const out = L.blurred(c, radius * 0.18); out._pad = src._pad;
  return out;
}

/** the door leaf behind: vermilion lacquer, studs in strict rows and columns, all out of focus */
function buildBack(env) {
  const a = env.arc;
  const GX = 250, GY = 250, SR = 57, COL0 = 960 + 125, ROW0 = 150;
  const studs = [];
  for (let row = -1; row <= 3; row++) for (let col = -6; col <= 5; col++) studs.push([COL0 + col * GX, ROW0 + row * GY]);
  const full = (g) => g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
  const sharp = L.makeLayer(PAD, (g) => {
    g.fillStyle = L.linear(g, 0, -PAD, 0, H * 0.8, [[0, '#a3261a'], [0.5, '#8f1d14'], [1, '#5a120c']]); full(g);
    g.fillStyle = L.radial(g, 600, 150, 0, 1150, [[0, 'rgba(226,74,44,0.7)'], [0.5, 'rgba(180,44,28,0.3)'], [1, 'rgba(120,20,12,0)']]); full(g);
    // lacquer: brushed vertical sheen + slow blotches
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.7;
    g.drawImage(L.noiseLayer(PAD, { seed: 's03lac', scale: 90, sx: 0.5, sy: 7, octaves: 4, contrast: 1.6, res: 0.25 }), -PAD, -PAD);
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.55;
    g.drawImage(L.noiseLayer(PAD, { seed: 's03lac2', scale: 420, octaves: 3, res: 0.2, ramp: [[0, '#7a2a20'], [0.55, '#ffffff'], [1, '#ffffff']] }), -PAD, -PAD);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    // joints between the vertical door planks
    for (const sx of [210, 710, 1460]) {
      g.fillStyle = 'rgba(40,5,3,0.55)'; g.fillRect(sx - 4, -PAD, 8, H + PAD * 2);
      g.fillStyle = 'rgba(230,90,60,0.3)'; g.fillRect(sx + 5, -PAD, 5, H + PAD * 2);
    }
    for (const [x, y] of studs) {
      g.fillStyle = L.radial(g, x + 18, y + 24, SR * 0.5, SR * 1.55, [[0, 'rgba(22,2,1,0.8)'], [1, 'rgba(22,2,1,0)']]);
      g.beginPath(); g.arc(x + 18, y + 24, SR * 1.55, 0, L.TAU); g.fill();
      g.fillStyle = L.radial(g, x - SR * 0.32, y - SR * 0.38, SR * 0.05, SR * 1.28, [[0, '#fff3bd'], [0.18, '#f7d36a'], [0.5, '#e2ac3a'], [0.8, '#a66f1c'], [1, '#5f370a']]);
      g.beginPath(); g.arc(x, y, SR, 0, L.TAU); g.fill();
      // the lacquer bounces red into the shadow side of each stud
      g.fillStyle = L.radial(g, x + SR * 0.5, y + SR * 0.6, 0, SR * 0.7, [[0, 'rgba(200,60,30,0.55)'], [1, 'rgba(200,60,30,0)']]);
      g.beginPath(); g.arc(x, y, SR, 0, L.TAU); g.fill();
    }
  });
  const back = lensBlur(sharp, 25);
  const g = back.getContext('2d');
  g.translate(PAD, PAD);
  // each stud's specular highlight opens into a bokeh disc
  const discs = L.blurred(L.makeLayer(PAD, (b) => {
    for (const [x, y] of studs) {
      const bx = x - SR * 0.3, by = y - SR * 0.36, br = 27;
      b.fillStyle = 'rgba(255,208,104,0.55)'; b.beginPath(); b.arc(bx, by, br, 0, L.TAU); b.fill();
      b.strokeStyle = 'rgba(255,230,156,0.32)'; b.lineWidth = 3; b.beginPath(); b.arc(bx, by, br - 1.5, 0, L.TAU); b.stroke();
    }
  }), 1.6);
  g.globalCompositeOperation = 'screen'; g.drawImage(discs, -PAD, -PAD);
  g.globalCompositeOperation = 'source-over';
  // the door falls into shadow behind the big stud and toward the corners
  g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 20, a.R + 430, [[0, 'rgba(16,2,1,0.66)'], [0.3, 'rgba(16,2,1,0.34)'], [1, 'rgba(16,2,1,0)']]); full(g);
  g.fillStyle = L.radial(g, 900, 300, 520, 1320, [[0, 'rgba(10,1,1,0)'], [1, 'rgba(10,1,1,0.8)']]); full(g);
  return back;
}

export default {
  name: '朱门金钉',
  tone: 'light',
  init(env) {
    const dome = buildDome(env);
    // bloom: only the hot parts of the gold, blurred wide → the stud glows and spills a little over its own limb
    const bloom = L.blurred(L.filtered(dome, 'brightness(0.74) contrast(2.6) saturate(1.2)'), 20);
    // a handful of pin-point glints in the highlight band; each flares once as the surface slides under the light
    const rg = L.rng('s03glint'), glints = [];
    for (let i = 0; i < 10; i++) glints.push({ th: rg.range(-0.27, 0.1), dr: -rg.range(104, 220), ph: rg(), k: rg.range(0.45, 1) });
    S = { back: buildBack(env), dome, bloom, glints };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.009, 0.009, p);
    // background: far less parallax, a breath of zoom
    L.blit(ctx, env, S.back, { rot: rot * 0.22, zoom: L.lerp(1.0, 1.018, p) });
    // warm bloom spilling off the gold into the lens
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = L.radial(ctx, a.cx, a.cy, a.R - 4, a.R + 120, [[0, 'rgba(255,100,38,0.4)'], [0.25, 'rgba(232,62,24,0.18)'], [1, 'rgba(200,40,20,0)']]);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    // the stud: surface detail slides along the arc
    L.blit(ctx, env, S.dome, { rot });
    L.blit(ctx, env, S.bloom, { rot, blend: 'screen', alpha: 0.22 });
    // travelling glint in the highlight band
    ctx.save(); a.clipBelow(ctx, 0); ctx.globalCompositeOperation = 'screen';
    a.at(ctx, L.lerp(-0.15, -0.075, p), -132, () => {
      ctx.scale(3.4, 1);
      ctx.fillStyle = L.radial(ctx, 0, 0, 0, 150, [[0, 'rgba(255,214,112,0.36)'], [0.45, 'rgba(255,196,84,0.14)'], [1, 'rgba(255,190,80,0)']]);
      ctx.fillRect(-160, -160, 320, 320);
    });
    ctx.restore();
    // pin-point glints
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const q of S.glints) {
      const tw = (0.25 + 0.75 * Math.pow(Math.max(0, Math.cos((p * 0.8 + q.ph) * L.TAU)), 3)) * q.k;
      if (tw < 0.03) continue;
      a.at(ctx, q.th + rot, q.dr, () => {
        ctx.scale(1, 0.42);
        ctx.fillStyle = L.radial(ctx, 0, 0, 0, 34, [[0, `rgba(255,252,232,${0.95 * tw})`], [0.1, `rgba(255,240,180,${0.55 * tw})`], [0.4, `rgba(255,214,120,${0.12 * tw})`], [1, 'rgba(255,200,100,0)']]);
        ctx.fillRect(-34, -34, 68, 68);
      });
    }
    ctx.restore();
    // rim light riding the limb
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const pk = L.lerp(0.28, 0.34, p);
    ctx.strokeStyle = L.linear(ctx, 0, 0, W, 0, [[0, 'rgba(255,160,84,0.2)'], [pk, 'rgba(255,226,160,0.95)'], [0.62, 'rgba(255,186,108,0.5)'], [1, 'rgba(255,150,80,0.16)']]);
    ctx.lineWidth = 2.6; a.stroke(ctx, -1.3);
    ctx.restore();
    L.vignette(ctx, { strength: 0.38 });
  },
};
