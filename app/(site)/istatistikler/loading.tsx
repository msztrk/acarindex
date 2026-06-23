import { CatalogPageSkeleton } from '@/components/catalog/CatalogPageSkeleton'

export default function IstatistiklerLoading() {
  return (
    <div className="content-width py-8">
      <div className="h-9 w-64 bg-secondary/80 rounded animate-pulse mb-8" aria-hidden />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-secondary/80 animate-pulse" />
        ))}
      </div>
      <CatalogPageSkeleton rows={5} />
    </div>
  )
}
