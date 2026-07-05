import { loadPaginatedIssues } from '@/lib/admin/catalog-lists'
import { AdminListPage } from '@/components/admin/AdminListPage'
import { requireAdminPermissionGuard } from '@/lib/auth/guards'

export default async function AdminIssuesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdminPermissionGuard('manage_journals')
  const sp = await searchParams
  const { rows, meta } = await loadPaginatedIssues(sp)
  return <AdminListPage title="Sayılar" rows={rows} meta={meta} />
}
