import Link from 'next/link'
import { requireUserAuth } from '@/lib/auth/guards'
import { listFollowedJournals } from '@/lib/user-panel/follows'

export const metadata = { title: 'Takip Ettiğim Dergiler | Hesabım' }

export default async function TakipDergilerPage() {
  const session = await requireUserAuth()
  const { rows } = await listFollowedJournals(session.user.id, {})

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-serif font-semibold">Takip Ettiğim Dergiler</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Takip edilen dergi yok.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rows.map((r) => (
            <li key={r.journalId} className="rounded-xl border border-border/80 p-3">
              {r.journal ? (
                <Link
                  href={`/journals/${r.journal.slug}-${r.journal.id}`}
                  className="font-medium text-primary hover:text-accent no-underline line-clamp-2"
                >
                  {r.journal.titleTr ?? r.journal.titleEn}
                </Link>
              ) : (
                <span>Dergi #{r.journalId}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
