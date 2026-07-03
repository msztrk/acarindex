import { redirect } from 'next/navigation'
import type { JournalMembershipRole } from '@prisma/client'
import {
  listApprovedInstitutionMemberships,
  listApprovedJournalMemberships,
  requireInstitutionAccess,
  requireJournalAccess,
} from '@/lib/auth/authorization'
import { requireUserAuth } from '@/lib/auth/guards'
import type { SessionPayload } from '@/lib/auth/session'

export type EditorPanelContext = SessionPayload & {
  journalId: bigint
  membership: Awaited<ReturnType<typeof requireJournalAccess>>
}

export type InstitutionPanelContext = SessionPayload & {
  institutionId: bigint
  membership: Awaited<ReturnType<typeof requireInstitutionAccess>>
}

export async function requireEditorPanelSession(): Promise<SessionPayload> {
  return requireUserAuth()
}

export async function requireEditorJournalSession(
  journalIdRaw: string,
  requiredRole?: JournalMembershipRole,
): Promise<EditorPanelContext> {
  const session = await requireEditorPanelSession()
  let journalId: bigint
  try {
    journalId = BigInt(journalIdRaw)
  } catch {
    redirect('/forbidden')
  }

  try {
    const membership = await requireJournalAccess(session.user.id, journalId, requiredRole)
    return { ...session, journalId, membership }
  } catch {
    redirect('/forbidden')
  }
}

export async function requireInstitutionPanelSession(
  institutionIdRaw: string,
  requiredRole?: 'institution_manager' | 'institution_viewer',
): Promise<InstitutionPanelContext> {
  const session = await requireUserAuth()
  let institutionId: bigint
  try {
    institutionId = BigInt(institutionIdRaw)
  } catch {
    redirect('/forbidden')
  }

  try {
    const membership = await requireInstitutionAccess(
      session.user.id,
      institutionId,
      requiredRole,
    )
    return { ...session, institutionId, membership }
  } catch {
    redirect('/forbidden')
  }
}

export async function getEditorPanelJournalIds(userId: string): Promise<bigint[]> {
  const rows = await listApprovedJournalMemberships(userId)
  return rows.map((r) => r.journalId)
}

export async function getInstitutionPanelIds(userId: string): Promise<bigint[]> {
  const rows = await listApprovedInstitutionMemberships(userId)
  return rows.map((r) => r.institutionId)
}
