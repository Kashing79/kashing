// s11 — 拱桥红灯笼. A Jiangnan stone arch bridge at night, seen in side elevation from the water.
// The arc = the top of the low, plain stone parapet (石栏板) following the humped deck. A string of red gauze
// lanterns rides that line; their light is the only light in the picture, so the masonry is relit
// per-pixel in init() from the lantern positions (height map → normals → point lights → colour ramp).
// Everything hangs plumb (posts, lanterns, tassels, horizontal stone courses): only the deck line curves.
import * as L from '../lib/core.js';

const { W, H, TAU } = L;
const PAD = 150;                       // camera move is tiny (±0.5° about the arc centre, 3.5 % push-in)
const LW = W + PAD * 2, LH = H + PAD * 2;
const XL = -PAD - 30, XR = W + PAD + 30;
const SP = 256;                        // lantern pitch along the arc (px)
// vertical offsets below the parapet-top arc (px). Water-town bridges carry LOW, PLAIN slab parapets —
// no carved balustrade, no lotus finials (that is the northern imperial manner) — so: bare slabs, square posts.
const O = { cope: 13, slab: 98, deck: 142 };
const POST_HW = 20, POST_UP = 9;      // half-width of a post (望柱); how far its plain head stands above the slabs
const DROP = 404, RA = 1150, RT = 50;  // arch: intrados crown sits DROP px under the crest; radius; ring thickness
const LIGHT_Z = 110;                   // how far the lanterns hang in front of the wall plane
const Q = 1.5;                         // frame px per light-map px (the relighting runs at 1/Q resolution)
let S = null;

const G = (v) => { v = Math.round(L.clamp(v, 0, 255)); return `rgb(${v},${v},${v})`; };

// ───────────────────────── layout ─────────────────────────
function layout(a) {
  const s = a.span(PAD + 330);
  const n = Math.ceil((s * a.R) / SP);
  const lanterns = [], posts = [];
  for (let k = -n; k <= n; k++) {
    const r = L.rng('s11-lantern-' + k);
    const x = a.cx + a.R * Math.sin((k * SP) / a.R);
    const sc = k === 0 ? 1.12 : r.range(0.84, 1.13);
    const rx = 80 * sc, ry = rx * 0.87;
    const y = a.yAt(x) - ry * 0.5 + r.range(-5, 5);
    lanterns.push({ k, x, y, rx, ry, sc, phase: r(), amp: r.range(0.55, 1), power: sc * sc * r.range(0.93, 1.07), warm: k === 0 ? 0.9 : r() });
    const xp = a.cx + a.R * Math.sin(((k + 0.5) * SP) / a.R);
    posts.push({ k, x: xp, y: a.yAt(xp), yt: Math.min(a.yAt(xp - POST_HW), a.yAt(xp + POST_HW)) - POST_UP });
  }
  return { lanterns, posts };
}

function buildCourses(a) {
  const r = L.rng('s11-courses');
  const out = [];
  let y = a.crestY + O.deck - 3;
  while (y < H + PAD + 60) {
    const h = r.range(50, 64);
    const xs = [];
    let x = XL - 60 - r.range(0, 260);
    while (x < XR + 60) { xs.push(x); x += r.range(170, 340); }
    xs.push(x);
    out.push({ y0: y, y1: y + h, xs, tone: xs.map(() => r.range(-1, 1)), alb: xs.map(() => r.range(-1, 1)), tool: xs.map(() => r()), tool2: xs.map(() => r()) });
    y += h;
  }
  return out;
}

/** region between two copies of the arc shifted straight down by o0 / o1 px, for x in [x0, x1] */
function tband(g, a, o0, o1, x0 = XL, x1 = XR) {
  const t0 = a.thetaAtX(x0) - Math.PI / 2, t1 = a.thetaAtX(x1) - Math.PI / 2;
  g.beginPath();
  g.arc(a.cx, a.cy + o0, a.R, t0, t1, false);
  g.arc(a.cx, a.cy + o1, a.R, t1, t0, true);
  g.closePath();
}
function tline(g, a, o, x0 = XL, x1 = XR) {
  g.beginPath();
  g.arc(a.cx, a.cy + o, a.R, a.thetaAtX(x0) - Math.PI / 2, a.thetaAtX(x1) - Math.PI / 2, false);
  g.stroke();
}
/** a post: plain square shaft with a chamfered head, from just above the slabs down to the deck course */
function postPath(g, a, p) {
  const x = p.x, y = p.yt, yb = Math.max(a.yAt(x - POST_HW), a.yAt(x + POST_HW)) + O.slab + 1;
  g.beginPath();
  g.moveTo(x - POST_HW, yb); g.lineTo(x - POST_HW, y + 6); g.lineTo(x - POST_HW + 5, y);
  g.lineTo(x + POST_HW - 5, y); g.lineTo(x + POST_HW, y + 6); g.lineTo(x + POST_HW, yb);
  g.closePath();
}

