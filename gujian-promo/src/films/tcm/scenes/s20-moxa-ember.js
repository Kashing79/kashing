// s20 — 艾灸火头. Extreme macro of the smouldering tip of a moxa stick (艾条), everything in soft focus.
// The arc is the upper silhouette of the glowing dome: a hazy terminator, hottest orange right on the line,
// sinking fast into dark red and then into charred moxa floss (艾绒) whose fibres run vertically. Between the
// fibres sit grains of fire (vertically stretched bokeh), and thin flakes of grey-white ash lie on the surface.
// Above the arc: nothing but the warm glow the ember throws, and one faint blue-grey thread of smoke far out on each side.
//
// The ember is shaded per pixel at half resolution in init() (the shot is soft-focus anyway); the fire grains are
// small additive sprites that flicker deterministically from the frame number.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 100;
let S = null;

const sstep = (a, b, v) => { const t = L.clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// palette (task sheet): 炽橙 #ff7a1a · 琥珀橙 #d9661f · 火头暗红 #7a1410 · 炭褐 #2a0c08 · 艾灰 #cfc4b4
const RF = 6500;   // fibres fan out very slightly from a point far below the frame → reads as "vertical", but on a dome

/** the glow above the arc: orange-red hugging the ember, easing up into amber */
function buildBack(env) {
  const a = env.arc;
  return L.makeLayer(PAD, (g) => {
    const full = () => g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    const r0 = a.R - 60, r1 = a.R + 980, at = (dr) => (dr + 60) / (r1 - r0);
    g.fillStyle = L.radial(g, a.cx, a.cy, r0, r1, [
      [0, '#e2401a'], [at(0), '#e64619'], [at(50), '#e44d1a'], [at(130), '#e0571c'], [at(250), '#dc601e'],
      [at(400), '#d9661f'], [at(700), '#d6631e'], [at(980), '#c95a1b']]);
    full();
    // the light is strongest over the middle of the dome and falls away to the sides
    g.fillStyle = L.radial(g, a.cx, a.crestY - 40, 300, 1350, [[0, 'rgba(120,22,10,0)'], [0.55, 'rgba(120,22,10,0.07)'], [1, 'rgba(92,14,8,0.24)']]);
    full();
    // slow, shapeless breathing of the haze (kept very low so the caption zone stays even)
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.3;
    g.drawImage(L.noiseLayer(PAD, { seed: 's20haze', scale: 620, sx: 1.6, octaves: 3, res: 0.12, contrast: 1.3 }), -PAD, -PAD);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  });
}

/** one thread of smoke: a folded, drifting sheet drawn as many hair-thin strands that bunch up where the sheet turns */
function buildSmoke(env, side) {
  const a = env.arc;
  const x0 = side < 0 ? 372 : 1556;
  const bx = x0 - 330, by = -PAD - 40, bw = 660, bh = a.yAt(x0) + 60 - by;
  const c = L.makeCanvas(bw, bh), g = c.getContext('2d');
  g.translate(-bx, -by);
  const nz = L.makeNoise('s20smoke' + side), r = L.rng('s20smoke' + side);
  const yb = a.yAt(x0) + 34, rise = yb - by + 30;
  const NS = 52, NT = 96, ph = r.range(0, 6.28);
  g.lineCap = 'round';
  for (let s = 0; s < NS; s++) {
    const sv = s / (NS - 1), wgt = r.range(0.5, 1), lw = r.range(0.9, 2.2);
    let px = 0, py = 0;
    for (let t = 0; t <= NT; t++) {
      const tv = t / NT;
      const axis = x0 + side * 46 * tv + 58 * Math.sin(tv * 3.4 + ph) * Math.pow(tv, 0.8) + 30 * nz.n2(tv * 1.7, 4.2) * tv;
      const wid = 4 + 118 * Math.pow(tv, 1.25);
      const fold = 0.72 * Math.sin(L.TAU * (0.5 * sv + 0.75 * tv + 0.4 * nz.n2(tv * 1.5, 7.7))) + 0.5 * nz.n2(sv * 1.4 + 3, tv * 2.3);
      const x = axis + wid * fold, y = yb - rise * tv;
      if (t > 0) {
        const al = sstep(0, 0.07, tv) * (1 - sstep(0.42, 0.98, tv)) * wgt;
        if (al > 0.004) {
          const wm = 1 - sstep(0.04, 0.26, tv);
          g.strokeStyle = `rgba(${Math.round(152 + 98 * wm)},${Math.round(180 - 16 * wm)},${Math.round(200 - 84 * wm)},${(0.18 * al).toFixed(3)})`; g.lineWidth = lw * (1 + 1.6 * tv);
          g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke();
        }
      }
      px = x; py = y;
    }
  }
  const out = L.makeCanvas(bw, bh), og = out.getContext('2d');
  og.filter = 'blur(12px)'; og.drawImage(c, 0, 0);
  og.filter = 'blur(4px)'; og.globalAlpha = 0.6; og.drawImage(c, 0, 0);
  og.filter = 'none';
  return { c: out, x: bx, y: by };
}

/** the ember itself: everything below the arc */
function buildEmber(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const RES = 0.5;
  const X0 = -PAD, Y0 = Math.floor(a.crestY) - 160;
  const FW = W + PAD * 2, FH = H + PAD - Y0;
  const cw = Math.ceil(FW * RES), ch = Math.ceil(FH * RES);
  const nA = L.makeNoise('s20a'), nB = L.makeNoise('s20b'), nC = L.makeNoise('s20c');
  const fcy = a.crestY + RF;
  const img = new ImageData(cw, ch), o = img.data;
  const hotMap = new Float32Array(cw * ch);
  // emission ramp: nothing → dull red → orange-red → 炽橙 → a touch hotter at the very core
  const emF = L.makeRamp([[0, [0, 0, 0]], [0.2, [92, 12, 8]], [0.45, [214, 52, 18]], [0.72, [255, 122, 26]], [1, [255, 194, 108]]]);
  const EM = new Float32Array(257 * 3);
  for (let i = 0; i <= 256; i++) { const c = emF(i / 256); EM[i * 3] = c[0]; EM[i * 3 + 1] = c[1]; EM[i * 3 + 2] = c[2]; }

  for (let j = 0; j < ch; j++) {
    const y = Y0 + (j + 0.5) / RES, ddy = cy - y, fv = y - a.crestY;
    for (let i = 0; i < cw; i++) {
      const x = X0 + (i + 0.5) / RES, ddx = x - cx;
      const rr = Math.sqrt(ddx * ddx + ddy * ddy), d = R - rr;      // d = depth below the arc
      if (d < -9) continue;
      const k = j * cw + i, dd = d < 0 ? 0 : d;
      const U = Math.atan2(ddx, ddy) * R;
      let fu = Math.atan2(ddx, fcy - y) * RF;
      fu += 20 * nA.n2(fu / 560, fv / 340) + 6 * nA.n2(fu / 150 + 9, fv / 190);    // fibres wander a little
      // ── charred floss: bundles, single fibres, fuzz (all soft: this is out-of-focus macro) ──
      const bundle = nA.fbm(fu / 74, fv / 820, 3);
      const fine = nB.ridged(fu / 18, fv / 430, 2);
      const micro = nB.n2(fu / 8 + 31, fv / 170);
      const h = L.clamp(0.5 * fine + 0.32 * (bundle * 0.5 + 0.5) + 0.18 * (micro * 0.5 + 0.5));
      const gap = 1 - sstep(0.3, 0.5, h);                           // the slots between fibres: the fire shows through them
      // ── where it is still burning: patchy, and more of it toward the top ──
      const heat = nC.fbm(U / 320, d / 240, 3) * 0.5 + 0.5;
      const topB = Math.exp(-dd / 420);
      const hotv = sstep(0.5, 0.84, heat * 0.85 + topB * 0.42);
      // ── grains of fire: the slots broken up lengthwise, plus two sizes of vertically stretched cells lit one by one ──
      const seg = sstep(0.05, 0.42, nA.n2(fu / 16 + 50, fv / 74 - 20));
      const c1 = nC.cell(fu / 15 + 3, fv / 54 + 9), c2 = nB.cell(fu / 31 - 7, fv / 118 + 2);
      const p1 = 0.012 + 0.3 * hotv, p2 = 0.01 + 0.22 * hotv;
      const k1 = 0.5 + 0.5 * ((c1.id * 37.7) % 1), k2 = 0.55 + 0.45 * ((c2.id * 53.3) % 1);
      const g1 = (1 - sstep(0.1, 0.4, c1.d)) * sstep(0, 0.06, p1 - c1.id) * k1;
      const g2 = (1 - sstep(0.06, 0.42, c2.d)) * sstep(0, 0.06, p2 - c2.id) * k2;
      // ── ash: a thin pale frosting that clings to the fibres, in tufts that run along them ──
      const fil = nB.ridged(fu / 9 + 77, fv / 300, 2);              // single ash-coated filaments
      const ashN = nC.fbm(fu / 260 + 11, fv / 560 - 5, 3) * 0.5 + 0.5 + 0.28 * (fine - 0.5) + 0.22 * (fil - 0.5) + 0.08 * bundle;
      const ash = sstep(0.6, 0.71, ashN) * sstep(80, 210, d);
      let e = Math.max(g1, g2, gap * seg * (0.2 + 0.8 * hotv) * 0.6) * sstep(16, 64, d) * (0.3 + 0.7 * Math.exp(-dd / 560));
      e *= 1 - 0.8 * ash;

      // char, warmed by the fire around it
      const hc = h * Math.sqrt(h);
      let r = 22 + 62 * hc, g = 6 + 11 * hc, b = 4 + 8 * hc;
      const amb = (0.2 + 0.8 * h) * (0.32 * topB + 0.32 * hotv);
      r += 112 * amb; g += 12 * amb; b += 9 * amb;
      let m = Math.exp(-dd / 200) * 0.45 * (0.6 + 0.4 * h);
      r += (122 - r) * m; g += (20 - g) * m; b += (16 - b) * m;
      if (ash > 0.01) {
        const la = Math.min(1.06, 0.66 + 0.4 * topB + 0.14 * hotv) * (0.58 + 0.42 * L.clamp(0.2 + 0.5 * fine + 0.6 * fil));
        m = ash * 0.9;
        r += (216 * la - r) * m; g += (198 * la * (1 - 0.06 * hotv) - g) * m; b += (176 * la * (1 - 0.16 * hotv) - b) * m;
      }
      // the fire seen through the gaps
      const ei = Math.min(256, (e * 256) | 0) * 3;
      r += EM[ei]; g += EM[ei + 1]; b += EM[ei + 2];
      // the terminator: crimson → 炽橙 right on the line
      m = Math.exp(-dd / 44) * 0.9 * (0.62 + 0.38 * h);
      r += (204 - r) * m; g += (34 - g) * m; b += (22 - b) * m;
      m = Math.exp(-dd / 3.5) * 0.8;
      r += (255 - r) * m; g += (132 - g) * m; b += (34 - b) * m;
      // the dome turns away toward the lens and toward the sides
      const sh = L.lerp(1, 0.46, sstep(240, 880, d)) * (1 - 0.2 * sstep(650, 1250, Math.abs(ddx)));
      const q = k * 4;
      o[q] = r * sh; o[q + 1] = g * sh; o[q + 2] = b * sh; o[q + 3] = 255 * sstep(-6, 6, d);
      hotMap[k] = (0.25 + 0.75 * hotv) * (1 - 0.85 * ash) * (0.4 + 0.6 * gap) * sstep(20, 50, d);
    }
  }
  const small = L.makeCanvas(cw, ch);
  small.getContext('2d').putImageData(img, 0, 0);
  const c = L.makeCanvas(FW, FH), g = c.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.filter = 'blur(2.2px)';                             // the whole shot is soft-focus
  g.drawImage(small, 0, 0, FW, FH);
  g.filter = 'none';
  // shallow depth of field: the crown of the dome (bottom of frame) bulges toward the lens and melts
  const near = L.blurred(c, 11), ng = near.getContext('2d');
  ng.globalCompositeOperation = 'destination-in';
  ng.fillStyle = L.radial(ng, cx - X0, cy - Y0, R - 620, R - 280, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
  ng.fillRect(0, 0, FW, FH);
  g.drawImage(near, 0, 0);
  // bloom source: only the hot parts, quarter size, blurred wide
  const bw = Math.ceil(FW / 4), bh = Math.ceil(FH / 4);
  const bloom = L.makeCanvas(bw, bh), bg = bloom.getContext('2d');
  bg.filter = 'brightness(0.7) contrast(3) saturate(1.2) blur(5px)';
  bg.drawImage(c, 0, 0, bw, bh);
  bg.filter = 'none';

  // ── grains of fire: placed where the baked surface is actually glowing ──
  const rp = L.rng('s20pts'), pts = [];
  const span = a.span(PAD - 10);
  let guard = 0;
  while (pts.length < 90 && guard++ < 20000) {
    const th = rp.range(-span, span), d = 40 + 640 * Math.pow(rp(), 1.6);
    const p = a.pt(th, -d);
    const i = Math.floor((p.x - X0) * RES), j = Math.floor((p.y - Y0) * RES);
    if (i < 0 || j < 0 || i >= cw || j >= ch) continue;
    const hv = hotMap[j * cw + i];
    if (rp() > 0.03 + hv * 0.9) continue;
    const defocus = Math.abs(d - 170);
    const w = rp.range(9, 22) + defocus * 0.04;
    pts.push({
      x: p.x, y: p.y, w, h: Math.min(w * rp.range(2.6, 4.8), (d - 14) * 1.7), ang: Math.atan2(p.x - cx, fcy - p.y),
      kind: d < 420 && rp() < 0.26 ? 0 : rp() < 0.62 ? 1 : 2,
      b: rp.range(0.45, 1) * Math.exp(-d / 760), ph: rp.range(0, 6.28), sp: rp.range(0.7, 1.9),
    });
  }
  // a handful of hero grains: big, hot, in the focus band
  guard = 0;
  for (let n = 0; n < 8 && guard < 4000;) {
    guard++;
    const th = rp.range(-span * 0.92, span * 0.92), d = rp.range(90, 330);
    const p = a.pt(th, -d);
    const i = Math.floor((p.x - X0) * RES), j = Math.floor((p.y - Y0) * RES);
    if (hotMap[j * cw + i] < 0.3) continue;
    if (pts.some((q) => q.hero && Math.abs(q.x - p.x) < 150)) continue;
    const w = rp.range(24, 36);
    pts.push({ x: p.x, y: p.y, w, h: w * rp.range(2.8, 3.8), ang: Math.atan2(p.x - cx, fcy - p.y), kind: 0, b: rp.range(0.85, 1), ph: rp.range(0, 6.28), sp: rp.range(0.7, 1.5), hero: true });
    n++;
  }
  // a few big, melted streaks down in the out-of-focus crown
  for (let n = 0; n < 16; n++) {
    const th = rp.range(-span, span), d = rp.range(430, 760);
    const p = a.pt(th, -d), w = rp.range(26, 54);
    if (p.y > H + 60) continue;
    pts.push({ x: p.x, y: p.y, w, h: w * rp.range(3, 5), ang: Math.atan2(p.x - cx, fcy - p.y), kind: 2, b: rp.range(0.25, 0.5), ph: rp.range(0, 6.28), sp: rp.range(0.5, 1.2) });
  }
  return { c, x: X0, y: Y0, w: FW, h: FH, bloom, pts };
}

/** soft, vertically stretched blobs for the fire grains */
function buildSprites() {
  const mk = (stops) => {
    const c = L.makeCanvas(64, 192), g = c.getContext('2d');
    g.translate(32, 96); g.scale(1, 3);
    g.fillStyle = L.radial(g, 0, 0, 0, 32, stops);
    g.fillRect(-32, -32, 64, 64);
    return c;
  };
  return [
    mk([[0, 'rgba(255,222,160,1)'], [0.22, 'rgba(255,158,58,0.9)'], [0.5, 'rgba(244,84,22,0.42)'], [1, 'rgba(200,40,16,0)']]),   // hot core
    mk([[0, 'rgba(255,150,48,0.95)'], [0.4, 'rgba(255,112,26,0.6)'], [1, 'rgba(210,50,16,0)']]),                                  // 炽橙
    mk([[0, 'rgba(236,62,24,0.85)'], [0.5, 'rgba(170,26,14,0.4)'], [1, 'rgba(122,20,16,0)']]),                                    // dull red
  ];
}

export default {
  name: '艾灸火头',
  tone: 'light',
  init(env) {
    S = { back: buildBack(env), smoke: [buildSmoke(env, -1), buildSmoke(env, 1)], ember: buildEmber(env), spr: buildSprites() };
  },
  draw(ctx, env, p) {
    const a = env.arc, f = env.frame | 0, E = S.ember;
    const zoom = L.lerp(0.994, 1.014, p);                // a breath of push-in, centred so the arc never strays
    const pulse = 0.5 + 0.5 * Math.sin(f * 1.25 + 0.6);  // the ember breathes

    L.blit(ctx, env, S.back, { zoom: 1 + (zoom - 1) * 0.4 });

    // smoke: one thread far out on each side, rising
    L.cam(ctx, env, { zoom: 1 + (zoom - 1) * 0.7, dy: -24 * p }, () => { for (const s of S.smoke) ctx.drawImage(s.c, s.x, s.y); });

    L.cam(ctx, env, { zoom }, () => {
      // halation spilling over the limb: the hottest line of the frame hugs the arc, then melts upward
      ctx.globalCompositeOperation = 'screen';
      const k = 0.86 + 0.14 * pulse, r0 = a.R - 12, r1 = a.R + 170, at = (dr) => (dr + 12) / (r1 - r0);
      ctx.fillStyle = L.radial(ctx, a.cx, a.cy, r0, r1, [
        [0, `rgba(255,132,32,${0.7 * k})`], [at(3), `rgba(255,132,32,${0.7 * k})`], [at(9), `rgba(255,122,28,${0.42 * k})`],
        [at(26), `rgba(250,98,24,${0.15 * k})`], [at(80), `rgba(240,80,22,${0.05 * k})`], [1, 'rgba(240,80,22,0)']]);
      ctx.fillRect(-PAD, -PAD, W + PAD * 2, a.yAt(-PAD) + PAD + 60);
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(E.c, E.x, E.y);
      // fire grains: flicker is seeded by the frame number
      const r = L.rng('s20tw' + f);
      ctx.globalCompositeOperation = 'lighter';
      for (const q of E.pts) {
        const tw = 0.55 * (0.5 + 0.5 * Math.sin(q.ph + f * q.sp)) + 0.45 * r();
        const al = q.b * (0.3 + 0.7 * tw);
        if (al < 0.02) continue;
        const sz = 0.9 + 0.2 * tw;
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.ang);
        ctx.globalAlpha = Math.min(1, al);
        ctx.drawImage(S.spr[q.kind], -q.w * sz * 0.5, -q.h * sz * 0.5, q.w * sz, q.h * sz);
        if (q.hero) ctx.drawImage(S.spr[0], -q.w * sz * 0.28, -q.h * sz * 0.28, q.w * sz * 0.56, q.h * sz * 0.56);
        ctx.restore();
      }
      ctx.globalAlpha = 0.3 + 0.1 * pulse; ctx.globalCompositeOperation = 'screen';
      ctx.drawImage(E.bloom, E.x, E.y, E.w, E.h);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    });

    L.vignette(ctx, { strength: 0.14, color: '#1a0403', inner: 0.55, outer: 1.1 });
  },
};
