/**
 * Staging ortam yardımcıları — gizli anahtarları loglamaz.
 */
import fs from 'fs'
import path from 'path'
import * as dotenv from 'dotenv'

export const PRODUCTION_PROJECT_HOST = 'yvyibenutgnocrighbmj.supabase.co'

export function maskHost(url: string): string {
  try {
    const host = new URL(url).hostname
    if (host.length <= 8) return '***'
    return `${host.slice(0, 4)}***${host.slice(-4)}`
  } catch {
    return '***'
  }
}

export function maskProjectRef(url: string): string {
  try {
    const host = new URL(url).hostname
    const ref = host.split('.')[0] ?? ''
    if (ref.length <= 6) return '***ref***'
    return `${ref.slice(0, 3)}***${ref.slice(-3)}`
  } catch {
    return '***ref***'
  }
}

export function isProductionSupabaseUrl(url: string): boolean {
  return url.includes(PRODUCTION_PROJECT_HOST)
}

export type StagingEnv = {
  url: string
  anonKey: string
  serviceRoleKey: string
  dbUrl: string | null
  projectRef: string | null
}

export function loadStagingEnv(): StagingEnv {
  const stagingPath = path.resolve(process.cwd(), '.env.staging')
  if (!fs.existsSync(stagingPath)) {
    throw new Error(
      '.env.staging bulunamadı. Supabase Dashboard\'da ayrı staging projesi oluşturup staging.env.example dosyasını .env.staging olarak kopyalayın.',
    )
  }
  dotenv.config({ path: stagingPath, override: true })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const dbUrl = process.env.SUPABASE_DB_URL ?? null
  const projectRef = process.env.SUPABASE_PROJECT_REF ?? null

  if (!url || !serviceRoleKey) {
    throw new Error('.env.staging: NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY zorunlu')
  }
  if (isProductionSupabaseUrl(url)) {
    throw new Error('.env.staging production projesine işaret ediyor — staging ref kullanın')
  }
  if (dbUrl && isProductionSupabaseUrl(dbUrl)) {
    throw new Error('.env.staging SUPABASE_DB_URL production\'a işaret ediyor')
  }

  return { url, anonKey, serviceRoleKey, dbUrl, projectRef }
}

export function loadProductionReadEnv(): { url: string; serviceRoleKey: string } {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!url || !serviceRoleKey) {
    throw new Error('.env.local: production read env eksik')
  }
  return { url, serviceRoleKey }
}

export function assertNotProductionTarget(url: string, label = 'hedef'): void {
  if (isProductionSupabaseUrl(url)) {
    throw new Error(`${label} production Supabase — işlem durduruldu`)
  }
}

export function reportsDir(): string {
  const dir = path.resolve(process.cwd(), 'reports', 'staging')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function writeSnapshot(name: string, data: unknown): string {
  const file = path.join(reportsDir(), `${name}.json`)
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
  return file
}
