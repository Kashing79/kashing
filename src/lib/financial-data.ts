/**
 * 金融数据API集成模块
 *
 * 支持的数据源:
 * - Alpha Vantage (免费, 需要API Key)
 * - Financial Modeling Prep (免费tier)
 * - Yahoo Finance (非官方)
 */

import {
  StockQuote,
  HistoricalPrice,
  CompanyFinancials,
  FinancialStatement,
  MarketIndex,
  EconomicIndicator,
} from '@/types/financial';

// API配置 - 用户需要在环境变量中设置自己的API Key
const API_KEYS = {
  ALPHA_VANTAGE: process.env.ALPHA_VANTAGE_API_KEY || 'demo',
  FMP: process.env.FMP_API_KEY || 'demo',
};

const API_ENDPOINTS = {
  ALPHA_VANTAGE: 'https://www.alphavantage.co/query',
  FMP: 'https://financialmodelingprep.com/api/v3',
  YAHOO: 'https://query1.finance.yahoo.com/v8/finance',
};

// 通用fetch封装
async function fetchJSON<T>(url: string, timeout = 10000): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================
// Alpha Vantage API - 股票历史数据
// 免费: 5次/分钟, 500次/天
// https://www.alphavantage.co/documentation/
// ============================================================

export async function getStockQuote(symbol: string): Promise<StockQuote | null> {
  try {
    const url = `${API_ENDPOINTS.ALPHA_VANTAGE}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEYS.ALPHA_VANTAGE}`;
    const data = await fetchJSON<any>(url);

    if (data['Global Quote']) {
      const q = data['Global Quote'];
      return {
        symbol: q['01. symbol'],
        price: parseFloat(q['05. price']),
        change: parseFloat(q['09. change']),
        changePercent: parseFloat(q['10. change percent']?.replace('%', '')),
        volume: parseInt(q['06. volume']),
        latestTradingDay: q['07. latest trading day'],
        previousClose: parseFloat(q['08. previous close']),
        open: parseFloat(q['02. open']),
        high: parseFloat(q['03. high']),
        low: parseFloat(q['04. low']),
      };
    }
    return null;
  } catch (error) {
    console.error(`Failed to fetch quote for ${symbol}:`, error);
    return null;
  }
}

export async function getHistoricalPrices(
  symbol: string,
  outputSize: 'compact' | 'full' = 'compact'
): Promise<HistoricalPrice[]> {
  try {
    const url = `${API_ENDPOINTS.ALPHA_VANTAGE}?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=${outputSize}&apikey=${API_KEYS.ALPHA_VANTAGE}`;
    const data = await fetchJSON<any>(url);

    const timeSeries = data['Time Series (Daily)'];
    if (!timeSeries) return [];

    return Object.entries(timeSeries).map(([date, values]: [string, any]) => ({
      date,
      open: parseFloat(values['1. open']),
      high: parseFloat(values['2. high']),
      low: parseFloat(values['3. low']),
      close: parseFloat(values['4. close']),
      volume: parseInt(values['5. volume']),
    }));
  } catch (error) {
    console.error(`Failed to fetch historical data for ${symbol}:`, error);
    return [];
  }
}

// 获取周线数据
export async function getWeeklyPrices(symbol: string): Promise<HistoricalPrice[]> {
  try {
    const url = `${API_ENDPOINTS.ALPHA_VANTAGE}?function=TIME_SERIES_WEEKLY&symbol=${symbol}&apikey=${API_KEYS.ALPHA_VANTAGE}`;
    const data = await fetchJSON<any>(url);

    const timeSeries = data['Weekly Time Series'];
    if (!timeSeries) return [];

    return Object.entries(timeSeries).map(([date, values]: [string, any]) => ({
      date,
      open: parseFloat(values['1. open']),
      high: parseFloat(values['2. high']),
      low: parseFloat(values['3. low']),
      close: parseFloat(values['4. close']),
      volume: parseInt(values['5. volume']),
    }));
  } catch (error) {
    console.error(`Failed to fetch weekly data for ${symbol}:`, error);
    return [];
  }
}

// ============================================================
// Financial Modeling Prep API - 公司财务数据
// 免费: 250次/天
// https://financialmodelingprep.com/developer/docs/
// ============================================================

export async function getCompanyProfile(symbol: string): Promise<CompanyFinancials | null> {
  try {
    const url = `${API_ENDPOINTS.FMP}/profile/${symbol}?apikey=${API_KEYS.FMP}`;
    const data = await fetchJSON<any[]>(url);

    if (data && data[0]) {
      const p = data[0];
      return {
        symbol: p.symbol,
        companyName: p.companyName,
        industry: p.industry,
        sector: p.sector,
        country: p.country,
        marketCap: p.mktCap,
        price: p.price,
        beta: p.beta,
        volAvg: p.volAvg,
        lastDiv: p.lastDiv,
        range: p.range,
        currency: p.currency,
        exchange: p.exchangeShortName,
        description: p.description,
        ceo: p.ceo,
        website: p.website,
        employees: p.fullTimeEmployees,
        ipoDate: p.ipoDate,
      };
    }
    return null;
  } catch (error) {
    console.error(`Failed to fetch company profile for ${symbol}:`, error);
    return null;
  }
}

