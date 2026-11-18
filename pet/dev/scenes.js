// 开发用：看戏。
//   node scenes.js list [web 目录]                 列出登记了的每一段戏：种类、谁演、什么时候演、weight、哪个戏包
//   node scenes.js <输出目录> [名字,名字…] [roam=1|0]   把每一段单独演一遍，每隔一拍截一张图，拼成一张连环画（sheet_名字.png）
//     名字可以是任何一段（scene / solo / react / care 都行；react 会假装出了它等的那件事）；不给就演最早的十一段
//   想拿另一份 web/ 来跑：PET_WEB=那个目录 node scenes.js ...
const path = require('path');
const fs = require('fs');
const WEB = path.resolve(process.env.PET_WEB || path.join(__dirname, '../web'));

if (process.argv[2] === 'list') {
  // 不开浏览器：在一个空环境里把文件读进来，问引擎登记了哪些
  const vm = require('vm');
  const dir = process.argv[3] ? path.resolve(process.argv[3]) : WEB;
  const ctx = vm.createContext({});
  const packs = fs.existsSync(path.join(dir, 'scenes')) ? fs.readdirSync(path.join(dir, 'scenes')).filter(f => /\.js$/.test(f)).sort().map(f => 'scenes/' + f) : [];
  for (const f of ['config.js', 'sprites.js', 'fx.js', 'dogs.js', 'person.js', 'lawn.js', 'needs.js', 'pet.js'].concat(packs)) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) continue;
    try { vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); } catch (e) { console.log('JS EXCEPTION ' + f + ': ' + e.message); }
  }
  const logs = [];
  const eng = ctx.PET_ENGINE.create({ now: () => 0, log: m => logs.push(m) }, Object.assign({}, ctx.PET_CONFIG || {}));
  const rows = eng._t.list();
  const pad = (s, n) => { s = String(s); let w = 0; for (const ch of s) w += ch.charCodeAt(0) > 255 ? 2 : 1; return s + ' '.repeat(Math.max(1, n - w)); };
  console.log(pad('name', 24) + pad('kind', 7) + pad('cast', 16) + pad('trigger', 22) + pad('weight', 8) + pad('tag/mood', 18) + pad('pack', 12) + 'zh');
  for (const r of rows) {
    const trig = r.kind === 'react' ? 'on ' + r.on + (r.at ? ' at ' + r.at : '') : (r.kind === 'care' ? 'care' : (r.kind === 'solo' ? 'idle' : 'director'));
    console.log(pad(r.name, 24) + pad(r.kind, 7) + pad(r.cast, 16) + pad(trig, 22) + pad(r.weight, 8) + pad([r.tag, r.mood].filter(Boolean).join('/') || '-', 18) + pad(r.pack || '-', 12) + r.zh);
  }
  const by = {};
  for (const r of rows) by[r.kind] = (by[r.kind] || 0) + 1;
  console.log('\n' + rows.length + ' registered: ' + Object.keys(by).map(k => by[k] + ' ' + k).join(', '));
  for (const m of logs) console.log('LOG ' + m);
  process.exit(0);
}

const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
(async () => {
  const outDir = process.argv[2] || '/tmp/pet-scenes';
  const only = process.argv[3] ? process.argv[3].split(',') : ['sniff', 'chase', 'cuddle', 'ride', 'lick', 'belly', 'paw', 'treat', 'sit', 'walk', 'pets'];
  const roam = process.argv[4] !== '0';
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const errors = [];
  for (const name of only) {
    const page = await browser.newPage({ viewport: roam ? { width: 660, height: 400 } : { width: 900, height: 200 } });
    page.on('pageerror', e => errors.push(name + ': ' + (e.stack || e)));
    await page.goto('file://' + path.resolve(WEB, 'index.html') + '?scale=3&grass=1&entrance=0&auto=0&bare=1&roam=' + (roam ? 1 : 0));
    await page.waitForTimeout(250);
    await page.evaluate(() => { window.pet.configure({ paused: true }); window.pet._t.set('touch', 0); });
    // 刚打开时小人会先挥一下手，那会儿排不了戏：多走几步再试，最多等 6 秒
    const ok = await page.evaluate((n) => {
      const T = window.pet._t;
      const run = (k) => { for (let i = 0; i < k; i++) { T.set('touch', T.state().now); T.step(1 / 60); } };
      run(30);
      if (n === 'fetch') { window.pet.command('throw'); return true; }
      const s = T.state();
      // react：假装出了它等的那件事（落在小腊肠身上，鼠标在它头顶附近）
      for (let k = 0; k < 60; k++) { if (T.scene(n, { x: s.dax.x, y: s.dax.y - 10, zone: 'mid', power: 3 })) return true; run(6); }
      return false;
    }, name);
    if (!ok) { console.log(name, 'could not start'); await page.close(); continue; }
    const files = [];
    for (let k = 0; k < 40; k++) {
      const st = await page.evaluate((n) => { const T = window.pet._t; for (let i = 0; i < 27; i++) { T.set('touch', T.state().now); T.step(1 / 60); } T.draw(); const s = T.state(); s.playing = s.scripts.indexOf(n) >= 0; return s; }, name);
      const f = path.join(outDir, name + '_' + String(k).padStart(2, '0') + '.png');
      await page.screenshot({ path: f });
      files.push(f);
      if (name !== 'fetch' && !st.playing) break;
      if (name === 'fetch' && k > 6 && st.phase === 'rest') break;
    }
    const cols = roam ? 4 : 2;
    execFileSync('montage', [...files, '-tile', cols + 'x', '-geometry', (roam ? '330x200' : '450x100') + '+2+2', '-background', '#333', path.join(outDir, 'sheet_' + name + '.png')]);
    files.forEach(f => fs.unlinkSync(f));
    console.log(name, files.length, 'frames');
    await page.close();
  }
  await browser.close();
  if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
})();
