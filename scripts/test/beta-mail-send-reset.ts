#!/usr/bin/env tsx
/** Gerçek parola sıfırlama e-postası gönder (flag açık olmalı). */
import { prisma } from '@/lib/db/prisma'
import { requestPasswordReset } from '@/lib/auth/reset-password'

async function main(): Promise<void> {
  const email = process.env.ACAR_BETA_MAIL_TEST_EMAIL?.trim().toLowerCase()
  if (!email) {
    console.error('ACAR_BETA_MAIL_TEST_EMAIL gerekli')
    process.exit(1)
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user?.emailVerified) {
    console.error('user must be verified')
    process.exit(1)
  }

  await requestPasswordReset(email)
  console.log('forgot_message_ok')
  console.log('WAIT_USER_RESET_CLICK')
}

main().catch((error) => {
  console.error(
    'Reset email send failed:',
    error instanceof Error ? error.message : error,
  )
  process.exit(1)
})
