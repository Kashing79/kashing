// s02 — 黄琉璃瓦檐口. Looking down across an imperial yellow-glazed roof to its far eave (we see the tiles' backs):
// ridges of round tiles (筒瓦) alternate with troughs of pan tiles (板瓦); at the eave every ridge ends in a 勾头 (its
// wadang faces away from us, only the raised back-rim shows) with one domed nail cap (钉帽) on its back, and every trough
// ends in the concave lip of a 滴水 → the eave reads as a scalloped "string of beads" lying on the arc.
// EXEMPLAR SCENE: shows the standard recipe → build static layers once in init(), then blit them with a small camera move.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 260;       // extra canvas around the frame so the camera can drift without showing edges
const PITCH = 104;     // spacing of tile ridges along the arc (px)
const HALF = 30;       // half-width of a round tile (筒瓦) → 60 px tile, 44 px trough (走水当)
const GAP = PITCH / 2 - HALF;   // half-width of the pan-tile trough at the eave
const SEG = 126;       // one round tile is about twice as long as it is wide …
const HEAD = 110;      // … the eave tile (勾头) a little shorter
const LAP = 42;        // exposed length of one pan tile (压七露三 → roughly three laps per round tile)
const DEPTH = 1150;
const DY = 0;          // the eave silhouette runs ±6 px around the layer's arc (勾头 crown −6, 滴水 dip +6) → no nudge needed
let S = null;

function ridgeAngles(a) {
  const s = a.span(PAD + 120);
  const n = Math.ceil((s * a.R) / PITCH);
  const out = [];
  for (let i = -n; i <= n; i++) out.push((i * PITCH) / a.R);
  return out;
}
/** how far a ridge has converged toward the roof's centre at depth d below the eave */
const conv = (a, d) => (a.R - d) / a.R;

// glaze, not metal: a broad saturated yellow middle, dark only at the two flanks (light from the upper left)
const GLAZE = {
  std: ['#c48a10', '#ffd83a', '#f5c518', '#d99a12'],
  fresh: ['#d39a14', '#ffe45c', '#ffd84a', '#e6ac20'],   // replacement tiles are a touch brighter …
  old: ['#a9740d', '#dba51a', '#c48a10', '#a8720c'],     // … and the oldest ones have gone ochre
};
function glazeStops(kind, tone) {
  const [rise, lit, body, turn] = GLAZE[kind];
  return [[0, '#6e3d08'], [0.12, rise], [0.3, lit], [0.5, body], [0.78, turn], [0.93, '#8a520a'], [1, '#3a1e04']].map(([t, c]) => [t, L.shade(c, tone)]);
}
// across a trough: the ridge on the left drops its shadow on the left third, the far side catches a little light
const CONCAVE = [[0, 'rgba(28,12,2,0.88)'], [0.36, 'rgba(28,12,2,0.42)'], [0.6, 'rgba(255,204,80,0.22)'], [0.88, 'rgba(60,30,4,0.5)'], [1, 'rgba(28,12,2,0.8)']];

