// s22 — 鱼鳞瓦·刺绣. Macro of an embroidery: indigo plain-weave ground above the arc; below it a roof of
// fish-scale tiles (鱼鳞瓦) worked in silk — every tile a block of parallel satin stitches running along the
// arc's radius, shaded vermilion → orange → gold with long-and-short colour changes, outlined in dark thread.
// The arc itself is a couched pair of gold threads (盘金绣) pinned down by short red stitches.
//
// Recipe: the satin fill is a per-pixel "shader" evaluated once in init() in a conformal (s, v) space
// (s = arc length, v = R·ln(R/r) = depth below the arc), so the tile pattern stays regular under the arc and
// every thread is exactly radial. Outlines / gold cord / loose ends are vector strokes on top.
// Two complete layers are baked (silk highlight at two positions along the stitches) and cross-faded while
// the camera drifts, which reads as the sheen sliding over the silk.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 120;                       // camera only rotates ±0.006 rad and pushes in → 120 px is plenty
const LW = W + PAD * 2, LH = H + PAD * 2;

const PITCH = 184;                     // tile width along the arc (px at the arc)
const RAD = PITCH / 2, RAD2 = RAD * RAD;
const ROW = RAD * 1.12;                // row spacing (slightly > radius → a short butt joint shows between tiles)
const V0 = 20;                         // depth of the first row's semicircle centres (its joints hide under the cord)
const CORD_TOP = 0;                    // dr of the gold band's upper edge  → the dominant edge sits on the arc
const CORD_W = 14;                     // width of each of the two gold threads
const CORD_V = CORD_W * 2 - CORD_TOP - 1; // depth at which the silk emerges from under the gold

let S = null;

// ───────────────────────── tiny deterministic helpers ─────────────────────────
function hash2(a, b) {
  let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1)) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
let NT = null;
function initNoise() {
  const r = L.rng('s22vn');
  NT = new Float32Array(65536);
  for (let i = 0; i < 65536; i++) NT[i] = r();
}
/** cheap value noise 0..1 */
function vn(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), w = fy * fy * (3 - 2 * fy);
  const x0 = xi & 255, x1 = (xi + 1) & 255, y0 = (yi & 255) << 8, y1 = ((yi + 1) & 255) << 8;
  const a = NT[y0 + x0], b = NT[y0 + x1], c = NT[y1 + x0], d = NT[y1 + x1];
  return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
}
const sm = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

// silk colour by q (0 at the tile's rim → larger toward its hidden top): gold → orange → vermilion → deep red
const QMIN = -0.3, QSPAN = 2.1, NL = 512;
function silkLut() {
  const stops = [
    [-0.3, '#f0c95a'], [0.0, '#e9bb48'], [0.12, '#e3b341'], [0.185, '#e8982f'], [0.24, '#ea802a'], [0.36, '#e8742a'],
    [0.42, '#df5a25'], [0.5, '#cd3a20'], [0.75, '#c8321f'], [1.1, '#ad2718'], [1.8, '#841a12'],
  ];
  const ramp = L.makeRamp(stops.map(([q, c]) => [(q - QMIN) / QSPAN, c]));
  const lut = new Float32Array(NL * 3);
  for (let i = 0; i < NL; i++) { const c = ramp(i / (NL - 1)); lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2]; }
  return lut;
}

