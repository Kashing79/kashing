// s06 — 螺钿. Macro of a black-lacquer round box inlaid with thin mother-of-pearl (薄螺钿):
// the arc is the outer rim of the gently domed lid. Below it the jet lacquer is packed with a scrolling-vine
// (缠枝) design cut from hundreds of little shell pieces; above it, nothing but black and a hair of cool rim light.
//
// How it is built (all in init):
//   1. the design is laid out on the unrolled lid surface (U = px along the rim, S = px in from the rim):
//      a bead-and-fillet border, then rows of wave stems; every lobe carries a spiral branch ending in a flower,
//      and leaves / tendrils are packed into whatever room is left with an occupancy grid, so pieces never touch
//      and a hairline of lacquer always shows between them;
//   2. every piece is mapped onto the dome (foreshortened where the shoulder rolls away at the rim) and drawn into
//      a mask whose channels carry coverage / the piece's own iridescence phase / its brightness;
//   3. one per-pixel pass turns that into shell + lacquer with lighting, and bakes K copies whose thin-film phase
//      is shifted step by step — the shot plays them back, so blue-green and pink-violet trade places in 6 frames.
import * as L from '../../../lib/core.js';

const { W, H, TAU, clamp, lerp } = L;
const PAD = 56, PADB = 28;     // the pattern only slides ~9 px, so the layers need very little margin
const K = 6;                   // iridescence phase steps (one per frame of this 6-frame shot)
const SHIFT0 = -0.05, SHIFT1 = 0.45;   // phase travel across the shot: half a cycle
const FA = 70, FB = 40;        // extra foreshortening of the rolled shoulder close to the rim
const FIELD_TOP = 100;         // S where the vine field starts (the border lives above it)
const UMAX = 1300, SLIM = 1000;
let S = null;

const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const hash = (x, y) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

// ───────────── surface ⇄ screen ─────────────
// S(d): surface distance from the rim for a point d px below the arc. Log term = conformal unrolling of the disc
// (keeps flowers round at any depth); the exp term squeezes the pattern where the shoulder turns away from the lens.
const sOfD = (d, R) => -R * Math.log(1 - d / R) + FA * (1 - Math.exp(-d / FB));
function makeInv(R) {
  const STEP = 0.5, n = Math.ceil(SLIM / STEP) + 3, lut = new Float32Array(n);
  let d = 0;
  for (let i = 0; i < n; i++) { const target = i * STEP; while (sOfD(d, R) < target) d += 0.02; lut[i] = d; }
  return (s) => { const f = clamp(s, 0, SLIM) / STEP, i = f | 0; return lut[i] + (lut[i + 1] - lut[i]) * (f - i); };
}

