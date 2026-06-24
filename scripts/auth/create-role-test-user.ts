#!/usr/bin/env npx tsx
/** Test kullanıcı oluştur: email + tek rol + NEW_PASS env */
import { registerUser } from '@/lib/auth/login'
import { isAppRole } from '@/lib/auth/roles'

const email = process.argv[2]?.trim().toLowerCase()
const role = process.argv[3]?.trim()
const password = process.env.NEW_PASS ?? ''

async function main() {
  if (!email || !role || !password || !isAppRole(role)) {
    console.error('usage: NEW_PASS=... create-role-test-user.ts email ROLE')
    process.exit(1)
  }
  const roleIds = role === 'USER' ? ['USER'] : [role, 'USER']
  const res = await registerUser({
    email,
    password,
    name: `Test ${role}`,
    roleIds,
  })
  if (!res.ok) {
    console.error(res.error ?? 'fail')
    process.exit(1)
  }
  console.log('created', res.userId)
}

main()
