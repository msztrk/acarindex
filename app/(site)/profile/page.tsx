import { redirect } from 'next/navigation'
import { isUserAuthEnabled } from '@/lib/features/user-auth'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Profilim | AcarIndex' }

export default async function ProfilePage() {
  if (!isUserAuthEnabled()) {
    redirect('/')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="content-width py-12 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-6">Profilim</h1>

      <div className="bg-white border border-border rounded-xl p-6 space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">E-posta</p>
          <p className="font-medium">{user.email}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Hesap ID</p>
          <p className="font-mono text-xs text-muted-foreground">{user.id}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Üyelik tarihi</p>
          <p className="font-medium">
            {new Date(user.created_at).toLocaleDateString('tr-TR', {
              year: 'numeric', month: 'long', day: 'numeric'
            })}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-secondary transition-colors"
          >
            Çıkış Yap
          </button>
        </form>
      </div>
    </div>
  )
}
