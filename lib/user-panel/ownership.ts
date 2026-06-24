import { prisma } from '@/lib/db/prisma'

export async function getReadingListForUser(userId: string, listId: string) {
  return prisma.readingList.findFirst({
    where: { id: listId, userId },
  })
}

export async function assertReadingListOwner(userId: string, listId: string): Promise<boolean> {
  const list = await getReadingListForUser(userId, listId)
  return Boolean(list)
}
