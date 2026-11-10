// s20 — 窑洞灯火. Dusk at a Shaanbei cave dwelling (窑洞): we stand close under the crown of its arched window.
// The arc is the top of the arched opening — everything below it is the papered timber lattice, lit from inside by a lamp:
// a fan of radial ribs hugging the arch, a curved rail, then a square lattice whose panes carry red paper-cuts (窗花).
// Above the arc: the loess wall in the last light, calm for the tagline, with out-of-focus strings of chillies and maize
// hanging far out to either side. Halation from the window fogs the whole picture.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 120;                      // the move is a ±1 % push-in, so a modest margin is plenty
const FW = W + PAD * 2, FH = H + PAD * 2;

// lattice dimensions (px)
const FRAME = 13;                     // bowed head of the window frame — sits just OUTSIDE the arc, so lit paper starts exactly on it
const SOFFIT = 5;                     // we look up at the window: every horizontal member shows this much of its lit underside
const FLANK = 0.009;                  // …and every upright shows the flank that faces the middle of the frame (px per px off-centre)
const BAND = 132;                     // depth of the fan of radial ribs under the arch
const RAIL = 22;                      // concentric rail that closes the fan
const RIB = 16, RIB_PITCH = 96;       // radial ribs: width / spacing along the arc
const P = 196, MUN = 18;              // square lattice below: pitch / muntin width
const DIAG = 8;                       // thin bars of the diagonal (斜格) infill panes
const WOOD = [[0, '#140805'], [0.45, '#2a120a'], [1, '#4d2614']];
const RED = '#cf2014';
let S = null;

// ───────────────────────── geometry ─────────────────────────
function geom(a) {
  const y0 = a.crestY + BAND + RAIL;                 // underside of the rail at the centre line
  const yH = [1, 2, 3].map((j) => y0 - MUN / 2 + j * P); // centre lines of the horizontal muntins
  const d = RIB_PITCH / a.R, s = a.span(PAD + 120);
  const ribs = [];
  for (let i = -Math.ceil(s / d); i <= Math.ceil(s / d); i++) ribs.push((i + 0.5) * d); // a pane (not a rib) on the centre line
  const cols = [];
  for (let k = 1; k * P < W / 2 + PAD + P; k++) cols.push(a.cx - k * P, a.cx + k * P);
  // panes alternate: one carries a paper-cut, the next a fine diagonal lattice (斜格). [left x, top y] of each 斜格 pane
  const diag = [];
  for (const sgn of [-1, 1]) for (const [k, row] of [[1, 0], [3, 0], [2, 1], [4, 1], [5, 0]]) diag.push([a.cx + (sgn > 0 ? k : -k - 1) * P, yH[0] - P + row * P]);
  const lamp = { x: a.cx - 128, y: a.crestY + 262 };  // the oil lamp, behind the left half of the middle pane
  return { y0, yH, ribs, cols, diag, lamp };
}
/** the thin ±45° bars of the 斜格 panes, three diamonds to a pane */
function strokeDiagonals(g, a, G, width) {
  g.save(); a.clipBelow(g, -BAND - RAIL + 2);
  g.lineWidth = width; g.lineCap = 'butt';
  for (const [x, y] of G.diag) {
    g.save(); g.beginPath(); g.rect(x, y, P, P); g.clip();
    g.beginPath();
    for (let m = -3; m <= 3; m++) {
      const o = (m * P) / 3;
      g.moveTo(x + o, y); g.lineTo(x + o + P, y + P);
      g.moveTo(x + P - o, y); g.lineTo(x - o, y + P);
    }
    g.stroke(); g.restore();
  }
  g.restore();
}
/** radial ribs + vertical muntins. grow widens them (glue/shadow mask); depth shifts them toward the centre line → their flanks */
function fillVerticals(g, a, G, grow = 0, depth = 0) {
  for (const th of G.ribs) a.at(g, th, 0, () => g.fillRect(-RIB / 2 - grow - th * a.R * depth, -3, RIB + grow * 2, BAND + 6));
  g.save(); a.clipBelow(g, -BAND - RAIL + 2);
  for (const x of G.cols) g.fillRect(x - MUN / 2 - grow + (a.cx - x) * depth, a.crestY, MUN + grow * 2, FH);
  g.restore();
}
/** frame head, rail and horizontal muntins (the middle pane is two cells tall, so the first muntin skips it). drop adds their soffits. */
function fillHorizontals(g, a, G, grow = 0, drop = 0) {
  a.pathBand(g, FRAME + SOFFIT + grow, drop ? 0 : SOFFIT); g.fill();
  a.pathBand(g, -BAND + grow, -BAND - RAIL - grow - drop); g.fill();
  g.save(); a.clipBelow(g, -BAND - RAIL + 2);
  G.yH.forEach((y, j) => {
    const t = y - MUN / 2 - grow, h = MUN + grow * 2 + drop;
    if (j === 0) { g.fillRect(-PAD - 50, t, a.cx - P + 50 + PAD, h); g.fillRect(a.cx + P, t, W / 2 + PAD + 50, h); }
    else g.fillRect(-PAD - 50, t, FW + 100, h);
  });
  g.restore();
}
/** cheap wide blur: downsample ×k, blur, upsample back to a full padded layer */
function soft(src, px, k = 4) {
  const w = Math.ceil(src.width / k), h = Math.ceil(src.height / k);
  const s = L.makeCanvas(w, h), sg = s.getContext('2d');
  sg.imageSmoothingEnabled = true; sg.imageSmoothingQuality = 'high';
  sg.filter = `blur(${(px / k).toFixed(2)}px)`;
  sg.drawImage(src, 0, 0, w, h);
  const o = L.makeCanvas(src.width, src.height), og = o.getContext('2d');
  og.imageSmoothingEnabled = true; og.imageSmoothingQuality = 'high';
  og.drawImage(s, 0, 0, src.width, src.height);
  o._pad = src._pad;
  return o;
}

