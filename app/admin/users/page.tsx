import { Suspense } from 'react'
import { requireUserManagement } from '@/lib/auth/guards'
import { loadPaginatedUsers } from '@/lib/admin/catalog-lists'
import { UserManagementTable } from '@/components/admin/UserManagementTable'
import { AdminListToolbar } from '@/components/admin/AdminListToolbar'
import { APP_ROLES, canManageRole } from '@/lib/auth/roles'
import { getUserPanelSummary } from '@/lib/user-panel/summary'

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requireUserManagement()
  const sp = await searchParams
  const { rows, meta } = await loadPaginatedUsers(sp)
  const manageableRoles = APP_ROLES.filter((r) => canManageRole(session.user.roles, r))

  const panelSummaries: Record<string, Awaited<ReturnType<typeof getUserPanelSummary>>> = {}
  for (const u of rows) {
    panelSummaries[u.id] = await getUserPanelSummary(u.id)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Kullanıcılar</h1>
      <p className="text-xs text-muted-foreground">
        Okuma listesi içeriği ve görüntüleme geçmişi admin tarafından gösterilmez (yalnızca sayısal özet).
      </p>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Yükleniyor…</p>}>
        <AdminListToolbar meta={meta} searchPlaceholder="E-posta ara…" />
      </Suspense>
      <UserManagementTable
        users={rows}
        manageableRoles={manageableRoles}
        panelSummaries={panelSummaries}
        canAdminVerifyEmail={session.user.roles.includes('SUPER_ADMIN')}
      />
    </div>
  )
}
