// s11 — 红绳压岁钱. A bulging magenta silk bundle seen edge-on against candle light: the arc is its back-lit upper rim.
// Pressed into that rim sits a row of square-holed cash coins, each wrapped in thin red gauze and lit from behind into a
// translucent vermilion disc (darker outer rim, darker rim round the hole, the hole itself glowing through the gauze),
// strung on a red cord twisted with gold thread that shows in the gaps between the coins.
//
// Both the silk and the coins are shaded per pixel in init():
//   silk  → polar coordinates (s = distance along the arc, v = depth below it): a painted height map of radial folds
//           is lit from the upper left, then a fine warp/weft weave and thread slubs are laid over it;
//   coins → a "transmission" value per pixel (metal thickness, patina, gauze threads, creases, the cord's shadow)
//           looked up in a candle-light ramp: deep crimson → vermilion → orange → flame.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 120;
const CW = 12;            // cord thickness (px)
const PITCH = 5;          // gauze thread pitch (px)
let S = null;

const sstep = (a, b, v) => { const t = v <= a ? 0 : v >= b ? 1 : (v - a) / (b - a); return t * t * (3 - 2 * t); };
const cl01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// s = px along the arc from the crest · r = radius · k = height of the centre above the arc ÷ r (the rest is sunk in the silk)
// tilt = rotation of the square hole · ga = bias of the gauze threads · hue 0 vermilion … 1 crimson · gain = brightness · mot = patina
const COINS = [
  { s: -1225, r: 104, k: 0.50, tilt: 0.06, ga: 0.50, hue: 0.50, gain: 0.98, mot: 1.0 },
  { s: -940, r: 108, k: 0.52, tilt: -0.08, ga: -0.35, hue: 0.15, gain: 1.06, mot: 0.8 },
  { s: -665, r: 80, k: 0.46, tilt: 0.10, ga: 0.62, hue: 0.90, gain: 0.94, mot: 1.3 },
  { s: -400, r: 124, k: 0.55, tilt: -0.05, ga: 0.20, hue: 0.35, gain: 1.02, mot: 1.0 },
  { s: -130, r: 90, k: 0.44, tilt: 0.12, ga: -0.60, hue: 0.80, gain: 0.96, mot: 1.25 },
  { s: 135, r: 140, k: 0.56, tilt: -0.03, ga: 0.42, hue: 0.00, gain: 1.1, mot: 0.8 },
  { s: 420, r: 84, k: 0.48, tilt: -0.11, ga: -0.20, hue: 0.70, gain: 0.96, mot: 1.3 },
  { s: 650, r: 112, k: 0.52, tilt: 0.07, ga: 0.75, hue: 0.45, gain: 1.0, mot: 1.1 },
  { s: 915, r: 98, k: 0.47, tilt: -0.06, ga: -0.50, hue: 0.10, gain: 1.05, mot: 0.85 },
  { s: 1195, r: 116, k: 0.54, tilt: 0.09, ga: 0.30, hue: 0.60, gain: 0.98, mot: 1.0 },
];

function mkLut(stops, n = 512) {
  const f = L.makeRamp(stops), o = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const c = f(i / (n - 1)); o[i * 3] = c[0]; o[i * 3 + 1] = c[1]; o[i * 3 + 2] = c[2]; }
  return o;
}

