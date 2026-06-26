'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { postWithCsrf } from '@/lib/auth/csrf-client'
import { AuthPageShell } from '@/components/layout/AuthPageShell'

interface LegalDoc {
  id: string
  type: string
  version: string
  required: boolean
}

export function RegisterForm({ publicRegistration }: { publicRegistration: boolean }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [name, setName] = useState('')
  const [docs, setDocs] = useState<LegalDoc[]>([])
  const [accepted, setAccepted] = useState<Record<string, boolean>>({})
  const [marketing, setMarketing] = useState(false)
  const [csrf, setCsrf] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/auth/csrf').then((r) => r.json()).then((d) => setCsrf(d.csrfToken ?? ''))
    fetch('/api/auth/register')
      .then((r) => r.json())
      .then((d) => {
        setDocs(d.documents ?? [])
        const init: Record<string, boolean> = {}
        for (const doc of d.documents ?? []) {
          if (doc.required) init[doc.id] = false
        }
        setAccepted(init)
      })
  }, [])

  if (!publicRegistration) {
    return (
      <AuthPageShell title="Üyelik">
        <p className="text-sm text-muted-foreground">Üyelik yakında açılacak.</p>
        <Link
          href="/login"
          className="text-sm text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          Giriş yap
        </Link>
      </AuthPageShell>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== password2) {
      setError('Parolalar eşleşmiyor.')
      return
    }
    const acceptedIds = Object.entries(accepted)
      .filter(([, v]) => v)
      .map(([id]) => id)
    setLoading(true)
    try {
      const res = await postWithCsrf('/api/auth/register', {
        email,
        password,
        name,
        acceptedDocumentIds: acceptedIds,
        marketingOptIn: marketing,
        website: '',
      })
      const data = (await res.json()) as { error?: string; requiresVerification?: boolean }
      if (!res.ok) {
        setError(data.error ?? 'Kayıt başarısız.')
        return
      }
      if (data.requiresVerification) {
        router.push('/verify-email/request')
      } else {
        router.push('/hesabim')
      }
      router.refresh()
    } catch {
      setError('Bağlantı hatası.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageShell title="Kayıt Ol">
      <form onSubmit={submit} className="space-y-4 min-w-0">
        {error && <p className="text-sm text-destructive break-words" role="alert">{error}</p>}
        <input type="text" name="website" className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="reg-name">Ad (isteğe bağlı)</label>
          <Input id="reg-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="w-full min-w-0" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="reg-email">E-posta</label>
          <Input id="reg-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="w-full min-w-0" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="reg-password">Parola</label>
          <Input id="reg-password" type="password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="w-full min-w-0" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="reg-password2">Parola tekrar</label>
          <Input id="reg-password2" type="password" required value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" className="w-full min-w-0" />
        </div>
        {docs.map((doc) => (
          <label key={doc.id} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={accepted[doc.id] ?? false}
              onChange={(e) => setAccepted((prev) => ({ ...prev, [doc.id]: e.target.checked }))}
              className="mt-0.5"
            />
            <span>
              {doc.type === 'terms' && 'Kullanım şartlarını kabul ediyorum (sürüm ' + doc.version + ')'}
              {doc.type === 'privacy' && 'Gizlilik politikasını kabul ediyorum (sürüm ' + doc.version + ')'}
              {doc.type === 'marketing' && 'Pazarlama iletişimine izin veriyorum'}
              {doc.required && ' *'}
            </span>
          </label>
        ))}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
          Pazarlama e-postaları (isteğe bağlı)
        </label>
        <Button type="submit" disabled={loading || !csrf} className="w-full min-w-0">
          {loading ? 'Kaydediliyor…' : 'Kayıt Ol'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Hukuki metinler placeholder; nihai metinler operasyon tarafından sağlanacak.
        </p>
      </form>
    </AuthPageShell>
  )
}
