import { NewsItem, NewsSource, FetchResult, NewsCategory } from '@/types/news';
import { newsSources, getEnabledSources } from './news-sources';

// 模拟的RSS解析器（在实际环境中使用 rss-parser）
interface RSSItem {
  title?: string;
  link?: string;
  pubDate?: string;
  content?: string;
  contentSnippet?: string;
  creator?: string;
  enclosure?: { url?: string };
}

// 生成唯一ID
function generateId(source: string, title: string): string {
  const hash = Buffer.from(`${source}-${title}`).toString('base64').slice(0, 12);
  return `${source}-${hash}-${Date.now()}`;
}

// 缓存新闻数据
let newsCache: NewsItem[] = [];
let lastFetchTime: Date | null = null;
let fetchResults: Map<string, FetchResult> = new Map();

// 解析RSS Feed
async function parseRSSFeed(source: NewsSource): Promise<NewsItem[]> {
  try {
    const response = await fetch(source.rssUrl, {
      headers: {
        'User-Agent': 'Kashing News Aggregator/1.0',
      },
      next: { revalidate: 300 }, // 5分钟缓存
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const xmlText = await response.text();
    const items = parseXMLToItems(xmlText, source);

    fetchResults.set(source.id, {
      success: true,
      source: source.name,
      itemsFetched: items.length,
      timestamp: new Date().toISOString(),
    });

    return items;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    fetchResults.set(source.id, {
      success: false,
      source: source.name,
      itemsFetched: 0,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
    return [];
  }
}

// 简单的XML解析（提取基本字段）
function parseXMLToItems(xml: string, source: NewsSource): NewsItem[] {
  const items: NewsItem[] = [];

  // 提取所有<item>或<entry>标签
  const itemRegex = /<item>([\s\S]*?)<\/item>|<entry>([\s\S]*?)<\/entry>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1] || match[2];

    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link') || extractAttribute(itemXml, 'link', 'href');
    const description = extractTag(itemXml, 'description') || extractTag(itemXml, 'summary') || extractTag(itemXml, 'content');
    const pubDate = extractTag(itemXml, 'pubDate') || extractTag(itemXml, 'published') || extractTag(itemXml, 'updated');
    const author = extractTag(itemXml, 'author') || extractTag(itemXml, 'dc:creator');

    // 提取图片
    let imageUrl = extractAttribute(itemXml, 'enclosure', 'url');
    if (!imageUrl) {
      const mediaContent = extractAttribute(itemXml, 'media:content', 'url');
      if (mediaContent) imageUrl = mediaContent;
    }
    if (!imageUrl) {
      // 从description中提取图片
      const imgMatch = description?.match(/<img[^>]+src="([^"]+)"/);
      if (imgMatch) imageUrl = imgMatch[1];
    }

    if (title && link) {
      items.push({
        id: generateId(source.id, title),
        title: cleanHTML(title),
        description: cleanHTML(description || ''),
        link: link,
        pubDate: pubDate || new Date().toISOString(),
        source: source.name,
        sourceUrl: source.url,
        category: source.category,
        region: source.region,
        imageUrl: imageUrl || undefined,
        author: cleanHTML(author || ''),
      });
    }
  }

  return items.slice(0, 20); // 每个源最多20条
}

// 辅助函数：提取XML标签内容
function extractTag(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>|<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? (match[1] || match[2] || '').trim() : null;
}

// 辅助函数：提取XML属性
function extractAttribute(xml: string, tagName: string, attrName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*${attrName}="([^"]*)"`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : null;
}

// 清理HTML标签
function cleanHTML(text: string): string {
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

// 获取所有新闻
export async function fetchAllNews(): Promise<NewsItem[]> {
  const sources = getEnabledSources();
  const allNewsPromises = sources.map(source => parseRSSFeed(source));

  const results = await Promise.allSettled(allNewsPromises);
  const allNews: NewsItem[] = [];

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      allNews.push(...result.value);
    }
  });

  // 按时间排序
  allNews.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  newsCache = allNews;
  lastFetchTime = new Date();

  return allNews;
}

// 按分类获取新闻
export async function fetchNewsByCategory(category: NewsCategory): Promise<NewsItem[]> {
  if (category === 'all') {
    return fetchAllNews();
  }

  const sources = newsSources.filter(s => s.category === category && s.enabled);
  const newsPromises = sources.map(source => parseRSSFeed(source));

  const results = await Promise.allSettled(newsPromises);
  const news: NewsItem[] = [];

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      news.push(...result.value);
    }
  });

  news.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  return news;
}

// 获取缓存的新闻
export function getCachedNews(): NewsItem[] {
  return newsCache;
}

// 获取最后抓取时间
export function getLastFetchTime(): Date | null {
  return lastFetchTime;
}

// 获取抓取结果
export function getFetchResults(): Map<string, FetchResult> {
  return fetchResults;
}

// 搜索新闻
export function searchNews(query: string, news: NewsItem[]): NewsItem[] {
  const lowerQuery = query.toLowerCase();
  return news.filter(item =>
    item.title.toLowerCase().includes(lowerQuery) ||
    item.description.toLowerCase().includes(lowerQuery) ||
    item.source.toLowerCase().includes(lowerQuery)
  );
}
