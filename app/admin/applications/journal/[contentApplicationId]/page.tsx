import Link from 'next/link'
import { requireAdminPermissionGuard } from '@/lib/auth/guards'
import {
  getJournalApplicationForAdmin,
} from '@/lib/journal-applications/admin-service'
import { JournalApplicationReviewActions } from '@/components/admin/JournalApplicationReviewActions'
import { Card } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ contentApplicationId: string }> }

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(140px,200px)_1fr] gap-2 py-1 text-sm border-b border-muted/40 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{value ?? '—'}</dd>
    </div>
  )
}

export default async function AdminJournalApplicationDetailPage({ params }: PageProps) {
  await requireAdminPermissionGuard('review_content_applications')
  const { contentApplicationId } = await params
  const detail = await getJournalApplicationForAdmin(contentApplicationId)
  const ja = detail.journalApplication

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/applications" className="text-sm text-primary hover:underline">
            ← İçerik başvuruları
          </Link>
          <h1 className="text-2xl font-semibold mt-1">{detail.contentApplication.title}</h1>
          <p className="text-sm text-muted-foreground">
            Durum: {detail.contentApplication.statusLabel} · Başvuran: {detail.applicant.email}
            {detail.applicant.name ? ` (${detail.applicant.name})` : ''}
          </p>
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <h2 className="font-medium">İşlemler</h2>
        <JournalApplicationReviewActions
          contentApplicationId={contentApplicationId}
          status={detail.contentApplication.status as import('@prisma/client').ContentApplicationStatus}
        />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="font-medium mb-3">Başvuru özeti</h2>
          <dl>
            <FieldRow label="Durum" value={detail.contentApplication.statusLabel} />
            <FieldRow
              label="Gönderim"
              value={
                detail.contentApplication.submittedAt
                  ? new Date(detail.contentApplication.submittedAt).toLocaleString('tr-TR')
                  : '—'
              }
            />
            <FieldRow
              label="Atanan"
              value={
                detail.assignee
                  ? `${detail.assignee.email}${detail.assignee.name ? ` (${detail.assignee.name})` : ''}`
                  : '—'
              }
            />
            {detail.approvedJournal && (
              <FieldRow
                label="Onaylanan dergi"
                value={`#${detail.approvedJournal.id} · ${detail.approvedJournal.titleTr} (${detail.approvedJournal.status})`}
              />
            )}
          </dl>
        </Card>

        <Card className="p-4">
          <h2 className="font-medium mb-3">Özel iletişim</h2>
          <dl>
            <FieldRow label="Ad" value={detail.privateContact.contactName} />
            <FieldRow label="Rol" value={detail.privateContact.contactRole} />
            <FieldRow label="E-posta" value={detail.privateContact.contactEmail} />
            <FieldRow label="İş tel." value={detail.privateContact.workPhone} />
            <FieldRow label="Cep tel." value={detail.privateContact.mobilePhone} />
          </dl>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="font-medium mb-3">Dergi başvuru alanları</h2>
        <dl className="columns-1 md:columns-2 gap-x-8">
          <FieldRow label="Ad (TR)" value={ja.nameTr} />
          <FieldRow label="Ad (EN)" value={ja.nameEn} />
          <FieldRow label="Kısaltma" value={ja.abbreviation} />
          <FieldRow label="Yayıncı kurum" value={ja.publisherInstitutionName ?? ja.proposedInstitutionName} />
          <FieldRow label="Dergi türü" value={ja.journalType} />
          <FieldRow label="Platform" value={ja.publishingPlatform} />
          <FieldRow label="Web sitesi" value={ja.websiteUrl} />
          <FieldRow label="P-ISSN" value={ja.pIssn} />
          <FieldRow label="E-ISSN" value={ja.eIssn} />
          <FieldRow label="İlk yıl" value={ja.firstPublicationYear} />
          <FieldRow label="Sıklık" value={ja.publicationFrequency} />
          <FieldRow label="Editör" value={ja.editorName} />
          <FieldRow label="Editör e-posta" value={ja.editorEmail} />
          <FieldRow label="Anahtar kelimeler" value={ja.keywords.join(', ') || '—'} />
          <FieldRow
            label="Konu alanları"
            value={
              ja.subjectAreas.length > 0
                ? ja.subjectAreas
                    .map((a) => `${a.categoryNameTr ?? a.categoryId} (${a.level})`)
                    .join(', ')
                : '—'
            }
          />
          <FieldRow label="Mükerrer devam gerekçesi" value={ja.duplicateContinueReason} />
        </dl>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="font-medium mb-3">ISSN doğrulama</h2>
          <dl>
            <FieldRow
              label="P-ISSN"
              value={
                detail.issnValidation.pIssn
                  ? detail.issnValidation.pIssn.ok
                    ? detail.issnValidation.pIssn.formatted
                    : detail.issnValidation.pIssn.error
                  : '—'
              }
            />
            <FieldRow
              label="E-ISSN"
              value={
                detail.issnValidation.eIssn
                  ? detail.issnValidation.eIssn.ok
                    ? detail.issnValidation.eIssn.formatted
                    : detail.issnValidation.eIssn.error
                  : '—'
              }
            />
            <FieldRow
              label="Geçerli ISSN"
              value={detail.issnValidation.hasAtLeastOneValid ? 'Evet' : 'Hayır'}
            />
          </dl>
        </Card>

        <Card className="p-4">
          <h2 className="font-medium mb-3">Mükerrer ön kontrol (güncel)</h2>
          <p className="text-xs text-muted-foreground mb-2">
            Tam eşleşme: {detail.duplicatePrecheck.hasExact ? 'Var' : 'Yok'} · Bayrak:{' '}
            {detail.duplicatePrecheck.flags.length}
          </p>
          {detail.duplicatePrecheck.flags.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bayrak yok.</p>
          ) : (
            <ul className="text-xs space-y-1 max-h-48 overflow-y-auto">
              {detail.duplicatePrecheck.flags.map((flag, i) => (
                <li key={i} className="border-b border-muted/30 py-1">
                  <span className="font-mono">{flag.matchLevel}</span> · {flag.reason}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="font-medium mb-3">Ekler</h2>
        {detail.attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ek yok.</p>
        ) : (
          <ul className="text-sm space-y-2">
            {detail.attachments.map((att) => (
              <li key={att.id}>
                <span className="font-mono text-xs text-muted-foreground">{att.kind}</span>{' '}
                <a
                  href={`/api/applications/${contentApplicationId}/attachments/${att.id}/download`}
                  className="text-primary hover:underline"
                >
                  {att.originalName}
                </a>{' '}
                <span className="text-muted-foreground text-xs">
                  ({Math.round(att.sizeBytes / 1024)} KB)
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-0 overflow-x-auto">
        <h2 className="font-medium px-4 pt-4">Revizyon geçmişi</h2>
        {detail.revisions.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Revizyon yok.</p>
        ) : (
          <table className="w-full text-xs border-collapse min-w-[640px] mt-2">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Tür</th>
                <th className="px-3 py-2 font-medium">Oluşturan</th>
                <th className="px-3 py-2 font-medium">Tarih</th>
              </tr>
            </thead>
            <tbody>
              {detail.revisions.map((rev) => (
                <tr key={rev.id} className="border-b">
                  <td className="px-3 py-2">{rev.revisionNumber}</td>
                  <td className="px-3 py-2 font-mono">{rev.submissionType}</td>
                  <td className="px-3 py-2">{rev.creator.email}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(rev.createdAt).toLocaleString('tr-TR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-0 overflow-x-auto">
        <h2 className="font-medium px-4 pt-4">İnceleme notları</h2>
        {detail.reviews.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Not yok.</p>
        ) : (
          <table className="w-full text-xs border-collapse min-w-[640px] mt-2">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">Karar</th>
                <th className="px-3 py-2 font-medium">İnceleyen</th>
                <th className="px-3 py-2 font-medium">Not</th>
                <th className="px-3 py-2 font-medium">Tarih</th>
              </tr>
            </thead>
            <tbody>
              {detail.reviews.map((rev) => (
                <tr key={rev.id} className="border-b align-top">
                  <td className="px-3 py-2 font-mono">{rev.decision ?? '—'}</td>
                  <td className="px-3 py-2">{rev.reviewer.email}</td>
                  <td className="px-3 py-2 whitespace-pre-wrap">{rev.note ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(rev.createdAt).toLocaleString('tr-TR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-0 overflow-x-auto">
        <h2 className="font-medium px-4 pt-4">Olay zaman çizelgesi</h2>
        {detail.events.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Olay yok.</p>
        ) : (
          <table className="w-full text-xs border-collapse min-w-[720px] mt-2">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">Olay</th>
                <th className="px-3 py-2 font-medium">Durum</th>
                <th className="px-3 py-2 font-medium">Tarih</th>
              </tr>
            </thead>
            <tbody>
              {detail.events.map((ev) => (
                <tr key={ev.id} className="border-b">
                  <td className="px-3 py-2 font-mono">{ev.eventType}</td>
                  <td className="px-3 py-2">
                    {ev.fromStatus ?? '—'} → {ev.toStatus ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(ev.createdAt).toLocaleString('tr-TR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
