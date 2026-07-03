import type {
  InstitutionMembershipRole,
  JournalMembershipRole,
  MembershipStatus,
} from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import {
  ADMIN_PERMISSIONS,
  LEGACY_DUAL_READ_ENABLED,
  LEGACY_MATRIX_TO_ADMIN_PERMISSION,
  type AdminPermissionName,
} from '@/lib/auth/admin-permissions'
import { ForbiddenError } from '@/lib/auth/forbidden'
import {
  ADMIN_PANEL_ROLES,
  hasAnyRole,
  hasPermission as legacyMatrixHasPermission,
  type AppRole,
} from '@/lib/auth/roles'
import { logAudit } from '@/lib/auth/audit'

export type { AdminPermissionName } from '@/lib/auth/admin-permissions'
export { ForbiddenError } from '@/lib/auth/forbidden'

export type JournalMembershipRecord = {
  id: string
  userId: string
  journalId: bigint
  role: JournalMembershipRole
  status: MembershipStatus
}

export type InstitutionMembershipRecord = {
  id: string
  userId: string
  institutionId: bigint
  role: InstitutionMembershipRole
  status: MembershipStatus
}

export type AccountBadge = {
  kind: 'global_role' | 'journal' | 'institution' | 'admin_permission'
  label: string
  journalId?: string
  institutionId?: string
}

const APPROVED: MembershipStatus = 'approved'

export function isApprovedMembershipStatus(status: MembershipStatus): boolean {
  return status === APPROVED
}

export function journalRoleSatisfies(
  actual: JournalMembershipRole,
  required?: JournalMembershipRole,
): boolean {
  if (!required) return true
  if (required === 'journal_editor') {
    return actual === 'journal_editor' || actual === 'journal_owner'
  }
  return actual === 'journal_owner'
}

export function institutionRoleSatisfies(
  actual: InstitutionMembershipRole,
  required?: InstitutionMembershipRole,
): boolean {
  if (!required) return true
  if (required === 'institution_viewer') {
    return actual === 'institution_viewer' || actual === 'institution_manager'
  }
  return actual === 'institution_manager'
}

export async function hasGlobalRole(userId: string, role: AppRole): Promise<boolean> {
  const row = await prisma.userRole.findUnique({
    where: { userId_roleId: { userId, roleId: role } },
  })
  return Boolean(row)
}

async function loadActiveAdminPermissions(userId: string): Promise<AdminPermissionName[]> {
  const rows = await prisma.adminPermission.findMany({
    where: { userId, revokedAt: null },
    select: { permission: true },
  })
  return rows
    .map((r) => r.permission)
    .filter((p): p is AdminPermissionName =>
      (ADMIN_PERMISSIONS as readonly string[]).includes(p),
    )
}

/**
 * TECH_DEBT (LEGACY_DUAL_READ): Falls back to global role PERMISSION_MATRIX when DB permission absent.
 */
function legacyRoleGrantsAdminPermission(roles: AppRole[], permission: AdminPermissionName): boolean {
  if (!LEGACY_DUAL_READ_ENABLED) return false

  for (const [matrixKey, mapped] of Object.entries(LEGACY_MATRIX_TO_ADMIN_PERMISSION)) {
    if (!mapped.includes(permission)) continue
    if (legacyMatrixHasPermission(roles, matrixKey)) return true
  }

  if (permission === 'legacy_admin_access' && hasAnyRole(roles, ADMIN_PANEL_ROLES)) {
    return true
  }

  return false
}

export async function hasAdminPermission(
  userId: string,
  permission: AdminPermissionName,
  roles?: AppRole[],
): Promise<boolean> {
  const active = await loadActiveAdminPermissions(userId)
  if (active.includes(permission)) return true

  if (!roles) {
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      select: { roleId: true },
    })
    roles = userRoles.map((r) => r.roleId).filter((r): r is AppRole =>
      (['USER', 'EDITOR', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'] as string[]).includes(r),
    )
  }

  return legacyRoleGrantsAdminPermission(roles, permission)
}

export async function requireAdminPermission(
  userId: string,
  permission: AdminPermissionName,
  roles?: AppRole[],
): Promise<void> {
  const allowed = await hasAdminPermission(userId, permission, roles)
  if (!allowed) throw new ForbiddenError()
}

