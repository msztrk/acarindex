import { loadPaginatedAuditLogs } from '@/lib/admin/catalog-lists'
import { requireUserManagement } from '@/lib/auth/guards'
import { AdminListPage } from '@/components/admin/AdminListPage'

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireUserManagement()
  const sp = await searchParams
  const { rows, meta } = await loadPaginatedAuditLogs(sp)
  return <AdminListPage title="Audit Log" rows={rows} meta={meta} />
}
