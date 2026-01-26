import { HealthStatus, SourceHealth, DataFreshnessCheck, SystemHealth } from '@/types/news';
import { getEnabledSources } from './news-sources';
import { getFetchResults, getLastFetchTime, getCachedNews } from './news-fetcher';

const FRESHNESS_THRESHOLD_HOURS = 6; // 数据新鲜度阈值（小时）
const CRITICAL_THRESHOLD_HOURS = 24; // 严重过时阈值（小时）

// 检查单个新闻源的健康状态
export async function checkSourceHealth(sourceId: string): Promise<SourceHealth> {
  const fetchResults = getFetchResults();
  const result = fetchResults.get(sourceId);
  const source = getEnabledSources().find(s => s.id === sourceId);

  if (!source) {
    return {
      sourceId,
      sourceName: 'Unknown',
      status: 'error',
      lastFetch: null,
      itemCount: 0,
      errorMessage: 'Source not found',
    };
  }

  if (!result) {
    return {
      sourceId,
      sourceName: source.name,
      status: 'error',
      lastFetch: null,
      itemCount: 0,
      errorMessage: 'Never fetched',
    };
  }

  return {
    sourceId,
    sourceName: source.name,
    status: result.success ? 'ok' : 'error',
    lastFetch: result.timestamp,
    itemCount: result.itemsFetched,
    errorMessage: result.error,
  };
}

// 检查所有新闻源的健康状态
export async function checkAllSourcesHealth(): Promise<SourceHealth[]> {
  const sources = getEnabledSources();
  const healthChecks = await Promise.all(
    sources.map(source => checkSourceHealth(source.id))
  );
  return healthChecks;
}

// 检查数据新鲜度
export function checkDataFreshness(): DataFreshnessCheck {
  const news = getCachedNews();

  if (news.length === 0) {
    return {
      status: 'critical',
      oldestItem: null,
      newestItem: null,
      totalItems: 0,
    };
  }

  const sortedByDate = [...news].sort(
    (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  );

  const newestDate = new Date(sortedByDate[0].pubDate);
  const oldestDate = new Date(sortedByDate[sortedByDate.length - 1].pubDate);
  const now = new Date();

  const hoursSinceNewest = (now.getTime() - newestDate.getTime()) / (1000 * 60 * 60);

  let status: 'fresh' | 'stale' | 'critical';
  if (hoursSinceNewest < FRESHNESS_THRESHOLD_HOURS) {
    status = 'fresh';
  } else if (hoursSinceNewest < CRITICAL_THRESHOLD_HOURS) {
    status = 'stale';
  } else {
    status = 'critical';
  }

  return {
    status,
    oldestItem: oldestDate.toISOString(),
    newestItem: newestDate.toISOString(),
    totalItems: news.length,
  };
}

// 检查系统健康状态
export function checkSystemHealth(): SystemHealth {
  const memoryUsage = process.memoryUsage();
  const usedMemoryMB = memoryUsage.heapUsed / 1024 / 1024;

  return {
    memoryUsage: Math.round(usedMemoryMB * 100) / 100,
    uptime: process.uptime(),
    lastHealthCheck: new Date().toISOString(),
  };
}

// 综合健康检查
export async function performHealthCheck(): Promise<HealthStatus> {
  const sourcesHealth = await checkAllSourcesHealth();
  const dataFreshness = checkDataFreshness();
  const systemHealth = checkSystemHealth();

  // 计算整体状态
  const failedSources = sourcesHealth.filter(s => s.status === 'error').length;
  const totalSources = sourcesHealth.length;
  const failureRate = totalSources > 0 ? failedSources / totalSources : 1;

  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';

  if (failureRate === 0 && dataFreshness.status === 'fresh') {
    overallStatus = 'healthy';
  } else if (failureRate < 0.5 && dataFreshness.status !== 'critical') {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'unhealthy';
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks: {
      sources: sourcesHealth,
      dataFreshness,
      system: systemHealth,
    },
  };
}

// 生成健康报告
export function generateHealthReport(health: HealthStatus): string {
  const lines: string[] = [
    '='.repeat(60),
    '📊 Kashing News Aggregator - Health Report',
    '='.repeat(60),
    '',
    `🕐 Timestamp: ${health.timestamp}`,
    `📈 Overall Status: ${getStatusEmoji(health.status)} ${health.status.toUpperCase()}`,
    '',
    '--- Source Health ---',
  ];

  health.checks.sources.forEach(source => {
    const emoji = source.status === 'ok' ? '✅' : '❌';
    lines.push(`${emoji} ${source.sourceName}: ${source.itemCount} items`);
    if (source.errorMessage) {
      lines.push(`   Error: ${source.errorMessage}`);
    }
  });

  lines.push('');
  lines.push('--- Data Freshness ---');
  lines.push(`Status: ${health.checks.dataFreshness.status}`);
  lines.push(`Total Items: ${health.checks.dataFreshness.totalItems}`);
  if (health.checks.dataFreshness.newestItem) {
    lines.push(`Newest: ${health.checks.dataFreshness.newestItem}`);
  }

  lines.push('');
  lines.push('--- System Health ---');
  lines.push(`Memory Usage: ${health.checks.system.memoryUsage} MB`);
  lines.push(`Uptime: ${Math.round(health.checks.system.uptime)} seconds`);

  lines.push('');
  lines.push('='.repeat(60));

  return lines.join('\n');
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'healthy':
    case 'ok':
    case 'fresh':
      return '🟢';
    case 'degraded':
    case 'stale':
      return '🟡';
    case 'unhealthy':
    case 'error':
    case 'critical':
      return '🔴';
    default:
      return '⚪';
  }
}
