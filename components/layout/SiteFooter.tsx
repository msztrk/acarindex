import Link from 'next/link'
import type { PublicAuthState } from '@/lib/auth/public-session'
import { BrandWordmark } from '@/components/layout/BrandWordmark'

const footerLinkClass =
  'text-muted-foreground hover:text-brand-primary transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 no-underline'

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
    <footer className="mt-10 border-t border-border/80 bg-surface-soft">
      <div className="content-width py-7 md:py-8">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div className="col-span-2 sm:col-span-2 lg:col-span-1">
            <BrandWordmark variant="footer" asLink />
            <p className="mt-3 max-w-sm text-sm text-muted-foreground leading-relaxed">
              Türkçe ve uluslararası akademik yayınlara güvenilir, açık erişimli keşif ve indeks
              platformu.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70 mb-2">
              Keşfet
            </h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/journals" className={footerLinkClass}>Dergiler</Link></li>
              <li><Link href="/search?type=article" className={footerLinkClass}>Makaleler</Link></li>
              <li><Link href="/search?type=author" className={footerLinkClass}>Yazarlar</Link></li>
              <li><Link href="/istatistikler" className={footerLinkClass}>İstatistikler</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70 mb-2">
              Platform
            </h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/applications" className={footerLinkClass}>Başvurular</Link></li>
              <li><Link href="/kurumsal" className={footerLinkClass}>Kurumsal Abonelik</Link></li>
              <li><Link href="/about" className={footerLinkClass}>Hakkımızda</Link></li>
              <li><Link href="/contact" className={footerLinkClass}>İletişim</Link></li>
            </ul>
          </div>

          {showAuth && initialAuth !== undefined && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70 mb-2">
                Hesap
              </h3>
              <ul className="space-y-2 text-sm">
                {accountLinks.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className={footerLinkClass}>{item.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-6 border-t border-border/70 pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
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
