import { NextResponse } from 'next/server'
import { getApiActiveUserSession } from '@/lib/auth/api-guards'
import { listApprovedJournalMemberships } from '@/lib/auth/authorization'

export async function GET() {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes

  const rows = await listApprovedJournalMemberships(sessionOrRes.user.id)
  return NextResponse.json({
    journals: rows.map((m) => ({
      membershipId: m.id,
      journalId: m.journalId.toString(),
      role: m.role,
      title: m.journal.titleTr ?? m.journal.slug,
      slug: m.journal.slug,
      hitCount: m.journal.hitCount,
    })),
  })
}
