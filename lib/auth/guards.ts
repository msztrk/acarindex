import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import {
  canAccessAdminPanel,
  canManageUsers,
  type AppRole,
} from '@/lib/auth/roles'
import {
  hasAdminPermission,
  type AdminPermissionName,
} from '@/lib/auth/authorization'
import { LEGACY_MATRIX_TO_ADMIN_PERMISSION } from '@/lib/auth/admin-permissions'
import { getServerSession, type SessionPayload } from '@/lib/auth/session'
import { isAdminPanelEnabled, isUserAuthEnabled } from '@/lib/features/user-auth'

export async function requireUserAuth(): Promise<SessionPayload> {
  if (!isUserAuthEnabled()) {
    notFound()
  }
  const session = await getServerSession()
  if (!session) {
    redirect('/login')
  }
  return session
}

export async function requireAdminSession(): Promise<SessionPayload> {
  if (!isAdminPanelEnabled()) {
    notFound()
  }
  const session = await requireUserAuth()
  const hasLegacy = canAccessAdminPanel(session.user.roles)
  const hasDb =
    (await hasAdminPermission(session.user.id, 'legacy_admin_access', session.user.roles)) ||
    (await hasAdminPermission(session.user.id, 'manage_journals', session.user.roles))
  if (!hasLegacy && !hasDb) {
    redirect('/forbidden')
  }
  return session
}

export async function requirePermission(permission: string): Promise<SessionPayload> {
  const session = await requireAdminSession()
  const mapped = LEGACY_MATRIX_TO_ADMIN_PERMISSION[permission]
  if (mapped?.length) {
    for (const adminPerm of mapped) {
      if (await hasAdminPermission(session.user.id, adminPerm, session.user.roles)) {
        return session
      }
    }
  }
  redirect('/forbidden')
}

export async function requireAdminPermissionGuard(
  permission: AdminPermissionName,
): Promise<SessionPayload> {
  const session = await requireAdminSession()
  if (!(await hasAdminPermission(session.user.id, permission, session.user.roles))) {
    redirect('/forbidden')
  }
  return session
}

export async function requireUserManagement(): Promise<SessionPayload> {
  const session = await requireAdminSession()
  const allowed =
    canManageUsers(session.user.roles) ||
    (await hasAdminPermission(session.user.id, 'manage_users', session.user.roles))
  if (!allowed) {
    redirect('/forbidden')
  }
  return session
}

export function assertSuperAdminProtection(
  targetUserId: string,
  targetRoles: AppRole[],
  actor: SessionPayload,
): void {
  const targetIsSuper = targetRoles.includes('SUPER_ADMIN')
  const actorIsSuper = actor.user.roles.includes('SUPER_ADMIN')
  const superAdminCount = targetRoles.filter((r) => r === 'SUPER_ADMIN').length

  if (targetIsSuper && !actorIsSuper) {
    throw new Error('SUPER_ADMIN rolü yalnızca SUPER_ADMIN tarafından yönetilebilir.')
  }

  if (targetIsSuper && superAdminCount > 0 && actor.user.id === targetUserId) {
    throw new Error('Son SUPER_ADMIN hesabının rolü kaldırılamaz.')
  }
}
