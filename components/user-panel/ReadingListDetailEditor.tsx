'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { patchWithCsrf, deleteWithCsrf } from '@/lib/auth/csrf-client'
import { READING_LIST_NAME_MAX } from '@/lib/user-panel/config'

export type ReadingListItemDto = {
  id: string
  position: number
  articleId: number
  article: {
    id: number
    slug: string
    legacyJournalSlug: string
    titleTr: string | null
    titleEn: string | null
    publishedYear: number | null
    journalSlug?: string | null
    journalTitleTr?: string | null
  } | null
}

export function ReadingListDetailEditor({
  listId,
  initialName,
  initialItems,
}: {
  listId: string
  initialName: string
  initialItems: ReadingListItemDto[]
}) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [editName, setEditName] = useState(initialName)
  const [editingName, setEditingName] = useState(false)
  const [items, setItems] = useState(initialItems)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function saveName() {
    const trimmed = editName.trim()
    if (!trimmed) {
      setError('Liste adı boş olamaz.')
      return
    }
    if (trimmed.length > READING_LIST_NAME_MAX) {
      setError(`Liste adı en fazla ${READING_LIST_NAME_MAX} karakter olabilir.`)
      return
    }
    setBusy(true)
    setError('')
    const prev = name
    setName(trimmed)
    try {
      const res = await patchWithCsrf(`/api/user/reading-lists/${listId}`, { name: trimmed })
      if (!res.ok) {
        setName(prev)
        const data = (await res.json()) as { error?: string }
        setError(data.error ?? 'Ad güncellenemedi.')
        return
      }
      setEditingName(false)
    } catch {
      setName(prev)
      setError('Bağlantı hatası.')
    } finally {
      setBusy(false)
    }
  }

  async function removeItem(articleId: number) {
    if (!confirm('Bu makaleyi listeden çıkarmak istediğinize emin misiniz?')) return
    setBusy(true)
    setError('')
    const prev = items
    setItems((cur) => cur.filter((i) => i.articleId !== articleId))
    try {
      const res = await deleteWithCsrf(`/api/user/reading-lists/${listId}/items`, { articleId })
      if (!res.ok) {
        setItems(prev)
        const data = (await res.json()) as { error?: string }
        setError(data.error ?? 'Makale çıkarılamadı.')
      }
    } catch {
      setItems(prev)
      setError('Bağlantı hatası.')
    } finally {
      setBusy(false)
    }
  }

  async function reorder(newOrder: ReadingListItemDto[]) {
    setBusy(true)
    setError('')
    const prev = items
    setItems(newOrder)
    try {
      const res = await patchWithCsrf(`/api/user/reading-lists/${listId}/items`, {
        itemIds: newOrder.map((i) => i.id),
      })
      if (!res.ok) {
        setItems(prev)
        const data = (await res.json()) as { error?: string }
        setError(data.error ?? 'Sıralama güncellenemedi.')
      }
    } catch {
      setItems(prev)
      setError('Bağlantı hatası.')
    } finally {
      setBusy(false)
    }
  }

  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const next = [...items]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    reorder(next)
  }

  async function deleteList() {
    if (
      !confirm(
        'Bu okuma listesini silmek istediğinize emin misiniz? Makaleler katalogdan silinmeyecek.',
      )
    ) {
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await deleteWithCsrf(`/api/user/reading-lists/${listId}`, {})
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        setError(data.error ?? 'Liste silinemedi.')
        return
      }
      router.push('/hesabim/listeler')
      router.refresh()
    } catch {
      setError('Bağlantı hatası.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        {editingName ? (
          <div className="flex flex-col sm:flex-row gap-2 flex-1 max-w-xl">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={READING_LIST_NAME_MAX}
              className="flex-1 rounded border border-border px-3 py-2 text-sm"
              aria-label="Liste adı"
              disabled={busy}
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={busy} onClick={saveName}>
                Kaydet
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setEditName(name)
                  setEditingName(false)
                  setError('')
                }}
              >
                İptal
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-medium break-words">{name}</h2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setEditingName(true)}
              aria-label="Liste adını değiştir"
            >
              Adı değiştir
            </Button>
          </div>
        )}
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={deleteList}
          aria-label="Okuma listesini sil"
        >
          Listeyi sil
        </Button>
      </div>

      <Link href="/hesabim/listeler" className="text-sm text-primary hover:underline">
        ← Tüm listeler
      </Link>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Bu listede makale yok.</p>
      ) : (
        <ol className="space-y-2" aria-label="Okuma listesi makaleleri">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center gap-2 rounded border p-3 text-sm"
            >
              <div className="flex-1 min-w-0">
                {item.article ? (
                  <Link
                    href={`/${item.article.legacyJournalSlug}/${item.article.slug}-${item.article.id}`}
                    className="text-primary hover:underline line-clamp-2 break-words"
                  >
                    {item.article.titleTr ?? item.article.titleEn}
                  </Link>
                ) : (
                  <span>Makale #{item.articleId}</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || index === 0}
                  onClick={() => moveItem(index, -1)}
                  aria-label={`${index + 1}. makaleyi yukarı taşı`}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || index === items.length - 1}
                  onClick={() => moveItem(index, 1)}
                  aria-label={`${index + 1}. makaleyi aşağı taşı`}
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => removeItem(item.articleId)}
                  aria-label={`${index + 1}. makaleyi listeden çıkar`}
                >
                  Çıkar
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
