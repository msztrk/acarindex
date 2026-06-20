'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { cn, buttonVariants } from '@/lib/utils'
import { RotateCcw } from 'lucide-react'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { SiteFooter } from '@/components/layout/SiteFooter'

export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[SiteError]', error)
  }, [error])

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="content-width py-20 text-center">
          <h1 className="text-2xl font-serif font-bold mb-3">Bir hata oluştu</h1>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Sayfa yüklenirken beklenmeyen bir sorun oluştu. Lütfen tekrar deneyin.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={reset} className={cn(buttonVariants(), 'gap-2')}>
              <RotateCcw className="h-4 w-4" />
              Tekrar Dene
            </button>
            <Link href="/" className={cn(buttonVariants({ variant: 'outline' }))}>
              Ana Sayfa
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
