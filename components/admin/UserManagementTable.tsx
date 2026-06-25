'use client'



import { useState } from 'react'

import Link from 'next/link'

import { Button } from '@/components/ui/button'

import { APP_ROLES, type AppRole } from '@/lib/auth/roles'

import { deleteWithCsrf, postWithCsrf } from '@/lib/auth/csrf-client'



export type AdminUserRow = {
  id: string
  email: string
  name: string | null
  status: string
  emailVerified: string | null
  lastLoginAt: string | null
  roles: string[]
  activeSessionCount: number
  legalVersions: { terms?: string; privacy?: string }
  deletionRequestStatus: string | null
}



export function UserManagementTable({
  users,
  manageableRoles,
  panelSummaries = {},
  canAdminVerifyEmail = false,
}: {
  users: AdminUserRow[]
  manageableRoles: AppRole[]
  panelSummaries?: Record<
    string,
    {
      savedArticles: number
      readingLists: number
      followedJournals: number
      followedAuthors: number
    }
  >
  canAdminVerifyEmail?: boolean
}) {

  const [message, setMessage] = useState('')

  const [error, setError] = useState('')

  const [busy, setBusy] = useState('')



  async function runAction(label: string, fn: () => Promise<void>) {

    setBusy(label)

    setMessage('')

    setError('')

    try {

      await fn()

      setMessage('İşlem başarılı. Sayfa yenileniyor…')

      window.location.reload()

    } catch {

      setError('İşlem başarısız.')

    } finally {

      setBusy('')

    }

  }



  async function assignRole(userId: string, roleId: AppRole) {

    if (!confirm(`${roleId} rolünü eklemek istediğinize emin misiniz?`)) return

    await runAction(`assign-${userId}-${roleId}`, async () => {

      const res = await postWithCsrf(`/api/admin/users/${userId}/roles`, { roleId })

      const data = (await res.json()) as { error?: string }

      if (!res.ok) throw new Error(data.error)

    })

  }



  async function removeRole(userId: string, roleId: AppRole) {

    if (!confirm(`${roleId} rolünü kaldırmak istediğinize emin misiniz?`)) return

    await runAction(`remove-${userId}-${roleId}`, async () => {

      const res = await deleteWithCsrf(`/api/admin/users/${userId}/roles`, { roleId })

      const data = (await res.json()) as { error?: string }

      if (!res.ok) throw new Error(data.error)

    })

  }



  async function setStatus(userId: string, status: 'active' | 'disabled') {

    const label = status === 'disabled' ? 'pasif' : 'aktif'

    if (!confirm(`Hesabı ${label} yapmak istediğinize emin misiniz?`)) return

    await runAction(`status-${userId}`, async () => {

      const res = await postWithCsrf(`/api/admin/users/${userId}/status`, { status })

      const data = (await res.json()) as { error?: string }

      if (!res.ok) throw new Error(data.error)

    })

  }



  async function verifyEmailAdmin(userId: string) {
    if (!confirm('E-postayı doğrulanmış olarak işaretlemek istediğinize emin misiniz?')) return
    await runAction(`verify-${userId}`, async () => {
      const res = await postWithCsrf(`/api/admin/users/${userId}/verify-email`, {})
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error)
    })
  }

  const assignable = manageableRoles.filter((r) => r !== 'USER')



  return (

    <div className="space-y-3">

      {message && <p className="text-sm text-green-700">{message}</p>}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto">

        <table className="w-full text-sm border-collapse min-w-[720px]">

          <thead>

            <tr className="border-b text-left text-muted-foreground">

              <th className="py-2 pr-3">E-posta</th>

              <th className="py-2 pr-3">Roller</th>

              <th className="py-2 pr-3">Durum</th>

              <th className="py-2 pr-3">Doğrulama</th>

              <th className="py-2 pr-3">Son giriş</th>

              <th className="py-2 pr-3">Oturum</th>
              <th className="py-2 pr-3">Şartlar</th>
              <th className="py-2 pr-3">Silme talebi</th>
              <th className="py-2">İşlemler</th>

            </tr>

          </thead>

          <tbody>

            {users.map((u) => (

              <tr key={u.id} className="border-b align-top">

                <td className="py-3 pr-3">

                  <div className="font-medium">{u.email}</div>
                  <div className="text-xs text-muted-foreground">{u.name ?? '—'}</div>
                  {panelSummaries[u.id] && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Kayıt: {panelSummaries[u.id].savedArticles} · Liste:{' '}
                      {panelSummaries[u.id].readingLists} · Dergi:{' '}
                      {panelSummaries[u.id].followedJournals} · Yazar:{' '}
                      {panelSummaries[u.id].followedAuthors}
                    </p>
                  )}

                </td>

                <td className="py-3 pr-3">

                  <div className="flex flex-wrap gap-1">

                    {u.roles.map((r) => (

                      <span

                        key={r}

                        className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs"

                      >

                        {r}

                        {manageableRoles.includes(r as AppRole) && r !== 'USER' && (

                          <button

                            type="button"

                            className="text-muted-foreground hover:text-destructive"

                            disabled={busy !== ''}

                            onClick={() => removeRole(u.id, r as AppRole)}

                            aria-label={`${r} kaldır`}

                          >

                            ×

                          </button>

                        )}

                      </span>

                    ))}

                  </div>

                  <div className="mt-2 flex flex-wrap gap-1">

                    {assignable

                      .filter((r) => !u.roles.includes(r))

                      .map((r) => (

                        <Button

                          key={r}

                          type="button"

                          size="sm"

                          variant="outline"

                          disabled={busy !== ''}

                          onClick={() => assignRole(u.id, r)}

                        >

                          + {r}

                        </Button>

                      ))}

                  </div>

                </td>

                <td className="py-3 pr-3">{u.status}</td>

                <td className="py-3 pr-3">

                  {u.emailVerified

                    ? new Date(u.emailVerified).toLocaleDateString('tr-TR')

                    : 'Bekliyor'}

                </td>

                <td className="py-3 pr-3">
                  {u.lastLoginAt
                    ? new Date(u.lastLoginAt).toLocaleString('tr-TR')
                    : '—'}
                </td>
                <td className="py-3 pr-3">{u.activeSessionCount}</td>
                <td className="py-3 pr-3 text-xs">
                  {u.legalVersions.terms ? `Ş: ${u.legalVersions.terms}` : '—'}
                  {u.legalVersions.privacy ? ` · G: ${u.legalVersions.privacy}` : ''}
                </td>
                <td className="py-3 pr-3 text-xs">
                  {u.deletionRequestStatus ?? '—'}
                </td>
                <td className="py-3 space-y-2">

                  {u.status === 'active' ? (

                    <Button

                      type="button"

                      size="sm"

                      variant="outline"

                      disabled={busy !== ''}

                      onClick={() => setStatus(u.id, 'disabled')}

                    >

                      Pasif yap

                    </Button>

                  ) : (

                    <Button

                      type="button"

                      size="sm"

                      variant="outline"

                      disabled={busy !== ''}

                      onClick={() => setStatus(u.id, 'active')}

                    >

                      Aktif yap

                    </Button>

                  )}

                  {canAdminVerifyEmail && !u.emailVerified && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy !== ''}
                      onClick={() => verifyEmailAdmin(u.id)}
                    >
                      E-postayı doğrula
                    </Button>
                  )}

                  <Link

                    href={`/admin/audit?resourceId=${u.id}`}

                    className="text-xs text-primary hover:underline block"

                  >

                    Audit geçmişi

                  </Link>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

      <p className="text-xs text-muted-foreground">

        Geçerli roller: {APP_ROLES.join(', ')}. ADMIN yalnızca USER/EDITOR/MODERATOR atayabilir.

        SUPER_ADMIN yalnızca SUPER_ADMIN atayabilir. Toplu rol değişikliği desteklenmez.

      </p>

    </div>

  )

}


