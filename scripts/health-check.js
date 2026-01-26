#!/usr/bin/env node

/**
 * Kashing News Aggregator - Health Check Script
 * 独立运行的健康检查脚本
 *
 * Usage: node scripts/health-check.js
 */

const https = require('https');
const http = require('http');

const CONFIG = {
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  timeout: 30000,
};

// 新闻源列表（简化版）
const NEWS_SOURCES = [
  { name: 'BBC World', url: 'http://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'Reuters', url: 'https://www.rssboard.org/files/sample-rss-2.xml' },
  { name: 'Guardian', url: 'https://www.theguardian.com/world/rss' },
  { name: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml' },
];

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function printHeader() {
  console.log('\n' + '='.repeat(60));
  log('cyan', '📊 Kashing News Aggregator - Health Check');
  console.log('='.repeat(60));
  console.log(`🕐 Time: ${new Date().toISOString()}`);
  console.log('');
}

// 检查单个URL
function checkUrl(url, timeout = 10000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const protocol = url.startsWith('https') ? https : http;

    const req = protocol.get(url, { timeout }, (res) => {
      const elapsed = Date.now() - start;
      resolve({
        success: res.statusCode >= 200 && res.statusCode < 400,
        statusCode: res.statusCode,
        elapsed,
      });
    });

    req.on('error', (error) => {
      resolve({
        success: false,
        error: error.message,
        elapsed: Date.now() - start,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Timeout',
        elapsed: timeout,
      });
    });
  });
}

// 检查所有新闻源
async function checkNewsSources() {
  log('blue', '--- Checking News Sources ---');

  let successCount = 0;
  let failCount = 0;

  for (const source of NEWS_SOURCES) {
    process.stdout.write(`  Checking ${source.name}... `);
    const result = await checkUrl(source.url);

    if (result.success) {
      log('green', `✓ OK (${result.elapsed}ms)`);
      successCount++;
    } else {
      log('red', `✗ FAILED (${result.error || `HTTP ${result.statusCode}`})`);
      failCount++;
    }
  }

  console.log('');
  log('blue', `  Summary: ${successCount} OK, ${failCount} Failed`);

  return { successCount, failCount, total: NEWS_SOURCES.length };
}

// 检查API端点
async function checkApiEndpoints() {
  log('blue', '\n--- Checking API Endpoints ---');

  const endpoints = [
    { name: 'News API', path: '/api/news' },
    { name: 'Health API', path: '/api/health' },
    { name: 'Sources API', path: '/api/sources' },
  ];

  let allOk = true;

  for (const endpoint of endpoints) {
    const url = `${CONFIG.baseUrl}${endpoint.path}`;
    process.stdout.write(`  Checking ${endpoint.name}... `);

    try {
      const result = await checkUrl(url);
      if (result.success) {
        log('green', `✓ OK (${result.elapsed}ms)`);
      } else {
        log('yellow', `⚠ ${result.error || `HTTP ${result.statusCode}`}`);
        allOk = false;
      }
    } catch (error) {
      log('yellow', `⚠ Not running (server may be down)`);
      allOk = false;
    }
  }

  return allOk;
}

// 系统检查
function checkSystem() {
  log('blue', '\n--- System Information ---');

  const memUsage = process.memoryUsage();
  const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100;
  const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100;

  console.log(`  Node.js: ${process.version}`);
  console.log(`  Platform: ${process.platform} ${process.arch}`);
  console.log(`  Memory: ${memUsedMB}MB / ${memTotalMB}MB`);
  console.log(`  PID: ${process.pid}`);
}

// 生成报告
function generateReport(sourcesResult, apiResult) {
  console.log('\n' + '='.repeat(60));
  log('cyan', '📋 Health Check Report');
  console.log('='.repeat(60));

  const sourceHealthy = sourcesResult.failCount === 0;
  const overallHealthy = sourceHealthy && apiResult;

  if (overallHealthy) {
    log('green', '\n🟢 OVERALL STATUS: HEALTHY');
  } else if (sourcesResult.failCount < sourcesResult.total / 2) {
    log('yellow', '\n🟡 OVERALL STATUS: DEGRADED');
  } else {
    log('red', '\n🔴 OVERALL STATUS: UNHEALTHY');
  }

  console.log('\n' + '='.repeat(60) + '\n');

  return overallHealthy ? 0 : 1;
}

// 主函数
async function main() {
  printHeader();

  const sourcesResult = await checkNewsSources();
  const apiResult = await checkApiEndpoints();
  checkSystem();

  const exitCode = generateReport(sourcesResult, apiResult);
  process.exit(exitCode);
}

main().catch((error) => {
  log('red', `\nFatal error: ${error.message}`);
  process.exit(1);
});
