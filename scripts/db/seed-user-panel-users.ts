/**
 * User panel test kullanıcıları — rehearsal / entegrasyon testleri.
 * Parolalar Git'e yazılmaz; USER_PANEL_TEST_PASS env veya runtime üretimi.
 */
import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/db/prisma'
import { registerUser } from '@/lib/auth/login'
import { DEV_FIXTURE_MARKER } from '@/scripts/db/seed-dev'

export const USER_PANEL_TEST_EMAIL_A = `user-panel-a@${DEV_FIXTURE_MARKER}.local`
export const USER_PANEL_TEST_EMAIL_B = `user-panel-b@${DEV_FIXTURE_MARKER}.local`

export interface UserPanelTestUsers {
  userAId: string
  userBId: string
  password: string
}

export function resolveTestPassword(): string {
  const fromEnv = process.env.USER_PANEL_TEST_PASS?.trim()
  if (fromEnv) return fromEnv
  return randomBytes(24).toString('base64url')
}

export async function ensureUserPanelTestUsers(password: string): Promise<UserPanelTestUsers> {
  let userAId: string | undefined
  let userBId: string | undefined

  const existingA = await prisma.user.findUnique({ where: { email: USER_PANEL_TEST_EMAIL_A } })
  if (existingA) {
    userAId = existingA.id
  } else {
    const res = await registerUser({
      email: USER_PANEL_TEST_EMAIL_A,
      password,
      name: 'Panel Test A',
      roleIds: ['USER'],
    })
    if (!res.ok || !res.userId) throw new Error(res.error ?? 'user A create failed')
    userAId = res.userId
  }

  const existingB = await prisma.user.findUnique({ where: { email: USER_PANEL_TEST_EMAIL_B } })
  if (existingB) {
    userBId = existingB.id
  } else {
    const res = await registerUser({
      email: USER_PANEL_TEST_EMAIL_B,
      password,
      name: 'Panel Test B',
      roleIds: ['USER'],
    })
    if (!res.ok || !res.userId) throw new Error(res.error ?? 'user B create failed')
    userBId = res.userId
  }

  return { userAId, userBId, password }
}

export async function cleanupUserPanelTestSessions(userIds: string[]): Promise<void> {
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } })
  await prisma.loginAttempt.deleteMany({
    where: {
      email: { in: [USER_PANEL_TEST_EMAIL_A, USER_PANEL_TEST_EMAIL_B] },
    },
  })
}

export async function getFixtureArticleId(): Promise<number> {
  const article = await prisma.article.findFirst({
    where: { slug: `${DEV_FIXTURE_MARKER}-article-1` },
    select: { id: true },
  })
  if (!article) throw new Error('fixture article missing — run seed-dev first')
  return Number(article.id)
}

export async function getFixtureJournalId(): Promise<number> {
  const journal = await prisma.journal.findFirst({
    where: { slug: `${DEV_FIXTURE_MARKER}-j-1` },
    select: { id: true },
  })
  if (!journal) throw new Error('fixture journal missing')
  return Number(journal.id)
}

export async function getFixtureCanonicalAuthorId(): Promise<number> {
  const author = await prisma.author.findFirst({
    where: { sourceKey: `${DEV_FIXTURE_MARKER}-author-1` },
    select: { id: true, isProvisional: true },
  })
  if (!author || author.isProvisional) throw new Error('canonical author fixture missing')
  return Number(author.id)
}

export async function getFixtureProvisionalAuthorId(): Promise<number> {
  const author = await prisma.author.findFirst({
    where: { sourceKey: `${DEV_FIXTURE_MARKER}-author-prov` },
    select: { id: true, isProvisional: true },
  })
  if (!author?.isProvisional) throw new Error('provisional author fixture missing')
  return Number(author.id)
}

async function main() {
  const password = resolveTestPassword()
  const users = await ensureUserPanelTestUsers(password)
  console.log(
    JSON.stringify({
      ok: true,
      userAId: users.userAId,
      userBId: users.userBId,
      emailA: USER_PANEL_TEST_EMAIL_A,
      emailB: USER_PANEL_TEST_EMAIL_B,
    }),
  )
}

if (process.argv[1]?.includes('seed-user-panel-users')) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
