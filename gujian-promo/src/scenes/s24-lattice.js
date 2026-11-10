// s24 — 窗棂纹样. The top of a giant round lattice window (花窗), white-painted timber against pure black — the
// architectural answer to a piece of lace. The arc is the upper edge of the wide outer frame (边框); under it run a
// fine key-fret band (回纹) and a thin inner rail (仔边), then the field: ice-crack lattice (冰裂纹 — straight bars of
// uneven length meeting in irregular triangles / quads / pentagons), set with begonia roundels (海棠纹) and one round
// 步步锦 panel (nested rectangles tied by short bars) at the centre. No characters anywhere, only geometry.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 170;
const LW = W + PAD * 2, LH = H + PAD * 2;
let S = null;

const INK = '#050505';
const FACE = '#f1eee5';       // painted timber
const GREY = '#8a867c';       // thickness / worn paint
const FRAME_W = 56;           // outer frame: dr 0 … -56
const FRAME_EXT = 6;          // how far the frame's thickness shows under it
const FRET_H = 50;            // key-fret band between frame and rail
const FB = 6, FQ = 13;        // fret bar width / pitch
const RAIL_W = 9;
const RAILC = -(FRAME_W + FRET_H + RAIL_W / 2);   // centre line of the inner rail
const BAR = 8;                // ice-crack bar width
const EXT = 3.4;              // thickness showing under every lattice bar
const TARGET = 5600;          // typical area of one ice-crack cell (px²)

