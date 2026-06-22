/**
 * Hardcoded Postgres credential pattern taraması (maskeli çıktı).
 * Gerçek secret değerleri yazdırılmaz.
 */
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const PATTERNS = [
  { name: 'postgresql_url_with_password', regex: /postgresql:\/\/postgres:[^@\s]+@/gi },
  { name: 'postgres_url_with_password', regex: /postgres:\/\/postgres:[^@\s]+@/gi },
  { name: 'supabase_db_host_inline', regex: /@db\.[a-z0-9]{10,}\.supabase\.co/gi },
]

function maskLine(line: string): string {
  return line
    .replace(/postgresql:\/\/postgres:[^@\s]+@/gi, 'postgresql://postgres:***@')
    .replace(/postgres:\/\/postgres:[^@\s]+@/gi, 'postgres://postgres:***@')
}

function scanText(label: string, text: string): Array<{ file: string; line: number; pattern: string; masked: string }> {
  const hits: Array<{ file: string; line: number; pattern: string; masked: string }> = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const p of PATTERNS) {
      p.regex.lastIndex = 0
      if (p.regex.test(line)) {
        hits.push({
          file: label,
          line: i + 1,
          pattern: p.name,
          masked: maskLine(line).trim().slice(0, 120),
        })
      }
    }
  }
  return hits
}

function walkDir(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === '.git') continue
    const full = path.join(dir, name)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) walkDir(full, acc)
    else if (/\.(ts|tsx|js|mjs|json|md|sql|env|example|toml|yml|yaml)$/i.test(name)) acc.push(full)
  }
  return acc
}

function main() {
  const scope = process.argv[2] ?? 'working-tree'
  const hits: Array<{ file: string; line: number; pattern: string; masked: string }> = []

  if (scope === 'working-tree' || scope === 'all') {
    const files = walkDir(ROOT)
    for (const file of files) {
      const rel = path.relative(ROOT, file)
      if (rel.includes('audit-secrets')) continue
      const text = fs.readFileSync(file, 'utf8')
      hits.push(...scanText(rel, text))
    }
  }

  let historyCommits = 0
  if (scope === 'history' || scope === 'all') {
    try {
      const commits = execSync('git rev-list --all', { encoding: 'utf8' })
        .trim()
        .split('\n')
        .filter(Boolean)
      for (const commit of commits) {
        let names = ''
        try {
          names = execSync(`git diff-tree --no-commit-id --name-only -r ${commit}`, {
            encoding: 'utf8',
          })
        } catch {
          continue
        }
        if (!/scripts\/(run-migration|fix-categories|run-trgm|run-migrations)/.test(names)) continue
        let patch = ''
        try {
          patch = execSync(`git show ${commit} --pretty=format: -- scripts/`, { encoding: 'utf8' })
        } catch {
          continue
        }
        const commitHits = scanText(`commit:${commit.slice(0, 7)}`, patch)
        if (commitHits.length) {
          historyCommits++
          hits.push(...commitHits)
        }
      }
    } catch {
      // git yoksa atla
    }
  }

  const uniqueFiles = [...new Set(hits.map((h) => h.file))]
  console.log(
    JSON.stringify(
      {
        scope,
        hit_count: hits.length,
        unique_locations: uniqueFiles.length,
        history_commits_with_pattern: historyCommits,
        samples: hits.slice(0, 20).map((h) => ({
          location: h.file,
          line: h.line,
          pattern: h.pattern,
          masked: h.masked,
        })),
      },
      null,
      2,
    ),
  )
  process.exit(hits.length > 0 && scope === 'working-tree' ? 1 : 0)
}

main()
