// s14 — 铸钱图. A corner of an old colour woodblock page, shot on a rostrum camera: founders seen from the waist down
// (wide trousers, leg bindings, cloth shoes) pour copper from long-handled ladles into a row of upright sand-mould
// flasks standing on an indigo platform. The arc = the thick ink line along the platform's top edge.
//
// The page is "printed" in init(): every shape is drawn twice — as pigment density into a colour plate
// (R = ochre, G = indigo, B = vermilion) and as key-block lines into an ink plate — then one per-pixel pass lays the
// plates on the paper the way water-based pigment sits on it: each colour block slightly out of register, mottled by
// the baren and the wood grain, pooled darker along its edges, starved where the paper's tooth stands proud; the ink
// spreads a little and breaks up at the edges of the lines.
import * as L from '../../../lib/core.js';

const { W, H } = L;
const PAD = 92;
const LW = W + PAD * 2, LH = H + PAD * 2;
const LEAN = 0.5;          // things stand half-way between upright and radial on the curved platform
const SC = 1.22;           // overall figure scale
let S = null;

const NZ = L.makeNoise('s14cut');
let SID = 0;
const lerp = L.lerp;
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
const mid = (a, b, t = 0.5) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const unit = (x, y) => { const m = Math.hypot(x, y) || 1; return [x / m, y / m]; };
/** piecewise-linear table lookup: [[t, v], …] */
const pw = (arr, t) => {
  if (t <= arr[0][0]) return arr[0][1];
  for (let i = 1; i < arr.length; i++) if (t <= arr[i][0]) { const [t0, v0] = arr[i - 1], [t1, v1] = arr[i]; return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0); }
  return arr[arr.length - 1][1];
};
/** closed Catmull-Rom through pts (repeat a point to make a corner) */
function loop(pts, step = 5) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const m = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let j = 0; j < m; j++) {
      const t = j / m, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  return out;
}

/**
 * A knife-cut line: a filled ribbon whose width swells, pinches and steps along its length.
 * o: tin / tail (fraction of the length that tapers in / out), head (nail-head swelling at the start), wob, col, raw (pts already dense)
 */
