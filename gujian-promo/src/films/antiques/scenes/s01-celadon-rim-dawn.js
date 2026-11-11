// s01 — 天青碗沿晨光. The opening "horizon" of 《中国古玩》: the lip of a sky-blue (天青) glazed bowl seen in extreme
// close-up against the light. The arc is the rim. Below it the bowl wall is in shadow — night blue, with only a breath of
// glaze glowing just under the lip and a few hairline crackles (开片) catching the light. Along the rim runs one thin
// moon-white line (the glaze is thinnest on the lip), and above it the light blooms tianqing → blue-green → night blue.
// Nothing else: the space above keeps darkening for well over a frame height, because the title card is simply the camera
// tilted up into that darkness (see lib/titlecard.js) before it comes back down onto this exact image and the film loops.
//
// Everything static is shaded per pixel in init() with a dithered float pipeline (8-bit gradients this dark would band):
//   base   — the "before dawn" state, tall enough for the tilt
//   bright — the "first light" state, same geometry
// Each frame is base + bright seen through a soft horizontal envelope that widens with k, so the light spreads outward
// along the rim from the crest; the moon-white rim line is stroked live on top with a narrower envelope.
import * as L from '../../../lib/core.js';

const { W, H } = L;

export const TITLE_TILT = 800;   // how far the title card tilts up (px)

const MX = 8;                    // spare pixels left / right / below (the camera only ever pushes in, never out)
const TOP = TITLE_TILT + 40;     // rows painted above the frame for the tilt
const CW = W + MX * 2;
const Q = 4, TMAX = 2800;        // colour LUTs: 0.25 px steps out to 2800 px from the rim
const UMAX = 1300;               // half-length of the 1-D tables that run along the rim (px of arc length)
const RL = 220;                  // the lip rolls away from the lens over this many px (foreshortens the crackle toward the rim)
let S = null;

// ── colour by distance from the rim (px). Task palette: 月白 #e6f3ef · 天青 #8fc9c4 · 青蓝 #3f7f9a · 夜蓝 #0d1b3a · #050a16 ──
const FAR = [[495, '#0d1b3a'], [650, '#0a152e'], [850, '#070f22'], [1150, '#050a16'], [2800, '#04080f']];
const SKY_BRIGHT = [[0, '#e6f3ef'], [1.5, '#cbeae4'], [5, '#b2ded8'], [13, '#a0d4cf'], [34, '#8fc9c4'], [62, '#78c2c3'], [98, '#60b0bc'], [136, '#4c9aae'],
  [178, '#3f7f9a'], [230, '#2c6690'], [290, '#1f4d7c'], [355, '#163866'], [422, '#11284e'], ...FAR];
const SKY_DIM = [[0, '#5a9cae'], [2.5, '#468aa0'], [9, '#3f7f9a'], [26, '#35708f'], [58, '#2a5d82'], [105, '#204b74'], [165, '#183b66'], [240, '#132e58'],
  [320, '#10254b'], [422, '#0e1f41'], ...FAR];
const DEEP = [[300, '#081327'], [430, '#060d1c'], [620, '#050a16'], [1400, '#04080f']];
const BODY_BRIGHT = [[0, '#e6f3ef'], [1.3, '#e2f1ed'], [2.6, '#a9d8d2'], [5, '#8fc9c4'], [9, '#70b2b7'], [15, '#5599a8'], [24, '#3f7f9a'], [38, '#2d6588'],
  [58, '#1f4c72'], [84, '#15375a'], [120, '#0e2644'], [170, '#0a1a33'], [240, '#081427'], ...DEEP];
const BODY_DIM = [[0, '#5a9cae'], [1.3, '#4f93a6'], [3, '#3a7893'], [7, '#2a5f80'], [14, '#1e496c'], [26, '#163859'], [46, '#102948'], [80, '#0c1e3a'],
  [120, '#0a1830'], [170, '#09152b'], [240, '#081326'], ...DEEP];

