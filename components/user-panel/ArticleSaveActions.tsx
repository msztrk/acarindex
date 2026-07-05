'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { deleteWithCsrf, postWithCsrf } from '@/lib/auth/csrf-client'
import { useUi } from '@/components/i18n/LocaleProvider'

type ListOption = { id: string; name: string; itemCount: number }

export function ArticleSaveActions({
  articleId,
  initialSaved,
  initialLists,
  authEnabled,
  isLoggedIn,
  loginHref,
}: {
  articleId: number
  initialSaved: boolean
  initialLists: ListOption[]
  authEnabled: boolean
  isLoggedIn: boolean
  loginHref: string
}) {
  const { m, lp } = useUi()
  const [saved, setSaved] = useState(initialSaved)
  const [lists, setLists] = useState(initialLists)
  const [modalOpen, setModalOpen] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function refreshState() {
    const res = await fetch(`/api/user/articles/${articleId}/state`, { credentials: 'same-origin' })
    if (!res.ok) return
    const data = (await res.json()) as { saved: boolean; lists: ListOption[] }
    setSaved(data.saved)
    setLists(data.lists)
  }

  if (!authEnabled) return null

  if (!isLoggedIn) {
    return (
      <Link href={loginHref} className="text-[0.9375rem] text-primary hover:underline">
        {m.article.loginToSave}
      </Link>
    )
  }

  async function toggleSave() {
    setBusy(true)
    setError('')
    const prev = saved
    setSaved(!prev)
    try {
      const res = prev
        ? await deleteWithCsrf('/api/user/saved-articles', { articleId })
        : await postWithCsrf('/api/user/saved-articles', { articleId })
      if (!res.ok) {
        setSaved(prev)
        const data = (await res.json()) as { error?: string }
        setError(data.error ?? 'İşlem başarısız.')
      }
    } catch {
      setSaved(prev)
      setError('Bağlantı hatası.')
    } finally {
      setBusy(false)
    }
  }

  async function addToList(listId: string) {
    setBusy(true)
    setError('')
    try {
      const res = await postWithCsrf(`/api/user/reading-lists/${listId}/items`, { articleId })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        setError(data.error ?? 'Listeye eklenemedi.')
      } else {
        await refreshState()
        setModalOpen(false)
      }
    } catch {
      setError('Bağlantı hatası.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant={saved ? 'secondary' : 'outline'}
        disabled={busy}
        onClick={toggleSave}
        aria-pressed={saved}
      >
        {saved ? m.article.saved : m.article.saveArticle}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => setModalOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={modalOpen}
      >
        {m.article.addToList}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Okuma listesi seç"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-background rounded-lg border shadow-lg w-full max-w-md p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-sm">Okuma listesine ekle</h2>
            {lists.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Henüz liste yok.{' '}
                <Link href={lp('/hesabim/listeler')} className="text-primary hover:underline">
                  Liste oluştur
                </Link>
              </p>
            ) : (
              <ul className="space-y-2">
                {lists.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      className="w-full text-left rounded border px-3 py-2 text-sm hover:bg-muted"
                      disabled={busy}
                      onClick={() => addToList(l.id)}
                    >
                      {l.name} <span className="text-muted-foreground">({l.itemCount})</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => setModalOpen(false)}>
              Kapat
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
