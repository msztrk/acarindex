'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MAX_PAGE_SIZE } from '@/lib/admin/pagination'

export function AdminListToolbar({
  meta,
  searchPlaceholder,
}: {
  meta: { page: number; pageSize: number; totalPages: number; total: number }
  searchPlaceholder?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [q, setQ] = useState(searchParams.get('q') ?? '')

  function pushQuery(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (!value) params.delete(key)
      else params.set(key, value)
    }
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-end gap-3 text-sm">
      <p className="text-muted-foreground">
        Sayfa {meta.page} / {meta.totalPages} — toplam {meta.total} (max {MAX_PAGE_SIZE}/sayfa)
      </p>
      {searchPlaceholder && (
        <form
          className="flex gap-2 items-center"
          onSubmit={(e) => {
            e.preventDefault()
            pushQuery({ q: q.trim() || undefined, page: '1' })
          }}
        >
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="rounded border border-border px-2 py-1 text-sm min-w-[200px]"
          />
          <Button type="submit" size="sm" variant="outline">Ara</Button>
        </form>
      )}
      <div className="flex gap-2">
        {meta.page > 1 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => pushQuery({ page: String(meta.page - 1) })}
          >
            Önceki
          </Button>
        )}
        {meta.page < meta.totalPages && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => pushQuery({ page: String(meta.page + 1) })}
          >
            Sonraki
          </Button>
        )}
      </div>
    </div>
  )
}
