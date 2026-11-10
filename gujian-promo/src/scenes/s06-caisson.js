// s06 — 藻井. Looking straight up into a round caisson ceiling: the arc is the gilt rim of its outermost ring.
// Below the arc the well steps inward ring by ring — a frieze of blue/green bracket sets (斗拱), a blue band of
// gold clouds, green panels between gold ribs with gilt bosses, then the dark well wall and a glimpse of the
// coiled dragon. Everything is concentric with the arc, so the tiny `rot` just slides detail along it.
// Recipe: draw colour + a greyscale height map side by side → local relief lighting → pigment mottle, craquelure,
// inward fall-off → bloom + twinkling gold glints at draw time.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 200;
let S = null;

const GOLD = '#e3b341', GOLD_H = '#fff0b0', GOLD_M = '#c9962e';
const BLUE = { d: '#102c72', m: '#1f4ea3', l: '#5b90e4', w: '#e6efff' };
const GREEN = { d: '#0b5440', m: '#1f8f6a', l: '#66cfa2', w: '#eafff3' };
const grey = (v) => { v = Math.round(L.clamp(v, 0, 255)); return `rgb(${v},${v},${v})`; };

// radial layout (dr, px): outer edge → inner edge of each ring
const RIM = -14;                 // gilt rim moulding 0 → -14
const R1 = [-14, -124];          // bracket sets
const SA = [-124, -158];         // gilt fillets + bead course
const R2 = [-158, -244];         // gold clouds on ultramarine
const SB = [-244, -262];
const R3 = [-262, -356];         // ribs + bosses on malachite green
const SC = [-356, -374];
const PITCH = 132;               // bracket-set spacing along the rim (px)

