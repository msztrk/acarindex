import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isUserAuthEnabled } from '@/lib/features/user-auth'
import { requireUserAuth } from '@/lib/auth/guards'
import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Güvenlik | AcarIndex' }

export default async function HesabimSecurityPage() {
  if (!isUserAuthEnabled()) {
    redirect('/')
  }

  await requireUserAuth()

  return (
    <div className="container max-w-lg py-10 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Parola ve güvenlik</h1>
        <Link href="/hesabim" className="text-sm text-primary hover:underline">← Hesabım</Link>
      </div>
      <p className="text-sm text-muted-foreground">
        Parola değişikliği audit log&apos;a yazılır. İsteğe bağlı olarak diğer oturumlar iptal edilir.
      </p>
      <ChangePasswordForm />
    </div>
  )
}