// ───────────────────────── paper-cuts (窗花) ─────────────────────────
// Folded-and-cut rosettes: a red silhouette, then the classic cut marks punched out of it —
// sawtooth rows (锯齿纹), crescents (月牙纹), teardrops and dots. No characters, only flowers.
function papercut(kind, R, seed) {
  const size = Math.ceil(R * 2 + 8);
  const c = L.makeCanvas(size, size), g = c.getContext('2d');
  g.translate(size / 2, size / 2); g.scale(R, R);
  const ring = (n, phase, fn) => { for (let i = 0; i < n; i++) { g.save(); g.rotate(phase + (i * L.TAU) / n); fn(i); g.fill(); g.restore(); } };
  const petal = (r0, r1, w) => () => {   // leaf pointed at both ends, pointing outward
    g.beginPath(); g.moveTo(0, -r0);
    g.bezierCurveTo(w * 1.3, -L.lerp(r0, r1, 0.32), w * 0.8, -L.lerp(r0, r1, 0.8), 0, -r1);
    g.bezierCurveTo(-w * 0.8, -L.lerp(r0, r1, 0.8), -w * 1.3, -L.lerp(r0, r1, 0.32), 0, -r0); g.closePath();
  };
  const drop = (r0, r1, w) => () => {    // teardrop: point toward the centre, round end outward
    g.beginPath(); g.moveTo(0, -r0);
    g.bezierCurveTo(w * 0.5, -L.lerp(r0, r1, 0.5), w * 1.35, -r1, 0, -r1);
    g.bezierCurveTo(-w * 1.35, -r1, -w * 0.5, -L.lerp(r0, r1, 0.5), 0, -r0); g.closePath();
  };
  const crescent = (rc, half, sag, thick) => () => {
    g.beginPath(); g.moveTo(-half, -rc); g.quadraticCurveTo(0, -rc - sag, half, -rc); g.quadraticCurveTo(0, -rc - sag + thick, -half, -rc); g.closePath();
  };
  const tooth = (r0, r1, b) => () => { g.beginPath(); g.moveTo(-b, -r0); g.lineTo(0, -r1); g.lineTo(b, -r0); g.closePath(); };
  const dot = (rc, rad) => () => { g.beginPath(); g.arc(0, -rc, rad, 0, L.TAU); };
  const disc = (rad) => { g.beginPath(); g.arc(0, 0, rad, 0, L.TAU); g.fill(); };
  const cut = () => { g.globalCompositeOperation = 'destination-out'; };
  const E = Math.PI / 8;

  g.fillStyle = RED;
  if (kind === 'tuan') {            // 八瓣团花 — the big one in the middle pane
    ring(8, 0, petal(0.5, 1.0, 0.21));
    ring(8, E, dot(0.775, 0.175));
    disc(0.745);
    cut();
    ring(8, 0, petal(0.735, 0.945, 0.082));
    ring(8, E, dot(0.80, 0.062));
    ring(32, 0, tooth(0.585, 0.685, 0.03));
    ring(8, E, drop(0.21, 0.535, 0.125));
    ring(8, 0, crescent(0.455, 0.062, 0.06, 0.04));
    ring(8, 0, drop(0.075, 0.185, 0.048));
    disc(0.036);
  } else if (kind === 'liu') {      // 六瓣花
    ring(6, 0, dot(0.56, 0.42));
    disc(0.6);
    cut();
    ring(6, 0, crescent(0.74, 0.25, 0.15, 0.085));
    ring(6, Math.PI / 6, petal(0.3, 0.7, 0.07));
    ring(6, 0, drop(0.17, 0.52, 0.115));
    ring(6, 0, dot(0.63, 0.04));
    disc(0.075);
  } else if (kind === 'ju') {       // 十二瓣菊
    ring(12, 0, petal(0.28, 1.0, 0.15));
    disc(0.52);
    cut();
    ring(12, 0, petal(0.56, 0.9, 0.055));
    ring(12, Math.PI / 12, tooth(0.33, 0.47, 0.04));
    ring(6, 0, drop(0.09, 0.27, 0.075));
    disc(0.045);
  } else {                          // 'ling' — 菱形角花 for the shallow panes
    g.beginPath(); g.moveTo(0, -0.9); g.lineTo(0.9, 0); g.lineTo(0, 0.9); g.lineTo(-0.9, 0); g.closePath(); g.fill();
    ring(4, 0, dot(0.86, 0.14));
    ring(4, Math.PI / 4, dot(0.63, 0.17));
    cut();
    ring(4, 0, drop(0.17, 0.7, 0.15));
    ring(4, Math.PI / 4, petal(0.15, 0.5, 0.075));
    ring(4, Math.PI / 4, dot(0.655, 0.06));
    ring(4, 0, dot(0.87, 0.045));
    ring(8, E, crescent(0.5, 0.06, 0.05, 0.04));
    disc(0.07);
  }
  // hand-dyed paper is never even: mottle the red a little
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.5;
  g.drawImage(L.noiseTex(size, size, { seed: 's20pc' + seed, scale: 26, octaves: 3, res: 0.5, contrast: 1.5, ramp: [[0, 'rgba(110,8,6,0.55)'], [0.5, 'rgba(110,8,6,0)'], [1, 'rgba(255,90,50,0.4)']] }), 0, 0);
  return c;
}
function cutList(a, G) {
  const y0 = G.y0;
  const row1 = (x) => { const top = a.yAt(x, -BAND - RAIL) + 4, bot = G.yH[0] - MUN / 2; return { y: (top + bot) / 2, r: (bot - top) / 2 - 7 }; };
  const y2 = (G.yH[0] + G.yH[1]) / 2 - 3;
  const out = [{ kind: 'tuan', x: a.cx, y: y0 + (2 * P - MUN) / 2 + 2, r: 160, rot: 0.03 }];
  for (const s of [-1, 1]) {
    const x1 = a.cx + s * 2.5 * P, q = row1(x1);
    out.push({ kind: 'ling', x: x1 + s * 2, y: q.y, r: q.r, rot: s * 0.03 });
    out.push({ kind: s < 0 ? 'liu' : 'ju', x: a.cx + s * 1.5 * P, y: y2, r: 69, rot: s * -0.05 });
    out.push({ kind: s < 0 ? 'ju' : 'liu', x: a.cx + s * 3.5 * P, y: y2, r: 69, rot: s * 0.06 });
  }
  return out;
}