// ───────────────────────── the satin-stitched tiles (per-pixel) ─────────────────────────
function buildSilk(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const imA = new ImageData(LW, LH), imB = new ImageData(LW, LH);
  const A = imA.data, B = imB.data;
  const lut = silkLut();
  const r2max = (R + CORD_TOP - 1) * (R + CORD_TOP - 1);
  const lx0 = cx - 140, ly0 = a.crestY + 90;   // centre of the pool of light
  for (let Y = 0; Y < LH; Y++) {
    const y = Y - PAD, dy = cy - y;
    let o = Y * LW * 4;
    for (let X = 0; X < LW; X++, o += 4) {
      const x = X - PAD, dx = x - cx;
      const r2 = dx * dx + dy * dy;
      if (r2 > r2max) continue;
      const rad = Math.sqrt(r2);
      const s = Math.atan2(dx, dy) * R;
      const v = R * Math.log(R / rad);
      // which tile? upper rows lie on top of lower rows → the first row (smallest k) that covers the point wins
      let k = Math.ceil((v - V0 - RAD) / ROW); if (k < 0) k = 0;
      let idx, ds, e, vc;
      for (;;) {
        const off = (k & 1) * 0.5;
        const u = s / PITCH - off;
        idx = Math.round(u);
        ds = (u - idx) * PITCH;
        e = Math.sqrt(Math.max(0, RAD2 - ds * ds));
        vc = V0 + k * ROW;
        if (v <= vc + e) break;
        k++;
      }
      const dv = v - vc;
      // the edge this tile slides out from under: the rim of the row above (or the gold cord for row 0)
      let vtop, du, du2;
      if (k === 0) { vtop = CORD_V; du = v - CORD_V; du2 = du - 7; } else {
        const offu = ((k - 1) & 1) * 0.5;
        const uu = s / PITCH - offu, dsu = (uu - Math.round(uu)) * PITCH;
        const dvu = dv + ROW;
        vtop = vc - ROW + Math.sqrt(Math.max(0, RAD2 - dsu * dsu));
        du = Math.sqrt(dsu * dsu + dvu * dvu) - RAD;
        // cast shadow: light comes from the upper left, so test a point up-left of here
        const u2 = (s - 5) / PITCH - offu, ds2 = (u2 - Math.round(u2)) * PITCH, dv2 = dvu - 7;
        du2 = Math.sqrt(ds2 * ds2 + dv2 * dv2) - RAD;
      }
      const vbot = vc + e;
      let t = (v - vtop) / Math.max(10, vbot - vtop); t = t < 0 ? 0 : t > 1 ? 1 : t;

      // threads: parallel, radial, a little wavy; each tile has its own thread gauge / phase
      const hs = hash2(idx * 7 + 3, k * 13 + 5), hs2 = hash2(idx * 11 + 1, k * 17 + 9);
      const wob = (vn(s * 0.021 + 3.1, v * 0.045 + 1.7) - 0.5) * 3.2 + (vn(s * 0.13, v * 0.021 + 9.2) - 0.5) * 1.1;
      const TW = 3.8 * (0.94 + 0.12 * hs);
      const tj = (ds + wob + RAD) / TW + hs * 5;
      const j = Math.floor(tj), f = tj - j;
      const cyl = Math.sin(Math.PI * f);
      const hj1 = hash2(j + idx * 257, k * 977 + 11), hj2 = hash2(j + idx * 257, k * 977 + 29);

      // colour zone: follows the rim (U-shaped bands); long-and-short stitches → the boundary is ragged per thread
      const rr = dv > 0 ? Math.sqrt(ds * ds + dv * dv) : Math.abs(ds);
      let q = 1 - rr / RAD;
      if (dv < 0) q += (-dv / RAD) * 0.55;
      const sc = (idx + (k & 1) * 0.5) * PITCH;
      const macro = (hs2 - 0.5) * 0.16 + (vn(sc / 420 + 5.3, vc / 260 + 2.1) - 0.5) * 0.4 + k * 0.02;
      const qm = q + macro + ((j & 1) ? 0.045 : -0.045) + (hj1 - 0.5) * 0.17;
      let li = ((qm - QMIN) / QSPAN) * (NL - 1); li = li < 0 ? 0 : li > NL - 1 ? NL - 1 : li | 0;
      const cr = lut[li * 3], cg = lut[li * 3 + 1], cb = lut[li * 3 + 2];
      const e1 = (qm - 0.17) / 0.03, e2 = (qm - 0.45) / 0.03;
      const dip = 1 - 0.16 * (Math.exp(-e1 * e1) + Math.exp(-e2 * e2)); // stitch ends dive in where the colours change

      // light
      const ao = 1 - 0.55 * Math.exp(-Math.max(0, du) / 8);
      const sh = 1 - 0.46 * sm((5 - du2) / 11);
      const D = (0.46 + 0.54 * sm(t / 0.42)) * (1 - 0.24 * sm((t - 0.8) / 0.2));
      const Dx = 1 - 0.13 * (ds / RAD);
      const Tm = 0.62 + 0.44 * cyl;
      const Bj = 0.91 + 0.18 * hj2;
      const Fn = 0.92 + 0.16 * vn(j * 5.37 + idx * 1.3, v * 0.31);
      const lm = 1.08 - 0.4 * sm((Math.hypot((x - lx0) * 0.8, (y - ly0) * 1.25) - 260) / 1050);
      const lum = D * Dx * Tm * Bj * Fn * ao * sh * dip * lm * (0.96 + 0.1 * hs) * 1.13;

      // silk sheen: a band across the stitches whose place along the thread depends on the padded bulge
      const tt = t + (hj1 - 0.5) * 0.1 + 0.1 * (ds / RAD);
      const spb = cyl * cyl * ao * sh * lm * (0.6 + 0.5 * hj2 + (hj2 > 0.82 ? 0.35 : 0)) * 1.3;
      const ta = (tt - 0.5) / 0.125, tb = (tt - 0.68) / 0.125;
      const sA = Math.exp(-ta * ta) * spb, sB = Math.exp(-tb * tb) * spb;
      const tr = cr * 0.5 + 255 * 0.5, tg = cg * 0.5 + 222 * 0.5, tb2 = cb * 0.5 + 172 * 0.5;

      const br = cr * lum, bg = cg * lum, bb = cb * lum;
      A[o] = br + tr * sA; A[o + 1] = bg + tg * sA; A[o + 2] = bb + tb2 * sA; A[o + 3] = 255;
      B[o] = br + tr * sB; B[o + 1] = bg + tg * sB; B[o + 2] = bb + tb2 * sB; B[o + 3] = 255;
    }
  }
  const ca = L.makeCanvas(LW, LH), cb2 = L.makeCanvas(LW, LH);
  ca.getContext('2d').putImageData(imA, 0, 0);
  cb2.getContext('2d').putImageData(imB, 0, 0);
  return [ca, cb2];
}

