import { redirect } from 'next/navigation'
import { isUserAuthEnabled } from '@/lib/features/user-auth'
import { requireUserAuth } from '@/lib/auth/guards'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { isAdminPanelPublicEnabled } from '@/lib/features/user-auth'
import { canAccessAdminPanel } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Hesabım | AcarIndex' }

export default async function HesabimPage() {
  if (!isUserAuthEnabled()) {
    redirect('/')
  }

  const session = await requireUserAuth()
  const showAdmin = isAdminPanelPublicEnabled() && canAccessAdminPanel(session.user.roles)

  return (
    <div className="container max-w-lg py-10 space-y-4">
      <h1 className="text-2xl font-semibold">Hesabım</h1>
      <Card className="p-4 space-y-2 text-sm">
        <p><span className="text-muted-foreground">E-posta:</span> {session.user.email}</p>
        <p><span className="text-muted-foreground">Ad:</span> {session.user.name ?? '—'}</p>
        <p><span className="text-muted-foreground">Roller:</span> {session.user.roles.join(', ')}</p>
        <p><span className="text-muted-foreground">E-posta doğrulama:</span>{' '}
          {session.user.emailVerified ? 'Doğrulandı' : 'Bekliyor'}
        </p>
      </Card>
      <p className="text-sm text-muted-foreground">
        Faz 6B: favoriler, bildirimler ve yazar sahiplenme bu sprintte henüz aktif değil.
      </p>
      {showAdmin && (
        <Link href="/admin" className="text-sm text-primary hover:underline">Yönetim paneli →</Link>
      )}
      <LogoutButton />
    </div>
  )
}
