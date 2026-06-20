import { Suspense } from 'react'
import LoginForm from './LoginForm'

export const metadata = { title: 'Giriş Yap | AcarIndex' }

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[70vh] flex items-center justify-center"><span className="text-muted-foreground">Yükleniyor…</span></div>}>
      <LoginForm />
    </Suspense>
  )
}
