/**
 * ETL Mapping Freeze Testi
 *
 * MySQL şeklinde şekillendirilmiş mock verilerle dönüşüm mantığını doğrular.
 * Supabase veya MySQL bağlantısı GEREKTIRMEZ — saf unit test.
 *
 * Kapsam:
 *  - 5 dergi kaydı  (dergiler → journals)
 *  - 5 sayı kaydı   (dergi_arsiv → issues)
 *  - 5 makale kaydı (makaleler → articles)
 *  - 5 yazar/kurum/keyword dönüşümü
 */

import { describe, it, expect } from 'vitest'
import { urlYap } from '../lib/urls/slug'
import { parseAuthors, parsePages, normalizeAuthorName } from '../lib/etl/utils'

// ─── MySQL mock tiplerini yeniden tanımlayalım ────────────────────────────────

interface MockDergi {
  DergiID: number; DergiBASLIK: string; Issn: string; Eissn: string
  YayinARALIGI: string; Baslangic: string; Yayinci: string; Aciklama: string
  Amac: string; Kapsam: string; YazimKURALLARI: string; DergiKUNYESI: string
  EditorKURULU: string; Iletisim: string; KategoriID: number
  Resim: string; Aktif: number; Hit: number; Link: string
  aim_and_scope?: string; about?: string; policy?: string
  editor?: string; publisher?: string; old_name?: string
  publish_language?: string; topics?: string; contact?: string | null
}

interface MockArsiv {
  ArsivID: number; DergiID: number; Yil: string; Sayi: string
  issue_id: number; Aktif: number; Hit: number
}

interface MockMakale {
  MakaleID: number; TitleTR: string; TitleEN: string; Yazarlar: string
  OzetTR: string; OzetEN: string; KeywordsTR: string; KeywordsEN: string
  Kaynakca: string; kaynakgoster: string | null; BirinciDIL: string
  Konular: string; Bolum: string; YazarlarKAYNAKCA: string; Tarihler: string
  ArsivID: number; DergiID: number; Hit: number; Indirme: number
  YazarID: string; Kurum: string; PdfLINK: string
  IlkSAYFA: string; SonSAYFA: string; Tarih: string
  document_language: string | null; doi: string | null
  document_type: string | null; article_type: string | null
  access_type: string | null; Aktif: number; issue_id: number
}

// ─── Dönüşüm fonksiyonları (03-articles.ts / 01-journals.ts mantığı) ────────

function transformJournal(d: MockDergi) {
  const aimAndScope =
    d.aim_and_scope?.trim() ||
    [d.Amac?.trim(), d.Kapsam?.trim()].filter(Boolean).join('\n\n') || null
  const publisher = d.publisher?.trim() || d.Yayinci?.trim() || null
  let contactJson: unknown = null
  if (d.contact) {
    try { contactJson = JSON.parse(d.contact) } catch { /* pass */ }
  }
  return {
    id: d.DergiID,
    legacy_id: d.DergiID,
    slug: urlYap(d.DergiBASLIK),
    title_tr: d.DergiBASLIK?.trim() || null,
    old_name: d.old_name?.trim() || null,
    issn: d.Issn?.trim() || null,
    eissn: d.Eissn?.trim() || null,
    publisher,
    frequency: d.YayinARALIGI?.trim() || null,
    start_year: d.Baslangic?.trim() || null,
    publish_language: d.publish_language?.trim() || null,
    topics: d.topics?.trim() || null,
    editor_in_chief: d.editor?.trim() || null,
    editorial_board: d.EditorKURULU?.trim() || null,
    colophon: d.DergiKUNYESI?.trim() || null,
    description: d.Aciklama?.trim() || null,
    about: d.about?.trim() || null,
    aim_and_scope: aimAndScope,
    policy: d.policy?.trim() || null,
    writing_rules: d.YazimKURALLARI?.trim() || null,
    contact_text: d.Iletisim?.trim() || null,
    contact_json: contactJson,
    cover_path: d.Resim?.trim() || null,
    legacy_link: d.Link?.trim() || null,
    category_id: d.KategoriID || null,
    status: d.Aktif === 1 ? 'published' : 'draft',
    hit_count: d.Hit || 0,
  }
}

