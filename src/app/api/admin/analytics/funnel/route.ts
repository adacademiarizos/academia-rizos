import { NextRequest } from 'next/server'
import { withAnalyticsAuth } from '../utils'
import { MarketingAnalyticsService } from '@/server/services/marketing-analytics-service'

export async function GET(req: NextRequest) {
  return withAnalyticsAuth(req, ({ from, to }) =>
    MarketingAnalyticsService.getConversionFunnel({ from, to })
  )
}
