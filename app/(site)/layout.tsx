import { Suspense } from 'react'
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
      <Suspense
        fallback={
          <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-surface h-16" />
        }
      >
        <SiteHeader showAuth={flags.userAuth} initialAuth={initialAuth} />
      </Suspense>
      <main className="flex-1 w-full">{children}</main>
      <SiteFooter initialAuth={initialAuth} showAuth={flags.userAuth} />
    </>
  )
}
