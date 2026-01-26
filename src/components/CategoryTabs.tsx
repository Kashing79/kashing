'use client';

import { NewsCategory } from '@/types/news';

interface CategoryTabsProps {
  activeCategory: NewsCategory;
  onCategoryChange: (category: NewsCategory) => void;
  counts?: Record<NewsCategory, number>;
}

const categories: { id: NewsCategory; label: string; labelZh: string; color: string }[] = [
  { id: 'all', label: 'All News', labelZh: '全部新闻', color: 'bg-slate-600' },
  { id: 'politics', label: 'Politics', labelZh: '政治', color: 'bg-red-500' },
  { id: 'finance', label: 'Finance', labelZh: '金融', color: 'bg-green-500' },
  { id: 'economy', label: 'Economy', labelZh: '经济', color: 'bg-blue-500' },
  { id: 'society', label: 'Society', labelZh: '社会', color: 'bg-purple-500' },
];

export default function CategoryTabs({ activeCategory, onCategoryChange, counts }: CategoryTabsProps) {
  return (
    <div className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700 sticky top-[76px] z-40">
      <div className="max-w-7xl mx-auto px-4">
        <nav className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeCategory === cat.id
                  ? `${cat.color} text-white shadow-md`
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <span>{cat.label}</span>
              <span className="text-xs opacity-70">({cat.labelZh})</span>
              {counts && counts[cat.id] !== undefined && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  activeCategory === cat.id
                    ? 'bg-white/20'
                    : 'bg-slate-200 dark:bg-slate-600'
                }`}>
                  {counts[cat.id]}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
