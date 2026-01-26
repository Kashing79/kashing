import { NextRequest, NextResponse } from 'next/server';
import { fetchAllNews, fetchNewsByCategory, searchNews } from '@/lib/news-fetcher';
import { NewsCategory } from '@/types/news';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = (searchParams.get('category') || 'all') as NewsCategory;
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let news;
    if (category === 'all') {
      news = await fetchAllNews();
    } else {
      news = await fetchNewsByCategory(category);
    }

    // 搜索过滤
    if (query) {
      news = searchNews(query, news);
    }

    // 分页
    const paginatedNews = news.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      data: paginatedNews,
      meta: {
        total: news.length,
        limit,
        offset,
        category,
        query: query || null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch news',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