// ───────────────────────── window paper, lit from inside ─────────────────────────
function buildPaper(env, G) {
  const a = env.arc;
  const lamp = G.lamp;
  // soft brown haze hugging every bar: paste lines, doubled paper, and the bar's own thickness
  const ao = L.blurred(L.makeLayer(PAD, (g) => {
    g.fillStyle = g.strokeStyle = '#7a2c06';
    fillVerticals(g, a, G, 3); fillVerticals(g, a, G, 3, FLANK); fillHorizontals(g, a, G, 3, SOFFIT); strokeDiagonals(g, a, G, DIAG + 5);
  }), 6);
  const layer = L.makeLayer(PAD, (g) => {
    g.save(); a.clipBelow(g, 1);
    // the lamp behind the paper: a hot core falling off to deep orange toward the springing of the arch
    g.fillStyle = L.radial(g, lamp.x, lamp.y, 0, 1000, [[0, '#fff8dc'], [0.05, '#ffeeb4'], [0.14, '#ffdc8c'], [0.28, '#ffc462'], [0.44, '#fba63e'], [0.6, '#e88426'], [0.8, '#c9641c'], [1, '#aa4e14']]);
    g.fillRect(-PAD, -PAD, FW, FH);
    // each pane is its own little sheet: slightly different thickness
    const r = L.rng('s20pane');
    for (let i = 0; i < G.ribs.length - 1; i++) { g.fillStyle = `rgba(150,60,6,${r.range(0, 0.12).toFixed(3)})`; a.pathBand(g, 0, -BAND, G.ribs[i], G.ribs[i + 1]); g.fill(); }
    const xs = [a.cx - P, a.cx + P, ...G.cols].sort((p, q) => p - q);
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = `rgba(150,60,6,${r.range(0, 0.09).toFixed(3)})`;
      g.fillRect(xs[i], j ? G.yH[0] : a.crestY + BAND, xs[i + 1] - xs[i], P);
    }
    // cloudy fibre of hand-made paper seen by transmitted light
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.8;
    g.drawImage(L.noiseTex(FW, FH, { seed: 's20cloud', scale: 58, octaves: 4, gain: 0.55, warp: 0.9, res: 0.4, contrast: 1.4, ramp: [[0, '#d48e48'], [0.45, '#f7d9a6'], [1, '#ffffff']] }), -PAD, -PAD);
    g.globalAlpha = 0.55;
    g.drawImage(L.noiseTex(FW, FH, { seed: 's20fine', scale: 9, octaves: 2, res: 0.5, contrast: 1.6, ramp: [[0, '#dfa868'], [0.5, '#ffffff'], [1, '#ffffff']] }), -PAD, -PAD);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    // long fibres and a few creases
    g.lineCap = 'round';
    for (let i = 0; i < 1700; i++) {
      const x = r.range(-PAD, W + PAD), y = r.range(a.crestY - 10, H + PAD), len = r.range(14, 70), an = r.range(0, Math.PI);
      g.strokeStyle = r.chance(0.6) ? `rgba(136,58,8,${r.range(0.07, 0.24).toFixed(3)})` : `rgba(255,246,214,${r.range(0.08, 0.28).toFixed(3)})`;
      g.lineWidth = r.range(0.5, 1.5);
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(an) * len * 0.5 + r.range(-7, 7), y + Math.sin(an) * len * 0.5 + r.range(-7, 7), x + Math.cos(an) * len, y + Math.sin(an) * len); g.stroke();
    }
    for (let i = 0; i < 18; i++) {
      const x = r.range(-PAD, W + PAD), y = r.range(a.crestY + 20, H + 40), len = r.range(60, 150), an = r.range(-0.5, 0.5) + (r.chance(0.5) ? Math.PI / 2 : 0);
      const dx = Math.cos(an) * len, dy = Math.sin(an) * len, bx = r.range(-12, 12), by = r.range(-12, 12);
      g.lineWidth = 2.2; g.strokeStyle = 'rgba(126,50,6,0.22)'; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + dx / 2 + bx, y + dy / 2 + by, x + dx, y + dy); g.stroke();
      g.lineWidth = 1.4; g.strokeStyle = 'rgba(255,244,206,0.3)'; g.beginPath(); g.moveTo(x + 1.5, y + 2); g.quadraticCurveTo(x + dx / 2 + bx + 1.5, y + dy / 2 + by + 2, x + dx + 1.5, y + dy + 2); g.stroke();
    }
    g.globalAlpha = 0.6; g.drawImage(ao, -PAD, -PAD); g.globalAlpha = 1;
    // the flame itself, burning through the paper as a soft white core
    g.globalCompositeOperation = 'screen';
    g.fillStyle = L.radial(g, lamp.x, lamp.y, 0, 230, [[0, 'rgba(255,252,232,0.95)'], [0.3, 'rgba(255,240,196,0.6)'], [0.65, 'rgba(255,214,140,0.2)'], [1, 'rgba(255,200,120,0)']]);
    g.fillRect(lamp.x - 240, lamp.y - 240, 480, 480);
    g.globalCompositeOperation = 'source-over';
    // the paper-cuts: red paper holds back most of the light, so it multiplies over the glow
    for (const q of cutList(a, G)) {
      const pc = papercut(q.kind, q.r, q.kind + q.x);
      g.save(); g.translate(q.x, q.y); g.rotate(q.rot);
      g.globalCompositeOperation = 'multiply'; g.drawImage(pc, -pc.width / 2, -pc.height / 2);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 0.5; g.drawImage(pc, -pc.width / 2, -pc.height / 2);
      g.restore();
    }
    g.restore();
  });
  return layer;
}