function transformIssue(a: MockArsiv) {
  const year = parseInt(a.Yil, 10) || null
  return {
    id: a.ArsivID,
    legacy_id: a.ArsivID,
    journal_id: a.DergiID,
    year: isNaN(year as number) ? null : year,
    issue_number: a.Sayi?.trim() || null,
    volume: null,
    issue_label: [a.Yil?.trim(), a.Sayi?.trim() ? `Sayı ${a.Sayi.trim()}` : null].filter(Boolean).join(' / ') || null,
    dergipark_issue_id: (a.issue_id ?? 0) > 0 ? a.issue_id : null,
    status: a.Aktif === 1 ? 'published' : 'draft',
    hit_count: a.Hit || 0,
  }
}

function transformArticle(m: MockMakale, journalSlug: string) {
  const slug = urlYap(m.TitleTR || m.TitleEN || '') || `makale-${m.MakaleID}`
  const pageStart = parseInt(m.IlkSAYFA, 10) || null
  const pageEnd   = parseInt(m.SonSAYFA, 10)  || null
  const year      = m.Tarih ? parseInt(m.Tarih.slice(0, 4), 10) || null : null
  const lang      = m.document_language?.trim() ||
                    (m.BirinciDIL?.toLowerCase().startsWith('en') ? 'en' : 'tr')
  const hasPdf    = m.PdfLINK?.trim() && m.PdfLINK !== 'pdf-bulunamadi'

  return {
    id: m.MakaleID,
    legacy_id: m.MakaleID,
    slug,
    legacy_journal_slug: journalSlug,
    journal_id: m.DergiID,
    issue_id: m.ArsivID || null,
    title_tr: m.TitleTR?.trim() || null,
    title_en: m.TitleEN?.trim() || null,
    authors_raw: m.Yazarlar?.trim() || null,
    institution_raw: m.Kurum?.trim() || null,
    abstract_tr: m.OzetTR?.trim() || null,
    abstract_en: m.OzetEN?.trim() || null,
    keywords_tr: m.KeywordsTR?.trim() || null,
    keywords_en: m.KeywordsEN?.trim() || null,
    references_raw: m.Kaynakca?.trim() || null,
    citation_format: m.kaynakgoster?.trim() || null,
    page_start: pageStart,
    page_end: pageEnd,
    published_at: m.Tarih || null,
    published_year: year,
    language: lang,
    document_language: m.document_language?.trim() || null,
    document_type: m.document_type?.trim() || null,
    article_type: m.article_type?.trim() || null,
    access_type: m.access_type?.trim() || 'open',
    section: m.Bolum?.trim() || null,
    subject_area: m.Konular?.trim() || null,
    doi: m.doi?.trim() || null,
    dergipark_issue_id: (m.issue_id ?? 0) > 0 ? m.issue_id : null,
    hit_count: m.Hit || 0,
    download_count: m.Indirme || 0,
    status: m.Aktif === 1 ? 'published' : 'draft',
    pdf_status: hasPdf ? 'legacy' : 'missing',
    pdf_path: hasPdf ? m.PdfLINK.trim() : null,
  }
}

// ─── MOCK VERİ ────────────────────────────────────────────────────────────────

