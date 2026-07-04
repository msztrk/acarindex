import { ForbiddenError } from '@/lib/auth/forbidden'
import { prisma } from '@/lib/db/prisma'
import type { ContentApplication } from '@prisma/client'

export async function getContentApplicationForUser(
  applicationId: string,
  userId: string,
): Promise<ContentApplication | null> {
  return prisma.contentApplication.findFirst({
    where: { id: applicationId, userId },
  })
}

export async function requireContentApplicationOwner(
  applicationId: string,
  userId: string,
): Promise<ContentApplication> {
  const row = await getContentApplicationForUser(applicationId, userId)
  if (!row) throw new ForbiddenError()
  return row
}

export async function getContentApplicationForAdminOrOwner(
  applicationId: string,
  userId: string,
  isAdmin: boolean,
): Promise<ContentApplication | null> {
  if (isAdmin) {
    return prisma.contentApplication.findUnique({ where: { id: applicationId } })
  }
  return getContentApplicationForUser(applicationId, userId)
}
