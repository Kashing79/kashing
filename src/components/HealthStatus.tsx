'use client';

import { useState, useEffect } from 'react';
import { HealthStatus as HealthStatusType } from '@/types/news';

interface HealthStatusProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function HealthStatus({ isVisible, onClose }: HealthStatusProps) {
  const [health, setHealth] = useState<HealthStatusType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/health');
      if (!response.ok) throw new Error('Health check failed');
      const data = await response.json();
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health status');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isVisible) {
      fetchHealth();
    }
  }, [isVisible]);

  if (!isVisible) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'ok':
      case 'fresh':
        return 'text-green-500 bg-green-50';
      case 'degraded':
      case 'stale':
        return 'text-yellow-500 bg-yellow-50';
      case 'unhealthy':
      case 'error':
      case 'critical':
        return 'text-red-500 bg-red-50';
      default:
        return 'text-slate-500 bg-slate-50';
    }
  };

  const getStatusEmoji = (status: string) => {
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
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>System Health Check</span>
            <span className="text-sm font-normal text-slate-500">自检状态</span>
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {isLoading && (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-slate-500">Running health checks...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg">
              <p className="font-medium">Error: {error}</p>
            </div>
          )}

          {health && !isLoading && (
            <div className="space-y-6">
              {/* Overall Status */}
              <div className={`p-4 rounded-lg ${getStatusColor(health.status)}`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{getStatusEmoji(health.status)}</span>
                  <div>
                    <p className="font-bold text-lg capitalize">{health.status}</p>
                    <p className="text-sm opacity-75">Last check: {new Date(health.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Data Freshness */}
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Data Freshness 数据新鲜度</h3>
                <div className={`p-3 rounded-lg ${getStatusColor(health.checks.dataFreshness.status)}`}>
                  <div className="flex items-center justify-between">
                    <span>{getStatusEmoji(health.checks.dataFreshness.status)} {health.checks.dataFreshness.status}</span>
                    <span className="text-sm">{health.checks.dataFreshness.totalItems} items</span>
                  </div>
                </div>
              </div>

              {/* Sources Health */}
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">News Sources 新闻源状态</h3>
                <div className="space-y-2">
                  {health.checks.sources.map((source) => (
                    <div
                      key={source.sourceId}
                      className={`p-3 rounded-lg flex items-center justify-between ${getStatusColor(source.status)}`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{getStatusEmoji(source.status)}</span>
                        <span className="font-medium">{source.sourceName}</span>
                      </div>
                      <div className="text-sm">
                        {source.status === 'ok' ? (
                          <span>{source.itemCount} items</span>
                        ) : (
                          <span className="text-red-600">{source.errorMessage || 'Error'}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* System Health */}
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">System 系统状态</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Memory Usage</p>
                    <p className="font-bold text-slate-900 dark:text-white">{health.checks.system.memoryUsage} MB</p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Uptime</p>
                    <p className="font-bold text-slate-900 dark:text-white">
                      {Math.floor(health.checks.system.uptime / 60)} min
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
          <button
            onClick={fetchHealth}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
