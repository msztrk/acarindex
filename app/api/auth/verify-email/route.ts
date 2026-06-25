import { NextResponse } from 'next/server'
import { isUserAuthEnabled } from '@/lib/features/user-auth'
import { verifyEmailToken } from '@/lib/auth/verify-email'

/** Tek kullanımlık token doğrulama — CSRF gerekmez (token yetkilendirmesi). */
export async function POST(request: Request) {
  if (!isUserAuthEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = (await request.json()) as { token?: string }
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined
  const result = await verifyEmailToken(body.token ?? '', { ipAddress: ip })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
