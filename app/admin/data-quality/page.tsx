import Link from 'next/link'
import { loadDataQualitySummary, type DataQualityCategory } from '@/lib/admin/data-quality'
import { Card } from '@/components/ui/card'

const CATEGORIES: Array<{ key: DataQualityCategory; label: string; summaryKey: keyof Awaited<ReturnType<typeof loadDataQualitySummary>> }> = [
  { key: 'duplicate_slug', label: 'Duplicate slug', summaryKey: 'duplicateSlug' },
  { key: 'orphan_article', label: 'Orphan makale', summaryKey: 'orphanArticle' },
  { key: 'orphan_issue', label: 'Orphan sayı', summaryKey: 'orphanIssue' },
  { key: 'missing_pdf', label: 'PDF eksik makale', summaryKey: 'missingPdf' },
  { key: 'empty_authors_raw', label: 'authors_raw boş', summaryKey: 'emptyAuthorsRaw' },
  { key: 'failed_etl', label: 'Başarısız ETL', summaryKey: 'failedEtl' },
  { key: 'open_author_claims', label: 'Açık author claim', summaryKey: 'openAuthorClaims' },
  { key: 'url_alias_issues', label: 'URL alias sorunu', summaryKey: 'urlAliasIssues' },
]

export default async function DataQualityPage() {
  const summary = await loadDataQualitySummary()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Veri Kalitesi</h1>
      <div className="grid md:grid-cols-2 gap-3">
        {CATEGORIES.map((c) => {
          const count = summary[c.summaryKey]
          return (
            <Card key={c.key} className="p-4 flex justify-between items-center">
              <span>{c.label}</span>
              <div className="flex items-center gap-3">
                <span className="font-semibold">{count}</span>
                <Link
                  href={`/admin/data-quality/${c.key}`}
                  className="text-sm text-primary hover:underline"
                >
                  Detay
                </Link>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
