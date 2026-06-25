import { Suspense } from 'react'
import { VerifyEmailPanel } from '@/components/auth/VerifyEmailPanel'

export const metadata = { title: 'E-posta doğrulama | AcarIndex' }

export default function VerifyEmailPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-8">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Yükleniyor…</p>}>
        <VerifyEmailPanel />
      </Suspense>
    </div>
  )
}
