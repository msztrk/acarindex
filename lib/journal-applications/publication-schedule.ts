import type { PublicationFrequency } from '@prisma/client'

export const FIRST_PUBLICATION_YEAR_MIN = 1800

export function currentPublicationYear(): number {
  return new Date().getFullYear()
}

export function validateFirstPublicationYear(
  year: number | null | undefined,
  nowYear: number = currentPublicationYear(),
): { ok: true; year: number } | { ok: false; error: string } {
  if (year == null || !Number.isInteger(year)) {
    return { ok: false, error: 'İlk yayın yılı zorunludur.' }
  }
  if (year < FIRST_PUBLICATION_YEAR_MIN || year > nowYear) {
    return {
      ok: false,
      error: `İlk yayın yılı ${FIRST_PUBLICATION_YEAR_MIN} ile ${nowYear} arasında olmalıdır.`,
    }
  }
  return { ok: true, year }
}

/** Veritabanında tutulmaz; görüntüleme sırasında hesaplanır. */
export function computeYearsPublished(
  firstPublicationYear: number,
  nowYear: number = currentPublicationYear(),
): number {
  return Math.max(0, nowYear - firstPublicationYear + 1)
}

export const FREQUENCY_EXPECTED_ISSUES_PER_YEAR: Record<PublicationFrequency, number | null> = {
  monthly: 12,
  bimonthly: 6,
  quarterly: 4,
  four_monthly: 3,
  semiannual: 2,
  annual: 1,
  continuous: null,
  irregular: null,
}

export function validatePublicationMonths(months: number[]): { ok: true; months: number[] } | { ok: false; error: string } {
  if (months.length === 0) return { ok: true, months: [] }
  const unique = [...new Set(months)]
  if (unique.length !== months.length) {
    return { ok: false, error: 'Yayın ayları tekrar edemez.' }
  }
  for (const m of unique) {
    if (!Number.isInteger(m) || m < 1 || m > 12) {
      return { ok: false, error: 'Yayın ayı 1–12 arasında olmalıdır.' }
    }
  }
  return { ok: true, months: unique.sort((a, b) => a - b) }
}

export function validatePublicationSchedule(
  frequency: PublicationFrequency | null | undefined,
  months: number[],
): { ok: true; months: number[] } | { ok: false; error: string } {
  if (!frequency) {
    return { ok: false, error: 'Yayın sıklığı zorunludur.' }
  }

  const monthCheck = validatePublicationMonths(months)
  if (!monthCheck.ok) return monthCheck

  const expected = FREQUENCY_EXPECTED_ISSUES_PER_YEAR[frequency]
  if (expected == null) {
    return { ok: true, months: monthCheck.months }
  }

  if (monthCheck.months.length === 0) {
    return { ok: false, error: 'Bu yayın sıklığı için en az bir yayın ayı seçilmelidir.' }
  }

  if (monthCheck.months.length !== expected) {
    return {
      ok: false,
      error: `${frequency} sıklığı için ${expected} yayın ayı seçilmelidir; ${monthCheck.months.length} seçildi.`,
    }
  }

  return { ok: true, months: monthCheck.months }
}