// ───────────────────────── geometry ─────────────────────────
function buildGeometry(a) {
  const r = L.rng('s24-ice-1');
  const sp = a.span(PAD + 80);
  const bottom = H + PAD + 50;

  // medallions: centred on radii, evenly stepped along the window
  const meds = [];
  const med = (theta, dr, R, kind) => { const p = a.pt(theta, dr); meds.push({ theta, x: p.x, y: p.y, R, kind }); };
  med(0, -284, 138, 'bubu');
  for (const sg of [-1, 1]) { med(sg * 0.2, -266, 100, 'tang'); med(sg * 0.392, -250, 88, 'tang'); med(sg * 0.57, -250, 88, 'tang'); }

  // the field = everything under the rail (a convex region) → recursively cracked into cells
  const poly0 = [];
  const n = Math.ceil((2 * sp) / 0.011);
  for (let i = 0; i <= n; i++) { const p = a.pt(L.lerp(-sp, sp, i / n), RAILC); poly0.push({ x: p.x, y: p.y, c: i === 0 || i === n }); }
  poly0.push({ x: poly0[n].x, y: bottom, c: true }, { x: poly0[0].x, y: bottom, c: true });

  const area = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const u = p[i], v = p[(i + 1) % p.length]; s += u.x * v.y - v.x * u.y; } return Math.abs(s) / 2; };
  const perim = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const u = p[i], v = p[(i + 1) % p.length]; s += Math.hypot(v.x - u.x, v.y - u.y); } return s; };
  const segDist = (px, py, x0, y0, x1, y1) => {
    const dx = x1 - x0, dy = y1 - y0; const t = L.clamp(((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy || 1));
    return Math.hypot(px - (x0 + dx * t), py - (y0 + dy * t));
  };
  const SIN_MIN = Math.sin(L.deg(40)), MINJ = 23, MINCELL = TARGET * 0.3;
  const joints = poly0.filter((v) => v.c).map((v) => [v.x, v.y]);
  const bars = [], seams = [];
  const stack = [poly0];
  let guard = 0;
  while (stack.length && guard++ < 6000) {
    const poly = stack.pop();
    const A = area(poly);
    if (A < TARGET * r.range(0.62, 1.5)) continue;
    const m = poly.length;
    const len = [], cum = []; let tot = 0;
    for (let i = 0; i < m; i++) { const u = poly[i], v = poly[(i + 1) % m]; const l = Math.hypot(v.x - u.x, v.y - u.y); len.push(l); tot += l; cum.push(tot); }
    const pickEdge = () => { const t = r() * tot; let i = 0; while (i < m - 1 && cum[i] < t) i++; return i; };
    const big = A > TARGET * 12;
    let best = null, found = 0;
    for (let k = 0; k < (big ? 500 : 140) && found < 6; k++) {
      let i = pickEdge(), j = pickEdge();
      if (i === j) continue;
      if (i > j) { const t = i; i = j; j = t; }
      const ti = r.range(0.1, 0.9), tj = r.range(0.1, 0.9);
      const a0 = poly[i], a1 = poly[(i + 1) % m], b0 = poly[j], b1 = poly[(j + 1) % m];
      const P = { x: L.lerp(a0.x, a1.x, ti), y: L.lerp(a0.y, a1.y, ti), c: true };
      const Q = { x: L.lerp(b0.x, b1.x, tj), y: L.lerp(b0.y, b1.y, tj), c: true };
      const dx = Q.x - P.x, dy = Q.y - P.y, dl = Math.hypot(dx, dy);
      if (dl < 34) continue;
      const ux = dx / dl, uy = dy / dl;
      const e1x = (a1.x - a0.x) / len[i], e1y = (a1.y - a0.y) / len[i], e2x = (b1.x - b0.x) / len[j], e2y = (b1.y - b0.y) / len[j];
      if (Math.abs(e1x * uy - e1y * ux) < SIN_MIN || Math.abs(e2x * uy - e2y * ux) < SIN_MIN) continue;
      let ok = true;
      for (const jt of joints) { if (Math.hypot(jt[0] - P.x, jt[1] - P.y) < MINJ || Math.hypot(jt[0] - Q.x, jt[1] - Q.y) < MINJ) { ok = false; break; } }
      if (!ok) continue;
      // keep bars from grazing a medallion ring: either miss it clearly or cross it squarely
      for (const md of meds) { const h = segDist(md.x, md.y, P.x, P.y, Q.x, Q.y); if (h > md.R * 0.7 && h < md.R + 30) { ok = false; break; } }
      if (!ok) continue;
      const pa = [P]; for (let t = i + 1; t <= j; t++) pa.push(poly[t]); pa.push(Q);
      const pb = [Q]; for (let t = j + 1; t <= i + m; t++) pb.push(poly[t % m]); pb.push(P);
      const A1 = area(pa), A2 = area(pb);
      if (Math.min(A1, A2) < Math.max(MINCELL, 0.2 * A)) continue;
      const p1 = perim(pa), p2 = perim(pb);
      const q1 = (4 * Math.PI * A1) / (p1 * p1), q2 = (4 * Math.PI * A2) / (p2 * p2);
      if ((A1 < TARGET * 0.62 && q1 < 0.5) || (A2 < TARGET * 0.62 && q2 < 0.5)) continue;
      const score = Math.min(q1, q2) + r() * 0.16;
      found++;
      if (!best || score > best.score) best = { score, P, Q, pa, pb, e1x, e1y, e2x, e2y, ux, uy };
    }
    if (!best) continue;
    const { P, Q } = best;
    bars.push({ x0: P.x, y0: P.y, x1: Q.x, y1: Q.y, tone: r(), g: r() });
    joints.push([P.x, P.y], [Q.x, Q.y]);
    seams.push({ x: P.x, y: P.y, ex: best.e1x, ey: best.e1y, dx: best.ux, dy: best.uy }, { x: Q.x, y: Q.y, ex: best.e2x, ey: best.e2y, dx: -best.ux, dy: -best.uy });
    stack.push(best.pa, best.pb);
  }
  return { bars, seams, meds, sp };
}

// ───────────────────────── timber outlines ─────────────────────────
/** one medallion in its own frame (origin = centre, −y = outward along the window's radius) */
function medallion(g, m, shrink) {
  const R = m.R;
  g.lineJoin = 'round'; g.lineCap = 'butt';
  g.lineWidth = (m.kind === 'bubu' ? 11 : 9.5) - 2 * shrink;
  g.beginPath(); g.arc(0, 0, R, 0, L.TAU); g.stroke();
  g.lineWidth = 8 - 2 * shrink;
  if (m.kind === 'bubu') {
    // 步步锦: rectangles stepping inward, each tied to the next by short staggered bars
    const s1 = (R - 2) / Math.SQRT2, s2 = s1 * 0.655, s3 = s1 * 0.31, o = s2 * 0.52;
    g.lineJoin = 'miter';
    g.beginPath();
    for (const s of [s1, s2, s3]) g.rect(-s, -s, 2 * s, 2 * s);
    g.stroke();
    for (let k = 0; k < 4; k++) {
      g.save(); g.rotate((k * Math.PI) / 2);
      g.beginPath();
      g.moveTo(0, -R); g.lineTo(0, -s1);
      g.moveTo(-o, -s1); g.lineTo(-o, -s2); g.moveTo(o, -s1); g.lineTo(o, -s2);
      g.moveTo(0, -s2); g.lineTo(0, -s3);
      g.stroke(); g.restore();
    }
  } else {
    // 海棠纹: four round lobes with inward cusps, a small heart ring, four short bars from the cusps to the heart
    const rr = 0.44 * R, d = 0.54 * R, rc = 0.17 * R;
    const xi = (d + Math.sqrt(2 * rr * rr - d * d)) / 2;
    const phi = Math.atan2(xi, xi - d);
    g.beginPath();
    for (let k = 0; k < 4; k++) { const ang = (k * Math.PI) / 2; g.arc(d * Math.cos(ang), d * Math.sin(ang), rr, ang - phi, ang + phi); }
    g.closePath(); g.stroke();
    g.beginPath(); g.arc(0, 0, rc, 0, L.TAU); g.stroke();
    g.beginPath();
    for (let k = 0; k < 4; k++) { const ang = Math.PI / 4 + (k * Math.PI) / 2, c = Math.cos(ang), s = Math.sin(ang); g.moveTo(c * rc, s * rc); g.lineTo(c * xi * Math.SQRT2, s * xi * Math.SQRT2); }
    g.stroke();
  }
}

