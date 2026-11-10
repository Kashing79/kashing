// s28 — 月下瓦垄. Moonlight raking across a grey-tile roof (筒瓦屋面), almost black & white.
// The arc is the roof's round ridge: a row of 筒瓦 crowns makes a softly scalloped edge whose crests touch env.arc.
// Below it the tile ridges (凸起的筒瓦垄) run down the slope along the radius, alternating with the sunken 板瓦 troughs.
// Recipe: build a real HEIGHT FIELD of the roof once in init() (tubes, pan-tile laps, joints, grit, moss), light it with a
// low raking light from the upper left (lambert + marched cast shadows), then blit that single layer with a small rot.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 160;        // the camera only drifts ~20 px; this is plenty and keeps the per-pixel pass small
const PITCH = 148;      // spacing of the tile ridges along the arc (px)
const HALF = 42;        // half-width of a round tile (筒瓦)
const WN = HALF / PITCH;
const HT = 36;          // how far a 筒瓦 stands above the pan tiles (height units = px)
const PAN = 0.26;       // depth of the 板瓦 trough as a fraction of HT
const AMP = 20;         // oblique view: a full tube height shifts this many px up-screen → the scallop height at the ridge
const TOP = 3;          // dr of the scallop crests (the bright rim then sits right on the arc)
const LT = 158;         // visible length of one 筒瓦 (foreshortened by the oblique view)
const LP = 50;          // exposed length of one 板瓦 (they overlap heavily: 压七露三)
const RES = 0.75;       // resolution of the height / lighting pass
const W0 = 36, KR = 15; // the roof rolls away over the ridge: width and drop of that roll-off
const PHI = L.deg(40);  // direction the light TRAVELS on screen (0 = → , 90 = ↓): from the upper left
const EL = L.deg(23);   // light elevation above the roof surface: low → long shadows fill the troughs
let S = null;

const hash2 = (a, b) => {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** cross-section of the roof across one pitch. f = offset from the tube axis in pitch fractions (−0.5..0.5).
 *  returns 1 on the crown of the 筒瓦, 0 at its foot, negative down in the 板瓦 trough. */
function prof(f) {
  const af = Math.abs(f), a = af / WN;
  if (a < 1) { const t = Math.sqrt(1 - a * a); return t > 0.2 ? t : 0.2; }      // half-round tile (+ a foot of mortar: 夹垄灰)
  const b = (af - WN) / (0.5 - WN), c = 1 - (b > 1 ? 1 : b);
  return -PAN * (1 - c * c) + 0.2 * Math.exp(-(a - 1) * 7);                      // shallow concave pan tile
}

function makeGeom(env) {
  const a = env.arc;
  const dTh = PITCH / a.R;
  const thMax = Math.atan2(W / 2 + PAD + 60, a.cy - (H + PAD)) + 0.03;
  const N = Math.ceil(thMax / dTh) + 3;
  const n = 2 * N + 6;
  const r = L.rng('s28geom');
  const jit = new Float32Array(n), jo = new Float32Array(n), po = new Float32Array(n), wph = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    jit[i] = r.range(-3, 3) / PITCH;        // no two ridges are spaced exactly alike
    jo[i] = LT - 104 + r.range(-7, 7);      // tile joints line up across the roof (concentric with the arc), give or take
    po[i] = r.range(0, LP);
    wph[i] = r.range(0, 100);
  }
  const nz = L.makeNoise('s28');
  const WOB = 2.2 / PITCH;
  // 底瓦坐中: a trough sits on the centre line, tube axes at (k + 0.5) pitches
  const locate = (th, v, out) => {
    const q = th / dTh - 0.5; const k = Math.round(q); const ki = k + N;
    out.ki = ki;
    out.f = q - k + jit[ki] + nz.n2(ki * 3.7, v * 0.0042 + wph[ki]) * WOB;
  };
  const dcap = (th) => (nz.n2((th / dTh) * 0.83, 11.3) * 0.5 + 0.5) * 2.4;      // crowns are not all exactly level
  /** the scalloped ridge silhouette: dr of the roof's upper edge at angle th */
  const tmp = { ki: 0, f: 0 };
  const edgeDr = (th) => { locate(th, 10, tmp); return TOP - AMP * (1 - prof(tmp.f)) - dcap(th); };
  const edgePath = (g) => {
    const s = thMax; const step = 1.5 / a.R;
    g.beginPath();
    let first = true;
    for (let th = -s; th <= s; th += step) {
      const p = a.pt(th, edgeDr(th));
      if (first) { g.moveTo(p.x, p.y); first = false; } else g.lineTo(p.x, p.y);
    }
    g.lineTo(W + PAD + 200, H + PAD + 200); g.lineTo(-PAD - 200, H + PAD + 200); g.closePath();
  };
  return { a, dTh, thMax, N, n, jit, jo, po, nz, locate, dcap, edgeDr, edgePath };
}

