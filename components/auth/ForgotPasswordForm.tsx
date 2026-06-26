'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { postWithCsrf } from '@/lib/auth/csrf-client'
import { AuthPageShell } from '@/components/layout/AuthPageShell'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const res = await postWithCsrf('/api/auth/forgot-password', { email })
      const data = (await res.json()) as { message?: string }
      setMessage(data.message ?? 'Talep alındı.')
    } catch {
      setError('Bağlantı hatası.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageShell
      title="Şifremi unuttum"
      description="E-posta adresinizi girin. Kayıtlıysa sıfırlama bağlantısı gönderilir."
    >
      <form onSubmit={submit} className="space-y-4 min-w-0">
        {error && <p className="text-sm text-destructive break-words" role="alert">{error}</p>}
        {message && <p className="text-sm text-green-800 break-words" role="status">{message}</p>}
        <div className="space-y-2">
          <label htmlFor="forgot-email" className="text-sm font-medium">E-posta</label>
          <Input
            id="forgot-email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="ornek@email.com"
            className="w-full min-w-0"
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full min-w-0">
          {loading ? 'Gönderiliyor…' : 'Gönder'}
        </Button>
        <Link
          href="/login"
          className="text-sm text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          Girişe dön
        </Link>
      </form>
    </AuthPageShell>
  )
}
