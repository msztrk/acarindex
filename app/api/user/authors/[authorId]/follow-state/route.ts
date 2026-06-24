import { NextResponse } from 'next/server'
import { getApiActiveUserSession } from '@/lib/auth/api-guards'
import { isAuthorFollowed } from '@/lib/user-panel/follows'
import { prisma } from '@/lib/db/prisma'

export async function GET(
  _request: Request,
  context: { params: Promise<{ authorId: string }> },
) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  const { authorId } = await context.params
  const id = parseInt(authorId, 10)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Geçersiz yazar' }, { status: 400 })
  }
  const author = await prisma.author.findUnique({
    where: { id: BigInt(id) },
    select: { isProvisional: true },
  })
  const following = await isAuthorFollowed(sessionOrRes.user.id, id)
  return NextResponse.json({
    following,
    canFollow: author ? !author.isProvisional : false,
    isProvisional: author?.isProvisional ?? false,
  })
}
