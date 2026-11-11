// s34 — 五行生克图. A macro look at one corner of a drafting sheet: white drawing paper, fine-liner ink.
// The shared arc IS the diagram's outer circle — one even ink line. On its crest sits one of the five nodes, a small ink
// ring pressed onto the circle with its body inside. From that node, two vermilion lines run to the two neighbouring
// nodes (相生 — two edges of the pentagon, 36° below the tangent) and two blue lines to the next-but-one nodes
// (相克 — two edges of the pentagram, 72°, steeper). Directions are consistent with the cycle, clockwise = forward:
//   red right  : crest → next node      (arrow away from the crest)    red left  : previous node → crest (arrow toward it)
//   blue right : crest → node after next (arrow away)                  blue left : node before previous → crest (arrow toward)
// The rest is construction: a vertical axis, an inner concentric circle, ruled set-square lines parallel to the
// pentagon/pentagram directions (sometimes doubled or tripled), a few cross marks and a faint graphite underdrawing.
// No characters are written. Paper and lines are rendered once with a shallow depth of field; draw() only blits.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 90;
const PAPER = '#f4f2ec', INK = '#1a1a1a', RED = '#d23a2a', BLUE = '#2a6fb8';
const D2R = Math.PI / 180;
let S = null;

// ───────── pen helpers ─────────
/** a ruled fine-liner line from (x0,y0) to (x1,y1): tiny wobble, pressure variation, slightly heavier where the pen lands */
function penLine(g, x0, y0, x1, y1, o = {}) {
  const { w = 2.6, color = INK, alpha = 0.92, seed = 1, wob = 0.5, step = 26 } = o;
  const nz = L.makeNoise('s34pen' + seed);
  const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.ceil(len / step));
  const ux = (x1 - x0) / len, uy = (y1 - y0) / len, nx = -uy, ny = ux;
  const lf = [], rt = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, s = t * len;
    const off = wob * nz.n2(s / 180, 0.3) + wob * 0.35 * nz.n2(s / 40, 7.1);
    const ww = w * (0.86 + 0.16 * nz.n2(s / 260, 4.4) + 0.06 * nz.n2(s / 30, 9.9)) / 2;
    const cx = x0 + ux * s + nx * off, cy = y0 + uy * s + ny * off;
    lf.push([cx + nx * ww, cy + ny * ww]); rt.push([cx - nx * ww, cy - ny * ww]);
  }
  g.save();
  g.globalAlpha *= alpha; g.fillStyle = color;
  g.beginPath(); g.moveTo(lf[0][0], lf[0][1]);
  for (const p of lf) g.lineTo(p[0], p[1]);
  for (let i = rt.length - 1; i >= 0; i--) g.lineTo(rt[i][0], rt[i][1]);
  g.closePath(); g.fill();
  g.restore();
}
/** infinite line through (px,py) with direction angle a (deg, screen space), drawn long enough to leave the frame */
function rayLine(g, px, py, a, o) {
  const ux = Math.cos(a * D2R), uy = Math.sin(a * D2R), Lh = 2600;
  penLine(g, px - ux * Lh, py - uy * Lh, px + ux * Lh, py + uy * Lh, o);
}
/** filled slender arrowhead at (x,y) pointing along angle a (deg) */
function arrow(g, x, y, a, len, wid, color) {
  g.save(); g.translate(x, y); g.rotate(a * D2R); g.fillStyle = color;
  g.beginPath(); g.moveTo(len * 0.5, 0);
  g.quadraticCurveTo(-len * 0.1, -wid * 0.18, -len * 0.5, -wid / 2);
  g.lineTo(-len * 0.32, 0);
  g.lineTo(-len * 0.5, wid / 2);
  g.quadraticCurveTo(-len * 0.1, wid * 0.18, len * 0.5, 0);
  g.fill(); g.restore();
}

// ───────── layers ─────────
function paperLayer(env) {
  const a = env.arc;
  const TW = W + PAD * 2, TH = H + PAD * 2;
  const tex = L.paperTex(TW, TH, { base: PAPER, seed: 3407, tone: '#9a9488', fiber: 0.55, stain: 0.18, grain: 0.1 });
  return L.makeLayer(PAD, (g) => {
    g.drawImage(tex, -PAD, -PAD);
    // soft light falloff: a broad pool of light around the crest, the sheet dims gently toward the corners/top
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = L.radial(g, a.cx - 80, a.crestY + 40, 200, 1500, [[0, '#ffffff'], [0.45, '#f7f6f3'], [1, '#d9d6cf']]);
    g.fillRect(-PAD, -PAD, TW, TH);
    g.fillStyle = L.linear(g, 0, -PAD, 0, H + PAD, [[0, '#e6e5e2'], [0.3, '#fbfbfa'], [0.6, '#ffffff'], [1, '#ebe8e2']]);
    g.fillRect(-PAD, -PAD, TW, TH);
    g.globalCompositeOperation = 'source-over';
  });
}

