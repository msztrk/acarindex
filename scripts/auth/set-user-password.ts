#!/usr/bin/env npx tsx
/**
 * Tek kullanıcı parolasını güncelle (bootstrap sonrası cred dosyası düzeltme).
 * Kullanım: NEW_PASS=... npx tsx scripts/auth/set-user-password.ts email@example.com
 */
import { prisma } from '@/lib/db/prisma'
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password'

const email = process.argv[2]?.trim().toLowerCase()
const password = process.env.NEW_PASS ?? ''

async function main() {
  if (!email || !password) {
    console.error('email ve NEW_PASS gerekli')
    process.exit(1)
  }
  const err = validatePasswordStrength(password)
  if (err) {
    console.error(err)
    process.exit(1)
  }
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    console.error('kullanıcı yok')
    process.exit(1)
  }
  const hash = await hashPassword(password)
  await prisma.userCredential.update({
    where: { userId: user.id },
    data: { passwordHash: hash },
  })
  console.log('password_updated')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : 'error')
  process.exit(1)
})
