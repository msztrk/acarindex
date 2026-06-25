import { NextResponse } from 'next/server'
import { isUserAuthEnabled } from '@/lib/features/user-auth'
import { getApiActiveUserSession } from '@/lib/auth/api-guards'
import { validateCsrf } from '@/lib/auth/session'
import {
  cancelAccountDeletion,
  deactivateOwnAccount,
  getDeletionRequestStatus,
  requestAccountDeletion,
} from '@/lib/auth/account-lifecycle'

export async function GET() {
  if (!isUserAuthEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes

  const deletion = await getDeletionRequestStatus(sessionOrRes.user.id)
  return NextResponse.json({ deletion })
}

export async function POST(request: Request) {
  if (!isUserAuthEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes

  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }

  const body = (await request.json()) as {
    action?: 'deactivate' | 'request_deletion' | 'cancel_deletion'
    password?: string
  }
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined

  if (!body.password && body.action !== 'cancel_deletion') {
    return NextResponse.json({ error: 'Parola gerekli.' }, { status: 400 })
  }

  if (body.action === 'deactivate') {
    const r = await deactivateOwnAccount(sessionOrRes.user.id, body.password ?? '', {
      ipAddress: ip,
    })
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
    const response = NextResponse.json({ ok: true })
    response.cookies.delete('acarindex_session')
    response.cookies.delete('acarindex_csrf')
    return response
  }

  if (body.action === 'request_deletion') {
    const r = await requestAccountDeletion(sessionOrRes.user.id, body.password ?? '', {
      ipAddress: ip,
    })
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
    const response = NextResponse.json({ ok: true, scheduledFor: r.scheduledFor })
    response.cookies.delete('acarindex_session')
    response.cookies.delete('acarindex_csrf')
    return response
  }

  if (body.action === 'cancel_deletion') {
    const r = await cancelAccountDeletion(sessionOrRes.user.id, { ipAddress: ip })
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Geçersiz işlem.' }, { status: 400 })
}
