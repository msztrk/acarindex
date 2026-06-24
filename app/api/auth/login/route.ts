import { NextResponse } from 'next/server'
import { isUserAuthEnabled } from '@/lib/features/user-auth'
import { loginWithPassword } from '@/lib/auth/login'
import { validateCsrf } from '@/lib/auth/session'

export async function POST(request: Request) {
  if (!isUserAuthEnabled()) {
    return NextResponse.json({ error: 'Auth disabled' }, { status: 404 })
  }

  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF doğrulaması başarısız' }, { status: 403 })
  }

  const body = (await request.json()) as { email?: string; password?: string }
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined
  const userAgent = request.headers.get('user-agent') ?? undefined

  const result = await loginWithPassword(body.email ?? '', body.password ?? '', {
    ipAddress: ip,
    userAgent,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  for (const cookie of result.cookies ?? []) {
    response.cookies.set(cookie.name, cookie.value, cookie.options as never)
  }
  return response
}
