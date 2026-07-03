import { requireAdminPermissionGuard } from '@/lib/auth/guards'
import { listPendingChangeRequests } from '@/lib/change-requests/service'
import { AdminReviewActions } from '@/components/admin/AdminReviewActions'
import { Card } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

export default async function AdminChangeRequestsPage() {
  await requireAdminPermissionGuard('review_change_requests')
  const rows = await listPendingChangeRequests()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Değişiklik talepleri</h1>
      <p className="text-sm text-muted-foreground">
        ISSN, DOI, silme ve benzeri kritik değişiklikler admin onayı gerektirir. Onay sonrası
        uygulama (Faz 3+) ayrı adımda yapılacak.
      </p>
      {rows.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">Bekleyen talep yok.</Card>
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[720px]">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">Tür</th>
                <th className="px-3 py-2 font-medium">Varlık</th>
                <th className="px-3 py-2 font-medium">Talep eden</th>
                <th className="px-3 py-2 font-medium">Tarih</th>
                <th className="px-3 py-2 font-medium">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((cr) => (
                <tr key={cr.id} className="border-b align-top">
                  <td className="px-3 py-2 font-mono">{cr.changeType}</td>
                  <td className="px-3 py-2">
                    {cr.entityType} #{cr.entityId}
                  </td>
                  <td className="px-3 py-2">
                    <div>{cr.requester.email}</div>
                    {cr.requester.name && (
                      <div className="text-muted-foreground">{cr.requester.name}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {cr.createdAt.toLocaleString('tr-TR')}
                  </td>
                  <td className="px-3 py-2">
                    <AdminReviewActions id={cr.id} apiPath="/api/admin/change-requests" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
