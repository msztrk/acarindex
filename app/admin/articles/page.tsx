import { loadPaginatedArticles } from '@/lib/admin/catalog-lists'
import { AdminListPage } from '@/components/admin/AdminListPage'

export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const { rows, meta } = await loadPaginatedArticles(sp)
  return <AdminListPage title="Makaleler" rows={rows} meta={meta} />
}