// ───────────────────────── bridge: height / albedo maps ─────────────────────────
// mode 'h' → grey height map (white = proud of the wall), mode 'a' → grey albedo map
function drawStructure(g, a, lay, courses, arch, mode) {
  const hgt = mode === 'h';
  const r = L.rng('s11-struct-' + mode);
  g.fillStyle = G(hgt ? 58 : 200); g.fillRect(-PAD, -PAD, LW, LH);

  // spandrel wall: horizontal courses of dressed stone (条石), joints are the gaps
  g.save(); tband(g, a, O.deck - 3, 1700); g.clip();
  g.fillStyle = G(hgt ? 60 : 112); g.fillRect(-PAD, -PAD, LW, LH);
  for (const c of courses) for (let i = 0; i < c.xs.length - 1; i++) {
    const x0 = c.xs[i], x1 = c.xs[i + 1];
    if (hgt) {
      // every block sits a little differently: its face is a slightly tilted plane
      const base = 106 + c.tone[i] * 11, tl = 4 + 7 * c.tool2[i], vert = c.tool[i] > 0.5, sg = c.alb[i] > 0 ? 1 : -1;
      g.fillStyle = vert ? L.linear(g, 0, c.y0, 0, c.y1, [[0, G(base - sg * tl)], [1, G(base + sg * tl)]])
        : L.linear(g, x0, 0, x1, 0, [[0, G(base - sg * tl)], [1, G(base + sg * tl)]]);
    } else g.fillStyle = G(198 + c.alb[i] * 40);
    g.fillRect(x0 + 2.2, c.y0 + 2.2, x1 - x0 - 4.4, c.y1 - c.y0 - 4.4);
  }
  g.restore();

  // arch ring (拱券石): a band of voussoirs with radial joints, a touch proud of the wall
  const rm = arch.ri + RT / 2, step = 150 / rm, gap = 2.3 / rm;
  g.lineCap = 'butt';
  g.strokeStyle = G(hgt ? 60 : 116); g.lineWidth = RT + 3;
  g.beginPath(); g.arc(arch.cx, arch.cy, rm, -Math.PI / 2 - 1.3, -Math.PI / 2 + 1.3); g.stroke();
  for (let j = -10; j <= 10; j++) {
    const t0 = (j - 0.5) * step + gap, t1 = (j + 0.5) * step - gap;
    g.strokeStyle = G(hgt ? 124 + r.range(-6, 6) : 222 + r.range(-26, 16)); g.lineWidth = RT - 4;
    g.beginPath(); g.arc(arch.cx, arch.cy, rm, t0 - Math.PI / 2, t1 - Math.PI / 2); g.stroke();
  }
  g.fillStyle = G(hgt ? 36 : 60); g.beginPath(); g.arc(arch.cx, arch.cy, arch.ri, 0, TAU); g.fill();

  // parapet: plain stone slabs (素面石栏板) butted between square posts; the top arris is worn round
  for (let i = 0; i < lay.posts.length - 1; i++) {
    const xa = lay.posts[i].x, xb = lay.posts[i + 1].x, v = L.rng('s11-slab-' + lay.posts[i].k);
    const base = 132 + v.range(-7, 7), tl = v.range(-6, 6);
    tband(g, a, 0, O.slab, xa, xb);
    g.fillStyle = hgt ? L.linear(g, xa, 0, xb, 0, [[0, G(base - tl)], [1, G(base + tl)]]) : G(206 + v.range(-20, 14));
    g.fill();
  }
  if (hgt) {
    g.lineWidth = 2.2;
    for (let o = 0; o <= O.cope; o += 1) {
      const u = 1 - o / O.cope;
      g.strokeStyle = `rgba(58,58,58,${(0.62 * (1 - Math.sqrt(Math.max(0, 1 - u * u)))).toFixed(3)})`; tline(g, a, o);
    }
  }
  // posts (望柱): plain, a little proud of the slabs
  for (const p of lay.posts) {
    postPath(g, a, p); g.fillStyle = G(hgt ? 146 : 212); g.fill();
    if (hgt) {
      const yb = Math.max(a.yAt(p.x - POST_HW), a.yAt(p.x + POST_HW)) + O.slab + 1;
      g.fillStyle = G(166); g.fillRect(p.x - POST_HW + 4, p.yt + 7, POST_HW * 2 - 8, yb - p.yt - 7);
      g.fillStyle = L.linear(g, 0, p.yt, 0, p.yt + 7, [[0, G(120)], [1, G(166)]]); g.fillRect(p.x - POST_HW + 5, p.yt, POST_HW * 2 - 10, 7);
    }
  }

  // deck-edge course (桥面沿石): a rounded nosing that projects over the wall; the slabs stand on it
  g.lineWidth = 2.2;
  for (let o = O.slab; o <= O.deck; o += 1) {
    const u = (o - O.slab) / (O.deck - O.slab);
    g.strokeStyle = G(hgt ? 150 + 36 * Math.pow(Math.sin(Math.PI * u), 0.55) : 204); tline(g, a, o);
  }
  const jr = L.rng('s11-deckjoints');
  g.strokeStyle = G(hgt ? 104 : 140); g.lineWidth = 3;
  for (let x = XL + jr.range(0, 200); x < XR; x += jr.range(250, 430)) {
    const y = a.yAt(x); g.beginPath(); g.moveTo(x, y + O.slab + 1); g.lineTo(x, y + O.deck); g.stroke();
  }

  if (!hgt) {
    // baked occlusion: shadow under the projecting deck course, grime where the slabs meet it
    g.globalCompositeOperation = 'multiply'; g.lineWidth = 2.2;
    for (let o = 0; o < 22; o++) { g.strokeStyle = G(255 * (0.56 + 0.44 * Math.pow(o / 22, 0.7))); tline(g, a, O.deck + o); }
    for (let o = 0; o < 12; o++) { g.strokeStyle = G(255 * (0.7 + 0.3 * (o / 12))); tline(g, a, O.slab - o); }
    // weathering: broad mottling + rain streaks running down the face
    g.drawImage(L.noiseTex(LW / 2, LH / 2, { seed: 's11mottle', scale: 120, octaves: 4, warp: 0.6, res: 0.4, ramp: [[0, G(150)], [0.5, G(232)], [1, G(255)]] }), -PAD, -PAD, LW, LH);
    g.drawImage(L.noiseTex(LW / 2, LH / 2, { seed: 's11streak', scale: 34, sx: 0.32, sy: 8, octaves: 3, res: 0.5, contrast: 1.8, ramp: [[0, G(172)], [0.42, G(244)], [1, G(255)]] }), -PAD, -PAD, LW, LH);
    // lichen: pale crusts scattered over the old faces
    g.globalCompositeOperation = 'screen';
    g.drawImage(L.noiseTex(LW / 2, LH / 2, { seed: 's11lichen', scale: 30, octaves: 4, gain: 0.6, warp: 1.2, res: 0.5, contrast: 2.2, ramp: [[0, G(0)], [0.62, G(0)], [0.78, G(52)], [1, G(84)]] }), -PAD, -PAD, LW, LH);
    g.globalCompositeOperation = 'multiply';
    // run-off: dark tide marks hanging from the ledges (slab tops, deck nosing)
    const dr = L.rng('s11-drips');
    for (const [off, n, lmin, lmax, dark] of [[O.deck - 4, 64, 40, 230, 172], [5, 96, 14, 80, 166]]) {
      for (let k = 0; k < n; k++) {
        const x = dr.range(XL, XR), y = a.yAt(x) + off, len = dr.range(lmin, lmax) * (dr.chance(0.2) ? 1.5 : 1), ww = dr.range(4, 34);
        g.fillStyle = L.linear(g, 0, y, 0, y + len, [[0, G(dark + dr.range(-20, 30))], [1, G(255)]]);
        g.fillRect(x - ww / 2, y, ww, len);
      }
    }
    g.globalCompositeOperation = 'source-over';
  }
}

