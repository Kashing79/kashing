// 开发用：量一量画一只狗要多久。
// 用法：node pet/dev/dogbench.js [R=2] [次数=4000]
//
// 两只狗各量三种情况：站着、小跑、飞奔。每种先热身，再连续画很多帧取平均。
// 要求（SPEC 5.3）：R = 2 时在这台机器上平均一帧不超过 1.0 毫秒。超了退出码不是 0。
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const R = Math.max(1, Math.min(4, Math.round(+process.argv[2]) || 2));
const N = Math.max(200, Math.round(+process.argv[3]) || 4000);
const src = fs.readFileSync(path.join(__dirname, '..', 'web', 'dogs.js'), 'utf8');
const ctx = vm.createContext({});          // 空环境：没有 window、没有 DOM
vm.runInContext(src, ctx, { filename: 'dogs.js' });
const D = vm.runInContext('PET_DOGS', ctx);

const CASES = {
  gold: [['站着', { pose: 'stand', speed: 0, wag: 0.5 }], ['小跑', { pose: 'stand', speed: 62, wag: 0.3 }], ['飞奔', { pose: 'stand', speed: 170, wag: 0.3, pant: true }]],
  dax:  [['站着', { pose: 'stand', speed: 0, wag: 0.5 }], ['小跑', { pose: 'stand', speed: 64, wag: 0.3 }], ['飞奔', { pose: 'stand', speed: 150, wag: 0.3, pant: true }]],
};
const LIMIT = 1.0 * (R * R) / 4;           // 像素数跟 R 的平方走；R = 2 时是 1.0 毫秒
let worst = 0, failed = false;
console.log('R = ' + R + '，每种画 ' + N + ' 帧（每帧之间推进 1/60 秒）');
console.log('  狗     情况    画一帧(ms)   最慢的 1%(ms)   update(µs)   不透明像素');
for (const kind of ['gold', 'dax']) {
  for (const [label, inp] of CASES[kind]) {
    const rig = D.create(kind, kind === 'gold' ? 'gold' : 'dax_red', 2024);
    for (let i = 0; i < 300; i++) { rig.update(1 / 60, inp); if (i % 3 === 0) rig.render(i % 2 === 0, R); }     // 热身
    const times = new Float64Array(N);
    let upd = 0n, px = 0;
    for (let i = 0; i < N; i++) {
      const u0 = process.hrtime.bigint();
      rig.update(1 / 60, inp);
      const t0 = process.hrtime.bigint();
      const o = rig.render((i >> 6) & 1, R);
      const t1 = process.hrtime.bigint();
      upd += t0 - u0;
      times[i] = Number(t1 - t0) / 1e6;
      if (i === N - 1) { for (let k = 3; k < o.data.length; k += 4) if (o.data[k]) px++; }
    }
    const sorted = Array.from(times).sort((a, b) => a - b);
    const mean = sorted.reduce((a, b) => a + b, 0) / N, p99 = sorted[Math.floor(N * 0.99)];
    if (mean > worst) worst = mean;
    if (mean > LIMIT) failed = true;
    console.log('  ' + (kind === 'gold' ? '金毛' : '腊肠') + '   ' + label + '     ' + mean.toFixed(3).padStart(6) + '        ' + p99.toFixed(3).padStart(6) +
      '         ' + (Number(upd) / N / 1000).toFixed(1).padStart(5) + '        ' + String(px).padStart(5));
  }
}
console.log('最慢的一种平均 ' + worst.toFixed(3) + ' ms（上限 ' + LIMIT.toFixed(2) + ' ms）：' + (failed ? '超了' : '通过'));
process.exit(failed ? 1 : 0);
