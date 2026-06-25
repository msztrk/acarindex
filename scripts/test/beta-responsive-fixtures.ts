#!/usr/bin/env tsx
/** Geçici responsive test kullanıcısı ve token durumları — stdout'a secret yazmaz. */
import { prisma } from '@/lib/db/prisma'
import { hashPassword } from '@/lib/auth/password'
import { generateToken, hashToken, VERIFY_TOKEN_TTL_MS, RESET_TOKEN_TTL_MS } from '@/lib/auth/config'

import { randomBytes } from 'crypto'

const TEST_EMAIL = 'faz6c-responsive@acarindex-beta.invalid'
const VERIFY_INVALID_PROBE = 'invalid-token-probe-beta-c'
const RESET_INVALID_PROBE = 'invalid-reset-token-probe-beta-c'
const OUT = process.env.ACAR_RESPONSIVE_ENV_FILE ?? '/tokens/tokens.env'

async function main(): Promise<void> {
  const PASS = process.env.NEW_PASS ?? randomBytes(16).toString('hex')
  await prisma.abuseEvent.deleteMany({
    where: {
      eventType: { in: ['token_verify', 'verify_resend', 'forgot_password'] },
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  })
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } })

  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      name: 'Faz6C Responsive Test',
      status: 'active',
      credential: { create: { passwordHash: await hashPassword(PASS) } },
      roles: { create: { roleId: 'USER' } },
    },
  })

  const makeVerify = async (opts: { expired?: boolean; used?: boolean }) => {
    const raw = generateToken()
    await prisma.verificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(raw),
        type: 'email_verify',
        expiresAt: opts.expired
          ? new Date(Date.now() - 1000)
          : new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
        usedAt: opts.used ? new Date() : null,
      },
    })
    return raw
  }

  const makeReset = async (opts: { expired?: boolean; used?: boolean }) => {
    const raw = generateToken()
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(raw),
        expiresAt: opts.expired
          ? new Date(Date.now() - 1000)
          : new Date(Date.now() + RESET_TOKEN_TTL_MS),
        usedAt: opts.used ? new Date() : null,
      },
    })
    return raw
  }

  const verifySuccess375 = await makeVerify({})
  const verifySuccess768 = await makeVerify({})
  const verifySuccess1366 = await makeVerify({})
  const verifyExpired = await makeVerify({ expired: true })
  const verifyUsedRaw = generateToken()
  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(verifyUsedRaw),
      type: 'email_verify',
      expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
      usedAt: new Date(),
    },
  })

  const resetValid = await makeReset({})
  const resetSuccess375 = await makeReset({})
  const resetSuccess768 = await makeReset({})
  const resetSuccess1366 = await makeReset({})
  const resetExpired = await makeReset({ expired: true })
  const resetUsedRaw = generateToken()
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(resetUsedRaw),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      usedAt: new Date(),
    },
  })

  const lines = [
    `ACAR_RESPONSIVE_TEST_EMAIL=${TEST_EMAIL}`,
    `TOKEN_VERIFY_SUCCESS_375=${verifySuccess375}`,
    `TOKEN_VERIFY_SUCCESS_768=${verifySuccess768}`,
    `TOKEN_VERIFY_SUCCESS_1366=${verifySuccess1366}`,
    `TOKEN_VERIFY_EXPIRED=${verifyExpired}`,
    `TOKEN_VERIFY_USED=${verifyUsedRaw}`,
    `TOKEN_RESET_VALID=${resetValid}`,
    `TOKEN_RESET_SUCCESS_375=${resetSuccess375}`,
    `TOKEN_RESET_SUCCESS_768=${resetSuccess768}`,
    `TOKEN_RESET_SUCCESS_1366=${resetSuccess1366}`,
    `TOKEN_RESET_EXPIRED=${resetExpired}`,
    `TOKEN_RESET_USED=${resetUsedRaw}`,
    `TOKEN_INVALID=${VERIFY_INVALID_PROBE}`,
    `TOKEN_RESET_INVALID=${RESET_INVALID_PROBE}`,
  ]

  const { writeFileSync, chmodSync } = await import('fs')
  writeFileSync(OUT, lines.join('\n') + '\n', { mode: 0o600 })
  chmodSync(OUT, 0o600)
  console.log('RESPONSIVE_FIXTURES_OK')
  console.log(`ENV_FILE=${OUT}`)
}

main().catch((e) => {
  console.error('FAIL:', e instanceof Error ? e.message : 'unknown')
  process.exit(1)
})
