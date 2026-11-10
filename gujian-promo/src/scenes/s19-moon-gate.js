// s19 — 月洞门·夜. Standing on the dark side of a garden wall, looking up through the top of a moon gate (月洞门).
// The arc is the upper edge of the round opening. Just inside it we see the reveal — the brick-lined thickness of the
// wall (砖细门套) — raked by a lantern hanging somewhere behind the wall: hot orange at the front arris, sliding through
// violet to moon-blue at the back edge (the reference shot's iridescent rim). Above: near-black plaster.
// Below: a moonlit Jiangnan garden, a little out of focus — bamboo leaning in from the left, a Taihu rock,
// a hexagonal pavilion with upturned eaves across the pond, mist, and broken silver on the water.
import * as L from '../lib/core.js';

const { W, H, TAU } = L;
const PAD = 240;
const X0 = -PAD, Y0 = -PAD, FULLW = W + PAD * 2, FULLH = H + PAD * 2;
const FW = 214;       // face width of the honed-brick door frame on the wall (outside the opening)
const BW = 100;       // on-screen depth of the reveal (inside the opening)
const HZ = 848;       // far shore waterline (frame y)
const GX = 990;       // axis of the moonlight on the water
const PITCH = 0.305;  // angular length of one brick piece of the frame (a joint never sits on the crest)
let S = null;

// rim colours across the reveal, from its back edge (t = 0) to the front arris on the arc (t = 1)
const WARM = [[0, '#0a1a3c'], [0.1, '#17377f'], [0.22, '#2f68e6'], [0.34, '#5a5cff'], [0.46, '#a04cff'], [0.56, '#e055b8'],
  [0.66, '#ff6e4a'], [0.78, '#ff8a3a'], [0.92, '#ff9c48'], [0.962, '#ffb060'], [0.98, '#ffd9a8'], [1, '#ffe6c0']];
const COOL = [[0, '#0a1c44'], [0.14, '#1c45a8'], [0.3, '#3a7bff'], [0.46, '#5f63ff'], [0.6, '#9a50ff'], [0.73, '#c852f0'],
  [0.84, '#ee5aa6'], [0.92, '#ff7440'], [0.962, '#ff9a50'], [0.98, '#ffd0a0'], [1, '#ffe0c0']];

const jointAngles = () => { const out = []; for (let k = -4; k <= 3; k++) out.push((k + 0.5) * PITCH); return out; };

// skyline of the trees on the far shore (px above the waterline); also used for their reflection
const nzT = L.makeNoise('s19trees');
function treeH(x) {
  const big = 0.5 + 0.5 * nzT.fbm(x * 0.0021 + 3.1, 0.7, 3);
  const mid = nzT.fbm(x * 0.011, 5.3, 3);
  const fine = nzT.n2(x * 0.06, 9.1);
  const side = L.smooth(Math.abs(x - 900) / 900);   // lower in the middle so the moon-haze can breathe
  return 24 + 44 * big + 16 * mid + 4 * fine + 38 * side;
}

/** soft bloom of a layer: downsample → blur → upsample */
function bloom(src, px, down = 4) {
  const w = Math.ceil(src.width / down), h = Math.ceil(src.height / down);
  const small = L.makeCanvas(w, h); const sg = small.getContext('2d');
  sg.filter = `blur(${px / down}px)`; sg.drawImage(src, 0, 0, w, h);
  const out = L.makeCanvas(src.width, src.height); const og = out.getContext('2d');
  og.imageSmoothingEnabled = true; og.imageSmoothingQuality = 'high';
  og.drawImage(small, 0, 0, src.width, src.height);
  out._pad = src._pad;
  return out;
}

/** a clump-built tree crown: dark mass with moonlight dappling its upper-left side */
function canopy(g, cx, cy, rx, ry, seed, opts = {}) {
  const { dark = '#060e1a', light = '#2c4a6e', n = 70, lit = 0.6 } = opts;
  const r = L.rng(seed);
  const clumps = [];
  for (let i = 0; i < n; i++) {
    const ang = r.range(0, TAU), rad = Math.pow(r(), 0.6);
    clumps.push([cx + Math.cos(ang) * rad * rx, cy + Math.sin(ang) * rad * ry, r.range(0.1, 0.22) * Math.min(rx, ry) + 4, r.range(-0.5, 0.5)]);
  }
  g.fillStyle = dark;
  for (const [x, y, rad, rot] of clumps) { g.beginPath(); g.ellipse(x, y, rad * 1.2, rad * 0.8, rot, 0, TAU); g.fill(); }
  for (const [x, y, rad] of clumps) {
    const k = L.clamp(0.55 - (x - cx) / (rx * 2.2) - (y - cy) / (ry * 1.5)) * lit;
    if (k < 0.08) continue;
    for (let j = 0; j < 4; j++) {
      g.fillStyle = L.rgba(light, k * r.range(0.2, 0.7));
      g.beginPath(); g.ellipse(x + r.range(-0.8, 0.3) * rad, y + r.range(-0.75, 0.05) * rad, rad * r.range(0.22, 0.5), rad * r.range(0.1, 0.22), r.range(-0.6, 0.3), 0, TAU); g.fill();
    }
  }
}

