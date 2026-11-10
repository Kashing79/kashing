// titlecard.js — the closing title card shared by every film in the series.
// Mirrors the reference's ending: hard cut to a dark, quiet space above the opening image, card A (the title) holds,
// hard cut to card B (seal + call to action), then the camera tilts back down onto the opening shot so the film loops.
import * as L from './core.js';

const CUT_B = 33;        // frame within the shot where card B replaces card A  → 17.28 s
const TILT_START = 50;   // frame where the tilt-down begins                     → 17.96 s

/** a small vermilion seal with two stacked characters */
export function drawSeal(ctx, x, y, size, chars, opts = {}) {
  const { color = '#b3261e', ink = '#f7f2e8', font = 'xiaowei', seed = 'seal' } = opts;
  ctx.save();
  ctx.translate(x, y);
  const r = L.rng(seed);
  ctx.fillStyle = color;
  const h = size / 2, rad = size * 0.12;
  ctx.beginPath();
  ctx.moveTo(-h + rad, -h); ctx.lineTo(h - rad, -h); ctx.quadraticCurveTo(h, -h, h, -h + rad);
  ctx.lineTo(h, h - rad); ctx.quadraticCurveTo(h, h, h - rad, h); ctx.lineTo(-h + rad, h); ctx.quadraticCurveTo(-h, h, -h, h - rad);
  ctx.lineTo(-h, -h + rad); ctx.quadraticCurveTo(-h, -h, -h + rad, -h); ctx.closePath(); ctx.fill();
  const cs = Array.from(chars);
  L.text(ctx, cs[0] || '', 0, -size * 0.235, { font, size: size * 0.46, weight: 400, color: ink });
  L.text(ctx, cs[1] || '', 0, size * 0.235, { font, size: size * 0.46, weight: 400, color: ink });
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

/**
 * makeTitleScene({
 *   initOpening(env), drawOpening(ctx, env, {tilt, k}),   // the film's opening shot, drawable with the camera tilted up by `tilt` px
 *   title: '中国古建筑', seal: '营造', cta: ['千年营造', '等你发现'],
 *   tilt0: 720,                 // how far up the camera looks while the cards are on screen
 *   dim: 0.35, dimColor: '#05070b',   // extra darkening of the sky behind the cards
 *   style: { font, titleSize, titleWeight, titleSpacing, ctaSize, ctaWeights: [600, 300], ink, sealColor, sealFont, y }
 * })
 */
export function makeTitleScene(cfg) {
  const { initOpening, drawOpening, title, seal, cta, tilt0 = 720, dim = 0.35, dimColor = '#05070b' } = cfg;
  // style may be an object or a function returning one (resolved every frame, so typography can be swapped at runtime)
  const style = () => Object.assign({ font: 'serif', titleSize: 92, titleWeight: 600, titleSpacing: 22, ctaSize: 64, ctaWeights: [600, 300], ctaSpacing: 10,
    ink: '#f7f2e8', sealColor: '#b3261e', sealFont: 'xiaowei', sealSize: 78, y: 498 }, (typeof cfg.style === 'function' ? cfg.style() : cfg.style) || {});
  return {
    name: '片名卡',
    tone: 'light',
    init(env) { if (initOpening) initOpening(env); },
    draw(ctx, env) {
      const st = style();
      const f = env.frame, n = env.frames;
      const prog = (ff) => L.ease.inOutCubic(L.clamp((ff - TILT_START) / (n - 1 - TILT_START)));
      const e = prog(f);
      drawOpening(ctx, env, { tilt: tilt0 * (1 - e), k: 0 });
      // keep the space behind the cards dark and quiet until the tilt reveals the opening image again
      ctx.save(); ctx.globalAlpha = dim * (1 - e); ctx.fillStyle = dimColor; ctx.fillRect(0, 0, L.W, L.H); ctx.restore();
      if (f < CUT_B) {
        L.text(ctx, title, L.W / 2, st.y, { font: st.font, size: st.titleSize, weight: st.titleWeight, color: st.ink, spacing: st.titleSpacing });
        return;
      }
      // card B rides upward out of frame as the camera tilts down, with a little vertical motion blur
      const y = st.y - tilt0 * e;
      if (y < -180) return;
      const speed = f > TILT_START ? tilt0 * (prog(f + 0.5) - prog(f - 0.5)) : 0;
      const smear = Math.min(22, speed * 0.55);
      const passes = smear > 1.5 ? 7 : 1;
      // measure the group so it is centred as a whole: [seal] gap [cta0] gap [cta1]
      ctx.save();
      const fam = L.FONTS[st.font] || st.font;
      const widthOf = (str, weight) => { ctx.font = `${weight} ${st.ctaSize}px ${fam}`; return Array.from(str).reduce((w, ch) => w + ctx.measureText(ch).width, 0) + st.ctaSpacing * (Array.from(str).length - 1); };
      const w0 = widthOf(cta[0], st.ctaWeights[0]), w1 = cta[1] ? widthOf(cta[1], st.ctaWeights[1]) : 0;
      ctx.restore();
      const gapSeal = st.ctaSize * 0.42, gapMid = st.ctaSize * 0.62;
      const total = st.sealSize + gapSeal + w0 + (cta[1] ? gapMid + w1 : 0);
      const x0 = L.W / 2 - total / 2;
      ctx.save();
      for (let i = 0; i < passes; i++) {
        const o = passes === 1 ? 0 : L.lerp(-smear, smear, i / (passes - 1));
        ctx.globalAlpha = 1 / passes;
        drawSeal(ctx, x0 + st.sealSize / 2, y + o, st.sealSize, seal, { color: st.sealColor, ink: st.ink, font: st.sealFont });
        L.text(ctx, cta[0], x0 + st.sealSize + gapSeal, y + o, { font: st.font, size: st.ctaSize, weight: st.ctaWeights[0], color: st.ink, align: 'left', spacing: st.ctaSpacing });
        if (cta[1]) L.text(ctx, cta[1], x0 + st.sealSize + gapSeal + w0 + gapMid, y + o, { font: st.font, size: st.ctaSize, weight: st.ctaWeights[1], color: st.ink, align: 'left', spacing: st.ctaSpacing });
      }
      ctx.restore();
    },
  };
}
