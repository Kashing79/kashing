#!/usr/bin/env node

/**
 * Kashing Auto Runner
 * 自动化定时任务运行器
 *
 * Usage:
 *   node scripts/auto-runner.js          # 运行一次
 *   node scripts/auto-runner.js --daemon # 后台持续运行
 *   node scripts/auto-runner.js --interval 30  # 每30分钟运行
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SCRIPTS_DIR = __dirname;
const DATA_DIR = path.join(__dirname, '..', 'data');
const LOG_FILE = path.join(DATA_DIR, 'auto-runner.log');

// 默认配置
const DEFAULT_INTERVAL_MINUTES = 60; // 默认每小时运行一次

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function timestamp() {
  return new Date().toISOString();
}

function log(level, msg) {
  const levelColors = {
    INFO: colors.cyan,
    OK: colors.green,
    WARN: colors.yellow,
    ERROR: colors.red,
  };
  const color = levelColors[level] || colors.reset;
  const line = `[${timestamp()}] [${level}] ${msg}`;

  console.log(`${color}${line}${colors.reset}`);

  // 同时写入日志文件
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.appendFileSync(LOG_FILE, line + '\n');
}

// 运行新闻抓取
async function runFetchNews() {
  log('INFO', 'Starting news fetch...');

  return new Promise((resolve) => {
    const proc = spawn('node', [path.join(SCRIPTS_DIR, 'fetch-news.js')], {
      stdio: 'inherit',
    });

    proc.on('close', (code) => {
      if (code === 0) {
        log('OK', 'News fetch completed successfully');
      } else {
        log('WARN', `News fetch exited with code ${code}`);
      }
      resolve(code);
    });

    proc.on('error', (err) => {
      log('ERROR', `News fetch failed: ${err.message}`);
      resolve(1);
    });
  });
}

// 运行数据分析
async function runAnalysis() {
  log('INFO', 'Starting news analysis...');

  return new Promise((resolve) => {
    const proc = spawn('node', [path.join(SCRIPTS_DIR, 'analyze-news.js')], {
      stdio: 'inherit',
    });

    proc.on('close', (code) => {
      if (code === 0) {
        log('OK', 'News analysis completed successfully');
      } else {
        log('WARN', `News analysis exited with code ${code}`);
      }
      resolve(code);
    });

    proc.on('error', (err) => {
      log('ERROR', `News analysis failed: ${err.message}`);
      resolve(1);
    });
  });
}

// 运行健康检查
async function runHealthCheck() {
  log('INFO', 'Running health check...');

  return new Promise((resolve) => {
    const proc = spawn('node', [path.join(SCRIPTS_DIR, 'health-check.js')], {
      stdio: 'inherit',
    });

    proc.on('close', (code) => {
      resolve(code);
    });

    proc.on('error', (err) => {
      log('ERROR', `Health check failed: ${err.message}`);
      resolve(1);
    });
  });
}

// 完整运行周期
async function runCycle() {
  console.log('\n' + '═'.repeat(70));
  log('INFO', `${colors.bright}Starting Kashing Auto Run Cycle${colors.reset}`);
  console.log('═'.repeat(70) + '\n');

  const startTime = Date.now();

  // 1. 抓取新闻
  await runFetchNews();

  // 2. 分析数据
  await runAnalysis();

  // 3. 健康检查
  await runHealthCheck();

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n' + '═'.repeat(70));
  log('OK', `Cycle completed in ${duration} seconds`);
  console.log('═'.repeat(70) + '\n');
}

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    daemon: false,
    interval: DEFAULT_INTERVAL_MINUTES,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--daemon' || args[i] === '-d') {
      config.daemon = true;
    } else if (args[i] === '--interval' || args[i] === '-i') {
      const value = parseInt(args[i + 1], 10);
      if (!isNaN(value) && value > 0) {
        config.interval = value;
        i++;
      }
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Kashing Auto Runner - 自动化新闻抓取和分析

Usage:
  node scripts/auto-runner.js [options]

Options:
  --daemon, -d           后台持续运行模式
  --interval, -i <min>   运行间隔（分钟），默认 60
  --help, -h             显示帮助信息

Examples:
  node scripts/auto-runner.js              # 运行一次
  node scripts/auto-runner.js --daemon     # 每小时运行一次
  node scripts/auto-runner.js -d -i 30     # 每30分钟运行一次
      `);
      process.exit(0);
    }
  }

  return config;
}

// 主函数
async function main() {
  const config = parseArgs();

  console.log(`
${colors.cyan}${colors.bright}
╔═══════════════════════════════════════════════════════════════╗
║                  KASHING AUTO RUNNER                         ║
║               自动化新闻聚合与分析系统                          ║
╚═══════════════════════════════════════════════════════════════╝
${colors.reset}`);

  log('INFO', `Mode: ${config.daemon ? 'Daemon (持续运行)' : 'Single Run (单次运行)'}`);
  if (config.daemon) {
    log('INFO', `Interval: ${config.interval} minutes`);
  }

  // 首次运行
  await runCycle();

  // 如果是daemon模式，设置定时器
  if (config.daemon) {
    const intervalMs = config.interval * 60 * 1000;
    log('INFO', `Next run in ${config.interval} minutes...`);

    setInterval(async () => {
      await runCycle();
      log('INFO', `Next run in ${config.interval} minutes...`);
    }, intervalMs);

    // 保持进程运行
    process.on('SIGINT', () => {
      log('INFO', 'Received SIGINT, shutting down...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      log('INFO', 'Received SIGTERM, shutting down...');
      process.exit(0);
    });
  }
}

main().catch(err => {
  log('ERROR', `Fatal error: ${err.message}`);
  process.exit(1);
});
