import Link from 'next/link'
import { listApprovedJournalMemberships } from '@/lib/auth/authorization'
import { requireEditorPanelSession } from '@/lib/auth/panel-guards'
import { listChangeRequestsForUser } from '@/lib/change-requests/service'
import { listMembershipApplicationsForUser } from '@/lib/membership-applications/service'

export const metadata = { title: 'Dergi Editör Paneli | AcarIndex' }

export default async function EditorPanelPage() {
  const session = await requireEditorPanelSession()
  const [memberships, applications, changeRequests] = await Promise.all([
    listApprovedJournalMemberships(session.user.id),
    listMembershipApplicationsForUser(session.user.id),
    listChangeRequestsForUser(session.user.id),
  ])

  const pendingApps = applications.filter(
    (a) => a.type === 'journal_editor' && a.status === 'pending',
  )

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-3">Yetkili olduğunuz dergiler</h2>
        {memberships.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Henüz onaylı dergi editörlüğünüz yok.{' '}
            <Link href="/editor/basvuru" className="text-primary hover:underline">
              Editör başvurusu yapın
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {memberships.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{m.journal.titleTr ?? m.journal.slug}</p>
                  <p className="text-sm text-muted-foreground">
                    {m.role === 'journal_owner' ? 'Dergi sahibi' : 'Dergi editörü'} ·{' '}
                    {m.journal.hitCount.toLocaleString('tr-TR')} görüntülenme
                  </p>
                </div>
                <div className="flex gap-3 text-sm">
                  <Link
                    href={`/editor/${m.journalId}`}
                    className="text-primary hover:underline"
                  >
                    Panel
                  </Link>
                  <Link
                    href={`/journals/${m.journal.slug}`}
                    className="text-muted-foreground hover:underline"
                  >
                    Dergi sayfası
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pendingApps.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Bekleyen başvurular</h2>
          <ul className="text-sm text-muted-foreground space-y-1">
            {pendingApps.map((a) => (
              <li key={a.id}>
                Dergi #{a.journalId?.toString()} — inceleme bekliyor
              </li>
            ))}
          </ul>
        </section>
      )}

      {changeRequests.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Son değişiklik talepleri</h2>
          <ul className="divide-y rounded-md border text-sm">
            {changeRequests.slice(0, 10).map((cr) => (
              <li key={cr.id} className="p-3 flex justify-between gap-2">
                <span>
                  {cr.changeType} ({cr.entityType} #{cr.entityId})
                </span>
                <span className="text-muted-foreground">{cr.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
