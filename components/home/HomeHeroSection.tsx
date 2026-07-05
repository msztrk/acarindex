import { HomeHero } from '@/components/home/HomeHero'
import { loadHomeStats, type HomeQaMode } from '@/lib/home/data'
import { getHomeHeroContent } from '@/lib/site-content/home-hero'
import { getRequestLocale } from '@/lib/i18n/request-locale'
import { getUiMessages } from '@/lib/i18n/ui-messages'

export async function HomeHeroSection({ qa }: { qa?: HomeQaMode }) {
  const locale = await getRequestLocale()
  const ui = getUiMessages(locale)
  const [stats, heroContent] = await Promise.all([loadHomeStats(qa), getHomeHeroContent()])

  return (
    <HomeHero
      heroTitle={heroContent.title}
      heroSubtitle={heroContent.subtitle}
      journalCount={stats.journalCount}
      articleCount={stats.articleCount}
      pdfCount={stats.pdfCount}
      pdfCountExact={stats.pdfCountExact}
      statsError={stats.statsError}
      ui={ui}
    />
  )
}
