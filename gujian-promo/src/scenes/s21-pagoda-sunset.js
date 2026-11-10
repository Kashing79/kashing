// s21 — 古塔夕照. The arc is a wooded ridge at sundown: a near-black hill whose rim is a fuzz of tree crowns,
// a seven-storey pavilion-style pagoda (楼阁式塔) standing on it in front of the half-set sun, a tiny pavilion
// far along the ridge, a few birds going home. Sky: ember orange hugging the ridge → crimson → dark plum.
// Layers: sky (per-pixel "heat" field + sun) / lit cirrus / dark horizon streaks / birds (live) / hill + buildings.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 240;
const INK = '#0a0506';
const TOWER_X = 480;      // pagoda axis at mid-shot — well clear of the tagline zone (x ≥ 630)
const PAV_X = 1574;       // the little pavilion, far along the ridge on the other side
let S = null;

const sunOf = (a) => ({ x: 446, y: a.yAt(446) - 50, r: 94 });

// "heat" → colour. 0 = cold plum at the top of the sky, ~0.88 = the ember band on the ridge, >1 = glare round the sun
const HEAT = [
  [0.0, '#10040a'], [0.1, '#1e060e'], [0.2, '#3a0a14'], [0.34, '#621018'], [0.48, '#8a171a'], [0.6, '#b0201a'],
  [0.7, '#d0351a'], [0.8, '#ee511c'], [0.88, '#ff6a1f'], [0.98, '#ff8a32'], [1.1, '#ffb25a'],
];

// ───────────────────────── sky ─────────────────────────
function buildSky(env) {
  const a = env.arc, sun = sunOf(a);
  const LW = W + PAD * 2, LH = H + PAD * 2, res = 0.25;
  const cw = Math.round(LW * res), ch = Math.round(LH * res);
  const ramp = L.makeRamp(HEAT);
  const NL = 2048, TMAX = 1.1;
  const lut = new Uint8ClampedArray(NL * 3);
  for (let i = 0; i < NL; i++) { const c = ramp((i / (NL - 1)) * TMAX); lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2]; }
  const nz = L.makeNoise('s21sky');
  const img = new ImageData(cw, ch); const d = img.data;
  let k = 0;
  for (let j = 0; j < ch; j++) {
    const y = (j + 0.5) / res - PAD;
    for (let i = 0; i < cw; i++) {
      const x = (i + 0.5) / res - PAD;
      const dr = Math.max(0, a.drAt(x, y));
      // bands hugging the ridge: a thin ember line, a quick fall to crimson, a long tail into plum
      let t = 0.11 + 0.15 * Math.exp(-dr / 16) + 0.3 * Math.exp(-dr / 60) + 0.34 * Math.exp(-dr / 330);
      // the sun's haze: wide along the horizon, and leaning into the upper-left sky
      const ds = Math.hypot((x - sun.x) / 1.55, y - sun.y);
      const lean = 0.35 + 0.65 * L.smooth((sun.x + 700 - x) / 700);
      t += 0.34 * Math.exp(-ds / 230) + 0.1 * Math.exp(-ds / 80) + 0.28 * lean * Math.exp(-ds / 650);
      // the far side of the sky sinks toward plum
      t -= 0.1 * L.smooth((x - 1050) / 1000) * (0.4 + 0.6 * L.clamp(dr / 300));
      // slow breathing so it is not a mathematically clean gradient
      t += 0.028 * nz.fbm(x / 900, y / 240, 3);
      // soft shoulder so the glare never burns out flat
      if (t > 0.8) t = 0.8 + 0.3 * (1 - Math.exp(-(t - 0.8) / 0.3));
      const li = Math.min(NL - 1, Math.max(0, ((t / TMAX) * (NL - 1)) | 0)) * 3;
      d[k++] = lut[li]; d[k++] = lut[li + 1]; d[k++] = lut[li + 2]; d[k++] = 255;
    }
  }
  const small = L.makeCanvas(cw, ch); small.getContext('2d').putImageData(img, 0, 0);
  return L.makeLayer(PAD, (g) => {
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(small, -PAD, -PAD, LW, LH);
    // halo
    g.save(); g.globalCompositeOperation = 'lighter';
    g.fillStyle = L.radial(g, sun.x, sun.y, sun.r * 0.8, sun.r * 2.7, [[0, 'rgba(255,170,90,0.5)'], [0.3, 'rgba(255,130,50,0.2)'], [1, 'rgba(255,90,20,0)']]);
    g.fillRect(sun.x - 320, sun.y - 320, 640, 640);
    g.restore();
    // the disc: soft-edged, a little flattened by the thick air
    g.save();
    g.filter = 'blur(2.4px)';
    g.translate(sun.x, sun.y); g.scale(1, 0.95);
    g.fillStyle = L.radial(g, 0, -sun.r * 0.12, 0, sun.r, [[0, '#fff6d2'], [0.5, '#ffe7a6'], [0.84, '#ffcd72'], [1, '#ffb04a']]);
    g.beginPath(); g.arc(0, 0, sun.r, 0, L.TAU); g.fill();
    g.restore();
    // bars of cloud lying across it
    g.save(); g.filter = 'blur(3px)';
    const bars = [[-64, 2.2, 120, 0.5, 30], [-33, 4.6, 200, 0.72, -24], [-22, 2, 150, 0.5, 60], [6, 7, 260, 0.78, 20], [21, 2.4, 170, 0.55, -50]];
    for (const [dy, ry, rx, al, ox] of bars) {
      g.fillStyle = L.rgba('#c2301a', al);
      g.beginPath(); g.ellipse(sun.x + ox, sun.y + dy, rx, ry, -0.012, 0, L.TAU); g.fill();
    }
    g.restore();
  });
}

