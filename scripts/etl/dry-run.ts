/**
 * ETL Dry-Run — veri yazmadan önce kolon varlığını, kayıt sayılarını
 * ve dönüşüm sonuçlarını raporlar.
 *
 * Kullanım:
 *   npx tsx scripts/etl/dry-run.ts
 *   npx tsx scripts/etl/dry-run.ts --sample 20
 *   npx tsx scripts/etl/dry-run.ts --table dergiler
 *
 * Çıktı:
 *   - Her tablo için kayıt sayısı
 *   - Zorunlu alan boşluk oranı
 *   - Duplicate tespiti
 *   - 5 örnek kayıt dönüşümü
 *   - SUPABASE'E HİÇBİR VERİ YAZILMAZ
 */

import { getMysqlPool } from './db'
import { urlYap } from '../../lib/urls/slug'
import { parseAuthors, parsePages, normalizeAuthorName } from '../../lib/etl/utils'
import type mysql from 'mysql2/promise'
import fs from 'fs'
import path from 'path'

const args = process.argv.slice(2)
const sampleSize = parseInt(args[args.indexOf('--sample') + 1] ?? '5', 10)
const onlyTable = args[args.indexOf('--table') + 1] ?? null

// ─── Renk kodları ────────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', cyan: '\x1b[36m', white: '\x1b[37m',
}
const ok  = `${C.green}✓${C.reset}`
const warn = `${C.yellow}⚠${C.reset}`
const err  = `${C.red}✗${C.reset}`
const info = `${C.blue}ℹ${C.reset}`

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

/** Tablodan kolon listesi alır (MySQL DESCRIBE) */
async function getColumns(pool: mysql.Pool, table: string): Promise<string[]> {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(`DESCRIBE \`${table}\``)
  return (rows as { Field: string }[]).map((r) => r.Field)
}

/** Tablonun varlığını kontrol eder */
async function tableExists(pool: mysql.Pool, table: string): Promise<boolean> {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) as c FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [table],
  )
  return (rows[0] as { c: number }).c > 0
}

/** NULL / boş kayıt oranını döner */
async function nullRate(pool: mysql.Pool, table: string, col: string, total: number): Promise<number> {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) as c FROM \`${table}\` WHERE \`${col}\` IS NULL OR \`${col}\` = ''`,
  )
  const empty = (rows[0] as { c: number }).c
  return total === 0 ? 0 : Math.round((empty / total) * 100)
}

function printSection(title: string) {
  console.log(`\n${C.bold}${C.cyan}${'═'.repeat(60)}${C.reset}`)
  console.log(`${C.bold} ${title}${C.reset}`)
  console.log(`${C.cyan}${'═'.repeat(60)}${C.reset}`)
}

function printTable(rows: Record<string, string>[], cols: string[]) {
  const widths = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? '').length)))
  const hr = '+' + widths.map((w) => '-'.repeat(w + 2)).join('+') + '+'
  const row = (r: Record<string, string>) =>
    '|' + cols.map((c, i) => ` ${String(r[c] ?? '').padEnd(widths[i])} `).join('|') + '|'
  console.log(hr)
  console.log(row(Object.fromEntries(cols.map((c) => [c, c]))))
  console.log(hr)
  rows.forEach((r) => console.log(row(r)))
  console.log(hr)
}

// ─── 1. TABLO SAYIM RAPORU ────────────────────────────────────────────────────

async function reportCounts(pool: mysql.Pool) {
  printSection('1. KAYIT SAYILARI')

  const tables = [
    ['dergiler',      'journals'],
    ['dergi_arsiv',   'issues'],
    ['makaleler',     'articles + pdf_files'],
    ['yazarlar',      'authors (basit)'],
    ['kategoriler',   'categories'],
    ['kurumlar',      'institutions'],
    ['uyeler',        'user_profiles'],
    ['dergibasvuru',  'journal_applications'],
    ['bot_makaleler', 'articles (MERGE kaynağı)'],
    ['bot_dergiler',  'journals (MERGE kaynağı)'],
    ['bot_dergi_arsiv', 'issues (MERGE kaynağı)'],
  ]

  const rows: Record<string, string>[] = []
  for (const [table, target] of tables) {
    if (onlyTable && table !== onlyTable) continue
    const exists = await tableExists(pool, table)
    if (!exists) {
      rows.push({ Tablo: table, Hedef: target, Kayıt: 'TABLO YOK', Aktif: '-', Status: `${err} yok` })
      continue
    }
    const [[cnt]] = await pool.execute<mysql.RowDataPacket[]>(`SELECT COUNT(*) as c FROM \`${table}\``)
    const total = (cnt as { c: number }).c
    let active = '-'
    const cols = await getColumns(pool, table)
    if (cols.includes('Aktif')) {
      const [[act]] = await pool.execute<mysql.RowDataPacket[]>(`SELECT COUNT(*) as c FROM \`${table}\` WHERE Aktif = 1`)
      active = String((act as { c: number }).c)
    }
    rows.push({
      Tablo: table,
      Hedef: target,
      Kayıt: String(total),
      Aktif: active,
      Status: `${ok}`,
    })
  }
  printTable(rows, ['Tablo', 'Hedef', 'Kayıt', 'Aktif', 'Status'])
}

