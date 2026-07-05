import type { SiteLocale } from '@/lib/i18n/locale'
import { enMessages } from './en'
import { trMessages, type UiMessages } from './tr'

export type { UiMessages }
export { trMessages, enMessages }

export function getUiMessages(locale: SiteLocale): UiMessages {
  return locale === 'en' ? enMessages : trMessages
}
