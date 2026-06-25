import { prisma } from '@/lib/db/prisma'
import { LEGAL_DOC_TYPES } from '@/lib/auth/config'

export interface LegalDocumentView {
  id: string
  type: string
  version: string
  publishedAt: string
  contentHash: string
  required: boolean
}

export async function getCurrentLegalDocuments(): Promise<LegalDocumentView[]> {
  const types = [LEGAL_DOC_TYPES.TERMS, LEGAL_DOC_TYPES.PRIVACY, LEGAL_DOC_TYPES.MARKETING]
  const docs: LegalDocumentView[] = []
  for (const type of types) {
    const doc = await prisma.legalDocument.findFirst({
      where: { type },
      orderBy: { publishedAt: 'desc' },
    })
    if (doc) {
      docs.push({
        id: doc.id,
        type: doc.type,
        version: doc.version,
        publishedAt: doc.publishedAt.toISOString(),
        contentHash: doc.contentHash,
        required: doc.required,
      })
    }
  }
  return docs
}

export async function recordLegalAcceptances(
  userId: string,
  input: {
    acceptedDocumentIds: string[]
    marketingOptIn?: boolean
  },
): Promise<{ ok: boolean; error?: string }> {
  const required = await prisma.legalDocument.findMany({
    where: { required: true, type: { in: [LEGAL_DOC_TYPES.TERMS, LEGAL_DOC_TYPES.PRIVACY] } },
    orderBy: { publishedAt: 'desc' },
  })

  const latestRequired = new Map<string, typeof required[0]>()
  for (const doc of required) {
    if (!latestRequired.has(doc.type)) latestRequired.set(doc.type, doc)
  }

  for (const doc of latestRequired.values()) {
    if (!input.acceptedDocumentIds.includes(doc.id)) {
      return { ok: false, error: 'Kullanım şartları ve gizlilik politikası onayı zorunludur.' }
    }
  }

  const toAccept = await prisma.legalDocument.findMany({
    where: { id: { in: input.acceptedDocumentIds } },
  })

  for (const doc of toAccept) {
    await prisma.userLegalAcceptance.upsert({
      where: { userId_documentId: { userId, documentId: doc.id } },
      create: {
        userId,
        documentId: doc.id,
        documentType: doc.type,
        documentVersion: doc.version,
        documentHash: doc.contentHash,
      },
      update: {
        acceptedAt: new Date(),
        documentVersion: doc.version,
        documentHash: doc.contentHash,
      },
    })
  }

  if (input.marketingOptIn) {
    const marketing = await prisma.legalDocument.findFirst({
      where: { type: LEGAL_DOC_TYPES.MARKETING },
      orderBy: { publishedAt: 'desc' },
    })
    if (marketing) {
      await prisma.userLegalAcceptance.upsert({
        where: { userId_documentId: { userId, documentId: marketing.id } },
        create: {
          userId,
          documentId: marketing.id,
          documentType: marketing.type,
          documentVersion: marketing.version,
          documentHash: marketing.contentHash,
        },
        update: {
          acceptedAt: new Date(),
          documentVersion: marketing.version,
          documentHash: marketing.contentHash,
        },
      })
    }
  }

  return { ok: true }
}

export async function getUserLegalSummary(userId: string): Promise<
  Array<{ type: string; version: string; acceptedAt: string }>
> {
  const rows = await prisma.userLegalAcceptance.findMany({
    where: { userId },
    orderBy: { acceptedAt: 'desc' },
  })
  return rows.map((r) => ({
    type: r.documentType,
    version: r.documentVersion,
    acceptedAt: r.acceptedAt.toISOString(),
  }))
}