/** ramp → Float32 LUT; the kinks between stops are rounded off more and more with distance from the rim (the rim itself stays crisp) */
function buildLut(stops) {
  const f = L.makeRamp(stops);
  const n = TMAX * Q + 4, out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = i / Q, rad = Math.min(48, t * 0.17);
    let r = 0, g = 0, b = 0;
    for (let k = -4; k <= 4; k++) { const c = f(Math.max(0, t + (k / 4) * rad)); r += c[0]; g += c[1]; b += c[2]; }
    out[i * 3] = r / 9; out[i * 3 + 1] = g / 9; out[i * 3 + 2] = b / 9;
  }
  return out;
}

const sstep = (a, b, v) => { const t = v <= a ? 0 : v >= b ? 1 : (v - a) / (b - a); return t * t * (3 - 2 * t); };
const LIP = RL * Math.PI / 2;    // surface distance covered by the rolled part of the lip
/** depth below the rim on screen (px) → distance down the glaze surface, and back */
const surfV = (d) => (d < RL ? RL * Math.acos(1 - d / RL) : LIP + (d - RL));
const depthOf = (V) => (V <= 0 ? 0 : V < LIP ? RL * (1 - Math.cos(V / RL)) : RL + (V - LIP));

/**
 * 开片: crackle grows by subdivision — a new crack starts on an existing one, runs roughly square to it and stops at the
 * next crack it meets (T-junctions, never crossings). Built in glaze-surface coordinates (U along the rim, V down the wall)
 * and returned as polylines with a strength: the first, longest cracks are the boldest; patches craze finer.
 */
function crackle() {
  const r = L.rng('s01crackle'), nzp = L.makeNoise('s01craze'), segs = [];
  const split = (P, lvl) => {
    const n = P.length;
    let A = 0, cu = 0, cv = 0, li = 0, ll = 0;
    const len = [];
    for (let i = 0; i < n; i++) {
      const p = P[i], q = P[(i + 1) % n];
      A += p[0] * q[1] - q[0] * p[1]; cu += p[0]; cv += p[1];
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]); len.push(l); if (l > ll) { ll = l; li = i; }
    }
    A = Math.abs(A) / 2; cu /= n; cv /= n;
    const fine = nzp.fbm(cu / 520 + 4.4, cv / 520 - 9.1, 2) > 0.1;
    if (A < (fine ? r.range(2800, 8500) : r.range(15000, 52000)) || lvl > 13) return;
    // usually the new crack springs from the longest side of the cell, now and then from another long one
    if (r.chance(0.3)) { const cand = []; for (let i = 0; i < n; i++) if (len[i] > 0.6 * ll) cand.push(i); li = r.pick(cand); }
    const p = P[li], q = P[(li + 1) % n], t = r.range(0.24, 0.76);
    const ox = L.lerp(p[0], q[0], t), oy = L.lerp(p[1], q[1], t);
    const ang = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2 + L.clamp(r.gauss() * 0.42, -1, 1);
    let dx = Math.cos(ang), dy = Math.sin(ang);
    if (dx * (cu - ox) + dy * (cv - oy) < 0) { dx = -dx; dy = -dy; }
    let best = 1e9, hi = -1;
    for (let i = 0; i < n; i++) {
      if (i === li) continue;
      const c = P[i], e = P[(i + 1) % n], ex = e[0] - c[0], ey = e[1] - c[1], den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const tt = ((c[0] - ox) * ey - (c[1] - oy) * ex) / den, ss = ((c[0] - ox) * dy - (c[1] - oy) * dx) / den;
      if (tt > 1e-6 && ss >= 0 && ss <= 1 && tt < best) { best = tt; hi = i; }
    }
    if (hi < 0) return;
    const o = [ox, oy], h = [ox + dx * best, oy + dy * best];
    segs.push({ o, h, k: (lvl <= 2 ? 1 : Math.max(0.42, Math.pow(0.87, lvl - 2))) * r.range(0.62, 1) });
    const P1 = [o], P2 = [h];
    for (let i = (li + 1) % n; ; i = (i + 1) % n) { P1.push(P[i]); if (i === hi) break; }
    P1.push(h);
    for (let i = (hi + 1) % n; ; i = (i + 1) % n) { P2.push(P[i]); if (i === li) break; }
    P2.push(o);
    split(P1, lvl + 1); split(P2, lvl + 1);
  };
  split([[-UMAX, -70], [UMAX, -70], [UMAX, 700], [-UMAX, 700]], 0);
  return segs;
}

