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
const FRAME = 16;                     // bowed head of the window frame — sits just OUTSIDE the arc, so lit paper starts exactly on it
const BAND = 132;                     // depth of the fan of radial ribs under the arch
const RAIL = 22;                      // concentric rail that closes the fan
const RIB = 16, RIB_PITCH = 96;       // radial ribs: width / spacing along the arc
const P = 196, MUN = 18;              // square lattice below: pitch / muntin width
const WOOD = [[0, '#140805'], [0.45, '#2a120a'], [1, '#4d2614']];
const RED = '#d92a1a';
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
  return { y0, yH, ribs, cols };
}
/** radial ribs + vertical muntins (grow widens them — used for the glue/shadow mask) */
function fillVerticals(g, a, G, grow = 0) {
  for (const th of G.ribs) a.at(g, th, 0, () => g.fillRect(-RIB / 2 - grow, -3, RIB + grow * 2, BAND + 6));
  g.save(); a.clipBelow(g, -BAND - RAIL + 2);
  for (const x of G.cols) g.fillRect(x - MUN / 2 - grow, a.crestY, MUN + grow * 2, FH);
  g.restore();
}
/** frame head, rail and horizontal muntins. The middle pane is two cells tall, so the first muntin skips it. */
function fillHorizontals(g, a, G, grow = 0) {
  a.pathBand(g, FRAME + grow, 0); g.fill();
  a.pathBand(g, -BAND + grow, -BAND - RAIL - grow); g.fill();
  g.save(); a.clipBelow(g, -BAND - RAIL + 2);
  G.yH.forEach((y, j) => {
    if (j === 0) {
      g.fillRect(-PAD - 50, y - MUN / 2 - grow, a.cx - P + 50 + PAD, MUN + grow * 2);
      g.fillRect(a.cx + P, y - MUN / 2 - grow, W / 2 + PAD + 50, MUN + grow * 2);
    } else g.fillRect(-PAD - 50, y - MUN / 2 - grow, FW + 100, MUN + grow * 2);
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
  const lamp = { x: a.cx - 70, y: a.crestY + 300 };
  // soft brown haze hugging every bar: paste lines, doubled paper, and the bar's own thickness
  const ao = L.blurred(L.makeLayer(PAD, (g) => { g.fillStyle = '#8a3508'; fillVerticals(g, a, G, 3); fillHorizontals(g, a, G, 3); }), 7);
  const layer = L.makeLayer(PAD, (g) => {
    g.save(); a.clipBelow(g, 1);
    // the lamp behind the paper: hot core falling off to deep orange in the corners
    g.fillStyle = L.radial(g, lamp.x, lamp.y, 0, 1380, [[0, '#fff4cc'], [0.09, '#ffe8a8'], [0.25, '#ffd98a'], [0.5, '#ffb44a'], [0.75, '#ea8629'], [1, '#b24f18']]);
    g.fillRect(-PAD, -PAD, FW, FH);
    // each pane is its own little sheet: slightly different thickness
    const r = L.rng('s20pane');
    for (let i = 0; i < G.ribs.length - 1; i++) { g.fillStyle = `rgba(150,64,8,${r.range(0, 0.13).toFixed(3)})`; a.pathBand(g, 0, -BAND, G.ribs[i], G.ribs[i + 1]); g.fill(); }
    const xs = [a.cx - P, a.cx + P, ...G.cols].sort((p, q) => p - q);
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = `rgba(150,64,8,${r.range(0, 0.12).toFixed(3)})`;
      g.fillRect(xs[i], j ? G.yH[0] : a.crestY + BAND, xs[i + 1] - xs[i], P);
    }
    // cloudy fibre of hand-made paper seen by transmitted light
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.75;
    g.drawImage(L.noiseTex(FW, FH, { seed: 's20cloud', scale: 64, octaves: 4, gain: 0.55, warp: 0.9, res: 0.4, contrast: 1.35, ramp: [[0, '#d99a58'], [0.45, '#f6dcb2'], [1, '#ffffff']] }), -PAD, -PAD);
    g.globalAlpha = 0.5;
    g.drawImage(L.noiseTex(FW, FH, { seed: 's20fine', scale: 9, octaves: 2, res: 0.5, contrast: 1.6, ramp: [[0, '#e2b078'], [0.5, '#ffffff'], [1, '#ffffff']] }), -PAD, -PAD);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    // long fibres and a few creases
    g.lineCap = 'round';
    for (let i = 0; i < 1500; i++) {
      const x = r.range(-PAD, W + PAD), y = r.range(a.crestY - 10, H + PAD), len = r.range(14, 70), an = r.range(0, Math.PI);
      g.strokeStyle = r.chance(0.6) ? `rgba(140,66,12,${r.range(0.06, 0.2).toFixed(3)})` : `rgba(255,246,214,${r.range(0.08, 0.26).toFixed(3)})`;
      g.lineWidth = r.range(0.5, 1.5);
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(an) * len * 0.5 + r.range(-7, 7), y + Math.sin(an) * len * 0.5 + r.range(-7, 7), x + Math.cos(an) * len, y + Math.sin(an) * len); g.stroke();
    }
    for (let i = 0; i < 16; i++) {
      const x = r.range(-PAD, W + PAD), y = r.range(a.crestY + 20, H + 40), len = r.range(60, 150), an = r.range(-0.5, 0.5) + (r.chance(0.5) ? Math.PI / 2 : 0);
      const dx = Math.cos(an) * len, dy = Math.sin(an) * len, bx = r.range(-12, 12), by = r.range(-12, 12);
      g.lineWidth = 2.2; g.strokeStyle = 'rgba(130,56,8,0.2)'; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + dx / 2 + bx, y + dy / 2 + by, x + dx, y + dy); g.stroke();
      g.lineWidth = 1.4; g.strokeStyle = 'rgba(255,244,206,0.3)'; g.beginPath(); g.moveTo(x + 1.5, y + 2); g.quadraticCurveTo(x + dx / 2 + bx + 1.5, y + dy / 2 + by + 2, x + dx + 1.5, y + dy + 2); g.stroke();
    }
    g.globalAlpha = 0.62; g.drawImage(ao, -PAD, -PAD); g.globalAlpha = 1;
    // the paper-cuts: red paper holds back most of the light, so it multiplies over the glow
    for (const q of cutList(a, G)) {
      const pc = papercut(q.kind, q.r, q.kind + q.x);
      g.save(); g.translate(q.x, q.y); g.rotate(q.rot);
      g.globalCompositeOperation = 'multiply'; g.drawImage(pc, -pc.width / 2, -pc.height / 2);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 0.3; g.drawImage(pc, -pc.width / 2, -pc.height / 2);
      g.restore();
    }
    g.restore();
  });
  layer._lamp = lamp;
  return layer;
}

