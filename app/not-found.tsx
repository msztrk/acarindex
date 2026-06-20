import Link from 'next/link'
import type { Metadata } from 'next'
import { cn, buttonVariants } from '@/lib/utils'
import { Search } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Sayfa Bulunamadı — AcarIndex',
  robots: { index: false, follow: true },
}

export default function GlobalNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl font-serif font-bold text-primary/20 mb-4 select-none">404</p>
      <h1 className="text-2xl font-serif font-bold mb-3 text-foreground">
        Sayfa bulunamadı
      </h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        Aradığınız sayfa taşınmış, silinmiş ya da hiç var olmamış olabilir.
        Akademik içerik aramak için arama kutusunu kullanabilirsiniz.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link href="/search" className={cn(buttonVariants(), 'gap-2')}>
          <Search className="h-4 w-4" />
          Arama Yap
        </Link>
        <Link href="/" className={cn(buttonVariants({ variant: 'outline' }))}>
          Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  )
}
