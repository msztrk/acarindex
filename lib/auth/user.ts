import { prisma } from '@/lib/db/prisma'
import type { AppRole } from '@/lib/auth/roles'
import { isAppRole } from '@/lib/auth/roles'

export interface AuthUser {
  id: string
  email: string
  name: string | null
  status: string
  emailVerified: Date | null
  roles: AppRole[]
}

export async function loadAuthUserById(userId: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: true } } },
  })
  if (!user) return null
  const roles = user.roles
    .map((r) => r.roleId)
    .filter(isAppRole)
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    emailVerified: user.emailVerified,
    roles,
  }
}

export async function loadAuthUserByEmail(email: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { roles: { include: { role: true } } },
  })
  if (!user) return null
  const roles = user.roles.map((r) => r.roleId).filter(isAppRole)
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    emailVerified: user.emailVerified,
    roles,
  }
}

export async function countSuperAdmins(): Promise<number> {
  return prisma.userRole.count({
    where: { roleId: 'SUPER_ADMIN', user: { status: 'active' } },
  })
}

export async function userHasRole(userId: string, roleId: AppRole): Promise<boolean> {
  const row = await prisma.userRole.findUnique({
    where: { userId_roleId: { userId, roleId } },
  })
  return Boolean(row)
}
