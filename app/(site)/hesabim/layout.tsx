import { redirect } from 'next/navigation'
import { isUserAuthEnabled, isAdminPanelEnabled } from '@/lib/features/user-auth'
import { requireUserAuth } from '@/lib/auth/guards'
import { HesabimNav } from '@/components/user-panel/HesabimNav'
import { LogoutButton } from '@/components/auth/LogoutButton'
import Link from 'next/link'
import { canAccessAdminPanel } from '@/lib/auth/roles'
import {
  listApprovedInstitutionMemberships,
  listApprovedJournalMemberships,
} from '@/lib/auth/authorization'
import { getRequestLocale } from '@/lib/i18n/request-locale'
import { getUiMessages } from '@/lib/i18n/ui-messages'
import { withLocalePath } from '@/lib/i18n/locale'

export const dynamic = 'force-dynamic'

export default async function HesabimLayout({ children }: { children: React.ReactNode }) {
  if (!isUserAuthEnabled()) {
    redirect('/')
  }

  const session = await requireUserAuth()
  const locale = await getRequestLocale()
  const m = getUiMessages(locale)
  const lp = (path: string) => withLocalePath(path, locale)
  const showAdmin =
    isAdminPanelEnabled() && canAccessAdminPanel(session.user.roles)

  const [journalMemberships, institutionMemberships] = await Promise.all([
    listApprovedJournalMemberships(session.user.id),
    listApprovedInstitutionMemberships(session.user.id),
  ])
  const showEditorPanel = journalMemberships.length > 0
  const showInstitutionPanel = institutionMemberships.length > 0

  return (
    <div className="content-width py-8 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-foreground">{m.account.title}</h1>
        <div className="flex items-center gap-4 text-[0.9375rem]">
          <Link
            href={lp('/editor')}
            className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            {showEditorPanel ? m.account.editorPanel : m.account.editorApply}
          </Link>
          <Link
            href={lp('/kurum')}
            className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            {showInstitutionPanel ? m.account.institutionPanel : m.account.institutionApply}
          </Link>
          {showAdmin && (
            <Link
              href="/admin"
              className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              {m.account.adminPanel}
            </Link>
          )}
          <LogoutButton />
        </div>
      </div>
      <p className="text-[0.9375rem] text-muted-foreground mb-6">{session.user.email}</p>
      <div
        className="grid grid-cols-1 lg:grid-cols-[minmax(12rem,14rem)_minmax(0,1fr)] xl:grid-cols-[minmax(13rem,15rem)_minmax(0,1fr)] gap-6 lg:gap-8 xl:gap-10 items-start"
      >
        <HesabimNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