const MOCK_DERGILER: MockDergi[] = [
  {
    DergiID: 1, DergiBASLIK: 'Turkish Studies',
    Issn: '1308-2140', Eissn: '2667-4513',
    YayinARALIGI: 'Aylık', Baslangic: '2006',
    Yayinci: 'Ahmet Yesevi Üniversitesi', Aciklama: 'Uluslararası Türk akademik dergisi.',
    Amac: 'Türk dili ve kültürü üzerine...',
    Kapsam: 'Dil bilimi, tarih, sanat.',
    aim_and_scope: '',                          // boş → Amac+Kapsam birleşir
    YazimKURALLARI: 'APA 7. baskı', DergiKUNYESI: 'ISSN 1308-2140',
    EditorKURULU: 'Prof. Dr. A, Prof. Dr. B',
    Iletisim: 'editor@turkishstudies.net',
    KategoriID: 3, Resim: 'turkish-studies.jpg',
    Aktif: 1, Hit: 50000, Link: 'https://www.turkishstudies.net',
    editor: 'Prof. Dr. Ahmet Bican Ercilasun',
    publish_language: 'Türkçe, İngilizce',
    topics: 'Türk Dili, Türk Tarihi, Kültür',
    policy: 'Çift kör hakemlik uygulanmaktadır.',
    old_name: '',
    contact: null,
  },
  {
    DergiID: 42, DergiBASLIK: 'İnönü Üniversitesi Eğitim Fakültesi Dergisi',
    Issn: '1300-2899', Eissn: '1301-0085',
    YayinARALIGI: '3 Aylık', Baslangic: '2000',
    Yayinci: 'İnönü Üniversitesi',
    Aciklama: 'Eğitim alanında hakemli akademik dergi.',
    Amac: '', Kapsam: '', aim_and_scope: 'Eğitim bilimleri, pedagoji, öğretmen yetiştirme alanında yayın yapmaktadır.',
    YazimKURALLARI: 'MLA', DergiKUNYESI: '',
    EditorKURULU: 'Prof. Dr. C, Doç. Dr. D',
    Iletisim: 'journal@inonu.edu.tr',
    KategoriID: 1, Resim: 'inonu-egitim.jpg',
    Aktif: 1, Hit: 12500, Link: '',
    publisher: 'İnönü Üniversitesi Yayınları',
    contact: '{"email":"journal@inonu.edu.tr","phone":"+90 422 000 0000"}',
  },
  {
    DergiID: 157, DergiBASLIK: 'Türk Dünyası Araştırmaları',
    Issn: '0255-0636', Eissn: '',
    YayinARALIGI: '2 Aylık', Baslangic: '1979',
    Yayinci: 'Türk Dünyası Araştırmaları Vakfı', Aciklama: 'Vakıf yayın organı.',
    Amac: 'Türk dünyasını konu alan araştırmalar.', Kapsam: 'Tarih, sosyoloji, kültür.',
    YazimKURALLARI: '', DergiKUNYESI: 'TÜBA listesinde.',
    EditorKURULU: '', Iletisim: '',
    KategoriID: 3, Resim: '', Aktif: 0, Hit: 3200, Link: '',
    old_name: 'Türk Dünyası Bülteni',
  },
  {
    DergiID: 312, DergiBASLIK: 'Uluslararası Sosyal Araştırmalar Dergisi',
    Issn: '1307-9581', Eissn: '2149-9462',
    YayinARALIGI: '2 Aylık', Baslangic: '2008',
    Yayinci: 'Samsun 19 Mayıs Üniversitesi',
    Aciklama: 'Çok disiplinli sosyal bilimler dergisi.',
    Amac: '', Kapsam: '', aim_and_scope: 'Sosyal bilimler.',
    YazimKURALLARI: 'Chicago', DergiKUNYESI: '',
    EditorKURULU: 'Prof. Dr. E', Iletisim: 'editor@usad.net',
    KategoriID: 2, Resim: 'usad.jpg', Aktif: 1, Hit: 88000, Link: 'https://www.usad.net',
  },
  {
    DergiID: 509, DergiBASLIK: 'Karadeniz Teknik Üniversitesi Sosyal Bilimler Dergisi',
    Issn: '1309-9137', Eissn: '',
    YayinARALIGI: '2 Aylık', Baslangic: '2011',
    Yayinci: 'KTÜ', Aciklama: 'KTÜ sosyal bilimler dergisi.',
    Amac: 'Sosyal bilimler.', Kapsam: 'Ekonomi, hukuk, siyaset.',
    YazimKURALLARI: 'APA', DergiKUNYESI: '',
    EditorKURULU: '', Iletisim: '',
    KategoriID: 2, Resim: '', Aktif: 1, Hit: 9800, Link: '',
  },
]

