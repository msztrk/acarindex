import { NextResponse } from 'next/server'
import { isUserAuthEnabled } from '@/lib/features/user-auth'
import { validateCsrf } from '@/lib/auth/session'
import { requestPasswordReset } from '@/lib/auth/reset-password'

export async function POST(request: Request) {
  if (!isUserAuthEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }

  const body = (await request.json()) as { email?: string }
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined
  const result = await requestPasswordReset(body.email ?? '', { ipAddress: ip })

  return NextResponse.json({ ok: result.ok, message: result.message })
}
