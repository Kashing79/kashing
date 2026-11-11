// s08 — 人参负片. An X-ray / film-negative plate: a whole ginseng root lying in a round bamboo tray (竹匾).
// The arc is the outer edge of the tray's thick lashed rim, which reads as a broad glowing grey-white band;
// above it the plate is unexposed black. Inside the tray the root glows ghost-white and translucent:
// 芦头 (rhizome with cup-shaped stem scars) → 主根 (transverse ring wrinkles near the shoulder) → 支根 → a wide
// spread of fine 须根 beaded with 珍珠点.
//
// Everything is built as a greyscale "density" picture first (thicker = brighter, overlaps add up like on a real
// radiograph) and only then mapped through the four-colour palette ramp, so the frame stays strictly black / grey / white.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 110;
const LW = W + PAD * 2, LH = H + PAD * 2;
const RIMW = 80;          // radial width of the tray rim (px)
let S = null;

const sstep = (a, b, v) => { const t = L.clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const hash1 = (n) => { let h = Math.imul(n | 0, 374761393) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const angDiff = (a, b) => { let d = (a - b) % L.TAU; if (d > Math.PI) d -= L.TAU; if (d < -Math.PI) d += L.TAU; return d; };

// palette: 玄黑 → 暗灰 → 银灰 → 幽白
const RAMP = [[0, '#030404'], [0.22, '#2a2e2f'], [0.62, '#9aa3a3'], [1, '#e6ebea']];
function makeLut() {
  const f = L.makeRamp(RAMP), lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) { const c = f(i / 255); lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2]; }
  return lut;
}
/** map rows [sy, sy+sh) of a greyscale canvas through the palette → new opaque canvas */
function tone(src, sy, sh, lut) {
  const img = src.getContext('2d').getImageData(0, sy, src.width, sh), d = img.data;
  for (let k = 0; k < d.length; k += 4) { const v = d[k] * 3; d[k] = lut[v]; d[k + 1] = lut[v + 1]; d[k + 2] = lut[v + 2]; d[k + 3] = 255; }
  const out = L.makeCanvas(src.width, sh);
  out.getContext('2d').putImageData(img, 0, 0);
  return out;
}

// ───────────────────────── tray floor: twill-woven bamboo, barely exposed ─────────────────────────
function buildMat(env) {
  const a = env.arc, cx = a.cx, cy = a.cy, R2 = (a.R + 4) * (a.R + 4);
  const img = new ImageData(LW, LH), d = img.data;
  const SW = 30, ang = L.deg(34), ca = Math.cos(ang), sa = Math.sin(ang);
  const jit = new Float32Array(4096);
  for (let i = 0; i < 4096; i++) jit[i] = 0.74 + 0.5 * hash1(i * 7 + 3);
  for (let j = 0; j < LH; j++) {
    const y = j - PAD + 0.5, ddy = y - cy;
    for (let i = 0; i < LW; i++) {
      const x = i - PAD + 0.5, ddx = x - cx, k = (j * LW + i) * 4;
      d[k + 3] = 255;
      if (ddx * ddx + ddy * ddy > R2) continue;
      const qa = ((x - 960) * ca + (y - 800) * sa) / SW + 1000, qb = (-(x - 960) * sa + (y - 800) * ca) / SW + 1000;
      const ia = Math.floor(qa), ib = Math.floor(qb), fa = qa - ia, fb = qb - ib;
      const ea = Math.min(fa, 1 - fa), eb = Math.min(fb, 1 - fb);
      const va = (0.6 + 0.4 * Math.sqrt(ea * 2)) * Math.min(1, ea / 0.075) * jit[ia & 2047];
      const vb = (0.6 + 0.4 * Math.sqrt(eb * 2)) * Math.min(1, eb / 0.075) * jit[2048 + (ib & 2047)];
      const over = ((ia + ib) & 3) < 2;           // 2/2 twill: which strip lies on top here
      const val = 0.3 * va + 0.3 * vb + 0.48 * (over ? va : vb);
      const g = 255 * (0.035 + 0.125 * val);
      d[k] = d[k + 1] = d[k + 2] = g;
    }
  }
  const c = L.makeCanvas(LW, LH), g = c.getContext('2d');
  g.putImageData(img, 0, 0);
  // bamboo fibre running along both strip directions
  const st = L.noiseTex(1024, 1024, { seed: 's08fib', scale: 24, sx: 12, sy: 0.35, octaves: 3, contrast: 1.7, res: 0.5 });
  g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.3;
  for (const rr of [ang, ang + Math.PI / 2]) {
    g.save(); g.translate(LW / 2, LH / 2); g.rotate(rr); g.fillStyle = g.createPattern(st, 'repeat'); g.fillRect(-1700, -1700, 3400, 3400); g.restore();
  }
  // uneven exposure + falloff away from the subject
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = 1;
  g.drawImage(L.noiseTex(LW, LH, { seed: 's08mat', scale: 460, octaves: 3, res: 0.2, ramp: [[0, '#707070'], [1, '#ffffff']] }), 0, 0);
  g.fillStyle = L.radial(g, PAD + cx, PAD + a.crestY + 290, 260, 1250, [[0, '#ffffff'], [1, '#4c4c4c']]);
  g.fillRect(0, 0, LW, LH);
  g.globalCompositeOperation = 'source-over';
  c._pad = PAD;
  return c;
}

