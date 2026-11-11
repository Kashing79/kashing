// s20 — 窑洞灯火. Dusk at a Shaanbei cave dwelling (窑洞), seen as if through rising heat: everything is out of focus.
// The arc is the crown of the arched window. Above it: a clean wash of warm air, orange overhead deepening to an
// ember red right at the arch. Below it: the window's fan of papered panes glowing from the lamp inside, melted into
// a row of soft warm light-spots, and under them one lit pane carrying a single red paper-cut (窗花), defocused.
import * as L from '../lib/core.js';

const { W, H } = L;
const PAD = 110;                      // the move is a ±1.2 % push-in
const FW = W + PAD * 2, FH = H + PAD * 2;
const FRAME = 20;                     // dark head of the window frame, just under the arc: the arc is where the glow meets it
const BAND = 150;                     // depth of the fan of radial panes
const RAIL = 26;                      // rail that closes the fan
const RED = '#c81e14';
let S = null;

/** cheap wide blur: downsample ×k, blur, upsample back to a full padded layer */
function soft(src, px, k = 4) {
  const w = Math.ceil(src.width / k), h = Math.ceil(src.height / k);
  const s = L.makeCanvas(w, h), sg = s.getContext('2d');
  sg.imageSmoothingEnabled = true; sg.imageSmoothingQuality = 'high';
  sg.filter = `blur(${(px / k).toFixed(2)}px)`;
  sg.drawImage(src, 0, 0, w, h);
  const o = L.makeCanvas(src.width, src.height), og = o.getContext('2d');
  og.imageSmoothingEnabled = true; og.imageSmoothingQuality = 'high';
  og.drawImage(s, 0, 0, src.width, src.height);
  o._pad = src._pad;
  return o;
}

// ───────────────────────── the one paper-cut: 八瓣团花 ─────────────────────────
function papercut(R) {
  const size = Math.ceil(R * 2 + 8);
  const c = L.makeCanvas(size, size), g = c.getContext('2d');
  g.translate(size / 2, size / 2); g.scale(R, R);
  const ring = (n, phase, fn) => { for (let i = 0; i < n; i++) { g.save(); g.rotate(phase + (i * L.TAU) / n); fn(i); g.fill(); g.restore(); } };
  const petal = (r0, r1, w) => () => {
    g.beginPath(); g.moveTo(0, -r0);
    g.bezierCurveTo(w * 1.3, -L.lerp(r0, r1, 0.32), w * 0.8, -L.lerp(r0, r1, 0.8), 0, -r1);
    g.bezierCurveTo(-w * 0.8, -L.lerp(r0, r1, 0.8), -w * 1.3, -L.lerp(r0, r1, 0.32), 0, -r0); g.closePath();
  };
  const drop = (r0, r1, w) => () => {
    g.beginPath(); g.moveTo(0, -r0);
    g.bezierCurveTo(w * 0.5, -L.lerp(r0, r1, 0.5), w * 1.35, -r1, 0, -r1);
    g.bezierCurveTo(-w * 1.35, -r1, -w * 0.5, -L.lerp(r0, r1, 0.5), 0, -r0); g.closePath();
  };
  const dot = (rc, rad) => () => { g.beginPath(); g.arc(0, -rc, rad, 0, L.TAU); };
  const disc = (rad) => { g.beginPath(); g.arc(0, 0, rad, 0, L.TAU); g.fill(); };
  const E = Math.PI / 8;
  g.fillStyle = RED;
  ring(8, 0, petal(0.5, 1.0, 0.23));
  ring(8, E, dot(0.775, 0.18));
  disc(0.745);
  g.globalCompositeOperation = 'destination-out';   // only the big cuts survive the defocus, so cut only big ones
  ring(8, 0, petal(0.7, 0.94, 0.09));
  ring(8, E, drop(0.2, 0.55, 0.15));
  ring(8, 0, drop(0.08, 0.22, 0.06));
  return c;
}

