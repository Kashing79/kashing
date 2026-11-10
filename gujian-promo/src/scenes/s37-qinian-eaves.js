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
const WAN = false;       // true → flying-rafter heads carry the gold 卍 as restored on the hall; false → a plain gold pearl (default: the 0.2 s shot is too short for the symbol to read correctly out of context)
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
  blue: '#1f3f96', green: '#1f8f6a', gold: '#e9b949', night: '#05070c',
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

/** hairline cracks in old paint across a rafter of half-width hw, between y0 and y1 */
function cracks(g, r, hw, y0, y1) {
  const n = r.int(0, 2);
  for (let k = 0; k < n; k++) {
    const y = r.range(y0 + 14, y1 - 10), j = r.range(-2.5, 2.5), x0 = r.range(-hw, -hw * 0.2), x1 = r.range(hw * 0.2, hw);
    g.strokeStyle = 'rgba(46,6,3,0.5)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x0, y); g.quadraticCurveTo(0, y + j, x1, y - j * 0.6); g.stroke();
    g.strokeStyle = 'rgba(255,190,150,0.22)';
    g.beginPath(); g.moveTo(x0, y + 1.2); g.quadraticCurveTo(0, y + j + 1.2, x1, y - j * 0.6 + 1.2); g.stroke();
  }
}

// ───────────────────────── rafters ─────────────────────────
/** a square flying rafter (飞椽) hanging under the boards. `s` = sideways lean of "up" at this spot (px), tone = ±jitter */
function flyRafter(g, s, tone, r, dw = 0) {
  const hw = FLY_HW + dw, e = Y.head, y0 = Y.fly0, y1 = Y.fly1;
  // shadow thrown onto the boards (the light rakes in from the left)
  const sx = hw + Math.max(0, s);
  g.fillStyle = L.linear(g, sx - 2, 0, sx + 36, 0, [[0, 'rgba(6,0,6,0.97)'], [0.55, 'rgba(6,0,6,0.8)'], [1, 'rgba(6,0,6,0)']]);
  poly(g, [[sx - 2, y0 - e], [sx + 36, y0 - e], [sx + 36, y1], [sx - 2, y1]]); g.fill();
  const fall = L.linear(g, 0, y0, 0, y1, [[0, 'rgba(255,216,160,0.22)'], [0.3, 'rgba(255,216,160,0)'], [0.5, 'rgba(12,1,1,0)'], [1, 'rgba(12,1,1,0.66)']]);
  // the one side face we can see
  let side = null;
  if (s > 0.5) {          // right flank, turned away from the light
    side = [[hw, y0], [hw, y1], [hw + s, y1 - e], [hw + s, y0 - e]];
    g.fillStyle = L.linear(g, hw, 0, hw + s, 0, [[0, L.shade('#8f1d10', tone)], [1, '#30081a']]);
  } else if (s < -0.5) {  // left flank, facing the light
    side = [[-hw, y0], [-hw, y1], [-hw + s, y1 - e], [-hw + s, y0 - e]];
    g.fillStyle = L.linear(g, -hw + s, 0, -hw, 0, [[0, '#ff9c66'], [1, L.shade('#ff7a45', tone)]]);
  }
  if (side) { poly(g, side); g.fill(); g.fillStyle = fall; g.fill(); }
  // underside
  g.fillStyle = L.linear(g, -hw, 0, hw, 0, [
    [0, L.shade('#ff9a6a', tone)], [0.1, L.shade('#f6603a', tone)], [0.45, L.shade('#de3d22', tone)], [0.86, L.shade('#bf2d17', tone)], [1, L.shade('#861a0d', tone)]]);
  g.fillRect(-hw, y0, hw * 2, y1 - y0);
  cracks(g, r, hw, y0, y1 - 20);
  g.fillStyle = fall; g.fillRect(-hw, y0, hw * 2, y1 - y0);
  // gloss along the lit arris
  g.strokeStyle = L.linear(g, 0, y0, 0, y1, [[0, 'rgba(255,238,206,0.85)'], [0.75, 'rgba(255,238,206,0)']]); g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(-hw + 1.6, y0 + 2); g.lineTo(-hw + 1.6, y1); g.stroke();
  // end face: green ground, gold frame, gold 卍 — sheared so it leans the same way as the side face
  g.save(); g.translate(0, y0); g.transform(1, 0, -s / e, 1, 0, 0);
  g.fillStyle = L.linear(g, 0, -e, 0, 0, [[0, '#0d4f3a'], [0.4, C.green], [1, '#43c898']]);
  g.fillRect(-hw, -e, hw * 2, e);
  g.strokeStyle = C.gold; g.lineWidth = 2.1; g.lineJoin = 'miter';
  g.strokeRect(-hw + 3, -e + 3, hw * 2 - 6, e - 6);
  const cy = -e / 2;
  if (WAN) {
    const hx = 7.5, hy = 5.7;
    g.strokeStyle = '#ffd866'; g.lineWidth = 2.4; g.lineCap = 'butt';
    g.beginPath();
    g.moveTo(-hx, cy - hy); g.lineTo(0, cy - hy); g.lineTo(0, cy + hy); g.lineTo(hx, cy + hy);
    g.moveTo(hx, cy - hy); g.lineTo(hx, cy); g.lineTo(-hx, cy); g.lineTo(-hx, cy + hy);
    g.stroke();
  } else {
    g.fillStyle = L.radial(g, -1.5, cy + 1.5, 0.3, 7, [[0, '#fff6cf'], [0.4, '#ffd65e'], [1, '#b47a12']]);
    g.beginPath(); g.ellipse(0, cy, 6.4, 5.2, 0, 0, L.TAU); g.fill();
  }
  // the board above shades the top of the face; its lower edge catches the light
  g.fillStyle = L.linear(g, 0, -e, 0, -e + 9, [[0, 'rgba(4,10,8,0.6)'], [1, 'rgba(4,10,8,0)']]); g.fillRect(-hw, -e, hw * 2, 9);
  g.strokeStyle = 'rgba(255,244,200,0.85)'; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(-hw, -0.5); g.lineTo(hw, -0.5); g.stroke();
  g.restore();
}

