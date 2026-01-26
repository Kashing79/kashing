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