/** local relief lighting: height map (white = high) → { shade (overlay, 128 = flat), spec (screen) }. (lx,ly) points TOWARD the light. */
function relief(height, { lx = -0.6, ly = -0.8, strength = 2.0, blur = 1.2, res = 0.5, specAt = 46, specSpan = 80 } = {}) {
  const w = height.width, hh = height.height;
  const cw = Math.round(w * res), ch = Math.round(hh * res);
  const tmp = L.makeCanvas(cw, ch); const tg = tmp.getContext('2d', { willReadFrequently: true });
  if (blur) tg.filter = `blur(${blur * res}px)`;
  tg.drawImage(height, 0, 0, cw, ch);
  tg.filter = 'none';
  const src = tg.getImageData(0, 0, cw, ch).data;
  const sh = new ImageData(cw, ch), sp = new ImageData(cw, ch);
  const so = sh.data, po = sp.data;
  const row = cw * 4;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const i = (y * cw + x) * 4;
    const gx = src[x < cw - 1 ? i + 4 : i] - src[x > 0 ? i - 4 : i];
    const gy = src[y < ch - 1 ? i + row : i] - src[y > 0 ? i - row : i];
    const d = -(gx * lx + gy * ly) * strength;
    const s = 128 + d;
    so[i] = so[i + 1] = so[i + 2] = s < 0 ? 0 : s > 255 ? 255 : s; so[i + 3] = 255;
    const k = (d - specAt) / specSpan;
    po[i] = 255; po[i + 1] = 238; po[i + 2] = 186; po[i + 3] = k <= 0 ? 0 : k >= 1 ? 255 : k * 255;
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
  const col = L.makeLayer(PAD), hgt = L.makeLayer(PAD);
  const g = col.getContext('2d'), h = hgt.getContext('2d');
  const glints = [];
  const r = L.rng('s06');
  const full = (c) => c.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
  const rg = (c, drIn, drOut, stops) => L.radial(c, a.cx, a.cy, a.R + drIn, a.R + drOut, stops);
  const band = (c, dr0, dr1, style) => { c.fillStyle = style; a.pathBand(c, dr0, dr1, -T, T); c.fill(); };
  /** run fn in the local frame at (theta, dr) on BOTH the colour and the height context */
  const at2 = (theta, dr, fn) => {
    const p = a.pt(theta, dr);
    for (const c of [g, h]) { c.save(); c.translate(p.x, p.y); c.rotate(theta); }
    fn();
    g.restore(); h.restore();
  };
  /** frame position of a local point (x along the arc, y inward) → for glints */
  const world = (theta, dr, x = 0, y = 0) => { const p = a.pt(theta + x / (a.R + dr - y), dr - y); return p; };
  const glint = (theta, dr, x, y, s, amp = 1) => { const p = world(theta, dr, x, y); glints.push({ x: p.x, y: p.y, s, a: amp, ph: r.range(0, L.TAU), sp: r.range(1.1, 2.1), dr: dr - y }); };

  /** a gilt fillet: rounded gold moulding between dr0 (outer) and dr1 (inner) */
  const goldBand = (dr0, dr1, hv = 215) => {
    band(g, dr0, dr1, rg(g, dr1, dr0, [[0, '#583508'], [0.2, '#b07c22'], [0.48, GOLD], [0.7, GOLD_H], [0.86, '#ecc45c'], [1, '#93661a']]));
    band(h, dr0, dr1, rg(h, dr1, dr0, [[0, grey(hv - 110)], [0.5, grey(hv)], [1, grey(hv - 110)]]));
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
    trace(g); g.strokeStyle = pal.m; g.lineWidth = 13 * k; g.stroke();
    trace(g); g.strokeStyle = pal.l; g.lineWidth = 8 * k; g.stroke();
    trace(g); g.strokeStyle = pal.w; g.lineWidth = 4.4 * k; g.stroke();
    g.restore();
    g.save(); g.lineJoin = 'round';
    trace(g); g.strokeStyle = '#a9781f'; g.lineWidth = 2.6; g.stroke();
    g.translate(-0.4, -0.5); trace(g); g.strokeStyle = '#f3cf68'; g.lineWidth = 1.3; g.stroke();
    g.restore();
    trace(h); h.fillStyle = grey(hv); h.fill();
  };

  // ───────── base: everything below the arc ─────────
  g.save(); a.clipBelow(g, 0); g.fillStyle = '#04060c'; full(g); g.restore();
  h.fillStyle = '#000'; full(h);
  h.save(); a.clipBelow(h, 0); h.fillStyle = grey(52); full(h); h.restore();

  // ───────── ring 1: 垫拱板 (vermilion boards) in shadow behind the bracket sets ─────────
  band(g, R1[0], R1[1], rg(g, R1[1], R1[0], [[0, '#03040a'], [0.3, '#12060a'], [0.55, '#4a110a'], [0.82, '#96281a'], [1, '#b03320']]));
  const dth1 = PITCH / a.R;
  const n1 = Math.ceil(T / dth1) + 1;
  // a small gold flaming pearl on each board, between two bracket sets
  for (let i = -n1; i <= n1; i++) {
    at2((i + 0.5) * dth1, R1[0], () => {
      g.fillStyle = 'rgba(40,6,2,0.55)'; g.beginPath(); g.ellipse(1.5, 25, 9, 9, 0, 0, L.TAU); g.fill();
      g.fillStyle = GOLD_M; g.beginPath(); g.moveTo(-7.5, 24); g.quadraticCurveTo(-9, 38, 0, 50); g.quadraticCurveTo(9, 38, 7.5, 24); g.closePath(); g.fill();
      g.fillStyle = L.radial(g, -2, 20, 0.5, 9, [[0, '#fff6cf'], [0.35, GOLD], [1, '#8a5c16']]);
      g.beginPath(); g.arc(0, 22, 7.5, 0, L.TAU); g.fill();
      h.fillStyle = L.radial(h, 0, 22, 0, 8, [[0, grey(150)], [1, grey(70)]]); h.beginPath(); h.arc(0, 22, 8, 0, L.TAU); h.fill();
    });
  }
  // the bracket sets, drawn in elevation: cap block on the rim, arms stepping wider toward the well
  const dou = (x, y0, y1, wSeat, wBody) => (c) => {
    const ym = y0 + (y1 - y0) * 0.42;
    c.beginPath(); c.moveTo(x - wSeat / 2, y0); c.lineTo(x + wSeat / 2, y0); c.lineTo(x + wBody / 2, ym); c.lineTo(x + wBody / 2, y1); c.lineTo(x - wBody / 2, y1); c.lineTo(x - wBody / 2, ym); c.closePath();
  };
  const gong = (y0, y1, hw) => (c) => {
    const k = Math.min(13, hw * 0.3), m = y0 + (y1 - y0) * 0.62;
    c.beginPath(); c.moveTo(-hw, y1); c.lineTo(-hw, m); c.quadraticCurveTo(-hw + 1.5, y0, -hw + k, y0); c.lineTo(hw - k, y0); c.quadraticCurveTo(hw - 1.5, y0, hw, m); c.lineTo(hw, y1); c.closePath();
  };
  for (let i = -n1; i <= n1; i++) {
    const even = ((i % 2) + 2) % 2 === 0;
    const A = even ? BLUE : GREEN, B = even ? GREEN : BLUE;
    at2(i * dth1, R1[0], () => {
      yun(gong(81, 96, 59), B, 150);
      for (const x of [-50, -25, 0, 25, 50]) yun(dou(x, 96, 108.5, 13, 19), A, 138, 0.72, false);
      yun(gong(54, 69, 49), B, 176);
      for (const x of [-41, 0, 41]) yun(dou(x, 69, 81, 13, 19), A, 162, 0.72, false);
      yun(gong(27, 42, 35), B, 204);
      for (const x of [-27, 0, 27]) yun(dou(x, 42, 54, 13, 19), A, 190, 0.72, false);
      yun(dou(0, 3, 27, 34, 52), A, 228);
    });
    if (r.chance(0.55)) glint(i * dth1, R1[0], r.pick([-26, 26]), 12, r.range(16, 30), 0.9);
    if (r.chance(0.4)) glint(i * dth1, R1[0], r.pick([-59, 59, -49, 49]), r.pick([82, 55]), r.range(12, 22), 0.7);
  }

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
    });
    if (r.chance(0.09)) glint(q.theta, beadDr, -2, -2, r.range(10, 18), 0.8);
  });
  goldBand(SA[1] + 7, SA[1]);

  // ───────── ring 2: gold ruyi clouds on ultramarine ─────────
  band(g, R2[0], R2[1], rg(g, R2[1], R2[0], [[0, '#0c2466'], [0.18, '#1a44a0'], [0.55, '#2457b8'], [0.85, '#1b469f'], [1, '#0a1c54']]));
  band(h, R2[0], R2[1], grey(70));
  g.lineWidth = 3; g.strokeStyle = L.rgba(BLUE.l, 0.85); a.stroke(g, R2[0] - 6, -T, T); a.stroke(g, R2[1] + 6, -T, T);
  g.lineWidth = 1.3; g.strokeStyle = L.rgba(BLUE.w, 0.85); a.stroke(g, R2[0] - 3.4, -T, T); a.stroke(g, R2[1] + 3.4, -T, T);
  const strokePts = (c, P, ox = 0, oy = 0) => { c.beginPath(); c.moveTo(P[0][0] + ox, P[0][1] + oy); for (let i = 1; i < P.length; i++) c.lineTo(P[i][0] + ox, P[i][1] + oy); c.stroke(); };
  const halo = (P, w) => {
    g.lineCap = g.lineJoin = 'round';
    g.strokeStyle = L.rgba(BLUE.l, 0.55); g.lineWidth = w + 10; strokePts(g, P);
    g.strokeStyle = L.rgba(BLUE.w, 0.6); g.lineWidth = w + 4.5; strokePts(g, P);
  };
  const goldLine = (P, w, hv = 200) => {
    g.lineCap = g.lineJoin = 'round'; h.lineCap = h.lineJoin = 'round';
    g.strokeStyle = 'rgba(3,8,34,0.6)'; g.lineWidth = w + 1.6; strokePts(g, P, 1.2, 2.2);
    g.strokeStyle = GOLD_M; g.lineWidth = w; strokePts(g, P);
    g.strokeStyle = '#f8dc7c'; g.lineWidth = w * 0.48; strokePts(g, P, -0.5, -0.7);
    h.strokeStyle = grey(hv); h.lineWidth = w; strokePts(h, P);
  };
  // one ruyi-headed cloud: two inward spirals meeting at a notch, with trailing wisps
  const cloudPaths = [];
  for (const sx of [-1, 1]) {
    const sp = [];
    for (let k = 0; k <= 54; k++) {
      const t = k / 54, ang = L.deg(-30 - 570 * t), rad = L.lerp(21.5, 3.2, Math.pow(t, 0.85));
      sp.push([sx * (-19.5 + rad * Math.cos(ang)), -4 + rad * Math.sin(ang)]);
    }
    cloudPaths.push({ P: sp, w: 4.6 });
    cloudPaths.push({ P: L.smoothPath([[-5, 16], [-21, 25.5], [-41, 26], [-57, 18], [-65.5, 6], [-60, -2.5], [-54, 2]].map(([x, y]) => [sx * x, y]), 2.5), w: 4 });
    cloudPaths.push({ P: L.smoothPath([[-1, 26], [-15, 34.5], [-32, 36], [-46, 31]].map(([x, y]) => [sx * x, y]), 2.5), w: 3 });
  }
  const dth2 = dth1 * 1.25;
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
        g.fillStyle = L.rgba(BLUE.w, 0.55); g.beginPath(); g.arc(x, y, rad + 2.6, 0, L.TAU); g.fill();
        g.fillStyle = L.radial(g, x - 1, y - 1, 0.2, rad + 1, [[0, '#fff6cf'], [0.4, GOLD], [1, '#8a5c16']]); g.beginPath(); g.arc(x, y, rad, 0, L.TAU); g.fill();
        h.fillStyle = grey(190); h.beginPath(); h.arc(x, y, rad, 0, L.TAU); h.fill();
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
  const dth3 = dth1 * (2 / 3);
  const n3 = Math.ceil(T / dth3) + 1;
  const d3 = R3[0] - R3[1];
  for (let i = -n3; i <= n3; i++) {
    const wTop = dth3 * (a.R + R3[0]), wBot = dth3 * (a.R + R3[1]);
    at2(i * dth3, R3[0], () => {
      const x0 = (wTop - 14) / 2 - 2.5, x1 = (wBot - 12) / 2 - 2.5;
      yun((c) => { c.beginPath(); c.moveTo(-x0, 4); c.lineTo(x0, 4); c.lineTo(x1, d3 - 4); c.lineTo(-x1, d3 - 4); c.closePath(); }, GREEN, 96, 1.15, false);
      // boss: thin gilt ring + domed gilt stud
      const cy = d3 / 2;
      g.strokeStyle = 'rgba(2,20,14,0.6)'; g.lineWidth = 3; g.beginPath(); g.arc(1, cy + 1.6, 22, 0, L.TAU); g.stroke();
      g.strokeStyle = GOLD_M; g.lineWidth = 2.4; g.beginPath(); g.arc(0, cy, 22, 0, L.TAU); g.stroke();
      g.strokeStyle = '#f8dc7c'; g.lineWidth = 1; g.beginPath(); g.arc(-0.4, cy - 0.6, 22, 0, L.TAU); g.stroke();
      g.fillStyle = 'rgba(2,16,12,0.7)'; g.beginPath(); g.arc(2.5, cy + 4, 16.5, 0, L.TAU); g.fill();
      g.fillStyle = L.radial(g, -5, cy - 6, 0.6, 21, [[0, '#fffbe2'], [0.16, '#ffe9a0'], [0.42, GOLD], [0.78, '#99691c'], [1, '#4a2d06']]);
      g.beginPath(); g.arc(0, cy, 15.5, 0, L.TAU); g.fill();
      h.strokeStyle = grey(170); h.lineWidth = 2.4; h.beginPath(); h.arc(0, cy, 22, 0, L.TAU); h.stroke();
      h.fillStyle = L.radial(h, 0, cy, 0, 16, [[0, grey(255)], [0.55, grey(215)], [1, grey(110)]]); h.beginPath(); h.arc(0, cy, 16, 0, L.TAU); h.fill();
    });
    glint(i * dth3, R3[0], -5, d3 / 2 - 6, r.range(16, 30), 1);
    // rib
    at2((i + 0.5) * dth3, R3[0], () => {
      const trace = (c) => { c.beginPath(); c.moveTo(-7, 0); c.lineTo(7, 0); c.lineTo(6, d3); c.lineTo(-6, d3); c.closePath(); };
      g.fillStyle = 'rgba(2,16,12,0.55)'; g.beginPath(); g.moveTo(-5, 0); g.lineTo(11, 0); g.lineTo(10, d3); g.lineTo(-4, d3); g.closePath(); g.fill();
      trace(g); g.fillStyle = L.linear(g, -7, 0, 7, 0, [[0, '#6a430c'], [0.2, '#d6a436'], [0.38, GOLD_H], [0.55, GOLD], [0.82, '#a97620'], [1, '#553407']]); g.fill();
      trace(h); h.fillStyle = L.linear(h, -7, 0, 7, 0, [[0, grey(110)], [0.5, grey(210)], [1, grey(110)]]); h.fill();
    });
  }

  // ───────── separator C ─────────
  goldBand(SC[0], SC[0] - 6);
  band(g, SC[0] - 6, SC[1] + 6, rg(g, SC[1] + 6, SC[0] - 6, [[0, '#0a1a48'], [0.5, '#1f4ea3'], [1, '#0a1a48']]));
  band(h, SC[0] - 6, SC[1] + 6, grey(120));
  goldBand(SC[1] + 6, SC[1]);

  // ───────── the well wall: deep blue-green, a course of lotus lappets, and the dragon ─────────
  band(g, SC[1], -1300, rg(g, -760, SC[1], [[0, '#020a12'], [0.55, '#072433'], [1, '#0d3c4c']]));
  band(h, SC[1], -1300, grey(40));
  for (let i = -n3; i <= n3; i++) {
    at2((i + 0.5) * dth3, SC[1], () => {
      const hw = dth3 * (a.R + SC[1]) / 2 - 2;
      yun((c) => { c.beginPath(); c.moveTo(-hw, 0); c.quadraticCurveTo(-hw, 22, 0, 31); c.quadraticCurveTo(hw, 22, hw, 0); c.closePath(); }, i % 2 ? BLUE : GREEN, 84, 1, false);
    });
  }
  drawDragon(g, h, a, glint, r);

  // ───────── the gilt rim: its top edge IS the arc ─────────
  goldBand(0, RIM, 240);
  g.strokeStyle = 'rgba(60,34,4,0.75)'; g.lineWidth = 1.4; a.stroke(g, RIM + 0.4, -T, T);
  a.along({ spacing: 58, dr: -5, t0: -T, t1: T }, (q) => { if (r.chance(0.5)) glint(q.theta + r.range(-0.006, 0.006), -5, 0, 0, r.range(18, 40), 1); });

  // ───────── light & age (only where the caisson is) ─────────
  const { shade, spec } = relief(hgt, { strength: 2.1, blur: 1.3, res: 0.5 });
  g.save(); a.clipBelow(g, 0);
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.92; g.drawImage(shade, -PAD, -PAD);
  // mineral pigment: mottled, slightly streaked along the rings
  g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.62;
  g.drawImage(L.polarNoiseLayer(env, PAD, { seed: 's06mottle', scale: 26, sx: 1.8, sy: 1, octaves: 4, contrast: 1.8, res: 0.4 }), -PAD, -PAD);
  // broad wear / soot
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.5;
  g.drawImage(L.noiseLayer(PAD, { seed: 's06wear', scale: 210, octaves: 4, warp: 0.7, res: 0.25, ramp: [[0, '#2e2a26'], [0.44, '#ffffff'], [1, '#ffffff']] }), -PAD, -PAD);
  // craquelure: a fine network of cracks, with a lit lip on one side
  const crack = L.noiseLayer(PAD, { seed: 's06crack', scale: 38, octaves: 1, warp: 0.55, warpScale: 1.6, ridged: true, res: 0.6,
    ramp: [[0, 'rgba(2,4,10,0)'], [0.9, 'rgba(2,4,10,0)'], [0.965, 'rgba(2,4,10,0.8)'], [1, 'rgba(2,4,10,0.95)']] });
  g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.22; g.filter = 'invert(1)'; g.drawImage(crack, -PAD + 1.3, -PAD + 1.5); g.filter = 'none';
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 0.5; g.drawImage(crack, -PAD, -PAD);
  // glancing highlights on every raised edge
  g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.75; g.drawImage(spec, -PAD, -PAD);
  // the well darkens as it climbs away from us; shadows go cool
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = 1;
  g.fillStyle = rg(g, -640, 0, [[0, '#161a26'], [0.28, '#343a4c'], [0.44, '#5e6476'], [0.62, '#a3a6b0'], [0.8, '#e2e3e8'], [0.95, '#ffffff'], [1, '#ffffff']]); full(g);
  g.fillStyle = L.linear(g, -PAD, 0, W + PAD, 0, [[0, '#8f93a0'], [0.3, '#f4f4f6'], [0.45, '#ffffff'], [0.7, '#e6e7ec'], [1, '#70748a']]); full(g);
  // cool sheen gathered under the rim
  g.globalCompositeOperation = 'screen';
  g.fillStyle = rg(g, -190, 0, [[0, 'rgba(110,160,255,0)'], [0.6, 'rgba(110,160,255,0.07)'], [1, 'rgba(170,205,255,0.2)']]); full(g);
  g.restore();

  return { col, glints };
}

