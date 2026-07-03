/**
 * DB-driven admin permission names.
 * Stored as strings in admin_permissions.permission; constrained here in TypeScript.
 */
export const ADMIN_PERMISSIONS = [
  'manage_users',
  'manage_roles',
  'manage_journals',
  'manage_institutions',
  'manage_articles',
  'manage_pdfs',
  'review_change_requests',
  'view_audit_logs',
  'manage_system_settings',
  'legacy_admin_access',
] as const

export type AdminPermissionName = (typeof ADMIN_PERMISSIONS)[number]

export function isAdminPermissionName(value: string): value is AdminPermissionName {
  return (ADMIN_PERMISSIONS as readonly string[]).includes(value)
}

/** Permissions granted to each global role during migration backfill. */
export const ROLE_ADMIN_PERMISSION_BACKFILL: Record<string, AdminPermissionName[]> = {
  SUPER_ADMIN: [...ADMIN_PERMISSIONS],
  ADMIN: [
    'manage_users',
    'manage_roles',
    'manage_journals',
    'manage_institutions',
    'manage_articles',
    'manage_pdfs',
    'review_change_requests',
    'view_audit_logs',
  ],
  MODERATOR: [
    'manage_journals',
    'manage_articles',
    'manage_pdfs',
    'review_change_requests',
    'view_audit_logs',
  ],
  EDITOR: ['legacy_admin_access'],
}

/**
 * Maps legacy PERMISSION_MATRIX keys to new admin_permissions names.
 * Used during dual-read transition.
 */
export const LEGACY_MATRIX_TO_ADMIN_PERMISSION: Record<string, AdminPermissionName[]> = {
  'admin.panel.access': ['legacy_admin_access'],
  'catalog.journals.read': ['manage_journals', 'legacy_admin_access'],
  'catalog.issues.read': ['manage_journals', 'legacy_admin_access'],
  'catalog.articles.read': ['manage_articles', 'legacy_admin_access'],
  'catalog.authors.read': ['manage_articles', 'legacy_admin_access'],
  'catalog.pdfs.read': ['manage_pdfs', 'legacy_admin_access'],
  'data_quality.read': ['review_change_requests', 'view_audit_logs'],
  'etl.read': ['manage_system_settings'],
  'url_aliases.read': ['manage_journals', 'legacy_admin_access'],
  'users.read': ['manage_users'],
  'users.manage_roles': ['manage_roles'],
  'users.disable': ['manage_users'],
  'users.assign_super_admin': ['manage_roles'],
  'audit.read': ['view_audit_logs'],
  'system.health': ['legacy_admin_access', 'manage_system_settings'],
}

/** TECH_DEBT: Remove when all admin routes use admin_permissions exclusively. */
export const LEGACY_DUAL_READ_ENABLED = true

export const LEGACY_DUAL_READ_NOTE =
  'Dual-read: admin_permissions OR legacy global role matrix. Remove LEGACY_DUAL_READ after admin panel refactor.'
