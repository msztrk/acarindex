#!/usr/bin/env npx tsx
/** Beta mail test kullanıcısı — public registration kullanmaz, beta test olarak işaretler. */
import { registerUser } from '@/lib/auth/login'

const email = process.argv[2]?.trim().toLowerCase()
const password = process.env.NEW_PASS ?? ''

async function main() {
  if (!email || !password) {
    console.error('usage: NEW_PASS=... create-beta-mail-test-user.ts email')
    process.exit(1)
  }
  const res = await registerUser({
    email,
    password,
    name: 'AcarIndex Beta Mail Test Account',
    roleIds: ['USER'],
  })
  if (!res.ok) {
    console.error(res.error ?? 'fail')
    process.exit(1)
  }
  console.log('created', res.userId)
}

main()