// ───────────────────────── bridge: relight from the lanterns ─────────────────────────
function lightPass(hc, ac, a, lanterns) {
  const w = hc.width, h = hc.height;
  const hd = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const ad = ac.getContext('2d').getImageData(0, 0, w, h).data;
  const Hf = new Float32Array(w * h);
  const nz = L.makeNoise('s11-rough'), nw = L.makeNoise('s11-wet');
  const y0 = Math.max(1, Math.floor((a.crestY - 60 + PAD) / Q));
  for (let y = y0 - 1; y < h; y++) for (let x = 0; x < w; x++) {
    const fx = x * Q - PAD, fy = y * Q - PAD;
    Hf[y * w + x] = hd[(y * w + x) * 4] + 5 * nz.fbm(fx / 36, fy / 36, 3) + 1.5 * nz.n2(fx / 5.2, fy / 5.2);
  }
  // light value → colour: night plum → crimson → magenta → pink → warm white
  const ramp = L.makeRamp([[0, '#050208'], [0.035, '#14050d'], [0.08, '#2a0a1a'], [0.18, '#6a1039'], [0.3, '#a3184f'],
    [0.425, '#cf2f66'], [0.575, '#f66c88'], [0.75, '#ffb2a2'], [1, '#ffe8d2']]);
  const lut = new Uint8ClampedArray(1024 * 3);
  for (let i = 0; i < 1024; i++) { const c = ramp(i / 1023); lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2]; }
  const out = new ImageData(w, h); const od = out.data;
  const LZ2 = LIGHT_Z * LIGHT_Z, R0 = 270 * 270, WIN = 760, K = 0.17 / Q;
  const AMB = 0.028, KD = 0.74, KF = 0.31, KS = 0.5;
  const nl = lanterns.length;
  const lx = lanterns.map((l) => l.x), ly = lanterns.map((l) => l.y), lp = lanterns.map((l) => l.power), lr = lanterns.map((l) => l.rx);
  for (let y = y0; y < h - 1; y++) {
    const fy = y * Q - PAD;
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, fx = x * Q - PAD;
      let gx = (Hf[i + 1] - Hf[i - 1]) * K, gy = (Hf[i + w] - Hf[i - w]) * K;
      if (gx > 1.7) gx = 1.7; else if (gx < -1.7) gx = -1.7;
      if (gy > 1.7) gy = 1.7; else if (gy < -1.7) gy = -1.7;
      const inv = 1 / Math.sqrt(gx * gx + gy * gy + 1);
      const nx = -gx * inv, ny = -gy * inv, nzz = inv;
      let diff = 0, spec = 0, streak = 0;
      for (let j = 0; j < nl; j++) {
        const dx = lx[j] - fx;
        if (dx > WIN || dx < -WIN) continue;
        const dy = ly[j] - fy;
        const d2 = dx * dx + dy * dy + LZ2, id = 1 / Math.sqrt(d2);
        let wn = 1 - (dx * dx) / (WIN * WIN); wn *= wn;
        const att = (lp[j] * wn) / (1 + d2 / R0);
        const lam = ((nx * dx + ny * dy + nzz * LIGHT_Z) * id + 0.3) / 1.3;
        if (lam > 0) diff += lam * att;
        const hx = dx * id, hy = dy * id, hz = LIGHT_Z * id + 1;
        const ndh = (nx * hx + ny * hy + nzz * hz) / Math.sqrt(hx * hx + hy * hy + hz * hz);
        if (ndh > 0.82) { let s = ndh * ndh; s *= s; s *= s; s *= s; s *= s; spec += s * att; }
        // wet stone: each lantern drags a broken streak of its own colour down the face below it
        const below = -dy;
        if (below > 120 && dx < 110 && dx > -110) {
          const sx = dx + 15 * nw.n2(fy / 46, j * 7.31), q = (sx * sx) / (lr[j] * lr[j] * 0.16);
          if (q < 7) streak += lp[j] * Math.exp(-q) * L.smooth((below - 130) / 80) * Math.exp(-(below - 150) / 230);
        }
      }
      const alb = ad[i * 4] / 255;
      const o = fy - a.yAt(fx);                                   // px below the parapet top
      const fill = Math.max(0, -0.62 * ny + 0.78 * nzz) / (1 + (o * o) / (270 * 270));   // the whole row of lanterns as one soft source above
      const wet = L.smooth((nw.fbm(fx / 80, fy / 520, 2) + 0.15) * 1.6);
      const v = alb * (AMB + KD * diff + KF * fill) + KS * wet * spec * (0.4 + 0.6 * alb);
      let li = (v * 511.5) | 0; if (li > 1023) li = 1023;
      const p = i * 4;
      let r = lut[li * 3], g = lut[li * 3 + 1], b = lut[li * 3 + 2];
      if (streak > 0.004) {
        const brk = L.smooth(nw.fbm(fx / 15, fy / 210, 2) * 1.5 + 0.55);
        const st = streak * alb * alb * (0.2 + 0.8 * brk) * L.clamp(1 + 2.4 * gy, 0.3, 2.6) * 0.85;
        r += 255 * st; g += 132 * st; b += 52 * st;
      }
      od[p] = r; od[p + 1] = g; od[p + 2] = b; od[p + 3] = 255;
    }
  }
  const c = L.makeCanvas(w, h);
  c.getContext('2d').putImageData(out, 0, 0);
  return c;
}