/** per-pixel fields of the bowl wall just under the rim: hairline crackle and a faint sheen */
function buildFields(a) {
  const R = a.R, cx = a.cx, cy = a.cy;
  const y0 = Math.floor(a.crestY) - 1, hgt = H + MX - y0;
  const crk = new Float32Array(CW * hgt), shn = new Float32Array(CW * hgt);
  const nz = L.makeNoise('s01glaze'), nw = L.makeNoise('s01warp');
  // glaze thickness along the rim: the glow sinks a little deeper here, a little shallower there
  const gmod = new Float32Array(UMAX * 2 + 2);
  for (let i = 0; i < gmod.length; i++) { const U = i - UMAX; gmod[i] = 1 + 0.2 * nz.fbm(U / 560 + 3.1, 0.7, 3) + 0.05 * nz.n2(U / 70, 9.4); }
  // draw the cracks as hairlines: surface → screen (the lip rolls away, so they crowd together and flatten toward the rim)
  const lines = L.makeCanvas(CW, hgt), lg = lines.getContext('2d', { willReadFrequently: true });
  lg.translate(MX, -y0); lg.lineCap = 'round'; lg.lineJoin = 'round';
  for (const sg of crackle()) {
    const len = Math.hypot(sg.h[0] - sg.o[0], sg.h[1] - sg.o[1]), n = Math.max(2, Math.ceil(len / 9));
    lg.beginPath();
    for (let i = 0; i <= n; i++) {
      const U0 = L.lerp(sg.o[0], sg.h[0], i / n), V0 = L.lerp(sg.o[1], sg.h[1], i / n);
      // one smooth warp for every crack: they bow a little, and still meet exactly
      const U = U0 + 24 * nw.n2(U0 / 300 + 5.2, V0 / 300) + 7 * nw.n2(U0 / 86 + 1.7, V0 / 86 + 3.3);
      const V = V0 + 24 * nw.n2(U0 / 300 - 17.3, V0 / 300 + 40.1) + 7 * nw.n2(U0 / 86 - 22.9, V0 / 86 + 61.4);
      const p = a.pt(U / R, -depthOf(V));
      if (i) lg.lineTo(p.x, p.y); else lg.moveTo(p.x, p.y);
    }
    lg.strokeStyle = `rgba(255,255,255,${sg.k.toFixed(3)})`; lg.lineWidth = 0.95 + 0.55 * sg.k; lg.stroke();
  }
  const ld = lg.getImageData(0, 0, CW, hgt).data;
  const DC = 470;
  for (let j = 0; j < hgt; j++) {
    const ddy = cy - (y0 + j + 0.5), ddy2 = ddy * ddy;
    for (let i = 0; i < CW; i++) {
      const ddx = i - MX + 0.5 - cx, rr = Math.sqrt(ddx * ddx + ddy2), d = R - rr;
      if (d < 1.5) continue;
      const k = j * CW + i, U = Math.atan2(ddx, ddy) * R;
      // sheen: the convex wall picks up a breath of the sky a hand's width below the lip
      if (d > 90 && d < 620) {
        const e = (d - 300) / 125, hx = (ddx + 170) / 760;
        shn[k] = Math.exp(-e * e) * (0.5 + 0.5 * Math.exp(-hx * hx)) * (1 + 0.3 * nz.n2(U / 380 + 11, d / 120));
      }
      const line = ld[k * 4 + 3];
      if (!line || d > DC) continue;
      // whole stretches of the network stay all but invisible; it fades out down the wall and on the thin-glazed lip itself
      const vis = sstep(-0.42, 0.34, nz.fbm(U / 430 + 71, surfV(d) / 430 - 8, 3));
      crk[k] = (line / 255) * (0.38 + 0.62 * vis) * sstep(1.5, 8, d) * (1 - sstep(DC - 160, DC, d));
    }
  }
  return { y0, hgt, crk, shn, gmod };
}

