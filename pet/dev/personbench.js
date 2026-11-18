// 开发用：小人骨架的测速。
// 用法：node pet/dev/personbench.js
// 在一个干净的 vm 里加载 person.js（没有 window、没有 DOM，和 Mac 外壳里的 JavaScriptCore 一样），
// 让他把常见的状态轮一遍，量"画一帧"和"更新一步"各要多久。R = 2 时画一帧平均超过 0.6 毫秒就算不合格。
const vm = require('vm'), fs = require('fs'), path = require('path');
const web = path.join(__dirname, '..', 'web');
const ctx = vm.createContext({});
for (const f of ['config.js', 'person.js']) vm.runInContext(fs.readFileSync(path.join(web, f), 'utf8'), ctx, { filename: f });
const cfg = vm.runInContext('typeof PET_CONFIG !== "undefined" ? PET_CONFIG : {}', ctx), P = ctx.PET_PERSON;

// 一段"日常"：每一项 = [输入, 持续几秒, 朝左吗]
const DAY = [
  [{ frame: 'p_idle' }, 1.5, false], [{ frame: 'p_hold', holding: 'ball' }, 1.0, false],
  [{ frame: 'p_walk0', moving: true, speed: 24 }, 2.0, false], [{ frame: 'p_walk0', moving: true, speed: 46, holding: 'ball' }, 1.5, true],
  [{ frame: 'p_walk0', moving: true, speed: 80 }, 1.5, true],
  [{ frame: 'p_windup', holding: 'ball' }, 0.4, false], [{ frame: 'p_release' }, 0.15, false], [{ frame: 'p_follow' }, 0.34, false],
  [{ frame: 'p_pat' }, 1.0, false], [{ frame: 'p_crouch' }, 1.2, true], [{ frame: 'p_sit' }, 1.2, true], [{ frame: 'p_cheer' }, 1.0, false],
  [{ frame: 'p_tie_a' }, 1.0, false], [{ frame: 'p_watch' }, 1.0, false], [{ frame: 'p_front' }, 1.0, false], [{ frame: 'p_wave_a', face: 'laugh' }, 1.2, false],
  [{ frame: 'p_cheer', carried: true }, 1.0, false],
];
function run(R, loops) {
  const rig = P.create(cfg);
  let tr = 0n, tu = 0n, nr = 0, nu = 0;
  for (let l = 0; l < loops; l++) for (const [inp, dur, left] of DAY) {
    const n = Math.round(dur * 60);
    for (let i = 0; i < n; i++) {
      let t0 = process.hrtime.bigint(); rig.update(1 / 60, inp); tu += process.hrtime.bigint() - t0; nu++;
      t0 = process.hrtime.bigint(); rig.render(left, R); tr += process.hrtime.bigint() - t0; nr++;
    }
  }
  return { render: Number(tr) / nr / 1e6, update: Number(tu) / nu / 1e6, n: nr };
}
run(2, 1);                                            // 先跑一遍热热身
console.log('小人骨架测速（每帧都重画；引擎实际只在需要时才重画）');
console.log('  R   画一帧(ms)   更新一步(ms)   帧数');
let bad = false;
for (const R of [1, 2, 3, 4]) {
  const r = run(R, 3);
  console.log('  ' + R + '   ' + r.render.toFixed(3).padStart(8) + '   ' + r.update.toFixed(4).padStart(10) + '   ' + String(r.n).padStart(6));
  if (R === 2 && r.render > 0.6) bad = true;
}
// 各个姿势单独量一下（R = 2）
console.log('\n各姿势（R = 2，稳定后重画 400 次的平均）');
const parts = [];
for (const [inp] of DAY) {
  const rig = P.create(cfg);
  for (let i = 0; i < 60; i++) rig.update(1 / 60, inp);
  rig.render(false, 2);
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 400; i++) { rig.update(1 / 60, inp); rig.render(false, 2); }
  parts.push(((inp.carried ? 'carried' : inp.frame) + (inp.speed ? '@' + inp.speed : '')).padEnd(14) + (Number(process.hrtime.bigint() - t0) / 400 / 1e6).toFixed(3));
}
for (let i = 0; i < parts.length; i += 4) console.log('  ' + parts.slice(i, i + 4).join('   '));
console.log(bad ? '\n不合格：R = 2 时画一帧平均超过 0.6 ms' : '\n合格：R = 2 时画一帧平均不超过 0.6 ms');
process.exit(bad ? 1 : 0);
