import { redirect } from 'next/navigation'
import { isUserAuthEnabled, isAdminPanelEnabled } from '@/lib/features/user-auth'
import { requireUserAuth } from '@/lib/auth/guards'
import { HesabimNav } from '@/components/user-panel/HesabimNav'
import { LogoutButton } from '@/components/auth/LogoutButton'
import Link from 'next/link'
import { canAccessAdminPanel } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

export default async function HesabimLayout({ children }: { children: React.ReactNode }) {
  if (!isUserAuthEnabled()) {
    redirect('/')
  }

  const session = await requireUserAuth()
  const showAdmin =
    isAdminPanelEnabled() && canAccessAdminPanel(session.user.roles)

  return (
    <div className="account-panel-width py-8 min-w-0 w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
        <h1 className="text-2xl font-semibold">Hesabım</h1>
        <div className="flex items-center gap-4 text-sm">
          {showAdmin && (
            <Link href="/admin" className="text-primary hover:underline">Yönetim paneli</Link>
          )}
          <LogoutButton />
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-6">{session.user.email}</p>
      <div
        className="grid grid-cols-1 lg:grid-cols-[minmax(11rem,13rem)_minmax(0,1fr)] gap-6 lg:gap-8 items-start"
      >
        <HesabimNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
