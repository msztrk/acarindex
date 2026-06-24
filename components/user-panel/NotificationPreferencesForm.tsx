'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { patchWithCsrf } from '@/lib/auth/csrf-client'
import type { NotificationPrefsDto } from '@/lib/user-panel/notification-prefs'

const PREF_KEYS = [
  'followedJournalNewIssue',
  'followedAuthorNewArticle',
  'savedSearchAlert',
  'weeklyDigest',
  'productAnnouncements',
] as const satisfies readonly (keyof NotificationPrefsDto)[]

const LABELS: Record<keyof NotificationPrefsDto, string> = {
  followedJournalNewIssue: 'Takip edilen dergide yeni sayı',
  followedAuthorNewArticle: 'Takip edilen yazarda yeni makale',
  savedSearchAlert: 'Kayıtlı arama / anahtar kelime (taslak)',
  weeklyDigest: 'Haftalık özet',
  productAnnouncements: 'Ürün ve sistem duyuruları',
}

export function NotificationPreferencesForm({ initial }: { initial: NotificationPrefsDto }) {
  const [prefs, setPrefs] = useState(initial)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    setMessage('')
    try {
      const res = await patchWithCsrf('/api/user/notification-preferences', { ...prefs })
      if (!res.ok) {
        setMessage('Kaydedilemedi.')
        return
      }
      const data = (await res.json()) as NotificationPrefsDto
      setPrefs(data)
      setMessage('Tercihler kaydedildi.')
    } catch {
      setMessage('Bağlantı hatası.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-sm text-muted-foreground">
        Bu sprintte yalnızca tercihler saklanır; e-posta gönderimi henüz başlamadı.
        Pazarlama bildirimleri varsayılan kapalıdır.
      </p>
      <ul className="space-y-3">
        {PREF_KEYS.map((key) => (
          <li key={key} className="flex items-start gap-3 text-sm">
            <input
              id={`pref-${key}`}
              type="checkbox"
              className="mt-1"
              checked={prefs[key]}
              onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))}
            />
            <label htmlFor={`pref-${key}`}>{LABELS[key]}</label>
          </li>
        ))}
      </ul>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      <Button type="button" disabled={busy} onClick={save}>
        {busy ? 'Kaydediliyor…' : 'Tercihleri kaydet'}
      </Button>
    </div>
  )
}
