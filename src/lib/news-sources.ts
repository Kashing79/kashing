import { NewsSource } from '@/types/news';

// 全球重要新闻源配置
export const newsSources: NewsSource[] = [
  // === 政治新闻 (Politics) ===
  {
    id: 'reuters-politics',
    name: 'Reuters Politics',
    url: 'https://www.reuters.com',
    rssUrl: 'https://www.rssboard.org/files/sample-rss-2.xml', // Demo RSS
    category: 'politics',
    region: 'Global',
    language: 'en',
    enabled: true,
  },
  {
    id: 'bbc-world',
    name: 'BBC World News',
    url: 'https://www.bbc.com',
    rssUrl: 'http://feeds.bbci.co.uk/news/world/rss.xml',
    category: 'politics',
    region: 'Global',
    language: 'en',
    enabled: true,
  },
  {
    id: 'aljazeera',
    name: 'Al Jazeera',
    url: 'https://www.aljazeera.com',
    rssUrl: 'https://www.aljazeera.com/xml/rss/all.xml',
    category: 'politics',
    region: 'Middle East',
    language: 'en',
    enabled: true,
  },

  // === 金融新闻 (Finance) ===
  {
    id: 'bloomberg-markets',
    name: 'Bloomberg Markets',
    url: 'https://www.bloomberg.com/markets',
    rssUrl: 'https://feeds.bloomberg.com/markets/news.rss',
    category: 'finance',
    region: 'Global',
    language: 'en',
    enabled: true,
    priority: 1, // 高优先级
  },
  {
    id: 'bloomberg-politics',
    name: 'Bloomberg Politics',
    url: 'https://www.bloomberg.com/politics',
    rssUrl: 'https://feeds.bloomberg.com/politics/news.rss',
    category: 'politics',
    region: 'Global',
    language: 'en',
    enabled: true,
    priority: 1,
  },
  {
    id: 'bloomberg-technology',
    name: 'Bloomberg Technology',
    url: 'https://www.bloomberg.com/technology',
    rssUrl: 'https://feeds.bloomberg.com/technology/news.rss',
    category: 'economy',
    region: 'Global',
    language: 'en',
    enabled: true,
    priority: 1,
  },
  {
    id: 'yahoo-finance',
    name: 'Yahoo Finance',
    url: 'https://finance.yahoo.com',
    rssUrl: 'https://finance.yahoo.com/news/rssindex',
    category: 'finance',
    region: 'Global',
    language: 'en',
    enabled: true,
  },
  {
    id: 'marketwatch',
    name: 'MarketWatch',
    url: 'https://www.marketwatch.com',
    rssUrl: 'http://feeds.marketwatch.com/marketwatch/topstories/',
    category: 'finance',
    region: 'US',
    language: 'en',
    enabled: true,
  },
  {
    id: 'ft-markets',
    name: 'Financial Times',
    url: 'https://www.ft.com',
    rssUrl: 'https://www.ft.com/markets?format=rss',
    category: 'finance',
    region: 'Global',
    language: 'en',
    enabled: true,
  },
  {
    id: 'investing-com',
    name: 'Investing.com',
    url: 'https://www.investing.com',
    rssUrl: 'https://www.investing.com/rss/news.rss',
    category: 'finance',
    region: 'Global',
    language: 'en',
    enabled: true,
  },
  {
    id: 'seekingalpha',
    name: 'Seeking Alpha',
    url: 'https://seekingalpha.com',
    rssUrl: 'https://seekingalpha.com/market_currents.xml',
    category: 'finance',
    region: 'US',
    language: 'en',
    enabled: true,
  },

  // === 经济新闻 (Economy) ===
  {
    id: 'economist',
    name: 'The Economist',
    url: 'https://www.economist.com',
    rssUrl: 'https://www.economist.com/finance-and-economics/rss.xml',
    category: 'economy',
    region: 'Global',
    language: 'en',
    enabled: true,
  },
  {
    id: 'wsj-economy',
    name: 'Wall Street Journal',
    url: 'https://www.wsj.com',
    rssUrl: 'https://feeds.a]content.com/rss/RSSWorldNews.xml',
    category: 'economy',
    region: 'US',
    language: 'en',
    enabled: true,
  },
  {
    id: 'cnbc',
    name: 'CNBC',
    url: 'https://www.cnbc.com',
    rssUrl: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114',
    category: 'economy',
    region: 'US',
    language: 'en',
    enabled: true,
  },

  // === 社会新闻 (Society) ===
  {
    id: 'guardian-world',
    name: 'The Guardian',
    url: 'https://www.theguardian.com',
    rssUrl: 'https://www.theguardian.com/world/rss',
    category: 'society',
    region: 'UK',
    language: 'en',
    enabled: true,
  },
  {
    id: 'nyt-world',
    name: 'New York Times',
    url: 'https://www.nytimes.com',
    rssUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    category: 'society',
    region: 'US',
    language: 'en',
    enabled: true,
  },
  {
    id: 'npr',
    name: 'NPR News',
    url: 'https://www.npr.org',
    rssUrl: 'https://feeds.npr.org/1001/rss.xml',
    category: 'society',
    region: 'US',
    language: 'en',
    enabled: true,
  },

  // === 中文新闻源 ===
  {
    id: 'xinhua',
    name: '新华网',
    url: 'http://www.xinhuanet.com',
    rssUrl: 'http://www.xinhuanet.com/politics/news_politics.xml',
    category: 'politics',
    region: 'China',
    language: 'zh',
    enabled: true,
  },
  {
    id: 'caixin',
    name: '财新网',
    url: 'https://www.caixin.com',
    rssUrl: 'https://rsshub.app/caixin/finance/regulation',
    category: 'finance',
    region: 'China',
    language: 'zh',
    enabled: true,
  },
];

export function getSourcesByCategory(category: string): NewsSource[] {
  if (category === 'all') return newsSources.filter(s => s.enabled);
  return newsSources.filter(s => s.category === category && s.enabled);
}

export function getSourceById(id: string): NewsSource | undefined {
  return newsSources.find(s => s.id === id);
}

export function getEnabledSources(): NewsSource[] {
  return newsSources.filter(s => s.enabled);
}
