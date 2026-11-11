// s36 — 摇钱树枝叶. One leaf of a Han bronze money tree (摇钱树), back-lit in cold white on pure black, shallow focus.
// The arc is the leaf's upper main branch: thin and bright. A row of square-holed round coins hangs under it, each coin
// tangent to its neighbours, the square holes open onto black. Every coin carries a regular ring of short cast awns (芒);
// from the rims and the branch countless silver filaments rise across the arc like the barbs of a feather —
// bright and solid at the root, thin, soft and gone at the tip. Under the coins a second, out-of-focus branch melts into white mist.
// (The real object is green-patinated bronze; the silver back-light is a deliberate grade. No inscriptions are drawn.)
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 110;
const RC = 124;            // coin radius
const BTOP = 2.5, BBOT = -8; // the main branch occupies this dr band (its bright upper edge sits on the arc)
const DRC = BBOT - RC + 1.5; // dr of the coin centres (coins fused to the underside of the branch)
const HS = 45;             // half side of the square hole
const WR = 12, WI = 7;     // outer rim (外郭) / inner rim (内郭) widths
const LA = 22, NA = 52;    // the short regular awns round every coin
let S = null;

const sm = (a, b, v) => { const t = L.clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/** one coin, shaded per pixel from a height field: raised outer rim, raised square inner rim, plain cast field, open square hole */
function buildCoin(seed) {
  const M = 3, SZ = 2 * (RC + M), c = SZ / 2, N = SZ * SZ;
  const nA = L.makeNoise('s36a' + seed), nB = L.makeNoise('s36b' + seed);
  const Hh = new Float32Array(N), Am = new Float32Array(N), Pt = new Float32Array(N), Ed = new Float32Array(N);
  const HR = 4.8, HI = 3.6;
  for (let j = 0; j < SZ; j++) for (let i = 0; i < SZ; i++) {
    const k = j * SZ + i, x = i + 0.5 - c, y = j + 0.5 - c, r = Math.hypot(x, y), sq = Math.max(Math.abs(x), Math.abs(y));
    if (r > RC + 2) continue;
    const ux = x / (r || 1), uy = y / (r || 1);
    const ro = RC - 0.7 + 0.8 * nA.n2(ux * 2.4 + 5, uy * 2.4 - 3);   // a cast outline is never a perfect circle …
    const hs = HS + 0.8 * nB.n2(x / 34 + 2, y / 34);                     // … nor the hole a perfect square
    Am[k] = L.clamp(ro - r + 0.5) * L.clamp(sq - hs + 0.5);
    if (Am[k] <= 0) continue;
    const rimO = sm(RC - WR - 3, RC - WR + 2.5, r) * (1 - sm(ro - 5, ro + 0.5, r));
    const rimI = (1 - sm(hs + WI - 2, hs + WI + 3, sq)) * sm(hs - 1.5, hs + 2.5, sq);
    const f1 = nA.fbm(x / 30, y / 30, 3), f2 = nB.n2(x / 3.1, y / 3.1), f3 = nB.n2(x / 8 + 9, y / 8 - 4);
    let h = HR * rimO + HI * rimI + 1.0 * f1 + 0.2 * f2 + 0.3 * f3;
    const cl = nB.cell(x / 12 + 40, y / 12);                              // sparse casting pits
    if (cl.id > 0.66) h -= 1.5 * (1 - sm(0.02, 0.2, cl.d));
    Hh[k] = h;
    Pt[k] = nA.fbm(x / 64 + 11, y / 64 + 7, 3);
    Ed[k] = sm(ro - 4.5, ro - 0.5, r) * Math.pow(Math.max(0, -uy), 0.7);  // the top edge of the rim catches the back-light
  }
  const lut = new Uint8ClampedArray(512 * 3);
  const ramp = L.makeRamp([[0, '#05080a'], [0.17, '#3c4a4c'], [0.4, '#9aa5a6'], [0.6, '#dde3e2'], [0.74, '#f1f3f2'], [0.84, '#ffffff'], [1, '#ffffff']]);
  for (let i = 0; i < 512; i++) { const q = ramp(i / 511); lut[i * 3] = q[0]; lut[i * 3 + 1] = q[1]; lut[i * 3 + 2] = q[2]; }
  const lx = -0.42, ly = -0.6, lz = 0.68;                 // soft key from the upper left, in front
  const hx0 = -0.229, hy0 = -0.327, hz0 = 0.917;          // half vector for the specular lobe
  const tx = -0.573, ty = -0.819, tanE = 0.5;             // toward the light on the surface, for the short cast shadows
  const img = new ImageData(SZ, SZ), d = img.data;
  const at = (x, y) => { const i = Math.round(x), j = Math.round(y); return i < 0 || j < 0 || i >= SZ || j >= SZ ? 0 : Hh[j * SZ + i]; };
  for (let j = 1; j < SZ - 1; j++) for (let i = 1; i < SZ - 1; i++) {
    const k = j * SZ + i; if (Am[k] <= 0) continue;
    const gx = (Hh[k + 1] - Hh[k - 1]) * 0.5, gy = (Hh[k + SZ] - Hh[k - SZ]) * 0.5;
    const inv = 1 / Math.sqrt(gx * gx + gy * gy + 1), nx = -gx * inv, ny = -gy * inv, nz = inv;
    const diff = Math.max(0, nx * lx + ny * ly + nz * lz);
    let occ = 0;
    for (let s = 2; s <= 12; s += 2) { const o = at(i + tx * s, j + ty * s) - Hh[k] - s * tanE; if (o > occ) occ = o; }
    const shadow = L.clamp(occ / 1.3);
    const hn = L.clamp(Hh[k] / HR);
    const sp = Math.pow(Math.max(0, nx * hx0 + ny * hy0 + nz * hz0), 46);
    const y = j + 0.5 - c;
    const alb = 0.9 + 0.24 * hn + 0.085 * Pt[k];
    let lum = (0.27 + 0.75 * diff * (1 - 0.72 * shadow)) * alb + 0.42 * sp * (0.4 + 0.6 * hn) + 0.06 * hn - 0.15 * (y / RC) + 0.42 * Ed[k];
    const li = (L.clamp(lum / 1.35) * 511 | 0) * 3;
    const cool = Pt[k] < 0 ? -Pt[k] : 0;                 // the dimmer patches lean a little toward teal
    const o = k * 4;
    d[o] = lut[li] - 14 * cool; d[o + 1] = lut[li + 1] - 3 * cool; d[o + 2] = lut[li + 2] + 2 * cool; d[o + 3] = Am[k] * 255;
  }
  const cv = L.makeCanvas(SZ, SZ);
  cv.getContext('2d').putImageData(img, 0, 0);
  return cv;
}

/** the ring of short cast awns round a coin: regular, evenly spaced, each a tiny two-facet spike */
function buildAwns() {
  const SZ = 2 * (RC + LA + 4), cv = L.makeCanvas(SZ, SZ), g = cv.getContext('2d');
  g.translate(SZ / 2, SZ / 2);
  for (let k = 0; k < NA; k++) {
    const an = ((k + 0.5) / NA) * L.TAU;
    const lit = 0.573 * Math.sin(an) - 0.819 * Math.cos(an) > 0 ? 1 : -1;   // which facet faces the key light
    g.save(); g.rotate(an);
    const r0 = RC - 4, r1 = RC + LA, hw = 3.5;
    g.fillStyle = L.linear(g, r0, 0, r1, 0, [[0, '#a9b4b5'], [1, '#7f8c8e']]);
    g.beginPath(); g.moveTo(r0, -hw); g.lineTo(r1, -0.45); g.lineTo(r1, 0.45); g.lineTo(r0, hw); g.closePath(); g.fill();
    g.fillStyle = L.linear(g, r0, 0, r1, 0, [[0, '#ffffff'], [1, '#e6ebea']]);
    g.beginPath(); g.moveTo(r0, lit * hw); g.lineTo(r1, lit * 0.45); g.lineTo(r1, 0); g.lineTo(r0, -lit * 0.5); g.closePath(); g.fill();
    g.restore();
  }
  return cv;
}

/** coins hanging tangent to one another along a concentric circle */
function coinList(a, dr, rc, off, seed) {
  const dth = 2 * Math.asin((rc - 0.4) / (a.R + dr));
  const n = Math.ceil(a.span(PAD + rc + 90) / dth) + 1, r = L.rng(seed), out = [];
  for (let i = -n; i <= n; i++) out.push({ th: (i + off) * dth, v: r.int(0, 2), tw: r.range(-0.035, 0.035) });
  return out;
}

/** the long filaments: fans from every coin's upper rim + a fringe along the branch. Short over the crest, long plumes at the sides. */
function genFilaments(env, coins) {
  const a = env.arc, r = L.rng('s36fil'), nz = L.makeNoise('s36tuft');
  const sharp = [], soft = [];
  const bumps = [[-150, 280, 130], [50, 240, 110], [292, 310, 118], [545, 210, 92], [1392, 230, 98], [1642, 330, 122], [1880, 250, 115], [2070, 290, 130]];
  const envLen = (x) => {
    const side = sm(300, 640, Math.abs(x - a.cx));
    let e = 23 + side * (88 + 70 * (0.5 + 0.5 * nz.fbm(x / 140, 3.7, 2)));
    for (const [bx, A, s] of bumps) { const q = (x - bx) / s; e += A * Math.exp(-q * q) * side; }
    return e;
  };
  const mk = (x, y, psi, kap, len, w, al) => {
    const pts = [[x, y]]; let ang = psi, s = 0;
    while (s < len) {
      const st = Math.min(6, len - s);
      x += Math.sin(ang) * st; y -= Math.cos(ang) * st; ang += kap * st; s += st;
      if (Math.abs(x - a.cx) < 352 && a.drAt(x, y) > 27) break;       // never climb into the text column
      pts.push([x, y]);
    }
    return { pts, w, al };
  };
  const lean = (x) => 0.16 * nz.n2(x / 190, 9.1);
  const curl = (x) => 0.0009 * nz.n2(x / 230, 20.3);
  const sp = a.span(PAD + 90), stepTh = 4.0 / a.R;
  for (let th = -sp; th <= sp; th += stepTh) {
    const t = th + r.range(-0.45, 0.45) * stepTh, p0 = a.pt(t, -2), e = envLen(p0.x);
    const len = e * (0.12 + 0.88 * Math.pow(r(), 1.7));
    sharp.push(mk(p0.x, p0.y, t * 1.2 + lean(p0.x) + r.gauss() * 0.11, curl(p0.x) + r.gauss() * 0.0005, len, 0.9 + 1.4 * r() * r() + len / 420, 0.42 + 0.58 * r()));
  }
  for (const cn of coins) {
    const c0 = a.pt(cn.th, DRC), n = 46;
    for (let i = 0; i < n; i++) {
      const phi = L.lerp(-1.24, 1.24, (i + r()) / n), a0 = cn.th + phi;
      const x = c0.x + (RC - 3) * Math.sin(a0), y = c0.y - (RC - 3) * Math.cos(a0);
      const psi = cn.th * 1.2 + phi * 0.6 + lean(x) + r.gauss() * 0.07;
      const d0 = (RC * (1 - Math.cos(phi)) + 12) / Math.max(0.5, Math.cos(phi * 0.6));
      const e = envLen(x + Math.sin(psi) * d0);
      const len = d0 + e * (0.15 + 0.85 * Math.pow(r(), 1.5));
      sharp.push(mk(x, y, psi, curl(x) + r.gauss() * 0.0004, len, 1.0 + 1.5 * r() * r() + len / 460, 0.5 + 0.5 * r()));
    }
  }
  // out-of-focus down: fewer, wider, dimmer — only where the plumes are (the crest stays crisp and calm)
  for (let i = 0; i < 420; i++) {
    const t = r.range(-sp, sp), p0 = a.pt(t, 0), e = envLen(p0.x);
    if (e < 70) continue;
    soft.push(mk(p0.x, p0.y, t * 1.2 + lean(p0.x) + r.gauss() * 0.15, curl(p0.x) + r.gauss() * 0.0006, e * r.range(0.35, 1.05), r.range(3, 6.5), r.range(0.16, 0.4)));
  }
  return { sharp, soft };
}

function drawFil(g, f) {
  const P = f.pts, n = P.length; if (n < 2) return;
  const gr = g.createLinearGradient(P[0][0], P[0][1], P[n - 1][0], P[n - 1][1]);
  gr.addColorStop(0, `rgba(255,255,255,${f.al})`);
  gr.addColorStop(0.3, `rgba(241,243,242,${f.al * 0.86})`);
  gr.addColorStop(0.7, `rgba(190,200,200,${f.al * 0.42})`);
  gr.addColorStop(1, 'rgba(154,165,166,0)');
  g.fillStyle = gr;
  const Lx = [], Ly = [], Rx = [], Ry = [];
  for (let i = 0; i < n; i++) {
    const p = P[Math.max(0, i - 1)], q = P[Math.min(n - 1, i + 1)];
    let nx = -(q[1] - p[1]), ny = q[0] - p[0]; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
    const hw = 0.5 * (f.w * Math.pow(1 - i / (n - 1), 0.8) + 0.45);
    Lx.push(P[i][0] + nx * hw); Ly.push(P[i][1] + ny * hw); Rx.push(P[i][0] - nx * hw); Ry.push(P[i][1] - ny * hw);
  }
  g.beginPath(); g.moveTo(Lx[0], Ly[0]);
  for (let i = 1; i < n; i++) g.lineTo(Lx[i], Ly[i]);
  for (let i = n - 1; i >= 0; i--) g.lineTo(Rx[i], Ry[i]);
  g.closePath(); g.fill();
}

/** copy of a padded canvas kept only inside a radial (dr) window; `gain` re-brightens what the blur spread thin */
function maskedCopy(src, env, dr0, dr1, stops, gain = 1) {
  const a = env.arc, c = L.makeCanvas(src.width, src.height), g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  if (gain > 1) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = gain - 1; g.drawImage(src, 0, 0); g.globalAlpha = 1; }
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = L.radial(g, a.cx + PAD, a.cy + PAD, a.R + dr0, a.R + dr1, stops);
  g.fillRect(0, 0, c.width, c.height);
  c._pad = PAD;
  return c;
}
const K0 = 'rgba(0,0,0,0)', K1 = 'rgba(0,0,0,1)';

