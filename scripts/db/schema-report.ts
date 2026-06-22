/**
 * Şema envanteri — yerel PostgreSQL (DATABASE_URL gerekli).
 */
import { prisma } from '../../lib/db/prisma'

async function main() {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `
  const counts: Record<string, number> = {}
  for (const { tablename } of tables) {
    const row = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
      `SELECT COUNT(*)::bigint AS c FROM "${tablename}"`,
    )
    counts[tablename] = Number(row[0]?.c ?? 0)
  }
  console.log(
    JSON.stringify(
      {
        database: 'connected',
        table_count: tables.length,
        tables: tables.map((t) => t.tablename),
        row_counts: counts,
      },
      null,
      2,
    ),
  )
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
