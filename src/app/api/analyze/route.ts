import { NextResponse } from 'next/server';
import { getCachedNews } from '@/lib/news-fetcher';
import { generateAnalysisReport, formatReportForConsole } from '@/lib/data-analyzer';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';
    const category = url.searchParams.get('category') || 'all';

    // 获取缓存的新闻
    let news = getCachedNews();

    // 按分类过滤
    if (category !== 'all') {
      news = news.filter(item => item.category === category);
    }

    if (news.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No news data available for analysis. Please fetch news first.',
        suggestion: 'Run: npm run fetch-news',
      }, { status: 404 });
    }

    // 生成分析报告
    const report = generateAnalysisReport(news);

    if (format === 'text') {
      const textReport = formatReportForConsole(report);
      return new Response(textReport, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    return NextResponse.json({
      success: true,
      data: report,
      meta: {
        newsAnalyzed: news.length,
        category,
      },
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to analyze news data' },
      { status: 500 }
    );
  }
}