function buildBridge(env, lay, courses, arch) {
  const a = env.arc;
  const hw = Math.ceil(LW / Q), hh = Math.ceil(LH / Q);
  const mk = (mode) => {
    const c = L.makeCanvas(hw, hh); const g = c.getContext('2d', { willReadFrequently: true });
    g.scale(1 / Q, 1 / Q); g.translate(PAD, PAD);
    drawStructure(g, a, lay, courses, arch, mode);
    return c;
  };
  const lit = lightPass(L.blurred(mk('h'), 1.35), mk('a'), a, lay.lanterns);
  const grain = L.grainTex(512, 512, { seed: 's11grain', amount: 0.5 });

  return L.makeLayer(PAD, (g) => {
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(lit, -PAD, -PAD, hw * Q, hh * Q);

    // ── crisp full-resolution detail on the wall
    g.save();
    g.beginPath(); g.rect(-PAD, -PAD, LW, LH); g.arc(arch.cx, arch.cy, arch.ri + RT + 1, 0, TAU); g.clip('evenodd');
    tband(g, a, O.deck, 1700); g.clip();
    for (const c of courses) {
      // tooling marks (錾道): every block was dressed by hand at its own angle
      for (let i = 0; i < c.xs.length - 1; i++) {
        const x0 = c.xs[i], x1 = c.xs[i + 1], hgt = c.y1 - c.y0;
        const ang = (c.tool[i] - 0.5) * 1.5, sp = 6 + c.tool2[i] * 6, sl = Math.tan(ang) * hgt, m = Math.abs(sl) + 8;
        const rr = L.rng('s11-tool-' + Math.round(x0) + '-' + Math.round(c.y0));
        g.save(); g.beginPath(); g.rect(x0 + 3, c.y0 + 3, x1 - x0 - 6, hgt - 6); g.clip();
        g.lineWidth = 1.1;
        for (const [off, col] of [[0, 'rgba(0,0,0,0.12)'], [1.7, 'rgba(255,165,195,0.055)']]) {
          g.strokeStyle = col; g.beginPath();
          const r2 = L.rng('s11-tool2-' + Math.round(x0) + '-' + Math.round(c.y0));
          for (let x = x0 - m; x < x1 + m; x += sp) {
            const j = r2.range(-1.5, 1.5), ya = c.y0 + r2.range(0, hgt * 0.35), yb = c.y1 - r2.range(0, hgt * 0.35);
            g.moveTo(x + j + off + (sl * (ya - c.y0)) / hgt, ya); g.lineTo(x + j + off + (sl * (yb - c.y0)) / hgt, yb);
          }
          g.stroke();
        }
        // chipped arrises
        g.fillStyle = 'rgba(4,0,3,0.55)';
        for (let n = rr.int(1, 4); n > 0; n--) {
          const cx = rr.range(x0, x1), top = rr.chance(0.5), cy = top ? c.y0 + 2 : c.y1 - 2;
          g.beginPath(); g.ellipse(cx, cy, rr.range(4, 13), rr.range(2, 5), 0, 0, TAU); g.fill();
        }
        g.restore();
      }
      g.lineWidth = 1.5; g.strokeStyle = 'rgba(5,1,4,0.62)';
      g.beginPath(); g.moveTo(-PAD, c.y0); g.lineTo(W + PAD, c.y0);
      for (const x of c.xs) { g.moveTo(x, c.y0); g.lineTo(x, c.y1); }
      g.stroke();
      g.lineWidth = 1; g.strokeStyle = 'rgba(255,150,185,0.16)';
      g.beginPath(); g.moveTo(-PAD, c.y0 + 2.8); g.lineTo(W + PAD, c.y0 + 2.8); g.stroke();
    }
    // moss creeping out of the joints and under the nosing (苔痕)
    const mr = L.rng('s11-moss'), mn = L.makeNoise('s11-mossn');
    const dab = (x, y, d) => {
      const rr = mr.range(1, 3.6) * (0.6 + d * 1.6);
      g.fillStyle = mr.chance(0.3) ? 'rgba(30,42,15,0.55)' : 'rgba(7,11,6,0.55)';
      g.beginPath(); g.ellipse(x, y, rr * mr.range(0.9, 1.9), rr * mr.range(0.45, 1), mr.range(-0.3, 0.3), 0, TAU); g.fill();
    };
    courses.forEach((c, ci) => {
      for (let x = XL; x < XR; x += 5) {
        const d = mn.fbm(x / 190, ci * 3.7, 3) - 0.08;
        if (d <= 0) continue;
        for (let k = 1 + Math.floor(d * 12); k > 0; k--) dab(x + mr.range(-4, 4), c.y0 + mr.range(-3, 8) * (0.5 + d * 1.5), d);
      }
    });
    for (let x = XL; x < XR; x += 4) {
      const d = mn.fbm(x / 150, 91.3, 3) + 0.12;
      if (d <= 0) continue;
      for (let k = 1 + Math.floor(d * 7); k > 0; k--) dab(x + mr.range(-3, 3), a.yAt(x) + O.deck + mr.range(1, 9 + d * 20), d);
    }
    g.restore();

    // ── crisp arrises on the parapet and the arch ring (the relit map is soft; these put the edges back)
    g.save(); g.lineCap = 'butt';
    const dk = (al) => `rgba(8,0,6,${al})`, lt = (al) => `rgba(255,176,196,${al})`;
    {
      const stepA = 150 / (arch.ri + RT / 2);
      g.lineWidth = 1.6; g.strokeStyle = dk(0.6);
      g.beginPath(); g.arc(arch.cx, arch.cy, arch.ri + RT + 1, -Math.PI / 2 - 1.3, -Math.PI / 2 + 1.3); g.stroke();
      g.lineWidth = 1; g.strokeStyle = lt(0.14);
      g.beginPath(); g.arc(arch.cx, arch.cy, arch.ri + RT - 2, -Math.PI / 2 - 1.3, -Math.PI / 2 + 1.3); g.stroke();
      g.lineWidth = 1.4; g.strokeStyle = dk(0.55); g.beginPath();
      for (let j = -10; j <= 11; j++) {
        const t = (j - 0.5) * stepA, sn = Math.sin(t), cs = Math.cos(t);
        g.moveTo(arch.cx + arch.ri * sn, arch.cy - arch.ri * cs); g.lineTo(arch.cx + (arch.ri + RT) * sn, arch.cy - (arch.ri + RT) * cs);
      }
      g.stroke();
    }
    // the slab faces were dressed by hand too; a few have cracked with age
    for (let i = 0; i < lay.posts.length - 1; i++) {
      const xa = lay.posts[i].x + POST_HW, xb = lay.posts[i + 1].x - POST_HW, key = lay.posts[i].k, v = L.rng('s11-slabtool-' + key);
      const yT = Math.min(a.yAt(xa), a.yAt(xb)), hh = Math.max(a.yAt(xa), a.yAt(xb)) + O.slab - yT;
      const sl = Math.tan(v.range(-0.55, 0.55)) * hh, sp = v.range(6, 10), m = Math.abs(sl) + 8;
      g.save(); tband(g, a, 4, O.slab - 2, xa + 2, xb - 2); g.clip();
      g.lineWidth = 1.1;
      for (const [off, col] of [[0, 'rgba(0,0,0,0.1)'], [1.7, 'rgba(255,180,200,0.05)']]) {
        const r2 = L.rng('s11-slabtool2-' + key);
        g.strokeStyle = col; g.beginPath();
        for (let x = xa - m; x < xb + m; x += sp) {
          const j = r2.range(-1.5, 1.5), f0 = r2.range(0, 0.3), f1 = 1 - r2.range(0, 0.3);
          g.moveTo(x + j + off + sl * f0, yT + hh * f0); g.lineTo(x + j + off + sl * f1, yT + hh * f1);
        }
        g.stroke();
      }
      if (v.chance(0.35)) {
        let x = v.range(xa + 30, xb - 30), y = a.yAt(x) + 1; const pts = [[x, y]];
        for (let n = v.int(4, 9); n > 0; n--) { x += v.range(-7, 7); y += v.range(6, 13); pts.push([x, y]); }
        for (const [off, col, lw] of [[0, dk(0.4), 1.2], [1.3, lt(0.13), 1]]) {
          g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); pts.forEach((q, n) => (n ? g.lineTo(q[0] + off, q[1]) : g.moveTo(q[0] + off, q[1]))); g.stroke();
        }
      }
      g.restore();
    }
    for (const p of lay.posts) {
      const yb = Math.max(a.yAt(p.x - POST_HW), a.yAt(p.x + POST_HW)) + O.slab;
      g.lineWidth = 1.5; g.strokeStyle = dk(0.45); g.beginPath();
      for (const sx of [-1, 1]) { g.moveTo(p.x + sx * (POST_HW + 0.5), p.yt + 6); g.lineTo(p.x + sx * (POST_HW + 0.5), yb); }
      g.stroke();
      g.lineWidth = 1.2; g.strokeStyle = lt(0.24); g.beginPath();
      for (const sx of [-1, 1]) { g.moveTo(p.x + sx * (POST_HW - 2.4), p.yt + 7); g.lineTo(p.x + sx * (POST_HW - 2.4), yb); }
      g.stroke();
      g.lineWidth = 1; g.strokeStyle = dk(0.3); g.beginPath(); g.moveTo(p.x - POST_HW + 1, p.yt + 7.5); g.lineTo(p.x + POST_HW - 1, p.yt + 7.5); g.stroke();
    }
    g.lineWidth = 1.6; g.strokeStyle = dk(0.5); tline(g, a, O.slab);
    g.lineWidth = 1; g.strokeStyle = lt(0.2); tline(g, a, O.slab + 2.4);
    g.lineWidth = 1.8; g.strokeStyle = dk(0.6); tline(g, a, O.deck);
    // wet gloss along the nosing of the deck course
    g.globalCompositeOperation = 'screen';
    for (let x = XL; x < XR; x += 6) {
      let e = 0;
      for (const ln of lay.lanterns) { const d = x - ln.x; e += ln.power / (1 + (d * d) / (110 * 110)); }
      e = L.clamp(0.1 + 0.42 * e, 0, 1) * (0.55 + 0.45 * mn.n2(x / 37, 5.5));
      const x1 = x + 6.6, o = O.slab + (O.deck - O.slab) * 0.3;
      g.strokeStyle = `rgba(255,170,170,${(0.5 * e).toFixed(3)})`; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(x, a.yAt(x) + o); g.lineTo(x1, a.yAt(x1) + o); g.stroke();
      g.strokeStyle = `rgba(255,120,150,${(0.2 * e).toFixed(3)})`; g.lineWidth = 8;
      g.beginPath(); g.moveTo(x, a.yAt(x) + o + 2); g.lineTo(x1, a.yAt(x1) + o + 2); g.stroke();
    }
    g.restore();

    // ── detail over the whole elevation: stone grain, pits, crystals
    g.save();
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.62;
    g.fillStyle = g.createPattern(grain, 'repeat'); g.fillRect(-PAD, a.crestY - 80, LW, LH);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    L.speckle(g, { seed: 's11pits', count: 5200, x: -PAD, y: a.crestY - 40, w: LW, h: H + PAD - a.crestY + 40, rMin: 0.5, rMax: 2.3, colors: ['#020003', '#14040c', '#020003', '#ff9cba'], alpha: [0.1, 0.5] });
    // colour temperature: amber where a lantern is close, cool violet where only the night reaches
    g.globalCompositeOperation = 'soft-light';
    for (const ln of lay.lanterns) {
      const R1 = ln.rx * 3.2;
      g.fillStyle = L.radial(g, ln.x, ln.y + ln.ry * 0.7, ln.rx * 0.4, R1, [[0, 'rgba(255,150,40,0.5)'], [0.4, 'rgba(255,124,40,0.2)'], [1, 'rgba(255,110,40,0)']]);
      g.fillRect(ln.x - R1, ln.y - R1, R1 * 2, R1 * 2);
    }
    g.drawImage(L.noiseTex(LW, LH, { seed: 's11hue', scale: 260, octaves: 3, warp: 0.5, res: 0.2,
      ramp: [[0, 'rgba(70,30,190,0.2)'], [0.42, 'rgba(70,30,190,0)'], [0.62, 'rgba(255,130,60,0)'], [1, 'rgba(255,130,60,0.2)']] }), -PAD, -PAD);
    g.fillStyle = L.linear(g, 0, a.crestY + 200, 0, H + 40, [[0, 'rgba(60,34,200,0)'], [1, 'rgba(60,34,200,0.24)']]);
    g.fillRect(-PAD, a.crestY + 200, LW, LH);
    g.globalCompositeOperation = 'source-over';
    // the bridge sinks into darkness toward the water
    g.fillStyle = L.linear(g, 0, a.crestY + 240, 0, H + 60, [[0, 'rgba(5,2,8,0)'], [0.5, 'rgba(5,2,8,0.34)'], [1, 'rgba(5,2,8,0.8)']]);
    g.fillRect(-PAD, a.crestY + 240, LW, LH);
    g.restore();

    // ── cut the silhouette at full resolution
    const mask = L.makeLayer(PAD, (m) => {
      m.fillStyle = '#fff'; tband(m, a, 0, 1700, XL - 20, XR + 20); m.fill();
      for (const p of lay.posts) { postPath(m, a, p); m.fill(); }
      m.globalCompositeOperation = 'destination-out';
      m.beginPath(); m.arc(arch.cx, arch.cy, arch.ri, 0, TAU); m.fill();
    });
    g.globalCompositeOperation = 'destination-in'; g.drawImage(mask, -PAD, -PAD);
    g.globalCompositeOperation = 'source-over';

    // ── soffit of the arch barrel, seen from the water: lit only by light bouncing off the canal
    const yVP = a.crestY + 1100, sF = 0.93;
    const far = { cy: yVP + sF * (arch.cy - yVP), r: arch.ri * sF };
    g.save();
    g.beginPath(); g.arc(arch.cx, arch.cy, arch.ri, 0, TAU); g.arc(arch.cx, far.cy, far.r, 0, TAU); g.clip('evenodd');
    g.fillStyle = '#0d0409'; g.fillRect(-PAD, -PAD, LW, LH);
    g.fillStyle = L.radial(g, arch.cx, arch.cy, arch.ri - 60, arch.ri, [[0, 'rgba(96,14,44,0)'], [0.5, 'rgba(96,14,44,0.2)'], [1, 'rgba(128,22,56,0.46)']]);
    g.fillRect(-PAD, -PAD, LW, LH);
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.5;
    g.drawImage(L.noiseTex(LW, 520, { seed: 's11caustic', scale: 46, sx: 2.6, sy: 0.7, octaves: 3, ridged: true, warp: 0.7, contrast: 2.1, res: 0.33, oy: 600 }), -PAD, H + PAD - 520);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.strokeStyle = 'rgba(4,0,3,0.6)'; g.lineWidth = 1.4;
    for (const f of [0.36, 0.7]) { g.beginPath(); g.arc(arch.cx, L.lerp(arch.cy, far.cy, f), L.lerp(arch.ri, far.r, f), 0, TAU); g.stroke(); }
    for (let j = -12; j <= 12; j++) {
      const t = (j + 0.5) * (120 / arch.ri);
      g.beginPath(); g.moveTo(arch.cx + arch.ri * Math.sin(t), arch.cy - arch.ri * Math.cos(t)); g.lineTo(arch.cx + far.r * Math.sin(t), far.cy - far.r * Math.cos(t)); g.stroke();
    }
    g.restore();
    g.strokeStyle = 'rgba(3,0,3,0.85)'; g.lineWidth = 2.2; g.beginPath(); g.arc(arch.cx, arch.cy, arch.ri, 0, TAU); g.stroke();

    // ── the rim: the rounded coping catches the lantern light full on → the brightest line in the frame sits on the arc
    g.save();
    g.beginPath(); g.rect(-PAD, -PAD, LW, LH);
    for (const p of lay.posts) g.rect(p.x - POST_HW - 0.5, p.y - 60, POST_HW * 2 + 1, 120);
    g.clip('evenodd');
    g.globalCompositeOperation = 'screen'; g.lineCap = 'butt';
    for (let x = XL; x < XR; x += 6) {
      let e = 0;
      for (const ln of lay.lanterns) { const d = x - ln.x; e += ln.power / (1 + (d * d) / (150 * 150)); }
      e = L.clamp(0.42 + 0.36 * e, 0, 1) * (0.74 + 0.26 * mn.n2(x / 21, 17.3));
      const x1 = x + 6.6, ya = a.yAt(x), yb = a.yAt(x1);
      for (const [o, lw, al, col] of [[5.2, 9, 0.34, '255,120,150'], [3.2, 5, 0.5, '255,170,170'], [1.5, 2.4, 0.9, '255,226,204']]) {
        g.strokeStyle = `rgba(${col},${(al * e).toFixed(3)})`; g.lineWidth = lw;
        g.beginPath(); g.moveTo(x, ya + o); g.lineTo(x1, yb + o); g.stroke();
      }
    }
    g.restore();
    g.save(); g.globalCompositeOperation = 'destination-out';
    const cr = L.rng('s11-chips');
    for (let i = 0; i < lay.posts.length - 1; i++) {
      const xa = lay.posts[i].x + POST_HW + 8, xb = lay.posts[i + 1].x - POST_HW - 8;
      for (let n = cr.int(0, 2); n > 0; n--) {
        const x = cr.range(xa, xb);
        g.beginPath(); g.ellipse(x, a.yAt(x) - 0.6, cr.range(4, 11), cr.range(1.6, 3.2), a.thetaAtX(x), 0, TAU); g.fill();
      }
    }
    g.restore();
    g.save(); g.globalCompositeOperation = 'screen'; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const p of lay.posts) {
      const head = () => { g.beginPath(); g.moveTo(p.x - POST_HW + 1, p.yt + 6.5); g.lineTo(p.x - POST_HW + 5.5, p.yt + 1.2); g.lineTo(p.x + POST_HW - 5.5, p.yt + 1.2); g.lineTo(p.x + POST_HW - 1, p.yt + 6.5); };
      g.strokeStyle = 'rgba(255,150,165,0.4)'; g.lineWidth = 5; head(); g.stroke();
      g.strokeStyle = 'rgba(255,222,204,0.72)'; g.lineWidth = 1.8; head(); g.stroke();
    }
    g.restore();
  });
}

