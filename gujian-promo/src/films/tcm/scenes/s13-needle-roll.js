// s13 — 针包. Flat-lay macro of an unrolled leather needle roll on beige handmade paper:
// the arc is the roll's upper edge. A finger's width below it a row of filiform needles (毫针) is pinned through the
// vegetable-tanned leather — ring tail, spiral-wound wire handle, hair-thin body that dives into a slit, runs under the
// leather (a raised ridge) and shows again for a short length. A saddle-stitched crease line follows the edge; near the
// crest a vermilion silk thread climbs out over the edge with a frayed end, next to a short dark-green tail.
//
// The leather is shaded per pixel in init(): a float height field (pebbled grain from two worley layers, long wrinkles,
// soft rolling undulation, the stitch crease, the needle slits and tunnels, the rounded edge) lit from the upper left.
// Everything needle/stitch related is analytic in polar coords (U = px along the arc, d = px below it), so it stays
// concentric with the arc and the whole picture can slide along it.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 140;
const PITCH = 116;                // needle spacing along the arc
const HW = 7.5;                   // half width of the wound handle
const RING_D = 58, RING_R = 8.5;  // tail ring: depth below the arc, outer radius
const H1 = 196;                   // end of the wire winding (needle root)
const S1 = 276, S2 = 318, S3 = 374; // depths of the three slits each needle threads through
const ST_D = 30, ST_P = 24, ST_OFF = 12; // stitch line: depth, hole pitch, hole phase
const FOLD_U = 448;               // where the edge has a small dog-ear
const LXS = -0.66, LYS = -0.75;   // key light direction in the picture plane (from the upper left)
let S = null;

