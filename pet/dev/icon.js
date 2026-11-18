// 开发用：生成 assets/AppIcon.png（1024x1024，透明底）
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.resolve(__dirname, 'icon.html'));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.resolve(__dirname, '../assets/AppIcon.png'), omitBackground: true });
  await browser.close();
})();
