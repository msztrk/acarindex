import Link from 'next/link'

export const metadata = { title: 'Erişim Reddedildi | AcarIndex' }

export default function ForbiddenPage() {
  return (
    <main className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium text-muted-foreground">403</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Erişim reddedildi</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        Bu sayfaya veya işleme erişim yetkiniz bulunmuyor. Gerekli dergi, kurum veya admin
        yetkisine sahip değilseniz yöneticinizle iletişime geçin.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/hesabim"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Hesabım
        </Link>
        <Link href="/" className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
          Ana sayfa
        </Link>
      </div>
    </main>
  )
}
