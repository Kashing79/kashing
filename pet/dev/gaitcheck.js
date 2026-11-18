// 开发用：检查两只狗跑起来像不像真的。
// 用法：node pet/dev/gaitcheck.js [-v]
//
// 让每只狗用几种固定的速度一直往前跑，量三样东西：
//   1. 脚打不打滑：脚踩在地上的那段时间里，它在"地面上"的位置应该一动不动（身体从它上面过去）。
//      量的是这段时间里脚掌最多挪了多少（世界单位）。慢走、小跑 ≤ 0.6，飞奔 ≤ 1.0 才算过。
//   2. 落脚的先后：把一整步分成十份，画出每一份里哪只脚在地上。
//      慢走：任何时候至少两只脚在地上；飞奔：一定有四脚腾空的时候。
//   3. 步幅和步频：都应该随着速度变大（和 R2 研究里的表差不超过 5%）。
// 有一项不过，退出码就不是 0。
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const VERBOSE = process.argv.includes('-v');
const src = fs.readFileSync(path.join(__dirname, '..', 'web', 'dogs.js'), 'utf8');
const ctx = vm.createContext({});          // 空环境：没有 window、没有 DOM
vm.runInContext(src, ctx, { filename: 'dogs.js' });
const D = vm.runInContext('PET_DOGS', ctx);

// 研究里给的参考值：速度 → 步频（Hz）
const REF = {
  gold: { 12: 1.05, 24: 1.21, 62: 1.99, 90: 2.24, 170: 2.63 },
  dax:  { 14: 1.87, 26: 2.19, 64: 3.51, 105: 4.13, 150: 4.50 },
};
const SPEEDS = {
  gold: [12, 24, 45, 62, 90, 100, 150, 170],
  dax:  [12, 14, 26, 45, 64, 100, 105, 150, 170],
};
const LEG = ['近前', '远前', '近后', '远后'];
const DT = 1 / 60;
let failed = 0;
function bad(msg) { failed++; console.log('  ✗ ' + msg); }

function run(kind, v) {
  const rig = D.create(kind, kind === 'gold' ? 'gold' : 'dax_red', 12345);
  const inp = { pose: 'stand', speed: v, wag: 0.3 };
  for (let i = 0; i < 240; i++) rig.update(DT, inp);            // 先跑 4 秒，等步子稳下来
  let pr = rig.probe();
  const S0 = pr.S, ph0 = pr.phase;
  let wraps = 0, lastPh = ph0, steps = 0, t1 = 0, s1 = 0, t2 = 0, s2 = 0;
  const st = [0, 1, 2, 3].map(() => ({ down: false, lo: 0, hi: 0, drift: 0, dy: 0, stances: 0, maxReach: 0 }));
  const bins = [0, 1, 2, 3].map(() => new Array(10).fill(0)), binN = new Array(10).fill(0);
  let minDown = 4, airFrames = 0, frames = 0, maxJump = 0, last = null;
  while (wraps < 12 && steps < 6000) {
    rig.update(DT, inp);
    pr = rig.probe();
    steps++;
    if (pr.phase < lastPh - 0.5) {            // 一整步走完了。步频和步幅只在"整步"之间量
      wraps++;
      if (wraps === 1) { t1 = steps; s1 = pr.S; }
      t2 = steps; s2 = pr.S;
    }
    lastPh = pr.phase;
    let nDown = 0;
    const b = Math.min(9, Math.floor(pr.phase * 10));
    binN[b]++;
    for (let k = 0; k < 4; k++) {
      const f = pr.feet[k], s = st[k], wx = pr.S + f.x;
      if (f.down) {
        nDown++; bins[k][b]++;
        if (!s.down) { s.down = true; s.lo = s.hi = wx; s.stances++; }
        else { if (wx < s.lo) s.lo = wx; if (wx > s.hi) s.hi = wx; if (s.hi - s.lo > s.drift) s.drift = s.hi - s.lo; }
        const dy = Math.abs(f.y - rig.B.padY);
        if (dy > s.dy) s.dy = dy;
      } else s.down = false;
      if (f.down && f.reach > s.maxReach) s.maxReach = f.reach;      // 只看踩在地上的时候：腿不能绷成一根直棍
      if (last) { const j = Math.hypot(f.x - last[k].x, f.y - last[k].y); if (j > maxJump) maxJump = j; }   // 相邻两帧脚掌挪了多少
    }
    last = pr.feet.map(f => ({ x: f.x, y: f.y }));
    frames++;
    if (nDown < minDown) minDown = nDown;
    if (nDown === 0) airFrames++;
  }
  const n = wraps - 1, T = (t2 - t1) * DT, dist = s2 - s1, f = n / T;
  return {
    v, f, stride: dist / n, gait: pr.gait, st, minDown, air: airFrames / frames, airMs: airFrames / frames / f * 1000,
    maxJump, rows: bins.map(r => r.map((n, i) => (binN[i] ? n / binN[i] : 0))),
  };
}
function gaitName(g) { return g < 0.5 ? '慢走' : (g < 1.5 ? '小跑' : '飞奔'); }
function diagram(rows) {
  return rows.map((r, k) => '      ' + LEG[k] + '  ' + r.map(x => (x > 0.85 ? '█' : (x > 0.4 ? '▒' : (x > 0.08 ? '░' : '·')))).join('')).join('\n');
}

