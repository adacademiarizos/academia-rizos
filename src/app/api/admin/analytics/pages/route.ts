import { NextRequest } from 'next/server'
import { withAnalyticsAuth } from '../utils'
import { MarketingAnalyticsService } from '@/server/services/marketing-analytics-service'

export async function GET(req: NextRequest) {
  return withAnalyticsAuth(req, ({ from, to, url }) => {
    const limit = parseInt(url.searchParams.get('limit') || '20', 10)
    return MarketingAnalyticsService.getTopPages({ from, to }, Math.min(limit, 100))
  })
}
