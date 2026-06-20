import Link from 'next/link'

export function SiteFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-secondary/50 mt-16">
      <div className="content-width py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">

          {/* Marka */}
          <div className="lg:col-span-1">
            <Link href="/" className="font-serif text-lg font-bold text-primary hover:text-primary">
              AcarIndex
            </Link>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Türkçe ve uluslararası akademik yayınlara açık erişim sağlayan
              akademik indeks platformu.
            </p>
          </div>

          {/* Keşfet */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Keşfet</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/journals" className="hover:text-foreground transition-colors">Dergiler</Link></li>
              <li><Link href="/search?type=article" className="hover:text-foreground transition-colors">Makaleler</Link></li>
              <li><Link href="/search?type=author" className="hover:text-foreground transition-colors">Yazarlar</Link></li>
              <li><Link href="/istatistikler" className="hover:text-foreground transition-colors">İstatistikler</Link></li>
            </ul>
          </div>

          {/* Platform */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Platform</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/applications" className="hover:text-foreground transition-colors">Başvurular</Link></li>
              <li><Link href="/kurumsal" className="hover:text-foreground transition-colors">Kurumsal Abonelik</Link></li>
              <li><Link href="/about" className="hover:text-foreground transition-colors">Hakkımızda</Link></li>
              <li><Link href="/contact" className="hover:text-foreground transition-colors">İletişim</Link></li>
            </ul>
          </div>

          {/* Hesap */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Hesap</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/login" className="hover:text-foreground transition-colors">Giriş Yap</Link></li>
              <li><Link href="/register" className="hover:text-foreground transition-colors">Kayıt Ol</Link></li>
              <li><Link href="/profile" className="hover:text-foreground transition-colors">Profilim</Link></li>
            </ul>
          </div>
        </div>

        {/* Alt çizgi */}
        <div className="mt-10 border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© {currentYear} AcarIndex. Tüm hakları saklıdır.</p>
          <div className="flex gap-4">
            <Link href="/page/gizlilik-politikasi" className="hover:text-foreground transition-colors">
              Gizlilik
            </Link>
            <Link href="/page/kullanim-kosullari" className="hover:text-foreground transition-colors">
              Kullanım Koşulları
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
