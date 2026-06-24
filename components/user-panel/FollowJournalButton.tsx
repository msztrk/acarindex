'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { deleteWithCsrf, postWithCsrf } from '@/lib/auth/csrf-client'

export function FollowJournalButton({
  journalId,
  initialFollowing,
  loginHref,
}: {
  journalId: number
  initialFollowing: boolean
  loginHref: string
}) {
  const [following, setFollowing] = useState(initialFollowing)
  const [busy, setBusy] = useState(false)
  const [needsLogin, setNeedsLogin] = useState(false)

  async function toggle() {
    setBusy(true)
    const prev = following
    setFollowing(!prev)
    try {
      const res = prev
        ? await deleteWithCsrf('/api/user/follows/journals', { journalId })
        : await postWithCsrf('/api/user/follows/journals', { journalId })
      if (res.status === 401) {
        setFollowing(prev)
        setNeedsLogin(true)
        return
      }
      if (!res.ok) setFollowing(prev)
    } catch {
      setFollowing(prev)
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
    <Button
      type="button"
      size="sm"
      variant={following ? 'secondary' : 'outline'}
      disabled={busy}
      onClick={toggle}
      aria-pressed={following}
    >
      {following ? 'Takip ediliyor' : 'Dergiyi Takip Et'}
    </Button>
  )
}
