import { NextResponse } from 'next/server';
import {
  getStockQuote,
  getHistoricalPrices,
  getCompanyProfile,
  getIncomeStatement,
  getBalanceSheet,
  getCashFlowStatement,
  getFinancialRatios,
  getKeyMetrics,
  getComprehensiveAnalysis,
  searchStocks,
  getMarketIndices,
  getEconomicIndicator,
} from '@/lib/financial-data';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const symbol = url.searchParams.get('symbol');

    // 股票搜索
    if (action === 'search') {
      const query = url.searchParams.get('q');
      if (!query) {
        return NextResponse.json({ success: false, error: 'Missing query parameter' }, { status: 400 });
      }
      const results = await searchStocks(query);
      return NextResponse.json({ success: true, data: results });
    }

    // 市场指数
    if (action === 'indices') {
      const indices = await getMarketIndices();
      return NextResponse.json({ success: true, data: indices });
    }

    // 经济指标
    if (action === 'economic') {
      const indicator = url.searchParams.get('indicator') as any;
      if (!indicator) {
        return NextResponse.json({ success: false, error: 'Missing indicator parameter' }, { status: 400 });
      }
      const data = await getEconomicIndicator(indicator);
      return NextResponse.json({ success: true, data });
    }

    // 以下操作需要股票代码
    if (!symbol) {
      return NextResponse.json({ success: false, error: 'Missing symbol parameter' }, { status: 400 });
    }

    const upperSymbol = symbol.toUpperCase();

    switch (action) {
      case 'quote': {
        const quote = await getStockQuote(upperSymbol);
        return NextResponse.json({ success: true, data: quote });
      }

      case 'history': {
        const outputSize = url.searchParams.get('size') as 'compact' | 'full' || 'compact';
        const prices = await getHistoricalPrices(upperSymbol, outputSize);
        return NextResponse.json({ success: true, data: prices });
      }

      case 'profile': {
        const profile = await getCompanyProfile(upperSymbol);
        return NextResponse.json({ success: true, data: profile });
      }

      case 'income': {
        const period = url.searchParams.get('period') as 'annual' | 'quarter' || 'annual';
        const limit = parseInt(url.searchParams.get('limit') || '5');
        const income = await getIncomeStatement(upperSymbol, period, limit);
        return NextResponse.json({ success: true, data: income });
      }

      case 'balance': {
        const period = url.searchParams.get('period') as 'annual' | 'quarter' || 'annual';
        const limit = parseInt(url.searchParams.get('limit') || '5');
        const balance = await getBalanceSheet(upperSymbol, period, limit);
        return NextResponse.json({ success: true, data: balance });
      }

      case 'cashflow': {
        const period = url.searchParams.get('period') as 'annual' | 'quarter' || 'annual';
        const limit = parseInt(url.searchParams.get('limit') || '5');
        const cashflow = await getCashFlowStatement(upperSymbol, period, limit);
        return NextResponse.json({ success: true, data: cashflow });
      }

      case 'ratios': {
        const ratios = await getFinancialRatios(upperSymbol);
        return NextResponse.json({ success: true, data: ratios });
      }

      case 'metrics': {
        const metrics = await getKeyMetrics(upperSymbol);
        return NextResponse.json({ success: true, data: metrics });
      }

      case 'comprehensive':
      default: {
        const analysis = await getComprehensiveAnalysis(upperSymbol);
        return NextResponse.json({
          success: true,
          data: {
            ...analysis,
            generatedAt: new Date().toISOString(),
          },
        });
      }
    }
  } catch (error) {
    console.error('Financial API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch financial data' },
      { status: 500 }
    );
  }
}