// ───────────────────────── above the arc: warm air ─────────────────────────
function buildSky(a) {
  return L.makeLayer(PAD, (g) => {
    // ember red hugging the arch, opening to a clean orange overhead
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R, a.R + 980, [
      [0, '#a8141a'], [0.03, '#b51f1c'], [0.09, '#c2341d'], [0.18, '#cd4c1f'], [0.32, '#d6631f'],
      [0.5, '#db7323'], [0.72, '#d87224'], [1, '#c86222']]);
    g.fillRect(-PAD, -PAD, FW, FH);
    // the corners cool off a little — a lens, not a flat swatch
    const rad = Math.hypot(W / 2, H / 2);
    g.fillStyle = L.radial(g, W / 2, 380, rad * 0.35, rad * 1.1, [[0, 'rgba(120,28,14,0)'], [1, 'rgba(120,28,14,0.42)']]);
    g.fillRect(-PAD, -PAD, FW, FH);
    // very broad, very faint unevenness of air (same hue, only value)
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.12;
    g.drawImage(L.noiseTex(FW, FH, { seed: 's20air', scale: 520, octaves: 2, res: 0.12, contrast: 1.2 }), -PAD, -PAD);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  });
}

// ───────────────────────── below the arc: the glowing window ─────────────────────────
function buildWindow(a) {
  const r = L.rng('s20win');
  const ramp = L.makeRamp([[0, '#3c0c0c'], [0.3, '#8a2612'], [0.55, '#d0581a'], [0.78, '#f59a32'], [1, '#ffd88a']]);
  const lampX = a.cx, lampY = a.crestY + 330;
  const heat = (x, y) => L.clamp(1 - Math.hypot((x - lampX) / 1250, (y - lampY) / 700));
  // dark interior + the fan of panes, lit
  const fan = L.makeLayer(PAD, (g) => {
    g.save(); a.clipBelow(g, 0);
    g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 1000, a.R, [[0, '#120304'], [0.55, '#220607'], [0.9, '#3a0b0c'], [1, '#4a0e10']]);
    g.fillRect(-PAD, -PAD, FW, FH);
    // the fan: panes between radial ribs
    const pitch = 118 / a.R, s = a.span(PAD + 200);
    for (let i = -Math.ceil(s / pitch); i <= Math.ceil(s / pitch); i++) {
      const t0 = (i - 0.5) * pitch, t1 = (i + 0.5) * pitch, gap = (34 + r.range(-6, 10)) / a.R;
      const mid = a.pt(i * pitch, -FRAME - BAND / 2);
      const b = L.clamp(0.2 + 0.66 * heat(mid.x, mid.y) + r.range(-0.14, 0.1));
      g.fillStyle = L.css(ramp(b));
      a.pathBand(g, -FRAME - r.range(0, 4), -FRAME - BAND + r.range(-4, 4), t0 + gap / 2, t1 - gap / 2); g.fill();
      // each pane brightest toward its lower middle, where the lamp is nearest
      g.fillStyle = L.rgba('#ffe2a0', 0.35 * b);
      a.pathBand(g, -FRAME - BAND * 0.45, -FRAME - BAND + 8, t0 + gap, t1 - gap); g.fill();
    }
    g.restore();
  });
  // the panes of the square lattice below the rail: dimmer, deeper in the haze, one lit pane in the middle
  const low = L.makeLayer(PAD, (g) => {
    g.save(); a.clipBelow(g, -FRAME - BAND - RAIL);
    const top = a.crestY + FRAME + BAND + RAIL, P = 214, M = 30;
    for (let row = 0; row < 3; row++) {
      for (let k = -6; k <= 5; k++) {
        const x = a.cx + k * P + P / 2 - (row === 0 ? 0 : 0), y = top + row * P;
        if (row < 2 && (k === -1 || k === 0)) continue;           // the tall middle pane is drawn on its own
        const b = L.clamp(0.04 + 0.5 * heat(x + P / 2, y + P / 2) + r.range(-0.1, 0.08)) * (row === 2 ? 0.5 : 0.8);
        g.fillStyle = L.css(ramp(b));
        g.fillRect(x - P / 2 + M / 2 + P / 2 - P / 2, y + M / 2, P - M + r.range(-6, 6), P - M);
      }
    }
    // middle pane: two cells wide/tall, lamp right behind it
    const mx = a.cx, my = top + P - 4, mw = P * 2 - M, mh = P * 2 - M;
    g.fillStyle = L.radial(g, mx - 30, my + 40, 0, 330, [[0, '#fff1c4'], [0.25, '#ffd27a'], [0.6, '#f7a23a'], [1, '#d8661c']]);
    g.fillRect(mx - mw / 2, my - mh / 2, mw, mh);
    g.restore();
  });
  // the one flower: drawn into the lit middle pane, red holding back the light
  const flower = L.makeLayer(PAD, (g) => {
    const top = a.crestY + FRAME + BAND + RAIL, P = 214;
    const pc = papercut(168);
    g.translate(a.cx, top + P - 4); g.rotate(0.04);
    g.drawImage(pc, -pc.width / 2, -pc.height / 2);
  });
  // vertical glints: light catching the uprights, the way the reference smears its lights downward
  const streaks = L.makeLayer(PAD, (g) => {
    g.save(); a.clipBelow(g, -FRAME - BAND - 10);
    for (let i = 0; i < 70; i++) {
      const x = r.range(-PAD, W + PAD), y0 = a.yAt(L.clamp(x, 0, W), -FRAME - BAND - 20) + r.range(0, 140);
      const len = r.range(60, 260), w = r.range(3, 9);
      const b = heat(x, y0 + len / 2);
      g.fillStyle = L.linear(g, 0, y0, 0, y0 + len, [[0, L.rgba('#ff9a3a', 0)], [0.3, L.rgba('#ffa040', 0.18 + 0.4 * b)], [1, L.rgba('#ff9a3a', 0)]]);
      g.fillRect(x, y0, w, len);
    }
    g.restore();
  });
  return L.makeLayer(PAD, (g) => {
    g.drawImage(soft(fan, 20, 2), -PAD, -PAD);
    g.drawImage(soft(low, 34, 4), -PAD, -PAD);
    g.globalCompositeOperation = 'multiply'; g.drawImage(soft(flower, 11, 2), -PAD, -PAD);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 0.5; g.drawImage(soft(flower, 11, 2), -PAD, -PAD);
    g.globalAlpha = 1; g.globalCompositeOperation = 'screen'; g.drawImage(soft(streaks, 8, 2), -PAD, -PAD);
    g.globalCompositeOperation = 'source-over';
    // haze settles toward the sill: the bottom of the frame sinks into dark wine
    g.fillStyle = L.linear(g, 0, a.crestY + 260, 0, H + PAD, [[0, 'rgba(22,4,6,0.1)'], [1, 'rgba(22,4,6,0.85)']]);
    g.fillRect(-PAD, -PAD, FW, FH);
  });
}

