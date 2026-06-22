const ORCID_PATTERN = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/

export function normalizeOrcidValue(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null

  const trimmed = raw.trim()
  const fromUrl = trimmed.match(/orcid\.org\/(\d{4}-\d{4}-\d{4}-\d{3}[\dX])/i)?.[1]
  const candidate = (fromUrl ?? trimmed).toUpperCase()

  if (!ORCID_PATTERN.test(candidate)) return null

  return candidate
}

export function buildOrcidUrl(orcid: string): string {
  return `https://orcid.org/${orcid}`
}
