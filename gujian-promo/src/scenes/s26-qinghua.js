// s26 — 青花. The well of a blue-and-white porcelain dish seen close (underglaze cobalt, hand painted).
// The arc is the upper edge of the heavier of two wheel-turned 弦纹 (string lines); inside them a loose 分水 landscape of
// pavilions, willow, pine and water; outside them bare glaze with a pale cloud scroll on either side of the text zone.
//
// How the blue is made: every brush mark is first laid down as "pigment density" (alpha on one canvas, so overlapping
// marks pile up the way cobalt does). The drawing is then pushed around by a slow noise field (a hand is never ruler
// straight) and a single per-pixel pass "fires" it: wash edges pool darker, the load is broken by bristle streaks and
// granulation, and density is mapped through a five-tone cobalt ramp (影淡 → 头浓). Where the pigment is thickest it goes
// blue-black and breaks into rust-brown specks. A soft halo is laid under it (cobalt bleeding into the glaze) and the
// glaze itself — bubbles, pinholes, a whisper of crazing, reflections — goes on top.
import * as L from '../lib/core.js';

const { W, H, TAU } = L;
const PAD = 130;
const LW = W + PAD * 2, LH = H + PAD * 2;
const BAND = 32;          // width of the heavy string line (its top edge is the arc)
const FINE = -55;         // centre of the fine string line (dr)
const KEEP = 82;          // the painting stays at least this far below the arc
let S = null;

const sm = (e0, e1, x) => { const t = L.clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const read = (c) => c.getContext('2d').getImageData(0, 0, c.width, c.height).data;

// ───────────────────────── glaze body ─────────────────────────
function buildGlaze(env) {
  const a = env.arc;
  return L.makeLayer(PAD, (g) => {
    const full = () => g.fillRect(-PAD, -PAD, LW, LH);
    g.fillStyle = '#dde7ed'; full();
    // key light from the upper left, falling away to the lower right
    g.fillStyle = L.linear(g, 150, -260, 1750, 1340, [[0, 'rgba(240,246,249,0.95)'], [0.45, 'rgba(226,235,241,0.6)'], [1, 'rgba(186,202,216,0.95)']]); full();
    // the dish's form, concentric with the arc: flat well below, a fold where glaze pools blue-green, the wall rising above
    const r0 = a.R - 700, r1 = a.R + 800, t = (dr) => (dr + 700) / 1500;
    g.fillStyle = L.radial(g, a.cx, a.cy, r0, r1, [
      [t(-700), 'rgba(172,190,206,0.5)'], [t(-330), 'rgba(190,206,219,0.14)'], [t(-80), 'rgba(197,211,222,0)'],
      [t(-4), 'rgba(150,186,202,0.3)'], [t(36), 'rgba(160,192,206,0.2)'], [t(130), 'rgba(190,208,222,0.05)'], [t(280), 'rgba(255,255,255,0)'],
      [t(440), 'rgba(255,255,255,0.45)'], [t(600), 'rgba(205,217,228,0.3)'], [t(800), 'rgba(160,180,200,0.7)']]);
    full();
    g.save();
    // slow drift in glaze thickness (kept very gentle: porcelain, not paper)
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.2;
    g.drawImage(L.noiseTex(LW, LH, { seed: 's26mottle', scale: 620, octaves: 2, res: 0.1, warp: 0.4, contrast: 1.2 }), -PAD, -PAD);
    // orange-peel: the faintest pebbling of a fired glaze surface
    g.globalAlpha = 0.1;
    g.drawImage(L.bumpLight(L.noiseTex(LW, LH, { seed: 's26peel', scale: 13, octaves: 2, res: 0.5, contrast: 1.4 }), { strength: 2, res: 0.5 }), -PAD, -PAD);
    g.restore();
  });
}

/** crazing (开片): an extremely faint network of hairlines */
function buildCraze() {
  const res = 0.7, cw = Math.round(LW * res), ch = Math.round(LH * res);
  const nz = L.makeNoise('s26craze');
  const img = new ImageData(cw, ch), d = img.data;
  const sc = 250;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    let u = x / res / sc, v = y / res / sc;
    u += 0.1 * Math.sin(v * 2.3 + 1.7); v += 0.1 * Math.sin(u * 2.1 + 4.2);
    const c = nz.cell(u, v);
    const wpx = c.edge * sc;
    if (wpx < 1.9) { const i = (y * cw + x) * 4; d[i] = 70; d[i + 1] = 92; d[i + 2] = 120; d[i + 3] = (1 - wpx / 1.9) * 255 * (0.25 + 0.75 * c.id); }
  }
  const small = L.makeCanvas(cw, ch); small.getContext('2d').putImageData(img, 0, 0);
  const out = L.makeCanvas(LW, LH); const g = out.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(small, 0, 0, LW, LH);
  return out;
}

// ───────────────────────── the two 弦纹 (pigment density, per pixel) ─────────────────────────
function bandAt(nz, s, dr) {
  let keep = 1;
  // heavy line — its upper edge IS the arc. Turned on the wheel: the brush is set down (顿), the dish turns under it,
  // and the tail of the turn overlaps the head. Load thins with distance from each fresh dip.
  const eT = 0.3 + 0.75 * nz.n2(s / 180, 1.3) + 0.35 * nz.n2(s / 43, 4.4);
  const head1 = Math.exp(-(((s + 540) / 46) ** 2)), head2 = Math.exp(-(((s - 720) / 42) ** 2));
  const eB = -BAND + 2.6 * nz.n2(s / 240, 7.7) + 1.0 * nz.n2(s / 49, 2.2) - 4 * head1 - 3 * head2;
  if (dr < eT + 1.2 && dr > eB - 1.8) {
    const cover = sm(eT + 1.0, eT - 1.0, dr) * sm(eB - 1.6, eB + 1.6, dr);
    const u = (dr - eB) / (eT - eB);
    const pool = 0.82 + 0.32 * Math.pow(Math.abs(2 * u - 1), 2.6);       // pigment settles along both edges of a stroke
    const hair = nz.n2(s / 300, dr / 1.8 + 31), hair2 = nz.n2(s / 520 + 9, dr / 1.3 - 17);
    const wob = 0.09 * nz.n2(s / 230, 3.9);
    const strokes = [
      [1 - sm(-500, -452, s), 0.6 + 0.1 * nz.n2(s / 330, 12.5)],                                                 // tail of the turn (dry)
      [sm(-566, -548, s) * (1 - sm(716, 776, s)), 1.05 - 0.36 * (1 - Math.exp(-(s + 560) / 700)) + wob],         // fresh dip
      [sm(690, 708, s), 1.02 - 0.26 * (1 - Math.exp(-(s - 700) / 600)) + wob],                                   // second dip
    ];
    for (const [pres, load] of strokes) {
      if (pres <= 0) continue;
      const gap = Math.max(0, 0.78 - load) * 1.7 * sm(0.1, 0.6, hair2);  // 飞白 where the brush runs dry
      keep *= 1 - cover * pres * L.clamp(load * pool * (1 + 0.28 * hair * (1.55 - load)) - gap) * 0.93;
    }
  }
  // fine line below it
  const c = FINE + 1.6 * nz.n2(s / 270, 21.7) + 0.7 * nz.n2(s / 55, 8.8);
  const hw = 3.8 + 0.7 * nz.n2(s / 130, 15.1) + 1.7 * Math.exp(-(((s - 352) / 26) ** 2));
  const ad = Math.abs(dr - c);
  if (ad < hw + 1.2) {
    const cover = sm(hw + 0.9, hw - 0.9, ad);
    const wob = 0.06 * nz.n2(s / 200, 44.1);
    const la = 0.98 - 0.44 * sm(-700, 340, s) + wob, lb = 1.0 - 0.2 * (1 - Math.exp(-(s - 338) / 600)) + wob;
    keep *= 1 - cover * (1 - sm(340, 380, s)) * L.clamp(la * (1 + 0.2 * nz.n2(s / 240, dr / 1.4 + 3))) * 0.9;
    keep *= 1 - cover * sm(330, 346, s) * L.clamp(lb) * 0.9;
  }
  return 1 - keep;
}

