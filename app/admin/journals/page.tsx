import Link from 'next/link'
import { Suspense } from 'react'
import { loadPaginatedJournals } from '@/lib/admin/catalog-lists'
import { requireAdminPermissionGuard } from '@/lib/auth/guards'
import { JOURNAL_STATUS_LABELS } from '@/lib/admin/journal-publish'
import { AdminListToolbar } from '@/components/admin/AdminListToolbar'
import { Card } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

const STATUS_FILTERS = [
  { value: '', label: 'Tümü' },
  { value: 'draft', label: 'Taslak' },
  { value: 'published', label: 'Yayında' },
  { value: 'archived', label: 'Arşiv' },
] as const

export default async function AdminJournalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdminPermissionGuard('manage_journals')
  const sp = await searchParams
  const { rows, meta } = await loadPaginatedJournals(sp)
  const activeStatus = Array.isArray(sp.status) ? sp.status[0] : sp.status

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dergiler</h1>
      <div className="flex flex-wrap gap-2 text-sm">
        {STATUS_FILTERS.map((f) => {
          const href = f.value ? `?status=${f.value}` : '/admin/journals'
          const active = (activeStatus ?? '') === f.value
          return (
            <Link
              key={f.value || 'all'}
              href={href}
              className={
                active
                  ? 'rounded border border-primary/40 px-2 py-1 text-primary'
                  : 'rounded border px-2 py-1 hover:bg-muted/50'
              }
            >
              {f.label}
            </Link>
          )
        })}
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Yükleniyor…</p>}>
        <AdminListToolbar meta={meta} />
      </Suspense>
      {rows.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">Kayıt bulunamadı.</Card>
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Slug</th>
                <th className="px-3 py-2 font-medium">Başlık (TR)</th>
                <th className="px-3 py-2 font-medium">Durum</th>
                <th className="px-3 py-2 font-medium">Detay</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b align-top">
                  <td className="px-3 py-2">{row.id}</td>
                  <td className="px-3 py-2 font-mono">{row.slug}</td>
                  <td className="px-3 py-2">{row.titleTr ?? '—'}</td>
                  <td className="px-3 py-2">
                    {JOURNAL_STATUS_LABELS[row.status] ?? row.status}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/journals/${row.id}`}
                      className="text-primary hover:underline"
                    >
                      Görüntüle
                    </Link>
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