// ───────────────────────── the ginseng ─────────────────────────
/** Catmull-Rom through [[x,y,r]...] at ~step px */
function spline3(pts, step) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t, o = [0, 0, 0];
      for (let k = 0; k < 3; k++) o[k] = 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      out.push(o);
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}
/** a root "bone": centre line given in arc-polar px [s along the arc, dr, radius] → dense samples {x,y,r,u,tx,ty} */
function makeBone(a, id, ctrl, o = {}) {
  const { sh = 0, knob = 0, knobLen = 44 } = o;
  const nz = L.makeNoise('s08bone' + id);
  const raw = spline3(ctrl.map(([s, d, r]) => { const p = a.pt((s + sh) / a.R, d); return [p.x, p.y, r]; }), 1.5);
  const out = []; let u = 0;
  for (let i = 0; i < raw.length; i++) {
    const A = raw[Math.max(0, i - 1)], B = raw[Math.min(raw.length - 1, i + 1)];
    let tx = B[0] - A[0], ty = B[1] - A[1]; const m = Math.hypot(tx, ty) || 1; tx /= m; ty /= m;
    if (i) u += Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]);
    const r = Math.max(2, raw[i][2] * (1 + knob * Math.sin((u / knobLen) * L.TAU + id * 1.7) + 0.05 * nz.n2(u / 37, id * 3.3)));
    out.push({ x: raw[i][0], y: raw[i][1], r, u, tx, ty });
  }
  out.id = id; out.len = u;
  return out;
}
const boneAt = (b, f) => b[Math.round(L.clamp(f) * (b.length - 1))];

/** tapered ribbon through pts [[x,y,w]...] from index i0 to i1 (one fill → no beading at the joints) */
function ribbon(g, pts, i0, i1, wScale, fadeEnd) {
  const n = i1 - i0 + 1; if (n < 2) return;
  const lx = new Float32Array(n), ly = new Float32Array(n), rx = new Float32Array(n), ry = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const i = i0 + k, A = pts[Math.max(i0, i - 1)], B = pts[Math.min(i1, i + 1)];
    let nx = -(B[1] - A[1]), ny = B[0] - A[0]; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
    let hw = pts[i][2] * wScale * 0.5; if (fadeEnd) hw *= Math.sqrt(1 - k / (n - 1));
    lx[k] = pts[i][0] + nx * hw; ly[k] = pts[i][1] + ny * hw; rx[k] = pts[i][0] - nx * hw; ry[k] = pts[i][1] - ny * hw;
  }
  g.beginPath(); g.moveTo(lx[0], ly[0]);
  for (let k = 1; k < n; k++) g.lineTo(lx[k], ly[k]);
  for (let k = n - 1; k >= 0; k--) g.lineTo(rx[k], ry[k]);
  g.closePath(); g.fill();
}

