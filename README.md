# Kashing - Global News Aggregator

A real-time global news aggregation platform that collects and displays news from around the world, with a focus on **Politics**, **Finance**, **Economy**, and **Society**.

全球新闻数据聚合平台，实时抓取和展示来自世界各地的重要新闻，重点关注**政治**、**金融**、**经济**和**社会**领域。

## Features 功能特点

- **Real-time News Aggregation** 实时新闻聚合
  - Collects news from multiple authoritative sources worldwide
  - 从全球多个权威新闻源收集新闻

- **Category Classification** 分类筛选
  - 🔴 Politics 政治
  - 🟢 Finance 金融
  - 🔵 Economy 经济
  - 🟣 Society 社会

- **Self-Health Check** 自检查功能
  - Monitor news source availability
  - Check data freshness
  - System health monitoring

- **Search & Filter** 搜索过滤
  - Full-text search across all news
  - Filter by category and region

## Tech Stack 技术栈

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Data Fetching**: RSS parsing, scheduled tasks

## Quick Start 快速开始

### Prerequisites 前置条件

- Node.js 18+
- npm or yarn

### Installation 安装

```bash
# Clone the repository
git clone <repository-url>
cd kashing

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Available Scripts 可用命令

```bash
# Development
npm run dev          # Start development server

# Production
npm run build        # Build for production
npm run start        # Start production server

# Utilities
npm run health-check # Run health check script
npm run fetch-news   # Manually fetch news
npm run lint         # Run ESLint
```

## API Endpoints API接口

### GET /api/news
Fetch news articles.

Query parameters:
- `category`: Filter by category (politics, finance, economy, society, all)
- `q`: Search query
- `limit`: Number of items (default: 50)
- `offset`: Pagination offset

### GET /api/health
Get system health status.

Query parameters:
- `format`: Response format (json, text)

### GET /api/sources
List all configured news sources.

## News Sources 新闻源

The platform aggregates news from major global sources including:
- BBC World News
- Reuters
- The Guardian
- New York Times
- Financial Times
- Al Jazeera
- CNBC
- NPR
- And more...

## Project Structure 项目结构

```
kashing/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API routes
│   │   │   ├── news/       # News API
│   │   │   ├── health/     # Health check API
│   │   │   └── sources/    # Sources API
│   │   ├── page.tsx        # Main page
│   │   └── layout.tsx      # Root layout
│   ├── components/         # React components
│   │   ├── Header.tsx
│   │   ├── CategoryTabs.tsx
│   │   ├── NewsCard.tsx
│   │   ├── NewsList.tsx
│   │   └── HealthStatus.tsx
│   ├── lib/                # Utilities
│   │   ├── news-sources.ts # Source configuration
│   │   ├── news-fetcher.ts # RSS fetching logic
│   │   └── health-checker.ts
│   └── types/              # TypeScript types
│       └── news.ts
├── scripts/                # CLI scripts
│   ├── health-check.js
│   └── fetch-news.js
├── data/                   # Local data storage
└── public/                 # Static assets
```

## Configuration 配置

News sources can be configured in `src/lib/news-sources.ts`. Each source includes:
- RSS feed URL
- Category classification
- Region/language information
- Enable/disable flag

## Health Monitoring 健康监控

The platform includes comprehensive health monitoring:

1. **Source Health**: Check if each news source is accessible
2. **Data Freshness**: Monitor how recent the collected news is
3. **System Health**: Memory usage and uptime tracking

Access the health check panel via the "Health Check" button in the UI, or run:
```bash
npm run health-check
```

## License

MIT License
