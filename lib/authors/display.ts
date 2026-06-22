export function normalizeAuthorDisplayName(name: string): string {
  return name
    .replace(/\s+/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim()
}

export function buildAuthorMetadataTitle(displayName: string): string {
  const suffix = ' – Makaleleri ve Akademik Yayınları'
  const maxTitleLength = 60

  if (displayName.length + suffix.length <= maxTitleLength) {
    return `${displayName}${suffix}`
  }

  return displayName.length > maxTitleLength
    ? `${displayName.slice(0, maxTitleLength - 1).trimEnd()}…`
    : displayName
}

export function buildAuthorMetadataDescription(
  displayName: string,
  articleCount: number,
): string {
  if (articleCount > 0) {
    return `${displayName} tarafından yayımlanan ${articleCount} akademik makaleyi inceleyin.`
  }

  return `${displayName} tarafından yayımlanan akademik makaleleri, dergileri ve yayın bilgilerini inceleyin.`
}
