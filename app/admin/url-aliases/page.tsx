import { loadPaginatedUrlAliases } from '@/lib/admin/catalog-lists'
import { AdminListPage } from '@/components/admin/AdminListPage'

export default async function AdminUrlAliasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const { rows, meta } = await loadPaginatedUrlAliases(sp)
  return <AdminListPage title="URL Yönlendirmeleri" rows={rows} meta={meta} />
}