// ───────────── packing helpers ─────────────
function occGrid(u0, u1, s0, s1, cell) {
  const gw = Math.ceil((u1 - u0) / cell), gh = Math.ceil((s1 - s0) / cell), g = new Uint8Array(gw * gh);
  const run = (u, s, r, set) => {
    const i0 = Math.max(0, Math.floor((u - r - u0) / cell)), i1 = Math.min(gw - 1, Math.floor((u + r - u0) / cell));
    const j0 = Math.max(0, Math.floor((s - r - s0) / cell)), j1 = Math.min(gh - 1, Math.floor((s + r - s0) / cell));
    const r2 = r * r;
    for (let j = j0; j <= j1; j++) {
      const ds = s0 + (j + 0.5) * cell - s;
      for (let i = i0; i <= i1; i++) {
        const du = u0 + (i + 0.5) * cell - u;
        if (du * du + ds * ds > r2) continue;
        if (set) g[j * gw + i] = 1; else if (g[j * gw + i]) return true;
      }
    }
    return false;
  };
  return {
    hit: (u, s, r) => run(u, s, r, false),
    stamp: (u, s, r) => { run(u, s, r, true); },
    fillBand: (sa, sb) => { const j0 = Math.max(0, Math.floor((sa - s0) / cell)), j1 = Math.min(gh, Math.ceil((sb - s0) / cell)); g.fill(1, j0 * gw, j1 * gw); },
  };
}
function sampler(pts) {
  const n = pts.length, cum = new Float32Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let j = 1;
  const at = (q) => {
    if (q < cum[j - 1]) j = 1;
    while (j < n - 1 && cum[j] < q) j++;
    const a = pts[j - 1], b = pts[j], seg = cum[j] - cum[j - 1] || 1, t = clamp((q - cum[j - 1]) / seg);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (b[0] - a[0]) / seg, (b[1] - a[1]) / seg];
  };
  return { total: cum[n - 1], at };
}
/** cut a path into a run of separate shell strips (each its own piece, hairline gaps between) */
function ribbon(out, pts, wFn, o) {
  const sp = sampler(pts), total = sp.total, { rnd, gap = 1.9, phJ = 0.06, step = 3 } = o;
  let q0 = 0;
  while (q0 < total - 3) {
    let q1 = q0 + rnd.range(o.segMin, o.segMax);
    if (total - q1 < o.segMin * 0.6) q1 = total;
    const left = [], right = [], m = Math.max(1, Math.ceil((q1 - q0) / step));
    for (let i = 0; i <= m; i++) {
      const q = q0 + ((q1 - q0) * i) / m, s = sp.at(q), hw = wFn(q / total) / 2;
      left.push([s[0] - s[3] * hw, s[1] + s[2] * hw]); right.push([s[0] + s[3] * hw, s[1] - s[2] * hw]);
    }
    right.reverse();
    out.push({ poly: left.concat(right), ph: o.ph + rnd.range(-phJ, phJ), br: rnd.range(0.8, 1) });
    q0 = q1 + gap;
  }
}
function circlePoly(u, s, r, n = 16, squash = 1) {
  const p = [];
  for (let i = 0; i < n; i++) p.push([u + Math.cos((i / n) * TAU) * r, s + Math.sin((i / n) * TAU) * r * squash]);
  return p;
}
/** one ring of petals, each its own piece. tip: 0 = round scallop … 1 = pointed */
function petalRing(out, cu, cs, rin, rout, n, rot, tip, rnd, ph) {
  for (let i = 0; i < n; i++) {
    const pc = rot + (i * TAU) / n, poly = [], M = 8;
    for (let q = 0; q <= M; q++) {
      const aN = -1 + (2 * q) / M;
      const side = rin + (rout - rin) * (0.62 - 0.14 * tip);
      const ro = side + (rout - side) * (tip > 0.5 ? Math.pow(1 - Math.abs(aN), 0.8) : Math.cos((aN * Math.PI) / 2));
      const ha = Math.max(0.03, Math.PI / n - 0.95 / ro);
      poly.push([cu + Math.cos(pc + aN * ha) * ro, cs + Math.sin(pc + aN * ha) * ro]);
    }
    const hi = Math.max(0.03, Math.PI / n - 0.95 / rin);
    for (let q = 2; q >= 0; q--) { const aN = -1 + q; poly.push([cu + Math.cos(pc + aN * hi) * rin, cs + Math.sin(pc + aN * hi) * rin]); }
    out.push({ poly, ph: ph + rnd.range(-0.045, 0.045), br: rnd.range(0.86, 1) });
  }
}
/** a little flower built from separate shell pieces. type 0 = chrysanthemum (many narrow petals), 1 = double flower (round inner ring, pointed outer ring), 2 = five-petal blossom */
function flower(out, cu, cs, rf, type, rot, rnd, ph) {
  if (type === 0) {
    const rin = rf * 0.34;
    out.push({ poly: circlePoly(cu, cs, Math.max(1.6, rin - 1.9), 14), ph: ph + 0.1, br: 1 });
    petalRing(out, cu, cs, rin, rf, rf > 21 ? 12 : 10, rot, 0, rnd, ph);
  } else if (type === 1) {
    const r0 = rf * 0.2, r1 = rf * 0.56;
    out.push({ poly: circlePoly(cu, cs, Math.max(1.5, r0 - 1.8), 12), ph: ph + 0.16, br: 1 });
    petalRing(out, cu, cs, r0, r1, 6, rot, 0, rnd, ph + 0.07);
    petalRing(out, cu, cs, r1 + 1.9, rf, 8, rot + Math.PI / 8, 1, rnd, ph - 0.03);
  } else {
    const rin = rf * 0.33;
    out.push({ poly: circlePoly(cu, cs, Math.max(1.6, rin - 1.9), 14), ph: ph + 0.14, br: 1 });
    petalRing(out, cu, cs, rin, rf, 5, rot, 0, rnd, ph);
  }
}

