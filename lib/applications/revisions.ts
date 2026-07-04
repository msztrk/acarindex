import type { ApplicationRevisionSubmissionType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

export type RevisionSnapshot = {
  title: string
  kind: string
  draftPayload: Record<string, unknown> | null
  attachmentIds: string[]
  /** PII excluded — private contact loaded separately by id */
  hasPrivateContact: boolean
}

export async function getNextRevisionNumber(applicationId: string): Promise<number> {
  const last = await prisma.applicationRevision.findFirst({
    where: { applicationId },
    orderBy: { revisionNumber: 'desc' },
    select: { revisionNumber: true },
  })
  return (last?.revisionNumber ?? 0) + 1
}

export async function createApplicationRevision(input: {
  applicationId: string
  createdBy: string
  submissionType: ApplicationRevisionSubmissionType
  snapshot: RevisionSnapshot
}) {
  const revisionNumber = await getNextRevisionNumber(input.applicationId)
  return prisma.applicationRevision.create({
    data: {
      applicationId: input.applicationId,
      revisionNumber,
      snapshotJson: input.snapshot as unknown as Prisma.InputJsonValue,
      createdBy: input.createdBy,
      submissionType: input.submissionType,
    },
  })
}

export async function listApplicationRevisions(applicationId: string) {
  return prisma.applicationRevision.findMany({
    where: { applicationId },
    orderBy: { revisionNumber: 'desc' },
  })
}
