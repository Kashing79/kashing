// s23 — 点云扫描. A 3-D laser-scan point cloud of a triple-eaved circular hall (三重檐圆攒尖), pseudo-coloured by
// elevation on black. The arc = the eave edge (檐口) of the lowest, widest roof, drawn by the densest, hottest points.
// Below it the cloud is laid out in concentric bands, inward = upward (a stylised, see-through read of the stacked roofs):
//   檐口 (rim + 勾头 rosettes alternating with 滴水) → 瓦垄 (radial rows: one bright 筒瓦 row, two dim 板瓦 rows)
//   → 围脊 → 额枋 → 斗拱 (a regular ring of stepped point clusters) → the next, smaller eave …
// Elevation colour cycles magenta → orange → yellow → green → cyan once per tier.
// Above the arc: sparse vertical scan profiles (columns of points), thinned and dimmed behind the tagline.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 240;
const BG = '#030406';
const TIERS = [244, 208];   // radial depth of the lower and middle roof tiers (px); the third, top roof runs on toward the finial
let S = null;

const RAMP = L.makeRamp([[0, '#ff2bd6'], [0.25, '#ff8a1f'], [0.5, '#ffe14a'], [0.75, '#3ddc84'], [1, '#2bd6ff']]);
const NC = 44, NA = 7, NW = 4;   // quantisation: colour steps, alpha steps, whiteness steps

/** Collects points into (colour, alpha, whiteness) bins so tens of thousands of dots paint in a few hundred fills. */
function dotBin() {
  const bins = new Map();
  let n = 0;
  const put = (x, y, r, u, al, w = 0) => {
    if (!(al > 0.03) || x < -PAD - 4 || x > W + PAD + 4 || y < -PAD - 4 || y > H + PAD + 4) return;
    const ci = Math.round(L.clamp(u) * (NC - 1)), ai = Math.max(1, Math.round(L.clamp(al) * NA)), wi = Math.round(L.clamp(w) * (NW - 1));
    const key = (ci * 16 + ai) * 8 + wi;
    let b = bins.get(key);
    if (!b) { b = { ci, ai, wi, d: [] }; bins.set(key, b); }
    b.d.push(x, y, r); n++;
  };
  const paint = (g) => {
    for (const b of bins.values()) {
      const c = RAMP(b.ci / (NC - 1)), w = (b.wi / (NW - 1)) * 0.85;
      g.fillStyle = `rgba(${Math.round(L.lerp(c[0], 255, w))},${Math.round(L.lerp(c[1], 255, w))},${Math.round(L.lerp(c[2], 255, w))},${(b.ai / NA).toFixed(3)})`;
      g.beginPath();
      const d = b.d;
      for (let i = 0; i < d.length; i += 3) {
        const r = d[i + 2];
        if (r < 1.15) g.rect(d[i] - r, d[i + 1] - r, r * 2, r * 2);      // the smallest returns are square splats
        else { g.moveTo(d[i] + r, d[i + 1]); g.arc(d[i], d[i + 1], r, 0, L.TAU); }
      }
      g.fill();
    }
  };
  return { put, paint, count: () => n };
}

