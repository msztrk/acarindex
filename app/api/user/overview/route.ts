import { NextResponse } from 'next/server'
import { getApiActiveUserSession } from '@/lib/auth/api-guards'
import { getUserPanelSummary } from '@/lib/user-panel/summary'
import { listRecentViews } from '@/lib/user-panel/recent-views'

export async function GET() {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  const summary = await getUserPanelSummary(sessionOrRes.user.id)
  const recent = await listRecentViews(sessionOrRes.user.id)
  return NextResponse.json({ summary, recentViews: recent.slice(0, 10) })
}