function buildRoof(env) {
  const G = makeGeom(env);
  const { a, dTh, N, jit, jo, po, nz, locate, dcap } = G;
  const x0 = -PAD, y0 = Math.floor(a.crestY - 44), x1 = W + PAD, y1 = H + PAD;
  const cw = Math.ceil((x1 - x0) * RES), ch = Math.ceil((y1 - y0) * RES);
  const Hm = new Float32Array(cw * ch), Al = new Float32Array(cw * ch), Pm = new Float32Array(cw * ch);
  const mossH = new Float32Array(cw * ch), mossA = new Float32Array(cw * ch), pitH = new Float32Array(cw * ch);
  const lichH = new Float32Array(cw * ch), lichA = new Float32Array(cw * ch);

  // ── stamps: moss cushions (dark lumps hugging the foot of the tubes and the joints) and small pits / chips ──
  const toMap = (th, v) => { const p = a.pt(th, TOP - v); return [(p.x - x0) * RES, (p.y - y0) * RES]; };
  const stamp = (arrMax, arrA, mx, my, rad, hgt) => {
    const i0 = Math.max(0, Math.floor(mx - rad)), i1 = Math.min(cw - 1, Math.ceil(mx + rad));
    const j0 = Math.max(0, Math.floor(my - rad)), j1 = Math.min(ch - 1, Math.ceil(my + rad));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const d2 = ((i - mx) * (i - mx) + (j - my) * (j - my)) / (rad * rad);
      if (d2 >= 1) continue;
      const k = 1 - d2, idx = j * cw + i;
      const hh = hgt * Math.sqrt(k);
      if (hgt > 0) { if (hh > arrMax[idx]) arrMax[idx] = hh; const aa = L.clamp(k * 2.2); if (arrA && aa > arrA[idx]) arrA[idx] = aa; }
      else arrMax[idx] += hgt * k;
    }
  };
  const rm = L.rng('s28moss');
  const kMin = -N + 2, kMax = N - 2;
  const lump = (th, v, big) => {
    const n = big ? rm.int(4, 8) : rm.int(1, 3);
    for (let q = 0; q < n; q++) {
      const rad = (big ? rm.range(3.5, 7.5) : rm.range(2.2, 4.6)) * RES;
      const [mx, my] = toMap(th + (rm.range(-9, 9) * (big ? 1 : 0.5)) / a.R, v + rm.range(-14, 14) * (big ? 1 : 0.4));
      stamp(mossH, mossA, mx, my, rad, (rad / RES) * rm.range(0.5, 0.85));
    }
  };
  // 1) cushions in the troughs, hugging the foot of a tube where dust and water collect
  for (let m = 0; m < 120; m++) {
    const k = rm.int(kMin, kMax), fl = rm.sign() * (WN + rm.range(0.015, 0.2));
    const w = 30 + 950 * Math.pow(rm(), 1.3);
    lump((k + 0.5 + fl - jit[k + N]) * dTh, w + AMP * (1 - prof(fl)), rm.chance(0.25));
  }
  // 2) dots of moss sitting in the joints between 筒瓦, low on the flanks
  for (let m = 0; m < 90; m++) {
    const k = rm.int(kMin, kMax), fl = rm.sign() * WN * rm.range(0.35, 0.97);
    const w = rm.int(1, 7) * LT - jo[k + N] + rm.range(-2, 6);
    lump((k + 0.5 + fl - jit[k + N]) * dTh, w + AMP * (1 - prof(fl)), false);
  }
  // 3) dots along the lapped edges of the 板瓦
  for (let m = 0; m < 80; m++) {
    const k = rm.int(kMin, kMax), fl = WN + rm.range(0.03, 1 - 2 * WN - 0.03);     // anywhere across the trough right of tube k
    const w = rm.int(1, 20) * LP - po[k + N] + rm.range(-1, 5);
    const ff = fl > 0.5 ? fl - 1 : fl;
    lump((k + 0.5 + fl - jit[k + N]) * dTh, w + AMP * (1 - prof(ff)), false);
  }
  // pale crustose lichen: irregular rosettes, thicker on the weather side
  const rl = L.rng('s28lichen');
  for (let m = 0; m < 95; m++) {
    const mx = rl() * cw, my = rl() * ch, n = rl.int(2, 6), R0 = rl.range(5, 17) * RES;
    for (let q = 0; q < n; q++) stamp(lichH, lichA, mx + rl.range(-1, 1) * R0, my + rl.range(-1, 1) * R0, R0 * rl.range(0.5, 1), 0.9);
  }
  // pits, and bigger chips knocked out of tile ends
  const rp = L.rng('s28pits');
  for (let m = 0; m < 2200; m++) {
    stamp(pitH, null, rp() * cw, rp() * ch, rp.range(0.9, 2.4) * (rp.chance(0.05) ? 2.2 : 1), -rp.range(0.8, 2.4));
  }
  for (let m = 0; m < 46; m++) {
    const k = rp.int(kMin, kMax), fl = rp.range(-0.9, 0.9) * WN;
    const w = rp.int(1, 7) * LT - jo[k + N] + rp.range(-3, 3);
    const [mx, my] = toMap((k + 0.5 + fl - jit[k + N]) * dTh, w + AMP * (1 - prof(fl)));
    for (let q = 0; q < 3; q++) stamp(pitH, null, mx + rp.range(-4, 4) * RES, my + rp.range(-2, 2) * RES, rp.range(2.5, 6) * RES, -rp.range(2, 4.5));
  }

  // ── height field + albedo ──
  const loc = { ki: 0, f: 0 };
  for (let j = 0; j < ch; j++) {
    const Y = y0 + (j + 0.5) / RES, dy = a.cy - Y;
    for (let i = 0; i < cw; i++) {
      const X = x0 + (i + 0.5) / RES, dx = X - a.cx, idx = j * cw + i;
      const rr = Math.sqrt(dx * dx + dy * dy);
      const v = a.R + TOP - rr;                       // px below the crown line
      if (v < -16) { Hm[idx] = -90; continue; }
      const th = Math.atan2(dx, dy);
      locate(th, v, loc);
      const ki = loc.ki; let f = loc.f;
      const dc = dcap(th);
      let p = prof(f);
      let w = v - AMP * (1 - p) - dc;                 // distance down the slope from the ridge (oblique projection)
      let h, al;
      if (Math.abs(f) < WN * 0.985) {
        // 筒瓦: a run of half-round tiles butted end to end
        const jt = Math.floor((w + jo[ki]) / LT);
        const r1 = hash2(ki * 31 + 7, jt), r2 = hash2(ki * 17 + 3, jt + 91), r3 = hash2(ki + 500, jt * 13 + 5);
        f += ((r1 - 0.5) * 3.4) / PITCH;              // each tile sits a hair off the line…
        p = prof(f) * (0.96 + 0.08 * r2);             // …and a hair proud or shy of its neighbours
        w = v - AMP * (1 - p) - dc;
        const tv = w + jo[ki] - jt * LT;
        const dj = Math.min(Math.abs(tv), Math.abs(LT - tv));
        h = HT * p + (r3 - 0.5) * 2.0 + 3.0 * (tv / LT - 0.5) - 3.4 * Math.exp(-(dj * dj) / 5);
        al = 0.78 + 0.28 * r2 + 0.2 * Math.exp(-(dj * dj) / 40);
      } else {
        // 板瓦: concave tiles lapped like scales, each lower edge standing proud of the tile below
        const kt = f > 0 ? ki : ki - 1;
        const wp = w + po[kt]; const jp = Math.floor(wp / LP); const pv = wp - jp * LP;
        const r1 = hash2(kt * 13 + 1, jp * 7 + 2);
        h = HT * p + 5.4 * (pv / LP) + (r1 - 0.5) * 1.6;
        al = 0.6 + 0.22 * r1;
      }
      if (w < W0) { const t = 1 - w / W0; h -= KR * t * t; }    // the ridge rolls over, away from us
      // weathering: broad blotches, lumps, grit, rain streaks down the slope, pale lichen crust, moss
      const nA = nz.fbm(X * 0.011, Y * 0.011, 3);
      const nB = nz.fbm(X * 0.1 + 13, Y * 0.1, 2);
      const nC = nz.n2(X * 0.45 + 40, Y * 0.45);
      const st = nz.fbm(th * a.R * 0.05, v * 0.006 + 9, 2);
      const ro = L.smooth(0.5 + 1.6 * nz.fbm(X * 0.02 + 70, Y * 0.02 - 30, 2));      // where the surface has gone rough
      h += nA * 1.5 + nB * (0.45 + 0.9 * ro) + nC * (0.2 + 0.25 * ro) + pitH[idx];
      al *= (0.86 + 0.2 * nA) * (0.88 + 0.22 * st) * (1.04 - 0.1 * ro);
      const lc = lichA[idx];
      if (lc > 0) {
        const e = L.smooth((lc + nB * 0.35 - 0.3) / 0.3);
        al *= 1 + 0.42 * e; h += e * (0.7 + nB * 0.8 + nC * 0.5);
      }
      const mh = mossH[idx];
      if (mh > 0) { h += mh * (0.85 + 0.3 * nC); al *= 1 - 0.66 * mossA[idx]; }
      Hm[idx] = h; Al[idx] = al; Pm[idx] = p;
    }
  }

  // ── lighting ──
  const lx = Math.cos(PHI), ly = Math.sin(PHI);
  const cE = Math.cos(EL), sE = Math.sin(EL), tE = Math.tan(EL);
  const Lx = -lx * cE, Ly = -ly * cE, Lz = sE;                    // unit vector toward the moon
  let Hx = Lx, Hy = Ly, Hz = Lz + 1; { const m = Math.hypot(Hx, Hy, Hz); Hx /= m; Hy /= m; Hz /= m; }
  const inv = RES / 2, HMAX = HT + 9, AMB = 0.03, SUN = 1.9;
  const ramp = L.makeRamp([[0, '#040506'], [0.5, '#7d838a'], [1, '#e8ecf0']]);
  const lut = new Uint8ClampedArray(1024 * 3);
  for (let i = 0; i < 1024; i++) { const c = ramp(i / 1023); lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2]; }
  const img = new ImageData(cw, ch); const d = img.data;
  for (let j = 0; j < ch; j++) {
    const Y = y0 + (j + 0.5) / RES;
    for (let i = 0; i < cw; i++) {
      const idx = j * cw + i, o = idx * 4;
      const h0 = Hm[idx];
      d[o + 3] = 255;
      if (h0 < -60 || i < 1 || j < 1 || i >= cw - 1 || j >= ch - 1) { d[o] = 4; d[o + 1] = 5; d[o + 2] = 6; continue; }
      const X = x0 + (i + 0.5) / RES;
      const hx = (Hm[idx + 1] - Hm[idx - 1]) * inv, hy = (Hm[idx + cw] - Hm[idx - cw]) * inv;
      const nl = 1 / Math.sqrt(hx * hx + hy * hy + 1);
      let dif = (-hx * Lx - hy * Ly + Lz) * nl;
      let sh = 1;
      if (dif > 0) {
        // march toward the moon across the height field → cast shadows with a soft edge
        for (let t = 1.5; t < 150; t += t < 14 ? 1 : 1.6) {
          const sx = (i - lx * t + 0.5) | 0, sy = (j - ly * t + 0.5) | 0;
          if (sx < 0 || sy < 0) break;
          const dist = t / RES, ray = h0 + dist * tE;
          if (ray > HMAX) break;
          const c = ((ray - Hm[sy * cw + sx]) / dist) * 7;
          if (c < sh) { sh = c; if (sh <= 0) { sh = 0; break; } }
        }
      } else dif = 0;
      const ao = 0.3 + 0.7 * L.clamp((Pm[idx] + PAN) / (1 + PAN));
      const ndh = (-hx * Hx - hy * Hy + Hz) * nl;
      const spec = ndh > 0 ? Math.pow(ndh, 14) * 0.3 * sh : 0;
      let c = Al[idx] * (AMB * ao + SUN * dif * sh) + spec;
      // the moon is at the upper left: the left of the roof is brighter, the far right sinks into the night
      const fx = L.smooth((X + 160) / (W + 320));
      c *= L.lerp(1.12, 0.74, fx);
      c *= L.lerp(1, 0.84, L.smooth((Y - a.crestY - 150) / 600));   // …and it dims a little toward the eaves
      c = 1.06 * (1 - Math.exp(-2.1 * c)); if (c > 1) c = 1;        // soft shoulder: flanks reach white without clipping flat
      const li = ((c * 1023) | 0) * 3;
      d[o] = lut[li]; d[o + 1] = lut[li + 1]; d[o + 2] = lut[li + 2];
    }
  }
  const small = L.makeCanvas(cw, ch);
  small.getContext('2d').putImageData(img, 0, 0);

  // ── compose the layer: crisp scalloped silhouette, grain and grit at full resolution ──
  return L.makeLayer(PAD, (g) => {
    g.save();
    G.edgePath(g); g.clip();
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(small, x0, y0, cw / RES, ch / RES);
    const gw = x1 - x0, gh = y1 - y0;
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.5;
    g.drawImage(L.grainTex(gw, gh, { seed: 's28g', amount: 0.55 }), x0, y0);
    g.globalAlpha = 0.3;
    g.drawImage(L.grainTex(gw, gh, { seed: 's28g2', amount: 0.6, size: 3 }), x0, y0);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    L.speckle(g, { seed: 's28dk', count: 2600, x: x0, y: y0, w: gw, h: gh, rMin: 0.4, rMax: 1.9, squash: 0.6, colors: ['#040506', '#15181c'], alpha: [0.2, 0.7] });
    L.speckle(g, { seed: 's28lt', count: 1500, x: x0, y: y0, w: gw, h: gh, rMin: 0.4, rMax: 1.5, colors: ['#e8ecf0', '#aab1b9'], alpha: [0.1, 0.5] });
    // 瓦松: a few clumps of the little succulent that colonises old tile roofs, rooted at the foot of a tube
    WASONG.forEach(([k, side, w, sc], i) => {
      const fl = side * (WN + 0.045);
      wasong(g, a, (k + 0.5 + fl - jit[k + N]) * dTh, w + AMP * (1 - prof(fl)), sc, i);
    });
    g.restore();
  });
}

