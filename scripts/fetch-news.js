#!/usr/bin/env node

/**
 * Kashing News Aggregator - News Fetcher Script
 * 独立运行的新闻抓取脚本
 *
 * Usage: node scripts/fetch-news.js
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const NEWS_FILE = path.join(DATA_DIR, 'news.json');

// 新闻源配置
const NEWS_SOURCES = [
  // Politics
  {
    id: 'bbc-world',
    name: 'BBC World News',
    rssUrl: 'http://feeds.bbci.co.uk/news/world/rss.xml',
    category: 'politics',
    region: 'Global',
  },
  {
    id: 'npr',
    name: 'NPR News',
    rssUrl: 'https://feeds.npr.org/1001/rss.xml',
    category: 'society',
    region: 'US',
  },
  {
    id: 'guardian',
    name: 'The Guardian',
    rssUrl: 'https://www.theguardian.com/world/rss',
    category: 'society',
    region: 'UK',
  },
];

// 颜色输出
const log = {
  info: (msg) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m[OK]\x1b[0m ${msg}`),
  error: (msg) => console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
  warn: (msg) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
};

// 获取URL内容
function fetchUrl(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const req = protocol.get(url, { timeout }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // 跟随重定向
        fetchUrl(res.headers.location, timeout).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// 解析RSS XML
function parseRSS(xml, source) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const description = extractTag(itemXml, 'description');
    const pubDate = extractTag(itemXml, 'pubDate');

    if (title && link) {
      items.push({
        id: `${source.id}-${Buffer.from(title).toString('base64').slice(0, 8)}-${Date.now()}`,
        title: cleanHtml(title),
        description: cleanHtml(description || ''),
        link,
        pubDate: pubDate || new Date().toISOString(),
        source: source.name,
        sourceUrl: link.split('/').slice(0, 3).join('/'),
        category: source.category,
        region: source.region,
      });
    }
  }

  return items.slice(0, 15); // 每个源最多15条
}

function extractTag(xml, tagName) {
  const regex = new RegExp(
    `<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>|<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
    'i'
  );
  const match = xml.match(regex);
  return match ? (match[1] || match[2] || '').trim() : null;
}

function cleanHtml(text) {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

// 抓取所有新闻
async function fetchAllNews() {
  log.info('Starting news fetch...');

  const allNews = [];
  const results = {
    success: 0,
    failed: 0,
    totalItems: 0,
  };

  for (const source of NEWS_SOURCES) {
    process.stdout.write(`  Fetching ${source.name}... `);

    try {
      const xml = await fetchUrl(source.rssUrl);
      const items = parseRSS(xml, source);
      allNews.push(...items);
      results.success++;
      results.totalItems += items.length;
      console.log(`\x1b[32m✓ ${items.length} items\x1b[0m`);
    } catch (error) {
      console.log(`\x1b[31m✗ ${error.message}\x1b[0m`);
      results.failed++;
    }
  }

  // 按时间排序
  allNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  return { news: allNews, results };
}

// 保存到文件
function saveNews(news) {
  // 确保目录存在
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const data = {
    lastFetch: new Date().toISOString(),
    count: news.length,
    news,
  };

  fs.writeFileSync(NEWS_FILE, JSON.stringify(data, null, 2));
  log.success(`Saved ${news.length} news items to ${NEWS_FILE}`);
}

// 主函数
async function main() {
  console.log('\n' + '='.repeat(50));
  log.info('Kashing News Fetcher');
  console.log('='.repeat(50) + '\n');

  const startTime = Date.now();
  const { news, results } = await fetchAllNews();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n' + '-'.repeat(50));
  log.info(`Fetch completed in ${elapsed}s`);
  log.info(`Sources: ${results.success} OK, ${results.failed} Failed`);
  log.info(`Total items: ${results.totalItems}`);

  if (news.length > 0) {
    saveNews(news);
  } else {
    log.warn('No news items fetched');
  }

  console.log('='.repeat(50) + '\n');
}

main().catch((error) => {
  log.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
