import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { isPrismaBackend } from '@/lib/db/config'

export const dynamic = 'force-dynamic'

/**
 * Readiness: uygulama + PostgreSQL bağlantısı.
 * Liveness için basit HTTP 200 yeterli; deployment healthcheck bu endpoint'i kullanır.
 */
export async function GET() {
  if (!isPrismaBackend()) {
    return NextResponse.json(
      { status: 'not_ready', checks: { database_configured: false } },
      { status: 503 },
    )
  }

  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({
      status: 'ready',
      checks: { database: 'ok' },
    })
  } catch {
    return NextResponse.json(
      { status: 'not_ready', checks: { database: 'error' } },
      { status: 503 },
    )
  }
}
