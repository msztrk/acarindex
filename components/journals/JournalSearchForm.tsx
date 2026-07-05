'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SiteLocale } from '@/lib/i18n/locale'
import { withLocalePath } from '@/lib/i18n/locale'
import type { UiMessages } from '@/lib/i18n/ui-messages'

export function JournalSearchForm({
  journalId,
  locale,
  ui,
  className,
}: {
  journalId: number
  locale: SiteLocale
  ui: UiMessages
  className?: string
}) {
  const router = useRouter()
  const [q, setQ] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const query = q.trim()
    if (!query) return
    const params = new URLSearchParams({
      q: query,
      type: 'article',
      journal_id: String(journalId),
    })
    router.push(withLocalePath(`/search?${params.toString()}`, locale))
  }

  return (
    <form onSubmit={handleSubmit} className={cn('min-w-0', className)}>
      <div
        className={cn(
          'flex items-stretch overflow-hidden rounded-xl border border-border/90 bg-surface',
          'focus-within:ring-2 focus-within:ring-brand-accent/40 focus-within:border-brand-accent/50',
        )}
      >
        <div className="flex min-w-0 flex-1 items-center">
          <Search className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            type="search"
            autoComplete="off"
            aria-label={ui.journalPage.searchInJournal}
            placeholder={ui.journalPage.searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent px-2.5 py-2.5 text-base outline-none placeholder:text-muted-foreground"
          />
        </div>
        <button
          type="submit"
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center bg-brand-primary px-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={ui.journalPage.searchSubmit}
        >
          {ui.journalPage.searchSubmit}
        </button>
      </div>
    </form>
  )
}
