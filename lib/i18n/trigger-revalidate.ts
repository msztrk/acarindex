/**
 * Request EN content cache revalidation from standalone scripts (ETL, recompute).
 * Requires REVALIDATE_SECRET and REVALIDATE_BASE_URL (or NEXT_PUBLIC_SITE_URL).
 */
export async function triggerEnglishContentRevalidation(): Promise<boolean> {
  const base = process.env.REVALIDATE_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL
  const secret = process.env.REVALIDATE_SECRET
  if (!base?.trim() || !secret?.trim()) return false

  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/internal/revalidate-i18n`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
    })
    return res.ok
  } catch {
    return false
  }
}
