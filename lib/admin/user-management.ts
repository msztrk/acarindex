import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/auth/audit'
import { canAssignSuperAdmin, canManageRole } from '@/lib/auth/roles'
import type { AppRole } from '@/lib/auth/roles'
import { isAppRole, SUPER_ADMIN_ROLE } from '@/lib/auth/roles'
import { countSuperAdmins } from '@/lib/auth/user'

export async function assignRoleToUser(input: {
  actorId: string
  actorRoles: AppRole[]
  targetUserId: string
  roleId: AppRole
  ipAddress?: string
}): Promise<{ ok: boolean; error?: string }> {
  if (!isAppRole(input.roleId)) return { ok: false, error: 'Geçersiz rol.' }

  const target = await prisma.user.findUnique({
    where: { id: input.targetUserId },
    include: { roles: true },
  })
  if (!target) return { ok: false, error: 'Kullanıcı bulunamadı.' }

  if (input.roleId === SUPER_ADMIN_ROLE && !canAssignSuperAdmin(input.actorRoles)) {
    return { ok: false, error: 'SUPER_ADMIN yalnızca SUPER_ADMIN atayabilir.' }
  }

  if (!canManageRole(input.actorRoles, input.roleId)) {
    return { ok: false, error: 'Bu rolü atama yetkiniz yok.' }
  }

  const exists = target.roles.some((r) => r.roleId === input.roleId)
  if (exists) return { ok: true }

  await prisma.userRole.create({
    data: {
      userId: input.targetUserId,
      roleId: input.roleId,
      grantedBy: input.actorId,
    },
  })

  await writeAuditLog({
    actorId: input.actorId,
    action: 'user.role.assign',
    resource: 'user',
    resourceId: input.targetUserId,
    metadata: { roleId: input.roleId },
    ipAddress: input.ipAddress,
  })

  return { ok: true }
}

export async function removeRoleFromUser(input: {
  actorId: string
  actorRoles: AppRole[]
  targetUserId: string
  roleId: AppRole
  ipAddress?: string
}): Promise<{ ok: boolean; error?: string }> {
  if (!isAppRole(input.roleId)) return { ok: false, error: 'Geçersiz rol.' }

  if (input.roleId === SUPER_ADMIN_ROLE && !canAssignSuperAdmin(input.actorRoles)) {
    return { ok: false, error: 'SUPER_ADMIN rolü yalnızca SUPER_ADMIN kaldırabilir.' }
  }

  if (!canManageRole(input.actorRoles, input.roleId)) {
    return { ok: false, error: 'Bu rolü kaldırma yetkiniz yok.' }
  }

  if (input.roleId === SUPER_ADMIN_ROLE && input.actorId === input.targetUserId) {
    return { ok: false, error: 'Kendi SUPER_ADMIN rolünüzü kaldıramazsınız.' }
  }

  if (input.roleId === SUPER_ADMIN_ROLE) {
    const superCount = await countSuperAdmins()
    const targetIsSuper = await prisma.userRole.findUnique({
      where: {
        userId_roleId: { userId: input.targetUserId, roleId: SUPER_ADMIN_ROLE },
      },
    })
    if (targetIsSuper && superCount <= 1) {
      return { ok: false, error: 'Son SUPER_ADMIN rolü kaldırılamaz.' }
    }
  }

  await prisma.userRole.delete({
    where: {
      userId_roleId: { userId: input.targetUserId, roleId: input.roleId },
    },
  }).catch(() => undefined)

  await writeAuditLog({
    actorId: input.actorId,
    action: 'user.role.remove',
    resource: 'user',
    resourceId: input.targetUserId,
    metadata: { roleId: input.roleId },
    ipAddress: input.ipAddress,
  })

  return { ok: true }
}

export async function setUserStatus(input: {
  actorId: string
  targetUserId: string
  status: 'active' | 'disabled'
  ipAddress?: string
}): Promise<{ ok: boolean; error?: string }> {
  if (input.actorId === input.targetUserId && input.status === 'disabled') {
    return { ok: false, error: 'Kendi hesabınızı pasif yapamazsınız.' }
  }

  await prisma.user.update({
    where: { id: input.targetUserId },
    data: { status: input.status },
  })

  await writeAuditLog({
    actorId: input.actorId,
    action: 'user.status.change',
    resource: 'user',
    resourceId: input.targetUserId,
    metadata: { status: input.status },
    ipAddress: input.ipAddress,
  })

  return { ok: true }
}
