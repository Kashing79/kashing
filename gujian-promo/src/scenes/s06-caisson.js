// s06 — 藻井. Looking straight up into a round caisson ceiling: the arc is the gilt rim of its outermost ring.
// Below the arc the well steps inward ring by ring — a frieze of blue/green bracket sets (斗拱) over vermilion
// boards, a blue band of gold ruyi clouds, green panels between gold ribs with gilt bosses, a second smaller bracket
// course, and a glimpse of the coiled dragon in the dark crown. Above the arc: the flat coffered ceiling, lost in shadow.
// Everything is concentric with the arc, so the tiny `rot` just slides detail along it.
// Recipe: draw colour + a greyscale height map + a "where is the gold" mask side by side → relief lighting with
// ambient occlusion → pigment mottle, craquelure → re-gild through the mask → inward fall-off, shallow focus →
// bloom + twinkling gold glints at draw time.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 200;
let S = null;

const GOLD = '#e3b341', GOLD_H = '#fff0b0', GOLD_M = '#c9962e', GM = '#ffb21e';
const BLUE = { d: '#102c72', m: '#1f4ea3', l: '#5b90e4', w: '#e6efff' };
const GREEN = { d: '#0b5440', m: '#1f8f6a', l: '#66cfa2', w: '#eafff3' };
const grey = (v) => { v = Math.round(L.clamp(v, 0, 255)); return `rgb(${v},${v},${v})`; };

// radial layout (dr, px): outer edge → inner edge of each ring
const RIM = -17;                 // gilt rim moulding 0 → -17
const R1 = [-17, -124];          // bracket sets (+ the ring beam they carry)
const SA = [-124, -158];         // gilt fillets + bead course
const R2 = [-158, -244];         // gold clouds on ultramarine
const SB = [-244, -262];
const R3 = [-262, -356];         // ribs + bosses on malachite green
const SC = [-356, -374];
const PITCH = 150;               // bracket-set spacing along the rim (px)

/** local relief lighting: height map (white = high) → { shade (overlay, 128 = flat; includes ambient occlusion), spec (screen) }. (lx,ly) points TOWARD the light. */
function relief(height, { lx = -0.6, ly = -0.8, strength = 2.0, blur = 1.2, res = 0.5, specAt = 46, specSpan = 80, ao = 0.55, aoRadius = 9 } = {}) {
  const w = height.width, hh = height.height;
  const cw = Math.round(w * res), ch = Math.round(hh * res);
  const tmp = L.makeCanvas(cw, ch); const tg = tmp.getContext('2d', { willReadFrequently: true });
  if (blur) tg.filter = `blur(${blur * res}px)`;
  tg.drawImage(height, 0, 0, cw, ch);
  tg.filter = 'none';
  const src = tg.getImageData(0, 0, cw, ch).data;
  // a wide blur of the same map: where it sits above the surface we are in a recess → ambient occlusion
  let wide = null;
  if (ao) {
    const t2 = L.makeCanvas(cw, ch); const g2 = t2.getContext('2d', { willReadFrequently: true });
    g2.filter = `blur(${aoRadius * res}px)`; g2.drawImage(height, 0, 0, cw, ch);
    wide = g2.getImageData(0, 0, cw, ch).data;
  }
  const sh = new ImageData(cw, ch), sp = new ImageData(cw, ch);
  const so = sh.data, po = sp.data;
  const row = cw * 4;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const i = (y * cw + x) * 4;
    const gx = src[x < cw - 1 ? i + 4 : i] - src[x > 0 ? i - 4 : i];
    const gy = src[y < ch - 1 ? i + row : i] - src[y > 0 ? i - row : i];
    const d = -(gx * lx + gy * ly) * strength;
    let s = 128 + d;
    if (wide) { const o = wide[i] - src[i]; if (o > 0) s -= o * ao; }
    so[i] = so[i + 1] = so[i + 2] = s < 0 ? 0 : s > 255 ? 255 : s; so[i + 3] = 255;
    const k = (d - specAt) / specSpan;
    po[i] = 255; po[i + 1] = 222; po[i + 2] = 140; po[i + 3] = k <= 0 ? 0 : k >= 1 ? 255 : k * 255;
  }
  const up = (img) => {
    tg.putImageData(img, 0, 0);
    const out = L.makeCanvas(w, hh); const g = out.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(tmp, 0, 0, w, hh);
    return out;
  };
  const shade = up(sh);
  tg.clearRect(0, 0, cw, ch);
  const spec = up(sp);
  return { shade, spec };
}

