import Link from 'next/link'

export const metadata = { title: 'Başvurular | AcarIndex' }

export default function ApplicationsPage() {
  return (
    <div className="content-width py-16 max-w-3xl mx-auto text-center">
      <h1 className="text-3xl font-bold text-foreground mb-4">Başvurular</h1>
      <p className="text-muted-foreground text-lg mb-8">
        Dergi, kitap ve bildiri indeksleme başvuruları için bu bölümü kullanabilirsiniz.
      </p>
      <div className="bg-secondary/50 border border-border rounded-xl p-8">
        <p className="text-muted-foreground mb-6">
          Başvuru formu çok yakında yayında olacak. Şu an için bizimle iletişime geçebilirsiniz.
        </p>
        <Link
          href="/contact"
          className="inline-flex items-center px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          İletişime Geç
        </Link>
      </div>
    </div>
  )
}
