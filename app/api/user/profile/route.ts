import { NextResponse } from 'next/server'
import { getApiActiveUserSession } from '@/lib/auth/api-guards'
import { validateCsrf } from '@/lib/auth/session'
import { listActiveCategories } from '@/lib/data/catalog'
import {
  getUserProfile,
  updateUserProfile,
  validateProfileCategorySelections,
} from '@/lib/user-panel/profile'

function clientIp(request: Request): string | undefined {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
}

export async function GET() {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  const profile = await getUserProfile(sessionOrRes.user.id)
  return NextResponse.json(profile)
}

export async function PATCH(request: Request) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }

  const body = (await request.json()) as Record<string, unknown>
  const input = {
    firstName: typeof body.firstName === 'string' ? body.firstName : undefined,
    lastName: typeof body.lastName === 'string' ? body.lastName : undefined,
    institution: typeof body.institution === 'string' ? body.institution : undefined,
    scienceField: typeof body.scienceField === 'string' ? body.scienceField : undefined,
    interestAreas: Array.isArray(body.interestAreas)
      ? body.interestAreas.filter((v): v is string => typeof v === 'string')
      : undefined,
  }

  const categories = await listActiveCategories()
  const labels = categories.map((c) => c.name_tr).filter((v): v is string => Boolean(v))

  if (
    labels.length > 0 &&
    !validateProfileCategorySelections(
      input.scienceField ?? '',
      input.interestAreas ?? [],
      labels,
    )
  ) {
    return NextResponse.json({ error: 'Geçersiz alan seçimi.' }, { status: 400 })
  }

  const profile = await updateUserProfile(sessionOrRes.user.id, input, clientIp(request))
  return NextResponse.json(profile)
}
