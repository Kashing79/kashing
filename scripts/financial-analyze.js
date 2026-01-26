#!/usr/bin/env node

/**
 * Kashing Financial Analyzer
 * 金融数据分析CLI工具
 *
 * Usage:
 *   node scripts/financial-analyze.js AAPL           # 分析苹果公司
 *   node scripts/financial-analyze.js MSFT --full    # 完整分析微软
 *   node scripts/financial-analyze.js --search Apple # 搜索股票
 *   node scripts/financial-analyze.js --watchlist AAPL,MSFT,GOOGL  # 监控多个股票
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// API Keys (从环境变量获取，或使用demo)
const API_KEYS = {
  ALPHA_VANTAGE: process.env.ALPHA_VANTAGE_API_KEY || 'demo',
  FMP: process.env.FMP_API_KEY || 'demo',
};

const DATA_DIR = path.join(__dirname, '..', 'data');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(color, prefix, msg) {
  console.log(`${color}[${prefix}]${colors.reset} ${msg}`);
}

// HTTPS请求封装
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// ============================================================
// API 调用函数
// ============================================================

async function getStockQuote(symbol) {
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEYS.ALPHA_VANTAGE}`;
  const data = await fetchJSON(url);

  if (data['Global Quote']) {
    const q = data['Global Quote'];
    return {
      symbol: q['01. symbol'],
      price: parseFloat(q['05. price']),
      change: parseFloat(q['09. change']),
      changePercent: parseFloat(q['10. change percent']?.replace('%', '')),
      volume: parseInt(q['06. volume']),
      previousClose: parseFloat(q['08. previous close']),
      open: parseFloat(q['02. open']),
      high: parseFloat(q['03. high']),
      low: parseFloat(q['04. low']),
    };
  }
  return null;
}

async function getCompanyProfile(symbol) {
  const url = `https://financialmodelingprep.com/api/v3/profile/${symbol}?apikey=${API_KEYS.FMP}`;
  const data = await fetchJSON(url);
  return data && data[0] ? data[0] : null;
}

async function getIncomeStatement(symbol, limit = 5) {
  const url = `https://financialmodelingprep.com/api/v3/income-statement/${symbol}?limit=${limit}&apikey=${API_KEYS.FMP}`;
  return await fetchJSON(url);
}

async function getFinancialRatios(symbol) {
  const url = `https://financialmodelingprep.com/api/v3/ratios/${symbol}?apikey=${API_KEYS.FMP}`;
  const data = await fetchJSON(url);
  return data && data[0] ? data[0] : null;
}

async function searchStocks(query) {
  const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${API_KEYS.ALPHA_VANTAGE}`;
  const data = await fetchJSON(url);
  return data.bestMatches || [];
}

async function getHistoricalPrices(symbol, outputSize = 'compact') {
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=${outputSize}&apikey=${API_KEYS.ALPHA_VANTAGE}`;
  const data = await fetchJSON(url);

  const timeSeries = data['Time Series (Daily)'];
  if (!timeSeries) return [];

  return Object.entries(timeSeries).slice(0, 30).map(([date, values]) => ({
    date,
    open: parseFloat(values['1. open']),
    high: parseFloat(values['2. high']),
    low: parseFloat(values['3. low']),
    close: parseFloat(values['4. close']),
    volume: parseInt(values['5. volume']),
  }));
}

// ============================================================
// 分析函数
// ============================================================

function analyzeFinancials(incomeStatements, ratios) {
  if (!incomeStatements || incomeStatements.length === 0) {
    return { message: 'No financial data available' };
  }

  const latest = incomeStatements[0];
  const previous = incomeStatements[1];

  const analysis = {
    latestYear: latest.date,
    revenue: latest.revenue,
    netIncome: latest.netIncome,
    eps: latest.eps,
    revenueGrowth: previous ? ((latest.revenue - previous.revenue) / previous.revenue * 100).toFixed(2) + '%' : 'N/A',
    netIncomeGrowth: previous ? ((latest.netIncome - previous.netIncome) / previous.netIncome * 100).toFixed(2) + '%' : 'N/A',
    profitMargin: (latest.netIncome / latest.revenue * 100).toFixed(2) + '%',
  };

  if (ratios) {
    analysis.peRatio = ratios.priceEarningsRatio?.toFixed(2) || 'N/A';
    analysis.pbRatio = ratios.priceToBookRatio?.toFixed(2) || 'N/A';
    analysis.roe = ratios.returnOnEquity ? (ratios.returnOnEquity * 100).toFixed(2) + '%' : 'N/A';
    analysis.debtToEquity = ratios.debtEquityRatio?.toFixed(2) || 'N/A';
    analysis.currentRatio = ratios.currentRatio?.toFixed(2) || 'N/A';
  }

  return analysis;
}

function calculateTechnicals(prices) {
  if (!prices || prices.length < 5) {
    return { message: 'Insufficient price data' };
  }

  const closes = prices.map(p => p.close);
  const latest = closes[0];

  // 简单移动平均
  const sma5 = closes.slice(0, 5).reduce((a, b) => a + b) / 5;
  const sma20 = closes.length >= 20 ? closes.slice(0, 20).reduce((a, b) => a + b) / 20 : null;

  // 价格变化
  const change1d = ((latest - closes[1]) / closes[1] * 100).toFixed(2);
  const change5d = ((latest - closes[4]) / closes[4] * 100).toFixed(2);

  // 高低点
  const high5d = Math.max(...closes.slice(0, 5));
  const low5d = Math.min(...closes.slice(0, 5));

  // 波动率 (简化版)
  const returns = [];
  for (let i = 0; i < Math.min(closes.length - 1, 20); i++) {
    returns.push((closes[i] - closes[i + 1]) / closes[i + 1]);
  }
  const volatility = Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length) * Math.sqrt(252) * 100;

  // 趋势判断
  let trend = 'Neutral';
  if (latest > sma5 && (sma20 === null || sma5 > sma20)) {
    trend = 'Bullish';
  } else if (latest < sma5 && (sma20 === null || sma5 < sma20)) {
    trend = 'Bearish';
  }

  return {
    currentPrice: latest.toFixed(2),
    change1d: change1d + '%',
    change5d: change5d + '%',
    sma5: sma5.toFixed(2),
    sma20: sma20 ? sma20.toFixed(2) : 'N/A',
    high5d: high5d.toFixed(2),
    low5d: low5d.toFixed(2),
    volatility: volatility.toFixed(2) + '%',
    trend,
  };
}

// ============================================================
// 报告生成
// ============================================================

function printCompanyReport(symbol, quote, profile, financialAnalysis, technicals) {
  console.log('\n' + '═'.repeat(70));
  console.log(`${colors.bright}${colors.cyan}  📈 FINANCIAL ANALYSIS: ${symbol}${colors.reset}`);
  console.log('═'.repeat(70));

  // 基本信息
  if (profile) {
    console.log(`\n${colors.bright}Company Profile${colors.reset}`);
    console.log('─'.repeat(70));
    console.log(`  Company:    ${profile.companyName || 'N/A'}`);
    console.log(`  Sector:     ${profile.sector || 'N/A'}`);
    console.log(`  Industry:   ${profile.industry || 'N/A'}`);
    console.log(`  Exchange:   ${profile.exchangeShortName || 'N/A'}`);
    console.log(`  Market Cap: $${formatNumber(profile.mktCap)}`);
    console.log(`  Employees:  ${formatNumber(profile.fullTimeEmployees)}`);
  }

  // 实时报价
  if (quote) {
    console.log(`\n${colors.bright}Current Quote${colors.reset}`);
    console.log('─'.repeat(70));
    const changeColor = quote.change >= 0 ? colors.green : colors.red;
    const arrow = quote.change >= 0 ? '▲' : '▼';
    console.log(`  Price:      ${changeColor}$${quote.price.toFixed(2)} ${arrow} ${quote.change.toFixed(2)} (${quote.changePercent.toFixed(2)}%)${colors.reset}`);
    console.log(`  Open:       $${quote.open.toFixed(2)}`);
    console.log(`  High:       $${quote.high.toFixed(2)}`);
    console.log(`  Low:        $${quote.low.toFixed(2)}`);
    console.log(`  Volume:     ${formatNumber(quote.volume)}`);
  }

  // 技术分析
  if (technicals && !technicals.message) {
    console.log(`\n${colors.bright}Technical Analysis${colors.reset}`);
    console.log('─'.repeat(70));
    const trendColor = technicals.trend === 'Bullish' ? colors.green : technicals.trend === 'Bearish' ? colors.red : colors.yellow;
    console.log(`  Trend:      ${trendColor}${technicals.trend}${colors.reset}`);
    console.log(`  1-Day:      ${parseFloat(technicals.change1d) >= 0 ? colors.green : colors.red}${technicals.change1d}${colors.reset}`);
    console.log(`  5-Day:      ${parseFloat(technicals.change5d) >= 0 ? colors.green : colors.red}${technicals.change5d}${colors.reset}`);
    console.log(`  SMA(5):     $${technicals.sma5}`);
    console.log(`  SMA(20):    $${technicals.sma20}`);
    console.log(`  Volatility: ${technicals.volatility}`);
  }

  // 财务分析
  if (financialAnalysis && !financialAnalysis.message) {
    console.log(`\n${colors.bright}Financial Analysis (${financialAnalysis.latestYear})${colors.reset}`);
    console.log('─'.repeat(70));
    console.log(`  Revenue:         $${formatNumber(financialAnalysis.revenue)}`);
    console.log(`  Net Income:      $${formatNumber(financialAnalysis.netIncome)}`);
    console.log(`  EPS:             $${financialAnalysis.eps?.toFixed(2) || 'N/A'}`);
    console.log(`  Revenue Growth:  ${financialAnalysis.revenueGrowth}`);
    console.log(`  Profit Margin:   ${financialAnalysis.profitMargin}`);

    if (financialAnalysis.peRatio) {
      console.log(`\n${colors.bright}Valuation Ratios${colors.reset}`);
      console.log('─'.repeat(70));
      console.log(`  P/E Ratio:       ${financialAnalysis.peRatio}`);
      console.log(`  P/B Ratio:       ${financialAnalysis.pbRatio}`);
      console.log(`  ROE:             ${financialAnalysis.roe}`);
      console.log(`  Debt/Equity:     ${financialAnalysis.debtToEquity}`);
      console.log(`  Current Ratio:   ${financialAnalysis.currentRatio}`);
    }
  }

  console.log('\n' + '═'.repeat(70) + '\n');
}

function formatNumber(num) {
  if (!num) return 'N/A';
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toLocaleString();
}

// ============================================================
// 主函数
// ============================================================

async function analyzeStock(symbol, full = false) {
  log(colors.cyan, 'INFO', `Analyzing ${symbol}...`);

  try {
    // 并行获取数据
    const [quote, profile, incomeStatement, ratios, prices] = await Promise.all([
      getStockQuote(symbol).catch(() => null),
      getCompanyProfile(symbol).catch(() => null),
      getIncomeStatement(symbol).catch(() => []),
      getFinancialRatios(symbol).catch(() => null),
      getHistoricalPrices(symbol).catch(() => []),
    ]);

    const financialAnalysis = analyzeFinancials(incomeStatement, ratios);
    const technicals = calculateTechnicals(prices);

    printCompanyReport(symbol, quote, profile, financialAnalysis, technicals);

    // 保存结果
    const result = {
      symbol,
      analyzedAt: new Date().toISOString(),
      quote,
      profile,
      financialAnalysis,
      technicals,
      incomeStatement: full ? incomeStatement : undefined,
    };

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    fs.writeFileSync(
      path.join(DATA_DIR, `financial-${symbol}.json`),
      JSON.stringify(result, null, 2)
    );

    log(colors.green, 'OK', `Analysis saved to data/financial-${symbol}.json`);

    return result;
  } catch (error) {
    log(colors.red, 'ERROR', `Analysis failed: ${error.message}`);
    return null;
  }
}

async function handleSearch(query) {
  log(colors.cyan, 'INFO', `Searching for "${query}"...`);

  try {
    const results = await searchStocks(query);

    if (results.length === 0) {
      log(colors.yellow, 'WARN', 'No results found');
      return;
    }

    console.log('\n' + '─'.repeat(70));
    console.log(`${colors.bright}Search Results for "${query}"${colors.reset}`);
    console.log('─'.repeat(70));

    results.forEach((r, i) => {
      console.log(`  ${(i + 1).toString().padStart(2)}. ${colors.cyan}${r['1. symbol'].padEnd(10)}${colors.reset} ${r['2. name']}`);
      console.log(`      ${colors.yellow}${r['3. type']}${colors.reset} | ${r['4. region']}`);
    });

    console.log('─'.repeat(70) + '\n');
  } catch (error) {
    log(colors.red, 'ERROR', `Search failed: ${error.message}`);
  }
}

async function handleWatchlist(symbols) {
  console.log('\n' + '═'.repeat(70));
  console.log(`${colors.bright}${colors.cyan}  📊 WATCHLIST SUMMARY${colors.reset}`);
  console.log('═'.repeat(70));
  console.log(`\n  ${'Symbol'.padEnd(10)} ${'Price'.padEnd(12)} ${'Change'.padEnd(12)} ${'Volume'.padEnd(15)}`);
  console.log('  ' + '─'.repeat(55));

  for (const symbol of symbols) {
    try {
      const quote = await getStockQuote(symbol.trim().toUpperCase());
      if (quote) {
        const changeColor = quote.change >= 0 ? colors.green : colors.red;
        const arrow = quote.change >= 0 ? '▲' : '▼';
        console.log(
          `  ${quote.symbol.padEnd(10)} ` +
          `$${quote.price.toFixed(2).padEnd(11)} ` +
          `${changeColor}${arrow} ${quote.changePercent.toFixed(2).padStart(6)}%${colors.reset}`.padEnd(20) + ` ` +
          `${formatNumber(quote.volume).padEnd(15)}`
        );
      } else {
        console.log(`  ${symbol.padEnd(10)} ${colors.red}No data${colors.reset}`);
      }
    } catch (error) {
      console.log(`  ${symbol.padEnd(10)} ${colors.red}Error${colors.reset}`);
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n' + '═'.repeat(70) + '\n');
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
${colors.cyan}${colors.bright}Kashing Financial Analyzer${colors.reset}

Usage:
  node scripts/financial-analyze.js <SYMBOL>              Analyze a stock
  node scripts/financial-analyze.js <SYMBOL> --full       Full analysis with historical data
  node scripts/financial-analyze.js --search <query>      Search for stocks
  node scripts/financial-analyze.js --watchlist <S1,S2>   Monitor multiple stocks

Examples:
  node scripts/financial-analyze.js AAPL
  node scripts/financial-analyze.js MSFT --full
  node scripts/financial-analyze.js --search "Apple"
  node scripts/financial-analyze.js --watchlist AAPL,MSFT,GOOGL,AMZN

Environment Variables:
  ALPHA_VANTAGE_API_KEY   Your Alpha Vantage API key (get free at alphavantage.co)
  FMP_API_KEY             Your Financial Modeling Prep API key (financialmodelingprep.com)

Note: Without API keys, demo mode is used with limited data.
    `);
    process.exit(0);
  }

  // 搜索模式
  if (args.includes('--search')) {
    const idx = args.indexOf('--search');
    const query = args[idx + 1];
    if (!query) {
      log(colors.red, 'ERROR', 'Please provide a search query');
      process.exit(1);
    }
    await handleSearch(query);
    return;
  }

  // 观察列表模式
  if (args.includes('--watchlist')) {
    const idx = args.indexOf('--watchlist');
    const symbols = args[idx + 1]?.split(',');
    if (!symbols || symbols.length === 0) {
      log(colors.red, 'ERROR', 'Please provide symbols separated by commas');
      process.exit(1);
    }
    await handleWatchlist(symbols);
    return;
  }

  // 单股分析
  const symbol = args[0].toUpperCase();
  const full = args.includes('--full');

  await analyzeStock(symbol, full);
}

main().catch(err => {
  log(colors.red, 'FATAL', err.message);
  process.exit(1);
});
