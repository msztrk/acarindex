export const DEFAULT_PAGE_SIZE = 25
export const MAX_PAGE_SIZE = 100

export function parsePagination(
  searchParams: Record<string, string | string[] | undefined>,
  defaultSize = DEFAULT_PAGE_SIZE,
): { page: number; pageSize: number; skip: number } {
  const rawPage = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page
  const rawSize = Array.isArray(searchParams.pageSize) ? searchParams.pageSize[0] : searchParams.pageSize

  let page = parseInt(rawPage ?? '1', 10)
  if (!Number.isFinite(page) || page < 1) page = 1

  let pageSize = parseInt(rawSize ?? String(defaultSize), 10)
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = defaultSize
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE

  return { page, pageSize, skip: (page - 1) * pageSize }
}

export function paginationMeta(total: number, page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return { total, page, pageSize, totalPages }
}
