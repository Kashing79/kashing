// s37 — 祈年殿檐下. The film's last five frames: we stand under the lowest round eave of the Hall of Prayer for Good
// Harvests at night and look up. The arc is the eave edge (檐口): a thin fringe of blue-glazed tile ends (瓦当) and
// drip tiles (滴水) catching warm floodlight. Below it the vermilion rafters fan inward toward the hall's centre like
// the gills of a mushroom: square flying rafters (飞椽, green heads with a gold 卍) over round eave rafters (檐椽, blue
// heads with a gold pearl), then the eave purlin and a ring of blue/green/gold bracket sets (斗拱). Above: night.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 200;
const PITCH = 68;        // rafter spacing along the eave edge (px)
const TILE = 56;         // tile spacing along the eave edge (px)
const WAN = true;        // flying-rafter heads carry the gold 卍 (as restored on the hall); false → a plain gold pearl
const FLY_HW = 18;       // half-width of a (square) flying rafter
const EAVE_HW = 17;      // half-width of a (round) eave rafter
// radial layout: px inward from the eave edge (local +y of arc.at points to the circle centre)
const Y = {
  lian0: 12, lian1: 43,          // 大连檐 / 瓦口: the red board behind the tile fringe
  head: 27,                      // foreshortened height of a rafter's end face
  fly0: 70, fly1: 182,           // flying rafter underside
  xiao0: 164, xiao1: 180,        // 小连檐 + 闸挡板: the cross board where the two rafter tiers meet
  eave0: 190, eave1: 346,        // eave rafter (centre of its head disc → where it dives behind the purlin)
  pur0: 338, pur1: 382,          // 挑檐桁: the eave purlin
  dg0: 382,                      // bracket band starts here
};
const C = {
  red: '#d2371f', hi: '#ff7a4a', lo: '#6a120c',
  blue: '#1f3f96', green: '#1f8f6a', gold: '#e9b949', goldHi: '#fff1b8', night: '#05070c',
};
let S = null;

const poly = (g, pts) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); };

/** evenly spaced angles covering the frame + PAD; `pitch` px at radius R+dr, `off` in pitches */
function angles(a, pitch, dr = 0, off = 0) {
  const s = a.span(PAD + 170);
  const step = pitch / (a.R + dr);
  const n = Math.ceil(s / step) + 1;
  const out = [];
  for (let i = -n; i <= n; i++) out.push({ th: (i + off) * step, i });
  return out;
}

/** paint something over a layer but only where the layer already has pixels (keeps the sky transparent) */
function overlay(layer, blend, alpha, paint) {
  const t = L.makeLayer(PAD, paint);
  const tg = t.getContext('2d');
  tg.setTransform(1, 0, 0, 1, 0, 0);
  tg.globalCompositeOperation = 'destination-in';
  tg.drawImage(layer, 0, 0);
  const g = layer.getContext('2d');
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = blend; g.globalAlpha = alpha;
  g.drawImage(t, 0, 0);
  g.restore();
}

