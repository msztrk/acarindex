import type { Metadata } from 'next'
import { Suspense } from 'react'
import { HomeHeroSection } from '@/components/home/HomeHeroSection'
import { HomeMainSection } from '@/components/home/HomeMainSection'
import {
  HomeContentSkeleton,
  HomeHeroSkeleton,
  HomePageSkeleton,
} from '@/components/home/HomePageSkeleton'
import { resolveHomeQaMode } from '@/lib/home/data'

export const metadata: Metadata = {
  title: 'AcarIndex — Akademik İndeks Platformu',
  description:
    'Türkçe ve uluslararası akademik makalelere, dergilere ve yazarlara açık erişim sağlayan akademik arama ve indeks platformu.',
}

export const revalidate = 3600

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ qa?: string }>
}) {
  const { qa: qaRaw } = await searchParams
  const qa = resolveHomeQaMode(qaRaw)

  if (qa === 'loading') {
    return <HomePageSkeleton />
  }

  return (
    <div>
      <Suspense fallback={<HomeHeroSkeleton />}>
        <HomeHeroSection qa={qa} />
      </Suspense>
      <Suspense fallback={<HomeContentSkeleton />}>
        <HomeMainSection qa={qa} />
      </Suspense>
    </div>
  )
}