// ───────────────────────── lanterns ─────────────────────────
const GOLDS = ['#e3b341', '#f3cf6a', '#c48f22', '#ffdf8a', '#b3761a', '#e9a93a'];

function makeLantern(ln, tex) {
  const { rx, ry, sc } = ln;
  const capW = rx * 0.36, capH = rx * 0.2, e = capW * 0.17;
  const yCut = ry * 0.925;
  const cord = 22 * sc, tLen = rx * 1.02;
  const top = yCut + capH + e + cord;                       // body centre → wire knot (the pivot)
  const bot = yCut + capH + e + 30 * sc + tLen + 8;
  const m = 10;
  const w = Math.ceil(rx * 2 + m * 2), h = Math.ceil(top + bot + m * 2);
  const c = L.makeCanvas(w, h); const g = c.getContext('2d');
  const r = L.rng('s11-lan-paint-' + ln.k);
  g.translate(w / 2, m + top);
  g.lineCap = 'round';

  // hanging cord + ring
  g.strokeStyle = '#3a160c'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -top); g.lineTo(0, -(yCut + capH)); g.stroke();
  g.strokeStyle = '#a8761c'; g.lineWidth = 2.2; g.beginPath(); g.arc(0, -(yCut + capH + e + 7 * sc), 5 * sc, 0, TAU); g.stroke();

  // body: gauze glowing from the lamp inside — hot amber heart, deep red limb
  g.save(); g.scale(1, ry / rx);
  g.fillStyle = L.radial(g, 0, rx * 0.06, 0, rx, [[0, '#ffe2a0'], [0.14, '#ffbe57'], [0.31, '#fa7a28'], [0.5, '#e8351c'], [0.72, '#cc1b1a'], [0.91, '#8e0e16'], [1, '#56070f']]);
  g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill();
  g.restore();
  g.save(); g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.clip();
  // the lamp itself, a taller blur of light
  g.save(); g.globalCompositeOperation = 'screen'; g.scale(0.56, 1);
  g.fillStyle = L.radial(g, 0, ry * 0.06, 0, ry * 0.66, [[0, `rgba(255,238,176,${(0.5 + 0.42 * ln.warm).toFixed(3)})`], [0.45, `rgba(255,176,76,${(0.16 + 0.2 * ln.warm).toFixed(3)})`], [1, 'rgba(255,120,40,0)']]);
  g.fillRect(-rx * 2, -ry, rx * 4, ry * 2);
  g.restore();
  // cloth: vertical threads + uneven dye, seen in transmitted light
  g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.7;
  g.drawImage(tex.cloth, r.int(0, 70), r.int(0, 70), 180, 180, -rx, -ry, rx * 2, ry * 2);
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.3;
  g.drawImage(tex.blotch, r.int(0, 100), r.int(0, 100), 150, 150, -rx, -ry, rx * 2, ry * 2);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  // ribs (灯笼骨): meridians from cap to cap, crowding toward the limb
  const NG = 12;
  const mer = (sx) => { g.beginPath(); g.ellipse(0, 0, Math.max(0.6, Math.abs(sx) * rx), ry, 0, -Math.PI / 2, Math.PI / 2, sx < 0); };
  g.globalCompositeOperation = 'screen';
  for (let j = 0; j <= NG; j++) {
    const phi = -Math.PI / 2 + (j * Math.PI) / NG, wp = rx * (Math.PI / NG) * Math.cos(phi);
    if (wp < 4) continue;
    g.strokeStyle = 'rgba(255,190,104,0.11)'; g.lineWidth = wp * 0.5; mer(Math.sin(phi) || 0.001); g.stroke();
  }
  g.globalCompositeOperation = 'source-over';
  for (let j = 0; j < NG; j++) {
    const phi = -Math.PI / 2 + ((j + 0.5) * Math.PI) / NG, sx = Math.sin(phi), face = Math.cos(phi);
    g.strokeStyle = `rgba(92,0,10,${(0.15 + 0.12 * face).toFixed(3)})`; g.lineWidth = 6 * (0.3 + 0.7 * face) * sc; mer(sx); g.stroke();
    g.strokeStyle = 'rgba(70,0,8,0.66)'; g.lineWidth = (0.5 + 1.2 * face) * sc; mer(sx); g.stroke();
    g.save(); g.translate(sx < 0 ? 2.2 * face : -2.2 * face, 0);
    g.strokeStyle = `rgba(255,208,132,${(0.2 * face).toFixed(3)})`; g.lineWidth = 1.1; mer(sx); g.stroke();
    g.restore();
  }
  // gathered cloth darkens at the mouths; limb darkening
  g.fillStyle = L.linear(g, 0, -ry, 0, ry, [[0, 'rgba(60,0,10,0.62)'], [0.17, 'rgba(60,0,10,0)'], [0.83, 'rgba(60,0,10,0)'], [1, 'rgba(60,0,10,0.62)']]);
  g.fillRect(-rx, -ry, rx * 2, ry * 2);
  g.strokeStyle = 'rgba(54,0,12,0.5)'; g.lineWidth = rx * 0.11; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.stroke();
  // gilt trim bands near the mouths
  for (const sgn of [-1, 1]) {
    const yy = sgn * ry * 0.74, hwb = rx * Math.sqrt(1 - 0.74 * 0.74), b = rx * 0.07;
    const band = () => { g.beginPath(); if (sgn < 0) g.ellipse(0, yy, hwb, b, 0, Math.PI, TAU); else g.ellipse(0, yy, hwb, b, 0, 0, Math.PI); };
    g.strokeStyle = 'rgba(60,14,0,0.55)'; g.lineWidth = 5.5 * sc; band(); g.stroke();
    g.strokeStyle = L.linear(g, -hwb, 0, hwb, 0, [[0, '#6e430a'], [0.25, '#d9a637'], [0.5, '#ffe9a6'], [0.75, '#d9a637'], [1, '#6e430a']]); g.lineWidth = 3 * sc; band(); g.stroke();
  }
  g.restore();
  g.strokeStyle = 'rgba(48,0,8,0.6)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.stroke();

  // gilt mouths (灯托): short brass cylinders, lit from the lantern side
  const gold = L.linear(g, -capW, 0, capW, 0, [[0, '#4d2f06'], [0.16, '#b07f24'], [0.4, '#ffe9a0'], [0.54, '#e3b341'], [0.8, '#94640f'], [1, '#402604']]);
  for (const sgn of [-1, 1]) {
    const yA = sgn * yCut, yB = sgn * (yCut + capH);
    g.beginPath();
    if (sgn < 0) { g.ellipse(0, yB, capW, e, 0, Math.PI, TAU); g.lineTo(capW * 1.1, yA); g.ellipse(0, yA, capW * 1.1, e, 0, 0, Math.PI, true); }
    else { g.ellipse(0, yA, capW * 1.1, e, 0, Math.PI, 0, true); g.lineTo(capW, yB); g.ellipse(0, yB, capW, e, 0, 0, Math.PI, false); }
    g.closePath();
    g.fillStyle = gold; g.fill();
    g.fillStyle = L.linear(g, 0, yA, 0, yB + sgn * e, [[0, 'rgba(255,140,50,0.4)'], [0.5, 'rgba(60,20,0,0.05)'], [1, 'rgba(24,8,0,0.6)']]); g.fill();
    g.strokeStyle = 'rgba(40,16,0,0.75)'; g.lineWidth = 1; g.stroke();
    g.strokeStyle = 'rgba(52,22,0,0.6)'; g.lineWidth = 1.2;
    for (const f of [0.36, 0.7]) {
      const yy = L.lerp(yA, yB, f), ww = L.lerp(capW * 1.1, capW, f);
      g.beginPath(); if (sgn < 0) g.ellipse(0, yy, ww, e, 0, Math.PI, TAU); else g.ellipse(0, yy, ww, e, 0, 0, Math.PI); g.stroke();
    }
  }

  // tassel (流苏): bead, bound head, a skirt of gold silk
  const yb = yCut + capH + e;
  g.strokeStyle = '#5a2a0c'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, yb - 2); g.lineTo(0, yb + 8 * sc); g.stroke();
  const by = yb + 12 * sc, br = 6.2 * sc;
  g.fillStyle = L.radial(g, -br * 0.3, by - br * 0.4, 0.5, br * 1.2, [[0, '#fff0b4'], [0.4, '#e3b341'], [1, '#6a4208']]);
  g.beginPath(); g.arc(0, by, br, 0, TAU); g.fill();
  const yh = by + br, hh = 11 * sc, hwd = 5.4 * sc;
  g.fillStyle = L.linear(g, -hwd, 0, hwd, 0, [[0, '#7a1410'], [0.4, '#e0402a'], [1, '#5a0c0c']]); g.fillRect(-hwd, yh - 1, hwd * 2, hh);
  g.strokeStyle = '#e3b341'; g.lineWidth = 1.4;
  for (const f of [0.25, 0.75]) { g.beginPath(); g.moveTo(-hwd, yh + hh * f); g.lineTo(hwd, yh + hh * f); g.stroke(); }
  const yt = yh + hh - 1;
  g.fillStyle = L.linear(g, 0, yt, 0, yt + tLen, [[0, 'rgba(120,60,8,0.85)'], [1, 'rgba(70,24,8,0.6)']]);
  g.beginPath(); g.moveTo(-hwd, yt); g.lineTo(hwd, yt); g.lineTo(15 * sc, yt + tLen * 0.9); g.lineTo(-15 * sc, yt + tLen * 0.9); g.closePath(); g.fill();
  const nt = Math.round(34 * sc + 8);
  for (let i = 0; i < nt; i++) {
    const u = (i + 0.5) / nt - 0.5;
    const x0 = u * 2 * hwd, x1 = u * 34 * sc + r.range(-2.2, 2.2), len = tLen * r.range(0.84, 1);
    const col = r.pick(GOLDS);
    g.strokeStyle = L.linear(g, 0, yt, 0, yt + tLen, [[0, col], [1, L.rgba(L.mix(col, '#7a2c14', 0.5), 0.9)]]);
    g.lineWidth = r.range(0.9, 1.8);
    g.beginPath(); g.moveTo(x0, yt); g.quadraticCurveTo(x0 + (x1 - x0) * 0.2, yt + len * 0.5, x1, yt + len); g.stroke();
  }

  // bloom of the lamp through the cloth
  g.globalCompositeOperation = 'screen';
  g.fillStyle = L.radial(g, 0, ry * 0.05, 0, rx * 0.9, [[0, `rgba(255,214,130,${(0.28 + 0.2 * ln.warm).toFixed(3)})`], [0.5, 'rgba(255,150,60,0.13)'], [1, 'rgba(255,110,40,0)']]);
  g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.fill();

  ln.sprite = c; ln.sox = w / 2; ln.soy = m; ln.py = ln.y - top; ln.top = top;
}