/** add the string lines to a density array (one byte per pixel of the padded layer) */
function addBands(al, a) {
  const nz = L.makeNoise('s26band');
  for (let x = 0; x < LW; x++) {
    const fx = x - PAD, dx = fx - a.cx;
    const y0 = Math.max(0, Math.floor(a.yAt(fx, 4)) + PAD), y1 = Math.min(LH - 1, Math.ceil(a.yAt(fx, FINE - 9)) + PAD);
    for (let y = y0; y <= y1; y++) {
      const dy = a.cy - (y - PAD);
      const v = bandAt(nz, Math.atan2(dx, dy) * a.R, Math.sqrt(dx * dx + dy * dy) - a.R);
      if (v > 0.003) { const i = y * LW + x; al[i] = 255 * (1 - (1 - al[i] / 255) * (1 - v)); }
    }
  }
}

// ───────────────────────── brush kit (everything is laid down as density) ─────────────────────────
function painter(g) {
  let sid = 7;
  const r = L.rng('s26brush');
  const P = { g, r };
  const trace = (pts, soft) => {
    g.beginPath();
    if (soft) {
      const n = pts.length, m = (i) => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2];
      const m0 = m(n - 1); g.moveTo(m0[0], m0[1]);
      for (let i = 0; i < n; i++) { const q = m(i); g.quadraticCurveTo(pts[i][0], pts[i][1], q[0], q[1]); }
    } else { g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); }
    g.closePath();
  };
  /** a brush line; o.dun presses a little blob at the start (顿笔) */
  P.line = (pts, w, al, o = {}) => {
    sid += 1;
    L.inkStroke(g, pts, { width: w, color: '#000', alpha: al, seed: sid, taper: o.taper || [0.06, 0.22], wobble: o.wobble === undefined ? 0.42 : o.wobble, smoothStep: 3 });
    if (o.dun) { const [x, y] = pts[0]; g.save(); g.globalAlpha = al * 0.6; g.fillStyle = '#000'; g.beginPath(); g.ellipse(x, y, w * 0.74, w * 0.58, r() * 3, 0, TAU); g.fill(); g.restore(); }
  };
  /** a nearly straight hand-drawn line */
  P.hl = (x0, y0, x1, y1, w, al, o = {}) => {
    const j = o.j === undefined ? 1.3 : o.j;
    P.line([[x0, y0], [L.lerp(x0, x1, 0.33) + r.range(-j, j), L.lerp(y0, y1, 0.33) + r.range(-j, j)], [L.lerp(x0, x1, 0.67) + r.range(-j, j), L.lerp(y0, y1, 0.67) + r.range(-j, j)], [x1, y1]], w, al, { taper: [0.03, 0.05], ...o });
  };
  /**
   * 分水 wash: a first even pass, then a few more passes of the loaded brush inside the shape so the tone pools unevenly.
   * The wash is nudged a little off its outline, as a quick hand leaves it. o.flat = single even pass; o.fix = no nudge.
   */
  P.wash = (pts, al, o = {}) => {
    const ox = o.fix ? 0 : r.range(-2.5, 2.5), oy = o.fix ? 0 : r.range(-2, 2);
    const q = pts.map(([x, y]) => [x + ox, y + oy]);
    g.save(); g.fillStyle = '#000';
    g.globalAlpha = al * (o.flat ? 1 : 0.7); trace(q, o.soft); g.fill();
    if (!o.flat) {
      g.clip();
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const [x, y] of q) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const nb = o.blots || Math.round(L.clamp((x1 - x0) / 90, 3, 8));
      for (let i = 0; i < nb; i++) {
        const bx = r.range(x0, x1), by = r.range(y0, y1), rw = r.range(0.14, 0.42) * Math.max(60, x1 - x0), rh = r.range(0.35, 0.8) * Math.max(30, y1 - y0);
        const blob = []; for (let j = 0; j < 7; j++) { const an = (j / 7) * TAU, rr = r.range(0.7, 1.15); blob.push([bx + rw * rr * Math.cos(an), by + rh * rr * Math.sin(an)]); }
        g.globalAlpha = al * r.range(0.22, 0.5); trace(blob, true); g.fill();
      }
    }
    g.restore();
  };
  P.knock = (pts, o = {}) => { g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; trace(pts, o.soft); g.fill(); g.restore(); };
  P.clip = (pts, fn) => { g.save(); trace(pts, false); g.clip(); fn(); g.restore(); };
  P.dab = (x, y, len, ang, w, al) => { g.save(); g.globalAlpha = al; g.fillStyle = '#000'; g.beginPath(); g.ellipse(x + Math.cos(ang) * len / 2, y + Math.sin(ang) * len / 2, len / 2, w / 2, ang, 0, TAU); g.fill(); g.restore(); };
  P.dot = (x, y, rad, al) => { g.save(); g.globalAlpha = al; g.fillStyle = '#000'; g.beginPath(); g.ellipse(x, y, rad, rad * r.range(0.7, 1), r() * 3, 0, TAU); g.fill(); g.restore(); };
  return P;
}

