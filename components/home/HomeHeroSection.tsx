import { HomeHero } from '@/components/home/HomeHero'
import { loadHomeStats, type HomeQaMode } from '@/lib/home/data'

export async function HomeHeroSection({ qa }: { qa?: HomeQaMode }) {
  const stats = await loadHomeStats(qa)

  return (
    <HomeHero
      journalCount={stats.journalCount}
      articleCount={stats.articleCount}
      pdfCount={stats.pdfCount}
      pdfCountExact={stats.pdfCountExact}
      statsError={stats.statsError}
    />
  )
}
