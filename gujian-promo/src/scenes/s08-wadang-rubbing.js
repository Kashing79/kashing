// s08 — 云纹瓦当拓片. An ink rubbing (墨拓) of a Han cloud-pattern eave-tile end, enormously enlarged:
// the arc is the outer edge of the tile's wide rim. Raised parts (rim, string line, double-line divider,
// cloud scrolls, centre ring, boss) print dense black peppered with un-inked white specks; the recessed
// ground is a pale grey wash with stray ink dabs and a white halo hugging every raised line.
// Everything lives on ONE sheet of xuan paper, so paper, ink, colophon and seal move together.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 140;
const LW = W + PAD * 2, LH = H + PAD * 2;
let S = null;

// radial layout, in px BELOW the arc (d = -dr)
const RIM = 120;                 // 边轮: 0 … RIM
const STR0 = 141, STR1 = 155;    // 外圈弦纹 (raised string line)
const RING0 = 426, RING1 = 441;  // circle around the boss
const BOSS = 470;                // 圆钮 starts here
const FIELD = RING0 - STR1;      // depth of the cloud field
const THC = 0.245;               // angular centre of each visible cloud scroll
const LINE = 21;                 // width of the raised cloud lines

// half of a cloud scroll (卷云纹): a stem rises from the centre ring and splits into two arms that sweep up toward the rim,
// then roll outward, down and inward into a volute. X along the arc from the stem, Y up from the centre ring.
const STEM = 118;
const ARM = [[0, STEM], [22, 171], [80, 218], [160, 240], [246, 224], [302, 174], [312, 112], [274, 60], [210, 44],
  [156, 70], [140, 122], [166, 165], [212, 175], [246, 148], [241, 114], [215, 101]];

const sstep = (a, b, v) => { const t = v <= a ? 0 : v >= b ? 1 : (v - a) / (b - a); return t * t * (3 - 2 * t); };

function fieldPt(a, thC, X, Y) {
  const rMid = a.R - (RING0 - FIELD / 2);
  return a.pt(thC + X / rMid, -(RING0 - Y));
}

/** concentric band d0…d1 below the arc, edges gently irregular (hand-pressed clay, not CAD) */
function band(g, a, d0, d1, wob0, wob1, seed) {
  const nz = L.makeNoise('s08' + seed);
  const s = a.span(PAD + 200), n = 240;
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const th = L.lerp(-s, s, i / n);
    const p = a.pt(th, -(d0 + wob0 * nz.fbm(th * 16, 1.7, 3)));
    if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y);
  }
  for (let i = n; i >= 0; i--) {
    const th = L.lerp(-s, s, i / n);
    const p = a.pt(th, -(d1 + wob1 * nz.fbm(th * 16 + 40, 9.2, 3)));
    g.lineTo(p.x, p.y);
  }
  g.closePath(); g.fill();
}

/** relief mask: white = raised clay (takes ink), black = recessed ground */
function buildRelief(env) {
  const a = env.arc;
  return L.makeLayer(PAD, (g) => {
    g.fillStyle = '#000'; g.fillRect(-PAD, -PAD, LW, LH);
    g.fillStyle = '#fff';
    band(g, a, -1.2, RIM, 0, 3.4, 'rim');
    band(g, a, STR0, STR1, 1.8, 1.8, 'str');
    band(g, a, RING0, RING1, 2.2, 2.2, 'ring');
    band(g, a, BOSS, BOSS + 900, 3, 0, 'boss');
    // 双线界格: two parallel raised lines from the centre ring out to the string line
    const divider = (thC, seed) => {
      for (const sx of [-13, 13]) {
        const pts = [[sx, -6], [sx * 1.04, FIELD * 0.5], [sx, FIELD + 6]].map(([X, Y]) => { const p = fieldPt(a, thC, X, Y); return [p.x, p.y]; });
        L.inkStroke(g, pts, { width: 11.5, color: '#fff', seed: seed + sx, taper: [0, 0], wobble: 0.12 });
      }
    };
    divider(0, 40); divider(-0.66, 70); divider(0.66, 90);
    // 卷云纹: a stem rising from the centre ring that splits into two volutes curling down and inward
    const cloud = (thC, seed) => {
      for (const m of [-1, 1]) {
        const pts = ARM.map(([X, Y]) => { const p = fieldPt(a, thC, m * X, Y); return [p.x, p.y]; });
        L.inkStroke(g, pts, { width: LINE, color: '#fff', seed: seed + m * 3, taper: [0, 0.07], wobble: 0.17 });
        const e = pts[pts.length - 1];
        g.beginPath(); g.arc(e[0], e[1], LINE * 0.66, 0, L.TAU); g.fill();
      }
      const st = [[0, -6], [1.5, STEM * 0.5], [0, STEM + 6]].map(([X, Y]) => { const p = fieldPt(a, thC, X, Y); return [p.x, p.y]; });
      L.inkStroke(g, st, { width: LINE * 1.12, color: '#fff', seed: seed + 11, taper: [0, 0], wobble: 0.12 });
    };
    cloud(-THC, 101); cloud(THC, 202);
  });
}

