// 股票实时报价
export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  latestTradingDay: string;
  previousClose: number;
  open: number;
  high: number;
  low: number;
}

// 历史价格数据
export interface HistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// 公司基本信息
export interface CompanyFinancials {
  symbol: string;
  companyName: string;
  industry: string;
  sector: string;
  country: string;
  marketCap: number;
  price: number;
  beta: number;
  volAvg: number;
  lastDiv: number;
  range: string;
  currency: string;
  exchange: string;
  description: string;
  ceo: string;
  website: string;
  employees: number;
  ipoDate: string;
}

// 财务报表
export interface FinancialStatement {
  date: string;
  period: string;
  revenue: number;
  grossProfit: number;
  operatingIncome: number;
  netIncome: number;
  eps: number;
  ebitda: number;
  grossProfitRatio: number;
  operatingIncomeRatio: number;
  netIncomeRatio: number;
}

// 资产负债表
export interface BalanceSheet {
  date: string;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  cashAndCashEquivalents: number;
  shortTermDebt: number;
  longTermDebt: number;
  totalDebt: number;
  inventory: number;
  accountsReceivable: number;
  accountsPayable: number;
}

// 现金流量表
export interface CashFlowStatement {
  date: string;
  operatingCashFlow: number;
  investingCashFlow: number;
  financingCashFlow: number;
  freeCashFlow: number;
  capitalExpenditure: number;
  dividendsPaid: number;
}

// 财务比率
export interface FinancialRatios {
  date: string;
  // 盈利能力
  grossProfitMargin: number;
  operatingProfitMargin: number;
  netProfitMargin: number;
  returnOnAssets: number;
  returnOnEquity: number;
  // 估值
  peRatio: number;
  pbRatio: number;
  psRatio: number;
  evToEbitda: number;
  // 财务健康
  currentRatio: number;
  quickRatio: number;
  debtToEquity: number;
  debtToAssets: number;
  interestCoverage: number;
  // 效率
  assetTurnover: number;
  inventoryTurnover: number;
  receivablesTurnover: number;
}

// 市场指数
export interface MarketIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

// 经济指标
export interface EconomicIndicator {
  date: string;
  value: number;
  indicator: string;
}

// 股票搜索结果
export interface StockSearchResult {
  symbol: string;
  name: string;
  type: string;
  region: string;
  currency?: string;
}

// 综合分析结果
export interface ComprehensiveAnalysis {
  quote: StockQuote | null;
  profile: CompanyFinancials | null;
  historicalPrices: HistoricalPrice[];
  incomeStatement: FinancialStatement[];
  ratios: FinancialRatios | null;
  metrics: any;
  generatedAt: string;
}

// 投资组合
export interface Portfolio {
  id: string;
  name: string;
  holdings: PortfolioHolding[];
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioHolding {
  symbol: string;
  shares: number;
  averageCost: number;
  currentPrice?: number;
  marketValue?: number;
  gain?: number;
  gainPercent?: number;
}

// 观察列表
export interface Watchlist {
  id: string;
  name: string;
  symbols: string[];
  createdAt: string;
}
