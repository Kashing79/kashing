// s20 — 化铜炉口. The mouth of a copper-melting crucible in a coin foundry, seen through heat haze: nothing is sharp.
// The arc is the crucible's round lip — a wide, soft light/dark boundary wrapped in a crimson-magenta halo.
// Below it: the maroon furnace wall, alive with columns of defocused, vertically smeared lights (fire showing through
// cracks, slag running down the wall), sinking to charred black. Above it: one clean field of fire-lit orange air.
//
// Recipe: every light is first drawn small and hard into a "dot" layer, then smeared with an anisotropic blur
// (squash vertically → blur → stretch back) so each becomes a tall soft streak. A subset of the lights is redrawn
// live from sprites so they can flicker; the finished frame is copied in thin strips with a tiny sideways wobble (heat shimmer).
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 64;
let S = null;

const FW = W + PAD * 2, FH = H + PAD * 2;
const full = (g) => g.fillRect(-PAD, -PAD, FW, FH);

/** blur a canvas bx px horizontally and bx*ky px vertically */
function anisoBlur(src, bx, ky) {
  const w = src.width, h = src.height, sh = Math.max(2, Math.round(h / ky));
  const small = L.makeCanvas(w, sh), sg = small.getContext('2d');
  sg.imageSmoothingEnabled = true; sg.imageSmoothingQuality = 'high';
  sg.drawImage(src, 0, 0, w, sh);
  const bl = L.makeCanvas(w, sh), bg = bl.getContext('2d');
  bg.filter = `blur(${bx}px)`; bg.drawImage(small, 0, 0); bg.filter = 'none';
  const out = L.makeCanvas(w, h), og = out.getContext('2d');
  og.imageSmoothingEnabled = true; og.imageSmoothingQuality = 'high';
  og.drawImage(bl, 0, 0, w, h);
  if (src._pad !== undefined) out._pad = src._pad;
  return out;
}

