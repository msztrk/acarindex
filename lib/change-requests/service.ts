import type { ChangeRequestStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { requiresChangeRequest } from '@/lib/auth/change-policy'
import { ForbiddenError } from '@/lib/auth/forbidden'
import { logAudit } from '@/lib/auth/audit'

export type CreateChangeRequestInput = {
  entityType: string
  entityId: string
  requestedBy: string
  changeType: string
  oldData?: Record<string, unknown> | null
  newData?: Record<string, unknown> | null
}

export async function createChangeRequest(input: CreateChangeRequestInput) {
  if (!requiresChangeRequest(input.changeType)) {
    throw new Error(`change_type not marked as critical: ${input.changeType}`)
  }

  const row = await prisma.changeRequest.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      requestedBy: input.requestedBy,
      changeType: input.changeType,
      oldData: input.oldData ? (input.oldData as Prisma.InputJsonValue) : undefined,
      newData: input.newData ? (input.newData as Prisma.InputJsonValue) : undefined,
      status: 'pending',
    },
  })

  await logAudit({
    actorId: input.requestedBy,
    action: 'change_request.create',
    entityType: input.entityType,
    entityId: input.entityId,
    newValues: { changeType: input.changeType, changeRequestId: row.id },
  })

  return row
}

export async function listChangeRequestsForUser(userId: string, limit = 50) {
  return prisma.changeRequest.findMany({
    where: { requestedBy: userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

export async function listPendingChangeRequests(limit = 100) {
  return prisma.changeRequest.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })
}

export async function reviewChangeRequest(input: {
  id: string
  reviewerId: string
  status: Extract<ChangeRequestStatus, 'approved' | 'rejected'>
  reviewNote?: string
}) {
  const existing = await prisma.changeRequest.findUnique({ where: { id: input.id } })
  if (!existing || existing.status !== 'pending') {
    throw new ForbiddenError('Change request not pending')
  }

  const row = await prisma.changeRequest.update({
    where: { id: input.id },
    data: {
      status: input.status,
      reviewedBy: input.reviewerId,
      reviewedAt: new Date(),
      reviewNote: input.reviewNote ?? null,
    },
  })

  await logAudit({
    actorId: input.reviewerId,
    action: `change_request.${input.status}`,
    entityType: existing.entityType,
    entityId: existing.entityId,
    oldValues: { status: existing.status },
    newValues: { status: input.status, reviewNote: input.reviewNote ?? null },
  })

  return row
}
