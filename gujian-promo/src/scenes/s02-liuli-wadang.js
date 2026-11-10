// s02 — 黄琉璃瓦檐口. Looking down across an imperial yellow-glazed roof to its far eave:
// tile ridges (瓦垄) run up to the arc, each tipped with a domed nail cap (瓦钉帽) — the "string of beads" on the horizon.
// EXEMPLAR SCENE: shows the standard recipe → build static layers once in init(), then blit them with a small camera move.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 260;       // extra canvas around the frame so the camera can drift without showing edges
const PITCH = 86;      // spacing of tile ridges along the arc (px)
const HALF = 23;       // half-width of a round tile (筒瓦)
let S = null;

function ridgeAngles(a) {
  const s = a.span(PAD + 120);
  const n = Math.ceil((s * a.R) / PITCH);
  const out = [];
  for (let i = -n; i <= n; i++) out.push((i * PITCH) / a.R);
  return out;
}

/** colour layer: the glazed roof */
function buildRoof(env) {
  const a = env.arc;
  return L.makeLayer(PAD, (g) => {
    const angles = ridgeAngles(a);
    const DEPTH = 1150;
    // 1) the pan tiles (板瓦) in the troughs: darker amber, lit from the upper left
    g.save(); a.clipBelow(g, 7);
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 900, a.R + 8, [[0, '#6b4208'], [0.55, '#9a6610'], [1, '#b98214']]);
    g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    g.restore();
    // trough tile laps: thin curved shadows stepping down the roof
    g.save(); a.clipBelow(g, 7);
    for (let d = 40; d < DEPTH; d += 62) {
      g.strokeStyle = 'rgba(60,32,4,0.5)'; g.lineWidth = 5; a.stroke(g, -d);
      g.strokeStyle = 'rgba(255,214,120,0.22)'; g.lineWidth = 2; a.stroke(g, -d - 5);
    }
    g.restore();
    // 2) drip-tile lips (滴水) poking out between the ridges → a scalloped eave edge
    for (let i = 0; i < angles.length - 1; i++) {
      const mid = (angles[i] + angles[i + 1]) / 2;
      a.at(g, mid, 0, () => {
        g.fillStyle = L.linear(g, 0, -12, 0, 18, [[0, '#f0c24a'], [0.5, '#c88f18'], [1, '#8a5a0c']]);
        g.beginPath(); g.moveTo(-PITCH / 2 + HALF - 2, 10); g.quadraticCurveTo(0, -24, PITCH / 2 - HALF + 2, 10); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,240,180,0.55)'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(-PITCH / 2 + HALF + 2, 6); g.quadraticCurveTo(0, -20, PITCH / 2 - HALF - 2, 6); g.stroke();
      });
    }
    // 3) the round tiles (筒瓦): half-cylinders converging toward the roof's centre
    const r = L.rng('s02');
    for (const th of angles) {
      a.at(g, th, 0, () => {
        const far = (HALF * (a.R - DEPTH)) / a.R;
        const tone = r.range(-0.07, 0.07);
        // cylinder shading across the tile: shadow – body – highlight – body – deep shadow
        g.fillStyle = L.linear(g, -HALF, 0, HALF, 0, [
          [0, L.shade('#8a5a0a', tone)], [0.2, L.shade('#d39a1a', tone)], [0.36, L.shade('#ffe07a', tone)], [0.46, L.shade('#f2bf35', tone)],
          [0.72, L.shade('#c08412', tone)], [1, L.shade('#5a3606', tone)]]);
        g.beginPath(); g.moveTo(-HALF, 4); g.quadraticCurveTo(0, -16, HALF, 4); g.lineTo(far, DEPTH); g.lineTo(-far, DEPTH); g.closePath(); g.fill();
        // joints between tile lengths
        for (let d = 118 + r.range(-6, 6); d < DEPTH; d += 122) {
          const hw = (HALF * (a.R - d)) / a.R;
          g.strokeStyle = 'rgba(70,40,4,0.6)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-hw, d); g.quadraticCurveTo(0, d - 5, hw, d); g.stroke();
          g.strokeStyle = 'rgba(255,236,160,0.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-hw, d + 3); g.quadraticCurveTo(0, d - 2, hw, d + 3); g.stroke();
        }
        // long glossy streak of glaze
        g.strokeStyle = 'rgba(255,250,215,0.5)'; g.lineWidth = 2.2; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-HALF * 0.34, 16); g.lineTo(-far * 0.34, DEPTH * 0.55); g.stroke();
        // the nail cap (瓦钉帽): a glazed dome near the eave end of every ridge
        const cy = 46, cr = 15.5;
        g.fillStyle = 'rgba(40,22,2,0.5)'; g.beginPath(); g.ellipse(4, cy + 7, cr * 1.05, cr * 0.8, 0, 0, L.TAU); g.fill();
        g.fillStyle = L.radial(g, -5, cy - 6, 1, cr * 1.25, [[0, '#fff3b8'], [0.25, '#f6cb47'], [0.7, '#c58a14'], [1, '#6e4508']]);
        g.beginPath(); g.arc(0, cy, cr, 0, L.TAU); g.fill();
        g.fillStyle = 'rgba(255,255,240,0.85)'; g.beginPath(); g.ellipse(-5.5, cy - 6.5, 3.4, 2.2, -0.6, 0, L.TAU); g.fill();
      });
    }
    // 4) glaze mottling + weathering that follows the roof's radial direction
    g.save(); a.clipBelow(g, 8);
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.75;
    g.drawImage(L.polarNoiseLayer(env, PAD, { seed: 's02glaze', scale: 34, sx: 1, sy: 7, octaves: 4, contrast: 1.5, res: 0.4 }), -PAD, -PAD);
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.55;
    g.drawImage(L.polarNoiseLayer(env, PAD, { seed: 's02dirt', scale: 240, octaves: 4, warp: 0.6, res: 0.25, ramp: [[0, '#5a4a22'], [0.5, '#ffffff'], [1, '#ffffff']] }), -PAD, -PAD);
    g.restore();
    // 5) depth: the roof falls into shadow toward the bottom of frame
    g.save(); a.clipBelow(g, 8);
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 760, a.R - 120, [[0, 'rgba(30,14,0,0.8)'], [1, 'rgba(30,14,0,0)']]);
    g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    g.restore();
  });
}

