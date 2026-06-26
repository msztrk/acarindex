import { redirect } from 'next/navigation'
import { isUserAuthEnabled } from '@/lib/features/user-auth'
import { isPublicRegistrationEnabled } from '@/lib/features/auth-lifecycle'
import { RegisterForm } from '@/components/auth/RegisterForm'

export const metadata = { title: 'Kayıt Ol | AcarIndex' }

export default function RegisterPage() {
  if (!isUserAuthEnabled()) redirect('/')
  return <RegisterForm publicRegistration={isPublicRegistrationEnabled()} />
}
