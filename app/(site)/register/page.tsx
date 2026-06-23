import { redirect } from 'next/navigation'
import { isUserAuthEnabled } from '@/lib/features/user-auth'

export default function RegisterPage() {
  if (!isUserAuthEnabled()) {
    redirect('/')
  }
  redirect('/login?mode=register')
}
