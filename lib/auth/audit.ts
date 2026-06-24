import { prisma } from '@/lib/db/prisma'

export async function writeAuditLog(input: {
  actorId?: string | null
  action: string
  resource?: string
  resourceId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string | null
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId,
      metadata: input.metadata ? (input.metadata as object) : undefined,
      ipAddress: input.ipAddress ?? null,
    },
  })
}