/** downsample → blur → (caller upsamples): cheap wide glow */
function soft(src, scale, px) {
  const c = L.makeCanvas(Math.ceil(src.width * scale), Math.ceil(src.height * scale));
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.filter = `blur(${px * scale}px)`;
  g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

// ───────────────────────── the roof cloud ─────────────────────────
function buildRoofDots(env) {
  const a = env.arc, R = a.R;
  const bin = dotBin();
  const r = L.rng('s23roof');
  const nz = L.makeNoise('s23');
  const SPAN = a.span(PAD + 140);
  const DMAX = H + PAD - a.crestY + 24;

  // scan shadows: crisp radial strips where something stood between the scanner and the roof …
  const strips = [];
  const rs = L.rng('s23shadow');
  for (let s = -SPAN * R + 120; s < SPAN * R; s += rs.range(300, 620)) {
    const q = { s: s + rs.range(-60, 60), w: rs.range(10, 26), d0: rs.range(24, 330), len: rs.range(170, 420) };
    if (Math.abs(q.s) > 250) strips.push(q);            // the middle of the frame, where the eye rests, stays intact
  }
  const hole = (th, d) => {
    const s = th * R;
    let h = 0;
    for (const q of strips) {
      const e = d - q.d0;
      if (e < 0 || e > q.len) continue;
      const side = (q.w * (1 - 0.4 * (e / q.len)) - Math.abs(s - q.s)) / 2.5;
      if (side <= 0) continue;
      h = Math.max(h, L.clamp(side) * L.clamp(e / 3) * L.clamp((q.len - e) / 60));
    }
    // … and a few ragged blobs the scanner never saw at all
    const v2 = nz.fbm(s / 330 - 21.3, d / 240 + 8.9, 3);
    return 0.975 * Math.max(h, L.smooth((v2 - 0.56 - 0.25 * Math.exp(-(s * s) / 90000)) / 0.09));
  };
  // glossy glaze swallows returns: broad regions where the cloud merely thins out
  const thin = (th, d) => 0.5 * L.smooth((nz.fbm((th * R) / 250 + 3.1, d / 430 + 1.7, 3) - 0.3) / 0.3);
  // patches where two scan stations overlap: twice the point density
  const overlap = (th, d) => nz.fbm((th * R) / 380 + 71.5, d / 300 - 33.3, 2) > 0.16;
  // return intensity: slow mottling + falls off with incidence angle away from the scanner's side
  const lum = (th, d) => (0.86 + 0.14 * nz.fbm((th * R) / 520 + 11, d / 380 - 4, 2)) * (0.86 + 0.14 * Math.cos((th + 0.07) * 3.2));
  /** one point in polar coords: th along the arc, d = depth below the arc (px). keep ∈ [0,1] protects it from voids. */
  const P = (th, d, rad, u, al, w = 0, keep = 0) => {
    const h = Math.max(hole(th, d), thin(th, d)) * (1 - keep);
    if (h > 0.01 && r() < h) return;
    const rr = R - d;
    bin.put(a.cx + rr * Math.sin(th), a.cy - rr * Math.cos(th), rad, u + r.range(-0.025, 0.025), al * lum(th, d), w);
  };

  // three stacked eaves (三重檐圆攒尖): the lower and middle roofs each end at a 围脊 under the next eave's
  // bracket band; the top roof simply keeps converging toward the finial, far below the frame
  const tiers = [];
  let dAcc = 0;
  TIERS.forEach((Tk, k) => { tiers.push({ k, d0: dAcc, Tk, top: false }); dAcc += Tk; });
  tiers.push({ k: TIERS.length, d0: dAcc, Tk: 250, top: true });
  const tierAt = (d) => { for (let i = tiers.length - 1; i >= 0; i--) if (d >= tiers[i].d0) return tiers[i]; return tiers[0]; };

  for (const { k, d0, Tk, top } of tiers) {
    const Rk = R - d0;
    const uOf = (f) => Math.pow(L.clamp(f / Tk), 1.35);   // elevation colour: one full cycle per tier
    const tg = [1, 0.92, 0.85, 0.78][k] || 0.72;          // deeper tiers return a little weaker
    const hot = k === 0 ? 1 : 0.5, kr = k === 0 ? 1 : 0.45;
    const row = (f, sp, rad, al, w = 0, keep = 0) => {
      const n = Math.ceil((2 * SPAN * Rk) / sp);
      for (let i = 0; i <= n; i++) P(-SPAN + (2 * SPAN * i) / n + r.range(-0.6, 0.6) / Rk, d0 + f + r.range(-0.45, 0.45), rad * r.range(0.85, 1.15), uOf(f), tg * al * r.range(0.7, 1), w, keep);
    };

    // (1) 檐口 — the rim row whose outer edge IS the arc, plus a staggered second row
    const nRim = Math.ceil((2 * SPAN * Rk) / 4.3);
    for (let i = 0; i <= nRim; i++) {
      const th = -SPAN + (2 * SPAN * i) / nRim;
      const rad = k === 0 ? r.range(1.95, 2.35) : r.range(1.5, 2.0);
      P(th + r.range(-0.3, 0.3) / Rk, d0 + rad + r.range(0, 0.25), rad, 0, tg * r.range(0.82, 1), 0.62 * hot, kr);
      P(th + 2.15 / Rk, d0 + 6.4 + r.range(-0.5, 0.5), r.range(1.1, 1.6), 0.02, tg * r.range(0.45, 0.85), 0.3 * hot, kr * 0.9);
    }

    // (2) 瓦垄 — every ridge: a 勾头 rosette at the eave, then a bright 筒瓦 row flanked by two dim 板瓦 rows
    const pitch = 24, dth = pitch / Rk, nR = Math.ceil(SPAN / dth);
    const fEnd = top ? DMAX - d0 : Tk - 78;
    for (let i = -nR; i <= nR; i++) {
      const th = i * dth;
      P(th, d0 + 14.2, 2.6, 0, tg, 0.55 * hot, kr);
      for (let j = 0; j < 6; j++) {
        const an = j * (L.TAU / 6) + 0.52;
        P(th + (6.1 * Math.cos(an)) / Rk, d0 + 14.2 + 6.1 * Math.sin(an), 1.4, 0.03, tg * 0.9, 0.3 * hot, kr);
      }
      // 滴水: three points in a V between two ridges
      const tm = th + dth / 2;
      P(tm, d0 + 17.4, 1.55, 0.05, tg * 0.85, 0.2 * hot, kr * 0.8);
      P(tm - 3.4 / Rk, d0 + 12.2, 1.25, 0.04, tg * 0.75, 0.15 * hot, kr * 0.8);
      P(tm + 3.4 / Rk, d0 + 12.2, 1.25, 0.04, tg * 0.75, 0.15 * hot, kr * 0.8);
      const STEP = 6;
      let q = 0;
      for (let f = 26; f < fEnd; f += STEP, q++) {
        const lap = q % 5 === 4;                        // tile laps line up into concentric courses
        const spark = r.chance(0.02);                   // the odd saturated return
        const dbl = overlap(th, d0 + f);
        P(th + r.range(-0.5, 0.5) / Rk, d0 + f + r.range(-0.6, 0.6), r.range(1.8, 2.4) + (lap ? 0.3 : 0) + (spark ? 0.8 : 0), uOf(f), tg * r.range(0.78, 1), spark ? 0.8 : lap ? 0.3 : 0.06);
        if (dbl) P(th + r.range(2.2, 3.6) / Rk, d0 + f + 3 + r.range(-0.8, 0.8), r.range(1.3, 1.9), uOf(f) - 0.03, tg * r.range(0.6, 0.95), 0.12);
        for (const s of [-1, 1]) {
          P(th + (s * dth) / 3 + r.range(-0.7, 0.7) / Rk, d0 + f + STEP / 2 + r.range(-0.7, 0.7), r.range(1.2, 1.7), uOf(f) + 0.035, tg * r.range(0.45, 0.75) * (lap ? 1.3 : 1));
          if (dbl && r.chance(0.6)) P(th + (s * dth) / 3 + r.range(-3, 3) / Rk, d0 + f + r.range(-1, 1), r.range(1.0, 1.4), uOf(f) + 0.02, tg * r.range(0.35, 0.6));
        }
      }
    }

    if (top) continue;
    // (3) 围脊 — where this roof meets the drum of the hall
    row(Tk - 74.5, 4.7, 1.95, 0.95, 0.2);
    row(Tk - 68.4, 4.7, 1.6, 0.8, 0.05);
    // (4) 额枋 — two thinner courses
    row(Tk - 56.5, 6.2, 1.45, 0.65);
    row(Tk - 50.2, 6.2, 1.45, 0.7);
    // (5) 斗拱 — a regular lattice of stepped clusters, each widening toward the eave it carries
    const bp = 42, bth = bp / Rk, nB = Math.ceil(SPAN / bth);
    const steps = [[Tk - 41, 2], [Tk - 34.6, 4], [Tk - 28.2, 6], [Tk - 21.8, 6]];
    for (let i = -nB; i <= nB; i++) {
      const th = (i + 0.5) * bth;
      steps.forEach(([f, n], qi) => {
        for (let j = 0; j < n; j++) {
          const off = (j - (n - 1) / 2) * 5.6;
          P(th + off / Rk, d0 + f + r.range(-0.4, 0.4), r.range(1.55, 2.05), uOf(f) + 0.05, tg * r.range(0.72, 1), qi === 0 ? 0.25 : 0.03);
        }
      });
    }
    row(Tk - 13.5, 5.6, 1.25, 0.5);                     // 挑檐枋, half lost in the shadow under the next eave
  }

  // loose returns everywhere on the roof (dust, mis-registration between scan stations)
  for (let i = 0; i < 6200; i++) {
    const th = r.range(-SPAN, SPAN), d = r.range(9, DMAX);
    const t = tierAt(d);
    P(th, d, r.range(0.7, 1.3), Math.pow(L.clamp((d - t.d0) / t.Tk), 1.35) + r.gauss() * 0.07, r.range(0.15, 0.45));
  }
  // mixed-pixel fliers hovering just outside the eave (kept rare over the crest, where the tagline sits)
  for (let i = 0; i < 520; i++) {
    const th = r.range(-SPAN, SPAN);
    const quiet = Math.abs(th) < 0.16 ? 0.25 : 1;
    const up = 3 + 46 * Math.pow(r(), 2.4);
    if (r() > quiet) continue;
    P(th, -up, r.range(0.7, 1.3), r.range(0, 0.14), r.range(0.14, 0.5) * (1 - up / 70), 0, 1);
  }
  return bin;
}

function buildRoof(env) {
  const a = env.arc;
  const bin = buildRoofDots(env);
  const dots = L.makeLayer(PAD, (g) => { g.globalCompositeOperation = 'lighter'; bin.paint(g); });
  const bloom = L.blurred(dots, 4.5);
  const bloom2 = soft(dots, 0.5, 13);
  const haze = soft(dots, 0.25, 34);
  const FW = W + PAD * 2, FH = H + PAD * 2;
  // the finished cloud: opaque black body under the arc + coloured haze + points + bloom
  const cloud = L.makeLayer(PAD, (g) => {
    a.fillBelow(g, BG, 0);
    g.save(); a.clipBelow(g, 0);
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.95;
    g.drawImage(haze, -PAD, -PAD, FW, FH);
    g.globalAlpha = 0.5; g.drawImage(bloom2, -PAD, -PAD, FW, FH);
    g.restore();
    g.save(); g.globalCompositeOperation = 'lighter';
    g.drawImage(dots, -PAD, -PAD);
    g.globalAlpha = 0.9; g.drawImage(bloom, -PAD, -PAD);
    g.restore();
    // a breath of magenta light spilling just outside the eave
    g.save(); g.globalCompositeOperation = 'lighter';
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 2, a.R + 22, [[0, 'rgba(255,70,214,0.2)'], [0.4, 'rgba(255,70,214,0.07)'], [1, 'rgba(255,70,214,0)']]);
    a.pathBand(g, 22, -2); g.fill();
    g.restore();
    // the cloud thins into darkness toward the middle of the roof
    g.save(); a.clipBelow(g, 0);
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 820, a.R - 260, [[0, L.rgba(BG, 0.72)], [1, L.rgba(BG, 0)]]);
    g.fillRect(-PAD, -PAD, FW, FH);
    g.restore();
  });
  // the "freshly scanned" overlay used behind the sweeping scan line: the same points, added on top of themselves
  const hot = L.makeLayer(PAD, (g) => {
    g.globalCompositeOperation = 'lighter';
    g.drawImage(dots, -PAD, -PAD);
    g.globalAlpha = 0.9; g.drawImage(bloom, -PAD, -PAD);
    g.globalAlpha = 0.6; g.drawImage(bloom2, -PAD, -PAD, FW, FH);
    // push it toward white-hot
    g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 1;
    g.fillStyle = 'rgba(255,246,236,0.5)'; g.fillRect(-PAD, -PAD, FW, FH);
  });
  return { cloud, hot, n: bin.count() };
}

