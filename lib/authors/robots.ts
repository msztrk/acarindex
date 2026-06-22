import type { Author } from '@/types/database'

/** Canonical yazarlar index; provisional noindex, follow. */
export function buildAuthorRobots(author: Pick<Author, 'is_provisional'>): {
  index: boolean
  follow: boolean
} {
  if (author.is_provisional) {
    return { index: false, follow: true }
  }
  return { index: true, follow: true }
}

export function shouldEmitAuthorProfileJsonLd(author: Pick<Author, 'is_provisional'>): boolean {
  return !author.is_provisional
}