/** key-fret (回纹) units between frame and rail; symmetric about the crest */
function fretUnits(a, geo, fn) {
  const period = 4 * FQ, rad = a.R - FRAME_W;
  const nU = Math.ceil((geo.sp * rad) / period) + 1;
  for (let i = 0; i < nU; i++) for (const mir of [1, -1]) fn((mir * i * period) / rad, mir, i);
}
function drawFret(g, a, geo, shrink) {
  const r0 = FRAME_EXT + 5 + FB / 2, r1 = r0 + FQ, r2 = r1 + FQ;
  g.lineWidth = FB - 2 * shrink; g.lineJoin = 'miter'; g.lineCap = 'butt';
  fretUnits(a, geo, (theta, mir) => {
    a.at(g, theta, -FRAME_W, () => {
      g.scale(mir, 1);
      g.beginPath();
      g.moveTo(0, FRET_H + 2); g.lineTo(0, r0); g.lineTo(3 * FQ, r0); g.lineTo(3 * FQ, r2); g.lineTo(FQ, r2); g.lineTo(FQ, r1); g.lineTo(2 * FQ, r1);
      g.stroke();
    });
  });
}

/** all lattice timber (everything except the outer frame) as white on transparent; shrink trims every edge */
function drawLattice(g, a, geo, shrink) {
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'butt';
  g.lineWidth = BAR - 2 * shrink;
  g.beginPath();
  for (const b of geo.bars) { g.moveTo(b.x0, b.y0); g.lineTo(b.x1, b.y1); }
  g.stroke();
  for (const m of geo.meds) {
    g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(m.x, m.y, m.R, 0, L.TAU); g.fill(); g.restore();
    g.save(); g.translate(m.x, m.y); g.rotate(m.theta); medallion(g, m, shrink); g.restore();
  }
  g.lineWidth = RAIL_W - 2 * shrink; a.stroke(g, RAILC);
  drawFret(g, a, geo, shrink);
}

// ───────────────────────── materials ─────────────────────────
function chipPattern(g, seed, thresh, scale) {
  const tile = L.noiseTex(640, 640, { seed, scale, octaves: 3, gain: 0.6, warp: 0.7, res: 1, contrast: 1.5,
    ramp: [[0, 'rgba(120,115,104,0)'], [thresh, 'rgba(120,115,104,0)'], [thresh + 0.035, 'rgba(126,121,110,0.85)'], [1, 'rgba(96,92,84,0.95)']] });
  return g.createPattern(tile, 'repeat');
}

/** extrude a white mask downward (the visible thickness of the timber) and put the finished face on top */
function assemble(mask, face, ext) {
  const side = (col) => { const c = L.makeCanvas(LW, LH); const g = c.getContext('2d'); g.drawImage(mask, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, LW, LH); return c; };
  const dark = side('#4f4c46'), mid = side(GREY);
  const out = L.makeCanvas(LW, LH); out._pad = PAD;
  const g = out.getContext('2d');
  const steps = Math.ceil(ext * 2);
  for (let k = steps; k >= 1; k--) { const d = (k / steps) * ext; g.drawImage(k > steps * 0.55 ? dark : mid, d * 0.3, d); }
  g.drawImage(face, 0, 0);
  return out;
}