/** far hill: palest wash fading to mist at its foot, a ridge line, a few 皴 strokes down the slopes, 苔点 on the crest */
function hill(P, ridge, baseY, tone) {
  const { g, r } = P;
  const pts = L.smoothPath(ridge, 8);
  let top = 1e9; for (const p of pts) top = Math.min(top, p[1]);
  g.save();
  g.fillStyle = L.linear(g, 0, top, 0, baseY, [[0, `rgba(0,0,0,${tone})`], [0.5, `rgba(0,0,0,${tone * 0.85})`], [1, 'rgba(0,0,0,0)']]);
  g.beginPath(); g.moveTo(pts[0][0], baseY); for (const p of pts) g.lineTo(p[0], p[1]); g.lineTo(pts[pts.length - 1][0], baseY); g.closePath(); g.fill();
  // a second, shorter pass under the crest so the hill has a darker shoulder
  g.clip();
  g.fillStyle = `rgba(0,0,0,${tone * 0.8})`;
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1] + 60);
  for (let i = 0; i < pts.length; i++) g.lineTo(pts[i][0] + 26, pts[i][1] + 16 + 30 * Math.sin(i * 0.23));
  for (let i = pts.length - 1; i >= 0; i--) g.lineTo(pts[i][0] + 40, pts[i][1] + 52 + 22 * Math.sin(i * 0.31 + 1));
  g.closePath(); g.fill();
  g.restore();
  P.line(ridge, 3.8, tone * 2.5, { taper: [0.04, 0.04] });
  for (let i = 5; i < pts.length - 5; i += 4) {
    if (!r.chance(0.7)) continue;
    const [x, y] = pts[i];
    const dir = pts[i + 4][1] > pts[i - 4][1] ? 1 : -1, len = r.range(26, 70);
    P.line([[x, y + 6], [x + dir * len * 0.32, y + len * 0.55], [x + dir * len * 0.46, y + len]], 3, tone * 1.7, { taper: [0.05, 0.55] });
  }
  for (let i = 8; i < pts.length - 8; i += r.int(7, 13)) {
    const [x, y] = pts[i];
    for (let k = 0; k < 5; k++) P.dab(x + r.range(-16, 16), y + r.range(-4, 3), r.range(9, 15), r.range(-0.25, 0.25), r.range(5, 7.5), tone * 3);
  }
}

/**
 * A tiled roof with the concave fall and upturned corners (翼角起翘) of Chinese eaves.
 * yr/hr = ridge height and half-length (hr≈0 → pyramidal 攒尖); ye/he = eave height and half-length; ext/lift = corner sweep.
 */
function roof(P, cx, yr, hr, ye, he, ext, lift, o = {}) {
  const { g, line, r } = P;
  const drop = o.drop === undefined ? 11 : o.drop, k = o.k || 1;
  const sideY = (t) => yr + (ye - yr) * (1 - Math.pow(1 - t, 1.9));
  const top = (s) => { const p = []; for (let i = 0; i <= 8; i++) p.push([cx + s * L.lerp(hr, he, i / 8), sideY(i / 8)]); p.push([cx + s * (he + ext * 0.55), ye - lift * 0.3]); p.push([cx + s * (he + ext), ye - lift]); return p; };
  const under = (s) => [[cx + s * (he + ext), ye - lift], [cx + s * (he + ext * 0.5), ye - lift * 0.22 + 6 * k], [cx + s * (he - 6), ye + drop * 0.75], [cx + s * he * 0.62, ye + drop]];
  const tl = top(-1), tr = top(1), ul = under(-1), ur = under(1);
  const poly = [...tl, ...ul.slice(1), [cx, ye + drop + 1], ...ur.slice(1).reverse(), ...tr.slice().reverse()];
  P.knock(poly);
  P.wash(poly, o.tone || 0.3, { fix: true, blots: 2 });
  P.clip(poly, () => {
    // the slope darkens toward the eave, and the loaded brush leaves heavier passes here and there down the fall of the tiles
    g.fillStyle = L.linear(g, 0, yr, 0, ye + drop, [[0, 'rgba(0,0,0,0)'], [0.4, 'rgba(0,0,0,0.04)'], [1, 'rgba(0,0,0,0.3)']]);
    g.fillRect(cx - he - ext - 10, yr - 10, (he + ext + 10) * 2, ye - yr + drop + 30);
    const np = Math.round(he / 55) + 2;
    for (let i = 0; i < np; i++) {
      const t = r.range(-1, 1), x0 = cx + t * hr, x1 = cx + t * he;
      line([[x0, yr - 4], [L.lerp(x0, x1, 0.4), L.lerp(yr, ye, 0.66)], [x1, ye + drop + 4]], r.range(26, 60) * k, r.range(0.1, 0.22), { taper: [0, 0], wobble: 0.5 });
    }
  });
  // tile courses (瓦垄) fanning from ridge to eave
  const n = Math.max(3, Math.round(he / (15 * k)));
  for (let i = -n; i <= n; i++) {
    const t = (i + r.range(-0.18, 0.18)) / n, x0 = cx + t * hr * 0.97, x1 = cx + t * (he - 8);
    line([[x0, yr + 5 * k], [L.lerp(x0, x1, 0.38) + r.range(-2, 2), L.lerp(yr, ye, 0.66)], [x1, ye + drop * 0.5 + r.range(-2, 3)]], 2.9 * k, r.range(0.45, 0.72), { taper: [0.05, 0.12], wobble: 0.35 });
  }
  // hip ridges running out to the corner tips
  line(tl, 7.6 * k, 0.94, { taper: [0.03, 0.34], dun: true }); line(tr, 7.6 * k, 0.94, { taper: [0.03, 0.34], dun: true });
  // eave line with a row of tile ends (瓦当) just above it
  line([ul[0], ul[1], ul[2], ul[3], [cx, ye + drop + 1], ur[3], ur[2], ur[1], ur[0]], 8.4 * k, 0.96, { taper: [0.1, 0.1] });
  for (let x = cx - he * 0.9; x <= cx + he * 0.9; x += 15 * k) {
    const ax = Math.abs(x - cx), y = ax < he * 0.62 ? ye + drop : L.lerp(ye + drop, ye + drop * 0.75, (ax - he * 0.62) / (he * 0.38));
    P.dot(x + r.range(-1.5, 1.5), y - 9 * k, 3 * k, 0.88);
  }
  if (o.ridge) {
    // main ridge (正脊) with a curled finial at each end
    line([[cx - hr - 10, yr + 2], [cx - hr * 0.3, yr - 1.5], [cx + hr * 0.4, yr + 0.5], [cx + hr + 10, yr + 2]], 10.5 * k, 0.97, { taper: [0.04, 0.04], dun: true });
    for (const s of [-1, 1]) line([[cx + s * (hr + 2), yr + 2], [cx + s * (hr + 13), yr - 9], [cx + s * (hr + 4), yr - 22], [cx + s * (hr - 8), yr - 15]], 6.6 * k, 0.96, { taper: [0.04, 0.45] });
  } else if (hr > 20) {
    P.hl(cx - hr - 4, yr + 2, cx + hr + 4, yr + 2, 6.6 * k, 0.95);
  }
}

