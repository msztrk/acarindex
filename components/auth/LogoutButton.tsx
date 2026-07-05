'use client'

import { useEffect, useState } from 'react'
import { fetchCsrfToken } from '@/lib/auth/csrf-client'
import { useUi } from '@/components/i18n/LocaleProvider'

export function LogoutButton() {
  const { m, lp } = useUi()
  const [csrf, setCsrf] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchCsrfToken().then(setCsrf)
  }, [])

  async function logout() {
    if (loading) return
    setLoading(true)
    try {
      const token = csrf || (await fetchCsrfToken())
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'x-csrf-token': token },
      })
      window.location.href = lp('/')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      className="text-[0.9375rem] text-muted-foreground hover:underline disabled:opacity-50"
    >
      {loading ? m.auth.loggingOut : m.auth.logout}
    </button>
  )
}