/** the troughs: pan tiles (板瓦), concave side up, yellow glaze lying in shadow; each trough ends in a drip-tile lip */
function buildPan(env) {
  const a = env.arc;
  return L.makeLayer(PAD, (g) => {
    const angles = ridgeAngles(a), r = L.rng('s02pan');
    const base = L.makeRamp([[0, '#3a1e04'], [0.55, '#85500b'], [0.92, '#a8680c'], [1, '#b8860f']]);   // shadowed glaze turns amber, never olive
    const P2 = PITCH / 2, kEnd = conv(a, DEPTH);
    for (let i = 0; i < angles.length - 1; i++) {
      a.at(g, (angles[i] + angles[i + 1]) / 2, 0, () => {
        g.save();
        // outline of one trough: its top edge is the drip tile's concave lip, so the night shows through between the ridges
        g.beginPath();
        g.moveTo(-P2, 14); g.lineTo(-GAP, 14); g.lineTo(-GAP, -2);
        g.ellipse(0, -2, GAP, 8, 0, Math.PI, 0, true);
        g.lineTo(GAP, 14); g.lineTo(P2, 14); g.lineTo(P2 * kEnd, DEPTH); g.lineTo(-P2 * kEnd, DEPTH); g.closePath();
        g.clip();
        // the pan tiles, eave first: each one further up the slope lies on top of the one below it
        let d0 = -2, d1 = 34 + r.range(-6, 6);
        for (let j = 0; d0 < DEPTH; j++) {
          const k = conv(a, Math.max(0, d0)), w = GAP * k, sag = j ? 7 : 8, pk = P2 * k + 2;
          const lip = () => { g.beginPath(); g.ellipse(0, d0, w, sag, 0, Math.PI, 0, true); };
          if (j) {   // the shadow this tile's lower edge drops on the tile below it (toward the eave)
            g.strokeStyle = 'rgba(30,14,2,0.55)'; g.lineWidth = 4;
            g.beginPath(); g.ellipse(0, d0 - 3, w, sag, 0, Math.PI, 0, true); g.stroke();
          }
          g.beginPath(); g.moveTo(-pk, d0); g.lineTo(-w, d0); g.ellipse(0, d0, w, sag, 0, Math.PI, 0, true); g.lineTo(pk, d0);
          g.lineTo(pk, d1 + 12); g.lineTo(-pk, d1 + 12); g.closePath();
          g.fillStyle = L.shade(L.css(base(L.clamp(1 - (d0 + d1 + 4) / 1160))), r.range(-0.08, 0.04)); g.fill();
          g.fillStyle = L.linear(g, -w, 0, w, 0, CONCAVE); g.fill();
          g.fillStyle = L.linear(g, 0, d0 + sag, 0, d1 + 8, [[0, 'rgba(255,220,110,0.10)'], [0.4, 'rgba(40,18,2,0)'], [1, 'rgba(40,18,2,0.32)']]); g.fill();
          if (j) {   // bright glazed edge of the lap, strongest where the trough turns toward the light
            g.strokeStyle = L.linear(g, -w, 0, w, 0, [[0, 'rgba(255,232,154,0.08)'], [0.3, 'rgba(255,232,154,0.3)'], [0.62, 'rgba(255,232,154,0.6)'], [1, 'rgba(255,232,154,0.3)']]);
            g.lineWidth = 1.5; lip(); g.stroke();
          } else {   // the 滴水: a thick rolled lip (its ruyi tongue hangs on the far side, out of sight)
            g.beginPath(); g.ellipse(0, -2, GAP, 8, 0, Math.PI, 0, true); g.ellipse(0, -2, GAP + 5, 13, 0, 0, Math.PI, false); g.closePath();
            g.fillStyle = L.linear(g, 0, -2, 0, 11, [[0, '#ffe27a'], [1, '#b9720e']]); g.fill();
            g.fillStyle = L.linear(g, -GAP, 0, GAP, 0, [[0, 'rgba(60,28,2,0.55)'], [0.3, 'rgba(60,28,2,0.1)'], [0.6, 'rgba(255,246,208,0.18)'], [1, 'rgba(60,28,2,0.3)']]); g.fill();
            g.strokeStyle = 'rgba(42,20,3,0.6)'; g.lineWidth = 3;
            g.beginPath(); g.ellipse(0, -2, GAP + 6.5, 14.5, 0, Math.PI, 0, true); g.stroke();
            g.strokeStyle = 'rgba(255,246,208,0.7)'; g.lineWidth = 1.2;
            g.beginPath(); g.ellipse(0, -1.4, GAP, 8, 0, Math.PI, 0, true); g.stroke();
          }
          d0 = d1; d1 += LAP;
        }
        g.restore();
      });
    }
  });
}

