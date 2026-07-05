'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, FileText, BookOpen, User, ArrowRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUi } from '@/components/i18n/LocaleProvider'
import type { SuggestItem } from '@/app/api/search-suggest/route'

interface Props {
  /** Büyük hero arama kutusu mu yoksa header compact mı */
  variant?: 'hero' | 'compact'
  placeholder?: string
  className?: string
}

const TYPE_ICONS = {
  article: FileText,
  journal: BookOpen,
  author: User,
}

export function SearchBar({ variant = 'compact', placeholder, className }: Props) {
  const { m, lp } = useUi()
  const router = useRouter()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SuggestItem[]>([])
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [loading, setLoading] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Dışarı tıklanınca kapat
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/search-suggest?q=${encodeURIComponent(query)}&limit=7`)
      const json = await res.json() as { results: SuggestItem[] }
      setResults(json.results ?? [])
      setOpen(json.results.length > 0)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setQ(value)
    setActiveIdx(-1)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 220)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!q.trim()) return
    setOpen(false)
    router.push(lp(`/search?q=${encodeURIComponent(q.trim())}`))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      const item = results[activeIdx]
      setOpen(false)
      router.push(item.href)
    } else if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  function handleClear() {
    setQ('')
    setResults([])
    setOpen(false)
    inputRef.current?.focus()
  }

  const isHero = variant === 'hero'
  const typeLabels = {
    article: m.search.typeArticle,
    journal: m.search.typeJournal,
    author: m.search.typeAuthor,
  } as const
  const defaultPlaceholder = isHero ? m.search.placeholderFull : m.search.placeholder

  return (
    <div className={cn('relative', className)}>
      <form onSubmit={handleSubmit}>
        <div
          className={cn(
            'flex items-stretch overflow-hidden border border-border/90 bg-surface',
            'focus-within:ring-2 focus-within:ring-brand-accent/40 focus-within:border-brand-accent/50',
            isHero
              ? 'rounded-xl shadow-[0_8px_24px_-4px_rgba(15,39,64,0.12),0_2px_8px_-2px_rgba(15,39,64,0.06)]'
              : 'rounded-xl shadow-sm',
          )}
        >
          <div className="flex flex-1 items-center min-w-0">
            <Search
              className={cn(
                'shrink-0 text-muted-foreground',
                isHero ? 'ml-4 h-5 w-5' : 'ml-3 h-4 w-4',
              )}
            />
            <input
              ref={inputRef}
              value={q}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={() => q.length >= 2 && results.length > 0 && setOpen(true)}
              type="search"
              autoComplete="off"
              aria-label={placeholder ?? defaultPlaceholder}
              placeholder={placeholder ?? defaultPlaceholder}
              className={cn(
                'flex-1 min-w-0 bg-transparent outline-none placeholder:text-muted-foreground rounded-none',
                isHero ? 'px-3 py-3 text-base md:text-body min-h-[44px]' : 'px-2.5 py-2.5 text-base min-h-[44px]',
              )}
            />
            {q && (
              <button
                type="button"
                onClick={handleClear}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                aria-label={m.search.clear}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className={cn(
              'shrink-0 inline-flex items-center justify-center gap-1.5 font-semibold bg-brand-primary text-primary-foreground',
              'transition-colors hover:bg-brand-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              isHero
                ? 'px-4 sm:px-5 min-h-[44px] min-w-[44px] rounded-none rounded-r-xl text-sm md:text-base'
                : 'px-3.5 min-h-[44px] min-w-[44px] rounded-none rounded-r-xl text-sm',
            )}
            aria-label={m.search.search}
          >
            {isHero ? (
              <>
                <Search className="h-4 w-4 shrink-0" aria-hidden />
                <span className="hidden sm:inline">{m.search.search}</span>
              </>
            ) : (
              <ArrowRight className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </form>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-border bg-popover shadow-lg overflow-hidden"
        >
          <ul role="listbox">
            {results.map((item, idx) => {
              const Icon = TYPE_ICONS[item.type]
              return (
                <li key={`${item.type}-${item.id}`} role="option" aria-selected={idx === activeIdx}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 text-[0.9375rem] transition-colors no-underline',
                      idx === activeIdx
                        ? 'bg-accent/10 text-foreground'
                        : 'text-foreground hover:bg-secondary',
                    )}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="block font-medium truncate">{item.label}</span>
                      {item.subtitle && (
                        <span className="text-[0.8125rem] text-muted-foreground">{item.subtitle}</span>
                      )}
                    </div>
                    <span className="text-[0.8125rem] text-muted-foreground shrink-0 self-center">
                      {typeLabels[item.type]}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
          {/* Tam arama bağlantısı */}
          <div className="border-t border-border px-4 py-2">
            <Link
              href={lp(`/search?q=${encodeURIComponent(q)}`)}
              onClick={() => setOpen(false)}
              className="text-sm text-accent hover:underline flex items-center gap-1"
            >
              {m.search.viewAllResults}: &ldquo;{q}&rdquo;
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Yükleniyor göstergesi */}
      {loading && (
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2',
            isHero ? 'right-14 sm:right-24' : 'right-10',
          )}
        >
          <div className="h-3.5 w-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        </div>
      )}
    </div>
  )
}