function cut(g, pts, w, o = {}) {
  const { tin = 0.04, tail = 0.06, head = 0, wob = 0.2, col = '#fff', raw = false } = o;
  const p = raw ? pts : L.smoothPath(pts, 4);
  const n = p.length; if (n < 2) return;
  const id = (++SID) * 3.713;
  const cum = [0]; let len = 0;
  for (let i = 1; i < n; i++) { len += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); cum.push(len); }
  const tinL = tin * len, tailL = tail * len;
  const A = [], B = [];
  for (let i = 0; i < n; i++) {
    const a = p[Math.max(0, i - 1)], b = p[Math.min(n - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
    const s = cum[i];
    let k = 1;
    if (tinL > 0 && s < tinL) k *= 0.4 + 0.6 * (s / tinL);
    if (tailL > 0 && len - s < tailL) k *= Math.max(0.08, Math.pow((len - s) / tailL, 0.75));
    if (head) k *= 1 + head * Math.exp(-Math.pow(s / (w * 1.7), 2));
    k *= 1 + wob * (0.6 * NZ.n2(s / 90 + id, id * 0.7) + 0.32 * NZ.n2(s / 23 + id, 4.1 + id) + (NZ.n2(s / 58, id + 9.3) > 0.15 ? 0.3 : 0));
    const hw = Math.max(0.5, (w * k) / 2), j = 0.55 * NZ.n2(s / 7, id + 2.2);
    A.push([p[i][0] + nx * (hw + j), p[i][1] + ny * (hw + j)]);
    B.push([p[i][0] - nx * (hw - j), p[i][1] - ny * (hw - j)]);
  }
  g.fillStyle = col;
  g.beginPath(); g.moveTo(A[0][0], A[0][1]);
  for (let i = 1; i < n; i++) g.lineTo(A[i][0], A[i][1]);
  for (let i = n - 1; i >= 0; i--) g.lineTo(B[i][0], B[i][1]);
  g.closePath(); g.fill();
}

/** the two printing plates and the handful of operations everything is drawn with */
function makePress() {
  const mk = () => L.makeLayer(PAD, (g) => { g.fillStyle = '#000'; g.fillRect(-PAD, -PAD, LW, LH); });
  const plate = mk(), ink = mk();
  const pg = plate.getContext('2d'), ig = ink.getContext('2d');
  const path = (g, pts) => { g.beginPath(); for (let i = 0; i < pts.length; i++) { if (i) g.lineTo(pts[i][0], pts[i][1]); else g.moveTo(pts[i][0], pts[i][1]); } g.closePath(); };
  const CH = { o: (v) => `rgb(${v},0,0)`, i: (v) => `rgb(0,${v},0)`, v: (v) => `rgb(0,0,${v})` };
  return {
    plate, ink, pg, ig,
    /** clear a silhouette out of both plates (whatever was printed there is hidden by the new shape) */
    knock(pts) { pg.globalCompositeOperation = 'source-over'; pg.fillStyle = '#000'; path(pg, pts); pg.fill(); ig.fillStyle = '#000'; path(ig, pts); ig.fill(); },
    /** lay pigment: ch 'o' ochre | 'i' indigo | 'v' vermilion, lv 0..255 density (204 = the nominal colour) */
    tint(pts, ch, lv) { pg.globalCompositeOperation = 'lighten'; pg.fillStyle = CH[ch](lv); path(pg, pts); pg.fill(); },
    /** a pigment brush-mark (ribbon) instead of a filled outline */
    wash(pts, w, ch, lv, o = {}) { pg.globalCompositeOperation = 'lighten'; cut(pg, pts, w, { ...o, col: CH[ch](lv) }); },
    black(pts) { ig.fillStyle = '#fff'; path(ig, pts); ig.fill(); },
    line(pts, w, o) { cut(ig, pts, w, o); },
    carve(pts, w, o) { cut(ig, pts, w, { ...o, col: '#000' }); },
  };
}

// ───────────────────────── figures ─────────────────────────
const LT = 245, LS = 225, ANK = 72;                                         // thigh, shin, ankle height (× scale)
const TH_F = [[-0.6, 62], [0, 78], [0.38, 84], [0.74, 77], [1, 68]];        // half-widths of the trouser leg, front / back of the bone
const TH_B = [[-0.6, 80], [0, 96], [0.38, 86], [0.74, 70], [1, 60]];
const SH_F = [[0, 36], [0.3, 37], [0.6, 31], [0.85, 25], [1.05, 22]];       // the bound shin: calf swelling behind, tapering to the ankle
const SH_B = [[0, 40], [0.25, 52], [0.5, 49], [0.8, 31], [1.05, 24]];

/** one leg in profile: cloth shoe, sock, leg binding, wide trouser leg bloused over the binding */
function leg(P, o) {
  const { H, foot, f, k, r, gnd = 0, far = false } = o;
  const lt = LT * k, ls = LS * k;
  const A = [foot[0], foot[1] - ANK * k];
  const dx = A[0] - H[0], dy = A[1] - H[1], d0 = Math.hypot(dx, dy), d = Math.min(d0, lt + ls - 0.5);
  const ux = dx / d0, uy = dy / d0;
  const al = (lt * lt - ls * ls + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, lt * lt - al * al));
  let px = uy, py = -ux; if (px * f < 0) { px = -px; py = -py; }
  const K = [H[0] + ux * al + px * hh, H[1] + uy * al + py * hh];
  const d1 = unit(K[0] - H[0], K[1] - H[1]), d2 = unit(A[0] - K[0], A[1] - K[1]);
  const n1 = [f * d1[1], -f * d1[0]], n2 = [f * d2[1], -f * d2[0]];
  const nk = unit(n1[0] + n2[0], n1[1] + n2[1]);
  const bend = Math.abs(d1[0] * d2[1] - d1[1] * d2[0]);
  const TP = (t, v) => { const wv = (v >= 0 ? pw(TH_F, t) : pw(TH_B, t)) * k; return [H[0] + d1[0] * t * lt + n1[0] * v * wv, H[1] + d1[1] * t * lt + n1[1] * v * wv]; };
  const SP = (s, v) => { const wv = (v >= 0 ? pw(SH_F, s) : pw(SH_B, s)) * k; return [K[0] + d2[0] * s * ls + n2[0] * v * wv, K[1] + d2[1] * s * ls + n2[1] * v * wv]; };
  const KP = (along, across) => [K[0] + d2[0] * along * ls + n2[0] * across * k, K[1] + d2[1] * along * ls + n2[1] * across * k];
  const cg = Math.cos(gnd), sg = Math.sin(gnd);
  const SX = (x, y) => { const X = x * f * k, Y = y * k; return [foot[0] + X * cg - Y * sg, foot[1] + X * sg + Y * cg]; };

  // sock
  const sock = [SP(0.97, 1.05), SP(0.97, -1.05), SX(-37, -40), SX(22, -36)];
  P.knock(sock);
  P.line([SP(1.04, 1), SX(24, -44)], 5 * k, { tin: 0, tail: 0 });
  P.line([SP(1.04, -1), SX(-39, -52)], 5 * k, { tin: 0, tail: 0 });
  // cloth shoe: white layered sole, black upper
  const sole = loop([SX(-43, 1), SX(-43, 1), SX(66, 1), SX(103, -2), SX(113, -11), SX(113, -11), SX(100, -15), SX(60, -14), SX(-43, -14), SX(-43, -14)], 4);
  P.knock(sole);
  const upper = loop([SX(-43, -12), SX(-43, -12), SX(-46, -34), SX(-41, -53), SX(-41, -53), SX(-18, -50), SX(4, -44), SX(26, -43), SX(52, -41), SX(80, -33), SX(100, -21), SX(110, -11), SX(110, -11), SX(60, -12)], 4);
  P.knock(upper); P.black(upper);
  P.line([SX(-45, 1), SX(20, 2), SX(70, 1), SX(104, -2), SX(114, -11)], 6 * k, { tin: 0, tail: 0.04, wob: 0.25 });
  P.line([SX(-43, 3), SX(-44, -14)], 5 * k, { tin: 0, tail: 0 });
  P.carve([SX(28, -35), SX(60, -32), SX(92, -20)], 4.2 * k, { tin: 0.3, tail: 0.4 });
  // leg binding
  const shin = loop([SP(0.02, 1), SP(0.3, 1), SP(0.6, 1), SP(0.85, 1), SP(1.05, 1), SP(1.05, 1), SP(1.05, -1), SP(1.05, -1), SP(0.8, -1), SP(0.5, -1), SP(0.25, -1), SP(0.02, -1)], 5);
  P.knock(shin); P.tint(shin, 'o', far ? 236 : 218);
  P.line([SP(0.08, 1), SP(0.3, 1), SP(0.6, 1), SP(0.85, 1), SP(1.05, 1)], 7.5 * k, { tin: 0, tail: 0.02 });
  P.line([SP(0.08, -1), SP(0.25, -1), SP(0.5, -1), SP(0.8, -1), SP(1.05, -1)], 8.5 * k, { tin: 0, tail: 0.02 });
  P.line([SP(1.05, -1.05), SP(1.075, 0), SP(1.05, 1.05)], 6 * k, { tin: 0, tail: 0 });
  for (let q = 0; q < 7; q++) {
    const s0 = 0.2 + q * 0.128 + r.range(-0.018, 0.018);
    if (s0 + 0.1 > 1.0) break;
    P.line([SP(s0, -1), SP(s0 + 0.065, -0.05), SP(s0 + 0.1, 1)], (q % 2 ? 4.6 : 6) * k, { tin: 0, tail: 0.3, wob: 0.28 });
  }
  // trouser leg
  const kf = 69 + 10 * bend, kb = 58 - 22 * bend;
  const KF = add(K, nk, kf * k), KB = add(K, nk, -kb * k);
  const PF1 = KP(0.075, 68), PF2 = KP(0.15, 59), HM = KP(0.182, 2), PB2 = KP(0.15, -57), PB1 = KP(0.05, -64);
  const front = [TP(-0.6, 1), TP(0, 1), TP(0.38, 1), TP(0.74, 1), KF, PF1, PF2];
  const hem = [PF2, KP(0.176, 33), HM, KP(0.178, -30), PB2];
  const back = [PB2, PB1, KB, TP(0.74, -1), TP(0.38, -1), TP(0, -1), TP(-0.6, -1)];
  const trous = loop([...front, ...hem, ...back], 5);
  P.knock(trous); P.tint(trous, 'o', far ? 168 : 138);
  // second, darker impression of the ochre block: the shaded back of the thigh and the underside of the blousing
  const sh = [];
  for (let i = 0; i <= 10; i++) { const t = lerp(-0.2, 1.0, i / 10); sh.push(TP(t, -1.03)); }
  for (let i = 10; i >= 0; i--) { const t = lerp(-0.2, 1.0, i / 10); sh.push(TP(t, -0.52 + 0.13 * Math.sin(t * 7 + r() * 0.6) - 0.25 * Math.pow(t, 3))); }
  P.tint(loop(sh, 6), 'o', 216);
  P.tint(loop([PB2, PB2, KP(0.178, -30), HM, KP(0.176, 33), PF2, PF2, KP(0.11, 50), KP(0.125, 4), KP(0.105, -44)], 5), 'o', 216);
  P.line(front, 9.5 * k, { tin: 0, tail: 0.03, wob: 0.2 });
  P.line(hem, 8 * k, { tin: 0.1, tail: 0.1, wob: 0.32 });
  P.line(back, 10.5 * k, { tin: 0.02, tail: 0, wob: 0.22 });
  const F = (arr) => arr.map(([t, v]) => TP(t, v + r.range(-0.05, 0.05)));
  const fo = { head: 0.6, tin: 0, tail: 0.6, wob: 0.25 };
  if (bend > 0.2) {       // bent knee: tension folds fan out from the hollow of the knee
    P.line(F([[1.0, -0.84], [0.82, -0.4], [0.56, 0.12], [0.3, 0.42]]), 7.5 * k, fo);
    P.line(F([[1.03, -0.28], [0.88, 0.14], [0.7, 0.58]]), 6.5 * k, fo);
    P.line(F([[0.1, -0.56], [0.36, -0.3], [0.6, -0.5]]), 6 * k, fo);
  } else {                // straight leg: long hanging folds
    P.line(F([[0.0, -0.1], [0.36, -0.34], [0.74, -0.16], [1.03, -0.3]]), 7.5 * k, fo);
    P.line(F([[0.34, 0.44], [0.66, 0.3], [1.0, 0.5]]), 6.5 * k, fo);
  }
  for (const x of [-30, 6]) {   // pleats where the cloth is gathered into the binding
    const xx = x + r.range(-7, 7);
    P.line([KP(0.172, xx), KP(0.12, xx * 1.12), KP(0.05 + r.range(-0.02, 0.02), xx * 1.25)], 5.5 * k, { head: 0.5, tin: 0, tail: 0.6 });
  }
}