/** the ridges: round tiles (筒瓦) laid tile by tile, plus a separate layer holding only their specular highlights */
function buildTiles(env) {
  const a = env.arc, angles = ridgeAngles(a), r = L.rng('s02');
  const tiles = L.makeLayer(PAD), spec = L.makeLayer(PAD);
  const g = tiles.getContext('2d'), s = spec.getContext('2d');
  g.lineCap = 'butt'; s.lineCap = 'round';
  for (const th of angles) {
    a.at(g, th, 0, () => a.at(s, th, 0, () => {
      const joints = [0];
      for (let d = HEAD + r.range(-8, 8); d < DEPTH + SEG; d += SEG) joints.push(d);
      // 夹垄灰: the ochre-red mortar bead where each ridge meets the troughs
      g.strokeStyle = 'rgba(138,58,28,0.6)'; g.lineWidth = 2;
      for (const side of [-1, 1]) {
        g.beginPath();
        for (let d = 12; d <= DEPTH; d += 24) { const x = side * (HALF * conv(a, d) + 1) + r.range(-0.7, 0.7); if (d === 12) g.moveTo(x, d); else g.lineTo(x, d); }
        g.stroke();
      }
      // one tile at a time, eave first, so each tile further up the slope overlaps the top of the one below it
      for (let j = 0; j < joints.length - 1; j++) {
        const d0 = joints[j], d1 = joints[j + 1], len = d1 - d0;
        const hw0 = HALF * conv(a, d0), hw1 = HALF * conv(a, d1);
        const m = j ? hw0 + 1.5 : HALF, arch = j ? 0.4 * hw0 : 9, top = j ? d0 : 6;   // the mouth stands 1.5 px proud of the tile below
        const roll = r(), tone = r.range(-0.06, 0.06);
        const stops = glazeStops(roll < 0.08 ? 'fresh' : roll < 0.14 ? 'old' : 'std', tone);
        const mouth = (c, grow = 0) => { c.beginPath(); c.ellipse(0, top, m + grow, arch + grow, 0, Math.PI, 0); };
        const body = () => { mouth(g); g.lineTo(hw1, d1 + 2); g.lineTo(-hw1, d1 + 2); g.closePath(); };
        if (j) {   // c. the raised mouth shades the tile below it
          g.save(); g.beginPath(); g.rect(-m, d0 - arch - 16, m * 2, arch + 16); g.clip();
          g.lineWidth = 2.6;
          for (let q = 0; q < 11; q++) { g.strokeStyle = `rgba(40,18,2,${(0.2 * Math.pow(1 - q / 11, 1.3)).toFixed(3)})`; mouth(g, 2.2 + q); g.stroke(); }
          g.restore();
        }
        body();
        g.fillStyle = L.linear(g, -m, 0, m, 0, stops); g.fill();
        // glaze pools toward the upslope end of every tile
        g.fillStyle = L.linear(g, 0, top - arch, 0, d1, [[0, 'rgba(150,84,8,0)'], [0.3, 'rgba(150,84,8,0.03)'], [1, 'rgba(150,84,8,0.35)']]); g.fill();
        // cool skylight on the shaded flank — the tell-tale of a glassy glaze
        const q0 = d0 + len * r.range(0.14, 0.38), q1 = q0 + len * 0.5;
        g.strokeStyle = L.rgba('#7fb2e6', r.range(0.18, 0.28)); g.lineWidth = 2; g.lineCap = 'round';
        g.beginPath(); g.moveTo(0.55 * HALF * conv(a, q0), q0); g.lineTo(0.55 * HALF * conv(a, q1), q1); g.stroke(); g.lineCap = 'butt';

        // ── highlights (on their own layer so the light pool can dim them away from the sun's reflection) ──
        const jit = r.range(-3, 3), hx = (y) => (-0.34 * HALF + jit) * conv(a, y);
        const lipY = top - arch * 0.94;                       // where the mouth's lip sits at the highlight's x
        const nextArch = 0.4 * hw1;
        if (j) {
          // b. mortar in the joint (捉节灰), a. the thick glazed lip of the mouth
          g.strokeStyle = 'rgba(138,58,28,0.8)'; g.lineWidth = 2; mouth(g, 1); g.stroke();
          g.strokeStyle = L.linear(g, -m, 0, m, 0, [[0, 'rgba(255,232,154,0.35)'], [0.28, 'rgba(255,232,154,0.62)'], [0.6, 'rgba(255,232,154,0.5)'], [1, 'rgba(255,232,154,0.18)']]);
          g.lineWidth = 3; mouth(g, -1.5); g.stroke();
          s.strokeStyle = 'rgba(255,240,190,0.6)'; s.lineWidth = 2.6;
          s.beginPath(); s.ellipse(0, top, m - 1.5, arch - 1.5, 0, Math.PI + 0.3, Math.PI + 1.75); s.stroke();
          // soft sheen
          const b0 = lipY + 9, b1 = Math.min(b0 + len * r.range(0.7, 0.9) - 9, d1 - nextArch - 6);
          s.strokeStyle = 'rgba(255,241,176,0.38)'; s.lineWidth = 8;
          s.beginPath(); s.moveTo(hx(b0), b0); s.lineTo(hx(b1), b1); s.stroke();
          // crisp cold-white core: a tapered streak that wavers with the glaze and stops well short of the next joint
          const c0 = lipY + 12, c1 = c0 + len * r.range(0.35, 0.65), cm = L.lerp(c0, c1, 0.36), bend = r.range(-1.5, 1.5) * 2;
          s.fillStyle = L.rgba('#f4faff', r.range(0.55, 0.95));
          s.beginPath(); s.moveTo(hx(c0) - 1.1, c0); s.quadraticCurveTo(hx(cm) + bend - 3.3, cm, hx(c1), c1); s.quadraticCurveTo(hx(cm) + bend + 3.3, cm, hx(c0) + 1.1, c0);
          s.arc(hx(c0), c0, 1.1, 0, Math.PI, true); s.fill();
          // the glint where the lip rolls over
          s.fillStyle = 'rgba(255,255,255,0.9)';
          s.beginPath(); s.ellipse(hx(d0) * (m / hw0), lipY + 1.6, 3.5, 1.5, -0.15, 0, L.TAU); s.fill();
        } else {
          // ── the 勾头: we see the back of its wadang as a raised rim around the tile's end, and one nail cap on its back ──
          g.lineCap = 'round';
          g.strokeStyle = L.linear(g, -24, -8, 26, 12, [[0, '#ffe27a'], [0.45, '#f0c030'], [1, '#c8901a']]); g.lineWidth = 6;
          g.beginPath(); g.moveTo(-HALF + 1, 10); g.lineTo(-HALF + 1, 6); g.ellipse(0, 6, HALF - 1, 9, 0, Math.PI, 0); g.lineTo(HALF - 1, 10); g.stroke();
          g.lineCap = 'butt';
          g.strokeStyle = 'rgba(92,48,10,0.9)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(0, 6.5, HALF - 4.2, 5.6, 0, Math.PI, 0); g.stroke();
          // sheen along the tile's back, either side of the nail cap
          s.strokeStyle = 'rgba(255,241,176,0.38)'; s.lineWidth = 8;
          s.beginPath(); s.moveTo(hx(14), 14); s.lineTo(hx(d1 - nextArch - 8), d1 - nextArch - 8); s.stroke();
          const c0 = 9, c1 = 38, bend = r.range(-1.2, 1.2) * 2;
          s.fillStyle = L.rgba('#f4faff', r.range(0.6, 0.95));
          s.beginPath(); s.moveTo(hx(c0) - 1.1, c0); s.quadraticCurveTo(hx(20) + bend - 3.3, 20, hx(c1), c1); s.quadraticCurveTo(hx(20) + bend + 3.3, 20, hx(c0) + 1.1, c0);
          s.arc(hx(c0), c0, 1.1, 0, Math.PI, true); s.fill();
          s.strokeStyle = 'rgba(255,255,255,0.85)'; s.lineWidth = 1.6;
          s.beginPath(); s.ellipse(0, 6, HALF + 0.5, 10.5, 0, Math.PI + 0.5, Math.PI + 1.2); s.stroke();
          // nail cap (钉帽): a glazed half-dome sitting on the tile, its shadow kept on the tile's back
          const cy = 54, cr = 12;
          g.save(); body(); g.clip();
          g.fillStyle = 'rgba(40,20,2,0.35)'; g.beginPath(); g.ellipse(5, cy + 6, 13, 8, 0.6, 0, L.TAU); g.fill();
          g.restore();
          g.fillStyle = L.radial(g, -4, cy - 5, 0.5, cr * 1.42, [[0, '#f8fbff'], [0.22, '#ffd83a'], [0.65, '#e0a416'], [1, '#8a520a']]);
          g.beginPath(); g.arc(0, cy, cr, 0, L.TAU); g.fill();
          g.strokeStyle = 'rgba(74,38,6,0.7)'; g.lineWidth = 1.5; g.beginPath(); g.arc(0, cy, cr + 0.3, 0, L.TAU); g.stroke();
          g.strokeStyle = L.rgba('#7fb2e6', 0.3); g.lineWidth = 1.6; g.beginPath(); g.arc(0, cy, cr - 2.6, -0.1, 0.9); g.stroke();
          s.save(); s.globalCompositeOperation = 'destination-out'; s.beginPath(); s.arc(0, cy, cr + 1.5, 0, L.TAU); s.fill(); s.restore();
          s.fillStyle = 'rgba(255,255,255,0.95)'; s.beginPath(); s.ellipse(-4.2, cy - 5.2, 3, 2, -0.6, 0, L.TAU); s.fill();
        }
      }
    }));
  }
  // light pool: the sun's reflection sits on the eave left of the crest — highlights are full strength there, ×0.35 elsewhere
  const pc = a.pt(-0.05, -150);
  s.globalCompositeOperation = 'destination-in';
  s.fillStyle = L.radial(s, pc.x, pc.y, 110, 640, [[0, 'rgba(0,0,0,1)'], [0.45, 'rgba(0,0,0,0.82)'], [1, 'rgba(0,0,0,0.35)']]);
  s.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
  g.globalCompositeOperation = 'source-atop'; g.drawImage(spec, -PAD, -PAD); g.globalCompositeOperation = 'source-over';
  return tiles;
}

