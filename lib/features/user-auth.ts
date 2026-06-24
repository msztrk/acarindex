/**
 * Üyelik ve yönetim paneli feature flag'leri.
 * Varsayılan: kapalı. Etkinleştirmek için env değerini '1' yapın.
 */
export function isUserAuthEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_ENABLE_USER_AUTH === '1' || process.env.ENABLE_USER_AUTH === '1'
  )
}

export function isUserAuthPublicEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_USER_AUTH === '1'
}

export function isAdminPanelEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_ENABLE_ADMIN_PANEL === '1' || process.env.ENABLE_ADMIN_PANEL === '1'
  )
}

export function isAdminPanelPublicEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_ADMIN_PANEL === '1'
}

/** PostgreSQL-native auth aktif; Supabase Auth geçici yedek. */
export function usePgAuth(): boolean {
  return process.env.USE_PG_AUTH === '1' || isUserAuthEnabled()
}
