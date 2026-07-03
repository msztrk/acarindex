import Link from 'next/link'
import { prisma } from '@/lib/db/prisma'
import { requireEditorJournalSession } from '@/lib/auth/panel-guards'
import { listChangeRequestsForUser } from '@/lib/change-requests/service'

export async function generateMetadata({ params }: { params: Promise<{ journalId: string }> }) {
  const { journalId } = await params
  const journal = await prisma.journal.findUnique({
    where: { id: BigInt(journalId) },
    select: { titleTr: true },
  })
  return {
    title: journal?.titleTr ? `${journal.titleTr} — Editör | AcarIndex` : 'Dergi Editör | AcarIndex',
  }
}

export default async function EditorJournalPage({
  params,
}: {
  params: Promise<{ journalId: string }>
}) {
  const { journalId } = await params
  const ctx = await requireEditorJournalSession(journalId)

  const [journal, articleCount, changeRequests] = await Promise.all([
    prisma.journal.findUnique({
      where: { id: ctx.journalId },
      select: { titleTr: true, slug: true, hitCount: true, issn: true, eissn: true },
    }),
    prisma.article.count({ where: { journalId: ctx.journalId } }),
    listChangeRequestsForUser(ctx.user.id),
  ])

  const journalChanges = changeRequests.filter(
    (cr) => cr.entityType === 'journal' && cr.entityId === journalId,
  )

  return (
    <div className="space-y-8">
      <div>
        <Link href="/editor" className="text-sm text-primary hover:underline">
          ← Tüm dergiler
        </Link>
        <h2 className="mt-2 text-xl font-semibold">{journal?.titleTr ?? `Dergi #${journalId}`}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Rol: {ctx.membership.role === 'journal_owner' ? 'Dergi sahibi' : 'Dergi editörü'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-md border p-4">
          <p className="text-sm text-muted-foreground">Makale</p>
          <p className="text-2xl font-semibold">{articleCount.toLocaleString('tr-TR')}</p>
        </div>
        <div className="rounded-md border p-4">
          <p className="text-sm text-muted-foreground">Görüntülenme</p>
          <p className="text-2xl font-semibold">
            {(journal?.hitCount ?? 0).toLocaleString('tr-TR')}
          </p>
        </div>
        <div className="rounded-md border p-4">
          <p className="text-sm text-muted-foreground">ISSN</p>
          <p className="text-lg font-medium">{journal?.issn ?? journal?.eissn ?? '—'}</p>
        </div>
      </div>

      <section className="rounded-md border p-4 bg-muted/30">
        <h3 className="font-medium mb-2">Düşük riskli düzenleme (yakında)</h3>
        <p className="text-sm text-muted-foreground">
          Açıklama, web sitesi ve benzeri alanlar doğrudan güncellenebilecek. ISSN, DOI ve silme
          işlemleri admin onaylı değişiklik talebi gerektirir.
        </p>
      </section>

      {journalChanges.length > 0 && (
        <section>
          <h3 className="font-medium mb-3">Bu dergi için değişiklik talepleri</h3>
          <ul className="divide-y rounded-md border text-sm">
            {journalChanges.map((cr) => (
              <li key={cr.id} className="p-3 flex justify-between">
                <span>{cr.changeType}</span>
                <span className="text-muted-foreground">{cr.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {journal?.slug && (
        <Link
          href={`/journals/${journal.slug}`}
          className="inline-block text-sm text-primary hover:underline"
        >
          Dergi sayfasını görüntüle →
        </Link>
      )}
    </div>
  )
}
