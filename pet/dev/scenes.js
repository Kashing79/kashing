// 开发用：把每一段"小剧场"单独演一遍，隔一会儿截一张图，拼成一张连环画，方便检查动作对不对。
// 用法：node scenes.js <输出目录> [场景名,场景名…] [roam=1|0]
//   想拿另一份 web/ 来跑：PET_WEB=那个目录 node scenes.js ...
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
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
    await page.goto('file://' + path.resolve(process.env.PET_WEB || path.join(__dirname, '../web'), 'index.html') + '?scale=3&grass=1&entrance=0&auto=0&bare=1&roam=' + (roam ? 1 : 0));
    await page.waitForTimeout(250);
    await page.evaluate(() => { window.pet.configure({ paused: true }); window.pet._t.set('touch', 0); });
    // 刚打开时小人会先挥一下手，那会儿排不了戏：多走几步再试，最多等 6 秒
    const ok = await page.evaluate((n) => {
      const T = window.pet._t;
      const run = (k) => { for (let i = 0; i < k; i++) { T.set('touch', T.state().now); T.step(1 / 60); } };
      run(30);
      if (n === 'fetch') { window.pet.command('throw'); return true; }
      for (let k = 0; k < 60; k++) { if (T.scene(n)) return true; run(6); }
      return false;
    }, name);
    if (!ok) { console.log(name, 'could not start'); await page.close(); continue; }
    const files = [];
    for (let k = 0; k < 40; k++) {
      const st = await page.evaluate(() => { const T = window.pet._t; for (let i = 0; i < 27; i++) { T.set('touch', T.state().now); T.step(1 / 60); } T.draw(); return T.state(); });
      const f = path.join(outDir, name + '_' + String(k).padStart(2, '0') + '.png');
      await page.screenshot({ path: f });
      files.push(f);
      if (name !== 'fetch' && !st.scene) break;
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
