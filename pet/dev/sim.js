// 开发用：在无头浏览器里把玩法快进跑一遍，检查有没有报错 / 卡死 / 跑出屏幕。
// 两种模式都跑：满屏幕跑（roam）和只在底部一条（band）。scenes/ 下面所有的戏包都会读进来。
// 她会：拖球、丢球、点、拎、放到别人身上、在谁身上来回蹭鼠标、甩鼠标、嗖地划过去、按"开饭"、电脑睡一会儿、钟往前跳。
// 查：异常、卡住、角色跑出场地 / 位置不是数、演到超时或出错的戏（带名字）、卡在戏里的角色、没人管的道具。
// 用法：node sim.js [输出目录] [快进多少分钟]
//   想拿另一份 web/ 来跑（比如别人正改到一半时留的备份）：PET_WEB=那个目录 node sim.js ...
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const outDir = process.argv[2] || '/tmp/pet-sim';
  const minutes = parseFloat(process.argv[3] || '30');
  fs.mkdirSync(outDir, { recursive: true });
  const url = 'file://' + path.resolve(process.env.PET_WEB || path.join(__dirname, '../web'), 'index.html');
  const browser = await chromium.launch();
  const errors = [];
  let failed = false;
  const fail = (m) => { failed = true; console.log('FAIL:', m); };

  for (const mode of ['roam', 'band']) {
    const page = await browser.newPage({ viewport: mode === 'roam' ? { width: 1440, height: 900 } : { width: 1440, height: 330 } });
    page.on('pageerror', e => errors.push(mode + ' pageerror: ' + (e.stack || e)));
    // 还没写出来的戏包 / needs.js 文件不存在：浏览器会报"读不到文件"，那不算错（外壳本来就跳过不存在的文件）
    page.on('console', m => { if (m.type() === 'error' && !(/Failed to load resource/.test(m.text()) && /\/(scenes\/[^/]+|needs)\.js$/.test((m.location() || {}).url || ''))) errors.push(mode + ' console: ' + m.text() + ' ' + ((m.location() || {}).url || '')); });
    await page.goto(url + '?scale=3&entrance=0&roam=' + (mode === 'roam' ? 1 : 0));
    await page.waitForTimeout(300);
    await page.evaluate(() => window.pet.configure({ paused: true }));
    const res = await page.evaluate((minutes) => {
      const T = window.pet._t, P = window.pet;
      const stats = { throws: 0, grabs: { dax: 0, gold: 0 }, tugs: 0, phases: {}, bad: [], userThrows: 0, pets: 0, carries: 0, taps: 0, homes: 0, maxFree: 0 };
      let prevSt = 'hand', freeFor = 0, stuckFor = 0, lastPhase = '', lastSceneT = 0, lastScene = null;
      const dt = 1 / 60;
      let dragging = false, dragT = 0, carrying = false, carryT = 0, rub = null, gaps = 0, jumps = 0, feeds = 0, rubs = 0, shakes = 0, flybys = 0, dropsOn = 0;
      const stuckSeen = {};
      const rnd = (a, b) => a + Math.random() * (b - a);
      const mid = (b, bx) => [((b[0] + b[2]) / 2) * bx.S + bx.offX, ((b[1] + b[3]) / 2) * bx.S + bx.offY];
      for (let i = 0; i < 60 * 60 * minutes; i++) {
        const s0 = T.state();
        T.set('touch', s0.now);     // 测试时别让它们因为"夜里"去睡觉
        if (dragging) {
          dragT += dt;
          P.pointer('move', rnd(0, s0.LW * s0.S), rnd(0, s0.LH * s0.S));
          if (dragT > rnd(0.2, 1.5)) { P.pointer('up', 0, 0); dragging = false; }
        } else if (carrying) {
          carryT += dt;
          P.pointer('move', rnd(0, s0.LW * s0.S), rnd(0, s0.LH * s0.S));
          if (carryT > rnd(0.3, 1.2)) { P.pointer('up', 0, 0); carrying = false; }
        } else if (Math.random() < 0.0008) {
          const b = T.boxes();
          if (b.ball) { const m = mid(b.ball, b); P.pointer('down', m[0], m[1]); if (T.state().ball.st === 'drag') { dragging = true; dragT = 0; stats.userThrows++; } else P.pointer('up', 0, 0); }
        } else if (Math.random() < 0.0006) {
          const b = T.boxes(), who = [b.dax, b.gold, b.person][(Math.random() * 3) | 0];
          if (who) { const m = mid(who, b); P.pointer('down', m[0], m[1]); if (Math.random() < 0.35) { P.pointer('move', m[0] + 30, m[1] - 30); carrying = true; carryT = 0; stats.carries++; } else { P.pointer('up', 0, 0); stats.pets++; } }
        } else if (Math.random() < 0.0004) {
          P.pointer('down', rnd(40, s0.LW * s0.S - 40), rnd(120, s0.LH * s0.S - 20)); P.pointer('up', 0, 0); stats.taps++;
        } else if (Math.random() < 0.0002) {
          P.command(['throw', 'love', 'gather', 'wave'][(Math.random() * 4) | 0]);
        } else if (Math.random() < 0.00006) {
          P.command('toggleHome'); stats.homes++;
        } else if (rub) {               // 鼠标在谁身上来回蹭 / 在空地上甩 / 嗖地划过去
          rub.k++;
          P.pointer('hover', rub.x + Math.sin(rub.k * rub.w) * rub.amp, rub.y + rub.k * rub.dy);
          if (rub.k > rub.n) rub = null;
        } else if (Math.random() < 0.0004) {
          const b = T.boxes(), who = [b.dax, b.gold, b.person][(Math.random() * 3) | 0], k = Math.random();
          if (who) {
            const m = mid(who, b);
            if (k < 0.5) { rub = { x: m[0], y: m[1], amp: 6 * b.S, w: 0.9, dy: 0, k: 0, n: 90 }; rubs++; }
            else if (k < 0.75) { rub = { x: m[0] - 200, y: m[1] - 20, amp: 0, w: 0, dy: 0, k: 0, n: 1 }; P.pointer('hover', m[0] - 200, m[1] - 20); P.pointer('hover', m[0] + 220, m[1] - 25); flybys++; rub = null; }
            else { rub = { x: rnd(200, s0.LW * s0.S - 200), y: rnd(100, s0.LH * s0.S - 50), amp: 40 * b.S, w: 2.2, dy: 0, k: 0, n: 40 }; shakes++; }
          }
        } else if (Math.random() < 0.0002) {   // 把小腊肠拎到金毛背上 / 把谁拎到小人怀里
          const b = T.boxes(), st = T.state();
          if (b.dax && b.gold && !st.dax.hidden) {
            const m = mid(b.dax, b), g = [st.gold.x * b.S + b.offX, (st.gold.y - 16) * b.S + b.offY];
            P.pointer('down', m[0], m[1]); P.pointer('move', m[0] + 20, m[1] - 20); P.pointer('move', g[0], g[1]); P.pointer('up', 0, 0); dropsOn++;
          }
        } else if (Math.random() < 0.00008) { P.command('feed'); feeds++; }
        else if (Math.random() < 0.00003 && T.care && T.care.clock) {      // 电脑睡了几分钟
          T.care.clock(Date.now() + (gaps + jumps + 1) * 300000, true); gaps++;
        } else if (Math.random() < 0.00002 && T.care && T.care.clock) {   // 钟往前跳两个钟头
          T.care.clock(Date.now() + 7200000 * (jumps + 1), true); jumps++;
        }
        T.step(dt);
        if (i % 3 === 0) T.draw();
        const s = T.state();
        for (const [k, v] of [['ball.x', s.ball.x], ['ball.y', s.ball.y], ['ball.z', s.ball.z], ['person.x', s.person.x], ['person.y', s.person.y], ['dax.x', s.dax.x], ['dax.y', s.dax.y], ['dax.z', s.dax.z], ['gold.x', s.gold.x], ['gold.y', s.gold.y]]) {
          if (!Number.isFinite(v)) stats.bad.push(k + ' not finite at ' + s.now.toFixed(1));
        }
        for (const a of [s.dax, s.gold, s.person]) {
          if (a.x < s.F.x0 - 1 || a.x > s.F.x1 + 1 || a.y < s.F.y0 - 1 || a.y > s.F.y1 + 1) stats.bad.push('actor out of field at ' + s.now.toFixed(1) + ' ' + JSON.stringify(a) + JSON.stringify(s.F));
        }
        if (s.ball.st === 'free' && prevSt !== 'free') stats.throws++;
        if (s.ball.st === 'mouth' && prevSt !== 'mouth') stats.grabs[s.ball.holder]++;
        if (s.ball.st === 'tug' && prevSt !== 'tug') stats.tugs++;
        prevSt = s.ball.st;
        freeFor = s.ball.st === 'free' ? freeFor + dt : 0;
        if (freeFor > stats.maxFree) stats.maxFree = freeFor;
        stats.phases[s.phase] = (stats.phases[s.phase] || 0) + dt;
        // 除了休息以外，任何阶段都不该卡超过 45 秒；一段小剧场也不该超过 70 秒
        if (s.phase === lastPhase && s.phase !== 'rest' && !dragging) stuckFor += dt; else stuckFor = 0;
        lastPhase = s.phase;
        if (stuckFor > 45) { stats.bad.push('stuck in ' + s.phase + ' at ' + s.now.toFixed(1) + ' ' + JSON.stringify(s)); stuckFor = 0; }
        if (s.scene !== lastScene) { lastScene = s.scene; lastSceneT = s.now; }
        if (s.scene && s.now - lastSceneT > 75) { stats.bad.push('scene too long: ' + s.scene); lastSceneT = s.now; }
        if (i % 30 === 0 && T.stuck) for (const m of T.stuck()) { stuckSeen[m] = (stuckSeen[m] || 0) + 1; if (stuckSeen[m] === 3) stats.bad.push('stuck: ' + m + ' at ' + s.now.toFixed(1)); }
        if (stats.bad.length > 5) break;
      }
      for (const k in stats.phases) stats.phases[k] = Math.round(stats.phases[k]);
      stats.maxFree = +stats.maxFree.toFixed(1);
      const e = T.state();
      stats.scenes = e.scenes; stats.endHome = e.home; stats.endPhase = e.phase;
      stats.her = { rubs, shakes, flybys, dropsOn, feeds, gaps, jumps };
      // 每一段戏是怎么结束的：超时、出错的列出来
      const ends = T.ends ? T.ends() : {}, timeouts = [], errs = [];
      let played = 0;
      for (const k in ends) { played++; if (ends[k].timeout) timeouts.push(k + ' x' + ends[k].timeout); if (ends[k].error) errs.push(k + ' x' + ends[k].error); }
      stats.played = played; stats.timeouts = timeouts; stats.sceneErrors = T.sceneErrors ? T.sceneErrors() : [];
      if (errs.length) stats.bad.push('scenes that threw: ' + errs.join(', '));
      for (const m of stats.sceneErrors) stats.bad.push('scene error: ' + m);
      if (T.care && T.care.clock) T.care.clock(null);
      return stats;
    }, minutes);
    console.log(mode + ':', JSON.stringify(res));
    if (res.timeouts && res.timeouts.length) console.log(mode + ': scenes stopped by their time-out (not an error, but look at them): ' + res.timeouts.join(', '));
    if (res.bad.length) fail(mode + ': problems found');
    if (res.throws < minutes * 0.5) fail(mode + ': too few throws');
    if (res.grabs.dax + res.grabs.gold < res.throws * 0.75) fail(mode + ': dogs are not fetching reliably');
    if (Object.keys(res.scenes).length < 8) fail(mode + ': too few different scenes played: ' + Object.keys(res.scenes).join(','));
    await page.close();
  }

  await browser.close();
  if (errors.length) { console.log('ERRORS:\n' + errors.slice(0, 12).join('\n')); failed = true; }
  console.log(failed ? 'RESULT: FAILED' : 'RESULT: OK');
  process.exit(failed ? 1 : 0);
})();
