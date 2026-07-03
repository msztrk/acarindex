import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isUserAuthEnabled } from '@/lib/features/user-auth'
import { requireEditorPanelSession } from '@/lib/auth/panel-guards'
import { LogoutButton } from '@/components/auth/LogoutButton'

export const dynamic = 'force-dynamic'

export default async function EditorLayout({ children }: { children: React.ReactNode }) {
  if (!isUserAuthEnabled()) {
    redirect('/')
  }

  const session = await requireEditorPanelSession()

  return (
    <div className="content-width py-8 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
        <h1 className="font-serif text-2xl font-semibold text-foreground">Dergi Editör Paneli</h1>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/hesabim" className="text-primary hover:underline">
            Hesabım
          </Link>
          <LogoutButton />
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-6">{session.user.email}</p>
      <nav className="flex flex-wrap gap-3 mb-8 text-sm border-b pb-4">
        <Link href="/editor" className="hover:text-primary">
          Dergilerim
        </Link>
        <Link href="/editor/basvuru" className="hover:text-primary">
          Editör başvurusu
        </Link>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
