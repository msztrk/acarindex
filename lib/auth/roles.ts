/**
 * Uygulama rolleri — bibliyografik `authors` tablosundan ayrı.
 */
export const APP_ROLES = [
  'USER',
  'EDITOR',
  'MODERATOR',
  'ADMIN',
  'SUPER_ADMIN',
] as const

export type AppRole = (typeof APP_ROLES)[number]

export const ADMIN_PANEL_ROLES: AppRole[] = [
  'EDITOR',
  'MODERATOR',
  'ADMIN',
  'SUPER_ADMIN',
]

export const USER_MANAGEMENT_ROLES: AppRole[] = ['ADMIN', 'SUPER_ADMIN']

export const SUPER_ADMIN_ROLE: AppRole = 'SUPER_ADMIN'

export function isAppRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value)
}

export function roleRank(role: AppRole): number {
  const order: Record<AppRole, number> = {
    USER: 0,
    EDITOR: 1,
    MODERATOR: 2,
    ADMIN: 3,
    SUPER_ADMIN: 4,
  }
  return order[role]
}

export function hasAnyRole(userRoles: AppRole[], required: AppRole[]): boolean {
  return required.some((r) => userRoles.includes(r))
}

export function canAccessAdminPanel(userRoles: AppRole[]): boolean {
  return hasAnyRole(userRoles, ADMIN_PANEL_ROLES)
}

export function canManageUsers(userRoles: AppRole[]): boolean {
  return hasAnyRole(userRoles, USER_MANAGEMENT_ROLES)
}

export function canAssignSuperAdmin(actorRoles: AppRole[]): boolean {
  return actorRoles.includes(SUPER_ADMIN_ROLE)
}

/**
 * Yetki matrisi — server-side kontrol için referans.
 * client-side gizleme yetkilendirme değildir.
 */
export const PERMISSION_MATRIX: Record<string, AppRole[]> = {
  'admin.panel.access': ADMIN_PANEL_ROLES,
  'catalog.journals.read': ADMIN_PANEL_ROLES,
  'catalog.issues.read': ADMIN_PANEL_ROLES,
  'catalog.articles.read': ADMIN_PANEL_ROLES,
  'catalog.authors.read': ADMIN_PANEL_ROLES,
  'catalog.pdfs.read': ADMIN_PANEL_ROLES,
  'data_quality.read': ['MODERATOR', 'ADMIN', 'SUPER_ADMIN'],
  'etl.read': ['MODERATOR', 'ADMIN', 'SUPER_ADMIN'],
  'url_aliases.read': ADMIN_PANEL_ROLES,
  'users.read': USER_MANAGEMENT_ROLES,
  'users.manage_roles': USER_MANAGEMENT_ROLES,
  'users.disable': USER_MANAGEMENT_ROLES,
  'users.assign_super_admin': [SUPER_ADMIN_ROLE],
  'audit.read': USER_MANAGEMENT_ROLES,
  'system.health': ADMIN_PANEL_ROLES,
}

export function hasPermission(userRoles: AppRole[], permission: string): boolean {
  const allowed = PERMISSION_MATRIX[permission]
  if (!allowed) return false
  return hasAnyRole(userRoles, allowed)
}
