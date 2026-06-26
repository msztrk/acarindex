import { Suspense } from 'react'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'
import { AuthPageShell } from '@/components/layout/AuthPageShell'

export const metadata = { title: 'Parola sıfırla | AcarIndex' }

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthPageShell title="Parola sıfırlama">
          <p className="text-sm text-muted-foreground">Yükleniyor…</p>
        </AuthPageShell>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