for (const kind of ['gold', 'dax']) {
  console.log('\n=== ' + (kind === 'gold' ? '金毛' : '腊肠') + ' ===');
  console.log('  速度   步态   步频Hz  步幅    打滑(近前 远前 近后 远后)   腾空');
  let prevStride = 0, prevF = 0, shown = {};
  for (const v of SPEEDS[kind]) {
    const r = run(kind, v), g = gaitName(r.gait), lim = r.gait > 1.5 ? 1.0 : 0.6;
    const drifts = r.st.map(s => s.drift);
    console.log('  ' + String(v).padStart(4) + '   ' + g + '   ' + r.f.toFixed(2).padStart(5) + '  ' + r.stride.toFixed(1).padStart(5) + '    ' +
      drifts.map(d => d.toFixed(2)).join(' ') + '    ' + (r.air * 100).toFixed(0).padStart(3) + '% (' + r.airMs.toFixed(0) + ' ms)');
    drifts.forEach((d, k) => { if (d > lim) bad(kind + ' ' + v + ' ' + LEG[k] + '脚打滑 ' + d.toFixed(2) + ' > ' + lim); });
    r.st.forEach((s, k) => { if (s.dy > 0.3) bad(kind + ' ' + v + ' ' + LEG[k] + '脚着地时离地 ' + s.dy.toFixed(2)); });
    r.st.forEach((s, k) => { if (s.maxReach > 0.985) bad(kind + ' ' + v + ' ' + LEG[k] + '腿伸得太直 ' + s.maxReach.toFixed(3)); });
    if (REF[kind][v]) { const e = Math.abs(r.f / REF[kind][v] - 1); if (e > 0.05) bad(kind + ' ' + v + ' 步频 ' + r.f.toFixed(2) + ' 和参考值 ' + REF[kind][v] + ' 差 ' + (e * 100).toFixed(0) + '%'); }
    if (r.gait < 0.5 && v <= 30 && r.minDown < 2) bad(kind + ' ' + v + ' 慢走时只有 ' + r.minDown + ' 只脚在地上');
    if (r.gait > 1.5 && r.air <= 0) bad(kind + ' ' + v + ' 飞奔时没有腾空');
    if (r.stride < prevStride - 1.5) bad(kind + ' ' + v + ' 步幅比慢的时候还短');
    if (r.f < prevF - 0.02) bad(kind + ' ' + v + ' 步频比慢的时候还低');
    prevStride = r.stride; prevF = r.f;
    if (!shown[g] || VERBOSE) {
      shown[g] = 1;
      console.log('    一整步里哪只脚在地上（' + g + '，' + v + '）：\n' + diagram(r.rows));
    }
    if (VERBOSE) console.log('    相邻两帧脚掌最多挪 ' + r.maxJump.toFixed(2) + '，腿最多伸到 ' + r.st.map(s => (s.maxReach * 100).toFixed(0) + '%').join(' '));
  }
}

// 斜着跑（屏幕上一边往右一边往下）：踩在地上的脚在屏幕上不能横着滑。这时"地面"按横向走过的距离算。
console.log('');
for (const kind of ['gold', 'dax']) {
  const rig = D.create(kind, kind === 'gold' ? 'gold' : 'dax_red', 99), v = kind === 'gold' ? 62 : 64;
  const inp = { pose: 'stand', speed: v, vx: v * 0.6, vy: v * 0.8 };
  for (let i = 0; i < 240; i++) rig.update(DT, inp);
  const st = [0, 1, 2, 3].map(() => ({ down: false, lo: 0, hi: 0, drift: 0 }));
  for (let i = 0; i < 600; i++) {
    rig.update(DT, inp);
    const pr = rig.probe();
    for (let k = 0; k < 4; k++) {
      const f = pr.feet[k], s = st[k], wx = pr.S + f.x;
      if (f.down) { if (!s.down) { s.down = true; s.lo = s.hi = wx; } else { s.lo = Math.min(s.lo, wx); s.hi = Math.max(s.hi, wx); s.drift = Math.max(s.drift, s.hi - s.lo); } }
      else s.down = false;
    }
  }
  const worst = Math.max(...st.map(s => s.drift));
  console.log((kind === 'gold' ? '金毛' : '腊肠') + ' 斜着小跑（横向只占六成）：脚最多横着滑 ' + worst.toFixed(2));
  if (worst > 0.6) bad(kind + ' 斜着跑时脚打滑 ' + worst.toFixed(2));
}