/** the hem of the short tunic hanging over the hips, optionally with its indigo sash */
function tunic(P, H, f, k, lean, r, o = {}) {
  const tl = Math.tan(lean) * f;
  const X = (dx, dy) => [H[0] + (f * dx + -dy * tl) * k, H[1] + dy * k];
  const hemB = X(-108, 40), hemF = X(100, 80);
  const hemPts = [hemB, X(-62, 60), X(-12, 58), X(40, 74), hemF];
  const frontE = [hemF, X(98, -40), X(90, -200), X(88, -460)];
  const backE = [hemB, X(-106, -60), X(-100, -220), X(-98, -460)];
  const shape = loop([...hemPts, hemF, ...frontE.slice(1), X(88, -460), X(-98, -460), ...backE.slice(1).reverse(), hemB], 6);
  P.knock(shape);
  if (o.tint) P.tint(shape, 'i', o.tint);
  P.line(hemPts, 8 * k, { tin: 0.02, tail: 0.02, wob: 0.28 });
  P.line(frontE, 7 * k, { tin: 0, tail: 0 });
  P.line(backE, 8 * k, { tin: 0, tail: 0 });
  const fo = { head: 0.5, tin: 0, tail: 0.6, wob: 0.25 };
  P.line([X(-60, 52), X(-50, -30), X(-58, -150)], 5.5 * k, fo);
  P.line([X(34, 66), X(22, -20), X(36, -120)], 5 * k, fo);
  P.line([X(-14, 50), X(-10, 10)], 4.5 * k, fo);
  if (o.sash) {
    const y0 = -128, y1 = -96;
    const band = [X(-106, y0), X(0, y0 + 6), X(94, y0), X(95, y1), X(0, y1 + 7), X(-105, y1)];
    P.knock(band); P.tint(band, 'i', 236);
    P.line([X(-106, y0), X(0, y0 + 6), X(94, y0)], 5 * k, { tin: 0, tail: 0 });
    P.line([X(-105, y1), X(0, y1 + 7), X(95, y1)], 5.5 * k, { tin: 0, tail: 0 });
  }
  if (o.ends) {   // the knotted ends of the sash hang down in front of the thigh
    const [x0, y0] = o.ends;
    const strip = (xa, ya, xb, yb, w) => {
      const p0 = X(xa, ya), p1 = X(xb, yb), c = X((xa + xb) / 2 + 9, (ya + yb) / 2);
      const nrm = unit(-(p1[1] - p0[1]), p1[0] - p0[0]);
      const a = [add(p0, nrm, w / 2), add(c, nrm, w / 2 + 2), add(p1, nrm, w / 2 + 3)], b = [add(p1, nrm, -w / 2 - 3), add(c, nrm, -w / 2 - 2), add(p0, nrm, -w / 2)];
      const sh = loop([a[0], a[0], a[1], a[2], a[2], add(b[0], [0, 12 * k]), add(b[0], [0, 12 * k]), b[1], b[2], b[2]], 5);
      P.knock(sh); P.tint(sh, 'i', 236);
      P.line(a, 4.6 * k, { tin: 0, tail: 0 }); P.line(b.slice().reverse(), 4.6 * k, { tin: 0, tail: 0 });
      P.line([a[2], add(b[0], [0, 12 * k])], 4.6 * k, { tin: 0, tail: 0 });
    };
    strip(x0, y0, x0 + 16, y0 + 250, 30 * k);
    strip(x0 + 22, y0, x0 + 58, y0 + 205, 26 * k);
  }
}