/** lattice window, hatched freehand */
function lattice(P, x0, y0, x1, y1, sp = 13) {
  const { g, r } = P;
  const hgt = y1 - y0;
  g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, hgt); g.clip();
  for (let q = -hgt + r.range(0, sp); q < (x1 - x0) + hgt; q += sp * r.range(0.8, 1.2)) {
    P.hl(x0 + q, y0 - 1, x0 + q + hgt + r.range(-3, 3), y1 + 1, r.range(1.7, 2.4), r.range(0.45, 0.7), { j: 0.8, taper: [0, 0] });
    P.hl(x0 + q + hgt, y0 - 1, x0 + q + r.range(-3, 3), y1 + 1, r.range(1.7, 2.4), r.range(0.45, 0.7), { j: 0.8, taper: [0, 0] });
  }
  g.restore();
  P.hl(x0 - 1, y0, x1 + 1, y0, 2.6, 0.8); P.hl(x0 - 1, y1, x1 + 1, y1, 2.6, 0.8); P.hl(x0, y0, x0, y1, 2.3, 0.75); P.hl(x1, y0, x1, y1, 2.3, 0.75);
}

function railing(P, x0, x1, yTop, yBot, o = {}) {
  const n = o.n || Math.max(1, Math.round(Math.abs(x1 - x0) / 46));
  const yy = (x, base) => base + (o.rise || 0) * ((x - x0) / (x1 - x0));
  P.hl(x0, yy(x0, yTop), x1, yy(x1, yTop), 4.2, 0.93); P.hl(x0, yy(x0, yBot), x1, yy(x1, yBot), 3.4, 0.86);
  for (let i = 0; i <= n; i++) {
    const x = L.lerp(x0, x1, i / n);
    P.hl(x, yy(x, yTop) - 7, x + P.r.range(-1, 1), yy(x, yBot), 4.6, 0.93, { j: 0.5 });
    P.dot(x, yy(x, yTop) - 9, 3.3, 0.93);
    if (i < n) {
      const xb = L.lerp(x0, x1, (i + 1) / n);
      P.hl(x + 3, yy(x, yTop) + 4, xb - 3, yy(xb, yBot) - 2, 2.2, 0.6, { j: 0.5 });
      P.hl(x + 3, yy(x, yBot) - 2, xb - 3, yy(xb, yTop) + 4, 2.2, 0.6, { j: 0.5 });
    }
  }
}

/** one storey: lintel, columns, lattice windows / a dark doorway */
function storey(P, cx, y0, y1, cols, o = {}) {
  const x0 = cx + cols[0], x1 = cx + cols[cols.length - 1];
  P.knock(rect(x0 - 8, y0 - 3, x1 + 8, y1 + 3));
  P.wash(rect(x0 - 12, y0 - 4, x1 + 12, y0 + 12), 0.5, { fix: true });       // shadow under the eave
  for (let x = x0 - 6; x <= x1 + 6; x += 13) P.dot(x + P.r.range(-1.5, 1.5), y0 + 3, 3, 0.75);  // bracket sets / rafter ends: a row of touches
  P.hl(x0 - 9, y0 + 13, x1 + 9, y0 + 13, 4.6, 0.92);
  const mid = (cols.length - 2) / 2;
  for (let i = 0; i < cols.length - 1; i++) {
    const bx0 = cx + cols[i] + 7, bx1 = cx + cols[i + 1] - 7;
    if (o.door && i === mid) {
      P.wash(rect(bx0, y0 + 17, bx1, y1 - 1), 0.66, { blots: 3 });
      P.hl((bx0 + bx1) / 2, y0 + 19, (bx0 + bx1) / 2, y1 - 2, 2.6, 0.6);
    } else {
      const wy1 = L.lerp(y0 + 19, y1, o.sill === undefined ? 0.6 : o.sill);
      lattice(P, bx0 + 2, y0 + 20, bx1 - 2, wy1, o.sp || 13);
      if (wy1 < y1 - 8) { P.wash(rect(bx0, wy1 + 4, bx1, y1 - 2), 0.2, { blots: 2 }); P.hl(bx0 + 5, (wy1 + y1) / 2 + 1, bx1 - 5, (wy1 + y1) / 2 + 1, 2.2, 0.55); }
    }
  }
  for (const c of cols) P.hl(cx + c, y0 + 6, cx + c + P.r.range(-1.5, 1.5), y1, 7, 0.94, { j: 0.7, dun: true });
  P.hl(x0 - 9, y1, x1 + 9, y1, 5, 0.93);
}

/** a small open pavilion (亭) with a pyramidal roof and jewel finial */
function kiosk(P, cx, by, k, o = {}) {
  const he = 90 * k, colH = 62 * k, ye = by - colH - 12 * k, yr = ye - 58 * k;
  roof(P, cx, yr, 4 * k, ye, he, 34 * k, 22 * k, { tone: 0.32, k: Math.max(0.8, k * 0.85) });
  P.hl(cx, yr - 2 * k, cx, yr + 8 * k, 7 * k, 0.95, { j: 0.2 });
  P.dot(cx, yr - 9 * k, 7.2 * k, 0.97);
  P.line([[cx, yr - 14 * k], [cx + 0.5, yr - 26 * k]], 4 * k, 0.93, { taper: [0, 0.7] });
  const y0 = ye + 12 * k, xs = [-0.8, -0.27, 0.27, 0.8].map((t) => t * he);
  P.knock(rect(cx + xs[0] - 6, y0 - 2, cx + xs[3] + 6, by + 2));
  P.wash(rect(cx + xs[0] - 10, y0 - 3, cx + xs[3] + 10, y0 + 10 * k), 0.5, { fix: true });
  P.hl(cx + xs[0] - 6, y0 + 11 * k, cx + xs[3] + 6, y0 + 11 * k, 4 * k, 0.92);
  // hanging fretwork under the lintel
  for (let i = 0; i < 3; i++) { const a0 = cx + xs[i] + 6, a1 = cx + xs[i + 1] - 6; P.line([[a0, y0 + 13 * k], [a0 + 5, y0 + 24 * k], [(a0 + a1) / 2, y0 + 18 * k], [a1 - 5, y0 + 24 * k], [a1, y0 + 13 * k]], 2.8 * k, 0.65, { taper: [0.05, 0.05] }); }
  for (const x of xs) P.hl(cx + x, y0 + 4, cx + x + P.r.range(-1.5, 1.5), by, 6.4 * k, 0.94, { j: 0.6, dun: true });
  railing(P, cx + xs[0], cx + xs[3], by - 24 * k, by - 1, { n: o.rails || 6 });
  // plinth
  const pw = he * 1.08, ph = 20 * k;
  P.knock(rect(cx - pw, by, cx + pw, by + ph));
  P.wash(rect(cx - pw, by, cx + pw, by + ph), 0.24);
  P.hl(cx - pw - 4, by, cx + pw + 4, by, 5 * k, 0.94); P.hl(cx - pw, by + ph, cx + pw, by + ph, 4 * k, 0.9);
  if (o.stilts) {
    for (const t of [-0.9, -0.45, 0, 0.45, 0.9]) {
      const x = cx + t * pw;
      P.hl(x, by + ph, x + P.r.range(-2, 2), by + ph + 44, 5.4, 0.92, { j: 0.6 });
      P.line([[x, by + ph + 50], [x + 4, by + ph + 62], [x - 3, by + ph + 76], [x + 2, by + ph + 92]], 3.6, 0.36, { taper: [0.05, 0.5] });
    }
    P.hl(cx - pw, by + ph + 20, cx + pw, by + ph + 20, 2.8, 0.75);
  }
}