// ───────────────────────── clouds ─────────────────────────
function buildClouds(env) {
  const a = env.arc, sun = sunOf(a);
  const LW = W + PAD * 2, LH = 860 + PAD;            // only the part above the ridge is ever seen
  const mask = (seed, scale, sx, sy, lo, hi) => L.noiseTex(LW, LH, {
    seed, scale, sx, sy, octaves: 4, gain: 0.55, warp: 0.55, warpScale: 3, contrast: 1.55, res: 0.5,
    ramp: [[0, 'rgba(255,255,255,0)'], [lo, 'rgba(255,255,255,0)'], [hi, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,1)']],
  });
  // the tagline's pocket stays quiet
  const pocket = (g, strength) => {
    g.save(); g.globalCompositeOperation = 'destination-out';
    g.translate(a.cx + PAD, a.crestY - 135 + PAD); g.scale(1, 0.5);
    g.fillStyle = L.radial(g, 0, 0, 170, 560, [[0, `rgba(0,0,0,${strength})`], [1, 'rgba(0,0,0,0)']]);
    g.fillRect(-620, -620, 1240, 1240);
    g.restore();
  };
  // 1) high cirrus, lit from below: brighter than the sky behind it
  const lit = mask('s21cirrus', 44, 30, 0.75, 0.5, 0.86);
  let g = lit.getContext('2d');
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = L.radial(g, sun.x + PAD, sun.y + PAD, 0, 1700, [[0, '#ffc27a'], [0.16, '#ff8a40'], [0.38, '#e2502c'], [0.7, '#a02c24'], [1, '#5e1a20']]);
  g.fillRect(0, 0, LW, LH);
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = L.radial(g, a.cx + PAD, a.cy + PAD, a.R, a.R + 900, [[0, 'rgba(0,0,0,0)'], [0.09, 'rgba(0,0,0,0.2)'], [0.24, 'rgba(0,0,0,1)'], [0.7, 'rgba(0,0,0,0.85)'], [1, 'rgba(0,0,0,0.45)']]);
  g.fillRect(0, 0, LW, LH);
  pocket(g, 0.85);
  lit._pad = PAD;
  // 2) low streaks across the ember band: darker than the sky behind them
  const dark = mask('s21streak', 58, 24, 0.8, 0.52, 0.8);
  g = dark.getContext('2d');
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#4a0d12'; g.fillRect(0, 0, LW, LH);
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = L.radial(g, a.cx + PAD, a.cy + PAD, a.R, a.R + 240, [[0, 'rgba(0,0,0,0)'], [0.06, 'rgba(0,0,0,0.55)'], [0.3, 'rgba(0,0,0,0.8)'], [0.62, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,0)']]);
  g.fillRect(0, 0, LW, LH);
  pocket(g, 0.8);
  dark._pad = PAD;
  return { lit: L.blurred(lit, 0.8), dark: L.blurred(dark, 1.2) };
}

// ───────────────────────── buildings ─────────────────────────
/**
 * 楼阁式塔 in silhouette: 台基, seven storeys that shrink as they climb, each with its 塔身, 平座 + 栏杆, 檐柱 and an
 * upturned 腰檐; 攒尖 top roof; 塔刹 (覆钵, 刹杆, 相轮, 宝盖, 宝珠). Local units ≈ px at k = 1; y is measured UP from the base.
 */
function drawPagoda(g, cx, by, k) {
  const X = (x) => cx + x * k, Y = (y) => by - y * k;
  const rect = (x, y, w, h) => g.fillRect(X(x), Y(y + h), w * k, h * k);
  const N = 7;
  const doors = [], glints = [];
  g.fillStyle = INK;
  rect(-72, 0, 144, 6); rect(-63, 6, 126, 6);                      // 台基
  let y = 12, bw = 44, h = 58, e = 30;
  for (let i = 0; i < N; i++) {
    const T = y + h, rH = h * 0.26, last = i === N - 1;
    const tipX = bw + e, tipY = T - rH * 0.6;
    // 塔身, with a slight batter
    g.beginPath(); g.moveTo(X(-bw), Y(y)); g.lineTo(X(-bw * 0.965), Y(T)); g.lineTo(X(bw * 0.965), Y(T)); g.lineTo(X(bw), Y(y)); g.closePath(); g.fill();
    // 檐柱 of the surrounding gallery, 平座 slab and 栏杆
    const col = bw + 7.6;
    for (const s of [-1, 1]) rect(s * col - 1.15, y, 2.3, h - rH * 1.02);
    if (i > 0) {
      rect(-col - 2.2, y - 1.2, (col + 2.2) * 2, 3.6);
      rect(-col, y + 8.2, col * 2, 1.7);
      for (const s of [-1, 1]) rect(s * (bw + 3.5) - 0.65, y, 1.3, 8.4);
    }
    // 腰檐: a thin concave wing, tip turned up; 斗栱 wedge beneath it
    for (const s of [-1, 1]) {
      g.beginPath();
      if (last) {
        g.moveTo(X(0), Y(T + 31));
        g.bezierCurveTo(X(s * bw * 0.26), Y(T + 9), X(s * (bw + e * 0.4)), Y(T - rH * 0.98), X(s * tipX), Y(tipY));
      } else {
        g.moveTo(X(s * bw * 0.8), Y(T - 1));
        g.quadraticCurveTo(X(s * (bw + e * 0.45)), Y(T - rH), X(s * tipX), Y(tipY));
      }
      g.quadraticCurveTo(X(s * (bw + e * 0.55)), Y(T - rH * 1.34), X(s * (bw + 1)), Y(T - rH * 1.08 - 2));
      g.lineTo(X(s * (bw - 2)), Y(T - rH * 1.08 - 12));
      g.lineTo(X(0), Y(T - rH * 1.08 - 12));
      g.lineTo(X(0), Y(last ? T + 31 : T - 1));
      g.closePath(); g.fill();
      g.beginPath(); g.moveTo(X(s * (bw - 2)), Y(T - rH * 1.08 - 13)); g.lineTo(X(s * (bw + e * 0.44)), Y(T - rH * 1.2)); g.lineTo(X(s * (bw - 2)), Y(T - rH)); g.closePath(); g.fill();
      // 风铎 under the corner
      rect(s * (tipX - 2.2) - 0.45, tipY - 5.5, 0.9, 5);
      g.beginPath(); g.arc(X(s * (tipX - 2.2)), Y(tipY - 6.6), 1.6 * k, 0, L.TAU); g.fill();
      glints.push({ s, bw, e, T, rH, tipX, tipY, last });
    }
    doors.push({ y: y + (i ? 3.4 : 2), w: bw * 0.27, h: h * 0.36 });
    if (last) {
      // 塔刹
      const y0 = T + 30;
      rect(-7.5, y0 - 1, 15, 3.6);
      g.beginPath(); g.ellipse(X(0), Y(y0 + 2.4), 6.4 * k, 6.8 * k, 0, Math.PI, 0); g.fill();        // 覆钵
      rect(-1.15, y0 + 6, 2.3, 70);                                                                   // 刹杆
      for (let j = 0; j < 7; j++) {                                                                   // 相轮
        const hw = L.lerp(10.6, 5.4, j / 6), yy = y0 + 16 + j * 6.3;
        g.beginPath(); g.ellipse(X(0), Y(yy + 1.6), hw * k, 1.75 * k, 0, 0, L.TAU); g.fill();
      }
      g.beginPath(); g.moveTo(X(-8.4), Y(y0 + 60.6)); g.quadraticCurveTo(X(0), Y(y0 + 66.6), X(8.4), Y(y0 + 60.6)); g.closePath(); g.fill();   // 宝盖
      g.beginPath(); g.arc(X(0), Y(y0 + 69.6), 3.5 * k, 0, L.TAU); g.fill();                          // 宝珠
      g.beginPath(); g.moveTo(X(-1.5), Y(y0 + 72)); g.lineTo(X(0), Y(y0 + 84)); g.lineTo(X(1.5), Y(y0 + 72)); g.closePath(); g.fill();
    }
    y = T; bw *= 0.9; h *= 0.93; e *= 0.94;
  }
  // 券门: the doorways line up through the core, so the sky shows through
  g.save(); g.globalCompositeOperation = 'destination-out';
  for (const d of doors) {
    const hw = d.w / 2;
    g.beginPath(); g.moveTo(X(-hw), Y(d.y)); g.lineTo(X(-hw), Y(d.y + d.h - hw)); g.arc(X(0), Y(d.y + d.h - hw), hw * k, Math.PI, 0); g.lineTo(X(hw), Y(d.y)); g.closePath(); g.fill();
  }
  g.restore();
  // the roof slopes face the sky and catch a thread of its colour
  g.save(); g.lineCap = 'round';
  for (const q of glints) {
    const { s, bw: b, e: ev, T, rH, tipX, tipY, last } = q;
    g.beginPath();
    if (last) { g.moveTo(X(s * 1.5), Y(T + 27)); g.bezierCurveTo(X(s * b * 0.26), Y(T + 7.6), X(s * (b + ev * 0.4)), Y(T - rH * 0.98 - 1.4), X(s * (tipX - 2)), Y(tipY - 1.6)); }
    else { g.moveTo(X(s * (b * 0.9 + 9)), Y(T - 5)); g.quadraticCurveTo(X(s * (b + ev * 0.5)), Y(T - rH - 1.2), X(s * (tipX - 2)), Y(tipY - 1.6)); }
    g.strokeStyle = 'rgba(255,128,56,0.5)'; g.lineWidth = 1.2 * k; g.stroke();
  }
  g.restore();
}

/** a small open pavilion (亭): 台基, four posts, bench rails in the side bays, 额枋, 攒尖 roof with a 宝顶 */
function drawPavilion(g, cx, by, k) {
  const X = (x) => cx + x * k, Y = (y) => by - y * k;
  const rect = (x, y, w, h) => g.fillRect(X(x), Y(y + h), w * k, h * k);
  g.fillStyle = INK;
  rect(-37, 0, 74, 5);
  for (const x of [-27, -10, 10, 27]) rect(x - 1.6, 5, 3.2, 34);
  for (const s of [-1, 1]) { rect(s > 0 ? 10 : -27, 5, 17, 2.2); rect(s > 0 ? 10 : -27, 12, 17, 1.7); rect(s * 18.5 - 0.6, 5, 1.2, 8); }
  rect(-29, 33.5, 58, 6.5);
  for (const x of [-27, -10, 10, 27]) for (const s of [-1, 1]) {   // 雀替
    g.beginPath(); g.moveTo(X(x), Y(34)); g.lineTo(X(x + s * 6.5), Y(34)); g.lineTo(X(x), Y(27.5)); g.closePath(); g.fill();
  }
  for (const s of [-1, 1]) {
    g.beginPath(); g.moveTo(X(0), Y(79));
    g.bezierCurveTo(X(s * 7), Y(56), X(s * 27), Y(42.5), X(s * 48), Y(47.5));
    g.quadraticCurveTo(X(s * 28), Y(37), X(0), Y(39));
    g.closePath(); g.fill();
  }
  rect(-1.7, 77, 3.4, 6); g.beginPath(); g.arc(X(0), Y(86), 3.7 * k, 0, L.TAU); g.fill();
  g.save(); g.lineCap = 'round'; g.strokeStyle = 'rgba(214,80,36,0.42)'; g.lineWidth = 1.1 * k;
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(X(s * 2), Y(75)); g.bezierCurveTo(X(s * 7), Y(55), X(s * 27), Y(41.3), X(s * 46), Y(45.8)); g.stroke(); }
  g.restore();
}

/** a ridge pine: leaning trunk, flat pads of needles */
function drawPine(g, x, by, hgt, lean, seed) {
  const r = L.rng(seed);
  const tx = (u) => x + lean * hgt * u * u + Math.sin(u * 5 + hgt) * hgt * 0.022;
  const pts = [];
  for (let i = 0; i <= 6; i++) { const u = i / 6; pts.push([tx(u), by + 5 - (hgt + 5) * u]); }
  L.inkStroke(g, pts, { width: Math.max(2.6, hgt * 0.075), color: INK, taper: [0, 0.6], wobble: 0.25, seed: 5 });
  g.fillStyle = INK; g.strokeStyle = INK;
  const n = 5;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1), u = 0.46 + 0.54 * f;
    const side = i === n - 1 ? 0 : (i % 2 ? 1 : -1) * (lean >= 0 ? 1 : -1);
    const px = tx(u) + side * hgt * L.lerp(0.33, 0.1, f), py = by - hgt * u;
    g.lineWidth = Math.max(1, hgt * 0.022);
    g.beginPath(); g.moveTo(tx(u - 0.07), by - hgt * (u - 0.07)); g.lineTo(px, py + 1); g.stroke();
    const rx = hgt * L.lerp(0.3, 0.16, f), ry = Math.max(2.2, rx * 0.2);
    for (let j = 0; j < 6; j++) {
      g.beginPath(); g.ellipse(px + r.range(-0.6, 0.6) * rx, py + r.range(-0.6, 0.25) * ry, rx * r.range(0.35, 0.62), ry * r.range(0.7, 1.15), r.range(-0.12, 0.12), 0, L.TAU); g.fill();
    }
  }
}