function figure(P, a, o) {
  const r = L.rng('s14fig' + o.seed), k = o.k || SC, f = o.f || 1;
  const th = o.s / a.R;
  const footAt = (s, dr) => { const t = s / a.R, p = a.pt(t, dr); return { p: [p.x, p.y], t }; };
  const nf = footAt(o.near, o.drNear === undefined ? 6 : o.drNear), ff = footAt(o.far, o.drFar === undefined ? 26 : o.drFar);
  const g0 = a.pt(th, 12), leanA = th * LEAN + (o.lean || 0) * f;
  const Hp = [g0.x + Math.sin(leanA) * o.hh * k, g0.y - Math.cos(leanA) * o.hh * k];
  leg(P, { H: [Hp[0] - f * 9 * k, Hp[1] - 5 * k], foot: ff.p, f, k, r, gnd: ff.t, far: true });
  leg(P, { H: Hp, foot: nf.p, f, k, r, gnd: nf.t });
  tunic(P, Hp, f, k, (o.lean || 0) + 0.04, r, o.tunic || {});
  return Hp;
}

// ───────────────────────── mould flasks & ladles ─────────────────────────
/** an upright two-part sand-mould flask (范箱) in the oblique projection of a woodblock picture; returns the pouring gate on its top */
function flask(P, a, o) {
  const r = L.rng('s14box' + o.seed);
  const t0 = o.s / a.R, t1 = (o.s + o.w) / a.R;
  const b0 = a.pt(t0, o.dr), b1 = a.pt(t1, o.dr);
  const A0 = [b0.x, b0.y], A1 = [b1.x, b1.y];
  const ang = ((t0 + t1) / 2) * LEAN + (o.tilt || 0);
  const up = [Math.sin(ang) * o.h, -Math.cos(ang) * o.h];
  const A3 = add(A0, up), A2 = add(A1, up);
  const dv = [o.dx || 48, o.dy || -28];
  const T3 = add(A3, dv), T2 = add(A2, dv), R1 = add(A1, dv);
  P.knock([A0, A1, R1, T2, T3, A3]);
  P.tint([A0, A1, A2, A3], 'i', 58);
  P.tint([A1, R1, T2, A2], 'i', 168);
  const j = () => [r.range(-1.6, 1.6), r.range(-1.6, 1.6)];
  const seg = (p, q, w, oo = {}) => P.line([add(p, j()), add(mid(p, q), j()), add(q, j())], w, { tin: 0, tail: 0, wob: 0.22, ...oo });
  // ropes binding the two halves together (drawn first, the frame lines run over them)
  const U = (p, fr) => add(p, up, fr);
  for (const fr of [0.24, 0.7]) {
    const fr2 = fr + 15 / o.h;
    const rope = [U(A0, fr), U(A1, fr), U(R1, fr), U(R1, fr2), U(A1, fr2), U(A0, fr2)];
    P.knock(rope); P.tint(rope, 'o', 150);
    P.line([U(A0, fr), U(A1, fr), U(A1, fr), U(R1, fr)], 4.4, { tin: 0, tail: 0 });
    P.line([U(A0, fr2), U(A1, fr2), U(A1, fr2), U(R1, fr2)], 4.4, { tin: 0, tail: 0 });
  }
  seg(A0, A1, 7); seg(A1, A2, 7.5); seg(A2, A3, 7); seg(A3, A0, 7.5);
  seg(A3, T3, 6.5); seg(T3, T2, 6.5); seg(T2, A2, 6.5); seg(A1, R1, 6.5); seg(R1, T2, 7);
  // the parting between the two halves, down the side and across the top
  seg(mid(A1, R1), mid(A2, T2), 4.2, { wob: 0.3 });
  seg(mid(A3, T3), mid(A2, T2), 4.2, { wob: 0.3 });
  // the pouring gate
  const c = mid(mid(A3, T3), mid(A2, T2));
  const ell = (rx, ry) => { const e = []; for (let i = 0; i < 20; i++) { const an = (i / 20) * L.TAU; e.push([c[0] + Math.cos(an) * rx + Math.sin(an) * ry * 0.5, c[1] + Math.sin(an) * ry]); } return e; };
  P.knock(ell(20, 8)); P.tint(ell(20, 8), 'v', 255);
  const ring = ell(20, 8); ring.push(ring[0], ring[1]);
  P.line(ring, 4.4, { tin: 0, tail: 0, wob: 0.3 });
  return { gate: c, top: A3[1] };
}