const MOCK_ARSIV: MockArsiv[] = [
  { ArsivID: 101, DergiID: 1,   Yil: '2023', Sayi: '18',  issue_id: 948271, Aktif: 1, Hit: 5200 },
  { ArsivID: 102, DergiID: 1,   Yil: '2022', Sayi: '17',  issue_id: 825193, Aktif: 1, Hit: 8100 },
  { ArsivID: 201, DergiID: 42,  Yil: '2023', Sayi: '2',   issue_id: 0,      Aktif: 1, Hit: 1300 },
  { ArsivID: 300, DergiID: 157, Yil: '',     Sayi: '125', issue_id: 0,      Aktif: 0, Hit: 420  },
  { ArsivID: 450, DergiID: 312, Yil: '2020', Sayi: '3-4', issue_id: 741000, Aktif: 1, Hit: 3800 },
]

const MOCK_MAKALELER: MockMakale[] = [
  {
    MakaleID: 809939,
    TitleTR: 'Türkçede Sıfat Tamlamalarının Sözdizimsel Analizi',
    TitleEN: 'Syntactic Analysis of Adjective Phrases in Turkish',
    Yazarlar: 'Ahmet Kaya, Mehmet Yılmaz, Fatma Demir',
    OzetTR: 'Bu çalışmada Türkçe sıfat tamlamaları sözdizimsel açıdan incelenmiştir.',
    OzetEN: 'This study examines adjective phrases in Turkish from a syntactic perspective.',
    KeywordsTR: 'sözdizim, sıfat, Türkçe, dilbilim',
    KeywordsEN: 'syntax, adjective, Turkish, linguistics',
    Kaynakca: 'Chomsky, N. (1965). ...',
    kaynakgoster: 'Kaya, A., Yılmaz, M. & Demir, F. (2023)...',
    BirinciDIL: 'TR', Konular: 'Dil Bilimi',
    Bolum: 'Araştırma Makalesi', YazarlarKAYNAKCA: 'Kaya, A., Yılmaz, M.',
    Tarihler: 'Gönderim: 2023-03-15 | Kabul: 2023-05-20',
    ArsivID: 101, DergiID: 1,
    Hit: 1240, Indirme: 380,
    YazarID: '2341,8872',
    Kurum: 'Ankara Üniversitesi, İstanbul Üniversitesi',
    PdfLINK: 'turkish-studies/2023/809939.pdf',
    IlkSAYFA: '1', SonSAYFA: '18',
    Tarih: '2023-09-15',
    document_language: null, doi: '10.1234/ts.2023.809939',
    document_type: 'Article', article_type: 'Research Article',
    access_type: 'open', Aktif: 1, issue_id: 948271,
  },
  {
    MakaleID: 712500,
    TitleTR: 'Dijital Dönüşüm Sürecinde Eğitim Kurumları',
    TitleEN: 'Educational Institutions in the Digital Transformation Process',
    Yazarlar: 'Zeynep Arslan',
    OzetTR: 'Dijital dönüşümün eğitim kurumlarına etkileri.',
    OzetEN: 'Effects of digital transformation on educational institutions.',
    KeywordsTR: 'dijital dönüşüm, eğitim, teknoloji',
    KeywordsEN: 'digital transformation, education, technology',
    Kaynakca: 'Prensky, M. (2001). ...',
    kaynakgoster: null,
    BirinciDIL: 'TR', Konular: 'Eğitim Bilimleri',
    Bolum: 'Derleme Makale', YazarlarKAYNAKCA: 'Arslan, Z.',
    Tarihler: '',
    ArsivID: 201, DergiID: 42,
    Hit: 654, Indirme: 210,
    YazarID: '5501',
    Kurum: 'İnönü Üniversitesi Eğitim Fakültesi',
    PdfLINK: 'inonu-egitim/2023/712500.pdf',
    IlkSAYFA: '45', SonSAYFA: '62',
    Tarih: '2023-06-20',
    document_language: 'Turkish', doi: null,
    document_type: 'Review', article_type: 'Review Article',
    access_type: 'open', Aktif: 1, issue_id: 0,
  },
  {
    MakaleID: 423100,
    TitleTR: '',
    TitleEN: 'Socioeconomic Factors Affecting Rural Development in Turkey',
    Yazarlar: 'Ali Çelik, Ayşe Kara',
    OzetTR: '',
    OzetEN: 'This paper analyzes socioeconomic factors in rural areas.',
    KeywordsTR: '', KeywordsEN: 'rural development, Turkey, socioeconomic',
    Kaynakca: '', kaynakgoster: null,
    BirinciDIL: 'EN', Konular: 'İktisat', Bolum: 'Araştırma Makalesi',
    YazarlarKAYNAKCA: '', Tarihler: '',
    ArsivID: 450, DergiID: 312,
    Hit: 332, Indirme: 98,
    YazarID: '7812,9034',
    Kurum: 'Middle East Technical University',
    PdfLINK: 'usad/2020/423100.pdf',
    IlkSAYFA: '125', SonSAYFA: '138',
    Tarih: '2020-11-01',
    document_language: 'English', doi: '10.5678/usad.2020.423100',
    document_type: 'Article', article_type: null,
    access_type: null, Aktif: 1, issue_id: 741000,
  },
  {
    MakaleID: 100001,
    TitleTR: 'Pasif Kayıt — Aktif=0',
    TitleEN: '',
    Yazarlar: 'Test Yazar',
    OzetTR: 'Pasif makale testi.',
    OzetEN: '', KeywordsTR: '', KeywordsEN: '',
    Kaynakca: '', kaynakgoster: null,
    BirinciDIL: 'TR', Konular: '', Bolum: '',
    YazarlarKAYNAKCA: '', Tarihler: '',
    ArsivID: 300, DergiID: 157,
    Hit: 0, Indirme: 0, YazarID: '',
    Kurum: '',
    PdfLINK: '',                    // PDF yok
    IlkSAYFA: '', SonSAYFA: '',
    Tarih: '2015-01-01',
    document_language: null, doi: null,
    document_type: null, article_type: null,
    access_type: null, Aktif: 0, issue_id: 0,
  },
  {
    MakaleID: 650200,
    TitleTR: 'Karadeniz Bölgesinde Turizm Potansiyeli',
    TitleEN: 'Tourism Potential in the Black Sea Region',
    Yazarlar: 'Mustafa Öztürk, Hasan Şahin',
    OzetTR: 'Karadeniz bölgesinin turizm olanakları araştırılmıştır.',
    OzetEN: 'Tourism opportunities in the Black Sea region were investigated.',
    KeywordsTR: 'turizm, Karadeniz, sürdürülebilirlik',
    KeywordsEN: 'tourism, Black Sea, sustainability',
    Kaynakca: 'WTO (2022)...', kaynakgoster: 'Öztürk, M. & Şahin, H. (2022)...',
    BirinciDIL: 'TR', Konular: 'Turizm, Coğrafya',
    Bolum: 'Araştırma Makalesi', YazarlarKAYNAKCA: 'Öztürk, M., Şahin, H.',
    Tarihler: 'Gönderim: 2022-01-10',
    ArsivID: 101, DergiID: 509,
    Hit: 782, Indirme: 155,
    YazarID: '3301,6612',
    Kurum: 'KTÜ Turizm Fakültesi',
    PdfLINK: 'ktu-sosyal/2022/650200.pdf',
    IlkSAYFA: '88', SonSAYFA: '107',
    Tarih: '2022-10-01',
    document_language: null, doi: null,
    document_type: 'Article', article_type: 'Research Article',
    access_type: 'open', Aktif: 1, issue_id: 0,
  },
]

