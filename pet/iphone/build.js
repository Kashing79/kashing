// 生成 iPhone 小组件脚本：从 web/sprites.js 取出需要的几帧像素画，填进 widget.template.js。
// 用法：node pet/iphone/build.js [网页版网址]
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'web/config.js'), 'utf8'), sandbox);
vm.runInNewContext(fs.readFileSync(path.join(root, 'web/sprites.js'), 'utf8'), sandbox);
const want = ['p_front', 'p_front_blink', 'p_wave_a', 'p_hold', 'd_stand_b', 'd_sit_a', 'd_sit_b', 'd_bow_a', 'd_lie', 'd_sleep',
  'g_stand_b', 'g_sit_a', 'g_sit_b', 'g_lie', 'g_sleep', 'ball0', 'fx_heart', 'fx_z', 'fx_zs'];
const frames = {};
sandbox.window.PET_SPRITES.build(sandbox.window.PET_CONFIG, (name, rows, pal) => {
  if (!want.includes(name)) return;
  // 去掉四周全空的行列，省地方
  let top = 0, bot = rows.length - 1, l = rows[0].length, r = -1;
  while (top < bot && !/[^.]/.test(rows[top])) top++;
  while (bot > top && !/[^.]/.test(rows[bot])) bot--;
  rows.forEach(row => { const m = row.search(/[^.]/); if (m >= 0) { l = Math.min(l, m); r = Math.max(r, row.length - 1 - row.split('').reverse().join('').search(/[^.]/)); } });
  const used = {};
  const cut = rows.slice(top, bot + 1).map(row => row.slice(l, r + 1));
  cut.join('').split('').forEach(ch => { if (ch !== '.') used[ch] = pal[ch]; });
  frames[name] = { rows: cut, pal: used };
});
const missing = want.filter(n => !frames[n]);
if (missing.length) { console.error('missing frames:', missing); process.exit(1); }
const url = process.argv[2] || 'https://kashing79.github.io/kashing/qiuqiu/';
let out = fs.readFileSync(path.join(__dirname, 'widget.template.js'), 'utf8')
  .replace('__PAGE_URL__', url).replace('__INK__', sandbox.window.PET_SPRITES.INK)
  .replace('__FRAMES__', JSON.stringify(frames));
fs.writeFileSync(path.join(__dirname, 'qiuqiu-widget.js'), out);
console.log('wrote pet/iphone/qiuqiu-widget.js', out.length, 'bytes');