/** positions, cord geometry and gauze creases for every coin */
function layout(a) {
  const R = a.R, rr = L.rng('s11coins');
  const cs = COINS.map((c, i) => {
    const th = c.s / R, p = a.pt(th, c.k * c.r);
    return { ...c, i, th, x: p.x, y: p.y, seed: 3.7 + i * 11.3,
      rw: rr.range(0.112, 0.138), hs: rr.range(0.25, 0.282), iw: rr.range(0.062, 0.076), hotx: rr.range(-0.18, 0.18) };
  });
  // the cord runs hole to hole; through each coin it keeps one straight heading (toward the neighbours on either side)
  cs.forEach((c, i) => {
    const A = cs[Math.max(0, i - 1)], B = cs[Math.min(cs.length - 1, i + 1)], m = Math.hypot(B.x - A.x, B.y - A.y);
    c.dx = (B.x - A.x) / m; c.dy = (B.y - A.y) / m;
  });
  for (const c of cs) {
    const ct = Math.cos(c.th), st = Math.sin(c.th);
    c.ux = c.dx * ct + c.dy * st; c.uy = -c.dx * st + c.dy * ct;         // cord heading in the coin frame
    // creases of the gauze, fanning up across the face from where it is tucked into the silk
    c.creases = [];
    const n = 4 + (c.r > 100 ? 1 : 0);
    for (let j = 0; j < n; j++) {
      const ph = L.lerp(-0.95, 0.95, (j + rr.range(0.15, 0.85)) / n);
      c.creases.push({ x0: rr.range(-0.3, 0.3) * c.r, y0: c.k * c.r + 0.06 * c.r, ux: Math.sin(ph), uy: -Math.cos(ph), len: c.r * rr.range(0.9, 1.7), amp: rr.range(0.12, 0.22) * rr.sign() });
    }
  }
  return cs;
}