/** colour layer: the glazed roof */
function buildRoof(env) {
  const a = env.arc;
  // 1–2) the troughs, with rain-wash stains that stay in the troughs
  const roof = buildPan(env);
  L.overlayOn(roof, L.polarNoiseLayer(env, PAD, { seed: 's02dirt', scale: 240, octaves: 4, warp: 0.6, res: 0.25, ramp: [[0, '#6a4210'], [0.5, '#ffffff'], [1, '#ffffff']] }), { blend: 'multiply', alpha: 0.4 });
  // 3) the round-tile ridges on top
  const g = roof.getContext('2d');
  g.drawImage(buildTiles(env), -PAD, -PAD);
  // 4) glaze mottling in soft clouds (no lengthwise streaks) + pinholes; everything lands on existing pixels only
  L.overlayOn(roof, L.polarNoiseLayer(env, PAD, { seed: 's02glaze', scale: 70, sx: 1, sy: 1.4, octaves: 4, contrast: 1.5, res: 0.4, ramp: [[0, '#6e4a12'], [0.5, '#b89a48'], [1, '#fff0a0']] }), { blend: 'soft-light', alpha: 0.34 });
  // the light pool on the eave left of the crest: glaze lifts inside it, the roof turns amber toward the far corners
  const pc = a.pt(-0.05, -150);
  L.overlayOn(roof, L.makeLayer(PAD, (c) => {
    c.fillStyle = L.radial(c, pc.x, pc.y, 60, 640, [[0, 'rgba(255,232,120,0.85)'], [0.5, 'rgba(255,226,100,0.4)'], [1, 'rgba(255,226,100,0)']]);
    c.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
  }), { blend: 'soft-light', alpha: 1 });
  L.overlayOn(roof, L.makeLayer(PAD, (c) => {
    c.fillStyle = L.radial(c, pc.x, pc.y, 430, 1480, [[0, 'rgba(176,112,30,0)'], [1, 'rgba(176,112,30,0.85)']]);
    c.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
  }), { blend: 'multiply', alpha: 1 });
  g.globalCompositeOperation = 'source-atop';
  L.speckle(g, { seed: 's02pin', count: 1700, x: -PAD, y: 480, w: W + PAD * 2, h: H + PAD - 480, rMin: 0.4, rMax: 1.3, colors: ['#7a4a0a', '#fff6c8'], alpha: [0.15, 0.5] });
  // 5) depth: the roof sinks into deep amber toward the bottom of frame, only the eave band stays bright
  g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 640, a.R - 150, [[0, 'rgba(60,28,2,0.84)'], [0.45, 'rgba(60,28,2,0.52)'], [1, 'rgba(60,28,2,0)']]);
  g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
  g.globalCompositeOperation = 'source-over';
  // 6) depth of field: sharpest in the 260 px under the eave, softening toward the bottom of frame
  const soft = L.blurred(roof, 5), sg = soft.getContext('2d');
  sg.globalCompositeOperation = 'destination-in';
  sg.fillStyle = L.radial(sg, a.cx + PAD, a.cy + PAD, a.R - 620, a.R - 260, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
  sg.fillRect(0, 0, soft.width, soft.height);
  g.drawImage(soft, -PAD, -PAD);
  return roof;
}

