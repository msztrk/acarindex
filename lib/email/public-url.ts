/**
 * Auth e-posta bağlantıları — yalnızca allowlist origin (open redirect / host header koruması).
 */
const REHEARSAL_ORIGINS = new Set([
  'http://127.0.0.1:3001',
  'http://localhost:3001',
])

function normalizeOrigin(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    if (u.username || u.password) return null
    return `${u.protocol}//${u.host}`
  } catch {
    return null
  }
}

function isRehearsalOrigin(origin: string): boolean {
  return REHEARSAL_ORIGINS.has(origin)
}

/** APP_PUBLIC_URL veya NEXT_PUBLIC_SITE_URL — production’da https zorunlu. */
export function resolveAppPublicOrigin(): string {
  const raw =
    process.env.APP_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    ''

  if (!raw) {
    throw new Error('APP_PUBLIC_URL yapılandırılmadı.')
  }

  const origin = normalizeOrigin(raw.endsWith('/') ? raw.slice(0, -1) : raw)
  if (!origin) {
    throw new Error('APP_PUBLIC_URL geçersiz.')
  }

  const { protocol, hostname } = new URL(origin)
  const lowerHost = hostname.toLowerCase()

  if (
    lowerHost === 'localhost' ||
    lowerHost.endsWith('.local') ||
    lowerHost.includes('internal') ||
    lowerHost.endsWith('.internal')
  ) {
    if (!isRehearsalOrigin(origin)) {
      throw new Error('APP_PUBLIC_URL iç hostname reddedildi.')
    }
  }

  if (protocol === 'http:' && !isRehearsalOrigin(origin)) {
    throw new Error('APP_PUBLIC_URL http kullanılamaz.')
  }

  return origin
}

/** Site içi path — open redirect engeli. */
export function sanitizeInternalPath(path: string): string {
  const p = path.trim()
  if (!p.startsWith('/') || p.startsWith('//') || p.includes('://')) {
    throw new Error('Geçersiz path.')
  }
  return p
}

export function buildAuthActionUrl(path: string, query?: Record<string, string>): string {
  const origin = resolveAppPublicOrigin()
  const safePath = sanitizeInternalPath(path)
  const url = new URL(safePath, origin)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v)
    }
  }
  const built = url.toString()
  if (!built.startsWith(origin)) {
    throw new Error('URL origin uyuşmazlığı.')
  }
  return built
}
