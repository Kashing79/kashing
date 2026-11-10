// s10 — 徽派马头墙. A cluster of Huizhou gable walls under a flat teal sky: whitewashed, rain-streaked,
// capped with dark 小青瓦. Every tier's upturned 鹊尾 tip touches the shared arc, so the stepped wall-heads
// rise toward the centre like saw-teeth riding the curve. Behind them a hazy 青山 carries the arc itself as one
// unbroken edge against the sky; dark tiled roofs close the bottom of the frame.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 240;
const LW = W + PAD * 2, LH = H + PAD * 2;
const BOTTOM = H + PAD + 10;
// nothing but sky lives above frame row Y0, so the big procedural textures only cover the rows below it (halves init time)
const Y0 = 540, TEXH = LH - (Y0 + PAD);
const tex = (opts) => L.noiseTex(LW, TEXH, { ...opts, oy: Y0 + PAD });
let S = null;

const COL = { sky: '#3fb0c8', wall: '#ece9e1', stain: '#8f918e', tile: '#2e2f33', brick: '#6f7478' };

// anatomy of a wall cap at scale 1 (px): horn overshoot, corbel overhang, horn lift, ridge / tile slope / eave-brick heights
const HORN = 19, OV = 18, LIFT = 11, RH = 6, TH = 14, EH = 6, CAPH = RH + TH + EH;

// ───────────────────────── geometry ─────────────────────────
/** symmetric gable (三叠 / 五叠): offs = half-distances of the tips from the centre line, ascending */
function symTiers(a, k, offs) {
  const y = (o) => a.yAt(a.cx + o) + LIFT * k;
  const c = { xa: a.cx - offs[0] + HORN * k, xb: a.cx + offs[0] - HORN * k, y: y(offs[0]), tipL: true, tipR: true };
  c.bL = c.xa + OV * k; c.bR = c.xb - OV * k;
  const left = [], right = [];
  let pl = c, pr = c;
  for (let i = 1; i < offs.length; i++) {
    const tl = { xa: a.cx - offs[i] + HORN * k, xb: pl.bL, y: y(-offs[i]), tipL: true, tipR: false };
    tl.bL = tl.xa + OV * k; tl.bR = tl.xb; left.unshift(tl); pl = tl;
    const tr = { xa: pr.bR, xb: a.cx + offs[i] - HORN * k, y: y(offs[i]), tipL: false, tipR: true };
    tr.bL = tr.xa; tr.bR = tr.xb - OV * k; right.push(tr); pr = tr;
  }
  return [...left, c, ...right];
}
/** one-sided run of tiers stepping down away from the centre. tips = signed offsets (inner → outer), inner = hidden inner end */
function sideTiers(a, k, tips, inner) {
  const dir = Math.sign(tips[0]);
  const out = [];
  let prev = null;
  for (const o of tips) {
    const tipX = a.cx + o, y = a.yAt(tipX) + LIFT * k;
    let t;
    if (dir < 0) { t = { xa: tipX + HORN * k, xb: prev ? prev.bL : a.cx + inner, y, tipL: true, tipR: false }; t.bL = t.xa + OV * k; t.bR = t.xb; out.unshift(t); }
    else { t = { xa: prev ? prev.bR : a.cx + inner, xb: tipX - HORN * k, y, tipL: false, tipR: true }; t.bL = t.xa; t.bR = t.xb - OV * k; out.push(t); }
    prev = t;
  }
  return out;
}
function bodyPath(g, tiers, k) {
  g.beginPath();
  g.moveTo(tiers[0].bL, BOTTOM);
  for (const t of tiers) { const yt = t.y + (CAPH - 3) * k; g.lineTo(t.bL, yt); g.lineTo(t.bR, yt); }
  g.lineTo(tiers[tiers.length - 1].bR, BOTTOM);
  g.closePath();
}
function clearLayer(c) {
  const g = c.getContext('2d');
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, c.width, c.height); g.restore();
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  return g;
}

// ───────────────────────── shared materials ─────────────────────────
function buildTextures() {
  const T = {};
  const grain = L.grainTex(LW, TEXH, { seed: 's10pg', amount: 0.3 });
  // lime plaster: big damp mottling, mid blotches, trowel drag, fine grit
  T.plaster = L.makeLayer(PAD, (g) => {
    g.fillStyle = COL.wall; g.fillRect(-PAD, -PAD, LW, LH);
    g.globalCompositeOperation = 'multiply';
    g.drawImage(tex({ seed: 's10pa', scale: 420, octaves: 4, warp: 0.7, res: 0.2, ramp: [[0, '#d2d6d6'], [0.5, '#fbfaf8'], [1, '#ffffff']] }), -PAD, Y0);
    g.drawImage(tex({ seed: 's10pb', scale: 62, octaves: 4, res: 0.3, contrast: 1.5, ramp: [[0, '#e3e1db'], [0.5, '#fefdfb'], [1, '#ffffff']] }), -PAD, Y0);
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.36;
    g.drawImage(tex({ seed: 's10pc', scale: 14, sx: 4, sy: 1, octaves: 3, res: 0.4, contrast: 1.7 }), -PAD, Y0);
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.5;
    g.drawImage(grain, -PAD, Y0);
  });
  // rain-wash: long vertical streaks of grey-black mildew (alpha map)
  T.streak = tex({ seed: 's10st', scale: 24, sx: 0.42, sy: 20, octaves: 4, gain: 0.55, contrast: 2.1, res: 0.5,
    ramp: [[0, L.rgba('#33383b', 0.92)], [0.24, L.rgba('#555b5d', 0.62)], [0.39, L.rgba(COL.stain, 0.22)], [0.5, L.rgba(COL.stain, 0)], [1, L.rgba(COL.stain, 0)]] });
  // green algae tint that lives inside the stains
  T.moss = tex({ seed: 's10ms', scale: 170, octaves: 4, warp: 0.8, res: 0.2,
    ramp: [[0, L.rgba('#4d6648', 0.6)], [0.36, L.rgba('#5f7a5a', 0.12)], [0.46, L.rgba('#5f7a5a', 0)], [1, L.rgba('#5f7a5a', 0)]] });
  // 青砖 behind it
  const bricks = L.makeCanvas(LW, TEXH);
  {
    const g = bricks.getContext('2d'); const r = L.rng('s10br');
    g.fillStyle = '#a9aba6'; g.fillRect(0, 0, LW, TEXH);
    const bh = 12, bl = 42;
    for (let row = 0, y = 0; y < TEXH; y += bh, row++) {
      const off = (row % 2) * bl / 2 + r.range(-3, 3);
      for (let x = -bl + off; x < LW; x += bl) {
        const t = r.range(-0.2, 0.16);
        g.fillStyle = r.chance(0.08) ? L.shade('#7b736a', t) : L.shade(COL.brick, t);
        g.fillRect(x + 1, y + 1, bl - 2, bh - 2);
      }
    }
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.6;
    g.drawImage(grain, 0, 0);
  }
  T.bricks = bricks;
  return T;
}

