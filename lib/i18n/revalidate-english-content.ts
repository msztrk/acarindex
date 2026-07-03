import 'server-only'

import { revalidatePath, revalidateTag } from 'next/cache'

import { I18N_EN_CONTENT_TAG, I18N_SITEMAP_TAG } from '@/lib/i18n/cache-tags'

/** Invalidate EN sitemap, alternate locale API, and related cached routes. */
export function revalidateEnglishContentCache(): void {
  revalidateTag(I18N_EN_CONTENT_TAG, 'max')
  revalidateTag(I18N_SITEMAP_TAG, 'max')
  revalidatePath('/sitemap.xml')
  revalidatePath('/sitemap-journals-en')
  revalidatePath('/sitemap-articles-en', 'layout')
  revalidatePath('/api/locale/alternate')
}
