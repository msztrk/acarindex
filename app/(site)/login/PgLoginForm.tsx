'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthPageShell } from '@/components/layout/AuthPageShell'

export default function PgLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/hesabim'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [csrfToken, setCsrfToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/auth/csrf')
      .then((r) => r.json())
      .then((d) => setCsrfToken(d.csrfToken ?? ''))
      .catch(() => setError('Oturum başlatılamadı.'))
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Giriş başarısız.')
        return
      }
      router.push(next)
      router.refresh()
    } catch {
      setError('Bağlantı hatası.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageShell title="Giriş Yap" description="AcarIndex hesabınızla giriş yapın.">
      <form onSubmit={onSubmit} className="space-y-4 min-w-0">
        {error && (
          <p className="text-sm text-destructive break-words" role="alert">{error}</p>
        )}
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="email">E-posta</label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full min-w-0"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="password">Parola</label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full min-w-0"
          />
        </div>
        <Button type="submit" disabled={loading || !csrfToken} className="w-full min-w-0">
          {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
        </Button>
        <p className="text-sm text-center flex flex-wrap justify-center gap-x-3 gap-y-1">
          <Link
            href="/forgot-password"
            className="text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            Şifremi unuttum
          </Link>
          <Link
            href="/register"
            className="text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            Kayıt ol
          </Link>
        </p>
      </form>
    </AuthPageShell>
  )
}