/** the sharp plane: filament roots → awns → branch → coin bodies, then side defocus and bloom */
function buildMain(env, sprites, awn, coins, filAll) {
  const a = env.arc, full = (g) => g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
  const layer = L.makeLayer(PAD, (g) => {
    g.drawImage(maskedCopy(filAll, env, 36, 130, [[0, K1], [1, K0]]), -PAD, -PAD);
    for (const cn of coins) a.at(g, cn.th, DRC, () => { g.rotate(cn.tw); g.drawImage(awn, -awn.width / 2, -awn.height / 2); });
    // the main branch: a flat cast strip, lit along its upper edge
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R + BBOT - 1, a.R + BTOP + 0.8, [[0, 'rgba(90,104,106,0)'], [0.09, '#6f7e80'], [0.34, '#c4cccc'], [0.62, '#f1f3f2'], [0.9, '#ffffff'], [1, 'rgba(255,255,255,0)']]);
    a.pathBand(g, BTOP + 0.8, BBOT - 1); g.fill();
    // a little fillet where each coin is fused to the branch
    for (const cn of coins) a.at(g, cn.th, BBOT, () => {
      g.fillStyle = L.linear(g, 0, -2, 0, 9, [[0, '#f1f3f2'], [1, '#aab4b5']]);
      g.beginPath(); g.moveTo(-30, -1); g.quadraticCurveTo(-12, 1, -9, 10); g.lineTo(9, 10); g.quadraticCurveTo(12, 1, 30, -1); g.closePath(); g.fill();
    });
    for (const cn of coins) a.at(g, cn.th, DRC, () => { g.rotate(cn.tw); const sp = sprites[cn.v]; g.drawImage(sp, -sp.width / 2, -sp.height / 2); });
  });
  const g = layer.getContext('2d');
  // shallow focus: the plane falls soft toward the left and right of frame  (sharp·(1−m) + soft·m)
  const hm = [[0, K1], [0.26, K1], [0.5, K0], [0.74, K1], [1, K1]];
  const soft = L.blurred(layer, 3.4), sg = soft.getContext('2d');
  sg.globalCompositeOperation = 'destination-in';
  sg.fillStyle = L.linear(sg, PAD - 60, 0, PAD + W + 60, 0, [[0, K1], [0.2, 'rgba(0,0,0,0.5)'], [0.36, K0], [0.64, K0], [0.8, 'rgba(0,0,0,0.5)'], [1, K1]]);
  sg.fillRect(0, 0, soft.width, soft.height);
  g.save();
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = L.linear(g, -60, 0, W + 60, 0, [[0, K1], [0.2, 'rgba(0,0,0,0.5)'], [0.36, K0], [0.64, K0], [0.8, 'rgba(0,0,0,0.5)'], [1, K1]]); full(g);
  g.globalCompositeOperation = 'lighter'; g.drawImage(soft, -PAD, -PAD);
  g.restore();
  void hm;
  // halation from the back-light
  const b1 = L.blurred(layer, 5), b2 = L.blurred(layer, 18);
  g.save(); g.globalCompositeOperation = 'screen';
  g.globalAlpha = 0.28; g.drawImage(b1, -PAD, -PAD);
  g.globalAlpha = 0.4; g.drawImage(b2, -PAD, -PAD);
  g.restore();
  return layer;
}

