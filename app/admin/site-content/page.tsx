import { getHomeHeroContent } from '@/lib/site-content/home-hero'
import { HomeHeroSettingsForm } from '@/components/admin/HomeHeroSettingsForm'

export default async function AdminSiteContentPage() {
  const content = await getHomeHeroContent()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Site içeriği</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ana sayfa hero metinleri. SEO title ile bağımsızdır.
        </p>
      </div>
      <HomeHeroSettingsForm initial={content} />
    </div>
  )
}