// ─── 2. KOLON VARLIK KONTROLÜ ─────────────────────────────────────────────────

const REQUIRED_COLUMNS: Record<string, { required: string[]; optional: string[] }> = {
  dergiler: {
    required: ['DergiID', 'DergiBASLIK', 'Issn', 'Eissn', 'YayinARALIGI',
               'Yayinci', 'Aciklama', 'Amac', 'Kapsam', 'YazimKURALLARI',
               'DergiKUNYESI', 'EditorKURULU', 'Iletisim', 'KategoriID',
               'Resim', 'Aktif', 'Hit', 'Link'],
    optional: ['contact', 'about', 'aim_and_scope', 'policy', 'indexes',
               'price_policy', 'editor', 'topics', 'publisher',
               'publish_language', 'years_indexed', 'subject_category',
               'publication_format', 'old_name', 'Baslangic'],
  },
  dergi_arsiv: {
    required: ['ArsivID', 'DergiID', 'Yil', 'Sayi', 'Aktif', 'Hit'],
    optional: ['issue_id'],
  },
  makaleler: {
    required: ['MakaleID', 'TitleTR', 'TitleEN', 'Yazarlar', 'OzetTR', 'OzetEN',
               'KeywordsTR', 'KeywordsEN', 'Kaynakca', 'BirinciDIL', 'Konular',
               'Bolum', 'YazarlarKAYNAKCA', 'Tarihler', 'ArsivID', 'DergiID',
               'Hit', 'Indirme', 'YazarID', 'Kurum', 'PdfLINK',
               'IlkSAYFA', 'SonSAYFA', 'Tarih', 'Aktif'],
    optional: ['kaynakgoster', 'document_language', 'doi',
               'document_type', 'article_type', 'access_type', 'issue_id'],
  },
  kategoriler: {
    required: ['KategoriID', 'KategoriBASLIKTR', 'KategoriBASLIKEN', 'KategoriURL'],
    optional: [],
  },
  uyeler: {
    required: ['UyeID', 'UyeAD', 'UyeSOYAD', 'UyeMAIL', 'UyeUNVAN', 'UyeKURUM', 'UyeORCID'],
    optional: ['UyeTELEFON', 'UlkeID', 'KurumUYELIGI', 'MailONAY'],
  },
  dergibasvuru: {
    required: ['BasvuruID', 'dergiadi', 'editorisim', 'editoremail', 'durum'],
    optional: ['dergiadieng', 'dergikisaadi', 'dergikurumu', 'issn', 'uyeid'],
  },
}

async function reportColumns(pool: mysql.Pool) {
  printSection('2. KOLON VARLIK KONTROLÜ')

  for (const [table, schema] of Object.entries(REQUIRED_COLUMNS)) {
    if (onlyTable && table !== onlyTable) continue
    const exists = await tableExists(pool, table)
    if (!exists) { console.log(`${err} ${table}: tablo bulunamadı\n`); continue }

    const actual = await getColumns(pool, table)
    const actualSet = new Set(actual)

    console.log(`\n${C.bold}${table}${C.reset} (${actual.length} kolon)`)

    const missing = schema.required.filter((c) => !actualSet.has(c))
    const present = schema.required.filter((c) => actualSet.has(c))
    const optPresent = schema.optional.filter((c) => actualSet.has(c))
    const optMissing = schema.optional.filter((c) => !actualSet.has(c))

    console.log(`  Zorunlu  : ${ok} ${present.length}/${schema.required.length} var${missing.length ? ` | ${err} eksik: ${missing.join(', ')}` : ''}`)
    console.log(`  Opsiyonel: ${ok} ${optPresent.join(', ') || '-'}`)
    if (optMissing.length) {
      console.log(`  ${info} Yok (normal): ${optMissing.join(', ')}`)
    }
  }
}

// ─── 3. ZORUNLU ALAN BOŞ ORAN RAPORU ─────────────────────────────────────────