export default {
  name: '窑洞灯火',
  tone: 'light',
  init(env) {
    const a = env.arc;
    const sky = buildSky(a);
    const win = buildWindow(a);
    const sharp = L.makeLayer(PAD, (g) => {
      g.drawImage(sky, -PAD, -PAD);
      g.save(); a.clipBelow(g, 0); g.drawImage(win, -PAD, -PAD); g.restore();
    });
    // the arch edge itself is only slightly soft; the window light bleeds through the heat in a wide bloom
    const edge = soft(sharp, 5, 1);
    const bloom = soft(win, 90, 6);
    const scene = L.makeLayer(PAD, (g) => {
      g.drawImage(edge, -PAD, -PAD);
      // ember rim straddling the arch, like the reference's red halo
      g.globalCompositeOperation = 'screen';
      g.fillStyle = L.radial(g, a.cx, a.cy, a.R - 70, a.R + 90, [[0, 'rgba(200,30,20,0)'], [0.42, 'rgba(210,40,22,0.32)'], [0.5, 'rgba(220,52,26,0.38)'], [0.62, 'rgba(210,40,22,0.18)'], [1, 'rgba(200,30,20,0)']]);
      g.fillRect(-PAD, -PAD, FW, FH);
      g.globalAlpha = 0.3; g.drawImage(bloom, -PAD, -PAD);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      // a whisper of grain so the blur reads as a photograph
      g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.08;
      g.drawImage(L.grainTex(FW, FH, { seed: 's20g', amount: 0.5, size: 1 }), -PAD, -PAD);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    });
    S = { scene, lamp: { x: a.cx, y: a.crestY + 330 } };
  },
  draw(ctx, env, p) {
    const a = env.arc, f = env.frame;
    const zoom = L.lerp(0.988, 1.012, p);
    L.blit(ctx, env, S.scene, { zoom });
    // oil-lamp flicker (deterministic) breathing through the paper
    const fl = 0.5 + 0.5 * (0.62 * Math.sin(f * 2.3 + 0.6) + 0.38 * Math.sin(f * 5.1 + 1.9));
    const ly = a.crestY + (S.lamp.y - a.crestY) * zoom;
    L.glow(ctx, a.cx, ly, 420, '#ffc070', 0.05 + 0.06 * fl);
  },
};