// ───────────────────────── the indigo ground cloth ─────────────────────────
function buildCloth(env) {
  const a = env.arc;
  const CH = Math.min(LH, Math.ceil(PAD + a.yAt(-PAD, 0) + 28));
  const p = 6;
  const weave = L.weaveTex(LW, CH, { base: '#27406b', warp: '#3a5a8f', weft: '#1b2d4d', seed: 's22w', pitch: p, slub: 0.36 });
  const wg = weave.getContext('2d');
  // plain-weave floats: at every crossing either the warp or the weft is on top
  const tile = L.makeCanvas(p * 2, p * 2), tg = tile.getContext('2d');
  for (let i = -1; i <= 3; i++) for (let j = -1; j <= 3; j++) {
    const x = i * p, y = j * p;
    if ((i + j) & 1) { // weft float (dark, horizontal)
      tg.fillStyle = 'rgba(14,24,48,0.5)'; tg.beginPath(); tg.ellipse(x, y + 0.5, p * 0.6, p * 0.33, 0, 0, L.TAU); tg.fill();
      tg.fillStyle = 'rgba(70,100,160,0.28)'; tg.beginPath(); tg.ellipse(x, y - 0.8, p * 0.42, p * 0.14, 0, 0, L.TAU); tg.fill();
    } else {           // warp float (lighter, vertical)
      tg.fillStyle = 'rgba(86,122,186,0.5)'; tg.beginPath(); tg.ellipse(x - 0.3, y, p * 0.3, p * 0.6, 0, 0, L.TAU); tg.fill();
      tg.fillStyle = 'rgba(160,190,235,0.3)'; tg.beginPath(); tg.ellipse(x - 0.9, y - 0.4, p * 0.12, p * 0.4, 0, 0, L.TAU); tg.fill();
    }
  }
  wg.globalCompositeOperation = 'source-over'; wg.globalAlpha = 0.6;
  wg.fillStyle = wg.createPattern(tile, 'repeat'); wg.fillRect(0, 0, LW, CH);
  wg.globalAlpha = 1;

  const c = L.makeCanvas(LW, CH); c._pad = PAD;
  const g = c.getContext('2d');
  g.translate(PAD, PAD);
  g.drawImage(weave, -PAD, -PAD);
  // uneven dye + wear
  g.globalCompositeOperation = 'multiply'; g.fillStyle = '#e6eaf4'; g.fillRect(-PAD, -PAD, LW, CH);
  g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.16;
  g.drawImage(L.noiseTex(LW, CH, { seed: 's22dye', scale: 420, octaves: 4, warp: 0.5, res: 0.2, contrast: 1.5 }), -PAD, -PAD);
  g.globalAlpha = 0.12;
  g.drawImage(L.noiseTex(LW, CH, { seed: 's22dye2', scale: 46, sx: 0.5, sy: 7, octaves: 3, res: 0.33, contrast: 1.6 }), -PAD, -PAD);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  // lint: stray pale fibres caught in the weave
  const r = L.rng('s22lint');
  g.lineCap = 'round';
  for (let i = 0; i < 260; i++) {
    const x = r.range(-PAD, W + PAD), y = r.range(-PAD, CH - PAD), len = r.range(5, 22), an = r.range(0, Math.PI);
    g.strokeStyle = L.rgba(r.pick(['#b9cdf0', '#8fa9d6', '#dfe8fa']), r.range(0.05, 0.2)); g.lineWidth = r.range(0.5, 1.1);
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(an) * len * 0.5 + r.range(-4, 4), y + Math.sin(an) * len * 0.5 + r.range(-4, 4), x + Math.cos(an) * len, y + Math.sin(an) * len); g.stroke();
  }
  // the embroidery pulls the ground: faint puckers radiating a little way up from the edge
  for (let i = 0; i < 120; i++) {
    const th = r.range(-0.52, 0.52), len = r.range(16, 40), lean = r.range(-9, 9), wd = r.range(5, 11), al = r.range(0.07, 0.17);
    a.at(g, th, CORD_TOP, () => {
      g.strokeStyle = L.linear(g, 0, 0, lean, -len, [[0, `rgba(4,8,24,${al})`], [1, 'rgba(4,8,24,0)']]); g.lineWidth = wd;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(lean, -len); g.stroke();
      g.strokeStyle = L.linear(g, 0, 0, lean, -len, [[0, `rgba(150,180,235,${al * 0.6})`], [1, 'rgba(150,180,235,0)']]); g.lineWidth = wd * 0.6;
      g.beginPath(); g.moveTo(-wd * 0.8, 0); g.lineTo(lean - wd * 0.8, -len * 0.9); g.stroke();
    });
  }
  // raking light from the upper left, falling away to the right and to the top corners
  g.fillStyle = L.linear(g, -PAD, -PAD, W + PAD, CH - PAD, [[0, 'rgba(120,160,225,0.14)'], [0.45, 'rgba(120,160,225,0)'], [0.55, 'rgba(6,10,26,0)'], [1, 'rgba(6,10,26,0.34)']]);
  g.fillRect(-PAD, -PAD, LW, CH);
  g.fillStyle = L.linear(g, 0, -PAD, 0, 330, [[0, 'rgba(5,9,24,0.5)'], [1, 'rgba(5,9,24,0)']]);
  g.fillRect(-PAD, -PAD, LW, CH);
  return c;
}