// ───────────────────────── wall cap (瓦帽 + 鹊尾) ─────────────────────────
function drawHorn(g, xe, y, k, dir, rh, th, lift, over = HORN) {
  const X = (u) => xe + dir * u * k, Y = (v) => y + v * k;
  g.fillStyle = '#25272a';
  g.beginPath(); g.moveTo(X(-50), Y(0)); g.quadraticCurveTo(X(-6), Y(0.8), X(over), Y(-lift));
  g.quadraticCurveTo(X(over * 0.34), Y(-0.5), X(-1), Y(rh + th * 0.5)); g.lineTo(X(-10), Y(rh + 1)); g.lineTo(X(-50), Y(rh)); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(X(-3), Y(rh)); g.lineTo(X(2.4), Y(rh + th + 2)); g.lineTo(X(-3), Y(rh + th + 2)); g.closePath(); g.fill();
  g.strokeStyle = dir < 0 ? 'rgba(232,238,242,0.96)' : 'rgba(196,206,214,0.85)'; g.lineWidth = Math.max(1.1, 1.5 * k); g.lineCap = 'round';
  g.beginPath(); g.moveTo(X(-50), Y(0.75)); g.quadraticCurveTo(X(-6), Y(1.55), X(over - 1.2), Y(-lift + 1.3)); g.stroke();
}
function drawCap(g, t, k, r) {
  const { xa, xb, y } = t;
  const yT = y + RH * k, yE = yT + TH * k, yB = y + CAPH * k;
  g.save();
  // 拔檐: plastered brick courses under the tiles, picked out with an ink line
  const ex0 = xa + (t.tipL ? 2 * k : 0), ex1 = xb - (t.tipR ? 2 * k : 0);
  g.fillStyle = '#e6e4dd'; g.fillRect(ex0, yE - 1, ex1 - ex0, EH * k + 1);
  g.fillStyle = L.linear(g, 0, yE, 0, yE + EH * k * 0.8, [[0, 'rgba(24,30,40,0.62)'], [1, 'rgba(24,30,40,0)']]);
  g.fillRect(ex0, yE, ex1 - ex0, EH * k);
  g.strokeStyle = 'rgba(38,41,46,0.82)'; g.lineWidth = Math.max(0.9, 1.1 * k);
  g.beginPath(); g.moveTo(ex0, yB); g.lineTo(ex1, yB); g.stroke();
  // 垛头: courses corbelled out under each free end
  const corbel = (dir, xe) => {
    const lit = dir < 0;
    for (let j = 0; j < 3; j++) {
      const out = xe - dir * (2 + j * 5.2) * k, inn = xe - dir * (OV + 3) * k;
      const y0 = j === 0 ? yE : yB + (j - 1) * 5 * k, hh = (j === 0 ? EH : 5) * k;
      g.fillStyle = lit ? (j === 0 ? '#eeece5' : '#e0ded7') : (j === 0 ? '#c0c3c2' : '#aeb2b3');
      g.fillRect(Math.min(out, inn), y0, Math.abs(inn - out), hh);
      g.strokeStyle = 'rgba(40,43,48,0.72)'; g.lineWidth = Math.max(0.8, k);
      g.beginPath(); g.moveTo(out, y0); g.lineTo(out, y0 + hh); g.lineTo(inn, y0 + hh); g.stroke();
    }
  };
  if (t.tipL) corbel(-1, xa);
  if (t.tipR) corbel(1, xb);
  // tile slope: 盖瓦 ridges with round 勾头 ends, pointed 滴水 between
  g.fillStyle = L.linear(g, 0, yT, 0, yE, [[0, '#34363b'], [1, '#1b1c1f']]);
  g.fillRect(xa, yT - 1, xb - xa, TH * k + 1);
  const pitch = 8.6 * k, cw = 4.9 * k;
  const n = Math.max(1, Math.floor((xb - xa - cw) / pitch));
  const x0 = xa + ((xb - xa) - n * pitch) / 2;
  for (let i = 0; i <= n; i++) {
    const c = x0 + i * pitch, tone = r.range(-0.1, 0.1);
    if (i < n) {
      g.fillStyle = L.shade('#474b51', tone);
      g.beginPath(); g.moveTo(c + cw / 2 - 0.5, yE - 0.5); g.lineTo(c + pitch - cw / 2 + 0.5, yE - 0.5); g.lineTo(c + pitch / 2, yE + 3.4 * k); g.closePath(); g.fill();
    }
    g.fillStyle = L.linear(g, c - cw / 2, 0, c + cw / 2, 0, [[0, L.shade('#232528', tone)], [0.28, L.shade('#838a92', tone)], [0.55, L.shade('#4d5157', tone)], [1, L.shade('#17181a', tone)]]);
    g.fillRect(c - cw / 2, yT, cw, TH * k);
    g.beginPath(); g.arc(c, yE, cw / 2, 0, Math.PI); g.fill();
  }
  g.strokeStyle = 'rgba(8,9,11,0.55)'; g.lineWidth = Math.max(0.7, 0.9 * k);
  for (const f of [0.34, 0.68]) { g.beginPath(); g.moveTo(xa, yT + TH * k * f); g.lineTo(xb, yT + TH * k * f); g.stroke(); }
  // ridge of upright tiles
  g.fillStyle = L.linear(g, 0, y, 0, yT, [[0, '#4a4e54'], [0.35, '#2b2d31'], [1, '#1a1b1e']]);
  g.fillRect(xa, y, xb - xa, RH * k);
  g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = Math.max(0.6, 0.8 * k);
  g.beginPath(); for (let x = xa + 2 * k; x < xb; x += 3.1 * k) { g.moveTo(x, y + 1.2 * k); g.lineTo(x - 1.2 * k, yT); } g.stroke();
  g.strokeStyle = 'rgba(226,233,238,0.95)'; g.lineWidth = Math.max(1.1, 1.5 * k);
  g.beginPath(); g.moveTo(xa, y + 0.75 * k); g.lineTo(xb, y + 0.75 * k); g.stroke();
  // cushions of moss in the tile joints and along the eave
  const greens = ['#4d6a38', '#6c8a44', '#3a5030', '#8aa258', '#5b7440'];
  for (let c = 0, nc = Math.max(1, Math.round((xb - xa) / (95 * k))); c < nc; c++) {
    const mx = r.range(xa + 6 * k, xb - 6 * k), sp = r.range(8, 26) * k, cnt = r.int(5, 16);
    for (let i = 0; i < cnt; i++) {
      const px = L.clamp(mx + r.gauss() * sp, xa + 2, xb - 2), py = r.chance(0.25) ? y + r.range(0, 2) * k : r.range(yT + 2 * k, yE + 2.5 * k);
      g.globalAlpha = r.range(0.45, 0.9); g.fillStyle = r.pick(greens);
      g.beginPath(); g.ellipse(px, py, r.range(0.8, 2.3) * k, r.range(0.6, 1.5) * k, 0, 0, L.TAU); g.fill();
    }
  }
  g.globalAlpha = 1;
  if (t.tipL) drawHorn(g, xa, y, k, -1, RH, TH, LIFT);
  if (t.tipR) drawHorn(g, xb, y, k, 1, RH, TH, LIFT);
  g.restore();
}

