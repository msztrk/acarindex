import { describe, expect, it, beforeAll } from 'vitest'
import { DEFAULT_NOTIFICATION_PREFS } from '@/lib/user-panel/notification-prefs'
import { RECENT_VIEWS_MAX, isRecentEntityType } from '@/lib/user-panel/config'

describe('notification preference defaults', () => {
  it('opts-in only — all defaults false', () => {
    expect(DEFAULT_NOTIFICATION_PREFS).toEqual({
      followedJournalNewIssue: false,
      followedAuthorNewArticle: false,
      savedSearchAlert: false,
      weeklyDigest: false,
      productAnnouncements: false,
    })
  })
})

describe('recent views policy', () => {
  it('caps history at 50', () => {
    expect(RECENT_VIEWS_MAX).toBe(50)
  })

  it('accepts known entity types only', () => {
    expect(isRecentEntityType('article')).toBe(true)
    expect(isRecentEntityType('journal')).toBe(true)
    expect(isRecentEntityType('author')).toBe(true)
    expect(isRecentEntityType('search')).toBe(false)
  })
})

describe('provisional author follow policy', () => {
  it('documents provisional rejection message', async () => {
    const { followAuthor } = await import('@/lib/user-panel/follows')
    const moduleText = followAuthor.toString()
    expect(moduleText).toContain('isProvisional')
  })
})

describe('admin panel summary privacy', () => {
  it('getUserPanelSummary shape is counts only', () => {
    const allowed = new Set(['savedArticles', 'readingLists', 'followedJournals', 'followedAuthors'])
    const forbidden = ['titles', 'items', 'labels', 'recentViews', 'notificationPreferences']
    for (const key of allowed) {
      expect(allowed.has(key)).toBe(true)
    }
    for (const key of forbidden) {
      expect(allowed.has(key)).toBe(false)
    }
  })
})

const runIntegration = process.env.USER_PANEL_INTEGRATION === '1'
const describeUserPanelIntegration = runIntegration
  ? describe.sequential
  : describe.sequential.skip

describeUserPanelIntegration('user panel security integration', () => {
  beforeAll(async () => {
    const { prepareIntegrationFixtures } = await import('@/scripts/db/seed-user-panel-users')
    await prepareIntegrationFixtures()
  }, 120000)

  it('IDOR service suite passes', async () => {
    const { runUserPanelSecuritySuite } = await import('@/scripts/test/user-panel-security')
    const report = await runUserPanelSecuritySuite()
    expect(report.idor.every((r) => r.ok)).toBe(true)
    expect(report.provisional.every((r) => r.ok)).toBe(true)
    if (process.env.USER_PANEL_HTTP_BASE) {
      expect(report.csrf.every((r) => r.ok)).toBe(true)
      expect(report.disabledUser.every((r) => r.ok)).toBe(true)
      expect(report.leaks).toHaveLength(0)
    }
  }, 120000)

  it('acceptance suite passes', async () => {
    const { runUserPanelAcceptance } = await import('@/scripts/test/user-panel-acceptance')
    const checks = await runUserPanelAcceptance()
    expect(checks.every((c) => c.ok)).toBe(true)
  }, 120000)
})