/** one coin wrapped in gauze, shaded per pixel in screen orientation (so it is blitted without resampling) */
function buildCoin(c, a, nA, nB, lutV, lutC) {
  const r = c.r, Hs = Math.ceil(r * 1.1 + 8), N = Hs * 2;
  const img = new ImageData(N, N), d = img.data;
  const rx = Math.round(c.x), ry = Math.round(c.y), fx = c.x - rx, fy = c.y - ry;
  const ox = rx - Hs, oy = ry - Hs;
  const ct = Math.cos(c.th), st = Math.sin(c.th), ctl = Math.cos(c.tilt), stl = Math.sin(c.tilt), cg = Math.cos(c.ga), sg = Math.sin(c.ga);
  const hs = c.hs * r, hi = (c.hs + c.iw) * r, rIn = r * (1 - c.rw), crn = Math.max(2, 0.035 * r), grime = 0.045 * r + 2;
  // a weak fill from the upper left gives the two raised rims their relief
  const LX = -0.5, LY = -0.86;
  const llx = LX * ct + LY * st, lly = -LX * st + LY * ct;             // light in the coin frame
  const lhx = llx * ctl + lly * stl, lhy = -llx * stl + lly * ctl;     // … in the hole frame
  const KW = L.TAU / PITCH, half = CW / 2;
  const hue = c.hue, gain = c.gain, mot = c.mot, sd = c.seed;
  const hot0x = c.hotx * r, hot0y = 0.14 * r, hotS = 1 / (0.82 * r * 0.82 * r);
  const box = (ax, ay, hw, cr) => { const qx = ax - (hw - cr), qy = ay - (hw - cr); return Math.hypot(qx > 0 ? qx : 0, qy > 0 ? qy : 0) + Math.min(qx > qy ? qx : qy, 0) - cr; };
  for (let j = 0; j < N; j++) {
    const Y = j + 0.5 - Hs - fy, ddy = a.cy - (oy + j + 0.5);
    for (let i = 0; i < N; i++) {
      const X = i + 0.5 - Hs - fx, ddx = ox + i + 0.5 - a.cx;
      const dr = Math.sqrt(ddx * ddx + ddy * ddy) - a.R;
      if (dr < -10) continue;                                           // hidden in the silk
      const lx = X * ct + Y * st, ly = -X * st + Y * ct;                // coin frame: +x along the arc, +y toward the circle centre
      const rho = Math.sqrt(lx * lx + ly * ly);
      if (rho > r * 1.09 + 4) continue;
      const disc = 1 - sstep(r - 0.9, r + 0.9, rho);
      let T = 0.7, A = 0;
      // the loose gauze round the edge catches the back light: a thin soft fringe
      if (disc < 1) { const fr = 1 - sstep(r - 1, r + 0.06 * r + 3, rho); A = 0.42 * fr * fr; }
      if (disc > 0) {
        const hx = lx * ctl + ly * stl, hy = -lx * stl + ly * ctl, ahx = Math.abs(hx), ahy = Math.abs(hy);
        const sdH = box(ahx, ahy, hs, crn), sdI = box(ahx, ahy, hi, crn * 1.6);
        const hole = 1 - sstep(-0.9, 0.9, sdH);
        const inner = 1 - sstep(-1.7, 1.7, sdI), rimI = inner - hole > 0 ? inner - hole : 0;
        const rimO = sstep(rIn - 1.7, rIn + 1.7, rho);
        const hot = Math.exp(-((lx - hot0x) * (lx - hot0x) + (ly - hot0y) * (ly - hot0y)) * hotS);
        const lightF = (0.64 + 0.6 * hot) * (1 - 0.13 * sstep(0.15, 1, -ly / r));
        // metal thickness → how much candle light comes through; grime gathers at the foot of both rims
        let t = 0.5 - 0.22 * rimO - 0.19 * rimI - 0.07 * sstep(r * 0.95, r, rho);
        if (rho < rIn) t -= 0.075 * Math.exp(-(rIn - rho) / grime);
        if (sdI > 0) t -= 0.075 * Math.exp(-sdI / grime) * (1 - rimO);
        // relief of the rims
        const tO = cl01((rho - (rIn - 2.4)) / 4.8), dO = (6 * tO * (1 - tO)) / 4.8;
        let emb = -dO * (lx * llx + ly * lly) / (rho || 1);
        const tI = cl01((sdI + 2.4) / 4.8), dI = (-6 * tI * (1 - tI)) / 4.8;
        emb += -dI * (ahx > ahy ? (hx > 0 ? lhx : -lhx) : (hy > 0 ? lhy : -lhy)) * (1 - hole);
        t += 0.24 * emb;
        // patina: slow blotches, fine grain, crusty patches, a few thin bright veins
        const u = lx / r, v = ly / r;
        const n1 = nA.fbm(u * 2.1 + sd, v * 2.1 - sd * 0.7, 4), n2 = nB.fbm(u * 7.5 - sd, v * 7.5 + 3.1, 3);
        const blot = sstep(0.0, 0.34, n1 + 0.45 * n2), vein = sstep(0.74, 0.93, nB.ridged(u * 3.1 + 9 + sd, v * 3.1, 2));
        t += mot * (0.12 * n1 + 0.065 * n2 - 0.15 * blot + 0.075 * vein) * (1 - 0.45 * rimO);
        // the cord: behind one half, through the hole, over the other half under the gauze
        const al = lx * c.ux + ly * c.uy, pe = -lx * c.uy + ly * c.ux, ape = Math.abs(pe);
        const band = 1 - sstep(half - 1.5, half + 1.5, ape), front = sstep(-3, 3, al);
        const twist = Math.cos((al + pe) * (L.TAU / 10.4));
        t -= band * (0.04 + 0.075 * front * (1 + 0.3 * twist));
        t += front * (0.07 * Math.exp(-((pe + half) * (pe + half)) / 3.4) - 0.045 * Math.exp(-((pe - half) * (pe - half)) / 5));
        t *= lightF;
        // creases in the gauze
        for (const q of c.creases) {
          const qx = lx - q.x0, qy = ly - q.y0, ql = qx * q.ux + qy * q.uy;
          if (ql < 0 || ql > q.len) continue;
          const e = (-qx * q.uy + qy * q.ux) / (2.2 + ql * 0.03);
          if (e * e > 9) continue;
          t += q.amp * e * Math.exp(-e * e) * sstep(0, 0.25 * r, ql) * (1 - sstep(q.len * 0.6, q.len, ql));
        }
        // gauze threads: thin dark lines, open and bright between them
        const gx = lx * cg + ly * sg, gy = -lx * sg + ly * cg;
        const wob = nA.n2(lx / (r * 0.5) + sd, ly / (r * 0.5) - sd) * 1.3;
        const thx = sstep(0.5, 0.95, 0.5 + 0.5 * Math.cos((gx + wob) * KW)), thy = sstep(0.5, 0.95, 0.5 + 0.5 * Math.cos((gy - wob) * KW));
        const cov = thx > thy ? thx : thy;                              // mean ≈ 0.42
        const slub = 0.5 * nB.n2(gx * 0.33 + sd, gy * 0.012) + 0.5 * nB.n2(gx * 0.012 - sd, gy * 0.33);
        // the hole: bare gauze with the candle straight behind it; the cord crosses it as a soft red silhouette
        if (hole > 0) {
          const tc = 0.4 + 0.06 * twist + 0.2 * sstep(half - 4, half + 1, ape);
          t = L.lerp(t, L.lerp(0.84 + 0.13 * hot, tc, band * 0.9), hole);
        }
        t *= 1 - L.lerp(0.07, 0.26, hole) * (cov - 0.42) * 1.7 + 0.05 * slub;
        t *= gain;
        T = disc * t + (1 - disc) * T;
        A = disc + (1 - disc) * A;
      }
      if (A <= 0.003) continue;
      const li = ((cl01(T) * 511) | 0) * 3, o = (j * N + i) * 4;
      d[o] = lutV[li] + (lutC[li] - lutV[li]) * hue;
      d[o + 1] = lutV[li + 1] + (lutC[li + 1] - lutV[li + 1]) * hue;
      d[o + 2] = lutV[li + 2] + (lutC[li + 2] - lutV[li + 2]) * hue;
      d[o + 3] = A * 255;
    }
  }
  const cnv = L.makeCanvas(N, N);
  cnv.getContext('2d').putImageData(img, 0, 0);
  c.sprite = cnv; c.ox = ox; c.oy = oy;
}

