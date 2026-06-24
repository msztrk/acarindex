'use client'

import { useEffect, useState } from 'react'

export function LogoutButton() {
  const [csrf, setCsrf] = useState('')

  useEffect(() => {
    fetch('/api/auth/csrf')
      .then((r) => r.json())
      .then((d) => setCsrf(d.csrfToken ?? ''))
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'x-csrf-token': csrf },
    })
    window.location.href = '/'
  }

  return (
    <button type="button" onClick={logout} className="text-sm text-muted-foreground hover:underline">
      Çıkış yap
    </button>
  )
}