// ───────────────────────── far: sky, far shore, water ─────────────────────────
function buildWater() {
  const res = 1 / 3;
  const h = H + PAD - HZ;
  const cw = Math.ceil(FULLW * res), ch = Math.ceil(h * res);
  const img = new ImageData(cw, ch); const d = img.data;
  const nz = L.makeNoise('s19water');
  let k = 0;
  for (let j = 0; j < ch; j++) {
    const y = j / res;                                   // px below the far shore
    const len = 30 + y * 0.5;                            // ripples get longer …
    const v = Math.log(1 + y * 0.01545) / 0.034;         // … and thicker toward the viewer
    const dep = Math.pow(L.clamp(y / 260), 0.65);
    const br = L.lerp(46, 8, dep), bg = L.lerp(78, 17, dep), bb = L.lerp(116, 32, dep);
    const sheenW = 60 + y * 0.8, sheenY = 0.35 + 0.65 * L.clamp(y / 40);
    for (let i = 0; i < cw; i++) {
      const x = i / res - PAD;
      const u = (x - GX) / len;
      const n = nz.fbm(u, v, 3);
      const n2 = nz.n2(u * 0.35 + 9, v * 0.3);
      const th = treeH(x + n * 10) * 0.9;
      const refl = L.smooth((th - y) / 14 + 0.5);        // mirrored tree line, broken by the ripples
      let m = (1 - 0.5 * refl) * (1 + 0.35 * Math.min(0, n) + 0.12 * n2);
      const sx = (x - GX) / sheenW;
      const sheen = Math.exp(-sx * sx) * sheenY;
      const crest = Math.max(0, n + 0.12);
      const add = crest * crest * (22 + 150 * sheen);
      d[k++] = br * m + add * 0.81; d[k++] = bg * m + add * 0.88; d[k++] = bb * m + add * 0.95; d[k++] = 255;
    }
  }
  const small = L.makeCanvas(cw, ch); small.getContext('2d').putImageData(img, 0, 0);
  return { canvas: small, h };
}

function buildFar(env) {
  const a = env.arc;
  const layer = L.makeLayer(PAD, (g) => {
    // sky: darkest right under the gate, hazy and moonlit toward the far shore (the moon itself is hidden above the opening)
    g.fillStyle = L.linear(g, 0, a.crestY + 70, 0, HZ, [[0, '#040912'], [0.32, '#0a1526'], [0.66, '#1b2f4a'], [1, '#32557a']]);
    g.fillRect(X0, Y0, FULLW, HZ - Y0 + 2);
    g.save(); g.globalCompositeOperation = 'screen';
    g.fillStyle = L.radial(g, GX - 10, HZ - 24, 0, 720, [[0, 'rgba(120,160,210,0.40)'], [0.3, 'rgba(76,112,160,0.22)'], [1, 'rgba(30,50,90,0)']]);
    g.fillRect(X0, Y0, FULLW, HZ - Y0 + 2);
    g.restore();
    // thin back-lit cloud
    g.drawImage(L.noiseTex(FULLW, 440, { seed: 's19cloud', scale: 150, sx: 3.2, sy: 1, octaves: 4, warp: 0.35, contrast: 1.35, res: 0.33,
      ramp: [[0, 'rgba(6,12,24,0.6)'], [0.42, 'rgba(6,12,24,0)'], [0.58, 'rgba(150,180,220,0)'], [1, 'rgba(170,198,234,0.3)']] }), X0, HZ - 432);

    // trees on the far shore, sinking into the mist at their feet
    const r = L.rng('s19far');
    g.fillStyle = L.linear(g, 0, HZ - 120, 0, HZ, [[0, '#081322'], [0.6, '#0f1f38'], [1, '#1d3555']]);
    g.beginPath(); g.moveTo(X0, HZ + 2);
    for (let x = X0; x <= W + PAD; x += 4) g.lineTo(x, HZ - treeH(x));
    g.lineTo(W + PAD, HZ + 2); g.closePath(); g.fill();
    for (let x = X0; x <= W + PAD; x += r.range(7, 16)) { const rad = r.range(6, 15); g.beginPath(); g.arc(x, HZ - treeH(x) + rad * 0.3, rad, 0, TAU); g.fill(); }
    canopy(g, 1230, HZ - 86, 110, 50, 's19t2', { n: 80, dark: '#0a1728', light: '#2a4668', lit: 0.5 });

    // the garden's boundary wall across the pond: whitewash pale under the moon, dark tile coping (粉墙黛瓦)
    const wx0 = 610, wx1 = W + PAD, wTop = HZ - 40;
    g.fillStyle = L.linear(g, 0, wTop, 0, HZ, [[0, '#6585ae'], [1, '#456489']]);
    g.fillRect(wx0, wTop, wx1 - wx0, 40);
    g.fillStyle = '#081322';
    g.beginPath(); g.moveTo(wx0 - 9, wTop + 1); g.lineTo(wx0 - 3, wTop - 9); g.lineTo(wx1, wTop - 9); g.lineTo(wx1, wTop + 1); g.closePath(); g.fill();
    g.fillStyle = 'rgba(160,190,228,0.45)'; g.fillRect(wx0 - 3, wTop - 9, wx1 - wx0, 1.6);
    // trees and shrubs on this side of the wall break it up
    canopy(g, 590, HZ - 56, 84, 56, 's19t3', { n: 70, dark: '#0a1728', light: '#2a4668', lit: 0.5 });
    g.fillStyle = '#0c1a2e';
    for (let i = 0; i < 16; i++) { const x = r.range(wx0, 1700), rad = r.range(6, 15); g.beginPath(); g.ellipse(x, HZ - rad * 0.4 + 3, rad * 1.4, rad, 0, 0, TAU); g.fill(); }

    // water
    const wt = buildWater();
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(wt.canvas, X0, HZ, FULLW, wt.h);
    // the white wall's pale reflection
    g.fillStyle = L.linear(g, 0, HZ, 0, HZ + 50, [[0, 'rgba(110,144,190,0.36)'], [1, 'rgba(110,144,190,0)']]);
    g.fillRect(wx0, HZ, wx1 - wx0, 50);
    // waterline: a thread of mist-light where the shore meets the pond
    g.fillStyle = L.linear(g, 0, HZ - 10, 0, HZ + 12, [[0, 'rgba(150,182,222,0)'], [0.5, 'rgba(150,182,222,0.34)'], [1, 'rgba(150,182,222,0)']]);
    g.fillRect(X0, HZ - 10, FULLW, 22);

    // steady part of the moon-glitter (the twinkling part is drawn live)
    const rg = L.rng('s19glitA');
    g.save(); g.globalCompositeOperation = 'screen'; g.fillStyle = '#cfe0f2';
    for (let i = 0; i < 300; i++) {
      const kk = Math.pow(rg(), 1.7), y = HZ + 4 + kk * 270;
      const hw = 14 + (y - HZ) * 0.46;
      const x = GX + rg.gauss() * hw * 0.55;
      const w = (5 + (y - HZ) * 0.09) * rg.range(0.5, 1.5), hh = 1.2 + (y - HZ) * 0.012;
      g.globalAlpha = rg.range(0.2, 0.75) * (1 - 0.5 * kk);
      g.beginPath(); g.ellipse(x, y, w, hh, 0, 0, TAU); g.fill();
    }
    g.restore();
  });
  return L.blurred(layer, 2.4);
}

