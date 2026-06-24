import Link from 'next/link'
import { Card } from '@/components/ui/card'

export function AdminListPage({
  title,
  rows,
  meta,
}: {
  title: string
  rows: unknown[]
  meta: { page: number; totalPages: number; total: number }
}) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">
        Sayfa {meta.page} / {meta.totalPages} — toplam {meta.total}
      </p>
      <Card className="p-4 overflow-x-auto">
        <pre className="text-xs max-h-[60vh]">{JSON.stringify(rows, null, 2)}</pre>
      </Card>
      <div className="flex gap-3 text-sm">
        {meta.page > 1 && <Link href={`?page=${meta.page - 1}`}>Önceki</Link>}
        {meta.page < meta.totalPages && <Link href={`?page=${meta.page + 1}`}>Sonraki</Link>}
      </div>
    </div>
  )
}