function buildGinseng(env) {
  const a = env.arc;
  const SH = -60;           // slide the whole root a little left of the crest: the beard balances it on the right
  const opt = { sh: SH };
  // ── skeleton (s = px along the arc from the crest, d = dr, r = radius) ──
  const main = makeBone(a, 0, [[-300, -262, 66], [-262, -258, 92], [-170, -251, 101], [-55, -249, 96], [45, -255, 84], [100, -262, 68], [128, -266, 54]], opt);
  const head = makeBone(a, 1, [[-318, -263, 26], [-372, -271, 21], [-424, -258, 24], [-476, -269, 20], [-526, -257, 23], [-552, -260, 22]], { sh: SH, knob: 0.2, knobLen: 46 });
  const legA = makeBone(a, 2, [[100, -240, 44], [200, -212, 40], [320, -190, 31], [440, -182, 22], [560, -192, 13], [660, -216, 5.5]], opt);
  const legB = makeBone(a, 3, [[95, -276, 42], [190, -319, 37], [285, -369, 29], [375, -413, 20], [470, -441, 12], [570, -452, 5]], opt);
  const legC = makeBone(a, 4, [[120, -262, 22], [230, -273, 19], [340, -293, 13], [440, -301, 7], [522, -296, 3.2]], opt);
  const side = makeBone(a, 5, [[-436, -274, 9], [-424, -330, 9.5], [-382, -374, 7], [-318, -400, 3.6]], opt);   // 艼: a small adventitious root off the rhizome
  const bones = [main, head, legA, legB, legC, side];

  // ── stamp the union of swept spheres: per pixel keep the bone with the longest chord ──
  let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
  for (const b of bones) for (const s of b) { bx0 = Math.min(bx0, s.x - s.r - 3); by0 = Math.min(by0, s.y - s.r - 3); bx1 = Math.max(bx1, s.x + s.r + 3); by1 = Math.max(by1, s.y + s.r + 3); }
  const BX0 = Math.floor(bx0), BY0 = Math.floor(by0), BW = Math.ceil(bx1) - BX0, BH = Math.ceil(by1) - BY0, N = BW * BH;
  const Pw = new Float32Array(N).fill(-1e9), Rb = new Float32Array(N), Db = new Float32Array(N), Ub = new Float32Array(N), Vb = new Float32Array(N), Id = new Uint8Array(N);
  for (const b of bones) for (const s of b) {
    const R1 = s.r + 1, r2 = s.r * s.r, R12 = R1 * R1;
    const i0 = Math.max(0, Math.floor(s.x - R1 - BX0)), i1 = Math.min(BW - 1, Math.ceil(s.x + R1 - BX0));
    const j0 = Math.max(0, Math.floor(s.y - R1 - BY0)), j1 = Math.min(BH - 1, Math.ceil(s.y + R1 - BY0));
    for (let j = j0; j <= j1; j++) {
      const dy = BY0 + j + 0.5 - s.y;
      for (let i = i0; i <= i1; i++) {
        const dx = BX0 + i + 0.5 - s.x, d2 = dx * dx + dy * dy;
        if (d2 > R12) continue;
        const pw = r2 - d2, k = j * BW + i;
        if (pw > Pw[k]) { Pw[k] = pw; Rb[k] = s.r; Db[k] = Math.sqrt(d2); Ub[k] = s.u + dx * s.tx + dy * s.ty; Vb[k] = (s.tx * dy - s.ty * dx) / s.r; Id[k] = b.id; }
      }
    }
  }

  // ── shade: chord length → density, clouded and foamed inside, with a thin dense skin ──
  const img = new ImageData(BW, BH), d = img.data;
  const nA = L.makeNoise('s08a'), nB = L.makeNoise('s08b');
  for (let j = 0; j < BH; j++) {
    const y = BY0 + j + 0.5;
    for (let i = 0; i < BW; i++) {
      const k = j * BW + i;
      if (Pw[k] < -1e8) continue;
      const r = Rb[k], delta = r - Db[k], al = L.clamp(delta + 0.5);
      if (al <= 0) continue;
      const x = BX0 + i + 0.5;
      const t = Math.sqrt(Math.max(0, Pw[k])), tN = Math.min(1, t / 100);
      let base = 0.13 + 0.84 * Math.pow(tN, 0.8);
      // billowing cloud + wisps
      const wx = 0.4 * nB.n2(x / 70, y / 70), wy = 0.4 * nB.n2(x / 70 + 40, y / 70 - 17);
      const cl = nA.fbm(x / 170 + wx, y / 105 + wy, 4), wsp = nA.ridged(x / 80 + 9 + wx, y / 52 - 4 + wy, 3);
      base *= 0.86 + 0.3 * cl + 0.26 * (wsp - 0.45);
      // foam: round bubbles (dark inside, bright wall), big ones and fine froth, gathered in patches where the root is thick
      const fmask = sstep(-0.16, 0.2, nB.fbm(x / 230 + 5, y / 140 + 2, 3)) * sstep(0.22, 0.6, tN);
      if (fmask > 0.01) {
        const c1 = nA.cell(x / 58 + wx, y / 46 + wy), rad1 = 0.3 + 0.24 * c1.id;
        const in1 = 1 - sstep(rad1 - 0.1, rad1, c1.d), ring1 = Math.exp(-Math.pow((c1.d - rad1) / 0.055, 2));
        const c2 = nB.cell(x / 21 + wx * 2.5, y / 18 + wy * 2.5), rad2 = 0.3 + 0.2 * c2.id;
        const in2 = 1 - sstep(rad2 - 0.14, rad2, c2.d), ring2 = Math.exp(-Math.pow((c2.d - rad2) / 0.09, 2));
        const froth = sstep(0.3, 0.6, nA.fbm(x / 120 - 8, y / 90 + 13, 2) * 0.5 + 0.5);
        base = base * (1 - fmask * (0.62 * in1 * (1 - 0.5 * froth) + 0.3 * in2 * froth)) + fmask * (0.2 * ring1 + 0.12 * ring2 * froth);
      }
      // 横环纹: fine transverse wrinkles crowding the shoulder of the main root
      if (Id[k] === 0) {
        const u = Ub[k], v = Vb[k], fade = 1 - sstep(120, 330, u);
        if (fade > 0.01) {
          const ph = u + 20 * v * v + 7 * nB.n2(u / 60, v * 1.4);
          const line = 1 - sstep(0, 0.1, Math.abs(nA.n2(ph / 8.5, v * 0.5 + 7.3)));
          base = base * (1 - 0.2 * fade) + fade * 0.34 * line * (0.45 + 0.55 * tN);
        }
      }
      const skin = (0.46 * Math.exp(-delta / 1.7) + 0.17 * Math.exp(-delta / 8)) * (0.5 + 0.5 * Math.min(1, r / 36));
      const o = k * 4, gv = 255 * L.clamp(base + skin);
      d[o] = d[o + 1] = d[o + 2] = gv; d[o + 3] = 255 * al;
    }
  }
  const bodyC = L.makeCanvas(BW, BH);
  bodyC.getContext('2d').putImageData(img, 0, 0);

  // ── 须根: long wavy rootlets that branch twice and keep inside the tray ──
  const r = L.rng('s08whiskers'), nz = L.makeNoise('s08w');
  const whiskers = [], pearls = [];
  const LIM = -(RIMW + 18);
  const inBody = (x, y) => { const i = Math.floor(x - BX0), j = Math.floor(y - BY0); return i >= 0 && j >= 0 && i < BW && j < BH && Pw[j * BW + i] > 0; };
  function grow(x, y, h, len, w0, depth, curl0) {
    const step = 4, n = Math.max(6, Math.round(len / step));
    const row = r.range(0, 200), curl = curl0 !== undefined ? curl0 : r.range(-0.0011, 0.0011) * (depth ? 1.6 : 1);
    const wav = depth === 2 ? 0.011 : depth === 1 ? 0.0064 : 0.0048, lam = depth === 2 ? r.range(45, 80) : r.range(110, 190);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      pts.push([x, y, Math.max(0.45, w0 * Math.pow(1 - u, 0.7) * (1 + 0.22 * nz.n2(i * 0.08, row + 50)))]);
      h += (curl + wav * nz.n2((i * step) / lam, row) + 0.004 * nz.n2((i * step) / 23, row + 90)) * step;
      // steer along the rim instead of running into it
      const ddx = x - a.cx, ddy = y - a.cy, rho = Math.hypot(ddx, ddy), dr = rho - a.R;
      if (dr > LIM - 50) {
        const nx = ddx / rho, ny = ddy / rho;
        if (Math.cos(h) * nx + Math.sin(h) * ny > -0.06) {
          const tx = -ny, ty = nx, sg = Math.cos(h) * tx + Math.sin(h) * ty >= 0 ? 1 : -1;
          const target = Math.atan2(sg * ty, sg * tx) + sg * 0.07;
          h += angDiff(target, h) * 0.3 * sstep(LIM - 50, LIM, dr);
        }
      }
      x += Math.cos(h) * step; y += Math.sin(h) * step;
      const rho2 = Math.hypot(x - a.cx, y - a.cy);
      if (rho2 - a.R > LIM) { const f = (a.R + LIM) / rho2; x = a.cx + (x - a.cx) * f; y = a.cy + (y - a.cy) * f; }
    }
    return pts;
  }
  function tree(x, y, h, len, w0, depth, curl0) {
    const pts = grow(x, y, h, len, w0, depth, curl0), n = pts.length - 1;
    whiskers.push({ pts, w0, depth });
    // 珍珠点: tiny warts strung irregularly along the rootlet
    let i = Math.round(n * 0.06) + r.int(1, 5);
    while (i < n - 1) {
      const q = pts[i], sd = r.sign() * q[2] * 0.3, B = pts[i + 1];
      let nx = -(B[1] - q[1]), ny = B[0] - q[0]; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
      pearls.push({ x: q[0] + nx * sd, y: q[1] + ny * sd, r: L.clamp(0.8 + 0.34 * q[2] + r.range(0, 0.8), 1.1, 3.1), a: r.range(0.5, 0.95), u: i / n, depth });
      i += r.int(4, 12);
    }
    if (depth >= 2) return;
    const nb = depth === 0 ? r.int(3, 6) : r.int(1, 3);
    for (let b = 0; b < nb; b++) {
      const idx = Math.floor(r.range(0.08, 0.84) * n), q = pts[idx], q2 = pts[Math.min(n, idx + 1)];
      const hl = Math.atan2(q2[1] - q[1], q2[0] - q[0]);
      tree(q[0], q[1], hl + r.sign() * r.range(0.22, 0.7), len * (1 - idx / n) * r.range(0.45, 0.9) + (depth ? 30 : 60), Math.max(depth ? 0.75 : 1.0, q[2] * r.range(0.45, 0.7)), depth + 1);
    }
  }
  /** rootlet leaving bone b at fraction f, on side sd (−1 / +1; 0 = from the tip), turned `ang` away from the bone's direction */
  const spawn = (b, f, sd, ang, len, w0, curl0) => {
    const sp = boneAt(b, f), hb = Math.atan2(sp.ty, sp.tx), nx = -sp.ty, ny = sp.tx;
    tree(sp.x + nx * sd * sp.r * 0.7, sp.y + ny * sd * sp.r * 0.7, hb + (sd || 1) * ang, len * r.range(0.9, 1.2), w0, 0, curl0);
  };
  /** a brush of rootlets fanning from the tip of a branch root, plus alternating ones along its sides */
  const beard = (b, o) => {
    const { tips = 5, fan = 0.55, len = 560, w = 5, sides = 8, f0 = 0.36, slen = 440, sw = 3.6, sang = 0.55 } = o;
    for (let i = 0; i < tips; i++) spawn(b, 1 - 0.012 * Math.abs(i - (tips - 1) / 2), 0, L.lerp(-fan, fan, tips > 1 ? i / (tips - 1) : 0.5) + r.range(-0.08, 0.08), len * r.range(0.7, 1.15), i === (tips >> 1) ? w * 1.5 : w * r.range(0.7, 1));
    for (let i = 0; i < sides; i++) spawn(b, L.lerp(f0, 0.93, (i + r.range(-0.3, 0.3)) / (sides - 1)), i % 2 ? 1 : -1, sang + r.range(-0.2, 0.25), slen * r.range(0.65, 1.2), sw * r.range(0.75, 1.1));
  };
  beard(legA, { tips: 6, fan: 0.6, len: 600, w: 4.6, sides: 9 });
  beard(legB, { tips: 6, fan: 0.6, len: 560, w: 4.6, sides: 9 });
  beard(legC, { tips: 4, fan: 0.45, len: 520, w: 3.8, sides: 5, f0: 0.45, slen: 380, sw: 3 });
  beard(side, { tips: 3, fan: 0.5, len: 330, w: 3, sides: 3, f0: 0.5, slen: 240, sw: 2.2 });
  // long strands swept back under the body from the lower branch root, and thin ones off the belly of the main root
  [[0.5, 1, 1.15, 620, 3.6, 0.0012], [0.66, 1, 1.3, 700, 3.8, 0.001], [0.8, 1, 1.05, 640, 3.4, 0.0014], [0.9, 1, 1.5, 560, 3, 0.0008]].forEach((q) => spawn(legB, ...q));
  [[0.28, 1, 2.0, 330, 2.6], [0.45, 1, 1.6, 300, 2.4], [0.62, 1, 1.9, 360, 2.6, 0.001], [0.8, 1, 1.3, 300, 2.4], [0.5, -1, 2.3, 300, 2.2], [0.82, -1, 1.2, 260, 2.2]].forEach((q) => spawn(main, ...q));

  const layer = L.makeLayer(PAD, (g) => {
    g.fillStyle = '#000'; g.fillRect(-PAD, -PAD, LW, LH);
    g.globalCompositeOperation = 'lighter'; g.fillStyle = '#fff';
    for (const w of whiskers) {
      const n = w.pts.length - 1, al = L.clamp(0.15 + 0.062 * w.w0, 0.19, 0.5);
      g.globalAlpha = al; ribbon(g, w.pts, 0, n, 1, false);
      g.globalAlpha = al * 0.65; ribbon(g, w.pts, 0, Math.floor(n * 0.62), 0.62, true);   // denser core toward the base
    }
    for (const q of pearls) { g.globalAlpha = q.a; g.beginPath(); g.arc(q.x, q.y, q.r, 0, L.TAU); g.fill(); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'screen';
    g.drawImage(bodyC, BX0, BY0);
    // 芦碗: cup-shaped stem scars biting into alternate sides of the rhizome, the last one opening at its tip
    g.lineCap = 'round'; g.strokeStyle = '#fff';
    const cup = (x, y, rot, ex, ey, a0, a1) => {
      g.save(); g.translate(x, y); g.rotate(rot);
      g.globalCompositeOperation = 'multiply'; g.globalAlpha = 1;
      g.fillStyle = L.radial(g, 0, 0, 0, Math.max(ex, ey), [[0, '#161616'], [0.6, '#3a3a3a'], [0.92, '#a0a0a0'], [1, '#ffffff']]);
      g.beginPath(); g.ellipse(0, 0, ex, ey, 0, 0, L.TAU); g.fill();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.6; g.lineWidth = 1.7; g.beginPath(); g.ellipse(0, 0, ex, ey, 0, a0, a1); g.stroke();
      g.restore();
    };
    for (let kq = 1; kq <= 4; kq++) {
      const uq = 46 * (kq + 0.25 - 1.7 / L.TAU), sp = boneAt(head, uq / head.len), sd = kq % 2 ? 1 : -1;
      const nx = -sp.ty, ny = sp.tx, rot = Math.atan2(sp.ty, sp.tx);
      // the cup's wall is the half of the ellipse that faces the axis
      cup(sp.x + nx * sd * sp.r * 0.78, sp.y + ny * sd * sp.r * 0.78, rot, 13, sp.r * 0.52, sd > 0 ? Math.PI + 0.25 : 0.25, sd > 0 ? L.TAU - 0.25 : Math.PI - 0.25);
    }
    const tip = boneAt(head, 1), trot = Math.atan2(tip.ty, tip.tx);
    cup(tip.x + tip.tx * tip.r * 0.62, tip.y + tip.ty * tip.r * 0.62, trot, tip.r * 0.62, tip.r * 0.7, Math.PI * 0.5 + 0.3, Math.PI * 1.5 - 0.3);
  });

  // rootlet-tip pearls that will wink in turn: order them around the fork of the root
  const fork = boneAt(main, 1);
  const cand = pearls.filter((q) => q.depth >= 1 && q.u > 0.45 && q.x > 40 && q.x < W - 40 && q.y < H - 30 && !inBody(q.x, q.y));
  const rt = L.rng('s08tw'), tw = [];
  const want = 64, stride = Math.max(1, Math.floor(cand.length / want));
  for (let i = Math.floor(stride / 2); i < cand.length && tw.length < want; i += stride) {
    const q = cand[i];
    tw.push({ x: q.x, y: q.y, r: q.r, ang: Math.atan2(q.y - fork.y, q.x - fork.x), k: rt.range(0.6, 1) });
  }
  tw.sort((p, q) => p.ang - q.ang);
  tw.forEach((q, i) => { q.ph = L.clamp(i / (tw.length - 1) + rt.range(-0.06, 0.06)); });
  return { layer, tw };
}