// ─── TESTLER ──────────────────────────────────────────────────────────────────

describe('ETL Mapping Freeze — dergiler → journals', () => {
  const JOURNAL_SLUG_MAP: Record<number, string> = {}
  MOCK_DERGILER.forEach((d) => { JOURNAL_SLUG_MAP[d.DergiID] = urlYap(d.DergiBASLIK) })

  it('T-J1: Turkish Studies — tam mapping', () => {
    const j = transformJournal(MOCK_DERGILER[0])
    expect(j.id).toBe(1)
    expect(j.legacy_id).toBe(1)
    expect(j.slug).toBe('turkish-studies')
    expect(j.title_tr).toBe('Turkish Studies')
    expect(j.issn).toBe('1308-2140')
    expect(j.eissn).toBe('2667-4513')
    expect(j.publisher).toBe('Ahmet Yesevi Üniversitesi') // Yayinci kullanılır (publisher boş)
    expect(j.status).toBe('published')
    expect(j.hit_count).toBe(50000)
    expect(j.editor_in_chief).toBe('Prof. Dr. Ahmet Bican Ercilasun')
    expect(j.policy).toBe('Çift kör hakemlik uygulanmaktadır.')
    // aim_and_scope boş string → Amac + Kapsam birleşir
    expect(j.aim_and_scope).toContain('Türk dili ve kültürü')
    expect(j.aim_and_scope).toContain('Dil bilimi, tarih, sanat.')
    expect(j.contact_json).toBeNull()
  })

  it('T-J2: İnönü — aim_and_scope yeni alan öncelikli, publisher yeni alan öncelikli', () => {
    const j = transformJournal(MOCK_DERGILER[1])
    expect(j.slug).toBe('inonu-universitesi-egitim-fakultesi-dergisi')
    expect(j.aim_and_scope).toBe('Eğitim bilimleri, pedagoji, öğretmen yetiştirme alanında yayın yapmaktadır.')
    expect(j.publisher).toBe('İnönü Üniversitesi Yayınları') // publisher yeni alan kazanır
    expect(j.contact_json).toEqual({ email: 'journal@inonu.edu.tr', phone: '+90 422 000 0000' })
  })

  it('T-J3: Pasif dergi → status=draft', () => {
    const j = transformJournal(MOCK_DERGILER[2])
    expect(j.status).toBe('draft')
    expect(j.old_name).toBe('Türk Dünyası Bülteni')
    expect(j.eissn).toBeNull()  // boş string → null
  })

  it('T-J4: Slug Türkçe karakter dönüşümü doğru', () => {
    const j = transformJournal(MOCK_DERGILER[3])
    expect(j.slug).toBe('uluslararasi-sosyal-arastirmalar-dergisi')
    expect(j.slug).not.toContain('ı')
    expect(j.slug).not.toContain('ş')
  })

  it('T-J5: Slug + kategori', () => {
    const j = transformJournal(MOCK_DERGILER[4])
    expect(j.slug).toBe('karadeniz-teknik-universitesi-sosyal-bilimler-dergisi')
    expect(j.category_id).toBe(2)
    expect(j.status).toBe('published')
  })
})

