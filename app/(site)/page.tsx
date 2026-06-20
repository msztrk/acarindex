import type { Metadata } from 'next'
import Link from 'next/link'
import { cn, buttonVariants } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { SearchBar } from '@/components/search/SearchBar'
import { BookOpen, FileText, ClipboardList } from 'lucide-react'
import type { PlatformStats } from '@/types/database'

export const metadata: Metadata = {
  title: 'AcarIndex — Akademik İndeks Platformu',
  description:
    'Türkçe ve uluslararası akademik makalelere, dergilere ve yazarlara açık erişim sağlayan akademik arama ve indeks platformu.',
}

async function getStats(): Promise<PlatformStats | null> {
  try {
    const supabase = await createClient()
    const { data } = await supabase.from('platform_stats').select('*').single()
    return data
  } catch {
    return null
  }
}

function formatNumber(n: number | undefined | null): string {
  if (!n) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}B+`
  return n.toLocaleString('tr-TR')
}

export default async function HomePage() {
  const stats = await getStats()

  return (
    <div>
      {/* Hero */}
      <section className="bg-primary text-primary-foreground py-20 lg:py-28">
        <div className="content-width text-center">
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4">
            Akademik bilgiye açık erişim
          </h1>
          <p className="text-primary-foreground/80 text-lg mb-10 max-w-2xl mx-auto">
            Yüz binlerce Türkçe ve uluslararası akademik makale, dergi ve yazara
            tek platformdan ulaşın.
          </p>

          {/* Arama kutusu */}
          <div className="max-w-2xl mx-auto">
            <SearchBar variant="hero" />
            {/* Filtre linkleri */}
            <div className="flex flex-wrap justify-center gap-4 mt-4 text-sm text-primary-foreground/70">
              {[
                { label: 'Makaleler', type: 'article' },
                { label: 'Dergiler', type: 'journal' },
                { label: 'Yazarlar', type: 'author' },
              ].map(({ label, type }) => (
                <Link
                  key={type}
                  href={`/search?type=${type}`}
                  className="hover:text-primary-foreground transition-colors"
                >
                  {label} →
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* İstatistik bandı */}
      <section className="border-b border-border bg-secondary/50">
        <div className="content-width py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            <StatItem label="Dergi" value={formatNumber(stats?.journal_count)} href="/journals" />
            <StatItem label="Makale" value={formatNumber(stats?.article_count)} href="/search?type=article" />
            <StatItem label="Tam Metin" value={formatNumber(stats?.pdf_count)} />
            <StatItem label="Görüntülenme" value={formatNumber(stats?.total_hits)} href="/istatistikler" />
          </div>
        </div>
      </section>

      {/* Hızlı erişim */}
      <section className="content-width py-14">
        <h2 className="font-serif text-2xl font-semibold mb-8 text-center">Keşfet</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <QuickCard
            href="/journals"
            title="Dergiler"
            description="İndekslenmiş tüm akademik dergileri keşfedin."
            icon={BookOpen}
          />
          <QuickCard
            href="/search?type=article"
            title="Makaleler"
            description="Binlerce tam metin makaleye erişin."
            icon={FileText}
          />
          <QuickCard
            href="/applications"
            title="Başvurular"
            description="Dergi, kitap ve bildiri başvurusu yapın."
            icon={ClipboardList}
          />
        </div>
      </section>
    </div>
  )
}

function StatItem({ label, value, href }: { label: string; value: string; href?: string }) {
  const inner = (
    <div>
      <p className="text-2xl sm:text-3xl font-bold font-serif text-primary">{value}</p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </div>
  )
  if (href) return <Link href={href} className="no-underline hover:opacity-80 transition-opacity">{inner}</Link>
  return inner
}

function QuickCard({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Link
      href={href}
      className="group flex gap-4 items-start rounded-xl border border-border bg-card p-6 hover:shadow-md hover:border-accent transition-all duration-200 no-underline"
    >
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h3 className="font-semibold text-foreground mb-1 group-hover:text-accent transition-colors">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Link>
  )
}
