/**
 * Idempotent admin_permissions backfill — safe to re-run after migration.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/backfill-admin-permissions.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/backfill-admin-permissions.ts --apply
 */
import { prisma, disconnectPrisma } from '../lib/db/prisma'
import { ROLE_ADMIN_PERMISSION_BACKFILL } from '../lib/auth/admin-permissions'

type RoleCounts = Record<string, number>
type PermissionCounts = Record<string, number>

async function countUsersByRole(): Promise<RoleCounts> {
  const roles = ['USER', 'EDITOR', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN']
  const counts: RoleCounts = {}
  for (const roleId of roles) {
    counts[roleId] = await prisma.userRole.count({ where: { roleId } })
  }
  return counts
}

async function planBackfill(): Promise<{
  role_user_counts: RoleCounts
  permission_grants: PermissionCounts
  grants_to_create: number
  grants_to_reactivate: number
}> {
  const roleUserCounts = await countUsersByRole()
  const permissionGrants: PermissionCounts = {}
  let grantsToCreate = 0
  let grantsToReactivate = 0

  for (const [roleId, permissions] of Object.entries(ROLE_ADMIN_PERMISSION_BACKFILL)) {
    const users = await prisma.userRole.findMany({
      where: { roleId },
      select: { userId: true },
    })
    for (const { userId } of users) {
      for (const permission of permissions) {
        permissionGrants[permission] = (permissionGrants[permission] ?? 0) + 1
        const existing = await prisma.adminPermission.findUnique({
          where: { userId_permission: { userId, permission } },
        })
        if (!existing) grantsToCreate++
        else if (existing.revokedAt) grantsToReactivate++
      }
    }
  }

  return {
    role_user_counts: roleUserCounts,
    permission_grants: permissionGrants,
    grants_to_create: grantsToCreate,
    grants_to_reactivate: grantsToReactivate,
  }
}

async function applyBackfill(): Promise<PermissionCounts> {
  const counts: PermissionCounts = {}

  for (const [roleId, permissions] of Object.entries(ROLE_ADMIN_PERMISSION_BACKFILL)) {
    const users = await prisma.userRole.findMany({
      where: { roleId },
      select: { userId: true },
    })
    for (const { userId } of users) {
      for (const permission of permissions) {
        await prisma.adminPermission.upsert({
          where: { userId_permission: { userId, permission } },
          create: { userId, permission },
          update: { revokedAt: null },
        })
        counts[permission] = (counts[permission] ?? 0) + 1
      }
    }
  }

  return counts
}

function parseArgs(argv: string[]) {
  const apply = argv.includes('--apply')
  const dryRun = argv.includes('--dry-run') || !apply
  return { apply, dryRun }
}

async function main() {
  const { apply, dryRun } = parseArgs(process.argv.slice(2))
  const plan = await planBackfill()

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          mode: 'dry-run',
          ok: true,
          ...plan,
        },
        null,
        2,
      ),
    )
    return
  }

  const applied = await applyBackfill()
  const afterPlan = await planBackfill()

  console.log(
    JSON.stringify(
      {
        mode: 'apply',
        ok: true,
        permission_grants: applied,
        remaining_grants_to_create: afterPlan.grants_to_create,
        remaining_grants_to_reactivate: afterPlan.grants_to_reactivate,
      },
      null,
      2,
    ),
  )
}

main()
  .then(() => disconnectPrisma())
  .catch((e) => {
    console.error(e instanceof Error ? e.message : String(e))
    process.exit(1)
  })