// ───────────────────────── vector work: outlines, couched gold, loose ends ─────────────────────────
/** short diagonal strokes across a polyline → twisted-thread / rope texture */
function ticks(g, P, half, slant, step, style, lw) {
  g.beginPath();
  let acc = step * 0.5;
  for (let i = 1; i < P.length - 1; i++) {
    acc += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    if (acc < step) continue;
    acc -= step;
    const tx = P[i + 1][0] - P[i - 1][0], ty = P[i + 1][1] - P[i - 1][1], m = Math.hypot(tx, ty) || 1;
    const ux = tx / m, uy = ty / m, nx = -uy, ny = ux;
    g.moveTo(P[i][0] - ux * slant - nx * half, P[i][1] - uy * slant - ny * half);
    g.lineTo(P[i][0] + ux * slant + nx * half, P[i][1] + uy * slant + ny * half);
  }
  g.strokeStyle = style; g.lineWidth = lw; g.stroke();
}
function poly(g, P, ox = 0, oy = 0) {
  g.beginPath(); g.moveTo(P[0][0] + ox, P[0][1] + oy);
  for (let i = 1; i < P.length; i++) g.lineTo(P[i][0] + ox, P[i][1] + oy);
}
/** a loose thread lying on the cloth: soft shadow, round body, highlight, twist marks, frayed tip */
function looseThread(g, pts, o) {
  const { width, dark, mid, light, seed, fray = 3 } = o;
  const P = L.smoothPath(pts, 2.5);
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  g.save();
  g.shadowColor = 'rgba(3,6,18,0.6)'; g.shadowBlur = 6; g.shadowOffsetX = 4; g.shadowOffsetY = 5;
  g.strokeStyle = dark; g.lineWidth = width; poly(g, P); g.stroke();
  g.restore();
  g.strokeStyle = mid; g.lineWidth = width * 0.66; poly(g, P, -width * 0.06, -width * 0.08); g.stroke();
  g.globalAlpha = 0.75; g.strokeStyle = light; g.lineWidth = Math.max(0.7, width * 0.2); poly(g, P, -width * 0.2, -width * 0.22); g.stroke();
  g.globalAlpha = 1;
  g.lineCap = 'butt';
  ticks(g, P, width * 0.42, width * 0.3, Math.max(2.4, width * 0.7), L.rgba(dark, 0.6), Math.max(0.7, width * 0.16));
  // frayed tip
  const r = L.rng('fray' + seed), n = P.length, e = P[n - 1], b = P[n - 6] || P[0];
  const ang = Math.atan2(e[1] - b[1], e[0] - b[0]);
  g.lineCap = 'round';
  for (let i = 0; i < fray; i++) {
    const an = ang + r.range(-0.7, 0.7), len = r.range(width * 1.6, width * 4.5);
    g.strokeStyle = L.rgba(r.chance(0.5) ? mid : light, r.range(0.5, 0.9)); g.lineWidth = r.range(0.6, 1.1);
    g.beginPath(); g.moveTo(e[0], e[1]);
    g.quadraticCurveTo(e[0] + Math.cos(an) * len * 0.5 + r.range(-2, 2), e[1] + Math.sin(an) * len * 0.5 + r.range(-2, 2), e[0] + Math.cos(an + r.range(-0.4, 0.4)) * len, e[1] + Math.sin(an + r.range(-0.4, 0.4)) * len);
    g.stroke();
  }
  g.restore();
}

