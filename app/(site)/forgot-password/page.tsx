import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export const metadata = { title: 'Şifremi unuttum | AcarIndex' }

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-8">
      <ForgotPasswordForm />
    </div>
  )
}