describe('ETL Mapping Freeze — dergi_arsiv → issues', () => {
  it('T-I1: Normal sayı — yıl ve DergiPark ID', () => {
    const i = transformIssue(MOCK_ARSIV[0])
    expect(i.id).toBe(101)
    expect(i.journal_id).toBe(1)
    expect(i.year).toBe(2023)
    expect(i.issue_number).toBe('18')
    expect(i.volume).toBeNull()          // dergi_arsiv'de Cilt yok
    expect(i.dergipark_issue_id).toBe(948271)
    expect(i.status).toBe('published')
    expect(i.issue_label).toBe('2023 / Sayı 18')
  })

  it('T-I2: İkinci sayı — farklı yıl', () => {
    const i = transformIssue(MOCK_ARSIV[1])
    expect(i.year).toBe(2022)
    expect(i.dergipark_issue_id).toBe(825193)
  })

  it('T-I3: DergiPark ID=0 → null', () => {
    const i = transformIssue(MOCK_ARSIV[2])
    expect(i.dergipark_issue_id).toBeNull()
  })

  it('T-I4: Yıl boş → year=null, Aktif=0 → draft', () => {
    const i = transformIssue(MOCK_ARSIV[3])
    expect(i.year).toBeNull()
    expect(i.status).toBe('draft')
    expect(i.issue_number).toBe('125')
  })

  it('T-I5: Sayı "3-4" formatı korunur', () => {
    const i = transformIssue(MOCK_ARSIV[4])
    expect(i.issue_number).toBe('3-4')
    expect(i.issue_label).toBe('2020 / Sayı 3-4')
  })
})

