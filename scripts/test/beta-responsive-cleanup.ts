#!/usr/bin/env tsx
import { prisma } from '@/lib/db/prisma'

const TEST_EMAIL = 'faz6c-responsive@acarindex-beta.invalid'

async function main(): Promise<void> {
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
