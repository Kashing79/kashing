import { NewsItem, AnalysisResult, TrendData, SentimentResult, KeywordAnalysis } from '@/types/news';

// 情感词典 (简化版)
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

// 关键主题词
const TOPIC_KEYWORDS: Record<string, string[]> = {
  'central_bank': ['fed', 'federal reserve', 'ecb', 'boj', 'pboc', 'interest rate', 'monetary policy', '央行', '利率'],
  'stock_market': ['stock', 'nasdaq', 's&p', 'dow', 'equity', 'share', 'ipo', '股市', 'A股', '港股'],
  'crypto': ['bitcoin', 'ethereum', 'crypto', 'blockchain', 'btc', 'eth', '比特币', '加密货币'],
  'trade': ['tariff', 'trade war', 'export', 'import', 'sanction', '关税', '贸易战', '出口'],
  'energy': ['oil', 'gas', 'opec', 'energy', 'crude', 'petroleum', '石油', '能源', '原油'],
  'tech': ['ai', 'artificial intelligence', 'tech', 'semiconductor', 'chip', '人工智能', '芯片', '科技'],
  'geopolitics': ['war', 'conflict', 'military', 'nato', 'russia', 'china', 'taiwan', '战争', '冲突', '地缘'],
  'employment': ['job', 'unemployment', 'labor', 'hiring', 'layoff', '就业', '失业', '裁员'],
};

/**
 * 分析单条新闻的情感
 */
export function analyzeSentiment(text: string): SentimentResult {
  const lowerText = text.toLowerCase();

  let positiveCount = 0;
  let negativeCount = 0;

  POSITIVE_WORDS.forEach(word => {
    const regex = new RegExp(word, 'gi');
    const matches = lowerText.match(regex);
    if (matches) positiveCount += matches.length;
  });

  NEGATIVE_WORDS.forEach(word => {
    const regex = new RegExp(word, 'gi');
    const matches = lowerText.match(regex);
    if (matches) negativeCount += matches.length;
  });

  const total = positiveCount + negativeCount;
  let sentiment: 'positive' | 'negative' | 'neutral';
  let score: number;

  if (total === 0) {
    sentiment = 'neutral';
    score = 0;
  } else {
    score = (positiveCount - negativeCount) / total;
    if (score > 0.2) {
      sentiment = 'positive';
    } else if (score < -0.2) {
      sentiment = 'negative';
    } else {
      sentiment = 'neutral';
    }
  }

  return {
    sentiment,
    score: Math.round(score * 100) / 100,
    positiveCount,
    negativeCount,
  };
}

/**
 * 提取新闻中的关键词
 */
export function extractKeywords(text: string): KeywordAnalysis {
  const lowerText = text.toLowerCase();
  const detectedTopics: string[] = [];
  const topicScores: Record<string, number> = {};

  Object.entries(TOPIC_KEYWORDS).forEach(([topic, keywords]) => {
    let count = 0;
    keywords.forEach(keyword => {
      const regex = new RegExp(keyword, 'gi');
      const matches = lowerText.match(regex);
      if (matches) count += matches.length;
    });

    if (count > 0) {
      detectedTopics.push(topic);
      topicScores[topic] = count;
    }
  });

  // 按分数排序
  detectedTopics.sort((a, b) => topicScores[b] - topicScores[a]);

  return {
    topics: detectedTopics.slice(0, 5),
    scores: topicScores,
  };
}

/**
 * 分析新闻列表的整体趋势
 */
