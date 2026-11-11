// s31 — 博古图剪纸拼贴. A hand-made paper collage of a 博古图 (scholar's "antiques" picture).
// Cream card above; the arc is the torn top edge of one big sheet of ultramarine paper, its white core showing along the tear.
// Glued on the blue sheet, big naive scissor-cut shapes that overlap each other and run off the bottom of frame: an orange
// folding fan, a lemon-yellow jade disc (璧) leaning on two thread-bound books, a vermilion long-necked vase, a green ruyi
// sceptre, an aubergine tripod censer sitting on a scrap of white paper scribbled with pencil, and a wisp of pink tissue
// cut into a lingzhi. Everything is one rigid piece of artwork: the camera only slips a few pixels along the arc.
import * as L from '../../../lib/core.js';

const { W, H, TAU } = L;
const PAD = 40;
const GW = W + PAD * 2, GH = H + PAD * 2;
let S = null;
let T = null;      // shared paper textures (only alive during init)

const C = {
  card: '#eee8d8', blue: '#2452a0', red: '#d0281e', green: '#3f9a58', yellow: '#f3e37a',
  purple: '#2a2150', brown: '#5c2616', orange: '#e8862a', pink: '#d59ad8', white: '#f6f3ea', label: '#eadfc2',
};

// ───────────────────────── paper textures (grey, 128 = neutral → composited with hard-light) ─────────────────────────
function buildTextures() {
  // 1) grain: fine flocked mottle with a breath of relief, per-pixel tooth, loose fibres, a few inclusions
  const grain = L.makeCanvas(GW, GH); const g = grain.getContext('2d');
  const flock = L.noiseTex(GW, GH, { seed: 'a31flock', scale: 4.6, octaves: 2, gain: 0.6, res: 0.5, contrast: 1.5, ramp: [[0, '#707070'], [1, '#909090']] });
  g.drawImage(flock, 0, 0);
  g.globalCompositeOperation = 'overlay';
  g.drawImage(L.bumpLight(flock, { angle: 45, strength: 0.3, res: 0.5 }), 0, 0);
  g.globalAlpha = 0.6;
  g.drawImage(L.grainTex(GW, GH, { seed: 'a31tooth', amount: 0.2 }), 0, 0);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  const r = L.rng('a31fib'); g.lineCap = 'round';
  for (let i = 0; i < 9000; i++) {
    const x = r() * GW, y = r() * GH, len = r.range(5, 30) * (r.chance(0.06) ? 2.2 : 1), a = r() * Math.PI;
    g.strokeStyle = r.chance(0.6) ? `rgba(255,255,255,${r.range(0.06, 0.26).toFixed(3)})` : `rgba(0,0,0,${r.range(0.05, 0.2).toFixed(3)})`;
    g.lineWidth = r.range(0.5, 1.3);
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + r.range(-5, 5), y + Math.sin(a) * len * 0.5 + r.range(-5, 5), x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  L.speckle(g, { seed: 'a31inc', count: 800, x: 0, y: 0, w: GW, h: GH, rMin: 0.5, rMax: 1.7, colors: ['#000', '#fff', '#fff'], alpha: [0.05, 0.28] });

  // 2) cloud: slow tonal drift of the dye
  const cloud = L.noiseTex(GW, GH, { seed: 'a31cloud', scale: 260, octaves: 3, res: 0.08, contrast: 1.4, ramp: [[0, '#6c6c6c'], [1, '#949494']] });

  // 3) cockle: the gentle buckling of paper that was wetted with glue
  const cockle = L.bumpLight(L.noiseTex(GW, GH, { seed: 'a31cockle', scale: 150, octaves: 2, gain: 0.4, warp: 0.5, res: 0.1 }), { angle: 45, strength: 1.1, res: 0.25, blur: 3 });

  // 4) crumple: flat-shaded facets with thin creases between them (thin paper that was creased, then smoothed flat)
  const res = 0.25, cw = Math.round(GW * res), ch = Math.round(GH * res);
  const nz = L.makeNoise('a31crumple');
  const img = new ImageData(cw, ch); const d = img.data;
  let k = 0;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const u0 = x / res / 170, v0 = y / res / 170;
    const u = u0 + 0.3 * nz.n2(u0 * 0.8 + 3.1, v0 * 0.8), v = v0 + 0.3 * nz.n2(u0 * 0.8 - 5.2, v0 * 0.8 + 9.4);
    const c1 = nz.cell(u, v), c2 = nz.cell(u * 2.3 + 11.3, v * 2.3 + 7.1);
    let s = 128 + (c1.id - 0.5) * 56 + (c2.id - 0.5) * 26;
    s += 16 * Math.exp(-(c1.edge * c1.edge) / 0.0014) + 7 * Math.exp(-(c2.edge * c2.edge) / 0.003);
    d[k++] = s; d[k++] = s; d[k++] = s; d[k++] = 255;
  }
  const small = L.makeCanvas(cw, ch); small.getContext('2d').putImageData(img, 0, 0);
  const crumple = L.makeCanvas(GW, GH); const cg = crumple.getContext('2d');
  cg.imageSmoothingQuality = 'high'; cg.filter = 'blur(1.2px)';
  cg.drawImage(small, 0, 0, GW, GH);
  return { grain, cloud, cockle, crumple };
}