const sstep = (a, b, v) => { let t = (v - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const THREAD = {
  red: { dark: '#8a0c1a', mid: '#d2202c', light: '#ff8a76' },
  green: { dark: '#0b2a1c', mid: '#1c5c3e', light: '#62a57e' },
  flax: { dark: '#a3854c', mid: '#eedfb2', light: '#fffbe6' },
};

// ── tiny allocation-free worley noise (squared distances in cD1/cD2, cell id in cId) ──
let cD1 = 0, cD2 = 0, cId = 0;
function cell(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let d1 = 9, d2 = 9, id = 0;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const cx = xi + ox, cy = yi + oy;
    let h = (Math.imul(cx, 374761393) + Math.imul(cy, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    const dx = cx + (h & 1023) / 1023 - x, dy = cy + ((h >>> 10) & 1023) / 1023 - y, d = dx * dx + dy * dy;
    if (d < d1) { d2 = d1; d1 = d; id = ((h >>> 20) & 255) / 255; } else if (d < d2) d2 = d;
  }
  cD1 = d1; cD2 = d2; cId = id;
}

const line = (g, x0, y0, x1, y1, lw, style) => { g.strokeStyle = style; g.lineWidth = lw; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
function rrect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
  g.lineTo(x + w, y + h - r); g.arc(x + w - r, y + h - r, r, 0, Math.PI / 2); g.lineTo(x + r, y + h);
  g.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI); g.lineTo(x, y + r); g.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5); g.closePath();
}

// ───────────────────────── leather: per-pixel height field + shading ─────────────────────────
function buildLeather(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const X0 = -PAD, Y0 = Math.floor(a.crestY) - 4;
  const RW = W + PAD * 2, RH = H + PAD - Y0, N = RW * RH;
  const nA = L.makeNoise('s13a'), nB = L.makeNoise('s13b');

  // slow fields on a coarse grid
  const CS = 4, cw = Math.ceil(RW / CS) + 2, ch = Math.ceil(RH / CS) + 2, CN = cw * ch;
  const cMac = new Float32Array(CN), cTone = new Float32Array(CN), cWx = new Float32Array(CN), cWy = new Float32Array(CN), cM2 = new Float32Array(CN), cM3 = new Float32Array(CN);
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const x = X0 + i * CS, y = Y0 + j * CS, k = j * cw + i;
    const ddx = x - cx, ddy = cy - y, U = Math.atan2(ddx, ddy) * R, d = R - Math.hypot(ddx, ddy);
    // soft swells + the gentle transverse waves a rolled-up strip keeps when it is laid flat
    cMac[k] = 15 * nA.fbm(x / 400, y / 400, 3) + 6.5 * nA.n2(U / 190 + 3.1, d / 700 + 9.2) + 1.6 * nB.n2(U / 64 - 8, d / 300);
    cTone[k] = nB.fbm(x / 230 + 11, y / 230 - 5, 3);
    cWx[k] = nB.n2(x / 64 + 5, y / 64); cWy[k] = nB.n2(x / 64 - 31, y / 64 + 19);
    cM2[k] = nA.fbm(x / 190 - 40, y / 190 + 13, 2);
    cM3[k] = nB.n2(x / 330 + 9, y / 330 - 2);
  }
  const bil = (src, i, j) => {
    const fx = i / CS, fy = j / CS, i0 = fx | 0, j0 = fy | 0, tx = fx - i0, ty = fy - j0, k = j0 * cw + i0;
    const a0 = src[k], a1 = src[k + 1], b0 = src[k + cw], b1 = src[k + cw + 1];
    return (a0 + (a1 - a0) * tx) * (1 - ty) + (b0 + (b1 - b0) * tx) * ty;
  };

  const Hh = new Float32Array(N), Cv = new Float32Array(N), Dp = new Float32Array(N);
  for (let j = 0; j < RH; j++) {
    const y = Y0 + j, ddy = cy - y;
    for (let i = 0; i < RW; i++) {
      const k = j * RW + i, x = X0 + i, ddx = x - cx, rr = Math.sqrt(ddx * ddx + ddy * ddy), d = R - rr;
      if (d < -3) { Dp[k] = -9; continue; }
      Dp[k] = d;
      const wx = bil(cWx, i, j), wy = bil(cWy, i, j);
      // fine grain: a net of hairline creases between tiny pads, a pore in the middle of many of them
      cell((x + wx * 6) / 9.2, (y + wy * 6) / 7.6);
      const f1 = Math.sqrt(cD1), g1 = 1 - sstep(0.03, 0.3, Math.sqrt(cD2) - f1), id1 = cId;
      const pore = id1 > 0.42 && f1 < 0.24 ? 1 - f1 / 0.24 : 0;
      // coarser crumple net, only in patches
      const m2 = sstep(-0.05, 0.4, bil(cM2, i, j));
      let g2 = 0;
      if (m2 > 0) { cell((x + wx * 30) / 40 + 7.3, (y + wy * 30) / 30 - 2.1); g2 = (1 - sstep(0.0, 0.1, Math.sqrt(cD2) - Math.sqrt(cD1))) * m2; }
      // a few long wrinkles
      const m3 = sstep(0.05, 0.55, bil(cM3, i, j));
      let g3 = 0;
      if (m3 > 0) { const wv = nA.n2((x + wx * 44) / 170, (y + wy * 44) / 120 + 50); g3 = (1 - sstep(0.0, 0.045, Math.abs(wv))) * m3; }
      let h = bil(cMac, i, j) + 0.22 * (id1 - 0.5) - 0.3 * g1 - 0.5 * g2 - 0.95 * g3 - 0.55 * pore;
      let cav = 0.26 * g1 + 0.4 * g2 + 0.6 * g3 + 0.75 * pore;
      if (d < 10) { const t = 1 - Math.max(0, d) / 10; h -= 3.2 * t * t; }   // the edge rounds over
      if (d > 17 && d < 43) {                                       // pressed crease + stitch holes
        const dd = d - ST_D, U = Math.atan2(ddx, ddy) * R;
        const gz = Math.exp(-dd * dd / 11);
        let uh = (U - ST_OFF) / ST_P; uh = (uh - Math.round(uh)) * ST_P;
        const hz = Math.exp(-(uh * uh + dd * dd) / 12);
        h -= 1.3 * gz + 2.2 * hz; cav += 0.35 * gz + 0.5 * hz;
      }
      if (d > S1 - 14 && d < S3 + 120) {                            // needle slits and tunnels
        let q = (Math.atan2(ddx, ddy) * R) / PITCH - 0.5; q = (q - Math.round(q)) * PITCH * (rr / R);
        const aq = Math.abs(q);
        if (aq < 28) {
          const m = sstep(S1 - 1, S1 + 8, d) * (1 - sstep(S2 - 8, S2 + 1, d)) + sstep(S3 - 1, S3 + 8, d) * (1 - sstep(S3 + 45, S3 + 112, d));
          h += 5.2 * m * Math.exp(-q * q / 46);
          const sl = 1 - sstep(8.5, 12.5, aq);
          if (sl > 0) {
            const z1 = d - S1, z2 = d - S2, z3 = d - S3;
            const sg = Math.exp(-z1 * z1 / 5) + Math.exp(-z2 * z2 / 5) + Math.exp(-z3 * z3 / 5);
            h -= 3.2 * sg * sl; cav += 0.9 * sg * sl;
          }
          // the leather is rubbed darker where the metal sits on it
          const rub = Math.exp(-q * q / 150) * sstep(S1 - 14, S1, d) * (1 - sstep(S3, S3 + 40, d));
          cav += 0.16 * rub;
        }
      }
      Hh[k] = h; Cv[k] = cav;
    }
  }

  // shade: warm key from the upper left, soft sheen, shadows that stay saturated
  const img = new ImageData(RW, RH), px = img.data;
  const LX = -0.55, LY = -0.62, LZ = 0.56, HX = -0.311, HY = -0.351, HZ = 0.883;
  for (let j = 0; j < RH; j++) {
    const jm = j > 0 ? -RW : 0, jp = j < RH - 1 ? RW : 0;
    for (let i = 0; i < RW; i++) {
      const k = j * RW + i, d = Dp[k];
      if (d < -3) continue;
      const hx = (Hh[k + (i < RW - 1 ? 1 : 0)] - Hh[k - (i > 0 ? 1 : 0)]) * 0.5, hy = (Hh[k + jp] - Hh[k + jm]) * 0.5;
      const inv = 1 / Math.sqrt(hx * hx + hy * hy + 1);
      let sh = 0.4 + 1.07 * (-hx * LX - hy * LY + LZ) * inv; sh = sh < 0.34 ? 0.34 : sh > 1.55 ? 1.55 : sh;
      const sp = (-hx * HX - hy * HY + HZ) * inv, spec = sp > 0.9 ? Math.pow(sp, 22) - 0.065 : 0;
      const tone = bil(cTone, i, j);
      let ar = 205 + 20 * tone, ag = 132 + 20 * tone, ab = 42 + 12 * tone;
      let cav = Cv[k]; cav = cav > 1 ? 1 : cav;
      ar *= 1 - 0.3 * cav; ag *= 1 - 0.45 * cav; ab *= 1 - 0.6 * cav;
      if (d < 64) { const pt = 1 - sstep(9, 64, d); ar *= 1 - 0.04 * pt; ag *= 1 - 0.1 * pt; ab *= 1 - 0.2 * pt; }   // handled, darker toward the edge
      let r, g, b;
      if (sh < 1) { r = ar * (1 - (1 - sh) * 0.8); g = ag * sh; b = ab * sh * sh; } else { r = ar * sh; g = ag * (1 + (sh - 1) * 0.92); b = ab * (1 + (sh - 1) * 1.1); }
      if (spec > 0) { r += spec * 46; g += spec * 36; b += spec * 20; }
      if (d < 6.2) { const eb = 1 - 0.56 * (1 - sstep(3.6, 6.2, d)); r *= eb; g *= eb * 0.92; b *= eb * 0.8; }   // burnished, darker cut edge
      const o = k * 4;
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
    }
  }
  const cnv = L.makeCanvas(RW, RH), g = cnv.getContext('2d');
  g.putImageData(img, 0, 0);
  // slow warm stains and a few faint scuffs
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.5;
  g.drawImage(L.noiseTex(RW, RH, { seed: 's13stain', scale: 300, octaves: 4, warp: 0.5, res: 0.2, ramp: [[0, '#c98d4e'], [0.5, '#ffffff'], [1, '#ffffff']] }), 0, 0);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  const rs = L.rng('s13scuff'); g.lineCap = 'round';
  for (let n = 0; n < 46; n++) {
    const x = rs.range(0, RW), y = rs.range(20, RH), ang = rs.range(-0.5, 0.5) + (rs.chance(0.3) ? 1.3 : 0), len = rs.range(18, 110), bend = rs.range(-10, 10);
    g.strokeStyle = `rgba(255,220,160,${rs.range(0.05, 0.16)})`; g.lineWidth = rs.range(0.6, 1.3);
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(ang) * len * 0.5 - Math.sin(ang) * bend, y + Math.sin(ang) * len * 0.5 + Math.cos(ang) * bend, x + Math.cos(ang) * len, y + Math.sin(ang) * len); g.stroke();
  }
  return { cnv, X0, Y0 };
}

