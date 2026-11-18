// 开发用：小人骨架的自检。
// 用法：node pet/dev/personcheck.js
//
// 查四样：
//   1. 接口：每个画面名字、每种表情、R = 1~4 都画得出来；像素要么不透明要么全透明；锚点都是正常的数
//   2. 同样的输入画两遍，结果一模一样
//   3. 走和跑的时候脚滑不滑：踩着地的那只脚，着地点在"世界"里应该一动不动
//      （骨架算出来的位置，以及真正画出来的鞋的像素，两样都量）
//   4. 一共用了多少种颜色
// 有一项不过就以非 0 退出。
const vm = require('vm'), fs = require('fs'), path = require('path');
const web = path.join(__dirname, '..', 'web');
const ctx = vm.createContext({});
for (const f of ['config.js', 'person.js']) vm.runInContext(fs.readFileSync(path.join(web, f), 'utf8'), ctx, { filename: f });
const cfg = vm.runInContext('typeof PET_CONFIG !== "undefined" ? PET_CONFIG : {}', ctx), P = ctx.PET_PERSON;
let fails = 0;
function ok(cond, msg) { if (!cond) { fails++; console.log('  不过：' + msg); } return cond; }
function settle(rig, inp, sec, left, R) { for (let i = 0; i < sec * 60; i++) rig.update(1 / 60, inp); return rig.render(!!left, R || 2); }
function good(v) { return typeof v === 'number' && isFinite(v); }

// ---------- 1. 接口 ----------
console.log('1. 接口');
const NEED = ['p_front', 'p_front2', 'p_front_blink', 'p_wave_a', 'p_wave_b', 'p_idle', 'p_idle2', 'p_blink', 'p_hold', 'p_hold2', 'p_walk0', 'p_walk1', 'p_walk2', 'p_walk3',
  'p_windup', 'p_release', 'p_follow', 'p_pat', 'p_cheer', 'p_cheer2', 'p_crouch', 'p_crouch2', 'p_sit', 'p_tie_a', 'p_tie_b', 'p_watch'];
const FACES = ['neutral', 'smile', 'grin', 'laugh', 'soft', 'surprised', 'wink', 'blush', 'sleepy', 'yawn', 'focus', 'proud', 'oops', 'pout', 'kiss', 'wistful'];
ok(NEED.every(n => P.FRAMES.indexOf(n) >= 0), 'FRAMES 里缺画面名字');
ok(FACES.every(n => P.FACES.indexOf(n) >= 0), 'FACES 里缺表情');
const M = P.METRICS;
ok(M && good(M.height) && M.height >= 30 && M.height <= 38, 'METRICS.height 要在 30~38 之间，现在是 ' + (M && M.height));
ok(M && good(M.half) && M.half <= 8 && good(M.reach) && M.eye && M.chest, 'METRICS 缺项');
let shots = 0, maxW = 0, maxH = 0;
for (const R of [1, 2, 3, 4]) {
  for (const name of P.FRAMES.concat(['no_such_frame'])) {
    for (const left of [false, true]) {
      const rig = P.create(cfg), inp = { frame: name, holding: name === 'p_hold' ? 'ball' : null };
      if (name.indexOf('p_walk') === 0) { inp.moving = true; inp.speed = 30; }
      rig.update(0, inp); rig.render(left, R);
      const im = settle(rig, inp, 0.7, left, R);
      shots++;
      let bad = 0, n = 0;
      for (let i = 3; i < im.data.length; i += 4) { const a = im.data[i]; if (a !== 0 && a !== 255) bad++; if (a) n++; }
      ok(bad === 0, name + ' R=' + R + '：有半透明的像素 ' + bad + ' 个');
      ok(n > 200 * R * R, name + ' R=' + R + '：几乎没画出东西（' + n + ' 个像素）');
      ok(im.w === Math.round(im.w) && im.scale === R && good(im.ox) && good(im.oy) && im.data.length === im.w * im.h * 4, name + ' R=' + R + '：图的尺寸不对');
      const b = im.box, wWu = (b[2] - b[0] + 1) / R, hWu = (b[3] - b[1] + 1) / R;
      ok(b[0] >= 0 && b[1] >= 0 && b[2] < im.w && b[3] < im.h && b[2] > b[0], name + ' R=' + R + '：box 不对 ' + b);
      if (name === 'p_idle' || name === 'p_front') { maxW = Math.max(maxW, wWu); maxH = Math.max(maxH, hWu); }
      for (const k of ['hand', 'hand2', 'arms', 'head', 'mouth']) ok(im[k] && good(im[k][0]) && good(im[k][1]), name + ' R=' + R + '：锚点 ' + k + ' 不对');
      ok(good(im.top) && im.top > 10 && im.top < 46, name + ' R=' + R + '：top 不对 ' + im.top);
      ok(typeof im.holds === 'boolean', name + '：holds 要是 true / false');
      if (name === 'p_follow') ok(im.holds === false, 'p_follow 不该有球');
      // 朝左时，嘴和头顶的 dx 应该和朝右时正好相反（大致）
    }
  }
}
for (const f of P.FACES) {
  const rig = P.create(cfg), im = settle(rig, { frame: 'p_front', face: f }, 0.5, false, 2);
  let n = 0; for (let i = 3; i < im.data.length; i += 4) if (im.data[i]) n++;
  ok(n > 800, '表情 ' + f + ' 画不出来');
}
console.log('  画了 ' + shots + ' 张；站姿宽 ' + maxW.toFixed(1) + '、高 ' + maxH.toFixed(1) + '（世界单位，含描边）');
ok(maxW <= 16.01, '站着比 16 个世界单位宽');
ok(maxH >= 30 && maxH <= 39.01, '站着的高度不在 30~38（加描边 39）之间');