async function reportNullRates(pool: mysql.Pool) {
  printSection('3. ZORUNLU ALAN BOŞ ORAN RAPORU')

  const checks: [string, string[], string][] = [
    ['dergiler',   ['DergiBASLIK', 'Issn', 'Yayinci', 'KategoriID'], 'DergiID IS NOT NULL'],
    ['dergi_arsiv', ['Yil', 'Sayi', 'DergiID'],                       'ArsivID IS NOT NULL'],
    ['makaleler',  ['TitleTR', 'Yazarlar', 'ArsivID', 'DergiID', 'PdfLINK', 'doi'], 'MakaleID IS NOT NULL'],
  ]

  for (const [table, cols, where] of checks) {
    if (onlyTable && table !== onlyTable) continue
    const exists = await tableExists(pool, table)
    if (!exists) continue

    const [[cnt]] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) as c FROM \`${table}\` WHERE ${where}`,
    )
    const total = (cnt as { c: number }).c
    const tableActualCols = await getColumns(pool, table)
    const tableColSet = new Set(tableActualCols)

    console.log(`\n${C.bold}${table}${C.reset} (toplam: ${total})`)
    for (const col of cols) {
      if (!tableColSet.has(col)) {
        console.log(`  ${warn} ${col}: kolon yok (skip)`)
        continue
      }
      const rate = await nullRate(pool, table, col, total)
      const icon = rate === 0 ? ok : rate < 10 ? warn : err
      console.log(`  ${icon} ${col}: %${rate} boş`)
    }
  }
}

// ─── 4. DUPLICATE RAPORU ─────────────────────────────────────────────────────

async function reportDuplicates(pool: mysql.Pool) {
  printSection('4. DUPLICATE RAPORU')

  const checks: [string, string, string][] = [
    ['dergiler',   'DergiBASLIK', 'Başlığa göre duplicate'],
    ['dergiler',   'Issn',        'ISSN duplicate (boş hariç)'],
    ['makaleler',  'doi',         'DOI duplicate (boş hariç)'],
  ]

  for (const [table, col, label] of checks) {
    if (onlyTable && table !== onlyTable) continue
    const exists = await tableExists(pool, table)
    if (!exists) continue
    const actualCols = await getColumns(pool, table)
    if (!actualCols.includes(col)) { console.log(`  ${info} ${table}.${col}: kolon yok`); continue }

    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT \`${col}\`, COUNT(*) as c FROM \`${table}\`
       WHERE \`${col}\` IS NOT NULL AND \`${col}\` != ''
       GROUP BY \`${col}\` HAVING c > 1
       LIMIT 5`,
    )
    const dups = rows as { c: number }[]
    if (dups.length === 0) {
      console.log(`${ok} ${table}.${col}: ${label} — yok`)
    } else {
      console.log(`${warn} ${table}.${col}: ${label} — ${dups.length} grup (ilk 5 gösterildi)`)
      dups.forEach((d, i) => console.log(`   ${i + 1}. count=${d.c} | ${JSON.stringify(d)}`))
    }
  }
}

// ─── 5. ÖRNEK KAYIT DÖNÜŞÜMLERİ ──────────────────────────────────────────────

async function sampleJournals(pool: mysql.Pool) {
  if (onlyTable && onlyTable !== 'dergiler') return
  printSection(`5a. ÖRNEK DERGİ DÖNÜŞÜMÜ (${sampleSize} kayıt)`)

  const exists = await tableExists(pool, 'dergiler')
  if (!exists) { console.log(`${err} dergiler tablosu bulunamadı`); return }

  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT * FROM dergiler ORDER BY DergiID ASC LIMIT ?`, [sampleSize],
  )

  for (const raw of rows as Record<string, unknown>[]) {
    const d = raw as {
      DergiID: number; DergiBASLIK: string; Issn: string; Eissn: string
      YayinARALIGI: string; Yayinci: string; Aktif: number; Hit: number
      aim_and_scope?: string; Amac?: string; Kapsam?: string
      publisher?: string; about?: string; policy?: string
    }
    const slug = urlYap(d.DergiBASLIK)
    const aimAndScope = d.aim_and_scope?.trim() ||
      [d.Amac?.trim(), d.Kapsam?.trim()].filter(Boolean).join('\n\n') || null

    console.log(`\n  ${C.bold}DergiID=${d.DergiID}${C.reset}`)
    console.log(`    MySQL  : DergiBASLIK="${d.DergiBASLIK}"`)
    console.log(`    Supabase: id=${d.DergiID} slug="${slug}" title_tr="${d.DergiBASLIK}"`)
    console.log(`    issn="${d.Issn || '—'}" eissn="${d.Eissn || '—'}"`)
    console.log(`    publisher="${d.publisher || d.Yayinci || '—'}"`)
    console.log(`    aim_and_scope_len=${aimAndScope?.length ?? 0}`)
    console.log(`    status=${d.Aktif === 1 ? 'published' : 'draft'} hit=${d.Hit}`)
  }
}

async function sampleIssues(pool: mysql.Pool) {
  if (onlyTable && onlyTable !== 'dergi_arsiv') return
  printSection(`5b. ÖRNEK SAYI DÖNÜŞÜMÜ (${sampleSize} kayıt)`)

  const exists = await tableExists(pool, 'dergi_arsiv')
  if (!exists) { console.log(`${err} dergi_arsiv tablosu bulunamadı`); return }

  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT * FROM dergi_arsiv ORDER BY ArsivID ASC LIMIT ?`, [sampleSize],
  )

  for (const raw of rows as Record<string, unknown>[]) {
    const a = raw as { ArsivID: number; DergiID: number; Yil: string; Sayi: string; issue_id?: number; Aktif: number }
    const year = parseInt(a.Yil, 10) || null
    const dgpId = (a.issue_id ?? 0) > 0 ? a.issue_id : null

    console.log(`\n  ${C.bold}ArsivID=${a.ArsivID}${C.reset}`)
    console.log(`    MySQL  : DergiID=${a.DergiID} Yil="${a.Yil}" Sayi="${a.Sayi}"`)
    console.log(`    Supabase: id=${a.ArsivID} journal_id=${a.DergiID} year=${year} issue_number="${a.Sayi}"`)
    console.log(`    dergipark_issue_id=${dgpId ?? '—'} status=${a.Aktif === 1 ? 'published' : 'draft'}`)
  }
}