// ───────────────────────── paper ─────────────────────────
function buildPaper(a) {
  const pw = W + PAD * 2, ph = Math.ceil(a.yAt(-PAD - 40)) + 70 + PAD;
  const c = L.paperTex(pw, ph, { base: '#dccfb3', seed: 's13paper', tone: '#927543', fiber: 0.8, stain: 0.28, grain: 0.2 });
  const g = c.getContext('2d'), r = L.rng('s13fibre');
  g.lineCap = 'round';
  for (let i = 0; i < 520; i++) {   // long plant fibres of a hand-made sheet
    const x = r() * pw, y = r() * ph, len = r.range(14, 74), ang = r() * Math.PI, bend = r.range(-14, 14);
    g.strokeStyle = r.chance(0.55) ? `rgba(252,246,228,${r.range(0.1, 0.34)})` : `rgba(138,112,66,${r.range(0.06, 0.2)})`;
    g.lineWidth = r.range(0.5, 1.4);
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(ang) * len * 0.5 - Math.sin(ang) * bend, y + Math.sin(ang) * len * 0.5 + Math.cos(ang) * bend, x + Math.cos(ang) * len, y + Math.sin(ang) * len); g.stroke();
  }
  L.speckle(g, { seed: 's13speck', count: 900, x: 0, y: 0, w: pw, h: ph, rMin: 0.4, rMax: 1.7, colors: ['#7d6338', '#5c4627', '#a58a56', '#f7f0dc'], alpha: [0.12, 0.5] });
  return c;
}