// ---------- 1b. 独角戏 ----------
console.log('1b. 独角戏（input.act）');
(function () {
  ok(P.ACTS && P.ACTS.length >= 18, '独角戏少于 18 个');
  let n = 0;
  for (const a of P.ACTS) {
    const len = P.ACT_LEN[a];
    ok(len >= 0.9 && len <= 8.5, a + '：长度 ' + len + ' 秒不在 1~8 秒');
    const rig = P.create(cfg), inp = { frame: 'p_idle', act: a, holding: /ball|throw/.test(a) ? 'ball' : null };
    let done = false, early = false;
    for (let t = 0; t < len + 0.3; t += 1 / 60) {
      rig.update(1 / 60, inp);
      const im = rig.render(false, 2);
      if (t < len - 0.05 && im.actDone) early = true;
      done = im.actDone;
      for (const k of ['hand', 'hand2', 'head', 'mouth']) if (!(good(im[k][0]) && good(im[k][1]))) { ok(false, a + '：锚点 ' + k + ' 不对'); break; }
    }
    ok(done && !early, a + '：actDone 不对（' + done + ', 提前 ' + early + '）');
    n++;
  }
  // 换成别的 act 要重新开始；去掉 act 以后 actDone 清掉
  const rig = P.create(cfg);
  for (let i = 0; i < 300; i++) rig.update(1 / 60, { act: 'clap' });
  ok(rig.render(false, 2).actDone === true, 'clap 演完了 actDone 应该是 true');
  rig.update(1 / 60, { act: 'bow' }); ok(rig.render(false, 2).actDone === false, '换了 act 以后 actDone 应该重新变 false');
  rig.update(1 / 60, {}); ok(rig.render(false, 2).actDone === false && rig.render(false, 2).act === null, '没有 act 时 actDone = false');
  console.log('  ' + n + ' 个独角戏都能演完；最长 ' + Math.max.apply(null, P.ACTS.map(a => P.ACT_LEN[a])) + ' 秒');
})();

