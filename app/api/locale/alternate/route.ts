import { NextResponse } from 'next/server'
import { resolveAlternateLocaleUrls } from '@/lib/i18n/alternate-url'

export const revalidate = 3600

export async function GET(request: Request) {
  const url = new URL(request.url)
  const path = url.searchParams.get('path') ?? '/'
  const alternates = await resolveAlternateLocaleUrls(path)
  return NextResponse.json(alternates)
}
