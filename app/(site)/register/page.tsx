import { redirect } from 'next/navigation'
import { isUserAuthEnabled } from '@/lib/features/user-auth'
import { isPublicRegistrationEnabled } from '@/lib/features/auth-lifecycle'
import { RegisterForm } from '@/components/auth/RegisterForm'

export const metadata = { title: 'Kayıt Ol | AcarIndex' }

export default function RegisterPage() {
  if (!isUserAuthEnabled()) redirect('/')
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-8">
      <RegisterForm publicRegistration={isPublicRegistrationEnabled()} />
    </div>
  )
}