// ───────────────────────── rafters ─────────────────────────
/** a square flying rafter (飞椽) hanging under the boards. `s` = sideways lean of "up" at this spot (px), tone = ±jitter */
function flyRafter(g, s, tone) {
  const hw = FLY_HW, e = Y.head, y0 = Y.fly0, y1 = Y.fly1;
  // shadow thrown onto the boards (the light rakes in from the left)
  const sx = hw + Math.max(0, s);
  g.fillStyle = L.linear(g, sx - 2, 0, sx + 30, 0, [[0, 'rgba(10,1,1,0.92)'], [0.5, 'rgba(10,1,1,0.6)'], [1, 'rgba(10,1,1,0)']]);
  poly(g, [[sx - 2, y0 - e], [sx + 30, y0 - e], [sx + 30, y1], [sx - 2, y1]]); g.fill();
  // the one side face we can see
  if (s > 0.5) {          // right flank, turned away from the light
    g.fillStyle = L.linear(g, hw, 0, hw + s, 0, [[0, L.shade('#8a1b0f', tone)], [1, '#3d0a06']]);
    poly(g, [[hw, y0], [hw, y1], [hw + s, y1 - e], [hw + s, y0 - e]]); g.fill();
  } else if (s < -0.5) {  // left flank, facing the light
    g.fillStyle = L.linear(g, -hw + s, 0, -hw, 0, [[0, '#ffa877'], [1, L.shade(C.hi, tone)]]);
    poly(g, [[-hw, y0], [-hw, y1], [-hw + s, y1 - e], [-hw + s, y0 - e]]); g.fill();
  }
  // underside
  g.fillStyle = L.linear(g, -hw, 0, hw, 0, [
    [0, L.shade('#ff9566', tone)], [0.09, L.shade('#f65d33', tone)], [0.45, L.shade('#dc3b20', tone)], [0.88, L.shade('#c02e18', tone)], [1, L.shade('#8a1c0f', tone)]]);
  g.fillRect(-hw, y0, hw * 2, y1 - y0);
  // end face: green ground, gold frame, gold 卍 — sheared so it leans the same way as the side face
  g.save(); g.translate(0, y0); g.transform(1, 0, -s / e, 1, 0, 0);
  g.fillStyle = L.linear(g, 0, -e, 0, 0, [[0, '#0f5a42'], [0.45, C.green], [1, '#3cc092']]);
  g.fillRect(-hw, -e, hw * 2, e);
  g.strokeStyle = C.gold; g.lineWidth = 2; g.lineJoin = 'miter';
  g.strokeRect(-hw + 3, -e + 3, hw * 2 - 6, e - 6);
  const hx = 7.5, hy = 5.5, cy = -e / 2;
  g.strokeStyle = '#ffd766'; g.lineWidth = 2.3; g.lineCap = 'butt';
  g.beginPath();
  g.moveTo(-hx, cy - hy); g.lineTo(0, cy - hy); g.lineTo(0, cy + hy); g.lineTo(hx, cy + hy);
  g.moveTo(hx, cy - hy); g.lineTo(hx, cy); g.lineTo(-hx, cy); g.lineTo(-hx, cy + hy);
  g.stroke();
  // lower edge of the end face catches the light
  g.strokeStyle = 'rgba(255,240,190,0.75)'; g.lineWidth = 1.3;
  g.beginPath(); g.moveTo(-hw, -0.4); g.lineTo(hw, -0.4); g.stroke();
  g.restore();
}

