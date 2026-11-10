// s01 — 长城·晨曦. The opening "horizon": first light behind a mountain ridge carrying the Great Wall.
// Also exports drawDawn() so the title card can tilt back down onto exactly this image (the film loops).
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 220;
let S = null; // cached layers

// sky colour by height above the arc (px)
const SKY = [
  [-6, '#1c0d08'], [0, '#9a260e'], [9, '#e2501a'], [32, '#f6812a'], [78, '#f8a653'], [128, '#edc096'],
  [184, '#b9bab8'], [252, '#6f9aa8'], [345, '#3f6278'], [470, '#22364a'], [650, '#111a26'], [1000, '#0a0e15'], [1700, '#07090e'],
];

function buildWall(env) {
  const a = env.arc;
  return L.makeLayer(PAD, (g) => {
    const s = a.span(PAD + 80);
    g.fillStyle = '#0b0706';
    // wall body hugging the ridge line
    a.pathBand(g, 1, -16, -s, s); g.fill();
    // merlons (垛口)
    a.along({ spacing: 25, dr: 1, t0: -s, t1: s }, (q) => {
      a.at(g, q.theta, 1, () => { g.fillRect(-7.5, -9, 15, 10); });
    });
    // watchtowers (敌楼): two-storey masonry blocks with arched openings and a crenellated top
    const tower = (theta, k) => {
      a.at(g, theta, -2, () => {
        g.scale(k, k);
        g.fillStyle = '#0b0706';
        g.beginPath(); g.moveTo(-36, 2); g.lineTo(-33, -56); g.lineTo(33, -56); g.lineTo(36, 2); g.closePath(); g.fill();
        g.fillRect(-38, -62, 76, 7); // string course
        for (let i = -2; i <= 2; i++) g.fillRect(i * 16 - 5.5, -72, 11, 11); // merlons
        // small lookout hut on top of the larger tower
        if (k > 0.9) { g.fillRect(-15, -86, 30, 16); g.beginPath(); g.moveTo(-21, -85); g.lineTo(0, -97); g.lineTo(21, -85); g.closePath(); g.fill(); }
        // arched windows let the dawn through
        g.globalCompositeOperation = 'destination-out';
        for (let i = -1; i <= 1; i++) {
          g.beginPath(); g.moveTo(i * 20 - 4.5, -24); g.lineTo(i * 20 - 4.5, -36); g.arc(i * 20, -36, 4.5, Math.PI, 0); g.lineTo(i * 20 + 4.5, -24); g.closePath(); g.fill();
        }
        g.globalCompositeOperation = 'source-over';
      });
    };
    tower(-0.128, 1.0);
    tower(0.232, 0.62);
    tower(-0.335, 0.8);
    tower(0.41, 0.5);
  });
}

function buildLand(env) {
  const a = env.arc;
  return L.makeLayer(PAD, (g) => {
    // the mountain itself
    g.save(); a.clipBelow(g, 1);
    g.fillStyle = L.linear(g, 0, a.crestY, 0, H + PAD, [[0, '#0d0908'], [0.5, '#0a0707'], [1, '#060505']]);
    g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 3);
    // nearer ridges stepping down toward the camera, each with a breath of blue mist above it
    const nz = L.makeNoise('s01ridge');
    const ridges = [[70, 0.9, '#0b0808', 0.16], [170, 1.6, '#090707', 0.13], [300, 2.4, '#070606', 0.1], [450, 3.1, '#050505', 0.08]];
    ridges.forEach(([drop, freq, col, mist], k) => {
      const pts = [];
      for (let i = 0; i <= 120; i++) {
        const x = L.lerp(-PAD, W + PAD, i / 120);
        const y = a.yAt(L.clamp(x, a.cx - a.R * 0.6, a.cx + a.R * 0.6), 0) + drop + (38 + k * 16) * nz.fbm(i / 120 * freq * 3 + k * 7.3, k * 3.1, 4) + (k % 2 ? 1 : -1) * (x - a.cx) * 0.05;
        pts.push([x, y]);
      }
      const trace = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); pts.forEach((p) => g.lineTo(p[0], p[1])); g.lineTo(W + PAD, H + PAD * 2); g.lineTo(-PAD, H + PAD * 2); g.closePath(); };
      g.save(); trace(); g.clip();
      g.fillStyle = col; g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 3);
      g.restore();
      // mist sitting in the valley just above this ridge line
      g.save();
      g.globalCompositeOperation = 'screen';
      for (const p of pts.filter((_, i) => i % 6 === 0)) {
        g.fillStyle = L.radial(g, p[0], p[1] - 8, 0, 150, [[0, `rgba(70,84,110,${mist})`], [1, 'rgba(70,84,110,0)']]);
        g.fillRect(p[0] - 150, p[1] - 158, 300, 300);
      }
      g.restore();
      g.save(); trace(); g.clip(); g.fillStyle = col; g.globalAlpha = 0.8; g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 3); g.restore();
    });
    g.restore();
  });
}