function buildLattice(env, geo) {
  const a = env.arc;
  const mask = L.makeLayer(PAD, (g) => drawLattice(g, a, geo, 0));
  const face = L.makeLayer(PAD, (g) => {
    g.drawImage(mask, -PAD, -PAD);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = FACE; g.fillRect(-PAD, -PAD, LW, LH);
    // every bar is its own strip of wood: a breath of tone difference + hairline grain along its length
    const r = L.rng('s24grain');
    g.lineCap = 'butt';
    for (const b of geo.bars) {
      g.strokeStyle = L.mix(FACE, GREY, 0.02 + 0.13 * b.tone * b.tone); g.lineWidth = BAR + 1;
      g.beginPath(); g.moveTo(b.x0, b.y0); g.lineTo(b.x1, b.y1); g.stroke();
    }
    for (const b of geo.bars) {
      const dx = b.x1 - b.x0, dy = b.y1 - b.y0, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
      for (let k = 0; k < 2; k++) {
        const o = r.range(-0.36, 0.36) * BAR, t0 = r.range(0, 0.35), t1 = r.range(0.6, 1);
        g.strokeStyle = L.rgba('#6d695f', r.range(0.1, 0.26)); g.lineWidth = r.range(0.6, 1.1);
        g.beginPath();
        for (let i = 0; i <= 5; i++) { const t = L.lerp(t0, t1, i / 5), w = o + r.range(-0.5, 0.5); const x = b.x0 + dx * t + nx * w, y = b.y0 + dy * t + ny * w; if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); }
        g.stroke();
      }
    }
    // joinery: a hair-thin seam where each bar butts into the one it stops against
    g.strokeStyle = 'rgba(70,66,58,0.42)'; g.lineWidth = 1;
    g.beginPath();
    for (const s of geo.seams) {
      let nx = -s.ey, ny = s.ex; let sn = nx * s.dx + ny * s.dy; if (sn < 0) { nx = -nx; ny = -ny; sn = -sn; }
      const k = BAR / 2 / Math.max(0.5, sn), cx = s.x + s.dx * k, cy = s.y + s.dy * k;
      g.moveTo(cx - s.ex * k, cy - s.ey * k); g.lineTo(cx + s.ex * k, cy + s.ey * k);
    }
    g.stroke();
    // soft, broad unevenness of old paint
    g.globalAlpha = 0.9;
    g.drawImage(L.noiseLayer(PAD, { seed: 's24tone', scale: 210, octaves: 3, res: 0.2, ramp: [[0, 'rgba(112,106,94,0.32)'], [0.5, 'rgba(112,106,94,0)'], [1, 'rgba(255,255,255,0.3)']] }), -PAD, -PAD);
    g.globalAlpha = 1;
    // a few chips straight through the paint
    g.fillStyle = chipPattern(g, 's24chipA', 0.78, 9); g.fillRect(-PAD, -PAD, LW, LH);
  });
  // paint flaking along the arrises (edge band = mask − slightly shrunken mask)
  {
    const edge = L.makeLayer(PAD, (g) => {
      g.fillStyle = chipPattern(g, 's24chipB', 0.6, 13); g.fillRect(-PAD, -PAD, LW, LH);
      g.globalCompositeOperation = 'destination-in'; g.drawImage(mask, -PAD, -PAD);
      g.globalCompositeOperation = 'destination-out'; drawLattice(g, a, geo, 1.7);
    });
    const g = face.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.8; g.drawImage(edge, 0, 0);
    // rounded arrises: relief light from the upper left
    const bump = L.bumpLight(L.blurred(mask, 1.1), { angle: 45, strength: 0.55, res: 1 });
    g.globalAlpha = 0.75; g.globalCompositeOperation = 'hard-light'; g.drawImage(bump, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'destination-in'; g.drawImage(mask, 0, 0);
  }
  const out = assemble(mask, face, EXT);
  // the frame stands proud of the lattice and shades the first rows beneath it
  const g = out.getContext('2d');
  g.translate(PAD, PAD); g.globalCompositeOperation = 'source-atop';
  g.fillStyle = L.radial(g, a.cx, a.cy, a.R - FRAME_W - 46, a.R - FRAME_W, [[0, 'rgba(0,0,0,0)'], [0.6, 'rgba(0,0,0,0.22)'], [1, 'rgba(0,0,0,0.6)']]);
  a.pathBand(g, -FRAME_W + 2, -FRAME_W - 46); g.fill();
  return out;
}