// ───────────────────────── the timber lattice ─────────────────────────
function buildLattice(env, G) {
  const a = env.arc;
  const tex = (seed, sx, sy) => L.polarNoiseLayer(env, PAD, { seed, scale: 7, sx, sy, octaves: 3, contrast: 1.5, res: 0.4, ramp: WOOD });
  const V = L.makeLayer(PAD, (g) => {
    g.fillStyle = '#2a120a'; fillVerticals(g, a, G);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = 0.9; g.drawImage(tex('s20wv', 1, 18), -PAD, -PAD); g.globalAlpha = 1;
    // a rounded face: faint dusk light on the left arris, shadow on the right
    for (const th of G.ribs) a.at(g, th, 0, () => {
      g.fillStyle = 'rgba(176,96,52,0.34)'; g.fillRect(-RIB / 2, 0, 2.6, BAND);
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(RIB / 2 - 3.2, 0, 3.2, BAND);
    });
    for (const x of G.cols) {
      g.fillStyle = 'rgba(176,96,52,0.34)'; g.fillRect(x - MUN / 2, a.crestY, 2.8, FH);
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(x + MUN / 2 - 3.4, a.crestY, 3.4, FH);
    }
  });
  const Hz = L.makeLayer(PAD, (g) => {
    g.fillStyle = '#2a120a'; fillHorizontals(g, a, G);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = 0.9; g.drawImage(tex('s20wh', 18, 1), -PAD, -PAD); g.globalAlpha = 1;
    g.lineWidth = 2.6; g.strokeStyle = 'rgba(176,96,52,0.36)'; a.stroke(g, FRAME - 1.5); a.stroke(g, -BAND - 1.5);
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3.2; a.stroke(g, -BAND - RAIL + 1.6);
    for (const y of G.yH) {
      g.fillStyle = 'rgba(176,96,52,0.34)'; g.fillRect(-PAD, y - MUN / 2, FW, 2.8);
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(-PAD, y + MUN / 2 - 3.4, FW, 3.4);
    }
  });
  return L.makeLayer(PAD, (g) => { g.drawImage(V, -PAD, -PAD); g.drawImage(Hz, -PAD, -PAD); });
}

