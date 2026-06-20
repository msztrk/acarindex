/**
 * AcarIndex Next.js Middleware
 *
 * Görevler:
 * 1. Legacy PHP URL'lerini yeni route'lara yönlendir
 *    - /journals/{DergiURL}  →  /journals/{slug}-{id}   (DB lookup ile)
 *    - /pdfs/{id}            →  /pdfs/{id}  (değişmez)
 * 2. url_aliases tablosundan 301 redirect'leri uygula
 * 3. Beta ortamında X-Robots-Tag: noindex header'ı ekle
 *
 * Performans notu: Middleware her request'te çalışır; DB çağrıları
 * yalnızca açıkça legacy pattern'e uyan path'ler için yapılır.
 */

import { NextRequest, NextResponse } from 'next/server'

const isBeta = (process.env.NEXT_PUBLIC_SITE_URL ?? '').includes('beta')

// Legacy PHP dergi URL pattern: /journals/{DergiURL}  (tireya da slash yokken)
// Yeni URL:                       /journals/{slug}-{id}
// Bu pattern SADECE /journals/{pure-slug} (sayı içermeyen) path'ler için geçerli

const LEGACY_JOURNAL_PATTERN = /^\/journals\/([a-z0-9-]+)$/

// Statik assetler ve Next.js internal path'leri atla
const SKIP_PREFIXES = ['/_next', '/api', '/favicon', '/robots', '/sitemap', '/manifest']

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // İç path'leri atla
  if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const res = NextResponse.next()

  // Beta: tüm HTML sayfalarına noindex ekle
  if (isBeta) {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  }

  // ─── Legacy dergi URL redirect ─────────────────────────────────────────────
  // /journals/{slug}  →  /journals/{slug}-{id}
  // Zaten sayı içeriyorsa (yeni format) bu bloğa girmez
  const journalMatch = pathname.match(LEGACY_JOURNAL_PATTERN)
  if (journalMatch) {
    const legacySlug = journalMatch[1]

    // Supabase REST API'yi doğrudan fetch ile çağır (middleware edge'de çalışır)
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_ANON_KEY

    if (supabaseUrl && supabaseKey) {
      try {
        const apiUrl = `${supabaseUrl}/rest/v1/journals?slug=eq.${encodeURIComponent(legacySlug)}&status=eq.published&select=id,slug&limit=1`
        const r = await fetch(apiUrl, {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
          next: { revalidate: 3600 },
        })

        if (r.ok) {
          const rows = (await r.json()) as { id: number; slug: string }[]
          if (rows.length > 0) {
            const { id, slug } = rows[0]
            // /journals/{slug}-{id} + trailing path varsa koru
            const rest = req.nextUrl.pathname.slice(`/journals/${legacySlug}`.length)
            const newPath = `/journals/${slug}-${id}${rest}`
            const redirectUrl = req.nextUrl.clone()
            redirectUrl.pathname = newPath
            return NextResponse.redirect(redirectUrl, { status: 301 })
          }
        }
      } catch {
        // DB hatası → sayfayı normal şekilde serve et (404'e düşer)
      }
    }
  }

  // ─── url_aliases tablosu ────────────────────────────────────────────────────
  // http_status=301 olan aliaslar için redirect uygula
  // (küçük siteye göre bu lookup opsiyoneldir; büyük ölçekte Redis cache ekle)
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseKey) {
    try {
      const apiUrl = `${supabaseUrl}/rest/v1/url_aliases?legacy_path=eq.${encodeURIComponent(pathname)}&http_status=eq.301&select=canonical_path&limit=1`
      const r = await fetch(apiUrl, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        next: { revalidate: 3600 },
      })

      if (r.ok) {
        const rows = (await r.json()) as { canonical_path: string }[]
        if (rows.length > 0) {
          const redirectUrl = req.nextUrl.clone()
          redirectUrl.pathname = rows[0].canonical_path
          return NextResponse.redirect(redirectUrl, { status: 301 })
        }
      }
    } catch {
      // DB hatası → devam et
    }
  }

  return res
}

export const config = {
  matcher: [
    /*
     * Şunları hariç tut:
     * - _next/static  (statik dosyalar)
     * - _next/image   (resim optimizasyonu)
     * - favicon.ico
     * - api routes
     */
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}
