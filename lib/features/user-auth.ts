/**
 * Üyelik ve yönetim paneli feature flag'leri.
 * Yetkilendirme yalnızca server-side env okur; client flag'e dayanmaz.
 * Varsayılan: kapalı. Etkinleştirmek için env değerini '1' yapın.
 */

function envEnabled(name: string): boolean {
  return process.env[name] === '1'
}

/** Server-side: auth API ve route guard'ları */
export function isUserAuthEnabled(): boolean {
  return envEnabled('ENABLE_USER_AUTH') || envEnabled('NEXT_PUBLIC_ENABLE_USER_AUTH')
}

/** Server-side: admin panel route guard'ları */
export function isAdminPanelEnabled(): boolean {
  return envEnabled('ENABLE_ADMIN_PANEL') || envEnabled('NEXT_PUBLIC_ENABLE_ADMIN_PANEL')
}

/** PostgreSQL-native auth aktif; Supabase Auth geçici yedek. */
export function isPgAuthEnabled(): boolean {
  return envEnabled('USE_PG_AUTH') || isUserAuthEnabled()
}

/** UI görünürlüğü — server component'ten client'a aktarılır */
export interface AuthUiFlags {
  userAuth: boolean
  adminPanel: boolean
}

/** Runtime env; build-time NEXT_PUBLIC bake zorunlu değil */
export function getAuthUiFlags(): AuthUiFlags {
  return {
    userAuth: isUserAuthEnabled(),
    adminPanel: isAdminPanelEnabled(),
  }
}

/** @deprecated Client'ta doğrudan kullanmayın — layout'tan prop alın */
export function isUserAuthPublicEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_USER_AUTH === '1'
}

/** @deprecated Client'ta doğrudan kullanmayın — layout'tan prop alın */
export function isAdminPanelPublicEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_ADMIN_PANEL === '1'
}
