import { loadPaginatedJournals } from '@/lib/admin/catalog-lists'
import { AdminListPage } from '@/components/admin/AdminListPage'

export default async function AdminJournalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const { rows, meta } = await loadPaginatedJournals(sp)
  return <AdminListPage title="Dergiler" rows={rows} meta={meta} />
}
