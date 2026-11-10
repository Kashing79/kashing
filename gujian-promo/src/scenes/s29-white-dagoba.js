// s29 — 白塔覆钵. Macro on the crown of a white dagoba's dome (覆钵): thick lime plaster rising as the arc,
// against a dusty ochre mountainside at dusk. Everything is a tiny height-field render:
//   dome  = trowel sweeps + brush bristle tracks (concentric with the arc) + craquelure + pores, lit from the upper left,
//           with the surface foreshortened toward the silhouette so it reads as a swelling dome, not a flat disc;
//   back  = eroded gullies of a far slope, soft-focus, calmed down behind the tagline.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 80;            // the move is a few px of rot → a modest margin is plenty
let S = null;

// ── rounded-rim foreshortening: d = screen px below the arc, s = px along the plaster surface ──
const RS = 900, D0 = 25;
const S0 = RS * Math.acos(1 - D0 / RS);
const fore = (d) => RS * Math.acos(L.clamp(1 - (Math.max(d, 1 - D0) + D0) / RS, -1, 1)) - S0;
const unfore = (s) => RS * (1 - Math.cos((s + S0) / RS)) - D0;
const squash = (s) => Math.sin((s + S0) / RS);      // dd/ds: how flat a round mark looks at surface depth s
const TURN = 1.5;          // the dome turns away from the light faster than the arc itself (keeps the crest lit, sinks the right flank)

// light: low dusk sun from the upper left, slightly behind the dome
const LV = (() => { const v = [-0.72, -0.62, 0.22]; const m = Math.hypot(...v); return v.map((c) => c / m); })();

// ── allocation-free worley ──
function hash(ix, iy, k) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(k, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
let wF1 = 0, wF2 = 0, wId = 0;
function worley(x, y, k) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let d1 = 9, d2 = 9, id = 0;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const cx = xi + ox, cy = yi + oy;
    const fx = cx + hash(cx, cy, k) - x, fy = cy + hash(cx, cy, k + 7) - y;
    const dd = fx * fx + fy * fy;
    if (dd < d1) { d2 = d1; d1 = dd; id = hash(cx, cy, k + 13); } else if (dd < d2) d2 = dd;
  }
  wF1 = Math.sqrt(d1); wF2 = Math.sqrt(d2); wId = id;
}

function lutOf(stops) {
  const f = L.makeRamp(stops); const lut = new Uint8ClampedArray(1024 * 3);
  for (let i = 0; i < 1024; i++) { const c = f(i / 1023); lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2]; }
  return lut;
}

