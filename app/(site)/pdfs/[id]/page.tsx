import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { buildLegacyPdfUrl } from '@/lib/pdf/legacy-url'
import { cn, buttonVariants } from '@/lib/utils'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Download, ExternalLink, ArrowLeft } from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

interface ArticleWithPdf {
  id: number
  slug: string
  legacy_journal_slug: string
  title_tr: string | null
  title_en: string | null
  authors_raw: string | null
  journal: { id: number; slug: string; title_tr: string | null } | null
  pdf: { legacy_pdf_path: string | null; file_status: string } | null
}

async function getArticleWithPdf(articleId: number): Promise<ArticleWithPdf | null> {
  const sb = await createClient()
  const { data, error } = await sb
    .from('articles')
    .select(`
      id, slug, legacy_journal_slug, title_tr, title_en, authors_raw,
      journal:journals!journal_id ( id, slug, title_tr ),
      pdf:pdf_files ( legacy_pdf_path, file_status )
    `)
    .eq('id', articleId)
    .eq('status', 'published')
    .single()

  if (error || !data) return null
  return data as unknown as ArticleWithPdf
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const articleId = parseInt(id, 10)
  if (isNaN(articleId)) return {}
  const article = await getArticleWithPdf(articleId)
  if (!article) return { title: 'PDF Bulunamadı' }

  return {
    title: `${article.title_tr ?? 'Makale'} — PDF`,
    robots: { index: false, follow: false },
  }
}

export default async function PdfViewerPage({ params }: PageProps) {
  const { id } = await params
  const articleId = parseInt(id, 10)
  if (isNaN(articleId) || articleId <= 0) notFound()

  const article = await getArticleWithPdf(articleId)
  if (!article) notFound()

  const title = article.title_tr ?? article.title_en ?? 'Makale'
  const journal = article.journal
  const pdf = article.pdf

  const legacyPdfUrl = buildLegacyPdfUrl(pdf?.legacy_pdf_path)
  const proxyUrl = `/api/pdf-proxy/${articleId}`
  const articleUrl = `/${article.legacy_journal_slug}/${article.slug}-${article.id}`

  const hasPdf = legacyPdfUrl !== null && pdf?.file_status !== 'missing'

  return (
    <div className="content-width py-6">
      {/* Breadcrumb */}
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink href="/">Ana Sayfa</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          {journal && (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink href={`/journals/${journal.slug}-${journal.id}`}>
                  {journal.title_tr ?? 'Dergi'}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
          <BreadcrumbItem>
            <BreadcrumbLink href={articleUrl}>{title.slice(0, 50)}…</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>PDF</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Başlık + aksiyon */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
        <div className="flex-1">
          <h1 className="font-serif text-xl font-bold leading-snug mb-1">{title}</h1>
          {article.authors_raw && (
            <p className="text-sm text-muted-foreground">
              {article.authors_raw.split(',').slice(0, 4).map(a => a.trim()).join('; ')}
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href={articleUrl} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}>
            <ArrowLeft className="h-4 w-4" /> Makaleye Dön
          </Link>
          {hasPdf && legacyPdfUrl && (
            <a
              href={legacyPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}
            >
              <Download className="h-4 w-4" /> İndir
            </a>
          )}
        </div>
      </div>

      {/* PDF viewer */}
      {hasPdf ? (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          {/* iframe embed — proxy üzerinden */}
          <iframe
            src={proxyUrl}
            className="w-full"
            style={{ height: 'calc(100vh - 200px)', minHeight: 500 }}
            title={`PDF: ${title}`}
          />
          {/* Fallback linki */}
          <div className="p-3 border-t border-border bg-secondary/50 flex items-center justify-between text-xs text-muted-foreground">
            <span>PDF görüntülenemiyor mu?</span>
            <a
              href={legacyPdfUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline flex items-center gap-1"
            >
              Yeni sekmede aç <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      ) : (
        <div className="py-16 text-center rounded-xl border border-border bg-secondary/30">
          <p className="text-muted-foreground mb-4">Bu makale için tam metin PDF mevcut değil.</p>
          <Link href={articleUrl} className={cn(buttonVariants({ variant: 'outline' }))}>
            Makale sayfasına dön
          </Link>
        </div>
      )}
    </div>
  )
}