/** a round eave rafter (檐椽) with its painted head */
function eaveRafter(g, s, tone) {
  const hw = EAVE_HW, y0 = Y.eave0, y1 = Y.eave1;
  // shadow on the boards
  g.fillStyle = L.linear(g, hw - 3, 0, hw + 30, 0, [[0, 'rgba(8,1,1,0.92)'], [0.5, 'rgba(8,1,1,0.55)'], [1, 'rgba(8,1,1,0)']]);
  g.fillRect(hw - 3, y0 - 8, 33, y1 - y0 + 8);
  // cylinder shading; the highlight wanders with the viewing angle
  const hl = L.clamp(0.25 - s * 0.011, 0.1, 0.44);
  g.fillStyle = L.linear(g, -hw, 0, hw, 0, [
    [0, L.shade('#a82412', tone)], [hl * 0.45, L.shade('#f4633a', tone)], [hl, L.shade('#ff9360', tone)], [hl + 0.2, L.shade('#e0432a', tone)],
    [0.74, L.shade('#a5210f', tone)], [1, '#470a05']]);
  g.fillRect(-hw, y0, hw * 2, y1 - y0);
  // head: blue ground, gold rim, gold pearl
  const ry = 13.5;
  g.fillStyle = 'rgba(12,2,2,0.6)'; g.beginPath(); g.ellipse(2, y0 + 5, hw + 1, ry, 0, 0, L.TAU); g.fill();
  g.fillStyle = L.radial(g, -5, y0 + 5, 1, hw * 1.5, [[0, '#6f9cff'], [0.35, '#2c55c4'], [0.75, C.blue], [1, '#0d1e58']]);
  g.beginPath(); g.ellipse(0, y0, hw, ry, 0, 0, L.TAU); g.fill();
  g.strokeStyle = C.gold; g.lineWidth = 2;
  g.beginPath(); g.ellipse(0, y0, hw - 3.2, ry - 3, 0, 0, L.TAU); g.stroke();
  g.fillStyle = L.radial(g, -1.5, y0 + 1.5, 0.3, 6.5, [[0, '#fff6cf'], [0.4, '#ffd65e'], [1, '#b47a12']]);
  g.beginPath(); g.ellipse(0, y0, 5.6, 4.6, 0, 0, L.TAU); g.fill();
  g.strokeStyle = 'rgba(255,238,180,0.8)'; g.lineWidth = 1.2;
  g.beginPath(); g.ellipse(0, y0, hw - 0.6, ry - 0.6, 0, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
}

// ───────────────────────── tile fringe ─────────────────────────
function drawTiles(g, a) {
  // drip tiles (滴水): pointed tongues hanging between the tile ends
  for (const { th } of angles(a, TILE, 0, 0.5)) {
    a.at(g, th, 0, () => {
      const shape = () => {
        g.beginPath(); g.moveTo(-22, 3); g.quadraticCurveTo(0, 10, 22, 3);
        g.bezierCurveTo(22, 17, 9, 21, 0, 32); g.bezierCurveTo(-9, 21, -22, 17, -22, 3); g.closePath();
      };
      g.fillStyle = L.linear(g, 0, 3, 0, 32, [[0, '#0e2163'], [0.3, '#2a53ba'], [0.62, '#2247a6'], [1, '#0c1c56']]);
      shape(); g.fill();
      // raised border + warm reflection along the lower-left edge
      g.strokeStyle = 'rgba(150,188,255,0.55)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(-16, 9); g.bezierCurveTo(-15, 16, -7, 19, 0, 26); g.bezierCurveTo(7, 19, 15, 16, 16, 9); g.stroke();
      g.strokeStyle = 'rgba(255,214,120,0.9)'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(-21.5, 8); g.bezierCurveTo(-21, 17, -9, 21, -0.5, 31); g.stroke();
      g.fillStyle = 'rgba(255,236,170,0.9)'; g.beginPath(); g.ellipse(-2, 15, 2.6, 1.8, 0, 0, L.TAU); g.fill();
    });
  }
  // tile ends (瓦当): glazed discs whose tops sit on the arc
  for (const { th } of angles(a, TILE, 0, 0)) {
    a.at(g, th, 0, () => {
      const cy = 9.5, rx = 14.5, ry = 11;
      g.fillStyle = 'rgba(4,8,30,0.7)'; g.beginPath(); g.ellipse(1.5, cy + 2.5, rx, ry, 0, 0, L.TAU); g.fill();
      g.fillStyle = L.radial(g, -4.5, cy + 4, 0.5, rx * 1.45, [[0, '#b4d0ff'], [0.2, '#4f80e6'], [0.55, '#2348a8'], [1, '#0a1848']]);
      g.beginPath(); g.ellipse(0, cy, rx, ry, 0, 0, L.TAU); g.fill();
      g.strokeStyle = 'rgba(160,196,255,0.6)'; g.lineWidth = 1.3;
      g.beginPath(); g.ellipse(0, cy, rx - 3, ry - 2.6, 0, 0, L.TAU); g.stroke();
      // warm glints: floodlight on the glaze
      g.strokeStyle = 'rgba(255,220,130,0.95)'; g.lineWidth = 1.7;
      g.beginPath(); g.ellipse(0, cy, rx - 0.8, ry - 0.8, 0, 0.45 * Math.PI, 0.95 * Math.PI); g.stroke();
      g.fillStyle = L.radial(g, -1, cy + 0.5, 0.2, 4.2, [[0, '#fff7d6'], [0.5, '#f2c452'], [1, 'rgba(180,120,20,0)']]);
      g.beginPath(); g.ellipse(0, cy, 4.2, 3.4, 0, 0, L.TAU); g.fill();
      // cool sky light on the very top edge
      g.strokeStyle = 'rgba(170,205,255,0.55)'; g.lineWidth = 1.1;
      g.beginPath(); g.ellipse(0, cy, rx - 0.5, ry - 0.5, 0, 1.2 * Math.PI, 1.8 * Math.PI); g.stroke();
    });
  }
}

// ───────────────────────── brackets ─────────────────────────
/** one bracket set (一攒斗拱) seen from below: three tiers of arms stepping in toward the wall, then the big block */
function dougong(g, alt) {
  const armC = alt ? C.blue : C.green, blkC = alt ? C.green : C.blue;
  const arm = (y, hwid, th) => {
    g.fillStyle = L.linear(g, 0, y, 0, y + th, [[0, L.shade(armC, 0.28)], [0.45, L.shade(armC, 0.06)], [1, L.shade(armC, -0.5)]]);
    g.beginPath(); g.moveTo(-hwid, y); g.lineTo(hwid, y); g.lineTo(hwid, y + th * 0.4);
    g.quadraticCurveTo(hwid - 3, y + th, hwid - 15, y + th); g.lineTo(-hwid + 15, y + th);
    g.quadraticCurveTo(-hwid + 3, y + th, -hwid, y + th * 0.4); g.closePath(); g.fill();
    g.strokeStyle = C.gold; g.lineWidth = 1.7; g.stroke();
  };
  const block = (x, y, w, h) => {
    g.fillStyle = L.linear(g, 0, y, 0, y + h, [[0, L.shade(blkC, 0.32)], [0.5, L.shade(blkC, 0.05)], [1, L.shade(blkC, -0.45)]]);
    poly(g, [[x - w / 2, y], [x + w / 2, y], [x + w / 2 - 3, y + h], [x - w / 2 + 3, y + h]]); g.fill();
    g.strokeStyle = C.gold; g.lineWidth = 1.5; g.stroke();
  };
  // the projecting arm (翘/昂) running out toward us
  g.fillStyle = L.linear(g, -10, 0, 10, 0, [[0, L.shade(armC, 0.3)], [0.5, armC], [1, L.shade(armC, -0.5)]]);
  g.fillRect(-10, 4, 20, 124);
  g.strokeStyle = C.gold; g.lineWidth = 1.5; g.strokeRect(-10, 4, 20, 124);
  const tiers = [[12, 52, 22], [52, 41, 22], [92, 30, 22]];
  for (const [y, hwid, th] of tiers) {
    arm(y, hwid, th);
    for (const bx of [-hwid + 9, 0, hwid - 9]) block(bx, y - 9, 19, 12);
  }
  // 坐斗
  g.fillStyle = L.linear(g, 0, 124, 0, 166, [[0, L.shade(blkC, 0.3)], [0.5, blkC], [1, L.shade(blkC, -0.5)]]);
  poly(g, [[-23, 124], [23, 124], [23, 146], [16, 166], [-16, 166], [-23, 146]]); g.fill();
  g.strokeStyle = C.gold; g.lineWidth = 1.8; g.stroke();
}

// ───────────────────────── the eave ─────────────────────────
function buildEave(env) {
  const a = env.arc;
  const FULL = [-PAD, -PAD, W + PAD * 2, H + PAD * 2];
  const layer = L.makeLayer(PAD, (g) => {
    const rj = L.rng('s37tone');
    const raf = angles(a, PITCH, 0, 0).map((q) => ({ ...q, tone: rj.range(-0.06, 0.06), s: L.clamp(-q.th * 42, -17, 17) }));

    // 1) the boards (望板) between the rafters: dull red, mostly in shadow
    g.save(); a.clipBelow(g, -9);
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 560, a.R, [[0, '#2a0705'], [0.5, '#4a0f09'], [1, '#6a170d']]);
    g.fillRect(...FULL);
    g.strokeStyle = 'rgba(10,1,1,0.5)'; g.lineWidth = 2;
    for (const d of [104, 132, 228, 262, 298]) a.stroke(g, -d);
    g.restore();

    // 2) flying rafters
    for (const q of raf) a.at(g, q.th, 0, () => flyRafter(g, q.s, q.tone));

    // 3) 大连檐: the red board the tiles sit on, just above the rafter heads
    g.save(); a.clipBand(g, -Y.lian0, -Y.lian1);
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - Y.lian1, a.R - Y.lian0, [[0, '#d83c22'], [0.25, '#b42a16'], [1, '#4a0c07']]);
    g.fillRect(...FULL);
    g.restore();
    g.strokeStyle = 'rgba(255,170,120,0.8)'; g.lineWidth = 1.4; a.stroke(g, -Y.lian1 + 0.8);

    // 4) 小连檐 / 闸挡板 where the flying rafters land on the eave rafters, and the shadow under it
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - Y.xiao1 - 34, a.R - Y.xiao1, [[0, 'rgba(8,1,1,0)'], [1, 'rgba(8,1,1,0.8)']]);
    a.pathBand(g, -Y.xiao1, -Y.xiao1 - 34); g.fill();
    g.save(); a.clipBand(g, -Y.xiao0, -Y.xiao1);
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - Y.xiao1, a.R - Y.xiao0, [[0, '#7a160c'], [0.3, '#c5321b'], [0.8, '#e2482a'], [1, '#ff8a58']]);
    g.fillRect(...FULL);
    g.restore();

    // 5) eave rafters
    for (const q of raf) a.at(g, q.th, 0, () => eaveRafter(g, q.s, q.tone));

    // 6) bracket band: red boards (垫拱板) in shadow, then the bracket sets
    g.save(); a.clipBelow(g, -Y.dg0 + 2);
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - Y.dg0 - 220, a.R - Y.dg0, [[0, '#3a0a06'], [1, '#8a1d10']]);
    g.fillRect(...FULL);
    g.restore();
    for (const { th, i } of angles(a, 126, -Y.dg0, 0.5)) a.at(g, th, -Y.dg0, () => dougong(g, ((i % 2) + 2) % 2 === 0));

    // 7) eave purlin (挑檐桁): a round beam banded blue / green with gold hoops
    const seg = angles(a, 168, -Y.pur0, 0.5);
    const dth = 168 / (a.R - Y.pur0);
    for (const { th, i } of seg) {
      const even = ((i % 2) + 2) % 2 === 0;
      g.fillStyle = even ? '#2449ac' : '#1f9a72';
      a.pathBand(g, -Y.pur0, -Y.pur1, th - dth / 2, th + dth / 2); g.fill();
      // 枋心: a gold-edged panel of the other colour
      const m = 30 / (a.R - Y.pur0);
      g.fillStyle = even ? '#1f8f6a' : '#2a50b8';
      a.pathBand(g, -Y.pur0 - 9, -Y.pur1 + 9, th - dth / 2 + m, th + dth / 2 - m); g.fill();
      g.strokeStyle = C.gold; g.lineWidth = 1.8; g.stroke();
      // 箍头: gold hoop at each joint
      const h = 7 / (a.R - Y.pur0);
      g.fillStyle = C.gold; a.pathBand(g, -Y.pur0, -Y.pur1, th - dth / 2 - h / 2, th - dth / 2 + h / 2); g.fill();
    }
    // roundness of the purlin + its shadow on the brackets
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - Y.pur1, a.R - Y.pur0, [
      [0, 'rgba(0,0,10,0.72)'], [0.3, 'rgba(0,0,10,0.1)'], [0.52, 'rgba(255,255,255,0.3)'], [0.7, 'rgba(255,255,255,0.02)'], [1, 'rgba(0,0,10,0.66)']]);
    a.pathBand(g, -Y.pur0, -Y.pur1); g.fill();
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - Y.pur1 - 26, a.R - Y.pur1, [[0, 'rgba(6,1,2,0)'], [1, 'rgba(6,1,2,0.75)']]);
    a.pathBand(g, -Y.pur1, -Y.pur1 - 26); g.fill();

    // 8) the glazed tile fringe on the arc
    drawTiles(g, a);
  });

  // ── material: paint drag along the rafters, mottling, grain ──
  overlay(layer, 'soft-light', 0.5, (g) => g.drawImage(L.polarNoiseLayer(env, PAD, { seed: 's37drag', scale: 22, sx: 0.55, sy: 11, octaves: 4, contrast: 1.7, res: 0.5 }), -PAD, -PAD));
  overlay(layer, 'multiply', 0.38, (g) => g.drawImage(L.polarNoiseLayer(env, PAD, { seed: 's37soot', scale: 210, octaves: 4, warp: 0.6, res: 0.25, contrast: 1.3, ramp: [[0, '#4a2a22'], [0.55, '#ffffff'], [1, '#ffffff']] }), -PAD, -PAD));
  overlay(layer, 'overlay', 0.5, (g) => g.drawImage(L.grainTex(W + PAD * 2, H + PAD * 2, { seed: 's37grain', amount: 0.24 }), -PAD, -PAD));
  // ── light: a warm floodlight from below-left, falling off into the depth of the eave ──
  overlay(layer, 'source-over', 1, (g) => {
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 620, a.R - 250, [[0, 'rgba(6,1,4,0.72)'], [0.6, 'rgba(6,1,4,0.22)'], [1, 'rgba(6,1,4,0)']]);
    g.fillRect(...FULL);
    g.fillStyle = L.radial(g, a.cx - 260, a.crestY + 170, 300, 1500, [[0, 'rgba(4,1,6,0)'], [0.55, 'rgba(4,1,6,0.3)'], [1, 'rgba(4,1,6,0.78)']]);
    g.fillRect(...FULL);
  });
  overlay(layer, 'screen', 1, (g) => {
    g.fillStyle = L.radial(g, a.cx - 260, a.crestY + 150, 0, 900, [[0, 'rgba(255,150,80,0.22)'], [0.5, 'rgba(255,120,60,0.08)'], [1, 'rgba(255,120,60,0)']]);
    g.fillRect(...FULL);
  });
  return layer;
}

