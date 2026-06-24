import { requireUserAuth } from '@/lib/auth/guards'
import { listReadingLists } from '@/lib/user-panel/reading-lists'
import { ReadingListsManager } from '@/components/user-panel/ReadingListsManager'

export const metadata = { title: 'Okuma Listelerim | Hesabım' }

export default async function ListelerPage() {
  const session = await requireUserAuth()
  const lists = await listReadingLists(session.user.id)

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Okuma Listelerim</h2>
      <ReadingListsManager initialLists={lists} />
    </div>
  )
}