// ───────────────────────── weathering ─────────────────────────
function buildStains(tmp, T, tiers, k, r) {
  const g = clearLayer(tmp);
  for (const t of tiers) {
    const y0 = t.y + CAPH * k, len = r.range(190, 430) * k;
    g.fillStyle = L.linear(g, 0, y0, 0, y0 + len, [[0, 'rgba(0,0,0,1)'], [0.16, 'rgba(0,0,0,0.8)'], [0.5, 'rgba(0,0,0,0.3)'], [1, 'rgba(0,0,0,0.05)']]);
    g.fillRect(t.bL, y0 - 4, t.bR - t.bL, BOTTOM - y0);
  }
  // some stretches of wall stay clean, others are badly marked
  const nz = L.makeNoise('stx' + r.int(0, 9999));
  g.globalCompositeOperation = 'destination-out';
  const x0 = Math.floor(tiers[0].bL) - 2, x1 = tiers[tiers.length - 1].bR + 2;
  for (let x = x0; x < x1; x += 12) {
    const a = L.clamp(0.42 + 1.5 * nz.fbm(x / 230, 1.7, 3), 0, 0.95);
    g.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`; g.fillRect(x, -PAD, 12, LH);
  }
  g.globalCompositeOperation = 'source-in'; g.drawImage(T.streak, -PAD, Y0);
  g.globalCompositeOperation = 'source-atop'; g.drawImage(T.moss, -PAD, Y0);
  g.globalCompositeOperation = 'source-over';
}
function drawDrips(g, tiers, k, r) {
  g.save(); g.lineCap = 'round';
  for (const t of tiers) {
    const y0 = t.y + CAPH * k + 1.5 * k;
    const n = Math.round((t.bR - t.bL) / (19 * k));
    for (let i = 0; i < n; i++) {
      // water sheds hardest at the ends of a tier, under the 垛头
      let u = r(); if (r.chance(0.45)) u = r.chance(0.5) ? Math.pow(u, 3) * 0.3 : 1 - Math.pow(u, 3) * 0.3;
      const x = L.lerp(t.bL + 2, t.bR - 2, u);
      const len = (30 + 390 * Math.pow(r(), 2.2)) * k;
      const w = (1.2 + 14 * Math.pow(r(), 2.5)) * k;
      const col = r.chance(0.2) ? '#55634d' : (r.chance(0.5) ? '#3b4043' : '#585d5e');
      const a = r.range(0.08, 0.36);
      const strands = Math.max(2, Math.round(w * 0.9));
      for (let s = 0; s < strands; s++) {
        const sx = x + r.gauss() * w * 0.33, sl = len * r.range(0.45, 1), sw = r.range(0.8, 2.3) * k;
        g.strokeStyle = L.linear(g, 0, y0, 0, y0 + sl, [[0, L.rgba(col, a)], [0.3, L.rgba(col, a * 0.7)], [1, L.rgba(col, 0)]]);
        g.lineWidth = sw; g.beginPath(); g.moveTo(sx, y0); g.lineTo(sx + r.range(-1.5, 1.5), y0 + sl); g.stroke();
      }
    }
  }
  g.restore();
}
/** a wound where the lime plaster has fallen away and the grey brick shows */
function drawPatch(g, T, x, y, rad, r) {
  const n = r.int(8, 12), pts = [];
  const ax = r.range(0.9, 1.5), ay = r.range(0.6, 1.0), a0 = r.range(0, L.TAU);
  for (let i = 0; i < n; i++) {
    const ang = a0 + ((i + r.range(-0.3, 0.3)) / n) * L.TAU, rr = rad * r.range(0.55, 1.08);
    pts.push([x + Math.cos(ang) * rr * ax, y + Math.sin(ang) * rr * ay]);
  }
  const seed = r.int(1, 99999);
  const path = (dx, dy) => { g.save(); g.translate(dx, dy); L.roughPoly(g, pts, { rough: Math.min(3.2, rad * 0.09), seed, step: 7 }); g.restore(); };
  g.save();
  const big = rad > 16;
  // damp bloom around it, and what it weeps downwards
  if (big) {
  g.fillStyle = L.radial(g, x, y + rad * 0.3, rad * 0.5, rad * 2.1, [[0, 'rgba(88,94,94,0.26)'], [1, 'rgba(88,94,94,0)']]);
  g.fillRect(x - rad * 2.2, y - rad * 2, rad * 4.4, rad * 4.4);
  g.lineCap = 'round';
  for (let i = 0; i < Math.round(rad / 5); i++) {
    const sx = x + r.range(-1, 1) * rad * ax * 0.8, sl = r.range(30, 150) * (rad / 40);
    g.strokeStyle = L.linear(g, 0, y, 0, y + rad * ay + sl, [[0, 'rgba(70,76,78,0.34)'], [1, 'rgba(70,76,78,0)']]);
    g.lineWidth = r.range(1, 3.2); g.beginPath(); g.moveTo(sx, y); g.lineTo(sx + r.range(-2, 2), y + rad * ay + sl); g.stroke();
  }
  }
  // the lower-right lip of plaster catches the sun
  g.fillStyle = '#fffefa'; if (big) { path(1.3, 1.8); g.fill(); } else { g.globalAlpha = 0.7; path(1, 1.3); g.fill(); g.globalAlpha = 1; }
  // brick, with the upper-left lip throwing its shadow in
  path(0, 0); g.clip();
  const bx = Math.floor(x - rad * 1.8), by = Math.floor(y - rad * 1.4), bw = Math.ceil(rad * 3.6), bh = Math.ceil(rad * 2.8);
  g.drawImage(T.bricks, bx + PAD, by - Y0, bw, bh, bx, by, bw, bh);
  g.lineJoin = 'round';
  const sh = big ? 1 : 0.45;
  g.strokeStyle = 'rgba(12,16,22,0.34)'; g.lineWidth = 15 * sh; path(5 * sh, 7 * sh); g.stroke();
  g.strokeStyle = 'rgba(12,16,22,0.62)'; g.lineWidth = 7 * sh; path(2.6 * sh, 3.4 * sh); g.stroke();
  g.restore();
}
function drawPatches(g, T, tiers, k, r, spec) {
  for (const p of spec.patches || []) {
    drawPatch(g, T, p[0], p[1], p[2] * k, r);
    for (let i = 0, m = r.int(1, 3); i < m; i++) { // crumbs broken off beside it
      const ang = r.range(0, L.TAU), d = p[2] * k * r.range(1.3, 2.1);
      drawPatch(g, T, p[0] + Math.cos(ang) * d * 1.3, p[1] + Math.sin(ang) * d * 0.7, p[2] * k * r.range(0.1, 0.26), r);
    }
  }
  for (let i = 0; i < (spec.chips || 0); i++) {
    const t = r.pick(tiers);
    drawPatch(g, T, r.range(t.bL + 14, t.bR - 14), t.y + CAPH * k + r.range(70, 460) * k, r.range(4, 12) * k, r);
  }
}
function drawCracks(g, tiers, k, r, n) {
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    const t = r.pick(tiers);
    let x = r.range(t.bL + 20, t.bR - 20), y = t.y + CAPH * k + r.range(30, 380) * k;
    const pts = [[x, y]]; let dir = r.range(1.2, 1.9);
    const steps = r.int(7, 16);
    for (let s = 0; s < steps; s++) { dir += r.range(-0.5, 0.5); const d = r.range(6, 15); x += Math.cos(dir) * d; y += Math.sin(dir) * d; pts.push([x, y]); }
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1;
    g.beginPath(); pts.forEach((p, j) => (j ? g.lineTo(p[0] + 1, p[1] + 1) : g.moveTo(p[0] + 1, p[1] + 1))); g.stroke();
    g.strokeStyle = 'rgba(50,53,56,0.6)'; g.lineWidth = r.range(0.7, 1.2);
    g.beginPath(); pts.forEach((p, j) => (j ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
  }
  g.restore();
}
function capShadows(g, tiers, k) {
  const a = 0.6;
  for (const t of tiers) {
    const yB = t.y + CAPH * k, hh = 15 * k;
    g.fillStyle = L.linear(g, 0, yB, 0, yB + hh, [[0, `rgba(34,44,58,${a})`], [0.78, `rgba(34,44,58,${a * 0.9})`], [1, 'rgba(34,44,58,0)']]);
    g.fillRect(t.xa + 3 * k, yB, t.xb - t.xa + (t.tipR ? 8 : 1.5) * k, hh);
    // soft contact occlusion below it
    g.fillStyle = L.linear(g, 0, yB, 0, yB + 46 * k, [[0, 'rgba(40,50,62,0.22)'], [1, 'rgba(40,50,62,0)']]);
    g.fillRect(t.xa, yB, t.xb - t.xa + (t.tipR ? 12 : 0) * k, 46 * k);
    if (t.tipL) { // the corbel shades the wall just beside/below it
      g.fillStyle = L.linear(g, 0, yB, 0, yB + 22 * k, [[0, 'rgba(34,44,58,0.5)'], [0.6, 'rgba(34,44,58,0.4)'], [1, 'rgba(34,44,58,0)']]);
      g.fillRect(t.bL - 2, yB, 22 * k, 22 * k);
    }
  }
}

// ───────────────────────── small window with a 砖雕 lintel hood ─────────────────────────
function drawWindow(g, x, y, k, r) {
  const w = 21 * k, h = 54 * k;
  g.save(); g.lineCap = 'round';
  // tear streaks from the sill
  for (let i = 0; i < 16; i++) {
    const sx = x + r.range(-1, 1) * (w + 6 * k), sl = r.range(50, 210) * k;
    const edge = Math.abs(sx - x) > w * 0.75;
    g.strokeStyle = L.linear(g, 0, y + h, 0, y + h + sl, [[0, L.rgba('#454a4c', edge ? 0.55 : 0.26)], [1, L.rgba('#454a4c', 0)]]);
    g.lineWidth = r.range(1, 3.6) * k; g.beginPath(); g.moveTo(sx, y + h + 5 * k); g.lineTo(sx + r.range(-2, 2), y + h + sl); g.stroke();
  }
  // cast shadows (sun upper-left)
  g.fillStyle = 'rgba(34,44,58,0.5)';
  g.fillRect(x - 34 * k, y - 4 * k, 76 * k, 9 * k);
  g.fillRect(x + w + 3 * k, y + 4 * k, 5 * k, h + 6 * k);
  g.fillRect(x - w - 3 * k, y + h + 6 * k, 2 * w + 16 * k, 4 * k);
  // stone frame + dark opening with a timber grille
  g.fillStyle = L.linear(g, x - w - 4 * k, 0, x + w + 4 * k, 0, [[0, '#d5d3cb'], [1, '#a6a7a3']]);
  g.fillRect(x - w - 4 * k, y - 2 * k, 2 * w + 8 * k, h + 4 * k);
  g.fillStyle = L.linear(g, 0, y, 0, y + h, [[0, '#0d0f11'], [1, '#272a2e']]);
  g.fillRect(x - w, y + 2 * k, 2 * w, h - 2 * k);
  g.fillStyle = '#40352b';
  for (const f of [-0.5, 0, 0.5]) g.fillRect(x + f * 2 * w * 0.62 - 1.6 * k, y + 2 * k, 3.2 * k, h - 2 * k);
  g.fillRect(x - w, y + h * 0.36, 2 * w, 2.6 * k);
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x - w, y + 2 * k, 2 * w, 8 * k); g.fillRect(x - w, y + 2 * k, 5 * k, h - 2 * k);
  g.fillStyle = '#c4c3bc'; g.fillRect(x - w - 7 * k, y + h + k, 2 * w + 14 * k, 5 * k);
  g.strokeStyle = 'rgba(40,44,50,0.6)'; g.lineWidth = Math.max(0.8, k);
  g.beginPath(); g.moveTo(x - w - 7 * k, y + h + 6 * k); g.lineTo(x + w + 7 * k, y + h + 6 * k); g.stroke();
  // carved grey-brick lintel band
  const ly = y - 14 * k;
  g.fillStyle = L.linear(g, 0, ly, 0, ly + 11 * k, [[0, '#8f9498'], [1, '#63686d']]);
  g.fillRect(x - 31 * k, ly, 62 * k, 11 * k);
  g.strokeStyle = 'rgba(38,41,46,0.75)'; g.lineWidth = Math.max(0.7, 0.9 * k);
  for (let i = -5; i <= 5; i++) {
    const c = x + i * 5.4 * k;
    g.beginPath(); g.moveTo(c - 2 * k, ly + 5.5 * k); g.lineTo(c, ly + 2.5 * k); g.lineTo(c + 2 * k, ly + 5.5 * k); g.lineTo(c, ly + 8.5 * k); g.closePath(); g.stroke();
  }
  g.strokeStyle = 'rgba(208,213,217,0.6)'; g.beginPath(); g.moveTo(x - 31 * k, ly + 0.6 * k); g.lineTo(x + 31 * k, ly + 0.6 * k); g.stroke();
  g.fillStyle = '#74797d'; g.fillRect(x - 31 * k, ly + 11 * k, 6 * k, 6 * k); g.fillRect(x + 25 * k, ly + 11 * k, 6 * k, 6 * k);
  // little tiled hood with upturned ends
  const hy = ly - 9 * k;
  g.fillStyle = '#292b2f';
  g.beginPath(); g.moveTo(x - 43 * k, hy - 5 * k); g.quadraticCurveTo(x - 30 * k, hy + k, x - 18 * k, hy); g.lineTo(x + 18 * k, hy);
  g.quadraticCurveTo(x + 30 * k, hy + k, x + 43 * k, hy - 5 * k); g.lineTo(x + 37 * k, hy + 9.5 * k); g.lineTo(x - 37 * k, hy + 9.5 * k); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(132,140,148,0.75)'; g.lineWidth = Math.max(0.9, 1.3 * k);
  g.beginPath(); for (let i = -6; i <= 6; i++) { const c = x + i * 5.4 * k; g.moveTo(c, hy + 2.6 * k); g.lineTo(c, hy + 9 * k); } g.stroke();
  g.strokeStyle = 'rgba(194,204,212,0.75)'; g.lineWidth = Math.max(0.8, k);
  g.beginPath(); g.moveTo(x - 42 * k, hy - 4.6 * k); g.quadraticCurveTo(x - 30 * k, hy + 1.2 * k, x - 18 * k, hy + 0.4 * k); g.lineTo(x + 18 * k, hy + 0.4 * k);
  g.quadraticCurveTo(x + 30 * k, hy + 1.2 * k, x + 42 * k, hy - 4.6 * k); g.stroke();
  g.restore();
}

// ───────────────────────── one whole wall ─────────────────────────
function renderWall(T, tmp, spec) {
  const { tiers, k, seed, haze = 0, windows = [], cracks = 6 } = spec;
  const r = L.rng(seed);
  const c = L.makeLayer(PAD);
  const g = c.getContext('2d');
  const top = Math.min(...tiers.map((t) => t.y));
  g.save(); bodyPath(g, tiers, k); g.clip();
  g.drawImage(T.plaster, -PAD, -PAD);
  // broad light: brightest up top, settling into shade lower down between the houses
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = L.linear(g, 0, top, 0, top + 640, [[0, '#ffffff'], [0.6, '#f8f8f7'], [1, '#dde2e5']]);
  g.fillRect(-PAD, -PAD, LW, LH);
  { const xL = tiers[0].bL, xR = tiers[tiers.length - 1].bR;
    g.fillStyle = L.linear(g, xL, 0, xR, 0, [[0, '#ffffff'], [0.5, '#ffffff'], [1, '#e6eaed']]); g.fillRect(-PAD, -PAD, LW, LH); }
  buildStains(tmp, T, tiers, k, r);
  g.drawImage(tmp, -PAD, -PAD);
  g.globalCompositeOperation = 'source-over';
  drawDrips(g, tiers, k, r);
  g.globalCompositeOperation = 'color-dodge'; g.fillStyle = '#211f1b'; g.fillRect(-PAD, -PAD, LW, LH);
  g.globalCompositeOperation = 'source-over';
  drawPatches(g, T, tiers, k, r, spec);
  drawCracks(g, tiers, k, r, cracks);
  for (const w of windows) drawWindow(g, w[0], w[1], w[2] * k, r);
  capShadows(g, tiers, k);
  // the shaded return on the right-hand corner
  const last = tiers[tiers.length - 1];
  g.fillStyle = L.linear(g, last.bR - 16 * k, 0, last.bR, 0, [[0, 'rgba(40,50,62,0)'], [1, 'rgba(40,50,62,0.3)']]);
  g.fillRect(last.bR - 16 * k, -PAD, 16 * k, LH);
  g.restore();
  for (const t of tiers.slice().sort((p, q) => q.y - p.y)) drawCap(g, t, k, r);
  if (haze) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = L.rgba('#7fabc0', haze); g.fillRect(-PAD, -PAD, LW, LH); g.globalCompositeOperation = 'source-over'; }
  return c;
}
/** paint a soft offset shadow of `c` onto whatever already exists in g, then (optionally) c itself */
function stack(g, c, { dx = 14, dy = 9, alpha = 0.4, color = '#1c2733', draw = true, q = 8, blur = 1.6 } = {}) {
  const s = L.makeCanvas(c.width / q, c.height / q); const sg = s.getContext('2d');
  sg.filter = `blur(${blur}px)`; sg.drawImage(c, 0, 0, s.width, s.height); sg.filter = 'none';
  sg.globalCompositeOperation = 'source-in'; sg.fillStyle = color; sg.fillRect(0, 0, s.width, s.height);
  g.save();
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.globalCompositeOperation = 'source-atop'; g.globalAlpha = alpha;
  g.drawImage(s, -PAD + dx, -PAD + dy, c.width, c.height);
  g.restore();
  if (draw) g.drawImage(c, -PAD, -PAD);
}

// ───────────────────────── foreground roofs (小青瓦屋面) ─────────────────────────
function drawRoof(g, r, x0, x1, yR, k) {
  const rh = 15 * k, pitch = 15.5 * k, cw = 7.4 * k, lap = 12 * k;
  const y0 = yR + rh * 0.5;
  g.save();
  g.beginPath(); g.rect(x0, y0, x1 - x0, BOTTOM - y0); g.clip();
  g.fillStyle = '#0f1012'; g.fillRect(x0, y0, x1 - x0, BOTTOM - y0);
  const n = Math.ceil((x1 - x0) / pitch) + 1;
  for (let i = 0; i < n; i++) {
    const c = x0 + (i + 0.5) * pitch, tone = r.range(-0.09, 0.09);
    g.fillStyle = L.linear(g, c + cw / 2, 0, c + pitch - cw / 2, 0, [[0, '#08090a'], [0.55, '#2b2e33'], [1, '#101113']]);
    g.fillRect(c + cw / 2, y0, pitch - cw, BOTTOM - y0);
    g.fillStyle = L.linear(g, c - cw / 2, 0, c + cw / 2, 0, [[0, L.shade('#25272b', tone)], [0.27, L.shade('#868d95', tone)], [0.55, L.shade('#52565c', tone)], [1, L.shade('#15161a', tone)]]);
    g.fillRect(c - cw / 2, y0, cw, BOTTOM - y0);
    for (let y = y0 + r.range(2, lap); y < BOTTOM; y += lap) {
      if (r.chance(0.28)) { g.fillStyle = r.chance(0.55) ? 'rgba(0,0,0,0.28)' : 'rgba(170,178,186,0.13)'; g.fillRect(c - cw / 2, y, cw, lap); }
      g.strokeStyle = 'rgba(6,7,8,0.8)'; g.lineWidth = 1.3 * k; g.beginPath(); g.moveTo(c - cw / 2, y); g.quadraticCurveTo(c, y + 2.8 * k, c + cw / 2, y); g.stroke();
      g.strokeStyle = 'rgba(196,204,212,0.42)'; g.lineWidth = 1.1 * k; g.beginPath(); g.moveTo(c - cw * 0.34, y + 2.4 * k); g.quadraticCurveTo(c - cw * 0.05, y + 4.2 * k, c + cw * 0.24, y + 3 * k); g.stroke();
      g.strokeStyle = 'rgba(120,128,136,0.3)'; g.lineWidth = 0.9 * k; g.beginPath(); g.moveTo(c + cw / 2 + k, y + lap * 0.5 - 1.6 * k); g.quadraticCurveTo(c + pitch / 2, y + lap * 0.5 + 1.2 * k, c + pitch - cw / 2 - k, y + lap * 0.5 - 1.6 * k); g.stroke();
    }
  }
  g.fillStyle = L.linear(g, 0, y0, 0, y0 + 330 * k, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.45)']]); g.fillRect(x0, y0, x1 - x0, BOTTOM - y0);
  g.globalCompositeOperation = 'screen';
  g.fillStyle = L.linear(g, 0, y0, 0, y0 + 110 * k, [[0, 'rgba(120,150,168,0.2)'], [1, 'rgba(120,150,168,0)']]); g.fillRect(x0, y0, x1 - x0, 110 * k);
  g.globalCompositeOperation = 'source-over';
  g.restore();
  // 正脊: a course of upright tiles on a lime bed, ends swept up
  const xa = x0 - 4 * k, xb = x1 + 4 * k;
  g.fillStyle = L.linear(g, 0, yR, 0, yR + rh, [[0, '#51555b'], [0.3, '#2d2f33'], [1, '#17181a']]);
  g.fillRect(xa, yR, xb - xa, rh);
  g.strokeStyle = 'rgba(150,158,166,0.32)'; g.lineWidth = k; g.beginPath();
  for (let x = xa + 2 * k; x < xb; x += 3.4 * k) { g.moveTo(x + 2.2 * k, yR + 2 * k); g.lineTo(x, yR + rh - 2.6 * k); } g.stroke();
  g.fillStyle = 'rgba(214,214,208,0.55)'; g.fillRect(xa, yR + rh - 2.6 * k, xb - xa, 2.2 * k);
  g.strokeStyle = 'rgba(198,207,214,0.85)'; g.lineWidth = 1.3 * k; g.beginPath(); g.moveTo(xa, yR + 0.7 * k); g.lineTo(xb, yR + 0.7 * k); g.stroke();
  drawHorn(g, xa, yR, k, -1, 15, 0, 6, 9);
  drawHorn(g, xb, yR, k, 1, 15, 0, 6, 9);
}

// ───────────────────────── scene ─────────────────────────
function build(env) {
  const a = env.arc, cx = a.cx;
  const __t = [performance.now()]; const __m = (n) => { __t.push(performance.now()); (globalThis.__s10t = globalThis.__s10t || []).push(n + ':' + Math.round(__t[__t.length - 1] - __t[__t.length - 2])); };
  const T = buildTextures(); __m('tex');
  const tmp = L.makeLayer(PAD);

  // far → near. every tip sits on the arc; walls further back are smaller in detail and hazier
  const wLL = renderWall(T, tmp, { tiers: sideTiers(a, 0.7, [-1110, -1260, -1400], -860), k: 0.7, seed: 's10LL', haze: 0.28, cracks: 2, chips: 1 });
  const wRR = renderWall(T, tmp, { tiers: sideTiers(a, 0.7, [1100, 1250, 1395], 850), k: 0.7, seed: 's10RR', haze: 0.28, cracks: 2, chips: 1 });
  const wL = renderWall(T, tmp, { tiers: sideTiers(a, 0.9, [-770, -950], -440), k: 0.9, seed: 's10L', haze: 0.14, cracks: 5, chips: 2,
    windows: [[cx - 652, 852, 1]], patches: [[cx - 838, 905, 40], [cx - 560, 930, 30]] });
  const wR = renderWall(T, tmp, { tiers: sideTiers(a, 0.9, [760, 942], 440), k: 0.9, seed: 's10R', haze: 0.14, cracks: 5, chips: 2,
    windows: [[cx + 700, 884, 1]], patches: [[cx + 610, 842, 34], [cx + 872, 940, 44]] });
  const wC = renderWall(T, tmp, { tiers: symTiers(a, 1.2, [180, 535]), k: 1.2, seed: 's10C', cracks: 8, chips: 3,
    windows: [[cx - 338, 756, 0.92], [cx + 300, 770, 0.85]], patches: [[cx - 64, 832, 40], [cx + 412, 846, 44], [cx - 452, 842, 30], [cx + 96, 742, 15]] });

  __m('walls');
  const far = L.makeLayer(PAD, (g) => {
    g.drawImage(wLL, -PAD, -PAD); g.drawImage(wRR, -PAD, -PAD);
    stack(g, wL, { alpha: 0.42, dx: 26, dy: 14, q: 4, blur: 1.2 }); stack(g, wR, { alpha: 0.42, dx: 26, dy: 14, q: 4, blur: 1.2 });
    stack(g, wC, { alpha: 0.5, dx: 40, dy: 22, draw: false, q: 4, blur: 1.2, color: '#22323f' });
  });

  __m('far');
  // foreground: a row of tiled roofs stepping up toward the centre, an echo of the skyline
  const r = L.rng('s10roof');
  const near = L.makeLayer(PAD, (g) => {
    const roofs = [
      [cx - 1420, cx - 870, 1018], [cx + 850, cx + 1420, 1030],
      [cx - 905, cx - 300, 948], [cx + 300, cx + 885, 960],
      [cx - 345, cx + 332, 894],
    ];
    const one = L.makeLayer(PAD); const og = one.getContext('2d');
    for (const [x0, x1, yR] of roofs) {
      clearLayer(one); drawRoof(og, r, x0, x1, yR, 1.5);
      stack(g, one, { alpha: 0.55, dx: 16, dy: 8 });
    }
    // lichen, dust and uneven firing over all the tiles
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = 0.5;
    g.drawImage(tex({ seed: 's10rf', scale: 120, octaves: 4, warp: 0.6, res: 0.2,
      ramp: [[0, 'rgba(0,0,0,0.55)'], [0.45, 'rgba(0,0,0,0)'], [0.62, 'rgba(150,160,150,0)'], [1, 'rgba(168,176,160,0.4)']] }), -PAD, Y0);
    g.globalAlpha = 1;
    L.speckle(g, { seed: 's10lich', count: 2200, x: -PAD, y: 820, w: LW, h: 520, rMin: 0.5, rMax: 2.4, colors: ['#8a938a', '#7f8f6c', '#aab0a6', '#566546'], alpha: [0.1, 0.42] });
    g.globalCompositeOperation = 'source-over';
  });

  __m('near');
  const main = L.makeLayer(PAD, (g) => {
    g.drawImage(wC, -PAD, -PAD);
    // the alley between this wall and the roofs in front is dim
    stack(g, near, { alpha: 0.26, dx: 0, dy: -12, draw: false });
  });
  const g2 = far.getContext('2d');
  stack(g2, near, { alpha: 0.26, dx: 0, dy: -12, draw: false });

  // one sun for the whole village: warm and bright from the upper left, cooler and dimmer toward the lower right
  for (const lay of [far, main, near]) {
    const g = lay.getContext('2d');
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = L.linear(g, 200, 520, 1750, 1120, [[0, 'rgba(255,238,200,0.16)'], [0.45, 'rgba(255,238,200,0)'], [0.6, 'rgba(24,44,66,0)'], [1, 'rgba(24,44,66,0.2)']]);
    g.fillRect(-PAD, -PAD, LW, LH);
    g.globalCompositeOperation = 'source-over';
  }

  __m('main+sun');
  // 青山: a far wooded hill whose crest IS the arc — darkest along the ridge line, paling into valley haze behind the village
  const hill = L.makeLayer(PAD, (g) => {
    g.save(); a.clipBelow(g, 0);
    const HY = 536, HH = 500;
    const hp = (opts) => L.noiseTex(LW, HH, { ...opts, polar: { cx: a.cx + PAD, cy: a.cy - HY, R: a.R } });
    const D = 460, st = (dr, c) => [1 + dr / D, c];
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - D, a.R, [st(-D, '#7fbcc5'), st(-230, '#5aa5b0'), st(-120, '#3f8f9b'), st(-58, '#2c7c87'), st(-20, '#1f6a73'), st(0, '#1a626a')]);
    g.fillRect(-PAD, -PAD, LW, LH);
    // sun on the left flank, shade on the right
    g.fillStyle = L.linear(g, 0, 0, W, 0, [[0, 'rgba(120,190,150,0.16)'], [0.5, 'rgba(120,190,150,0)'], [1, 'rgba(8,40,60,0.2)']]);
    g.fillRect(-PAD, -PAD, LW, LH);
    // forest: spurs and gullies running down-slope, then the pebbled texture of tree crowns
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.5;
    g.drawImage(hp({ seed: 's10h1', scale: 54, sx: 1, sy: 3.6, octaves: 4, contrast: 1.6, warp: 0.4, res: 0.3 }), -PAD, HY);
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.34;
    g.drawImage(hp({ seed: 's10h2', scale: 6.5, sx: 1.2, sy: 0.9, octaves: 2, contrast: 2.0, res: 0.5, ramp: [[0, '#0f474f'], [0.55, '#ffffff'], [1, '#ffffff']] }), -PAD, HY);
    g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.16;
    g.drawImage(hp({ seed: 's10h3', scale: 6.5, sx: 1.2, sy: 0.9, octaves: 2, contrast: 2.0, res: 0.5, ramp: [[0, '#000000'], [0.6, '#000000'], [1, '#bfe6d2']] }), -PAD, HY);
    g.restore();
    // tree line: the crest is a fringe of tiny crowns (≤ 2 px proud of the arc)
    const rr = L.rng('s10trees');
    g.fillStyle = '#195f67';
    a.along({ spacing: 4, margin: PAD + 120 }, (q) => {
      const rad = rr.range(1.4, 3.6), dr = 1.8 - rad - rr.range(0, 1.4);
      const pt = a.pt(q.theta + rr.range(-0.0006, 0.0006), dr);
      g.beginPath(); g.arc(pt.x, pt.y, rad, 0, L.TAU); g.fill();
    });
  });

  __m('hill');
  // flat teal sky with the faintest breath of unevenness
  const sky = L.makeCanvas(W, H);
  {
    const g = sky.getContext('2d');
    g.fillStyle = COL.sky; g.fillRect(0, 0, W, H);
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 40, a.R + 620, [[0, 'rgba(255,255,255,0.07)'], [0.5, 'rgba(255,255,255,0)'], [1, 'rgba(0,30,50,0.07)']]);
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.06;
    g.drawImage(L.noiseTex(W, H, { seed: 's10sky', scale: 520, octaves: 3, res: 0.15 }), 0, 0);
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.3;
    g.drawImage(L.grainTex(W, H, { seed: 's10sg', amount: 0.14 }), 0, 0);
  }
  __m('sky'); const __n = L.blurred(near, 0.8); __m('blur');
  return { sky, hill, far, main, near: __n };
}

export default {
  name: '徽派马头墙',
  tone: 'light',
  init(env) { S = build(env); },
  draw(ctx, env, p) {
    const rot = L.lerp(-0.008, 0.008, p), z = L.lerp(1.0, 1.018, p);
    ctx.drawImage(S.sky, 0, 0);
    L.blit(ctx, env, S.hill, { rot: rot * 0.45 });   // no zoom: the crest stays exactly on the arc
    L.blit(ctx, env, S.far, { rot: rot * 0.72, zoom: 1 + (z - 1) * 0.7 });
    L.blit(ctx, env, S.main, { rot, zoom: z });
    L.blit(ctx, env, S.near, { rot: rot * 1.4, zoom: 1 + (z - 1) * 1.5 });
  },
};