/** a glimpse of the coiled dragon in the crown of the well: two humps of scaled, gilt body rising into frame */
function drawDragon(g, h, a, glint, r) {
  const ctrl = [[230, 1330], [390, 1168], [535, 1072], [690, 1026], [830, 1024], [945, 1064], [1035, 1136], [1105, 1160], [1190, 1108], [1290, 1056], [1400, 1054], [1505, 1102], [1620, 1200], [1730, 1330]];
  const P = L.smoothPath(ctrl, 4);
  const n = P.length, HW = 46;
  const nor = [], tan = [], acc = [0];
  for (let i = 0; i < n; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[Math.min(n - 1, i + 1)];
    let tx = p1[0] - p0[0], ty = p1[1] - p0[1]; const m = Math.hypot(tx, ty) || 1; tx /= m; ty /= m;
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
  }
  g.save(); g.shadowColor = 'rgba(0,0,0,0.85)'; g.shadowBlur = 24; g.shadowOffsetY = 9; body(g); g.fillStyle = '#4a2f08'; g.fill(); g.restore();
  body(h); h.fillStyle = grey(80); h.fill();
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
  for (const [e, k] of [[up, 1], [dn, -1]]) {
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
        // a coiled gold squiggle standing in for the roundel's dragon
        g.lineWidth = 4; g.lineCap = 'round'; g.beginPath();
        for (let q = 0; q <= 40; q++) { const t = q / 40, ang = th + t * 7.4, rad = rr * (0.62 - 0.5 * t); const x = c.x + rad * Math.cos(ang), y = c.y + rad * Math.sin(ang); if (q) g.lineTo(x, y); else g.moveTo(x, y); }
        g.stroke();
      }
    });
    // aged surface
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.7;
    g.drawImage(L.noiseLayer(PAD, { seed: 's06ceil', scale: 120, octaves: 4, warp: 0.6, res: 0.25, ramp: [[0, '#3a3a3a'], [0.6, '#ffffff'], [1, '#ffffff']] }), -PAD, -PAD);
    // light falls off fast away from the well; a hair of shadow right behind the rim keeps the arc crisp
    g.globalAlpha = 1;
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R, a.R + 760, [[0, '#000'], [0.006, '#000'], [0.04, '#687088'], [0.11, '#454b60'], [0.3, '#171a26'], [0.6, '#050608'], [1, '#000']]); full();
    // the well's glow breathing out over the rim: cool haze + a tight gold halo
    g.globalCompositeOperation = 'screen';
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R, a.R + 320, [[0, 'rgba(44,90,190,0.5)'], [0.1, 'rgba(34,72,160,0.3)'], [0.42, 'rgba(16,34,90,0.1)'], [1, 'rgba(0,0,0,0)']]); full();
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R, a.R + 36, [[0, 'rgba(255,214,120,0.55)'], [1, 'rgba(255,200,90,0)']]); full();
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
    const { col, glints } = buildCaisson(env);
    S = { col, glints, back: buildBack(env), bloom: L.filtered(col, 'blur(13px) saturate(1.25)'), star: starSprite() };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.004, 0.004, p), zoom = L.lerp(1.0, 1.014, p);
    const f = p * (env.frames - 1);
    L.blit(ctx, env, S.back, { rot, zoom });
    L.blit(ctx, env, S.col, { rot, zoom });
    L.blit(ctx, env, S.bloom, { rot, zoom, blend: 'screen', alpha: 0.42 });
    // a soft sheen sliding along the bracket frieze
    const sh = a.pt(L.lerp(-0.2, -0.06, p), -70);
    L.glow(ctx, sh.x, sh.y, 520, '#a9c8ff', 0.15);
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