async function sampleArticles(pool: mysql.Pool) {
  if (onlyTable && onlyTable !== 'makaleler') return
  printSection(`5c. ÖRNEK MAKALE DÖNÜŞÜMÜ (${sampleSize} kayıt)`)

  const exists = await tableExists(pool, 'makaleler')
  if (!exists) { console.log(`${err} makaleler tablosu bulunamadı`); return }

  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT MakaleID, TitleTR, TitleEN, Yazarlar, IlkSAYFA, SonSAYFA,
            Tarih, DergiID, ArsivID, BirinciDIL, doi, PdfLINK,
            Aktif, Hit, Indirme, document_language, issue_id
     FROM makaleler ORDER BY MakaleID ASC LIMIT ?`,
    [sampleSize],
  )

  for (const raw of rows as Record<string, unknown>[]) {
    const m = raw as {
      MakaleID: number; TitleTR: string; TitleEN: string; Yazarlar: string
      IlkSAYFA: string; SonSAYFA: string; Tarih: string; DergiID: number
      ArsivID: number; BirinciDIL: string; doi?: string; PdfLINK: string
      Aktif: number; Hit: number; Indirme: number
      document_language?: string; issue_id?: number
    }
    const slug = urlYap(m.TitleTR || m.TitleEN || '')
    const pageStart = parseInt(m.IlkSAYFA, 10) || null
    const pageEnd   = parseInt(m.SonSAYFA, 10)  || null
    const year      = m.Tarih ? parseInt(m.Tarih.slice(0, 4), 10) : null
    const lang      = m.document_language?.trim() ||
                      (m.BirinciDIL?.toLowerCase().startsWith('en') ? 'en' : 'tr')
    const pdfPath   = m.PdfLINK?.trim()
    const hasPdf    = pdfPath && pdfPath !== '' && pdfPath !== 'pdf-bulunamadi'

    console.log(`\n  ${C.bold}MakaleID=${m.MakaleID}${C.reset}`)
    console.log(`    MySQL  : TitleTR="${m.TitleTR?.slice(0, 60)}..."`)
    console.log(`    Supabase: id=${m.MakaleID} slug="${slug?.slice(0, 50)}"`)
    console.log(`    journal_id=${m.DergiID} issue_id=${m.ArsivID}`)
    console.log(`    pages=${pageStart}–${pageEnd} year=${year} lang=${lang}`)
    console.log(`    doi="${m.doi || '—'}" pdf=${hasPdf ? 'var' : 'yok'} status=${m.Aktif === 1 ? 'published' : 'draft'}`)
    console.log(`    hit=${m.Hit} download=${m.Indirme}`)
  }
}

async function sampleAuthors(pool: mysql.Pool) {
  if (onlyTable && onlyTable !== 'makaleler') return
  printSection(`5d. ÖRNEK YAZAR/KURUM/KEYWORD DÖNÜŞÜMÜ (${sampleSize} makale)`)

  const exists = await tableExists(pool, 'makaleler')
  if (!exists) { console.log(`${err} makaleler tablosu bulunamadı`); return }

  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT MakaleID, Yazarlar, Kurum, KeywordsTR, KeywordsEN
     FROM makaleler WHERE Yazarlar != '' ORDER BY MakaleID ASC LIMIT ?`,
    [sampleSize],
  )

  for (const raw of rows as Record<string, unknown>[]) {
    const m = raw as { MakaleID: number; Yazarlar: string; Kurum: string; KeywordsTR: string; KeywordsEN: string }

    const authors = parseAuthors(m.Yazarlar).map(normalizeAuthorName).filter((n) => n.length >= 2)
    const kwTR = m.KeywordsTR?.split(',').map((s) => s.trim()).filter(Boolean) ?? []
    const kwEN = m.KeywordsEN?.split(',').map((s) => s.trim()).filter(Boolean) ?? []

    console.log(`\n  ${C.bold}MakaleID=${m.MakaleID}${C.reset}`)
    console.log(`  ${C.dim}Yazarlar (ham)${C.reset}: "${m.Yazarlar}"`)
    console.log(`  ${C.green}→ authors (${authors.length}): ${authors.slice(0, 4).join(' | ')}${authors.length > 4 ? '…' : ''}${C.reset}`)
    console.log(`  ${C.dim}Kurum (ham)${C.reset}: "${m.Kurum?.slice(0, 80) || '—'}"`)
    console.log(`  ${C.dim}KeywordsTR (ham)${C.reset}: "${m.KeywordsTR?.slice(0, 80) || '—'}"`)
    console.log(`  ${C.green}→ keywords_tr (${kwTR.length}): ${kwTR.slice(0, 4).join(' | ')}${C.reset}`)
    console.log(`  ${C.green}→ keywords_en (${kwEN.length}): ${kwEN.slice(0, 4).join(' | ')}${C.reset}`)
  }
}