// ───────────────────────── geometry helpers ─────────────────────────
/** local shape → frame: scale, rotate (rad, clockwise on screen), translate; keeps the "corner" flag in p[2] */
function xf(pts, { at = [0, 0], rot = 0, scale = 1 } = {}) {
  const s = Math.sin(rot), c = Math.cos(rot);
  return pts.map((p) => { const x = p[0] * scale, y = p[1] * scale; const q = [at[0] + x * c - y * s, at[1] + x * s + y * c]; if (p[2]) q[2] = 1; return q; });
}
/**
 * Scissor-cut outline. ctrl: [[x, y, corner?], …] closed. Runs between corners are splined, then re-cut into straight snips
 * of irregular length (the way scissors actually go round a curve); a two-point run is one long cut with a slight waver.
 */
function snip(ctrl, seed, facet = [38, 72], jit = 1.2) {
  const r = L.rng('a31cut' + seed);
  const n = ctrl.length;
  let s = ctrl.findIndex((p) => p[2]); if (s < 0) s = 0;
  const pts = ctrl.slice(s).concat(ctrl.slice(0, s));
  const out = [];
  let i = 0;
  while (i < n) {
    let j = i + 1;
    while (j < n && !pts[j][2]) j++;
    const run = [];
    for (let q = i; q <= j; q++) run.push([pts[q % n][0], pts[q % n][1]]);
    const straight = run.length === 2;
    const dense = straight ? run : L.smoothPath(run, 3);
    const len = [0];
    for (let q = 1; q < dense.length; q++) len.push(len[q - 1] + Math.hypot(dense[q][0] - dense[q - 1][0], dense[q][1] - dense[q - 1][1]));
    const total = len[len.length - 1];
    const cnt = Math.max(1, Math.round(total / (straight ? r.range(130, 240) : r.range(facet[0], facet[1]))));
    out.push(run[0]);
    let di = 0;
    for (let q = 1; q < cnt; q++) {
      const target = (total * (q + r.range(-0.2, 0.2))) / cnt;
      while (di < dense.length - 2 && len[di + 1] < target) di++;
      const t = (target - len[di]) / Math.max(1e-6, len[di + 1] - len[di]);
      out.push([L.lerp(dense[di][0], dense[di + 1][0], t) + r.range(-jit, jit), L.lerp(dense[di][1], dense[di + 1][1], t) + r.range(-jit, jit)]);
    }
    i = j;
  }
  return out;
}
/** a disc the way scissors make it: a many-sided polygon */
function roundish(cx, cy, rad, n, seed, wob = 0.03) {
  const r = L.rng('a31round' + seed); const a0 = r() * TAU; const pts = [];
  for (let i = 0; i < n; i++) { const a = a0 + ((i + r.range(-0.22, 0.22)) / n) * TAU, q = rad * (1 + r.range(-wob, wob)); pts.push([cx + q * Math.cos(a), cy + q * Math.sin(a)]); }
  return pts;
}
/** the two edges of a tapered strip along a centre line (smoothed); wf(t) → full width */
function strip(ctrl, wf, step = 6) {
  const p = L.smoothPath(ctrl, step), n = p.length, A = [], B = [];
  for (let i = 0; i < n; i++) {
    const a = p[Math.max(0, i - 1)], b = p[Math.min(n - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
    const hw = wf(i / (n - 1)) / 2;
    A.push([p[i][0] + nx * hw, p[i][1] + ny * hw]); B.push([p[i][0] - nx * hw, p[i][1] - ny * hw]);
  }
  return { A, B };
}

// ───────────────────────── one piece of paper ─────────────────────────
let seq = 0;
/**
 * Glue a piece of paper onto the layer. polys = one closed polygon or several (even-odd → holes).
 * o: color, alpha (thin paper lets what is underneath show through), grain / cloud / cockle / crumple (texture strengths),
 *    lift + sh (how far it stands off the sheet, shadow strength), edge (paper thickness), curl (light falling across it),
 *    creases [[x0,y0,x1,y1,strength]], peel [[x,y,r]] (a corner that has come unstuck), shadow (false → none)
 */
function paper(g, polys, o) {
  if (typeof polys[0][0] === 'number') polys = [polys];
  const { color, alpha = 1, grain = 0.5, cloud = 0.22, cockle = 0.25, crumple = 0, lift = 1, sh = 1, edge = 1, curl = 1, creases = null, peel = null, shadow = true } = o;
  const r = L.rng('a31pp' + (o.seed !== undefined ? o.seed : seq++));
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of polys) for (const q of p) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
  x0 = Math.max(x0, -PAD); y0 = Math.max(y0, -PAD); x1 = Math.min(x1, W + PAD); y1 = Math.min(y1, H + PAD);
  const bw = x1 - x0, bh = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const path = () => {
    g.beginPath();
    for (const p of polys) { g.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) g.lineTo(p[i][0], p[i][1]); g.closePath(); }
  };
  if (shadow) {
    // shadows on their own: the shape is drawn far off-canvas and only its shadow lands here (so thin paper can stay translucent)
    const BIG = 9000;
    const cast = (blur, dx, dy, al) => {
      g.save(); g.translate(-BIG, 0);
      g.shadowColor = `rgba(6,10,36,${al.toFixed(3)})`; g.shadowBlur = blur; g.shadowOffsetX = BIG + dx; g.shadowOffsetY = dy;
      g.fillStyle = '#000'; path(); g.fill('evenodd'); g.restore();
    };
    // a corner that has come unstuck throws a deeper, softer shadow
    if (peel) for (const [px, py, pr] of peel) {
      g.save(); g.translate(6, 10);
      g.shadowColor = 'rgba(0,0,0,0)';
      g.fillStyle = L.radial(g, px - 6, py - 10, 0, pr, [[0, 'rgba(6,10,36,0.3)'], [0.5, 'rgba(6,10,36,0.15)'], [1, 'rgba(6,10,36,0)']]);
      g.filter = 'blur(6px)'; path(); g.fill('evenodd'); g.restore();
    }
    cast(8 * lift, 2.2 * lift, 4 * lift, 0.15 * sh);
    cast(1.8, 0.7, 1.3, 0.34 * sh);
  }
  g.save(); g.globalAlpha = alpha; g.fillStyle = color; path(); g.fill('evenodd'); g.restore();
  // everything else stays inside the piece
  g.save(); path(); g.clip('evenodd');
  const place = (tex, al, mode = 'hard-light') => {
    const ox = r.range(0, Math.max(0, GW - bw - 8)), oy = r.range(0, Math.max(0, GH - bh - 8));
    g.save(); g.globalCompositeOperation = mode; g.globalAlpha = al;
    g.drawImage(tex, x0 - 4 - ox, y0 - 4 - oy);
    g.restore();
  };
  if (cloud > 0) place(T.cloud, cloud);
  if (crumple > 0) place(T.crumple, crumple);
  if (cockle > 0) place(T.cockle, cockle, 'soft-light');
  if (grain > 0) place(T.grain, grain);
  const pc = L.parseColor(color), lum = (0.299 * pc[0] + 0.587 * pc[1] + 0.114 * pc[2]) / 255;
  if (creases) for (const [ax, ay, bx, by, st = 1] of creases) {
    // a fold that was pressed flat again: the face turned to the light is a touch brighter, the other a touch darker
    const ang = Math.atan2(by - ay, bx - ax), len = Math.hypot(bx - ax, by - ay), wd = 60;
    const up = (Math.cos(ang) * -0.8 - Math.sin(ang) * -0.6) > 0 ? 1 : -1;   // which side of the fold faces the upper-left light
    g.save(); g.translate(ax, ay); g.rotate(ang);
    const hi = (0.06 + 0.07 * lum) * st, lo = 0.075 * st;
    g.fillStyle = L.linear(g, 0, -wd * up, 0, 0, [[0, 'rgba(255,255,255,0)'], [1, `rgba(255,255,255,${hi.toFixed(3)})`]]);
    g.fillRect(-60, Math.min(0, -wd * up), len + 120, wd);
    g.fillStyle = L.linear(g, 0, 0, 0, wd * up, [[0, `rgba(0,0,24,${lo.toFixed(3)})`], [1, 'rgba(0,0,24,0)']]);
    g.fillRect(-60, Math.min(0, wd * up), len + 120, wd);
    g.fillStyle = `rgba(255,255,255,${(hi * 1.8).toFixed(3)})`; g.fillRect(-60, -0.5, len + 120, 1);
    g.restore();
  }
  if (curl > 0) {
    // no sheet lies perfectly flat: the light falls off a little across it
    const a = L.deg(52) + r.range(-0.5, 0.5), rad = Math.hypot(bw, bh) / 2;
    const dx = Math.cos(a) * rad, dy = Math.sin(a) * rad;
    g.fillStyle = L.linear(g, cx - dx, cy - dy, cx + dx, cy + dy, [[0, `rgba(255,252,240,${(0.07 * curl * (0.3 + 0.7 * lum)).toFixed(3)})`], [0.45, 'rgba(255,252,240,0)'], [0.6, 'rgba(0,0,24,0)'], [1, `rgba(0,0,24,${(0.07 * curl).toFixed(3)})`]]);
    g.fillRect(x0 - 8, y0 - 8, bw + 16, bh + 16);
  }
  if (peel) for (const [px, py, pr] of peel) {
    g.fillStyle = L.radial(g, px, py, 0, pr * 0.85, [[0, 'rgba(255,255,250,0.14)'], [0.6, 'rgba(255,255,250,0.04)'], [1, 'rgba(255,255,250,0)']]);
    g.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  }
  if (edge > 0) {
    // paper thickness: the cut edge catches light on the upper-left and falls into shade on the lower-right
    g.lineJoin = 'round'; g.lineWidth = 1.3;
    g.save(); g.translate(0.8, 1.1); g.strokeStyle = `rgba(255,255,255,${(0.2 * edge * (1.2 - lum)).toFixed(3)})`; path(); g.stroke(); g.restore();
    g.save(); g.translate(-0.8, -1.1); g.strokeStyle = `rgba(0,0,16,${(0.16 * edge).toFixed(3)})`; path(); g.stroke(); g.restore();
  }
  g.restore();
}

