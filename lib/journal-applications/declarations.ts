/**
 * Merkezi beyan metni sürümleri — Faz B1 foundation.
 * Submit sırasında kabul edilen sürüm burada tanımlı olmalıdır.
 */
export const APPLICATION_DECLARATION_VERSIONS = {
  criteria: '2026-07-01',
  standards: '2026-07-01',
  privacyNotice: '2026-07-01',
  imageRights: '2026-07-01',
  informationAccuracy: '2026-07-01',
} as const

export type DeclarationKey = keyof typeof APPLICATION_DECLARATION_VERSIONS

export const APPLICATION_DECLARATION_LABELS: Record<DeclarationKey, string> = {
  criteria:
    'Acarindex dergi kabul kriterlerini okudum ve dergimizin bu kriterleri karşıladığını beyan ederim.',
  standards:
    'Acarindex teknik ve içerik standartlarına uyacağımızı kabul ediyorum.',
  privacyNotice:
    'Kişisel verilerin işlenmesine ilişkin aydınlatma metnini okudum ve kabul ediyorum.',
  imageRights:
    'Kapak görseli ve ek belgeler için gerekli kullanım haklarına sahip olduğumuzu beyan ederim.',
  informationAccuracy:
    'Başvuruda verdiğim bilgilerin doğru ve güncel olduğunu onaylıyorum.',
}

export type DeclarationAcceptanceInput = {
  criteriaAcceptedAt?: Date | null
  standardsAcceptedAt?: Date | null
  privacyNoticeAcceptedAt?: Date | null
  imageRightsAcceptedAt?: Date | null
  informationAccuracyConfirmedAt?: Date | null
}

export type DeclarationAcceptanceRecord = {
  criteriaVersion: string | null
  criteriaAcceptedAt: Date | null
  standardsVersion: string | null
  standardsAcceptedAt: Date | null
  privacyNoticeVersion: string | null
  privacyNoticeAcceptedAt: Date | null
  imageRightsVersion: string | null
  imageRightsAcceptedAt: Date | null
  informationAccuracyVersion: string | null
  informationAccuracyConfirmedAt: Date | null
}

/** Taslak kayıtta kısmi kabul; submit'te tümü zorunlu (Faz B2/B3). */
export function buildDeclarationAcceptanceRecord(
  input: DeclarationAcceptanceInput,
): DeclarationAcceptanceRecord {
  return {
    criteriaVersion: input.criteriaAcceptedAt
      ? APPLICATION_DECLARATION_VERSIONS.criteria
      : null,
    criteriaAcceptedAt: input.criteriaAcceptedAt ?? null,
    standardsVersion: input.standardsAcceptedAt
      ? APPLICATION_DECLARATION_VERSIONS.standards
      : null,
    standardsAcceptedAt: input.standardsAcceptedAt ?? null,
    privacyNoticeVersion: input.privacyNoticeAcceptedAt
      ? APPLICATION_DECLARATION_VERSIONS.privacyNotice
      : null,
    privacyNoticeAcceptedAt: input.privacyNoticeAcceptedAt ?? null,
    imageRightsVersion: input.imageRightsAcceptedAt
      ? APPLICATION_DECLARATION_VERSIONS.imageRights
      : null,
    imageRightsAcceptedAt: input.imageRightsAcceptedAt ?? null,
    informationAccuracyVersion: input.informationAccuracyConfirmedAt
      ? APPLICATION_DECLARATION_VERSIONS.informationAccuracy
      : null,
    informationAccuracyConfirmedAt: input.informationAccuracyConfirmedAt ?? null,
  }
}

export function isDeclarationCompleteForSubmit(record: DeclarationAcceptanceRecord): boolean {
  const v = APPLICATION_DECLARATION_VERSIONS
  return (
    record.criteriaVersion === v.criteria &&
    record.criteriaAcceptedAt != null &&
    record.standardsVersion === v.standards &&
    record.standardsAcceptedAt != null &&
    record.privacyNoticeVersion === v.privacyNotice &&
    record.privacyNoticeAcceptedAt != null &&
    record.imageRightsVersion === v.imageRights &&
    record.imageRightsAcceptedAt != null &&
    record.informationAccuracyVersion === v.informationAccuracy &&
    record.informationAccuracyConfirmedAt != null
  )
}