function willow(P, bx, by, a) {
  const { line, dab, r } = P;
  const lim = (x, y) => Math.max(y, a.yAt(x, -KEEP - 8));
  const trunk = [[bx + 12, by + 8], [bx - 6, by - 48], [bx - 22, by - 104], [bx - 12, by - 152], [bx + 4, by - 192]];
  line(trunk, 33, 0.5, { taper: [0, 0.3], wobble: 0.4 });
  line(trunk.map(([x, y], i) => [x - 15 + i * 2.4, y]), 5.4, 0.94, { taper: [0.02, 0.2] });
  line(trunk.map(([x, y], i) => [x + 15 - i * 2.4, y]), 4.4, 0.88, { taper: [0.02, 0.2] });
  const tq = L.smoothPath(trunk, 6);
  for (let i = 0; i < 12; i++) { const p = tq[Math.floor(r.range(0.04, 0.82) * (tq.length - 1))]; dab(p[0] + r.range(-8, 8), p[1], r.range(8, 17), Math.PI / 2 + r.range(-0.5, 0.5), r.range(3.5, 6), 0.7); }
  const fork = [bx + 4, by - 190];
  const limbs = [
    [fork, [bx - 45, by - 228], [bx - 105, by - 243], [bx - 168, by - 234]],
    [fork, [bx + 6, by - 238], [bx - 6, by - 268]],
    [fork, [bx + 52, by - 232], [bx + 114, by - 252], [bx + 178, by - 243]],
    [[bx - 20, by - 128], [bx - 66, by - 176], [bx - 128, by - 190]],
    [[bx - 6, by - 160], [bx + 58, by - 196], [bx + 112, by - 194]],
  ].map((l) => l.map(([x, y]) => [x, lim(x, y)]));
  const wind = -24;
  // pale wash massing the crown
  P.wash([[bx - 195, by - 212], [bx - 110, by - 258], [bx, by - 276], [bx + 120, by - 266], [bx + 205, by - 222], [bx + 196, by - 110], [bx + 120, by - 50], [bx - 60, by - 40], [bx - 196, by - 96]].map(([x, y]) => [x, lim(x, y)]), 0.13, { soft: true, blots: 6 });
  limbs.forEach((l, li) => {
    line(l, li < 3 ? 12 : 9, 0.9, { taper: [0.02, 0.5] });
    const q = L.smoothPath(l, 16);
    for (let i = 2; i < q.length; i++) {
      const [x0, y0] = q[i];
      const out = Math.sign(x0 - bx) || 1, drift = out * r.range(8, 36), len = r.range(120, 220) * (li < 3 ? 1 : 0.8);
      const pts = [[x0, y0], [x0 + drift * 0.4, y0 + len * 0.1 - 7], [x0 + drift * 0.85, y0 + len * 0.42], [x0 + drift + wind * 0.35, y0 + len * 0.74], [x0 + drift * 1.05 + wind, y0 + len]];
      line(pts, 2.8, 0.66, { taper: [0.02, 0.5], wobble: 0.25 });
      const sp = L.smoothPath(pts, 11);
      for (let j = 2; j < sp.length; j++) dab(sp[j][0], sp[j][1], r.range(11, 19), Math.PI / 2 + (j % 2 ? 1 : -1) * r.range(0.3, 0.8), r.range(3.6, 5.4), r.range(0.4, 0.72));
    }
  });
}

function pine(P, bx, by, a) {
  const { line, r } = P;
  const trunk = [[bx + 10, by + 8], [bx - 6, by - 46], [bx + 6, by - 96], [bx - 10, by - 138]];
  line(trunk, 25, 0.52, { taper: [0, 0.4] });
  line(trunk.map(([x, y], i) => [x - 12 + i * 2, y]), 5, 0.94, { taper: [0.02, 0.2] });
  line(trunk.map(([x, y], i) => [x + 12 - i * 2, y]), 4.2, 0.88, { taper: [0.02, 0.2] });
  for (let i = 0; i < 8; i++) { const y = by - 10 - i * 15, x = bx + r.range(-5, 5); line([[x - 6, y], [x, y - 6], [x + 6, y]], 2.8, 0.75, { taper: [0.1, 0.1] }); }
  const cl = [[bx - 12, by - 148, 52, bx - 10, by - 138], [bx - 78, by - 108, 54, bx + 2, by - 92], [bx + 60, by - 116, 56, bx + 4, by - 100], [bx - 50, by - 58, 46, bx - 4, by - 48], [bx + 90, by - 60, 50, bx, by - 52]];
  for (const [x, y0, rad, tx, ty] of cl) {
    const y = Math.max(y0, a.yAt(x, -KEEP - 4) + rad * 0.86);
    line([[tx, ty], [(tx + x) / 2, (ty + y) / 2 + 8], [x, y + 3]], 7, 0.9, { taper: [0.02, 0.4] });
    const fan = []; for (let i = 0; i <= 12; i++) { const an = Math.PI + Math.PI * (i / 12); fan.push([x + rad * 1.08 * Math.cos(an), y + rad * 0.86 * Math.sin(an)]); }
    P.wash(fan, 0.4, { blots: 3 });
    for (let i = 0; i < 21; i++) {
      const an = Math.PI * 1.05 + Math.PI * 0.9 * ((i + r.range(-0.3, 0.3)) / 20), ln = rad * r.range(0.8, 1.1);
      line([[x + r.range(-6, 6), y + 1], [x + ln * 1.08 * Math.cos(an), y + ln * 0.86 * Math.sin(an)]], 3, r.range(0.65, 0.9), { taper: [0, 0.6], wobble: 0.2 });
    }
    P.hl(x - rad * 0.98, y + 2, x + rad * 0.98, y + 2, 4.4, 0.88);
  }
}

