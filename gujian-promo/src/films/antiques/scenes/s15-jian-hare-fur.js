// s15 — 建盏兔毫. Macro of a black-glazed Jian tea bowl: the arc is the lip of the bowl, and below it the wall,
// where thousands of hair-fine gold-brown and silver streaks ("hare's fur") run down from the thin rust-brown rim
// into glaze that pools thicker and blacker. A hairline of violet→cyan iridescence rides the lip; above it, pure black.
//
// Recipe: the glaze is painted once in "unwrapped" space (x = distance along the rim, y = depth below it), where
// every streak is simply a vertical hair, then bent onto the arc per pixel in init() — so the streaks are exactly
// radial and `rot` slides them along the rim without ever disturbing the arc. The lighting (a soft window
// reflection lying across the glaze, the iridescent rim light) stays put while the fur slides beneath it.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 120;
let S = null;

// each streak of fur is pale down its spine and rusty at its feathered edges
const FUR = {
  gold: { core: ['#e6b05c', '#d79d4c', '#f2c474'], mid: ['#b07a3c', '#c48b44'], edge: ['#8a5420', '#7a3b1c', '#9c6429'] },
  silver: { core: ['#ccd6e1', '#dde6f0', '#b6c2d0'], mid: ['#9aa3ad', '#9aabc0'], edge: ['#6f7a86', '#7b6a5a', '#8a5420'] },
  brown: { core: ['#b07a3c', '#a06a30'], mid: ['#8c5a28'], edge: ['#6a3d18', '#7a3b1c'] },
};
const RUST = ['#7a3b1c', '#8c451f', '#6a3116', '#9a4f22'];

function geometry(env) {
  const a = env.arc;
  const X0 = -PAD, Y0 = Math.floor(a.crestY) - 4;
  const RW = W + PAD * 2, RH = H + PAD - Y0;
  // the unwrapped strip must reach the deepest / widest pixel of the padded frame (its bottom corners and bottom centre)
  const UMAX = Math.ceil(Math.atan2(W / 2 + PAD, a.cy - (H + PAD)) * a.R) + 12;
  const TH = Math.ceil(a.R - (a.cy - (H + PAD))) + 12;
  return { X0, Y0, RW, RH, UMAX, TW: UMAX * 2, TH };
}

/** a canvas covering only part of the frame; draw into it with frame coordinates */
function region(x0, y0, w, h, draw) {
  const c = L.makeCanvas(w, h), g = c.getContext('2d');
  g.translate(-x0, -y0);
  c._x = x0; c._y = y0;
  if (draw) draw(g);
  return c;
}
const put = (ctx, c) => ctx.drawImage(c, c._x, c._y);