// ───────────────────────── edge of the leather ─────────────────────────
const NICKS = [[-742, 9, 4.2], [-388, 6, 3.0], [233, 7, 3.4], [700, 11, 4.4], [905, 6, 3]];   // [U, half width, depth]
function edgeOffset(nz, U) {
  let w = Math.max(0, nz.n2(U / 41, 1.3)) * 1.4 + Math.max(0, nz.n2(U / 8, 7.7) - 0.3) * 1.8;
  for (const [u, hw, dp] of NICKS) { const t = Math.abs(U - u) / hw; if (t < 1) w = Math.max(w, dp * (1 - t * t)); }
  const f = U - (FOLD_U - 34); if (f > 0 && f < 60) w = Math.max(w, (21 * f) / 60);   // the notch left by the dog-ear
  return w;
}
function edgePts(a) {
  const nz = L.makeNoise('s13edge'), s = a.span(PAD + 220), n = Math.ceil((2 * s * a.R) / 2), out = [];
  for (let i = 0; i <= n; i++) { const th = L.lerp(-s, s, i / n), p = a.pt(th, -edgeOffset(nz, th * a.R)); out.push([p.x, p.y]); }
  return out;
}
const traceEdge = (g, pts) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); };
function leatherPath(g, pts) { traceEdge(g, pts); g.lineTo(pts[pts.length - 1][0], H + PAD + 60); g.lineTo(pts[0][0], H + PAD + 60); g.closePath(); }

// ───────────────────────── needles ─────────────────────────
function needleList(a) {
  const s = a.span(PAD + 160), n = Math.ceil((s * a.R) / PITCH) + 1, r = L.rng('s13needles'), out = [];
  for (let i = -n; i < n; i++) {
    const th = ((i + 0.5) * PITCH) / a.R;
    const lxl = Math.cos(th) * LXS + Math.sin(th) * LYS, lyl = -Math.sin(th) * LXS + Math.cos(th) * LYS;   // light in the needle's own frame
    out.push({ th, ring: RING_D + r.range(-9, 10), tilt: r.range(-0.011, 0.011), lxl, lyl, hl: L.clamp(0.5 + 0.42 * lxl, 0.13, 0.42), ph: r() });
  }
  return out;
}
/** local frame of one needle: origin on the arc, +y runs down the needle toward the circle centre */
function inNeedle(g, a, nd, fn) {
  a.at(g, nd.th, 0, () => { g.translate(0, S1); g.rotate(nd.tilt); g.translate(0, -S1); fn(); });
}
function drawSlits(g, a, nd) {
  inNeedle(g, a, nd, () => {
    for (const s of [S1, S2, S3]) {
      g.fillStyle = 'rgba(60,26,2,0.28)'; g.beginPath(); g.ellipse(0, s, 15, 5, 0, 0, L.TAU); g.fill();
      g.fillStyle = 'rgba(30,12,1,0.94)'; g.beginPath(); g.ellipse(0, s, 11, 2.5, 0, 0, L.TAU); g.fill();
    }
    // lit lips of the slits (the side that faces the light)
    g.lineCap = 'round';
    for (const s of [S1, S2, S3]) { g.strokeStyle = 'rgba(255,214,140,0.5)'; g.lineWidth = 1.1; g.beginPath(); g.ellipse(0, s + 0.6, 12, 3.6, 0, 0.25, Math.PI - 0.25); g.stroke(); }
  });
}
function needleShadow(g, a, nd) {
  const top = nd.ring + RING_R - 2.2;
  g.save(); g.translate(6.2, 7.4);
  inNeedle(g, a, nd, () => {
    g.strokeStyle = '#2e1402'; g.lineWidth = 4.4; g.beginPath(); g.arc(0, nd.ring, RING_R - 1.7, 0, L.TAU); g.stroke();
    g.fillStyle = '#2e1402'; g.fillRect(-HW, top, HW * 2, H1 + 5 - top);
  });
  g.restore();
  g.save(); g.translate(3.0, 3.8);
  inNeedle(g, a, nd, () => { g.lineCap = 'butt'; line(g, 0, H1, 0, S1 - 2, 3.6, '#2e1402'); line(g, 0, S2 + 2, 0, S3 - 2, 3.6, '#2e1402'); });
  g.restore();
}
function drawNeedle(g, a, nd) {
  inNeedle(g, a, nd, () => {
    const top = nd.ring + RING_R - 2.2, hx = -HW + 2 * HW * nd.hl;
    // needle body: hair-thin, one cold white line of light
    const seg = (y0, y1) => {
      g.lineCap = 'butt';
      line(g, 0, y0, 0, y1, 3.1, '#a3acb2');
      line(g, 1.2, y0, 1.2, y1, 0.9, 'rgba(44,38,32,0.72)');
      line(g, -0.5, y0, -0.5, y1, 1.15, '#ffffff');
    };
    seg(H1 + 2, S1); seg(S2, S3);
    // wound-wire handle: one little rounded bar per turn of wire, lit as a cylinder
    const grad = L.linear(g, -HW, 0, HW, 0, [[0, '#2c3035'], [Math.max(0.03, nd.hl - 0.15), '#8b949a'], [nd.hl, '#ffffff'], [nd.hl + 0.11, '#e6ebee'], [0.6, '#b9c1c6'], [0.8, '#757d83'], [0.92, '#ab8452'], [1, '#48321c']]);
    g.fillStyle = '#22252a'; g.fillRect(-HW + 1.4, top, 2 * HW - 2.8, H1 - top);
    const TURN = 3.5;
    for (let y = top + TURN / 2; y < H1 + 9; y += TURN) {
      const k = y < H1 ? 1 : L.lerp(0.82, 0.36, (y - H1) / 9);   // the winding thins out at the needle root
      g.save(); g.translate(0, y); g.rotate(-0.13); g.scale(k, 1);
      g.fillStyle = grad; rrect(g, -HW - 0.2, -1.5, 2 * HW + 0.4, 3.0, 1.5); g.fill();
      g.restore();
    }
    // a string of tiny glints, one on every turn
    g.fillStyle = 'rgba(255,255,255,0.55)';
    for (let y = top + TURN / 2; y < H1; y += TURN) { g.beginPath(); g.ellipse(hx, y + 0.2, 1.5, 0.8, -0.13, 0, L.TAU); g.fill(); }
    // tail ring: the wire's end turned into a small loop
    const rc = RING_R - 1.7, yr = nd.ring;
    g.lineWidth = 3.5; g.strokeStyle = '#7a838a'; g.beginPath(); g.arc(0, yr, rc, 0, L.TAU); g.stroke();
    g.lineWidth = 1.1; g.strokeStyle = 'rgba(30,32,38,0.7)'; g.beginPath(); g.arc(-nd.lxl * 1.15, yr - nd.lyl * 1.15, rc, 0, L.TAU); g.stroke();
    g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,0.96)'; g.beginPath(); g.arc(nd.lxl * 0.95, yr + nd.lyl * 0.95, rc, 0, L.TAU); g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(nd.lxl * (rc + 0.6), yr + nd.lyl * (rc + 0.6), 2.1, 1.3, Math.atan2(nd.lyl, nd.lxl) + Math.PI / 2, 0, L.TAU); g.fill();
  });
}