/** background: pure night, a few out-of-focus lights — azurite blue, and yellow bounced up from the tiles near the eave */
function buildBack(env) {
  const a = env.arc;
  return L.makeLayer(PAD, (g) => {
    g.fillStyle = L.linear(g, 0, -PAD, 0, a.crestY + 180, [[0, '#040506'], [1, '#05070b']]);
    g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    const r = L.rng('s02bokeh');
    for (let i = 0; i < 18; i++) {
      const warm = i >= 14, pale = i >= 11 && !warm;
      let x, y;
      if (warm) { const p = a.pt([-0.2, -0.11, 0.05, 0.17][i - 14] + r.range(-0.02, 0.02), r.range(40, 105)); x = p.x; y = p.y; } else { x = r.range(-PAD * 0.4, W + PAD * 0.4); y = r.range(-60, 470); }
      const rad = warm ? r.range(11, 22) : r.range(30, 90), c = warm ? '#ffcf3a' : pale ? '#7fb2e6' : '#2b5fae';
      const al = warm ? r.range(0.16, 0.26) : pale ? r.range(0.05, 0.08) : r.range(0.10, 0.18);
      g.fillStyle = L.radial(g, x, y, 0, rad, [[0, L.rgba(c, al * 0.8)], [0.66, L.rgba(c, al)], [0.84, L.rgba(c, al * 0.7)], [1, L.rgba(c, 0)]]);
      g.beginPath(); g.arc(x, y, rad, 0, L.TAU); g.fill();
    }
  });
}
/** drifting dust: sparse up in the dark, thick as gold powder in the 200 px above the eave where the tiles light it */
function buildDust(env) {
  const a = env.arc;
  return L.makeLayer(PAD, (g) => {
    L.speckle(g, { seed: 's02dust', count: 300, y: -PAD, h: 820 + PAD, rMin: 0.5, rMax: 2.2, colors: ['#fff3c4', '#ffd86a', '#cfe6ff'], alpha: [0.08, 0.55], test: (x, y) => a.drAt(x, y) > 6 });
    const pick = L.rng('s02band');
    L.speckle(g, {
      seed: 's02gold', count: 6400, x: -PAD, y: 300, w: W + PAD * 2, h: 640, rMin: 0.5, rMax: 2.4, colors: ['#fff3c4', '#ffd86a', '#ffd86a', '#cfe6ff'], alpha: [0.2, 0.9],
      test: (x, y) => { const dr = a.drAt(x, y); return dr > 3 && dr < 200 && pick() < Math.pow(1 - dr / 200, 2.1); },
    });
    const r = L.rng('s02mote');   // a few motes close to the lens, out of focus
    for (let i = 0; i < 34; i++) {
      const p = a.pt(r.range(-0.42, 0.42), 8 + 190 * Math.pow(r(), 1.8)), rad = r.range(2.5, 6.5), al = r.range(0.07, 0.22);
      g.fillStyle = L.radial(g, p.x, p.y, 0, rad, [[0, L.rgba('#ffd86a', al)], [0.6, L.rgba('#ffd86a', al * 0.8)], [1, L.rgba('#ffd86a', 0)]]);
      g.beginPath(); g.arc(p.x, p.y, rad, 0, L.TAU); g.fill();
    }
    // the dust is brightest above the light pool and thins out toward the corners
    const pc = a.pt(-0.05, 40);
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = L.radial(g, pc.x, pc.y, 160, 1150, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0.4)']]);
    g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    g.globalCompositeOperation = 'source-over';
  });
}

