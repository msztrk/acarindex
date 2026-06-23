/**
 * Üyelik / Supabase Auth — bu sprintte kapalı (geçici bağımlılık).
 */
export function isUserAuthEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_ENABLE_USER_AUTH === '1' || process.env.ENABLE_USER_AUTH === '1'
  )
}

/** Client bileşenlerinde kullanım (yalnızca public env). */
export function isUserAuthPublicEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_USER_AUTH === '1'
}