// ───────────────────────── stitches & threads ─────────────────────────
function stitchKind(U0) {
  if (U0 > -84.5 && U0 < 11.5) return 'red';
  if (U0 > -204.5 && U0 < -156.5) return 'green';
  return 'flax';
}
function drawStitches(g, a) {
  const s = a.span(PAD + 180), k0 = Math.floor((-s * a.R - ST_OFF) / ST_P), k1 = Math.ceil((s * a.R - ST_OFF) / ST_P);
  for (let k = k0; k <= k1; k++) {
    a.at(g, (ST_OFF + k * ST_P) / a.R, -ST_D, () => {
      g.fillStyle = 'rgba(34,14,2,0.9)'; g.beginPath(); g.ellipse(0, 0, 3.7, 2.8, 0, 0, L.TAU); g.fill();
      g.strokeStyle = 'rgba(255,216,146,0.4)'; g.lineWidth = 1; g.beginPath(); g.ellipse(0.5, 0.8, 4.4, 3.4, 0, 0.2, 1.9); g.stroke();
    });
  }
  for (let k = k0; k < k1; k++) {
    const U0 = ST_OFF + k * ST_P, col = THREAD[stitchKind(U0)];
    a.at(g, (U0 + ST_P / 2) / a.R, -ST_D, () => {
      const x0 = -ST_P / 2 + 4.3, x1 = ST_P / 2 - 4.3, y0 = 1.3, y1 = -1.3;
      g.lineCap = 'round';
      line(g, x0 + 1.7, y0 + 2.4, x1 + 1.7, y1 + 2.4, 5.6, 'rgba(44,18,2,0.45)');
      line(g, x0, y0, x1, y1, 5.8, col.dark);
      line(g, x0 - 0.3, y0 - 0.6, x1 - 0.3, y1 - 0.6, 4.0, col.mid);
      line(g, x0 + 1, y0 - 1.6, x1 - 1, y1 - 1.6, 1.3, L.rgba(col.light, 0.7));
      g.lineCap = 'butt';
      for (let t = 0; t < 4; t++) { const x = L.lerp(x0, x1, (t + 0.5) / 4), y = L.lerp(y0, y1, (t + 0.5) / 4); line(g, x - 1.2, y + 2.3, x + 1.2, y - 2.3, 0.9, L.rgba(col.dark, 0.5)); }
    });
  }
}
const polarPts = (a, pts) => pts.map(([U, dr]) => { const p = a.pt(U / a.R, dr); return [p.x, p.y]; });
/** a loose twisted thread: g = colour target, sg = shadow target. o: {w, col, seed, crimp, lift(u), fray} */
function drawThread(g, sg, pts, o) {
  const P0 = L.smoothPath(pts, 2.5), n = P0.length, r = L.rng(o.seed), nz = L.makeNoise(o.seed), col = o.col;
  const P = [], T = [];
  for (let i = 0; i < n; i++) {
    const p = P0[Math.max(0, i - 1)], q = P0[Math.min(n - 1, i + 1)];
    let tx = q[0] - p[0], ty = q[1] - p[1]; const m = Math.hypot(tx, ty) || 1; tx /= m; ty /= m;
    // the kinks a thread keeps after it has been pulled out of its stitches
    const sl = i * 2.5, c = o.crimp * Math.sin((sl / ST_P) * Math.PI + 1.4 * nz.n2(sl / 70, 3.1)) * (0.6 + 0.4 * nz.n2(sl / 40, 9.7)) * sstep(0, 0.06, i / (n - 1));
    P.push([P0[i][0] - ty * c, P0[i][1] + tx * c]); T.push([tx, ty]);
  }
  sg.lineCap = 'butt';
  for (let i = 1; i < n; i++) {
    const lf = o.lift ? o.lift(i / (n - 1)) : 0, ox = 2.6 + lf * 15, oy = 3.4 + lf * 12;
    sg.strokeStyle = `rgba(46,24,6,${0.75 - 0.4 * lf})`; sg.lineWidth = o.w * (1 + 0.3 * lf);
    sg.beginPath(); sg.moveTo(P[i - 1][0] + ox, P[i - 1][1] + oy); sg.lineTo(P[i][0] + ox, P[i][1] + oy); sg.stroke();
  }
  const run = (dx, dy, lw, style) => { g.strokeStyle = style; g.lineWidth = lw; g.beginPath(); P.forEach((p, i) => (i ? g.lineTo(p[0] + dx, p[1] + dy) : g.moveTo(p[0] + dx, p[1] + dy))); g.stroke(); };
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  // stray fibres under the thread
  const hair = (i, len, spread, lw, style) => {
    const side = r.sign(), [tx, ty] = T[i], ang = Math.atan2(ty, tx) + side * r.range(0.35, spread), x0 = P[i][0] - ty * side * o.w * 0.35, y0 = P[i][1] + tx * side * o.w * 0.35;
    const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len, b = r.range(-0.35, 0.35) * len;
    g.strokeStyle = style; g.lineWidth = lw;
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 - Math.sin(ang) * b, (y0 + y1) / 2 + Math.cos(ang) * b, x1, y1); g.stroke();
  };
  for (let i = 3; i < n - 2; i++) if (r.chance(0.2)) hair(i, r.range(3, 9) * (1 + (o.lift ? o.lift(i / (n - 1)) : 0)), 1.2, r.range(0.5, 0.9), L.rgba(r.chance(0.5) ? col.mid : col.light, r.range(0.4, 0.85)));
  run(0, 0, o.w, col.dark); run(-0.5, -0.6, o.w * 0.68, col.mid); run(-1.25, -1.45, o.w * 0.22, L.rgba(col.light, 0.8));
  // the twist of the plies
  g.lineCap = 'butt'; g.lineWidth = 1; g.strokeStyle = L.rgba(col.dark, 0.55);
  for (let i = 1; i < n - 1; i += 2) {
    const [tx, ty] = T[i], dx = (tx * 0.53 - ty * 0.85) * o.w * 0.43, dy = (ty * 0.53 + tx * 0.85) * o.w * 0.43;
    g.beginPath(); g.moveTo(P[i][0] - dx, P[i][1] - dy); g.lineTo(P[i][0] + dx, P[i][1] + dy); g.stroke();
  }
  // frayed end: the plies open into a tuft of fluff
  g.lineCap = 'round';
  const [tx, ty] = T[n - 1], base = Math.atan2(ty, tx);
  for (let f = 0; f < o.fray; f++) {
    const i = n - 1 - r.int(0, 4), ang = base + r.range(-0.75, 0.75), len = r.range(0.25, 1) * o.frayLen, b = r.range(-0.3, 0.3) * len;
    const x0 = P[i][0], y0 = P[i][1], x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
    // shadow of the fluff
    sg.strokeStyle = 'rgba(46,24,6,0.3)'; sg.lineWidth = 1.2; const so = o.lift ? o.lift(1) : 0;
    sg.beginPath(); sg.moveTo(x0 + 2.6 + so * 15, y0 + 3.4 + so * 12); sg.lineTo(x1 + 2.6 + so * 15, y1 + 3.4 + so * 12); sg.stroke();
    g.strokeStyle = L.rgba(r.pick([col.mid, col.mid, col.light, col.dark]), r.range(0.55, 0.95)); g.lineWidth = r.range(0.7, 1.7);
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 - Math.sin(ang) * b, (y0 + y1) / 2 + Math.cos(ang) * b, x1, y1); g.stroke();
  }
  g.restore();
}