// ───────────────────────── the hill ─────────────────────────
function buildHill(env) {
  const a = env.arc, sun = sunOf(a);
  return L.makeLayer(PAD, (g) => {
    const s = a.span(PAD + 160);
    // 1) things standing on the ridge (drawn first; the tree line then buries their feet)
    drawPagoda(g, TOWER_X, a.yAt(TOWER_X) + 3, 1);
    drawPavilion(g, PAV_X, a.yAt(PAV_X) + 2, 0.8);
    drawPine(g, PAV_X + 78, a.yAt(PAV_X + 78), 62, 0.2, 's21pineA');
    drawPine(g, PAV_X + 112, a.yAt(PAV_X + 112), 40, -0.16, 's21pineB');
    drawPine(g, 236, a.yAt(236), 54, -0.2, 's21pineC');

    // 2) the hill mass
    g.fillStyle = INK; a.pathBelow(g, -2); g.fill();

    // 3) tree crowns: the first row is the fuzzy skyline (it pokes 1–6 px above the arc); the rows below it
    //    overlap like scales down the slope, each catching a fading rim of the sky's colour on its upper edge
    const r = L.rng('s21canopy');
    const crown = (cx, cy, rad, lobesN, depth) => {
      const prox = Math.exp(-Math.abs(cx - sun.x) / 420);
      const col = L.mix('#8e2414', '#ff8c3c', prox);
      const al = (0.3 + 0.55 * prox) * Math.exp(-depth / 30);
      const lobes = [[0, 0, rad]];
      for (let i = 0; i < lobesN; i++) {
        const ang = (i % 2 ? 1 : -1) * r.range(0.45, 1.15), rr = rad * r.range(0.42, 0.62), dd = rad - rr * r.range(0.6, 0.92);
        lobes.push([Math.sin(ang) * dd, -Math.cos(ang) * dd, rr]);
      }
      for (const [ox, oy, rr] of lobes) {
        g.fillStyle = INK; g.beginPath(); g.arc(cx + ox, cy + oy, rr, 0, L.TAU); g.fill();
        if (al > 0.02) {
          g.strokeStyle = L.rgba(col, al); g.lineWidth = r.range(0.9, 1.6);
          g.setLineDash([r.range(2, 7), r.range(1, 3.5)]);
          g.beginPath(); g.arc(cx + ox, cy + oy, rr - 0.9, -Math.PI * r.range(0.8, 0.95), -Math.PI * r.range(0.08, 0.25)); g.stroke();
        }
      }
      g.setLineDash([]);
    };
    // taller trees gathered at the feet of the buildings: [x, radius, how far the crown tops out above the arc]
    const big = [
      [TOWER_X - 118, 13, 9], [TOWER_X - 92, 18, 18], [TOWER_X - 66, 13, 12], [TOWER_X + 68, 14, 13], [TOWER_X + 93, 19, 19], [TOWER_X + 121, 13, 10], [TOWER_X + 146, 10, 7],
      [PAV_X - 52, 12, 10], [PAV_X - 36, 9, 7], [PAV_X + 44, 13, 11], [208, 11, 8], [262, 12, 9],
    ];
    for (const [x, rad, lift] of big) crown(x, a.yAt(x) + rad - lift, rad, 4, 0);
    const depths = [0, 6, 13, 21, 30, 40, 52, 66, 82, 100];
    depths.forEach((depth, row) => {
      let u = -s * a.R + r.range(0, 12);
      while (u < s * a.R) {
        const rad = r.range(5.5, 11.5) * (1 + row * 0.07);
        const lift = row === 0 ? r.range(1.5, 6.2) : r.range(-2.5, 2.5);
        const c = a.pt(u / a.R, lift - rad - depth);
        crown(c.x, c.y, rad, 2, depth);
        u += rad * r.range(1.05, 1.85);
      }
    });

    // 4) nearer slopes stepping toward the camera, a breath of warm haze caught behind each
    g.save(); a.clipBelow(g, -14);
    const nz = L.makeNoise('s21ridge');
    const ridges = [[165, 34, 1.3, '#080405', 0.2], [315, 46, 1.9, '#060304', 0.16], [480, 60, 2.6, '#040203', 0.12]];
    ridges.forEach(([drop, amp, freq, col, haze], k) => {
      const pts = [];
      for (let i = 0; i <= 260; i++) {
        const x = L.lerp(-PAD - 30, W + PAD + 30, i / 260);
        const y = a.yAt(L.clamp(x, a.cx - a.R * 0.7, a.cx + a.R * 0.7)) + drop + amp * nz.fbm((i / 260) * freq * 3 + k * 7.3, k * 3.1, 4)
          + 2.5 * nz.n2(i * 0.83, k + 0.5) + (k % 2 ? 1 : -1) * (x - a.cx) * 0.045;
        pts.push([x, y]);
      }
      g.save(); g.globalCompositeOperation = 'screen';
      for (let i = 0; i < pts.length; i += 7) {
        const p = pts[i], prox = Math.exp(-Math.abs(p[0] - sun.x) / 900);
        g.fillStyle = L.radial(g, p[0], p[1] - 6, 0, 170, [[0, `rgba(128,36,18,${haze * (0.45 + 0.55 * prox)})`], [1, 'rgba(128,36,18,0)']]);
        g.fillRect(p[0] - 170, p[1] - 176, 340, 340);
      }
      g.restore();
      g.fillStyle = col;
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts) g.lineTo(p[0], p[1]);
      g.lineTo(W + PAD + 30, H + PAD * 2); g.lineTo(-PAD - 30, H + PAD * 2); g.closePath(); g.fill();
    });
    // the last light spilling over the ridge near the sun
    g.globalCompositeOperation = 'screen';
    g.fillStyle = L.radial(g, sun.x, a.yAt(sun.x), 0, 620, [[0, 'rgba(150,40,16,0.34)'], [0.35, 'rgba(110,26,14,0.14)'], [1, 'rgba(90,20,12,0)']]);
    g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    g.restore();
  });
}