function buildClouds(env) {
  // thin strata following the curve of the horizon; they thin out with height
  const a = env.arc;
  const tex = L.polarNoiseLayer(env, PAD, { seed: 's01cloud', scale: 54, sx: 26, sy: 1, octaves: 4, gain: 0.5, contrast: 1.5, res: 0.4,
    ramp: [[0, 'rgba(26,16,22,0.5)'], [0.4, 'rgba(26,16,22,0)'], [0.66, 'rgba(255,214,170,0)'], [1, 'rgba(255,222,184,0.34)']] });
  const g = tex.getContext('2d');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = L.radial(g, a.cx + PAD, a.cy + PAD, a.R, a.R + 330, [[0, 'rgba(0,0,0,1)'], [0.35, 'rgba(0,0,0,0.8)'], [1, 'rgba(0,0,0,0)']]);
  g.fillRect(0, 0, tex.width, tex.height);
  return L.blurred(tex, 1.2);
}

function buildStars() {
  return L.makeLayer(PAD, (g) => {
    const r = L.rng('stars');
    for (let i = 0; i < 260; i++) {
      const x = r.range(-PAD, W + PAD), y = r.range(-1500, 200);
      g.globalAlpha = r.range(0.15, 0.7) * (r.chance(0.08) ? 1.3 : 0.7);
      g.fillStyle = r.pick(['#dfe8ff', '#fff3df', '#ffffff']);
      const s = r.range(0.6, 1.7); g.fillRect(x, y, s, s);
    }
  });
}

export function initDawn(env) {
  if (S) return S;
  S = { wall: buildWall(env), land: buildLand(env), clouds: buildClouds(env), stars: buildStars() };
  return S;
}

/**
 * tilt: px the camera has tilted UP (the whole picture slides down by this much). 0 = the opening framing.
 * k:    0..1 progress of the dawn itself (glow grows, slow drift along the ridge).
 */
export function drawDawn(ctx, env, { tilt = 0, k = 0 } = {}) {
  const a = env.arc; const s = initDawn(env);
  const rot = L.lerp(-0.0035, 0.0035, k), zoom = L.lerp(1.0, 1.035, L.ease.outQuad(k));
  ctx.save();
  ctx.translate(0, tilt);
  // sky: concentric bands hugging the arc
  ctx.fillStyle = L.radial(ctx, a.cx, a.cy, a.R - 6, a.R + 1700, SKY.map(([dr, c]) => [(dr + 6) / 1706, c]));
  ctx.fillRect(-PAD, -tilt - PAD, W + PAD * 2, H + PAD * 2 + tilt);
  // stars far above
  ctx.drawImage(s.stars, -PAD, -PAD);
  // strata of cloud
  ctx.save(); a.clipAbove(ctx, 4);
  ctx.globalAlpha = 0.85; L.blit(ctx, env, s.clouds, { rot: rot * 2.2, zoom });
  ctx.restore();
  // the sun is still just below the ridge: bloom where it will break through
  const sun = a.pt(0.045 + rot, 2);
  const gl = 0.55 + 0.45 * k;
  L.glow(ctx, sun.x, sun.y, 620, '#ff8a2a', 0.34 * gl);
  L.glow(ctx, sun.x, sun.y, 250, '#ffc36a', 0.5 * gl);
  L.glow(ctx, sun.x, sun.y - 2, 70, '#fff0c8', 0.75 * gl);
  // land + wall silhouettes
  L.blit(ctx, env, s.land, { rot, zoom });
  L.blit(ctx, env, s.wall, { rot, zoom });
  // ember rim along the ridge near the sun
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = L.linear(ctx, sun.x - 520, 0, sun.x + 520, 0, [[0, 'rgba(255,120,40,0)'], [0.5, `rgba(255,170,80,${0.55 * gl})`], [1, 'rgba(255,120,40,0)']]);
  ctx.lineWidth = 2.2; a.stroke(ctx, -17);
  ctx.restore();
  ctx.restore();
}

export default {
  name: '长城·晨曦',
  tone: 'light',
  init(env) { initDawn(env); },
  draw(ctx, env, p) { drawDawn(ctx, env, { tilt: 0, k: p }); },
};

// generic names used by the shared title card (every film's opening shot exports these three)
export { initDawn as initOpening, drawDawn as drawOpening };
export const TITLE_TILT = 720;
