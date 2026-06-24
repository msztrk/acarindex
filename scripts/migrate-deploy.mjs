import { spawnSync } from 'node:child_process'

function maskDatabaseUrl(url) {
  try {
    const u = new URL(url.replace(/^postgres(ql)?:/, 'http:'))
    const db = u.pathname.replace(/^\//, '').split('?')[0] || ''
    const port = u.port || '5432'
    return `postgresql://${u.username}@${u.hostname}:${port}/${db}`
  } catch {
    return '(geçersiz DATABASE_URL)'
  }
}

const dbUrl = process.env.DATABASE_URL?.trim()
if (!dbUrl) {
  console.error('DATABASE_URL gerekli')
  process.exit(1)
}

if (/supabase\.co/i.test(dbUrl)) {
  console.error('Supabase hedefi reddedildi')
  process.exit(1)
}

console.log(`Migration hedef: ${maskDatabaseUrl(dbUrl)}`)

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: process.env,
})

process.exit(result.status ?? 1)
