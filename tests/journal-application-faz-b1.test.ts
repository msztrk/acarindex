import { describe, expect, it } from 'vitest'
import {
  APPLICATION_DECLARATION_VERSIONS,
  buildDeclarationAcceptanceRecord,
  isDeclarationCompleteForSubmit,
} from '@/lib/journal-applications/declarations'
import {
  PRIMARY_SUBJECT_MAX,
  validateJournalKeywords,
  validateJournalSubjectAreas,
} from '@/lib/journal-applications/subject-areas'
import {
  formatIssn,
  isValidIssn,
  normalizeIssn,
  validateIssn,
  validateIssnCheckDigit,
  validateIssnPair,
} from '@/lib/validation/issn'

describe('journal-application faz b1 declarations', () => {
  it('exposes central declaration versions', () => {
    expect(APPLICATION_DECLARATION_VERSIONS.criteria).toBe('2026-07-01')
    expect(Object.keys(APPLICATION_DECLARATION_VERSIONS)).toHaveLength(5)
  })

  it('stores version only when acceptance timestamp provided', () => {
    const at = new Date('2026-07-04T12:00:00Z')
    const partial = buildDeclarationAcceptanceRecord({ criteriaAcceptedAt: at })
    expect(partial.criteriaVersion).toBe('2026-07-01')
    expect(partial.standardsVersion).toBeNull()
    expect(partial.criteriaAcceptedAt).toEqual(at)
  })

  it('requires all declarations for submit', () => {
    const at = new Date('2026-07-04T12:00:00Z')
    const complete = buildDeclarationAcceptanceRecord({
      criteriaAcceptedAt: at,
      standardsAcceptedAt: at,
      privacyNoticeAcceptedAt: at,
      imageRightsAcceptedAt: at,
      informationAccuracyConfirmedAt: at,
    })
    expect(isDeclarationCompleteForSubmit(complete)).toBe(true)
  })
})

describe('journal-application faz b1 keywords', () => {
  it('trims, dedupes case-insensitively and enforces bounds', () => {
    const result = validateJournalKeywords([
      '  Open Access ',
      'open access',
      'Peer Review',
      'Academic',
    ])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.keywords).toEqual(['Open Access', 'Peer Review', 'Academic'])
    }
  })

  it('rejects fewer than 3 keywords', () => {
    expect(validateJournalKeywords(['a', 'b']).ok).toBe(false)
  })

  it('rejects more than 10 keywords', () => {
    const many = Array.from({ length: 11 }, (_, i) => `kw${i}`)
    expect(validateJournalKeywords(many).ok).toBe(false)
  })
})

describe('journal-application faz b1 subject areas', () => {
  it('requires at least one primary and max three primary categories', () => {
    const ok = validateJournalSubjectAreas([
      { categoryId: BigInt(1), level: 'primary' },
      { categoryId: BigInt(2), level: 'secondary' },
    ])
    expect(ok.ok).toBe(true)

    const tooManyPrimary = validateJournalSubjectAreas(
      Array.from({ length: PRIMARY_SUBJECT_MAX + 1 }, (_, i) => ({
        categoryId: BigInt(i + 1),
        level: 'primary' as const,
      })),
    )
    expect(tooManyPrimary.ok).toBe(false)
  })

  it('rejects duplicate category', () => {
    const dup = validateJournalSubjectAreas([
      { categoryId: BigInt(5), level: 'primary' },
      { categoryId: BigInt(5), level: 'secondary' },
    ])
    expect(dup.ok).toBe(false)
  })
})

describe('issn validation foundation', () => {
  it('normalizes and validates check digit including X', () => {
    expect(normalizeIssn('0317-8471')).toBe('03178471')
    expect(validateIssnCheckDigit('03178471')).toBe(true)
    expect(isValidIssn('0317-8471')).toBe(true)
    expect(formatIssn('03178471')).toBe('0317-8471')
  })

  it('rejects invalid check digit', () => {
    expect(validateIssn('1234-5678').ok).toBe(false)
  })

  it('validateIssnPair requires at least one issn and rejects identical pair', () => {
    expect(validateIssnPair(null, null).ok).toBe(false)
    const both = validateIssnPair('0317-8471', '0317-8471')
    expect(both.ok).toBe(false)
    const one = validateIssnPair('0317-8471', null)
    expect(one.ok).toBe(true)
  })
})