// ───────────────────────── night sky ─────────────────────────
function buildSky(env) {
  const a = env.arc;
  return L.makeLayer(PAD, (g) => {
    g.fillStyle = C.night; g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R, a.R + 900, [[0, 'rgba(22,34,72,0.55)'], [0.25, 'rgba(14,22,48,0.3)'], [1, 'rgba(6,9,20,0)']]);
    g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    // a few faint stars, kept clear of the caption
    const r = L.rng('s37stars');
    for (let i = 0; i < 150; i++) {
      const x = r.range(-PAD, W + PAD), y = r.range(-PAD, 640);
      if (x > 520 && x < 1400 && y > a.crestY - 330) continue;
      g.globalAlpha = r.range(0.12, 0.5);
      g.fillStyle = r.pick(['#dfe8ff', '#fff3df', '#ffffff']);
      const s = r.range(0.7, 1.8); g.fillRect(x, y, s, s);
    }
    g.globalAlpha = 1;
  });
}

export default {
  name: '祈年殿檐下',
  tone: 'light',
  init(env) {
    const eave = L.filtered(buildEave(env), 'saturate(1.18) contrast(1.06)');
    S = { sky: buildSky(env), eave, bloom: L.blurred(eave, 16) };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.004, 0.004, p), zoom = L.lerp(1.0, 1.012, p);
    L.blit(ctx, env, S.sky, { rot: rot * 0.3 });
    L.blit(ctx, env, S.eave, { rot, zoom });
    L.blit(ctx, env, S.bloom, { rot, zoom, blend: 'screen', alpha: 0.42 });
    // a glint running along the glazed fringe
    const gl = a.pt(L.lerp(-0.2, -0.02, p), -14);
    L.glow(ctx, gl.x, gl.y, 150, '#ffe2a0', 0.28);
    L.vignette(ctx, { strength: 0.3 });
  },
};