/** bamboo poles lashed behind every post, with the wire the lanterns hang from */
function buildRig(a, lay) {
  return L.makeLayer(PAD, (g) => {
    const tip = (p) => ({ x: p.x, y: p.y - 192 });
    for (const p of lay.posts) {
      const t = tip(p), bot = p.y + 6;
      g.fillStyle = L.linear(g, p.x - 3, 0, p.x + 3, 0, [[0, '#c23a2a'], [0.28, '#3a1010'], [0.72, '#3a1010'], [1, '#c23a2a']]);
      g.fillRect(p.x - 3, t.y - 8, 6, bot - t.y + 8);
      g.fillStyle = L.linear(g, 0, t.y - 8, 0, p.y - 40, [[0, 'rgba(7,6,10,0.78)'], [1, 'rgba(7,6,10,0)']]);
      g.fillRect(p.x - 4, t.y - 9, 8, bot - t.y);
      g.fillStyle = 'rgba(14,4,6,0.8)';
      for (let y = bot - 30; y > t.y; y -= 41) g.fillRect(p.x - 3.6, y, 7.2, 2);
      // lashing where the wire is tied off
      g.fillStyle = '#5a1a14'; g.fillRect(p.x - 4, t.y - 3, 8, 6);
    }
    g.lineCap = 'round';
    for (let i = 0; i < lay.lanterns.length; i++) {
      const ln = lay.lanterns[i], pl = lay.posts[i - 1], pr = lay.posts[i];
      for (const p of [pl, pr]) {
        if (!p) continue;
        const t = tip(p), mx = (t.x + ln.x) / 2, my = (t.y + ln.py) / 2 + 9;
        g.strokeStyle = L.linear(g, t.x, t.y, ln.x, ln.py, [[0, '#3a1210'], [1, '#b8452c']]);
        g.lineWidth = 1.7; g.beginPath(); g.moveTo(t.x, t.y); g.quadraticCurveTo(mx, my, ln.x, ln.py); g.stroke();
      }
    }
  });
}

