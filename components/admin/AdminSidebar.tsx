import Link from 'next/link'
import type { AuthUser } from '@/lib/auth/user'

const NAV = [
  { href: '/admin', label: 'Genel Bakış' },
  { href: '/admin/journals', label: 'Dergiler' },
  { href: '/admin/issues', label: 'Sayılar' },
  { href: '/admin/articles', label: 'Makaleler' },
  { href: '/admin/authors', label: 'Yazarlar' },
  { href: '/admin/pdfs', label: 'PDF Kayıtları' },
  { href: '/admin/data-quality', label: 'Veri Kalitesi' },
  { href: '/admin/etl', label: 'ETL İşlemleri' },
  { href: '/admin/url-aliases', label: 'URL Yönlendirmeleri' },
  { href: '/admin/users', label: 'Kullanıcılar' },
  { href: '/admin/membership-applications', label: 'Üyelik başvuruları' },
  { href: '/admin/applications', label: 'İçerik başvuruları' },
  { href: '/admin/change-requests', label: 'Değişiklik talepleri' },
  { href: '/admin/site-content', label: 'Site İçeriği' },
  { href: '/admin/audit', label: 'Audit Log' },
  { href: '/admin/health', label: 'Sistem Sağlığı' },
]

export default function AdminSidebar({ user }: { user: AuthUser }) {
  return (
    <aside className="w-56 shrink-0 border-r bg-muted/30 p-4 flex flex-col gap-4">
      <div>
        <p className="font-semibold text-sm">AcarIndex Admin</p>
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        <p className="text-xs text-muted-foreground">{user.roles.join(', ')}</p>
      </div>
      <nav className="flex flex-col gap-1 text-sm">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded px-2 py-1.5 hover:bg-muted transition-colors"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <Link href="/" className="text-xs text-muted-foreground hover:underline mt-auto">
        ← Siteye dön
      </Link>
    </aside>
  )
}