/** long-handled copper ladle; `target` = where its stream of molten copper lands (omit for a ladle that is not pouring yet) */
function ladle(P, o) {
  const { bowl, from, tilt, f = 1, k = 1, target, seed } = o;
  const r = L.rng('s14ladle' + seed);
  const c = Math.cos(tilt * f), s = Math.sin(tilt * f);
  const B = (x, y) => { const X = x * f * k, Y = y * k; return [bowl[0] + X * c - Y * s, bowl[1] + X * s + Y * c]; };
  const RX = 52, RY = 14, DP = 52;
  // pole
  const at = B(-RX + 4, 6), dir = unit(at[0] - from[0], at[1] - from[1]), nr = [-dir[1], dir[0]], pwid = 8 * k;
  const pole = [add(from, nr, pwid), add(at, nr, pwid), add(at, nr, -pwid), add(from, nr, -pwid)];
  P.knock(pole); P.tint(pole, 'o', 96);
  const poleLen = Math.hypot(at[0] - from[0], at[1] - from[1]);
  P.line([pole[0], add(mid(pole[0], pole[1]), nr, r.range(-1.5, 1.5)), pole[1]], 5 * k, { tin: 0, tail: 0, wob: 0.18 });
  P.line([pole[3], add(mid(pole[3], pole[2]), nr, r.range(-1.5, 1.5)), pole[2]], 5.5 * k, { tin: 0, tail: 0, wob: 0.18 });
  // the metal socket the pole is driven into
  const q0 = add(at, dir, -74 * k), q1 = add(at, dir, 6 * k);
  const sock = [add(q0, nr, pwid + 3), add(q1, nr, pwid + 5), add(q1, nr, -pwid - 5), add(q0, nr, -pwid - 3)];
  P.knock(sock); P.tint(sock, 'o', 255);
  P.line([sock[0], sock[1]], 5.5 * k, { tin: 0, tail: 0 }); P.line([sock[3], sock[2]], 6 * k, { tin: 0, tail: 0 });
  P.line([sock[0], sock[3]], 5 * k, { tin: 0, tail: 0 });
  if (poleLen > 0) P.line([add(mid(sock[0], sock[1], 0.45), nr, 0), add(mid(sock[3], sock[2], 0.45), nr, 0)], 4 * k, { tin: 0, tail: 0 });
  // bowl
  const body = [];
  for (let i = 0; i <= 18; i++) { const an = Math.PI - (i / 18) * Math.PI; body.push(B(RX * Math.cos(an), DP * Math.pow(Math.sin(an), 0.8))); }
  const far = [];
  for (let i = 1; i < 12; i++) { const an = (i / 12) * Math.PI; far.push(B(RX * Math.cos(an), -RY * Math.sin(an))); }
  P.knock([...body, ...far]); P.tint([...body, ...far], 'o', 255);
  const rim = [];
  for (let i = 0; i < 26; i++) { const an = (i / 26) * L.TAU; rim.push(B(RX * Math.cos(an), RY * Math.sin(an))); }
  const melt = [];
  for (let i = 0; i < 26; i++) { const an = (i / 26) * L.TAU; melt.push(B((RX - 7) * Math.cos(an) + 1, (RY - 4) * Math.sin(an) + 1)); }
  P.knock(rim); P.tint(rim, 'o', 120); P.knock(melt); P.tint(melt, 'v', 228);
  P.line(body, 8 * k, { tin: 0, tail: 0, wob: 0.22, raw: false });
  rim.push(rim[0], rim[1]);
  P.line(rim, 5 * k, { tin: 0, tail: 0, wob: 0.25 });
  P.line([B(-30, 30), B(-12, 42), B(10, 44)], 4.4 * k, { head: 0.4, tin: 0, tail: 0.6 });   // one cut of shading under the belly
  // the pour
  if (target) {
    const lip = B(RX - 2, 3);
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const u = i / 14, x = lerp(lip[0], target[0], Math.pow(u, 0.62)), y = lerp(lip[1], target[1], u * u * 0.55 + u * 0.45);
      pts.push([x + 1.4 * NZ.n2(u * 4, seed.length + 3.3), y]);
    }
    P.pg.globalCompositeOperation = 'source-over';
    cut(P.pg, pts, 15 * k, { tin: 0, tail: 0, wob: 0.2, col: '#000' }); cut(P.ig, pts, 15 * k, { tin: 0, tail: 0, col: '#000' });
    P.wash(pts, 11.5 * k, 'v', 255, { tin: 0.08, tail: 0, wob: 0.3 });
    // sparks leaping from the gate
    for (let i = 0; i < 5; i++) {
      const an = -Math.PI / 2 + (i - 2) * 0.52 + r.range(-0.15, 0.15), l0 = r.range(20, 30), l1 = l0 + r.range(14, 26);
      P.wash([[target[0] + Math.cos(an) * l0, target[1] + Math.sin(an) * l0 * 0.9], [target[0] + Math.cos(an) * l1, target[1] + Math.sin(an) * l1 * 0.9]], r.range(6, 8.5), 'v', 255, { tin: 0, tail: 0.7, head: 0.3 });
    }
  }
}

// ───────────────────────── the platform, the ground ─────────────────────────
function platform(P, a) {
  const s = a.span(PAD + 90), r = L.rng('s14band');
  const top = [], bot = [], midl = [];
  for (let i = 0; i <= 150; i++) {
    const th = lerp(-s, s, i / 150), u = th * a.R;
    const p = (dr) => { const q = a.pt(th, dr); return [q.x, q.y]; };
    top.push(p(3 + 2.2 * NZ.n2(u / 150, 3.3) + 1.2 * NZ.n2(u / 33, 8)));
    bot.push(p(-90 + 5 * NZ.n2(u / 170, 12.1) + 2.6 * NZ.n2(u / 37, 5.5)));
    midl.push(p(-56 + 4 * NZ.n2(u / 120, 21.7) + 2 * NZ.n2(u / 29, 1.5)));
  }
  P.tint([...top, ...bot.slice().reverse()], 'i', 196);
  P.tint([...midl, ...bot.slice().reverse()], 'i', 255);       // a second impression deepens the foot of the platform
  // hatching cut across the shaded foot
  let u = -s * a.R;
  while (u < s * a.R) {
    u += r.range(15, 25);
    if (r.chance(0.16)) { u += r.range(20, 60); continue; }
    const p0 = a.pt(u / a.R, -60 + r.range(-3, 3)), p1 = a.pt((u - r.range(10, 16)) / a.R, -82 + r.range(-3, 3));
    P.line([[p0.x, p0.y], [p1.x, p1.y]], r.range(3.2, 4.2), { tin: 0, tail: 0.5, head: 0.3, wob: 0.3 });
  }
  P.line(L.arcPts(a, -86, -s, s, 300), 4.6, { tin: 0, tail: 0, wob: 0.3, raw: true });
  P.line(L.arcPts(a, -1, -s, s, 420), 11.5, { tin: 0, tail: 0, wob: 0.13, raw: true });
}

