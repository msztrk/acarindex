import { notFound } from 'next/navigation'
import { requireUserAuth } from '@/lib/auth/guards'
import { getReadingListDetail } from '@/lib/user-panel/reading-lists'
import { ReadingListDetailEditor } from '@/components/user-panel/ReadingListDetailEditor'

export const metadata = { title: 'Okuma Listesi | Hesabım' }

export default async function ListeDetayPage({
  params,
}: {
  params: Promise<{ listId: string }>
}) {
  const session = await requireUserAuth()
  const { listId } = await params
  const list = await getReadingListDetail(session.user.id, listId)
  if (!list) notFound()

  return (
    <ReadingListDetailEditor
      listId={list.id}
      initialName={list.name}
      initialItems={list.items}
    />
  )
}
