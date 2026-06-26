'use client'



import { useState } from 'react'

import { Button } from '@/components/ui/button'

import { postWithCsrf } from '@/lib/auth/csrf-client'



export function ChangePasswordForm() {

  const [currentPassword, setCurrentPassword] = useState('')

  const [newPassword, setNewPassword] = useState('')

  const [revokeOther, setRevokeOther] = useState(true)

  const [error, setError] = useState('')

  const [success, setSuccess] = useState(false)

  const [loading, setLoading] = useState(false)



  async function submit(e: React.FormEvent) {

    e.preventDefault()

    setError('')

    setSuccess(false)

    setLoading(true)

    try {

      const res = await postWithCsrf('/api/auth/change-password', {

        currentPassword,

        newPassword,

        revokeOtherSessions: revokeOther,

      })

      const data = (await res.json()) as { error?: string; ok?: boolean }

      if (!res.ok) {

        setError(data.error ?? 'Parola değiştirilemedi.')

        return

      }

      setSuccess(true)

      setCurrentPassword('')

      setNewPassword('')

    } catch {

      setError('Bağlantı hatası.')

    } finally {

      setLoading(false)

    }

  }



  return (

    <div className="rounded-xl border border-border/80 bg-surface shadow-sm p-4 space-y-4">

      <form onSubmit={submit} className="space-y-3">

        <div>

          <label className="text-sm text-muted-foreground" htmlFor="current-password">

            Mevcut parola

          </label>

          <input

            id="current-password"

            type="password"

            autoComplete="current-password"

            required

            className="mt-1 w-full rounded-lg border border-border/80 px-3 py-2 text-sm bg-background"

            value={currentPassword}

            onChange={(e) => setCurrentPassword(e.target.value)}

          />

        </div>

        <div>

          <label className="text-sm text-muted-foreground" htmlFor="new-password">

            Yeni parola

          </label>

          <input

            id="new-password"

            type="password"

            autoComplete="new-password"

            required

            minLength={12}

            className="mt-1 w-full rounded-lg border border-border/80 px-3 py-2 text-sm bg-background"

            value={newPassword}

            onChange={(e) => setNewPassword(e.target.value)}

          />

          <p className="text-xs text-muted-foreground mt-1">

            En az 12 karakter; büyük harf, küçük harf ve rakam.

          </p>

        </div>

        <label className="flex items-center gap-2 text-sm">

          <input

            type="checkbox"

            checked={revokeOther}

            onChange={(e) => setRevokeOther(e.target.checked)}

          />

          Diğer oturumları sonlandır (bu cihaz hariç)

        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {success && (

          <p className="text-sm text-green-700">

            Parola güncellendi. Diğer oturumlar iptal edildi.

          </p>

        )}

        <Button type="submit" disabled={loading}>

          {loading ? 'Kaydediliyor…' : 'Parolayı değiştir'}

        </Button>

      </form>

      {success && (

        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">

          <p className="font-medium">İlk yönetici credential dosyası</p>

          <p>

            Parolayı doğruladıktan sonra beta sunucuda (yalnızca sizin onayınızla) şu komutla

            silebilirsiniz:

          </p>

          <code className="block bg-white/80 p-2 rounded text-[11px]">

            test -f /root/.faz6a-admin-credentials &amp;&amp; ls -l /root/.faz6a-admin-credentials

            &amp;&amp; shred -u /root/.faz6a-admin-credentials

          </code>

          <p>Bu dosyayı otomatik silmiyoruz; onayınız gerekir.</p>

        </div>

      )}

    </div>

  )

}


