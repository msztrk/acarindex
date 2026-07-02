import { prisma, disconnectPrisma } from '../../lib/db/prisma'

async function main() {
  const n = await prisma.article.count()
  console.log(JSON.stringify({ articleCount: n }))
}

main()
  .then(() => disconnectPrisma())
  .catch((e) => {
    console.error(e instanceof Error ? e.message : String(e))
    process.exit(1)
  })
