import Link from 'next/link'
import { cn, buttonVariants } from '@/lib/utils'
import { Search, BookOpen } from 'lucide-react'

export default function SiteNotFound() {
  return (
    <div className="content-width py-20 text-center">
      <p className="text-5xl font-serif font-bold text-primary/15 mb-4 select-none">404</p>
      <h1 className="text-2xl font-serif font-bold mb-3">Sayfa bulunamadı</h1>
      <p className="text-muted-foreground mb-8 max-w-md mx-auto">
        Aradığınız içerik bulunamadı. Makale veya dergi aramak için aşağıdaki bağlantıları kullanabilirsiniz.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link href="/search" className={cn(buttonVariants(), 'gap-2')}>
          <Search className="h-4 w-4" />
          Arama Yap
        </Link>
        <Link href="/journals" className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}>
          <BookOpen className="h-4 w-4" />
          Dergiler
        </Link>
        <Link href="/" className={cn(buttonVariants({ variant: 'ghost' }))}>
          Ana Sayfa
        </Link>
      </div>
    </div>
  )
}
