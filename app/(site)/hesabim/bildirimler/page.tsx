import { requireUserAuth } from '@/lib/auth/guards'
import { getNotificationPreferences } from '@/lib/user-panel/notification-prefs'
import { NotificationPreferencesForm } from '@/components/user-panel/NotificationPreferencesForm'

export const metadata = { title: 'Bildirim Tercihleri | Hesabım' }

export default async function BildirimlerPage() {
  const session = await requireUserAuth()
  const prefs = await getNotificationPreferences(session.user.id)

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-serif font-semibold">Bildirim Tercihleri</h2>
      <NotificationPreferencesForm initial={prefs} />
    </div>
  )
}
