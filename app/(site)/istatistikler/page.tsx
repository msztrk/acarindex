import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { BookOpen, FileText, Users, Building2 } from 'lucide-react'
import type { PlatformStats } from '@/types/database'

export const metadata: Metadata = {
  title: 'İstatistikler — AcarIndex',
  description: 'AcarIndex platformunun güncel istatistikleri: makale sayısı, dergi sayısı, yazar sayısı.',
}

export const revalidate = 3600

async function getStats(): Promise<PlatformStats | null> {
  const sb = await createClient()
  const { data } = await sb.from('platform_stats').select('*').single()
  return (data as PlatformStats | null) ?? null
}

async function getTopJournals(limit = 10) {
  const sb = await createClient()
  const { data } = await sb
    .from('journals')
    .select('id, slug, title_tr, hit_count')
    .eq('status', 'published')
    .order('hit_count', { ascending: false })
    .limit(limit)
  return data ?? []
}

async function getArticlesByYear() {
  const sb = await createClient()
  const { data } = await sb
    .from('articles')
    .select('published_year')
    .eq('status', 'published')
    .not('published_year', 'is', null)

  if (!data) return []
  const counts: Record<number, number> = {}
  for (const row of data as { published_year: number }[]) {
    const y = row.published_year
    counts[y] = (counts[y] ?? 0) + 1
  }
  return Object.entries(counts)
    .map(([year, count]) => ({ year: Number(year), count }))
    .sort((a, b) => a.year - b.year)
    .slice(-20) // son 20 yıl
}

export default async function IstatistiklerPage() {
  const [stats, topJournals, yearlyData] = await Promise.all([
    getStats(),
    getTopJournals(),
    getArticlesByYear(),
  ])

  const counters = [
    {
      label: 'Akademik Makale',
      value: stats?.article_count ?? 0,
      icon: FileText,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Dergi',
      value: stats?.journal_count ?? 0,
      icon: BookOpen,
      color: 'text-accent',
      bg: 'bg-accent/10',
    },
    {
      label: 'Yazar',
      value: stats?.author_count ?? 0,
      icon: Users,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Kurum',
      value: stats?.institution_count ?? 0,
      icon: Building2,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
  ]

  // Bar chart ölçeklendirme
  const maxCount = Math.max(...yearlyData.map(d => d.count), 1)

  return (
    <div className="content-width py-8">
      <h1 className="font-serif text-3xl font-bold mb-2">Platform İstatistikleri</h1>
      <p className="text-muted-foreground mb-10">Saatte bir güncellenir.</p>

      {/* Sayaçlar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {counters.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-5">
            <div className={`inline-flex items-center justify-center h-10 w-10 rounded-lg ${bg} mb-3`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <p className="text-2xl font-bold tabular-nums">{value.toLocaleString('tr-TR')}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
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
            <h2 className="text-lg font-serif font-semibold mb-5">En Çok Görüntülenen Dergiler</h2>
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