// ───────────────────────── birds ─────────────────────────
const BIRDS = [ // x, y, size, flap phase
  [1392, 262, 1.0, 0.0], [1452, 298, 0.82, 1.7], [1518, 250, 0.7, 3.1], [1588, 320, 0.9, 4.4], [1664, 278, 0.6, 2.3], [1352, 338, 0.58, 5.2], [1738, 356, 0.5, 0.9],
  [226, 316, 0.6, 2.9], [286, 350, 0.48, 4.0],
];
function drawBird(ctx, x, y, s, flap) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.06); ctx.scale(s, s);
  ctx.beginPath();
  for (const sd of [-1, 1]) {
    const tx = sd * 15, ty = -7.5 * flap - 1, mx = sd * 7, my = -4 - 3.5 * flap;
    ctx.moveTo(0, -0.6); ctx.quadraticCurveTo(mx, my - 2.3, tx, ty); ctx.quadraticCurveTo(mx, my + 1.3, 0, 1.7);
  }
  ctx.fill();
  ctx.beginPath(); ctx.ellipse(-0.5, 0.6, 4.4, 1.8, 0.12, 0, L.TAU); ctx.fill();
  ctx.restore();
}

export default {
  name: '古塔夕照',
  tone: 'light',
  init(env) {
    const clouds = buildClouds(env);
    S = { sky: buildSky(env), lit: clouds.lit, dark: clouds.dark, hill: buildHill(env) };
  },
  draw(ctx, env, p) {
    const a = env.arc, sun = sunOf(a);
    const rot = L.lerp(-0.006, 0.006, p), zoom = L.lerp(1.0, 1.02, p);
    L.blit(ctx, env, S.sky, { rot: rot * 0.15, zoom: 1 + (zoom - 1) * 0.3 });
    // cloud parallax: the high cirrus barely moves, the low streaks slide the other way
    L.blit(ctx, env, S.lit, { dx: L.lerp(6, -6, p), zoom: 1 + (zoom - 1) * 0.4, blend: 'screen', alpha: 0.62 });
    L.blit(ctx, env, S.dark, { dx: L.lerp(-13, 13, p), zoom: 1 + (zoom - 1) * 0.6, alpha: 0.8 });
    // birds heading home toward the pagoda
    ctx.save(); ctx.fillStyle = INK; ctx.globalAlpha = 0.92;
    for (const [x, y, s, ph] of BIRDS) drawBird(ctx, x - 16 * p * (0.6 + s * 0.5), y - 3 * p + Math.sin(ph + p * 4) * 1.5, s, Math.sin(ph + p * 9));
    ctx.restore();
    // hill, trees, pagoda: slide along the ridge
    L.blit(ctx, env, S.hill, { rot, zoom });
    // glare wrapping over the silhouette near the sun
    L.glow(ctx, sun.x, sun.y + 10, 340, '#ff7a2a', 0.2);
    L.vignette(ctx, { strength: 0.3 });
  },
};
