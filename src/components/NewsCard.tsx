'use client';

import { NewsItem } from '@/types/news';

interface NewsCardProps {
  news: NewsItem;
}

const categoryColors: Record<string, string> = {
  politics: 'bg-red-500',
  finance: 'bg-green-500',
  economy: 'bg-blue-500',
  society: 'bg-purple-500',
};

const categoryLabels: Record<string, { en: string; zh: string }> = {
  politics: { en: 'Politics', zh: '政治' },
  finance: { en: 'Finance', zh: '金融' },
  economy: { en: 'Economy', zh: '经济' },
  society: { en: 'Society', zh: '社会' },
};

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} min ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  } catch {
    return dateString;
  }
}

export default function NewsCard({ news }: NewsCardProps) {
  const categoryColor = categoryColors[news.category] || 'bg-slate-500';
  const categoryLabel = categoryLabels[news.category] || { en: news.category, zh: '' };

  return (
    <article className="news-card bg-white dark:bg-slate-800 rounded-xl shadow-md overflow-hidden border border-slate-200 dark:border-slate-700">
      {/* Image */}
      {news.imageUrl && (
        <div className="relative h-48 bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <img
            src={news.imageUrl}
            alt={news.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="absolute top-3 left-3">
            <span className={`${categoryColor} text-white text-xs font-medium px-2 py-1 rounded`}>
              {categoryLabel.en}
            </span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Category tag (if no image) */}
        {!news.imageUrl && (
          <div className="mb-2">
            <span className={`${categoryColor} text-white text-xs font-medium px-2 py-1 rounded`}>
              {categoryLabel.en} ({categoryLabel.zh})
            </span>
          </div>
        )}

        {/* Title */}
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 line-clamp-2 hover:text-blue-600 dark:hover:text-blue-400">
          <a href={news.link} target="_blank" rel="noopener noreferrer">
            {news.title}
          </a>
        </h3>

        {/* Description */}
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-3">
          {news.description}
        </p>

        {/* Meta */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {news.source}
            </span>
            <span className="text-slate-400">|</span>
            <span>{news.region}</span>
          </div>
          <time dateTime={news.pubDate}>
            {formatDate(news.pubDate)}
          </time>
        </div>
      </div>
    </article>
  );
}