/** bank / rock: knocked out of whatever is behind, washed, outlined along its top, with texture strokes and moss dots */
function land(P, top, bottomY, tone, o = {}) {
  const { r } = P;
  const poly = [...top, [top[top.length - 1][0] - (o.under || 0), bottomY], [top[0][0], bottomY]];
  P.knock(poly); P.wash(poly, tone, { fix: true });
  if (o.shade) P.clip(poly, () => { const g = P.g; let ty = 1e9; for (const p of top) ty = Math.min(ty, p[1]); g.fillStyle = L.linear(g, 0, ty, 0, ty + 150, [[0, 'rgba(0,0,0,0)'], [1, `rgba(0,0,0,${o.shade})`]]); g.fillRect(top[0][0] - 400, ty, 2800, 400); });
  P.line(top, o.w || 5.6, 0.94, { taper: [0.03, 0.12], wobble: 0.5 });
  const q = L.smoothPath(top, 12);
  for (let i = 2; i < q.length - 2; i++) {
    const [x, y] = q[i];
    if (o.grass && r.chance(0.5)) P.line([[x, y + 1], [x + r.range(-4, 4), y - r.range(9, 19)]], 2.6, r.range(0.55, 0.85), { taper: [0, 0.7] });
    if (r.chance(o.tex === undefined ? 0.35 : o.tex)) { const d = r.range(10, 36), len = r.range(16, 50); P.line([[x, y + d], [x + len * 0.5, y + d + r.range(-2, 3)], [x + len, y + d + r.range(0, 5)]], 3, r.range(0.45, 0.8), { taper: [0.1, 0.4] }); }
    if (o.moss && r.chance(0.3)) for (let k = 0; k < 3; k++) P.dab(x + r.range(-9, 9), y + r.range(-3, 4), r.range(7, 12), -Math.PI / 2 + r.range(-0.5, 0.5), r.range(4.5, 7), 0.92);
  }
}

function waves(P, x0, x1, y0, y1) {
  const { line, r } = P;
  let y = y0, row = 0;
  while (y < y1) {
    let x = x0 + r.range(-80, 40);
    const amp = 3.4 + row * 0.5, lam = 38 + row * 3;
    while (x < x1) {
      const len = r.range(120, 320), ph = r.range(0, TAU), pts = [];
      for (let t = 0; t <= len; t += 12) pts.push([x + t, y + amp * Math.sin((t / lam) * Math.PI + ph) + r.range(-0.8, 0.8)]);
      line(pts, 3.2 + row * 0.3, r.range(0.36, 0.7), { taper: [0.15, 0.3] });
      x += len + r.range(30, 120);
    }
    y += 16 + row * 2.2; row++;
  }
}

/** 如意云头: two inward curls joined by an arch, drawn as one continuous line */
function ruyi(P, cx, cy, rad, w, al, rot = 0) {
  const pts = [], co = Math.cos(rot), si = Math.sin(rot), turns = 1.2;
  const add = (x, y) => pts.push([cx + x * co - y * si, cy + x * si + y * co]);
  for (let i = 0; i <= 26; i++) { const t = i / 26, ph = Math.PI - turns * TAU * (1 - t), rho = rad * L.lerp(0.1, 0.5, t); add(-0.5 * rad + rho * Math.cos(ph), rho * Math.sin(ph)); }
  for (let i = 1; i <= 14; i++) { const ph = Math.PI + Math.PI * (i / 14); add(rad * Math.cos(ph), rad * 0.92 * Math.sin(ph)); }
  for (let i = 1; i <= 26; i++) { const t = i / 26, ph = turns * TAU * t, rho = rad * L.lerp(0.5, 0.1, t); add(0.5 * rad + rho * Math.cos(ph), rho * Math.sin(ph)); }
  P.wash(pts.slice(20, 48), al * 0.5, { fix: true, blots: 2, soft: true });
  P.line(pts, w, al, { taper: [0.04, 0.04], wobble: 0.5, dun: true });
}
function cloud(P, x, y, s, flip, al) {
  const T = (px, py) => [x + flip * px * s, y + py * s];
  ruyi(P, ...T(0, 0), 52 * s, 5.6 * s, al);
  ruyi(P, ...T(-82, 24), 35 * s, 4.8 * s, al, -0.25 * flip);
  ruyi(P, ...T(78, 28), 31 * s, 4.6 * s, al, 0.3 * flip);
  P.line([T(-118, 42), T(-170, 56), T(-235, 46), T(-300, 62)], 6.4 * s, al, { taper: [0.05, 0.7], wobble: 0.5 });
  P.line([T(-36, 50), T(-110, 76), T(-190, 68), T(-262, 90), T(-340, 80)], 7.4 * s, al, { taper: [0.05, 0.7], wobble: 0.5 });
  P.line([T(108, 50), T(156, 62), T(210, 52)], 5.4 * s, al, { taper: [0.05, 0.7], wobble: 0.5 });
}