/** the glaze in unwrapped space: x → along the rim, y → down the wall (0 = lip) */
function buildFur(geo) {
  const { TW, TH } = geo;
  const c = L.makeCanvas(TW, TH), g = c.getContext('2d');
  const nz = L.makeNoise('s15dens');

  // how thick the fur grows along the rim: clumps and thinner gaps, never even
  const dens = new Float32Array(TW), dens2 = new Float32Array(TW);
  const clump = (x) => 0.66 + 0.3 * nz.n2(x / 170, 1.7) + 0.22 * nz.n2(x / 41, 7.3);
  // slide the pattern so a thick clump, not a gap, sits under the crest (where the eye lands first)
  let shift = 0, best = -1e9;
  for (let sft = 0; sft < 3000; sft += 25) {
    let m = 0;
    for (let x = TW / 2 - 170; x <= TW / 2 + 170; x += 10) m += clump(x + sft);
    if (m > best) { best = m; shift = sft; }
  }
  for (let x = 0; x < TW; x++) {
    dens[x] = L.clamp(clump(x + shift) + 0.12 * nz.n2(x / 11, 3.1), 0.16, 1);
    dens2[x] = Math.pow(L.clamp(0.4 + 0.75 * nz.n2(x / 280 + 40, 9.9) + 0.22 * nz.n2(x / 60, 5.5)), 1.5);
  }
  const strip = (profile) => {
    const s = L.makeCanvas(TW, 1), img = new ImageData(TW, 1);
    for (let x = 0; x < TW; x++) img.data[x * 4 + 3] = profile[x] * 255;
    s.getContext('2d').putImageData(img, 0, 0);
    return s;
  };
  /** keep `cv` only where the fur is dense (profile along x) and shallow (alpha stops down y) */
  const maskBy = (cv, profile, stops) => {
    const m = L.makeCanvas(TW, TH), mg = m.getContext('2d');
    mg.fillStyle = L.linear(mg, 0, 0, 0, TH, stops.map(([t, al]) => [t, `rgba(0,0,0,${al})`]));
    mg.fillRect(0, 0, TW, TH);
    if (profile) { mg.globalCompositeOperation = 'destination-in'; mg.drawImage(strip(profile), 0, 0, TW, 1, 0, 0, TW, TH); }
    const cg = cv.getContext('2d');
    cg.globalCompositeOperation = 'destination-in'; cg.drawImage(m, 0, 0); cg.globalCompositeOperation = 'source-over';
    return cv;
  };
  /** one hair: fades in under its head, trails off slowly */
  const hair = (sg, x, y0, len, w, col, al, head = 0.06) => {
    const gr = sg.createLinearGradient(0, y0, 0, y0 + len);
    gr.addColorStop(0, L.rgba(col, 0)); gr.addColorStop(head, L.rgba(col, al));
    gr.addColorStop(0.42, L.rgba(col, al * 0.74)); gr.addColorStop(1, L.rgba(col, 0));
    sg.fillStyle = gr; sg.fillRect(x - w / 2, y0, w, len);
  };
  /** one streak of fur = a bundle of hairs: long and pale down its spine, short and rusty at its feathered edges → it tapers as it runs */
  const streak = (sg, r, x, y0, len, w, fam, al) => {
    const n = Math.max(1, Math.round(w / 1.1));
    for (let k = 0; k < n; k++) {
      const t = n === 1 ? 0 : (k / (n - 1)) * 2 - 1;
      const core = 1 - t * t, cj = core + r.range(-0.22, 0.22);
      const col = r.pick(cj > 0.62 ? fam.core : cj > 0.28 ? fam.mid : fam.edge);
      hair(sg, x + t * w * 0.5 + r.range(-0.45, 0.45), y0 + r.range(0, 16) * (1 - core * 0.6), len * (0.4 + 0.6 * core) * r.range(0.78, 1.05),
        r.range(1.05, 1.75), col, al * (0.42 + 0.58 * core) * r.range(0.7, 1), 0.1);
    }
  };

  // 1) the ground: brown-black glaze, a touch warmer where it runs thin under the lip
  g.fillStyle = L.linear(g, 0, 0, 0, TH, [[0, '#32180b'], [0.06, '#24120a'], [0.2, '#1a0f0a'], [0.6, '#150c08'], [1, '#0d0806']]);
  g.fillRect(0, 0, TW, TH);
  g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.35;
  g.drawImage(L.noiseTex(TW, TH, { seed: 's15mott', scale: 150, sx: 0.5, sy: 3.2, octaves: 3, res: 0.2, contrast: 1.5, ramp: [[0, '#000000'], [0.5, '#6a5548'], [1, '#c79a6c']] }), 0, 0);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;

  // 2) the rust of the thin rim bleeding down in short frayed tongues
  const rr = L.rng('s15rust');
  for (let i = 0; i < 2600; i++) {
    const x = rr() * TW;
    hair(g, x, -4, 26 + 130 * Math.pow(rr(), 2.4), 1.4 + 5 * Math.pow(rr(), 2), rr.pick(RUST), rr.range(0.3, 0.85), 0.02);
  }

  // 3) a brown woolly haze close under the lip, where countless hairs are too fine to tell apart
  const furA = L.noiseTex(TW, TH, { seed: 's15furA', scale: 44, sx: 0.09, sy: 9, octaves: 3, gain: 0.6, ridged: true, contrast: 2.6, bias: -0.34, res: 0.75,
    ramp: [[0, 'rgba(122,59,28,0)'], [0.4, 'rgba(122,59,28,0)'], [0.62, 'rgba(140,84,34,0.5)'], [0.82, 'rgba(176,122,60,0.8)'], [1, 'rgba(214,160,86,0.95)']] });
  maskBy(furA, dens, [[0, 0.78], [0.12, 0.6], [0.3, 0.26], [0.55, 0.08], [1, 0.02]]);
  g.globalCompositeOperation = 'screen'; g.drawImage(furA, 0, 0); g.globalCompositeOperation = 'source-over';

  // noise that bites gaps into the fur so the hairs are not ruled lines
  const bite = (seed, k, sx, sy, res) => L.noiseTex(TW, TH, { seed, scale: 22, sx, sy, octaves: 2, contrast: 2.4, res,
    ramp: [[0, `rgba(0,0,0,${0.9 * k})`], [0.4, `rgba(0,0,0,${0.25 * k})`], [0.58, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0)']] });

  // 4) the fur proper: tapering streaks of gold-brown, silver and plain brown, each a bundle of hairs
  const fur = L.makeCanvas(TW, TH), fg0 = fur.getContext('2d');
  const r = L.rng('s15fur');
  for (let i = 0; i < 1750; i++) {
    const x = r() * TW, dn = dens[x | 0];
    if (r() > dn) continue;
    const pickFam = r();
    const fam = pickFam < dens2[x | 0] * 0.6 ? FUR.silver : pickFam > 0.84 ? FUR.brown : FUR.gold;
    const loose = r.chance(0.12);
    const y0 = loose ? r.range(50, 330) : 5 + Math.pow(r(), 1.7) * 44;
    const len = loose ? r.range(60, 210) : 90 + 500 * Math.pow(r(), 1.7);
    const w = 1.4 + 13 * Math.pow(r(), 3.1) * (loose ? 0.5 : 1);
    streak(fg0, r, x, y0, len, w, fam, r.range(0.5, 1));
  }
  // … and whisper-thin single hairs filling in between them
  for (let i = 0; i < 2600; i++) {
    const x = r() * TW;
    if (r() > dens[x | 0]) continue;
    const fam = r() < dens2[x | 0] * 0.5 ? FUR.silver : FUR.gold;
    hair(fg0, x, 4 + Math.pow(r(), 1.6) * 150, 50 + 330 * Math.pow(r(), 1.8), r.range(0.8, 1.4), r.pick(r.chance(0.4) ? fam.core : fam.mid), r.range(0.25, 0.7), 0.1);
  }
  fg0.globalCompositeOperation = 'destination-out';
  fg0.drawImage(bite('s15bite', 0.36, 0.085, 7.5, 0.8), 0, 0);     // hair by hair
  fg0.drawImage(bite('s15biteW', 0.5, 0.36, 6.5, 0.5), 0, 0);      // whole streaks thinning and thickening as they run
  g.drawImage(fur, 0, 0);
  // the streaks glow a little into the glaze around them
  g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.32;
  g.drawImage(L.blurred(fur, 4), 0, 0);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;

  // 5) the lip itself: glaze at its thinnest — a line of iron rust with a rounded highlight
  g.fillStyle = L.linear(g, 0, 0, 0, 40, [[0, 'rgba(126,61,28,0.96)'], [0.3, 'rgba(122,59,28,0.62)'], [1, 'rgba(122,59,28,0)']]);
  g.fillRect(0, 0, TW, 40);
  g.fillStyle = L.linear(g, 0, 0, 0, 12, [[0, '#8a3f1a'], [0.26, '#cf6f2c'], [0.55, '#9a4a1f'], [1, 'rgba(122,59,28,0)']]);
  g.fillRect(0, 0, TW, 12);

  // 6) deeper down the glaze pools thick: everything sinks toward black
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = L.linear(g, 0, 0, 0, TH, [[0, '#ffffff'], [0.32, '#f4ebe2'], [0.55, '#c4b2a2'], [0.8, '#8a7768'], [1, '#5e4e44']]);
  g.fillRect(0, 0, TW, TH);
  g.globalCompositeOperation = 'source-over';

  // 7) shallow focus: the wall softens as it falls away from the lip
  const soft = L.blurred(c, 3.2), fg = soft.getContext('2d');
  fg.globalCompositeOperation = 'destination-in';
  fg.fillStyle = L.linear(fg, 0, 0, 0, TH, [[0, 'rgba(0,0,0,0)'], [0.5, 'rgba(0,0,0,0)'], [0.92, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,1)']]);
  fg.fillRect(0, 0, TW, TH);
  g.drawImage(soft, 0, 0);
  return c;
}

/** bend the unwrapped glaze onto the arc (bilinear), letting the streaks sway a little with the flow of the glaze */
function wrapOntoArc(env, tex, geo) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const { X0, Y0, RW, RH, UMAX, TW, TH } = geo;
  const src = tex.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, TW, TH).data;
  const out = new ImageData(RW, RH), d = out.data;
  // sway field on a coarse grid: zero at the lip, growing with depth
  const nz = L.makeNoise('s15flow');
  const GS = 16, gw = Math.ceil(TW / GS) + 2, gh = Math.ceil(TH / GS) + 2;
  const sway = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const u = i * GS, v = j * GS;
    sway[j * gw + i] = L.smooth(v / 110) * (7.5 * nz.n2(u / 230, v / 360) + 2.8 * nz.n2(u / 64 + 9, v / 200 - 4));
  }
  const xMax = TW - 1.002, yMax = TH - 1.002;
  const GRADE = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const t = i / 255; GRADE[i] = i === 0 ? 1 : (Math.pow(t, 1.1) * 1.22 * (1 - 0.1 * t)) / t; }
  for (let j = 0; j < RH; j++) {
    const ddy = cy - (Y0 + j + 0.5);
    for (let i = 0; i < RW; i++) {
      const ddx = X0 + i + 0.5 - cx;
      const v = R - Math.sqrt(ddx * ddx + ddy * ddy);
      if (v < -0.5) continue;
      const cov = v + 0.5 > 1 ? 1 : v + 0.5;                // anti-aliased lip
      let tx = Math.atan2(ddx, ddy) * R + UMAX, ty = v < 0 ? 0 : v;
      if (ty > yMax) ty = yMax;
      const fx = tx / GS, fy = ty / GS, i0 = fx | 0, j0 = fy | 0, ax = fx - i0, ay = fy - j0, gk = j0 * gw + i0;
      tx += (sway[gk] + (sway[gk + 1] - sway[gk]) * ax) * (1 - ay) + (sway[gk + gw] + (sway[gk + gw + 1] - sway[gk + gw]) * ax) * ay;
      if (tx < 0) tx = 0; else if (tx > xMax) tx = xMax;
      const x0 = tx | 0, y0 = ty | 0, bx = tx - x0, by = ty - y0;
      const k = (y0 * TW + x0) * 4, k2 = k + TW * 4, o = (j * RW + i) * 4;
      const w00 = (1 - bx) * (1 - by), w10 = bx * (1 - by), w01 = (1 - bx) * by, w11 = bx * by;
      const cr = src[k] * w00 + src[k + 4] * w10 + src[k2] * w01 + src[k2 + 4] * w11;
      const cg = src[k + 1] * w00 + src[k + 5] * w10 + src[k2 + 1] * w01 + src[k2 + 5] * w11;
      const cb = src[k + 2] * w00 + src[k + 6] * w10 + src[k2 + 2] * w01 + src[k2 + 6] * w11;
      // grade: blacks stay black, the fur lifts and its colour deepens
      const lum = cr * 0.3 + cg * 0.59 + cb * 0.11, gain = GRADE[lum | 0];
      d[o] = (lum + (cr - lum) * 1.18) * gain; d[o + 1] = (lum + (cg - lum) * 1.18) * gain; d[o + 2] = (lum + (cb - lum) * 1.18) * gain;
      d[o + 3] = cov * 255;
    }
  }
  const cnv = L.makeCanvas(RW, RH);
  cnv.getContext('2d').putImageData(out, 0, 0);
  cnv._x = X0; cnv._y = Y0;
  return cnv;
}

/**
 * The soft reflection lying across the glaze (a long window light), concentric with the lip and rounded off at both ends.
 * Two passes: a wide soft band used with colour-dodge, so the fur blazes where the light crosses it (black = no change),
 * and a slimmer cool veil used with screen — the shine of the glassy black glaze itself.
 */
function buildSheen(env, geo) {
  const a = env.arc, { X0, Y0, RW, RH } = geo;
  const white = (al) => `rgba(255,255,255,${al})`;
  const band = (rIn, rOut, stops, extra) => region(X0, Y0, RW, RH, (g) => {
    g.fillStyle = L.radial(g, a.cx, a.cy, rIn, rOut, stops.map(([t, al]) => [t, white(al)]));
    g.fillRect(X0, Y0, RW, RH);
    if (extra) extra(g);
    // brightest left of centre, rounding off toward both ends
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = L.linear(g, 0, 0, W, 0, [[0, 'rgba(0,0,0,0.05)'], [0.1, 'rgba(0,0,0,0.12)'], [0.2, 'rgba(0,0,0,0.6)'], [0.3, 'rgba(0,0,0,1)'], [0.52, 'rgba(0,0,0,0.9)'], [0.66, 'rgba(0,0,0,0.5)'], [0.78, 'rgba(0,0,0,0.14)'], [1, 'rgba(0,0,0,0.05)']]);
    g.fillRect(X0, Y0, RW, RH);
  });
  const tint = (shape, bg, col) => region(X0, Y0, RW, RH, (g) => {
    g.fillStyle = col; g.fillRect(X0, Y0, RW, RH);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(shape, X0, Y0);
    if (bg) { g.globalCompositeOperation = 'destination-over'; g.fillStyle = bg; g.fillRect(X0, Y0, RW, RH); }
  });
  const wide = band(a.R - 288, a.R - 128, [[0, 0], [0.14, 0.06], [0.3, 0.3], [0.44, 0.74], [0.55, 1], [0.66, 0.74], [0.8, 0.3], [0.92, 0.06], [1, 0]], (g) => {
    // a hair-thin glint just under the lip where the wall turns
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 66, a.R - 46, [[0, white(0)], [0.5, white(0.3)], [1, white(0)]]);
    g.fillRect(X0, Y0, RW, RH);
  });
  const slim = band(a.R - 268, a.R - 148, [[0, 0], [0.2, 0.07], [0.36, 0.26], [0.46, 0.72], [0.53, 1], [0.6, 0.72], [0.7, 0.26], [0.86, 0.07], [1, 0]]);
  return { dodge: tint(wide, '#000', '#9c8f80'), veil: tint(slim, null, 'rgba(150,190,255,0.3)') };
}