export async function getIncomeStatement(
  symbol: string,
  period: 'annual' | 'quarter' = 'annual',
  limit = 5
): Promise<FinancialStatement[]> {
  try {
    const url = `${API_ENDPOINTS.FMP}/income-statement/${symbol}?period=${period}&limit=${limit}&apikey=${API_KEYS.FMP}`;
    const data = await fetchJSON<any[]>(url);

    if (!data) return [];

    return data.map(item => ({
      date: item.date,
      period: item.period,
      revenue: item.revenue,
      grossProfit: item.grossProfit,
      operatingIncome: item.operatingIncome,
      netIncome: item.netIncome,
      eps: item.eps,
      ebitda: item.ebitda,
      grossProfitRatio: item.grossProfitRatio,
      operatingIncomeRatio: item.operatingIncomeRatio,
      netIncomeRatio: item.netIncomeRatio,
    }));
  } catch (error) {
    console.error(`Failed to fetch income statement for ${symbol}:`, error);
    return [];
  }
}

export async function getBalanceSheet(
  symbol: string,
  period: 'annual' | 'quarter' = 'annual',
  limit = 5
): Promise<any[]> {
  try {
    const url = `${API_ENDPOINTS.FMP}/balance-sheet-statement/${symbol}?period=${period}&limit=${limit}&apikey=${API_KEYS.FMP}`;
    const data = await fetchJSON<any[]>(url);
    return data || [];
  } catch (error) {
    console.error(`Failed to fetch balance sheet for ${symbol}:`, error);
    return [];
  }
}

export async function getCashFlowStatement(
  symbol: string,
  period: 'annual' | 'quarter' = 'annual',
  limit = 5
): Promise<any[]> {
  try {
    const url = `${API_ENDPOINTS.FMP}/cash-flow-statement/${symbol}?period=${period}&limit=${limit}&apikey=${API_KEYS.FMP}`;
    const data = await fetchJSON<any[]>(url);
    return data || [];
  } catch (error) {
    console.error(`Failed to fetch cash flow for ${symbol}:`, error);
    return [];
  }
}

export async function getFinancialRatios(symbol: string): Promise<any | null> {
  try {
    const url = `${API_ENDPOINTS.FMP}/ratios/${symbol}?apikey=${API_KEYS.FMP}`;
    const data = await fetchJSON<any[]>(url);
    return data && data[0] ? data[0] : null;
  } catch (error) {
    console.error(`Failed to fetch ratios for ${symbol}:`, error);
    return null;
  }
}

export async function getKeyMetrics(symbol: string): Promise<any | null> {
  try {
    const url = `${API_ENDPOINTS.FMP}/key-metrics/${symbol}?apikey=${API_KEYS.FMP}`;
    const data = await fetchJSON<any[]>(url);
    return data && data[0] ? data[0] : null;
  } catch (error) {
    console.error(`Failed to fetch key metrics for ${symbol}:`, error);
    return null;
  }
}

// ============================================================
// 市场指数和经济指标
// ============================================================

export async function getMarketIndices(): Promise<MarketIndex[]> {
  const indices = [
    { symbol: '^GSPC', name: 'S&P 500' },
    { symbol: '^DJI', name: 'Dow Jones' },
    { symbol: '^IXIC', name: 'NASDAQ' },
    { symbol: '^FTSE', name: 'FTSE 100' },
    { symbol: '^N225', name: 'Nikkei 225' },
    { symbol: '^HSI', name: 'Hang Seng' },
  ];

  const results: MarketIndex[] = [];

  for (const index of indices) {
    const quote = await getStockQuote(index.symbol);
    if (quote) {
      results.push({
        symbol: index.symbol,
        name: index.name,
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
      });
    }
  }

  return results;
}

// 经济指标 (Alpha Vantage)
export async function getEconomicIndicator(
  indicator: 'REAL_GDP' | 'CPI' | 'INFLATION' | 'UNEMPLOYMENT' | 'INTEREST_RATE'
): Promise<EconomicIndicator[]> {
  try {
    const url = `${API_ENDPOINTS.ALPHA_VANTAGE}?function=${indicator}&apikey=${API_KEYS.ALPHA_VANTAGE}`;
    const data = await fetchJSON<any>(url);

    if (data && data.data) {
      return data.data.slice(0, 20).map((item: any) => ({
        date: item.date,
        value: parseFloat(item.value),
        indicator,
      }));
    }
    return [];
  } catch (error) {
    console.error(`Failed to fetch economic indicator ${indicator}:`, error);
    return [];
  }
}

// ============================================================
// 综合分析函数
// ============================================================

export async function getComprehensiveAnalysis(symbol: string): Promise<{
  quote: StockQuote | null;
  profile: CompanyFinancials | null;
  historicalPrices: HistoricalPrice[];
  incomeStatement: FinancialStatement[];
  ratios: any;
  metrics: any;
}> {
  const [quote, profile, historicalPrices, incomeStatement, ratios, metrics] = await Promise.all([
    getStockQuote(symbol),
    getCompanyProfile(symbol),
    getHistoricalPrices(symbol, 'compact'),
    getIncomeStatement(symbol, 'annual', 5),
    getFinancialRatios(symbol),
    getKeyMetrics(symbol),
  ]);

  return {
    quote,
    profile,
    historicalPrices,
    incomeStatement,
    ratios,
    metrics,
  };
}

// 搜索股票
export async function searchStocks(query: string): Promise<Array<{ symbol: string; name: string; type: string; region: string }>> {
  try {
    const url = `${API_ENDPOINTS.ALPHA_VANTAGE}?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${API_KEYS.ALPHA_VANTAGE}`;
    const data = await fetchJSON<any>(url);

    if (data && data.bestMatches) {
      return data.bestMatches.map((match: any) => ({
        symbol: match['1. symbol'],
        name: match['2. name'],
        type: match['3. type'],
        region: match['4. region'],
      }));
    }
    return [];
  } catch (error) {
    console.error('Stock search failed:', error);
    return [];
  }
}
