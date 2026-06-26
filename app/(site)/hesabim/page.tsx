import { getUserPanelSummary } from '@/lib/user-panel/summary'
import { listRecentViews } from '@/lib/user-panel/recent-views'
import { requireUserAuth } from '@/lib/auth/guards'
import Link from 'next/link'

export const metadata = { title: 'Genel Bakış | Hesabım' }

export default async function HesabimOverviewPage() {
  const session = await requireUserAuth()
  const summary = await getUserPanelSummary(session.user.id)
  const recent = await listRecentViews(session.user.id)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Kaydedilen', value: summary.savedArticles, href: '/hesabim/kaydedilen' },
          { label: 'Okuma listesi', value: summary.readingLists, href: '/hesabim/listeler' },
          { label: 'Dergi takibi', value: summary.followedJournals, href: '/hesabim/takip-dergiler' },
          { label: 'Yazar takibi', value: summary.followedAuthors, href: '/hesabim/takip-yazarlar' },
        ].map((item) => (
          <Link key={item.href} href={item.href} className="no-underline">
            <div className="rounded-xl border border-border/80 bg-surface shadow-sm p-4 hover:bg-brand-primary/[0.035] hover:border-border transition-colors">
              <p className="text-2xl font-semibold text-foreground">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          </Link>
        ))}
      </div>
      <section className="space-y-2">
        <h2 className="text-lg font-serif font-semibold">Son görüntülenenler</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz kayıt yok.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {recent.slice(0, 8).map((r) => (
              <li key={`${r.entityType}-${r.entityId}`} className="flex justify-between gap-2">
                {r.href ? (
                  <Link href={r.href} className="text-primary hover:text-accent no-underline line-clamp-2">
                    {r.label}
                  </Link>
                ) : (
                  <span className="line-clamp-2">{r.label}</span>
                )}
                <span className="text-muted-foreground shrink-0 text-xs">
                  {new Date(r.viewedAt).toLocaleDateString('tr-TR')}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/hesabim/son-goruntulenen" className="text-sm text-primary hover:underline">
          Tüm geçmiş →
        </Link>
      </section>
    </div>
  )
}
