#!/usr/bin/env npx tsx
/**
 * Mevcut parola ile güvenli parola değişimi (CLI).
 * Kullanım: CURRENT_PASS=... NEW_PASS=... npx tsx scripts/auth/change-password-cli.ts email@example.com
 */
import { prisma } from '@/lib/db/prisma'
import { changeUserPassword } from '@/lib/auth/change-password'

const email = process.argv[2]?.trim().toLowerCase()
const currentPassword = process.env.CURRENT_PASS ?? ''
const newPassword = process.env.NEW_PASS ?? ''
const revoke = process.env.REVOKE_OTHER !== '0'

async function main() {
  if (!email || !currentPassword || !newPassword) {
    console.error('email, CURRENT_PASS ve NEW_PASS gerekli')
    process.exit(1)
  }
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    console.error('kullanıcı yok')
    process.exit(1)
  }
  const result = await changeUserPassword({
    userId: user.id,
    currentPassword,
    newPassword,
    revokeOtherSessions: revoke,
  })
  if (!result.ok) {
    console.error(result.error ?? 'fail')
    process.exit(1)
  }
  console.log('password_changed', { revokedSessions: result.revokedSessions ?? 0 })
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : 'error')
  process.exit(1)
})
