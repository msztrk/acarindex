import type { ApplicationStatus, ContentApplicationStatus } from '@prisma/client'
import type { ApplicationDisplayStatus } from '@/lib/applications/types'

const IN_REVIEW: ContentApplicationStatus[] = [
  'submitted',
  'precheck',
  'under_review',
]

export function mapContentStatusToDisplay(
  status: ContentApplicationStatus,
): ApplicationDisplayStatus {
  if (status === 'draft') return 'draft'
  if (IN_REVIEW.includes(status)) return 'in_review'
  if (status === 'revision_requested') return 'revision_requested'
  if (status === 'approved') return 'approved'
  if (status === 'rejected') return 'rejected'
  if (status === 'cancelled') return 'cancelled'
  return 'submitted'
}

export function mapMembershipStatusToDisplay(
  status: ApplicationStatus,
): ApplicationDisplayStatus {
  if (status === 'pending') return 'in_review'
  if (status === 'approved') return 'approved'
  if (status === 'rejected') return 'rejected'
  if (status === 'cancelled') return 'cancelled'
  return 'in_review'
}

export function contentDetailUrl(id: string): string {
  return `/hesabim/basvurular/${id}`
}

export function membershipDetailUrl(type: string, id: string): string {
  if (type === 'journal_editor') return `/editor/basvuru?ref=${id}`
  return `/kurum/basvuru?ref=${id}`
}
