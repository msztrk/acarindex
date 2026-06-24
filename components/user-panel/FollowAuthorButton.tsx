'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { deleteWithCsrf, postWithCsrf } from '@/lib/auth/csrf-client'

export function FollowAuthorButton({
  authorId,
  initialFollowing,
  canFollow,
  isProvisional,
  loginHref,
}: {
  authorId: number
  initialFollowing: boolean
  canFollow: boolean
  isProvisional: boolean
  loginHref: string
}) {
  const [following, setFollowing] = useState(initialFollowing)
  const [busy, setBusy] = useState(false)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [error, setError] = useState('')

  if (isProvisional || !canFollow) {
    return (
      <p className="text-xs text-muted-foreground max-w-md">
        Bu yazar profili henüz doğrulanmadı (provisional). Takip özelliği güvenilir kimlik
        oluşturulduktan sonra açılacaktır.
      </p>
    )
  }

  async function toggle() {
    setBusy(true)
    setError('')
    const prev = following
    setFollowing(!prev)
    try {
      const res = prev
        ? await deleteWithCsrf('/api/user/follows/authors', { authorId })
        : await postWithCsrf('/api/user/follows/authors', { authorId })
      if (res.status === 401) {
        setFollowing(prev)
        setNeedsLogin(true)
        return
      }
      if (!res.ok) {
        setFollowing(prev)
        const data = (await res.json()) as { error?: string }
        setError(data.error ?? 'İşlem başarısız.')
      }
    } catch {
      setFollowing(prev)
      setError('Bağlantı hatası.')
    } finally {
      setBusy(false)
    }
  }

  if (needsLogin) {
    return (
      <Link href={loginHref} className="text-sm text-primary hover:underline">
        Takip için giriş yapın
      </Link>
    )
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        size="sm"
        variant={following ? 'secondary' : 'outline'}
        disabled={busy}
        onClick={toggle}
        aria-pressed={following}
      >
        {following ? 'Takip ediliyor' : 'Yazarı Takip Et'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