function buildCaisson(env) {
  const a = env.arc;
  const T = a.span(PAD + 220);
  const col = L.makeLayer(PAD), hgt = L.makeLayer(PAD), gm = L.makeLayer(PAD);   // colour, height map, "where the gold leaf is"
  const g = col.getContext('2d'), h = hgt.getContext('2d'), m = gm.getContext('2d');
  m.fillStyle = m.strokeStyle = GM; m.lineCap = m.lineJoin = 'round';
  const glints = [];
  const r = L.rng('s06');
  const full = (c) => c.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
  const rg = (c, drIn, drOut, stops) => L.radial(c, a.cx, a.cy, a.R + drIn, a.R + drOut, stops);
  const band = (c, dr0, dr1, style) => { c.fillStyle = style; a.pathBand(c, dr0, dr1, -T, T); c.fill(); };
  /** run fn in the local frame at (theta, dr) on the colour, height and gold-mask contexts at once */
  const at2 = (theta, dr, fn) => {
    const p = a.pt(theta, dr);
    for (const c of [g, h, m]) { c.save(); c.translate(p.x, p.y); c.rotate(theta); }
    fn();
    g.restore(); h.restore(); m.restore();
  };
  /** frame position of a local point (x along the arc, y inward) → for glints */
  const world = (theta, dr, x = 0, y = 0) => { const p = a.pt(theta + x / (a.R + dr - y), dr - y); return p; };
  const glint = (theta, dr, x, y, s, amp = 1) => { const p = world(theta, dr, x, y); glints.push({ x: p.x, y: p.y, s, a: amp, ph: r.range(0, L.TAU), sp: r.range(1.1, 2.1), dr: dr - y }); };

  /** a gilt fillet: rounded gold moulding between dr0 (outer) and dr1 (inner) */
  const goldBand = (dr0, dr1, hv = 215) => {
    band(g, dr0, dr1, rg(g, dr1, dr0, [[0, '#583508'], [0.2, '#b07c22'], [0.48, GOLD], [0.7, GOLD_H], [0.86, '#ecc45c'], [1, '#93661a']]));
    band(h, dr0, dr1, rg(h, dr1, dr0, [[0, grey(hv - 110)], [0.5, grey(hv)], [1, grey(hv - 110)]]));
    band(m, dr0, dr1, GM);
  };
  /**
   * 叠晕 block: from the edge inward → gold outline, white powder line, light tint, mid tone, deep core.
   * trace(c) must build the path on context c. k scales the band widths for small pieces.
   */
  const yun = (trace, pal, hv, k = 1, shadow = true) => {
    g.save();
    if (shadow) { g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 7; g.shadowOffsetY = 3; }
    trace(g); g.fillStyle = pal.d; g.fill();
    g.restore();
    g.save(); trace(g); g.clip(); g.lineJoin = 'round';
    trace(g); g.strokeStyle = pal.m; g.lineWidth = 15 * k; g.stroke();
    trace(g); g.strokeStyle = pal.l; g.lineWidth = 8.4 * k; g.stroke();
    trace(g); g.strokeStyle = L.rgba(pal.w, 0.9); g.lineWidth = 4.6 * k; g.stroke();
    g.restore();
    g.save(); g.lineJoin = 'round';
    trace(g); g.strokeStyle = '#b07a1c'; g.lineWidth = 3.2; g.stroke();
    g.translate(-0.5, -0.6); trace(g); g.strokeStyle = '#ffd866'; g.lineWidth = 1.5; g.stroke();
    g.restore();
    trace(h); h.fillStyle = grey(hv); h.fill();
    trace(m); m.lineWidth = 3.2; m.stroke();
  };

  // ───────── base: everything below the arc ─────────
  g.save(); a.clipBelow(g, 0); g.fillStyle = '#04060c'; full(g); g.restore();
  h.fillStyle = '#000'; full(h);
  h.save(); a.clipBelow(h, 0); h.fillStyle = grey(52); full(h); h.restore();

  // ───────── ring 1: 垫拱板 (vermilion boards) in shadow behind the bracket sets ─────────
  band(g, R1[0], R1[1], rg(g, R1[1], R1[0], [[0, '#03040a'], [0.35, '#12050a'], [0.62, '#3c0e0a'], [0.86, '#7a2015'], [1, '#93281a']]));
  const dth1 = PITCH / a.R;
  const n1 = Math.ceil(T / dth1) + 1;
  // a small gold flaming pearl on each board, between two bracket sets
  for (let i = -n1; i <= n1; i++) {
    at2((i + 0.5) * dth1, R1[0], () => {
      g.fillStyle = 'rgba(40,6,2,0.55)'; g.beginPath(); g.ellipse(1.5, 24, 10, 10, 0, 0, L.TAU); g.fill();
      g.fillStyle = GOLD_M; g.beginPath(); g.moveTo(-8, 22); g.quadraticCurveTo(-10, 38, 0, 52); g.quadraticCurveTo(10, 38, 8, 22); g.closePath(); g.fill();
      g.fillStyle = L.radial(g, -2.4, 18, 0.5, 10, [[0, '#fff6cf'], [0.35, GOLD], [1, '#8a5c16']]);
      g.beginPath(); g.arc(0, 21, 8.2, 0, L.TAU); g.fill();
      h.fillStyle = L.radial(h, 0, 21, 0, 9, [[0, grey(150)], [1, grey(70)]]); h.beginPath(); h.arc(0, 21, 9, 0, L.TAU); h.fill();
      m.beginPath(); m.moveTo(-8, 22); m.quadraticCurveTo(-10, 38, 0, 52); m.quadraticCurveTo(10, 38, 8, 22); m.closePath(); m.fill(); m.beginPath(); m.arc(0, 21, 8.2, 0, L.TAU); m.fill();
    });
  }
  // the bracket sets, drawn in elevation as seen from the floor: cap block (栌斗) on the rim, bow arms (栱) stepping
  // wider toward the well, small bearing blocks (升) on each arm, dark eyes (栱眼) between them
  const dou = (x, y0, y1, wSeat, wBody) => (c) => {
    const ym = y0 + (y1 - y0) * 0.42;
    c.beginPath(); c.moveTo(x - wSeat / 2, y0); c.lineTo(x + wSeat / 2, y0); c.lineTo(x + wBody / 2, ym); c.lineTo(x + wBody / 2, y1); c.lineTo(x - wBody / 2, y1); c.lineTo(x - wBody / 2, ym); c.closePath();
  };
  const gong = (y0, y1, hw) => (c) => {
    const k = Math.min(27, hw * 0.46), m = y1 - 3;
    c.beginPath(); c.moveTo(-hw, y1); c.lineTo(-hw, m); c.quadraticCurveTo(-hw + 2, y0 + 1, -hw + k, y0); c.lineTo(hw - k, y0); c.quadraticCurveTo(hw - 2, y0 + 1, hw, m); c.lineTo(hw, y1); c.closePath();
  };
  const D1 = R1[0] - R1[1];        // 107
  const bracketSet = (A, B) => {
    // the shadowed depth of the set (everything behind the front plane)
    const back = (c) => { c.beginPath(); c.moveTo(-24, 6); c.lineTo(24, 6); c.lineTo(68, 66); c.lineTo(68, D1 - 10); c.lineTo(-68, D1 - 10); c.lineTo(-68, 66); c.closePath(); };
    g.save(); g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = 10; back(g); g.fillStyle = L.linear(g, 0, 6, 0, D1 - 10, [[0, '#1a0708'], [0.5, '#0a0508'], [1, '#03040a']]); g.fill(); g.restore();
    back(h); h.fillStyle = grey(40); h.fill();
    for (const x of [-57, 0, 57]) yun(dou(x, 82, 96.5, 14, 21), A, 150, 0.8, false);
    yun(gong(63, 82, 68), B, 176);
    for (const x of [-34, 0, 34]) yun(dou(x, 49, 63, 14, 21), A, 190, 0.8, false);
    yun(gong(30, 49, 45), B, 208);
    yun(dou(0, 3, 30, 38, 58), A, 236);
  };
  for (let i = -n1; i <= n1; i++) {
    const even = ((i % 2) + 2) % 2 === 0;
    at2(i * dth1, R1[0], () => bracketSet(even ? BLUE : GREEN, even ? GREEN : BLUE));
    if (r.chance(0.6)) glint(i * dth1, R1[0], r.pick([-28, 28]), 12, r.range(14, 26), 0.9);
    if (r.chance(0.45)) glint(i * dth1, R1[0], r.pick([-68, 68, -45, 45]), r.pick([66, 33]), r.range(10, 20), 0.7);
  }
  // the ring beam (枋) riding on the sets
  band(g, R1[1] + 10, R1[1], rg(g, R1[1], R1[1] + 10, [[0, GREEN.d], [0.3, GREEN.m], [0.62, GREEN.l], [0.8, GREEN.m], [1, GREEN.d]]));
  band(h, R1[1] + 10, R1[1], grey(165));

  // ───────── separator A: gilt fillet / bead course / gilt fillet ─────────
  goldBand(SA[0], SA[0] - 7);
  band(g, SA[0] - 7, SA[1] + 7, rg(g, SA[1] + 7, SA[0] - 7, [[0, '#0a1a48'], [0.5, '#12307a'], [1, '#081234']]));
  band(h, SA[0] - 7, SA[1] + 7, grey(90));
  const beadDr = (SA[0] + SA[1]) / 2;
  a.along({ spacing: 20, dr: beadDr, t0: -T, t1: T }, (q) => {
    at2(q.theta, beadDr, () => {
      g.fillStyle = 'rgba(2,4,20,0.6)'; g.beginPath(); g.arc(1.4, 2.2, 7.2, 0, L.TAU); g.fill();
      g.fillStyle = L.radial(g, -2.2, -2.4, 0.4, 8.4, [[0, '#fff8d8'], [0.28, '#f0c552'], [0.7, '#a87420'], [1, '#4e3008']]);
      g.beginPath(); g.arc(0, 0, 6.8, 0, L.TAU); g.fill();
      h.fillStyle = L.radial(h, 0, 0, 0, 7, [[0, grey(240)], [0.6, grey(190)], [1, grey(90)]]); h.beginPath(); h.arc(0, 0, 7, 0, L.TAU); h.fill();
      m.beginPath(); m.arc(0, 0, 6.8, 0, L.TAU); m.fill();
    });
    if (r.chance(0.09)) glint(q.theta, beadDr, -2, -2, r.range(10, 18), 0.8);
  });
  goldBand(SA[1] + 7, SA[1]);

  // ───────── ring 2: gold ruyi clouds on ultramarine ─────────
  band(g, R2[0], R2[1], rg(g, R2[1], R2[0], [[0, '#0a1f5c'], [0.2, '#173f98'], [0.55, '#1f4ea3'], [0.85, '#183f95'], [1, '#08184a']]));
  band(h, R2[0], R2[1], grey(70));
  g.lineWidth = 3; g.strokeStyle = L.rgba(BLUE.l, 0.85); a.stroke(g, R2[0] - 6, -T, T); a.stroke(g, R2[1] + 6, -T, T);
  g.lineWidth = 1.2; g.strokeStyle = L.rgba(BLUE.w, 0.7); a.stroke(g, R2[0] - 3.4, -T, T); a.stroke(g, R2[1] + 3.4, -T, T);
  const strokePts = (c, P, ox = 0, oy = 0) => { c.beginPath(); c.moveTo(P[0][0] + ox, P[0][1] + oy); for (let i = 1; i < P.length; i++) c.lineTo(P[i][0] + ox, P[i][1] + oy); c.stroke(); };
  const halo = (P, w) => {
    g.lineCap = g.lineJoin = 'round';
    g.strokeStyle = L.rgba('#3f76d8', 0.5); g.lineWidth = w + 11; strokePts(g, P);
    g.strokeStyle = L.rgba('#8fb6f4', 0.55); g.lineWidth = w + 5; strokePts(g, P);
  };
  const goldLine = (P, w, hv = 200) => {
    g.lineCap = g.lineJoin = 'round'; h.lineCap = h.lineJoin = 'round';
    g.strokeStyle = 'rgba(3,8,34,0.7)'; g.lineWidth = w + 2; strokePts(g, P, 1.3, 2.4);
    g.strokeStyle = '#8f5f12'; g.lineWidth = w + 0.6; strokePts(g, P);
    g.strokeStyle = '#d69c28'; g.lineWidth = w - 1; strokePts(g, P, -0.3, -0.4);
    g.strokeStyle = '#ffd96e'; g.lineWidth = w * 0.3; strokePts(g, P, -0.7, -0.9);
    h.strokeStyle = grey(hv); h.lineWidth = w; strokePts(h, P);
    m.lineWidth = w + 0.6; strokePts(m, P);
  };
  // one ruyi-headed cloud: two inward spirals meeting at a notch, with trailing wisps
  const cloudPaths = [];
  for (const sx of [-1, 1]) {
    const sp = [];
    for (let k = 0; k <= 54; k++) {
      const t = k / 54, ang = L.deg(-30 - 570 * t), rad = L.lerp(21.5, 3.2, Math.pow(t, 0.85));
      sp.push([sx * (-19.5 + rad * Math.cos(ang)), -4 + rad * Math.sin(ang)]);
    }
    cloudPaths.push({ P: sp, w: 5.6 });
    cloudPaths.push({ P: L.smoothPath([[-5, 16], [-21, 25.5], [-41, 26], [-57, 18], [-65.5, 6], [-60, -2.5], [-54, 2]].map(([x, y]) => [sx * x, y]), 2.5), w: 4.8 });
    cloudPaths.push({ P: L.smoothPath([[-1, 26], [-15, 34.5], [-32, 36], [-46, 31]].map(([x, y]) => [sx * x, y]), 2.5), w: 3.6 });
  }
  const dth2 = dth1 * 1.1;
  const n2 = Math.ceil(T / dth2) + 1;
  const drC = (R2[0] + R2[1]) / 2 + 4;
  for (let i = -n2; i <= n2; i++) {
    at2(i * dth2, drC, () => {
      for (const s of cloudPaths) halo(s.P, s.w);
      for (const s of cloudPaths) goldLine(s.P, s.w);
    });
    glint(i * dth2, drC, r.pick([-19.5, 19.5]), -4, r.range(14, 26), 0.75);
    // a small gold star-dot riding between two clouds
    at2((i + 0.5) * dth2, drC, () => {
      for (const [x, y, rad] of [[0, -22, 4.2], [-9, -10, 2.4], [9, -10, 2.4]]) {
        g.fillStyle = L.rgba('#8fb6f4', 0.5); g.beginPath(); g.arc(x, y, rad + 2.6, 0, L.TAU); g.fill();
        g.fillStyle = L.radial(g, x - 1, y - 1, 0.2, rad + 1, [[0, '#fff6cf'], [0.4, GOLD], [1, '#8a5c16']]); g.beginPath(); g.arc(x, y, rad, 0, L.TAU); g.fill();
        h.fillStyle = grey(190); h.beginPath(); h.arc(x, y, rad, 0, L.TAU); h.fill();
        m.beginPath(); m.arc(x, y, rad, 0, L.TAU); m.fill();
      }
    });
  }

  // ───────── separator B ─────────
  goldBand(SB[0], SB[0] - 6);
  band(g, SB[0] - 6, SB[1] + 6, rg(g, SB[1] + 6, SB[0] - 6, [[0, '#0b4a3a'], [0.5, '#2aa27a'], [1, '#0b4a3a']]));
  band(h, SB[0] - 6, SB[1] + 6, grey(120));
  goldBand(SB[1] + 6, SB[1]);

  // ───────── ring 3: malachite panels between radial gold ribs, a gilt boss on every panel ─────────
  band(g, R3[0], R3[1], rg(g, R3[1], R3[0], [[0, '#06281f'], [0.5, '#0c4435'], [1, '#062a20']]));
  band(h, R3[0], R3[1], grey(60));
  const dth3 = dth1 / 2;
  const n3 = Math.ceil(T / dth3) + 1;
  const d3 = R3[0] - R3[1];
  for (let i = -n3; i <= n3; i++) {
    const wTop = dth3 * (a.R + R3[0]), wBot = dth3 * (a.R + R3[1]);
    at2(i * dth3, R3[0], () => {
      const x0 = (wTop - 14) / 2 - 2.5, x1 = (wBot - 12) / 2 - 2.5;
      yun((c) => { c.beginPath(); c.moveTo(-x0, 4); c.lineTo(x0, 4); c.lineTo(x1, d3 - 4); c.lineTo(-x1, d3 - 4); c.closePath(); }, GREEN, 96, 1, false);
      // boss: thin gilt ring + domed gilt stud
      const cy = d3 / 2;
      g.strokeStyle = 'rgba(2,20,14,0.6)'; g.lineWidth = 3; g.beginPath(); g.arc(1, cy + 1.6, 19.5, 0, L.TAU); g.stroke();
      g.strokeStyle = GOLD_M; g.lineWidth = 2.4; g.beginPath(); g.arc(0, cy, 19.5, 0, L.TAU); g.stroke();
      g.strokeStyle = '#f8dc7c'; g.lineWidth = 1; g.beginPath(); g.arc(-0.4, cy - 0.6, 19.5, 0, L.TAU); g.stroke();
      g.fillStyle = 'rgba(2,16,12,0.7)'; g.beginPath(); g.arc(2.5, cy + 4, 14.5, 0, L.TAU); g.fill();
      g.fillStyle = L.radial(g, -4.5, cy - 5.5, 0.6, 19, [[0, '#fffbe2'], [0.16, '#ffe9a0'], [0.42, GOLD], [0.78, '#99691c'], [1, '#4a2d06']]);
      g.beginPath(); g.arc(0, cy, 13.5, 0, L.TAU); g.fill();
      h.strokeStyle = grey(170); h.lineWidth = 2.4; h.beginPath(); h.arc(0, cy, 19.5, 0, L.TAU); h.stroke();
      h.fillStyle = L.radial(h, 0, cy, 0, 14, [[0, grey(255)], [0.55, grey(215)], [1, grey(110)]]); h.beginPath(); h.arc(0, cy, 14, 0, L.TAU); h.fill();
      m.lineWidth = 2.4; m.beginPath(); m.arc(0, cy, 19.5, 0, L.TAU); m.stroke(); m.beginPath(); m.arc(0, cy, 13.5, 0, L.TAU); m.fill();
    });
    if (r.chance(0.7)) glint(i * dth3, R3[0], -4.5, d3 / 2 - 5.5, r.range(12, 24), 1);
    // rib
    at2((i + 0.5) * dth3, R3[0], () => {
      const trace = (c) => { c.beginPath(); c.moveTo(-7, 0); c.lineTo(7, 0); c.lineTo(6, d3); c.lineTo(-6, d3); c.closePath(); };
      g.fillStyle = 'rgba(2,16,12,0.55)'; g.beginPath(); g.moveTo(-5, 0); g.lineTo(11, 0); g.lineTo(10, d3); g.lineTo(-4, d3); g.closePath(); g.fill();
      trace(g); g.fillStyle = L.linear(g, -7, 0, 7, 0, [[0, '#6a430c'], [0.2, '#d6a436'], [0.38, GOLD_H], [0.55, GOLD], [0.82, '#a97620'], [1, '#553407']]); g.fill();
      trace(h); h.fillStyle = L.linear(h, -7, 0, 7, 0, [[0, grey(110)], [0.5, grey(210)], [1, grey(110)]]); h.fill();
      trace(m); m.fill();
    });
  }

  // ───────── separator C ─────────
  goldBand(SC[0], SC[0] - 6);
  band(g, SC[0] - 6, SC[1] + 6, rg(g, SC[1] + 6, SC[0] - 6, [[0, '#0a1a48'], [0.5, '#1f4ea3'], [1, '#0a1a48']]));
  band(h, SC[0] - 6, SC[1] + 6, grey(120));
  goldBand(SC[1] + 6, SC[1]);

  // ───────── the well wall: deep blue-green, a smaller bracket course, and the dragon ─────────
  band(g, SC[1], -1300, rg(g, -760, SC[1], [[0, '#020a12'], [0.55, '#072433'], [1, '#0d3c4c']]));
  band(h, SC[1], -1300, grey(40));
  // a second, smaller course of bracket sets higher up the well (层层出挑), already half lost in shadow
  const KS = 0.42;
  for (let i = -n3; i <= n3; i++) {
    const even = ((i % 2) + 2) % 2 === 0;
    at2((i + 0.5) * dth3, SC[1], () => { for (const c of [g, h, m]) c.scale(KS, KS); bracketSet(even ? GREEN : BLUE, even ? BLUE : GREEN); });
  }
  goldBand(SC[1] - (D1 - 10) * KS, SC[1] - (D1 - 10) * KS - 6, 170);
  drawDragon(g, h, m, a, glint, r);

  // ───────── the gilt rim: its top edge IS the arc ─────────
  band(g, 0, RIM, rg(g, RIM, 0, [[0, '#4e2e06'], [0.16, '#a87420'], [0.4, '#dba935'], [0.62, '#f6cf63'], [0.8, GOLD_H], [0.9, '#f4c95a'], [1, '#b98424']]));
  band(h, 0, RIM, rg(h, RIM, 0, [[0, grey(120)], [0.55, grey(245)], [1, grey(150)]]));
  band(m, 0, RIM, GM);
  g.strokeStyle = 'rgba(60,34,4,0.8)'; g.lineWidth = 1.6; a.stroke(g, RIM + 0.4, -T, T);
  g.strokeStyle = 'rgba(96,58,8,0.55)'; g.lineWidth = 1.2; a.stroke(g, RIM * 0.42, -T, T);
  a.along({ spacing: 46, dr: -4, t0: -T, t1: T }, (q) => { if (r.chance(0.5)) glint(q.theta + r.range(-0.006, 0.006), -4, 0, 0, r.range(12, 34), 1); });

  // ───────── light & age (only where the caisson is) ─────────
  const { shade, spec } = relief(hgt, { strength: 2.1, blur: 1.3, res: 0.5 });
  g.save(); a.clipBelow(g, 0);
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.92; g.drawImage(shade, -PAD, -PAD);
  // mineral pigment: mottled, slightly streaked along the rings
  g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.62;
  g.drawImage(L.polarNoiseLayer(env, PAD, { seed: 's06mottle', scale: 26, sx: 1.8, sy: 1, octaves: 4, contrast: 1.8, res: 0.4 }), -PAD, -PAD);
  // mineral blues and greens are never one hue: slow drifts toward violet and toward turquoise
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.24;
  g.drawImage(L.noiseLayer(PAD, { seed: 's06hue', scale: 260, octaves: 3, warp: 0.8, res: 0.2, contrast: 1.7, ramp: [[0, '#6d3ec0'], [0.5, '#808080'], [1, '#18b0a8']] }), -PAD, -PAD);
  // broad wear / soot
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.5;
  g.drawImage(L.noiseLayer(PAD, { seed: 's06wear', scale: 210, octaves: 4, warp: 0.7, res: 0.25, ramp: [[0, '#2e2a26'], [0.44, '#ffffff'], [1, '#ffffff']] }), -PAD, -PAD);
  // craquelure: a fine network of cracks, with a lit lip on one side
  const crack = L.noiseLayer(PAD, { seed: 's06crack', scale: 38, octaves: 1, warp: 0.55, warpScale: 1.6, ridged: true, res: 0.6,
    ramp: [[0, 'rgba(2,4,10,0)'], [0.9, 'rgba(2,4,10,0)'], [0.965, 'rgba(2,4,10,0.8)'], [1, 'rgba(2,4,10,0.95)']] });
  g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.22; g.filter = 'invert(1)'; g.drawImage(crack, -PAD + 1.3, -PAD + 1.5); g.filter = 'none';
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 0.5; g.drawImage(crack, -PAD, -PAD);
  // glancing highlights on every raised edge
  g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.5; g.drawImage(spec, -PAD, -PAD);
  // gold leaf: put the hue back wherever there is gilding (relief + ageing grey it out), then let it shimmer
  g.globalCompositeOperation = 'color'; g.globalAlpha = 0.92; g.drawImage(gm, -PAD, -PAD);
  g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.55; g.drawImage(gm, -PAD, -PAD);
  const dust = L.makeLayer(PAD, (d) => {
    L.speckle(d, { seed: 's06leaf', count: 26000, x: -PAD, y: -PAD, w: W + PAD * 2, h: H + PAD * 2, rMin: 0.5, rMax: 1.7, colors: ['#fff6cf', '#ffe08a', '#ffffff'], alpha: [0.25, 0.95] });
    d.globalCompositeOperation = 'destination-in'; d.drawImage(gm, -PAD, -PAD);
  });
  g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.8; g.drawImage(dust, -PAD, -PAD);
  // the well darkens as it climbs away from us; shadows go cool
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = 1;
  g.fillStyle = rg(g, -640, 0, [[0, '#0e111c'], [0.28, '#262c3e'], [0.44, '#474d62'], [0.62, '#8a8e9e'], [0.8, '#d6d8e0'], [0.96, '#ffffff'], [1, '#ffffff']]); full(g);
  const hot = a.pt(-0.13, -40);
  g.fillStyle = L.radial(g, hot.x, hot.y, 80, 1500, [[0, '#ffffff'], [0.3, '#eceef2'], [0.62, '#b4b8c6'], [1, '#5c6078']]); full(g);
  g.globalCompositeOperation = 'soft-light';
  g.fillStyle = L.radial(g, hot.x, hot.y, 0, 620, [[0, 'rgba(255,236,190,0.5)'], [0.5, 'rgba(255,226,170,0.2)'], [1, 'rgba(255,220,160,0)']]); full(g);
  // cool sheen gathered under the rim
  g.globalCompositeOperation = 'screen';
  g.fillStyle = rg(g, -190, 0, [[0, 'rgba(110,160,255,0)'], [0.6, 'rgba(110,160,255,0.06)'], [1, 'rgba(170,205,255,0.16)']]); full(g);
  g.restore();

  // shallow depth of field: the rim is in focus, the crown of the well goes soft
  const soft = L.blurred(col, 2.8);
  const sg = soft.getContext('2d');
  sg.globalCompositeOperation = 'destination-in';
  sg.fillStyle = L.radial(sg, a.cx + PAD, a.cy + PAD, a.R - 470, a.R - 235, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
  sg.fillRect(0, 0, soft.width, soft.height);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(soft, 0, 0); g.restore();

  // final grade + a bloom layer that mostly stays inside the rim (so the arc keeps a hard edge)
  const graded = L.filtered(col, 'saturate(1.22) contrast(1.06)');
  const bloom = L.filtered(graded, 'blur(14px) saturate(1.5)');
  const bg = bloom.getContext('2d');
  bg.globalCompositeOperation = 'destination-in';
  bg.fillStyle = L.radial(bg, a.cx + PAD, a.cy + PAD, a.R - 1, a.R + 40, [[0, 'rgba(0,0,0,1)'], [0.05, 'rgba(0,0,0,0.4)'], [1, 'rgba(0,0,0,0.06)']]);
  bg.fillRect(0, 0, bloom.width, bloom.height);
  return { col: graded, bloom, glints };
}

/** a glimpse of the coiled dragon in the crown of the well: two humps of scaled, gilt body rising into frame */
function drawDragon(g, h, m, a, glint, r) {
  const ctrl = [[230, 1330], [390, 1168], [535, 1072], [690, 1026], [830, 1024], [945, 1064], [1035, 1136], [1105, 1160], [1190, 1108], [1290, 1056], [1400, 1054], [1505, 1102], [1620, 1200], [1730, 1330]];
  const P = L.smoothPath(ctrl, 4);
  const n = P.length, HW = 46;
  const nor = [], tan = [], acc = [0];
  for (let i = 0; i < n; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[Math.min(n - 1, i + 1)];
    let tx = p1[0] - p0[0], ty = p1[1] - p0[1]; const len = Math.hypot(tx, ty) || 1; tx /= len; ty /= len;
    tan.push([tx, ty]); nor.push([ty, -tx]);            // normal toward the dragon's back (up on screen)
    if (i) acc.push(acc[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  }
  const edge = (k) => P.map((p, i) => [p[0] + nor[i][0] * HW * k, p[1] + nor[i][1] * HW * k]);
  const up = edge(1), dn = edge(-1), belly = edge(-0.5);
  const body = (c) => { c.beginPath(); c.moveTo(up[0][0], up[0][1]); for (const q of up) c.lineTo(q[0], q[1]); for (let i = n - 1; i >= 0; i--) c.lineTo(dn[i][0], dn[i][1]); c.closePath(); };
  const at = (s) => { let i = 0; while (i < n - 1 && acc[i] < s) i++; return i; };
  // dorsal flames along the back
  for (let s = 20; s < acc[n - 1]; s += 30) {
    const i = at(s); const [x, y] = up[i], [tx, ty] = tan[i], [nx, ny] = nor[i];
    const tip = [x + nx * 25 - tx * 20, y + ny * 25 - ty * 20];
    const trace = (c) => { c.beginPath(); c.moveTo(x - tx * 14 - nx * 4, y - ty * 14 - ny * 4); c.quadraticCurveTo(x - tx * 12 + nx * 14, y - ty * 12 + ny * 14, tip[0], tip[1]); c.quadraticCurveTo(x + tx * 4 + nx * 10, y + ty * 4 + ny * 10, x + tx * 14 - nx * 4, y + ty * 14 - ny * 4); c.closePath(); };
    trace(g); g.fillStyle = '#b98424'; g.fill(); g.strokeStyle = '#f3cf68'; g.lineWidth = 1.2; g.stroke();
    trace(h); h.fillStyle = grey(120); h.fill();
    trace(m); m.fill();
  }
  g.save(); g.shadowColor = 'rgba(0,0,0,0.85)'; g.shadowBlur = 24; g.shadowOffsetY = 9; body(g); g.fillStyle = '#4a2f08'; g.fill(); g.restore();
  body(h); h.fillStyle = grey(80); h.fill();
  body(m); m.fill();
  // overlapping scales, rounded ends toward the tail side so each row laps the one before
  g.save(); body(g); g.clip(); h.save(); body(h); h.clip();
  let row = 0;
  for (let s = 0; s < acc[n - 1]; s += 12.5, row++) {
    const i = at(s); const [px, py] = P[i], [nx, ny] = nor[i], [tx, ty] = tan[i];
    const ang = Math.atan2(ty, tx) + Math.PI;
    for (let j = -4; j <= 4; j++) {
      const off = (j + (row % 2) * 0.5) * 13.5;
      if (Math.abs(off) > HW + 8) continue;
      const u = off / HW;
      const lit = L.clamp(1.05 - Math.pow(Math.abs(u - 0.3), 1.5) * 0.95) * (0.82 + 0.18 * r());
      const x = px + nx * off, y = py + ny * off;
      g.beginPath(); g.arc(x, y, 10, ang - 1.8, ang + 1.8); g.closePath();
      g.fillStyle = L.mix('#553608', '#e0ad3c', lit * 0.9); g.fill();
      g.beginPath(); g.arc(x, y, 10, ang - 1.5, ang + 1.5); g.strokeStyle = 'rgba(38,20,2,0.8)'; g.lineWidth = 1.6; g.stroke();
      g.beginPath(); g.arc(x, y, 8, ang - 1.3, ang + 1.3); g.strokeStyle = L.rgba('#fff0b0', 0.2 + 0.5 * lit); g.lineWidth = 1.3; g.stroke();
      h.beginPath(); h.arc(x, y, 10, ang - 1.8, ang + 1.8); h.closePath(); h.fillStyle = grey(80 + 90 * lit); h.fill();
      h.beginPath(); h.arc(x, y, 10, ang - 1.5, ang + 1.5); h.strokeStyle = grey(50); h.lineWidth = 1.6; h.stroke();
    }
  }
  // belly plates
  g.beginPath(); g.moveTo(belly[0][0], belly[0][1]); for (const q of belly) g.lineTo(q[0], q[1]); for (let i = n - 1; i >= 0; i--) g.lineTo(dn[i][0], dn[i][1]); g.closePath();
  g.fillStyle = '#d8b25a'; g.globalAlpha = 0.92; g.fill(); g.globalAlpha = 1;
  for (let s = 0; s < acc[n - 1]; s += 11) {
    const i = at(s);
    g.strokeStyle = 'rgba(70,40,6,0.75)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(belly[i][0], belly[i][1]); g.lineTo(dn[i][0], dn[i][1]); g.stroke();
    g.strokeStyle = 'rgba(255,244,200,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(belly[i][0] + tan[i][0] * 2, belly[i][1] + tan[i][1] * 2); g.lineTo(dn[i][0] + tan[i][0] * 2, dn[i][1] + tan[i][1] * 2); g.stroke();
    h.strokeStyle = grey(60); h.lineWidth = 2; h.beginPath(); h.moveTo(belly[i][0], belly[i][1]); h.lineTo(dn[i][0], dn[i][1]); h.stroke();
  }
  // roundness: shade both flanks of the body
  for (const e of [up, dn]) {
    g.strokeStyle = 'rgba(20,10,0,0.55)'; g.lineWidth = 22; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(e[0][0], e[0][1]); for (const q of e) g.lineTo(q[0], q[1]); g.stroke();
  }
  g.restore(); h.restore();
  // glints on the scales near the crown of each hump
  for (const s of [0.36, 0.4, 0.44, 0.47, 0.66, 0.7, 0.74]) {
    const i = at(acc[n - 1] * s + r.range(-12, 12)); const off = r.range(-6, 30);
    const x = P[i][0] + nor[i][0] * off, y = P[i][1] + nor[i][1] * off;
    const q = a.polar(x, y);
    glint(q.theta, q.dr, 0, 0, r.range(14, 26), 0.9);
  }
}

/** the flat coffered ceiling (天花) around the well, sunk in darkness: concentric rings of panels, lit only by spill from the rim */
function buildBack(env) {
  const a = env.arc, T = a.span(PAD + 220);
  return L.makeLayer(PAD, (g) => {
    const full = () => g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    g.fillStyle = '#020307'; full();
    g.save(); a.clipAbove(g, 0);
    g.fillStyle = '#0b2b27'; full();                       // the ceiling battens (支条)
    const dth = (PITCH / a.R) * 1.5;
    const rings = [[30, 204], [232, 436], [466, 730]];
    const n = Math.ceil(T / dth) + 1;
    rings.forEach(([d0, d1], k) => {
      const off = (k % 2) * 0.5;
      for (let i = -n; i <= n; i++) {
        const th = (i + off) * dth, r0 = a.R + d0, m = 14;
        const t0 = th - dth / 2 + m / r0, t1 = th + dth / 2 - m / r0;
        a.pathBand(g, d1, d0, t0, t1); g.fillStyle = '#12584a'; g.fill();
        g.strokeStyle = 'rgba(227,179,65,0.85)'; g.lineWidth = 2.4; g.stroke();
        a.pathBand(g, d1 - 10, d0 + 10, t0 + 10 / r0, t1 - 10 / r0); g.strokeStyle = 'rgba(130,210,180,0.7)'; g.lineWidth = 3; g.stroke();
        // roundel (圆光)
        const c = a.pt(th, (d0 + d1) / 2), rr = Math.min(d1 - d0, dth * r0) * 0.34;
        g.fillStyle = L.radial(g, c.x, c.y, 0, rr, [[0, '#2a5cc0'], [0.7, '#1a3f94'], [1, '#10286a']]); g.beginPath(); g.arc(c.x, c.y, rr, 0, L.TAU); g.fill();
        g.strokeStyle = 'rgba(240,196,84,0.95)'; g.lineWidth = 3.2; g.stroke();
        g.lineWidth = 1.6; g.beginPath(); g.arc(c.x, c.y, rr * 0.8, 0, L.TAU); g.stroke();
        g.lineWidth = 2.2; g.beginPath(); g.arc(c.x, c.y, rr * 0.42, 0, L.TAU); g.stroke();
        for (let q = 0; q < 8; q++) { const ang = th + q * L.TAU / 8; g.fillStyle = 'rgba(240,196,84,0.95)'; g.beginPath(); g.arc(c.x + rr * 0.61 * Math.cos(ang), c.y + rr * 0.61 * Math.sin(ang), 4, 0, L.TAU); g.fill(); }
      }
    });
    // aged surface
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.7;
    g.drawImage(L.noiseLayer(PAD, { seed: 's06ceil', scale: 120, octaves: 4, warp: 0.6, res: 0.25, ramp: [[0, '#3a3a3a'], [0.6, '#ffffff'], [1, '#ffffff']] }), -PAD, -PAD);
    // light falls off fast away from the well; a hair of shadow right behind the rim keeps the arc crisp
    g.globalAlpha = 1;
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R, a.R + 760, [[0, '#000'], [0.008, '#000'], [0.035, '#3c4254'], [0.09, '#262a38'], [0.2, '#10121a'], [0.4, '#040506'], [1, '#000']]); full();
    // the well's glow breathing out over the rim: cool haze + a tight gold halo
    g.globalCompositeOperation = 'screen';
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R, a.R + 320, [[0, 'rgba(34,84,225,0.54)'], [0.07, 'rgba(28,68,190,0.32)'], [0.2, 'rgba(20,46,140,0.16)'], [0.5, 'rgba(10,24,80,0.05)'], [1, 'rgba(0,0,0,0)']]); full();
    g.restore();
  });
}

function starSprite() {
  const c = L.makeCanvas(128, 128), g = c.getContext('2d');
  g.translate(64, 64);
  g.fillStyle = L.radial(g, 0, 0, 0, 60, [[0, 'rgba(255,251,230,1)'], [0.07, 'rgba(255,238,176,0.9)'], [0.28, 'rgba(255,200,90,0.2)'], [1, 'rgba(255,180,60,0)']]);
  g.fillRect(-64, -64, 128, 128);
  g.globalCompositeOperation = 'lighter';
  for (const rot of [0, Math.PI / 2]) {
    g.save(); g.rotate(rot);
    g.fillStyle = L.linear(g, -62, 0, 62, 0, [[0, 'rgba(255,240,190,0)'], [0.5, 'rgba(255,251,232,0.95)'], [1, 'rgba(255,240,190,0)']]);
    g.beginPath(); g.moveTo(-62, 0); g.quadraticCurveTo(0, -3.4, 62, 0); g.quadraticCurveTo(0, 3.4, -62, 0); g.fill();
    g.restore();
  }
  return c;
}

export default {
  name: '藻井',
  tone: 'light',
  init(env) {
    const { col, bloom, glints } = buildCaisson(env);
    S = { col, bloom, glints, back: buildBack(env), star: starSprite() };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.004, 0.004, p), zoom = L.lerp(1.0, 1.014, p);
    const f = p * (env.frames - 1);
    L.blit(ctx, env, S.back, { rot, zoom });
    L.blit(ctx, env, S.col, { rot, zoom });
    L.blit(ctx, env, S.bloom, { rot, zoom, blend: 'screen', alpha: 0.4 });
    // a soft sheen sliding along the bracket frieze
    const sh = a.pt(L.lerp(-0.2, -0.06, p), -70);
    L.glow(ctx, sh.x, sh.y, 520, '#a9c8ff', 0.15);
    // …and a hot spot riding the gilt rim itself
    const hs = a.pt(L.lerp(-0.105, -0.045, p), -7);
    ctx.save(); a.clipBelow(ctx, 1.5);                       // keep it inside the rim so the arc stays a hard edge
    L.glow(ctx, hs.x, hs.y, 300, '#ffd98a', 0.16);
    L.glow(ctx, hs.x, hs.y, 90, '#ffe9a8', 0.45);
    ctx.restore();
    // gold leaf catching the light: glints that flare and die from frame to frame
    L.cam(ctx, env, { rot, zoom }, () => {
      ctx.globalCompositeOperation = 'lighter';
      for (const q of S.glints) {
        const k = Math.pow(Math.max(0, Math.sin(q.ph + f * q.sp)), 2.4) * q.a * L.clamp(1 + q.dr / 620, 0.25, 1);
        if (k < 0.04) continue;
        const s = q.s * (0.55 + 0.7 * k);
        ctx.globalAlpha = Math.min(1, k);
        ctx.drawImage(S.star, q.x - s, q.y - s, s * 2, s * 2);
      }
    });
    L.vignette(ctx, { strength: 0.42, inner: 0.5 });
  },
};