// ───────────────────────── the whole flat-lay, one layer ─────────────────────────
function buildScene(env, needles) {
  const a = env.arc;
  const lea = buildLeather(env), paper = buildPaper(a), edge = edgePts(a);
  const thF = FOLD_U / a.R, FA = [-34, 0], FC = [26, 21], FB = [12.9, 37.4];   // dog-ear: fold line FA–FC, folded tip FB

  // shadows cast on the leather by needles and the folded corner
  const sh1 = L.blurred(L.makeLayer(PAD, (g) => {
    for (const nd of needles) needleShadow(g, a, nd);
    g.save(); g.translate(3, 4.2);
    a.at(g, thF, 0, () => { g.fillStyle = '#2e1402'; g.beginPath(); g.moveTo(FA[0], FA[1]); g.lineTo(FC[0], FC[1]); g.lineTo(FB[0], FB[1]); g.closePath(); g.fill(); });
    g.restore();
  }), 3.2);

  const threadShadow = L.makeLayer(PAD);
  const tg = threadShadow.getContext('2d');
  const threads = L.makeLayer(PAD, (g) => {
    drawThread(g, tg, polarPts(a, [[-156, -ST_D], [-146, -46], [-128, -66], [-108, -98], [-100, -132], [-110, -158], [-132, -166]]),
      { w: 6.6, col: THREAD.green, seed: 's13green', crimp: 1.5, lift: (u) => 0.12 * sstep(0.6, 1, u), fray: 8, frayLen: 16 });
    drawThread(g, tg, polarPts(a, [[12, -ST_D], [21, -15], [17, 6], [3, 36], [-7, 74], [4, 112], [27, 146], [41, 184], [37, 220], [52, 256]]),
      { w: 8, col: THREAD.red, seed: 's13red', crimp: 2.2, lift: (u) => Math.pow(sstep(0.1, 1, u), 1.3), fray: 16, frayLen: 34 });
  });
  const sh2 = L.blurred(threadShadow, 3.4);

  return L.makeLayer(PAD, (g) => {
    // 1) paper
    g.drawImage(paper, -PAD, -PAD);
    // 2) the leather sits on it: a tight contact shadow hugging the edge
    g.lineJoin = 'round';
    for (const [lw, al] of [[22, 0.05], [12, 0.08], [6, 0.12], [2.6, 0.3]]) { g.strokeStyle = `rgba(74,46,14,${al})`; g.lineWidth = lw; traceEdge(g, edge); g.stroke(); }
    // 3) leather
    g.save(); leatherPath(g, edge); g.clip();
    g.drawImage(lea.cnv, lea.X0, lea.Y0);
    // worn spots where the dye has rubbed off the edge
    const rw = L.rng('s13wear');
    for (let i = 0; i < 26; i++) {
      const p = a.pt(rw.range(-0.36, 0.36), -rw.range(1, 7)), rad = rw.range(5, 14);
      g.fillStyle = L.radial(g, p.x, p.y, 0, rad, [[0, `rgba(246,204,136,${rw.range(0.25, 0.6)})`], [1, 'rgba(246,204,136,0)']]);
      g.fillRect(p.x - rad, p.y - rad, rad * 2, rad * 2);
    }
    // stitches, then everything that throws a shadow on the leather
    drawStitches(g, a);
    for (const nd of needles) drawSlits(g, a, nd);
    g.globalAlpha = 0.74; g.drawImage(sh1, -PAD, -PAD); g.globalAlpha = 1;
    g.restore();
    // 4) fuzz of loose fibres along the cut edge
    const rf = L.rng('s13fuzz'); g.lineCap = 'round';
    for (let i = 4; i < edge.length - 4; i += 2) {
      if (!rf.chance(0.3)) continue;
      const [x, y] = edge[i], pl = a.polar(x, y), ang = pl.theta - Math.PI / 2 + rf.range(-0.9, 0.9), len = rf.range(1.5, 5.5) * (rf.chance(0.06) ? 2.2 : 1);
      g.strokeStyle = L.rgba(rf.pick(['#c8842c', '#e6b46a', '#9a5e1c']), rf.range(0.4, 0.85)); g.lineWidth = rf.range(0.5, 1);
      g.beginPath(); g.moveTo(x, y + 0.8); g.quadraticCurveTo(x + Math.cos(ang) * len * 0.6 + rf.range(-1.5, 1.5), y + Math.sin(ang) * len * 0.6, x + Math.cos(ang) * len, y + Math.sin(ang) * len); g.stroke();
    }
    // 5) the dog-ear: a small corner of the edge folded over, pale flesh side up
    a.at(g, thF, 0, () => {
      const tri = () => { g.beginPath(); g.moveTo(FA[0], FA[1]); g.lineTo(FC[0], FC[1]); g.lineTo(FB[0], FB[1]); g.closePath(); };
      g.save(); tri(); g.clip();
      g.fillStyle = L.linear(g, 19.45, 18.7, FB[0], FB[1], [[0, '#f8e0b0'], [0.3, '#e6c088'], [1, '#cfa468']]); g.fillRect(-40, -5, 80, 50);
      L.speckle(g, { seed: 's13nap', count: 260, x: -36, y: -2, w: 66, h: 42, rMin: 0.3, rMax: 0.9, colors: ['#fff3d4', '#b88a50', '#a87a40'], alpha: [0.2, 0.6] });
      line(g, FA[0], FA[1], FB[0], FB[1], 6.5, 'rgba(122,66,16,0.9)');            // the burnished edge, now lying inside
      line(g, FC[0], FC[1], FB[0], FB[1], 1.6, 'rgba(110,60,16,0.6)');
      line(g, FA[0] - 0.5, FA[1] + 1.7, FC[0] - 0.5, FC[1] + 1.7, 2.2, 'rgba(255,246,220,0.8)');   // light on the rounded fold
      g.restore();
      line(g, FA[0], FA[1] - 0.6, FC[0], FC[1] - 0.6, 1.3, 'rgba(84,48,12,0.55)');
    });
    // 6) needles
    for (const nd of needles) drawNeedle(g, a, nd);
    // 7) the loose threads and their shadows
    g.globalAlpha = 0.6; g.drawImage(sh2, -PAD, -PAD); g.globalAlpha = 1;
    g.drawImage(threads, -PAD, -PAD);
    // 8) light: a warm pool from the upper left, the roll falling away toward the bottom of frame
    g.globalCompositeOperation = 'soft-light';
    g.fillStyle = L.radial(g, a.cx - 300, a.crestY - 40, 160, 1500, [[0, 'rgba(255,240,206,0.22)'], [0.5, 'rgba(255,236,200,0.04)'], [1, 'rgba(70,34,0,0.3)']]);
    g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 760, a.R - 300, [[0, 'rgba(150,84,30,1)'], [1, 'rgba(255,255,255,1)']]);
    g.save(); a.clipBelow(g, -200); g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2); g.restore();
    g.globalCompositeOperation = 'source-over';
  });
}

