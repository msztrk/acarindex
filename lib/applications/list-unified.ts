import { prisma } from '@/lib/db/prisma'
import { ForbiddenError } from '@/lib/auth/forbidden'
import type { UserApplicationListItem } from '@/lib/applications/types'
import {
  contentDetailUrl,
  mapContentStatusToDisplay,
  mapMembershipStatusToDisplay,
  membershipDetailUrl,
} from '@/lib/applications/status-map'
import { CONTENT_KIND_LABELS, MEMBERSHIP_KIND_LABELS } from '@/lib/applications/types'

export async function listUnifiedUserApplications(
  userId: string,
): Promise<UserApplicationListItem[]> {
  const [contentRows, membershipRows] = await Promise.all([
    prisma.contentApplication.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
    prisma.membershipApplication.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        journal: { select: { titleTr: true, slug: true } },
        institution: { select: { nameTr: true } },
      },
    }),
  ])

  const contentItems: UserApplicationListItem[] = contentRows.map((row) => ({
    id: row.id,
    source: 'content_application',
    kind: row.kind,
    displayStatus: mapContentStatusToDisplay(row.status),
    originalStatus: row.status,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    detailUrl: contentDetailUrl(row.id),
  }))

  const membershipItems: UserApplicationListItem[] = membershipRows.map((row) => {
    const kind =
      row.type === 'journal_editor' ? ('journal_editor' as const) : ('institution_manager' as const)
    const title =
      row.type === 'journal_editor'
        ? `${MEMBERSHIP_KIND_LABELS.journal_editor}: ${row.journal?.titleTr ?? row.journal?.slug ?? row.journalId}`
        : `${MEMBERSHIP_KIND_LABELS.institution_manager}: ${row.institution?.nameTr ?? row.institutionId}`

    return {
      id: row.id,
      source: 'membership_application',
      kind,
      displayStatus: mapMembershipStatusToDisplay(row.status),
      originalStatus: row.status,
      title,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      detailUrl: membershipDetailUrl(row.type, row.id),
    }
  })

  return [...contentItems, ...membershipItems].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

export async function getPrivateContactForAuthorizedUser(
  applicationId: string,
  userId: string,
  isAdmin: boolean,
) {
  const app = await prisma.contentApplication.findUnique({
    where: { id: applicationId },
    select: { userId: true },
  })
  if (!app) return null
  if (app.userId !== userId && !isAdmin) throw new ForbiddenError()

  return prisma.applicationPrivateContact.findUnique({
    where: { applicationId },
  })
}

export async function upsertPrivateContact(input: {
  applicationId: string
  userId: string
  data: {
    contactName?: string | null
    contactRole?: string | null
    contactEmail?: string | null
    workPhone?: string | null
    mobilePhone?: string | null
  }
}) {
  const app = await prisma.contentApplication.findFirst({
    where: { id: input.applicationId, userId: input.userId },
  })
  if (!app) throw new ForbiddenError()
  if (app.status !== 'draft' && app.status !== 'revision_requested') {
    throw new Error('Private contact editable only in draft or revision_requested')
  }

  return prisma.applicationPrivateContact.upsert({
    where: { applicationId: input.applicationId },
    create: {
      applicationId: input.applicationId,
      contactName: input.data.contactName ?? null,
      contactRole: input.data.contactRole ?? null,
      contactEmail: input.data.contactEmail ?? null,
      workPhone: input.data.workPhone ?? null,
      mobilePhone: input.data.mobilePhone ?? null,
    },
    update: {
      contactName: input.data.contactName ?? null,
      contactRole: input.data.contactRole ?? null,
      contactEmail: input.data.contactEmail ?? null,
      workPhone: input.data.workPhone ?? null,
      mobilePhone: input.data.mobilePhone ?? null,
    },
  })
}