// ───────────────────────── tray rim: a bundle of bamboo hoops spirally lashed with split strips ─────────────────────────
function buildRim(env, lut) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const BEAD0 = RIMW + 4, BEAD1 = RIMW + 19, GLOW = 44;     // a thin inner hoop pressed on the mat, and the fog the rim throws inward
  const X0 = -PAD, Y0 = Math.floor(a.crestY) - 3, Y1 = Math.ceil(a.yAt(X0, -(RIMW + GLOW))) + 4;
  const RW = LW, RH = Y1 - Y0;
  const img = new ImageData(RW, RH), d = img.data;
  const nz = L.makeNoise('s08rim');
  const PITCH = 27, SL = 17;
  const ro2 = (R + 0.6) * (R + 0.6), ri2 = (R - RIMW - GLOW) * (R - RIMW - GLOW);
  for (let j = 0; j < RH; j++) {
    const ddy = cy - (Y0 + j + 0.5);
    for (let i = 0; i < RW; i++) {
      const ddx = X0 + i + 0.5 - cx, q2 = ddx * ddx + ddy * ddy;
      if (q2 > ro2 || q2 < ri2) continue;
      const dr = Math.sqrt(q2) - R, s = Math.atan2(ddx, ddy) * R, o = (j * RW + i) * 4;
      const side = 1 - 0.12 * (s / 1150) * (s / 1150);
      if (dr < -RIMW - 0.5) {
        // inside the tray: the inner bead, then a soft fog fading into the mat
        const e = -dr - RIMW;
        let I = 0, al = 0.2 * Math.exp(-e / 15);
        if (e > BEAD0 - 0.5 && e < BEAD1 + 0.5) {
          const cb = (2 * (e - BEAD0)) / (BEAD1 - BEAD0) - 1, db = Math.min(e - BEAD0, BEAD1 - e);
          const pf = (s + 5 * cb) / 13, ef = Math.min(pf - Math.floor(pf), 1 - pf + Math.floor(pf)) * 13;
          I = (0.4 + 0.2 * Math.sqrt(Math.max(0, 1 - cb * cb)) + 0.2 * Math.exp(-Math.max(0, db) / 1.6) - 0.1 * Math.exp(-ef * ef / 2)) * side;
          al = L.clamp(db + 0.5);
          const li = Math.round(255 * L.clamp(I)) * 3;
          d[o] = lut[li]; d[o + 1] = lut[li + 1]; d[o + 2] = lut[li + 2]; d[o + 3] = 255 * al;
        } else { d[o] = 214; d[o + 1] = 222; d[o + 2] = 221; d[o + 3] = 255 * al * side; }
        continue;
      }
      const v = L.clamp(-dr / RIMW), c = 2 * v - 1, phi = Math.asin(c);
      const tube = Math.sqrt(Math.max(0, 1 - c * c));
      let I = 0.45 + 0.27 * tube;
      // the hoops inside the bundle show through as two faint seams along the rim
      const h1 = (v - 0.34) * RIMW, h2 = (v - 0.69) * RIMW;
      I += 0.05 * Math.exp(-h1 * h1 / 3) + 0.045 * Math.exp(-h2 * h2 / 3) - 0.035 * Math.exp(-(h1 - 3) * (h1 - 3) / 4) - 0.03 * Math.exp(-(h2 - 3) * (h2 - 3) / 4);
      // the lashing: a helix seen straight through — the near side leans one way (an S across the bundle), the far side the other
      const wob = 7 * nz.n2(s / 150, 1.7) + 2.5 * nz.n2(s / 31, 4.2);
      const pf = (s + SL * phi + wob) / PITCH, kf = Math.floor(pf), ff = pf - kf;
      const pb = (s - SL * phi - wob * 0.6) / PITCH + 0.37, kb = Math.floor(pb), fb = pb - kb;
      const ef = Math.min(ff, 1 - ff) * PITCH, eb = Math.min(fb, 1 - fb) * PITCH;
      const jf = hash1(kf);
      I += 0.11 * (jf - 0.5) + 0.04 * (hash1(kb + 5000) - 0.5);
      I *= 0.86 + 0.14 * Math.pow(Math.sin(Math.PI * ff), 0.6);
      I -= (0.13 + 0.08 * jf) * Math.exp(-ef * ef / 3.2) * (0.5 + 0.5 * tube);
      I += 0.075 * Math.exp(-(ef - 3.4) * (ef - 3.4) / 4.5) + 0.055 * Math.exp(-eb * eb / 4) * tube;
      // dense skin of the bundle, strongest on the outer edge (the arc)
      I += 0.4 * Math.exp(dr / 2.3) + 0.2 * Math.exp(-(dr + RIMW) / 2.6) + 0.12 * Math.exp(dr / 11) + 0.06 * Math.exp(-(dr + RIMW) / 10);
      // slow mottling, fibre, and a gentle fall-off toward the sides
      I *= 0.94 + 0.11 * nz.fbm(s / 240, v * 2.2, 3) + 0.035 * nz.n2(s / 5, v * 22);
      I *= side;
      const li = Math.round(255 * L.clamp(I)) * 3;
      d[o] = lut[li]; d[o + 1] = lut[li + 1]; d[o + 2] = lut[li + 2];
      d[o + 3] = 255 * L.clamp(0.5 - dr) * L.clamp(dr + RIMW + 0.5);
    }
  }
  const c = L.makeCanvas(RW, RH);
  c.getContext('2d').putImageData(img, 0, 0);
  return { canvas: c, y: Y0 };
}

