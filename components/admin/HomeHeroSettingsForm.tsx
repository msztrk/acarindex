'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { patchWithCsrf } from '@/lib/auth/csrf-client'
import {
  DEFAULT_HOME_HERO_TITLE,
  HOME_HERO_SUBTITLE_MAX,
  HOME_HERO_TITLE_MAX,
  type HomeHeroContent,
} from '@/lib/site-content/home-hero'

export function HomeHeroSettingsForm({ initial }: { initial: HomeHeroContent }) {
  const [title, setTitle] = useState(initial.title)
  const [subtitle, setSubtitle] = useState(initial.subtitle ?? '')
  const [saved, setSaved] = useState<HomeHeroContent>(initial)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await patchWithCsrf('/api/admin/site-content/home-hero', {
        title,
        subtitle: subtitle.trim() === '' ? null : subtitle,
      })
      const data = (await res.json()) as HomeHeroContent & { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Kayıt başarısız.')
        return
      }
      setSaved({ title: data.title, subtitle: data.subtitle })
      setTitle(data.title)
      setSubtitle(data.subtitle ?? '')
    } catch {
      setError('Bağlantı hatası.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-2xl">
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="hero-title">
          Ana sayfa hero başlığı
        </label>
        <Input
          id="hero-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={HOME_HERO_TITLE_MAX}
          placeholder={DEFAULT_HOME_HERO_TITLE}
        />
        <p className="text-xs text-muted-foreground">
          Maks. {HOME_HERO_TITLE_MAX} karakter. Boş bırakılırsa varsayılan metin kullanılır.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="hero-subtitle">
          Ana sayfa hero alt açıklaması
        </label>
        <Textarea
          id="hero-subtitle"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          maxLength={HOME_HERO_SUBTITLE_MAX}
          rows={3}
          placeholder="İsteğe bağlı kısa açıklama"
        />
        <p className="text-xs text-muted-foreground">
          Maks. {HOME_HERO_SUBTITLE_MAX} karakter. Düz metin; HTML kabul edilmez.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Ön izleme (yayında)
        </p>
        <p className="font-serif text-lg font-semibold text-foreground leading-snug">{saved.title}</p>
        {saved.subtitle && (
          <p className="text-sm text-muted-foreground leading-relaxed">{saved.subtitle}</p>
        )}
      </div>
    </form>
  )
}
