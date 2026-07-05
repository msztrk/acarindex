import { notFound } from 'next/navigation'
import {
  loadDataQualityPage,
  type DataQualityCategory,
} from '@/lib/admin/data-quality'
import { requirePermission } from '@/lib/auth/guards'
import { Card } from '@/components/ui/card'
import Link from 'next/link'

const VALID: DataQualityCategory[] = [
  'duplicate_slug',
  'orphan_article',
  'orphan_issue',
  'missing_pdf',
  'empty_authors_raw',
  'failed_etl',
  'open_author_claims',
  'url_alias_issues',
]

export default async function DataQualityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requirePermission('data_quality.read')
  const { category } = await params
  if (!VALID.includes(category as DataQualityCategory)) notFound()

  const sp = await searchParams
  const { rows, meta } = await loadDataQualityPage(category as DataQualityCategory, sp)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/admin/data-quality" className="text-sm hover:underline">← Veri Kalitesi</Link>
        <h1 className="text-xl font-semibold">{category}</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Sayfa {meta.page} / {meta.totalPages} — toplam {meta.total}
      </p>
      <Card className="p-4 overflow-x-auto">
        <pre className="text-xs">{JSON.stringify(rows, null, 2)}</pre>
      </Card>
      <div className="flex gap-2 text-sm">
        {meta.page > 1 && (
          <Link href={`?page=${meta.page - 1}`} className="hover:underline">Önceki</Link>
        )}
        {meta.page < meta.totalPages && (
          <Link href={`?page=${meta.page + 1}`} className="hover:underline">Sonraki</Link>
        )}
      </div>
    </div>
  )
}
