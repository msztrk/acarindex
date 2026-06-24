/**
 * User panel güvenlik entegrasyon testleri — IDOR, CSRF, pasif kullanıcı.
 * USER_PANEL_INTEGRATION=1 DATABASE_URL=... [USER_PANEL_HTTP_BASE=http://127.0.0.1:3001]
 */
import { prisma } from '@/lib/db/prisma'
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/auth/config'
import { HttpCookieJar, fetchWithJar } from '@/tests/helpers/http-cookie-jar'
import {
  cleanupUserPanelTestSessions,
  ensureUserPanelTestUsers,
  getFixtureArticleId,
  getFixtureCanonicalAuthorId,
  getFixtureJournalId,
  getFixtureProvisionalAuthorId,
  resolveTestPassword,
  USER_PANEL_TEST_EMAIL_A,
  USER_PANEL_TEST_EMAIL_B,
} from '@/scripts/db/seed-user-panel-users'
import {
  createReadingList,
  addArticleToList,
  getReadingListDetail,
  updateReadingList,
  deleteReadingList,
  removeArticleFromList,
  reorderListItems,
} from '@/lib/user-panel/reading-lists'
import { saveArticle, unsaveArticle } from '@/lib/user-panel/saved-articles'
import { followJournal, followAuthor, unfollowJournal, unfollowAuthor } from '@/lib/user-panel/follows'
import { recordRecentView, listRecentViews, clearRecentViews } from '@/lib/user-panel/recent-views'

export interface SecurityTestReport {
  idor: { name: string; ok: boolean; detail?: string }[]
  csrf: { route: string; case: string; status: number; ok: boolean }[]
  disabledUser: { action: string; status: number; ok: boolean }[]
  provisional: { case: string; ok: boolean; detail?: string }[]
  leaks: string[]
}