// 再从画出来的像素上量一遍（不光看算出来的骨架）：把"原点落在像素格子里的零头"告诉骨架，
// 然后盯着近侧两只脚贴地的那一行像素：脚踩在地上的那段时间里，这一小段像素在地面上应该不动（最多差一格）。
console.log('');
for (const kind of ['gold', 'dax']) {
  for (const v of kind === 'gold' ? [24, 62, 170] : [26, 64, 150]) {
    const R = 2, rig = D.create(kind, kind === 'gold' ? 'gold' : 'dax_red', 5), inp = { pose: 'stand', speed: v };
    for (let i = 0; i < 240; i++) rig.update(DT, inp);
    const st = [0, 2].map(() => ({ down: false, lo: 0, hi: 0, drift: 0, n: 0 }));
    for (let i = 0; i < 480; i++) {
      rig.update(DT, inp);
      const pr = rig.probe(), gx = pr.S * R, o = rig.render(false, R, gx - Math.floor(gx));
      const row = (Math.round(o.oy) - 1) * o.w, ox = Math.floor(o.ox);
      [0, 2].forEach((k, n) => {
        const f = pr.feet[k], s = st[n];
        if (!f.down) { s.down = false; return; }
        // 别的脚正好踩在旁边（走路时后脚会落在前脚的脚印边上）：两只脚的像素连成一片，分不清，这一帧不量
        if (pr.feet.some((g, m) => m !== k && Math.abs(g.x - f.x) < 5 && g.y < rig.B.padY + 1.5)) return;
        // 这只脚贴地的那一段像素从哪到哪
        let c = Math.round(ox + f.x * R + 1), a = c;
        if (!o.data[(row + c) * 4 + 3]) { s.down = false; return; }
        while (a > 0 && o.data[(row + a - 1) * 4 + 3]) a--;
        const wx = Math.floor(gx) + a - ox;                  // 这一段的左端在地面上的位置（像素）
        if (!s.down) { s.down = true; s.lo = s.hi = wx; s.n++; }
        else { s.lo = Math.min(s.lo, wx); s.hi = Math.max(s.hi, wx); s.drift = Math.max(s.drift, s.hi - s.lo); }
      });
    }
    const worst = Math.max(st[0].drift, st[1].drift);
    console.log((kind === 'gold' ? '金毛' : '腊肠') + ' ' + String(v).padStart(3) + '：画出来的脚掌在地面上最多挪 ' + worst + ' 个像素（近前 ' + st[0].drift + '，近后 ' + st[1].drift + '；R=2 时一个像素是半个世界单位）');
    if (worst > 2) bad(kind + ' ' + v + ' 画出来的脚掌挪了 ' + worst + ' 个像素');
  }
}

// 变速：从慢走一路加速到飞奔再减速，中间不许"跳一下"（脚掌一帧里挪得太远）
for (const kind of ['gold', 'dax']) {
  const rig = D.create(kind, kind === 'gold' ? 'gold' : 'dax_red', 777), top = kind === 'gold' ? 170 : 150;
  let last = null, worst = 0, worstAt = 0, lastS = 0;
  for (let i = 0; i < 60 * 14; i++) {
    const t = i * DT, v = t < 6 ? top * t / 6 : (t < 8 ? top : Math.max(0, top * (1 - (t - 8) / 5)));
    rig.update(DT, { pose: 'stand', speed: v });
    const pr = rig.probe();
    if (last) for (let k = 0; k < 4; k++) {
      // 踩在地上的脚：相对地面挪了多少；离地的脚：相对身体挪了多少（减掉正常的摆动上限）
      const f = pr.feet[k], d = Math.hypot(f.x - last[k].x + (f.down && last[k].down ? pr.S - lastS : 0), f.y - last[k].y);
      const lim = f.down && last[k].down ? 0.25 : 6.5;
      if (d - lim > worst) { worst = d - lim; worstAt = t; }
    }
    last = pr.feet.map(f => ({ x: f.x, y: f.y, down: f.down })); lastS = pr.S;
  }
  console.log('\n' + (kind === 'gold' ? '金毛' : '腊肠') + ' 加速再减速：' + (worst > 0 ? '最大的一下跳动超出 ' + worst.toFixed(2) + '（第 ' + worstAt.toFixed(2) + ' 秒）' : '没有跳动'));
  if (worst > 0.6) bad(kind + ' 变速时脚有跳动');
}

console.log(failed ? '\n结果：有 ' + failed + ' 项没过' : '\n结果：全部通过');
process.exit(failed ? 1 : 0);
