import type { ContentApplicationKind, ContentApplicationStatus } from '@prisma/client'

export type ApplicationListSource = 'content_application' | 'membership_application'

export type ApplicationListKind =
  | 'new_journal'
  | 'announcement'
  | 'data_correction'
  | 'journal_editor'
  | 'institution_manager'

export type ApplicationDisplayStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'revision_requested'
  | 'approved'
  | 'rejected'
  | 'cancelled'

export type UserApplicationListItem = {
  id: string
  source: ApplicationListSource
  kind: ApplicationListKind
  displayStatus: ApplicationDisplayStatus
  originalStatus: string
  title: string
  createdAt: string
  updatedAt: string
  detailUrl: string
}

export type ApplicationDraftPayload = Record<string, unknown>

export const EDITABLE_CONTENT_STATUSES: ContentApplicationStatus[] = [
  'draft',
  'revision_requested',
]

export const CONTENT_KIND_LABELS: Record<ContentApplicationKind, string> = {
  new_journal: 'Yeni dergi ekleme',
  announcement: 'Duyuru yayımlama',
  data_correction: 'Veri düzeltme',
}

export const MEMBERSHIP_KIND_LABELS = {
  journal_editor: 'Dergi yetkilisi olma',
  institution_manager: 'Kurum yöneticisi olma',
} as const
