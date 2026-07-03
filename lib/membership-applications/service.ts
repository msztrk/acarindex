import type { MembershipApplicationType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/auth/audit'

export type SubmitMembershipApplicationInput = {
  userId: string
  type: MembershipApplicationType
  journalId?: bigint | null
  institutionId?: bigint | null
  payload?: Record<string, unknown> | null
}

export async function submitMembershipApplication(input: SubmitMembershipApplicationInput) {
  if (input.type === 'journal_editor' && !input.journalId) {
    throw new Error('journal_id required for journal_editor application')
  }
  if (input.type === 'institution_manager' && !input.institutionId) {
    throw new Error('institution_id required for institution_manager application')
  }

  const pendingWhere =
    input.type === 'journal_editor'
      ? {
          userId: input.userId,
          type: input.type,
          journalId: input.journalId!,
          status: 'pending' as const,
        }
      : {
          userId: input.userId,
          type: input.type,
          institutionId: input.institutionId!,
          status: 'pending' as const,
        }

  const existing = await prisma.membershipApplication.findFirst({ where: pendingWhere })
  if (existing) {
    throw new Error('pending application already exists for this target')
  }

  const row = await prisma.membershipApplication.create({
    data: {
      userId: input.userId,
      type: input.type,
      journalId: input.journalId ?? null,
      institutionId: input.institutionId ?? null,
      payload: input.payload ? (input.payload as Prisma.InputJsonValue) : undefined,
      status: 'pending',
    },
  })

  await logAudit({
    actorId: input.userId,
    action: 'membership_application.submit',
    entityType: input.type,
    entityId: input.journalId?.toString() ?? input.institutionId?.toString() ?? '',
    newValues: { applicationId: row.id },
  })

  return row
}

export async function listMembershipApplicationsForUser(userId: string) {
  return prisma.membershipApplication.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

export async function listPendingMembershipApplications(limit = 100) {
  return prisma.membershipApplication.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
    take: limit,
    include: {
      user: { select: { email: true, name: true } },
      journal: { select: { titleTr: true, slug: true } },
      institution: { select: { nameTr: true } },
    },
  })
}

export async function reviewMembershipApplication(input: {
  id: string
  reviewerId: string
  status: 'approved' | 'rejected'
  reviewNote?: string
}) {
  const app = await prisma.membershipApplication.findUnique({ where: { id: input.id } })
  if (!app || app.status !== 'pending') {
    throw new Error('Application not pending')
  }

  const now = new Date()

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.membershipApplication.update({
      where: { id: input.id },
      data: {
        status: input.status,
        reviewedBy: input.reviewerId,
        reviewedAt: now,
        reviewNote: input.reviewNote ?? null,
      },
    })

    if (input.status === 'approved') {
      if (app.type === 'journal_editor' && app.journalId) {
        await tx.journalMembership.upsert({
          where: {
            userId_journalId: { userId: app.userId, journalId: app.journalId },
          },
          create: {
            userId: app.userId,
            journalId: app.journalId,
            role: 'journal_editor',
            status: 'approved',
            approvedBy: input.reviewerId,
            approvedAt: now,
          },
          update: {
            role: 'journal_editor',
            status: 'approved',
            approvedBy: input.reviewerId,
            approvedAt: now,
            suspendedAt: null,
            revokedAt: null,
          },
        })
      } else if (app.type === 'institution_manager' && app.institutionId) {
        await tx.institutionMembership.upsert({
          where: {
            userId_institutionId: { userId: app.userId, institutionId: app.institutionId },
          },
          create: {
            userId: app.userId,
            institutionId: app.institutionId,
            role: 'institution_manager',
            status: 'approved',
            approvedBy: input.reviewerId,
            approvedAt: now,
          },
          update: {
            role: 'institution_manager',
            status: 'approved',
            approvedBy: input.reviewerId,
            approvedAt: now,
            suspendedAt: null,
            revokedAt: null,
          },
        })
      }
    }

    return updated
  })

  await logAudit({
    actorId: input.reviewerId,
    action: `membership_application.${input.status}`,
    entityType: app.type,
    entityId: app.journalId?.toString() ?? app.institutionId?.toString() ?? '',
    oldValues: { status: app.status },
    newValues: { status: input.status, applicationId: app.id },
  })

  return row
}
