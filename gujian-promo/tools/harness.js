// harness.js — static file server + headless Chromium page with the player loaded.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css' };

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      const file = path.normalize(path.join(ROOT, urlPath));
      if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* fall through */ }
  try { return require('/opt/node-tools/node_modules/playwright'); } catch (e) { /* fall through */ }
  throw new Error('playwright not found: run `npm i playwright && npx playwright install chromium`');
}

async function openBrowser() {
  const { chromium } = loadPlaywright();
  const { server, port } = await startServer();
  const browser = await chromium.launch({ args: ['--disable-gpu', '--force-color-profile=srgb', '--disable-lcd-text', '--js-flags=--max-old-space-size=6144'] });
  const logs = [];
  const newPage = async () => {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    await page.goto(`http://127.0.0.1:${port}/src/player.html`);
    await page.waitForFunction(() => window.GJ && window.GJ.ready, null, { timeout: 60000 });
    await page.evaluate(() => window.GJ.ready);
    return page;
  };
  const close = async () => { await browser.close(); server.close(); };
  return { browser, server, port, logs, newPage, close, ROOT };
}

async function openPlayer() {
  const b = await openBrowser();
  const page = await b.newPage();
  return { ...b, page };
}

function dataUrlToBuffer(u) { return Buffer.from(u.slice(u.indexOf(',') + 1), 'base64'); }

module.exports = { openBrowser, openPlayer, dataUrlToBuffer, ROOT };