/** drifting mist over the pond (screened on top of the far layer) */
function buildMist() {
  return L.makeLayer(PAD, (g) => {
    const band = (y0, hgt, seed, alpha, scale) => {
      const t = L.noiseTex(FULLW, hgt, { seed, scale, sx: 7, sy: 1, octaves: 4, warp: 0.6, contrast: 1.7, res: 0.33,
        ramp: [[0, 'rgba(150,180,220,0)'], [0.4, 'rgba(150,180,220,0)'], [1, `rgba(176,204,238,${alpha})`]] });
      const tg = t.getContext('2d');
      tg.globalCompositeOperation = 'destination-in';
      tg.fillStyle = L.linear(tg, 0, 0, 0, hgt, [[0, 'rgba(0,0,0,0)'], [0.5, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
      tg.fillRect(0, 0, FULLW, hgt);
      g.drawImage(t, X0, y0);
    };
    band(HZ - 96, 150, 's19mistA', 0.55, 60);
    band(HZ - 10, 130, 's19mistB', 0.34, 80);
    band(HZ + 70, 170, 's19mistC', 0.2, 110);
  });
}

function makeGlints() {
  const r = L.rng('s19glitB'); const out = [];
  for (let i = 0; i < 170; i++) {
    const k = Math.pow(r(), 1.5);
    const y = HZ + 5 + k * 250;
    const hw = 14 + (y - HZ) * 0.5;
    out.push({ x: GX + r.gauss() * hw * 0.5, y, w: (5 + (y - HZ) * 0.085) * r.range(0.6, 1.5), h: 1.1 + (y - HZ) * 0.011,
      a: r.range(0.35, 1) * (1 - 0.4 * k), ph: r.range(0, TAU), sp: r.range(1.1, 2.7) });
  }
  return out;
}

// ───────────────────────── mid: pavilion on the right bank ─────────────────────────
function pavilion(g, cx, eaveY, baseY) {
  const EW = 196, RH = 110, TIP = 40;
  const colH = baseY - eaveY;
  const dark = '#050b15';
  g.save(); g.translate(cx, eaveY);
  // stone platform (台基) with a moonlit top edge
  g.fillStyle = '#0b1626'; g.fillRect(-176, colH, 352, 18);
  g.fillStyle = 'rgba(120,152,196,0.6)'; g.fillRect(-176, colH, 352, 2.5);
  // far-side bench rail seen through the open bays
  g.fillStyle = 'rgba(8,16,28,0.5)'; g.fillRect(-148, colH - 24, 296, 24);
  // columns: the four we can see of the six
  g.fillStyle = dark;
  for (const x of [-148, -74, 74, 148]) g.fillRect(x - 5.5, 4, 11, colH - 4);
  g.fillStyle = 'rgba(110,142,188,0.5)';
  for (const x of [-148, -74, 74, 148]) g.fillRect(x - 5.5, 30, 2, colH - 30);
  // lintel (额枋) and the hanging fretwork below it (挂落): reads as a half-tone band at this distance
  g.fillStyle = dark; g.fillRect(-152, 6, 304, 9);
  g.fillStyle = 'rgba(5,11,21,0.55)'; g.fillRect(-148, 15, 296, 12);
  g.fillStyle = dark;
  for (const x of [-148, -74, 74, 148]) for (const sg of [-1, 1]) {   // little brackets (雀替) at the column heads
    if ((x === -148 && sg < 0) || (x === 148 && sg > 0)) continue;
    g.beginPath(); g.moveTo(x, 15); g.lineTo(x + sg * 24, 15); g.quadraticCurveTo(x + sg * 8, 20, x + sg * 5, 38); g.lineTo(x, 38); g.closePath(); g.fill();
  }
  // bench rails (坐槛) in the two side bays; the middle bay is the way in
  g.fillStyle = dark;
  g.fillRect(-148, colH - 31, 74, 5); g.fillRect(74, colH - 31, 74, 5);
  g.fillStyle = 'rgba(5,11,21,0.66)';
  g.fillRect(-148, colH - 26, 74, 26); g.fillRect(74, colH - 26, 74, 26);

  // roof: hexagonal 攒尖顶, concave slopes, corners flicking up (翘角)
  const roofPath = () => {
    g.beginPath();
    g.moveTo(-9, -RH);
    g.bezierCurveTo(-30, -RH * 0.42, -EW * 0.55, -15, -EW * 0.78, -10);
    g.quadraticCurveTo(-EW * 0.93, -9, -EW, -TIP);
    g.quadraticCurveTo(-EW * 0.9, 6, -EW * 0.66, 10);
    g.lineTo(-EW * 0.5, 12);
    g.quadraticCurveTo(0, 16, EW * 0.5, 12);
    g.lineTo(EW * 0.66, 10);
    g.quadraticCurveTo(EW * 0.9, 6, EW, -TIP);
    g.quadraticCurveTo(EW * 0.93, -9, EW * 0.78, -10);
    g.bezierCurveTo(EW * 0.55, -15, 30, -RH * 0.42, 9, -RH);
    g.closePath();
  };
  const ridge = (sgn) => { g.moveTo(sgn * 5, -RH + 2); g.bezierCurveTo(sgn * 18, -RH * 0.42, sgn * EW * 0.36, -8, sgn * EW * 0.5, 10); };
  g.save(); roofPath(); g.clip();
  g.fillStyle = L.linear(g, 0, -RH, 0, 14, [[0, '#14263e'], [1, '#0b1728']]);                    // front face
  g.fillRect(-EW - 10, -RH - 10, EW * 2 + 20, RH + 40);
  g.fillStyle = L.linear(g, -EW, -RH * 0.6, -EW * 0.3, 10, [[0, '#3a5d88'], [1, '#1c3350']]);    // left face catches the moon
  g.beginPath(); ridge(-1); g.lineTo(-EW - 10, 30); g.lineTo(-EW - 10, -RH - 10); g.closePath(); g.fill();
  g.fillStyle = '#060d19';                                                                         // right face in shadow
  g.beginPath(); ridge(1); g.lineTo(EW + 10, 30); g.lineTo(EW + 10, -RH - 10); g.closePath(); g.fill();
  // tile rows (瓦垄) fanning down the slopes
  g.lineWidth = 1.4;
  for (let i = -17; i <= 17; i++) {
    const u = i / 17, x1 = u * EW * 0.9;
    g.strokeStyle = u < -0.28 ? 'rgba(160,190,230,0.2)' : 'rgba(0,0,0,0.3)';
    g.beginPath(); g.moveTo(u * 9, -RH + 3); g.quadraticCurveTo(x1 * 0.42, -RH * 0.3, x1, 9); g.stroke();
  }
  // shadow under the eave
  g.fillStyle = L.linear(g, 0, 2, 0, 16, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.6)']]); g.fillRect(-EW, 2, EW * 2, 16);
  g.restore();
  // ridges (戗脊): moonlit on the left
  g.lineCap = 'round';
  g.strokeStyle = dark; g.lineWidth = 5; g.beginPath(); ridge(-1); g.stroke(); g.beginPath(); ridge(1); g.stroke();
  g.strokeStyle = 'rgba(176,204,240,0.75)'; g.lineWidth = 1.8;
  g.beginPath(); g.moveTo(3, -RH + 2); g.bezierCurveTo(-16, -RH * 0.42, -EW * 0.345, -10, -EW * 0.49, 7); g.stroke();
  g.beginPath(); g.moveTo(-9, -RH); g.bezierCurveTo(-30, -RH * 0.42, -EW * 0.55, -15, -EW * 0.78, -10); g.quadraticCurveTo(-EW * 0.93, -9, -EW, -TIP); g.stroke();
  g.strokeStyle = 'rgba(150,180,220,0.3)'; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(9, -RH); g.bezierCurveTo(30, -RH * 0.42, EW * 0.55, -15, EW * 0.78, -10); g.quadraticCurveTo(EW * 0.93, -9, EW, -TIP); g.stroke();
  // front corner horns
  for (const sgn of [-1, 1]) {
    g.fillStyle = dark;
    g.beginPath(); g.moveTo(sgn * EW * 0.43, 2); g.quadraticCurveTo(sgn * EW * 0.53, 10, sgn * EW * 0.61, -TIP * 0.72);
    g.quadraticCurveTo(sgn * EW * 0.56, 12, sgn * EW * 0.46, 13); g.closePath(); g.fill();
    g.strokeStyle = sgn < 0 ? 'rgba(176,204,240,0.7)' : 'rgba(150,180,220,0.35)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(sgn * EW * 0.45, 3); g.quadraticCurveTo(sgn * EW * 0.53, 9, sgn * EW * 0.61, -TIP * 0.72); g.stroke();
  }
  // finial (宝顶)
  g.fillStyle = dark;
  g.beginPath(); g.ellipse(0, -RH - 3, 12, 6, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(0, -RH - 15, 8.5, 9.5, 0, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(-4, -RH - 22); g.lineTo(0, -RH - 40); g.lineTo(4, -RH - 22); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(176,204,240,0.7)'; g.lineWidth = 1.6;
  g.beginPath(); g.arc(0, -RH - 15, 8, Math.PI * 0.85, Math.PI * 1.45); g.stroke();
  g.restore();
}

function buildMid() {
  const layer = L.makeLayer(PAD, (g) => {
    const cx = 1362, eaveY = 862, baseY = 966;
    const nz = L.makeNoise('s19bank');
    // trees behind and to the right of the pavilion
    g.strokeStyle = '#050b15'; g.lineWidth = 12; g.lineCap = 'round';
    g.beginPath(); g.moveTo(1716, 990); g.quadraticCurveTo(1700, 900, 1738, 820); g.stroke();
    canopy(g, 1760, 800, 200, 124, 's19tr1', { n: 150 });
    canopy(g, 2000, 850, 180, 130, 's19tr2', { n: 110 });
    canopy(g, 1640, 930, 80, 46, 's19sh1', { n: 50, lit: 0.4 });
    // the bank and pavilion darken the water in front of them
    g.save(); g.translate(cx + 20, 992); g.scale(1, 0.24);
    g.fillStyle = L.radial(g, 0, 0, 60, 380, [[0, 'rgba(3,7,14,0.78)'], [0.6, 'rgba(3,7,14,0.5)'], [1, 'rgba(3,7,14,0)']]);
    g.fillRect(-400, 0, 800, 400);
    g.restore();
    for (const x of [-148, -74, 74, 148]) {
      g.fillStyle = L.linear(g, 0, 990, 0, 1100, [[0, 'rgba(3,7,14,0.7)'], [1, 'rgba(3,7,14,0)']]);
      g.fillRect(cx + x - 6, 990, 12, 110);
    }
    // the bank: piled rockery embankment (驳岸) curving round toward us at the right
    const top = (x) => 968 + 5 * nz.n2(x * 0.02, 0.4) + 3 * nz.n2(x * 0.09, 3.1) - 40 * L.smooth((x - 1590) / 260);
    g.fillStyle = L.linear(g, 0, 950, 0, 1010, [[0, '#0d1a2c'], [1, '#050b15']]);
    g.beginPath(); g.moveTo(1118, 990);
    g.quadraticCurveTo(1132, 972, 1154, top(1154));
    for (let x = 1154; x <= W + PAD; x += 8) g.lineTo(x, top(x));
    g.lineTo(W + PAD, H + PAD); g.lineTo(1400, H + PAD);
    g.quadraticCurveTo(1560, 1090, 1610, 996);
    for (let x = 1610; x >= 1118; x -= 14) g.lineTo(x, 992 + 3 * nz.n2(x * 0.05, 7.7));
    g.closePath(); g.fill();
    // moonlit lip of the embankment stones
    g.strokeStyle = 'rgba(120,152,196,0.4)'; g.lineWidth = 2;
    g.beginPath(); for (let x = 1154; x <= 1590; x += 8) { if (x === 1154) g.moveTo(x, top(x)); else g.lineTo(x, top(x)); } g.stroke();
    pavilion(g, cx, eaveY, baseY);
    // low rocks and shrubs at the foot of the pavilion
    const r = L.rng('s19rocks');
    g.fillStyle = '#060d19';
    for (let i = 0; i < 12; i++) { const x = r.range(1150, 1610), rad = r.range(7, 16); g.beginPath(); g.ellipse(x, 984 + r.range(-4, 6), rad * 1.4, rad * 0.8, 0, 0, TAU); g.fill(); }
  });
  return L.blurred(layer, 1.7);
}

// ───────────────────────── near: bamboo, Taihu rock, left bank ─────────────────────────
function buildRock(w, h, seed) {
  const c = L.makeCanvas(w, h); const g = c.getContext('2d');
  const nz = L.makeNoise(seed);
  const blob = (bx, by, rx, ry, k, amp = 0.17, rot = 0) => {
    const cr = Math.cos(rot), sr = Math.sin(rot);
    g.beginPath();
    for (let i = 0; i <= 48; i++) {
      const ang = (i / 48) * TAU, cs = Math.cos(ang), sn = Math.sin(ang);
      const rad = 1 + amp * nz.n2(cs * 1.6 + k * 5.1, sn * 1.6 - k * 2.3) + amp * 0.45 * nz.n2(cs * 4.6 + k, sn * 4.6 + k * 3);
      const ex = rx * w * rad * cs, ey = ry * h * rad * sn;
      const x = bx * w + ex * cr - ey * sr, y = by * h + ex * sr + ey * cr;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
  };
  // slender, top-heavy, deeply waisted (瘦 · 云头雨脚)
  const blobs = [[0.54, 0.11, 0.31, 0.085], [0.34, 0.22, 0.24, 0.08], [0.64, 0.31, 0.28, 0.09], [0.43, 0.42, 0.2, 0.075], [0.6, 0.53, 0.25, 0.085],
    [0.4, 0.64, 0.22, 0.075], [0.56, 0.75, 0.28, 0.085], [0.45, 0.88, 0.34, 0.09], [0.5, 1.0, 0.44, 0.08]];
  g.fillStyle = '#081221';
  blobs.forEach(([bx, by, rx, ry], k) => { blob(bx, by, rx, ry, k, 0.12); g.fill(); });
  // the holes (漏 · 透): one long slanting eye near the top, smaller ones scattered down the body
  g.globalCompositeOperation = 'destination-out';
  [[0.5, 0.2, 0.12, 0.034, 1, -0.45], [0.7, 0.33, 0.045, 0.026, 2, 0.7], [0.47, 0.47, 0.085, 0.04, 3, 0.25], [0.66, 0.6, 0.04, 0.022, 4, -0.4],
    [0.42, 0.71, 0.07, 0.028, 5, 0.6], [0.62, 0.83, 0.05, 0.022, 6, -0.2]]
    .forEach(([bx, by, rx, ry, k, rot]) => { blob(bx, by, rx, ry, k + 20, 0.2, rot); g.fill(); });
  // limestone under the moon: a pale shoulder on the upper left, water-worn furrows (皱) running down it
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = L.linear(g, 0, h * 0.05, w * 0.8, h * 0.45, [[0, 'rgba(120,156,204,0.5)'], [0.4, 'rgba(70,104,150,0.2)'], [0.75, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.3)']]);
  g.fillRect(0, 0, w, h);
  g.drawImage(L.noiseTex(w, h, { seed: seed + 'fur', scale: 50, sx: 0.8, sy: 1.8, octaves: 3, ridged: true, warp: 0.8, contrast: 1.4, res: 0.5,
    ramp: [[0, 'rgba(2,6,12,0.7)'], [0.4, 'rgba(2,6,12,0.2)'], [0.62, 'rgba(2,6,12,0)'], [0.82, 'rgba(160,190,230,0)'], [1, 'rgba(176,204,240,0.3)']] }), 0, 0);
  // its foot sinks into the shadow of the bank
  g.fillStyle = L.linear(g, 0, h * 0.5, 0, h * 0.78, [[0, 'rgba(3,7,14,0)'], [1, 'rgba(3,7,14,0.85)']]);
  g.fillRect(0, 0, w, h);
  // moon rim: upper-left edges of the mass and the far lips of the holes
  const rim = L.makeCanvas(w, h); const rg = rim.getContext('2d');
  rg.drawImage(c, 0, 0);
  rg.globalCompositeOperation = 'source-in'; rg.fillStyle = '#b4cff0'; rg.fillRect(0, 0, w, h);
  rg.globalCompositeOperation = 'destination-out'; rg.drawImage(c, 2.4, 3);
  g.globalAlpha = 0.62; g.drawImage(rim, 0, 0);
  return c;
}

function leafPath(g, len, wid, bend) {
  g.beginPath(); g.moveTo(0, 0);
  g.bezierCurveTo(len * 0.22, -wid, len * 0.62, -wid * 0.85 + bend * 0.5, len, bend);
  g.bezierCurveTo(len * 0.62, wid * 0.5 + bend * 0.6, len * 0.24, wid * 0.72, 0, 0);
  g.closePath();
}

function buildNear(env) {
  const a = env.arc;
  const layer = L.makeLayer(PAD, (g) => {
    const r = L.rng('s19bamboo');
    const nz = L.makeNoise('s19near');
    // the Taihu rock beside the bamboo (竹石), a pierced silhouette against the moonlit water
    g.drawImage(buildRock(220, 420, 's19rock'), 646, 792);
    // near bank
    const top = (x) => 938 + 0.09 * x + 0.00013 * x * x + 6 * nz.n2(x * 0.016, 1.1) + 3 * nz.n2(x * 0.08, 4.2);
    g.fillStyle = L.linear(g, 0, 930, 0, 1090, [[0, '#0a1626'], [0.3, '#050b15'], [1, '#03070e']]);
    g.beginPath(); g.moveTo(X0, top(X0));
    for (let x = X0; x <= 800; x += 8) g.lineTo(x, top(x));
    g.quadraticCurveTo(860, 1120, 700, H + PAD); g.lineTo(X0, H + PAD); g.closePath(); g.fill();
    // grass blades along its edge
    g.lineCap = 'round';
    for (let i = 0; i < 150; i++) {
      const x = r.range(X0, 800), y = top(x) + 3, len = r.range(10, 34), lean = r.range(-0.6, 0.6);
      g.strokeStyle = r.chance(0.3) ? 'rgba(96,128,172,0.55)' : '#050b15'; g.lineWidth = r.range(1, 2.4);
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + lean * len * 0.4, y - len * 0.6, x + lean * len, y - len); g.stroke();
    }

    // bamboo culms leaning in from the left, their tops hidden behind the wall
    const culm = (x0, y0, x1, y1, wd) => {
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
      const pt = (t) => [x0 + dx * t + nx * 26 * Math.sin(t * Math.PI), y0 + dy * t + ny * 26 * Math.sin(t * Math.PI)];
      const seg = 104 / len;
      for (let t = 0; t < 1; t += seg) {
        const [ax, ay] = pt(t + 0.004), [bx, by] = pt(Math.min(1, t + seg) - 0.004);
        g.strokeStyle = '#050b15'; g.lineWidth = wd; g.lineCap = 'butt';
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
        g.strokeStyle = 'rgba(120,152,200,0.5)'; g.lineWidth = wd * 0.2;
        g.beginPath(); g.moveTo(ax + nx * wd * 0.3, ay + ny * wd * 0.3); g.lineTo(bx + nx * wd * 0.3, by + ny * wd * 0.3); g.stroke();
        // node ring
        g.strokeStyle = '#050b15'; g.lineWidth = 3.4;
        g.beginPath(); g.moveTo(bx - nx * (wd * 0.5 + 2), by - ny * (wd * 0.5 + 2)); g.lineTo(bx + nx * (wd * 0.5 + 2), by + ny * (wd * 0.5 + 2)); g.stroke();
      }
    };
    culm(150, 1200, 500, 560, 13);
    culm(-20, 1130, 380, 560, 11);
    culm(290, 1210, 560, 600, 9);

    // leafy sprays arching into the opening
    const leaf = (x, y, ang, len, wid, col, rimCol) => {
      g.save(); g.translate(x, y); g.rotate(ang);
      const bend = r.range(-0.1, 0.16) * len;
      g.fillStyle = col; leafPath(g, len, wid, bend); g.fill();
      if (rimCol) { g.strokeStyle = rimCol; g.lineWidth = 1.5; g.beginPath(); g.moveTo(2, -1); g.bezierCurveTo(len * 0.22, -wid, len * 0.62, -wid * 0.85 + bend * 0.5, len, bend); g.stroke(); }
      g.restore();
    };
    const sprays = [
      [330, 706, 500, 668, 668, 806], [392, 660, 590, 628, 760, 772], [300, 770, 440, 760, 566, 896],
      [236, 816, 356, 826, 452, 962], [452, 640, 640, 610, 812, 716], [200, 880, 300, 900, 372, 1010],
    ];
    sprays.forEach(([sx, sy, mx, my, ex, ey], si) => {
      const P = (t) => [(1 - t) * (1 - t) * sx + 2 * (1 - t) * t * mx + t * t * ex, (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * my + t * t * ey];
      // the twig
      g.strokeStyle = '#050b15'; g.lineCap = 'round';
      for (let i = 0; i < 24; i++) { const p0 = P(i / 24), p1 = P((i + 1) / 24); g.lineWidth = L.lerp(4.2, 1.2, i / 24); g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke(); }
      for (let t = 0.2; t <= 1.001; t += r.range(0.085, 0.13)) {
        const [x, y] = P(t), [x2, y2] = P(Math.min(1, t + 0.02)), [x1, y1] = P(t - 0.02);
        const tan = Math.atan2(y2 - y1, x2 - x1);
        const n = t > 0.97 ? 5 : r.int(3, 5);
        for (let j = 0; j < n; j++) {
          const fan = (j - (n - 1) / 2) * r.range(0.3, 0.46);
          const ang = L.lerp(tan, Math.PI * 0.42, 0.62) + fan + r.range(-0.12, 0.12);   // leaves hang, splayed like the character 个
          const len = r.range(64, 122) * (0.8 + 0.3 * t), wid = len * r.range(0.11, 0.15);
          const lit = r.chance(0.34);
          // leaves closest to the gate pick up a little of the lantern
          const warm = L.clamp(1 - (-a.drAt(x, y) - BW) / 150) * (r.chance(0.5) ? 1 : 0);
          const rimCol = warm > 0.2 ? `rgba(255,150,84,${(0.5 * warm).toFixed(3)})` : lit ? 'rgba(150,184,228,0.6)' : null;
          leaf(x, y, ang, len, wid, lit ? '#152a44' : '#040a13', rimCol);
        }
      }
    });
  });
  return L.blurred(layer, 1.1);
}

// ───────────────────────── the gate ─────────────────────────
/** the lit reveal: the brick-lined inner face of the opening, front arris exactly on the arc */
function buildBand(env) {
  const a = env.arc, s = a.span(PAD + 160);
  const ring = (stops) => L.makeLayer(PAD, (g) => {
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - BW, a.R, stops);
    a.pathBand(g, 0, -BW, -s, s); g.fill();
  });
  const warm = ring(WARM), cool = ring(COOL);
  { // the lantern hangs to the left: warm there, sliding to violet-blue toward the right
    const g = cool.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = L.linear(g, PAD + 480, 0, PAD + 1900, 0, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]);
    g.fillRect(0, 0, cool.width, cool.height);
  }
  const speck = L.polarNoiseLayer(env, PAD, { seed: 's19brick', scale: 7, sx: 3.2, sy: 1, octaves: 3, contrast: 1.5, res: 0.5, ramp: [[0, '#9c9c9c'], [0.5, '#e2e2e2'], [1, '#ffffff']] });
  const streak = L.polarNoiseLayer(env, PAD, { seed: 's19rub', scale: 36, sx: 9, sy: 0.5, octaves: 4, contrast: 1.5, res: 0.4, ramp: [[0, '#8a8a8a'], [0.5, '#dcdcdc'], [1, '#ffffff']] });
  const layer = L.makeLayer(PAD, (g) => {
    g.drawImage(warm, X0, Y0); g.drawImage(cool, X0, Y0);
    g.save(); a.clipBand(g, 0, -BW, -s, s);
    // honed-brick surface: fine speckle + faint rubbing marks along the curve
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = 0.5; g.drawImage(speck, X0, Y0);
    g.globalAlpha = 0.4; g.drawImage(streak, X0, Y0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    // each brick piece takes the light a little differently
    const r = L.rng('s19pieces'); const th = jointAngles();
    for (let i = 0; i < th.length - 1; i++) {
      const v = r.range(-1, 1);
      g.fillStyle = v < 0 ? `rgba(8,4,24,${(-v * 0.16).toFixed(3)})` : `rgba(255,240,230,${(v * 0.09).toFixed(3)})`;
      a.pathBand(g, 0, -BW, th[i], th[i + 1]); g.fill();
    }
    // the lantern is nearest the upper left of the opening; light thins out toward the right
    g.fillStyle = L.linear(g, 0, 0, W, 0, [[0, 'rgba(6,4,20,0.14)'], [0.3, 'rgba(6,4,20,0)'], [0.62, 'rgba(6,4,20,0.04)'], [1, 'rgba(6,4,20,0.3)']]);
    g.fillRect(X0, Y0, FULLW, FULLH);
    // where the lantern hangs closest, the brick burns a little hotter
    g.save(); g.globalCompositeOperation = 'screen';
    const hp = a.pt(-0.2, -26);
    g.translate(hp.x, hp.y); g.rotate(-0.2); g.scale(1, 0.16);
    g.fillStyle = L.radial(g, 0, 0, 0, 520, [[0, 'rgba(255,226,180,0.42)'], [0.5, 'rgba(255,190,130,0.16)'], [1, 'rgba(255,170,110,0)']]);
    g.fillRect(-540, -540, 1080, 1080);
    g.restore();
    // hairline joints between the pieces (磨砖对缝)
    for (const t of th) a.at(g, t, 0, () => {
      g.fillStyle = 'rgba(14,6,30,0.62)'; g.fillRect(-1.3, -1, 2.6, BW + 2);
      g.fillStyle = 'rgba(255,236,220,0.28)'; g.fillRect(1.3, 0, 1.2, BW * 0.72);
    });
    // back arris: a thread of moonlight where the reveal ends
    g.strokeStyle = 'rgba(207,224,242,0.34)'; g.lineWidth = 1.5; a.stroke(g, -BW + 1.6, -s, s);
    // a shallow bead moulding (线脚) behind the front arris
    g.strokeStyle = 'rgba(70,16,10,0.42)'; g.lineWidth = 2; a.stroke(g, -15, -s, s);
    g.strokeStyle = 'rgba(255,236,206,0.4)'; g.lineWidth = 1.4; a.stroke(g, -17.2, -s, s);
    g.restore();
  });
  return L.filtered(layer, 'saturate(1.3) contrast(1.06)');
}

function buildWall(env, band) {
  const a = env.arc, s = a.span(PAD + 160);
  // warm light catching the rounded front edge of the frame and dying out on its face
  const spill = L.makeLayer(PAD, (t) => {
    t.fillStyle = L.radial(t, a.cx, a.cy, a.R - 2, a.R + 70, [[0, 'rgba(255,255,255,0.62)'], [0.05, 'rgba(255,255,255,0.4)'], [0.12, 'rgba(255,255,255,0.2)'],
      [0.24, 'rgba(255,255,255,0.08)'], [0.5, 'rgba(255,255,255,0.03)'], [1, 'rgba(255,255,255,0)']]);
    a.pathBand(t, 70, -2, -s, s); t.fill();
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = L.linear(t, 200, 0, 1720, 0, [[0, '#ff8a3a'], [0.5, '#ff7a44'], [1, '#d85cb8']]);
    t.fillRect(X0, Y0, FULLW, FULLH);
  });
  return L.makeLayer(PAD, (g) => {
    // ── whitewashed wall (粉墙) in deep shadow ──
    g.save(); a.clipAbove(g, -1.5);
    g.drawImage(L.noiseTex(FULLW, FULLH, { seed: 's19plaster', scale: 340, octaves: 5, warp: 0.7, res: 0.25, contrast: 1.3,
      ramp: [[0, '#07090e'], [0.5, '#0b0d14'], [1, '#11141e']] }), X0, Y0);
    // lime-wash blotches, fine tooth, and the faint downward weathering every garden wall carries
    g.drawImage(L.noiseTex(FULLW, FULLH, { seed: 's19blotch', scale: 64, octaves: 4, warp: 0.3, res: 0.33, contrast: 1.5,
      ramp: [[0, 'rgba(0,0,0,0.34)'], [0.46, 'rgba(0,0,0,0)'], [0.56, 'rgba(150,170,215,0)'], [1, 'rgba(150,170,215,0.06)']] }), X0, Y0);
    g.drawImage(L.noiseTex(FULLW, FULLH, { seed: 's19tooth', scale: 5, octaves: 2, res: 0.5, contrast: 1.8,
      ramp: [[0, 'rgba(0,0,0,0.3)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(160,180,220,0.05)']] }), X0, Y0);
    g.drawImage(L.noiseTex(FULLW, FULLH, { seed: 's19stain', scale: 90, sx: 0.32, sy: 7, octaves: 3, res: 0.25, contrast: 1.5,
      ramp: [[0, 'rgba(0,0,0,0.26)'], [0.4, 'rgba(0,0,0,0)'], [0.7, 'rgba(130,150,200,0)'], [1, 'rgba(130,150,200,0.035)']] }), X0, Y0);
    L.speckle(g, { seed: 's19pits', count: 2600, x: X0, y: Y0, w: FULLW, h: FULLH, rMin: 0.5, rMax: 1.7, colors: ['#000000', '#1c2233', '#05060a'], alpha: [0.2, 0.6] });
    // a breath of sky-light on the upper corners
    g.globalCompositeOperation = 'screen';
    g.fillStyle = L.radial(g, -120, -260, 100, 1000, [[0, 'rgba(44,60,98,0.2)'], [1, 'rgba(44,60,98,0)']]); g.fillRect(X0, Y0, FULLW, FULLH);
    g.fillStyle = L.radial(g, W + 120, -260, 100, 1000, [[0, 'rgba(40,54,92,0.16)'], [1, 'rgba(40,54,92,0)']]); g.fillRect(X0, Y0, FULLW, FULLH);
    g.restore();

    // ── 砖细门套: the honed grey-brick frame, smoother and a shade darker than the plaster ──
    const th = jointAngles(); const r = L.rng('s19face');
    g.save(); a.clipBand(g, FW, -1.5, -s, s);
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R, a.R + FW, [[0, '#0c0e16'], [0.25, '#07090f'], [1, '#080a11']]);
    g.fillRect(X0, Y0, FULLW, FULLH);
    for (let i = 0; i < th.length - 1; i++) {
      const v = r.range(-1, 1);
      g.fillStyle = v < 0 ? `rgba(0,0,0,${(-v * 0.22).toFixed(3)})` : `rgba(120,140,190,${(v * 0.035).toFixed(3)})`;
      a.pathBand(g, FW, -1.5, th[i], th[i + 1]); g.fill();
    }
    g.globalAlpha = 0.5;
    g.drawImage(L.noiseTex(FULLW, FULLH, { seed: 's19hone', scale: 9, octaves: 3, res: 0.5, contrast: 1.6,
      ramp: [[0, 'rgba(0,0,0,0.5)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(150,170,215,0.07)']] }), X0, Y0);
    g.globalAlpha = 1;
    for (const t of th) a.at(g, t, 0, () => {
      g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(-1, -FW, 2, FW + 2);
      g.fillStyle = 'rgba(130,150,200,0.07)'; g.fillRect(1, -FW, 1.2, FW);
    });
    g.restore();
    // outer edge of the frame: it stands a finger proud of the plaster
    g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 3; a.stroke(g, FW - 2.5, -s, s);
    g.strokeStyle = 'rgba(126,146,196,0.2)'; g.lineWidth = 1.6; a.stroke(g, FW, -s, s);
    // edge bead on the face + the quirk behind it
    g.save(); g.globalCompositeOperation = 'screen'; g.drawImage(spill, X0, Y0); g.restore();
    g.strokeStyle = 'rgba(0,0,0,0.85)'; g.lineWidth = 2.2; a.stroke(g, 16, -s, s);
    g.strokeStyle = 'rgba(126,146,196,0.1)'; g.lineWidth = 1.2; a.stroke(g, 18.4, -s, s);

    // night pooling just behind the reveal, so the rim reads as light
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - BW - 170, a.R - BW + 2, [[0, 'rgba(2,5,12,0)'], [0.55, 'rgba(2,5,12,0.2)'], [1, 'rgba(2,5,12,0.62)']]);
    a.pathBand(g, -BW + 2, -BW - 170, -s, s); g.fill();

    // ── the lit reveal, front arris exactly on the arc ──
    g.drawImage(band, X0, Y0);
  });
}

function drawGlints(ctx, env) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = '#cfe0f2';
  for (const q of S.glints) {
    const tw = 0.5 + 0.5 * Math.sin(q.ph + env.frame * q.sp);
    const al = q.a * (0.2 + 0.8 * tw * tw);
    ctx.globalAlpha = al * 0.28; ctx.beginPath(); ctx.ellipse(q.x, q.y, q.w * 1.9, q.h * 2.8, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = al; ctx.beginPath(); ctx.ellipse(q.x, q.y, q.w, q.h, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

export default {
  name: '月洞门·夜',
  tone: 'light',
  init(env) {
    const band = buildBand(env);
    S = {
      far: buildFar(env), mist: buildMist(), mid: buildMid(), near: buildNear(env),
      wall: buildWall(env, band), glowS: bloom(band, 9, 2), glowL: bloom(band, 44, 6), glints: makeGlints(),
    };
  },
  draw(ctx, env, p) {
    // walking toward the gate: the wall swells about the crest (exactly on the arc at mid-shot), the garden barely changes
    const zW = L.lerp(0.986, 1.014, p), k = zW - 1;
    ctx.fillStyle = '#04070d'; ctx.fillRect(0, 0, W, H);
    const far = { zoom: 1 + k * 0.2, dx: L.lerp(-5, 5, p) };
    L.blit(ctx, env, S.far, far);
    L.cam(ctx, env, far, () => drawGlints(ctx, env));
    L.blit(ctx, env, S.mist, { zoom: 1 + k * 0.3, dx: L.lerp(-12, 12, p), blend: 'screen', alpha: 0.9 });
    L.blit(ctx, env, S.mid, { zoom: 1 + k * 0.4, dx: L.lerp(-2.5, 2.5, p) });
    L.blit(ctx, env, S.near, { zoom: 1 + k * 0.72 });
    L.blit(ctx, env, S.wall, { zoom: zW });
    // lantern light breathing on the brick
    const fl = 0.93 + 0.07 * Math.sin(env.frame * 2.1 + 0.6);
    L.blit(ctx, env, S.glowS, { zoom: zW, blend: 'screen', alpha: 0.7 * fl });
    L.blit(ctx, env, S.glowL, { zoom: zW, blend: 'screen', alpha: 0.5 * fl });
  },
};