/** black construction drawing + graphite underdrawing (all below the arc) and the outer circle itself */
function inkLayer(env, geo) {
  const a = env.arc;
  return L.makeLayer(PAD, (g) => {
    const r = L.rng('s34ink');
    // graphite underdrawing: faint, slightly off-register guide lines under everything
    g.save(); a.clipBelow(g, 0);
    const gr = '#7d7f86';
    [[-36, 14], [36, -18], [-72, 9], [72, -11], [-36, -170], [54, 210], [-54, -240]].forEach(([ang, off], i) => {
      const n = [-Math.sin(ang * D2R), Math.cos(ang * D2R)];
      rayLine(g, a.cx + n[0] * off, a.crestY + n[1] * off, ang, { w: 1.6, color: gr, alpha: 0.26, seed: 50 + i, wob: 1.2 });
    });
    g.lineWidth = 1.4; g.strokeStyle = L.rgba(gr, 0.25);
    a.stroke(g, -470); a.stroke(g, -306);
    g.restore();

    // ruled construction lines, parallel to the pentagon (±36°) and pentagram (±72°) edges, plus a few at ±54°
    // [direction°, perpendicular offset from the crest, width, alpha]
    const RULE = [
      [36, -150, 2.6, 0.9], [36, -163, 2.2, 0.8], [36, 255, 2.8, 0.92], [36, 520, 2.4, 0.85], [36, 790, 2.6, 0.88],
      [144, 190, 2.6, 0.9], [144, -300, 2.4, 0.86], [144, -316, 2.2, 0.8], [144, -333, 2.6, 0.88], [144, 610, 2.6, 0.9], [144, -700, 2.6, 0.9],
      [72, -105, 2.4, 0.86], [72, 420, 2.6, 0.9], [108, 135, 2.4, 0.86], [108, -455, 2.6, 0.88], [108, -470, 2.2, 0.8],
      [54, -380, 2.4, 0.85], [126, 400, 2.4, 0.85], [54, 880, 2.4, 0.84], [126, -940, 2.4, 0.84],
    ];
    g.save(); a.clipBelow(g, -1.5);
    RULE.forEach(([ang, off, w, al], i) => {
      const n = [-Math.sin(ang * D2R), Math.cos(ang * D2R)];
      rayLine(g, a.cx + n[0] * off, a.crestY + n[1] * off, ang, { w: w * r.range(0.95, 1.1), alpha: al, seed: i + 1, wob: 0.55 });
    });
    // radial guides (toward the circle centre) and the vertical axis below the node
    [-0.29, -0.155, 0.14, 0.31].forEach((t, i) => {
      const p = a.pt(t, 0), q = a.pt(t, -1400);
      penLine(g, p.x, p.y, q.x, q.y, { w: 2.3, alpha: 0.82, seed: 30 + i, wob: 0.5 });
    });
    penLine(g, a.cx, a.crestY + 52, a.cx, H + PAD, { w: 2.7, alpha: 0.95, seed: 40, wob: 0.35 });
    // inner concentric circle (inked) — drawn as a slightly uneven ring
    g.lineCap = 'round';
    a.along({ count: 60, dr: -306, margin: PAD + 160 }, (it) => {
      if (it.i === 0) return;
      const t0 = L.lerp(-a.span(PAD + 160), a.span(PAD + 160), (it.i - 1) / it.n);
      g.lineWidth = 2.5 + r.range(-0.3, 0.4); g.strokeStyle = L.rgba(INK, r.range(0.82, 0.92));
      a.stroke(g, -306 + r.range(-0.4, 0.4), t0, it.theta + 0.0005);
    });
    g.restore();

    // cross marks where the axis and a few rulers meet the inner circle
    const cross = (x, y, s, rot) => {
      g.save(); g.translate(x, y); g.rotate(rot);
      penLine(g, -s, 0, s, 0, { w: 2.4, alpha: 0.95, seed: x | 0, wob: 0.2, step: 8 });
      penLine(g, 0, -s, 0, s, { w: 2.4, alpha: 0.95, seed: (y | 0) + 3, wob: 0.2, step: 8 });
      g.restore();
    };
    const pc = a.pt(0, -306); cross(pc.x, pc.y, 22, 0);
    [-0.155, 0.14].forEach((t) => { const p = a.pt(t, -306); cross(p.x, p.y, 18, t + Math.PI / 4); });

    // the outer circle — the arc. one even, slightly heavier ink line
    g.save(); g.lineCap = 'round';
    g.strokeStyle = L.rgba(INK, 0.96); g.lineWidth = 4.6; a.stroke(g, -0.4);
    g.strokeStyle = L.rgba(INK, 0.35); g.lineWidth = 6.5; a.stroke(g, -0.4);   // a little bleed into the fibres
    g.restore();

    // the crest node: a small ink ring pressed onto the circle, body inside, paper showing through
    const NR = 25, nc = a.pt(0, -NR + 1);
    g.save();
    g.fillStyle = PAPER; g.beginPath(); g.arc(nc.x, nc.y, NR, 0, L.TAU); g.fill();
    g.strokeStyle = L.rgba(INK, 0.97); g.lineWidth = 5; g.beginPath(); g.arc(nc.x, nc.y, NR, 0, L.TAU); g.stroke();
    g.restore();
    geo.node = { x: nc.x, y: nc.y, r: NR + 2.5 };
  });
}