export default {
  name: '针包',
  tone: 'dark',
  init(env) {
    const needles = needleList(env.arc);
    S = { needles, scene: buildScene(env, needles) };
  },
  draw(ctx, env, p) {
    const a = env.arc;
    // the whole flat-lay slides ~1.5° along the arc, with a breath of push-in
    const rot = L.lerp(-0.013, 0.013, p), zoom = L.lerp(1.0, 1.012, p);
    L.blit(ctx, env, S.scene, { rot, zoom });
    // warm light drifting over the leather
    ctx.save(); a.clipBelow(ctx, -2);
    const gp = a.pt(L.lerp(-0.2, 0.06, p), -200);
    L.glow(ctx, gp.x, gp.y, 600, '#ffc680', 0.1);
    ctx.restore();
    // a glint runs down the row, needle by needle
    const ts = L.lerp(-0.22, 0.22, p);
    L.cam(ctx, env, { rot, zoom }, () => {
      ctx.globalCompositeOperation = 'screen';
      for (const nd of S.needles) {
        const dl = (nd.th + rot - ts) / 0.046, k = Math.exp(-dl * dl);
        if (k < 0.03) continue;
        inNeedle(ctx, a, nd, () => {
          const top = nd.ring + RING_R - 2.2, hx = -HW + 2 * HW * nd.hl, yk = L.clamp(L.lerp(top, H1, 0.38) + dl * 34, top + 12, H1 - 12), u = (yk - top) / (H1 - top);
          ctx.fillStyle = L.radial(ctx, hx, yk, 0, 52, [[0, `rgba(226,240,255,${0.5 * k})`], [0.25, `rgba(214,232,255,${0.17 * k})`], [1, 'rgba(210,230,255,0)']]);
          ctx.fillRect(hx - 52, yk - 52, 104, 104);
          ctx.fillStyle = L.linear(ctx, 0, top, 0, H1, [[0, 'rgba(255,255,255,0)'], [Math.max(0.02, u - 0.3), `rgba(255,255,255,${0.25 * k})`], [u, `rgba(255,255,255,${k})`], [Math.min(0.98, u + 0.3), `rgba(255,255,255,${0.25 * k})`], [1, 'rgba(255,255,255,0)']]);
          ctx.fillRect(hx - 2, top, 4, H1 - top);
          // the needle body catches it too
          ctx.fillStyle = `rgba(255,255,255,${0.9 * k})`;
          ctx.fillRect(-1.4, H1 + 4, 2.2, S1 - H1 - 5); ctx.fillRect(-1.4, S2 + 1, 2.2, S3 - S2 - 2);
          // and the tail ring throws a small star
          const sx = nd.lxl * (RING_R - 1.2), sy = nd.ring + nd.lyl * (RING_R - 1.2);
          ctx.fillStyle = L.radial(ctx, sx, sy, 0, 20, [[0, `rgba(255,255,255,${0.95 * k})`], [0.2, `rgba(230,242,255,${0.4 * k})`], [1, 'rgba(220,236,255,0)']]);
          ctx.fillRect(sx - 20, sy - 20, 40, 40);
          ctx.strokeStyle = `rgba(255,255,255,${0.7 * k})`; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(sx - 15, sy); ctx.lineTo(sx + 15, sy); ctx.moveTo(sx, sy - 15); ctx.lineTo(sx, sy + 15); ctx.stroke();
        });
      }
    });
  },
};
