import { requireAdminPermissionGuard } from '@/lib/auth/guards'
import { listPendingMembershipApplications } from '@/lib/membership-applications/service'
import { AdminReviewActions } from '@/components/admin/AdminReviewActions'
import { Card } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

export default async function AdminMembershipApplicationsPage() {
  await requireAdminPermissionGuard('manage_journals')
  const rows = await listPendingMembershipApplications()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Üyelik başvuruları</h1>
      <p className="text-sm text-muted-foreground">
        Dergi editörü ve kurum yöneticisi başvuruları. Onaylandığında ilgili üyelik kaydı oluşturulur.
      </p>
      {rows.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">Bekleyen başvuru yok.</Card>
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">Tür</th>
                <th className="px-3 py-2 font-medium">Kullanıcı</th>
                <th className="px-3 py-2 font-medium">Hedef</th>
                <th className="px-3 py-2 font-medium">Tarih</th>
                <th className="px-3 py-2 font-medium">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-b align-top">
                  <td className="px-3 py-2">
                    {a.type === 'journal_editor' ? 'Dergi editörü' : 'Kurum yöneticisi'}
                  </td>
                  <td className="px-3 py-2">
                    <div>{a.user.email}</div>
                    {a.user.name && (
                      <div className="text-muted-foreground">{a.user.name}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {a.type === 'journal_editor'
                      ? `${a.journal?.titleTr ?? a.journal?.slug ?? '—'} (#${a.journalId})`
                      : `${a.institution?.nameTr ?? '—'} (#${a.institutionId})`}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {a.createdAt.toLocaleString('tr-TR')}
                  </td>
                  <td className="px-3 py-2">
                    <AdminReviewActions
                      id={a.id}
                      apiPath="/api/admin/membership-applications"
                    />
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
