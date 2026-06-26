import { NextResponse } from 'next/server'
import { getApiAdminSession } from '@/lib/auth/api-guards'
import { validateCsrf } from '@/lib/auth/session'
import { getHomeHeroContent, updateHomeHeroContent } from '@/lib/site-content/home-hero'

export async function GET() {
  const sessionOrRes = await getApiAdminSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes

  const content = await getHomeHeroContent()
  return NextResponse.json(content)
}

export async function PATCH(request: Request) {
  const sessionOrRes = await getApiAdminSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF doğrulaması başarısız' }, { status: 403 })
  }

  const body = (await request.json()) as { title?: string; subtitle?: string | null }

  try {
    const content = await updateHomeHeroContent(body, sessionOrRes.user.id)
    return NextResponse.json({ ok: true, ...content })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Kayıt başarısız.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