/** behind: pure black, a second branch of coins far out of focus, dissolving into white mist toward the bottom */
function buildBack(env, sprites, awn) {
  const a = env.arc, full = (g) => g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
  const K = 1.22, DR2 = -(2 * RC + 46), RC2 = RC * K, DRC2 = DR2 - 9 * K - RC2;
  const far = L.makeLayer(PAD, (g) => {
    const coins2 = coinList(a, DRC2, RC2, 0.5, 's36row2');
    const r = L.rng('s36far'), sp = a.span(PAD + 90);
    g.lineCap = 'round';
    for (let i = 0; i < 560; i++) {
      const t = r.range(-sp, sp), len = r.range(18, 74), p0 = a.pt(t, DR2), ps = t + r.gauss() * 0.22;
      const x1 = p0.x + Math.sin(ps) * len, y1 = p0.y - Math.cos(ps) * len;
      g.strokeStyle = L.linear(g, p0.x, p0.y, x1, y1, [[0, 'rgba(255,255,255,0.85)'], [1, 'rgba(200,210,210,0)']]);
      g.lineWidth = r.range(1.5, 3.6);
      g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(x1, y1); g.stroke();
    }
    for (const cn of coins2) a.at(g, cn.th, DRC2, () => { g.scale(K, K); g.drawImage(awn, -awn.width / 2, -awn.height / 2); });
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R + DR2 - 10 * K, a.R + DR2 + 3 * K, [[0, '#7f8c8e'], [0.5, '#e3e8e7'], [1, '#ffffff']]);
    a.pathBand(g, DR2 + 3 * K, DR2 - 10 * K); g.fill();
    for (const cn of coins2) a.at(g, cn.th, DRC2, () => { g.scale(K, K); const sp2 = sprites[cn.v]; g.drawImage(sp2, -sp2.width / 2, -sp2.height / 2); });
  });
  const farB = L.blurred(far, 11);
  const streaks = L.polarNoiseLayer(env, PAD, { seed: 's36mist', scale: 30, sx: 0.5, sy: 10, octaves: 3, contrast: 1.7, res: 0.3, ramp: [[0, '#5d6b6d'], [0.5, '#c2cbcb'], [1, '#ffffff']] });
  return L.makeLayer(PAD, (g) => {
    g.fillStyle = '#030303'; full(g);
    g.drawImage(farB, -PAD, -PAD);
    // the mist: out-of-focus down, brightest at the bottom, nothing left by the height of the square holes
    const mist = L.makeLayer(PAD, (m) => {
      m.drawImage(streaks, -PAD, -PAD);
      m.globalCompositeOperation = 'destination-in';
      m.fillStyle = L.radial(m, a.cx, a.cy, a.R - 660, a.R - 176, [[0, 'rgba(0,0,0,0.96)'], [0.38, 'rgba(0,0,0,0.7)'], [0.72, 'rgba(0,0,0,0.26)'], [1, K0]]);
      full(m);
    });
    g.globalCompositeOperation = 'screen'; g.drawImage(mist, -PAD, -PAD);
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 700, a.R - 250, [[0, 'rgba(241,243,242,0.8)'], [0.5, 'rgba(210,219,219,0.36)'], [1, 'rgba(154,165,166,0)']]); full(g);
    g.globalCompositeOperation = 'source-over';
  });
}

