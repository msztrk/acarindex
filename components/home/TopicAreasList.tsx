import Link from 'next/link'

export interface TopicAreaItem {
  id: number
  name_tr: string | null
  name_en: string | null
}

export function TopicAreasList({ categories }: { categories: TopicAreaItem[] }) {
  if (categories.length === 0) return null

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-foreground mb-3">Konu alanları</h2>
      <ul className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <li key={cat.id}>
            <Link
              href={`/journals?category=${cat.id}`}
              className="inline-block text-xs font-medium px-2.5 py-1 rounded-md border border-foreground/15 bg-muted/50 text-foreground/85 hover:text-foreground hover:border-foreground/30 hover:bg-muted transition-colors no-underline"
            >
              {cat.name_tr ?? cat.name_en ?? 'Kategori'}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