// ───────────────────────── the dome ─────────────────────────
function buildDome(env) {
  const a = env.arc, R = a.R, CX = a.cx, CY = a.cy;
  const RES = 0.6;
  const yTop = Math.floor(a.crestY) - 14;
  const cw = Math.ceil((W + PAD * 2) * RES), ch = Math.ceil((H + PAD - yTop) * RES);
  const n = cw * ch;
  const hgt = new Float32Array(n), occ = new Float32Array(n), stk = new Float32Array(n), warm = new Float32Array(n), flk = new Float32Array(n);
  const nmx = new Float32Array(n), nmy = new Float32Array(n), nmz = new Float32Array(n);
  const live = new Uint8Array(n);
  const nA = L.makeNoise('s29-a'), nB = L.makeNoise('s29-b'), nC = L.makeNoise('s29-c'), nD = L.makeNoise('s29-d');
  const sm = L.smooth;
  const LAPS = [[105, 1.7], [318, -1.5], [600, 1.5]];

  for (let iy = 0; iy < ch; iy++) {
    const y = yTop + (iy + 0.5) / RES;
    for (let ix = 0; ix < cw; ix++) {
      const x = -PAD + (ix + 0.5) / RES;
      const ddx = x - CX, ddy = CY - y;
      const rr = Math.sqrt(ddx * ddx + ddy * ddy);
      const d = R - rr;
      if (d < -9) continue;
      const i = iy * cw + ix;
      live[i] = 1;
      const th = Math.atan2(ddx, ddy);
      const av = th * R;                        // px along the arc
      const st = Math.sin(th * TURN), ct = Math.cos(th * TURN);
      const s = fore(d);                        // px down the surface
      // macro normal of the swelling dome
      const nr = L.clamp(1 - (Math.max(d, 0) + D0) / RS, -1, 1);
      nmx[i] = nr * st; nmy[i] = -nr * ct; nmz[i] = Math.sqrt(1 - nr * nr);
      // slow warp so no stroke is perfectly concentric
      const a2 = av + 46 * nA.fbm(av / 620 + 3.1, s / 620 + 8.2, 2);
      const s2 = s + 24 * nA.fbm(av / 480 - 5.7, s / 480 + 1.3, 2);
      let h = 0;
      // trowel sweeps: long shallow swells running round the dome
      h += 2.1 * nA.fbm(a2 / 540, s2 / 40, 3);
      // raised lips left by the trowel's edge
      const rg = nB.ridged(a2 / 820 + 3.7, s2 / 58 + 1.9, 2);
      h += 1.9 * rg * rg * rg * rg;
      // bristle tracks of the limewash brush
      h += 0.8 * nB.fbm(a2 / 330, s2 / 6.5, 2);
      // lumps and sand
      h += 1.1 * nC.fbm(av / 85, s / 85, 3);
      h += 0.38 * nC.n2(av / 11 + 40, s / 11);
      // edges where one coat of plaster laps over the last
      for (let k = 0; k < LAPS.length; k++) {
        const sk = LAPS[k][0] + 70 * nA.n2(av / 900 + k * 31.7, k * 5.3) + 16 * nA.n2(av / 120 + k * 7.1, 9.9);
        h += LAPS[k][1] * sm((s2 - sk) / 9 + 0.5);
      }
      // craquelure (龟裂): patchy plates bounded by wavering hairline cracks
      const cm = sm((nC.fbm(av / 700 + 11, s / 700 - 4, 2) - 0.1) / 0.28);
      let crack = 0;
      if (cm > 0.01) {
        const a3 = a2 + 17 * nC.n2(av / 64 + 9, s / 64) + 5 * nC.n2(av / 19, s / 19 + 4);
        const s3 = s2 + 17 * nC.n2(av / 64 + 50, s / 64 + 20) + 5 * nC.n2(av / 19 + 30, s / 19);
        worley(a3 / 104, s3 / 104, 3);
        crack = (1 - sm((wF2 - wF1) / 0.04)) * cm;
        h += 0.6 * (wId - 0.5) * cm - 2.6 * crack;
      }
      // pores / air holes
      worley(av / 46 + 100, s / 46 + 50, 21);
      let pit = 0;
      if (wId > 0.45) {
        const t = (wId - 0.45) / 0.55; const pr = 0.04 + 0.14 * t * t * t;
        pit = 1 - sm((wF1 - pr * 0.45) / (pr * 0.55));
        h -= 3.2 * pit;
      }
      // a few places where the top coat has flaked off
      const fl = sm((nD.fbm(av / 250 + 70, s / 250 + 33, 3) - 0.53) / 0.03);
      h -= 2.0 * fl;
      hgt[i] = h; flk[i] = fl;
      occ[i] = Math.max(crack * 0.75, pit);
      // rain tear streaks: narrow, running straight downhill, gathering in clusters
      const se = sm((nD.fbm(av / 300 + 5, 2.2, 2) + 0.18) / 0.5);
      const sn = nD.fbm(av / 10, s / 1100 + 7.7, 3);
      const sf = sm(s / 170) * (0.55 + 0.45 * nD.n2(av / 60, s / 380));
      stk[i] = sm((sn - 0.04) / 0.36) * se * sf;
      warm[i] = sm(nD.fbm(av / 400 + 1, s / 400 + 2, 3) * 1.4 + 0.5);
    }
  }

  // shade
  const lut = lutOf([[0, '#5a5045'], [0.14, '#8f8473'], [0.29, '#a99e8c'], [0.42, '#bcb2a1'], [0.54, '#d8d1c3'], [0.64, '#ece8dd'], [0.78, '#f6f3eb'], [1, '#fffefa']]);
  const img = new ImageData(cw, ch); const px = img.data;
  const K = 1.25 * RES * 0.5;
  for (let iy = 0; iy < ch; iy++) {
    for (let ix = 0; ix < cw; ix++) {
      const i = iy * cw + ix;
      if (!live[i]) continue;
      const il = ix > 0 && live[i - 1] ? i - 1 : i, ir = ix < cw - 1 && live[i + 1] ? i + 1 : i;
      const iu = iy > 0 && live[i - cw] ? i - cw : i, id = iy < ch - 1 && live[i + cw] ? i + cw : i;
      const hx = (hgt[ir] - hgt[il]) * K * (ir - il === 2 ? 1 : 2), hy = (hgt[id] - hgt[iu]) * K * (id - iu === 2 * cw ? 1 : 2);
      let nx = nmx[i] - hx, ny = nmy[i] - hy, nz = nmz[i];
      const m = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      let v = (nx * LV[0] + ny * LV[1] + nz * LV[2]) * m;
      v = v * (1 - 0.5 * occ[i]) - 0.05 * flk[i];
      const li = (L.clamp(v) * 1023) | 0;
      const sk = stk[i], wm = warm[i], fl = flk[i];
      const tr = (1 - 0.2 * sk) * (1 - 0.1 * fl), tg = (1 - 0.2 * sk) * (1 - 0.01 * wm) * (1 - 0.12 * fl), tb = (1 - 0.18 * sk) * (1 - 0.04 * wm) * (1 - 0.16 * fl);
      const o = i * 4;
      px[o] = lut[li * 3] * tr; px[o + 1] = lut[li * 3 + 1] * tg; px[o + 2] = lut[li * 3 + 2] * tb; px[o + 3] = 255;
    }
  }
  const small = L.makeCanvas(cw, ch);
  small.getContext('2d').putImageData(img, 0, 0);

  const sMax = fore(R - (CY - (H + PAD))) + 6;
  const aMax = a.span(PAD + 110) * R;
  const toXY = (av, s) => a.pt(av / R, -unfore(s));

  return L.makeLayer(PAD, (g) => {
    // silhouette: the arc itself, with the faintest lumpiness of hand-laid plaster (never above the arc)
    const nz = L.makeNoise('s29-rim');
    g.save();
    g.beginPath();
    const sp = a.span(PAD + 140);
    for (let k = 0; k <= 520; k++) {
      const th = L.lerp(-sp, sp, k / 520);
      const dr = -0.9 + 0.9 * nz.n2(th * R / 36, 1.7) - 1.3 * L.smooth((nz.n2(th * R / 140, 6.1) - 0.55) / 0.2);
      const p = a.pt(th, dr);
      if (k === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y);
    }
    g.lineTo(W + PAD + 400, H + PAD + 50); g.lineTo(-PAD - 400, H + PAD + 50); g.closePath(); g.clip();
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(small, -PAD, yTop, cw / RES, ch / RES);

    // ── crisp full-resolution detail on top of the soft height-field render ──
    const r = L.rng('s29-detail');
    // bristle hairlines in bundles
    g.lineCap = 'round';
    for (let b = 0; b < 620; b++) {
      const s0 = r.range(1, sMax), a0 = r.range(-aMax, aMax), len = r.range(90, 620), spread = r.range(5, 24);
      const tilt = r.range(-0.05, 0.05), bow = r.range(-8, 8), hairs = r.int(4, 14);
      for (let k = 0; k < hairs; k++) {
        const so = s0 + r.range(-spread, spread), ao = a0 + r.range(-40, 40), ln = len * r.range(0.5, 1.1);
        const light = r.chance(0.68);
        g.strokeStyle = light ? `rgba(255,254,250,${r.range(0.1, 0.3).toFixed(3)})` : `rgba(122,110,94,${r.range(0.04, 0.12).toFixed(3)})`;
        const q = squash(Math.max(0, so));
        g.lineWidth = Math.max(0.45, r.range(0.6, 1.5) * Math.sqrt(q));
        g.beginPath();
        const segs = Math.max(4, Math.round(ln / 16));
        for (let j = 0; j <= segs; j++) {
          const u = j / segs;
          const p = toXY(ao + ln * u, Math.max(0.5, so + tilt * ln * (u - 0.5) + bow * Math.sin(u * Math.PI)));
          if (j === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y);
        }
        g.stroke();
      }
    }
    // pin holes: dark core, lit lip on the lower right
    for (let k = 0; k < 760; k++) {
      const av = r.range(-aMax, aMax), s = r.range(3, sMax);
      const rad = 0.7 + 3.4 * Math.pow(r(), 3.2), q = squash(s), th = av / R;
      const p = toXY(av, s);
      const al = r.range(0.45, 0.9);
      g.save(); g.translate(p.x, p.y); g.rotate(th);
      const ox = 0.75 * Math.cos(-th) - 0.75 * Math.sin(-th) * 0 + 0, oy = 0.75;
      g.fillStyle = `rgba(255,254,250,${(al * 0.75).toFixed(3)})`;
      g.beginPath(); g.ellipse(ox, oy * Math.max(0.5, q), rad + 0.3, Math.max(0.5, (rad + 0.3) * q), 0, 0, L.TAU); g.fill();
      g.fillStyle = `rgba(78,68,55,${al.toFixed(3)})`;
      g.beginPath(); g.ellipse(0, 0, rad, Math.max(0.45, rad * q), 0, 0, L.TAU); g.fill();
      g.restore();
    }
    // hero cracks wandering downhill, with branches
    const crackRun = (av, s, dir, len, w, depth) => {
      const pts = [[av, s]];
      let steps = Math.round(len / 7);
      const kids = [];
      for (let k = 0; k < steps; k++) {
        dir += r.range(-0.42, 0.42); dir = L.lerp(dir, Math.PI / 2, 0.06);
        av += Math.cos(dir) * 7; s += Math.sin(dir) * 7;
        if (s < 1.5) break;
        pts.push([av, s]);
        if (depth < 2 && r.chance(0.07)) kids.push([av, s, dir + r.sign() * r.range(0.6, 1.2), len * r.range(0.25, 0.5), w * 0.65, depth + 1]);
      }
      const m = pts.length;
      for (let k = 1; k < m; k++) {
        const u = k / m, p0 = toXY(pts[k - 1][0], pts[k - 1][1]), p1 = toXY(pts[k][0], pts[k][1]);
        const lw = Math.max(0.5, w * (1 - 0.75 * u));
        g.strokeStyle = 'rgba(255,253,246,0.55)'; g.lineWidth = lw * 0.8;
        g.beginPath(); g.moveTo(p0.x + 1.0, p0.y + 0.9); g.lineTo(p1.x + 1.0, p1.y + 0.9); g.stroke();
        g.strokeStyle = 'rgba(66,56,44,0.82)'; g.lineWidth = lw;
        g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke();
      }
      kids.forEach((c) => crackRun(...c));
    };
    [[-760, 18, 1.2, 330, 2.0], [-250, 60, 1.9, 260, 1.7], [330, 8, 1.4, 420, 2.2], [840, 40, 1.1, 300, 1.8], [-1050, 120, 1.7, 280, 1.6], [90, 300, 1.3, 260, 1.5]]
      .forEach(([av, s, dir, len, w]) => crackRun(av, s, dir, len, w, 0));
    // rain tear streaks (泪痕): pale grey rivulets running straight downhill from lips, pores and cracks
    const tears = L.makeLayer(PAD, (t) => {
      t.lineCap = 'round';
      const rt = L.rng('s29-tears');
      const nt = L.makeNoise('s29-tears');
      for (let k = 0; k < 84; k++) {
        // they gather in a few wet zones rather than spreading evenly
        const zone = rt.pick([-930, -640, -520, -150, 60, 240, 520, 700, 1010]);
        const av0 = zone + rt.gauss() * 85, sA = rt.range(4, sMax * 0.5), len = rt.range(220, 760), wid = rt.range(2.2, 7.5), str = rt.range(0.3, 1);
        const rivs = rt.int(1, 3);
        for (let q = 0; q < rivs; q++) {
          const off = q === 0 ? 0 : rt.range(-wid * 1.6, wid * 1.6), l2 = len * (q === 0 ? 1 : rt.range(0.4, 0.9)), w2 = wid * (q === 0 ? 1 : rt.range(0.4, 0.8));
          const segs = Math.ceil(l2 / 9);
          for (let j = 0; j < segs; j++) {
            const u0 = j / segs, u1 = (j + 1) / segs;
            const wob0 = 4 * nt.n2(k * 3.1 + q, u0 * l2 / 160), wob1 = 4 * nt.n2(k * 3.1 + q, u1 * l2 / 160);
            const p0 = toXY(av0 + off + wob0, sA + l2 * u0), p1 = toXY(av0 + off + wob1, sA + l2 * u1);
            const um = (u0 + u1) / 2;
            const al = str * Math.min(1, um / 0.05) * Math.pow(1 - um, 1.5) * (0.7 + 0.3 * nt.n2(k * 7.7, um * 6));
            t.strokeStyle = `rgba(126,116,100,${(0.4 * al).toFixed(3)})`;
            t.lineWidth = w2 * (0.6 + 0.5 * Math.sqrt(um));
            t.beginPath(); t.moveTo(p0.x, p0.y); t.lineTo(p1.x, p1.y); t.stroke();
          }
        }
      }
    });
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.9;
    g.drawImage(L.blurred(tears, 1.5), -PAD, -PAD);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    // fine tooth of the lime
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.5;
    g.drawImage(L.grainTex(W + PAD * 2, H + PAD * 2, { seed: 's29-g1', amount: 0.2, size: 1 }), -PAD, -PAD);
    g.globalAlpha = 0.28;
    g.drawImage(L.grainTex(W + PAD * 2, H + PAD * 2, { seed: 's29-g2', amount: 0.22, size: 3 }), -PAD, -PAD);
    g.restore();
  });
}

