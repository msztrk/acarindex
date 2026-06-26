import { SiteHeader } from '@/components/layout/SiteHeader'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { getAuthUiFlags } from '@/lib/features/user-auth'
import { getServerSession } from '@/lib/auth/session'
import type { PublicAuthState } from '@/lib/auth/public-session'

/** Katalog sayfaları runtime'da PostgreSQL okur; build zamanında DB bağlantısı gerektirmez. */
export const dynamic = 'force-dynamic'

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const flags = getAuthUiFlags()
  let initialAuth: PublicAuthState | undefined

  if (flags.userAuth) {
    const session = await getServerSession()
    initialAuth = session
      ? {
          authenticated: true,
          user: { email: session.user.email, name: session.user.name },
        }
      : { authenticated: false }
  }

  return (
    <>
      <SiteHeader showAuth={flags.userAuth} initialAuth={initialAuth} />
      <main className="flex-1 w-full">{children}</main>
      <SiteFooter initialAuth={initialAuth} showAuth={flags.userAuth} />
    </>
  )
}
