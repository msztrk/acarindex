import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isUserAuthEnabled } from '@/lib/features/user-auth'
import { requireUserAuth } from '@/lib/auth/guards'
import { LogoutButton } from '@/components/auth/LogoutButton'

export const dynamic = 'force-dynamic'

export default async function KurumLayout({ children }: { children: React.ReactNode }) {
  if (!isUserAuthEnabled()) {
    redirect('/')
  }

  const session = await requireUserAuth()

  return (
    <div className="content-width py-8 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
        <h1 className="font-serif text-2xl font-semibold text-foreground">Kurum Paneli</h1>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/hesabim" className="text-primary hover:underline">
            Hesabım
          </Link>
          <LogoutButton />
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-6">{session.user.email}</p>
      <nav className="flex flex-wrap gap-3 mb-8 text-sm border-b pb-4">
        <Link href="/kurum" className="hover:text-primary">
          Kurumlarım
        </Link>
        <Link href="/kurum/basvuru" className="hover:text-primary">
          Kurum yöneticisi başvurusu
        </Link>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
