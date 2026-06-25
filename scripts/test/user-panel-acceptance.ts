/**
 * User panel kabul testi — rehearsal uygulama + DB.
 * USER_PANEL_INTEGRATION=1 USER_PANEL_HTTP_BASE=http://127.0.0.1:3001 DATABASE_URL=...
 */
import { prisma } from '@/lib/db/prisma'
import { RECENT_VIEWS_MAX } from '@/lib/user-panel/config'
import {
  ensureUserPanelTestUsers,
  getFixtureArticleId,
  getFixtureCanonicalAuthorId,
  getFixtureJournalId,
  getFixtureProvisionalAuthorId,
  resolveTestPassword,
  USER_PANEL_TEST_EMAIL_A,
  cleanupUserPanelTestSessions,
} from '@/scripts/db/seed-user-panel-users'
import { HttpCookieJar, fetchWithJar } from '@/tests/helpers/http-cookie-jar'
import { CSRF_HEADER } from '@/lib/auth/config'
import {
  saveArticle,
  unsaveArticle,
  listSavedArticles,
} from '@/lib/user-panel/saved-articles'
import {
  createReadingList,
  updateReadingList,
  deleteReadingList,
  addArticleToList,
  removeArticleFromList,
  reorderListItems,
  getReadingListDetail,
} from '@/lib/user-panel/reading-lists'
import { followJournal, unfollowJournal, followAuthor } from '@/lib/user-panel/follows'
import { recordRecentView, listRecentViews, clearRecentViews } from '@/lib/user-panel/recent-views'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  DEFAULT_NOTIFICATION_PREFS,
} from '@/lib/user-panel/notification-prefs'
import { getUserPanelSummary } from '@/lib/user-panel/summary'

interface Check {
  name: string
  ok: boolean
  detail?: string
}

async function login(base: string, email: string, password: string): Promise<HttpCookieJar> {
  const jar = new HttpCookieJar()
  const csrfRes = await fetchWithJar(jar, `${base}/api/auth/csrf`)
  const csrfJson = (await csrfRes.json()) as { csrfToken?: string }
  const csrf = csrfJson.csrfToken ?? ''
  await fetchWithJar(jar, `${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: csrf },
    body: JSON.stringify({ email, password }),
  })
  return jar
}

export async function runUserPanelAcceptance(): Promise<Check[]> {
  const checks: Check[] = []
  const push = (name: string, ok: boolean, detail?: string) => checks.push({ name, ok, detail })

  const password = resolveTestPassword()
  const { userAId } = await ensureUserPanelTestUsers(password)
  await cleanupUserPanelTestSessions([userAId])

  const articleId = await getFixtureArticleId()
  const journalId = await getFixtureJournalId()
  const canonicalAuthorId = await getFixtureCanonicalAuthorId()
  const provisionalAuthorId = await getFixtureProvisionalAuthorId()

  const save = await saveArticle(userAId, articleId)
  push('save article', save.ok)

  const unsave = await unsaveArticle(userAId, articleId)
  push('unsave article', unsave.ok)
  await saveArticle(userAId, articleId)

  const listRes = await createReadingList(userAId, 'Acceptance List')
  push('create list', listRes.ok && Boolean(listRes.listId))
  const listId = listRes.listId!

  const rename = await updateReadingList(userAId, listId, 'Acceptance Renamed')
  push('rename list', rename.ok)

  const add = await addArticleToList(userAId, listId, articleId)
  push('add to list', add.ok)

  const detail = await getReadingListDetail(userAId, listId)
  const itemIds = detail?.items.map((i) => i.id) ?? []
  push('list has item', itemIds.length === 1)

  const remove = await removeArticleFromList(userAId, listId, articleId)
  push('remove from list', remove.ok)
  await addArticleToList(userAId, listId, articleId)

  const detail2 = await getReadingListDetail(userAId, listId)
  const ids = detail2?.items.map((i) => i.id) ?? []
  const reorder = await reorderListItems(userAId, listId, ids)
  push('reorder list', reorder.ok)

  const fj = await followJournal(userAId, journalId)
  push('follow journal', fj.ok)
  await unfollowJournal(userAId, journalId)

  const fa = await followAuthor(userAId, canonicalAuthorId)
  push('follow canonical author', fa.ok)

  const fp = await followAuthor(userAId, provisionalAuthorId)
  push('reject provisional author', !fp.ok)

  await recordRecentView(userAId, 'article', articleId)
  await recordRecentView(userAId, 'article', articleId)
  const recent = await listRecentViews(userAId)
  const dupes = recent.filter((r) => r.entityId === articleId)
  push('recent view upsert', dupes.length === 1)

  for (let i = 0; i < RECENT_VIEWS_MAX + 5; i++) {
    await recordRecentView(userAId, 'article', articleId + i)
  }
  const capped = await prisma.recentView.count({ where: { userId: userAId } })
  push('recent views cap 50', capped <= RECENT_VIEWS_MAX)

  await clearRecentViews(userAId)
  push('clear recent', (await listRecentViews(userAId)).length === 0)

  const prefs = await updateNotificationPreferences(userAId, { weeklyDigest: true })
  push('notification prefs update', prefs.weeklyDigest === true)
  const defaults = await getNotificationPreferences(userAId)
  push('notification prefs persist', defaults.weeklyDigest === true)
  push(
    'notification marketing default false',
    DEFAULT_NOTIFICATION_PREFS.productAnnouncements === false,
  )

  const summary = await getUserPanelSummary(userAId)
  push('overview counts', summary.savedArticles >= 1 && summary.readingLists >= 1)

  const catalogBefore = await prisma.article.count({ where: { id: BigInt(articleId) } })
  await deleteReadingList(userAId, listId)
  const catalogAfter = await prisma.article.count({ where: { id: BigInt(articleId) } })
  push('list delete preserves catalog', catalogBefore === 1 && catalogAfter === 1)

  const savedList = await listSavedArticles(userAId, {})
  push('saved articles list', savedList.rows.length >= 1)

  const base = process.env.USER_PANEL_HTTP_BASE?.trim()
  if (base) {
    const jar = await login(base, USER_PANEL_TEST_EMAIL_A, password)
    const hesabim = await fetchWithJar(jar, `${base}/hesabim`)
    push('hesabim page', hesabim.status === 200)

    const logoutCsrf = (await (await fetchWithJar(jar, `${base}/api/auth/csrf`)).json()) as {
      csrfToken?: string
    }
    await fetchWithJar(jar, `${base}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [CSRF_HEADER]: logoutCsrf.csrfToken ?? '',
      },
      body: '{}',
    })
    const afterLogout = await fetchWithJar(jar, `${base}/api/user/overview`)
    push('logout denies panel API', afterLogout.status === 401)
  }

  return checks
}

async function main() {
  if (!process.env.USER_PANEL_INTEGRATION) {
    console.error('USER_PANEL_INTEGRATION=1 gerekli')
    process.exit(1)
  }
  const checks = await runUserPanelAcceptance()
  const failed = checks.filter((c) => !c.ok)
  console.log(JSON.stringify({ passed: checks.length - failed.length, total: checks.length, checks }, null, 2))
  if (failed.length > 0) process.exit(1)
}

const isCliEntry =
  typeof process.argv[1] === 'string' &&
  process.argv[1].replace(/\\/g, '/').includes('user-panel-acceptance')

if (isCliEntry) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