/** the iridescent rim light: blue-violet over the crest, sliding to cyan toward both sides */
function buildIris(env) {
  const a = env.arc;
  const x0 = -PAD, y0 = Math.floor(a.crestY) - 60, w = W + PAD * 2, h = Math.ceil(a.yAt(-PAD)) + 60 - y0;
  const hue = (g, k, lift = 0) => L.linear(g, -PAD, 0, W + PAD, 0, [
    [0, L.rgba(L.shade('#58c8d8', lift), 0.5 * k)], [0.2, L.rgba(L.shade('#58c8d8', lift), 0.85 * k)], [0.36, L.rgba(L.shade('#5f96ee', lift), k)],
    [0.5, L.rgba(L.shade('#6a5cff', lift), k)], [0.64, L.rgba(L.shade('#5f96ee', lift), k)], [0.8, L.rgba(L.shade('#58c8d8', lift), 0.85 * k)], [1, L.rgba(L.shade('#58c8d8', lift), 0.5 * k)]]);
  const halo = region(x0, y0, w, h, (g) => { g.strokeStyle = hue(g, 1); g.lineWidth = 9; a.stroke(g, 4); });
  const soft = L.blurred(halo, 7);
  // the light spills a little way down onto the wall under the lip
  const spill = region(x0, y0, w, h, (g) => {
    g.fillStyle = hue(g, 1); a.pathBand(g, 1, -46); g.fill();
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 46, a.R + 1, [[0, 'rgba(0,0,0,0)'], [0.6, 'rgba(0,0,0,0.08)'], [1, 'rgba(0,0,0,0.26)']]);
    g.fillRect(x0, y0, w, h);
  });
  return region(x0, y0, w, h, (g) => {
    g.drawImage(soft, x0, y0);
    g.globalCompositeOperation = 'lighter';
    g.drawImage(spill, x0, y0);
    g.strokeStyle = hue(g, 1, 0.06); g.lineWidth = 3; a.stroke(g, 1.7);
    g.strokeStyle = hue(g, 0.55, 0.35); g.lineWidth = 1.2; a.stroke(g, 1.9);
  });
}