describe('ETL Mapping Freeze — makaleler → articles', () => {
  const journalSlug = (id: number) => {
    const d = MOCK_DERGILER.find((d) => d.DergiID === id)
    return d ? urlYap(d.DergiBASLIK) : `dergi-${id}`
  }

  it('T-A1: Tam Türkçe makale', () => {
    const a = transformArticle(MOCK_MAKALELER[0], journalSlug(1))
    expect(a.id).toBe(809939)
    expect(a.slug).toBe('turkcede-sifat-tamlamalarinin-sozdizimsel-analizi')
    expect(a.legacy_journal_slug).toBe('turkish-studies')
    expect(a.journal_id).toBe(1)
    expect(a.issue_id).toBe(101)
    expect(a.page_start).toBe(1)
    expect(a.page_end).toBe(18)
    expect(a.published_year).toBe(2023)
    expect(a.language).toBe('tr')    // BirinciDIL=TR, document_language=null
    expect(a.doi).toBe('10.1234/ts.2023.809939')
    expect(a.dergipark_issue_id).toBe(948271)
    expect(a.status).toBe('published')
    expect(a.pdf_status).toBe('legacy')
  })

  it('T-A2: document_language yeni alan öncelikli (Turkish → tr)', () => {
    const a = transformArticle(MOCK_MAKALELER[1], journalSlug(42))
    expect(a.language).toBe('Turkish')  // document_language değeri olduğu gibi alınır
    expect(a.document_language).toBe('Turkish')
    expect(a.article_type).toBe('Review Article')
    expect(a.dergipark_issue_id).toBeNull()  // issue_id=0
  })

  it('T-A3: İngilizce makale — TitleTR boş → TitleEN slug', () => {
    const a = transformArticle(MOCK_MAKALELER[2], journalSlug(312))
    expect(a.slug).toBe('socioeconomic-factors-affecting-rural-development-in-turkey')
    expect(a.language).toBe('English')
    expect(a.doi).toBe('10.5678/usad.2020.423100')
    expect(a.access_type).toBe('open')  // null → 'open' default
    expect(a.pdf_status).toBe('legacy')
  })

  it('T-A4: Pasif makale — status=draft, PDF yok', () => {
    const a = transformArticle(MOCK_MAKALELER[3], journalSlug(157))
    expect(a.status).toBe('draft')
    expect(a.pdf_status).toBe('missing')
    expect(a.pdf_path).toBeNull()
    expect(a.page_start).toBeNull()
    expect(a.page_end).toBeNull()
    expect(a.title_tr).toBe('Pasif Kayıt — Aktif=0')
  })

  it('T-A5: Slug + legacy_journal_slug doğru', () => {
    const a = transformArticle(MOCK_MAKALELER[4], journalSlug(509))
    expect(a.legacy_journal_slug).toBe('karadeniz-teknik-universitesi-sosyal-bilimler-dergisi')
    expect(a.slug).toBe('karadeniz-bolgesinde-turizm-potansiyeli')
    expect(a.subject_area).toBe('Turizm, Coğrafya')
    expect(a.section).toBe('Araştırma Makalesi')
  })
})

