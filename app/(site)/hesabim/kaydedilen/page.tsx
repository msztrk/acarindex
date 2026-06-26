import Link from 'next/link'
import { requireUserAuth } from '@/lib/auth/guards'
import { listSavedArticles } from '@/lib/user-panel/saved-articles'

export const metadata = { title: 'Kaydedilen Makaleler | Hesabım' }

export default async function KaydedilenPage() {
  const session = await requireUserAuth()
  const { rows } = await listSavedArticles(session.user.id, {})

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-serif font-semibold">Kaydedilen Makaleler</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz kayıtlı makale yok.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.articleId} className="rounded-xl border border-border/80 p-3 text-sm">
              {r.article ? (
                <Link
                  href={`/${r.article.legacyJournalSlug}/${r.article.slug}-${r.article.id}`}
                  className="font-medium text-primary hover:text-accent no-underline line-clamp-2"
                >
                  {r.article.titleTr ?? r.article.titleEn ?? `Makale ${r.articleId}`}
                </Link>
              ) : (
                <span>Makale #{r.articleId}</span>
              )}
              {r.article?.journalTitleTr && (
                <p className="text-xs text-muted-foreground mt-1">{r.article.journalTitleTr}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
