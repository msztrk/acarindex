import { NextResponse } from 'next/server'

import { revalidateEnglishContentCache } from '@/lib/i18n/revalidate-english-content'

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET
  if (!secret?.trim()) {
    return NextResponse.json({ error: 'revalidation not configured' }, { status: 503 })
  }

  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  revalidateEnglishContentCache()
  return NextResponse.json({ ok: true })
}
