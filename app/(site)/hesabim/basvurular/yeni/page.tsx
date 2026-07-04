'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CONTENT_KIND_LABELS } from '@/lib/applications/types'
import { JOURNAL_APPLICATION_ROUTE } from '@/lib/journal-applications/types'
import type { ContentApplicationKind } from '@prisma/client'

const KINDS: ContentApplicationKind[] = ['new_journal', 'announcement', 'data_correction']

export default function YeniBasvuruPage() {
  const router = useRouter()
  const [kind, setKind] = useState<ContentApplicationKind>('announcement')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (kind === 'new_journal') {
      router.push(JOURNAL_APPLICATION_ROUTE)
      return
    }

    setLoading(true)
    try {
      const csrfRes = await fetch('/api/auth/csrf')
      const { csrfToken } = await csrfRes.json()
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ kind, title: title.trim() || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Oluşturulamadı.')
        return
      }
      router.push(`/hesabim/basvurular/${data.application.id}`)
      router.refresh()
    } catch {
      setError('Bağlantı hatası.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg space-y-4">
      <Link href="/hesabim/basvurular" className="text-sm text-primary hover:underline">
        ← Başvurularım
      </Link>
      <h2 className="text-lg font-semibold">Yeni içerik başvurusu</h2>
      <p className="text-sm text-muted-foreground">
        Duyuru ve veri düzeltme başvuruları için taslak oluşturun. Yeni dergi başvurusu çok
        adımlı form üzerinden yapılır.
      </p>
      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label htmlFor="kind" className="block text-sm font-medium mb-1">
            Başvuru türü
          </label>
          <select
            id="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as ContentApplicationKind)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {CONTENT_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        {kind !== 'new_journal' && (
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-1">
              Başlık (isteğe bağlı)
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Taslak başvuru başlığı"
            />
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {loading ? 'Oluşturuluyor…' : kind === 'new_journal' ? 'Dergi formuna git' : 'Taslak oluştur'}
        </button>
      </form>
    </div>
  )
}