// ───────────────────────── vertical scan profiles above the arc ─────────────────────────
function buildBack(env) {
  const a = env.arc;
  const bin = dotBin();
  const r = L.rng('s23cols');
  const nz = L.makeNoise('s23cols');
  // 1 inside the tagline corridor, 0 outside
  const corridor = (x) => L.smooth((500 - Math.abs(x - W / 2)) / 130);
  let x = -PAD - 12, si = 0;
  while (x < W + PAD + 12) {
    const n = r.pick([1, 1, 2, 2, 3, 3, 4, 5, 6, 8, 10]);          // a stripe = a bundle of neighbouring profiles
    const cs = r.range(5.5, 8.5);
    const hue = r.pick([0.72, 0.78, 0.86, 0.94, 1.0, 1.0, 0.6, 0.5, 0.28, 0.2, 0.04, 0.0]);
    const gainS = r.range(0.55, 1);
    const sp = r.range(5, 10.5);
    for (let c = 0; c < n; c++) {
      const cx = x + c * cs;
      const cz = corridor(cx);
      if (cz > 0.4 && r.chance(0.5 * cz)) continue;             // thinner behind the text
      const yArc = a.yAt(cx, 0);
      const rad0 = r.range(1.25, 2.0), ph = r() * sp, drift = r.range(-0.012, 0.012);
      for (let y = -PAD - 4 + ph; y < yArc + 16; y += sp) {
        const seg = nz.fbm(si * 3.7 + c * 0.11, y / 300 + si * 0.9, 2);          // long on / off runs along a profile
        let al = gainS * L.smooth((seg + 0.3) / 0.35);
        al *= L.lerp(1, hue > 0.3 && hue < 0.68 ? 0.08 : 0.13, cz) * (0.5 + 0.5 * r());
        al *= L.lerp(0.5, 1, L.smooth((yArc - y) / 110));       // let the eave stay the brightest thing around
        const u = hue + 0.09 * nz.n2(si * 1.3, y / 340) + r.range(-0.02, 0.02);
        bin.put(cx + (y - 400) * drift + r.range(-0.45, 0.45), y, rad0 * r.range(0.8, 1.2), u, al * 0.95, r.chance(0.02) ? 0.6 : 0);
      }
    }
    x += (n - 1) * cs + r.range(16, 66);
    si++;
  }
  // stray returns in the air
  for (let i = 0; i < 900; i++) {
    const px = r.range(-PAD, W + PAD), py = r.range(-PAD, 780);
    bin.put(px, py, r.range(0.7, 1.2), r(), r.range(0.1, 0.4) * L.lerp(1, 0.25, corridor(px)));
  }
  const dots = L.makeLayer(PAD, (g) => { g.globalCompositeOperation = 'lighter'; bin.paint(g); });
  const bloom = L.blurred(dots, 4);
  const wide = soft(dots, 0.25, 22);
  const FW = W + PAD * 2, FH = H + PAD * 2;
  // faint "intensity curtain" behind the profiles: vertical streaks, almost black
  const curtain = L.noiseTex(FW, FH, { seed: 's23curtain', scale: 60, sx: 0.5, sy: 40, octaves: 3, contrast: 1.7, res: 0.25,
    ramp: [[0, 'rgba(10,40,48,0)'], [0.46, 'rgba(10,40,48,0)'], [0.78, 'rgba(22,84,90,0.34)'], [1, 'rgba(84,44,110,0.42)']] });
  return L.makeLayer(PAD, (g) => {
    g.drawImage(curtain, -PAD, -PAD);
    // keep the corridor behind the tagline calm
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = L.linear(g, W / 2 - 640, 0, W / 2 + 640, 0, [[0, 'rgba(0,0,0,0)'], [0.25, 'rgba(0,0,0,0.9)'], [0.75, 'rgba(0,0,0,0.9)'], [1, 'rgba(0,0,0,0)']]);
    g.fillRect(W / 2 - 640, -PAD, 1280, FH);
    g.globalCompositeOperation = 'lighter';
    g.drawImage(dots, -PAD, -PAD);
    g.globalAlpha = 0.85; g.drawImage(bloom, -PAD, -PAD);
    g.globalAlpha = 0.5; g.drawImage(wide, -PAD, -PAD, FW, FH);
  });
}

