import Link from 'next/link'
import { cn, buttonVariants } from '@/lib/utils'

export default function ArticleNotFound() {
  return (
    <div className="content-width py-20 text-center">
      <h1 className="text-2xl font-serif font-bold mb-3">Makale bulunamadı</h1>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        Ulaşmaya çalıştığınız makale bulunamadı veya yayından kaldırılmış olabilir.
      </p>
      <div className="flex gap-3 justify-center">
        <Link href="/search" className={cn(buttonVariants())}>
          Arama Yap
        </Link>
        <Link href="/" className={cn(buttonVariants({ variant: 'outline' }))}>
          Ana Sayfa
        </Link>
      </div>
    </div>
  )
}