// ───────────────────────── loess wall at dusk ─────────────────────────
function buildWall(env) {
  const a = env.arc;
  return L.makeLayer(PAD, (g) => {
    // mud-and-straw plaster: warmest where the window's glow reaches it, sinking to deep red-brown overhead
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R, a.R + 1000, [[0, '#a23f18'], [0.13, '#993916'], [0.33, '#812d12'], [0.62, '#69220e'], [1, '#52190b']]);
    g.fillRect(-PAD, -PAD, FW, FH);
    g.fillStyle = L.linear(g, -PAD, 0, 620, 0, [[0, 'rgba(46,12,5,0.5)'], [1, 'rgba(46,12,5,0)']]); g.fillRect(-PAD, -PAD, FW, FH);
    g.fillStyle = L.linear(g, W + PAD, 0, W - 620, 0, [[0, 'rgba(46,12,5,0.5)'], [1, 'rgba(46,12,5,0)']]); g.fillRect(-PAD, -PAD, FW, FH);
    // broad weathering stains
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.6;
    g.drawImage(L.noiseTex(FW, FH, { seed: 's20stain', scale: 360, octaves: 4, warp: 0.7, res: 0.25, ramp: [[0, '#9a664a'], [0.5, '#e4c6ae'], [1, '#ffffff']] }), -PAD, -PAD);
    // trowelled relief
    const hgt = L.noiseTex(FW, FH, { seed: 's20bump', scale: 70, octaves: 5, gain: 0.6, warp: 0.5, res: 0.4 });
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.55;
    g.drawImage(L.bumpLight(hgt, { angle: 270, strength: 5, res: 0.4 }), -PAD, -PAD);
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.4;
    g.drawImage(L.noiseTex(FW, FH, { seed: 's20grit', scale: 14, octaves: 3, res: 0.5, contrast: 1.8 }), -PAD, -PAD);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    // chopped straw in the plaster, and pits where it has fallen out
    const r = L.rng('s20straw');
    g.lineCap = 'round';
    for (let i = 0; i < 1700; i++) {
      const x = r.range(-PAD, W + PAD), y = r.range(-PAD, a.yAt(L.clamp(x, 0, W)) + 30), len = r.range(7, 26), an = r.gauss() * 0.55;
      g.strokeStyle = r.chance(0.62) ? `rgba(236,170,98,${r.range(0.08, 0.3).toFixed(3)})` : `rgba(40,10,4,${r.range(0.12, 0.34).toFixed(3)})`;
      g.lineWidth = r.range(0.7, 1.7);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(an) * len, y + Math.sin(an) * len); g.stroke();
    }
    L.speckle(g, { seed: 's20pit', count: 900, x: -PAD, y: -PAD, w: FW, h: FH, rMin: 0.8, rMax: 3.4, colors: ['#3a0f06', '#2a0a04', '#c26a34'], alpha: [0.1, 0.42] });
    // keep the tagline's patch of wall quiet
    g.fillStyle = L.radial(g, a.cx, a.crestY - 140, 60, 470, [[0, 'rgba(147,54,21,0.5)'], [0.6, 'rgba(147,54,21,0.3)'], [1, 'rgba(147,54,21,0)']]);
    g.save(); g.translate(a.cx, a.crestY - 140); g.scale(1, 0.56); g.translate(-a.cx, -(a.crestY - 140));
    g.fillRect(a.cx - 500, a.crestY - 140 - 500, 1000, 1000); g.restore();
    // the reveal: a line of shadow where the plaster turns in to meet the frame, then a lip catching the glow
    g.lineWidth = 12; g.strokeStyle = 'rgba(30,8,3,0.4)'; a.stroke(g, FRAME + 5);
    g.lineWidth = 2; g.strokeStyle = 'rgba(255,170,96,0.22)'; a.stroke(g, FRAME + 12);
  });
}

