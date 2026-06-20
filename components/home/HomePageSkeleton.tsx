export function HomeHeroSkeleton() {
  return (
    <section className="border-b border-border bg-background" aria-busy="true" aria-label="Yükleniyor">
      <div className="content-width py-8 md:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-8 lg:gap-14">
          <div className="min-w-0">
            <div className="h-3 w-32 rounded bg-muted animate-pulse mb-3" />
            <div className="h-7 sm:h-8 w-full max-w-xl rounded bg-muted animate-pulse mb-5" />
            <div className="h-11 w-full max-w-[820px] rounded-lg bg-muted animate-pulse" />
            <div className="h-3 w-48 rounded bg-muted animate-pulse mt-2" />
            <div className="mt-5 grid grid-cols-2 gap-3 max-w-sm">
              <div className="h-8 rounded bg-muted animate-pulse" />
              <div className="h-8 rounded bg-muted animate-pulse" />
              <div className="col-span-2 h-8 rounded bg-muted animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function HomeContentSkeleton() {
  return (
    <section className="content-width py-10 md:py-12" aria-busy="true" aria-label="İçerik yükleniyor">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-10 lg:gap-14">
        <div>
          <div className="flex justify-between mb-4">
            <div className="h-6 w-40 rounded bg-muted animate-pulse" />
            <div className="h-4 w-24 rounded bg-muted animate-pulse" />
          </div>
          <ul className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="py-4 space-y-2">
                <div className="h-4 w-full rounded bg-muted animate-pulse" />
                <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
              </li>
            ))}
          </ul>
        </div>
        <aside className="space-y-8">
          <div className="space-y-3">
            <div className="h-4 w-32 rounded bg-muted animate-pulse" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 w-full rounded bg-muted animate-pulse" />
            ))}
          </div>
        </aside>
      </div>
    </section>
  )
}

export function HomePageSkeleton() {
  return (
    <div>
      <HomeHeroSkeleton />
      <HomeContentSkeleton />
    </div>
  )
}
