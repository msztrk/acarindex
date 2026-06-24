import { requireUserManagement } from '@/lib/auth/guards'
import { loadPaginatedUsers } from '@/lib/admin/catalog-lists'
import { AdminListPage } from '@/components/admin/AdminListPage'
import { Card } from '@/components/ui/card'
import { APP_ROLES } from '@/lib/auth/roles'

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireUserManagement()
  const sp = await searchParams
  const { rows, meta } = await loadPaginatedUsers(sp)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Kullanıcılar</h1>
      <Card className="p-3 text-sm text-muted-foreground">
        Rol atama/kaldırma ve pasif yapma için API:{' '}
        <code className="text-xs">/api/admin/users/[id]/roles</code>,{' '}
        <code className="text-xs">/api/admin/users/[id]/status</code> (CSRF gerekli).
        Geçerli roller: {APP_ROLES.join(', ')}.
      </Card>
      <AdminListPage title="Kullanıcı listesi" rows={rows} meta={meta} />
    </div>
  )
}
