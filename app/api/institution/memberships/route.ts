import { NextResponse } from 'next/server'
import { getApiActiveUserSession } from '@/lib/auth/api-guards'
import { listApprovedInstitutionMemberships } from '@/lib/auth/authorization'

export async function GET() {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes

  const rows = await listApprovedInstitutionMemberships(sessionOrRes.user.id)
  return NextResponse.json({
    institutions: rows.map((m) => ({
      membershipId: m.id,
      institutionId: m.institutionId.toString(),
      role: m.role,
      name: m.institution.nameTr,
      slug: m.institution.slug,
    })),
  })
}