// ───────────────────────── the timber lattice ─────────────────────────
function buildLattice(env, G) {
  const a = env.arc;
  const tex = (seed, sx, sy) => L.polarNoiseLayer(env, PAD, { seed, scale: 7, sx, sy, octaves: 3, contrast: 1.5, res: 0.3, ramp: WOOD });
  const V = L.makeLayer(PAD, (g) => {
    g.fillStyle = g.strokeStyle = '#2a120a';
    strokeDiagonals(g, a, G, DIAG); fillVerticals(g, a, G);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = 0.9; g.drawImage(tex('s20wv', 1, 18), -PAD, -PAD); g.globalAlpha = 1;
    // a rounded face: faint dusk light on the left arris, shadow on the right
    for (const th of G.ribs) a.at(g, th, 0, () => {
      g.fillStyle = 'rgba(176,96,52,0.34)'; g.fillRect(-RIB / 2, 0, 2.6, BAND);
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(RIB / 2 - 3.2, 0, 3.2, BAND);
    });
    g.save(); a.clipBelow(g, -BAND - RAIL + 2);
    for (const x of G.cols) {
      g.fillStyle = 'rgba(176,96,52,0.34)'; g.fillRect(x - MUN / 2, a.crestY, 2.8, FH);
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(x + MUN / 2 - 3.4, a.crestY, 3.4, FH);
    }
    g.restore();
  });
  const Hz = L.makeLayer(PAD, (g) => {
    g.fillStyle = '#2a120a'; fillHorizontals(g, a, G);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = 0.9; g.drawImage(tex('s20wh', 18, 1), -PAD, -PAD); g.globalAlpha = 1;
    g.lineWidth = 2.6; g.strokeStyle = 'rgba(176,96,52,0.36)'; a.stroke(g, FRAME + SOFFIT - 1.5); a.stroke(g, -BAND - 1.5);
    for (const y of G.yH) {
      g.fillStyle = 'rgba(176,96,52,0.34)'; g.fillRect(-PAD, y - MUN / 2, FW, 2.8);
    }
  });
  // flanks and soffits: lit by the paper they stand against, brightest near the lamp
  const side = L.makeLayer(PAD, (g) => {
    g.fillStyle = '#000'; fillVerticals(g, a, G, 0, FLANK); fillHorizontals(g, a, G, 0, SOFFIT);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = L.radial(g, G.lamp.x, G.lamp.y, 0, 1100, [[0, '#e09a48'], [0.25, '#a85c1c'], [0.6, '#743610'], [1, '#48200a']]);
    g.fillRect(-PAD, -PAD, FW, FH);
    // the head's own soffit stays in shadow, so the brightest step in the picture is the paper's edge — exactly on the arc
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R, a.R + SOFFIT, [[0, 'rgba(38,14,4,0.35)'], [1, 'rgba(38,14,4,0.85)']]);
    a.pathBand(g, SOFFIT + 1, 0); g.fill();
  });
  return L.makeLayer(PAD, (g) => { g.drawImage(side, -PAD, -PAD); g.drawImage(V, -PAD, -PAD); g.drawImage(Hz, -PAD, -PAD); });
}

