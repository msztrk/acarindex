import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

export type EnqueueNotificationInput = {
  type: string
  recipient: string
  payload: Record<string, unknown>
}

/** Enqueue inside an open transaction — does not send email. */
export async function enqueueNotification(
  tx: Prisma.TransactionClient,
  input: EnqueueNotificationInput,
) {
  return tx.notificationOutbox.create({
    data: {
      type: input.type,
      recipient: input.recipient,
      payload: input.payload as Prisma.InputJsonValue,
    },
  })
}

export async function enqueueNotificationStandalone(input: EnqueueNotificationInput) {
  return prisma.notificationOutbox.create({
    data: {
      type: input.type,
      recipient: input.recipient,
      payload: input.payload as Prisma.InputJsonValue,
    },
  })
}
