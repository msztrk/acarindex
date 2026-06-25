#!/usr/bin/env tsx
/** Geçici responsive test kullanıcısı ve token durumları — stdout'a secret yazmaz. */
import { prisma } from '@/lib/db/prisma'
import { hashPassword } from '@/lib/auth/password'
import { generateToken, hashToken, VERIFY_TOKEN_TTL_MS, RESET_TOKEN_TTL_MS } from '@/lib/auth/config'

const TEST_EMAIL = 'faz6c-responsive@acarindex-beta.invalid'
const OUT = process.env.ACAR_RESPONSIVE_ENV_FILE ?? '/root/.faz6c-responsive-tokens.env'
const PASS = process.env.NEW_PASS ?? (await (async () => {
  const { randomBytes } = await import('crypto')
  return randomBytes(16).toString('hex')
})())

async function main(): Promise<void> {
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

  const verifyValid = await makeVerify({})
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
  const resetSuccess = await makeReset({})
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
    `TOKEN_VERIFY_VALID=${verifyValid}`,
    `TOKEN_VERIFY_EXPIRED=${verifyExpired}`,
    `TOKEN_VERIFY_USED=${verifyUsedRaw}`,
    `TOKEN_RESET_VALID=${resetValid}`,
    `TOKEN_RESET_SUCCESS=${resetSuccess}`,
    `TOKEN_RESET_EXPIRED=${resetExpired}`,
    `TOKEN_RESET_USED=${resetUsedRaw}`,
    `TOKEN_INVALID=invalid-token-probe-beta-c`,
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