/** void mask: black = no ink at all (cracks, chipped pits, paper fibres that shed the ink) */
function buildVoid(env) {
  const a = env.arc; const r = L.rng('s08void');
  return L.makeLayer(PAD, (g) => {
    g.fillStyle = '#fff'; g.fillRect(-PAD, -PAD, LW, LH);
    g.lineCap = 'round'; g.lineJoin = 'round';
    // fibres
    for (let i = 0; i < 300; i++) {
      const p = a.pt(r.range(-0.75, 0.75), -r.range(-6, 640));
      const len = r.range(18, 80), ang = r.range(0, Math.PI), cs = Math.cos(ang), sn = Math.sin(ang);
      g.strokeStyle = `rgba(0,0,0,${r.range(0.12, 0.5).toFixed(3)})`; g.lineWidth = r.range(0.6, 1.3);
      g.beginPath(); g.moveTo(p.x, p.y);
      g.quadraticCurveTo(p.x + cs * len * 0.5 + r.range(-10, 10), p.y + sn * len * 0.5 + r.range(-10, 10), p.x + cs * len, p.y + sn * len);
      g.stroke();
    }
    // pits and small chips, mostly on the rim
    g.fillStyle = '#000';
    for (let i = 0; i < 90; i++) {
      const onRim = i < 60;
      const p = a.pt(r.range(-0.72, 0.72), -(onRim ? r.range(10, RIM - 6) : r.range(RIM, 620)));
      const rad = L.lerp(1.6, onRim ? 7.5 : 6, Math.pow(r(), 2.4));
      g.globalAlpha = r.range(0.5, 1);
      const nv = r.int(5, 8), a0 = r.range(0, L.TAU);
      g.beginPath();
      for (let k = 0; k < nv; k++) {
        const an = a0 + (k / nv) * L.TAU, rr = rad * r.range(0.45, 1.25);
        const px = p.x + Math.cos(an) * rr * 1.3, py = p.y + Math.sin(an) * rr * 0.8;
        if (k) g.lineTo(px, py); else g.moveTo(px, py);
      }
      g.closePath(); g.fill();
    }
    g.globalAlpha = 1;
    // an old break across the tile (left side): a thin jagged white line
    const crack = (th0, th1, d0, d1, seed, w) => {
      const nz = L.makeNoise('s08crack' + seed); const n = 30; const pts = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const th = L.lerp(th0, th1, t) + 0.011 * nz.fbm(t * 4.5, 1.1, 3) + 0.0035 * nz.n2(t * 26, 5.5);
        const p = a.pt(th, -L.lerp(d0, d1, t)); pts.push(p);
      }
      g.strokeStyle = '#000';
      for (let i = 0; i < n; i++) {
        g.lineWidth = w * (0.55 + 0.9 * Math.abs(nz.n2(i * 0.63, 9.9)));
        g.beginPath(); g.moveTo(pts[i].x, pts[i].y); g.lineTo(pts[i + 1].x, pts[i + 1].y); g.stroke();
      }
    };
    crack(-0.468, -0.352, -4, 520, 1, 4.6);
    crack(-0.418, -0.47, 236, 420, 2, 2.6);
  });
}

function makeLat(seed, n) {
  const r = L.rng(seed); const a = new Float32Array(n * n);
  for (let i = 0; i < a.length; i++) a[i] = r();
  return { a, n, m: n - 1 };
}
/** tileable smooth value noise in [0,1] */
function vn(lat, x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let fx = x - xi, fy = y - yi; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const m = lat.m, n = lat.n, a = lat.a;
  const x0 = xi & m, x1 = (xi + 1) & m, y0 = (yi & m) * n, y1 = ((yi + 1) & m) * n;
  const p = a[y0 + x0], q = a[y0 + x1], r = a[y1 + x0], s = a[y1 + x1];
  const top = p + (q - p) * fx;
  return top + (r + (s - r) * fx - top) * fy;
}

