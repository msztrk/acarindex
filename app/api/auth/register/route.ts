import { NextResponse } from 'next/server'
import { isUserAuthEnabled } from '@/lib/features/user-auth'
import { validateCsrf } from '@/lib/auth/session'
import { registerPublicUser } from '@/lib/auth/registration'
import { getCurrentLegalDocuments } from '@/lib/auth/legal'

export async function GET() {
  if (!isUserAuthEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const documents = await getCurrentLegalDocuments()
  return NextResponse.json({ documents })
}

export async function POST(request: Request) {
  if (!isUserAuthEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }

  const body = (await request.json()) as {
    email?: string
    password?: string
    name?: string
    acceptedDocumentIds?: string[]
    marketingOptIn?: boolean
    website?: string
    captchaToken?: string
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined
  const userAgent = request.headers.get('user-agent') ?? undefined

  const result = await registerPublicUser({
    email: body.email ?? '',
    password: body.password ?? '',
    name: body.name,
    acceptedDocumentIds: body.acceptedDocumentIds ?? [],
    marketingOptIn: body.marketingOptIn ?? false,
    honeypot: body.website,
    captchaToken: body.captchaToken,
    ipAddress: ip,
    userAgent,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const response = NextResponse.json({
    ok: true,
    requiresVerification: result.requiresVerification ?? false,
  })
  for (const cookie of result.cookies ?? []) {
    response.cookies.set(cookie.name, cookie.value, cookie.options as never)
  }
  return response
}
