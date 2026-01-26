#!/usr/bin/env node

/**
 * Kashing News Analyzer Script
 * 独立运行的新闻分析脚本
 *
 * Usage: node scripts/analyze-news.js
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const NEWS_FILE = path.join(DATA_DIR, 'news.json');
const ANALYSIS_FILE = path.join(DATA_DIR, 'analysis.json');

// 情感词典
const POSITIVE_WORDS = [
  'growth', 'gain', 'rise', 'surge', 'rally', 'boom', 'profit', 'success',
  'increase', 'improve', 'positive', 'strong', 'bullish', 'recover', 'win',
  '增长', '上涨', '利好', '盈利', '突破', '创新高', '复苏',
];

const NEGATIVE_WORDS = [
  'fall', 'drop', 'decline', 'crash', 'loss', 'crisis', 'risk', 'fear',
  'recession', 'inflation', 'bearish', 'slump', 'plunge', 'deficit', 'debt',
  '下跌', '暴跌', '亏损', '危机', '风险', '衰退', '通胀',
];

const TOPIC_KEYWORDS = {
  'central_bank': ['fed', 'federal reserve', 'ecb', 'boj', 'pboc', 'interest rate', 'monetary', '央行', '利率'],
  'stock_market': ['stock', 'nasdaq', 's&p', 'dow', 'equity', 'share', 'ipo', '股市', 'a股', '港股'],
  'crypto': ['bitcoin', 'ethereum', 'crypto', 'blockchain', 'btc', 'eth', '比特币', '加密货币'],
  'trade': ['tariff', 'trade war', 'export', 'import', 'sanction', '关税', '贸易战', '出口'],
  'energy': ['oil', 'gas', 'opec', 'energy', 'crude', 'petroleum', '石油', '能源', '原油'],
  'tech': ['ai', 'artificial intelligence', 'tech', 'semiconductor', 'chip', '人工智能', '芯片', '科技'],
  'geopolitics': ['war', 'conflict', 'military', 'nato', 'russia', 'china', 'taiwan', '战争', '冲突', '地缘'],
  'employment': ['job', 'unemployment', 'labor', 'hiring', 'layoff', '就业', '失业', '裁员'],
};

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

// 分析情感
function analyzeSentiment(text) {
  const lowerText = text.toLowerCase();
  let positive = 0;
  let negative = 0;

  POSITIVE_WORDS.forEach(word => {
    const matches = lowerText.match(new RegExp(word, 'gi'));
    if (matches) positive += matches.length;
  });

  NEGATIVE_WORDS.forEach(word => {
    const matches = lowerText.match(new RegExp(word, 'gi'));
    if (matches) negative += matches.length;
  });

  const total = positive + negative;
  if (total === 0) return { sentiment: 'neutral', score: 0 };

  const score = (positive - negative) / total;
  let sentiment;
  if (score > 0.2) sentiment = 'positive';
  else if (score < -0.2) sentiment = 'negative';
  else sentiment = 'neutral';

  return { sentiment, score: Math.round(score * 100) / 100, positive, negative };
}

// 提取主题
function extractTopics(text) {
  const lowerText = text.toLowerCase();
  const topics = {};

  Object.entries(TOPIC_KEYWORDS).forEach(([topic, keywords]) => {
    let count = 0;
    keywords.forEach(keyword => {
      const matches = lowerText.match(new RegExp(keyword, 'gi'));
      if (matches) count += matches.length;
    });
    if (count > 0) topics[topic] = count;
  });

  return topics;
}

// 主分析函数
function analyzeNews(news) {
  const results = {
    totalNews: news.length,
    analyzedAt: new Date().toISOString(),
    categoryStats: {},
    sentimentStats: { positive: 0, negative: 0, neutral: 0 },
    topicStats: {},
    sourceStats: {},
    topStories: [],
  };

  news.forEach(item => {
    const text = `${item.title} ${item.description || ''}`;

    // 分类统计
    results.categoryStats[item.category] = (results.categoryStats[item.category] || 0) + 1;

    // 来源统计
    results.sourceStats[item.source] = (results.sourceStats[item.source] || 0) + 1;

    // 情感分析
    const sentiment = analyzeSentiment(text);
    results.sentimentStats[sentiment.sentiment]++;
    item._sentiment = sentiment;

    // 主题提取
    const topics = extractTopics(text);
    Object.entries(topics).forEach(([topic, count]) => {
      results.topicStats[topic] = (results.topicStats[topic] || 0) + count;
    });
    item._topics = Object.keys(topics);
  });

  // 排序主题
  results.trendingTopics = Object.entries(results.topicStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, count]) => ({ topic, count }));

  // 选出重要新闻 (基于情感强度和主题相关性)
  results.topStories = news
    .filter(item => item._sentiment && Math.abs(item._sentiment.score) > 0.3)
    .slice(0, 10)
    .map(item => ({
      title: item.title,
      source: item.source,
      category: item.category,
      sentiment: item._sentiment.sentiment,
      topics: item._topics,
      link: item.link,
    }));

  return results;
}

// 打印报告
function printReport(analysis) {
  console.log('\n' + '═'.repeat(70));
  console.log(`${colors.bright}${colors.cyan}  📊 KASHING NEWS ANALYSIS REPORT${colors.reset}`);
  console.log('═'.repeat(70));

  console.log(`\n${colors.blue}Generated:${colors.reset} ${analysis.analyzedAt}`);
  console.log(`${colors.blue}Articles Analyzed:${colors.reset} ${analysis.totalNews}`);

  // 情感分析
  console.log('\n' + '─'.repeat(70));
  console.log(`${colors.bright}📈 MARKET SENTIMENT${colors.reset}`);
  console.log('─'.repeat(70));

  const total = analysis.sentimentStats.positive + analysis.sentimentStats.negative + analysis.sentimentStats.neutral;
  const posPercent = Math.round((analysis.sentimentStats.positive / total) * 100) || 0;
  const negPercent = Math.round((analysis.sentimentStats.negative / total) * 100) || 0;
  const neuPercent = Math.round((analysis.sentimentStats.neutral / total) * 100) || 0;

  console.log(`  ${colors.green}🟢 Positive:${colors.reset} ${posPercent}% (${analysis.sentimentStats.positive} articles)`);
  console.log(`  ${colors.red}🔴 Negative:${colors.reset} ${negPercent}% (${analysis.sentimentStats.negative} articles)`);
  console.log(`  ⚪ Neutral:  ${neuPercent}% (${analysis.sentimentStats.neutral} articles)`);

  // 热门主题
  console.log('\n' + '─'.repeat(70));
  console.log(`${colors.bright}🔥 TRENDING TOPICS${colors.reset}`);
  console.log('─'.repeat(70));

  analysis.trendingTopics.forEach((t, i) => {
    const bar = '█'.repeat(Math.min(Math.round(t.count / 2), 30));
    console.log(`  ${(i + 1).toString().padStart(2)}. ${t.topic.padEnd(15)} ${colors.yellow}${bar}${colors.reset} ${t.count}`);
  });

  // 分类分布
  console.log('\n' + '─'.repeat(70));
  console.log(`${colors.bright}📰 CATEGORY DISTRIBUTION${colors.reset}`);
  console.log('─'.repeat(70));

  Object.entries(analysis.categoryStats).forEach(([cat, count]) => {
    const bar = '█'.repeat(Math.min(Math.round(count / 2), 30));
    console.log(`  ${cat.padEnd(12)} ${colors.magenta}${bar}${colors.reset} ${count}`);
  });

  // 重要新闻
  if (analysis.topStories.length > 0) {
    console.log('\n' + '─'.repeat(70));
    console.log(`${colors.bright}⭐ KEY STORIES${colors.reset}`);
    console.log('─'.repeat(70));

    analysis.topStories.slice(0, 5).forEach((story, i) => {
      const sentimentIcon = story.sentiment === 'positive' ? '📈' : story.sentiment === 'negative' ? '📉' : '📊';
      console.log(`\n  ${i + 1}. ${sentimentIcon} ${story.title.slice(0, 60)}...`);
      console.log(`     ${colors.cyan}Source:${colors.reset} ${story.source} | ${colors.cyan}Category:${colors.reset} ${story.category}`);
      if (story.topics.length > 0) {
        console.log(`     ${colors.cyan}Topics:${colors.reset} ${story.topics.join(', ')}`);
      }
    });
  }

  console.log('\n' + '═'.repeat(70) + '\n');
}

// 主函数
async function main() {
  console.log(`\n${colors.cyan}${colors.bright}Starting Kashing News Analyzer...${colors.reset}\n`);

  // 检查数据文件
  if (!fs.existsSync(NEWS_FILE)) {
    log(colors.red, 'ERROR', `News data not found: ${NEWS_FILE}`);
    log(colors.yellow, 'TIP', 'Run "npm run fetch-news" first to fetch news data');
    process.exit(1);
  }

  // 读取新闻数据
  log(colors.cyan, 'INFO', 'Loading news data...');
  const data = JSON.parse(fs.readFileSync(NEWS_FILE, 'utf8'));

  if (!data.news || data.news.length === 0) {
    log(colors.red, 'ERROR', 'No news articles found in data file');
    process.exit(1);
  }

  log(colors.green, 'OK', `Loaded ${data.news.length} articles from ${data.lastFetch}`);

  // 运行分析
  log(colors.cyan, 'INFO', 'Analyzing news data...');
  const analysis = analyzeNews(data.news);

  // 保存分析结果
  fs.writeFileSync(ANALYSIS_FILE, JSON.stringify(analysis, null, 2));
  log(colors.green, 'OK', `Analysis saved to ${ANALYSIS_FILE}`);

  // 打印报告
  printReport(analysis);
}

main().catch(err => {
  log(colors.red, 'FATAL', err.message);
  process.exit(1);
});