export default {
  name: '黄琉璃瓦檐口',
  tone: 'light',            // tagline colour if this shot carries text: 'light' on dark backgrounds, 'dark' on light ones
  init(env) {
    S = { roof: buildRoof(env), back: buildBack(env), dust: buildDust(env), angles: ridgeAngles(env.arc) };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    // camera: detail slides along the arc (rot) and we creep closer (zoom); foreground moves more than background → parallax
    const rot = L.lerp(-0.010, 0.010, p), zoom = L.lerp(1.0, 1.025, p);
    L.blit(ctx, env, S.back, { rot: rot * 0.3, zoom: 1 + (zoom - 1) * 0.3 });
    L.blit(ctx, env, S.dust, { rot: rot * 0.6, zoom, dy: -10 * p, alpha: 0.9 });
    // a little warm bounce hugging the eave (kept low so the night above stays black)
    L.glow(ctx, a.cx - 180, a.crestY + 40, 260, '#ffb53a', 0.10);
    L.blit(ctx, env, S.roof, { rot, zoom, dy: DY });   // the light pool is baked into the roof, so it rides along with rot
    // sun glint travelling along the eave: it only lifts the glaze, never fogs the black above
    const glT = L.lerp(-0.16, 0.02, p), gl = a.pt(glT, -30);
    ctx.save(); a.clipBelow(ctx, 10);
    L.glow(ctx, gl.x, gl.y, 150, '#fff2c0', 0.3, 'soft-light');
    ctx.restore();
    // … and the nail caps it passes over flare one after another (drawn in the roof's own moving frame)
    L.cam(ctx, env, { rot, zoom, dy: DY }, () => {
      for (const th of S.angles) {
        const k = 1 - Math.abs(th + rot - glT) / 0.075;
        if (k <= 0) continue;
        const e = k * k * (3 - 2 * k);
        a.at(ctx, th, 0, () => {
          L.glow(ctx, -4.2, 48.8, 7 + 13 * e, '#fffbe6', 0.9 * e);
          ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round'; ctx.lineWidth = 1.3;
          ctx.strokeStyle = L.rgba('#f4faff', 0.75 * e);
          ctx.beginPath(); ctx.moveTo(-4.2 - 6 - 13 * e, 48.8); ctx.lineTo(-4.2 + 6 + 13 * e, 48.8); ctx.stroke();
          L.glow(ctx, -13, -2.5, 4 + 7 * e, '#fffbe6', 0.7 * e);
        });
      }
    });
    L.vignette(ctx, { strength: 0.35 });
  },
};
