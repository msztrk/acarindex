'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { deleteWithCsrf, postWithCsrf } from '@/lib/auth/csrf-client'

export function ReadingListsManager({
  initialLists,
}: {
  initialLists: Array<{ id: string; name: string; itemCount: number }>
}) {
  const [lists, setLists] = useState(initialLists)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function createList() {
    if (!name.trim()) return
    setBusy(true)
    setError('')
    try {
      const res = await postWithCsrf('/api/user/reading-lists', { name })
      const data = (await res.json()) as { error?: string; listId?: string }
      if (!res.ok) {
        setError(data.error ?? 'Oluşturulamadı.')
        return
      }
      setLists((prev) => [
        { id: data.listId!, name: name.trim(), itemCount: 0 },
        ...prev,
      ])
      setName('')
    } catch {
      setError('Bağlantı hatası.')
    } finally {
      setBusy(false)
    }
  }

  async function removeList(listId: string) {
    if (!confirm('Bu okuma listesini silmek istediğinize emin misiniz?')) return
    setBusy(true)
    try {
      await deleteWithCsrf(`/api/user/reading-lists/${listId}`, {})
      setLists((prev) => prev.filter((l) => l.id !== listId))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-2 max-w-md">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Yeni liste adı"
          maxLength={120}
          className="flex-1 rounded-lg border border-border/80 px-3 py-2 text-sm bg-background"
          aria-label="Liste adı"
        />
        <Button type="button" disabled={busy || !name.trim()} onClick={createList}>
          Oluştur
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {lists.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz okuma listesi yok.</p>
      ) : (
        <ul className="space-y-2">
          {lists.map((l) => (
            <li
              key={l.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 p-3 text-sm"
            >
              <Link href={`/hesabim/listeler/${l.id}`} className="font-medium text-primary hover:text-accent no-underline">
                {l.name}
              </Link>
              <span className="text-muted-foreground">{l.itemCount} makale</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => removeList(l.id)}
              >
                Sil
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
