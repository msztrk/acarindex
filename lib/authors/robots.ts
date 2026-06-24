import type { Author } from '@/types/database'

function isBetaHost(): boolean {
  return (
    process.env.APP_ENV === 'staging' ||
    process.env.NEXT_PUBLIC_SITE_URL?.includes('beta') === true
  )
}

/** Canonical yazarlar index; provisional noindex; beta host nofollow. */
export function buildAuthorRobots(author: Pick<Author, 'is_provisional'>): {
  index: boolean
  follow: boolean
} {
  if (isBetaHost()) {
    return { index: false, follow: false }
  }
  if (author.is_provisional) {
    return { index: false, follow: true }
  }
  return { index: true, follow: true }
}

export function shouldEmitAuthorProfileJsonLd(author: Pick<Author, 'is_provisional'>): boolean {
  return !author.is_provisional
}
