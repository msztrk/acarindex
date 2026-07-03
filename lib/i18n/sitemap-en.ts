export const EN_SITEMAP_PAGE_SIZE = 5000

export function computeEnSitemapPageCount(
  eligibleCount: number,
  pageSize = EN_SITEMAP_PAGE_SIZE,
): number {
  return eligibleCount > 0 ? Math.ceil(eligibleCount / pageSize) : 0
}

/** True when a requested page is beyond the last populated EN sitemap page. */
export function isBeyondEnSitemapPages(
  page: number,
  eligibleCount: number,
  pageSize = EN_SITEMAP_PAGE_SIZE,
): boolean {
  const pageCount = computeEnSitemapPageCount(eligibleCount, pageSize)
  return page > pageCount
}
