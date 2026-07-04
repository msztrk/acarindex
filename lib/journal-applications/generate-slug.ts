import type { Prisma } from '@prisma/client'
import { urlYap } from '@/lib/urls/slug'

export async function generateUniqueJournalSlug(
  tx: Prisma.TransactionClient,
  nameTr: string,
): Promise<string> {
  const base = urlYap(nameTr) || 'journal'
  let slug = base
  let suffix = 2

  while (
    await tx.journal.findFirst({
      where: { slug },
      select: { id: true },
    })
  ) {
    slug = `${base}-${suffix}`
    suffix += 1
  }

  return slug
}