// ───────────── the design, on the unrolled surface ─────────────
function design() {
  const pieces = [], glints = [];
  const rnd = L.rng('s06-luodian');
  const occStem = occGrid(-UMAX - 40, UMAX + 40, 0, SLIM, 2), occLeaf = occGrid(-UMAX - 40, UMAX + 40, 0, SLIM, 2);
  occStem.fillAbove(FIELD_TOP - 8); occLeaf.fillAbove(FIELD_TOP - 8);

  // 1) border hugging the rim: fillet – pearl beads (连珠) – fillet
  const line = (sv) => { const p = []; for (let u = -UMAX; u <= UMAX; u += 6) p.push([u, sv]); return p; };
  ribbon(pieces, line(20), () => 14, { rnd, segMin: 44, segMax: 92, gap: 2.2, ph: 0.12, phJ: 0.22 });
  ribbon(pieces, line(80), () => 11, { rnd, segMin: 40, segMax: 84, gap: 2.2, ph: 0.06, phJ: 0.2 });
  for (let u = -UMAX, i = 0; u <= UMAX; u += 31, i++) {
    pieces.push({ poly: circlePoly(u, 51, 12.4, 18), ph: 0.36 + rnd.range(-0.26, 0.26), br: rnd.range(0.86, 1) });
    if (i % 3 === 0) glints.push({ u, s: 49, k: rnd.range(0.3, 0.6), ph: rnd() });
  }

  // 2) rows of wave stems; each lobe holds a spiral branch that ends in a flower
  // two fine rows under the border, a narrow bead-and-fillet divider, then the larger main field
  const rows = [];
  let top = FIELD_TOP;
  for (const hb of [102, 119]) { rows.push({ top, hb, sc: top + hb / 2 }); top += hb; }
  const DIV = top + 2;
  occStem.fillBand(DIV - 3, DIV + 43); occLeaf.fillBand(DIV - 3, DIV + 43);
  ribbon(pieces, line(DIV + 5), () => 7, { rnd, segMin: 40, segMax: 80, gap: 2, ph: 0.08, phJ: 0.2 });
  ribbon(pieces, line(DIV + 35), () => 7, { rnd, segMin: 40, segMax: 80, gap: 2, ph: 0.08, phJ: 0.2 });
  for (let u = -UMAX; u <= UMAX; u += 19) pieces.push({ poly: circlePoly(u, DIV + 20, 7, 14), ph: 0.4 + rnd.range(-0.24, 0.24), br: rnd.range(0.86, 1) });
  top = DIV + 48;
  for (let hb = 150; top < 800; top += hb, hb *= 1.15) rows.push({ top, hb, sc: top + hb / 2 });
  const sites = [];
  const OFF = [0.31, 0.77, 0.12, 0.58, 0.9, 0.4];
  rows.forEach((row, j) => {
    const { hb, sc } = row, lam = 1.9 * hb, A = 0.33 * hb, u0 = OFF[j % OFF.length] * lam, ws = 0.058 * hb;
    row.lam = lam; row.A = A; row.u0 = u0; row.ws = ws;
    const pts = [];
    for (let u = -UMAX; u <= UMAX; u += 2.5) pts.push([u, sc + A * Math.sin((TAU * (u - u0)) / lam)]);
    for (const p of pts) occStem.stamp(p[0], p[1], ws / 2 + 0.4);
    ribbon(pieces, pts, () => ws, { rnd, segMin: 0.2 * hb, segMax: 0.36 * hb, ph: 0.0, phJ: 0.06 });
    const sp = sampler(pts);
    for (let q = rnd.range(0, 0.1) * hb; q < sp.total; q += 0.105 * hb * rnd.range(0.9, 1.1)) {
      const s = sp.at(q); sites.push({ x: s[0], y: s[1], tx: s[2], ty: s[3], ws, hb });
    }
  });
  rows.forEach((row, j) => {
    const { hb, sc, lam, A, u0, ws } = row;
    const k0 = Math.floor((-UMAX - u0) / (lam / 2)) - 1, k1 = Math.ceil((UMAX - u0) / (lam / 2)) + 1;
    for (let k = k0; k <= k1; k++) {
      const um = u0 + lam / 4 + (k * lam) / 2;
      if (Math.abs(um) > UMAX - 20) continue;
      const sign = ((k % 2) + 2) % 2 === 0 ? 1 : -1;         // +1: the stem dips under the flower, −1: it arches over it
      const cu = um, cs = sc - sign * 0.1 * hb;
      const ub = um + 0.15 * lam, sb = sc + A * Math.sin((TAU * (ub - u0)) / lam);
      const phiB = Math.atan2(sb - cs, ub - cu), rb = Math.hypot(ub - cu, sb - cs);
      const DEL = 1.7 * Math.PI, wEnd = ws * 0.55;
      let placed = null;
      for (const [fs, ex] of [[1, 0.9], [0.9, 0.62], [0.8, 0.42]]) {
        const rf = 0.19 * hb * fs, rEnd = rf + 2.4 + wEnd / 2;
        const n = Math.ceil((rb * DEL) / 2.4), sp = [];
        let ok = !occStem.hit(cu, cs, rf + 2.2);
        for (let i = 0; i <= n && ok; i++) {
          const t = i / n, phi = phiB - sign * DEL * t, r = rb + (rEnd - rb) * Math.pow(t, ex);
          const p = [cu + r * Math.cos(phi), cs + r * Math.sin(phi)];
          sp.push(p);
          if (t >= 0.14 && occStem.hit(p[0], p[1], (ws * (1 - 0.45 * t)) / 2 + 2.2)) ok = false;
        }
        if (ok) { placed = { sp, rf }; break; }
      }
      if (!placed) continue;
      const { sp, rf } = placed, wOf = (t) => ws * (1 - 0.45 * t);
      sp.forEach((p, i) => occStem.stamp(p[0], p[1], wOf(i / (sp.length - 1)) / 2 + 0.4));
      occStem.stamp(cu, cs, rf + 0.3); occLeaf.stamp(cu, cs, rf + 0.3);
      ribbon(pieces, sp, wOf, { rnd, segMin: 0.2 * hb, segMax: 0.34 * hb, ph: 0.03, phJ: 0.06 });
      const type = (((k + j) % 3) + 3) % 3;
      flower(pieces, cu, cs, rf, type, rnd.range(0, TAU), rnd, 0.5 + rnd.range(-0.04, 0.04));
      glints.push({ u: cu, s: cs, k: rnd.range(0.6, 1), ph: rnd() });
      const sm = sampler(sp);
      for (let q = 0.2 * sm.total; q < sm.total * 0.97; q += 0.105 * hb * rnd.range(0.9, 1.1)) {
        const s = sm.at(q); sites.push({ x: s[0], y: s[1], tx: s[2], ty: s[3], ws: wOf(q / sm.total), hb });
      }
    }
  });

  // 3) pack leaves, then curling tendrils, into the free lacquer — biggest first
  const leafW = (t, wmax) => wmax * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.62)), 0.85);
  const tryGrow = (st, side, len, lean, curl, kind) => {
    const nx = -st.ty * side, ny = st.tx * side;
    const off = st.ws / 2 + 2.3, bx = st.x + nx * off, by = st.y + ny * off;
    const h0 = Math.atan2(st.ty, st.tx) + side * lean;
    const N = kind === 'leaf' ? 10 : 14, ds = len / N;
    const wmax = kind === 'leaf' ? Math.min(len * 0.4, 0.125 * st.hb) : Math.max(3.1, 0.03 * st.hb);
    const wAt = (t) => (kind === 'leaf' ? leafW(t, wmax) : wmax * (1 - 0.5 * t));
    const sp = [];
    let x = bx, y = by;
    for (let i = 0; i <= N; i++) {
      sp.push([x, y]);
      const t = (i + 0.5) / N, h = h0 + side * curl * (kind === 'leaf' ? t : Math.pow(t, 1.5));
      x += Math.cos(h) * ds; y += Math.sin(h) * ds;
    }
    for (let i = 0; i <= N; i++) {
      const t = i / N; if (t < 0.18) continue;
      const w = wAt(t), p = sp[i], rad = w / 2 + 2.1;
      const perp = (p[0] - st.x) * nx + (p[1] - st.y) * ny;
      if (perp < st.ws / 2 + w / 2 + 2.3) {            // still alongside the parent stem
        if (t > 0.36) return false;
        if (occLeaf.hit(p[0], p[1], w / 2 + 1.5)) return false;
        continue;
      }
      if (occLeaf.hit(p[0], p[1], rad) || occStem.hit(p[0], p[1], rad)) return false;
    }
    const left = [], right = [], midL = [], midR = [];
    const split = kind === 'leaf' && wmax > 9.5;       // big leaves are two pieces of shell meeting along the midrib
    for (let i = 0; i <= N; i++) {
      const a = sp[Math.max(0, i - 1)], b = sp[Math.min(N, i + 1)], m = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const px = -(b[1] - a[1]) / m, py = (b[0] - a[0]) / m, hw = wAt(i / N) / 2, g = Math.min(0.85, hw * 0.5);
      left.push([sp[i][0] + px * hw, sp[i][1] + py * hw]); right.push([sp[i][0] - px * hw, sp[i][1] - py * hw]);
      midL.push([sp[i][0] + px * g, sp[i][1] + py * g]); midR.push([sp[i][0] - px * g, sp[i][1] - py * g]);
      occLeaf.stamp(sp[i][0], sp[i][1], Math.max(1.2, hw + 0.3));
    }
    const ph = (kind === 'leaf' ? 0.11 : 0.02) + rnd.range(-0.09, 0.09), br = rnd.range(0.78, 1);
    if (split) {
      midL.reverse(); right.reverse();
      pieces.push({ poly: left.concat(midL), ph: ph + 0.035, br });
      pieces.push({ poly: midR.reverse().concat(right), ph: ph - 0.035, br: br * 0.93 });
    } else { right.reverse(); pieces.push({ poly: left.concat(right), ph, br }); }
    return true;
  };
  const LEAF = [[0.95, -0.9], [1.3, -0.5], [0.8, 0.5], [1.15, 0.9], [1.0, -1.2]];
  const CURL = [[1.0, 3.3], [1.25, -3.3], [0.85, 2.6], [1.3, -2.6]];
  for (const f of [0.36, 0.29, 0.22, 0.165, 0.12]) {
    for (const st of sites) for (const side of [1, -1]) {
      const key = side > 0 ? 'a' : 'b'; if (st[key]) continue;
      const len = f * st.hb * rnd.range(0.9, 1.08), v0 = rnd.int(0, LEAF.length - 1);
      for (let v = 0; v < LEAF.length; v++) {
        const [lean, curl] = LEAF[(v0 + v) % LEAF.length];
        if (tryGrow(st, side, len, lean, curl, 'leaf')) { st[key] = 1; break; }
      }
    }
  }
  for (const f of [0.34, 0.24]) {
    for (const st of sites) for (const side of [1, -1]) {
      const key = side > 0 ? 'a' : 'b'; if (st[key]) continue;
      const len = f * st.hb, v0 = rnd.int(0, CURL.length - 1);
      for (let v = 0; v < CURL.length; v++) {
        const [lean, curl] = CURL[(v0 + v) % CURL.length];
        if (tryGrow(st, side, len, lean, curl, 'curl')) { st[key] = 1; break; }
      }
    }
  }
  return { pieces, glints };
}

