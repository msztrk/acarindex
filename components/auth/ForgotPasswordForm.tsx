'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { postWithCsrf } from '@/lib/auth/csrf-client'

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
    <form onSubmit={submit} className="max-w-md mx-auto space-y-4 border rounded-lg p-6 bg-card">
      <h1 className="text-xl font-semibold">Şifremi unuttum</h1>
      <p className="text-sm text-muted-foreground">
        E-posta adresinizi girin. Kayıtlıysa sıfırlama bağlantısı gönderilir.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}
      <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="E-posta" />
      <Button type="submit" disabled={loading} className="w-full">Gönder</Button>
      <Link href="/login" className="text-sm text-primary underline">Girişe dön</Link>
    </form>
  )
}