/** the rubbing itself: per-pixel ink density from the relief mask + layered noise */
function buildInk(env, relief, voidL) {
  const a = env.arc;
  const y0 = Math.max(0, Math.floor(PAD + a.crestY - 36));
  const hh = LH - y0;
  const mS = L.blurred(relief, 1.5).getContext('2d').getImageData(0, y0, LW, hh).data;
  const vd = L.blurred(voidL, 0.7).getContext('2d').getImageData(0, y0, LW, hh).data;
  // wide blur of the relief at half res → "how close is raised clay" (for the un-inked halo around lines)
  const hw = Math.ceil(LW / 2), hh2 = Math.ceil(hh / 2);
  const wc = L.makeCanvas(hw, hh2); const wg = wc.getContext('2d', { willReadFrequently: true });
  wg.fillStyle = '#000'; wg.fillRect(0, 0, hw, hh2);
  wg.filter = 'blur(6px)'; wg.drawImage(relief, 0, y0, LW, hh, 0, 0, LW / 2, hh / 2); wg.filter = 'none';
  const mW = wg.getImageData(0, 0, hw, hh2).data;

  // low-frequency fields on a coarse grid: how hard the ink pad came down here (dab blotches) + worn zones
  const GS = 10, gw = Math.ceil(LW / GS) + 2, gh = Math.ceil(hh / GS) + 2;
  const nA = L.makeNoise('s08dab'), nB = L.makeNoise('s08wear'), nC = L.makeNoise('s08mott');
  const f1 = new Float32Array(gw * gh), f2 = new Float32Array(gw * gh), f3 = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const X = gx * GS, Y = gy * GS + y0, i = gy * gw + gx;
    f1[i] = nA.fbm(X / 95, Y / 95, 3);
    f2[i] = nB.fbm(X / 340, Y / 340, 3);
    f3[i] = nC.fbm(X / 42, Y / 42, 2);
  }
  const l1 = makeLat('s08l1', 512), l2 = makeLat('s08l2', 512), l3 = makeLat('s08l3', 256), l4 = makeLat('s08l4', 256);
  const nS = L.makeNoise('s08smudge');

  const out = new ImageData(LW, hh); const o = out.data;
  const cxL = a.cx + PAD, cyL = a.cy + PAD, R = a.R;
  for (let y = 0; y < hh; y++) {
    const Y = y + y0, dy = Y - cyL;
    const gyf = y / GS, gy0 = Math.floor(gyf), ty = gyf - gy0, row0 = gy0 * gw, row1 = row0 + gw;
    const wrow = (y >> 1) * hw;
    for (let x = 0; x < LW; x++) {
      const dx = x - cxL;
      const d = R - Math.sqrt(dx * dx + dy * dy); // > 0 inside the tile
      if (d < -40) continue;
      const k = (y * LW + x) * 4;
      const v1 = vn(l1, x / 1.7, Y / 1.7), v2 = vn(l2, x / 3.9, Y / 3.9), v3 = vn(l3, x / 9.3, Y / 9.3), v4 = vn(l4, x / 23, Y / 23);
      const z = (0.36 * v1 + 0.30 * v2 + 0.22 * v3 + 0.12 * v4 - 0.5) * 9; // ≈ N(0,1)
      let D;
      if (d < 0) {
        // paper just outside the rim: faint smudges where the pad overshot the edge
        const th = Math.atan2(dx, -dy);
        const s = sstep(0.02, 0.5, nS.fbm(th * 10, 3.3, 2));
        D = s * (Math.exp(d / 10) * 0.26 * (0.5 + 0.5 * v3) + Math.exp(d / 22) * 0.45 * sstep(1.3, 2.1, z));
        const m = mS[k] / 255;
        const I0 = sstep(0.9, 1.9, (m - 0.5) * 5 + 0.95 * z);
        if (I0 > D) D = I0;
      } else {
        const gxf = x / GS, gx0 = Math.floor(gxf), tx = gxf - gx0, i0 = row0 + gx0, i1 = row1 + gx0;
        const f1v = L.lerp(L.lerp(f1[i0], f1[i0 + 1], tx), L.lerp(f1[i1], f1[i1 + 1], tx), ty);
        const f2v = L.lerp(L.lerp(f2[i0], f2[i0 + 1], tx), L.lerp(f2[i1], f2[i1 + 1], tx), ty);
        const f3v = L.lerp(L.lerp(f3[i0], f3[i0 + 1], tx), L.lerp(f3[i1], f3[i1 + 1], tx), ty);
        const m = mS[k] / 255;
        // raised clay: solid ink, eaten by specks where the noise dips; the low fields vary how speckled it is
        const a1 = (m - 0.5) * 4.7 + 0.95 * z + 1.4 * f1v + 1.5 * f2v + 0.5 * f3v;
        D = sstep(0.9, 1.9, a1);
        // recessed ground: a dry, granular grey (stippled, not airbrushed) + stray dabs, thinning to bare paper beside raised lines
        const halo = sstep(10 + 14 * f3v, 46 + 22 * f3v, mW[(wrow + (x >> 1)) * 4]);
        const z2 = (0.3 * vn(l2, x / 3.9 + 77.7, Y / 3.9 + 19.3) + 0.4 * vn(l3, x / 9.3 + 31.1, Y / 9.3 + 57.9) + 0.3 * vn(l4, x / 23 + 5.5, Y / 23 + 9.1) - 0.5) * 9;
        let cover = 0.27 + 0.3 * f1v + 0.26 * f2v;
        cover = (cover < 0.05 ? 0.05 : cover > 0.6 ? 0.6 : cover) * (1 - 0.94 * halo);
        const zf = (0.5 * v1 + 0.5 * vn(l2, x / 2.6 + 11.3, Y / 2.6 + 47.1) - 0.5) * 6.4;
        const tS = 1.9 - 4.2 * cover;
        const stip = sstep(tS - 0.4, tS + 0.4, zf);
        const sp = (sstep(0.9, 1.8, z2 + 1.2 * f3v) * 0.8 + sstep(1.7, 2.4, z) * 0.4) * (1 - 0.94 * halo);
        const Dg = (cover * 0.42 + stip * 0.62 + sp) * sstep(0, 2.5, d);
        if (Dg > D) D = Dg;
      }
      D *= vd[k] / 255;
      if (D <= 0.004) continue;
      o[k] = 20; o[k + 1] = 18; o[k + 2] = 16; o[k + 3] = D > 1 ? 255 : D * 255;
    }
  }
  const ink = L.makeCanvas(LW, LH);
  ink.getContext('2d').putImageData(out, 0, y0);
  ink._pad = PAD;
  return ink;
}

