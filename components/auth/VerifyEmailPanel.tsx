'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { postWithCsrf } from '@/lib/auth/csrf-client'

export function VerifyEmailPanel() {
  const params = useSearchParams()
  const token = params.get('token')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [verified, setVerified] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) return
    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = (await res.json()) as { error?: string }
        if (res.ok) setVerified(true)
        else setError(data.error ?? 'Doğrulama başarısız.')
      })
      .catch(() => setError('Bağlantı hatası.'))
  }, [token])

  async function resend(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const res = await postWithCsrf('/api/auth/resend-verification', { email })
      const data = (await res.json()) as { message?: string }
      setMessage(data.message ?? 'Talep alındı.')
    } catch {
      setError('Bağlantı hatası.')
    } finally {
      setLoading(false)
    }
  }

  if (verified) {
    return (
      <div className="max-w-md mx-auto p-6 border rounded-lg bg-card">
        <p className="text-sm text-green-700">E-posta adresiniz doğrulandı.</p>
        <Link href="/hesabim" className="text-sm underline">Hesabıma git</Link>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      {token && error && (
        <div className="p-4 border rounded-lg bg-card text-sm text-destructive">{error}</div>
      )}
      <form onSubmit={resend} className="space-y-4 border rounded-lg p-6 bg-card">
        <h1 className="text-xl font-semibold">E-posta doğrulama</h1>
        <p className="text-sm text-muted-foreground">Doğrulama e-postasını tekrar göndermek için adresinizi girin.</p>
        {message && <p className="text-sm text-green-700">{message}</p>}
        {error && !token && <p className="text-sm text-destructive">{error}</p>}
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <Button type="submit" disabled={loading} className="w-full">Tekrar gönder</Button>
      </form>
    </div>
  )
}
