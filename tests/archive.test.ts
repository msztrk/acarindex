import { describe, expect, it } from 'vitest'
import {
  ARCHIVE_UNDATED_YEAR_KEY,
  buildArchiveIssueHref,
  buildArchiveIssueLabel,
  compareArchiveIssues,
  groupArchiveIssues,
} from '../lib/journals/archive'
import type { Issue } from '../types/database'

function issue(
  id: number,
  overrides: Partial<Issue> = {},
): Issue {
  return {
    id,
    legacy_id: id,
    journal_id: 91,
    year: 2021,
    issue_number: null,
    volume: null,
    issue_label: null,
    dergipark_issue_id: null,
    status: 'published',
    hit_count: 0,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

describe('groupArchiveIssues', () => {
  it('yılları yeniden eskiye sıralar', () => {
    const grouped = groupArchiveIssues([
      issue(1, { year: 2019 }),
      issue(2, { year: 2022 }),
      issue(3, { year: 2021 }),
    ])

    expect(grouped.groups.map((g) => g.yearKey)).toEqual([2022, 2021, 2019])
  })

  it('aynı yılda sayı 10, sayı 2 sıralamasını sayısal yapar', () => {
    const grouped = groupArchiveIssues([
      issue(1, { year: 2020, issue_number: 'Cilt: 1 - Sayı: 2' }),
      issue(2, { year: 2020, issue_number: 'Cilt: 1 - Sayı: 10' }),
    ])

    expect(grouped.groups[0].issues.map((i) => i.id)).toEqual([2, 1])
    expect(compareArchiveIssues(
      issue(2, { year: 2020, issue_number: 'Cilt: 1 - Sayı: 10' }),
      issue(1, { year: 2020, issue_number: 'Cilt: 1 - Sayı: 2' }),
    )).toBeLessThan(0)
  })

  it('eksik yıl kayıtlarını ayrı grupta gösterir', () => {
    const grouped = groupArchiveIssues([
      issue(1, { year: null, issue_label: 'Özel Sayı' }),
      issue(2, { year: 2020 }),
    ])

    expect(grouped.groups.at(-1)?.heading).toBe('Yılı belirtilmemiş sayılar')
    expect(grouped.groups.at(-1)?.yearKey).toBe(ARCHIVE_UNDATED_YEAR_KEY)
  })

  it('yinelenen issue kaydı oluşturmaz', () => {
    const grouped = groupArchiveIssues([
      issue(1, { year: 2020 }),
      issue(1, { year: 2020 }),
    ])

    expect(grouped.totalIssues).toBe(1)
  })
})

describe('buildArchiveIssueLabel', () => {
  it('eksik cilt ve sayıda doğal etiket üretir', () => {
    expect(
      buildArchiveIssueLabel(issue(1, { issue_number: 'Cilt: 52 - Sayı: 1', year: 1997 })),
    ).toBe('Cilt 52, Sayı 1')
    expect(
      buildArchiveIssueLabel(issue(2, { issue_number: 'Cilt: 52', year: 1997, volume: '52' })),
    ).toBe('Cilt 52')
  })

  it('yalnızca yıl etiketinde tekrar üretmez', () => {
    expect(
      buildArchiveIssueLabel(issue(65, { year: 2019, issue_label: '2019', issue_number: null })),
    ).toBe('Sayı')
  })

  it('özel sayı etiketini korur', () => {
    expect(
      buildArchiveIssueLabel(issue(9, { year: 2020, issue_label: 'Özel Sayı', issue_number: null })),
    ).toBe('Özel Sayı')
  })
})

describe('buildArchiveIssueHref', () => {
  it('doğru issue URL üretir', () => {
    expect(buildArchiveIssueHref('ankara-universitesi-sbf-dergisi-91', 2155)).toBe(
      '/journals/ankara-universitesi-sbf-dergisi-91/sayi/2155',
    )
  })
})
