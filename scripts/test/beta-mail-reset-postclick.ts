#!/usr/bin/env tsx
/** Parola sıfırlama — kullanıcı reset linkine tıkladıktan sonra DB kontrolleri. */
import { prisma } from '@/lib/db/prisma'
import { buildAuthActionUrl } from '@/lib/email/public-url'

const TEST_EMAIL = process.env.ACAR_BETA_MAIL_TEST_EMAIL?.trim().toLowerCase()

function fail(msg: string): void {
  console.error('FAIL:', msg)
  process.exit(1)
}

async function main(): Promise<void> {
  if (!TEST_EMAIL) fail('ACAR_BETA_MAIL_TEST_EMAIL')

  const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } })
  if (!user?.emailVerified) fail('user not verified')

  const origin = buildAuthActionUrl('/reset-password', { token: 'x' }).split('?')[0]
  if (!origin.startsWith('https://beta.acarindex.com')) fail('bad origin')

  const used = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, usedAt: { not: null } },
    orderBy: { usedAt: 'desc' },
  })
  if (!used) fail('no used reset token')
  if (used.tokenHash.length < 32) fail('token hash too short')
  if (used.tokenHash === used.id) fail('hash sanity')

  const audits = await prisma.auditLog.findMany({
    where: { resourceId: user.id, action: { contains: 'password' } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { metadata: true, action: true },
  })
  for (const a of audits) {
    const blob = JSON.stringify(a)
    if (/token=[A-Za-z0-9_-]{20,}/.test(blob)) fail('audit token leak')
    if (/re_[A-Za-z0-9_-]{10,}/.test(blob)) fail('audit key leak')
  }

  console.log('RESET_POSTCLICK_OK')
}

main().catch((e) => {
  console.error('FAIL:', e instanceof Error ? e.message : 'unknown')
  process.exit(1)
})
