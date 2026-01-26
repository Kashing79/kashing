export type NewsCategory = 'politics' | 'finance' | 'economy' | 'society' | 'all';

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  content?: string;
  link: string;
  pubDate: string;
  source: string;
  sourceUrl: string;
  category: NewsCategory;
  region: string;
  imageUrl?: string;
  author?: string;
}

export interface NewsSource {
  id: string;
  name: string;
  url: string;
  rssUrl: string;
  category: NewsCategory;
  region: string;
  language: string;
  enabled: boolean;
  priority?: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    sources: SourceHealth[];
    dataFreshness: DataFreshnessCheck;
    system: SystemHealth;
  };
}

export interface SourceHealth {
  sourceId: string;
  sourceName: string;
  status: 'ok' | 'error' | 'timeout';
  lastFetch: string | null;
  itemCount: number;
  errorMessage?: string;
}

export interface DataFreshnessCheck {
  status: 'fresh' | 'stale' | 'critical';
  oldestItem: string | null;
  newestItem: string | null;
  totalItems: number;
}

export interface SystemHealth {
  memoryUsage: number;
  uptime: number;
  lastHealthCheck: string;
}

export interface FetchResult {
  success: boolean;
  source: string;
  itemsFetched: number;
  error?: string;
  timestamp: string;
}

// === 数据分析类型 ===

export interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  positiveCount: number;
  negativeCount: number;
}

export interface KeywordAnalysis {
  topics: string[];
  scores: Record<string, number>;
}

export interface TrendData {
  totalNews: number;
  categoryDistribution: Record<string, number>;
  sentimentByCategory: Record<string, { positive: number; negative: number; neutral: number }>;
  trendingTopics: Array<{ topic: string; count: number }>;
  hourlyDistribution: Record<number, number>;
  analyzedAt: string;
}

export interface AnalysisResult {
  trends: TrendData;
  overallSentiment: {
    positive: number;
    negative: number;
    neutral: number;
  };
  topSources: Array<{ source: string; count: number }>;
  summary: string;
  generatedAt: string;
}
