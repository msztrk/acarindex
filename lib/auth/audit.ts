import { prisma } from '@/lib/db/prisma'

export type AuditLogInput = {
  actorId?: string | null
  action: string
  resource?: string
  resourceId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string | null
  entityType?: string | null
  entityId?: string | null
  oldValues?: Record<string, unknown> | null
  newValues?: Record<string, unknown> | null
  userAgent?: string | null
  requestId?: string | null
}

/** @deprecated Prefer logAudit */
export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  await logAudit(input)
}

export async function logAudit(input: AuditLogInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId,
      metadata: input.metadata ? (input.metadata as object) : undefined,
      ipAddress: input.ipAddress ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      oldValues: input.oldValues ? (input.oldValues as object) : undefined,
      newValues: input.newValues ? (input.newValues as object) : undefined,
      userAgent: input.userAgent ?? null,
      requestId: input.requestId ?? null,
    },
  })
}
