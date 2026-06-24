import { NextResponse } from 'next/server'
import { createCsrfToken, buildCsrfCookie } from '@/lib/auth/session'
import { isUserAuthEnabled } from '@/lib/features/user-auth'

export async function GET() {
  if (!isUserAuthEnabled()) {
    return NextResponse.json({ error: 'Auth disabled' }, { status: 404 })
  }
  const token = createCsrfToken()
  const response = NextResponse.json({ csrfToken: token })
  const cookie = buildCsrfCookie(token)
  response.cookies.set(cookie.name, cookie.value, cookie.options)
  return response
}