// ───────────────────────── loess wall at dusk ─────────────────────────
function buildWall(env) {
  const a = env.arc;
  return L.makeLayer(PAD, (g) => {
    // mud-and-straw plaster over the loess: deep red-brown overhead, warming toward the opening
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R, a.R + 1000, [[0, '#9e3c17'], [0.13, '#963715'], [0.33, '#7f2c12'], [0.62, '#67210e'], [1, '#501809']]);
    g.fillRect(-PAD, -PAD, FW, FH);
    g.fillStyle = L.linear(g, -PAD, 0, 600, 0, [[0, 'rgba(40,10,4,0.5)'], [1, 'rgba(40,10,4,0)']]); g.fillRect(-PAD, -PAD, FW, FH);
    g.fillStyle = L.linear(g, W + PAD, 0, W - 600, 0, [[0, 'rgba(40,10,4,0.5)'], [1, 'rgba(40,10,4,0)']]); g.fillRect(-PAD, -PAD, FW, FH);
    // broad, soft weathering stains
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.34;
    g.drawImage(L.noiseTex(FW, FH, { seed: 's20stain', scale: 420, octaves: 3, warp: 0.6, res: 0.25, ramp: [[0, '#a8785c'], [0.5, '#ead2be'], [1, '#ffffff']] }), -PAD, -PAD);
    // fine trowelled grain, lit from below by the window
    const hgt = L.noiseTex(FW, FH, { seed: 's20bump', scale: 30, octaves: 4, gain: 0.55, res: 0.4 });
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.17;
    g.drawImage(L.bumpLight(hgt, { angle: 270, strength: 4, res: 0.4 }), -PAD, -PAD);
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.22;
    g.drawImage(L.noiseTex(FW, FH, { seed: 's20grit', scale: 12, octaves: 3, res: 0.4, contrast: 1.7 }), -PAD, -PAD);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    // chopped straw in the plaster, and pits where it has fallen out
    const r = L.rng('s20straw');
    g.lineCap = 'round';
    for (let i = 0; i < 1500; i++) {
      const x = r.range(-PAD, W + PAD), y = r.range(-PAD, a.yAt(L.clamp(x, 0, W)) + 30), len = r.range(7, 24), an = r.gauss() * 0.6;
      g.strokeStyle = r.chance(0.62) ? `rgba(240,170,96,${r.range(0.08, 0.3).toFixed(3)})` : `rgba(40,10,4,${r.range(0.1, 0.3).toFixed(3)})`;
      g.lineWidth = r.range(0.7, 1.6);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(an) * len, y + Math.sin(an) * len); g.stroke();
    }
    L.speckle(g, { seed: 's20pit', count: 700, x: -PAD, y: -PAD, w: FW, h: FH, rMin: 0.8, rMax: 3, colors: ['#3a0f06', '#2a0a04', '#b8602e'], alpha: [0.08, 0.3] });
    // hairline shrinkage cracks, kept well clear of the tagline
    const nz = L.makeNoise('s20crack');
    for (let i = 0; i < 9; i++) {
      const left = i % 2 === 0;
      let x = left ? r.range(-40, 520) : r.range(1400, W + 40), y = r.range(-60, 430), an = r.range(0.9, 2.2);
      for (let b = 0; b < 2; b++) {
        let cx = x, cy = y, ca = an + b * r.range(0.5, 1.1);
        g.strokeStyle = 'rgba(34,8,3,0.34)'; g.lineWidth = b ? 1 : 1.5;
        g.beginPath(); g.moveTo(cx, cy);
        const steps = b ? r.int(8, 16) : r.int(22, 44);
        for (let k2 = 0; k2 < steps; k2++) {
          ca += nz.n2(i * 7.1 + k2 * 0.33, b * 3.7) * 0.5;
          cx += Math.cos(ca) * 7; cy += Math.sin(ca) * 7;
          if (cx > 590 && cx < 1330) break;
          g.lineTo(cx, cy);
        }
        g.stroke();
      }
    }
    // keep the tagline's patch of wall quiet
    const ty = a.crestY - 140;
    g.save(); g.translate(a.cx, ty); g.scale(1, 0.56); g.translate(-a.cx, -ty);
    g.fillStyle = L.radial(g, a.cx, ty, 60, 480, [[0, 'rgba(143,52,20,0.6)'], [0.6, 'rgba(143,52,20,0.36)'], [1, 'rgba(143,52,20,0)']]);
    g.fillRect(a.cx - 500, ty - 500, 1000, 1000); g.restore();
    // lamp light spilling up the wall from the opening: an ember-red fringe that hugs the arc
    g.globalCompositeOperation = 'screen';
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R, a.R + 360, [[0, 'rgba(255,112,36,0.44)'], [0.16, 'rgba(246,92,30,0.3)'], [0.45, 'rgba(224,70,24,0.13)'], [1, 'rgba(200,56,20,0)']]);
    g.fillRect(-PAD, -PAD, FW, FH);
    g.globalCompositeOperation = 'source-over';
    // the reveal: a line of shadow where the plaster turns in to meet the frame
    g.lineWidth = 10; g.strokeStyle = 'rgba(30,8,3,0.36)'; a.stroke(g, FRAME + SOFFIT + 4);
  });
}