// ───────────────────────── harvest strings, far out to the sides ─────────────────────────
function chiliString(g, x0, yTop, yEnd, seed, k = 1) {
  const r = L.rng('s20chili' + seed);
  const n = Math.round((yEnd - yTop) / (12 * k));
  g.strokeStyle = '#5a3a1c'; g.lineWidth = 5 * k; g.beginPath(); g.moveTo(x0, yTop); g.lineTo(x0, yEnd - 70 * k); g.stroke();
  for (let i = n; i >= 0; i--) {          // bottom → top, so each pod overlaps the stems below it
    const u = i / n, y = L.lerp(yTop, yEnd - 84 * k, u);
    const side = i % 2 ? 1 : -1;
    for (let j = 0; j < 2; j++) {
      const ang = side * (j ? r.range(0.1, 0.45) : r.range(0.5, 0.95)) + r.range(-0.1, 0.1);
      const len = r.range(66, 98) * k, wid = r.range(13, 19) * k, bend = r.range(-0.3, 0.3) * len * 0.3;
      const base = r.pick(['#b3170f', '#c9241a', '#9a120c', '#d4301c', '#7d0e0a']);
      g.save(); g.translate(x0 + r.range(-7, 7) * k, y + r.range(-5, 5)); g.rotate(-ang);
      g.fillStyle = L.linear(g, -wid / 2, 0, wid / 2, 0, [[0, L.shade(base, -0.35)], [0.32, L.shade(base, 0.14)], [0.6, base], [1, L.shade(base, -0.5)]]);
      g.beginPath(); g.moveTo(-wid / 2, 0);
      g.bezierCurveTo(-wid * 0.72, len * 0.35, bend - wid * 0.2, len * 0.8, bend, len);
      g.bezierCurveTo(bend + wid * 0.25, len * 0.75, wid * 0.72, len * 0.35, wid / 2, 0); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,176,140,0.5)'; g.lineWidth = 1.7 * k; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-wid * 0.2, len * 0.08); g.quadraticCurveTo(-wid * 0.3, len * 0.4, bend * 0.6 - wid * 0.06, len * 0.72); g.stroke();
      g.fillStyle = '#4a3a14'; g.beginPath(); g.ellipse(0, 0, wid * 0.44, 4.2 * k, 0, 0, L.TAU); g.fill();
      g.strokeStyle = '#6a5a24'; g.lineWidth = 2.4 * k; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -9 * k); g.stroke();
      g.restore();
    }
  }
}
function cob(g, r, k) {
  const len = r.range(106, 126) * k, w0 = r.range(20, 23) * k, w1 = w0 * 0.55;
  const base = r.pick(['#e2a22c', '#d8922a', '#eab040', '#c98222']);
  g.strokeStyle = 'rgba(217,188,132,0.85)'; g.lineWidth = 3.2 * k; g.lineCap = 'round';
  for (let j = -1; j <= 1; j++) { g.beginPath(); g.moveTo(j * 5 * k, -12 * k); g.quadraticCurveTo(j * 9 * k, 0, j * w0 * 0.6, 15 * k); g.stroke(); }
  g.save();
  g.beginPath(); g.moveTo(-w0, 14 * k);
  g.bezierCurveTo(-w0 * 1.08, len * 0.5, -w1 * 1.2, len * 0.9, 0, len + 14 * k);
  g.bezierCurveTo(w1 * 1.2, len * 0.9, w0 * 1.08, len * 0.5, w0, 14 * k);
  g.quadraticCurveTo(0, 2 * k, -w0, 14 * k); g.closePath(); g.clip();
  g.fillStyle = L.shade(base, -0.5); g.fillRect(-w0 * 1.3, 0, w0 * 2.6, len + 40 * k);
  const kw = 7.2 * k, kh = 6.4 * k;
  for (let yy = 10 * k, row = 0; yy < len + 18 * k; yy += kh, row++) {
    for (let xx = -w0 * 1.1 + (row % 2) * kw * 0.5; xx < w0 * 1.15; xx += kw) {
      const lit = 1 - Math.abs(xx / w0 + 0.3);
      g.fillStyle = L.shade(base, L.clamp(-0.34 + 0.55 * lit + r.range(-0.08, 0.08), -0.6, 0.4));
      g.beginPath(); g.ellipse(xx, yy, kw * 0.45, kh * 0.45, 0, 0, L.TAU); g.fill();
    }
  }
  g.restore();
}
function cornString(g, x0, yTop, yEnd, seed, k = 1) {
  const r = L.rng('s20corn' + seed);
  const step = 44 * k, n = Math.floor((yEnd - 120 * k - yTop) / step);
  g.strokeStyle = '#a8844a'; g.lineWidth = 16 * k; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x0, yTop - 40); g.lineTo(x0, yTop + n * step); g.stroke();
  for (let i = n; i >= 0; i--) {
    const y = yTop + i * step;
    for (const side of (i % 2 ? [1, -1] : [-1, 1])) {
      g.save(); g.translate(x0 + side * 4 * k, y); g.rotate(-side * r.range(0.4, 0.62)); cob(g, r, k); g.restore();
    }
  }
}
function buildStrings(env) {
  const a = env.arc;
  const sharp = L.makeLayer(PAD, (g) => {
    const end = (x, gap) => a.yAt(x) - gap;
    cornString(g, 34, -PAD - 30, end(34, 78), 'L', 1.08);
    chiliString(g, 246, -PAD - 30, end(246, 74), 'L', 1.0);
    cornString(g, 1688, -PAD - 30, end(1688, 66), 'R', 1.0);
    chiliString(g, 1884, -PAD - 30, end(1884, 84), 'R', 1.08);
    // dusk: they are dim up high, and pick up the window's warmth toward their tips
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = L.linear(g, 0, -PAD, 0, 720, [[0, 'rgba(34,8,4,0.62)'], [0.6, 'rgba(40,10,4,0.36)'], [1, 'rgba(70,20,6,0.12)']]);
    g.fillRect(-PAD, -PAD, FW, FH);
  });
  return L.makeLayer(PAD, (g) => {
    g.save(); g.globalAlpha = 0.5; g.filter = 'blur(16px) brightness(0)'; g.drawImage(sharp, -PAD + 16, -PAD + 12); g.restore();
    g.filter = 'blur(4.5px)'; g.drawImage(sharp, -PAD, -PAD); g.filter = 'none';
  });
}