// ───────────────────────── the shapes ─────────────────────────
// long-necked vase: mouth, neck, shoulder, belly (its lower half runs off the bottom of frame). Local: x from the axis, y from the mouth.
const VASE = [
  [-47, 2, 1], [51, -2, 1], [57, 17, 1], [38, 34, 1],
  [31, 90], [30, 152], [38, 198], [68, 238], [110, 276], [137, 324], [143, 370], [129, 420], [100, 464], [80, 494, 1],
  [84, 560, 1], [-82, 560, 1], [-78, 496, 1],
  [-96, 468], [-125, 424], [-141, 375], [-137, 328], [-113, 281], [-73, 243], [-44, 206], [-33, 160], [-30, 98], [-37, 40, 1], [-55, 22, 1],
];
// ruyi head (云头): three lobes round a pointed neck. Local origin = centre of the head, neck pointing +y.
const RUYI_HEAD = [
  [-24, 82, 1], [-60, 76], [-98, 54], [-114, 14], [-102, -24], [-74, -38], [-57, -30, 1],
  [-54, -62], [-30, -90], [4, -97], [36, -86], [56, -60], [59, -28, 1],
  [78, -37], [106, -19], [116, 16], [98, 55], [60, 76], [24, 84, 1],
];
// small tripod censer: two loop ears standing on a flat rim, a squat drum belly, three short legs. Local origin = middle of the rim.
const CENSER = [
  [-126, 0, 1], [-103, 0, 1], [-107, -30], [-93, -47], [-66, -47], [-51, -30], [-55, 0, 1],
  [55, 0, 1], [52, -30], [66, -46], [93, -47], [107, -30], [103, 0, 1], [126, 0, 1],
  [121, 17, 1], [106, 28], [140, 62], [152, 104], [138, 146], [118, 166, 1],
  [129, 226, 1], [94, 228, 1], [84, 176, 1], [54, 184], [20, 188, 1], [18, 232, 1], [-16, 233, 1], [-20, 188, 1],
  [-54, 184], [-84, 176, 1], [-97, 228, 1], [-131, 225, 1], [-118, 166, 1],
  [-138, 146], [-152, 104], [-140, 62], [-106, 28], [-121, 17, 1],
];
// lingzhi: a kidney-shaped cap on a bent stalk. Local origin = middle of the cap.
const LINGZHI = [
  [-88, 6, 1], [-72, -30], [-32, -52], [16, -54], [62, -37], [90, 2, 1],
  [52, 14], [22, 8], [-8, 18, 1], [0, 60], [14, 120, 1], [-18, 122, 1], [-30, 60], [-34, 22, 1], [-62, 15],
];

