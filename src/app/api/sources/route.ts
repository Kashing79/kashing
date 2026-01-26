import { NextResponse } from 'next/server';
import { newsSources, getSourcesByCategory } from '@/lib/news-sources';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');

    let sources;
    if (category && category !== 'all') {
      sources = getSourcesByCategory(category);
    } else {
      sources = newsSources;
    }

    // 返回时隐藏敏感信息
    const safeSources = sources.map(source => ({
      id: source.id,
      name: source.name,
      url: source.url,
      category: source.category,
      region: source.region,
      language: source.language,
      enabled: source.enabled,
    }));

    return NextResponse.json({
      success: true,
      data: safeSources,
      meta: {
        total: safeSources.length,
        category: category || 'all',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch sources',
      },
      { status: 500 }
    );
  }
}
