import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth/session'
import { isAdminPanelEnabled, isUserAuthEnabled } from '@/lib/features/user-auth'
import { canAccessAdminPanel, canManageUsers } from '@/lib/auth/roles'
import type { SessionPayload } from '@/lib/auth/session'

export async function getApiSession(): Promise<SessionPayload | NextResponse> {
  if (!isUserAuthEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return session
}

export async function getApiAdminSession(): Promise<SessionPayload | NextResponse> {
  const sessionOrRes = await getApiSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (!isAdminPanelEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!canAccessAdminPanel(sessionOrRes.user.roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return sessionOrRes
}

export async function getApiUserManagementSession(): Promise<SessionPayload | NextResponse> {
  const sessionOrRes = await getApiAdminSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (!canManageUsers(sessionOrRes.user.roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return sessionOrRes
}

/** Aktif oturum — pasif hesaplar reddedilir */
export async function getApiActiveUserSession(): Promise<SessionPayload | NextResponse> {
  const sessionOrRes = await getApiSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (sessionOrRes.user.status !== 'active') {
    return NextResponse.json({ error: 'Hesap pasif.' }, { status: 403 })
  }
  return sessionOrRes
}