// ───────────────────────── the collage ─────────────────────────
function buildCollage(env) {
  const a = env.arc;
  return L.makeLayer(PAD, (g) => {
    const tk = []; let tl = performance.now();
    const tick = (nm) => { const t = performance.now(); tk.push(nm + ':' + (t - tl).toFixed(0)); tl = t; };
    const full = () => g.fillRect(-PAD, -PAD, GW, GH);
    const line = (e) => { g.beginPath(); g.moveTo(e[0][0], e[0][1]); for (let i = 1; i < e.length; i++) g.lineTo(e[i][0], e[i][1]); };
    const clipTo = (poly) => { g.beginPath(); g.moveTo(poly[0][0], poly[0][1]); for (const q of poly) g.lineTo(q[0], q[1]); g.closePath(); g.clip(); };

    // ── the card everything is mounted on: clean, calm, only its tooth ──
    g.fillStyle = C.card; full();
    g.save(); g.globalCompositeOperation = 'hard-light';
    g.translate(W / 2, H / 2); g.rotate(Math.PI); g.translate(-W / 2, -H / 2);
    g.globalAlpha = 0.24; g.drawImage(T.grain, -PAD, -PAD);
    g.globalAlpha = 0.05; g.drawImage(T.cloud, -PAD, -PAD);
    g.restore();
    tick('card');

    // ── the torn edge of the big blue sheet: coloured skin (drB) and the white core that outruns it (drW) ──
    const nz = L.makeNoise('a31tear');
    const s = a.span(PAD + 150), n = Math.ceil((2 * s * a.R) / 2);
    const eB = [], eW = [], prof = [];
    for (let i = 0; i <= n; i++) {
      const th = L.lerp(-s, s, i / n), al = th * a.R;
      const bay = Math.pow(Math.max(0, nz.n2(al / 230, 4.2) - 0.2) / 0.8, 1.2);             // stretches where the skin peeled back further
      const und = 1.6 * nz.n2(al / 430, 9.9);                                               // the whole tear wanders a little
      const drB = L.clamp(0.5 + und + 1.5 * nz.fbm(al / 52, 1.3, 3) + 0.9 * nz.n2(al / 6.5, 7.7) - 5 * bay, -5.2, 3.6);
      const wide = L.clamp(0.5 + 0.62 * nz.n2(al / 150 + 30, 12.1));
      const w = L.clamp(0.4 + 7 * wide * wide * wide + 6 * bay + 1.2 * nz.n2(al / 17, 3.3) + 0.7 * nz.n2(al / 4.3, 5.5), 0, 12);
      const drW = Math.min(8.5, drB + w);
      const pb = a.pt(th, drB), pw = a.pt(th, drW);
      eB.push([pb.x, pb.y]); eW.push([pw.x, pw.y]); prof.push([th, drB, drW, w]);
    }
    const bottom = H + PAD + 60;
    const sheet = (e) => e.concat([[e[e.length - 1][0], bottom], [e[0][0], bottom]]);
    // the faintest contact shadow of the sheet on the card
    g.save(); g.strokeStyle = 'rgba(84,62,30,0.22)'; g.lineWidth = 2.4; g.translate(0.6, -0.5); g.filter = 'blur(1.6px)'; line(eW); g.stroke(); g.restore();
    paper(g, sheet(eW), { color: '#fcfbf6', grain: 0.5, cloud: 0, cockle: 0, edge: 0, curl: 0, shadow: false, seed: 'core' });
    paper(g, sheet(eB), { color: C.blue, grain: 0.6, cloud: 0.26, cockle: 0.3, edge: 0, curl: 0, shadow: false, seed: 'sheet' });
    // the skin is stressed pale right at the tear
    g.save(); clipTo(sheet(eB));
    g.strokeStyle = 'rgba(206,224,255,0.2)'; g.lineWidth = 4.5; g.translate(0, 2); g.filter = 'blur(1.3px)'; line(eB); g.stroke();
    g.restore();
    // fuzz: white fibres standing off the core, blue shreds straying onto it
    const rf = L.rng('a31fuzz'); g.lineCap = 'round';
    for (let i = 0; i < 4200; i++) {
      const [th, drB, drW, w] = prof[rf.int(0, n)];
      const blue = rf.chance(0.4);
      if (!blue && w < 1.2 && rf.chance(0.7)) continue;
      const p = a.pt(th, blue ? drB + rf.range(-0.6, 1.6) : drW + rf.range(-1.4, 0.4));
      const dir = th - Math.PI / 2 + rf.gauss() * 0.9, len = blue ? rf.range(0.8, 2.8) : rf.range(1, 4.5) * (rf.chance(0.05) ? 2.2 : 1);
      g.strokeStyle = blue ? L.rgba(rf.chance(0.5) ? '#2b5aa8' : '#4270b6', rf.range(0.4, 0.9)) : L.rgba('#fffefa', rf.range(0.25, 0.8));
      g.lineWidth = rf.range(0.5, 1.1);
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + Math.cos(dir) * len, p.y + Math.sin(dir) * len); g.stroke();
    }
    tick('sheet');

    const gaps = [];
    const check = (name, poly) => { let m = -1e9; for (const q of poly) m = Math.max(m, a.drAt(q[0], q[1])); gaps.push(name + ':' + m.toFixed(0)); };

    // ── two thread-bound books: aubergine underneath, brown on top with its blank title slip and the binding thread ──
    {
      const bookA = xf([[0, 0, 1], [280, 3, 1], [277, 420, 1], [-2, 420, 1]], { at: [538, 925], rot: L.deg(7) });
      paper(g, snip(bookA, 'bookA'), { color: C.purple, grain: 0.5, lift: 0.8 });
      const at = [598, 884], rot = L.deg(-5.5), BW = 276;
      const bookB = xf([[0, 0, 1], [BW, -2, 1], [BW + 2, 430, 1], [-3, 432, 1]], { at, rot });
      check('book', bookB);
      paper(g, snip(bookB, 'bookB'), { color: C.brown, grain: 0.6, cloud: 0.3, lift: 1, peel: [[872, 860, 90]] });
      const slip = xf([[20, 42, 1], [73, 39, 1], [75, 262, 1], [22, 265, 1]], { at, rot });
      paper(g, snip(slip, 'slip'), { color: C.label, grain: 0.45, lift: 0.3, sh: 0.8, cockle: 0.2 });
      // 四眼线装: one thread down the spine side, a wrap round the spine at each of the four holes (right-hand side)
      const sx = BW - 22, holes = [52, 160, 268, 376];
      const rs = L.rng('a31stitch');
      const to = (x, y) => xf([[x, y]], { at, rot })[0];
      const th = (pts, sd) => L.chalkStroke(g, pts, { width: 4, color: '#f0e8d2', density: 0.95, alpha: 0.95, jitter: 0.6, seed: sd });
      th([to(sx + rs.range(-1, 1), 3), to(sx + rs.range(-1.5, 1.5), 140), to(sx + rs.range(-1.5, 1.5), 280), to(sx + rs.range(-1, 1), 428)], 1);
      holes.forEach((hy, i) => th([to(sx - 1, hy + rs.range(-2, 2)), to(BW - 1, hy + rs.range(-3, 3))], 5 + i));
    }
    tick('books');

    // ── folding fan: ribs gathered toward one rivet (just below frame), a pleated orange leaf, the two guard sticks ──
    {
      const P = [250, 1110], Ro = 385, Ri = 172, t0 = L.deg(-80), t1 = L.deg(56), N = 10;
      const r = L.rng('a31fan');
      const pt = (th, rad, off = 0) => [P[0] + rad * Math.sin(th) + off * Math.cos(th), P[1] - rad * Math.cos(th) + off * Math.sin(th)];
      const bounds = []; for (let i = 0; i <= N; i++) bounds.push(L.lerp(t0, t1, (i + (i > 0 && i < N ? r.range(-0.14, 0.14) : 0)) / N));
      const stick = (th, r0, r1, w0, w1) => [pt(th, r0, -w0 / 2), pt(th, r0, w0 / 2), pt(th, r1, w1 / 2), pt(th, r1, -w1 / 2)];
      for (let i = 2; i < N; i += 2) paper(g, stick(bounds[i] + r.range(-0.012, 0.012), -20, Ri + 22, 13, 19), { color: C.brown, grain: 0.5, lift: 0.4, sh: 0.8, curl: 0, cockle: 0 });
      const outer = bounds.map((th, i) => pt(th, Ro - (i % 2 ? 9 : 0) + r.range(-3, 3)));
      const inner = bounds.map((th, i) => pt(th, Ri + (i % 2 ? 6 : 0) + r.range(-2.5, 2.5))).reverse();
      const leaf = outer.concat(inner);
      check('fan', leaf);
      paper(g, leaf, { color: C.orange, grain: 0.5, cloud: 0.3, lift: 1.1, peel: [[pt(bounds[7], Ro)[0], pt(bounds[7], Ro)[1], 120]] });
      // the pleats: alternate faces turn a little to and from the light; mountain folds catch a hairline, valleys a thin shade
      g.save(); clipTo(leaf);
      for (let i = 0; i < N; i++) {
        const p0 = pt(bounds[i], Ri - 10), p1 = pt(bounds[i], Ro + 10), p2 = pt(bounds[i + 1], Ro + 10), p3 = pt(bounds[i + 1], Ri - 10);
        g.fillStyle = i % 2 ? `rgba(70,14,0,${r.range(0.045, 0.085).toFixed(3)})` : `rgba(255,238,200,${r.range(0.03, 0.07).toFixed(3)})`;
        g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.lineTo(p3[0], p3[1]); g.closePath(); g.fill();
      }
      for (let i = 1; i < N; i++) {
        const p0 = pt(bounds[i], Ri), p1 = pt(bounds[i], Ro);
        g.strokeStyle = i % 2 ? 'rgba(80,20,0,0.26)' : 'rgba(255,244,214,0.34)'; g.lineWidth = 1.3;
        g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke();
      }
      g.restore();
      paper(g, stick(t0 + 0.014, -24, Ro + 5, 18, 24), { color: C.brown, grain: 0.5, lift: 0.5, curl: 0.4, cockle: 0 });
      paper(g, stick(t1 - 0.014, -24, Ro + 5, 18, 24), { color: C.brown, grain: 0.5, lift: 0.5, curl: 0.4, cockle: 0 });
    }
    tick('fan');

    // ── a scrap of drawing paper scribbled with pencil ──
    {
      const scrap = snip([[1548, 812, 1], [1660, 770], [1830, 768], [1990, 822, 1], [1990, 1180, 1], [1418, 1180, 1], [1432, 1022, 1], [1530, 1002, 1]], 'scrap', [90, 170], 1.5);
      check('scrap', scrap);
      paper(g, scrap, { color: C.white, grain: 0.42, cloud: 0.14, cockle: 0.4, crumple: 0.1, lift: 1.1, creases: [[1500, 1110, 1960, 900, 0.7]], peel: [[1548, 814, 120]] });
      const x0 = 1380, y0 = 730, w = 600, h = 400;
      const c = L.makeCanvas(w, h), k = c.getContext('2d'); k.translate(-x0, -y0);
      const rh = L.rng('a31hatch');
      // one bout of scribbling: the pencil saws to and fro while the hand drifts sideways
      const scribble = (xa, xb, top, bot, lean, gap, wd, al, sd) => {
        const pts = []; let x = xa;
        while (x < xb) {
          const lo = bot(x) + rh.range(-30, 12), hi = top(x) + rh.range(-10, 34);
          pts.push([x + rh.range(-5, 5), lo], [x + lean * (lo - hi) + rh.range(-8, 8), hi]);
          x += gap * rh.range(0.5, 1.6);
        }
        L.sketchLine(k, pts, { width: wd, color: '#3c3c44', seed: sd, wobble: 2, passes: 2, alpha: al });
      };
      const topE = (x) => 790 + 0.03 * (x - 1548);
      scribble(1552, 1960, topE, () => 1000, 0.42, 26, 3.4, 0.84, 3);
      scribble(1440, 1950, (x) => (x < 1540 ? 1030 : 940), () => 1110, 0.3, 30, 3.2, 0.8, 5);
      scribble(1600, 1900, (x) => topE(x) + 40, () => 930, -0.7, 54, 2.6, 0.5, 8);
      k.setTransform(1, 0, 0, 1, 0, 0); k.globalCompositeOperation = 'destination-out';
      k.drawImage(L.noiseTex(w, h, { seed: 'a31graphite', scale: 1.8, octaves: 2, res: 1, contrast: 2.0, ramp: [[0, 'rgba(0,0,0,0.8)'], [0.4, 'rgba(0,0,0,0.22)'], [0.7, 'rgba(0,0,0,0)']] }), 0, 0);
      g.save(); clipTo(scrap);
      g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.9; g.drawImage(c, x0, y0);
      g.restore();
    }
    tick('scrap');

    // ── ruyi: a long bent handle, then the cloud head glued over its top end ──
    {
      const { A, B } = strip([[1358, 815], [1384, 890], [1430, 950], [1486, 1000], [1522, 1058], [1536, 1160]], (t) => L.lerp(58, 50, Math.sin(Math.PI * t)) + 10 * t, 6);
      const ctrl = A.filter((_, i) => i % 9 === 0).concat(B.filter((_, i) => i % 9 === 0).reverse());
      ctrl[0][2] = 1;
      paper(g, snip(ctrl, 'ruyiH', [60, 100], 1.2), { color: C.green, grain: 0.5, lift: 0.9 });
      const head = snip(xf(RUYI_HEAD, { at: [1335, 748], rot: -0.32, scale: 1.28 }), 'ruyi', [30, 50], 1.0);
      check('ruyi', head);
      paper(g, head, { color: C.green, grain: 0.5, cloud: 0.3, lift: 1.1, creases: [[1220, 830, 1450, 690, 0.8]], peel: [[1205, 805, 90]] });
    }
    tick('ruyi');

    // ── tripod censer ──
    {
      const o = { at: [1722, 848], rot: 0.03, scale: 0.97 };
      const body = snip(xf(CENSER, o), 'censer', [28, 46], 1.0);
      check('censer', body);
      const hole = (cx) => snip(xf([[cx - 13, -34, 1], [cx + 12, -35, 1], [cx + 14, -10, 1], [cx - 14, -9, 1]], o), 'ear' + cx, [30, 40], 0.6);
      paper(g, [body, hole(-79), hole(80)], { color: C.purple, grain: 0.5, lift: 1.1, peel: [[1845, 850, 80]] });
    }
    tick('censer');

    // ── the vase ──
    {
      const vase = snip(xf(VASE.map(([x, y, c]) => [x, y - 212, c]), { at: [1056, 850], rot: 0.05, scale: 1.18 }), 'vase', [50, 92], 1.3);
      check('vase', vase);
      paper(g, vase, { color: C.red, grain: 0.55, cloud: 0.3, lift: 1.2, creases: [[900, 1040, 1230, 930, 0.7]], peel: [[1120, 606, 90]] });
    }
    tick('vase');

    // ── jade disc with its small hole ──
    {
      const bi = roundish(702, 764, 145, 14, 'bi'), holeP = roundish(706, 761, 33, 8, 'bihole', 0.06);
      check('bi', bi);
      paper(g, [bi, holeP], { color: C.yellow, alpha: 0.97, grain: 0.36, cloud: 0.25, lift: 1.2, peel: [[598, 664, 100]] });
    }

    // ── lingzhi: a wisp of pink tissue, thin enough to show what lies under it ──
    {
      const lz = snip(xf(LINGZHI, { at: [1296, 1002], rot: -0.14, scale: 1.36 }), 'lingzhi', [30, 52], 1.2);
      paper(g, lz, { color: C.pink, alpha: 0.8, grain: 0.5, cloud: 0.15, cockle: 0.3, crumple: 0.5, lift: 0.5, sh: 0.7, edge: 0.6 });
    }
    tick('rest');

    // ── one light over the whole artwork: from the upper left, falling away to the lower right ──
    g.save();
    g.globalCompositeOperation = 'soft-light';
    g.fillStyle = L.radial(g, 480, 260, 100, 1500, [[0, 'rgba(255,248,232,0.16)'], [1, 'rgba(255,248,232,0)']]); full();
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = L.radial(g, 560, 320, 900, 2150, [[0, 'rgb(255,255,255)'], [1, 'rgb(226,224,236)']]); full();
    g.restore();
    tick('light');
    console.warn('s31 gaps ' + gaps.join(' ') + ' | ' + tk.join(' '));
  });
}

export default {
  name: '博古图剪纸拼贴',
  tone: 'dark',
  async init(env) {
    seq = 0;
    const t0 = performance.now();
    T = buildTextures();
    const t1 = performance.now();
    const art = buildCollage(env);
    T = null;
    const t2 = performance.now();
    const bmp = await createImageBitmap(art);
    bmp._pad = PAD;
    S = { art: bmp };
    console.warn('s31 timing tex ' + (t1 - t0).toFixed(0) + ' collage ' + (t2 - t1).toFixed(0) + ' bmp ' + (performance.now() - t2).toFixed(0));
  },
  draw(ctx, env, p) {
    // 6 frames: the camera slips a few pixels along the arc over the artwork; every shadow is baked in, so none of them turns
    const rot = L.lerp(-0.003, 0.003, p), zoom = L.lerp(1.0, 1.005, p);
    L.blit(ctx, env, S.art, { rot, zoom });
  },
};
