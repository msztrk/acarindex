'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  id: string
  apiPath: string
}

export function AdminReviewActions({ id, apiPath }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<'approved' | 'rejected' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(status: 'approved' | 'rejected') {
    setError(null)
    setLoading(status)
    try {
      const csrfRes = await fetch('/api/auth/csrf')
      const { csrfToken } = await csrfRes.json()
      const res = await fetch(apiPath, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ id, status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'İşlem başarısız.')
        return
      }
      router.refresh()
    } catch {
      setError('Bağlantı hatası.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => submit('approved')}
          className="rounded border border-green-600/40 px-2 py-1 text-green-700 hover:bg-green-50 disabled:opacity-50 dark:text-green-400 dark:hover:bg-green-950/30"
        >
          {loading === 'approved' ? '…' : 'Onayla'}
        </button>
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => submit('rejected')}
          className="rounded border border-destructive/40 px-2 py-1 text-destructive hover:bg-destructive/5 disabled:opacity-50"
        >
          {loading === 'rejected' ? '…' : 'Reddet'}
        </button>
      </div>
      {error && <span className="text-destructive text-[11px]">{error}</span>}
    </div>
  )
}
