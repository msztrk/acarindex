import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth/session'
import { isAdminPanelEnabled, isUserAuthEnabled } from '@/lib/features/user-auth'
import { canAccessAdminPanel, canManageUsers } from '@/lib/auth/roles'
import { hasAdminPermission } from '@/lib/auth/authorization'
import type { AdminPermissionName } from '@/lib/auth/admin-permissions'
import { LEGACY_MATRIX_TO_ADMIN_PERMISSION } from '@/lib/auth/admin-permissions'
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
  const hasLegacy = canAccessAdminPanel(sessionOrRes.user.roles)
  const hasDb =
    (await hasAdminPermission(sessionOrRes.user.id, 'legacy_admin_access', sessionOrRes.user.roles)) ||
    (await hasAdminPermission(sessionOrRes.user.id, 'manage_journals', sessionOrRes.user.roles))
  if (!hasLegacy && !hasDb) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return sessionOrRes
}

export async function getApiAdminPermissionSession(
  permission: AdminPermissionName,
): Promise<SessionPayload | NextResponse> {
  const sessionOrRes = await getApiAdminSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (!(await hasAdminPermission(sessionOrRes.user.id, permission, sessionOrRes.user.roles))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return sessionOrRes
}

export async function getApiLegacyPermissionSession(
  matrixKey: string,
): Promise<SessionPayload | NextResponse> {
  const sessionOrRes = await getApiAdminSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  const mapped = LEGACY_MATRIX_TO_ADMIN_PERMISSION[matrixKey] ?? []
  for (const perm of mapped) {
    if (await hasAdminPermission(sessionOrRes.user.id, perm, sessionOrRes.user.roles)) {
      return sessionOrRes
    }
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export async function getApiUserManagementSession(): Promise<SessionPayload | NextResponse> {
  const sessionOrRes = await getApiAdminSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  const allowed =
    canManageUsers(sessionOrRes.user.roles) ||
    (await hasAdminPermission(sessionOrRes.user.id, 'manage_users', sessionOrRes.user.roles))
  if (!allowed) {
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
