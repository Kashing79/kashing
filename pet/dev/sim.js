// 开发用：在无头浏览器里跑一遍玩法，检查有没有报错 / 卡死，并截几张图。
// 用法：node sim.js [输出目录]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const outDir = process.argv[2] || '/tmp/pet-sim';
  fs.mkdirSync(outDir, { recursive: true });
  const url = 'file://' + path.resolve(__dirname, '../web/index.html');
  const browser = await chromium.launch();
  const errors = [];
  let failed = false;
  const fail = (m) => { failed = true; console.log('FAIL:', m); };

  // ---------- 1. 快进 40 分钟，随机乱点，检查状态机不会坏 ----------
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 330 } });
    page.on('pageerror', e => errors.push('pageerror: ' + e));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto(url + '?scale=3');
    await page.evaluate(() => window.pet.configure({ paused: true }));
    const res = await page.evaluate(() => {
      const T = window.pet._t, P = window.pet;
      const stats = { throws: 0, grabs: { dax: 0, gold: 0 }, phases: {}, maxFree: 0, bad: [], userThrows: 0, pets: 0 };
      let prevSt = 'hand', freeFor = 0, stuckFor = 0, lastPhase = '';
      const dt = 1 / 60;
      let dragging = false, dragT = 0;
      const rnd = (a, b) => a + Math.random() * (b - a);
      for (let i = 0; i < 60 * 60 * 40; i++) {
        // 随机互动
        if (!dragging && Math.random() < 0.0009) {
          const b = T.boxes();
          if (b.ball) {
            const cx = ((b.ball[0] + b.ball[2]) / 2) * b.S + b.offX, cy = ((b.ball[1] + b.ball[3]) / 2) * b.S + b.offY;
            P.pointer('down', cx, cy);
            if (T.state().ball.st === 'drag') { dragging = true; dragT = 0; stats.userThrows++; }
            else P.pointer('up', 0, 0);
          }
        } else if (dragging) {
          dragT += dt;
          const s = T.state();
          P.pointer('move', rnd(0, s.LW * s.S), rnd(0, s.LH * s.S));
          if (dragT > rnd(0.2, 1.5)) { P.pointer('up', 0, 0); dragging = false; }
        } else if (Math.random() < 0.0006) {
          const b = T.boxes(), who = [b.dax, b.gold, b.person][(Math.random() * 3) | 0];
          if (who) { P.pointer('down', ((who[0] + who[2]) / 2) * b.S + b.offX, ((who[1] + who[3]) / 2) * b.S + b.offY); P.pointer('up', 0, 0); stats.pets++; }
        } else if (Math.random() < 0.0002) {
          P.command('throw');
        }
        T.step(dt);
        if (i % 3 === 0) T.draw();
        const s = T.state();
        // 数据检查
        for (const [k, v] of [['ball.x', s.ball.x], ['ball.z', s.ball.z], ['person.x', s.person.x], ['dax.x', s.dax.x], ['dax.z', s.dax.z], ['gold.x', s.gold.x]]) {
          if (!Number.isFinite(v)) { stats.bad.push(k + ' not finite at ' + s.now.toFixed(1)); }
        }
        if (s.dax.x < 0 || s.dax.x > s.LW || s.gold.x < 0 || s.gold.x > s.LW || s.person.x < 0 || s.person.x > s.LW || s.ball.x < 0 || s.ball.x > s.LW) stats.bad.push('out of range at ' + s.now.toFixed(1));
        if (s.ball.st === 'free' && prevSt !== 'free') stats.throws++;
        if (s.ball.st === 'mouth' && prevSt !== 'mouth') stats.grabs[s.ball.holder]++;
        prevSt = s.ball.st;
        freeFor = s.ball.st === 'free' ? freeFor + dt : 0;
        if (freeFor > stats.maxFree) stats.maxFree = freeFor;
        stats.phases[s.phase] = (stats.phases[s.phase] || 0) + dt;
        // 除了休息以外，任何阶段都不该卡超过 40 秒
        if (s.phase === lastPhase && s.phase !== 'rest') stuckFor += dt; else stuckFor = 0;
        lastPhase = s.phase;
        if (stuckFor > 40) { stats.bad.push('stuck in ' + s.phase + ' at ' + s.now.toFixed(1) + ' ' + JSON.stringify(s)); stuckFor = 0; }
        if (stats.bad.length > 5) break;
      }
      for (const k in stats.phases) stats.phases[k] = Math.round(stats.phases[k]);
      stats.maxFree = +stats.maxFree.toFixed(1);
      stats.end = T.state();
      return stats;
    });
    console.log('fast-forward:', JSON.stringify(res, null, 1));
    if (res.bad.length) fail('fast-forward found problems');
    if (res.throws < 20) fail('too few throws');
    // 有些球是飞到一半又被鼠标抓走的，所以不会是 100%
    if (res.grabs.dax + res.grabs.gold < res.throws * 0.8) fail('dogs are not fetching reliably');
    await page.close();
  }

  // ---------- 2. 实时跑一小段，截图 ----------
  {
    const page = await browser.newPage({ viewport: { width: 1200, height: 420 } });
    page.on('pageerror', e => errors.push('pageerror: ' + e));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto(url + '?scale=3');
    await page.waitForTimeout(2300);
    await page.screenshot({ path: path.join(outDir, 'a_wave.png') });
    await page.evaluate(() => window.pet.command('throw'));
    for (let i = 0; i < 16; i++) {
      await page.waitForTimeout(260);
      await page.screenshot({ path: path.join(outDir, 'b_throw_' + String(i).padStart(2, '0') + '.png') });
    }
    // 用鼠标拖球甩出去
    await page.waitForTimeout(3000);
    const b = await page.evaluate(() => window.pet._t.boxes());
    if (b.ball) {
      const cx = ((b.ball[0] + b.ball[2]) / 2) * b.S + b.offX, cy = ((b.ball[1] + b.ball[3]) / 2) * b.S + b.offY;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx - 60, cy - 120, { steps: 8 });
      await page.screenshot({ path: path.join(outDir, 'c_drag_0.png') });
      await page.mouse.move(cx + 120, cy - 220, { steps: 6 });
      await page.mouse.up();
      for (let i = 1; i < 8; i++) {
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(outDir, 'c_drag_' + i + '.png') });
      }
    } else fail('ball box missing');
    console.log('realtime state:', JSON.stringify(await page.evaluate(() => window.pet._t.state())));
    await page.close();
  }

  await browser.close();
  if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); failed = true; }
  console.log(failed ? 'RESULT: FAILED' : 'RESULT: OK');
  process.exit(failed ? 1 : 0);
})();
