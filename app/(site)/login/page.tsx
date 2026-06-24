import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { isUserAuthEnabled, usePgAuth } from '@/lib/features/user-auth'
import LoginForm from './LoginForm'
import PgLoginForm from './PgLoginForm'

export const metadata = { title: 'Giriş Yap | AcarIndex' }

export default function LoginPage() {
  if (!isUserAuthEnabled()) {
    redirect('/')
  }

  const Form = usePgAuth() ? PgLoginForm : LoginForm

  return (
    <Suspense fallback={<div className="min-h-[70vh] flex items-center justify-center"><span className="text-muted-foreground">Yükleniyor…</span></div>}>
      <Form />
    </Suspense>
  )
}
