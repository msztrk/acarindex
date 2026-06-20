import Link from 'next/link'

export const metadata = { title: 'Kurumsal Abonelik | AcarIndex' }

export default function KurumsalPage() {
  return (
    <div className="content-width py-16 max-w-3xl mx-auto text-center">
      <h1 className="text-3xl font-bold text-foreground mb-4">Kurumsal Abonelik</h1>
      <p className="text-muted-foreground text-lg mb-8">
        Üniversiteler, kütüphaneler ve araştırma kurumları için özel abonelik planları.
      </p>
      <div className="bg-secondary/50 border border-border rounded-xl p-8">
        <p className="text-muted-foreground mb-6">
          Kurumsal abonelik detayları ve fiyatlandırma için ekibimizle iletişime geçin.
        </p>
        <Link
          href="/contact"
          className="inline-flex items-center px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          Teklif Alın
        </Link>
      </div>
    </div>
  )
}