function buildFrame(env) {
  const a = env.arc;
  const mask = L.makeLayer(PAD, (g) => { g.fillStyle = '#fff'; a.pathBand(g, 0, -FRAME_W); g.fill(); });
  // moulding profile as a height map across the band (t = 0 inner edge … 1 outer edge)
  const T = (dr) => (FRAME_W + dr) / FRAME_W;
  const height = L.makeLayer(PAD, (g) => {
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - FRAME_W, a.R, [
      [T(-56), '#2a2a2a'], [T(-52), '#b4b4b4'], [T(-47), '#f0f0f0'], [T(-42), '#a8a8a8'], [T(-39.5), '#5a5a5a'], [T(-37), '#c8c8c8'],
      [T(-33), '#dcdcdc'], [T(-20), '#e6e6e6'], [T(-7), '#dadada'], [T(-3), '#a0a0a0'], [T(0), '#3c3c3c']]);
    a.pathBand(g, 0, -FRAME_W); g.fill();
  });
  const face = L.makeLayer(PAD, (g) => {
    g.drawImage(mask, -PAD, -PAD);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = FACE; g.fillRect(-PAD, -PAD, LW, LH);
    // grain running round the frame
    g.globalAlpha = 0.85;
    g.drawImage(L.polarNoiseLayer(env, PAD, { seed: 's24fgrain', scale: 5, sx: 46, sy: 1, octaves: 3, contrast: 1.5, res: 0.5,
      ramp: [[0, 'rgba(104,98,86,0.4)'], [0.42, 'rgba(104,98,86,0)'], [0.75, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0.35)']] }), -PAD, -PAD);
    g.drawImage(L.noiseLayer(PAD, { seed: 's24ftone', scale: 300, octaves: 3, res: 0.2, ramp: [[0, 'rgba(112,106,94,0.3)'], [0.5, 'rgba(112,106,94,0)'], [1, 'rgba(255,255,255,0.3)']] }), -PAD, -PAD);
    g.globalAlpha = 1;
    // the ring is pieced from curved segments: scarf joints every so often
    const s = a.span(PAD + 60);
    for (let th = -s + 0.07; th < s; th += 0.262) {
      a.at(g, th, 0, () => {
        g.strokeStyle = 'rgba(60,56,50,0.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-7, 0); g.lineTo(7, FRAME_W); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-5.6, 0); g.lineTo(8.4, FRAME_W); g.stroke();
      });
    }
    // worn paint: sparse flakes on the flat, more along the inner bead
    g.fillStyle = chipPattern(g, 's24chipF', 0.8, 15); g.fillRect(-PAD, -PAD, LW, LH);
    g.save(); a.clipBand(g, -40, -FRAME_W);
    g.fillStyle = chipPattern(g, 's24chipG', 0.66, 11); g.fillRect(-PAD, -PAD, LW, LH);
    g.restore();
  });
  const g = face.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  const bump = L.bumpLight(L.blurred(height, 1), { angle: 45, strength: 1.5, res: 1 });
  g.globalAlpha = 0.8; g.globalCompositeOperation = 'hard-light'; g.drawImage(bump, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'destination-in'; g.drawImage(mask, 0, 0);
  return assemble(mask, face, FRAME_EXT);
}

export default {
  name: '窗棂纹样',
  tone: 'light',
  init(env) {
    const geo = buildGeometry(env.arc);
    const win = buildLattice(env, geo);
    const wg = win.getContext('2d');
    wg.setTransform(1, 0, 0, 1, 0, 0); wg.globalCompositeOperation = 'source-over';
    wg.drawImage(buildFrame(env), 0, 0);
    S = { win, bloom: L.blurred(win, 14) };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.0055, 0.0055, p), zoom = L.lerp(1.0, 1.035, p);
    ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
    L.blit(ctx, env, S.bloom, { rot, zoom, alpha: 0.3, blend: 'screen' });
    L.blit(ctx, env, S.win, { rot, zoom });
    // a pool of light drifting along the frame; the black ground is untouched by it
    const lp = a.pt(L.lerp(-0.075, 0.045, p), -110);
    ctx.save(); ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = L.radial(ctx, lp.x, lp.y, 0, 1300, [[0, '#ffffff'], [0.3, '#f4f3ee'], [0.62, '#b3b0a9'], [1, '#75736d']]);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  },
};