// ───────────────────────── harvest strings, far out to the sides ─────────────────────────
function chiliString(g, x0, yTop, yEnd, seed, k = 1) {
  const r = L.rng('s20chili' + seed);
  const step = 15 * k, n = Math.round((yEnd - 118 * k - yTop) / step);
  for (let i = n; i >= 0; i--) {          // bottom → top, so each pod overlaps the stems below it
    const y = yTop + i * step;
    for (let j = 0; j < 3; j++) {
      const ang = L.clamp(r.gauss() * 0.5, -1.05, 1.05);
      const len = r.range(92, 146) * k, wid = r.range(17, 25) * k, bend = r.range(-0.4, 0.4) * len * 0.3;
      const base = r.pick(['#b3170f', '#c9241a', '#9a120c', '#d4301c', '#7d0e0a', '#a8140e']);
      g.save(); g.translate(x0 + ang * 16 * k + r.range(-5, 5) * k, y + r.range(-6, 6)); g.rotate(-ang);
      g.fillStyle = L.linear(g, -wid / 2, 0, wid / 2, 0, [[0, L.shade(base, -0.4)], [0.3, L.shade(base, 0.16)], [0.58, base], [1, L.shade(base, -0.58)]]);
      g.beginPath(); g.moveTo(-wid / 2, 0);
      g.bezierCurveTo(-wid * 0.74, len * 0.35, bend - wid * 0.22, len * 0.8, bend, len);
      g.bezierCurveTo(bend + wid * 0.26, len * 0.75, wid * 0.74, len * 0.35, wid / 2, 0); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,170,130,0.6)'; g.lineWidth = 2.2 * k; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-wid * 0.2, len * 0.08); g.quadraticCurveTo(-wid * 0.3, len * 0.4, bend * 0.6 - wid * 0.06, len * 0.72); g.stroke();
      g.fillStyle = '#4c3912'; g.beginPath(); g.ellipse(0, 0, wid * 0.46, 5 * k, 0, 0, L.TAU); g.fill();
      g.strokeStyle = '#6f5c22'; g.lineWidth = 3 * k; g.beginPath(); g.moveTo(0, 0); g.lineTo(-Math.sin(ang) * 6 * k, -11 * k); g.stroke();
      g.restore();
    }
  }
}
/** one maize cob hanging from its pulled-back husk; fs < 1 foreshortens a cob that points at the viewer */
function cob(g, r, k, fs = 1) {
  const len = r.range(126, 150) * k * fs, w0 = r.range(29, 33) * k;
  const base = r.pick(['#ee981c', '#e48816', '#f2a424', '#d97a12']);
  g.strokeStyle = 'rgba(216,168,92,0.9)'; g.lineWidth = 5 * k; g.lineCap = 'round';
  for (let j = -1; j <= 1; j++) { g.beginPath(); g.moveTo(j * 6 * k, -16 * k); g.quadraticCurveTo(j * 13 * k, 0, j * w0 * 0.62, 22 * k); g.stroke(); }
  g.save();
  g.beginPath(); g.moveTo(-w0 * 0.9, 16 * k);
  g.bezierCurveTo(-w0 * 1.12, len * 0.5, -w0 * 0.84, len + 14 * k, 0, len + 14 * k);
  g.bezierCurveTo(w0 * 0.84, len + 14 * k, w0 * 1.12, len * 0.5, w0 * 0.9, 16 * k);
  g.quadraticCurveTo(0, 2 * k, -w0 * 0.9, 16 * k); g.closePath(); g.clip();
  g.fillStyle = '#5e2c06'; g.fillRect(-w0 * 1.3, 0, w0 * 2.6, len + 40 * k);
  const kw = 10.6 * k, kh = 8.8 * k * (fs < 1 ? 0.78 : 1);
  for (let yy = 12 * k; yy < len + 20 * k; yy += kh) {
    for (let xx = -w0 * 1.08; xx < w0 * 1.15; xx += kw) {
      const lit = 1 - Math.abs(xx / w0 + 0.3) + r.range(-0.1, 0.1);
      g.fillStyle = lit > 0.62 ? L.mix(base, '#ffe28c', L.clamp((lit - 0.62) * 1.5)) : L.mix(base, '#6a3206', L.clamp((0.62 - lit) * 1.15));
      g.beginPath(); g.ellipse(xx, yy, kw * 0.42, kh * 0.4, 0, 0, L.TAU); g.fill();
    }
  }
  g.restore();
}
function cornString(g, x0, yTop, yEnd, seed, k = 1) {
  const r = L.rng('s20corn' + seed);
  const step = 56 * k, n = Math.floor((yEnd - 170 * k - yTop) / step);
  g.strokeStyle = '#9c7a44'; g.lineWidth = 22 * k; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x0, yTop - 60); g.lineTo(x0, yTop + n * step); g.stroke();
  for (let i = n; i >= 0; i--) {          // bottom → top
    const y = yTop + i * step;
    for (const side of (i % 2 ? [1, -1] : [-1, 1])) {
      g.save(); g.translate(x0 + side * 9 * k, y); g.rotate(-side * r.range(0.36, 0.86)); cob(g, r, k); g.restore();
    }
    g.save(); g.translate(x0 + r.range(-7, 7) * k, y + 16 * k); g.rotate(r.range(-0.18, 0.18)); cob(g, r, k, 0.6); g.restore();
  }
}
function buildStrings(env) {
  const a = env.arc;
  const sharp = L.makeLayer(PAD, (g) => {
    const end = (x, gap) => a.yAt(L.clamp(x, 0, W)) - gap;
    cornString(g, -46, -PAD - 40, end(-46, 96), 'L', 1.1);
    chiliString(g, 222, -PAD - 40, end(222, 66), 'L', 1.3);
    cornString(g, 1700, -PAD - 40, end(1700, 60), 'R', 1.0);
    chiliString(g, 1962, -PAD - 40, end(1962, 100), 'R', 1.4);
    // dusk: they are dim up high, and pick up the window's warmth toward their tips
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = L.linear(g, 0, -PAD, 0, 700, [[0, 'rgba(30,7,3,0.6)'], [0.55, 'rgba(36,9,4,0.36)'], [1, 'rgba(60,16,5,0.1)']]);
    g.fillRect(-PAD, -PAD, FW, FH);
    g.fillStyle = 'rgba(214,64,10,0.12)'; g.fillRect(-PAD, -PAD, FW, FH);
  });
  return L.makeLayer(PAD, (g) => {
    g.save(); g.globalAlpha = 0.55; g.filter = 'blur(18px) brightness(0)'; g.drawImage(sharp, -PAD + 18, -PAD + 12); g.restore();
    g.filter = 'blur(4px)'; g.drawImage(sharp, -PAD, -PAD); g.filter = 'none';
  });
}