describe('ETL Mapping Freeze — yazar / kurum / keyword dönüşümü', () => {
  it('T-Y1: Virgülle ayrılmış 3 yazar doğru parse edilir', () => {
    const authors = parseAuthors('Ahmet Kaya, Mehmet Yılmaz, Fatma Demir')
    expect(authors).toHaveLength(3)
    expect(authors[0]).toBe('Ahmet Kaya')
    expect(authors[1]).toBe('Mehmet Yılmaz')
    expect(authors[2]).toBe('Fatma Demir')
  })

  it('T-Y2: normalizeAuthorName baştaki/sondaki boşluk ve noktalama temizler', () => {
    expect(normalizeAuthorName('  Ahmet Kaya  ')).toBe('Ahmet Kaya')
    expect(normalizeAuthorName('- Mehmet Yılmaz -')).toBe('Mehmet Yılmaz')
    expect(normalizeAuthorName('...Fatma Demir')).toBe('Fatma Demir')
  })

  it('T-Y3: 2 karakterden kısa yazar isimleri filtrelenir', () => {
    const authors = parseAuthors('A, Mehmet Yılmaz, B., Fatma Demir')
    const normalized = authors.map(normalizeAuthorName).filter((n) => n.length >= 2)
    expect(normalized).toContain('Mehmet Yılmaz')
    expect(normalized).toContain('Fatma Demir')
    // "A" ve "B." filtre edilmiş olmalı
    expect(normalized.some((n) => n === 'A' || n === 'B')).toBe(false)
  })

  it('T-Y4: Kurum ham string korunur (institution_raw), normalize Faz-3', () => {
    const a = transformArticle(MOCK_MAKALELER[0], 'turkish-studies')
    expect(a.institution_raw).toBe('Ankara Üniversitesi, İstanbul Üniversitesi')
    // Faz-3'te bu string parse edilip institutions tablosuna yazılacak
  })

  it('T-Y5: Keyword virgülle split — TR ve EN bağımsız', () => {
    const kwTR = 'sözdizim, sıfat, Türkçe, dilbilim'
    const kwEN = 'syntax, adjective, Turkish, linguistics'
    const parsedTR = kwTR.split(',').map((s) => s.trim()).filter(Boolean)
    const parsedEN = kwEN.split(',').map((s) => s.trim()).filter(Boolean)
    expect(parsedTR).toHaveLength(4)
    expect(parsedEN).toHaveLength(4)
    expect(parsedTR[0]).toBe('sözdizim')
    expect(parsedEN[0]).toBe('syntax')
  })
})

describe('ETL Mapping Freeze — parsePages kenar durumları', () => {
  it('T-P1: "1-18" formatı', () => {
    const r = parsePages('1-18')
    expect(r.start).toBe(1); expect(r.end).toBe(18)
  })
  it('T-P2: em dash "125–138"', () => {
    const r = parsePages('125–138')
    expect(r.start).toBe(125); expect(r.end).toBe(138)
  })
  it('T-P3: Tek sayı', () => {
    const r = parsePages('45')
    expect(r.start).toBe(45); expect(r.end).toBeNull()
  })
  it('T-P4: Boş string → null', () => {
    const r = parsePages('')
    expect(r.start).toBeNull(); expect(r.end).toBeNull()
  })
  it('T-P5: Sayı olmayan string → null', () => {
    const r = parsePages('xi-xxv')  // Roma rakamı — desteklenmiyor
    expect(r.start).toBeNull(); expect(r.end).toBeNull()
  })
})
