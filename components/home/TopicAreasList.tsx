import Link from 'next/link'

export interface TopicAreaItem {
  id: number
  name_tr: string | null
  name_en: string | null
}

export function TopicAreasList({ categories }: { categories: TopicAreaItem[] }) {
  if (categories.length === 0) return null

  return (
    <section className="mt-7">
      <h2 className="text-[0.9375rem] font-semibold text-foreground mb-3">Konu alanları</h2>
      <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {categories.map((cat) => {
          const label = cat.name_tr ?? cat.name_en ?? 'Kategori'
          return (
            <li key={cat.id} className="min-w-0 sm:max-w-full">
              <Link
                href={`/journals?category=${cat.id}`}
                title={label}
                className="inline-flex w-full sm:w-auto max-w-full items-center text-[0.8125rem] font-medium px-3 py-1.5 rounded-md border border-foreground/18 bg-muted/40 text-foreground/85 hover:text-foreground hover:border-foreground/28 hover:bg-muted/70 transition-colors no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span className="line-clamp-2 sm:line-clamp-1">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