/** background: night courtyard far below, out of focus, with drifting dust */
function buildBack() {
  return L.makeLayer(PAD, (g) => {
    g.fillStyle = L.linear(g, 0, -PAD, 0, H, [[0, '#07090d'], [0.6, '#0d1116'], [1, '#141310']]);
    g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    const r = L.rng('s02bokeh');
    for (let i = 0; i < 46; i++) {
      const x = r.range(-PAD, W + PAD), y = r.range(-PAD, 560), rad = r.range(14, 58);
      g.fillStyle = L.radial(g, x, y, rad * 0.1, rad, [[0, L.rgba(r.pick(['#8fa7c4', '#c9b48a', '#6f86a8']), r.range(0.04, 0.12))], [0.8, L.rgba('#8fa7c4', 0.05)], [1, 'rgba(0,0,0,0)']]);
      g.beginPath(); g.arc(x, y, rad, 0, L.TAU); g.fill();
    }
  });
}
function buildDust() {
  return L.makeLayer(PAD, (g) => {
    L.speckle(g, { seed: 's02dust', count: 520, y: -PAD, h: 720 + PAD, rMin: 0.5, rMax: 2.6, colors: ['#e9e2cf', '#bcd0e6', '#ffe9b0'], alpha: [0.1, 0.75] });
  });
}

export default {
  name: '黄琉璃瓦檐口',
  tone: 'light',            // tagline colour if this shot carries text: 'light' on dark backgrounds, 'dark' on light ones
  init(env) {
    const roof = buildRoof(env);
    S = { roof, back: buildBack(), dust: buildDust(), rim: null };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    // camera: detail slides along the arc (rot) and we creep closer (zoom); foreground moves more than background → parallax
    const rot = L.lerp(-0.008, 0.008, p), zoom = L.lerp(1.0, 1.04, p);
    L.blit(ctx, env, S.back, { rot: rot * 0.3, zoom: 1 + (zoom - 1) * 0.3 });
    L.blit(ctx, env, S.dust, { rot: rot * 0.6, zoom, dy: -10 * p, alpha: 0.9 });
    // soft warm bounce light spilling over the eave
    L.glow(ctx, a.cx - 180, a.crestY + 10, 760, '#ffb53a', 0.13);
    L.blit(ctx, env, S.roof, { rot, zoom });
    // sun glint travelling along the eave line
    const gl = a.pt(L.lerp(-0.16, 0.02, p), -30);
    L.glow(ctx, gl.x, gl.y, 230, '#fff2c0', 0.2);
    L.vignette(ctx, { strength: 0.35 });
  },
};