/** the exposed cord between two coins: red strands with a gold thread laid in, lit from behind */
function drawRope(g, A, B) {
  const gap = Math.max(0, Math.hypot(B.x - A.x, B.y - A.y) - A.r - B.r), hA = A.r + gap * 0.4, hB = B.r + gap * 0.4;
  const P = [[A.x, A.y], [A.x + A.dx * hA, A.y + A.dy * hA], [B.x - B.dx * hB, B.y - B.dy * hB], [B.x, B.y]];
  const N = 90, pts = [], len = [0];
  for (let i = 0; i <= N; i++) {
    const t = i / N, u = 1 - t, b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t;
    pts.push([b0 * P[0][0] + b1 * P[1][0] + b2 * P[2][0] + b3 * P[3][0], b0 * P[0][1] + b1 * P[1][1] + b2 * P[2][1] + b3 * P[3][1]]);
  }
  for (let i = 1; i <= N; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = len[N], h = CW / 2;
  const at = (l) => {
    l = L.clamp(l, 0, total); let i = 1; while (i < N && len[i] < l) i++;
    const k = (l - len[i - 1]) / (len[i] - len[i - 1] || 1);
    let tx = pts[i][0] - pts[i - 1][0], ty = pts[i][1] - pts[i - 1][1]; const m = Math.hypot(tx, ty) || 1; tx /= m; ty /= m;
    return { x: L.lerp(pts[i - 1][0], pts[i][0], k), y: L.lerp(pts[i - 1][1], pts[i][1], k), nx: ty, ny: -tx };   // n points away from the circle centre ("up")
  };
  g.save(); g.lineJoin = 'round';
  g.lineCap = 'butt'; g.strokeStyle = '#3a0410'; g.lineWidth = CW - 1;
  g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
  g.lineCap = 'round';
  for (let pass = 0; pass < 2; pass++) {
    let k = 0;
    for (let l = -CW; l < total + CW; l += 5.2, k++) {
      const gold = k % 3 === 1;
      if (gold !== (pass === 1)) continue;
      const b = at(l - h * 0.9), m = at(l), t = at(l + h * 0.9);
      const bx = b.x - b.nx * h, by = b.y - b.ny * h, tx = t.x + t.nx * h, ty = t.y + t.ny * h;
      const gr = g.createLinearGradient(bx, by, tx, ty);
      if (gold) { gr.addColorStop(0, '#8a5612'); gr.addColorStop(0.42, '#E0B04A'); gr.addColorStop(0.8, '#ffe39a'); gr.addColorStop(1, '#fff4cc'); }
      else { gr.addColorStop(0, '#a8104c'); gr.addColorStop(0.4, '#c21a22'); gr.addColorStop(0.8, '#ff5636'); gr.addColorStop(1, '#ffa078'); }
      g.strokeStyle = gr; g.lineWidth = gold ? 2.7 : 4.4;
      g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(m.x, m.y, tx, ty); g.stroke();
    }
  }
  g.restore();
}

/** all coins and the cord on one layer, with a little bloom baked in */
function buildCoins(env, coins) {
  const a = env.arc;
  const nA = L.makeNoise('s11a'), nB = L.makeNoise('s11b');
  const lutV = mkLut([[0, '#1c0206'], [0.18, '#6a0a0e'], [0.34, '#b01614'], [0.5, '#E0301E'], [0.63, '#f84a26'], [0.75, '#FF6A3D'], [0.87, '#ff9648'], [1, '#ffd27c']]);
  const lutC = mkLut([[0, '#1a0210'], [0.18, '#5e0620'], [0.34, '#a00e2c'], [0.5, '#d01e34'], [0.63, '#ee3440'], [0.75, '#ff5a48'], [0.87, '#ff9058'], [1, '#ffcf8c']]);
  for (const c of coins) buildCoin(c, a, nA, nB, lutV, lutC);
  const layer = L.makeLayer(PAD, (g) => {
    for (let i = 0; i < coins.length - 1; i++) drawRope(g, coins[i], coins[i + 1]);
    for (const c of coins) g.drawImage(c.sprite, c.ox, c.oy);
  });
  const bloom = L.blurred(layer, 15), g = layer.getContext('2d');
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.6; g.drawImage(bloom, 0, 0); g.restore();
  return layer;
}

/** the silk bundle: everything below the arc */
function buildSilk(env, coins) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const X0 = -PAD, Y0 = Math.floor(a.crestY) - 4;
  const RW = W + PAD * 2, RH = H + PAD - Y0;
  const HS = 0.5, hw = Math.ceil(RW * HS), hh = Math.ceil(RH * HS);

  // 1) height map of the cloth, painted at half resolution: white = ridge, black = valley
  const hc = L.makeCanvas(hw, hh), hg = hc.getContext('2d');
  hg.fillStyle = '#808080'; hg.fillRect(0, 0, hw, hh);
  hg.setTransform(HS, 0, 0, HS, -X0 * HS, -Y0 * HS);                     // paint in frame coordinates
  hg.globalAlpha = 0.7;
  hg.drawImage(L.noiseTex(RW, RH, { seed: 's11drape', scale: 150, sx: 1, sy: 6.5, octaves: 3, res: 0.2, contrast: 1.35, polar: { cx: cx - X0, cy: cy - Y0, R } }), X0, Y0);
  hg.globalAlpha = 1;
  const rf = L.rng('s11folds');
  // one fold running toward the circle centre: starts v0 below the rim, widens as the cloth gathers
  const ridge = (s0, v0, w0, amp, bend, v1 = 1000) => {
    const le = [], ri = [];
    for (let v = v0; v <= v1; v += 14) {
      const k = v - v0, th = (s0 + bend * k + 6 * Math.sin(k / 110 + s0)) / R;
      const dth = Math.min(w0 * 3.2, w0 * (0.3 + k / 240)) / (R - v);
      le.push(a.pt(th - dth, -v)); ri.push(a.pt(th + dth, -v));
    }
    hg.beginPath(); le.forEach((p, i) => (i ? hg.lineTo(p.x, p.y) : hg.moveTo(p.x, p.y)));
    for (let i = ri.length - 1; i >= 0; i--) hg.lineTo(ri[i].x, ri[i].y);
    hg.closePath();
    const c = amp > 0 ? '255,255,255' : '0,0,0', al = Math.abs(amp);
    hg.fillStyle = L.radial(hg, cx, cy, R - v0 - 190, R - v0, [[0, `rgba(${c},${al})`], [1, `rgba(${c},0)`]]);
    hg.fill();
  };
  for (let s = -1330; s < 1330;) {
    s += rf.range(170, 360);
    const v0 = rf.range(24, 130), w0 = rf.range(12, 30), amp = rf.range(0.55, 0.95), bend = rf.range(-0.05, 0.05);
    ridge(s, v0, w0, amp, bend);
    ridge(s + rf.sign() * w0 * rf.range(1.7, 2.4), v0 + 30, w0 * 0.85, -amp * 0.75, bend);
    if (rf.chance(0.5)) ridge(s + rf.range(-60, 60), v0 + rf.range(160, 320), w0 * 0.55, amp * 0.7, bend + rf.range(-0.12, 0.12));
  }
  // every coin dents the cushion and pulls short wrinkles out of it
  for (const c of coins) {
    const chord = c.r * Math.sqrt(1 - c.k * c.k);
    a.at(hg, c.th, 0, () => {
      hg.save(); hg.scale(1, 0.3);
      hg.fillStyle = L.radial(hg, 0, 30, 0, chord * 1.3, [[0, 'rgba(0,0,0,0.62)'], [0.6, 'rgba(0,0,0,0.3)'], [1, 'rgba(0,0,0,0)']]);
      hg.beginPath(); hg.arc(0, 30, chord * 1.3, 0, L.TAU); hg.fill(); hg.restore();
      const n = 6;
      for (let k = 0; k < n; k++) {
        const u = ((k + rf.range(0.2, 0.8)) / n) * 2 - 1, x0 = u * chord * 1.08, ang = u * 0.95 + rf.range(-0.12, 0.12), len = c.r * rf.range(0.55, 1.45);
        const ex = x0 + Math.sin(ang) * len, ey = 6 + Math.cos(ang) * len, wx = Math.cos(ang) * 5, wy = -Math.sin(ang) * 5;
        hg.fillStyle = 'rgba(255,255,255,0.6)';
        hg.beginPath(); hg.moveTo(x0 - wx, 6 - wy); hg.lineTo(x0 + wx, 6 + wy); hg.lineTo(ex, ey); hg.closePath(); hg.fill();
        hg.fillStyle = 'rgba(0,0,0,0.5)';
        hg.beginPath(); hg.moveTo(x0 + wx, 6 + wy); hg.lineTo(x0 + wx * 3, 6 + wy * 3); hg.lineTo(ex + wx * 0.6, ey + wy * 0.6); hg.closePath(); hg.fill();
      }
    });
  }
  const hb = L.makeCanvas(hw, hh), bg = hb.getContext('2d', { willReadFrequently: true });
  bg.fillStyle = '#808080'; bg.fillRect(0, 0, hw, hh);
  bg.filter = 'blur(3.4px)'; bg.drawImage(hc, 0, 0); bg.filter = 'none';
  const hd = bg.getImageData(0, 0, hw, hh).data;
  const Hm = new Float32Array(hw * hh), GX = new Float32Array(hw * hh), GY = new Float32Array(hw * hh);
  for (let k = 0; k < hw * hh; k++) Hm[k] = hd[k * 4] / 255;
  for (let j = 0; j < hh; j++) for (let i = 0; i < hw; i++) {
    const k = j * hw + i;
    GX[k] = (Hm[k + (i < hw - 1 ? 1 : 0)] - Hm[k - (i > 0 ? 1 : 0)]) * 0.25;   // per full-res px
    GY[k] = (Hm[k + (j < hh - 1 ? hw : 0)] - Hm[k - (j > 0 ? hw : 0)]) * 0.25;
  }

  // 2) shade
  const LUT = mkLut([[0, '#10010a'], [0.14, '#3a0520'], [0.3, '#780a40'], [0.46, '#C2186A'], [0.6, '#dc2076'], [0.72, '#f0408c'], [0.84, '#ff80b0'], [0.93, '#ffc2d6'], [1, '#fff0f3']]);
  const nF = L.makeNoise('s11fuzz'), nS = L.makeNoise('s11slub');
  const img = new ImageData(RW, RH), d = img.data;
  const LX = -0.62, LY = -0.78, KL = 15, KS = L.TAU / 3.2;
  for (let j = 0; j < RH; j++) {
    const ddy = cy - (Y0 + j + 0.5);
    const fyh = Math.min(hh - 1.001, Math.max(0, (j + 0.5) * HS - 0.5)), j0 = fyh | 0, ty = fyh - j0;
    for (let i = 0; i < RW; i++) {
      const ddx = X0 + i + 0.5 - cx, rr = Math.sqrt(ddx * ddx + ddy * ddy), dr = rr - R;
      if (dr > 3) continue;
      const s = Math.atan2(ddx, ddy) * R;
      let v = -dr, al = 1;
      if (v < 4) {                                                      // the limb: a slightly fibrous edge, not a ruled line
        const fz = 0.8 * nF.n2(s * 0.42, 1.7) + 0.5 * nF.n2(s * 0.08, 5.1);
        al = cl01(0.5 + (v + fz) * 0.9);
        if (al <= 0) continue;
      }
      if (v < 0) v = 0;
      const fxh = Math.min(hw - 1.001, Math.max(0, (i + 0.5) * HS - 0.5)), i0 = fxh | 0, tx = fxh - i0, k = j0 * hw + i0;
      const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
      const gx = GX[k] * w00 + GX[k + 1] * w10 + GX[k + hw] * w01 + GX[k + hw + 1] * w11;
      const gy = GY[k] * w00 + GY[k + 1] * w10 + GY[k + hw] * w01 + GY[k + hw + 1] * w11;
      const hgt = Hm[k] * w00 + Hm[k + 1] * w10 + Hm[k + hw] * w01 + Hm[k + hw + 1] * w11;
      let lam = -(gx * LX + gy * LY) * KL; lam = lam < -0.34 ? -0.34 : lam > 0.34 ? 0.34 : lam;
      const sp = (lam - 0.2) / 0.11, spec = Math.exp(-sp * sp);
      const deep = sstep(30, 560, v);
      const rimVar = 0.86 + 0.14 * nF.n2(s / 70, 9.3);
      let tone = 0.53 - 0.29 * deep + 0.5 * Math.exp(-v / 7) * rimVar + 0.15 * Math.exp(-v / 50) - 0.05 * s * s * 1e-6;
      tone += sstep(4, 60, v) * (0.95 * lam + 0.12 * spec * (1 - 0.6 * deep) + 0.26 * (hgt - 0.5));
      // weave: warp threads run toward the circle centre, weft threads follow the arc; a few thick threads in both
      tone += 0.02 * (Math.cos(s * KS) + Math.cos(v * KS)) * 0.5 + 0.024 * nS.n2(s * 0.004, v * 0.36) + 0.018 * nS.n2(s * 0.36 + 40, v * 0.006);
      const li = ((cl01(tone) * 511) | 0) * 3, o = (j * RW + i) * 4;
      d[o] = LUT[li]; d[o + 1] = LUT[li + 1]; d[o + 2] = LUT[li + 2]; d[o + 3] = al * 255;
    }
  }
  const cnv = L.makeCanvas(RW, RH);
  cnv.getContext('2d').putImageData(img, 0, 0);
  const layer = L.makeLayer(PAD, (g) => { g.drawImage(cnv, X0, Y0); });

  // 3) the coins' light soaks into the cloth under them
  const spill = L.makeLayer(PAD, (g) => {
    for (const c of coins) {
      const rad = c.r * 2.2;
      g.fillStyle = L.radial(g, c.x, c.y, c.r * 0.3, rad, [[0, 'rgba(255,96,48,0.6)'], [0.45, 'rgba(255,72,48,0.24)'], [1, 'rgba(255,60,60,0)']]);
      g.fillRect(c.x - rad, c.y - rad, rad * 2, rad * 2);
    }
  });
  L.overlayOn(layer, spill, { blend: 'screen', alpha: 0.8 });

  // 4) the back light blooms a little way over the rim
  const g = layer.getContext('2d');
  g.save(); a.clipAbove(g, -1);
  g.fillStyle = L.radial(g, cx, cy, R - 2, R + 84, [[0, 'rgba(255,150,200,0.5)'], [0.07, 'rgba(255,84,160,0.27)'], [0.3, 'rgba(232,40,128,0.1)'], [1, 'rgba(194,24,106,0)']]);
  g.globalCompositeOperation = 'destination-over';
  g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
  g.restore();
  return layer;
}

