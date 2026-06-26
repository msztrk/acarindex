'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { postWithCsrf } from '@/lib/auth/csrf-client'
import { AuthPageShell } from '@/components/layout/AuthPageShell'

export function ResetPasswordForm() {
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== password2) {
      setError('Parolalar eşleşmiyor.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await postWithCsrf('/api/auth/reset-password', { token, password })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Sıfırlama başarısız.')
        return
      }
      setSuccess(true)
    } catch {
      setError('Bağlantı hatası.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <AuthPageShell title="Parola sıfırlama">
        <p className="text-sm text-destructive break-words" role="alert">Geçersiz veya eksik bağlantı.</p>
        <Link
          href="/forgot-password"
          className="text-sm text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          Yeni talep oluştur
        </Link>
      </AuthPageShell>
    )
  }

  if (success) {
    return (
      <AuthPageShell title="Parola güncellendi">
        <p className="text-sm text-green-800 break-words" role="status">
          Parolanız güncellendi. Tüm oturumlar kapatıldı.
        </p>
        <Link
          href="/login"
          className="text-sm text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          Giriş yap
        </Link>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell title="Yeni parola">
      <form onSubmit={submit} className="space-y-4 min-w-0">
        {error && <p className="text-sm text-destructive break-words" role="alert">{error}</p>}
        <div className="space-y-2">
          <label htmlFor="reset-password-new" className="text-sm font-medium">Yeni parola</label>
          <Input
            id="reset-password-new"
            type="password"
            required
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="En az 12 karakter"
            className="w-full min-w-0"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="reset-password-confirm" className="text-sm font-medium">Parola tekrar</label>
          <Input
            id="reset-password-confirm"
            type="password"
            required
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            autoComplete="new-password"
            placeholder="Parolayı tekrar girin"
            className="w-full min-w-0"
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full min-w-0">
          {loading ? 'Kaydediliyor…' : 'Parolayı kaydet'}
        </Button>
      </form>
    </AuthPageShell>
  )
}
