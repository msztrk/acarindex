import Link from 'next/link'
import type { PublicAuthState } from '@/lib/auth/public-session'

const footerLinkClass =
  'hover:text-foreground transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

const GUEST_ACCOUNT_LINKS = [
  { href: '/login', label: 'Giriş Yap' },
  { href: '/register', label: 'Kayıt Ol' },
  { href: '/forgot-password', label: 'Şifremi Unuttum' },
] as const

const AUTH_ACCOUNT_LINKS = [
  { href: '/hesabim', label: 'Hesabım' },
  { href: '/hesabim/kaydedilen', label: 'Kaydettiklerim' },
  { href: '/hesabim/listeler', label: 'Listelerim' },
  { href: '/profile', label: 'Profilim' },
] as const

export function SiteFooter({
  showAuth = false,
  initialAuth,
}: {
  showAuth?: boolean
  initialAuth?: PublicAuthState
}) {
  const currentYear = new Date().getFullYear()
  const accountLinks =
    initialAuth?.authenticated ? AUTH_ACCOUNT_LINKS : GUEST_ACCOUNT_LINKS

  return (
    <footer className="border-t border-border bg-secondary/50 mt-12">
      <div className="content-width py-10">
        <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <Link
              href="/"
              className="font-serif text-lg font-bold text-primary hover:text-primary rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              AcarIndex
            </Link>
            <p className="mt-2 text-[0.9375rem] text-muted-foreground leading-relaxed">
              Türkçe ve uluslararası akademik yayınlara açık erişim sağlayan
              akademik indeks platformu.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Keşfet</h3>
            <ul className="space-y-2 text-[0.9375rem] text-muted-foreground">
              <li><Link href="/journals" className={footerLinkClass}>Dergiler</Link></li>
              <li><Link href="/search?type=article" className={footerLinkClass}>Makaleler</Link></li>
              <li><Link href="/search?type=author" className={footerLinkClass}>Yazarlar</Link></li>
              <li><Link href="/istatistikler" className={footerLinkClass}>İstatistikler</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Platform</h3>
            <ul className="space-y-2 text-[0.9375rem] text-muted-foreground">
              <li><Link href="/applications" className={footerLinkClass}>Başvurular</Link></li>
              <li><Link href="/kurumsal" className={footerLinkClass}>Kurumsal Abonelik</Link></li>
              <li><Link href="/about" className={footerLinkClass}>Hakkımızda</Link></li>
              <li><Link href="/contact" className={footerLinkClass}>İletişim</Link></li>
            </ul>
          </div>

          {showAuth && initialAuth !== undefined && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Hesap</h3>
              <ul className="space-y-2 text-[0.9375rem] text-muted-foreground">
                {accountLinks.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className={footerLinkClass}>{item.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-8 border-t border-border pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[0.8125rem] text-muted-foreground">
          <p>© {currentYear} AcarIndex. Tüm hakları saklıdır.</p>
          <div className="flex gap-4">
            <Link href="/page/gizlilik-politikasi" className={footerLinkClass}>
              Gizlilik
            </Link>
            <Link href="/page/kullanim-kosullari" className={footerLinkClass}>
              Kullanım Koşulları
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