/** a few dry strokes of pale ochre below the platform: the ground */
function ground(P, a) {
  const r = L.rng('s14cun');
  const list = [[-0.43, -0.2, -170, 26, 92], [-0.07, 0.2, -238, 32, 80], [0.25, 0.47, -182, 22, 90], [-0.31, -0.03, -352, 28, 64], [0.09, 0.37, -410, 24, 58], [-0.5, -0.34, -300, 24, 70]];
  for (const [t0, t1, dr, w, lv] of list) {
    const lanes = 6;
    for (let q = 0; q < lanes; q++) {
      if (r.chance(0.12)) continue;
      const off = (q / (lanes - 1) - 0.5) * w, a0 = t0 + r.range(0, 0.04), a1 = t1 - r.range(0, 0.07), pts = [];
      for (let i = 0; i <= 44; i++) {
        const uu = i / 44, th = lerp(a0, a1, uu);
        const p = a.pt(th, dr + off + 8 * NZ.n2(th * 13, dr * 0.1) + 5 * Math.sin(uu * Math.PI));
        pts.push([p.x, p.y]);
      }
      P.wash(pts, (w / lanes) * r.range(1.1, 1.9), 'o', Math.round(lv * r.range(0.6, 1.1)), { tin: 0.12, tail: 0.3, wob: 0.5, raw: true });
    }
  }
}

// ───────────────────────── paper ─────────────────────────
function buildPaper(a) {
  const c = L.paperTex(LW, LH, { base: '#EDDCB0', seed: 1409, tone: '#9a6a32', fiber: 0.9, stain: 0.7, grain: 0.15 });
  const g = c.getContext('2d'); g.translate(PAD, PAD);
  const r = L.rng('s14paper');
  g.lineCap = 'round';
  for (let i = 0; i < 300; i++) {   // long fibres of a hand-made sheet
    const x = r.range(-PAD, W + PAD), y = r.range(-PAD, H + PAD), len = r.range(30, 140), an = r.range(0, Math.PI), bend = r.range(-0.6, 0.6);
    g.strokeStyle = r.chance(0.55) ? L.rgba('#fff7dc', r.range(0.1, 0.32)) : L.rgba('#8a5f2c', r.range(0.06, 0.2));
    g.lineWidth = r.range(0.7, 1.8);
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(an + bend) * len * 0.5, y + Math.sin(an + bend) * len * 0.5, x + Math.cos(an) * len, y + Math.sin(an) * len); g.stroke();
  }
  for (let i = 0; i < 9; i++) {     // slow tan blotches
    const x = r.range(-PAD, W + PAD), y = r.range(-PAD, H + PAD), rad = r.range(90, 260);
    g.fillStyle = L.radial(g, x, y, 0, rad, [[0, L.rgba('#b98646', r.range(0.06, 0.13))], [1, L.rgba('#b98646', 0)]]);
    g.beginPath(); g.arc(x, y, rad, 0, L.TAU); g.fill();
  }
  for (let i = 0; i < 60; i++) {    // foxing
    const x = r.range(-PAD, W + PAD), y = r.range(-PAD, H + PAD), rad = 3 + 17 * Math.pow(r(), 2.4), al = r.range(0.14, 0.42);
    g.fillStyle = L.radial(g, x, y, 0, rad, [[0, L.rgba('#9c5c22', al)], [0.45, L.rgba('#a86c2e', al * 0.55)], [1, L.rgba('#a86c2e', 0)]]);
    g.beginPath(); g.arc(x, y, rad, 0, L.TAU); g.fill();
  }
  // tide lines of old water stains, kept below the platform
  const stain = (cx, cy, rad, seed, sq) => {
    const pts = [];
    for (let i = 0; i < 44; i++) {
      const an = (i / 44) * L.TAU, cs = Math.cos(an), sn = Math.sin(an);
      const rr = rad * (1 + 0.24 * NZ.n2(cs * 1.2 + seed, sn * 1.2) + 0.09 * NZ.n2(cs * 4 + seed, sn * 4 + 7));
      pts.push([cx + cs * rr * sq, cy + sn * rr / sq]);
    }
    const q = loop(pts, 6);
    const trace = () => { g.beginPath(); q.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); };
    g.save(); g.filter = 'blur(5px)'; g.fillStyle = L.rgba('#b48a4a', 0.11); trace(); g.fill(); g.restore();
    g.save(); g.filter = 'blur(1.8px)'; g.strokeStyle = L.rgba('#8c5a26', 0.34); g.lineWidth = 4.5; trace(); g.stroke(); g.restore();
    g.save(); g.filter = 'blur(6px)'; g.strokeStyle = L.rgba('#9a6a32', 0.16); g.lineWidth = 16; trace(); g.stroke(); g.restore();
  };
  stain(330, 975, 235, 3.1, 1.35);
  stain(1630, 905, 150, 8.6, 1.2);
  // the sheet has yellowed toward its edges
  g.fillStyle = L.radial(g, a.cx - 60, a.crestY - 60, 420, 1500, [[0, 'rgba(176,128,62,0)'], [1, 'rgba(176,128,62,0.3)']]);
  g.fillRect(-PAD, -PAD, LW, LH);
  return c;
}

// ───────────────────────── printing ─────────────────────────
function pigment(target, paper) {   // per-channel transmittance LUT over density 0..255 (204 = the nominal colour)
  const T = target.map((v, i) => v / paper[i]), lut = new Float32Array(256 * 3);
  for (let i = 0; i < 256; i++) for (let c = 0; c < 3; c++) lut[i * 3 + c] = Math.pow(T[c], i / 204);
  return lut;
}

