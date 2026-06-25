#!/usr/bin/env npx tsx
/** Gerçek parola sıfırlama e-postası gönder (flag açık olmalı). */
import { prisma } from '@/lib/db/prisma'
import { requestPasswordReset } from '@/lib/auth/reset-password'

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

const res = await requestPasswordReset(email)
console.log('forgot_message_ok')
console.log('WAIT_USER_RESET_CLICK')