/** a small red seal impression (白文): square-spiral 回纹 ornament only — deliberately NOT legible characters */
function buildSeal() {
  const n = 96; const c = L.makeCanvas(n, n); const g = c.getContext('2d');
  g.fillStyle = '#b3261e';
  L.roughPoly(g, [[9, 9], [n - 9, 9], [n - 9, n - 9], [9, n - 9]], { rough: 1.5, seed: 8, step: 5 }); g.fill();
  g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.5;
  g.drawImage(L.noiseTex(n, n, { seed: 's08sealtone', scale: 16, octaves: 3, res: 1, contrast: 1.6, ramp: [[0, '#7c1410'], [0.5, 'rgba(179,38,30,0)'], [1, '#d4503c']] }), 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'destination-out';
  g.strokeStyle = '#000'; g.lineWidth = 3.3; g.lineCap = 'square'; g.lineJoin = 'miter';
  const spiral = (cx, cy, flipX, flipY) => {
    const s = 5.6; const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    let x = 0, y = -3, len = s;
    g.beginPath(); g.moveTo(cx + x * flipX, cy + y * flipY);
    for (let i = 0; i < 7; i++) { x += dirs[i % 4][0] * len; y += dirs[i % 4][1] * len; g.lineTo(cx + x * flipX, cy + y * flipY); if (i % 2) len += s; }
    g.stroke();
  };
  spiral(31, 31, 1, 1); spiral(65, 31, -1, 1); spiral(31, 65, 1, -1); spiral(65, 65, -1, -1);
  // worn impression
  L.speckle(g, { seed: 's08sealwear', count: 260, x: 0, y: 0, w: n, h: n, rMin: 0.4, rMax: 2.4, colors: ['#000'], alpha: [0.3, 1] });
  return c;
}

function buildSheet(env) {
  const a = env.arc;
  const relief = buildRelief(env);
  const ink = buildInk(env, relief, buildVoid(env));
  const paper = L.paperTex(LW, LH, { base: '#ece4d2', seed: 's08paper', tone: '#9a7b4a', fiber: 0.75, stain: 0.4, grain: 0.2 });
  return L.makeLayer(PAD, (g) => {
    g.drawImage(paper, -PAD, -PAD);
    // 帘纹: the faint laid lines of hand-made xuan paper
    g.fillStyle = 'rgba(120,96,52,0.05)';
    for (let y = -PAD; y < H + PAD; y += 9) g.fillRect(-PAD, y, LW, 1.2);
    g.fillStyle = 'rgba(255,252,240,0.05)';
    for (let x = -PAD + 60; x < W + PAD; x += 168) g.fillRect(x, -PAD, 2, LH);
    // gentle cockling of the sheet
    g.save(); g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.3;
    g.drawImage(L.noiseTex(LW, LH, { seed: 's08cockle', scale: 420, sx: 1.7, octaves: 3, res: 0.12, contrast: 1.5 }), -PAD, -PAD);
    g.restore();
    // foxing + a few stray ink flecks on the bare paper
    L.speckle(g, { seed: 's08fox', count: 90, x: -PAD, y: -PAD, w: LW, h: LH, rMin: 1, rMax: 5, colors: ['#b0915a', '#a58450'], alpha: [0.05, 0.22] });
    L.speckle(g, { seed: 's08fleck', count: 46, x: 190, y: 300, w: 420, h: 260, rMin: 0.6, rMax: 3.2, colors: ['#1b1814'], alpha: [0.1, 0.5], test: (x, y) => a.drAt(x, y) > 12 });
    g.fillStyle = L.radial(g, 330, 470, 0, 150, [[0, 'rgba(30,27,24,0.07)'], [1, 'rgba(30,27,24,0)']]); g.fillRect(180, 320, 300, 300);
    // puckers in the paper where it was pressed down over the edge of the tile: short radial creases outside the rim
    const rc = L.rng('s08crease');
    g.save(); g.lineCap = 'round';
    for (let i = 0; i < 64; i++) {
      const th = rc.range(-0.72, 0.72), d0 = rc.range(3, 16), len = rc.range(22, 120) * (rc.chance(0.2) ? 1.6 : 1);
      const lean = rc.range(-0.35, 0.35), bend = rc.range(-10, 10), al = rc.range(0.35, 1);
      a.at(g, th, d0, () => {
        const ex = Math.sin(lean) * len, ey = -Math.cos(lean) * len;
        for (const [ox, col, w] of [[0, `rgba(96,76,44,${(0.13 * al).toFixed(3)})`, 1.5], [-1.5, `rgba(255,253,244,${(0.5 * al).toFixed(3)})`, 1.2]]) {
          g.strokeStyle = col; g.lineWidth = w;
          g.beginPath(); g.moveTo(ox, 0); g.quadraticCurveTo(ex * 0.5 + bend + ox, ey * 0.5, ex + ox, ey); g.stroke();
        }
      });
    }
    g.restore();
    // the rubbing
    g.drawImage(ink, -PAD, -PAD);
    // the paper was beaten into the relief while wet: a whisper of emboss along every raised edge (light from the upper left)
    g.save(); a.clipBelow(g, 14);
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.55;
    g.drawImage(L.bumpLight(L.blurred(relief, 2.6), { angle: 45, strength: 2.4, res: 0.5 }), -PAD, -PAD);
    g.restore();
    // 题签 + 钤印 at the upper right
    const tx = 1692; let ty = 118; const size = 58, step = 66;
    g.save(); g.globalCompositeOperation = 'multiply';
    L.text(g, '汉', tx, ty, { font: 'brush', size, weight: 400, color: '#1c1915', alpha: 0.93 });
    ty += step + 26;
    for (const ch of '云纹瓦当') { L.text(g, ch, tx, ty, { font: 'brush', size, weight: 400, color: '#1c1915', alpha: 0.93 }); ty += step; }
    g.translate(tx + 1, ty + 26); g.rotate(0.022);
    g.globalAlpha = 0.94; g.drawImage(buildSeal(), -41, -41, 82, 82);
    g.restore();
  });
}

export default {
  name: '云纹瓦当拓片',
  tone: 'dark',
  init(env) {
    S = { sheet: buildSheet(env) };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    // the whole sheet drifts along the arc and the camera creeps in; zoom passes through 1 at mid-shot so the rim sits on the arc
    const rot = L.lerp(-0.006, 0.006, p), zoom = L.lerp(0.988, 1.016, p);
    ctx.fillStyle = '#ece4d2'; ctx.fillRect(0, 0, W, H);
    L.blit(ctx, env, S.sheet, { rot, zoom });
    // fixed copy-stand light: warm from the upper left, falling off to the lower right
    ctx.save(); ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = L.linear(ctx, 0, 0, W, H, [[0, 'rgba(255,246,224,0.34)'], [0.5, 'rgba(128,128,128,0)'], [1, 'rgba(0,0,0,0.28)']]);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    // a breath of sheen sliding over the dense ink of the rim
    const gl = a.pt(L.lerp(-0.2, 0.06, p), -62);
    L.glow(ctx, gl.x, gl.y, 420, '#fff6e4', 0.07);
    L.vignette(ctx, { strength: 0.2 });
  },
};
