/**
 * Google Scholar uyumlu Highwire Press meta etiketleri
 *
 * Referans: https://scholar.google.com/intl/en/scholar/inclusion.html#indexing
 * citation_publication_date → YYYY/MM/DD veya YYYY
 * citation_abstract         → Düz metin (HTML yok)
 */

export interface CitationMetaProps {
  title: string
  authors: string[]
  journalTitle: string
  issn?: string | null
  year?: number | null
  volume?: string | null
  issue?: string | null
  pageStart?: number | string | null
  pageEnd?: number | string | null
  pdfUrl?: string | null
  doi?: string | null
  language?: string | null
  abstract?: string | null
}

export function CitationMeta({
  title,
  authors,
  journalTitle,
  issn,
  year,
  volume,
  issue,
  pageStart,
  pageEnd,
  pdfUrl,
  doi,
  language,
  abstract,
}: CitationMetaProps) {
  // Scholar "citation_pdf_url" HTTPS + PDF mime type beklentisi
  const safePdfUrl = pdfUrl?.startsWith('http') ? pdfUrl : null

  return (
    <>
      <meta name="citation_title" content={title} />
      {authors.map((author, i) => (
        <meta key={i} name="citation_author" content={author} />
      ))}
      <meta name="citation_journal_title" content={journalTitle} />
      {issn && <meta name="citation_issn" content={issn} />}
      {/* citation_publication_date — Scholar'ın beklediği isim */}
      {year && <meta name="citation_publication_date" content={String(year)} />}
      {volume && <meta name="citation_volume" content={volume} />}
      {issue && <meta name="citation_issue" content={issue} />}
      {pageStart != null && <meta name="citation_firstpage" content={String(pageStart)} />}
      {pageEnd != null && <meta name="citation_lastpage" content={String(pageEnd)} />}
      {safePdfUrl && <meta name="citation_pdf_url" content={safePdfUrl} />}
      {doi && <meta name="citation_doi" content={doi} />}
      {language && <meta name="citation_language" content={language} />}
      {/* Özet düz metin — HTML strip edilmeli */}
      {abstract && (
        <meta
          name="citation_abstract"
          content={abstract.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500)}
        />
      )}
    </>
  )
}

/**
 * Testlerde kullanmak için: meta veri objesini döner (render olmadan)
 */
export function buildCitationData(props: CitationMetaProps) {
  return {
    citation_title: props.title,
    citation_authors: props.authors,
    citation_journal_title: props.journalTitle,
    citation_publication_date: props.year ? String(props.year) : null,
    citation_issn: props.issn ?? null,
    citation_volume: props.volume ?? null,
    citation_issue: props.issue ?? null,
    citation_firstpage: props.pageStart != null ? String(props.pageStart) : null,
    citation_lastpage: props.pageEnd != null ? String(props.pageEnd) : null,
    citation_pdf_url: props.pdfUrl?.startsWith('http') ? props.pdfUrl : null,
    citation_doi: props.doi ?? null,
    citation_language: props.language ?? null,
    citation_abstract: props.abstract
      ? props.abstract.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500)
      : null,
  }
}
