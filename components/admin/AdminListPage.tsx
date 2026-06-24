import Link from 'next/link'
import { Suspense } from 'react'
import { Card } from '@/components/ui/card'
import { AdminListToolbar } from '@/components/admin/AdminListToolbar'

function formatCell(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function AdminListPage({
  title,
  rows,
  meta,
  hideToolbar,
}: {
  title: string
  rows: Record<string, unknown>[]
  meta: { page: number; pageSize: number; totalPages: number; total: number }
  hideToolbar?: boolean
}) {
  const columns =
    rows.length > 0
      ? Object.keys(rows[0]).slice(0, 8)
      : []

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {!hideToolbar && (
        <Suspense fallback={<p className="text-sm text-muted-foreground">Yükleniyor…</p>}>
          <AdminListToolbar meta={meta} />
        </Suspense>
      )}
      {rows.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">Kayıt bulunamadı.</Card>
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[480px]">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                {columns.map((col) => (
                  <th key={col} className="px-3 py-2 font-medium">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b align-top">
                  {columns.map((col) => (
                    <td key={col} className="px-3 py-2 max-w-[240px] break-words">
                      {formatCell(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <div className="flex gap-3 text-sm">
        {meta.page > 1 && (
          <Link href={`?page=${meta.page - 1}`} className="text-primary hover:underline">Önceki</Link>
        )}
        {meta.page < meta.totalPages && (
          <Link href={`?page=${meta.page + 1}`} className="text-primary hover:underline">Sonraki</Link>
        )}
      </div>
    </div>
  )
}

