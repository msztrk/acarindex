/**
 * Lists Next.js App Router API route handlers under app/api.
 * Read-only audit helper — does not modify application state.
 *
 * Usage: npx tsx scripts/audit/collect-routes.ts
 */
import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const API_DIR = path.join(ROOT, 'app', 'api')

type RouteEntry = {
  file: string
  route: string
  methods: string[]
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const

function fileToRoute(relativePath: string): string {
  const withoutSuffix = relativePath.replace(/\/route\.ts$/, '')
  const segments = withoutSuffix.split(path.sep).filter(Boolean)
  const urlSegments = segments.map((seg) => {
    if (seg.startsWith('[') && seg.endsWith(']')) return `:${seg.slice(1, -1)}`
    return seg
  })
  return '/api/' + urlSegments.join('/')
}

function detectMethods(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf8')
  return HTTP_METHODS.filter((method) => {
    const fnPattern = new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\b`)
    const constPattern = new RegExp(`export\\s+const\\s+${method}\\s*=`)
    return fnPattern.test(content) || constPattern.test(content)
  })
}

function walk(dir: string, base = ''): RouteEntry[] {
  const entries: RouteEntry[] = []
  if (!fs.existsSync(dir)) return entries

  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${name.name}` : name.name
    const full = path.join(dir, name.name)
    if (name.isDirectory()) {
      entries.push(...walk(full, rel))
    } else if (name.name === 'route.ts') {
      const methods = detectMethods(full)
      entries.push({
        file: path.join('app', 'api', rel).replace(/\\/g, '/'),
        route: fileToRoute(rel.replace(/\\/g, '/')),
        methods: methods.length > 0 ? methods : ['(unknown)'],
      })
    }
  }
  return entries
}

function main(): void {
  const routes = walk(API_DIR).sort((a, b) => a.route.localeCompare(b.route))
  const handlerCount = routes.reduce((sum, r) => sum + r.methods.length, 0)

  console.log(`# API routes: ${routes.length} files, ${handlerCount} handlers\n`)
  console.log('route\tmethods\tfile')
  for (const r of routes) {
    console.log(`${r.route}\t${r.methods.join(',')}\t${r.file}`)
  }
}

main()
