'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { postWithCsrf } from '@/lib/auth/csrf-client'

export function AccountLifecyclePanel() {
  const [password, setPassword] = useState('')
  const [deletion, setDeletion] = useState<{
    status: string
    scheduledFor: string
  } | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function loadStatus() {
    const res = await fetch('/api/auth/account')
    if (res.ok) {
      const data = (await res.json()) as { deletion: typeof deletion }
      setDeletion(data.deletion)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await fetch('/api/auth/account')
      if (cancelled || !res.ok) return
      const data = (await res.json()) as { deletion: typeof deletion }
      setDeletion(data.deletion)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function run(action: 'deactivate' | 'request_deletion' | 'cancel_deletion') {
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const res = await postWithCsrf('/api/auth/account', { action, password })
      const data = (await res.json()) as { error?: string; scheduledFor?: string }
      if (!res.ok) {
        setError(data.error ?? 'İşlem başarısız.')
        return
      }
      if (action === 'cancel_deletion') {
        setMessage('Silme talebi iptal edildi.')
        await loadStatus()
      } else {
        setMessage('İşlem tamamlandı. Yönlendiriliyorsunuz…')
        window.location.href = '/login'
      }
    } catch {
      setError('Bağlantı hatası.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-border/80 bg-surface shadow-sm p-4 space-y-4">
      <h3 className="text-sm font-semibold">Hesap durumu</h3>
      {deletion && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">
          Silme talebi planlandı: {new Date(deletion.scheduledFor).toLocaleString('tr-TR')}
        </p>
      )}
      <div className="space-y-2">
        <label className="text-sm" htmlFor="account-password">Parola doğrulama</label>
        <input
          id="account-password"
          type="password"
          autoComplete="current-password"
          className="w-full rounded-lg border border-border/80 px-3 py-2 text-sm bg-background"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => run('deactivate')}>
          Hesabı geçici pasifleştir
        </Button>
        <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => run('request_deletion')}>
          Hesap silme talebi
        </Button>
        {deletion && (
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => run('cancel_deletion')}>
            Silme talebini iptal et
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Silme talebi fiziksel silme değildir; bekleme süresi sonunda operasyon ekibi işler. Katalog verileri etkilenmez.
      </p>
    </div>
  )
}