function printSheet(a, paperC, P) {
  const N = LW * LH, N4 = N * 4;
  const rd = (c) => c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, LW, LH).data;
  const img = paperC.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, LW, LH), pap = img.data;
  const pl = rd(L.blurred(P.plate, 1.3)), pb = rd(L.blurred(P.plate, 8)), ik = rd(L.blurred(P.ink, 1.05));
  const mot = rd(L.noiseTex(LW, LH, { seed: 's14mot', scale: 170, octaves: 4, res: 0.25, contrast: 1.7 }));
  const str = rd(L.noiseTex(LW, LH, { seed: 's14str', scale: 8, sx: 34, sy: 1, octaves: 3, res: 0.5, contrast: 1.7 }));
  const TS = 512, tooth = L.noiseTex(TS, TS, { seed: 's14tooth', scale: 3.6, octaves: 2, res: 1, contrast: 2.3 }).getContext('2d').getImageData(0, 0, TS, TS).data;
  const PAPER = [230, 211, 163];
  const LO = pigment([181, 113, 58], PAPER), LI = pigment([56, 106, 142], PAPER), LV = pigment([220, 80, 50], PAPER);
  // each block sits a few pixels out of register with the key block
  const off = (dx, dy) => -(dy * LW + dx) * 4;
  const OO = off(-5, 4), OI = off(4, 3), OV = off(4, -3);
  const vimg = new ImageData(LW, LH), vd = vimg.data;
  for (let y = 0; y < LH; y++) {
    const ty = (y & 511) << 9;
    for (let x = 0; x < LW; x++) {
      const o4 = (y * LW + x) * 4;
      const tt = (tooth[(ty + (x & 511)) * 4] - 128) / 128, mo = (mot[o4] - 128) / 128, st = (str[o4] - 128) / 128;
      let r = pap[o4], g = pap[o4 + 1], b = pap[o4 + 2];
      let j = o4 + OO; if (j < 0 || j >= N4) j = o4;
      let d = pl[j];
      if (d > 2) {
        const e = d - pb[j];
        let dens = d * (1 + 0.4 * mo + 0.3 * st - 0.3 * tt) + (e > 0 ? e * 0.6 : 0);
        if (d < 125) { const q = (d / 255) * 2.3 - 0.24 + tt * 0.9 + st * 0.75 + mo * 0.3; dens *= q <= 0 ? 0 : q >= 0.5 ? 1 : q * 2; }   // thin washes go dry and broken
        const k = (dens <= 0 ? 0 : dens >= 255 ? 255 : dens | 0) * 3;
        r *= LO[k]; g *= LO[k + 1]; b *= LO[k + 2];
      }
      j = o4 + OI + 1; if (j < 0 || j >= N4) j = o4 + 1;
      d = pl[j];
      if (d > 2) {
        const e = d - pb[j];
        const dens = d * (1 + 0.36 * mo + 0.34 * st - 0.3 * tt) + (e > 0 ? e * 0.7 : 0);
        const k = (dens <= 0 ? 0 : dens >= 255 ? 255 : dens | 0) * 3;
        r *= LI[k]; g *= LI[k + 1]; b *= LI[k + 2];
      }
      j = o4 + OV + 2; if (j < 0 || j >= N4) j = o4 + 2;
      d = pl[j];
      if (d > 2) {
        const e = d - pb[j];
        const dens = d * (0.8 + 0.3 * mo + 0.2 * st - 0.26 * tt) + (e > 0 ? e * 0.5 : 0);
        const k = (dens <= 0 ? 0 : dens >= 255 ? 255 : dens | 0) * 3;
        r *= LV[k]; g *= LV[k + 1]; b *= LV[k + 2];
        vd[o4] = 214; vd[o4 + 1] = 52; vd[o4 + 2] = 30; vd[o4 + 3] = d;
      }
      const av = ik[o4];
      if (av > 6) {
        let v = av / 255 + tt * 0.3 + mo * 0.1 + (tt < -0.4 ? (tt + 0.4) * 1.8 : 0);
        v = (v - 0.36) / 0.26; v = v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v);
        if (v > 0) {
          const dk = 1 - 0.16 * mo - 0.1 * st;    // the block was not inked evenly
          r += (43 * dk - r) * v; g += (33 * dk - g) * v; b += (24 * dk - b) * v;
        }
      }
      pap[o4] = r; pap[o4 + 1] = g; pap[o4 + 2] = b;
    }
  }
  const out = L.makeCanvas(LW, LH), og = out.getContext('2d');
  og.putImageData(img, 0, 0);
  const verm = L.makeCanvas(LW, LH);
  verm.getContext('2d').putImageData(vimg, 0, 0);
  out._pad = PAD; verm._pad = PAD;
  return { out, verm };
}

