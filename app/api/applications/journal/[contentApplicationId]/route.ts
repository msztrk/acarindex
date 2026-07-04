import { NextResponse } from 'next/server'
import { getApiActiveUserSession } from '@/lib/auth/api-guards'
import {
  getJournalApplicationForUser,
  parsePublisherInstitutionId,
  parseSubjectAreasFromApi,
  saveJournalApplicationDraft,
} from '@/lib/journal-applications/service'
import { validateCsrf } from '@/lib/auth/session'
import { isForbiddenError } from '@/lib/auth/forbidden'
import type { JournalApplicationDraftInput } from '@/lib/journal-applications/types'
import type { DeclarationAcceptanceInput } from '@/lib/journal-applications/declarations'

type RouteCtx = { params: Promise<{ contentApplicationId: string }> }

function parseJournalBody(raw: Record<string, unknown> | undefined): JournalApplicationDraftInput | undefined {
  if (!raw) return undefined
  return {
    nameTr: raw.nameTr as string | null | undefined,
    nameEn: raw.nameEn as string | null | undefined,
    abbreviation: raw.abbreviation as string | null | undefined,
    publisherInstitutionId: parsePublisherInstitutionId(
      raw.publisherInstitutionId as string | number | null | undefined,
    ),
    proposedInstitutionName: raw.proposedInstitutionName as string | null | undefined,
    journalType: raw.journalType as string | null | undefined,
    publishingPlatform: raw.publishingPlatform as string | null | undefined,
    websiteUrl: raw.websiteUrl as string | null | undefined,
    pIssn: raw.pIssn as string | null | undefined,
    eIssn: raw.eIssn as string | null | undefined,
    firstPublicationYear:
      raw.firstPublicationYear != null ? Number(raw.firstPublicationYear) : undefined,
    publicationFrequency: raw.publicationFrequency as JournalApplicationDraftInput['publicationFrequency'],
    publicationMonths: Array.isArray(raw.publicationMonths)
      ? raw.publicationMonths.map((m) => Number(m))
      : undefined,
    correspondenceAddress: raw.correspondenceAddress as string | null | undefined,
    editorName: raw.editorName as string | null | undefined,
    editorTitle: raw.editorTitle as string | null | undefined,
    editorEmail: raw.editorEmail as string | null | undefined,
    editorOrcid: raw.editorOrcid as string | null | undefined,
    editorProfileUrl: raw.editorProfileUrl as string | null | undefined,
    officialJournalUrl: raw.officialJournalUrl as string | null | undefined,
    editorialBoardUrl: raw.editorialBoardUrl as string | null | undefined,
    latestIssueUrl: raw.latestIssueUrl as string | null | undefined,
    platformProfileUrl: raw.platformProfileUrl as string | null | undefined,
    publisherPageUrl: raw.publisherPageUrl as string | null | undefined,
    keywords: Array.isArray(raw.keywords) ? raw.keywords.map(String) : undefined,
  }
}

function parseDeclarationBody(raw: Record<string, unknown> | undefined): DeclarationAcceptanceInput | undefined {
  if (!raw) return undefined
  const toDate = (value: unknown) => (value ? new Date(String(value)) : null)
  return {
    criteriaAcceptedAt: toDate(raw.criteriaAcceptedAt),
    standardsAcceptedAt: toDate(raw.standardsAcceptedAt),
    privacyNoticeAcceptedAt: toDate(raw.privacyNoticeAcceptedAt),
    imageRightsAcceptedAt: toDate(raw.imageRightsAcceptedAt),
    informationAccuracyConfirmedAt: toDate(raw.informationAccuracyConfirmedAt),
  }
}

export async function GET(_request: Request, context: RouteCtx) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes

  const { contentApplicationId } = await context.params
  try {
    const data = await getJournalApplicationForUser(contentApplicationId, sessionOrRes.user.id)
    return NextResponse.json(data)
  } catch (err) {
    if (isForbiddenError(err)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    throw err
  }
}

export async function PATCH(request: Request, context: RouteCtx) {
  const sessionOrRes = await getApiActiveUserSession()
  if (sessionOrRes instanceof NextResponse) return sessionOrRes
  if (!(await validateCsrf(request))) {
    return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  }

  const { contentApplicationId } = await context.params
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 })
  }

  try {
    const data = await saveJournalApplicationDraft({
      contentApplicationId,
      userId: sessionOrRes.user.id,
      journal: parseJournalBody(body.journal as Record<string, unknown> | undefined),
      subjectAreas: body.subjectAreas
        ? parseSubjectAreasFromApi(
            body.subjectAreas as Array<{ categoryId: string | number; level: string }>,
          )
        : undefined,
      declarationAcceptance: parseDeclarationBody(
        body.declarationAcceptance as Record<string, unknown> | undefined,
      ),
      privateContact: body.privateContact as
        | {
            contactName?: string | null
            contactRole?: string | null
            contactEmail?: string | null
            workPhone?: string | null
            mobilePhone?: string | null
          }
        | undefined,
      duplicateContinueReason: body.duplicateContinueReason as string | null | undefined,
    })
    return NextResponse.json(data)
  } catch (err) {
    if (isForbiddenError(err)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const message = err instanceof Error ? err.message : 'Update failed'
    return NextResponse.json({ error: message }, { status: 409 })
  }
}