/** shade rows y0..y1 of the picture: sky above the rim, bowl wall below, dithered so the dark gradients never band */
function paint(a, y0, y1, sky, body, F, gain, seed) {
  const R = a.R, cx = a.cx, cy = a.cy;
  const hgt = y1 - y0, img = new ImageData(CW, hgt), o8 = img.data;
  let s = seed | 0 || 1, o = 0;
  for (let j = 0; j < hgt; j++) {
    const ddy = cy - (y0 + j + 0.5), ddy2 = ddy * ddy;
    const fj = y0 + j - F.y0;
    for (let i = 0; i < CW; i++, o += 4) {
      const ddx = i - MX + 0.5 - cx, rr = Math.sqrt(ddx * ddx + ddy2), dr = rr - R;
      let r, g, b;
      if (dr >= 0.5) {
        const t = dr * Q, i0 = t | 0, f = t - i0, q = i0 * 3;
        r = sky[q] + (sky[q + 3] - sky[q]) * f; g = sky[q + 1] + (sky[q + 4] - sky[q + 1]) * f; b = sky[q + 2] + (sky[q + 5] - sky[q + 2]) * f;
      } else {
        const d = dr > 0 ? 0 : -dr;
        const U = Math.atan2(ddx, ddy) * R;
        const gm = F.gmod[(U + UMAX) | 0];
        const de = d < 3 ? d : d - (d - 3) * (1 - 1 / gm) * Math.exp(-d / 90);   // only the glow near the lip breathes
        const t = de * Q, i0 = t | 0, f = t - i0, q = i0 * 3;
        r = body[q] + (body[q + 3] - body[q]) * f; g = body[q + 1] + (body[q + 4] - body[q + 1]) * f; b = body[q + 2] + (body[q + 5] - body[q + 2]) * f;
        if (fj >= 0 && fj < F.hgt) {
          const kI = F.crk[fj * CW + i], sh = F.shn[fj * CW + i];
          if (kI > 0.004) { const w = kI * gain * (0.5 * Math.exp(-d / 56) + 0.12 * Math.exp(-d / 185)); r += 143 * w; g += 201 * w; b += 196 * w; }
          if (sh > 0.004) { const w = sh * (0.55 + 0.45 * gain); r += 2 * w; g += 5 * w; b += 11 * w; }
        }
        if (dr > -0.5) { const al = dr + 0.5; r += (sky[0] - r) * al; g += (sky[1] - g) * al; b += (sky[2] - b) * al; }   // anti-aliased rim
      }
      // very fine grain (triangular noise), a little stronger in the light; doubles as dither
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5; const n1 = (s >>> 0) / 4294967296;
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5; const n2 = (s >>> 0) / 4294967296;
      const gn = (n1 + n2 - 1) * (1.15 + 0.02 * (0.3 * r + 0.6 * g + 0.1 * b));
      o8[o] = r + gn; o8[o + 1] = g + gn; o8[o + 2] = b + gn; o8[o + 3] = 255;
    }
  }
  const c = L.makeCanvas(CW, hgt);
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

/** the odd bubble suspended in the glaze, lit from behind: sparse pin-points, thinning out with depth */
function bubbles(a, canvas, yTop, gain) {
  const g = canvas.getContext('2d'), r = L.rng('s01bubbles'), span = a.span(MX + 30);
  g.save(); g.translate(MX, -yTop); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 64; i++) {
    const th = r.range(-span, span), d = 7 + 250 * Math.pow(r(), 1.7), rad = r.range(0.7, 1.9), k = r.range(0.35, 1);
    const p = a.pt(th, -d), al = gain * k * (0.5 * Math.exp(-d / 60) + 0.13 * Math.exp(-d / 210));
    g.fillStyle = L.radial(g, p.x, p.y, 0, rad * 2.2, [[0, `rgba(214,238,232,${al.toFixed(4)})`], [0.45, `rgba(143,201,196,${(al * 0.4).toFixed(4)})`], [1, 'rgba(143,201,196,0)']]);
    g.fillRect(p.x - rad * 2.4, p.y - rad * 2.4, rad * 4.8, rad * 4.8);
  }
  g.restore();
}

