/**
 * Staging migration zinciri doğrulama orkestratörü.
 * .env.staging ve SUPABASE_DB_URL gerekli.
 */
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import * as dotenv from 'dotenv'
import { loadStagingEnv, maskProjectRef } from './env'

function stagingProcessEnv(): NodeJS.ProcessEnv {
  const parsed = dotenv.parse(fs.readFileSync(path.resolve(process.cwd(), '.env.staging')))
  return { ...process.env, ...parsed, STAGING: '1' }
}

function run(cmd: string): void {
  console.log(`\n> ${cmd}`)
  execSync(cmd, {
    stdio: 'inherit',
    env: stagingProcessEnv(),
    cwd: process.cwd(),
  })
}

async function main() {
  const staging = loadStagingEnv()
  console.log(JSON.stringify({
    staging_host_masked: maskProjectRef(staging.url),
    project_ref_set: Boolean(staging.projectRef),
    db_url_set: Boolean(staging.dbUrl),
  }, null, 2))

  if (!staging.dbUrl) {
    throw new Error('SUPABASE_DB_URL eksik — migration uygulanamaz')
  }

  run('npx tsx scripts/staging/verify-legacy-id.ts')
  run('npx tsx scripts/staging/snapshot.ts pre')

  const hasAuthors = await checkTable(staging.dbUrl, 'authors')
  if (!hasAuthors) {
    run('npx tsx scripts/staging/apply-migrations.ts base')
    run('npx tsx scripts/staging/seed-catalog.ts')
  }

  run('npx tsx scripts/staging/apply-migrations.ts author')
  run('npx tsx scripts/staging/snapshot.ts post-017-018-019')
  run('npx tsx scripts/staging/apply-migrations.ts idempotency-019')

  run('npx tsx scripts/etl/04-authors.ts --missing-only --limit=1000')
  run('npx tsx scripts/etl/04-authors.ts --reconcile')
  run('npx tsx scripts/etl/04-authors.ts --missing-only --limit=1000')

  console.log('\nStaging doğrulama tamamlandı.')
}

async function checkTable(dbUrl: string, table: string): Promise<boolean> {
  const pg = await import('pg')
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    const res = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
      [table],
    )
    return (res.rowCount ?? 0) > 0
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
