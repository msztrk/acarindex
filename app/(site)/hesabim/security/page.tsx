import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm'
import { SessionListPanel } from '@/components/auth/SessionListPanel'
import { AccountLifecyclePanel } from '@/components/auth/AccountLifecyclePanel'

export const metadata = { title: 'Güvenlik | Hesabım' }

export default function HesabimSecurityPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-serif font-semibold">Parola ve güvenlik</h2>
      <p className="text-sm text-muted-foreground">
        Oturum yönetimi, hesap durumu ve parola değişiklikleri audit log&apos;a yazılır.
      </p>
      <ChangePasswordForm />
      <SessionListPanel />
      <AccountLifecyclePanel />
    </div>
  )
}
