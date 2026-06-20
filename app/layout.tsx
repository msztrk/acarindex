import type { Metadata } from 'next'
import { Inter, Source_Serif_4 } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-serif',
  weight: ['400', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_CANONICAL_BASE ?? 'https://www.acarindex.com',
  ),
  title: {
    default: 'AcarIndex — Akademik İndeks Platformu',
    template: '%s | AcarIndex',
  },
  description:
    'Türkçe ve uluslararası akademik makalelere, dergilere ve yazarlara açık erişim. AcarIndex akademik arama ve indeks platformu.',
  robots: {
    // Beta'da noindex; cutover sonrası kaldırılacak
    index: process.env.NEXT_PUBLIC_SITE_URL?.includes('beta') ? false : true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    alternateLocale: 'en_US',
    siteName: 'AcarIndex',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="tr" className={`${inter.variable} ${sourceSerif.variable}`}>
      <body className="font-sans min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  )
}