// ───────────────────────── the painting ─────────────────────────
function paintScene(g, a) {
  const P = painter(g), r = P.r;
  const { line, wash, knock, hl } = P;
  const lim = (pts, m = KEEP) => pts.map(([x, y]) => [x, Math.max(y, a.yAt(x, -m))]);

  // 1 ── far hills
  hill(P, lim([[-150, 918], [-60, 880], [20, 858], [100, 834], [170, 820], [240, 836], [305, 812], [385, 764], [450, 746], [520, 766], [580, 804], [640, 850], [720, 902]]), 990, 0.17);
  hill(P, lim([[1190, 905], [1262, 836], [1326, 778], [1384, 750], [1442, 770], [1502, 740], [1560, 730], [1630, 754], [1700, 786], [1762, 794], [1832, 826], [1902, 864], [1982, 886], [2072, 914]]), 990, 0.17);

  // 2 ── water: rows of rippling strokes, the pavilion's reflection
  waves(P, -160, 2080, 1026, 1250);
  for (let i = 0; i < 12; i++) { const x = 700 + i * 54 + r.range(-12, 12); line([[x, 1034], [x + r.range(-5, 5), 1090], [x + r.range(-6, 6), 1150 + r.range(0, 70)]], r.range(16, 30), 0.1, { taper: [0.05, 0.5] }); }

  // 3 ── left bank with its small pavilion and the willow
  land(P, [[-160, 974], [-40, 968], [70, 975], [190, 979], [320, 986], [440, 992], [540, 1004], [612, 1021]], 1052, 0.22, { grass: true, tex: 0.4, under: 90 });
  kiosk(P, 116, 974, 0.9, { rails: 4 });
  willow(P, 372, 996, a);

  // 4 ── the main two-storey pavilion (重檐楼阁)
  const cx = 1000;
  roof(P, cx, 658, 118, 726, 212, 54, 32, { tone: 0.34, ridge: true });
  storey(P, cx, 739, 792, [-166, -100, -36, 36, 100, 166], { sill: 0.8, sp: 12 });
  knock(rect(cx - 210, 788, cx + 210, 812));
  railing(P, cx - 206, cx + 206, 791, 810, { n: 10 });
  roof(P, cx, 812, 208, 890, 330, 64, 38, { tone: 0.34 });
  storey(P, cx, 903, 990, [-296, -222, -148, -62, 62, 148, 222, 296], { door: true });
  // stone platform with wing railings and steps down to the water
  const py0 = 990, py1 = 1026, phw = 372;
  knock(rect(cx - phw - 4, py0 - 2, cx + phw + 4, py1 + 3));
  wash(rect(cx - phw, py0, cx + phw, py1), 0.22, { fix: true });
  hl(cx - phw - 6, py0, cx + phw + 6, py0, 6.2, 0.95); hl(cx - phw, py1, cx + phw, py1, 5, 0.92);
  hl(cx - phw, py0, cx - phw, py1, 4.4, 0.9); hl(cx + phw, py0, cx + phw, py1, 4.4, 0.9);
  hl(cx - phw + 4, (py0 + py1) / 2 + 2, cx + phw - 4, (py0 + py1) / 2 + 2, 2.2, 0.55);
  for (let x = cx - phw + 30, k = 0; x < cx + phw - 10; x += 48, k++) hl(x + (k % 2) * 22, py0 + 4, x + (k % 2) * 22, (py0 + py1) / 2, 2.2, 0.55);
  railing(P, cx - phw, cx - 300, 956, py0 - 1, { n: 2 }); railing(P, cx + 300, cx + phw, 956, py0 - 1, { n: 2 });
  knock(rect(cx - 100, py1 + 3, cx + 100, py1 + 50));
  for (let i = 0; i < 4; i++) hl(cx - 64 - i * 9, py1 + 10 + i * 12, cx + 64 + i * 9, py1 + 10 + i * 12, 3.8, 0.86);

  // 5 ── waterside pavilion on stilts, joined to the platform by a little bridge
  kiosk(P, 1600, 964, 1.3, { stilts: true, rails: 5 });
  const bx0 = cx + phw, bx1 = 1600 - 90 * 1.3 * 1.08;
  hl(bx0, 994, bx1, 970, 5.4, 0.94); hl(bx0, 1003, bx1, 979, 3, 0.8);
  railing(P, bx0 + 4, bx1 - 4, 972, 992, { n: 2, rise: -24 });
  for (const t of [0.3, 0.7]) { const x = L.lerp(bx0, bx1, t), y = L.lerp(1003, 979, t); hl(x, y, x + 1, y + 44, 4.8, 0.9, { j: 0.5 }); }

  // 6 ── right bank and pine
  land(P, [[1716, 1008], [1770, 992], [1850, 986], [1950, 978], [2080, 972]], 1058, 0.22, { grass: true, tex: 0.4 });
  pine(P, 1846, 992, a);

  // 7 ── foreground rocks in the darkest tone, with reeds
  land(P, [[-160, 1050], [-60, 1030], [30, 1039], [92, 1016], [150, 1029], [202, 1058], [262, 1066], [304, 1102], [326, 1250]], 1260, 0.52, { moss: true, tex: 0.6, shade: 0.4, w: 7.5 });
  land(P, [[1692, 1250], [1718, 1086], [1762, 1052], [1822, 1047], [1880, 1019], [1932, 1035], [1992, 1022], [2080, 1040]], 1260, 0.52, { moss: true, tex: 0.6, shade: 0.4, w: 7.5 });
  for (const [x, y, s] of [[236, 1066, 1], [282, 1086, 1], [1742, 1068, -1], [1706, 1100, -1]]) {
    for (let i = 0; i < 5; i++) { const lean = s * r.range(10, 70), hgt = r.range(40, 92); line([[x + i * 3, y], [x + lean * 0.4, y - hgt * 0.6], [x + lean, y - hgt]], 3.6, 0.84, { taper: [0.02, 0.7] }); }
  }

  // 8 ── above the lines: a pale cloud scroll on either side, well clear of the text zone
  cloud(P, 326, 318, 1.0, 1, 0.2);
  cloud(P, 1626, 262, 1.08, -1, 0.2);
}

/** the hand is never ruler-straight: push the whole drawing around by a slow noise field plus a finer tremor */
function handWarp(src) {
  const w = LW, h = LH;
  const nx = read(L.noiseTex(w, h, { seed: 's26wx', scale: 110, octaves: 2, res: 0.08, contrast: 1.7 }));
  const ny = read(L.noiseTex(w, h, { seed: 's26wy', scale: 110, octaves: 2, res: 0.08, contrast: 1.7 }));
  const nt = read(L.noiseTex(w, h, { seed: 's26wt', scale: 30, octaves: 2, res: 0.2, contrast: 1.7 }));
  const out = new Uint8ClampedArray(w * h);
  const A1 = 6.5 / 128, A2 = 2.2 / 128;
  for (let y = 0; y < h; y++) {
    const y2 = (y + 211) % h;
    for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4, k2 = (y2 * w + (x + 613) % w) * 4;
      const sx = x + (nx[k] - 128) * A1 + (nt[k] - 128) * A2, sy = y + (ny[k] - 128) * A1 + (nt[k2] - 128) * A2;
      const ix = Math.floor(sx), iy = Math.floor(sy);
      if (ix < 0 || iy < 0 || ix >= w - 1 || iy >= h - 1) continue;
      const fx = sx - ix, fy = sy - iy, i0 = (iy * w + ix) * 4 + 3, i1 = i0 + w * 4;
      const a0 = src[i0], a1 = src[i0 + 4], a2 = src[i1], a3 = src[i1 + 4];
      if ((a0 | a1 | a2 | a3) === 0) continue;
      out[y * w + x] = (a0 * (1 - fx) + a1 * fx) * (1 - fy) + (a2 * (1 - fx) + a3 * fx) * fy;
    }
  }
  return out;
}

