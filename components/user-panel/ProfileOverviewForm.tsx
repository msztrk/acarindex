'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { patchWithCsrf } from '@/lib/auth/csrf-client'
import type { UserProfileDto } from '@/lib/user-panel/profile'

export interface CategoryOption {
  id: number
  name_tr: string | null
}

export function ProfileOverviewForm({
  initial,
  categories,
}: {
  initial: UserProfileDto
  categories: CategoryOption[]
}) {
  const [profile, setProfile] = useState(initial)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const categoryLabels = categories
    .map((c) => c.name_tr)
    .filter((v): v is string => Boolean(v))

  function toggleInterestArea(label: string) {
    setProfile((p) => {
      const selected = p.interestAreas.includes(label)
      return {
        ...p,
        interestAreas: selected
          ? p.interestAreas.filter((v) => v !== label)
          : [...p.interestAreas, label],
      }
    })
  }

  async function save() {
    setBusy(true)
    setMessage('')
    try {
      const res = await patchWithCsrf('/api/user/profile', { ...profile })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setMessage(data?.error ?? 'Kaydedilemedi.')
        return
      }
      const data = (await res.json()) as UserProfileDto
      setProfile(data)
      setMessage('Bilgiler kaydedildi.')
    } catch {
      setMessage('Bağlantı hatası.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-border/80 bg-surface shadow-sm p-5 sm:p-6 space-y-5">
      <div>
        <h2 className="text-lg font-serif font-semibold">Genel Bilgiler</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Adınız, kurumunuz ve akademik ilgi alanlarınızı güncelleyin.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="profile-first-name" className="text-sm font-medium">
            Ad
          </label>
          <Input
            id="profile-first-name"
            value={profile.firstName}
            onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))}
            autoComplete="given-name"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="profile-last-name" className="text-sm font-medium">
            Soyad
          </label>
          <Input
            id="profile-last-name"
            value={profile.lastName}
            onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))}
            autoComplete="family-name"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="profile-institution" className="text-sm font-medium">
          Çalıştığı kurum
        </label>
        <Input
          id="profile-institution"
          value={profile.institution}
          onChange={(e) => setProfile((p) => ({ ...p, institution: e.target.value }))}
          autoComplete="organization"
          placeholder="Üniversite veya kurum adı"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="profile-science-field" className="text-sm font-medium">
          Bilim alanı
        </label>
        {categoryLabels.length > 0 ? (
          <select
            id="profile-science-field"
            value={profile.scienceField}
            onChange={(e) => setProfile((p) => ({ ...p, scienceField: e.target.value }))}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Seçiniz</option>
            {categoryLabels.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        ) : (
          <Input
            id="profile-science-field"
            value={profile.scienceField}
            onChange={(e) => setProfile((p) => ({ ...p, scienceField: e.target.value }))}
            placeholder="Bilim alanı"
          />
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">İlgi alanları</p>
        {categoryLabels.length > 0 ? (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {categoryLabels.map((label) => (
              <li key={label} className="flex items-start gap-2 text-sm">
                <input
                  id={`interest-${label}`}
                  type="checkbox"
                  className="mt-1"
                  checked={profile.interestAreas.includes(label)}
                  onChange={() => toggleInterestArea(label)}
                />
                <label htmlFor={`interest-${label}`}>{label}</label>
              </li>
            ))}
          </ul>
        ) : (
          <Input
            value={profile.interestAreas.join(', ')}
            onChange={(e) =>
              setProfile((p) => ({
                ...p,
                interestAreas: e.target.value
                  .split(',')
                  .map((v) => v.trim())
                  .filter(Boolean),
              }))
            }
            placeholder="Virgülle ayırarak yazın"
          />
        )}
      </div>

      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      <Button type="button" disabled={busy} onClick={save}>
        {busy ? 'Kaydediliyor…' : 'Bilgileri kaydet'}
      </Button>
    </section>
  )
}
