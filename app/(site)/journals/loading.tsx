import { CatalogPageSkeleton } from '@/components/catalog/CatalogPageSkeleton'

export default function JournalsLoading() {
  return (
    <div className="content-width-wide py-8">
      <div className="h-9 w-48 bg-secondary rounded mb-2 animate-pulse" />
      <div className="h-5 w-64 bg-secondary/70 rounded mb-8 animate-pulse" />
      <CatalogPageSkeleton rows={8} />
    </div>
  )
}
