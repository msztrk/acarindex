'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  journalId: string
  status: string
}

export function JournalPublishButton({ journalId, status }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(status === 'published')

  if (done || status === 'published') {
    return <p className="text-sm text-muted-foreground">Dergi yayında.</p>
  }

  if (status !== 'draft' && status !== 'pending_publication') {
    return (
      <p className="text-sm text-muted-foreground">
        Bu durumdaki dergi yayınlanamaz ({status}).
      </p>
    )
  }

  async function publish() {
    setError(null)
    setLoading(true)
    try {
      const csrfRes = await fetch('/api/auth/csrf')
      const { csrfToken } = await csrfRes.json()
      const res = await fetch(`/api/admin/journals/${journalId}/publish`, {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Yayınlama başarısız.')
        return
      }
      setDone(true)
      router.refresh()
    } catch {
      setError('Bağlantı hatası.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={loading}
        onClick={publish}
        className="rounded border border-green-600/40 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50 disabled:opacity-50 dark:text-green-400 dark:hover:bg-green-950/30"
      >
        {loading ? '…' : 'Yayınla'}
      </button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  )
}
