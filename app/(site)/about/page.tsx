import type { Metadata } from 'next'
import Link from 'next/link'
import { cn, buttonVariants } from '@/lib/utils'
import { BookOpen, Search, Users, FileText } from 'lucide-react'
import { JsonLd } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'Hakkımızda — AcarIndex',
  description:
    'AcarIndex; Türkçe ve Türk akademik dergilerini indeksleyen, araştırmacılara ücretsiz ve açık erişim sunan akademik veri platformudur.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'}/about`,
  },
}

const features = [
  {
    icon: Search,
    title: 'Güçlü Arama',
    desc: 'Makale başlığı, yazar adı, anahtar kelime veya ISSN ile kapsamlı akademik arama yapın.',
  },
  {
    icon: BookOpen,
    title: 'Dergi Profilleri',
    desc: 'Türkiye\'deki hakemli dergilerin detaylı bilgileri, arşivleri ve sayı bazlı içerikleri.',
  },
  {
    icon: Users,
    title: 'Yazar Profilleri',
    desc: 'Akademisyenlerin yayın listeleri, kurum bilgileri ve ORCID entegrasyonu.',
  },
  {
    icon: FileText,
    title: 'Tam Metin Erişim',
    desc: 'Mevcut PDF\'lere doğrudan erişim ve platform üzerinden görüntüleme imkânı.',
  },
]

export default function AboutPage() {
  const base = process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com'

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'AcarIndex',
    url: base,
    description: metadata.description,
    sameAs: [],
  }

  return (
    <>
      <JsonLd data={schema} />
      <div className="content-width py-12">
        {/* Hero */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h1 className="font-serif text-4xl font-bold mb-4 text-foreground">
            Hakkımızda
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            AcarIndex, Türkçe ve Türk akademik dergilerini indeksleyen, araştırmacılara
            ücretsiz ve açık erişim sunan akademik veri platformudur.
          </p>
        </div>

        {/* Misyon */}
        <section className="mb-16">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-serif text-2xl font-bold mb-4">Misyonumuz</h2>
            <div className="prose prose-sm max-w-none text-foreground/80 leading-relaxed space-y-4">
              <p>
                Akademik bilgiye erişimin önündeki engelleri kaldırmak ve Türk akademik
                üretimini uluslararası standartlarda dizinlemek için çalışıyoruz.
              </p>
              <p>
                Platform; hakemli dergi makalelerini, yazar profillerini ve kurum
                bilgilerini yapılandırılmış ve aranabilir biçimde sunar. Tüm içerik
                ücretsizdir ve herhangi bir kayıt gerektirmez.
              </p>
              <p>
                Uzun vadeli hedefimiz API-first bir akademik veri altyapısı oluşturarak
                araştırmacıların, üniversitelerin ve yazılım geliştiricilerin
                verilere programatik erişim sağlamasını mümkün kılmaktır.
              </p>
            </div>
          </div>
        </section>

        {/* Özellikler */}
        <section className="mb-16">
          <h2 className="font-serif text-2xl font-bold mb-8 text-center">Neler Sunuyoruz?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl border border-border bg-card p-6 flex gap-4">
                <div className="shrink-0 h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Dergi yayıncıları için */}
        <section className="mb-16 rounded-2xl border border-border bg-secondary/40 p-8 max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-xl font-bold mb-3">Dergi Yayıncıları İçin</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Dergilerinizin AcarIndex&apos;te listelenmesini veya mevcut bilgilerin güncellenmesini
            istiyorsanız bizimle iletişime geçin.
          </p>
          <Link href="/contact" className={cn(buttonVariants())}>İletişime Geç</Link>
        </section>

        {/* Teknoloji */}
        <section className="max-w-3xl mx-auto">
          <h2 className="font-serif text-2xl font-bold mb-4">Teknoloji</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            AcarIndex; Next.js, TypeScript, Tailwind CSS ve Supabase/PostgreSQL üzerine
            inşa edilmiş modern bir akademik veri platformudur. SEO için{' '}
            <a href="https://schema.org" className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">
              Schema.org
            </a>{' '}
            yapılandırılmış verisi ve Google Scholar uyumlu Highwire Press meta etiketleri
            kullanılmaktadır.
          </p>
        </section>
      </div>
    </>
  )
}
