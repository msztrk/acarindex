import { SiteHeader } from '@/components/layout/SiteHeader'

import { SiteFooter } from '@/components/layout/SiteFooter'

import { getAuthUiFlags } from '@/lib/features/user-auth'



/** Katalog sayfaları runtime'da PostgreSQL okur; build zamanında DB bağlantısı gerektirmez. */

export const dynamic = 'force-dynamic'



export default function SiteLayout({

  children,

}: {

  children: React.ReactNode

}) {

  const flags = getAuthUiFlags()



  return (

    <>

      <SiteHeader showAuth={flags.userAuth} />

      <main className="flex-1 w-full">{children}</main>

      <SiteFooter />

    </>

  )

}


