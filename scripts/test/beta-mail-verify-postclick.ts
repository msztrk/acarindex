#!/usr/bin/env npx tsx
/** Doğrulama kabul — kullanıcı linke tıkladıktan sonra DB ve edge-case kontrolleri. */
import { prisma } from '@/lib/db/prisma'
import {
  generateToken,
  hashToken,
  VERIFY_TOKEN_TTL_MS,
  VERIFY_RESEND_MAX,
} from '@/lib/auth/config'
import { verifyEmailToken, requestVerificationResend } from '@/lib/auth/verify-email'
import { buildAuthActionUrl } from '@/lib/email/public-url'

const TEST_EMAIL = process.env.ACAR_BETA_MAIL_TEST_EMAIL?.trim().toLowerCase()

function fail(msg: string): void {
  console.error('FAIL:', msg)
  process.exit(1)
}

async function main(): Promise<void> {
  if (!TEST_EMAIL) fail('ACAR_BETA_MAIL_TEST_EMAIL')

  const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } })
  if (!user?.emailVerified) fail('user not verified — click email link first')

  const origin = buildAuthActionUrl('/verify-email', { token: 'x' }).split('?')[0]
  if (!origin.startsWith('https://beta.acarindex.com')) fail('bad origin')

  const used = await prisma.verificationToken.findFirst({
    where: { userId: user.id, type: 'email_verify', usedAt: { not: null } },
    orderBy: { usedAt: 'desc' },
  })
  if (!used) fail('no used verification token')

  const reuse = await verifyEmailToken('invalid-token-probe')
  if (reuse.ok) fail('invalid token accepted')

  const expiredRaw = generateToken()
  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(expiredRaw),
      type: 'email_verify',
      expiresAt: new Date(Date.now() - 1000),
    },
  })
  const expired = await verifyEmailToken(expiredRaw)
  if (expired.ok) fail('expired token accepted')

  const msg1 = await requestVerificationResend('nobody@test.invalid')
  const msg2 = await requestVerificationResend('other@test.invalid')
  if (msg1.message !== msg2.message) fail('enumeration resend')

  for (let i = 0; i <= VERIFY_RESEND_MAX + 1; i++) {
    await requestVerificationResend(TEST_EMAIL)
  }
  const abuse = await prisma.abuseEvent.count({
    where: { eventType: 'verify_resend', key: TEST_EMAIL },
  })
  if (abuse < VERIFY_RESEND_MAX) fail('resend abuse events')

  const audits = await prisma.auditLog.findMany({
    where: { resourceId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { metadata: true, action: true },
  })
  for (const a of audits) {
    const blob = JSON.stringify(a)
    if (blob.includes(expiredRaw)) fail('audit leak')
  }

  console.log('VERIFY_ACCEPTANCE_OK')
}

main().catch((e) => {
  console.error('FAIL:', e instanceof Error ? e.message : 'unknown')
  process.exit(1)
})
