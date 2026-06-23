/**
 * Arama senaryoları — yerel dev + fixture verisi.
 */
const BASE = process.argv[2] ?? 'http://localhost:3000'

const queries = [
  { label: 'tam başlık', path: '/search?q=Geliştirme+makale+1&type=article' },
  { label: 'birkaç kelime', path: '/search?q=Geliştirme+makale&type=article' },
  { label: 'Türkçe karakter', path: '/search?q=Çok+uzun+başlık&type=article' },
  { label: 'yazar adı', path: '/search?q=Tek+Yazar+Fixture&type=author' },
  { label: 'dergi adı', path: '/search?q=Geliştirme+Dergisi&type=journal' },
  { label: 'sonuç yok', path: '/search?q=nonexistent-xyz-12345&type=article' },
  { label: 'kısa sorgu', path: '/search?q=a&type=article' },
  {
    label: 'uzun sorgu',
    path:
      '/search?q=' +
      encodeURIComponent(
        'Çok uzun başlık örneği Türkiye sosyal bilimler metodolojik yaklaşımlar disiplinler arası',
      ) +
      '&type=article',
  },
]

async function probe(path: string) {
  const res = await fetch(`${BASE}${path}`)
  const html = await res.text()
  const totalMatch = html.match(/(\d[\d\s.,]*)\s*sonuç bulundu/i)
  const noResults = html.includes('Sonuç bulunamadı') || html.includes('eşleşen kayıt yok')
  const empty = html.includes('Aramak istediğinizi yazın')
  const dbError = html.includes('Katalog veritabanına bağlanılamadı')
  const resultItems = (html.match(/search-results-heading|ArticleResultItem|divide-y divide-border/gi) ?? []).length
  return {
    status: res.status,
    total: totalMatch?.[1]?.replace(/\s/g, '') ?? null,
    noResults,
    empty,
    dbError,
    hasPagination: html.includes('aria-label="Sayfalama"'),
  }
}

async function main() {
  const results = []
  for (const q of queries) {
    results.push({ ...q, ...(await probe(q.path)) })
  }
  console.log(JSON.stringify({ base: BASE, results }, null, 2))
}

main()
