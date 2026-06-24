import { loadPaginatedEtlRuns } from '@/lib/admin/catalog-lists'
import { AdminListPage } from '@/components/admin/AdminListPage'

export default async function AdminEtlPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const { rows, meta } = await loadPaginatedEtlRuns(sp)
  return <AdminListPage title="ETL İşlemleri" rows={rows} meta={meta} />
}
