/**
 * Yazar URL yardımcıları
 *
 * Canonical format:
 *   /authors/{authorSlug}-{authorId}
 *   /authors/{authorId}  (slug yoksa)
 */

export interface AuthorUrlParts {
  authorId: number
  slugPart?: string
}

export function parseAuthorSlugAndId(segment: string): AuthorUrlParts | null {
  if (!segment) return null

  if (/^\d+$/.test(segment)) {
    const authorId = Number(segment)
    if (!Number.isSafeInteger(authorId) || authorId <= 0) return null
    return { authorId }
  }

  const match = segment.match(/^(.+)-(\d+)$/)
  if (!match) return null

  const authorId = Number(match[2])
  if (!Number.isSafeInteger(authorId) || authorId <= 0) return null
  const slugPart = match[1].trim()
  if (!slugPart || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slugPart)) return null

  return { authorId, slugPart }
}

export function buildAuthorPathSegment(author: { id: number; slug: string | null }): string {
  return author.slug?.trim() ? `${author.slug.trim()}-${author.id}` : String(author.id)
}

export function buildAuthorUrl(author: { id: number; slug: string | null }): string {
  return `/authors/${buildAuthorPathSegment(author)}`
}