// ---------- 2. 同样的输入 → 同样的图 ----------
console.log('2. 同样的输入画两遍');
(function () {
  const script = [[{ frame: 'p_idle' }, 0.6, false], [{ frame: 'p_walk0', moving: true, speed: 46 }, 1.1, true], [{ frame: 'p_windup', holding: 'ball' }, 0.4, false],
    [{ frame: 'p_release' }, 0.15, false], [{ frame: 'p_follow' }, 0.34, false], [{ frame: 'p_crouch', face: 'laugh' }, 0.8, true]];
  function play() {
    const rig = P.create(cfg), sums = [];
    for (const [inp, dur, left] of script) for (let i = 0; i < dur * 60; i++) {
      rig.update(1 / 60, inp);
      const im = rig.render(left, 2); let h = 0;
      for (let k = 0; k < im.data.length; k += 4) if (im.data[k + 3]) h = (h * 31 + im.data[k] * 3 + im.data[k + 1] * 5 + im.data[k + 2] * 7 + k) | 0;
      sums.push(h);
    }
    return sums;
  }
  const a = play(), b = play();
  let diff = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  ok(diff === 0, '同样的输入，有 ' + diff + ' 帧画得不一样');
  console.log('  ' + a.length + ' 帧，全部一样：' + (diff === 0 ? '是' : '否'));
})();

// ---------- 3. 脚滑不滑 ----------
console.log('3. 走和跑：踩着地的脚滑不滑');
const IDS = P._ids;
function drift(speed, dt, R) {
  const rig = P.create(cfg), inp = { frame: 'p_walk0', moving: true, speed: speed };
  let x = 0, kin = 0, pix = 0, steps = 0, flights = 0, frames = 0, lastDraw = -1e9, both = 0;
  const st = [null, null], pst = [null, null];
  let prevOn = [true, true];
  for (let i = 0; i < 8 / dt; i++) {
    rig.update(dt, inp); x += speed * dt;
    // 和引擎一样：每走 0.5 个世界单位重画一次
    if (x - lastDraw < 0.5) continue;
    lastDraw = x;
    const im = rig.render(false, R);
    frames++;
    if (x < 30) { prevOn = [im.feet[0][2], im.feet[1][2]]; continue; }      // 起步那两步不算
    if (!im.feet[0][2] && !im.feet[1][2]) flights++;
    if (im.feet[0][2] && im.feet[1][2]) both++;
    for (let f = 0; f < 2; f++) {
      const on = im.feet[f][2];
      if (on) {
        // 骨架：着地点在世界里的位置（脚跟着地 → 脚掌着地，换支点的那一下允许重新记）
        const pivot = im.feet[f][3] - im.feet[f][0] > 0 ? 1 : 0;
        const wx = x + im.feet[f][3];
        if (!st[f] || st[f].pivot !== pivot) st[f] = { pivot: pivot, x0: wx };
        kin = Math.max(kin, Math.abs(wx - st[f].x0));
        if (!prevOn[f]) steps++;
        // 像素：近脚（f = 0）鞋尖那一列在世界里的位置（脚平着或踮着的时候鞋尖不该动）
        if (f === 0 && pivot === 1) {
          const c = P._peek(R); let tip = -1;
          for (let j = im.box[1]; j <= im.box[3]; j++) for (let k = im.box[2]; k >= im.box[0]; k--) {
            const q = j * c.w + k;
            if (c.mat[q] === IDS.SHOE && c.grp[q] === IDS.LEGN) { if (k > tip) tip = k; break; }
          }
          if (tip >= 0) {
            const wpx = Math.round(x * R) + (tip - im.ox);
            if (!pst[f]) pst[f] = { x0: wpx, lo: wpx, hi: wpx };
            pst[f].lo = Math.min(pst[f].lo, wpx); pst[f].hi = Math.max(pst[f].hi, wpx);
            pix = Math.max(pix, pst[f].hi - pst[f].lo);
          }
        } else if (f === 0) pst[f] = null;
      } else { st[f] = null; pst[f] = null; }
      prevOn[f] = on;
    }
  }
  const sec = (x - 30) / speed;
  return { kin: kin, pix: pix, cadence: steps / sec, stride: speed / (steps / sec / 2 || 1), flight: flights / frames, both: both / frames };
}
console.log('  速度   骨架上滑(wu)   像素上滑(px, R=2)   每秒几步   一个循环(wu)   两脚都离地   两脚都着地');
for (const v of [24, 30, 46, 62, 80, 100]) {
  const d = drift(v, 1 / 60, 2);
  console.log('  ' + String(v).padStart(4) + '   ' + d.kin.toFixed(3).padStart(10) + '   ' + String(d.pix).padStart(12) + '       ' + d.cadence.toFixed(2).padStart(6) + '   ' + d.stride.toFixed(1).padStart(9) +
    '   ' + (d.flight * 100).toFixed(0).padStart(8) + '%   ' + (d.both * 100).toFixed(0).padStart(8) + '%');
  ok(d.kin <= 0.05, '速度 ' + v + '：骨架上脚滑了 ' + d.kin.toFixed(3) + ' 个世界单位');
  ok(d.pix <= 2, '速度 ' + v + '：画出来的鞋尖滑了 ' + d.pix + ' 个像素');
  if (v <= 46) ok(d.flight === 0 && d.both > 0.05, '速度 ' + v + '：走路时应该一直有脚着地，而且有两脚同时着地的时候');
  if (v >= 62) ok(d.flight > 0.03, '速度 ' + v + '：跑起来应该有两脚都离地的时候');
}
// 帧率不稳的时候也不能滑
(function () {
  const d1 = drift(46, 1 / 30, 2), d2 = drift(46, 1 / 144, 2);
  console.log('  帧率 30 / 144 时（速度 46）：骨架上滑 ' + d1.kin.toFixed(3) + ' / ' + d2.kin.toFixed(3) + ' wu');
  ok(d1.kin <= 0.05 && d2.kin <= 0.05, '帧率变了以后脚会滑');
})();
// 起步、停下：站着的时候脚不能自己滑
(function () {
  const rig = P.create(cfg); let x = 0, worst = 0; const ref = [null, null];
  const plan = [[{ frame: 'p_idle' }, 0.5], [{ frame: 'p_walk0', moving: true, speed: 24 }, 1.3], [{ frame: 'p_idle' }, 1.5], [{ frame: 'p_walk0', moving: true, speed: 62 }, 1.0], [{ frame: 'p_hold', holding: 'ball' }, 1.5]];
  for (const [inp, dur] of plan) for (let i = 0; i < dur * 60; i++) {
    rig.update(1 / 60, inp); if (inp.moving) x += inp.speed / 60;
    const im = rig.render(false, 2);
    for (let f = 0; f < 2; f++) {
      if (im.feet[f][2]) {
        const pivot = im.feet[f][3] - im.feet[f][0] > 0 ? 1 : 0, wx = x + im.feet[f][3];
        if (!ref[f] || ref[f].pivot !== pivot) ref[f] = { pivot: pivot, x0: wx };
        worst = Math.max(worst, Math.abs(wx - ref[f].x0));
      } else ref[f] = null;
    }
  }
  console.log('  站 → 走 → 停 → 跑 → 停：踩着地的脚最多滑了 ' + worst.toFixed(3) + ' wu');
  ok(worst <= 0.05, '起步或停下时脚滑了');
})();

