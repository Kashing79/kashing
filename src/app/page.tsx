'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import CategoryTabs from '@/components/CategoryTabs';
import NewsList from '@/components/NewsList';
import HealthStatus from '@/components/HealthStatus';
import { NewsItem, NewsCategory } from '@/types/news';

export default function HomePage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [filteredNews, setFilteredNews] = useState<NewsItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<NewsCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showHealthStatus, setShowHealthStatus] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // 获取新闻
  const fetchNews = useCallback(async (category: NewsCategory = 'all') => {
    setIsLoading(true);
    try {
      const url = `/api/news?category=${category}${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ''}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setNews(data.data);
        setFilteredNews(data.data);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch news:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  // 初始加载
  useEffect(() => {
    fetchNews(activeCategory);
  }, []);

  // 分类改变时重新获取
  useEffect(() => {
    fetchNews(activeCategory);
  }, [activeCategory, fetchNews]);

  // 计算各分类的数量
  const categoryCounts = news.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    acc.all = (acc.all || 0) + 1;
    return acc;
  }, {} as Record<NewsCategory, number>);

  // 搜索处理
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      const filtered = news.filter(
        item =>
          item.title.toLowerCase().includes(lowerQuery) ||
          item.description.toLowerCase().includes(lowerQuery) ||
          item.source.toLowerCase().includes(lowerQuery)
      );
      setFilteredNews(filtered);
    } else {
      setFilteredNews(news);
    }
  };

  // 刷新处理
  const handleRefresh = () => {
    fetchNews(activeCategory);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Header
        onSearch={handleSearch}
        onRefresh={handleRefresh}
        isLoading={isLoading}
      />

      <CategoryTabs
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        counts={categoryCounts}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 text-sm text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-4">
            <span>
              Showing <strong className="text-slate-900 dark:text-white">{filteredNews.length}</strong> articles
            </span>
            {searchQuery && (
              <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                Search: "{searchQuery}"
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {lastUpdate && (
              <span>
                Last update: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={() => setShowHealthStatus(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Health Check</span>
            </button>
          </div>
        </div>

        {/* News Grid */}
        <NewsList news={filteredNews} isLoading={isLoading} />

        {/* Load More */}
        {filteredNews.length > 0 && !isLoading && (
          <div className="text-center mt-8">
            <button
              onClick={handleRefresh}
              className="px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors font-medium"
            >
              Load More News
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-bold mb-4">Kashing</h3>
              <p className="text-slate-400 text-sm">
                Global News Aggregator - Your source for worldwide news on Politics, Finance, Economy, and Society.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-bold mb-4">Categories 分类</h3>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li>🔴 Politics 政治</li>
                <li>🟢 Finance 金融</li>
                <li>🔵 Economy 经济</li>
                <li>🟣 Society 社会</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold mb-4">Features 功能</h3>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li>Real-time news aggregation</li>
                <li>Multi-source coverage</li>
                <li>Health monitoring & self-check</li>
                <li>Search & filter</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-slate-500 text-sm">
            <p>&copy; {new Date().getFullYear()} Kashing News Aggregator. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Health Status Modal */}
      <HealthStatus
        isVisible={showHealthStatus}
        onClose={() => setShowHealthStatus(false)}
      />
    </div>
  );
}
