#!/usr/bin/env npx tsx
/**
 * İlk SUPER_ADMIN bootstrap — yalnızca hiç SUPER_ADMIN yoksa çalışır.
 * Parola stdin veya BOOTSTRAP_ADMIN_PASSWORD env (loglanmaz).
 *
 * Production: NODE_ENV=production BOOTSTRAP_CONFIRM=1 gerekir.
 */
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { prisma } from '@/lib/db/prisma'
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password'
import { writeAuditLog } from '@/lib/auth/audit'
import { countSuperAdmins } from '@/lib/auth/user'
import { isProductionEnv } from '@/lib/auth/config'

async function main() {
  if (isProductionEnv() && process.env.BOOTSTRAP_CONFIRM !== '1') {
    console.error('Production ortamında BOOTSTRAP_CONFIRM=1 gerekir.')
    process.exit(1)
  }

  const existing = await countSuperAdmins()
  if (existing > 0) {
    console.error('Zaten SUPER_ADMIN mevcut. Bootstrap atlandı.')
    process.exit(0)
  }

  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase()
  if (!email) {
    console.error('BOOTSTRAP_ADMIN_EMAIL gerekli.')
    process.exit(1)
  }

  let password = process.env.BOOTSTRAP_ADMIN_PASSWORD
  if (!password) {
    const rl = createInterface({ input, output })
    password = await rl.question('SUPER_ADMIN parolası: ')
    rl.close()
  }

  const strength = validatePasswordStrength(password)
  if (strength) {
    console.error(strength)
    process.exit(1)
  }

  const hash = await hashPassword(password)
  password = '' // bellekten temizle

  const user = await prisma.user.create({
    data: {
      email,
      name: process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'Super Admin',
      status: 'active',
      emailVerified: new Date(),
      credential: { create: { passwordHash: hash } },
      roles: {
        create: [{ roleId: 'SUPER_ADMIN' }, { roleId: 'USER' }],
      },
    },
  })

  await writeAuditLog({
    actorId: user.id,
    action: 'bootstrap.super_admin',
    resource: 'user',
    resourceId: user.id,
    metadata: { email },
  })

  console.log('SUPER_ADMIN oluşturuldu:', user.id)
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('Bootstrap hatası:', err instanceof Error ? err.message : 'unknown')
  process.exit(1)
})