/** worm holes eaten through the sheet below the platform */
function wormHoles(sheet, a) {
  const g = sheet.getContext('2d'); g.save(); g.translate(PAD, PAD);
  const r = L.rng('s14worm');
  const spots = [[-0.31, -205], [-0.262, -262], [0.045, -330], [0.33, -265], [0.175, -470], [-0.14, -455], [0.395, -120], [-0.4, -420]];
  const trails = [[-0.2, -300, 0.9, 74], [0.27, -360, -0.5, 96], [0.01, -150, 0.25, 58]];
  const hole = (trace) => {
    g.save(); g.translate(1.6, 2.2); g.fillStyle = 'rgba(255,246,214,0.75)'; trace(); g.fill(); g.restore();   // lit edge of the paper's thickness
    g.fillStyle = '#4a3924'; trace(); g.fill();
    g.save(); trace(); g.clip(); g.translate(2.4, 3.2); g.fillStyle = 'rgba(20,12,6,0.55)'; g.globalCompositeOperation = 'source-atop';
    g.restore();
    g.strokeStyle = 'rgba(58,36,16,0.55)'; g.lineWidth = 1.4; trace(); g.stroke();
  };
  for (const [th, dr] of spots) {
    const p = a.pt(th, dr), rad = r.range(6, 13), sq = r.range(0.6, 1), rot = r.range(0, Math.PI), sd = r.range(0, 99), pts = [];
    for (let i = 0; i < 14; i++) {
      const an = (i / 14) * L.TAU, rr = rad * (1 + 0.32 * NZ.n2(Math.cos(an) * 1.6 + sd, Math.sin(an) * 1.6));
      const x = Math.cos(an) * rr, y = Math.sin(an) * rr * sq;
      pts.push([p.x + x * Math.cos(rot) - y * Math.sin(rot), p.y + x * Math.sin(rot) + y * Math.cos(rot)]);
    }
    const q = loop(pts, 3);
    hole(() => { g.beginPath(); q.forEach((v, i) => (i ? g.lineTo(v[0], v[1]) : g.moveTo(v[0], v[1]))); g.closePath(); });
  }
  for (const [th, dr, an, len] of trails) {   // a meandering channel
    const p = a.pt(th, dr), pts = [], sd = r.range(0, 99);
    for (let i = 0; i <= 5; i++) { const u = i / 5 - 0.5; pts.push([p.x + Math.cos(an) * len * u - Math.sin(an) * 14 * NZ.n2(u * 2.2, sd), p.y + Math.sin(an) * len * u + Math.cos(an) * 14 * NZ.n2(u * 2.2, sd)]); }
    const sm = L.smoothPath(pts, 3), A = [], B = [];
    for (let i = 0; i < sm.length; i++) {
      const p0 = sm[Math.max(0, i - 1)], p1 = sm[Math.min(sm.length - 1, i + 1)], nr = unit(-(p1[1] - p0[1]), p1[0] - p0[0]);
      const u = i / (sm.length - 1), hw = (3.2 + 2.4 * NZ.n2(u * 5, sd + 4)) * Math.min(1, Math.sin(u * Math.PI) * 3 + 0.35);
      A.push(add(sm[i], nr, hw)); B.push(add(sm[i], nr, -hw));
    }
    const q = [...A, ...B.reverse()];
    hole(() => { g.beginPath(); q.forEach((v, i) => (i ? g.lineTo(v[0], v[1]) : g.moveTo(v[0], v[1]))); g.closePath(); });
  }
  g.restore();
}

export default {
  name: '铸钱图',
  tone: 'dark',
  init(env) {
    const a = env.arc, P = makePress();
    SID = 0;
    const ptS = (s, dr) => { const p = a.pt(s / a.R, dr); return [p.x, p.y]; };

    platform(P, a);
    ground(P, a);
    // the row of flasks
    const f1 = flask(P, a, { s: -655, dr: 20, w: 118, h: 262, tilt: -0.02, seed: 'a' });
    const f2 = flask(P, a, { s: -58, dr: 22, w: 124, h: 280, tilt: 0.012, seed: 'b' });
    const f3 = flask(P, a, { s: 668, dr: 18, w: 114, h: 254, tilt: 0.03, seed: 'c' });
    // the founders, back to front
    figure(P, a, { seed: 'D', s: 1050, hh: 492, near: 912, far: 1160, lean: 0.05, tunic: { sash: true } });
    const hC = figure(P, a, { seed: 'C', s: 398, hh: 506, near: 318, far: 470, drNear: 5, drFar: 30, lean: 0.03, tunic: {} });
    const hB = figure(P, a, { seed: 'B', s: -338, hh: 470, near: -226, far: -508, drNear: 7, drFar: 26, lean: 0.1, tunic: { ends: [58, -330] } });
    const hA = figure(P, a, { seed: 'A', s: -912, hh: 488, near: -806, far: -1040, lean: 0.08, tunic: { sash: true } });
    // ladles
    ladle(P, { seed: 'A', k: SC, bowl: [f1.gate[0] - 30, f1.gate[1] - 150], from: [hA[0] + 118, hA[1] - 330], tilt: 0.1 });
    ladle(P, { seed: 'Bb', k: SC, bowl: [f2.gate[0] - 62, f2.gate[1] - 112], from: [hB[0] + 150, hB[1] - 260], tilt: 0.52, target: f2.gate });
    ladle(P, { seed: 'Cc', k: SC, bowl: [f3.gate[0] - 58, f3.gate[1] - 128], from: [hC[0] + 120, hC[1] - 300], tilt: 0.44, target: f3.gate });

    const paper = buildPaper(a);
    const { out, verm } = printSheet(a, paper, P);
    wormHoles(out, a);
    // rostrum-camera softness: the ink has sunk into the sheet; the lens loses the corners
    const sheet = L.blurred(out, 0.55), soft = L.blurred(out, 3.6), sg = soft.getContext('2d');
    sg.globalCompositeOperation = 'destination-in';
    sg.fillStyle = L.radial(sg, a.cx + PAD, a.crestY + PAD - 30, 540, 1300, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]);
    sg.fillRect(0, 0, LW, LH);
    sheet.getContext('2d').drawImage(soft, 0, 0);
    sheet._pad = PAD;
    S = { sheet, verm: L.blurred(verm, 1.2), grain: L.grainTex(W + 64, H + 64, { seed: 's14g', amount: 0.45, size: 2 }) };
  },
  draw(ctx, env, p) {
    const fi = Math.round(p * (env.frames - 1)), rr = L.rng('s14f' + fi);
    const rot = lerp(-0.0175, 0.0175, p);          // the page slides ~2° round the circle
    L.blit(ctx, env, S.sheet, { rot });
    // the molten copper flickers: the vermilion block breathes between a thin and a full impression
    L.blit(ctx, env, S.verm, { rot, blend: 'multiply', alpha: 0.1 + 0.6 * rr(), dx: rr.range(-1.2, 1.2), dy: rr.range(-1.2, 1.2) });
    // copy-stand light: a touch brighter left of centre, falling off warm toward the corners
    ctx.save(); ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = L.radial(ctx, 860, 450, 320, 1300, [[0, '#ffffff'], [0.55, '#f6eedb'], [1, '#dcc8a0']]);
    ctx.fillRect(0, 0, W, H); ctx.restore();
    // paper grain jitters from frame to frame
    L.overlayGrain(ctx, S.grain, 0.2, 'overlay', rr.int(0, 63), rr.int(0, 63));
  },
};
