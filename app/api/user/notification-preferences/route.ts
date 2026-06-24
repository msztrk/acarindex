import { NextResponse } from 'next/server'
import { getApiActiveUserSession } from '@/lib/auth/api-guards'
import { validateCsrf } from '@/lib/auth/session'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/lib/user-panel/notification-prefs'

function clientIp(request: Request): string | undefined {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
}

export async function GET() {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  const prefs = await getNotificationPreferences(sessionOrRes.user.id)
  return NextResponse.json(prefs)
}

export async function PATCH(request: Request) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }
  const body = (await request.json()) as Record<string, boolean | undefined>
  const prefs = await updateNotificationPreferences(sessionOrRes.user.id, body, clientIp(request))
  return NextResponse.json(prefs)
}
