import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/auth/audit'

export type RecordApplicationEventInput = {
  applicationId: string
  eventType: string
  actorId?: string | null
  fromStatus?: string | null
  toStatus?: string | null
  metadata?: Record<string, unknown> | null
}

export async function recordApplicationEvent(input: RecordApplicationEventInput) {
  const row = await prisma.applicationEvent.create({
    data: {
      applicationId: input.applicationId,
      eventType: input.eventType,
      actorId: input.actorId ?? null,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined,
    },
  })

  await logAudit({
    actorId: input.actorId ?? null,
    action: `content_application.${input.eventType}`,
    entityType: 'content_application',
    entityId: input.applicationId,
    oldValues: input.fromStatus ? { status: input.fromStatus } : undefined,
    newValues: {
      status: input.toStatus ?? undefined,
      ...(input.metadata ?? {}),
    },
  })

  return row
}
