import { SiteHeader } from '@/components/layout/SiteHeader'
import { SiteFooter } from '@/components/layout/SiteFooter'

/** Katalog sayfaları runtime'da PostgreSQL okur; build zamanında DB bağlantısı gerektirmez. */
export const dynamic = 'force-dynamic'

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  )
}