// ─── 6. MIGRATION SIRASI RAPORU ───────────────────────────────────────────────

function reportMigrationOrder() {
  printSection('6. MİGRATION SIRASI')

  const migrations = [
    { no: '001', file: '001_journals_issues.sql',          type: 'CORE',     desc: 'categories + journals + issues' },
    { no: '002', file: '002_articles_pdf.sql',             type: 'CORE',     desc: 'articles + pdf_files' },
    { no: '003', file: '003_authors_junctions.sql',        type: 'CORE',     desc: 'authors + article_authors' },
    { no: '004', file: '004_rls_stats.sql',                type: 'RLS+VIEW', desc: 'RLS politikaları + platform_stats view' },
    { no: '005', file: '005_authors_bigserial_unique.sql', type: 'ALTER',    desc: 'authors.id bigserial + UNIQUE(name)' },
    { no: '006', file: '006_trgm_indexes.sql',             type: 'EXT+IDX',  desc: 'pg_trgm extension + GIN trigram index' },
    { no: '007', file: '007_institutions.sql',             type: 'CORE',     desc: 'institutions + article_institutions + RLS' },
    { no: '008', file: '008_users_profiles.sql',           type: 'CORE',     desc: 'user_profiles + user_favorites + RLS' },
    { no: '009', file: '009_keywords.sql',                 type: 'CORE',     desc: 'keywords + article_keywords + RLS' },
    { no: '010', file: '010_journal_applications.sql',     type: 'CORE',     desc: 'journal_applications + RLS' },
    { no: '011', file: '011_legacy_raw_archive.sql',       type: 'SCHEMA',   desc: 'legacy_raw schema (arşiv)' },
  ]

  printTable(
    migrations.map((m) => ({ No: m.no, Dosya: m.file, Tip: m.type, Açıklama: m.desc })),
    ['No', 'Dosya', 'Tip', 'Açıklama'],
  )
}

// ─── 7. ETL SIRA RAPORU ───────────────────────────────────────────────────────

function reportEtlOrder() {
  printSection('7. ETL SCRIPT SIRASI')

  const scripts = [
    { no: '01', file: '01-journals.ts',  dep: '-',           desc: 'kategoriler + dergiler → categories + journals' },
    { no: '02', file: '02-issues.ts',    dep: '01',          desc: 'dergi_arsiv → issues (DergiID FK)' },
    { no: '03', file: '03-articles.ts',  dep: '01, 02',      desc: 'makaleler → articles + pdf_files' },
    { no: '04', file: '04-authors.ts',   dep: '03',          desc: 'Yazarlar CSV → authors + article_authors' },
    { no: '-',  file: '(Faz-3)',         dep: '03, 04',      desc: 'makaleler.Kurum → institutions + article_institutions' },
    { no: '-',  file: '(Faz-3)',         dep: '03',          desc: 'Keywords CSV → keywords + article_keywords' },
    { no: '-',  file: '(Faz-5)',         dep: '-',           desc: 'uyeler → Supabase Auth invite + user_profiles' },
    { no: '-',  file: '(Faz-5)',         dep: '-',           desc: 'dergibasvuru → journal_applications' },
    { no: '99', file: '(Opsiyonel)',     dep: '-',           desc: 'archive-raw.ts → legacy_raw schema dolgusu' },
  ]

  printTable(
    scripts.map((s) => ({ No: s.no, Script: s.file, Bağımlılık: s.dep, Açıklama: s.desc })),
    ['No', 'Script', 'Bağımlılık', 'Açıklama'],
  )
}