// ---------- 4. 颜色 ----------
console.log('4. 颜色');
(function () {
  const seen = new Set(); let most = 0, idle = 0;
  const all = [[{ frame: 'p_idle' }, false], [{ frame: 'p_front', face: 'laugh' }, false], [{ frame: 'p_crouch' }, true], [{ frame: 'p_walk0', moving: true, speed: 80 }, false], [{ frame: 'p_watch' }, false], [{ frame: 'p_front', face: 'oops' }, false]];
  for (const [inp, left] of all) {
    const rig = P.create(cfg), im = settle(rig, inp, 0.8, left, 2), one = new Set();
    for (let k = 0; k < im.data.length; k += 4) if (im.data[k + 3]) { const c = (im.data[k] << 16) | (im.data[k + 1] << 8) | im.data[k + 2]; seen.add(c); one.add(c); }
    most = Math.max(most, one.size); if (inp.frame === 'p_idle') idle = one.size;
  }
  console.log('  站姿一张图 ' + idle + ' 种颜色；最多的一张 ' + most + ' 种；这几张加起来 ' + seen.size + ' 种（含牙、舌头、汗、星星这些只在个别表情里出现的）');
  ok(idle <= 32, '站姿用的颜色太多：' + idle);
  ok(seen.size <= 46, '颜色太多：' + seen.size);
})();

console.log(fails ? '\n有 ' + fails + ' 项不过' : '\n全部通过');
process.exit(fails ? 1 : 0);
