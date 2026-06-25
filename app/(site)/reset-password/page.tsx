import { Suspense } from 'react'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'

export const metadata = { title: 'Parola sıfırla | AcarIndex' }

export default function ResetPasswordPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-8">
      <Suspense fallback={<p className="text-sm">Yükleniyor…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  )
}