// light colour by intensity: dull crimson → furnace orange → hot yellow
const HEAT = L.makeRamp([[0, '#7e101e'], [0.22, '#b8201e'], [0.45, '#e8641c'], [0.75, '#f08a2c'], [1.05, '#ffc468']]);
const heatCss = (I, al) => { const c = HEAT(I); return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${al.toFixed(3)})`; };

/** where the lights are: irregular columns, brighter in clusters, thinning out and dimming with depth below the lip */
function genLights(env) {
  const a = env.arc, r = L.rng('s20lights'), nz = L.makeNoise('s20col');
  const cols = [], dots = [], drips = [];
  let x = -PAD - 30;
  while (x < W + PAD + 30) {
    x += r.range(12, 29);
    const g0 = nz.fbm(x / 230, 3.3, 3) * 0.5 + 0.5;
    const gain = L.clamp(0.16 + 1.3 * Math.pow(g0, 1.5) + r.range(-0.12, 0.14), 0.07, 1.15);
    cols.push({ x, gain, w: r.range(5, 15), d0: r.range(40, 96), d1: r.range(250, 700) });
    const n = r.int(3, 7);
    for (let i = 0; i < n; i++) {
      const d = 64 + Math.pow(r(), 1.45) * 580;
      const fall = L.smooth((d - 46) / 70) * L.lerp(1, 0.2, L.smooth((d - 230) / 400));
      const I = Math.min(1.15, gain * Math.pow(r(), 1.7) * fall * 1.55);
      if (I < 0.05) continue;
      const rx = r.range(2.2, 4.8) * (0.75 + 0.5 * I);
      dots.push({ x: x + r.range(-3.5, 3.5), d, I, rx, ry: rx * r.range(2.2, 6.5), ph: r() * L.TAU, om: r.range(1.0, 2.9), fl: r.chance(0.36) && I > 0.2 });
    }
  }
  // slag that has run down from the lip and hangs there glowing
  for (let i = 0; i < 15; i++) {
    const dx = r.range(-PAD, W + PAD);
    drips.push({ x: dx, d0: r.range(26, 44), len: r.range(70, 250), w: r.range(7, 15), I: r.range(0.45, 0.95), ph: r() * L.TAU, om: r.range(0.9, 2.2) });
  }
  return { cols, dots, drips };
}

function buildDotLayer(env, lights) {
  const a = env.arc;
  return L.makeLayer(PAD, (g) => {
    g.globalCompositeOperation = 'lighter';
    // dull red slats: the wall itself glowing between darker courses
    for (const c of lights.cols) {
      const y0 = a.yAt(c.x) + c.d0, y1 = a.yAt(c.x) + c.d1;
      g.fillStyle = L.linear(g, 0, y0, 0, y1, [[0, 'rgba(176,18,46,0)'], [0.14, L.rgba('#b0122e', 0.34 * c.gain)], [0.5, L.rgba('#8e1420', 0.22 * c.gain)], [1, 'rgba(110,14,18,0)']]);
      g.fillRect(c.x - c.w / 2, y0, c.w, y1 - y0);
    }
    // hanging slag: a tapering run with a brighter bead at its foot
    for (const s of lights.drips) {
      const y0 = a.yAt(s.x) + s.d0, y1 = y0 + s.len;
      g.fillStyle = L.linear(g, 0, y0, 0, y1, [[0, heatCss(s.I * 0.35, 0.0)], [0.2, heatCss(s.I * 0.45, 0.4)], [0.8, heatCss(s.I * 0.7, 0.6)], [1, heatCss(s.I, 0.85)]]);
      g.beginPath(); g.moveTo(s.x - s.w / 2, y0); g.lineTo(s.x + s.w / 2, y0); g.lineTo(s.x + s.w * 0.22, y1); g.lineTo(s.x - s.w * 0.22, y1); g.closePath(); g.fill();
      g.fillStyle = heatCss(s.I + 0.1, 0.9);
      g.beginPath(); g.ellipse(s.x, y1, s.w * 0.42, s.w * 0.8, 0, 0, L.TAU); g.fill();
    }
    // the lights
    for (const d of lights.dots) {
      g.fillStyle = heatCss(d.I, L.clamp(0.4 + 0.6 * d.I) * (d.fl ? 0.5 : 1));
      g.beginPath(); g.ellipse(d.x, a.yAt(d.x) + d.d, d.rx, d.ry, 0, 0, L.TAU); g.fill();
    }
  });
}

/** soft glowing smears lying along the lip (the glazed, slag-wet rim catching the fire) */
function buildLip(env) {
  const a = env.arc, r = L.rng('s20lip');
  const lay = L.makeLayer(PAD, (g) => {
    g.globalCompositeOperation = 'lighter';
    const put = (th, dr, len, hh, col, al) => a.at(g, th, dr, () => {
      g.scale(len / hh, 1);
      g.fillStyle = L.radial(g, 0, 0, 0, hh, [[0, L.rgba(col, al)], [0.5, L.rgba(col, al * 0.45)], [1, L.rgba(col, 0)]]);
      g.fillRect(-hh, -hh, hh * 2, hh * 2);
    });
    put(-0.018, -54, 250, 17, '#e02244', 0.55);
    put(0.012, -47, 120, 10, '#ff5a3c', 0.3);
    const s = a.span(PAD + 40);
    for (let i = 0; i < 16; i++) {
      const th = r.range(-s, s);
      if (Math.abs(th) < 0.1) continue;
      put(th, -r.range(44, 66), r.range(60, 210), r.range(10, 18), r.pick(['#d81c40', '#c8183a', '#e03a2c']), r.range(0.18, 0.42));
    }
  });
  return L.blurred(lay, 7);
}

function buildBase(env, lights) {
  const a = env.arc;
  const dotLayer = buildDotLayer(env, lights);
  const streak = anisoBlur(dotLayer, 3.2, 6);     // each light → a tall soft streak
  const bloom = anisoBlur(dotLayer, 13, 3.4);     // and its wide glow
  const lip = buildLip(env);

  const base = L.makeLayer(PAD, (g) => {
    // ── 1) the air above the mouth: orange-red against the lip, yellowing as it rises ──
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R, a.R + 760, [[0, '#e04c1c'], [0.14, '#e4581c'], [0.3, '#e8641c'], [0.52, '#ec7624'], [0.78, '#f08a2c'], [1, '#f3963a']]);
    full(g);
    // a broad column of brighter, yellower air standing over the mouth
    g.fillStyle = L.radial(g, a.cx, -40, 0, 1100, [[0, 'rgba(248,164,66,0.55)'], [0.45, 'rgba(244,146,50,0.24)'], [1, 'rgba(240,138,44,0)']]);
    full(g);
    // slow unevenness of the glow (kept very broad and faint: the caption sits here)
    g.save(); g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.2;
    g.drawImage(L.noiseLayer(PAD, { seed: 's20air', scale: 640, octaves: 3, sx: 1.6, sy: 1, res: 0.125, contrast: 1.3 }), -PAD, -PAD);
    g.restore();
    // the far corners fall back to a deeper, redder orange
    g.save(); g.globalCompositeOperation = 'multiply';
    g.fillStyle = L.radial(g, a.cx, 330, 520, 1380, [[0, '#ffffff'], [1, '#f2c2a4']]);
    full(g);
    g.restore();

    // ── 2) the lip: a wide, soft light→dark roll-off centred on the arc, crimson at its heart ──
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 700, a.R + 140, (() => {
      const st = [[140, 'rgba(224,74,28,0)'], [96, 'rgba(224,70,28,0.5)'], [58, 'rgba(220,58,30,1)'], [24, '#c81c2a'], [7, '#a8122c'], [-9, '#861026'],
        [-31, '#5e0c18'], [-70, '#4a0a0c'], [-190, '#3a080a'], [-380, '#27060a'], [-700, '#160405']];
      return st.map(([dr, c]) => [(dr + 700) / 840, c]).reverse();
    })());
    a.pathBelow(g, 140); g.fill();

    // ── 3) the furnace wall below ──
    g.save(); a.clipBelow(g, -12);
    // soot and scorch: broad uneven patches so the lights sit in pools of dark
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.6;
    g.drawImage(L.noiseLayer(PAD, { seed: 's20soot', scale: 300, octaves: 4, warp: 0.6, sx: 0.7, sy: 1.5, res: 0.125, contrast: 1.5, ramp: [[0, '#5a2424'], [0.55, '#ffffff'], [1, '#ffffff']] }), -PAD, -PAD);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.restore();
    // lights, masked so nothing leaks up across the lip
    const lit = L.makeLayer(PAD, (q) => {
      q.globalCompositeOperation = 'lighter';
      q.drawImage(streak, -PAD, -PAD);
      q.globalAlpha = 0.75; q.drawImage(bloom, -PAD, -PAD); q.globalAlpha = 1;
      q.drawImage(lip, -PAD, -PAD);
      q.globalCompositeOperation = 'destination-in';
      q.fillStyle = L.radial(q, a.cx, a.cy, a.R - 80, a.R - 18, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
      q.fillRect(-PAD, -PAD, FW, FH);
    });
    g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(lit, -PAD, -PAD); g.restore();
    // the chamber sinks to charred black toward the foot of the frame
    g.save(); a.clipBelow(g, -60); g.globalCompositeOperation = 'multiply';
    g.fillStyle = L.linear(g, 0, a.crestY + 260, 0, H + PAD, [[0, '#ffffff'], [0.55, '#b98a84'], [1, '#6a4440']]);
    full(g);
    g.restore();

    // ── 4) the crimson-magenta halo that wraps the lip ──
    g.save(); g.globalCompositeOperation = 'screen';
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 110, a.R + 130, [[0, 'rgba(176,18,46,0)'], [0.3, 'rgba(190,20,54,0.16)'], [0.47, 'rgba(214,24,66,0.3)'], [0.6, 'rgba(214,30,60,0.2)'], [1, 'rgba(214,40,50,0)']]);
    full(g);
    g.restore();

    // ── 5) the finest grain, everywhere ──
    g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.55;
    g.drawImage(L.grainTex(FW, FH, { seed: 's20grain', amount: 0.14 }), -PAD, -PAD);
    g.restore();
  });
  return base;
}

/** soft elongated blob used for the flickering lights */
function makeSprite(col) {
  const c = L.makeCanvas(48, 144), g = c.getContext('2d');
  g.translate(24, 72); g.scale(1, 3);
  g.fillStyle = L.radial(g, 0, 0, 0, 24, [[0, L.rgba(col, 0.95)], [0.18, L.rgba(col, 0.7)], [0.45, L.rgba(col, 0.26)], [0.75, L.rgba(col, 0.06)], [1, L.rgba(col, 0)]]);
  g.fillRect(-24, -24, 48, 48);
  return c;
}

export default {
  name: '化铜炉口',
  tone: 'light',
  init(env) {
    const a = env.arc;
    const lights = genLights(env);
    const base = buildBase(env, lights);
    const sprites = [makeSprite('#c8281e'), makeSprite('#e8641c'), makeSprite('#f08a2c'), makeSprite('#ffc060')];
    const flick = [];
    for (const d of lights.dots) {
      if (!d.fl) continue;
      const k = d.I < 0.32 ? 0 : d.I < 0.55 ? 1 : d.I < 0.85 ? 2 : 3;
      flick.push({ x: d.x, y: a.yAt(d.x) + d.d, w: d.rx * 2 + 16, h: d.ry * 2 + 96, spr: sprites[k], al: L.clamp(0.3 + 0.6 * d.I), ph: d.ph, om: d.om });
    }
    for (const s of lights.drips) {
      const y = a.yAt(s.x) + s.d0 + s.len;
      flick.push({ x: s.x, y, w: s.w * 2 + 14, h: 110, spr: sprites[s.I > 0.7 ? 3 : 2], al: 0.5 * s.I, ph: s.ph, om: s.om });
    }
    S = { base, flick, work: L.makeCanvas(W, H) };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const f = p * (env.frames - 1);                  // continuous frame index → deterministic flicker
    const zoom = L.lerp(1.0, 1.014, p);
    const wg = S.work.getContext('2d');
    wg.setTransform(1, 0, 0, 1, 0, 0); wg.globalAlpha = 1; wg.globalCompositeOperation = 'source-over';
    L.blit(wg, env, S.base, { zoom });
    // lights that gutter and flare
    L.cam(wg, env, { zoom }, () => {
      wg.globalCompositeOperation = 'lighter';
      for (const q of S.flick) {
        const tw = 0.5 + 0.5 * Math.sin(f * q.om + q.ph);
        wg.globalAlpha = q.al * (0.08 + 0.92 * tw * tw);
        wg.drawImage(q.spr, q.x - q.w / 2, q.y - q.h / 2, q.w, q.h);
      }
      // the halo breathes with the fire
      wg.globalAlpha = 1; wg.globalCompositeOperation = 'screen';
      const br = 0.5 + 0.5 * Math.sin(f * 1.25 + 0.6);
      wg.fillStyle = L.radial(wg, a.cx, a.cy, a.R - 90, a.R + 90, [[0, 'rgba(200,20,56,0)'], [0.5, `rgba(226,30,70,${(0.04 + 0.1 * br).toFixed(3)})`], [1, 'rgba(226,40,60,0)']]);
      wg.fillRect(-40, a.crestY - 120, W + 80, 460);
    });
    wg.globalAlpha = 1; wg.globalCompositeOperation = 'source-over';

    ctx.drawImage(S.work, 0, 0);
    // heat shimmer: thin horizontal strips slide a pixel or two sideways, in slow waves that crawl upward
    const SH = 4, y0 = Math.round(a.crestY - 150);
    for (let y = y0; y < H; y += SH) {
      const k = L.smooth((y - y0) / 90);
      const dx = k * (1.5 * Math.sin(y * 0.047 + f * 1.7) + 0.9 * Math.sin(y * 0.019 - f * 1.15 + 2.0));
      ctx.drawImage(S.work, 0, y, W, SH, dx, y, W, SH);
    }
  },
};
