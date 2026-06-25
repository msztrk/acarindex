'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { postWithCsrf } from '@/lib/auth/csrf-client'

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
      <div className="max-w-md mx-auto p-6 border rounded-lg bg-card">
        <p className="text-sm text-destructive">Geçersiz veya eksik bağlantı.</p>
        <Link href="/forgot-password" className="text-sm underline">Yeni talep oluştur</Link>
      </div>
    )
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto p-6 border rounded-lg bg-card space-y-2">
        <p className="text-sm text-green-700">Parolanız güncellendi. Tüm oturumlar kapatıldı.</p>
        <Link href="/login" className="text-sm underline">Giriş yap</Link>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="max-w-md mx-auto space-y-4 border rounded-lg p-6 bg-card">
      <h1 className="text-xl font-semibold">Yeni parola</h1>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Input type="password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="Yeni parola" />
      <Input type="password" required value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" placeholder="Parola tekrar" />
      <Button type="submit" disabled={loading} className="w-full">Parolayı kaydet</Button>
    </form>
  )
}