export function initOpening(env) {
  const a = env.arc, key = `${a.R}/${a.crestY}/${a.cx}`;
  if (S && S.key === key) return S;
  const F = buildFields(a);
  const yB0 = Math.floor(a.crestY) - 556;                       // above this row "bright" and "base" are identical
  const base = paint(a, -TOP, H + MX, buildLut(SKY_DIM), buildLut(BODY_DIM), F, 0.42, 90210);
  const bright = paint(a, yB0, H + MX, buildLut(SKY_BRIGHT), buildLut(BODY_BRIGHT), F, 1, 271828);
  bubbles(a, base, -TOP, 0.35);
  bubbles(a, bright, yB0, 1);
  const tmp = L.makeCanvas(bright.width, bright.height);
  // the lip is hand-finished: the bright line breathes a little along its length
  const nl = L.makeNoise('s01lip'), wob = [];
  for (let i = 0; i <= 48; i++) wob.push(1 + 0.16 * nl.n2(i * 0.31, 2.2) + 0.07 * nl.n2(i * 0.9, 7.7));
  S = { key, base, bright, yB0, tmp, tg: tmp.getContext('2d'), wob };
  return S;
}

/** horizontal envelope as gradient stops: `peak` within `w` px of the crest, easing down to `floor` over the next `fall` px */
function envelope(g, x0, x1, { w, fall, floor, peak }, rgb, wob = null) {
  const grad = g.createLinearGradient(x0, 0, x1, 0), N = 48;
  for (let i = 0; i <= N; i++) {
    const ax = Math.abs(L.lerp(-MX, W + MX, i / N) - W / 2);
    let e = floor + (peak - floor) * (1 - L.smooth((ax - w) / fall));
    if (wob) e = Math.min(1, e * wob[i]);
    grad.addColorStop(i / N, `rgba(${rgb},${e.toFixed(4)})`);
  }
  return grad;
}

/**
 * tilt: px the camera has tilted UP (the whole picture slides down by this much). 0 = the opening framing.
 * k:    0..1 progress of the light itself — it spreads outward along the rim and brightens a touch, then holds.
 */
export function drawOpening(ctx, env, { tilt = 0, k = 0 } = {}) {
  const a = env.arc, s = initOpening(env);
  const u = L.smooth(L.clamp(k) / 0.86);          // settles a few frames before the end so the loop joins cleanly
  const zoom = 1 + 0.014 * u;
  ctx.save();
  ctx.fillStyle = '#04080f'; ctx.fillRect(0, 0, W, H);
  ctx.translate(0, tilt);
  ctx.translate(a.cx, a.crestY); ctx.scale(zoom, zoom); ctx.translate(-a.cx, -a.crestY);
  // before dawn
  ctx.drawImage(s.base, -MX, -TOP);
  if (s.yB0 + tilt < H) {
    // first light, spreading from the crest toward both ends of the rim
    const tg = s.tg;
    tg.globalCompositeOperation = 'copy'; tg.drawImage(s.bright, 0, 0);
    tg.globalCompositeOperation = 'destination-in';
    tg.fillStyle = envelope(tg, 0, s.tmp.width, { w: L.lerp(120, 640, u), fall: L.lerp(960, 1100, u), floor: L.lerp(0.1, 0.36, u), peak: L.lerp(0.84, 1, u) }, '0,0,0');
    tg.fillRect(0, 0, s.tmp.width, s.tmp.height);
    ctx.drawImage(s.tmp, -MX, s.yB0);
    // the moon-white line on the lip: hottest at the crest, running out along the rim as the light grows
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'butt';
    ctx.strokeStyle = envelope(ctx, -MX, W + MX, { w: L.lerp(40, 520, u), fall: L.lerp(640, 860, u), floor: L.lerp(0, 0.04, u), peak: L.lerp(0.1, 0.15, u) }, '230,243,239');
    ctx.lineWidth = 6; a.stroke(ctx, 0.5);
    ctx.strokeStyle = envelope(ctx, -MX, W + MX, { w: L.lerp(30, 470, u), fall: L.lerp(600, 840, u), floor: L.lerp(0, 0.08, u), peak: L.lerp(0.66, 0.9, u) }, '242,251,248', s.wob);
    ctx.lineWidth = 1.8; a.stroke(ctx, -0.3);
  }
  ctx.restore();
}

export default {
  name: '天青碗沿晨光',
  tone: 'light',
  init(env) { initOpening(env); },
  draw(ctx, env, p) { drawOpening(ctx, env, { tilt: 0, k: p }); },
};