export async function getJournalMembership(
  userId: string,
  journalId: bigint,
): Promise<JournalMembershipRecord | null> {
  const row = await prisma.journalMembership.findUnique({
    where: { userId_journalId: { userId, journalId } },
  })
  return row
}

export async function canEditJournal(userId: string, journalId: bigint): Promise<boolean> {
  const membership = await getJournalMembership(userId, journalId)
  if (!membership || !isApprovedMembershipStatus(membership.status)) return false
  return journalRoleSatisfies(membership.role, 'journal_editor')
}

export async function canManageJournalMembers(userId: string, journalId: bigint): Promise<boolean> {
  const membership = await getJournalMembership(userId, journalId)
  if (!membership || !isApprovedMembershipStatus(membership.status)) return false
  return membership.role === 'journal_owner'
}

export async function requireJournalAccess(
  userId: string,
  journalId: bigint,
  requiredRole?: JournalMembershipRole,
): Promise<JournalMembershipRecord> {
  const membership = await getJournalMembership(userId, journalId)
  if (!membership || !isApprovedMembershipStatus(membership.status)) {
    throw new ForbiddenError()
  }
  if (!journalRoleSatisfies(membership.role, requiredRole ?? 'journal_editor')) {
    throw new ForbiddenError()
  }
  return membership
}

export async function getInstitutionMembership(
  userId: string,
  institutionId: bigint,
): Promise<InstitutionMembershipRecord | null> {
  const row = await prisma.institutionMembership.findUnique({
    where: { userId_institutionId: { userId, institutionId } },
  })
  return row
}

export async function canManageInstitution(
  userId: string,
  institutionId: bigint,
): Promise<boolean> {
  const membership = await getInstitutionMembership(userId, institutionId)
  if (!membership || !isApprovedMembershipStatus(membership.status)) return false
  return membership.role === 'institution_manager'
}

export async function requireInstitutionAccess(
  userId: string,
  institutionId: bigint,
  requiredRole?: InstitutionMembershipRole,
): Promise<InstitutionMembershipRecord> {
  const membership = await getInstitutionMembership(userId, institutionId)
  if (!membership || !isApprovedMembershipStatus(membership.status)) {
    throw new ForbiddenError()
  }
  if (!institutionRoleSatisfies(membership.role, requiredRole ?? 'institution_viewer')) {
    throw new ForbiddenError()
  }
  return membership
}

/** UI badges only — never use for authorization decisions. */
export async function deriveAccountBadges(userId: string): Promise<AccountBadge[]> {
  const badges: AccountBadge[] = []

  const [roles, journalRows, institutionRows, adminPerms] = await Promise.all([
    prisma.userRole.findMany({ where: { userId }, include: { role: true } }),
    prisma.journalMembership.findMany({
      where: { userId, status: APPROVED },
      include: { journal: { select: { titleTr: true, slug: true } } },
    }),
    prisma.institutionMembership.findMany({
      where: { userId, status: APPROVED },
      include: { institution: { select: { nameTr: true, slug: true } } },
    }),
    loadActiveAdminPermissions(userId),
  ])

  for (const r of roles) {
    const label =
      r.roleId === 'USER'
        ? 'Normal Üye'
        : r.roleId === 'EDITOR'
          ? 'Editor (legacy)'
          : r.role.name
    badges.push({ kind: 'global_role', label })
  }

  for (const j of journalRows) {
    badges.push({
      kind: 'journal',
      label: `${j.role === 'journal_owner' ? 'Dergi Sahibi' : 'Dergi Editörü'}: ${j.journal.titleTr ?? j.journal.slug}`,
      journalId: j.journalId.toString(),
    })
  }

  for (const i of institutionRows) {
    badges.push({
      kind: 'institution',
      label: `${i.role === 'institution_manager' ? 'Kurum Yöneticisi' : 'Kurum Görüntüleyici'}: ${i.institution.nameTr}`,
      institutionId: i.institutionId.toString(),
    })
  }

  for (const p of adminPerms) {
    if (p === 'legacy_admin_access') continue
    badges.push({ kind: 'admin_permission', label: p })
  }

  return badges
}

export { logAudit } from '@/lib/auth/audit'