export default {
  name: '建盏兔毫',
  tone: 'light',
  init(env) {
    const geo = geometry(env);
    const wall = wrapOntoArc(env, buildFur(geo), geo);
    const sheen = buildSheen(env, geo);
    S = { geo, wall, dodge: sheen.dodge, veil: sheen.veil, iris: buildIris(env) };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    ctx.save();
    ctx.fillStyle = '#020101'; ctx.fillRect(0, 0, W, H);
    const rot = L.lerp(-0.013, 0.013, p), zoom = L.lerp(1.0, 1.012, p);
    L.cam(ctx, env, { zoom }, () => {
      // the glaze slides along the rim …
      L.cam(ctx, env, { rot }, () => put(ctx, S.wall));
      // … under light that stays where it is: the wall turns away from the key toward both ends of the rim
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = L.radial(ctx, a.cx - 130, a.crestY + 170, 240, 1320, [[0, '#ffffff'], [0.45, '#e2d2c2'], [0.75, '#a48e7c'], [1, '#6a584b']]);
      ctx.fillRect(-PAD, a.crestY - 10, W + PAD * 2, H - a.crestY + PAD);
      ctx.globalCompositeOperation = 'color-dodge'; put(ctx, S.dodge);
      ctx.globalCompositeOperation = 'screen'; put(ctx, S.veil);
      // the iridescent hairline creeps along the lip
      L.cam(ctx, env, { rot: L.lerp(-0.018, 0.022, p) }, () => put(ctx, S.iris));
      ctx.globalCompositeOperation = 'source-over';
    });
    ctx.restore();
    L.vignette(ctx, { strength: 0.3 });
  },
};