function buildOver(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const span = a.span(PAD + 100);
  const mapSV = (s, v) => { const rad = R * Math.exp(-v / R), th = s / R; return [cx + rad * Math.sin(th), cy - rad * Math.cos(th)]; };
  /** local (along-arc, inward) offsets from the arc at theta → frame coords */
  const local = (theta, pts) => { const p = a.pt(theta, 0), c = Math.cos(theta), s = Math.sin(theta); return pts.map(([lx, ly]) => [p.x + lx * c - ly * s, p.y + lx * s + ly * c]); };

  return L.makeLayer(PAD, (g) => {
    g.lineCap = 'round'; g.lineJoin = 'round';

    // ── 1. dark outline thread round every tile ──
    const vMax = R * Math.log(R / (R - (H + PAD - a.crestY))) + RAD;
    const kMax = Math.ceil((vMax - V0) / ROW);
    const iMax = Math.ceil((span * R) / PITCH) + 1;
    const tiles = [];
    for (let k = 0; k <= kMax; k++) {
      const off = (k & 1) * 0.5;
      for (let i = -iMax; i <= iMax; i++) {
        const sc = (i + off) * PITCH, vc = V0 + k * ROW;
        const c = mapSV(sc, vc);
        if (c[0] < -PAD - PITCH || c[0] > W + PAD + PITCH || c[1] > H + PAD + PITCH) continue;
        const P = [], side = ROW - RAD + 4, n = 64;
        P.push(mapSV(sc - RAD, vc - side));
        for (let q = 0; q <= n; q++) { const ph = -Math.PI / 2 + (Math.PI * q) / n; P.push(mapSV(sc + RAD * Math.sin(ph), vc + RAD * Math.cos(ph))); }
        P.push(mapSV(sc + RAD, vc - side));
        tiles.push({ P, sf: Math.exp(-vc / R) });
      }
    }
    for (const t of tiles) { g.strokeStyle = 'rgba(46,6,4,0.32)'; g.lineWidth = 10.5 * t.sf; poly(g, t.P, 1.6, 2.8); g.stroke(); }
    for (const t of tiles) { g.strokeStyle = '#470e0b'; g.lineWidth = 6.6 * t.sf; poly(g, t.P); g.stroke(); }
    for (const t of tiles) { g.strokeStyle = '#6b1a13'; g.lineWidth = 3.2 * t.sf; poly(g, t.P, -0.5, -0.7); g.stroke(); }
    g.lineCap = 'butt';
    for (const t of tiles) {
      ticks(g, t.P, 3.0 * t.sf, 2.0 * t.sf, 4.4 * t.sf, 'rgba(22,3,3,0.7)', 1.25 * t.sf);
      ticks(g, t.P.slice(1), 2.2 * t.sf, 1.5 * t.sf, 4.4 * t.sf, 'rgba(198,84,58,0.5)', 1.0 * t.sf);
    }
    g.lineCap = 'round';

    // a few fly-away silk fibres on the embroidery
    const rf = L.rng('s22fly');
    for (let i = 0; i < 70; i++) {
      const s0 = rf.range(-span * R, span * R), v0 = rf.range(40, vMax), len = rf.range(14, 60), an = rf.range(-0.5, 0.5) + Math.PI / 2;
      const p0 = mapSV(s0, v0), p1 = mapSV(s0 + Math.cos(an) * len * 0.5 + rf.range(-6, 6), v0 + Math.sin(an) * len * 0.5), p2 = mapSV(s0 + Math.cos(an) * len + rf.range(-8, 8), v0 + Math.sin(an) * len);
      g.strokeStyle = L.rgba(rf.pick(['#ffe9b0', '#ffc27a', '#ffd9c2']), rf.range(0.12, 0.4)); g.lineWidth = rf.range(0.6, 1.2);
      g.beginPath(); g.moveTo(p0[0], p0[1]); g.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]); g.stroke();
    }

    // ── 2. the ground cloth sinks a little where the gold is pulled tight ──
    g.fillStyle = L.radial(g, cx, cy, R + CORD_TOP - 2, R + CORD_TOP + 20, [[0, 'rgba(4,8,24,0.62)'], [0.35, 'rgba(4,8,24,0.3)'], [1, 'rgba(4,8,24,0)']]);
    a.pathBand(g, CORD_TOP + 20, CORD_TOP - 2, -span, span); g.fill();

    // ── 3. 盘金: two gold threads laid side by side along the arc ──
    const rc = L.rng('s22gold');
    for (let c = 0; c < 2; c++) {
      const top = CORD_TOP - c * CORD_W, bot = top - CORD_W, mid = (top + bot) / 2, hw = CORD_W / 2;
      g.fillStyle = L.radial(g, cx, cy, R + bot, R + top, [[0, '#382003'], [0.13, '#83500a'], [0.36, '#cf9324'], [0.58, '#ebbf4c'], [0.73, '#fff0b4'], [0.85, '#e0ad38'], [1, '#664107']]);
      a.pathBand(g, top, bot, -span, span); g.fill();
      // the gilt strip is wound spirally round a silk core → slanted wraps, each facet catching the light differently
      const step = 4.2, n = Math.ceil((span * R) / step);
      for (let i = -n; i <= n; i++) {
        const th = (i * step + c * 1.7) / R;
        const hsh = hash2(i * 3 + 17, c * 101 + 7);
        a.at(g, th, mid, () => {
          if (hsh > 0.66) { g.fillStyle = `rgba(255,238,172,${((hsh - 0.66) * 1.2).toFixed(3)})`; g.beginPath(); g.moveTo(-3, hw - 1.5); g.lineTo(3, -hw + 1.5); g.lineTo(3 + step, -hw + 1.5); g.lineTo(-3 + step, hw - 1.5); g.closePath(); g.fill(); }
          else if (hsh < 0.3) { g.fillStyle = `rgba(74,42,2,${((0.3 - hsh) * 1.3).toFixed(3)})`; g.beginPath(); g.moveTo(-3, hw - 1); g.lineTo(3, -hw + 1); g.lineTo(3 + step, -hw + 1); g.lineTo(-3 + step, hw - 1); g.closePath(); g.fill(); }
          g.strokeStyle = 'rgba(64,36,3,0.62)'; g.lineWidth = 1.0; g.beginPath(); g.moveTo(-3, hw - 0.6); g.lineTo(3, -hw + 0.6); g.stroke();
          g.strokeStyle = 'rgba(255,246,200,0.34)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-1.5, hw - 2.5); g.lineTo(4.2, -hw + 2); g.stroke();
        });
      }
      // crisp specular along the crown of the thread, broken up like real gilt
      g.save(); g.lineCap = 'butt';
      g.setLineDash([rc.range(6, 12), rc.range(2, 5), rc.range(10, 22), rc.range(3, 7), rc.range(4, 9), rc.range(2, 6)]);
      g.strokeStyle = 'rgba(255,253,236,0.8)'; g.lineWidth = 2.1; a.stroke(g, top - CORD_W * 0.27, -span, span);
      g.restore();
      g.strokeStyle = 'rgba(40,22,2,0.75)'; g.lineWidth = 1.5; a.stroke(g, bot + 0.3, -span, span);
    }
    g.strokeStyle = 'rgba(46,28,4,0.6)'; g.lineWidth = 1.1; a.stroke(g, CORD_TOP - 0.2, -span, span);
    // sparks where a facet of the gilt faces the lamp
    for (let i = 0; i < 80; i++) {
      const th = rc.range(-span, span), dr = CORD_TOP - rc.int(0, 1) * CORD_W - CORD_W * 0.27, len = rc.range(3, 8);
      a.at(g, th, dr, () => {
        g.fillStyle = L.radial(g, 0, 0, 0, len * 1.7, [[0, 'rgba(255,244,196,0.5)'], [1, 'rgba(255,244,196,0)']]);
        g.beginPath(); g.arc(0, 0, len * 1.7, 0, L.TAU); g.fill();
        g.fillStyle = 'rgba(255,255,244,0.95)'; g.beginPath(); g.ellipse(0, 0, len, 1.5, 0, 0, L.TAU); g.fill();
      });
    }

    // ── 4. couching stitches: short red silk stitches that pin the pair of gold threads down ──
    const SP = 40, nS = Math.ceil((span * R) / SP), midc = CORD_TOP - CORD_W, half = CORD_W + 3.6;
    for (let i = -nS; i <= nS; i++) {
      const th = ((i + 0.37) * SP + rc.range(-2.2, 2.2)) / R;
      const tilt = 0.1 + rc.range(-0.07, 0.07), wS = 6.6 + rc.range(-0.5, 0.5);
      a.at(g, th, midc, () => {
        g.rotate(tilt);
        // the stitch bites into the gold: a pinch of shadow on its lee side, needle holes at both ends
        g.fillStyle = 'rgba(40,20,0,0.5)'; g.beginPath(); g.ellipse(2.6, 1, wS * 0.75, half - 3.5, 0, 0, L.TAU); g.fill();
        g.fillStyle = 'rgba(3,6,18,0.7)'; g.beginPath(); g.ellipse(0.6, -half - 0.2, 2.6, 1.9, 0, 0, L.TAU); g.fill();
        g.fillStyle = 'rgba(40,4,2,0.7)'; g.beginPath(); g.ellipse(0.6, half + 0.4, 2.6, 1.9, 0, 0, L.TAU); g.fill();
        g.lineCap = 'round';
        g.strokeStyle = L.linear(g, -wS / 2, 0, wS / 2, 0, [[0, '#7c150e'], [0.3, '#e1492d'], [0.46, '#ff9a73'], [0.66, '#c8321f'], [1, '#5f100b']]);
        g.lineWidth = wS; g.beginPath(); g.moveTo(0, -half + 1.5); g.lineTo(0, half - 1.5); g.stroke();
        // it rides over two round threads: dark at both ends and in the crease between them
        g.strokeStyle = L.linear(g, 0, -half, 0, half, [[0, 'rgba(40,4,2,0.75)'], [0.2, 'rgba(40,4,2,0)'], [0.44, 'rgba(40,4,2,0)'], [0.52, 'rgba(40,4,2,0.42)'], [0.6, 'rgba(40,4,2,0)'], [0.82, 'rgba(40,4,2,0)'], [1, 'rgba(40,4,2,0.8)']]);
        g.beginPath(); g.moveTo(0, -half + 1.5); g.lineTo(0, half - 1.5); g.stroke();
        g.strokeStyle = 'rgba(255,226,206,0.7)'; g.lineWidth = 1.1;
        g.beginPath(); g.moveTo(-0.9, -half + 6); g.lineTo(-0.9, -3.5); g.moveTo(-0.9, 3.5); g.lineTo(-0.9, half - 7); g.stroke();
      });
    }

    // ── 5. 毛边: silk fuzz standing up from the edge onto the cloth ──
    const rz = L.rng('s22fuzz');
    for (let i = 0; i < 1100; i++) {
      const th = rz.range(-span, span), len = 3 + 15 * Math.pow(rz(), 2.6), an = rz.range(-1.1, 1.1);
      a.at(g, th, CORD_TOP - rz.range(0, 3), () => {
        g.strokeStyle = L.rgba(rz.pick(['#f0cf74', '#f3a654', '#e0603a', '#fff0c4', '#d9b04a']), rz.range(0.22, 0.7)); g.lineWidth = rz.range(0.55, 1.1);
        const ex = Math.sin(an) * len, ey = -Math.cos(an) * len;
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(ex * 0.3 + rz.range(-2, 2), ey * 0.6, ex, ey); g.stroke();
      });
    }

    // ── 6. 线头: a few ends that have worked loose (all kept clear of the text-safe zone) ──
    looseThread(g, local(-0.302, [[0, -5], [-5, -20], [-20, -47], [-50, -68], [-86, -64], [-104, -40], [-97, -17]]),
      { width: 6.2, dark: '#6a4508', mid: '#e3b341', light: '#fff3c0', seed: 1, fray: 5 });
    looseThread(g, local(0.204, [[0, -4], [9, -24], [32, -58], [70, -86], [112, -82], [130, -54], [114, -32], [90, -37]]),
      { width: 3.8, dark: '#7a160f', mid: '#d9432a', light: '#ffb394', seed: 2, fray: 4 });
    looseThread(g, local(-0.166, [[0, -4], [-3, -15], [-12, -31], [-29, -40]]),
      { width: 3.2, dark: '#8a3c0c', mid: '#e8742a', light: '#ffd19a', seed: 3, fray: 4 });
    looseThread(g, local(0.338, [[0, -4], [7, -22], [-4, -50], [-32, -70], [-68, -66]]),
      { width: 3.2, dark: '#4a0e0a', mid: '#a02a1c', light: '#ef8a6c', seed: 4, fray: 3 });
    looseThread(g, local(-0.405, [[0, -4], [10, -18], [34, -30], [60, -24]]),
      { width: 3.0, dark: '#7a160f', mid: '#d9432a', light: '#ffb394', seed: 5, fray: 3 });
  });
}

