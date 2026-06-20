'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { cn, buttonVariants } from '@/lib/utils'
import { RotateCcw } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Hata izleme servisi (Sentry vb.) burada çağrılabilir
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl font-serif font-bold text-destructive/20 mb-4 select-none">500</p>
      <h1 className="text-2xl font-serif font-bold mb-3 text-foreground">
        Beklenmeyen bir hata oluştu
      </h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        Üzgünüz, bir şeyler yanlış gitti. Sayfayı yenilemeyi veya ana sayfaya dönmeyi deneyin.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground/60 mb-6 font-mono">
          Hata kodu: {error.digest}
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button onClick={reset} className={cn(buttonVariants(), 'gap-2')}>
          <RotateCcw className="h-4 w-4" />
          Tekrar Dene
        </button>
        <Link href="/" className={cn(buttonVariants({ variant: 'outline' }))}>
          Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  )
}