// ───────────────────────── HUD (screen space, no text, no numbers) ─────────────────────────
function buildHud() {
  const c = L.makeCanvas(W, H); const g = c.getContext('2d');
  const col = 'rgba(196,255,238,0.62)';
  const seg = (x0, y0, x1, y1) => { g.moveTo(x0, y0); g.lineTo(x1, y1); };
  const pass = (style, lw) => {
    g.strokeStyle = style; g.lineWidth = lw; g.lineCap = 'butt';
    g.beginPath();
    // registration crosses in the four corners
    for (const [x, y] of [[72, 64], [W - 72, 64], [72, H - 64], [W - 72, H - 64]]) { seg(x - 13, y, x - 3, y); seg(x + 3, y, x + 13, y); seg(x, y - 13, x, y - 3); seg(x, y + 3, x, y + 13); }
    // a short scale bar, top-left
    seg(112, 64, 112 + 26 * 12, 64);
    for (let i = 0; i <= 26; i++) { const x = 112 + i * 12; seg(x, 64, x, 64 + (i % 5 === 0 ? 11 : 5)); }
    // a short vertical scale, right edge
    seg(W - 72, 104, W - 72, 104 + 20 * 12);
    for (let i = 0; i <= 20; i++) { const y = 104 + i * 12; seg(W - 72, y, W - 72 - (i % 5 === 0 ? 11 : 5), y); }
    g.stroke();
  };
  pass('rgba(0,0,0,0.55)', 4);
  pass(col, 1.5);
  return c;
}

