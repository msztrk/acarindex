import { VerifyEmailPanel } from '@/components/auth/VerifyEmailPanel'

export const metadata = { title: 'Doğrulama e-postası | AcarIndex' }

export default function VerifyEmailRequestPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-8">
      <VerifyEmailPanel />
    </div>
  )
}