// ───────────────────────── the dusk mountainside behind ─────────────────────────
function buildBack(env) {
  const a = env.arc;
  const RES = 0.5;
  const yBot = Math.ceil(a.yAt(-PAD)) + 40;
  const cw = Math.ceil((W + PAD * 2) * RES), ch = Math.ceil((yBot + PAD) * RES);
  const hgt = new Float32Array(cw * ch), gul = new Float32Array(cw * ch);
  const nA = L.makeNoise('s29-bgA'), nB = L.makeNoise('s29-bgB');
  for (let iy = 0; iy < ch; iy++) {
    const y = -PAD + (iy + 0.5) / RES;
    for (let ix = 0; ix < cw; ix++) {
      const x = -PAD + (ix + 0.5) / RES;
      if (a.drAt(x, y) < -40) continue;                 // hidden behind the dome
      // far rock face: broad swells, soft eroded ridges, then a lot of rough grain, pores and a few crevices
      const wu = x + 80 * nA.fbm(x / 600, y / 600, 2), wv = y + 80 * nA.fbm(x / 600 + 9, y / 600 + 4, 2);
      const gl = nA.ridged(wu / 300 + 2.3, wv / 420, 4, 2.05, 0.55);
      let h = 22 * gl + 30 * nA.fbm(wu / 620 + 5, wv / 620, 4);
      h += 6.5 * nB.fbm(x / 64, y / 64, 3);                     // lumps
      h += 3.4 * nB.fbm(x / 15, y / 15, 2);                     // grit
      worley(x / 34 + 20, y / 34, 9);                           // pores
      if (wId > 0.5) { const pr = 0.06 + 0.2 * (wId - 0.5); h -= 5.5 * (1 - L.smooth((wF1 - pr * 0.4) / (pr * 0.6))); }
      const cv = nB.fbm(wu / 760 + 40, wv / 520 + 7, 3);        // crevices: meandering zero-crossings, only here and there
      const cmk = L.smooth((nB.fbm(x / 900 + 3, y / 900 + 8, 2) - 0.0) / 0.3);
      h -= 9 * (1 - L.smooth(Math.abs(cv) / 0.022)) * cmk;
      const i = iy * cw + ix;
      hgt[i] = h; gul[i] = gl;
    }
  }
  const lut = lutOf([[0, '#281a11'], [0.3, '#5f4630'], [0.6, '#8a6844'], [0.85, '#a67a4c'], [1, '#bd8f58']]);
  const img = new ImageData(cw, ch); const px = img.data;
  const K = 0.55 * RES * 0.5;
  for (let iy = 0; iy < ch; iy++) {
    const y = -PAD + (iy + 0.5) / RES;
    for (let ix = 0; ix < cw; ix++) {
      const x = -PAD + (ix + 0.5) / RES;
      const i = iy * cw + ix;
      const il = ix > 0 ? i - 1 : i, ir = ix < cw - 1 ? i + 1 : i, iu = iy > 0 ? i - cw : i, id = iy < ch - 1 ? i + cw : i;
      const hx = (hgt[ir] - hgt[il]) * K, hy = (hgt[id] - hgt[iu]) * K;
      // calm zone behind the tagline
      const ox = Math.max(0, Math.abs(x - 960) - 370), oy = Math.max(0, Math.abs(y - 410) - 150);
      const calm = L.lerp(0.3, 1, L.smooth(Math.hypot(ox, oy) / 280));
      const base = 0.5 - 0.14 * (x / W) - 0.1 * L.clamp(y / 600);
      const v = base + calm * ((hx * 0.82 + hy * 0.5) + 0.1 * (gul[i] - 0.4));
      const li = (L.clamp(v) * 1023) | 0;
      const o = i * 4;
      px[o] = lut[li * 3]; px[o + 1] = lut[li * 3 + 1]; px[o + 2] = lut[li * 3 + 2]; px[o + 3] = 255;
    }
  }
  const small = L.makeCanvas(cw, ch);
  small.getContext('2d').putImageData(img, 0, 0);
  const soft = L.makeLayer(PAD, (g) => {
    g.fillStyle = '#5f4630'; g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(small, -PAD, -PAD, cw / RES, ch / RES);
  });
  const out = L.blurred(soft, 0.9);
  const g = out.getContext('2d');
  // dusty dusk light pooling in the upper left
  g.globalCompositeOperation = 'screen';
  g.fillStyle = L.radial(g, PAD - 120, PAD - 200, 60, 1150, [[0, 'rgba(214,150,84,0.3)'], [0.5, 'rgba(190,128,74,0.09)'], [1, 'rgba(190,128,74,0)']]);
  g.fillRect(0, 0, out.width, out.height);
  // coarse airborne grit
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.55;
  g.drawImage(L.grainTex(out.width, out.height, { seed: 's29-bg1', amount: 0.26, size: 1 }), 0, 0);
  g.globalAlpha = 0.5;
  g.drawImage(L.grainTex(out.width, out.height, { seed: 's29-bg2', amount: 0.24, size: 3 }), 0, 0);
  return out;
}

