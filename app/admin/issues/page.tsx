import { loadPaginatedIssues } from '@/lib/admin/catalog-lists'
import { AdminListPage } from '@/components/admin/AdminListPage'

export default async function AdminIssuesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const { rows, meta } = await loadPaginatedIssues(sp)
  return <AdminListPage title="Sayılar" rows={rows} meta={meta} />
}