function buildHalo(lay) {
  return L.makeLayer(PAD, (g) => {
    g.globalCompositeOperation = 'lighter';
    for (const ln of lay.lanterns) {
      const R1 = ln.rx * 5.4;
      g.fillStyle = L.radial(g, ln.x, ln.y, ln.rx * 0.5, R1, [[0, 'rgba(255,84,40,0.5)'], [0.09, 'rgba(232,48,34,0.27)'], [0.24, 'rgba(190,24,60,0.1)'], [0.55, 'rgba(140,16,60,0.03)'], [1, 'rgba(120,10,50,0)']]);
      g.fillRect(ln.x - R1, ln.y - R1, R1 * 2, R1 * 2);
    }
  });
}

/** night: near-black sky, a few far lamps out of focus, the canal glimpsed through the arch */
function buildBack(a, arch) {
  const layer = L.makeLayer(PAD, (g) => {
    g.fillStyle = '#07060a'; g.fillRect(-PAD, -PAD, LW, LH);
    g.drawImage(L.noiseTex(LW, LH, { seed: 's11sky', scale: 460, sx: 2.4, octaves: 4, res: 0.2,
      ramp: [[0, 'rgba(24,10,24,0)'], [0.5, 'rgba(24,10,24,0)'], [1, 'rgba(36,13,31,0.5)']] }), -PAD, -PAD);
    const r = L.rng('s11-bokeh');
    const cols = ['#ffb347', '#ff8a3a', '#e02a1e', '#ffc46a', '#ff5a4a', '#ffa23a'];
    g.globalCompositeOperation = 'lighter';
    const disc = (x, y, rad, col, al) => {
      g.fillStyle = L.radial(g, x, y, 0, rad, [[0, L.rgba(col, al * 0.7)], [0.7, L.rgba(col, al)], [0.9, L.rgba(col, al * 1.2)], [1, L.rgba(col, 0)]]);
      g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
    };
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? 1 : -1;
      const x = a.cx + side * r.range(600, 1090), ya = a.yAt(x);
      const y = ya - r.range(150, 150 + (Math.abs(x - a.cx) - 560) * 0.42);
      disc(x, y, r.range(6, 19), r.pick(cols), r.range(0.07, 0.2));
    }
    // far bank seen through the arch: lamps and their broken reflections on the water
    for (let i = 0; i < 9; i++) {
      const x = a.cx + r.range(-520, 520), y = a.crestY + DROP + 86 + r.range(-10, 12), col = r.pick(cols);
      disc(x, y, r.range(5, 11), col, r.range(0.35, 0.7));
      for (let j = 0; j < 12; j++) {
        const ww = (7 + j * 1.6) * r.range(0.5, 1.3);
        g.fillStyle = L.rgba(col, 0.34 * Math.pow(1 - j / 12, 1.4));
        g.fillRect(x - ww / 2 + r.range(-3, 3), y + 14 + j * 7.5, ww, 2.6);
      }
    }
  });
  return L.blurred(layer, 2.2);
}

