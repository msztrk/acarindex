export interface AuthorArticleSortable {
  id: number
  published_year: number | null
  published_at: string | null
}

export function dedupeAndSortAuthorArticles<T extends AuthorArticleSortable>(articles: T[]): T[] {
  const unique = new Map<number, T>()

  for (const article of articles) {
    if (!unique.has(article.id)) {
      unique.set(article.id, article)
    }
  }

  return [...unique.values()].sort(compareAuthorArticles)
}

export function compareAuthorArticles<T extends AuthorArticleSortable>(a: T, b: T): number {
  const yearA = a.published_year ?? -1
  const yearB = b.published_year ?? -1
  if (yearA !== yearB) return yearB - yearA

  if (a.published_at && b.published_at) {
    const timeA = new Date(a.published_at).getTime()
    const timeB = new Date(b.published_at).getTime()
    if (timeA !== timeB) return timeB - timeA
  } else if (a.published_at && !b.published_at) {
    return -1
  } else if (!a.published_at && b.published_at) {
    return 1
  }

  return b.id - a.id
}
