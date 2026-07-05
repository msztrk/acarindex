'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { SiteLocale } from '@/lib/i18n/locale'
import { withLocalePath } from '@/lib/i18n/locale'
import type { UiMessages } from '@/lib/i18n/ui-messages'

type LocaleContextValue = {
  locale: SiteLocale
  m: UiMessages
  lp: (path: string) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({
  locale,
  messages,
  children,
}: {
  locale: SiteLocale
  messages: UiMessages
  children: ReactNode
}) {
  const value = useMemo(
    () => ({
      locale,
      m: messages,
      lp: (path: string) => withLocalePath(path, locale),
    }),
    [locale, messages],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useUi(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    throw new Error('useUi must be used within LocaleProvider')
  }
  return ctx
}
