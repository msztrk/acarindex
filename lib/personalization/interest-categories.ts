import { getServerSession } from '@/lib/auth/session'
import { isUserAuthEnabled } from '@/lib/features/user-auth'
import { listActiveCategories } from '@/lib/data/catalog'
import { getUserProfile } from '@/lib/user-panel/profile'

export interface InterestCategory {
  id: number
  label: string
}

export async function getSessionInterestCategories(): Promise<InterestCategory[]> {
  if (!isUserAuthEnabled()) return []

  const session = await getServerSession()
  if (!session || session.user.status !== 'active') return []

  const [profile, categories] = await Promise.all([
    getUserProfile(session.user.id),
    listActiveCategories(),
  ])

  if (profile.interestAreas.length === 0) return []

  const labelToCategory = new Map(
    categories
      .filter((c) => c.name_tr)
      .map((c) => [c.name_tr!, { id: c.id, label: c.name_tr! }]),
  )

  const seen = new Set<number>()
  const result: InterestCategory[] = []
  for (const label of profile.interestAreas) {
    const cat = labelToCategory.get(label)
    if (cat && !seen.has(cat.id)) {
      seen.add(cat.id)
      result.push(cat)
    }
  }
  return result
}

export function interestCategoryIds(categories: InterestCategory[]): number[] {
  return categories.map((c) => c.id)
}
