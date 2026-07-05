import { loadPaginatedArticles } from '@/lib/admin/catalog-lists'
import { AdminListPage } from '@/components/admin/AdminListPage'
import { requireAdminPermissionGuard } from '@/lib/auth/guards'

export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdminPermissionGuard('manage_articles')
  const sp = await searchParams
  const { rows, meta } = await loadPaginatedArticles(sp)
  return <AdminListPage title="Makaleler" rows={rows} meta={meta} />
}