/** the dome's shadow, thrown up-right onto the haze behind it and hugging the arc */
function buildShadow(env) {
  const a = env.arc;
  const c = L.makeCanvas(W, H); const g = c.getContext('2d');
  g.fillStyle = L.radial(g, a.cx + 46, a.cy - 6, a.R - 30, a.R + 110, [[0, 'rgba(26,15,7,0.72)'], [0.25, 'rgba(26,15,7,0.6)'], [0.5, 'rgba(26,15,7,0.3)'], [1, 'rgba(26,15,7,0)']]);
  g.fillRect(0, 0, W, H);
  // a tight contact line all the way along
  g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 4, a.R + 22, [[0, 'rgba(22,12,5,0.5)'], [1, 'rgba(22,12,5,0)']]);
  g.fillRect(0, 0, W, H);
  return c;
}

export default {
  name: '白塔覆钵',
  tone: 'light',
  init(env) {
    const over = L.makeCanvas(W, H);
    L.vignette(over.getContext('2d'), { strength: 0.24, inner: 0.5, outer: 1.1 });
    S = { dome: buildDome(env), back: buildBack(env), shadow: buildShadow(env), over };
  },
  draw(ctx, env, p) {
    const rot = L.lerp(-0.006, 0.006, p);
    L.blit(ctx, env, S.back, { rot: rot * 0.35, zoom: L.lerp(1.0, 1.012, p) });
    ctx.drawImage(S.shadow, 0, 0);
    L.blit(ctx, env, S.dome, { rot });
    ctx.drawImage(S.over, 0, 0);
  },
};