/** a round eave rafter (檐椽) with its painted head */
function eaveRafter(g, s, tone, r, dw = 0) {
  const hw = EAVE_HW + dw, y0 = Y.eave0, y1 = Y.eave1;
  // shadow on the boards
  g.fillStyle = L.linear(g, hw - 3, 0, hw + 34, 0, [[0, 'rgba(6,0,6,0.97)'], [0.55, 'rgba(6,0,6,0.76)'], [1, 'rgba(6,0,6,0)']]);
  g.fillRect(hw - 3, y0 - 8, 37, y1 - y0 + 8);
  // cylinder shading; the highlight wanders with the viewing angle
  const hl = L.clamp(0.25 - s * 0.011, 0.1, 0.44);
  g.fillStyle = L.linear(g, -hw, 0, hw, 0, [
    [0, L.shade('#a82412', tone)], [hl * 0.45, L.shade('#f4633a', tone)], [hl, L.shade('#ffa070', tone)], [hl + 0.2, L.shade('#e2452b', tone)],
    [0.74, L.shade('#9e1f0e', tone)], [1, '#3d0804']]);
  g.fillRect(-hw, y0, hw * 2, y1 - y0);
  cracks(g, r, hw * 0.8, y0 + 16, y1 - 30);
  g.fillStyle = L.linear(g, 0, y0, 0, y1, [[0, 'rgba(255,216,160,0.2)'], [0.3, 'rgba(255,216,160,0)'], [0.55, 'rgba(12,1,1,0)'], [1, 'rgba(12,1,1,0.7)']]);
  g.fillRect(-hw, y0, hw * 2, y1 - y0);
  const hx = -hw + hl * hw * 2;
  g.strokeStyle = L.linear(g, 0, y0, 0, y1, [[0, 'rgba(255,240,214,0.7)'], [0.7, 'rgba(255,240,214,0)']]); g.lineWidth = 2;
  g.beginPath(); g.moveTo(hx, y0 + 12); g.lineTo(hx, y1); g.stroke();
  // head: blue ground, gold rim, gold pearl
  const ry = 13.5;
  g.fillStyle = 'rgba(8,1,4,0.72)'; g.beginPath(); g.ellipse(4, y0 - 5.5, hw + 1, ry + 0.5, 0, 0, L.TAU); g.fill();   // thrown up-right onto the cross board
  g.fillStyle = L.radial(g, -5, y0 + 5, 1, hw * 1.5, [[0, '#7fa8ff'], [0.35, '#2f5acb'], [0.75, C.blue], [1, '#0b1a50']]);
  g.beginPath(); g.ellipse(0, y0, hw, ry, 0, 0, L.TAU); g.fill();
  g.strokeStyle = C.gold; g.lineWidth = 2.1;
  g.beginPath(); g.ellipse(0, y0, hw - 3.2, ry - 3, 0, 0, L.TAU); g.stroke();
  g.fillStyle = L.radial(g, -1.5, y0 + 1.5, 0.3, 6.5, [[0, '#fff6cf'], [0.4, '#ffd65e'], [1, '#b47a12']]);
  g.beginPath(); g.ellipse(0, y0, 5.8, 4.8, 0, 0, L.TAU); g.fill();
  g.strokeStyle = 'rgba(255,240,190,0.85)'; g.lineWidth = 1.3;
  g.beginPath(); g.ellipse(0, y0, hw - 0.6, ry - 0.6, 0, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
}

// ───────────────────────── tile fringe ─────────────────────────
function drawTiles(g, a) {
  const k = TILE / 50;
  // the roof's underside lip, so no light leaks between the tiles
  g.fillStyle = '#0a1640'; a.pathBand(g, -4, -17); g.fill();
  // drip tiles (滴水): pointed tongues hanging between the tile ends
  for (const { th } of angles(a, TILE, 0, 0.5)) {
    a.at(g, th, 0, () => {
      g.scale(k, k); g.translate(0, -1.5);
      g.fillStyle = L.linear(g, 0, 3, 0, 32, [[0, '#0d1f60'], [0.3, '#2d58c2'], [0.62, '#234aac'], [1, '#0c1c56']]);
      g.beginPath(); g.moveTo(-22, 3); g.quadraticCurveTo(0, 10, 22, 3);
      g.bezierCurveTo(22, 17, 9, 21, 0, 32); g.bezierCurveTo(-9, 21, -22, 17, -22, 3); g.closePath(); g.fill();
      // raised border + warm reflection along the lower-left edge
      g.strokeStyle = 'rgba(150,188,255,0.6)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(-16, 9); g.bezierCurveTo(-15, 16, -7, 19, 0, 26); g.bezierCurveTo(7, 19, 15, 16, 16, 9); g.stroke();
      g.strokeStyle = 'rgba(255,218,128,0.95)'; g.lineWidth = 1.7;
      g.beginPath(); g.moveTo(-21.5, 8); g.bezierCurveTo(-21, 17, -9, 21, -0.5, 31); g.stroke();
      g.fillStyle = 'rgba(255,236,170,0.92)'; g.beginPath(); g.ellipse(-2, 15.5, 2.8, 1.9, 0, 0, L.TAU); g.fill();
    });
  }
  // tile ends (瓦当): glazed discs whose tops sit on the arc
  for (const { th } of angles(a, TILE, 0, 0)) {
    a.at(g, th, 0, () => {
      g.scale(k, k);
      const cy = 9.5, rx = 14.5, ry = 11;
      g.fillStyle = 'rgba(3,6,26,0.8)'; g.beginPath(); g.ellipse(1, cy + 0.4, rx + 1.3, ry + 1.1, 0, 0, L.TAU); g.fill();
      g.fillStyle = L.radial(g, -4.5, cy + 4, 0.5, rx * 1.45, [[0, '#bcd6ff'], [0.2, '#5486ea'], [0.55, '#2348a8'], [1, '#0a1848']]);
      g.beginPath(); g.ellipse(0, cy, rx, ry, 0, 0, L.TAU); g.fill();
      g.strokeStyle = 'rgba(160,196,255,0.6)'; g.lineWidth = 1.3;
      g.beginPath(); g.ellipse(0, cy, rx - 3, ry - 2.6, 0, 0, L.TAU); g.stroke();
      // the moulded coiled dragon (团龙), reduced to one spiral in relief: shadow first, then its lit ridge
      const coil = (ox, oy) => {
        g.beginPath();
        for (let i = 0; i <= 12; i++) {
          const t = i / 12, ang = 2.4 + t * 5.2, rad = 1.2 + 6.4 * t;
          const x = ox + rad * Math.cos(ang), y = cy + oy + rad * 0.76 * Math.sin(ang);
          if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
      };
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = 'rgba(5,12,58,0.75)'; g.lineWidth = 2.2; coil(0.9, -0.9);
      g.strokeStyle = 'rgba(255,226,150,0.9)'; g.lineWidth = 1.5; coil(0, 0);
      // warm glints: floodlight on the glaze
      g.strokeStyle = 'rgba(255,222,134,0.95)'; g.lineWidth = 1.8;
      g.beginPath(); g.ellipse(0, cy, rx - 0.8, ry - 0.8, 0, 0.4 * Math.PI, 0.98 * Math.PI); g.stroke();
      g.fillStyle = L.radial(g, -5.5, cy + 4.2, 0.2, 3.6, [[0, '#fffbe6'], [0.45, 'rgba(255,224,140,0.8)'], [1, 'rgba(255,200,90,0)']]);
      g.beginPath(); g.ellipse(-5.5, cy + 4.2, 3.6, 2.6, -0.5, 0, L.TAU); g.fill();
      // cool sky light on the very top edge
      g.strokeStyle = 'rgba(176,208,255,0.6)'; g.lineWidth = 1.1;
      g.beginPath(); g.ellipse(0, cy, rx - 0.5, ry - 0.5, 0, 1.2 * Math.PI, 1.8 * Math.PI); g.stroke();
    });
  }
}

// ───────────────────────── brackets ─────────────────────────
/** one bracket set (一攒斗拱) seen from below: three tiers of arms stepping in toward the wall, then the big block */
function dougong(g, alt) {
  const BL = '#2850ba', GR = '#1f9a72', GD = '#f4c858';
  const armC = alt ? BL : GR, blkC = alt ? GR : BL;
  const sh = 'rgba(6,1,4,0.6)';
  const armPath = (y, hwid, th) => {
    g.beginPath(); g.moveTo(-hwid, y); g.lineTo(hwid, y); g.lineTo(hwid, y + th * 0.4);
    g.quadraticCurveTo(hwid - 3, y + th, hwid - 15, y + th); g.lineTo(-hwid + 15, y + th);
    g.quadraticCurveTo(-hwid + 3, y + th, -hwid, y + th * 0.4); g.closePath();
  };
  const arm = (y, hwid, th) => {
    g.save(); g.translate(5, -5); g.fillStyle = sh; armPath(y, hwid, th); g.fill(); g.restore();
    g.fillStyle = L.linear(g, 0, y, 0, y + th, [[0, L.shade(armC, -0.35)], [0.5, armC], [1, L.shade(armC, 0.3)]]);
    armPath(y, hwid, th); g.fill();
    g.strokeStyle = GD; g.lineWidth = 2.2; g.stroke();
  };
  const block = (x, y, w, h) => {
    g.fillStyle = sh; poly(g, [[x - w / 2 + 4, y - 4], [x + w / 2 + 4, y - 4], [x + w / 2 + 1, y + h - 4], [x - w / 2 + 7, y + h - 4]]); g.fill();
    g.fillStyle = L.linear(g, 0, y, 0, y + h, [[0, L.shade(blkC, -0.3)], [0.5, blkC], [1, L.shade(blkC, 0.34)]]);
    poly(g, [[x - w / 2, y], [x + w / 2, y], [x + w / 2 - 3, y + h], [x - w / 2 + 3, y + h]]); g.fill();
    g.strokeStyle = GD; g.lineWidth = 1.9; g.stroke();
  };
  // the projecting arm (翘/昂) running out toward us
  g.fillStyle = sh; g.fillRect(-6, 0, 22, 126);
  g.fillStyle = L.linear(g, -10, 0, 10, 0, [[0, L.shade(armC, 0.34)], [0.4, armC], [1, L.shade(armC, -0.55)]]);
  g.fillRect(-10, 4, 20, 124);
  g.strokeStyle = GD; g.lineWidth = 1.9; g.strokeRect(-10, 4, 20, 124);
  const tiers = [[12, 52, 22], [52, 41, 22], [92, 30, 22]];
  for (const [y, hwid, th] of tiers) {
    arm(y, hwid, th);
    for (const bx of [-hwid + 9, 0, hwid - 9]) block(bx, y - 9, 19, 12);
  }
  // 坐斗
  g.fillStyle = L.linear(g, 0, 124, 0, 166, [[0, L.shade(blkC, -0.3)], [0.5, blkC], [1, L.shade(blkC, 0.3)]]);
  poly(g, [[-23, 124], [23, 124], [23, 146], [16, 166], [-16, 166], [-23, 146]]); g.fill();
  g.strokeStyle = GD; g.lineWidth = 2.2; g.stroke();
}

// ───────────────────────── the eave ─────────────────────────
function buildEave(env) {
  const a = env.arc;
  const FULL = [-PAD, -PAD, W + PAD * 2, H + PAD * 2];
  const paint = (layer, fn) => { const g = layer.getContext('2d'); g.save(); fn(g); g.restore(); };

  // ── stage 1: boards and the two tiers of rafters ──
  const layer = L.makeLayer(PAD, (g) => {
    const rj = L.rng('s37tone'), rc = L.rng('s37crack');
    // hand-cut timber: every rafter sits a hair off its mark and takes the paint a little differently
    const raf = angles(a, PITCH, 0, 0).map((q) => ({
      th: q.th + rj.range(-1.3, 1.3) / a.R, th2: q.th + rj.range(-1.3, 1.3) / a.R, s: L.clamp(-q.th * 40, -15, 15),
      tone: rj.range(-0.08, 0.07), tone2: rj.range(-0.08, 0.07), dw: rj.range(-0.9, 0.9), dw2: rj.range(-0.9, 0.9) }));

    // the boards (望板) between the rafters: dull red, almost lost in shadow
    g.save(); a.clipBelow(g, -9);
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 560, a.R, [[0, '#1d0504'], [0.5, '#340a06'], [1, '#521109']]);
    g.fillRect(...FULL);
    g.strokeStyle = 'rgba(8,1,1,0.55)'; g.lineWidth = 2;
    for (const d of [104, 136, 226, 262, 300]) a.stroke(g, -d);
    g.restore();

    // flying rafters
    for (const q of raf) a.at(g, q.th, 0, () => flyRafter(g, q.s, q.tone, rc, q.dw));

    // 大连檐: the red board the tiles sit on, just above the rafter heads
    g.save(); a.clipBand(g, -Y.lian0, -Y.lian1);
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - Y.lian1, a.R - Y.lian0, [[0, '#e04426'], [0.3, '#b42a16'], [1, '#430b06']]);
    g.fillRect(...FULL);
    g.restore();
    g.strokeStyle = 'rgba(255,178,128,0.85)'; g.lineWidth = 1.4; a.stroke(g, -Y.lian1 + 0.8);

    // 小连檐 / 闸挡板 where the flying rafters land on the eave rafters, and the shadow it throws inward
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - Y.xiao1 - 30, a.R - Y.xiao1, [[0, 'rgba(6,1,1,0)'], [1, 'rgba(6,1,1,0.85)']]);
    a.pathBand(g, -Y.xiao1, -Y.xiao1 - 30); g.fill();
    g.save(); a.clipBand(g, -Y.xiao0, -Y.xiao1);
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - Y.xiao1, a.R - Y.xiao0, [[0, '#5a0f08'], [0.35, '#b02a16'], [0.8, '#d43f24'], [1, '#ff8a58']]);
    g.fillRect(...FULL);
    g.restore();

    // eave rafters
    for (const q of raf) a.at(g, q.th2, 0, () => eaveRafter(g, q.s, q.tone2, rc, q.dw2));
  });
  // oil paint over timber: brush drag and a faint relief running along every rafter
  overlay(layer, 'soft-light', 0.42, (g) => g.drawImage(L.polarNoiseLayer(env, PAD, { seed: 's37drag', scale: 22, sx: 0.55, sy: 11, octaves: 4, contrast: 1.7, res: 0.5 }), -PAD, -PAD));
  const hmap = L.polarNoiseLayer(env, PAD, { seed: 's37bump', scale: 10, sx: 0.6, sy: 18, octaves: 3, contrast: 1.4, res: 0.5 });
  overlay(layer, 'overlay', 0.3, (g) => g.drawImage(L.bumpLight(hmap, { angle: 180, strength: 2.2, res: 0.5 }), -PAD, -PAD));

  // ── stage 2: the bracket ring and the purlin in front of it ──
  paint(layer, (g) => {
    // red boards (垫拱板) in shadow, then the bracket sets
    g.save(); a.clipBelow(g, -Y.dg0 + 2);
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - Y.dg0 - 220, a.R - Y.dg0, [[0, '#120303'], [1, '#38090a']]);
    g.fillRect(...FULL);
    g.restore();
    for (const { th, i } of angles(a, 152, -Y.dg0, 0.5)) a.at(g, th, -Y.dg0, () => { g.scale(1.22, 1.22); dougong(g, ((i % 2) + 2) % 2 === 0); });

    // eave purlin (挑檐桁): a round beam banded blue / green with gold hoops
    const dth = 168 / (a.R - Y.pur0);
    for (const { th, i } of angles(a, 168, -Y.pur0, 0)) {
      const even = ((i % 2) + 2) % 2 === 0;
      g.fillStyle = even ? '#2449ac' : '#1f9a72';
      a.pathBand(g, -Y.pur0, -Y.pur1, th - dth / 2, th + dth / 2); g.fill();
      // 枋心: a gold-edged panel of the other colour
      const m = 30 / (a.R - Y.pur0);
      g.fillStyle = even ? '#1f8f6a' : '#2a50b8';
      a.pathBand(g, -Y.pur0 - 10, -Y.pur1 + 10, th - dth / 2 + m, th + dth / 2 - m); g.fill();
      g.strokeStyle = C.gold; g.lineWidth = 2; g.stroke();
      // 箍头: gold hoop at each joint
      const h = 8 / (a.R - Y.pur0);
      g.fillStyle = C.gold; a.pathBand(g, -Y.pur0, -Y.pur1, th - dth / 2 - h / 2, th - dth / 2 + h / 2); g.fill();
    }
    // roundness of the purlin + the shadow it throws on the brackets
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - Y.pur1, a.R - Y.pur0, [
      [0, 'rgba(0,0,10,0.8)'], [0.28, 'rgba(0,0,10,0.15)'], [0.5, 'rgba(255,255,255,0.36)'], [0.66, 'rgba(255,255,255,0.02)'], [1, 'rgba(0,0,10,0.78)']]);
    a.pathBand(g, -Y.pur0, -Y.pur1); g.fill();
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - Y.pur1 - 30, a.R - Y.pur1, [[0, 'rgba(6,1,2,0)'], [1, 'rgba(6,1,2,0.8)']]);
    a.pathBand(g, -Y.pur1, -Y.pur1 - 30); g.fill();
  });
  // soot and age over all the woodwork
  overlay(layer, 'multiply', 0.34, (g) => g.drawImage(L.polarNoiseLayer(env, PAD, { seed: 's37soot', scale: 210, octaves: 4, warp: 0.6, res: 0.25, contrast: 1.3, ramp: [[0, '#4a2a22'], [0.55, '#ffffff'], [1, '#ffffff']] }), -PAD, -PAD));

  // ── stage 3: the glazed tile fringe on the arc ──
  paint(layer, (g) => drawTiles(g, a));
  overlay(layer, 'overlay', 0.5, (g) => g.drawImage(L.grainTex(W + PAD * 2, H + PAD * 2, { seed: 's37grain', amount: 0.24 }), -PAD, -PAD));

  // ── light: a warm floodlight from below-left, falling off into the depth of the eave and toward the far side ──
  overlay(layer, 'source-over', 1, (g) => {
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 620, a.R - 270, [[0, 'rgba(6,1,4,0.7)'], [0.6, 'rgba(6,1,4,0.2)'], [1, 'rgba(6,1,4,0)']]);
    g.fillRect(...FULL);
    g.fillStyle = L.radial(g, a.cx - 230, a.crestY + 150, 300, 1480, [[0, 'rgba(4,1,6,0)'], [0.45, 'rgba(4,1,6,0.3)'], [1, 'rgba(4,1,6,0.86)']]);
    g.fillRect(...FULL);
  });
  overlay(layer, 'screen', 1, (g) => {
    g.fillStyle = L.radial(g, a.cx - 230, a.crestY + 140, 0, 950, [[0, 'rgba(255,156,84,0.32)'], [0.5, 'rgba(255,120,60,0.1)'], [1, 'rgba(255,120,60,0)']]);
    g.fillRect(...FULL);
  });
  return layer;
}