/** "fire" the density map: density → five-tone cobalt, with pooling, bristle streaks, granulation and iron-rust specks */
function develop(al) {
  const w = LW, h = LH;
  // blurred copy of the density (for edge pooling)
  const dc = L.makeCanvas(w, h), dimg = new ImageData(w, h), dd = dimg.data;
  for (let i = 0, n = w * h; i < n; i++) dd[i * 4 + 3] = al[i];
  dc.getContext('2d').putImageData(dimg, 0, 0);
  const bl = read(L.blurred(dc, 5));
  const low = read(L.noiseTex(w, h, { seed: 's26low', scale: 150, octaves: 3, warp: 0.6, res: 0.2, contrast: 1.7 }));
  const str = read(L.noiseTex(w, h, { seed: 's26str', scale: 22, sx: 8, sy: 0.5, octaves: 3, res: 0.5, contrast: 1.6 }));
  const mid = read(L.noiseTex(w, h, { seed: 's26rust', scale: 8, octaves: 3, res: 0.5, contrast: 1.9 }));
  const ramp = L.makeRamp([
    [0, [150, 180, 228, 0]], [0.035 / 1.5, [150, 180, 228, 0.1]], [0.12 / 1.5, [140, 170, 224, 0.52]], [0.22 / 1.5, [124, 157, 216, 0.82]],
    [0.36 / 1.5, [84, 122, 202, 0.93]], [0.52 / 1.5, [46, 84, 178, 0.98]], [0.72 / 1.5, [29, 60, 152, 1]], [0.92 / 1.5, [20, 42, 116, 1]],
    [1.1 / 1.5, [15, 30, 82, 1]], [1.3 / 1.5, [11, 19, 52, 1]], [1, [9, 13, 36, 1]]]);
  const lut = new Uint8ClampedArray(1024 * 4);
  for (let i = 0; i < 1024; i++) { const c = ramp(i / 1023); lut[i * 4] = c[0]; lut[i * 4 + 1] = c[1]; lut[i * 4 + 2] = c[2]; lut[i * 4 + 3] = c[3] * 255; }
  const out = new ImageData(w, h), o = out.data;
  const R = L.rng('s26grain');
  for (let i = 0, n = w * h; i < n; i++) {
    const D = al[i] / 255;
    if (D < 0.004) continue;
    const k = i * 4;
    let e = D - bl[k + 3] / 255; e = e < 0 ? 0 : e > 0.3 ? 0.3 : e;
    const v = (D + 0.8 * e) * (1 + 0.62 * (low[k] / 255 - 0.5)) * (1 + 0.4 * (str[k] / 255 - 0.5)) * (1 + 0.16 * (R() - 0.5));
    const li = (v >= 1.5 ? 1023 : (v / 1.5 * 1023) | 0) * 4;
    let cr = lut[li], cg = lut[li + 1], cb = lut[li + 2];
    if (v > 0.98) {
      // heaped cobalt: blue-black with rust-brown specks and a dull metallic fleck here and there
      const m = mid[k] / 255, q = sm(0.55, 0.7, m) * sm(0.98, 1.22, v) * 0.92;
      cr += (44 - cr) * q; cg += (28 - cg) * q; cb += (28 - cb) * q;
      if (m > 0.84 && v > 1.1) { cr += 36; cg += 30; cb += 32; }
    }
    o[k] = cr; o[k + 1] = cg; o[k + 2] = cb; o[k + 3] = lut[li + 3];
  }
  const ink = L.makeCanvas(w, h);
  ink.getContext('2d').putImageData(out, 0, 0);
  return ink;
}

function buildPlate(env) {
  const a = env.arc;
  const scene = L.makeLayer(PAD, (g) => paintScene(g, a));
  const al = handWarp(read(scene));
  addBands(al, a);
  const ink = develop(al);
  const glaze = buildGlaze(env);
  return L.makeLayer(PAD, (g) => {
    g.drawImage(glaze, -PAD, -PAD);
    // cobalt bleeding into the glaze around every mark, then the mark itself, slightly soft (it lies UNDER the glaze)
    g.save(); g.globalAlpha = 0.5; g.filter = 'blur(6px)'; g.drawImage(ink, -PAD, -PAD); g.restore();
    g.save(); g.filter = 'blur(0.8px)'; g.drawImage(ink, -PAD, -PAD); g.restore();
    // ── the glaze on top ──
    // bubbles in the glaze: pale pin-points, visible mostly over the blue
    g.save(); g.globalCompositeOperation = 'screen';
    L.speckle(g, { seed: 's26bub', count: 5200, x: -PAD, y: -PAD, w: LW, h: LH, rMin: 0.5, rMax: 1.5, colors: ['#cfdcf0', '#e6eef8'], alpha: [0.08, 0.4] });
    g.restore();
    // pinholes and the odd iron speck
    const calm = (x, y) => !(x > 600 && x < 1320 && y > a.crestY - 290 && y < a.crestY);
    L.speckle(g, { seed: 's26pin', count: 300, x: -PAD, y: -PAD, w: LW, h: LH, rMin: 0.5, rMax: 1.7, colors: ['#8fa3b6', '#6f8296', '#a9b9c8'], alpha: [0.15, 0.5] });
    L.speckle(g, { seed: 's26iron', count: 34, x: -PAD, y: -PAD, w: LW, h: LH, rMin: 0.7, rMax: 2.3, colors: ['#6b5238', '#4a3a2c'], alpha: [0.3, 0.7], test: calm });
    // crazing, barely there
    g.save(); g.globalAlpha = 0.14; g.drawImage(buildCraze(), -PAD, -PAD); g.restore();
  });
}

/** glaze reflections: composited with 'screen' and nudged against the dish's motion */
function buildSheen(env) {
  const a = env.arc;
  return L.makeLayer(PAD, (g) => {
    const rr = (x, y, w, h, rad) => { g.beginPath(); g.moveTo(x + rad, y); g.arcTo(x + w, y, x + w, y + h, rad); g.arcTo(x + w, y + h, x, y + h, rad); g.arcTo(x, y + h, x, y, rad); g.arcTo(x, y, x + w, y, rad); g.closePath(); };
    // soft-box, upper left (half out of frame)
    g.save(); g.filter = 'blur(34px)'; g.translate(250, 20); g.rotate(-0.15);
    g.fillStyle = 'rgba(255,255,255,0.9)'; rr(-420, -170, 800, 270, 70); g.fill(); g.restore();
    // a smaller one, upper right
    g.save(); g.filter = 'blur(30px)'; g.translate(1760, -10); g.rotate(0.2);
    g.fillStyle = 'rgba(255,255,255,0.6)'; rr(-200, -90, 400, 150, 50); g.fill(); g.restore();
    // window bars slanting across the painted well
    g.save(); g.filter = 'blur(22px)';
    g.fillStyle = 'rgba(235,244,255,0.3)'; g.beginPath(); g.moveTo(1268, 560); g.lineTo(1404, 560); g.lineTo(1654, 1280); g.lineTo(1480, 1280); g.closePath(); g.fill();
    g.fillStyle = 'rgba(235,244,255,0.18)'; g.beginPath(); g.moveTo(1452, 570); g.lineTo(1500, 570); g.lineTo(1764, 1280); g.lineTo(1700, 1280); g.closePath(); g.fill();
    g.restore();
    // the fold above the lines catches a thin streak of light
    g.save(); g.filter = 'blur(3px)'; g.lineCap = 'round';
    const p0 = a.pt(-0.27, 10), p1 = a.pt(0.05, 10);
    g.strokeStyle = L.linear(g, p0.x, 0, p1.x, 0, [[0, 'rgba(255,255,255,0)'], [0.4, 'rgba(255,255,255,0.85)'], [1, 'rgba(255,255,255,0)']]);
    g.lineWidth = 5; a.stroke(g, 10, -0.27, 0.05);
    g.restore();
  });
}

export default {
  name: '青花',
  tone: 'dark',
  init(env) {
    S = { plate: buildPlate(env), sheen: buildSheen(env) };
  },
  draw(ctx, env, p) {
    const rot = L.lerp(-0.003, 0.003, p), zoom = L.lerp(1.0, 1.012, p);
    L.blit(ctx, env, S.plate, { rot, zoom });
    L.blit(ctx, env, S.sheen, { rot: -rot * 2.5, dx: L.lerp(10, -10, p), blend: 'screen', alpha: 0.9 });
    L.vignette(ctx, { strength: 0.2, color: '#0c1a34', inner: 0.5, outer: 1.08 });
  },
};
