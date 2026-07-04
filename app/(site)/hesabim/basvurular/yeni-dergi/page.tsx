import { redirect, notFound } from 'next/navigation'
import { requireUserAuth } from '@/lib/auth/guards'
import { listActiveCategories } from '@/lib/data/catalog'
import { getJournalApplicationForUser, createJournalApplicationDraft } from '@/lib/journal-applications/service'
import { EDITABLE_CONTENT_STATUSES } from '@/lib/applications/types'
import { JournalApplicationWizard } from '@/components/journal-applications/JournalApplicationWizard'
import { prisma } from '@/lib/db/prisma'

export const metadata = { title: 'Yeni dergi başvurusu | Hesabım' }

export default async function YeniDergiBasvuruPage({
  searchParams,
}: {
  searchParams: Promise<{ applicationId?: string }>
}) {
  const session = await requireUserAuth()
  const { applicationId } = await searchParams

  let contentApplicationId = applicationId

  if (!contentApplicationId) {
    const created = await createJournalApplicationDraft(session.user.id)
    redirect(`/hesabim/basvurular/yeni-dergi?applicationId=${created.contentApplicationId}`)
  }

  const content = await prisma.contentApplication.findFirst({
    where: { id: contentApplicationId, userId: session.user.id, kind: 'new_journal' },
    select: { id: true, status: true },
  })

  if (!content) notFound()

  if (!EDITABLE_CONTENT_STATUSES.includes(content.status)) {
    redirect(`/hesabim/basvurular/${contentApplicationId}`)
  }

  let initialData
  try {
    initialData = await getJournalApplicationForUser(contentApplicationId, session.user.id)
  } catch {
    notFound()
  }

  const categories = await listActiveCategories()

  return (
    <JournalApplicationWizard
      contentApplicationId={contentApplicationId}
      initialData={initialData}
      categories={categories}
    />
  )
}