// ─── 8. ENV DEĞİŞKENLERİ ─────────────────────────────────────────────────────

function reportEnvVars() {
  printSection('8. GEREKLİ .env DEĞİŞKENLERİ')

  const vars = [
    { Değişken: 'MYSQL_HOST',               Örnek: 'localhost',          Açıklama: 'MySQL sunucu adresi',           Zorunlu: 'EVET' },
    { Değişken: 'MYSQL_PORT',               Örnek: '3306',               Açıklama: 'MySQL portu (default 3306)',    Zorunlu: 'hayır' },
    { Değişken: 'MYSQL_USER',               Örnek: 'acarindex',          Açıklama: 'MySQL kullanıcı adı',           Zorunlu: 'EVET' },
    { Değişken: 'MYSQL_PASSWORD',           Örnek: '***',                Açıklama: 'MySQL şifresi',                 Zorunlu: 'EVET' },
    { Değişken: 'MYSQL_DATABASE',           Örnek: 'acarinde_yeniacarindex', Açıklama: 'MySQL veritabanı adı',     Zorunlu: 'EVET' },
    { Değişken: 'SUPABASE_URL',             Örnek: 'https://xxx.supabase.co', Açıklama: 'Supabase proje URL',      Zorunlu: 'EVET' },
    { Değişken: 'SUPABASE_SERVICE_ROLE_KEY', Örnek: 'eyJhbG...',         Açıklama: 'Service role key (gizli!)',     Zorunlu: 'EVET' },
    { Değişken: 'NEXT_PUBLIC_SUPABASE_URL',  Örnek: 'https://xxx.supabase.co', Açıklama: 'Frontend public URL',  Zorunlu: 'EVET' },
    { Değişken: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', Örnek: 'eyJhbG...', Açıklama: 'Frontend anon key',               Zorunlu: 'EVET' },
    { Değişken: 'LEGACY_PDF_BASE_URL',      Örnek: 'https://www.acarindex.com', Açıklama: 'PDF proxy kaynak URL', Zorunlu: 'EVET' },
    { Değişken: 'NEXT_PUBLIC_APP_URL',      Örnek: 'https://beta.acarindex.com', Açıklama: 'Canonical site URL', Zorunlu: 'EVET' },
  ]

  printTable(vars, ['Değişken', 'Örnek', 'Açıklama', 'Zorunlu'])

  console.log(`\n  ${info} ${C.yellow}UYARI: SUPABASE_SERVICE_ROLE_KEY kesinlikle client tarafına sızmamalı!${C.reset}`)
  console.log(`  ${info} .env.local dosyasını git'e ekleme — .gitignore'da olmalı.`)
}

// ─── 9. KONFLİKT / ÖNCELIK KURALLARI ────────────────────────────────────────

function reportConflictRules() {
  printSection('9. DUPLICATE / KONFLİKT KURALLARI')

  console.log(`
  ${C.bold}Genel Kural: Supabase ON CONFLICT ... DO UPDATE (upsert)${C.reset}

  journals:
    ${ok} id PRIMARY KEY = MySQL DergiID (korunur)
    ${ok} CONFLICT: legacy_id → UPDATE tüm alanlar
    ${info} bot_dergiler vs dergiler çakışırsa: dergiler kazanır (sonra çalışır)
    ${warn} ÇÖZÜM: bot MERGE scripti önce dergiler, sonra bot_dergiler çalıştırır

  issues:
    ${ok} id PRIMARY KEY = MySQL ArsivID (korunur)
    ${ok} CONFLICT: legacy_id → UPDATE
    ${info} Yıl=0 veya parse edilemeyen kayıtlar: year=NULL, status=draft

  articles:
    ${ok} id PRIMARY KEY = MySQL MakaleID (korunur)
    ${ok} CONFLICT: legacy_id → UPDATE tüm alanlar
    ${info} bot_makaleler vs makaleler: makaleler KAZANIR (öncelikli veri)
    ${info} bot_makaleler'de olan ama makaleler'de olmayan: eklenir
    ${warn} ÇÖZÜM: 03-articles.ts önce makaleler, sonra bot_makaleler (düşük öncelik flag ile)

  authors:
    ${ok} CONFLICT: name UNIQUE → UPDATE (idempotent)
    ${info} id = bigserial (DB üretir, manuel atama YOK)
    ${warn} Farklı makalelerde "Ahmet Yılmaz" ve "A. Yılmaz" → farklı yazar kaydı
    ${info} Faz-3'te yazar birleştirme algoritması (deduplication) planlanacak

  article_authors:
    ${ok} CONFLICT: (article_id, author_id) PRIMARY KEY

  Aktif=0 kayıtlar:
    ${ok} status = 'draft' olarak işaretlenir, silinmez
    ${ok} Frontend'de published=true filtresi kullanır
    ${ok} Admin panelinde draft kayıtlar görünür
`)
}

// ─── JSON RAPOR ───────────────────────────────────────────────────────────────

interface CountRow { table: string; target: string; total: number; active: number | null }
interface NullRateRow { table: string; column: string; nullPct: number }
interface DuplicateRow { table: string; column: string; groups: number }
interface ColumnCheckRow { table: string; missingRequired: string[]; missingOptional: string[] }

async function writeJsonReport(pool: mysql.Pool): Promise<void> {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const outDir = path.resolve(process.cwd(), 'reports')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, `etl-dry-run-${ts}.json`)

  // ── Sayımlar ────────────────────────────────────────────────────────────────
  const countMeta: [string, string][] = [
    ['dergiler', 'journals'],
    ['dergi_arsiv', 'issues'],
    ['makaleler', 'articles'],
    ['kategoriler', 'categories'],
    ['kurumlar', 'institutions'],
    ['uyeler', 'user_profiles'],
    ['dergibasvuru', 'journal_applications'],
  ]
  const counts: CountRow[] = []
  for (const [table, target] of countMeta) {
    const exists = await tableExists(pool, table)
    if (!exists) { counts.push({ table, target, total: -1, active: null }); continue }
    const [[cnt]] = await pool.execute<mysql.RowDataPacket[]>(`SELECT COUNT(*) as c FROM \`${table}\``)
    const total = (cnt as { c: number }).c
    let active: number | null = null
    const cols = await getColumns(pool, table)
    if (cols.includes('Aktif')) {
      const [[act]] = await pool.execute<mysql.RowDataPacket[]>(
        `SELECT COUNT(*) as c FROM \`${table}\` WHERE Aktif = 1`
      )
      active = (act as { c: number }).c
    }
    counts.push({ table, target, total, active })
  }

  // ── NULL oranları ────────────────────────────────────────────────────────────
  const nullChecks: [string, string][] = [
    ['dergiler', 'DergiBASLIK'], ['dergiler', 'Issn'], ['dergiler', 'Yayinci'],
    ['dergi_arsiv', 'Yil'], ['dergi_arsiv', 'Sayi'],
    ['makaleler', 'TitleTR'], ['makaleler', 'Yazarlar'],
    ['makaleler', 'PdfLINK'], ['makaleler', 'doi'],
  ]
  const nullRates: NullRateRow[] = []
  for (const [table, col] of nullChecks) {
    const exists = await tableExists(pool, table)
    if (!exists) continue
    const cols = await getColumns(pool, table)
    if (!cols.includes(col)) continue
    const [[cnt]] = await pool.execute<mysql.RowDataPacket[]>(`SELECT COUNT(*) as c FROM \`${table}\``)
    const total = (cnt as { c: number }).c
    const rate = await nullRate(pool, table, col, total)
    nullRates.push({ table, column: col, nullPct: rate })
  }

  // ── Duplicate kontrol ────────────────────────────────────────────────────────
  const dupChecks: [string, string][] = [
    ['dergiler', 'DergiBASLIK'], ['dergiler', 'Issn'], ['makaleler', 'doi'],
  ]
  const duplicates: DuplicateRow[] = []
  for (const [table, col] of dupChecks) {
    const exists = await tableExists(pool, table)
    if (!exists) continue
    const cols = await getColumns(pool, table)
    if (!cols.includes(col)) continue
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) as groups FROM (
         SELECT \`${col}\` FROM \`${table}\`
         WHERE \`${col}\` IS NOT NULL AND \`${col}\` != ''
         GROUP BY \`${col}\` HAVING COUNT(*) > 1
       ) t`
    )
    const groups = (rows[0] as { groups: number }).groups
    duplicates.push({ table, column: col, groups })
  }

  // ── Kolon kontrol ────────────────────────────────────────────────────────────
  const columnChecks: ColumnCheckRow[] = []
  for (const [table, schema] of Object.entries(REQUIRED_COLUMNS)) {
    const exists = await tableExists(pool, table)
    if (!exists) { columnChecks.push({ table, missingRequired: ['TABLE_NOT_FOUND'], missingOptional: [] }); continue }
    const actual = new Set(await getColumns(pool, table))
    columnChecks.push({
      table,
      missingRequired: schema.required.filter((c) => !actual.has(c)),
      missingOptional: schema.optional.filter((c) => !actual.has(c)),
    })
  }

  // ── Rapor nesnesi ────────────────────────────────────────────────────────────
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'dry-run',
    decisions: {
      primarySources: ['dergiler', 'dergi_arsiv', 'makaleler'],
      excluded: ['bot_dergiler', 'bot_dergi_arsiv', 'bot_makaleler'],
      archived: ['dergilerdeneme', 'dergiler_orj', 'makaleler2', 'makaleler3',
                 'makaleler_eski', 'dergi_arsiv_eski', 'dergi_arsiv_orj',
                 'dergi_arsiv_yilsiz', 'uyeler1', 'uyeler_deneme'],
    },
    counts,
    nullRates,
    duplicates,
    columnChecks,
    migrationOrder: [
      '001_journals_issues.sql',
      '002_articles_pdf.sql',
      '003_authors_junctions.sql',
      '004_rls_stats.sql',
      '005_authors_bigserial_unique.sql',
      '006_trgm_indexes.sql',
      '007_institutions.sql',
      '008_users_profiles.sql',
      '009_keywords.sql',
      '010_journal_applications.sql',
      '011_legacy_raw_archive.sql',
      '012_etl_audit.sql',
    ],
    etlOrder: [
      { script: '01-journals.ts', sourceTable: 'dergiler',    targetTable: 'journals' },
      { script: '02-issues.ts',   sourceTable: 'dergi_arsiv', targetTable: 'issues' },
      { script: '03-articles.ts', sourceTable: 'makaleler',   targetTable: 'articles + pdf_files' },
      { script: '04-authors.ts',  sourceTable: 'makaleler',   targetTable: 'authors + article_authors' },
    ],
    pilotConfig: { limitJournals: 100, limitIssues: 500, limitArticles: 1000 },
    requiredEnvVars: [
      'MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE',
      'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
      'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'LEGACY_PDF_BASE_URL', 'NEXT_PUBLIC_APP_URL',
    ],
  }

  fs.writeFileSync(outFile, JSON.stringify(report, null, 2), 'utf-8')
  console.log(`\n  ${ok} JSON raporu yazıldı: ${C.cyan}${outFile}${C.reset}`)
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`${C.bold}${C.cyan}`)
  console.log('  ████████╗████████╗██╗      ██████╗ ██████╗ ██╗   ██╗')
  console.log('  ██╔════╝╚══██╔══╝██║     ██╔══██╗██╔══██╗╚██╗ ██╔╝')
  console.log('  █████╗     ██║   ██║     ██║  ██║██████╔╝ ╚████╔╝ ')
  console.log('  ██╔══╝     ██║   ██║     ██║  ██║██╔══██╗  ╚██╔╝  ')
  console.log('  ███████╗   ██║   ███████╗╚██████╔╝██║  ██║   ██║   ')
  console.log('  ╚══════╝   ╚═╝   ╚══════╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝  ')
  console.log(`${C.reset}`)
  console.log(`  ${C.bold}AcarIndex ETL Dry-Run Raporu${C.reset} — ${new Date().toLocaleString('tr-TR')}`)
  console.log(`  ${C.yellow}⚠ DRY RUN: Supabase'e HİÇBİR VERİ YAZILMAZ${C.reset}\n`)

  let pool: mysql.Pool | null = null
  try {
    pool = getMysqlPool()

    // MySQL bağlantı testi
    const [rows] = await pool.execute<mysql.RowDataPacket[]>('SELECT DATABASE() as db, NOW() as ts')
    const conn = rows[0] as { db: string; ts: string }
    console.log(`${ok} MySQL bağlantısı: ${C.green}${conn.db}${C.reset} @ ${conn.ts}`)

    await reportCounts(pool)
    await reportColumns(pool)
    await reportNullRates(pool)
    await reportDuplicates(pool)
    await sampleJournals(pool)
    await sampleIssues(pool)
    await sampleArticles(pool)
    await sampleAuthors(pool)
    reportMigrationOrder()
    reportEtlOrder()
    reportEnvVars()
    reportConflictRules()

    // ─── JSON rapor yaz ───────────────────────────────────────────────────────
    await writeJsonReport(pool)

    printSection('✅ DRY-RUN TAMAMLANDI')
    console.log(`\n  ${ok} Yukarıdaki raporu onayladıktan sonra gerçek ETL'yi başlatabilirsiniz:`)
    console.log(`     npx tsx scripts/etl/run-all.ts\n`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('Eksik env')) {
      console.error(`\n${err} Env değişkeni eksik: ${msg}`)
      console.error(`  .env.local dosyasında MySQL ve Supabase değerlerini tanımlayın.`)
    } else {
      console.error(`\n${err} Bağlantı hatası: ${msg}`)
    }
    process.exit(1)
  } finally {
    if (pool) await pool.end()
  }
}

main()