/** red dust hanging in the dark above the rim, thicker where the back light catches it */
function buildDust(env, seed, count, big) {
  const a = env.arc;
  return L.makeLayer(PAD, (g) => {
    const r = L.rng(seed);
    for (let n = 0; n < count; n++) {
      const x = r.range(-PAD, W + PAD), up = Math.pow(r(), 1.7) * 640 + 16, y = a.yAt(x) - up;
      const rad = big ? r.range(5, 14) : L.lerp(0.7, 2.6, Math.pow(r(), 2.2));
      const al = (big ? r.range(0.06, 0.17) : r.range(0.3, 0.95)) * (1 - up / 820);
      const col = r.pick(['#E0301E', '#FF6A3D', '#C2186A', '#ff3a52']);
      g.fillStyle = big ? L.radial(g, x, y, rad * 0.4, rad, [[0, L.rgba(col, al)], [0.8, L.rgba(col, al * 0.85)], [1, L.rgba(col, 0)]]) : L.rgba(col, al);
      g.beginPath(); g.arc(x, y, rad, 0, L.TAU); g.fill();
    }
  });
}

export default {
  name: '红绳压岁钱',
  tone: 'light',
  init(env) {
    const coins = layout(env.arc);
    S = { coins, coinLayer: buildCoins(env, coins), silk: buildSilk(env, coins), dust: buildDust(env, 's11dust', 230, false), bokeh: buildDust(env, 's11bokeh', 18, true) };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.011, 0.011, p);
    ctx.fillStyle = '#050304'; ctx.fillRect(0, 0, W, H);
    L.blit(ctx, env, S.bokeh, { rot: rot * 0.35 });
    L.blit(ctx, env, S.dust, { rot: rot * 0.6, dy: -6 * p });
    L.blit(ctx, env, S.coinLayer, { rot });
    // the candle behind wavers: each disc swells and sinks in turn along the string
    const fl = (c) => 0.5 + 0.5 * Math.sin(L.TAU * (p * 1.15 - c.i * 0.19) + 0.6);
    L.cam(ctx, env, { rot }, () => {
      ctx.globalCompositeOperation = 'lighter';
      for (const c of S.coins) { ctx.globalAlpha = 0.06 + 0.3 * fl(c); ctx.drawImage(c.sprite, c.ox, c.oy); }
    });
    L.blit(ctx, env, S.silk, { rot });
    // … and so does the glow each one sheds on the silk beneath it
    L.cam(ctx, env, { rot }, () => {
      a.clipBelow(ctx, -1.5);
      ctx.globalCompositeOperation = 'lighter';
      for (const c of S.coins) {
        const rad = c.r * 1.9, f = fl(c);
        ctx.fillStyle = L.radial(ctx, c.x, c.y, c.r * 0.3, rad, [[0, `rgba(255,90,40,${0.05 + 0.2 * f})`], [1, 'rgba(255,60,50,0)']]);
        ctx.fillRect(c.x - rad, c.y - rad, rad * 2, rad * 2);
      }
    });
  },
};