/** the four coloured relation lines with arrowheads (marker ink, slightly translucent with a darker edge) */
function colourLayer(env, geo, which) {
  const a = env.arc, nd = geo.node;
  const lines = which === 'red'
    ? [{ ang: 36, out: true }, { ang: 144, out: false }]
    : [{ ang: 72, out: true }, { ang: 108, out: false }];
  const col = which === 'red' ? RED : BLUE;
  return L.makeLayer(PAD, (g) => {
    g.save(); a.clipBelow(g, -2);
    lines.forEach((ln, i) => {
      const ux = Math.cos(ln.ang * D2R), uy = Math.sin(ln.ang * D2R);
      const sx = nd.x + ux * nd.r, sy = nd.y + uy * nd.r, ex = nd.x + ux * 2400, ey = nd.y + uy * 2400;
      const sd = which + i;
      // marker body: a wide translucent stroke, then a denser core; the edges pick up a little extra pigment
      penLine(g, sx, sy, ex, ey, { w: 9.5, color: col, alpha: 0.62, seed: sd + 'a', wob: 0.7 });
      penLine(g, sx, sy, ex, ey, { w: 6.2, color: col, alpha: 0.75, seed: sd + 'b', wob: 0.5 });
      penLine(g, sx, sy, ex, ey, { w: 2.2, color: L.shade(col, -0.25), alpha: 0.45, seed: sd + 'c', wob: 1.6 });
      // arrowhead along the line: away from the node for the forward relation, toward it for the incoming one
      const dist = which === 'red' ? 330 : 300;
      const ax = nd.x + ux * dist, ay = nd.y + uy * dist;
      arrow(g, ax, ay, ln.out ? ln.ang : ln.ang + 180, 54, 30, col);
    });
    g.restore();
    // pigment texture: multiply a fine grain so the colour reads as ink on fibre, not flat vector
    const gt = L.grainTex(W + PAD * 2, H + PAD * 2, { seed: 'c' + which, amount: 0.35, size: 2 });
    L.overlayOn(g.canvas, gt, { blend: 'soft-light', alpha: 0.9 });
  });
}

/** shallow depth of field: sharp around the crest, softening toward the sides and the bottom */
function dof(layer, env, px = 3.2) {
  const a = env.arc;
  const soft = L.blurred(layer, px);
  const mask = L.makeLayer(PAD, (g) => {
    g.fillStyle = L.radial(g, a.cx, a.crestY + 60, 330, 1150, [[0, 'rgba(0,0,0,0)'], [0.5, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,1)']]);
    g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
  });
  const sm = L.makeCanvas(soft.width, soft.height), sg = sm.getContext('2d');
  sg.drawImage(soft, 0, 0); sg.globalCompositeOperation = 'destination-in'; sg.drawImage(mask, 0, 0);
  const out = L.makeCanvas(layer.width, layer.height), og = out.getContext('2d');
  og.drawImage(layer, 0, 0);
  og.globalCompositeOperation = 'destination-out'; og.drawImage(mask, 0, 0);
  og.globalCompositeOperation = 'source-over'; og.drawImage(sm, 0, 0);
  out._pad = layer._pad;
  return out;
}

async function bake(c) {
  if (typeof createImageBitmap !== 'function') return c;
  const b = await createImageBitmap(c); b._pad = c._pad; return b;
}

export default {
  name: '五行生克图',
  tone: 'dark',
  async init(env) {
    const geo = {};
    const paper = paperLayer(env);
    const ink = inkLayer(env, geo);
    // ink sits IN the paper: composite ink onto paper with multiply so the fibres show through
    const base = L.makeCanvas(paper.width, paper.height), bg = base.getContext('2d');
    bg.drawImage(paper, 0, 0); bg.globalCompositeOperation = 'multiply'; bg.drawImage(ink, 0, 0);
    base._pad = PAD;
    const red = colourLayer(env, geo, 'red'), blue = colourLayer(env, geo, 'blue');
    S = {
      base: await bake(dof(base, env, 3.4)),
      red: await bake(dof(red, env, 3.4)),
      blue: await bake(dof(blue, env, 3.4)),
    };
  },
  draw(ctx, env, p) {
    const e = L.ease.inOutCubic ? L.ease.inOutCubic(p) : p;
    const cam = { rot: L.lerp(0.0035, -0.0035, e), zoom: L.lerp(1.0, 1.022, e) };
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
    L.blit(ctx, env, S.base, cam);
    // red and blue ink "breathe" out of phase
    const br = 0.5 + 0.5 * Math.sin(p * Math.PI * 2);
    L.blit(ctx, env, S.blue, { ...cam, blend: 'multiply', alpha: 0.86 + 0.14 * br });
    L.blit(ctx, env, S.red, { ...cam, blend: 'multiply', alpha: 1 - 0.14 * br });
  },
};
