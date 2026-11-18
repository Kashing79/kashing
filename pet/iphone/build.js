// 生成 iPhone 小组件脚本：小人和小道具取自 web/sprites.js，两只狗用 web/dogs.js 现画出几个姿势，
// 一起填进 widget.template.js。
// 用法：node pet/iphone/build.js [网页版网址]
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
// 这几个文件有的把自己挂在 window 上，有的挂在全局上：让 window 就是全局，两种写法都接得住
const sandbox = {};
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ['web/config.js', 'web/sprites.js', 'web/dogs.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
const W = sandbox, frames = {};

// 小人、小球、表情
const want = ['p_front', 'p_front_blink', 'p_wave_a', 'p_hold', 'ball0', 'fx_heart', 'fx_z', 'fx_zs'];
W.PET_SPRITES.build(W.PET_CONFIG, (name, rows, pal) => {
  if (!want.includes(name)) return;
  let top = 0, bot = rows.length - 1, l = rows[0].length, r = -1;
  while (top < bot && !/[^.]/.test(rows[top])) top++;
  while (bot > top && !/[^.]/.test(rows[bot])) bot--;
  rows.forEach(row => { const m = row.search(/[^.]/); if (m >= 0) { l = Math.min(l, m); r = Math.max(r, row.length - 1 - row.split('').reverse().join('').search(/[^.]/)); } });
  const used = {}, cut = rows.slice(top, bot + 1).map(row => row.slice(l, r + 1));
  cut.join('').split('').forEach(ch => { if (ch !== '.') used[ch] = pal[ch]; });
  frames[name] = { rows: cut, pal: used };
});

// 两只狗：摆好姿势，画出来，转成"字符画 + 调色盘"
const CH = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function dogFrame(kind, coat, input) {
  const rig = W.PET_DOGS.create(kind, coat);
  rig.blinkAt = 99; rig.t = 0; rig.wagT = 0.25;
  for (let i = 0; i < 90; i++) rig.update(1 / 60, input);
  const o = rig.render(false, 1);      // 小组件里一个像素画成 3x3 pt，用最粗的那一档就够了
  const px = (x, y) => { const k = (y * o.w + x) * 4; return o.data[k + 3] < 128 ? null : '#' + [0, 1, 2].map(i => o.data[k + i].toString(16).padStart(2, '0')).join(''); };
  // 颜色太多、字母不够用时：把用得最少的颜色并到离它最近的颜色上
  const count = {};
  for (let y = o.box[1]; y <= o.box[3]; y++) for (let x = o.box[0]; x <= o.box[2]; x++) { const c = px(x, y); if (c) count[c] = (count[c] || 0) + 1; }
  const keep = Object.keys(count).sort((a, b) => count[b] - count[a]).slice(0, CH.length), merge = {};
  const rgb = c => [1, 3, 5].map(i => parseInt(c.substr(i, 2), 16));
  const near = c => { if (!merge[c]) { const p = rgb(c); let best = keep[0], bd = 1e9; for (const k of keep) { const q = rgb(k), d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2; if (d < bd) { bd = d; best = k; } } merge[c] = best; } return merge[c]; };
  const pal = {}, rev = {}, rows = [];
  let n = 0;
  for (let y = o.box[1]; y <= o.box[3]; y++) {
    let row = '';
    for (let x = o.box[0]; x <= o.box[2]; x++) {
      let hex = px(x, y);
      if (!hex) { row += '.'; continue; }
      if (!keep.includes(hex)) hex = near(hex);
      if (!rev[hex]) { rev[hex] = CH[n++]; pal[rev[hex]] = hex; }
      row += rev[hex];
    }
    rows.push(row);
  }
  return { rows, pal };
}
const daxCoat = 'dax_' + (W.PET_CONFIG.dachshund || 'red');
frames.g_sit = dogFrame('gold', 'gold', { pose: 'sit', wag: 0.5 });
frames.g_lie = dogFrame('gold', 'gold', { pose: 'lie', pant: true });
frames.g_sleep = dogFrame('gold', 'gold', { pose: 'sleep' });
frames.d_sit = dogFrame('dax', daxCoat, { pose: 'sit', wag: 0.5 });
frames.d_bow = dogFrame('dax', daxCoat, { pose: 'bow', wag: 1 });
frames.d_beg = dogFrame('dax', daxCoat, { pose: 'beg', wag: 0.8 });
frames.d_roll = dogFrame('dax', daxCoat, { pose: 'roll' });
frames.d_lie = dogFrame('dax', daxCoat, { pose: 'lie' });
frames.d_sleep = dogFrame('dax', daxCoat, { pose: 'sleep' });

const url = process.argv[2] || 'https://kashing79.github.io/kashing/qiuqiu/';
const out = fs.readFileSync(path.join(__dirname, 'widget.template.js'), 'utf8')
  .replace('__PAGE_URL__', url).replace('__INK__', W.PET_SPRITES.INK)
  .replace('__FRAMES__', JSON.stringify(frames));
fs.writeFileSync(path.join(__dirname, 'qiuqiu-widget.js'), out);
console.log('wrote pet/iphone/qiuqiu-widget.js', out.length, 'bytes;', Object.keys(frames).map(k => k + ' ' + frames[k].rows[0].length + 'x' + frames[k].rows.length).join(', '));
