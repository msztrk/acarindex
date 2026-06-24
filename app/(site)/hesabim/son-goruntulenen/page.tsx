'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { deleteWithCsrf } from '@/lib/auth/csrf-client'

type Row = {
  entityType: string
  entityId: number
  viewedAt: string
  label: string
  href: string | null
}

export default function SonGoruntulenenPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/user/recent-views', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .finally(() => setLoading(false))
  }, [])

  async function clearAll() {
    if (!confirm('Tüm görüntüleme geçmişini silmek istediğinize emin misiniz?')) return
    await deleteWithCsrf('/api/user/recent-views', {})
    setRows([])
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Son Görüntülediklerim</h2>
        {rows.length > 0 && (
          <Button type="button" size="sm" variant="outline" onClick={clearAll}>
            Geçmişi temizle
          </Button>
        )}
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Yükleniyor…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz kayıt yok.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rows.map((r) => (
            <li key={`${r.entityType}-${r.entityId}`} className="flex justify-between gap-2 border rounded p-2">
              {r.href ? (
                <Link href={r.href} className="text-primary hover:underline line-clamp-2">
                  {r.label}
                </Link>
              ) : (
                <span className="line-clamp-2">{r.label}</span>
              )}
              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(r.viewedAt).toLocaleString('tr-TR')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
