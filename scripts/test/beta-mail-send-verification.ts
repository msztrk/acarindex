#!/usr/bin/env tsx
/** Gerçek doğrulama e-postası gönder (flag açık olmalı). Ham token loglanmaz. */
import { prisma } from '@/lib/db/prisma'
import { sendVerificationEmailForUser } from '@/lib/auth/verify-email'

async function main(): Promise<void> {
  const email = process.env.ACAR_BETA_MAIL_TEST_EMAIL?.trim().toLowerCase()
  if (!email) {
    console.error('ACAR_BETA_MAIL_TEST_EMAIL gerekli')
    process.exit(1)
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    console.error('test user missing')
    process.exit(1)
  }
  if (user.emailVerified) {
    console.error('user already verified — reset for test first')
    process.exit(1)
  }

  const sent = await sendVerificationEmailForUser(user.id, user.email)
  if (!sent.ok) {
    console.error('send failed')
    process.exit(1)
  }

  const tokens = await prisma.verificationToken.count({
    where: { userId: user.id, type: 'email_verify', usedAt: null },
  })
  console.log('verification_email_sent tokens_active=', tokens)
  console.log('WAIT_USER_CLICK')
}

main().catch((error) => {
  console.error(
    'Verification email send failed:',
    error instanceof Error ? error.message : error,
  )
  process.exit(1)
})
