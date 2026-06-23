/**
 * PDF Proxy Route Handler — Faz-1
 *
 * Güvenlik katmanları:
 * 1. Makale ID pozitif integer olmalı
 * 2. pdf_files kaydı DB'den doğrulanır (RLS korumalı)
 * 3. legacy_pdf_path'in domain'i ALLOWED_DOMAINS listesinde olmalı
 * 4. Upstream Content-Type application/pdf veya octet-stream olmalı
 * 5. Yanıt content-disposition header ile inline sunulur
 * 6. X-Robots-Tag: noindex eklenir (PDF'ler indekslenmesin)
 * 7. Rate limiting: Vercel'de Edge Config / Upstash ile sağlanabilir;
 *    şimdilik makul Cache-Control ile next: { revalidate: 3600 } koruması var.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPdfFileForArticle } from '@/lib/data/search'
import { buildLegacyPdfUrl } from '@/lib/pdf/legacy-url'

// Proxy edilebilir domain listesi — dışına çıkılamaz
const ALLOWED_HOSTS = new Set([
  'www.acarindex.com',
  'acarindex.com',
  'cdn.acarindex.com',
])

// Geçerli PDF MIME tipleri
const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'application/octet-stream',
  'binary/octet-stream',
])

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    return ALLOWED_HOSTS.has(parsed.hostname)
  } catch {
    return false
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const articleId = parseInt(id, 10)

  if (isNaN(articleId) || articleId <= 0 || articleId > 99_999_999) {
    return NextResponse.json({ error: 'Geçersiz makale ID' }, { status: 400 })
  }

  const record = await getPdfFileForArticle(articleId)

  if (!record) {
    return NextResponse.json({ error: 'PDF kaydı bulunamadı' }, { status: 404 })
  }

  if (record.file_status === 'missing') {
    return NextResponse.json({ error: 'PDF mevcut değil' }, { status: 404 })
  }

  const pdfUrl = buildLegacyPdfUrl(record.legacy_pdf_path)
  if (!pdfUrl) {
    return NextResponse.json({ error: 'PDF linki geçersiz' }, { status: 404 })
  }

  // Domain kısıtlaması — keyfi proxy olmayı engeller
  if (!isAllowedUrl(pdfUrl)) {
    console.warn(`[pdf-proxy] Reddedilen URL: ${pdfUrl}`)
    return NextResponse.json({ error: 'PDF kaynağı izin verilmiyor' }, { status: 403 })
  }

  // Upstream fetch
  try {
    const upstream = await fetch(pdfUrl, {
      headers: {
        'User-Agent': 'AcarIndex-Bot/1.0 (beta.acarindex.com)',
        Referer: 'https://www.acarindex.com/',
        Accept: 'application/pdf,application/octet-stream,*/*',
      },
      next: { revalidate: 3600 },
    })

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream hata: ${upstream.status}` },
        { status: upstream.status === 404 ? 404 : 502 },
      )
    }

    // Content-Type doğrulama
    const upstreamContentType = (upstream.headers.get('content-type') ?? '').toLowerCase().split(';')[0].trim()
    const isValidPdf = ALLOWED_CONTENT_TYPES.has(upstreamContentType)
    if (!isValidPdf) {
      console.warn(`[pdf-proxy] Beklenmeyen content-type: ${upstreamContentType} for articleId=${articleId}`)
      return NextResponse.json({ error: 'Dosya PDF formatında değil' }, { status: 502 })
    }

    // Boyut kontrolü: 50 MB üstünü reddet
    const contentLength = upstream.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'Dosya çok büyük' }, { status: 413 })
    }

    const responseHeaders = new Headers({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="acarindex-${articleId}.pdf"`,
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
    })
    if (contentLength) responseHeaders.set('Content-Length', contentLength)

    return new NextResponse(upstream.body, { status: 200, headers: responseHeaders })
  } catch (err) {
    console.error('[pdf-proxy] fetch error', err)
    return NextResponse.json({ error: 'PDF alınamadı' }, { status: 502 })
  }
}
