import { NextRequest } from 'next/server'
import { withAnalyticsAuth } from '../utils'
import { MarketingAnalyticsService } from '@/server/services/marketing-analytics-service'

export async function GET(req: NextRequest) {
  return withAnalyticsAuth(req, async ({ from, to }) => {
    const [sources, referrers] = await Promise.all([
      MarketingAnalyticsService.getTrafficSources({ from, to }),
      MarketingAnalyticsService.getReferrerBreakdown({ from, to }),
    ])
    return { sources, referrers }
  })
}
