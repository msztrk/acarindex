import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import { requireAdminPermissionGuard } from '@/lib/auth/guards'
import { JOURNAL_STATUS_LABELS } from '@/lib/admin/journal-publish'
import { JournalPublishButton } from '@/components/admin/JournalPublishButton'
import { Card } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ id: string }> }

export default async function AdminJournalDetailPage({ params }: PageProps) {
  await requireAdminPermissionGuard('manage_journals')
  const { id } = await params

  let journalId: bigint
  try {
    journalId = BigInt(id)
  } catch {
    notFound()
  }

  const journal = await prisma.journal.findUnique({
    where: { id: journalId },
    select: {
      id: true,
      slug: true,
      titleTr: true,
      titleEn: true,
      status: true,
      issn: true,
      eissn: true,
      publisher: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!journal) {
    notFound()
  }

  const idStr = journal.id.toString()

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/journals" className="text-sm text-primary hover:underline">
          ← Dergiler
        </Link>
        <h1 className="text-2xl font-semibold mt-1">{journal.titleTr ?? journal.slug}</h1>
        <p className="text-sm text-muted-foreground">
          #{idStr} · {JOURNAL_STATUS_LABELS[journal.status] ?? journal.status}
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <h2 className="font-medium">Yayınlama</h2>
        <JournalPublishButton journalId={idStr} status={journal.status} />
      </Card>

      <Card className="p-4">
        <h2 className="font-medium mb-3">Özet</h2>
        <dl className="grid grid-cols-[minmax(140px,200px)_1fr] gap-2 text-sm">
          <dt className="text-muted-foreground">Slug</dt>
          <dd className="font-mono">{journal.slug}</dd>
          <dt className="text-muted-foreground">Başlık (TR)</dt>
          <dd>{journal.titleTr ?? '—'}</dd>
          <dt className="text-muted-foreground">Başlık (EN)</dt>
          <dd>{journal.titleEn ?? '—'}</dd>
          <dt className="text-muted-foreground">Yayıncı</dt>
          <dd>{journal.publisher ?? '—'}</dd>
          <dt className="text-muted-foreground">ISSN</dt>
          <dd>{journal.issn ?? '—'}</dd>
          <dt className="text-muted-foreground">E-ISSN</dt>
          <dd>{journal.eissn ?? '—'}</dd>
          <dt className="text-muted-foreground">Oluşturulma</dt>
          <dd>{journal.createdAt.toLocaleString('tr-TR')}</dd>
          <dt className="text-muted-foreground">Güncelleme</dt>
          <dd>{journal.updatedAt.toLocaleString('tr-TR')}</dd>
        </dl>
      </Card>
    </div>
  )
}