// ───────────────────────── finishing: shallow depth of field baked into the layer ─────────────────────────
function dof(layer) {
  const g = layer.getContext('2d');
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  const strip = (Y0, Y1, px, stops) => {
    const hh = Y1 - Y0, c = L.makeCanvas(LW, hh), cg = c.getContext('2d');
    cg.filter = `blur(${px}px)`; cg.drawImage(layer, 0, Y0, LW, hh, 0, 0, LW, hh); cg.filter = 'none';
    cg.globalCompositeOperation = 'destination-in';
    cg.fillStyle = L.linear(cg, 0, 0, 0, hh, stops); cg.fillRect(0, 0, LW, hh);
    g.drawImage(c, 0, Y0);
  };
  strip(PAD + 800, LH, 3.2, [[0, 'rgba(0,0,0,0)'], [0.1, 'rgba(0,0,0,0)'], [0.75, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,1)']]);
  strip(0, PAD + 250, 1.6, [[0, 'rgba(0,0,0,1)'], [0.4, 'rgba(0,0,0,0.8)'], [0.92, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0)']]);
  g.restore();
}

export default {
  name: '鱼鳞瓦·刺绣',
  tone: 'light',
  init(env) {
    initNoise();
    const cloth = buildCloth(env);
    const [silkA, silkB] = buildSilk(env);
    const over = buildOver(env);
    const compose = (silk) => {
      const c = L.makeLayer(PAD, (g) => {
        g.drawImage(cloth, -PAD, -PAD);
        g.drawImage(silk, -PAD, -PAD);
        g.drawImage(over, -PAD, -PAD);
      });
      dof(c);
      return L.filtered(c, 'contrast(1.06) saturate(1.07)');
    };
    S = { A: compose(silkA), B: compose(silkB) };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.006, 0.006, p), zoom = L.lerp(1.0, 1.025, p);
    // the two bakes differ only in where the silk sheen sits along the stitches → cross-fade = the sheen slides
    L.blit(ctx, env, S.A, { rot, zoom });
    if (p > 0) L.blit(ctx, env, S.B, { rot, zoom, alpha: L.smooth(p) });
    // a glint travelling along the gold
    L.cam(ctx, env, { rot, zoom }, () => {
      ctx.save(); a.clipBand(ctx, CORD_TOP + 1, CORD_TOP - CORD_W * 2 - 1);
      const q = a.pt(L.lerp(-0.15, 0.05, p), -9);
      L.glow(ctx, q.x, q.y, 340, '#fff2c2', 0.85, 'overlay');
      L.glow(ctx, q.x, q.y, 120, '#fff8dc', 0.22, 'screen');
      ctx.restore();
    });
    // warm pool of light on the silk drifting with the camera
    const w = a.pt(L.lerp(-0.1, 0.02, p), -150);
    L.glow(ctx, w.x, w.y, 620, '#ffb066', 0.1, 'soft-light');
    L.vignette(ctx, { strength: 0.3, inner: 0.5, outer: 1.08 });
  },
};