export default {
  name: '拱桥红灯笼',
  tone: 'light',
  init(env) {
    const a = env.arc;
    S = {};
    const lay = layout(a);
    const courses = buildCourses(a);
    const arch = { cx: a.cx, cy: a.crestY + DROP + RA, ri: RA };
    const tex = {
      cloth: L.noiseTex(256, 256, { seed: 's11cloth', scale: 5, sx: 0.8, sy: 7, octaves: 3, res: 1, contrast: 1.6 }),
      blotch: L.noiseTex(256, 256, { seed: 's11blotch', scale: 52, octaves: 4, warp: 0.7, res: 0.5, contrast: 1.7 }),
    };
    for (const ln of lay.lanterns) makeLantern(ln, tex);
    S.lay = lay;
    S.back = buildBack(a, arch);
    S.halo = buildHalo(lay);
    S.rig = buildRig(a, lay);
    S.bridge = buildBridge(env, lay, courses, arch);
  },
  draw(ctx, env, p) {
    const rot = L.lerp(-0.0085, 0.0085, p), zoom = L.lerp(1.0, 1.035, p);
    const t = p * env.dur;
    ctx.fillStyle = '#07060a'; ctx.fillRect(0, 0, W, H);
    L.blit(ctx, env, S.back, { rot: rot * 0.3, zoom: 1 + (zoom - 1) * 0.3 });
    const breath = 0.93 + 0.07 * Math.sin(p * Math.PI * 1.5 + 0.5);
    L.blit(ctx, env, S.halo, { rot, zoom, blend: 'screen', alpha: breath });
    L.blit(ctx, env, S.rig, { rot, zoom });
    L.blit(ctx, env, S.bridge, { rot, zoom });
    L.cam(ctx, env, { rot, zoom }, () => {
      for (const ln of S.lay.lanterns) {
        if (ln.x < -260 || ln.x > W + 260) continue;
        const sw = 0.02 * ln.amp * Math.sin(TAU * (0.62 * t + ln.phase));
        ctx.save(); ctx.translate(ln.x, ln.py); ctx.rotate(sw); ctx.drawImage(ln.sprite, -ln.sox, -ln.soy); ctx.restore();
      }
      // each flame breathes a little on its own
      for (const ln of S.lay.lanterns) {
        if (ln.x < -260 || ln.x > W + 260) continue;
        const fl = 0.9 + 0.1 * Math.sin(TAU * (1.1 * t + ln.phase * 3.7));
        L.glow(ctx, ln.x, ln.y, ln.rx * 2.4, '#ff6a34', 0.2 * fl);
        L.glow(ctx, ln.x, ln.y + ln.ry * 0.05, ln.rx * 0.95, '#ffd88a', 0.3 * fl);
      }
    });
    L.vignette(ctx, { strength: 0.3 });
  },
};