export function analyzeTrends(news: NewsItem[]): TrendData {
  const categoryCount: Record<string, number> = {};
  const topicCount: Record<string, number> = {};
  const sentimentByCategory: Record<string, { positive: number; negative: number; neutral: number }> = {};
  const hourlyDistribution: Record<number, number> = {};

  news.forEach(item => {
    // 统计分类
    categoryCount[item.category] = (categoryCount[item.category] || 0) + 1;

    // 分析情感
    const text = `${item.title} ${item.description}`;
    const sentiment = analyzeSentiment(text);

    if (!sentimentByCategory[item.category]) {
      sentimentByCategory[item.category] = { positive: 0, negative: 0, neutral: 0 };
    }
    sentimentByCategory[item.category][sentiment.sentiment]++;

    // 提取主题
    const keywords = extractKeywords(text);
    keywords.topics.forEach(topic => {
      topicCount[topic] = (topicCount[topic] || 0) + 1;
    });

    // 时间分布
    const hour = new Date(item.pubDate).getHours();
    hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;
  });

  // 排序主题
  const trendingTopics = Object.entries(topicCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, count]) => ({ topic, count }));

  return {
    totalNews: news.length,
    categoryDistribution: categoryCount,
    sentimentByCategory,
    trendingTopics,
    hourlyDistribution,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * 综合分析报告
 */
export function generateAnalysisReport(news: NewsItem[]): AnalysisResult {
  const trends = analyzeTrends(news);

  // 计算整体情感
  let totalPositive = 0;
  let totalNegative = 0;
  let totalNeutral = 0;

  Object.values(trends.sentimentByCategory).forEach(s => {
    totalPositive += s.positive;
    totalNegative += s.negative;
    totalNeutral += s.neutral;
  });

  const total = totalPositive + totalNegative + totalNeutral;
  const overallSentiment = total > 0
    ? {
        positive: Math.round((totalPositive / total) * 100),
        negative: Math.round((totalNegative / total) * 100),
        neutral: Math.round((totalNeutral / total) * 100),
      }
    : { positive: 0, negative: 0, neutral: 0 };

  // 找出最热门的新闻源
  const sourceCount: Record<string, number> = {};
  news.forEach(item => {
    sourceCount[item.source] = (sourceCount[item.source] || 0) + 1;
  });
  const topSources = Object.entries(sourceCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([source, count]) => ({ source, count }));

  // 生成摘要
  const summary = generateSummary(trends, overallSentiment);

  return {
    trends,
    overallSentiment,
    topSources,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 生成文字摘要
 */
function generateSummary(
  trends: TrendData,
  sentiment: { positive: number; negative: number; neutral: number }
): string {
  const lines: string[] = [];

  // 整体情感
  if (sentiment.positive > sentiment.negative + 10) {
    lines.push('📈 Overall market sentiment is POSITIVE.');
  } else if (sentiment.negative > sentiment.positive + 10) {
    lines.push('📉 Overall market sentiment is NEGATIVE.');
  } else {
    lines.push('📊 Overall market sentiment is MIXED.');
  }

  // 热门主题
  if (trends.trendingTopics.length > 0) {
    const topTopics = trends.trendingTopics.slice(0, 3).map(t => t.topic);
    lines.push(`🔥 Hot topics: ${topTopics.join(', ')}`);
  }

  // 分类分布
  const topCategory = Object.entries(trends.categoryDistribution)
    .sort((a, b) => b[1] - a[1])[0];
  if (topCategory) {
    lines.push(`📰 Most active category: ${topCategory[0]} (${topCategory[1]} articles)`);
  }

  return lines.join('\n');
}

/**
 * 格式化分析报告为控制台输出
 */
export function formatReportForConsole(report: AnalysisResult): string {
  const lines: string[] = [
    '',
    '═'.repeat(60),
    '📊 KASHING NEWS ANALYSIS REPORT',
    '═'.repeat(60),
    '',
    `Generated: ${report.generatedAt}`,
    `Total Articles Analyzed: ${report.trends.totalNews}`,
    '',
    '─'.repeat(60),
    '📈 OVERALL SENTIMENT',
    '─'.repeat(60),
    `  🟢 Positive: ${report.overallSentiment.positive}%`,
    `  🔴 Negative: ${report.overallSentiment.negative}%`,
    `  ⚪ Neutral:  ${report.overallSentiment.neutral}%`,
    '',
    '─'.repeat(60),
    '🔥 TRENDING TOPICS',
    '─'.repeat(60),
  ];

  report.trends.trendingTopics.forEach((topic, i) => {
    lines.push(`  ${i + 1}. ${topic.topic}: ${topic.count} mentions`);
  });

  lines.push('');
  lines.push('─'.repeat(60));
  lines.push('📰 CATEGORY DISTRIBUTION');
  lines.push('─'.repeat(60));

  Object.entries(report.trends.categoryDistribution).forEach(([cat, count]) => {
    const bar = '█'.repeat(Math.min(Math.round(count / 2), 20));
    lines.push(`  ${cat.padEnd(12)} ${bar} ${count}`);
  });

  lines.push('');
  lines.push('─'.repeat(60));
  lines.push('📝 SUMMARY');
  lines.push('─'.repeat(60));
  lines.push(report.summary);
  lines.push('');
  lines.push('═'.repeat(60));

  return lines.join('\n');
}