export default {
  name: '窑洞灯火',
  tone: 'light',
  init(env) {
    const a = env.arc, G = geom(a);
    const paper = buildPaper(env, G);
    const win = L.makeLayer(PAD, (g) => { g.drawImage(paper, -PAD, -PAD); g.drawImage(buildLattice(env, G), -PAD, -PAD); });
    const halo = soft(win, 13, 2);        // halation: it eats into the bars near the lamp and leaves the far ones crisp
    {
      const hg = halo.getContext('2d');
      hg.globalCompositeOperation = 'source-atop'; hg.fillStyle = 'rgba(255,128,30,0.6)'; hg.fillRect(0, 0, halo.width, halo.height);
      hg.globalCompositeOperation = 'destination-in';
      hg.fillStyle = L.radial(hg, G.lamp.x + PAD, G.lamp.y + PAD, 40, 1000, [[0, 'rgba(0,0,0,1)'], [0.1, 'rgba(0,0,0,0.5)'], [0.24, 'rgba(0,0,0,0.13)'], [1, 'rgba(0,0,0,0.04)']]);
      hg.fillRect(0, 0, halo.width, halo.height);
    }
    const haze = soft(win, 84, 6);        // wide fog of lamp light, reddened like light through dust
    const fog = L.makeLayer(PAD, (g) => {
      g.drawImage(haze, -PAD, -PAD);
      g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,88,26,0.55)'; g.fillRect(-PAD, -PAD, FW, FH);
    });
    const base = L.makeLayer(PAD, (g) => {
      g.drawImage(buildWall(env), -PAD, -PAD);
      g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.58; g.drawImage(fog, -PAD, -PAD);   // the fog lies on the wall…
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.drawImage(win, -PAD, -PAD);
      g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.75; g.drawImage(halo, -PAD, -PAD);  // …the bars only get a breath of halation
    });
    // soft focus: fold a blurred copy back in
    const scene = L.makeLayer(PAD, (g) => { g.drawImage(base, -PAD, -PAD); g.globalAlpha = 0.36; g.drawImage(soft(base, 11, 2), -PAD, -PAD); });
    S = { scene, fog, strings: buildStrings(env), lamp: G.lamp };
  },
  draw(ctx, env, p) {
    const f = env.frame;
    // the push-in is centred on p = 0.5, so the arc is exact mid-shot and within ~3 px at the far edges throughout
    const zoom = L.lerp(0.988, 1.012, p);
    // oil-lamp flicker (deterministic)
    const fl = 0.5 + 0.5 * (0.62 * Math.sin(f * 2.3 + 0.6) + 0.38 * Math.sin(f * 5.1 + 1.9));
    L.blit(ctx, env, S.scene, { zoom });
    L.blit(ctx, env, S.strings, { zoom: 1 + (zoom - 1) * 2.4 });
    L.blit(ctx, env, S.fog, { zoom, alpha: 0.03 + 0.07 * fl, blend: 'screen' });
    L.glow(ctx, S.lamp.x, S.lamp.y, 300, '#ffdc9a', 0.09 + 0.08 * fl);
    L.vignette(ctx, { strength: 0.36, color: '#1c0703', inner: 0.5, outer: 1.08 });
  },
};
