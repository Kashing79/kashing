// title — 片名卡. Mirrors the reference's ending: hard cut to a dark sky with a faint glow at the bottom,
// title A holds, hard cut to title B, then the camera tilts back down onto the opening dawn so the film loops.
import * as L from '../lib/core.js';
import { initDawn, drawDawn } from './s01-great-wall-dawn.js';

const TILT0 = 720;            // how far up the camera looks during the cards
const CUT_B = 33;             // frame (within this shot) where card B replaces card A  → 17.28 s
const TILT_START = 50;        // frame where the tilt-down begins                         → 17.96 s
const INK = '#f7f2e8';

/** a small vermilion seal reading 营造 (yingzao: "to build") */
function seal(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  const r = L.rng('seal');
  ctx.fillStyle = '#b3261e';
  const h = size / 2, rad = size * 0.12;
  ctx.beginPath();
  ctx.moveTo(-h + rad, -h); ctx.lineTo(h - rad, -h); ctx.quadraticCurveTo(h, -h, h, -h + rad);
  ctx.lineTo(h, h - rad); ctx.quadraticCurveTo(h, h, h - rad, h); ctx.lineTo(-h + rad, h); ctx.quadraticCurveTo(-h, h, -h, h - rad);
  ctx.lineTo(-h, -h + rad); ctx.quadraticCurveTo(-h, -h, -h + rad, -h); ctx.closePath(); ctx.fill();
  L.text(ctx, '营', 0, -size * 0.235, { font: 'xiaowei', size: size * 0.46, weight: 400, color: INK });
  L.text(ctx, '造', 0, size * 0.235, { font: 'xiaowei', size: size * 0.46, weight: 400, color: INK });
  // worn stone-seal edges
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 46; i++) {
    const px = r.range(-h, h), py = r.range(-h, h);
    const edge = Math.max(Math.abs(px), Math.abs(py)) / h;
    if (r() > edge * edge) continue;
    ctx.globalAlpha = r.range(0.25, 0.9);
    ctx.beginPath(); ctx.ellipse(px, py, r.range(0.6, 2.4), r.range(0.6, 1.8), r() * 3, 0, L.TAU); ctx.fill();
  }
  ctx.restore();
}

export default {
  name: '片名卡',
  tone: 'light',
  init(env) { initDawn(env); },
  draw(ctx, env) {
    const f = env.frame, n = env.frames;
    // camera tilt: hold high, then ease down (accelerating, like the reference) to land exactly on the opening frame
    const u = L.clamp((f - TILT_START) / (n - 1 - TILT_START));
    const e = L.ease.inOutCubic(u);
    const tilt = TILT0 * (1 - e);
    drawDawn(ctx, env, { tilt, k: 0 });
    // gentle darkening so the cards read as "night sky" until the tilt reveals the dawn
    ctx.save(); ctx.globalAlpha = 0.35 * (1 - e); ctx.fillStyle = '#05070b'; ctx.fillRect(0, 0, L.W, L.H); ctx.restore();

    const cy = 498;
    if (f < CUT_B) {
      // card A — the title
      L.text(ctx, '中国古建筑', L.W / 2, cy, { font: 'serif', size: 92, weight: 600, color: INK, spacing: 22 });
    } else {
      // card B — seal + call to action; it rides upward out of frame as the camera tilts down
      const rise = TILT0 * e * 1.0;
      const y = cy - rise;
      const speed = f > TILT_START ? TILT0 * (L.ease.inOutCubic(L.clamp((f + 0.5 - TILT_START) / (n - 1 - TILT_START))) - L.ease.inOutCubic(L.clamp((f - 0.5 - TILT_START) / (n - 1 - TILT_START)))) : 0;
      if (y > -160) {
        ctx.save();
        // vertical motion blur grows with speed, as in the reference
        const smear = Math.min(22, speed * 0.55);
        const passes = smear > 1.5 ? 7 : 1;
        for (let i = 0; i < passes; i++) {
          const o = passes === 1 ? 0 : L.lerp(-smear, smear, i / (passes - 1));
          ctx.globalAlpha = 1 / passes;
          seal(ctx, L.W / 2 - 322, y + o, 78);
          L.text(ctx, '千年营造', L.W / 2 - 252, y + o, { font: 'serif', size: 64, weight: 600, color: INK, align: 'left', spacing: 10 });
          L.text(ctx, '等你发现', L.W / 2 + 92, y + o, { font: 'serif', size: 64, weight: 300, color: INK, align: 'left', spacing: 10 });
        }
        ctx.restore();
      }
    }
  },
};
