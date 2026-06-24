import { requireAdminSession } from '@/lib/auth/guards'
import AdminSidebar from '@/components/admin/AdminSidebar'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Yönetim | AcarIndex' }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminSession()
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AdminSidebar user={session.user} />
      <main className="flex-1 p-6 max-w-6xl">{children}</main>
    </div>
  )
}