export default {
  name: '点云扫描',
  tone: 'light',
  init(env) {
    const roof = buildRoof(env);
    S = { cloud: roof.cloud, hot: roof.hot, back: buildBack(env), hud: buildHud(), tmp: L.makeCanvas(W, H) };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    const rot = L.lerp(-0.008, 0.008, p), zoom = L.lerp(1.0, 1.035, p);
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    // far scan profiles drift less than the roof → a hint of depth
    L.blit(ctx, env, S.back, { rot: rot * 0.35, zoom: 1 + (zoom - 1) * 0.4 });
    L.blit(ctx, env, S.cloud, { rot, zoom });

    // the scan line sweeps along the eave; points just behind it are still glowing
    const ths = L.lerp(-0.2, 0.12, p);
    const tg = S.tmp.getContext('2d');
    tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'source-over'; tg.globalAlpha = 1;
    tg.clearRect(0, 0, W, H);
    a.at(tg, ths, 0, () => {
      tg.fillStyle = L.linear(tg, -480, 0, 3, 0, [[0, 'rgba(0,0,0,0)'], [0.35, 'rgba(0,0,0,0.1)'], [0.7, 'rgba(0,0,0,0.4)'], [0.92, 'rgba(0,0,0,0.85)'], [1, 'rgba(0,0,0,1)']]);
      tg.fillRect(-480, -70, 483, 1100);
    });
    L.blit(tg, env, S.hot, { rot, zoom, blend: 'source-in' });
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(S.tmp, 0, 0);
    a.at(ctx, ths, 0, () => {
      ctx.fillStyle = L.linear(ctx, 0, -8, 0, 760, [[0, 'rgba(255,255,255,0)'], [0.02, 'rgba(255,240,252,0.95)'], [0.5, 'rgba(190,255,240,0.6)'], [1, 'rgba(120,240,255,0.25)']]);
      ctx.fillRect(-1, -8, 2.2, 768);
      ctx.fillStyle = L.linear(ctx, -9, 0, 6, 0, [[0, 'rgba(255,200,240,0)'], [0.6, 'rgba(255,200,240,0.2)'], [1, 'rgba(255,200,240,0)']]);
      ctx.fillRect(-9, 0, 15, 760);
    });
    ctx.restore();
    const hit = a.pt(ths, -3);
    L.glow(ctx, hit.x, hit.y + 2, 38, '#ffd4f4', 0.75);
    // target reticle riding the scan line where it meets the eave
    ctx.save();
    ctx.translate(hit.x, hit.y); ctx.rotate(ths);
    ctx.strokeStyle = 'rgba(220,255,244,0.85)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, L.TAU);
    for (let i = 0; i < 4; i++) { const an = i * Math.PI / 2; ctx.moveTo(Math.cos(an) * 15, Math.sin(an) * 15); ctx.lineTo(Math.cos(an) * 22, Math.sin(an) * 22); }
    ctx.stroke();
    ctx.restore();

    ctx.drawImage(S.hud, 0, 0);
    L.vignette(ctx, { strength: 0.3, inner: 0.5, outer: 1.08 });
  },
};