// [ridge index k, side of that tube (−1 left / +1 right), distance down the slope, scale]
const WASONG = [[-6, 1, 150, 1.0], [-4, -1, 372, 0.85], [-2, 1, 96, 0.9], [1, -1, 250, 1.05], [3, 1, 128, 0.8], [5, -1, 205, 0.9]];

/** one clump of 瓦松 standing on the roof at (theta, v): short scaly spikes, moonlit on the left, each throwing a long thin shadow */
function wasong(g, a, th, v, sc, seed) {
  const r = L.rng('s28ws' + seed);
  a.at(g, th, TOP - v, () => {
    const n = r.int(2, 4);
    const spikes = [];
    for (let i = 0; i < n; i++) spikes.push({ x: r.range(-10, 10) * sc, y: r.range(-3, 4) * sc, h: r.range(15, 34) * sc * (i === 0 ? 1.25 : 1), w: r.range(4.2, 6.2) * sc, lean: r.range(-0.2, 0.2) });
    spikes.sort((p, q) => p.y - q.y);
    // shadows fall away from the moon (PHI is a screen direction → turn it into this local frame)
    const sa = PHI - th;
    g.save(); g.filter = 'blur(1.6px)'; g.fillStyle = 'rgba(4,5,6,0.62)';
    for (const s of spikes) {
      const len = s.h * 2.3, ux = Math.cos(sa), uy = Math.sin(sa);
      g.beginPath(); g.moveTo(s.x - uy * s.w * 0.8, s.y + ux * s.w * 0.8); g.lineTo(s.x + ux * len, s.y + uy * len); g.lineTo(s.x + uy * s.w * 0.8, s.y - ux * s.w * 0.8); g.closePath(); g.fill();
    }
    g.restore();
    for (const s of spikes) {
      g.save(); g.translate(s.x, s.y); g.rotate(s.lean);
      // rosette of fleshy pointed leaves at the base
      for (let q = 0; q < 7; q++) {
        const u = q / 6, ang = Math.PI * (1.08 - 1.16 * u), ll = s.w * r.range(1.3, 1.9);
        g.save(); g.rotate(-ang + Math.PI / 2 - Math.PI / 2);
        g.fillStyle = u < 0.55 ? L.mix('#aab1b9', '#e8ecf0', r()) : '#0c0e11';
        g.beginPath(); g.moveTo(0, -s.w * 0.28); g.quadraticCurveTo(ll * 0.6, -s.w * 0.4, ll, 0); g.quadraticCurveTo(ll * 0.6, s.w * 0.4, 0, s.w * 0.28); g.closePath(); g.fill();
        g.restore();
      }
      // the spike: overlapping scales, widest a third of the way up, tapering to a point
      const rows = Math.max(5, Math.round(s.h / (2.5 * sc)));
      for (let q = 0; q < rows; q++) {
        const u = q / (rows - 1), y = -u * s.h;
        const wd = s.w * (0.55 + 0.6 * Math.sin(Math.PI * Math.min(1, u * 0.9 + 0.22))) * (1 - 0.62 * u * u);
        const st = s.h / rows;
        g.fillStyle = L.mix('#b4bbc3', '#eef1f4', 0.3 + 0.7 * r());
        g.beginPath(); g.moveTo(0.4, y + st * 0.7); g.lineTo(-wd, y - st * 0.1); g.lineTo(0.4, y - st * 1.25); g.closePath(); g.fill();
        g.fillStyle = '#07090b';
        g.beginPath(); g.moveTo(0.4, y + st * 0.7); g.lineTo(wd, y - st * 0.1); g.lineTo(0.4, y - st * 1.25); g.closePath(); g.fill();
      }
      g.restore();
    }
  });
}

export default {
  name: '月下瓦垄',
  tone: 'light',
  init(env) {
    S = { roof: buildRoof(env) };
  },
  draw(ctx, env, p) {
    ctx.fillStyle = '#040506'; ctx.fillRect(0, 0, W, H);
    const a = env.arc;
    const rot = L.lerp(-0.007, 0.007, p), zoom = L.lerp(1.0, 1.015, p);
    L.blit(ctx, env, S.roof, { rot, zoom });
    // a breath of brighter moonlight drifting along the ridge: colour-dodge lifts the lit tile and leaves the blacks black
    const q = a.pt(L.lerp(-0.2, -0.06, p), -40);
    ctx.save(); ctx.globalCompositeOperation = 'color-dodge';
    ctx.fillStyle = L.radial(ctx, q.x, q.y, 0, 620, [[0, 'rgba(200,210,225,0.3)'], [0.5, 'rgba(200,210,225,0.1)'], [1, 'rgba(200,210,225,0)']]);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  },
};
