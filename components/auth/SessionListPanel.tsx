'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { deleteWithCsrf } from '@/lib/auth/csrf-client'

interface SessionRow {
  id: string
  isCurrent: boolean
  createdAt: string
  lastUsedAt: string | null
  deviceHint: string
}

export function SessionListPanel() {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  async function load() {
    const res = await fetch('/api/auth/sessions')
    if (!res.ok) {
      setError('Oturumlar yüklenemedi.')
      return
    }
    const data = (await res.json()) as { sessions: SessionRow[] }
    setSessions(data.sessions)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await fetch('/api/auth/sessions')
      if (cancelled) return
      if (!res.ok) {
        setError('Oturumlar yüklenemedi.')
        return
      }
      const data = (await res.json()) as { sessions: SessionRow[] }
      setSessions(data.sessions)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function revokeOne(id: string) {
    setBusy(id)
    setError('')
    try {
      const res = await deleteWithCsrf(`/api/auth/sessions/${id}`, {})
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        setError(data.error ?? 'Oturum kapatılamadı.')
        return
      }
      await load()
    } finally {
      setBusy('')
    }
  }

  async function revokeOthers() {
    setBusy('all')
    setError('')
    try {
      const res = await deleteWithCsrf('/api/auth/sessions', {})
      if (!res.ok) {
        setError('Oturumlar kapatılamadı.')
        return
      }
      await load()
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="rounded-xl border border-border/80 bg-surface shadow-sm p-4 space-y-3">
      <h3 className="text-sm font-semibold">Aktif oturumlar</h3>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ul className="space-y-2 text-sm">
        {sessions.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
            <div>
              <span className="font-medium">{s.deviceHint}</span>
              {s.isCurrent && (
                <span className="ml-2 text-xs text-muted-foreground">(bu cihaz)</span>
              )}
              <p className="text-xs text-muted-foreground">
                Oluşturulma: {new Date(s.createdAt).toLocaleString('tr-TR')}
                {s.lastUsedAt && ` · Son kullanım: ${new Date(s.lastUsedAt).toLocaleString('tr-TR')}`}
              </p>
            </div>
            {!s.isCurrent && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy !== ''}
                onClick={() => revokeOne(s.id)}
              >
                Kapat
              </Button>
            )}
          </li>
        ))}
      </ul>
      <Button type="button" variant="outline" size="sm" disabled={busy !== ''} onClick={revokeOthers}>
        Diğer tüm oturumları kapat
      </Button>
    </div>
  )
}