// ───────────────────────── night sky ─────────────────────────
function buildSky(env) {
  const a = env.arc;
  return L.makeLayer(PAD, (g) => {
    g.fillStyle = C.night; g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R, a.R + 900, [[0, 'rgba(20,32,70,0.42)'], [0.25, 'rgba(14,22,48,0.24)'], [1, 'rgba(6,9,20,0)']]);
    g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    // a few faint stars, kept clear of the caption
    const r = L.rng('s37stars');
    for (let i = 0; i < 150; i++) {
      const x = r.range(-PAD, W + PAD), y = r.range(-PAD, 640);
      if (x > 520 && x < 1400 && y > a.crestY - 330) continue;
      g.globalAlpha = r.range(0.18, 0.7);
      g.fillStyle = r.pick(['#dfe8ff', '#fff3df', '#ffffff']);
      const s = r.range(0.8, 2.1); g.fillRect(x, y, s, s);
    }
    g.globalAlpha = 1;
  });
}

export default {
  name: '祈年殿檐下',
  tone: 'light',
  init(env) {
    const a = env.arc;
    const eave = L.filtered(buildEave(env), 'saturate(1.25) brightness(1.1) contrast(1.06)');
    // shallow focus: the eave edge and rafter heads are sharp, the bracket ring deep inside goes soft
    const soft = L.blurred(eave, 1.5);
    const sg = soft.getContext('2d');
    sg.globalCompositeOperation = 'destination-in';
    sg.fillStyle = L.radial(sg, a.cx + PAD, a.cy + PAD, a.R - 470, a.R - 300, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
    sg.fillRect(0, 0, soft.width, soft.height);
    eave.getContext('2d').drawImage(soft, 0, 0);
    S = { sky: buildSky(env), eave, bloom: L.blurred(eave, 16) };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.004, 0.004, p), zoom = L.lerp(1.0, 1.012, p);
    L.blit(ctx, env, S.sky, { rot: rot * 0.3 });
    L.blit(ctx, env, S.eave, { rot, zoom });
    L.blit(ctx, env, S.bloom, { rot, zoom, blend: 'screen', alpha: 0.42 });
    // a sheen sliding along the rafters and the glazed fringe (kept under the eave line)
    ctx.save(); a.clipBelow(ctx, 2);
    const gl = a.pt(L.lerp(-0.2, -0.06, p), -70);
    L.glow(ctx, gl.x, gl.y, 420, '#ffd9a0', 0.16);
    ctx.restore();
    L.vignette(ctx, { strength: 0.3 });
  },
};
