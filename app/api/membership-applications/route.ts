import { NextResponse } from 'next/server'
import { getApiActiveUserSession } from '@/lib/auth/api-guards'
import { submitMembershipApplication } from '@/lib/membership-applications/service'
import type { MembershipApplicationType } from '@prisma/client'

export async function GET() {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes

  const { listMembershipApplicationsForUser } = await import(
    '@/lib/membership-applications/service'
  )
  const rows = await listMembershipApplicationsForUser(sessionOrRes.user.id)
  return NextResponse.json({ applications: rows })
}

export async function POST(request: Request) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes

  let body: {
    type?: MembershipApplicationType
    journalId?: string
    institutionId?: string
    payload?: Record<string, unknown>
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 })
  }

  const type = body.type
  if (type !== 'journal_editor' && type !== 'institution_manager') {
    return NextResponse.json({ error: 'Geçersiz başvuru türü.' }, { status: 400 })
  }

  let journalId: bigint | null = null
  let institutionId: bigint | null = null

  try {
    if (type === 'journal_editor') {
      if (!body.journalId) {
        return NextResponse.json({ error: 'journalId gerekli.' }, { status: 400 })
      }
      journalId = BigInt(body.journalId)
    } else {
      if (!body.institutionId) {
        return NextResponse.json({ error: 'institutionId gerekli.' }, { status: 400 })
      }
      institutionId = BigInt(body.institutionId)
    }
  } catch {
    return NextResponse.json({ error: 'Geçersiz ID.' }, { status: 400 })
  }

  try {
    const row = await submitMembershipApplication({
      userId: sessionOrRes.user.id,
      type,
      journalId,
      institutionId,
      payload: body.payload ?? null,
    })
    return NextResponse.json({ application: row })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Başvuru gönderilemedi.'
    return NextResponse.json({ error: message }, { status: 409 })
  }
}
