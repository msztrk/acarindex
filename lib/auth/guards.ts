import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import {
  canAccessAdminPanel,
  canManageUsers,
  hasPermission,
  type AppRole,
} from '@/lib/auth/roles'
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
  if (!canAccessAdminPanel(session.user.roles)) {
    notFound()
  }
  return session
}

export async function requirePermission(permission: string): Promise<SessionPayload> {
  const session = await requireAdminSession()
  if (!hasPermission(session.user.roles, permission)) {
    notFound()
  }
  return session
}

export async function requireUserManagement(): Promise<SessionPayload> {
  const session = await requireAdminSession()
  if (!canManageUsers(session.user.roles)) {
    notFound()
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

  // Son SUPER_ADMIN koruması — rol kaldırma işlemlerinde kullanılır
  if (targetIsSuper && superAdminCount > 0 && actor.user.id === targetUserId) {
    throw new Error('Son SUPER_ADMIN hesabının rolü kaldırılamaz.')
  }
}
