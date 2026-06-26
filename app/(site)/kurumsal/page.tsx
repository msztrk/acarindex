import Link from 'next/link'
import { cn, buttonVariants } from '@/lib/utils'

export const metadata = { title: 'Kurumsal Abonelik | AcarIndex' }

export default function KurumsalPage() {
  return (
    <div className="content-width py-16 max-w-3xl mx-auto text-center">
      <h1 className="font-serif text-3xl font-bold text-foreground mb-4">Kurumsal Abonelik</h1>
      <p className="text-muted-foreground text-lg mb-8">
        Üniversiteler, kütüphaneler ve araştırma kurumları için özel abonelik planları.
      </p>
      <div className="rounded-xl border border-border/80 bg-surface shadow-sm p-8">
        <p className="text-muted-foreground mb-6">
          Kurumsal abonelik detayları ve fiyatlandırma için ekibimizle iletişime geçin.
        </p>
        <Link href="/contact" className={cn(buttonVariants())}>
          Teklif Alın
        </Link>
      </div>
    </div>
  )
}
