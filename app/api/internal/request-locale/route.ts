import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { getRequestLocale } from '@/lib/i18n/request-locale'

/** Beta/debug — locale resolution probe (no auth; pilot noindex only). */
export async function GET() {
  const h = await headers()
  const c = await cookies()
  const entries: Record<string, string> = {}
  h.forEach((value, key) => {
    entries[key] = value
  })
  return NextResponse.json({
    locale: await getRequestLocale(),
    cookies: c.getAll().map(({ name, value }) => ({ name, value })),
    headers: entries,
  })
}
