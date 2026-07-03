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