/** film-negative grain to add over black: mostly nothing, a sparse dusting of faint specks */
function grainAdd(size, seed) {
  const r = L.rng(seed), img = new ImageData(size, size), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const v = 255 * 0.2 * Math.pow(r(), 3); d[i] = v * 0.96; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255; }
  const c = L.makeCanvas(size, size); c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

export default {
  name: '人参负片',
  tone: 'light',
  init(env) {
    const a = env.arc, lut = makeLut();
    const mat = buildMat(env), gin = buildGinseng(env);
    // halation: the dense root fogs the plate around it
    const q = L.makeCanvas(LW / 4, LH / 4), qg = q.getContext('2d');
    qg.filter = 'blur(11px)'; qg.drawImage(gin.layer, 0, 0, q.width, q.height); qg.filter = 'none';
    const tight = L.blurred(gin.layer, 7);
    const grey = L.makeLayer(PAD, (g) => {
      g.drawImage(mat, -PAD, -PAD);
      g.globalCompositeOperation = 'screen';
      g.globalAlpha = 0.6; g.drawImage(q, -PAD, -PAD, LW, LH);
      g.globalAlpha = 0.42; g.drawImage(tight, -PAD, -PAD);
      g.globalAlpha = 1; g.drawImage(gin.layer, -PAD, -PAD);
    });
    const innerY = Math.floor(a.crestY) - 40;
    const inner = tone(grey, PAD + innerY, LH - (PAD + innerY), lut);
    const rim = buildRim(env, lut);
    S = { inner, innerY, rim, tw: gin.tw, gAdd: grainAdd(512, 's08ga'), gOv: L.grainTex(512, 512, { seed: 's08go', amount: 0.5 }), pAdd: null, pOv: null };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    ctx.fillStyle = '#030404'; ctx.fillRect(0, 0, W, H);
    // slow push-in on the contents of the tray; the rim itself stays locked to the arc
    const camO = { zoom: L.lerp(1, 1.04, p), rot: L.lerp(-0.0012, 0.0012, p), pivot: { x: a.cx, y: a.crestY + RIMW } };
    L.cam(ctx, env, camO, () => {
      ctx.drawImage(S.inner, -PAD, S.innerY);
      // 珍珠点 on the rootlet tips wink one after another
      ctx.globalCompositeOperation = 'lighter';
      for (const q of S.tw) {
        const e = (p * 1.12 - 0.06 - q.ph) / 0.14, tw = Math.exp(-e * e) * q.k;
        if (tw < 0.04) continue;
        const rad = q.r * 3.4 + 6;
        ctx.fillStyle = L.radial(ctx, q.x, q.y, 0, rad, [[0, `rgba(244,248,247,${0.95 * tw})`], [0.22, `rgba(230,235,234,${0.42 * tw})`], [1, 'rgba(230,235,234,0)']]);
        ctx.fillRect(q.x - rad, q.y - rad, rad * 2, rad * 2);
      }
    });
    // unexposed black above the tray
    a.fillAbove(ctx, '#030404', -4);
    // the rim: its lashing creeps a few px along the arc
    ctx.save();
    ctx.translate(a.cx, a.cy); ctx.rotate(L.lerp(-0.003, 0.003, p)); ctx.translate(-a.cx, -a.cy);
    ctx.drawImage(S.rim.canvas, -PAD, S.rim.y);
    ctx.restore();
    // negative grain, re-seated every frame
    if (!S.pAdd) { S.pAdd = ctx.createPattern(S.gAdd, 'repeat'); S.pOv = ctx.createPattern(S.gOv, 'repeat'); }
    const rg = L.rng('s08grain' + (env.frame | 0)), ox = rg.int(0, 511), oy = rg.int(0, 511);
    ctx.save(); ctx.translate(-ox, -oy);
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.3; ctx.fillStyle = S.pOv; ctx.fillRect(ox, oy, W, H);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.4; ctx.fillStyle = S.pAdd; ctx.fillRect(ox, oy, W, H);
    ctx.restore();
  },
};
