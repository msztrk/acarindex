import { CatalogPageSkeleton } from '@/components/catalog/CatalogPageSkeleton'

export default function SearchLoading() {
  return (
    <div className="content-width py-6 md:py-8">
      <div className="h-9 w-48 bg-secondary/80 rounded animate-pulse mb-6" aria-hidden />
      <CatalogPageSkeleton rows={8} />
    </div>
  )
}
