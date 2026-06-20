export default function ArticleLoading() {
  return (
    <div className="content-width py-6 lg:py-10 animate-pulse">
      <div className="h-4 w-48 bg-muted rounded mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
        <div className="space-y-4">
          <div className="h-8 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="flex gap-2 mt-4">
            <div className="h-6 w-16 bg-muted rounded-full" />
            <div className="h-6 w-16 bg-muted rounded-full" />
          </div>
          <div className="space-y-2 mt-6">
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-5/6" />
            <div className="h-4 bg-muted rounded w-4/5" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-32 bg-muted rounded-lg" />
          <div className="h-28 bg-muted rounded-lg" />
        </div>
      </div>
    </div>
  )
}
