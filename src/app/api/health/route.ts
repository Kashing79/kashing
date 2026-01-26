import { NextResponse } from 'next/server';
import { performHealthCheck, generateHealthReport } from '@/lib/health-checker';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';

    const health = await performHealthCheck();

    if (format === 'text') {
      const report = generateHealthReport(health);
      return new NextResponse(report, {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // 根据健康状态设置HTTP状态码
    const statusCode = health.status === 'healthy' ? 200 :
                       health.status === 'degraded' ? 200 : 503;

    return NextResponse.json(health, { status: statusCode });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
