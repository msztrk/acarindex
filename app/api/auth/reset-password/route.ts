import { NextResponse } from 'next/server'
import { isUserAuthEnabled } from '@/lib/features/user-auth'
import { validateCsrf } from '@/lib/auth/session'
import { resetPasswordWithToken } from '@/lib/auth/reset-password'

export async function POST(request: Request) {
  if (!isUserAuthEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }

  const body = (await request.json()) as { token?: string; password?: string }
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined
  const result = await resetPasswordWithToken(body.token ?? '', body.password ?? '', {
    ipAddress: ip,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
