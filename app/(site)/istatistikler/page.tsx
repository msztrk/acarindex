import type { Metadata } from 'next'
import { loadStatsPageData } from '@/lib/data/stats'
import { prisma } from '@/lib/db/prisma'
import { BookOpen, FileText, Users, Building2 } from 'lucide-react'

export const metadata: Metadata = {
  title: 'İstatistikler — AcarIndex',
  description: 'AcarIndex platformunun güncel istatistikleri: makale sayısı, dergi sayısı, yazar sayısı.',
}

export const revalidate = 3600

async function getArticlesByYear() {
  const rows = await prisma.article.findMany({
    where: { status: 'published', publishedYear: { not: null } },
    select: { publishedYear: true },
  })
  const counts: Record<number, number> = {}
  for (const row of rows) {
    const y = row.publishedYear!
    counts[y] = (counts[y] ?? 0) + 1
  }
  return Object.entries(counts)
    .map(([year, count]) => ({ year: Number(year), count }))
    .sort((a, b) => a.year - b.year)
    .slice(-20)
}

export default async function IstatistiklerPage() {
  const pageData = await loadStatsPageData()
  const yearlyData = await getArticlesByYear()
  const stats = pageData.stats
  const topJournals = pageData.topJournals
  const authorCount = pageData.authorCount

  const displayAuthorCount = authorCount > 0 ? authorCount : (stats?.author_count ?? 0)

  // Sayaçlar: yaklaşık değer uyarısı
  const counters = [
    {
      label: 'Akademik Makale',
      sublabel: 'yaklaşık',
      value: stats?.article_count ?? 0,
      icon: FileText,
      color: 'text-primary',
      bg: 'bg-primary/10',
      show: true,
    },
    {
      label: 'Dergi',
      sublabel: 'yaklaşık',
      value: stats?.journal_count ?? 0,
      icon: BookOpen,
      color: 'text-accent',
      bg: 'bg-accent/10',
      show: true,
    },
    {
      label: 'Yazar',
      sublabel: displayAuthorCount > 0 ? 'pilot veri' : '',
      value: displayAuthorCount,
      icon: Users,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      show: displayAuthorCount > 0,
    },
    {
      label: 'Kurum',
      sublabel: '',
      value: stats?.institution_count ?? 0,
      icon: Building2,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      show: (stats?.institution_count ?? 0) > 0,
    },
  ].filter(c => c.show)

  // Bar chart ölçeklendirme
  const maxCount = Math.max(...yearlyData.map(d => d.count), 1)

  return (
    <div className="content-width py-8">
      <h1 className="font-serif text-3xl font-bold mb-2">Platform İstatistikleri</h1>
      <p className="text-muted-foreground mb-10">
        Makale ve dergi sayıları PostgreSQL tablo istatistiklerinden (yaklaşık). Saatte bir güncellenir.
      </p>

      {/* Sayaçlar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {counters.map(({ label, sublabel, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-5">
            <div className={`inline-flex items-center justify-center h-10 w-10 rounded-lg ${bg} mb-3`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <p className="text-2xl font-bold tabular-nums">{value.toLocaleString('tr-TR')}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {label}
              {sublabel && <span className="text-xs"> ({sublabel})</span>}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Yıllık makale bar chart (CSS-only) */}
        {yearlyData.length > 0 && (
          <section>
            <h2 className="text-lg font-serif font-semibold mb-5">Yıllara Göre Makaleler</h2>
            <div className="space-y-2">
              {yearlyData.map(({ year, count }) => (
                <div key={year} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-10 text-right shrink-0">{year}</span>
                  <div className="flex-1 bg-secondary rounded h-5 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded transition-all duration-500"
                      style={{ width: `${Math.round((count / maxCount) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-12 text-right shrink-0 tabular-nums">
                    {count.toLocaleString('tr-TR')}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* En fazla makale olan dergiler */}
        {topJournals.length > 0 && (
          <section>
            <h2 className="text-lg font-serif font-semibold mb-1">En Çok Görüntülenen Dergiler</h2>
            <p className="text-xs text-muted-foreground mb-4">Dergi sayfası görüntülenme sayısı (hit_count)</p>
            <ol className="space-y-2">
              {topJournals.map((j, i) => {
                const journal = j as { id: number; slug: string; title_tr: string | null; hit_count: number }
                return (
                  <li key={journal.id} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                    <a
                      href={`/journals/${journal.slug}-${journal.id}`}
                      className="flex-1 text-sm text-primary hover:text-accent truncate"
                    >
                      {journal.title_tr ?? 'Başlıksız'}
                    </a>
                    <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                      {(journal.hit_count ?? 0).toLocaleString('tr-TR')}
                    </span>
                  </li>
                )
              })}
            </ol>
          </section>
        )}
      </div>
    </div>
  )
}
