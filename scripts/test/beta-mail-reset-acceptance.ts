#!/usr/bin/env npx tsx
/** Parola sıfırlama kabul — yalnızca beta test kullanıcısı, flag açık olmalı. */
import { prisma } from '@/lib/db/prisma'
import {
  generateToken,
  hashToken,
  RESET_TOKEN_TTL_MS,
  TOKEN_ATTEMPT_MAX,
} from '@/lib/auth/config'
import {
  requestPasswordReset,
  resetPasswordWithToken,
} from '@/lib/auth/reset-password'
import { createSession } from '@/lib/auth/session'
import { verifyPassword } from '@/lib/auth/password'

const TEST_EMAIL = process.env.ACAR_BETA_MAIL_TEST_EMAIL?.trim().toLowerCase()
const NEW_PASS = process.env.NEW_PASS ?? ''

function fail(msg: string): void {
  console.error('FAIL:', msg)
  process.exit(1)
}

async function main(): Promise<void> {
  if (!TEST_EMAIL || !NEW_PASS) fail('ACAR_BETA_MAIL_TEST_EMAIL and NEW_PASS required')

  const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } })
  if (!user?.emailVerified) fail('user must be verified first')

  const credBefore = await prisma.userCredential.findUnique({ where: { userId: user.id } })
  if (!credBefore) fail('no credential')

  const f1 = await requestPasswordReset(TEST_EMAIL)
  const f2 = await requestPasswordReset('nobody@test.invalid')
  if (f1.message !== f2.message) fail('enumeration forgot')

  const resetRaw = generateToken()
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(resetRaw),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  })

  await createSession(user.id)
  await createSession(user.id)
  const sessBefore = await prisma.session.count({ where: { userId: user.id } })
  if (sessBefore < 1) fail('sessions')

  const newPass = NEW_PASS.endsWith('!') ? NEW_PASS + 'R' : NEW_PASS + '!'
  const reset = await resetPasswordWithToken(resetRaw, newPass)
  if (!reset.ok) fail('reset failed')

  const sessAfter = await prisma.session.count({ where: { userId: user.id } })
  if (sessAfter !== 0) fail('sessions not revoked')

  const cred = await prisma.userCredential.findUnique({ where: { userId: user.id } })
  if (!cred || (await verifyPassword(NEW_PASS, cred.passwordHash))) fail('old password works')
  if (!(await verifyPassword(newPass, cred.passwordHash))) fail('new password fails')

  const reuse = await resetPasswordWithToken(resetRaw, 'AnotherPass1!')
  if (reuse.ok) fail('token reuse')

  const expiredRaw = generateToken()
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(expiredRaw),
      expiresAt: new Date(Date.now() - 1000),
    },
  })
  const expired = await resetPasswordWithToken(expiredRaw, 'ExpiredPass1!')
  if (expired.ok) fail('expired accepted')

  for (let i = 0; i <= TOKEN_ATTEMPT_MAX + 2; i++) {
    await resetPasswordWithToken('bad-token', 'BadPass1!')
  }

  const audits = await prisma.auditLog.findMany({
    where: { resourceId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { metadata: true, action: true },
  })
  for (const a of audits) {
    const blob = JSON.stringify(a)
    if (blob.includes(resetRaw) || blob.includes(newPass)) fail('audit leak')
  }

  console.log('RESET_ACCEPTANCE_OK')
}

main().catch((e) => {
  console.error('FAIL:', e instanceof Error ? e.message : 'unknown')
  process.exit(1)
})
