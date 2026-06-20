/**
 * ETL runner — tüm scriptleri sırayla çalıştırır.
 *
 * Kullanım:
 *   npx tsx scripts/etl/run-all.ts           # tüm veri
 *   npx tsx scripts/etl/run-all.ts --pilot   # 100 journal + 500 issue + 1000 article
 *   npx tsx scripts/etl/run-all.ts --dry-run # sadece dry-run raporu
 */

import { execSync } from 'child_process'
import path from 'path'

const args = process.argv.slice(2)
const isPilot  = args.includes('--pilot')
const isDryRun = args.includes('--dry-run')

const flag = isPilot ? ' --pilot' : ''

const start = Date.now()

if (isDryRun) {
  console.log('🔍 Dry-run başlıyor...\n')
  const dryRunPath = path.join(__dirname, 'dry-run.ts')
  execSync(`npx tsx "${dryRunPath}"`, { stdio: 'inherit' })
  process.exit(0)
}

const scripts = [
  '01-journals.ts',
  '02-issues.ts',
  '03-articles.ts',
  // '04-authors.ts', // SKIP: disk tasarrufu için; authors_raw article içinde mevcut
]

console.log(`🚀 AcarIndex ETL [${isPilot ? 'PILOT' : 'FULL'}] başlıyor...\n`)
if (isPilot) {
  console.log('  Pilot limitleri: 100 journal · 500 issue · 1000 article\n')
}

let successCount = 0
let failCount = 0

for (const script of scripts) {
  const scriptPath = path.join(__dirname, script)
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`⏳ ${script}${flag}`)
  console.log('─'.repeat(60))
  try {
    execSync(`npx tsx "${scriptPath}"${flag}`, { stdio: 'inherit' })
    successCount++
  } catch {
    console.error(`\n❌ ${script} başarısız — sonraki scripte geçiliyor`)
    failCount++
  }
}

const elapsed = ((Date.now() - start) / 1000).toFixed(1)
console.log(`\n${'═'.repeat(60)}`)
console.log(`${failCount === 0 ? '✅' : '⚠'} ETL tamamlandı — ${elapsed}s | başarılı: ${successCount} | hata: ${failCount}`)
console.log('═'.repeat(60))
if (isPilot && failCount === 0) {
  console.log('\n  Pilot başarılı. Tam ETL için:')
  console.log('  npx tsx scripts/etl/run-all.ts\n')
}
