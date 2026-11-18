// 开发用：给某个本地页面截图。
// 用法：node shot.js <html 相对路径?query> <输出 png> [宽] [高] [等待毫秒]
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const [target, out, w = '1400', h = '900', wait = '300'] = process.argv.slice(2);
  const [file, query] = target.split('?');
  const url = 'file://' + path.resolve(file) + (query ? '?' + query : '');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.waitForTimeout(+wait);
  await page.screenshot({ path: out, fullPage: true });
  const err = await page.evaluate(() => (document.getElementById('err') || {}).textContent || '');
  if (err) console.log('PAGE ERR:', err);
  if (errors.length) console.log('ERRORS:', errors.join('\n'));
  await browser.close();
  console.log('saved', out);
})();