// ───────────── light on the dome (screen-fixed) ─────────────
function lightAt(th, d) {
  const hu = (th - 0.12) / 0.2, hd = (d - 235) / 150;
  const main = Math.exp(-(hu * hu + hd * hd));                      // the soft volume highlight, centre-right
  const lt = (th - 0.1) / 0.3;
  const limb = Math.exp(-d / 42) * (0.3 + 0.6 * Math.exp(-lt * lt)); // grazing sheen where the shoulder turns away
  const au = (th - 0.13) / 0.55, ad = (d - 200) / 420;
  return { main, limb, hl: 1 - (1 - main) * (1 - limb), l: 0.66 + 0.34 * Math.exp(-(au * au + ad * ad)) };
}

function build(env) {
  const a = env.arc, R = a.R, cx = a.cx, cy = a.cy;
  const X0 = -PAD, Y0 = Math.floor(a.crestY) - 3;
  const RW = W + PAD * 2, RH = H + PADB - Y0, N = RW * RH;
  const dOfS = makeInv(R);
  const toXY = (u, s) => { const rr = R - dOfS(s), th = u / R; return [cx + rr * Math.sin(th), cy - rr * Math.cos(th)]; };

  // mask: R = coverage, G = piece phase, B = piece brightness
  const { pieces, glints } = design();
  const mask = L.makeCanvas(RW, RH), mg = mask.getContext('2d', { willReadFrequently: true });
  mg.fillStyle = '#000'; mg.fillRect(0, 0, RW, RH);
  mg.translate(-X0, -Y0);
  for (const pc of pieces) {
    const ph = ((pc.ph % 1) + 1) % 1;
    mg.fillStyle = `rgb(255,${Math.round(ph * 255)},${Math.round(pc.br * 255)})`;
    mg.beginPath();
    for (let i = 0; i < pc.poly.length; i++) { const p = toXY(pc.poly[i][0], pc.poly[i][1]); if (i) mg.lineTo(p[0], p[1]); else mg.moveTo(p[0], p[1]); }
    mg.closePath(); mg.fill();
  }
  const md = mg.getImageData(0, 0, RW, RH).data;

  // slow "which colour is this patch of shell" field, on a coarse grid
  const nz = L.makeNoise('s06'), CS = 8, cw = Math.ceil(RW / CS) + 2, ch = Math.ceil(RH / CS) + 2, zone = new Float32Array(cw * ch);
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const ddx = X0 + i * CS - cx, ddy = cy - (Y0 + j * CS), rr = Math.hypot(ddx, ddy), d = Math.max(0, R - rr);
    zone[j * cw + i] = nz.fbm((Math.atan2(ddx, ddy) * R) / 560 + 3.1, sOfD(d, R) / 330 - 1.7, 3);
  }

  // thin-film colour wheel
  const LN = 1024, rampF = L.makeRamp([[0, '#2f8fd0'], [0.14, '#27b6d8'], [0.3, '#3fd0a0'], [0.4, '#8ff0c8'], [0.48, '#f2f6ff'],
    [0.56, '#f7b4e6'], [0.68, '#e07ac8'], [0.8, '#a45fe0'], [0.9, '#4a66de'], [1, '#2f8fd0']]), LUT = new Float32Array(LN * 3);
  for (let i = 0; i < LN; i++) { const c = rampF(i / LN); LUT[i * 3] = c[0]; LUT[i * 3 + 1] = c[1]; LUT[i * 3 + 2] = c[2]; }

  const idx = new Uint16Array(N), mulc = new Float32Array(N), ar = new Float32Array(N), ag = new Float32Array(N), ab = new Float32Array(N), al = new Uint8ClampedArray(N);
  for (let j = 0; j < RH; j++) {
    const ddy = cy - (Y0 + j + 0.5), jm = j > 0 ? -RW : 0, jp = j < RH - 1 ? RW : 0;
    for (let i = 0; i < RW; i++) {
      const k = j * RW + i, ddx = X0 + i + 0.5 - cx, rr = Math.sqrt(ddx * ddx + ddy * ddy), edge = R - rr + 0.5;
      if (edge <= 0) continue;
      al[k] = edge >= 1 ? 255 : edge * 255;
      const d = Math.max(0, R - rr), th = Math.atan2(ddx, ddy);
      const lg = lightAt(th, d), hl = lg.hl;
      // lacquer: jet black, a breath of blue-grey sheen inside the highlight, a cold lip of light right at the rim
      const rt = (th - 0.1) / 0.32;
      const sheen = Math.pow(lg.main, 1.4), rimI = Math.exp(-d / 5.5) * (0.45 + 0.55 * Math.exp(-rt * rt));
      let lr = 8 + 24 * sheen + 12 * lg.limb + 110 * rimI, lgc = 7 + 32 * sheen + 20 * lg.limb + 160 * rimI, lb = 10 + 50 * sheen + 36 * lg.limb + 225 * rimI;
      const o = k * 4, cR = md[o];
      if (cR < 8) { ar[k] = lr; ag[k] = lgc; ab[k] = lb; continue; }
      const cov = cR / 255, ph0 = md[o + 1] / cR, br = Math.min(1, md[o + 2] / cR);
      const U = th * R, Sv = sOfD(d, R);
      const fx = (i + PAD * 0) / CS, fy = j / CS, i0 = fx | 0, j0 = fy | 0, tx = fx - i0, ty = fy - j0, zk = j0 * cw + i0;
      const zn = (zone[zk] + (zone[zk + 1] - zone[zk]) * tx) * (1 - ty) + (zone[zk + cw] + (zone[zk + cw + 1] - zone[zk + cw]) * tx) * ty;
      const band = nz.n2(U / 24, Sv / 7), fine = nz.n2(U / 6.5 + 11, Sv / 6.5 + 5), lus = nz.n2(U / 10 + 40, Sv / 3.6);
      let phase = ph0 + 0.62 * zn + 0.085 * band + 0.04 * fine;
      phase -= Math.floor(phase);
      idx[k] = (phase * LN) | 0;
      const h1 = hash(i, j), h2 = hash(i >> 1, (j >> 1) + 7919);
      // bevel: the upper-left edge of every piece catches the light, the lower-right edge sinks
      const e = (md[o - 4 * (i > 0 ? 1 : 0) + jm * 4] - md[o + 4 * (i < RW - 1 ? 1 : 0) + jp * 4]) / 255;
      const m = br * lg.l * (0.88 + 0.16 * lus) * (0.9 + 0.2 * h1) * (1 - 0.4 * Math.max(0, e));
      const w = 0.8 * Math.pow(hl, 1.1);
      mulc[k] = cov * m * (1 - w);
      const glit = h2 > 0.986 - 0.03 * hl ? 70 + 120 * hl : 0;
      const up = Math.max(0, -e) * 62 + glit, pw = w * (0.93 + 0.07 * lus) * (0.94 + 0.12 * h1);
      ar[k] = cov * (242 * pw + up) + (1 - cov) * lr;
      ag[k] = cov * (246 * pw + up) + (1 - cov) * lgc;
      ab[k] = cov * (255 * pw + up) + (1 - cov) * lb;
    }
  }

  const layers = [];
  for (let q = 0; q < K; q++) {
    const sh = Math.round((((lerp(SHIFT0, SHIFT1, q / (K - 1)) % 1) + 1) % 1) * LN);
    const img = new ImageData(RW, RH), dd = img.data;
    for (let k = 0; k < N; k++) {
      const A = al[k]; if (!A) continue;
      const o = k * 4, m = mulc[k];
      if (m > 0) {
        const li = ((idx[k] + sh) % LN) * 3;
        dd[o] = LUT[li] * m + ar[k]; dd[o + 1] = LUT[li + 1] * m + ag[k]; dd[o + 2] = LUT[li + 2] * m + ab[k];
      } else { dd[o] = ar[k]; dd[o + 1] = ag[k]; dd[o + 2] = ab[k]; }
      dd[o + 3] = A;
    }
    const c = L.makeCanvas(RW, RH); c.getContext('2d').putImageData(img, 0, 0);
    layers.push(c);
  }

  // bloom: a quarter-size blurred copy (with head-room above the rim so the glow can spill over it)
  const UP = 72, bw = Math.ceil(RW / 4), bh = Math.ceil((RH + UP) / 4);
  const bloom = L.makeCanvas(bw, bh), bg = bloom.getContext('2d');
  bg.filter = 'blur(4.5px) brightness(1.15)';
  bg.drawImage(layers[K >> 1], 0, UP / 4, RW / 4, RH / 4);
  bg.filter = 'none';

  // pin-point glints: flower hearts and border pearls that sit in the light
  const gl = [];
  for (const g of glints) {
    const p = toXY(g.u, g.s); if (p[0] < -20 || p[0] > W + 20 || p[1] > H + 10) continue;
    const pol = a.polar(p[0], p[1]), lg = lightAt(pol.theta, -pol.dr);
    if (lg.hl < 0.22) continue;
    gl.push({ x: p[0], y: p[1], k: g.k * Math.min(1, lg.hl * 1.3), ph: g.ph });
  }
  return { layers, bloom, gl, X0, Y0, RW, RH, UP };
}