function assertNoLeak(body: string): string[] {
  const leaks: string[] = []
  if (/postgresql:\/\//i.test(body)) leaks.push('postgresql url')
  if (/DATABASE_URL/i.test(body)) leaks.push('DATABASE_URL')
  if (/PrismaClient/i.test(body)) leaks.push('PrismaClient')
  if (/stack trace/i.test(body)) leaks.push('stack trace')
  return leaks
}

async function setupUserAData(userAId: string) {
  const articleId = await getFixtureArticleId()
  const journalId = await getFixtureJournalId()
  const authorId = await getFixtureCanonicalAuthorId()

  const listRes = await createReadingList(userAId, 'IDOR Test List')
  if (!listRes.ok || !listRes.listId) throw new Error('list create failed')

  await saveArticle(userAId, articleId)
  await addArticleToList(userAId, listRes.listId, articleId)
  await followJournal(userAId, journalId)
  await followAuthor(userAId, authorId)
  await recordRecentView(userAId, 'article', articleId)

  return { listId: listRes.listId, articleId, journalId, authorId }
}

export async function runIdorServiceTests(
  userAId: string,
  userBId: string,
  data: Awaited<ReturnType<typeof setupUserAData>>,
): Promise<SecurityTestReport['idor']> {
  const results: SecurityTestReport['idor'] = []
  const push = (name: string, ok: boolean, detail?: string) => results.push({ name, ok, detail })

  const listView = await getReadingListDetail(userBId, data.listId)
  push('B cannot view A list', listView === null)

  const listUpdate = await updateReadingList(userBId, data.listId, 'Hacked')
  push('B cannot rename A list', !listUpdate.ok)

  const listAdd = await addArticleToList(userBId, data.listId, data.articleId)
  push('B cannot add to A list', !listAdd.ok)

  const listRemove = await removeArticleFromList(userBId, data.listId, data.articleId)
  push('B cannot remove from A list', !listRemove.ok)

  const listReorder = await reorderListItems(userBId, data.listId, [])
  push('B cannot reorder A list', !listReorder.ok)

  const listDelete = await deleteReadingList(userBId, data.listId)
  push('B cannot delete A list', !listDelete.ok)

  await unsaveArticle(userBId, data.articleId)
  push('B unsave A article noop/safe', true)

  const savedCount = await prisma.savedArticle.count({
    where: { userId: userAId, articleId: BigInt(data.articleId) },
  })
  push('A saved article still exists', savedCount === 1)

  await unfollowJournal(userBId, data.journalId)
  const fj = await prisma.followedJournal.count({
    where: { userId: userAId, journalId: BigInt(data.journalId) },
  })
  push('B unfollow noop — A journal follow intact', fj === 1)

  await unfollowAuthor(userBId, data.authorId)
  const fa = await prisma.followedAuthor.count({
    where: { userId: userAId, authorId: BigInt(data.authorId) },
  })
  push('B unfollow noop — A author follow intact', fa === 1)

  const recentB = await listRecentViews(userBId)
  const hasARecent = recentB.some((r) => r.entityId === data.articleId)
  push('B cannot see A recent views', !hasARecent)

  await clearRecentViews(userBId)
  const recentA = await listRecentViews(userAId)
  push('B clear noop — A recent views intact', recentA.length > 0)

  return results
}

async function loginHttp(base: string, email: string, password: string): Promise<HttpCookieJar> {
  const jar = new HttpCookieJar()
  const csrfRes = await fetchWithJar(jar, `${base}/api/auth/csrf`)
  const csrfJson = (await csrfRes.json()) as { csrfToken?: string }
  const csrf = csrfJson.csrfToken ?? jar.get(CSRF_COOKIE) ?? ''
  const loginRes = await fetchWithJar(jar, `${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: csrf },
    body: JSON.stringify({ email, password }),
  })
  if (!loginRes.ok) throw new Error(`login failed ${email}: ${loginRes.status}`)
  return jar
}

async function apiRequest(
  base: string,
  jar: HttpCookieJar,
  method: string,
  path: string,
  body?: Record<string, unknown>,
  csrfOverride?: { header?: string; cookie?: string },
): Promise<{ status: number; body: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const headerToken = csrfOverride?.header ?? jar.get(CSRF_COOKIE) ?? ''
  if (csrfOverride?.header !== undefined || headerToken) {
    headers[CSRF_HEADER] = headerToken
  }
  if (csrfOverride?.cookie !== undefined) {
    jar.set(CSRF_COOKIE, csrfOverride.cookie)
  }
  const res = await fetchWithJar(jar, `${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, body: await res.text() }
}

export async function runCsrfHttpTests(
  base: string,
  email: string,
  password: string,
  articleId: number,
): Promise<{ csrf: SecurityTestReport['csrf']; leaks: string[] }> {
  const csrf: SecurityTestReport['csrf'] = []
  const leaks: string[] = []
  const validJar = await loginHttp(base, email, password)
  const validCsrf = validJar.get(CSRF_COOKIE) ?? ''

  const routes: Array<{ method: string; path: string; body: Record<string, unknown> }> = [
    { method: 'POST', path: '/api/user/saved-articles', body: { articleId } },
    { method: 'DELETE', path: '/api/user/saved-articles', body: { articleId } },
    { method: 'POST', path: '/api/user/reading-lists', body: { name: 'CSRF Test' } },
    { method: 'PATCH', path: '/api/user/notification-preferences', body: { weeklyDigest: true } },
    { method: 'DELETE', path: '/api/user/recent-views', body: {} },
  ]

  for (const route of routes) {
    const noHeaderJar = await loginHttp(base, email, password)
    const r1 = await apiRequest(base, noHeaderJar, route.method, route.path, route.body, {
      header: '',
      cookie: validCsrf,
    })
    csrf.push({ route: route.path, case: 'no header', status: r1.status, ok: r1.status === 403 })
    leaks.push(...assertNoLeak(r1.body))

    const noCookieJar = await loginHttp(base, email, password)
    noCookieJar.set(CSRF_COOKIE, '')
    const r2 = await apiRequest(base, noCookieJar, route.method, route.path, route.body, {
      header: validCsrf,
      cookie: '',
    })
    csrf.push({ route: route.path, case: 'no cookie', status: r2.status, ok: r2.status === 403 })
    leaks.push(...assertNoLeak(r2.body))

    const mismatchJar = await loginHttp(base, email, password)
    const r3 = await apiRequest(base, mismatchJar, route.method, route.path, route.body, {
      header: 'mismatch-token',
      cookie: validCsrf,
    })
    csrf.push({ route: route.path, case: 'mismatch', status: r3.status, ok: r3.status === 403 })
    leaks.push(...assertNoLeak(r3.body))

    const noSessionJar = new HttpCookieJar()
    const csrfRes = await fetchWithJar(noSessionJar, `${base}/api/auth/csrf`)
    const csrfJson = (await csrfRes.json()) as { csrfToken?: string }
    const r4 = await apiRequest(base, noSessionJar, route.method, route.path, route.body, {
      header: csrfJson.csrfToken ?? '',
    })
    csrf.push({ route: route.path, case: 'no session', status: r4.status, ok: r4.status === 401 })
    leaks.push(...assertNoLeak(r4.body))

    const okJar = await loginHttp(base, email, password)
    const r5 = await apiRequest(base, okJar, route.method, route.path, route.body)
    csrf.push({
      route: route.path,
      case: 'valid session+csrf',
      status: r5.status,
      ok: r5.status < 400 || r5.status === 400,
    })
    leaks.push(...assertNoLeak(r5.body))
  }

  return { csrf, leaks: [...new Set(leaks)] }
}

async function runIdorHttpTests(
  base: string,
  password: string,
  data: Awaited<ReturnType<typeof setupUserAData>>,
): Promise<SecurityTestReport['idor']> {
  const results: SecurityTestReport['idor'] = []
  const push = (name: string, ok: boolean) => results.push({ name, ok })
  const jar = await loginHttp(base, USER_PANEL_TEST_EMAIL_B, password)

  const getList = await fetchWithJar(jar, `${base}/api/user/reading-lists/${data.listId}`)
  push('HTTP B GET A list', getList.status === 404)

  const patchList = await apiRequest(base, jar, 'PATCH', `/api/user/reading-lists/${data.listId}`, {
    name: 'Hack',
  })
  push('HTTP B PATCH A list', patchList.status === 404)

  const addItem = await apiRequest(base, jar, 'POST', `/api/user/reading-lists/${data.listId}/items`, {
    articleId: data.articleId,
  })
  push('HTTP B POST A list item', addItem.status === 400 || addItem.status === 404)

  const delItem = await apiRequest(base, jar, 'DELETE', `/api/user/reading-lists/${data.listId}/items`, {
    articleId: data.articleId,
  })
  push('HTTP B DELETE A list item', delItem.status === 404)

  const delList = await apiRequest(base, jar, 'DELETE', `/api/user/reading-lists/${data.listId}`, {})
  push('HTTP B DELETE A list', delList.status === 404)

  const delSaved = await apiRequest(base, jar, 'DELETE', '/api/user/saved-articles', {
    articleId: data.articleId,
  })
  push('HTTP B DELETE A saved noop', delSaved.status === 200)

  const recent = await fetchWithJar(jar, `${base}/api/user/recent-views`)
  const recentBody = await recent.text()
  push(
    'HTTP B GET recent own only',
    recent.status === 200 && !recentBody.includes(String(data.articleId)),
  )

  return results
}

export async function runDisabledUserTests(
  base: string,
  userId: string,
  email: string,
  password: string,
  articleId: number,
): Promise<SecurityTestReport['disabledUser']> {
  const results: SecurityTestReport['disabledUser'] = []
  const jar = await loginHttp(base, email, password)

  await prisma.user.update({ where: { id: userId }, data: { status: 'disabled' } })

  const actions: Array<{ action: string; method: string; path: string; body: Record<string, unknown> }> = [
    { action: 'save article', method: 'POST', path: '/api/user/saved-articles', body: { articleId } },
    { action: 'create list', method: 'POST', path: '/api/user/reading-lists', body: { name: 'Disabled' } },
    {
      action: 'notification prefs',
      method: 'PATCH',
      path: '/api/user/notification-preferences',
      body: { productAnnouncements: true },
    },
    { action: 'clear recent', method: 'DELETE', path: '/api/user/recent-views', body: {} },
  ]

  for (const a of actions) {
    const r = await apiRequest(base, jar, a.method, a.path, a.body)
    results.push({
      action: a.action,
      status: r.status,
      ok: r.status === 401 || r.status === 403,
    })
  }

  await prisma.user.update({ where: { id: userId }, data: { status: 'active' } })
  return results
}

export async function runProvisionalTests(
  userId: string,
  provisionalAuthorId: number,
): Promise<SecurityTestReport['provisional']> {
  const follow = await followAuthor(userId, provisionalAuthorId)
  const count = await prisma.followedAuthor.count({
    where: { userId, authorId: BigInt(provisionalAuthorId) },
  })
  return [
    {
      case: 'service rejects provisional follow',
      ok: !follow.ok && Boolean(follow.error?.includes('Provisional')),
      detail: follow.error,
    },
    { case: 'no follow row for provisional', ok: count === 0 },
  ]
}

export async function runUserPanelSecuritySuite(): Promise<SecurityTestReport> {
  const password = resolveTestPassword()
  const { userAId, userBId } = await ensureUserPanelTestUsers(password)
  await cleanupUserPanelTestSessions([userAId, userBId])

  const data = await setupUserAData(userAId)
  const idor = await runIdorServiceTests(userAId, userBId, data)

  const provisionalAuthorId = await getFixtureProvisionalAuthorId()
  const provisional = await runProvisionalTests(userBId, provisionalAuthorId)

  let csrf: SecurityTestReport['csrf'] = []
  let disabledUser: SecurityTestReport['disabledUser'] = []
  let leaks: string[] = []

  const base = process.env.USER_PANEL_HTTP_BASE?.trim()
  if (base) {
    const csrfRes = await runCsrfHttpTests(base, USER_PANEL_TEST_EMAIL_A, password, data.articleId)
    csrf = csrfRes.csrf
    leaks = csrfRes.leaks
    disabledUser = await runDisabledUserTests(base, userBId, USER_PANEL_TEST_EMAIL_B, password, data.articleId)
    idor.push(...(await runIdorHttpTests(base, password, data)))
  }

  return { idor, csrf, disabledUser, provisional, leaks }
}

async function main() {
  if (!process.env.USER_PANEL_INTEGRATION) {
    console.error('USER_PANEL_INTEGRATION=1 gerekli')
    process.exit(1)
  }
  const report = await runUserPanelSecuritySuite()
  const failed =
    report.idor.some((r) => !r.ok) ||
    report.csrf.some((r) => !r.ok) ||
    report.disabledUser.some((r) => !r.ok) ||
    report.provisional.some((r) => !r.ok) ||
    report.leaks.length > 0

  console.log(JSON.stringify(report, null, 2))
  if (failed) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
