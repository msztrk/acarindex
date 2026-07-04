/**
 * Lists Next.js App Router pages and API route handlers.
 * Read-only audit helper — does not modify application state.
 *
 * Usage: npx tsx scripts/audit/collect-routes.ts [--pages] [--json]
 */
import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const API_DIR = path.join(ROOT, 'app', 'api')
const APP_DIR = path.join(ROOT, 'app')

type RouteEntry = {
  file: string
  route: string
  methods: string[]
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const

function fileToApiRoute(relativePath: string): string {
  const withoutSuffix = relativePath.replace(/\/route\.ts$/, '')
  const segments = withoutSuffix.split(path.sep).filter(Boolean)
  const urlSegments = segments.map((seg) => {
    if (seg.startsWith('[') && seg.endsWith(']')) return `:${seg.slice(1, -1)}`
    return seg
  })
  return '/api/' + urlSegments.join('/')
}

function fileToPageRoute(relativePath: string): string {
  const withoutSuffix = relativePath.replace(/\/page\.tsx$/, '')
  const segments = withoutSuffix.split(path.sep).filter(Boolean)
  const urlSegments: string[] = []

  for (const seg of segments) {
    if (seg.startsWith('(') && seg.endsWith(')')) continue
    if (seg.startsWith('[') && seg.endsWith(']')) {
      urlSegments.push(`:${seg.slice(1, -1)}`)
      continue
    }
    urlSegments.push(seg)
  }

  const route = '/' + urlSegments.join('/')
  return route === '/' ? '/' : route.replace(/\/$/, '') || '/'
}

function classifyPageRoute(route: string): string {
  if (route.startsWith('/admin')) return 'Admin'
  if (route.startsWith('/editor') || route.startsWith('/hesabim/editor')) return 'Editor'
  if (route.startsWith('/kurum')) return 'Institution'
  if (
    route.startsWith('/login') ||
    route.startsWith('/register') ||
    route.startsWith('/forgot-password') ||
    route.startsWith('/reset-password') ||
    route.startsWith('/verify-email') ||
    route.startsWith('/hesabim') ||
    route.startsWith('/profile') ||
    route.startsWith('/profil')
  )
    return 'Auth'
  if (route.startsWith('/auth')) return 'Legacy'
  if (route.startsWith('/applications')) return 'Legacy'
  return 'Public'
}

function detectMethods(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf8')
  return HTTP_METHODS.filter((method) => {
    const fnPattern = new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\b`)
    const constPattern = new RegExp(`export\\s+const\\s+${method}\\s*=`)
    return fnPattern.test(content) || constPattern.test(content)
  })
}

function walkApi(dir: string, base = ''): RouteEntry[] {
  const entries: RouteEntry[] = []
  if (!fs.existsSync(dir)) return entries

  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${name.name}` : name.name
    const full = path.join(dir, name.name)
    if (name.isDirectory()) {
      entries.push(...walkApi(full, rel))
    } else if (name.name === 'route.ts') {
      const methods = detectMethods(full)
      entries.push({
        file: path.join('app', 'api', rel).replace(/\\/g, '/'),
        route: fileToApiRoute(rel.replace(/\\/g, '/')),
        methods: methods.length > 0 ? methods : ['(unknown)'],
      })
    }
  }
  return entries
}

function walkPages(dir: string, base = ''): RouteEntry[] {
  const entries: RouteEntry[] = []
  if (!fs.existsSync(dir)) return entries

  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${name.name}` : name.name
    const full = path.join(dir, name.name)
    if (name.isDirectory()) {
      entries.push(...walkPages(full, rel))
    } else if (name.name === 'page.tsx') {
      entries.push({
        file: path.join('app', rel, 'page.tsx').replace(/\\/g, '/'),
        route: fileToPageRoute(rel.replace(/\\/g, '/')),
        methods: ['GET'],
      })
    }
  }
  return entries
}

function classifyApiRoute(route: string): string {
  if (route.startsWith('/api/admin')) return 'Admin'
  if (route.startsWith('/api/internal')) return 'Internal'
  if (route.startsWith('/api/auth')) return 'Public'
  if (route.startsWith('/api/editor')) return 'Editor'
  if (route.startsWith('/api/institution')) return 'Institution'
  if (
    route.startsWith('/api/user') ||
    route.startsWith('/api/applications') ||
    route.startsWith('/api/change-requests') ||
    route.startsWith('/api/membership-applications')
  )
    return 'Auth'
  return 'Public'
}

function main(): void {
  const args = process.argv.slice(2)
  const includePages = args.includes('--pages') || args.length === 0
  const asJson = args.includes('--json')

  const apiRoutes = walkApi(API_DIR).sort((a, b) => a.route.localeCompare(b.route))
  const handlerCount = apiRoutes.reduce((sum, r) => sum + r.methods.length, 0)

  if (asJson) {
    const pages = includePages ? walkPages(APP_DIR).sort((a, b) => a.route.localeCompare(b.route)) : []
    console.log(JSON.stringify({ apiRoutes, pages, handlerCount }, null, 2))
    return
  }

  console.log(`# API routes: ${apiRoutes.length} files, ${handlerCount} handlers\n`)
  for (const group of ['Public', 'Auth', 'Editor', 'Institution', 'Admin', 'Internal', 'Legacy'] as const) {
    const groupRoutes = apiRoutes.filter((r) => classifyApiRoute(r.route) === group)
    if (groupRoutes.length === 0) continue
    console.log(`## API ${group} (${groupRoutes.length} files)\n`)
    console.log('route\tmethods\tfile')
    for (const r of groupRoutes) {
      console.log(`${r.route}\t${r.methods.join(',')}\t${r.file}`)
    }
    console.log('')
  }

  if (!includePages) return

  const pages = walkPages(APP_DIR).sort((a, b) => a.route.localeCompare(b.route))
  console.log(`# Page routes: ${pages.length} files\n`)
  for (const group of ['Public', 'Auth', 'Editor', 'Institution', 'Admin', 'Legacy'] as const) {
    const groupPages = pages.filter((p) => classifyPageRoute(p.route) === group)
    if (groupPages.length === 0) continue
    console.log(`## Pages ${group} (${groupPages.length})\n`)
    console.log('route\tfile')
    for (const p of groupPages) {
      console.log(`${p.route}\t${p.file}`)
    }
    console.log('')
  }
}

main()
