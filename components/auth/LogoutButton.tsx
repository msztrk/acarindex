'use client'

import { useEffect, useState } from 'react'
import { fetchCsrfToken } from '@/lib/auth/csrf-client'

export function LogoutButton() {
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
      window.location.href = '/'
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      className="text-sm text-muted-foreground hover:underline disabled:opacity-50"
    >
      {loading ? 'Çıkış…' : 'Çıkış yap'}
    </button>
  )
}
