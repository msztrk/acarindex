import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const body = execSync('git show HEAD:tests/urls.test.ts', { encoding: 'utf8' })
  .split(/\r?\n/)
  .slice(179)
  .join('\n')
  .replace(/ISSUE_ROUTE_TEST_BASE_URL/g, 'EXTERNAL_TEST_BASE_URL')

const header = `/**
 * Canlı/staging URL HTTP testleri — varsayılan unit paketinde çalışmaz.
 * Kullanım: EXTERNAL_TEST_BASE_URL=https://... npm run test:external
 */
import { describe, it, expect } from 'vitest'

const externalBase = process.env.EXTERNAL_TEST_BASE_URL?.trim()
if (!externalBase) {
  throw new Error('EXTERNAL_TEST_BASE_URL tanımlı değil')
}
const issueRouteBase = externalBase
`

const outDir = path.join(process.cwd(), 'tests/external')
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'urls-http.test.ts'), header + body, 'utf8')
console.log('written tests/external/urls-http.test.ts')
