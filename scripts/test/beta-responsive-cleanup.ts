#!/usr/bin/env tsx
import { prisma } from '@/lib/db/prisma'
import { hashToken } from '@/lib/auth/config'

const TEST_EMAIL = 'faz6c-responsive@acarindex-beta.invalid'
const VERIFY_INVALID_PROBE = 'invalid-token-probe-beta-c'
const RESET_INVALID_PROBE = 'invalid-reset-token-probe-beta-c'

async function main(): Promise<void> {
  await prisma.abuseEvent.deleteMany({
    where: {
      OR: [
        { key: TEST_EMAIL },
        { key: hashToken(VERIFY_INVALID_PROBE) },
        { key: hashToken(RESET_INVALID_PROBE) },
      ],
    },
  })
  await prisma.loginAttempt.deleteMany({ where: { email: TEST_EMAIL } })
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } })
  const users = await prisma.user.count()
  const articles = await prisma.article.count()
  console.log(`users=${users}`)
  console.log(`articles=${articles}`)
  console.log('RESPONSIVE_CLEANUP_OK')
}

main().catch((e) => {
  console.error('FAIL:', e instanceof Error ? e.message : 'unknown')
  process.exit(1)
})