export default {
  name: '窑洞灯火',
  tone: 'light',
  init(env) {
    const a = env.arc, G = geom(a);
    const paper = buildPaper(env, G);
    const win = L.makeLayer(PAD, (g) => { g.drawImage(paper, -PAD, -PAD); g.drawImage(buildLattice(env, G), -PAD, -PAD); });
    const halo = soft(win, 12, 2);        // tight halation that eats into the bars
    const haze = soft(win, 90, 6);        // wide fog of lamp light over the wall
    const base = L.makeLayer(PAD, (g) => {
      g.drawImage(buildWall(env), -PAD, -PAD);
      g.drawImage(win, -PAD, -PAD);
      g.globalCompositeOperation = 'screen';
      g.globalAlpha = 0.34; g.drawImage(halo, 0 - PAD, -PAD);
      g.globalAlpha = 0.42; g.drawImage(haze, -PAD, -PAD);
      g.globalAlpha = 1;
      g.fillStyle = L.radial(g, a.cx, a.crestY + 260, 0, 1500, [[0, 'rgba(255,150,60,0.16)'], [0.5, 'rgba(255,120,40,0.08)'], [1, 'rgba(255,110,40,0)']]);
      g.fillRect(-PAD, -PAD, FW, FH);
    });
    // soft focus: fold a blurred copy back in
    const scene = L.makeLayer(PAD, (g) => { g.drawImage(base, -PAD, -PAD); g.globalAlpha = 0.3; g.drawImage(soft(base, 8, 2), -PAD, -PAD); });
    S = { scene, haze, strings: buildStrings(env), lamp: paper._lamp };
  },
  draw(ctx, env, p) {
    const f = env.frame;
    // the push-in is centred on p = 0.5, so the arc is exact mid-shot and within ~3 px at the far edges throughout
    const zoom = L.lerp(0.988, 1.012, p);
    // oil-lamp flicker (deterministic)
    const fl = 0.5 + 0.5 * (0.62 * Math.sin(f * 2.3 + 0.6) + 0.38 * Math.sin(f * 5.1 + 1.9));
    L.blit(ctx, env, S.scene, { zoom });
    L.blit(ctx, env, S.strings, { zoom: 1 + (zoom - 1) * 2.4 });
    L.blit(ctx, env, S.haze, { zoom, alpha: 0.05 + 0.1 * fl, blend: 'screen' });
    L.glow(ctx, S.lamp.x, S.lamp.y, 520, '#ffd28a', 0.1 + 0.07 * fl);
    L.vignette(ctx, { strength: 0.34, color: '#1c0703', inner: 0.5, outer: 1.08 });
  },
};
