import Link from 'next/link'
import { requireUserAuth } from '@/lib/auth/guards'
import { listFollowedAuthors } from '@/lib/user-panel/follows'

export const metadata = { title: 'Takip Ettiğim Yazarlar | Hesabım' }

export default async function TakipYazarlarPage() {
  const session = await requireUserAuth()
  const { rows } = await listFollowedAuthors(session.user.id, {})

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-serif font-semibold">Takip Ettiğim Yazarlar</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Takip edilen yazar yok.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rows.map((r) => (
            <li key={r.authorId} className="rounded-xl border border-border/80 p-3">
              {r.author?.slug ? (
                <Link
                  href={`/authors/${r.author.slug}-${r.author.id}`}
                  className="font-medium text-primary hover:text-accent no-underline"
                >
                  {r.author.name}
                </Link>
              ) : (
                <span>{r.author?.name ?? `Yazar #${r.authorId}`}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