export default {
  name: '摇钱树枝叶',
  tone: 'light',
  init(env) {
    const a = env.arc;
    const sprites = [1, 2, 3].map(buildCoin), awn = buildAwns();
    const coins = coinList(a, DRC, RC, 0, 's36row1');
    const fil = genFilaments(env, coins);
    const filAll = L.makeLayer(PAD, (g) => { for (const f of fil.sharp) drawFil(g, f); });
    const filSoft = L.makeLayer(PAD, (g) => { for (const f of fil.soft) drawFil(g, f); });
    // tips: the farther from the branch, the softer. Two versions (a little soft / softer) are cross-faded so the blur breathes.
    const M1 = [[0, K0], [0.42, K1], [1, K0]], M2 = [[0, K0], [1, K1]];
    const tips = (b1, b2, b3, g1, g2) => {
      const c = L.makeCanvas(filAll.width, filAll.height), g = c.getContext('2d');
      g.globalCompositeOperation = 'lighter';
      g.drawImage(maskedCopy(L.blurred(filAll, b1), env, 36, 260, M1, g1), 0, 0);
      g.drawImage(maskedCopy(L.blurred(filAll, b2), env, 130, 260, M2, g2), 0, 0);
      g.drawImage(L.blurred(filSoft, b3), 0, 0);
      c._pad = PAD;
      return c;
    };
    S = {
      back: buildBack(env, sprites, awn),
      main: buildMain(env, sprites, awn, coins, filAll),
      tipsA: tips(1.3, 3.0, 4.2, 1.2, 1.7),
      tipsB: tips(2.3, 4.8, 6.2, 1.3, 2.0),
    };
  },
  draw(ctx, env, p) {
    const rot = L.lerp(-0.0035, 0.0035, p), zoom = L.lerp(1.0, 1.01, p);
    ctx.fillStyle = '#030303'; ctx.fillRect(0, 0, W, H);
    L.blit(ctx, env, S.back, { rot: rot * 0.45, zoom: 1 + (zoom - 1) * 0.4 });
    L.blit(ctx, env, S.main, { rot, zoom });
    const br = L.smooth(p);   // the tips drift a little further out of focus across the shot
    L.blit(ctx, env, S.tipsA, { rot, zoom, blend: 'lighter', alpha: 1 - br });
    L.blit(ctx, env, S.tipsB, { rot, zoom, blend: 'lighter', alpha: br });
  },
};
