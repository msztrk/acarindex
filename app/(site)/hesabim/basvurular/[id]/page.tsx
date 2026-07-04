import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUserAuth } from '@/lib/auth/guards'
import { getContentApplicationDetail } from '@/lib/applications/service'
import { getPrivateContactForAuthorizedUser } from '@/lib/applications/list-unified'
import { CONTENT_KIND_LABELS } from '@/lib/applications/types'
import { mapContentStatusToDisplay } from '@/lib/applications/status-map'
import { ApplicationDraftEditor } from '@/components/applications/ApplicationDraftEditor'

export const metadata = { title: 'Başvuru detayı | Hesabım' }

const STATUS_LABELS: Record<string, string> = {
  draft: 'Taslak',
  submitted: 'Gönderildi',
  in_review: 'İncelemede',
  revision_requested: 'Düzeltme istendi',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  cancelled: 'İptal',
}

export default async function BasvuruDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await requireUserAuth()
  const { id } = await params

  let app
  try {
    app = await getContentApplicationDetail(id, session.user.id)
  } catch {
    notFound()
  }

  const privateContact = await getPrivateContactForAuthorizedUser(id, session.user.id, false)
  const displayStatus = mapContentStatusToDisplay(app.status)
  const editable = app.status === 'draft' || app.status === 'revision_requested'

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href="/hesabim/basvurular" className="text-sm text-primary hover:underline">
        ← Başvurularım
      </Link>

      <div>
        <p className="text-sm text-muted-foreground">{CONTENT_KIND_LABELS[app.kind]}</p>
        <h2 className="text-xl font-semibold mt-1">{app.title}</h2>
        <p className="text-sm mt-2">
          Durum:{' '}
          <span className="font-medium">
            {STATUS_LABELS[displayStatus] ?? displayStatus}
          </span>
        </p>
      </div>

      {editable && (
        <ApplicationDraftEditor
          applicationId={app.id}
          initialTitle={app.title}
          initialDraftPayload={(app.draftPayload as Record<string, unknown> | null) ?? {}}
          initialPrivateContact={privateContact}
        />
      )}

      {!editable && (
        <p className="text-sm text-muted-foreground rounded-md border p-4 bg-muted/30">
          Bu başvuru gönderildi veya sonuçlandı; düzenleme yapılamaz.
        </p>
      )}

      {app.revisions.length > 0 && (
        <section>
          <h3 className="font-medium mb-2">Revizyon geçmişi</h3>
          <ul className="text-sm space-y-1 text-muted-foreground">
            {app.revisions.map((r) => (
              <li key={r.id}>
                v{r.revisionNumber} — {r.submissionType} —{' '}
                {r.createdAt.toLocaleString('tr-TR')}
              </li>
            ))}
          </ul>
        </section>
      )}

      {app.events.length > 0 && (
        <section>
          <h3 className="font-medium mb-2">Durum geçmişi</h3>
          <ul className="text-sm space-y-1 text-muted-foreground">
            {app.events.map((e) => (
              <li key={e.id}>
                {e.eventType}
                {e.toStatus ? ` → ${e.toStatus}` : ''} — {e.createdAt.toLocaleString('tr-TR')}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
