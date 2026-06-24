import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm'

export const metadata = { title: 'Güvenlik | Hesabım' }

export default function HesabimSecurityPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Parola ve güvenlik</h2>
      <p className="text-sm text-muted-foreground">
        Parola değişikliği audit log&apos;a yazılır.
      </p>
      <ChangePasswordForm />
    </div>
  )
}
