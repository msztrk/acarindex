import Link from 'next/link'
import type { PublicAuthState } from '@/lib/auth/public-session'
import { BrandWordmark } from '@/components/layout/BrandWordmark'
import type { SiteLocale } from '@/lib/i18n/locale'
import { withLocalePath } from '@/lib/i18n/locale'
import { getUiMessages } from '@/lib/i18n/ui-messages'

const footerLinkClass =
  'inline-flex min-h-6 items-center text-muted-foreground hover:text-brand-primary transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 no-underline'

export function SiteFooter({
  showAuth = false,
  initialAuth,
  locale = 'tr',
}: {
  showAuth?: boolean
  initialAuth?: PublicAuthState
  locale?: SiteLocale
}) {
  const m = getUiMessages(locale)
  const lp = (path: string) => withLocalePath(path, locale)
  const currentYear = new Date().getFullYear()

  const guestAccountLinks = [
    { href: lp('/login'), label: m.auth.loginFull },
    { href: lp('/register'), label: m.auth.register },
    { href: lp('/forgot-password'), label: m.auth.forgotPassword },
  ]

  const authAccountLinks = [
    { href: lp('/hesabim'), label: m.auth.myAccount },
    { href: lp('/hesabim/kaydedilen'), label: m.auth.saved },
    { href: lp('/hesabim/listeler'), label: m.auth.lists },
    { href: lp('/profile'), label: m.auth.profile },
  ]

  const accountLinks = initialAuth?.authenticated ? authAccountLinks : guestAccountLinks

  return (
    <footer className="mt-8 border-t border-border/80 bg-surface-soft md:mt-10">
      <div className="content-width py-4 md:py-8">
        <div className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div className="col-span-2 sm:col-span-2 lg:col-span-1">
            <BrandWordmark variant="footer" asLink />
            <p className="mt-1.5 max-w-sm text-sm leading-snug text-muted-foreground md:mt-3 md:leading-relaxed">
              {m.footer.tagline}
            </p>
          </div>

          <div>
            <h3 className="mb-1 text-sm font-bold uppercase tracking-[0.12em] text-foreground/70 md:mb-2">
              {m.footer.explore}
            </h3>
            <ul className="space-y-0 text-[0.9375rem] md:space-y-2">
              <li><Link href={lp('/journals')} className={footerLinkClass}>{m.nav.journals}</Link></li>
              <li><Link href={lp('/search?type=article')} className={footerLinkClass}>{m.nav.articles}</Link></li>
              <li><Link href={lp('/search?type=author')} className={footerLinkClass}>{m.nav.authors}</Link></li>
              <li><Link href={lp('/istatistikler')} className={footerLinkClass}>{m.nav.statistics}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-1 text-sm font-bold uppercase tracking-[0.12em] text-foreground/70 md:mb-2">
              {m.footer.platform}
            </h3>
            <ul className="space-y-0 text-[0.9375rem] md:space-y-2">
              <li><Link href={lp('/applications')} className={footerLinkClass}>{m.footer.applications}</Link></li>
              <li><Link href={lp('/kurumsal')} className={footerLinkClass}>{m.footer.corporate}</Link></li>
              <li><Link href={lp('/about')} className={footerLinkClass}>{m.footer.about}</Link></li>
              <li><Link href={lp('/contact')} className={footerLinkClass}>{m.footer.contact}</Link></li>
            </ul>
          </div>

          {showAuth && initialAuth !== undefined && (
            <div>
              <h3 className="mb-1 text-sm font-bold uppercase tracking-[0.12em] text-foreground/70 md:mb-2">
                {m.footer.account}
              </h3>
              <ul className="space-y-0 text-[0.9375rem] md:space-y-2">
                {accountLinks.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className={footerLinkClass}>{item.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-col items-center justify-between gap-1 border-t border-border/70 pt-2.5 text-sm text-muted-foreground sm:flex-row md:mt-6 md:gap-2 md:pt-4">
          <p>© {currentYear} AcarIndex. {m.footer.rights}</p>
          <div className="flex gap-4">
            <Link href={lp('/page/gizlilik-politikasi')} className={footerLinkClass}>
              {m.footer.privacy}
            </Link>
            <Link href={lp('/page/kullanim-kosullari')} className={footerLinkClass}>
              {m.footer.terms}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