export default {
  name: '螺钿',
  tone: 'light',
  init(env) { S = build(env); },
  draw(ctx, env, p) {
    const a = env.arc;
    ctx.fillStyle = '#08070a'; ctx.fillRect(0, 0, W, H);

    // a hair of cold light standing off the rim
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const [w, al] of [[3, 0.2], [7, 0.13], [14, 0.09], [26, 0.06], [48, 0.035]]) {
      ctx.strokeStyle = L.linear(ctx, 0, 0, W, 0, [[0, L.rgba('#5f9cff', al * 0.4)], [0.58, L.rgba('#8fc0ff', al)], [1, L.rgba('#5f9cff', al * 0.55)]]);
      ctx.lineWidth = w; a.stroke(ctx, w / 2 - 0.5);
    }
    ctx.restore();

    // the lid: pattern slides a few px along the rim while the shell's colours roll through half a cycle
    const rot = lerp(-0.0045, 0.0045, p);
    const f = clamp(p) * (K - 1), i0 = Math.min(K - 2, Math.floor(f)), fr = f - i0;
    ctx.save();
    ctx.translate(a.cx, a.cy); ctx.rotate(rot); ctx.translate(-a.cx, -a.cy);
    ctx.drawImage(S.layers[i0], S.X0, S.Y0);
    if (fr > 0.004) { ctx.globalAlpha = fr; ctx.drawImage(S.layers[i0 + 1], S.X0, S.Y0); ctx.globalAlpha = 1; }
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.34;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(S.bloom, S.X0, S.Y0 - S.UP, S.bloom.width * 4, S.bloom.height * 4);
    // pearly glints flick on and off
    ctx.globalCompositeOperation = 'lighter';
    for (const g of S.gl) {
      const tw = Math.pow(Math.max(0, Math.cos((p * 1.3 + g.ph) * TAU)), 6) * g.k;
      if (tw < 0.04) continue;
      const r = 9 + 13 * tw;
      ctx.globalAlpha = 1;
      ctx.fillStyle = L.radial(ctx, g.x, g.y, 0, r, [[0, `rgba(255,255,255,${0.95 * tw})`], [0.18, `rgba(226,240,255,${0.5 * tw})`], [1, 'rgba(160,200,255,0)']]);
      ctx.fillRect(g.x - r, g.y - r, r * 2, r * 2);
    }
    ctx.restore();

    // specular line riding the lip of the lacquer, its hot spot creeping along the rim
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const pk = lerp(0.56, 0.64, p);
    ctx.strokeStyle = L.linear(ctx, 0, 0, W, 0, [[0, 'rgba(120,170,255,0.25)'], [pk - 0.16, 'rgba(170,205,255,0.5)'], [pk, 'rgba(236,246,255,0.95)'], [pk + 0.16, 'rgba(170,205,255,0.5)'], [1, 'rgba(120,170,255,0.3)']]);
    ctx.lineWidth = 2.2; a.stroke(ctx, -1.2);
    ctx.restore();
  },
};
