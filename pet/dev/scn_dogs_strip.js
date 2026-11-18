// 开发用（狗和地方那几个戏包）：拍连环画。和 scenes.js 一样，只是画面按 MacBook 屏幕那么宽（480 × 270 世界单位），
// 每一拍只截角色附近的一块，看得清楚。
//   node pet/dev/scn_dogs_strip.js <输出目录> 名字,名字… [roam=1|0] [每拍几秒=0.45]
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const WEB = path.resolve(process.env.PET_WEB || path.join(__dirname, '../web'));

(async () => {
  const outDir = process.argv[2] || '/tmp/pet-strips';
  const only = (process.argv[3] || 'sorry_bow').split(',');
  const roam = process.argv[4] !== '0';
  const beat = +(process.argv[5] || 0.45);
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const errors = [];
  const W = 1440, H = roam ? 810 : 240, CW = 540, CH = roam ? 300 : 180;
  for (const name of only) {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.on('pageerror', e => errors.push(name + ': ' + (e.stack || e)));
    await page.goto('file://' + path.resolve(WEB, 'index.html') + '?scale=3&grass=1&entrance=0&auto=0&bare=1&roam=' + (roam ? 1 : 0));
    await page.waitForTimeout(250);
    await page.evaluate(() => { window.pet.configure({ paused: true }); window.pet._t.set('touch', 0); });
    const ok = await page.evaluate((n) => {
      const T = window.pet._t;
      const run = (k) => { for (let i = 0; i < k; i++) { T.set('touch', T.state().now); T.step(1 / 60); } };
      run(30);
      const s = T.state();
      for (let k = 0; k < 60; k++) { if (T.scene(n, { x: s.dax.x, y: s.dax.y - 10, zone: 'mid', power: 3, dist: 40 })) return true; run(6); }
      return false;
    }, name);
    if (!ok) { console.log(name, 'could not start'); await page.close(); continue; }
    const files = [];
    for (let k = 0; k < 48; k++) {
      const st = await page.evaluate(([n, steps]) => {
        const T = window.pet._t;
        for (let i = 0; i < steps; i++) { T.set('touch', T.state().now); T.step(1 / 60); }
        T.draw(); const s = T.state(); const b = T.boxes(); s.offX = b.offX || 0; s.offY = b.offY || 0; s.SS = b.S; s.playing = s.scripts.indexOf(n) >= 0; return s;
      }, [name, Math.round(beat * 60)]);
      // 截角色附近的一块：三个角色（看得见的）的中点
      const S = st.SS || 3, xs = [], ys = [];
      for (const a of ['dax', 'gold', 'person']) if (!st[a].hidden && (a !== 'person' || st.person.scene === name)) { xs.push(st[a].x); ys.push(st[a].y); }
      const mx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : st.LW / 2, my = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : st.LH / 2;
      const offX = st.offX, offY = st.offY;
      let x = Math.round(mx * S + offX - CW / 2), y = Math.round(my * S + offY - CH * 0.62);
      x = Math.max(0, Math.min(W - CW, x)); y = Math.max(0, Math.min(H - CH, y));
      const f = path.join(outDir, name + '_' + String(k).padStart(2, '0') + '.png');
      await page.screenshot({ path: f, clip: { x, y, width: CW, height: CH } });
      files.push(f);
      if (!st.playing) break;
    }
    execFileSync('montage', [...files, '-tile', '4x', '-geometry', CW / 2 + 'x' + CH / 2 + '+2+2', '-background', '#333', path.join(outDir, 'sheet_' + name + '.png')]);
    files.forEach(f => fs.unlinkSync(f));
    console.log(name, files.length, 'frames');
    await page.close();
  }
  await browser.close();
  if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
})();
